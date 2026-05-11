<script setup lang="ts">
/**
 * HiprintPanel.vue — V3 single panel surface (P18.1).
 *
 * Renders one paper panel: paper-sized container with optional header/footer
 * guide markers, scale applied via CSS transform, and a default slot for
 * absolutely-positioned print element children.
 *
 * V2 reference: bundle.js .hiprint-printPanel + .hiprint-printPaper (line
 * ~10625 in V1). V3 renderPanel (src/hiprint-v3/print/render.ts) produces the
 * same DOM shape at print time; this component owns the *design-time* surface.
 *
 * Geometry:
 *  - panel.width / panel.height are stored in mm (V1/V2 convention).
 *  - Paper element is rendered with pt units to match what print pipeline emits
 *    so design-time geometry matches print geometry byte-for-byte.
 *  - canvas.scale (zoom) applied as CSS transform on the paper, NOT on the
 *    wrapper, so scroll containers can compute layout from the unscaled root.
 *
 * Header/footer markers:
 *  - paperHeader / paperFooter are pt offsets from the paper top.
 *  - We render thin dashed guides at the configured positions. Markers are
 *    purely visual — element rendering is unaffected.
 *  - Hidden in readonly (preview) mode.
 *
 * Lifecycle:
 *  - This component installs the panel-level dropzone (P16.1) when not
 *    readonly so canvas-dropped sidebar items or cross-panel drags land in
 *    the right panel. Cleanup runs on unmount (interact.js unset).
 *  - Lasso is owned by HiprintCanvas (one lasso per active panel); this
 *    component does NOT register lasso here to avoid double-binding.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useCanvasStore } from '@hiprint-v3/stores'
import {
  disableInteractions,
  enablePanelDropZone,
} from '@hiprint-v3/interactions'
import { mm } from '@hiprint-v3/internal'

const props = withDefaults(
  defineProps<{
    panelId: string
    /** Suppress dropzone registration + header/footer markers. */
    readonly?: boolean
  }>(),
  { readonly: false }
)

const canvas = useCanvasStore()
const paperEl = ref<HTMLDivElement | null>(null)

/**
 * Reactive panel record — computed re-runs when canvas.panels mutates.
 * Returns `null` if the panel id has been removed (component should still
 * render an empty shell rather than throw).
 */
const panel = computed(() =>
  canvas.panels.find((p) => p.id === props.panelId) ?? null
)

const isActive = computed(() => canvas.activePanelId === props.panelId)

/**
 * Paper style — width/height in pt to match V3 renderPanel output. We use
 * mm.toPt() so design-time geometry == print geometry. Scale is applied via
 * transform so it doesn't break absolute child positioning.
 */
const paperStyle = computed(() => {
  const p = panel.value
  const widthMm = p?.width ?? 210
  const heightMm = p?.height ?? 297
  const widthPt = mm.toPt(widthMm)
  const heightPt = mm.toPt(heightMm)

  const scale = canvas.scale
  const style: Record<string, string> = {
    position: 'relative',
    width: widthPt + 'pt',
    height: heightPt + 'pt',
    background: 'white',
    boxShadow: '0 0 8px rgba(0,0,0,0.12)',
    transformOrigin: '0 0',
  }
  if (scale !== 1) {
    style.transform = `scale(${scale})`
  }
  return style
})

/**
 * Header guide marker. paperHeader is in pt (V1/V2 convention) measured from
 * paper top. We render a thin horizontal dashed line just below the header
 * region so designers see where page-header content ends.
 */
const headerMarkerStyle = computed<Record<string, string> | null>(() => {
  if (props.readonly) return null
  const p = panel.value
  if (!p || p.paperHeader == null) return null
  const hPt = Number(p.paperHeader)
  if (!Number.isFinite(hPt) || hPt <= 0) return null
  return {
    position: 'absolute',
    left: '0',
    right: '0',
    top: hPt + 'pt',
    borderTop: '1px dashed #ccc',
    pointerEvents: 'none',
  }
})

/**
 * Footer guide marker. paperFooter is in pt from paper top (V2 stores the
 * absolute top-edge of the footer region, not the bottom inset — see
 * src/hiprint-v2/core/panel.js fallback=780 for A4).
 */
const footerMarkerStyle = computed<Record<string, string> | null>(() => {
  if (props.readonly) return null
  const p = panel.value
  if (!p || p.paperFooter == null) return null
  const fPt = Number(p.paperFooter)
  if (!Number.isFinite(fPt) || fPt <= 0) return null
  return {
    position: 'absolute',
    left: '0',
    right: '0',
    top: fPt + 'pt',
    borderTop: '1px dashed #ccc',
    pointerEvents: 'none',
  }
})

// ----- Dropzone wiring -----

onMounted(() => {
  if (props.readonly || !paperEl.value) return
  // Register panel as drop target for cross-panel + sidebar drops (P16.1).
  enablePanelDropZone(paperEl.value, props.panelId)
})

// Re-register if panelId changes (rare — usually parent v-for keys on it,
// but defensive in case parent reuses the same component instance).
watch(
  () => props.panelId,
  (newId, oldId) => {
    if (props.readonly || !paperEl.value || newId === oldId) return
    disableInteractions(paperEl.value)
    enablePanelDropZone(paperEl.value, newId)
  }
)

onBeforeUnmount(() => {
  if (paperEl.value) disableInteractions(paperEl.value)
})
</script>

<template>
  <div
    class="hiprint-printPanel"
    :class="{ 'hiprint-printPanel--active': isActive, 'hiprint-printPanel--readonly': readonly }"
    :data-panel-id="panelId"
  >
    <div
      ref="paperEl"
      class="hiprint-printPaper"
      :data-panel-id="panelId"
      :style="paperStyle"
    >
      <div
        v-if="headerMarkerStyle"
        class="hiprint-panel-header-marker"
        :style="headerMarkerStyle"
      />
      <slot />
      <div
        v-if="footerMarkerStyle"
        class="hiprint-panel-footer-marker"
        :style="footerMarkerStyle"
      />
    </div>
  </div>
</template>

<style scoped>
.hiprint-printPanel {
  display: inline-block;
  /* Wrapper isn't scaled — paper inside is. This keeps scrollbars sane. */
  margin: 8pt;
}
.hiprint-printPanel--active .hiprint-printPaper {
  outline: 1px solid #409eff;
  outline-offset: 2pt;
}
.hiprint-printPanel--readonly .hiprint-printPaper {
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.08) !important;
}
</style>
