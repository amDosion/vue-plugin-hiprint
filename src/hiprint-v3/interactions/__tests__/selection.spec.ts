/**
 * selection.spec.ts — V3 selection bindings unit tests (P16.4).
 *
 * Covers:
 *  - enableElementSelection: click → canvas.selectElement(mode) — replace / add / toggle
 *  - enableElementSelection: clicking inactive panel's element → setActivePanel
 *  - enableElementSelection: editable target (input inside) → no-op
 *  - enableElementSelection: handler exception is swallowed
 *  - enableLasso: pointerdown on background draws + selects intersecting
 *  - enableLasso: pointerdown on child element → NOT a lasso start
 *  - enableSelectionShortcuts: Ctrl+A selects active panel; Escape clears
 *  - enableSelectionShortcuts: input focus suppresses both shortcuts
 *  - cleanup removes listeners
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import {
  enableElementSelection,
  enableLasso,
  enableSelectionShortcuts,
} from '../selection'
import { useCanvasStore } from '@hiprint-v3/stores'

beforeEach(() => {
  setActivePinia(createPinia())
})

afterEach(() => {
  document.body.innerHTML = ''
})

function makeEl(): HTMLElement {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return el
}

describe('enableElementSelection — click modes', () => {
  it('plain click → mode = replace', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })
    canvas.addElement('p1', { id: 'e2', tid: 't.text' })

    const spy = vi.spyOn(canvas, 'selectElement')
    const el = makeEl()
    const cleanup = enableElementSelection(el, 'e1', 'p1')
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }))
    expect(spy).toHaveBeenCalledWith('e1', 'replace')
    cleanup()
  })

  it('shift+click → mode = add', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })

    const spy = vi.spyOn(canvas, 'selectElement')
    const el = makeEl()
    enableElementSelection(el, 'e1', 'p1')
    el.dispatchEvent(
      new MouseEvent('click', { bubbles: true, button: 0, shiftKey: true })
    )
    expect(spy).toHaveBeenCalledWith('e1', 'add')
  })

  it('ctrl+click → mode = toggle', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })

    const spy = vi.spyOn(canvas, 'selectElement')
    const el = makeEl()
    enableElementSelection(el, 'e1', 'p1')
    el.dispatchEvent(
      new MouseEvent('click', { bubbles: true, button: 0, ctrlKey: true })
    )
    expect(spy).toHaveBeenCalledWith('e1', 'toggle')
  })

  it('right-click (button !== 0) is ignored', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })

    const spy = vi.spyOn(canvas, 'selectElement')
    const el = makeEl()
    enableElementSelection(el, 'e1', 'p1')
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 2 }))
    expect(spy).not.toHaveBeenCalled()
  })

  it('activates the panel when clicking element of an inactive panel', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addPanel({ id: 'p2', width: 200, height: 200 })
    canvas.addElement('p2', { id: 'e1', tid: 't.text' })
    canvas.setActivePanel('p1')

    const el = makeEl()
    enableElementSelection(el, 'e1', 'p2')
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }))
    expect(canvas.activePanelId).toBe('p2')
  })

  it('clicks originating from <input> inside element are ignored', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })

    const spy = vi.spyOn(canvas, 'selectElement')
    const el = makeEl()
    const input = document.createElement('input')
    el.appendChild(input)
    enableElementSelection(el, 'e1', 'p1')

    const evt = new MouseEvent('click', { bubbles: true, button: 0 })
    // Simulate event.target === input (clicking the input).
    input.dispatchEvent(evt)
    expect(spy).not.toHaveBeenCalled()
  })

  it('fires opts.onChange with elementId + mode', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })

    const onChange = vi.fn()
    const el = makeEl()
    enableElementSelection(el, 'e1', 'p1', { onChange })
    el.dispatchEvent(
      new MouseEvent('click', { bubbles: true, button: 0, shiftKey: true })
    )
    expect(onChange).toHaveBeenCalledWith({ elementId: 'e1', mode: 'add' })
  })

  it('handler exception is swallowed (warn instead)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })

    const el = makeEl()
    enableElementSelection(el, 'e1', 'p1', {
      onChange: () => {
        throw new Error('boom')
      },
    })
    expect(() => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }))
    }).not.toThrow()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('cleanup removes the click listener', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })
    const spy = vi.spyOn(canvas, 'selectElement')
    const el = makeEl()
    const cleanup = enableElementSelection(el, 'e1', 'p1')
    cleanup()
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }))
    expect(spy).not.toHaveBeenCalled()
  })

  it('rejects missing el / ids with warn (no throw)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() =>
      enableElementSelection(null as unknown as HTMLElement, 'e1', 'p1')
    ).not.toThrow()
    expect(() => enableElementSelection(makeEl(), '', 'p1')).not.toThrow()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('enableLasso', () => {
  function makePanel(): HTMLElement {
    const panel = document.createElement('div')
    panel.className = 'hiprint-panel'
    document.body.appendChild(panel)
    return panel
  }

  function makeChild(panel: HTMLElement, id: string): HTMLElement {
    const c = document.createElement('div')
    c.className = 'hiprint-element'
    c.setAttribute('data-element-id', id)
    panel.appendChild(c)
    return c
  }

  it('pointerdown on panel BACKGROUND starts a lasso (lasso div appears)', () => {
    const panel = makePanel()
    enableLasso(panel, 'p1')
    const evt = new PointerEvent('pointerdown', {
      bubbles: true,
      button: 0,
      clientX: 10,
      clientY: 20,
    })
    // Force target === panel by dispatching on panel directly.
    panel.dispatchEvent(evt)
    expect(document.querySelector('.hiprint-lasso')).toBeTruthy()
    // Cleanup by simulating pointerup.
    document.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, clientX: 11, clientY: 21 })
    )
    expect(document.querySelector('.hiprint-lasso')).toBeFalsy()
  })

  it('pointerdown on child element does NOT start a lasso', () => {
    const panel = makePanel()
    const child = makeChild(panel, 'e1')
    enableLasso(panel, 'p1')
    child.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, button: 0 })
    )
    expect(document.querySelector('.hiprint-lasso')).toBeFalsy()
  })

  it('pointerup dispatches selectMultiple with intersecting element ids', () => {
    const panel = makePanel()
    const a = makeChild(panel, 'a')
    const b = makeChild(panel, 'b')
    const c = makeChild(panel, 'c')

    // Mock getBoundingClientRect on each child + on the lasso.
    // Lasso occupies (50,50)-(150,150).
    // a intersects, b touches outside, c is fully inside.
    a.getBoundingClientRect = () =>
      ({ left: 40, top: 40, right: 60, bottom: 60 }) as DOMRect
    b.getBoundingClientRect = () =>
      ({ left: 200, top: 200, right: 220, bottom: 220 }) as DOMRect
    c.getBoundingClientRect = () =>
      ({ left: 80, top: 80, right: 120, bottom: 120 }) as DOMRect

    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    const spy = vi.spyOn(canvas, 'selectMultiple')

    enableLasso(panel, 'p1')
    panel.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: 50,
        clientY: 50,
      })
    )
    document.dispatchEvent(
      new PointerEvent('pointermove', { bubbles: true, clientX: 150, clientY: 150 })
    )
    // Force the lasso's getBoundingClientRect to match its computed style.
    const lasso = document.querySelector('.hiprint-lasso') as HTMLElement
    lasso.getBoundingClientRect = () =>
      ({ left: 50, top: 50, right: 150, bottom: 150 }) as DOMRect

    document.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, clientX: 150, clientY: 150 })
    )

    expect(spy).toHaveBeenCalled()
    const ids = spy.mock.calls[0]![0]
    expect(ids).toEqual(expect.arrayContaining(['a', 'c']))
    expect(ids).not.toContain('b')
  })

  it('right-click pointerdown is ignored (button !== 0)', () => {
    const panel = makePanel()
    enableLasso(panel, 'p1')
    panel.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        button: 2,
        clientX: 10,
        clientY: 20,
      })
    )
    expect(document.querySelector('.hiprint-lasso')).toBeFalsy()
  })

  it('cleanup removes pointerdown listener', () => {
    const panel = makePanel()
    const cleanup = enableLasso(panel, 'p1')
    cleanup()
    panel.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: 10,
        clientY: 20,
      })
    )
    expect(document.querySelector('.hiprint-lasso')).toBeFalsy()
  })

  it('rejects missing panelEl / panelId with warn (no throw)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => enableLasso(null as unknown as HTMLElement, 'p1')).not.toThrow()
    expect(() => enableLasso(makeEl(), '')).not.toThrow()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('enableSelectionShortcuts', () => {
  it('Ctrl+A selects all elements in active panel', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })
    canvas.addElement('p1', { id: 'e2', tid: 't.text' })
    canvas.addElement('p1', { id: 'e3', tid: 't.text' })

    const cleanup = enableSelectionShortcuts()
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'a', ctrlKey: true })
    )
    expect(Array.from(canvas.selectedElementIds).sort()).toEqual([
      'e1',
      'e2',
      'e3',
    ])
    cleanup()
  })

  it('Escape clears selection', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })
    canvas.selectElement('e1')
    expect(canvas.selectedElementIds.size).toBe(1)

    const cleanup = enableSelectionShortcuts()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(canvas.selectedElementIds.size).toBe(0)
    cleanup()
  })

  it('Ctrl+A inside <input> is NOT hijacked', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })

    const input = document.createElement('input')
    document.body.appendChild(input)
    const cleanup = enableSelectionShortcuts()

    // Dispatch keydown FROM the input element (target === input).
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'a',
        ctrlKey: true,
        bubbles: true,
      })
    )
    expect(canvas.selectedElementIds.size).toBe(0)
    cleanup()
  })

  it('cleanup removes the global listener', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })

    const cleanup = enableSelectionShortcuts()
    cleanup()
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'a', ctrlKey: true })
    )
    expect(canvas.selectedElementIds.size).toBe(0)
  })

  it('shortcut handler exception is swallowed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })
    // Force selectMultiple to throw.
    vi.spyOn(canvas, 'selectMultiple').mockImplementation(() => {
      throw new Error('boom')
    })
    const cleanup = enableSelectionShortcuts()
    expect(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'a', ctrlKey: true })
      )
    }).not.toThrow()
    expect(warn).toHaveBeenCalled()
    cleanup()
    warn.mockRestore()
  })
})
