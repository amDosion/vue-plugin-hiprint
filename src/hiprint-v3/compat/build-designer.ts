/**
 * compat/build-designer.ts — `buildDesigner(container, options)` → V3 controller.
 *
 * V3 strategy (post P21.6 finalisation — pure V3, no V1 imperative toolbar API):
 *  - Create an internal `PrintTemplate` (owns its own Pinia) so the same store
 *    set powers both the controller's getJson/update AND the mounted SFC.
 *  - Mount `HiprintDesigner` SFC inside `container` reusing the PrintTemplate's
 *    Pinia (no double-pinia drift).
 *  - Forward V1-shape `toolbarOptions` (showXxx visibility flags + onXxx
 *    handlers + extras / paper / scale / panel-manager / etc.) to the SFC as
 *    plain reactive props. Each callback receives `tpl` as first argument per
 *    V1 signature parity.
 *  - Fire `options.onReady(tpl)` in a microtask after mount completes so
 *    business code can capture the PrintTemplate reference.
 *  - Return a minimal V3 `DesignerController` exposing `getJson` / `update` /
 *    `getTpl` / `destroy` + a few V1 no-op stubs (componentPanelSlot /
 *    pagination) for surface compatibility — no `toolbarCtrl`, no
 *    `getToolbarCtrl()`. V1 imperative toolbar manipulation has been removed.
 *    Business code that needs button visibility / labels / dialog control
 *    must drive those via reactive `toolbarOptions` (showXxx / onXxx) or
 *    migrate to `<HiprintDesigner>` SFC directly.
 *
 * Locked invariants:
 *  - #1 destroy idempotency — destroy() guard + nested error try/catch.
 *  - #5 history capacity forwarded from templateOptions.history.
 *  - #11 setActivePinia called on every method that touches stores so multiple
 *    designers on the same page can coexist.
 *  - #8 onReady invoked **once** with try/catch isolation (safeCall) so a
 *    failing callback does not crash the designer mount.
 */

import { createApp, nextTick, reactive, type App } from 'vue'
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

// Local mirrors of HiprintToolbar.vue public types — Vue SFCs do not re-export
// named types through the `*.vue` module resolver, so we redeclare them here.
// Shapes must stay in sync with src/hiprint-v3/components/HiprintToolbar.vue.

/** @internal — see HiprintToolbar.vue `ToolbarPaperType`. */
interface ToolbarPaperType {
  label: string
  width: number
  height: number
}

/** @internal — see HiprintToolbar.vue `ToolbarAlignType`. */
type ToolbarAlignType =
  | 'left'
  | 'center'
  | 'right'
  | 'top'
  | 'middle'
  | 'bottom'

/** @internal — see HiprintToolbar.vue `ToolbarExtraButton`. */
interface ToolbarExtraButton {
  key: string
  label?: string
  icon?: string
  type?: string
  className?: string
  visible?: boolean
  disabled?: boolean
  html?: string
  onClick?: (tpl: PrintTemplate | null | undefined, event?: Event) => void
}

// ============ Public types ============

/**
 * V1-shape `toolbarOptions` accepted by buildDesigner. Each `onXxx` callback
 * receives the PrintTemplate as first argument (V1 signature parity).
 */
export interface BuildDesignerToolbarOptions {
  buttons?: readonly string[] | undefined
  paperTypes?: readonly ToolbarPaperType[] | undefined
  defaultPaper?: string | undefined
  scaleMin?: number | undefined
  scaleMax?: number | undefined
  scaleStep?: number | undefined
  // ---- showXxx ----
  showUndo?: boolean | undefined
  showRedo?: boolean | undefined
  showSave?: boolean | undefined
  showPreview?: boolean | undefined
  showPrint?: boolean | undefined
  showPdf?: boolean | undefined
  showClear?: boolean | undefined
  showPanelManager?: boolean | undefined
  showPaperSelect?: boolean | undefined
  showCustomPaper?: boolean | undefined
  showRotate?: boolean | undefined
  showAlign?: boolean | undefined
  showScale?: boolean | undefined
  showRuler?: boolean | undefined
  showGrid?: boolean | undefined
  showTemplateSelect?: boolean | undefined
  showBusinessSelect?: boolean | undefined
  // ---- onXxx (each gets tpl as first arg) ----
  onPreview?: ((tpl: PrintTemplate) => void) | undefined
  onPrint?: ((tpl: PrintTemplate) => void) | undefined
  onClear?: ((tpl: PrintTemplate) => void) | undefined
  onSave?: ((tpl: PrintTemplate, json: TemplateJson, ctx?: { name?: string }) => void) | undefined
  onPaperChange?: ((tpl: PrintTemplate, name: string, size: { width: number; height: number }) => void) | undefined
  onRotate?: ((tpl: PrintTemplate) => void) | undefined
  onAlign?: ((tpl: PrintTemplate, type: ToolbarAlignType) => void) | undefined
  onScaleChange?: ((tpl: PrintTemplate, scale: number) => void) | undefined
  onAddPanel?: ((tpl: PrintTemplate) => void) | undefined
  onRemovePanel?: ((tpl: PrintTemplate, idx: number) => void) | undefined
  onSwitchPanel?: ((tpl: PrintTemplate, idx: number) => void) | undefined
  onTemplateSelectClick?: ((tpl: PrintTemplate) => void) | undefined
  onBusinessSelectClick?: ((tpl: PrintTemplate) => void) | undefined
  // ---- Panel manager ----
  panelManagerLabel?: string | undefined
  addPanelButtonText?: string | undefined
  // ---- Align customisation ----
  alignItems?: readonly ToolbarAlignType[] | undefined
  // ---- Extras ----
  extraButtons?: readonly ToolbarExtraButton[] | undefined
  extraPosition?: 'start' | 'end' | undefined
  /** Unknown V1 keys pass through silently. */
  [key: string]: unknown
}

/**
 * V1-shape templateOptions forwarded to PrintTemplate constructor + SFC. The
 * `onDataChanged` callback is polled via setInterval (P21.6 best-effort).
 *
 * TKT-324 (Sprint 22g wave 2): full V1 sub-opts pass-through. 9 keys forwarded
 * to the PrintTemplate / designer SFC so V1 callers see identical behaviour.
 */
export interface BuildDesignerTemplateOptions {
  template?: TemplateJson | Record<string, unknown> | undefined
  /** V1 ref bundle.js 12278 — history capacity (number) or boolean (false → 0). */
  history?: number | boolean | undefined
  /** V1 ref bundle.js 12280 — auto-paginate long-text elements. */
  paginate?: boolean | undefined
  /** V1 ref bundle.js 15077 — 1=template-only, 2=template+data layout. */
  dataMode?: 1 | 2 | undefined
  /** V1 ref bundle.js 15078 — warn when element placed outside panel bounds. */
  willOutOfBounds?: boolean | undefined
  /** V1 ref bundle.js 15079 — Qt designer flag (toggles desktop-app behaviours). */
  qtDesigner?: boolean | undefined
  /** V1 ref bundle.js 15080 — default name shown on first panel. */
  defaultPanelName?: string | undefined
  /** V1 ref bundle.js 12898 — font list shown in property panel font dropdown. */
  fontList?: readonly string[] | undefined
  /** V1 ref bundle.js 12904 — dynamic-field map for `${...}` text bindings. */
  fields?: Record<string, unknown> | readonly unknown[] | undefined
  /** V1 ref bundle.js 12912 — designer image picker handler. */
  onImageChooseClick?: ((tpl: PrintTemplate) => void) | undefined
  /** V1 ref bundle.js 15076 — fired when user clicks `+ Panel`. */
  onPanelAddClick?: ((tpl: PrintTemplate) => void) | undefined
  /** V1 ref bundle.js 15076 — polled when template data changes. */
  onDataChanged?: (() => void) | undefined
  /** V1 ref bundle.js — fired when update() throws or schema is invalid. */
  onUpdateError?: ((err: unknown) => void) | undefined
  [key: string]: unknown
}

export interface BuildDesignerOptions {
  /**
   * Fires after the designer + toolbar are mounted and the template is loaded.
   * Business code captures `tpl` here for subsequent `tpl.update(json)` etc.
   *
   * V3 signature: `(tpl) => void` — the V1 second arg `toolbarCtrl` is removed
   * (pure V3 surface, no V1 imperative toolbar API).
   */
  onReady?: ((tpl: PrintTemplate) => void) | undefined
  /** Initial template JSON (V1 quirk — same as templateOptions.template). */
  template?: TemplateJson | Record<string, unknown> | undefined
  /** Test data for preview / binding. */
  data?: Record<string, unknown> | undefined
  /** Toolbar visibility + handler opts (forwarded to HiprintToolbar props). */
  toolbarOptions?: BuildDesignerToolbarOptions | undefined
  /** PrintTemplate constructor opts forwarded as-is. */
  templateOptions?: BuildDesignerTemplateOptions | undefined
  /** Default module name registry (V1: 'defaultModule'). */
  componentModule?: string | undefined
  /** Hide regions selectively (V3 props). */
  hideToolbar?: boolean | undefined
  hideElementList?: boolean | undefined
  hidePropertyPanel?: boolean | undefined
  /** V1 quirks pass through unchanged (no-op in V3). */
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
  /** Get the PrintTemplate instance this designer owns. */
  getTpl(): PrintTemplate
  /**
   * V1 quirk methods (no-ops in V3 — slot-driven).
   * See `docs/adr/0031-component-panel-slot-replaced-by-vue-slots.md`.
   */
  setComponentPanelSlot(slotOptions?: Record<string, unknown>): void
  clearComponentPanelSlot(): void
  rebuildComponentPanel(moduleName?: string, slotOptions?: Record<string, unknown>): void
  /**
   * TKT-327 — Toggle pagination/panel-manager visibility at runtime. V3 maps
   * this to `<HiprintToolbar :show-panel-manager>` so the panel chip list /
   * select dropdown hides when `visible=false`.
   */
  setPaginationVisible(visible: boolean): void
  /**
   * TKT-325 — V1-compat escape-hatch element accessors. Each returns the
   * mounted DOM root for the corresponding designer region, or null when the
   * controller is destroyed / the region is hidden.
   */
  getComponentContainer(): HTMLElement | null
  getTemplateContainer(): HTMLElement | null
  getSettingContainer(): HTMLElement | null
  /**
   * TKT-326 — Programmatic sidebar collapse API (V1 line 15115-15118).
   * `setXxxCollapsed(true)` collapses; `isXxxCollapsed()` reads current state.
   */
  setLeftCollapsed(collapsed: boolean): void
  setRightCollapsed(collapsed: boolean): void
  isLeftCollapsed(): boolean
  isRightCollapsed(): boolean
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

// ============ Public API ============

/**
 * Build a V3 designer inside `container`. Creates an internal `PrintTemplate`
 * (with its own Pinia) so multi-instance use cases work; the SFC mount shares
 * that Pinia so the controller `getJson() / update()` and the SFC state stay
 * synced.
 *
 * V1 signature: `hiprint.buildDesigner(container, options)`. V3 returns a
 * minimal controller without the V1 toolbarCtrl shim — use reactive props on
 * `<HiprintDesigner>` / `<HiprintToolbar>` to drive UI state.
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
  //
  // TKT-324 (Sprint 22g wave 2): forward 9 V1 sub-opts through to the
  // PrintTemplate constructor so V1 callers see identical behaviour.
  const printTemplateOptions: PrintTemplateOptions = {
    template: (options.template ?? tpl_options.template) as
      | TemplateJson
      | Record<string, unknown>
      | undefined,
    data: options.data,
    history: tpl_options.history,
    paginate: tpl_options.paginate,
    dataMode: tpl_options.dataMode,
    willOutOfBounds: tpl_options.willOutOfBounds,
    qtDesigner: tpl_options.qtDesigner,
    defaultPanelName: tpl_options.defaultPanelName,
    fontList: tpl_options.fontList ? [...tpl_options.fontList] : undefined,
    dynamicFields: tpl_options.fields as Record<string, unknown> | unknown[] | undefined,
    onImageChooseClick: tpl_options.onImageChooseClick as
      | ((...args: unknown[]) => void)
      | undefined,
  }

  // Create PrintTemplate first — it owns its Pinia. The SFC mount reuses it.
  const tpl = new PrintTemplate(printTemplateOptions)
  const pinia = tpl._getPinia()
  setActivePinia(pinia)

  // TKT-324 — Apply font list + fields after construction so the dedicated
  // setters fire their event-bus signals (font-list-change etc.).
  if (Array.isArray(tpl_options.fontList) && tpl_options.fontList.length > 0) {
    try {
      tpl.setFontList([...tpl_options.fontList])
    } catch (err) {
      console.warn('[hiprint] buildDesigner.fontList setter failed:', err)
    }
  }
  if (tpl_options.fields !== undefined) {
    try {
      tpl.setDynamicFields(tpl_options.fields as Record<string, unknown>)
    } catch (err) {
      console.warn('[hiprint] buildDesigner.fields setter failed:', err)
    }
  }

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

  // Wrap V1-shape onSave (tpl, json, ctx) → ToolbarOnSave (tpl, json, event, api, ctx)
  const onSaveForToolbar = toolbar_options.onSave
    ? (
        _tplArg: PrintTemplate | null | undefined,
        json: TemplateJson,
        _event?: Event | null,
        _api?: unknown,
        ctx?: { name?: string }
      ): void => {
        safeCall(
          toolbar_options.onSave as unknown as (...args: unknown[]) => void,
          [tpl, json, ctx] as unknown[],
          'toolbarOptions.onSave'
        )
      }
    : undefined

  // TKT-327 (Sprint 22g wave 2): props are now a reactive bag so the
  // controller's `setPaginationVisible(bool)` (which toggles the panel-manager
  // chip/select group) can mutate them at runtime without remounting the SFC.
  const designerProps = reactive<Record<string, unknown>>({
    template: printTemplateOptions.template as TemplateJson | undefined,
    data: options.data,
    showToolbar: !options.hideToolbar,
    showElementList: !options.hideElementList,
    showPropertyPanel: !options.hidePropertyPanel,
    // The PrintTemplate already loaded the template in its ctor — we do NOT
    // want HiprintDesigner.loadFromJson on mount to overwrite our store state.
    destroyOnUnmount: false,
    // Forward PrintTemplate so toolbar onXxx callbacks receive it per V1.
    tpl,
    // Forward V1 toolbar opts (showXxx + onXxx + extras + paper/scale) so the
    // mounted HiprintToolbar matches V1 buildToolbar surface.
    toolbarButtons: toolbar_options.buttons,
    toolbarPaperTypes: toolbar_options.paperTypes,
    toolbarDefaultPaper: toolbar_options.defaultPaper,
    toolbarScaleMin: toolbar_options.scaleMin,
    toolbarScaleMax: toolbar_options.scaleMax,
    toolbarScaleStep: toolbar_options.scaleStep,
    toolbarShowUndo: toolbar_options.showUndo,
    toolbarShowRedo: toolbar_options.showRedo,
    toolbarShowSave: toolbar_options.showSave,
    toolbarShowPreview: toolbar_options.showPreview,
    toolbarShowPrint: toolbar_options.showPrint,
    toolbarShowPdf: toolbar_options.showPdf,
    toolbarShowClear: toolbar_options.showClear,
    toolbarShowPanelManager: toolbar_options.showPanelManager,
    toolbarShowPaperSelect: toolbar_options.showPaperSelect,
    toolbarShowCustomPaper: toolbar_options.showCustomPaper,
    toolbarShowRotate: toolbar_options.showRotate,
    toolbarShowAlign: toolbar_options.showAlign,
    toolbarShowScale: toolbar_options.showScale,
    toolbarShowRuler: toolbar_options.showRuler,
    toolbarShowGrid: toolbar_options.showGrid,
    toolbarShowTemplateSelect: toolbar_options.showTemplateSelect,
    toolbarShowBusinessSelect: toolbar_options.showBusinessSelect,
    toolbarOnPreview: toolbar_options.onPreview,
    toolbarOnPrint: toolbar_options.onPrint,
    toolbarOnClear: toolbar_options.onClear,
    toolbarOnSave: onSaveForToolbar,
    toolbarOnPaperChange: toolbar_options.onPaperChange,
    toolbarOnRotate: toolbar_options.onRotate,
    toolbarOnAlign: toolbar_options.onAlign,
    toolbarOnScaleChange: toolbar_options.onScaleChange,
    toolbarOnAddPanel: toolbar_options.onAddPanel,
    toolbarOnRemovePanel: toolbar_options.onRemovePanel,
    toolbarOnSwitchPanel: toolbar_options.onSwitchPanel,
    toolbarPanelManagerLabel: toolbar_options.panelManagerLabel,
    toolbarAddPanelButtonText: toolbar_options.addPanelButtonText,
    toolbarAlignItems: toolbar_options.alignItems,
    toolbarExtraButtons: toolbar_options.extraButtons,
    toolbarExtraPosition: toolbar_options.extraPosition,
    // Legacy zero-arg handler aliases (used when callers pass only previewHandler
    // / printHandler / saveHandler on the top-level options — unlikely, but
    // preserved for buildDesigner-as-shell usage).
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

  // TKT-324 (Sprint 22g wave 2): seed first panel name from defaultPanelName
  // when template-less ctor auto-created the A4 default panel.
  if (
    !printTemplateOptions.template &&
    typeof tpl_options.defaultPanelName === 'string' &&
    tpl_options.defaultPanelName.length > 0
  ) {
    try {
      setActivePinia(pinia)
      const cs = useCanvasStore()
      const first = cs.panels[0]
      if (first) {
        cs.updatePanel(first.id, { name: tpl_options.defaultPanelName })
      }
    } catch (err) {
      console.warn('[hiprint] buildDesigner.defaultPanelName seed failed:', err)
    }
  }

  // TKT-324 — wrap addPanel emit so onPanelAddClick fires with `tpl` per V1.
  const onPanelAddClick = tpl_options.onPanelAddClick
  if (typeof onPanelAddClick === 'function') {
    const existingAddPanel = designerProps.toolbarOnAddPanel as
      | ((tpl: PrintTemplate | null | undefined) => void)
      | undefined
    designerProps.toolbarOnAddPanel = (
      tplArg: PrintTemplate | null | undefined
    ): void => {
      if (existingAddPanel) {
        safeCall(
          existingAddPanel as unknown as (...args: unknown[]) => void,
          [tplArg] as unknown[],
          'toolbarOptions.onAddPanel'
        )
      }
      safeCall(
        onPanelAddClick as unknown as (...args: unknown[]) => void,
        [tplArg ?? tpl] as unknown[],
        'templateOptions.onPanelAddClick'
      )
    }
  }

  const app = createApp(HiprintDesigner, designerProps)
  app.use(pinia)
  app.mount(target)

  // V3 onReady contract: fires once with (tpl) after mount. nextTick lets any
  // post-mount lifecycle hooks (HiprintDesigner.onMounted) flush first.
  if (typeof options.onReady === 'function') {
    void nextTick(() => {
      safeCall(
        options.onReady as unknown as (...args: unknown[]) => void,
        [tpl] as unknown[],
        'buildDesigner.onReady'
      )
    })
  }

  // templateOptions.onDataChanged + onUpdateError forwarding (subscribe via
  // a poll on history.pos). V3 history.pos is the closest proxy for "template
  // data changed" — wire it here so V1 callers keep getting fired.
  if (typeof tpl_options.onDataChanged === 'function') {
    setActivePinia(pinia)
    const history = useHistoryStore()
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
    const intervalId = setInterval(tick, 100)
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
        // TKT-324 — surface update errors via V1 onUpdateError when provided.
        if (typeof tpl_options.onUpdateError === 'function') {
          safeCall(
            tpl_options.onUpdateError as unknown as (...args: unknown[]) => void,
            [err] as unknown[],
            'templateOptions.onUpdateError'
          )
        } else {
          console.error('[hiprint] designer.update failed:', err)
        }
      }
    },

    getTemplate(): TemplateJson {
      return this.getJson()
    },

    getTpl(): PrintTemplate {
      return tpl
    },

    setComponentPanelSlot(slotOptions): void {
      // TKT-323 — see ADR-0031 (slot-options now driven by Vue slots).
      if (slotOptions) {
        console.warn(
          '[hiprint] setComponentPanelSlot is a no-op in V3 — see ADR-0031; use Vue slots on <HiprintDesigner>'
        )
      }
    },

    clearComponentPanelSlot(): void {
      /* no-op in V3 — see ADR-0031. */
    },

    rebuildComponentPanel(moduleName, _slotOptions): void {
      // TKT-323 — see ADR-0031. Element list is reactive; no rebuild required.
      if (moduleName) {
        console.warn(
          '[hiprint] rebuildComponentPanel: V3 element list is reactive — see ADR-0031; no-op'
        )
      }
    },

    setPaginationVisible(visible: boolean): void {
      // TKT-327 (Sprint 22g wave 2): toggle the panel-manager / pagination
      // group at runtime by mutating the reactive `toolbarShowPanelManager`
      // prop. The HiprintToolbar v-if on the chip/select group reads this.
      if (this._destroyed) return
      designerProps.toolbarShowPanelManager = visible
    },

    // ============ TKT-325 — container accessors ============
    //
    // V1 escape-hatch: caller wants the mounted DOM root for a specific
    // designer region (e.g. to attach a third-party tooltip / focus capture).
    // V3 returns the matching `.hiprint-designer__*` element under our
    // container, or null when not mounted.
    getComponentContainer(): HTMLElement | null {
      if (this._destroyed) return null
      return target.querySelector<HTMLElement>('.hiprint-designer__element-list')
    },

    getTemplateContainer(): HTMLElement | null {
      if (this._destroyed) return null
      return target.querySelector<HTMLElement>('.hiprint-designer__canvas')
    },

    getSettingContainer(): HTMLElement | null {
      if (this._destroyed) return null
      return target.querySelector<HTMLElement>('.hiprint-designer__property-panel')
    },

    // ============ TKT-326 — programmatic sidebar collapse ============
    //
    // HiprintDesigner.vue owns `leftCollapsed` / `rightCollapsed` refs internally.
    // We drive them by toggling the `leftInitiallyCollapsed` reactive prop the
    // SFC reads on mount AND by clicking the matching edge-toggle button when
    // the SFC is already mounted. Reading state inspects the DOM class.
    setLeftCollapsed(collapsed: boolean): void {
      if (this._destroyed) return
      const node = target.querySelector<HTMLElement>(
        '.hiprint-designer__element-list'
      )
      if (!node) return
      const current = node.classList.contains(
        'hiprint-designer__element-list--collapsed'
      )
      if (current === collapsed) return
      const toggle = target.querySelector<HTMLElement>(
        '.hiprint-designer__edge-toggle--left'
      )
      if (toggle) toggle.click()
    },

    setRightCollapsed(collapsed: boolean): void {
      if (this._destroyed) return
      const node = target.querySelector<HTMLElement>(
        '.hiprint-designer__property-panel'
      )
      if (!node) return
      const current = node.classList.contains(
        'hiprint-designer__property-panel--collapsed'
      )
      if (current === collapsed) return
      const toggle = target.querySelector<HTMLElement>(
        '.hiprint-designer__edge-toggle--right'
      )
      if (toggle) toggle.click()
    },

    isLeftCollapsed(): boolean {
      if (this._destroyed) return false
      const node = target.querySelector<HTMLElement>(
        '.hiprint-designer__element-list'
      )
      return node
        ? node.classList.contains('hiprint-designer__element-list--collapsed')
        : false
    },

    isRightCollapsed(): boolean {
      if (this._destroyed) return false
      const node = target.querySelector<HTMLElement>(
        '.hiprint-designer__property-panel'
      )
      return node
        ? node.classList.contains('hiprint-designer__property-panel--collapsed')
        : false
    },
  }
  return controller
}
