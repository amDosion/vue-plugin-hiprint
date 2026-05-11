/**
 * lifecycle.spec.js — V2 internal/lifecycle.js unit tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { assertNotDestroyed, safeCall, evalCap } from '../lifecycle.js'

describe('assertNotDestroyed', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('returns false when self is null', () => {
    expect(assertNotDestroyed(null, 'foo')).toBe(false)
  })

  it('returns false when self._destroyed is falsy', () => {
    expect(assertNotDestroyed({ _destroyed: false }, 'foo')).toBe(false)
    expect(assertNotDestroyed({}, 'foo')).toBe(false)
  })

  it('returns true + warn when self._destroyed is true', () => {
    expect(assertNotDestroyed({ _destroyed: true }, 'method')).toBe(true)
    expect(console.warn).toHaveBeenCalledWith(
      '[hiprint] method called on destroyed template'
    )
  })
})

describe('safeCall', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('returns undefined when fn is not a function', () => {
    expect(safeCall(null, [], 'x')).toBeUndefined()
    expect(safeCall(undefined, [], 'x')).toBeUndefined()
    expect(safeCall('not-a-fn', [], 'x')).toBeUndefined()
  })

  it('invokes fn with args and returns its result', () => {
    const fn = vi.fn((a, b) => a + b)
    expect(safeCall(fn, [1, 2], 'add')).toBe(3)
    expect(fn).toHaveBeenCalledWith(1, 2)
  })

  it('catches throw + logs + returns undefined', () => {
    const fn = vi.fn(() => {
      throw new Error('boom')
    })
    expect(safeCall(fn, [], 'crashFn')).toBeUndefined()
    expect(console.error).toHaveBeenCalledWith(
      '[hiprint] crashFn threw:',
      expect.any(Error)
    )
  })

  it('handles undefined args array', () => {
    const fn = vi.fn(() => 42)
    expect(safeCall(fn, undefined, 'x')).toBe(42)
  })
})

describe('evalCap', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('returns undefined for non-string / empty input', () => {
    expect(evalCap(null, 'x')).toBeUndefined()
    expect(evalCap('', 'x')).toBeUndefined()
    expect(evalCap(undefined, 'x')).toBeUndefined()
    expect(evalCap(42, 'x')).toBeUndefined()
  })

  it('evaluates valid function string', () => {
    const fn = evalCap('function(a){return a*2}', 'doubler')
    expect(typeof fn).toBe('function')
    expect(fn(3)).toBe(6)
  })

  it('refuses + warns when source exceeds maxLen', () => {
    const big = 'function(){return "' + 'x'.repeat(5001) + '"}'
    expect(evalCap(big, 'overlong')).toBeUndefined()
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('refused: formatter source > 5000 chars')
    )
  })

  it('accepts custom maxLen', () => {
    const small = 'function(){return 1}' // ~20 chars
    expect(evalCap(small, 'x', 1000)).not.toBeUndefined()
    expect(evalCap(small, 'x', 10)).toBeUndefined()
  })

  it('catches eval error + logs + returns undefined', () => {
    expect(evalCap('not valid js syntax {[}', 'bad')).toBeUndefined()
    expect(console.error).toHaveBeenCalledWith(
      '[hiprint] bad eval failed:',
      expect.any(Error)
    )
  })
})
