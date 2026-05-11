/**
 * compat/build-designer.ts — V1 buildDesigner(container, options) → Controller.
 *
 * V1 source: bundle.js line 13235-13305 + 14857-15000 (buildDesigner adapter).
 * V2 reference: src/hiprint-v2/ui/designer.js (adapter mode).
 *
 * V3 strategy: mount HiprintDesigner SFC inside container; owns its own Pinia
 * instance (separate from any PrintTemplate the consumer might construct).
 * Returns a controller with the V1 surface (getTemplate / setComponentPanelSlot
 * / rebuildComponentPanel / destroy).
 */

import { createApp, type App } from 'vue'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import HiprintDesigner from '@hiprint-v3/components/HiprintDesigner.vue'
import { useTemplateStore } from '@hiprint-v3/stores'
import { assertNotDestroyed } from '@hiprint-v3/internal'
import type { TemplateJson } from '@hiprint-v3/schemas'

// ============ Public types ============

export interface BuildDesignerOptions {
  /** Initial template JSON. */
  template?: TemplateJson | Record<string, unknown> | undefined
  /** Test data for binding preview. */
  data?: Record<string, unknown> | undefined
  /** Hide toolbar / element-list / property-panel. */
  hideToolbar?: boolean
  hideElementList?: boolean
  hidePropertyPanel?: boolean
  /** Toolbar handlers. */
  onPreview?: (() => void) | undefined
  onPrint?: (() => void) | undefined
  onSave?: ((json: TemplateJson) => void) | undefined
  /** V1 quirks for toolbar/panel slot configuration (pass-through). */
  toolbarOptions?: Record<string, unknown> | undefined
  templateOptions?: Record<string, unknown> | undefined
  componentPanelSlot?: Record<string, unknown> | undefined
  showPagination?: boolean | undefined
  /** Unknown V1 keys pass through. */
  [key: string]: unknown
}

export interface DesignerController {
  /** Unmount Vue app + clear stores. Idempotent. */
  destroy(): void
  /** Get current template JSON (fresh snapshot). */
  getJson(): TemplateJson
  /** Replace current template JSON. */
  update(json: TemplateJson | Record<string, unknown>): void
  /** V1 alias for getJson. */
  getTemplate(): TemplateJson
  /** V1 toolbar controller passthrough (returns minimal shim). */
  getToolbarCtrl(): { getScale: () => number; setScale: (s: number) => void }
  /** V1 component-panel slot setters (no-ops in V3 — slots are SFC-driven). */
  setComponentPanelSlot(slotOptions?: Record<string, unknown>): void
  clearComponentPanelSlot(): void
  rebuildComponentPanel(moduleName?: string, slotOptions?: Record<string, unknown>): void
  /** Underlying Vue app + container (escape hatches). */
  readonly _app: App
  readonly _container: HTMLElement
  _destroyed: boolean
}

// ============ Helpers ============

function resolveContainer(input: string | HTMLElement | null | undefined): HTMLElement | null {
  if (!input) return null
  if (typeof input === 'string') {
    if (typeof document === 'undefined') return null
    const el = document.querySelector(input)
    return el instanceof HTMLElement ? el : null
  }
  return input instanceof HTMLElement ? input : null
}

// ============ Public API ============

/**
 * Build a V3 designer inside `container`. Each designer owns its own Pinia
 * instance — multiple designers can coexist on one page.
 *
 * V1 signature: `hiprint.buildDesigner(container, options)`.
 */
export function buildDesigner(
  container: string | HTMLElement,
  options: BuildDesignerOptions = {}
): DesignerController {
  const target = resolveContainer(container)
  if (!target) {
    throw new Error('[hiprint] buildDesigner: container not found: ' + String(container))
  }

  const pinia = createPinia()
  setActivePinia(pinia)

  const app = createApp(HiprintDesigner, {
    template: options.template as TemplateJson | undefined,
    data: options.data,
    showToolbar: !options.hideToolbar,
    showElementList: !options.hideElementList,
    showPropertyPanel: !options.hidePropertyPanel,
    destroyOnUnmount: false,
    previewHandler: options.onPreview,
    printHandler: options.onPrint,
    saveHandler: options.onSave
      ? () => {
          try {
            setActivePinia(pinia)
            const json = useTemplateStore().getJson()
            options.onSave?.(json)
          } catch (err) {
            console.error('[hiprint] buildDesigner onSave threw:', err)
          }
        }
      : undefined,
  })
  app.use(pinia)
  app.mount(target)

  const controller: DesignerController = {
    _app: app,
    _container: target,
    _destroyed: false,

    destroy(): void {
      if (this._destroyed) return
      try {
        app.unmount()
      } catch (err) {
        console.warn('[hiprint] buildDesigner.destroy unmount failed:', err)
      }
      try {
        setActivePinia(pinia)
        useTemplateStore().clear()
      } catch (err) {
        console.warn('[hiprint] buildDesigner.destroy clear failed:', err)
      }
      this._destroyed = true
    },

    getJson(): TemplateJson {
      if (assertNotDestroyed(this as { _destroyed: boolean }, 'designer.getJson')) {
        return { panels: [] } as unknown as TemplateJson
      }
      setActivePinia(pinia)
      return useTemplateStore().getJson()
    },

    update(json): void {
      if (assertNotDestroyed(this as { _destroyed: boolean }, 'designer.update')) return
      try {
        setActivePinia(pinia)
        useTemplateStore().loadFromJson(json)
      } catch (err) {
        console.error('[hiprint] designer.update failed:', err)
      }
    },

    getTemplate(): TemplateJson {
      return this.getJson()
    },

    getToolbarCtrl() {
      // Stub — full toolbar controller surface available via buildToolbar().
      return {
        getScale: () => 1,
        setScale: () => {
          /* no-op — designer-internal toolbar handles scale via stores */
        },
      }
    },

    setComponentPanelSlot(slotOptions): void {
      // V3 component panel slots are SFC-driven via <slot name="element-list">.
      // V1 quirk: this method imperatively re-rendered the element list panel.
      // V3 callers should use Vue slots or rebuildComponentPanel.
      if (slotOptions) {
        console.warn(
          '[hiprint] setComponentPanelSlot is a no-op in V3 — use Vue slots on <HiprintDesigner>'
        )
      }
    },

    clearComponentPanelSlot(): void {
      // No-op in V3 (see setComponentPanelSlot).
    },

    rebuildComponentPanel(moduleName, _slotOptions): void {
      // V1 quirk: clear + re-create the element list panel for a specific module.
      // V3 reacts automatically to registry changes; this is a no-op + warn.
      if (moduleName) {
        console.warn(
          '[hiprint] rebuildComponentPanel: V3 element list is reactive; no-op'
        )
      }
    },
  }
  return controller
}
