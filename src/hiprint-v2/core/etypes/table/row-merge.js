/**
 * row-merge.js — rowsColumnsMerge eval + cell-level call wrapper (V2).
 *
 * V1 source: bundle.js line 2102-2116 (inline in TableExcelHelper.createRowTarget).
 *
 * Invariants (V2 必须保留):
 *  - [R3 silent #2] cell-level call wrapped in try/catch — a thrown rowsColumnsMerge
 *    used to bubble out of forEach and silently break the whole row render (empty
 *    table). 必须以 [1,1] fallback 继续。
 *  - [security] rowsColumnsMerge source 走 evalCap (5000 chars), 防 DOS via massive
 *    user-supplied function body in template JSON.
 *  - Return shape: [rowspan, colspan]. 0 维度表示该 cell 应当合并到上方/左侧
 *    (CSS display:none), 非 falsy 维度 ≥ 1.
 */

import { evalCap } from '@hiprint-v2/internal'

/**
 * Resolve rowsColumnsMerge source (string) to a function. Uses evalCap (security).
 *
 * V1 line 2104: `new Function('return ' + n.rowsColumnsMerge)()`
 *
 * @param {string|Function|undefined} src  options.rowsColumnsMerge (template JSON 反序列化结果)
 * @returns {Function|undefined}
 */
export function resolveRowsColumnsMerge(src) {
  if (!src) return undefined
  if (typeof src === 'function') return src
  return evalCap(src, 'rowsColumnsMerge')
}

/**
 * Compute [rowspan, colspan] for one cell. Wraps the business fn call in
 * try/catch (R3 silent #2). 失败 fallback 到 [1, 1].
 *
 * Signature matches V1 callback contract:
 *   rowsColumnsMerge(rowData, columnDef, columnIndex, rowIndex, tableData, printData) → [rs, cs]
 *
 * @param {Function|undefined} fn
 * @param {*} rowData
 * @param {object} columnDef
 * @param {number} columnIndex
 * @param {number} rowIndex
 * @param {Array} tableData
 * @param {*} printData
 * @returns {[number, number]}
 */
export function applyRowsColumnsMerge(fn, rowData, columnDef, columnIndex, rowIndex, tableData, printData) {
  if (typeof fn !== 'function') return [1, 1]
  try {
    const result = fn(rowData, columnDef, columnIndex, rowIndex, tableData, printData)
    if (!result || !Array.isArray(result) || result.length < 2) return [1, 1]
    return [result[0], result[1]]
  } catch (err) {
    // [R3 silent #2] log + degrade — never let throw bubble out and break the row.
    console.error('[hiprint] rowsColumnsMerge call failed (cell-level):', err)
    return [1, 1]
  }
}
