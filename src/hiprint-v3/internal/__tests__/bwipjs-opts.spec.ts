/**
 * bwipjs-opts.spec.ts — TKT-364 bwip-js extra-opts passthrough.
 *
 * Sprint 22g wave 3 (Stream GL). V1 §B.2.2 / §J.4 reference. Confirms the
 * collector emits the expected bwip-js arg keys and skips on null/empty
 * input so bwip-js falls back to its own defaults.
 */
import { describe, it, expect } from 'vitest'
import { collectBwipPassthrough } from '../bwipjs-opts'

describe('collectBwipPassthrough — TKT-364', () => {
  it('returns empty object for empty options bag', () => {
    expect(collectBwipPassthrough({})).toEqual({})
  })

  it('strips leading # from backgroundColor + forwards as backgroundcolor', () => {
    const out = collectBwipPassthrough({ backgroundColor: '#FFFFE0' })
    expect(out.backgroundcolor).toBe('ffffe0')
  })

  it('strips leading # from borderColor + forwards as bordercolor', () => {
    const out = collectBwipPassthrough({ borderColor: '#330000' })
    expect(out.bordercolor).toBe('330000')
  })

  it('forwards borderWidth numerically', () => {
    const out = collectBwipPassthrough({ borderWidth: 2 })
    expect(out.borderwidth).toBe(2)
  })

  it('forwards textYAlign/textXAlign/textGaps/textFont', () => {
    const out = collectBwipPassthrough({
      textYAlign: 'below',
      textXAlign: 'center',
      textGaps: 1.5,
      textFont: 'OCR-B',
    })
    expect(out.textyalign).toBe('below')
    expect(out.textxalign).toBe('center')
    expect(out.textgaps).toBe(1.5)
    expect(out.textfont).toBe('OCR-B')
  })

  it('forwards EAN/UPC add-on family', () => {
    const out = collectBwipPassthrough({
      addOn: '12345',
      addOnText: 'Add-on text',
      addOnTextGaps: 2,
    })
    expect(out.addon).toBe('12345')
    expect(out.addontext).toBe('Add-on text')
    expect(out.addontextgaps).toBe(2)
  })

  it('forwards guardWhitespace as boolean (string "true" also accepted)', () => {
    expect(
      collectBwipPassthrough({ guardWhitespace: true }).guardwhitespace
    ).toBe(true)
    expect(
      collectBwipPassthrough({ guardWhitespace: 'true' }).guardwhitespace
    ).toBe(true)
    // Falsy values omit the key entirely.
    expect(collectBwipPassthrough({ guardWhitespace: false })).toEqual({})
  })

  it('forwards rotate only for the canonical N/R/L/I enum', () => {
    expect(collectBwipPassthrough({ rotate: 'R' }).rotate).toBe('R')
    expect(collectBwipPassthrough({ rotate: 'I' }).rotate).toBe('I')
    // Numeric rotate is handled by the wrapper transform; bwip-js ignores it.
    expect(collectBwipPassthrough({ rotate: 90 })).toEqual({})
    // Lowercase r/random strings rejected.
    expect(collectBwipPassthrough({ rotate: 'r' })).toEqual({})
  })

  it('forwards textMargin including negative values (V1 §J.4 -1 quirk)', () => {
    expect(collectBwipPassthrough({ textMargin: -1 }).textmargin).toBe(-1)
    expect(collectBwipPassthrough({ textMargin: 0 }).textmargin).toBe(0)
    expect(collectBwipPassthrough({ textMargin: 4 }).textmargin).toBe(4)
  })

  it('forwards alttext string verbatim', () => {
    expect(collectBwipPassthrough({ alttext: 'ABC-123' }).alttext).toBe(
      'ABC-123'
    )
  })

  it('skips nullish / empty string values (lets bwip-js use defaults)', () => {
    const out = collectBwipPassthrough({
      backgroundColor: '',
      borderColor: null,
      borderWidth: undefined,
      textYAlign: '',
      textXAlign: undefined,
      addOn: '',
      alttext: undefined,
    })
    expect(out).toEqual({})
  })

  it('coexists with the per-element fixed opts (no key collisions in core)', () => {
    // The renderer spreads collectBwipPassthrough(opts) FIRST and then the
    // fixed bcid/text/scale/.../barcolor wins on collision. Confirm none of
    // those core keys are emitted by the passthrough.
    const out = collectBwipPassthrough({
      barColor: '#000000',
      width: 100,
      height: 30,
      hideTitle: false,
      barcodeType: 'code128',
      qrcodeType: 'qrcode',
    })
    expect(out).not.toHaveProperty('bcid')
    expect(out).not.toHaveProperty('text')
    expect(out).not.toHaveProperty('scale')
    expect(out).not.toHaveProperty('width')
    expect(out).not.toHaveProperty('height')
    expect(out).not.toHaveProperty('includetext')
    expect(out).not.toHaveProperty('textsize')
    expect(out).not.toHaveProperty('barcolor')
    expect(out).not.toHaveProperty('eclevel')
  })
})
