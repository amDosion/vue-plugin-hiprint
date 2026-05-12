<script setup lang="ts">
/**
 * ImageElement.vue — V3 image etype (P17.1).
 *
 * Renders an `<img>` with src resolved from:
 *   1. Bound business data via `options.field` (or printElementType.field).
 *   2. `options.src` design-time fallback.
 *
 * V2 reference: `render.ts` renderImageElement (line 247-276).
 * V1 ref: bundle.js line 9269-9290 (createTarget / src write / fit / borderRadius)
 *         + 4045-4099 (load chain / aspect-ratio / error handler).
 *
 * Sprint 22g wave 2 additions (Stream GF):
 *   - TKT-350: `formatter` 4-arg signature — (title, value, options, target).
 *     V1 hands the formatter the jQuery target for DOM-poke side effects;
 *     V3 hands the resolved HTMLElement (the inner content div) so the same
 *     code paths work after compileFormatter normalization.
 *   - TKT-352: `formatter` accepts string-source JS via compileFormatter.
 *   - TKT-355 (image-side parallel): formatter returning null → keep
 *     element invisible (uses fallback transparent PNG).
 *   - TKT-358: when no explicit width/height, fall back to the image's
 *     natural aspect ratio after `@load` fires.
 *   - TKT-359: `options.error` fallback URL on `@error`. The transparent
 *     1×1 PNG remains the final fallback if `error` itself fails.
 *   - TKT-361: data: URL accepted by panel; render path is identical.
 *
 * Safety:
 *   - Src is bound via `:src` (Vue auto-escapes attribute values; no innerHTML).
 *   - `javascript:` / `vbscript:` / unknown protocols are filtered. Allow-list:
 *     `http:` / `https:` / `data:` / `blob:` / relative (no scheme). V1 inherited
 *     browser defaults; V3 narrows for defence-in-depth.
 *   - `@error` swaps to `options.error` first, then to 1×1 transparent PNG so
 *     layout doesn't collapse.
 */
import { computed, ref } from 'vue'
import { useCanvasStore } from '@hiprint-v3/stores'
import { compileFormatter, safeNumber } from '@hiprint-v3/internal'
import ElementWrapper from './ElementWrapper.vue'
import { getElementValue, type Opts } from './_helpers'

/** 1×1 transparent PNG. Final fallback when src + options.error both fail. */
const FALLBACK_SRC =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII='

/**
 * URL-protocol allow-list. `javascript:` / `vbscript:` / `file:` are stripped
 * to the empty string → triggers fallback. V1 inherited browser defaults;
 * V3 narrows for defence-in-depth (XSS via `javascript:` src is the classic
 * attack and Vue's `:src` does NOT filter protocols).
 */
const SAFE_PROTOCOLS = /^(?:https?:|data:|blob:|\/|\.\/|\.\.\/|[^:/?#]+$)/i

function sanitizeSrc(raw: string): string {
  if (!raw) return ''
  return SAFE_PROTOCOLS.test(raw) ? raw : ''
}

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
const errorFallbackFailed = ref(false)
const naturalRatio = ref<number | null>(null)
const imgEl = ref<HTMLImageElement | null>(null)

const element = computed(() => {
  for (const panel of canvas.panels) {
    const el = panel.printElements.find((e) => e.id === props.elementId)
    if (el) return el
  }
  return null
})

/**
 * TKT-350 + TKT-352: image formatter chain. V1 hands a jQuery target; V3
 * hands the underlying HTMLElement (compatible-enough for the common
 * `target.attr(...)` / DOM-poke uses post-jQuery).
 *
 * TKT-355 (image-side parallel): formatter returning null/undefined hides
 * the image (renders the transparent fallback so layout reserves the box
 * but no glyph appears).
 */
const formatterOutput = computed<{ src: string; hide: boolean } | null>(() => {
  const el = element.value
  if (!el) return null
  const opts = el.options as Opts
  const fn = compileFormatter(opts.formatter)
  if (!fn) return null
  try {
    const value = getElementValue(el, props.data)
    const out = fn(opts.title, value, opts, imgEl.value)
    if (out == null) return { src: '', hide: true }
    return { src: String(out), hide: false }
  } catch (err) {
    console.warn('[hiprint-v3:ImageElement] formatter threw:', err)
    return null
  }
})

const resolvedSrc = computed<string>(() => {
  const el = element.value
  if (!el) return FALLBACK_SRC
  const opts = el.options as Opts

  // TKT-355: formatter null return → invisible 1×1.
  const fmt = formatterOutput.value
  if (fmt && fmt.hide) return FALLBACK_SRC

  // TKT-359: on first error, try options.error then 1×1 fallback.
  if (loadError.value) {
    if (
      !errorFallbackFailed.value &&
      typeof opts.error === 'string' &&
      opts.error
    ) {
      return sanitizeSrc(opts.error) || FALLBACK_SRC
    }
    return FALLBACK_SRC
  }

  const fieldValue = getElementValue(el, props.data)
  const raw =
    (fmt && fmt.src) ||
    (typeof fieldValue === 'string' && fieldValue) ||
    (typeof opts.src === 'string' && opts.src) ||
    ''
  return sanitizeSrc(raw) || FALLBACK_SRC
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
    if (typeof opts.borderRadius === 'string') {
      // V1 accepts free-form CSS borderRadius strings (e.g. "4px 8px" / "50%").
      style.borderRadius = opts.borderRadius
    } else {
      style.borderRadius = safeNumber(opts.borderRadius, { min: 0 }) + 'pt'
    }
  }
  // TKT-358 — natural aspect ratio fallback when neither width nor height
  // is explicitly set. We only apply the `aspect-ratio` when natural ratio
  // is known and the option width is absent (so the parent geometry hasn't
  // already constrained us).
  if (
    opts.width == null &&
    opts.height == null &&
    naturalRatio.value != null
  ) {
    style.aspectRatio = String(naturalRatio.value)
  }
  return style
})

function onError(): void {
  // First error → try options.error. Second error → final transparent PNG.
  if (loadError.value) {
    errorFallbackFailed.value = true
  } else {
    loadError.value = true
  }
}

function onLoad(ev: Event): void {
  // TKT-358 — capture natural ratio for unsized image fallback.
  const target = ev.target as HTMLImageElement | null
  if (!target) return
  imgEl.value = target
  if (target.naturalWidth > 0 && target.naturalHeight > 0) {
    naturalRatio.value = target.naturalWidth / target.naturalHeight
  }
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
      <img
        ref="imgEl"
        :src="resolvedSrc"
        :style="imgStyle"
        @error="onError"
        @load="onLoad"
        alt=""
      />
    </div>
  </ElementWrapper>
</template>
