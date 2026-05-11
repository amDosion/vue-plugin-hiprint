<script setup lang="ts">
/**
 * BarcodePropertyPanel.vue — V3 property editor for `barcode` etype (PP-007).
 *
 * Fields:
 *  - `format`        — barcode symbology (CODE128 / EAN13 / EAN8 / UPC /
 *                      ITF14 / CODE39 / CODE93). Underlying renderer
 *                      (JsBarcode in V2 / bwip-js wrapper in V3) reads this.
 *  - `displayValue`  — show human-readable text under the barcode.
 *  - `padding`       — inset in pt around the barcode bars.
 *  - `fontSize`      — text size in pt (only applied when displayValue=true).
 *  - `lineColor`     — stroke color for bars + optional caption.
 *
 * All edits go through `canvas.updateElement(activePanelId, element.id,
 * { options: patch })`. History snapshots fire on commit boundaries.
 *
 * Wave 2 integration — dispatched from HiprintPropertyPanel.vue when
 * `elementType === 'barcode'`. Multi-select keeps generic editor.
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

const opts = computed<Record<string, unknown>>(
  () => (props.element.options as Record<string, unknown>) ?? {}
)

function num(v: unknown, fallback: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function patch(p: Record<string, unknown>, commit = false): void {
  const panelId = canvas.activePanelId
  if (!panelId) return
  canvas.updateElement(panelId, props.element.id, { options: p })
  if (commit) history.pushSnapshot()
}

function onFormat(ev: Event): void {
  const target = ev.target as HTMLSelectElement | null
  if (!target) return
  patch({ format: String(target.value) }, true)
}

function onDisplayValue(ev: Event): void {
  const target = ev.target as HTMLInputElement | null
  if (!target) return
  patch({ displayValue: !!target.checked }, true)
}

function onPadding(ev: Event): void {
  const target = ev.target as HTMLInputElement | null
  if (!target) return
  patch({ padding: num(target.value, 0) })
}

function onFontSize(ev: Event): void {
  const target = ev.target as HTMLInputElement | null
  if (!target) return
  patch({ fontSize: num(target.value, 14) })
}

function onLineColor(ev: Event): void {
  const target = ev.target as HTMLInputElement | null
  if (!target) return
  patch({ lineColor: String(target.value) }, true)
}

function commit(): void {
  history.pushSnapshot()
}
</script>

<template>
  <div class="hiprint-barcode-property-panel" aria-label="Barcode properties">
    <fieldset class="hiprint-property-fieldset">
      <legend>Barcode</legend>
      <label>
        Format
        <select
          class="bc-format"
          :value="String(opts.format ?? 'CODE128')"
          @change="onFormat"
        >
          <option value="CODE128">CODE128</option>
          <option value="EAN13">EAN13</option>
          <option value="EAN8">EAN8</option>
          <option value="UPC">UPC</option>
          <option value="ITF14">ITF14</option>
          <option value="CODE39">CODE39</option>
          <option value="CODE93">CODE93</option>
        </select>
      </label>
      <label class="inline">
        <input
          type="checkbox"
          class="bc-display-value"
          :checked="!!opts.displayValue"
          @change="onDisplayValue"
        />
        Show text under barcode
      </label>
      <label>
        Padding (pt)
        <input
          type="number"
          min="0"
          class="bc-padding"
          :value="num(opts.padding, 0)"
          @input="onPadding"
          @change="commit"
        />
      </label>
      <label>
        Font size (pt)
        <input
          type="number"
          min="6"
          max="72"
          class="bc-font-size"
          :value="num(opts.fontSize, 14)"
          @input="onFontSize"
          @change="commit"
        />
      </label>
      <label>
        Line color
        <input
          type="color"
          class="bc-line-color"
          :value="String(opts.lineColor ?? '#000000')"
          @change="onLineColor"
        />
      </label>
    </fieldset>
  </div>
</template>

<style scoped>
.hiprint-barcode-property-panel {
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
</style>
