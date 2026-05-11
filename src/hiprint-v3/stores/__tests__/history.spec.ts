/**
 * history.spec.ts — useHistoryStore undo / redo cycle + capacity.
 *
 * History stores deep-cloned snapshots of canvas.panels. Undo / redo restore
 * the panel array; selection is cleared on restore (matches V1/V2 behavior).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCanvasStore } from '../canvas'
import { useHistoryStore } from '../history'

describe('useHistoryStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initial canUndo / canRedo are false', () => {
    const h = useHistoryStore()
    expect(h.canUndo).toBe(false)
    expect(h.canRedo).toBe(false)
  })

  it('pushSnapshot then undo restores previous panels', () => {
    const c = useCanvasStore()
    const h = useHistoryStore()
    h.pushSnapshot() // baseline (empty)
    const p = c.addPanel({ width: 210, height: 297 })
    h.pushSnapshot() // after add
    expect(c.panels.length).toBe(1)
    h.undo()
    expect(c.panels.length).toBe(0)
    void p
  })

  it('redo re-applies the undone change', () => {
    const c = useCanvasStore()
    const h = useHistoryStore()
    h.pushSnapshot()
    c.addPanel({ width: 210, height: 297 })
    h.pushSnapshot()
    h.undo()
    expect(c.panels.length).toBe(0)
    h.redo()
    expect(c.panels.length).toBe(1)
  })

  it('canUndo flag transitions correctly across push/undo', () => {
    const c = useCanvasStore()
    const h = useHistoryStore()
    expect(h.canUndo).toBe(false)
    h.pushSnapshot() // first commit pushes initial source into undoStack
    c.addPanel({ width: 210, height: 297 })
    h.pushSnapshot()
    expect(h.canUndo).toBe(true)
    h.undo()
    expect(h.canRedo).toBe(true)
  })

  it('clear() empties history (canUndo/canRedo false)', () => {
    const c = useCanvasStore()
    const h = useHistoryStore()
    h.pushSnapshot()
    c.addPanel({ width: 210, height: 297 })
    h.pushSnapshot()
    h.clear()
    expect(h.canUndo).toBe(false)
    expect(h.canRedo).toBe(false)
  })

  it('undo with no history is a safe no-op', () => {
    const h = useHistoryStore()
    expect(() => h.undo()).not.toThrow()
  })

  it('redo with no future is a safe no-op', () => {
    const h = useHistoryStore()
    h.pushSnapshot()
    expect(() => h.redo()).not.toThrow()
  })

  it('setCapacity rejects non-positive values + warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const h = useHistoryStore()
    h.setCapacity(0)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('setCapacity adjusts cap (positive value accepted)', () => {
    const h = useHistoryStore()
    h.setCapacity(10)
    expect(h.capacity).toBe(10)
  })

  it('snapshot is deep-cloned (mutating canvas does not change history)', () => {
    const c = useCanvasStore()
    const h = useHistoryStore()
    c.addPanel({ width: 210, height: 297 })
    h.pushSnapshot()
    const entriesBefore = h.historyEntries.length
    // mutate canvas — should not retroactively affect history snapshot panels
    c.addPanel({ width: 210, height: 297 })
    expect(h.historyEntries.length).toBe(entriesBefore)
    const firstSnapshot = h.historyEntries[h.historyEntries.length - 1]
    expect(firstSnapshot?.panels.length).toBeLessThanOrEqual(1)
  })
})
