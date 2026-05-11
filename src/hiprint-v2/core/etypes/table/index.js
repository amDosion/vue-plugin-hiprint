/**
 * table/index.js — Barrel export for table element (V2).
 *
 * V1 source: bundle.js line 1718-2427 (helpers) + 6210-6709 (TablePrintElement).
 */

export { TablePrintElement, TableExcelHelper } from './print-element.js'
export {
  // primary helpers
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
  // formatter accessors (each goes through evalCap)
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
} from './excel-helper.js'
export {
  TableCell,
  TableHeaderCell,
  TableColumnEntity,
  _resetCellIdCounter,
} from './cell.js'
export {
  TextInlineEditor,
  SelectInlineEditor,
  TableColumnInlineEditor,
  createEditor,
  createSelect,
} from './inline-editor.js'
export {
  applyRowsColumnsMerge,
  resolveRowsColumnsMerge,
} from './row-merge.js'
