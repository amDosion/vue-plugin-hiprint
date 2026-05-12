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
