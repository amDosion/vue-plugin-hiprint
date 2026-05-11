/**
 * QrcodePropertyPanel.spec.ts — V3 qrcode property panel tests (PP-008).
 *
 * Covers:
 *  - Render bound to element.options (errorCorrectionLevel / padding /
 *    color / backgroundColor).
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
      errorCorrectionLevel: 'M',
      padding: 4,
      color: '#000000',
      backgroundColor: '#ffffff',
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
  it('renders bound to element.options', async () => {
    const { getElement } = seedQrcode({ errorCorrectionLevel: 'H' })
    const w = mount(QrcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    expect(
      (w.find('select.qr-ec-level').element as HTMLSelectElement).value
    ).toBe('H')
    expect((w.find('input.qr-padding').element as HTMLInputElement).value).toBe(
      '4'
    )
    w.unmount()
  })
})

describe('QrcodePropertyPanel — field changes', () => {
  it('errorCorrectionLevel select patches option', async () => {
    const { getElement } = seedQrcode()
    const w = mount(QrcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    await w.find('select.qr-ec-level').setValue('Q')
    expect(getOpts(getElement()).errorCorrectionLevel).toBe('Q')
    w.unmount()
  })

  it('padding input + change commits snapshot', async () => {
    const { getElement, history } = seedQrcode()
    const w = mount(QrcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const p = w.find('input.qr-padding')
    ;(p.element as HTMLInputElement).value = '12'
    await p.trigger('input')
    expect(getOpts(getElement()).padding).toBe(12)
    const before = history.canUndo
    await p.trigger('change')
    expect(history.canUndo).not.toBe(before)
    w.unmount()
  })

  it('color change patches options.color', async () => {
    const { getElement } = seedQrcode()
    const w = mount(QrcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const c = w.find('input.qr-color')
    ;(c.element as HTMLInputElement).value = '#3366ff'
    await c.trigger('change')
    expect(getOpts(getElement()).color).toBe('#3366ff')
    w.unmount()
  })

  it('backgroundColor change patches options.backgroundColor', async () => {
    const { getElement } = seedQrcode()
    const w = mount(QrcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const c = w.find('input.qr-background-color')
    ;(c.element as HTMLInputElement).value = '#fafafa'
    await c.trigger('change')
    expect(getOpts(getElement()).backgroundColor).toBe('#fafafa')
    w.unmount()
  })

  it('select has all four EC levels L/M/Q/H', async () => {
    const { getElement } = seedQrcode()
    const w = mount(QrcodePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const opts = w.findAll('select.qr-ec-level option').map((o) => o.attributes('value'))
    expect(opts).toEqual(['L', 'M', 'Q', 'H'])
    w.unmount()
  })
})
