<script setup lang="ts">
/**
 * OvalElement.vue — V3 oval/ellipse etype (P17.2).
 *
 * Pure CSS shape — `border` + `border-radius: 50%` on a full-size div.
 * Mirrors render.ts renderShapeElement for type === 'oval'.
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
  const style: Record<string, string> = {
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    border: width + 'pt solid ' + color,
    borderRadius: '50%',
  }
  // TKT-001 fix — read backgroundColor so the panel's fill-color edit lands.
  if (typeof opts.backgroundColor === 'string') {
    style.backgroundColor = opts.backgroundColor
  }
  return style
})
</script>

<template>
  <ElementWrapper
    :element-id="elementId"
    :panel-id="panelId"
    :interactive="interactive"
  >
    <div class="hiprint-printElement-oval-content" :style="shapeStyle" />
  </ElementWrapper>
</template>
