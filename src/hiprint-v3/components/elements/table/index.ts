/**
 * table/index.ts — V3 table-etype barrel (P17.3).
 *
 * Exports the three Vue 3 SFCs that collectively replace V2's
 * `src/hiprint-v2/core/etypes/table/` module (cell.js + excel-helper.js +
 * inline-editor.js + print-element.js + row-merge.js — ~1500 LoC of jQuery
 * DOM mutation).
 *
 * Public surface:
 *  - {@link TableElement}      — orchestrator (mount this from your canvas)
 *  - {@link TableCell}         — single `<td>` (composed by TableElement)
 *  - {@link TableInlineEditor} — dblclick edit `<input>` / `<select>`
 *
 * Imported by the parent `components/elements/index.ts` (re-exported alongside
 * Text / Image / Barcode / ... components). The parent barrel is owned by the
 * non-table P17.x agent; this file is the local sub-barrel.
 */

export { default as TableElement } from './TableElement.vue'
export { default as TableCell } from './TableCell.vue'
export { default as TableInlineEditor } from './TableInlineEditor.vue'
