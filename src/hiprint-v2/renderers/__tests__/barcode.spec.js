/**
 * barcode.spec.js — buildBarcodeOptions pure logic.
 */
import { describe, it, expect } from 'vitest'
import { buildBarcodeOptions } from '../barcode.js'

describe('buildBarcodeOptions', () => {
  it('defaults bcid to code128', () => {
    const out = buildBarcodeOptions({ width: 100, height: 50 }, '123')
    expect(out.bcid).toBe('code128')
  })

  it('overrides bcid from options', () => {
    const out = buildBarcodeOptions({ width: 100, height: 50, barcodeType: 'ean13' }, '12')
    expect(out.bcid).toBe('ean13')
  })

  it('text fallback: arg > testData > title > empty', () => {
    expect(buildBarcodeOptions({ width: 100, height: 50, testData: 'TEST' }, 'ARG').text).toBe('ARG')
    expect(buildBarcodeOptions({ width: 100, height: 50, testData: 'TEST' }, '').text).toBe('TEST')
    expect(buildBarcodeOptions({ width: 100, height: 50, title: 'TITLE' }, '').text).toBe('TITLE')
    expect(buildBarcodeOptions({ width: 100, height: 50 }, '').text).toBe('')
  })

  it('barAutoWidth=true → width="" (auto)', () => {
    const out = buildBarcodeOptions({ width: 100, height: 50, barAutoWidth: true }, 'x')
    expect(out.width).toBe('')
  })

  it('barAutoWidth=false → width=integer from pt', () => {
    const out = buildBarcodeOptions({ width: 100, height: 50, barAutoWidth: false }, 'x')
    expect(typeof out.width).toBe('number')
    expect(out.width).toBeGreaterThan(0)
  })

  it('includetext = !hideTitle', () => {
    expect(buildBarcodeOptions({ width: 100, height: 50 }, 'x').includetext).toBe(true)
    expect(buildBarcodeOptions({ width: 100, height: 50, hideTitle: true }, 'x').includetext).toBe(false)
  })

  it('textsize defaults to 10 when fontSize missing', () => {
    expect(buildBarcodeOptions({ width: 100, height: 50 }, 'x').textsize).toBe(10)
    expect(buildBarcodeOptions({ width: 100, height: 50, fontSize: 14 }, 'x').textsize).toBe(14)
  })

  it('barcolor defaults to #000', () => {
    expect(buildBarcodeOptions({ width: 100, height: 50 }, 'x').barcolor).toBe('#000')
    expect(buildBarcodeOptions({ width: 100, height: 50, barColor: '#f00' }, 'x').barcolor).toBe('#f00')
  })
})
