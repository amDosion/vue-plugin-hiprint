/**
 * long-text.spec.js — composeLongTextDisplay (PM-002 R3 regression).
 */
import { describe, it, expect } from 'vitest'
import { composeLongTextDisplay } from '../long-text.js'

describe('composeLongTextDisplay', () => {
  it('title + value with default fullwidth colon', () => {
    expect(composeLongTextDisplay('金额', '100')).toBe('金额：100')
  })

  it('custom separator', () => {
    expect(composeLongTextDisplay('Name', 'Alice', { separator: ': ' })).toBe('Name: Alice')
  })

  it('hideTitle=true → value only', () => {
    expect(composeLongTextDisplay('T', 'val', { hideTitle: true })).toBe('val')
  })

  it('empty title → value only', () => {
    expect(composeLongTextDisplay('', 'val')).toBe('val')
    expect(composeLongTextDisplay(null, 'val')).toBe('val')
  })

  it('[PM-002 R3] preserves 0 as "0" (not falsy → empty)', () => {
    expect(composeLongTextDisplay('Count', 0)).toBe('Count：0')
  })

  it('[PM-002 R3] preserves false as "false"', () => {
    expect(composeLongTextDisplay('Flag', false)).toBe('Flag：false')
  })

  it('[PM-002 R3] preserves "" as empty string', () => {
    expect(composeLongTextDisplay('Empty', '')).toBe('Empty：')
  })

  it('null/undefined value → empty string suffix', () => {
    expect(composeLongTextDisplay('T', null)).toBe('T：')
    expect(composeLongTextDisplay('T', undefined)).toBe('T：')
  })
})
