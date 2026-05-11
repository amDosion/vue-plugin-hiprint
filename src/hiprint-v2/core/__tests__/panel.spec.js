/**
 * panel.spec.js — PrintPanel data-layer behaviors.
 */
import { describe, it, expect } from 'vitest'
import { PrintPanel } from '../panel.js'

function makeTextElementSpec(field, title, testData) {
  return {
    options: { left: 0, top: 0, height: 16, width: 100, field, title, testData },
    printElementType: { tid: 'mod.text', type: 'text', title: title },
  }
}

describe('PrintPanel constructor', () => {
  it('defaults: A4 (210x297mm) + paperHeader 10 + paperFooter 780', () => {
    const p = new PrintPanel({})
    expect(p.width).toBe(210)
    expect(p.height).toBe(297)
    expect(p.paperHeader).toBe(10)
    expect(p.paperFooter).toBe(780)
  })

  it('honors provided options', () => {
    const p = new PrintPanel({
      index: 2,
      name: 'P3',
      width: 100,
      height: 200,
      paperHeader: 25,
      paperFooter: 500,
      paperType: 'A5',
      scale: 1.5,
      orient: 'landscape',
    })
    expect(p.index).toBe(2)
    expect(p.name).toBe('P3')
    expect(p.width).toBe(100)
    expect(p.height).toBe(200)
    expect(p.paperHeader).toBe(25)
    expect(p.paperFooter).toBe(500)
    expect(p.paperType).toBe('A5')
    expect(p.scale).toBe(1.5)
    expect(p.orient).toBe('landscape')
  })

  it('[PM-013 R3] paperHeader/paperFooter NaN → safe fallback', () => {
    const p = new PrintPanel({ paperHeader: 'invalid', paperFooter: 'also-invalid' })
    expect(p.paperHeader).toBe(10) // fallback
    expect(p.paperFooter).toBe(780)
  })

  it('initPrintElements from serialized list', () => {
    const p = new PrintPanel({
      printElements: [makeTextElementSpec('name', 'Name', 'Alice')],
    })
    expect(p.printElements).toHaveLength(1)
    expect(p.printElements[0].getField()).toBe('name')
  })

  it('initPrintElements skips broken entries without throwing', () => {
    const p = new PrintPanel({
      printElements: [
        makeTextElementSpec('ok', 'Ok', 'val'),
        { invalid: 'no printElementType' }, // broken
        null, // broken
      ],
    })
    expect(p.printElements).toHaveLength(1) // only valid entry kept
  })
})

describe('PrintPanel element management', () => {
  it('addPrintElement creates instance + wires back-refs', () => {
    const p = new PrintPanel({}, 'tpl-1')
    const el = p.addPrintElement({ tid: 'm.text', type: 'text', title: 'T' }, { field: 'x' })
    expect(p.printElements).toHaveLength(1)
    expect(el.templateId).toBe('tpl-1')
    expect(el.panel).toBe(p)
  })

  it('deletePrintElement by ref', () => {
    const p = new PrintPanel({})
    const el = p.addPrintElement({ tid: 'm.text', type: 'text', title: 'T' }, {})
    p.deletePrintElement(el)
    expect(p.printElements).toHaveLength(0)
  })

  it('deletePrintElement by id string', () => {
    const p = new PrintPanel({})
    const el = p.addPrintElement({ tid: 'm.text', type: 'text', title: 'T' }, {})
    p.deletePrintElement(el.id)
    expect(p.printElements).toHaveLength(0)
  })

  it('getElementByTid first match', () => {
    const p = new PrintPanel({})
    p.addPrintElement({ tid: 'mod.text', type: 'text', title: 'A' }, {})
    p.addPrintElement({ tid: 'mod.image', type: 'image', title: 'B' }, {})
    expect(p.getElementByTid('mod.text').printElementType.title).toBe('A')
    expect(p.getElementByTid('missing')).toBeUndefined()
  })

  it('getElementByName', () => {
    const p = new PrintPanel({})
    p.addPrintElement({ tid: 'm.t', type: 'text', title: 'A' }, { name: 'el1' })
    expect(p.getElementByName('el1')).toBeDefined()
  })
})

describe('PrintPanel serialization', () => {
  it('getPanelEntity captures core options + elements', () => {
    const p = new PrintPanel({
      index: 1,
      name: 'X',
      width: 100,
      height: 200,
      paperHeader: 25,
      paperFooter: 500,
      paperType: 'A5',
      printElements: [makeTextElementSpec('a', 'A')],
    })
    const e = p.getPanelEntity()
    expect(e.index).toBe(1)
    expect(e.name).toBe('X')
    expect(e.width).toBe(100)
    expect(e.height).toBe(200)
    expect(e.paperType).toBe('A5')
    expect(e.printElements).toHaveLength(1)
    expect(e.printElements[0].options.field).toBe('a')
  })

  it('getPanelEntity includeTid=true → only tid + type, not full type def', () => {
    const p = new PrintPanel({
      printElements: [makeTextElementSpec('a', 'A')],
    })
    const e = p.getPanelEntity(true)
    expect(Object.keys(e.printElements[0].printElementType).sort()).toEqual(['tid', 'type'])
  })

  it('getFieldsInPanel returns unique field names', () => {
    const p = new PrintPanel({
      printElements: [
        makeTextElementSpec('a', 'A'),
        makeTextElementSpec('b', 'B'),
        makeTextElementSpec('a', 'A2'), // duplicate field
      ],
    })
    const fields = p.getFieldsInPanel()
    expect(fields).toHaveLength(2)
    expect(fields).toContain('a')
    expect(fields).toContain('b')
  })

  it('getTestData composes nested-field object', () => {
    const p = new PrintPanel({
      printElements: [
        makeTextElementSpec('user.name', 'Name', 'Alice'),
        makeTextElementSpec('user.age', 'Age', 30),
      ],
    })
    const td = p.getTestData()
    expect(td.user.name).toBe('Alice')
    expect(td.user.age).toBe(30)
  })
})

describe('PrintPanel lifecycle', () => {
  it('clear empties printElements + guideLines', () => {
    const p = new PrintPanel({
      printElements: [makeTextElementSpec('a', 'A')],
      guideLines: [{ x: 10 }, { y: 20 }],
    })
    p.clear()
    expect(p.printElements).toHaveLength(0)
    expect(p.guideLines).toHaveLength(0)
  })

  it('destroy is idempotent + clears refs', () => {
    const p = new PrintPanel({
      printElements: [makeTextElementSpec('a', 'A')],
    })
    p.destroy()
    expect(p._destroyed).toBe(true)
    expect(p.target).toBeUndefined()
    expect(() => p.destroy()).not.toThrow()
  })

  it('rotatePaper swaps width/height + bumps rotate angle', () => {
    const p = new PrintPanel({ width: 100, height: 200 })
    p.rotatePaper()
    expect(p.width).toBe(200)
    expect(p.height).toBe(100)
    expect(p.rotate).toBe(90)
    p.rotatePaper()
    expect(p.rotate).toBe(180)
  })

  it('resize(width, height) updates dims with safeNumber clamp', () => {
    const p = new PrintPanel({ width: 100, height: 100 })
    p.resize(undefined, 200, 300)
    expect(p.width).toBe(200)
    expect(p.height).toBe(300)
  })

  it('resize ignores NaN inputs', () => {
    const p = new PrintPanel({ width: 100, height: 100 })
    p.resize(undefined, 'bad', 'also-bad')
    expect(p.width).toBe(100)
    expect(p.height).toBe(100)
  })
})
