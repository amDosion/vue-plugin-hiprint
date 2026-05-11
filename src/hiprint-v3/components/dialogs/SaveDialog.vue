<script setup lang="ts">
/**
 * SaveDialog.vue — V3 reactive save-template form (P21.8).
 *
 * Pure Vue 3 reactive SFC. Parent owns visibility via v-model:open. No
 * imperative open/close methods exposed.
 *
 * Replaces V1's imperative `openSaveDialog(payload, callback)` callback pattern.
 * In V3, business code passes `initialValue` to prefill and listens for
 * `submit` (validated payload) / `cancel` emits.
 *
 * Form validation:
 *   - `name` required, ≤ 64 chars
 *   - other fields optional
 *
 * Locked invariants:
 *   #8: every user-input emit is wrapped via safeCall.
 */
import { reactive, ref, watch } from 'vue'
import { safeCall } from '@hiprint-v3/internal'

// ============ Public types ============

export interface SaveDialogPayload {
  name: string
  category?: string
  tags?: string[]
  description?: string
}

// ============ Props / Emits ============

interface Props {
  /** v-model:open — controls visibility. */
  open: boolean
  /** Pre-fill from existing template (edit mode). */
  initialValue?: Partial<SaveDialogPayload>
  /** Categories dropdown options. */
  categoryOptions?: readonly string[]
  /** Show submitting spinner + disable submit button. */
  saving?: boolean
  /** Modal title. Default 保存模板. */
  title?: string
  /** Modal width in px. Default 500. */
  width?: number
}

const props = withDefaults(defineProps<Props>(), {
  open: false,
  initialValue: () => ({}),
  categoryOptions: () => [],
  saving: false,
  title: '保存模板',
  width: 500,
})

const emit = defineEmits<{
  'update:open': [open: boolean]
  /** User clicked OK and form is valid — emit payload. */
  submit: [payload: SaveDialogPayload]
  /** User clicked Cancel / X / mask. */
  cancel: []
}>()

// ============ Form state ============

interface FormState {
  name: string
  category: string
  tags: string[]
  description: string
}

const initialFormState = (): FormState => ({
  name: props.initialValue?.name ?? '',
  category: props.initialValue?.category ?? '',
  tags: [...(props.initialValue?.tags ?? [])],
  description: props.initialValue?.description ?? '',
})

const formState = reactive<FormState>(initialFormState())
const nameError = ref<string>('')

// Reset form whenever the dialog opens (apply latest initialValue).
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      const next = initialFormState()
      formState.name = next.name
      formState.category = next.category
      formState.tags = next.tags
      formState.description = next.description
      nameError.value = ''
    }
  }
)

// ============ Validation ============

function validateName(): boolean {
  const trimmed = formState.name.trim()
  if (!trimmed) {
    nameError.value = '请输入模板名称'
    return false
  }
  if (trimmed.length > 64) {
    nameError.value = '名称不能超过 64 个字符'
    return false
  }
  nameError.value = ''
  return true
}

// ============ Handlers ============

function handleOpenChange(v: boolean): void {
  emit('update:open', v)
  if (!v) {
    safeCall(() => emit('cancel'), [], 'SaveDialog.onCancel')
  }
}

function onCancel(): void {
  emit('update:open', false)
  safeCall(() => emit('cancel'), [], 'SaveDialog.onCancel')
}

function onSubmit(): void {
  if (!validateName()) return
  const payload: SaveDialogPayload = {
    name: formState.name.trim(),
  }
  if (formState.category) payload.category = formState.category
  if (formState.tags.length > 0) payload.tags = [...formState.tags]
  if (formState.description) payload.description = formState.description
  safeCall(() => emit('submit', payload), [], 'SaveDialog.onSubmit')
  // Parent decides whether to close (e.g. wait for async save).
}
</script>

<template>
  <a-modal
    :open="open"
    :title="title"
    :width="width"
    :mask-closable="!saving"
    :closable="!saving"
    :confirm-loading="saving"
    :ok-button-props="{ disabled: saving }"
    ok-text="保存"
    cancel-text="取消"
    class="hiprint-save-dialog"
    @update:open="handleOpenChange"
    @ok="onSubmit"
    @cancel="onCancel"
  >
    <a-form layout="vertical" class="hiprint-save-dialog__form">
      <a-form-item
        label="模板名称"
        required
        :validate-status="nameError ? 'error' : ''"
        :help="nameError || undefined"
      >
        <a-input
          v-model:value="formState.name"
          placeholder="请输入模板名称"
          :maxlength="64"
          class="hiprint-save-dialog__name"
          @blur="validateName"
        />
      </a-form-item>

      <a-form-item label="分类">
        <a-select
          v-if="categoryOptions.length > 0"
          v-model:value="formState.category"
          placeholder="请选择分类"
          allow-clear
          class="hiprint-save-dialog__category"
        >
          <a-select-option
            v-for="cat in categoryOptions"
            :key="cat"
            :value="cat"
          >{{ cat }}</a-select-option>
        </a-select>
        <a-input
          v-else
          v-model:value="formState.category"
          placeholder="请输入分类（可选）"
          class="hiprint-save-dialog__category"
        />
      </a-form-item>

      <a-form-item label="标签">
        <a-select
          v-model:value="formState.tags"
          mode="tags"
          placeholder="按回车添加标签"
          class="hiprint-save-dialog__tags"
        />
      </a-form-item>

      <a-form-item label="描述">
        <a-textarea
          v-model:value="formState.description"
          placeholder="可选描述"
          :rows="3"
          :maxlength="500"
          show-count
          class="hiprint-save-dialog__description"
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<style scoped>
.hiprint-save-dialog__form {
  padding: 8px 0;
}
</style>
