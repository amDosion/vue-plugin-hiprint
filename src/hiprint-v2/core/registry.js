/**
 * registry.js — PrintElementTypeRegistry (data 层单例).
 *
 * V1 source: bundle.js line 8957-9054 (class `a`).
 * V2 改进:
 *  - HMR 安全: 用 `getRegistry()` factory pattern 替换 V1 `Object.defineProperty(t, 'instance', {get})`,
 *    Vite HMR 重载模块时 _instance 通过 globalThis 共享, 防双实例.
 *  - export getInstance() 给业务方 / e2e 用 (V1.0.2 起兼容 ADR-0007 PrintElementTypeRegistry export).
 *
 * Invariants (V2 必须保留, see ADR-0010):
 *  - R1 PM-007: addPrintElementTypes 双层 dedup (group bucket + allElementTypes 平铺)
 *  - R1 PM-008: removePrintElementTypes dotted prefix (`order` 不删 `order_v2.*`)
 *  - 空 moduleName 拒绝 + warn
 *  - tid 重复替换时 console.warn
 */

const GLOBAL_KEY = '__HIPRINT_V2_REGISTRY_INSTANCE__'

/**
 * Resolve module name to bucket key. `''` / null / undefined → '_default'.
 *
 * @param {string} [moduleName]
 * @returns {string}
 */
export function formatterModule(moduleName) {
  return moduleName || '_default'
}

export class PrintElementTypeRegistry {
  constructor() {
    /** @type {Array<object>}  Flat cache of all element types across all modules. */
    this.allElementTypes = []
    /** module-name → group[] buckets get assigned dynamically as `this[moduleName]`. */
  }

  /**
   * Register element type groups under a module.
   * Implements [R1 PM-007] dual dedup (bucket + flat cache).
   *
   * @param {string} moduleName
   * @param {Array<{ printElementTypes: object[], name?: string, isDynamicSlot?: boolean }>} groups
   */
  addPrintElementTypes(moduleName, groups) {
    if (!Array.isArray(groups)) return

    // Collect incoming tids for replacement detection
    const incomingTids = {}
    groups.forEach((g) => {
      ;(g.printElementTypes || []).forEach((et) => {
        if (et && et.tid) incomingTids[et.tid] = true
      })
    })

    // Bucket-level dedup: filter old groups, keep tids not overridden by incoming
    if (this[moduleName]) {
      const dedupedOld = []
      this[moduleName].forEach((oldGroup) => {
        if (!oldGroup) return
        const oldTypes = oldGroup.printElementTypes || []
        const keptTypes = oldTypes.filter((et) => et && !incomingTids[et.tid])
        if (keptTypes.length === 0) return // entire group replaced
        if (keptTypes.length !== oldTypes.length) {
          oldGroup.printElementTypes = keptTypes
        }
        dedupedOld.push(oldGroup)
      })
      this[moduleName] = dedupedOld.concat(groups)
    } else {
      this[moduleName] = groups
    }

    // Flat cache dedup with warn (R1 PM-007)
    groups.forEach((g) => {
      ;(g.printElementTypes || []).forEach((et) => {
        const tid = et && et.tid
        if (tid) {
          let existed = false
          this.allElementTypes = this.allElementTypes.filter((existing) => {
            if (existing && existing.tid === tid) {
              existed = true
              return false
            }
            return !!existing
          })
          if (existed) {
            console.warn(
              '[hiprint] addPrintElementTypes: tid already registered, replacing: ' + tid
            )
          }
        }
        this.allElementTypes.push(et)
      })
    })
  }

  /**
   * Remove a module (by exact module name) and its element types.
   * Implements [R1 PM-008] dotted prefix to avoid sibling sub-string deletion.
   *
   * @param {string} moduleName  exact module key (e.g., 'order' deletes 'order' module and all 'order.*' tids, but NOT 'order_v2.*')
   */
  removePrintElementTypes(moduleName) {
    if (!moduleName) {
      console.warn('[hiprint] removePrintElementTypes called without moduleName')
      return
    }
    const prefix = moduleName + '.'
    delete this[moduleName]
    this.allElementTypes = this.allElementTypes.filter((et) => {
      return et && et.tid && !(et.tid === moduleName || et.tid.indexOf(prefix) === 0)
    })
  }

  /**
   * Get element type groups for a module.
   *
   * @param {string} [moduleName]
   * @returns {Array<object>}
   */
  getElementTypeGroups(moduleName) {
    return this[formatterModule(moduleName)] || []
  }

  /**
   * Find element type by exact tid (across all modules).
   *
   * @param {string} tid
   * @returns {object|undefined}
   */
  getElementType(tid) {
    const matches = this.allElementTypes.filter((et) => et.tid === tid)
    return matches.length > 0 ? matches[0] : undefined
  }

  /**
   * Update element type by transformer. R3 state-modeler LOW: bucket sync is
   * still TODO — currently only flat cache is updated.
   *
   * @param {string} tid
   * @param {(prev: object) => object} transformer
   * @returns {object|undefined}  updated type or original
   */
  updateElementType(tid, transformer) {
    const type = this.getElementType(tid)
    if (transformer) {
      const newType = transformer(type)
      const idx = this.allElementTypes.findIndex((e) => e.tid === tid)
      if (idx >= 0) {
        this.allElementTypes.splice(idx, 1, newType)
        // TODO P5 follow-up: sync the bucket (this[moduleName]) too;
        // R3 state-modeler LOW item, low impact since most consumers use
        // getElementType (flat) or getElementTypeGroups (read-only snapshot).
        return newType
      }
    }
    return type
  }
}

/**
 * Get the global registry instance (HMR-safe via globalThis cache).
 *
 * @returns {PrintElementTypeRegistry}
 */
export function getInstance() {
  /* eslint-disable no-undef */
  const g = typeof globalThis !== 'undefined' ? globalThis : window
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new PrintElementTypeRegistry()
  }
  return g[GLOBAL_KEY]
}

/**
 * Reset singleton (test-only).
 */
export function _resetInstance() {
  const g = typeof globalThis !== 'undefined' ? globalThis : window
  delete g[GLOBAL_KEY]
}
