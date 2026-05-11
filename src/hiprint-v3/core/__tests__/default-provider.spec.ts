/**
 * default-provider.spec.ts — defaultElementTypeProvider invariants.
 *
 * Validates that 11 etype types are present + correctly grouped into the
 * four built-in groups (常规 / 电商 / 辅助 / 实用).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  buildDefaultElementTypeGroups,
  defaultElementTypeProvider,
  registerDefaultElementTypes,
  DEFAULT_MODULE_NAME,
} from '../default-provider'
import {
  PrintElementTypeRegistry,
  _resetInstance,
  getInstance,
} from '../registry'

describe('buildDefaultElementTypeGroups', () => {
  const groups = buildDefaultElementTypeGroups()

  it('returns exactly 4 groups', () => {
    expect(groups).toHaveLength(4)
  })

  it('group names match V1 default-etyps-provider', () => {
    expect(groups.map((g) => g.name)).toEqual(['常规', '电商', '辅助', '实用'])
  })

  it('every group has at least one element type', () => {
    groups.forEach((g) => {
      expect(g.printElementTypes.length).toBeGreaterThan(0)
    })
  })

  it('all tids are prefixed with "defaultModule."', () => {
    groups.forEach((g) => {
      g.printElementTypes.forEach((et) => {
        expect(et.tid).toMatch(/^defaultModule\./)
      })
    })
  })

  it('contains all 11 V1 SUPPORTED_ELEMENT_TYPES (via type field)', () => {
    const allTypes = new Set<string>()
    groups.forEach((g) =>
      g.printElementTypes.forEach((et) => allTypes.add(et.type))
    )
    // Note: V3 default-provider uses textType=barcode/qrcode for default
    // 条形码/二维码 (V1 behavior). Pure barcode/qrcode types still exist as
    // dedicated etypes via createBarcodeElement / createQrcodeElement.
    expect(allTypes.has('text')).toBe(true)
    expect(allTypes.has('image')).toBe(true)
    expect(allTypes.has('longText')).toBe(true)
    expect(allTypes.has('table')).toBe(true)
    expect(allTypes.has('html')).toBe(true)
    expect(allTypes.has('hline')).toBe(true)
    expect(allTypes.has('vline')).toBe(true)
    expect(allTypes.has('rect')).toBe(true)
    expect(allTypes.has('oval')).toBe(true)
  })

  it('"常规" group contains text + image + longText + table + html', () => {
    const general = groups.find((g) => g.name === '常规')
    expect(general).toBeDefined()
    const tids = general!.printElementTypes.map((e) => e.tid)
    expect(tids).toContain('defaultModule.text')
    expect(tids).toContain('defaultModule.image')
    expect(tids).toContain('defaultModule.longText')
    expect(tids).toContain('defaultModule.table')
    expect(tids).toContain('defaultModule.html')
  })

  it('"辅助" group contains 4 shapes + barcode + qrcode', () => {
    const aux = groups.find((g) => g.name === '辅助')!
    const tids = aux.printElementTypes.map((e) => e.tid)
    expect(tids).toContain('defaultModule.hline')
    expect(tids).toContain('defaultModule.vline')
    expect(tids).toContain('defaultModule.rect')
    expect(tids).toContain('defaultModule.oval')
    expect(tids).toContain('defaultModule.barcode')
    expect(tids).toContain('defaultModule.qrcode')
  })

  it('"电商" group contains orderNo / orderDate / trackingNo', () => {
    const ec = groups.find((g) => g.name === '电商')!
    const tids = ec.printElementTypes.map((e) => e.tid)
    expect(tids).toContain('defaultModule.orderNo')
    expect(tids).toContain('defaultModule.orderDate')
    expect(tids).toContain('defaultModule.trackingNo')
  })

  it('"实用" group contains signature + signatureImage + seal + currentDate', () => {
    const u = groups.find((g) => g.name === '实用')!
    const tids = u.printElementTypes.map((e) => e.tid)
    expect(tids).toContain('defaultModule.signature')
    expect(tids).toContain('defaultModule.signatureImage')
    expect(tids).toContain('defaultModule.seal')
    expect(tids).toContain('defaultModule.currentDate')
  })

  it('signature/seal placeholder srcs are data:image/svg+xml', () => {
    const u = groups.find((g) => g.name === '实用')!
    const sig = u.printElementTypes.find(
      (e) => e.tid === 'defaultModule.signatureImage'
    )!
    const seal = u.printElementTypes.find((e) => e.tid === 'defaultModule.seal')!
    expect((sig.options as { src?: string }).src).toMatch(/^data:image\/svg\+xml/)
    expect((seal.options as { src?: string }).src).toMatch(/^data:image\/svg\+xml/)
  })

  it('no duplicate tids across all 4 groups', () => {
    const tids: string[] = []
    groups.forEach((g) => g.printElementTypes.forEach((e) => tids.push(e.tid)))
    expect(new Set(tids).size).toBe(tids.length)
  })
})

describe('defaultElementTypeProvider', () => {
  beforeEach(() => {
    _resetInstance()
  })

  it('returns an object with addElementTypes + groups', () => {
    const provider = defaultElementTypeProvider()
    expect(typeof provider.addElementTypes).toBe('function')
    expect(typeof provider.groups).toBe('function')
    expect(provider.groups()).toHaveLength(4)
  })

  it('addElementTypes registers groups under defaultModule', () => {
    const reg = new PrintElementTypeRegistry()
    defaultElementTypeProvider().addElementTypes(reg)
    expect(reg.getByModule(DEFAULT_MODULE_NAME)).toHaveLength(4)
    expect(reg.getByTid('defaultModule.text')).toBeDefined()
    expect(reg.getByTid('defaultModule.table')).toBeDefined()
  })

  it('addElementTypes is idempotent (clears + re-registers)', () => {
    const reg = new PrintElementTypeRegistry()
    defaultElementTypeProvider().addElementTypes(reg)
    const sizeAfterFirst = reg.allElementTypes.length
    defaultElementTypeProvider().addElementTypes(reg)
    expect(reg.allElementTypes.length).toBe(sizeAfterFirst)
  })

  it('addElementTypes defaults to global singleton when no registry passed', () => {
    defaultElementTypeProvider().addElementTypes()
    expect(getInstance().getByTid('defaultModule.text')).toBeDefined()
  })
})

describe('registerDefaultElementTypes', () => {
  beforeEach(() => {
    _resetInstance()
  })

  it('registers all default groups on a fresh registry', () => {
    const reg = new PrintElementTypeRegistry()
    registerDefaultElementTypes(reg)
    expect(reg.getByModule(DEFAULT_MODULE_NAME)).toHaveLength(4)
  })

  it('registers on global singleton when registry omitted', () => {
    registerDefaultElementTypes()
    expect(getInstance().getByModule(DEFAULT_MODULE_NAME)).toHaveLength(4)
  })
})
