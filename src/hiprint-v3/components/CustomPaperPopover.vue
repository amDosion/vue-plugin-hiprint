<script setup lang="ts">
/**
 * CustomPaperPopover.vue — TB-004 custom paper size popover (V3, Sprint 22a).
 *
 * Renders a small absolute-positioned popover with two number inputs (width +
 * height in millimetres) and Cancel/Apply actions. Parent (HiprintToolbar)
 * owns `open` state and converts the emitted mm payload into pt before
 * calling `canvas.updatePanel`.
 *
 * Conversion is intentionally mm-only here — units conversion lives at the
 * call-site (toolbar) so this SFC stays a pure dumb popover that any host
 * could re-use.
 *
 * `initialWidth` / `initialHeight` are in pt (matches `Panel.width/height`).
 * When `open` flips true we convert pt → mm and prefill the inputs so the
 * popover reflects the active panel's current dimensions.
 */
import { ref, watch } from 'vue'

interface Props {
  open: boolean
  /** Initial width in pt (Panel.width). Converted to mm for display. */
  initialWidth?: number
  /** Initial height in pt (Panel.height). Converted to mm for display. */
  initialHeight?: number
}

const props = withDefaults(defineProps<Props>(), {
  open: false,
  initialWidth: undefined,
  initialHeight: undefined,
})

const emit = defineEmits<{
  (e: 'submit', payload: { width: number; height: number }): void
  (e: 'close'): void
}>()

// A4 defaults — overridden by initialWidth/Height watcher on open.
const w = ref<number>(210)
const h = ref<number>(297)

watch(
  () => [props.initialWidth, props.initialHeight, props.open] as const,
  ([pw, ph, op]) => {
    if (!op) return
    if (typeof pw === 'number' && Number.isFinite(pw) && pw > 0) {
      w.value = Math.round((pw / 72) * 25.4)
    }
    if (typeof ph === 'number' && Number.isFinite(ph) && ph > 0) {
      h.value = Math.round((ph / 72) * 25.4)
    }
  },
  { immediate: true }
)

function submit(): void {
  emit('submit', { width: w.value, height: h.value })
}

function close(): void {
  emit('close')
}
</script>

<template>
  <div
    v-if="open"
    class="hiprint-custom-paper-popover"
    role="dialog"
    aria-label="Custom paper size"
    @click.stop
  >
    <label>
      <span>Width (mm)</span>
      <input
        type="number"
        min="10"
        max="2000"
        :value="w"
        aria-label="Custom paper width millimetres"
        @input="w = Number(($event.target as HTMLInputElement).value)"
      />
    </label>
    <label>
      <span>Height (mm)</span>
      <input
        type="number"
        min="10"
        max="2000"
        :value="h"
        aria-label="Custom paper height millimetres"
        @input="h = Number(($event.target as HTMLInputElement).value)"
      />
    </label>
    <div class="actions">
      <button type="button" @click="close">Cancel</button>
      <button type="button" class="primary" @click="submit">Apply</button>
    </div>
  </div>
</template>

<style scoped>
.hiprint-custom-paper-popover {
  position: absolute;
  top: 36px;
  left: 0;
  z-index: 1000;
  background: #fff;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 200px;
}

.hiprint-custom-paper-popover label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: #666;
}

.hiprint-custom-paper-popover input {
  height: 28px;
  padding: 0 6px;
  border: 1px solid #d9d9d9;
  border-radius: 3px;
  font: inherit;
}

.hiprint-custom-paper-popover input:focus-visible {
  outline: 2px solid #409eff;
  outline-offset: 1px;
}

.hiprint-custom-paper-popover .actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

.hiprint-custom-paper-popover .actions button {
  height: 28px;
  padding: 0 10px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: #fff;
  color: #333;
  cursor: pointer;
  font: inherit;
}

.hiprint-custom-paper-popover .actions button:hover {
  background: #f0f0f0;
}

.hiprint-custom-paper-popover .primary {
  background: #1677ff;
  color: #fff;
  border-color: #1677ff;
}

.hiprint-custom-paper-popover .primary:hover {
  background: #1462d8;
  border-color: #1462d8;
}
</style>
