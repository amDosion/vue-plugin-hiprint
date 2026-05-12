<script setup lang="ts">
/**
 * TableCell.vue — V3 single table cell (P17.3).
 *
 * Replaces V2 `etypes/table/cell.js` `TableCell` class (~270 LoC of jQuery DOM
 * mutation) with a self-contained Vue 3 component. The parent (TableElement)
 * passes the resolved column def + row data + optional formatter — this
 * component renders the cell text and toggles between display ↔ inline edit.
 *
 * V2 reference:
 *  - V1 bundle.js line 1798-1875 (d class) + 1899-1908 (f / header subclass)
 *  - V2 `core/etypes/table/cell.js`
 *
 * Locked invariants (ADR-0011 + V2 R3 B9 + V3 #1, #2, #5, #8):
 *  - Default display path uses Vue `{{ }}` interpolation → textContent → XSS safe.
 *  - When `column.formatter` is a function the return value is rendered with
 *    `v-html` (Invariant #2 — by-design HTML; business owns escaping).
 *  - resolveField (PM-002 R3) preserves 0/false/'' when looking up `row[field]`.
 *  - Formatter/styler invocations wrapped in try/catch — a throw must not break
 *    the cell render (Invariant #8); we log + fall back to raw text.
 *  - rowspan/colspan come from the parent (already resolved via row-merge);
 *    a value of `0` keeps the cell hidden (display:none) to mimic V2 row-merge.
 *  - Inline edit commits via `canvas.updateElement` patching `options.testData`
 *    JSON (designer-only; in print/preview paths `editable` is false).
 */
import bwipjs from 'bwip-js/browser'
import { computed, ref } from 'vue'
import { useCanvasStore } from '@hiprint-v3/stores'
import {
  coerceText,
  mapBarcodeMode,
  mapQrCodeLevel,
  resolveCellValue,
  compileFormatter,
  applyCellFormatter,
  applyUpperCase,
} from '@hiprint-v3/internal'
import TableInlineEditor from './TableInlineEditor.vue'

const props = withDefaults(
  defineProps<{
    /** Cell column definition (after row-merge / multi-layer flattening). */
    column: Record<string, unknown>
    /** Row data object. */
    row: Record<string, unknown>
    /** Row index in the rendered tbody (0-based). */
    rowIndex: number
    /** Column index within the leaf-column array (0-based). */
    columnIndex: number
    /** Full table data array — passed through to formatter / styler. */
    tableData: ReadonlyArray<Record<string, unknown>>
    /** Top-level options bag (table element options). */
    tableOptions: Record<string, unknown>
    /**
     * rowspan after row-merge. `0` means "hidden, merged into earlier cell".
     */
    rowspan?: number
    /** colspan after row-merge. `0` means "hidden, merged into earlier cell". */
    colspan?: number
    /** Whether double-click inline editing is enabled (designer mode). */
    editable?: boolean
    /**
     * Identifiers needed to patch the canvas store on edit commit.
     * Optional because preview / print mode skips edit wiring entirely.
     */
    panelId?: string
    elementId?: string
  }>(),
  { rowspan: 1, colspan: 1, editable: false }
)

const canvas = useCanvasStore()

// ----- Cell value resolution -----

/**
 * Look up the raw cell value using the column's `field`. PM-002 R3: preserves
 * 0/false/'' — V2 `resolveField` from internal/dom-helpers.
 */
const rawValue = computed<unknown>(() => {
  const field = typeof props.column.field === 'string' ? props.column.field : undefined
  if (!field) return ''
  // TKT-021 convergence: V1 flat key first, V3 dot-path fallback. Matches
  // buildTableModel so designer + print paths stay byte-identical.
  return resolveCellValue(props.row, field)
})

/**
 * Resolve the element type's `formatter` / `styler` cascade tail. V1 P.11
 * (line 2790-2810) cascades column.formatter → printElementType.formatter.
 * Parent (TableElement) injects the live printElementType into tableOptions as
 * `__printElementType` so we can read it without changing the prop signature.
 */
const elementTypeFormatter = computed<unknown>(() => {
  const opts = props.tableOptions as Record<string, unknown>
  const et =
    (opts.__printElementType as Record<string, unknown> | undefined) ??
    (opts.elementType as Record<string, unknown> | undefined)
  return et?.formatter
})

const elementTypeStyler = computed<unknown>(() => {
  const opts = props.tableOptions as Record<string, unknown>
  const et =
    (opts.__printElementType as Record<string, unknown> | undefined) ??
    (opts.elementType as Record<string, unknown> | undefined)
  return et?.styler
})

/**
 * Resolved formatter source. TKT-380 / TKT-387 cascade:
 *   1. column.formatter (function or string source, V1 P.11 line 2381-2385)
 *   2. column.formatter2 (V1 string-source alias)
 *   3. printElementType.formatter (TKT-387 type-level default)
 */
const resolvedFormatter = computed<unknown>(() => {
  const c = props.column
  if (c.formatter != null && c.formatter !== '') return c.formatter
  if (c.formatter2 != null && c.formatter2 !== '') return c.formatter2
  return elementTypeFormatter.value
})

/**
 * Formatter output via `applyCellFormatter` (shared with render-table.ts).
 * Returns `{ html, isHtml }` or `null` if no formatter configured.
 *  - isHtml=true: function ran (v-html path).
 *  - isHtml=false: function threw and fell back to coerced text (Invariant #8).
 */
const formatterHtml = computed<{ html: string; isHtml: boolean } | null>(() => {
  const fn = compileFormatter(resolvedFormatter.value)
  if (!fn) return null
  const out = applyCellFormatter(rawValue.value, resolvedFormatter.value, [
    rawValue.value,
    props.row,
    props.column,
    props.tableData,
  ])
  return { html: out.rendered, isHtml: out.isHtml }
})

/**
 * Styler returns either a string class or an inline-style object.
 * V2/V1 historically allowed both shapes. We collect both forms separately
 * so Vue's :class + :style bindings stay typed.
 *
 * Invariant #8: styler throw → log + fall through (cell still renders).
 */
interface StylerOutput {
  classNames: string[]
  style: Record<string, string | number>
}

/**
 * Resolved styler source. TKT-381 / TKT-387 cascade:
 *   1. column.styler (function or string source)
 *   2. column.styler2 (V1 string-source alias, config 1864-1866)
 *   3. printElementType.styler (TKT-387 type-level default)
 */
const resolvedStyler = computed<unknown>(() => {
  const c = props.column
  if (c.styler != null && c.styler !== '') return c.styler
  if (c.styler2 != null && c.styler2 !== '') return c.styler2
  return elementTypeStyler.value
})

const stylerOut = computed<StylerOutput>(() => {
  const out: StylerOutput = { classNames: [], style: {} }
  // TKT-021 convergence: V1 P.11 — styler may be a string source.
  const fn = compileFormatter(resolvedStyler.value)
  if (!fn) return out
  try {
    const r = fn(
      rawValue.value,
      props.row,
      props.column,
      props.tableData
    )
    if (typeof r === 'string' && r) {
      out.classNames.push(r)
    } else if (r && typeof r === 'object') {
      const recordR = r as Record<string, unknown>
      if (typeof recordR.class === 'string') out.classNames.push(recordR.class)
      // Treat remaining keys as a style record (V1 lenient: styler may return
      // a flat CSS-property bag).
      for (const k of Object.keys(recordR)) {
        if (k === 'class') continue
        const v = recordR[k]
        if (typeof v === 'string' || typeof v === 'number') {
          out.style[k] = v
        }
      }
    }
  } catch (err) {
    console.warn('[hiprint-v3:TableCell] styler threw:', err)
  }
  return out
})

/** Horizontal alignment. */
const align = computed<string>(() => {
  const c = props.column
  return (
    (typeof c.halign === 'string' && c.halign) ||
    (typeof c.align === 'string' && c.align) ||
    'left'
  )
})

/** Vertical alignment (V1 line 2122 — `vAlign` per column). */
const vAlign = computed<string | undefined>(() => {
  const c = props.column
  return typeof c.vAlign === 'string' && c.vAlign ? c.vAlign : undefined
})

/** Per-cell padding (V1 config 1817 / 1823). 0 means "not set". */
const paddingLeft = computed<number>(() => {
  const v = props.column.paddingLeft
  if (v == null) return 0
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : 0
})

const paddingRight = computed<number>(() => {
  const v = props.column.paddingRight
  if (v == null) return 0
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : 0
})

/**
 * TKT-388 — Nzh upperCase per-cell. V1 only applied this to summary cells
 * (bundle 1981-2024) but business templates commonly want body-cell conversion.
 * We match render-table's body-cell extension so designer/print stay byte-identical.
 * Only applied when no formatter ran (we don't want to destroy by-design HTML).
 */
const displayText = computed<string>(() => {
  const raw = coerceText(rawValue.value)
  const u = props.column.upperCase
  if (u == null || u === '' || u === false) return raw
  return applyUpperCase(raw, u)
})

/**
 * TKT-389 — tableCustomCell support. When `column.tableTextType === 'custom'`
 * and `customCellHtml` is supplied, the cell renders the literal HTML payload
 * (treated as by-design HTML, Invariant #2). Restores V1 tableCustomCell etype
 * behavior (bundle 2850-2880) inside the unified table.
 */
const customCellHtml = computed<string | null>(() => {
  const c = props.column
  if (c.tableTextType !== 'custom') return null
  if (typeof c.customCellHtml !== 'string') return null
  return c.customCellHtml
})

/**
 * Sprint 22g GL Wave 3 — table-cell barcode / qrcode renderer wiring.
 *
 * V1 inventory §J.13/J.14/J.28: V1 supported `column.tableTextType:
 * 'barcode'|'qrcode'` and rendered each cell as a small inline SVG using
 * JsBarcode (barcode) / qrcode.js (qrcode). V3 reuses bwip-js for both,
 * matching the BarcodeElement / QrcodeElement render path.
 *
 * Column-level options (V1 column-only):
 *  - `tableTextType: 'barcode' | 'qrcode'` — switch.
 *  - `tableBarcodeMode` — V1 Path A enum (CODE128 / EAN13 / ...); routed via
 *    `mapBarcodeMode`.
 *  - `tableQRCodeLevel` — int 0-3; routed via `mapQrCodeLevel`.
 *  - `tableColumnHeight` — SVG height in pt (fallback 30).
 *  - `showCodeTitle` — boolean (V1 §J.28); when true, the encoded value
 *    appears as text below the SVG.
 *
 * Returns the inline SVG HTML string (XSS-safe — bwip-js generates the
 * markup from the encoded payload only). Null when the column is not a
 * barcode/qrcode cell.
 */
const codeCellSvg = computed<{ svg: string; title: string | null } | null>(
  () => {
    const c = props.column
    const kind = c.tableTextType
    if (kind !== 'barcode' && kind !== 'qrcode') return null
    const text = displayText.value
    if (!text) return null
    const heightPt = (typeof c.tableColumnHeight === 'number' && c.tableColumnHeight > 0
      ? c.tableColumnHeight
      : 30) as number
    try {
      const bcid =
        kind === 'qrcode'
          ? 'qrcode'
          : mapBarcodeMode(
              typeof c.tableBarcodeMode === 'string'
                ? c.tableBarcodeMode
                : undefined
            )
      const baseOpts: Record<string, unknown> = {
        bcid,
        text,
        scale: 1,
        includetext: false,
      }
      if (kind === 'barcode') {
        baseOpts.height = Math.floor(heightPt / 2.835) // pt → mm
        baseOpts.width = '' // bwip-js auto-fits
      } else {
        // qrcode square sized off heightPt only (cell is column-driven).
        const square = Math.max(1, Math.floor(heightPt / 2.835))
        baseOpts.height = square
        baseOpts.width = square
        baseOpts.eclevel = (['M', 'L', 'H', 'Q'] as const)[
          mapQrCodeLevel(c.tableQRCodeLevel)
        ]
      }
      const svgStr = bwipjs.toSVG(
        baseOpts as Parameters<typeof bwipjs.toSVG>[0]
      )
      const showTitle = c.showCodeTitle === true
      return { svg: svgStr, title: showTitle ? text : null }
    } catch (err) {
      console.warn('[hiprint-v3:TableCell] code render failed:', err)
      return null
    }
  }
)

/**
 * TKT-383 — Per-column inline editor type. When the column specifies
 * `editor: 'select' | 'number' | 'date' | 'textarea'` the cell uses that
 * editor instead of the default text input. Defaults to `'text'`.
 *
 * For `select` editors `column.editorOptions` should be `Array<{value, label}>`.
 */
const editorType = computed<'text' | 'select' | 'number' | 'date' | 'textarea'>(
  () => {
    const t = props.column.editor
    if (
      t === 'select' ||
      t === 'number' ||
      t === 'date' ||
      t === 'textarea' ||
      t === 'text'
    )
      return t
    return 'text'
  }
)

const editorOptions = computed<ReadonlyArray<{ value: string; label: string }>>(
  () => {
    const raw = props.column.editorOptions
    if (!Array.isArray(raw)) return []
    return raw
      .map((o) => {
        if (o && typeof o === 'object') {
          const obj = o as Record<string, unknown>
          return {
            value: String(obj.value ?? ''),
            label: String(obj.label ?? obj.value ?? ''),
          }
        }
        if (typeof o === 'string') return { value: o, label: o }
        return null
      })
      .filter((o): o is { value: string; label: string } => o !== null)
  }
)

/**
 * Whether this cell should be hidden because row-merge collapsed it into an
 * earlier cell. V2 semantics: a rowspan/colspan of 0 means "skip render".
 */
const hidden = computed<boolean>(
  () => props.rowspan === 0 || props.colspan === 0
)

// ----- Inline edit (designer-only) -----

const isEditing = ref(false)
const draft = ref('')

function startEdit(): void {
  if (!props.editable) return
  draft.value = displayText.value
  isEditing.value = true
}

/**
 * Commit edit. We patch the table element's `testData` JSON because in
 * designer mode that is the source of truth for cell values (V1 / V2
 * `TablePrintElement.getData` parses `options.testData`).
 *
 * If `panelId` + `elementId` not provided, we silently no-op (preview mode
 * shouldn't write back).
 */
function commitEdit(newValue: string): void {
  isEditing.value = false
  draft.value = newValue
  if (!props.panelId || !props.elementId) return
  const field = typeof props.column.field === 'string' ? props.column.field : undefined
  if (!field) return

  // Mutate a *clone* of testData and patch via canvas.updateElement.
  let data: Array<Record<string, unknown>> = []
  const td = props.tableOptions.testData
  if (typeof td === 'string') {
    try {
      const parsed = JSON.parse(td)
      if (Array.isArray(parsed)) data = parsed
    } catch (err) {
      console.warn('[hiprint-v3:TableCell] testData parse failed:', err)
    }
  } else if (Array.isArray(td)) {
    data = JSON.parse(JSON.stringify(td)) as Array<Record<string, unknown>>
  }
  // Ensure the row exists at rowIndex; pad if shorter.
  while (data.length <= props.rowIndex) data.push({})
  const target = data[props.rowIndex] ?? {}
  setNestedField(target, field, newValue)
  data[props.rowIndex] = target

  // Persist back as JSON string (V1 storage format).
  canvas.updateElement(props.panelId, props.elementId, {
    options: { testData: JSON.stringify(data) },
  })
}

function cancelEdit(): void {
  isEditing.value = false
}

/**
 * Write a nested-path value into an object. Mirrors PM-002 R3 read-side
 * `resolveField` but for writes. Creates intermediate objects as needed.
 */
function setNestedField(
  obj: Record<string, unknown>,
  fieldPath: string,
  value: unknown
): void {
  const parts = fieldPath.split('.')
  let cursor: Record<string, unknown> = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i]!
    const next = cursor[k]
    if (next == null || typeof next !== 'object') {
      const fresh: Record<string, unknown> = {}
      cursor[k] = fresh
      cursor = fresh
    } else {
      cursor = next as Record<string, unknown>
    }
  }
  cursor[parts[parts.length - 1]!] = value
}
</script>

<template>
  <!--
    TKT-021 V1 G.3 parity: a merged-away cell is kept in the DOM with
    `display:none` (NOT omitted), so cross-page fixMergeSpan can re-anchor.
  -->
  <td
    :rowspan="rowspan > 1 ? rowspan : undefined"
    :colspan="colspan > 1 ? colspan : undefined"
    :class="['hiprint-printElement-table-td', ...stylerOut.classNames]"
    :style="{
      textAlign: align,
      border: '0.5pt solid #000',
      // V1 default cell padding is 0/4/0/4pt (print-lock.css 170-187).
      // Per-column overrides (V1 config 1817 / 1823) win when > 0.
      padding: `2pt ${paddingRight > 0 ? paddingRight : 4}pt 2pt ${paddingLeft > 0 ? paddingLeft : 4}pt`,
      ...(vAlign ? { verticalAlign: vAlign } : {}),
      ...(hidden ? { display: 'none' } : {}),
      ...stylerOut.style,
    }"
    @dblclick="startEdit"
  >
    <!-- Inline editor — designer mode + isEditing. TKT-383: column.editor
         selects between text / select / number / date / textarea. -->
    <TableInlineEditor
      v-if="isEditing"
      v-model="draft"
      :type="editorType"
      :options="editorOptions"
      @commit="commitEdit"
      @cancel="cancelEdit"
    />

    <!-- TKT-389 — tableCustomCell HTML payload (by-design HTML, Invariant #2) -->
    <!-- eslint-disable-next-line vue/no-v-html -->
    <span v-else-if="customCellHtml !== null" v-html="customCellHtml" />

    <!--
      Sprint 22g GL Wave 3 — table-cell barcode / qrcode renderer.
      bwip-js produces the SVG string from a single encoded text payload
      (no markup injection). The optional title row uses {{ }} interpolation
      (textContent — XSS safe). V1 §J.13/J.14/J.28 reference.
      eslint-disable-next-line vue/no-v-html
    -->
    <span
      v-else-if="codeCellSvg !== null"
      class="hiprint-printElement-table-code"
    >
      <!-- eslint-disable-next-line vue/no-v-html -->
      <span class="hiprint-printElement-table-code-svg" v-html="codeCellSvg.svg" />
      <span
        v-if="codeCellSvg.title !== null"
        class="hiprint-printElement-table-code-title"
      >{{ codeCellSvg.title }}</span>
    </span>

    <!-- Formatter output (Invariant #2 when isHtml=true, #1 fallback when false) -->
    <!-- eslint-disable-next-line vue/no-v-html -->
    <span
      v-else-if="formatterHtml !== null && formatterHtml.isHtml"
      v-html="formatterHtml.html"
    />
    <template v-else-if="formatterHtml !== null && !formatterHtml.isHtml">{{
      formatterHtml.html
    }}</template>

    <!-- Default: text interpolation (XSS safe; Invariant #1) -->
    <template v-else>{{ displayText }}</template>
  </td>
</template>
