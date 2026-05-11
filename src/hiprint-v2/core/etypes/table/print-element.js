/**
 * print-element.js — TablePrintElement (V2).
 *
 * V1 source: bundle.js line 6210-6709 (TablePrintElement class).
 *
 * Responsibilities:
 *  - Subclass of BasePrintElement; orchestrates table head/body/footer rendering
 *  - getData with testData fallback (designer mode = '[{}]')
 *  - Footer formatter + grid-columns footer formatter (evalCap)
 *  - Pagination math for getPaperHtmlResult — V2 P7 keeps the algorithm intact;
 *    drag/keyboard/hitable design hooks deferred to P9b/P11 design integration.
 *
 * Invariants (V2 必须保留):
 *  - [R3 B2/B8/B9/H1] delegated to excel-helper.js + cell.js + inline-editor.js
 *  - [R3 silent #2] delegated to row-merge.js
 *  - getData() uses safe nested-field reduce (preserve 0/false/'')
 *  - testData JSON.parse failure → log + return [{}] (V1 line 6552)
 *  - footerFormatter / gridColumnsFooterFormatter via evalCap (security cap)
 */

import { BasePrintElement } from '../../print-element-entity.js'
import { evalCap, resolveField } from '@hiprint-v2/internal'
import {
  TableExcelHelper,
  createTableHead,
  createTableRow,
  createTableFooter,
  createEmptyRowTarget,
  resizeTableCellWidth,
} from './excel-helper.js'

export class TablePrintElement extends BasePrintElement {
  /**
   * @param {object} printElementType
   * @param {object} [options]
   */
  constructor(printElementType, options) {
    super(printElementType, options)
    /** @type {string} */
    this.gridColumnsFooterCss = 'hiprint-gridColumnsFooter'
    /** @type {string} */
    this.tableGridRowCss = 'table-grid-row'
    /** @type {boolean} flagged at getHtml() time; informs head-repeat logic */
    this.isNotDesign = false
  }

  // ============ Column accessors ============

  /**
   * @returns {Array}  options.columns (multi-layer header structure)
   */
  getColumns() {
    return this.options.columns || []
  }

  /**
   * @param {string} columnId
   * @returns {object|undefined}
   */
  getColumnByColumnId(columnId) {
    if (this.options && typeof this.options.getColumnByColumnId === 'function') {
      return this.options.getColumnByColumnId(columnId)
    }
    const layers = this.getColumns()
    for (let i = 0; i < layers.length; i++) {
      const cols = layers[i].columns || []
      for (let j = 0; j < cols.length; j++) {
        if (cols[j].columnId === columnId || cols[j].id === columnId) return cols[j]
      }
    }
    return undefined
  }

  // ============ Data extraction (PM-002 R3 safe) ============

  /**
   * V1: TablePrintElement.prototype.getData (line 6545-6558)
   *
   * Designer-mode (no templateData): parse options.testData (JSON string,
   * default '[{}]'). 失败 console.error + fallback [{}].
   *
   * Runtime: nested-field reduce preserves 0/false/'' (PM-002 R3) — deep clone
   * via JSON to detach from caller mutation.
   *
   * @param {object} [templateData]
   * @returns {Array<object>}
   */
  getData(templateData) {
    if (!templateData) {
      try {
        const td = this.options.testData || '[{}]'
        return JSON.parse(td)
      } catch (err) {
        console.error('[hiprint] table testData parse failed:', err)
        return [{}]
      }
    }
    const field = this.getField()
    if (!field) return []
    // PM-002 R3 — preserves 0/false/'', returns '' for unreachable
    const value = resolveField(templateData, field, '')
    if (!value) return []
    try {
      return JSON.parse(JSON.stringify(value))
    } catch (err) {
      console.error('[hiprint] table data clone failed:', err)
      return []
    }
  }

  // ============ Formatter accessors (evalCap) ============

  /**
   * V1: getFooterFormatter (line 6692-6699)
   * @returns {Function|undefined}
   */
  getFooterFormatter() {
    if (typeof this.printElementType.footerFormatter === 'function') {
      return this.printElementType.footerFormatter
    }
    if (this.options.footerFormatter) {
      return evalCap(this.options.footerFormatter, 'footerFormatter')
    }
    return undefined
  }

  /**
   * V1: getGridColumnsFooterFormatter (line 6700-6707)
   * @returns {Function|undefined}
   */
  getGridColumnsFooterFormatter() {
    if (typeof this.printElementType.gridColumnsFooterFormatter === 'function') {
      return this.printElementType.gridColumnsFooterFormatter
    }
    if (this.options.gridColumnsFooterFormatter) {
      return evalCap(this.options.gridColumnsFooterFormatter, 'gridColumnsFooterFormatter')
    }
    return undefined
  }

  // ============ Table HTML composition ============

  /**
   * Build the inner <table> with thead + tbody + tfoot.
   *
   * V1: getTableHtml (line 6303-6309)
   *
   * @param {Array} data
   * @param {*} printData
   * @returns {jQuery}  <table.hiprint-printElement-tableTarget>
   */
  getTableHtml(data, printData) {
    const $ = window.$
    // formatter-only table (no field, content provided directly)
    if (!this.getField() && this.options.content) {
      const $wrap = $('<div></div>').append(this.options.content)
      const $table = $wrap.find('table')
      $table.addClass('hiprint-printElement-tableTarget')
      return $table
    }
    if (typeof this.printElementType.formatter === 'function') {
      const $wrap = $('<div></div>')
      try {
        $wrap.append(this.printElementType.formatter(data))
      } catch (err) {
        console.error('[hiprint] table formatter failed:', err)
      }
      const $table = $wrap.find('table')
      $table.addClass('hiprint-printElement-tableTarget')
      return $table
    }
    const $table = $(
      '<table class="hiprint-printElement-tableTarget" style="border-collapse: collapse;"></table>'
    )
    const headerList = createTableHead(
      this.getColumns(),
      this._getWidth() / this._getGridColumns()
    )
    // First page (or no-repeat header): include both <thead> + <colgroup>;
    // subsequent pages: include just <thead> (V1 line 6309)
    const headerRepeat = this.options.tableHeaderRepeat
    if (this.isNotDesign && (headerRepeat === 'first' || headerRepeat === 'none')) {
      $table.append(headerList)
    } else {
      $table.append(headerList[0])
    }
    $table.append(createTableRow(this.getColumns(), data, printData, this.options, this.printElementType))
    if (this.options.tableFooterRepeat !== 'no') {
      const $tfoot = createTableFooter(
        this.printElementType.columns,
        data,
        this.options,
        this.printElementType,
        printData,
        data
      )
      const $tbody = $table.find('tbody')
      if ($tbody.length) {
        $tfoot.insertBefore($tbody)
      } else {
        $table.append($tfoot)
      }
    }
    return $table
  }

  /**
   * V1: createTarget (line 6279-6284)
   *
   * Outer scaffold (printElement wrapper) + inner grid columns + table.
   *
   * @param {string} _title
   * @param {Array} data
   * @param {*} printData
   * @returns {jQuery}
   */
  createTarget(_title, data, printData) {
    const $ = window.$
    const $wrapper = $(
      '<div class="hiprint-printElement hiprint-printElement-table" style="position: absolute;">' +
        '<div class="hiprint-printElement-table-handle"></div>' +
        '<div class="hiprint-printElement-table-content" style="height:100%;width:100%"></div>' +
        '</div>'
    )
    const gridCols = this._getGridColumns()
    const $row = $('<div class="hi-grid-row table-grid-row"></div>')
    for (let i = 0; i < gridCols; i++) {
      const widthPct = 100 / gridCols
      const $col = $(
        '<div class="tableGridColumnsGutterRow hi-grid-col" style="width:' + widthPct + '%;"></div>'
      )
      $col.append(this.getTableHtml(data, printData))
      $row.append($col)
    }
    const gridFooter = this.getGridColumnsFooterFormatter()
    if (typeof gridFooter === 'function') {
      const $footer = $('<div class="hiprint-gridColumnsFooter"></div>')
      try {
        $footer.append(gridFooter(this.options, data, printData, []))
      } catch (err) {
        console.error('[hiprint] gridColumnsFooterFormatter failed:', err)
      }
      $row.append($footer)
    }
    $wrapper.find('.hiprint-printElement-table-content').append($row)
    return $wrapper
  }

  /**
   * V1: getEmptyRowTarget (line 6310-6311)
   *
   * @returns {jQuery}
   */
  getEmptyRowTarget() {
    return createEmptyRowTarget(this.getColumns(), this)
  }

  /**
   * V1: getHtml (line 6312-6316) — runtime / preview rendering entry.
   *
   * V2 P7 keeps single-paper render (no pagination loop). Full pagination
   * (V1 getPaperHtmlResult line 6317-6376) is deferred to P10b/P11 wiring
   * where panel.getPaperFooter is available.
   *
   * @param {object} designPaper
   * @param {*} templateData
   * @returns {Array<{target: jQuery, printLine: number|undefined}>}
   */
  getHtml(designPaper, templateData) {
    this.isNotDesign = templateData !== undefined
    const data = this.getData(templateData)
    const $target = this.createTarget(this.printElementType.title, data, templateData)
    return [{ target: $target, printLine: undefined }]
  }

  /**
   * V1: updateDesignViewFromOptions (line 6255-6262) — re-render in place.
   */
  updateDesignViewFromOptions() {
    if (!this.designTarget) return
    const $content = this.designTarget.find('.hiprint-printElement-table-content')
    const result = this.getHtml(this.designPaper)
    $content.empty()
    const $row = result[0].target.find('.table-grid-row')
    if ($row.length) {
      $content.append($row)
    } else {
      // formatter-mode table — fallback to whole target
      $content.append(result[0].target.children())
    }
  }

  /**
   * V1: filterOptionItems (line 6686-6691) — multi-column tables hide the
   * single-column 'columns' editor.
   */
  filterOptionItems(items) {
    const editable = this.printElementType.editable
    if (editable && this.options.columns && this.options.columns.length === 1) {
      return items
    }
    return items.filter((it) => it.name !== 'columns')
  }

  /**
   * V1: getReizeableShowPoints (line 6564-6566)
   */
  getReizeableShowPoints() {
    return ['n', 's', 'w', 'e']
  }

  /**
   * V1: onResize (line 6559-6563)
   *
   * @param {number} t  width
   * @param {number} e  height
   * @param {number} n  delta-w
   * @param {number} i  delta-h
   * @param {number} o  left/top deltas (V1 arg shape)
   */
  onResize(t, e, n, i, o) {
    if (typeof this.updateSizeAndPositionOptions === 'function') {
      this.updateSizeAndPositionOptions(o, i, n, e)
    }
    if (this.designTarget) {
      resizeTableCellWidth(this.designTarget, this.getColumns(), this._getWidth())
      if (e !== undefined) {
        this.designTarget.find('.hiprint-printElement-tableTarget').css('height', e + 'pt')
      }
    }
  }

  // ============ Option accessors with fallback (skeleton compatibility) ============

  /**
   * V1 option.getWidth(); fallback to options.width directly.
   */
  _getWidth() {
    if (this.options && typeof this.options.getWidth === 'function') return this.options.getWidth()
    return this.options ? Number(this.options.width) || 0 : 0
  }

  /**
   * V1 option.getGridColumns(); fallback to options.gridColumns or 1.
   */
  _getGridColumns() {
    if (this.options && typeof this.options.getGridColumns === 'function') {
      return this.options.getGridColumns() || 1
    }
    return (this.options && this.options.gridColumns) || 1
  }

  // ============ Config ============

  /**
   * V1: getConfigOptions (line 6277-6278) — returns HiPrintConfig.instance.table.
   * V2: registry-driven (P11 wiring).
   */
  getConfigOptions() {
    return {}
  }
}

// Expose helper façade for parity with V1 import shape (`import { TableExcelHelper } from ...`)
export { TableExcelHelper }
