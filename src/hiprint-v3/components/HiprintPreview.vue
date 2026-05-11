<script setup lang="ts">
/**
 * HiprintPreview.vue — V3 print preview surface (P18.1).
 *
 * Renders the current template as a detached DOM tree using the print
 * pipeline's `renderTemplate` (src/hiprint-v3/print/render.ts). The output
 * matches exactly what the SilentPrintStrategy/BrowserPrintStrategy emit to
 * the print pipe — so the preview is byte-faithful to the printed result.
 *
 * Why detached DOM and not Vue v-for:
 *  - The print pipeline ships an imperative renderer (renderTemplate returns
 *    HTMLDivElement). Reusing that same renderer for preview eliminates the
 *    "preview != print" drift bug class.
 *  - Vue components (HiprintCanvas) own the DESIGN-TIME surface (drag-aware,
 *    editable). Preview is read-only: no interactions, no edit handlers, no
 *    selection class — pure rendered HTML.
 *
 * Two display modes:
 *  - inline (default): preview mounted inside a `<div>` in the document tree.
 *    Good for embedded preview panels.
 *  - iframe (prop iframe=true): mounted inside a sandboxed `<iframe>` so the
 *    host page's CSS doesn't bleed into the preview. Matches V1's print iframe
 *    pipeline. We still use srcdoc-style writing (iframe.contentDocument.body)
 *    to avoid external URL fetches.
 *
 * Reactivity:
 *  - We watch (currentJson, data) deeply. Each change re-runs renderTemplate
 *    and replaces the preview content. structuredClone-equivalent identity
 *    cycles are not needed because renderTemplate returns a fresh DOM tree.
 *
 * Error handling:
 *  - renderTemplate is wrapped in try/catch — render failures show a fallback
 *    message rather than crashing the host page.
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useTemplateStore } from '@hiprint-v3/stores'
import { renderTemplate } from '@hiprint-v3/print'
import type { TemplateJson } from '@hiprint-v3/schemas'

const props = withDefaults(
  defineProps<{
    /** Explicit data override. If omitted, no field data is bound (testData only). */
    data?: Record<string, unknown>
    /** Render inside a sandboxed iframe for CSS isolation. Default false. */
    iframe?: boolean
    /** Optional stylesheet href forwarded to renderTemplate. */
    stylesheetHref?: string
  }>(),
  { iframe: false }
)

const tpl = useTemplateStore()
const hostEl = ref<HTMLDivElement | null>(null)

/**
 * Render the current template into the host element. Idempotent: clears any
 * previous render first. No-op if no template loaded.
 */
function renderInto(host: HTMLElement): void {
  // Clear previous content.
  while (host.firstChild) host.removeChild(host.firstChild)

  const json: TemplateJson | null = tpl.isLoaded ? tpl.currentJson : null
  if (!json) return

  try {
    const node = renderTemplate(json, {
      data: props.data,
      ...(props.stylesheetHref ? { stylesheetHref: props.stylesheetHref } : {}),
    })
    host.appendChild(node)
  } catch (err) {
    console.warn('[hiprint-v3:HiprintPreview] renderTemplate failed:', err)
    const fallback = document.createElement('div')
    fallback.className = 'hiprint-preview__error'
    fallback.textContent = 'Preview render failed'
    host.appendChild(fallback)
  }
}

/**
 * Resolve the actual mount target — either the host div directly, or the
 * iframe's contentDocument.body if iframe mode. Returns null if iframe is
 * still loading (caller should retry on iframe load event).
 */
function resolveMountTarget(): HTMLElement | null {
  const host = hostEl.value
  if (!host) return null
  if (!props.iframe) return host
  const iframe = host.querySelector('iframe') as HTMLIFrameElement | null
  if (!iframe || !iframe.contentDocument) return null
  return iframe.contentDocument.body
}

function repaint(): void {
  const target = resolveMountTarget()
  if (target) renderInto(target)
}

onMounted(() => {
  if (props.iframe) {
    // Wait for iframe contentDocument to be ready (next tick covers most cases).
    queueMicrotask(repaint)
  } else {
    repaint()
  }
})

// Re-render on template / data change. tpl.currentTemplate identity changes
// on load(). canvas store mutations bubble through currentJson (computed).
watch(
  [() => tpl.currentTemplate, () => tpl.currentJson, () => props.data],
  () => repaint(),
  { deep: true }
)

onBeforeUnmount(() => {
  // Clear preview DOM. Iframe's content is GC'd with the iframe element.
  const target = resolveMountTarget()
  if (target) {
    while (target.firstChild) target.removeChild(target.firstChild)
  }
})
</script>

<template>
  <div ref="hostEl" class="hiprint-preview" :class="{ 'hiprint-preview--iframe': iframe }">
    <iframe v-if="iframe" class="hiprint-preview__iframe" />
  </div>
</template>

<style scoped>
.hiprint-preview {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: auto;
  background: #f5f5f5;
  padding: 16pt;
  box-sizing: border-box;
}
.hiprint-preview--iframe {
  padding: 0;
}
.hiprint-preview__iframe {
  width: 100%;
  height: 100%;
  border: 0;
  background: white;
}
</style>
