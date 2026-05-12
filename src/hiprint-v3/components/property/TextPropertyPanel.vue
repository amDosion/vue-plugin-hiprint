<script setup lang="ts">
/**
 * TextPropertyPanel.vue — V3 property editor for `text` etype (Sprint 22c TKT-108).
 *
 * Replaces the generic HiprintPropertyPanel fallback (which surfaced only
 * ~12 of the 57 V1 `text` option fields). This panel exposes the full
 * surface catalogued in `docs/V1-INVENTORY/etypes/text-longtext.md` PART 1
 * Section B (with `axis` covered by the `Pagination` fieldset's drag-axis
 * select, which is the V1 placement — see `[V1 line 4348]`).
 *
 * Field groups (mapped 1:1 from V1 supportOptions / tabs):
 *
 *   Position  — left / top / width / height / transform / positionLocked /
 *               sizeLocked / zIndex   (B.4-B.9, B.28, B.29)
 *   Font      — fontFamily / fontSize / fontWeight / fontStyle /
 *               letterSpacing / color / lineHeight / textDecoration
 *               (B.17-B.21, B.23, B.27)
 *   Align     — textAlign / textContentVerticalAlign / textContentWrap /
 *               contentPaddingLeft|Top|Right|Bottom   (B.24-B.26, B.38-B.41)
 *   Border    — borderTop / borderLeft / borderRight / borderBottom /
 *               borderWidth / borderColor / borderStyle / borderRadius
 *               (B.30-B.37)
 *   Background — backgroundColor   (B.22)
 *   TextType  — textType / barcodeMode (when barcode) / qrCodeLevel (when
 *               qrcode)   (B.43, B.44, B.49) — Path A. The TextElement
 *               dispatches to BarcodeElement / QrcodeElement via
 *               textTypeDispatch (`components/elements/TextElement.vue:76`)
 *               when this select is changed away from `text`.
 *   DataType  — dataType / format / trueText / falseText (boolean only)
 *               (B.15, B.16)
 *   Binding   — field / testData / title / hideTitle / formatter / styler
 *               (B.1-B.3, B.13, B.52, B.53)
 *   Pagination — pageBreak (number[] comma list) / showInPage / unShowInPage
 *                / fixed / axis   (B.14, B.54-B.57)
 *   Misc      — lock (catch-all) / draggable   (B.10)
 *
 * Total V1 fields surfaced: 57 of 57 (Sprint 22g — Stream GC zero-out).
 *
 * Sprint 22g restored fields (previously dropped — user spec: < 100% = bug):
 *   - barTextMode / barWidth / barAutoWidth / barcodeType — Path A barcode
 *     tuning. Surfaced inside the Text-type fieldset when textType=barcode
 *     so Path A templates can edit them without a separate flow. Renderer
 *     side (render.ts + BarcodeElement.vue) already plumbs barWidth +
 *     barAutoWidth → bwip-js scale/width; Sprint 22g added barTextMode →
 *     external `<div class="hibarcode_displayValue">` line.
 *   - qrcodeType — Path A qrcode tuning, surfaces when textType=qrcode.
 *   - upperCase — render-time `value.toUpperCase()` (V1 quirk, see
 *     _helpers.ts computeDisplayText + render.ts renderTextElement).
 *     NOT a Chinese number conversion — that's `numberFormat` (different
 *     field). The previous panel header conflated these.
 *   - optionsGroup — V1 internal grouping placeholder string. Mostly UI
 *     metadata; surfaced as a free-form text input under "Advanced".
 *   - coordinateSync / widthHeightSync — when true, editing one of (left/top)
 *     or (width/height) mirrors the value into its sibling. Implemented as
 *     panel-side reactive intercept that fans out the same number to both
 *     keys, never the canvas store. Default off.
 *
 *   - shadow (advanced) — still deferred (counted under base 50, not in 57).
 *
 * Edit flow: every change funnels through
 *   canvas.updateElement(activePanelId, element.id, { options: patch })
 * which the canvas store shallow-merges. `commit=true` snapshots history
 * exactly once per commit boundary (blur/change for typed inputs, change
 * for selects/checkboxes, change for color pickers). Typing in a number
 * field calls update without commit so undo/redo doesn't fire per
 * keystroke.
 *
 * Dispatched from HiprintPropertyPanel.vue when `elementType === 'text'`
 * AND exactly one element is selected. Multi-select continues to use the
 * generic fallback editor (bulk-edit path).
 */
import { computed, ref, watch } from 'vue'
import {
  useCanvasStore,
  useHistoryStore,
  type CanvasElement,
} from '@hiprint-v3/stores'

const props = defineProps<{ element: CanvasElement }>()
const canvas = useCanvasStore()
const history = useHistoryStore()

// ============ Reactive options proxy ============
const opts = computed<Record<string, unknown>>(
  () => (props.element.options as Record<string, unknown>) ?? {}
)

// Coerce helpers — defensive against template JSON having strings where
// numbers were expected (V1 templates frequently mix both).
function num(v: unknown, fallback: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function str(v: unknown, fallback = ''): string {
  return v == null ? fallback : String(v)
}

function bool(v: unknown): boolean {
  return v === true || v === 'true'
}

// ============ Update flow ============
//
// `update` is the single funnel for all field edits. `commit=true` pushes
// a history snapshot AFTER the patch lands so undo/redo points to the
// pre-edit state. Typing in a number/text input keeps `commit=false` and
// fires the snapshot on `change`/`blur`.
function update(patch: Record<string, unknown>, commit = true): void {
  const panelId = canvas.activePanelId
  if (!panelId) return
  canvas.updateElement(panelId, props.element.id, { options: patch })
  if (commit) history.pushSnapshot()
}

function commit(): void {
  history.pushSnapshot()
}

// Debounced text drafts — typing in a text input shouldn't write per
// keystroke (history noise + canvas re-render storm). Commit on blur/Enter.
const draftField = ref<string>('')
const draftTitle = ref<string>('')
const draftTestData = ref<string>('')
const draftFormatter = ref<string>('')
const draftStyler = ref<string>('')
const draftFormat = ref<string>('')
const draftTrueText = ref<string>('')
const draftFalseText = ref<string>('')
const draftPageBreak = ref<string>('')
// Sprint 22g GC — Path A barcode/qrcode subtype + advanced metadata drafts.
const draftBarcodeType = ref<string>('')
const draftQrcodeType = ref<string>('')
const draftOptionsGroup = ref<string>('')

watch(
  () => props.element,
  (el) => {
    const o = (el?.options as Record<string, unknown>) ?? {}
    draftField.value = str(o.field)
    draftTitle.value = str(o.title)
    draftTestData.value = str(o.testData)
    draftFormatter.value = str(o.formatter)
    draftStyler.value = str(o.styler)
    draftFormat.value = str(o.format)
    draftTrueText.value = str(o.trueText)
    draftFalseText.value = str(o.falseText)
    // `pageBreak` is stored as number[] | boolean | string; render the
    // canonical comma-separated number list back into the input.
    const pb = o.pageBreak
    if (Array.isArray(pb)) {
      draftPageBreak.value = pb.join(', ')
    } else if (typeof pb === 'number') {
      draftPageBreak.value = String(pb)
    } else if (pb === true || pb === 'true') {
      draftPageBreak.value = 'true'
    } else {
      draftPageBreak.value = ''
    }
    // Sprint 22g GC drafts.
    draftBarcodeType.value = str(o.barcodeType)
    draftQrcodeType.value = str(o.qrcodeType)
    draftOptionsGroup.value = str(o.optionsGroup)
  },
  { immediate: true, deep: true }
)

// ============ Position fieldset ============
// Sprint 22g GC — coordinateSync / widthHeightSync mirroring. When the
// corresponding option flag is true, editing one axis writes the same
// numeric value into both keys in a single store patch (so undo collapses
// the pair, and the canvas re-renders once).
function onLeft(ev: Event): void {
  const v = num((ev.target as HTMLInputElement).value, 0)
  const patch: Record<string, unknown> = { left: v }
  if (bool(opts.value.coordinateSync)) patch.top = v
  update(patch, false)
}
function onTop(ev: Event): void {
  const v = num((ev.target as HTMLInputElement).value, 0)
  const patch: Record<string, unknown> = { top: v }
  if (bool(opts.value.coordinateSync)) patch.left = v
  update(patch, false)
}
function onWidth(ev: Event): void {
  const v = num((ev.target as HTMLInputElement).value, 0)
  const patch: Record<string, unknown> = { width: v }
  if (bool(opts.value.widthHeightSync)) patch.height = v
  update(patch, false)
}
function onHeight(ev: Event): void {
  const v = num((ev.target as HTMLInputElement).value, 0)
  const patch: Record<string, unknown> = { height: v }
  if (bool(opts.value.widthHeightSync)) patch.width = v
  update(patch, false)
}
function onCoordinateSync(ev: Event): void {
  update({ coordinateSync: !!(ev.target as HTMLInputElement).checked })
}
function onWidthHeightSync(ev: Event): void {
  update({ widthHeightSync: !!(ev.target as HTMLInputElement).checked })
}
function onTransform(ev: Event): void {
  // V1 stores rotation as a numeric degree value under `transform`. The
  // helper in _helpers.ts coerces it into `transform: rotate(<n>deg)` CSS.
  update({ transform: num((ev.target as HTMLInputElement).value, 0) }, false)
}
function onPositionLocked(ev: Event): void {
  update({ positionLocked: !!(ev.target as HTMLInputElement).checked })
}
function onSizeLocked(ev: Event): void {
  update({ sizeLocked: !!(ev.target as HTMLInputElement).checked })
}
function onZIndex(ev: Event): void {
  update({ zIndex: num((ev.target as HTMLInputElement).value, 0) }, false)
}

// ============ Font fieldset ============
function onFontFamily(ev: Event): void {
  update({ fontFamily: str((ev.target as HTMLSelectElement).value) })
}
function onFontSize(ev: Event): void {
  update({ fontSize: num((ev.target as HTMLInputElement).value, 14) }, false)
}
function onFontWeight(ev: Event): void {
  update({ fontWeight: str((ev.target as HTMLSelectElement).value) })
}
function toggleItalic(): void {
  update({
    fontStyle: opts.value.fontStyle === 'italic' ? 'normal' : 'italic',
  })
}
function onColor(ev: Event): void {
  update({ color: str((ev.target as HTMLInputElement).value) })
}
function onLineHeight(ev: Event): void {
  update({ lineHeight: num((ev.target as HTMLInputElement).value, 0) }, false)
}
function onLetterSpacing(ev: Event): void {
  update(
    { letterSpacing: num((ev.target as HTMLInputElement).value, 0) },
    false
  )
}
function toggleUnderline(): void {
  update({
    textDecoration:
      opts.value.textDecoration === 'underline' ? 'none' : 'underline',
  })
}

// ============ Align fieldset ============
function onTextAlign(value: 'left' | 'center' | 'right' | 'justify'): void {
  update({ textAlign: value })
}
function onVAlign(value: 'top' | 'middle' | 'bottom'): void {
  update({ textContentVerticalAlign: value })
}
function onTextWrap(ev: Event): void {
  update({ textContentWrap: str((ev.target as HTMLSelectElement).value) })
}
function onPadL(ev: Event): void {
  update(
    { contentPaddingLeft: num((ev.target as HTMLInputElement).value, 0) },
    false
  )
}
function onPadT(ev: Event): void {
  update(
    { contentPaddingTop: num((ev.target as HTMLInputElement).value, 0) },
    false
  )
}
function onPadR(ev: Event): void {
  update(
    { contentPaddingRight: num((ev.target as HTMLInputElement).value, 0) },
    false
  )
}
function onPadB(ev: Event): void {
  update(
    { contentPaddingBottom: num((ev.target as HTMLInputElement).value, 0) },
    false
  )
}

// ============ Border fieldset ============
function onBorderStyle(ev: Event): void {
  update({ borderStyle: str((ev.target as HTMLSelectElement).value) })
}
function onBorderWidth(ev: Event): void {
  update({ borderWidth: num((ev.target as HTMLInputElement).value, 1) }, false)
}
function onBorderColor(ev: Event): void {
  update({ borderColor: str((ev.target as HTMLInputElement).value) })
}
function onBorderRadius(ev: Event): void {
  update({ borderRadius: str((ev.target as HTMLInputElement).value) })
}
function onBorderSide(
  side: 'borderTop' | 'borderLeft' | 'borderRight' | 'borderBottom',
  ev: Event
): void {
  update({ [side]: str((ev.target as HTMLSelectElement).value) })
}

// ============ Background fieldset ============
function onBgColor(ev: Event): void {
  update({ backgroundColor: str((ev.target as HTMLInputElement).value) })
}

// ============ TextType (Path A) fieldset ============
function onTextType(ev: Event): void {
  // textType=`barcode|qrcode` triggers TextElement → BarcodeElement/QrcodeElement
  // dispatch (see TextElement.vue:76 textTypeDispatch). Default is `text`.
  update({ textType: str((ev.target as HTMLSelectElement).value) })
}
function onBarcodeMode(ev: Event): void {
  update({ barcodeMode: str((ev.target as HTMLSelectElement).value) })
}
function onQrLevel(ev: Event): void {
  update({ qrCodeLevel: num((ev.target as HTMLSelectElement).value, 0) })
}
// Sprint 22g GC — Path A barcode/qrcode tuning fields.
function onBarTextMode(ev: Event): void {
  // V1 enum: '' (default) / 'text' (separate <div>) / 'svg' (inside SVG).
  // render.ts + BarcodeElement.vue route 'text' to an external text node
  // and pass includetext:false to bwip-js (V1 line 10080 parity).
  update({ barTextMode: str((ev.target as HTMLSelectElement).value) })
}
function onBarWidth(ev: Event): void {
  // V1 enum: '' (default 1) / 1 / 2 / 3 / 4. We accept any number to keep
  // forwards-compat with custom presets. render.ts clamps min:1.
  update({ barWidth: num((ev.target as HTMLInputElement).value, 1) }, false)
}
function onBarAutoWidth(ev: Event): void {
  // V1 tri-state: '' (default, =true) / 'true' / 'false'. We canonicalize
  // to a strict boolean (V3 invariant) — render.ts reads via isTrue().
  const raw = str((ev.target as HTMLSelectElement).value)
  if (raw === '') {
    update({ barAutoWidth: undefined })
  } else {
    update({ barAutoWidth: raw === 'true' })
  }
}
function onBarcodeTypeCommit(): void {
  // Path B `barcodeType` — bwip-js bcid string (overrides barcodeMode when
  // present). render.ts prefers this over the Path A enum.
  update({ barcodeType: draftBarcodeType.value })
}
function onQrcodeTypeCommit(): void {
  // Path B `qrcodeType` — bwip-js bcid for qrcode variants (qrcode, hibcazteccode,
  // datamatrix, ...). Default 'qrcode' in render.ts/QrcodeElement.vue.
  update({ qrcodeType: draftQrcodeType.value })
}
function onUpperCase(ev: Event): void {
  // V1 quirk — render-time value.toUpperCase(). Wired in _helpers.ts
  // computeDisplayText + render.ts text/longText paths.
  update({ upperCase: !!(ev.target as HTMLInputElement).checked })
}
/**
 * Sprint 22g GC — `optionsGroup` is a V1 internal field used by the legacy
 * property panel to group supportOptions entries under a custom heading
 * (e.g. "tableSummary", "table-toolbar"). It has no rendering effect in
 * V3 — surfaced as a free-form text input so V1 templates that carry the
 * key can round-trip without data loss. Advanced metadata; most users
 * should leave blank.
 *
 * @advanced V1 internal field. No render-time semantics.
 */
function onOptionsGroupCommit(): void {
  update({ optionsGroup: draftOptionsGroup.value })
}

// ============ DataType + Format fieldset ============
function onDataType(ev: Event): void {
  update({ dataType: str((ev.target as HTMLSelectElement).value) })
}
function onFormatCommit(): void {
  update({ format: draftFormat.value })
}
function onTrueTextCommit(): void {
  update({ trueText: draftTrueText.value })
}
function onFalseTextCommit(): void {
  update({ falseText: draftFalseText.value })
}

// ============ Binding fieldset ============
function onFieldCommit(): void {
  update({ field: draftField.value })
}
function onTitleCommit(): void {
  update({ title: draftTitle.value })
}
function onTestDataCommit(): void {
  update({ testData: draftTestData.value })
}
function onHideTitle(ev: Event): void {
  update({ hideTitle: !!(ev.target as HTMLInputElement).checked })
}
function onFormatterCommit(): void {
  // V1 accepts string-source formatters (compileFormatter normalises both
  // shapes). Store the raw string; runtime compile happens lazily.
  update({ formatter: draftFormatter.value })
}
function onStylerCommit(): void {
  update({ styler: draftStyler.value })
}

// ============ Pagination fieldset ============
function onPageBreakCommit(): void {
  // Accept either "true" boolean keyword or a comma-separated list of
  // integers. Empty string → undefined. V1 semantics: number[] forces
  // page break after the listed page indexes (1-based).
  const raw = draftPageBreak.value.trim()
  if (raw === '') {
    update({ pageBreak: undefined })
    return
  }
  if (raw === 'true' || raw === 'false') {
    update({ pageBreak: raw === 'true' })
    return
  }
  const parts = raw
    .split(/[\s,]+/)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n))
  update({ pageBreak: parts })
}
function onShowInPage(ev: Event): void {
  update({ showInPage: str((ev.target as HTMLSelectElement).value) })
}
function onUnShowInPage(ev: Event): void {
  update({ unShowInPage: str((ev.target as HTMLSelectElement).value) })
}
function onFixed(ev: Event): void {
  update({ fixed: !!(ev.target as HTMLInputElement).checked })
}
function onAxis(ev: Event): void {
  update({ axis: str((ev.target as HTMLSelectElement).value) })
}

// ============ Misc fieldset ============
function onLock(ev: Event): void {
  update({ lock: !!(ev.target as HTMLInputElement).checked })
}
function onDraggable(ev: Event): void {
  update({ draggable: !!(ev.target as HTMLInputElement).checked })
}

// ============ Visibility computed ============
const isBarcode = computed(() => opts.value.textType === 'barcode')
const isQrcode = computed(() => opts.value.textType === 'qrcode')
const isBoolean = computed(() => opts.value.dataType === 'boolean')
const isDatetime = computed(() => opts.value.dataType === 'datetime')
</script>

<template>
  <div class="hiprint-text-property-panel" aria-label="Text properties">
    <!-- Position -->
    <fieldset class="hiprint-property-fieldset">
      <legend>Position</legend>
      <div class="hiprint-property-grid-2">
        <label>
          X
          <input
            type="number"
            class="tx-left"
            :value="num(opts.left, 0)"
            @input="onLeft"
            @change="commit"
          />
        </label>
        <label>
          Y
          <input
            type="number"
            class="tx-top"
            :value="num(opts.top, 0)"
            @input="onTop"
            @change="commit"
          />
        </label>
        <label>
          W
          <input
            type="number"
            min="0"
            class="tx-width"
            :value="num(opts.width, 0)"
            @input="onWidth"
            @change="commit"
          />
        </label>
        <label>
          H
          <input
            type="number"
            min="0"
            class="tx-height"
            :value="num(opts.height, 0)"
            @input="onHeight"
            @change="commit"
          />
        </label>
      </div>
      <label>
        Rotate (deg)
        <input
          type="number"
          step="1"
          class="tx-transform"
          :value="num(opts.transform, 0)"
          @input="onTransform"
          @change="commit"
        />
      </label>
      <label>
        Z-index
        <input
          type="number"
          class="tx-zindex"
          :value="num(opts.zIndex, 0)"
          @input="onZIndex"
          @change="commit"
        />
      </label>
      <div class="hiprint-property-row">
        <label class="inline">
          <input
            type="checkbox"
            class="tx-position-locked"
            :checked="bool(opts.positionLocked)"
            @change="onPositionLocked"
          />
          Position locked
        </label>
        <label class="inline">
          <input
            type="checkbox"
            class="tx-size-locked"
            :checked="bool(opts.sizeLocked)"
            @change="onSizeLocked"
          />
          Size locked
        </label>
      </div>
      <!-- Sprint 22g GC — coordinate / size mirroring (V1 parity).  -->
      <div class="hiprint-property-row">
        <label class="inline">
          <input
            type="checkbox"
            class="tx-coordinate-sync"
            :checked="bool(opts.coordinateSync)"
            @change="onCoordinateSync"
          />
          Sync X / Y (mirror coordinates)
        </label>
        <label class="inline">
          <input
            type="checkbox"
            class="tx-width-height-sync"
            :checked="bool(opts.widthHeightSync)"
            @change="onWidthHeightSync"
          />
          Sync W / H (mirror dimensions)
        </label>
      </div>
    </fieldset>

    <!-- Font -->
    <fieldset class="hiprint-property-fieldset">
      <legend>Font</legend>
      <label>
        Family
        <select
          class="tx-font-family"
          :value="str(opts.fontFamily)"
          @change="onFontFamily"
        >
          <option value="">(inherit)</option>
          <option value="SimSun">SimSun</option>
          <option value="SimHei">SimHei</option>
          <option value="Microsoft YaHei">Microsoft YaHei</option>
          <option value="KaiTi">KaiTi</option>
          <option value="FangSong">FangSong</option>
          <option value="Arial">Arial</option>
          <option value="Helvetica">Helvetica</option>
          <option value="Times New Roman">Times New Roman</option>
        </select>
      </label>
      <div class="hiprint-property-row">
        <label>
          Size (pt)
          <input
            type="number"
            min="6"
            max="72"
            step="0.25"
            class="tx-font-size"
            :value="num(opts.fontSize, 14)"
            @input="onFontSize"
            @change="commit"
          />
        </label>
        <label>
          Weight
          <select
            class="tx-font-weight"
            :value="str(opts.fontWeight)"
            @change="onFontWeight"
          >
            <option value="">(default)</option>
            <option value="lighter">lighter</option>
            <option value="normal">normal</option>
            <option value="bold">bold</option>
            <option value="bolder">bolder</option>
            <option value="100">100</option>
            <option value="200">200</option>
            <option value="300">300</option>
            <option value="400">400</option>
            <option value="500">500</option>
            <option value="600">600</option>
            <option value="700">700</option>
            <option value="800">800</option>
            <option value="900">900</option>
          </select>
        </label>
      </div>
      <div class="hiprint-property-row">
        <label>
          Color
          <input
            type="color"
            class="tx-color"
            :value="str(opts.color, '#000000')"
            @change="onColor"
          />
        </label>
        <label>
          Line height
          <input
            type="number"
            step="0.25"
            min="0"
            class="tx-line-height"
            :value="num(opts.lineHeight, 0)"
            @input="onLineHeight"
            @change="commit"
          />
        </label>
      </div>
      <div class="hiprint-property-row">
        <label>
          Letter spacing
          <input
            type="number"
            step="0.25"
            min="0"
            class="tx-letter-spacing"
            :value="num(opts.letterSpacing, 0)"
            @input="onLetterSpacing"
            @change="commit"
          />
        </label>
        <button
          type="button"
          class="hiprint-property-toggle tx-italic"
          :class="{ 'is-active': opts.fontStyle === 'italic', active: opts.fontStyle === 'italic' }"
          :aria-pressed="opts.fontStyle === 'italic'"
          @click="toggleItalic"
        >
          <i>I</i>
        </button>
        <button
          type="button"
          class="hiprint-property-toggle tx-underline"
          :class="{ 'is-active': opts.textDecoration === 'underline', active: opts.textDecoration === 'underline' }"
          :aria-pressed="opts.textDecoration === 'underline'"
          @click="toggleUnderline"
        >
          <u>U</u>
        </button>
      </div>
    </fieldset>

    <!-- Align -->
    <fieldset class="hiprint-property-fieldset">
      <legend>Align</legend>
      <div class="hiprint-property-row" role="group" aria-label="Horizontal alignment">
        <button
          type="button"
          class="hiprint-property-toggle tx-align-left"
          :class="{ 'is-active': opts.textAlign === 'left', active: opts.textAlign === 'left' }"
          @click="onTextAlign('left')"
        >
          ⊣ L
        </button>
        <button
          type="button"
          class="hiprint-property-toggle tx-align-center"
          :class="{ 'is-active': opts.textAlign === 'center', active: opts.textAlign === 'center' }"
          @click="onTextAlign('center')"
        >
          ☰ C
        </button>
        <button
          type="button"
          class="hiprint-property-toggle tx-align-right"
          :class="{ 'is-active': opts.textAlign === 'right', active: opts.textAlign === 'right' }"
          @click="onTextAlign('right')"
        >
          ⊢ R
        </button>
        <button
          type="button"
          class="hiprint-property-toggle tx-align-justify"
          :class="{ 'is-active': opts.textAlign === 'justify', active: opts.textAlign === 'justify' }"
          @click="onTextAlign('justify')"
        >
          ≡ J
        </button>
      </div>
      <div class="hiprint-property-row" role="group" aria-label="Vertical alignment">
        <button
          type="button"
          class="hiprint-property-toggle tx-valign-top"
          :class="{ 'is-active': opts.textContentVerticalAlign === 'top', active: opts.textContentVerticalAlign === 'top' }"
          @click="onVAlign('top')"
        >
          ⊤ T
        </button>
        <button
          type="button"
          class="hiprint-property-toggle tx-valign-middle"
          :class="{ 'is-active': opts.textContentVerticalAlign === 'middle', active: opts.textContentVerticalAlign === 'middle' }"
          @click="onVAlign('middle')"
        >
          ☱ M
        </button>
        <button
          type="button"
          class="hiprint-property-toggle tx-valign-bottom"
          :class="{ 'is-active': opts.textContentVerticalAlign === 'bottom', active: opts.textContentVerticalAlign === 'bottom' }"
          @click="onVAlign('bottom')"
        >
          ⊥ B
        </button>
      </div>
      <label>
        Text wrap
        <select
          class="tx-text-wrap"
          :value="str(opts.textContentWrap)"
          @change="onTextWrap"
        >
          <option value="">(default)</option>
          <option value="nowrap">nowrap</option>
          <option value="clip">clip</option>
          <option value="ellipsis">ellipsis</option>
        </select>
      </label>
      <div class="hiprint-property-grid-2">
        <label>
          Pad L
          <input
            type="number"
            step="0.25"
            min="0"
            class="tx-pad-l"
            :value="num(opts.contentPaddingLeft, 0)"
            @input="onPadL"
            @change="commit"
          />
        </label>
        <label>
          Pad T
          <input
            type="number"
            step="0.25"
            min="0"
            class="tx-pad-t"
            :value="num(opts.contentPaddingTop, 0)"
            @input="onPadT"
            @change="commit"
          />
        </label>
        <label>
          Pad R
          <input
            type="number"
            step="0.25"
            min="0"
            class="tx-pad-r"
            :value="num(opts.contentPaddingRight, 0)"
            @input="onPadR"
            @change="commit"
          />
        </label>
        <label>
          Pad B
          <input
            type="number"
            step="0.25"
            min="0"
            class="tx-pad-b"
            :value="num(opts.contentPaddingBottom, 0)"
            @input="onPadB"
            @change="commit"
          />
        </label>
      </div>
    </fieldset>

    <!-- Border -->
    <fieldset class="hiprint-property-fieldset">
      <legend>Border</legend>
      <label>
        Style
        <select
          class="tx-border-style"
          :value="str(opts.borderStyle)"
          @change="onBorderStyle"
        >
          <option value="">(default)</option>
          <option value="none">none</option>
          <option value="solid">solid</option>
          <option value="dashed">dashed</option>
          <option value="dotted">dotted</option>
        </select>
      </label>
      <div class="hiprint-property-row">
        <label>
          Width
          <input
            type="number"
            min="0"
            step="0.25"
            class="tx-border-width"
            :value="num(opts.borderWidth, 0)"
            @input="onBorderWidth"
            @change="commit"
          />
        </label>
        <label>
          Color
          <input
            type="color"
            class="tx-border-color"
            :value="str(opts.borderColor, '#000000')"
            @change="onBorderColor"
          />
        </label>
      </div>
      <label>
        Radius
        <input
          type="text"
          class="tx-border-radius"
          placeholder="4pt or 50%"
          :value="str(opts.borderRadius)"
          @change="onBorderRadius"
        />
      </label>
      <div class="hiprint-property-grid-2">
        <label>
          Top
          <select
            class="tx-border-top"
            :value="str(opts.borderTop)"
            @change="(e) => onBorderSide('borderTop', e)"
          >
            <option value="">none</option>
            <option value="solid">solid</option>
            <option value="dotted">dotted</option>
          </select>
        </label>
        <label>
          Left
          <select
            class="tx-border-left"
            :value="str(opts.borderLeft)"
            @change="(e) => onBorderSide('borderLeft', e)"
          >
            <option value="">none</option>
            <option value="solid">solid</option>
            <option value="dotted">dotted</option>
          </select>
        </label>
        <label>
          Right
          <select
            class="tx-border-right"
            :value="str(opts.borderRight)"
            @change="(e) => onBorderSide('borderRight', e)"
          >
            <option value="">none</option>
            <option value="solid">solid</option>
            <option value="dotted">dotted</option>
          </select>
        </label>
        <label>
          Bottom
          <select
            class="tx-border-bottom"
            :value="str(opts.borderBottom)"
            @change="(e) => onBorderSide('borderBottom', e)"
          >
            <option value="">none</option>
            <option value="solid">solid</option>
            <option value="dotted">dotted</option>
          </select>
        </label>
      </div>
    </fieldset>

    <!-- Background -->
    <fieldset class="hiprint-property-fieldset">
      <legend>Background</legend>
      <label>
        Color
        <input
          type="color"
          class="tx-bg-color"
          :value="str(opts.backgroundColor, '#ffffff')"
          @change="onBgColor"
        />
      </label>
    </fieldset>

    <!-- TextType (Path A) -->
    <fieldset class="hiprint-property-fieldset">
      <legend>Text type</legend>
      <label>
        Type
        <select
          class="tx-text-type"
          :value="str(opts.textType, 'text')"
          @change="onTextType"
        >
          <option value="text">text</option>
          <option value="barcode">barcode</option>
          <option value="qrcode">qrcode</option>
        </select>
      </label>
      <label v-if="isBarcode">
        Barcode mode
        <select
          class="tx-barcode-mode"
          :value="str(opts.barcodeMode, 'CODE128')"
          @change="onBarcodeMode"
        >
          <option value="CODE128">CODE128</option>
          <option value="CODE128A">CODE128A</option>
          <option value="CODE128B">CODE128B</option>
          <option value="CODE128C">CODE128C</option>
          <option value="CODE39">CODE39</option>
          <option value="EAN13">EAN13</option>
          <option value="EAN8">EAN8</option>
          <option value="EAN5">EAN5</option>
          <option value="EAN2">EAN2</option>
          <option value="UPC">UPC</option>
          <option value="ITF">ITF</option>
          <option value="ITF14">ITF14</option>
          <option value="MSI">MSI</option>
          <option value="MSI10">MSI10</option>
          <option value="MSI11">MSI11</option>
          <option value="MSI1010">MSI1010</option>
          <option value="MSI1110">MSI1110</option>
          <option value="Pharmacode">Pharmacode</option>
        </select>
      </label>
      <label v-if="isQrcode">
        QR level
        <select
          class="tx-qr-level"
          :value="num(opts.qrCodeLevel, 0)"
          @change="onQrLevel"
        >
          <option value="1">L (7%)</option>
          <option value="0">M (15%)</option>
          <option value="3">Q (25%)</option>
          <option value="2">H (30%)</option>
        </select>
      </label>
      <!-- Sprint 22g GC — Path A barcode tuning. Visible only when textType=barcode. -->
      <template v-if="isBarcode">
        <label>
          Bar text mode (V1 barTextMode)
          <select
            class="tx-bar-text-mode"
            :value="str(opts.barTextMode)"
            @change="onBarTextMode"
          >
            <option value="">default (in SVG)</option>
            <option value="text">separate text line</option>
            <option value="svg">SVG-embedded text</option>
          </select>
        </label>
        <div class="hiprint-property-row">
          <label>
            Bar width (scale)
            <input
              type="number"
              min="1"
              step="1"
              class="tx-bar-width"
              :value="num(opts.barWidth, 1)"
              @input="onBarWidth"
              @change="commit"
            />
          </label>
          <label>
            Auto-width
            <select
              class="tx-bar-auto-width"
              :value="
                opts.barAutoWidth == null
                  ? ''
                  : opts.barAutoWidth === true || opts.barAutoWidth === 'true'
                    ? 'true'
                    : 'false'
              "
              @change="onBarAutoWidth"
            >
              <option value="">default</option>
              <option value="true">on</option>
              <option value="false">off</option>
            </select>
          </label>
        </div>
        <label>
          Barcode type (bwip-js bcid)
          <input
            type="text"
            class="tx-barcode-type"
            placeholder="e.g. code128, ean13"
            v-model="draftBarcodeType"
            @blur="onBarcodeTypeCommit"
            @keydown.enter="onBarcodeTypeCommit"
          />
        </label>
      </template>
      <!-- Sprint 22g GC — Path A qrcode bcid override. -->
      <label v-if="isQrcode">
        QR type (bwip-js bcid)
        <input
          type="text"
          class="tx-qrcode-type"
          placeholder="qrcode (default)"
          v-model="draftQrcodeType"
          @blur="onQrcodeTypeCommit"
          @keydown.enter="onQrcodeTypeCommit"
        />
      </label>
    </fieldset>

    <!-- DataType + Format -->
    <fieldset class="hiprint-property-fieldset">
      <legend>Data type</legend>
      <label>
        Type
        <select
          class="tx-data-type"
          :value="str(opts.dataType)"
          @change="onDataType"
        >
          <option value="">text</option>
          <option value="datetime">datetime</option>
          <option value="boolean">boolean</option>
        </select>
      </label>
      <label v-if="isDatetime || isBoolean">
        Format
        <input
          type="text"
          class="tx-format"
          :placeholder="
            isBoolean ? 'trueText:falseText' : 'e.g. yyyy-MM-dd'
          "
          v-model="draftFormat"
          @blur="onFormatCommit"
          @keydown.enter="onFormatCommit"
        />
      </label>
      <template v-if="isBoolean">
        <label>
          True text
          <input
            type="text"
            class="tx-true-text"
            v-model="draftTrueText"
            @blur="onTrueTextCommit"
            @keydown.enter="onTrueTextCommit"
          />
        </label>
        <label>
          False text
          <input
            type="text"
            class="tx-false-text"
            v-model="draftFalseText"
            @blur="onFalseTextCommit"
            @keydown.enter="onFalseTextCommit"
          />
        </label>
      </template>
    </fieldset>

    <!-- Binding -->
    <fieldset class="hiprint-property-fieldset">
      <legend>Binding</legend>
      <label>
        Title
        <input
          type="text"
          class="tx-title"
          v-model="draftTitle"
          @blur="onTitleCommit"
          @keydown.enter="onTitleCommit"
        />
      </label>
      <label class="inline">
        <input
          type="checkbox"
          class="tx-hide-title"
          :checked="bool(opts.hideTitle)"
          @change="onHideTitle"
        />
        Hide title
      </label>
      <label>
        Field
        <input
          type="text"
          class="tx-field"
          placeholder="data.path"
          v-model="draftField"
          @blur="onFieldCommit"
          @keydown.enter="onFieldCommit"
        />
      </label>
      <label>
        Test data
        <input
          type="text"
          class="tx-test-data"
          v-model="draftTestData"
          @blur="onTestDataCommit"
          @keydown.enter="onTestDataCommit"
        />
      </label>
      <label>
        Formatter
        <textarea
          class="tx-formatter"
          rows="3"
          spellcheck="false"
          placeholder="function(title, value, options, templateData, target) { return ... }"
          v-model="draftFormatter"
          @blur="onFormatterCommit"
        />
      </label>
      <label>
        Styler
        <textarea
          class="tx-styler"
          rows="3"
          spellcheck="false"
          placeholder="function(value, options, target, templateData) { return { color: '#f00' } }"
          v-model="draftStyler"
          @blur="onStylerCommit"
        />
      </label>
    </fieldset>

    <!-- Pagination -->
    <fieldset class="hiprint-property-fieldset">
      <legend>Pagination</legend>
      <label>
        Page break (after pages, comma-separated)
        <input
          type="text"
          class="tx-page-break"
          placeholder="1, 3, 5"
          v-model="draftPageBreak"
          @blur="onPageBreakCommit"
          @keydown.enter="onPageBreakCommit"
        />
      </label>
      <label>
        Show in page
        <select
          class="tx-show-in-page"
          :value="str(opts.showInPage)"
          @change="onShowInPage"
        >
          <option value="">always</option>
          <option value="none">hidden</option>
          <option value="first">first</option>
          <option value="last">last</option>
          <option value="odd">odd</option>
          <option value="even">even</option>
        </select>
      </label>
      <label>
        Hide in page
        <select
          class="tx-unshow-in-page"
          :value="str(opts.unShowInPage)"
          @change="onUnShowInPage"
        >
          <option value="">never</option>
          <option value="first">first</option>
          <option value="last">last</option>
        </select>
      </label>
      <label>
        Drag axis
        <select
          class="tx-axis"
          :value="str(opts.axis)"
          @change="onAxis"
        >
          <option value="">free</option>
          <option value="h">horizontal</option>
          <option value="v">vertical</option>
        </select>
      </label>
      <label class="inline">
        <input
          type="checkbox"
          class="tx-fixed"
          :checked="bool(opts.fixed)"
          @change="onFixed"
        />
        Fixed position (no pagination)
      </label>
    </fieldset>

    <!-- Misc -->
    <fieldset class="hiprint-property-fieldset">
      <legend>Misc</legend>
      <label class="inline">
        <input
          type="checkbox"
          class="tx-lock"
          :checked="bool(opts.lock)"
          @change="onLock"
        />
        Lock (no select / no edit)
      </label>
      <label class="inline">
        <input
          type="checkbox"
          class="tx-draggable"
          :checked="opts.draggable !== false && opts.draggable !== 'false'"
          @change="onDraggable"
        />
        Draggable
      </label>
      <!-- Sprint 22g GC — V1 upperCase render-time quirk. -->
      <label class="inline">
        <input
          type="checkbox"
          class="tx-upper-case"
          :checked="bool(opts.upperCase)"
          @change="onUpperCase"
        />
        Uppercase value at render (V1 quirk)
      </label>
    </fieldset>

    <!-- Sprint 22g GC — Advanced (V1 internal field; no render effect). -->
    <fieldset class="hiprint-property-fieldset">
      <legend>Advanced</legend>
      <label>
        Options group (V1 internal; advanced — usually leave blank)
        <input
          type="text"
          class="tx-options-group"
          placeholder="V1 supportOptions grouping key"
          v-model="draftOptionsGroup"
          @blur="onOptionsGroupCommit"
          @keydown.enter="onOptionsGroupCommit"
        />
      </label>
    </fieldset>
  </div>
</template>

<style scoped>
.hiprint-text-property-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
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
  padding: 4px 6px;
  border: 1px solid #d9d9d9;
  border-radius: 3px;
  font: inherit;
  color: #333;
  background: #fff;
}
.hiprint-property-fieldset input[type='number'],
.hiprint-property-fieldset input[type='text'],
.hiprint-property-fieldset select {
  height: 26px;
}
.hiprint-property-fieldset textarea {
  min-height: 60px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  resize: vertical;
}
.hiprint-property-fieldset input[type='color'] {
  width: 100%;
  height: 28px;
  padding: 0;
  border: 1px solid #d9d9d9;
  border-radius: 3px;
  cursor: pointer;
}
.hiprint-property-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.hiprint-property-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.hiprint-property-row > label {
  flex: 1;
}
.hiprint-property-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 26px;
  padding: 0 6px;
  background: #fff;
  border: 1px solid #d9d9d9;
  border-radius: 3px;
  cursor: pointer;
  font: inherit;
  color: #333;
}
.hiprint-property-toggle:hover {
  background: #f0f0f0;
}
.hiprint-property-toggle:focus-visible {
  outline: 2px solid #409eff;
  outline-offset: 1px;
}
/* TKT-250 / TKT-251 — co-emit V1 `.active` and use design tokens. */
.hiprint-property-toggle.is-active,
.hiprint-property-toggle.active {
  background: var(--hiprint-selection-bg, #e6f4ff);
  border-color: var(--hiprint-selection-outline, #409eff);
  color: var(--hiprint-primary, #1677ff);
}
</style>
