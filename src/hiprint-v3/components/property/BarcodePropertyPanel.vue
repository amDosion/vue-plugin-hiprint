<script setup lang="ts">
/**
 * BarcodePropertyPanel.vue — V3 property editor for `barcode` etype (PP-007).
 *
 * Sprint 22a-r TKT-002 rollback: panel keys realigned to V3-renderer (=V1 Path B
 * bwip-js naming). Previous shipping shape wrote `format`/`lineColor`/
 * `displayValue`/`padding`/`color`/`backgroundColor` — none of which the renderer
 * read. See `docs/V3-PARITY-MATRIX/04-barcode-qrcode.md` VIOLATION 2 + 4.
 *
 * Fields:
 *  - `barcodeType` — bwip-js symbology id (lowercase). Renderer reads at
 *    `BarcodeElement.vue:86`. Values: `code128`/`ean13`/`ean8`/`upca`/
 *    `interleaved2of5`/`code39`/`code93`.
 *  - `hideTitle`   — boolean. UI is "Show text under barcode" (inverted —
 *    checked = hideTitle false). Renderer reads at `BarcodeElement.vue:79,91`.
 *  - `fontSize`    — text size in pt (only applied when hideTitle=false).
 *    Renderer reads at `BarcodeElement.vue:92`.
 *  - `barColor`    — stroke color for bars. Renderer reads at
 *    `BarcodeElement.vue:93`.
 *
 * Dropped fields (renderer did not read; carried zero functional value):
 *  - `padding` / `color` / `backgroundColor` — renderer has no equivalent in
 *    Path B bwip-js for barcode. See matrix VIOLATION-4 row evidence.
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

function onBarcodeType(ev: Event): void {
  const target = ev.target as HTMLSelectElement | null
  if (!target) return
  // bwip-js expects lowercase bcid; UI emits the canonical id directly.
  patch({ barcodeType: String(target.value).toLowerCase() }, true)
}

function onShowText(ev: Event): void {
  // UI checkbox is "Show text under barcode" — checked means
  // hideTitle=false (semantic inversion to match renderer key).
  const target = ev.target as HTMLInputElement | null
  if (!target) return
  patch({ hideTitle: !target.checked }, true)
}

function onFontSize(ev: Event): void {
  const target = ev.target as HTMLInputElement | null
  if (!target) return
  patch({ fontSize: num(target.value, 14) })
}

function onBarColor(ev: Event): void {
  const target = ev.target as HTMLInputElement | null
  if (!target) return
  patch({ barColor: String(target.value) }, true)
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
          class="bc-barcode-type"
          :value="String(opts.barcodeType ?? 'code128')"
          @change="onBarcodeType"
        >
          <option value="code128">CODE128</option>
          <option value="ean13">EAN13</option>
          <option value="ean8">EAN8</option>
          <option value="upca">UPC-A</option>
          <option value="interleaved2of5">Interleaved 2 of 5</option>
          <option value="code39">CODE39</option>
          <option value="code93">CODE93</option>
        </select>
      </label>
      <label class="inline">
        <input
          type="checkbox"
          class="bc-show-text"
          :checked="!opts.hideTitle"
          @change="onShowText"
        />
        Show text under barcode
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
        Bar color
        <input
          type="color"
          class="bc-bar-color"
          :value="String(opts.barColor ?? '#000000')"
          @change="onBarColor"
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
