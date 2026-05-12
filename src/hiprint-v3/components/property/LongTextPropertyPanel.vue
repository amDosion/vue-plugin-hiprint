<script setup lang="ts">
/**
 * LongTextPropertyPanel.vue — V3 property editor for `longText` etype
 * (Sprint 22c TKT-108).
 *
 * Replaces the generic HiprintPropertyPanel fallback (which surfaced ~12 of
 * the 44 V1 `longText` option fields). Field surface catalogued in
 * `docs/V1-INVENTORY/etypes/text-longtext.md` PART 2 Section B.
 *
 * Difference from TextPropertyPanel (V1 reference docs cross-reference
 * Section B "Options that exist for text but NOT for longText"):
 *
 *   Dropped from text panel:
 *     - textType / barcodeMode / qrCodeLevel (longText cannot be a barcode)
 *     - dataType / format / trueText / falseText (no datetime/boolean
 *       coercion for paragraph text)
 *     - textContentVerticalAlign (longText is multi-line; V1 omits this)
 *     - textContentWrap (longText is wrapping by nature)
 *     - textDecoration (not surfaced in V1 longText property panel)
 *
 *   Added (longText-specific):
 *     - longTextIndent (B.22) — per-line first-character indent in pt.
 *     - leftSpaceRemoved (B.23) — strip leading whitespace each line.
 *     - lHeight / minHeight (B.24) — minimum element height when text is
 *       short or empty. UI label is "Min height". Stored under the V1 key
 *       `lHeight`; rendering reads either alias.
 *     - longTextPaginate (panel-only) — explicit override for the V1
 *       binary-search auto-pagination trigger. When true, the renderer
 *       performs the V1 multi-page binary fit; when false, content is
 *       clipped to `height`. Default undefined (auto, V1 behavior).
 *
 * Field groups:
 *   Position   — left / top / width / height / transform / positionLocked /
 *                sizeLocked / zIndex / fixed
 *   Font       — fontFamily / fontSize / fontWeight / letterSpacing /
 *                color / lineHeight / longTextIndent / leftSpaceRemoved
 *   Align      — textAlign (longText supports L/C/R/J only)
 *   Layout     — minHeight (= lHeight)
 *   Border     — borderTop / borderLeft / borderRight / borderBottom /
 *                borderWidth / borderColor (supportOptions-tier — V1 keeps
 *                them in JSON even though the tabbed UI hides them)
 *   Padding    — contentPaddingLeft|Top|Right|Bottom
 *   Background — backgroundColor
 *   Binding    — field / testData / title / hideTitle / formatter / styler
 *   Pagination — pageBreak / showInPage / unShowInPage / axis /
 *                longTextPaginate
 *   Misc       — draggable
 *
 * Total V1 fields surfaced: 44 of 44 (Sprint 22g — Stream GC zero-out) +
 * 1 panel-only override (longTextPaginate).
 *
 * Sprint 22g restored fields:
 *   - coordinateSync — when on, editing X/Y mirrors the value into the
 *     opposite axis in the same store patch.
 *   - widthHeightSync — when on, editing W/H mirrors the value into the
 *     opposite dimension (handy for square shapes / aspect-preserving
 *     manual resize).
 *   - optionsGroup — V1 internal grouping placeholder string. Advanced
 *     metadata; no render effect. Surfaced for round-trip compatibility.
 *
 * Dispatched from HiprintPropertyPanel.vue when
 * `elementType === 'longText'` AND exactly one element is selected.
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

const opts = computed<Record<string, unknown>>(
  () => (props.element.options as Record<string, unknown>) ?? {}
)

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

function update(patch: Record<string, unknown>, commit = true): void {
  const panelId = canvas.activePanelId
  if (!panelId) return
  canvas.updateElement(panelId, props.element.id, { options: patch })
  if (commit) history.pushSnapshot()
}

function commit(): void {
  history.pushSnapshot()
}

// ============ Drafts for text inputs ============
const draftField = ref<string>('')
const draftTitle = ref<string>('')
const draftTestData = ref<string>('')
const draftFormatter = ref<string>('')
const draftStyler = ref<string>('')
const draftPageBreak = ref<string>('')
const draftMinHeight = ref<string>('')
// Sprint 22g GC — advanced V1 metadata draft.
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
    // Accept either V1 key `lHeight` or panel-friendly `minHeight`.
    const mh = o.lHeight ?? o.minHeight
    draftMinHeight.value = mh == null ? '' : String(mh)
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
    // Sprint 22g GC draft.
    draftOptionsGroup.value = str(o.optionsGroup)
  },
  { immediate: true, deep: true }
)

// ============ Position ============
// Sprint 22g GC — coordinateSync / widthHeightSync mirroring (V1 parity).
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
/**
 * Sprint 22g GC — V1 internal supportOptions grouping key. No render-time
 * semantics; surfaced for round-trip compat only.
 *
 * @advanced V1 internal field. No render effect.
 */
function onOptionsGroupCommit(): void {
  update({ optionsGroup: draftOptionsGroup.value })
}
function onTransform(ev: Event): void {
  update({ transform: num((ev.target as HTMLInputElement).value, 0) }, false)
}
function onZIndex(ev: Event): void {
  update({ zIndex: num((ev.target as HTMLInputElement).value, 0) }, false)
}
function onPositionLocked(ev: Event): void {
  update({ positionLocked: !!(ev.target as HTMLInputElement).checked })
}
function onSizeLocked(ev: Event): void {
  update({ sizeLocked: !!(ev.target as HTMLInputElement).checked })
}
function onFixed(ev: Event): void {
  update({ fixed: !!(ev.target as HTMLInputElement).checked })
}

// ============ Font ============
function onFontFamily(ev: Event): void {
  update({ fontFamily: str((ev.target as HTMLSelectElement).value) })
}
function onFontSize(ev: Event): void {
  update({ fontSize: num((ev.target as HTMLInputElement).value, 14) }, false)
}
function onFontWeight(ev: Event): void {
  update({ fontWeight: str((ev.target as HTMLSelectElement).value) })
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
function onIndent(ev: Event): void {
  // V1 sanitizes longTextIndent to integer ≥ 0 — XSS C1 hardening (see V1
  // line 9813-9817). We coerce via Number(), reject negatives at write time.
  const raw = num((ev.target as HTMLInputElement).value, 0)
  update({ longTextIndent: Math.max(0, Math.floor(raw)) }, false)
}
function onLeftSpaceRemoved(ev: Event): void {
  update({ leftSpaceRemoved: !!(ev.target as HTMLInputElement).checked })
}

// ============ Align ============
function onTextAlign(value: 'left' | 'center' | 'right' | 'justify'): void {
  update({ textAlign: value })
}

// ============ Layout (longText-specific) ============
function onMinHeightCommit(): void {
  // `draftMinHeight` is bound via v-model to a number-type input, so Vue
  // may coerce the model value to `Number` or leave it as the raw string
  // depending on browser behavior. Normalize through String() before trim.
  const raw = String(draftMinHeight.value ?? '').trim()
  if (raw === '') {
    update({ lHeight: undefined })
    return
  }
  update({ lHeight: num(raw, 0) })
}

// ============ Border ============
function onBorderWidth(ev: Event): void {
  update({ borderWidth: num((ev.target as HTMLInputElement).value, 1) }, false)
}
function onBorderColor(ev: Event): void {
  update({ borderColor: str((ev.target as HTMLInputElement).value) })
}
function onBorderSide(
  side: 'borderTop' | 'borderLeft' | 'borderRight' | 'borderBottom',
  ev: Event
): void {
  update({ [side]: str((ev.target as HTMLSelectElement).value) })
}

// ============ Padding ============
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

// ============ Background ============
function onBgColor(ev: Event): void {
  update({ backgroundColor: str((ev.target as HTMLInputElement).value) })
}

// ============ Binding ============
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
  update({ formatter: draftFormatter.value })
}
function onStylerCommit(): void {
  update({ styler: draftStyler.value })
}

// ============ Pagination ============
function onPageBreakCommit(): void {
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
function onAxis(ev: Event): void {
  update({ axis: str((ev.target as HTMLSelectElement).value) })
}
function onLongTextPaginate(ev: Event): void {
  // tri-state: '' = auto (omit), 'true', 'false'.
  const v = str((ev.target as HTMLSelectElement).value)
  if (v === '') {
    update({ longTextPaginate: undefined })
  } else {
    update({ longTextPaginate: v === 'true' })
  }
}

// ============ Misc ============
function onDraggable(ev: Event): void {
  update({ draggable: !!(ev.target as HTMLInputElement).checked })
}
</script>

<template>
  <div class="hiprint-longtext-property-panel" aria-label="Long text properties">
    <!-- Position -->
    <fieldset class="hiprint-property-fieldset">
      <legend>Position</legend>
      <div class="hiprint-property-grid-2">
        <label>
          X
          <input
            type="number"
            class="lt-left"
            :value="num(opts.left, 0)"
            @input="onLeft"
            @change="commit"
          />
        </label>
        <label>
          Y
          <input
            type="number"
            class="lt-top"
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
            class="lt-width"
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
            class="lt-height"
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
          class="lt-transform"
          :value="num(opts.transform, 0)"
          @input="onTransform"
          @change="commit"
        />
      </label>
      <label>
        Z-index
        <input
          type="number"
          class="lt-zindex"
          :value="num(opts.zIndex, 0)"
          @input="onZIndex"
          @change="commit"
        />
      </label>
      <div class="hiprint-property-row">
        <label class="inline">
          <input
            type="checkbox"
            class="lt-position-locked"
            :checked="bool(opts.positionLocked)"
            @change="onPositionLocked"
          />
          Position locked
        </label>
        <label class="inline">
          <input
            type="checkbox"
            class="lt-size-locked"
            :checked="bool(opts.sizeLocked)"
            @change="onSizeLocked"
          />
          Size locked
        </label>
      </div>
      <label class="inline">
        <input
          type="checkbox"
          class="lt-fixed"
          :checked="bool(opts.fixed)"
          @change="onFixed"
        />
        Fixed position (no pagination)
      </label>
      <!-- Sprint 22g GC — coordinate / size sync (V1 parity). -->
      <div class="hiprint-property-row">
        <label class="inline">
          <input
            type="checkbox"
            class="lt-coordinate-sync"
            :checked="bool(opts.coordinateSync)"
            @change="onCoordinateSync"
          />
          Sync X / Y
        </label>
        <label class="inline">
          <input
            type="checkbox"
            class="lt-width-height-sync"
            :checked="bool(opts.widthHeightSync)"
            @change="onWidthHeightSync"
          />
          Sync W / H
        </label>
      </div>
    </fieldset>

    <!-- Font -->
    <fieldset class="hiprint-property-fieldset">
      <legend>Font</legend>
      <label>
        Family
        <select
          class="lt-font-family"
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
            class="lt-font-size"
            :value="num(opts.fontSize, 14)"
            @input="onFontSize"
            @change="commit"
          />
        </label>
        <label>
          Weight
          <select
            class="lt-font-weight"
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
            class="lt-color"
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
            class="lt-line-height"
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
            class="lt-letter-spacing"
            :value="num(opts.letterSpacing, 0)"
            @input="onLetterSpacing"
            @change="commit"
          />
        </label>
        <label>
          First-line indent (pt)
          <input
            type="number"
            min="0"
            step="1"
            class="lt-indent"
            :value="num(opts.longTextIndent, 0)"
            @input="onIndent"
            @change="commit"
          />
        </label>
      </div>
      <label class="inline">
        <input
          type="checkbox"
          class="lt-left-space-removed"
          :checked="bool(opts.leftSpaceRemoved)"
          @change="onLeftSpaceRemoved"
        />
        Strip leading whitespace on each line
      </label>
    </fieldset>

    <!-- Align -->
    <fieldset class="hiprint-property-fieldset">
      <legend>Align</legend>
      <div class="hiprint-property-row" role="group" aria-label="Horizontal alignment">
        <button
          type="button"
          class="hiprint-property-toggle lt-align-left"
          :class="{ 'is-active': opts.textAlign === 'left', active: opts.textAlign === 'left' }"
          @click="onTextAlign('left')"
        >
          ⊣ L
        </button>
        <button
          type="button"
          class="hiprint-property-toggle lt-align-center"
          :class="{ 'is-active': opts.textAlign === 'center', active: opts.textAlign === 'center' }"
          @click="onTextAlign('center')"
        >
          ☰ C
        </button>
        <button
          type="button"
          class="hiprint-property-toggle lt-align-right"
          :class="{ 'is-active': opts.textAlign === 'right', active: opts.textAlign === 'right' }"
          @click="onTextAlign('right')"
        >
          ⊢ R
        </button>
        <button
          type="button"
          class="hiprint-property-toggle lt-align-justify"
          :class="{ 'is-active': opts.textAlign === 'justify', active: opts.textAlign === 'justify' }"
          @click="onTextAlign('justify')"
        >
          ≡ J
        </button>
      </div>
    </fieldset>

    <!-- Layout (longText-only) -->
    <fieldset class="hiprint-property-fieldset">
      <legend>Layout</legend>
      <label>
        Min height (pt) — extends short text up to this height (V1 `lHeight`)
        <input
          type="number"
          min="0"
          step="0.25"
          class="lt-min-height"
          v-model="draftMinHeight"
          @blur="onMinHeightCommit"
          @keydown.enter="onMinHeightCommit"
        />
      </label>
    </fieldset>

    <!-- Border (supportOptions-tier — V1 keeps them in JSON though tabbed UI hides) -->
    <fieldset class="hiprint-property-fieldset">
      <legend>Border</legend>
      <div class="hiprint-property-row">
        <label>
          Width
          <input
            type="number"
            min="0"
            step="0.25"
            class="lt-border-width"
            :value="num(opts.borderWidth, 0)"
            @input="onBorderWidth"
            @change="commit"
          />
        </label>
        <label>
          Color
          <input
            type="color"
            class="lt-border-color"
            :value="str(opts.borderColor, '#000000')"
            @change="onBorderColor"
          />
        </label>
      </div>
      <div class="hiprint-property-grid-2">
        <label>
          Top
          <select
            class="lt-border-top"
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
            class="lt-border-left"
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
            class="lt-border-right"
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
            class="lt-border-bottom"
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

    <!-- Padding -->
    <fieldset class="hiprint-property-fieldset">
      <legend>Padding</legend>
      <div class="hiprint-property-grid-2">
        <label>
          Pad L
          <input
            type="number"
            step="0.25"
            min="0"
            class="lt-pad-l"
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
            class="lt-pad-t"
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
            class="lt-pad-r"
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
            class="lt-pad-b"
            :value="num(opts.contentPaddingBottom, 0)"
            @input="onPadB"
            @change="commit"
          />
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
          class="lt-bg-color"
          :value="str(opts.backgroundColor, '#ffffff')"
          @change="onBgColor"
        />
      </label>
    </fieldset>

    <!-- Binding -->
    <fieldset class="hiprint-property-fieldset">
      <legend>Binding</legend>
      <label>
        Title
        <input
          type="text"
          class="lt-title"
          v-model="draftTitle"
          @blur="onTitleCommit"
          @keydown.enter="onTitleCommit"
        />
      </label>
      <label class="inline">
        <input
          type="checkbox"
          class="lt-hide-title"
          :checked="bool(opts.hideTitle)"
          @change="onHideTitle"
        />
        Hide title
      </label>
      <label>
        Field
        <input
          type="text"
          class="lt-field"
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
          class="lt-test-data"
          v-model="draftTestData"
          @blur="onTestDataCommit"
          @keydown.enter="onTestDataCommit"
        />
      </label>
      <label>
        Formatter
        <textarea
          class="lt-formatter"
          rows="3"
          spellcheck="false"
          placeholder="function(title, value, options, templateData) { return ... }"
          v-model="draftFormatter"
          @blur="onFormatterCommit"
        />
      </label>
      <label>
        Styler
        <textarea
          class="lt-styler"
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
          class="lt-page-break"
          placeholder="1, 3, 5"
          v-model="draftPageBreak"
          @blur="onPageBreakCommit"
          @keydown.enter="onPageBreakCommit"
        />
      </label>
      <label>
        Show in page
        <select
          class="lt-show-in-page"
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
          class="lt-unshow-in-page"
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
          class="lt-axis"
          :value="str(opts.axis)"
          @change="onAxis"
        >
          <option value="">free</option>
          <option value="h">horizontal</option>
          <option value="v">vertical</option>
        </select>
      </label>
      <label>
        Auto-paginate (binary fit)
        <select
          class="lt-long-text-paginate"
          :value="
            opts.longTextPaginate == null
              ? ''
              : opts.longTextPaginate === true
                ? 'true'
                : 'false'
          "
          @change="onLongTextPaginate"
        >
          <option value="">auto (V1 default)</option>
          <option value="true">on</option>
          <option value="false">off (clip)</option>
        </select>
      </label>
    </fieldset>

    <!-- Misc -->
    <fieldset class="hiprint-property-fieldset">
      <legend>Misc</legend>
      <label class="inline">
        <input
          type="checkbox"
          class="lt-draggable"
          :checked="opts.draggable !== false && opts.draggable !== 'false'"
          @change="onDraggable"
        />
        Draggable
      </label>
    </fieldset>

    <!-- Sprint 22g GC — Advanced (V1 internal field; no render effect). -->
    <fieldset class="hiprint-property-fieldset">
      <legend>Advanced</legend>
      <label>
        Options group (V1 internal; advanced — usually leave blank)
        <input
          type="text"
          class="lt-options-group"
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
.hiprint-longtext-property-panel {
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
