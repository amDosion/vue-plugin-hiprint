/**
 * factory.spec.js — createPrintElementByType factory.
 */
import { describe, it, expect } from 'vitest'
import {
  createPrintElementByType,
  TextPrintElement,
  LongTextPrintElement,
  ImagePrintElement,
  HtmlPrintElement,
  BarcodePrintElement,
  QRCodePrintElement,
  HLinePrintElement,
  VLinePrintElement,
  RectPrintElement,
  OvalPrintElement,
  TablePrintElement,
} from '../index.js'

describe('createPrintElementByType', () => {
  const eachType = [
    ['text', TextPrintElement],
    ['longText', LongTextPrintElement],
    ['image', ImagePrintElement],
    ['html', HtmlPrintElement],
    ['barcode', BarcodePrintElement],
    ['qrcode', QRCodePrintElement],
    ['hline', HLinePrintElement],
    ['vline', VLinePrintElement],
    ['rect', RectPrintElement],
    ['oval', OvalPrintElement],
    ['table', TablePrintElement],
  ]

  eachType.forEach(([type, Cls]) => {
    it('creates ' + type + ' → ' + Cls.name, () => {
      const el = createPrintElementByType({ tid: 'm.' + type, title: type, type }, {})
      expect(el).toBeInstanceOf(Cls)
    })
  })

  it('throws on unknown type', () => {
    expect(() => createPrintElementByType({ type: 'unknown' }, {})).toThrow(
      /unsupported element type: unknown/
    )
  })

  it('creates table → TablePrintElement (P7 done)', () => {
    const el = createPrintElementByType({ tid: 'm.table', title: 'T', type: 'table' }, {})
    expect(el).toBeInstanceOf(TablePrintElement)
  })
})

describe('TextPrintElement.getText', () => {
  it('title-prefix + value', () => {
    const el = new TextPrintElement({ tid: 'm.t', title: 'Name', type: 'text' }, {})
    expect(el.getText('Alice')).toBe('Name：Alice')
  })

  it('hideTitle=true → value only', () => {
    const el = new TextPrintElement({ tid: 'm.t', title: 'Name', type: 'text' }, {})
    expect(el.getText('Alice', true)).toBe('Alice')
  })

  it('[PM-002 R3] preserves 0 / false / ""', () => {
    const el = new TextPrintElement({ tid: 'm.t', title: 'V', type: 'text' }, {})
    expect(el.getText(0)).toBe('V：0')
    expect(el.getText(false)).toBe('V：false')
    expect(el.getText('')).toBe('V：')
  })

  it('formatter overrides (by-design HTML)', () => {
    const el = new TextPrintElement(
      { tid: 'm.t', title: 'Name', type: 'text' },
      { formatter: (title, v) => '<b>' + title + '</b>: ' + v }
    )
    expect(el.getText('Alice')).toBe('<b>Name</b>: Alice')
  })
})

describe('ImagePrintElement.getData (fallback chain)', () => {
  it('falls back to options.src when field value empty', () => {
    const el = new ImagePrintElement(
      { tid: 'm.img', type: 'image', title: 'I' },
      { field: 'photo', src: '/default.png' }
    )
    expect(el.getData({ photo: '' })).toBe('/default.png')
  })

  it('uses templateData when present', () => {
    const el = new ImagePrintElement(
      { tid: 'm.img', type: 'image', title: 'I' },
      { field: 'photo', src: '/default.png' }
    )
    expect(el.getData({ photo: '/user.jpg' })).toBe('/user.jpg')
  })

  it('no templateData → options.src', () => {
    const el = new ImagePrintElement(
      { tid: 'm.img', type: 'image', title: 'I' },
      { src: '/default.png' }
    )
    expect(el.getData()).toBe('/default.png')
  })
})
