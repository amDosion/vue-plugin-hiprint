<script setup lang="ts">
/**
 * HiprintElementListPanel.vue — V3 active-panel element list (TKT-101).
 *
 * Replaces V1 `panel.createElementListPanel()` (`[V1 lines 11679-11867]`,
 * docs/V1-INVENTORY/interactions.md §16) — the toggleable `☰` floating widget
 * that lists every element currently on the active panel.
 *
 * This is intentionally a SEPARATE component from `HiprintElementList.vue`:
 *  - HiprintElementList = PALETTE (registry of element types you can drag IN).
 *  - HiprintElementListPanel = LIST (current canvas elements). They lived as
 *    two parallel V1 features and we keep that split here.
 *
 * Surface:
 *  - Floating `☰` toggle button when closed.
 *  - Aside panel with header (title + count + close button), body of rows,
 *    or empty-state placeholder when no elements exist.
 *  - Each row shows: type badge, element title/field, visibility toggle,
 *    lock toggle. Click selects (with shift/ctrl modifiers), hover sets a
 *    `hoverId` ref usable by canvas overlays.
 *  - Drag-and-drop reordering via native HTML5 DnD — emits `reorderElement`
 *    on the canvas store and pushes a single history snapshot per drop.
 *
 * Why native HTML5 DnD instead of interact.js?
 *  - The element-list rows are a list (1-D vertical reorder), not free
 *    positioning. Native DnD gives us free keyboard fallback + minimal
 *    surface area without competing with the existing interact.js wiring
 *    for canvas elements.
 *
 * Invariants honored:
 *  - Selection mode mapping mirrors V1 row-click semantics: plain click =
 *    replace, shift+click = add, ctrl/cmd+click = toggle. See `selectRow`.
 *  - Visibility / lock toggles ALWAYS push a history snapshot so undo/redo
 *    round-trips the state. (Behavior parity with V1 outcome — V1 had
 *    refreshElementList watching template-data-changed.)
 *  - Empty selection / unknown element ids never throw; helpers early-return.
 *  - All user-controlled labels (title / field) go through `.textContent` via
 *    Vue text interpolation — no `v-html` anywhere (XSS-safe by design).
 */
import { computed, ref } from 'vue'
import {
  useCanvasStore,
  useHistoryStore,
  type CanvasElement,
} from '@hiprint-v3/stores'

interface Props {
  /** Whether the panel starts open. Default false matches V1 (☰ closed). */
  initiallyOpen?: boolean
  /** Optional fixed title shown in the panel header. */
  title?: string
}

const props = withDefaults(defineProps<Props>(), {
  initiallyOpen: false,
  title: 'Elements',
})

const emit = defineEmits<{
  /** Fired when the panel is opened / closed (parent can persist). */
  toggle: [open: boolean]
  /** Fired when the user hovers a row (id) or leaves all rows (null).
   *  Canvas overlays can subscribe to render a focus outline. */
  hover: [id: string | null]
}>()

const canvas = useCanvasStore()
const history = useHistoryStore()

const isOpen = ref<boolean>(props.initiallyOpen)
const hoverId = ref<string | null>(null)
const draggingId = ref<string | null>(null)
const dropTargetId = ref<string | null>(null)

// `rows` reflects the active panel's elements in their current order.
// Reactive over canvas.activePanel + canvas.panels so `reorderElement` /
// `addElement` / `removeElement` all refresh without manual subscription.
const rows = computed<CanvasElement[]>(
  () => canvas.activePanel?.printElements ?? []
)

const selectedIds = computed<Set<string>>(() => canvas.selectedElementIds)

function openPanel(): void {
  if (isOpen.value) return
  isOpen.value = true
  emit('toggle', true)
}

function closePanel(): void {
  if (!isOpen.value) return
  isOpen.value = false
  emit('toggle', false)
}

// ----- Row helpers -----

/** Resolve the user-facing label for a row. Prefer `options.title`, fall
 *  back to `options.field` (data-binding key), then default to a stable
 *  "Element N" so empty rows never show as blank. */
function rowLabel(el: CanvasElement, idx: number): string {
  const opts = el.options as Record<string, unknown>
  const title = typeof opts.title === 'string' ? opts.title : ''
  if (title) return title
  const field = typeof opts.field === 'string' ? opts.field : ''
  if (field) return field
  return 'Element ' + (idx + 1)
}

/** Type string for badge class + label. `printElementType.type` first; fall
 *  back to V1 Path A `options.textType` (text/barcode/qrcode); else 'text'. */
function rowType(el: CanvasElement): string {
  const t = el.printElementType?.type
  if (typeof t === 'string' && t) return t
  const tt = (el.options as Record<string, unknown>).textType
  if (typeof tt === 'string' && tt) return tt
  return 'text'
}

function isHidden(el: CanvasElement): boolean {
  return (el.options as Record<string, unknown>).hidden === true
}

function isLockedRow(el: CanvasElement): boolean {
  const o = el.options as Record<string, unknown>
  return o.positionLocked === true || o.sizeLocked === true || o.lock === true
}

// ----- Click + hover -----

/**
 * Row click → drives canvas selection.
 *
 * Mode mapping mirrors V1 element-list behavior so muscle-memory transfers:
 *   - Plain click            → 'replace'  (single selection)
 *   - Shift+click            → 'add'      (range / accumulate)
 *   - Ctrl+click / Meta+click → 'toggle'   (per-row in/out of selection)
 *
 * We do NOT push a history snapshot for pure selection changes (selection
 * is not part of the persisted template; only structural edits push).
 */
function selectRow(id: string, ev: MouseEvent): void {
  let mode: 'replace' | 'add' | 'toggle' = 'replace'
  if (ev.shiftKey) mode = 'add'
  else if (ev.ctrlKey || ev.metaKey) mode = 'toggle'
  canvas.selectElement(id, mode)
}

function onRowEnter(id: string): void {
  hoverId.value = id
  emit('hover', id)
}

function onRowLeave(): void {
  hoverId.value = null
  emit('hover', null)
}

// ----- Visibility + lock toggles -----

/**
 * Eye icon → flip `options.hidden`.
 *
 * `stopPropagation` so the row click handler doesn't ALSO change selection
 * when the user only wanted to toggle visibility (V1 11921-11923 quirk).
 */
function toggleVisibility(el: CanvasElement, ev: Event): void {
  ev.stopPropagation()
  const panelId = canvas.activePanelId
  if (!panelId) return
  const cur = (el.options as Record<string, unknown>).hidden === true
  canvas.updateElement(panelId, el.id, { options: { hidden: !cur } })
  history.pushSnapshot()
}

/**
 * Lock icon → flip both position + size lock (matches V1's single lock pill).
 *
 * V1 quirk: V1 only had a single `lock` flag. V3 split into `positionLocked`
 * + `sizeLocked` to support partial locks (TKT-027). For the list-panel UX
 * we treat them as a unit — clicking the icon on an unlocked element sets
 * BOTH flags; clicking on a locked element clears BOTH. Partial lock state
 * (only one flag set) is treated as "locked" for the icon, and a click
 * clears both — same outcome as V1.
 */
function toggleLock(el: CanvasElement, ev: Event): void {
  ev.stopPropagation()
  const panelId = canvas.activePanelId
  if (!panelId) return
  const locked = isLockedRow(el)
  if (locked) {
    canvas.updateElement(panelId, el.id, {
      options: { positionLocked: false, sizeLocked: false, lock: false },
    })
  } else {
    canvas.updateElement(panelId, el.id, {
      options: { positionLocked: true, sizeLocked: true },
    })
  }
  history.pushSnapshot()
}

// ----- Drag-and-drop reorder -----

/**
 * HTML5 DnD lifecycle. We use the `id` from `dataTransfer` as the source of
 * truth for the dragged element; the local `draggingId` ref is purely for
 * UI feedback (the `.is-dragging` row class).
 *
 * `dropTargetId` is updated in `onDragOver` so the row visibly highlights
 * as the drop target. We do NOT support dropping outside the list (no
 * external integrations are wired here on purpose; the canvas drop zone
 * has its own interact.js path).
 */
function onDragStart(id: string, ev: DragEvent): void {
  draggingId.value = id
  if (ev.dataTransfer) {
    ev.dataTransfer.effectAllowed = 'move'
    ev.dataTransfer.setData('text/plain', id)
  }
}

function onDragOver(id: string, ev: DragEvent): void {
  // preventDefault is required to allow `drop` to fire.
  ev.preventDefault()
  if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move'
  dropTargetId.value = id
}

function onDragLeave(id: string): void {
  if (dropTargetId.value === id) dropTargetId.value = null
}

function onDragEnd(): void {
  draggingId.value = null
  dropTargetId.value = null
}

function onDrop(targetId: string): void {
  const srcId = draggingId.value
  draggingId.value = null
  dropTargetId.value = null
  if (!srcId || srcId === targetId) return
  const panelId = canvas.activePanelId
  if (!panelId) return
  const items = rows.value
  const fromIdx = items.findIndex((i) => i.id === srcId)
  const toIdx = items.findIndex((i) => i.id === targetId)
  if (fromIdx < 0 || toIdx < 0) return
  canvas.reorderElement(panelId, fromIdx, toIdx)
  history.pushSnapshot()
}

// Exposed for tests / parent imperative access.
defineExpose({
  isOpen,
  hoverId,
  openPanel,
  closePanel,
})
</script>

<template>
  <button
    v-if="!isOpen"
    type="button"
    class="hiprint-el-list-toggle"
    aria-label="Show element list"
    @click="openPanel"
  >
    <span aria-hidden="true">☰</span>
  </button>
  <aside
    v-else
    class="hiprint-el-list-panel visible"
    role="region"
    aria-label="Element list"
  >
    <header class="hiprint-el-list-panel-header">
      <span class="hiprint-el-list-panel-title">{{ props.title }}</span>
      <span class="el-count">{{ rows.length }}</span>
      <button
        type="button"
        class="hiprint-el-list-panel-close"
        aria-label="Close element list"
        @click="closePanel"
      >×</button>
    </header>
    <div v-if="rows.length === 0" class="hiprint-el-list-empty">
      <slot name="empty">No elements</slot>
    </div>
    <div v-else class="hiprint-el-list-panel-body">
      <div
        v-for="(el, idx) in rows"
        :key="el.id"
        class="hiprint-el-list-row"
        :class="{
          'selected-el': selectedIds.has(el.id),
          'hidden-el': isHidden(el),
          'is-dragging': draggingId === el.id,
          'is-drop-target': dropTargetId === el.id && draggingId !== el.id,
        }"
        :data-element-id="el.id"
        draggable="true"
        @click="selectRow(el.id, $event)"
        @mouseenter="onRowEnter(el.id)"
        @mouseleave="onRowLeave"
        @dragstart="onDragStart(el.id, $event)"
        @dragover="onDragOver(el.id, $event)"
        @dragleave="onDragLeave(el.id)"
        @drop.prevent="onDrop(el.id)"
        @dragend="onDragEnd"
      >
        <span
          class="el-type-tag"
          :class="`tag-${rowType(el)}`"
        >{{ rowType(el) }}</span>
        <span class="hiprint-el-list-row-title">{{ rowLabel(el, idx) }}</span>
        <button
          type="button"
          class="hiprint-el-list-row-action hiprint-el-list-row-visibility"
          :aria-label="isHidden(el) ? 'Show element' : 'Hide element'"
          :aria-pressed="isHidden(el)"
          @click="toggleVisibility(el, $event)"
        >{{ isHidden(el) ? '👁‍🗨' : '👁' }}</button>
        <button
          type="button"
          class="hiprint-el-list-row-action hiprint-el-list-row-lock"
          :aria-label="isLockedRow(el) ? 'Unlock element' : 'Lock element'"
          :aria-pressed="isLockedRow(el)"
          @click="toggleLock(el, $event)"
        >{{ isLockedRow(el) ? '🔒' : '🔓' }}</button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
/* V1 reference: docs/V1-INVENTORY/styles.md §1.8 — Element List Panel.
 * Class names match V1 exactly so business consumers porting custom CSS
 * keep working without rewriting selectors. */

.hiprint-el-list-toggle {
  position: absolute;
  top: 10px;
  left: 10px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #409eff;
  color: #fff;
  border: 1px solid #2080d6;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  z-index: 50;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
}
.hiprint-el-list-toggle:hover {
  background: #2080d6;
}

.hiprint-el-list-panel {
  position: absolute;
  top: 10px;
  left: 10px;
  width: 280px;
  max-height: calc(100% - 20px);
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #d6d6d6;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  z-index: 50;
  font-size: 12px;
  color: #222;
}

.hiprint-el-list-panel-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-bottom: 1px solid #eee;
  font-weight: 600;
  background: #fafafa;
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
}

.hiprint-el-list-panel-title {
  flex: 1 1 auto;
}

.el-count {
  flex: 0 0 auto;
  background: #eee;
  color: #555;
  border-radius: 10px;
  padding: 1px 6px;
  font-size: 11px;
  font-weight: 500;
}

.hiprint-el-list-panel-close {
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  color: #666;
}
.hiprint-el-list-panel-close:hover {
  color: #f56c6c;
}

.hiprint-el-list-empty {
  padding: 16px;
  text-align: center;
  color: #999;
}

.hiprint-el-list-panel-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 4px 0;
}

.hiprint-el-list-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  cursor: pointer;
  border-left: 3px solid transparent;
  user-select: none;
}
.hiprint-el-list-row:hover {
  background: #f5f7fa;
}
.hiprint-el-list-row.selected-el {
  background: #e3f2fd;
  border-left-color: #2196f3;
}
.hiprint-el-list-row.hidden-el {
  opacity: 0.5;
}
.hiprint-el-list-row.is-dragging {
  opacity: 0.35;
}
.hiprint-el-list-row.is-drop-target {
  background: #fff8e1;
  border-top: 1px dashed #f59e0b;
}

.hiprint-el-list-row-title {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hiprint-el-list-row-action {
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 3px;
  padding: 0;
  font-size: 14px;
  line-height: 1;
}
.hiprint-el-list-row-action:hover {
  background: #eef2f7;
}

/* Type badges. V1 had per-type color stripes; we keep that vocabulary so
 * business CSS overrides for `.tag-table` etc. carry over verbatim. */
.el-type-tag {
  flex: 0 0 auto;
  display: inline-block;
  min-width: 36px;
  padding: 2px 6px;
  font-size: 10px;
  line-height: 1;
  color: #fff;
  text-align: center;
  border-radius: 3px;
  background: #909399;
  text-transform: capitalize;
}
.el-type-tag.tag-text { background: #409eff; }
.el-type-tag.tag-longText { background: #2080d6; }
.el-type-tag.tag-image { background: #67c23a; }
.el-type-tag.tag-table { background: #e6a23c; }
.el-type-tag.tag-barcode { background: #303133; }
.el-type-tag.tag-qrcode { background: #606266; }
.el-type-tag.tag-html { background: #909399; }
.el-type-tag.tag-hline { background: #909399; }
.el-type-tag.tag-vline { background: #909399; }
.el-type-tag.tag-rect { background: #909399; }
.el-type-tag.tag-oval { background: #909399; }
</style>
