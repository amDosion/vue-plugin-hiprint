<script setup lang="ts">
/**
 * ImageElement.vue — V3 image etype (P17.1).
 *
 * Renders an `<img>` with src resolved from:
 *   1. Bound business data via `options.field` (or printElementType.field).
 *   2. `options.src` design-time fallback.
 *
 * V2 reference: `render.ts` renderImageElement (line 247-276).
 *
 * Safety:
 *   - Src is bound via `:src` (Vue auto-escapes attribute values; no innerHTML).
 *   - `@error` swallows broken images so a single bad URL doesn't break the
 *     canvas. We render a transparent 1×1 fallback so layout doesn't collapse.
 */
import { computed, ref } from 'vue'
import { useCanvasStore } from '@hiprint-v3/stores'
import { safeNumber } from '@hiprint-v3/internal'
import ElementWrapper from './ElementWrapper.vue'
import { getElementValue, type Opts } from './_helpers'

/** 1×1 transparent PNG. Used when src fails to load. */
const FALLBACK_SRC =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII='

const props = withDefaults(
  defineProps<{
    elementId: string
    panelId: string
    data?: Record<string, unknown>
    interactive?: boolean
  }>(),
  { interactive: true }
)

const canvas = useCanvasStore()
const loadError = ref(false)

const element = computed(() => {
  for (const panel of canvas.panels) {
    const el = panel.printElements.find((e) => e.id === props.elementId)
    if (el) return el
  }
  return null
})

const resolvedSrc = computed<string>(() => {
  const el = element.value
  if (!el) return FALLBACK_SRC
  const fieldValue = getElementValue(el, props.data)
  const opts = el.options as Opts
  const src =
    (typeof fieldValue === 'string' && fieldValue) ||
    (typeof opts.src === 'string' && opts.src) ||
    ''
  if (!src || loadError.value) return FALLBACK_SRC
  return src
})

const imgStyle = computed(() => {
  const el = element.value
  if (!el) return {}
  const opts = el.options as Opts
  const style: Record<string, string> = {
    width: '100%',
    height: '100%',
  }
  if (typeof opts.fit === 'string') style.objectFit = opts.fit
  if (opts.borderRadius != null) {
    style.borderRadius = safeNumber(opts.borderRadius, { min: 0 }) + 'pt'
  }
  return style
})

function onError(): void {
  loadError.value = true
}
</script>

<template>
  <ElementWrapper
    :element-id="elementId"
    :panel-id="panelId"
    :interactive="interactive"
  >
    <div
      class="hiprint-printElement-image-content"
      style="height: 100%; width: 100%"
    >
      <img :src="resolvedSrc" :style="imgStyle" @error="onError" alt="" />
    </div>
  </ElementWrapper>
</template>
