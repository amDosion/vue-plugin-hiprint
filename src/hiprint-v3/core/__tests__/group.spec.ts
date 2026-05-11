/**
 * group.spec.ts — PrintElementTypeGroup constructor variants.
 */

import { describe, it, expect } from 'vitest'
import { PrintElementTypeGroup } from '../group'

describe('PrintElementTypeGroup', () => {
  it('V1 legacy 2-arg form', () => {
    const g = new PrintElementTypeGroup('文本', [
      { tid: 't.a', type: 'text' },
      { tid: 't.b', type: 'text' },
    ])
    expect(g.name).toBe('文本')
    expect(g.printElementTypes).toHaveLength(2)
    expect(g.isDynamicSlot).toBe(false)
  })

  it('options-object form', () => {
    const g = new PrintElementTypeGroup({
      name: 'Dynamic',
      printElementTypes: [{ tid: 'd.x', type: 'text' }],
      isDynamicSlot: true,
      emptyTip: 'no fields',
      icon: 'gear',
    })
    expect(g.name).toBe('Dynamic')
    expect(g.printElementTypes).toHaveLength(1)
    expect(g.isDynamicSlot).toBe(true)
    expect(g.emptyTip).toBe('no fields')
    expect(g.icon).toBe('gear')
  })

  it('options-object without printElementTypes defaults []', () => {
    const g = new PrintElementTypeGroup({ name: 'Empty' })
    expect(g.printElementTypes).toEqual([])
  })

  it('V1 2-arg form omitting types defaults []', () => {
    const g = new PrintElementTypeGroup('NoTypes')
    expect(g.printElementTypes).toEqual([])
  })

  it('isDynamicSlot defaults false for V1 form', () => {
    const g = new PrintElementTypeGroup('legacy', [])
    expect(g.isDynamicSlot).toBe(false)
  })

  it('null arg → name undefined, empty types', () => {
    const g = new PrintElementTypeGroup(null)
    expect(g.name).toBeUndefined()
    expect(g.printElementTypes).toEqual([])
  })

  it('preserves elementTypeDef fields (V1 superset)', () => {
    const g = new PrintElementTypeGroup('G', [
      { tid: 'm.x', type: 'text', custom: true, formatter: 'fn' },
    ])
    expect(g.printElementTypes[0]?.custom).toBe(true)
    expect(g.printElementTypes[0]?.formatter).toBe('fn')
  })
})
