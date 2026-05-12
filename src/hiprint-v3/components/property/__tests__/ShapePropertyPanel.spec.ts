/**
 * ShapePropertyPanel.spec.ts — V3 shape property panel tests (PP-010).
 *
 * Covers:
 *  - Render bound to element.options (borderWidth / borderColor /
 *    borderStyle / backgroundColor / borderRadius — V1 key contract per TKT-001).
 *  - Conditional rendering by element.printElementType.type:
 *      hline / vline → stroke fieldset only.
 *      oval          → stroke + fill (no borderRadius).
 *      rect          → stroke + fill + borderRadius.
 *  - Field changes dispatch canvas.updateElement with the V1 key.
 *  - History snapshot fires on commit boundary.
 *
 * NOTE: Asserts the V1 key names — `strokeWidth` etc. were the V3 invented
 * names that caused TKT-001 (silent roundtrip). Tests now lock the V1 keys.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import {
  useCanvasStore,
  useHistoryStore,
  type CanvasElement,
} from '@hiprint-v3/stores'
import ShapePropertyPanel from '../ShapePropertyPanel.vue'

beforeEach(() => {
  setActivePinia(createPinia())
})

function seedShape(
  type: 'hline' | 'vline' | 'rect' | 'oval',
  extra: Record<string, unknown> = {}
): {
  canvas: ReturnType<typeof useCanvasStore>
  history: ReturnType<typeof useHistoryStore>
  getElement: () => CanvasElement | undefined
} {
  const canvas = useCanvasStore()
  const history = useHistoryStore()
  canvas.addPanel({ id: 'p1', width: 400, height: 300 })
  canvas.addElement('p1', {
    id: 'e1',
    tid: 'default.' + type,
    printElementType: { type, title: type },
    options: {
      left: 10,
      top: 20,
      width: 100,
      height: 50,
      borderWidth: 1,
      borderColor: '#000000',
      borderStyle: 'solid',
      backgroundColor: '#ffffff',
      borderRadius: 0,
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

describe('ShapePropertyPanel — conditional fieldsets', () => {
  it('hline renders stroke fieldset only (no fill, no border-radius)', async () => {
    const { getElement } = seedShape('hline')
    const w = mount(ShapePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    expect(w.find('input.shape-stroke-width').exists()).toBe(true)
    expect(w.find('input.shape-fill-color').exists()).toBe(false)
    expect(w.find('input.shape-border-radius').exists()).toBe(false)
    w.unmount()
  })

  it('vline renders stroke fieldset only', async () => {
    const { getElement } = seedShape('vline')
    const w = mount(ShapePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    expect(w.find('input.shape-stroke-width').exists()).toBe(true)
    expect(w.find('input.shape-fill-color').exists()).toBe(false)
    expect(w.find('input.shape-border-radius').exists()).toBe(false)
    w.unmount()
  })

  it('oval renders stroke + fill (no borderRadius)', async () => {
    const { getElement } = seedShape('oval')
    const w = mount(ShapePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    expect(w.find('input.shape-stroke-width').exists()).toBe(true)
    expect(w.find('input.shape-fill-color').exists()).toBe(true)
    expect(w.find('input.shape-border-radius').exists()).toBe(false)
    w.unmount()
  })

  it('rect renders stroke + fill + borderRadius', async () => {
    const { getElement } = seedShape('rect')
    const w = mount(ShapePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    expect(w.find('input.shape-stroke-width').exists()).toBe(true)
    expect(w.find('input.shape-fill-color').exists()).toBe(true)
    expect(w.find('input.shape-border-radius').exists()).toBe(true)
    w.unmount()
  })
})

describe('ShapePropertyPanel — field changes (V1 keys, TKT-001)', () => {
  it('strokeWidth input + change commits snapshot, writes options.borderWidth', async () => {
    const { getElement, history } = seedShape('rect')
    const w = mount(ShapePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const sw = w.find('input.shape-stroke-width')
    ;(sw.element as HTMLInputElement).value = '3'
    await sw.trigger('input')
    // V1 key — TKT-001
    expect(getOpts(getElement()).borderWidth).toBe(3)
    // ensure NOT writing the old V3-invented name
    expect(getOpts(getElement()).strokeWidth).toBeUndefined()
    const before = history.canUndo
    await sw.trigger('change')
    expect(history.canUndo).not.toBe(before)
    w.unmount()
  })

  it('strokeStyle select patches options.borderStyle (V1 key)', async () => {
    const { getElement } = seedShape('hline')
    const w = mount(ShapePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    await w.find('select.shape-stroke-style').setValue('dashed')
    expect(getOpts(getElement()).borderStyle).toBe('dashed')
    expect(getOpts(getElement()).strokeStyle).toBeUndefined()
    w.unmount()
  })

  it('strokeColor change patches options.borderColor (V1 key)', async () => {
    const { getElement } = seedShape('hline')
    const w = mount(ShapePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const c = w.find('input.shape-stroke-color')
    ;(c.element as HTMLInputElement).value = '#123456'
    await c.trigger('change')
    expect(getOpts(getElement()).borderColor).toBe('#123456')
    expect(getOpts(getElement()).strokeColor).toBeUndefined()
    w.unmount()
  })

  it('fillColor change (rect) patches options.backgroundColor (V1 key)', async () => {
    const { getElement } = seedShape('rect')
    const w = mount(ShapePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const c = w.find('input.shape-fill-color')
    ;(c.element as HTMLInputElement).value = '#abcdef'
    await c.trigger('change')
    expect(getOpts(getElement()).backgroundColor).toBe('#abcdef')
    expect(getOpts(getElement()).fillColor).toBeUndefined()
    w.unmount()
  })

  it('borderRadius change (rect) patches options.borderRadius', async () => {
    const { getElement } = seedShape('rect')
    const w = mount(ShapePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const r = w.find('input.shape-border-radius')
    ;(r.element as HTMLInputElement).value = '6'
    await r.trigger('input')
    expect(getOpts(getElement()).borderRadius).toBe(6)
    w.unmount()
  })
})
