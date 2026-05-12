<script setup lang="ts">
/**
 * TablePropertyPanel.vue — V3 property editor for the `table` etype.
 *
 * TKT-009 rollback (Sprint 22a-r): four invented options that V1 never had
 * (`rowsPerPage`, `maxPage`, `alternateRowColor`, raw-HTML `footer` textarea)
 * have been removed. They violated V1 parity in three ways:
 *   1. `rowsPerPage` / `maxPage` — V1 inventory P.8 explicitly says these
 *      fields do not exist on V1 tables. V3 was inventing options the
 *      contract V1 round-trip will discard. See `docs/V3-PARITY-MATRIX/06-table.md`
 *      VIOLATION 2.13 / 2.14 / 16.1 / 16.2.
 *   2. `alternateRowColor` — V1 only has the vestigial `striped` boolean
 *      (bundle 9182). The colour-picker variant V3 invented was also a
 *      dead-letter (no renderer ever read it). Matrix VIOLATION 2.62 / 16.4.
 *   3. `footer` (raw HTML textarea) — V1 instead has `footerFormatter`,
 *      a function-string compiled with `new Function('return '+src)()`
 *      (bundle 2038-2041, 2331-2338). V3's `footer` textarea was a
 *      dead-letter never consumed by render layer. Matrix VIOLATION 11.2 / 16.7.
 *
 * What this panel now exposes (V1-faithful subset, see V1 inventory P.5-P.9):
 *  1. Columns — per-column inline editor (title / field / width / align)
 *     with reorder (↑↓) and delete (✕) controls. "+ Add column" appends
 *     to the FIRST header layer (row 0). Multi-layer header editing remains
 *     out of scope (preserved untouched via `columns.map(r => r.slice())`).
 *  2. Header / Footer
 *     - `tableHeaderRepeat` — three-state select (every / first / none),
 *       matches V1 bundle 6308. **Replaces** the boolean `columnHeader`
 *       toggle. The old `columnHeader` option was a wrong-type contract
 *       (matrix VIOLATION 16.5).
 *     - `tableFooterRepeat` — three-state select (every / last / no),
 *       matches V1 bundle 6309.
 *     - `headerType` — preserved (none / group) for current callers.
 *     - `footerFormatter` — function-string textarea (monospace) with
 *       JSDoc-style hint. JSON persistence is the literal string source;
 *       compilation (`new Function('return '+src)()`) is the renderer's
 *       responsibility (TKT-022 wires the compile pipeline; this panel
 *       only writes the string).
 *  3. Rows — `rowHeight` only (the V1-faithful field). `rowsPerPage`,
 *     `maxPage`, `alternateRowColor` were removed.
 *
 * V3 columns shape (TableElement.vue ~81–95):
 *   options.columns: Array<Array<{ title, field, width, align|halign,
 *                                  colspan?, rowspan?, format? }>>
 *
 * Mutation path:
 *  canvas.updateElement(panelId, elementId, { options: { ... } })
 *    → applyElementPatch shallow-merges options
 *    → history.pushSnapshot() on commit
 *
 * Locked invariants:
 *  - All edits use Vue templating ({{ }}) and `:value` bindings — no
 *    `innerHTML` / `v-html` for user content (XSS).
 *  - Column updates create a fresh `columns` array (immutable patch),
 *    so reactivity + history snapshots fire correctly.
 *  - boundary moveColumn (col 0 up, last col down) is a no-op.
 *  - `footerFormatter` is persisted as a STRING — not a Function — so it
 *    survives JSON round-trip back to V1 (which compiles on demand).
 */
import { computed } from 'vue'
import {
  useCanvasStore,
  useHistoryStore,
  type CanvasElement,
} from '@hiprint-v3/stores'

const props = defineProps<{ element: CanvasElement }>()
const canvas = useCanvasStore()
const history = useHistoryStore()

// ============ Derived ============

const opts = computed<Record<string, unknown>>(
  () => (props.element.options as Record<string, unknown>) ?? {}
)

/**
 * Normalize `options.columns` to `Array<Array<col>>`. Falls back to a single
 * empty layer when absent or malformed. Single-layer legacy shape
 * (`Array<col>`) is wrapped, mirroring TableElement.vue's headerLayers logic.
 */
const columns = computed<Array<Array<Record<string, unknown>>>>(() => {
  const raw = opts.value['columns']
  if (!Array.isArray(raw) || raw.length === 0) return [[]]
  const first = raw[0]
  if (Array.isArray(first)) {
    return raw as Array<Array<Record<string, unknown>>>
  }
  return [raw as Array<Record<string, unknown>>]
})

// ============ Update flow ============

/**
 * Patch the active element's options. `applyElementPatch` shallow-merges
 * options so passing `{ columns: next }` only replaces the columns key.
 * Pushes a history snapshot when `commit=true`.
 */
function patch(p: Record<string, unknown>, commit = false): void {
  const panelId = canvas.activePanelId
  if (!panelId) return
  canvas.updateElement(panelId, props.element.id, { options: p })
  if (commit) history.pushSnapshot()
}

/** Clone columns immutably (row arrays + outer array fresh). */
function cloneColumns(): Array<Array<Record<string, unknown>>> {
  return columns.value.map((r) => r.slice())
}

function updateColumn(
  rowIdx: number,
  colIdx: number,
  patchCol: Record<string, unknown>
): void {
  const next = cloneColumns()
  const row = next[rowIdx]
  if (!row || colIdx < 0 || colIdx >= row.length) return
  row[colIdx] = { ...row[colIdx], ...patchCol }
  patch({ columns: next }, true)
}

function addColumn(): void {
  const next = cloneColumns()
  if (next.length === 0) next.push([])
  const row0 = next[0]!
  row0.push({
    title: 'col' + (row0.length + 1),
    field: '',
    width: 100,
    align: 'left',
  })
  patch({ columns: next }, true)
}

function removeColumn(rowIdx: number, colIdx: number): void {
  const next = cloneColumns()
  const row = next[rowIdx]
  if (!row || colIdx < 0 || colIdx >= row.length) return
  row.splice(colIdx, 1)
  patch({ columns: next }, true)
}

function moveColumn(rowIdx: number, colIdx: number, dir: -1 | 1): void {
  const next = cloneColumns()
  const row = next[rowIdx]
  if (!row) return
  const newIdx = colIdx + dir
  if (newIdx < 0 || newIdx >= row.length) return
  const tmp = row[colIdx]!
  row[colIdx] = row[newIdx]!
  row[newIdx] = tmp
  patch({ columns: next }, true)
}

// ============ Field-level handlers ============

function onTableHeaderRepeat(ev: Event): void {
  const target = ev.target as HTMLSelectElement | null
  if (!target) return
  patch({ tableHeaderRepeat: target.value }, true)
}

function onTableFooterRepeat(ev: Event): void {
  const target = ev.target as HTMLSelectElement | null
  if (!target) return
  patch({ tableFooterRepeat: target.value }, true)
}

function onHeaderType(ev: Event): void {
  const target = ev.target as HTMLSelectElement | null
  if (!target) return
  patch({ headerType: target.value }, true)
}

/**
 * Write the function-source string for `footerFormatter`. V1 persists
 * formatters as raw source (`"function(opts, allData, ...){ return '<tr>...</tr>' }"`)
 * and compiles on demand with `new Function('return ' + src)()`. We keep that
 * contract: the panel writes a string, the renderer (TKT-022 compileFormatter)
 * is responsible for compilation. Writing an empty string clears the option.
 */
function onFooterFormatter(ev: Event): void {
  const target = ev.target as HTMLTextAreaElement | null
  if (!target) return
  patch({ footerFormatter: target.value }, true)
}

function numFromInput(ev: Event, fallback: number): number {
  const target = ev.target as HTMLInputElement | null
  if (!target) return fallback
  const n = Number(target.value)
  return Number.isFinite(n) ? n : fallback
}

function onRowHeight(ev: Event): void {
  patch({ rowHeight: numFromInput(ev, 20) }, true)
}

function colString(col: Record<string, unknown>, key: string, fb = ''): string {
  const v = col[key]
  return v == null ? fb : String(v)
}
function colNumber(col: Record<string, unknown>, key: string, fb: number): number {
  const v = col[key]
  if (v == null) return fb
  const n = Number(v)
  return Number.isFinite(n) ? n : fb
}
</script>

<template>
  <div class="hiprint-table-property-panel" aria-label="Table properties">
    <!-- Section 1. Columns -->
    <fieldset class="hiprint-property-fieldset">
      <legend>Columns</legend>
      <div
        v-for="(row, ri) in columns"
        :key="`row-${ri}`"
        class="hiprint-table-col-section"
      >
        <div
          v-for="(col, ci) in row"
          :key="`col-${ri}-${ci}`"
          class="hiprint-table-col-row"
        >
          <input
            type="text"
            class="col-title"
            :value="colString(col, 'title')"
            placeholder="title"
            aria-label="Column title"
            @change="
              updateColumn(ri, ci, {
                title: ($event.target as HTMLInputElement).value,
              })
            "
          />
          <input
            type="text"
            class="col-field"
            :value="colString(col, 'field')"
            placeholder="field"
            aria-label="Column field"
            @change="
              updateColumn(ri, ci, {
                field: ($event.target as HTMLInputElement).value,
              })
            "
          />
          <input
            type="number"
            min="20"
            class="col-width"
            :value="colNumber(col, 'width', 100)"
            aria-label="Column width"
            @change="
              updateColumn(ri, ci, {
                width: Number(($event.target as HTMLInputElement).value || 100),
              })
            "
          />
          <select
            class="col-align"
            :value="colString(col, 'align', 'left')"
            aria-label="Column align"
            @change="
              updateColumn(ri, ci, {
                align: ($event.target as HTMLSelectElement).value,
              })
            "
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
          <button
            type="button"
            class="hiprint-property-toggle"
            :disabled="ci === 0"
            aria-label="Move column up"
            @click="moveColumn(ri, ci, -1)"
          >
            ↑
          </button>
          <button
            type="button"
            class="hiprint-property-toggle"
            :disabled="ci >= row.length - 1"
            aria-label="Move column down"
            @click="moveColumn(ri, ci, 1)"
          >
            ↓
          </button>
          <button
            type="button"
            class="hiprint-property-toggle col-delete"
            aria-label="Delete column"
            @click="removeColumn(ri, ci)"
          >
            ✕
          </button>
        </div>
      </div>
      <button
        type="button"
        class="hiprint-property-toggle col-add"
        @click="addColumn"
      >
        + Add column
      </button>
    </fieldset>

    <!-- Section 2. Header / Footer -->
    <fieldset class="hiprint-property-fieldset">
      <legend>Header / Footer</legend>
      <!--
        TKT-009: replaced boolean `columnHeader` checkbox with V1's
        `tableHeaderRepeat` 3-state select (bundle 6308, matrix 2.8 / 16.5).
      -->
      <label>
        Header repeat
        <select
          class="table-header-repeat"
          :value="String(opts.tableHeaderRepeat ?? 'every')"
          @change="onTableHeaderRepeat"
        >
          <option value="every">Every page</option>
          <option value="first">First page only</option>
          <option value="none">None</option>
        </select>
      </label>
      <!--
        TKT-009: new V1-faithful `tableFooterRepeat` 3-state select
        (bundle 6309, matrix 2.9). Previously missing from V3 panel.
      -->
      <label>
        Footer repeat
        <select
          class="table-footer-repeat"
          :value="String(opts.tableFooterRepeat ?? 'last')"
          @change="onTableFooterRepeat"
        >
          <option value="every">Every page</option>
          <option value="last">Last page only</option>
          <option value="no">No</option>
        </select>
      </label>
      <label>
        Header type
        <select
          :value="String(opts.headerType ?? '')"
          @change="onHeaderType"
        >
          <option value="">None</option>
          <option value="group">Group</option>
        </select>
      </label>
      <!--
        TKT-009: replaced raw-HTML `footer` textarea (V3-invented, dead-letter)
        with V1's `footerFormatter` function-source textarea (bundle
        2038-2041, 2331-2338, matrix 11.2 / 16.7). JSON persists the
        literal string; renderer compiles via `new Function('return '+src)()`
        (TKT-022 wires the compile pipeline).
      -->
      <label>
        Footer formatter (function source)
        <textarea
          class="footer-formatter"
          rows="4"
          spellcheck="false"
          :value="String(opts.footerFormatter ?? '')"
          placeholder="function(options, allData, printData, pageData, pageIndex){\n  return '<tr><td colspan=&quot;3&quot;>summary</td></tr>'\n}"
          @change="onFooterFormatter"
        />
      </label>
    </fieldset>

    <!-- Section 3. Rows -->
    <fieldset class="hiprint-property-fieldset">
      <legend>Rows</legend>
      <!--
        TKT-009: rolled back invented options. `rowsPerPage`, `maxPage`
        (matrix 2.13 / 2.14 / 16.1 / 16.2) and `alternateRowColor`
        (matrix 2.62 / 16.4) were removed — V1 has no such fields.
        `rowHeight` is retained as a V1-aligned ergonomic option.
      -->
      <label>
        Row height (pt)
        <input
          type="number"
          min="10"
          class="row-height"
          :value="Number(opts.rowHeight ?? 20)"
          @change="onRowHeight"
        />
      </label>
    </fieldset>
  </div>
</template>

<style scoped>
.hiprint-table-property-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: #fafafa;
  font-size: 12px;
  color: #333;
}
.hiprint-property-fieldset {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid #e5e5e5;
  border-radius: 4px;
  padding: 8px 10px;
  margin: 0;
  background: #fff;
}
.hiprint-property-fieldset legend {
  font-weight: 600;
  padding: 0 4px;
  color: #555;
}
.hiprint-property-fieldset label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: #666;
}
.hiprint-property-fieldset label.inline {
  flex-direction: row;
  align-items: center;
  gap: 6px;
}
.hiprint-property-fieldset input[type='text'],
.hiprint-property-fieldset input[type='number'],
.hiprint-property-fieldset select,
.hiprint-property-fieldset textarea {
  min-height: 26px;
  padding: 4px 6px;
  border: 1px solid #d9d9d9;
  border-radius: 3px;
  font: inherit;
  color: #333;
  background: #fff;
}
.hiprint-property-fieldset textarea.footer-formatter {
  font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
  font-size: 11px;
  line-height: 1.45;
  white-space: pre;
  overflow: auto;
}
.hiprint-table-col-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.hiprint-table-col-row {
  display: flex;
  gap: 4px;
  align-items: center;
}
.hiprint-table-col-row input.col-title,
.hiprint-table-col-row input.col-field {
  flex: 1;
  min-width: 60px;
}
.hiprint-table-col-row input.col-width {
  width: 60px;
}
.hiprint-table-col-row select.col-align {
  width: 80px;
}
.hiprint-property-toggle {
  min-width: 28px;
  height: 26px;
  padding: 0 6px;
  background: #fff;
  border: 1px solid #d9d9d9;
  border-radius: 3px;
  cursor: pointer;
  font: inherit;
}
.hiprint-property-toggle:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.hiprint-property-toggle:hover:not(:disabled) {
  background: #f0f0f0;
}
</style>
