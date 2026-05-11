<script setup lang="ts">
/**
 * VlineElement.vue — V3 vline (vertical line) etype (P17.2).
 *
 * Pure CSS shape — `border-left` on a full-height div.
 * Mirrors render.ts renderShapeElement for type === 'vline'.
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
    borderLeft: width + 'pt solid ' + color,
  }
})
</script>

<template>
  <ElementWrapper
    :element-id="elementId"
    :panel-id="panelId"
    :interactive="interactive"
  >
    <div class="hiprint-printElement-vline-content" :style="shapeStyle" />
  </ElementWrapper>
</template>
