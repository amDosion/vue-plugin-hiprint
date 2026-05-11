/**
 * print-element-entity.spec.js — BasePrintElement core API.
 * Locks PM-002 R3 (resolveField via getData) + PM-013 R3 (numeric coerce).
 */
import { describe, it, expect, vi } from 'vitest'
import { BasePrintElement } from '../print-element-entity.js'

function makeType(overrides = {}) {
  return { tid: 'mod.test', title: 'Test', type: 'text', ...overrides }
}

describe('BasePrintElement constructor', () => {
  it('throws when printElementType missing', () => {
    expect(() => new BasePrintElement(null)).toThrow(/printElementType is required/)
  })

  it('assigns printElementType + options + id', () => {
    const t = makeType()
    const el = new BasePrintElement(t, { left: 0, top: 0 })
    expect(el.printElementType).toBe(t)
    expect(el.options.left).toBe(0)
    expect(typeof el.id).toBe('string')
    expect(el.id.length).toBeGreaterThan(0)
  })

  it('generates unique ids across instances (PM-005 R3 invariant)', () => {
    const a = new BasePrintElement(makeType())
    const b = new BasePrintElement(makeType())
    expect(a.id).not.toBe(b.id)
  })
})

describe('BasePrintElement getters/setters', () => {
  it('setTemplateId / setPanel + setters', () => {
    const el = new BasePrintElement(makeType())
    el.setTemplateId('tpl-1')
    el.setPanel({ width: 210, height: 297 })
    expect(el.templateId).toBe('tpl-1')
    expect(el.panel.width).toBe(210)
  })

  it('getField: options > printElementType fallback', () => {
    const el = new BasePrintElement(makeType({ field: 'typeField' }), { field: 'optField' })
    expect(el.getField()).toBe('optField')
    const el2 = new BasePrintElement(makeType({ field: 'typeField' }))
    expect(el2.getField()).toBe('typeField')
  })

  it('getTitle returns printElementType.title', () => {
    const el = new BasePrintElement(makeType({ title: 'My Title' }))
    expect(el.getTitle()).toBe('My Title')
  })
})

describe('BasePrintElement.getData (PM-002 R3)', () => {
  it('resolves nested field from templateData', () => {
    const el = new BasePrintElement(makeType(), { field: 'user.name' })
    expect(el.getData({ user: { name: 'Alice' } })).toBe('Alice')
  })

  it('[PM-002 R3] preserves 0 / false / "" leaf values', () => {
    const el = new BasePrintElement(makeType(), { field: 'a.b' })
    expect(el.getData({ a: { b: 0 } })).toBe(0)
    expect(el.getData({ a: { b: false } })).toBe(false)
    expect(el.getData({ a: { b: '' } })).toBe('')
  })

  it('null intermediate → empty string fallback', () => {
    const el = new BasePrintElement(makeType(), { field: 'a.b' })
    expect(el.getData({ a: null })).toBe('')
  })

  it('no templateData → testData fallback', () => {
    const el = new BasePrintElement(makeType(), { testData: 'sample' })
    expect(el.getData()).toBe('sample')
  })

  it('no templateData + no testData → printElementType.getData()', () => {
    const type = makeType()
    type.getData = () => 'type-data'
    const el = new BasePrintElement(type)
    expect(el.getData()).toBe('type-data')
  })

  it('no field + no fallback → empty string', () => {
    const el = new BasePrintElement(makeType())
    expect(el.getData({})).toBe('')
  })
})

describe('BasePrintElement.updateSizeAndPositionOptions (PM-013 R3)', () => {
  function makeWithOpts() {
    const opts = {}
    const calls = { setLeft: [], setTop: [], setWidth: [], setHeight: [], cdtft: 0 }
    opts.setLeft = (v) => calls.setLeft.push(v)
    opts.setTop = (v) => calls.setTop.push(v)
    opts.setWidth = (v) => calls.setWidth.push(v)
    opts.setHeight = (v) => calls.setHeight.push(v)
    opts.copyDesignTopFromTop = () => calls.cdtft++
    const el = new BasePrintElement(makeType(), opts)
    return { el, calls }
  }

  it('numeric inputs invoke setters in order', () => {
    const { el, calls } = makeWithOpts()
    el.updateSizeAndPositionOptions(10, 20, 100, 50)
    expect(calls.setLeft).toEqual([10])
    expect(calls.setTop).toEqual([20])
    expect(calls.setWidth).toEqual([100])
    expect(calls.setHeight).toEqual([50])
    expect(calls.cdtft).toBe(1)
  })

  it('[PM-013 R3] rejects NaN inputs silently (no setter call)', () => {
    const { el, calls } = makeWithOpts()
    el.updateSizeAndPositionOptions('not-a-number', 20, 100, 50)
    expect(calls.setLeft).toEqual([])
    expect(calls.setWidth).toEqual([])
  })

  it('[PM-013 R3] rejects string with XSS payload prefix (parseFloat eats it)', () => {
    const { el, calls } = makeWithOpts()
    el.updateSizeAndPositionOptions('10pt"><script>', 20, 100, 50)
    expect(calls.setLeft).toEqual([10]) // parseFloat clamps to leading numeric
  })

  it('panel-aware bounds rejection (out of width)', () => {
    const { el, calls } = makeWithOpts()
    el.setPanel({ width: 100, height: 100 }) // mm
    // panel width 100mm ≈ 283.46pt; element width 50pt + left 250pt = 300pt > 283pt
    el.updateSizeAndPositionOptions(250, 10, 50, 50)
    expect(calls.setLeft).toEqual([]) // refused
  })
})

describe('BasePrintElement.showInPage', () => {
  function makeEl(showInPage, unShowInPage) {
    return new BasePrintElement(makeType(), { showInPage, unShowInPage })
  }

  it('"first" only on page 0', () => {
    expect(makeEl('first').showInPage(0, 3)).toBe(true)
    expect(makeEl('first').showInPage(1, 3)).toBe(false)
  })

  it('"last" only on last page', () => {
    expect(makeEl('last').showInPage(2, 3)).toBe(true)
    expect(makeEl('last').showInPage(1, 3)).toBe(false)
  })

  it('"odd" / "even" pages', () => {
    expect(makeEl('odd').showInPage(0, 4)).toBe(true) // index 0 = page 1 = odd
    expect(makeEl('odd').showInPage(1, 4)).toBe(false)
    expect(makeEl('even').showInPage(1, 4)).toBe(true)
    expect(makeEl('even').showInPage(2, 4)).toBe(false)
  })

  it('no showInPage opt → show on all', () => {
    expect(makeEl().showInPage(0, 3)).toBe(true)
    expect(makeEl().showInPage(1, 3)).toBe(true)
    expect(makeEl().showInPage(2, 3)).toBe(true)
  })

  it('unShowInPage="first" → hide on first page', () => {
    expect(makeEl(undefined, 'first').showInPage(0, 3)).toBe(false)
    expect(makeEl(undefined, 'first').showInPage(1, 3)).toBe(true)
  })

  it('unShowInPage="last" → hide on last page', () => {
    expect(makeEl(undefined, 'last').showInPage(2, 3)).toBe(false)
    expect(makeEl(undefined, 'last').showInPage(1, 3)).toBe(true)
  })
})

describe('BasePrintElement abstract methods', () => {
  it('createTarget throws helpful error', () => {
    const el = new BasePrintElement(makeType({ type: 'unknown' }))
    expect(() => el.createTarget('t', null)).toThrow(/createTarget must be overridden/)
  })

  it('getHtml throws helpful error', () => {
    const el = new BasePrintElement(makeType({ type: 'unknown' }))
    expect(() => el.getHtml(null)).toThrow(/getHtml must be overridden/)
  })

  it('updateDesignViewFromOptions default no-op', () => {
    const el = new BasePrintElement(makeType())
    expect(() => el.updateDesignViewFromOptions()).not.toThrow()
  })

  it('getConfigOptions default {}', () => {
    const el = new BasePrintElement(makeType())
    expect(el.getConfigOptions()).toEqual({})
  })
})

describe('BasePrintElement.destroy', () => {
  it('clears refs + idempotent', () => {
    const el = new BasePrintElement(makeType())
    el.templateId = 't'
    el.panel = { x: 1 }
    el.designTarget = undefined
    el.destroy()
    expect(el.designTarget).toBeUndefined()
    expect(el.panel).toBeUndefined()
    // idempotent
    expect(() => el.destroy()).not.toThrow()
  })

  it('getPrintElementSelectEventKey uses templateId', () => {
    const el = new BasePrintElement(makeType())
    el.setTemplateId('tpl-7')
    expect(el.getPrintElementSelectEventKey()).toBe('PrintElementSelectEventKey_tpl-7')
  })
})
