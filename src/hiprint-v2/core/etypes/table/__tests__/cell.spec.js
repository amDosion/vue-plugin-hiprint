/**
 * cell.spec.js — TableCell + TableHeaderCell + inline edit (R3 B9).
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import jQuery from 'jquery'
import { TableCell, TableHeaderCell, TableColumnEntity, _resetCellIdCounter } from '../cell.js'

beforeAll(() => {
  window.$ = window.jQuery = jQuery
  globalThis.$ = jQuery
})

beforeEach(() => {
  document.body.innerHTML = '<table><tbody><tr><td id="t1" rowspan="2" colspan="3">hi</td></tr></tbody></table>'
})

describe('TableColumnEntity (V1 u class)', () => {
  it('serializes provided fields', () => {
    const e = new TableColumnEntity({
      title: 'A',
      field: 'a',
      width: 100,
      colspan: 2,
      rowspan: 1,
      formatter: () => 'F',
    })
    expect(e.title).toBe('A')
    expect(e.field).toBe('a')
    expect(e.width).toBe(100)
    expect(e.colspan).toBe(2)
  })

  it('captures function-form formatter / styler via toString()', () => {
    const fn = function () {
      return 'X'
    }
    const e = new TableColumnEntity({ formatter2: fn })
    expect(typeof e.formatter2).toBe('string')
    expect(e.formatter2).toContain('return')
  })

  it('defaults to empty when arg omitted', () => {
    const e = new TableColumnEntity()
    expect(e.title).toBeUndefined()
  })
})

describe('TableCell init (V1 d class)', () => {
  it('parses rowspan/colspan from attributes', () => {
    const $td = jQuery('#t1')
    const cell = new TableCell()
    cell.init($td, { isEnableEdit: true, options: {} }, 'r1', true)
    expect(cell.colspan).toBe(3)
    expect(cell.rowspan).toBe(2)
    expect(cell.isHead).toBe(true)
  })

  it('falls back to 1 for non-numeric span', () => {
    document.body.innerHTML = '<table><tr><td id="t2" colspan="abc">hi</td></tr></table>'
    const $td = jQuery('#t2')
    const cell = new TableCell()
    cell.init($td, { isEnableEdit: true, options: {} }, 'r1', false)
    expect(cell.colspan).toBe(1)
  })

  it('generates unique ids', () => {
    _resetCellIdCounter()
    const a = new TableCell()
    const b = new TableCell()
    expect(a.id).not.toBe(b.id)
  })
})

describe('TableCell beginEdit/endEdit (R3 B9 XSS safe)', () => {
  let cell, opts, $td
  beforeEach(() => {
    document.body.innerHTML = '<table><tr><td id="tc">hello</td></tr></table>'
    $td = jQuery('#tc')
    opts = { isEnableEdit: true, options: {}, onBeforEdit: () => true, editingCell: null }
    cell = new TableCell()
    cell.init($td, opts, 'r1', false)
  })

  it('beginEdit empties cell and attaches text editor', () => {
    cell.beginEdit()
    expect(cell.isEditing).toBe(true)
    expect($td.find('input').length).toBe(1)
    expect(opts.editingCell).toBe(cell)
  })

  it('beginEdit aborts when onBeforEdit returns false', () => {
    opts.onBeforEdit = () => false
    cell.beginEdit()
    expect(cell.isEditing).toBe(false)
  })

  it('[R3 B9] endEdit writes user input back via .text() (XSS safe)', () => {
    cell.beginEdit()
    const $input = $td.find('input')
    $input.val('<script>alert(1)</script>')
    cell.endEdit()
    expect(cell.isEditing).toBe(false)
    // Script tag must be text-escaped, not a real DOM node
    expect($td.find('script').length).toBe(0)
    expect($td.text()).toBe('<script>alert(1)</script>')
  })

  it('[R3 B9] getValue reads textContent (aligned with .text() write)', () => {
    cell.target.text('<b>raw</b>')
    expect(cell.getValue()).toBe('<b>raw</b>')
  })

  it('[state-modeler R3] endEdit clears editingCell pointer when self matches', () => {
    cell.beginEdit()
    cell.endEdit()
    expect(opts.editingCell).toBeNull()
  })

  it('beginEdit aborts when isEnableEdit is false', () => {
    opts.isEnableEdit = false
    cell.beginEdit()
    expect(cell.isEditing).toBe(false)
  })

  it('endEdit idempotent: 2nd call does not throw', () => {
    cell.beginEdit()
    cell.endEdit()
    // 2nd call with no editor — graceful no-op
    expect(() => cell.endEdit()).not.toThrow()
  })
})

describe('TableCell geometry helpers', () => {
  let cell, $td
  beforeEach(() => {
    document.body.innerHTML = '<table style="position:absolute;top:0;left:0"><tr><td id="g1">x</td></tr></table>'
    $td = jQuery('#g1')
    cell = new TableCell()
    cell.init($td, { isEnableEdit: true, options: {} }, 'r1', false)
  })

  it('getTableRect returns offset + size', () => {
    const r = cell.getTableRect()
    expect(typeof r.x).toBe('number')
    expect(typeof r.y).toBe('number')
  })

  it('select toggles css class', () => {
    expect(cell.isSelected()).toBe(false)
    cell.select()
    expect(cell.isSelected()).toBe(true)
  })

  it('setAlign / setVAlign apply CSS', () => {
    cell.setAlign('center')
    expect($td.css('text-align')).toBe('center')
    cell.setVAlign('top')
    expect($td.css('vertical-align')).toBe('top')
  })

  it('isHeader returns false on base cell', () => {
    expect(cell.isHeader()).toBe(false)
  })

  it('getEntity returns TableColumnEntity copy', () => {
    cell.title = 'T'
    cell.field = 'f'
    const entity = cell.getEntity()
    expect(entity).toBeInstanceOf(TableColumnEntity)
    expect(entity.title).toBe('T')
  })
})

describe('TableHeaderCell', () => {
  it('parses numeric width/rowspan/colspan from string', () => {
    const h = new TableHeaderCell({ width: '120.5', rowspan: '2', colspan: '3' })
    expect(h.width).toBe(120.5)
    expect(h.rowspan).toBe(2)
    expect(h.colspan).toBe(3)
  })

  it('defaults checked=true unless explicit false', () => {
    expect(new TableHeaderCell({}).checked).toBe(true)
    expect(new TableHeaderCell({ checked: false }).checked).toBe(false)
  })

  it('columnId defaults to field when not set', () => {
    const h = new TableHeaderCell({ field: 'name' })
    expect(h.columnId).toBe('name')
  })
})
