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
import { computed, reactive, ref, watch } from 'vue'
import {
  Modal as AModal,
  Form,
  Input,
  Select,
} from 'ant-design-vue'
import { safeCall } from '@hiprint-v3/internal'

const AForm = Form
const AFormItem = Form.Item
const AInput = Input
const ATextarea = Input.TextArea
const ASelect = Select
const ASelectOption = Select.Option

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
  /**
   * Sprint 22g wave 3 — TKT-334 dialog-text opts (V1 13371-13375).
   */
  nameLabel?: string
  namePlaceholder?: string
  nameRequiredText?: string
  confirmText?: string
  cancelText?: string
  /**
   * Sprint 22g wave 3 — TKT-333. Unique uid → derives `hp-save-name-<uid>`.
   */
  uid?: string
  /**
   * Sprint 22g wave 3 — TKT-333. External save-failure indicator (renders
   * role="alert" message inside the form).
   */
  errorMessage?: string
}

const props = withDefaults(defineProps<Props>(), {
  open: false,
  initialValue: () => ({}),
  categoryOptions: () => [],
  saving: false,
  title: '保存模板',
  width: 500,
  nameLabel: '模板名称',
  namePlaceholder: '请输入模板名称',
  nameRequiredText: '请输入模板名称',
  confirmText: '保存',
  cancelText: '取消',
  uid: '',
  errorMessage: '',
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
    nameError.value = props.nameRequiredText || '请输入模板名称'
    return false
  }
  if (trimmed.length > 64) {
    nameError.value = '名称不能超过 64 个字符'
    return false
  }
  nameError.value = ''
  return true
}

// Sprint 22g wave 3 — TKT-333 deterministic ARIA id for the name input.
const nameInputId = computed<string>(
  () => 'hp-save-name-' + (props.uid || 'default')
)

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
  <AModal
    :open="open"
    :width="width"
    :mask-closable="!saving"
    :closable="!saving"
    :confirm-loading="saving"
    :ok-button-props="{ disabled: saving }"
    :ok-text="confirmText"
    :cancel-text="cancelText"
    :aria-busy="saving"
    class="hiprint-save-dialog hiprint-toolbar-save"
    wrap-class-name="hiprint-toolbar-save-dialog-wrap hiprint-toolbar-save-wrap"
    mask-class-name="hiprint-toolbar-save-mask"
    @update:open="handleOpenChange"
    @ok="onSubmit"
    @cancel="onCancel"
  >
    <!--
      TKT-415 — surface V1 dialog title vocabulary on the projected slot
      node. `hiprint-toolbar-save-title` is the V1 namespaced selector;
      `hiprint-toolbar-template-title` is the shared family selector V1 E2E
      suites use to reach any "toolbar dialog" title regardless of variant.
    -->
    <template #title>
      <span
        class="hiprint-save-dialog__title hiprint-toolbar-save-title hiprint-toolbar-template-title"
      >{{ title }}</span>
    </template>
    <AForm layout="vertical" class="hiprint-save-dialog__form">
      <AFormItem
        :label="nameLabel"
        required
        :validate-status="nameError ? 'error' : ''"
        :help="nameError || undefined"
      >
        <AInput
          :id="nameInputId"
          v-model:value="formState.name"
          :placeholder="namePlaceholder"
          :maxlength="64"
          class="hiprint-save-dialog__name"
          @blur="validateName"
        />
      </AFormItem>
      <!-- TKT-333 — external save error surface (role=alert for AT announcement). -->
      <div
        v-if="errorMessage"
        class="hiprint-save-dialog__error"
        role="alert"
      >{{ errorMessage }}</div>

      <AFormItem label="分类">
        <ASelect
          v-if="categoryOptions.length > 0"
          v-model:value="formState.category"
          placeholder="请选择分类"
          allow-clear
          class="hiprint-save-dialog__category"
        >
          <ASelectOption
            v-for="cat in categoryOptions"
            :key="cat"
            :value="cat"
          >{{ cat }}</ASelectOption>
        </ASelect>
        <AInput
          v-else
          v-model:value="formState.category"
          placeholder="请输入分类（可选）"
          class="hiprint-save-dialog__category"
        />
      </AFormItem>

      <AFormItem label="标签">
        <ASelect
          v-model:value="formState.tags"
          mode="tags"
          placeholder="按回车添加标签"
          class="hiprint-save-dialog__tags"
        />
      </AFormItem>

      <AFormItem label="描述">
        <ATextarea
          v-model:value="formState.description"
          placeholder="可选描述"
          :rows="3"
          :maxlength="500"
          show-count
          class="hiprint-save-dialog__description"
        />
      </AFormItem>
    </AForm>
  </AModal>
</template>

<style scoped>
.hiprint-save-dialog__form {
  padding: 8px 0;
}

.hiprint-save-dialog__error {
  color: #f5222d;
  font-size: 12px;
  margin-top: -4px;
  margin-bottom: 8px;
}
</style>
