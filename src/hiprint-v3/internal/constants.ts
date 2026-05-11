/**
 * constants.ts — V3 shared constants (ported from V2 internal/constants.js).
 *
 * No behavior change from V2; types added for strict mode.
 */

/**
 * Element types supported by hiprint.
 * 业务方 setDynamicFields validate fieldDef.type 时校验此列表 (R1 fix).
 */
export const SUPPORTED_ELEMENT_TYPES = Object.freeze([
  'text',
  'image',
  'longText',
  'table',
  'barcode',
  'qrcode',
  'hline',
  'vline',
  'rect',
  'oval',
  'html',
] as const)

export type SupportedElementType = (typeof SUPPORTED_ELEMENT_TYPES)[number]

/**
 * Default paper types. 单位: mm. Width × height.
 */
export interface PaperSize {
  readonly width: number
  readonly height: number
}

export const DEFAULT_PAPER_TYPES: Readonly<Record<string, PaperSize>> = Object.freeze({
  A3: { width: 297, height: 420 },
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
  B3: { width: 353, height: 500 },
  B4: { width: 250, height: 353 },
  B5: { width: 176, height: 250 },
})

/** Default scale bounds for paper zoom. */
export const SCALE_MIN_DEFAULT = 0.5
export const SCALE_MAX_DEFAULT = 5
export const SCALE_STEP_DEFAULT = 0.1

/** Security cap for formatter / styler eval (PM-013 + R3 M3). */
export const FORMATTER_MAX_LEN = 5000
