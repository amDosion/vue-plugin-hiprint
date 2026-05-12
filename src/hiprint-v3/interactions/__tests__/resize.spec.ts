/**
 * resize.spec.ts — V3 element resize unit tests.
 *
 * happy-dom can't simulate real pointer events through interact.js's full
 * pipeline; instead we mock the `interactjs` module to capture the
 * resizable config + manually fire its `listeners.start/move/end` hooks.
 *
 * This validates:
 *   - enableElementResize wires interact.js correctly (edges, modifiers).
 *   - onResize callback receives the right rect on simulated move.
 *   - aspect-ratio lock (opts.lockAspectRatio + Shift dynamic).
 *   - min dimensions clamp via restrictSize modifier.
 *   - grid snap via snapSize modifier.
 *   - cleanup unsets handlers.
 *   - listener exceptions are caught (P14 R3).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// -----------------------------------------------------------------------------
// Mock interactjs BEFORE importing the module under test.
//
// Use vi.hoisted() so the mock objects are available at the point of the
// hoisted vi.mock() factory.
// -----------------------------------------------------------------------------

/** Captured config from the most recent .resizable() call. */
interface CapturedConfig {
  edges: {
    top?: boolean
    right?: boolean
    bottom?: boolean
    left?: boolean
  }
  modifiers: any[]
  listeners: {
    start?: (event: any) => void
    move?: (event: any) => void
    end?: (event: any) => void
  }
}

const { mockInteract, capturedConfigs, unsetCalls } = vi.hoisted(() => {
  const capturedConfigs = new WeakMap<object, CapturedConfig>()
  const unsetCalls: object[] = []
  const mockInteract = vi.fn((el: object) => {
    return {
      resizable(opts: any) {
        capturedConfigs.set(el, {
          edges: opts.edges ?? {},
          modifiers: opts.modifiers ?? [],
          listeners: opts.listeners ?? {},
        })
        return this
      },
      unset() {
        unsetCalls.push(el)
      },
    }
  }) as any
  mockInteract.modifiers = {
    restrictSize: vi.fn((opts: any) => ({ type: 'restrictSize', opts })),
    snapSize: vi.fn((opts: any) => ({ type: 'snapSize', opts })),
  }
  mockInteract.snappers = {
    grid: vi.fn((opts: any) => ({ type: 'grid', opts })),
  }
  return { mockInteract, capturedConfigs, unsetCalls }
})

vi.mock('interactjs', () => ({
  default: mockInteract,
}))

// Now import the module under test.
import {
  enableElementResize,
  disableElementResize,
  getHandlesForType,
  handlesToEdges,
  HANDLE_MAP,
  DEFAULT_HANDLES,
  type ResizeRect,
} from '../resize'

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Create an absolutely-positioned element with pt-domain style. */
function makeEl(initial: ResizeRect): HTMLElement {
  const el = document.createElement('div')
  el.style.position = 'absolute'
  el.style.left = `${initial.left}pt`
  el.style.top = `${initial.top}pt`
  el.style.width = `${initial.width}pt`
  el.style.height = `${initial.height}pt`
  document.body.appendChild(el)
  return el
}

/** Retrieve the captured config for `el`, or throw if missing. */
function getCfg(el: HTMLElement): CapturedConfig {
  const c = capturedConfigs.get(el)
  if (!c) throw new Error('No captured config for element')
  return c
}

// In happy-dom, DPI fallback is 96 → 1pt ≈ 1.333px (same constants as runtime).
const DPI = 96
const PT_PER_PX = 72 / DPI // 0.75
const PX_PER_PT = DPI / 72 // 1.333…

beforeEach(() => {
  mockInteract.mockClear()
  unsetCalls.length = 0
  mockInteract.modifiers.restrictSize.mockClear()
  mockInteract.modifiers.snapSize.mockClear()
  mockInteract.snappers.grid.mockClear()
})

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('enableElementResize', () => {
  it('wires interact(el).resizable with default 4-edge config', () => {
    const el = makeEl({ left: 10, top: 10, width: 100, height: 50 })
    enableElementResize(el, { elementId: 'e1', panelId: 'p1' })

    expect(mockInteract).toHaveBeenCalledWith(el)
    const cfg = getCfg(el)
    expect(cfg.edges).toEqual({
      top: true,
      right: true,
      bottom: true,
      left: true,
    })
  })

  it('respects opts.edges (only enable right + bottom)', () => {
    const el = makeEl({ left: 0, top: 0, width: 80, height: 40 })
    enableElementResize(el, {
      elementId: 'e1',
      panelId: 'p1',
      edges: { right: true, bottom: true },
    })

    const cfg = getCfg(el)
    expect(cfg.edges.top).toBeFalsy()
    expect(cfg.edges.left).toBeFalsy()
    expect(cfg.edges.right).toBe(true)
    expect(cfg.edges.bottom).toBe(true)
  })

  it('installs restrictSize modifier with min dimensions in px', () => {
    const el = makeEl({ left: 0, top: 0, width: 80, height: 40 })
    enableElementResize(el, {
      elementId: 'e1',
      panelId: 'p1',
      minWidth: 10,
      minHeight: 8,
    })

    expect(mockInteract.modifiers.restrictSize).toHaveBeenCalledOnce()
    const arg = mockInteract.modifiers.restrictSize.mock.calls[0]?.[0]
    expect(arg.min.width).toBeCloseTo(10 * PX_PER_PT, 4)
    expect(arg.min.height).toBeCloseTo(8 * PX_PER_PT, 4)
  })

  it('installs snapSize modifier when gridSize > 1', () => {
    const el = makeEl({ left: 0, top: 0, width: 80, height: 40 })
    enableElementResize(el, {
      elementId: 'e1',
      panelId: 'p1',
      gridSize: 5,
    })

    expect(mockInteract.modifiers.snapSize).toHaveBeenCalledOnce()
    expect(mockInteract.snappers.grid).toHaveBeenCalledOnce()
    const gridOpts = mockInteract.snappers.grid.mock.calls[0]?.[0]
    expect(gridOpts.width).toBeCloseTo(5 * PX_PER_PT, 4)
    expect(gridOpts.height).toBeCloseTo(5 * PX_PER_PT, 4)
  })

  it('does NOT install snapSize when gridSize is 1 (default)', () => {
    const el = makeEl({ left: 0, top: 0, width: 80, height: 40 })
    enableElementResize(el, { elementId: 'e1', panelId: 'p1' })

    expect(mockInteract.modifiers.snapSize).not.toHaveBeenCalled()
  })

  it('fires onResize with rect in pt on simulated move', () => {
    const el = makeEl({ left: 10, top: 20, width: 100, height: 50 })
    const onResize = vi.fn()
    enableElementResize(el, {
      elementId: 'e1',
      panelId: 'p1',
      onResize,
    })

    const cfg = getCfg(el)
    // Simulate start (captures aspect ratio).
    cfg.listeners.start?.({
      rect: { width: 100 * PX_PER_PT, height: 50 * PX_PER_PT },
      shiftKey: false,
    })
    // Simulate move — grow width by 20px, no top/left delta.
    cfg.listeners.move?.({
      rect: { width: 120 * PX_PER_PT, height: 50 * PX_PER_PT },
      deltaRect: { left: 0, top: 0 },
      shiftKey: false,
    })

    expect(onResize).toHaveBeenCalledOnce()
    const got = onResize.mock.calls[0]?.[0] as ResizeRect
    expect(got.width).toBeCloseTo(120, 1)
    expect(got.height).toBeCloseTo(50, 1)
    expect(got.left).toBeCloseTo(10, 1)
    expect(got.top).toBeCloseTo(20, 1)
  })

  it('locks aspect ratio when opts.lockAspectRatio=true', () => {
    const el = makeEl({ left: 0, top: 0, width: 100, height: 50 }) // ratio 2:1
    const onResize = vi.fn()
    enableElementResize(el, {
      elementId: 'e1',
      panelId: 'p1',
      lockAspectRatio: true,
      onResize,
    })

    const cfg = getCfg(el)
    cfg.listeners.start?.({
      rect: { width: 100 * PX_PER_PT, height: 50 * PX_PER_PT },
      shiftKey: false,
    })
    // User drags right edge to make width 200 → height should follow to 100.
    cfg.listeners.move?.({
      rect: { width: 200 * PX_PER_PT, height: 80 * PX_PER_PT }, // raw px says 80
      deltaRect: { left: 0, top: 0 }, // horizontal delta dominates
      shiftKey: false,
    })

    const got = onResize.mock.calls[0]?.[0] as ResizeRect
    expect(got.width).toBeCloseTo(200, 1)
    // Aspect lock: 200 / 2 = 100, NOT the raw 80px → 60pt.
    expect(got.height).toBeCloseTo(100, 1)
  })

  it('locks aspect ratio dynamically when Shift held on move', () => {
    const el = makeEl({ left: 0, top: 0, width: 100, height: 50 })
    const onResize = vi.fn()
    enableElementResize(el, {
      elementId: 'e1',
      panelId: 'p1',
      onResize,
    })

    const cfg = getCfg(el)
    cfg.listeners.start?.({
      rect: { width: 100 * PX_PER_PT, height: 50 * PX_PER_PT },
      shiftKey: false,
    })
    // Move with Shift held — should lock.
    cfg.listeners.move?.({
      rect: { width: 200 * PX_PER_PT, height: 80 * PX_PER_PT },
      deltaRect: { left: 0, top: 0 },
      shiftKey: true,
    })

    const got = onResize.mock.calls[0]?.[0] as ResizeRect
    expect(got.height).toBeCloseTo(100, 1) // locked
  })

  it('clamps to minWidth / minHeight after snap', () => {
    const el = makeEl({ left: 0, top: 0, width: 100, height: 50 })
    const onResize = vi.fn()
    enableElementResize(el, {
      elementId: 'e1',
      panelId: 'p1',
      minWidth: 20,
      minHeight: 15,
      onResize,
    })

    const cfg = getCfg(el)
    cfg.listeners.start?.({
      rect: { width: 100 * PX_PER_PT, height: 50 * PX_PER_PT },
      shiftKey: false,
    })
    // Move attempts to shrink below mins.
    cfg.listeners.move?.({
      rect: { width: 5 * PX_PER_PT, height: 5 * PX_PER_PT },
      deltaRect: { left: 95, top: 45 },
      shiftKey: false,
    })

    const got = onResize.mock.calls[0]?.[0] as ResizeRect
    expect(got.width).toBeGreaterThanOrEqual(20)
    expect(got.height).toBeGreaterThanOrEqual(15)
  })

  it('snaps width/height to gridSize on move', () => {
    const el = makeEl({ left: 0, top: 0, width: 100, height: 50 })
    const onResize = vi.fn()
    enableElementResize(el, {
      elementId: 'e1',
      panelId: 'p1',
      gridSize: 10,
      onResize,
    })

    const cfg = getCfg(el)
    cfg.listeners.start?.({
      rect: { width: 100 * PX_PER_PT, height: 50 * PX_PER_PT },
      shiftKey: false,
    })
    // 117pt should snap to 120; 47pt should snap to 50.
    cfg.listeners.move?.({
      rect: { width: 117 * PX_PER_PT, height: 47 * PX_PER_PT },
      deltaRect: { left: 0, top: 0 },
      shiftKey: false,
    })

    const got = onResize.mock.calls[0]?.[0] as ResizeRect
    expect(got.width % 10).toBe(0)
    expect(got.height % 10).toBe(0)
  })

  it('fires onEnd with final rect on resize end', () => {
    const el = makeEl({ left: 10, top: 20, width: 100, height: 50 })
    const onEnd = vi.fn()
    enableElementResize(el, {
      elementId: 'e1',
      panelId: 'p1',
      onEnd,
    })

    const cfg = getCfg(el)
    cfg.listeners.start?.({
      rect: { width: 100 * PX_PER_PT, height: 50 * PX_PER_PT },
      shiftKey: false,
    })
    cfg.listeners.move?.({
      rect: { width: 150 * PX_PER_PT, height: 75 * PX_PER_PT },
      deltaRect: { left: 0, top: 0 },
      shiftKey: false,
    })
    cfg.listeners.end?.({})

    expect(onEnd).toHaveBeenCalledOnce()
    const got = onEnd.mock.calls[0]?.[0] as ResizeRect
    expect(got.width).toBeCloseTo(150, 1)
    expect(got.height).toBeCloseTo(75, 1)
  })

  it('cleanup() unsets interact handlers', () => {
    const el = makeEl({ left: 0, top: 0, width: 80, height: 40 })
    const cleanup = enableElementResize(el, {
      elementId: 'e1',
      panelId: 'p1',
    })

    cleanup()
    expect(unsetCalls).toContain(el)
  })

  it('isolates onResize exceptions (P14 R3)', () => {
    const el = makeEl({ left: 0, top: 0, width: 80, height: 40 })
    const onResize = vi.fn(() => {
      throw new Error('boom')
    })
    // Silence the warn so test output stays clean.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    enableElementResize(el, {
      elementId: 'e1',
      panelId: 'p1',
      onResize,
    })

    const cfg = getCfg(el)
    cfg.listeners.start?.({
      rect: { width: 80 * PX_PER_PT, height: 40 * PX_PER_PT },
      shiftKey: false,
    })
    expect(() =>
      cfg.listeners.move?.({
        rect: { width: 90 * PX_PER_PT, height: 40 * PX_PER_PT },
        deltaRect: { left: 0, top: 0 },
        shiftKey: false,
      })
    ).not.toThrow()

    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})

describe('disableElementResize', () => {
  it('is idempotent — safe to call twice', () => {
    const el = makeEl({ left: 0, top: 0, width: 80, height: 40 })
    enableElementResize(el, { elementId: 'e1', panelId: 'p1' })
    expect(() => {
      disableElementResize(el)
      disableElementResize(el)
    }).not.toThrow()
  })

  // 1 pt ≈ 1.333 px sanity check (DPI 96 in happy-dom).
  it('happy-dom DPI assumption', () => {
    expect(PT_PER_PX).toBeCloseTo(0.75, 4)
  })
})

// -----------------------------------------------------------------------------
// TKT-163 — etype-aware HANDLE_MAP + opts.handles wiring.
// V1 references: docs/V1-INVENTORY/etypes/shapes.md quirk #5,
//                docs/V1-INVENTORY/etypes/image-html.md §F.1.
// -----------------------------------------------------------------------------

describe('TKT-163 — HANDLE_MAP per-etype overrides', () => {
  it('default vocabulary is all 8 handles', () => {
    expect(DEFAULT_HANDLES.length).toBe(8)
    expect(new Set(DEFAULT_HANDLES)).toEqual(
      new Set(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'])
    )
  })

  it('HANDLE_MAP encodes V1 quirks for shapes + image', () => {
    expect(HANDLE_MAP.hline).toEqual(['e', 'w'])
    expect(HANDLE_MAP.vline).toEqual(['n', 's'])
    expect(HANDLE_MAP.rect).toEqual(['s', 'w', 'e', 'se'])
    expect(HANDLE_MAP.oval).toEqual(['s', 'w', 'e', 'se'])
    expect(HANDLE_MAP.image).toEqual(['nw', 'ne', 'sw', 'se'])
  })

  it('getHandlesForType returns DEFAULT_HANDLES for unknown etypes', () => {
    expect(getHandlesForType('text')).toEqual(DEFAULT_HANDLES)
    expect(getHandlesForType('longText')).toEqual(DEFAULT_HANDLES)
    expect(getHandlesForType('barcode')).toEqual(DEFAULT_HANDLES)
    expect(getHandlesForType('qrcode')).toEqual(DEFAULT_HANDLES)
    expect(getHandlesForType('html')).toEqual(DEFAULT_HANDLES)
    expect(getHandlesForType('table')).toEqual(DEFAULT_HANDLES)
    expect(getHandlesForType('totally-made-up')).toEqual(DEFAULT_HANDLES)
    expect(getHandlesForType(null)).toEqual(DEFAULT_HANDLES)
    expect(getHandlesForType(undefined)).toEqual(DEFAULT_HANDLES)
  })

  it('handlesToEdges derives cardinal edges from a handle whitelist', () => {
    // hline → only e + w edges.
    expect(handlesToEdges(['e', 'w'])).toEqual({
      top: false,
      right: true,
      bottom: false,
      left: true,
    })
    // vline → only n + s edges.
    expect(handlesToEdges(['n', 's'])).toEqual({
      top: true,
      right: false,
      bottom: true,
      left: false,
    })
    // rect (V1 quirk: no top) → s + w + e + se. SE contributes BOTH s + e but
    // the top edge MUST remain false.
    expect(handlesToEdges(['s', 'w', 'e', 'se'])).toEqual({
      top: false,
      right: true,
      bottom: true,
      left: true,
    })
    // image corners → all four edges (each corner touches two edges).
    expect(handlesToEdges(['nw', 'ne', 'sw', 'se'])).toEqual({
      top: true,
      right: true,
      bottom: true,
      left: true,
    })
  })

  it('enableElementResize uses opts.handles to constrain interact.js edges', () => {
    const el = makeEl({ left: 0, top: 0, width: 80, height: 40 })
    enableElementResize(el, {
      elementId: 'e1',
      panelId: 'p1',
      handles: HANDLE_MAP.rect,
    })
    const cfg = getCfg(el)
    // rect quirk: NO top edge.
    expect(cfg.edges.top).toBe(false)
    expect(cfg.edges.right).toBe(true)
    expect(cfg.edges.bottom).toBe(true)
    expect(cfg.edges.left).toBe(true)
  })

  it('opts.handles takes precedence over opts.edges (TKT-163 contract)', () => {
    const el = makeEl({ left: 0, top: 0, width: 80, height: 40 })
    enableElementResize(el, {
      elementId: 'e1',
      panelId: 'p1',
      // edges asks for everything,
      edges: { top: true, right: true, bottom: true, left: true },
      // handles narrows it down to hline (e + w only).
      handles: HANDLE_MAP.hline,
    })
    const cfg = getCfg(el)
    expect(cfg.edges.top).toBe(false)
    expect(cfg.edges.bottom).toBe(false)
    expect(cfg.edges.right).toBe(true)
    expect(cfg.edges.left).toBe(true)
  })
})
