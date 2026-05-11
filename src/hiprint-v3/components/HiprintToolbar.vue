<script setup lang="ts">
/**
 * HiprintToolbar.vue — V3 designer toolbar (P18.2).
 *
 * Replaces V2 `buildToolbar` (V1 buildToolbar adapter, V1 bundle.js line
 * 13305-14857) with a Vue 3 SFC that binds buttons directly to Pinia store
 * actions (canvas / history / template). No jQuery, no DOM mutation.
 *
 * V1/V2 references (read-only):
 *  - src/hiprint-v2/ui/toolbar.js (V2 adapter)
 *  - src/hiprint/hiprint.bundle.js line 13305+ (V1 buildToolbar opts seed)
 *
 * Button mapping (V1 opts → V3 actions):
 *  - showPreview / onPreview        → handlePreview (custom override or noop)
 *  - showPrint / onPrint            → handlePrint  → browserPrint(json)
 *  - showSave / onSave              → handleSave   → template.save()
 *  - showClear                      → handleClear  → template.clear()
 *  - showPaperSelect                → handlePaperChange → canvas.updateElement on active panel
 *  - showScale                      → handleZoomIn/Out → canvas.setScale
 *  - showRotate                     → handleRotate → patches active panel rotate
 *  - showAlign                      → handleAlign(type) → align selected elements
 *  - showPanelManager / onAddPanel  → handleAddPanel/Remove → canvas.addPanel/removePanel
 *  - showRuler / showGrid           → toggle local UI flags (ruler/grid CSS)
 *  - undo / redo                    → history.undo / redo
 *
 * P18.2 emits onPreview/onPrint/onSave/onPaperChange/onScaleChange/onAddPanel
 * via either: (a) explicit props (override default behavior) or (b) component
 * events (default behavior runs AND we emit so business can observe).
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
import { browserPrint, downloadPdf } from '@hiprint-v3/print'

// ============ Props / Emits ============

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

interface Props {
  /** Subset of buttons to show. Default: all 22 buttons. */
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
   * Override default Preview behavior. If supplied, default is skipped (we
   * still emit `preview` event for observability).
   *
   * NOTE: named `previewHandler` (not `onPreview`) so Vue does not treat it
   * as a listener auto-bound from `@preview` emits — that would cause the
   * override to run twice on every click.
   */
  previewHandler?: () => void
  /** Override default Print behavior. */
  printHandler?: () => void
  /** Override default Save behavior. */
  saveHandler?: () => void
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
  previewHandler: undefined,
  printHandler: undefined,
  saveHandler: undefined,
})

interface Emits {
  (e: 'preview'): void
  (e: 'print'): void
  (e: 'save'): void
  (e: 'clear'): void
  (e: 'paperChange', paper: ToolbarPaperType): void
  (e: 'scaleChange', scale: number): void
  (e: 'addPanel'): void
  (e: 'removePanel', panelId: string): void
  (e: 'rotate', panelId: string): void
  (e: 'align', type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'): void
  (e: 'toggleGrid', visible: boolean): void
  (e: 'toggleRuler', visible: boolean): void
}
const emit = defineEmits<Emits>()

// ============ Stores ============

const canvas = useCanvasStore()
const history = useHistoryStore()
const tpl = useTemplateStore()

// ============ Local UI state ============

const selectedPaperLabel = ref<string>(props.defaultPaper)
const gridVisible = ref<boolean>(true)
const rulerVisible = ref<boolean>(true)

// ============ Derived ============

const visible = computed<Set<ToolbarButtonId>>(() => new Set(props.buttons))

function isShown(id: ToolbarButtonId): boolean {
  return visible.value.has(id)
}

const scalePercent = computed<number>(() => Math.round(canvas.scale * 100))

// ============ Action handlers ============

function handleUndo(): void {
  history.undo()
}

function handleRedo(): void {
  history.redo()
}

function handleSave(): void {
  if (props.saveHandler) {
    safeCallOverride(props.saveHandler, 'saveHandler')
  } else {
    tpl.save()
  }
  emit('save')
}

function handlePreview(): void {
  if (props.previewHandler) {
    safeCallOverride(props.previewHandler, 'previewHandler')
  }
  emit('preview')
}

function handlePrint(): void {
  if (props.printHandler) {
    safeCallOverride(props.printHandler, 'printHandler')
  } else {
    runBrowserPrint()
  }
  emit('print')
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
  // tpl.clear wipes canvas + history. UX safety: caller may want a confirm
  // dialog upstream; we just emit so they can intercept.
  tpl.clear()
  emit('clear')
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
  emit('addPanel')
}

function handleRemovePanel(): void {
  const id = canvas.activePanelId
  if (!id) return
  canvas.removePanel(id)
  history.pushSnapshot()
  emit('removePanel', id)
}

function handlePaperChange(label: string): void {
  selectedPaperLabel.value = label
  const paper = currentPaper()
  const panelId = canvas.activePanelId
  if (!panelId) return
  // Patch active panel's width/height via direct mutation of panels array.
  // (canvas store has no setPanelSize action yet; this mirrors how P18.1's
  // canvas component is expected to write back paper dims.)
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
  emit('paperChange', paper)
}

function currentPaper(): ToolbarPaperType {
  const found = props.paperTypes.find((p) => p.label === selectedPaperLabel.value)
  if (found) return found
  if (props.paperTypes.length > 0) return props.paperTypes[0]!
  // Ultimate fallback (paperTypes prop forced to empty array)
  return { label: 'A4', width: 210, height: 297 }
}

function handleZoomIn(): void {
  canvas.setScale(canvas.scale + props.scaleStep)
  emit('scaleChange', canvas.scale)
}

function handleZoomOut(): void {
  canvas.setScale(canvas.scale - props.scaleStep)
  emit('scaleChange', canvas.scale)
}

function handleZoomReset(): void {
  canvas.setScale(1)
  emit('scaleChange', canvas.scale)
}

function handleRotate(): void {
  // V1 onRotate rotates the panel paper (swap width/height).
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
  emit('rotate', panelId)
}

function handleAlign(
  type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'
): void {
  const ids = canvas.selectedElementIds
  if (ids.size === 0) {
    emit('align', type)
    return
  }
  const selected = canvas.selectedElements
  if (selected.length === 0) {
    emit('align', type)
    return
  }
  // Compute anchor from selected bounding box.
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
    emit('align', type)
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
  emit('align', type)
}

function handleToggleGrid(): void {
  gridVisible.value = !gridVisible.value
  emit('toggleGrid', gridVisible.value)
}

function handleToggleRuler(): void {
  rulerVisible.value = !rulerVisible.value
  emit('toggleRuler', rulerVisible.value)
}

// ============ Helpers ============

function safeCallOverride(fn: () => void, label: string): void {
  try {
    fn()
  } catch (err) {
    console.warn('[hiprint-v3] toolbar ' + label + ' threw:', err)
  }
}
</script>

<template>
  <div class="hiprint-toolbar" role="toolbar" aria-label="Designer toolbar">
    <button
      v-if="isShown('undo')"
      type="button"
      class="hiprint-toolbar-btn"
      :disabled="!history.canUndo"
      aria-label="Undo"
      @click="handleUndo"
    >
      ↶ Undo
    </button>
    <button
      v-if="isShown('redo')"
      type="button"
      class="hiprint-toolbar-btn"
      :disabled="!history.canRedo"
      aria-label="Redo"
      @click="handleRedo"
    >
      ↷ Redo
    </button>

    <span class="hiprint-toolbar-sep" aria-hidden="true" />

    <button
      v-if="isShown('save')"
      type="button"
      class="hiprint-toolbar-btn"
      aria-label="Save"
      @click="handleSave"
    >
      💾 Save
    </button>
    <button
      v-if="isShown('preview')"
      type="button"
      class="hiprint-toolbar-btn"
      aria-label="Preview"
      @click="handlePreview"
    >
      👁 Preview
    </button>
    <button
      v-if="isShown('print')"
      type="button"
      class="hiprint-toolbar-btn"
      aria-label="Print"
      @click="handlePrint"
    >
      🖨 Print
    </button>
    <button
      v-if="isShown('pdf')"
      type="button"
      class="hiprint-toolbar-btn"
      aria-label="Download PDF"
      @click="handlePdf"
    >
      📄 PDF
    </button>
    <button
      v-if="isShown('clear')"
      type="button"
      class="hiprint-toolbar-btn"
      aria-label="Clear template"
      @click="handleClear"
    >
      🗑 Clear
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
      :disabled="!canvas.activePanelId"
      @click="handleRotate"
    >
      ⟲ Rotate
    </button>

    <span class="hiprint-toolbar-sep" aria-hidden="true" />

    <button
      v-if="isShown('addPanel')"
      type="button"
      class="hiprint-toolbar-btn"
      aria-label="Add panel"
      @click="handleAddPanel"
    >
      + Panel
    </button>
    <button
      v-if="isShown('removePanel')"
      type="button"
      class="hiprint-toolbar-btn"
      aria-label="Remove panel"
      :disabled="canvas.panels.length <= 1 || !canvas.activePanelId"
      @click="handleRemovePanel"
    >
      − Panel
    </button>

    <span class="hiprint-toolbar-sep" aria-hidden="true" />

    <button
      v-if="isShown('zoomOut')"
      type="button"
      class="hiprint-toolbar-btn"
      aria-label="Zoom out"
      :disabled="canvas.scale <= scaleMin"
      @click="handleZoomOut"
    >
      −
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
      :disabled="canvas.scale >= scaleMax"
      @click="handleZoomIn"
    >
      +
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
      ▦ Grid
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
      ⌖ Ruler
    </button>

    <span class="hiprint-toolbar-sep" aria-hidden="true" />

    <button
      v-if="isShown('alignLeft')"
      type="button"
      class="hiprint-toolbar-btn"
      aria-label="Align left"
      :disabled="canvas.selectedElementIds.size === 0"
      @click="handleAlign('left')"
    >
      ⊣ L
    </button>
    <button
      v-if="isShown('alignCenter')"
      type="button"
      class="hiprint-toolbar-btn"
      aria-label="Align center"
      :disabled="canvas.selectedElementIds.size === 0"
      @click="handleAlign('center')"
    >
      ☰ C
    </button>
    <button
      v-if="isShown('alignRight')"
      type="button"
      class="hiprint-toolbar-btn"
      aria-label="Align right"
      :disabled="canvas.selectedElementIds.size === 0"
      @click="handleAlign('right')"
    >
      ⊢ R
    </button>
    <button
      v-if="isShown('alignTop')"
      type="button"
      class="hiprint-toolbar-btn"
      aria-label="Align top"
      :disabled="canvas.selectedElementIds.size === 0"
      @click="handleAlign('top')"
    >
      ⊤ T
    </button>
    <button
      v-if="isShown('alignMiddle')"
      type="button"
      class="hiprint-toolbar-btn"
      aria-label="Align middle"
      :disabled="canvas.selectedElementIds.size === 0"
      @click="handleAlign('middle')"
    >
      ☱ M
    </button>
    <button
      v-if="isShown('alignBottom')"
      type="button"
      class="hiprint-toolbar-btn"
      aria-label="Align bottom"
      :disabled="canvas.selectedElementIds.size === 0"
      @click="handleAlign('bottom')"
    >
      ⊥ B
    </button>
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

.hiprint-toolbar-paper {
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
