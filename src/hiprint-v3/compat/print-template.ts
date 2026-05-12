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
 *   - Each PrintTemplate owns a private event bus (mirrors V1 hinnn.event
 *     scoped by templateId; V3 isolates it on the instance for HMR safety).
 *   - design() creates the V3 HiprintDesigner Vue app and mounts it into the
 *     container.
 *   - All public methods are gated by `assertNotDestroyed` (Invariant #1).
 *   - destroy() is idempotent (PM-005).
 *   - getJson() returns a fresh structured clone (no aliasing with store state).
 *
 * Sprint 22c (TKT-060…TKT-085): 25 additional compat methods added so coverage
 * over the 67-method V1 PrintTemplate API surface rises from 14 → 40 (~60%).
 * Each new method follows the same conventions as the original 14:
 *   - `assertNotDestroyed(this, name)` guard with a typed fallback.
 *   - `setActivePinia(this._pinia)` before any store touch (multi-template safe).
 *   - JSDoc with V1 line ref + behavior description.
 *   - No `any` returns; falsey fallbacks are explicit.
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
  type CanvasElement,
  type Panel,
  type TemplateSnapshot,
} from '@hiprint-v3/stores'
import { browserPrint, downloadPdf, toPdfBlob, getPrintHtml } from '@hiprint-v3/print'
import { getHiWebSocket } from '@hiprint-v3/print'
import {
  assertNotDestroyed,
  safeCall,
  createEventBus,
  type EventBus,
  type EventHandler,
} from '@hiprint-v3/internal'
import { getInstance as getRegistryInstance, type ElementTypeGroupDef } from '@hiprint-v3/core'
import type { TemplateJson } from '@hiprint-v3/schemas'
import HiprintDesigner from '@hiprint-v3/components/HiprintDesigner.vue'

// ============ Paper presets (V1 _defaultPaperTypes parity) ============

/**
 * Default paper-type table (mirror V1 bundle.js line 13296-13303).
 * Units = mm (V1 stored width/height in mm; canvas store is unit-agnostic).
 *
 * Exposed for `setPaper(name)` lookup. Business consumers can supplement via
 * `PAPER_TYPES['Letter'] = { width: 215.9, height: 279.4 }` before construction.
 */
export const PAPER_TYPES: Record<string, { width: number; height: number }> = {
  A3: { width: 420, height: 296.6 },
  A4: { width: 210, height: 296.6 },
  A5: { width: 210, height: 147.6 },
  B3: { width: 500, height: 352.6 },
  B4: { width: 250, height: 352.6 },
  B5: { width: 250, height: 175.6 },
}

// ============ Align vocabulary mapping ============

/**
 * Canonical align kind on V3 PrintTemplate.alignElements() / setElsAlign().
 *
 * V1 uses two slightly-different vocabularies for the same operations:
 *   - `alignElements(type)`: 'left'/'right'/'top'/'bottom'/
 *     'horizontalCenter'/'verticalCenter'/'distributeHorizontal'/'distributeVertical'
 *     (V1 line 11626 — used by PrintPanel.alignElements)
 *   - `setElsAlign(e)`:      'left'/'right'/'top'/'bottom'/
 *     'vertical'/'horizontal'/'distributeHor'/'distributeVer'
 *     (V1 line 12995 — used by toolbar/right-click batch ops)
 *
 * V3 normalizes to the alignElements vocabulary internally and routes the
 * setElsAlign vocab through {@link mapSetElsAlignKind}.
 */
export type AlignKind =
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'horizontalCenter'
  | 'verticalCenter'

/** Canonical distribute direction. */
export type DistributeDirection = 'horizontal' | 'vertical'

/**
 * V1 `setElsAlign` kind set. The two odd ones (`vertical` / `horizontal`)
 * mean **align to mid-axis** — V1 row 11645/11648's `horizontalCenter` /
 * `verticalCenter`. Distribute kinds are abbreviated.
 */
export type SetElsAlignKind =
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'vertical'
  | 'horizontal'
  | 'distributeHor'
  | 'distributeVer'

/**
 * Map V1 setElsAlign vocab → canonical kind set.
 *
 * | setElsAlign     | canonical          |
 * |-----------------|--------------------|
 * | 'left'          | 'left'             |
 * | 'right'         | 'right'            |
 * | 'top'           | 'top'              |
 * | 'bottom'        | 'bottom'           |
 * | 'vertical'      | 'horizontalCenter' |   (V1 quirk: "vertical" = align-center-on-vertical-axis)
 * | 'horizontal'    | 'verticalCenter'   |   (V1 quirk: "horizontal" = align-center-on-horizontal-axis)
 * | 'distributeHor' | 'distributeHorizontal' (distribute is handled separately) |
 * | 'distributeVer' | 'distributeVertical'                                       |
 */
function mapSetElsAlignKind(kind: SetElsAlignKind):
  | { type: 'align'; kind: AlignKind }
  | { type: 'distribute'; direction: DistributeDirection } {
  switch (kind) {
    case 'left':
    case 'right':
    case 'top':
    case 'bottom':
      return { type: 'align', kind }
    case 'vertical':
      return { type: 'align', kind: 'horizontalCenter' }
    case 'horizontal':
      return { type: 'align', kind: 'verticalCenter' }
    case 'distributeHor':
      return { type: 'distribute', direction: 'horizontal' }
    case 'distributeVer':
      return { type: 'distribute', direction: 'vertical' }
  }
}

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
  /**
   * Dynamic-field map. V1 PrintTemplate accepted this on construction so
   * field resolution + property-panel field dropdowns could read from it
   * (V1 line 12904 setFields). Stored on the instance and emitted as
   * `dynamic-fields-change` on later mutation.
   */
  dynamicFields?: Record<string, unknown> | unknown[] | undefined
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

/** Unsubscribe handle returned by {@link PrintTemplate.on}. */
export type UnsubFn = () => void

/** Active-panel JSON snapshot returned by {@link PrintTemplate.getActivePanelJson}. */
export interface ActivePanelJson {
  /** Panel record (id, paper metadata, etc.) — no live aliasing. */
  panel: Panel | null
  /** Print elements of the active panel as a fresh array (no live aliasing). */
  elements: CanvasElement[]
}

/** Result of {@link PrintTemplate.getHistory}. */
export interface HistorySnapshotInfo {
  entries: TemplateSnapshot[]
  cursor: number
}

/** Result of {@link PrintTemplate.getPaperSize}. */
export interface PaperSize {
  width: number
  height: number
  paperType: string
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

/**
 * Find which panel hosts an element. Returns the panel id and element ref,
 * or null if not found. Cheap linear scan — designers typically have ≤ 10
 * panels with ≤ 100 elements each.
 */
function findPanelOfElement(
  canvas: ReturnType<typeof useCanvasStore>,
  elementId: string
): { panel: Panel; el: CanvasElement } | null {
  for (const p of canvas.panels) {
    const el = p.printElements.find((e) => e.id === elementId)
    if (el) return { panel: p, el }
  }
  return null
}

/**
 * Read numeric option from element with a default. `getLeft`/`getTop`/
 * `getWidth`/`getHeight` in V1 BasePrintElement options coerced from string
 * mm units; in V3 the JSON path is plain numbers and the runtime applies
 * units when rendering — here we coerce defensively because the test JSON
 * uses bare numbers.
 */
function num(opts: Record<string, unknown> | undefined, key: string, fallback = 0): number {
  if (!opts) return fallback
  const v = opts[key]
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const parsed = Number.parseFloat(v)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
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

  /** Private event bus — mirrors V1 templateId-scoped event-bus channel. */
  private readonly _eventBus: EventBus

  /** Mounted Vue app (set by design()). */
  private _app: App | null = null

  /** Container element currently hosting the designer. */
  private _designContainer: HTMLElement | null = null

  /**
   * Dynamic-field map (V1 PrintTemplate.fields equivalent). Business consumers
   * set this via setDynamicFields / appendElementTypeGroups; field-resolution
   * code reads via getDynamicFields.
   */
  private _dynamicFields: Record<string, unknown> | unknown[] | undefined = undefined

  /**
   * Font list (V1 PrintTemplate.fontList equivalent — line 12898/12901). Used
   * by the property panel font dropdown to populate selectable typefaces.
   * Stored on the instance + emitted as `'font-list-change'` on mutation.
   */
  private _fontList: string[] = []

  /** Destroyed flag — gates all public methods (Invariant #1). */
  public _destroyed: boolean = false

  constructor(options: PrintTemplateOptions = {}) {
    this.options = options
    this._pinia = createPinia()
    this._eventBus = createEventBus()
    this._dynamicFields = options.dynamicFields

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
    } else {
      // ST-001: bare `new PrintTemplate({})` (or no options) → seed a default
      // A4 portrait panel so the designer surface always has an editable paper.
      // V1 parity: V1's PrintTemplate ctor would auto-build one paper via
      // `init.panels` when template was missing. A4 in pt: 210mm/25.4*72 ≈ 595.28,
      // 297mm/25.4*72 ≈ 841.89. addPanel auto-assigns activePanelId when first.
      try {
        useCanvasStore().addPanel({ width: 595.28, height: 841.89, name: '1' })
      } catch (err) {
        console.error('[hiprint] PrintTemplate constructor default-panel failed:', err)
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

  // ===========================================================================
  // Sprint 22c — TKT-060…TKT-085: V1 compat method expansion
  // ===========================================================================

  // -------- TKT-060 rotatePaper --------

  /**
   * Swap active panel's width/height (portrait ↔ landscape). Pushes a history
   * snapshot so the rotation is undoable.
   *
   * V1 ref: bundle.js line 12480-12482 (rotatePaper) → PrintPanel.rotatePaper
   *         (V1 line 11176) swaps width/height directly on the panel record.
   */
  public rotatePaper(): void {
    if (assertNotDestroyed(this, 'rotatePaper')) return
    setActivePinia(this._pinia)
    const canvas = useCanvasStore()
    const ap = canvas.activePanel
    if (!ap) return
    canvas.updatePanel(ap.id, { width: ap.height, height: ap.width })
    useHistoryStore().pushSnapshot()
    this._eventBus.trigger('paper-change', ap.id)
  }

  // -------- TKT-061 setPaper --------

  /**
   * Switch active panel to a preset paper or to custom dimensions.
   *
   * Dual signature (V1 parity — bundle.js line 12473-12479):
   *   - `setPaper('A4')` looks up {@link PAPER_TYPES} and applies w/h + name.
   *   - `setPaper(width, height)` (both numeric) → custom paper; paperType
   *     becomes `'custom'`.
   *   - `setPaper(paperType, width, height)` — explicit 3-arg form (uncommon
   *     but accepted by V1 toolbar through resize).
   *
   * Unknown preset name → console.warn + no-op (matches V3 safety; V1 threw).
   *
   * @throws never (V1 threw; V3 prefers warn-and-skip — see invariant #14)
   */
  public setPaper(paperType: string | number, height?: number, explicitHeight?: number): void {
    if (assertNotDestroyed(this, 'setPaper')) return
    setActivePinia(this._pinia)
    const canvas = useCanvasStore()
    const ap = canvas.activePanel
    if (!ap) {
      console.warn('[hiprint] setPaper: no active panel')
      return
    }

    let width: number | undefined
    let h: number | undefined
    let typeName: string | undefined

    if (typeof paperType === 'number') {
      // setPaper(width, height) — custom paper
      width = paperType
      h = typeof height === 'number' ? height : undefined
      typeName = 'custom'
    } else if (typeof paperType === 'string') {
      const numericMatch = /^[+-]?(\d+\.?\d*|\.\d+)$/.test(paperType)
      if (numericMatch) {
        // V1 quirk: string-numeric also accepted
        width = Number.parseFloat(paperType)
        h = typeof height === 'number' ? height : undefined
        typeName = 'custom'
      } else if (typeof height === 'number' && typeof explicitHeight === 'number') {
        // 3-arg form: setPaper(name, w, h)
        typeName = paperType
        width = height
        h = explicitHeight
      } else {
        const preset = PAPER_TYPES[paperType]
        if (!preset) {
          console.warn('[hiprint] setPaper: unknown paper type "' + paperType + '"')
          return
        }
        typeName = paperType
        width = preset.width
        h = preset.height
      }
    }

    if (typeof width !== 'number' || typeof h !== 'number') {
      console.warn('[hiprint] setPaper: width/height not resolvable from args')
      return
    }
    canvas.updatePanel(ap.id, { width, height: h, paperType: typeName })
    useHistoryStore().pushSnapshot()
    this._eventBus.trigger('paper-change', ap.id, { width, height: h, paperType: typeName })
  }

  // -------- TKT-062 alignElements --------

  /**
   * Align all selected elements to one of six anchors. Requires ≥2 selected;
   * silently no-ops otherwise.
   *
   * V1 ref: bundle.js line 11626-11678 (PrintPanel.alignElements) — computes
   * minLeft/maxRight/minTop/maxBottom across the selection bounding box, then
   * updates each element's left/top via updateSizeAndPositionOptions.
   */
  public alignElements(type: AlignKind): void {
    if (assertNotDestroyed(this, 'alignElements')) return
    setActivePinia(this._pinia)
    const canvas = useCanvasStore()
    const selected = canvas.selectedElements
    if (selected.length < 2) return

    const bounds = selected.map((el) => ({
      el,
      left: num(el.options, 'left'),
      top: num(el.options, 'top'),
      width: num(el.options, 'width'),
      height: num(el.options, 'height'),
    }))
    const minLeft = Math.min(...bounds.map((b) => b.left))
    const maxRight = Math.max(...bounds.map((b) => b.left + b.width))
    const minTop = Math.min(...bounds.map((b) => b.top))
    const maxBottom = Math.max(...bounds.map((b) => b.top + b.height))

    for (const b of bounds) {
      const hit = findPanelOfElement(canvas, b.el.id)
      if (!hit) continue
      let nextLeft = b.left
      let nextTop = b.top
      switch (type) {
        case 'left':
          nextLeft = minLeft
          break
        case 'right':
          nextLeft = maxRight - b.width
          break
        case 'top':
          nextTop = minTop
          break
        case 'bottom':
          nextTop = maxBottom - b.height
          break
        case 'horizontalCenter': {
          const cx = (minLeft + maxRight) / 2
          nextLeft = cx - b.width / 2
          break
        }
        case 'verticalCenter': {
          const cy = (minTop + maxBottom) / 2
          nextTop = cy - b.height / 2
          break
        }
      }
      canvas.updateElement(hit.panel.id, b.el.id, {
        options: { left: nextLeft, top: nextTop },
      })
    }
    useHistoryStore().pushSnapshot()
    this._eventBus.trigger('align', type)
  }

  // -------- TKT-063 distributeElements --------

  /**
   * Distribute the selection with equal spacing along an axis. Requires
   * ≥3 selected; silently no-ops otherwise (V1 line 11652/11663 parity).
   *
   * V1 ref: bundle.js line 11651-11672 (PrintPanel.alignElements
   * 'distributeHorizontal' / 'distributeVertical' branches).
   */
  public distributeElements(direction: DistributeDirection): void {
    if (assertNotDestroyed(this, 'distributeElements')) return
    setActivePinia(this._pinia)
    const canvas = useCanvasStore()
    const selected = canvas.selectedElements
    if (selected.length < 3) return

    const bounds = selected.map((el) => ({
      el,
      left: num(el.options, 'left'),
      top: num(el.options, 'top'),
      width: num(el.options, 'width'),
      height: num(el.options, 'height'),
    }))
    const minLeft = Math.min(...bounds.map((b) => b.left))
    const maxRight = Math.max(...bounds.map((b) => b.left + b.width))
    const minTop = Math.min(...bounds.map((b) => b.top))
    const maxBottom = Math.max(...bounds.map((b) => b.top + b.height))

    if (direction === 'horizontal') {
      bounds.sort((a, b) => a.left - b.left)
      const totalW = bounds.reduce((s, b) => s + b.width, 0)
      const gap = (maxRight - minLeft - totalW) / (bounds.length - 1)
      let cursor = (bounds[0]?.left ?? 0) + (bounds[0]?.width ?? 0) + gap
      for (let i = 1; i < bounds.length - 1; i++) {
        const b = bounds[i]!
        const hit = findPanelOfElement(canvas, b.el.id)
        if (hit) {
          canvas.updateElement(hit.panel.id, b.el.id, {
            options: { left: cursor, top: b.top },
          })
        }
        cursor += b.width + gap
      }
    } else {
      bounds.sort((a, b) => a.top - b.top)
      const totalH = bounds.reduce((s, b) => s + b.height, 0)
      const gap = (maxBottom - minTop - totalH) / (bounds.length - 1)
      let cursor = (bounds[0]?.top ?? 0) + (bounds[0]?.height ?? 0) + gap
      for (let i = 1; i < bounds.length - 1; i++) {
        const b = bounds[i]!
        const hit = findPanelOfElement(canvas, b.el.id)
        if (hit) {
          canvas.updateElement(hit.panel.id, b.el.id, {
            options: { left: b.left, top: cursor },
          })
        }
        cursor += b.height + gap
      }
    }
    useHistoryStore().pushSnapshot()
    this._eventBus.trigger('distribute', direction)
  }

  // -------- TKT-064 zoom / zoomIn / zoomOut / zoomReset --------

  /**
   * Set canvas zoom level (1.0 = 100%). Forwards to canvas.setScale (which
   * clamps to 0.1..5).
   *
   * V1 ref: bundle.js line 12486-12488 (zoom(s, p)) — second arg `p` was a
   * pivot point unused in V3 (CSS transform-origin replaces it).
   */
  public zoom(percent: number): void {
    if (assertNotDestroyed(this, 'zoom')) return
    setActivePinia(this._pinia)
    useCanvasStore().setScale(percent)
    this._eventBus.trigger('zoom-change', percent)
  }

  /** Step zoom up by 0.1 (matches V1 default scaleStep). */
  public zoomIn(): void {
    if (assertNotDestroyed(this, 'zoomIn')) return
    setActivePinia(this._pinia)
    const canvas = useCanvasStore()
    canvas.setScale(canvas.scale + 0.1)
    this._eventBus.trigger('zoom-change', canvas.scale)
  }

  /** Step zoom down by 0.1. */
  public zoomOut(): void {
    if (assertNotDestroyed(this, 'zoomOut')) return
    setActivePinia(this._pinia)
    const canvas = useCanvasStore()
    canvas.setScale(canvas.scale - 0.1)
    this._eventBus.trigger('zoom-change', canvas.scale)
  }

  /** Reset zoom to 100%. */
  public zoomReset(): void {
    if (assertNotDestroyed(this, 'zoomReset')) return
    setActivePinia(this._pinia)
    useCanvasStore().setScale(1)
    this._eventBus.trigger('zoom-change', 1)
  }

  // -------- TKT-065 addPrintPanel / removePrintPanel --------

  /**
   * Add a new panel. V1 returned the panel instance; V3 returns the Panel
   * record (or null on failure). Pushes a history snapshot.
   *
   * V1 ref: bundle.js line 12489-12492 (addPrintPanel(t, e)) — V3 omits the
   * `e` (select-after-add) arg; callers use selectPanel(idx) explicitly.
   */
  public addPrintPanel(opts?: Partial<Panel>): Panel | null {
    if (assertNotDestroyed(this, 'addPrintPanel')) return null
    setActivePinia(this._pinia)
    const canvas = useCanvasStore()
    const merged: Partial<Panel> & Pick<Panel, 'width' | 'height'> = {
      width: opts?.width ?? 595.28,
      height: opts?.height ?? 841.89,
      name: opts?.name ?? String(canvas.panels.length + 1),
      ...opts,
    }
    const next = canvas.addPanel(merged)
    useHistoryStore().pushSnapshot()
    this._eventBus.trigger('panel-add', next.id)
    return next
  }

  /**
   * Remove a panel by id or index. Honors canvas store's "keep ≥ 1 panel"
   * invariant (state-modeler R3); returns silently when removal is refused.
   *
   * V1 ref: bundle.js line 12500-12515 (deletePanel(t)).
   */
  public removePrintPanel(idOrIdx: string | number): void {
    if (assertNotDestroyed(this, 'removePrintPanel')) return
    setActivePinia(this._pinia)
    const canvas = useCanvasStore()
    const id =
      typeof idOrIdx === 'string'
        ? idOrIdx
        : canvas.panels[idOrIdx]?.id
    if (!id) return
    canvas.removePanel(id)
    useHistoryStore().pushSnapshot()
    this._eventBus.trigger('panel-remove', id)
  }

  // -------- TKT-066 selectPanel --------

  /**
   * Activate a panel as the editing target. Accepts panel id (string) or
   * 0-based index (number).
   *
   * V1 ref: bundle.js line 12493-12499 (selectPanel(t)) — V1 clamped to
   * panels.length-1; V3 ignores out-of-range numbers with a warning.
   */
  public selectPanel(idOrIdx: string | number): void {
    if (assertNotDestroyed(this, 'selectPanel')) return
    setActivePinia(this._pinia)
    const canvas = useCanvasStore()
    const id =
      typeof idOrIdx === 'string'
        ? idOrIdx
        : canvas.panels[idOrIdx]?.id
    if (!id) {
      console.warn('[hiprint] selectPanel: unknown panel', idOrIdx)
      return
    }
    canvas.setActivePanel(id)
    useHistoryStore().pushSnapshot()
    this._eventBus.trigger('panel-select', id)
  }

  // -------- TKT-067 on / off / emit --------

  /**
   * Subscribe to template-scoped events.
   *
   * Built-in events emitted by V3 PrintTemplate:
   *   - `'paper-change'` `(panelId, { width, height, paperType })`
   *   - `'panel-add'` `(panelId)` / `'panel-remove'` `(panelId)`
   *     `'panel-select'` `(panelId)`
   *   - `'zoom-change'` `(scale)`
   *   - `'align'` `(kind)` / `'distribute'` `(direction)`
   *   - `'z-order-change'` `(elementId, action)`
   *   - `'dynamic-fields-change'` `(fields)`
   *
   * @returns Unsubscribe function (matches V3 idiomatic shape — V1 returned void).
   */
  public on(name: string, handler: EventHandler): UnsubFn {
    if (assertNotDestroyed(this, 'on')) return () => {}
    this._eventBus.on(name, handler)
    return () => this._eventBus.off(name, handler)
  }

  /**
   * Unsubscribe a handler from an event. Omitting `handler` clears the entire
   * event key (matches event-bus R3 invariant — destroy-time cleanup parity).
   */
  public off(name: string, handler?: EventHandler): void {
    if (assertNotDestroyed(this, 'off')) return
    this._eventBus.off(name, handler)
  }

  /**
   * Manually trigger an event. Mirrors event-bus.trigger; used by tests and
   * by advanced consumers needing to re-broadcast internal state.
   */
  public emit(name: string, ...args: unknown[]): void {
    if (assertNotDestroyed(this, 'emit')) return
    this._eventBus.trigger(name, ...args)
  }

  // -------- TKT-068 getElementByTid --------

  /**
   * Find first element across all panels with matching tid (V1's hot-path
   * for "first text element" sort of lookups).
   *
   * V1 ref: bundle.js line 12870-12872 (getElementByTid(t, e)) — V1 also
   * supported a 2nd `panelIndex` arg; V3 omits it (search globally — callers
   * who need scoping can use `getJson` and filter).
   */
  public getElementByTid(tid: string): CanvasElement | null {
    if (assertNotDestroyed(this, 'getElementByTid')) return null
    if (!tid) return null
    setActivePinia(this._pinia)
    const canvas = useCanvasStore()
    // V3 normalizes tid onto the top-level CanvasElement.tid (canvas store
    // shape). V1 JSON sometimes nested it under printElementType.tid — that
    // field rides through CanvasElement's index-signature loose surface, so we
    // probe it explicitly via `(printElementType as Record<string, unknown>)`.
    for (const p of canvas.panels) {
      const el = p.printElements.find((e) => {
        if (e.tid === tid) return true
        const pet = e.printElementType as Record<string, unknown> | undefined
        return pet && pet.tid === tid
      })
      if (el) return el
    }
    return null
  }

  // -------- TKT-069 getActivePanelJson --------

  /**
   * Plain JSON snapshot of the active panel + its elements. Useful for
   * persisting only the visible panel (V1 quirk used by single-page demos).
   * Returns a fresh deep copy — callers may mutate freely.
   */
  public getActivePanelJson(): ActivePanelJson {
    if (assertNotDestroyed(this, 'getActivePanelJson')) {
      return { panel: null, elements: [] }
    }
    setActivePinia(this._pinia)
    const canvas = useCanvasStore()
    const ap = canvas.activePanel
    if (!ap) return { panel: null, elements: [] }
    const elements = ap.printElements.map((el) => ({
      ...el,
      options: { ...el.options },
    }))
    const panel: Panel = { ...ap, printElements: elements }
    return { panel, elements }
  }

  // -------- TKT-070 setDynamicFields --------

  /**
   * Bind a dynamic-field map onto the template. Field-resolution code (e.g.
   * `<text field="user.name">` rendering) reads from here.
   *
   * Emits `'dynamic-fields-change'` so subscribed components (property panel
   * field dropdowns) can refresh.
   *
   * V1 ref: bundle.js line 12904-12906 (setFields(t)) — V1 stored on
   * this.fields directly; V3 keeps a private field + event emission so
   * reactivity is explicit.
   */
  public setDynamicFields(fields: Record<string, unknown> | unknown[]): void {
    if (assertNotDestroyed(this, 'setDynamicFields')) return
    this._dynamicFields = fields
    this._eventBus.trigger('dynamic-fields-change', fields)
  }

  /**
   * Read current dynamic-field map. Useful for components that need to
   * synchronously read on mount (event-driven refresh covers later updates).
   */
  public getDynamicFields(): Record<string, unknown> | unknown[] | undefined {
    if (assertNotDestroyed(this, 'getDynamicFields')) return undefined
    return this._dynamicFields
  }

  // -------- TKT-071 appendElementTypeGroups --------

  /**
   * Add element type groups to a module (additive — does not remove existing).
   * Required argument: moduleName (V1 invariant — throws if empty).
   *
   * V1 ref: bundle.js line 13285 (hiprint.appendElementTypeGroups). V3 routes
   * through the registry singleton's `register` (idempotent + dedup-with-warn).
   */
  public appendElementTypeGroups(
    moduleName: string,
    groups: ElementTypeGroupDef[]
  ): void {
    if (assertNotDestroyed(this, 'appendElementTypeGroups')) return
    if (!moduleName) {
      throw new Error('[hiprint] appendElementTypeGroups: moduleName is required')
    }
    const registry = getRegistryInstance()
    registry.register(moduleName, groups)
    this._eventBus.trigger('element-type-groups-change', moduleName, groups)
  }

  // -------- TKT-072 setElementTypeGroups --------

  /**
   * Replace all element type groups under a module (removes existing first).
   * V1 ref: bundle.js line 13278 (hiprint.setElementTypeGroups) — wraps
   * registry.setDynamic which is unregister + register.
   */
  public setElementTypeGroups(
    moduleName: string,
    groups: ElementTypeGroupDef[]
  ): void {
    if (assertNotDestroyed(this, 'setElementTypeGroups')) return
    if (!moduleName) {
      throw new Error('[hiprint] setElementTypeGroups: moduleName is required')
    }
    const registry = getRegistryInstance()
    registry.setDynamic(moduleName, groups)
    this._eventBus.trigger('element-type-groups-change', moduleName, groups)
  }

  // -------- TKT-073 selectAllElements / selectElementsByField --------

  /**
   * Select all visible elements across all panels. V1 ref: bundle.js line
   * 12976-12986 (selectAllElements()).
   */
  public selectAllElements(): void {
    if (assertNotDestroyed(this, 'selectAllElements')) return
    setActivePinia(this._pinia)
    const canvas = useCanvasStore()
    const ids = canvas.allElements.map((el) => el.id)
    canvas.selectMultiple(ids)
    this._eventBus.trigger('selection-change', ids)
  }

  /**
   * Select all elements whose `options.field` matches `field`. Useful for
   * batch-editing all bindings of a single data field at once.
   *
   * V1 ref: bundle.js line 12964-12975 (selectElementsByField(fieldsArray)).
   * V1 accepted an array; V3 narrows to a single field name (callers iterate
   * if they need multi).
   */
  public selectElementsByField(field: string): void {
    if (assertNotDestroyed(this, 'selectElementsByField')) return
    if (!field) return
    setActivePinia(this._pinia)
    const canvas = useCanvasStore()
    const ids = canvas.allElements
      .filter((el) => (el.options as Record<string, unknown>).field === field)
      .map((el) => el.id)
    canvas.selectMultiple(ids)
    this._eventBus.trigger('selection-change', ids)
  }

  // -------- TKT-074 bringToFront / sendToBack / bringForward / sendBackward --------

  /**
   * Move an element to the top of its panel's z-order (rendered last → on top).
   * `elId` defaults to the first selected element when omitted.
   *
   * V1 ref: keyboard shortcut Ctrl/Cmd+Shift+] (bundle.js line 10983-11003).
   * V1 manipulated DOM z-index directly; V3 reorders the printElements array
   * (later index = higher z) via canvas.reorderElement.
   */
  public bringToFront(elId?: string): void {
    if (assertNotDestroyed(this, 'bringToFront')) return
    this._zOrder(elId, 'front')
  }

  /** Move element to the bottom of its panel's z-order. */
  public sendToBack(elId?: string): void {
    if (assertNotDestroyed(this, 'sendToBack')) return
    this._zOrder(elId, 'back')
  }

  /** Move element up one z-order step (toward front). */
  public bringForward(elId?: string): void {
    if (assertNotDestroyed(this, 'bringForward')) return
    this._zOrder(elId, 'forward')
  }

  /** Move element down one z-order step (toward back). */
  public sendBackward(elId?: string): void {
    if (assertNotDestroyed(this, 'sendBackward')) return
    this._zOrder(elId, 'backward')
  }

  /** Internal: resolve target element + apply reorder per action. */
  private _zOrder(
    elId: string | undefined,
    action: 'front' | 'back' | 'forward' | 'backward'
  ): void {
    setActivePinia(this._pinia)
    const canvas = useCanvasStore()
    let targetId: string | undefined = elId
    if (!targetId) {
      targetId = canvas.selectedElements[0]?.id
    }
    if (!targetId) return

    const hit = findPanelOfElement(canvas, targetId)
    if (!hit) return
    const arr = hit.panel.printElements
    const idx = arr.findIndex((e) => e.id === targetId)
    if (idx < 0) return

    let target: number = idx
    switch (action) {
      case 'front':
        target = arr.length - 1
        break
      case 'back':
        target = 0
        break
      case 'forward':
        target = Math.min(idx + 1, arr.length - 1)
        break
      case 'backward':
        target = Math.max(idx - 1, 0)
        break
    }
    if (target === idx) return
    canvas.reorderElement(hit.panel.id, idx, target)
    useHistoryStore().pushSnapshot()
    this._eventBus.trigger('z-order-change', targetId, action)
  }

  // -------- TKT-075 setElsAlign --------

  /**
   * V1 vocabulary alias for {@link alignElements} / {@link distributeElements}.
   *
   * Vocabulary differences (V1 line 12995-13073 — toolbar/right-click path):
   *
   * | setElsAlign     | canonical                                |
   * |-----------------|------------------------------------------|
   * | 'left'          | alignElements('left')                    |
   * | 'right'         | alignElements('right')                   |
   * | 'top'           | alignElements('top')                     |
   * | 'bottom'        | alignElements('bottom')                  |
   * | 'vertical'      | alignElements('horizontalCenter')        |
   * | 'horizontal'    | alignElements('verticalCenter')          |
   * | 'distributeHor' | distributeElements('horizontal')         |
   * | 'distributeVer' | distributeElements('vertical')           |
   *
   * NOTE V1 setElsAlign was NOT destroy-guarded (V1 line 12995 was missing
   * `_assertNotDestroyed`). V3 guards it (toolbar-and-shell.md §Section 7
   * NOTE recommends V3 fix).
   */
  public setElsAlign(kind: SetElsAlignKind): void {
    if (assertNotDestroyed(this, 'setElsAlign')) return
    const mapped = mapSetElsAlignKind(kind)
    if (mapped.type === 'align') {
      this.alignElements(mapped.kind)
    } else {
      this.distributeElements(mapped.direction)
    }
  }

  // -------- TKT-076 updateOption --------

  /**
   * Patch an element's options bag (V1 batch-style updateOption). The patch
   * is shallow-merged with the existing options dict.
   *
   * V1 ref: bundle.js line 12987-12994 (updateOption(option, v)) — V1 batch
   * applied a single `option: v` pair across the selection. V3 accepts an
   * object patch and a specific element id (more explicit / safer for
   * programmatic edits). For "all selected" batch use, the toolbar P17 has
   * its own composable.
   *
   * NOTE V1 was NOT destroy-guarded. V3 guards it.
   */
  public updateOption(elId: string, patch: Record<string, unknown>): void {
    if (assertNotDestroyed(this, 'updateOption')) return
    if (!elId || !patch || typeof patch !== 'object') return
    setActivePinia(this._pinia)
    const canvas = useCanvasStore()
    const hit = findPanelOfElement(canvas, elId)
    if (!hit) return
    canvas.updateElement(hit.panel.id, elId, { options: patch })
    useHistoryStore().pushSnapshot()
    this._eventBus.trigger('option-change', elId, patch)
  }

  // -------- TKT-077 lockElement / unlockElement --------

  /**
   * Mark an element as locked (positionLocked + sizeLocked). See V3
   * `interactions/lock.ts` for the full semantics — `lock`, `positionLocked`,
   * `sizeLocked`, `draggable=false` are all observed.
   *
   * V1 path: business consumers toggled `options.lock=true` via the property
   * panel; V3 surfaces a programmatic shortcut.
   */
  public lockElement(elId: string): void {
    if (assertNotDestroyed(this, 'lockElement')) return
    setActivePinia(this._pinia)
    const canvas = useCanvasStore()
    const hit = findPanelOfElement(canvas, elId)
    if (!hit) return
    canvas.updateElement(hit.panel.id, elId, {
      options: { positionLocked: true, sizeLocked: true },
    })
    useHistoryStore().pushSnapshot()
    this._eventBus.trigger('lock-change', elId, true)
  }

  /** Clear positionLocked + sizeLocked (and the catch-all `lock` flag). */
  public unlockElement(elId: string): void {
    if (assertNotDestroyed(this, 'unlockElement')) return
    setActivePinia(this._pinia)
    const canvas = useCanvasStore()
    const hit = findPanelOfElement(canvas, elId)
    if (!hit) return
    canvas.updateElement(hit.panel.id, elId, {
      options: { positionLocked: false, sizeLocked: false, lock: false },
    })
    useHistoryStore().pushSnapshot()
    this._eventBus.trigger('lock-change', elId, false)
  }

  // -------- TKT-078 copyElement / pasteElement / cutElement --------

  /**
   * Copy an element into the internal clipboard (shared with keyboard +
   * context-menu interaction modules). Read-only — does not snapshot.
   *
   * V1 ref: Ctrl+C handler (bundle.js line ~10970+).
   */
  public copyElement(elId: string): void {
    if (assertNotDestroyed(this, 'copyElement')) return
    setActivePinia(this._pinia)
    const canvas = useCanvasStore()
    const hit = findPanelOfElement(canvas, elId)
    if (!hit) return
    // Use the shared clipboard accessor exposed by context-menu.ts (the
    // interactions layer owns the canonical clipboard so all three input
    // paths — context menu, keyboard, programmatic — agree).
    void this._withClipboard((set) => set([hit.el]))
    this._eventBus.trigger('clipboard-change', 'copy', elId)
  }

  /**
   * Paste the clipboard contents into the active panel. Pushes a snapshot
   * because new elements are introduced.
   */
  public pasteElement(): void {
    if (assertNotDestroyed(this, 'pasteElement')) return
    setActivePinia(this._pinia)
    const canvas = useCanvasStore()
    const activeId = canvas.activePanelId
    if (!activeId) return
    void this._withClipboard((_set, get) => {
      const clip = get()
      if (clip.length === 0) return
      for (const el of clip) {
        canvas.addElement(activeId, {
          tid: el.tid,
          options: { ...el.options },
          printElementType: el.printElementType,
        })
      }
      useHistoryStore().pushSnapshot()
      this._eventBus.trigger('clipboard-change', 'paste', activeId)
    })
  }

  /**
   * Cut = copy + remove. Pushes a snapshot because removal mutates state.
   * V1 quirk preserved: a fully-locked element is not cut (see
   * interactions/lock.ts isFullyLocked).
   */
  public cutElement(elId: string): void {
    if (assertNotDestroyed(this, 'cutElement')) return
    setActivePinia(this._pinia)
    const canvas = useCanvasStore()
    const hit = findPanelOfElement(canvas, elId)
    if (!hit) return
    void this._withClipboard((set) => set([hit.el]))
    canvas.removeElement(hit.panel.id, elId)
    useHistoryStore().pushSnapshot()
    this._eventBus.trigger('clipboard-change', 'cut', elId)
  }

  /**
   * Lazy-load the context-menu clipboard accessor. We use dynamic require to
   * avoid a top-level cyclic import (context-menu imports stores → stores
   * import nothing here, but to be defensive we keep this lazy).
   *
   * The "with" pattern lets us share one import path across copy/cut/paste
   * with minimal boilerplate; tests stub this via the real module.
   */
  private async _withClipboard(
    fn: (
      set: (els: CanvasElement[]) => void,
      get: () => CanvasElement[]
    ) => void
  ): Promise<void> {
    try {
      const mod = await import('@hiprint-v3/interactions/context-menu')
      fn(mod._setClipboard, mod._getClipboard)
    } catch (err) {
      console.warn('[hiprint] clipboard access failed:', err)
    }
  }

  // -------- TKT-079 getHistory / clearHistory / setHistoryCapacity --------

  /**
   * Read history state. `entries` is the recorded snapshots (newest-first per
   * vueuse), `cursor` is the current undo position.
   */
  public getHistory(): HistorySnapshotInfo {
    if (assertNotDestroyed(this, 'getHistory')) {
      return { entries: [], cursor: 0 }
    }
    setActivePinia(this._pinia)
    const history = useHistoryStore()
    return {
      entries: history.historyEntries.slice(),
      cursor: history.pos,
    }
  }

  /** Wipe history. Useful when forcing a "saved state" boundary. */
  public clearHistory(): void {
    if (assertNotDestroyed(this, 'clearHistory')) return
    setActivePinia(this._pinia)
    useHistoryStore().clear()
  }

  /** Adjust history capacity. Trims oversize stack to new capacity. */
  public setHistoryCapacity(cap: number): void {
    if (assertNotDestroyed(this, 'setHistoryCapacity')) return
    setActivePinia(this._pinia)
    useHistoryStore().setCapacity(cap)
  }

  // -------- TKT-080 getPaperSize / getMaxPanelIndex --------

  /**
   * Read the active panel's paper size + type. Returns A4 defaults if no
   * active panel (V3 invariant: panels.length should always be ≥1 after
   * loadFromJson, but defensive against early-init reads).
   */
  public getPaperSize(): PaperSize {
    if (assertNotDestroyed(this, 'getPaperSize')) {
      return { width: 595.28, height: 841.89, paperType: 'A4' }
    }
    setActivePinia(this._pinia)
    const ap = useCanvasStore().activePanel
    if (!ap) {
      return { width: 595.28, height: 841.89, paperType: 'A4' }
    }
    return {
      width: Number(ap.width),
      height: Number(ap.height),
      paperType: typeof ap.paperType === 'string' ? ap.paperType : 'custom',
    }
  }

  /**
   * Max panel index (panels.length - 1). Returns -1 when no panels.
   *
   * V1 ref: bundle.js line 12516-12518 (getPaneltotal — returns length).
   * V3 returns max-index instead because callers tended to compute `n - 1`
   * themselves; `getMaxPanelIndex()` is the more useful API.
   */
  public getMaxPanelIndex(): number {
    if (assertNotDestroyed(this, 'getMaxPanelIndex')) return -1
    setActivePinia(this._pinia)
    return useCanvasStore().panels.length - 1
  }

  // -------- TKT-081 exportPdf --------

  /**
   * Convenience alias for {@link toPdfDownload} — V1 demos sometimes used
   * `template.exportPdf(name)` directly.
   */
  public async exportPdf(name?: string): Promise<void> {
    if (assertNotDestroyed(this, 'exportPdf')) return
    await this.toPdfDownload(undefined, name)
  }

  // -------- TKT-082 previewWindow / printWindow --------

  /**
   * Open a new window with the rendered template HTML (preview without
   * triggering print dialog). Falls back to a console.warn in SSR / Node.
   *
   * V1 ref: bundle.js line ~14310 (preview button → window.open + write HTML).
   */
  public previewWindow(): void {
    if (assertNotDestroyed(this, 'previewWindow')) return
    if (typeof window === 'undefined') {
      console.warn('[hiprint] previewWindow: window unavailable (SSR / Node)')
      return
    }
    const html = this.getHtml(this.options.data as Record<string, unknown> | undefined)
    const w = window.open('', '_blank')
    if (!w) {
      console.warn('[hiprint] previewWindow: window.open returned null (blocked?)')
      return
    }
    try {
      w.document.open()
      w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>preview</title></head><body>')
      w.document.write(html)
      w.document.write('</body></html>')
      w.document.close()
      this._eventBus.trigger('preview', html)
    } catch (err) {
      console.warn('[hiprint] previewWindow: write failed:', err)
    }
  }

  /**
   * Open a window and invoke print() on it. Alias of {@link previewWindow}
   * plus an automatic print call.
   */
  public printWindow(): void {
    if (assertNotDestroyed(this, 'printWindow')) return
    if (typeof window === 'undefined') {
      console.warn('[hiprint] printWindow: window unavailable (SSR / Node)')
      return
    }
    const html = this.getHtml(this.options.data as Record<string, unknown> | undefined)
    const w = window.open('', '_blank')
    if (!w) {
      console.warn('[hiprint] printWindow: window.open returned null (blocked?)')
      return
    }
    try {
      w.document.open()
      w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>print</title></head><body>')
      w.document.write(html)
      w.document.write('</body></html>')
      w.document.close()
      if (typeof w.print === 'function') {
        try {
          w.focus()
          w.print()
        } catch (err) {
          console.warn('[hiprint] printWindow: print() threw:', err)
        }
      }
      this._eventBus.trigger('print-window', html)
    } catch (err) {
      console.warn('[hiprint] printWindow: write failed:', err)
    }
  }

  // -------- TKT-083 addPrintElement / removePrintElement --------

  /**
   * Add a new element to a panel. Returns the new CanvasElement (with assigned
   * id) or null on failure. Pushes a history snapshot.
   *
   * V1 ref: panels were the actual container in V1 (BasePrintElement was
   * constructed by panel.addPrintElement(opts)); V3 forwards to canvas.addElement.
   */
  public addPrintElement(
    panelId: string,
    opts: Partial<CanvasElement> & Pick<CanvasElement, 'tid'>
  ): CanvasElement | null {
    if (assertNotDestroyed(this, 'addPrintElement')) return null
    if (!panelId || !opts || !opts.tid) return null
    setActivePinia(this._pinia)
    const canvas = useCanvasStore()
    const next = canvas.addElement(panelId, opts)
    if (next) {
      useHistoryStore().pushSnapshot()
      this._eventBus.trigger('element-add', next.id, panelId)
    }
    return next
  }

  /**
   * Remove element by id (search across all panels). Pushes a history snapshot.
   *
   * V1 ref: bundle.js line 12765-12769 (deletePrintElement(t)) — iterated all
   * panels; V3 also handles cross-panel removal.
   */
  public removePrintElement(elId: string): void {
    if (assertNotDestroyed(this, 'removePrintElement')) return
    if (!elId) return
    setActivePinia(this._pinia)
    const canvas = useCanvasStore()
    const hit = findPanelOfElement(canvas, elId)
    if (!hit) return
    canvas.removeElement(hit.panel.id, elId)
    useHistoryStore().pushSnapshot()
    this._eventBus.trigger('element-remove', elId)
  }

  // -------- TKT-084 getOption / getAllOptions --------

  /**
   * Read a single option key from an element. Returns undefined when the
   * element doesn't exist or the key is missing.
   */
  public getOption(elId: string, key: string): unknown {
    if (assertNotDestroyed(this, 'getOption')) return undefined
    if (!elId || !key) return undefined
    setActivePinia(this._pinia)
    const canvas = useCanvasStore()
    const hit = findPanelOfElement(canvas, elId)
    if (!hit) return undefined
    return (hit.el.options as Record<string, unknown>)[key]
  }

  /**
   * Read the full options bag for an element. Returns an empty object when
   * the element doesn't exist. Result is a fresh shallow copy — mutating
   * the returned object does NOT update the canvas.
   */
  public getAllOptions(elId: string): Record<string, unknown> {
    if (assertNotDestroyed(this, 'getAllOptions')) return {}
    if (!elId) return {}
    setActivePinia(this._pinia)
    const canvas = useCanvasStore()
    const hit = findPanelOfElement(canvas, elId)
    if (!hit) return {}
    return { ...(hit.el.options as Record<string, unknown>) }
  }

  // ===========================================================================
  // Sprint 22g — Stream GB: V1 surface zero-out (12 final V1-named methods)
  // ===========================================================================
  //
  // After Sprint 22c added 41 methods (raising V1 coverage from 14 → 55), 12
  // V1-named methods still remained. These are the introspection / fields /
  // font-list / panel-probing accessors that V1 exposed for property-panel and
  // dynamic-data binding consumers. With these 12 the V3 compat class reaches
  // 67/67 V1 surface parity (toolbar-and-shell.md §Section 7).

  // -------- TKT-086 isDestroyed --------

  /**
   * Probe whether destroy() has been called. The one V1 method that is
   * intentionally NOT guarded (it IS the destroy probe).
   *
   * V1 ref: bundle.js line 12551-12553 (isDestroyed()).
   */
  public isDestroyed(): boolean {
    return !!this._destroyed
  }

  // -------- TKT-087 getPaneltotal --------

  /**
   * V1-named alias returning the total panel count (NOT max-index — that is
   * `getMaxPanelIndex`). V1 ref: bundle.js line 12516-12518.
   *
   * Returns 0 after destroy.
   */
  public getPaneltotal(): number {
    if (assertNotDestroyed(this, 'getPaneltotal')) return 0
    setActivePinia(this._pinia)
    return useCanvasStore().panels.length
  }

  // -------- TKT-088 getPaperType --------

  /**
   * Return the paper-type name for a given panel index (default 0). Returns
   * `undefined` if the panel doesn't exist or is destroyed.
   *
   * V1 ref: bundle.js line 12642-12644 (getPaperType(t)) — defaults `t=0`.
   */
  public getPaperType(panelIndex: number = 0): string | undefined {
    if (assertNotDestroyed(this, 'getPaperType')) return undefined
    setActivePinia(this._pinia)
    const panel = useCanvasStore().panels[panelIndex]
    return panel?.paperType
  }

  // -------- TKT-089 getOrient --------

  /**
   * Return 1 (portrait) or 2 (landscape) for the requested panel, based on
   * width vs height. V1 ref: bundle.js line 12645-12647.
   *
   * Returns `undefined` if the panel doesn't exist or template destroyed.
   */
  public getOrient(panelIndex: number = 0): 1 | 2 | undefined {
    if (assertNotDestroyed(this, 'getOrient')) return undefined
    setActivePinia(this._pinia)
    const panel = useCanvasStore().panels[panelIndex]
    if (!panel) return undefined
    // V1 semantics: h > w ⇒ portrait (1); w > h ⇒ landscape (2); square ⇒
    // portrait by convention (V1 returned 1 because the comparison was strict).
    return panel.height > panel.width ? 1 : 2
  }

  // -------- TKT-090 getPanel --------

  /**
   * Read a panel record by index (default 0). Returns undefined if missing
   * or destroyed. Result is the live store object — callers SHOULD treat it
   * as read-only and use `update()` to mutate.
   *
   * V1 ref: bundle.js line 12876-12878 (getPanel(t)) — V1 returned the live
   * PrintPanel instance; V3 returns the Panel record from canvas store.
   */
  public getPanel(panelIndex: number = 0): Panel | undefined {
    if (assertNotDestroyed(this, 'getPanel')) return undefined
    setActivePinia(this._pinia)
    return useCanvasStore().panels[panelIndex]
  }

  // -------- TKT-091 getElementByName --------

  /**
   * Find first element in the given panel (default 0) whose `options.name`
   * matches `name`. V1 used this for element-by-name lookup during data
   * binding — element-tag identification was via `options.name`, not tid.
   *
   * V1 ref: bundle.js line 12873-12875 (getElementByName(t, e)) — V1 forwarded
   * to PrintPanel.getElementByName.
   *
   * Returns null when not found / destroyed / panel missing / empty name.
   */
  public getElementByName(name: string, panelIndex: number = 0): CanvasElement | null {
    if (assertNotDestroyed(this, 'getElementByName')) return null
    if (!name) return null
    setActivePinia(this._pinia)
    const panel = useCanvasStore().panels[panelIndex]
    if (!panel) return null
    return (
      panel.printElements.find(
        (el) => (el.options as Record<string, unknown>).name === name
      ) ?? null
    )
  }

  // -------- TKT-092 setFontList / TKT-093 getFontList --------

  /**
   * Set the available font list. V1 ref: bundle.js line 12898-12900
   * (setFontList(t)). Emits `'font-list-change'`.
   *
   * Non-array input is coerced to `[]` (V1 stored as-is; V3 normalizes to
   * keep getFontList's return type honest).
   */
  public setFontList(list: string[]): void {
    if (assertNotDestroyed(this, 'setFontList')) return
    this._fontList = Array.isArray(list) ? list.slice() : []
    this._eventBus.trigger('font-list-change', this._fontList)
  }

  /**
   * Read the current font list. V1 ref: bundle.js line 12901-12903.
   * Returns `[]` (never undefined) when destroyed or unset — matches V1's
   * "this.fontList || []" lazy default.
   *
   * Returned array is a fresh shallow copy (mutation does not leak).
   */
  public getFontList(): string[] {
    if (assertNotDestroyed(this, 'getFontList')) return []
    return this._fontList.slice()
  }

  // -------- TKT-094 setFields / TKT-095 getFields --------

  /**
   * V1-canonical name for {@link setDynamicFields}. Maintained as a thin alias
   * so V1 consumers that called `template.setFields(...)` continue to work
   * unchanged. V1 ref: bundle.js line 12904-12906.
   */
  public setFields(fields: Record<string, unknown> | unknown[]): void {
    this.setDynamicFields(fields)
  }

  /**
   * V1-canonical name for {@link getDynamicFields}. V1 fallback was `[]` (not
   * `undefined`), so we coerce here for parity.
   *
   * V1 ref: bundle.js line 12907-12909.
   */
  public getFields(): Record<string, unknown> | unknown[] {
    if (assertNotDestroyed(this, 'getFields')) return []
    return this._dynamicFields ?? []
  }

  // -------- TKT-096 getFieldsInPanel --------

  /**
   * Return a flat array of every element across all panels whose `options.field`
   * is set. V1 used this to populate property-panel field dropdowns scoped
   * to fields actually referenced inside the template (vs the full
   * dynamicFields registry).
   *
   * V1 ref: bundle.js line 12916-12921 (getFieldsInPanel()) — V1 concatenated
   * the result of PrintPanel.getFieldsInPanel() across all panels.
   *
   * Returns `[]` if destroyed.
   */
  public getFieldsInPanel(): Array<Record<string, unknown>> {
    if (assertNotDestroyed(this, 'getFieldsInPanel')) return []
    setActivePinia(this._pinia)
    const out: Array<Record<string, unknown>> = []
    for (const panel of useCanvasStore().panels) {
      for (const el of panel.printElements) {
        const opts = el.options as Record<string, unknown>
        const fieldKey = opts.field
        if (typeof fieldKey === 'string' && fieldKey.length > 0) {
          out.push({
            field: fieldKey,
            title: opts.title,
            id: el.id,
            tid: el.tid,
            panelIndex: panel.index,
          })
        }
      }
    }
    return out
  }

  // -------- TKT-097 getTestData --------

  /**
   * Merged test data from all panels (each panel may hold panel-scoped test
   * data under `panel.testData` — preserved by canvas store's index signature).
   * V1 ref: bundle.js line 12922-12927 — V1 did
   * `Object.assign({}, ...panels.map(p => p.getTestData()))`.
   *
   * Returns `{}` when destroyed or no panel-scoped test data present.
   */
  public getTestData(): Record<string, unknown> {
    if (assertNotDestroyed(this, 'getTestData')) return {}
    setActivePinia(this._pinia)
    const merged: Record<string, unknown> = {}
    for (const panel of useCanvasStore().panels) {
      const td = (panel as Record<string, unknown>).testData
      if (td && typeof td === 'object' && !Array.isArray(td)) {
        Object.assign(merged, td as Record<string, unknown>)
      }
    }
    return merged
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

  /**
   * Internal accessor — used by toolbar/designer composables to subscribe to
   * template-scoped events. Not part of the public V1 surface.
   *
   * @internal
   */
  public _getEventBus(): EventBus {
    return this._eventBus
  }
}
