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
    // TKT-367 (Sprint 22g GL) widened the option set from 7 to the full
    // 84-value V1 vocabulary via cascader-style <optgroup>s. Just assert the
    // popular subset is present + every value is lowercase.
    expect(values).toContain('code128')
    expect(values).toContain('ean13')
    expect(values).toContain('ean8')
    expect(values).toContain('upca')
    expect(values).toContain('interleaved2of5')
    expect(values).toContain('code39')
    expect(values).toContain('code93')
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
  it('does NOT render padding / color / lineColor inputs (TKT-002 rollback)', async () => {
    const { getElement } = seedBarcode()
    const w = mount(BarcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    // These three V1 panel keys are unread by the renderer; TKT-002 dropped
    // them. backgroundColor is restored in Sprint 22g GL TKT-367 because the
    // element wrapper paints it via computeFontStyle() AND it forwards to
    // bwip-js via TKT-364 collectBwipPassthrough.
    expect(w.find('input.bc-padding').exists()).toBe(false)
    expect(w.find('input.bc-line-color').exists()).toBe(false)
    expect(w.find('input.bc-color').exists()).toBe(false)
    w.unmount()
  })
})

// ---------------------------------------------------------------------------
// Sprint 22g wave 3 (Stream GL) — TKT-367 full-field parity tests.
// ---------------------------------------------------------------------------

describe('BarcodePropertyPanel — TKT-367 9-field parity', () => {
  it('renders barWidth select with 1/2/3/4 values', async () => {
    const { getElement } = seedBarcode({ barWidth: 2 })
    const w = mount(BarcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const sel = w.find('select.bc-bar-width')
    expect(sel.exists()).toBe(true)
    expect((sel.element as HTMLSelectElement).value).toBe('2')
    const values = w.findAll('select.bc-bar-width option').map((o) => o.attributes('value'))
    expect(values).toEqual(['1', '2', '3', '4'])
    w.unmount()
  })

  it('barWidth select patches options.barWidth (number, immediate commit)', async () => {
    const { getElement, history } = seedBarcode()
    const w = mount(BarcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const before = history.canUndo
    await w.find('select.bc-bar-width').setValue('3')
    expect(getOpts(getElement()).barWidth).toBe(3)
    expect(history.canUndo).not.toBe(before)
    w.unmount()
  })

  it('renders barAutoWidth select with 默认/自动/不自动 (V1 §J.23 string enum)', async () => {
    const { getElement } = seedBarcode({ barAutoWidth: 'true' })
    const w = mount(BarcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const sel = w.find('select.bc-bar-auto-width')
    expect(sel.exists()).toBe(true)
    expect((sel.element as HTMLSelectElement).value).toBe('true')
    const values = w.findAll('select.bc-bar-auto-width option').map((o) => o.attributes('value'))
    expect(values).toEqual(['', 'true', 'false'])
    w.unmount()
  })

  it('barAutoWidth select writes STRING form (round-trip with V1 §J.23)', async () => {
    const { getElement } = seedBarcode()
    const w = mount(BarcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    await w.find('select.bc-bar-auto-width').setValue('false')
    // Must persist the string 'false' (NOT boolean) so V1 ingest works.
    expect(getOpts(getElement()).barAutoWidth).toBe('false')
    await w.find('select.bc-bar-auto-width').setValue('true')
    expect(getOpts(getElement()).barAutoWidth).toBe('true')
    await w.find('select.bc-bar-auto-width').setValue('')
    expect(getOpts(getElement()).barAutoWidth).toBe('')
    w.unmount()
  })

  it('renders barTextMode select with 默认/单独文本/SVG enum (V1 §B.1.1)', async () => {
    const { getElement } = seedBarcode({ barTextMode: 'text' })
    const w = mount(BarcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const sel = w.find('select.bc-bar-text-mode')
    expect(sel.exists()).toBe(true)
    expect((sel.element as HTMLSelectElement).value).toBe('text')
    w.unmount()
  })

  it('barTextMode select patches options.barTextMode (immediate commit)', async () => {
    const { getElement, history } = seedBarcode()
    const w = mount(BarcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const before = history.canUndo
    await w.find('select.bc-bar-text-mode').setValue('svg')
    expect(getOpts(getElement()).barTextMode).toBe('svg')
    expect(history.canUndo).not.toBe(before)
    w.unmount()
  })

  it('renders textAlign select left/center/right', async () => {
    const { getElement } = seedBarcode({ textAlign: 'right' })
    const w = mount(BarcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const sel = w.find('select.bc-text-align')
    expect(sel.exists()).toBe(true)
    expect((sel.element as HTMLSelectElement).value).toBe('right')
    w.unmount()
  })

  it('textAlign select patches options.textAlign', async () => {
    const { getElement } = seedBarcode()
    const w = mount(BarcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    await w.find('select.bc-text-align').setValue('center')
    expect(getOpts(getElement()).textAlign).toBe('center')
    w.unmount()
  })

  it('renders backgroundColor input + writes options.backgroundColor', async () => {
    const { getElement } = seedBarcode({ backgroundColor: '#fffff0' })
    const w = mount(BarcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const bg = w.find('input.bc-background-color')
    expect(bg.exists()).toBe(true)
    expect((bg.element as HTMLInputElement).value).toBe('#fffff0')
    ;(bg.element as HTMLInputElement).value = '#222222'
    await bg.trigger('change')
    expect(getOpts(getElement()).backgroundColor).toBe('#222222')
    w.unmount()
  })

  it('renders V1 cascader optgroups for 84-value barcodeType (TKT-367)', async () => {
    const { getElement } = seedBarcode()
    const w = mount(BarcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    // optgroup-based "cascader" UI per V1 §B.2.1 / §D.2.
    const groups = w
      .findAll('select.bc-barcode-type optgroup')
      .map((g) => g.attributes('label'))
    // V1 inventory §B.2.1 lists 11 logical groups. Sprint 22g GL merges
    // 默认 + 条形码 into one group ("默认 / 条形码") to avoid happy-dom
    // select-binding collision on the duplicate code128 option value.
    expect(groups).toContain('默认 / 条形码')
    expect(groups).toContain('商品条码')
    expect(groups).toContain('物流')
    expect(groups).toContain('GS1 DataBar')
    expect(groups).toContain('邮政和快递编码')
    expect(groups).toContain('医疗产品编码')
    expect(groups).toContain('不常用编码')
    expect(groups).toContain('GS1 复合编码')
    expect(groups).toContain('附加组件')
    expect(groups).toContain('实验编码')
    // ≥ 80 selectable bcid options across all groups (target 84 per V1).
    const allOptions = w
      .findAll('select.bc-barcode-type option')
      .map((o) => o.attributes('value'))
    expect(allOptions.length).toBeGreaterThanOrEqual(80)
    // Every option value is lowercase (bwip-js bcid convention).
    for (const v of allOptions) {
      expect(v).toBe(String(v).toLowerCase())
    }
    // Sanity: ensure the most common bcids are present.
    expect(allOptions).toContain('code128')
    expect(allOptions).toContain('ean13')
    expect(allOptions).toContain('itf14')
    expect(allOptions).toContain('pharmacode')
    expect(allOptions).toContain('maxicode')
    w.unmount()
  })
})
