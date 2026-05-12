/**
 * canvas-table-ops.spec.ts — TKT-107 (Sprint 22c Stream CE) store helpers.
 *
 * Covers `stores/table-ops.ts` — column-level mutations that the right-click
 * context menu (interactions/context-menu.ts) and the property panel both
 * delegate to. Each helper must:
 *   - Mutate `options.columns` immutably (new outer + new inner arrays).
 *   - Push a history snapshot for undo/redo.
 *   - No-op + warn on invalid indices (Invariant #8).
 *
 * Tests run against a real Pinia store (no mocks) so the immutable-patch +
 * history-push contract is exercised end-to-end.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import {
  useCanvasStore,
  useHistoryStore,
  insertTableColumn,
  removeTableColumn,
  setTableColspan,
  setTableRowspan,
  addTableHeaderLayer,
  removeTableHeaderLayer,
} from '@hiprint-v3/stores'

beforeEach(() => {
  setActivePinia(createPinia())
})

interface ColRow extends Record<string, unknown> {
  title?: string
  field?: string
  colspan?: number
  rowspan?: number
}

function seedTable(
  columns: Array<Array<ColRow>> | Array<ColRow>
): {
  canvas: ReturnType<typeof useCanvasStore>
  history: ReturnType<typeof useHistoryStore>
  getColumns: () => Array<Array<ColRow>>
} {
  const canvas = useCanvasStore()
  const history = useHistoryStore()
  canvas.addPanel({ id: 'p1', width: 400, height: 300 })
  canvas.addElement('p1', {
    id: 'e1',
    tid: 'default.table',
    options: {
      left: 10,
      top: 20,
      width: 300,
      height: 150,
      columns,
    },
  })
  // Initial snapshot so undo has somewhere to roll back to.
  history.pushSnapshot()
  const getColumns = (): Array<Array<ColRow>> => {
    const el = canvas.panels[0]!.printElements.find((e) => e.id === 'e1')!
    const c = (el.options as Record<string, unknown>).columns
    if (!Array.isArray(c)) return [[]]
    if (Array.isArray(c[0])) return c as Array<Array<ColRow>>
    return [c as Array<ColRow>]
  }
  return { canvas, history, getColumns }
}

// ============ insertTableColumn ============

describe('insertTableColumn', () => {
  it('inserts to the right of the target column', () => {
    const { getColumns, history } = seedTable([
      [
        { title: 'A', field: 'a' },
        { title: 'B', field: 'b' },
      ],
    ])
    insertTableColumn('e1', 0, 0, 'right')
    const cols = getColumns()
    expect(cols[0]!.length).toBe(3)
    // New col is at index 1; original A stays at 0, B at 2.
    expect(cols[0]![0]!.title).toBe('A')
    expect(cols[0]![2]!.title).toBe('B')
    // History pushed.
    expect(history.canUndo).toBe(true)
  })

  it('inserts to the left of the target column', () => {
    const { getColumns } = seedTable([
      [
        { title: 'A', field: 'a' },
        { title: 'B', field: 'b' },
      ],
    ])
    insertTableColumn('e1', 0, 1, 'left')
    const cols = getColumns()
    expect(cols[0]!.length).toBe(3)
    // New col goes at index 1; original B moves to 2.
    expect(cols[0]![0]!.title).toBe('A')
    expect(cols[0]![2]!.title).toBe('B')
  })

  it('auto-names new column with unused colN', () => {
    const { getColumns } = seedTable([
      [
        { title: 'A', field: 'col1' },
        { title: 'B', field: 'col2' },
      ],
    ])
    insertTableColumn('e1', 0, 1, 'right')
    const cols = getColumns()
    expect(cols[0]!.length).toBe(3)
    // Auto-name skips col1/col2 → col3.
    expect(cols[0]![2]!.field).toBe('col3')
    expect(cols[0]![2]!.title).toBe('col3')
  })

  it('no-op + warn on out-of-bounds layerIdx', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { getColumns } = seedTable([[{ title: 'A', field: 'a' }]])
    insertTableColumn('e1', 99, 0, 'right')
    expect(getColumns()[0]!.length).toBe(1) // unchanged
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('no-op + warn on unknown elementId', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    seedTable([[{ title: 'A', field: 'a' }]])
    insertTableColumn('nonexistent', 0, 0, 'right')
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('pushes a history snapshot on success (undo restores)', () => {
    const { getColumns, history } = seedTable([
      [{ title: 'A', field: 'a' }],
    ])
    insertTableColumn('e1', 0, 0, 'right')
    expect(getColumns()[0]!.length).toBe(2)
    history.undo()
    expect(getColumns()[0]!.length).toBe(1)
  })
})

// ============ removeTableColumn ============

describe('removeTableColumn', () => {
  it('drops the column at the given index', () => {
    const { getColumns } = seedTable([
      [
        { title: 'A', field: 'a' },
        { title: 'B', field: 'b' },
        { title: 'C', field: 'c' },
      ],
    ])
    removeTableColumn('e1', 0, 1)
    const cols = getColumns()
    expect(cols[0]!.length).toBe(2)
    expect(cols[0]!.map((c) => c.title)).toEqual(['A', 'C'])
  })

  it('refuses to drop the last column in the leaf layer (V1 7257 guard)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { getColumns } = seedTable([[{ title: 'A', field: 'a' }]])
    removeTableColumn('e1', 0, 0)
    expect(getColumns()[0]!.length).toBe(1) // unchanged
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('allows trimming non-leaf layer down to a single column', () => {
    const { getColumns } = seedTable([
      [{ title: 'Group A' }, { title: 'Group B' }],
      [
        { title: 'A1', field: 'a1' },
        { title: 'A2', field: 'a2' },
      ],
    ])
    // Layer 0 is non-leaf, has 2 columns → trimming to 1 is allowed.
    removeTableColumn('e1', 0, 0)
    const cols = getColumns()
    expect(cols[0]!.length).toBe(1)
    expect(cols[0]![0]!.title).toBe('Group B')
    // Leaf layer untouched.
    expect(cols[1]!.length).toBe(2)
  })

  it('pushes a history snapshot on success', () => {
    const { getColumns, history } = seedTable([
      [
        { title: 'A', field: 'a' },
        { title: 'B', field: 'b' },
      ],
    ])
    removeTableColumn('e1', 0, 0)
    expect(getColumns()[0]!.length).toBe(1)
    history.undo()
    expect(getColumns()[0]!.length).toBe(2)
  })
})

// ============ setTableColspan / setTableRowspan ============

describe('setTableColspan', () => {
  it('writes colspan on the target cell', () => {
    const { getColumns } = seedTable([
      [
        { title: 'A', field: 'a' },
        { title: 'B', field: 'b' },
      ],
    ])
    setTableColspan('e1', 0, 0, 2)
    expect(getColumns()[0]![0]!.colspan).toBe(2)
    // Untouched cell stays as-is.
    expect(getColumns()[0]![1]!.colspan).toBeUndefined()
  })

  it('clamps non-finite or < 1 to 1', () => {
    const { getColumns } = seedTable([
      [{ title: 'A', field: 'a' }],
    ])
    setTableColspan('e1', 0, 0, 0)
    expect(getColumns()[0]![0]!.colspan).toBe(1)
    setTableColspan('e1', 0, 0, -5)
    expect(getColumns()[0]![0]!.colspan).toBe(1)
    setTableColspan('e1', 0, 0, NaN)
    expect(getColumns()[0]![0]!.colspan).toBe(1)
  })

  it('pushes a history snapshot on success', () => {
    const { getColumns, history } = seedTable([
      [{ title: 'A', field: 'a' }],
    ])
    setTableColspan('e1', 0, 0, 3)
    expect(getColumns()[0]![0]!.colspan).toBe(3)
    history.undo()
    expect(getColumns()[0]![0]!.colspan).toBeUndefined()
  })
})

describe('setTableRowspan', () => {
  it('writes rowspan on the target cell', () => {
    const { getColumns } = seedTable([
      [{ title: 'A', field: 'a' }],
    ])
    setTableRowspan('e1', 0, 0, 4)
    expect(getColumns()[0]![0]!.rowspan).toBe(4)
  })

  it('clamps non-finite to 1', () => {
    const { getColumns } = seedTable([
      [{ title: 'A', field: 'a' }],
    ])
    setTableRowspan('e1', 0, 0, Infinity)
    expect(getColumns()[0]![0]!.rowspan).toBe(1)
  })

  it('pushes a history snapshot on success', () => {
    const { getColumns, history } = seedTable([
      [{ title: 'A', field: 'a' }],
    ])
    setTableRowspan('e1', 0, 0, 2)
    history.undo()
    expect(getColumns()[0]![0]!.rowspan).toBeUndefined()
  })
})

// ============ Header layer helpers ============

describe('addTableHeaderLayer / removeTableHeaderLayer', () => {
  it('addTableHeaderLayer appends a layer at the bottom', () => {
    const { getColumns } = seedTable([
      [
        { title: 'A', field: 'a' },
        { title: 'B', field: 'b' },
      ],
    ])
    addTableHeaderLayer('e1')
    const cols = getColumns()
    expect(cols.length).toBe(2)
    // New layer mirrors previous bottom column count.
    expect(cols[1]!.length).toBe(2)
  })

  it('removeTableHeaderLayer drops layer at index', () => {
    const { getColumns } = seedTable([
      [{ title: 'Top' }],
      [{ title: 'Mid' }],
      [{ title: 'Leaf', field: 'l' }],
    ])
    removeTableHeaderLayer('e1', 1)
    const cols = getColumns()
    expect(cols.length).toBe(2)
    expect(cols[0]![0]!.title).toBe('Top')
    expect(cols[1]![0]!.title).toBe('Leaf')
  })

  it('removeTableHeaderLayer refuses to drop the last layer', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { getColumns } = seedTable([
      [{ title: 'A', field: 'a' }],
    ])
    removeTableHeaderLayer('e1', 0)
    expect(getColumns().length).toBe(1)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('addTableHeaderLayer pushes a history snapshot', () => {
    const { getColumns, history } = seedTable([
      [{ title: 'A', field: 'a' }],
    ])
    addTableHeaderLayer('e1')
    expect(getColumns().length).toBe(2)
    history.undo()
    expect(getColumns().length).toBe(1)
  })
})

// ============ Immutability ============

describe('table-ops — immutability', () => {
  it('insertTableColumn produces a new element reference (Vue reactivity)', () => {
    const { canvas } = seedTable([
      [{ title: 'A', field: 'a' }],
    ])
    const before = canvas.panels[0]!.printElements[0]
    insertTableColumn('e1', 0, 0, 'right')
    const after = canvas.panels[0]!.printElements[0]
    expect(after).not.toBe(before)
  })

  it('setTableColspan produces a new columns array (history snapshot safe)', () => {
    const { canvas } = seedTable([
      [{ title: 'A', field: 'a' }],
    ])
    const beforeCols = (
      canvas.panels[0]!.printElements[0]!.options as Record<string, unknown>
    ).columns
    setTableColspan('e1', 0, 0, 2)
    const afterCols = (
      canvas.panels[0]!.printElements[0]!.options as Record<string, unknown>
    ).columns
    expect(afterCols).not.toBe(beforeCols)
  })
})
