/**
 * QrcodePropertyPanel.spec.ts — V3 qrcode property panel tests (PP-008).
 *
 * Sprint 22a-r TKT-003 rollback: panel keys realigned to V3-renderer keys.
 * See `docs/V3-PARITY-MATRIX/04-barcode-qrcode.md` VIOLATION-3 + VIOLATION-4.
 *
 * Covers:
 *  - Render bound to element.options (qrCodeLevel as int / barColor).
 *  - qrCodeLevel select writes the V1-canonical INT index into
 *    ['M','L','H','Q'] (L→1, M→0, Q→3, H→2). NOT a string letter.
 *  - barColor change writes options.barColor (NOT color/backgroundColor).
 *  - History snapshot fires on commit boundary.
 *  - Legacy keys `errorCorrectionLevel`/`color`/`backgroundColor`/`padding`
 *    are NOT written.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import {
  useCanvasStore,
  useHistoryStore,
  type CanvasElement,
} from '@hiprint-v3/stores'
import QrcodePropertyPanel from '../QrcodePropertyPanel.vue'

beforeEach(() => {
  setActivePinia(createPinia())
})

function seedQrcode(extra: Record<string, unknown> = {}): {
  canvas: ReturnType<typeof useCanvasStore>
  history: ReturnType<typeof useHistoryStore>
  getElement: () => CanvasElement | undefined
} {
  const canvas = useCanvasStore()
  const history = useHistoryStore()
  canvas.addPanel({ id: 'p1', width: 400, height: 300 })
  canvas.addElement('p1', {
    id: 'e1',
    tid: 'default.qrcode',
    printElementType: { type: 'qrcode', title: 'QR Code' },
    options: {
      left: 10,
      top: 20,
      width: 100,
      height: 100,
      qrCodeLevel: 0, // M (default)
      barColor: '#000000',
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

describe('QrcodePropertyPanel — bindings', () => {
  it('renders bound to element.options (renderer keys)', async () => {
    const { getElement } = seedQrcode({ qrCodeLevel: 2 }) // H
    const w = mount(QrcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    expect(
      (w.find('select.qr-ec-level').element as HTMLSelectElement).value
    ).toBe('2')
    expect(
      (w.find('input.qr-bar-color').element as HTMLInputElement).value
    ).toBe('#000000')
    w.unmount()
  })

  it('renders default qrCodeLevel=0 (M) when option absent', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 400, height: 300 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 'default.qrcode',
      printElementType: { type: 'qrcode', title: 'QR Code' },
      options: { left: 10, top: 20, width: 100, height: 100 },
    })
    canvas.selectMultiple(['e1'])
    const el = canvas.panels[0]!.printElements.find((e) => e.id === 'e1')!
    const w = mount(QrcodePropertyPanel, { props: { element: el } })
    await w.vm.$nextTick()
    expect(
      (w.find('select.qr-ec-level').element as HTMLSelectElement).value
    ).toBe('0')
    w.unmount()
  })

  it('select EC level options are INT indexes 1/0/3/2 for L/M/Q/H', async () => {
    const { getElement } = seedQrcode()
    const w = mount(QrcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const options = w.findAll('select.qr-ec-level option')
    const pairs = options.map((o) => ({
      value: o.attributes('value'),
      label: o.text(),
    }))
    expect(pairs).toEqual([
      { value: '1', label: 'L — Low (7%)' },
      { value: '0', label: 'M — Medium (15%)' },
      { value: '3', label: 'Q — Quartile (25%)' },
      { value: '2', label: 'H — High (30%)' },
    ])
    w.unmount()
  })
})

describe('QrcodePropertyPanel — field changes (renderer keys)', () => {
  it('qrCodeLevel select writes INT into options.qrCodeLevel — NOT errorCorrectionLevel', async () => {
    const { getElement } = seedQrcode()
    const w = mount(QrcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    await w.find('select.qr-ec-level').setValue('3') // Q
    expect(getOpts(getElement()).qrCodeLevel).toBe(3)
    // Legacy key must not be written.
    expect(getOpts(getElement()).errorCorrectionLevel).toBeUndefined()
    w.unmount()
  })

  it('qrCodeLevel select supports all 4 L/M/Q/H index mappings', async () => {
    const { getElement } = seedQrcode()
    const w = mount(QrcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    // L → 1
    await w.find('select.qr-ec-level').setValue('1')
    expect(getOpts(getElement()).qrCodeLevel).toBe(1)
    // M → 0
    await w.find('select.qr-ec-level').setValue('0')
    expect(getOpts(getElement()).qrCodeLevel).toBe(0)
    // Q → 3
    await w.find('select.qr-ec-level').setValue('3')
    expect(getOpts(getElement()).qrCodeLevel).toBe(3)
    // H → 2
    await w.find('select.qr-ec-level').setValue('2')
    expect(getOpts(getElement()).qrCodeLevel).toBe(2)
    w.unmount()
  })

  it('qrCodeLevel select triggers pushSnapshot on commit', async () => {
    const { getElement, history } = seedQrcode()
    const w = mount(QrcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const before = history.canUndo
    await w.find('select.qr-ec-level').setValue('2')
    expect(history.canUndo).not.toBe(before)
    w.unmount()
  })

  it('barColor change writes options.barColor — NOT color/backgroundColor', async () => {
    const { getElement } = seedQrcode()
    const w = mount(QrcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const c = w.find('input.qr-bar-color')
    ;(c.element as HTMLInputElement).value = '#3366ff'
    await c.trigger('change')
    expect(getOpts(getElement()).barColor).toBe('#3366ff')
    expect(getOpts(getElement()).color).toBeUndefined()
    expect(getOpts(getElement()).backgroundColor).toBeUndefined()
    w.unmount()
  })
})

describe('QrcodePropertyPanel — dropped legacy fields', () => {
  it('does NOT render padding / color / backgroundColor inputs', async () => {
    const { getElement } = seedQrcode()
    const w = mount(QrcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    expect(w.find('input.qr-padding').exists()).toBe(false)
    expect(w.find('input.qr-color').exists()).toBe(false)
    expect(w.find('input.qr-background-color').exists()).toBe(false)
    w.unmount()
  })
})
