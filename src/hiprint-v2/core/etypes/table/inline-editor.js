/**
 * inline-editor.js — In-place cell/column inline editors (V2).
 *
 * V1 source: bundle.js line 1656-1791.
 *  - text editor (i class line ~1656-1717): single-line <input>
 *  - select editor (i2 line 1683-1717): <select> for column field switching
 *  - editor factory (r class line 1731-1746): createEditor / createSelect
 *  - column inline editor (l class line 1750-1791): manages header cell editing,
 *    write-back to column.title + column.field via .text() (R3 B9)
 *
 * Invariants (V2 必须保留):
 *  - [R3 B9] endEdit writes title back to header <td> via .text() — XSS safe path
 *    (V1 line 1790 explicit comment).
 *  - All editor.setValue uses .val() (input element), .destroy uses .remove() —
 *    no innerHTML / .html() injection.
 *
 * jQuery requirement: window.$ available; this module manipulates <input>/<select> in DOM.
 */

import { safeCall } from '@hiprint-v2/internal'

// =========== Text Editor (V1 i class) ===========

/**
 * Single-line text editor — V1 i class (line ~1656-1717).
 */
export class TextInlineEditor {
  constructor() {
    this.target = undefined
    this.cell = undefined
  }

  /**
   * @param {TableCell} cell
   */
  init(cell) {
    this.cell = cell
    const $ = window.$
    this.target = $('<input type="text" class="hiprint-cell-editor" style="width:100%;height:100%;border:none;outline:none;background:transparent;font:inherit;color:inherit;text-align:inherit;" />')
    cell.getTarget().append(this.target)
    safeCall(() => this.target.focus(), [], 'TextInlineEditor.focus')
  }

  getValue() {
    return this.target ? this.target.val() : ''
  }

  setValue(v) {
    if (this.target) this.target.val(v == null ? '' : v)
  }

  destroy() {
    if (this.target) {
      try {
        this.target.remove()
      } catch (err) {
        console.error('[hiprint] TextInlineEditor.destroy failed:', err)
      }
      this.target = undefined
    }
  }
}

// =========== Select Editor (V1 i2 class) ===========

/**
 * Select editor — V1 i2 class. Used for column field switching when
 * tableOptions.options.fields is supplied.
 *
 * Value format: "text#field" (V1 line 1710), matching the column inline editor
 * round-trip contract.
 */
export class SelectInlineEditor {
  constructor() {
    this.target = undefined
  }

  /**
   * @param {Array<{field:string,text:string}>} fields  options.fields
   * @param {TableCell} cell  header cell to attach the editor to
   */
  init(fields, cell) {
    const $ = window.$
    const current = cell.innerElement && cell.innerElement.field
    // Build option HTML safely — fields are designer-config'd (not user input)
    // but still escape via .text() pattern by constructing element-by-element.
    const $select = $('<select class="hiprint-cell-select" style="width:100%;"></select>')
    ;(fields || []).forEach((f) => {
      const $opt = $('<option></option>')
        .attr('value', f.field == null ? '' : f.field)
        .text(f.text == null ? '' : f.text)
      if (f.field === current) $opt.attr('selected', 'selected')
      $select.append($opt)
    })
    this.target = $select
    cell.getTarget().append(this.target)
    // Ensure .val() reflects the selected attribute (jQuery + happy-dom edge)
    if (current != null) {
      try {
        this.target.val(current)
      } catch (_err) {
        /* ignore */
      }
    }
    safeCall(() => this.target.focus(), [], 'SelectInlineEditor.focus')
  }

  /**
   * Returns "text#field" — matches V1 contract (line 1709-1710).
   * @returns {string}
   */
  getValue() {
    if (!this.target) return ''
    const val = this.target.val()
    const text = this.target.find('option[value="' + val + '"]').text()
    return (text || '') + '#' + (val || '')
  }

  /**
   * Set selected field. If no matching option, prepends one (V1 line 1712).
   */
  setValue(field) {
    if (!this.target || field == null) return
    if (!this.target.find('option[value="' + field + '"]').length) {
      const $ = window.$
      const $opt = $('<option></option>').attr('value', field).text(field)
      this.target.prepend($opt)
    }
    this.target.val(field)
  }

  destroy() {
    if (this.target) {
      try {
        this.target.remove()
      } catch (err) {
        console.error('[hiprint] SelectInlineEditor.destroy failed:', err)
      }
      this.target = undefined
    }
  }
}

// =========== Factory (V1 r class) ===========

/**
 * Editor factory — V1 r class (line 1731-1746). V2 keeps a flat factory API.
 *
 * @param {string} type  'text' (default)
 * @returns {TextInlineEditor}
 */
export function createEditor(type) {
  if (type === 'text' || !type) return new TextInlineEditor()
  // V1 had 'date'/'select' too but only 'text' is shipped — fall back
  return new TextInlineEditor()
}

/**
 * Select-editor factory — V1 r.createSelect (line 1743).
 * @param {string} type  'select' (default)
 * @returns {SelectInlineEditor}
 */
export function createSelect(_type) {
  return new SelectInlineEditor()
}

// =========== Column Inline Editor (V1 l class) ===========

/**
 * Manages inline editing of a column header cell. Bound on dblclick.
 *
 * V1 l class (line 1750-1791): orchestrates select-vs-text editor choice and
 * writes user keystrokes back to column title + field with .text() — XSS safe.
 */
export class TableColumnInlineEditor {
  constructor() {
    this.title = ''
    this.field = ''
    this.editor = undefined
    this.tableOptions = undefined
  }

  /**
   * @param {TableCell} cell  header cell (TableHeaderCell)
   * @param {object} tableOptions
   */
  init(cell, tableOptions) {
    this.tableOptions = tableOptions
    this.title = cell.title
    this.field = cell.field
    const target = cell.getTarget()
    target.unbind('dblclick.hitable').bind('dblclick.hitable', () => {
      cell.isEditing = true
      this.beginEdit(cell)
    })
  }

  getDisplayHtml() {
    return this.title
  }

  /**
   * Begin editing — switches to select if options.fields supplied (column
   * picker), otherwise plain text.
   *
   * @param {TableCell} cell
   */
  beginEdit(cell) {
    const opts = (this.tableOptions && this.tableOptions.options) || {}
    if (opts.fields && opts.fields.length) {
      this.editor = createSelect('select')
      // [R3 B9] Use .empty() — semantically clear, no parsing
      cell.getTarget().empty()
      this.editor.init(opts.fields, cell)
      this.editor.setValue(this.field || '')
      const $ = window.$
      $(this.editor.target).on('keydown', (n) => {
        if (n.keyCode === 13) this.endEdit(cell)
      })
      $(this.editor.target).on('change', () => this.endEdit(cell))
      $(this.editor.target).on('blur', () => this.endEdit(cell))
    } else {
      this.editor = createEditor('text')
      cell.getTarget().empty()
      this.editor.init(cell)
      if (this.title || this.field) {
        if (opts.isEnableEditField) {
          this.editor.setValue((this.title || '') + '#' + (this.field || ''))
        } else {
          this.editor.setValue(this.title || '')
        }
      }
      const $ = window.$
      $(this.editor.target).on('keydown', (n) => {
        if (n.keyCode === 13) this.endEdit(cell)
      })
      $(this.editor.target).on('blur', () => this.endEdit(cell))
      // [state-modeler] tear down any prior editing cell before re-binding
      if (
        this.tableOptions &&
        this.tableOptions.editingCell &&
        this.tableOptions.editingCell.id !== cell.id &&
        this.tableOptions.editingCell.innerElement
      ) {
        try {
          this.tableOptions.editingCell.innerElement.endEdit(this.tableOptions.editingCell)
        } catch (err) {
          console.error('[hiprint] cross-cell endEdit failed:', err)
        }
      }
      this.tableOptions.editingCell = cell
    }
  }

  /**
   * Commit editing. Writes title back via .text() — XSS safe (V1 line 1790).
   *
   * @param {TableCell} cell
   */
  endEdit(cell) {
    cell.isEditing = false
    let editorValue = ''
    try {
      if (this.editor && typeof this.editor.getValue === 'function') {
        editorValue = this.editor.getValue()
      }
    } catch (err) {
      console.error('[hiprint] TableColumnInlineEditor.getValue failed:', err)
    }

    const opts = (this.tableOptions && this.tableOptions.options) || {}
    if (editorValue) {
      if (opts.isEnableEditField || opts.fields) {
        const parts = editorValue.split('#')
        cell.title = this.title = parts[0]
        if (parts.length > 0) {
          cell.columnId = cell.field = this.field = parts[1]
        }
        if (cell.id) cell.target.attr('id', cell.id)
        if (cell.columnId) cell.target.attr('column-id', cell.columnId)
      } else {
        cell.title = this.title = editorValue
      }
    } else {
      if (opts.isEnableEditField) {
        cell.title = this.title = ''
        cell.field = this.field = ''
      } else {
        cell.title = this.title = ''
      }
    }
    if (this.editor && typeof this.editor.destroy === 'function') {
      try {
        this.editor.destroy()
      } catch (err) {
        console.error('[hiprint] TableColumnInlineEditor editor destroy failed:', err)
      }
    }
    // [R3 B9] title 来自 user keystroke (input.val()), 写回 <td> via .text() 阻止 <script> 注入
    cell.target.text(this.title == null ? '' : this.title)
  }
}
