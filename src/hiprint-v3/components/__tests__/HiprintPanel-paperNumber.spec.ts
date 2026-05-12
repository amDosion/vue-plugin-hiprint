/**
 * HiprintPanel-paperNumber.spec.ts — TKT-153 paper page-number badge.
 *
 * V1 reference: `docs/V1-INVENTORY/interactions.md` §14.1 / §14.2 +
 * `docs/V1-INVENTORY/styles.md` §1.1 lines 32-33.
 *
 * Asserts:
 *  - Single panel → no badge (V1 only paints page numbers when multi-paper).
 *  - Multi panel → badge renders with 1-based index per paper.
 *  - readonly suppresses the badge (V1 isDesignMode gate, line 10912).
 *  - paperNumberDisabled flag adds the `.hiprint-paperNumber-disabled` class.
 *  - Badge has `pointer-events:none` semantics via CSS class (we assert class
 *    presence; CSS rule lives in <style scoped>).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HiprintPanel from '../HiprintPanel.vue'
import { useCanvasStore } from '@hiprint-v3/stores'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('HiprintPanel — TKT-153 paper page-number badge', () => {
  it('renders no badge when only one panel exists', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 100, height: 100 })
    const w = mount(HiprintPanel, { props: { panelId: 'p1' } })
    expect(w.element.querySelector('.hiprint-paperNumber')).toBeNull()
    w.unmount()
  })

  it('renders the 1-based index badge for each paper when multi-panel', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 100, height: 100 })
    canvas.addPanel({ id: 'p2', width: 100, height: 100 })
    canvas.addPanel({ id: 'p3', width: 100, height: 100 })

    const w1 = mount(HiprintPanel, { props: { panelId: 'p1' } })
    const w2 = mount(HiprintPanel, { props: { panelId: 'p2' } })
    const w3 = mount(HiprintPanel, { props: { panelId: 'p3' } })

    const badge1 = w1.element.querySelector('.hiprint-paperNumber') as HTMLElement | null
    const badge2 = w2.element.querySelector('.hiprint-paperNumber') as HTMLElement | null
    const badge3 = w3.element.querySelector('.hiprint-paperNumber') as HTMLElement | null

    expect(badge1).not.toBeNull()
    expect(badge1!.textContent?.trim()).toBe('1')
    expect(badge2).not.toBeNull()
    expect(badge2!.textContent?.trim()).toBe('2')
    expect(badge3).not.toBeNull()
    expect(badge3!.textContent?.trim()).toBe('3')

    w1.unmount()
    w2.unmount()
    w3.unmount()
  })

  it('readonly mode suppresses the badge even with multi-panel', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 100, height: 100 })
    canvas.addPanel({ id: 'p2', width: 100, height: 100 })
    const w = mount(HiprintPanel, { props: { panelId: 'p1', readonly: true } })
    expect(w.element.querySelector('.hiprint-paperNumber')).toBeNull()
    w.unmount()
  })

  it('paperNumberDisabled flag adds the disabled class hook', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 100, height: 100 })
    // Second panel triggers multi-panel rendering + injects the disabled flag
    // via the panel index signature (CanvasPanel keeps unknown keys).
    canvas.addPanel({
      id: 'p2',
      width: 100,
      height: 100,
      paperNumberDisabled: true,
    } as unknown as Parameters<typeof canvas.addPanel>[0])
    const w = mount(HiprintPanel, { props: { panelId: 'p2' } })
    const badge = w.element.querySelector('.hiprint-paperNumber') as HTMLElement
    expect(badge).not.toBeNull()
    expect(badge.classList.contains('hiprint-paperNumber-disabled')).toBe(true)
    w.unmount()
  })

  it('badge is aria-hidden + a child of the paper element', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 100, height: 100 })
    canvas.addPanel({ id: 'p2', width: 100, height: 100 })
    const w = mount(HiprintPanel, { props: { panelId: 'p1' } })
    const paper = w.element.querySelector('.hiprint-printPaper') as HTMLElement
    const badge = paper.querySelector('.hiprint-paperNumber') as HTMLElement
    expect(badge).not.toBeNull()
    expect(badge.getAttribute('aria-hidden')).toBe('true')
    w.unmount()
  })
})
