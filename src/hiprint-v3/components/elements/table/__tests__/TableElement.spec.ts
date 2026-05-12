/**
 * TableElement.spec.ts — orchestrator focused tests.
 *
 * Covers V3 collapse of V2's 4-file table module:
 *  - Simple data → renders <table> with header + body row count match.
 *  - Single-layer vs multi-layer columns both parsed.
 *  - testData JSON string parsed into rows.
 *  - Bound `props.data[field]` overrides testData.
 *  - rowsColumnsMerge applied → rowspan attribute on resulting cells.
 *  - gridColumnsFooter rendered in <tfoot>.
 *
 * Locked invariants verified:
 *  - Header titles + footer titles render via textContent (Invariant #1).
 *  - rowsColumnsMerge cell-level throw caught (Invariant #8).
 *  - evalCap caps formatter source strings (security).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useCanvasStore } from '@hiprint-v3/stores'
import TableElement from '../TableElement.vue'

/**
 * Helper to create a table element in the canvas store and return a mounted
 * `TableElement` bound to it.
 */
function mountTable(options: Record<string, unknown>, data?: Record<string, unknown>) {
  const canvas = useCanvasStore()
  const panel = canvas.addPanel({ width: 210, height: 297 })
  const el = canvas.addElement(panel.id, {
    tid: 'default.table',
    options,
    printElementType: { type: 'table' },
  })!
  const wrapper = mount(TableElement, {
    props: {
      elementId: el.id,
      panelId: panel.id,
      data,
      // Disable interactions so we don't pull in interact.js during tests.
      interactive: false,
    },
  })
  return { wrapper, canvas, panel, el }
}

describe('TableElement', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders <table> with header + body rows matching data length', () => {
    const { wrapper } = mountTable({
      columns: [
        [
          { title: 'Name', field: 'name' },
          { title: 'Qty', field: 'qty' },
        ],
      ],
      testData: '[{"name":"A","qty":1},{"name":"B","qty":2},{"name":"C","qty":3}]',
    })

    const table = wrapper.find('table.hiprint-printElement-tableTarget')
    expect(table.exists()).toBe(true)

    const headerCells = wrapper.findAll('thead th')
    expect(headerCells.length).toBe(2)
    expect(headerCells[0]?.text()).toBe('Name')
    expect(headerCells[1]?.text()).toBe('Qty')

    const bodyRows = wrapper.findAll('tbody tr')
    expect(bodyRows.length).toBe(3)
  })

  it('accepts both single-layer and multi-layer column shapes', () => {
    // Single-layer (no inner array)
    const { wrapper: w1 } = mountTable({
      columns: [{ title: 'A', field: 'a' }],
      testData: '[{"a":1}]',
    })
    expect(w1.findAll('thead th').length).toBe(1)

    // Multi-layer (Array<Array<...>>)
    const { wrapper: w2 } = mountTable({
      columns: [
        [{ title: 'Group', colspan: 2 }],
        [
          { title: 'A', field: 'a' },
          { title: 'B', field: 'b' },
        ],
      ],
      testData: '[{"a":1,"b":2}]',
    })
    expect(w2.findAll('thead tr').length).toBe(2)
    expect(w2.findAll('thead tr').at(1)?.findAll('th').length).toBe(2)
    const grouping = w2.find('thead tr th') // first th of first row
    expect(grouping.attributes('colspan')).toBe('2')
  })

  it('bound props.data[field] overrides testData', () => {
    const { wrapper } = mountTable(
      {
        field: 'rows',
        columns: [[{ title: 'Name', field: 'name' }]],
        testData: '[{"name":"fallback"}]',
      },
      { rows: [{ name: 'real-1' }, { name: 'real-2' }] }
    )
    const bodyCells = wrapper.findAll('tbody td')
    expect(bodyCells.length).toBe(2)
    expect(bodyCells[0]?.text()).toBe('real-1')
    expect(bodyCells[1]?.text()).toBe('real-2')
  })

  it('applies rowsColumnsMerge — rowspan attribute + display:none on hidden cell (V1 G.3)', () => {
    // Merge first column on rows 0/1 (rowspan=2 on row 0, hidden on row 1).
    const rowsColumnsMerge = function (
      _r: unknown,
      _c: unknown,
      colIdx: number,
      rowIdx: number
    ): [number, number] {
      if (colIdx === 0 && rowIdx === 0) return [2, 1]
      if (colIdx === 0 && rowIdx === 1) return [0, 1]
      return [1, 1]
    }
    const { wrapper } = mountTable({
      columns: [
        [
          { title: 'G', field: 'g' },
          { title: 'V', field: 'v' },
        ],
      ],
      testData: '[{"g":"x","v":1},{"g":"x","v":2}]',
      rowsColumnsMerge,
    })
    // Row 0 first cell has rowspan=2.
    const row0Cells = wrapper.findAll('tbody tr').at(0)?.findAll('td') ?? []
    const row1Cells = wrapper.findAll('tbody tr').at(1)?.findAll('td') ?? []
    expect(row0Cells.length).toBe(2)
    expect(row0Cells[0]?.attributes('rowspan')).toBe('2')
    // TKT-021: V1 G.3 — hidden merged cell stays in the DOM with display:none
    // (NOT omitted). cross-page fixMergeSpan relies on the slot.
    expect(row1Cells.length).toBe(2)
    const hiddenStyle = row1Cells[0]?.attributes('style') ?? ''
    expect(hiddenStyle.toLowerCase()).toContain('display: none')
    expect(row1Cells[1]?.text()).toBe('2')
  })

  it('rowsColumnsMerge throw is caught and falls back to [1,1] per cell', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const rowsColumnsMerge = (): never => {
      throw new Error('boom')
    }
    const { wrapper } = mountTable({
      columns: [[{ title: 'A', field: 'a' }]],
      testData: '[{"a":1},{"a":2}]',
      rowsColumnsMerge,
    })
    expect(err).toHaveBeenCalled()
    // Both rows still render normally with [1,1] fallback.
    expect(wrapper.findAll('tbody tr').length).toBe(2)
    err.mockRestore()
  })

  it('renders gridColumnsFooter rows in <tfoot>', () => {
    const { wrapper } = mountTable({
      columns: [[{ title: 'A', field: 'a' }]],
      testData: '[{"a":1}]',
      gridColumnsFooter: [
        [{ title: 'Total:', colspan: 1 }],
        [{ title: 'Notes:' }],
      ],
    })
    const tfoot = wrapper.find('tfoot')
    expect(tfoot.exists()).toBe(true)
    expect(tfoot.findAll('tr').length).toBe(2)
    expect(tfoot.findAll('tr').at(0)?.find('td').text()).toBe('Total:')
  })

  it('XSS: column.title with HTML renders as literal text (Invariant #1)', () => {
    const { wrapper } = mountTable({
      columns: [[{ title: '<script>alert(1)</script>', field: 'a' }]],
      testData: '[{"a":1}]',
    })
    const th = wrapper.find('thead th')
    expect(th.text()).toBe('<script>alert(1)</script>')
    expect(wrapper.find('script').exists()).toBe(false)
  })

  it('renders empty table when columns array empty', () => {
    const { wrapper } = mountTable({ columns: [], testData: '[{}]' })
    // Header layer is empty → no <th> rendered.
    expect(wrapper.findAll('thead th').length).toBe(0)
  })

  it('uses evalCap on string rowsColumnsMerge (does not invoke giant scripts)', async () => {
    // 6000-char body exceeds the 5000-char evalCap default. evalCap should
    // refuse → resulting fn is undefined → every cell gets [1,1].
    const huge = 'x'.repeat(6000)
    const src = `function(){ /* ${huge} */ return [1,1] }`
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { wrapper } = mountTable({
      columns: [[{ title: 'A', field: 'a' }]],
      testData: '[{"a":1},{"a":2}]',
      rowsColumnsMerge: src,
    })
    await flushPromises()
    // evalCap logs a warn; both rows still render normally.
    expect(warn).toHaveBeenCalled()
    expect(wrapper.findAll('tbody tr').length).toBe(2)
    warn.mockRestore()
  })
})
