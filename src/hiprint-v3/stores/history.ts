/**
 * stores/history.ts — useHistoryStore: undo/redo over canvas snapshots.
 *
 * Wraps @vueuse/core's useManualRefHistory around a snapshot ref. The canvas
 * store stays the source of truth; history just records deep-cloned snapshots
 * on explicit pushSnapshot() (composables call this after grouped edits).
 *
 * V2 reference:
 *  - src/hiprint-v2/template/history.js — addHistoryEntry / undo / redo
 *    (event-bus driven; V3 swaps to direct store-driven semantics).
 *
 * Why manual (not auto useRefHistory):
 *  - Designers move/resize elements at 60fps; auto-tracking would explode
 *    capacity. Composables decide when to commit (e.g. on drag-end).
 *
 * Snapshot shape mirrors a subset of useCanvasStore state; restoring writes
 * back via canvas store. structuredClone provides deep cloning without DOM
 * concerns (no jQuery / no live nodes in stores by design).
 */

import { defineStore, acceptHMRUpdate } from 'pinia'
import { computed, ref, toRaw } from 'vue'
import { useManualRefHistory } from '@vueuse/core'
import { useCanvasStore, type Panel } from './canvas'

/**
 * Deep snapshot of canvas-relevant state. Excludes scale/gridSize — those are
 * view preferences, not undo-able (V1/V2 behavior).
 */
export interface TemplateSnapshot {
  panels: Panel[]
  activePanelId: string | null
  timestamp: number
}

const DEFAULT_CAPACITY = 50

/**
 * Deep-clone snapshot. structuredClone preserves nested Maps/Sets/Dates,
 * which JSON.parse(JSON.stringify(...)) would lose. Fallback for legacy envs.
 *
 * IMPORTANT: Vue 3 reactive Proxy objects throw DataCloneError under
 * structuredClone (browser native restriction). Callers pass live store
 * refs into this fn (canvas.panels is reactive), so we must `toRaw` first
 * to unwrap the proxy chain before native cloning. Without this, every
 * snapshot push and every undo/redo restore crashes.
 */
function clone<T>(v: T): T {
  const raw = toRaw(v) as T
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(raw)
    } catch {
      // Fall through to JSON path if raw still contains non-cloneable values
      // (e.g. functions stored in element formatter/styler — these are dropped
      // intentionally because history snapshots are pure data).
    }
  }
  return JSON.parse(JSON.stringify(raw)) as T
}

export const useHistoryStore = defineStore('hiprint-v3-history', () => {
  // -------- Internal source ref (manual ref history tracks this) --------

  const currentSnapshot = ref<TemplateSnapshot>({
    panels: [],
    activePanelId: null,
    timestamp: Date.now(),
  })

  /** Capacity is reactive so setCapacity() can adjust at runtime. */
  const capacity = ref<number>(DEFAULT_CAPACITY)

  // useManualRefHistory exposes commit/undo/redo/clear + undoStack/redoStack.
  // clone:true → vueuse deep-clones on each commit; we ALSO clone on read in
  // pushSnapshot for defensive isolation (snapshot must never alias live store).
  const manual = useManualRefHistory(currentSnapshot, {
    capacity: capacity.value,
    clone: true,
  })

  // -------- Getters --------

  /** Whether undo() will succeed. */
  const canUndo = computed<boolean>(() => manual.canUndo.value)

  /** Whether redo() will succeed. */
  const canRedo = computed<boolean>(() => manual.canRedo.value)

  /**
   * History entries (newest-first). Reflects vueuse's UseRefHistoryRecord shape
   * but typed for caller convenience.
   */
  const historyEntries = computed<TemplateSnapshot[]>(() =>
    manual.history.value.map((rec) => rec.snapshot)
  )

  /** Current undo stack position (0 = at oldest). */
  const pos = computed<number>(
    () => manual.history.value.length - 1 - manual.undoStack.value.length
  )

  // -------- Actions --------

  /**
   * Capture current canvas state as a new history entry. Composables should
   * call this on logical edit boundaries (drag-end, paste, delete, etc.).
   */
  function pushSnapshot(): void {
    const canvas = useCanvasStore()
    currentSnapshot.value = clone({
      panels: canvas.panels,
      activePanelId: canvas.activePanelId,
      timestamp: Date.now(),
    })
    manual.commit()
  }

  /** Apply a snapshot to the canvas store (used by undo/redo restore). */
  function applySnapshot(snap: TemplateSnapshot): void {
    const canvas = useCanvasStore()
    // Clone again before write so internal manual.history records stay
    // immutable even if downstream mutates panels in place.
    canvas.panels = clone(snap.panels)
    canvas.activePanelId = snap.activePanelId
    canvas.clearSelection()
  }

  /**
   * Undo: roll back currentSnapshot, then apply to canvas. vueuse's undo()
   * moves source ref to previous record automatically; we then mirror to canvas.
   */
  function undo(): void {
    if (!manual.canUndo.value) return
    manual.undo()
    applySnapshot(currentSnapshot.value)
  }

  /** Redo: opposite of undo. */
  function redo(): void {
    if (!manual.canRedo.value) return
    manual.redo()
    applySnapshot(currentSnapshot.value)
  }

  /**
   * Wipe history. Use when loading a new template (useTemplateStore.loadFromJson
   * calls this).
   */
  function clear(): void {
    manual.clear()
    // Reset baseline to current canvas state so the next push isn't relative to
    // a stale empty snapshot.
    const canvas = useCanvasStore()
    currentSnapshot.value = clone({
      panels: canvas.panels,
      activePanelId: canvas.activePanelId,
      timestamp: Date.now(),
    })
  }

  /**
   * Adjust history capacity. vueuse's capacity is set at construction; we
   * rebuild by trimming undoStack manually. Newer entries kept; older dropped.
   */
  function setCapacity(n: number): void {
    if (!Number.isFinite(n) || n < 1) {
      console.warn('[hiprint] setCapacity ignored: must be positive integer', n)
      return
    }
    capacity.value = Math.floor(n)
    // Trim undoStack if oversized. vueuse stores newest-first.
    const stack = manual.undoStack.value
    if (stack.length > capacity.value) {
      manual.undoStack.value = stack.slice(0, capacity.value)
    }
  }

  return {
    // state
    historyEntries,
    pos,
    capacity,
    // getters
    canUndo,
    canRedo,
    // actions
    pushSnapshot,
    undo,
    redo,
    clear,
    setCapacity,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useHistoryStore, import.meta.hot))
}
