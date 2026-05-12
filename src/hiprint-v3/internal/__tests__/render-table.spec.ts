/**
 * render-table.spec.ts — TKT-021 Sprint 22b convergence helper tests.
 *
 * Covers the pure table model builder shared by TableElement.vue and
 * print/render.ts. Test fixtures drawn from V1-INVENTORY/etypes/table.md
 * Sections C/D/F/G/K.
 *
 * Locked invariants exercised:
 *  - Field resolution: flat key first (V1 line 2138-2139), dot-path fallback
 *    (V3 extension).
 *  - Multi-layer header colspan/rowspan splat + field inheritance.
 *  - rowsColumnsMerge: cell-level throw caught (Invariant #8); 0-span =
 *    hidden true.
 *  - footerFormatter string-source compile path (compileFormatter).
 *  - testData JSON malformed → console.error + fallback (V1 F.4).
 *  - rowsFallbackPlaceholder: `[{}]` design-time preview (V1 F.1).
 */
import { describe, it, expect, vi } from 'vitest'
import {
  buildTableModel,
  resolveCellValue,
  applyCellFormatter,
} from '../render-table'

describe('resolveCellValue (TKT-021 / V1 F.2 + V3 extension)', () => {
  it('returns flat key first (V1 line 2138-2139)', () => {
    expect(resolveCellValue({ name: 'Alice' }, 'name')).toBe('Alice')
  })

  it('preserves 0 / false / "" (PM-002 R3)', () => {
    expect(resolveCellValue({ qty: 0 }, 'qty')).toBe(0)
    expect(resolveCellValue({ ok: false }, 'ok')).toBe(false)
    expect(resolveCellValue({ note: '' }, 'note')).toBe('')
  })

  it('returns empty string for missing key', () => {
    expect(resolveCellValue({ name: 'Alice' }, 'missing')).toBe('')
  })

  it('falls back to dot-path ONLY when flat key is undefined AND field contains dot', () => {
    // V3 extension: dot-path fallback for nested data.
    const row = { user: { name: 'Bob' } }
    expect(resolveCellValue(row, 'user.name')).toBe('Bob')
  })

  it('prefers single-key match even when field has a dot (V1 fidelity)', () => {
    // V1 design: column.field is a single-level key. If a row legitimately has
    // a key that happens to contain a dot (rare but legal), single-key wins.
    const row = { 'user.name': 'Literal', user: { name: 'Nested' } }
    expect(resolveCellValue(row, 'user.name')).toBe('Literal')
  })

  it('returns empty string for null / undefined / non-object row', () => {
    expect(resolveCellValue(null, 'name')).toBe('')
    expect(resolveCellValue(undefined, 'name')).toBe('')
    expect(resolveCellValue('not-an-object', 'name')).toBe('')
  })

  it('returns empty string for empty / nullish field', () => {
    expect(resolveCellValue({ name: 'A' }, '')).toBe('')
    expect(resolveCellValue({ name: 'A' }, null)).toBe('')
    expect(resolveCellValue({ name: 'A' }, undefined)).toBe('')
  })
})

describe('applyCellFormatter (V1 P.11 string-source path)', () => {
  it('returns coerced raw value when no formatter', () => {
    const out = applyCellFormatter(42, undefined, [])
    expect(out).toEqual({ rendered: '42', isHtml: false })
  })

  it('invokes function formatter with provided args', () => {
    const fn = (v: unknown): string => `[${v}]`
    const out = applyCellFormatter(7, fn, [7, { id: 1 }])
    expect(out.rendered).toBe('[7]')
    expect(out.isHtml).toBe(true)
  })

  it('compiles string-source formatter via compileFormatter (V1 P.11)', () => {
    const src = 'function(v) { return "<b>" + v + "</b>"; }'
    const out = applyCellFormatter('X', src, ['X'])
    expect(out.rendered).toBe('<b>X</b>')
    expect(out.isHtml).toBe(true)
  })

  it('falls back to raw value when formatter throws (Invariant #8)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fn = (): never => {
      throw new Error('boom')
    }
    const out = applyCellFormatter('hello', fn, [])
    expect(out.rendered).toBe('hello')
    expect(out.isHtml).toBe(false)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('renders null formatter output as empty string with isHtml=true', () => {
    const fn = (): null => null
    const out = applyCellFormatter('any', fn, [])
    expect(out.rendered).toBe('')
    expect(out.isHtml).toBe(true)
  })
})

describe('buildTableModel — header layers (V1 D test fixtures)', () => {
  it('normalizes 1-D columns to single header layer', () => {
    const m = buildTableModel({
      options: {
        columns: [{ title: 'A', field: 'a' }],
      },
    })
    expect(m.theadRows).toHaveLength(1)
    expect(m.theadRows[0]?.length).toBe(1)
    expect(m.theadRows[0]?.[0]?.title).toBe('A')
    expect(m.leafColumns).toHaveLength(1)
  })

  it('preserves 2-D columns as multiple header layers', () => {
    const m = buildTableModel({
      options: {
        columns: [
          [{ title: 'Group', colspan: 2 }],
          [
            { title: 'A', field: 'a' },
            { title: 'B', field: 'b' },
          ],
        ],
      },
    })
    expect(m.theadRows).toHaveLength(2)
    expect(m.theadRows[0]?.[0]?.colspan).toBe(2)
    expect(m.theadRows[1]?.length).toBe(2)
    expect(m.leafColumns).toHaveLength(2)
  })

  it('inherits field from upper layer when leaf cell has none (V1 line 2405-2422)', () => {
    const m = buildTableModel({
      options: {
        columns: [
          [{ title: 'Outer', field: 'outer-field' }],
          [{ title: 'InnerNoField' }],
        ],
        testData: '[{"outer-field":"X"}]',
      },
    })
    expect(m.leafColumns[0]?.field).toBe('outer-field')
    expect(m.bodyRows[0]?.cells[0]?.value).toBe('X')
    expect(m.bodyRows[0]?.cells[0]?.rendered).toBe('X')
  })

  it('preserves colspan/rowspan attributes on header cells (>1 only)', () => {
    const m = buildTableModel({
      options: {
        columns: [
          [
            { title: 'X', colspan: 3, rowspan: 1 },
            { title: 'Y', colspan: 1, rowspan: 2 },
          ],
        ],
      },
    })
    expect(m.theadRows[0]?.[0]?.colspan).toBe(3)
    expect(m.theadRows[0]?.[0]?.rowspan).toBeUndefined()
    expect(m.theadRows[0]?.[1]?.colspan).toBeUndefined()
    expect(m.theadRows[0]?.[1]?.rowspan).toBe(2)
  })

  it('returns empty thead when columns option absent', () => {
    const m = buildTableModel({ options: {} })
    expect(m.theadRows).toEqual([])
    expect(m.bodyRows).toEqual([])
  })
})

describe('buildTableModel — body rows', () => {
  it('binds data[options.field] (V1 F.1, dot-split safe)', () => {
    const m = buildTableModel({
      options: { columns: [[{ title: 'N', field: 'n' }]], field: 'rows' },
      data: { rows: [{ n: 1 }, { n: 2 }] },
    })
    expect(m.bodyRows).toHaveLength(2)
    expect(m.bodyRows[0]?.cells[0]?.value).toBe(1)
  })

  it('falls back to testData JSON string', () => {
    const m = buildTableModel({
      options: {
        columns: [[{ title: 'N', field: 'n' }]],
        testData: '[{"n":10}]',
      },
    })
    expect(m.bodyRows).toHaveLength(1)
    expect(m.bodyRows[0]?.cells[0]?.value).toBe(10)
  })

  it('falls back to testData array literal', () => {
    const m = buildTableModel({
      options: {
        columns: [[{ title: 'N', field: 'n' }]],
        testData: [{ n: 99 }],
      },
    })
    expect(m.bodyRows).toHaveLength(1)
    expect(m.bodyRows[0]?.cells[0]?.value).toBe(99)
  })

  it('returns [] when no data + no testData (default fallback)', () => {
    const m = buildTableModel({
      options: { columns: [[{ title: 'N', field: 'n' }]] },
    })
    expect(m.bodyRows).toEqual([])
  })

  it('returns [{}] preview row when rowsFallbackPlaceholder: true (V1 F.1)', () => {
    const m = buildTableModel({
      options: { columns: [[{ title: 'N', field: 'n' }]] },
      rowsFallbackPlaceholder: true,
    })
    expect(m.bodyRows).toHaveLength(1)
    expect(m.bodyRows[0]?.cells[0]?.value).toBe('') // missing field on {} → ''
  })

  it('falls back to [{}] when testData JSON parse fails AND rowsFallbackPlaceholder: true', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const m = buildTableModel({
      options: {
        columns: [[{ title: 'N', field: 'n' }]],
        testData: '{broken json}',
      },
      rowsFallbackPlaceholder: true,
    })
    expect(err).toHaveBeenCalled()
    expect(m.bodyRows).toHaveLength(1)
    err.mockRestore()
  })
})

describe('buildTableModel — rowsColumnsMerge (V1 G fixtures)', () => {
  it('applies per-cell rowspan/colspan returned by merge function', () => {
    const merge = (
      _row: unknown,
      _col: unknown,
      cIdx: number,
      rIdx: number
    ): [number, number] => {
      if (cIdx === 0 && rIdx === 0) return [2, 1]
      if (cIdx === 0 && rIdx === 1) return [0, 1]
      return [1, 1]
    }
    const m = buildTableModel({
      options: {
        columns: [
          [
            { title: 'G', field: 'g' },
            { title: 'V', field: 'v' },
          ],
        ],
        testData: '[{"g":"x","v":1},{"g":"x","v":2}]',
      },
      rowsColumnsMerge: merge,
    })
    expect(m.bodyRows[0]?.cells[0]?.rowspan).toBe(2)
    expect(m.bodyRows[0]?.cells[0]?.hidden).toBe(false)
    // V1 G.3 — rowspan=0 means hidden (display:none), not omitted.
    expect(m.bodyRows[1]?.cells[0]?.rowspan).toBe(0)
    expect(m.bodyRows[1]?.cells[0]?.hidden).toBe(true)
  })

  it('catches cell-level merge throw (Invariant #8); falls back to [1,1]', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const merge = (): never => {
      throw new Error('boom')
    }
    const m = buildTableModel({
      options: {
        columns: [[{ title: 'A', field: 'a' }]],
        testData: '[{"a":1},{"a":2}]',
      },
      rowsColumnsMerge: merge,
    })
    expect(err).toHaveBeenCalled()
    // Both rows still render with [1,1].
    expect(m.bodyRows).toHaveLength(2)
    expect(m.bodyRows[0]?.cells[0]?.rowspan).toBe(1)
    expect(m.bodyRows[0]?.cells[0]?.colspan).toBe(1)
    expect(m.bodyRows[0]?.cells[0]?.hidden).toBe(false)
    err.mockRestore()
  })

  it('handles merge returning non-array (degrades to [1,1])', () => {
    const merge = (): unknown => 'not-an-array'
    const m = buildTableModel({
      options: {
        columns: [[{ title: 'A', field: 'a' }]],
        testData: '[{"a":1}]',
      },
      rowsColumnsMerge: merge,
    })
    expect(m.bodyRows[0]?.cells[0]?.rowspan).toBe(1)
  })
})

describe('buildTableModel — footerFormatter (V1 K.1)', () => {
  it('compiles string-source footerFormatter via compileFormatter', () => {
    const m = buildTableModel({
      options: {
        columns: [[{ title: 'A', field: 'a' }]],
        testData: '[{"a":1},{"a":2}]',
        footerFormatter:
          'function(opts, all) { return "<div>total " + all.length + "</div>"; }',
      },
    })
    expect(m.footerHtml).toBe('<div>total 2</div>')
  })

  it('accepts function-form footerFormatter', () => {
    const m = buildTableModel({
      options: {
        columns: [[{ title: 'A', field: 'a' }]],
        testData: '[{"a":1}]',
        footerFormatter: () => '<em>x</em>',
      },
    })
    expect(m.footerHtml).toBe('<em>x</em>')
  })

  it('returns empty string when footerFormatter absent', () => {
    const m = buildTableModel({
      options: { columns: [[{ title: 'A', field: 'a' }]] },
    })
    expect(m.footerHtml).toBe('')
  })

  it('catches footerFormatter throw (Invariant #8); returns empty', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const m = buildTableModel({
      options: {
        columns: [[{ title: 'A', field: 'a' }]],
        footerFormatter: () => {
          throw new Error('boom')
        },
      },
    })
    expect(warn).toHaveBeenCalled()
    expect(m.footerHtml).toBe('')
    warn.mockRestore()
  })
})

describe('buildTableModel — gridColumnsFooter', () => {
  it('builds Array<Array<{title,colspan?,text?}>> into footerRows', () => {
    const m = buildTableModel({
      options: {
        columns: [[{ title: 'A', field: 'a' }]],
        gridColumnsFooter: [
          [{ title: 'Total:', colspan: 2 }],
          [{ text: 'Notes' }],
        ],
      },
    })
    expect(m.footerRows).toHaveLength(2)
    expect(m.footerRows[0]?.cells[0]?.text).toBe('Total:')
    expect(m.footerRows[0]?.cells[0]?.colspan).toBe(2)
    expect(m.footerRows[1]?.cells[0]?.text).toBe('Notes')
    expect(m.footerRows[1]?.cells[0]?.colspan).toBeUndefined()
  })

  it('ignores non-array footer rows defensively', () => {
    const m = buildTableModel({
      options: {
        columns: [[{ title: 'A', field: 'a' }]],
        gridColumnsFooter: [null, [{ title: 'OK' }], 'bad'] as unknown,
      },
    })
    expect(m.footerRows).toHaveLength(1)
    expect(m.footerRows[0]?.cells[0]?.text).toBe('OK')
  })
})

describe('buildTableModel — border classes (V3-PARITY 12.14)', () => {
  it('maps tableBorder to V1 CSS class suffix', () => {
    const variants = ['all', 'none', 'lr', 'tb', 'lt', 'rt', 'lb', 'rb']
    for (const v of variants) {
      const m = buildTableModel({
        options: { columns: [[{ title: 'A', field: 'a' }]], tableBorder: v },
      })
      expect(m.borderClass).toBe(`hiprint-printElement-tableTarget-border-${v}`)
    }
  })

  it('returns empty borderClass when tableBorder absent or invalid', () => {
    expect(
      buildTableModel({ options: { columns: [[{}]] } }).borderClass
    ).toBe('')
    expect(
      buildTableModel({
        options: { columns: [[{}]], tableBorder: 'invalid' },
      }).borderClass
    ).toBe('')
  })
})

describe('buildTableModel — styler', () => {
  it('applies styler returning a class string', () => {
    const styler = (): string => 'hot-row'
    const m = buildTableModel({
      options: {
        columns: [[{ title: 'A', field: 'a', styler }]],
        testData: '[{"a":1}]',
      },
    })
    expect(m.bodyRows[0]?.cells[0]?.classNames).toContain('hot-row')
  })

  it('applies styler returning an object with css props', () => {
    const styler = (): { color: string; class: string } => ({
      color: 'red',
      class: 'highlight',
    })
    const m = buildTableModel({
      options: {
        columns: [[{ title: 'A', field: 'a', styler }]],
        testData: '[{"a":1}]',
      },
    })
    expect(m.bodyRows[0]?.cells[0]?.classNames).toContain('highlight')
    expect(m.bodyRows[0]?.cells[0]?.style.color).toBe('red')
  })

  it('catches styler throw (Invariant #8); cell still renders', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const styler = (): never => {
      throw new Error('boom')
    }
    const m = buildTableModel({
      options: {
        columns: [[{ title: 'A', field: 'a', styler }]],
        testData: '[{"a":1}]',
      },
    })
    expect(warn).toHaveBeenCalled()
    expect(m.bodyRows[0]?.cells[0]?.rendered).toBe('1')
    warn.mockRestore()
  })
})

describe('buildTableModel — exposes rows (TKT-021 Vue consumer)', () => {
  it('returns the same row objects (reference identity) used by bodyRows', () => {
    const data = { rows: [{ n: 1 }, { n: 2 }] }
    const m = buildTableModel({
      options: { columns: [[{ title: 'N', field: 'n' }]], field: 'rows' },
      data,
    })
    expect(m.rows).toEqual([{ n: 1 }, { n: 2 }])
    expect(m.rows[0]).toBe(data.rows[0])
  })
})
