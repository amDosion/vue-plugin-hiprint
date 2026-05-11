/**
 * stores/template.ts — useTemplateStore: template lifecycle + dirty tracking.
 *
 * Owns the "current template" concept: load, save, dirty flag, validation.
 * Delegates to canvas store for panel/element editing, and history store for
 * undo/redo. loadFromJson orchestrates a coordinated reset across all stores.
 *
 * V2 reference:
 *  - src/hiprint-v2/template/print-template.js — constructor with `template`
 *    option + getJson() + update() (replace whole JSON)
 *  - src/hiprint-v2/template/update.js          — update flow rebuilds panels
 *
 * Validation: uses Zod `templateSchema` from '@hiprint-v3/schemas' which is a
 * superset of V1/V2 PrintTemplate JSON (Invariant #13). All legacy templates
 * parse without modification.
 */

import { defineStore, acceptHMRUpdate } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { useCanvasStore, type Panel, type CanvasElement } from './canvas'
import { useHistoryStore } from './history'
import { templateSchema, type TemplateJson as SchemaTemplateJson } from '@hiprint-v3/schemas'

// ============ Types ============

/**
 * Persistable template JSON shape — superset-compatible with V1/V2.
 * Re-exported from '@hiprint-v3/schemas' so business consumers get one stable
 * import path.
 */
export type TemplateJson = SchemaTemplateJson

/**
 * Internal "PrintTemplate-like" handle. V2's PrintTemplate is a class with
 * jQuery + DOM coupling; V3 stores a plain descriptor (json + id) and lets
 * components own the DOM. P19 compat layer reconstitutes a class facade.
 */
export interface PrintTemplateHandle {
  id: string
  json: TemplateJson
}

// ============ Helpers ============

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

/**
 * Validate template JSON via Zod schema. Superset-compatible — accepts any
 * V1/V2 template shape (Invariant #13). Throws ZodError on structural failure.
 */
function validateTemplateInput(input: unknown): TemplateJson {
  return templateSchema.parse(input)
}

/**
 * Normalize panel JSON to canvas-store Panel shape: assign ids where missing
 * and ensure printElements have ids. Mirrors V2 PrintPanel/element auto-id
 * behavior (PM-005: crypto.randomUUID).
 */
function normalizePanel(raw: Partial<Panel>, index: number): Panel {
  const elements = Array.isArray(raw.printElements) ? raw.printElements : []
  const printElements: CanvasElement[] = elements.map((el) => {
    const elObj = (el ?? {}) as Partial<CanvasElement>
    return {
      tid: elObj.tid ?? '',
      options: (elObj.options as Record<string, unknown> | undefined) ?? {},
      ...elObj,
      id: elObj.id ?? generateId(),
    } as CanvasElement
  })
  return {
    index,
    name: String(index + 1),
    width: 210,
    height: 297,
    ...raw,
    id: (raw.id as string | undefined) ?? generateId(),
    printElements,
  } as Panel
}

// ============ Store ============

export const useTemplateStore = defineStore('hiprint-v3-template', () => {
  // -------- State --------

  /** shallowRef: handle identity is what matters, not deep changes. */
  const currentTemplate = shallowRef<PrintTemplateHandle | null>(null)

  const templateId = ref<string | null>(null)

  /** True after any edit since last load/save. Composables use this to gate save. */
  const dirty = ref<boolean>(false)

  /** Loading flag for async pipelines (P15 print-from-remote, etc.). */
  const loading = ref<boolean>(false)

  // -------- Getters --------

  const isLoaded = computed<boolean>(() => currentTemplate.value !== null)

  /**
   * Current JSON snapshot computed from canvas store. Caller gets a fresh
   * object every time so they can mutate without aliasing live state.
   */
  const currentJson = computed<TemplateJson>(() => getJson())

  // -------- Actions --------

  /**
   * Load template from JSON. Resets canvas + history stores so undo can't
   * roll past the load boundary (matches V2 update.js behavior).
   */
  function loadFromJson(json: unknown): void {
    const canvas = useCanvasStore()
    const history = useHistoryStore()

    loading.value = true
    try {
      const valid = validateTemplateInput(json)

      // Build normalized panels with ids. Schema PanelJson is loose (e.g. name
      // may be number | string) so we cast through unknown into the internal
      // Partial<Panel> shape — boundary normalization is normalizePanel's job.
      const normalized = valid.panels.map((p, i) =>
        normalizePanel(p as unknown as Partial<Panel>, i)
      )

      // Reset canvas + write new panels. We touch panels directly (vs. addPanel
      // loop) so we get a single reactive write.
      canvas.$reset()
      canvas.panels = normalized
      canvas.activePanelId = normalized[0]?.id ?? null

      // Clear history then seed initial snapshot.
      history.clear()
      history.pushSnapshot()

      const id = generateId()
      templateId.value = id
      currentTemplate.value = { id, json: valid }
      dirty.value = false
    } catch (err) {
      console.error('[hiprint] loadFromJson failed:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Mark dirty=false. Persistence (network / localStorage) is the caller's
   * job — this store just tracks the flag.
   */
  function save(): TemplateJson {
    const json = getJson()
    if (currentTemplate.value) {
      currentTemplate.value = { ...currentTemplate.value, json }
    }
    dirty.value = false
    return json
  }

  /**
   * Serialize current canvas to template JSON. Caller may pass to
   * BrowserPrintStrategy / SilentPrintStrategy (see usePrintService in business
   * consumer).
   */
  function getJson(): TemplateJson {
    const canvas = useCanvasStore()
    // Internal Panel/CanvasElement shapes are a normalized subset of the
    // persistable JSON; cast through unknown at the boundary. Any consumer
    // round-tripping the result through templateSchema.parse() will re-validate.
    return {
      panels: canvas.panels.map((p) => ({
        ...p,
        printElements: p.printElements.map((el) => ({ ...el })),
      })),
    } as unknown as TemplateJson
  }

  /** Clear template + canvas + history. Used by "new template" UI. */
  function clear(): void {
    const canvas = useCanvasStore()
    const history = useHistoryStore()
    canvas.$reset()
    history.clear()
    currentTemplate.value = null
    templateId.value = null
    dirty.value = false
  }

  /** Explicit dirty toggle (composables call after observed canvas edits). */
  function setDirty(d: boolean): void {
    dirty.value = !!d
  }

  return {
    // state
    currentTemplate,
    templateId,
    dirty,
    loading,
    // getters
    isLoaded,
    currentJson,
    // actions
    loadFromJson,
    save,
    getJson,
    clear,
    setDirty,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useTemplateStore, import.meta.hot))
}
