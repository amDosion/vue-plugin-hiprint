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
 * TKT-153 — paper page-number badge.
 *
 * V1 inventory `interactions.md` §14.1 / §14.2:
 *  - `.hiprint-paperNumber` rendered when multiple papers exist (V1 line 9420 /
 *    10912 — `createPaperNumber(text, isDesignMode)`).
 *  - `panel.paperNumberDisabled === true` toggles `.hiprint-paperNumber-disabled`
 *    (V1 line 10843 — even though V1 actually `.hide()`s, the CSS class is the
 *    documented hook; V3 keeps the hook so hosts/CSS can selectively style).
 *  - Positioned at bottom-right of the paper (outside printable area; V1 uses
 *    `paperNumberLeft/Top`, here we hard-code 4pt for V3 baseline).
 *
 * Hidden in readonly mode (V1 `isDesignMode` gate from line 10912).
 * Pointer-events:none so it never intercepts canvas pointer gestures.
 *
 * `pageIndex` here mirrors the 1-based index displayed; with one panel we
 * still render nothing because V1 only paints page numbers when there is more
 * than one paper.
 */
const showPaperNumber = computed<boolean>(() => {
  if (props.readonly) return false
  if (canvas.panels.length <= 1) return false
  return true
})

const paperNumberIndex = computed<number>(() => {
  const idx = canvas.panels.findIndex((p) => p.id === props.panelId)
  return idx < 0 ? 1 : idx + 1
})

const paperNumberDisabled = computed<boolean>(() => {
  const p = panel.value
  return !!(p && (p as { paperNumberDisabled?: unknown }).paperNumberDisabled)
})

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
  // Grid background (toolbar gridToggle controls canvas.gridVisible).
  // V1 parity: render a checkerboard/grid pattern over the paper so designers
  // can align elements. Off when canvas.gridVisible=false or in readonly mode.
  if (canvas.gridVisible && !props.readonly) {
    const step = canvas.gridSize > 0 ? canvas.gridSize : 5
    style.backgroundImage =
      'linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px),' +
      ' linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)'
    style.backgroundSize = step + 'pt ' + step + 'pt'
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
      <!-- TKT-102 / TKT-103: parent renders guide-line + smart-guide layers
           via this slot so they sit inside the paper transform stack (paper-pt
           coordinates + scale). -->
      <slot name="overlay" />
      <slot />
      <div
        v-if="footerMarkerStyle"
        class="hiprint-panel-footer-marker"
        :style="footerMarkerStyle"
      />
      <!-- TKT-153: paper page-number badge. Only when multi-panel + not
           readonly. `.hiprint-paperNumber-disabled` is added when the panel
           opts in via `paperNumberDisabled` flag (V1 line 10843 parity). -->
      <span
        v-if="showPaperNumber"
        class="hiprint-paperNumber"
        :class="{ 'hiprint-paperNumber-disabled': paperNumberDisabled }"
        aria-hidden="true"
      >{{ paperNumberIndex }}</span>
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
  outline: 1px solid var(--hiprint-selection-outline, #409eff);
  outline-offset: 2pt;
}
.hiprint-printPanel--readonly .hiprint-printPaper {
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.08) !important;
}
/* TKT-153 — paper page-number badge (V1 styles.md §1.1 line 32-33).
 * Bottom-right of the paper, outside the design grid. Non-interactive. */
.hiprint-paperNumber {
  position: absolute;
  bottom: 4pt;
  right: 4pt;
  font-size: 9pt;
  color: var(--hiprint-fg-disabled, #999);
  pointer-events: none;
  user-select: none;
  line-height: 1;
  z-index: 2;
}
.hiprint-paperNumber-disabled {
  /* V1 hides the badge entirely when disabled; CSS class is the documented
   * hook so theme overrides can choose a different treatment. */
  display: none;
}
</style>
