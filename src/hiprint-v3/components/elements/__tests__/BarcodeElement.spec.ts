/**
 * BarcodeElement.spec.ts — V3 barcode etype unit tests (P17.1).
 *
 * We stub bwip-js toSVG to avoid running the real encoder under happy-dom.
 * The component contract under test is:
 *   1. It calls bwipjs.toSVG with the right bcid + text.
 *   2. It mounts the returned SVG into the container.
 *   3. It re-renders when the resolved text changes.
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
import BarcodeElement from '../BarcodeElement.vue'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(bwipjs.toSVG).mockClear()
})

describe('BarcodeElement', () => {
  it('calls bwipjs.toSVG with bcid=code128 by default and mounts SVG', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.barcode',
      printElementType: { type: 'barcode' },
      options: { field: 'sku', width: 100, height: 30, hideTitle: true },
    })
    const w = mount(BarcodeElement, {
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
    const firstCall = vi.mocked(bwipjs.toSVG).mock.calls[0]?.[0] as {
      bcid: string
      text: string
    }
    expect(firstCall.bcid).toBe('code128')
    expect(firstCall.text).toBe('ABC123')
    expect(w.find('svg').exists()).toBe(true)
    expect(w.find('svg').attributes('data-text')).toBe('ABC123')
    w.unmount()
  })

  // TKT-371 (Sprint 22g GL Wave 3) — V1 Path A barcodeMode fallback. When
  // a legacy V1 JSON lacks options.barcodeType but carries barcodeMode,
  // BarcodeElement must read through mapBarcodeMode and emit the correct
  // bwip-js bcid.
  it('TKT-371: Path A barcodeMode=EAN13 falls back through mapBarcodeMode → ean13', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.barcode',
      printElementType: { type: 'barcode' },
      // No barcodeType; legacy Path A barcodeMode only.
      options: { barcodeMode: 'EAN13', testData: '1234567890128', hideTitle: true },
    })
    const w = mount(BarcodeElement, {
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

  it('TKT-371: Path A barcodeMode=ITF14 maps to itf14 (not interleaved2of5)', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.barcode',
      printElementType: { type: 'barcode' },
      options: { barcodeMode: 'ITF14', testData: '1234567890123', hideTitle: true },
    })
    const w = mount(BarcodeElement, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
      attachTo: document.body,
    })
    await nextTick()
    const callOpts = vi.mocked(bwipjs.toSVG).mock.calls[0]?.[0] as {
      bcid: string
    }
    expect(callOpts.bcid).toBe('itf14')
    w.unmount()
  })

  it('uses options.barcodeType when supplied', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.barcode',
      printElementType: { type: 'barcode' },
      options: { barcodeType: 'ean13', testData: '1234567890128', hideTitle: true },
    })
    const w = mount(BarcodeElement, {
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

  // TKT-364 — Sprint 22g GL Wave 3.
  it('TKT-364: forwards backgroundColor / borderColor / textYAlign to bwip-js', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.barcode',
      printElementType: { type: 'barcode' },
      options: {
        testData: 'ABC',
        backgroundColor: '#fffff0',
        borderColor: '#aabbcc',
        borderWidth: 1,
        textYAlign: 'below',
        addOn: '12345',
        textMargin: -1,
        hideTitle: true,
      },
    })
    const w = mount(BarcodeElement, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
      attachTo: document.body,
    })
    await nextTick()
    const callOpts = vi.mocked(bwipjs.toSVG).mock.calls[0]?.[0] as Record<
      string,
      unknown
    >
    expect(callOpts.backgroundcolor).toBe('fffff0')
    expect(callOpts.bordercolor).toBe('aabbcc')
    expect(callOpts.borderwidth).toBe(1)
    expect(callOpts.textyalign).toBe('below')
    expect(callOpts.addon).toBe('12345')
    expect(callOpts.textmargin).toBe(-1)
    // Core fixed opts must NOT be overridden by passthrough.
    expect(callOpts.bcid).toBe('code128')
    expect(callOpts.text).toBe('ABC')
    expect(callOpts.barcolor).toBe('#000')
    w.unmount()
  })

  it('renders fallback text when bwipjs throws', async () => {
    vi.mocked(bwipjs.toSVG).mockImplementationOnce(() => {
      throw new Error('boom')
    })
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.barcode',
      printElementType: { type: 'barcode' },
      options: { testData: 'X' },
    })
    const w = mount(BarcodeElement, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
      attachTo: document.body,
    })
    await nextTick()
    expect(w.text()).toContain('Barcode render failed')
    w.unmount()
  })
})
