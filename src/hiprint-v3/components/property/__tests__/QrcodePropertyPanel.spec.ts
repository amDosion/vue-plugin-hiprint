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

describe('QrcodePropertyPanel — dropped legacy field names', () => {
  it('does NOT render legacy color key as `qr-color` (TKT-003 rollback)', async () => {
    const { getElement } = seedQrcode()
    const w = mount(QrcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    // The legacy V3 panel wrote `options.color`; renderer never read it.
    // TKT-003 dropped that field. Wave 3 TKT-372 reintroduces `padding`
    // (renderer reads via computePaddingStyle) and TKT-367 sibling adds
    // backgroundColor (wrapper paints it). Only the dead `color` stays out.
    expect(w.find('input.qr-color').exists()).toBe(false)
    w.unmount()
  })
})

// ---------------------------------------------------------------------------
// Sprint 22g wave 3 (Stream GL) — TKT-366/367/368/372 panel parity tests.
// ---------------------------------------------------------------------------

describe('QrcodePropertyPanel — TKT-367 sibling: 19-value qrcodeType select', () => {
  it('renders the V1 §B.3.1 19-code qrcodeType select', async () => {
    const { getElement } = seedQrcode({ qrcodeType: 'datamatrix' })
    const w = mount(QrcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const sel = w.find('select.qr-qrcode-type')
    expect(sel.exists()).toBe(true)
    expect((sel.element as HTMLSelectElement).value).toBe('datamatrix')
    const values = w
      .findAll('select.qr-qrcode-type option')
      .map((o) => o.attributes('value'))
    // 19-value V1 vocabulary (matrix TKT-367 reference target).
    expect(values).toContain('qrcode')
    expect(values).toContain('microqrcode')
    expect(values).toContain('swissqrcode')
    expect(values).toContain('azteccode')
    expect(values).toContain('datamatrix')
    expect(values).toContain('pdf417')
    expect(values).toContain('hibcqrcode')
    expect(values).toContain('hanxin')
    expect(values.length).toBeGreaterThanOrEqual(19)
    // No optgroup; flat list per V1.
    expect(w.findAll('select.qr-qrcode-type optgroup').length).toBe(0)
    w.unmount()
  })

  it('qrcodeType select patches options.qrcodeType (immediate commit)', async () => {
    const { getElement, history } = seedQrcode()
    const w = mount(QrcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const before = history.canUndo
    await w.find('select.qr-qrcode-type').setValue('azteccode')
    expect(getOpts(getElement()).qrcodeType).toBe('azteccode')
    expect(history.canUndo).not.toBe(before)
    w.unmount()
  })
})

describe('QrcodePropertyPanel — TKT-366 show-title checkbox', () => {
  it('"Show title" checkbox starts checked when hideTitle absent', async () => {
    const { getElement } = seedQrcode()
    const w = mount(QrcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const cb = w.find('input.qr-show-title')
    expect(cb.exists()).toBe(true)
    expect((cb.element as HTMLInputElement).checked).toBe(true)
    w.unmount()
  })

  it('"Show title" checkbox unchecked when hideTitle=true', async () => {
    const { getElement } = seedQrcode({ hideTitle: true })
    const w = mount(QrcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const cb = w.find('input.qr-show-title')
    expect((cb.element as HTMLInputElement).checked).toBe(false)
    w.unmount()
  })

  it('toggling "Show title" writes BOTH hideTitle and displayValue (TKT-368)', async () => {
    const { getElement } = seedQrcode({ hideTitle: false })
    const w = mount(QrcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const cb = w.find('input.qr-show-title')
    ;(cb.element as HTMLInputElement).checked = false
    await cb.trigger('change')
    expect(getOpts(getElement()).hideTitle).toBe(true)
    expect(getOpts(getElement()).displayValue).toBe(false)
    ;(cb.element as HTMLInputElement).checked = true
    await cb.trigger('change')
    expect(getOpts(getElement()).hideTitle).toBe(false)
    expect(getOpts(getElement()).displayValue).toBe(true)
    w.unmount()
  })

  it('TKT-368: pre-existing displayValue:true wins over hideTitle:true (round-trip)', async () => {
    const { getElement } = seedQrcode({
      hideTitle: true,
      displayValue: true,
    })
    const w = mount(QrcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const cb = w.find('input.qr-show-title')
    expect((cb.element as HTMLInputElement).checked).toBe(true)
    w.unmount()
  })
})

describe('QrcodePropertyPanel — TKT-372 padding (quiet zone)', () => {
  it('renders padding number input', async () => {
    const { getElement } = seedQrcode({ padding: 8 })
    const w = mount(QrcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const inp = w.find('input.qr-padding')
    expect(inp.exists()).toBe(true)
    expect((inp.element as HTMLInputElement).value).toBe('8')
    w.unmount()
  })

  it('padding input writes options.padding number', async () => {
    const { getElement, history } = seedQrcode()
    const w = mount(QrcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const inp = w.find('input.qr-padding')
    ;(inp.element as HTMLInputElement).value = '12'
    await inp.trigger('input')
    expect(getOpts(getElement()).padding).toBe(12)
    const before = history.canUndo
    await inp.trigger('change')
    expect(history.canUndo).not.toBe(before)
    w.unmount()
  })
})

describe('QrcodePropertyPanel — backgroundColor (TKT-367 sibling)', () => {
  it('renders qr-background-color + writes options.backgroundColor', async () => {
    const { getElement } = seedQrcode({ backgroundColor: '#f7f7f7' })
    const w = mount(QrcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const bg = w.find('input.qr-background-color')
    expect(bg.exists()).toBe(true)
    expect((bg.element as HTMLInputElement).value).toBe('#f7f7f7')
    ;(bg.element as HTMLInputElement).value = '#abcdef'
    await bg.trigger('change')
    expect(getOpts(getElement()).backgroundColor).toBe('#abcdef')
    w.unmount()
  })
})
