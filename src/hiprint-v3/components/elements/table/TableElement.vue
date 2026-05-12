<script setup lang="ts">
/**
 * TableElement.vue — V3 table etype (TKT-021 Sprint 22b convergent).
 *
 * Collapses V2's 4-file table module
 * (`cell.js` + `excel-helper.js` + `inline-editor.js` + `print-element.js` +
 *  `row-merge.js`, ~1500 LoC of jQuery DOM mutation) into three Vue 3 SFCs
 * (this orchestrator + TableCell + TableInlineEditor). Layout + data flow is
 * fully Vue-reactive — no imperative DOM patching.
 *
 * V2 reference for parity:
 *  - V1 bundle.js line 6210-6709 (TablePrintElement)
 *  - V2 `core/etypes/table/print-element.js` (`getData` + `getTableHtml`)
 *  - V2 `core/etypes/table/excel-helper.js` (head + body + footer factories)
 *  - V2 `core/etypes/table/row-merge.js` (rowsColumnsMerge eval + apply)
 *  - V3 `print/render.ts` `renderTableElement` (now also delegates to
 *    `buildTableModel` so designer + print stay byte-identical).
 *
 * Locked invariants (ADR-0011):
 *  - #1 textContent default: header titles + body cell text use Vue `{{ }}`.
 *  - #2 by-design HTML: only formatter return values use `v-html` (in TableCell
 *       and tfoot footerFormatter row).
 *  - #5 PM-002 R3: cell field lookup via flat-then-dot-path semantics in
 *       `resolveCellValue` (V1 line 2138-2139 + V3 extension).
 *  - #8 per-cell error isolation: TableCell try/catches formatter + styler;
 *       row-merge call is wrapped inside buildTableModel.
 *  - rowsColumnsMerge source string → `evalCap` security cap (5000 chars).
 *
 * Subset deliberately simplified vs V2 (documented for P17.4 follow-up):
 *  - Pagination math (`getPaperHtmlResult`) not implemented — render layer
 *    handles that for the print pipeline. Designer canvas shows the full
 *    table without page splits.
 *  - Header repeat ('first' / 'each' / 'no') deferred — single thead rendered.
 *  - footerFormatter compiled in buildTableModel; gridColumnsFooter rendered;
 *    group-by / groupFooterFormatter rendered but without the row-banding the
 *    V2 excel-helper produces.
 *
 * Why TableElement does NOT use ElementWrapper:
 *  - A table needs its own `<table>` as the structural root for accessibility
 *    + browser print engines. Wrapping `<table>` inside `<div>` is acceptable
 *    (we do that here), but we keep ElementWrapper for the absolute-positioned
 *    outer frame so drag / resize / selection still work uniformly.
 */
import { computed, ref } from 'vue'
import { useCanvasStore, reorderTableColumn } from '@hiprint-v3/stores'
import { buildTableModel, evalCap } from '@hiprint-v3/internal'
import {
  openContextMenu,
  buildTableColumnContextItems,
} from '@hiprint-v3/interactions'
import ElementWrapper from '../ElementWrapper.vue'
import TableCell from './TableCell.vue'

const props = withDefaults(
  defineProps<{
    elementId: string
    panelId: string
    /** Bound business data (passed through to formatter / styler). */
    data?: Record<string, unknown>
    /** Designer mode enables cell dblclick inline edit. Default false (preview). */
    editable?: boolean
    interactive?: boolean
  }>(),
  { editable: false, interactive: true }
)

const canvas = useCanvasStore()

const element = computed(() => {
  for (const panel of canvas.panels) {
    const el = panel.printElements.find((e) => e.id === props.elementId)
    if (el) return el
  }
  return null
})

const tableOptions = computed<Record<string, unknown>>(
  () => (element.value?.options as Record<string, unknown>) ?? {}
)

/**
 * Resolve `options.rowsColumnsMerge` source (string or function) to a Function,
 * applying the V2 `evalCap` security cap (5000 chars) when it's a string.
 *
 * Returns undefined when no merge function is configured.
 */
const rowsColumnsMergeFn = computed<((...a: unknown[]) => unknown) | undefined>(() => {
  const src = tableOptions.value.rowsColumnsMerge
  if (typeof src === 'function') return src as (...a: unknown[]) => unknown
  if (typeof src === 'string') {
    const f = evalCap(src, 'rowsColumnsMerge')
    if (typeof f === 'function') return f as (...a: unknown[]) => unknown
  }
  return undefined
})

/**
 * The single source-of-truth table model. Shared with `print/render.ts` via
 * `buildTableModel` — designer DOM and print HTML are byte-identical for the
 * same fixture (TableElement-render-parity.spec.ts asserts it).
 *
 * Note we do NOT pass `rowsFallbackPlaceholder: true` here. The designer
 * intentionally renders an empty table when no data is configured (matching
 * Sprint 22a-r behavior). V1 used `[{}]` as a one-row placeholder; if that
 * preview is needed it should be reintroduced as a designer-only opt-in.
 */
const model = computed(() =>
  buildTableModel({
    options: tableOptions.value,
    data: props.data,
    rowsColumnsMerge: rowsColumnsMergeFn.value,
    rowsFallbackPlaceholder: false,
  })
)

const theadRows = computed(() => model.value.theadRows)
const leafColumns = computed(() => model.value.leafColumns)
const bodyRows = computed(() => model.value.bodyRows)
const rows = computed(() => model.value.rows)
const footerRows = computed(() => model.value.footerRows)
const footerHtml = computed(() => model.value.footerHtml)
const borderClass = computed(() => model.value.borderClass)

/**
 * TKT-107 (Sprint 22c) — right-click thead context menu.
 *
 * V1 P.9 quirk: V1 only binds context on `thead`, NOT on `tbody`. Body-cell
 * right-click falls through to the browser default. We honour that here:
 * `@contextmenu.prevent` is bound on each `<th>`, never on `<td>`.
 *
 * The menu is only enabled in designer mode (`props.editable === true`).
 * Preview/print rendering keeps the native browser context menu so end users
 * can copy table data.
 *
 * V1 reference: HiTable.initContext bundle 7200-7329 (gated on
 * isEnableContextMenu, which we map to `editable === true` in V3).
 */
function onTheadContext(
  ev: MouseEvent,
  layerIdx: number,
  columnIdx: number
): void {
  if (!props.editable) return
  // Build items at click time so handlers re-resolve the live element state
  // (matches the multi-designer pinia capture in buildElementContextItems).
  const items = buildTableColumnContextItems(
    props.elementId,
    layerIdx,
    columnIdx
  )
  openContextMenu({ x: ev.clientX, y: ev.clientY }, { items })
}

/**
 * TKT-155 (Sprint 22d) — header column drag-reorder.
 *
 * V1 parity: V1 lets the user drag a thead `<th>` left/right to reorder
 * columns directly on the canvas (in addition to the property-panel up/down
 * buttons). V3 keeps both paths — this is the on-canvas direct-manipulation
 * surface; TablePropertyPanel still has explicit ordering controls.
 *
 * Implementation notes:
 *  - Only enabled in designer mode (`props.editable`). Print preview leaves
 *    `<th draggable>` off so native browser text selection / copy still works.
 *  - We track BOTH dragged + drop-target indices per layer so dragover on a
 *    different layer's `<th>` does NOT highlight (cross-layer reorder is
 *    intentionally unsupported — multi-layer headers anchor on their
 *    grouping; see reorderTableColumn rationale in table-ops.ts).
 *  - `onDragEnd` always clears state so a cancelled drag (Esc / drop outside)
 *    doesn't leave stale highlight.
 *  - drop-on-self short-circuits inside reorderTableColumn (no history push).
 */
const draggedColumn = ref<{ layerIdx: number; columnIdx: number } | null>(null)
const dropTargetColumn = ref<{ layerIdx: number; columnIdx: number } | null>(
  null
)

function onTheadDragStart(
  ev: DragEvent,
  layerIdx: number,
  columnIdx: number
): void {
  if (!props.editable) return
  draggedColumn.value = { layerIdx, columnIdx }
  if (ev.dataTransfer) {
    ev.dataTransfer.effectAllowed = 'move'
    // Set a string payload so happy-dom and Firefox accept the drag.
    ev.dataTransfer.setData('text/plain', `col:${layerIdx}:${columnIdx}`)
  }
}

function onTheadDragOver(
  ev: DragEvent,
  layerIdx: number,
  columnIdx: number
): void {
  if (!props.editable) return
  const src = draggedColumn.value
  if (!src) return
  // Cross-layer drops are not supported — only highlight when the cursor is
  // over a cell in the SAME layer that owns the dragged column.
  if (src.layerIdx !== layerIdx) return
  // preventDefault is required to allow the `drop` event to fire.
  ev.preventDefault()
  if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move'
  dropTargetColumn.value = { layerIdx, columnIdx }
}

function onTheadDrop(
  ev: DragEvent,
  layerIdx: number,
  columnIdx: number
): void {
  if (!props.editable) return
  ev.preventDefault()
  const src = draggedColumn.value
  draggedColumn.value = null
  dropTargetColumn.value = null
  if (!src) return
  if (src.layerIdx !== layerIdx) return
  // Drop-on-self handled (no-op) inside reorderTableColumn — history snapshot
  // is also short-circuited there so undo stack stays clean.
  reorderTableColumn(props.elementId, layerIdx, src.columnIdx, columnIdx)
}

function onTheadDragEnd(): void {
  draggedColumn.value = null
  dropTargetColumn.value = null
}

function isDraggingColumn(layerIdx: number, columnIdx: number): boolean {
  const d = draggedColumn.value
  return d !== null && d.layerIdx === layerIdx && d.columnIdx === columnIdx
}

function isDropTargetColumn(layerIdx: number, columnIdx: number): boolean {
  const t = dropTargetColumn.value
  if (t === null) return false
  if (t.layerIdx !== layerIdx || t.columnIdx !== columnIdx) return false
  // Don't highlight the source cell as its own drop target.
  return !isDraggingColumn(layerIdx, columnIdx)
}
</script>

<template>
  <ElementWrapper
    :element-id="elementId"
    :panel-id="panelId"
    :interactive="interactive"
  >
    <div
      class="hiprint-printElement-table-content"
      style="height: 100%; width: 100%"
    >
      <table
        class="hiprint-printElement-tableTarget"
        :class="borderClass || undefined"
        style="width: 100%; border-collapse: collapse"
      >
        <!--
          Multi-layer thead — uses `<th>` (matching print/render.ts).
          TKT-107: @contextmenu.prevent on each <th> opens the column editor
          (V1 P.9: right-click only on thead — body-cell right-click stays
          browser-default so end users can copy data).
        -->
        <thead>
          <tr v-for="(layer, layerIdx) in theadRows" :key="`h-${layerIdx}`">
            <th
              v-for="(cell, colIdx) in layer"
              :key="`h-${layerIdx}-${colIdx}`"
              :colspan="cell.colspan && cell.colspan > 1 ? cell.colspan : undefined"
              :rowspan="cell.rowspan && cell.rowspan > 1 ? cell.rowspan : undefined"
              :style="{
                textAlign: cell.align || 'center',
                border: '0.5pt solid #000',
                padding: '2pt 4pt',
              }"
              :class="{
                'hiprint-column-dragging': isDraggingColumn(layerIdx, colIdx),
                'hiprint-column-drop-target': isDropTargetColumn(layerIdx, colIdx),
              }"
              :draggable="editable ? 'true' : undefined"
              @contextmenu.prevent="onTheadContext($event, layerIdx, colIdx)"
              @dragstart="onTheadDragStart($event, layerIdx, colIdx)"
              @dragover="onTheadDragOver($event, layerIdx, colIdx)"
              @drop="onTheadDrop($event, layerIdx, colIdx)"
              @dragend="onTheadDragEnd"
            >
              <!-- [Invariant #1] header title is user data → textContent path -->
              {{ cell.title }}
            </th>
          </tr>
        </thead>

        <!-- tbody — TableCell receives the original row + the model-resolved
             column. It re-runs its own resolveField for inline-edit write-back
             paths but the produced DOM matches what buildTableModel already
             computed (same compileFormatter/applyCellStyler path). -->
        <tbody>
          <tr
            v-for="(_bodyRow, rIdx) in bodyRows"
            :key="`r-${rIdx}`"
            class="hiprint-printElement-table-tr"
          >
            <TableCell
              v-for="(col, cIdx) in leafColumns"
              :key="`r-${rIdx}-c-${cIdx}`"
              :column="col"
              :row="rows[rIdx] || {}"
              :row-index="rIdx"
              :column-index="cIdx"
              :table-data="rows"
              :table-options="tableOptions"
              :rowspan="bodyRows[rIdx]?.cells[cIdx]?.rowspan ?? 1"
              :colspan="bodyRows[rIdx]?.cells[cIdx]?.colspan ?? 1"
              :editable="editable"
              :panel-id="panelId"
              :element-id="elementId"
            />
          </tr>
        </tbody>

        <!-- tfoot (gridColumnsFooter + footerFormatter) -->
        <tfoot v-if="footerRows.length || footerHtml">
          <tr v-for="(footRow, fIdx) in footerRows" :key="`f-${fIdx}`">
            <td
              v-for="(fcell, cIdx) in footRow.cells"
              :key="`f-${fIdx}-c-${cIdx}`"
              :colspan="fcell.colspan && fcell.colspan > 1 ? fcell.colspan : undefined"
              :style="{ border: '0.5pt solid #000', padding: '2pt 4pt' }"
            >
              <!-- [Invariant #1] footer text is user data → textContent path -->
              {{ fcell.text }}
            </td>
          </tr>
          <tr v-if="footerHtml">
            <td
              :colspan="leafColumns.length > 1 ? leafColumns.length : undefined"
              :style="{ border: '0.5pt solid #000', padding: '2pt 4pt' }"
            >
              <!-- [Invariant #2] footerFormatter output is by-design HTML -->
              <!-- eslint-disable-next-line vue/no-v-html -->
              <span v-html="footerHtml" />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  </ElementWrapper>
</template>

<style>
/* TKT-155 (Sprint 22d) — header column drag-reorder visual feedback.
 *
 * `.hiprint-column-dragging` dims the source cell while it is being dragged
 * (matches the convention used by HiprintElementListPanel's .is-dragging row).
 * `.hiprint-column-drop-target` highlights the column the cursor is over so
 * the user sees where the drop will land. Both classes are only ever applied
 * when `props.editable` is true (the template binds them through
 * isDraggingColumn / isDropTargetColumn, which are no-ops when editable=false
 * because dragstart short-circuits).
 *
 * NOT `<style scoped>` on purpose:
 *  - The print-parity test (TableElement-render-parity.spec.ts) compares the
 *    Vue-mounted DOM byte-for-byte against `print/render.ts` output. A scoped
 *    block injects `data-v-XXXXXXX` attributes onto every rendered element,
 *    breaking that diff for downstream consumers that share the test.
 *  - The class selectors below are already prefixed with
 *    `.hiprint-printElement-tableTarget th` so they cannot collide with
 *    unrelated tables in business CSS.
 */
.hiprint-printElement-tableTarget th.hiprint-column-dragging {
  opacity: 0.5;
  cursor: grabbing;
}
.hiprint-printElement-tableTarget th.hiprint-column-drop-target {
  background: #fff8e1;
  box-shadow: inset 2px 0 0 0 #f59e0b;
}
</style>
