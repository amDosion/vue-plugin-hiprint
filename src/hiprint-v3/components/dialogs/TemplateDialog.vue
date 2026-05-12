<script setup lang="ts">
/**
 * TemplateDialog.vue — V3 reactive template-selection dialog (P21.8).
 *
 * Pure Vue 3 reactive SFC. Parent owns visibility via v-model:open. No
 * imperative open/close methods exposed.
 *
 * Replaces V1's imperative `openTemplateDialog(provider)` callback pattern. In
 * V3, business code passes resolved `items` as a prop and listens for `select`
 * / `edit` / `delete` / `refresh` emits.
 *
 * Locked invariants:
 *   #8: every user-input emit is wrapped via safeCall (try/catch isolation).
 *
 * Accessibility:
 *   - Uses ant-design-vue Modal (built-in role="dialog" + focus trap).
 *   - Search input has accessible placeholder.
 *   - Empty-state message announced in-flow.
 */
import { computed, ref } from 'vue'
import {
  Modal as AModal,
  Button as AButton,
  Input,
  List as AList,
  ListItem as AListItem,
  Card,
  Spin as ASpin,
} from 'ant-design-vue'
import { safeCall } from '@hiprint-v3/internal'
import type { TemplateJson } from '@hiprint-v3/schemas'

const AInputSearch = Input.Search
const ACardMeta = Card.Meta
const ACard = Card

// ============ Public types ============

export interface TemplateItem {
  id: string | number
  name: string
  thumbnail?: string
  data?: TemplateJson
  category?: string
  updatedAt?: string
}

// ============ Props / Emits ============

interface Props {
  /** v-model:open — controls visibility. V3 reactive: parent owns state. */
  open: boolean
  /** Items to render. Parent passes the resolved list (no provider callbacks). */
  items?: readonly TemplateItem[]
  /** Loading state during async resolution. */
  loading?: boolean
  /** Modal title. Default 模板选择. */
  title?: string
  /** Show preview thumbnail. Default true. */
  showPreview?: boolean
  /** Show edit/delete actions per row. Default false (business code wires). */
  allowEdit?: boolean
  allowDelete?: boolean
  /** Modal width in px. Default 800. */
  width?: number
}

const props = withDefaults(defineProps<Props>(), {
  open: false,
  items: () => [],
  loading: false,
  title: '模板选择',
  showPreview: true,
  allowEdit: false,
  allowDelete: false,
  width: 800,
})

const emit = defineEmits<{
  'update:open': [open: boolean]
  /** User selected a template — emit item + close. */
  select: [item: TemplateItem]
  /** User clicked edit on a row — parent handles edit UI. */
  edit: [item: TemplateItem]
  /** User clicked delete on a row. */
  delete: [item: TemplateItem]
  /** User clicked refresh — parent re-loads items. */
  refresh: []
  /** Modal closed without selection. */
  cancel: []
}>()

// ============ Local state ============

const searchQuery = ref('')

const filteredItems = computed(() => {
  if (!searchQuery.value) return props.items
  const q = searchQuery.value.toLowerCase()
  return props.items.filter((item) => {
    const nameMatch = item.name?.toLowerCase().includes(q) ?? false
    const catMatch = item.category?.toLowerCase().includes(q) ?? false
    return nameMatch || catMatch
  })
})

// ============ Handlers (all safeCall-wrapped) ============

function close(): void {
  emit('update:open', false)
  safeCall(() => emit('cancel'), [], 'TemplateDialog.onCancel')
}

function handleOpenChange(v: boolean): void {
  emit('update:open', v)
  if (!v) {
    safeCall(() => emit('cancel'), [], 'TemplateDialog.onCancel')
  }
}

function pickItem(item: TemplateItem): void {
  safeCall(() => emit('select', item), [], 'TemplateDialog.onSelect')
  emit('update:open', false)
}

function onEdit(item: TemplateItem, e?: Event): void {
  e?.stopPropagation()
  safeCall(() => emit('edit', item), [], 'TemplateDialog.onEdit')
}

function onDelete(item: TemplateItem, e?: Event): void {
  e?.stopPropagation()
  safeCall(() => emit('delete', item), [], 'TemplateDialog.onDelete')
}

function onRefresh(): void {
  safeCall(() => emit('refresh'), [], 'TemplateDialog.onRefresh')
}
</script>

<template>
  <AModal
    :open="open"
    :title="title"
    :width="width"
    :footer="null"
    :mask-closable="true"
    class="hiprint-template-dialog"
    wrap-class-name="hiprint-toolbar-template-dialog-wrap"
    @update:open="handleOpenChange"
    @cancel="close"
  >
    <div class="hiprint-template-dialog__body">
      <div class="hiprint-template-dialog__header">
        <AInputSearch
          v-model:value="searchQuery"
          placeholder="搜索模板..."
          allow-clear
          style="max-width: 320px"
          class="hiprint-template-dialog__search"
        />
        <AButton :loading="loading" @click="onRefresh">刷新</AButton>
      </div>

      <ASpin :spinning="loading">
        <div
          v-if="filteredItems.length === 0"
          class="hiprint-template-dialog__empty"
          role="status"
        >
          {{ searchQuery ? '无匹配模板' : '暂无模板' }}
        </div>

        <AList
          v-else
          :data-source="filteredItems"
          :grid="{ gutter: 16, column: showPreview ? 3 : 1 }"
          class="hiprint-template-dialog__list"
        >
          <template #renderItem="{ item }">
            <AListItem>
              <ACard
                hoverable
                :body-style="{ padding: '12px' }"
                class="hiprint-template-dialog__card"
                @click="pickItem(item as TemplateItem)"
              >
                <template v-if="showPreview" #cover>
                  <img
                    v-if="(item as TemplateItem).thumbnail"
                    :src="(item as TemplateItem).thumbnail"
                    :alt="(item as TemplateItem).name"
                  />
                  <div v-else class="hiprint-template-dialog__no-thumb">
                    无预览
                  </div>
                </template>
                <ACardMeta
                  :title="(item as TemplateItem).name"
                  :description="(item as TemplateItem).category"
                />
                <template v-if="allowEdit || allowDelete" #actions>
                  <a
                    v-if="allowEdit"
                    class="hiprint-template-dialog__edit"
                    @click="onEdit(item as TemplateItem, $event)"
                  >编辑</a>
                  <a
                    v-if="allowDelete"
                    class="hiprint-template-dialog__delete"
                    style="color: #f5222d"
                    @click="onDelete(item as TemplateItem, $event)"
                  >删除</a>
                </template>
              </ACard>
            </AListItem>
          </template>
        </AList>
      </ASpin>
    </div>
  </AModal>
</template>

<style scoped>
.hiprint-template-dialog__body {
  min-height: 200px;
}

.hiprint-template-dialog__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.hiprint-template-dialog__empty {
  text-align: center;
  padding: 48px 0;
  color: rgba(0, 0, 0, 0.45);
}

.hiprint-template-dialog__no-thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 120px;
  background: #fafafa;
  color: rgba(0, 0, 0, 0.25);
  font-size: 14px;
}
</style>
