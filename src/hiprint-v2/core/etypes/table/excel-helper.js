/**
 * excel-helper.js — TableExcelHelper (V2).
 *
 * V1 source: bundle.js line 1928-2427 (TableExcelHelper static object).
 *
 * Responsibilities:
 *  - createTableHead / createTableRow / createTableFooter / createEmptyRowTarget
 *  - column width computation (auto / fixed mix)
 *  - reconstitution of multi-layer column tree (rowspan/colspan flatten → leaf row)
 *  - 15+ formatter / styler accessors with evalCap (security cap)
 *
 * Invariants (V2 必须保留):
 *  - [R3 B2] cell text default `.text(p)` (V1 line 2145) — never `.html(userData)`
 *  - [R3 B8] column header `.text(t.title)` (V1 line 1945) — never `.html`
 *  - [R3 silent #2] rowsColumnsMerge cell-level try/catch (delegated to row-merge.js)
 *  - [R3 H1] renderFormatter JSDoc warning — business 自己保证 HTML 安全
 *  - 15 处 evalCap on string-form formatter / styler / footerFormatter / groupFormatter /
 *    rowStyler / tableSummaryFormatter / stylerHeader / renderFormatter / formatter2 /
 *    styler2 / groupFieldsFormatter / groupFooterFormatter / footerFormatter (in printElement)
 *
 * jQuery dependency: window.$ must be present (DOM construction).
 */

import { evalCap, numFormat, groupBy as hiGroupBy, i18n } from '@hiprint-v2/internal'
import { applyRowsColumnsMerge, resolveRowsColumnsMerge } from './row-merge.js'
import { renderBarcode } from '../../../renderers/barcode.js'
import { renderQrcode } from '../../../renderers/qrcode.js'

const $ = () => window.$
// helper for short reads — defer access to window.$ until DOM is loaded

// =================== Reconstitution (column tree flatten) ===================

/**
 * V1 ReconsitutionTableColumns class (bundle.js webpack module 19).
 * V2 minimal struct.
 */
class ReconsitutedColumns {
  constructor() {
    this.rowColumns = []
    this.totalLayer = 0
    this.colspan = 0
  }
}

/**
 * Flatten multi-layer column header tree → bottom-row column list.
 *
 * V1: TableExcelHelper.reconsitutionTableColumnTree (line 2284-2296)
 *
 * @param {Array<{columns:Array}>} columnLayers  options.columns
 * @returns {ReconsitutedColumns}
 */
export function reconsitutionTableColumnTree(columnLayers) {
  const out = new ReconsitutedColumns()
  for (let layer = 0; layer < columnLayers.length; layer++) {
    out.totalLayer = layer + 1
    out[layer] = columnLayers[layer].columns
    if (layer === 0) {
      columnLayers[layer].columns.forEach((col) => {
        out.colspan += col.colspan || 1
      })
    }
  }
  out.rowColumns = getOrderdColumns(out)
  return out
}

/**
 * V1: TableExcelHelper.getOrderdColumns (line 2387-2425)
 * 展开 colspan / rowspan 到最下层叶子节点 column list.
 *
 * @param {ReconsitutedColumns} t
 * @returns {Array}
 */
export function getOrderdColumns(t) {
  const newColumns = {}
  for (let i = 0; i < t.totalLayer; i++) {
    newColumns[i] = []
    t[i].forEach((column) => {
      const colspan = column.colspan || 1
      // create colspan copies, each with colspan:1
      for (let c = 0; c < colspan; c++) {
        newColumns[i].push({ ...column, colspan: 1 })
      }
    })
  }
  for (let i = 0; i < t.totalLayer; i++) {
    newColumns[i].forEach((column, columnIdx) => {
      const rowspan = column.rowspan || 1
      for (let n = 1; n < rowspan; n++) {
        if (newColumns[i + n]) {
          newColumns[i + n].splice(columnIdx, 0, { ...column, rowspan: 1 })
        }
      }
    })
  }
  // 把上层/其他层的 field 赋值给最下层
  const lastColumns = []
  for (let i = 0; i < t.totalLayer; i++) {
    if (i >= t.totalLayer - 1) {
      newColumns[i].forEach((column, columnIdx) => {
        if (!column.field) {
          column.field = lastColumns[columnIdx]
        }
      })
    } else {
      newColumns[i].forEach((column, columnIdx) => {
        if (i === 0) {
          lastColumns.push(column.field || '')
        } else {
          if (column.field) lastColumns[columnIdx] = column.field
        }
      })
    }
  }
  return newColumns[t.totalLayer - 1] || []
}

// =================== Column width ===================

export function allAutoWidth(t) {
  let e = 0
  const n = {}
  t.rowColumns
    .filter((col) => col.checked)
    .forEach((col) => {
      if (n[col.id]) {
        n[col.id] = 0
      } else {
        n[col.id] = col.width
      }
      e += col.fixed ? 0 : n[col.id]
    })
  return e
}

export function allFixedWidth(t) {
  let e = 0
  const n = {}
  t.rowColumns
    .filter((col) => col.checked)
    .forEach((col) => {
      if (n[col.id]) {
        n[col.id] = 0
      } else {
        n[col.id] = col.width
      }
      e += col.fixed ? n[col.id] : 0
    })
  return e
}

/**
 * @param {ReconsitutedColumns} t
 * @param {number} totalWidth
 * @returns {Object<string, number>}  id → width(pt)
 */
export function getColumnsWidth(t, totalWidth) {
  const n = {}
  const auto = allAutoWidth(t)
  const fixed = allFixedWidth(t)
  t.rowColumns
    .filter((col) => col.checked)
    .forEach((col) => {
      if (col.fixed) {
        n[col.id] = col.width
      } else {
        const remaining = totalWidth - fixed
        n[col.id] = (col.width / auto) * (remaining > 0 ? remaining : 0)
      }
    })
  return n
}

export function syncTargetWidthToOption(t) {
  t.forEach((entry) => {
    entry.columns.forEach((col) => {
      if (col.hasWidth) col.width = col.targetWidth
    })
  })
}

// =================== Formatter / styler accessors (15 evalCap sites) ===================

function _evalIf(srcOrFn, name) {
  if (typeof srcOrFn === 'function') return srcOrFn
  if (typeof srcOrFn === 'string' && srcOrFn) return evalCap(srcOrFn, name)
  return undefined
}

export function getGroupFieldsFormatter(options, tablePrintElementType) {
  let fn = tablePrintElementType.groupFieldsFormatter
  // V1 derives groupFieldsFormatter from groupFields array for convenience
  if (tablePrintElementType.groupFields && tablePrintElementType.groupFields.length && !options.groupFieldsFormatter) {
    const arr =
      typeof tablePrintElementType.groupFields === 'string'
        ? tablePrintElementType.groupFields
        : JSON.stringify(tablePrintElementType.groupFields)
    options.groupFieldsFormatter = 'function(type,options,data){ return ' + arr + ' }'
  }
  if (options.groupFieldsFormatter) {
    return _evalIf(options.groupFieldsFormatter, 'groupFieldsFormatter') || fn
  }
  return fn
}

export function getGroupFormatter(options, tablePrintElementType) {
  return _evalIf(options.groupFormatter, 'groupFormatter') || tablePrintElementType.groupFormatter
}

export function getGroupFooterFormatter(options, tablePrintElementType) {
  return (
    _evalIf(options.groupFooterFormatter, 'groupFooterFormatter') ||
    tablePrintElementType.groupFooterFormatter
  )
}

export function getFooterFormatter(options, tablePrintElementType) {
  return _evalIf(options.footerFormatter, 'footerFormatter') || tablePrintElementType.footerFormatter
}

export function getRowStyler(options, tablePrintElementType) {
  return _evalIf(options.rowStyler, 'rowStyler') || tablePrintElementType.rowStyler
}

export function getColumnTableSummaryFormatter(column) {
  return (
    _evalIf(column.tableSummaryFormatter, 'tableSummaryFormatter') ||
    (typeof column.tableSummaryFormatter === 'function' ? column.tableSummaryFormatter : undefined)
  )
}

export function getColumnStyler(column) {
  // styler2 is the string-form, styler is the function-form
  if (column.styler2) return _evalIf(column.styler2, 'styler2') || column.styler
  return typeof column.styler === 'function' ? column.styler : undefined
}

export function getHeaderStyler(column) {
  return _evalIf(column.stylerHeader, 'stylerHeader')
}

/**
 * Get column renderFormatter (HTML output, by-design).
 *
 * [R3 H1 WARNING] renderFormatter 返回值会通过 .html() 写入 cell。这是 by-design HTML
 * 渲染回调,业务方对其输出的 XSS 安全负责 (与 setButtonText useHtml=true 同等约定)。
 *
 * @param {object} column
 * @returns {Function|undefined}
 */
export function getColumnRenderFormatter(column) {
  return (
    _evalIf(column.renderFormatter, 'renderFormatter') ||
    (typeof column.renderFormatter === 'function' ? column.renderFormatter : undefined)
  )
}

export function getColumnFormatter(column) {
  if (column.formatter2) return _evalIf(column.formatter2, 'formatter2') || column.formatter
  return typeof column.formatter === 'function' ? column.formatter : undefined
}

// =================== createTableHead ===================

/**
 * V1: TableExcelHelper.createTableHead (line 1934-1959)
 *
 * @param {Array} columnLayers
 * @param {number} totalWidth
 * @returns {[jQuery, jQuery]}  [<thead>, <colgroup>]
 */
export function createTableHead(columnLayers, totalWidth) {
  const j = window.$
  const tree = reconsitutionTableColumnTree(columnLayers)
  const $thead = j('<thead></thead>')
  let $colgroup = j('<colgroup></colgroup>')
  const widths = getColumnsWidth(tree, totalWidth)

  for (let layer = 0; layer < tree.totalLayer; layer++) {
    const $tr = j('<tr></tr>')
    // 重置 colgroup, 仅以最后一行添加 (V1 line 1937 注释)
    $colgroup = j('<colgroup></colgroup>')
    tree[layer]
      .filter((col) => col.checked)
      .forEach((col) => {
        const $td = j('<td></td>')
        if (col.id) $td.attr('id', col.id)
        if (col.columnId) $td.attr('column-id', col.columnId)
        if (col.align || col.halign) $td.css('text-align', col.halign || col.align)
        if (col.vAlign) $td.css('vertical-align', col.vAlign)
        if (col.colspan > 1) $td.attr('colspan', col.colspan)
        if (col.rowspan > 1) $td.attr('rowspan', col.rowspan)
        // [R3 B8] header title via .text() — never .html(col.title) — title 是 user-controlled
        $td.text(col.title == null ? '' : col.title)
        if (widths[col.id]) {
          col.hasWidth = true
          col.targetWidth = widths[col.id]
          $td.attr('haswidth', 'haswidth').css('width', widths[col.id] + 'pt')
        } else {
          col.hasWidth = false
        }
        const headerStyler = getHeaderStyler(col)
        if (typeof headerStyler === 'function') {
          try {
            const styles = headerStyler(col)
            if (styles) {
              Object.keys(styles).forEach((k) => $td.css(k, styles[k]))
            }
          } catch (err) {
            console.error('[hiprint] headerStyler call failed:', err)
          }
        }
        $tr.append($td)
        // colgroup uses col attributes — safe (attribute values are not HTML)
        const $col = j('<col></col>').attr('column-id', col.columnId).attr('width', col.width + 'pt')
        $colgroup.append($col)
      })
    $thead.append($tr)
  }
  syncTargetWidthToOption(columnLayers)
  return [$thead, $colgroup]
}

// =================== createEmptyRowTarget ===================

/**
 * V1: TableExcelHelper.createEmptyRowTarget (line 2234-2246)
 */
export function createEmptyRowTarget(columnLayers, tableElement) {
  const j = window.$
  const tree = reconsitutionTableColumnTree(columnLayers)
  const $tr = j('<tr></tr>')
  tree.rowColumns
    .filter((col) => col.checked)
    .forEach((col) => {
      const $td = j('<td></td>')
      if (col.field) $td.attr('field', col.field)
      if (col.align) $td.css('text-align', col.align)
      if (col.vAlign) $td.css('vertical-align', col.vAlign)
      $tr.append($td)
    })
  if (tableElement && tableElement.options && tableElement.options.tableBodyRowHeight) {
    $tr.find('td:not([rowspan])').css('height', tableElement.options.tableBodyRowHeight + 'pt')
  }
  return $tr
}

// =================== createRowTarget ===================

/**
 * V1: TableExcelHelper.createRowTarget (line 2093-2233)
 * 单行 td 渲染:
 *  - tableTextType 切分: text (default) / barcode / image / qrcode / sequence
 *  - rowsColumnsMerge: cell-level [rs,cs] computation
 *  - column formatter + styler + renderFormatter
 *
 * @param {ReconsitutedColumns} tree
 * @param {object} rowData
 * @param {object} options       table element options
 * @param {object} elementType   printElementType (groupFields etc.)
 * @param {number} rowIndex
 * @param {Array} tableData
 * @param {*} printData
 * @returns {jQuery}  <tr>
 */
export function createRowTarget(tree, rowData, options, elementType, rowIndex, tableData, printData) {
  const j = window.$
  const $tr = j('<tr></tr>')
  $tr.data('rowData', rowData)
  const checkedCols = tree.rowColumns.filter((c) => c.checked)
  const mergeFn = resolveRowsColumnsMerge(options.rowsColumnsMerge)

  checkedCols.forEach((col, i) => {
    let rowsColumnsArr = [1, 1]
    let $td
    if (options.rowsColumnsMerge) {
      rowsColumnsArr = applyRowsColumnsMerge(
        mergeFn,
        rowData,
        col,
        i,
        rowIndex,
        tableData,
        printData
      )
      const displayCss = !(rowsColumnsArr[0] && rowsColumnsArr[1]) ? 'none' : ''
      $td = j('<td></td>')
        .attr('rowspan', rowsColumnsArr[0])
        .attr('colspan', rowsColumnsArr[1])
        .css('display', displayCss)
    } else {
      $td = j('<td></td>')
    }

    // attribute + alignment
    if (col.field) $td.attr('field', col.field)
    if (col.align) $td.css('text-align', col.align)
    if (col.vAlign) $td.css('vertical-align', col.vAlign)

    // 设计时 (无 rowData) 或 header repeat 不是 first/none → 跳过 width 重算
    const hasData = rowData && Object.keys(rowData).length > 0
    if (hasData && (options.tableHeaderRepeat === 'first' || options.tableHeaderRepeat === 'none')) {
      // 无表头时跨行无效, 需根据所跨列数重新计算宽度
      let width
      if (options.rowsColumnsMerge && rowsColumnsArr[1] > 1) {
        width = 0
        checkedCols.forEach((item, index) => {
          if (index >= i && index < i + rowsColumnsArr[1]) {
            width += item.width
          }
        })
      }
      $td.css('width', (width || col.width) + 'pt')
    }

    // Cell content rendering
    const formatter = getColumnFormatter(col)
    let rawValue = rowData == null ? '' : rowData[col.field]
    let displayValue = rawValue
    if (typeof formatter === 'function') {
      try {
        displayValue = formatter(rawValue, rowData, i, options)
      } catch (err) {
        console.error('[hiprint] column formatter failed:', err)
        displayValue = rawValue
      }
    }

    const renderFormatter = getColumnRenderFormatter(col)
    if (typeof renderFormatter === 'function') {
      // [R3 H1] by-design HTML: business 负责 XSS 安全 (See JSDoc on getColumnRenderFormatter)
      try {
        $td.html(renderFormatter(rawValue, rowData, i, options, rowIndex))
      } catch (err) {
        console.error('[hiprint] renderFormatter failed:', err)
        $td.text(displayValue == null ? '' : String(displayValue))
      }
    } else if (col.tableTextType === 'text' || col.tableTextType === undefined) {
      // [R3 B2] default cell text via .text() — XSS safe path
      $td.text(displayValue == null ? '' : String(displayValue))
    } else if (col.tableTextType === 'barcode') {
      renderBarcode(
        $td,
        displayValue == null ? '' : String(displayValue),
        {
          width: col.width,
          height: col.tableColumnHeight || 30,
          barcodeType: col.tableBarcodeMode || 'CODE128A',
          hideTitle: !col.showCodeTitle,
        }
      )
    } else if (col.tableTextType === 'image') {
      $td.empty()
      if (displayValue) {
        const $box = j('<div></div>')
        const $img = j('<img>')
          .css('max-width', '100%')
          .css('max-height', '100%')
          .attr('src', displayValue)
          .attr('height', (col.tableColumnHeight || 50) + 'pt')
        $box.append($img)
        $td.append($box)
      }
    } else if (col.tableTextType === 'qrcode') {
      renderQrcode(
        $td,
        displayValue == null ? '' : String(displayValue),
        {
          width: col.width,
          height: col.tableColumnHeight || 20,
          qrCodeLevel: col.tableQRCodeLevel || 0,
          hideTitle: !col.showCodeTitle,
        },
        col.showCodeTitle ? displayValue : undefined
      )
    } else if (col.tableTextType === 'sequence') {
      // [R3 B2] sequence numeric: textContent
      $td.text(String(rowIndex + 1))
    } else {
      // Unknown tableTextType — fall back to text-safe
      $td.text(displayValue == null ? '' : String(displayValue))
    }

    // Column styler
    const styler = getColumnStyler(col)
    if (typeof styler === 'function') {
      try {
        const styles = styler(rawValue, rowData, i, options)
        if (styles) {
          Object.keys(styles).forEach((k) => $td.css(k, styles[k]))
        }
      } catch (err) {
        console.error('[hiprint] column styler failed:', err)
      }
    }

    $tr.append($td)
  })

  // Row styler
  const rowStyler = getRowStyler(options, elementType)
  if (typeof rowStyler === 'function') {
    try {
      const styles = rowStyler(rowData, options)
      if (styles) {
        Object.keys(styles).forEach((k) => $tr.css(k, styles[k]))
      }
    } catch (err) {
      console.error('[hiprint] rowStyler failed:', err)
    }
  }

  return $tr
}

// =================== createTableRow (tbody, including grouping) ===================

/**
 * V1: TableExcelHelper.createTableRow (line 2046-2092)
 *
 * @param {Array} columnLayers
 * @param {Array} data       table data rows
 * @param {*} printData      template-level print data
 * @param {object} options
 * @param {object} elementType  printElementType
 * @returns {jQuery}  <tbody>
 */
export function createTableRow(columnLayers, data, printData, options, elementType) {
  const j = window.$
  const tree = reconsitutionTableColumnTree(columnLayers)
  const $tbody = j('<tbody></tbody>')
  const groupFieldsFormatter = getGroupFieldsFormatter(options, elementType)
  let groupRowIndex = 0
  let groupFields
  try {
    if (typeof groupFieldsFormatter === 'function') {
      groupFields = groupFieldsFormatter(elementType, options, data) || []
      elementType.groupFields = groupFields
    } else {
      groupFields = elementType.groupFields || []
    }
  } catch (err) {
    console.error('[hiprint] groupFieldsFormatter failed:', err)
    groupFields = []
  }

  const rows = Array.isArray(data) ? data : []
  if (groupFields.length) {
    const grouped = hiGroupBy(rows, groupFields, (item) => {
      const key = {}
      groupFields.forEach((f) => {
        key[f] = item[f]
      })
      return key
    })
    grouped.forEach((groupData) => {
      const groupFormatter = getGroupFormatter(options, elementType)
      if (typeof groupFormatter === 'function') {
        try {
          const result = groupFormatter(tree.colspan, rows, printData, groupData, options)
          const $r = j(result)
          if ($r.is('tr')) {
            $tbody.append($r)
          } else if ($r.is('td')) {
            $tbody.append(j('<tr></tr>').append($r))
          } else {
            $tbody.append(j('<tr></tr>').append(j('<td></td>').append($r)))
          }
        } catch (err) {
          console.error('[hiprint] groupFormatter failed:', err)
        }
      }
      const groupFooterFormatter = getGroupFooterFormatter(options, elementType)
      groupData.rows.forEach((row, rowIndex) => {
        const sequenceIndex = options.groupSequenceContinue ? groupRowIndex : rowIndex
        const $row = createRowTarget(tree, row, options, elementType, sequenceIndex, groupData.rows, printData)
        $tbody.append($row)
        groupRowIndex += 1
      })
      if (typeof groupFooterFormatter === 'function') {
        try {
          const result = groupFooterFormatter(tree.colspan, rows, printData, groupData, options)
          const $r = j(result)
          if ($r.is('tr')) {
            $tbody.append($r)
          } else if ($r.is('td')) {
            $tbody.append(j('<tr></tr>').append($r))
          } else {
            $tbody.append(j('<tr></tr>').append(j('<td></td>').append($r)))
          }
        } catch (err) {
          console.error('[hiprint] groupFooterFormatter failed:', err)
        }
      }
    })
  } else {
    rows.forEach((row, rowIndex) => {
      const $row = createRowTarget(tree, row, options, elementType, rowIndex, rows, printData)
      $tbody.append($row)
    })
  }

  return $tbody
}

// =================== createTableFooter (tfoot summary) ===================

/**
 * V1: TableExcelHelper.tableSummaryTitle (line 2043-2046)
 *
 * @param {object} column
 * @param {string} title
 * @param {*} data  printData (truthy means summary is in tableFooterRepeat='every')
 * @returns {string}
 */
export function tableSummaryTitle(column, title, data) {
  const showTitle = column.tableSummaryTitle === undefined || column.tableSummaryTitle === true
  if (showTitle) return title
  return data ? '' : title
}

/**
 * V1: TableExcelHelper.createTableFooter (line 1960-2042)
 *
 * @param {Array} columnLayers  printElementType.columns
 * @param {Array} allData       table 全部数据
 * @param {object} options
 * @param {object} elementType  printElementType
 * @param {*} printData
 * @param {Array} pageData      table 每页数据
 * @param {number} [pageIndex]
 * @returns {jQuery}  <tfoot>
 */
export function createTableFooter(columnLayers, allData, options, elementType, printData, pageData, pageIndex) {
  const j = window.$
  const $tfoot = j('<tfoot></tfoot>')
  const footerFormatter = getFooterFormatter(options, elementType)
  const tSumData = options.tableFooterRepeat === 'last' ? allData : pageData
  // rowColumns: fall back to last layer
  const lastLayerIdx = options.columns ? options.columns.length - 1 : columnLayers.length - 1
  const tree = reconsitutionTableColumnTree(columnLayers)
  const rowColumns =
    (tree && tree.rowColumns && tree.rowColumns.length)
      ? tree.rowColumns
      : columnLayers[lastLayerIdx]
        ? columnLayers[lastLayerIdx].columns
        : []

  const checkedSummaryCols = rowColumns
    .filter((c) => c.checked)
    .filter((c) => c.tableSummary || c.tableSummaryColspan !== undefined || c.tableSummaryText)

  if (options.tableFooterRepeat !== 'no' && rowColumns.some((c) => c.tableSummary)) {
    const $row = j('<tr></tr>')
    rowColumns
      .filter((c) => c.checked)
      .forEach((column) => {
        const fieldData = (tSumData || [])
          .filter((row) => row && row[column.field])
          .map((row) => {
            const v = row[column.field]
            return /^-?(0|[1-9]\d*)(\.\d+)?/.test(v) ? Number(v) : 0
          })
        const text = column.tableSummaryText
        const numF = column.tableSummaryNumFormat || 2
        const align = column.tableSummaryAlign || 'center'
        const style = 'text-align: ' + align
        const colspan = column.tableSummaryColspan == null ? 1 : column.tableSummaryColspan
        const upperCaseType = column.upperCase
        const summaryFormatter = getColumnTableSummaryFormatter(column)
        if (typeof summaryFormatter === 'function') {
          try {
            const result = summaryFormatter(column, fieldData, allData, options)
            if (result) {
              $row.append(result)
              return
            }
          } catch (err) {
            console.error('[hiprint] tableSummaryFormatter failed:', err)
          }
        }
        const $td = j('<td></td>')
          .css('text-align', align)
          .attr('colspan', colspan)
        const sumWithFormat = (val) => {
          const formatted = numFormat(val, numF)
          // upperCase support is V1-specific (Chinese 大写), skipped in V2 unless wired
          // V1 toUpperCase was hinnn util; we call numFormat-only for now (V2 baseline).
          return upperCaseType ? toUpperCaseFallback(upperCaseType, formatted) : formatted
        }

        let title, value
        switch (column.tableSummary) {
          case 'count':
            title = tableSummaryTitle(column, text || i18n.__('计数') + ':', printData)
            value = (tSumData || []).filter((r) => r).length || 0
            if (upperCaseType) value = toUpperCaseFallback(upperCaseType, value)
            $td.text(title + value)
            break
          case 'sum': {
            const sum = fieldData.reduce((p, c) => p + c, 0)
            title = tableSummaryTitle(column, text || i18n.__('合计') + ':', printData)
            $td.text(title + sumWithFormat(sum))
            break
          }
          case 'avg': {
            const sum = fieldData.reduce((p, c) => p + c, 0)
            const avg = sum / (fieldData.length || 1)
            title = tableSummaryTitle(column, text || i18n.__('平均值') + ':', printData)
            $td.text(title + sumWithFormat(avg))
            break
          }
          case 'min': {
            let min = fieldData.length ? Math.min.apply(null, fieldData) : 0
            if (min === Infinity) min = 0
            title = tableSummaryTitle(column, text || i18n.__('最小值') + ':', printData)
            $td.text(title + (sumWithFormat(min) || 0))
            break
          }
          case 'max': {
            let max = fieldData.length ? Math.max.apply(null, fieldData) : 0
            if (max === -Infinity) max = 0
            title = tableSummaryTitle(column, text || i18n.__('最大值') + ':', printData)
            $td.text(title + (sumWithFormat(max) || 0))
            break
          }
          case 'text':
            $td.text(text || '')
            break
          default:
            if (colspan >= 1) {
              $td.text(text || '')
            }
            break
        }
        $row.append($td)
      })
    $tfoot.append($row)
  }
  if (typeof footerFormatter === 'function') {
    try {
      const result = footerFormatter(options, allData, printData, pageData, pageIndex)
      if (result) $tfoot.append(result)
    } catch (err) {
      console.error('[hiprint] footerFormatter failed:', err)
    }
  }
  return $tfoot
}

/**
 * V1 hinnn.toUpperCase fallback — V2 stub (Chinese 大写 conversion not yet ported).
 * Returns the numeric string as-is when upperCaseType is not "lowercase".
 *
 * V1 implementation is in bundle hinnn module; V2 will wire when needed.
 */
function toUpperCaseFallback(_type, value) {
  return value
}

// =================== resizeTableCellWidth ===================

/**
 * V1: TableExcelHelper.resizeTableCellWidth (line 2260-2267)
 *
 * @param {jQuery} $table  hiprint-printElement-tableTarget root
 * @param {Array} columnLayers
 * @param {number} totalWidth
 */
export function resizeTableCellWidth($table, columnLayers, totalWidth) {
  const tree = reconsitutionTableColumnTree(columnLayers)
  const widths = getColumnsWidth(tree, totalWidth)
  $table.find('thead tr td[haswidth]').each(function () {
    const id = window.$(this).attr('id')
    window.$(this).css('width', widths[id] + 'pt')
  })
}

// =================== Exports (TableExcelHelper static object façade) ===================

/**
 * V1 compatibility façade. V2 exports per-function but also exposes the
 * static-object shape that V1 callers expect.
 */
export const TableExcelHelper = {
  createTableHead,
  createTableRow,
  createTableFooter,
  createRowTarget,
  createEmptyRowTarget,
  resizeTableCellWidth,
  reconsitutionTableColumnTree,
  getColumnsWidth,
  getOrderdColumns,
  allAutoWidth,
  allFixedWidth,
  syncTargetWidthToOption,
  getGroupFieldsFormatter,
  getGroupFormatter,
  getGroupFooterFormatter,
  getFooterFormatter,
  getRowStyler,
  getColumnTableSummaryFormatter,
  getColumnStyler,
  getHeaderStyler,
  getColumnRenderFormatter,
  getColumnFormatter,
  tableSummaryTitle,
}
