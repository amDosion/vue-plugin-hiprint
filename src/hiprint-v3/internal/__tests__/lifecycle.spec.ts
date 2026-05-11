/**
 * lifecycle.spec.ts — V3 internal/lifecycle.ts unit tests.
 * Ported from V2 internal/__tests__/lifecycle.spec.js 1:1, only import paths
 * adjusted and the few `as any` casts needed to test runtime behavior under
 * strict TS.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { assertNotDestroyed, safeCall, evalCap } from '../lifecycle'

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
    // Runtime behavior: non-function rejected. Cast bypasses strict typing.
    expect(safeCall('not-a-fn' as unknown as () => unknown, [], 'x')).toBeUndefined()
  })

  it('invokes fn with args and returns its result', () => {
    const fn = vi.fn((a: number, b: number) => a + b)
    expect(safeCall(fn as unknown as (...args: unknown[]) => unknown, [1, 2], 'add')).toBe(3)
    expect(fn).toHaveBeenCalledWith(1, 2)
  })

  it('catches throw + logs + returns undefined', () => {
    const fn = vi.fn(() => {
      throw new Error('boom')
    })
    expect(safeCall(fn as unknown as (...args: unknown[]) => unknown, [], 'crashFn')).toBeUndefined()
    expect(console.error).toHaveBeenCalledWith(
      '[hiprint] crashFn threw:',
      expect.any(Error)
    )
  })

  it('handles undefined args array', () => {
    const fn = vi.fn(() => 42)
    expect(safeCall(fn as unknown as (...args: unknown[]) => number, undefined, 'x')).toBe(42)
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
    expect(evalCap(42 as unknown as string, 'x')).toBeUndefined()
  })

  it('evaluates valid function string', () => {
    const fn = evalCap('function(a){return a*2}', 'doubler') as ((n: number) => number) | undefined
    expect(typeof fn).toBe('function')
    expect(fn!(3)).toBe(6)
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
