/**
 * element-base.spec.ts — BaseElement contract.
 *
 * Locks:
 *  - id is crypto.randomUUID() format
 *  - clone() returns structurally independent copy with fresh id
 *  - update(patch) mutates reactive record + returns same BaseElement (in-place)
 *  - getJson() returns deep non-reactive snapshot
 *  - throws on missing tid / printElementType.type
 */

import { describe, it, expect } from 'vitest'
import { isReactive } from 'vue'
import { createBaseElement, fromRecord } from '../element-base'

describe('createBaseElement', () => {
  it('throws when tid missing', () => {
    expect(() =>
      createBaseElement({
        tid: '',
        printElementType: { type: 'text' },
      })
    ).toThrow(/tid is required/)
  })

  it('throws when printElementType.type missing', () => {
    expect(() =>
      createBaseElement({
        tid: 'm.x',
        printElementType: { type: '' as unknown as string },
      })
    ).toThrow(/printElementType.type is required/)
  })

  it('id is a UUID v4 string (when crypto.randomUUID available)', () => {
    const el = createBaseElement({
      tid: 'm.x',
      printElementType: { type: 'text' },
    })
    // crypto.randomUUID is available in node 19+ which the test env uses.
    expect(el.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
  })

  it('honors explicit id when supplied', () => {
    const el = createBaseElement({
      tid: 'm.x',
      printElementType: { type: 'text' },
      id: 'fixed-id',
    })
    expect(el.id).toBe('fixed-id')
  })

  it('record is reactive', () => {
    const el = createBaseElement({
      tid: 'm.x',
      printElementType: { type: 'text' },
    })
    expect(isReactive(el.record)).toBe(true)
  })

  it('forwards id / tid / type getters', () => {
    const el = createBaseElement({
      tid: 'm.t',
      printElementType: { type: 'text', title: 'T' },
    })
    expect(el.tid).toBe('m.t')
    expect(el.type).toBe('text')
    expect(el.id).toBe(el.record.id)
  })

  it('options are merged from init', () => {
    const el = createBaseElement({
      tid: 'm.x',
      printElementType: { type: 'text' },
      options: { width: 50, height: 10 },
    })
    expect(el.record.options.width).toBe(50)
    expect(el.record.options.height).toBe(10)
  })

  it('templateId is preserved when supplied', () => {
    const el = createBaseElement({
      tid: 'm.x',
      printElementType: { type: 'text' },
      templateId: 'tpl-1',
    })
    expect(el.record.templateId).toBe('tpl-1')
  })
})

describe('BaseElement.getJson', () => {
  it('returns a deep, non-reactive snapshot', () => {
    const el = createBaseElement({
      tid: 'm.x',
      printElementType: { type: 'text', title: 'T' },
      options: { width: 50, nested: { a: 1 } },
    })
    const json = el.getJson()
    expect(isReactive(json)).toBe(false)
    expect(json.options.width).toBe(50)
    expect((json.options.nested as { a: number }).a).toBe(1)
  })

  it('snapshot is independent — mutating json does not affect record', () => {
    const el = createBaseElement({
      tid: 'm.x',
      printElementType: { type: 'text' },
      options: { width: 100 },
    })
    const json = el.getJson()
    json.options.width = 999
    expect(el.record.options.width).toBe(100)
  })
})

describe('BaseElement.clone', () => {
  it('returns a structurally independent BaseElement with a fresh id', () => {
    const original = createBaseElement({
      tid: 'm.x',
      printElementType: { type: 'text', title: 'T' },
      options: { width: 50, nested: { a: 1 } },
    })
    const cloned = original.clone()
    expect(cloned.id).not.toBe(original.id)
    expect(cloned.tid).toBe(original.tid)
    expect(cloned.type).toBe(original.type)
    expect(cloned.record.options.width).toBe(50)
  })

  it('mutating clone does NOT affect original', () => {
    const original = createBaseElement({
      tid: 'm.x',
      printElementType: { type: 'text' },
      options: { width: 100, nested: { a: 1 } },
    })
    const cloned = original.clone()
    cloned.update({ options: { width: 999 } })
    ;(cloned.record.options.nested as { a: number }).a = 42
    expect(original.record.options.width).toBe(100)
    expect((original.record.options.nested as { a: number }).a).toBe(1)
  })

  it('preserves printElementType title in clone', () => {
    const original = createBaseElement({
      tid: 'm.x',
      printElementType: { type: 'text', title: 'My Title', field: 'name' },
    })
    const cloned = original.clone()
    expect(cloned.record.printElementType.title).toBe('My Title')
    expect(cloned.record.printElementType.field).toBe('name')
  })
})

describe('BaseElement.update', () => {
  it('applies options patch (merged, not replaced)', () => {
    const el = createBaseElement({
      tid: 'm.x',
      printElementType: { type: 'text' },
      options: { width: 100, height: 50 },
    })
    el.update({ options: { width: 200 } })
    expect(el.record.options.width).toBe(200)
    expect(el.record.options.height).toBe(50) // not lost
  })

  it('applies printElementType patch', () => {
    const el = createBaseElement({
      tid: 'm.x',
      printElementType: { type: 'text', title: 'A' },
    })
    el.update({ printElementType: { type: 'text', title: 'B' } })
    expect(el.record.printElementType.title).toBe('B')
  })

  it('changes tid when supplied', () => {
    const el = createBaseElement({
      tid: 'm.x',
      printElementType: { type: 'text' },
    })
    el.update({ tid: 'm.y' })
    expect(el.record.tid).toBe('m.y')
    expect(el.tid).toBe('m.y')
  })

  it('changes templateId when supplied', () => {
    const el = createBaseElement({
      tid: 'm.x',
      printElementType: { type: 'text' },
    })
    el.update({ templateId: 'tpl-x' })
    expect(el.record.templateId).toBe('tpl-x')
  })

  it('id is immutable — patch.id is ignored', () => {
    const el = createBaseElement({
      tid: 'm.x',
      printElementType: { type: 'text' },
      id: 'fixed',
    })
    el.update({ id: 'should-not-apply' } as { id?: string })
    expect(el.id).toBe('fixed')
  })

  it('returns the same BaseElement instance (in-place reactive patch)', () => {
    const el = createBaseElement({
      tid: 'm.x',
      printElementType: { type: 'text' },
    })
    const ret = el.update({ options: { width: 5 } })
    expect(ret).toBe(el)
  })
})

describe('fromRecord', () => {
  it('rehydrates BaseElement from existing record', () => {
    const el = fromRecord({
      id: 'rec-1',
      tid: 'm.x',
      options: { width: 30 },
      printElementType: { type: 'text', title: 'Rec' },
    })
    expect(el.id).toBe('rec-1')
    expect(el.tid).toBe('m.x')
    expect(el.type).toBe('text')
  })

  it('throws on missing id', () => {
    expect(() =>
      fromRecord({
        id: '',
        tid: 'm.x',
        options: {},
        printElementType: { type: 'text' },
      })
    ).toThrow(/id and tid are required/)
  })

  it('throws on missing tid', () => {
    expect(() =>
      fromRecord({
        id: 'rec',
        tid: '',
        options: {},
        printElementType: { type: 'text' },
      })
    ).toThrow(/id and tid are required/)
  })
})
