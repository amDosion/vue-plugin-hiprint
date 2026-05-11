<script setup lang="ts">
/**
 * TableElement.vue — V3 table etype (P17.3).
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
 *  - V3 `print/render.ts` renderTableElement (jQuery-free imperative renderer
 *    — this component shares the same algorithm, expressed declaratively).
 *
 * Locked invariants (ADR-0011):
 *  - #1 textContent default: header titles + body cell text use Vue `{{ }}`.
 *  - #2 by-design HTML: only formatter return values use `v-html` (in TableCell).
 *  - #5 PM-002 R3: cell field lookup via `resolveField` preserves 0/false/''.
 *  - #8 per-cell error isolation: TableCell try/catches formatter + styler;
 *       row-merge call is wrapped here (see `cellSpans`).
 *  - rowsColumnsMerge source string → `evalCap` security cap (5000 chars).
 *
 * Subset deliberately simplified vs V2 (documented for P17.4 follow-up):
 *  - Pagination math (`getPaperHtmlResult`) not implemented — render layer
 *    handles that for the print pipeline. Designer canvas shows the full
 *    table without page splits.
 *  - Header repeat ('first' / 'each' / 'no') deferred — single thead rendered.
 *  - footerFormatter + gridColumnsFooter rendered as a tfoot; group-by /
 *    groupFooterFormatter rendered but without the row-banding the V2
 *    excel-helper produces.
 *
 * Why TableElement does NOT use ElementWrapper:
 *  - A table needs its own `<table>` as the structural root for accessibility
 *    + browser print engines. Wrapping `<table>` inside `<div>` is acceptable
 *    (we do that here), but we keep ElementWrapper for the absolute-positioned
 *    outer frame so drag / resize / selection still work uniformly.
 */
import { computed } from 'vue'
import { useCanvasStore } from '@hiprint-v3/stores'
import { coerceText, evalCap } from '@hiprint-v3/internal'
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

// ===== Columns (single or multi-layer) =====

/**
 * Normalize `options.columns` to `Array<Array<columnDef>>`. V1 stored two
 * shapes — single-layer `Array<col>` and multi-layer `Array<Array<col>>`.
 */
const headerLayers = computed<Array<Array<Record<string, unknown>>>>(() => {
  const raw = tableOptions.value.columns
  if (!Array.isArray(raw) || raw.length === 0) return []
  const first = raw[0]
  if (Array.isArray(first)) {
    return raw as Array<Array<Record<string, unknown>>>
  }
  return [raw as Array<Record<string, unknown>>]
})

/** Leaf-row columns (used to render `<tbody>`). */
const leafColumns = computed<Array<Record<string, unknown>>>(() => {
  const layers = headerLayers.value
  return layers.length > 0 ? layers[layers.length - 1]! : []
})

// ===== Data rows =====

/**
 * Resolve the array of row objects. Priority: bound `props.data[field]` →
 * testData JSON string → testData array literal → [].
 */
const rows = computed<Array<Record<string, unknown>>>(() => {
  const opts = tableOptions.value
  const data = props.data
  const fieldName =
    (typeof opts.field === 'string' && opts.field) ||
    (element.value?.printElementType?.field as string | undefined)

  if (fieldName && data && typeof data === 'object') {
    const v = (data as Record<string, unknown>)[fieldName]
    if (Array.isArray(v)) return v as Array<Record<string, unknown>>
  }

  const td = opts.testData
  if (typeof td === 'string') {
    try {
      const parsed = JSON.parse(td)
      if (Array.isArray(parsed)) return parsed as Array<Record<string, unknown>>
    } catch (err) {
      console.warn('[hiprint-v3:TableElement] testData parse failed:', err)
    }
  } else if (Array.isArray(td)) {
    return td as Array<Record<string, unknown>>
  }
  return []
})

// ===== rowsColumnsMerge =====

/**
 * Resolve `options.rowsColumnsMerge` source (string or function) to a Function,
 * applying the V2 `evalCap` security cap (5000 chars) when it's a string.
 *
 * Returns undefined when no merge function is configured.
 */
const rowsColumnsMergeFn = computed<Function | undefined>(() => {
  const src = tableOptions.value.rowsColumnsMerge
  if (!src) return undefined
  if (typeof src === 'function') return src
  if (typeof src === 'string') return evalCap(src, 'rowsColumnsMerge')
  return undefined
})

/**
 * Compute [rowspan, colspan] for every (rowIndex, columnIndex). Wraps the
 * business fn in try/catch per Invariant #8 (cell-level row-merge throw
 * must not break the whole row render). Falls back to [1, 1].
 */
interface CellSpan {
  rowspan: number
  colspan: number
}
const cellSpans = computed<CellSpan[][]>(() => {
  const fn = rowsColumnsMergeFn.value
  const data = rows.value
  const cols = leafColumns.value
  return data.map((row, rIdx) =>
    cols.map((col, cIdx): CellSpan => {
      if (typeof fn !== 'function') return { rowspan: 1, colspan: 1 }
      try {
        const r = (fn as (...a: unknown[]) => unknown)(
          row,
          col,
          cIdx,
          rIdx,
          data,
          props.data
        )
        if (!Array.isArray(r) || r.length < 2) return { rowspan: 1, colspan: 1 }
        const rs = typeof r[0] === 'number' ? r[0] : 1
        const cs = typeof r[1] === 'number' ? r[1] : 1
        return { rowspan: rs, colspan: cs }
      } catch (err) {
        // [Invariant #8] log + degrade — never break the whole row render.
        console.error(
          '[hiprint-v3:TableElement] rowsColumnsMerge call failed (cell-level):',
          err
        )
        return { rowspan: 1, colspan: 1 }
      }
    })
  )
})

/** Get the resolved span for a single cell (defaults to {1,1}). */
function getSpan(rowIndex: number, colIndex: number): CellSpan {
  const rowSpans = cellSpans.value[rowIndex]
  if (!rowSpans) return { rowspan: 1, colspan: 1 }
  return rowSpans[colIndex] ?? { rowspan: 1, colspan: 1 }
}

// ===== Footer (gridColumnsFooter) =====

/**
 * Footer rows. V1 `options.gridColumnsFooter` is an `Array<Array<{title,colspan?}>>`.
 * Each inner array is one row of footer cells.
 */
const footerRows = computed<Array<Array<Record<string, unknown>>>>(() => {
  const f = tableOptions.value.gridColumnsFooter
  if (!Array.isArray(f)) return []
  return (f as unknown[])
    .filter((r): r is Array<Record<string, unknown>> => Array.isArray(r))
    .map((r) => r as Array<Record<string, unknown>>)
})

/** Header cell horizontal alignment lookup. */
function headerAlign(col: Record<string, unknown>): string {
  return (
    (typeof col.halign === 'string' && col.halign) ||
    (typeof col.align === 'string' && col.align) ||
    'center'
  )
}

/** Header colspan attribute (omit when 1). */
function headerColspan(col: Record<string, unknown>): number | undefined {
  const v = typeof col.colspan === 'number' ? col.colspan : Number(col.colspan)
  return Number.isFinite(v) && v > 1 ? v : undefined
}

/** Header rowspan attribute (omit when 1). */
function headerRowspan(col: Record<string, unknown>): number | undefined {
  const v = typeof col.rowspan === 'number' ? col.rowspan : Number(col.rowspan)
  return Number.isFinite(v) && v > 1 ? v : undefined
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
        style="width: 100%; border-collapse: collapse"
      >
        <!-- Multi-layer thead -->
        <thead>
          <tr v-for="(layer, layerIdx) in headerLayers" :key="`h-${layerIdx}`">
            <th
              v-for="(col, colIdx) in layer"
              :key="`h-${layerIdx}-${colIdx}`"
              :colspan="headerColspan(col)"
              :rowspan="headerRowspan(col)"
              :style="{
                textAlign: headerAlign(col),
                border: '0.5pt solid #000',
                padding: '2pt 4pt',
              }"
            >
              <!-- [Invariant #1] header title is user data → textContent path -->
              {{ coerceText(col.title) }}
            </th>
          </tr>
        </thead>

        <!-- tbody -->
        <tbody>
          <tr
            v-for="(row, rIdx) in rows"
            :key="`r-${rIdx}`"
            class="hiprint-printElement-table-tr"
          >
            <TableCell
              v-for="(col, cIdx) in leafColumns"
              :key="`r-${rIdx}-c-${cIdx}`"
              :column="col"
              :row="row"
              :row-index="rIdx"
              :column-index="cIdx"
              :table-data="rows"
              :table-options="tableOptions"
              :rowspan="getSpan(rIdx, cIdx).rowspan"
              :colspan="getSpan(rIdx, cIdx).colspan"
              :editable="editable"
              :panel-id="panelId"
              :element-id="elementId"
            />
          </tr>
        </tbody>

        <!-- tfoot (gridColumnsFooter) -->
        <tfoot v-if="footerRows.length">
          <tr v-for="(footRow, fIdx) in footerRows" :key="`f-${fIdx}`">
            <td
              v-for="(cell, cIdx) in footRow"
              :key="`f-${fIdx}-c-${cIdx}`"
              :colspan="
                typeof cell.colspan === 'number' && cell.colspan > 1
                  ? cell.colspan
                  : undefined
              "
              :style="{ border: '0.5pt solid #000', padding: '2pt 4pt' }"
            >
              <!-- [Invariant #1] footer title is user data → textContent path -->
              {{ coerceText(cell.title ?? cell.text) }}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  </ElementWrapper>
</template>
