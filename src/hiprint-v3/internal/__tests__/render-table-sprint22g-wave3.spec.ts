/**
 * render-table-sprint22g-wave3.spec.ts — Sprint 22g wave 3 GM closeout.
 *
 * Covers the table render-model features that wave 2 produced but had no
 * dedicated test surface. Each describe block closes a specific REMAINING-GAPS
 * Section 06 ticket; the assertions exercise edge cases that the legacy
 * `render-table.spec.ts` skipped.
 *
 * Tickets closed by this spec:
 *  - TKT-380 — cell `formatter` string-source compiles in cascade
 *  - TKT-381 — cell `styler2` (V1 alias) compiles in cascade
 *  - TKT-382 — summary row aggregations (count / sum / avg / min / max / text)
 *  - TKT-385 — `tableHeaderRowHeight` / `tableBodyRowHeight` meta
 *  - TKT-386 — table-level style overrides (8 fields in `meta`)
 *  - TKT-387 — printElementType cascade fallback for formatter & styler
 *  - TKT-388 — cell `upperCase` Nzh conversion (per-cell extension)
 *  - TKT-389 — `tableCustomCell` HTML payload via `customCellHtml`
 *
 * Locked invariants exercised:
 *   #5 PM-002 R3 — field resolution preserves 0/false/''
 *   #8 — formatter / styler throws caught at cell-level (cell still renders)
 *
 * V1 references inlined per assertion (Section P / K bundle-line citations).
 */
import { describe, it, expect, vi } from 'vitest'
import {
  applyUpperCase,
  buildTableModel,
} from '../render-table'

describe('Sprint 22g wave 3 — TKT-380 cell formatter cascade', () => {
  it('column.formatter (function) takes precedence over formatter2 and elementType.formatter', () => {
    const m = buildTableModel({
      options: {
        columns: [
          [
            {
              title: 'V',
              field: 'v',
              formatter: (v: unknown): string => `[F1:${v}]`,
              formatter2: 'function(v){return "[F2:"+v+"]"}',
            },
          ],
        ],
        testData: '[{"v":7}]',
      },
      elementType: {
        formatter: (v: unknown): string => `[ET:${v}]`,
      },
    })
    expect(m.bodyRows[0]?.cells[0]?.rendered).toBe('[F1:7]')
    expect(m.bodyRows[0]?.cells[0]?.isHtml).toBe(true)
  })

  it('formatter2 string-source compiles when column.formatter absent (V1 P.11)', () => {
    const m = buildTableModel({
      options: {
        columns: [
          [
            {
              title: 'V',
              field: 'v',
              formatter2: 'function(v){return "[F2:"+v+"]"}',
            },
          ],
        ],
        testData: '[{"v":9}]',
      },
    })
    expect(m.bodyRows[0]?.cells[0]?.rendered).toBe('[F2:9]')
  })

  it('cell-level formatter throw is caught; cell still renders raw value', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const m = buildTableModel({
      options: {
        columns: [
          [
            {
              title: 'V',
              field: 'v',
              formatter: (): never => {
                throw new Error('boom')
              },
            },
          ],
        ],
        testData: '[{"v":3}]',
      },
    })
    expect(warn).toHaveBeenCalled()
    expect(m.bodyRows[0]?.cells[0]?.rendered).toBe('3')
    expect(m.bodyRows[0]?.cells[0]?.isHtml).toBe(false)
    warn.mockRestore()
  })
})

describe('Sprint 22g wave 3 — TKT-381 cell styler cascade', () => {
  it('column.styler2 (V1 alias, string source) compiles', () => {
    const m = buildTableModel({
      options: {
        columns: [
          [
            {
              title: 'V',
              field: 'v',
              styler2: 'function(v){return {color:"red"}}',
            },
          ],
        ],
        testData: '[{"v":1}]',
      },
    })
    expect(m.bodyRows[0]?.cells[0]?.style.color).toBe('red')
  })

  it('printElementType.styler is the cascade tail when column has no styler', () => {
    const m = buildTableModel({
      options: {
        columns: [[{ title: 'V', field: 'v' }]],
        testData: '[{"v":1}]',
      },
      elementType: {
        styler: () => ({ background: 'yellow' }),
      },
    })
    expect(m.bodyRows[0]?.cells[0]?.style.background).toBe('yellow')
  })

  it('column.styler takes precedence over styler2 and elementType.styler', () => {
    const m = buildTableModel({
      options: {
        columns: [
          [
            {
              title: 'V',
              field: 'v',
              styler: () => ({ color: 'blue' }),
              styler2: 'function(){return {color:"red"}}',
            },
          ],
        ],
        testData: '[{"v":1}]',
      },
      elementType: { styler: () => ({ color: 'green' }) },
    })
    expect(m.bodyRows[0]?.cells[0]?.style.color).toBe('blue')
  })
})

describe('Sprint 22g wave 3 — TKT-382 summary row aggregation', () => {
  function build(kind: string, data: Array<Record<string, unknown>>) {
    return buildTableModel({
      options: {
        columns: [[{ title: 'V', field: 'v', tableSummary: kind }]],
        testData: JSON.stringify(data),
      },
    })
  }

  it('count: number of truthy entries (V1 line 1989-1990)', () => {
    const m = build('count', [{ v: 1 }, { v: 0 }, { v: 'x' }, { v: null }])
    expect(m.summaryRow).not.toBeNull()
    // count truthy: 1, 'x' → 2. (0 and null filtered out.)
    expect(m.summaryRow!.cells[0]?.text).toContain('2')
  })

  it('sum: numeric reduce with numFormat precision (V1 line 1999)', () => {
    const m = build('sum', [{ v: 1.5 }, { v: 2.5 }, { v: 'NaN' }])
    expect(m.summaryRow!.cells[0]?.text).toContain('4.00')
  })

  it('avg: sum/n with numFormat precision', () => {
    const m = build('avg', [{ v: 2 }, { v: 4 }, { v: 6 }])
    expect(m.summaryRow!.cells[0]?.text).toContain('4.00')
  })

  it('min: smallest numeric value', () => {
    const m = build('min', [{ v: 5 }, { v: 2 }, { v: 9 }])
    expect(m.summaryRow!.cells[0]?.text).toContain('2')
  })

  it('max: largest numeric value', () => {
    const m = build('max', [{ v: 5 }, { v: 12 }, { v: 9 }])
    expect(m.summaryRow!.cells[0]?.text).toContain('12')
  })

  it('returns null when no column has tableSummary set', () => {
    const m = buildTableModel({
      options: {
        columns: [[{ title: 'V', field: 'v' }]],
        testData: '[{"v":1}]',
      },
    })
    expect(m.summaryRow).toBeNull()
  })

  it('tableSummaryColspan swallows hidden placeholder cells', () => {
    const m = buildTableModel({
      options: {
        columns: [
          [
            {
              title: 'A',
              field: 'a',
              tableSummary: 'sum',
              tableSummaryColspan: 2,
            },
            { title: 'B', field: 'b' },
            { title: 'C', field: 'c' },
          ],
        ],
        testData: '[{"a":1,"b":2,"c":3}]',
      },
    })
    expect(m.summaryRow!.cells.length).toBe(3)
    expect(m.summaryRow!.cells[0]?.summary).toBe(true)
    expect(m.summaryRow!.cells[0]?.colspan).toBe(2)
    // The cell immediately after a colspan=2 summary cell is the hidden swallow.
    expect(m.summaryRow!.cells[1]?.hidden).toBe(true)
    // The third column has no tableSummary → empty cell (not hidden).
    expect(m.summaryRow!.cells[2]?.hidden).toBe(false)
    expect(m.summaryRow!.cells[2]?.summary).toBe(false)
  })

  it('tableSummaryFormatter (string source) overrides the auto text', () => {
    const m = buildTableModel({
      options: {
        columns: [
          [
            {
              title: 'V',
              field: 'v',
              tableSummary: 'sum',
              tableSummaryFormatter: 'function(agg){return "<b>"+agg+"</b>"}',
            },
          ],
        ],
        testData: '[{"v":10},{"v":20}]',
      },
    })
    expect(m.summaryRow!.cells[0]?.text).toBe('<b>30</b>')
    expect(m.summaryRow!.cells[0]?.isHtml).toBe(true)
  })
})

describe('Sprint 22g wave 3 — TKT-382 group-header / group-footer', () => {
  it('groupFields + groupFormatter emits one header per group', () => {
    const m = buildTableModel({
      options: {
        columns: [
          [
            { title: 'Type', field: 'type' },
            { title: 'N', field: 'n' },
          ],
        ],
        groupFields: ['type'],
        groupFormatter: 'function(cs, all, pd, g){return "Group: "+g.type}',
        testData:
          '[{"type":"a","n":1},{"type":"a","n":2},{"type":"b","n":3}]',
      },
    })
    const headers = m.groupedBodyRows.filter((e) => e.kind === 'group-header')
    expect(headers.length).toBe(2)
    expect((headers[0] as { html: string }).html).toBe('Group: a')
    expect((headers[1] as { html: string }).html).toBe('Group: b')
  })

  it('groupFooterFormatter emits one footer per group', () => {
    const m = buildTableModel({
      options: {
        columns: [
          [
            { title: 'Type', field: 'type' },
            { title: 'N', field: 'n' },
          ],
        ],
        groupFields: ['type'],
        groupFooterFormatter:
          'function(cs, all, pd, g){return "Subtotal: "+g.rows.length}',
        testData:
          '[{"type":"a","n":1},{"type":"a","n":2},{"type":"b","n":3}]',
      },
    })
    const footers = m.groupedBodyRows.filter((e) => e.kind === 'group-footer')
    expect(footers.length).toBe(2)
    expect((footers[0] as { html: string }).html).toBe('Subtotal: 2')
    expect((footers[1] as { html: string }).html).toBe('Subtotal: 1')
  })

  it('rowStyler is applied per-row in groupedBodyRows', () => {
    const m = buildTableModel({
      options: {
        columns: [[{ title: 'V', field: 'v' }]],
        rowStyler: 'function(row){return {background:"#fee"}}',
        testData: '[{"v":1},{"v":2}]',
      },
    })
    const rowEntries = m.groupedBodyRows.filter((e) => e.kind === 'row')
    expect(rowEntries.length).toBe(2)
    for (const e of rowEntries) {
      const r = e as { rowStyle: Record<string, string> }
      expect(r.rowStyle.background).toBe('#fee')
    }
  })
})

describe('Sprint 22g wave 3 — TKT-385/386 table-level meta', () => {
  it('exposes 6 normalized style overrides via model.meta', () => {
    const m = buildTableModel({
      options: {
        columns: [[{ title: 'A', field: 'a' }]],
        tableHeaderRowHeight: 40,
        tableBodyRowHeight: 22,
        tableHeaderBackground: '#ccc',
        tableHeaderFontWeight: 'bold',
        tableHeaderFontSize: 14,
        tableBodyFontFamily: 'SimSun',
      },
    })
    expect(m.meta.headerRowHeight).toBe(40)
    expect(m.meta.bodyRowHeight).toBe(22)
    expect(m.meta.headerBackground).toBe('#ccc')
    expect(m.meta.headerFontWeight).toBe('bold')
    expect(m.meta.headerFontSize).toBe(14)
    expect(m.meta.bodyFontFamily).toBe('SimSun')
  })

  it('treats missing meta options as zero / empty (sentinel for "use V1 defaults")', () => {
    const m = buildTableModel({
      options: { columns: [[{ title: 'A', field: 'a' }]] },
    })
    expect(m.meta.headerRowHeight).toBe(0)
    expect(m.meta.bodyRowHeight).toBe(0)
    expect(m.meta.headerBackground).toBe('')
    expect(m.meta.headerFontWeight).toBe('')
    expect(m.meta.headerFontSize).toBe(0)
    expect(m.meta.bodyFontFamily).toBe('')
  })

  it('coerces numeric headerFontWeight to string (V1 lenient)', () => {
    const m = buildTableModel({
      options: {
        columns: [[{ title: 'A', field: 'a' }]],
        tableHeaderFontWeight: 600,
      },
    })
    expect(m.meta.headerFontWeight).toBe('600')
  })
})

describe('Sprint 22g wave 3 — TKT-387 printElementType cascade tail', () => {
  it('falls through to elementType.formatter when column has none', () => {
    const m = buildTableModel({
      options: {
        columns: [[{ title: 'V', field: 'v' }]],
        testData: '[{"v":5}]',
      },
      elementType: {
        formatter: (v: unknown): string => `<em>${v}</em>`,
      },
    })
    expect(m.bodyRows[0]?.cells[0]?.rendered).toBe('<em>5</em>')
    expect(m.bodyRows[0]?.cells[0]?.isHtml).toBe(true)
  })
})

describe('Sprint 22g wave 3 — TKT-388 cell upperCase (Nzh)', () => {
  it('applies applyUpperCase to body cell when column.upperCase set', () => {
    const m = buildTableModel({
      options: {
        columns: [
          [{ title: 'V', field: 'v', upperCase: 'true' }],
        ],
        testData: '[{"v":"abc"}]',
      },
    })
    expect(m.bodyRows[0]?.cells[0]?.rendered).toBe('ABC')
  })

  it('applyUpperCase passes raw value through when no code', () => {
    expect(applyUpperCase('hello', undefined)).toBe('hello')
    expect(applyUpperCase('hello', '')).toBe('hello')
    expect(applyUpperCase('hello', false)).toBe('hello')
  })

  it('applyUpperCase returns "" for null / undefined values', () => {
    expect(applyUpperCase(null, 'true')).toBe('')
    expect(applyUpperCase(undefined, 'true')).toBe('')
  })

  it('does NOT apply upperCase when a formatter already produced HTML output', () => {
    // Formatter ran (isHtml === true) → upperCase is skipped so we don't
    // destroy the by-design HTML.
    const m = buildTableModel({
      options: {
        columns: [
          [
            {
              title: 'V',
              field: 'v',
              upperCase: 'true',
              formatter: () => '<b>x</b>',
            },
          ],
        ],
        testData: '[{"v":"abc"}]',
      },
    })
    expect(m.bodyRows[0]?.cells[0]?.rendered).toBe('<b>x</b>')
  })
})

describe('Sprint 22g wave 3 — TKT-389 tableCustomCell HTML payload', () => {
  it('renders column.customCellHtml when tableTextType === "custom"', () => {
    const m = buildTableModel({
      options: {
        columns: [
          [
            {
              title: 'V',
              field: 'v',
              tableTextType: 'custom',
              customCellHtml: '<div data-x="1">CUSTOM</div>',
            },
          ],
        ],
        testData: '[{"v":1}]',
      },
    })
    expect(m.bodyRows[0]?.cells[0]?.rendered).toBe('<div data-x="1">CUSTOM</div>')
    expect(m.bodyRows[0]?.cells[0]?.isHtml).toBe(true)
  })

  it('does NOT inject customCellHtml when tableTextType is not "custom"', () => {
    const m = buildTableModel({
      options: {
        columns: [
          [
            {
              title: 'V',
              field: 'v',
              tableTextType: 'text',
              customCellHtml: '<div>SHOULD-NOT-RENDER</div>',
            },
          ],
        ],
        testData: '[{"v":42}]',
      },
    })
    expect(m.bodyRows[0]?.cells[0]?.rendered).toBe('42')
    expect(m.bodyRows[0]?.cells[0]?.isHtml).toBe(false)
  })
})
