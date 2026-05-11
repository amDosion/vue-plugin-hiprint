<script setup lang="ts">
/**
 * BusinessDialog.vue — V3 reactive business-scenario picker (P21.8).
 *
 * Pure Vue 3 reactive SFC. Parent owns visibility via v-model:open. No
 * imperative open/close methods exposed.
 *
 * Replaces V1's imperative `openBusinessDialog(provider)` callback pattern. In
 * V3, business code passes resolved `items` (and optional `categories` for
 * grouping) and listens for `select` / `refresh` emits.
 *
 * Locked invariants:
 *   #8: every user-input emit is wrapped via safeCall (try/catch isolation).
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

const AInputSearch = Input.Search
const ACardMeta = Card.Meta
const ACard = Card

// ============ Public types ============

export interface BusinessItem {
  id: string | number
  name: string
  category?: string
  icon?: string
  data?: unknown
}

interface BusinessGroup {
  category: string
  items: readonly BusinessItem[]
}

// ============ Props / Emits ============

interface Props {
  /** v-model:open — controls visibility. */
  open: boolean
  /** Items to render. */
  items?: readonly BusinessItem[]
  /** Optional category whitelist + ordering. When provided, items are grouped. */
  categories?: readonly string[]
  /** Loading state during async resolution. */
  loading?: boolean
  /** Modal title. Default 业务场景选择. */
  title?: string
  /** Modal width in px. Default 700. */
  width?: number
}

const props = withDefaults(defineProps<Props>(), {
  open: false,
  items: () => [],
  categories: () => [],
  loading: false,
  title: '业务场景选择',
  width: 700,
})

const emit = defineEmits<{
  'update:open': [open: boolean]
  /** User picked a business scenario. */
  select: [item: BusinessItem]
  /** User clicked refresh. */
  refresh: []
  /** Closed without selection. */
  cancel: []
}>()

// ============ Local state ============

const searchQuery = ref('')

const matchesQuery = (item: BusinessItem): boolean => {
  if (!searchQuery.value) return true
  const q = searchQuery.value.toLowerCase()
  const nameMatch = item.name?.toLowerCase().includes(q) ?? false
  const catMatch = item.category?.toLowerCase().includes(q) ?? false
  return nameMatch || catMatch
}

const filteredItems = computed(() => props.items.filter(matchesQuery))

/** When `categories` prop provided, group items by category in given order. */
const groupedItems = computed<readonly BusinessGroup[] | null>(() => {
  if (!props.categories || props.categories.length === 0) return null
  const groups: BusinessGroup[] = []
  for (const cat of props.categories) {
    const inCat = filteredItems.value.filter((it) => it.category === cat)
    if (inCat.length > 0) {
      groups.push({ category: cat, items: inCat })
    }
  }
  // Items without a category in the whitelist → bucket "其他".
  const others = filteredItems.value.filter(
    (it) => !it.category || !props.categories.includes(it.category)
  )
  if (others.length > 0) {
    groups.push({ category: '其他', items: others })
  }
  return groups
})

// ============ Handlers ============

function handleOpenChange(v: boolean): void {
  emit('update:open', v)
  if (!v) {
    safeCall(() => emit('cancel'), [], 'BusinessDialog.onCancel')
  }
}

function close(): void {
  emit('update:open', false)
  safeCall(() => emit('cancel'), [], 'BusinessDialog.onCancel')
}

function pickItem(item: BusinessItem): void {
  safeCall(() => emit('select', item), [], 'BusinessDialog.onSelect')
  emit('update:open', false)
}

function onRefresh(): void {
  safeCall(() => emit('refresh'), [], 'BusinessDialog.onRefresh')
}
</script>

<template>
  <AModal
    :open="open"
    :title="title"
    :width="width"
    :footer="null"
    :mask-closable="true"
    class="hiprint-business-dialog"
    @update:open="handleOpenChange"
    @cancel="close"
  >
    <div class="hiprint-business-dialog__body">
      <div class="hiprint-business-dialog__header">
        <AInputSearch
          v-model:value="searchQuery"
          placeholder="搜索业务场景..."
          allow-clear
          style="max-width: 320px"
          class="hiprint-business-dialog__search"
        />
        <AButton :loading="loading" @click="onRefresh">刷新</AButton>
      </div>

      <ASpin :spinning="loading">
        <div
          v-if="filteredItems.length === 0"
          class="hiprint-business-dialog__empty"
          role="status"
        >
          {{ searchQuery ? '无匹配场景' : '暂无业务场景' }}
        </div>

        <!-- Grouped mode -->
        <div v-else-if="groupedItems" class="hiprint-business-dialog__groups">
          <div
            v-for="group in groupedItems"
            :key="group.category"
            class="hiprint-business-dialog__group"
          >
            <h4 class="hiprint-business-dialog__group-title">{{ group.category }}</h4>
            <AList :data-source="group.items" :grid="{ gutter: 12, column: 4 }">
              <template #renderItem="{ item }">
                <AListItem>
                  <ACard
                    hoverable
                    :body-style="{ padding: '12px' }"
                    class="hiprint-business-dialog__card"
                    @click="pickItem(item as BusinessItem)"
                  >
                    <ACardMeta :title="(item as BusinessItem).name" />
                  </ACard>
                </AListItem>
              </template>
            </AList>
          </div>
        </div>

        <!-- Flat mode -->
        <AList
          v-else
          :data-source="filteredItems"
          :grid="{ gutter: 12, column: 4 }"
          class="hiprint-business-dialog__list"
        >
          <template #renderItem="{ item }">
            <AListItem>
              <ACard
                hoverable
                :body-style="{ padding: '12px' }"
                class="hiprint-business-dialog__card"
                @click="pickItem(item as BusinessItem)"
              >
                <ACardMeta
                  :title="(item as BusinessItem).name"
                  :description="(item as BusinessItem).category"
                />
              </ACard>
            </AListItem>
          </template>
        </AList>
      </ASpin>
    </div>
  </AModal>
</template>

<style scoped>
.hiprint-business-dialog__body {
  min-height: 200px;
}

.hiprint-business-dialog__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.hiprint-business-dialog__empty {
  text-align: center;
  padding: 48px 0;
  color: rgba(0, 0, 0, 0.45);
}

.hiprint-business-dialog__group {
  margin-bottom: 24px;
}

.hiprint-business-dialog__group-title {
  font-size: 14px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.85);
  margin: 0 0 12px 0;
  padding-bottom: 4px;
  border-bottom: 1px solid #f0f0f0;
}
</style>
