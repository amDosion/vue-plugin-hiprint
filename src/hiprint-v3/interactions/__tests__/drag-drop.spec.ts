/**
 * drag-drop.spec.ts — V3 interaction module behavior (P16.1).
 *
 * Covers:
 *  - enableElementDrag wiring + single vs multi-select dispatch
 *  - enableElementDrag onMove / onEnd callbacks fire with pt deltas
 *  - enableElementListSource marks element with hiprint-list-source + data-tid
 *  - enablePanelDropZone:
 *      - cross-panel drop calls moveElementBetweenPanels
 *      - same-panel drop is a no-op (move handler owns it)
 *      - list-source drop calls addElement with correct tid
 *      - invalid drops (missing data-*) are swallowed safely
 *  - disableInteractions cleans up + is idempotent
 *  - Error handling: handler exceptions don't propagate (warn instead)
 *
 * Strategy: happy-dom does not faithfully simulate pointer event sequences,
 * so we directly invoke the listeners interact.js registers. We use the
 * fact that interact(el).draggable() / .dropzone() return an Interactable
 * whose registered listeners are accessible via the interactable's internals.
 *
 * To avoid coupling to interact.js internals, we instead **inject** the
 * listener invocation by spying on the canvas store actions and asserting
 * the store mutates correctly when listeners run. Listeners are extracted by
 * replacing interact.js's draggable() at module load via vi.mock.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// --- interact.js mock: capture options passed to draggable() / dropzone() ---
// We must declare this BEFORE importing the SUT.
type CapturedDraggable = {
  el: HTMLElement
  options: { listeners?: Record<string, (...args: unknown[]) => void> }
}
type CapturedDropzone = {
  el: HTMLElement
  options: {
    accept?: string
    ondrop?: (event: { relatedTarget: HTMLElement }) => void
  }
}

const captured: {
  draggable: CapturedDraggable[]
  dropzone: CapturedDropzone[]
  unsetCount: number
} = { draggable: [], dropzone: [], unsetCount: 0 }

vi.mock('interactjs', () => {
  function interact(el: HTMLElement) {
    return {
      draggable(options: CapturedDraggable['options']) {
        captured.draggable.push({ el, options })
        return this
      },
      dropzone(options: CapturedDropzone['options']) {
        captured.dropzone.push({ el, options })
        return this
      },
      unset() {
        captured.unsetCount++
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
  enableElementDrag,
  enableElementListSource,
  enablePanelDropZone,
  disableInteractions,
} from '../drag-drop'
import { useCanvasStore } from '@hiprint-v3/stores'

function makeEl(): HTMLElement {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return el
}

function lastDraggable(): CapturedDraggable {
  const c = captured.draggable[captured.draggable.length - 1]
  if (!c) throw new Error('No captured draggable')
  return c
}
function lastDropzone(): CapturedDropzone {
  const c = captured.dropzone[captured.dropzone.length - 1]
  if (!c) throw new Error('No captured dropzone')
  return c
}

beforeEach(() => {
  setActivePinia(createPinia())
  captured.draggable.length = 0
  captured.dropzone.length = 0
  captured.unsetCount = 0
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('enableElementDrag — basic wiring', () => {
  it('rejects when el is missing (warns, no throw)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    enableElementDrag(null as unknown as HTMLElement, {
      elementId: 'e1',
      panelId: 'p1',
    })
    expect(warn).toHaveBeenCalled()
    expect(captured.draggable.length).toBe(0)
    warn.mockRestore()
  })

  it('rejects when opts missing required ids (warns, no throw)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    enableElementDrag(makeEl(), {
      elementId: '',
      panelId: 'p1',
    })
    expect(warn).toHaveBeenCalled()
    expect(captured.draggable.length).toBe(0)
    warn.mockRestore()
  })

  it('registers a draggable on the element', () => {
    enableElementDrag(makeEl(), { elementId: 'e1', panelId: 'p1' })
    expect(captured.draggable.length).toBe(1)
    expect(lastDraggable().options.listeners).toBeDefined()
    expect(typeof lastDraggable().options.listeners?.start).toBe('function')
    expect(typeof lastDraggable().options.listeners?.move).toBe('function')
    expect(typeof lastDraggable().options.listeners?.end).toBe('function')
  })

  it('passes gridSize through to snap modifier', () => {
    enableElementDrag(makeEl(), {
      elementId: 'e1',
      panelId: 'p1',
      gridSize: 10,
    })
    const opts = lastDraggable().options as unknown as {
      modifiers: Array<{ _kind?: string }>
    }
    expect(opts.modifiers.some((m) => m._kind === 'snap')).toBe(true)
  })

  it('omits snap modifier when gridSize is 0 or undefined', () => {
    enableElementDrag(makeEl(), { elementId: 'e1', panelId: 'p1' })
    const opts = lastDraggable().options as unknown as {
      modifiers: Array<{ _kind?: string }>
    }
    expect(opts.modifiers.some((m) => m._kind === 'snap')).toBe(false)
  })
})

describe('enableElementDrag — single element move', () => {
  it('move handler patches the element via updateElement (single-select)', () => {
    const canvas = useCanvasStore()
    const panel = canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    const el = canvas.addElement(panel.id, {
      id: 'e1',
      tid: 't.text',
      options: { left: 10, top: 20 },
    })
    expect(el).toBeTruthy()

    const dom = makeEl()
    enableElementDrag(dom, { elementId: 'e1', panelId: 'p1' })

    const listeners = lastDraggable().options.listeners!
    // Start fires first — captures pos.
    listeners.start!()
    // Move: dx=10 px, dy=20 px at scale=1.
    listeners.move!({ dx: 10, dy: 20 } as unknown)

    // Element should have new left/top in pt. Exact pt depends on DPI cached
    // (happy-dom returns 96 default). 10 px → ~7.5 pt at 96 DPI.
    const updated = canvas.panels[0]?.printElements[0]
    expect(updated).toBeDefined()
    const opts = updated!.options as Record<string, number>
    expect(opts.left).toBeGreaterThan(10) // moved right from 10
    expect(opts.top).toBeGreaterThan(20) // moved down from 20
  })

  it('multiple move calls accumulate position', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { left: 0, top: 0 },
    })

    enableElementDrag(makeEl(), { elementId: 'e1', panelId: 'p1' })
    const listeners = lastDraggable().options.listeners!
    listeners.start!()
    listeners.move!({ dx: 10, dy: 0 } as unknown)
    const after1 = (
      canvas.panels[0]!.printElements[0]!.options as Record<string, number>
    ).left
    listeners.move!({ dx: 10, dy: 0 } as unknown)
    const after2 = (
      canvas.panels[0]!.printElements[0]!.options as Record<string, number>
    ).left
    expect(after2).toBeGreaterThan(after1)
  })

  it('move handler invokes opts.onMove with pt delta', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { left: 0, top: 0 },
    })

    const onMove = vi.fn()
    enableElementDrag(makeEl(), {
      elementId: 'e1',
      panelId: 'p1',
      onMove,
    })
    const listeners = lastDraggable().options.listeners!
    listeners.start!()
    listeners.move!({ dx: 10, dy: 5 } as unknown)
    expect(onMove).toHaveBeenCalled()
    const arg = onMove.mock.calls[0]![0] as { x: number; y: number }
    expect(arg.x).toBeGreaterThan(0)
    expect(arg.y).toBeGreaterThan(0)
  })

  it('end handler invokes opts.onEnd with final pos', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { left: 7, top: 11 },
    })

    const onEnd = vi.fn()
    enableElementDrag(makeEl(), { elementId: 'e1', panelId: 'p1', onEnd })
    const listeners = lastDraggable().options.listeners!
    listeners.start!()
    listeners.end!()
    expect(onEnd).toHaveBeenCalledTimes(1)
    const arg = onEnd.mock.calls[0]![0] as { x: number; y: number }
    expect(arg.x).toBe(7)
    expect(arg.y).toBe(11)
  })

  it('handler exceptions are swallowed (warn, no throw)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { left: 0, top: 0 },
    })

    enableElementDrag(makeEl(), {
      elementId: 'e1',
      panelId: 'p1',
      onMove: () => {
        throw new Error('boom')
      },
    })
    const listeners = lastDraggable().options.listeners!
    expect(() => {
      listeners.start!()
      listeners.move!({ dx: 1, dy: 1 } as unknown)
    }).not.toThrow()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('enableElementDrag — multi-select drag', () => {
  it('multi-select: move dispatches moveSelection (NOT updateElement)', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { left: 10, top: 10 },
    })
    canvas.addElement('p1', {
      id: 'e2',
      tid: 't.text',
      options: { left: 50, top: 50 },
    })
    // Select both → multi-select mode.
    canvas.selectMultiple(['e1', 'e2'])

    const moveSelSpy = vi.spyOn(canvas, 'moveSelection')
    const updateSpy = vi.spyOn(canvas, 'updateElement')

    enableElementDrag(makeEl(), { elementId: 'e1', panelId: 'p1' })
    const listeners = lastDraggable().options.listeners!
    listeners.start!() // captures isMultiDrag = true
    listeners.move!({ dx: 10, dy: 10 } as unknown)

    expect(moveSelSpy).toHaveBeenCalled()
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('single-select on the dragged element: still single-mode (not multi)', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { left: 0, top: 0 },
    })
    canvas.selectElement('e1') // single select

    const moveSelSpy = vi.spyOn(canvas, 'moveSelection')
    const updateSpy = vi.spyOn(canvas, 'updateElement')

    enableElementDrag(makeEl(), { elementId: 'e1', panelId: 'p1' })
    const listeners = lastDraggable().options.listeners!
    listeners.start!()
    listeners.move!({ dx: 10, dy: 0 } as unknown)

    // Selection size === 1 → not multi.
    expect(moveSelSpy).not.toHaveBeenCalled()
    expect(updateSpy).toHaveBeenCalled()
  })

  it('multi-select but dragged element NOT in selection: single-mode', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { left: 0, top: 0 },
    })
    canvas.addElement('p1', {
      id: 'e2',
      tid: 't.text',
      options: { left: 100, top: 100 },
    })
    canvas.addElement('p1', {
      id: 'e3',
      tid: 't.text',
      options: { left: 200, top: 200 },
    })
    canvas.selectMultiple(['e2', 'e3']) // e1 NOT selected

    const moveSelSpy = vi.spyOn(canvas, 'moveSelection')
    const updateSpy = vi.spyOn(canvas, 'updateElement')

    enableElementDrag(makeEl(), { elementId: 'e1', panelId: 'p1' })
    const listeners = lastDraggable().options.listeners!
    listeners.start!()
    listeners.move!({ dx: 5, dy: 5 } as unknown)

    expect(moveSelSpy).not.toHaveBeenCalled()
    expect(updateSpy).toHaveBeenCalled()
  })
})

describe('enableElementListSource', () => {
  it('marks element with class + data-tid', () => {
    const el = makeEl()
    enableElementListSource(el, { tid: 'configModule.text' })
    expect(el.classList.contains('hiprint-list-source')).toBe(true)
    expect(el.getAttribute('data-tid')).toBe('configModule.text')
    expect(captured.draggable.length).toBe(1)
  })

  it('start/end listeners toggle hiprint-dragging class', () => {
    const el = makeEl()
    enableElementListSource(el, { tid: 'configModule.text' })
    const listeners = lastDraggable().options.listeners!
    listeners.start!()
    expect(el.classList.contains('hiprint-dragging')).toBe(true)
    listeners.end!()
    expect(el.classList.contains('hiprint-dragging')).toBe(false)
  })

  it('rejects missing tid (warns, no throw)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    enableElementListSource(makeEl(), { tid: '' })
    expect(warn).toHaveBeenCalled()
    expect(captured.draggable.length).toBe(0)
    warn.mockRestore()
  })
})

describe('enablePanelDropZone', () => {
  it('registers a dropzone on the panel', () => {
    enablePanelDropZone(makeEl(), 'p1')
    expect(captured.dropzone.length).toBe(1)
    expect(lastDropzone().options.accept).toContain('.hiprint-element')
    expect(lastDropzone().options.accept).toContain('.hiprint-list-source')
  })

  it('cross-panel drop: moves element via moveElementBetweenPanels', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addPanel({ id: 'p2', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { left: 10, top: 10 },
    })

    const spy = vi.spyOn(canvas, 'moveElementBetweenPanels')

    // Set up dropzone on p2.
    enablePanelDropZone(makeEl(), 'p2')

    // Simulate dragged element coming from p1.
    const dragged = document.createElement('div')
    dragged.classList.add('hiprint-element')
    dragged.setAttribute('data-element-id', 'e1')
    dragged.setAttribute('data-panel-id', 'p1')

    lastDropzone().options.ondrop!({ relatedTarget: dragged })

    expect(spy).toHaveBeenCalledWith('p1', 'p2', 'e1')
    // Element should now be in p2.
    expect(canvas.panels[0]!.printElements.length).toBe(0)
    expect(canvas.panels[1]!.printElements.length).toBe(1)
  })

  it('same-panel drop: NO call to moveElementBetweenPanels', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { left: 10, top: 10 },
    })
    const spy = vi.spyOn(canvas, 'moveElementBetweenPanels')

    enablePanelDropZone(makeEl(), 'p1')
    const dragged = document.createElement('div')
    dragged.classList.add('hiprint-element')
    dragged.setAttribute('data-element-id', 'e1')
    dragged.setAttribute('data-panel-id', 'p1')

    lastDropzone().options.ondrop!({ relatedTarget: dragged })

    expect(spy).not.toHaveBeenCalled()
  })

  it('list-source drop: creates new element via addElement', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    const spy = vi.spyOn(canvas, 'addElement')

    enablePanelDropZone(makeEl(), 'p1')

    // Drag from sidebar (must register source first so factory map has entry).
    const source = makeEl()
    enableElementListSource(source, {
      tid: 'configModule.text',
      createElement: () => ({ options: { left: 0, top: 0, title: 'New' } }),
    })

    lastDropzone().options.ondrop!({ relatedTarget: source })

    expect(spy).toHaveBeenCalledWith('p1', expect.objectContaining({ tid: 'configModule.text' }))
  })

  it('list-source drop without factory: still creates element with empty options', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    const spy = vi.spyOn(canvas, 'addElement')

    enablePanelDropZone(makeEl(), 'p1')

    // Manually craft a list-source without using enableElementListSource so
    // factory map is empty for this element.
    const source = makeEl()
    source.classList.add('hiprint-list-source')
    source.setAttribute('data-tid', 'configModule.image')

    lastDropzone().options.ondrop!({ relatedTarget: source })

    expect(spy).toHaveBeenCalledWith('p1', expect.objectContaining({ tid: 'configModule.image' }))
  })

  it('invalid list-source drop (missing tid): warns + does not addElement', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    const spy = vi.spyOn(canvas, 'addElement')

    enablePanelDropZone(makeEl(), 'p1')
    const source = makeEl()
    source.classList.add('hiprint-list-source') // intentionally NO data-tid

    lastDropzone().options.ondrop!({ relatedTarget: source })

    expect(spy).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('drop with no relatedTarget: no-op, no throw', () => {
    enablePanelDropZone(makeEl(), 'p1')
    expect(() => {
      lastDropzone().options.ondrop!({ relatedTarget: null as unknown as HTMLElement })
    }).not.toThrow()
  })

  it('rejects missing panelId (warns, no throw)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    enablePanelDropZone(makeEl(), '')
    expect(warn).toHaveBeenCalled()
    expect(captured.dropzone.length).toBe(0)
    warn.mockRestore()
  })
})

describe('disableInteractions', () => {
  it('calls interact(el).unset()', () => {
    const el = makeEl()
    enableElementDrag(el, { elementId: 'e1', panelId: 'p1' })
    expect(captured.unsetCount).toBe(0)
    disableInteractions(el)
    expect(captured.unsetCount).toBe(1)
  })

  it('is idempotent (safe to call multiple times)', () => {
    const el = makeEl()
    enableElementDrag(el, { elementId: 'e1', panelId: 'p1' })
    expect(() => {
      disableInteractions(el)
      disableInteractions(el)
      disableInteractions(el)
    }).not.toThrow()
  })

  it('safe on never-registered element', () => {
    expect(() => disableInteractions(makeEl())).not.toThrow()
  })

  it('safe on null/undefined (no-op)', () => {
    expect(() =>
      disableInteractions(null as unknown as HTMLElement)
    ).not.toThrow()
  })
})

describe('canvas store: moveElementBetweenPanels (P16 dependency)', () => {
  it('moves element from src panel to dst panel', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addPanel({ id: 'p2', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { left: 10, top: 20 },
    })

    const moved = canvas.moveElementBetweenPanels('p1', 'p2', 'e1')
    expect(moved).not.toBeNull()
    expect(moved!.id).toBe('e1')
    expect(canvas.panels.find((p) => p.id === 'p1')!.printElements.length).toBe(0)
    expect(canvas.panels.find((p) => p.id === 'p2')!.printElements.length).toBe(1)
  })

  it('no-op when src === dst', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })
    const result = canvas.moveElementBetweenPanels('p1', 'p1', 'e1')
    expect(result).toBeNull()
  })

  it('returns null on unknown panel', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    expect(canvas.moveElementBetweenPanels('p1', 'nope', 'e1')).toBeNull()
    expect(canvas.moveElementBetweenPanels('nope', 'p1', 'e1')).toBeNull()
    expect(warn).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })

  it('returns null on unknown element id', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addPanel({ id: 'p2', width: 200, height: 200 })
    expect(canvas.moveElementBetweenPanels('p1', 'p2', 'no-such')).toBeNull()
  })

  it('preserves element identity (options carried over)', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addPanel({ id: 'p2', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { left: 50, top: 100, title: 'Hello' },
    })
    canvas.moveElementBetweenPanels('p1', 'p2', 'e1')
    const moved = canvas.panels.find((p) => p.id === 'p2')!.printElements[0]!
    expect(moved.id).toBe('e1')
    expect((moved.options as Record<string, unknown>).title).toBe('Hello')
    expect((moved.options as Record<string, unknown>).left).toBe(50)
  })
})
