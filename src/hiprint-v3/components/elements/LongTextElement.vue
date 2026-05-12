<script setup lang="ts">
/**
 * LongTextElement.vue — V3 longText etype (P17.1).
 *
 * Renders a (potentially long) text block with first-line indent + CSS
 * `white-space: pre-wrap` so text wraps and overflows visibly. Full V1
 * pagination (BinarySearch + offsetHeight measurement) is intentionally
 * deferred to a later pass — see {@link ../../print/render.ts} block comment.
 *
 * V2 reference: `render.ts` renderLongTextElement (line 279-317).
 *
 * Safety:
 *  - Text interpolation `{{ }}` is Vue's XSS-safe path (Invariant #1).
 *  - Formatter output is rendered via `v-html` (Invariant #2: by-design).
 *  - longTextIndent is clamped to non-negative via safeNumber (R3 C1 fix).
 */
import { computed } from 'vue'
import { useCanvasStore } from '@hiprint-v3/stores'
import { coerceText, compileFormatter, safeNumber } from '@hiprint-v3/internal'
import ElementWrapper from './ElementWrapper.vue'
import { computeDisplayText, getElementValue, type Opts } from './_helpers'

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

const element = computed(() => {
  for (const panel of canvas.panels) {
    const el = panel.printElements.find((e) => e.id === props.elementId)
    if (el) return el
  }
  return null
})

const displayText = computed(() => computeDisplayText(element.value, props.data))

/** First-line indent in pt (non-negative). 0 = no indent. */
const indentPt = computed<number>(() => {
  const el = element.value
  if (!el) return 0
  return safeNumber((el.options as Opts).longTextIndent, { min: 0 })
})

const formatterHtml = computed<string | null>(() => {
  const el = element.value
  if (!el) return null
  const opts = el.options as Opts
  // TKT-006: accept string-source formatter as well (V1 parity).
  const fn = compileFormatter(opts.formatter)
  if (!fn) return null
  try {
    const out = fn(
      coerceText(opts.title),
      getElementValue(el, props.data),
      opts,
      props.data
    )
    return out == null ? '' : String(out)
  } catch (err) {
    console.warn('[hiprint-v3:LongTextElement] formatter threw:', err)
    return ''
  }
})
</script>

<template>
  <ElementWrapper
    :element-id="elementId"
    :panel-id="panelId"
    :interactive="interactive"
  >
    <div
      class="hiprint-printElement-longText-content"
      style="height: 100%; width: 100%; white-space: pre-wrap; overflow: hidden;"
    >
      <span
        v-if="indentPt > 0"
        class="long-text-indent"
        :style="{ marginLeft: indentPt + 'pt' }"
      />
      <!-- eslint-disable-next-line vue/no-v-html -->
      <span v-if="formatterHtml !== null" v-html="formatterHtml" />
      <template v-else>{{ displayText }}</template>
    </div>
  </ElementWrapper>
</template>
