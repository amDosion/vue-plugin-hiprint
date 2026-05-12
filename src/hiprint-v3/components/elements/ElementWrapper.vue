<script setup lang="ts">
/**
 * ElementWrapper.vue — Shared root component for ALL V3 etypes (P17.0).
 *
 * Every etype SFC renders inside `<ElementWrapper>` via default slot. This
 * wrapper is responsible for:
 *
 *   1. Absolute positioning + base style (from element.options).
 *   2. Lifecycle wiring of drag (P16.1) + resize (P16.2) + selection (P16.4).
 *   3. Data-* attributes consumed by interactions:
 *        - `data-element-id`   — used by drag/resize cleanup + lasso hit-test.
 *        - `data-panel-id`     — used by cross-panel drop detection.
 *        - `.hiprint-element`  — used by interact.js dropzone accept filter.
 *
 * Subcomponents render only the *content* (TextElement renders `{{ text }}`,
 * BarcodeElement renders `<canvas>`, etc.) and receive the resolved element +
 * options through the slot scope.
 *
 * Selection lifecycle:
 *  - On mount we register click handlers (enableElementSelection).
 *  - When canvas.selectedElementIds contains our id, we apply the
 *    `.hiprint-element--selected` class for CSS-driven selection style.
 *
 * Drag / resize lifecycle:
 *  - We register on mount.
 *  - We call `disableInteractions(el)` on unmount — interact.js holds strong
 *    references and would otherwise leak the element + closures.
 *
 * NOTE: This wrapper does NOT itself dispatch on element.tid; it renders
 * whatever the parent slot provides. The parent (canvas / panel component in
 * P18) is responsible for picking the right etype SFC based on tid/type.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useCanvasStore } from '@hiprint-v3/stores'
import {
  disableInteractions,
  enableElementDrag,
  enableElementResize,
  enableElementSelection,
} from '@hiprint-v3/interactions'
import { isAnyLocked, isFullyLocked } from '@hiprint-v3/interactions/lock'
import type { CanvasElement } from '@hiprint-v3/stores'
import { computeBaseStyle, type Opts } from './_helpers'
import DragOverlay from './DragOverlay.vue'

const props = withDefaults(
  defineProps<{
    elementId: string
    panelId: string
    /** Whether to register drag/resize/selection. Default true. Tests/preview
     *  modes can pass false to render pure content without interactions. */
    interactive?: boolean
  }>(),
  { interactive: true }
)

const canvas = useCanvasStore()
const rootEl = ref<HTMLDivElement | null>(null)

// Find the live (reactive) element in store; computed re-runs on patch.
const element = computed<CanvasElement | null>(() => {
  const id = props.elementId
  for (const panel of canvas.panels) {
    const el = panel.printElements.find((e) => e.id === id)
    if (el) return el
  }
  return null
})

const options = computed<Opts>(() => (element.value?.options as Opts) ?? {})

const isSelected = computed<boolean>(() =>
  canvas.selectedElementIds.has(props.elementId)
)

// TKT-027: lock state reactivity. `isLocked` powers the BEM class + lock-badge
// overlay; `isFullLock` is exposed via slot scope so child SFCs (e.g.
// TextElement) can gate inline edit on the catch-all `lock` field.
const isLocked = computed<boolean>(() => isAnyLocked(options.value))
const isFullLock = computed<boolean>(() => isFullyLocked(options.value))

// TKT-101: per-element visibility toggle. Driven by the element-list-panel
// eye icon. When `options.hidden === true`:
//   - On the designer canvas we render with `visibility:hidden` so the
//     element still occupies its slot (useful for layout review) and we
//     drop `pointer-events` so it can't be clicked / dragged accidentally.
//   - The print pipeline (`renderTemplate` in `print/render.ts`) skips the
//     element entirely so hidden elements never reach the printed page.
// Both behaviors mirror V1 `el.designTarget.hide()` / `.show()` plus the
// runtime convention that hidden elements are not part of the print result.
const isHidden = computed<boolean>(() => options.value.hidden === true)

const wrapperStyle = computed(() => {
  const base = computeBaseStyle(options.value)
  if (isHidden.value) {
    return {
      ...base,
      visibility: 'hidden' as const,
      pointerEvents: 'none' as const,
    }
  }
  return base
})

const wrapperClass = computed(() => {
  const type =
    (element.value?.printElementType?.type as string | undefined) ?? 'unknown'
  return [
    'hiprint-element',
    'hiprint-printElement',
    'hiprint-printElement-' + type,
    { 'hiprint-element--selected': isSelected.value },
    // TKT-027: visual hook for locked elements (any lock). Panel CSS uses
    // this to hide resize handles + show a lock cursor.
    { 'hiprint-element--locked': isLocked.value },
    // TKT-101: visual hook for hidden elements (eye toggle in element-list).
    { 'hiprint-element--hidden': isHidden.value },
  ]
})

// ----- Interactions wiring -----

let cleanupSelection: (() => void) | null = null
let cleanupResize: (() => void) | null = null

// TKT-104 — drag/resize overlay mode. `idle` keeps overlay hidden via v-show
// inside DragOverlay. Flipped to 'drag' by drag onStart, 'resize' by resize
// onStart, back to 'idle' on end. `resizeReadout` tracks live geometry during
// resize because the store is patched only at resize-end (DOM holds truth).
const overlayMode = ref<'idle' | 'drag' | 'resize'>('idle')
const resizeReadout = ref<{ left: number; top: number; width: number; height: number }>({
  left: 0,
  top: 0,
  width: 0,
  height: 0,
})

const overlayGeometry = computed(() => {
  if (overlayMode.value === 'resize') return resizeReadout.value
  return {
    left: Number(options.value.left ?? 0),
    top: Number(options.value.top ?? 0),
    width: Number(options.value.width ?? 0),
    height: Number(options.value.height ?? 0),
  }
})

onMounted(() => {
  if (!props.interactive || !rootEl.value) return
  const el = rootEl.value

  // 1) Selection — click handler.
  cleanupSelection = enableElementSelection(el, props.elementId, props.panelId)

  // 2) Drag — interact.js draggable. No cleanup fn returned; we call
  //    disableInteractions(el) on unmount which unsets the interactable.
  enableElementDrag(el, {
    elementId: props.elementId,
    panelId: props.panelId,
    gridSize: canvas.gridSize,
    onStart: () => {
      // TKT-104: flip overlay to drag mode.
      overlayMode.value = 'drag'
    },
    onEnd: (finalPos) => {
      // Patch is already applied per-frame by enableElementDrag's move handler.
      // The onEnd callback exists for parent components that want to react
      // (e.g. history snapshot). We just no-op; finalPos is already in store.
      void finalPos
      overlayMode.value = 'idle'
    },
  })

  // 3) Resize — returns its own cleanup.
  cleanupResize = enableElementResize(el, {
    elementId: props.elementId,
    panelId: props.panelId,
    gridSize: canvas.gridSize,
    onStart: (startRect) => {
      // TKT-104: flip overlay to resize mode + seed live readout.
      resizeReadout.value = { ...startRect }
      overlayMode.value = 'resize'
    },
    onResize: (rect) => {
      // TKT-104: mirror tick rect so size-readout chip tracks the cursor.
      resizeReadout.value = { ...rect }
    },
    onEnd: (finalRect) => {
      // Push final rect back to the store. Drag updates options.left/top
      // per-frame; resize updates the DOM directly + emits the final rect
      // here so we patch the store once at gesture end.
      canvas.updateElement(props.panelId, props.elementId, {
        options: {
          left: finalRect.left,
          top: finalRect.top,
          width: finalRect.width,
          height: finalRect.height,
        },
      })
      overlayMode.value = 'idle'
    },
  })
})

onBeforeUnmount(() => {
  // Order: selection cleanup first (DOM listener removal), then interact unset.
  cleanupSelection?.()
  cleanupSelection = null
  cleanupResize?.()
  cleanupResize = null
  if (rootEl.value) {
    disableInteractions(rootEl.value)
  }
})
</script>

<template>
  <div
    ref="rootEl"
    :class="wrapperClass"
    :data-element-id="elementId"
    :data-panel-id="panelId"
    :style="wrapperStyle"
  >
    <slot
      :element="element"
      :options="options"
      :selected="isSelected"
      :locked="isLocked"
      :fully-locked="isFullLock"
    />
    <!-- TKT-027: lock badge overlay (top-right corner). Rendered only for
         locked elements. Pure visual — pointer-events:none keeps it from
         intercepting clicks. Emoji renders as text (no XSS surface). -->
    <div
      v-if="isLocked"
      class="hiprint-element__lock-badge"
      aria-hidden="true"
      title="Locked"
    >🔒</div>
    <!-- TKT-104: cross-hairs + size readout overlay rendered during drag
         (overlayMode='drag') or resize (overlayMode='resize'). DragOverlay
         handles visibility via v-show so DOM stays mounted between gestures. -->
    <DragOverlay
      :mode="overlayMode"
      :left="overlayGeometry.left"
      :top="overlayGeometry.top"
      :width="overlayGeometry.width"
      :height="overlayGeometry.height"
    />
  </div>
</template>

<style scoped>
.hiprint-element {
  /* Default cursor — overridden by interact.js resize edges when hovering. */
  cursor: move;
  user-select: none;
}
.hiprint-element--selected {
  outline: 1px dashed #409eff;
  outline-offset: -1px;
}
/* TKT-027 — locked element visuals.
 * V1 reference: `.hiprint-lock-badge` on `.resize-panel` (inventory §1.9 line
 * 164, per-etype §H.2 line 1010). V3 puts the badge on the wrapper root so it
 * stays visible even when the element is unselected.
 */
.hiprint-element--locked {
  /* Lock cursor instead of `move` so users get a hover hint. */
  cursor: not-allowed;
}
.hiprint-element__lock-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  z-index: 2;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  line-height: 1;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid #c0c4cc;
  border-radius: 50%;
  pointer-events: none;
  user-select: none;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}
</style>
