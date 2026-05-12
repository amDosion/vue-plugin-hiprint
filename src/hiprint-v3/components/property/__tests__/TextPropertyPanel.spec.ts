/**
 * TextPropertyPanel.spec.ts — Sprint 22c TKT-108.
 *
 * Verifies that the dedicated `text` etype property panel surfaces the V1
 * field set in `docs/V1-INVENTORY/etypes/text-longtext.md` PART 1 Section B
 * and writes back through `canvas.updateElement` with V1-compatible keys.
 * The previous generic fallback exposed only ~12 of 57 fields, so these
 * tests pin the new surface in place against accidental regression.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import {
  useCanvasStore,
  useHistoryStore,
  type CanvasElement,
} from '@hiprint-v3/stores'
import TextPropertyPanel from '../TextPropertyPanel.vue'

beforeEach(() => {
  setActivePinia(createPinia())
})

function seedText(extra: Record<string, unknown> = {}): {
  canvas: ReturnType<typeof useCanvasStore>
  history: ReturnType<typeof useHistoryStore>
  getElement: () => CanvasElement | undefined
} {
  const canvas = useCanvasStore()
  const history = useHistoryStore()
  canvas.addPanel({ id: 'p1', width: 400, height: 300 })
  canvas.addElement('p1', {
    id: 'e1',
    tid: 'default.text',
    printElementType: { type: 'text', title: 'text' },
    options: {
      left: 10,
      top: 20,
      width: 120,
      height: 30,
      fontSize: 14,
      fontFamily: 'SimSun',
      color: '#000000',
      textAlign: 'left',
      title: 'Title',
      field: 'name',
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

describe('TextPropertyPanel — bindings', () => {
  it('renders bound to element.options (position + font baseline)', async () => {
    const { getElement } = seedText({
      transform: 0,
      backgroundColor: '#ffffff',
    })
    const w = mount(TextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    expect(
      (w.find('input.tx-left').element as HTMLInputElement).value
    ).toBe('10')
    expect(
      (w.find('input.tx-top').element as HTMLInputElement).value
    ).toBe('20')
    expect(
      (w.find('input.tx-width').element as HTMLInputElement).value
    ).toBe('120')
    expect(
      (w.find('input.tx-height').element as HTMLInputElement).value
    ).toBe('30')
    expect(
      (w.find('select.tx-font-family').element as HTMLSelectElement).value
    ).toBe('SimSun')
    expect(
      (w.find('input.tx-font-size').element as HTMLInputElement).value
    ).toBe('14')
    expect(
      (w.find('input.tx-color').element as HTMLInputElement).value
    ).toBe('#000000')
    w.unmount()
  })

  it('Position / Font / Align / Border / Background / Text type / Data type / Binding / Pagination / Misc legends render', async () => {
    const { getElement } = seedText()
    const w = mount(TextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const legends = w.findAll('legend').map((l) => l.text())
    expect(legends).toContain('Position')
    expect(legends).toContain('Font')
    expect(legends).toContain('Align')
    expect(legends).toContain('Border')
    expect(legends).toContain('Background')
    expect(legends).toContain('Text type')
    expect(legends).toContain('Data type')
    expect(legends).toContain('Binding')
    expect(legends).toContain('Pagination')
    expect(legends).toContain('Misc')
    w.unmount()
  })

  it('barcode-only fields hidden when textType=text', async () => {
    const { getElement } = seedText({ textType: 'text' })
    const w = mount(TextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    expect(w.find('select.tx-barcode-mode').exists()).toBe(false)
    expect(w.find('select.tx-qr-level').exists()).toBe(false)
    w.unmount()
  })

  it('barcode-only fields visible when textType=barcode', async () => {
    const { getElement } = seedText({
      textType: 'barcode',
      barcodeMode: 'CODE128',
    })
    const w = mount(TextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    expect(w.find('select.tx-barcode-mode').exists()).toBe(true)
    expect(w.find('select.tx-qr-level').exists()).toBe(false)
    w.unmount()
  })

  it('qrcode-only fields visible when textType=qrcode', async () => {
    const { getElement } = seedText({
      textType: 'qrcode',
      qrCodeLevel: 0,
    })
    const w = mount(TextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    expect(w.find('select.tx-qr-level').exists()).toBe(true)
    expect(w.find('select.tx-barcode-mode').exists()).toBe(false)
    w.unmount()
  })

  it('boolean-only fields hidden when dataType=text and visible when dataType=boolean', async () => {
    const { getElement, canvas } = seedText({ dataType: '' })
    const w = mount(TextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    expect(w.find('input.tx-format').exists()).toBe(false)
    expect(w.find('input.tx-true-text').exists()).toBe(false)
    await w.find('select.tx-data-type').setValue('boolean')
    // Re-mount with refreshed element prop (reactive prop already updates).
    const fresh =
      canvas.panels[0]?.printElements.find((e) => e.id === 'e1') ?? null
    expect(fresh).not.toBeNull()
    await w.setProps({ element: fresh! })
    await w.vm.$nextTick()
    expect(w.find('input.tx-format').exists()).toBe(true)
    expect(w.find('input.tx-true-text').exists()).toBe(true)
    expect(w.find('input.tx-false-text').exists()).toBe(true)
    w.unmount()
  })
})

describe('TextPropertyPanel — field changes', () => {
  it('color picker writes options.color + commits history', async () => {
    const { getElement, history } = seedText()
    const w = mount(TextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const before = history.canUndo
    const c = w.find('input.tx-color')
    ;(c.element as HTMLInputElement).value = '#ff0000'
    await c.trigger('change')
    expect(getOpts(getElement()).color).toBe('#ff0000')
    expect(history.canUndo).not.toBe(before)
    w.unmount()
  })

  it('fontSize input on change commits a history snapshot', async () => {
    const { getElement, history } = seedText()
    const w = mount(TextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const fs = w.find('input.tx-font-size')
    ;(fs.element as HTMLInputElement).value = '20'
    await fs.trigger('input')
    expect(getOpts(getElement()).fontSize).toBe(20)
    const before = history.canUndo
    await fs.trigger('change')
    expect(history.canUndo).not.toBe(before)
    w.unmount()
  })

  it('dataType=datetime exposes format input and writes both keys', async () => {
    const { getElement, canvas } = seedText()
    const w = mount(TextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    await w.find('select.tx-data-type').setValue('datetime')
    expect(getOpts(getElement()).dataType).toBe('datetime')
    // Refresh prop after store mutation so v-if rerenders.
    await w.setProps({
      element: canvas.panels[0]!.printElements.find((e) => e.id === 'e1')!,
    })
    await w.vm.$nextTick()
    const fmt = w.find('input.tx-format')
    expect(fmt.exists()).toBe(true)
    await fmt.setValue('yyyy-MM-dd')
    await fmt.trigger('blur')
    expect(getOpts(getElement()).format).toBe('yyyy-MM-dd')
    w.unmount()
  })

  it('field input commits options.field on blur', async () => {
    const { getElement } = seedText()
    const w = mount(TextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const f = w.find('input.tx-field')
    await f.setValue('user.email')
    await f.trigger('blur')
    expect(getOpts(getElement()).field).toBe('user.email')
    w.unmount()
  })

  it('formatter textarea writes string source (compileFormatter receives it)', async () => {
    const { getElement } = seedText()
    const w = mount(TextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const ta = w.find('textarea.tx-formatter')
    const src =
      'function(title, value){ return String(value).toUpperCase(); }'
    await ta.setValue(src)
    await ta.trigger('blur')
    expect(getOpts(getElement()).formatter).toBe(src)
    // Sanity — compileFormatter from the runtime helper accepts this shape;
    // we don't import it here to keep the spec to the panel surface.
    w.unmount()
  })

  it('pageBreak comma-list parses to number[]', async () => {
    const { getElement } = seedText()
    const w = mount(TextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const pb = w.find('input.tx-page-break')
    await pb.setValue('1, 3, 5')
    await pb.trigger('blur')
    expect(getOpts(getElement()).pageBreak).toEqual([1, 3, 5])
    w.unmount()
  })

  it('pageBreak accepts "true" boolean keyword', async () => {
    const { getElement } = seedText()
    const w = mount(TextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const pb = w.find('input.tx-page-break')
    await pb.setValue('true')
    await pb.trigger('blur')
    expect(getOpts(getElement()).pageBreak).toBe(true)
    w.unmount()
  })

  it('transform input writes numeric degrees to options.transform', async () => {
    const { getElement } = seedText()
    const w = mount(TextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const t = w.find('input.tx-transform')
    ;(t.element as HTMLInputElement).value = '45'
    await t.trigger('input')
    expect(getOpts(getElement()).transform).toBe(45)
    // _helpers.computeGeometryStyle reads `transform` and produces
    // `transform: rotate(45deg)` — proven separately in helpers spec.
    w.unmount()
  })

  it('positionLocked / sizeLocked / draggable checkboxes toggle correctly', async () => {
    const { getElement } = seedText({ draggable: true })
    const w = mount(TextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const pl = w.find('input.tx-position-locked')
    ;(pl.element as HTMLInputElement).checked = true
    await pl.trigger('change')
    expect(getOpts(getElement()).positionLocked).toBe(true)
    const sl = w.find('input.tx-size-locked')
    ;(sl.element as HTMLInputElement).checked = true
    await sl.trigger('change')
    expect(getOpts(getElement()).sizeLocked).toBe(true)
    const dr = w.find('input.tx-draggable')
    ;(dr.element as HTMLInputElement).checked = false
    await dr.trigger('change')
    expect(getOpts(getElement()).draggable).toBe(false)
    w.unmount()
  })

  it('textType change to barcode writes options.textType=barcode (TextElement.textTypeDispatch picks it up)', async () => {
    const { getElement } = seedText({ textType: 'text' })
    const w = mount(TextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    await w.find('select.tx-text-type').setValue('barcode')
    expect(getOpts(getElement()).textType).toBe('barcode')
    w.unmount()
  })

  it('barcodeMode select writes options.barcodeMode when textType=barcode', async () => {
    const { getElement } = seedText({
      textType: 'barcode',
      barcodeMode: 'CODE128',
    })
    const w = mount(TextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    await w.find('select.tx-barcode-mode').setValue('EAN13')
    expect(getOpts(getElement()).barcodeMode).toBe('EAN13')
    w.unmount()
  })

  it('textContentVerticalAlign middle button writes the V1 key', async () => {
    const { getElement } = seedText()
    const w = mount(TextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    await w.find('button.tx-valign-middle').trigger('click')
    expect(getOpts(getElement()).textContentVerticalAlign).toBe('middle')
    w.unmount()
  })

  it('contentPadding L/T/R/B inputs each write the V1 key', async () => {
    const { getElement } = seedText()
    const w = mount(TextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const l = w.find('input.tx-pad-l')
    ;(l.element as HTMLInputElement).value = '4'
    await l.trigger('input')
    const t = w.find('input.tx-pad-t')
    ;(t.element as HTMLInputElement).value = '5'
    await t.trigger('input')
    const r = w.find('input.tx-pad-r')
    ;(r.element as HTMLInputElement).value = '6'
    await r.trigger('input')
    const b = w.find('input.tx-pad-b')
    ;(b.element as HTMLInputElement).value = '7'
    await b.trigger('input')
    const o = getOpts(getElement())
    expect(o.contentPaddingLeft).toBe(4)
    expect(o.contentPaddingTop).toBe(5)
    expect(o.contentPaddingRight).toBe(6)
    expect(o.contentPaddingBottom).toBe(7)
    w.unmount()
  })
})

/**
 * Sprint 22g — Stream GC. Zero-out the dropped 7 fields from Sprint 22c
 * (88% → 100% coverage). All seven plus coordinateSync/widthHeightSync
 * must (a) surface in the panel, (b) round-trip through `canvas.updateElement`
 * with the V1-compatible key, and (c) honor visibility rules tied to
 * textType. The barTextMode/upperCase pair additionally drives renderer
 * behavior — wiring evidence lives in TextElement / render.ts / _helpers.ts
 * and is asserted indirectly through the panel's write contract.
 */
describe('TextPropertyPanel — Sprint 22g restored fields (7 + sync)', () => {
  it('barTextMode select visible when textType=barcode and writes V1 key', async () => {
    const { getElement } = seedText({
      textType: 'barcode',
      barTextMode: '',
    })
    const w = mount(TextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const sel = w.find('select.tx-bar-text-mode')
    expect(sel.exists()).toBe(true)
    await sel.setValue('text')
    expect(getOpts(getElement()).barTextMode).toBe('text')
    // Hidden when textType=text.
    await w.setProps({
      element: { ...getElement()!, options: { ...getOpts(getElement()), textType: 'text' } },
    })
    await w.vm.$nextTick()
    expect(w.find('select.tx-bar-text-mode').exists()).toBe(false)
    w.unmount()
  })

  it('barWidth + barAutoWidth tri-state write V1 keys when textType=barcode', async () => {
    const { getElement } = seedText({ textType: 'barcode' })
    const w = mount(TextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const bw = w.find('input.tx-bar-width')
    expect(bw.exists()).toBe(true)
    ;(bw.element as HTMLInputElement).value = '3'
    await bw.trigger('input')
    expect(getOpts(getElement()).barWidth).toBe(3)
    const baw = w.find('select.tx-bar-auto-width')
    await baw.setValue('false')
    expect(getOpts(getElement()).barAutoWidth).toBe(false)
    await baw.setValue('')
    expect(getOpts(getElement()).barAutoWidth).toBeUndefined()
    await baw.setValue('true')
    expect(getOpts(getElement()).barAutoWidth).toBe(true)
    w.unmount()
  })

  it('barcodeType text input commits options.barcodeType on blur (Path B override)', async () => {
    const { getElement } = seedText({ textType: 'barcode' })
    const w = mount(TextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const bt = w.find('input.tx-barcode-type')
    expect(bt.exists()).toBe(true)
    await bt.setValue('ean13')
    await bt.trigger('blur')
    expect(getOpts(getElement()).barcodeType).toBe('ean13')
    // render.ts prefers options.barcodeType over options.barcodeMode — this
    // panel write hits the bcid used by bwip-js directly.
    w.unmount()
  })

  it('qrcodeType text input commits options.qrcodeType when textType=qrcode', async () => {
    const { getElement } = seedText({ textType: 'qrcode' })
    const w = mount(TextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const qt = w.find('input.tx-qrcode-type')
    expect(qt.exists()).toBe(true)
    await qt.setValue('datamatrix')
    await qt.trigger('blur')
    expect(getOpts(getElement()).qrcodeType).toBe('datamatrix')
    w.unmount()
  })

  it('upperCase checkbox writes options.upperCase (render-time toUpperCase wiring lives in _helpers.computeDisplayText + render.ts)', async () => {
    const { getElement } = seedText()
    const w = mount(TextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const uc = w.find('input.tx-upper-case')
    expect(uc.exists()).toBe(true)
    ;(uc.element as HTMLInputElement).checked = true
    await uc.trigger('change')
    expect(getOpts(getElement()).upperCase).toBe(true)
    w.unmount()
  })

  it('optionsGroup advanced text input commits options.optionsGroup', async () => {
    const { getElement } = seedText()
    const w = mount(TextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const og = w.find('input.tx-options-group')
    expect(og.exists()).toBe(true)
    await og.setValue('barcode-tools')
    await og.trigger('blur')
    expect(getOpts(getElement()).optionsGroup).toBe('barcode-tools')
    w.unmount()
  })

  it('coordinateSync + widthHeightSync checkboxes fan-out on Position writes', async () => {
    // Toggle coordinateSync on → editing left mirrors into top in the same patch.
    const { getElement, canvas } = seedText({
      coordinateSync: true,
      widthHeightSync: true,
    })
    const w = mount(TextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    // Verify both checkboxes render bound to current options.
    expect(
      (w.find('input.tx-coordinate-sync').element as HTMLInputElement).checked
    ).toBe(true)
    expect(
      (w.find('input.tx-width-height-sync').element as HTMLInputElement).checked
    ).toBe(true)
    // Drive left → top mirror.
    const left = w.find('input.tx-left')
    ;(left.element as HTMLInputElement).value = '42'
    await left.trigger('input')
    let o = getOpts(getElement())
    expect(o.left).toBe(42)
    expect(o.top).toBe(42)
    // Drive width → height mirror after element-prop refresh.
    await w.setProps({
      element: canvas.panels[0]!.printElements.find((e) => e.id === 'e1')!,
    })
    await w.vm.$nextTick()
    const width = w.find('input.tx-width')
    ;(width.element as HTMLInputElement).value = '88'
    await width.trigger('input')
    o = getOpts(getElement())
    expect(o.width).toBe(88)
    expect(o.height).toBe(88)
    // With sync OFF the mirror does not fire. Manually flip the .checked
    // state (vue-test-utils' .trigger('change') does not toggle the DOM
    // checkbox value by itself).
    const syncCb = w.find('input.tx-coordinate-sync')
    ;(syncCb.element as HTMLInputElement).checked = false
    await syncCb.trigger('change')
    await w.setProps({
      element: canvas.panels[0]!.printElements.find((e) => e.id === 'e1')!,
    })
    await w.vm.$nextTick()
    expect(getOpts(getElement()).coordinateSync).toBe(false)
    const top = w.find('input.tx-top')
    ;(top.element as HTMLInputElement).value = '5'
    await top.trigger('input')
    o = getOpts(getElement())
    expect(o.top).toBe(5)
    // left untouched by the just-fired onTop because coordinateSync now false.
    expect(o.left).toBe(42)
    w.unmount()
  })
})
