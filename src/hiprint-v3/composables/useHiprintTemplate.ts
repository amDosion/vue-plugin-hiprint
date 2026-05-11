/**
 * useHiprintTemplate.ts — V3 reactive template-lifecycle composable.
 *
 * Coordinates `useTemplateStore` (load/save/dirty) + `useHistoryStore`
 * (undo/redo) into a single surface aligned with how vue-admin-main expects
 * to drive the designer (loadTemplate / getJson / clear / undo / redo).
 *
 * V2 / V1 equivalent surface:
 *   PrintTemplate.update(json) → loadFromJson(json)
 *   PrintTemplate.getJson()    → getJson()
 *   PrintTemplate.clear()      → clear()
 *   PrintTemplate.undo()       → undo()
 *   PrintTemplate.redo()       → redo()
 *
 * Async loadFromJson:
 *   Synchronous under the hood today (Zod validate + canvas write), but
 *   exposed as `Promise<void>` so future async hooks (server-side template
 *   validation, lazy etype provider resolution) can land without breaking
 *   callers. Modern Vue patterns prefer `await loadFromJson(...)` anyway.
 *
 * Invariants:
 *   - loadFromJson resets canvas + history (undo cannot cross load boundary)
 *   - dirty flag stays false after a successful load
 *   - getJson returns a fresh object each call (caller-safe to mutate)
 *
 * No jQuery. No DOM. Pure reactive data.
 */

import { storeToRefs } from 'pinia'
import { computed, type ComputedRef, type Ref } from 'vue'
import {
  useTemplateStore,
  useHistoryStore,
  type TemplateJson,
  type CanvasElement,
  type Panel,
} from '@hiprint-v3/stores'

// useTemplateStore re-exports TemplateJson from schemas — re-export here too
// so consumers can `import type { TemplateJson } from '.../composables'`.
export type { TemplateJson, CanvasElement, Panel }

// ============ Public types ============

export interface UseHiprintTemplateReturn {
  /** Current template JSON as a reactive computed. Null when never loaded. */
  currentJson: ComputedRef<TemplateJson | null>
  /** True if a template is loaded (loadFromJson succeeded since last clear). */
  isLoaded: ComputedRef<boolean>
  /** Mutated indirectly via canvas edits + setDirty. */
  isDirty: Ref<boolean>
  /** True while loadFromJson is mid-flight (try/finally toggled). */
  isLoading: Ref<boolean>
  /** History gate flags. */
  canUndo: ComputedRef<boolean>
  canRedo: ComputedRef<boolean>

  /**
   * Load (and validate) template JSON. Resets canvas + history.
   * Throws if validation fails (caller should catch + surface to UI).
   */
  loadFromJson(json: unknown): Promise<void>
  /**
   * Snapshot canvas state into the template handle + return the JSON.
   * Returns null if no template is loaded (never happens once loadFromJson
   * has run, but the type stays defensive for first-render callers).
   */
  save(): TemplateJson | null
  /** Read current canvas state without affecting dirty flag. */
  getJson(): TemplateJson
  /** Wipe template + canvas + history. */
  clear(): void
  undo(): void
  redo(): void
}

// ============ Implementation ============

export function useHiprintTemplate(): UseHiprintTemplateReturn {
  const tpl = useTemplateStore()
  const hist = useHistoryStore()

  // storeToRefs preserves reactivity for primitive refs without unwrapping.
  const { dirty: isDirty, loading: isLoading, isLoaded } = storeToRefs(tpl)
  const { canUndo, canRedo } = storeToRefs(hist)

  // currentJson must be exposed as ComputedRef<TemplateJson | null>:
  //  - Template store exposes a non-null computed even when no template
  //    is loaded (it serializes whatever canvas state it has — usually an
  //    empty panels: []). We narrow to null at the composable boundary so
  //    UI checks like `if (currentJson.value)` mean "an explicit load
  //    happened" rather than "canvas not empty".
  const currentJson: ComputedRef<TemplateJson | null> = computedNullableJson(tpl)

  /** Promise wrapper so caller-side await works (forward-compat with async hooks). */
  async function loadFromJson(json: unknown): Promise<void> {
    tpl.loadFromJson(json)
  }

  function save(): TemplateJson | null {
    if (!tpl.isLoaded) return null
    return tpl.save()
  }

  function getJson(): TemplateJson {
    return tpl.getJson()
  }

  function clear(): void {
    tpl.clear()
  }

  function undo(): void {
    hist.undo()
  }
  function redo(): void {
    hist.redo()
  }

  return {
    currentJson,
    isLoaded,
    isDirty,
    isLoading,
    canUndo,
    canRedo,
    loadFromJson,
    save,
    getJson,
    clear,
    undo,
    redo,
  }
}

// ============ Helpers ============

/** Compute current template JSON, null when no load has occurred. */
function computedNullableJson(
  tpl: ReturnType<typeof useTemplateStore>
): ComputedRef<TemplateJson | null> {
  return computed<TemplateJson | null>(() =>
    tpl.isLoaded ? (tpl.currentJson as TemplateJson) : null
  )
}
