/**
 * context-menu.spec.ts — V3 right-click menu unit tests (P16.3).
 *
 * Strategy:
 *   - happy-dom supports Vue createApp + mount → we test the real Vue lifecycle.
 *   - We mock @floating-ui/vue's `computePosition` so we don't depend on real
 *     layout measurement (happy-dom returns zeroes for getBoundingClientRect).
 *   - Tests cover: open/close/idempotent, item click → onSelect + onClick, ESC
 *     dismiss, outside click dismiss, buildElementContextItems wiring.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock floating-ui to avoid layout calls.
vi.mock('@floating-ui/vue', () => ({
  computePosition: vi.fn(async () => ({ x: 100, y: 200 })),
  offset: vi.fn((v: number) => ({ name: 'offset', v })),
  flip: vi.fn(() => ({ name: 'flip' })),
  shift: vi.fn((opts: unknown) => ({ name: 'shift', opts })),
}))

import {
  openContextMenu,
  buildElementContextItems,
  _setClipboard,
  _getClipboard,
} from '../context-menu'
import { useCanvasStore } from '@hiprint-v3/stores'
import { computePosition } from '@floating-ui/vue'

beforeEach(() => {
  setActivePinia(createPinia())
  ;(computePosition as unknown as { mockClear: () => void }).mockClear()
})

afterEach(() => {
  // Clean any stray menu portals between tests.
  document.querySelectorAll('.hiprint-context-menu-portal').forEach((n) =>
    n.parentNode?.removeChild(n)
  )
  _setClipboard([])
})

async function flush(): Promise<void> {
  // Allow Vue's microtask + the awaited computePosition to settle.
  await Promise.resolve()
  await Promise.resolve()
}

describe('openContextMenu — lifecycle', () => {
  it('mounts a portal div under document.body', async () => {
    const ctrl = openContextMenu(
      { x: 50, y: 50 },
      {
        items: [{ id: 'a', label: 'Hello' }],
      }
    )
    await flush()
    expect(document.querySelectorAll('.hiprint-context-menu-portal').length).toBe(
      1
    )
    expect(ctrl.isOpen).toBe(true)
    ctrl.close()
  })

  it('close() unmounts portal + flips isOpen', async () => {
    const ctrl = openContextMenu(
      { x: 10, y: 10 },
      { items: [{ id: 'a', label: 'A' }] }
    )
    await flush()
    expect(ctrl.isOpen).toBe(true)
    ctrl.close()
    expect(ctrl.isOpen).toBe(false)
    expect(document.querySelectorAll('.hiprint-context-menu-portal').length).toBe(
      0
    )
  })

  it('close() is idempotent (multiple calls safe)', async () => {
    const ctrl = openContextMenu(
      { x: 10, y: 10 },
      { items: [{ id: 'a', label: 'A' }] }
    )
    await flush()
    expect(() => {
      ctrl.close()
      ctrl.close()
      ctrl.close()
    }).not.toThrow()
  })

  it('calls computePosition with offset+flip+shift middleware', async () => {
    openContextMenu(
      { x: 30, y: 40 },
      { items: [{ id: 'a', label: 'A' }] }
    )
    await flush()
    expect(computePosition).toHaveBeenCalled()
    const args = (computePosition as unknown as { mock: { calls: unknown[][] } })
      .mock.calls[0]!
    const opts = args[2] as { middleware: Array<{ name: string }> }
    const names = opts.middleware.map((m) => m.name)
    expect(names).toContain('offset')
    expect(names).toContain('flip')
    expect(names).toContain('shift')
  })
})

describe('openContextMenu — items', () => {
  it('renders one .hiprint-context-menu-item per non-divider item', async () => {
    openContextMenu(
      { x: 0, y: 0 },
      {
        items: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
          { id: 'sep', label: '', divider: true },
          { id: 'c', label: 'C' },
        ],
      }
    )
    await flush()
    const items = document.querySelectorAll('.hiprint-context-menu-item')
    expect(items.length).toBe(3)
    const dividers = document.querySelectorAll('.hiprint-context-menu-divider')
    expect(dividers.length).toBe(1)
  })

  it('click on item triggers onSelect + onClick + closes', async () => {
    const onSelect = vi.fn()
    const onClick = vi.fn()
    const ctrl = openContextMenu(
      { x: 0, y: 0 },
      {
        items: [{ id: 'x', label: 'X', onClick }],
        onSelect,
      }
    )
    await flush()
    const item = document.querySelector(
      '.hiprint-context-menu-item'
    ) as HTMLElement
    expect(item).toBeTruthy()
    item.click()
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0]![0]).toMatchObject({ id: 'x' })
    expect(ctrl.isOpen).toBe(false)
  })

  it('disabled item: click does NOT fire callbacks or close', async () => {
    const onSelect = vi.fn()
    const onClick = vi.fn()
    const ctrl = openContextMenu(
      { x: 0, y: 0 },
      {
        items: [{ id: 'x', label: 'X', disabled: true, onClick }],
        onSelect,
      }
    )
    await flush()
    const item = document.querySelector(
      '.hiprint-context-menu-item'
    ) as HTMLElement
    item.click()
    expect(onClick).not.toHaveBeenCalled()
    expect(onSelect).not.toHaveBeenCalled()
    expect(ctrl.isOpen).toBe(true)
    ctrl.close()
  })

  it('onClick exception is swallowed via safeCall (warn instead)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const ctrl = openContextMenu(
      { x: 0, y: 0 },
      {
        items: [
          {
            id: 'boom',
            label: 'Boom',
            onClick: () => {
              throw new Error('boom')
            },
          },
        ],
      }
    )
    await flush()
    const item = document.querySelector(
      '.hiprint-context-menu-item'
    ) as HTMLElement
    expect(() => item.click()).not.toThrow()
    expect(warn).toHaveBeenCalled()
    expect(ctrl.isOpen).toBe(false) // still closes
    warn.mockRestore()
  })

  it('items prop accepts a getter and snapshots at open time', async () => {
    let items = [{ id: 'a', label: 'A' }]
    openContextMenu(
      { x: 0, y: 0 },
      { items: () => items }
    )
    // After open, mutating source should NOT affect rendered menu.
    items = [{ id: 'b', label: 'B' }]
    await flush()
    const labels = Array.from(
      document.querySelectorAll('.hiprint-context-menu-label')
    ).map((n) => n.textContent)
    expect(labels).toEqual(['A'])
  })
})

describe('openContextMenu — dismiss handlers', () => {
  it('Escape key dismisses the menu', async () => {
    const ctrl = openContextMenu(
      { x: 0, y: 0 },
      { items: [{ id: 'a', label: 'A' }] }
    )
    await flush()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(ctrl.isOpen).toBe(false)
  })

  it('mousedown outside menu dismisses it', async () => {
    const ctrl = openContextMenu(
      { x: 0, y: 0 },
      { items: [{ id: 'a', label: 'A' }] }
    )
    await flush()
    // Synthetic mousedown on body (outside menu root).
    document.body.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true })
    )
    expect(ctrl.isOpen).toBe(false)
  })

  it('mousedown INSIDE menu does NOT dismiss', async () => {
    const ctrl = openContextMenu(
      { x: 0, y: 0 },
      { items: [{ id: 'a', label: 'A' }] }
    )
    await flush()
    const menu = document.querySelector('.hiprint-context-menu') as HTMLElement
    menu.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(ctrl.isOpen).toBe(true)
    ctrl.close()
  })
})

describe('buildElementContextItems — handlers wire canvas actions', () => {
  it('returns items array containing copy/paste/cut/delete/properties', () => {
    const items = buildElementContextItems('e1')
    const ids = items.map((i) => i.id)
    expect(ids).toContain('copy')
    expect(ids).toContain('paste')
    expect(ids).toContain('cut')
    expect(ids).toContain('delete')
    expect(ids).toContain('properties')
    expect(ids).toContain('bring-to-front')
    expect(ids).toContain('send-to-back')
  })

  it('copy populates the internal clipboard', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { left: 5, top: 7, title: 'Hello' },
    })
    const items = buildElementContextItems('e1')
    const copy = items.find((i) => i.id === 'copy')!
    copy.onClick!()
    const clip = _getClipboard()
    expect(clip).toHaveLength(1)
    expect(clip[0]!.id).toBe('e1')
    expect((clip[0]!.options as Record<string, unknown>).title).toBe('Hello')
  })

  it('delete removes the element from canvas', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })
    expect(canvas.panels[0]!.printElements.length).toBe(1)
    const items = buildElementContextItems('e1')
    items.find((i) => i.id === 'delete')!.onClick!()
    expect(canvas.panels[0]!.printElements.length).toBe(0)
  })

  it('cut: copies + deletes', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text', options: { left: 1 } })
    const items = buildElementContextItems('e1')
    items.find((i) => i.id === 'cut')!.onClick!()
    expect(canvas.panels[0]!.printElements.length).toBe(0)
    expect(_getClipboard()).toHaveLength(1)
  })

  it('paste creates a new element in active panel', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text', options: { left: 0 } })
    // Copy then delete the original, then paste.
    const items = buildElementContextItems('e1')
    items.find((i) => i.id === 'copy')!.onClick!()
    canvas.removeElement('p1', 'e1')
    expect(canvas.panels[0]!.printElements.length).toBe(0)
    items.find((i) => i.id === 'paste')!.onClick!()
    expect(canvas.panels[0]!.printElements.length).toBe(1)
    // New element should have a different id (auto-assigned).
    expect(canvas.panels[0]!.printElements[0]!.id).not.toBe('e1')
  })

  it('bring-to-front moves element to end of printElements', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'a', tid: 't.text' })
    canvas.addElement('p1', { id: 'b', tid: 't.text' })
    canvas.addElement('p1', { id: 'c', tid: 't.text' })
    const items = buildElementContextItems('a')
    items.find((i) => i.id === 'bring-to-front')!.onClick!()
    const order = canvas.panels[0]!.printElements.map((e) => e.id)
    expect(order).toEqual(['b', 'c', 'a'])
  })

  it('send-to-back moves element to start of printElements', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'a', tid: 't.text' })
    canvas.addElement('p1', { id: 'b', tid: 't.text' })
    canvas.addElement('p1', { id: 'c', tid: 't.text' })
    const items = buildElementContextItems('c')
    items.find((i) => i.id === 'send-to-back')!.onClick!()
    const order = canvas.panels[0]!.printElements.map((e) => e.id)
    expect(order).toEqual(['c', 'a', 'b'])
  })
})
