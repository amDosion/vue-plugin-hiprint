/**
 * toolbar.spec.js — buildToolbar adapter contract.
 *
 * Locks:
 *  - R3 W2: 24 处 onXxx 业务回调走 safeCall (sync throw 不冒泡)
 *  - PM-005: _toolbarUid 用 Date.now() + Math.random() 跨调用唯一
 *  - V1 boundary guard: container/template/V1 missing 时返回 undefined + warn
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  buildToolbar,
  _generateToolbarUid,
  __testing__,
} from '../toolbar.js'

describe('_generateToolbarUid (PM-005)', () => {
  it('generates non-empty string', () => {
    expect(typeof _generateToolbarUid()).toBe('string')
    expect(_generateToolbarUid().length).toBeGreaterThan(0)
  })

  it('two consecutive calls produce distinct uids', () => {
    const a = _generateToolbarUid()
    const b = _generateToolbarUid()
    // statistical — with Math.random() collision is effectively 0 here
    expect(a).not.toBe(b)
  })

  it('uid contains timestamp prefix (base36)', () => {
    const uid = _generateToolbarUid()
    expect(uid).toMatch(/^[a-z0-9]+_[a-z0-9]+$/)
  })
})

describe('wrapBusinessCallbacks (R3 W2)', () => {
  it('wraps every onXxx key with safeCall', () => {
    const calls = {}
    const opts = {
      onPreview: () => {
        calls.preview = true
      },
      onPrint: () => {
        calls.print = true
      },
      onSave: () => {
        calls.save = true
      },
    }
    const wrapped = __testing__.wrapBusinessCallbacks(opts)
    wrapped.onPreview()
    wrapped.onPrint()
    wrapped.onSave()
    expect(calls).toEqual({ preview: true, print: true, save: true })
  })

  it('isolates sync throw — returns undefined, does not propagate', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const opts = {
      onPreview: () => {
        throw new Error('biz error')
      },
    }
    const wrapped = __testing__.wrapBusinessCallbacks(opts)
    expect(() => wrapped.onPreview()).not.toThrow()
    expect(wrapped.onPreview()).toBeUndefined()
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })

  it('leaves non-function fields untouched', () => {
    const opts = { showPreview: true, paperTypes: ['A4'], onPreview: null }
    const wrapped = __testing__.wrapBusinessCallbacks(opts)
    expect(wrapped.showPreview).toBe(true)
    expect(wrapped.paperTypes).toEqual(['A4'])
    expect(wrapped.onPreview).toBeNull()
  })

  it('returns input unchanged if options is null / not object', () => {
    expect(__testing__.wrapBusinessCallbacks(null)).toBeNull()
    expect(__testing__.wrapBusinessCallbacks(undefined)).toBeUndefined()
  })

  it('covers all 24+ onXxx keys (R3 W2)', () => {
    // R3 W2 spec: 24 处 onXxx
    expect(__testing__.ON_XXX_KEYS.length).toBeGreaterThanOrEqual(24)
    // Spot-check critical ones
    expect(__testing__.ON_XXX_KEYS).toContain('onPreview')
    expect(__testing__.ON_XXX_KEYS).toContain('onClear')
    expect(__testing__.ON_XXX_KEYS).toContain('onPrint')
    expect(__testing__.ON_XXX_KEYS).toContain('onSave')
    expect(__testing__.ON_XXX_KEYS).toContain('onTemplateDeleteConfirm')
    expect(__testing__.ON_XXX_KEYS).toContain('onBusinessSelect')
  })

  it('passes through arguments to wrapped callback', () => {
    let receivedArgs
    const opts = {
      onPaperChange: function () {
        receivedArgs = Array.prototype.slice.call(arguments)
      },
    }
    const wrapped = __testing__.wrapBusinessCallbacks(opts)
    wrapped.onPaperChange('A4', { width: 210 })
    expect(receivedArgs).toEqual(['A4', { width: 210 }])
  })
})

describe('buildToolbar V1 boundary guards', () => {
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
    expect(buildToolbar(null, {}, {})).toBeUndefined()
    expect(warnSpy).toHaveBeenCalled()
  })

  it('returns undefined + warns when template is missing', () => {
    expect(buildToolbar(document.createElement('div'), null, {})).toBeUndefined()
    expect(warnSpy).toHaveBeenCalled()
  })

  it('returns undefined + warns when V1 hiprint not loaded', () => {
    expect(buildToolbar(document.createElement('div'), { id: 'tpl1' }, {})).toBeUndefined()
    expect(warnSpy).toHaveBeenCalled()
    expect(warnSpy.mock.calls.some((c) => /V1 bundle not loaded/.test(c[0]))).toBe(true)
  })

  it('delegates to V1 when window.hiprint.buildToolbar exists', () => {
    const stubCtrl = { destroy: vi.fn(), getScale: () => 1 }
    const v1Stub = vi.fn(() => stubCtrl)
    window.hiprint = { buildToolbar: v1Stub }

    const container = document.createElement('div')
    const template = { id: 'tpl1' }
    const opts = { showPreview: true, onPreview: vi.fn() }

    const ctrl = buildToolbar(container, template, opts)

    expect(v1Stub).toHaveBeenCalledTimes(1)
    expect(v1Stub.mock.calls[0][0]).toBe(container)
    expect(v1Stub.mock.calls[0][1]).toBe(template)
    // Third arg is wrapped opts: onPreview should be replaced by safeCall wrapper
    const passedOpts = v1Stub.mock.calls[0][2]
    expect(passedOpts.showPreview).toBe(true)
    expect(typeof passedOpts.onPreview).toBe('function')
    expect(passedOpts.onPreview).not.toBe(opts.onPreview)
    expect(ctrl).toBe(stubCtrl)
  })

  it('warns when V1 returns ctrl missing destroy()', () => {
    window.hiprint = { buildToolbar: () => ({ getScale: () => 1 }) }
    buildToolbar(document.createElement('div'), { id: 't' }, {})
    expect(warnSpy.mock.calls.some((c) => /missing destroy/.test(c[0]))).toBe(true)
  })

  it('catches V1 throw and returns undefined', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    window.hiprint = {
      buildToolbar: () => {
        throw new Error('v1 boom')
      },
    }
    const result = buildToolbar(document.createElement('div'), { id: 't' }, {})
    expect(result).toBeUndefined()
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })

  it('wraps onXxx — V1 receives a wrapper, business sync throw does not break V1', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    let v1Received
    window.hiprint = {
      buildToolbar: (_c, _t, o) => {
        v1Received = o
        return { destroy: () => {} }
      },
    }
    buildToolbar(document.createElement('div'), { id: 't' }, {
      onClear: () => {
        throw new Error('business bug')
      },
    })
    // V1 stub got the wrapped onClear; calling it should not throw
    expect(() => v1Received.onClear()).not.toThrow()
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })
})
