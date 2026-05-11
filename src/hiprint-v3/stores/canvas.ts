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

    if (selectedElementIds.value.has(elementId)) {
      const next = new Set(selectedElementIds.value)
      next.delete(elementId)
      selectedElementIds.value = next
    }
  }

  /**
   * Patch an element immutably. Returns nothing; reactive panels array is
   * replaced so Vue diff fires.
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
    nextEls[eIdx] = applyElementPatch(oldEl, patch)
    const nextPanels = panels.value.slice()
    nextPanels[pIdx] = { ...panel, printElements: nextEls }
    panels.value = nextPanels
  }

  /** Clear all selection. */
  function clearSelection(): void {
    if (selectedElementIds.value.size === 0) return
    selectedElementIds.value = new Set()
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
  }

  /** Replace selection with a set of ids. */
  function selectMultiple(ids: readonly string[]): void {
    selectedElementIds.value = new Set(ids)
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
  }

  return {
    // state
    panels,
    selectedElementIds,
    activePanelId,
    scale,
    gridSize,
    // getters
    activePanel,
    selectedElements,
    allElements,
    panelCount,
    // actions
    addPanel,
    removePanel,
    setActivePanel,
    addElement,
    removeElement,
    updateElement,
    clearSelection,
    selectElement,
    selectMultiple,
    moveSelection,
    moveElementBetweenPanels,
    setScale,
    setGridSize,
    $reset,
  }
})

// HMR safety: Pinia re-applies state diff across module reloads.
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useCanvasStore, import.meta.hot))
}
