/**
 * event-bus.ts — Factory returning independent event-bus instances.
 *
 * V1: window.hinnn.event 是全局单例 (bundle.js line 144+).
 * V2: 用 createEventBus() 工厂支持多实例隔离 (HMR 安全 + 单元测试可重置).
 * V3: 与 V2 一致, TS 强化类型 (handler 参数变 unknown[] 避免 any).
 *
 * Invariant (V3 必须保留, 见 ADR-0011 + PM-004 R3):
 *  - off(t) 不传 fn 时清整 key (destroy 内 event.off(key) 期望此行为).
 *    V1 之前 silent no-op 导致 listener leak, V3 必须保留 R3 修复.
 */

export type EventHandler = (...args: unknown[]) => void

export interface EventBus {
  /** monotonic id counter (legacy compatibility with hinnn.event.id) */
  id: number
  /** Subscribe handler for event key. */
  on(key: string, handler: EventHandler): void
  /** Unsubscribe. If handler omitted, clears entire key (R3 fix). */
  off(key: string, handler?: EventHandler): void
  /** Trigger event with arguments. */
  trigger(key: string, ...args: unknown[]): void
  /** Clear all subscribers for a key. Same as off(key). */
  clear(key: string): void
  /** Increment + return id (legacy hinnn.event.id semantics). */
  getId(): number
  /** Compose name with id for unique handler keys. */
  getNameWithId(prefix: string): string
}

/**
 * Create an independent event-bus instance.
 */
export function createEventBus(): EventBus {
  const subs: Record<string, EventHandler[]> = {}

  const bus: EventBus = {
    id: 0,

    on(key, handler) {
      if (!subs[key]) subs[key] = []
      subs[key]!.push(handler)
    },

    off(key, handler) {
      const list = subs[key]
      if (!list) return
      if (handler === undefined) {
        subs[key] = []
        return
      }
      const idx = list.indexOf(handler)
      if (idx >= 0) list.splice(idx, 1)
    },

    trigger(key, ...args) {
      const list = subs[key]
      if (!list || !list.length) return
      // Snapshot to avoid re-entrancy issues when a handler unsubscribes mid-trigger.
      const snapshot = list.slice()
      for (let i = 0; i < snapshot.length; i++) {
        snapshot[i]!.apply(null, args)
      }
    },

    clear(key) {
      subs[key] = []
    },

    getId() {
      this.id += 1
      return this.id
    },

    getNameWithId(prefix) {
      return prefix + '-' + this.getId()
    },
  }

  return bus
}
