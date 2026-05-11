/**
 * panel-reflow.spec.ts — ResizeObserver watcher unit tests.
 *
 * happy-dom ships a no-op ResizeObserver stub (observe/unobserve/disconnect
 * are documented "not implemented"), so we install a controllable polyfill on
 * `globalThis.ResizeObserver` that lets us manually fire entries from tests.
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from 'vitest'

// -----------------------------------------------------------------------------
// Controllable ResizeObserver polyfill.
// -----------------------------------------------------------------------------

interface ROEntry {
  contentRect: { width: number; height: number }
  borderBoxSize?: ReadonlyArray<{ inlineSize: number; blockSize: number }>
}

class TestResizeObserver {
  readonly callback: (entries: ROEntry[]) => void
  readonly observed: HTMLElement[] = []
  disconnected = false

  static instances: TestResizeObserver[] = []

  constructor(cb: (entries: ROEntry[]) => void) {
    this.callback = cb
    TestResizeObserver.instances.push(this)
  }
  observe(el: HTMLElement): void {
    this.observed.push(el)
  }
  unobserve(_el: HTMLElement): void {
    /* no-op for tests */
  }
  disconnect(): void {
    this.disconnected = true
  }
  /** Test hook: synchronously fire one resize entry. */
  fire(entry: ROEntry): void {
    this.callback([entry])
  }
}

const originalRO = (globalThis as any).ResizeObserver
beforeAll(() => {
  ;(globalThis as any).ResizeObserver = TestResizeObserver as any
})
afterAll(() => {
  ;(globalThis as any).ResizeObserver = originalRO
})

beforeEach(() => {
  TestResizeObserver.instances.length = 0
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

// Now import the module under test (after the polyfill is installed in
// beforeAll — but module-level code only runs once, and watchPanelSize reads
// `ResizeObserver` lazily inside its function body so the polyfill is picked
// up on each call).
import { watchPanelSize } from '../panel-reflow'

// happy-dom DPI = 96 → 1 px = 0.75 pt
const PT_PER_PX = 72 / 96

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('watchPanelSize', () => {
  it('instantiates a ResizeObserver and observes the element', () => {
    const el = document.createElement('div')
    const stop = watchPanelSize(el, () => {})

    expect(TestResizeObserver.instances).toHaveLength(1)
    const inst = TestResizeObserver.instances[0]!
    expect(inst.observed).toContain(el)

    stop()
  })

  it('debounces onResize callback (default 50ms)', () => {
    const el = document.createElement('div')
    const onResize = vi.fn()
    const stop = watchPanelSize(el, onResize)

    const inst = TestResizeObserver.instances[0]!
    // Fire 3 rapid resize entries.
    inst.fire({ contentRect: { width: 100, height: 50 } })
    inst.fire({ contentRect: { width: 110, height: 50 } })
    inst.fire({ contentRect: { width: 120, height: 50 } })

    // Before debounce flush:
    expect(onResize).not.toHaveBeenCalled()

    // Advance past debounce.
    vi.advanceTimersByTime(60)

    expect(onResize).toHaveBeenCalledOnce()
    const got = onResize.mock.calls[0]?.[0]
    expect(got.width).toBeCloseTo(120 * PT_PER_PX, 3)
    expect(got.height).toBeCloseTo(50 * PT_PER_PX, 3)

    stop()
  })

  it('reports size in pt (px → pt conversion via internal/uom)', () => {
    const el = document.createElement('div')
    const onResize = vi.fn()
    watchPanelSize(el, onResize)

    const inst = TestResizeObserver.instances[0]!
    inst.fire({ contentRect: { width: 96, height: 48 } }) // exactly 1in × 0.5in

    vi.advanceTimersByTime(60)

    const got = onResize.mock.calls[0]?.[0]
    // 96 px at DPI 96 = 1 inch = 72 pt.
    expect(got.width).toBeCloseTo(72, 1)
    expect(got.height).toBeCloseTo(36, 1)
  })

  it('prefers borderBoxSize over contentRect when both present', () => {
    const el = document.createElement('div')
    const onResize = vi.fn()
    watchPanelSize(el, onResize)

    const inst = TestResizeObserver.instances[0]!
    inst.fire({
      contentRect: { width: 100, height: 100 },
      borderBoxSize: [{ inlineSize: 200, blockSize: 80 }],
    })

    vi.advanceTimersByTime(60)

    const got = onResize.mock.calls[0]?.[0]
    expect(got.width).toBeCloseTo(200 * PT_PER_PX, 3)
    expect(got.height).toBeCloseTo(80 * PT_PER_PX, 3)
  })

  it('skips redundant entries with identical size', () => {
    const el = document.createElement('div')
    const onResize = vi.fn()
    watchPanelSize(el, onResize)

    const inst = TestResizeObserver.instances[0]!
    inst.fire({ contentRect: { width: 100, height: 50 } })
    vi.advanceTimersByTime(60)
    expect(onResize).toHaveBeenCalledOnce()

    // Same size again → debounce should NOT schedule another call.
    inst.fire({ contentRect: { width: 100, height: 50 } })
    vi.advanceTimersByTime(60)
    expect(onResize).toHaveBeenCalledOnce()
  })

  it('cleanup disconnects the observer and cancels pending callbacks', () => {
    const el = document.createElement('div')
    const onResize = vi.fn()
    const stop = watchPanelSize(el, onResize)

    const inst = TestResizeObserver.instances[0]!
    inst.fire({ contentRect: { width: 100, height: 50 } })
    // Stop BEFORE debounce fires.
    stop()
    vi.advanceTimersByTime(100)

    expect(inst.disconnected).toBe(true)
    expect(onResize).not.toHaveBeenCalled()
  })

  it('isolates onResize exceptions (P14 R3)', () => {
    const el = document.createElement('div')
    const onResize = vi.fn(() => {
      throw new Error('boom')
    })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    watchPanelSize(el, onResize)
    const inst = TestResizeObserver.instances[0]!
    inst.fire({ contentRect: { width: 100, height: 50 } })
    expect(() => vi.advanceTimersByTime(60)).not.toThrow()
    expect(warnSpy).toHaveBeenCalled()

    warnSpy.mockRestore()
  })

  it('respects custom debounceMs option', () => {
    const el = document.createElement('div')
    const onResize = vi.fn()
    watchPanelSize(el, onResize, { debounceMs: 200 })

    const inst = TestResizeObserver.instances[0]!
    inst.fire({ contentRect: { width: 100, height: 50 } })

    vi.advanceTimersByTime(50)
    expect(onResize).not.toHaveBeenCalled()
    vi.advanceTimersByTime(200)
    expect(onResize).toHaveBeenCalledOnce()
  })

  it('returns no-op cleanup if ResizeObserver is unavailable', () => {
    const el = document.createElement('div')
    const saved = (globalThis as any).ResizeObserver
    ;(globalThis as any).ResizeObserver = undefined
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const stop = watchPanelSize(el, () => {})
    expect(() => stop()).not.toThrow()
    expect(warnSpy).toHaveBeenCalled()

    ;(globalThis as any).ResizeObserver = saved
    warnSpy.mockRestore()
  })
})
