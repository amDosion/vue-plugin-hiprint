/**
 * LongTextElement.spec.ts — V3 longText etype unit tests (P17.1).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import LongTextElement from '../LongTextElement.vue'
import { useCanvasStore } from '@hiprint-v3/stores'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('LongTextElement', () => {
  it('renders title + value joined by separator', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.longText',
      printElementType: { type: 'longText' },
      options: { title: 'Memo', field: 'memo' },
    })
    const w = mount(LongTextElement, {
      props: {
        elementId: 'e1',
        panelId: 'p1',
        data: { memo: 'a long body of text' },
        interactive: false,
      },
    })
    expect(w.text()).toContain('Memo：a long body of text')
    w.unmount()
  })

  it('emits indent span when longTextIndent > 0', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.longText',
      printElementType: { type: 'longText' },
      options: { hideTitle: true, longTextIndent: 24, field: 'body' },
    })
    const w = mount(LongTextElement, {
      props: {
        elementId: 'e1',
        panelId: 'p1',
        data: { body: 'paragraph...' },
        interactive: false,
      },
    })
    const indent = w.find('.long-text-indent')
    expect(indent.exists()).toBe(true)
    const indentEl = indent.element as HTMLElement
    expect(indentEl.style.marginLeft).toBe('24pt')
    w.unmount()
  })

  it('clamps negative longTextIndent to 0 (no span)', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.longText',
      printElementType: { type: 'longText' },
      options: { hideTitle: true, longTextIndent: -10, field: 'body' },
    })
    const w = mount(LongTextElement, {
      props: {
        elementId: 'e1',
        panelId: 'p1',
        data: { body: 'x' },
        interactive: false,
      },
    })
    expect(w.find('.long-text-indent').exists()).toBe(false)
    w.unmount()
  })

  it('renders formatter output via v-html', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.longText',
      printElementType: { type: 'longText' },
      options: {
        hideTitle: true,
        field: 'body',
        formatter: () => '<em class="fmt">bold</em>',
      },
    })
    const w = mount(LongTextElement, {
      props: {
        elementId: 'e1',
        panelId: 'p1',
        data: { body: 'ignored' },
        interactive: false,
      },
    })
    expect(w.find('em.fmt').exists()).toBe(true)
    w.unmount()
  })
})
