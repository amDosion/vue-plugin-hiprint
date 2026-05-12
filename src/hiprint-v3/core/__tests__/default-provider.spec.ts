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
import type { ElementTypeDef } from '../group'

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
    // Sprint 22a-r TKT-008: default-provider now emits Path B barcode/qrcode
    // (`type:'barcode'`/`'qrcode'`) instead of V1 Path A (`type:'text'+
    // textType:'barcode'`). V3 only ships the bwip-js renderer, so Path A
    // rendered as plain text. See matrix 04-barcode-qrcode VIOLATION-1.
    expect(allTypes.has('text')).toBe(true)
    expect(allTypes.has('image')).toBe(true)
    expect(allTypes.has('longText')).toBe(true)
    expect(allTypes.has('table')).toBe(true)
    expect(allTypes.has('html')).toBe(true)
    expect(allTypes.has('hline')).toBe(true)
    expect(allTypes.has('vline')).toBe(true)
    expect(allTypes.has('rect')).toBe(true)
    expect(allTypes.has('oval')).toBe(true)
    expect(allTypes.has('barcode')).toBe(true)
    expect(allTypes.has('qrcode')).toBe(true)
  })

  it('[TKT-161 + TKT-170] contains all V1 default-etyps-provider tids', () => {
    // Sprint 22d: extended-coverage list — every preset declared in V1
    // src/hiprint/etypes/default-etyps-provider.js lines 24-440 must have a
    // V3 counterpart so JSON templates roundtrip and the element-list panel
    // shows the same item set as V1.
    const allTids = new Set<string>()
    groups.forEach((g) =>
      g.printElementTypes.forEach((et) => allTids.add(et.tid))
    )
    const v1Tids = [
      // 常规 (V1 line 23-170)
      'defaultModule.text',
      'defaultModule.image',
      'defaultModule.longText',
      'defaultModule.table',
      'defaultModule.emptyTable',
      'defaultModule.html',
      'defaultModule.customText',
      'defaultModule.titleRow',
      // 电商 (V1 line 171-298)
      'defaultModule.url',
      'defaultModule.price',
      'defaultModule.sku',
      'defaultModule.senderInfo',
      'defaultModule.receiverInfo',
      'defaultModule.orderNo',
      'defaultModule.orderDate',
      'defaultModule.trackingNo',
      'defaultModule.totalAmount',
      // 辅助 (V1 line 299-359)
      'defaultModule.hline',
      'defaultModule.vline',
      'defaultModule.rect',
      'defaultModule.oval',
      'defaultModule.barcode',
      'defaultModule.qrcode',
      // 实用 (V1 line 360-440)
      'defaultModule.currentDate',
      'defaultModule.signature',
      'defaultModule.signatureImage',
      'defaultModule.seal',
    ]
    v1Tids.forEach((tid) => {
      expect(allTids.has(tid)).toBe(true)
    })
    // V3 should not be missing any V1 tid; allTids ≥ 27 expected.
    expect(allTids.size).toBeGreaterThanOrEqual(v1Tids.length)
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

  // TKT-363 (Sprint 22g GL Wave 3) — V1 Path B shape lock for the three
  // factory presets `trackingNo` / `barcode` / `qrcode`. Sprint 22a-r
  // migrated them from Path A (type:'text' + textType:'barcode') to Path B
  // (type:'barcode'); this test pins the shape so future edits cannot
  // accidentally roll back.
  it('TKT-363: trackingNo / barcode / qrcode presets ship in V3 Path B shape', () => {
    const all: ElementTypeDef[] = []
    groups.forEach((g) => g.printElementTypes.forEach((e) => all.push(e)))

    const trackingNo = all.find((e) => e.tid === 'defaultModule.trackingNo')!
    expect(trackingNo.type).toBe('barcode')
    expect(
      (trackingNo.options as { barcodeType?: string }).barcodeType
    ).toBe('code128')
    // Path A leftovers must NOT appear.
    expect((trackingNo.options as { textType?: string }).textType).toBeUndefined()
    expect(
      (trackingNo.options as { barcodeMode?: string }).barcodeMode
    ).toBeUndefined()

    const barcode = all.find((e) => e.tid === 'defaultModule.barcode')!
    expect(barcode.type).toBe('barcode')
    expect((barcode.options as { barcodeType?: string }).barcodeType).toBe(
      'code128'
    )
    expect((barcode.options as { hideTitle?: boolean }).hideTitle).toBe(true)

    const qrcode = all.find((e) => e.tid === 'defaultModule.qrcode')!
    expect(qrcode.type).toBe('qrcode')
    // qrCodeLevel is int index (0=M) per V3 contract (mapQrCodeLevel).
    expect((qrcode.options as { qrCodeLevel?: number }).qrCodeLevel).toBe(0)
    expect((qrcode.options as { hideTitle?: boolean }).hideTitle).toBe(true)
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
