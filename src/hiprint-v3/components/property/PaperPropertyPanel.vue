<script setup lang="ts">
/**
 * PaperPropertyPanel.vue — V3 paper-level property panel (PP-101 ~ PP-113).
 *
 * Surfaces 13 paper-scoped fields for the currently active panel:
 *  - PP-101 paper-size preset (A3/A4/A5/B4/B5/Custom)
 *  - PP-102 width / height (mm input, stored as pt)
 *  - PP-103 orientation toggle (swap width/height)
 *  - PP-104 margins (top/right/bottom/left in mm, stored as pt under paperMargin)
 *  - PP-105 header height (mm → paperHeader pt)
 *  - PP-106 footer height (mm → paperFooter pt)
 *  - PP-107 background color
 *  - PP-108 watermark (text/opacity/angle)
 *  - PP-109 grid (visible + size in pt) — visibility lives on the canvas store
 *  - PP-110 ruler visibility — also on canvas store
 *  - PP-111 page numbering (show + position)
 *  - PP-112 skip empty pages
 *  - PP-113 panel name
 *
 * All panel-scoped mutations go through canvas.updatePanel(); each commit
 * boundary (blur/change) pushes a history snapshot so undo/redo works at field
 * granularity. Grid/ruler are view-only toggles (no history push). The Panel
 * interface has `[key: string]: unknown`, so extra fields (backgroundColor,
 * paperMargin, watermark, pageNumber, skipEmptyPages) can be set without type
 * widening; we accept `Record<string, unknown>` patches internally.
 *
 * NOTE: This SFC stays self-contained. HiprintPropertyPanel.vue dispatch
 * integration is Wave 2 Stream D's responsibility — do not import here.
 */
import { computed, ref, watch } from 'vue'
import { useCanvasStore, useHistoryStore, type Panel } from '@hiprint-v3/stores'

const canvas = useCanvasStore()
const history = useHistoryStore()
const panel = computed<Panel | null>(() => canvas.activePanel)

// Paper presets in mm. Standardized portrait dims; orientation toggle swaps.
const PAPER_PRESETS: Record<string, [number, number]> = {
  A3: [297, 420],
  A4: [210, 297],
  A5: [148, 210],
  B4: [257, 364],
  B5: [182, 257],
}

// PostScript pt ↔ mm helpers. 1 in = 25.4 mm = 72 pt.
function ptToMm(pt: number | undefined): number {
  return pt == null ? 0 : Math.round((pt / 72) * 25.4)
}
function mmToPt(mm: number): number {
  return (mm / 25.4) * 72
}

// Type-loose patch helper. Panel allows unknown keys via its index signature,
// so we accept Record<string, unknown> here and cast at the store boundary.
function update(patch: Record<string, unknown>): void {
  const p = panel.value
  if (!p) return
  canvas.updatePanel(p.id, patch as Partial<Panel>)
}

function commit(): void {
  history.pushSnapshot()
}

// ----- Local draft state for text inputs (debounce commit to blur/enter) -----

const draftName = ref<string>('')
const draftWatermark = ref<string>('')

watch(
  panel,
  (p) => {
    draftName.value = String(p?.name ?? '')
    const w = p?.['watermark'] as Record<string, unknown> | undefined
    draftWatermark.value = String(w?.text ?? '')
  },
  { immediate: true }
)

// ----- Computed views (panel-derived) -----

const widthMm = computed<number>(() => ptToMm(panel.value?.width))
const heightMm = computed<number>(() => ptToMm(panel.value?.height))
const isLandscape = computed<boolean>(
  () => (panel.value?.width ?? 0) > (panel.value?.height ?? 0)
)
const paperType = computed<string>(() => String(panel.value?.paperType ?? 'A4'))
const margin = computed<Record<string, number>>(
  () =>
    (panel.value?.['paperMargin'] as Record<string, number> | undefined) ?? {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    }
)
const watermark = computed<Record<string, unknown>>(
  () => (panel.value?.['watermark'] as Record<string, unknown> | undefined) ?? {}
)
const pageNumber = computed<Record<string, unknown>>(
  () => (panel.value?.['pageNumber'] as Record<string, unknown> | undefined) ?? {}
)

// ----- Handlers -----

function onPreset(label: string): void {
  if (label === 'Custom') {
    update({ paperType: 'custom' })
    commit()
    return
  }
  const preset = PAPER_PRESETS[label]
  if (!preset) return
  update({
    width: mmToPt(preset[0]),
    height: mmToPt(preset[1]),
    paperType: label,
  })
  commit()
}

function onWidthMm(ev: Event): void {
  const v = Number((ev.target as HTMLInputElement).value || 0)
  update({ width: mmToPt(v) })
}

function onHeightMm(ev: Event): void {
  const v = Number((ev.target as HTMLInputElement).value || 0)
  update({ height: mmToPt(v) })
}

function onOrientation(ori: 'portrait' | 'landscape'): void {
  const p = panel.value
  if (!p) return
  const cur: 'portrait' | 'landscape' = p.width > p.height ? 'landscape' : 'portrait'
  if (cur === ori) return
  update({ width: p.height, height: p.width })
  commit()
}

function onMargin(side: 'top' | 'right' | 'bottom' | 'left', ev: Event): void {
  const v = Number((ev.target as HTMLInputElement).value || 0)
  update({ paperMargin: { ...margin.value, [side]: mmToPt(v) } })
}

function onHeader(ev: Event): void {
  const v = Number((ev.target as HTMLInputElement).value || 0)
  update({ paperHeader: mmToPt(v) })
}

function onFooter(ev: Event): void {
  const v = Number((ev.target as HTMLInputElement).value || 0)
  update({ paperFooter: mmToPt(v) })
}

function onBg(ev: Event): void {
  update({ backgroundColor: (ev.target as HTMLInputElement).value })
  commit()
}

function onWatermarkText(): void {
  update({ watermark: { ...watermark.value, text: draftWatermark.value } })
  commit()
}

function onWatermarkOpacity(ev: Event): void {
  const v = Number((ev.target as HTMLInputElement).value)
  update({ watermark: { ...watermark.value, opacity: v } })
}

function onWatermarkAngle(ev: Event): void {
  const v = Number((ev.target as HTMLInputElement).value)
  update({ watermark: { ...watermark.value, angle: v } })
}

function onGridToggle(ev: Event): void {
  canvas.gridVisible = (ev.target as HTMLInputElement).checked
}

function onGridSize(ev: Event): void {
  const v = Number((ev.target as HTMLInputElement).value || 5)
  canvas.setGridSize(v)
}

function onRulerToggle(ev: Event): void {
  canvas.rulerVisible = (ev.target as HTMLInputElement).checked
}

function onPageNumberShow(ev: Event): void {
  update({
    pageNumber: { ...pageNumber.value, show: (ev.target as HTMLInputElement).checked },
  })
  commit()
}

function onPageNumberPosition(ev: Event): void {
  update({
    pageNumber: {
      ...pageNumber.value,
      position: (ev.target as HTMLSelectElement).value,
    },
  })
  commit()
}

function onSkipEmpty(ev: Event): void {
  update({ skipEmptyPages: (ev.target as HTMLInputElement).checked })
  commit()
}

function onNameCommit(): void {
  update({ name: draftName.value })
  commit()
}
</script>

<template>
  <div v-if="panel" class="hiprint-paper-property-panel" aria-label="Paper properties">
    <fieldset class="hiprint-property-fieldset">
      <legend>Paper</legend>
      <label>
        Preset
        <select
          :value="paperType"
          @change="onPreset(($event.target as HTMLSelectElement).value)"
        >
          <option>A3</option>
          <option>A4</option>
          <option>A5</option>
          <option>B4</option>
          <option>B5</option>
          <option value="Custom">Custom</option>
        </select>
      </label>
      <div class="hiprint-property-grid-2">
        <label>
          Width (mm)
          <input
            type="number"
            min="10"
            :value="widthMm"
            @input="onWidthMm"
            @change="commit"
          />
        </label>
        <label>
          Height (mm)
          <input
            type="number"
            min="10"
            :value="heightMm"
            @input="onHeightMm"
            @change="commit"
          />
        </label>
      </div>
      <div class="hiprint-property-row" role="group" aria-label="Orientation">
        <button
          type="button"
          class="hiprint-property-toggle"
          :class="{ 'is-active': !isLandscape }"
          @click="onOrientation('portrait')"
        >
          Portrait
        </button>
        <button
          type="button"
          class="hiprint-property-toggle"
          :class="{ 'is-active': isLandscape }"
          @click="onOrientation('landscape')"
        >
          Landscape
        </button>
      </div>
    </fieldset>

    <fieldset class="hiprint-property-fieldset">
      <legend>Margins (mm)</legend>
      <div class="hiprint-property-grid-2">
        <label>
          Top
          <input
            type="number"
            min="0"
            :value="ptToMm(margin.top)"
            @input="onMargin('top', $event)"
            @change="commit"
          />
        </label>
        <label>
          Right
          <input
            type="number"
            min="0"
            :value="ptToMm(margin.right)"
            @input="onMargin('right', $event)"
            @change="commit"
          />
        </label>
        <label>
          Bottom
          <input
            type="number"
            min="0"
            :value="ptToMm(margin.bottom)"
            @input="onMargin('bottom', $event)"
            @change="commit"
          />
        </label>
        <label>
          Left
          <input
            type="number"
            min="0"
            :value="ptToMm(margin.left)"
            @input="onMargin('left', $event)"
            @change="commit"
          />
        </label>
      </div>
    </fieldset>

    <fieldset class="hiprint-property-fieldset">
      <legend>Header / Footer</legend>
      <label>
        Header height (mm)
        <input
          type="number"
          min="0"
          :value="ptToMm(panel.paperHeader)"
          @input="onHeader"
          @change="commit"
        />
      </label>
      <label>
        Footer height (mm)
        <input
          type="number"
          min="0"
          :value="ptToMm(panel.paperFooter)"
          @input="onFooter"
          @change="commit"
        />
      </label>
    </fieldset>

    <fieldset class="hiprint-property-fieldset">
      <legend>Background</legend>
      <label>
        Color
        <input
          type="color"
          :value="String(panel.backgroundColor ?? '#ffffff')"
          @change="onBg"
        />
      </label>
    </fieldset>

    <fieldset class="hiprint-property-fieldset">
      <legend>Watermark</legend>
      <label>
        Text
        <input
          type="text"
          v-model="draftWatermark"
          @blur="onWatermarkText"
          @keydown.enter="onWatermarkText"
        />
      </label>
      <label>
        Opacity {{ Math.round(Number(watermark.opacity ?? 0.2) * 100) }}%
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          :value="watermark.opacity ?? 0.2"
          @input="onWatermarkOpacity"
          @change="commit"
        />
      </label>
      <label>
        Angle {{ watermark.angle ?? -30 }}°
        <input
          type="range"
          min="-90"
          max="90"
          step="1"
          :value="watermark.angle ?? -30"
          @input="onWatermarkAngle"
          @change="commit"
        />
      </label>
    </fieldset>

    <fieldset class="hiprint-property-fieldset">
      <legend>Grid / Ruler</legend>
      <label>
        <input type="checkbox" :checked="canvas.gridVisible" @change="onGridToggle" />
        Show grid
      </label>
      <label>
        Grid size (pt)
        <input
          type="number"
          min="1"
          max="100"
          :value="canvas.gridSize"
          @input="onGridSize"
        />
      </label>
      <label>
        <input type="checkbox" :checked="canvas.rulerVisible" @change="onRulerToggle" />
        Show ruler
      </label>
    </fieldset>

    <fieldset class="hiprint-property-fieldset">
      <legend>Page numbering</legend>
      <label>
        <input
          type="checkbox"
          :checked="!!pageNumber.show"
          @change="onPageNumberShow"
        />
        Show page number
      </label>
      <label>
        Position
        <select
          :value="String(pageNumber.position ?? 'bottom-center')"
          @change="onPageNumberPosition"
        >
          <option value="top-left">Top left</option>
          <option value="top-center">Top center</option>
          <option value="top-right">Top right</option>
          <option value="bottom-left">Bottom left</option>
          <option value="bottom-center">Bottom center</option>
          <option value="bottom-right">Bottom right</option>
        </select>
      </label>
    </fieldset>

    <fieldset class="hiprint-property-fieldset">
      <legend>Other</legend>
      <label>
        <input
          type="checkbox"
          :checked="!!panel.skipEmptyPages"
          @change="onSkipEmpty"
        />
        Skip empty pages
      </label>
      <label>
        Panel name
        <input
          type="text"
          v-model="draftName"
          @blur="onNameCommit"
          @keydown.enter="onNameCommit"
        />
      </label>
    </fieldset>
  </div>
</template>

<style scoped>
.hiprint-paper-property-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: #fafafa;
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
.hiprint-property-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 26px;
  padding: 0 8px;
  background: #fff;
  border: 1px solid #d9d9d9;
  border-radius: 3px;
  cursor: pointer;
  font: inherit;
  color: #333;
}
.hiprint-property-toggle.is-active {
  background: #e6f4ff;
  border-color: #409eff;
  color: #1677ff;
}
</style>
