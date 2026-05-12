<script setup lang="ts">
/**
 * QrcodePropertyPanel.vue — V3 property editor for `qrcode` etype (PP-008).
 *
 * Sprint 22a-r TKT-003 rollback: panel keys realigned to V3-renderer keys.
 * Previous shipping shape wrote string `errorCorrectionLevel` + `color` +
 * `backgroundColor` + `padding` — none read by the renderer. See
 * `docs/V3-PARITY-MATRIX/04-barcode-qrcode.md` VIOLATION-3 + VIOLATION-4.
 *
 * Fields:
 *  - `qrCodeLevel` — INTEGER index into V1-canonical array `['M','L','H','Q']`.
 *    Renderer reads at `QrcodeElement.vue:92-94`.
 *    UI value mapping (L/M/Q/H → 1/0/3/2) keeps the V1 J.9 quirk that any
 *    change to the array order requires updating the panel.
 *  - `barColor`    — foreground (module / dark) color.
 *    Renderer reads at `QrcodeElement.vue:104`.
 *
 * Dropped fields (renderer did not read; carried zero functional value):
 *  - `color` / `backgroundColor` / `padding` — bwip-js qrcode in V3 does not
 *    expose these. `backgroundColor` defaults to white via bwip-js; quiet zone
 *    is hard-coded. See matrix VIOLATION-4 row evidence.
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

/** Coerce stored qrCodeLevel into the renderer's accepted int range [0,3]. */
function levelIndex(v: unknown): number {
  const n = typeof v === 'number' ? v : parseInt(String(v), 10)
  if (!Number.isFinite(n)) return 0
  if (n < 0 || n > 3) return 0
  return n
}

function patch(p: Record<string, unknown>, commit = false): void {
  const panelId = canvas.activePanelId
  if (!panelId) return
  canvas.updateElement(panelId, props.element.id, { options: p })
  if (commit) history.pushSnapshot()
}

function onQrCodeLevel(ev: Event): void {
  const target = ev.target as HTMLSelectElement | null
  if (!target) return
  // <option value="..."> values are already int strings (1/0/3/2 for L/M/Q/H).
  // Renderer expects an int that indexes into ['M','L','H','Q'].
  const next = parseInt(target.value, 10)
  patch({ qrCodeLevel: Number.isFinite(next) ? next : 0 }, true)
}

function onBarColor(ev: Event): void {
  const target = ev.target as HTMLInputElement | null
  if (!target) return
  patch({ barColor: String(target.value) }, true)
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
          :value="String(levelIndex(opts.qrCodeLevel))"
          @change="onQrCodeLevel"
        >
          <!-- Values are INT indexes into renderer array ['M','L','H','Q']. -->
          <option value="1">L — Low (7%)</option>
          <option value="0">M — Medium (15%)</option>
          <option value="3">Q — Quartile (25%)</option>
          <option value="2">H — High (30%)</option>
        </select>
      </label>
      <label>
        Bar color
        <input
          type="color"
          class="qr-bar-color"
          :value="String(opts.barColor ?? '#000000')"
          @change="onBarColor"
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
