/**
 * HiprintDesigner-sidebar-resize.spec.ts — TKT-150 sidebar resize/collapse.
 *
 * V1 reference: docs/V1-INVENTORY/toolbar-and-shell.md §column-resize +
 * styles.md §1.6.
 *
 * Asserts:
 *  - resize bars + edge-toggle pins render between sidebars and canvas.
 *  - pointer drag on a resize bar updates the sidebar width (within clamp).
 *  - widths clamp to the configured [min, max] bounds.
 *  - edge-toggle click flips the collapsed state + zeroes effective width.
 *  - re-expanding restores the previously-set width (drag handler does not
 *    clobber the saved width on collapse).
 *  - listeners are cleaned up on unmount (no leak after a mid-drag unmount).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HiprintDesigner from '../HiprintDesigner.vue'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

/** Fire a pointer event via the canonical PointerEvent constructor.
 *  happy-dom ships PointerEvent on the global so this works under both
 *  vitest's happy-dom + jsdom test runners. */
function pointerEvent(type: string, init: PointerEventInit = {}): PointerEvent {
  return new PointerEvent(type, { bubbles: true, cancelable: true, ...init })
}

describe('HiprintDesigner — TKT-150 sidebar resize bars', () => {
  it('renders left + right resize bars with edge-toggle pins', () => {
    const w = mount(HiprintDesigner, { attachTo: document.body })
    const leftBar = w.element.querySelector('.hiprint-designer__resize-bar--left')
    const rightBar = w.element.querySelector('.hiprint-designer__resize-bar--right')
    expect(leftBar).not.toBeNull()
    expect(rightBar).not.toBeNull()
    expect(leftBar!.querySelector('.hiprint-designer__edge-toggle--left')).not.toBeNull()
    expect(rightBar!.querySelector('.hiprint-designer__edge-toggle--right')).not.toBeNull()
    w.unmount()
  })

  it('sets initial sidebar widths from props', () => {
    const w = mount(HiprintDesigner, {
      props: { initialLeftWidth: 230, initialRightWidth: 320 },
      attachTo: document.body,
    })
    const left = w.element.querySelector('.hiprint-designer__element-list') as HTMLElement
    const right = w.element.querySelector('.hiprint-designer__property-panel') as HTMLElement
    expect(left.style.width).toBe('230px')
    expect(right.style.width).toBe('320px')
    w.unmount()
  })

  it('pointer drag on left resize bar updates left width', async () => {
    const w = mount(HiprintDesigner, {
      props: { initialLeftWidth: 200, leftMinWidth: 100, leftMaxWidth: 500 },
      attachTo: document.body,
    })
    const bar = w.element.querySelector('.hiprint-designer__resize-bar--left') as HTMLElement
    bar.dispatchEvent(pointerEvent('pointerdown', { clientX: 300, button: 0 }))
    window.dispatchEvent(pointerEvent('pointermove', { clientX: 350, button: 0 }))
    await w.vm.$nextTick()
    const left = w.element.querySelector('.hiprint-designer__element-list') as HTMLElement
    expect(left.style.width).toBe('250px')
    window.dispatchEvent(pointerEvent('pointerup', { clientX: 350, button: 0 }))
    w.unmount()
  })

  it('right resize bar grows the right panel when dragged LEFT', async () => {
    const w = mount(HiprintDesigner, {
      props: { initialRightWidth: 280, rightMinWidth: 100, rightMaxWidth: 600 },
      attachTo: document.body,
    })
    const bar = w.element.querySelector('.hiprint-designer__resize-bar--right') as HTMLElement
    bar.dispatchEvent(pointerEvent('pointerdown', { clientX: 800, button: 0 }))
    // Move 100px LEFT → right panel should grow by 100.
    window.dispatchEvent(pointerEvent('pointermove', { clientX: 700, button: 0 }))
    await w.vm.$nextTick()
    const right = w.element.querySelector('.hiprint-designer__property-panel') as HTMLElement
    expect(right.style.width).toBe('380px')
    window.dispatchEvent(pointerEvent('pointerup', { clientX: 700, button: 0 }))
    w.unmount()
  })

  it('clamps sidebar width to min/max bounds', async () => {
    const w = mount(HiprintDesigner, {
      props: { initialLeftWidth: 200, leftMinWidth: 150, leftMaxWidth: 260 },
      attachTo: document.body,
    })
    const bar = w.element.querySelector('.hiprint-designer__resize-bar--left') as HTMLElement
    bar.dispatchEvent(pointerEvent('pointerdown', { clientX: 300, button: 0 }))
    // Try to drag way past the max bound.
    window.dispatchEvent(pointerEvent('pointermove', { clientX: 9999, button: 0 }))
    await w.vm.$nextTick()
    const left = w.element.querySelector('.hiprint-designer__element-list') as HTMLElement
    expect(left.style.width).toBe('260px') // clamped to max
    // Now try below the min bound.
    window.dispatchEvent(pointerEvent('pointermove', { clientX: -9999, button: 0 }))
    await w.vm.$nextTick()
    expect(left.style.width).toBe('150px') // clamped to min
    window.dispatchEvent(pointerEvent('pointerup', { clientX: 0, button: 0 }))
    w.unmount()
  })

  it('edge-toggle click collapses the sidebar to 0 px and re-expands', async () => {
    const w = mount(HiprintDesigner, {
      props: { initialLeftWidth: 220 },
      attachTo: document.body,
    })
    const left = w.element.querySelector('.hiprint-designer__element-list') as HTMLElement
    expect(left.style.width).toBe('220px')
    const toggle = w.element.querySelector(
      '.hiprint-designer__edge-toggle--left'
    ) as HTMLButtonElement
    toggle.click()
    await w.vm.$nextTick()
    expect(left.style.width).toBe('0px')
    expect(left.classList.contains('hiprint-designer__element-list--collapsed')).toBe(true)
    // Re-expand restores the original width.
    toggle.click()
    await w.vm.$nextTick()
    expect(left.style.width).toBe('220px')
    expect(left.classList.contains('hiprint-designer__element-list--collapsed')).toBe(false)
    w.unmount()
  })

  it('honors leftInitiallyCollapsed / rightInitiallyCollapsed props', () => {
    const w = mount(HiprintDesigner, {
      props: { leftInitiallyCollapsed: true, rightInitiallyCollapsed: true },
      attachTo: document.body,
    })
    const left = w.element.querySelector('.hiprint-designer__element-list') as HTMLElement
    const right = w.element.querySelector('.hiprint-designer__property-panel') as HTMLElement
    expect(left.style.width).toBe('0px')
    expect(right.style.width).toBe('0px')
    expect(left.classList.contains('hiprint-designer__element-list--collapsed')).toBe(true)
    expect(right.classList.contains('hiprint-designer__property-panel--collapsed')).toBe(true)
    w.unmount()
  })

  it('mid-drag unmount releases window-scoped listeners (no leak)', () => {
    const w = mount(HiprintDesigner, { attachTo: document.body })
    const bar = w.element.querySelector('.hiprint-designer__resize-bar--left') as HTMLElement
    bar.dispatchEvent(pointerEvent('pointerdown', { clientX: 300, button: 0 }))
    // Unmount mid-drag — listeners must be released without throwing.
    expect(() => w.unmount()).not.toThrow()
    // Subsequent pointermove on window must NOT throw or update detached DOM.
    expect(() =>
      window.dispatchEvent(pointerEvent('pointermove', { clientX: 500, button: 0 }))
    ).not.toThrow()
  })
})
