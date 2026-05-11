<script setup lang="ts">
/**
 * HlineElement.vue — V3 hline (horizontal line) etype (P17.2).
 *
 * A pure CSS shape — no data binding. Drawn as a `border-top` on a full-width
 * inner div. Mirrors render.ts renderShapeElement for type === 'hline'.
 */
import { computed } from 'vue'
import { useCanvasStore } from '@hiprint-v3/stores'
import { safeNumber } from '@hiprint-v3/internal'
import ElementWrapper from './ElementWrapper.vue'
import type { Opts } from './_helpers'

const props = withDefaults(
  defineProps<{
    elementId: string
    panelId: string
    interactive?: boolean
  }>(),
  { interactive: true }
)

const canvas = useCanvasStore()

const element = computed(() => {
  for (const panel of canvas.panels) {
    const el = panel.printElements.find((e) => e.id === props.elementId)
    if (el) return el
  }
  return null
})

const shapeStyle = computed(() => {
  const el = element.value
  const opts = (el?.options as Opts) ?? {}
  const color = typeof opts.borderColor === 'string' ? opts.borderColor : '#000'
  const width = safeNumber(opts.borderWidth, { fallback: 1, min: 0 })
  return {
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    borderTop: width + 'pt solid ' + color,
  }
})
</script>

<template>
  <ElementWrapper
    :element-id="elementId"
    :panel-id="panelId"
    :interactive="interactive"
  >
    <div class="hiprint-printElement-hline-content" :style="shapeStyle" />
  </ElementWrapper>
</template>
