/**
 * HiprintCanvas-guide-lines.spec.ts — TKT-102 ruler-drag → guide creation
 * + existing guide drag + delete-into-ruler integration tests.
 *
 * Mount HiprintCanvas, dispatch synthetic pointer events on the ruler SVGs
 * and on existing guide-line nodes, then assert canvas store mutations.
 *
 * happy-dom does NOT auto-fire PointerEvent on element.dispatchEvent()
 * exactly the way browsers do, but it does run the registered listeners.
 * We attach pointermove/up to `window`, so we dispatch a window-targeted
 * event for those phases.
 *
 * Coordinate math:
 *  - The component calls findActivePaperEl().getBoundingClientRect() to
 *    convert client coords → paper-pt. happy-dom returns 0/0 rects, so the
 *    pt we get back equals the clientX/Y directly. That's good enough for
 *    assertions that only need DIRECTION (not exact values).
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import HiprintCanvas from '../HiprintCanvas.vue'
import { useCanvasStore } from '@hiprint-v3/stores'

beforeEach(() => {
  setActivePinia(createPinia())
  // Silence console.warn so test output stays clean.
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  // happy-dom retains the body; clean to avoid cross-test stickiness.
  document.body.innerHTML = ''
})

/**
 * Mount the canvas with a single active panel ready for ruler interaction.
 *
 * happy-dom returns a zero-sized DOMRect by default which trips the
 * "pointerup outside canvas → delete" guard. We patch getBoundingClientRect
 * to return a realistic 1000×800 viewport so tests can exercise both
 * delete-into-ruler-band AND keep-outside-band code paths.
 */
async function mountWithPanel() {
  const canvas = useCanvasStore()
  canvas.addPanel({ id: 'p1', width: 210, height: 297 })
  const wrapper = mount(HiprintCanvas, { attachTo: document.body })
  await nextTick()
  // Patch the canvas root rect so non-zero bounds let the keep-vs-delete
  // pointerup logic exercise both branches.
  const canvasRoot = wrapper.element as HTMLElement
  canvasRoot.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 800,
      right: 1000,
      width: 1000,
      height: 800,
      toJSON: () => '',
    }) as DOMRect
  return { wrapper, canvas }
}

function makePointerEvent(
  type: string,
  init: PointerEventInit & { clientX?: number; clientY?: number } = {}
): PointerEvent {
  // happy-dom supports PointerEvent constructor; fall back to MouseEvent.
  try {
    return new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      button: 0,
      ...init,
    })
  } catch {
    return new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      button: 0,
      ...init,
    }) as unknown as PointerEvent
  }
}

describe('HiprintCanvas — TKT-102 ruler creates guide on pointerdown', () => {
  it('pointerdown on top ruler → addGuideLine called with axis=h', async () => {
    const { wrapper, canvas } = await mountWithPanel()
    const spy = vi.spyOn(canvas, 'addGuideLine')

    const ruler = wrapper.element.querySelector(
      '.hiprint-canvas__ruler--top'
    ) as SVGElement | null
    expect(ruler).not.toBeNull()

    ruler!.dispatchEvent(makePointerEvent('pointerdown', { clientX: 50, clientY: 5 }))

    expect(spy).toHaveBeenCalledWith('h', expect.any(Number))
    expect(canvas.guideLines.length).toBe(1)
    expect(canvas.guideLines[0]!.axis).toBe('h')
    wrapper.unmount()
  })

  it('pointerdown on left ruler → addGuideLine called with axis=v', async () => {
    const { wrapper, canvas } = await mountWithPanel()
    const spy = vi.spyOn(canvas, 'addGuideLine')

    const ruler = wrapper.element.querySelector(
      '.hiprint-canvas__ruler--left'
    ) as SVGElement | null
    expect(ruler).not.toBeNull()

    ruler!.dispatchEvent(makePointerEvent('pointerdown', { clientX: 5, clientY: 50 }))

    expect(spy).toHaveBeenCalledWith('v', expect.any(Number))
    expect(canvas.guideLines.length).toBe(1)
    expect(canvas.guideLines[0]!.axis).toBe('v')
    wrapper.unmount()
  })

  it('readonly mode suppresses ruler creation', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 210, height: 297 })
    const wrapper = mount(HiprintCanvas, {
      attachTo: document.body,
      props: { readonly: true },
    })
    await nextTick()
    // Rulers don't render in readonly mode — verify + verify no guides created.
    expect(wrapper.element.querySelector('.hiprint-canvas__ruler--top')).toBeNull()
    expect(canvas.guideLines.length).toBe(0)
    wrapper.unmount()
  })

  it('right-button pointerdown does NOT create a guide', async () => {
    const { wrapper, canvas } = await mountWithPanel()
    const ruler = wrapper.element.querySelector(
      '.hiprint-canvas__ruler--top'
    ) as SVGElement
    ruler.dispatchEvent(
      makePointerEvent('pointerdown', { clientX: 50, clientY: 5, button: 2 })
    )
    expect(canvas.guideLines.length).toBe(0)
    wrapper.unmount()
  })
})

describe('HiprintCanvas — TKT-102 pointermove updates guide position', () => {
  it('window pointermove during ruler-drag → updateGuideLine called', async () => {
    const { wrapper, canvas } = await mountWithPanel()
    const updateSpy = vi.spyOn(canvas, 'updateGuideLine')

    const ruler = wrapper.element.querySelector(
      '.hiprint-canvas__ruler--top'
    ) as SVGElement
    ruler.dispatchEvent(
      makePointerEvent('pointerdown', { clientX: 50, clientY: 5 })
    )
    // Now fire a window-level pointermove.
    window.dispatchEvent(makePointerEvent('pointermove', { clientX: 50, clientY: 100 }))
    expect(updateSpy).toHaveBeenCalled()
    expect(updateSpy.mock.calls[0]![0]).toBe(canvas.guideLines[0]!.id)
    // Pointerup to clean up window listeners.
    window.dispatchEvent(makePointerEvent('pointerup', { clientX: 50, clientY: 100 }))
    wrapper.unmount()
  })
})

describe('HiprintCanvas — TKT-102 pointerup commits guide creation', () => {
  it('pointerup outside ruler band keeps the guide', async () => {
    const { wrapper, canvas } = await mountWithPanel()
    const ruler = wrapper.element.querySelector(
      '.hiprint-canvas__ruler--top'
    ) as SVGElement
    ruler.dispatchEvent(
      makePointerEvent('pointerdown', { clientX: 50, clientY: 5 })
    )
    // Pointerup at y=200 — well past the 20px ruler band → keep.
    window.dispatchEvent(makePointerEvent('pointerup', { clientX: 50, clientY: 200 }))
    expect(canvas.guideLines.length).toBe(1)
    wrapper.unmount()
  })
})

describe('HiprintCanvas — TKT-102 existing guide drag', () => {
  it('pointerdown on guide-line node → drag updates its pos', async () => {
    const { wrapper, canvas } = await mountWithPanel()
    // Pre-create a guide via the store so we can grab the rendered node.
    const g = canvas.addGuideLine('h', 50)
    await nextTick()

    const node = wrapper.element.querySelector(
      `[data-guide-id="${g.id}"]`
    ) as HTMLElement | null
    expect(node).not.toBeNull()

    const updateSpy = vi.spyOn(canvas, 'updateGuideLine')
    node!.dispatchEvent(makePointerEvent('pointerdown', { clientX: 50, clientY: 60 }))
    // Drag down.
    window.dispatchEvent(makePointerEvent('pointermove', { clientX: 50, clientY: 120 }))
    expect(updateSpy).toHaveBeenCalled()
    expect(updateSpy.mock.calls[0]![0]).toBe(g.id)
    // Pointerup outside ruler band → keep guide.
    window.dispatchEvent(makePointerEvent('pointerup', { clientX: 50, clientY: 120 }))
    expect(canvas.guideLines.length).toBe(1)
    wrapper.unmount()
  })

  it('drag guide back to ruler band → removeGuideLine called', async () => {
    const { wrapper, canvas } = await mountWithPanel()
    const g = canvas.addGuideLine('h', 50)
    await nextTick()

    const node = wrapper.element.querySelector(
      `[data-guide-id="${g.id}"]`
    ) as HTMLElement
    const removeSpy = vi.spyOn(canvas, 'removeGuideLine')
    node.dispatchEvent(makePointerEvent('pointerdown', { clientX: 50, clientY: 60 }))
    // Pointerup INSIDE top-ruler band (y within 20px of wrapper top, which is 0
    // in happy-dom since getBoundingClientRect returns 0/0).
    window.dispatchEvent(makePointerEvent('pointerup', { clientX: 50, clientY: 5 }))
    expect(removeSpy).toHaveBeenCalledWith(g.id)
    wrapper.unmount()
  })
})

describe('HiprintCanvas — TKT-102 guide-line rendering', () => {
  it('renders one .hiprint-guide-line per store entry', async () => {
    const { wrapper, canvas } = await mountWithPanel()
    canvas.addGuideLine('h', 10)
    canvas.addGuideLine('v', 50)
    await nextTick()
    const lines = wrapper.element.querySelectorAll('.hiprint-guide-line')
    expect(lines.length).toBe(2)
    wrapper.unmount()
  })

  it('horizontal guides get --h class', async () => {
    const { wrapper, canvas } = await mountWithPanel()
    canvas.addGuideLine('h', 50)
    await nextTick()
    expect(
      wrapper.element.querySelector('.hiprint-guide-line--h')
    ).not.toBeNull()
    wrapper.unmount()
  })

  it('vertical guides get --v class', async () => {
    const { wrapper, canvas } = await mountWithPanel()
    canvas.addGuideLine('v', 50)
    await nextTick()
    expect(
      wrapper.element.querySelector('.hiprint-guide-line--v')
    ).not.toBeNull()
    wrapper.unmount()
  })

  it('removing a guide from the store removes the DOM node', async () => {
    const { wrapper, canvas } = await mountWithPanel()
    const g = canvas.addGuideLine('h', 50)
    await nextTick()
    expect(
      wrapper.element.querySelector('.hiprint-guide-line')
    ).not.toBeNull()
    canvas.removeGuideLine(g.id)
    await nextTick()
    expect(
      wrapper.element.querySelector('.hiprint-guide-line')
    ).toBeNull()
    wrapper.unmount()
  })
})
