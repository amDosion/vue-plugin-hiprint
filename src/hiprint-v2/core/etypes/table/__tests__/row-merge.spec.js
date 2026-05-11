/**
 * row-merge.spec.js — rowsColumnsMerge call wrapper.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  resolveRowsColumnsMerge,
  applyRowsColumnsMerge,
} from '../row-merge.js'

describe('resolveRowsColumnsMerge', () => {
  it('returns undefined for empty/null', () => {
    expect(resolveRowsColumnsMerge(undefined)).toBeUndefined()
    expect(resolveRowsColumnsMerge('')).toBeUndefined()
    expect(resolveRowsColumnsMerge(null)).toBeUndefined()
  })

  it('returns the function as-is when already a function', () => {
    const fn = () => [1, 1]
    expect(resolveRowsColumnsMerge(fn)).toBe(fn)
  })

  it('evaluates a string source via evalCap', () => {
    const fn = resolveRowsColumnsMerge('function(r) { return [2, 3]; }')
    expect(typeof fn).toBe('function')
    expect(fn()).toEqual([2, 3])
  })

  it('[security] refuses oversize source (evalCap cap 5000)', () => {
    const giant = 'function(){ return [1,1]; /*' + 'x'.repeat(6000) + '*/}'
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fn = resolveRowsColumnsMerge(giant)
    expect(fn).toBeUndefined()
    warn.mockRestore()
  })
})

describe('applyRowsColumnsMerge', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns [1,1] when fn is not a function', () => {
    expect(applyRowsColumnsMerge(undefined, {}, {}, 0, 0, [], {})).toEqual([1, 1])
  })

  it('returns fn result when valid', () => {
    const fn = () => [2, 3]
    expect(applyRowsColumnsMerge(fn, {}, {}, 0, 0, [], {})).toEqual([2, 3])
  })

  it('falls back to [1,1] when fn returns non-array', () => {
    expect(applyRowsColumnsMerge(() => null, {}, {}, 0, 0, [], {})).toEqual([1, 1])
    expect(applyRowsColumnsMerge(() => 'bad', {}, {}, 0, 0, [], {})).toEqual([1, 1])
    expect(applyRowsColumnsMerge(() => [1], {}, {}, 0, 0, [], {})).toEqual([1, 1])
  })

  it('[R3 silent #2] catches thrown error and returns [1,1]', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const throwing = () => {
      throw new Error('user fn busted')
    }
    expect(applyRowsColumnsMerge(throwing, {}, {}, 0, 0, [], {})).toEqual([1, 1])
    expect(err).toHaveBeenCalledOnce()
    expect(err.mock.calls[0][0]).toMatch(/rowsColumnsMerge call failed/)
  })

  it('passes V1 signature args to user fn', () => {
    const spy = vi.fn(() => [1, 1])
    const rowData = { a: 1 }
    const col = { field: 'a' }
    const tableData = [rowData]
    const printData = { p: 'x' }
    applyRowsColumnsMerge(spy, rowData, col, 0, 2, tableData, printData)
    expect(spy).toHaveBeenCalledWith(rowData, col, 0, 2, tableData, printData)
  })
})
