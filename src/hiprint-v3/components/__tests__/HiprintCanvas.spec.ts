/**
 * HiprintCanvas.spec.ts — V3 HiprintCanvas component unit tests (P18.1).
 *
 * Covers:
 *  - renders active panel with HiprintPanel
 *  - dispatches elements to correct etype Vue SFC by printElementType.type
 *  - renders both text + image in the same canvas (mixed types)
 *  - readonly mode suppresses interactions (no throw on keyboard events)
 *  - unknown printElementType falls back to TextElement (defensive)
 *  - empty slot shown when no active panel
 *  - data prop is forwarded to child etype components for field resolution
 *  - active panel change re-renders elements
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HiprintCanvas from '../HiprintCanvas.vue'
import { useCanvasStore } from '@hiprint-v3/stores'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('HiprintCanvas — active panel rendering', () => {
  it('renders HiprintPanel for active panel', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 100, height: 100 })
    const w = mount(HiprintCanvas, { props: { readonly: true } })
    const paper = w.element.querySelector('.hiprint-printPaper')
    expect(paper).not.toBeNull()
    expect(paper!.getAttribute('data-panel-id')).toBe('p1')
    w.unmount()
  })

  it('shows empty slot fallback when no active panel', () => {
    const w = mount(HiprintCanvas, {
      props: { readonly: true },
      slots: { empty: '<span class="my-empty">nothing</span>' },
    })
    const empty = w.element.querySelector('.my-empty')
    expect(empty).not.toBeNull()
    w.unmount()
  })

  it('shows default empty placeholder when no slot and no panel', () => {
    const w = mount(HiprintCanvas, { props: { readonly: true } })
    expect(w.element.querySelector('.hiprint-canvas__empty')).not.toBeNull()
    w.unmount()
  })
})

describe('HiprintCanvas — etype dispatch', () => {
  it('renders text element with hiprint-printElement-text class', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 100, height: 100 })
    canvas.addElement('p1', {
      id: 'e-text',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { left: 0, top: 0, width: 50, height: 12, title: 'Hi' },
    })
    const w = mount(HiprintCanvas, { props: { readonly: true } })
    const el = w.element.querySelector(
      '[data-element-id="e-text"]'
    ) as HTMLElement | null
    expect(el).not.toBeNull()
    expect(el!.classList.contains('hiprint-printElement-text')).toBe(true)
    w.unmount()
  })

  it('renders text + image elements together (mixed dispatch)', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 100, height: 100 })
    canvas.addElement('p1', {
      id: 'e-text',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { left: 0, top: 0, title: 'A' },
    })
    canvas.addElement('p1', {
      id: 'e-img',
      tid: 't.image',
      printElementType: { type: 'image' },
      options: { left: 10, top: 10, src: 'data:image/png;base64,' },
    })
    const w = mount(HiprintCanvas, { props: { readonly: true } })
    const textEl = w.element.querySelector('[data-element-id="e-text"]')
    const imgEl = w.element.querySelector('[data-element-id="e-img"]')
    expect(textEl).not.toBeNull()
    expect(imgEl).not.toBeNull()
    expect(textEl!.classList.contains('hiprint-printElement-text')).toBe(true)
    expect(imgEl!.classList.contains('hiprint-printElement-image')).toBe(true)
    w.unmount()
  })

  it('falls back to text component for unknown type (no crash)', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 100, height: 100 })
    canvas.addElement('p1', {
      id: 'e-x',
      tid: 'unknown.tid',
      printElementType: { type: 'somethingMadeUp' as unknown as string },
      options: { left: 0, top: 0 },
    })
    expect(() =>
      mount(HiprintCanvas, { props: { readonly: true } })
    ).not.toThrow()
  })
})

describe('HiprintCanvas — readonly mode', () => {
  it('readonly canvas does not throw on mount/unmount', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 100, height: 100 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { left: 0, top: 0 },
    })
    const w = mount(HiprintCanvas, {
      props: { readonly: true },
      attachTo: document.body,
    })
    // Dispatch a keydown — readonly should NOT have keyboard handlers, but
    // event must not throw regardless.
    expect(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))
    }).not.toThrow()
    expect(() => w.unmount()).not.toThrow()
  })

  it('applies hiprint-canvas--readonly modifier class when readonly', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 100, height: 100 })
    const w = mount(HiprintCanvas, { props: { readonly: true } })
    expect(
      (w.element as HTMLElement).classList.contains('hiprint-canvas--readonly')
    ).toBe(true)
    w.unmount()
  })
})

describe('HiprintCanvas — ruler (CV-004)', () => {
  it('ruler SVG renders mm text labels', () => {
    const canvas = useCanvasStore()
    // A4 portrait: width ≈ 595.28pt = 210mm → expect ~21 major ticks at
    // 10mm spacing (10/20/.../210). text count for labels (excludes mm=0)
    // should be at least 4.
    canvas.addPanel({ id: 'p1', width: 595.28, height: 841.89 })
    canvas.rulerVisible = true
    const w = mount(HiprintCanvas, {
      props: { readonly: false },
      attachTo: document.body,
    })
    const topSvg = w.element.querySelector(
      'svg.hiprint-canvas__ruler--top'
    ) as SVGElement | null
    expect(topSvg).not.toBeNull()
    const texts = topSvg!.querySelectorAll('text')
    expect(texts.length).toBeGreaterThanOrEqual(4)
    w.unmount()
  })

  it('ruler SVG renders left axis labels', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 595.28, height: 841.89 })
    canvas.rulerVisible = true
    const w = mount(HiprintCanvas, {
      props: { readonly: false },
      attachTo: document.body,
    })
    const leftSvg = w.element.querySelector(
      'svg.hiprint-canvas__ruler--left'
    ) as SVGElement | null
    expect(leftSvg).not.toBeNull()
    const texts = leftSvg!.querySelectorAll('text')
    // A4 height 297mm → 29 major ticks excluding 0 → at least 4.
    expect(texts.length).toBeGreaterThanOrEqual(4)
    w.unmount()
  })

  it('ruler hidden when rulerVisible=false', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 100, height: 100 })
    canvas.rulerVisible = false
    const w = mount(HiprintCanvas, {
      props: { readonly: false },
      attachTo: document.body,
    })
    expect(w.element.querySelector('svg.hiprint-canvas__ruler--top')).toBeNull()
    expect(w.element.querySelector('svg.hiprint-canvas__ruler--left')).toBeNull()
    w.unmount()
  })
})

describe('HiprintCanvas — reactivity', () => {
  it('re-renders when active panel changes', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 100, height: 100 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { left: 0, top: 0, title: 'On P1' },
    })
    canvas.addPanel({ id: 'p2', width: 100, height: 100 })
    canvas.addElement('p2', {
      id: 'e2',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { left: 0, top: 0, title: 'On P2' },
    })
    canvas.setActivePanel('p1')

    const w = mount(HiprintCanvas, { props: { readonly: true } })
    expect(w.element.querySelector('[data-element-id="e1"]')).not.toBeNull()
    expect(w.element.querySelector('[data-element-id="e2"]')).toBeNull()

    canvas.setActivePanel('p2')
    await w.vm.$nextTick()
    expect(w.element.querySelector('[data-element-id="e1"]')).toBeNull()
    expect(w.element.querySelector('[data-element-id="e2"]')).not.toBeNull()
    w.unmount()
  })

  it('forwards data prop to text elements for field resolution', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 100, height: 100 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text', field: 'name' },
      options: { left: 0, top: 0, title: 'Name', field: 'name' },
    })
    const w = mount(HiprintCanvas, {
      props: { readonly: true, data: { name: 'Alice' } },
    })
    const text = w.element.querySelector(
      '[data-element-id="e1"]'
    ) as HTMLElement
    expect(text.textContent).toContain('Alice')
    w.unmount()
  })
})

/**
 * TKT-154 — transient ruler-handle cursor markers.
 *
 * Distinct from TKT-102 user-drawn guides (persistent dashed lines stored in
 * `canvas.guideLines`). These are ephemeral triangular indicators that track
 * the cursor while it hovers over the paper area.
 *
 * Notes on test fidelity:
 *  - happy-dom doesn't compute getBoundingClientRect() for unattached
 *    elements, so we mount with `attachTo: document.body` and stub the
 *    paper rect via `Object.defineProperty` so `clientToPaperPt` returns
 *    finite coords. The marker visibility only depends on a finite
 *    cursorPos and an active paper element.
 */
describe('HiprintCanvas — TKT-154 ruler-handle cursor markers', () => {
  function paperRect(
    canvasEl: Element,
    rect: Partial<DOMRect>
  ): void {
    const paper = canvasEl.querySelector('.hiprint-printPaper') as HTMLElement
    if (!paper) return
    const r: DOMRect = {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 100,
      right: 100,
      width: 100,
      height: 100,
      toJSON: () => ({}),
      ...rect,
    } as DOMRect
    paper.getBoundingClientRect = () => r
  }

  it('renders no ruler-handle marker when cursor has not moved', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 595.28, height: 841.89 })
    canvas.rulerVisible = true
    const w = mount(HiprintCanvas, {
      props: { readonly: false },
      attachTo: document.body,
    })
    expect(w.element.querySelector('.hiprint-ruler-handle')).toBeNull()
    w.unmount()
  })

  it('renders both horizontal + vertical ruler-handle markers on pointermove', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 595.28, height: 841.89 })
    canvas.rulerVisible = true
    const w = mount(HiprintCanvas, {
      props: { readonly: false },
      attachTo: document.body,
    })
    paperRect(w.element, { left: 50, top: 50, right: 650, bottom: 900 })
    // Pointermove on the canvas root → onPaperPointerMove updates cursorPos.
    w.element.dispatchEvent(
      new PointerEvent('pointermove', { bubbles: true, clientX: 100, clientY: 120 })
    )
    await w.vm.$nextTick()
    const hHandle = w.element.querySelector('.hiprint-ruler-handle-h')
    const vHandle = w.element.querySelector('.hiprint-ruler-handle-v')
    expect(hHandle).not.toBeNull()
    expect(vHandle).not.toBeNull()
    w.unmount()
  })

  it('pointerleave clears the markers', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 595.28, height: 841.89 })
    canvas.rulerVisible = true
    const w = mount(HiprintCanvas, {
      props: { readonly: false },
      attachTo: document.body,
    })
    paperRect(w.element, { left: 50, top: 50, right: 650, bottom: 900 })
    w.element.dispatchEvent(
      new PointerEvent('pointermove', { bubbles: true, clientX: 100, clientY: 120 })
    )
    await w.vm.$nextTick()
    expect(w.element.querySelector('.hiprint-ruler-handle')).not.toBeNull()
    w.element.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.element.querySelector('.hiprint-ruler-handle')).toBeNull()
    w.unmount()
  })

  it('readonly mode never renders ruler-handle markers', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 595.28, height: 841.89 })
    canvas.rulerVisible = true
    const w = mount(HiprintCanvas, {
      props: { readonly: true },
      attachTo: document.body,
    })
    paperRect(w.element, { left: 50, top: 50, right: 650, bottom: 900 })
    w.element.dispatchEvent(
      new PointerEvent('pointermove', { bubbles: true, clientX: 100, clientY: 120 })
    )
    await w.vm.$nextTick()
    expect(w.element.querySelector('.hiprint-ruler-handle')).toBeNull()
    w.unmount()
  })
})
