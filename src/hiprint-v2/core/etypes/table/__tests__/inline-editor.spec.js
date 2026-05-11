/**
 * inline-editor.spec.js — TextInlineEditor / SelectInlineEditor / TableColumnInlineEditor.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import jQuery from 'jquery'
import {
  TextInlineEditor,
  SelectInlineEditor,
  TableColumnInlineEditor,
  createEditor,
  createSelect,
} from '../inline-editor.js'
import { TableCell } from '../cell.js'

beforeAll(() => {
  window.$ = window.jQuery = jQuery
  globalThis.$ = jQuery
})

function mockCell(html = '<td id="hc">Name</td>') {
  document.body.innerHTML = '<table><tr>' + html + '</tr></table>'
  const $td = jQuery('#hc')
  const cell = new TableCell()
  // Bypass init() (which would trigger inner-element init for header) — we just
  // need a cell with .target / .id
  cell.target = $td
  cell.id = 'cell-1'
  cell.title = 'Name'
  cell.field = 'name'
  return cell
}

describe('createEditor / createSelect factory', () => {
  it('creates a TextInlineEditor for "text"', () => {
    expect(createEditor('text')).toBeInstanceOf(TextInlineEditor)
  })

  it('defaults to text when type omitted', () => {
    expect(createEditor()).toBeInstanceOf(TextInlineEditor)
  })

  it('createSelect returns SelectInlineEditor', () => {
    expect(createSelect()).toBeInstanceOf(SelectInlineEditor)
  })
})

describe('TextInlineEditor', () => {
  it('init attaches input to cell target', () => {
    const cell = mockCell()
    const ed = new TextInlineEditor()
    ed.init(cell)
    expect(cell.target.find('input').length).toBe(1)
  })

  it('setValue / getValue round-trip', () => {
    const cell = mockCell()
    const ed = new TextInlineEditor()
    ed.init(cell)
    ed.setValue('Hello')
    expect(ed.getValue()).toBe('Hello')
  })

  it('destroy removes the input', () => {
    const cell = mockCell()
    const ed = new TextInlineEditor()
    ed.init(cell)
    ed.destroy()
    expect(cell.target.find('input').length).toBe(0)
  })

  it('[R3 B9] setValue does NOT use .html — value is escaped on the way back via .text()', () => {
    // The input itself receives raw text in .val(); the safe path is on endEdit
    // → cell.target.text(value). Verify the .val() roundtrip preserves raw string.
    const cell = mockCell()
    const ed = new TextInlineEditor()
    ed.init(cell)
    ed.setValue('<script>x</script>')
    expect(ed.getValue()).toBe('<script>x</script>')
  })
})

describe('SelectInlineEditor', () => {
  it('init attaches <select> with provided fields', () => {
    const cell = mockCell()
    cell.innerElement = { field: 'name' }
    const ed = new SelectInlineEditor()
    ed.init(
      [
        { field: 'name', text: 'Name' },
        { field: 'age', text: 'Age' },
      ],
      cell
    )
    expect(cell.target.find('select').length).toBe(1)
    expect(cell.target.find('option').length).toBe(2)
  })

  it('getValue returns "text#field" format (V1 contract)', () => {
    const cell = mockCell()
    cell.innerElement = { field: 'name' }
    const ed = new SelectInlineEditor()
    ed.init([{ field: 'name', text: 'Name' }], cell)
    expect(ed.getValue()).toBe('Name#name')
  })

  it('setValue prepends missing option (V1 line 1712)', () => {
    const cell = mockCell()
    cell.innerElement = { field: '' }
    const ed = new SelectInlineEditor()
    ed.init([{ field: 'a', text: 'A' }], cell)
    ed.setValue('newField')
    expect(cell.target.find('option[value="newField"]').length).toBe(1)
  })

  it('option text is escaped via .text() (no innerHTML)', () => {
    const cell = mockCell()
    cell.innerElement = { field: '' }
    const ed = new SelectInlineEditor()
    ed.init([{ field: 'x', text: '<b>X</b>' }], cell)
    // <b> tag must be text-escaped within <option>
    expect(cell.target.find('option b').length).toBe(0)
    expect(cell.target.find('option').text()).toBe('<b>X</b>')
  })
})

describe('TableColumnInlineEditor — column header edit', () => {
  let cell, tableOptions

  beforeEach(() => {
    cell = mockCell()
    tableOptions = { options: {}, editingCell: null }
  })

  it('binds dblclick.hitable handler on init', () => {
    const inline = new TableColumnInlineEditor()
    inline.init(cell, tableOptions)
    // Manually trigger dblclick
    cell.target.trigger('dblclick.hitable')
    expect(cell.isEditing).toBe(true)
    expect(cell.target.find('input').length).toBe(1)
  })

  it('beginEdit (text path) loads current title into input', () => {
    const inline = new TableColumnInlineEditor()
    inline.init(cell, tableOptions)
    inline.beginEdit(cell)
    expect(cell.target.find('input').val()).toBe('Name')
  })

  it('beginEdit (isEnableEditField) shows "title#field" composite', () => {
    tableOptions.options.isEnableEditField = true
    const inline = new TableColumnInlineEditor()
    inline.init(cell, tableOptions)
    inline.beginEdit(cell)
    expect(cell.target.find('input').val()).toBe('Name#name')
  })

  it('beginEdit (fields supplied) uses select editor', () => {
    tableOptions.options.fields = [
      { field: 'name', text: 'Name' },
      { field: 'age', text: 'Age' },
    ]
    const inline = new TableColumnInlineEditor()
    inline.init(cell, tableOptions)
    inline.beginEdit(cell)
    expect(cell.target.find('select').length).toBe(1)
  })

  it('[R3 B9] endEdit writes title back via .text() — XSS safe', () => {
    const inline = new TableColumnInlineEditor()
    inline.init(cell, tableOptions)
    inline.beginEdit(cell)
    cell.target.find('input').val('<script>x</script>')
    inline.endEdit(cell)
    expect(cell.target.find('script').length).toBe(0)
    expect(cell.target.text()).toBe('<script>x</script>')
  })

  it('endEdit (isEnableEditField) splits title#field and updates attrs', () => {
    tableOptions.options.isEnableEditField = true
    const inline = new TableColumnInlineEditor()
    inline.init(cell, tableOptions)
    inline.beginEdit(cell)
    cell.target.find('input').val('NewName#newField')
    inline.endEdit(cell)
    expect(cell.title).toBe('NewName')
    expect(cell.field).toBe('newField')
    expect(cell.columnId).toBe('newField')
  })

  it('endEdit empty input → clear title (and field if isEnableEditField)', () => {
    tableOptions.options.isEnableEditField = true
    const inline = new TableColumnInlineEditor()
    inline.init(cell, tableOptions)
    inline.beginEdit(cell)
    cell.target.find('input').val('')
    inline.endEdit(cell)
    expect(cell.title).toBe('')
    expect(cell.field).toBe('')
  })

  it('[state-modeler] beginEdit terminates prior editingCell (cross-cell switch)', () => {
    // Mock a different cell currently editing
    document.body.innerHTML = '<table><tr><td id="prev">P</td><td id="hc">Name</td></tr></table>'
    const prevTd = jQuery('#prev')
    const prevCell = new TableCell()
    prevCell.target = prevTd
    prevCell.id = 'prev-cell'
    const prevInline = new TableColumnInlineEditor()
    let endCalled = false
    prevCell.innerElement = {
      endEdit() {
        endCalled = true
      },
    }
    tableOptions.editingCell = prevCell

    cell = mockCell() // resets DOM but tableOptions still pointed to (gone) prevCell — recreate
    // Re-create prev structure so target still resolvable (we just verify the endEdit call)
    cell.id = 'next-cell'

    const inline = new TableColumnInlineEditor()
    inline.init(cell, tableOptions)
    inline.beginEdit(cell)
    expect(endCalled).toBe(true)
    expect(tableOptions.editingCell).toBe(cell)
  })
})
