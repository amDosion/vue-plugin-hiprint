/**
 * smart-guides.ts — TKT-103 alignment snapping helper.
 *
 * Pure, framework-agnostic snapping math used by drag-drop.ts. Keeping the
 * algorithm out of drag-drop.ts (which is heavily interact.js-flavored) makes
 * it testable without mocking interactjs.
 *
 * The smart-guide system finds alignment opportunities between the element
 * being dragged and three classes of reference:
 *  1. OTHER ELEMENTS in the same panel — 6 anchors each:
 *       left, right, h-center (x axis) + top, bottom, v-center (y axis)
 *  2. USER GUIDE LINES (TKT-102) — single-axis lines.
 *  3. CANVAS GRID — gridSize step (kept as fallback when nothing else hits).
 *
 * Priority: ELEMENT > USER_GUIDE > GRID. The first hit in that order wins
 * per axis — so dragging near another element's left edge will snap to it
 * even if a user guide is technically equidistant.
 *
 * Preview output: for each axis that snapped to an element OR user guide,
 * we emit a `SmartGuidePreview` describing the dashed line to draw. The
 * HiprintCanvas reads this from the ephemeral _smartGuidePreview store ref
 * and renders during the drag; cleared on drag end.
 *
 * V1 parity note: V1 has an 18-case algorithm (interactions.md §6). We
 * implement the 12 visible-result cases (6 per axis pairing) because the
 * remaining 6 are duplicates that resolve to the same snap line.
 */
import type { CanvasElement, GuideLine } from '@hiprint-v3/stores'

// ============ Tunable constants ============

/**
 * Snap threshold in pt. V1 uses ~5pt. Anything farther → no snap.
 * Exported so tests + future configurable-snap toolbar can read it.
 */
export const SMART_GUIDE_SNAP_PT = 5

// ============ Public types ============

/**
 * Bounding box in pt (left/top/width/height). All snap math operates on this
 * shape so callers can construct it from either a CanvasElement (store) or a
 * pending drag position (interact.js delta math).
 */
export interface ElementBox {
  left: number
  top: number
  width: number
  height: number
}

/**
 * Smart-guide preview line. Rendered as a dashed line while drag is in
 * progress; cleared on drag end. Distinct visual from user-drawn guides so
 * the user knows this is auto-generated.
 *
 * `pos` is the snap coordinate in pt (along the perpendicular axis).
 * `axis: 'v'` means a vertical line at X=pos (matched-left / matched-right /
 * matched-h-center). `axis: 'h'` is horizontal at Y=pos.
 *
 * `kind` is purely informational (debug + test assertions); the renderer
 * uses only `axis` + `pos`.
 */
export interface SmartGuidePreview {
  axis: 'h' | 'v'
  pos: number
  kind:
    | 'element-left'
    | 'element-right'
    | 'element-h-center'
    | 'element-top'
    | 'element-bottom'
    | 'element-v-center'
    | 'user-guide'
}

/** Result of one snap calculation pass (one drag move tick). */
export interface SnapResult {
  /** Patched left in pt (== input.left if no x-axis snap). */
  left: number
  /** Patched top in pt (== input.top if no y-axis snap). */
  top: number
  /** Preview lines to draw during this tick (may be empty). */
  previews: SmartGuidePreview[]
}

/** Options for {@link computeSnap}. */
export interface ComputeSnapOptions {
  /** Bbox of the dragging element AT the proposed (un-snapped) position. */
  box: ElementBox
  /** Other elements in the same panel (do NOT include the dragging one). */
  others: readonly ElementBox[]
  /** User-drawn guide lines (TKT-102). */
  guides: readonly GuideLine[]
  /**
   * Snap threshold in pt. Defaults to {@link SMART_GUIDE_SNAP_PT}. Caller can
   * pass 0 to fully disable snapping (e.g. when Alt is held).
   */
  threshold?: number
  /**
   * Grid step (pt). When > 0 AND no element/user-guide hit on an axis, the
   * coordinate snaps to the nearest grid multiple. Pass 0 to disable.
   */
  gridSize?: number
}

// ============ Helpers ============

/**
 * Extract bounding-box from a canvas store element. Reads options.{left,top,
 * width,height} defaulting to 0 — V1 panel elements always have left/top but
 * shapes (hline/vline) may omit width/height; the result is still usable for
 * single-axis snaps since 0-width × 0-height has anchors that all coincide
 * with the top-left corner.
 */
export function boxFromElement(el: CanvasElement): ElementBox {
  const o = (el.options as Record<string, unknown>) ?? {}
  return {
    left: Number(o.left ?? 0),
    top: Number(o.top ?? 0),
    width: Number(o.width ?? 0),
    height: Number(o.height ?? 0),
  }
}

/**
 * Compute the 3 X-axis anchors of a box: left edge, h-center, right edge.
 * @internal
 */
function xAnchors(b: ElementBox): readonly number[] {
  return [b.left, b.left + b.width / 2, b.left + b.width]
}

/**
 * Compute the 3 Y-axis anchors of a box: top edge, v-center, bottom edge.
 * @internal
 */
function yAnchors(b: ElementBox): readonly number[] {
  return [b.top, b.top + b.height / 2, b.top + b.height]
}

/**
 * Kind tags for the 3 dragging-anchor positions, used to label preview output.
 * @internal
 */
const X_KIND = ['element-left', 'element-h-center', 'element-right'] as const
const Y_KIND = ['element-top', 'element-v-center', 'element-bottom'] as const

// ============ Public API ============

/**
 * Compute the snapped position for a dragged element bbox.
 *
 * Algorithm (per axis, independent — X and Y resolve separately):
 *  1. For each dragging-anchor a in [left, h-center, right]:
 *       for each other-anchor b in [left, h-center, right] of every `others[]`:
 *         if |a - b| ≤ threshold → candidate (delta = b - a, line at b).
 *  2. Pick the candidate with the SMALLEST |delta|. Apply.
 *  3. If no element hit: try user guides (axis-matching). Same algorithm.
 *  4. If still no hit + gridSize > 0: snap to nearest grid multiple
 *     (gridSize quantization on the box's left/top — V1/V2 parity).
 *
 * Y axis follows the same flow with [top, v-center, bottom] anchors and
 * GuideLine.axis === 'h' (horizontal lines snap Y).
 *
 * Preview output: only element and user-guide hits emit previews. Grid
 * snapping is "silent" (the .hiprint-printPaper background grid already
 * visualizes it; another overlay would clutter).
 */
export function computeSnap(opts: ComputeSnapOptions): SnapResult {
  const { box, others, guides } = opts
  const threshold = opts.threshold ?? SMART_GUIDE_SNAP_PT
  const gridSize = opts.gridSize ?? 0

  const previews: SmartGuidePreview[] = []

  // ----- X axis -----
  let bestDx: { delta: number; line: number; kind: SmartGuidePreview['kind'] } | null = null
  if (threshold > 0) {
    const dragX = xAnchors(box)
    // Element anchors
    for (const other of others) {
      const otherX = xAnchors(other)
      for (let i = 0; i < dragX.length; i++) {
        for (let j = 0; j < otherX.length; j++) {
          const dragAnchor = dragX[i]!
          const otherAnchor = otherX[j]!
          const dist = Math.abs(otherAnchor - dragAnchor)
          if (dist > threshold) continue
          const delta = otherAnchor - dragAnchor
          if (!bestDx || Math.abs(delta) < Math.abs(bestDx.delta)) {
            bestDx = { delta, line: otherAnchor, kind: X_KIND[i]! }
          }
        }
      }
    }
    // User guides (vertical) — only if no element hit (priority rule).
    if (!bestDx) {
      for (const g of guides) {
        if (g.axis !== 'v') continue
        for (let i = 0; i < dragX.length; i++) {
          const dragAnchor = dragX[i]!
          const dist = Math.abs(g.pos - dragAnchor)
          if (dist > threshold) continue
          const delta = g.pos - dragAnchor
          if (!bestDx || Math.abs(delta) < Math.abs(bestDx.delta)) {
            bestDx = { delta, line: g.pos, kind: 'user-guide' }
          }
        }
      }
    }
  }

  let snappedLeft = box.left
  if (bestDx) {
    snappedLeft = box.left + bestDx.delta
    previews.push({ axis: 'v', pos: bestDx.line, kind: bestDx.kind })
  } else if (gridSize > 0) {
    // Grid fallback (silent — no preview line).
    snappedLeft = Math.round(box.left / gridSize) * gridSize
  }

  // ----- Y axis -----
  let bestDy: { delta: number; line: number; kind: SmartGuidePreview['kind'] } | null = null
  if (threshold > 0) {
    const dragY = yAnchors(box)
    for (const other of others) {
      const otherY = yAnchors(other)
      for (let i = 0; i < dragY.length; i++) {
        for (let j = 0; j < otherY.length; j++) {
          const dragAnchor = dragY[i]!
          const otherAnchor = otherY[j]!
          const dist = Math.abs(otherAnchor - dragAnchor)
          if (dist > threshold) continue
          const delta = otherAnchor - dragAnchor
          if (!bestDy || Math.abs(delta) < Math.abs(bestDy.delta)) {
            bestDy = { delta, line: otherAnchor, kind: Y_KIND[i]! }
          }
        }
      }
    }
    if (!bestDy) {
      for (const g of guides) {
        if (g.axis !== 'h') continue
        for (let i = 0; i < dragY.length; i++) {
          const dragAnchor = dragY[i]!
          const dist = Math.abs(g.pos - dragAnchor)
          if (dist > threshold) continue
          const delta = g.pos - dragAnchor
          if (!bestDy || Math.abs(delta) < Math.abs(bestDy.delta)) {
            bestDy = { delta, line: g.pos, kind: 'user-guide' }
          }
        }
      }
    }
  }

  let snappedTop = box.top
  if (bestDy) {
    snappedTop = box.top + bestDy.delta
    previews.push({ axis: 'h', pos: bestDy.line, kind: bestDy.kind })
  } else if (gridSize > 0) {
    snappedTop = Math.round(box.top / gridSize) * gridSize
  }

  return { left: snappedLeft, top: snappedTop, previews }
}

// ============ Ephemeral preview state ============

/**
 * Ephemeral smart-guide preview list. NOT a Pinia store — these previews are
 * scoped to a single drag gesture and would pollute history snapshots if
 * persisted. We expose a tiny pub-sub so HiprintCanvas can subscribe and
 * re-render, then clear on drag end.
 *
 * Lifecycle:
 *  - drag-drop.ts calls setPreviews(items) on every drag move.
 *  - drag-drop.ts calls clearPreviews() on drag end.
 *  - HiprintCanvas (or a dedicated SmartGuideOverlay) subscribes via
 *    onPreviewChange(callback) and re-renders.
 *
 * No reactive framework dep — caller provides a callback. Lets us keep this
 * module testable without Pinia or Vue.
 */
type PreviewListener = (previews: readonly SmartGuidePreview[]) => void
const _previewListeners = new Set<PreviewListener>()
let _currentPreviews: readonly SmartGuidePreview[] = []

/** Set the current smart-guide previews (notifies listeners). */
export function setSmartGuidePreviews(previews: readonly SmartGuidePreview[]): void {
  _currentPreviews = previews
  _previewListeners.forEach((fn) => {
    try {
      fn(previews)
    } catch (err) {
      console.warn('[hiprint] smart-guide preview listener threw:', err)
    }
  })
}

/** Clear smart-guide previews (notifies listeners with []). */
export function clearSmartGuidePreviews(): void {
  setSmartGuidePreviews([])
}

/** Read current previews (for tests + read-only consumers). */
export function getSmartGuidePreviews(): readonly SmartGuidePreview[] {
  return _currentPreviews
}

/**
 * Subscribe to preview changes. Returns an unsubscribe function. The listener
 * is called immediately with the current value so subscribers don't need a
 * separate initial read.
 */
export function onSmartGuidePreviewChange(listener: PreviewListener): () => void {
  _previewListeners.add(listener)
  try {
    listener(_currentPreviews)
  } catch (err) {
    console.warn('[hiprint] smart-guide preview listener threw on subscribe:', err)
  }
  return () => {
    _previewListeners.delete(listener)
  }
}
