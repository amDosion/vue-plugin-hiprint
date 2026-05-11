/**
 * ImageElement.spec.ts — V3 image etype unit tests (P17.1).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ImageElement from '../ImageElement.vue'
import { useCanvasStore } from '@hiprint-v3/stores'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('ImageElement', () => {
  it('renders <img> with src from bound data field', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.image',
      printElementType: { type: 'image' },
      options: { field: 'logo', width: 80, height: 40 },
    })
    const w = mount(ImageElement, {
      props: {
        elementId: 'e1',
        panelId: 'p1',
        data: { logo: 'https://example.com/a.png' },
        interactive: false,
      },
    })
    const img = w.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('https://example.com/a.png')
    w.unmount()
  })

  it('falls back to options.src when no data field present', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.image',
      printElementType: { type: 'image' },
      options: { src: 'data:image/png;base64,AAAA' },
    })
    const w = mount(ImageElement, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    expect(w.find('img').attributes('src')).toBe('data:image/png;base64,AAAA')
    w.unmount()
  })

  it('applies objectFit + borderRadius from options', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.image',
      printElementType: { type: 'image' },
      options: { src: 'x.png', fit: 'cover', borderRadius: 4 },
    })
    const w = mount(ImageElement, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    const img = w.find('img').element as HTMLImageElement
    expect(img.style.objectFit).toBe('cover')
    expect(img.style.borderRadius).toBe('4pt')
    w.unmount()
  })

  it('swaps in fallback src on @error', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.image',
      printElementType: { type: 'image' },
      options: { src: 'https://bad.example/missing.png' },
    })
    const w = mount(ImageElement, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    const img = w.find('img')
    expect(img.attributes('src')).toBe('https://bad.example/missing.png')
    await img.trigger('error')
    // After error, src should be the 1x1 data URL fallback (starts with data:).
    expect(img.attributes('src')?.startsWith('data:image/png;base64,')).toBe(true)
    w.unmount()
  })
})
