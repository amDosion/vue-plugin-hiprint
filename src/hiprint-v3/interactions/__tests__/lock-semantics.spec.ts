/**
 * lock-semantics.spec.ts — TKT-027 lock-semantics integration tests.
 *
 * Verifies the lock contract is honored across all 6 interaction sites:
 *
 *   1. drag-drop      — locked element drag is a no-op (no store mutation).
 *   2. resize         — sizeLocked element does NOT register interact.js
 *                       resizable (handles never bind).
 *   3. keyboard arrow — locked element arrow nudge is no-op; mixed selection
 *                       moves only unlocked subset.
 *   4. keyboard del   — `lock` blocks delete; `positionLocked` alone does NOT
 *                       (V1 quirk preserved); fully-locked-only selection
 *                       emits `[hiprint] cannot delete locked elements`.
 *   5. contextmenu    — Lock/Unlock toggle item; delete + cut disabled when
 *                       fully locked; programmatic delete still blocked.
 *   6. inline-edit    — TextElement.startEdit blocked when `lock` true.
 *   7. visual         — ElementWrapper root gets `.hiprint-element--locked`
 *                       class + lock-badge div.
 *
 * V1 reference: docs/V1-INVENTORY/interactions.md §1.5 / §2.1 / §4 / §8 /
 * §H.1 of per-etype Section H.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// ---------- interact.js mock (shared with drag-drop + resize) ----------
type CapturedDraggable = {
  el: HTMLElement
  options: {
    listeners?: {
      start?: (event: unknown) => void
      move?: (event: unknown) => void
      end?: (event: unknown) => void
    }
  }
}
type CapturedResizable = {
  el: HTMLElement
  options: { listeners?: Record<string, (event: unknown) => void> }
}

const captured: {
  draggable: CapturedDraggable[]
  resizable: CapturedResizable[]
  unsetCount: number
} = { draggable: [], resizable: [], unsetCount: 0 }

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
        captured.unsetCount++
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

// ---------- Mock @floating-ui/vue so context-menu tests don't need layout ----
vi.mock('@floating-ui/vue', () => ({
  computePosition: vi.fn(async () => ({ x: 0, y: 0 })),
  offset: vi.fn(() => ({ name: 'offset' })),
  flip: vi.fn(() => ({ name: 'flip' })),
  shift: vi.fn(() => ({ name: 'shift' })),
}))

// Now import the SUTs (after mocks).
import {
  enableElementDrag,
  enableDesignerKeyboard,
  enableElementResize,
  buildElementContextItems,
} from '@hiprint-v3/interactions'
import {
  isAnyLocked,
  isFullyLocked,
  isPositionLocked,
  isSizeLocked,
} from '../lock'
import { useCanvasStore } from '@hiprint-v3/stores'
import { mount } from '@vue/test-utils'
import ElementWrapper from '@hiprint-v3/components/elements/ElementWrapper.vue'
import TextElement from '@hiprint-v3/components/elements/TextElement.vue'

// ---------- Helpers ----------

function makeEl(): HTMLElement {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return el
}

function fireKey(opts: KeyboardEventInit & { key: string }): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { ...opts, bubbles: true }))
}

function lastDraggable(): CapturedDraggable {
  const c = captured.draggable[captured.draggable.length - 1]
  if (!c) throw new Error('No captured draggable')
  return c
}

beforeEach(() => {
  setActivePinia(createPinia())
  captured.draggable.length = 0
  captured.resizable.length = 0
  captured.unsetCount = 0
})

afterEach(() => {
  document.body.innerHTML = ''
})

// =============================================================================
// 1. lock.ts unit predicates
// =============================================================================

describe('lock predicates', () => {
  it('isFullyLocked returns true only for options.lock === true', () => {
    expect(isFullyLocked(undefined)).toBe(false)
    expect(isFullyLocked({})).toBe(false)
    expect(isFullyLocked({ positionLocked: true })).toBe(false)
    expect(isFullyLocked({ sizeLocked: true })).toBe(false)
    expect(isFullyLocked({ lock: true })).toBe(true)
  })

  it('isPositionLocked covers lock, positionLocked, draggable:false', () => {
    expect(isPositionLocked({})).toBe(false)
    expect(isPositionLocked({ lock: true })).toBe(true)
    expect(isPositionLocked({ positionLocked: true })).toBe(true)
    expect(isPositionLocked({ draggable: false })).toBe(true)
    // draggable:true does NOT lock — that's the default
    expect(isPositionLocked({ draggable: true })).toBe(false)
  })

  it('isSizeLocked covers lock OR sizeLocked', () => {
    expect(isSizeLocked({})).toBe(false)
    expect(isSizeLocked({ sizeLocked: true })).toBe(true)
    expect(isSizeLocked({ lock: true })).toBe(true)
    // positionLocked alone does NOT block resize
    expect(isSizeLocked({ positionLocked: true })).toBe(false)
  })

  it('isAnyLocked is the OR of all three', () => {
    expect(isAnyLocked({})).toBe(false)
    expect(isAnyLocked({ lock: true })).toBe(true)
    expect(isAnyLocked({ positionLocked: true })).toBe(true)
    expect(isAnyLocked({ sizeLocked: true })).toBe(true)
    expect(isAnyLocked({ draggable: false })).toBe(true)
  })
})

// =============================================================================
// 2. drag-drop — locked element drag is a no-op
// =============================================================================

describe('drag-drop — lock gate', () => {
  it('positionLocked element: drag start short-circuits, no store mutation on move', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { left: 10, top: 20, positionLocked: true },
    })

    enableElementDrag(makeEl(), { elementId: 'e1', panelId: 'p1' })
    const listeners = lastDraggable().options.listeners!
    listeners.start!({})
    listeners.move!({ dx: 50, dy: 50 })
    listeners.end!({})

    const opts = canvas.panels[0]!.printElements[0]!.options as Record<
      string,
      number
    >
    expect(opts.left).toBe(10)
    expect(opts.top).toBe(20)
  })

  it('lock=true element: drag is a no-op', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { left: 0, top: 0, lock: true },
    })

    enableElementDrag(makeEl(), { elementId: 'e1', panelId: 'p1' })
    const listeners = lastDraggable().options.listeners!
    listeners.start!({})
    listeners.move!({ dx: 30, dy: 30 })

    const opts = canvas.panels[0]!.printElements[0]!.options as Record<
      string,
      number
    >
    expect(opts.left).toBe(0)
    expect(opts.top).toBe(0)
  })

  it('draggable:false element: drag is a no-op (V1 alias of positionLocked)', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { left: 5, top: 5, draggable: false },
    })

    enableElementDrag(makeEl(), { elementId: 'e1', panelId: 'p1' })
    const listeners = lastDraggable().options.listeners!
    listeners.start!({})
    listeners.move!({ dx: 20, dy: 20 })

    const opts = canvas.panels[0]!.printElements[0]!.options as Record<
      string,
      number
    >
    expect(opts.left).toBe(5)
    expect(opts.top).toBe(5)
  })

  it('unlocked element: drag mutates store normally (regression guard)', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { left: 0, top: 0 },
    })

    enableElementDrag(makeEl(), { elementId: 'e1', panelId: 'p1' })
    const listeners = lastDraggable().options.listeners!
    listeners.start!({})
    listeners.move!({ dx: 10, dy: 10 })

    const opts = canvas.panels[0]!.printElements[0]!.options as Record<
      string,
      number
    >
    expect(opts.left).toBeGreaterThan(0)
    expect(opts.top).toBeGreaterThan(0)
  })

  it('drag start invokes event.interaction.stop() to cancel the gesture', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { positionLocked: true },
    })
    const stop = vi.fn()
    enableElementDrag(makeEl(), { elementId: 'e1', panelId: 'p1' })
    const listeners = lastDraggable().options.listeners!
    listeners.start!({ interaction: { stop } })
    expect(stop).toHaveBeenCalledTimes(1)
  })
})

// =============================================================================
// 3. resize — sizeLocked skips interact.js registration entirely
// =============================================================================

describe('resize — lock gate', () => {
  it('sizeLocked element: enableElementResize does NOT register interact.js resizable', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { sizeLocked: true },
    })

    enableElementResize(makeEl(), { elementId: 'e1', panelId: 'p1' })
    expect(captured.resizable.length).toBe(0)
  })

  it('lock=true element: resize handles do not bind', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { lock: true },
    })

    enableElementResize(makeEl(), { elementId: 'e1', panelId: 'p1' })
    expect(captured.resizable.length).toBe(0)
  })

  it('positionLocked-only element: resize STILL registers (V1 quirk)', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { positionLocked: true },
    })

    enableElementResize(makeEl(), { elementId: 'e1', panelId: 'p1' })
    expect(captured.resizable.length).toBe(1)
  })

  it('unlocked element: resize registers normally (regression guard)', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })

    enableElementResize(makeEl(), { elementId: 'e1', panelId: 'p1' })
    expect(captured.resizable.length).toBe(1)
  })

  it('sizeLocked enable returns a no-op cleanup (callable, no throw)', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { sizeLocked: true },
    })
    const cleanup = enableElementResize(makeEl(), {
      elementId: 'e1',
      panelId: 'p1',
    })
    expect(typeof cleanup).toBe('function')
    expect(() => cleanup()).not.toThrow()
  })
})

// =============================================================================
// 4. keyboard — arrow + delete lock semantics
// =============================================================================

describe('keyboard arrow — lock gate', () => {
  it('all-locked selection: arrow nudge is no-op', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { left: 10, top: 10, positionLocked: true },
    })
    canvas.selectMultiple(['e1'])
    const cleanup = enableDesignerKeyboard()
    fireKey({ key: 'ArrowRight' })
    const opts = canvas.panels[0]!.printElements[0]!.options as Record<
      string,
      number
    >
    expect(opts.left).toBe(10)
    cleanup()
  })

  it('mixed selection: only the unlocked element moves', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'locked',
      tid: 't.text',
      options: { left: 10, top: 10, positionLocked: true },
    })
    canvas.addElement('p1', {
      id: 'free',
      tid: 't.text',
      options: { left: 20, top: 20 },
    })
    canvas.selectMultiple(['locked', 'free'])
    const cleanup = enableDesignerKeyboard()
    fireKey({ key: 'ArrowRight' })
    const elsById = Object.fromEntries(
      canvas.panels[0]!.printElements.map((e) => [e.id, e.options as Record<string, number>])
    )
    expect(elsById.locked!.left).toBe(10)
    expect(elsById.free!.left).toBe(21)
    cleanup()
  })

  it('lock=true blocks arrow nudge (catch-all)', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { left: 5, top: 5, lock: true },
    })
    canvas.selectMultiple(['e1'])
    const cleanup = enableDesignerKeyboard()
    fireKey({ key: 'ArrowDown' })
    const opts = canvas.panels[0]!.printElements[0]!.options as Record<
      string,
      number
    >
    expect(opts.top).toBe(5)
    cleanup()
  })
})

describe('keyboard delete — lock gate', () => {
  it('fully-locked element (lock=true) is NOT deleted; emits warn', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { lock: true },
    })
    canvas.selectMultiple(['e1'])
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const cleanup = enableDesignerKeyboard()
    fireKey({ key: 'Delete' })
    expect(canvas.panels[0]!.printElements.length).toBe(1)
    expect(warn).toHaveBeenCalledWith('[hiprint] cannot delete locked elements')
    warn.mockRestore()
    cleanup()
  })

  it('positionLocked-only element IS deleted (V1 quirk preserved)', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { positionLocked: true },
    })
    canvas.selectMultiple(['e1'])
    const cleanup = enableDesignerKeyboard()
    fireKey({ key: 'Delete' })
    expect(canvas.panels[0]!.printElements.length).toBe(0)
    cleanup()
  })

  it('sizeLocked-only element IS deleted (V1 quirk preserved)', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { sizeLocked: true },
    })
    canvas.selectMultiple(['e1'])
    const cleanup = enableDesignerKeyboard()
    fireKey({ key: 'Delete' })
    expect(canvas.panels[0]!.printElements.length).toBe(0)
    cleanup()
  })

  it('mixed selection: fully-locked stays, unlocked is deleted', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'lockedFull',
      tid: 't.text',
      options: { lock: true },
    })
    canvas.addElement('p1', { id: 'free', tid: 't.text' })
    canvas.selectMultiple(['lockedFull', 'free'])
    const cleanup = enableDesignerKeyboard()
    fireKey({ key: 'Delete' })
    const remaining = canvas.panels[0]!.printElements.map((e) => e.id)
    expect(remaining).toEqual(['lockedFull'])
    cleanup()
  })

  it('Backspace honors the same lock gate', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { lock: true },
    })
    canvas.selectMultiple(['e1'])
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const cleanup = enableDesignerKeyboard()
    fireKey({ key: 'Backspace' })
    expect(canvas.panels[0]!.printElements.length).toBe(1)
    warn.mockRestore()
    cleanup()
  })
})

// =============================================================================
// 5. context-menu — lock-aware items
// =============================================================================

describe('context-menu — lock semantics', () => {
  it('unlocked element: menu shows "Lock" item; Delete + Cut enabled', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })
    const items = buildElementContextItems('e1')
    const lockItem = items.find((i) => i.id === 'lock' || i.id === 'unlock')
    expect(lockItem?.id).toBe('lock')
    const del = items.find((i) => i.id === 'delete')
    expect(del?.disabled).toBeFalsy()
    const cut = items.find((i) => i.id === 'cut')
    expect(cut?.disabled).toBeFalsy()
  })

  it('locked element: menu shows "Unlock" item', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { positionLocked: true },
    })
    const items = buildElementContextItems('e1')
    const lockItem = items.find((i) => i.id === 'lock' || i.id === 'unlock')
    expect(lockItem?.id).toBe('unlock')
  })

  it('fully-locked element: Delete + Cut menu items are disabled', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { lock: true },
    })
    const items = buildElementContextItems('e1')
    expect(items.find((i) => i.id === 'delete')?.disabled).toBe(true)
    expect(items.find((i) => i.id === 'cut')?.disabled).toBe(true)
  })

  it('positionLocked-only: Delete + Cut menu items are NOT disabled (V1 quirk)', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { positionLocked: true },
    })
    const items = buildElementContextItems('e1')
    expect(items.find((i) => i.id === 'delete')?.disabled).toBeFalsy()
    expect(items.find((i) => i.id === 'cut')?.disabled).toBeFalsy()
  })

  it('contextmenu delete: programmatic onClick on fully-locked is a no-op + warn', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { lock: true },
    })
    const items = buildElementContextItems('e1')
    const del = items.find((i) => i.id === 'delete')!
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // Defense-in-depth — invoke the onClick directly bypassing the `disabled`
    // gate. The handler MUST refuse to delete.
    del.onClick?.()
    expect(canvas.panels[0]!.printElements.length).toBe(1)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('contextmenu Lock item: sets positionLocked + sizeLocked on click', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text' })
    const items = buildElementContextItems('e1')
    const lockItem = items.find((i) => i.id === 'lock')!
    lockItem.onClick?.()
    const opts = canvas.panels[0]!.printElements[0]!.options as Record<
      string,
      unknown
    >
    expect(opts.positionLocked).toBe(true)
    expect(opts.sizeLocked).toBe(true)
  })

  it('contextmenu Unlock item: clears positionLocked (V1 quirk: sizeLocked retained)', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { positionLocked: true, sizeLocked: true },
    })
    const items = buildElementContextItems('e1')
    const unlockItem = items.find((i) => i.id === 'unlock')!
    unlockItem.onClick?.()
    const opts = canvas.panels[0]!.printElements[0]!.options as Record<
      string,
      unknown
    >
    expect(opts.positionLocked).toBe(false)
    // V1 quirk preserved — unlock keeps sizeLocked.
    expect(opts.sizeLocked).toBe(true)
  })
})

// =============================================================================
// 6. ElementWrapper — visual indicator
// =============================================================================

describe('ElementWrapper — visual lock indicator', () => {
  it('locked element: root carries `.hiprint-element--locked` class', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { positionLocked: true },
    })
    const w = mount(ElementWrapper, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    const root = w.element as HTMLElement
    expect(root.classList.contains('hiprint-element--locked')).toBe(true)
    w.unmount()
  })

  it('unlocked element: NO locked class on root', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
    })
    const w = mount(ElementWrapper, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    const root = w.element as HTMLElement
    expect(root.classList.contains('hiprint-element--locked')).toBe(false)
    expect(root.querySelector('.hiprint-element__lock-badge')).toBeNull()
    w.unmount()
  })

  it('lock badge div is rendered when locked', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { lock: true },
    })
    const w = mount(ElementWrapper, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    const root = w.element as HTMLElement
    expect(root.querySelector('.hiprint-element__lock-badge')).not.toBeNull()
    w.unmount()
  })

  it('class + badge react to store mutations (lock toggle)', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
    })
    const w = mount(ElementWrapper, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    const root = w.element as HTMLElement
    expect(root.classList.contains('hiprint-element--locked')).toBe(false)

    canvas.updateElement('p1', 'e1', { options: { positionLocked: true } })
    await w.vm.$nextTick()
    expect(root.classList.contains('hiprint-element--locked')).toBe(true)
    expect(root.querySelector('.hiprint-element__lock-badge')).not.toBeNull()
    w.unmount()
  })
})

// =============================================================================
// 7. TextElement — inline edit lock gate
// =============================================================================

describe('TextElement — inline edit lock gate', () => {
  it('lock=true: double-click does NOT enter edit mode', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { title: 'Hi', lock: true },
    })
    const w = mount(TextElement, {
      props: {
        elementId: 'e1',
        panelId: 'p1',
        editable: true,
        interactive: false,
      },
      attachTo: document.body,
    })
    const content = w.find('.hiprint-printElement-text-content').element
    content.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    await w.vm.$nextTick()
    // No input should be rendered — startEdit returned early.
    expect(w.find('.hiprint-text-inline-edit').exists()).toBe(false)
    w.unmount()
  })

  it('positionLocked alone DOES allow inline edit (V1 quirk preserved)', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { title: 'Hi', positionLocked: true },
    })
    const w = mount(TextElement, {
      props: {
        elementId: 'e1',
        panelId: 'p1',
        editable: true,
        interactive: false,
      },
      attachTo: document.body,
    })
    const content = w.find('.hiprint-printElement-text-content').element
    content.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('.hiprint-text-inline-edit').exists()).toBe(true)
    w.unmount()
  })

  it('unlocked: double-click enters edit mode (regression guard)', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { title: 'Hi' },
    })
    const w = mount(TextElement, {
      props: {
        elementId: 'e1',
        panelId: 'p1',
        editable: true,
        interactive: false,
      },
      attachTo: document.body,
    })
    const content = w.find('.hiprint-printElement-text-content').element
    content.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('.hiprint-text-inline-edit').exists()).toBe(true)
    w.unmount()
  })
})
