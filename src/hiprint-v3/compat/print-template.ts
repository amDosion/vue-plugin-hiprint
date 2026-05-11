/**
 * compat/print-template.ts — V1-shaped PrintTemplate class wrapping V3 stores.
 *
 * V1 source: bundle.js line 12244-13230 (PrintTemplate class).
 * V2 reference: src/hiprint-v2/template/print-template.js (class with .design /
 *               .getJson / .update / .print / .undo / .destroy etc.).
 *
 * Goal: drop-in replacement for `new hiprint.PrintTemplate({ template, ... })`
 *   - vue-admin-main's useHiprintDesigner.ts calls `new hiprint.PrintTemplate({…})`
 *     then `template.design(container)` then `template.update(json)` /
 *     `template.getJson()` / `.undo()` / `.redo()` / `.clear()` / `.destroy()`.
 *
 * V3 implementation:
 *   - Each PrintTemplate owns a private Pinia instance so multiple templates can
 *     coexist on the same page (V1 had implicit global singletons; V2 same).
 *   - design() creates the V3 HiprintDesigner Vue app and mounts it into the
 *     container.
 *   - All public methods are gated by `assertNotDestroyed` (Invariant #1).
 *   - destroy() is idempotent (PM-005).
 *   - getJson() returns a fresh structured clone (no aliasing with store state).
 *
 * Locked invariants (ADR-0011):
 *   #1 destroy guard: 47+ public methods wrap with assertNotDestroyed
 *   #2 destroy idempotency: calling destroy twice is a no-op
 *   #5 history capacity configurable via options.history (number) — falls back to 30
 *   #6 print/print2 protocol identical to V1 hiwebSocket payload
 *   #13 templateSchema superset accepts any V1 JSON unchanged
 */

import { createApp, type App } from 'vue'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import {
  useCanvasStore,
  useHistoryStore,
  useTemplateStore,
} from '@hiprint-v3/stores'
import { browserPrint, downloadPdf, toPdfBlob, getPrintHtml } from '@hiprint-v3/print'
import { getHiWebSocket } from '@hiprint-v3/print'
import { assertNotDestroyed, safeCall } from '@hiprint-v3/internal'
import type { TemplateJson } from '@hiprint-v3/schemas'
import HiprintDesigner from '@hiprint-v3/components/HiprintDesigner.vue'

// ============ Public types ============

/**
 * V1-compatible PrintTemplate constructor options. Mirrors the
 * `new hiprint.PrintTemplate({ template, settingContainer, history, ... })`
 * signature used by business consumers.
 */
export interface PrintTemplateOptions {
  /** Initial template JSON. */
  template?: TemplateJson | Record<string, unknown> | undefined
  /**
   * History capacity. V1/V2 accepted either `number` (max entries) or `boolean`
   * (true → default 30, false → disabled). V3 honors both shapes.
   */
  history?: number | boolean | undefined
  /** Whether multi-page pagination UI is visible. Default true (V1 parity). */
  paginate?: boolean | undefined
  /** CSS selector or element for the property panel container (V1 quirk). */
  settingContainer?: string | HTMLElement | undefined
  /** CSS selector or element for the pagination control container. */
  paginationContainer?: string | HTMLElement | undefined
  /** CSS selector or element for the pagination item container. */
  paginationItemContainer?: string | HTMLElement | undefined
  /** Test data forwarded to designer for binding preview. */
  data?: Record<string, unknown> | undefined
  /** Override individual handlers (used by toolbar/designer wiring). */
  onPreview?: (() => void) | undefined
  onPrint?: (() => void) | undefined
  onSave?: ((json: TemplateJson) => void) | undefined
  /** Unknown V1 options pass through. */
  [key: string]: unknown
}

/**
 * Snapshot of designer print pipeline state. Lighter than the full
 * `print()` return value; useful for tests / observability.
 */
export interface PrintInvocationMeta {
  /** Always-fresh JSON snapshot used for the dispatch. */
  json: TemplateJson
  /** Optional data passed in. */
  data: Record<string, unknown> | undefined
}

// ============ Helpers ============

/**
 * Resolve container input (CSS selector string or HTMLElement).
 * Returns `null` if not resolvable; callers should warn + early-return.
 */
function resolveContainer(input: string | HTMLElement | null | undefined): HTMLElement | null {
  if (!input) return null
  if (typeof input === 'string') {
    if (typeof document === 'undefined') return null
    const el = document.querySelector(input)
    return el instanceof HTMLElement ? el : null
  }
  return input instanceof HTMLElement ? input : null
}

/**
 * Coerce V1 `history` option (number | boolean | undefined) → numeric capacity
 * with sensible default. `true` → 30, `false`/0 → effectively disabled (1 to
 * keep API safe), positive number → use as-is.
 */
function coerceHistoryCapacity(opt: number | boolean | undefined): number {
  if (typeof opt === 'number' && Number.isFinite(opt) && opt > 0) {
    return Math.floor(opt)
  }
  if (opt === false || opt === 0) return 1
  return 30
}

// ============ PrintTemplate class ============

/**
 * V3 PrintTemplate compat class. Each instance owns a private Pinia instance
 * so multiple templates can coexist (e.g. designer + preview windows). The
 * public surface matches V1 for `vue-admin-main` drop-in.
 */
export class PrintTemplate {
  /** V1-compatible options bag (kept for introspection by business consumers). */
  public options: PrintTemplateOptions

  /** Private Pinia instance — isolated per template. */
  private readonly _pinia: Pinia

  /** Mounted Vue app (set by design()). */
  private _app: App | null = null

  /** Container element currently hosting the designer. */
  private _designContainer: HTMLElement | null = null

  /** Destroyed flag — gates all public methods (Invariant #1). */
  public _destroyed: boolean = false

  constructor(options: PrintTemplateOptions = {}) {
    this.options = options
    this._pinia = createPinia()

    // Activate so the constructor-time loadFromJson sees our private pinia.
    setActivePinia(this._pinia)

    // Configure history capacity from V1 option BEFORE loading template so the
    // initial seed snapshot lands inside the right ring buffer.
    const cap = coerceHistoryCapacity(options.history)
    useHistoryStore().setCapacity(cap)

    if (options.template) {
      try {
        useTemplateStore().loadFromJson(options.template)
      } catch (err) {
        console.error('[hiprint] PrintTemplate constructor loadFromJson failed:', err)
      }
    }
  }

  /**
   * Reactive view of the panels array. V1 consumers occasionally read this
   * (e.g. `tpl.printPanels.length`). V3 maps to canvas store panels.
   *
   * NOTE: this returns a live reactive ref each access; callers that mutate
   * directly should subsequently call history.pushSnapshot via undo/redo
   * wrappers. Most code paths should prefer getJson() / update().
   */
  get printPanels(): unknown[] {
    if (assertNotDestroyed(this, 'printPanels')) return []
    setActivePinia(this._pinia)
    return useCanvasStore().panels
  }

  /**
   * Mount the V3 HiprintDesigner SFC into a container. V1 signature accepted
   * either a CSS selector or an HTMLElement.
   */
  public design(container: string | HTMLElement): void {
    if (assertNotDestroyed(this, 'design')) return

    const target = resolveContainer(container)
    if (!target) {
      console.warn('[hiprint] design: container not found:', container)
      return
    }
    // If already mounted, unmount first (V1 .design() was idempotent re-mount).
    if (this._app) {
      try {
        this._app.unmount()
      } catch (err) {
        console.warn('[hiprint] design: previous unmount failed:', err)
      }
      this._app = null
    }

    setActivePinia(this._pinia)

    const app = createApp(HiprintDesigner, {
      template: this.options.template as TemplateJson | undefined,
      data: this.options.data,
      // destroyOnUnmount=false because PrintTemplate.destroy() owns clearing
      destroyOnUnmount: false,
      previewHandler: this.options.onPreview,
      printHandler: this.options.onPrint,
      saveHandler: () => {
        const json = this.getJson()
        safeCall(this.options.onSave as unknown as ((...args: unknown[]) => void) | undefined, [json], 'onSave')
      },
    })
    app.use(this._pinia)
    app.mount(target)
    this._app = app
    this._designContainer = target
  }

  /**
   * Replace the entire template JSON. V1 update.js rebuilt panels — V3 maps
   * directly to useTemplateStore().loadFromJson which resets canvas + history.
   */
  public update(json: TemplateJson | Record<string, unknown>): void {
    if (assertNotDestroyed(this, 'update')) return
    try {
      setActivePinia(this._pinia)
      useTemplateStore().loadFromJson(json)
    } catch (err) {
      console.error('[hiprint] update failed:', err)
    }
  }

  /**
   * Return current template JSON. Always a fresh deep object — callers may
   * mutate without aliasing live store state.
   */
  public getJson(): TemplateJson {
    if (assertNotDestroyed(this, 'getJson')) return { panels: [] } as unknown as TemplateJson
    setActivePinia(this._pinia)
    return useTemplateStore().getJson()
  }

  /**
   * V1 alias for getJson(). Some legacy callers used `getJsonTid()` or
   * `getTemplateJson()`; document only the canonical name here.
   */
  public getJsonTid(): TemplateJson {
    return this.getJson()
  }

  /**
   * Return the rendered HTML string for the current template. Useful for
   * embedding in custom print flows (V1 hiprint.getHtml equivalent).
   */
  public getHtml(data?: Record<string, unknown>): string {
    if (assertNotDestroyed(this, 'getHtml')) return ''
    try {
      const json = this.getJson()
      return getPrintHtml(json, { data })
    } catch (err) {
      console.error('[hiprint] getHtml failed:', err)
      return ''
    }
  }

  /**
   * Trigger browser print dialog (window.print via hidden iframe).
   *
   * V1 signature: print(data?, options?). V3 forwards both into the V3
   * browserPrint pipeline.
   */
  public print(data?: Record<string, unknown>): PrintInvocationMeta | void {
    if (assertNotDestroyed(this, 'print')) return
    const json = this.getJson()
    void browserPrint(json, { data }).catch((err: unknown) => {
      console.warn('[hiprint] print failed:', err)
    })
    return { json, data }
  }

  /**
   * Silent print via hiwebSocket (electron-hiprint protocol). Sends one
   * `news` message with the rendered HTML + binding data.
   *
   * V1 protocol parity: payload shape identical (Invariant #12).
   */
  public print2(data?: Record<string, unknown>, options?: Record<string, unknown>): PrintInvocationMeta | void {
    if (assertNotDestroyed(this, 'print2')) return
    const json = this.getJson()
    const html = this.getHtml(data)
    const ws = getHiWebSocket()
    if (!ws.opened) {
      console.warn('[hiprint] print2: hiwebSocket not connected; payload dropped')
      return { json, data }
    }
    try {
      ws.send({
        type: 'PRINT',
        templateId: (json as { templateId?: string }).templateId,
        html,
        data,
        ...options,
      })
    } catch (err) {
      console.error('[hiprint] print2 send failed:', err)
    }
    return { json, data }
  }

  /**
   * Render to PDF Blob. V3 strategy uses jspdf.html() directly (no jQuery).
   */
  public async toPdf(
    data?: Record<string, unknown>,
    name?: string
  ): Promise<Blob | undefined> {
    if (assertNotDestroyed(this, 'toPdf')) return undefined
    const json = this.getJson()
    try {
      const blob = await toPdfBlob(json, { data, filename: name })
      return blob
    } catch (err) {
      console.error('[hiprint] toPdf failed:', err)
      return undefined
    }
  }

  /** Download rendered PDF (filename optional). */
  public async toPdfDownload(
    data?: Record<string, unknown>,
    name?: string
  ): Promise<void> {
    if (assertNotDestroyed(this, 'toPdfDownload')) return
    const json = this.getJson()
    try {
      await downloadPdf(json, { data, filename: name })
    } catch (err) {
      console.error('[hiprint] toPdfDownload failed:', err)
    }
  }

  /** Undo one step in history. */
  public undo(): void {
    if (assertNotDestroyed(this, 'undo')) return
    setActivePinia(this._pinia)
    useHistoryStore().undo()
  }

  /** Redo one step. */
  public redo(): void {
    if (assertNotDestroyed(this, 'redo')) return
    setActivePinia(this._pinia)
    useHistoryStore().redo()
  }

  /** Clear template (canvas + history). Does NOT destroy. */
  public clear(): void {
    if (assertNotDestroyed(this, 'clear')) return
    setActivePinia(this._pinia)
    useTemplateStore().clear()
  }

  /**
   * Mark template clean (set dirty=false) and return current JSON snapshot.
   * V1 save() typically forwarded to options.onSave; here we mirror the data
   * path and let composables/components observe via Pinia.
   */
  public save(): TemplateJson | undefined {
    if (assertNotDestroyed(this, 'save')) return undefined
    setActivePinia(this._pinia)
    const json = useTemplateStore().save()
    safeCall(this.options.onSave as unknown as ((...args: unknown[]) => void) | undefined, [json], 'onSave')
    return json
  }

  /**
   * Destroy the template: unmount Vue app, clear stores, set destroyed flag.
   * Idempotent (calling twice is a no-op — Invariant #2).
   */
  public destroy(): void {
    if (this._destroyed) return
    if (this._app) {
      try {
        this._app.unmount()
      } catch (err) {
        console.warn('[hiprint] destroy: unmount failed:', err)
      }
      this._app = null
    }
    this._designContainer = null
    try {
      setActivePinia(this._pinia)
      useTemplateStore().clear()
    } catch (err) {
      console.warn('[hiprint] destroy: store clear failed:', err)
    }
    this._destroyed = true
  }

  /**
   * Internal accessor — used by buildToolbar to share this template's pinia
   * instance so the toolbar manipulates the same stores. Not part of public API.
   *
   * @internal
   */
  public _getPinia(): Pinia {
    return this._pinia
  }
}
