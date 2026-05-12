<script setup lang="ts">
/**
 * QrcodeElement.vue — V3 qrcode etype (P17.1).
 *
 * Generates a QR code via bwip-js (bcid='qrcode' by default). Mirrors
 * `render.ts` renderQrcodeElement: SVG output + optional title rendered below
 * via Vue interpolation (XSS-safe).
 *
 * Re-renders on element/data changes (deep watch).
 */
import bwipjs from 'bwip-js/browser'
import { computed, ref, watch } from 'vue'
import { useCanvasStore } from '@hiprint-v3/stores'
import {
  coerceText,
  collectBwipPassthrough,
  mapQrCodeLevel,
  pt,
  safeNumber,
} from '@hiprint-v3/internal'
import ElementWrapper from './ElementWrapper.vue'
import { getElementValue, isTrue, type Opts } from './_helpers'

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
const svgHost = ref<HTMLDivElement | null>(null)

const element = computed(() => {
  for (const panel of canvas.panels) {
    const el = panel.printElements.find((e) => e.id === props.elementId)
    if (el) return el
  }
  return null
})

const qrText = computed<string>(() => {
  const el = element.value
  if (!el) return ''
  const opts = el.options as Opts
  const value = getElementValue(el, props.data)
  return (
    (typeof value === 'string' && value) ||
    (typeof opts.testData === 'string' && opts.testData) ||
    (typeof opts.title === 'string' && opts.title) ||
    ''
  )
})

const showTitle = computed<boolean>(() => {
  const el = element.value
  if (!el) return false
  return !isTrue((el.options as Opts).hideTitle) && qrText.value.length > 0
})

const titleStyle = computed(() => {
  const el = element.value
  if (!el) return {}
  const opts = el.options as Opts
  const fontSize = opts.fontSize != null ? String(opts.fontSize) + 'pt' : '9pt'
  const align = typeof opts.textAlign === 'string' ? opts.textAlign : 'center'
  return {
    textAlign: align as 'left' | 'center' | 'right' | 'justify',
    fontSize,
    lineHeight: '1.5',
  }
})

function render(): void {
  const el = element.value
  const host = svgHost.value
  if (!el || !host) return
  while (host.firstChild) host.removeChild(host.firstChild)

  const opts = el.options as Opts
  const text = qrText.value
  if (!text) return

  try {
    const widthPt = safeNumber(opts.width, { min: 1, fallback: 50 })
    const heightPt = safeNumber(opts.height, { min: 1, fallback: 50 })
    const lineH = safeNumber(opts.lineHeight, {
      fallback: safeNumber(opts.fontSize, { fallback: 10.5 }) * 1.5,
    })
    const hideTitle = isTrue(opts.hideTitle)
    const titleH = !hideTitle ? lineH : 0
    const widthPx = pt.toPx(widthPt)
    const heightPx = pt.toPx(heightPt - titleH)
    const square = Math.max(1, Math.floor(Math.min(widthPx / 2.835, heightPx / 2.835)))
    // TKT-023: clamp + alias V1 Path A `qrCodeLevel` int via shared helper.
    const ecLevel = (['M', 'L', 'H', 'Q'] as const)[mapQrCodeLevel(opts.qrCodeLevel)]

    // TKT-364: extra bwip-js opts forwarding (Sprint 22g GL).
    const passthrough = collectBwipPassthrough(opts as Record<string, unknown>)
    const svgStr = bwipjs.toSVG({
      ...passthrough,
      bcid: typeof opts.qrcodeType === 'string' ? opts.qrcodeType : 'qrcode',
      text,
      scale: 1,
      width: square,
      height: square,
      includetext: false,
      eclevel: ecLevel,
      barcolor: typeof opts.barColor === 'string' ? opts.barColor : '#000',
    } as Parameters<typeof bwipjs.toSVG>[0])

    const svgEl = parseSvg(svgStr)
    if (svgEl) host.appendChild(svgEl)
  } catch (err) {
    console.warn('[hiprint-v3:QrcodeElement] render failed:', err)
    const fallback = document.createElement('div')
    fallback.textContent = 'QRCode render failed'
    host.appendChild(fallback)
  }
}

function parseSvg(svgStr: string): SVGElement | null {
  if (!svgStr || typeof svgStr !== 'string') return null
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(svgStr, 'image/svg+xml')
    if (doc.getElementsByTagName('parsererror')[0]) return null
    const root = doc.documentElement
    if (!root || root.tagName.toLowerCase() !== 'svg') return null
    return document.importNode(root, true) as unknown as SVGElement
  } catch (err) {
    console.warn('[hiprint-v3:QrcodeElement] parseSvg failed:', err)
    return null
  }
}

watch(
  [element, () => props.data, svgHost],
  () => render(),
  { deep: true, flush: 'post' }
)
</script>

<template>
  <ElementWrapper
    :element-id="elementId"
    :panel-id="panelId"
    :interactive="interactive"
  >
    <div
      class="hiprint-printElement-qrcode-content"
      style="height: 100%; width: 100%"
    >
      <div ref="svgHost" />
      <div
        v-if="showTitle"
        class="hiprint-printElement-qrcode-content-title"
        :style="titleStyle"
      >
        {{ coerceText(qrText) }}
      </div>
    </div>
  </ElementWrapper>
</template>
