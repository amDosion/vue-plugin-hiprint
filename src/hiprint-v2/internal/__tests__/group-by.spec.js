/**
 * group-by.spec.js — groupBy / orderBy.
 */
import { describe, it, expect } from 'vitest'
import { groupBy, orderBy } from '../group-by.js'

describe('groupBy', () => {
  it('groups by single field', () => {
    const arr = [
      { type: 'a', n: 1 },
      { type: 'a', n: 2 },
      { type: 'b', n: 3 },
    ]
    const result = groupBy(arr, ['type'], (r) => r.type)
    expect(result).toHaveLength(2)
    const groupA = result.find((g) => g.type === 'a')
    expect(groupA.rows).toHaveLength(2)
    expect(groupA.rows[0].n).toBe(1)
  })

  it('composite key (multiple fields)', () => {
    const arr = [
      { region: 'east', city: 'NYC' },
      { region: 'east', city: 'NYC' },
      { region: 'west', city: 'LA' },
    ]
    const result = groupBy(arr, ['region', 'city'], (r) => [r.region, r.city])
    expect(result).toHaveLength(2)
  })

  it('empty array → empty result', () => {
    expect(groupBy([], ['x'], (r) => r.x)).toEqual([])
  })

  it('all same group', () => {
    const arr = [{ k: 1 }, { k: 1 }, { k: 1 }]
    const result = groupBy(arr, ['k'], (r) => r.k)
    expect(result).toHaveLength(1)
    expect(result[0].rows).toHaveLength(3)
  })
})

describe('orderBy', () => {
  it('sorts numbers ascending', () => {
    const result = orderBy([3, 1, 4, 1, 5, 9, 2, 6], (n) => n)
    expect(result).toEqual([1, 1, 2, 3, 4, 5, 6, 9])
  })

  it('does not mutate input', () => {
    const input = [3, 1, 2]
    const output = orderBy(input, (n) => n)
    expect(input).toEqual([3, 1, 2])
    expect(output).toEqual([1, 2, 3])
  })

  it('sorts objects by key fn', () => {
    const result = orderBy(
      [{ age: 30 }, { age: 10 }, { age: 20 }],
      (o) => o.age
    )
    expect(result.map((o) => o.age)).toEqual([10, 20, 30])
  })

  it('empty / single-element array', () => {
    expect(orderBy([], (x) => x)).toEqual([])
    expect(orderBy([42], (x) => x)).toEqual([42])
  })
})
