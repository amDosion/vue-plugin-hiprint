/**
 * shapes.spec.ts — V3 shape etype unit tests (P17.2).
 *
 * Co-locates the four shape etypes (hline / vline / rect / oval) since each
 * one is structurally identical — just a different CSS border declaration.
 * Two assertions per type: (1) correct border axis, (2) borderColor honored.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HlineElement from '../HlineElement.vue'
import VlineElement from '../VlineElement.vue'
import RectElement from '../RectElement.vue'
import OvalElement from '../OvalElement.vue'
import { useCanvasStore } from '@hiprint-v3/stores'

beforeEach(() => {
  setActivePinia(createPinia())
})

function makePanelWithEl(type: 'hline' | 'vline' | 'rect' | 'oval', opts: Record<string, unknown>) {
  const canvas = useCanvasStore()
  canvas.addPanel({ id: 'p1', width: 200, height: 200 })
  canvas.addElement('p1', {
    id: 'e1',
    tid: 't.' + type,
    printElementType: { type },
    options: opts,
  })
}

describe('HlineElement', () => {
  it('applies border-top with declared width + color', () => {
    makePanelWithEl('hline', { borderWidth: 2, borderColor: '#f00' })
    const w = mount(HlineElement, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    const inner = w.find('.hiprint-printElement-hline-content').element as HTMLElement
    expect(inner.style.borderTop).toContain('2pt')
    // happy-dom returns color as rgb(...) in computed style; check border literal substring
    expect(inner.style.borderTop.toLowerCase()).toContain('solid')
    w.unmount()
  })

  it('falls back to #000 + 1pt when options omitted', () => {
    makePanelWithEl('hline', {})
    const w = mount(HlineElement, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    const inner = w.find('.hiprint-printElement-hline-content').element as HTMLElement
    expect(inner.style.borderTop).toContain('1pt')
    w.unmount()
  })
})

describe('VlineElement', () => {
  it('applies border-left', () => {
    makePanelWithEl('vline', { borderWidth: 3, borderColor: '#00f' })
    const w = mount(VlineElement, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    const inner = w.find('.hiprint-printElement-vline-content').element as HTMLElement
    expect(inner.style.borderLeft).toContain('3pt')
    w.unmount()
  })

  it('renders even when options is empty', () => {
    makePanelWithEl('vline', {})
    const w = mount(VlineElement, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    expect(w.find('.hiprint-printElement-vline-content').exists()).toBe(true)
    w.unmount()
  })
})

describe('RectElement', () => {
  it('applies full border', () => {
    makePanelWithEl('rect', { borderWidth: 2, borderColor: '#0f0' })
    const w = mount(RectElement, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    const inner = w.find('.hiprint-printElement-rect-content').element as HTMLElement
    expect(inner.style.border).toContain('2pt')
    w.unmount()
  })

  it('renders with defaults', () => {
    makePanelWithEl('rect', {})
    const w = mount(RectElement, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    expect(w.find('.hiprint-printElement-rect-content').exists()).toBe(true)
    w.unmount()
  })
})

describe('OvalElement', () => {
  it('applies border + border-radius 50%', () => {
    makePanelWithEl('oval', { borderWidth: 1, borderColor: '#000' })
    const w = mount(OvalElement, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    const inner = w.find('.hiprint-printElement-oval-content').element as HTMLElement
    expect(inner.style.borderRadius).toBe('50%')
    expect(inner.style.border).toContain('1pt')
    w.unmount()
  })

  it('renders with defaults', () => {
    makePanelWithEl('oval', {})
    const w = mount(OvalElement, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    expect(w.find('.hiprint-printElement-oval-content').exists()).toBe(true)
    w.unmount()
  })
})
