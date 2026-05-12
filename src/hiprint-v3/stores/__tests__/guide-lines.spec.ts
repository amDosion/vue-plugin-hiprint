/**
 * guide-lines.spec.ts — TKT-102 user-drawn guide-line store actions.
 *
 * Covers the four mutation actions on useCanvasStore for guide lines:
 *  - addGuideLine returns a new GuideLine with stable id + correct axis/pos
 *  - removeGuideLine drops a guide by id (no-op for unknown id)
 *  - updateGuideLine moves a guide along its axis (immutable patch)
 *  - clearGuideLines empties the list
 *  - addGuideLine rejects non-finite pos (warn + sentinel return)
 *  - updateGuideLine rejects non-finite pos (warn + no-op)
 *  - $reset clears guideLines (consistency with other state).
 *
 * V1 reference: bundle.js .hiprint-ruler-guide-line nodes
 * (docs/V1-INVENTORY/interactions.md §17).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCanvasStore } from '../canvas'

describe('useCanvasStore — guide lines (TKT-102)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('addGuideLine', () => {
    it('returns a new GuideLine with crypto id, correct axis, and pos', () => {
      const c = useCanvasStore()
      const g = c.addGuideLine('h', 50)
      expect(typeof g.id).toBe('string')
      expect(g.id.length).toBeGreaterThan(0)
      expect(g.axis).toBe('h')
      expect(g.pos).toBe(50)
    })

    it('appends to guideLines array (preserves prior entries)', () => {
      const c = useCanvasStore()
      c.addGuideLine('h', 10)
      c.addGuideLine('v', 20)
      expect(c.guideLines.length).toBe(2)
      expect(c.guideLines[0]!.axis).toBe('h')
      expect(c.guideLines[1]!.axis).toBe('v')
    })

    it('replaces array reference (Vue reactivity diff)', () => {
      const c = useCanvasStore()
      const before = c.guideLines
      c.addGuideLine('h', 5)
      const after = c.guideLines
      expect(after).not.toBe(before)
    })

    it('generates unique ids per call', () => {
      const c = useCanvasStore()
      const a = c.addGuideLine('h', 10)
      const b = c.addGuideLine('h', 10)
      expect(a.id).not.toBe(b.id)
    })

    it('rejects non-finite pos with warn + sentinel result', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const c = useCanvasStore()
      const g = c.addGuideLine('h', Number.NaN)
      expect(g.id).toBe('') // sentinel
      expect(c.guideLines.length).toBe(0)
      expect(warn).toHaveBeenCalled()
      warn.mockRestore()
    })

    it('rejects Infinity pos', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const c = useCanvasStore()
      const g = c.addGuideLine('v', Number.POSITIVE_INFINITY)
      expect(g.id).toBe('')
      expect(c.guideLines.length).toBe(0)
      warn.mockRestore()
    })
  })

  describe('removeGuideLine', () => {
    it('drops the guide line matching id', () => {
      const c = useCanvasStore()
      const a = c.addGuideLine('h', 10)
      const b = c.addGuideLine('v', 20)
      c.removeGuideLine(a.id)
      expect(c.guideLines.length).toBe(1)
      expect(c.guideLines[0]!.id).toBe(b.id)
    })

    it('is silent (no warn) for unknown id', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const c = useCanvasStore()
      c.addGuideLine('h', 10)
      c.removeGuideLine('nope')
      expect(c.guideLines.length).toBe(1)
      expect(warn).not.toHaveBeenCalled()
      warn.mockRestore()
    })

    it('replaces array reference on successful remove', () => {
      const c = useCanvasStore()
      const a = c.addGuideLine('h', 10)
      const before = c.guideLines
      c.removeGuideLine(a.id)
      expect(c.guideLines).not.toBe(before)
    })

    it('does NOT replace array reference when id unknown (perf)', () => {
      const c = useCanvasStore()
      c.addGuideLine('h', 10)
      const before = c.guideLines
      c.removeGuideLine('unknown')
      expect(c.guideLines).toBe(before)
    })
  })

  describe('updateGuideLine', () => {
    it('changes position of an existing guide', () => {
      const c = useCanvasStore()
      const g = c.addGuideLine('h', 50)
      c.updateGuideLine(g.id, 99)
      expect(c.guideLines[0]!.pos).toBe(99)
    })

    it('preserves id + axis on update', () => {
      const c = useCanvasStore()
      const g = c.addGuideLine('v', 50)
      c.updateGuideLine(g.id, 100)
      expect(c.guideLines[0]!.id).toBe(g.id)
      expect(c.guideLines[0]!.axis).toBe('v')
    })

    it('immutable patch: array entry reference changes', () => {
      const c = useCanvasStore()
      const g = c.addGuideLine('h', 50)
      const before = c.guideLines[0]
      c.updateGuideLine(g.id, 99)
      const after = c.guideLines[0]
      expect(after).not.toBe(before)
    })

    it('silently no-ops for unknown id', () => {
      const c = useCanvasStore()
      const g = c.addGuideLine('h', 50)
      c.updateGuideLine('nope', 999)
      expect(c.guideLines[0]!.pos).toBe(50)
    })

    it('rejects non-finite pos with warn', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const c = useCanvasStore()
      const g = c.addGuideLine('h', 10)
      c.updateGuideLine(g.id, Number.NaN)
      expect(c.guideLines[0]!.pos).toBe(10)
      expect(warn).toHaveBeenCalled()
      warn.mockRestore()
    })
  })

  describe('clearGuideLines', () => {
    it('empties the guideLines array', () => {
      const c = useCanvasStore()
      c.addGuideLine('h', 10)
      c.addGuideLine('v', 20)
      c.clearGuideLines()
      expect(c.guideLines.length).toBe(0)
    })

    it('no-op (does not replace ref) when already empty', () => {
      const c = useCanvasStore()
      const before = c.guideLines
      c.clearGuideLines()
      expect(c.guideLines).toBe(before)
    })
  })

  describe('$reset', () => {
    it('clears guideLines along with other state', () => {
      const c = useCanvasStore()
      c.addGuideLine('h', 10)
      c.addGuideLine('v', 20)
      c.$reset()
      expect(c.guideLines.length).toBe(0)
    })
  })
})
