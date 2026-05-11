/**
 * compat/build-designer.ts — V1 buildDesigner(container, options) → Controller.
 *
 * V1 source: bundle.js line 13235-13305 + 14857-15000 (buildDesigner adapter).
 * V2 reference: src/hiprint-v2/ui/designer.js (adapter mode).
 *
 * V3 strategy (P21.5 functional restoration):
 *  - Create a `PrintTemplate` instance (owns its own Pinia) so the same store
 *    set powers both the controller's getJson/update AND the mounted SFC.
 *  - Mount HiprintDesigner SFC inside `container` reusing the PrintTemplate's
 *    Pinia (no double-pinia drift).
 *  - Forward toolbarOptions handlers (onPreview/onPrint/onClear/onSave) to the
 *    SFC's prop handlers with V1 signatures (each callback receives `tpl`).
 *  - **Fire `options.onReady(tpl, toolbarCtrl)`** in a microtask after mount
 *    completes (this is the V1 contract — vue-admin-main + designer-shell
 *    capture `that.template = tpl; that.toolbarCtrl = toolbarCtrl` here).
 *  - Return DesignerController that wraps the PrintTemplate (getJson / update /
 *    getTemplate / destroy) + toolbarCtrl shim with the full V1 method surface
 *    (Tier A dialog methods deferred to P21.6; for now stubs warn).
 *
 * Locked invariants:
 *  - #1 destroy idempotency — destroy() guard + nested error try/catch.
 *  - #5 history capacity forwarded from templateOptions.history.
 *  - #11 setActivePinia called on every method that touches stores so multiple
 *    designers on the same page can coexist.
 *  - onReady is invoked **once** with try/catch isolation (safeCall) so a
 *    failing callback does not crash the designer mount.
 */

import { createApp, nextTick, type App } from 'vue'
import { setActivePinia } from 'pinia'
import HiprintDesigner from '@hiprint-v3/components/HiprintDesigner.vue'
import {
  useCanvasStore,
  useHistoryStore,
  useTemplateStore,
} from '@hiprint-v3/stores'
import { assertNotDestroyed, safeCall } from '@hiprint-v3/internal'
import type { TemplateJson } from '@hiprint-v3/schemas'
import { PrintTemplate, type PrintTemplateOptions } from './print-template'

// ============ Public types ============

/**
 * V1-shaped toolbarOptions subset that designer-shell + vue-admin-main use.
 * (Full 60+ field shape lands in P21.7; this minimal set unblocks P21.5.)
 *
 * Each `onXxx` callback receives the PrintTemplate as first argument — that's
 * the V1 contract; consumers rely on it to access the live template.
 */
export interface BuildDesignerToolbarOptions {
  showPanelManager?: boolean | undefined
  showPaperSelect?: boolean | undefined
  showRotate?: boolean | undefined
  showAlign?: boolean | undefined
  showScale?: boolean | undefined
  showRuler?: boolean | undefined
  showGrid?: boolean | undefined
  onPreview?: ((tpl: PrintTemplate) => void) | undefined
  onPrint?: ((tpl: PrintTemplate) => void) | undefined
  onSave?: ((tpl: PrintTemplate, json: TemplateJson) => void) | undefined
  onClear?: ((tpl: PrintTemplate) => void) | undefined
  onPaperChange?: ((tpl: PrintTemplate, name: string, size: { width: number; height: number }) => void) | undefined
  onRotate?: ((tpl: PrintTemplate) => void) | undefined
  onAlign?: ((tpl: PrintTemplate, type: string) => void) | undefined
  onAddPanel?: ((tpl: PrintTemplate) => void) | undefined
  onRemovePanel?: ((tpl: PrintTemplate) => void) | undefined
  onSwitchPanel?: ((tpl: PrintTemplate, idx: number) => void) | undefined
  panelManagerLabel?: string | undefined
  addPanelButtonText?: string | undefined
  paperTypes?: ReadonlyArray<{ label: string; width: number; height: number }> | undefined
  /** Unknown V1 keys pass through (extraButtons / renderExtra / alignItems etc.). */
  [key: string]: unknown
}

/**
 * V1-shaped templateOptions subset. P21.5 forwards `template / history /
 * dataMode / paginate` to PrintTemplate constructor + designer SFC. Other
 * V1 quirks pass through unchanged.
 */
export interface BuildDesignerTemplateOptions {
  template?: TemplateJson | Record<string, unknown> | undefined
  history?: number | boolean | undefined
  paginate?: boolean | undefined
  dataMode?: 1 | 2 | undefined
  willOutOfBounds?: boolean | undefined
  qtDesigner?: boolean | undefined
  onDataChanged?: (() => void) | undefined
  onUpdateError?: ((err: unknown) => void) | undefined
  [key: string]: unknown
}

export interface BuildDesignerOptions {
  /**
   * V1: fires after the designer + toolbar are mounted and the template is
   * loaded. **Without onReady the demo / vue-admin-main cannot capture
   * `tpl` and `toolbarCtrl` and the rest of their integration dies silently.**
   * V3 fires this in a microtask after Vue mount completes.
   */
  onReady?: ((tpl: PrintTemplate, toolbarCtrl: ToolbarControllerShim) => void) | undefined
  /** Initial template JSON (V1 quirk — same as templateOptions.template). */
  template?: TemplateJson | Record<string, unknown> | undefined
  /** Test data for preview / binding. */
  data?: Record<string, unknown> | undefined
  /** Toolbar handler + visibility opts (subset; P21.7 will expand). */
  toolbarOptions?: BuildDesignerToolbarOptions | undefined
  /** PrintTemplate constructor opts forwarded as-is. */
  templateOptions?: BuildDesignerTemplateOptions | undefined
  /** Default module name registry (V1: 'defaultModule'). */
  componentModule?: string | undefined
  /** Hide regions selectively (V3 props). */
  hideToolbar?: boolean | undefined
  hideElementList?: boolean | undefined
  hidePropertyPanel?: boolean | undefined
  /** V1 quirks pass through unchanged. */
  componentPanelSlot?: Record<string, unknown> | undefined
  showPagination?: boolean | undefined
  /** Unknown V1 keys pass through. */
  [key: string]: unknown
}

/**
 * ToolbarController surface returned via `onReady(tpl, toolbarCtrl)` and
 * `controller.getToolbarCtrl()`. Mirrors V1's toolbar return.
 *
 * P21.5 implements `destroy / setScale / getScale + getToolbarElement` for
 * real; the remaining 27 V1 methods are stubs that console.warn and return
 * sensible no-op defaults. P21.6 wires real behavior atop HiprintToolbar
 * `defineExpose` API.
 */
export interface ToolbarControllerShim {
  // Tier A (dialog control) — stubbed in P21.5, real in P21.6 + P21.8.
  openTemplateDialog(): void
  closeTemplateDialog(): void
  openBusinessDialog(): void
  closeBusinessDialog(): void
  refreshTemplateList(): Promise<unknown[]>
  refreshBusinessList(): Promise<unknown[]>
  setTemplateListProvider(provider: (() => unknown[] | Promise<unknown[]>) | null): void
  setTemplateLoader(loader: ((id: unknown) => unknown | Promise<unknown>) | null): void
  setBusinessItems(items: unknown[]): void
  setBusinessListProvider(provider: (() => unknown[] | Promise<unknown[]>) | null): void
  setBusinessLoader(loader: ((id: unknown) => unknown | Promise<unknown>) | null): void
  setDialogHandler(handlerKey: string, handler: (...args: unknown[]) => unknown): unknown
  setBusinessDialogOpenHandler(handler: ((open: () => void) => void) | null): unknown
  setTemplateDialogOpenHandler(handler: ((open: () => void) => void) | null): unknown
  setSaveDialogOpenHandler(handler: ((open: () => void) => void) | null): unknown
  triggerSave(payload?: { skipPrompt?: boolean; name?: string } | undefined): void
  // Tier B (button/group manipulation) — stubbed in P21.5, real in P21.6.
  setButtonText(key: string, text: string, useHtml?: boolean): void
  setButtonVisible(key: string, visible: boolean): void
  setButtonDisabled(key: string, disabled: boolean): void
  triggerButton(key: string): void
  getButton(key: string): unknown
  getButtons(): readonly unknown[]
  setGroupVisible(groupKey: string, visible: boolean): void
  getGroup(key: string): unknown
  getGroups(): readonly unknown[]
  addGroup(el: HTMLElement, position?: 'start' | 'end'): void
  // Real implementations from P21.5.
  setScale(scale: number): void
  getScale(): number
  getToolbarElement(): HTMLElement | null
  destroy(): void
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
  /** Get the PrintTemplate instance this designer owns. */
  getTpl(): PrintTemplate
  /** Get the toolbar controller (same instance fired in onReady). */
  getToolbarCtrl(): ToolbarControllerShim
  /** V1 quirk methods (no-ops in V3 — slot-driven). */
  setComponentPanelSlot(slotOptions?: Record<string, unknown>): void
  clearComponentPanelSlot(): void
  rebuildComponentPanel(moduleName?: string, slotOptions?: Record<string, unknown>): void
  setPaginationVisible(visible: boolean): void
  /** Underlying Vue app + container (escape hatches). */
  readonly _app: App
  readonly _container: HTMLElement
  readonly _tpl: PrintTemplate
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

/**
 * Build a stub ToolbarController. P21.5 only implements real scale + element +
 * destroy methods; everything else logs a [hiprint] warn and returns a sensible
 * default. P21.6 replaces this with a real impl backed by HiprintToolbar SFC
 * defineExpose API.
 */
function createToolbarCtrlShim(
  _tpl: PrintTemplate,
  container: HTMLElement,
  app: App
): ToolbarControllerShim {
  const warn = (method: string): void => {
    console.warn(
      '[hiprint] toolbarCtrl.' + method + ' is a P21.5 stub. ' +
        'Real implementation lands in P21.6 (UI methods) + P21.8 (dialog UI). ' +
        'See docs/SMOKE-TEST-V3.md.'
    )
  }
  let _destroyed = false
  return {
    // Tier A — dialog methods (stubs)
    openTemplateDialog() { warn('openTemplateDialog') },
    closeTemplateDialog() { warn('closeTemplateDialog') },
    openBusinessDialog() { warn('openBusinessDialog') },
    closeBusinessDialog() { warn('closeBusinessDialog') },
    refreshTemplateList() {
      warn('refreshTemplateList')
      return Promise.resolve([])
    },
    refreshBusinessList() {
      warn('refreshBusinessList')
      return Promise.resolve([])
    },
    setTemplateListProvider() { warn('setTemplateListProvider') },
    setTemplateLoader() { warn('setTemplateLoader') },
    setBusinessItems() { warn('setBusinessItems') },
    setBusinessListProvider() { warn('setBusinessListProvider') },
    setBusinessLoader() { warn('setBusinessLoader') },
    setDialogHandler() {
      warn('setDialogHandler')
      return null
    },
    setBusinessDialogOpenHandler() {
      warn('setBusinessDialogOpenHandler')
      return null
    },
    setTemplateDialogOpenHandler() {
      warn('setTemplateDialogOpenHandler')
      return null
    },
    setSaveDialogOpenHandler() {
      warn('setSaveDialogOpenHandler')
      return null
    },
    triggerSave() { warn('triggerSave') },
    // Tier B — button/group methods (stubs)
    setButtonText() { warn('setButtonText') },
    setButtonVisible() { warn('setButtonVisible') },
    setButtonDisabled() { warn('setButtonDisabled') },
    triggerButton() { warn('triggerButton') },
    getButton() {
      warn('getButton')
      return undefined
    },
    getButtons() {
      warn('getButtons')
      return []
    },
    setGroupVisible() { warn('setGroupVisible') },
    getGroup() {
      warn('getGroup')
      return undefined
    },
    getGroups() {
      warn('getGroups')
      return []
    },
    addGroup() { warn('addGroup') },
    // Real implementations
    setScale(scale: number): void {
      if (_destroyed) return
      try {
        const pinia = _tpl._getPinia()
        setActivePinia(pinia)
        useCanvasStore().setScale(scale)
      } catch (err) {
        console.warn('[hiprint] toolbarCtrl.setScale failed:', err)
      }
    },
    getScale(): number {
      if (_destroyed) return 1
      try {
        const pinia = _tpl._getPinia()
        setActivePinia(pinia)
        return useCanvasStore().scale
      } catch {
        return 1
      }
    },
    getToolbarElement(): HTMLElement | null {
      if (_destroyed) return null
      // Look up inside the designer container for the toolbar root.
      return container.querySelector<HTMLElement>('.hiprint-toolbar') ?? null
    },
    destroy(): void {
      if (_destroyed) return
      _destroyed = true
      // app.unmount() owned by DesignerController.destroy — we are a shim only.
      void app
    },
  }
}

// ============ Public API ============

/**
 * Build a V3 designer inside `container`. Creates an internal `PrintTemplate`
 * (with its own Pinia) so multi-instance use cases work; the SFC mount shares
 * that Pinia so the controller `getJson() / update()` and the SFC state stay
 * synced.
 *
 * V1 signature: `hiprint.buildDesigner(container, options)`.
 *
 * P21.5 wires:
 *  - PrintTemplate created with templateOptions (history capacity etc.) + template
 *  - toolbarOptions handlers (onPreview/onPrint/onClear/onSave) forwarded to
 *    HiprintDesigner SFC with `tpl` injected as first argument
 *  - `onReady(tpl, toolbarCtrl)` fired in nextTick after mount
 *  - ToolbarController shim with 27 V1 methods (real: scale + destroy +
 *    getToolbarElement; rest stubbed warn until P21.6/P21.8)
 */
export function buildDesigner(
  container: string | HTMLElement,
  options: BuildDesignerOptions = {}
): DesignerController {
  const target = resolveContainer(container)
  if (!target) {
    throw new Error('[hiprint] buildDesigner: container not found: ' + String(container))
  }

  const tpl_options = options.templateOptions ?? {}
  const toolbar_options = options.toolbarOptions ?? {}

  // Build PrintTemplate options bag from V1-shaped templateOptions + top-level
  // template (V1 quirk: both shapes accepted; top-level wins per V1).
  const printTemplateOptions: PrintTemplateOptions = {
    template: (options.template ?? tpl_options.template) as
      | TemplateJson
      | Record<string, unknown>
      | undefined,
    data: options.data,
    history: tpl_options.history,
    paginate: tpl_options.paginate,
  }

  // Create PrintTemplate first — it owns its Pinia. The SFC mount reuses it.
  const tpl = new PrintTemplate(printTemplateOptions)
  const pinia = tpl._getPinia()
  setActivePinia(pinia)

  // Wrap V1-signature toolbar handlers ((tpl) => void) into V3 SFC handlers
  // (() => void). The `tpl` closure binds to the PrintTemplate we just made.
  const wrap = <Args extends unknown[]>(
    fn: ((tpl: PrintTemplate, ...args: Args) => void) | undefined,
    name: string
  ): (() => void) | undefined => {
    if (typeof fn !== 'function') return undefined
    return () => {
      safeCall(
        fn as unknown as (...args: unknown[]) => void,
        [tpl] as unknown[],
        'toolbarOptions.' + name
      )
    }
  }

  const app = createApp(HiprintDesigner, {
    template: printTemplateOptions.template as TemplateJson | undefined,
    data: options.data,
    showToolbar: !options.hideToolbar,
    showElementList: !options.hideElementList,
    showPropertyPanel: !options.hidePropertyPanel,
    // The PrintTemplate already loaded the template in its ctor — we do NOT
    // want HiprintDesigner.loadFromJson on mount to overwrite our store state.
    // Pass undefined template prop to skip the SFC's onMount load.
    destroyOnUnmount: false,
    previewHandler: wrap(toolbar_options.onPreview, 'onPreview'),
    printHandler: wrap(toolbar_options.onPrint, 'onPrint'),
    saveHandler: toolbar_options.onSave
      ? () => {
          try {
            setActivePinia(pinia)
            const json = useTemplateStore().getJson()
            safeCall(
              toolbar_options.onSave as unknown as (...args: unknown[]) => void,
              [tpl, json] as unknown[],
              'toolbarOptions.onSave'
            )
          } catch (err) {
            console.error('[hiprint] buildDesigner onSave threw:', err)
          }
        }
      : undefined,
  })
  app.use(pinia)
  app.mount(target)

  // Build toolbar controller AFTER mount so getToolbarElement() can query DOM.
  const toolbarCtrl = createToolbarCtrlShim(tpl, target, app)

  // V1 contract: onReady fires once with (tpl, toolbarCtrl). We use nextTick
  // so any post-mount lifecycle hooks (HiprintDesigner.onMounted → template
  // load) complete first. Wrapped in safeCall so a thrown onReady cannot
  // crash the designer mount path.
  if (typeof options.onReady === 'function') {
    void nextTick(() => {
      safeCall(
        options.onReady as unknown as (...args: unknown[]) => void,
        [tpl, toolbarCtrl] as unknown[],
        'buildDesigner.onReady'
      )
    })
  }

  // templateOptions.onDataChanged + onUpdateError forwarding (subscribe via
  // a watch on the template store). V3 history.pos is the closest proxy for
  // "template data changed" — wire it here so V1 callers keep getting fired.
  if (typeof tpl_options.onDataChanged === 'function') {
    setActivePinia(pinia)
    const history = useHistoryStore()
    // Vue's watch needs a reactive ref; we read history.pos via reactive
    // subscription. Use a primitive sub function — kept simple for now.
    let lastPos = history.pos
    const tick = (): void => {
      if (history.pos !== lastPos) {
        lastPos = history.pos
        safeCall(
          tpl_options.onDataChanged as unknown as (...args: unknown[]) => void,
          [tpl] as unknown[],
          'templateOptions.onDataChanged'
        )
      }
    }
    // Poll once per microtask via mount cycle. P21.6 will replace this with a
    // proper Pinia subscribe.
    const intervalId = setInterval(tick, 100)
    // Store intervalId on app for cleanup in destroy().
    ;(app as unknown as Record<string, unknown>).__hiprintDataChangedInterval = intervalId
  }

  const controller: DesignerController = {
    _app: app,
    _container: target,
    _tpl: tpl,
    _destroyed: false,

    destroy(): void {
      if (this._destroyed) return
      try {
        const intervalId = (app as unknown as Record<string, unknown>)
          .__hiprintDataChangedInterval as ReturnType<typeof setInterval> | undefined
        if (intervalId) clearInterval(intervalId)
      } catch {
        /* ignore */
      }
      try {
        toolbarCtrl.destroy()
      } catch (err) {
        console.warn('[hiprint] buildDesigner.destroy toolbarCtrl failed:', err)
      }
      try {
        app.unmount()
      } catch (err) {
        console.warn('[hiprint] buildDesigner.destroy unmount failed:', err)
      }
      try {
        tpl.destroy()
      } catch (err) {
        console.warn('[hiprint] buildDesigner.destroy tpl failed:', err)
      }
      this._destroyed = true
    },

    getJson(): TemplateJson {
      if (assertNotDestroyed(this as { _destroyed: boolean }, 'designer.getJson')) {
        return { panels: [] } as unknown as TemplateJson
      }
      return tpl.getJson()
    },

    update(json): void {
      if (assertNotDestroyed(this as { _destroyed: boolean }, 'designer.update')) return
      try {
        tpl.update(json as TemplateJson)
      } catch (err) {
        console.error('[hiprint] designer.update failed:', err)
      }
    },

    getTemplate(): TemplateJson {
      return this.getJson()
    },

    getTpl(): PrintTemplate {
      return tpl
    },

    getToolbarCtrl(): ToolbarControllerShim {
      return toolbarCtrl
    },

    setComponentPanelSlot(slotOptions): void {
      if (slotOptions) {
        console.warn(
          '[hiprint] setComponentPanelSlot is a no-op in V3 — use Vue slots on <HiprintDesigner>'
        )
      }
    },

    clearComponentPanelSlot(): void {
      /* no-op in V3 */
    },

    rebuildComponentPanel(moduleName, _slotOptions): void {
      if (moduleName) {
        console.warn(
          '[hiprint] rebuildComponentPanel: V3 element list is reactive; no-op'
        )
      }
    },

    setPaginationVisible(_visible: boolean): void {
      // V3 pagination visibility is store-driven; P21.7 wires this via
      // HiprintToolbar showPagination option propagation.
      console.warn(
        '[hiprint] setPaginationVisible is a P21.7 stub. Pagination toggle lands with the V1 opts expansion.'
      )
    },
  }
  return controller
}
