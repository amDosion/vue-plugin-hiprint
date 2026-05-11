/**
 * cell.js — Table cell models (V2).
 *
 * V1 source: bundle.js line 1793-1908.
 *  - u (line 1793-1796): ColumnEntity (serializable shape)
 *  - d (line 1798-1875): TableCell with beginEdit/endEdit/getValue/setValue
 *  - f (line 1899-1908): TableHeaderColumn extends TableCell (for header columns)
 *
 * Invariants (V2 必须保留):
 *  - [R3 B9] beginEdit empties cell DOM via .empty() (safer than .html("")), endEdit
 *    writes user input back via .text() (XSS safe — V1 line 1815/1821 explicit).
 *  - [R3 B9] getValue reads target.text() (not innerHTML) — aligned with the .text()
 *    write in endEdit. Round-trip 一致性。
 *  - [state-modeler] endEdit clears tableOptions.editingCell when self matches —
 *    防止跨 cell beginEdit 拿到 stale stale completed cell (V1 line 1822-1823).
 *
 * Editor primitives (V1 i2 / o2 / r factory at line 1718-1746) are extracted to
 * inline-editor.js since they are shared by both cell editing and column header
 * editing.
 */

import { coerceText } from '@hiprint-v2/internal'
import { TableColumnInlineEditor, createEditor } from './inline-editor.js'

let _idCounter = 0
function nextCellId() {
  // V1: s.a.createId() — monotonically increasing; V2 mirrors w/ local counter
  _idCounter += 1
  return 'tcell_' + _idCounter
}

/**
 * Plain-data shape for cell serialization. V1 u class (line 1793-1796).
 */
export class TableColumnEntity {
  constructor(t) {
    if (!t) t = {}
    this.title = t.title
    this.field = t.field
    this.width = t.width
    this.align = t.align
    this.halign = t.halign
    this.vAlign = t.vAlign
    this.colspan = t.colspan
    this.rowspan = t.rowspan
    this.checked = t.checked
    this.columnId = t.columnId
    this.tableSummaryTitle = t.tableSummaryTitle
    this.tableSummaryText = t.tableSummaryText
    this.tableSummaryColspan = t.tableSummaryColspan
    this.tableSummary = t.tableSummary
    this.tableSummaryAlign = t.tableSummaryAlign
    this.tableSummaryNumFormat = t.tableSummaryNumFormat
    this.tableSummaryFormatter = t.tableSummaryFormatter
    this.showCodeTitle = t.showCodeTitle
    this.upperCase = t.upperCase
    // string-form formatter / styler captured via toString() — designed time only
    this.renderFormatter = t.renderFormatter && t.renderFormatter.toString()
    this.formatter2 = t.formatter2 && t.formatter2.toString()
    this.styler2 = t.styler2 && t.styler2.toString()
    this.stylerHeader = t.stylerHeader && t.stylerHeader.toString()
    this.tableColumnHeight = t.tableColumnHeight
    this.tableTextType = t.tableTextType
    this.tableBarcodeMode = t.tableBarcodeMode
    this.tableQRCodeLevel = t.tableQRCodeLevel
  }
}

/**
 * V1 d class (line 1798-1875): TableCell — wraps a <td> jQuery element + edit
 * machinery. Header cells additionally bind a column inline editor (l class).
 */
export class TableCell {
  constructor() {
    this.id = nextCellId()
    this.isEditing = false
    this.colspan = 1
    this.rowspan = 1
    this.target = undefined
    this.tableOptions = undefined
    this.rowId = undefined
    this.isHead = false
    this.innerElement = undefined
    this.editor = undefined
  }

  /**
   * Initialize cell. Reads colspan/rowspan from target attributes.
   *
   * @param {jQuery} target  <td> element
   * @param {object} tableOptions  parent HiTable options (with editingCell ref)
   * @param {*} rowId
   * @param {boolean} isHead
   */
  init(target, tableOptions, rowId, isHead) {
    this.isHead = !!isHead
    this.rowId = rowId
    this.isEditing = false
    this.target = target
    this.tableOptions = tableOptions
    const re = /^[0-9]*$/
    const cs = this.target.attr('colspan')
    this.colspan = re.test(cs) ? parseInt(cs) : 1
    const rs = this.target.attr('rowspan')
    this.rowspan = re.test(rs) ? parseInt(rs) : 1
    this.initEvent()
    if (this.isHead) this.initInnerEelement()
  }

  /**
   * Header cells delegate to a column inline editor (lazy-import to avoid
   * circular dep on construction time).
   */
  initInnerEelement() {
    this.innerElement = new TableColumnInlineEditor()
    this.innerElement.init(this, this.tableOptions)
  }

  initEvent() {
    /* V1 hook — kept as no-op for V2 P7 (designer P11 hooks future). */
  }

  /**
   * Enter edit mode. Replaces cell content with a text editor.
   *
   * @returns {void}
   */
  beginEdit() {
    if (this.isEditing) return
    if (!this.tableOptions || !this.tableOptions.isEnableEdit) return
    // tableOptions.onBeforEdit returning falsy → abort
    if (typeof this.tableOptions.onBeforEdit === 'function') {
      if (!this.tableOptions.onBeforEdit(this)) return
    }
    const current = this.getValue()
    // [R3 B9] cell DOM 清空: .empty() 而非 .html('') — 语义清晰, 无字符串解析
    this.target.empty()
    this.editor = createEditor('text')
    this.isEditing = true
    this.tableOptions.editingCell = this
    this.editor.init(this)
    this.editor.setValue(current)
  }

  /**
   * Commit edit. Writes editor value back to the cell via .text() (XSS safe).
   */
  endEdit() {
    this.isEditing = false
    let value = ''
    try {
      if (this.editor && typeof this.editor.getValue === 'function') {
        value = this.editor.getValue()
      }
    } catch (err) {
      console.error('[hiprint] cell editor.getValue failed:', err)
    }
    // [R3 B9] writing user input → ALWAYS .text() (never .html())
    if (this.editor && typeof this.editor.destroy === 'function') {
      try {
        this.editor.destroy()
      } catch (err) {
        console.error('[hiprint] cell editor.destroy failed:', err)
      }
    }
    this.target.text(value == null ? '' : value)

    // [state-modeler R3] clear editingCell pointer when self matches
    if (this.tableOptions && this.tableOptions.editingCell === this) {
      this.tableOptions.editingCell = null
    }
  }

  getTarget() {
    return this.target
  }

  /**
   * Read cell content. Uses .text() (textContent) — aligned with beginEdit/endEdit
   * writes (V1 line 1827 explicit comment).
   *
   * @returns {string}
   */
  getValue() {
    return coerceText(this.target.text())
  }

  /**
   * V1 stub (line 1829-1830) — non-functional, retained for API parity.
   */
  setValue(_t) {
    /* no-op (V1 parity) */
  }

  /**
   * Get bounding rect for select-rect calculations.
   * @returns {{x:number,y:number,height:number,width:number}}
   */
  getTableRect() {
    const offset = this.target.offset()
    return {
      x: offset.left,
      y: offset.top,
      height: this.target[0].offsetHeight,
      width: this.target[0].offsetWidth,
    }
  }

  /**
   * Test whether the cell overlaps a target rect.
   * @param {{x:number,y:number,height:number,width:number}} rect
   * @returns {boolean}
   */
  isOverlap(rect) {
    const me = this.getTableRect()
    return (
      rect.x + rect.width > me.x &&
      me.x + me.width > rect.x &&
      rect.y + rect.height > me.y &&
      me.y + me.height > rect.y
    )
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  isXYinCell(x, y) {
    return this.isOverlap({ x, y, height: 0, width: 0 })
  }

  isSelected() {
    return this.target.hasClass('selected')
  }

  select() {
    this.target.addClass('selected')
  }

  /**
   * Default false — header subclass overrides.
   */
  isHeader() {
    return false
  }

  setAlign(t) {
    this.align = t
    if (t) {
      this.target.css('text-align', t)
    } else if (this.target[0]) {
      this.target[0].style.textAlign = ''
    }
  }

  setVAlign(t) {
    this.vAlign = t
    if (t) {
      this.target.css('vertical-align', t)
    } else if (this.target[0]) {
      this.target[0].style.verticalAlign = ''
    }
  }

  getEntity() {
    return new TableColumnEntity(this)
  }
}

/**
 * Header-row cell (V1 f class at line 1899-1908 — extends d).
 */
export class TableHeaderCell extends TableCell {
  constructor(e) {
    super()
    if (!e) e = {}
    this.width = e.width ? parseFloat(e.width.toString()) : 100
    this.title = e.title
    this.descTitle = e.descTitle
    this.field = e.field
    this.fixed = e.fixed
    this.rowspan = e.rowspan ? parseInt(e.rowspan) : 1
    this.colspan = e.colspan ? parseInt(e.colspan) : 1
    this.align = e.align
    this.halign = e.halign
    this.vAlign = e.vAlign
    this.formatter = e.formatter
    this.styler = e.styler
    this.renderFormatter = e.renderFormatter
    this.formatter2 = e.formatter2
    this.styler2 = e.styler2
    this.stylerHeader = e.stylerHeader
    this.checkbox = e.checkbox
    this.checked = e.checked !== false
    this.columnId = e.columnId || e.field
    this.tableColumnHeight = e.tableColumnHeight
    this.tableTextType = e.tableTextType
    this.tableBarcodeMode = e.tableBarcodeMode
    this.tableQRCodeLevel = e.tableQRCodeLevel
    this.tableSummaryTitle = e.tableSummaryTitle
    this.tableSummaryText = e.tableSummaryText
    this.tableSummaryColspan = e.tableSummaryColspan
    this.tableSummary = e.tableSummary
    this.tableSummaryAlign = e.tableSummaryAlign
    this.tableSummaryNumFormat = e.tableSummaryNumFormat
    this.tableSummaryFormatter = e.tableSummaryFormatter
    this.showCodeTitle = e.showCodeTitle
    this.upperCase = e.upperCase
  }

  // V1 placeholder — header subclass does not have css override behavior in V1 either
  css(_t) {
    /* no-op */
  }
}

/**
 * Test hook: reset internal id counter (for deterministic test IDs).
 */
export function _resetCellIdCounter() {
  _idCounter = 0
}
