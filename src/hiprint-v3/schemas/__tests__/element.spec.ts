/**
 * element.spec.ts — per-element schema + discriminated union (elementSchema).
 *
 * V1 storage shape: { options, printElementType: { tid, type, ... } }.
 * The discriminator lives at `printElementType.type`. Each etype sub-schema
 * (text/image/longText/barcode/qrcode/html/hline/vline/rect/oval/table) extends
 * baseElementOptionsSchema + adds its own keys, then `.loose()` lets unknown
 * future keys pass through (Invariant #13 — superset-compat).
 */
import { describe, it, expect } from 'vitest'
import {
  elementSchema,
  elementJsonSchema,
  textElementSchema,
  imageElementSchema,
  longTextElementSchema,
  barcodeElementSchema,
  qrcodeElementSchema,
  htmlElementSchema,
  hlineElementSchema,
  vlineElementSchema,
  rectElementSchema,
  ovalElementSchema,
  tableElementSchema,
} from '../element'

const baseOptions = { left: 10, top: 10, width: 100, height: 20 }

describe('textElementSchema', () => {
  it('parses minimal text element', () => {
    const out = textElementSchema.parse({
      options: { ...baseOptions, title: 'T', field: 'name' },
      printElementType: { type: 'text', tid: 'default.text' },
    })
    expect(out.printElementType.type).toBe('text')
    expect(out.options.title).toBe('T')
  })

  it('rejects when type literal is wrong', () => {
    expect(() =>
      textElementSchema.parse({
        options: baseOptions,
        printElementType: { type: 'image' },
      }),
    ).toThrow()
  })
})

describe('imageElementSchema', () => {
  it('parses image with src + fit', () => {
    const out = imageElementSchema.parse({
      options: { ...baseOptions, src: 'data:image/png;base64,xxx', fit: 'contain' },
      printElementType: { type: 'image', tid: 'default.image' },
    })
    expect(out.options.src).toMatch(/^data:image/)
    expect(out.options.fit).toBe('contain')
  })

  it('rejects invalid fit enum', () => {
    expect(() =>
      imageElementSchema.parse({
        options: { fit: 'banana' },
        printElementType: { type: 'image' },
      }),
    ).toThrow()
  })
})

describe('longTextElementSchema', () => {
  it('parses with indent + lineHeight', () => {
    const out = longTextElementSchema.parse({
      options: { ...baseOptions, longTextIndent: 2, lineHeight: '1.5' },
      printElementType: { type: 'longText' },
    })
    expect(out.options.longTextIndent).toBe(2)
    expect(out.options.lineHeight).toBe(1.5)
  })
})

describe('barcodeElementSchema', () => {
  it('parses with barcodeType', () => {
    const out = barcodeElementSchema.parse({
      options: { ...baseOptions, barcodeType: 'code128', barWidth: '2' },
      printElementType: { type: 'barcode' },
    })
    expect(out.options.barcodeType).toBe('code128')
    expect(out.options.barWidth).toBe(2)
  })
})

describe('qrcodeElementSchema', () => {
  it('parses qrCodeLevel literal', () => {
    const out = qrcodeElementSchema.parse({
      options: { ...baseOptions, qrCodeLevel: 2 },
      printElementType: { type: 'qrcode' },
    })
    expect(out.options.qrCodeLevel).toBe(2)
  })

  it('rejects qrCodeLevel out of range', () => {
    expect(() =>
      qrcodeElementSchema.parse({
        options: { qrCodeLevel: 9 },
        printElementType: { type: 'qrcode' },
      }),
    ).toThrow()
  })
})

describe('htmlElementSchema', () => {
  it('parses content string', () => {
    const out = htmlElementSchema.parse({
      options: { content: '<b>x</b>' },
      printElementType: { type: 'html' },
    })
    expect(out.options.content).toBe('<b>x</b>')
  })
})

describe('shape element schemas', () => {
  it('hline parses bare options', () => {
    expect(
      hlineElementSchema.parse({ options: baseOptions, printElementType: { type: 'hline' } }),
    ).toBeDefined()
  })

  it('vline parses bare options', () => {
    expect(
      vlineElementSchema.parse({ options: baseOptions, printElementType: { type: 'vline' } }),
    ).toBeDefined()
  })

  it('rect parses with borderRadius', () => {
    const out = rectElementSchema.parse({
      options: { ...baseOptions, borderRadius: '5' },
      printElementType: { type: 'rect' },
    })
    expect(out.options.borderRadius).toBe(5)
  })

  it('oval parses bare options', () => {
    expect(
      ovalElementSchema.parse({ options: baseOptions, printElementType: { type: 'oval' } }),
    ).toBeDefined()
  })
})

describe('tableElementSchema', () => {
  it('parses with multi-layer columns', () => {
    const out = tableElementSchema.parse({
      options: {
        ...baseOptions,
        columns: [
          [
            { title: 'A', field: 'a', width: 50 },
            { title: 'B', field: 'b', width: 50 },
          ],
        ],
      },
      printElementType: { type: 'table' },
    })
    expect(out.options.columns).toBeDefined()
    expect(Array.isArray(out.options.columns)).toBe(true)
  })

  it('parses with single-layer columns (legacy)', () => {
    const out = tableElementSchema.parse({
      options: {
        ...baseOptions,
        columns: [{ title: 'A', field: 'a', width: 50 }],
      },
      printElementType: { type: 'table' },
    })
    expect(Array.isArray(out.options.columns)).toBe(true)
  })

  it('parses testData as string', () => {
    const out = tableElementSchema.parse({
      options: { testData: '[{"a":1}]' },
      printElementType: { type: 'table' },
    })
    expect(out.options.testData).toBe('[{"a":1}]')
  })
})

describe('elementSchema (union)', () => {
  it('parses each etype via discriminator', () => {
    const types = [
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
    ] as const
    for (const t of types) {
      const out = elementSchema.parse({
        options: baseOptions,
        printElementType: { type: t },
      })
      expect(out.printElementType.type).toBe(t)
    }
  })

  it('rejects unknown type literal', () => {
    expect(() =>
      elementSchema.parse({
        options: baseOptions,
        printElementType: { type: 'unknownEtype' },
      }),
    ).toThrow()
  })

  it('preserves unknown extra options keys via .loose()', () => {
    const out = elementSchema.parse({
      options: { ...baseOptions, futureFieldX: 'future' },
      printElementType: { type: 'text' },
    })
    expect((out.options as Record<string, unknown>).futureFieldX).toBe('future')
  })
})

describe('elementJsonSchema (permissive)', () => {
  it('accepts custom element types not in V1 enum', () => {
    const out = elementJsonSchema.parse({
      options: { foo: 'bar' },
      printElementType: { type: 'text', tid: 'biz.customWidget' },
    })
    expect(out.printElementType.tid).toBe('biz.customWidget')
  })
})
