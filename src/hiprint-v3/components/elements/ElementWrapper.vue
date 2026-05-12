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
import { useCanvasStore, useHistoryStore } from '@hiprint-v3/stores'
import {
  disableInteractions,
  enableElementDrag,
  enableElementResize,
  enableElementSelection,
} from '@hiprint-v3/interactions'
import { isAnyLocked, isFullyLocked } from '@hiprint-v3/interactions/lock'
import {
  getHandlesForType,
  type HandlePosition,
} from '@hiprint-v3/interactions/resize'
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
// History is captured defensively — outside Pinia (some unit-test paths) this
// returns null + we silently skip the snapshot. Mirrors resize.ts/drag-drop.ts.
let history: ReturnType<typeof useHistoryStore> | null = null
try {
  history = useHistoryStore()
} catch {
  history = null
}
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
    // TKT-250 — co-emit BEM (`.hiprint-element--<state>`) AND V1 legacy state
    // class names so business CSS keyed to the V1 selector vocabulary
    // (`.selected`, `.locked`, `.alwaysHide`) continues to fire alongside
    // V3's BEM rules. See `docs/V1-INVENTORY/styles.md` §1.16 + parity
    // matrix §Z1.
    { 'hiprint-element--selected': isSelected.value, selected: isSelected.value },
    // TKT-027: visual hook for locked elements (any lock). Panel CSS uses
    // this to hide resize handles + show a lock cursor.
    { 'hiprint-element--locked': isLocked.value, locked: isLocked.value },
    // TKT-101: visual hook for hidden elements (eye toggle in element-list).
    // V1 legacy name is `.alwaysHide` (bundle.js:4180).
    { 'hiprint-element--hidden': isHidden.value, alwaysHide: isHidden.value },
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

// ----- TKT-151 / TKT-152 / TKT-163 — static selection chrome -----
//
// `elementType` mirrors the same lookup the wrapperClass uses. We hoist it as
// a computed so the handle-render template + delete-button template share one
// source of truth.
const elementType = computed<string>(() => {
  const t = element.value?.printElementType?.type
  return typeof t === 'string' ? t : 'unknown'
})

// TKT-163 — per-etype handle whitelist. The resize.ts module owns the V1
// quirk table; we simply consume it. Unknown etypes fall back to the
// 8-handle vocabulary (the same default interact.js uses).
const handlePositions = computed<readonly HandlePosition[]>(() =>
  getHandlesForType(elementType.value)
)

// TKT-151 — show the static delete button / size box ONLY when the element
// is selected, not locked, NOT during an in-flight drag/resize gesture
// (DragOverlay owns the in-gesture readout — V1 inventory interactions.md
// §1 line 1402: `.size-box` hidden while position-guides show).
const showStaticChrome = computed<boolean>(
  () =>
    isSelected.value &&
    !isLocked.value &&
    overlayMode.value === 'idle' &&
    !!element.value
)

// TKT-151 — readout for the static size-box chip. Always pt → mm with one
// decimal place, matching DragOverlay's display vocabulary.
const PT_PER_MM = 72 / 25.4 // ≈ 2.8346
function ptToMmStr(p: number): string {
  const mm = p / PT_PER_MM
  return (Math.round(mm * 10) / 10).toFixed(1)
}
const sizeBoxLabel = computed<string>(() => {
  const w = Number(options.value.width ?? 0)
  const h = Number(options.value.height ?? 0)
  return `${ptToMmStr(w)}×${ptToMmStr(h)} mm`
})

// TKT-152 — handle CSS cursor map. interact.js sets the cursor on hover via
// the edges config; for the visible dots we mirror the standard direction
// cursors so the affordance reads correctly even when the cursor isn't
// directly on the interact.js hit zone.
const HANDLE_CURSORS: Readonly<Record<HandlePosition, string>> = Object.freeze({
  n: 'n-resize',
  s: 's-resize',
  e: 'e-resize',
  w: 'w-resize',
  ne: 'ne-resize',
  nw: 'nw-resize',
  se: 'se-resize',
  sw: 'sw-resize',
})

// TKT-152 — position styles for each handle dot. Coordinates expressed as
// percentages so the 8-handle layout follows element bounds for any size.
const HANDLE_POSITIONS: Readonly<
  Record<HandlePosition, { top?: string; left?: string; right?: string; bottom?: string }>
> = Object.freeze({
  nw: { top: '-4px', left: '-4px' },
  n: { top: '-4px', left: 'calc(50% - 4px)' },
  ne: { top: '-4px', right: '-4px' },
  e: { top: 'calc(50% - 4px)', right: '-4px' },
  se: { bottom: '-4px', right: '-4px' },
  s: { bottom: '-4px', left: 'calc(50% - 4px)' },
  sw: { bottom: '-4px', left: '-4px' },
  w: { top: 'calc(50% - 4px)', left: '-4px' },
})

function handleStyle(pos: HandlePosition): Record<string, string> {
  return {
    position: 'absolute',
    ...HANDLE_POSITIONS[pos],
    cursor: HANDLE_CURSORS[pos],
  }
}

// TKT-151 — delete handler. Pulls the element from the store + pushes a
// history snapshot so the action is undoable. Defensive: no-op when the
// element id no longer resolves (race with concurrent edits).
function deleteElement(ev?: MouseEvent): void {
  if (ev) {
    ev.preventDefault()
    ev.stopPropagation()
  }
  if (!element.value) return
  canvas.removeElement(props.panelId, props.elementId)
  if (history) {
    try {
      history.pushSnapshot()
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[hiprint-v3:ElementWrapper] history push threw:', err)
    }
  }
}

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

  // 3) Resize — returns its own cleanup. TKT-163 passes the etype handle
  // whitelist so interact.js only resizes from edges that have a matching
  // visible handle dot.
  cleanupResize = enableElementResize(el, {
    elementId: props.elementId,
    panelId: props.panelId,
    gridSize: canvas.gridSize,
    handles: handlePositions.value,
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
    <!-- TKT-152: visible 8-handle dots — rendered only when the element is
         selected + unlocked + idle. interact.js handles the actual hit-test
         from the cardinal edges; the dots are pure visual affordances + a
         pointer-events:none zone is preserved on the body so they don't
         hijack the in-element interactions. -->
    <template v-if="showStaticChrome">
      <div
        v-for="pos in handlePositions"
        :key="`handle-${pos}`"
        :class="['hiprint-element__handle', `hiprint-element__handle--${pos}`]"
        :style="handleStyle(pos)"
        :data-handle="pos"
        aria-hidden="true"
      />
      <!-- TKT-151: floating delete-X button (top-right outside element).
           Click removes element + pushes history snapshot. -->
      <button
        type="button"
        class="hiprint-element__del-btn"
        @click="deleteElement"
        @mousedown.stop
        @pointerdown.stop
        aria-label="Delete element"
      >✕</button>
      <!-- TKT-151: size readout chip (bottom-right) shown when selected +
           idle. Drag/resize handoff to DragOverlay so we never double-render
           the readout. -->
      <span
        class="hiprint-element__size-box"
        aria-hidden="true"
      >{{ sizeBoxLabel }}</span>
    </template>
  </div>
</template>

<style scoped>
.hiprint-element {
  /* Default cursor — overridden by interact.js resize edges when hovering. */
  cursor: move;
  user-select: none;
}
/* TKT-250 / TKT-251 — selected-state visual. Legacy `.selected` co-emitted by
 * wrapperClass (V1 inventory §1.16). Outline color uses the design token so
 * `.hiprint-theme-v1` and host overrides can swap palette without
 * recompiling the SFC. */
.hiprint-element--selected,
.hiprint-element.selected {
  outline: 1px dashed var(--hiprint-selection-outline, #409eff);
  outline-offset: -1px;
}
/* TKT-027 — locked element visuals.
 * V1 reference: `.hiprint-lock-badge` on `.resize-panel` (inventory §1.9 line
 * 164, per-etype §H.2 line 1010). V3 puts the badge on the wrapper root so it
 * stays visible even when the element is unselected.
 */
.hiprint-element--locked,
.hiprint-element.locked {
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

/* TKT-152 — visible 8-handle dots (V1 inventory interactions.md §1
 * lines 8127-8135: `.resize-panel .resizebtn` 8px square, #409eff blue
 * with white border + slight shadow). V3 uses #1677ff (current accent)
 * and keeps 8px square so the visual matches V1 + the styles.md catalog
 * (§1.17 line 168). pointer-events:none — interact.js owns hit-test on
 * the cardinal edges; the dots are purely visual hints. */
.hiprint-element__handle {
  width: 8px;
  height: 8px;
  background: var(--hiprint-handle-bg, #ffffff);
  border: 1px solid var(--hiprint-handle-border, #1677ff);
  z-index: 3;
  pointer-events: none;
  box-shadow: 0 0 1px rgba(0, 0, 0, 0.25);
}

/* TKT-151 — floating delete-X button (V1 inventory interactions.md §1
 * line 163: `<div class="del-btn">✕</div>` width:16px background:#f56c6c). */
.hiprint-element__del-btn {
  position: absolute;
  top: -22px;
  right: -4px;
  z-index: 4;
  width: 18px;
  height: 18px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--hiprint-danger, #f56c6c);
  color: #ffffff;
  border: none;
  border-radius: 2px;
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
  user-select: none;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
  pointer-events: auto;
}
.hiprint-element__del-btn:hover {
  filter: brightness(0.92);
}

/* TKT-151 — static size readout (V1 inventory interactions.md §1 line 162:
 * `.resize-panel .size-box` background: rgba(64,158,255,0.9); color: white).
 * Shown when selected + idle; DragOverlay shows the live readout while a
 * gesture is in flight. */
.hiprint-element__size-box {
  position: absolute;
  bottom: -16pt;
  right: 0;
  padding: 1pt 4pt;
  background: rgba(22, 119, 255, 0.9);
  color: #ffffff;
  font-size: 9pt;
  font-family: monospace;
  line-height: 1.2;
  white-space: nowrap;
  border-radius: 2pt;
  pointer-events: none;
  user-select: none;
  z-index: 3;
}
</style>
