/**
 * TextElement-textType.spec.ts — TKT-023 V1 Path A text+textType dispatch.
 *
 * V1 designer surface allows storing a text element with options.textType =
 * 'barcode' / 'qrcode'. V3 must render the bwip-js SVG (not plain text) when
 * loading such legacy templates.
 *
 * We stub bwip-js toSVG so happy-dom can run without the real encoder.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'

vi.mock('bwip-js/browser', () => ({
  default: {
    toSVG: vi.fn(
      (opts: { bcid: string; text: string }) =>
        `<svg xmlns="http://www.w3.org/2000/svg" data-bcid="${opts.bcid}" data-text="${opts.text}"><rect width="10" height="10"/></svg>`
    ),
  },
}))

import bwipjs from 'bwip-js/browser'
import TextElement from '../TextElement.vue'
import { useCanvasStore } from '@hiprint-v3/stores'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(bwipjs.toSVG).mockClear()
})

describe('TextElement — textType dispatch (TKT-023)', () => {
  it('without textType renders plain text (default path)', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { title: 'Name', field: 'name', hideTitle: true },
    })
    const w = mount(TextElement, {
      props: {
        elementId: 'e1',
        panelId: 'p1',
        data: { name: 'Alice' },
        interactive: false,
      },
    })
    expect(w.text()).toBe('Alice')
    expect(w.find('svg').exists()).toBe(false)
    w.unmount()
  })

  it('textType=barcode renders bwip-js SVG (delegates to BarcodeElement)', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: {
        field: 'sku',
        textType: 'barcode',
        width: 100,
        height: 30,
        hideTitle: true,
      },
    })
    const w = mount(TextElement, {
      props: {
        elementId: 'e1',
        panelId: 'p1',
        data: { sku: 'ABC123' },
        interactive: false,
      },
      attachTo: document.body,
    })
    await nextTick()
    expect(bwipjs.toSVG).toHaveBeenCalled()
    expect(w.find('svg').exists()).toBe(true)
    expect(w.find('svg').attributes('data-text')).toBe('ABC123')
    w.unmount()
  })

  it('textType=barcode + V1 Path A barcodeMode maps to bwip-js bcid', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: {
        textType: 'barcode',
        barcodeMode: 'EAN13', // V1 Path A enum
        testData: '1234567890128',
        hideTitle: true,
      },
    })
    const w = mount(TextElement, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
      attachTo: document.body,
    })
    await nextTick()
    const callOpts = vi.mocked(bwipjs.toSVG).mock.calls[0]?.[0] as {
      bcid: string
    }
    expect(callOpts.bcid).toBe('ean13')
    w.unmount()
  })

  it('textType=qrcode renders bwip-js QR SVG (delegates to QrcodeElement)', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: {
        field: 'url',
        textType: 'qrcode',
        width: 50,
        height: 50,
        hideTitle: true,
      },
    })
    const w = mount(TextElement, {
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
    const callOpts = vi.mocked(bwipjs.toSVG).mock.calls[0]?.[0] as {
      bcid: string
      text: string
    }
    expect(callOpts.bcid).toBe('qrcode')
    expect(callOpts.text).toBe('https://example.com')
    expect(w.find('svg').exists()).toBe(true)
    w.unmount()
  })

  it('textType=qrcode honors V1 Path A qrCodeLevel int → letter mapping', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: {
        textType: 'qrcode',
        qrCodeLevel: 2, // V1 Path A int — 2 → 'H'
        testData: 'X',
        hideTitle: true,
      },
    })
    const w = mount(TextElement, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
      attachTo: document.body,
    })
    await nextTick()
    const callOpts = vi.mocked(bwipjs.toSVG).mock.calls[0]?.[0] as {
      eclevel?: string
    }
    expect(callOpts.eclevel).toBe('H')
    w.unmount()
  })

  it('textType=unknown falls through to plain text (no dispatch)', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: {
        textType: 'whatever',
        testData: 'plain text fallback',
        hideTitle: true,
      },
    })
    const w = mount(TextElement, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    expect(w.text()).toBe('plain text fallback')
    expect(w.find('svg').exists()).toBe(false)
    w.unmount()
  })
})
