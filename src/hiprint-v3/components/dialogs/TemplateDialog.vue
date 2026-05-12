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
  /**
   * Sprint 22g wave 3 — TKT-336. Show per-card "预览" preview action.
   * Default false (opt-in). When true emits `preview` on click.
   */
  allowPreview?: boolean
  /** Modal width in px. Default 800. */
  width?: number
  /** Sprint 22g wave 3 — TKT-334 dialog-text opts (V1 13377-13379). */
  emptyText?: string
  loadingText?: string
  errorText?: string
}

const props = withDefaults(defineProps<Props>(), {
  open: false,
  items: () => [],
  loading: false,
  title: '模板选择',
  showPreview: true,
  allowEdit: false,
  allowDelete: false,
  allowPreview: false,
  width: 800,
  emptyText: '暂无模板',
  loadingText: '加载中...',
  errorText: '模板加载失败',
})

const emit = defineEmits<{
  'update:open': [open: boolean]
  /**
   * User selected a template.
   * Sprint 22g wave 3 TKT-337 — V1 4-arg signature `(item, json, template, api)`.
   * `json` defaults to `item.data` when present; `template`/`api` left
   * undefined (parent business code injects when wrapping the emit).
   */
  select: [
    item: TemplateItem,
    json?: TemplateJson,
    template?: unknown,
    api?: unknown,
  ]
  /** User clicked edit on a row — parent handles edit UI. */
  edit: [item: TemplateItem]
  /**
   * User clicked delete on a row.
   * TKT-337 — V1 4-arg signature for parity with `onTemplateDelete`.
   */
  delete: [
    item: TemplateItem,
    json?: TemplateJson,
    template?: unknown,
    api?: unknown,
  ]
  /**
   * TKT-336 — preview action emit. Parent typically opens a preview window.
   */
  preview: [item: TemplateItem]
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
  // TKT-337 — V1 4-arg signature `(item, json, template, api)`. Parent
  // business code typically wraps to inject template/api on the way through.
  safeCall(
    () => emit('select', item, item.data, undefined, undefined),
    [],
    'TemplateDialog.onSelect'
  )
  emit('update:open', false)
}

function onEdit(item: TemplateItem, e?: Event): void {
  e?.stopPropagation()
  safeCall(() => emit('edit', item), [], 'TemplateDialog.onEdit')
}

function onDelete(item: TemplateItem, e?: Event): void {
  e?.stopPropagation()
  safeCall(
    () => emit('delete', item, item.data, undefined, undefined),
    [],
    'TemplateDialog.onDelete'
  )
}

/**
 * TKT-336 — preview action handler. Stops propagation so the card click
 * doesn't fire `select` as well.
 */
function onPreview(item: TemplateItem, e?: Event): void {
  e?.stopPropagation()
  safeCall(() => emit('preview', item), [], 'TemplateDialog.onPreview')
}

function onRefresh(): void {
  safeCall(() => emit('refresh'), [], 'TemplateDialog.onRefresh')
}
</script>

<template>
  <AModal
    :open="open"
    :width="width"
    :footer="null"
    :mask-closable="true"
    class="hiprint-template-dialog hiprint-toolbar-template"
    wrap-class-name="hiprint-toolbar-template-dialog-wrap hiprint-toolbar-template-wrap"
    mask-class-name="hiprint-toolbar-template-mask"
    @update:open="handleOpenChange"
    @cancel="close"
  >
    <!--
      TKT-415 — surface V1 dialog title vocabulary
      (`.hiprint-toolbar-template-title`). AntDesignVue's `:title` renders
      inside `.ant-modal-title`; using the named slot lets us hang the V1
      legacy class onto a reliable DOM node so E2E suites keyed to V1
      selectors keep matching.
    -->
    <template #title>
      <span
        class="hiprint-template-dialog__title hiprint-toolbar-template-title"
      >{{ title }}</span>
    </template>
    <div
      class="hiprint-template-dialog__body hiprint-toolbar-template-body"
      :class="{
        'is-loading': loading,
        loading: loading,
        'is-empty': !loading && filteredItems.length === 0,
        empty: !loading && filteredItems.length === 0,
      }"
    >
      <div class="hiprint-template-dialog__header hiprint-toolbar-template-header">
        <AInputSearch
          v-model:value="searchQuery"
          placeholder="搜索模板..."
          allow-clear
          style="max-width: 320px"
          class="hiprint-template-dialog__search"
        />
        <AButton :loading="loading" @click="onRefresh">刷新</AButton>
      </div>

      <ASpin :spinning="loading" :tip="loadingText">
        <div
          v-if="filteredItems.length === 0"
          class="hiprint-template-dialog__empty hiprint-toolbar-template-state empty"
          role="status"
        >
          {{ searchQuery ? '无匹配模板' : emptyText }}
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
                <template v-if="allowPreview || allowEdit || allowDelete" #actions>
                  <a
                    v-if="allowPreview"
                    class="hiprint-template-dialog__preview"
                    data-action="preview"
                    @click="onPreview(item as TemplateItem, $event)"
                  >预览</a>
                  <a
                    v-if="allowEdit"
                    class="hiprint-template-dialog__edit"
                    data-action="edit"
                    @click="onEdit(item as TemplateItem, $event)"
                  >编辑</a>
                  <a
                    v-if="allowDelete"
                    class="hiprint-template-dialog__delete"
                    style="color: #f5222d"
                    data-action="delete"
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
