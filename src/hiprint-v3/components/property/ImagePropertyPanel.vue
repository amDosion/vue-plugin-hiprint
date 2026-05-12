<script setup lang="ts">
/**
 * ImagePropertyPanel.vue — V3 property editor for `image` etype (PP-005).
 *
 * Fields:
 *  - `src`             — image source URL (text). For data URLs / https only;
 *                        business-controlled — caller validates upstream.
 *  - `fit`             — CSS object-fit (contain/cover/fill/none/scale-down).
 *                        V1 key name (TKT-004 fix — panel previously wrote
 *                        `objectFit` while ImageElement.vue reads `fit`).
 *  - `borderRadius`    — corner radius in pt.
 *  - `aspectRatioLock` — boolean. When true, editing width also rescales height
 *                        to preserve current aspect ratio (and vice versa).
 *                        The Position fieldset for W/H lives in the fallback
 *                        generic editor (HiprintPropertyPanel.vue). This panel
 *                        owns its own W/H pair so the aspect-lock invariant
 *                        applies — the dispatch path REPLACES the generic
 *                        position fieldset for image elements.
 *
 * All edits go through `canvas.updateElement(activePanelId, element.id,
 * { options: patch })`. `applyElementPatch` shallow-merges options, so passing
 * `{ width: newW, height: newH }` only touches those two keys. History
 * snapshots fire on `commit=true` (blur/change boundaries).
 *
 * Wave 2 integration — dispatched from HiprintPropertyPanel.vue when
 * `elementType === 'image'`. Multi-select keeps the generic editor.
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

function onSrc(ev: Event): void {
  const target = ev.target as HTMLInputElement | null
  if (!target) return
  patch({ src: String(target.value) }, true)
}

function onObjectFit(ev: Event): void {
  const target = ev.target as HTMLSelectElement | null
  if (!target) return
  // TKT-004 — write V1 `fit` key (the one ImageElement.vue + render.ts read).
  patch({ fit: String(target.value) }, true)
}

function onBorderRadius(ev: Event): void {
  const target = ev.target as HTMLInputElement | null
  if (!target) return
  patch({ borderRadius: num(target.value, 0) })
}

function onAspectLock(ev: Event): void {
  const target = ev.target as HTMLInputElement | null
  if (!target) return
  patch({ aspectRatioLock: !!target.checked }, true)
}

function onWidth(ev: Event): void {
  const target = ev.target as HTMLInputElement | null
  if (!target) return
  const newW = num(target.value, num(opts.value.width, 0))
  if (opts.value.aspectRatioLock) {
    const curW = num(opts.value.width, 0)
    const curH = num(opts.value.height, 0)
    if (curW > 0 && curH > 0) {
      const ratio = curH / curW
      patch({ width: newW, height: Math.round(newW * ratio) })
      return
    }
  }
  patch({ width: newW })
}

function onHeight(ev: Event): void {
  const target = ev.target as HTMLInputElement | null
  if (!target) return
  const newH = num(target.value, num(opts.value.height, 0))
  if (opts.value.aspectRatioLock) {
    const curW = num(opts.value.width, 0)
    const curH = num(opts.value.height, 0)
    if (curW > 0 && curH > 0) {
      const ratio = curW / curH
      patch({ height: newH, width: Math.round(newH * ratio) })
      return
    }
  }
  patch({ height: newH })
}

function commit(): void {
  history.pushSnapshot()
}
</script>

<template>
  <div class="hiprint-image-property-panel" aria-label="Image properties">
    <fieldset class="hiprint-property-fieldset">
      <legend>Image</legend>
      <label>
        Source URL
        <input
          type="text"
          class="img-src"
          :value="String(opts.src ?? '')"
          placeholder="https://… or data:image/…"
          @change="onSrc"
        />
      </label>
      <label>
        Object fit
        <select
          class="img-object-fit"
          :value="String(opts.fit ?? 'contain')"
          @change="onObjectFit"
        >
          <option value="contain">contain</option>
          <option value="cover">cover</option>
          <option value="fill">fill</option>
          <option value="none">none</option>
          <option value="scale-down">scale-down</option>
        </select>
      </label>
      <label>
        Border radius (pt)
        <input
          type="number"
          min="0"
          class="img-border-radius"
          :value="num(opts.borderRadius, 0)"
          @input="onBorderRadius"
          @change="commit"
        />
      </label>
      <label class="inline">
        <input
          type="checkbox"
          class="img-aspect-lock"
          :checked="!!opts.aspectRatioLock"
          @change="onAspectLock"
        />
        Lock aspect ratio
      </label>
    </fieldset>

    <fieldset class="hiprint-property-fieldset">
      <legend>Size</legend>
      <div class="hiprint-property-grid-2">
        <label>
          W
          <input
            type="number"
            min="0"
            class="img-width"
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
            class="img-height"
            :value="num(opts.height, 0)"
            @input="onHeight"
            @change="commit"
          />
        </label>
      </div>
    </fieldset>
  </div>
</template>

<style scoped>
.hiprint-image-property-panel {
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
.hiprint-property-fieldset select {
  height: 26px;
  padding: 0 6px;
  border: 1px solid #d9d9d9;
  border-radius: 3px;
  font: inherit;
  color: #333;
  background: #fff;
}
.hiprint-property-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
</style>
