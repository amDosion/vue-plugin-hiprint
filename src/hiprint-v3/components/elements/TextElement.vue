<script setup lang="ts">
/**
 * TextElement.vue — V3 text etype (P17.1).
 *
 * Renders the title-prefixed value via Vue interpolation `{{ }}`, which is
 * automatically HTML-escaped by Vue's compiler. This satisfies Invariant #1
 * (.textContent default, no innerHTML with user data) without any manual
 * escapeHtml call.
 *
 * V2 reference: `render.ts` renderTextElement (function body line 218-244)
 * — same logic, but Vue handles the DOM mutation reactively.
 *
 * Features:
 *  - Title prefix (options.title + separator + value).
 *  - hideTitle option suppresses the title.
 *  - Optional inline edit: double-click → temporary `<input>` that commits to
 *    canvas.updateElement on blur or Enter. This is a designer-only convenience
 *    (matches V2 designer's `.hiprint-printElement-text-content` dblclick edit).
 *  - When `options.formatter` is a function, the formatter output is rendered
 *    via `v-html` (Invariant #2: by-design HTML; business owns escaping).
 */
import { computed, nextTick, ref } from 'vue'
import { useCanvasStore } from '@hiprint-v3/stores'
import ElementWrapper from './ElementWrapper.vue'
import {
  computeDisplayText,
  getElementValue,
  isTrue,
  type Opts,
} from './_helpers'
import { coerceText } from '@hiprint-v3/internal'

const props = withDefaults(
  defineProps<{
    elementId: string
    panelId: string
    /** Bound business data — used by field resolution. */
    data?: Record<string, unknown>
    /** Designer mode enables dblclick inline edit. Default false (preview). */
    editable?: boolean
    interactive?: boolean
  }>(),
  { editable: false, interactive: true }
)

const canvas = useCanvasStore()

const element = computed(() => {
  for (const panel of canvas.panels) {
    const el = panel.printElements.find((e) => e.id === props.elementId)
    if (el) return el
  }
  return null
})

const displayText = computed(() => computeDisplayText(element.value, props.data))

/**
 * Formatter output — by-design HTML (Invariant #2). Returns `null` when no
 * formatter is configured, so the template falls back to text interpolation.
 */
const formatterHtml = computed<string | null>(() => {
  const el = element.value
  if (!el) return null
  const opts = el.options as Opts
  const formatter = opts.formatter
  if (typeof formatter !== 'function') return null
  try {
    const title = coerceText(opts.title)
    const value = getElementValue(el, props.data)
    const out = (formatter as (...a: unknown[]) => unknown)(
      title,
      value,
      opts,
      props.data
    )
    return out == null ? '' : String(out)
  } catch (err) {
    console.warn('[hiprint-v3:TextElement] formatter threw:', err)
    return ''
  }
})

// ----- Inline edit (designer only) -----

const isEditing = ref(false)
const draftValue = ref('')
const inputEl = ref<HTMLInputElement | null>(null)

function startEdit(): void {
  if (!props.editable || !element.value) return
  const opts = element.value.options as Opts
  // Title editing is more common than value editing in V1. To keep semantics
  // explicit, we edit options.title when hideTitle=false; otherwise edit the
  // raw `options.testData` (design-time value).
  if (!isTrue(opts.hideTitle) && typeof opts.title === 'string') {
    draftValue.value = String(opts.title ?? '')
  } else {
    draftValue.value = String(opts.testData ?? '')
  }
  isEditing.value = true
  nextTick(() => {
    inputEl.value?.focus()
    inputEl.value?.select()
  })
}

function commitEdit(): void {
  if (!isEditing.value || !element.value) {
    isEditing.value = false
    return
  }
  const opts = element.value.options as Opts
  const patch: Opts =
    !isTrue(opts.hideTitle) && typeof opts.title === 'string'
      ? { title: draftValue.value }
      : { testData: draftValue.value }
  canvas.updateElement(props.panelId, props.elementId, { options: patch })
  isEditing.value = false
}

function cancelEdit(): void {
  isEditing.value = false
}
</script>

<template>
  <ElementWrapper
    :element-id="elementId"
    :panel-id="panelId"
    :interactive="interactive"
  >
    <template #default>
      <div
        class="hiprint-printElement-text-content"
        style="height: 100%; width: 100%"
        @dblclick="startEdit"
      >
        <!-- Inline edit (designer mode) -->
        <input
          v-if="isEditing"
          ref="inputEl"
          v-model="draftValue"
          class="hiprint-text-inline-edit"
          @blur="commitEdit"
          @keydown.enter.prevent="commitEdit"
          @keydown.esc.prevent="cancelEdit"
        />
        <!-- Formatter output (by-design HTML, Invariant #2) -->
        <!-- eslint-disable-next-line vue/no-v-html -->
        <span v-else-if="formatterHtml !== null" v-html="formatterHtml" />
        <!-- Default text interpolation (XSS-safe, Invariant #1) -->
        <template v-else>{{ displayText }}</template>
      </div>
    </template>
  </ElementWrapper>
</template>

<style scoped>
.hiprint-text-inline-edit {
  width: 100%;
  height: 100%;
  border: 1px solid #409eff;
  outline: none;
  padding: 0 2px;
  font: inherit;
  color: inherit;
  background: white;
  box-sizing: border-box;
}
</style>
