<script setup lang="ts">
/**
 * QrcodePropertyPanel.vue — V3 property editor for `qrcode` etype (PP-008).
 *
 * Fields:
 *  - `errorCorrectionLevel` — Reed-Solomon level (L / M / Q / H). Higher = more
 *                             damage tolerance but larger pattern density.
 *  - `padding`              — quiet-zone padding in pt around the QR matrix.
 *  - `color`                — foreground (module / dark) color.
 *  - `backgroundColor`      — background (quiet-zone) color.
 *
 * All edits go through `canvas.updateElement(activePanelId, element.id,
 * { options: patch })`. History snapshots fire on commit boundaries.
 *
 * Wave 2 integration — dispatched from HiprintPropertyPanel.vue when
 * `elementType === 'qrcode'`.
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

function onErrorCorrectionLevel(ev: Event): void {
  const target = ev.target as HTMLSelectElement | null
  if (!target) return
  patch({ errorCorrectionLevel: String(target.value) }, true)
}

function onPadding(ev: Event): void {
  const target = ev.target as HTMLInputElement | null
  if (!target) return
  patch({ padding: num(target.value, 0) })
}

function onColor(ev: Event): void {
  const target = ev.target as HTMLInputElement | null
  if (!target) return
  patch({ color: String(target.value) }, true)
}

function onBackgroundColor(ev: Event): void {
  const target = ev.target as HTMLInputElement | null
  if (!target) return
  patch({ backgroundColor: String(target.value) }, true)
}

function commit(): void {
  history.pushSnapshot()
}
</script>

<template>
  <div class="hiprint-qrcode-property-panel" aria-label="QR code properties">
    <fieldset class="hiprint-property-fieldset">
      <legend>QR Code</legend>
      <label>
        Error correction
        <select
          class="qr-ec-level"
          :value="String(opts.errorCorrectionLevel ?? 'M')"
          @change="onErrorCorrectionLevel"
        >
          <option value="L">L — Low (7%)</option>
          <option value="M">M — Medium (15%)</option>
          <option value="Q">Q — Quartile (25%)</option>
          <option value="H">H — High (30%)</option>
        </select>
      </label>
      <label>
        Padding (pt)
        <input
          type="number"
          min="0"
          class="qr-padding"
          :value="num(opts.padding, 0)"
          @input="onPadding"
          @change="commit"
        />
      </label>
      <label>
        Foreground color
        <input
          type="color"
          class="qr-color"
          :value="String(opts.color ?? '#000000')"
          @change="onColor"
        />
      </label>
      <label>
        Background color
        <input
          type="color"
          class="qr-background-color"
          :value="String(opts.backgroundColor ?? '#ffffff')"
          @change="onBackgroundColor"
        />
      </label>
    </fieldset>
  </div>
</template>

<style scoped>
.hiprint-qrcode-property-panel {
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
