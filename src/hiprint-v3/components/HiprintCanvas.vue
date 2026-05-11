<script setup lang="ts">
/**
 * HiprintCanvas.vue — V3 main editing surface (P18.1).
 *
 * Renders the currently-active panel from the canvas store and dispatches
 * each printElement to the appropriate etype Vue SFC (P17). Installs the
 * designer-wide interaction layer (lasso + keyboard + selection shortcuts).
 *
 * Architectural notes:
 *  - Only the ACTIVE panel is rendered here. Multi-panel designers cycle the
 *    active panel via canvas.setActivePanel; rendering one paper at a time
 *    matches V1/V2's editingPanel concept (state-modeler R3 Invariant #10).
 *  - HiprintPreview is the read-only multi-panel surface (mounts a detached
 *    DOM from print/render.ts).
 *  - Element dispatch happens via a static map (componentForType). Unknown
 *    types fall back to TextElement so legacy/unknown tids still render
 *    something instead of crashing.
 *
 * Interaction install order:
 *  1. enableDesignerKeyboard() — window-scoped (delete/arrow/copy/paste/undo)
 *  2. enableSelectionShortcuts() — window-scoped (Ctrl+A / Escape)
 *  3. enableLasso(paperEl, panelId) — per-active-panel, re-attached on change
 *
 * Drag/drop/resize/click-selection are installed by individual ElementWrapper
 * components (P17.0) so we don't double-bind here.
 *
 * Lifecycle:
 *  - Each cleanup fn captured into a let — disposed onBeforeUnmount AND when
 *    the active panel changes (lasso re-binds to the new paper element).
 */
import { computed, onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue'
import { useCanvasStore } from '@hiprint-v3/stores'
import {
  buildElementContextItems,
  enableDesignerKeyboard,
  enableLasso,
  enableSelectionShortcuts,
  openContextMenu,
  type ContextMenuController,
} from '@hiprint-v3/interactions'
import {
  TextElement,
  ImageElement,
  LongTextElement,
  BarcodeElement,
  QrcodeElement,
  HtmlElement,
  HlineElement,
  VlineElement,
  RectElement,
  OvalElement,
  TableElement,
} from './elements'
import HiprintPanel from './HiprintPanel.vue'

const props = withDefaults(
  defineProps<{
    /** Bound business data — forwarded to etype components (field resolution). */
    data?: Record<string, unknown>
    /** Suppress interactions (lasso/keyboard/shortcuts) + element edit affordances. */
    readonly?: boolean
  }>(),
  { readonly: false }
)

const canvas = useCanvasStore()
const canvasEl = ref<HTMLDivElement | null>(null)

const activePanel = computed(() => canvas.activePanel)

/**
 * Map etype.type → Vue component for v-for `:is` dispatch.
 * Unknown types return TextElement (defensive fallback to keep canvas alive
 * if legacy JSON contains an etype we don't yet support).
 */
function componentForType(type: string | undefined) {
  switch (type) {
    case 'text':
      return TextElement
    case 'image':
      return ImageElement
    case 'longText':
      return LongTextElement
    case 'barcode':
      return BarcodeElement
    case 'qrcode':
      return QrcodeElement
    case 'html':
      return HtmlElement
    case 'hline':
      return HlineElement
    case 'vline':
      return VlineElement
    case 'rect':
      return RectElement
    case 'oval':
      return OvalElement
    case 'table':
      return TableElement
    default:
      return TextElement
  }
}

// ----- Interaction lifecycle -----

let cleanupKeyboard: (() => void) | null = null
let cleanupShortcuts: (() => void) | null = null
let cleanupLasso: (() => void) | null = null

/**
 * Locate the active panel's paper element inside the canvas root. We query
 * by data-panel-id (set by HiprintPanel) instead of holding a ref because
 * the active panel may change without remounting HiprintPanel.
 */
function findActivePaperEl(): HTMLElement | null {
  const root = canvasEl.value
  const id = canvas.activePanelId
  if (!root || !id) return null
  return root.querySelector<HTMLElement>(
    `.hiprint-printPaper[data-panel-id="${CSS.escape(id)}"]`
  )
}

function attachLassoToActivePanel(): void {
  // Tear down previous binding before re-binding to a new paper element.
  cleanupLasso?.()
  cleanupLasso = null
  if (props.readonly) return
  const paper = findActivePaperEl()
  const panelId = canvas.activePanelId
  if (!paper || !panelId) return
  cleanupLasso = enableLasso(paper, panelId)
}

onMounted(() => {
  if (props.readonly) return
  cleanupKeyboard = enableDesignerKeyboard()
  cleanupShortcuts = enableSelectionShortcuts()
  // Wait for HiprintPanel to mount its DOM, then attach lasso.
  void nextTick(attachLassoToActivePanel)
})

// Re-attach lasso when the active panel changes.
watch(
  () => canvas.activePanelId,
  () => {
    if (props.readonly) return
    void nextTick(attachLassoToActivePanel)
  }
)

// ----- Context menu (right-click) -----

// Track the active controller so we can close any open menu when a new
// right-click opens another one (V1 parity: one menu at a time).
let activeMenu: ContextMenuController | null = null

function onContextMenu(e: MouseEvent): void {
  if (props.readonly) return
  const targetEl = e.target as HTMLElement | null
  if (!targetEl) return
  const elNode = targetEl.closest('[data-element-id]')
  const elementId = elNode?.getAttribute('data-element-id')
  // Only intercept when the right-click is on an element. Background
  // right-click (panel/empty area) falls through to the native menu so we
  // don't surprise users with an empty menu in non-element zones.
  if (!elementId) return
  e.preventDefault()
  try {
    activeMenu?.close()
  } catch {
    /* ignore — close is idempotent */
  }
  activeMenu = openContextMenu(
    { x: e.clientX, y: e.clientY },
    { items: buildElementContextItems(elementId) }
  )
}

onBeforeUnmount(() => {
  cleanupLasso?.()
  cleanupKeyboard?.()
  cleanupShortcuts?.()
  cleanupLasso = null
  cleanupKeyboard = null
  cleanupShortcuts = null
  try {
    activeMenu?.close()
  } catch {
    /* ignore */
  }
  activeMenu = null
})
</script>

<template>
  <div
    ref="canvasEl"
    class="hiprint-canvas"
    :class="{
      'hiprint-canvas--readonly': readonly,
      'hiprint-canvas--with-ruler': canvas.rulerVisible && !readonly,
    }"
    @contextmenu="onContextMenu"
  >
    <!-- Ruler tracks (CSS gradient pattern — major mark every 10pt + minor
         every 5pt). Toolbar gridToggle button flips canvas.rulerVisible. -->
    <div
      v-if="canvas.rulerVisible && !readonly"
      class="hiprint-canvas__ruler hiprint-canvas__ruler--top"
      aria-hidden="true"
    />
    <div
      v-if="canvas.rulerVisible && !readonly"
      class="hiprint-canvas__ruler hiprint-canvas__ruler--left"
      aria-hidden="true"
    />
    <template v-if="activePanel">
      <HiprintPanel :panel-id="activePanel.id" :readonly="readonly">
        <component
          v-for="el in activePanel.printElements"
          :key="el.id"
          :is="componentForType(el.printElementType?.type)"
          :element-id="el.id"
          :panel-id="activePanel.id"
          :data="data"
          :interactive="!readonly"
          :editable="!readonly"
        />
      </HiprintPanel>
    </template>
    <div v-else class="hiprint-canvas__empty">
      <slot name="empty">
        <span>No active panel</span>
      </slot>
    </div>
  </div>
</template>

<style scoped>
.hiprint-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: auto;
  background: #f5f5f5;
  box-sizing: border-box;
}
.hiprint-canvas--readonly {
  background: #fafafa;
}
/* Ruler-on layout: reserve 14pt top/left for the bars. */
.hiprint-canvas--with-ruler {
  padding-top: 14pt;
  padding-left: 14pt;
}
.hiprint-canvas__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
  font-size: 14pt;
}
/* Top + left ruler tracks. Major tick every 10pt + minor every 5pt via
   stacked linear-gradients. Pure CSS — no extra DOM nodes per tick. */
.hiprint-canvas__ruler {
  position: absolute;
  background: #fafafa;
  border: 1px solid #ccc;
  pointer-events: none;
  font-size: 8pt;
  color: #666;
}
.hiprint-canvas__ruler--top {
  top: 0;
  left: 14pt;
  right: 0;
  height: 14pt;
  background-image:
    linear-gradient(to right, #888 1px, transparent 1px), /* major */
    linear-gradient(to right, #bbb 1px, transparent 1px); /* minor */
  background-size: 10pt 14pt, 5pt 7pt;
  background-position: 0 0, 0 100%;
  background-repeat: repeat-x;
}
.hiprint-canvas__ruler--left {
  top: 14pt;
  left: 0;
  bottom: 0;
  width: 14pt;
  background-image:
    linear-gradient(to bottom, #888 1px, transparent 1px),
    linear-gradient(to bottom, #bbb 1px, transparent 1px);
  background-size: 14pt 10pt, 7pt 5pt;
  background-position: 0 0, 100% 0;
  background-repeat: repeat-y;
}
</style>
