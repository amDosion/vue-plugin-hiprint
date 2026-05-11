/**
 * QrcodeElement.spec.ts — V3 qrcode etype unit tests (P17.1).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useCanvasStore } from '@hiprint-v3/stores'

vi.mock('bwip-js/browser', () => ({
  default: {
    toSVG: vi.fn(
      (opts: { bcid: string; text: string }) =>
        `<svg xmlns="http://www.w3.org/2000/svg" data-bcid="${opts.bcid}" data-text="${opts.text}"><rect width="10" height="10"/></svg>`
    ),
  },
}))

import bwipjs from 'bwip-js/browser'
import QrcodeElement from '../QrcodeElement.vue'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(bwipjs.toSVG).mockClear()
})

describe('QrcodeElement', () => {
  it('calls bwipjs with bcid=qrcode and mounts SVG', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.qrcode',
      printElementType: { type: 'qrcode' },
      options: { field: 'url', hideTitle: true, width: 60, height: 60 },
    })
    const w = mount(QrcodeElement, {
      props: {
        elementId: 'e1',
        panelId: 'p1',
        data: { url: 'https://example.com' },
        interactive: false,
      },
      attachTo: document.body,
    })
    await nextTick()
    expect(bwipjs.toSVG).toHaveBeenCalled()
    const firstCall = vi.mocked(bwipjs.toSVG).mock.calls[0]?.[0] as {
      bcid: string
      text: string
    }
    expect(firstCall.bcid).toBe('qrcode')
    expect(firstCall.text).toBe('https://example.com')
    expect(w.find('svg').exists()).toBe(true)
    w.unmount()
  })

  it('renders title below SVG when hideTitle=false', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.qrcode',
      printElementType: { type: 'qrcode' },
      options: {
        testData: 'TITLE-TEXT',
        hideTitle: false,
        width: 60,
        height: 60,
      },
    })
    const w = mount(QrcodeElement, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
      attachTo: document.body,
    })
    await nextTick()
    const title = w.find('.hiprint-printElement-qrcode-content-title')
    expect(title.exists()).toBe(true)
    expect(title.text()).toBe('TITLE-TEXT')
    w.unmount()
  })

  it('hideTitle suppresses the title block', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.qrcode',
      printElementType: { type: 'qrcode' },
      options: { testData: 'TITLE', hideTitle: true },
    })
    const w = mount(QrcodeElement, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
      attachTo: document.body,
    })
    await nextTick()
    expect(w.find('.hiprint-printElement-qrcode-content-title').exists()).toBe(false)
    w.unmount()
  })
})
