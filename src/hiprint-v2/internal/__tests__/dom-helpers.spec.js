/**
 * dom-helpers.spec.js — escapeHtml / safeNumber / resolveField (PM-002 R3).
 */
import { describe, it, expect } from 'vitest'
import { escapeHtml, coerceText, safeNumber, resolveField } from '../dom-helpers.js'

describe('escapeHtml', () => {
  it('escapes 5 HTML chars', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    )
  })

  it('handles null / undefined → empty string', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })

  it('preserves safe chars', () => {
    expect(escapeHtml('hello world 123')).toBe('hello world 123')
  })
})

describe('coerceText', () => {
  it('null / undefined → empty', () => {
    expect(coerceText(null)).toBe('')
    expect(coerceText(undefined)).toBe('')
  })

  it('preserves 0 / false / "" (PM-002)', () => {
    expect(coerceText(0)).toBe('0')
    expect(coerceText(false)).toBe('false')
    expect(coerceText('')).toBe('')
  })

  it('toString objects', () => {
    expect(coerceText({ toString: () => 'obj' })).toBe('obj')
  })
})

describe('safeNumber', () => {
  it('parses valid number string', () => {
    expect(safeNumber('42')).toBe(42)
    expect(safeNumber(3.14)).toBe(3.14)
  })

  it('rejects NaN with fallback 0', () => {
    expect(safeNumber('not-a-number')).toBe(0)
    expect(safeNumber(NaN)).toBe(0)
  })

  it('clamps to min/max', () => {
    expect(safeNumber(-5, { min: 0 })).toBe(0)
    expect(safeNumber(1000, { max: 100 })).toBe(100)
    expect(safeNumber(50, { min: 0, max: 100 })).toBe(50)
  })

  it('custom fallback', () => {
    expect(safeNumber('bad', { fallback: -1 })).toBe(-1)
  })

  it('[XSS R3 C1] rejects payload "1pt\\\"><script>" → 1', () => {
    // parseFloat 只取数字前缀, 后续 XSS payload 被吃掉
    expect(safeNumber('1pt"><script>')).toBe(1)
  })
})

describe('resolveField (PM-002 R3)', () => {
  it('resolves single field', () => {
    expect(resolveField({ name: 'Alice' }, 'name')).toBe('Alice')
  })

  it('resolves nested path', () => {
    expect(resolveField({ user: { profile: { age: 30 } } }, 'user.profile.age')).toBe(30)
  })

  it('preserves 0 / false / "" leaf values (PM-002 R2 + R3)', () => {
    expect(resolveField({ a: { b: 0 } }, 'a.b')).toBe(0)
    expect(resolveField({ a: { b: false } }, 'a.b')).toBe(false)
    expect(resolveField({ a: { b: '' } }, 'a.b')).toBe('')
  })

  it('null intermediate → fallback', () => {
    expect(resolveField({ a: null }, 'a.b')).toBe('')
    expect(resolveField({ a: null }, 'a.b', 'N/A')).toBe('N/A')
  })

  it('missing path → fallback', () => {
    expect(resolveField({ a: { b: 1 } }, 'a.c.d', 'missing')).toBe('missing')
  })

  it('empty field path → fallback', () => {
    expect(resolveField({ a: 1 }, '', 'fb')).toBe('fb')
    expect(resolveField({ a: 1 }, null, 'fb')).toBe('fb')
  })

  it('null leaf → fallback', () => {
    expect(resolveField({ a: { b: null } }, 'a.b', 'fb')).toBe('fb')
  })
})
