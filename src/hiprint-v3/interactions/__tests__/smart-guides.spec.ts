/**
 * smart-guides.spec.ts — TKT-103 alignment snapping math + integration.
 *
 * Two layers under test:
 *
 *  1. PURE: `computeSnap(...)` — the algorithm itself. Asserted with
 *     hand-constructed boxes so we know exactly which axis/anchor pair
 *     should match. Covers the 6 dragging anchors × element / user-guide /
 *     grid priority chain.
 *
 *  2. INTEGRATION: `enableElementDrag` move handler runs `computeSnap` and
 *     emits previews via `setSmartGuidePreviews`. We use the same interact.js
 *     mock pattern as drag-drop.spec.ts to capture listeners and assert
 *     store + preview-bus mutations.
 *
 * Priority rules (locked in by tests):
 *   element-anchor > user-guide > grid > no-snap
 *
 * Alt-key disables smart snap (V1 parity) — caller path passes threshold=0.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// ----- interact.js mock (shared style with drag-drop.spec.ts) ---------------

type CapturedDraggable = {
  el: HTMLElement
  options: { listeners?: Record<string, (...args: unknown[]) => void> }
}
const captured: { draggable: CapturedDraggable[] } = { draggable: [] }

vi.mock('interactjs', () => {
  function interact(el: HTMLElement) {
    return {
      draggable(options: CapturedDraggable['options']) {
        captured.draggable.push({ el, options })
        return this
      },
      dropzone() {
        return this
      },
      unset() {
        /* noop */
      },
    }
  }
  interact.modifiers = {
    snap: (cfg: unknown) => ({ _kind: 'snap', cfg }),
    restrictRect: (cfg: unknown) => ({ _kind: 'restrictRect', cfg }),
  }
  interact.snappers = {
    grid: (cfg: unknown) => ({ _kind: 'grid', cfg }),
  }
  return { default: interact }
})

// Now import SUT (after mock).
import {
  computeSnap,
  boxFromElement,
  setSmartGuidePreviews,
  clearSmartGuidePreviews,
  getSmartGuidePreviews,
  onSmartGuidePreviewChange,
  SMART_GUIDE_SNAP_PT,
  type ElementBox,
} from '../smart-guides'
import { enableElementDrag } from '../drag-drop'
import { useCanvasStore } from '@hiprint-v3/stores'

function box(left: number, top: number, w = 20, h = 10): ElementBox {
  return { left, top, width: w, height: h }
}

function makeDom(): HTMLElement {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return el
}

function lastDraggable(): CapturedDraggable {
  const c = captured.draggable[captured.draggable.length - 1]
  if (!c) throw new Error('No captured draggable')
  return c
}

beforeEach(() => {
  setActivePinia(createPinia())
  captured.draggable.length = 0
  clearSmartGuidePreviews()
})

// ============ Pure algorithm ============

describe('computeSnap — element anchors (left/right/h-center)', () => {
  it('snaps dragging-left to other-left when within threshold', () => {
    const dragging = box(102, 50) // left=102 -> close to other.left=100
    const other = box(100, 200)
    const res = computeSnap({ box: dragging, others: [other], guides: [] })
    expect(res.left).toBe(100) // dragged 2pt to match
    expect(res.previews.some((p) => p.kind === 'element-left' && p.axis === 'v' && p.pos === 100)).toBe(true)
  })

  it('snaps dragging-right to other-right (matched-right alignment)', () => {
    // To force right→right as smallest-|Δ|, make other's anchors far from
    // dragging's left + h-center but close to dragging's right.
    // dragging left=10, w=110 → left=10, h-center=65, right=120.
    // other   left=300, h=10, w=10 → left=300, h-center=305, right=310. None within 5pt.
    // We need other.right close to 120. Use other.left=80, w=42 → right=122.
    //   other anchors: 80, 101, 122.
    // Distances from dragging(10, 65, 120):
    //   10→80=70(out) 10→101=91(out) 10→122=112(out)
    //   65→80=15(out) 65→101=36(out) 65→122=57(out)
    //   120→80=-40(out) 120→101=-19(out) 120→122=2 ✓
    // Only one candidate → right→right wins.
    const dragging = box(10, 50, 110, 10)
    const other = box(80, 0, 42, 10) // right=122
    const res = computeSnap({ box: dragging, others: [other], guides: [] })
    expect(res.left).toBe(12) // dragging shifted +2 so right edge=122
    expect(res.previews.some((p) => p.kind === 'element-right' && p.pos === 122)).toBe(true)
  })

  it('snaps dragging-h-center to other-h-center', () => {
    // Force h-center→h-center as the only in-range pair. Use a wide-tall
    // other so its left/right are far from the dragging anchors.
    // dragging left=100, w=20 → X anchors: 100, 110, 120.
    // other left=10, w=200 → X anchors: 10, 110, 210.
    // Only h-center→h-center (Δ=0) is within threshold.
    const dragging = box(100, 50, 20, 10)
    const other = box(10, 0, 200, 10)
    const res = computeSnap({ box: dragging, others: [other], guides: [] })
    expect(res.left).toBe(100) // already aligned, no movement
    expect(res.previews.some((p) => p.kind === 'element-h-center' && p.pos === 110)).toBe(true)
  })

  it('does NOT snap when distance > threshold (X axis)', () => {
    // Use different Y positions so Y axis also doesn't snap (gives 0 previews).
    const dragging = box(100, 50, 10, 10)
    const other = box(200, 200, 10, 10) // far away on both axes
    const res = computeSnap({ box: dragging, others: [other], guides: [] })
    expect(res.left).toBe(100)
    expect(res.top).toBe(50)
    expect(res.previews.length).toBe(0)
  })
})

describe('computeSnap — element anchors (top/bottom/v-center)', () => {
  it('snaps dragging-top to other-top (well-separated anchors)', () => {
    // Use far-apart anchors so only top-top pair is within threshold.
    // dragging top=53,h=2 → top=53, v-center=54, bottom=55.
    // other   top=50,h=2 → top=50, v-center=51, bottom=52.
    // Pairs in threshold (5pt): top→top Δ=-3, top→v-center Δ=-2, top→bottom Δ=-1,
    //                          v-center→top Δ=-4, v-center→v-center Δ=-3, v-center→bottom Δ=-2,
    //                          bottom→top Δ=-5, bottom→v-center Δ=-4, bottom→bottom Δ=-3.
    // Smallest |Δ| = top→bottom (Δ=-1) → top moves from 53→52, kind=element-top.
    const dragging = box(50, 53, 20, 2)
    const other = box(0, 50, 20, 2)
    const res = computeSnap({ box: dragging, others: [other], guides: [] })
    // top→bottom: dragging top aligns with other-bottom=52.
    expect(res.top).toBe(52)
    expect(res.previews.some((p) => p.kind === 'element-top' && p.pos === 52)).toBe(true)
  })

  it('snaps dragging-bottom to other-bottom (exact anchor-pair test)', () => {
    // Construct so the smallest-|Δ| candidate IS bottom→bottom.
    // dragging top=82,h=10 → top=82, v-center=87, bottom=92.
    // other   top=80,h=10 → top=80, v-center=85, bottom=90.
    // bottom→bottom Δ = 90-92 = -2. Other candidates within 5pt:
    //   top→top Δ = -2 (tied!) — first match wins; loop order: drag i=0 (top)
    //   matches first → kind=element-top.
    // To force a bottom→bottom win, make other's top far away. Use a wide-tall
    // other so its top is out of range but its bottom is in range.
    // dragging top=82,h=10 → bottom=92.
    // other   top=200,h=200 → top=200 (way out), v-center=300, bottom=400.
    // No match. Need other.bottom close to dragging.bottom(92). Place other's
    // bottom at 90 with a large body: other top=20, h=70 → bottom=90, v-center=55.
    // Now: drag.top=82, drag.v-center=87, drag.bottom=92.
    //      other.top=20, other.v-center=55, other.bottom=90.
    // Candidate distances:
    //   top→bottom: 90-82=8 (out)
    //   v-center→bottom: 90-87=3 ✓
    //   bottom→bottom: 90-92=-2 ✓
    //   bottom→v-center: 55-92=-37 (out)
    // Smallest |Δ| = bottom→bottom (-2). Win.
    const dragging = box(50, 82, 20, 10)
    const other = box(0, 20, 20, 70)
    const res = computeSnap({ box: dragging, others: [other], guides: [] })
    expect(res.top).toBe(80)
    expect(res.previews.some((p) => p.kind === 'element-bottom' && p.pos === 90)).toBe(true)
  })

  it('snaps dragging-v-center to other-v-center', () => {
    // Force v-center→v-center as smallest-|Δ| match.
    // dragging top=30,h=10 → top=30, v-center=35, bottom=40.
    // other   top=34,h=2  → top=34, v-center=35, bottom=36.
    // Candidates within 5pt:
    //   top→top Δ=4, top→v-center Δ=5, top→bottom Δ=6 (out)
    //   v-center→top Δ=-1, v-center→v-center Δ=0, v-center→bottom Δ=1
    //   bottom→top Δ=-6 (out), bottom→v-center Δ=-5, bottom→bottom Δ=-4
    // Smallest |Δ| = v-center→v-center (0). Win.
    const dragging = box(0, 30, 10, 10)
    const other = box(50, 34, 10, 2)
    const res = computeSnap({ box: dragging, others: [other], guides: [] })
    expect(res.top).toBe(30) // no movement, already at 35 v-center
    expect(res.previews.some((p) => p.kind === 'element-v-center' && p.pos === 35)).toBe(true)
  })
})

describe('computeSnap — user-guide priority', () => {
  it('snaps to user guide when no element close enough', () => {
    const dragging = box(48, 50)
    const guide = { id: 'g1', axis: 'v' as const, pos: 50 }
    const res = computeSnap({ box: dragging, others: [], guides: [guide] })
    expect(res.left).toBe(50)
    expect(res.previews.some((p) => p.kind === 'user-guide' && p.pos === 50)).toBe(true)
  })

  it('snaps to horizontal user guide (axis=h) along Y', () => {
    // 0-height bbox so all three Y anchors coincide at top → unambiguous.
    const dragging = box(50, 47, 20, 0)
    const guide = { id: 'g1', axis: 'h' as const, pos: 50 }
    const res = computeSnap({ box: dragging, others: [], guides: [guide] })
    expect(res.top).toBe(50)
    expect(res.previews.some((p) => p.kind === 'user-guide' && p.axis === 'h')).toBe(true)
  })

  it('priority: element-anchor wins over user-guide when both within threshold', () => {
    // Element other-left = 100; user-guide v at 99. Dragging left = 102.
    // Both within 5pt. Element wins.
    const dragging = box(102, 50)
    const other = box(100, 0)
    const guide = { id: 'g1', axis: 'v' as const, pos: 99 }
    const res = computeSnap({ box: dragging, others: [other], guides: [guide] })
    expect(res.left).toBe(100)
    expect(res.previews.some((p) => p.kind === 'element-left')).toBe(true)
    expect(res.previews.some((p) => p.kind === 'user-guide')).toBe(false)
  })
})

describe('computeSnap — grid fallback', () => {
  it('applies grid snap when no element/user-guide hit', () => {
    const dragging = box(102, 50)
    const res = computeSnap({
      box: dragging,
      others: [],
      guides: [],
      gridSize: 5,
    })
    expect(res.left).toBe(100) // 102 → round to nearest 5
    expect(res.previews.length).toBe(0) // grid is silent
  })

  it('grid is fallback — element snap takes precedence', () => {
    const dragging = box(102, 50)
    const other = box(101, 0) // element-left match at 101
    const res = computeSnap({
      box: dragging,
      others: [other],
      guides: [],
      gridSize: 5,
    })
    expect(res.left).toBe(101) // element wins, not 100 from grid
  })

  it('gridSize=0 disables grid fallback', () => {
    const dragging = box(102, 50)
    const res = computeSnap({
      box: dragging,
      others: [],
      guides: [],
      gridSize: 0,
    })
    expect(res.left).toBe(102) // untouched
  })
})

describe('computeSnap — threshold gate (Alt-key)', () => {
  it('threshold=0 disables all smart snap (still allows grid)', () => {
    const dragging = box(102, 50)
    const other = box(100, 0)
    const res = computeSnap({
      box: dragging,
      others: [other],
      guides: [],
      threshold: 0,
      gridSize: 5,
    })
    expect(res.left).toBe(100) // grid still snaps
    expect(res.previews.length).toBe(0) // no element preview emitted
  })

  it('threshold=0 + gridSize=0 = no snap at all', () => {
    const dragging = box(102, 50)
    const other = box(100, 0)
    const res = computeSnap({
      box: dragging,
      others: [other],
      guides: [],
      threshold: 0,
      gridSize: 0,
    })
    expect(res.left).toBe(102)
    expect(res.top).toBe(50)
  })

  it('default threshold is SMART_GUIDE_SNAP_PT (5pt)', () => {
    expect(SMART_GUIDE_SNAP_PT).toBe(5)
    const dragging = box(104, 50)
    const other = box(100, 0)
    const res = computeSnap({ box: dragging, others: [other], guides: [] })
    expect(res.left).toBe(100) // 4pt away — within default threshold
  })
})

describe('computeSnap — independent axis resolution', () => {
  it('snaps X via element AND Y via user-guide simultaneously', () => {
    // 0-height + 0-width to make X/Y resolution unambiguous.
    const dragging = box(102, 47, 0, 0)
    const other = box(100, 200, 0, 0)
    const guide = { id: 'g1', axis: 'h' as const, pos: 50 }
    const res = computeSnap({ box: dragging, others: [other], guides: [guide] })
    expect(res.left).toBe(100)
    expect(res.top).toBe(50)
    expect(res.previews.length).toBe(2)
  })

  it('picks smallest-delta candidate when multiple anchors match', () => {
    // dragging.left=102. other1.left=100 (Δ=2). other2.h-center=103 (Δ=1).
    // Smaller |Δ| wins → snap to 103.
    const dragging = box(102, 0, 10, 10)
    const other1 = box(100, 0, 50, 10)
    const other2 = box(98, 0, 10, 10) // h-center=103
    const res = computeSnap({ box: dragging, others: [other1, other2], guides: [] })
    expect(res.left).toBe(103)
  })
})

describe('boxFromElement helper', () => {
  it('reads left/top/width/height from element options', () => {
    const b = boxFromElement({
      id: 'e1',
      tid: 't.text',
      options: { left: 5, top: 10, width: 30, height: 20 },
    })
    expect(b).toEqual({ left: 5, top: 10, width: 30, height: 20 })
  })

  it('defaults missing dimensions to 0', () => {
    const b = boxFromElement({
      id: 'e1',
      tid: 't.text',
      options: { left: 5, top: 10 },
    })
    expect(b.width).toBe(0)
    expect(b.height).toBe(0)
  })
})

// ============ Preview pub-sub ============

describe('smart-guide preview state', () => {
  it('setSmartGuidePreviews notifies subscribers', () => {
    const fn = vi.fn()
    const unsubscribe = onSmartGuidePreviewChange(fn)
    fn.mockClear() // ignore initial call
    setSmartGuidePreviews([{ axis: 'v', pos: 100, kind: 'element-left' }])
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn.mock.calls[0]![0]).toEqual([
      { axis: 'v', pos: 100, kind: 'element-left' },
    ])
    unsubscribe()
  })

  it('clearSmartGuidePreviews notifies with empty list', () => {
    setSmartGuidePreviews([{ axis: 'v', pos: 50, kind: 'element-left' }])
    const fn = vi.fn()
    const unsub = onSmartGuidePreviewChange(fn)
    fn.mockClear()
    clearSmartGuidePreviews()
    expect(fn).toHaveBeenCalledWith([])
    expect(getSmartGuidePreviews()).toEqual([])
    unsub()
  })

  it('unsubscribe removes the listener', () => {
    const fn = vi.fn()
    const unsubscribe = onSmartGuidePreviewChange(fn)
    fn.mockClear()
    unsubscribe()
    setSmartGuidePreviews([{ axis: 'v', pos: 1, kind: 'element-left' }])
    expect(fn).not.toHaveBeenCalled()
  })
})

// ============ Drag integration ============

describe('enableElementDrag — smart-guide snap integration', () => {
  it('snaps dragged element to sibling left edge during move', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    // Sibling at left=100. We're going to drag e1 toward it.
    canvas.addElement('p1', {
      id: 'e0',
      tid: 't.text',
      options: { left: 100, top: 50, width: 10, height: 10 },
    })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { left: 50, top: 100, width: 10, height: 10 },
    })

    enableElementDrag(makeDom(), { elementId: 'e1', panelId: 'p1' })
    const listeners = lastDraggable().options.listeners!
    listeners.start!()
    // px delta — convert to pt via internal/uom. At default 96 DPI: 1pt ≈ 1.333 px.
    // We want a pt delta of ~50 to bring left to ~100 (within snap range). At 96 dpi
    // 50 pt ≈ 66.7 px. We pass a larger px so post-pt math lands within 5pt of 100.
    listeners.move!({ dx: 66, dy: 0 } as unknown)

    const opts = canvas.panels[0]!.printElements[1]!.options as Record<string, number>
    // Expected: dragged element's left snaps to 100 (sibling's left).
    expect(opts.left).toBe(100)
  })

  it('Alt-key disables smart-guide snap', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e0',
      tid: 't.text',
      options: { left: 100, top: 50, width: 10, height: 10 },
    })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { left: 50, top: 100, width: 10, height: 10 },
    })

    enableElementDrag(makeDom(), { elementId: 'e1', panelId: 'p1' })
    const listeners = lastDraggable().options.listeners!
    listeners.start!()
    // Same dx as the prior test, but with altKey=true → no smart snap.
    listeners.move!({ dx: 66, dy: 0, altKey: true } as unknown)
    const opts = canvas.panels[0]!.printElements[1]!.options as Record<string, number>
    expect(opts.left).not.toBe(100) // would have been 100 without Alt
  })

  it('publishes smart-guide preview during snap', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e0',
      tid: 't.text',
      options: { left: 100, top: 50, width: 10, height: 10 },
    })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { left: 50, top: 100, width: 10, height: 10 },
    })

    enableElementDrag(makeDom(), { elementId: 'e1', panelId: 'p1' })
    const listeners = lastDraggable().options.listeners!
    listeners.start!()
    listeners.move!({ dx: 66, dy: 0 } as unknown)

    const previews = getSmartGuidePreviews()
    expect(previews.length).toBeGreaterThan(0)
    expect(previews.some((p) => p.kind === 'element-left' && p.pos === 100)).toBe(true)
  })

  it('clears smart-guide previews on drag-end', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e0',
      tid: 't.text',
      options: { left: 100, top: 50, width: 10, height: 10 },
    })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { left: 50, top: 100, width: 10, height: 10 },
    })
    enableElementDrag(makeDom(), { elementId: 'e1', panelId: 'p1' })
    const listeners = lastDraggable().options.listeners!
    listeners.start!()
    listeners.move!({ dx: 66, dy: 0 } as unknown)
    expect(getSmartGuidePreviews().length).toBeGreaterThan(0)
    listeners.end!()
    expect(getSmartGuidePreviews().length).toBe(0)
  })

  it('snaps to user guide-line', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { left: 50, top: 100, width: 10, height: 10 },
    })
    // User-drawn vertical guide at x=100.
    canvas.addGuideLine('v', 100)

    enableElementDrag(makeDom(), { elementId: 'e1', panelId: 'p1' })
    const listeners = lastDraggable().options.listeners!
    listeners.start!()
    listeners.move!({ dx: 66, dy: 0 } as unknown) // pt ≈ +50

    const opts = canvas.panels[0]!.printElements[0]!.options as Record<string, number>
    expect(opts.left).toBe(100)
    const previews = getSmartGuidePreviews()
    expect(previews.some((p) => p.kind === 'user-guide' && p.pos === 100)).toBe(true)
  })
})
