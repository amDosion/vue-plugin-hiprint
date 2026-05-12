<script setup lang="ts">
/**
 * BarcodePropertyPanel.vue — V3 property editor for `barcode` etype (PP-007).
 *
 * Sprint 22a-r TKT-002 rollback: panel keys realigned to V3-renderer (=V1 Path B
 * bwip-js naming). Previous shipping shape wrote `format`/`lineColor`/
 * `displayValue`/`padding`/`color`/`backgroundColor` — none of which the renderer
 * read. See `docs/V3-PARITY-MATRIX/04-barcode-qrcode.md` VIOLATION 2 + 4.
 *
 * Sprint 22g wave 3 (Stream GL) expansion:
 *   - TKT-367: full 9-field panel parity with V1 §D.2 Path B panel:
 *     `barcodeType` (84-value cascader), `barWidth`, `barAutoWidth`,
 *     `barColor`, `hideTitle`, `fontSize`, `textAlign`, `barTextMode`,
 *     `backgroundColor`.
 *   - The `barcodeType` <select> uses <optgroup> labels which mirror V1's
 *     11 groups (商品条码 / 条形码 / 物流 / GS1 DataBar / 邮政 / 医疗 / 不
 *     常用 / GS1 复合 / 附加 / 实验). Browsers render optgroup-labelled
 *     <select> elements with the cascader-style label-then-option layout V1
 *     used via its custom cascader component. See V1 inventory §B.2.1.
 *
 * Fields (renderer key contract):
 *  - `barcodeType` — bwip-js symbology id (lowercase). Renderer reads at
 *    `BarcodeElement.vue` (Path B) and `path-a-mapping.ts` (Path A fallback).
 *  - `barWidth` / `barAutoWidth` — bwip-js scale + auto-fit. V1 §J.23 quirk:
 *    `barAutoWidth` is historically a STRING "true"/"false"; V3 widens to
 *    boolean via `isTrue()` while still writing the string for round-trip.
 *  - `hideTitle` — boolean. UI is "Show text under barcode" (inverted —
 *    checked = hideTitle false). Renderer reads `hideTitle` directly.
 *  - `barTextMode` — V1 enum `''|'text'|'svg'`. When 'text' the displayValue
 *    is rendered as a separate <div class="hibarcode_displayValue"> below
 *    the SVG (V1 line 10068/10080).
 *  - `fontSize` — text size in pt (only applied when hideTitle=false).
 *  - `textAlign` — alignment of the optional title row.
 *  - `barColor` — stroke color for bars.
 *  - `backgroundColor` — wrapper background; also forwarded to bwip-js as
 *    `backgroundcolor` via TKT-364 collectBwipPassthrough.
 *
 * Multi-select keeps the generic editor (see `HiprintPropertyPanel.vue`).
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

function onBackgroundColor(ev: Event): void {
  const target = ev.target as HTMLInputElement | null
  if (!target) return
  patch({ backgroundColor: String(target.value) }, true)
}

function onBarWidth(ev: Event): void {
  const target = ev.target as HTMLSelectElement | null
  if (!target) return
  patch({ barWidth: num(target.value, 1) }, true)
}

function onBarAutoWidth(ev: Event): void {
  // V1 §J.23 — historically a STRING enum. We accept both forms via isTrue()
  // in the renderer; round-trip safety: write the canonical V1 string form
  // unless the user explicitly cleared the field.
  const target = ev.target as HTMLSelectElement | null
  if (!target) return
  const v = String(target.value)
  if (v === '') patch({ barAutoWidth: '' }, true)
  else patch({ barAutoWidth: v === 'true' ? 'true' : 'false' }, true)
}

function onBarTextMode(ev: Event): void {
  const target = ev.target as HTMLSelectElement | null
  if (!target) return
  patch({ barTextMode: String(target.value) }, true)
}

function onTextAlign(ev: Event): void {
  const target = ev.target as HTMLSelectElement | null
  if (!target) return
  patch({ textAlign: String(target.value) }, true)
}

function commit(): void {
  history.pushSnapshot()
}

/** Helper for select value coercion (preserves '' for "default" option). */
function strOrDefault(v: unknown, fallback: string): string {
  return typeof v === 'string' && v !== '' ? v : fallback
}
</script>

<template>
  <div class="hiprint-barcode-property-panel" aria-label="Barcode properties">
    <fieldset class="hiprint-property-fieldset">
      <legend>Barcode</legend>

      <!--
        TKT-367: cascader-style barcodeType selector with V1's 11 optgroups.
        <optgroup label> renders as italic non-selectable header — the
        browser-native equivalent of V1's cascader UI.
      -->
      <label>
        Format
        <select
          class="bc-barcode-type"
          :value="String(opts.barcodeType ?? 'code128')"
          @change="onBarcodeType"
        >
          <optgroup label="默认 / 条形码">
            <!-- Combined to avoid duplicate code128 option entries (happy-dom
                 select-binding picks first matching value; we keep one canonical
                 code128 to match the renderer default). -->
            <option value="code128">CODE 128 (默认)</option>
            <option value="code39">CODE 39</option>
            <option value="code39ext">CODE 39 Ext</option>
            <option value="code93">CODE 93</option>
            <option value="code93ext">CODE 93 Ext</option>
            <option value="interleaved2of5">Interleaved 2 of 5</option>
          </optgroup>
          <optgroup label="商品条码">
            <option value="ean13">EAN-13</option>
            <option value="ean8">EAN-8</option>
            <option value="upca">UPC-A</option>
            <option value="upce">UPC-E</option>
            <option value="isbn">ISBN</option>
            <option value="ismn">ISMN</option>
            <option value="issn">ISSN</option>
          </optgroup>
          <optgroup label="物流">
            <option value="ean14">EAN-14</option>
            <option value="gs1-128">GS1-128</option>
            <option value="itf14">ITF-14</option>
            <option value="sscc18">SSCC-18</option>
          </optgroup>
          <optgroup label="GS1 DataBar">
            <option value="databarexpanded">DataBar Expanded</option>
            <option value="databarexpandedstacked">DataBar Expanded Stacked</option>
            <option value="databarlimited">DataBar Limited</option>
            <option value="databaromni">DataBar Omni</option>
            <option value="databarstacked">DataBar Stacked</option>
            <option value="databarstackedomni">DataBar Stacked Omni</option>
            <option value="databartruncated">DataBar Truncated</option>
            <option value="gs1northamericancoupon">GS1 NA Coupon</option>
          </optgroup>
          <optgroup label="邮政和快递编码">
            <option value="auspost">AusPost</option>
            <option value="identcode">Identcode</option>
            <option value="leitcode">Leitcode</option>
            <option value="japanpost">Japan Post</option>
            <option value="kix">KIX</option>
            <option value="royalmail">Royal Mail</option>
            <option value="mailmark">Mailmark</option>
            <option value="maxicode">MaxiCode</option>
            <option value="onecode">OneCode</option>
            <option value="planet">PLANET</option>
            <option value="postnet">POSTNET</option>
          </optgroup>
          <optgroup label="医疗产品编码">
            <option value="code32">CODE 32</option>
            <option value="pharmacode">Pharmacode</option>
            <option value="pzn">PZN</option>
            <option value="pharmacode2">Pharmacode 2</option>
            <option value="hibcazteccode">HIBC Aztec</option>
            <option value="hibccodablockf">HIBC CodablockF</option>
            <option value="hibccode128">HIBC CODE 128</option>
            <option value="hibccode39">HIBC CODE 39</option>
          </optgroup>
          <optgroup label="不常用编码">
            <option value="code11">CODE 11</option>
            <option value="code16k">CODE 16K</option>
            <option value="code2of5">2 of 5</option>
            <option value="code49">CODE 49</option>
            <option value="codeone">Code One</option>
            <option value="rationalizedcodabar">Codabar</option>
            <option value="codablockf">CodablockF</option>
            <option value="bc412">BC412</option>
            <option value="coop2of5">COOP 2 of 5</option>
            <option value="channelcode">Channel Code</option>
            <option value="datalogic2of5">Datalogic 2 of 5</option>
            <option value="dotcode">DotCode</option>
            <option value="iata2of5">IATA 2 of 5</option>
            <option value="msi">MSI</option>
            <option value="matrix2of5">Matrix 2 of 5</option>
            <option value="plessey">Plessey</option>
            <option value="posicode">PosiCode</option>
            <option value="telepen">Telepen</option>
            <option value="telepennumeric">Telepen Numeric</option>
          </optgroup>
          <optgroup label="GS1 复合编码">
            <option value="ean13composite">EAN-13 Composite</option>
            <option value="ean8composite">EAN-8 Composite</option>
            <option value="upcacomposite">UPC-A Composite</option>
            <option value="upcecomposite">UPC-E Composite</option>
            <option value="databarexpandedstackedcomposite">DataBar Expanded Stacked Composite</option>
            <option value="databarexpandedcomposite">DataBar Expanded Composite</option>
            <option value="databarlimitedcomposite">DataBar Limited Composite</option>
            <option value="databaromnicomposite">DataBar Omni Composite</option>
            <option value="databarstackedcomposite">DataBar Stacked Composite</option>
            <option value="databarstackedomnicomposite">DataBar Stacked Omni Composite</option>
            <option value="databartruncatedcomposite">DataBar Truncated Composite</option>
            <option value="gs1-128composite">GS1-128 Composite</option>
          </optgroup>
          <optgroup label="附加组件">
            <option value="ean2">EAN-2</option>
            <option value="ean5">EAN-5</option>
            <option value="gs1-cc">GS1-CC</option>
          </optgroup>
          <optgroup label="实验编码">
            <option value="raw">Raw</option>
            <option value="daft">DAFT</option>
            <option value="flattermarken">Flattermarken</option>
          </optgroup>
        </select>
      </label>

      <label>
        Bar width (scale)
        <select
          class="bc-bar-width"
          :value="String(num(opts.barWidth, 1))"
          @change="onBarWidth"
        >
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
        </select>
      </label>
      <label>
        Auto width
        <select
          class="bc-bar-auto-width"
          :value="strOrDefault(opts.barAutoWidth, 'true')"
          @change="onBarAutoWidth"
        >
          <option value="">默认</option>
          <option value="true">自动</option>
          <option value="false">不自动</option>
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
        Text mode
        <select
          class="bc-bar-text-mode"
          :value="strOrDefault(opts.barTextMode, '')"
          @change="onBarTextMode"
        >
          <option value="">默认</option>
          <option value="text">单独文本</option>
          <option value="svg">SVG 内部</option>
        </select>
      </label>
      <label>
        Text align
        <select
          class="bc-text-align"
          :value="strOrDefault(opts.textAlign, 'center')"
          @change="onTextAlign"
        >
          <option value="left">left</option>
          <option value="center">center</option>
          <option value="right">right</option>
        </select>
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
      <label>
        Background color
        <input
          type="color"
          class="bc-background-color"
          :value="String(opts.backgroundColor ?? '#ffffff')"
          @change="onBackgroundColor"
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
