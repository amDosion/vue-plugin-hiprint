/**
 * _helpers.ts — Shared style/value computation helpers for V3 element components.
 *
 * Extracted from {@link ./ElementWrapper.vue} and individual etype SFCs to
 * keep each component < 200 lines.
 *
 * V2 reference: `src/hiprint-v3/print/render.ts` applyGeometry / applyFont /
 * applyAlignment / applyBorder / applyPadding. That module is imperative
 * (DOM patching); these helpers return a `CSSProperties`-style object for
 * Vue's reactive `:style` binding.
 *
 * Invariants:
 *  - Always pt suffix for positional units (left/top/width/height) to match
 *    .hiprint-printElement absolute layout in V1/V2.
 *  - safeNumber clamps + falls back to a sensible default (never NaN).
 *  - resolveField preserves 0 / false / '' (PM-002 R3).
 */

import type { CSSProperties } from 'vue'
import { coerceText, resolveField, safeNumber } from '@hiprint-v3/internal'
import type { CanvasElement } from '@hiprint-v3/stores'

/** Plain options bag (element.options is `Record<string, unknown>`). */
export type Opts = Record<string, unknown>

/** Coerce option to a strict boolean (accept boolean or 'true' literal). */
export function isTrue(v: unknown): boolean {
  return v === true || v === 'true'
}

/**
 * Compute the absolute-positioned outer wrapper style.
 *
 * Mirrors render.ts `applyGeometry` so V3 components produce the same layout
 * the imperative renderer produces in the print pipeline.
 */
export function computeGeometryStyle(opts: Opts): CSSProperties {
  const left = safeNumber(opts.left, { fallback: 0 })
  const top = safeNumber(opts.top, { fallback: 0 })
  const width = safeNumber(opts.width, { fallback: 100 })
  const height = safeNumber(opts.height, { fallback: 20 })

  const style: CSSProperties = {
    position: 'absolute',
    left: left + 'pt',
    top: top + 'pt',
    width: width + 'pt',
    height: height + 'pt',
  }
  if (opts.zIndex != null) {
    style.zIndex = String(safeNumber(opts.zIndex, { fallback: 0 }))
  }
  if (opts.rotate != null) {
    style.transform = 'rotate(' + safeNumber(opts.rotate, { fallback: 0 }) + 'deg)'
  }
  return style
}

/**
 * Compute font + color style. Reads option fallbacks in same order as render.ts.
 *
 * `panel` is optional here because in components we typically receive the
 * resolved element only; panel-level font inheritance is handled by the
 * surrounding canvas/panel component.
 */
export function computeFontStyle(opts: Opts): CSSProperties {
  const style: CSSProperties = {}
  if (typeof opts.fontFamily === 'string') style.fontFamily = opts.fontFamily
  if (opts.fontSize != null) {
    style.fontSize = safeNumber(opts.fontSize, { fallback: 10.5 }) + 'pt'
  }
  if (opts.fontWeight != null) style.fontWeight = String(opts.fontWeight) as CSSProperties['fontWeight']
  if (typeof opts.fontStyle === 'string') style.fontStyle = opts.fontStyle as CSSProperties['fontStyle']
  if (typeof opts.textDecoration === 'string') {
    style.textDecoration = opts.textDecoration as CSSProperties['textDecoration']
  }
  if (typeof opts.color === 'string') style.color = opts.color
  if (typeof opts.textColor === 'string') style.color = opts.textColor
  if (typeof opts.backgroundColor === 'string') style.backgroundColor = opts.backgroundColor
  if (opts.lineHeight != null) style.lineHeight = String(opts.lineHeight)
  if (opts.letterSpacing != null) {
    style.letterSpacing = safeNumber(opts.letterSpacing, { fallback: 0 }) + 'pt'
  }
  return style
}

/** Compute textAlign + vertical alignment (uses flex centering for vAlign). */
export function computeAlignmentStyle(opts: Opts): CSSProperties {
  const style: CSSProperties = {}
  const horizontal =
    (typeof opts.textAlign === 'string' && opts.textAlign) ||
    (typeof opts.align === 'string' && opts.align) ||
    null
  if (horizontal) style.textAlign = horizontal as CSSProperties['textAlign']

  const vertical =
    (typeof opts.textContentVerticalAlign === 'string' && opts.textContentVerticalAlign) ||
    (typeof opts.vAlign === 'string' && opts.vAlign) ||
    null
  if (vertical) {
    style.display = 'flex'
    if (vertical === 'top') style.alignItems = 'flex-start'
    else if (vertical === 'bottom') style.alignItems = 'flex-end'
    else style.alignItems = 'center'
  }
  return style
}

/** Compute border style. Same logic as render.ts applyBorder. */
export function computeBorderStyle(opts: Opts): CSSProperties {
  const style: CSSProperties = {}
  if (typeof opts.borderStyle === 'string' && opts.borderStyle !== 'none') {
    style.borderStyle = opts.borderStyle as CSSProperties['borderStyle']
    style.borderWidth = safeNumber(opts.borderWidth, { fallback: 1, min: 0 }) + 'pt'
    if (typeof opts.borderColor === 'string') style.borderColor = opts.borderColor
  }
  if (typeof opts.borderTop === 'string') style.borderTop = opts.borderTop
  if (typeof opts.borderRight === 'string') style.borderRight = opts.borderRight
  if (typeof opts.borderBottom === 'string') style.borderBottom = opts.borderBottom
  if (typeof opts.borderLeft === 'string') style.borderLeft = opts.borderLeft
  return style
}

/** Compute padding style. Same logic as render.ts applyPadding. */
export function computePaddingStyle(opts: Opts): CSSProperties {
  const style: CSSProperties = {}
  if (opts.padding != null) {
    style.padding = typeof opts.padding === 'number' ? opts.padding + 'pt' : String(opts.padding)
  }
  if (opts.paddingTop != null) style.paddingTop = safeNumber(opts.paddingTop, { fallback: 0 }) + 'pt'
  if (opts.paddingRight != null) style.paddingRight = safeNumber(opts.paddingRight, { fallback: 0 }) + 'pt'
  if (opts.paddingBottom != null) style.paddingBottom = safeNumber(opts.paddingBottom, { fallback: 0 }) + 'pt'
  if (opts.paddingLeft != null) style.paddingLeft = safeNumber(opts.paddingLeft, { fallback: 0 }) + 'pt'
  return style
}

/**
 * Combine all base styles for the ElementWrapper outer div.
 *
 * Use this in `computed(() => computeBaseStyle(options))` for shared layout.
 */
export function computeBaseStyle(opts: Opts): CSSProperties {
  return {
    ...computeGeometryStyle(opts),
    ...computeFontStyle(opts),
    ...computeAlignmentStyle(opts),
    ...computeBorderStyle(opts),
    ...computePaddingStyle(opts),
  }
}

/**
 * Resolve the user-visible value for an element: data via field (nested-safe)
 * with testData fallback. Mirrors render.ts `getElementValue`.
 *
 * PM-002 R3 preserves 0/false/'' via the V3 resolveField implementation.
 */
export function getElementValue(
  element: CanvasElement | null | undefined,
  data: Record<string, unknown> | undefined
): unknown {
  if (!element) return ''
  const opts = element.options as Opts
  const field =
    (typeof opts.field === 'string' ? opts.field : undefined) ??
    (element.printElementType?.field as string | undefined)
  if (field && data) {
    const resolved = resolveField(data, field, undefined)
    if (resolved !== undefined) return resolved
  }
  if (opts.testData !== undefined) return opts.testData
  return ''
}

/**
 * Build the user-visible display text for text-like elements
 * (text / longText): optional title prefix + value, joined by separator.
 *
 * NEVER returns null/undefined — coerces all parts via {@link coerceText}.
 */
export function computeDisplayText(
  element: CanvasElement | null | undefined,
  data: Record<string, unknown> | undefined
): string {
  if (!element) return ''
  const opts = element.options as Opts
  const value = getElementValue(element, data)
  const title = coerceText(opts.title)
  const hideTitle = isTrue(opts.hideTitle)
  const separator = typeof opts.titleSep === 'string' ? opts.titleSep : '：'
  const valueStr = coerceText(value)
  return hideTitle || !title ? valueStr : title + separator + valueStr
}
