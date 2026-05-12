<script setup lang="ts">
/**
 * QrcodePropertyPanel.vue — V3 property editor for `qrcode` etype (PP-008).
 *
 * Sprint 22a-r TKT-003 rollback: panel keys realigned to V3-renderer keys.
 * Previous shipping shape wrote string `errorCorrectionLevel` + `color` +
 * `backgroundColor` + `padding` — none read by the renderer. See
 * `docs/V3-PARITY-MATRIX/04-barcode-qrcode.md` VIOLATION-3 + VIOLATION-4.
 *
 * Sprint 22g wave 3 (Stream GL) additions:
 *   - TKT-365 (verify): `qrCodeLevel` int contract preserved (renderer uses
 *     `mapQrCodeLevel`).
 *   - TKT-366 (verify): the optional title row above the QR code is rendered
 *     by `QrcodeElement.vue` when `hideTitle !== true`. This panel exposes
 *     `hideTitle` so designers can switch it on/off.
 *   - TKT-367 (sibling): full 19-value `qrcodeType` flat select per V1
 *     §B.3.1 — includes qrcode / microqrcode / azteccode / datamatrix /
 *     pdf417 / hibcpdf417 / hibcdatamatrix / hibcmicropdf417 / hibcqrcode /
 *     swissqrcode / rectangularmicroqrcode / hanxin / ultracode (covers V1
 *     line 3385-3461 select).
 *   - TKT-368: `displayValue` boolean alias for `hideTitle` (inverted
 *     semantics). When the JSON carries `displayValue:true` we treat it as
 *     `hideTitle:false` for V1 JSON round-trip. The panel keeps the
 *     hideTitle checkbox UI but writes BOTH keys.
 *   - TKT-372: `padding` (numeric, pt) quiet-zone control. The renderer
 *     reads it via `_helpers.computePaddingStyle` (applies to the wrapper).
 *   - TKT-364 (sibling): `backgroundColor` is forwarded to bwip-js via
 *     `collectBwipPassthrough` (renderer) AND applied to the wrapper via
 *     `_helpers.computeFontStyle.backgroundColor`.
 *
 * Fields:
 *  - `qrCodeLevel` — INTEGER index into V1-canonical array `['M','L','H','Q']`.
 *  - `qrcodeType` — bwip-js bcid string (default 'qrcode'). 19-value V1 enum.
 *  - `barColor` — foreground (module / dark) color.
 *  - `backgroundColor` — wrapper / bwip-js background color.
 *  - `hideTitle` — boolean. UI is "Show title" (inverted).
 *  - `displayValue` — V1 alias written alongside `hideTitle` for round-trip.
 *  - `padding` — pt-numeric quiet zone.
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

function onQrCodeLevel(ev: Event): void {
  const target = ev.target as HTMLSelectElement | null
  if (!target) return
  // <option value="..."> values are already int strings (1/0/3/2 for L/M/Q/H).
  const next = parseInt(target.value, 10)
  patch({ qrCodeLevel: Number.isFinite(next) ? next : 0 }, true)
}

function onQrcodeType(ev: Event): void {
  const target = ev.target as HTMLSelectElement | null
  if (!target) return
  patch({ qrcodeType: String(target.value) }, true)
}

function onBarColor(ev: Event): void {
  const target = ev.target as HTMLInputElement | null
  if (!target) return
  patch({ barColor: String(target.value) }, true)
}

function onBackgroundColor(ev: Event): void {
  const target = ev.target as HTMLInputElement | null
  if (!target) return
  patch({ backgroundColor: String(target.value) }, true)
}

function onShowTitle(ev: Event): void {
  // UI checkbox is "Show title" — checked means hideTitle=false.
  // TKT-368: also write the V1 `displayValue` alias for round-trip safety.
  const target = ev.target as HTMLInputElement | null
  if (!target) return
  patch(
    {
      hideTitle: !target.checked,
      displayValue: !!target.checked,
    },
    true
  )
}

function onPadding(ev: Event): void {
  const target = ev.target as HTMLInputElement | null
  if (!target) return
  patch({ padding: num(target.value, 0) })
}

function commit(): void {
  history.pushSnapshot()
}

/**
 * TKT-368 — visible state for "Show title" derived from both hideTitle and
 * displayValue. `displayValue:true` wins over `hideTitle:true` (V1 lenient
 * round-trip: prefer the explicit show flag if set).
 */
const showTitleChecked = computed<boolean>(() => {
  if (opts.value.displayValue === true) return true
  if (opts.value.displayValue === false) return false
  return !opts.value.hideTitle
})
</script>

<template>
  <div class="hiprint-qrcode-property-panel" aria-label="QR code properties">
    <fieldset class="hiprint-property-fieldset">
      <legend>QR Code</legend>

      <!--
        TKT-367 (sibling): full 19-value V1 qrcodeType select. V1 §B.3.1 lists
        19 codes — flat (not optgroup-cascader, per V1 line 3385-3461).
      -->
      <label>
        Type
        <select
          class="qr-qrcode-type"
          :value="String(opts.qrcodeType ?? 'qrcode')"
          @change="onQrcodeType"
        >
          <option value="qrcode">QR Code (默认)</option>
          <option value="microqrcode">Micro QR Code</option>
          <option value="swissqrcode">Swiss QR Code</option>
          <option value="rectangularmicroqrcode">Rectangular Micro QR Code</option>
          <option value="azteccode">Aztec Code</option>
          <option value="azteccodecompact">Aztec Code Compact</option>
          <option value="datamatrix">Data Matrix</option>
          <option value="datamatrixrectangular">Data Matrix Rectangular</option>
          <option value="datamatrixrectangularextension">Data Matrix Rect Ext</option>
          <option value="hanxin">Han Xin Code</option>
          <option value="pdf417">PDF417</option>
          <option value="pdf417compact">PDF417 Compact</option>
          <option value="micropdf417">Micro PDF417</option>
          <option value="hibcpdf417">HIBC PDF417</option>
          <option value="hibcdatamatrix">HIBC Data Matrix</option>
          <option value="hibcmicropdf417">HIBC Micro PDF417</option>
          <option value="hibcqrcode">HIBC QR Code</option>
          <option value="hibcaztecode">HIBC Aztec</option>
          <option value="ultracode">Ultracode</option>
        </select>
      </label>

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

      <label class="inline">
        <input
          type="checkbox"
          class="qr-show-title"
          :checked="showTitleChecked"
          @change="onShowTitle"
        />
        Show title (TKT-366)
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
      <label>
        Background color
        <input
          type="color"
          class="qr-background-color"
          :value="String(opts.backgroundColor ?? '#ffffff')"
          @change="onBackgroundColor"
        />
      </label>
      <label>
        Padding (pt) — TKT-372 quiet zone
        <input
          type="number"
          min="0"
          class="qr-padding"
          :value="num(opts.padding, 0)"
          @input="onPadding"
          @change="commit"
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
