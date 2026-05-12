/**
 * default-factory-roundtrip.spec.ts — Sprint 22a-r TKT-008 regression.
 *
 * Asserts the three default presets that V3 was emitting as the V1 Path A
 * shape (which V3 has no handler for) now emit Path B (`type:'barcode'`/
 * `'qrcode'`) so the renderer actually produces a barcode/QR code instead
 * of a plain text element.
 *
 * See `docs/V3-PARITY-MATRIX/04-barcode-qrcode.md` VIOLATION-1 for the
 * defect, and `docs/V3-PARITY-JIRA.md` TKT-008 for the fix decision.
 *
 * Coverage:
 *  1. defaultModule.barcode / defaultModule.qrcode / defaultModule.trackingNo
 *     have the Path B `type` field (`'barcode'`/`'qrcode'`).
 *  2. None of them carry the V1 Path A `options.textType` field that V3
 *     cannot render.
 *  3. Mounting BarcodeElement with the preset options produces a non-empty
 *     <svg> (proves the renderer accepted the preset's `barcodeType`).
 *  4. Mounting QrcodeElement with the preset options produces a non-empty
 *     <svg>.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useCanvasStore } from '@hiprint-v3/stores'
import { buildDefaultElementTypeGroups } from '../default-provider'

// Stub bwip-js the same way the element tests do so we can run under
// happy-dom without a real encoder. Returning a non-empty <svg> proves the
// element wrapper mounted the bwip-js output into the DOM.
vi.mock('bwip-js/browser', () => ({
  default: {
    toSVG: vi.fn(
      (opts: { bcid: string; text: string }) =>
        `<svg xmlns="http://www.w3.org/2000/svg" data-bcid="${opts.bcid}" data-text="${opts.text}"><rect width="10" height="10"/></svg>`
    ),
  },
}))

import bwipjs from 'bwip-js/browser'
import BarcodeElement from '../../components/elements/BarcodeElement.vue'
import QrcodeElement from '../../components/elements/QrcodeElement.vue'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(bwipjs.toSVG).mockClear()
})

function presetByTid(tid: string): {
  tid: string
  type: string
  field?: string
  options?: Record<string, unknown>
  [k: string]: unknown
} {
  const groups = buildDefaultElementTypeGroups()
  for (const g of groups) {
    const hit = g.printElementTypes.find((e) => e.tid === tid)
    if (hit) return hit as ReturnType<typeof presetByTid>
  }
  throw new Error('preset not found: ' + tid)
}

describe('default-factory Path B emission (TKT-008)', () => {
  it('defaultModule.barcode emits Path B `type:"barcode"` (not Path A text)', () => {
    const p = presetByTid('defaultModule.barcode')
    expect(p.type).toBe('barcode')
    // V1 Path A field must not appear in V3 output.
    expect(p.options?.textType).toBeUndefined()
    // Default symbology lowercase per bwip-js bcid vocab.
    expect(p.options?.barcodeType).toBe('code128')
  })

  it('defaultModule.qrcode emits Path B `type:"qrcode"`', () => {
    const p = presetByTid('defaultModule.qrcode')
    expect(p.type).toBe('qrcode')
    expect(p.options?.textType).toBeUndefined()
    // Default error-correction level (V3 renderer indexes ['M','L','H','Q']).
    expect(p.options?.qrCodeLevel).toBe(0)
  })

  it('defaultModule.trackingNo emits Path B `type:"barcode"`', () => {
    const p = presetByTid('defaultModule.trackingNo')
    expect(p.type).toBe('barcode')
    expect(p.options?.textType).toBeUndefined()
    expect(p.options?.barcodeType).toBe('code128')
    // Field binding preserved so business data still routes correctly.
    expect(p.field).toBe('trackingNo')
  })

  it('none of the three presets carry the dead Path A textType key', () => {
    const tids = [
      'defaultModule.barcode',
      'defaultModule.qrcode',
      'defaultModule.trackingNo',
    ]
    tids.forEach((tid) => {
      const p = presetByTid(tid)
      expect(p.options?.textType).toBeUndefined()
    })
  })
})

describe('default-factory presets → renderer roundtrip (TKT-008)', () => {
  it('mounting BarcodeElement with defaultModule.barcode preset → non-empty <svg>', async () => {
    const preset = presetByTid('defaultModule.barcode')
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 400, height: 300 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: preset.tid,
      printElementType: { type: preset.type },
      options: { ...(preset.options ?? {}) },
    })
    const w = mount(BarcodeElement, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
      attachTo: document.body,
    })
    await nextTick()
    expect(bwipjs.toSVG).toHaveBeenCalled()
    const call = vi.mocked(bwipjs.toSVG).mock.calls[0]?.[0] as {
      bcid: string
      text: string
    }
    expect(call.bcid).toBe('code128')
    // text falls back to options.testData when no field/data supplied.
    expect(call.text).toBe('123456789')
    expect(w.find('svg').exists()).toBe(true)
    expect(w.find('svg').attributes('data-bcid')).toBe('code128')
    w.unmount()
  })

  it('mounting BarcodeElement with defaultModule.trackingNo preset → non-empty <svg>', async () => {
    const preset = presetByTid('defaultModule.trackingNo')
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 400, height: 300 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: preset.tid,
      // field is at the etype level (V1 convention), so the data binding
      // must travel through printElementType.field, not options.field.
      printElementType: { type: preset.type, field: preset.field },
      options: { ...(preset.options ?? {}) },
    })
    const w = mount(BarcodeElement, {
      props: {
        elementId: 'e1',
        panelId: 'p1',
        data: { trackingNo: 'SF9999' },
        interactive: false,
      },
      attachTo: document.body,
    })
    await nextTick()
    const call = vi.mocked(bwipjs.toSVG).mock.calls[0]?.[0] as {
      bcid: string
      text: string
    }
    expect(call.bcid).toBe('code128')
    // data.trackingNo wins over testData per BarcodeElement.vue:52-58.
    expect(call.text).toBe('SF9999')
    expect(w.find('svg').exists()).toBe(true)
    w.unmount()
  })

  it('mounting QrcodeElement with defaultModule.qrcode preset → non-empty <svg>', async () => {
    const preset = presetByTid('defaultModule.qrcode')
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 400, height: 300 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: preset.tid,
      printElementType: { type: preset.type },
      options: { ...(preset.options ?? {}) },
    })
    const w = mount(QrcodeElement, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
      attachTo: document.body,
    })
    await nextTick()
    expect(bwipjs.toSVG).toHaveBeenCalled()
    const call = vi.mocked(bwipjs.toSVG).mock.calls[0]?.[0] as {
      bcid: string
      text: string
    }
    expect(call.bcid).toBe('qrcode')
    expect(call.text).toBe('https://example.com')
    expect(w.find('svg').exists()).toBe(true)
    w.unmount()
  })
})
