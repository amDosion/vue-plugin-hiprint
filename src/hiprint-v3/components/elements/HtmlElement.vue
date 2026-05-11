<script setup lang="ts">
/**
 * HtmlElement.vue — V3 html etype (P17.1).
 *
 * ⚠️ SECURITY — BY DESIGN INNERHTML (Invariant #2 from ADR-0011).
 *
 * The `html` etype is the ONE etype where rendering user-controlled HTML is
 * intentional. Business consumers use it for stamps/signatures/marketing
 * snippets that include arbitrary markup.
 *
 * **Business code is responsible for sanitizing input before it reaches this
 * component.** Hiprint does not run an HTML sanitizer. See:
 *  - docs/integration-guide.md ⚠️ 安全注意事项 #1
 *  - .claude/rules/security.md §1
 *  - V2 src/hiprint-v2/renderers/html.js (same contract)
 *
 * V2 reference: `render.ts` renderHtmlElement (line 451-477).
 *
 * Resolution order for the rendered HTML string:
 *   1. options.formatter(...) → string (preferred extension point).
 *   2. options.content — design-time literal.
 *   3. Bound business data via field — runtime value.
 *   4. Empty string (renders nothing).
 */
import { computed } from 'vue'
import { useCanvasStore } from '@hiprint-v3/stores'
import ElementWrapper from './ElementWrapper.vue'
import { getElementValue, type Opts } from './_helpers'

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

const html = computed<string>(() => {
  const el = element.value
  if (!el) return ''
  const opts = el.options as Opts
  const formatter = opts.formatter
  if (typeof formatter === 'function') {
    try {
      const out = (formatter as (...a: unknown[]) => unknown)(
        opts.title,
        getElementValue(el, props.data),
        opts,
        props.data
      )
      return out == null ? '' : String(out)
    } catch (err) {
      console.warn('[hiprint-v3:HtmlElement] formatter threw:', err)
      return ''
    }
  }
  if (typeof opts.content === 'string') return opts.content
  const value = getElementValue(el, props.data)
  if (typeof value === 'string') return value
  return ''
})
</script>

<template>
  <ElementWrapper
    :element-id="elementId"
    :panel-id="panelId"
    :interactive="interactive"
  >
    <!--
      eslint-disable-next-line vue/no-v-html
      BY DESIGN: see file header. Business owns input sanitization.
    -->
    <div
      class="hiprint-printElement-html-content"
      style="height: 100%; width: 100%"
      v-html="html"
    />
  </ElementWrapper>
</template>
