/**
 * compile-formatter.spec.ts — TKT-006 lock.
 *
 * Ensures the helper normalizes V1's two formatter shapes (function | string
 * source) and rejects every other input.
 */
import { describe, it, expect, vi } from 'vitest'
import { compileFormatter } from '../compile-formatter'

describe('compileFormatter', () => {
  it('passes a function input through unchanged', () => {
    const fn = (a: number, b: number) => a + b
    const out = compileFormatter(fn)
    expect(out).toBe(fn)
    expect(out?.(2, 3)).toBe(5)
  })

  it('compiles a non-empty string source via new Function', () => {
    const src = 'function (v) { return "Value: " + v }'
    const out = compileFormatter(src)
    expect(typeof out).toBe('function')
    expect(out?.(7)).toBe('Value: 7')
  })

  it('returns null on un-compilable string (syntax error)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const out = compileFormatter('function (v) { return ')
    expect(out).toBeNull()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('returns null for undefined input', () => {
    expect(compileFormatter(undefined)).toBeNull()
  })

  it('returns null for non-function/non-string objects (e.g. {} / number / null)', () => {
    expect(compileFormatter({})).toBeNull()
    expect(compileFormatter(42)).toBeNull()
    expect(compileFormatter(null)).toBeNull()
  })

  it('returns null for empty-after-trim strings', () => {
    expect(compileFormatter('')).toBeNull()
    expect(compileFormatter('   ')).toBeNull()
  })

  it('returns null when string compiles to something that is not a function', () => {
    // Source evaluates to a number, not a function.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const out = compileFormatter('42')
    expect(out).toBeNull()
    warn.mockRestore()
  })
})
