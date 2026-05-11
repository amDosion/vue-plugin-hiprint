/**
 * format.spec.js — dateFormat / numFormat.
 */
import { describe, it, expect, vi } from 'vitest'
import { dateFormat, numFormat } from '../format.js'

describe('dateFormat', () => {
  it('formats ISO date string with yyyy-MM-dd pattern', () => {
    expect(dateFormat('2024-03-15', 'yyyy-MM-dd')).toBe('2024-03-15')
  })

  it('formats with time tokens', () => {
    const result = dateFormat('2024-03-15T10:30:45', 'yyyy-MM-dd HH:mm:ss')
    expect(result).toMatch(/2024-03-15 \d{2}:\d{2}:\d{2}/)
  })

  it('quarter token q', () => {
    expect(dateFormat('2024-04-15', 'q')).toBe('2')
    expect(dateFormat('2024-10-15', 'q')).toBe('4')
  })

  it('two-digit year', () => {
    expect(dateFormat('2024-01-01', 'yy')).toBe('24')
  })

  it('empty / null input → empty string', () => {
    expect(dateFormat('', 'yyyy')).toBe('')
    expect(dateFormat(null, 'yyyy')).toBe('')
  })

  it('catches invalid date + logs', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    // Invalid date won't throw on `new Date(...)`, but token replace may; test catch path
    const result = dateFormat('not-a-date', 'yyyy')
    // Invalid Date getFullYear() returns NaN, which becomes "NaN" string
    // 行为与 V1 一致 — 不必 100% sanitize, 只验证不抛
    expect(typeof result).toBe('string')
  })
})

describe('numFormat', () => {
  it('format with precision', () => {
    expect(numFormat(3.14159, 2)).toBe('3.14')
    expect(numFormat(3.14159, 4)).toBe('3.1416')
  })

  it('precision 0 / undefined → integer', () => {
    expect(numFormat(3.14, 0)).toBe(3)
    expect(numFormat(3.14)).toBe(3)
  })

  it('string number input', () => {
    expect(numFormat('3.14', 1)).toBe('3.1')
  })

  it('empty / null / undefined → empty', () => {
    expect(numFormat('', 2)).toBe('')
    expect(numFormat(null, 2)).toBe('')
    expect(numFormat(undefined, 2)).toBe('')
  })

  it('preserves 0', () => {
    expect(numFormat(0, 2)).toBe('0.00')
    expect(numFormat(0)).toBe(0)
  })

  it('catches parse error', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(numFormat('not-a-number', 2)).toBe('NaN') // toFixed on NaN → "NaN"
  })
})
