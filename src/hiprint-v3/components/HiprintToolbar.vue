<script setup lang="ts">
/**
 * HiprintToolbar.vue — V3 designer toolbar (P21.6 + P21.7 — pure reactive SFC).
 *
 * V3 architecture (final):
 *  - Pure reactive Vue 3 SFC: props in → render out + emits. No V1 imperative
 *    defineExpose surface, no buttonOverlay map, no dialog open flags.
 *  - All V1 toolbarCtrl imperative methods are deleted from the compat layer
 *    as well (business consumers migrate to V3 native composables /
 *    `<HiprintDesigner>` props + emits).
 *
 * Props in this SFC:
 *  1. Reactive opts — show* (visibility flags) plus on* (event handlers) plus
 *     paperTypes, scaleMin/Max/Step, extraButtons, extraPosition,
 *     panelManagerLabel, addPanelButtonText. (Sprint 22d TKT-158 removed
 *     `alignItems` + `showAlign` — align lives in element contextmenu now.)
 *  2. `tpl` — the PrintTemplate so onXxx callbacks receive it per V1 signature
 *     parity (some business callbacks still rely on the first-arg-is-tpl shape).
 *
 * Locked invariants:
 *  - #8: every business callback wrapped via `safeCall` (try/catch isolation).
 *  - V1 onXxx signature parity: first arg is always `tpl` (when defined).
 *
 * Accessibility:
 *  - role="toolbar"
 *  - Buttons have aria-label via :aria-label binding
 *  - Disabled state mirrored via :disabled (canUndo, canRedo, panel count)
 */
import { computed, ref } from 'vue'
import {
  useCanvasStore,
  useHistoryStore,
  useTemplateStore,
} from '@hiprint-v3/stores'
import { browserPrint, downloadPdf, getPrintHtml } from '@hiprint-v3/print'
import { safeCall } from '@hiprint-v3/internal'
import type { TemplateJson } from '@hiprint-v3/schemas'
import type { PrintTemplate } from '@hiprint-v3/compat/print-template'
import CustomPaperPopover from './CustomPaperPopover.vue'

// ============ Public types ============

export interface ToolbarPaperType {
  /** Display label e.g. "A4". */
  label: string
  /** Width in mm. */
  width: number
  /** Height in mm. */
  height: number
}

/**
 * Stable identifier for each button (subset selectable via `props.buttons`).
 *
 * Sprint 22d TKT-158: align/distribute buttons removed from the toolbar to
 * match V1 (V1 inventory `toolbar-and-shell.md` §1.21/§1.22 — V1 only exposes
 * alignment in the element right-click contextmenu). Align actions are now
 * surfaced exclusively via `interactions/context-menu.ts` when ≥2 elements
 * are selected.
 */
export type ToolbarButtonId =
  | 'undo'
  | 'redo'
  | 'save'
  | 'preview'
  | 'print'
  | 'pdf'
  | 'clear'
  | 'addPanel'
  | 'removePanel'
  | 'rotate'
  | 'paper'
  | 'zoomIn'
  | 'zoomOut'
  | 'zoomReset'
  | 'gridToggle'
  | 'rulerToggle'
  | 'templateSelect'
  | 'businessSelect'

/**
 * Sprint 22d TKT-158: type retained for compat with `onAlign` callback +
 * `alignElements()` PrintTemplate signature. No toolbar button references
 * it anymore.
 */
export type ToolbarAlignType =
  | 'left'
  | 'center'
  | 'right'
  | 'top'
  | 'middle'
  | 'bottom'

/**
 * V1 extraButtons[] entry — declarative custom-button slot.
 * `onClick` receives the PrintTemplate per V1 contract.
 */
export interface ToolbarExtraButton {
  key: string
  label?: string
  icon?: string
  type?: 'default' | 'primary' | 'danger' | string
  className?: string
  visible?: boolean
  disabled?: boolean
  /** Inline HTML alternative — caller owns sanitisation (V1 quirk). */
  html?: string
  onClick?: (tpl: PrintTemplate | null | undefined, event?: Event) => void
}

interface Props {
  /**
   * Subset of buttons to show. Default: all 16 standard buttons (Sprint 22d
   * TKT-158 dropped the 6 alignment buttons to match V1 — align lives only
   * in the element right-click contextmenu).
   */
  buttons?: readonly ToolbarButtonId[]
  /** Paper-size list shown in select. Defaults to A3/A4/A5/B4/B5. */
  paperTypes?: readonly ToolbarPaperType[]
  /** Initial paper selection label. */
  defaultPaper?: string
  /** Min/max/step for zoom slider. */
  scaleMin?: number
  scaleMax?: number
  scaleStep?: number
  /**
   * The PrintTemplate this toolbar is bound to. buildDesigner injects this so
   * onXxx callbacks receive `tpl` as first argument per V1 contract.
   */
  tpl?: PrintTemplate | null
  /**
   * Override default Preview behavior (legacy alias).
   * NOTE: named `previewHandler` (not `onPreview`) so Vue does not treat it
   * as a listener auto-bound from `@preview` emits.
   */
  previewHandler?: () => void
  /** Override default Print behavior (legacy alias). */
  printHandler?: () => void
  /** Override default Save behavior (legacy alias). */
  saveHandler?: () => void
  // ---- V1 showXxx visibility flags (default true unless V1 says otherwise) ----
  showUndo?: boolean
  showRedo?: boolean
  showSave?: boolean
  showPreview?: boolean
  showPrint?: boolean
  showPdf?: boolean
  showClear?: boolean
  showPanelManager?: boolean
  showPaperSelect?: boolean
  showCustomPaper?: boolean
  showRotate?: boolean
  showScale?: boolean
  showRuler?: boolean
  showGrid?: boolean
  showTemplateSelect?: boolean
  showBusinessSelect?: boolean
  // ---- V1 onXxx handlers (each gets tpl as first arg) ----
  onPreview?: (tpl: PrintTemplate | null | undefined) => void
  onPrint?: (tpl: PrintTemplate | null | undefined) => void
  onClear?: (tpl: PrintTemplate | null | undefined) => void
  onSave?: (
    tpl: PrintTemplate | null | undefined,
    json: TemplateJson,
    event?: Event | null,
    api?: unknown,
    ctx?: { name?: string }
  ) => void
  onPaperChange?: (
    tpl: PrintTemplate | null | undefined,
    name: string,
    size: { width: number; height: number }
  ) => void
  onRotate?: (tpl: PrintTemplate | null | undefined) => void
  onAlign?: (
    tpl: PrintTemplate | null | undefined,
    type: ToolbarAlignType
  ) => void
  onScaleChange?: (
    tpl: PrintTemplate | null | undefined,
    value: number
  ) => void
  onAddPanel?: (tpl: PrintTemplate | null | undefined) => void
  onRemovePanel?: (
    tpl: PrintTemplate | null | undefined,
    idx: number
  ) => void
  onSwitchPanel?: (
    tpl: PrintTemplate | null | undefined,
    idx: number
  ) => void
  onTemplateSelectClick?: (tpl: PrintTemplate | null | undefined) => void
  onBusinessSelectClick?: (tpl: PrintTemplate | null | undefined) => void
  // ---- Panel manager opts ----
  panelManagerLabel?: string
  addPanelButtonText?: string
  /**
   * TKT-254 — V1 parity option: choose between V3's chip switcher (default)
   * and V1's classic `<select>` dropdown. Set to `'select'` for documents
   * with many panels where chips overflow horizontally.
   *
   * - `'chips'` (default, V3): rounded-pill buttons, `aria-pressed` reflects
   *   active. Cleanest for ≤ 8 panels.
   * - `'select'` (V1): single `<select>` dropdown. Compact, scales to N panels.
   */
  panelManagerMode?: 'chips' | 'select'
  // ---- Extra buttons ----
  extraButtons?: readonly ToolbarExtraButton[]
  extraPosition?: 'start' | 'end'
  // ---- Sprint 22c TKT-042/043: imperative overrides driven by toolbarCtrl ----
  /**
   * Map of button id → boolean. When `true`, the corresponding button is
   * forced disabled regardless of normal `isDisabled()` rules. Drives
   * `toolbarCtrl.enableButton(id)` / `disableButton(id)`.
   */
  disabledButtonIds?: Readonly<Record<string, boolean>>
  /**
   * Map of button id → label string. Replaces the default label for that
   * button. Drives `toolbarCtrl.setButtonText(id, text)`.
   * The string is rendered as plain text (XSS-safe — no v-html).
   */
  labelOverrides?: Readonly<Record<string, string>>
  // ---- Sprint 22c TKT-100: V1 *ButtonText opts (pass-through, text-only) ----
  saveButtonText?: string
  previewButtonText?: string
  printButtonText?: string
  clearButtonText?: string
  customPaperButtonText?: string
  rotateButtonText?: string
  businessButtonText?: string
  templateButtonText?: string
}

const props = withDefaults(defineProps<Props>(), {
  // Sprint 22d TKT-158: align buttons removed (V1 parity — align lives in the
  // element right-click contextmenu only).
  buttons: () => [
    'undo',
    'redo',
    'save',
    'preview',
    'print',
    'pdf',
    'clear',
    'addPanel',
    'removePanel',
    'rotate',
    'paper',
    'zoomOut',
    'zoomReset',
    'zoomIn',
    'gridToggle',
    'rulerToggle',
  ],
  // V1 parity: `_defaultPaperTypes` dictionary [V1 bundle.js lines 13296-13303]
  // — A3/A4/A5/B3/B4/B5 with these exact dimensions (mm). Sprint 22a-r rollback
  // restored B3 (was dropped) + fixed A3/A5/B5 width/height swap. Values match
  // V1 inventory `docs/V1-INVENTORY/toolbar-and-shell.md` §1.15 + Appendix A.
  paperTypes: () => [
    { label: 'A3', width: 297, height: 420 },
    { label: 'A4', width: 210, height: 297 },
    { label: 'A5', width: 148, height: 210 },
    { label: 'B3', width: 353, height: 500 },
    { label: 'B4', width: 250, height: 353 },
    { label: 'B5', width: 176, height: 250 },
  ],
  defaultPaper: 'A4',
  scaleMin: 0.5,
  scaleMax: 5,
  scaleStep: 0.1,
  tpl: null,
  previewHandler: undefined,
  printHandler: undefined,
  saveHandler: undefined,
  showUndo: true,
  showRedo: true,
  showSave: true,
  showPreview: true,
  showPrint: true,
  showPdf: true,
  showClear: true,
  // V1 parity: panel-manager + custom-paper visible by default. Business
  // code passes showXxx=false to hide. (User-reported "默认第一页 / 自定义纸张"
  // missing — V3 had them off by default, V1 had them on.)
  showPanelManager: true,
  showPaperSelect: true,
  showCustomPaper: true,
  showRotate: true,
  showScale: true,
  showRuler: true,
  showGrid: true,
  showTemplateSelect: false,
  showBusinessSelect: false,
  onPreview: undefined,
  onPrint: undefined,
  onClear: undefined,
  onSave: undefined,
  onPaperChange: undefined,
  onRotate: undefined,
  onAlign: undefined,
  onScaleChange: undefined,
  onAddPanel: undefined,
  onRemovePanel: undefined,
  onSwitchPanel: undefined,
  onTemplateSelectClick: undefined,
  onBusinessSelectClick: undefined,
  panelManagerLabel: '',
  addPanelButtonText: '+',
  panelManagerMode: 'chips',
  extraButtons: () => [],
  extraPosition: 'end',
  // Sprint 22c TKT-042/043 imperative overrides — empty by default so V3
  // reactive consumers see no behaviour change.
  disabledButtonIds: () => ({}),
  labelOverrides: () => ({}),
  // Sprint 22c TKT-100 V1 button-text opts — undefined means "use default".
  saveButtonText: undefined,
  previewButtonText: undefined,
  printButtonText: undefined,
  clearButtonText: undefined,
  customPaperButtonText: undefined,
  rotateButtonText: undefined,
  businessButtonText: undefined,
  templateButtonText: undefined,
})

/**
 * Vue 3 quirk: any prop named `onXxx` is treated as an `xxx` event listener.
 * To prevent the V1 `onPreview` / `onPrint` / etc. props from double-firing,
 * we DO NOT redundantly invoke `props.onXxx?.(...)` inside each handler when
 * an emit already covers that event. Instead each emit declares the V1
 * signature (tpl + V1 args), so Vue's auto-listener bridge invokes the
 * onXxx prop exactly once with the correct arg shape.
 *
 * Side benefit: `<HiprintToolbar @preview="...">` consumers and prop-based
 * `:on-preview="..."` consumers both work identically.
 */
interface Emits {
  (e: 'preview', tpl: PrintTemplate | null | undefined): void
  (e: 'print', tpl: PrintTemplate | null | undefined): void
  (e: 'save', tpl: PrintTemplate | null | undefined, json: TemplateJson, event: Event | null, api: unknown, ctx: { name?: string }): void
  (e: 'clear', tpl: PrintTemplate | null | undefined): void
  (e: 'paperChange', tpl: PrintTemplate | null | undefined, name: string, size: { width: number; height: number }): void
  (e: 'scaleChange', tpl: PrintTemplate | null | undefined, scale: number): void
  (e: 'addPanel', tpl: PrintTemplate | null | undefined): void
  (e: 'removePanel', tpl: PrintTemplate | null | undefined, idx: number): void
  (e: 'rotate', tpl: PrintTemplate | null | undefined): void
  (e: 'align', tpl: PrintTemplate | null | undefined, type: ToolbarAlignType): void
  (e: 'toggleGrid', visible: boolean): void
  (e: 'toggleRuler', visible: boolean): void
  (e: 'switchPanel', tpl: PrintTemplate | null | undefined, idx: number): void
  (e: 'templateSelectClick', tpl: PrintTemplate | null | undefined): void
  (e: 'businessSelectClick', tpl: PrintTemplate | null | undefined): void
}
const emit = defineEmits<Emits>()

// ============ Stores ============

const canvas = useCanvasStore()
const history = useHistoryStore()
const tpl = useTemplateStore()

// ============ Local UI state ============

const toolbarRootEl = ref<HTMLElement | null>(null)
const selectedPaperLabel = ref<string>(props.defaultPaper)
/**
 * TB-004 custom paper popover open state. Toggled by the ⚙ button in the
 * paper section. Closes on submit / Cancel / outer click (outer click logic
 * lives in the popover SFC).
 */
const customPaperOpen = ref<boolean>(false)
// gridVisible / rulerVisible now live in canvas store so HiprintPanel /
// HiprintCanvas can subscribe + render the actual grid background / ruler
// overlay. Toolbar buttons toggle through the store (line 754 / 759).
const gridVisible = computed<boolean>({
  get: () => canvas.gridVisible,
  set: (v) => { canvas.gridVisible = v },
})
const rulerVisible = computed<boolean>({
  get: () => canvas.rulerVisible,
  set: (v) => { canvas.rulerVisible = v },
})

// ============ Derived ============

const explicitButtons = computed<Set<ToolbarButtonId>>(
  () => new Set(props.buttons)
)

const defaultLabels: Record<string, string> = {
  undo: '↶ Undo',
  redo: '↷ Redo',
  save: '💾 Save',
  preview: '👁 Preview',
  print: '🖨 Print',
  pdf: '📄 PDF',
  clear: '🗑 Clear',
  addPanel: '+ Panel',
  removePanel: '− Panel',
  rotate: '⟲ Rotate',
  zoomIn: '+',
  zoomOut: '−',
  zoomReset: '100%',
  gridToggle: '▦ Grid',
  rulerToggle: '⌖ Ruler',
  templateSelect: '📋 Templates',
  businessSelect: '🏷 Business',
}

function defaultLabelFor(key: string): string {
  // Sprint 22c TKT-100: V1 *ButtonText opts win over the default emoji label.
  // Order: labelOverrides (imperative TKT-043) > V1 text prop > default.
  switch (key) {
    case 'save': if (props.saveButtonText) return props.saveButtonText; break
    case 'preview': if (props.previewButtonText) return props.previewButtonText; break
    case 'print': if (props.printButtonText) return props.printButtonText; break
    case 'clear': if (props.clearButtonText) return props.clearButtonText; break
    case 'rotate': if (props.rotateButtonText) return props.rotateButtonText; break
    case 'templateSelect':
      if (props.templateButtonText) return props.templateButtonText; break
    case 'businessSelect':
      if (props.businessButtonText) return props.businessButtonText; break
  }
  return defaultLabels[key] ?? key
}

function showFlagFor(key: ToolbarButtonId): boolean {
  switch (key) {
    case 'undo': return props.showUndo
    case 'redo': return props.showRedo
    case 'save': return props.showSave
    case 'preview': return props.showPreview
    case 'print': return props.showPrint
    case 'pdf': return props.showPdf
    case 'clear': return props.showClear
    case 'paper': return props.showPaperSelect
    case 'rotate': return props.showRotate
    case 'addPanel':
    case 'removePanel':
      return props.showPanelManager || explicitButtons.value.has(key)
    case 'zoomIn':
    case 'zoomOut':
    case 'zoomReset':
      return props.showScale
    case 'gridToggle':
      return props.showGrid
    case 'rulerToggle':
      return props.showRuler
    case 'templateSelect':
      return props.showTemplateSelect
    case 'businessSelect':
      return props.showBusinessSelect
    default:
      return true
  }
}

function isShown(id: ToolbarButtonId): boolean {
  // templateSelect / businessSelect / addPanel / removePanel are opt-in via
  // showXxx alone (not in default `buttons` list) — match V1 buildToolbar
  // semantics where showPanelManager/showTemplateSelect/showBusinessSelect
  // surface their own buttons regardless of `buttons` prop.
  const isOptIn =
    id === 'templateSelect' ||
    id === 'businessSelect' ||
    id === 'addPanel' ||
    id === 'removePanel'
  if (!isOptIn && !explicitButtons.value.has(id)) return false
  return showFlagFor(id)
}

function isDisabled(id: ToolbarButtonId): boolean {
  // Sprint 22c TKT-042: imperative disableButton(id) override always wins.
  if (props.disabledButtonIds && props.disabledButtonIds[id]) return true
  switch (id) {
    case 'undo': return !history.canUndo
    case 'redo': return !history.canRedo
    case 'rotate': return !canvas.activePanelId
    case 'removePanel':
      return canvas.panels.length <= 1 || !canvas.activePanelId
    case 'zoomOut': return canvas.scale <= props.scaleMin
    case 'zoomIn': return canvas.scale >= props.scaleMax
    default:
      return false
  }
}

function labelFor(id: ToolbarButtonId): string {
  // Sprint 22c TKT-043: imperative setButtonText(id, text) override wins
  // over both V1 *ButtonText props and the default emoji label.
  const override = props.labelOverrides ? props.labelOverrides[id] : undefined
  if (typeof override === 'string') return override
  return defaultLabelFor(id)
}

/** Reserved for future templated/themeable labels with HTML. Pure-V3 SFC never
 *  renders HTML labels — returns false to keep the template ergonomics terse. */
function useHtmlFor(_id: ToolbarButtonId): boolean {
  return false
}

const scalePercent = computed<number>(() => Math.round(canvas.scale * 100))

const orderedExtraButtons = computed<readonly ToolbarExtraButton[]>(
  () => props.extraButtons ?? []
)

// ============ Action handlers ============

function handleUndo(): void {
  history.undo()
}

function handleRedo(): void {
  history.redo()
}

function handleSave(): void {
  // V3 fix: Vue 3 auto-listener bridge sets props.onSave whenever the parent
  // binds @save (HiprintDesigner does), so checking `if (props.onSave)` would
  // ALWAYS short-circuit the default download. We treat the listener as an
  // observer (emit fires for it anyway) and only treat `saveHandler` as a
  // true override.
  let json: TemplateJson
  if (props.saveHandler) {
    safeCall(
      props.saveHandler as unknown as (...args: unknown[]) => void,
      [],
      'toolbar.saveHandler'
    )
    json = tpl.getJson()
  } else {
    // Default V1 behavior: mark dirty=false + download template JSON file
    // so the user sees a real "save happened" effect.
    json = tpl.save()
    downloadJson(json, 'template.json')
  }
  emit('save', props.tpl, json, null, undefined, {})
}

/**
 * Trigger a browser download of the JSON template (V1 default save).
 * Uses Blob + anchor click — works in all modern browsers, no library deps.
 */
function downloadJson(data: unknown, filename: string): void {
  if (typeof document === 'undefined') return
  try {
    const text = JSON.stringify(data, null, 2)
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    // Revoke after a tick so Chrome has time to fetch the blob.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (err) {
    console.warn('[hiprint-v3] downloadJson failed:', err)
  }
}

function handlePreview(): void {
  // Same Vue 3 listener-bridge gotcha as handleSave — props.onPreview is
  // truthy when parent binds @preview, so it cannot gate the default. Only
  // `previewHandler` (explicit prop) overrides the default behavior.
  if (props.previewHandler) {
    safeCall(
      props.previewHandler as unknown as (...args: unknown[]) => void,
      [],
      'toolbar.previewHandler'
    )
  } else {
    // V1 default: open a print preview window so user sees real feedback.
    runDefaultPreview()
  }
  emit('preview', props.tpl)
}

/**
 * V1 default preview: open a new window, write the rendered HTML, trigger
 * print dialog. Business code overrides via onPreview prop.
 */
function runDefaultPreview(): void {
  try {
    // tpl.getJson() is the safe accessor; tpl.currentJson is a Pinia computed
    // auto-unwrapped on the store proxy (already a plain value, not a Ref),
    // but using the function avoids the auto-unwrap ambiguity in tests.
    const json = tpl.getJson()
    const html = getPrintHtml(json)
    if (typeof window === 'undefined') return
    const win = window.open('', '_blank', 'width=1024,height=768')
    if (!win) {
      console.warn('[hiprint-v3] preview: window.open blocked (popup?)')
      return
    }
    win.document.open()
    win.document.write(
      '<html><head><title>Print Preview</title></head><body>' +
        html +
        '<script>setTimeout(function(){window.print()},300)<\/script>' +
        '</body></html>'
    )
    win.document.close()
  } catch (err) {
    console.warn('[hiprint-v3] preview failed:', err)
  }
}

function handlePrint(): void {
  // Same Vue 3 listener-bridge gotcha. printHandler (explicit prop) is the
  // only true override; @print listener is observer only.
  if (props.printHandler) {
    safeCall(
      props.printHandler as unknown as (...args: unknown[]) => void,
      [],
      'toolbar.printHandler'
    )
  } else {
    runBrowserPrint()
  }
  emit('print', props.tpl)
}

function runBrowserPrint(): void {
  const json = tpl.currentJson
  void browserPrint(json).catch((err: unknown) => {
    console.warn('[hiprint-v3] toolbar print failed:', err)
  })
}

function handlePdf(): void {
  const json = tpl.currentJson
  void downloadPdf(json).catch((err: unknown) => {
    console.warn('[hiprint-v3] toolbar pdf failed:', err)
  })
}

function handleClear(): void {
  // Default: clear the current template. @clear listener is observer-only;
  // business code that needs confirmation prompts wraps via onClear emit.
  tpl.clear()
  emit('clear', props.tpl)
}

function handleAddPanel(): void {
  const paper = currentPaper()
  canvas.addPanel({
    width: paper.width,
    height: paper.height,
    name: String(canvas.panels.length + 1),
    paperType: paper.label,
  })
  history.pushSnapshot()
  emit('addPanel', props.tpl)
}

function handleRemovePanel(): void {
  const id = canvas.activePanelId
  if (!id) return
  const idx = canvas.panels.findIndex((p) => p.id === id)
  canvas.removePanel(id)
  history.pushSnapshot()
  emit('removePanel', props.tpl, idx)
}

function handleSwitchPanel(idx: number): void {
  const panel = canvas.panels[idx]
  if (!panel) return
  canvas.setActivePanel(panel.id)
  emit('switchPanel', props.tpl, idx)
}

/**
 * TB-004 — Custom paper popover submit handler. Converts user-entered mm
 * → pt (Panel.width/height unit) and patches the active panel via
 * `canvas.updatePanel` (Sprint 22a prep, already in store). Marks
 * `paperType: 'custom'` so the paper select no longer drives the size.
 */
function onCustomPaperSubmit(p: { width: number; height: number }): void {
  const id = canvas.activePanelId
  if (!id) {
    customPaperOpen.value = false
    return
  }
  const wPt = (p.width / 25.4) * 72
  const hPt = (p.height / 25.4) * 72
  canvas.updatePanel(id, {
    width: wPt,
    height: hPt,
    paperType: 'custom',
  })
  history.pushSnapshot()
  customPaperOpen.value = false
}

function handlePaperChange(label: string): void {
  selectedPaperLabel.value = label
  const paper = currentPaper()
  const panelId = canvas.activePanelId
  if (!panelId) return
  const idx = canvas.panels.findIndex((p) => p.id === panelId)
  if (idx < 0) return
  const panel = canvas.panels[idx]
  if (!panel) return
  const nextPanels = canvas.panels.slice()
  nextPanels[idx] = {
    ...panel,
    width: paper.width,
    height: paper.height,
    paperType: paper.label,
  }
  canvas.panels = nextPanels
  history.pushSnapshot()
  emit('paperChange', props.tpl, paper.label, { width: paper.width, height: paper.height })
}

function currentPaper(): ToolbarPaperType {
  const found = props.paperTypes.find((p) => p.label === selectedPaperLabel.value)
  if (found) return found
  if (props.paperTypes.length > 0) return props.paperTypes[0]!
  return { label: 'A4', width: 210, height: 297 }
}

function handleZoomIn(): void {
  canvas.setScale(canvas.scale + props.scaleStep)
  fireScaleChange()
}

function handleZoomOut(): void {
  canvas.setScale(canvas.scale - props.scaleStep)
  fireScaleChange()
}

function handleZoomReset(): void {
  canvas.setScale(1)
  fireScaleChange()
}

function fireScaleChange(): void {
  emit('scaleChange', props.tpl, canvas.scale)
}

function handleRotate(): void {
  const panelId = canvas.activePanelId
  if (!panelId) return
  const idx = canvas.panels.findIndex((p) => p.id === panelId)
  if (idx < 0) return
  const panel = canvas.panels[idx]
  if (!panel) return
  const nextPanels = canvas.panels.slice()
  nextPanels[idx] = {
    ...panel,
    width: panel.height,
    height: panel.width,
  }
  canvas.panels = nextPanels
  history.pushSnapshot()
  emit('rotate', props.tpl)
}

// Sprint 22d TKT-158: `handleAlign` removed from toolbar. Alignment is now
// surfaced exclusively from the element right-click contextmenu (≥2 selected)
// via `interactions/context-menu.ts`, which calls `template.alignElements()`
// + `template.distributeElements()` on the compat PrintTemplate. The `align`
// emit signature is retained on this component for V1 toolbar parity with
// any downstream listeners that still subscribe.

function handleToggleGrid(): void {
  gridVisible.value = !gridVisible.value
  emit('toggleGrid', gridVisible.value)
}

function handleToggleRuler(): void {
  rulerVisible.value = !rulerVisible.value
  emit('toggleRuler', rulerVisible.value)
}

function handleTemplateSelectClick(): void {
  emit('templateSelectClick', props.tpl)
}

function handleBusinessSelectClick(): void {
  emit('businessSelectClick', props.tpl)
}

function handleExtraButtonClick(btn: ToolbarExtraButton, event: Event): void {
  if (typeof btn.onClick === 'function') {
    safeCall(
      btn.onClick as unknown as (...args: unknown[]) => void,
      [props.tpl, event],
      'toolbar.extraButtons[' + btn.key + '].onClick'
    )
  }
}

// ============ Minimal defineExpose (DOM accessor only) ============

defineExpose({
  /** Root toolbar DOM ref for compat layer getToolbarElement() lookup. */
  getRootEl(): HTMLElement | null {
    return toolbarRootEl.value
  },
})
</script>

<template>
  <div
    ref="toolbarRootEl"
    class="hiprint-toolbar"
    role="toolbar"
    aria-label="Designer toolbar"
  >
    <!-- Extra buttons (start position) -->
    <template v-if="extraPosition === 'start'">
      <button
        v-for="btn in orderedExtraButtons"
        :key="'extra-start-' + btn.key"
        v-show="btn.visible !== false"
        type="button"
        class="hiprint-toolbar-btn"
        :class="btn.className"
        :disabled="btn.disabled === true"
        :aria-label="btn.label ?? btn.key"
        @click="handleExtraButtonClick(btn, $event)"
      >
        <span v-if="btn.html" v-html="btn.html" />
        <template v-else>{{ btn.label ?? btn.key }}</template>
      </button>
      <span
        v-if="orderedExtraButtons.length > 0"
        class="hiprint-toolbar-sep"
        aria-hidden="true"
      />
    </template>

    <button
      v-if="isShown('undo')"
      type="button"
      class="hiprint-toolbar-btn"
      :disabled="isDisabled('undo')"
      aria-label="Undo"
      @click="handleUndo"
    >
      <span v-if="useHtmlFor('undo')" v-html="labelFor('undo')" />
      <template v-else>{{ labelFor('undo') }}</template>
    </button>
    <button
      v-if="isShown('redo')"
      type="button"
      class="hiprint-toolbar-btn"
      :disabled="isDisabled('redo')"
      aria-label="Redo"
      @click="handleRedo"
    >
      <span v-if="useHtmlFor('redo')" v-html="labelFor('redo')" />
      <template v-else>{{ labelFor('redo') }}</template>
    </button>

    <span class="hiprint-toolbar-sep" aria-hidden="true" />

    <button
      v-if="isShown('templateSelect')"
      type="button"
      class="hiprint-toolbar-btn"
      :disabled="isDisabled('templateSelect')"
      aria-label="Templates"
      @click="handleTemplateSelectClick"
    >
      <span v-if="useHtmlFor('templateSelect')" v-html="labelFor('templateSelect')" />
      <template v-else>{{ labelFor('templateSelect') }}</template>
    </button>
    <button
      v-if="isShown('businessSelect')"
      type="button"
      class="hiprint-toolbar-btn"
      :disabled="isDisabled('businessSelect')"
      aria-label="Business"
      @click="handleBusinessSelectClick"
    >
      <span v-if="useHtmlFor('businessSelect')" v-html="labelFor('businessSelect')" />
      <template v-else>{{ labelFor('businessSelect') }}</template>
    </button>

    <button
      v-if="isShown('save')"
      type="button"
      class="hiprint-toolbar-btn"
      :disabled="isDisabled('save')"
      aria-label="Save"
      @click="handleSave"
    >
      <span v-if="useHtmlFor('save')" v-html="labelFor('save')" />
      <template v-else>{{ labelFor('save') }}</template>
    </button>
    <button
      v-if="isShown('preview')"
      type="button"
      class="hiprint-toolbar-btn"
      :disabled="isDisabled('preview')"
      aria-label="Preview"
      @click="handlePreview"
    >
      <span v-if="useHtmlFor('preview')" v-html="labelFor('preview')" />
      <template v-else>{{ labelFor('preview') }}</template>
    </button>
    <button
      v-if="isShown('print')"
      type="button"
      class="hiprint-toolbar-btn"
      :disabled="isDisabled('print')"
      aria-label="Print"
      @click="handlePrint"
    >
      <span v-if="useHtmlFor('print')" v-html="labelFor('print')" />
      <template v-else>{{ labelFor('print') }}</template>
    </button>
    <button
      v-if="isShown('pdf')"
      type="button"
      class="hiprint-toolbar-btn"
      :disabled="isDisabled('pdf')"
      aria-label="Download PDF"
      @click="handlePdf"
    >
      <span v-if="useHtmlFor('pdf')" v-html="labelFor('pdf')" />
      <template v-else>{{ labelFor('pdf') }}</template>
    </button>
    <button
      v-if="isShown('clear')"
      type="button"
      class="hiprint-toolbar-btn"
      :disabled="isDisabled('clear')"
      aria-label="Clear template"
      @click="handleClear"
    >
      <span v-if="useHtmlFor('clear')" v-html="labelFor('clear')" />
      <template v-else>{{ labelFor('clear') }}</template>
    </button>

    <span class="hiprint-toolbar-sep" aria-hidden="true" />

    <label v-if="isShown('paper')" class="hiprint-toolbar-paper">
      <span class="hiprint-toolbar-label">Paper</span>
      <select
        class="hiprint-toolbar-select"
        aria-label="Paper size"
        :value="selectedPaperLabel"
        @change="
          handlePaperChange(($event.target as HTMLSelectElement).value)
        "
      >
        <option
          v-for="p in paperTypes"
          :key="p.label"
          :value="p.label"
        >
          {{ p.label }}
        </option>
      </select>
      <button
        v-if="showCustomPaper"
        type="button"
        class="hiprint-toolbar-btn"
        aria-label="Custom paper size"
        :aria-expanded="customPaperOpen"
        @click="customPaperOpen = !customPaperOpen"
      >⚙</button>
      <CustomPaperPopover
        v-if="showCustomPaper"
        :open="customPaperOpen"
        :initial-width="canvas.activePanel?.width"
        :initial-height="canvas.activePanel?.height"
        @submit="onCustomPaperSubmit"
        @close="customPaperOpen = false"
      />
    </label>

    <button
      v-if="isShown('rotate')"
      type="button"
      class="hiprint-toolbar-btn"
      aria-label="Rotate paper"
      :disabled="isDisabled('rotate')"
      @click="handleRotate"
    >
      <span v-if="useHtmlFor('rotate')" v-html="labelFor('rotate')" />
      <template v-else>{{ labelFor('rotate') }}</template>
    </button>

    <span class="hiprint-toolbar-sep" aria-hidden="true" />

    <!-- TB-003: Panel manager chip list (replaces the V3 P21 <select>) — each
         chip is a button with aria-pressed reflecting active state for AT
         users. Renders only when at least one panel exists.
         TKT-254: when panelManagerMode='select', render the V1-style <select>
         dropdown instead (compact for many-panel docs). -->
    <span
      v-if="showPanelManager && canvas.panels.length > 0 && panelManagerMode === 'chips'"
      class="hiprint-toolbar-panel-chips"
      role="group"
      aria-label="Active panel"
    >
      <span v-if="panelManagerLabel" class="hiprint-toolbar-label">
        {{ panelManagerLabel }}
      </span>
      <button
        v-for="(p, i) in canvas.panels"
        :key="p.id"
        type="button"
        class="hiprint-toolbar-chip"
        :class="{
          'is-active': p.id === canvas.activePanelId,
          active: p.id === canvas.activePanelId,
        }"
        :aria-pressed="p.id === canvas.activePanelId"
        @click="handleSwitchPanel(i)"
      >
        {{ p.name || (i + 1) }}
      </button>
    </span>
    <!-- TKT-254 — V1-parity <select> panel switcher. Single dropdown with
         all panels; selecting an option switches the active panel. Uses the
         panel index as option value so the @change handler can look it up
         deterministically (handleSwitchPanel takes an index). -->
    <label
      v-else-if="showPanelManager && canvas.panels.length > 0 && panelManagerMode === 'select'"
      class="hiprint-toolbar-panel-manager"
    >
      <span v-if="panelManagerLabel" class="hiprint-toolbar-label">
        {{ panelManagerLabel }}
      </span>
      <select
        class="hiprint-toolbar-select hiprint-toolbar-panel-select"
        aria-label="Active panel"
        :value="canvas.panels.findIndex((p) => p.id === canvas.activePanelId)"
        @change="
          handleSwitchPanel(
            Number(($event.target as HTMLSelectElement).value)
          )
        "
      >
        <option
          v-for="(p, i) in canvas.panels"
          :key="p.id"
          :value="i"
        >
          {{ p.name || (i + 1) }}
        </option>
      </select>
    </label>

    <!-- Sprint 22a-r TKT-012: TB-006 inline pagination bar removed. V1 has no
         toolbar pagination — panel chip switcher (TB-003 above) is the only
         in-toolbar panel selector. V1's `.hiprint-printPagination` is a
         bottom-strip concept handled by `<HiprintCanvas>`, not the toolbar. -->

    <button
      v-if="isShown('addPanel')"
      type="button"
      class="hiprint-toolbar-btn"
      :disabled="isDisabled('addPanel')"
      aria-label="Add panel"
      @click="handleAddPanel"
    >
      <span v-if="useHtmlFor('addPanel')" v-html="labelFor('addPanel')" />
      <template v-else>{{ labelFor('addPanel') }}</template>
    </button>
    <button
      v-if="isShown('removePanel')"
      type="button"
      class="hiprint-toolbar-btn"
      aria-label="Remove panel"
      :disabled="isDisabled('removePanel')"
      @click="handleRemovePanel"
    >
      <span v-if="useHtmlFor('removePanel')" v-html="labelFor('removePanel')" />
      <template v-else>{{ labelFor('removePanel') }}</template>
    </button>

    <span class="hiprint-toolbar-sep" aria-hidden="true" />

    <button
      v-if="isShown('zoomOut')"
      type="button"
      class="hiprint-toolbar-btn"
      aria-label="Zoom out"
      :disabled="isDisabled('zoomOut')"
      @click="handleZoomOut"
    >
      <span v-if="useHtmlFor('zoomOut')" v-html="labelFor('zoomOut')" />
      <template v-else>{{ labelFor('zoomOut') }}</template>
    </button>
    <button
      v-if="isShown('zoomReset')"
      type="button"
      class="hiprint-toolbar-btn"
      aria-label="Reset zoom"
      @click="handleZoomReset"
    >
      {{ scalePercent }}%
    </button>
    <button
      v-if="isShown('zoomIn')"
      type="button"
      class="hiprint-toolbar-btn"
      aria-label="Zoom in"
      :disabled="isDisabled('zoomIn')"
      @click="handleZoomIn"
    >
      <span v-if="useHtmlFor('zoomIn')" v-html="labelFor('zoomIn')" />
      <template v-else>{{ labelFor('zoomIn') }}</template>
    </button>

    <span class="hiprint-toolbar-sep" aria-hidden="true" />

    <button
      v-if="isShown('gridToggle')"
      type="button"
      class="hiprint-toolbar-btn"
      :class="{ 'is-active': gridVisible, active: gridVisible }"
      :aria-pressed="gridVisible"
      aria-label="Toggle grid"
      @click="handleToggleGrid"
    >
      <span v-if="useHtmlFor('gridToggle')" v-html="labelFor('gridToggle')" />
      <template v-else>{{ labelFor('gridToggle') }}</template>
    </button>
    <button
      v-if="isShown('rulerToggle')"
      type="button"
      class="hiprint-toolbar-btn"
      :class="{ 'is-active': rulerVisible, active: rulerVisible }"
      :aria-pressed="rulerVisible"
      aria-label="Toggle ruler"
      @click="handleToggleRuler"
    >
      <span v-if="useHtmlFor('rulerToggle')" v-html="labelFor('rulerToggle')" />
      <template v-else>{{ labelFor('rulerToggle') }}</template>
    </button>

    <!--
      Sprint 22d TKT-158: align/distribute buttons removed from the toolbar
      (V1 parity — V1 inventory `toolbar-and-shell.md` §1.21/§1.22 confirms
      V1 only renders alignment in the element right-click contextmenu). The
      6 align + 2 distribute items now live in `interactions/context-menu.ts`
      and only appear when ≥2 elements are selected.
    -->

    <!-- Extra buttons (end position; default) -->
    <template v-if="extraPosition !== 'start' && orderedExtraButtons.length > 0">
      <span class="hiprint-toolbar-sep" aria-hidden="true" />
      <button
        v-for="btn in orderedExtraButtons"
        :key="'extra-end-' + btn.key"
        v-show="btn.visible !== false"
        type="button"
        class="hiprint-toolbar-btn"
        :class="btn.className"
        :disabled="btn.disabled === true"
        :aria-label="btn.label ?? btn.key"
        @click="handleExtraButtonClick(btn, $event)"
      >
        <span v-if="btn.html" v-html="btn.html" />
        <template v-else>{{ btn.label ?? btn.key }}</template>
      </button>
    </template>
  </div>
</template>

<style scoped>
.hiprint-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 8px;
  background: var(--hiprint-bg-toolbar, #fafafa);
  border-bottom: 1px solid var(--hiprint-divider, #e5e5e5);
  font-size: 12px;
  user-select: none;
}

.hiprint-toolbar-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  height: 28px;
  background: var(--hiprint-bg, #fff);
  border: 1px solid var(--hiprint-border, #d9d9d9);
  border-radius: var(--hiprint-radius, 4px);
  color: var(--hiprint-fg, #333);
  cursor: pointer;
  font: inherit;
  line-height: 1;
  transition: background 120ms ease, border-color 120ms ease;
}

.hiprint-toolbar-btn:hover:not(:disabled) {
  background: var(--hiprint-bg-hover, #f0f0f0);
  border-color: var(--hiprint-border-hover, #b3b3b3);
}

.hiprint-toolbar-btn:focus-visible {
  outline: 2px solid var(--hiprint-selection-outline, #409eff);
  outline-offset: 1px;
}

.hiprint-toolbar-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* TKT-250 / TKT-251 — active-state co-emits both `.is-active` (BEM-style)
 * and `.active` (V1 legacy) so business CSS keyed to either selector still
 * fires. See V1-INVENTORY/styles.md §1.7 + parity matrix §G. */
.hiprint-toolbar-btn.is-active,
.hiprint-toolbar-btn.active {
  background: var(--hiprint-selection-bg, #e6f4ff);
  border-color: var(--hiprint-selection-outline, #409eff);
  color: var(--hiprint-primary, #1677ff);
}

/* TKT-258 — primary / danger button variants (V1 §1.7). Caller can flip a
 * toolbar button into primary or danger styling via `className` on extra
 * buttons — these classes are public-API and stable. */
.hiprint-toolbar-btn-primary,
.hiprint-toolbar-btn.hiprint-toolbar-btn-primary {
  background: var(--hiprint-primary, #1677ff);
  border-color: var(--hiprint-primary, #1677ff);
  color: #fff;
}
.hiprint-toolbar-btn-primary:hover:not(:disabled),
.hiprint-toolbar-btn.hiprint-toolbar-btn-primary:hover:not(:disabled) {
  background: var(--hiprint-primary-hover, #4096ff);
  border-color: var(--hiprint-primary-hover, #4096ff);
}
.hiprint-toolbar-btn-danger,
.hiprint-toolbar-btn.hiprint-toolbar-btn-danger {
  background: var(--hiprint-danger, #ff4d4f);
  border-color: var(--hiprint-danger, #ff4d4f);
  color: #fff;
}
.hiprint-toolbar-btn-danger:hover:not(:disabled),
.hiprint-toolbar-btn.hiprint-toolbar-btn-danger:hover:not(:disabled) {
  filter: brightness(0.92);
}

.hiprint-toolbar-sep {
  display: inline-block;
  width: 1px;
  height: 18px;
  background: var(--hiprint-border, #d9d9d9);
  margin: 0 4px;
}

.hiprint-toolbar-paper,
.hiprint-toolbar-panel-manager {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* Paper label is the anchor for the absolutely-positioned custom paper
 * popover (TB-004) — position:relative is required so the popover stays
 * aligned to the paper select dropdown. */
.hiprint-toolbar-paper {
  position: relative;
}

/* TB-003: Panel chip list — rounded-pill buttons with active highlight. */
.hiprint-toolbar-panel-chips {
  display: inline-flex;
  gap: 4px;
  align-items: center;
}

.hiprint-toolbar-chip {
  padding: 2px 10px;
  border: 1px solid var(--hiprint-border, #d9d9d9);
  background: var(--hiprint-bg, #fff);
  cursor: pointer;
  border-radius: var(--hiprint-radius-chip, 12px);
  font: inherit;
  color: var(--hiprint-fg, #333);
  line-height: 1.6;
}

.hiprint-toolbar-chip:hover {
  background: var(--hiprint-bg-hover, #f0f0f0);
}

.hiprint-toolbar-chip:focus-visible {
  outline: 2px solid var(--hiprint-selection-outline, #409eff);
  outline-offset: 1px;
}

/* TKT-250 — co-emit BEM (`.is-active`) and V1 legacy (`.active`). */
.hiprint-toolbar-chip.is-active,
.hiprint-toolbar-chip.active {
  background: var(--hiprint-primary, #1677ff);
  color: #fff;
  border-color: var(--hiprint-primary, #1677ff);
}

.hiprint-toolbar-label {
  color: var(--hiprint-fg-muted, #666);
}

.hiprint-toolbar-select {
  height: 28px;
  padding: 0 6px;
  border: 1px solid var(--hiprint-border, #d9d9d9);
  border-radius: var(--hiprint-radius, 4px);
  background: var(--hiprint-bg, #fff);
  font: inherit;
}

.hiprint-toolbar-select:focus-visible {
  outline: 2px solid var(--hiprint-selection-outline, #409eff);
  outline-offset: 1px;
}
</style>
