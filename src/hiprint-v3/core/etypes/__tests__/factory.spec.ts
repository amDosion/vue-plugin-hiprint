/**
 * factory.spec.ts — V3 etype factories.
 *
 * Mirrors V2 src/hiprint-v2/core/etypes/__tests__/factory.spec.js but for the
 * pure-data factories (return BaseElement, not jQuery-coupled subclasses).
 */

import { describe, it, expect } from 'vitest'
import {
  createTextElement,
  createImageElement,
  createLongTextElement,
  createBarcodeElement,
  createQrcodeElement,
  createHtmlElement,
  createHLineElement,
  createVLineElement,
  createRectElement,
  createOvalElement,
  createTableElement,
  createElementByType,
  getTextDisplay,
  composeLongTextDisplay,
  resolveImageSrc,
  normalizeTableColumn,
  normalizeTableColumns,
  TEXT_DEFAULT_OPTIONS,
  IMAGE_DEFAULT_OPTIONS,
  TABLE_DEFAULT_OPTIONS,
} from '../index'

describe('createTextElement', () => {
  it('returns BaseElement with type=text + default options', () => {
    const el = createTextElement()
    expect(el.type).toBe('text')
    expect(el.tid).toBe('defaultModule.text')
    expect(el.record.options.width).toBe(TEXT_DEFAULT_OPTIONS.width)
    expect(el.record.options.fontSize).toBe(TEXT_DEFAULT_OPTIONS.fontSize)
  })
  it('honors options override', () => {
    const el = createTextElement({ options: { width: 222 } })
    expect(el.record.options.width).toBe(222)
    expect(el.record.options.fontSize).toBe(TEXT_DEFAULT_OPTIONS.fontSize)
  })
  it('honors tid override', () => {
    const el = createTextElement({ tid: 'biz.label' })
    expect(el.tid).toBe('biz.label')
    expect(el.record.printElementType.tid).toBe('biz.label')
  })
})

describe('getTextDisplay', () => {
  it('title + sep + value', () => {
    expect(getTextDisplay('Alice', 'Name')).toBe('Name：Alice')
  })
  it('hideTitle → value only', () => {
    expect(getTextDisplay('Alice', 'Name', true)).toBe('Alice')
  })
  it('[PM-002 R3] preserves 0 / false / ""', () => {
    expect(getTextDisplay(0, 'V')).toBe('V：0')
    expect(getTextDisplay(false, 'V')).toBe('V：false')
    expect(getTextDisplay('', 'V')).toBe('V：')
  })
  it('empty title → value only', () => {
    expect(getTextDisplay('Alice', '')).toBe('Alice')
    expect(getTextDisplay('Alice')).toBe('Alice')
  })
  it('custom titleSep', () => {
    expect(getTextDisplay('Alice', 'Name', false, ' = ')).toBe('Name = Alice')
  })
})

describe('createImageElement', () => {
  it('returns BaseElement with type=image + default options', () => {
    const el = createImageElement()
    expect(el.type).toBe('image')
    expect(el.tid).toBe('defaultModule.image')
    expect(el.record.options.fit).toBe(IMAGE_DEFAULT_OPTIONS.fit)
  })
})

describe('resolveImageSrc (fallback chain)', () => {
  it('returns templateData[field] when present', () => {
    const src = resolveImageSrc(
      { field: 'photo', src: '/default.png' },
      { type: 'image' },
      { photo: '/user.jpg' }
    )
    expect(src).toBe('/user.jpg')
  })

  it('falls back to options.src when field value empty', () => {
    const src = resolveImageSrc(
      { field: 'photo', src: '/default.png' },
      { type: 'image' },
      { photo: '' }
    )
    expect(src).toBe('/default.png')
  })

  it('no templateData → options.src', () => {
    const src = resolveImageSrc({ src: '/default.png' }, { type: 'image' })
    expect(src).toBe('/default.png')
  })

  it('printElementType.field used when options.field missing', () => {
    const src = resolveImageSrc(
      { src: '/default.png' },
      { type: 'image', field: 'photo' },
      { photo: '/u.jpg' }
    )
    expect(src).toBe('/u.jpg')
  })

  it('fallback to printElementType.getData() when configured', () => {
    const src = resolveImageSrc(
      {},
      {
        type: 'image',
        getData: () => '/dynamic.png',
      },
      undefined
    )
    expect(src).toBe('/dynamic.png')
  })

  it('returns "" when nothing resolves', () => {
    expect(resolveImageSrc({}, { type: 'image' })).toBe('')
  })
})

describe('createLongTextElement', () => {
  it('returns BaseElement with type=longText + default lineHeight', () => {
    const el = createLongTextElement()
    expect(el.type).toBe('longText')
    expect(el.record.options.lineHeight).toBe(1.5)
  })
})

describe('composeLongTextDisplay', () => {
  it('title + sep + value', () => {
    expect(composeLongTextDisplay('Hi', 'T')).toBe('T：Hi')
  })
  it('hideTitle suppresses title', () => {
    expect(composeLongTextDisplay('Hi', 'T', true)).toBe('Hi')
  })
  it('PM-002 preserves 0 / false / ""', () => {
    expect(composeLongTextDisplay(0, 'V')).toBe('V：0')
    expect(composeLongTextDisplay(false, 'V')).toBe('V：false')
  })
})

describe('createBarcodeElement', () => {
  it('defaults to code128', () => {
    const el = createBarcodeElement()
    expect(el.type).toBe('barcode')
    expect(el.record.options.barcodeType).toBe('code128')
    expect(el.record.options.barAutoWidth).toBe(true)
  })
})

describe('createQrcodeElement', () => {
  it('defaults to qrcode + level 0', () => {
    const el = createQrcodeElement()
    expect(el.type).toBe('qrcode')
    expect(el.record.options.qrcodeType).toBe('qrcode')
    expect(el.record.options.qrCodeLevel).toBe(0)
  })
})

describe('createHtmlElement', () => {
  it('returns html type', () => {
    const el = createHtmlElement()
    expect(el.type).toBe('html')
    expect(el.tid).toBe('defaultModule.html')
  })
})

describe('shape line factories', () => {
  it('hline', () => {
    const el = createHLineElement()
    expect(el.type).toBe('hline')
    expect(el.record.options.borderTop).toBe('solid')
  })
  it('vline', () => {
    const el = createVLineElement()
    expect(el.type).toBe('vline')
    expect(el.record.options.borderLeft).toBe('solid')
  })
  it('rect', () => {
    const el = createRectElement()
    expect(el.type).toBe('rect')
  })
  it('oval', () => {
    const el = createOvalElement()
    expect(el.type).toBe('oval')
    expect(el.record.options.borderRadius).toBe(50)
  })
})

describe('createTableElement', () => {
  it('returns table type with default columns', () => {
    const el = createTableElement()
    expect(el.type).toBe('table')
    expect(el.record.options.width).toBe(TABLE_DEFAULT_OPTIONS.width)
    const cols = el.record.options.columns as unknown[][]
    expect(Array.isArray(cols)).toBe(true)
    expect(cols.length).toBe(1)
  })

  it('accepts single-row columns and normalizes to multi-row', () => {
    const el = createTableElement({
      columns: [
        { title: 'Name', field: 'n', width: 50 },
        { title: 'Age', field: 'a', width: 30 },
      ],
    })
    const cols = el.record.options.columns as Array<Array<{ title: string }>>
    expect(cols.length).toBe(1)
    expect(cols[0]!.length).toBe(2)
  })

  it('preserves multi-row columns', () => {
    const el = createTableElement({
      columns: [
        [{ title: 'Hdr', colspan: 2 }],
        [
          { title: 'A', field: 'a' },
          { title: 'B', field: 'b' },
        ],
      ],
    })
    const cols = el.record.options.columns as Array<unknown[]>
    expect(cols.length).toBe(2)
    expect(cols[1]!.length).toBe(2)
  })
})

describe('normalizeTableColumn', () => {
  it('defaults colspan/rowspan to 1', () => {
    const col = normalizeTableColumn({ title: 'T', field: 'f' })
    expect(col.colspan).toBe(1)
    expect(col.rowspan).toBe(1)
  })

  it('parses string colspan to number', () => {
    const col = normalizeTableColumn({
      colspan: '2' as unknown as number,
    })
    expect(col.colspan).toBe(2)
  })

  it('defaults width to 100', () => {
    expect(normalizeTableColumn({ title: 'T' }).width).toBe(100)
  })

  it('keeps explicit width', () => {
    expect(normalizeTableColumn({ width: 250 }).width).toBe(250)
  })

  it('columnId defaults to field', () => {
    expect(normalizeTableColumn({ field: 'name' }).columnId).toBe('name')
  })
})

describe('normalizeTableColumns', () => {
  it('empty / nullish → [[]]', () => {
    expect(normalizeTableColumns(undefined)).toEqual([[]])
    expect(normalizeTableColumns(null)).toEqual([[]])
    expect(normalizeTableColumns([])).toEqual([[]])
  })

  it('single-row → wraps into multi-row', () => {
    const out = normalizeTableColumns([{ title: 'A' }, { title: 'B' }])
    expect(out.length).toBe(1)
    expect(out[0]!.length).toBe(2)
  })

  it('multi-row → preserved with normalized cells', () => {
    const out = normalizeTableColumns([
      [{ title: 'H1' }],
      [{ title: 'D1' }, { title: 'D2' }],
    ])
    expect(out.length).toBe(2)
    expect(out[0]![0]!.colspan).toBe(1)
  })
})

describe('createElementByType', () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    ['text', 'defaultModule.text'],
    ['image', 'defaultModule.image'],
    ['longText', 'defaultModule.longText'],
    ['html', 'defaultModule.html'],
    ['barcode', 'defaultModule.barcode'],
    ['qrcode', 'defaultModule.qrcode'],
    ['hline', 'defaultModule.hline'],
    ['vline', 'defaultModule.vline'],
    ['rect', 'defaultModule.rect'],
    ['oval', 'defaultModule.oval'],
    ['table', 'defaultModule.table'],
  ]

  cases.forEach(([type, expectedTid]) => {
    it('creates ' + type + ' via dispatcher', () => {
      const el = createElementByType({ type })
      expect(el.type).toBe(type)
      expect(el.tid).toBe(expectedTid)
    })
  })

  it('throws on unknown type', () => {
    expect(() => createElementByType({ type: 'unknown' })).toThrow(
      /unsupported element type: unknown/
    )
  })

  it('honors custom tid via printElementType', () => {
    const el = createElementByType({ tid: 'biz.t', type: 'text' })
    expect(el.tid).toBe('biz.t')
  })

  it('produces unique ids per call', () => {
    const a = createElementByType({ type: 'text' })
    const b = createElementByType({ type: 'text' })
    expect(a.id).not.toBe(b.id)
  })
})
