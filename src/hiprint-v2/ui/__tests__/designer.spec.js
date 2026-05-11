/**
 * designer.spec.js — buildDesigner adapter contract.
 *
 * Locks:
 *  - R3 W1: ctrl.destroy is idempotent (multiple calls do not double-empty container)
 *  - R3 W2: onReady wrapped with safeCall isolation
 *  - PM-005: _designerUid uses Date.now() + Math.random()
 *  - V1 boundary guard: container/V1 missing 时返回 undefined + warn
 *  - V1 ctrl 转交 — getTemplate / getToolbarCtrl 透传
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  buildDesigner,
  _generateDesignerUid,
  __testing__,
} from '../designer.js'

describe('_generateDesignerUid (PM-005)', () => {
  it('generates non-empty base36 string', () => {
    const uid = _generateDesignerUid()
    expect(typeof uid).toBe('string')
    expect(uid).toMatch(/^[a-z0-9]+_[a-z0-9]+$/)
  })

  it('two consecutive calls produce distinct uids', () => {
    expect(_generateDesignerUid()).not.toBe(_generateDesignerUid())
  })
})

describe('wrapBusinessCallbacks (designer R3 W2)', () => {
  it('wraps onReady with safeCall', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const opts = {
      onReady: () => {
        throw new Error('biz onReady error')
      },
    }
    const wrapped = __testing__.wrapBusinessCallbacks(opts)
    expect(() => wrapped.onReady('tpl', 'ctrl')).not.toThrow()
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })

  it('passes (template, toolbarCtrl) args through wrapper', () => {
    let received
    const opts = {
      onReady: function (tpl, ctrl) {
        received = [tpl, ctrl]
      },
    }
    const wrapped = __testing__.wrapBusinessCallbacks(opts)
    wrapped.onReady('TPL', 'CTRL')
    expect(received).toEqual(['TPL', 'CTRL'])
  })

  it('returns input unchanged when options null', () => {
    expect(__testing__.wrapBusinessCallbacks(null)).toBeNull()
  })
})

describe('buildDesigner V1 boundary guards', () => {
  let warnSpy

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
    if (typeof window !== 'undefined') {
      delete window.hiprint
    }
  })

  it('returns undefined + warns when container is missing', () => {
    expect(buildDesigner(null, {})).toBeUndefined()
    expect(warnSpy).toHaveBeenCalled()
  })

  it('returns undefined + warns when V1 hiprint not loaded', () => {
    expect(buildDesigner(document.createElement('div'), {})).toBeUndefined()
    expect(warnSpy.mock.calls.some((c) => /V1 bundle not loaded/.test(c[0]))).toBe(true)
  })

  it('delegates to V1 with wrapped options', () => {
    const stubCtrl = {
      destroy: vi.fn(),
      getTemplate: () => ({ id: 'tpl-x' }),
    }
    const v1Stub = vi.fn(() => stubCtrl)
    window.hiprint = { buildDesigner: v1Stub }

    const container = document.createElement('div')
    const onReady = vi.fn()
    const ctrl = buildDesigner(container, { onReady, showPagination: true })

    expect(v1Stub).toHaveBeenCalledTimes(1)
    expect(v1Stub.mock.calls[0][0]).toBe(container)
    expect(v1Stub.mock.calls[0][1].showPagination).toBe(true)
    // onReady is wrapped
    expect(typeof v1Stub.mock.calls[0][1].onReady).toBe('function')
    expect(v1Stub.mock.calls[0][1].onReady).not.toBe(onReady)
    expect(ctrl).toBeDefined()
    expect(typeof ctrl.destroy).toBe('function')
  })

  it('ctrl.destroy is idempotent (R3 W1 + state-modeler R3)', () => {
    const v1Destroy = vi.fn()
    window.hiprint = {
      buildDesigner: () => ({
        destroy: v1Destroy,
        getTemplate: () => null,
      }),
    }
    const ctrl = buildDesigner(document.createElement('div'), {})
    expect(ctrl.isDestroyed()).toBe(false)
    ctrl.destroy()
    expect(ctrl.isDestroyed()).toBe(true)
    expect(v1Destroy).toHaveBeenCalledTimes(1)
    // Second call — V1 destroy NOT invoked again
    ctrl.destroy()
    expect(v1Destroy).toHaveBeenCalledTimes(1)
  })

  it('ctrl.destroy isolates V1 throw', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    window.hiprint = {
      buildDesigner: () => ({
        destroy: () => {
          throw new Error('v1 destroy boom')
        },
        getTemplate: () => null,
      }),
    }
    const ctrl = buildDesigner(document.createElement('div'), {})
    expect(() => ctrl.destroy()).not.toThrow()
    expect(ctrl.isDestroyed()).toBe(true)
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })

  it('warns when V1 ctrl missing destroy / getTemplate', () => {
    window.hiprint = { buildDesigner: () => ({}) }
    buildDesigner(document.createElement('div'), {})
    expect(warnSpy.mock.calls.some((c) => /missing destroy/.test(c[0]))).toBe(true)
    expect(warnSpy.mock.calls.some((c) => /missing getTemplate/.test(c[0]))).toBe(true)
  })

  it('catches V1 throw and returns undefined', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    window.hiprint = {
      buildDesigner: () => {
        throw new Error('boom')
      },
    }
    expect(buildDesigner(document.createElement('div'), {})).toBeUndefined()
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })
})
