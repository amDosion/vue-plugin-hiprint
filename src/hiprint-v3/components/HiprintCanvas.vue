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
  onSmartGuidePreviewChange,
  type ContextMenuController,
  type SmartGuidePreview,
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

// ----- TKT-102 user-drawn guide-line drag state -----
//
// Two gesture flows resolve here:
//  - 'creating': pointerdown on a ruler bar → addGuideLine + drag along axis
//  - 'moving'  : pointerdown on existing guide → updateGuideLine along axis
// pointerup decides: outside paper or back inside ruler band → removeGuideLine.

interface GuideDragState {
  kind: 'creating' | 'moving'
  axis: 'h' | 'v'
  guideId: string
}
const guideDragState = ref<GuideDragState | null>(null)

/**
 * Translate viewport coords → paper-pt along the relevant axis. NaN if no
 * active paper element (caller must check; store rejects NaN).
 */
function clientToPaperPt(axis: 'h' | 'v', clientX: number, clientY: number): number {
  const paper = findActivePaperEl()
  if (!paper) return Number.NaN
  const rect = paper.getBoundingClientRect()
  const scale = canvas.scale > 0 ? canvas.scale : 1
  if (axis === 'h') return (clientY - rect.top) / scale
  return (clientX - rect.left) / scale
}

// Sprint 22g (Stream GI) TKT-412 — body class while a guide is being created
// or moved. V1 bundle.js:9610 set `document.body.classList.add(...)` so caller
// CSS can hide other UI affordances (cursor, hover hints) during the gesture.
const GUIDE_DRAG_BODY_CLASS = 'hiprint-guide-dragging'

function applyGuideDragBodyClass(): void {
  if (typeof document === 'undefined' || !document.body) return
  document.body.classList.add(GUIDE_DRAG_BODY_CLASS)
}

function clearGuideDragBodyClass(): void {
  if (typeof document === 'undefined' || !document.body) return
  document.body.classList.remove(GUIDE_DRAG_BODY_CLASS)
}

function onRulerPointerDown(axis: 'h' | 'v', e: PointerEvent): void {
  if (props.readonly) return
  if (e.button !== 0) return
  const pos = clientToPaperPt(axis, e.clientX, e.clientY)
  if (!Number.isFinite(pos)) return
  const guide = canvas.addGuideLine(axis, Math.max(0, pos))
  if (!guide.id) return
  guideDragState.value = { kind: 'creating', axis, guideId: guide.id }
  applyGuideDragBodyClass()
  window.addEventListener('pointermove', onGuidePointerMove)
  window.addEventListener('pointerup', onGuidePointerUp, { once: true })
  e.preventDefault()
}

function onGuideLinePointerDown(g: { id: string; axis: 'h' | 'v' }, e: PointerEvent): void {
  if (props.readonly) return
  if (e.button !== 0) return
  guideDragState.value = { kind: 'moving', axis: g.axis, guideId: g.id }
  applyGuideDragBodyClass()
  window.addEventListener('pointermove', onGuidePointerMove)
  window.addEventListener('pointerup', onGuidePointerUp, { once: true })
  e.preventDefault()
  e.stopPropagation()
}

function onGuidePointerMove(e: PointerEvent): void {
  const state = guideDragState.value
  if (!state) return
  const pos = clientToPaperPt(state.axis, e.clientX, e.clientY)
  if (!Number.isFinite(pos)) return
  canvas.updateGuideLine(state.guideId, pos)
}

function onGuidePointerUp(e: PointerEvent): void {
  const state = guideDragState.value
  guideDragState.value = null
  clearGuideDragBodyClass()
  window.removeEventListener('pointermove', onGuidePointerMove)
  if (!state) return
  const wrap = canvasEl.value
  if (!wrap) return
  const wrapRect = wrap.getBoundingClientRect()
  // 20px tolerant band (≈ 14pt at 96dpi + slack) on the correct ruler side.
  const RULER_BAND_PX = 20
  const inTopBand =
    e.clientY >= wrapRect.top && e.clientY <= wrapRect.top + RULER_BAND_PX
  const inLeftBand =
    e.clientX >= wrapRect.left && e.clientX <= wrapRect.left + RULER_BAND_PX
  const outsideCanvas =
    e.clientX < wrapRect.left ||
    e.clientX > wrapRect.right ||
    e.clientY < wrapRect.top ||
    e.clientY > wrapRect.bottom
  const shouldDelete =
    outsideCanvas ||
    (state.axis === 'h' && inTopBand) ||
    (state.axis === 'v' && inLeftBand)
  if (shouldDelete) canvas.removeGuideLine(state.guideId)
}

// ----- TKT-154 — transient ruler-handle cursor markers -----
//
// Two thin triangular marks rendered on the rulers track the user's cursor
// position over the active paper. Distinct from TKT-102 user-drawn guides
// (those are persistent dashed lines stored in `canvas.guideLines`).
//
// V1 reference: docs/V1-INVENTORY/styles.md §1.11 line 125
// (`.hiprint-ruler-handle` background: rgba(64,158,255,0.7); cursor: move).
//
// State:
//  - `cursorPos`: null when the pointer is not over the paper; otherwise the
//    paper-pt coords (already scale-corrected by `clientToPaperPt`).
//  - Handles render inside the existing ruler SVG, positioned by `pos` in pt
//    so they stay aligned with paper geometry under any zoom.
//  - Resets on pointerleave so we never leave a stale marker behind.
const cursorPos = ref<{ x: number; y: number } | null>(null)

function onPaperPointerMove(e: PointerEvent): void {
  if (props.readonly) return
  const x = clientToPaperPt('v', e.clientX, e.clientY)
  const y = clientToPaperPt('h', e.clientX, e.clientY)
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    cursorPos.value = null
    return
  }
  cursorPos.value = { x, y }
}

function onPaperPointerLeave(): void {
  cursorPos.value = null
}

// ----- TKT-103 smart-guide preview overlay -----
const smartPreviews = ref<readonly SmartGuidePreview[]>([])
let unsubscribeSmartGuide: (() => void) | null = null

/**
 * TKT-391 — Format a pt coordinate for the live smart-guide badge.
 *
 * V1 reference: bundle.js line 1380-1451 (HilightLine helper) + 7538-7691
 * (snap render path). V1 displays the pt offset of each active snap as a
 * small numeric overlay so designers see the exact coordinate the drag/resize
 * is snapping to. We round to 1 decimal place — V1 displays integers but a
 * half-pt grid snap is common enough to warrant the extra precision.
 *
 * Returns the rendered string (also exposed via `data-pt` for tests).
 */
function ptLabel(pos: number): string {
  if (!Number.isFinite(pos)) return '0'
  // Round to 1 decimal place, strip a trailing ".0" so integer snaps stay clean.
  const rounded = Math.round(pos * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

onMounted(() => {
  unsubscribeSmartGuide = onSmartGuidePreviewChange((next) => {
    smartPreviews.value = next
  })
})

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
  try {
    unsubscribeSmartGuide?.()
  } catch {
    /* ignore */
  }
  unsubscribeSmartGuide = null
  window.removeEventListener('pointermove', onGuidePointerMove)
  // Defensive: if the component unmounts mid-gesture, scrub the body class
  // so a re-mount doesn't inherit a stale `hiprint-guide-dragging` state.
  clearGuideDragBodyClass()
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
    @pointermove="onPaperPointerMove"
    @pointerleave="onPaperPointerLeave"
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
      @pointerdown="onRulerPointerDown('h', $event)"
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
      <!-- TKT-154 — transient cursor marker on the top (horizontal) ruler.
           Triangle pointing down so the apex aligns with the cursor's x
           position. Pointer-events:none so it never blocks ruler-drag. -->
      <polygon
        v-if="cursorPos && cursorPos.x >= 0 && cursorPos.x <= rulerWidthPt"
        class="hiprint-ruler-handle hiprint-ruler-handle-h"
        :points="`${cursorPos.x - 3},0 ${cursorPos.x + 3},0 ${cursorPos.x},${RULER_THICKNESS}`"
        fill="rgba(64,158,255,0.7)"
        stroke="rgba(64,158,255,0.9)"
        stroke-width="0.5"
      />
    </svg>
    <svg
      v-if="canvas.rulerVisible && !readonly"
      class="hiprint-canvas__ruler hiprint-canvas__ruler--left"
      :viewBox="`0 0 ${RULER_THICKNESS} ${rulerHeightPt}`"
      :width="RULER_THICKNESS"
      :height="rulerHeightPt"
      preserveAspectRatio="xMinYMin meet"
      aria-hidden="true"
      @pointerdown="onRulerPointerDown('v', $event)"
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
      <!-- TKT-154 — transient cursor marker on the left (vertical) ruler.
           Triangle pointing right so the apex aligns with the cursor's y. -->
      <polygon
        v-if="cursorPos && cursorPos.y >= 0 && cursorPos.y <= rulerHeightPt"
        class="hiprint-ruler-handle hiprint-ruler-handle-v"
        :points="`0,${cursorPos.y - 3} 0,${cursorPos.y + 3} ${RULER_THICKNESS},${cursorPos.y}`"
        fill="rgba(64,158,255,0.7)"
        stroke="rgba(64,158,255,0.9)"
        stroke-width="0.5"
      />
    </svg>
    <template v-if="activePanel">
      <HiprintPanel :panel-id="activePanel.id" :readonly="readonly">
        <!-- TKT-102 / TKT-103 — guide line + smart-guide preview layers,
             rendered inside the paper so they scale + position with the
             paper-pt coord system. -->
        <template #overlay>
          <div class="hiprint-guide-layer" aria-hidden="true">
            <div
              v-for="g in canvas.guideLines"
              :key="g.id"
              :class="[
                'hiprint-guide-line',
                g.axis === 'h'
                  ? 'hiprint-guide-line--h'
                  : 'hiprint-guide-line--v',
                {
                  'hiprint-guide-dragging':
                    guideDragState && guideDragState.guideId === g.id,
                },
              ]"
              :style="
                g.axis === 'h'
                  ? { top: g.pos + 'pt', left: '0', right: '0', height: '0' }
                  : { left: g.pos + 'pt', top: '0', bottom: '0', width: '0' }
              "
              :data-guide-id="g.id"
              :data-guide-axis="g.axis"
              @pointerdown="onGuideLinePointerDown(g, $event)"
            />
            <div
              v-for="(p, idx) in smartPreviews"
              :key="`smart-${idx}-${p.axis}-${p.pos}`"
              :class="[
                'hiprint-smart-guide',
                p.axis === 'h'
                  ? 'hiprint-smart-guide--h'
                  : 'hiprint-smart-guide--v',
              ]"
              :style="
                p.axis === 'h'
                  ? { top: p.pos + 'pt', left: '0', right: '0', height: '0' }
                  : { left: p.pos + 'pt', top: '0', bottom: '0', width: '0' }
              "
              :data-smart-guide-kind="p.kind"
            >
              <!-- TKT-391 — pt coordinate label next to each smart-guide line.
                   V1 reference: bundle.js line 1380-1451 + 7538-7691 — V1 renders
                   a small numeric badge near the snap line so the user knows
                   the exact coordinate the snap landed on. We mirror that as a
                   `data-pt` attribute (test surface) + a visible `<span>` label
                   so designers can confirm alignment without measuring.
                   - Horizontal guide → label sits at left=4pt offset on the line.
                   - Vertical guide → label sits at top=4pt offset on the line.
                   - Coordinate is rounded to 1 decimal (V1 uses no decimals at
                     low precision; 0.1 keeps half-pt snaps readable). -->
              <span
                class="hiprint-smart-guide__label"
                :data-pt="ptLabel(p.pos)"
              >{{ ptLabel(p.pos) }}pt</span>
            </div>
          </div>
        </template>
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
  background: var(--hiprint-bg-preview, #fafafa);
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
  color: var(--hiprint-fg-disabled, #999);
  font-size: 14pt;
}
/* SVG ruler tracks (CV-004). Width/height are driven by :width/:height
   attrs on the <svg> element (computed from active panel × scale). Ticks
   and mm labels are rendered as real SVG <line>/<text> nodes inside. */
.hiprint-canvas__ruler {
  position: absolute;
  background: var(--hiprint-ruler-bg, #fafafa);
  border: 1px solid var(--hiprint-border, #ccc);
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
/* TKT-102: rulers grabbable for guide creation. Override pointer-events:none
   on the ruler base class so pointerdown reaches us. */
.hiprint-canvas--with-ruler .hiprint-canvas__ruler--top {
  cursor: ns-resize;
  pointer-events: auto;
}
.hiprint-canvas--with-ruler .hiprint-canvas__ruler--left {
  cursor: ew-resize;
  pointer-events: auto;
}
/* TKT-102 guide-line + TKT-103 smart-guide layers. */
.hiprint-guide-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
}
.hiprint-guide-line {
  position: absolute;
  pointer-events: auto;
}
.hiprint-guide-line--h {
  border-top: 1px dashed var(--hiprint-guide-line, #1677ff);
  cursor: ns-resize;
}
.hiprint-guide-line--v {
  border-left: 1px dashed var(--hiprint-guide-line, #1677ff);
  cursor: ew-resize;
}
.hiprint-guide-dragging {
  opacity: 0.7;
}
.hiprint-smart-guide {
  position: absolute;
  pointer-events: none;
}
.hiprint-smart-guide--h {
  border-top: 1px dashed var(--hiprint-smart-guide, #fa8c16);
}
.hiprint-smart-guide--v {
  border-left: 1px dashed var(--hiprint-smart-guide, #fa8c16);
}
/* TKT-391 — pt coordinate badge on each smart-guide line. Sits flush against
   the guide so the user reads it without losing the alignment context. We use
   a tiny corner offset so the badge doesn't overlap the dashed line itself. */
.hiprint-smart-guide__label {
  position: absolute;
  background: var(--hiprint-smart-guide, #fa8c16);
  color: #fff;
  font-size: 9px;
  line-height: 1;
  padding: 1px 3px;
  border-radius: 2px;
  pointer-events: none;
  white-space: nowrap;
  font-family: var(--hiprint-font-mono, ui-monospace, SFMono-Regular, monospace);
  font-variant-numeric: tabular-nums;
}
.hiprint-smart-guide--h .hiprint-smart-guide__label {
  /* Horizontal line at y=pos — badge floats just above the line, near the
     left edge of the paper so it stays in-frame across panel widths. */
  left: 4pt;
  top: 2px;
}
.hiprint-smart-guide--v .hiprint-smart-guide__label {
  /* Vertical line at x=pos — badge floats just right of the line, near the
     top of the paper. */
  left: 2px;
  top: 4pt;
}
</style>
