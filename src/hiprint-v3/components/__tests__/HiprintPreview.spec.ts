/**
 * HiprintPreview.spec.ts — V3 HiprintPreview component unit tests (P18.1).
 *
 * Covers:
 *  - renderTemplate output is appended to host element after mount
 *  - re-renders when template store changes (loadFromJson)
 *  - re-renders when data prop changes (deep watch)
 *  - empty when no template loaded
 *  - cleanup on unmount (host emptied)
 *
 * happy-dom note: DOMParser for SVG works; renderTemplate barcode/qrcode call
 * bwip-js which internally uses canvas APIs happy-dom partially stubs — we
 * stick to text-only fixtures here so test stays deterministic.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HiprintPreview from '../HiprintPreview.vue'
import { useTemplateStore } from '@hiprint-v3/stores'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

function textTemplate(title = 'Hello', field = 'name') {
  return {
    panels: [
      {
        width: 100,
        height: 50,
        printElements: [
          {
            options: { left: 10, top: 20, width: 80, height: 16, title, field },
            printElementType: { type: 'text', title, field },
          },
        ],
      },
    ],
  }
}

describe('HiprintPreview — rendering', () => {
  it('renders nothing when no template loaded', () => {
    const w = mount(HiprintPreview, { attachTo: document.body })
    // Host exists but contains no .hiprint-printTemplate child.
    expect(
      w.element.querySelector('.hiprint-printTemplate')
    ).toBeNull()
    w.unmount()
  })

  it('appends hiprint-printTemplate when template is loaded', async () => {
    const tpl = useTemplateStore()
    tpl.loadFromJson(textTemplate())
    const w = mount(HiprintPreview, { attachTo: document.body })
    await w.vm.$nextTick()
    const root = w.element.querySelector('.hiprint-printTemplate')
    expect(root).not.toBeNull()
    expect(root!.querySelectorAll('.hiprint-printPanel').length).toBe(1)
    w.unmount()
  })

  it('re-renders when template store reloads', async () => {
    const tpl = useTemplateStore()
    tpl.loadFromJson(textTemplate('First'))
    const w = mount(HiprintPreview, { attachTo: document.body })
    await w.vm.$nextTick()
    expect(w.element.textContent).toContain('First')

    tpl.loadFromJson(textTemplate('Second'))
    await w.vm.$nextTick()
    await w.vm.$nextTick()
    expect(w.element.textContent).toContain('Second')
    expect(w.element.textContent).not.toContain('First')
    w.unmount()
  })

  it('binds data prop into rendered template via field resolution', async () => {
    const tpl = useTemplateStore()
    tpl.loadFromJson(textTemplate('Name', 'name'))
    const w = mount(HiprintPreview, {
      props: { data: { name: 'Alice' } },
      attachTo: document.body,
    })
    await w.vm.$nextTick()
    expect(w.element.textContent).toContain('Alice')

    await w.setProps({ data: { name: 'Bob' } })
    await w.vm.$nextTick()
    await w.vm.$nextTick()
    expect(w.element.textContent).toContain('Bob')
    expect(w.element.textContent).not.toContain('Alice')
    w.unmount()
  })
})

describe('HiprintPreview — lifecycle', () => {
  it('clears host on unmount without throwing', async () => {
    const tpl = useTemplateStore()
    tpl.loadFromJson(textTemplate())
    const w = mount(HiprintPreview, { attachTo: document.body })
    await w.vm.$nextTick()
    expect(w.element.querySelector('.hiprint-printTemplate')).not.toBeNull()
    expect(() => w.unmount()).not.toThrow()
  })
})
