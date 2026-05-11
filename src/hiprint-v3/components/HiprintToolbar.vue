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
 *     paperTypes, scaleMin/Max/Step, alignItems, extraButtons, extraPosition,
 *     panelManagerLabel, addPanelButtonText.
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
  | 'alignLeft'
  | 'alignCenter'
  | 'alignRight'
  | 'alignTop'
  | 'alignMiddle'
  | 'alignBottom'
  | 'templateSelect'
  | 'businessSelect'

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
  /** Subset of buttons to show. Default: all 22 standard buttons. */
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
  showAlign?: boolean
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
  // ---- Align customisation ----
  alignItems?: readonly ToolbarAlignType[]
  // ---- Extra buttons ----
  extraButtons?: readonly ToolbarExtraButton[]
  extraPosition?: 'start' | 'end'
}

const props = withDefaults(defineProps<Props>(), {
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
    'alignLeft',
    'alignCenter',
    'alignRight',
    'alignTop',
    'alignMiddle',
    'alignBottom',
  ],
  paperTypes: () => [
    { label: 'A3', width: 297, height: 420 },
    { label: 'A4', width: 210, height: 297 },
    { label: 'A5', width: 148, height: 210 },
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
  showAlign: true,
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
  alignItems: () => ['left', 'center', 'right', 'top', 'middle', 'bottom'],
  extraButtons: () => [],
  extraPosition: 'end',
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
  alignLeft: '⊣ L',
  alignCenter: '☰ C',
  alignRight: '⊢ R',
  alignTop: '⊤ T',
  alignMiddle: '☱ M',
  alignBottom: '⊥ B',
  templateSelect: '📋 Templates',
  businessSelect: '🏷 Business',
}

function defaultLabelFor(key: string): string {
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
    case 'alignLeft':
    case 'alignCenter':
    case 'alignRight':
    case 'alignTop':
    case 'alignMiddle':
    case 'alignBottom':
      return props.showAlign && alignSet.value.has(stripAlignPrefix(key))
    case 'templateSelect':
      return props.showTemplateSelect
    case 'businessSelect':
      return props.showBusinessSelect
    default:
      return true
  }
}

const alignSet = computed<Set<ToolbarAlignType>>(
  () => new Set(props.alignItems)
)

function stripAlignPrefix(key: string): ToolbarAlignType {
  return key.replace(/^align/, '').toLowerCase() as ToolbarAlignType
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
  switch (id) {
    case 'undo': return !history.canUndo
    case 'redo': return !history.canRedo
    case 'rotate': return !canvas.activePanelId
    case 'removePanel':
      return canvas.panels.length <= 1 || !canvas.activePanelId
    case 'zoomOut': return canvas.scale <= props.scaleMin
    case 'zoomIn': return canvas.scale >= props.scaleMax
    case 'alignLeft':
    case 'alignCenter':
    case 'alignRight':
    case 'alignTop':
    case 'alignMiddle':
    case 'alignBottom':
      return canvas.selectedElementIds.size === 0
    default:
      return false
  }
}

function labelFor(id: ToolbarButtonId): string {
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
  if (props.onSave) {
    // Emit takes care of invoking the onSave prop (Vue 3 auto-listener bridge).
    const json = tpl.getJson()
    emit('save', props.tpl, json, null, undefined, {})
  } else if (props.saveHandler) {
    safeCall(
      props.saveHandler as unknown as (...args: unknown[]) => void,
      [],
      'toolbar.saveHandler'
    )
    emit('save', props.tpl, tpl.getJson(), null, undefined, {})
  } else {
    // V1 default behavior: mark dirty=false + download template JSON as a
    // file. Business code overrides via onSave / saveHandler prop.
    const json = tpl.save()
    downloadJson(json, 'template.json')
    emit('save', props.tpl, json, null, undefined, {})
  }
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
  if (!props.onPreview && props.previewHandler) {
    safeCall(
      props.previewHandler as unknown as (...args: unknown[]) => void,
      [],
      'toolbar.previewHandler'
    )
  } else if (!props.onPreview && !props.previewHandler) {
    // V1 default behavior: open a print-preview window via window.print on a
    // new tab populated with renderTemplate output. Business code overrides
    // via onPreview / previewHandler.
    runDefaultPreview()
  }
  // Emit invokes onPreview prop (auto-listener bridge) with V1 signature.
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
  if (!props.onPrint) {
    if (props.printHandler) {
      safeCall(
        props.printHandler as unknown as (...args: unknown[]) => void,
        [],
        'toolbar.printHandler'
      )
    } else {
      runBrowserPrint()
    }
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
  if (!props.onClear) {
    tpl.clear()
  }
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

function handleAlign(type: ToolbarAlignType): void {
  const ids = canvas.selectedElementIds
  if (ids.size === 0) {
    emit('align', props.tpl, type)
    return
  }
  const selected = canvas.selectedElements
  if (selected.length === 0) {
    emit('align', props.tpl, type)
    return
  }
  const lefts: number[] = []
  const tops: number[] = []
  const rights: number[] = []
  const bottoms: number[] = []
  for (const el of selected) {
    const o = el.options as Record<string, unknown>
    const left = Number(o.left ?? 0)
    const top = Number(o.top ?? 0)
    const width = Number(o.width ?? 0)
    const height = Number(o.height ?? 0)
    lefts.push(left)
    tops.push(top)
    rights.push(left + width)
    bottoms.push(top + height)
  }
  const anchor = {
    left: Math.min(...lefts),
    right: Math.max(...rights),
    top: Math.min(...tops),
    bottom: Math.max(...bottoms),
  }
  const centerX = (anchor.left + anchor.right) / 2
  const centerY = (anchor.top + anchor.bottom) / 2
  const panelId = canvas.activePanelId
  if (!panelId) {
    emit('align', props.tpl, type)
    return
  }
  for (const el of selected) {
    const o = el.options as Record<string, unknown>
    const width = Number(o.width ?? 0)
    const height = Number(o.height ?? 0)
    let nextLeft = Number(o.left ?? 0)
    let nextTop = Number(o.top ?? 0)
    switch (type) {
      case 'left':
        nextLeft = anchor.left
        break
      case 'center':
        nextLeft = centerX - width / 2
        break
      case 'right':
        nextLeft = anchor.right - width
        break
      case 'top':
        nextTop = anchor.top
        break
      case 'middle':
        nextTop = centerY - height / 2
        break
      case 'bottom':
        nextTop = anchor.bottom - height
        break
    }
    canvas.updateElement(panelId, el.id, {
      options: { left: nextLeft, top: nextTop },
    })
  }
  history.pushSnapshot()
  emit('align', props.tpl, type)
}

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

    <!-- Panel manager dropdown (showPanelManager) — multi-panel switcher -->
    <span
      v-if="showPanelManager && canvas.panels.length > 0"
      class="hiprint-toolbar-panel-manager"
    >
      <span v-if="panelManagerLabel" class="hiprint-toolbar-label">
        {{ panelManagerLabel }}
      </span>
      <select
        class="hiprint-toolbar-select"
        aria-label="Active panel"
        :value="canvas.activePanelId ?? ''"
        @change="
          handleSwitchPanel(
            canvas.panels.findIndex(
              (p) => p.id === ($event.target as HTMLSelectElement).value
            )
          )
        "
      >
        <option
          v-for="(p, i) in canvas.panels"
          :key="p.id"
          :value="p.id"
        >
          {{ p.name ?? '第 ' + (i + 1) + ' 页' }}
        </option>
      </select>
    </span>

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
      :class="{ 'is-active': gridVisible }"
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
      :class="{ 'is-active': rulerVisible }"
      :aria-pressed="rulerVisible"
      aria-label="Toggle ruler"
      @click="handleToggleRuler"
    >
      <span v-if="useHtmlFor('rulerToggle')" v-html="labelFor('rulerToggle')" />
      <template v-else>{{ labelFor('rulerToggle') }}</template>
    </button>

    <span class="hiprint-toolbar-sep" aria-hidden="true" />

    <button
      v-if="isShown('alignLeft')"
      type="button"
      class="hiprint-toolbar-btn"
      aria-label="Align left"
      :disabled="isDisabled('alignLeft')"
      @click="handleAlign('left')"
    >
      <span v-if="useHtmlFor('alignLeft')" v-html="labelFor('alignLeft')" />
      <template v-else>{{ labelFor('alignLeft') }}</template>
    </button>
    <button
      v-if="isShown('alignCenter')"
      type="button"
      class="hiprint-toolbar-btn"
      aria-label="Align center"
      :disabled="isDisabled('alignCenter')"
      @click="handleAlign('center')"
    >
      <span v-if="useHtmlFor('alignCenter')" v-html="labelFor('alignCenter')" />
      <template v-else>{{ labelFor('alignCenter') }}</template>
    </button>
    <button
      v-if="isShown('alignRight')"
      type="button"
      class="hiprint-toolbar-btn"
      aria-label="Align right"
      :disabled="isDisabled('alignRight')"
      @click="handleAlign('right')"
    >
      <span v-if="useHtmlFor('alignRight')" v-html="labelFor('alignRight')" />
      <template v-else>{{ labelFor('alignRight') }}</template>
    </button>
    <button
      v-if="isShown('alignTop')"
      type="button"
      class="hiprint-toolbar-btn"
      aria-label="Align top"
      :disabled="isDisabled('alignTop')"
      @click="handleAlign('top')"
    >
      <span v-if="useHtmlFor('alignTop')" v-html="labelFor('alignTop')" />
      <template v-else>{{ labelFor('alignTop') }}</template>
    </button>
    <button
      v-if="isShown('alignMiddle')"
      type="button"
      class="hiprint-toolbar-btn"
      aria-label="Align middle"
      :disabled="isDisabled('alignMiddle')"
      @click="handleAlign('middle')"
    >
      <span v-if="useHtmlFor('alignMiddle')" v-html="labelFor('alignMiddle')" />
      <template v-else>{{ labelFor('alignMiddle') }}</template>
    </button>
    <button
      v-if="isShown('alignBottom')"
      type="button"
      class="hiprint-toolbar-btn"
      aria-label="Align bottom"
      :disabled="isDisabled('alignBottom')"
      @click="handleAlign('bottom')"
    >
      <span v-if="useHtmlFor('alignBottom')" v-html="labelFor('alignBottom')" />
      <template v-else>{{ labelFor('alignBottom') }}</template>
    </button>

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
  background: #fafafa;
  border-bottom: 1px solid #e5e5e5;
  font-size: 12px;
  user-select: none;
}

.hiprint-toolbar-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  height: 28px;
  background: #fff;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  color: #333;
  cursor: pointer;
  font: inherit;
  line-height: 1;
  transition: background 120ms ease, border-color 120ms ease;
}

.hiprint-toolbar-btn:hover:not(:disabled) {
  background: #f0f0f0;
  border-color: #b3b3b3;
}

.hiprint-toolbar-btn:focus-visible {
  outline: 2px solid #409eff;
  outline-offset: 1px;
}

.hiprint-toolbar-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.hiprint-toolbar-btn.is-active {
  background: #e6f4ff;
  border-color: #409eff;
  color: #1677ff;
}

.hiprint-toolbar-sep {
  display: inline-block;
  width: 1px;
  height: 18px;
  background: #d9d9d9;
  margin: 0 4px;
}

.hiprint-toolbar-paper,
.hiprint-toolbar-panel-manager {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.hiprint-toolbar-label {
  color: #666;
}

.hiprint-toolbar-select {
  height: 28px;
  padding: 0 6px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: #fff;
  font: inherit;
}

.hiprint-toolbar-select:focus-visible {
  outline: 2px solid #409eff;
  outline-offset: 1px;
}
</style>
