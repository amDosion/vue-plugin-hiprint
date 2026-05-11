/**
 * HtmlPropertyPanel.spec.ts — V3 html property panel tests (PP-011).
 *
 * Covers:
 *  - Render bound to element.options.content.
 *  - Content change dispatches canvas.updateElement with patched content.
 *  - History snapshot fires on commit boundary (change).
 *  - XSS warning is visible (designer reminder).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import {
  useCanvasStore,
  useHistoryStore,
  type CanvasElement,
} from '@hiprint-v3/stores'
import HtmlPropertyPanel from '../HtmlPropertyPanel.vue'

beforeEach(() => {
  setActivePinia(createPinia())
})

function seedHtml(extra: Record<string, unknown> = {}): {
  canvas: ReturnType<typeof useCanvasStore>
  history: ReturnType<typeof useHistoryStore>
  getElement: () => CanvasElement | undefined
} {
  const canvas = useCanvasStore()
  const history = useHistoryStore()
  canvas.addPanel({ id: 'p1', width: 400, height: 300 })
  canvas.addElement('p1', {
    id: 'e1',
    tid: 'default.html',
    printElementType: { type: 'html', title: 'Html' },
    options: {
      left: 10,
      top: 20,
      width: 200,
      height: 100,
      content: '<div>hi</div>',
      ...extra,
    },
  })
  canvas.selectMultiple(['e1'])
  const getElement = () =>
    canvas.panels[0]?.printElements.find((e) => e.id === 'e1')
  return { canvas, history, getElement }
}

function getOpts(el: CanvasElement | undefined): Record<string, unknown> {
  return (el?.options as Record<string, unknown>) ?? {}
}

describe('HtmlPropertyPanel', () => {
  it('renders bound to element.options.content', async () => {
    const { getElement } = seedHtml()
    const w = mount(HtmlPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const ta = w.find('textarea.html-content')
    expect((ta.element as HTMLTextAreaElement).value).toBe('<div>hi</div>')
    w.unmount()
  })

  it('content change patches options.content + commits snapshot', async () => {
    const { getElement, history } = seedHtml()
    const w = mount(HtmlPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const ta = w.find('textarea.html-content')
    const before = history.canUndo
    ;(ta.element as HTMLTextAreaElement).value = '<p>new content</p>'
    await ta.trigger('change')
    expect(getOpts(getElement()).content).toBe('<p>new content</p>')
    expect(history.canUndo).not.toBe(before)
    w.unmount()
  })

  it('renders XSS warning to reminders designers about sanitization', async () => {
    const { getElement } = seedHtml()
    const w = mount(HtmlPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    expect(w.text()).toContain('Raw HTML')
    expect(w.text()).toContain('XSS')
    w.unmount()
  })
})
