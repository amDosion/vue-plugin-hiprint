/**
 * useHiprintCanvas.ts — V3 reactive canvas composable.
 *
 * Thin facade over `useCanvasStore` (Pinia) that exposes plain refs +
 * functions, so business consumers do not need to learn the Pinia API.
 *
 * V2 / V1 equivalent surface:
 *   PrintTemplate.printPanels  → panels
 *   PrintTemplate.editingPanel → activePanel
 *   PrintTemplate.selected     → selectedElements
 *   PrintTemplate.scale        → scale
 *
 * Invariants preserved through the store (see ADR-0011):
 *   #10 Canvas keeps ≥ 1 panel (removePanel warns + no-ops on last)
 *   PM-005 Panel + element ids are auto-assigned crypto.randomUUID()
 *
 * Why not just expose the Pinia store directly?
 *  - Future-proofing: consumers shouldn't see Pinia in their type signatures.
 *    If we ever swap the state backend (e.g. an actor store), composables
 *    can keep the same `UseHiprintCanvasReturn` shape.
 *  - Discoverability: a single `import { useHiprintCanvas } from 'vue-plugin-hiprint/v3'`
 *    is easier to find in vue-admin-main than digging through stores.
 *
 * No jQuery. No DOM. Pure reactive data.
 */

import { storeToRefs } from 'pinia'
import { computed, type ComputedRef, type Ref } from 'vue'
import {
  useCanvasStore,
  type CanvasElement,
  type Panel,
  type SelectionMode,
} from '@hiprint-v3/stores'

// ============ Public types ============

export interface UseHiprintCanvasReturn {
  // -------- Reactive state --------
  /** All panels (immutable view; do not mutate). */
  panels: ComputedRef<readonly Panel[]>
  /** Currently active (editing) panel, or null if no panels. */
  activePanel: ComputedRef<Panel | null>
  /** Currently selected elements (across panels). */
  selectedElements: ComputedRef<readonly CanvasElement[]>
  /** Canvas zoom (1 = 100 %). Two-way bindable via v-model if needed. */
  scale: Ref<number>
  /** Grid step in pt. Two-way bindable. */
  gridSize: Ref<number>

  // -------- Panel actions --------
  setActivePanel(id: string): void
  addPanel(panel: Partial<Panel> & Pick<Panel, 'width' | 'height'>): Panel
  removePanel(id: string): void

  // -------- Element actions --------
  addElement(
    panelId: string,
    element: Partial<CanvasElement> & Pick<CanvasElement, 'tid'>
  ): CanvasElement | null
  removeElement(panelId: string, elementId: string): void
  updateElement(panelId: string, elementId: string, patch: Partial<CanvasElement>): void
  moveElementBetweenPanels(
    srcPanelId: string,
    dstPanelId: string,
    elementId: string
  ): CanvasElement | null

  // -------- Selection --------
  selectElement(id: string, mode?: SelectionMode): void
  selectMultiple(ids: readonly string[]): void
  clearSelection(): void
  moveSelection(dx: number, dy: number): void

  // -------- Imperative view state --------
  setScale(s: number): void
  setGridSize(g: number): void
}

// ============ Implementation ============

/**
 * Compose the canvas state into a reactive return surface. Repeated calls in
 * the same Pinia scope return references to the same underlying store, so
 * multiple components / composables stay in sync automatically.
 *
 * IMPORTANT: This composable must be called inside a Vue setup() / component
 * lifecycle (Pinia rule). Calling outside without an active Pinia instance
 * will throw — consumers using `setActivePinia(createPinia())` in tests are OK.
 */
export function useHiprintCanvas(): UseHiprintCanvasReturn {
  const store = useCanvasStore()
  const { scale, gridSize, activePanel, selectedElements } = storeToRefs(store)

  // panels is exposed as a ComputedRef<readonly Panel[]> so callers cannot
  // mutate the array directly (they must go through the action functions).
  // storeToRefs would expose it as a writable Ref — wrapping in `computed`
  // narrows the contract to readonly while still tracking reactive updates.
  const panelsRO: ComputedRef<readonly Panel[]> = computed(() => store.panels)

  return {
    // state
    panels: panelsRO,
    activePanel,
    selectedElements: selectedElements as unknown as ComputedRef<readonly CanvasElement[]>,
    scale,
    gridSize,
    // panel actions
    setActivePanel: store.setActivePanel,
    addPanel: store.addPanel,
    removePanel: store.removePanel,
    // element actions
    addElement: store.addElement,
    removeElement: store.removeElement,
    updateElement: store.updateElement,
    moveElementBetweenPanels: store.moveElementBetweenPanels,
    // selection
    selectElement: store.selectElement,
    selectMultiple: store.selectMultiple,
    clearSelection: store.clearSelection,
    moveSelection: store.moveSelection,
    // view state
    setScale: store.setScale,
    setGridSize: store.setGridSize,
  }
}

