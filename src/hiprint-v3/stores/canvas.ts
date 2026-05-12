/**
 * stores/canvas.ts — useCanvasStore: V3 reactive canvas state.
 *
 * Source of truth for panels, selection, scale, and grid. Composables and
 * components consume this via useCanvasStore(). All mutations are immutable
 * patches so Vue's reactivity can diff correctly and history snapshots are
 * trivially clonable.
 *
 * V2 reference:
 *  - src/hiprint-v2/template/print-template.js — panels[] + editingPanel + selectPanel
 *  - src/hiprint-v2/core/panel.js              — panel.printElements list
 *
 * Invariants preserved (see ADR-0011):
 *  - state-modeler R3: removePanel must keep ≥ 1 panel; if editing panel
 *    removed, re-select adjacent (Invariant #10).
 *  - PM-005: panel/element ids are crypto.randomUUID() strings.
 *  - selectMultiple deduplicates via Set.
 *
 * Store layer vs JSON layer (intentional separation):
 *  - `@hiprint-v3/schemas` (PanelJson / ElementJson) describes the wild JSON
 *    business consumers persist; all fields are optional + `.loose()` so any
 *    legacy template can round-trip without rejection (Invariant #13).
 *  - This store uses `Panel` / `CanvasElement` interfaces representing
 *    NORMALIZED runtime state — every record has a guaranteed `id` (assigned
 *    on load via `crypto.randomUUID()` if absent in the JSON) so reactivity,
 *    selection, and history can address records by stable key.
 *  - The normalize bridge lives in `useTemplateStore.loadFromJson()`.
 */

import { defineStore, acceptHMRUpdate } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

// ============ Normalized internal types (NOT the JSON shape) ============

/**
 * Element record as held in the canvas store. Always has a stable `id`.
 * For the persistable JSON shape, see `@hiprint-v3/schemas` ElementJson.
 */
export interface CanvasElement {
  id: string
  tid: string
  options: Record<string, unknown>
  printElementType?: { title?: string; type?: string; field?: string } | undefined
}

/**
 * Panel record as held in the canvas store. Always has a stable `id`.
 * For the persistable JSON shape, see `@hiprint-v3/schemas` PanelJson.
 */
export interface Panel {
  id: string
  index: number
  name: string
  width: number
  height: number
  paperHeader?: number
  paperFooter?: number
  paperType?: string
  printElements: CanvasElement[]
  // Any unknown V1 panel keys preserved via index signature
  [key: string]: unknown
}

export type SelectionMode = 'replace' | 'add' | 'toggle'

/**
 * TKT-102 — user-drawn guide line.
 *
 * A dashed line pulled from the ruler onto the canvas to mark a position.
 * `axis: 'h'` runs horizontally; `axis: 'v'` runs vertically. `pos` is in pt
 * (matches canvas coord system). Snap logic in TKT-103 reads guideLines.
 */
export interface GuideLine {
  id: string
  axis: 'h' | 'v'
  pos: number
}

// ============ Helpers ============

/**
 * Generate a crypto-safe id. Mirrors V2 PrintTemplate._generateId (PM-005).
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

/**
 * Immutable shallow merge for element patches. Caller passes a partial; we
 * return a new object preserving identity-stable fields (id, tid).
 */
function applyElementPatch(
  el: CanvasElement,
  patch: Partial<CanvasElement>
): CanvasElement {
  const nextOptions =
    patch.options !== undefined ? { ...el.options, ...patch.options } : el.options
  return {
    ...el,
    ...patch,
    id: el.id, // id never patched
    tid: patch.tid ?? el.tid,
    options: nextOptions,
  }
}

// ============ Store ============

export const useCanvasStore = defineStore('hiprint-v3-canvas', () => {
  // -------- State --------

  /**
   * Reactive panel list. `ref` over `shallowRef` so element mutations are
   * tracked (panel is small; perf is fine for designer use).
   */
  const panels = ref<Panel[]>([])

  /**
   * Currently selected element ids. Use shallowRef + new Set on each mutation
   * so Vue can diff identity cleanly.
   */
  const selectedElementIds = shallowRef<Set<string>>(new Set())

  /** Currently active (editing) panel id. */
  const activePanelId = ref<string | null>(null)

  /** Zoom level (1.0 = 100%). V1/V2 panel.scale equivalent. */
  const scale = ref<number>(1)

  /** Grid step in pt. Used by snap-to-grid in P16. */
  const gridSize = ref<number>(5)

  /** Whether the panel grid background is visible. Toolbar toggles this;
   *  HiprintPanel renders a CSS grid background when true. */
  const gridVisible = ref<boolean>(true)

  /** Whether ruler tracks (top + left) render in the designer canvas.
   *  HiprintCanvas/Panel read this to show/hide ruler overlay. */
  const rulerVisible = ref<boolean>(true)

  /**
   * TKT-102 — user-drawn guide lines.
   *
   * Created by dragging from a ruler bar and committed on pointerup.
   * Rendered as a `.hiprint-guide-line` layer above the paper background and
   * below elements. Snap logic in TKT-103 reads this during drag-move.
   */
  const guideLines = ref<GuideLine[]>([])

  // -------- Getters --------

  const activePanel = computed<Panel | null>(() => {
    const id = activePanelId.value
    if (id == null) return null
    return panels.value.find((p) => p.id === id) ?? null
  })

  const allElements = computed<CanvasElement[]>(() =>
    panels.value.flatMap((p) => p.printElements)
  )

  const selectedElements = computed<CanvasElement[]>(() => {
    const ids = selectedElementIds.value
    if (ids.size === 0) return []
    // Build id -> el map across all panels for O(N+M) lookup.
    const map = new Map<string, CanvasElement>()
    for (const p of panels.value) {
      for (const el of p.printElements) map.set(el.id, el)
    }
    const out: CanvasElement[] = []
    ids.forEach((id) => {
      const el = map.get(id)
      if (el) out.push(el)
    })
    return out
  })

  const panelCount = computed<number>(() => panels.value.length)

  // -------- Actions --------

  /**
   * Add a panel. Auto-assigns id if missing, sets activePanelId if first panel.
   */
  function addPanel(panel: Partial<Panel> & Pick<Panel, 'width' | 'height'>): Panel {
    const id = (panel.id as string | undefined) ?? generateId()
    const next: Panel = {
      index: panels.value.length,
      name: String(panels.value.length + 1),
      printElements: [],
      ...panel,
      id,
    }
    panels.value = [...panels.value, next]
    if (activePanelId.value == null) activePanelId.value = id
    return next
  }

  /**
   * Remove panel by id.
   *
   * Invariant #10 (state-modeler R3): must keep at least 1 panel. If the
   * removed panel was active, re-select adjacent (next, falling back to prev).
   */
  function removePanel(id: string): void {
    if (panels.value.length <= 1) {
      console.warn('[hiprint] removePanel ignored: must keep at least 1 panel')
      return
    }
    const idx = panels.value.findIndex((p) => p.id === id)
    if (idx < 0) return
    const wasActive = activePanelId.value === id

    const next = panels.value.slice()
    next.splice(idx, 1)
    // Re-index so Panel.index stays contiguous (mirrors V1 expectations).
    next.forEach((p, i) => {
      if (p.index !== i) p.index = i
    })
    panels.value = next

    // Drop selection ids that belonged to removed panel.
    const removedIds = new Set<string>()
    // (Cheaper than re-walking: we already lost the panel, just rebuild full set.)
    const remainingIds = new Set<string>()
    for (const p of next) {
      for (const el of p.printElements) remainingIds.add(el.id)
    }
    if (selectedElementIds.value.size > 0) {
      const filtered = new Set<string>()
      selectedElementIds.value.forEach((eid) => {
        if (remainingIds.has(eid)) filtered.add(eid)
      })
      selectedElementIds.value = filtered
    }
    void removedIds

    if (wasActive) {
      const nextIdx = Math.min(idx, next.length - 1)
      activePanelId.value = next[nextIdx]?.id ?? null
    }
  }

  /** Set the active (editing) panel by id. */
  function setActivePanel(id: string): void {
    if (panels.value.some((p) => p.id === id)) {
      activePanelId.value = id
    } else {
      console.warn('[hiprint] setActivePanel: unknown panel id', id)
    }
  }

  /**
   * Patch a panel immutably (paper width/height/header/footer/name/paperType
   * /paperMargin/watermark/etc.). Custom paper popover (TB-004) + paper
   * property panel (PP-101~PP-113) both go through this. `id` is preserved.
   */
  function updatePanel(id: string, patch: Partial<Panel>): void {
    const idx = panels.value.findIndex((p) => p.id === id)
    if (idx < 0) {
      console.warn('[hiprint] updatePanel: unknown panel id', id)
      return
    }
    const cur = panels.value[idx]
    if (!cur) return
    const next = panels.value.slice()
    next[idx] = { ...cur, ...patch, id: cur.id }
    panels.value = next
  }

  /**
   * Reorder a panel from `fromIdx` to `toIdx` (drag-rearrange chips, MP-005).
   * Re-numbers `Panel.index` to keep contiguous. Active panel id is stable
   * (we move panels around it, not the selection).
   */
  function reorderPanel(fromIdx: number, toIdx: number): void {
    const len = panels.value.length
    if (fromIdx < 0 || fromIdx >= len || toIdx < 0 || toIdx >= len) return
    if (fromIdx === toIdx) return
    const next = panels.value.slice()
    const [moved] = next.splice(fromIdx, 1)
    if (!moved) return
    next.splice(toIdx, 0, moved)
    next.forEach((p, i) => {
      if (p.index !== i) p.index = i
    })
    panels.value = next
  }

  /** Add an element to a specific panel. Returns new element (with assigned id). */
  function addElement(
    panelId: string,
    element: Partial<CanvasElement> & Pick<CanvasElement, 'tid'>
  ): CanvasElement | null {
    const idx = panels.value.findIndex((p) => p.id === panelId)
    if (idx < 0) {
      console.warn('[hiprint] addElement: unknown panelId', panelId)
      return null
    }
    const panel = panels.value[idx]
    if (!panel) return null
    const newEl: CanvasElement = {
      options: {},
      ...element,
      id: element.id ?? generateId(),
      tid: element.tid,
    }
    const nextPanel: Panel = {
      ...panel,
      printElements: [...panel.printElements, newEl],
    }
    const nextPanels = panels.value.slice()
    nextPanels[idx] = nextPanel
    panels.value = nextPanels
    return newEl
  }

  /**
   * Reorder an element within its panel from `fromIdx` to `toIdx`.
   *
   * Used by the element-list-panel drag-and-drop UX (TKT-101) to let users
   * change list order without leaving keyboard / mouse flow. Out-of-range
   * indices, same-index calls, and unknown panel ids are silently ignored —
   * callers may pass `findIndex` results without pre-validation. Element
   * identities are preserved (splice + insert); only the printElements array
   * reference is replaced so Vue diff fires.
   *
   * Mirrors `reorderPanel` semantics so consumers can switch between
   * panel-row and element-row reordering without learning two APIs.
   */
  function reorderElement(
    panelId: string,
    fromIdx: number,
    toIdx: number
  ): void {
    const pIdx = panels.value.findIndex((p) => p.id === panelId)
    if (pIdx < 0) return
    const panel = panels.value[pIdx]
    if (!panel) return
    const len = panel.printElements.length
    if (fromIdx < 0 || fromIdx >= len || toIdx < 0 || toIdx >= len) return
    if (fromIdx === toIdx) return
    const nextEls = panel.printElements.slice()
    const [moved] = nextEls.splice(fromIdx, 1)
    if (!moved) return
    nextEls.splice(toIdx, 0, moved)
    const nextPanels = panels.value.slice()
    nextPanels[pIdx] = { ...panel, printElements: nextEls }
    panels.value = nextPanels
  }

  /** Remove element by id from given panel. */
  function removeElement(panelId: string, elementId: string): void {
    const idx = panels.value.findIndex((p) => p.id === panelId)
    if (idx < 0) return
    const panel = panels.value[idx]
    if (!panel) return
    const filteredEls = panel.printElements.filter((el) => el.id !== elementId)
    if (filteredEls.length === panel.printElements.length) return
    const nextPanels = panels.value.slice()
    nextPanels[idx] = { ...panel, printElements: filteredEls }
    panels.value = nextPanels

    // TKT-405 — clearSettingContainer parity: when the deleted element was
    // selected we update selection state, AND we must fire the selection bus
    // so external integrators (e.g. a property-panel mirror keyed off
    // `subscribe('select', ...)`) can drop their UI references. Without the
    // emit the prop panel would keep showing the now-deleted element's edit
    // controls (V1 inventory §21 `clearSettingContainer` event).
    if (selectedElementIds.value.has(elementId)) {
      const next = new Set(selectedElementIds.value)
      next.delete(elementId)
      selectedElementIds.value = next
      _emitSelect()
    }
  }

  /**
   * Patch an element immutably. Returns nothing; reactive panels array is
   * replaced so Vue diff fires.
   *
   * TKT-404 — emits `option-change` on every `options` patch so external
   * custom-option panels can rebuild themselves. Non-options patches
   * (printElementType / tid swap — rare; only during type-coercion) do not
   * emit; V1's BuildCustomOptionSetting bus only fired for options edits.
   */
  function updateElement(
    panelId: string,
    elementId: string,
    patch: Partial<CanvasElement>
  ): void {
    const pIdx = panels.value.findIndex((p) => p.id === panelId)
    if (pIdx < 0) return
    const panel = panels.value[pIdx]
    if (!panel) return
    const eIdx = panel.printElements.findIndex((el) => el.id === elementId)
    if (eIdx < 0) return
    const oldEl = panel.printElements[eIdx]
    if (!oldEl) return
    const nextEls = panel.printElements.slice()
    const nextEl = applyElementPatch(oldEl, patch)
    nextEls[eIdx] = nextEl
    const nextPanels = panels.value.slice()
    nextPanels[pIdx] = { ...panel, printElements: nextEls }
    panels.value = nextPanels
    // TKT-404 emit (after store mutation lands so listeners reading the
    // store see the new state).
    if (patch.options !== undefined) {
      _emitOptionChange(panelId, elementId, nextEl.options)
    }
  }

  // -------- TKT-401 / TKT-404 event bus --------

  /**
   * TKT-401 — selection event bus for non-V3 consumers.
   *
   * V1 reference: bundle.js line 12562-12564 `PrintElementSelectEventKey_<id>`
   * was the V1 event that fired whenever selection changed. Internal V3 uses
   * Pinia reactivity, but external integrators (e.g. an Ant Design Vue
   * Drawer that needs to mirror selection state) currently have no
   * mechanism to subscribe without polling. We expose a Set-of-listeners
   * pattern mirroring `history.subscribe('change', ...)` for symmetry.
   *
   * Why on `selectElement` AND `selectMultiple` AND `clearSelection`:
   * V1 emitted on every state transition (single click, shift-click,
   * Ctrl+A, Esc, lasso end). We fire from the three store actions that
   * change selection so every transition is covered. The listener
   * receives the FRESH `Array<string>` (snapshot, not the live ref) so
   * consumers can iterate safely without locking reactivity.
   *
   * TKT-404 — option-change event bus (V1 reference: bundle 12565-12567
   * `BuildCustomOptionSettingEventKey_<id>`). Fires whenever
   * `updateElement` lands an `options` patch, so custom property-panel
   * authors can rebuild their UI without polling. Identical fan-out
   * pattern to the select bus, but the listener receives the patched
   * element id + patch options snapshot.
   */
  type SelectListener = (ids: readonly string[]) => void
  type OptionListener = (
    payload: {
      panelId: string
      elementId: string
      options: Record<string, unknown>
    }
  ) => void
  const _selectListeners = new Set<SelectListener>()
  const _optionListeners = new Set<OptionListener>()

  function _emitSelect(): void {
    if (_selectListeners.size === 0) return
    const snap = Array.from(selectedElementIds.value)
    for (const fn of _selectListeners) {
      try {
        fn(snap)
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[hiprint-v3:canvas] select listener threw:', err)
      }
    }
  }

  function _emitOptionChange(
    panelId: string,
    elementId: string,
    options: Record<string, unknown>
  ): void {
    if (_optionListeners.size === 0) return
    // Copy so listeners can't mutate the underlying element through this
    // payload reference. The element's actual `options` ref is reactive and
    // already protected by the immutable patch path in `applyElementPatch`.
    const payload = {
      panelId,
      elementId,
      options: { ...options },
    }
    for (const fn of _optionListeners) {
      try {
        fn(payload)
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[hiprint-v3:canvas] option listener threw:', err)
      }
    }
  }

  /**
   * TKT-401 / TKT-404 — subscribe to canvas events. Returns unsubscribe.
   *
   * @example
   *   const off = canvas.subscribe('select', (ids) => syncDrawer(ids))
   *   canvas.subscribe('option-change', ({ elementId, options }) => …)
   */
  function subscribe(
    event: 'select',
    listener: SelectListener
  ): () => void
  function subscribe(
    event: 'option-change',
    listener: OptionListener
  ): () => void
  function subscribe(
    event: 'select' | 'option-change',
    listener: SelectListener | OptionListener
  ): () => void {
    if (event === 'select') {
      _selectListeners.add(listener as SelectListener)
      return () => {
        _selectListeners.delete(listener as SelectListener)
      }
    }
    if (event === 'option-change') {
      _optionListeners.add(listener as OptionListener)
      return () => {
        _optionListeners.delete(listener as OptionListener)
      }
    }
    // eslint-disable-next-line no-console
    console.warn('[hiprint-v3:canvas] subscribe: unknown event', event)
    return () => undefined
  }

  /** Clear all selection. */
  function clearSelection(): void {
    if (selectedElementIds.value.size === 0) return
    selectedElementIds.value = new Set()
    _emitSelect()
  }

  /**
   * Select an element. Mode:
   *  - 'replace' (default): replaces selection.
   *  - 'add':                add to current selection.
   *  - 'toggle':             flip presence.
   */
  function selectElement(id: string, mode: SelectionMode = 'replace'): void {
    if (mode === 'replace') {
      selectedElementIds.value = new Set([id])
      _emitSelect()
      return
    }
    const next = new Set(selectedElementIds.value)
    if (mode === 'toggle') {
      if (next.has(id)) next.delete(id)
      else next.add(id)
    } else {
      // 'add'
      next.add(id)
    }
    selectedElementIds.value = next
    _emitSelect()
  }

  /** Replace selection with a set of ids. */
  function selectMultiple(ids: readonly string[]): void {
    selectedElementIds.value = new Set(ids)
    _emitSelect()
  }

  /**
   * Move all currently-selected elements by (dx, dy) in pt. Immutable patch.
   * No-op if selection empty.
   */
  function moveSelection(dx: number, dy: number): void {
    if (selectedElementIds.value.size === 0) return
    const ids = selectedElementIds.value
    const nextPanels = panels.value.map((panel) => {
      let changed = false
      const nextEls = panel.printElements.map((el) => {
        if (!ids.has(el.id)) return el
        changed = true
        const left = Number((el.options as Record<string, unknown>).left ?? 0) + dx
        const top = Number((el.options as Record<string, unknown>).top ?? 0) + dy
        return applyElementPatch(el, { options: { left, top } })
      })
      return changed ? { ...panel, printElements: nextEls } : panel
    })
    panels.value = nextPanels
  }

  /**
   * Move an element from one panel to another. Used by cross-panel drag-drop
   * (P16). Immutable: both source and destination panel arrays are replaced.
   *
   * No-op if either panel id is unknown or element id isn't in source panel.
   * Returns the moved element (or null on failure) so callers can patch
   * options.left/top to the drop position.
   */
  function moveElementBetweenPanels(
    srcPanelId: string,
    dstPanelId: string,
    elementId: string
  ): CanvasElement | null {
    if (srcPanelId === dstPanelId) return null
    const srcIdx = panels.value.findIndex((p) => p.id === srcPanelId)
    const dstIdx = panels.value.findIndex((p) => p.id === dstPanelId)
    if (srcIdx < 0 || dstIdx < 0) {
      console.warn('[hiprint] moveElementBetweenPanels: unknown panel id', {
        srcPanelId,
        dstPanelId,
      })
      return null
    }
    const srcPanel = panels.value[srcIdx]
    const dstPanel = panels.value[dstIdx]
    if (!srcPanel || !dstPanel) return null

    const eIdx = srcPanel.printElements.findIndex((el) => el.id === elementId)
    if (eIdx < 0) return null
    const moved = srcPanel.printElements[eIdx]
    if (!moved) return null

    const nextSrcEls = srcPanel.printElements.slice()
    nextSrcEls.splice(eIdx, 1)
    const nextDstEls = [...dstPanel.printElements, moved]

    const nextPanels = panels.value.slice()
    nextPanels[srcIdx] = { ...srcPanel, printElements: nextSrcEls }
    nextPanels[dstIdx] = { ...dstPanel, printElements: nextDstEls }
    panels.value = nextPanels
    return moved
  }

  /** Set zoom scale. Clamp to a sane range (V2 PrintPanel.scale uses 0.1..5). */
  function setScale(s: number): void {
    if (!Number.isFinite(s)) {
      console.warn('[hiprint] setScale ignored: non-finite value', s)
      return
    }
    scale.value = Math.max(0.1, Math.min(5, s))
  }

  /** Replace gridSize (pt). */
  function setGridSize(g: number): void {
    if (!Number.isFinite(g) || g <= 0) {
      console.warn('[hiprint] setGridSize ignored: must be positive finite', g)
      return
    }
    gridSize.value = g
  }

  // -------- TKT-102 guide-line actions --------

  /**
   * Add a user-drawn guide line. Rejects non-finite pos (warn + sentinel
   * record with empty id so the caller can detect failure).
   */
  function addGuideLine(axis: 'h' | 'v', pos: number): GuideLine {
    if (!Number.isFinite(pos)) {
      console.warn('[hiprint] addGuideLine ignored: non-finite pos', pos)
      return { id: '', axis, pos: 0 }
    }
    const guide: GuideLine = { id: generateId(), axis, pos }
    guideLines.value = [...guideLines.value, guide]
    return guide
  }

  /** Remove guide line by id. No-op for unknown ids (legitimate user gesture). */
  function removeGuideLine(id: string): void {
    const next = guideLines.value.filter((g) => g.id !== id)
    if (next.length === guideLines.value.length) return
    guideLines.value = next
  }

  /** Update guide line position (immutable patch). Rejects non-finite pos. */
  function updateGuideLine(id: string, pos: number): void {
    if (!Number.isFinite(pos)) {
      console.warn('[hiprint] updateGuideLine ignored: non-finite pos', pos)
      return
    }
    const idx = guideLines.value.findIndex((g) => g.id === id)
    if (idx < 0) return
    const cur = guideLines.value[idx]
    if (!cur) return
    const next = guideLines.value.slice()
    next[idx] = { ...cur, pos }
    guideLines.value = next
  }

  /** Clear all guide lines. */
  function clearGuideLines(): void {
    if (guideLines.value.length === 0) return
    guideLines.value = []
  }

  /**
   * Reset the entire canvas (used by useTemplateStore.loadFromJson + clear).
   * Internal: not part of the typical mutation API; composables should prefer
   * the template store's loadFromJson which orchestrates reset across stores.
   */
  function $reset(): void {
    panels.value = []
    selectedElementIds.value = new Set()
    activePanelId.value = null
    scale.value = 1
    gridSize.value = 5
    guideLines.value = []
  }

  return {
    // state
    panels,
    selectedElementIds,
    activePanelId,
    scale,
    gridSize,
    gridVisible,
    rulerVisible,
    guideLines,
    // getters
    activePanel,
    selectedElements,
    allElements,
    panelCount,
    // actions
    addPanel,
    removePanel,
    setActivePanel,
    updatePanel,
    reorderPanel,
    addElement,
    reorderElement,
    removeElement,
    updateElement,
    clearSelection,
    selectElement,
    selectMultiple,
    moveSelection,
    moveElementBetweenPanels,
    setScale,
    setGridSize,
    addGuideLine,
    removeGuideLine,
    updateGuideLine,
    clearGuideLines,
    // TKT-401 — selection event bus for external integrators.
    subscribe,
    $reset,
  }
})

// HMR safety: Pinia re-applies state diff across module reloads.
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useCanvasStore, import.meta.hot))
}
