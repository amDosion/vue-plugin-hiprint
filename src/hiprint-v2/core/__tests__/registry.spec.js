/**
 * registry.spec.js — PrintElementTypeRegistry data layer.
 * Locks R1 PM-007 (dedup) + R1 PM-008 (dotted prefix).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  PrintElementTypeRegistry,
  getInstance,
  _resetInstance,
  formatterModule,
} from '../registry.js'

describe('formatterModule', () => {
  it('null / undefined / "" → "_default"', () => {
    expect(formatterModule()).toBe('_default')
    expect(formatterModule(null)).toBe('_default')
    expect(formatterModule('')).toBe('_default')
  })

  it('preserves named module', () => {
    expect(formatterModule('order')).toBe('order')
  })
})

describe('PrintElementTypeRegistry', () => {
  let reg
  beforeEach(() => {
    reg = new PrintElementTypeRegistry()
    vi.restoreAllMocks()
  })

  it('starts with empty allElementTypes', () => {
    expect(reg.allElementTypes).toEqual([])
  })

  it('addPrintElementTypes registers group + flat cache', () => {
    reg.addPrintElementTypes('m', [
      { name: 'G1', printElementTypes: [{ tid: 'm.a', type: 'text' }, { tid: 'm.b', type: 'text' }] },
    ])
    expect(reg.allElementTypes).toHaveLength(2)
    expect(reg.m).toHaveLength(1)
    expect(reg.m[0].printElementTypes).toHaveLength(2)
  })

  it('[R1 PM-007] dedup: same-tid second registration replaces + warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    reg.addPrintElementTypes('m', [
      { name: 'G1', printElementTypes: [{ tid: 'm.a', title: 'v1' }] },
    ])
    reg.addPrintElementTypes('m', [
      { name: 'G2', printElementTypes: [{ tid: 'm.a', title: 'v2' }] },
    ])
    expect(reg.allElementTypes).toHaveLength(1)
    expect(reg.allElementTypes[0].title).toBe('v2') // newer wins
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('tid already registered, replacing: m.a')
    )
  })

  it('[R1 PM-007] dedup: partial overlap keeps non-overlap tids in old group', () => {
    reg.addPrintElementTypes('m', [
      {
        name: 'OldGroup',
        printElementTypes: [
          { tid: 'm.a', title: 'old-a' },
          { tid: 'm.b', title: 'old-b' },
        ],
      },
    ])
    reg.addPrintElementTypes('m', [
      { name: 'NewGroup', printElementTypes: [{ tid: 'm.a', title: 'new-a' }] },
    ])
    // m.a replaced, m.b kept in old group
    expect(reg.allElementTypes).toHaveLength(2)
    expect(reg.allElementTypes.find((e) => e.tid === 'm.a').title).toBe('new-a')
    expect(reg.allElementTypes.find((e) => e.tid === 'm.b').title).toBe('old-b')
  })

  it('[R1 PM-008] removePrintElementTypes dotted prefix: "order" deletes order.* but NOT order_v2.*', () => {
    reg.addPrintElementTypes('order', [
      { name: 'O', printElementTypes: [{ tid: 'order.item', title: 'item1' }, { tid: 'order', title: 'top' }] },
    ])
    reg.addPrintElementTypes('order_v2', [
      { name: 'OV2', printElementTypes: [{ tid: 'order_v2.item', title: 'v2-item' }] },
    ])
    reg.removePrintElementTypes('order')
    // order + order.* gone, order_v2.* intact
    expect(reg.allElementTypes.find((e) => e.tid === 'order')).toBeUndefined()
    expect(reg.allElementTypes.find((e) => e.tid === 'order.item')).toBeUndefined()
    expect(reg.allElementTypes.find((e) => e.tid === 'order_v2.item')).toBeDefined()
    expect(reg.order).toBeUndefined()
    expect(reg.order_v2).toBeDefined()
  })

  it('removePrintElementTypes empty moduleName → warn + no-op', () => {
    reg.addPrintElementTypes('m', [{ name: 'G', printElementTypes: [{ tid: 'm.a' }] }])
    // 在 add 之后再 spy, 避免计入 add 期间的 warn
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    reg.removePrintElementTypes('')
    reg.removePrintElementTypes(null)
    reg.removePrintElementTypes(undefined)
    expect(reg.allElementTypes).toHaveLength(1)
    expect(warn).toHaveBeenCalledTimes(3)
  })

  it('getElementTypeGroups returns bucket', () => {
    reg.addPrintElementTypes('m', [{ name: 'G', printElementTypes: [{ tid: 'm.x' }] }])
    expect(reg.getElementTypeGroups('m')).toHaveLength(1)
    expect(reg.getElementTypeGroups('m')[0].name).toBe('G')
  })

  it('getElementTypeGroups for unknown module → []', () => {
    expect(reg.getElementTypeGroups('nope')).toEqual([])
  })

  it('getElementType by exact tid', () => {
    reg.addPrintElementTypes('m', [
      { name: 'G', printElementTypes: [{ tid: 'm.target', title: 'found' }] },
    ])
    expect(reg.getElementType('m.target').title).toBe('found')
    expect(reg.getElementType('m.missing')).toBeUndefined()
  })

  it('updateElementType replaces flat cache entry', () => {
    reg.addPrintElementTypes('m', [
      { name: 'G', printElementTypes: [{ tid: 'm.x', v: 1 }] },
    ])
    const ret = reg.updateElementType('m.x', (old) => ({ ...old, v: 2 }))
    expect(ret.v).toBe(2)
    expect(reg.getElementType('m.x').v).toBe(2)
  })
})

describe('getInstance singleton', () => {
  beforeEach(() => {
    _resetInstance()
  })

  it('returns the same instance across calls', () => {
    const a = getInstance()
    const b = getInstance()
    expect(a).toBe(b)
  })

  it('persists across logical module reloads (globalThis cached)', () => {
    const a = getInstance()
    a.addPrintElementTypes('m', [{ name: 'G', printElementTypes: [{ tid: 'm.x' }] }])
    // simulate HMR — module reload would call getInstance again
    const b = getInstance()
    expect(b.getElementType('m.x')).toBeDefined()
  })

  it('_resetInstance clears (test-only)', () => {
    const a = getInstance()
    a.addPrintElementTypes('m', [{ name: 'G', printElementTypes: [{ tid: 'm.x' }] }])
    _resetInstance()
    const b = getInstance()
    expect(b.allElementTypes).toEqual([])
  })
})
