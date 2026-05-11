/**
 * element-base.ts — BaseElement (V3 abstraction).
 *
 * Pure-data, jQuery-free replacement for V1/V2 BasePrintElement. Wraps an
 * element record (id + tid + options + printElementType) in a Vue `reactive`
 * proxy so canvas/property-panel stores observe mutations directly.
 *
 * DOM rendering moves to P15.2 (print renderer) + P17 (Vue components).
 * BaseElement is a *value object* — produce one via `createBaseElement()` and
 * pass it through stores; never call DOM helpers from this layer.
 *
 * Invariants (V3 必须保留, ADR-0011):
 *  - id is crypto.randomUUID() (V1 line 690).
 *  - clone() returns a structurally independent copy (deep clone via
 *    structuredClone + toRaw). Mutating the clone MUST NOT affect original.
 *  - update(patch) returns a NEW BaseElement (immutable patching); the
 *    underlying record is also patched in-place inside the reactive proxy so
 *    Vue components observing this id see the change.
 *  - getJson() returns a plain (non-reactive) snapshot suitable for
 *    persistence / JSON.stringify.
 *
 * V2 reference: src/hiprint-v2/core/print-element-entity.js (jQuery-coupled).
 */

import { reactive, toRaw, isReactive } from 'vue'
import type { ElementTypeDef } from './group'

/**
 * Minimal printElementType reference embedded in a BaseElement. Only fields
 * needed at runtime (other defaults come from the registry via tid).
 */
export interface ElementTypeRef {
  tid?: string
  type: string
  title?: string
  field?: string
  /** Free-form: V1 superset compatibility (formatters / stylers / getData). */
  [key: string]: unknown
}

/**
 * Plain element record (the pure-data JSON shape). Matches
 * `@hiprint-v3/schemas` ElementJson minus runtime-only id (which V3 always
 * normalizes via {@link createBaseElement}).
 */
export interface ElementRecord {
  id: string
  tid: string
  options: Record<string, unknown>
  printElementType: ElementTypeRef
  templateId?: string
}

/**
 * The reactive runtime wrapper around an ElementRecord. Components read
 * `el.record.options.width` etc.; canvas store mutates via {@link update}.
 *
 * Note: methods are arrow-function-bound at construction so consumers can
 * destructure (e.g. `const { update } = baseElement`).
 */
export interface BaseElement {
  /** Reactive plain-data record. */
  readonly record: ElementRecord
  /** Stable id (forwarded from record for convenience). */
  readonly id: string
  /** Element type tid (forwarded from record for convenience). */
  readonly tid: string
  /** Renderer type (forwarded from printElementType.type). */
  readonly type: string

  /** Return a plain (non-reactive) deep-clone JSON snapshot. */
  getJson(): ElementRecord
  /** Return a structurally independent BaseElement with a fresh id. */
  clone(): BaseElement
  /** Apply an immutable patch (returns new BaseElement; in-place sync to record). */
  update(patch: Partial<ElementRecord>): BaseElement
}

/**
 * Internal — generate a deterministic id. Always uses crypto.randomUUID()
 * (Node 19+ / modern browsers). Older runtimes get the fallback.
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // SSR / older runtime fallback (kept for parity with V2 line 65).
  return (
    Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
  )
}

/**
 * Internal — produce a structurally independent copy of an ElementRecord.
 * Uses structuredClone when available (modern runtimes); falls back to
 * JSON round-trip. Strips Vue reactive proxies first via toRaw.
 */
function deepCloneRecord(record: ElementRecord): ElementRecord {
  const raw = isReactive(record) ? toRaw(record) : record
  // structuredClone handles cyclic refs + Date / Map / Set. We strip
  // functions (formatter / styler) via JSON fallback because functions are
  // not cloneable. V1 schema preserves these as strings post-toString().
  try {
    return structuredClone(raw)
  } catch {
    // Functions / DOM nodes → fall back to JSON round-trip (strips functions).
    return JSON.parse(JSON.stringify(raw)) as ElementRecord
  }
}

/**
 * Create a new BaseElement wrapping a reactive record.
 *
 * @param init  Partial record fields. `id` auto-generated when omitted.
 */
export function createBaseElement(init: {
  tid: string
  printElementType: ElementTypeRef
  options?: Record<string, unknown>
  id?: string
  templateId?: string
}): BaseElement {
  if (!init || !init.tid) {
    throw new Error('[hiprint] createBaseElement: tid is required')
  }
  if (!init.printElementType || !init.printElementType.type) {
    throw new Error(
      '[hiprint] createBaseElement: printElementType.type is required'
    )
  }

  const record = reactive<ElementRecord>({
    id: init.id ?? generateId(),
    tid: init.tid,
    options: { ...(init.options ?? {}) },
    printElementType: { ...init.printElementType },
    ...(init.templateId !== undefined ? { templateId: init.templateId } : {}),
  })

  return buildBaseElement(record)
}

/**
 * Build a BaseElement from an existing record. Used by template loader when
 * rehydrating from JSON.
 */
export function fromRecord(record: ElementRecord): BaseElement {
  if (!record || !record.id || !record.tid) {
    throw new Error('[hiprint] fromRecord: record.id and tid are required')
  }
  const reactiveRec = isReactive(record) ? record : reactive(record)
  return buildBaseElement(reactiveRec)
}

function buildBaseElement(record: ElementRecord): BaseElement {
  const api = {
    record,
    get id(): string {
      return record.id
    },
    get tid(): string {
      return record.tid
    },
    get type(): string {
      return record.printElementType.type
    },

    getJson(): ElementRecord {
      return deepCloneRecord(record)
    },

    clone(): BaseElement {
      const cloned = deepCloneRecord(record)
      cloned.id = generateId()
      return createBaseElement({
        tid: cloned.tid,
        printElementType: cloned.printElementType,
        options: cloned.options,
        id: cloned.id,
        ...(cloned.templateId !== undefined ? { templateId: cloned.templateId } : {}),
      })
    },

    update(patch: Partial<ElementRecord>): BaseElement {
      // Apply patch in-place on reactive record so observers see updates.
      if (patch.options) {
        record.options = { ...record.options, ...patch.options }
      }
      if (patch.printElementType) {
        record.printElementType = {
          ...record.printElementType,
          ...patch.printElementType,
        }
      }
      if (patch.tid !== undefined) record.tid = patch.tid
      if (patch.templateId !== undefined) record.templateId = patch.templateId
      // id is immutable post-creation; ignored even if supplied.
      return api
    },
  } satisfies BaseElement

  return api
}

/**
 * Internal helper for tests — produce an isolated clone without bumping id.
 * Not exported through the public barrel.
 */
export function _snapshot(el: BaseElement): ElementRecord {
  return deepCloneRecord(el.record)
}
