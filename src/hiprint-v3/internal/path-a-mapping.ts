/**
 * path-a-mapping.ts — V1 "Path A" → V3 / bwip-js value mapping (TKT-023).
 *
 * V1 stores barcode / qrcode element configurations in TWO shapes:
 *
 *  Path A (legacy V1 surface — text element with `options.textType`):
 *    `{ printElementType: { type: 'text' }, options: { textType: 'barcode',
 *       barcodeMode: 'CODE128', barWidth: 2, ... } }`
 *  Path B (V3 preferred — dedicated barcode/qrcode element):
 *    `{ printElementType: { type: 'barcode' }, options: { barcodeType:
 *       'code128', barWidth: 2, ... } }`
 *
 * Sprint 22a-r TKT-008 migrated `defaultModule.barcode/qrcode/trackingNo`
 * built-in presets from Path A → Path B. However, the V1 designer surface
 * still permits users to STORE templates in Path A shape, and V3 must load
 * such legacy JSON without breaking.
 *
 * This module is a **compat layer**: it maps V1 Path A enum values to the
 * V3/bwip-js equivalents that BarcodeElement / QrcodeElement / render.ts
 * already understand. New code MUST use Path B shape; this helper exists to
 * support legacy template imports only.
 *
 * V1 references:
 *  - bundle.js line 2906-2921 (barcodeMode select — 18 enum values)
 *  - bundle.js line 3476-3491 (qrCodeLevel select — int index 0/1/2/3)
 *  - bundle.js line 10058-10090 (text+textType='barcode' render path)
 *  - bundle.js line 10093-10122 (text+textType='qrcode' render path)
 *
 * Locked invariants (ADR-0011):
 *  - Pure data transform — no DOM, no side effects.
 *  - Unknown input → graceful fallback (returns 'code128' / 0).
 */

/**
 * V1 Path A `options.barcodeMode` enum → bwip-js `bcid` (lowercase).
 * 18 values from designer select (bundle.js line 2906-2921) plus
 * empty-string for "default" (→ 'code128'). V1 passed these directly to
 * JsBarcode's `format` parameter; V3 uses bwip-js whose `bcid` parameter
 * expects the lowercase symbology identifier.
 *
 * Notes on lossy collapses:
 *  - CODE128A / B / C all map to 'code128' (bwip-js subset selection is
 *    internal — A/B/C variants are not separately addressable).
 *  - MSI / MSI10 / MSI11 / MSI1010 / MSI1110 all map to 'msi' (bwip-js
 *    does not expose separate MSI checksum variants).
 *  - UPC (V1 label "UPC（A）") → 'upca'.
 *  - ITF → 'interleaved2of5'; ITF14 → 'itf14'.
 */
const BARCODE_MODE_TO_BCID: Record<string, string> = {
  CODE128: 'code128',
  CODE128A: 'code128',
  CODE128B: 'code128',
  CODE128C: 'code128',
  CODE39: 'code39',
  EAN13: 'ean13',
  EAN8: 'ean8',
  EAN5: 'ean5',
  EAN2: 'ean2',
  UPC: 'upca',
  ITF: 'interleaved2of5',
  ITF14: 'itf14',
  MSI: 'msi',
  MSI10: 'msi',
  MSI11: 'msi',
  MSI1010: 'msi',
  MSI1110: 'msi',
  Pharmacode: 'pharmacode',
}

/**
 * Map a V1 Path A `barcodeMode` enum value to a bwip-js `bcid` value.
 *
 * @param mode  V1 barcodeMode value (case-sensitive, 18 known values) or
 *              undefined / null / '' for "default".
 * @returns     bwip-js `bcid` value (lowercase). Falls back to 'code128'
 *              when the input is empty/nullish. Unknown values are
 *              lowercased — bwip-js will error on truly invalid bcid,
 *              which the caller catches and renders a fallback for.
 *
 * @example
 *   mapBarcodeMode('CODE128') // → 'code128'
 *   mapBarcodeMode('EAN13')   // → 'ean13'
 *   mapBarcodeMode('ITF14')   // → 'itf14'
 *   mapBarcodeMode(undefined) // → 'code128'
 */
export function mapBarcodeMode(mode: string | null | undefined): string {
  if (mode == null || mode === '') return 'code128'
  const mapped = BARCODE_MODE_TO_BCID[mode]
  if (mapped !== undefined) return mapped
  // Unknown enum value → lowercase fallback. bwip-js may still recognize
  // some lowercase forms (e.g. 'qrcode'); the caller's try/catch
  // renders a fallback when bwip-js rejects it.
  return String(mode).toLowerCase()
}

/**
 * V1 Path A `options.qrCodeLevel` is an integer index into the EC-level
 * array `['M', 'L', 'H', 'Q']` (see bundle.js line 10491). V3 BarcodeElement
 * / QrcodeElement / render.ts already use the same convention — see e.g.
 * `safeNumber(opts.qrCodeLevel, { min: 0, max: 3, fallback: 0 })`.
 *
 * This helper makes the contract explicit + centralizes the legal range
 * check.
 *
 * @param level  V1 qrCodeLevel int (0-3) or undefined / null / '' for
 *               "default" (= 0, level M).
 * @returns      Clamped int in [0, 3]. Out-of-range / non-numeric inputs
 *               fall back to 0 ('M').
 *
 * @example
 *   mapQrCodeLevel(0) // → 0 ('M' — 15% recovery)
 *   mapQrCodeLevel(1) // → 1 ('L' — 7% recovery)
 *   mapQrCodeLevel(2) // → 2 ('H' — 30% recovery)
 *   mapQrCodeLevel(3) // → 3 ('Q' — 25% recovery)
 *   mapQrCodeLevel(undefined) // → 0
 */
export function mapQrCodeLevel(level: unknown): number {
  if (level == null || level === '') return 0
  const n =
    typeof level === 'number'
      ? level
      : typeof level === 'string'
        ? Number.parseInt(level, 10)
        : NaN
  if (!Number.isFinite(n)) return 0
  const int = Math.floor(n)
  if (int < 0) return 0
  if (int > 3) return 3
  return int
}

/**
 * V1 Path A `qrCodeLevel` index → letter form ('M'/'L'/'H'/'Q'). Helper for
 * tests / debugging and for bwip-js consumers that prefer the letter form
 * directly.
 *
 * V1 reference: bundle.js line 10491 `['M', 'L', 'H', 'Q'][qrCodeLevel ?? 0]`.
 */
export function qrCodeLevelLetter(level: unknown): 'M' | 'L' | 'H' | 'Q' {
  const idx = mapQrCodeLevel(level)
  return (['M', 'L', 'H', 'Q'] as const)[idx]!
}
