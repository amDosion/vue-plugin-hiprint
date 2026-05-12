/**
 * html-xss-field-binding.spec.ts — TKT-007 lock.
 *
 * Sprint 22a introduced a NEW V3 rendering path that V1 never had:
 * `data[options.field]` flowing into v-html. That is a runtime XSS surface for
 * user-controlled template data.
 *
 * Default-safe contract (TKT-007):
 *  - Field-bound string → v-text (escaped). NO live nodes from markup.
 *  - opt-in via `options.escape === false` → v-html (V1 by-design behavior).
 *  - `options.content` (V1-documented path) STILL renders as v-html — TKT-007
 *    does not change the by-design path.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HtmlElement from '../../../components/elements/HtmlElement.vue'
import { useCanvasStore } from '@hiprint-v3/stores'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('HtmlElement — field-bound v-html XSS path (TKT-007)', () => {
  it('default-safe: field-bound markup string renders as text, NOT live nodes', () => {
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
        data: { snippet: '<img src=x onerror="window.__xss_fired__=true">' },
        interactive: false,
      },
    })
    // No live <img> node — escaped.
    expect(w.find('img').exists()).toBe(false)
    // The raw source must be visible as text.
    expect(w.text()).toContain('<img src=x')
    w.unmount()
  })

  it('opt-in via options.escape=false → field-bound markup renders as live HTML', () => {
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
        data: { snippet: '<b class="opt-in">stamp</b>' },
        interactive: false,
      },
    })
    expect(w.find('b.opt-in').exists()).toBe(true)
    expect(w.find('b.opt-in').text()).toBe('stamp')
    w.unmount()
  })

  it('options.content still uses v-html (V1 by-design path, NOT changed by TKT-007)', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.html',
      printElementType: { type: 'html' },
      options: { content: '<i class="design-time">italic</i>' },
    })
    const w = mount(HtmlElement, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    // Design-time content path is V1 contract — always v-html.
    expect(w.find('i.design-time').exists()).toBe(true)
    w.unmount()
  })
})
