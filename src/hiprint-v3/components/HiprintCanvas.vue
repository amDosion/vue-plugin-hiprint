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

// ----- Ruler geometry (CV-004) -----
//
// SVG-based rulers replace the prior CSS-gradient stripes so we can render
// real mm number labels. Layout uses pt internally (matches panel.width /
// panel.height units) but displays mm in <text>.
//
// pt ↔ mm: 1 in = 72 pt = 25.4 mm  →  1 mm = 72/25.4 ≈ 2.835 pt.
// Tick scheme: minor every 1 mm, major every 10 mm + numeric label.
const MM_TO_PT = 72 / 25.4 // ≈ 2.8346
const ptToMm = (pt: number) => Math.round((pt / 72) * 25.4)
const RULER_THICKNESS = 14 // pt — matches CSS top/left offset (14pt).

/**
 * Ruler track lengths in pt. We base the top ruler width on the active panel
 * width × scale (so labels stay aligned to the paper), and similarly for the
 * left ruler height. Falls back to the canvas client size when no panel is
 * active so the bars still render their tick scale (mounted before a panel
 * exists is unusual but possible during transitions).
 */
const canvasClientWidth = ref<number>(0)
const canvasClientHeight = ref<number>(0)

const rulerWidthPt = computed<number>(() => {
  const p = canvas.activePanel
  if (p) return p.width * canvas.scale
  // Fallback: convert client px → pt approx (px ≈ pt at 96dpi factor 0.75).
  // We just want a non-zero length so the SVG paints something.
  return Math.max(0, canvasClientWidth.value * 0.75)
})

const rulerHeightPt = computed<number>(() => {
  const p = canvas.activePanel
  if (p) return p.height * canvas.scale
  return Math.max(0, canvasClientHeight.value * 0.75)
})

/**
 * Build tick descriptors for one axis. Walks 1 mm at a time up to the
 * ruler length, emitting minor ticks each step and major+label every 10 mm.
 * Pure derivation — no DOM access; safe to compute under SSR/jsdom.
 */
interface Tick {
  pos: number // position in pt along the axis
  mm: number // mm label value (only present for major ticks)
  major: boolean
}

function buildTicks(lengthPt: number): Tick[] {
  const ticks: Tick[] = []
  if (!Number.isFinite(lengthPt) || lengthPt <= 0) return ticks
  const totalMm = Math.floor(lengthPt / MM_TO_PT)
  for (let mm = 0; mm <= totalMm; mm++) {
    ticks.push({
      pos: mm * MM_TO_PT,
      mm,
      major: mm % 10 === 0,
    })
  }
  return ticks
}

const topTicks = computed<Tick[]>(() => buildTicks(rulerWidthPt.value))
const leftTicks = computed<Tick[]>(() => buildTicks(rulerHeightPt.value))

// ResizeObserver keeps fallback dims fresh when the canvas viewport changes
// (window resize, splitter drag, etc.). Bound after mount; disposed on unmount.
let resizeObs: ResizeObserver | null = null

function syncCanvasSize(): void {
  const el = canvasEl.value
  if (!el) return
  canvasClientWidth.value = el.clientWidth
  canvasClientHeight.value = el.clientHeight
}

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
  // Always sync canvas size + observe resize so ruler tracks track viewport
  // dimensions even in readonly mode (preview surfaces still show rulers
  // if rulerVisible is true).
  syncCanvasSize()
  if (typeof ResizeObserver !== 'undefined' && canvasEl.value) {
    resizeObs = new ResizeObserver(() => syncCanvasSize())
    resizeObs.observe(canvasEl.value)
  }
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
    resizeObs?.disconnect()
  } catch {
    /* ignore */
  }
  resizeObs = null
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
    <!-- Ruler tracks (CV-004: SVG with real mm number labels).
         Minor tick every 1 mm, major tick + numeric label every 10 mm.
         viewBox uses pt as the underlying unit so it aligns 1:1 with the
         panel paper (panel.width/height are pt). pointer-events: none keeps
         lasso/click selection on the paper underneath unaffected. -->
    <svg
      v-if="canvas.rulerVisible && !readonly"
      class="hiprint-canvas__ruler hiprint-canvas__ruler--top"
      :viewBox="`0 0 ${rulerWidthPt} ${RULER_THICKNESS}`"
      :width="rulerWidthPt"
      :height="RULER_THICKNESS"
      preserveAspectRatio="xMinYMin meet"
      aria-hidden="true"
    >
      <line
        v-for="t in topTicks"
        :key="`tt-${t.pos}`"
        :x1="t.pos"
        :x2="t.pos"
        :y1="t.major ? 0 : RULER_THICKNESS / 2"
        :y2="RULER_THICKNESS"
        :stroke="t.major ? '#888' : '#bbb'"
        stroke-width="0.5"
      />
      <text
        v-for="t in topTicks.filter((x) => x.major && x.mm > 0)"
        :key="`tl-${t.pos}`"
        :x="t.pos + 1"
        :y="RULER_THICKNESS / 2 - 0.5"
        font-size="4"
        fill="#555"
        font-family="sans-serif"
      >
        {{ t.mm }}
      </text>
    </svg>
    <svg
      v-if="canvas.rulerVisible && !readonly"
      class="hiprint-canvas__ruler hiprint-canvas__ruler--left"
      :viewBox="`0 0 ${RULER_THICKNESS} ${rulerHeightPt}`"
      :width="RULER_THICKNESS"
      :height="rulerHeightPt"
      preserveAspectRatio="xMinYMin meet"
      aria-hidden="true"
    >
      <line
        v-for="t in leftTicks"
        :key="`lt-${t.pos}`"
        :y1="t.pos"
        :y2="t.pos"
        :x1="t.major ? 0 : RULER_THICKNESS / 2"
        :x2="RULER_THICKNESS"
        :stroke="t.major ? '#888' : '#bbb'"
        stroke-width="0.5"
      />
      <!-- Left ruler labels rotated -90° so digits read along the y axis. -->
      <text
        v-for="t in leftTicks.filter((x) => x.major && x.mm > 0)"
        :key="`ll-${t.pos}`"
        :transform="`translate(${RULER_THICKNESS / 2 - 0.5} ${t.pos + 1}) rotate(-90)`"
        font-size="4"
        fill="#555"
        font-family="sans-serif"
        text-anchor="end"
      >
        {{ t.mm }}
      </text>
    </svg>
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
/* SVG ruler tracks (CV-004). Width/height are driven by :width/:height
   attrs on the <svg> element (computed from active panel × scale). Ticks
   and mm labels are rendered as real SVG <line>/<text> nodes inside. */
.hiprint-canvas__ruler {
  position: absolute;
  background: #fafafa;
  border: 1px solid #ccc;
  pointer-events: none;
  display: block;
}
.hiprint-canvas__ruler--top {
  top: 0;
  left: 14pt;
  height: 14pt;
}
.hiprint-canvas__ruler--left {
  top: 14pt;
  left: 0;
  width: 14pt;
}
</style>
