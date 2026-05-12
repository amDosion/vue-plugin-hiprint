/**
 * HtmlElement.spec.ts — V3 html etype unit tests (P17.1).
 *
 * Invariant #2 — html element is the one by-design innerHTML render. These
 * tests EXPECT the literal markup to appear in the DOM (not be escaped).
 * Business consumers are responsible for sanitization upstream.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HtmlElement from '../HtmlElement.vue'
import { useCanvasStore } from '@hiprint-v3/stores'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('HtmlElement — by-design innerHTML (Invariant #2)', () => {
  it('renders options.content as live HTML', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.html',
      printElementType: { type: 'html' },
      options: { content: '<b class="bold-tag">stamp</b>' },
    })
    const w = mount(HtmlElement, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    expect(w.find('b.bold-tag').exists()).toBe(true)
    expect(w.find('b.bold-tag').text()).toBe('stamp')
    w.unmount()
  })

  it('renders bound data string as escaped text by default (TKT-007 XSS-safe)', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.html',
      printElementType: { type: 'html' },
      options: { field: 'snippet' },
    })
    const w = mount(HtmlElement, {
      props: {
        elementId: 'e1',
        panelId: 'p1',
        data: { snippet: '<span class="from-data">x</span>' },
        interactive: false,
      },
    })
    // TKT-007: default is v-text — markup must NOT parse into live nodes.
    expect(w.find('span.from-data').exists()).toBe(false)
    // The raw string must appear as text.
    expect(w.text()).toContain('<span class="from-data">x</span>')
    w.unmount()
  })

  it('renders bound data string as live HTML when escape=false opt-in (TKT-007)', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.html',
      printElementType: { type: 'html' },
      options: { field: 'snippet', escape: false },
    })
    const w = mount(HtmlElement, {
      props: {
        elementId: 'e1',
        panelId: 'p1',
        data: { snippet: '<span class="from-data">x</span>' },
        interactive: false,
      },
    })
    expect(w.find('span.from-data').exists()).toBe(true)
    w.unmount()
  })

  it('formatter output takes precedence over content/data', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.html',
      printElementType: { type: 'html' },
      options: {
        content: '<span class="losing">x</span>',
        formatter: () => '<span class="winning">y</span>',
      },
    })
    const w = mount(HtmlElement, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    expect(w.find('span.winning').exists()).toBe(true)
    expect(w.find('span.losing').exists()).toBe(false)
    w.unmount()
  })
})
