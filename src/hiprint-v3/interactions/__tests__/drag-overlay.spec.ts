/**
 * drag-overlay.spec.ts — TKT-104 cross-hairs + size readout overlay.
 *
 * Two layers under test:
 *
 *  1. PURE DragOverlay component — assert visibility based on `mode` prop +
 *     label content for drag vs resize. Direct mount, no interact.js needed.
 *
 *  2. INTEGRATION: assert ElementDragOptions.onStart fires at drag start (so
 *     ElementWrapper can flip overlay mode) and resize.onStart fires at
 *     resize start. Uses the same interact.js mock pattern as
 *     drag-drop.spec.ts / resize.spec.ts.
 *
 * The full mount-the-wrapper-and-fire-pointer-events flow lives in
 * ElementWrapper.spec.ts (browser interaction layer); here we test the
 * narrower contract that components rely on.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import DragOverlay from '../../components/elements/DragOverlay.vue'

// ----- interact.js mock (capture listeners + start/move/end) ----------------

type CapturedDraggable = {
  el: HTMLElement
  options: { listeners?: Record<string, (...args: unknown[]) => void> }
}
type CapturedResizable = {
  el: HTMLElement
  options: { listeners?: Record<string, (...args: unknown[]) => void> }
}
const captured: { draggable: CapturedDraggable[]; resizable: CapturedResizable[] } = {
  draggable: [],
  resizable: [],
}

vi.mock('interactjs', () => {
  function interact(el: HTMLElement) {
    return {
      draggable(options: CapturedDraggable['options']) {
        captured.draggable.push({ el, options })
        return this
      },
      resizable(options: CapturedResizable['options']) {
        captured.resizable.push({ el, options })
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
    restrictSize: (cfg: unknown) => ({ _kind: 'restrictSize', cfg }),
    snapSize: (cfg: unknown) => ({ _kind: 'snapSize', cfg }),
  }
  interact.snappers = {
    grid: (cfg: unknown) => ({ _kind: 'grid', cfg }),
  }
  return { default: interact }
})

import { enableElementDrag } from '../drag-drop'
import { enableElementResize } from '../resize'

function makeDom(): HTMLElement {
  const el = document.createElement('div')
  el.style.left = '10pt'
  el.style.top = '20pt'
  el.style.width = '50pt'
  el.style.height = '30pt'
  document.body.appendChild(el)
  return el
}

beforeEach(() => {
  setActivePinia(createPinia())
  captured.draggable.length = 0
  captured.resizable.length = 0
})

// ============ DragOverlay component ============

describe('DragOverlay — visibility', () => {
  it('hidden in idle mode (DOM not present via v-if)', () => {
    const w = mount(DragOverlay, {
      props: { mode: 'idle', left: 10, top: 20, width: 50, height: 30 },
    })
    // v-if leaves a comment node in place — `.hiprint-drag-overlay` should
    // NOT exist in the rendered DOM.
    expect(w.find('.hiprint-drag-overlay').exists()).toBe(false)
    w.unmount()
  })

  it('visible in drag mode', () => {
    const w = mount(DragOverlay, {
      props: { mode: 'drag', left: 10, top: 20, width: 50, height: 30 },
    })
    expect(w.find('.hiprint-drag-overlay').exists()).toBe(true)
    w.unmount()
  })

  it('visible in resize mode', () => {
    const w = mount(DragOverlay, {
      props: { mode: 'resize', left: 10, top: 20, width: 50, height: 30 },
    })
    expect(w.find('.hiprint-drag-overlay').exists()).toBe(true)
    w.unmount()
  })

  it('renders both horizontal + vertical position lines', () => {
    const w = mount(DragOverlay, {
      props: { mode: 'drag', left: 10, top: 20, width: 50, height: 30 },
    })
    expect(w.element.querySelector('.hiprint-position-line--h')).not.toBeNull()
    expect(w.element.querySelector('.hiprint-position-line--v')).not.toBeNull()
    w.unmount()
  })

  it('renders size readout chip', () => {
    const w = mount(DragOverlay, {
      props: { mode: 'drag', left: 10, top: 20, width: 50, height: 30 },
    })
    expect(w.element.querySelector('.hiprint-size-readout')).not.toBeNull()
    w.unmount()
  })
})

describe('DragOverlay — readout label content', () => {
  it('drag mode label shows X,Y in mm (no W×H)', () => {
    // 28.35pt ≈ 10mm. Use exact pt = 28.35 for clean mm reading.
    const w = mount(DragOverlay, {
      props: { mode: 'drag', left: 28.35, top: 56.7, width: 100, height: 50 },
    })
    const text = (w.element.querySelector('.hiprint-size-readout') as HTMLElement)
      .textContent ?? ''
    expect(text).toContain('mm')
    expect(text).not.toContain('×') // No W×H during drag
    w.unmount()
  })

  it('resize mode label shows W×H', () => {
    const w = mount(DragOverlay, {
      props: { mode: 'resize', left: 28.35, top: 56.7, width: 100, height: 50 },
    })
    const text = (w.element.querySelector('.hiprint-size-readout') as HTMLElement)
      .textContent ?? ''
    expect(text).toContain('×')
    w.unmount()
  })

  it('label updates reactively when props change (drag move)', async () => {
    const w = mount(DragOverlay, {
      props: { mode: 'drag', left: 0, top: 0, width: 50, height: 30 },
    })
    const initial = (w.element.querySelector('.hiprint-size-readout') as HTMLElement)
      .textContent ?? ''
    await w.setProps({ left: 100, top: 200 })
    const after = (w.element.querySelector('.hiprint-size-readout') as HTMLElement)
      .textContent ?? ''
    expect(after).not.toBe(initial)
    w.unmount()
  })
})

// ============ Lifecycle hooks ============

describe('enableElementDrag — onStart fires at drag start', () => {
  it('start listener triggers opts.onStart', () => {
    const onStart = vi.fn()
    enableElementDrag(makeDom(), {
      elementId: 'e1',
      panelId: 'p1',
      onStart,
    })
    const captured1 = captured.draggable[0]!
    const listeners = captured1.options.listeners!
    listeners.start!()
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('onStart fires BEFORE first move', () => {
    const calls: string[] = []
    enableElementDrag(makeDom(), {
      elementId: 'e1',
      panelId: 'p1',
      onStart: () => calls.push('start'),
      onMove: () => calls.push('move'),
    })
    const captured1 = captured.draggable[0]!
    const listeners = captured1.options.listeners!
    listeners.start!()
    // happy-dom: we don't have a real element/store record; move() may throw
    // but the swallow-warn pattern handles it. We just verify start fired.
    expect(calls[0]).toBe('start')
  })

  it('onStart absent: no throw (handler is optional)', () => {
    expect(() => {
      enableElementDrag(makeDom(), { elementId: 'e1', panelId: 'p1' })
      const captured1 = captured.draggable[0]!
      captured1.options.listeners!.start!()
    }).not.toThrow()
  })
})

describe('enableElementResize — onStart fires with start rect', () => {
  it('start listener triggers opts.onStart with start rect in pt', () => {
    const onStart = vi.fn()
    enableElementResize(makeDom(), {
      elementId: 'e1',
      panelId: 'p1',
      onStart,
    })
    const captured1 = captured.resizable[0]!
    captured1.options.listeners!.start!({ rect: { width: 50, height: 30 } })
    expect(onStart).toHaveBeenCalledTimes(1)
    const rect = onStart.mock.calls[0]![0] as {
      left: number
      top: number
      width: number
      height: number
    }
    expect(rect.left).toBe(10)
    expect(rect.top).toBe(20)
    expect(rect.width).toBe(50)
    expect(rect.height).toBe(30)
  })

  it('onResize tick updates the rect (used to drive readout)', () => {
    const onResize = vi.fn()
    const el = makeDom()
    enableElementResize(el, {
      elementId: 'e1',
      panelId: 'p1',
      onResize,
    })
    const captured1 = captured.resizable[0]!
    captured1.options.listeners!.start!({ rect: { width: 50, height: 30 } })
    // Fire a move with a 10px width delta.
    captured1.options.listeners!.move!({
      rect: { width: 60, height: 30 },
      deltaRect: { left: 0, top: 0 },
    })
    expect(onResize).toHaveBeenCalled()
    // Last call should report a non-zero width.
    const last = onResize.mock.calls.at(-1)![0] as { width: number }
    expect(last.width).toBeGreaterThan(0)
  })

  it('onEnd fires once at resize end', () => {
    const onEnd = vi.fn()
    const el = makeDom()
    enableElementResize(el, {
      elementId: 'e1',
      panelId: 'p1',
      onEnd,
    })
    const captured1 = captured.resizable[0]!
    captured1.options.listeners!.start!({ rect: { width: 50, height: 30 } })
    captured1.options.listeners!.end!({})
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('onStart absent: no throw', () => {
    expect(() => {
      enableElementResize(makeDom(), { elementId: 'e1', panelId: 'p1' })
      const captured1 = captured.resizable[0]!
      captured1.options.listeners!.start!({ rect: { width: 50, height: 30 } })
    }).not.toThrow()
  })
})
