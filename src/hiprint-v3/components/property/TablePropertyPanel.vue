<script setup lang="ts">
/**
 * TablePropertyPanel.vue — V3 property editor for the `table` etype.
 *
 * Sprint 22c Stream CE adds the USER-INTERACTION layer on top of the Sprint
 * 22b BB render-table data layer:
 *  - TKT-105 multi-layer header UI (layer tabs + add/remove layer).
 *  - TKT-106 merge cells UI (colspan/rowspan inputs + "merge with right"
 *    button).
 *  - TKT-107 right-click thead context menu is wired from TableElement.vue;
 *    this panel exposes the same mutations via mouse-friendly controls.
 *
 * Earlier sprint history (TKT-009 / Sprint 22a-r rollback): four invented
 * options that V1 never had (`rowsPerPage`, `maxPage`, `alternateRowColor`,
 * raw-HTML `footer` textarea) were removed. See git history for context.
 *
 * V3 columns shape (matches render-table.ts + V1-INVENTORY §D.1):
 *   options.columns: Array<Array<{ title, field, width, align|halign,
 *                                  colspan?, rowspan?, format? }>>
 *
 * Mutation paths:
 *  - Direct property edits (title / field / width / align): go through local
 *    `patch()` helper → canvas.updateElement + history.pushSnapshot.
 *  - Layer add/remove + colspan/rowspan: delegate to `stores/table-ops.ts`
 *    helpers (single source of truth so right-click context menu hits the
 *    SAME mutation logic — important for the V1 P.9 "thead-only" right-click).
 *
 * Live element resolution: we read `element` from the canvas store by id
 * rather than relying on `props.element` because the dispatcher
 * (HiprintPropertyPanel) only re-emits a fresh prop on its next tick after
 * `applyElementPatch` produces a new object. Reading via the store keeps the
 * panel in sync the moment a mutation lands — needed for multi-click
 * interactions (e.g. press "Merge with right" twice in a row to bump colspan
 * 1→2→3 in the same render frame).
 *
 * Locked invariants:
 *  - All edits use Vue templating (`{{ }}`) and `:value` bindings — no
 *    `innerHTML` / `v-html` for user content (XSS).
 *  - Column updates create a fresh `columns` array (immutable patch), so
 *    reactivity + history snapshots fire correctly.
 *  - boundary moveColumn (col 0 up, last col down) is a no-op.
 *  - `footerFormatter` is persisted as a STRING — not a Function — so it
 *    survives JSON round-trip back to V1 (which compiles on demand).
 *  - At least 1 header layer is preserved (table-ops enforces this; the ✕
 *    on the only layer is hidden client-side so users see the constraint).
 */
import { computed, ref } from 'vue'
import {
  useCanvasStore,
  useHistoryStore,
  addTableHeaderLayer,
  removeTableHeaderLayer,
  setTableColspan,
  setTableRowspan,
  type CanvasElement,
} from '@hiprint-v3/stores'

const props = defineProps<{ element: CanvasElement }>()
const canvas = useCanvasStore()
const history = useHistoryStore()

// ============ Derived ============

/**
 * Look up the live element via canvas store by id. `props.element` is a
 * snapshot taken when the parent dispatcher last evaluated its `single`
 * computed; subsequent applyElementPatch calls produce a NEW object but the
 * prop only refreshes on the next parent tick. Reading from the store
 * directly closes that gap so multi-step mutations (colspan++ twice in the
 * same handler chain) read fresh state. Falls back to `props.element` when
 * the store doesn't yet contain the id (synthetic test mounts).
 */
const liveElement = computed<CanvasElement>(() => {
  const live = canvas.allElements.find((e) => e.id === props.element.id)
  return live ?? props.element
})

const opts = computed<Record<string, unknown>>(
  () => (liveElement.value.options as Record<string, unknown>) ?? {}
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

/**
 * TKT-105: track which header layer the user is editing.
 *
 * We use `null` to mean "user has not explicitly picked one" so we can
 * default to the LEAF layer (the row whose `field`s pull body data — see
 * render-table.ts flattenLeafColumns) without permanently overriding the
 * user's choice. As soon as setActiveLayer is called, the explicit pick
 * sticks until layers are removed (when we clamp).
 */
const activeLayerIdx = ref<number | null>(null)

const safeActiveLayerIdx = computed(() => {
  const n = columns.value.length
  if (n === 0) return 0
  // No explicit pick → default to leaf (V1 H.4: leaf is the editable row).
  if (activeLayerIdx.value == null) return n - 1
  if (activeLayerIdx.value >= n) return n - 1
  if (activeLayerIdx.value < 0) return 0
  return activeLayerIdx.value
})

function setActiveLayer(idx: number): void {
  activeLayerIdx.value = idx
}

// ============ Update flow ============

/**
 * Patch the active element's options. `applyElementPatch` shallow-merges
 * options so passing `{ columns: next }` only replaces the columns key.
 * Pushes a history snapshot when `commit=true`.
 */
function patch(p: Record<string, unknown>, commit = false): void {
  const panelId = canvas.activePanelId
  if (!panelId) return
  canvas.updateElement(panelId, liveElement.value.id, { options: p })
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

/**
 * TKT-105: append column to the ACTIVE layer (was hard-coded to layer 0).
 * For multi-layer headers, users typically edit the bottom (leaf) layer; for
 * single-layer the active layer is 0 anyway.
 */
function addColumn(): void {
  const next = cloneColumns()
  if (next.length === 0) next.push([])
  const li = Math.min(safeActiveLayerIdx.value, next.length - 1)
  const row = next[li]!
  row.push({
    title: 'col' + (row.length + 1),
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

// ============ TKT-105 — layer management ============

/**
 * Append a new header layer at the bottom (becomes the new leaf row).
 * Delegates to table-ops (single mutation path; pushes history).
 */
function addLayer(): void {
  if (!liveElement.value?.id) return
  addTableHeaderLayer(liveElement.value.id)
  // After addLayer, columns.value.length has increased by 1; the new bottom
  // is the new leaf. Setting to null lets safeActiveLayerIdx pick the new
  // leaf naturally.
  activeLayerIdx.value = null
}

/**
 * Remove the layer at `idx`. table-ops refuses to drop the last layer
 * (≥ 1 invariant). After removal we clamp the active layer.
 */
function removeLayer(idx: number): void {
  if (!liveElement.value?.id) return
  if (columns.value.length <= 1) return
  removeTableHeaderLayer(liveElement.value.id, idx)
  const surviving = Math.max(0, columns.value.length - 1)
  if (activeLayerIdx.value != null && activeLayerIdx.value >= surviving) {
    activeLayerIdx.value = surviving
  }
}

// ============ Sprint 22g wave 3 — column-level expanded options ============

/**
 * Per-column "Advanced" panel collapse state. Maps a stable key (layer + idx)
 * to a boolean. Kept on the panel (not persisted) so users can collapse
 * without polluting the JSON.
 *
 * V1 V1-INVENTORY Section O.2 / O.3 — column-level options that legacy
 * property panel exposed via `tableColumn.supportOptions` (config 1779-1875).
 */
const colAdvancedOpen = ref<Record<string, boolean>>({})

function colKey(layerIdx: number, columnIdx: number): string {
  return layerIdx + ':' + columnIdx
}

function isColAdvancedOpen(layerIdx: number, columnIdx: number): boolean {
  return colAdvancedOpen.value[colKey(layerIdx, columnIdx)] === true
}

function toggleColAdvanced(layerIdx: number, columnIdx: number): void {
  const k = colKey(layerIdx, columnIdx)
  colAdvancedOpen.value = {
    ...colAdvancedOpen.value,
    [k]: !colAdvancedOpen.value[k],
  }
}

function onColString(
  layerIdx: number,
  columnIdx: number,
  key: string,
  ev: Event
): void {
  const target = ev.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null
  if (!target) return
  updateColumn(layerIdx, columnIdx, { [key]: target.value })
}

function onColNumber(
  layerIdx: number,
  columnIdx: number,
  key: string,
  ev: Event,
  fallback: number
): void {
  const target = ev.target as HTMLInputElement | null
  if (!target) return
  const n = Number(target.value)
  updateColumn(layerIdx, columnIdx, { [key]: Number.isFinite(n) ? n : fallback })
}

function onColBool(
  layerIdx: number,
  columnIdx: number,
  key: string,
  ev: Event
): void {
  const target = ev.target as HTMLInputElement | null
  if (!target) return
  updateColumn(layerIdx, columnIdx, { [key]: target.checked })
}

function colBool(col: Record<string, unknown>, key: string, fb = false): boolean {
  const v = col[key]
  if (v === undefined || v === null) return fb
  return v !== false && v !== '' && v !== 0 && v !== '0'
}

// ============ Sprint 22g wave 3 — table-level style + advanced handlers ============

function onTableNumber(key: string, ev: Event, fallback: number): void {
  const target = ev.target as HTMLInputElement | null
  if (!target) return
  const n = Number(target.value)
  patch({ [key]: Number.isFinite(n) ? n : fallback }, true)
}

function onTableString(key: string, ev: Event): void {
  const target = ev.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null
  if (!target) return
  patch({ [key]: target.value }, true)
}

function onTableBool(key: string, ev: Event): void {
  const target = ev.target as HTMLInputElement | null
  if (!target) return
  patch({ [key]: target.checked }, true)
}

// ============ TKT-106 — merge cells UI ============

/**
 * "Merge with right" button: increment colspan on the current cell by 1.
 * Render-table's expandColumns logic computes which subsequent cells become
 * hidden (display:none) based on the merged cell's colspan + the row-merge
 * function. The property panel only writes the colspan number.
 */
function mergeWithRight(layerIdx: number, columnIdx: number): void {
  if (!liveElement.value?.id) return
  const layer = columns.value[layerIdx]
  if (!layer) return
  const cur = layer[columnIdx]
  if (!cur) return
  const currentSpan =
    typeof cur.colspan === 'number' && cur.colspan >= 1 ? cur.colspan : 1
  setTableColspan(liveElement.value.id, layerIdx, columnIdx, currentSpan + 1)
}

function onColspanInput(
  layerIdx: number,
  columnIdx: number,
  ev: Event
): void {
  if (!liveElement.value?.id) return
  const target = ev.target as HTMLInputElement | null
  if (!target) return
  const n = Number(target.value)
  setTableColspan(
    liveElement.value.id,
    layerIdx,
    columnIdx,
    Number.isFinite(n) ? n : 1
  )
}

function onRowspanInput(
  layerIdx: number,
  columnIdx: number,
  ev: Event
): void {
  if (!liveElement.value?.id) return
  const target = ev.target as HTMLInputElement | null
  if (!target) return
  const n = Number(target.value)
  setTableRowspan(
    liveElement.value.id,
    layerIdx,
    columnIdx,
    Number.isFinite(n) ? n : 1
  )
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
 * formatters as raw source (e.g. `"function(opts, ...) { return '...' }"`)
 * and compiles on demand with `new Function('return ' + src)()`. We keep
 * that contract: the panel writes a string, the renderer compiles it.
 * Writing an empty string clears the option.
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
    <!--
      Section 1. Columns (TKT-105 multi-layer + TKT-106 merge cells)

      Layer tabs: one button per header LAYER (top-down). Active layer is
      highlighted; clicking switches the visible column list. "+ Add layer"
      appends a new bottom layer. The ✕ on each tab removes that layer; not
      rendered when only 1 layer exists (≥ 1 invariant).

      Within the active layer, each column row exposes:
      - title / field / width / align (V1 H.4)
      - colspan / rowspan inputs (TKT-106 — write to render-table model)
      - "Merge →" button (TKT-106 — increment colspan by 1)
      - move up / down / delete (V1 H.3 reorder)
    -->
    <fieldset class="hiprint-property-fieldset">
      <legend>Columns</legend>

      <div
        class="hiprint-table-layer-tabs"
        role="tablist"
        aria-label="Header layers"
      >
        <button
          v-for="(_layer, li) in columns"
          :key="`tab-${li}`"
          type="button"
          role="tab"
          :aria-selected="li === safeActiveLayerIdx"
          :class="[
            'hiprint-property-toggle',
            'layer-tab',
            li === safeActiveLayerIdx ? 'is-active' : null,
            // TKT-250 — co-emit V1 legacy `.active` for caller CSS.
            li === safeActiveLayerIdx ? 'active' : null,
          ]"
          @click="setActiveLayer(li)"
        >
          <span>Layer {{ li + 1 }}</span>
          <span
            v-if="columns.length > 1"
            class="layer-tab-remove"
            role="button"
            tabindex="0"
            aria-label="Remove this layer"
            @click.stop="removeLayer(li)"
            @keydown.enter.stop="removeLayer(li)"
            @keydown.space.stop="removeLayer(li)"
          >
            ✕
          </span>
        </button>
        <button
          type="button"
          class="hiprint-property-toggle layer-add"
          aria-label="Add header layer"
          @click="addLayer"
        >
          + Add layer
        </button>
      </div>

      <div
        v-if="columns[safeActiveLayerIdx]"
        class="hiprint-table-col-section"
        :data-layer-idx="safeActiveLayerIdx"
      >
        <div
          v-for="(col, ci) in columns[safeActiveLayerIdx]"
          :key="`col-${safeActiveLayerIdx}-${ci}`"
          class="hiprint-table-col-row"
        >
          <input
            type="text"
            class="col-title"
            :value="colString(col, 'title')"
            placeholder="title"
            aria-label="Column title"
            @change="
              updateColumn(safeActiveLayerIdx, ci, {
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
              updateColumn(safeActiveLayerIdx, ci, {
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
              updateColumn(safeActiveLayerIdx, ci, {
                width: Number(($event.target as HTMLInputElement).value || 100),
              })
            "
          />
          <select
            class="col-align"
            :value="colString(col, 'align', 'left')"
            aria-label="Column align"
            @change="
              updateColumn(safeActiveLayerIdx, ci, {
                align: ($event.target as HTMLSelectElement).value,
              })
            "
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
          <!-- TKT-106: colspan / rowspan inputs -->
          <input
            type="number"
            min="1"
            class="col-colspan"
            :value="colNumber(col, 'colspan', 1)"
            aria-label="Column colspan"
            title="Colspan"
            @change="onColspanInput(safeActiveLayerIdx, ci, $event)"
          />
          <input
            type="number"
            min="1"
            class="col-rowspan"
            :value="colNumber(col, 'rowspan', 1)"
            aria-label="Column rowspan"
            title="Rowspan"
            @change="onRowspanInput(safeActiveLayerIdx, ci, $event)"
          />
          <button
            type="button"
            class="hiprint-property-toggle col-merge-right"
            :disabled="ci >= (columns[safeActiveLayerIdx]?.length ?? 0) - 1"
            aria-label="Merge with right"
            title="Merge with right cell (increment colspan)"
            @click="mergeWithRight(safeActiveLayerIdx, ci)"
          >
            →|
          </button>
          <button
            type="button"
            class="hiprint-property-toggle"
            :disabled="ci === 0"
            aria-label="Move column up"
            @click="moveColumn(safeActiveLayerIdx, ci, -1)"
          >
            ↑
          </button>
          <button
            type="button"
            class="hiprint-property-toggle"
            :disabled="ci >= (columns[safeActiveLayerIdx]?.length ?? 0) - 1"
            aria-label="Move column down"
            @click="moveColumn(safeActiveLayerIdx, ci, 1)"
          >
            ↓
          </button>
          <button
            type="button"
            class="hiprint-property-toggle col-adv-toggle"
            :aria-expanded="isColAdvancedOpen(safeActiveLayerIdx, ci)"
            aria-label="Toggle advanced column options"
            title="More column options"
            @click="toggleColAdvanced(safeActiveLayerIdx, ci)"
          >
            {{ isColAdvancedOpen(safeActiveLayerIdx, ci) ? '▾' : '▸' }}
          </button>
          <button
            type="button"
            class="hiprint-property-toggle col-delete"
            aria-label="Delete column"
            @click="removeColumn(safeActiveLayerIdx, ci)"
          >
            ✕
          </button>
        </div>

        <!--
          Sprint 22g wave 3: per-column advanced fieldset (collapsible).

          Exposes the V1 `tableColumn.supportOptions` list (V1-INVENTORY
          Section O.3, config 1779-1875). Each control writes through
          `updateColumn` (immutable + history commit).
        -->
        <div
          v-for="(col, ci) in columns[safeActiveLayerIdx]"
          v-show="isColAdvancedOpen(safeActiveLayerIdx, ci)"
          :key="`adv-${safeActiveLayerIdx}-${ci}`"
          class="hiprint-table-col-adv"
          :data-col-idx="ci"
        >
          <fieldset class="hiprint-property-fieldset hiprint-table-col-adv-fieldset">
            <legend>Column #{{ ci + 1 }} — advanced</legend>

            <!-- Alignment + layout -->
            <label class="inline">
              <span>halign</span>
              <select
                class="col-halign"
                :value="colString(col, 'halign')"
                @change="onColString(safeActiveLayerIdx, ci, 'halign', $event)"
              >
                <option value="">(inherit)</option>
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </label>
            <label class="inline">
              <span>vAlign</span>
              <select
                class="col-valign"
                :value="colString(col, 'vAlign')"
                @change="onColString(safeActiveLayerIdx, ci, 'vAlign', $event)"
              >
                <option value="">(inherit)</option>
                <option value="top">Top</option>
                <option value="middle">Middle</option>
                <option value="bottom">Bottom</option>
              </select>
            </label>
            <label class="inline">
              <input
                type="checkbox"
                class="col-fixed"
                :checked="colBool(col, 'fixed')"
                @change="onColBool(safeActiveLayerIdx, ci, 'fixed', $event)"
              />
              <span>fixed width (skip auto-scaling)</span>
            </label>
            <label class="inline">
              <input
                type="checkbox"
                class="col-hide"
                :checked="!colBool(col, 'checked', true)"
                @change="
                  updateColumn(safeActiveLayerIdx, ci, {
                    checked: !($event.target as HTMLInputElement).checked,
                  })
                "
              />
              <span>hide column</span>
            </label>
            <label>
              <span>paddingLeft (pt)</span>
              <input
                type="number"
                min="0"
                class="col-padding-left"
                :value="colNumber(col, 'paddingLeft', 0)"
                @change="onColNumber(safeActiveLayerIdx, ci, 'paddingLeft', $event, 0)"
              />
            </label>
            <label>
              <span>paddingRight (pt)</span>
              <input
                type="number"
                min="0"
                class="col-padding-right"
                :value="colNumber(col, 'paddingRight', 0)"
                @change="onColNumber(safeActiveLayerIdx, ci, 'paddingRight', $event, 0)"
              />
            </label>
            <label>
              <span>columnId</span>
              <input
                type="text"
                class="col-column-id"
                :value="colString(col, 'columnId')"
                @change="onColString(safeActiveLayerIdx, ci, 'columnId', $event)"
              />
            </label>

            <!-- Cell type / barcode / qrcode -->
            <label>
              <span>tableTextType</span>
              <select
                class="col-text-type"
                :value="colString(col, 'tableTextType', 'text')"
                @change="onColString(safeActiveLayerIdx, ci, 'tableTextType', $event)"
              >
                <option value="text">text</option>
                <option value="barcode">barcode</option>
                <option value="image">image</option>
                <option value="qrcode">qrcode</option>
                <option value="sequence">sequence</option>
                <option value="custom">custom</option>
              </select>
            </label>
            <label>
              <span>tableBarcodeMode</span>
              <input
                type="text"
                class="col-barcode-mode"
                :value="colString(col, 'tableBarcodeMode', 'CODE128A')"
                @change="onColString(safeActiveLayerIdx, ci, 'tableBarcodeMode', $event)"
              />
            </label>
            <label>
              <span>tableQRCodeLevel (0..3)</span>
              <input
                type="number"
                min="0"
                max="3"
                class="col-qrcode-level"
                :value="colNumber(col, 'tableQRCodeLevel', 0)"
                @change="onColNumber(safeActiveLayerIdx, ci, 'tableQRCodeLevel', $event, 0)"
              />
            </label>
            <label>
              <span>tableColumnHeight (pt)</span>
              <input
                type="number"
                min="0"
                class="col-column-height"
                :value="colNumber(col, 'tableColumnHeight', 0)"
                @change="onColNumber(safeActiveLayerIdx, ci, 'tableColumnHeight', $event, 0)"
              />
            </label>
            <label class="inline">
              <input
                type="checkbox"
                class="col-show-code-title"
                :checked="colBool(col, 'showCodeTitle')"
                @change="onColBool(safeActiveLayerIdx, ci, 'showCodeTitle', $event)"
              />
              <span>showCodeTitle</span>
            </label>

            <!-- Formatters / stylers -->
            <label>
              <span>formatter2 (function source)</span>
              <textarea
                class="col-formatter2"
                rows="2"
                spellcheck="false"
                :value="colString(col, 'formatter2')"
                placeholder="function(value, row, col, options){ return ... }"
                @change="onColString(safeActiveLayerIdx, ci, 'formatter2', $event)"
              />
            </label>
            <label>
              <span>styler2 (function source)</span>
              <textarea
                class="col-styler2"
                rows="2"
                spellcheck="false"
                :value="colString(col, 'styler2')"
                placeholder="function(value, row, col){ return {color:'red'} }"
                @change="onColString(safeActiveLayerIdx, ci, 'styler2', $event)"
              />
            </label>
            <label>
              <span>stylerHeader (function source)</span>
              <textarea
                class="col-styler-header"
                rows="2"
                spellcheck="false"
                :value="colString(col, 'stylerHeader')"
                placeholder="function(column){ return {color:'blue'} }"
                @change="onColString(safeActiveLayerIdx, ci, 'stylerHeader', $event)"
              />
            </label>
            <label>
              <span>renderFormatter (HTML source)</span>
              <textarea
                class="col-render-formatter"
                rows="2"
                spellcheck="false"
                :value="colString(col, 'renderFormatter')"
                placeholder="function(value, row, col){ return '<b>'+value+'</b>' }"
                @change="onColString(safeActiveLayerIdx, ci, 'renderFormatter', $event)"
              />
            </label>

            <!-- Summary aggregator -->
            <label>
              <span>tableSummary</span>
              <select
                class="col-summary"
                :value="colString(col, 'tableSummary')"
                @change="onColString(safeActiveLayerIdx, ci, 'tableSummary', $event)"
              >
                <option value="">(none)</option>
                <option value="count">count</option>
                <option value="sum">sum</option>
                <option value="avg">avg</option>
                <option value="min">min</option>
                <option value="max">max</option>
                <option value="text">text</option>
              </select>
            </label>
            <label class="inline">
              <input
                type="checkbox"
                class="col-summary-title"
                :checked="colBool(col, 'tableSummaryTitle', true)"
                @change="onColBool(safeActiveLayerIdx, ci, 'tableSummaryTitle', $event)"
              />
              <span>tableSummaryTitle (show label)</span>
            </label>
            <label>
              <span>tableSummaryText (label override)</span>
              <input
                type="text"
                class="col-summary-text"
                :value="colString(col, 'tableSummaryText')"
                @change="onColString(safeActiveLayerIdx, ci, 'tableSummaryText', $event)"
              />
            </label>
            <label>
              <span>tableSummaryColspan</span>
              <input
                type="number"
                min="1"
                class="col-summary-colspan"
                :value="colNumber(col, 'tableSummaryColspan', 1)"
                @change="onColNumber(safeActiveLayerIdx, ci, 'tableSummaryColspan', $event, 1)"
              />
            </label>
            <label>
              <span>tableSummaryAlign</span>
              <select
                class="col-summary-align"
                :value="colString(col, 'tableSummaryAlign', 'center')"
                @change="onColString(safeActiveLayerIdx, ci, 'tableSummaryAlign', $event)"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </label>
            <label>
              <span>tableSummaryNumFormat</span>
              <input
                type="number"
                min="0"
                class="col-summary-numformat"
                :value="colNumber(col, 'tableSummaryNumFormat', 2)"
                @change="onColNumber(safeActiveLayerIdx, ci, 'tableSummaryNumFormat', $event, 2)"
              />
            </label>
            <label>
              <span>tableSummaryFormatter (function source)</span>
              <textarea
                class="col-summary-formatter"
                rows="2"
                spellcheck="false"
                :value="colString(col, 'tableSummaryFormatter')"
                @change="onColString(safeActiveLayerIdx, ci, 'tableSummaryFormatter', $event)"
              />
            </label>
            <label>
              <span>upperCase (Nzh code 0..7)</span>
              <input
                type="text"
                class="col-uppercase"
                :value="colString(col, 'upperCase')"
                placeholder="empty / 0 / 1 / 2 / 3 / 4 / 5 / 6 / 7"
                @change="onColString(safeActiveLayerIdx, ci, 'upperCase', $event)"
              />
            </label>

            <!-- TKT-383 — inline editor selector -->
            <label>
              <span>editor (cell inline-edit type)</span>
              <select
                class="col-editor"
                :value="colString(col, 'editor', 'text')"
                @change="onColString(safeActiveLayerIdx, ci, 'editor', $event)"
              >
                <option value="text">text</option>
                <option value="number">number</option>
                <option value="date">date</option>
                <option value="textarea">textarea</option>
                <option value="select">select</option>
              </select>
            </label>
          </fieldset>
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

    <!--
      Section 4. Style (TKT-385/386 — table-level style overrides).

      Maps to V1-INVENTORY Section O.1 "样式" tab. `0` / `''` means "use V1
      default" (print-lock.css 161-187, 233-235) — the model/renderer treats
      those as sentinels so an unmodified table renders identically to V1.
    -->
    <fieldset class="hiprint-property-fieldset">
      <legend>Style — header / body overrides</legend>
      <label>
        tableHeaderRowHeight (pt)
        <input
          type="number"
          min="0"
          class="table-header-row-height"
          :value="Number(opts.tableHeaderRowHeight ?? 0)"
          @change="onTableNumber('tableHeaderRowHeight', $event, 0)"
        />
      </label>
      <label>
        tableHeaderBackground (CSS color)
        <input
          type="text"
          class="table-header-background"
          :value="String(opts.tableHeaderBackground ?? '')"
          placeholder="e.g. #e8e8e8"
          @change="onTableString('tableHeaderBackground', $event)"
        />
      </label>
      <label>
        tableHeaderFontWeight
        <input
          type="text"
          class="table-header-font-weight"
          :value="String(opts.tableHeaderFontWeight ?? '')"
          placeholder="e.g. 600 / bold / normal"
          @change="onTableString('tableHeaderFontWeight', $event)"
        />
      </label>
      <label>
        tableHeaderFontSize (pt)
        <input
          type="number"
          min="0"
          class="table-header-font-size"
          :value="Number(opts.tableHeaderFontSize ?? 0)"
          @change="onTableNumber('tableHeaderFontSize', $event, 0)"
        />
      </label>
      <label>
        tableBodyRowHeight (pt)
        <input
          type="number"
          min="0"
          class="table-body-row-height"
          :value="Number(opts.tableBodyRowHeight ?? 0)"
          @change="onTableNumber('tableBodyRowHeight', $event, 0)"
        />
      </label>
      <label>
        tableBodyFontFamily
        <input
          type="text"
          class="table-body-font-family"
          :value="String(opts.tableBodyFontFamily ?? '')"
          placeholder="e.g. SimSun / Arial"
          @change="onTableString('tableBodyFontFamily', $event)"
        />
      </label>
      <label>
        tableBorder
        <select
          class="table-border"
          :value="String(opts.tableBorder ?? '')"
          @change="onTableString('tableBorder', $event)"
        >
          <option value="">(default)</option>
          <option value="all">all</option>
          <option value="none">none</option>
          <option value="lr">left+right</option>
          <option value="tb">top+bottom</option>
          <option value="lt">left+top</option>
          <option value="rt">right+top</option>
          <option value="lb">left+bottom</option>
          <option value="rb">right+bottom</option>
        </select>
      </label>
      <label class="inline">
        <input
          type="checkbox"
          class="table-auto-completion"
          :checked="opts.autoCompletion === true"
          @change="onTableBool('autoCompletion', $event)"
        />
        <span>autoCompletion (pad last page with empty rows)</span>
      </label>
      <label>
        maxRows (per page)
        <input
          type="number"
          min="0"
          class="table-max-rows"
          :value="Number(opts.maxRows ?? 0)"
          @change="onTableNumber('maxRows', $event, 0)"
        />
      </label>
    </fieldset>

    <!--
      Section 5. Advanced — V1 Section O.1 "高级" tab (TKT-382 groupings +
      stylers + rowsColumnsMerge). All function sources persist as STRINGS
      (V1 contract). Empty string clears the option.
    -->
    <fieldset class="hiprint-property-fieldset">
      <legend>Advanced — group-by, stylers, row merge</legend>
      <label>
        groupFields (comma-separated)
        <input
          type="text"
          class="table-group-fields"
          :value="
            Array.isArray(opts.groupFields)
              ? (opts.groupFields as unknown[]).join(',')
              : String(opts.groupFields ?? '')
          "
          placeholder="e.g. region,category"
          @change="
            patch(
              {
                groupFields:
                  ($event.target as HTMLInputElement).value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
              },
              true
            )
          "
        />
      </label>
      <label>
        groupFormatter (function source)
        <textarea
          class="table-group-formatter"
          rows="2"
          spellcheck="false"
          :value="String(opts.groupFormatter ?? '')"
          placeholder="function(colspan, all, printData, group, options){ return '<b>'+group.name+'</b>' }"
          @change="onTableString('groupFormatter', $event)"
        />
      </label>
      <label>
        groupFooterFormatter (function source)
        <textarea
          class="table-group-footer-formatter"
          rows="2"
          spellcheck="false"
          :value="String(opts.groupFooterFormatter ?? '')"
          placeholder="function(colspan, all, printData, group, options){ return 'subtotal' }"
          @change="onTableString('groupFooterFormatter', $event)"
        />
      </label>
      <label class="inline">
        <input
          type="checkbox"
          class="table-group-seq-continue"
          :checked="opts.groupSequenceContinue === true"
          @change="onTableBool('groupSequenceContinue', $event)"
        />
        <span>groupSequenceContinue (continuous sequence across groups)</span>
      </label>
      <label>
        rowStyler (function source)
        <textarea
          class="table-row-styler"
          rows="2"
          spellcheck="false"
          :value="String(opts.rowStyler ?? '')"
          placeholder="function(row, options){ return {background:'#fafafa'} }"
          @change="onTableString('rowStyler', $event)"
        />
      </label>
      <label>
        rowsColumnsMerge (function source)
        <textarea
          class="table-rows-columns-merge"
          rows="2"
          spellcheck="false"
          :value="String(opts.rowsColumnsMerge ?? '')"
          placeholder="function(row, col, cIdx, rIdx, all, ctx){ return [1,1] }"
          @change="onTableString('rowsColumnsMerge', $event)"
        />
      </label>
      <label class="inline">
        <input
          type="checkbox"
          class="table-rows-columns-merge-clean"
          :checked="opts.rowsColumnsMergeClean === true"
          @change="onTableBool('rowsColumnsMergeClean', $event)"
        />
        <span>rowsColumnsMergeClean (blank text on cross-page merge)</span>
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
.hiprint-table-col-row input.col-width,
.hiprint-table-col-row input.col-colspan,
.hiprint-table-col-row input.col-rowspan {
  width: 48px;
}
.hiprint-table-col-row select.col-align {
  width: 80px;
}
.hiprint-table-layer-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}
.hiprint-table-layer-tabs .layer-tab {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
/* TKT-250 — co-emit V1 `.active` alongside BEM `.is-active`. */
.hiprint-table-layer-tabs .layer-tab.is-active,
.hiprint-table-layer-tabs .layer-tab.active {
  background: var(--hiprint-selection-bg, #e6f7ff);
  border-color: #91d5ff;
  font-weight: 600;
}
.hiprint-table-layer-tabs .layer-tab-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 2px;
  font-size: 10px;
  color: #999;
  cursor: pointer;
}
.hiprint-table-layer-tabs .layer-tab-remove:hover {
  background: #ffe0e0;
  color: #d4380d;
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
