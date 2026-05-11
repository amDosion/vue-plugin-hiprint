/**
 * BarcodePropertyPanel.spec.ts — V3 barcode property panel tests (PP-007).
 *
 * Covers:
 *  - Render bound to element.options (format / displayValue / padding /
 *    fontSize / lineColor).
 *  - Field changes dispatch canvas.updateElement with the right patch.
 *  - History snapshot fires on commit boundary.
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
      format: 'CODE128',
      displayValue: true,
      padding: 4,
      fontSize: 14,
      lineColor: '#000000',
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
  it('renders bound to element.options', async () => {
    const { getElement } = seedBarcode()
    const w = mount(BarcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    expect((w.find('select.bc-format').element as HTMLSelectElement).value).toBe(
      'CODE128'
    )
    expect(
      (w.find('input.bc-display-value').element as HTMLInputElement).checked
    ).toBe(true)
    expect((w.find('input.bc-padding').element as HTMLInputElement).value).toBe(
      '4'
    )
    expect(
      (w.find('input.bc-font-size').element as HTMLInputElement).value
    ).toBe('14')
    w.unmount()
  })
})

describe('BarcodePropertyPanel — field changes', () => {
  it('format select patches options.format', async () => {
    const { getElement } = seedBarcode()
    const w = mount(BarcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    await w.find('select.bc-format').setValue('EAN13')
    expect(getOpts(getElement()).format).toBe('EAN13')
    w.unmount()
  })

  it('displayValue checkbox toggles option', async () => {
    const { getElement } = seedBarcode({ displayValue: true })
    const w = mount(BarcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const cb = w.find('input.bc-display-value')
    ;(cb.element as HTMLInputElement).checked = false
    await cb.trigger('change')
    expect(getOpts(getElement()).displayValue).toBe(false)
    w.unmount()
  })

  it('padding commit triggers pushSnapshot', async () => {
    const { getElement, history } = seedBarcode()
    const w = mount(BarcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const p = w.find('input.bc-padding')
    ;(p.element as HTMLInputElement).value = '10'
    await p.trigger('input')
    expect(getOpts(getElement()).padding).toBe(10)
    const before = history.canUndo
    await p.trigger('change')
    expect(history.canUndo).not.toBe(before)
    w.unmount()
  })

  it('lineColor change patches options.lineColor', async () => {
    const { getElement } = seedBarcode()
    const w = mount(BarcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const c = w.find('input.bc-line-color')
    ;(c.element as HTMLInputElement).value = '#ff0000'
    await c.trigger('change')
    expect(getOpts(getElement()).lineColor).toBe('#ff0000')
    w.unmount()
  })

  it('fontSize input patches options.fontSize', async () => {
    const { getElement } = seedBarcode()
    const w = mount(BarcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const fs = w.find('input.bc-font-size')
    ;(fs.element as HTMLInputElement).value = '20'
    await fs.trigger('input')
    expect(getOpts(getElement()).fontSize).toBe(20)
    w.unmount()
  })
})
