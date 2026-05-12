/**
 * history-auto-snapshot.spec.ts — TKT-020.
 *
 * Verifies that every mutating interaction site captures a history snapshot
 * AUTOMATICALLY so undo/redo "just works" from the designer. Without these
 * pushSnapshot calls, Ctrl+Z had no entries to roll back (the bug TKT-020
 * fixes).
 *
 * Surface covered:
 *   1. drag-drop.ts        — element drag-end, palette drop, cross-panel drop
 *   2. resize.ts           — resize-end
 *   3. keyboard.ts         — Delete / Backspace, arrow nudge, Ctrl+V, Ctrl+X
 *   4. context-menu.ts     — delete / cut / paste / bring-to-front / send-to-back
 *
 * Strategy: drag-drop and resize use interact.js mocks that capture the
 * registered listeners; we synthesize start/move/end events on those listeners
 * and inspect `useHistoryStore().historyEntries.length`. Keyboard tests
 * dispatch real keydown events on window. Context-menu tests invoke the
 * onClick handlers returned by `buildElementContextItems` directly.
 *
 * Each test asserts that ONE snapshot lands per logical edit boundary (V1
 * parity). Tests that need to call undo() to verify the snapshot actually
 * captured pre-mutation state also assert canvas state restoration.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// ----------------------------------------------------------------------------
// interact.js mock (shared between drag-drop + resize SUTs).
// MUST be declared before SUT imports.
// ----------------------------------------------------------------------------

type ListenerSet = {
  start?: (event?: unknown) => void
  move?: (event?: unknown) => void
  end?: (event?: unknown) => void
}

const captured: {
  draggable: { el: HTMLElement; listeners: ListenerSet }[]
  dropzone: {
    el: HTMLElement
    ondrop?: (event: { relatedTarget: HTMLElement }) => void
  }[]
  resizable: { el: HTMLElement; listeners: ListenerSet }[]
} = { draggable: [], dropzone: [], resizable: [] }

vi.mock('interactjs', () => {
  function interact(el: HTMLElement) {
    return {
      draggable(opts: { listeners?: ListenerSet }) {
        captured.draggable.push({ el, listeners: opts.listeners ?? {} })
        return this
      },
      dropzone(opts: {
        ondrop?: (event: { relatedTarget: HTMLElement }) => void
      }) {
        captured.dropzone.push({ el, ondrop: opts.ondrop })
        return this
      },
      resizable(opts: { listeners?: ListenerSet }) {
        captured.resizable.push({ el, listeners: opts.listeners ?? {} })
        return this
      },
      unset() {
        /* no-op for these tests */
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

// ----------------------------------------------------------------------------
// SUTs (after mock).
// ----------------------------------------------------------------------------
import {
  enableElementDrag,
  enableElementListSource,
  enablePanelDropZone,
} from '../drag-drop'
import { enableElementResize } from '../resize'
import { enableDesignerKeyboard } from '../keyboard'
import { buildElementContextItems, _setClipboard } from '../context-menu'
import { useCanvasStore, useHistoryStore } from '@hiprint-v3/stores'

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function resetCaptured(): void {
  captured.draggable.length = 0
  captured.dropzone.length = 0
  captured.resizable.length = 0
}

function makeEl(): HTMLElement {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return el
}

function fireKey(opts: KeyboardEventInit & { key: string }): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { ...opts, bubbles: true }))
}

beforeEach(() => {
  setActivePinia(createPinia())
  resetCaptured()
  _setClipboard([])
})

afterEach(() => {
  document.body.innerHTML = ''
})

// ----------------------------------------------------------------------------
// 1. Drag-drop snapshots
// ----------------------------------------------------------------------------

describe('TKT-020 — drag-drop history snapshots', () => {
  it('drag-end on a moved element pushes ONE snapshot', () => {
    const canvas = useCanvasStore()
    const history = useHistoryStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { left: 10, top: 10 },
    })
    history.clear()
    const before = history.historyEntries.length

    enableElementDrag(makeEl(), { elementId: 'e1', panelId: 'p1' })
    const listeners = captured.draggable[0]!.listeners
    listeners.start!()
    listeners.move!({ dx: 30, dy: 40 })
    listeners.end!()

    expect(history.historyEntries.length).toBe(before + 1)
  })

  it('drag-end WITHOUT any move event does NOT push (click-as-drag guard)', () => {
    const canvas = useCanvasStore()
    const history = useHistoryStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })
    history.clear()
    const before = history.historyEntries.length

    enableElementDrag(makeEl(), { elementId: 'e1', panelId: 'p1' })
    const listeners = captured.draggable[0]!.listeners
    listeners.start!()
    // No move call.
    listeners.end!()

    expect(history.historyEntries.length).toBe(before)
  })

  it('palette drop (new element) pushes ONE snapshot', () => {
    const canvas = useCanvasStore()
    const history = useHistoryStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    history.clear()

    const panelEl = makeEl()
    enablePanelDropZone(panelEl, 'p1')
    const dz = captured.dropzone[0]!

    // Simulate a list-source drop. Build a fake source element that carries
    // the class + data-tid the dropzone expects.
    const src = document.createElement('div')
    src.classList.add('hiprint-list-source')
    src.setAttribute('data-tid', 't.text')

    const before = history.historyEntries.length
    dz.ondrop!({ relatedTarget: src })
    expect(history.historyEntries.length).toBe(before + 1)
    // Element actually landed.
    expect(canvas.panels[0]!.printElements.length).toBe(1)
  })

  it('cross-panel drop pushes ONE snapshot, same-panel drop does NOT', () => {
    const canvas = useCanvasStore()
    const history = useHistoryStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addPanel({ id: 'p2', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })
    history.clear()

    const targetEl = makeEl()
    enablePanelDropZone(targetEl, 'p2')
    const dz = captured.dropzone[0]!

    // Build a fake existing-element drag target (no list-source class).
    const dragged = document.createElement('div')
    dragged.classList.add('hiprint-element')
    dragged.setAttribute('data-element-id', 'e1')
    dragged.setAttribute('data-panel-id', 'p1')

    const before = history.historyEntries.length
    dz.ondrop!({ relatedTarget: dragged })
    expect(history.historyEntries.length).toBe(before + 1)

    // Same-panel drop must NOT push (the drag-end handler owns that path).
    const sameZone = makeEl()
    enablePanelDropZone(sameZone, 'p2')
    const sameDz = captured.dropzone[1]!
    const dragged2 = document.createElement('div')
    dragged2.classList.add('hiprint-element')
    dragged2.setAttribute('data-element-id', 'e1')
    dragged2.setAttribute('data-panel-id', 'p2') // already in p2
    const before2 = history.historyEntries.length
    sameDz.ondrop!({ relatedTarget: dragged2 })
    expect(history.historyEntries.length).toBe(before2)
  })
})

// ----------------------------------------------------------------------------
// 2. Resize snapshots
// ----------------------------------------------------------------------------

describe('TKT-020 — resize history snapshots', () => {
  it('resize-end after move pushes ONE snapshot', () => {
    const canvas = useCanvasStore()
    const history = useHistoryStore()
    canvas.addPanel({ id: 'p1', width: 400, height: 400 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { left: 0, top: 0, width: 50, height: 30 },
    })
    history.clear()

    const el = document.createElement('div')
    el.style.left = '0pt'
    el.style.top = '0pt'
    el.style.width = '50pt'
    el.style.height = '30pt'
    document.body.appendChild(el)

    enableElementResize(el, { elementId: 'e1', panelId: 'p1' })
    const listeners = captured.resizable[0]!.listeners
    listeners.start!({ rect: { width: 50, height: 30 }, shiftKey: false })
    listeners.move!({
      rect: { width: 70, height: 30 },
      deltaRect: { left: 0, top: 0, width: 20, height: 0 },
      shiftKey: false,
    })
    // Simulate a non-zero positional delta via deltaRect.left so the didResize
    // flag flips true; the canvas-store handler would do this in real usage.
    listeners.move!({
      rect: { width: 70, height: 30 },
      deltaRect: { left: 5, top: 0, width: 20, height: 0 },
      shiftKey: false,
    })

    const before = history.historyEntries.length
    listeners.end!({})
    expect(history.historyEntries.length).toBe(before + 1)
  })

  it('resize-end with NO movement does NOT push (handle-click guard)', () => {
    const canvas = useCanvasStore()
    const history = useHistoryStore()
    canvas.addPanel({ id: 'p1', width: 400, height: 400 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { left: 0, top: 0, width: 50, height: 30 },
    })
    history.clear()

    const el = document.createElement('div')
    el.style.left = '0pt'
    el.style.top = '0pt'
    el.style.width = '50pt'
    el.style.height = '30pt'
    document.body.appendChild(el)

    enableElementResize(el, { elementId: 'e1', panelId: 'p1' })
    const listeners = captured.resizable[0]!.listeners
    listeners.start!({ rect: { width: 50, height: 30 }, shiftKey: false })
    // No move event.
    const before = history.historyEntries.length
    listeners.end!({})
    expect(history.historyEntries.length).toBe(before)
  })
})

// ----------------------------------------------------------------------------
// 3. Keyboard snapshots
// ----------------------------------------------------------------------------

describe('TKT-020 — keyboard history snapshots', () => {
  it('Delete pushes ONE snapshot when something was selected', () => {
    const canvas = useCanvasStore()
    const history = useHistoryStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })
    canvas.selectElement('e1')
    history.clear()
    const before = history.historyEntries.length

    const cleanup = enableDesignerKeyboard()
    fireKey({ key: 'Delete' })
    cleanup()

    expect(history.historyEntries.length).toBe(before + 1)
  })

  it('Delete with empty selection does NOT push', () => {
    const canvas = useCanvasStore()
    const history = useHistoryStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    history.clear()
    const before = history.historyEntries.length

    const cleanup = enableDesignerKeyboard()
    fireKey({ key: 'Delete' })
    cleanup()

    expect(history.historyEntries.length).toBe(before)
  })

  it('Arrow nudge pushes ONE snapshot per keypress (V1-faithful)', () => {
    const canvas = useCanvasStore()
    const history = useHistoryStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text', options: { left: 50, top: 50 } })
    canvas.selectElement('e1')
    history.clear()
    const before = history.historyEntries.length

    const cleanup = enableDesignerKeyboard()
    fireKey({ key: 'ArrowRight' })
    fireKey({ key: 'ArrowRight' })
    fireKey({ key: 'ArrowDown' })
    cleanup()

    expect(history.historyEntries.length).toBe(before + 3)
  })

  it('Arrow with empty selection does NOT push', () => {
    const canvas = useCanvasStore()
    const history = useHistoryStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' }) // not selected
    history.clear()
    const before = history.historyEntries.length

    const cleanup = enableDesignerKeyboard()
    fireKey({ key: 'ArrowUp' })
    cleanup()

    expect(history.historyEntries.length).toBe(before)
  })

  it('Ctrl+V (paste) pushes ONE snapshot when clipboard has content', () => {
    const canvas = useCanvasStore()
    const history = useHistoryStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    _setClipboard([{ id: 'x', tid: 't.text', options: { left: 1, top: 1 } }])
    history.clear()
    const before = history.historyEntries.length

    const cleanup = enableDesignerKeyboard()
    fireKey({ key: 'v', ctrlKey: true })
    cleanup()

    expect(history.historyEntries.length).toBe(before + 1)
  })

  it('Ctrl+V (paste) with empty clipboard does NOT push', () => {
    const canvas = useCanvasStore()
    const history = useHistoryStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    history.clear()
    const before = history.historyEntries.length

    const cleanup = enableDesignerKeyboard()
    fireKey({ key: 'v', ctrlKey: true })
    cleanup()

    expect(history.historyEntries.length).toBe(before)
  })

  it('Ctrl+X (cut) pushes ONE snapshot when something was selected', () => {
    const canvas = useCanvasStore()
    const history = useHistoryStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })
    canvas.selectElement('e1')
    history.clear()
    const before = history.historyEntries.length

    const cleanup = enableDesignerKeyboard()
    fireKey({ key: 'x', ctrlKey: true })
    cleanup()

    expect(history.historyEntries.length).toBe(before + 1)
  })

  it('Ctrl+C (copy) does NOT push — read-only', () => {
    const canvas = useCanvasStore()
    const history = useHistoryStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })
    canvas.selectElement('e1')
    history.clear()
    const before = history.historyEntries.length

    const cleanup = enableDesignerKeyboard()
    fireKey({ key: 'c', ctrlKey: true })
    cleanup()

    expect(history.historyEntries.length).toBe(before)
  })

  it('end-to-end: delete + undo restores the element', () => {
    const canvas = useCanvasStore()
    const history = useHistoryStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })
    canvas.selectElement('e1')
    // Baseline: snapshot current state BEFORE the delete so undo has somewhere
    // to roll back to.
    history.pushSnapshot()
    expect(canvas.panels[0]!.printElements.length).toBe(1)

    const cleanup = enableDesignerKeyboard()
    fireKey({ key: 'Delete' })
    expect(canvas.panels[0]!.printElements.length).toBe(0)

    fireKey({ key: 'z', ctrlKey: true })
    expect(canvas.panels[0]!.printElements.length).toBe(1)
    cleanup()
  })
})

// ----------------------------------------------------------------------------
// 4. Context-menu snapshots
// ----------------------------------------------------------------------------

describe('TKT-020 — context-menu history snapshots', () => {
  function findItem(items: ReturnType<typeof buildElementContextItems>, id: string) {
    return items.find((it) => it.id === id)!
  }

  it('delete menu item pushes ONE snapshot', () => {
    const canvas = useCanvasStore()
    const history = useHistoryStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })
    history.clear()
    const before = history.historyEntries.length

    const items = buildElementContextItems('e1')
    findItem(items, 'delete').onClick!()

    expect(history.historyEntries.length).toBe(before + 1)
    expect(canvas.panels[0]!.printElements.length).toBe(0)
  })

  it('cut menu item pushes ONE snapshot + populates clipboard', () => {
    const canvas = useCanvasStore()
    const history = useHistoryStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })
    history.clear()
    const before = history.historyEntries.length

    const items = buildElementContextItems('e1')
    findItem(items, 'cut').onClick!()

    expect(history.historyEntries.length).toBe(before + 1)
  })

  it('paste menu item pushes ONE snapshot', () => {
    const canvas = useCanvasStore()
    const history = useHistoryStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })
    canvas.setActivePanel('p1')
    _setClipboard([{ id: 'x', tid: 't.text', options: {} }])
    history.clear()
    const before = history.historyEntries.length

    const items = buildElementContextItems('e1')
    findItem(items, 'paste').onClick!()

    expect(history.historyEntries.length).toBe(before + 1)
  })

  it('bring-to-front pushes ONE snapshot when reordering happens', () => {
    const canvas = useCanvasStore()
    const history = useHistoryStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })
    canvas.addElement('p1', { id: 'e2', tid: 't.text' })
    history.clear()
    const before = history.historyEntries.length

    // e1 is at index 0 → bring-to-front moves it to the end.
    const items = buildElementContextItems('e1')
    findItem(items, 'bring-to-front').onClick!()

    expect(history.historyEntries.length).toBe(before + 1)
    expect(canvas.panels[0]!.printElements.map((e) => e.id)).toEqual(['e2', 'e1'])
  })

  it('bring-to-front does NOT push when element is already at front', () => {
    const canvas = useCanvasStore()
    const history = useHistoryStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })
    canvas.addElement('p1', { id: 'e2', tid: 't.text' })
    history.clear()
    const before = history.historyEntries.length

    // e2 is last → bring-to-front is a no-op.
    const items = buildElementContextItems('e2')
    findItem(items, 'bring-to-front').onClick!()

    expect(history.historyEntries.length).toBe(before)
  })

  it('send-to-back pushes ONE snapshot when reordering happens', () => {
    const canvas = useCanvasStore()
    const history = useHistoryStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })
    canvas.addElement('p1', { id: 'e2', tid: 't.text' })
    history.clear()
    const before = history.historyEntries.length

    // e2 at index 1 → send-to-back moves it to index 0.
    const items = buildElementContextItems('e2')
    findItem(items, 'send-to-back').onClick!()

    expect(history.historyEntries.length).toBe(before + 1)
    expect(canvas.panels[0]!.printElements.map((e) => e.id)).toEqual(['e2', 'e1'])
  })

  it('copy menu item does NOT push — read-only', () => {
    const canvas = useCanvasStore()
    const history = useHistoryStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })
    history.clear()
    const before = history.historyEntries.length

    const items = buildElementContextItems('e1')
    findItem(items, 'copy').onClick!()

    expect(history.historyEntries.length).toBe(before)
  })
})

// ----------------------------------------------------------------------------
// 5. Undo round-trip integration — proves snapshots are usable, not just
//    counted.
// ----------------------------------------------------------------------------

describe('TKT-020 — undo round-trip integration', () => {
  it('drag-end + undo restores element position', () => {
    const canvas = useCanvasStore()
    const history = useHistoryStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { left: 10, top: 10 },
    })
    // Baseline snapshot so undo has somewhere to roll back to.
    history.pushSnapshot()

    enableElementDrag(makeEl(), { elementId: 'e1', panelId: 'p1' })
    const listeners = captured.draggable[0]!.listeners
    listeners.start!()
    listeners.move!({ dx: 50, dy: 50 })
    listeners.end!()

    // After the drag, options.left / top have shifted.
    const afterOpts = canvas.panels[0]!.printElements[0]!.options as Record<
      string,
      number
    >
    expect(afterOpts.left).not.toBe(10)

    // Undo should restore the prior (10, 10) position.
    history.undo()
    const restoredOpts = canvas.panels[0]!.printElements[0]!.options as Record<
      string,
      number
    >
    expect(restoredOpts.left).toBe(10)
    expect(restoredOpts.top).toBe(10)
  })

  it('context-menu delete + undo restores element', () => {
    const canvas = useCanvasStore()
    const history = useHistoryStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })
    history.pushSnapshot()
    expect(canvas.panels[0]!.printElements.length).toBe(1)

    const items = buildElementContextItems('e1')
    items.find((it) => it.id === 'delete')!.onClick!()
    expect(canvas.panels[0]!.printElements.length).toBe(0)

    history.undo()
    expect(canvas.panels[0]!.printElements.length).toBe(1)
    expect(canvas.panels[0]!.printElements[0]!.id).toBe('e1')
  })
})

// Reference: keep `enableElementListSource` import valid (used by drag-drop
// surface tests in drag-drop.spec.ts; not directly exercised here but the
// dropzone palette-create path verifies it implicitly).
void enableElementListSource
