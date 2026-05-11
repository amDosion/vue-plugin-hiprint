/**
 * registry.ts — PrintElementTypeRegistry (V3 data-layer singleton).
 *
 * V1 source: bundle.js line 8957-9054 (class `a`).
 * V2 source: src/hiprint-v2/core/registry.js (JS port).
 * V3 改进:
 *  - HMR-safe singleton via `globalThis.__hiprintV3RegistrySingleton` (ADR-0007).
 *  - Strict TS with explicit types for moduleName → group bucket map.
 *  - Replaced V1 `Object.defineProperty(t, 'instance', {get})` (V1 form) and V2
 *    factory pattern with a `getInstance()` exported singleton.
 *
 * Invariants (V3 必须保留, see ADR-0011):
 *  - R1 PM-007: addPrintElementTypes 双层 dedup (group bucket + flat cache).
 *  - R1 PM-008: removePrintElementTypes dotted prefix (`order` 不删 `order_v2.*`).
 *  - setDynamicFields/setElementTypeGroups/appendElementTypeGroups: moduleName required
 *    (empty / null / undefined → throw — V1 line 13261-13286 fix).
 *  - tid 重复替换时 console.warn (V1 line 8989-8993).
 *  - getDynamic empty `t` rejected (R1 fix).
 */

import type {
  ElementTypeDef,
  ElementTypeGroupDef,
} from './group'

/** Internal HMR-safe singleton storage key. */
const GLOBAL_KEY = '__hiprintV3RegistrySingleton'

/**
 * Resolve module name → bucket key. `''` / null / undefined → '_default'.
 *
 * V1: bundle.js line 8961 (`var n = t || "_default";`).
 */
export function formatterModule(moduleName?: string | null): string {
  return moduleName ? moduleName : '_default'
}

/**
 * PrintElementTypeRegistry — pure data store mapping moduleName → group list.
 *
 * Layout:
 *  - `allElementTypes` (flat): every registered element type across all modules
 *    (fast lookup by tid).
 *  - `_modules` (Map): moduleName → group[] (the source-of-truth bucket).
 *
 * V2 stored buckets dynamically on `this[moduleName]`; V3 uses a Map so TS
 * strict mode + index-signature inference is clean.
 */
export class PrintElementTypeRegistry {
  /** Flat cache of all element types across all modules. */
  public allElementTypes: ElementTypeDef[] = []

  /** Internal module → groups[] map. */
  private readonly _modules: Map<string, ElementTypeGroupDef[]> = new Map()

  /**
   * Register element type groups under a module.
   * Implements [R1 PM-007] dual dedup (bucket + flat cache).
   *
   * @param moduleName  module bucket key (falsy → throws)
   * @param groups      array of ElementTypeGroupDef
   */
  register(moduleName: string, groups: ElementTypeGroupDef[]): void {
    if (!moduleName) {
      throw new Error('[hiprint] register: moduleName is required')
    }
    if (!Array.isArray(groups)) return

    // Collect incoming tids for replacement detection.
    const incomingTids: Record<string, true> = {}
    groups.forEach((g) => {
      ;(g.printElementTypes ?? []).forEach((et) => {
        if (et && et.tid) incomingTids[et.tid] = true
      })
    })

    // Bucket-level dedup: filter old groups, keep tids not overridden by incoming.
    const existing = this._modules.get(moduleName)
    if (existing) {
      const dedupedOld: ElementTypeGroupDef[] = []
      existing.forEach((oldGroup) => {
        if (!oldGroup) return
        const oldTypes = oldGroup.printElementTypes ?? []
        const keptTypes = oldTypes.filter((et) => et && !incomingTids[et.tid])
        if (keptTypes.length === 0) return // entire group replaced
        if (keptTypes.length !== oldTypes.length) {
          oldGroup.printElementTypes = keptTypes
        }
        dedupedOld.push(oldGroup)
      })
      this._modules.set(moduleName, dedupedOld.concat(groups))
    } else {
      this._modules.set(moduleName, groups.slice())
    }

    // Flat cache dedup with warn (R1 PM-007).
    groups.forEach((g) => {
      ;(g.printElementTypes ?? []).forEach((et) => {
        const tid = et && et.tid
        if (tid) {
          let existed = false
          this.allElementTypes = this.allElementTypes.filter((other) => {
            if (other && other.tid === tid) {
              existed = true
              return false
            }
            return !!other
          })
          if (existed) {
            console.warn(
              '[hiprint] tid ' + tid + ' already registered in module ' + moduleName +
                ', replacing'
            )
          }
        }
        this.allElementTypes.push(et)
      })
    })
  }

  /**
   * Remove a module + its element types (and any tid with dotted-prefix match).
   * Implements [R1 PM-008] dotted prefix to avoid sibling sub-string deletion.
   *
   * Examples:
   *   unregister('order') deletes 'order' AND 'order.item' but NOT 'order_v2.item'.
   *
   * @param moduleName  exact module key (falsy → warn + no-op)
   * @param tids        if supplied, remove only listed tids (not whole module)
   */
  unregister(moduleName: string, tids?: readonly string[]): void {
    if (!moduleName) {
      console.warn('[hiprint] unregister called without moduleName')
      return
    }

    // Targeted tid removal (selective)
    if (tids && tids.length > 0) {
      const tidSet = new Set(tids)
      const existing = this._modules.get(moduleName)
      if (existing) {
        const updated: ElementTypeGroupDef[] = []
        existing.forEach((g) => {
          if (!g) return
          const kept = (g.printElementTypes ?? []).filter(
            (et) => et && !tidSet.has(et.tid)
          )
          if (kept.length === 0) return
          if (kept.length !== (g.printElementTypes ?? []).length) {
            g.printElementTypes = kept
          }
          updated.push(g)
        })
        if (updated.length === 0) {
          this._modules.delete(moduleName)
        } else {
          this._modules.set(moduleName, updated)
        }
      }
      this.allElementTypes = this.allElementTypes.filter(
        (et) => et && et.tid && !tidSet.has(et.tid)
      )
      return
    }

    // Whole-module removal with dotted-prefix flat-cache cleanup
    const prefix = moduleName + '.'
    this._modules.delete(moduleName)
    this.allElementTypes = this.allElementTypes.filter((et) => {
      if (!et || !et.tid) return false
      return !(et.tid === moduleName || et.tid.indexOf(prefix) === 0)
    })
  }

  /**
   * Overwrite a module's groups (V1 setDynamicFields / setElementTypeGroups).
   * Equivalent to `unregister(moduleName)` + `register(moduleName, groups)`.
   *
   * Required by V1 line 13275: empty moduleName → throws.
   */
  setDynamic(moduleName: string, groups: ElementTypeGroupDef[]): void {
    if (!moduleName) {
      throw new Error('[hiprint] setDynamic: moduleName is required')
    }
    this.unregister(moduleName)
    this.register(moduleName, groups)
  }

  /**
   * Get all element types across all modules (flat).
   */
  getAll(): readonly ElementTypeDef[] {
    return this.allElementTypes.slice()
  }

  /**
   * Get groups for a single module. `''` / null / undefined → resolved to
   * '_default' via {@link formatterModule}.
   */
  getByModule(moduleName?: string | null): readonly ElementTypeGroupDef[] {
    const key = formatterModule(moduleName)
    return this._modules.get(key) ?? []
  }

  /**
   * Find element type by exact tid (across all modules).
   */
  getByTid(tid: string): ElementTypeDef | undefined {
    if (!tid) return undefined
    return this.allElementTypes.find((et) => et && et.tid === tid)
  }

  /**
   * Update an element type by transformer. Mirrors V2 updateElementType.
   * Returns the new type or undefined when tid not found.
   *
   * Note: This updates BOTH the flat cache AND the source-of-truth bucket
   * (V2 had a TODO to sync; V3 fixes it).
   */
  update(
    tid: string,
    transformer: (prev: ElementTypeDef | undefined) => ElementTypeDef
  ): ElementTypeDef | undefined {
    const prev = this.getByTid(tid)
    const next = transformer(prev)
    if (!next) return prev

    const idx = this.allElementTypes.findIndex((e) => e && e.tid === tid)
    if (idx >= 0) {
      this.allElementTypes.splice(idx, 1, next)
    }

    // Sync bucket(s) — V3 fix vs V2 TODO.
    this._modules.forEach((groups) => {
      groups.forEach((g) => {
        if (!g || !g.printElementTypes) return
        const i = g.printElementTypes.findIndex((e) => e && e.tid === tid)
        if (i >= 0) g.printElementTypes.splice(i, 1, next)
      })
    })

    return next
  }

  /**
   * Reset the registry to empty state.
   */
  clear(): void {
    this.allElementTypes = []
    this._modules.clear()
  }

  /**
   * Get all module names currently registered.
   */
  getModuleNames(): readonly string[] {
    return Array.from(this._modules.keys())
  }
}

// ============ HMR-safe singleton accessor ============
//
// We cache the instance on globalThis so Vite HMR reloads of this module do
// not produce a second instance. See ADR-0007 + V2 registry.js line 167-172.

interface GlobalRegistryCache {
  [GLOBAL_KEY]?: PrintElementTypeRegistry
}

function getGlobalCache(): GlobalRegistryCache {
  return globalThis as unknown as GlobalRegistryCache
}

/**
 * Get the global registry instance (HMR-safe via `globalThis` cache).
 */
export function getInstance(): PrintElementTypeRegistry {
  const g = getGlobalCache()
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new PrintElementTypeRegistry()
  }
  return g[GLOBAL_KEY]
}

/**
 * Reset the singleton (test-only). Production code MUST NOT call this; it
 * would orphan element types already referenced by live PrintTemplate instances.
 */
export function _resetInstance(): void {
  const g = getGlobalCache()
  delete g[GLOBAL_KEY]
}
