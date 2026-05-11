/**
 * keyboard.spec.ts — V3 designer keyboard shortcuts unit tests (P16.5).
 *
 * Covers:
 *  - Delete / Backspace → removes selected elements
 *  - Arrow keys → moveSelection (Shift = bigMoveStep)
 *  - Ctrl+C / V / X → copy / paste / cut via internal clipboard
 *  - Ctrl+Z → history.undo
 *  - Ctrl+Y, Ctrl+Shift+Z → history.redo
 *  - Tab / Shift+Tab → cycleSelection
 *  - Input focus suppression
 *  - Cleanup removes listener
 *  - Exception swallowing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { enableDesignerKeyboard } from '../keyboard'
import { _setClipboard, _getClipboard } from '../context-menu'
import { useCanvasStore, useHistoryStore } from '@hiprint-v3/stores'

beforeEach(() => {
  setActivePinia(createPinia())
})

afterEach(() => {
  document.body.innerHTML = ''
  _setClipboard([])
})

function fireKey(opts: KeyboardEventInit & { key: string }): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { ...opts, bubbles: true }))
}

describe('enableDesignerKeyboard — Delete', () => {
  it('Delete removes selected elements', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })
    canvas.addElement('p1', { id: 'e2', tid: 't.text' })
    canvas.selectMultiple(['e1'])
    const cleanup = enableDesignerKeyboard()
    fireKey({ key: 'Delete' })
    expect(canvas.panels[0]!.printElements.map((e) => e.id)).toEqual(['e2'])
    cleanup()
  })

  it('Backspace also removes selected elements', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })
    canvas.selectMultiple(['e1'])
    const cleanup = enableDesignerKeyboard()
    fireKey({ key: 'Backspace' })
    expect(canvas.panels[0]!.printElements.length).toBe(0)
    cleanup()
  })

  it('Delete with no selection is a no-op', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })
    const cleanup = enableDesignerKeyboard()
    fireKey({ key: 'Delete' })
    expect(canvas.panels[0]!.printElements.length).toBe(1)
    cleanup()
  })
})

describe('enableDesignerKeyboard — Arrow move', () => {
  it('ArrowRight moves selection by moveStep (default 1 pt)', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text', options: { left: 10, top: 10 } })
    canvas.selectElement('e1')
    const cleanup = enableDesignerKeyboard()
    fireKey({ key: 'ArrowRight' })
    expect(
      (canvas.panels[0]!.printElements[0]!.options as Record<string, number>).left
    ).toBe(11)
    cleanup()
  })

  it('ArrowDown + Shift uses bigMoveStep', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text', options: { left: 0, top: 0 } })
    canvas.selectElement('e1')
    const cleanup = enableDesignerKeyboard({ moveStep: 2, bigMoveStep: 50 })
    fireKey({ key: 'ArrowDown', shiftKey: true })
    expect(
      (canvas.panels[0]!.printElements[0]!.options as Record<string, number>).top
    ).toBe(50)
    cleanup()
  })

  it('ArrowLeft / ArrowUp move negatively', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text', options: { left: 10, top: 10 } })
    canvas.selectElement('e1')
    const cleanup = enableDesignerKeyboard()
    fireKey({ key: 'ArrowLeft' })
    fireKey({ key: 'ArrowUp' })
    const opts = canvas.panels[0]!.printElements[0]!.options as Record<string, number>
    expect(opts.left).toBe(9)
    expect(opts.top).toBe(9)
    cleanup()
  })

  it('Arrow with empty selection is a no-op', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text', options: { left: 0, top: 0 } })
    const cleanup = enableDesignerKeyboard()
    fireKey({ key: 'ArrowRight' })
    expect(
      (canvas.panels[0]!.printElements[0]!.options as Record<string, number>).left
    ).toBe(0)
    cleanup()
  })
})

describe('enableDesignerKeyboard — Clipboard', () => {
  it('Ctrl+C copies selection into the internal clipboard', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text', options: { left: 5 } })
    canvas.selectElement('e1')
    const cleanup = enableDesignerKeyboard()
    fireKey({ key: 'c', ctrlKey: true })
    expect(_getClipboard()).toHaveLength(1)
    expect(_getClipboard()[0]!.tid).toBe('t.text')
    cleanup()
  })

  it('Ctrl+V pastes into active panel with offset', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text', options: { left: 5, top: 7 } })
    // Pre-populate clipboard.
    _setClipboard([
      { id: 'e1', tid: 't.text', options: { left: 5, top: 7, title: 'X' } },
    ])
    const cleanup = enableDesignerKeyboard()
    fireKey({ key: 'v', ctrlKey: true })
    expect(canvas.panels[0]!.printElements.length).toBe(2)
    const pasted = canvas.panels[0]!.printElements[1]!
    expect(pasted.id).not.toBe('e1') // new id assigned
    expect((pasted.options as Record<string, number>).left).toBeGreaterThan(5)
    cleanup()
  })

  it('Ctrl+X cuts (copy + delete)', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text', options: { left: 5 } })
    canvas.selectElement('e1')
    const cleanup = enableDesignerKeyboard()
    fireKey({ key: 'x', ctrlKey: true })
    expect(canvas.panels[0]!.printElements.length).toBe(0)
    expect(_getClipboard()).toHaveLength(1)
    cleanup()
  })

  it('Ctrl+V with empty clipboard is a no-op', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    const cleanup = enableDesignerKeyboard()
    fireKey({ key: 'v', ctrlKey: true })
    expect(canvas.panels[0]!.printElements.length).toBe(0)
    cleanup()
  })

  it('enableClipboard: false suppresses Ctrl+C', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })
    canvas.selectElement('e1')
    const cleanup = enableDesignerKeyboard({ enableClipboard: false })
    fireKey({ key: 'c', ctrlKey: true })
    expect(_getClipboard()).toHaveLength(0)
    cleanup()
  })
})

describe('enableDesignerKeyboard — Undo / Redo', () => {
  it('Ctrl+Z calls history.undo', () => {
    const history = useHistoryStore()
    const spy = vi.spyOn(history, 'undo')
    const cleanup = enableDesignerKeyboard()
    fireKey({ key: 'z', ctrlKey: true })
    expect(spy).toHaveBeenCalled()
    cleanup()
  })

  it('Ctrl+Shift+Z calls history.redo', () => {
    const history = useHistoryStore()
    const spy = vi.spyOn(history, 'redo')
    const cleanup = enableDesignerKeyboard()
    fireKey({ key: 'z', ctrlKey: true, shiftKey: true })
    expect(spy).toHaveBeenCalled()
    cleanup()
  })

  it('Ctrl+Y calls history.redo', () => {
    const history = useHistoryStore()
    const spy = vi.spyOn(history, 'redo')
    const cleanup = enableDesignerKeyboard()
    fireKey({ key: 'y', ctrlKey: true })
    expect(spy).toHaveBeenCalled()
    cleanup()
  })

  it('undo/redo integrate end-to-end', () => {
    const canvas = useCanvasStore()
    const history = useHistoryStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    history.pushSnapshot() // baseline
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })
    history.pushSnapshot() // after add

    const cleanup = enableDesignerKeyboard()
    fireKey({ key: 'z', ctrlKey: true })
    expect(canvas.panels[0]!.printElements.length).toBe(0)
    fireKey({ key: 'z', ctrlKey: true, shiftKey: true }) // redo
    expect(canvas.panels[0]!.printElements.length).toBe(1)
    cleanup()
  })
})

describe('enableDesignerKeyboard — Tab cycle', () => {
  it('Tab with no selection selects the FIRST element', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })
    canvas.addElement('p1', { id: 'e2', tid: 't.text' })
    const cleanup = enableDesignerKeyboard()
    fireKey({ key: 'Tab' })
    expect(Array.from(canvas.selectedElementIds)).toEqual(['e1'])
    cleanup()
  })

  it('Tab with selection advances to NEXT (wraps)', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'a', tid: 't.text' })
    canvas.addElement('p1', { id: 'b', tid: 't.text' })
    canvas.addElement('p1', { id: 'c', tid: 't.text' })
    canvas.selectElement('a')
    const cleanup = enableDesignerKeyboard()
    fireKey({ key: 'Tab' })
    expect(Array.from(canvas.selectedElementIds)).toEqual(['b'])
    fireKey({ key: 'Tab' })
    expect(Array.from(canvas.selectedElementIds)).toEqual(['c'])
    fireKey({ key: 'Tab' })
    expect(Array.from(canvas.selectedElementIds)).toEqual(['a']) // wrap
    cleanup()
  })

  it('Shift+Tab goes backward', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'a', tid: 't.text' })
    canvas.addElement('p1', { id: 'b', tid: 't.text' })
    canvas.selectElement('b')
    const cleanup = enableDesignerKeyboard()
    fireKey({ key: 'Tab', shiftKey: true })
    expect(Array.from(canvas.selectedElementIds)).toEqual(['a'])
    cleanup()
  })
})

describe('enableDesignerKeyboard — Input focus suppression', () => {
  it('Delete inside <input> does NOT delete canvas selection', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })
    canvas.selectElement('e1')

    const input = document.createElement('input')
    document.body.appendChild(input)
    const cleanup = enableDesignerKeyboard()

    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Delete', bubbles: true })
    )
    expect(canvas.panels[0]!.printElements.length).toBe(1)
    cleanup()
  })

  it('Ctrl+C inside <textarea> does NOT copy canvas selection', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })
    canvas.selectElement('e1')

    const ta = document.createElement('textarea')
    document.body.appendChild(ta)
    const cleanup = enableDesignerKeyboard()
    ta.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'c',
        ctrlKey: true,
        bubbles: true,
      })
    )
    expect(_getClipboard()).toHaveLength(0)
    cleanup()
  })
})

describe('enableDesignerKeyboard — lifecycle', () => {
  it('cleanup removes the keydown listener', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })
    canvas.selectElement('e1')

    const cleanup = enableDesignerKeyboard()
    cleanup()
    fireKey({ key: 'Delete' })
    expect(canvas.panels[0]!.printElements.length).toBe(1)
  })

  it('handler exceptions are swallowed (warn instead of throw)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })
    canvas.selectElement('e1')

    vi.spyOn(canvas, 'removeElement').mockImplementation(() => {
      throw new Error('boom')
    })

    const cleanup = enableDesignerKeyboard()
    expect(() => fireKey({ key: 'Delete' })).not.toThrow()
    expect(warn).toHaveBeenCalled()
    cleanup()
    warn.mockRestore()
  })
})
