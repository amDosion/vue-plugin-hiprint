/**
 * canvas.spec.ts — useCanvasStore actions + invariants.
 *
 * Covers:
 *  - addPanel / removePanel KEEP ≥ 1 INVARIANT #10 (state-modeler R3)
 *  - setActivePanel
 *  - selectElement (replace / add / toggle) + selectMultiple
 *  - addElement / removeElement / updateElement (immutable patch — element
 *    reference must change after patch so Vue reactivity diff fires)
 *  - moveSelection
 *  - setScale clamp
 *  - getters activePanel / selectedElements / panelCount
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCanvasStore } from '../canvas'

describe('useCanvasStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('addPanel', () => {
    it('adds a panel and sets it active when first', () => {
      const c = useCanvasStore()
      const p = c.addPanel({ width: 210, height: 297 })
      expect(c.panels.length).toBe(1)
      expect(c.activePanelId).toBe(p.id)
      expect(c.activePanel?.id).toBe(p.id)
    })

    it('does not change activePanelId when adding subsequent panels', () => {
      const c = useCanvasStore()
      const p1 = c.addPanel({ width: 210, height: 297 })
      c.addPanel({ width: 210, height: 297 })
      expect(c.activePanelId).toBe(p1.id)
      expect(c.panelCount).toBe(2)
    })

    it('auto-assigns id if missing', () => {
      const c = useCanvasStore()
      const p = c.addPanel({ width: 100, height: 100 })
      expect(typeof p.id).toBe('string')
      expect(p.id.length).toBeGreaterThan(0)
    })
  })

  describe('removePanel — Invariant #10 (KEEP ≥ 1)', () => {
    it('ignores removal of last panel + warns', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const c = useCanvasStore()
      const p = c.addPanel({ width: 210, height: 297 })
      c.removePanel(p.id)
      expect(c.panels.length).toBe(1)
      expect(warn).toHaveBeenCalled()
      warn.mockRestore()
    })

    it('removes a panel when ≥2 panels exist + re-indexes', () => {
      const c = useCanvasStore()
      const p1 = c.addPanel({ width: 210, height: 297 })
      const p2 = c.addPanel({ width: 210, height: 297 })
      c.removePanel(p1.id)
      expect(c.panels.length).toBe(1)
      expect(c.panels[0]?.id).toBe(p2.id)
      expect(c.panels[0]?.index).toBe(0)
    })

    it('re-selects adjacent panel when active panel removed', () => {
      const c = useCanvasStore()
      const p1 = c.addPanel({ width: 210, height: 297 })
      const p2 = c.addPanel({ width: 210, height: 297 })
      c.setActivePanel(p1.id)
      c.removePanel(p1.id)
      expect(c.activePanelId).toBe(p2.id)
    })
  })

  describe('setActivePanel', () => {
    it('switches active panel id', () => {
      const c = useCanvasStore()
      const p1 = c.addPanel({ width: 100, height: 100 })
      const p2 = c.addPanel({ width: 100, height: 100 })
      c.setActivePanel(p2.id)
      expect(c.activePanelId).toBe(p2.id)
      expect(c.activePanel?.id).toBe(p2.id)
      void p1
    })

    it('warns on unknown panel id', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const c = useCanvasStore()
      c.addPanel({ width: 100, height: 100 })
      c.setActivePanel('nonexistent')
      expect(warn).toHaveBeenCalled()
      warn.mockRestore()
    })
  })

  describe('addElement / removeElement', () => {
    it('adds element to panel + returns with generated id', () => {
      const c = useCanvasStore()
      const p = c.addPanel({ width: 210, height: 297 })
      const el = c.addElement(p.id, { tid: 'default.text', options: { left: 5 } })
      expect(el).not.toBeNull()
      expect(typeof el?.id).toBe('string')
      expect(c.panels[0]?.printElements.length).toBe(1)
    })

    it('removeElement drops element by id', () => {
      const c = useCanvasStore()
      const p = c.addPanel({ width: 210, height: 297 })
      const el = c.addElement(p.id, { tid: 'default.text' })
      c.removeElement(p.id, el!.id)
      expect(c.panels[0]?.printElements.length).toBe(0)
    })

    it('removeElement clears selection of removed id', () => {
      const c = useCanvasStore()
      const p = c.addPanel({ width: 210, height: 297 })
      const el = c.addElement(p.id, { tid: 'default.text' })!
      c.selectElement(el.id)
      c.removeElement(p.id, el.id)
      expect(c.selectedElementIds.has(el.id)).toBe(false)
    })

    it('addElement returns null + warns for unknown panelId', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const c = useCanvasStore()
      const out = c.addElement('nope', { tid: 'x' })
      expect(out).toBeNull()
      expect(warn).toHaveBeenCalled()
      warn.mockRestore()
    })
  })

  describe('reorderElement — TKT-101 element-list drag reorder', () => {
    it('reorders an element forward within its panel + preserves ids', () => {
      const c = useCanvasStore()
      const p = c.addPanel({ width: 210, height: 297 })
      const a = c.addElement(p.id, { tid: 'x', options: { title: 'A' } })!
      const b = c.addElement(p.id, { tid: 'x', options: { title: 'B' } })!
      const cc = c.addElement(p.id, { tid: 'x', options: { title: 'C' } })!
      c.reorderElement(p.id, 0, 2)
      const ids = c.panels[0]!.printElements.map((e) => e.id)
      expect(ids).toEqual([b.id, cc.id, a.id])
    })

    it('no-ops when fromIdx === toIdx (no array replacement)', () => {
      const c = useCanvasStore()
      const p = c.addPanel({ width: 210, height: 297 })
      c.addElement(p.id, { tid: 'x' })
      c.addElement(p.id, { tid: 'y' })
      const before = c.panels[0]!.printElements
      c.reorderElement(p.id, 1, 1)
      expect(c.panels[0]!.printElements).toBe(before)
    })

    it('no-ops on out-of-range indices', () => {
      const c = useCanvasStore()
      const p = c.addPanel({ width: 210, height: 297 })
      const a = c.addElement(p.id, { tid: 'x' })!
      const b = c.addElement(p.id, { tid: 'y' })!
      const before = c.panels[0]!.printElements
      c.reorderElement(p.id, -1, 0)
      c.reorderElement(p.id, 0, 99)
      c.reorderElement(p.id, 5, 1)
      expect(c.panels[0]!.printElements).toBe(before)
      // Identities untouched.
      expect(c.panels[0]!.printElements[0]?.id).toBe(a.id)
      expect(c.panels[0]!.printElements[1]?.id).toBe(b.id)
    })

    it('moves last element to first position (boundary reorder)', () => {
      const c = useCanvasStore()
      const p = c.addPanel({ width: 210, height: 297 })
      const a = c.addElement(p.id, { tid: 'x' })!
      const b = c.addElement(p.id, { tid: 'y' })!
      const cc = c.addElement(p.id, { tid: 'z' })!
      c.reorderElement(p.id, 2, 0)
      const ids = c.panels[0]!.printElements.map((e) => e.id)
      expect(ids).toEqual([cc.id, a.id, b.id])
    })

    it('no-ops + does not throw for unknown panel id', () => {
      const c = useCanvasStore()
      const p = c.addPanel({ width: 210, height: 297 })
      c.addElement(p.id, { tid: 'x' })
      c.addElement(p.id, { tid: 'y' })
      expect(() => c.reorderElement('nope', 0, 1)).not.toThrow()
      // Original panel untouched.
      expect(c.panels[0]!.printElements.length).toBe(2)
    })
  })

  describe('updateElement — immutable patch', () => {
    it('replaces element reference after patch (Vue reactivity)', () => {
      const c = useCanvasStore()
      const p = c.addPanel({ width: 210, height: 297 })
      const el = c.addElement(p.id, { tid: 'default.text', options: { left: 5 } })!
      const before = c.panels[0]!.printElements[0]
      c.updateElement(p.id, el.id, { options: { left: 25 } })
      const after = c.panels[0]!.printElements[0]
      expect(after).not.toBe(before)
      expect((after?.options as { left: number }).left).toBe(25)
    })

    it('merges options shallowly (preserves prior keys)', () => {
      const c = useCanvasStore()
      const p = c.addPanel({ width: 210, height: 297 })
      const el = c.addElement(p.id, {
        tid: 'default.text',
        options: { left: 5, top: 10 },
      })!
      c.updateElement(p.id, el.id, { options: { left: 99 } })
      const opts = c.panels[0]!.printElements[0]!.options as Record<string, unknown>
      expect(opts.left).toBe(99)
      expect(opts.top).toBe(10)
    })

    it('id never patched even if patch attempts to', () => {
      const c = useCanvasStore()
      const p = c.addPanel({ width: 210, height: 297 })
      const el = c.addElement(p.id, { tid: 'default.text' })!
      const origId = el.id
      c.updateElement(p.id, el.id, { id: 'spoofed-id' } as Partial<typeof el>)
      expect(c.panels[0]!.printElements[0]!.id).toBe(origId)
    })
  })

  describe('selection actions', () => {
    it('selectElement replace mode replaces selection', () => {
      const c = useCanvasStore()
      const p = c.addPanel({ width: 210, height: 297 })
      const a = c.addElement(p.id, { tid: 'x' })!
      const b = c.addElement(p.id, { tid: 'y' })!
      c.selectElement(a.id)
      c.selectElement(b.id)
      expect(c.selectedElementIds.has(a.id)).toBe(false)
      expect(c.selectedElementIds.has(b.id)).toBe(true)
      expect(c.selectedElementIds.size).toBe(1)
    })

    it('selectElement add mode appends to selection', () => {
      const c = useCanvasStore()
      const p = c.addPanel({ width: 210, height: 297 })
      const a = c.addElement(p.id, { tid: 'x' })!
      const b = c.addElement(p.id, { tid: 'y' })!
      c.selectElement(a.id)
      c.selectElement(b.id, 'add')
      expect(c.selectedElementIds.size).toBe(2)
    })

    it('selectElement toggle flips presence', () => {
      const c = useCanvasStore()
      const p = c.addPanel({ width: 210, height: 297 })
      const a = c.addElement(p.id, { tid: 'x' })!
      c.selectElement(a.id, 'toggle')
      expect(c.selectedElementIds.has(a.id)).toBe(true)
      c.selectElement(a.id, 'toggle')
      expect(c.selectedElementIds.has(a.id)).toBe(false)
    })

    it('selectMultiple sets selection to given ids', () => {
      const c = useCanvasStore()
      const p = c.addPanel({ width: 210, height: 297 })
      const a = c.addElement(p.id, { tid: 'x' })!
      const b = c.addElement(p.id, { tid: 'y' })!
      c.selectMultiple([a.id, b.id])
      expect(c.selectedElementIds.size).toBe(2)
    })

    it('selectedElements getter returns reactive list', () => {
      const c = useCanvasStore()
      const p = c.addPanel({ width: 210, height: 297 })
      const a = c.addElement(p.id, { tid: 'x' })!
      c.selectElement(a.id)
      expect(c.selectedElements.length).toBe(1)
      expect(c.selectedElements[0]?.id).toBe(a.id)
    })

    it('clearSelection empties set', () => {
      const c = useCanvasStore()
      const p = c.addPanel({ width: 210, height: 297 })
      const a = c.addElement(p.id, { tid: 'x' })!
      c.selectElement(a.id)
      c.clearSelection()
      expect(c.selectedElementIds.size).toBe(0)
    })
  })

  describe('moveSelection', () => {
    it('translates selected elements by (dx, dy)', () => {
      const c = useCanvasStore()
      const p = c.addPanel({ width: 210, height: 297 })
      const a = c.addElement(p.id, { tid: 'x', options: { left: 10, top: 20 } })!
      c.selectElement(a.id)
      c.moveSelection(5, 7)
      const opts = c.panels[0]!.printElements[0]!.options as Record<string, unknown>
      expect(opts.left).toBe(15)
      expect(opts.top).toBe(27)
    })

    it('no-ops when nothing selected', () => {
      const c = useCanvasStore()
      const p = c.addPanel({ width: 210, height: 297 })
      const a = c.addElement(p.id, { tid: 'x', options: { left: 10 } })!
      c.moveSelection(100, 100)
      const opts = c.panels[0]!.printElements[0]!.options as Record<string, unknown>
      expect(opts.left).toBe(10)
      void a
    })
  })

  describe('setScale', () => {
    it('clamps to [0.1, 5]', () => {
      const c = useCanvasStore()
      c.setScale(10)
      expect(c.scale).toBe(5)
      c.setScale(0.01)
      expect(c.scale).toBe(0.1)
      c.setScale(1.5)
      expect(c.scale).toBe(1.5)
    })

    it('warns + ignores non-finite', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const c = useCanvasStore()
      c.setScale(Number.NaN)
      expect(c.scale).toBe(1)
      expect(warn).toHaveBeenCalled()
      warn.mockRestore()
    })
  })

  describe('panelCount getter', () => {
    it('reflects panel length', () => {
      const c = useCanvasStore()
      expect(c.panelCount).toBe(0)
      c.addPanel({ width: 100, height: 100 })
      c.addPanel({ width: 100, height: 100 })
      expect(c.panelCount).toBe(2)
    })
  })
})
