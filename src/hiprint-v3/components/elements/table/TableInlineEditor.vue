<script setup lang="ts">
/**
 * TableInlineEditor.vue — V3 cell / column inline editor (P17.3).
 *
 * Replaces V2 `etypes/table/inline-editor.js` (TextInlineEditor + SelectInlineEditor +
 * TableColumnInlineEditor — 302 LoC of jQuery DOM mutation) with a self-contained
 * Vue 3 component. Parent (TableCell / table header) toggles this via `v-if`;
 * value commits go back via `@commit` (or `@update:modelValue` two-way).
 *
 * V2 reference:
 *  - V1 bundle.js line 1656-1791 (i / i2 / r / l classes)
 *  - V2 `core/etypes/table/inline-editor.js`
 *
 * Locked invariants (ADR-0011 + V2 R3 B9 + V3 #1):
 *  - Vue `v-model` is bound to a plain `<input>` value — never `v-html`.
 *  - On commit we emit a string, parent uses Vue interpolation `{{ }}` to render
 *    (textContent path). No `.html()` or `innerHTML` injection of user keystroke.
 *  - When `type === 'select'` we render a `<select>` and emit the chosen option
 *    value (or, for column-header field-picker, `"title#field"` per V2 contract).
 *  - Esc cancels (emit 'cancel'); blur and Enter commit.
 *
 * The component auto-focuses on mount so dblclick → edit feels instantaneous.
 */
import { onMounted, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Current value. Two-way binding via `v-model`. */
    modelValue: string
    /**
     * Editor flavor. Default 'text'. TKT-383 (Sprint 22g wave 3):
     *  - `text` — single-line `<input type="text">` (V1 default).
     *  - `select` — native `<select>` driven by `options`.
     *  - `number` — `<input type="number">` (V1 numeric column editor).
     *  - `date` — `<input type="date">` (V1 date column editor; emits
     *    ISO-yyyy-mm-dd string per native control contract).
     *  - `textarea` — multi-line `<textarea>` with Enter-without-shift commit
     *    semantics (V1 long-string column editor; shift+Enter inserts newline).
     */
    type?: 'text' | 'select' | 'number' | 'date' | 'textarea'
    /**
     * Options for `type === 'select'`. Each entry's `value` is what the
     * editor commits; `label` is the user-visible text.
     *
     * For V2 column-header "field-picker" mode, callers may pass
     * `valueIsTitleHashField: true` and supply `value` as `"title#field"`
     * tokens; this component does NOT split the format — it commits the raw
     * value string the parent registered.
     */
    options?: ReadonlyArray<{ value: string; label: string }>
    /** Optional input placeholder. */
    placeholder?: string
    /** Auto-select all on focus. Default true. Matches V2 TextInlineEditor. */
    selectOnFocus?: boolean
    /** Minimum value for `type === 'number'` (passed to native control). */
    min?: number | string
    /** Maximum value for `type === 'number'` (passed to native control). */
    max?: number | string
    /** Step for `type === 'number'` (passed to native control). */
    step?: number | string
  }>(),
  { type: 'text', placeholder: '', selectOnFocus: true }
)

const emit = defineEmits<{
  /** Two-way binding update (per-keystroke for text; on change for select). */
  'update:modelValue': [value: string]
  /** Final commit (blur / Enter / select change). Always followed by `update:modelValue`. */
  commit: [value: string]
  /** User pressed Escape — caller should revert + close. */
  cancel: []
}>()

const inputEl = ref<HTMLInputElement | null>(null)
const selectEl = ref<HTMLSelectElement | null>(null)
const textareaEl = ref<HTMLTextAreaElement | null>(null)

/**
 * Local draft. We mirror props.modelValue at mount so a parent `v-if` toggle
 * always starts the editor with the current value (instead of stale prior
 * mount's value).
 */
const draft = ref<string>(props.modelValue ?? '')

onMounted(() => {
  // Re-sync at mount: parent may pass a fresh modelValue when toggling on.
  draft.value = props.modelValue ?? ''
  // Focus + select. Defer to next microtask so the element is laid out
  // (otherwise focus on a not-yet-attached <input> is a no-op in happy-dom).
  queueMicrotask(() => {
    if (props.type === 'select') {
      selectEl.value?.focus()
    } else if (props.type === 'textarea') {
      textareaEl.value?.focus()
      if (props.selectOnFocus) {
        try {
          textareaEl.value?.select()
        } catch {
          /* happy-dom may not support .select() on detached textarea */
        }
      }
    } else {
      inputEl.value?.focus()
      if (props.selectOnFocus) {
        try {
          inputEl.value?.select()
        } catch {
          /* happy-dom may not support .select() on detached input */
        }
      }
    }
  })
})

function onInput(e: Event): void {
  const t = e.target as HTMLInputElement | HTMLTextAreaElement | null
  if (!t) return
  draft.value = t.value
  emit('update:modelValue', draft.value)
}

function onSelectChange(e: Event): void {
  const t = e.target as HTMLSelectElement | null
  if (!t) return
  draft.value = t.value
  emit('update:modelValue', draft.value)
  // Select commits immediately on change (matches V2 select inline editor).
  emit('commit', draft.value)
}

function commit(): void {
  emit('update:modelValue', draft.value)
  emit('commit', draft.value)
}

function cancel(): void {
  emit('cancel')
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Enter') {
    // TKT-383: textarea allows Shift+Enter for newline insertion; plain Enter
    // commits (V1 long-text editor convention).
    if (props.type === 'textarea' && e.shiftKey) return
    e.preventDefault()
    commit()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    cancel()
  }
}
</script>

<template>
  <!-- type === 'select' renders a native <select>; commit-on-change semantics. -->
  <select
    v-if="type === 'select'"
    ref="selectEl"
    class="hiprint-cell-select"
    :value="draft"
    @change="onSelectChange"
    @blur="commit"
    @keydown="onKeyDown"
  >
    <option
      v-for="opt in options ?? []"
      :key="opt.value"
      :value="opt.value"
    >{{ opt.label }}</option>
  </select>

  <!-- TKT-383: textarea (multi-line). Shift+Enter inserts newline; plain Enter
       commits. Blur commits. -->
  <textarea
    v-else-if="type === 'textarea'"
    ref="textareaEl"
    class="hiprint-cell-editor hiprint-cell-textarea"
    rows="3"
    :value="draft"
    :placeholder="placeholder"
    @input="onInput"
    @blur="commit"
    @keydown="onKeyDown"
  />

  <!-- TKT-383: native number input. Browser-enforced numeric pattern + spinner. -->
  <input
    v-else-if="type === 'number'"
    ref="inputEl"
    type="number"
    class="hiprint-cell-editor hiprint-cell-editor-number"
    :value="draft"
    :placeholder="placeholder"
    :min="min as string | number | undefined"
    :max="max as string | number | undefined"
    :step="step as string | number | undefined"
    @input="onInput"
    @blur="commit"
    @keydown="onKeyDown"
  />

  <!-- TKT-383: native date picker. Commits ISO `yyyy-mm-dd` per HTML spec. -->
  <input
    v-else-if="type === 'date'"
    ref="inputEl"
    type="date"
    class="hiprint-cell-editor hiprint-cell-editor-date"
    :value="draft"
    :placeholder="placeholder"
    @input="onInput"
    @blur="commit"
    @keydown="onKeyDown"
  />

  <!-- Default: single-line <input>. v-model would be fine but explicit @input
       lets us emit both update + commit cleanly. -->
  <input
    v-else
    ref="inputEl"
    type="text"
    class="hiprint-cell-editor"
    :value="draft"
    :placeholder="placeholder"
    @input="onInput"
    @blur="commit"
    @keydown="onKeyDown"
  />
</template>

<style scoped>
.hiprint-cell-editor,
.hiprint-cell-select {
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
.hiprint-cell-textarea {
  resize: vertical;
  min-height: 36px;
}
</style>
