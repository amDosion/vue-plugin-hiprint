/**
 * useHiprintCanvas.spec.ts — composable surface + reactivity.
 *
 * Verifies the composable exposes the same semantics as the underlying store
 * (panels reactive on add/remove, selection actions, dirty boundary).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useHiprintCanvas } from '../useHiprintCanvas'
import { useCanvasStore } from '../../stores'

describe('useHiprintCanvas', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('panels is reactive on addPanel', () => {
    const c = useHiprintCanvas()
    expect(c.panels.value.length).toBe(0)
    const p = c.addPanel({ width: 210, height: 297 })
    expect(c.panels.value.length).toBe(1)
    expect(c.activePanel.value?.id).toBe(p.id)
  })

  it('panels reflects removePanel after multi-panel setup', () => {
    const c = useHiprintCanvas()
    c.addPanel({ width: 210, height: 297 })
    const p2 = c.addPanel({ width: 100, height: 100 })
    expect(c.panels.value.length).toBe(2)
    c.removePanel(p2.id)
    expect(c.panels.value.length).toBe(1)
  })

  it('selectElement + clearSelection reflect through selectedElements computed', () => {
    const c = useHiprintCanvas()
    const p = c.addPanel({ width: 210, height: 297 })
    const el = c.addElement(p.id, { tid: 'defaultModule.text' })
    expect(el).not.toBeNull()
    c.selectElement(el!.id)
    expect(c.selectedElements.value.length).toBe(1)
    expect(c.selectedElements.value[0]?.id).toBe(el!.id)
    c.clearSelection()
    expect(c.selectedElements.value.length).toBe(0)
  })

  it('selectMultiple replaces selection', () => {
    const c = useHiprintCanvas()
    const p = c.addPanel({ width: 210, height: 297 })
    const e1 = c.addElement(p.id, { tid: 'defaultModule.text' })!
    const e2 = c.addElement(p.id, { tid: 'defaultModule.text' })!
    c.selectMultiple([e1.id, e2.id])
    expect(c.selectedElements.value.length).toBe(2)
  })

  it('setScale clamps to [0.1, 5] and rejects non-finite values', () => {
    const c = useHiprintCanvas()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    c.setScale(10)
    expect(c.scale.value).toBe(5)
    c.setScale(0.01)
    expect(c.scale.value).toBe(0.1)
    c.setScale(NaN)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('moveElementBetweenPanels relocates an element id', () => {
    const c = useHiprintCanvas()
    const p1 = c.addPanel({ width: 100, height: 100 })
    const p2 = c.addPanel({ width: 100, height: 100 })
    const el = c.addElement(p1.id, { tid: 'defaultModule.text' })!
    const moved = c.moveElementBetweenPanels(p1.id, p2.id, el.id)
    expect(moved?.id).toBe(el.id)
    expect(c.panels.value[0]?.printElements.length).toBe(0)
    expect(c.panels.value[1]?.printElements.length).toBe(1)
  })

  it('shares state with useCanvasStore (same Pinia instance)', () => {
    const c = useHiprintCanvas()
    const store = useCanvasStore()
    c.addPanel({ width: 210, height: 297 })
    expect(store.panels.length).toBe(1)
  })
})
