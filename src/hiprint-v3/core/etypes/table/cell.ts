/**
 * table/cell.ts — Table cell / column data shape (V3 pure data).
 *
 * V2 reference: src/hiprint-v2/core/etypes/table/cell.js (jQuery TableCell +
 * TableColumnInlineEditor). V3 keeps ONLY the serializable column shape; cell
 * edit DOM moves to a Vue component in P17.
 *
 * V1 source: bundle.js line 1793-1908.
 *  - u (1793-1796): ColumnEntity (serializable shape) — kept as TableColumnEntity.
 *  - d (1798-1875): TableCell (DOM-bound) — dropped from V3 data layer.
 *  - f (1899-1908): TableHeaderColumn — header column shape kept as
 *    TableHeaderColumnEntity (pure data; no jQuery target).
 *
 * Used by:
 *  - schemas/element.ts TableColumn type (kept as Zod source-of-truth).
 *  - table/index.ts createTableElement factory defaults.
 */

/**
 * Serializable column entity. Mirrors V1 u class shape. Function-type fields
 * are persisted as their toString() form by V1; V3 keeps the same convention
 * to round-trip with vue-admin-main JSON.
 */
export interface TableColumnEntity {
  title?: string
  field?: string
  width?: number
  align?: 'left' | 'center' | 'right'
  halign?: 'left' | 'center' | 'right'
  vAlign?: 'top' | 'middle' | 'bottom'
  colspan?: number
  rowspan?: number
  checked?: boolean
  columnId?: string
  fixed?: boolean
  tableSummaryTitle?: string
  tableSummaryText?: string
  tableSummaryColspan?: number
  tableSummary?: unknown
  tableSummaryAlign?: 'left' | 'center' | 'right'
  tableSummaryNumFormat?: string
  tableSummaryFormatter?: unknown
  showCodeTitle?: boolean
  upperCase?: boolean
  renderFormatter?: string | ((...args: unknown[]) => unknown)
  formatter?: string | ((...args: unknown[]) => unknown)
  formatter2?: string | ((...args: unknown[]) => unknown)
  styler?: string | ((...args: unknown[]) => unknown)
  styler2?: string | ((...args: unknown[]) => unknown)
  stylerHeader?: string | ((...args: unknown[]) => unknown)
  tableColumnHeight?: number
  tableTextType?: string
  tableBarcodeMode?: string
  tableQRCodeLevel?: 0 | 1 | 2 | 3
  /** V1 superset compatibility — preserve unknown column attrs verbatim. */
  [key: string]: unknown
}

/**
 * Header column shape (V1 f class). Subset that drives rendering at runtime.
 */
export interface TableHeaderColumnEntity extends TableColumnEntity {
  descTitle?: string
  /** Whether checkbox column. */
  checkbox?: boolean
}

/**
 * Normalize a raw column object into a TableColumnEntity, applying V1 default
 * conventions:
 *  - width defaults to 100 when omitted (V1 line 9921).
 *  - function-typed formatter / styler are kept as fn (not stringified — V3 lets
 *    schema validate / persist later).
 *  - colspan / rowspan default to 1.
 */
export function normalizeTableColumn(
  raw: Partial<TableColumnEntity> | null | undefined
): TableColumnEntity {
  const src = raw ?? {}
  const colspan =
    typeof src.colspan === 'number'
      ? src.colspan
      : src.colspan !== undefined
        ? parseInt(String(src.colspan)) || 1
        : 1
  const rowspan =
    typeof src.rowspan === 'number'
      ? src.rowspan
      : src.rowspan !== undefined
        ? parseInt(String(src.rowspan)) || 1
        : 1
  const out: TableColumnEntity = {
    ...src,
    colspan,
    rowspan,
    columnId: src.columnId ?? src.field,
  }
  if (out.width === undefined) out.width = 100
  return out
}
