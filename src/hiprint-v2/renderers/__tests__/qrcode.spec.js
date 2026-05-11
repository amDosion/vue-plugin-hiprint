/**
 * qrcode.spec.js — buildQrcodeOptions pure logic.
 */
import { describe, it, expect } from 'vitest'
import { buildQrcodeOptions } from '../qrcode.js'

describe('buildQrcodeOptions', () => {
  it('defaults bcid to qrcode', () => {
    const { bwipOpts } = buildQrcodeOptions({ width: 100, height: 100 }, 'x')
    expect(bwipOpts.bcid).toBe('qrcode')
  })

  it('square preservation: width === height = min(w, h)', () => {
    const { bwipOpts } = buildQrcodeOptions({ width: 100, height: 200 }, 'x')
    expect(bwipOpts.width).toBe(bwipOpts.height)
  })

  it('error correction levels mapping', () => {
    expect(buildQrcodeOptions({ width: 100, height: 100, qrCodeLevel: 0 }, 'x').bwipOpts.eclevel).toBe('M')
    expect(buildQrcodeOptions({ width: 100, height: 100, qrCodeLevel: 1 }, 'x').bwipOpts.eclevel).toBe('L')
    expect(buildQrcodeOptions({ width: 100, height: 100, qrCodeLevel: 2 }, 'x').bwipOpts.eclevel).toBe('H')
    expect(buildQrcodeOptions({ width: 100, height: 100, qrCodeLevel: 3 }, 'x').bwipOpts.eclevel).toBe('Q')
  })

  it('qrCodeLevel undefined → default M', () => {
    expect(buildQrcodeOptions({ width: 100, height: 100 }, 'x').bwipOpts.eclevel).toBe('M')
  })

  it('text fallback chain', () => {
    expect(buildQrcodeOptions({ width: 100, height: 100, testData: 'T' }, 'a').bwipOpts.text).toBe('a')
    expect(buildQrcodeOptions({ width: 100, height: 100, testData: 'T' }, '').bwipOpts.text).toBe('T')
    expect(buildQrcodeOptions({ width: 100, height: 100 }, '').bwipOpts.text).toBe('')
  })

  it('padding for wide aspect (width > height)', () => {
    const out = buildQrcodeOptions({ width: 200, height: 100 }, 'x')
    expect(out.paddingwidth).toBeGreaterThan(0)
    expect(out.paddingheight).toBe(0)
  })

  it('padding for tall aspect (height > width)', () => {
    const out = buildQrcodeOptions({ width: 100, height: 200 }, 'x')
    expect(out.paddingwidth).toBe(0)
    expect(out.paddingheight).toBeGreaterThan(0)
  })
})
