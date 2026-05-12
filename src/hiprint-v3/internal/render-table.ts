/**
 * render-table.ts — TKT-021 Sprint 22b convergence helper.
 *
 * Pure, framework-free table model builder used by BOTH render paths:
 *  - `components/elements/table/TableElement.vue` (Vue declarative designer view)
 *  - `print/render.ts` `renderTableElement` (imperative print/preview/getHtml)
 *
 * Before Sprint 22b the two paths had inconsistent semantics (V3-PARITY-MATRIX
 * `06-table.md` Appendix G):
 *  - `table.field` dot-path handling: TableElement.vue did flat key lookup;
 *    render.ts used dot-split via `resolveField`.
 *  - `gridColumnsFooter` schema disagreed.
 *  - ~85% of table-related fields silently corrupted in V1↔V3 round-trip.
 *
 * Convergence rules (encoded here, single source of truth):
 *  1. `options.field` (top-level table-row field) — V1 `getData(t)` line 6533
 *     does call `field.split('.').reduce(...)` for the print path. We honor
 *     that via `resolveField` (dot-split + nullish-safe). See V1-INVENTORY
 *     `etypes/table.md` F.1.
 *  2. `column.field` — V1 single-level key (V1-INVENTORY F.2 / line 2138-2139).
 *     V3 ADDS dot-path fallback when single key yields undefined; this is a
 *     non-breaking extension (V1 templates that never use dots are unaffected;
 *     V3 templates that intentionally use dot-paths still resolve). Order:
 *     try `row[field]` first (V1 fidelity), then `resolveField(row, field)`
 *     (V3 extension).
 *  3. Multi-layer header colspan/rowspan splat + field inheritance —
 *     V1 `getOrderdColumns` (line 2387-2425). Bottom layer is the canonical
 *     leaf set; fields from upper layers inherit downward when the leaf cell
 *     has no `field`.
 *  4. `rowsColumnsMerge` — caller passes the already-resolved function (the
 *     security cap `evalCap` happens at the call site to keep this module
 *     pure). We invoke it per-cell with V1 signature
 *     `(row, col, cIdx, rIdx, rows, ctx)`. V1 quirk G.3: when rowspan or
 *     colspan is 0, emit `style="display:none"` — keep the `<td>` in the
 *     DOM with `hidden: true`. We expose `hidden` metadata so callers can
 *     choose their own DOM shape (TableElement.vue + render.ts both honor
 *     display:none rather than omitting).
 *  5. `footerFormatter` — string or function (V1 K.1 line 2323-2338).
 *     Compiled via `compileFormatter`. Signature
 *     `(options, allData, printData, pageData, pageIndex)` per V1; we pass
 *     `pageData = allData` and `pageIndex = 0` for now (P10 pagination not
 *     yet ported).
 *  6. `gridColumnsFooter` — V1 stores `Array<Array<cellDef>>`. Each inner
 *     row becomes one `<tr>` of footer cells (cellDef =
 *     `{title, colspan?, text?}`).
 *  7. `testData` fallback for design preview — V1 `getData` line 6549-6554
 *     parses JSON, falls back to `[{}]` on parse error so the designer keeps
 *     showing one preview row. Off by default here (`rowsFallbackPlaceholder`
 *     opt-in) so we don't regress Sprint 22a-r empty-state behavior; the
 *     designer may opt-in for legacy V1 preview parity.
 *
 * Border classes (V3-PARITY 12.14): `tableBorder` option maps to one of
 * `hiprint-printElement-tableTarget-border-{all,none,lr,tb,lt,rt,lb,rb}`.
 * Empty string when the option is not set (caller doesn't add a class).
 *
 * SECURITY: This file does **not** call `new Function` / `eval` directly.
 * String-source formatters (column.formatter / footerFormatter) are compiled
 * via `compileFormatter` (audited helper). The caller MUST pre-resolve
 * `rowsColumnsMerge` via `evalCap` (size cap + try/catch).
 */

import {
  coerceText,
  resolveField,
  safeNumber,
} from './dom-helpers'
import { compileFormatter } from './compile-formatter'

// ============ Types ============

export interface TableRenderHeaderCell {
  /** Header cell visible text (post-coerceText). */
  title: string
  /** Optional inherited field from upper layer (only set on leaf row). */
  field?: string
  /** Header colspan attribute (omit when 1). */
  colspan?: number
  /** Header rowspan attribute (omit when 1). */
  rowspan?: number
  /** Horizontal alignment ('left' | 'center' | 'right'). */
  align?: string
  /** Optional vertical-align (V1 line 1945). */
  vAlign?: string
  /** Optional design-time column id (V1 line 1945). */
  columnId?: string
}

export interface TableRenderBodyCell {
  /** Raw resolved value (post field-lookup, pre-formatter). */
  value: unknown
  /**
   * Rendered HTML/text for the cell. When `isHtml === true` callers MUST emit
   * via innerHTML / v-html (by-design HTML from a formatter). When false the
   * caller MUST emit via textContent / {{ }}.
   */
  rendered: string
  /** Whether `rendered` is by-design HTML (true → innerHTML, false → text). */
  isHtml: boolean
  /** Inline style overrides from styler. Always defined (may be empty). */
  style: Record<string, string>
  /** Class names from styler (may be empty). */
  classNames: string[]
  /** Resolved rowspan. 0 means hidden via display:none (V1 G.3). */
  rowspan: number
  /** Resolved colspan. 0 means hidden via display:none (V1 G.3). */
  colspan: number
  /**
   * Whether this cell is collapsed into a previous merged cell. Caller may
   * choose to omit (v-if) or render with display:none — see V1 G.3 / 7.3.
   */
  hidden: boolean
  /** Horizontal alignment. */
  align: string
}

export interface TableRenderBodyRow {
  cells: TableRenderBodyCell[]
}

export interface TableRenderFooterCell {
  /** Footer cell text content. */
  text: string
  /** Footer cell colspan (omit when 1). */
  colspan?: number
}

export interface TableRenderFooterRow {
  cells: TableRenderFooterCell[]
}

export interface TableRenderInput {
  /** Top-level table element options. */
  options: Record<string, unknown>
  /** Bound print data (root). */
  data?: Record<string, unknown> | undefined
  /**
   * Pre-resolved `rowsColumnsMerge` function (already passed through `evalCap`
   * by the caller — this module won't compile strings).
   */
  rowsColumnsMerge?: ((...args: unknown[]) => unknown) | undefined
  /**
   * Optional fallback for the design preview when `field` doesn't resolve and
   * `testData` is malformed. V1 returns `[{}]`. Default `false` keeps the
   * Sprint 22a-r empty-state behavior; set to `true` for legacy V1 parity.
   */
  rowsFallbackPlaceholder?: boolean
}

export interface TableRenderOutput {
  /** Multi-layer header rows. `theadRows[0]` is the top row. */
  theadRows: TableRenderHeaderCell[][]
  /** Flattened leaf columns used by the body (`getOrderdColumns` output). */
  leafColumns: Array<Record<string, unknown>>
  /** Body rows. */
  bodyRows: TableRenderBodyRow[]
  /**
   * Original row objects used to build `bodyRows`. Same length and order as
   * `bodyRows`. Exposed so the designer (Vue) can pass each row through to
   * TableCell for inline-edit write-back without re-resolving.
   */
  rows: Array<Record<string, unknown>>
  /** Optional footer rows from `gridColumnsFooter`. */
  footerRows: TableRenderFooterRow[]
  /** Compiled HTML from `footerFormatter` (empty when none). */
  footerHtml: string
  /**
   * CSS class to apply to the `<table>` for V1 border variants
   * (`hiprint-printElement-tableTarget-border-<variant>`). Empty string when
   * caller should not add a border class.
   */
  borderClass: string
}

// ============ Helpers ============

/**
 * Resolve a body cell value following V1 + V3 hybrid semantics:
 *   1. Try `row[field]` flat key (V1 line 2138-2139).
 *   2. If `field` contains a dot AND the flat key is undefined, fall back to
 *      dot-path (`resolveField`). This is V3's non-breaking extension.
 *
 * Preserves 0/false/'' via the same nullish discipline as `resolveField`.
 */
export function resolveCellValue(
  row: unknown,
  field: string | undefined | null
): unknown {
  if (!field) return ''
  if (row == null || typeof row !== 'object') return ''
  // V1 fidelity: try flat key first.
  const flat = (row as Record<string, unknown>)[field]
  if (flat !== undefined) return flat
  // V3 extension: dot-path fallback. Only attempt when field contains '.'.
  if (field.indexOf('.') >= 0) {
    const nested = resolveField(row, field, undefined)
    if (nested !== undefined) return nested
  }
  return ''
}

/**
 * Resolve the top-level table-row field. V1 `getData(t)` line 6533 calls
 * `field.split('.').reduce(...)` so dot-paths ARE supported at this level
 * (different from column.field per V1-INVENTORY F.1 vs F.2). Preserves
 * 0/false/'' via `resolveField`.
 */
function resolveRowsField(
  data: Record<string, unknown> | undefined,
  field: string | undefined
): unknown[] | undefined {
  if (!field || !data) return undefined
  const v = resolveField(data, field, undefined)
  return Array.isArray(v) ? (v as unknown[]) : undefined
}

/**
 * Apply a column formatter (string or function form, V1 P.11) to a raw cell
 * value. Returns `{ rendered, isHtml }`:
 *   - When a formatter ran successfully and returned non-null, `rendered` is
 *     the string output and `isHtml === true`.
 *   - When the formatter threw, falls back to the coerced raw value with
 *     `isHtml: false` (cell still renders — Invariant #8).
 *   - When no formatter, returns the coerced value with `isHtml: false`.
 */
export function applyCellFormatter(
  value: unknown,
  formatterInput: unknown,
  args: unknown[]
): { rendered: string; isHtml: boolean } {
  const fn = compileFormatter(formatterInput)
  if (!fn) {
    return { rendered: coerceText(value), isHtml: false }
  }
  try {
    const out = fn(...args)
    return {
      rendered: out == null ? '' : String(out),
      isHtml: true,
    }
  } catch (err) {
    // Invariant #8 — cell-level error must not break the row render.
    console.warn('[hiprint] table cell formatter threw:', err)
    return { rendered: coerceText(value), isHtml: false }
  }
}

/**
 * Apply a column styler (function or string form via `compileFormatter`).
 * Returns `{ classNames, style }`. Errors caught (Invariant #8).
 *
 * V1/V2 lenient: styler may return either a string (class name) or an object
 * (may contain `class` plus arbitrary CSS-property keys).
 */
function applyCellStyler(
  styler: unknown,
  args: unknown[]
): { classNames: string[]; style: Record<string, string> } {
  const classNames: string[] = []
  const style: Record<string, string> = {}
  const fn = compileFormatter(styler)
  if (!fn) return { classNames, style }
  try {
    const r = fn(...args)
    if (typeof r === 'string' && r) {
      classNames.push(r)
    } else if (r && typeof r === 'object') {
      const obj = r as Record<string, unknown>
      if (typeof obj.class === 'string') classNames.push(obj.class)
      for (const k of Object.keys(obj)) {
        if (k === 'class') continue
        const v = obj[k]
        if (typeof v === 'string') style[k] = v
        else if (typeof v === 'number') style[k] = String(v)
      }
    }
  } catch (err) {
    console.warn('[hiprint] table cell styler threw:', err)
  }
  return { classNames, style }
}

/**
 * Normalize raw `options.columns` (1-D or 2-D) into a uniform `Array<Array>`.
 * V1 stored both shapes — we accept either.
 */
function normalizeHeaderLayers(
  columnsRaw: unknown
): Array<Array<Record<string, unknown>>> {
  if (!Array.isArray(columnsRaw) || columnsRaw.length === 0) return []
  const first = columnsRaw[0]
  if (Array.isArray(first)) {
    return (columnsRaw as unknown[]).filter((r) => Array.isArray(r)) as Array<
      Array<Record<string, unknown>>
    >
  }
  return [columnsRaw as Array<Record<string, unknown>>]
}

/**
 * Build the canonical leaf column array following V1 `getOrderdColumns`
 * (bundle line 2387-2425):
 *   1. Bottom row is the seed.
 *   2. For each cell, inherit `field` from upper layers when undefined
 *      ("把上层/其他层的 field 赋值给最下层").
 *
 * The V1 colspan/rowspan splat (1) and rowspan push-down (2) are a designer-side
 * algorithm used to compute the 2-D occupied-cell grid. For runtime rendering
 * we ONLY need the field inheritance — the bottom row is treated as the
 * canonical leaf set (matching current V3 behavior, but now with inheritance).
 *
 * Returns a new array of cloned column defs (does not mutate input).
 */
function flattenLeafColumns(
  layers: Array<Array<Record<string, unknown>>>
): Array<Record<string, unknown>> {
  if (layers.length === 0) return []
  if (layers.length === 1) {
    // Single layer — no inheritance needed; clone defensively.
    return (layers[0] ?? []).map((c) => ({ ...c }))
  }
  // Bottom layer is the canonical leaf set. Walk upward to find a `field`
  // when the leaf cell is missing one, preferring closer-by layers.
  const bottom = layers[layers.length - 1] ?? []
  return bottom.map((leaf, idx) => {
    const clone: Record<string, unknown> = { ...leaf }
    if (typeof clone.field !== 'string' || clone.field === '') {
      // Search upper layers for a cell that owns this column index.
      for (let l = layers.length - 2; l >= 0; l--) {
        const upper = layers[l] ?? []
        const cell = upper[idx]
        if (cell && typeof cell.field === 'string' && cell.field) {
          clone.field = cell.field
          break
        }
      }
    }
    return clone
  })
}

/**
 * Build the thead-rows model. Each upper layer is passed through as-is (its
 * colspan/rowspan attributes are already correct in the V1 schema). The
 * bottom layer is replaced by the flattened leaf columns so any inherited
 * `field` is reflected in the leaf row's header titles too.
 */
function buildTheadRows(
  layers: Array<Array<Record<string, unknown>>>,
  leafColumns: Array<Record<string, unknown>>
): TableRenderHeaderCell[][] {
  if (layers.length === 0) return []
  const headerRows: TableRenderHeaderCell[][] = []
  for (let i = 0; i < layers.length; i++) {
    const layer = i === layers.length - 1 ? leafColumns : layers[i] ?? []
    const row: TableRenderHeaderCell[] = layer.map((col) => {
      const cell: TableRenderHeaderCell = {
        title: coerceText(col.title),
      }
      if (typeof col.field === 'string' && col.field) cell.field = col.field
      const cs = safeNumber(col.colspan, { fallback: 1, min: 1 })
      const rs = safeNumber(col.rowspan, { fallback: 1, min: 1 })
      if (cs > 1) cell.colspan = cs
      if (rs > 1) cell.rowspan = rs
      const halign =
        (typeof col.halign === 'string' && col.halign) ||
        (typeof col.align === 'string' && col.align) ||
        undefined
      if (halign) cell.align = halign
      if (typeof col.vAlign === 'string') cell.vAlign = col.vAlign
      if (typeof col.columnId === 'string') cell.columnId = col.columnId
      return cell
    })
    headerRows.push(row)
  }
  return headerRows
}

/**
 * Resolve the body rows array. Priority follows V1 + V3 hybrid:
 *   1. `props.data[options.field]` (dot-path safe via V1 getData semantics).
 *   2. `options.testData` JSON string parse.
 *   3. `options.testData` direct array.
 *   4. Fallback: `[]` (or `[{}]` when `rowsFallbackPlaceholder: true` — V1).
 */
function resolveBodyRows(
  options: Record<string, unknown>,
  data: Record<string, unknown> | undefined,
  rowsFallbackPlaceholder: boolean
): Array<Record<string, unknown>> {
  const fieldName =
    typeof options.field === 'string' && options.field ? options.field : undefined
  // Bound print data
  if (fieldName && data) {
    const arr = resolveRowsField(data, fieldName)
    if (Array.isArray(arr)) return arr as Array<Record<string, unknown>>
  }
  // testData fallback (design-time)
  const td = options.testData
  if (typeof td === 'string') {
    try {
      const parsed = JSON.parse(td)
      if (Array.isArray(parsed)) return parsed as Array<Record<string, unknown>>
    } catch (err) {
      // V1 parity: log + fall back to placeholder row when configured.
      console.error('[hiprint] table testData parse failed:', err)
      if (rowsFallbackPlaceholder) return [{}]
      return []
    }
  } else if (Array.isArray(td)) {
    return td as Array<Record<string, unknown>>
  }
  if (rowsFallbackPlaceholder) return [{}]
  return []
}

/**
 * Build the gridColumnsFooter rows model.
 *
 * V1 stores `Array<Array<{title, text?, colspan?}>>`. Each inner array is one
 * row of footer cells.
 */
function buildFooterRows(footerRaw: unknown): TableRenderFooterRow[] {
  if (!Array.isArray(footerRaw)) return []
  const rows: TableRenderFooterRow[] = []
  for (const r of footerRaw) {
    if (!Array.isArray(r)) continue
    const cells: TableRenderFooterCell[] = r.map((c) => {
      const obj = (c ?? {}) as Record<string, unknown>
      const cell: TableRenderFooterCell = {
        text: coerceText(obj.title ?? obj.text),
      }
      const cs = safeNumber(obj.colspan, { fallback: 1, min: 1 })
      if (cs > 1) cell.colspan = cs
      return cell
    })
    rows.push({ cells })
  }
  return rows
}

/**
 * Compile + invoke `footerFormatter` (string or function form, V1 K.1).
 * Signature (V1 line 2331-2338): `(options, allData, printData, pageData, pageIndex)`.
 * Returns the formatter's HTML output (empty string on missing / error).
 */
function buildFooterHtml(
  options: Record<string, unknown>,
  allRows: Array<Record<string, unknown>>,
  printData: Record<string, unknown> | undefined
): string {
  const fn = compileFormatter(options.footerFormatter)
  if (!fn) return ''
  try {
    const out = fn(options, allRows, printData, allRows, 0)
    return out == null ? '' : String(out)
  } catch (err) {
    console.warn('[hiprint] table footerFormatter threw:', err)
    return ''
  }
}

/** Map `options.tableBorder` to V1 CSS class suffix. */
function resolveBorderClass(options: Record<string, unknown>): string {
  const variant =
    typeof options.tableBorder === 'string' ? options.tableBorder : undefined
  if (!variant) return ''
  const allowed = new Set([
    'all',
    'none',
    'lr',
    'tb',
    'lt',
    'rt',
    'lb',
    'rb',
  ])
  if (!allowed.has(variant)) return ''
  return 'hiprint-printElement-tableTarget-border-' + variant
}

// ============ Public entry ============

/**
 * Build the canonical render model for a table element. Pure transform —
 * no DOM, no Vue, no jQuery. Callers (TableElement.vue + render.ts) walk the
 * returned structure to emit their target output (reactive DOM / HTML string).
 */
export function buildTableModel(input: TableRenderInput): TableRenderOutput {
  const { options, data, rowsColumnsMerge, rowsFallbackPlaceholder } = input

  // 1. Normalize columns into 2-D layers.
  const layers = normalizeHeaderLayers(options.columns)
  const leafColumns = flattenLeafColumns(layers)

  // 2. Build thead model.
  const theadRows = buildTheadRows(layers, leafColumns)

  // 3. Resolve body rows.
  const rows = resolveBodyRows(options, data, rowsFallbackPlaceholder === true)

  // 4. Build body cells (per-cell formatter + styler + row-merge resolution).
  const bodyRows: TableRenderBodyRow[] = rows.map((row, rIdx) => {
    const cells: TableRenderBodyCell[] = leafColumns.map((col, cIdx) => {
      const field = typeof col.field === 'string' ? col.field : undefined
      const value = resolveCellValue(row, field)
      // Per-cell row-merge call (V1 G.1 — function signature).
      let rowspan = 1
      let colspan = 1
      if (typeof rowsColumnsMerge === 'function') {
        try {
          const r = rowsColumnsMerge(row, col, cIdx, rIdx, rows, data)
          if (Array.isArray(r) && r.length >= 2) {
            const rs = typeof r[0] === 'number' ? r[0] : 1
            const cs = typeof r[1] === 'number' ? r[1] : 1
            rowspan = rs
            colspan = cs
          }
        } catch (err) {
          // Invariant #8 — cell-level merge throw doesn't crash row.
          console.error(
            '[hiprint] rowsColumnsMerge call failed (cell-level):',
            err
          )
        }
      }
      const hidden = rowspan === 0 || colspan === 0
      // Formatter (column.formatter — string or function, V1 P.11).
      const formatterArgs: unknown[] = [value, row, col, rows]
      const { rendered, isHtml } = applyCellFormatter(
        value,
        col.formatter,
        formatterArgs
      )
      // Styler (function or string form, same compileFormatter path).
      const stylerArgs: unknown[] = [value, row, col, rows]
      const { classNames, style } = applyCellStyler(col.styler, stylerArgs)
      const align =
        (typeof col.halign === 'string' && col.halign) ||
        (typeof col.align === 'string' && col.align) ||
        'left'
      return {
        value,
        rendered,
        isHtml,
        style,
        classNames,
        rowspan,
        colspan,
        hidden,
        align,
      }
    })
    return { cells }
  })

  // 5. Footer rows + footerFormatter.
  const footerRows = buildFooterRows(options.gridColumnsFooter)
  const footerHtml = buildFooterHtml(options, rows, data)

  // 6. Border class.
  const borderClass = resolveBorderClass(options)

  return {
    theadRows,
    leafColumns,
    bodyRows,
    rows,
    footerRows,
    footerHtml,
    borderClass,
  }
}
