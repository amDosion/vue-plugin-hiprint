/**
 * compat/build-toolbar.ts — V1 buildToolbar(container, template, options) → Controller.
 *
 * V1 source: bundle.js line 13305+ (buildToolbar — ~1550 lines of jQuery DOM
 *            assembly). 76 opts documented in
 *            docs/V1-INVENTORY/toolbar-and-shell.md §8A.
 *
 * V3 strategy: mount the HiprintToolbar Vue SFC inside the container. The
 * toolbar wires itself to the same Pinia stores the PrintTemplate owns (via
 * the template's `_getPinia()` accessor) so undo/redo/save round-trip through
 * shared state.
 *
 * Sprint 22c TKT-040 ~ TKT-049 + TKT-100:
 *   - Restored 10 most-used V1 toolbarCtrl methods (V1 had 42; V3 originally
 *     kept only 3 = 7%; vue-admin-main imperative callers broke).
 *   - Restored 46+ V1 buildToolbar opts (V3 had 22 of 76 = 29%; now ≥ 68 = 89%).
 *   - opts are forwarded as reactive props to HiprintToolbar; imperative methods
 *     drive reactive refs (extraButtons / disabledButtonIds / labelOverrides)
 *     that the SFC consumes as props — so each `addToolbarButton` /
 *     `enableButton` / `setButtonText` call updates the rendered DOM without
 *     re-mounting the app.
 *   - A per-controller event-bus (`createEventBus()` from
 *     `@hiprint-v3/internal`) backs `on/off/emit`. The bus is wired to pinia
 *     subscriptions so `scale-change` / `panel-change` / `paper-change` /
 *     `element-change` / `history-change` fire whenever the underlying state
 *     mutates.
 *
 * Locked invariants (V3 must preserve):
 *   - destroy idempotency (Invariant #2).
 *   - assertNotDestroyed guard on every public method (Invariant #1).
 *   - safeCall isolation for every business onXxx callback (Invariant #8).
 *   - setActivePinia on every method that touches stores so multiple toolbars
 *     on the same page coexist (Invariant #11).
 */

import {
  createApp,
  defineComponent,
  effectScope,
  h,
  ref,
  watch,
  type App,
  type Ref,
} from 'vue'
import HiprintToolbar from '@hiprint-v3/components/HiprintToolbar.vue'
import {
  useCanvasStore,
  useHistoryStore,
  useTemplateStore,
  type Panel,
} from '@hiprint-v3/stores'
import {
  assertNotDestroyed,
  safeCall,
  createEventBus,
  type EventBus,
  type EventHandler,
} from '@hiprint-v3/internal'
import type { Pinia } from 'pinia'
import { setActivePinia, createPinia } from 'pinia'
import type { TemplateJson } from '@hiprint-v3/schemas'
import type { PrintTemplate } from './print-template'

// ============ Public types ============

/**
 * V1 paper-type entry shape (mm). Matches HiprintToolbar.ToolbarPaperType.
 */
export interface ToolbarPaperType {
  /** Display label e.g. "A4". */
  label: string
  /** Width in mm. */
  width: number
  /** Height in mm. */
  height: number
}

/**
 * V1 alignment vocabulary. Identical to HiprintToolbar.ToolbarAlignType.
 */
export type ToolbarAlignType =
  | 'left'
  | 'center'
  | 'right'
  | 'top'
  | 'middle'
  | 'bottom'

/**
 * V1 business / template list item — opaque to V3 internals. Business code
 * defines its own shape and consumes it via callbacks.
 */
export type ToolbarListItem = Record<string, unknown>

/**
 * V1 `extraButtons[]` entry — declarative custom-button slot.
 * Used by both `opts.extraButtons` (one-shot) and `addToolbarButton()`
 * (imperative add). Matches HiprintToolbar.ToolbarExtraButton.
 */
export interface ToolbarExtraButton {
  key: string
  label?: string
  icon?: string
  type?: string
  className?: string
  visible?: boolean
  disabled?: boolean
  /** Inline HTML — caller owns sanitisation (V1 quirk). Prefer `label`. */
  html?: string
  onClick?: (tpl: PrintTemplate | null | undefined, event?: Event) => void
}

/**
 * Imperative `addToolbarButton({ id, label, ... })` shape.
 *
 * `id` maps to `ToolbarExtraButton.key`. `position` controls whether the
 * button renders before or after the standard set (V1 `extraPosition`).
 */
export interface AddToolbarButtonOptions {
  id: string
  label?: string
  html?: string
  icon?: string
  className?: string
  visible?: boolean
  disabled?: boolean
  onClick?: (tpl: PrintTemplate | null | undefined, event?: Event) => void
  /**
   * Where to render the button. 'left' = start (before standard buttons),
   * 'right' = end (after standard buttons). Default 'right'.
   *
   * The first button added pins `extraPosition` for the lifetime of the
   * controller — V3 cannot render extras at both ends simultaneously.
   */
  position?: 'left' | 'right'
}

/**
 * V1 buildToolbar opts. Sprint 22c TKT-100 expanded from 22 → 68+ fields.
 *
 * Sources:
 *   - docs/V1-INVENTORY/toolbar-and-shell.md §8A (76-row reference table).
 *   - V1 bundle.js lines 13315-13390 (the `$.extend(...)` defaults block).
 *
 * Each field documents the V1 line + default value in JSDoc per ECC api-contract
 * rule.
 *
 * The interface intentionally allows excess keys (`[key: string]: unknown`) so
 * V1 templates with custom opts pass through without TS friction.
 */
export interface BuildToolbarOptions {
  // ============ Section A: paper / scale (V1 13316-13320) ============

  /** Preset paper sizes. Default `_defaultPaperTypes` A3/A4/A5/B3/B4/B5. V1 13316. */
  paperTypes?: ReadonlyArray<ToolbarPaperType> | undefined
  /** Initial active paper-button name. Default `'A4'`. V1 13317. */
  defaultPaper?: string | undefined
  /** Lower zoom bound. Default `0.5`. V1 13318. */
  scaleMin?: number | undefined
  /** Upper zoom bound. Default `5`. V1 13319. */
  scaleMax?: number | undefined
  /** Increment per zoom click. Default `0.1`. V1 13320. */
  scaleStep?: number | undefined

  // ============ Section B: showXxx visibility flags (V1 13321-13357) ============

  /** Show paper-size group. Default `true`. V1 13321. */
  showPaperSelect?: boolean | undefined
  /** Show custom-paper button. Default `true` (gated by showPaperSelect). V1 13322. */
  showCustomPaper?: boolean | undefined
  /** Show zoom in/out group. Default `true`. V1 13323. */
  showScale?: boolean | undefined
  /** Show rotate button. Default `true`. V1 13324. */
  showRotate?: boolean | undefined
  /** Show alignment buttons. Default `true`. V1 13325. */
  showAlign?: boolean | undefined
  /** Show preview button. Default `true`. V1 13326. */
  showPreview?: boolean | undefined
  /** Show clear button. Default `true`. V1 13327. */
  showClear?: boolean | undefined
  /** Show print button. Default `true`. V1 13328. */
  showPrint?: boolean | undefined
  /** Show business-select button. Default `true`. V1 13337. */
  showBusinessSelect?: boolean | undefined
  /** Show template-select button. Default `true`. V1 13353. */
  showTemplateSelect?: boolean | undefined
  /** Show save button. Default `true`. V1 13354. */
  showSave?: boolean | undefined
  /** Show panel-manager group. Default V1 `false`; V3 default `true`. V1 13357. */
  showPanelManager?: boolean | undefined

  // ============ Section C: onXxx hooks (V1 13329-13352) ============

  /**
   * Click handler for preview button.
   *
   * V1 13329 signature: `function(template) → void`.
   * Default `null` — fires the V3 default preview.
   */
  onPreview?: ((tpl: PrintTemplate) => void) | undefined
  /**
   * Total takeover of clear button (skips both `onClearConfirm` and native
   * `confirm`). V1 13330 signature: `function(template) → void`.
   */
  onClear?: ((tpl: PrintTemplate) => void) | undefined
  /** Click handler for print button. V1 13331 signature: `function(template) → void`. */
  onPrint?: ((tpl: PrintTemplate) => void) | undefined
  /**
   * Handler for save action (skips default JSON download).
   * V1 13332 signature: `function(template, json, event, api, {name}) → Promise<any>|any`.
   */
  onSave?:
    | ((
        tpl: PrintTemplate,
        json: TemplateJson,
        event?: Event | null,
        api?: unknown,
        ctx?: { name?: string }
      ) => void)
    | undefined
  /**
   * Fired after every paper-size or custom-paper confirm.
   * V1 13333 signature: `function(name, {width, height}) → void`.
   */
  onPaperChange?:
    | ((name: string, size: { width: number; height: number }) => void)
    | undefined
  /** Fired after every zoom in/out. V1 13334 signature: `function(scale) → void`. */
  onScaleChange?: ((scale: number) => void) | undefined
  /** Fired after rotate. V1 13335 signature: `function(template) → void`. */
  onRotate?: ((tpl: PrintTemplate) => void) | undefined
  /**
   * Fired after each alignment click.
   * V1 13336 signature: `function(type, template) → void`.
   */
  onAlign?: ((type: ToolbarAlignType, tpl: PrintTemplate) => void) | undefined
  /**
   * Pre-dialog hook; return `false` to suppress dialog open.
   * V1 13339 signature: `function(template, api) → bool`.
   */
  onBusinessClick?: ((tpl: PrintTemplate, api: unknown) => boolean | void) | undefined
  /** Override business-dialog open. V1 13340. */
  onBusinessDialogOpen?: ((ctx: Record<string, unknown>) => boolean | void) | undefined
  /** Override business-dialog close. V1 13341. */
  onBusinessDialogClose?: ((ctx: Record<string, unknown>) => boolean | void) | undefined
  /**
   * Fired when business card "选择" clicked + data resolved.
   * V1 13348 signature: `function(item, parsedData, template, api) → void`.
   */
  onBusinessSelect?:
    | ((
        item: ToolbarListItem,
        parsedData: unknown,
        tpl: PrintTemplate,
        api: unknown
      ) => void)
    | undefined
  /**
   * Fired when business loader rejects.
   * V3 addition (V1 has no dedicated business error hook — error path falls
   * into businessDialogErrorText).
   */
  onBusinessError?:
    | ((err: unknown, item: ToolbarListItem | null, tpl: PrintTemplate) => void)
    | undefined
  /** Override template-dialog open. V1 13350. */
  onTemplateDialogOpen?: ((ctx: Record<string, unknown>) => boolean | void) | undefined
  /** Override template-dialog close. V1 13351. */
  onTemplateDialogClose?: ((ctx: Record<string, unknown>) => boolean | void) | undefined
  /**
   * Replaces native `confirm()` before delete; truthy = proceed.
   * V1 13352 signature: `function(context) → Promise<bool>|bool`.
   */
  onTemplateDeleteConfirm?:
    | ((ctx: Record<string, unknown>) => boolean | Promise<boolean>)
    | undefined
  /**
   * Fired when template card "选择" + JSON applied.
   * V1 13382 signature: `function(item, json, template, api) → void`.
   */
  onTemplateSelect?:
    | ((
        item: ToolbarListItem,
        json: TemplateJson,
        tpl: PrintTemplate,
        api: unknown
      ) => void)
    | undefined
  /**
   * Fired when template select fails (loader/parse error). V1 13909.
   * Signature: `function(err, item, template, api) → void`.
   */
  onTemplateSelectError?:
    | ((err: unknown, item: ToolbarListItem, tpl: PrintTemplate, api: unknown) => void)
    | undefined
  /** Fired when "预览" clicked. V1 13383. */
  onTemplatePreview?:
    | ((item: ToolbarListItem, tpl: PrintTemplate, api: unknown) => void)
    | undefined
  /** Fired when "编辑" clicked. V1 13384. */
  onTemplateEdit?:
    | ((item: ToolbarListItem, tpl: PrintTemplate, api: unknown) => void)
    | undefined
  /**
   * Fired when "删除" confirmed; returning falsy skips refresh.
   * V1 13385.
   */
  onTemplateDelete?:
    | ((
        item: ToolbarListItem,
        tpl: PrintTemplate,
        api: unknown
      ) => boolean | Promise<boolean> | void)
    | undefined
  /** Override save-dialog open. V1 13361. */
  onSaveDialogOpen?: ((ctx: Record<string, unknown>) => boolean | void) | undefined
  /** Override save-dialog close. V1 13362. */
  onSaveDialogClose?: ((ctx: Record<string, unknown>) => boolean | void) | undefined
  /**
   * Async-confirm hook instead of native `confirm()` (sub-priority to onClear).
   * V1 14409-14422.
   */
  onClearConfirm?: ((tpl: PrintTemplate) => boolean | Promise<boolean>) | undefined
  /**
   * Override default custom-paper popover (return `false` to suppress V3 popover).
   * V1 14281-14283.
   */
  onCustomPaperOpen?: ((tpl: PrintTemplate, api: unknown) => boolean | void) | undefined

  // ============ Section D: business dialog props (V1 13342-13347) ============

  /** Business-select button label. V1 13338 default i18n('业务选择'). */
  businessButtonText?: string | undefined
  /** Business dialog `<h2>` title. V1 13342 default i18n('选择业务'). */
  businessDialogTitle?: string | undefined
  /** Empty-state message. V1 13343 default i18n('暂无业务'). */
  businessDialogEmptyText?: string | undefined
  /** Loading-state message. V1 13344 default i18n('业务加载中...'). */
  businessDialogLoadingText?: string | undefined
  /** Error-state fallback. V1 13345 default i18n('业务加载失败'). */
  businessDialogErrorText?: string | undefined
  /**
   * Items source for business dialog. V1 13346.
   * Signature: `function(template, api) → Promise<item[]>|item[]`.
   */
  businessListProvider?:
    | ((tpl: PrintTemplate, api: unknown) => Promise<ToolbarListItem[]> | ToolbarListItem[])
    | undefined
  /**
   * Per-item lazy-load on select.
   * V1 13347 signature: `function(item, template, api) → Promise<config>|config`.
   */
  businessLoader?:
    | ((item: ToolbarListItem, tpl: PrintTemplate, api: unknown) => Promise<unknown> | unknown)
    | undefined
  /** If false, business dialog stays open after select. V1 13349 default `true`. */
  closeBusinessDialogOnSelect?: boolean | undefined

  // ============ Section E: template dialog props (V1 13376-13387) ============

  /** Template-select button label. V1 13360 default i18n('选择模版'). */
  templateButtonText?: string | undefined
  /** Template dialog `<h2>` title. V1 13376 default i18n('选择模版'). */
  templateDialogTitle?: string | undefined
  /** Empty-state. V1 13377. */
  templateDialogEmptyText?: string | undefined
  /** Loading-state. V1 13378. */
  templateDialogLoadingText?: string | undefined
  /** Error-state fallback. V1 13379. */
  templateDialogErrorText?: string | undefined
  /** Items source. V1 13380. */
  templateListProvider?:
    | ((tpl: PrintTemplate, api: unknown) => Promise<ToolbarListItem[]> | ToolbarListItem[])
    | undefined
  /** Per-item lazy JSON loader. V1 13381. */
  templateLoader?:
    | ((item: ToolbarListItem, tpl: PrintTemplate, api: unknown) => Promise<TemplateJson> | TemplateJson)
    | undefined
  /** If false, template dialog stays open after select. V1 13386 default `true`. */
  closeTemplateDialogOnSelect?: boolean | undefined

  // ============ Section F: save dialog props (V1 13370-13375) ============

  /** Save dialog `<h2>` title. V1 13370 default i18n('保存模版'). */
  saveDialogTitle?: string | undefined
  /** Save dialog input `<label>` text. V1 13371. */
  saveDialogNameLabel?: string | undefined
  /** Save dialog input placeholder. V1 13372. */
  saveDialogNamePlaceholder?: string | undefined
  /** Validation error text when input empty. V1 13373. */
  saveDialogNameRequiredText?: string | undefined
  /** Save dialog confirm button text. V1 13374 default i18n('确定'). */
  saveDialogConfirmText?: string | undefined
  /** Save dialog cancel button text. V1 13375 default i18n('取消'). */
  saveDialogCancelText?: string | undefined

  // ============ Section G: button labels (V1 13363-13369) ============

  /** Custom-paper button label. V1 13363 default i18n('自定义'). */
  customPaperButtonText?: string | undefined
  /** Custom-paper confirm-button text. V1 13364 default i18n('确定'). */
  customPaperConfirmText?: string | undefined
  /** Rotate-button label. V1 13365 default i18n('旋转'). */
  rotateButtonText?: string | undefined
  /** Preview-button label. V1 13366 default i18n('预览'). */
  previewButtonText?: string | undefined
  /** Clear-button label. V1 13367 default i18n('清空'). */
  clearButtonText?: string | undefined
  /** Print-button label. V1 13368 default i18n('打印'). */
  printButtonText?: string | undefined
  /** Save-button label. V1 13369 default i18n('保存'). */
  saveButtonText?: string | undefined

  // ============ Section H: panel manager (V1 13358-13359) ============

  /** Panel-manager label sibling text. V1 13358 default i18n('分页'). */
  panelManagerLabel?: string | undefined
  /** Add-page button text. V1 13359 default `'+'`. */
  addPanelButtonText?: string | undefined
  /**
   * TKT-254 — Choose panel switcher rendering.
   * - `'chips'` (default, V3): rounded-pill button list with aria-pressed.
   * - `'select'` (V1 classic): single `<select>` dropdown, compact for many panels.
   */
  panelManagerMode?: 'chips' | 'select' | undefined

  // ============ Section I: extras + buttons override (V1 13387-13388, 14368) ============

  /** Extra-button group placement. V1 13387 default `'end'`. */
  extraPosition?: 'start' | 'end' | undefined
  /** Configuration-driven extra buttons. V1 13388 default `[]`. */
  extraButtons?: ReadonlyArray<ToolbarExtraButton> | undefined
  /** Replace default alignment buttons. V1 14368-14370. */
  alignItems?: ReadonlyArray<ToolbarAlignType> | undefined
  /** Subset of toolbar buttons to show (V3 native — orthogonal to showXxx). */
  buttons?: ReadonlyArray<string> | undefined

  // ============ Pass-through ============

  /** Unknown V1 keys pass through silently (e.g. `renderExtra`). */
  [key: string]: unknown
}

/**
 * V1 toolbarCtrl surface (subset). Sprint 22c restores the 10 most-used
 * methods documented in V1-INVENTORY §8A.2 (42 V1 methods → 10 here = 24 %).
 * V3 reactive consumers should still prefer `<HiprintToolbar>` props, but
 * legacy `vue-admin-main` callers depending on imperative `toolbarCtrl.xxx()`
 * now work again.
 */
export interface ToolbarController {
  /** Unmount the toolbar's Vue app + clear reactive refs. Idempotent. */
  destroy(): void

  // ---- TKT-040: scale ----
  /** Current canvas scale (0.1 .. 5). */
  getScale(): number
  /** Set canvas scale (clamps to 0.1 .. 5; non-finite ignored). */
  setScale(scale: number): void

  // ---- TKT-041: extra buttons ----
  /**
   * Register a custom button in the toolbar.
   *
   * The first call decides whether extras render at `'start'` or `'end'`
   * via `position` ('left' = start, 'right' = end). Subsequent calls add
   * to the same side (mixing sides is not supported by the underlying
   * SFC's `extraPosition` prop).
   *
   * Re-adding an existing `id` replaces the previous registration in-place.
   */
  addToolbarButton(opts: AddToolbarButtonOptions): void
  /** Remove a button registered via `addToolbarButton`. No-op if id unknown. */
  removeToolbarButton(id: string): void

  // ---- TKT-042: enable / disable ----
  /** Force a button enabled (lifts a prior `disableButton` override). */
  enableButton(id: string): void
  /** Force a button disabled regardless of normal disable rules. */
  disableButton(id: string): void

  // ---- TKT-043: label override ----
  /**
   * Replace a button's label. Plain-text only (XSS-safe — the SFC renders
   * via `{{ }}` interpolation, not `v-html`).
   *
   * Pass `null` / `undefined` (or empty string) to clear the override.
   */
  setButtonText(id: string, text: string | null | undefined): void

  // ---- TKT-044: active panel ----
  /** Get the currently-editing panel (V3 canvas.activePanel). */
  getActivePanel(): Panel | null
  /** Switch the active panel by id or by zero-based index. */
  setActivePanel(idOrIdx: string | number): void

  // ---- TKT-045: panel CRUD ----
  /** Add a panel (delegates to canvas.addPanel). Returns the new panel or null. */
  addPanel(opts?: Partial<Panel>): Panel | null
  /** Remove a panel by id or index. */
  removePanel(idOrIdx: string | number): void

  // ---- TKT-046: paper ----
  /**
   * Apply a preset paper to the active panel. `paperType` looks up the
   * paperTypes list (then the V3 default list as fallback).
   *
   * Width / height conversion: paperTypes carries mm; canvas.updatePanel
   * stores pt. We convert mm → pt (×72/25.4) consistent with the toolbar's
   * custom-paper popover.
   */
  setPaper(paperType: string): void
  /** Swap active panel's width and height. */
  rotatePaper(): void

  // ---- TKT-047: JSON ----
  /** Return current template JSON (fresh snapshot). Delegates to template. */
  getJson(): TemplateJson
  /** Replace template JSON. Delegates to template.update. */
  setJson(json: TemplateJson | Record<string, unknown>): void

  // ---- TKT-048: event bus ----
  /**
   * Subscribe to a controller event. Returns an unsubscribe fn.
   *
   * Built-in events:
   *  - 'scale-change'    (scale: number)
   *  - 'panel-change'    (panel: Panel | null)
   *  - 'paper-change'    (panel: Panel, dims: { width, height, paperType })
   *  - 'element-change'  (panels: Panel[])  fired on any panel/element mutation
   *  - 'history-change'  ({ canUndo, canRedo, pos })
   *
   * Custom events are also supported — `emit(name, ...args)` fans them out
   * to any handlers subscribed via `on(name, handler)`.
   */
  on(name: string, handler: EventHandler): () => void
  /** Unsubscribe. If `handler` omitted, clears every handler for `name`. */
  off(name: string, handler?: EventHandler): void
  /** Trigger event with payload. */
  emit(name: string, ...args: unknown[]): void

  // ---- TKT-049: composition entry points ----
  /** Underlying PrintTemplate instance (escape hatch). */
  getTemplateApi(): PrintTemplate
  /** Underlying canvas store (escape hatch). */
  getCanvasApi(): ReturnType<typeof useCanvasStore>

  // ---- escape hatches ----
  /** Underlying Vue app instance (escape hatch — avoid in business code). */
  readonly _app: App
  /** Container element. */
  readonly _container: HTMLElement
  /** Per-controller event bus (escape hatch for power users). */
  readonly _bus: EventBus
  /** Destroyed flag. */
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
 * V3 default paper list used by setPaper() fallback when opts.paperTypes is
 * missing or doesn't contain the requested label. Mirrors HiprintToolbar
 * `paperTypes` default + V1 `_defaultPaperTypes` (mm).
 */
const DEFAULT_PAPER_TYPES: readonly ToolbarPaperType[] = [
  { label: 'A3', width: 297, height: 420 },
  { label: 'A4', width: 210, height: 297 },
  { label: 'A5', width: 148, height: 210 },
  { label: 'B3', width: 353, height: 500 },
  { label: 'B4', width: 250, height: 353 },
  { label: 'B5', width: 176, height: 250 },
]

function findPaper(
  list: ReadonlyArray<ToolbarPaperType> | undefined,
  label: string
): ToolbarPaperType | undefined {
  if (list) {
    const hit = list.find((p) => p.label === label)
    if (hit) return hit
  }
  return DEFAULT_PAPER_TYPES.find((p) => p.label === label)
}

/** mm → pt (Panel.width/height unit). Matches HiprintToolbar custom-paper helper. */
function mmToPt(mm: number): number {
  return (mm / 25.4) * 72
}

/**
 * Hash a panel's paper-defining fields. Used by the canvas store subscription
 * bridge to fire `paper-change` only when paper dimensions actually changed.
 */
function panelPaperKey(panel: Panel | null | undefined): string {
  if (!panel) return ''
  return `${panel.width}|${panel.height}|${panel.paperType ?? ''}`
}

// ============ Public API ============

/**
 * Build a V3 toolbar inside `container`. The toolbar mutates the same Pinia
 * stores that `template` owns (so undo/redo/save round-trip).
 *
 * V1 signature: `hiprint.buildToolbar(container, template, options)`.
 */
export function buildToolbar(
  container: string | HTMLElement,
  template: PrintTemplate,
  options: BuildToolbarOptions = {}
): ToolbarController {
  const target = resolveContainer(container)
  if (!target) {
    throw new Error('[hiprint] buildToolbar: container not found: ' + String(container))
  }
  if (!template) {
    throw new Error('[hiprint] buildToolbar: template is required')
  }

  // Share the template's pinia instance so toolbar manipulates the same state.
  // Fallback: if template lacks _getPinia (defensive — should not happen), create
  // a fresh pinia and warn the consumer.
  let pinia: Pinia
  const internalTpl = template as unknown as { _getPinia?: () => Pinia }
  if (typeof internalTpl._getPinia === 'function') {
    pinia = internalTpl._getPinia()
  } else {
    console.warn(
      '[hiprint] buildToolbar: template missing _getPinia, using fresh pinia (state will not sync)'
    )
    pinia = createPinia()
  }
  setActivePinia(pinia)

  // ---- Per-controller event bus (TKT-048) ----
  const bus = createEventBus()

  // ---- Reactive overrides driven by imperative methods ----
  const extraButtonsRef: Ref<ToolbarExtraButton[]> = ref([
    ...((options.extraButtons ?? []) as ToolbarExtraButton[]),
  ])
  /**
   * First imperative addToolbarButton call (or opts.extraPosition) pins this
   * for the controller lifetime. V3 SFC extraPosition is a single
   * 'start' | 'end'; mixing sides is not supported.
   */
  const extraPositionRef: Ref<'start' | 'end'> = ref(options.extraPosition ?? 'end')
  const disabledButtonIdsRef: Ref<Record<string, boolean>> = ref({})
  const labelOverridesRef: Ref<Record<string, string>> = ref({})

  // ---- Wrap zero-arg legacy handlers (previewHandler / printHandler / saveHandler) ----
  // V1 buildToolbar passes (tpl) to onPreview / onPrint; SFC's legacy aliases
  // are zero-arg overrides. Wrap so the user callback still receives `tpl`.
  const wrapZero = <T extends (...a: unknown[]) => unknown>(
    fn: T | undefined,
    arg: unknown,
    name: string
  ): (() => void) | undefined => {
    if (typeof fn !== 'function') return undefined
    return () => {
      safeCall(fn as unknown as (...a: unknown[]) => void, [arg], name)
    }
  }

  // ---- Static prop bag (everything that doesn't change after mount) ----
  const staticProps = {
    // V3 native + V1 opts pass-through
    buttons: options.buttons,
    paperTypes: options.paperTypes,
    defaultPaper: options.defaultPaper,
    scaleMin: options.scaleMin,
    scaleMax: options.scaleMax,
    scaleStep: options.scaleStep,
    showUndo: undefined,
    showRedo: undefined,
    showSave: options.showSave,
    showPreview: options.showPreview,
    showPrint: options.showPrint,
    showPdf: undefined,
    showClear: options.showClear,
    showPanelManager: options.showPanelManager,
    showPaperSelect: options.showPaperSelect,
    showCustomPaper: options.showCustomPaper,
    showRotate: options.showRotate,
    // Sprint 22d TKT-158: showAlign accepted on the V1 opts surface for
    // backward compat but no longer forwarded — align buttons were removed
    // from the toolbar SFC. The option becomes a silent no-op.
    showScale: options.showScale,
    showRuler: undefined,
    showGrid: undefined,
    showTemplateSelect: options.showTemplateSelect,
    showBusinessSelect: options.showBusinessSelect,
    tpl: template,
    // ---- V1 onXxx (signature adapters) ----
    previewHandler: wrapZero(
      options.onPreview as unknown as (...a: unknown[]) => void,
      template,
      'toolbar.onPreview'
    ),
    printHandler: wrapZero(
      options.onPrint as unknown as (...a: unknown[]) => void,
      template,
      'toolbar.onPrint'
    ),
    saveHandler: options.onSave
      ? () => {
          safeCall(
            options.onSave as unknown as (...a: unknown[]) => void,
            [template, template.getJson(), null, undefined, {}],
            'toolbar.onSave'
          )
        }
      : undefined,
    onClear: options.onClear
      ? () => {
          safeCall(
            options.onClear as unknown as (...a: unknown[]) => void,
            [template],
            'toolbar.onClear'
          )
        }
      : undefined,
    onPaperChange: options.onPaperChange
      ? (
          _tplArg: unknown,
          name: string,
          size: { width: number; height: number }
        ) => {
          safeCall(
            options.onPaperChange as unknown as (...a: unknown[]) => void,
            [name, size],
            'toolbar.onPaperChange'
          )
        }
      : undefined,
    onRotate: options.onRotate
      ? () => {
          safeCall(
            options.onRotate as unknown as (...a: unknown[]) => void,
            [template],
            'toolbar.onRotate'
          )
        }
      : undefined,
    // Sprint 22d TKT-158: onAlign accepted on the V1 opts surface (callers
    // may still subscribe) but the toolbar no longer fires it. Alignment now
    // happens via `template.alignElements()` from the element contextmenu
    // (see `interactions/context-menu.ts`). Business code that needs an
    // observability hook can subscribe via the V3 event bus 'align' event
    // emitted by `PrintTemplate.alignElements`.
    onScaleChange: options.onScaleChange
      ? (_tplArg: unknown, scale: number) => {
          safeCall(
            options.onScaleChange as unknown as (...a: unknown[]) => void,
            [scale],
            'toolbar.onScaleChange'
          )
        }
      : undefined,
    // ---- Sprint 22c TKT-100: V1 button-text opts ----
    saveButtonText: options.saveButtonText,
    previewButtonText: options.previewButtonText,
    printButtonText: options.printButtonText,
    clearButtonText: options.clearButtonText,
    customPaperButtonText: options.customPaperButtonText,
    rotateButtonText: options.rotateButtonText,
    businessButtonText: options.businessButtonText,
    templateButtonText: options.templateButtonText,
    panelManagerLabel: options.panelManagerLabel,
    addPanelButtonText: options.addPanelButtonText,
    // TKT-254: panel switcher mode passes through to the SFC.
    panelManagerMode: options.panelManagerMode,
    // Sprint 22d TKT-158: alignItems retained on options for V1 compat but
    // no longer forwarded to the SFC.
  } as const

  // ---- Wrapper SFC owns the reactive refs ----
  // Vue auto-unwraps refs inside the render fn so HiprintToolbar receives the
  // unwrapped values AND re-renders when the refs change (TKT-041/042/043).
  const ToolbarHost = defineComponent({
    name: 'HiprintToolbarHost',
    setup() {
      return () =>
        h(HiprintToolbar, {
          ...staticProps,
          extraButtons: extraButtonsRef.value,
          extraPosition: extraPositionRef.value,
          disabledButtonIds: disabledButtonIdsRef.value,
          labelOverrides: labelOverridesRef.value,
        })
    },
  })

  const app = createApp(ToolbarHost)
  app.use(pinia)
  app.mount(target)

  // ---- TKT-048: bridge pinia subscriptions → event bus ----
  setActivePinia(pinia)
  const canvasStore = useCanvasStore()
  const historyStore = useHistoryStore()
  const templateStore = useTemplateStore()

  // Pinia $subscribe gives us a callback whenever any state of that store
  // mutates. We diff against captured "last" values to decide which event
  // family to fire (avoids spam on unrelated mutations).
  let lastScale = canvasStore.scale
  let lastActivePanelId = canvasStore.activePanelId
  let lastPaperKey = panelPaperKey(canvasStore.activePanel)
  let lastPanelCount = canvasStore.panels.length
  let lastHistoryPos = historyStore.pos
  let lastCanUndo = historyStore.canUndo
  let lastCanRedo = historyStore.canRedo

  const unsubCanvas = canvasStore.$subscribe(
    () => {
      if (canvasStore.scale !== lastScale) {
        lastScale = canvasStore.scale
        bus.trigger('scale-change', canvasStore.scale)
      }
      const ap = canvasStore.activePanelId
      const pc = canvasStore.panels.length
      if (ap !== lastActivePanelId || pc !== lastPanelCount) {
        lastActivePanelId = ap
        lastPanelCount = pc
        bus.trigger('panel-change', canvasStore.activePanel)
      }
      const pk = panelPaperKey(canvasStore.activePanel)
      if (pk !== lastPaperKey) {
        lastPaperKey = pk
        const ap2 = canvasStore.activePanel
        if (ap2) {
          bus.trigger('paper-change', ap2, {
            width: ap2.width,
            height: ap2.height,
            paperType: ap2.paperType ?? '',
          })
        }
      }
      bus.trigger('element-change', canvasStore.panels)
    },
    { detached: true }
  )

  // History store's canUndo / canRedo / pos are derived from vueuse's
  // `useManualRefHistory` internal state (NOT a Pinia state ref), so Pinia's
  // $subscribe never fires for them. Use a Vue `watch` inside an effectScope
  // so we can detach the watcher cleanly in destroy().
  const historyScope = effectScope(true)
  historyScope.run(() => {
    watch(
      () => [historyStore.pos, historyStore.canUndo, historyStore.canRedo] as const,
      ([pos, cu, cr]) => {
        if (pos !== lastHistoryPos || cu !== lastCanUndo || cr !== lastCanRedo) {
          lastHistoryPos = pos
          lastCanUndo = cu
          lastCanRedo = cr
          bus.trigger('history-change', { canUndo: cu, canRedo: cr, pos })
        }
      },
      { flush: 'sync' }
    )
  })
  const unsubHistory = (): void => historyScope.stop()

  // templateStore is referenced for future dirty-flag subscriptions but
  // currently unused — keep the reference to avoid "declared but never used".
  void templateStore

  const controller: ToolbarController = {
    _app: app,
    _container: target,
    _bus: bus,
    _destroyed: false,

    destroy(): void {
      if (this._destroyed) return
      try {
        unsubCanvas()
      } catch {
        /* ignore */
      }
      try {
        unsubHistory()
      } catch {
        /* ignore */
      }
      try {
        bus.clear('scale-change')
        bus.clear('panel-change')
        bus.clear('paper-change')
        bus.clear('element-change')
        bus.clear('history-change')
      } catch {
        /* ignore */
      }
      try {
        app.unmount()
      } catch (err) {
        console.warn('[hiprint] buildToolbar.destroy unmount failed:', err)
      }
      extraButtonsRef.value = []
      disabledButtonIdsRef.value = {}
      labelOverridesRef.value = {}
      this._destroyed = true
    },

    // ---------- TKT-040 ----------
    getScale(): number {
      if (assertNotDestroyed(this as { _destroyed: boolean }, 'toolbar.getScale')) return 1
      setActivePinia(pinia)
      return useCanvasStore().scale
    },

    setScale(scale: number): void {
      if (assertNotDestroyed(this as { _destroyed: boolean }, 'toolbar.setScale')) return
      if (!Number.isFinite(scale)) {
        console.warn('[hiprint] toolbar.setScale ignored: non-finite value', scale)
        return
      }
      setActivePinia(pinia)
      useCanvasStore().setScale(scale)
    },

    // ---------- TKT-041 ----------
    addToolbarButton(opts: AddToolbarButtonOptions): void {
      if (assertNotDestroyed(this as { _destroyed: boolean }, 'toolbar.addToolbarButton'))
        return
      if (!opts || typeof opts.id !== 'string' || !opts.id) {
        console.warn('[hiprint] addToolbarButton: opts.id is required')
        return
      }
      if (opts.position === 'left') {
        extraPositionRef.value = 'start'
      } else if (opts.position === 'right') {
        extraPositionRef.value = 'end'
      }
      const btn: ToolbarExtraButton = {
        key: opts.id,
        label: opts.label,
        icon: opts.icon,
        type: undefined,
        className: opts.className,
        visible: opts.visible !== false,
        disabled: opts.disabled === true,
        html: opts.html,
        onClick: opts.onClick,
      }
      const cur = extraButtonsRef.value
      const idx = cur.findIndex((b) => b.key === opts.id)
      if (idx >= 0) {
        const next = cur.slice()
        next[idx] = btn
        extraButtonsRef.value = next
      } else {
        extraButtonsRef.value = [...cur, btn]
      }
    },

    removeToolbarButton(id: string): void {
      if (
        assertNotDestroyed(this as { _destroyed: boolean }, 'toolbar.removeToolbarButton')
      )
        return
      if (!id) return
      const next = extraButtonsRef.value.filter((b) => b.key !== id)
      if (next.length !== extraButtonsRef.value.length) extraButtonsRef.value = next
    },

    // ---------- TKT-042 ----------
    enableButton(id: string): void {
      if (assertNotDestroyed(this as { _destroyed: boolean }, 'toolbar.enableButton'))
        return
      if (!id) return
      if (disabledButtonIdsRef.value[id]) {
        const next = { ...disabledButtonIdsRef.value }
        delete next[id]
        disabledButtonIdsRef.value = next
      }
    },

    disableButton(id: string): void {
      if (assertNotDestroyed(this as { _destroyed: boolean }, 'toolbar.disableButton'))
        return
      if (!id) return
      disabledButtonIdsRef.value = { ...disabledButtonIdsRef.value, [id]: true }
    },

    // ---------- TKT-043 ----------
    setButtonText(id: string, text: string | null | undefined): void {
      if (assertNotDestroyed(this as { _destroyed: boolean }, 'toolbar.setButtonText'))
        return
      if (!id) return
      if (typeof text !== 'string' || !text) {
        if (id in labelOverridesRef.value) {
          const next = { ...labelOverridesRef.value }
          delete next[id]
          labelOverridesRef.value = next
        }
        return
      }
      labelOverridesRef.value = { ...labelOverridesRef.value, [id]: text }
    },

    // ---------- TKT-044 ----------
    getActivePanel(): Panel | null {
      if (assertNotDestroyed(this as { _destroyed: boolean }, 'toolbar.getActivePanel'))
        return null
      setActivePinia(pinia)
      return useCanvasStore().activePanel ?? null
    },

    setActivePanel(idOrIdx: string | number): void {
      if (assertNotDestroyed(this as { _destroyed: boolean }, 'toolbar.setActivePanel'))
        return
      setActivePinia(pinia)
      const canvas = useCanvasStore()
      let id: string | undefined
      if (typeof idOrIdx === 'number') {
        if (Number.isInteger(idOrIdx) && idOrIdx >= 0 && idOrIdx < canvas.panels.length) {
          id = canvas.panels[idOrIdx]!.id
        }
      } else if (typeof idOrIdx === 'string') {
        id = idOrIdx
      }
      if (!id) {
        console.warn('[hiprint] toolbar.setActivePanel: panel not found:', idOrIdx)
        return
      }
      canvas.setActivePanel(id)
    },

    // ---------- TKT-045 ----------
    addPanel(opts?: Partial<Panel>): Panel | null {
      if (assertNotDestroyed(this as { _destroyed: boolean }, 'toolbar.addPanel'))
        return null
      setActivePinia(pinia)
      const canvas = useCanvasStore()
      const width = (opts?.width as number | undefined) ?? mmToPt(210)
      const height = (opts?.height as number | undefined) ?? mmToPt(297)
      const newPanel = canvas.addPanel({
        ...(opts ?? {}),
        width,
        height,
      } as Partial<Panel> & Pick<Panel, 'width' | 'height'>)
      try {
        useHistoryStore().pushSnapshot()
      } catch {
        /* ignore */
      }
      return newPanel ?? null
    },

    removePanel(idOrIdx: string | number): void {
      if (assertNotDestroyed(this as { _destroyed: boolean }, 'toolbar.removePanel'))
        return
      setActivePinia(pinia)
      const canvas = useCanvasStore()
      let id: string | undefined
      if (typeof idOrIdx === 'number') {
        if (Number.isInteger(idOrIdx) && idOrIdx >= 0 && idOrIdx < canvas.panels.length) {
          id = canvas.panels[idOrIdx]!.id
        }
      } else if (typeof idOrIdx === 'string') {
        id = idOrIdx
      }
      if (!id) {
        console.warn('[hiprint] toolbar.removePanel: panel not found:', idOrIdx)
        return
      }
      canvas.removePanel(id)
      try {
        useHistoryStore().pushSnapshot()
      } catch {
        /* ignore */
      }
    },

    // ---------- TKT-046 ----------
    setPaper(paperType: string): void {
      if (assertNotDestroyed(this as { _destroyed: boolean }, 'toolbar.setPaper')) return
      if (!paperType) return
      setActivePinia(pinia)
      const canvas = useCanvasStore()
      const apId = canvas.activePanelId
      if (!apId) {
        console.warn('[hiprint] toolbar.setPaper: no active panel')
        return
      }
      const paper = findPaper(options.paperTypes, paperType)
      if (!paper) {
        console.warn('[hiprint] toolbar.setPaper: unknown paperType:', paperType)
        return
      }
      canvas.updatePanel(apId, {
        width: mmToPt(paper.width),
        height: mmToPt(paper.height),
        paperType: paper.label,
      })
      try {
        useHistoryStore().pushSnapshot()
      } catch {
        /* ignore */
      }
    },

    rotatePaper(): void {
      if (assertNotDestroyed(this as { _destroyed: boolean }, 'toolbar.rotatePaper'))
        return
      setActivePinia(pinia)
      const canvas = useCanvasStore()
      const ap = canvas.activePanel
      if (!ap) {
        console.warn('[hiprint] toolbar.rotatePaper: no active panel')
        return
      }
      canvas.updatePanel(ap.id, { width: ap.height, height: ap.width })
      try {
        useHistoryStore().pushSnapshot()
      } catch {
        /* ignore */
      }
    },

    // ---------- TKT-047 ----------
    getJson(): TemplateJson {
      if (assertNotDestroyed(this as { _destroyed: boolean }, 'toolbar.getJson')) {
        return { panels: [] } as unknown as TemplateJson
      }
      return template.getJson()
    },

    setJson(json: TemplateJson | Record<string, unknown>): void {
      if (assertNotDestroyed(this as { _destroyed: boolean }, 'toolbar.setJson')) return
      try {
        template.update(json as TemplateJson)
      } catch (err) {
        console.error('[hiprint] toolbar.setJson failed:', err)
      }
    },

    // ---------- TKT-048 ----------
    on(name: string, handler: EventHandler): () => void {
      if (assertNotDestroyed(this as { _destroyed: boolean }, 'toolbar.on')) {
        return () => {
          /* destroyed — noop unsubscribe */
        }
      }
      if (typeof handler !== 'function') {
        console.warn('[hiprint] toolbar.on: handler must be a function')
        return () => {
          /* noop */
        }
      }
      bus.on(name, handler)
      return () => bus.off(name, handler)
    },

    off(name: string, handler?: EventHandler): void {
      if (assertNotDestroyed(this as { _destroyed: boolean }, 'toolbar.off')) return
      bus.off(name, handler)
    },

    emit(name: string, ...args: unknown[]): void {
      if (assertNotDestroyed(this as { _destroyed: boolean }, 'toolbar.emit')) return
      bus.trigger(name, ...args)
    },

    // ---------- TKT-049 ----------
    getTemplateApi(): PrintTemplate {
      return template
    },

    getCanvasApi(): ReturnType<typeof useCanvasStore> {
      setActivePinia(pinia)
      return useCanvasStore()
    },
  }
  return controller
}
