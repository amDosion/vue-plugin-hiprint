/**
 * ImagePropertyPanel.spec.ts — V3 image property panel tests (PP-005).
 *
 * Covers:
 *  - Render bound to element.options (src / fit / borderRadius /
 *    aspectRatioLock / width / height). NOTE V1 key `fit` per TKT-004.
 *  - Field change dispatches canvas.updateElement with the right options
 *    patch (V1 keys).
 *  - History snapshot fires on commit boundary (change).
 *  - Aspect-ratio lock: editing width adjusts height proportionally.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import {
  useCanvasStore,
  useHistoryStore,
  type CanvasElement,
} from '@hiprint-v3/stores'
import ImagePropertyPanel from '../ImagePropertyPanel.vue'

beforeEach(() => {
  setActivePinia(createPinia())
})

function seedImage(extra: Record<string, unknown> = {}): {
  canvas: ReturnType<typeof useCanvasStore>
  history: ReturnType<typeof useHistoryStore>
  getElement: () => CanvasElement | undefined
} {
  const canvas = useCanvasStore()
  const history = useHistoryStore()
  canvas.addPanel({ id: 'p1', width: 400, height: 300 })
  canvas.addElement('p1', {
    id: 'e1',
    tid: 'default.image',
    printElementType: { type: 'image', title: 'Image' },
    options: {
      left: 10,
      top: 20,
      width: 200,
      height: 100,
      src: 'https://example.com/a.png',
      fit: 'contain',
      borderRadius: 0,
      aspectRatioLock: false,
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

describe('ImagePropertyPanel — bindings', () => {
  it('renders bound to element.options.src and fit (V1 key)', async () => {
    const { getElement } = seedImage()
    const w = mount(ImagePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const src = w.find('input.img-src')
    expect((src.element as HTMLInputElement).value).toBe(
      'https://example.com/a.png'
    )
    const fit = w.find('select.img-object-fit')
    expect((fit.element as HTMLSelectElement).value).toBe('contain')
    const width = w.find('input.img-width')
    expect((width.element as HTMLInputElement).value).toBe('200')
    w.unmount()
  })
})

describe('ImagePropertyPanel — field changes', () => {
  it('changing src patches options.src', async () => {
    const { getElement } = seedImage()
    const w = mount(ImagePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const src = w.find('input.img-src')
    ;(src.element as HTMLInputElement).value = 'https://example.com/b.png'
    await src.trigger('change')
    expect(getOpts(getElement()).src).toBe('https://example.com/b.png')
    w.unmount()
  })

  it('changing object-fit dropdown patches options.fit (V1 key, TKT-004)', async () => {
    const { getElement } = seedImage()
    const w = mount(ImagePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    await w.find('select.img-object-fit').setValue('cover')
    // V1 key contract — TKT-004
    expect(getOpts(getElement()).fit).toBe('cover')
    // ensure the old V3-invented name is NOT written
    expect(getOpts(getElement()).objectFit).toBeUndefined()
    w.unmount()
  })

  it('borderRadius commits on change', async () => {
    const { getElement, history } = seedImage()
    const initial = history.canUndo
    const w = mount(ImagePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const r = w.find('input.img-border-radius')
    ;(r.element as HTMLInputElement).value = '8'
    await r.trigger('input')
    expect(getOpts(getElement()).borderRadius).toBe(8)
    // History snapshot fires on @change (commit boundary).
    await r.trigger('change')
    expect(history.canUndo).not.toBe(initial)
    w.unmount()
  })
})

describe('ImagePropertyPanel — aspect ratio lock', () => {
  it('width change rescales height when aspectRatioLock=true', async () => {
    const { getElement } = seedImage({
      width: 200,
      height: 100,
      aspectRatioLock: true,
    })
    const w = mount(ImagePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const wInput = w.find('input.img-width')
    ;(wInput.element as HTMLInputElement).value = '400'
    await wInput.trigger('input')
    // ratio = 100/200 = 0.5 → new height = 400 * 0.5 = 200
    expect(getOpts(getElement()).width).toBe(400)
    expect(getOpts(getElement()).height).toBe(200)
    w.unmount()
  })

  it('width change leaves height alone when aspectRatioLock=false', async () => {
    const { getElement } = seedImage({
      width: 200,
      height: 100,
      aspectRatioLock: false,
    })
    const w = mount(ImagePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const wInput = w.find('input.img-width')
    ;(wInput.element as HTMLInputElement).value = '400'
    await wInput.trigger('input')
    expect(getOpts(getElement()).width).toBe(400)
    expect(getOpts(getElement()).height).toBe(100)
    w.unmount()
  })
})
