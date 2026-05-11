<script setup lang="ts">
/**
 * TablePropertyPanel.vue — V3 property editor for `tableCustom` etype (PP-009).
 *
 * Provides three sections:
 *  1. Columns — per-column inline editor (title / field / width / align) with
 *     reorder (↑↓) and delete (✕) controls. "+ Add column" appends a default
 *     column to the FIRST header layer (row 0).
 *  2. Header / Footer — columnHeader toggle (repeat header per page),
 *     headerType select (none/group), footer raw-HTML textarea.
 *  3. Rows — rowsPerPage / maxPage / rowHeight / alternateRowColor.
 *
 * V3 columns shape ([V3] TableElement.vue ~81–95):
 *   options.columns: Array<Array<{ title, field, width, align|halign,
 *                                  colspan?, rowspan?, format? }>>
 * The outer array is "header layers" (multi-layer headers supported). This
 * panel edits the FIRST layer's column list for simplicity — multi-layer
 * editing is out of scope for PP-009 (the editor preserves additional layers
 * untouched via `columns.map(r => r.slice())`).
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
 *
 * Intentionally NOT included (out of scope per task):
 *  - Multi-layer header row editing (only row 0 in UI).
 *  - gridColumnsFooter structured editor — `footer` textarea is treated as
 *    raw HTML per V1 parity (matches task spec verbatim). The V3 renderer
 *    currently only consumes `gridColumnsFooter`; a follow-up task wires
 *    `footer` HTML through the render layer.
 *
 * Wave 2 integration (Stream D):
 *  HiprintPropertyPanel.vue will dispatch on `elementType === 'tableCustom'`
 *  and mount this SFC. This file does NOT import / modify that orchestrator.
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

function onColumnHeader(ev: Event): void {
  const target = ev.target as HTMLInputElement | null
  if (!target) return
  patch({ columnHeader: !!target.checked }, true)
}

function onHeaderType(ev: Event): void {
  const target = ev.target as HTMLSelectElement | null
  if (!target) return
  patch({ headerType: target.value }, true)
}

function onFooter(ev: Event): void {
  const target = ev.target as HTMLTextAreaElement | null
  if (!target) return
  patch({ footer: target.value }, true)
}

function numFromInput(ev: Event, fallback: number): number {
  const target = ev.target as HTMLInputElement | null
  if (!target) return fallback
  const n = Number(target.value)
  return Number.isFinite(n) ? n : fallback
}

function onRowsPerPage(ev: Event): void {
  patch({ rowsPerPage: numFromInput(ev, 0) }, true)
}
function onMaxPage(ev: Event): void {
  patch({ maxPage: numFromInput(ev, 0) }, true)
}
function onRowHeight(ev: Event): void {
  patch({ rowHeight: numFromInput(ev, 20) }, true)
}
function onAltRowColor(ev: Event): void {
  const target = ev.target as HTMLInputElement | null
  if (!target) return
  patch({ alternateRowColor: String(target.value) }, true)
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
      <label class="inline">
        <input
          type="checkbox"
          :checked="!!opts.columnHeader"
          @change="onColumnHeader"
        />
        Repeat header on each page
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
      <label>
        Footer (HTML)
        <textarea
          rows="3"
          :value="String(opts.footer ?? '')"
          @change="onFooter"
        />
      </label>
    </fieldset>

    <!-- Section 3. Rows -->
    <fieldset class="hiprint-property-fieldset">
      <legend>Rows</legend>
      <label>
        Rows per page
        <input
          type="number"
          min="0"
          class="rows-per-page"
          :value="Number(opts.rowsPerPage ?? 0)"
          @change="onRowsPerPage"
        />
      </label>
      <label>
        Max pages
        <input
          type="number"
          min="0"
          class="max-page"
          :value="Number(opts.maxPage ?? 0)"
          @change="onMaxPage"
        />
      </label>
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
      <label>
        Alternate row color
        <input
          type="color"
          class="alt-row-color"
          :value="String(opts.alternateRowColor ?? '#fafafa')"
          @change="onAltRowColor"
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
