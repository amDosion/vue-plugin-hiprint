/**
 * table/index.ts — Table element data factory (V3 pure data).
 *
 * V2 reference: src/hiprint-v2/core/etypes/table/index.js (which itself
 * imported the jQuery-coupled print-element / inline-editor / row-merge /
 * excel-helper). V3 keeps ONLY data shapes — render + interaction move to
 * P15.2 / P17.
 *
 * Defaults mirror V1 (bundle.js line 6210-6709 + etypes/default-etyps-provider
 * line 46-104).
 */

import {
  createBaseElement,
  type BaseElement,
  type ElementTypeRef,
} from '../../element-base'
import type { ElementTypeDef } from '../../group'
import {
  normalizeTableColumn,
  type TableColumnEntity,
} from './cell'

export { normalizeTableColumn, type TableColumnEntity }
export type { TableHeaderColumnEntity } from './cell'

/**
 * V1 default table options.
 *
 * Sprint 22d TKT-162: width aligned to V1 `table.default`
 * (hiprint.config.js line 1216-1218): `width:550`.
 */
export const TABLE_DEFAULT_OPTIONS: Record<string, unknown> = {
  width: 550,
  testData: '[]',
  repeatHeader: true,
  rowHeight: 22,
  headerRowHeight: 22,
}

/** Default ElementTypeDef definition for the built-in table element. */
export const TABLE_DEFAULT_TYPE_DEF: ElementTypeDef = {
  tid: 'defaultModule.table',
  title: '表格',
  type: 'table',
  field: 'table',
  icon: 'ep:grid',
  columns: [
    [
      { title: '列 1', field: 'col1', width: 100 },
      { title: '列 2', field: 'col2', width: 100 },
    ],
  ],
}

/**
 * Columns layout. V1 supports two forms (multi-header rows or single row).
 * V3 normalizes everything to `TableColumnEntity[][]` at runtime so the
 * renderer can iterate rows uniformly.
 */
export type TableColumnsLayout = TableColumnEntity[][]

export interface CreateTableElementInit {
  tid?: string
  printElementType?: Partial<ElementTypeRef>
  /** Pre-normalized columns OR raw rows. */
  columns?: Array<Array<Partial<TableColumnEntity>>> | Array<Partial<TableColumnEntity>>
  options?: Record<string, unknown>
  id?: string
  templateId?: string
}

/**
 * Normalize columns layout — accepts either single-row or multi-row form.
 * Returns multi-row form for renderer uniformity.
 */
export function normalizeTableColumns(
  raw:
    | Array<Array<Partial<TableColumnEntity>>>
    | Array<Partial<TableColumnEntity>>
    | undefined
    | null
): TableColumnsLayout {
  if (!Array.isArray(raw) || raw.length === 0) return [[]]
  const first = raw[0]
  if (Array.isArray(first)) {
    return (raw as Array<Array<Partial<TableColumnEntity>>>).map((row) =>
      row.map((c) => normalizeTableColumn(c))
    )
  }
  return [
    (raw as Array<Partial<TableColumnEntity>>).map((c) => normalizeTableColumn(c)),
  ]
}

export function createTableElement(
  init: CreateTableElementInit = {}
): BaseElement {
  const printElementType: ElementTypeRef = {
    tid: init.tid ?? init.printElementType?.tid ?? TABLE_DEFAULT_TYPE_DEF.tid,
    type: 'table',
    title: init.printElementType?.title ?? TABLE_DEFAULT_TYPE_DEF.title,
    field:
      init.printElementType?.field ?? TABLE_DEFAULT_TYPE_DEF.field ?? 'table',
    ...(init.printElementType ?? {}),
  }
  const columns = normalizeTableColumns(
    init.columns ??
      (TABLE_DEFAULT_TYPE_DEF.columns as
        | Array<Array<Partial<TableColumnEntity>>>
        | Array<Partial<TableColumnEntity>>)
  )
  return createBaseElement({
    tid: printElementType.tid ?? TABLE_DEFAULT_TYPE_DEF.tid!,
    printElementType,
    options: {
      ...TABLE_DEFAULT_OPTIONS,
      columns,
      ...(init.options ?? {}),
    },
    ...(init.id !== undefined ? { id: init.id } : {}),
    ...(init.templateId !== undefined ? { templateId: init.templateId } : {}),
  })
}
