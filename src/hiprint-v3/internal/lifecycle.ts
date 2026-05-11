/**
 * lifecycle.ts — destroy 守卫 + 业务回调隔离 + formatter eval cap.
 *
 * V3 core helper, ported from V2 internal/lifecycle.js. Replaces V1 bundle.js
 * line 12545+ (_assertNotDestroyed) + line 13234+ (_safeCall) + line 13242+
 * (_evalCap) patterns.
 *
 * Invariants (V3 必须保留, 见 ADR-0011 §"锁住的不变式"):
 *  - destroy 后所有公开方法用 assertNotDestroyed 守卫, 返回明确 fallback (47+ 处)
 *  - 业务方 opts.onXxx 回调用 safeCall 隔离 throw (24+ 处)
 *  - 设计时 formatter / styler 字符串用 evalCap 防过大输入 (15+ 处, 5000 字符上限)
 */

import { FORMATTER_MAX_LEN } from './constants'

/**
 * Minimal interface for a lifecycle-managed object: must expose a `_destroyed`
 * boolean. Both V2 PrintTemplate (class) and V3 stores (refs) satisfy this.
 */
export interface Destroyable {
  _destroyed?: boolean
}

/**
 * Destroy guard. Returns true when self._destroyed; caller should immediately
 * return a fallback value.
 *
 * Usage:
 *   if (assertNotDestroyed(this, 'methodName')) return fallback;
 */
export function assertNotDestroyed(
  self: Destroyable | null | undefined,
  methodName: string
): boolean {
  if (self && self._destroyed) {
    console.warn('[hiprint] ' + methodName + ' called on destroyed template')
    return true
  }
  return false
}

/**
 * Business callback isolation. If fn throws (sync), log + return undefined;
 * never let throw propagate up to break hiprint internals.
 *
 * Usage:
 *   safeCall(opts.onXxx, [arg1, arg2], 'onXxx')
 */
export function safeCall<R = unknown>(
  fn: ((...args: unknown[]) => R) | null | undefined,
  args: readonly unknown[] | null | undefined,
  name: string
): R | undefined {
  if (typeof fn !== 'function') return undefined
  try {
    return fn.apply(null, (args ?? []) as unknown[])
  } catch (err) {
    console.error('[hiprint] ' + name + ' threw:', err)
    return undefined
  }
}

/**
 * Evaluate formatter / styler string into a Function with security cap.
 * Prevents DoS via massive formatter strings injected through template JSON.
 *
 * @param src     Function expression source (e.g. `function(v){ return v }`)
 * @param name    Diagnostic name for log
 * @param maxLen  Char cap (default FORMATTER_MAX_LEN = 5000)
 * @returns       Evaluated function, or undefined on parse fail / over cap
 */
export function evalCap(
  src: string | null | undefined,
  name: string,
  maxLen: number = FORMATTER_MAX_LEN
): Function | undefined {
  if (typeof src !== 'string' || !src) return undefined
  if (src.length > maxLen) {
    console.warn(
      '[hiprint] ' + name + ' refused: formatter source > ' + maxLen + ' chars (security cap)'
    )
    return undefined
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    return new Function('return ' + src)() as Function
  } catch (err) {
    console.error('[hiprint] ' + name + ' eval failed:', err)
    return undefined
  }
}
