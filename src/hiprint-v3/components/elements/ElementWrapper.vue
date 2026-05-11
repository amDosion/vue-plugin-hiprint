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
import type { CanvasElement } from '@hiprint-v3/stores'
import { computeBaseStyle, type Opts } from './_helpers'

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

const wrapperStyle = computed(() => computeBaseStyle(options.value))

const wrapperClass = computed(() => {
  const type =
    (element.value?.printElementType?.type as string | undefined) ?? 'unknown'
  return [
    'hiprint-element',
    'hiprint-printElement',
    'hiprint-printElement-' + type,
    { 'hiprint-element--selected': isSelected.value },
  ]
})

// ----- Interactions wiring -----

let cleanupSelection: (() => void) | null = null
let cleanupResize: (() => void) | null = null

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
    onEnd: (finalPos) => {
      // Patch is already applied per-frame by enableElementDrag's move handler.
      // The onEnd callback exists for parent components that want to react
      // (e.g. history snapshot). We just no-op; finalPos is already in store.
      void finalPos
    },
  })

  // 3) Resize — returns its own cleanup.
  cleanupResize = enableElementResize(el, {
    elementId: props.elementId,
    panelId: props.panelId,
    gridSize: canvas.gridSize,
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
</style>
