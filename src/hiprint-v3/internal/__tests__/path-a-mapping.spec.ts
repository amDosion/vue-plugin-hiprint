/**
 * path-a-mapping.spec.ts — TKT-023 V1 Path A → bwip-js mapping contract.
 */
import { describe, it, expect } from 'vitest'
import {
  mapBarcodeMode,
  mapQrCodeLevel,
  qrCodeLevelLetter,
} from '../path-a-mapping'

describe('mapBarcodeMode — V1 enum → bwip-js bcid', () => {
  it('CODE128 → code128', () => {
    expect(mapBarcodeMode('CODE128')).toBe('code128')
  })

  it('CODE128A / B / C all collapse to code128', () => {
    expect(mapBarcodeMode('CODE128A')).toBe('code128')
    expect(mapBarcodeMode('CODE128B')).toBe('code128')
    expect(mapBarcodeMode('CODE128C')).toBe('code128')
  })

  it('EAN13 / EAN8 / EAN5 / EAN2', () => {
    expect(mapBarcodeMode('EAN13')).toBe('ean13')
    expect(mapBarcodeMode('EAN8')).toBe('ean8')
    expect(mapBarcodeMode('EAN5')).toBe('ean5')
    expect(mapBarcodeMode('EAN2')).toBe('ean2')
  })

  it('UPC label → upca (V1 select label "UPC（A）")', () => {
    expect(mapBarcodeMode('UPC')).toBe('upca')
  })

  it('ITF / ITF14 split', () => {
    expect(mapBarcodeMode('ITF')).toBe('interleaved2of5')
    expect(mapBarcodeMode('ITF14')).toBe('itf14')
  })

  it('MSI variants all collapse to msi', () => {
    expect(mapBarcodeMode('MSI')).toBe('msi')
    expect(mapBarcodeMode('MSI10')).toBe('msi')
    expect(mapBarcodeMode('MSI11')).toBe('msi')
    expect(mapBarcodeMode('MSI1010')).toBe('msi')
    expect(mapBarcodeMode('MSI1110')).toBe('msi')
  })

  it('CODE39 → code39', () => {
    expect(mapBarcodeMode('CODE39')).toBe('code39')
  })

  it('Pharmacode → pharmacode', () => {
    expect(mapBarcodeMode('Pharmacode')).toBe('pharmacode')
  })

  it('empty string → code128 default', () => {
    expect(mapBarcodeMode('')).toBe('code128')
  })

  it('undefined / null → code128 default', () => {
    expect(mapBarcodeMode(undefined)).toBe('code128')
    expect(mapBarcodeMode(null)).toBe('code128')
  })

  it('unknown enum value falls through (lowercased)', () => {
    // bwip-js may still recognize lowercase forms (e.g. 'qrcode'); if it
    // does not, the caller's try/catch renders a fallback.
    expect(mapBarcodeMode('SOMETHING_NEW')).toBe('something_new')
  })

  it('case-sensitive: lowercase code128 falls through (returns same string)', () => {
    // V1 enum keys are upper-case; if user passes 'code128' literally, we do
    // NOT find it in the table and lowercase it — net result is 'code128'.
    expect(mapBarcodeMode('code128')).toBe('code128')
  })
})

describe('mapQrCodeLevel — V1 int index clamp', () => {
  it('0 → 0 (M)', () => {
    expect(mapQrCodeLevel(0)).toBe(0)
  })

  it('1 → 1 (L)', () => {
    expect(mapQrCodeLevel(1)).toBe(1)
  })

  it('2 → 2 (H)', () => {
    expect(mapQrCodeLevel(2)).toBe(2)
  })

  it('3 → 3 (Q)', () => {
    expect(mapQrCodeLevel(3)).toBe(3)
  })

  it('out-of-range negative → 0', () => {
    expect(mapQrCodeLevel(-1)).toBe(0)
    expect(mapQrCodeLevel(-100)).toBe(0)
  })

  it('out-of-range positive → 3', () => {
    expect(mapQrCodeLevel(4)).toBe(3)
    expect(mapQrCodeLevel(99)).toBe(3)
  })

  it('string number parses (V1 designer select returns strings)', () => {
    expect(mapQrCodeLevel('0')).toBe(0)
    expect(mapQrCodeLevel('2')).toBe(2)
    expect(mapQrCodeLevel('3')).toBe(3)
  })

  it('non-numeric string → 0 fallback', () => {
    expect(mapQrCodeLevel('xyz')).toBe(0)
  })

  it('null / undefined / "" → 0 default', () => {
    expect(mapQrCodeLevel(null)).toBe(0)
    expect(mapQrCodeLevel(undefined)).toBe(0)
    expect(mapQrCodeLevel('')).toBe(0)
  })

  it('float gets floor()', () => {
    expect(mapQrCodeLevel(1.9)).toBe(1)
    expect(mapQrCodeLevel(2.5)).toBe(2)
  })
})

// TKT-371 (Sprint 22g GL Wave 3) — V1 §B.1.2 lists 18 selectable barcodeMode
// values. Confirm each maps to a canonical bwip-js bcid and none accidentally
// fall through to the lowercase-fallback branch.
describe('mapBarcodeMode — TKT-371 V1 §B.1.2 18-value full enum', () => {
  // V1 inventory §B.1.2 row mapping — JsBarcode `format` → bwip-js `bcid`.
  const matrix: Array<[string, string]> = [
    ['CODE128', 'code128'],
    ['CODE128A', 'code128'],
    ['CODE128B', 'code128'],
    ['CODE128C', 'code128'],
    ['CODE39', 'code39'],
    ['EAN13', 'ean13'],
    ['EAN8', 'ean8'],
    ['EAN5', 'ean5'],
    ['EAN2', 'ean2'],
    ['UPC', 'upca'],
    ['ITF', 'interleaved2of5'],
    ['ITF14', 'itf14'],
    ['MSI', 'msi'],
    ['MSI10', 'msi'],
    ['MSI11', 'msi'],
    ['MSI1010', 'msi'],
    ['MSI1110', 'msi'],
    ['Pharmacode', 'pharmacode'],
  ]
  it.each(matrix)('maps V1 enum %s → bwip-js bcid %s', (input, expected) => {
    expect(mapBarcodeMode(input)).toBe(expected)
  })

  it('covers all 18 V1 selectable enum values (no orphans)', () => {
    // Sanity: a hardcoded length lock — V1 §B.1.2 lists 18 explicit + 1 default.
    expect(matrix.length).toBe(18)
  })
})

describe('qrCodeLevelLetter — index → letter', () => {
  it('maps 0/1/2/3 → M/L/H/Q (V1 line 10491 order)', () => {
    expect(qrCodeLevelLetter(0)).toBe('M')
    expect(qrCodeLevelLetter(1)).toBe('L')
    expect(qrCodeLevelLetter(2)).toBe('H')
    expect(qrCodeLevelLetter(3)).toBe('Q')
  })

  it('out-of-range / null → M (default)', () => {
    expect(qrCodeLevelLetter(undefined)).toBe('M')
    expect(qrCodeLevelLetter(99)).toBe('Q') // clamped to 3 → Q
    expect(qrCodeLevelLetter(-1)).toBe('M') // clamped to 0 → M
  })
})
