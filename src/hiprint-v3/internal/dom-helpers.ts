/**
 * dom-helpers.ts — Safe DOM construction helpers (ported from V2).
 *
 * Centralizes patterns previously scattered in bundle.js. Business consumers
 * MUST use these helpers rather than raw .html()/innerHTML for user data
 * (see R1-R3 13 处 XSS fix).
 *
 * Invariant (V3 必须保留, 见 ADR-0011 + PM-001):
 *  - 永远不要把 user-controlled string 拼接进 .html() 或 innerHTML
 *  - .text() / textContent 是默认 safe path
 *  - 仅 by-design HTML render (html element / formatter return / setButtonText useHtml=true) 才用 innerHTML
 */

/**
 * Escape value for safe insertion into HTML attribute or text content.
 * Same semantics as V1 escapeHtmlAttr (line 9003-9005).
 */
export function escapeHtml(val: unknown): string {
  return String(val == null ? '' : val)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
}

/**
 * Coerce nullish value to empty string. Used heavily for textContent / .text()
 * to avoid `undefined`/`null` literal rendering.
 */
export function coerceText(v: unknown): string {
  return v == null ? '' : String(v)
}

export interface SafeNumberOpts {
  readonly min?: number
  readonly max?: number
  readonly fallback?: number
}

/**
 * Sanitize a numeric option value with clamping. Used for style attribute
 * injection (e.g. longTextIndent, paperHeader) where V1 was XSS-vulnerable
 * via string concatenation (R3 C1).
 */
export function safeNumber(val: unknown, opts?: SafeNumberOpts): number {
  const min = opts?.min ?? 0
  const max = opts?.max ?? Infinity
  const fallback = opts?.fallback ?? 0
  const n = typeof val === 'number' ? val : parseFloat(String(val))
  if (!isFinite(n)) return fallback
  if (n < min) return min
  if (n > max) return max
  return n
}

/**
 * Resolve a possibly-nested field path on an object, preserving 0/false/''.
 *
 * V1 bug pattern: `f.split('.').reduce((a, c) => a ? a[c] : t[c], !1)` —
 * falsy intermediate value falls back to root (PM-002 Round 2).
 * V3 fix: `(a != null ? a[c] : undefined)` strict nullish check + `?? fallback`.
 *
 * @example
 *   resolveField({a:{b:0}}, 'a.b') → 0  (PM-002: 不当 falsy 转空)
 *   resolveField({a:null}, 'a.b') → '' (intermediate null → fallback)
 */
export function resolveField(
  root: unknown,
  fieldPath: string | undefined | null,
  fallback: unknown = ''
): unknown {
  if (!fieldPath) return fallback
  const parts = String(fieldPath).split('.')
  const v = parts.reduce<unknown>(
    (acc, key) => (acc != null ? (acc as Record<string, unknown>)[key] : undefined),
    root
  )
  return v == null ? fallback : v
}
