/**
 * element-list-panel.spec.js — Element list panel adapter contract.
 *
 * Locks:
 *  - createElementListPanel delegates to panel.createElementListPanel (V1 prototype)
 *  - destroyElementListPanel removes _elListPanel / _elListToggle + clears refs
 *  - refreshElementList delegates to panel.refreshElementList
 *  - errors during V1 method calls are caught + logged (not propagated)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createElementListPanel,
  refreshElementList,
  destroyElementListPanel,
} from '../element-list-panel.js'

describe('createElementListPanel', () => {
  let warnSpy
  let errSpy

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
    errSpy.mockRestore()
  })

  it('returns undefined + warns when panel is null', () => {
    expect(createElementListPanel(null)).toBeUndefined()
    expect(warnSpy).toHaveBeenCalled()
  })

  it('returns undefined + warns when panel.createElementListPanel missing', () => {
    expect(createElementListPanel({ id: 'p1' })).toBeUndefined()
    expect(warnSpy.mock.calls.some((c) => /not found/.test(c[0]))).toBe(true)
  })

  it('delegates to V1 panel.createElementListPanel + returns _elListPanel ref', () => {
    const fakeListPanel = { hasClass: () => false, length: 1 }
    const panel = {
      createElementListPanel: vi.fn(function () {
        this._elListPanel = fakeListPanel
      }),
    }
    const result = createElementListPanel(panel)
    expect(panel.createElementListPanel).toHaveBeenCalledTimes(1)
    expect(result).toBe(fakeListPanel)
  })

  it('catches V1 method throw and returns undefined', () => {
    const panel = {
      createElementListPanel: function () {
        throw new Error('v1 boom')
      },
    }
    expect(createElementListPanel(panel)).toBeUndefined()
    expect(errSpy).toHaveBeenCalled()
  })
})

describe('refreshElementList', () => {
  let warnSpy
  let errSpy

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
    errSpy.mockRestore()
  })

  it('warns when panel.refreshElementList missing', () => {
    refreshElementList({ id: 'p1' })
    expect(warnSpy).toHaveBeenCalled()
  })

  it('delegates to V1 panel method', () => {
    const panel = { refreshElementList: vi.fn() }
    refreshElementList(panel)
    expect(panel.refreshElementList).toHaveBeenCalledTimes(1)
  })

  it('catches V1 throw without propagation', () => {
    const panel = {
      refreshElementList: () => {
        throw new Error('boom')
      },
    }
    expect(() => refreshElementList(panel)).not.toThrow()
    expect(errSpy).toHaveBeenCalled()
  })
})

describe('destroyElementListPanel', () => {
  it('handles null panel gracefully (no throw)', () => {
    expect(() => destroyElementListPanel(null)).not.toThrow()
    expect(() => destroyElementListPanel(undefined)).not.toThrow()
  })

  it('removes _elListPanel / _elListToggle DOM refs', () => {
    const removePanel = vi.fn()
    const removeToggle = vi.fn()
    const panel = {
      templateId: 'tpl-1',
      _elListPanel: { remove: removePanel },
      _elListToggle: { remove: removeToggle },
      _elListBody: { dummy: true },
      _elListHeader: { dummy: true },
    }
    destroyElementListPanel(panel)
    expect(removePanel).toHaveBeenCalledTimes(1)
    expect(removeToggle).toHaveBeenCalledTimes(1)
    expect(panel._elListPanel).toBeNull()
    expect(panel._elListBody).toBeNull()
    expect(panel._elListToggle).toBeNull()
  })

  it('skips DOM remove when refs not set (defensive)', () => {
    const panel = { templateId: 'tpl-1' }
    expect(() => destroyElementListPanel(panel)).not.toThrow()
  })

  it('catches throw during remove (does not propagate)', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const panel = {
      _elListPanel: {
        remove: () => {
          throw new Error('jq boom')
        },
      },
    }
    expect(() => destroyElementListPanel(panel)).not.toThrow()
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })
})
