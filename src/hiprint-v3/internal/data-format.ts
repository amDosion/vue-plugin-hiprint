/**
 * data-format.ts — V1 dataType + format transformation pipeline (TKT-024).
 *
 * V1 supports per-element data conversion BEFORE the formatter runs:
 *
 *  - `options.dataType: 'text'` (default) — pass-through, coerced to string.
 *  - `options.dataType: 'datetime'` + `options.format` — `dateFormat(raw, pattern)`.
 *  - `options.dataType: 'boolean'` + `options.format` — V1 splits the format on
 *    ':' and uses the first half for `true`, second for `false`. V3 prefers
 *    explicit `options.trueText` / `options.falseText` fields and falls back
 *    to V1's `format` split for backward compat.
 *
 * V1 references:
 *  - bundle.js line 10034-10045 (`getData` — datetime / boolean dispatch)
 *  - bundle.js line 324-360 (`hinnn.dateFormat` — pattern token engine)
 *
 * Pipeline order (V3):
 *   raw value → formatValue (this module) → formatter chain → DOM
 *
 * The formatter still receives whatever this module returns. That matches V1:
 * `getData()` runs first, then `updateTargetText`'s formatter receives the
 * already-converted value (bundle.js line 10037 → 10047-10050).
 *
 * Locked invariants (ADR-0011):
 *  - Pure data transform — no DOM, no jQuery, no Vue.
 *  - Never throws — bad input falls through to `String(raw ?? '')`.
 *  - PM-002 R3: 0 / false / '' are NOT coerced away by this module
 *    (the upstream resolver handles fallback; this module only converts).
 */

import { dateFormat } from './format'

/**
 * Options bag for {@link formatValue}. All fields optional — when none of the
 * relevant fields apply, raw value is passed through unchanged.
 */
export interface FormatOptions {
  /** V1 `options.dataType`. */
  dataType?: 'text' | 'datetime' | 'boolean' | string | null | undefined
  /**
   * V1 `options.format`.
   * - For `dataType: 'datetime'` — pattern string (e.g. 'YYYY-MM-DD HH:mm:ss').
   *   Accepts both V1 lowercase tokens (yyyy/yy/MM/dd/HH/mm/ss) and uppercase
   *   YYYY/DD aliases; uppercase is normalized to V1's case before formatting.
   * - For `dataType: 'boolean'` — V1 legacy form 'trueText:falseText' is
   *   accepted as a fallback when `trueText`/`falseText` are not set.
   */
  format?: string | null | undefined
  /** Text to render when boolean value is truthy. Default 'Yes'. */
  trueText?: string | null | undefined
  /** Text to render when boolean value is falsy. Default 'No'. */
  falseText?: string | null | undefined
}

/**
 * V1 lowercase date tokens (yyyy, MM, dd, HH, mm, ss). Our V1-ported
 * {@link dateFormat} uses lowercase `y+` and `d+`; uppercase variants are a
 * common shorthand in user-supplied templates ('YYYY-MM-DD HH:mm:ss'). We
 * normalize uppercase aliases to V1's case so both shapes work.
 */
function normalizeDatePattern(pattern: string): string {
  return pattern
    .replace(/Y/g, 'y') // YYYY → yyyy, YY → yy
    .replace(/D/g, 'd') // DD → dd, D → d
}

/**
 * Format a date-like raw value into a string per V1 contract.
 *
 * Accepts:
 *  - `Date` instance → used as-is.
 *  - `number` (epoch ms) → `new Date(n)`.
 *  - `string` (ISO 8601 / RFC 2822 / 'yyyy-MM-dd HH:mm') → `new Date(s)`.
 *  - Anything else → returns `String(raw ?? '')` (graceful fallback).
 *
 * Invalid dates (e.g. 'not-a-date') return `String(raw ?? '')` instead of
 * 'NaN-NaN-NaN' — that matches V1's behavior on Date parse failure
 * (bundle.js line 56-59 try/catch).
 */
function formatDatetime(raw: unknown, pattern: string): string {
  const normalizedPattern = normalizeDatePattern(pattern)
  let d: Date
  if (raw instanceof Date) {
    d = raw
  } else if (typeof raw === 'number' || typeof raw === 'string') {
    if (raw === '') return ''
    d = new Date(raw)
  } else {
    return String(raw ?? '')
  }
  if (Number.isNaN(d.getTime())) {
    return String(raw ?? '')
  }
  // dateFormat (V1-ported) accepts string | number; pass an ISO string so its
  // token engine resolves consistently across input shapes.
  return dateFormat(d.toISOString(), normalizedPattern)
}

/**
 * Truthy-test for boolean dataType. V1 treats `true` and `'true'` (string) as
 * truthy. We expand to common JSON forms: 1 → true, 'false' → false,
 * '' / 0 / null / undefined → false.
 */
function isBooleanTruthy(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw
  if (typeof raw === 'string') {
    const t = raw.trim().toLowerCase()
    if (t === 'true' || t === '1' || t === 'yes' || t === 'y') return true
    return false
  }
  if (typeof raw === 'number') return raw !== 0 && !Number.isNaN(raw)
  return Boolean(raw)
}

/**
 * Apply V1 dataType + format conversion to a raw element value.
 *
 * Used by TextElement.vue / LongTextElement.vue / render.ts BEFORE the
 * formatter chain runs. The output is always a string (never null/undefined).
 *
 * @example
 *   formatValue('2026-05-09 14:30', { dataType: 'datetime', format: 'YYYY-MM-DD' })
 *   // → '2026-05-09'
 *
 * @example
 *   formatValue(true, { dataType: 'boolean', trueText: '是', falseText: '否' })
 *   // → '是'
 *
 * @example
 *   formatValue('hello', { dataType: 'text' })
 *   // → 'hello'
 */
export function formatValue(raw: unknown, opts: FormatOptions): string {
  const dataType = opts.dataType

  if (dataType === 'datetime') {
    const pattern =
      typeof opts.format === 'string' && opts.format
        ? opts.format
        : 'YYYY-MM-DD HH:mm:ss'
    return formatDatetime(raw, pattern)
  }

  if (dataType === 'boolean') {
    // Prefer V3 explicit trueText/falseText fields; fall back to V1 legacy
    // 'trueText:falseText' format split (bundle.js line 10041-10042).
    let trueText = opts.trueText
    let falseText = opts.falseText
    if (
      (trueText == null || falseText == null) &&
      typeof opts.format === 'string' &&
      opts.format.includes(':')
    ) {
      const [t, f] = opts.format.split(':')
      if (trueText == null && typeof t === 'string') trueText = t
      if (falseText == null && typeof f === 'string') falseText = f
    }
    const truthy = isBooleanTruthy(raw)
    if (truthy) return typeof trueText === 'string' ? trueText : 'Yes'
    return typeof falseText === 'string' ? falseText : 'No'
  }

  // dataType === 'text' or undefined / unknown → pass through.
  // Preserve PM-002 R3 semantics: 0 / false / '' stay as their string form,
  // null / undefined become ''.
  if (raw == null) return ''
  return String(raw)
}
