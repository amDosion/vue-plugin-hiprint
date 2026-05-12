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

// ---------------------------------------------------------------------------
// Sprint 22g wave 3 (Stream GL) — TKT-361 file picker tests.
// ---------------------------------------------------------------------------

describe('ImagePropertyPanel — TKT-361 file picker', () => {
  it('renders the file picker <input type=file accept=image/*>', async () => {
    const { getElement } = seedImage()
    const w = mount(ImagePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const picker = w.find('input.img-file-pick')
    expect(picker.exists()).toBe(true)
    expect((picker.element as HTMLInputElement).type).toBe('file')
    expect(picker.attributes('accept')).toBe('image/*')
    w.unmount()
  })

  it('reads a picked image as data: URL and writes to options.src', async () => {
    const { getElement } = seedImage()
    const w = mount(ImagePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()

    // Build a fake image File. happy-dom's FileReader returns a real
    // data: URL synchronously after the onload event.
    const file = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47])],
      'logo.png',
      { type: 'image/png' }
    )
    const picker = w.find('input.img-file-pick')
    // Patch the file-picker element's files property + trigger change.
    Object.defineProperty(picker.element, 'files', {
      configurable: true,
      get: () => [file] as unknown as FileList,
    })
    await picker.trigger('change')

    // Wait one macrotask for FileReader to fire its async onload.
    await new Promise((r) => setTimeout(r, 50))

    const next = getOpts(getElement()).src
    expect(typeof next).toBe('string')
    expect(String(next).startsWith('data:image/png')).toBe(true)
    w.unmount()
  })

  it('rejects non-image MIME types without writing options.src', async () => {
    const { getElement } = seedImage()
    const w = mount(ImagePropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const initialSrc = getOpts(getElement()).src

    // PDF file: should be rejected upstream of the FileReader.
    const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'doc.pdf', {
      type: 'application/pdf',
    })
    const picker = w.find('input.img-file-pick')
    Object.defineProperty(picker.element, 'files', {
      configurable: true,
      get: () => [file] as unknown as FileList,
    })
    await picker.trigger('change')
    await new Promise((r) => setTimeout(r, 25))

    // Source URL untouched.
    expect(getOpts(getElement()).src).toBe(initialSrc)
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
