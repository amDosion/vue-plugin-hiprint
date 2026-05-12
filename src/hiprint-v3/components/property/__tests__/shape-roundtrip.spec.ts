/**
 * shape-roundtrip.spec.ts — TKT-001 regression lock.
 *
 * Sprint 22a Wave 2 introduced V3-invented names for shape stroke/fill keys
 * (`strokeWidth/strokeColor/strokeStyle/fillColor`) in ShapePropertyPanel.vue.
 * The SFCs (HlineElement/VlineElement/RectElement/OvalElement) + render.ts
 * read V1 names (`borderWidth/borderColor/borderStyle/backgroundColor`). The
 * panel→store→element roundtrip was therefore silently broken — every shape
 * edit was discarded.
 *
 * These tests lock the V1 key contract by spying on canvas.updateElement and
 * asserting it received the V1 key. If anyone reintroduces the V3-invented
 * name, the spy assertion fails immediately.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import {
  useCanvasStore,
  type CanvasElement,
} from '@hiprint-v3/stores'
import ShapePropertyPanel from '../ShapePropertyPanel.vue'

beforeEach(() => {
  setActivePinia(createPinia())
})

function seedRect(
  extra: Record<string, unknown> = {}
): {
  canvas: ReturnType<typeof useCanvasStore>
  getElement: () => CanvasElement | undefined
} {
  const canvas = useCanvasStore()
  canvas.addPanel({ id: 'p1', width: 400, height: 300 })
  canvas.addElement('p1', {
    id: 'e1',
    tid: 'default.rect',
    printElementType: { type: 'rect', title: 'Rect' },
    options: {
      left: 10,
      top: 20,
      width: 100,
      height: 50,
      borderWidth: 2,
      borderColor: '#f00',
      borderStyle: 'solid',
      backgroundColor: '#fff',
      ...extra,
    },
  })
  canvas.selectMultiple(['e1'])
  const getElement = () =>
    canvas.panels[0]?.printElements.find((e) => e.id === 'e1')
  return { canvas, getElement }
}

describe('shape-roundtrip (TKT-001) — panel writes the same key the element reads', () => {
  it('width input triggers canvas.updateElement with options.borderWidth (NOT strokeWidth)', async () => {
    const { canvas, getElement } = seedRect()
    const spy = vi.spyOn(canvas, 'updateElement')
    const w = mount(ShapePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const sw = w.find('input.shape-stroke-width')
    ;(sw.element as HTMLInputElement).value = '3'
    await sw.trigger('input')
    expect(spy).toHaveBeenCalled()
    const lastCall = spy.mock.calls[spy.mock.calls.length - 1]
    // updateElement(panelId, elementId, patch)
    expect(lastCall?.[0]).toBe('p1')
    expect(lastCall?.[1]).toBe('e1')
    const patch = (lastCall?.[2] ?? {}) as { options?: Record<string, unknown> }
    expect(patch.options).toMatchObject({ borderWidth: 3 })
    expect(patch.options).not.toHaveProperty('strokeWidth')
    spy.mockRestore()
    w.unmount()
  })

  it('fill color input triggers canvas.updateElement with options.backgroundColor (NOT fillColor)', async () => {
    const { canvas, getElement } = seedRect()
    const spy = vi.spyOn(canvas, 'updateElement')
    const w = mount(ShapePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const c = w.find('input.shape-fill-color')
    ;(c.element as HTMLInputElement).value = '#abcdef'
    await c.trigger('change')
    expect(spy).toHaveBeenCalled()
    const lastCall = spy.mock.calls[spy.mock.calls.length - 1]
    const patch = (lastCall?.[2] ?? {}) as { options?: Record<string, unknown> }
    expect(patch.options).toMatchObject({ backgroundColor: '#abcdef' })
    expect(patch.options).not.toHaveProperty('fillColor')
    spy.mockRestore()
    w.unmount()
  })

  it('border style change writes options.borderStyle (NOT strokeStyle)', async () => {
    const { canvas, getElement } = seedRect()
    const spy = vi.spyOn(canvas, 'updateElement')
    const w = mount(ShapePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    await w.find('select.shape-stroke-style').setValue('dashed')
    const lastCall = spy.mock.calls[spy.mock.calls.length - 1]
    const patch = (lastCall?.[2] ?? {}) as { options?: Record<string, unknown> }
    expect(patch.options).toMatchObject({ borderStyle: 'dashed' })
    expect(patch.options).not.toHaveProperty('strokeStyle')
    spy.mockRestore()
    w.unmount()
  })

  it('rendered store state after edit has V1 keys only', async () => {
    const { getElement } = seedRect()
    const w = mount(ShapePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const sw = w.find('input.shape-stroke-width')
    ;(sw.element as HTMLInputElement).value = '3'
    await sw.trigger('input')
    const opts = (getElement()?.options as Record<string, unknown>) ?? {}
    expect(opts.borderWidth).toBe(3)
    expect(opts.strokeWidth).toBeUndefined()
    expect(opts.strokeColor).toBeUndefined()
    expect(opts.fillColor).toBeUndefined()
    w.unmount()
  })
})
