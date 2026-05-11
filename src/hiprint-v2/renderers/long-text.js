/**
 * long-text.js — Long-text rendering + binary-search pagination.
 *
 * V1 source: bundle.js line 9755-9870 (BinarySearch + IsPaginationIndex +
 * getHeightByData + getPaperHtmlResult).
 *
 * ⚠️ Status (P4): long-text is V1's most complex rendering algorithm.
 * V2 P4 provides skeleton + simple safe helpers; full BinarySearch
 * pagination is migrated to P10 (template/) when getHtmlAsync is rewired.
 *
 * V2 P4 covers (subset):
 *  - updateLongTextTarget — split render path (no formatter / with formatter)
 *  - getLongTextIndent — sanitized indent span builder (R3 C1 fix preserved)
 *  - resolveLongTextValue — title-prefix + value composition with PM-002 R3 safe
 *
 * P10 will migrate:
 *  - BinarySearch + IsPaginationIndex (Page split algorithm, ~200 lines)
 *  - getHeightByData / getPaperHtmlResult orchestration
 */

import { safeNumber } from '@hiprint-v2/internal'

/**
 * Build a sanitized leading indent <span>. V1 used string concat —
 * with arbitrary longTextIndent value this was XSS (R3 C1). V2 forces
 * numeric clamp via safeNumber.
 *
 * @param {*} longTextIndent  options.longTextIndent (user-controlled)
 * @returns {jQuery}  <span class="long-text-indent"> with optional margin-left
 */
export function buildLongTextIndent(longTextIndent) {
  const $span = window.$('<span class="long-text-indent"></span>')
  // [R3 C1] parseInt + clamp 0..∞: arbitrary string injected via template JSON
  // gets reduced to a safe integer (or 0).
  const indentPt = safeNumber(longTextIndent, { min: 0 })
  if (indentPt > 0) {
    $span.css('margin-left', indentPt + 'pt')
  }
  return $span
}

/**
 * Update long-text container with (title-prefix + value) content.
 *
 * @param {jQuery} $container  .hiprint-printElement-longText-content
 * @param {string} text  composed (title + ':' + value) string
 * @param {boolean} [hasFormatter=false]  true → by-design HTML, false → text-safe
 */
export function updateLongTextTarget($container, text, hasFormatter) {
  if (hasFormatter) {
    // [security by-design] formatter return is business contract (HTML allowed).
    // See docs/integration-guide.md ⚠️ 安全注意事项 #2.
    $container.html(text == null ? '' : String(text))
  } else {
    // [R3 B4 + PM-002 R3] default text-safe. coerce null/undefined to '',
    // preserve 0/false/'' textual representation.
    $container.text(text == null ? '' : String(text))
  }
}

/**
 * Compose long-text display string: title-prefix + value.
 *
 * @param {string|null|undefined} title  hiprint field title (e.g. "金额")
 * @param {*} value  user data value (PM-002 R3 preserved 0/false/'')
 * @param {object} [opts]
 * @param {boolean} [opts.hideTitle]  if true → no title prefix
 * @param {string} [opts.separator='：']  default Chinese full-width colon (V1 hard-coded)
 * @returns {string}
 */
export function composeLongTextDisplay(title, value, opts) {
  opts = opts || {}
  const separator = opts.separator !== undefined ? opts.separator : '：'
  const titleStr = title == null ? '' : String(title)
  const valueStr = value == null ? '' : String(value)
  if (opts.hideTitle || !titleStr) return valueStr
  return titleStr + separator + valueStr
}

// TODO P10: migrate BinarySearch / IsPaginationIndex (V1 line 9828-9870)
// These functions need DOM measurement (jQuery height()) and recursion;
// will be ported when template/get-html.js is built.
