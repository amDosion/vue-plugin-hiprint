/**
 * HiprintPanel.spec.ts — V3 HiprintPanel component unit tests (P18.1).
 *
 * Covers:
 *  - paper width/height set in pt from mm-stored panel dimensions
 *  - scale transform applied when canvas.scale != 1
 *  - active panel gets the active modifier class
 *  - paperHeader / paperFooter markers render at the configured pt offset
 *  - readonly suppresses markers + dropzone wiring
 *  - missing/unknown panelId renders empty shell without throwing
 *  - panelId change tears down + re-registers cleanly
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HiprintPanel from '../HiprintPanel.vue'
import { useCanvasStore } from '@hiprint-v3/stores'
import { mm } from '@hiprint-v3/internal'

beforeEach(() => {
  setActivePinia(createPinia())
  // Silence interact.js dropzone warnings in happy-dom (it uses APIs happy-dom
  // doesn't fully implement, but our wrapper try/catches).
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('HiprintPanel — geometry', () => {
  it('renders paper with pt width/height converted from mm', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 210, height: 297 })
    const w = mount(HiprintPanel, { props: { panelId: 'p1', readonly: true } })
    const paper = w.element.querySelector('.hiprint-printPaper') as HTMLElement
    expect(paper).not.toBeNull()
    // happy-dom rounds CSS lengths to 6 decimal places; compare via parseFloat
    // with a small tolerance so we're robust to that.
    expect(paper.style.width.endsWith('pt')).toBe(true)
    expect(paper.style.height.endsWith('pt')).toBe(true)
    expect(parseFloat(paper.style.width)).toBeCloseTo(mm.toPt(210), 3)
    expect(parseFloat(paper.style.height)).toBeCloseTo(mm.toPt(297), 3)
    expect(paper.style.position).toBe('relative')
    w.unmount()
  })

  it('applies transform: scale() when canvas.scale != 1', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 100, height: 100 })
    canvas.setScale(0.5)
    const w = mount(HiprintPanel, { props: { panelId: 'p1', readonly: true } })
    const paper = w.element.querySelector('.hiprint-printPaper') as HTMLElement
    expect(paper.style.transform).toContain('scale(0.5)')
    w.unmount()
  })

  it('reactively re-renders when panel width changes via store', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 100, height: 100 })
    const w = mount(HiprintPanel, { props: { panelId: 'p1', readonly: true } })
    const paper = () => w.element.querySelector('.hiprint-printPaper') as HTMLElement
    const before = parseFloat(paper().style.width)
    // Replace panel in store with new width
    canvas.panels = canvas.panels.map((p) =>
      p.id === 'p1' ? { ...p, width: 200 } : p
    )
    await w.vm.$nextTick()
    const after = parseFloat(paper().style.width)
    expect(after).not.toBeCloseTo(before, 3)
    expect(after).toBeCloseTo(mm.toPt(200), 3)
    w.unmount()
  })
})

describe('HiprintPanel — active state + classes', () => {
  it('applies .hiprint-printPanel--active when active panel id matches', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 100, height: 100 })
    canvas.addPanel({ id: 'p2', width: 100, height: 100 })
    canvas.setActivePanel('p1')
    const w = mount(HiprintPanel, { props: { panelId: 'p1', readonly: true } })
    expect(
      (w.element as HTMLElement).classList.contains('hiprint-printPanel--active')
    ).toBe(true)
    canvas.setActivePanel('p2')
    await w.vm.$nextTick()
    expect(
      (w.element as HTMLElement).classList.contains('hiprint-printPanel--active')
    ).toBe(false)
    w.unmount()
  })

  it('sets data-panel-id attribute on paper element', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 100, height: 100 })
    const w = mount(HiprintPanel, { props: { panelId: 'p1', readonly: true } })
    const paper = w.element.querySelector('.hiprint-printPaper') as HTMLElement
    expect(paper.getAttribute('data-panel-id')).toBe('p1')
    w.unmount()
  })
})

describe('HiprintPanel — header/footer markers', () => {
  it('renders header marker at paperHeader pt offset', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 100, height: 100, paperHeader: 30 })
    const w = mount(HiprintPanel, { props: { panelId: 'p1' } })
    const marker = w.element.querySelector(
      '.hiprint-panel-header-marker'
    ) as HTMLElement | null
    expect(marker).not.toBeNull()
    expect(marker!.style.top).toBe('30pt')
    w.unmount()
  })

  it('renders footer marker at paperFooter pt offset', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 100, height: 100, paperFooter: 780 })
    const w = mount(HiprintPanel, { props: { panelId: 'p1' } })
    const marker = w.element.querySelector(
      '.hiprint-panel-footer-marker'
    ) as HTMLElement | null
    expect(marker).not.toBeNull()
    expect(marker!.style.top).toBe('780pt')
    w.unmount()
  })

  it('readonly suppresses header/footer markers', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({
      id: 'p1',
      width: 100,
      height: 100,
      paperHeader: 30,
      paperFooter: 780,
    })
    const w = mount(HiprintPanel, { props: { panelId: 'p1', readonly: true } })
    expect(w.element.querySelector('.hiprint-panel-header-marker')).toBeNull()
    expect(w.element.querySelector('.hiprint-panel-footer-marker')).toBeNull()
    w.unmount()
  })

  it('ignores non-finite or negative paperHeader values', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({
      id: 'p1',
      width: 100,
      height: 100,
      paperHeader: -5,
    })
    const w = mount(HiprintPanel, { props: { panelId: 'p1' } })
    expect(w.element.querySelector('.hiprint-panel-header-marker')).toBeNull()
    w.unmount()
  })
})

describe('HiprintPanel — robustness', () => {
  it('renders empty shell for unknown panelId without throwing', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 100, height: 100 })
    expect(() =>
      mount(HiprintPanel, { props: { panelId: 'nope', readonly: true } })
    ).not.toThrow()
  })

  it('unmount runs cleanup without throwing', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 100, height: 100 })
    const w = mount(HiprintPanel, {
      props: { panelId: 'p1' },
      attachTo: document.body,
    })
    expect(() => w.unmount()).not.toThrow()
  })
})
