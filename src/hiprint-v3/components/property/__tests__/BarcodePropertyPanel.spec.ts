/**
 * BarcodePropertyPanel.spec.ts — V3 barcode property panel tests (PP-007).
 *
 * Sprint 22a-r TKT-002 rollback: panel keys realigned to V3-renderer keys.
 * See `docs/V3-PARITY-MATRIX/04-barcode-qrcode.md` VIOLATION 2 + 4.
 *
 * Covers:
 *  - Render bound to element.options (barcodeType / hideTitle / fontSize /
 *    barColor).
 *  - Field changes dispatch canvas.updateElement with the right RENDERER keys
 *    (so editing the panel actually changes the rendered barcode).
 *  - History snapshot fires on commit boundary.
 *  - Select option `value`s are lowercase bwip-js bcids.
 *  - hideTitle inversion: "Show text" checkbox = !hideTitle.
 *  - Legacy keys `format`/`lineColor`/`displayValue`/`padding`/`color`/
 *    `backgroundColor` are NOT written.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import {
  useCanvasStore,
  useHistoryStore,
  type CanvasElement,
} from '@hiprint-v3/stores'
import BarcodePropertyPanel from '../BarcodePropertyPanel.vue'

beforeEach(() => {
  setActivePinia(createPinia())
})

function seedBarcode(extra: Record<string, unknown> = {}): {
  canvas: ReturnType<typeof useCanvasStore>
  history: ReturnType<typeof useHistoryStore>
  getElement: () => CanvasElement | undefined
} {
  const canvas = useCanvasStore()
  const history = useHistoryStore()
  canvas.addPanel({ id: 'p1', width: 400, height: 300 })
  canvas.addElement('p1', {
    id: 'e1',
    tid: 'default.barcode',
    printElementType: { type: 'barcode', title: 'Barcode' },
    options: {
      left: 10,
      top: 20,
      width: 200,
      height: 60,
      barcodeType: 'code128',
      hideTitle: false,
      fontSize: 14,
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

describe('BarcodePropertyPanel — bindings', () => {
  it('renders bound to element.options (renderer keys)', async () => {
    const { getElement } = seedBarcode()
    const w = mount(BarcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    expect(
      (w.find('select.bc-barcode-type').element as HTMLSelectElement).value
    ).toBe('code128')
    // hideTitle=false → "Show text" checkbox checked.
    expect(
      (w.find('input.bc-show-text').element as HTMLInputElement).checked
    ).toBe(true)
    expect(
      (w.find('input.bc-font-size').element as HTMLInputElement).value
    ).toBe('14')
    expect(
      (w.find('input.bc-bar-color').element as HTMLInputElement).value
    ).toBe('#000000')
    w.unmount()
  })

  it('select options are lowercase bwip-js bcids (no ITF14 uppercase alias)', async () => {
    const { getElement } = seedBarcode()
    const w = mount(BarcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const values = w
      .findAll('select.bc-barcode-type option')
      .map((o) => o.attributes('value'))
    // All lowercase + matches bwip-js bcid vocabulary.
    expect(values).toEqual([
      'code128',
      'ean13',
      'ean8',
      'upca',
      'interleaved2of5',
      'code39',
      'code93',
    ])
    // Uppercase or JsBarcode-style names must not appear.
    values.forEach((v) => {
      expect(v).toBe(String(v).toLowerCase())
    })
    expect(values).not.toContain('ITF14')
    expect(values).not.toContain('CODE128')
    w.unmount()
  })

  it('hideTitle=true → "Show text" checkbox is unchecked', async () => {
    const { getElement } = seedBarcode({ hideTitle: true })
    const w = mount(BarcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    expect(
      (w.find('input.bc-show-text').element as HTMLInputElement).checked
    ).toBe(false)
    w.unmount()
  })
})

describe('BarcodePropertyPanel — field changes (renderer keys)', () => {
  it('barcodeType select patches options.barcodeType (lowercase) — NOT format', async () => {
    const { getElement } = seedBarcode()
    const w = mount(BarcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    await w.find('select.bc-barcode-type').setValue('ean13')
    expect(getOpts(getElement()).barcodeType).toBe('ean13')
    // Legacy key must not be written.
    expect(getOpts(getElement()).format).toBeUndefined()
    w.unmount()
  })

  it('"Show text" checkbox toggles options.hideTitle with INVERTED semantics', async () => {
    // Start hideTitle=false → checkbox checked. Uncheck → hideTitle=true.
    const { getElement } = seedBarcode({ hideTitle: false })
    const w = mount(BarcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const cb = w.find('input.bc-show-text')
    expect((cb.element as HTMLInputElement).checked).toBe(true)
    ;(cb.element as HTMLInputElement).checked = false
    await cb.trigger('change')
    expect(getOpts(getElement()).hideTitle).toBe(true)
    // Legacy key must not be written.
    expect(getOpts(getElement()).displayValue).toBeUndefined()
  })

  it('"Show text" checked again flips hideTitle back to false', async () => {
    const { getElement } = seedBarcode({ hideTitle: true })
    const w = mount(BarcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const cb = w.find('input.bc-show-text')
    ;(cb.element as HTMLInputElement).checked = true
    await cb.trigger('change')
    expect(getOpts(getElement()).hideTitle).toBe(false)
    w.unmount()
  })

  it('barColor change patches options.barColor — NOT lineColor', async () => {
    const { getElement } = seedBarcode()
    const w = mount(BarcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const c = w.find('input.bc-bar-color')
    ;(c.element as HTMLInputElement).value = '#ff0000'
    await c.trigger('change')
    expect(getOpts(getElement()).barColor).toBe('#ff0000')
    expect(getOpts(getElement()).lineColor).toBeUndefined()
    w.unmount()
  })

  it('fontSize input patches options.fontSize, commit triggers pushSnapshot', async () => {
    const { getElement, history } = seedBarcode()
    const w = mount(BarcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const fs = w.find('input.bc-font-size')
    ;(fs.element as HTMLInputElement).value = '20'
    await fs.trigger('input')
    expect(getOpts(getElement()).fontSize).toBe(20)
    const before = history.canUndo
    await fs.trigger('change')
    expect(history.canUndo).not.toBe(before)
    w.unmount()
  })

  it('barcodeType change triggers pushSnapshot (immediate commit)', async () => {
    const { getElement, history } = seedBarcode()
    const w = mount(BarcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const before = history.canUndo
    await w.find('select.bc-barcode-type').setValue('code39')
    expect(getOpts(getElement()).barcodeType).toBe('code39')
    expect(history.canUndo).not.toBe(before)
    w.unmount()
  })
})

describe('BarcodePropertyPanel — dropped legacy fields', () => {
  it('does NOT render padding / color / backgroundColor inputs', async () => {
    const { getElement } = seedBarcode()
    const w = mount(BarcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    expect(w.find('input.bc-padding').exists()).toBe(false)
    expect(w.find('input.bc-line-color').exists()).toBe(false)
    expect(w.find('input.bc-color').exists()).toBe(false)
    expect(w.find('input.bc-background-color').exists()).toBe(false)
    w.unmount()
  })
})
