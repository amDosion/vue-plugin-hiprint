<script setup lang="ts">
/**
 * DragOverlay.vue — TKT-104 cross-hairs + size readout overlay.
 *
 * Rendered as a child of `<ElementWrapper>` ONLY while the element is being
 * dragged or resized. Provides two visual aids V1 ships in `bundle.js`:
 *
 *  1. Cross-hairs — two dashed lines extending from the element edges back to
 *     the panel origin (X axis: line from element.left to 0; Y axis: line from
 *     element.top to 0). Helps the user judge alignment against the rulers.
 *
 *  2. Size readout — a floating chip near the cursor showing the current
 *     `X / Y / W / H` values in mm (matching the property panel + ruler).
 *
 * Visibility:
 *  - When `mode === 'idle'` the component renders nothing (display:none on
 *    the root). `v-if` would unmount/remount on every gesture, churning the
 *    DOM; `display:none` keeps it instant.
 *  - Parent (ElementWrapper) flips mode to 'drag' on drag-start, 'resize' on
 *    resize-start, back to 'idle' on end. Cross-hairs render in both active
 *    modes; size readout text changes label ('X/Y' during drag, 'W/H' during
 *    resize) to match V1 behavior.
 *
 * Units:
 *  - Internal coords are pt (matches store options.{left,top,width,height}).
 *  - Display label shows mm (matches ruler + property panel).
 *  - 1 mm = 72/25.4 ≈ 2.835 pt.
 *
 * Positioning:
 *  - Cross-hair lines are positioned relative to the parent ElementWrapper
 *    (which is absolutely positioned inside the paper). The lines extend
 *    LEFT and UP from element edges back to the paper origin. We compute
 *    negative offsets so they project outside the wrapper bounds.
 *  - Size readout is fixed in viewport coords (top-right corner of the
 *    wrapper) so it stays readable regardless of where the element sits.
 *
 * Pointer events:
 *  - All overlay nodes set `pointer-events: none` so they don't intercept
 *    the in-flight drag/resize gesture from interact.js.
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Element left in pt. */
    left: number
    /** Element top in pt. */
    top: number
    /** Element width in pt. */
    width: number
    /** Element height in pt. */
    height: number
    /** Overlay mode — controls visibility + label. */
    mode: 'idle' | 'drag' | 'resize'
  }>(),
  { mode: 'idle' }
)

const PT_PER_MM = 72 / 25.4 // ≈ 2.8346

/** Round-to-1-decimal mm string for label display. */
function ptToMmLabel(pt: number): string {
  const mm = pt / PT_PER_MM
  return (Math.round(mm * 10) / 10).toFixed(1)
}

/** Show overlay only when actively dragging/resizing. */
const visible = computed(() => props.mode !== 'idle')

/**
 * Cross-hair lines. We need TWO lines:
 *  - Horizontal "position line": from x=0 of the paper (negative offset
 *    relative to wrapper origin) to x=0 of the wrapper (left edge). Drawn at
 *    y = top/2 of element so it looks anchored to the element vertical center.
 *  - Vertical "position line": from y=0 of the paper to y=0 of the wrapper
 *    top, drawn at x = width/2.
 *
 * In CSS-relative-to-wrapper-origin terms:
 *  - The wrapper itself starts at (props.left, props.top) in paper-pt.
 *  - A child positioned at (-props.left, 0) extends back to paper x=0.
 *  - A child positioned at (0, -props.top) extends back to paper y=0.
 *
 * We set `width: ${left}pt` on the horizontal line so it stops AT the
 * wrapper edge (and similarly for vertical).
 */
const horizontalLineStyle = computed<Record<string, string>>(() => ({
  position: 'absolute',
  left: `${-props.left}pt`,
  top: `${props.height / 2}pt`,
  width: `${props.left}pt`,
  height: '0',
  borderTop: '1px dashed #1677ff',
  pointerEvents: 'none',
  zIndex: '3',
}))

const verticalLineStyle = computed<Record<string, string>>(() => ({
  position: 'absolute',
  left: `${props.width / 2}pt`,
  top: `${-props.top}pt`,
  width: '0',
  height: `${props.top}pt`,
  borderLeft: '1px dashed #1677ff',
  pointerEvents: 'none',
  zIndex: '3',
}))

/** Label text — drag shows X/Y, resize shows W/H + X/Y (V1 parity). */
const readoutLabel = computed<string>(() => {
  const x = ptToMmLabel(props.left)
  const y = ptToMmLabel(props.top)
  if (props.mode === 'resize') {
    const w = ptToMmLabel(props.width)
    const h = ptToMmLabel(props.height)
    return `${x},${y}  ${w}×${h} mm`
  }
  return `${x},${y} mm`
})
</script>

<template>
  <!-- TKT-104: v-if (not v-show) so the readout chip's textContent does not
       leak into parent .text() queries when idle. Mount/unmount per gesture
       is cheap (one render cycle) and worth it for clean isolation. -->
  <div
    v-if="visible"
    class="hiprint-drag-overlay"
    :class="`hiprint-drag-overlay--${mode}`"
    aria-hidden="true"
  >
    <!-- Cross-hairs back to paper origin. -->
    <div class="hiprint-position-line hiprint-position-line--h" :style="horizontalLineStyle" />
    <div class="hiprint-position-line hiprint-position-line--v" :style="verticalLineStyle" />
    <!-- Size readout chip (top-right). -->
    <div class="hiprint-size-readout">{{ readoutLabel }}</div>
  </div>
</template>

<style scoped>
.hiprint-drag-overlay {
  /* The overlay root has no size itself — children position absolutely
     relative to the parent ElementWrapper, which is the absolutely-positioned
     element on the paper. */
  position: absolute;
  inset: 0;
  pointer-events: none;
  /* Sit above element content but below the lock badge. */
  z-index: 2;
}
.hiprint-size-readout {
  position: absolute;
  top: -18pt;
  right: 0;
  padding: 1pt 4pt;
  background: rgba(22, 119, 255, 0.92);
  color: white;
  font-size: 9pt;
  font-family: monospace;
  line-height: 1.2;
  white-space: nowrap;
  border-radius: 2pt;
  pointer-events: none;
  user-select: none;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
}
</style>
