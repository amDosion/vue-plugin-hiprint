/**
 * HiprintCanvas-smart-guide-label.spec.ts — TKT-391 pt-coordinate label on
 * smart-guide preview lines.
 *
 * V1 reference: bundle.js line 1380-1451 (HilightLine helper) + 7538-7691
 * (snap render path). V1 displays the pt offset of each active snap line as
 * a small numeric badge so the designer reads the exact coordinate without
 * measuring against the ruler.
 *
 * V3 mirrors that by emitting `<span class="hiprint-smart-guide__label">`
 * next to every preview line + a `data-pt` attribute the assertions key off
 * for deterministic coordinate checks (no DOM-rect coupling).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import HiprintCanvas from '../HiprintCanvas.vue'
import { useCanvasStore } from '@hiprint-v3/stores'
import { setSmartGuidePreviews } from '@hiprint-v3/interactions'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  // Always clear the global preview state so a leaked test doesn't bleed
  // dashed lines into the next mount.
  setSmartGuidePreviews([])
  document.body.innerHTML = ''
})

async function mountWithPanel() {
  const canvas = useCanvasStore()
  canvas.addPanel({ id: 'p1', width: 210, height: 297 })
  const wrapper = mount(HiprintCanvas, { attachTo: document.body })
  await nextTick()
  return { wrapper, canvas }
}

describe('HiprintCanvas — TKT-391 smart-guide pt-coordinate label', () => {
  it('emits a labeled badge next to each smart-guide preview line', async () => {
    const { wrapper } = await mountWithPanel()
    // Feed two previews: vertical at x=100pt, horizontal at y=50.5pt.
    setSmartGuidePreviews([
      { axis: 'v', pos: 100, kind: 'element-left' },
      { axis: 'h', pos: 50.5, kind: 'element-top' },
    ])
    await nextTick()
    const labels = wrapper.element.querySelectorAll(
      '.hiprint-smart-guide__label'
    )
    expect(labels.length).toBe(2)
    // Each badge carries the rounded coordinate as its `data-pt` attr.
    const pts = Array.from(labels).map((n) => n.getAttribute('data-pt'))
    expect(pts).toContain('100')
    expect(pts).toContain('50.5')
    wrapper.unmount()
  })

  it('rounds non-integer coordinates to 1 decimal place', async () => {
    const { wrapper } = await mountWithPanel()
    setSmartGuidePreviews([{ axis: 'v', pos: 72.345, kind: 'element-h-center' }])
    await nextTick()
    const label = wrapper.element.querySelector(
      '.hiprint-smart-guide__label'
    ) as HTMLElement | null
    expect(label).not.toBeNull()
    expect(label!.getAttribute('data-pt')).toBe('72.3')
    // The visible text mirrors the data attr + a 'pt' unit suffix so designers
    // see exactly what coordinate the snap landed on.
    expect(label!.textContent).toBe('72.3pt')
    wrapper.unmount()
  })

  it('strips trailing ".0" on integer-coincident coordinates', async () => {
    const { wrapper } = await mountWithPanel()
    setSmartGuidePreviews([{ axis: 'h', pos: 40, kind: 'element-bottom' }])
    await nextTick()
    const label = wrapper.element.querySelector(
      '.hiprint-smart-guide__label'
    ) as HTMLElement | null
    expect(label).not.toBeNull()
    // Integer snaps render as "40", not "40.0" — matches V1 display.
    expect(label!.getAttribute('data-pt')).toBe('40')
    expect(label!.textContent).toBe('40pt')
    wrapper.unmount()
  })

  it('label disappears when previews clear (drag-end)', async () => {
    const { wrapper } = await mountWithPanel()
    setSmartGuidePreviews([{ axis: 'v', pos: 25, kind: 'user-guide' }])
    await nextTick()
    expect(
      wrapper.element.querySelectorAll('.hiprint-smart-guide__label').length
    ).toBe(1)
    setSmartGuidePreviews([])
    await nextTick()
    // Whole smart-guide line + its label both unmount on clear.
    expect(
      wrapper.element.querySelectorAll('.hiprint-smart-guide__label').length
    ).toBe(0)
    wrapper.unmount()
  })

  it('renders distinct label per axis with the kind attribute exposed', async () => {
    const { wrapper } = await mountWithPanel()
    setSmartGuidePreviews([
      { axis: 'h', pos: 10, kind: 'element-top' },
      { axis: 'v', pos: 20, kind: 'user-guide' },
    ])
    await nextTick()
    const wraps = wrapper.element.querySelectorAll('.hiprint-smart-guide')
    expect(wraps.length).toBe(2)
    // data-smart-guide-kind preserved (existing contract — TKT-103) so this
    // test also guards against the label patch breaking the prior selector.
    const kinds = Array.from(wraps).map((n) =>
      n.getAttribute('data-smart-guide-kind')
    )
    expect(kinds).toContain('element-top')
    expect(kinds).toContain('user-guide')
    wrapper.unmount()
  })

  it('non-finite preview position renders as "0" (defensive)', async () => {
    const { wrapper } = await mountWithPanel()
    setSmartGuidePreviews([
      { axis: 'h', pos: Number.NaN, kind: 'element-top' },
    ])
    await nextTick()
    const label = wrapper.element.querySelector(
      '.hiprint-smart-guide__label'
    ) as HTMLElement | null
    expect(label).not.toBeNull()
    // NaN/Infinity guard — V1 just bails on these so we mirror "0" as the
    // safest visible default rather than rendering "NaN".
    expect(label!.getAttribute('data-pt')).toBe('0')
    wrapper.unmount()
  })
})
