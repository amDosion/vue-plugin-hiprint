<script setup lang="ts">
/**
 * HiprintPropertyPanel.vue — V3 element property editor (P18.2).
 *
 * Replaces V2 buildPropertyPanel (V1 panel.js ~1500 lines of jQuery DOM
 * mutation + minicolors dropdowns) with a Vue 3 SFC bound to the canvas store.
 *
 * Selection modes:
 *  - 0 selected   → empty hint
 *  - 1 selected   → full property editor (Position, Size, Font, Border,
 *                   Alignment, Rotate, Text/Field bindings)
 *  - many (>1)    → only "common" props that make sense to bulk-edit
 *                   (delete-on-update via canvas.updateElement loop)
 *
 * All edits go through `canvas.updateElement(panelId, id, { options: {...} })`
 * which is the same path drag/resize use, so undo/redo (history) snapshots
 * fire from the same shape. We push a history snapshot on `change`/`blur`
 * (not on every keystroke) — debounces noise without losing edits.
 *
 * Native `<input type="color">` replaces V1's jquery-minicolors plugin. This
 * is the V3 "no jQuery" guarantee.
 *
 * Accessibility:
 *  - Each <fieldset> has a <legend> for screen readers.
 *  - Color inputs labelled.
 *  - Range inputs paired with numeric output.
 */
import { computed, ref, watch } from 'vue'
import {
  useCanvasStore,
  useHistoryStore,
  type CanvasElement,
} from '@hiprint-v3/stores'
import PaperPropertyPanel from './property/PaperPropertyPanel.vue'
import ImagePropertyPanel from './property/ImagePropertyPanel.vue'
import BarcodePropertyPanel from './property/BarcodePropertyPanel.vue'
import QrcodePropertyPanel from './property/QrcodePropertyPanel.vue'
import ShapePropertyPanel from './property/ShapePropertyPanel.vue'
import HtmlPropertyPanel from './property/HtmlPropertyPanel.vue'
import TablePropertyPanel from './property/TablePropertyPanel.vue'

const canvas = useCanvasStore()
const history = useHistoryStore()

// ============ Dispatch ============
//
// Wave 2 Stream D: each per-etype panel renders its own field surface; this
// orchestrator dispatches to them when a single element of a "known" etype
// is selected. For multi-select OR for `text` / `longText` / unknown etypes,
// we keep the original generic editor below (Position / Font / Border /
// Background / Alignment / Rotate / Binding / Lock fieldsets).
//
// PaperPropertyPanel renders when nothing is selected so paper-level edits
// remain reachable from the same panel surface.
const dispatchedTypes = new Set<string>([
  'image',
  'barcode',
  'qrcode',
  'hline',
  'vline',
  'rect',
  'oval',
  'html',
  'table',
  // PP-009 / TableElement.vue uses `tableCustom` as the runtime etype.
  'tableCustom',
])

// ============ Derived ============

const selected = computed<readonly CanvasElement[]>(
  () => canvas.selectedElements
)
const single = computed<CanvasElement | null>(() =>
  selected.value.length === 1 ? selected.value[0] ?? null : null
)
const isMulti = computed<boolean>(() => selected.value.length > 1)
const isEmpty = computed<boolean>(() => selected.value.length === 0)

/**
 * The active element's options. Returns an empty object when no element
 * selected so template `v-bind` doesn't crash.
 */
const opts = computed<Record<string, unknown>>(() => {
  const el = single.value
  if (!el) return {}
  return (el.options as Record<string, unknown>) ?? {}
})

const elementType = computed<string>(() => {
  const el = single.value
  if (!el) return ''
  return el.printElementType?.type ?? ''
})

const isShapeType = computed<boolean>(() =>
  ['hline', 'vline', 'rect', 'oval'].includes(elementType.value)
)

const isTableType = computed<boolean>(() =>
  ['table', 'tableCustom'].includes(elementType.value)
)

/**
 * Use the per-etype dispatched panel when (a) exactly one element is
 * selected and (b) its etype is in the dispatch list. Multi-select always
 * falls through to the generic editor so bulk position / font edits keep
 * working.
 */
const useDispatch = computed<boolean>(
  () =>
    single.value !== null &&
    !isMulti.value &&
    dispatchedTypes.has(elementType.value)
)

// Local field draft for text inputs — debounces store writes so typing in
// a number field doesn't push a history snapshot on every keystroke.
const draftField = ref<string>('')
const draftTitle = ref<string>('')
const draftTestData = ref<string>('')

watch(
  single,
  (el) => {
    const o = (el?.options as Record<string, unknown>) ?? {}
    draftField.value = String(o.field ?? '')
    draftTitle.value = String(o.title ?? '')
    draftTestData.value = String(o.testData ?? '')
  },
  { immediate: true }
)

// ============ Update flow ============

/**
 * Patch the selected element(s). When many selected, applies same patch to
 * every element so multi-edit works. Snapshots history only when
 * `commit=true` (caller passes true on blur / change-event commit).
 */
function update(patch: Record<string, unknown>, commit = false): void {
  const panelId = canvas.activePanelId
  if (!panelId) return
  const ids: string[] = []
  if (isMulti.value) {
    for (const el of selected.value) ids.push(el.id)
  } else if (single.value) {
    ids.push(single.value.id)
  }
  if (ids.length === 0) return
  for (const id of ids) {
    canvas.updateElement(panelId, id, { options: patch })
  }
  if (commit) history.pushSnapshot()
}

function num(v: unknown, fallback: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function numFromInput(ev: Event, fallback: number): number {
  const target = ev.target as HTMLInputElement | null
  if (!target) return fallback
  return num(target.value, fallback)
}

function strFromInput(ev: Event): string {
  const target = ev.target as HTMLInputElement | HTMLSelectElement | null
  if (!target) return ''
  return String(target.value)
}

function boolFromInput(ev: Event): boolean {
  const target = ev.target as HTMLInputElement | null
  if (!target) return false
  return !!target.checked
}

// Helpers — accept Event from @input/@change directly to keep template terse.

function onLeft(ev: Event): void {
  update({ left: numFromInput(ev, num(opts.value.left, 0)) })
}
function onTop(ev: Event): void {
  update({ top: numFromInput(ev, num(opts.value.top, 0)) })
}
function onWidth(ev: Event): void {
  update({ width: numFromInput(ev, num(opts.value.width, 0)) })
}
function onHeight(ev: Event): void {
  update({ height: numFromInput(ev, num(opts.value.height, 0)) })
}
function onFontFamily(ev: Event): void {
  update({ fontFamily: strFromInput(ev) }, true)
}
function onFontSize(ev: Event): void {
  update({ fontSize: numFromInput(ev, 14) })
}
function onColor(ev: Event): void {
  update({ color: strFromInput(ev) }, true)
}
function onBgColor(ev: Event): void {
  update({ backgroundColor: strFromInput(ev) }, true)
}
function toggleBold(): void {
  const cur = String(opts.value.fontWeight ?? '')
  update({ fontWeight: cur === 'bold' ? 'normal' : 'bold' }, true)
}
function toggleItalic(): void {
  const cur = String(opts.value.fontStyle ?? '')
  update({ fontStyle: cur === 'italic' ? 'normal' : 'italic' }, true)
}
function toggleUnderline(): void {
  const cur = String(opts.value.textDecoration ?? '')
  update(
    { textDecoration: cur === 'underline' ? 'none' : 'underline' },
    true
  )
}
function onBorderStyle(ev: Event): void {
  update({ borderStyle: strFromInput(ev) }, true)
}
function onBorderWidth(ev: Event): void {
  update({ borderWidth: numFromInput(ev, 1) })
}
function onBorderColor(ev: Event): void {
  update({ borderColor: strFromInput(ev) }, true)
}
function onTextAlign(value: 'left' | 'center' | 'right' | 'justify'): void {
  update({ textAlign: value }, true)
}
function onVAlign(value: 'top' | 'middle' | 'bottom'): void {
  update({ verticalAlign: value }, true)
}
function onRotate(ev: Event): void {
  update({ rotate: numFromInput(ev, 0) })
}
function onPadding(ev: Event): void {
  update({ padding: numFromInput(ev, 0) })
}
function onHideTitle(ev: Event): void {
  update({ hideTitle: boolFromInput(ev) }, true)
}
function onLock(ev: Event): void {
  // V1 has `lock` flag meaning "not selectable / not editable".
  update({ lock: boolFromInput(ev) }, true)
}
function onTitleCommit(): void {
  update({ title: draftTitle.value }, true)
}
function onFieldCommit(): void {
  update({ field: draftField.value }, true)
}
function onTestDataCommit(): void {
  update({ testData: draftTestData.value }, true)
}

// Commit-on-change wrapper (for sliders / numeric inputs where we want
// history snapshot on release, not on every micro-step).
function commit(): void {
  history.pushSnapshot()
}

// ============ Visibility helpers ============

/**
 * Some properties only make sense for some etypes. We hide the fieldset
 * rather than disabling so the panel stays compact.
 */
const showFont = computed<boolean>(() => {
  const t = elementType.value
  if (!t) return false
  return ['text', 'longText', 'tableCustomCell', 'html'].includes(t)
})
const showFieldBinding = computed<boolean>(() => {
  const t = elementType.value
  if (!t) return false
  return ['text', 'longText', 'image', 'barcode', 'qrcode', 'html'].includes(t)
})
const showBorder = computed<boolean>(() => {
  // Lines/shapes have their own stroke editor; everything else gets border.
  const t = elementType.value
  if (!t) return false
  return !['hline', 'vline'].includes(t)
})
</script>

<template>
  <aside
    class="hiprint-property-panel"
    aria-label="Element properties"
  >
    <!-- 0 selected → paper-level panel (Wave 2 dispatch). -->
    <PaperPropertyPanel v-if="isEmpty" />

    <!-- 1 selected, known dispatched etype → per-etype panel.
         Multi-select keeps the generic editor (bulk-edit path). -->
    <template v-else-if="useDispatch && single">
      <header class="hiprint-property-header">
        <span class="hiprint-property-type">{{ elementType || 'element' }}</span>
        <span class="hiprint-property-id">{{ single.id.slice(0, 8) }}</span>
      </header>
      <ImagePropertyPanel
        v-if="elementType === 'image'"
        :element="single"
      />
      <BarcodePropertyPanel
        v-else-if="elementType === 'barcode'"
        :element="single"
      />
      <QrcodePropertyPanel
        v-else-if="elementType === 'qrcode'"
        :element="single"
      />
      <ShapePropertyPanel
        v-else-if="isShapeType"
        :element="single"
      />
      <HtmlPropertyPanel
        v-else-if="elementType === 'html'"
        :element="single"
      />
      <TablePropertyPanel
        v-else-if="isTableType"
        :element="single"
      />
    </template>

    <!-- Fallback generic editor — text / longText / unrecognized etype
         AND every multi-select case. Keeps existing fieldset behavior. -->
    <template v-else>
      <header v-if="isMulti" class="hiprint-property-multi-hint">
        {{ selected.length }} elements selected — common properties only.
      </header>
      <header v-else class="hiprint-property-header">
        <span class="hiprint-property-type">{{ elementType || 'element' }}</span>
        <span class="hiprint-property-id">{{ single?.id?.slice(0, 8) }}</span>
      </header>

      <fieldset class="hiprint-property-fieldset">
        <legend>Position</legend>
        <div class="hiprint-property-grid-2">
          <label>
            X
            <input
              type="number"
              :value="num(opts.left, 0)"
              @input="onLeft"
              @change="commit"
            />
          </label>
          <label>
            Y
            <input
              type="number"
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
              :value="num(opts.height, 0)"
              @input="onHeight"
              @change="commit"
            />
          </label>
        </div>
      </fieldset>

      <fieldset v-if="showFont" class="hiprint-property-fieldset">
        <legend>Font</legend>
        <label>
          Family
          <select :value="String(opts.fontFamily ?? '')" @change="onFontFamily">
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
            Size
            <input
              type="number"
              min="6"
              max="72"
              :value="num(opts.fontSize, 14)"
              @input="onFontSize"
              @change="commit"
            />
          </label>
          <label>
            Color
            <input
              type="color"
              :value="String(opts.color ?? '#000000')"
              @input="onColor"
            />
          </label>
        </div>
        <div class="hiprint-property-row">
          <button
            type="button"
            class="hiprint-property-toggle"
            :class="{ 'is-active': String(opts.fontWeight) === 'bold' }"
            :aria-pressed="String(opts.fontWeight) === 'bold'"
            @click="toggleBold"
          >
            B
          </button>
          <button
            type="button"
            class="hiprint-property-toggle"
            :class="{ 'is-active': String(opts.fontStyle) === 'italic' }"
            :aria-pressed="String(opts.fontStyle) === 'italic'"
            @click="toggleItalic"
          >
            <i>I</i>
          </button>
          <button
            type="button"
            class="hiprint-property-toggle"
            :class="{ 'is-active': String(opts.textDecoration) === 'underline' }"
            :aria-pressed="String(opts.textDecoration) === 'underline'"
            @click="toggleUnderline"
          >
            <u>U</u>
          </button>
        </div>
      </fieldset>

      <fieldset v-if="showBorder" class="hiprint-property-fieldset">
        <legend>Border</legend>
        <label>
          Style
          <select
            :value="String(opts.borderStyle ?? 'solid')"
            @change="onBorderStyle"
          >
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
              max="20"
              :value="num(opts.borderWidth, 1)"
              @input="onBorderWidth"
              @change="commit"
            />
          </label>
          <label>
            Color
            <input
              type="color"
              :value="String(opts.borderColor ?? '#000000')"
              @input="onBorderColor"
            />
          </label>
        </div>
      </fieldset>

      <fieldset class="hiprint-property-fieldset">
        <legend>Background</legend>
        <label>
          Color
          <input
            type="color"
            :value="String(opts.backgroundColor ?? '#ffffff')"
            @input="onBgColor"
          />
        </label>
        <label>
          Padding
          <input
            type="number"
            min="0"
            :value="num(opts.padding, 0)"
            @input="onPadding"
            @change="commit"
          />
        </label>
      </fieldset>

      <fieldset class="hiprint-property-fieldset">
        <legend>Alignment</legend>
        <div class="hiprint-property-row" role="group" aria-label="Horizontal alignment">
          <button
            type="button"
            class="hiprint-property-toggle"
            :class="{ 'is-active': String(opts.textAlign) === 'left' }"
            :aria-pressed="String(opts.textAlign) === 'left'"
            @click="onTextAlign('left')"
          >
            ⊣ Left
          </button>
          <button
            type="button"
            class="hiprint-property-toggle"
            :class="{ 'is-active': String(opts.textAlign) === 'center' }"
            :aria-pressed="String(opts.textAlign) === 'center'"
            @click="onTextAlign('center')"
          >
            ☰ Center
          </button>
          <button
            type="button"
            class="hiprint-property-toggle"
            :class="{ 'is-active': String(opts.textAlign) === 'right' }"
            :aria-pressed="String(opts.textAlign) === 'right'"
            @click="onTextAlign('right')"
          >
            ⊢ Right
          </button>
        </div>
        <div class="hiprint-property-row" role="group" aria-label="Vertical alignment">
          <button
            type="button"
            class="hiprint-property-toggle"
            :class="{ 'is-active': String(opts.verticalAlign) === 'top' }"
            :aria-pressed="String(opts.verticalAlign) === 'top'"
            @click="onVAlign('top')"
          >
            ⊤ Top
          </button>
          <button
            type="button"
            class="hiprint-property-toggle"
            :class="{ 'is-active': String(opts.verticalAlign) === 'middle' }"
            :aria-pressed="String(opts.verticalAlign) === 'middle'"
            @click="onVAlign('middle')"
          >
            ☱ Middle
          </button>
          <button
            type="button"
            class="hiprint-property-toggle"
            :class="{ 'is-active': String(opts.verticalAlign) === 'bottom' }"
            :aria-pressed="String(opts.verticalAlign) === 'bottom'"
            @click="onVAlign('bottom')"
          >
            ⊥ Bottom
          </button>
        </div>
      </fieldset>

      <fieldset class="hiprint-property-fieldset">
        <legend>Rotate</legend>
        <label>
          {{ num(opts.rotate, 0) }}°
          <input
            type="range"
            min="0"
            max="360"
            step="1"
            :value="num(opts.rotate, 0)"
            @input="onRotate"
            @change="commit"
          />
        </label>
      </fieldset>

      <fieldset v-if="showFieldBinding && !isMulti" class="hiprint-property-fieldset">
        <legend>Binding</legend>
        <label>
          Title
          <input
            type="text"
            v-model="draftTitle"
            @blur="onTitleCommit"
            @keydown.enter="onTitleCommit"
          />
        </label>
        <label>
          <input
            type="checkbox"
            :checked="!!opts.hideTitle"
            @change="onHideTitle"
          />
          Hide title
        </label>
        <label>
          Field
          <input
            type="text"
            v-model="draftField"
            placeholder="data.path"
            @blur="onFieldCommit"
            @keydown.enter="onFieldCommit"
          />
        </label>
        <label>
          Test data
          <input
            type="text"
            v-model="draftTestData"
            @blur="onTestDataCommit"
            @keydown.enter="onTestDataCommit"
          />
        </label>
      </fieldset>

      <fieldset class="hiprint-property-fieldset">
        <legend>Lock</legend>
        <label>
          <input
            type="checkbox"
            :checked="!!opts.lock"
            @change="onLock"
          />
          Lock (no select / no edit)
        </label>
      </fieldset>
    </template>
  </aside>
</template>

<style scoped>
.hiprint-property-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: #fafafa;
  border-left: 1px solid #e5e5e5;
  font-size: 12px;
  color: #333;
  min-width: 240px;
  max-height: 100%;
  overflow-y: auto;
}

.hiprint-property-empty {
  color: #999;
  text-align: center;
  padding: 24px 8px;
  margin: 0;
}

.hiprint-property-multi-hint {
  background: #e6f4ff;
  border: 1px solid #91caff;
  border-radius: 4px;
  padding: 6px 8px;
  color: #1677ff;
}

.hiprint-property-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.hiprint-property-type {
  font-weight: 600;
  text-transform: capitalize;
}

.hiprint-property-id {
  color: #999;
  font-family: monospace;
  font-size: 11px;
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

.hiprint-property-fieldset input[type='text'],
.hiprint-property-fieldset input[type='number'],
.hiprint-property-fieldset select {
  height: 26px;
  padding: 0 6px;
  border: 1px solid #d9d9d9;
  border-radius: 3px;
  font: inherit;
  color: #333;
  background: #fff;
}

.hiprint-property-fieldset input[type='color'] {
  width: 100%;
  height: 28px;
  padding: 0;
  border: 1px solid #d9d9d9;
  border-radius: 3px;
  cursor: pointer;
}

.hiprint-property-fieldset input[type='range'] {
  width: 100%;
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

.hiprint-property-toggle.is-active {
  background: #e6f4ff;
  border-color: #409eff;
  color: #1677ff;
}
</style>
