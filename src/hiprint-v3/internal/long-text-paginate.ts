/**
 * long-text-paginate.ts — Binary-search pagination for the longText etype.
 *
 * V1 source: bundle.js line 9757-9931 (`getStringBySpecificHeight` +
 * `IsPaginationIndex` + `BinarySearch`). Documented in
 * docs/V1-INVENTORY/etypes/text-longtext.md Sections F.7 and F.8.
 *
 * The V1 algorithm character-splits the source string and binary-searches the
 * largest prefix whose rendered height fits within the available page space.
 * Each page produces one chunk; remaining suffix recurses.
 *
 * V3 strategy:
 *  - Pure-function entry point: caller supplies a `measure(text, heightPt)`
 *    callback that returns true if `text` fits in `heightPt`.
 *  - DOM-based measure factory (createDomMeasure) builds a hidden <div>
 *    matching font/width/lineHeight and reads `offsetHeight` per probe.
 *  - Empty / short-fits-on-page-one early outs match V1's `IsPaginationIndex`
 *    fast path.
 *
 * Invariants:
 *  - Pure logic; no jQuery, no globals. `measure` is the only side-effect.
 *  - Always returns at least one page (even for empty input).
 *  - Iteration bound — never recurses beyond input.length characters.
 *  - Binary search is O(log n) per page; total O(p · log n).
 *
 * Safety:
 *  - The DOM measure factory writes via `textContent` only (XSS Invariant #1).
 *  - V1 hardening preserved: "BinarySearch 仅为测量高度,用 .text() 写
 *    textContent 等价高度且不解析为 HTML" — see [V1 line 9894-9895].
 */

// ============ Public types ============

/** Input bundle for `paginateLongText`. */
export interface PaginateInput {
  /** Source text (may include newlines / wide characters). */
  fullText: string
  /**
   * Available height in pt for the *first* page's longText area.
   * V1 maps this to `paper.height - top - paperFooter - already-used`.
   */
  maxHeightPt: number
  /**
   * Available height in pt per page *after* the first. V1 generally uses
   * `paperFooter - paperHeader` (i.e. printable area between header and
   * footer). If equal to maxHeightPt, every page treats the same budget.
   */
  perPageHeightPt: number
  /** Font size in pt — informational; tests may inspect this. */
  fontSizePt: number
  /** Line height in pt — informational; passed to measure factory. */
  lineHeightPt: number
  /** Font family — informational; passed to measure factory. */
  fontFamily: string
  /** Element width in pt — used by measure to constrain wrapping. */
  width: number
  /** Optional letter spacing in pt. */
  letterSpacing?: number
  /**
   * Probe callback: return true iff `text` fits in `heightPt` at the
   * caller's font config + width. The callback is invoked O(log n) times
   * per page; it must be deterministic and idempotent.
   */
  measure: (text: string, heightPt: number) => boolean
}

/** Per-page output emitted by `paginateLongText`. */
export interface PaginatedPage {
  /** Chunk of source text for this page (may be '' for empty input). */
  text: string
  /**
   * Best-guess pixel/pt height for this page chunk. V1 stored measured
   * `target.height()`; V3 reports the budget consumed (maxHeightPt /
   * perPageHeightPt for partial fits, or 0 for empty page).
   */
  height: number
}

/** Output bundle. */
export interface PaginateOutput {
  pages: PaginatedPage[]
}

// ============ Public API ============

/**
 * Paginate a long string into chunks that fit per-page height budgets.
 *
 * Algorithm (V1 parity, see F.7):
 *  1. If `fullText` empty → return `[{ text: '', height: 0 }]`.
 *  2. While text remaining: binary-search the largest prefix whose
 *     `measure(prefix, budget)` returns true.
 *  3. Push that prefix; recurse on the remaining suffix with
 *     `perPageHeightPt` budget.
 *  4. Stop when fullText is exhausted.
 *
 * Special case: if entire fullText fits in maxHeightPt on the first try,
 * return a single page (matches V1's `IsPaginationIndex` short-circuit).
 *
 * Defensive bound: the loop terminates after `fullText.length + 1` iterations
 * even if `measure` lies — prevents pathological infinite loops.
 */
export function paginateLongText(input: PaginateInput): PaginateOutput {
  const fullText = typeof input.fullText === 'string' ? input.fullText : ''
  if (fullText.length === 0) {
    return { pages: [{ text: '', height: 0 }] }
  }

  const measure = input.measure
  if (typeof measure !== 'function') {
    // Defensive: no measure → emit single page (V1's panelPageRule==='none' path).
    return { pages: [{ text: fullText, height: 0 }] }
  }

  const pages: PaginatedPage[] = []
  let remaining = fullText
  let firstPage = true
  // Loop bound: at most one page per char (worst case 1-char-per-page).
  const maxIters = fullText.length + 1
  let iter = 0

  while (remaining.length > 0 && iter < maxIters) {
    iter++
    const budget = firstPage ? input.maxHeightPt : input.perPageHeightPt

    // Short-circuit: if the entire remaining text fits, emit one final page.
    if (safeProbe(measure, remaining, budget)) {
      pages.push({ text: remaining, height: budget })
      remaining = ''
      break
    }

    // Binary-search the largest prefix that fits.
    // Invariant: lo always fits (or is 0 → at least one char makes progress);
    //            hi always overflows.
    let lo = 0
    let hi = remaining.length
    while (lo + 1 < hi) {
      const mid = (lo + hi) >>> 1
      if (safeProbe(measure, remaining.slice(0, mid), budget)) {
        lo = mid
      } else {
        hi = mid
      }
    }

    // Edge: lo === 0 means even 1 char doesn't fit. To guarantee forward
    // progress (never infinite loop), emit at least 1 char per page.
    const fitLen = lo > 0 ? lo : 1
    pages.push({ text: remaining.slice(0, fitLen), height: budget })
    remaining = remaining.slice(fitLen)
    firstPage = false
  }

  // Safety net — should never fire under correct `measure` semantics.
  if (remaining.length > 0) {
    pages.push({ text: remaining, height: input.perPageHeightPt })
  }

  return { pages }
}

/**
 * Wrap measure() so a throwing user-supplied callback can't kill the
 * pagination loop. Returns false (treat as "doesn't fit") on throw, forcing
 * the binary search to converge to a smaller chunk.
 */
function safeProbe(
  measure: (text: string, heightPt: number) => boolean,
  text: string,
  heightPt: number
): boolean {
  try {
    return measure(text, heightPt) === true
  } catch (err) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[hiprint-v3] long-text measure threw:', err)
    }
    return false
  }
}

/**
 * Build a DOM-based `measure` callback for `paginateLongText`.
 *
 * Creates a hidden `<div>` matching the element's font + width and probes
 * `offsetHeight` per call. The probe div is re-used across calls — caller
 * is responsible for keeping the host container alive until pagination
 * completes (typically the same lifecycle as the print pass).
 *
 * Implementation notes:
 *  - `position:absolute; visibility:hidden; left:-99999px` keeps the probe
 *    out of layout but participates in reflow → offsetHeight is accurate.
 *  - `white-space: pre-wrap` matches the V1 LongText render styling.
 *  - `box-sizing: content-box` so width applies exactly (no border/padding
 *    surprise; the caller already deducted padding/border from the budget).
 *  - We use `textContent` (never innerHTML) per V1 hardening F.7 / J.3.
 *
 * @example
 *   const host = document.createElement('div')
 *   document.body.appendChild(host)
 *   const measure = createDomMeasure(host, 10.5, 16, 'sans-serif', 200)
 *   const { pages } = paginateLongText({ ..., measure })
 *   host.remove()
 */
export function createDomMeasure(
  container: HTMLElement,
  fontSizePt: number,
  lineHeightPt: number,
  fontFamily: string,
  widthPt: number,
  letterSpacing?: number
): (text: string, heightPt: number) => boolean {
  if (typeof document === 'undefined') {
    // SSR fallback: optimistic — every text fits.
    return () => true
  }

  const probe = document.createElement('div')
  probe.style.position = 'absolute'
  probe.style.visibility = 'hidden'
  probe.style.left = '-99999px'
  probe.style.top = '0'
  probe.style.boxSizing = 'content-box'
  probe.style.whiteSpace = 'pre-wrap'
  probe.style.overflow = 'visible'
  probe.style.padding = '0'
  probe.style.margin = '0'
  probe.style.border = '0'
  probe.style.width = widthPt + 'pt'
  if (fontFamily) probe.style.fontFamily = fontFamily
  if (fontSizePt > 0) probe.style.fontSize = fontSizePt + 'pt'
  if (lineHeightPt > 0) probe.style.lineHeight = lineHeightPt + 'pt'
  if (typeof letterSpacing === 'number' && isFinite(letterSpacing)) {
    probe.style.letterSpacing = letterSpacing + 'pt'
  }
  container.appendChild(probe)

  return function measure(text: string, heightPt: number): boolean {
    // [Invariant #1] textContent only — never innerHTML (V1 J.3 hardening).
    probe.textContent = text
    // offsetHeight is integer CSS-pixels; convert pt budget → CSS px via the
    // canonical 96 DPI assumption used by browsers (1pt = 1/72in, 1in = 96px
    // → 1pt ≈ 1.333px). The comparison is dimension-consistent because both
    // sides resolve through the same 96-DPI mapping.
    const heightPx = heightPt * (96 / 72)
    return probe.offsetHeight <= heightPx
  }
}
