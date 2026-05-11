/**
 * lifecycle.js — destroy 守卫 + 业务回调隔离 + formatter eval cap
 *
 * V2 核心 helper, 替换 bundle.js line 12545+ (_assertNotDestroyed) +
 * line 13234+ (_safeCall) + line 13242+ (_evalCap).
 *
 * Invariants (V2 必须保留, 见 ADR-0010):
 *  - destroy 后所有公开方法用 _assertNotDestroyed 守卫, 返回明确 fallback (47+ 处)
 *  - 业务方 opts.onXxx 回调用 _safeCall 隔离 throw (24+ 处)
 *  - 设计时 formatter / styler 字符串用 _evalCap 防过大输入 (15+ 处, 5000 字符上限)
 */

/**
 * Destroy guard. Returns true when self._destroyed, caller should immediately
 * return a fallback value.
 *
 * Usage:
 *   if (assertNotDestroyed(this, 'methodName')) return fallback;
 *
 * @param {object} self  PrintTemplate-like instance with _destroyed flag
 * @param {string} methodName  Method name for diagnostic log
 * @returns {boolean}  true if destroyed (caller should bail), false otherwise
 */
export function assertNotDestroyed(self, methodName) {
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
 *   _safeCall(opts.onXxx, [arg1, arg2], 'onXxx')
 *
 * @param {Function} fn  Business callback
 * @param {Array}    args  Arguments to apply
 * @param {string}   name  Diagnostic name
 * @returns {*}      Return value of fn, or undefined on throw / non-function
 */
export function safeCall(fn, args, name) {
  if (typeof fn !== 'function') return undefined
  try {
    return fn.apply(null, args || [])
  } catch (err) {
    console.error('[hiprint] ' + name + ' threw:', err)
    return undefined
  }
}

/**
 * Evaluate formatter / styler string into Function with security cap.
 * Prevents DoS via massive formatter strings injected through template JSON.
 *
 * @param {string} src  Function body string (without `function(){}` wrapper, just 'function(...){ ... }')
 * @param {string} name  Diagnostic name
 * @param {number} [maxLen=5000]  Char cap (default 5000)
 * @returns {Function|undefined}  Evaluated function, or undefined on parse fail / over cap
 */
export function evalCap(src, name, maxLen = 5000) {
  if (typeof src !== 'string' || !src) return undefined
  if (src.length > maxLen) {
    console.warn(
      '[hiprint] ' + name + ' refused: formatter source > ' + maxLen + ' chars (security cap)'
    )
    return undefined
  }
  try {
    return new Function('return ' + src)()
  } catch (err) {
    console.error('[hiprint] ' + name + ' eval failed:', err)
    return undefined
  }
}
