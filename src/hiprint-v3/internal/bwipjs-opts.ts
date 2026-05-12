/**
 * bwipjs-opts.ts — TKT-364 bwip-js option forwarding helper.
 *
 * V1 inventory §B.2.2 lists 8 bwip-js args that V1 Path B forwarded
 * (`bcid`, `text`, `scale`, `width`, `height`, `includetext`, `textsize`,
 * `barcolor`). Sprint 22g GL widens the surface to 16 bwip-js opts which
 * the renderer (BarcodeElement / QrcodeElement / print/render.ts) pulls
 * from a uniform `options` bag.
 *
 * Forward-only — never read back into options.* (no side effects).
 *
 * Recognized V3 option keys (lowercase first, V1-PascalCase fallback):
 *   barColor              → barcolor
 *   backgroundColor       → backgroundcolor
 *   borderColor           → bordercolor
 *   borderWidth           → borderwidth   (mm)
 *   includeText           → includetext   (bool)
 *   textYAlign            → textyalign    ('above'|'below'|'center')
 *   textXAlign            → textxalign    ('left'|'center'|'right'|'offleft'|'offright'|'justify')
 *   textGaps              → textgaps      (mm)
 *   textFont              → textfont
 *   alttext               → alttext       (replacement encoded label)
 *   addOn                 → addon
 *   addOnText             → addontext
 *   addOnTextGaps         → addontextgaps (mm)
 *   guardWhitespace       → guardwhitespace (bool)
 *   rotate                → rotate        ('N'|'R'|'L'|'I')
 *
 * V1 inventory §B.2.2 + §J.4 (textmargin/-1 hard-coded) — V3 surfaces the
 * remaining 16 via this helper.
 */

import { safeNumber } from './dom-helpers'

/** Subset of bwip-js options we forward. Permissive `string | number | boolean`. */
export type BwipPassthroughOpts = Record<string, string | number | boolean>

/**
 * Read `options.<v3key>` and emit the bwip-js arg shape. Skips when the
 * option is `undefined` / null / '' so bwip-js falls back to its own
 * defaults.
 *
 * Implementation note: bwip-js permits unknown keys (silently ignored) so
 * we can pass-through optimistically.
 */
export function collectBwipPassthrough(
  opts: Record<string, unknown>
): BwipPassthroughOpts {
  const out: BwipPassthroughOpts = {}

  // Color/border family.
  if (typeof opts.backgroundColor === 'string' && opts.backgroundColor) {
    // bwip-js wants the hex WITHOUT leading '#'. Strip a single '#' prefix.
    out.backgroundcolor = stripHash(opts.backgroundColor)
  }
  if (typeof opts.borderColor === 'string' && opts.borderColor) {
    out.bordercolor = stripHash(opts.borderColor)
  }
  if (opts.borderWidth != null && opts.borderWidth !== '') {
    out.borderwidth = safeNumber(opts.borderWidth, { fallback: 0, min: 0 })
  }

  // Text positioning family.
  if (typeof opts.textYAlign === 'string' && opts.textYAlign) {
    out.textyalign = opts.textYAlign
  }
  if (typeof opts.textXAlign === 'string' && opts.textXAlign) {
    out.textxalign = opts.textXAlign
  }
  if (opts.textGaps != null && opts.textGaps !== '') {
    out.textgaps = safeNumber(opts.textGaps, { fallback: 0 })
  }
  if (typeof opts.textFont === 'string' && opts.textFont) {
    out.textfont = opts.textFont
  }

  // Alt text / replacement label.
  if (typeof opts.alttext === 'string' && opts.alttext) {
    out.alttext = opts.alttext
  }

  // Add-ons (EAN/UPC supplementary codes).
  if (typeof opts.addOn === 'string' && opts.addOn) {
    out.addon = opts.addOn
  }
  if (typeof opts.addOnText === 'string' && opts.addOnText) {
    out.addontext = opts.addOnText
  }
  if (opts.addOnTextGaps != null && opts.addOnTextGaps !== '') {
    out.addontextgaps = safeNumber(opts.addOnTextGaps, { fallback: 0 })
  }

  // Guard / rotate.
  if (opts.guardWhitespace === true || opts.guardWhitespace === 'true') {
    out.guardwhitespace = true
  }
  if (typeof opts.rotate === 'string' && /^[NRLI]$/.test(opts.rotate)) {
    // bwip-js `rotate: 'N'|'R'|'L'|'I'`. V3 also supports numeric rotate via
    // the element wrapper transform; this is the SVG-internal rotation.
    out.rotate = opts.rotate
  }

  // V1 §J.4 quirk parity — `textmargin` exposure (-1..N). V1 hardcoded -1
  // in Path A but Path B left bwip-js default; V3 surfaces both. NOTE the
  // explicit `min: -Infinity` — default safeNumber clamps to 0 which would
  // silently drop V1's -1 pull-up quirk.
  if (opts.textMargin != null && opts.textMargin !== '') {
    out.textmargin = safeNumber(opts.textMargin, {
      fallback: 0,
      min: -Infinity,
    })
  }

  return out
}

/** Strip a single leading '#' from a hex color. Lowercase. */
function stripHash(s: string): string {
  const lc = String(s).toLowerCase()
  return lc.startsWith('#') ? lc.slice(1) : lc
}
