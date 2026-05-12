<script setup lang="ts">
/**
 * HtmlElement.vue — V3 html etype (P17.1).
 *
 * ⚠️ SECURITY — TWO DISTINCT PATHS (TKT-007 fix)
 *
 * V3 inherits V1's "by-design innerHTML" contract for the **explicit** rendering
 * paths (`options.content` literal + `options.formatter` output). On those
 * paths business code owns sanitization — same contract as V1.
 *
 * V3 Sprint 22a Wave 2 ALSO introduced a NEW path that V1 never had:
 * **field-bound data string rendered via v-html.** That path is a brand-new
 * XSS surface — user-controlled template data flowing into innerHTML at
 * runtime, with no sanitization. TKT-007 makes the field-bound path
 * default-safe by escaping (v-text) and requires explicit opt-in via either
 * `options.escape === false` or `options.html === true` to keep V1's
 * by-design HTML behavior.
 *
 *   resolution order               escape default?   override
 *   -------------------------     ---------------   --------
 *   1. options.formatter (any)    NO (v-html, V1)   — (always raw)
 *   2. options.content (string)   NO (v-html, V1)   — (always raw)
 *   3. data[options.field]        YES (v-text)      escape=false / html=true
 *   4. fallback empty             —                 —
 *
 * V1 reference: `render.ts` renderHtmlElement (line 451-477).
 * Integration guide §"安全注意事项 #1" + `.claude/rules/security.md §1`.
 *
 * TKT-006: `options.formatter` now accepts BOTH a function AND a string of
 * JS source (V1 parity via `compileFormatter`).
 *
 * TKT-355 (html-side): when the formatter returns `null`/`undefined`, hide
 * the element wrapper entirely (`mode: 'hidden'`). V1 line 1547-1551
 * documents the formatter return-null hide contract for image/html. V3
 * applies it symmetrically — the parent ElementWrapper still occupies its
 * layout slot but the inner content div is removed so the element is
 * visually invisible AND has no DOM payload to print.
 */
import { computed } from 'vue'
import { useCanvasStore } from '@hiprint-v3/stores'
import { compileFormatter } from '@hiprint-v3/internal'
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

/**
 * Render-resolution outcome.
 *  - `mode: 'html'`   — value is rendered via v-html (V1 by-design path).
 *  - `mode: 'text'`   — value is rendered via v-text (XSS-safe; field-binding
 *                       default, TKT-007).
 *  - `mode: 'hidden'` — formatter returned null/undefined; suppress inner
 *                       render (TKT-355). Wrapper still occupies the layout
 *                       box so neighbouring elements do not jump.
 */
type Resolved = { mode: 'html' | 'text' | 'hidden'; value: string }

const resolved = computed<Resolved>(() => {
  const el = element.value
  if (!el) return { mode: 'text', value: '' }
  const opts = el.options as Opts

  // 1) formatter (V1 path — by-design HTML). TKT-006: accept string source.
  const fn = compileFormatter(opts.formatter)
  if (fn) {
    try {
      const out = fn(
        opts.title,
        getElementValue(el, props.data),
        opts,
        props.data
      )
      // TKT-355: explicit null/undefined return → hide.
      if (out == null) return { mode: 'hidden', value: '' }
      return { mode: 'html', value: String(out) }
    } catch (err) {
      console.warn('[hiprint-v3:HtmlElement] formatter threw:', err)
      return { mode: 'html', value: '' }
    }
  }

  // 2) options.content (V1 path — by-design HTML).
  if (typeof opts.content === 'string') {
    return { mode: 'html', value: opts.content }
  }

  // 3) field-bound data string — TKT-007 default-safe path.
  const value = getElementValue(el, props.data)
  if (typeof value === 'string') {
    const optIn = opts.escape === false || opts.html === true
    return { mode: optIn ? 'html' : 'text', value }
  }
  return { mode: 'text', value: '' }
})
</script>

<template>
  <ElementWrapper
    :element-id="elementId"
    :panel-id="panelId"
    :interactive="interactive"
  >
    <!--
      Three rendering paths, decided by the resolution above:
      - `html`:   V1 by-design innerHTML (formatter / content / opt-in field).
                  Business owns input sanitization (Invariant #2).
      - `text`:   XSS-safe field-binding default (TKT-007).
      - `hidden`: TKT-355 formatter returned null → suppress inner content.
      eslint-disable-next-line vue/no-v-html
    -->
    <div
      v-if="resolved.mode === 'html'"
      class="hiprint-printElement-html-content"
      style="height: 100%; width: 100%"
      v-html="resolved.value"
    />
    <div
      v-else-if="resolved.mode === 'text'"
      class="hiprint-printElement-html-content"
      style="height: 100%; width: 100%"
      v-text="resolved.value"
    />
    <!-- TKT-355: mode='hidden' — no inner content, layout box preserved. -->
    <div
      v-else
      class="hiprint-printElement-html-content hiprint-printElement-html-hidden"
      style="height: 100%; width: 100%; visibility: hidden"
      aria-hidden="true"
    />
  </ElementWrapper>
</template>
