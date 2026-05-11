<script setup lang="ts">
/**
 * HiprintElementList.vue — V3 element palette (P18.2).
 *
 * Replaces V2 `buildElementListPanel` (V1 element-list-panel.js — jQuery UI
 * draggable source list) with a Vue 3 SFC backed by the registry singleton.
 *
 * Per-item buttons act as drag SOURCES via
 * `enableElementListSource(el, { tid, createElement })`. The panel's
 * matching `enablePanelDropZone` (P18.1) consumes them on drop:
 *  - Sidebar items carry `class="hiprint-list-source"` + `data-tid`.
 *  - The factory `createElement` returns the base props to seed the new
 *    canvas element (e.g. test data, default options, printElementType).
 *
 * Click fallback: when a panel is active we also accept plain clicks to add
 * elements at a default position. This preserves V1/V2 UX where users could
 * either drag or click "Add" to insert.
 *
 * Cleanup: each item runs `disableInteractions(el)` on unmount so interact.js
 * doesn't retain references (memory leak guarantee).
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  useCanvasStore,
  useHistoryStore,
} from '@hiprint-v3/stores'
import {
  enableElementListSource,
  disableInteractions,
} from '@hiprint-v3/interactions'
import {
  getInstance as getRegistry,
  type ElementTypeDef,
  type ElementTypeGroupDef,
} from '@hiprint-v3/core'

interface Props {
  /**
   * Module names to surface. Default = all registered modules. Empty array
   * means "no groups" (used in tests / dynamic provider edge cases).
   */
  modules?: readonly string[]
  /**
   * When true (default), clicking an item (without dragging) adds the
   * element to the currently active panel at a default position.
   */
  clickToAdd?: boolean
  /**
   * Default x/y when click-to-add fires (pt). Caller may tune for designer
   * layout. Defaults to (10, 10).
   */
  defaultPosition?: { x: number; y: number }
}

const props = withDefaults(defineProps<Props>(), {
  modules: undefined,
  clickToAdd: true,
  defaultPosition: () => ({ x: 10, y: 10 }),
})

interface Emits {
  /** Fired after an element is added (drag-drop OR click). */
  (e: 'add', payload: { tid: string; panelId: string; elementId: string }): void
}
const emit = defineEmits<Emits>()

// ============ Stores / registry ============

const canvas = useCanvasStore()
const history = useHistoryStore()

/**
 * Reactive registry snapshot. `getInstance()` is HMR-safe but not reactive,
 * so we read its modules into a ref + invalidate via `refresh()`. Business
 * consumers may register new groups dynamically (setDynamicFields) and call
 * the exposed `refresh()` to re-read.
 */
const groupsByModule = ref<{ module: string; groups: readonly ElementTypeGroupDef[] }[]>(
  []
)

function refresh(): void {
  const reg = getRegistry()
  const moduleNames =
    props.modules && props.modules.length > 0
      ? props.modules.slice()
      : reg.getModuleNames().slice()
  const out: { module: string; groups: readonly ElementTypeGroupDef[] }[] = []
  for (const m of moduleNames) {
    const groups = reg.getByModule(m)
    if (groups.length > 0) out.push({ module: m, groups })
  }
  groupsByModule.value = out
}

watch(() => props.modules, refresh, { immediate: false })

// ============ Drag-source registration ============

const listRef = ref<HTMLDivElement | null>(null)
/** Track all item elements we registered, so we can unregister cleanly. */
const registeredItems = ref<Set<HTMLElement>>(new Set())

function buildFactory(type: ElementTypeDef): () => Record<string, unknown> {
  // Returned object is fed to `canvas.addElement(panelId, base)` by the
  // panel dropzone. It MUST carry the tid (already set on the DOM data-tid)
  // plus default options and a printElementType ref so renderers know the
  // etype family.
  return () => {
    const baseOptions: Record<string, unknown> = {
      ...((type.options as Record<string, unknown> | undefined) ?? {}),
    }
    if (type.field && baseOptions.field === undefined) {
      baseOptions.field = type.field
    }
    if (type.title && baseOptions.title === undefined) {
      baseOptions.title = type.title
    }
    if (type.data !== undefined && baseOptions.testData === undefined) {
      baseOptions.testData = type.data
    }
    return {
      tid: type.tid,
      options: baseOptions,
      printElementType: {
        tid: type.tid,
        type: type.type,
        title: type.title,
        field: type.field,
      },
    }
  }
}

function attachItem(el: HTMLElement | null, type: ElementTypeDef): void {
  if (!el) return
  if (registeredItems.value.has(el)) return
  enableElementListSource(el, {
    tid: type.tid,
    createElement: buildFactory(type),
  })
  registeredItems.value.add(el)
}

function detachItem(el: HTMLElement | null): void {
  if (!el) return
  disableInteractions(el)
  registeredItems.value.delete(el)
}

// Re-attach when groups change (registry updates via refresh()).
watch(
  groupsByModule,
  () => {
    // Detach old set.
    const old = Array.from(registeredItems.value)
    for (const el of old) detachItem(el)
    // Wait for Vue to render new buttons, then re-attach via ref callback.
    // Each `.hiprint-element-list-item` carries data-tid; we look them up in
    // a microtask to ensure DOM is committed.
    queueMicrotask(() => {
      if (!listRef.value) return
      const buttons = listRef.value.querySelectorAll<HTMLButtonElement>(
        '.hiprint-element-list-item[data-tid]'
      )
      buttons.forEach((btn) => {
        const tid = btn.getAttribute('data-tid')
        if (!tid) return
        const type = findTypeByTid(tid)
        if (type) attachItem(btn, type)
      })
    })
  },
  { flush: 'post' }
)

function findTypeByTid(tid: string): ElementTypeDef | undefined {
  for (const m of groupsByModule.value) {
    for (const g of m.groups) {
      for (const t of g.printElementTypes ?? []) {
        if (t.tid === tid) return t
      }
    }
  }
  return undefined
}

// ============ Click-to-add fallback ============

function onItemClick(type: ElementTypeDef): void {
  if (!props.clickToAdd) return
  const panelId = canvas.activePanelId
  if (!panelId) {
    console.warn(
      '[hiprint-v3] HiprintElementList: click-to-add ignored (no active panel)'
    )
    return
  }
  const factory = buildFactory(type)
  const base = factory()
  const baseOpts =
    (base.options as Record<string, unknown> | undefined) ?? {}
  const newEl = canvas.addElement(panelId, {
    tid: type.tid,
    options: {
      left: props.defaultPosition.x,
      top: props.defaultPosition.y,
      ...baseOpts,
    },
    printElementType: base.printElementType as
      | { type?: string; title?: string; field?: string }
      | undefined,
  })
  if (newEl) {
    history.pushSnapshot()
    emit('add', { tid: type.tid, panelId, elementId: newEl.id })
  }
}

// ============ Lifecycle ============

onMounted(() => {
  refresh()
})

onBeforeUnmount(() => {
  for (const el of Array.from(registeredItems.value)) detachItem(el)
})

// ============ Exposed API ============

defineExpose({ refresh })

// ============ Derived for template ============

const isEmpty = computed<boolean>(() => groupsByModule.value.length === 0)
</script>

<template>
  <div ref="listRef" class="hiprint-element-list" aria-label="Element types">
    <p v-if="isEmpty" class="hiprint-element-list-empty">
      No element types registered.
    </p>
    <template v-else>
      <details
        v-for="m in groupsByModule"
        :key="m.module"
        class="hiprint-element-list-module"
        open
      >
        <summary class="hiprint-element-list-module-title">
          {{ m.module }}
        </summary>
        <div
          v-for="(group, gi) in m.groups"
          :key="m.module + ':' + (group.name ?? gi)"
          class="hiprint-element-list-group"
        >
          <h4
            v-if="group.name"
            class="hiprint-element-list-group-title"
          >
            {{ group.name }}
          </h4>
          <p
            v-if="
              group.isDynamicSlot &&
              (group.printElementTypes?.length ?? 0) === 0 &&
              group.emptyTip
            "
            class="hiprint-element-list-empty-tip"
          >
            {{ group.emptyTip }}
          </p>
          <button
            v-for="type in group.printElementTypes ?? []"
            :key="type.tid"
            type="button"
            class="hiprint-element-list-item"
            :data-tid="type.tid"
            :title="type.title ?? type.tid"
            @click="onItemClick(type)"
          >
            <span v-if="type.icon" class="hiprint-element-list-icon" aria-hidden="true">
              ◆
            </span>
            <span class="hiprint-element-list-label">
              {{ type.title ?? type.tid }}
            </span>
          </button>
        </div>
      </details>
    </template>
  </div>
</template>

<style scoped>
.hiprint-element-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  background: #fafafa;
  border-right: 1px solid #e5e5e5;
  font-size: 12px;
  color: #333;
  min-width: 180px;
  max-height: 100%;
  overflow-y: auto;
  user-select: none;
}

.hiprint-element-list-empty {
  color: #999;
  text-align: center;
  padding: 16px 8px;
  margin: 0;
}

.hiprint-element-list-module {
  border: 1px solid #e5e5e5;
  border-radius: 4px;
  background: #fff;
  padding: 4px 6px;
}

.hiprint-element-list-module-title {
  font-weight: 600;
  cursor: pointer;
  padding: 4px 0;
  color: #555;
}

.hiprint-element-list-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 0 0;
}

.hiprint-element-list-group-title {
  margin: 4px 0 2px;
  font-size: 11px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.hiprint-element-list-empty-tip {
  color: #999;
  font-style: italic;
  margin: 4px 2px;
}

.hiprint-element-list-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: #f7f7f7;
  border: 1px solid #e5e5e5;
  border-radius: 3px;
  cursor: grab;
  text-align: left;
  font: inherit;
  color: #333;
  transition: background 120ms ease, border-color 120ms ease;
}

.hiprint-element-list-item:hover {
  background: #e6f4ff;
  border-color: #91caff;
}

.hiprint-element-list-item:focus-visible {
  outline: 2px solid #409eff;
  outline-offset: 1px;
}

.hiprint-element-list-item:global(.hiprint-dragging) {
  background: #d9eaff;
  cursor: grabbing;
}

.hiprint-element-list-icon {
  color: #1677ff;
  font-size: 10px;
}

.hiprint-element-list-label {
  flex: 1;
}
</style>
