/**
 * dom-helpers.js — Safe DOM construction helpers.
 *
 * 集中 V1 散落在 bundle.js 内的 jQuery 链 + escape patterns. 业务方应通过这些
 * helper 而非直接 .html() 用户数据 (见 R1-R3 13 处 XSS fix).
 *
 * Invariant (V2 必须保留, 见 ADR-0010 + PM-001):
 *  - 永远不要把 user-controlled string 拼接进 .html() 或 innerHTML
 *  - .text() 是默认 safe path
 *  - 仅 by-design HTML render (html element / formatter return / setButtonText useHtml=true) 用 .html()
 */

/**
 * Escape value for safe insertion into HTML attribute or text content.
 * Same semantics as V1 escapeHtmlAttr (line 9003-9005).
 *
 * @param {*} val
 * @returns {string}
 */
export function escapeHtml(val) {
  return String(val == null ? '' : val)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
}

/**
 * Coerce nullish value to empty string. Used heavily for `.text(coerceText(v))`
 * to avoid `undefined`/`null` literal rendering.
 *
 * @param {*} v
 * @returns {string}
 */
export function coerceText(v) {
  return v == null ? '' : String(v)
}

/**
 * Sanitize a numeric option value with clamping. Used for style attribute
 * injection (e.g. longTextIndent, paperHeader) where V1 was XSS-vulnerable
 * via string concatenation (R3 C1).
 *
 * @param {*} val
 * @param {object} [opts]
 * @param {number} [opts.min=0]
 * @param {number} [opts.max=Infinity]
 * @param {number} [opts.fallback=0]
 * @returns {number}
 */
export function safeNumber(val, opts) {
  const min = opts && opts.min !== undefined ? opts.min : 0
  const max = opts && opts.max !== undefined ? opts.max : Infinity
  const fallback = opts && opts.fallback !== undefined ? opts.fallback : 0
  const n = parseFloat(val)
  if (!isFinite(n)) return fallback
  if (n < min) return min
  if (n > max) return max
  return n
}

/**
 * Resolve a possibly-nested field path on an object, preserving 0/false/''.
 *
 * V1: `f.split('.').reduce((a, c) => (a != null ? a[c] : undefined), t) ?? ""`
 * (PM-002 Round 2 + Round 3 fix).
 *
 * @param {object} root
 * @param {string} fieldPath  Dot-separated path, e.g. "user.profile.name"
 * @param {*} [fallback=''] Returned when path is unreachable (null/undefined intermediate)
 * @returns {*}
 *
 * @example
 *   resolveField({a:{b:0}}, 'a.b') → 0  (PM-002: 不当 falsy 转空)
 *   resolveField({a:null}, 'a.b') → '' (intermediate null → fallback)
 */
export function resolveField(root, fieldPath, fallback) {
  if (fallback === undefined) fallback = ''
  if (!fieldPath) return fallback
  const parts = String(fieldPath).split('.')
  const v = parts.reduce(
    (acc, key) => (acc != null ? acc[key] : undefined),
    root
  )
  return v == null ? fallback : v
}
