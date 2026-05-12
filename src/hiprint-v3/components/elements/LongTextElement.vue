<script setup lang="ts">
/**
 * LongTextElement.vue — V3 longText etype (P17.1).
 *
 * Renders a (potentially long) text block with first-line indent + CSS
 * `white-space: pre-wrap` so text wraps and overflows visibly. In the
 * designer single-page preview view, this component shows the full text
 * with overflow clipped — V1's designer also rendered only the first page.
 *
 * TKT-026: Full V1 binary-search pagination is now available via the
 * imperative `paginateLongText` API in @hiprint-v3/internal — this
 * component exposes a `getPaginatedPages(maxHeightPt, perPageHeightPt)`
 * method via defineExpose for integration with preview/print pipelines
 * that need multi-page rendering. Designer preview continues to show
 * single-page (no pagination).
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
import {
  coerceText,
  compileFormatter,
  createDomMeasure,
  paginateLongText,
  safeNumber,
} from '@hiprint-v3/internal'
import ElementWrapper from './ElementWrapper.vue'
// TKT-024: getFormattedValue applies dataType + format conversion before the
// formatter chain. computeDisplayText already routes through it for the
// default (no-formatter) path.
// TKT-340: computeTextWrapClasses for textContentWrap CSS class injection.
// TKT-341: V1 `lHeight` (minimum element height) — when render output is
// shorter than lHeight, the wrapper stretches to lHeight so consecutive
// longText blocks keep aligned baselines (V1 quirk J.9).
import {
  computeDisplayText,
  computeTextWrapClasses,
  getFormattedValue,
  type Opts,
} from './_helpers'

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

/**
 * TKT-341 (Sprint 22g wave 3) — V1 `lHeight` minimum-line-height.
 *
 * V1 ref: bundle.js 9818-9892 quirk J.9. When a longText element has
 * `lHeight: N` set and the rendered content is shorter than N pt, V1
 * stretched the wrapper to N pt so subsequent longText elements stayed
 * baseline-aligned. TextPropertyPanel writes `lHeight` directly;
 * LongTextPropertyPanel also accepts `minHeight` as a panel-friendly alias
 * (see LongTextPropertyPanel.vue:121). V1 canonical key wins on collision.
 *
 * Returns 0 when no lHeight set, when value < 0, or when not a number.
 */
const minHeightPt = computed<number>(() => {
  const el = element.value
  if (!el) return 0
  const opts = el.options as Opts
  const raw = opts.lHeight ?? opts.minHeight
  if (raw == null) return 0
  return safeNumber(raw, { min: 0 })
})

/**
 * TKT-340 (Sprint 22g wave 3) — CSS classes for textContentWrap on inner
 * content div. Same machinery as TextElement. For longText, wrap behaviors
 * mostly affect overflow/ellipsis semantics; default stays `pre-wrap`.
 * V1 ref: bundle.js 4837-4844.
 */
const contentClassList = computed<string[]>(() => {
  const el = element.value
  if (!el) return ['hiprint-printElement-longText-content']
  const wrap = computeTextWrapClasses(el.options as Opts)
  return [
    'hiprint-printElement-longText-content',
    'hiprint-text-content-wrap',
    ...wrap,
  ]
})

/** Inline style: pre-wrap + optional minHeight floor (TKT-341). */
const contentStyle = computed(() => {
  const style: Record<string, string> = {
    height: '100%',
    width: '100%',
    'white-space': 'pre-wrap',
    overflow: 'hidden',
  }
  if (minHeightPt.value > 0) {
    style.minHeight = minHeightPt.value + 'pt'
  }
  return style
})

const formatterHtml = computed<string | null>(() => {
  const el = element.value
  if (!el) return null
  const opts = el.options as Opts
  // TKT-006: accept string-source formatter as well (V1 parity).
  const fn = compileFormatter(opts.formatter)
  if (!fn) return null
  try {
    // TKT-024: pre-convert via dataType+format BEFORE formatter chain.
    const out = fn(
      coerceText(opts.title),
      getFormattedValue(el, props.data),
      opts,
      props.data
    )
    return out == null ? '' : String(out)
  } catch (err) {
    console.warn('[hiprint-v3:LongTextElement] formatter threw:', err)
    return ''
  }
})

/**
 * TKT-026: Imperative pagination API.
 *
 * Computes V1-parity multi-page breakdown of the rendered displayText using
 * `paginateLongText` + a DOM-backed measure probe.
 *
 * Callers (preview iframe, print pipeline) should pass the available height
 * per page in pt. Returns an array of text chunks, one per page.
 *
 * Designer single-page view does NOT call this — it renders the full text
 * with CSS clipping (matches V1 designer behavior).
 *
 * @param maxHeightPt   Available height for the first page (pt).
 * @param perPageHeightPt  Available height per subsequent page (pt). Default
 *                         equals maxHeightPt (uniform per-page budget).
 * @returns Array of strings, one per page. Always at least one entry.
 */
function getPaginatedPages(
  maxHeightPt: number,
  perPageHeightPt?: number
): string[] {
  const el = element.value
  if (!el) return ['']
  const opts = el.options as Opts
  const text = displayText.value
  const widthPt = safeNumber(opts.width, { min: 1, fallback: 200 })
  const fontSizePt = safeNumber(opts.fontSize, { fallback: 10.5 })
  const lineHeightPt = safeNumber(opts.lineHeight, {
    fallback: fontSizePt * 1.5,
  })
  const fontFamily =
    typeof opts.fontFamily === 'string' && opts.fontFamily
      ? opts.fontFamily
      : 'sans-serif'
  const letterSpacing =
    opts.letterSpacing != null
      ? safeNumber(opts.letterSpacing, { fallback: 0 })
      : undefined

  // SSR / no-DOM environment: return single page (cannot measure).
  if (typeof document === 'undefined') return [text]

  const host = document.createElement('div')
  document.body.appendChild(host)
  try {
    const measure = createDomMeasure(
      host,
      fontSizePt,
      lineHeightPt,
      fontFamily,
      widthPt,
      letterSpacing
    )
    const { pages } = paginateLongText({
      fullText: text,
      maxHeightPt,
      perPageHeightPt: perPageHeightPt ?? maxHeightPt,
      fontSizePt,
      lineHeightPt,
      fontFamily,
      width: widthPt,
      letterSpacing,
      measure,
    })
    return pages.map((p) => p.text)
  } finally {
    if (host.parentNode) host.parentNode.removeChild(host)
  }
}

defineExpose({ getPaginatedPages })
</script>

<template>
  <ElementWrapper
    :element-id="elementId"
    :panel-id="panelId"
    :interactive="interactive"
  >
    <div
      :class="contentClassList"
      :style="contentStyle"
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
