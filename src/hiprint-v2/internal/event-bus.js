/**
 * event-bus.js — 工厂方法返回独立 event bus 实例
 *
 * V1: window.hinnn.event 是全局单例 (line 144+).
 * V2: 用 createEventBus() 工厂支持多实例隔离 (HMR 安全 + 单元测试可重置).
 *
 * V2 兼容层: V2 模块仍可访问 window.hinnn.event (P12 装配时设置), 防止业务方
 * 直接读 hinnn 全局的代码挂掉。
 *
 * Invariant (V2 必须保留, 见 ADR-0010 + PM-004 R3):
 *  - off(t) 不传 fn 时清整 key (destroy 内 event.off(key) 期望此行为).
 *    V1 之前 silent no-op 导致 listener leak, V2 必须保留 R3 修复.
 */

/**
 * Create an independent event-bus instance.
 *
 * @returns {{on, off, trigger, clear, getId, getNameWithId, id}}
 */
export function createEventBus() {
  /** @type {Object<string, Function[]>} */
  const subs = {}

  return {
    /** monotonic id counter (legacy compatibility with hinnn.event.id) */
    id: 0,

    /**
     * Subscribe handler for event key.
     * @param {string} key
     * @param {Function} handler
     */
    on(key, handler) {
      if (!subs[key]) subs[key] = []
      subs[key].push(handler)
    },

    /**
     * Unsubscribe. If handler omitted, clears entire key (V1 V2 R3 fix).
     * @param {string} key
     * @param {Function} [handler]
     */
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

    /**
     * Trigger event with arguments. Iterates a snapshot to avoid
     * re-entrancy issues if a handler unsubscribes mid-trigger.
     * @param {string} key
     * @param {...*} args
     */
    trigger(key, ...args) {
      const list = subs[key]
      if (!list || !list.length) return
      const snapshot = list.slice()
      for (let i = 0; i < snapshot.length; i++) {
        snapshot[i].apply(null, args)
      }
    },

    /** Clear all subscribers for a key. Same as off(key). */
    clear(key) {
      subs[key] = []
    },

    /** Increment + return id (legacy hinnn.event.id semantics). */
    getId() {
      this.id += 1
      return this.id
    },

    /** Compose name with id for unique handler keys. */
    getNameWithId(prefix) {
      return prefix + '-' + this.getId()
    },
  }
}
