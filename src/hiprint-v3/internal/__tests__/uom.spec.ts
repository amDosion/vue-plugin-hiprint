/**
 * uom.spec.ts — pt / px / mm conversions.
 *
 * happy-dom 不实测 1in 物理尺寸, getDpi() fallback 96 (现代浏览器默认 DPI).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { pt, px, mm, _resetDpiCache } from '../uom'

describe('uom (96 DPI fallback)', () => {
  beforeEach(() => {
    _resetDpiCache()
  })

  it('pt to mm (72pt = 1 inch = 25.4mm)', () => {
    expect(pt.toMm(72)).toBeCloseTo(25.4, 1)
  })

  it('mm to pt (25.4mm = 72pt)', () => {
    expect(mm.toPt(25.4)).toBeCloseTo(72, 1)
  })

  it('mm to px (1in = 96px at 96 DPI)', () => {
    expect(mm.toPx(25.4)).toBeCloseTo(96, 0)
  })

  it('px to pt round-trip', () => {
    const original = 144
    expect(px.toPt(pt.toPx(original))).toBeCloseTo(original, 1)
  })

  it('px to mm', () => {
    expect(px.toMm(96)).toBeCloseTo(25.4, 1)
  })

  it('dpi getter exposed', () => {
    expect(pt.dpi).toBeGreaterThan(0)
    expect(px.dpi).toBeGreaterThan(0)
  })
})
