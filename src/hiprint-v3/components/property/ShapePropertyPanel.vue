<script setup lang="ts">
/**
 * ShapePropertyPanel.vue — V3 property editor for shape etypes (PP-010):
 *   hline / vline / rect / oval.
 *
 * Conditional rendering (driven by `element.printElementType.type`):
 *  - Always:    strokeWidth, strokeColor, strokeStyle.
 *  - rect/oval: + fillColor.
 *  - rect:      + borderRadius.
 *
 * `strokeStyle` mirrors CSS border-style (solid/dashed/dotted) so the
 * renderer can map straight through. `strokeWidth` is in pt.
 *
 * All edits go through `canvas.updateElement(activePanelId, element.id,
 * { options: patch })`. History snapshots fire on commit boundaries.
 *
 * Wave 2 integration — dispatched from HiprintPropertyPanel.vue when
 * `elementType` is one of hline/vline/rect/oval.
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

const shapeType = computed<string>(() => props.element.printElementType?.type ?? '')

/** rect + oval both render as a filled area; lines (hline/vline) do not. */
const showFill = computed<boolean>(() =>
  ['rect', 'oval'].includes(shapeType.value)
)

/** Only rectangles get a corner-radius — ovals are already curved, lines have
 *  no corners. */
const showBorderRadius = computed<boolean>(() => shapeType.value === 'rect')

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

function onStrokeWidth(ev: Event): void {
  const target = ev.target as HTMLInputElement | null
  if (!target) return
  patch({ strokeWidth: num(target.value, 1) })
}

function onStrokeColor(ev: Event): void {
  const target = ev.target as HTMLInputElement | null
  if (!target) return
  patch({ strokeColor: String(target.value) }, true)
}

function onStrokeStyle(ev: Event): void {
  const target = ev.target as HTMLSelectElement | null
  if (!target) return
  patch({ strokeStyle: String(target.value) }, true)
}

function onFillColor(ev: Event): void {
  const target = ev.target as HTMLInputElement | null
  if (!target) return
  patch({ fillColor: String(target.value) }, true)
}

function onBorderRadius(ev: Event): void {
  const target = ev.target as HTMLInputElement | null
  if (!target) return
  patch({ borderRadius: num(target.value, 0) })
}

function commit(): void {
  history.pushSnapshot()
}
</script>

<template>
  <div class="hiprint-shape-property-panel" aria-label="Shape properties">
    <fieldset class="hiprint-property-fieldset">
      <legend>Stroke</legend>
      <label>
        Width (pt)
        <input
          type="number"
          min="0"
          max="20"
          class="shape-stroke-width"
          :value="num(opts.strokeWidth, 1)"
          @input="onStrokeWidth"
          @change="commit"
        />
      </label>
      <label>
        Color
        <input
          type="color"
          class="shape-stroke-color"
          :value="String(opts.strokeColor ?? '#000000')"
          @change="onStrokeColor"
        />
      </label>
      <label>
        Style
        <select
          class="shape-stroke-style"
          :value="String(opts.strokeStyle ?? 'solid')"
          @change="onStrokeStyle"
        >
          <option value="solid">solid</option>
          <option value="dashed">dashed</option>
          <option value="dotted">dotted</option>
        </select>
      </label>
    </fieldset>

    <fieldset
      v-if="showFill"
      class="hiprint-property-fieldset shape-fill-fieldset"
    >
      <legend>Fill</legend>
      <label>
        Color
        <input
          type="color"
          class="shape-fill-color"
          :value="String(opts.fillColor ?? '#ffffff')"
          @change="onFillColor"
        />
      </label>
      <label v-if="showBorderRadius">
        Border radius (pt)
        <input
          type="number"
          min="0"
          class="shape-border-radius"
          :value="num(opts.borderRadius, 0)"
          @input="onBorderRadius"
          @change="commit"
        />
      </label>
    </fieldset>
  </div>
</template>

<style scoped>
.hiprint-shape-property-panel {
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
