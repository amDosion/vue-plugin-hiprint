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
import { computed, ref } from 'vue'
import { useCanvasStore } from '@hiprint-v3/stores'
import { coerceText, resolveField } from '@hiprint-v3/internal'
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
  return resolveField(props.row, field, '')
})

/**
 * Formatter output. Null when no formatter configured — template falls back
 * to plain text. Returning empty string '' means "formatter ran and produced
 * no content" (still v-html path, but renders nothing).
 *
 * Invariant #8: a thrown formatter must not crash the cell. We catch + warn.
 */
const formatterHtml = computed<string | null>(() => {
  const formatter = props.column.formatter
  if (typeof formatter !== 'function') return null
  try {
    const out = (formatter as (...a: unknown[]) => unknown)(
      rawValue.value,
      props.row,
      props.column,
      props.tableData
    )
    return out == null ? '' : String(out)
  } catch (err) {
    console.warn('[hiprint-v3:TableCell] formatter threw:', err)
    return null
  }
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

const stylerOut = computed<StylerOutput>(() => {
  const out: StylerOutput = { classNames: [], style: {} }
  const styler = props.column.styler
  if (typeof styler !== 'function') return out
  try {
    const r = (styler as (...a: unknown[]) => unknown)(
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

const displayText = computed<string>(() => coerceText(rawValue.value))

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
  <!-- A merged-away cell is omitted entirely (matches V2 row-merge semantics). -->
  <td
    v-if="!hidden"
    :rowspan="rowspan > 1 ? rowspan : undefined"
    :colspan="colspan > 1 ? colspan : undefined"
    :class="['hiprint-printElement-table-td', ...stylerOut.classNames]"
    :style="{
      textAlign: align,
      border: '0.5pt solid #000',
      padding: '2pt 4pt',
      ...stylerOut.style,
    }"
    @dblclick="startEdit"
  >
    <!-- Inline editor — designer mode + isEditing -->
    <TableInlineEditor
      v-if="isEditing"
      v-model="draft"
      :type="'text'"
      @commit="commitEdit"
      @cancel="cancelEdit"
    />

    <!-- Formatter output — by-design HTML (Invariant #2) -->
    <!-- eslint-disable-next-line vue/no-v-html -->
    <span v-else-if="formatterHtml !== null" v-html="formatterHtml" />

    <!-- Default: text interpolation (XSS safe; Invariant #1) -->
    <template v-else>{{ displayText }}</template>
  </td>
</template>
