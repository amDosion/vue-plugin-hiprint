/**
 * registry.spec.ts — PrintElementTypeRegistry (V3).
 *
 * Locks R1 PM-007 (dual dedup) + R1 PM-008 (dotted prefix) + R1 fix
 * (moduleName required) + HMR singleton.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  PrintElementTypeRegistry,
  getInstance,
  _resetInstance,
  formatterModule,
} from '../registry'
import type { ElementTypeGroupDef } from '../group'

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
  let reg: PrintElementTypeRegistry
  beforeEach(() => {
    reg = new PrintElementTypeRegistry()
    vi.restoreAllMocks()
  })

  it('starts with empty allElementTypes', () => {
    expect(reg.allElementTypes).toEqual([])
    expect(reg.getModuleNames()).toEqual([])
  })

  it('register registers group + flat cache', () => {
    reg.register('m', [
      {
        name: 'G1',
        printElementTypes: [
          { tid: 'm.a', type: 'text' },
          { tid: 'm.b', type: 'text' },
        ],
      },
    ])
    expect(reg.allElementTypes).toHaveLength(2)
    expect(reg.getByModule('m')).toHaveLength(1)
    expect(reg.getByModule('m')[0]?.printElementTypes).toHaveLength(2)
  })

  it('register throws on empty moduleName', () => {
    expect(() => reg.register('', [])).toThrow(/moduleName is required/)
    expect(() => reg.register(null as unknown as string, [])).toThrow(
      /moduleName is required/
    )
  })

  it('register is a no-op when groups is not array', () => {
    expect(() =>
      reg.register('m', undefined as unknown as ElementTypeGroupDef[])
    ).not.toThrow()
    expect(reg.allElementTypes).toEqual([])
  })

  it('[R1 PM-007] dedup: same-tid second registration replaces + warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    reg.register('m', [
      { name: 'G1', printElementTypes: [{ tid: 'm.a', type: 'text', title: 'v1' }] },
    ])
    reg.register('m', [
      { name: 'G2', printElementTypes: [{ tid: 'm.a', type: 'text', title: 'v2' }] },
    ])
    expect(reg.allElementTypes).toHaveLength(1)
    expect(reg.allElementTypes[0]?.title).toBe('v2')
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('tid m.a already registered in module m')
    )
  })

  it('[R1 PM-007] dedup: partial overlap keeps non-overlap tids in old group', () => {
    reg.register('m', [
      {
        name: 'OldGroup',
        printElementTypes: [
          { tid: 'm.a', type: 'text', title: 'old-a' },
          { tid: 'm.b', type: 'text', title: 'old-b' },
        ],
      },
    ])
    reg.register('m', [
      {
        name: 'NewGroup',
        printElementTypes: [{ tid: 'm.a', type: 'text', title: 'new-a' }],
      },
    ])
    expect(reg.allElementTypes).toHaveLength(2)
    expect(reg.allElementTypes.find((e) => e.tid === 'm.a')?.title).toBe('new-a')
    expect(reg.allElementTypes.find((e) => e.tid === 'm.b')?.title).toBe('old-b')
  })

  it('[R1 PM-007] dedup: entire old group dropped when fully replaced', () => {
    reg.register('m', [
      {
        name: 'Old',
        printElementTypes: [{ tid: 'm.a', type: 'text' }],
      },
    ])
    reg.register('m', [
      { name: 'New', printElementTypes: [{ tid: 'm.a', type: 'text', title: 'v2' }] },
    ])
    const groups = reg.getByModule('m')
    expect(groups).toHaveLength(1)
    expect(groups[0]?.name).toBe('New')
  })

  it('[R1 PM-008] unregister dotted prefix: "order" deletes order + order.* but NOT order_v2.*', () => {
    reg.register('order', [
      {
        name: 'O',
        printElementTypes: [
          { tid: 'order.item', type: 'text', title: 'item1' },
          { tid: 'order', type: 'text', title: 'top' },
        ],
      },
    ])
    reg.register('order_v2', [
      {
        name: 'OV2',
        printElementTypes: [{ tid: 'order_v2.item', type: 'text', title: 'v2-item' }],
      },
    ])
    reg.unregister('order')
    expect(reg.getByTid('order')).toBeUndefined()
    expect(reg.getByTid('order.item')).toBeUndefined()
    expect(reg.getByTid('order_v2.item')).toBeDefined()
    expect(reg.getByModule('order')).toEqual([])
    expect(reg.getByModule('order_v2')).toHaveLength(1)
  })

  it('unregister empty moduleName → warn + no-op', () => {
    reg.register('m', [
      { name: 'G', printElementTypes: [{ tid: 'm.a', type: 'text' }] },
    ])
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    reg.unregister('')
    reg.unregister(null as unknown as string)
    reg.unregister(undefined as unknown as string)
    expect(reg.allElementTypes).toHaveLength(1)
    expect(warn).toHaveBeenCalledTimes(3)
  })

  it('unregister with tids[] removes only listed tids', () => {
    reg.register('m', [
      {
        name: 'G',
        printElementTypes: [
          { tid: 'm.a', type: 'text' },
          { tid: 'm.b', type: 'text' },
          { tid: 'm.c', type: 'text' },
        ],
      },
    ])
    reg.unregister('m', ['m.a', 'm.c'])
    expect(reg.getByTid('m.a')).toBeUndefined()
    expect(reg.getByTid('m.b')).toBeDefined()
    expect(reg.getByTid('m.c')).toBeUndefined()
  })

  it('unregister with all tids → bucket cleared', () => {
    reg.register('m', [
      {
        name: 'G',
        printElementTypes: [{ tid: 'm.a', type: 'text' }],
      },
    ])
    reg.unregister('m', ['m.a'])
    expect(reg.getModuleNames()).toEqual([])
  })

  it('setDynamic throws on empty moduleName (R1 fix)', () => {
    expect(() => reg.setDynamic('', [])).toThrow(/moduleName is required/)
    expect(() => reg.setDynamic(undefined as unknown as string, [])).toThrow(
      /moduleName is required/
    )
  })

  it('setDynamic replaces module entirely', () => {
    reg.register('m', [
      { name: 'Old', printElementTypes: [{ tid: 'm.a', type: 'text' }] },
    ])
    reg.setDynamic('m', [
      { name: 'New', printElementTypes: [{ tid: 'm.x', type: 'text' }] },
    ])
    expect(reg.getByTid('m.a')).toBeUndefined()
    expect(reg.getByTid('m.x')).toBeDefined()
    expect(reg.getByModule('m')[0]?.name).toBe('New')
  })

  it('getByModule with null / "" → falls back to _default bucket', () => {
    reg.register('_default', [
      { name: 'D', printElementTypes: [{ tid: '_default.x', type: 'text' }] },
    ])
    expect(reg.getByModule(null)).toHaveLength(1)
    expect(reg.getByModule('')).toHaveLength(1)
    expect(reg.getByModule()).toHaveLength(1)
  })

  it('getByModule unknown module → []', () => {
    expect(reg.getByModule('nope')).toEqual([])
  })

  it('getByTid finds by exact tid', () => {
    reg.register('m', [
      {
        name: 'G',
        printElementTypes: [{ tid: 'm.target', type: 'text', title: 'found' }],
      },
    ])
    expect(reg.getByTid('m.target')?.title).toBe('found')
    expect(reg.getByTid('m.missing')).toBeUndefined()
    expect(reg.getByTid('')).toBeUndefined()
  })

  it('getAll returns a copy (mutation does not leak)', () => {
    reg.register('m', [
      { name: 'G', printElementTypes: [{ tid: 'm.a', type: 'text' }] },
    ])
    const copy = reg.getAll().slice() as Array<{ tid: string; type: string }>
    copy.push({ tid: 'rogue', type: 'text' })
    expect(reg.allElementTypes).toHaveLength(1)
  })

  it('update transforms type + syncs bucket (V3 fix vs V2 TODO)', () => {
    reg.register('m', [
      { name: 'G', printElementTypes: [{ tid: 'm.x', type: 'text', title: 'v1' }] },
    ])
    const out = reg.update('m.x', (prev) => ({ ...(prev ?? { tid: 'm.x', type: 'text' }), title: 'v2' }))
    expect(out?.title).toBe('v2')
    expect(reg.getByTid('m.x')?.title).toBe('v2')
    expect(reg.getByModule('m')[0]?.printElementTypes[0]?.title).toBe('v2')
  })

  it('clear resets state', () => {
    reg.register('m', [
      { name: 'G', printElementTypes: [{ tid: 'm.a', type: 'text' }] },
    ])
    reg.clear()
    expect(reg.allElementTypes).toEqual([])
    expect(reg.getModuleNames()).toEqual([])
  })
})

describe('getInstance singleton (HMR-safe)', () => {
  beforeEach(() => {
    _resetInstance()
  })

  it('returns same instance across calls', () => {
    expect(getInstance()).toBe(getInstance())
  })

  it('persists across logical module reloads (globalThis cached)', () => {
    const a = getInstance()
    a.register('m', [
      { name: 'G', printElementTypes: [{ tid: 'm.x', type: 'text' }] },
    ])
    const b = getInstance()
    expect(b.getByTid('m.x')).toBeDefined()
  })

  it('_resetInstance clears (test-only)', () => {
    const a = getInstance()
    a.register('m', [
      { name: 'G', printElementTypes: [{ tid: 'm.x', type: 'text' }] },
    ])
    _resetInstance()
    expect(getInstance().allElementTypes).toEqual([])
  })

  it('stores on globalThis under __hiprintV3RegistrySingleton', () => {
    const instance = getInstance()
    const cached = (
      globalThis as unknown as Record<string, unknown>
    )['__hiprintV3RegistrySingleton']
    expect(cached).toBe(instance)
  })
})
