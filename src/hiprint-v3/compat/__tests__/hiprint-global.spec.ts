/**
 * hiprint-global.spec.ts — V3 hiprint facade tests (P19).
 *
 * Verifies init shapes, setDynamicFields / removeDynamicFields invariants
 * (#7 empty moduleName throw, #8 dotted-prefix removal), autoConnect /
 * disAutoConnect, and hiwebSocket getter.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { hiprint } from '../hiprint-global'
import {
  getInstance as getRegistryInstance,
  _resetInstance,
} from '@hiprint-v3/core'
import { getHiWebSocket, _resetHiWebSocketSingleton } from '@hiprint-v3/print'

beforeEach(() => {
  _resetInstance()
  _resetHiWebSocketSingleton()
})

describe('hiprint.init', () => {
  it('with undefined → registers defaults', () => {
    const result = hiprint.init()
    expect(result.moduleNames).toContain('defaultModule')
  })

  it('with empty providers array → registers defaults', () => {
    const result = hiprint.init({ providers: [] })
    expect(result.moduleNames).toContain('defaultModule')
  })

  it('with V1-shape provider instance → calls addElementTypes shim', () => {
    const provider = {
      addElementTypes: vi.fn((h: { register: (m: string, g: unknown[]) => void }) => {
        h.register('customModule', [
          {
            groupName: 'Custom',
            printElementTypes: [{ tid: 'customModule.foo', title: 'Foo', type: 'text' }],
          },
        ])
      }),
    }
    hiprint.init({ providers: [provider] })
    expect(provider.addElementTypes).toHaveBeenCalledTimes(1)
    const registry = getRegistryInstance()
    expect(registry.getModuleNames()).toContain('customModule')
  })

  it('with factory function → invokes factory + registers groups', () => {
    const factory = vi.fn(() => {
      const groups = [
        {
          groupName: 'Factory',
          printElementTypes: [{ tid: 'factoryModule.bar', title: 'Bar', type: 'text' }],
        },
      ] as const
      return {
        addElementTypes: vi.fn((reg: ReturnType<typeof getRegistryInstance>) => {
          reg.register('factoryModule', groups as never)
        }),
        groups: () => groups as never,
      }
    })
    hiprint.init(factory)
    expect(factory).toHaveBeenCalledTimes(1)
    expect(getRegistryInstance().getModuleNames()).toContain('factoryModule')
  })

  it('exposes PrintTemplate class', () => {
    expect(typeof hiprint.PrintTemplate).toBe('function')
  })

  it('exposes version string', () => {
    expect(typeof hiprint.version).toBe('string')
  })
})

describe('hiprint.setDynamicFields — Invariant #7', () => {
  it('throws when moduleName is empty string', () => {
    expect(() => hiprint.setDynamicFields('', [])).toThrow(/moduleName is required/)
  })

  it('throws when moduleName is null-like', () => {
    expect(() => hiprint.setDynamicFields(undefined as unknown as string, [])).toThrow(
      /moduleName is required/
    )
  })

  it('throws when fields is null', () => {
    expect(() => hiprint.setDynamicFields('mod', null as unknown as never)).toThrow(
      /fields is required/
    )
  })

  it('throws when fields is undefined', () => {
    expect(() => hiprint.setDynamicFields('mod', undefined as unknown as never)).toThrow(
      /fields is required/
    )
  })

  it('accepts empty array (clears module)', () => {
    expect(() => hiprint.setDynamicFields('mod', [])).not.toThrow()
  })

  it('registers groups under module', () => {
    hiprint.setDynamicFields('dyn', [
      {
        groupName: 'D',
        printElementTypes: [{ tid: 'dyn.foo', title: 'Foo', type: 'text' }],
      },
    ])
    const reg = getRegistryInstance()
    expect(reg.getByTid('dyn.foo')?.title).toBe('Foo')
  })
})

describe('hiprint.removeDynamicFields — Invariant #8', () => {
  it('removes whole module', () => {
    hiprint.setDynamicFields('order', [
      {
        groupName: 'O',
        printElementTypes: [{ tid: 'order.item', title: 'Item', type: 'text' }],
      },
    ])
    expect(getRegistryInstance().getByTid('order.item')).toBeDefined()
    hiprint.removeDynamicFields('order')
    expect(getRegistryInstance().getByTid('order.item')).toBeUndefined()
  })

  it('dotted-prefix: removing "order" does NOT remove "order_v2.item"', () => {
    hiprint.setDynamicFields('order', [
      {
        groupName: 'O1',
        printElementTypes: [{ tid: 'order.item', title: 'A', type: 'text' }],
      },
    ])
    hiprint.setDynamicFields('order_v2', [
      {
        groupName: 'O2',
        printElementTypes: [{ tid: 'order_v2.item', title: 'B', type: 'text' }],
      },
    ])
    hiprint.removeDynamicFields('order')
    expect(getRegistryInstance().getByTid('order.item')).toBeUndefined()
    expect(getRegistryInstance().getByTid('order_v2.item')).toBeDefined()
  })

  it('with tids array removes only specified tids', () => {
    hiprint.setDynamicFields('mod', [
      {
        groupName: 'G',
        printElementTypes: [
          { tid: 'mod.a', title: 'A', type: 'text' },
          { tid: 'mod.b', title: 'B', type: 'text' },
        ],
      },
    ])
    hiprint.removeDynamicFields('mod', ['mod.a'])
    expect(getRegistryInstance().getByTid('mod.a')).toBeUndefined()
    expect(getRegistryInstance().getByTid('mod.b')).toBeDefined()
  })

  it('empty moduleName → warn + no-op', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    hiprint.removeDynamicFields('')
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('removeDynamicFields called without moduleName')
    )
    warn.mockRestore()
  })
})

describe('hiprint.appendElementTypeGroups', () => {
  it('additive — does not unregister existing tids in same module', () => {
    hiprint.setDynamicFields('mod', [
      {
        groupName: 'G',
        printElementTypes: [{ tid: 'mod.a', title: 'A', type: 'text' }],
      },
    ])
    hiprint.appendElementTypeGroups('mod', [
      {
        groupName: 'G2',
        printElementTypes: [{ tid: 'mod.b', title: 'B', type: 'text' }],
      },
    ])
    const reg = getRegistryInstance()
    expect(reg.getByTid('mod.a')).toBeDefined()
    expect(reg.getByTid('mod.b')).toBeDefined()
  })

  it('throws on empty moduleName', () => {
    expect(() => hiprint.appendElementTypeGroups('', [])).toThrow(/moduleName is required/)
  })
})

describe('hiprint.renameElementType', () => {
  it('updates title of existing tid', () => {
    hiprint.setDynamicFields('mod', [
      {
        groupName: 'G',
        printElementTypes: [{ tid: 'mod.a', title: 'Original', type: 'text' }],
      },
    ])
    hiprint.renameElementType('mod.a', 'Renamed')
    expect(getRegistryInstance().getByTid('mod.a')?.title).toBe('Renamed')
  })

  it('warns on empty tid', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    hiprint.renameElementType('', 'X')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('renameElementType: tid is required'))
    warn.mockRestore()
  })
})

describe('hiprint.autoConnect / disAutoConnect / hiwebSocket', () => {
  it('hiwebSocket getter returns singleton', () => {
    const ws1 = hiprint.hiwebSocket
    const ws2 = getHiWebSocket()
    expect(ws1).toBe(ws2)
  })

  it('disAutoConnect calls socket.stop', () => {
    const ws = getHiWebSocket()
    const stop = vi.spyOn(ws, 'stop')
    hiprint.disAutoConnect()
    expect(stop).toHaveBeenCalled()
    stop.mockRestore()
  })

  it('autoConnect with host calls setHost', () => {
    const ws = getHiWebSocket()
    const setHost = vi.spyOn(ws, 'setHost').mockImplementation(() => {})
    hiprint.autoConnect('http://localhost:12345', 'token')
    expect(setHost).toHaveBeenCalledWith(
      'http://localhost:12345',
      'token',
      undefined
    )
    setHost.mockRestore()
  })

  it('autoConnect without host calls start', () => {
    const ws = getHiWebSocket()
    const start = vi.spyOn(ws, 'start').mockImplementation(() => {})
    hiprint.autoConnect()
    expect(start).toHaveBeenCalled()
    start.mockRestore()
  })
})

describe('hiprint client helpers', () => {
  it('getClients delegates to socket', () => {
    const ws = getHiWebSocket()
    const spy = vi.spyOn(ws, 'getClients').mockImplementation(() => {})
    hiprint.getClients()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('ippPrint delegates to socket', () => {
    const ws = getHiWebSocket()
    const spy = vi.spyOn(ws, 'ippPrint').mockImplementation(() => {})
    hiprint.ippPrint({ doc: 'x' })
    expect(spy).toHaveBeenCalledWith({ doc: 'x' })
    spy.mockRestore()
  })
})
