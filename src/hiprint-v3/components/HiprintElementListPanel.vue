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
import { computed, nextTick, ref, watch } from 'vue'
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

// TKT-156 (Sprint 22d) — DOM ref on the scrollable body so we can call
// scrollIntoView on the row matching an externally-changed selection
// (e.g. user clicked an element on the canvas → the list panel should
// auto-scroll that row into view). See `watch(() => canvas.selectedElementIds)`
// below for the implementation. Static refs in JSDoc form for type safety.
const listBodyRef = ref<HTMLElement | null>(null)

// `rows` reflects the active panel's elements in their current order.
// Reactive over canvas.activePanel + canvas.panels so `reorderElement` /
// `addElement` / `removeElement` all refresh without manual subscription.
const rows = computed<CanvasElement[]>(
  () => canvas.activePanel?.printElements ?? []
)

const selectedIds = computed<Set<string>>(() => canvas.selectedElementIds)

/**
 * TKT-156 (Sprint 22d) — auto-scroll the row matching the first selected
 * element into view whenever selection changes.
 *
 * Why: the user can select an element by clicking it on the canvas. When the
 * list panel is open with many rows scrolled out of view, they would lose the
 * connection between canvas + list. V1 solved this by `scrollIntoView` on the
 * selected row inside `refreshElementList`; we mirror that here with a Vue
 * watcher so we don't rely on the canvas store knowing about this component.
 *
 * Notes:
 *  - We use `nextTick` so the row's `.selected-el` class has been applied
 *    before the scroll (avoids scrolling to a stale layout position).
 *  - When the panel is closed (`isOpen === false`) the body is not rendered,
 *    so `listBodyRef.value` is null — the `?.` chain short-circuits safely.
 *  - We only scroll for the FIRST selected id. Range/multi selects don't
 *    auto-scroll repeatedly through every row (V1 parity — V1 also only
 *    scrolled to the first match).
 *  - `block: 'nearest'` keeps the scroll minimal (don't yank the user's
 *    viewport unless the row is actually clipped).
 *  - `scrollIntoView` is guarded with a feature check because happy-dom
 *    (test runtime) implements it as a noop method on Element but not all
 *    custom HTMLElement subclasses guarantee its presence — defensive `in`
 *    check avoids accidental TypeError in unusual jsdom mocks.
 */
watch(
  () => canvas.selectedElementIds,
  async (ids) => {
    if (!ids || ids.size === 0) return
    if (!isOpen.value) return
    await nextTick()
    const firstId = ids.values().next().value
    if (!firstId) return
    const body = listBodyRef.value
    if (!body) return
    const row = body.querySelector(
      `.hiprint-el-list-row[data-element-id="${firstId}"]`
    )
    if (row && 'scrollIntoView' in row) {
      ;(row as HTMLElement).scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      })
    }
  }
)

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

// ----- TKT-403 keyboard navigation -----

/**
 * Track which row index has keyboard focus, distinct from selection. A row can
 * be focused (cursor sits on it for navigation) without being selected; press
 * Enter to commit the focused row into selection. Mirrors the V1 floating
 * panel's pattern (`docs/V1-INVENTORY/interactions.md` §16.3 line 11925-11939,
 * where row click sets selection and triggers an outline flash). Index, not
 * id, because rows reorder on canvas mutations and we want focus to remain on
 * the position the user was navigating, not jump around with reorders.
 */
const focusIdx = ref<number>(-1)

/**
 * Handle ArrowUp / ArrowDown / Enter on the body container.
 *
 * Why on the body container and not on each row: a single tabindex'd container
 * with delegated keyboard handling avoids the focus-management nightmare of N
 * tabindexed rows (and keeps Tab navigation predictable for screen-reader
 * users). The container becomes the only focusable element in the panel, and
 * the focused-row state is purely visual.
 *
 * Behavior:
 *  - ArrowDown: focusIdx → min(focusIdx+1, rows.length-1). Wraps from -1 to 0
 *    when nothing was focused (V1 "first ArrowDown selects first row").
 *  - ArrowUp:   focusIdx → max(focusIdx-1, 0). Wraps from -1 to last row when
 *    nothing was focused (V1 ArrowUp-when-empty selects last).
 *  - Enter:     replace selection with the focused row's element + scroll into
 *    view. No history snapshot (selection is not a persisted edit).
 *  - Esc:       blur the panel + clear focusIdx (matches V1 §1.7 — Esc clears
 *    selection-derived UI hints).
 */
function onBodyKeyDown(ev: KeyboardEvent): void {
  if (rows.value.length === 0) return
  // Don't fight input focus when the user is typing in a row's child input
  // (currently none, but defensive against future inline edit widgets).
  const tgt = ev.target as HTMLElement | null
  if (
    tgt &&
    (tgt.tagName === 'INPUT' ||
      tgt.tagName === 'TEXTAREA' ||
      tgt.isContentEditable)
  ) {
    return
  }
  const last = rows.value.length - 1
  if (ev.key === 'ArrowDown') {
    ev.preventDefault()
    focusIdx.value =
      focusIdx.value < 0 ? 0 : Math.min(focusIdx.value + 1, last)
    return
  }
  if (ev.key === 'ArrowUp') {
    ev.preventDefault()
    focusIdx.value = focusIdx.value < 0 ? last : Math.max(focusIdx.value - 1, 0)
    return
  }
  if (ev.key === 'Enter') {
    ev.preventDefault()
    const row = rows.value[focusIdx.value]
    if (row) canvas.selectElement(row.id, 'replace')
    return
  }
  if (ev.key === 'Escape') {
    // Don't preventDefault — Escape may close other UI (matches the
    // selection-shortcut behavior in interactions/selection.ts).
    focusIdx.value = -1
    return
  }
  if (ev.key === 'Home') {
    ev.preventDefault()
    focusIdx.value = 0
    return
  }
  if (ev.key === 'End') {
    ev.preventDefault()
    focusIdx.value = last
    return
  }
}

// Exposed for tests / parent imperative access.
defineExpose({
  isOpen,
  hoverId,
  focusIdx,
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
    <div
      v-else
      ref="listBodyRef"
      class="hiprint-el-list-panel-body"
      tabindex="0"
      role="listbox"
      :aria-activedescendant="
        focusIdx >= 0 && rows[focusIdx]
          ? `hiprint-el-list-row-${rows[focusIdx].id}`
          : undefined
      "
      @keydown="onBodyKeyDown"
    >
      <div
        v-for="(el, idx) in rows"
        :id="`hiprint-el-list-row-${el.id}`"
        :key="el.id"
        class="hiprint-el-list-row"
        role="option"
        :aria-selected="selectedIds.has(el.id)"
        :class="{
          /* TKT-250 — co-emit BEM + V1 legacy state classes so business CSS
             keyed to either selector vocabulary still fires. V1 inventory
             §1.8 line 1856: `.hiprint-el-list-row.selected-el`. The V1
             `.selected` shorthand is also co-emitted for callers that
             override generic state-class CSS at the element level. */
          'selected-el': selectedIds.has(el.id),
          selected: selectedIds.has(el.id),
          'hidden-el': isHidden(el),
          /* V1 inventory §1.16 line 4180: `.alwaysHide` is the V1 legacy
             name for hidden elements. Mirrored here so caller .alwaysHide
             overrides still apply to list rows. */
          alwaysHide: isHidden(el),
          'is-dragging': draggingId === el.id,
          dragging: draggingId === el.id,
          'is-drop-target': dropTargetId === el.id && draggingId !== el.id,
          /* `.is-drop-target` has no V1 equivalent (V3-only). */
          /* TKT-403 — keyboard focus visual (NOT selection). */
          'is-keyboard-focus': focusIdx === idx,
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
  border-radius: var(--hiprint-radius-circle, 50%);
  background: var(--hiprint-selection-outline, #409eff);
  color: #fff;
  border: 1px solid var(--hiprint-selected-row-border, #2080d6);
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
  filter: brightness(0.92);
}

.hiprint-el-list-panel {
  position: absolute;
  top: 10px;
  left: 10px;
  width: 280px;
  max-height: calc(100% - 20px);
  display: flex;
  flex-direction: column;
  background: var(--hiprint-bg, #fff);
  border: 1px solid var(--hiprint-border, #d6d6d6);
  border-radius: var(--hiprint-radius, 4px);
  box-shadow: var(--hiprint-shadow, 0 2px 8px rgba(0, 0, 0, 0.12));
  z-index: 50;
  font-size: 12px;
  color: var(--hiprint-fg, #222);
}

.hiprint-el-list-panel-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--hiprint-border-soft, #eee);
  font-weight: 600;
  background: var(--hiprint-bg-toolbar, #fafafa);
  border-top-left-radius: var(--hiprint-radius, 4px);
  border-top-right-radius: var(--hiprint-radius, 4px);
}

.hiprint-el-list-panel-title {
  flex: 1 1 auto;
}

.el-count {
  flex: 0 0 auto;
  background: var(--hiprint-border-soft, #eee);
  color: var(--hiprint-fg-label, #555);
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
  color: var(--hiprint-fg-muted, #666);
}
.hiprint-el-list-panel-close:hover {
  color: var(--hiprint-danger, #f56c6c);
}

.hiprint-el-list-empty {
  padding: 16px;
  text-align: center;
  color: var(--hiprint-fg-disabled, #999);
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
  background: var(--hiprint-bg-row-hover, #f5f7fa);
}
/* TKT-250 / TKT-251 — co-emit V1 `.selected` shorthand and use design tokens.
 * V1 inventory §1.8 line 1856: `.hiprint-el-list-row.selected-el`. We co-emit
 * `.selected` so caller CSS that targets the element-level selection class
 * fires here too. */
.hiprint-el-list-row.selected-el,
.hiprint-el-list-row.selected {
  background: var(--hiprint-selected-row-bg, #e3f2fd);
  border-left-color: var(--hiprint-selected-row-border, #2196f3);
}
/* TKT-250 — co-emit V1 legacy `.alwaysHide` (bundle.js:4180). */
.hiprint-el-list-row.hidden-el,
.hiprint-el-list-row.alwaysHide {
  opacity: 0.5;
}
/* TKT-250 — match both BEM + V1 legacy state classes (see :class binding). */
.hiprint-el-list-row.is-dragging,
.hiprint-el-list-row.dragging {
  opacity: 0.35;
}
.hiprint-el-list-row.is-drop-target {
  background: var(--hiprint-drop-target-bg, #fff8e1);
  border-top: 1px dashed var(--hiprint-drop-target-border, #f59e0b);
}
/* TKT-403 — keyboard focus visual. Distinct from `.selected-el` (which is
 * persisted selection) so users can navigate without losing track of the
 * actual selection. Uses outline (not background) to stack cleanly on top of
 * `.selected` rows. */
.hiprint-el-list-row.is-keyboard-focus {
  outline: 2px solid var(--hiprint-selection-outline, #409eff);
  outline-offset: -2px;
}
.hiprint-el-list-panel-body:focus-visible {
  outline: 2px solid var(--hiprint-selection-outline, #409eff);
  outline-offset: -2px;
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
 * business CSS overrides for `.tag-table` etc. carry over verbatim.
 *
 * TKT-157 (Sprint 22d) — palette refresh to match V1-INVENTORY etype catalog.
 * Each color is chosen so the badge stays readable on the row's hover bg
 * (#f5f7fa) and selected bg (#e3f2fd). Mapping (etype → bg):
 *   text             → #409eff  (blue,        primary content)
 *   longText         → #67c23a  (green,       multi-line content)
 *   image            → #e6a23c  (amber,       media)
 *   html             → #909399  (gray,        raw markup)
 *   barcode          → #f56c6c  (red,         scannable)
 *   qrcode           → #c0c4cc  (light-gray,  scannable secondary)
 *   hline            → #95d475  (light-green, layout primitive)
 *   vline            → #b88230  (brown,       layout primitive)
 *   rect             → #66a182  (teal,        shape)
 *   oval             → #a37ec0  (purple,      shape)
 *   table            → #1677ff  (primary,     tabular)
 *   tableCustomCell  → #6699aa  (slate,       table sub-element)
 */
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
.el-type-tag.tag-longText { background: #67c23a; }
.el-type-tag.tag-image { background: #e6a23c; }
.el-type-tag.tag-html { background: #909399; }
.el-type-tag.tag-barcode { background: #f56c6c; }
.el-type-tag.tag-qrcode { background: #c0c4cc; }
.el-type-tag.tag-hline { background: #95d475; }
.el-type-tag.tag-vline { background: #b88230; }
.el-type-tag.tag-rect { background: #66a182; }
.el-type-tag.tag-oval { background: #a37ec0; }
.el-type-tag.tag-table { background: #1677ff; }
.el-type-tag.tag-tableCustomCell { background: #6699aa; }
</style>
