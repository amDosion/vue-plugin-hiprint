/**
 * group.spec.js — PrintElementTypeGroup constructor variants.
 */
import { describe, it, expect } from 'vitest'
import { PrintElementTypeGroup } from '../group.js'

describe('PrintElementTypeGroup', () => {
  it('V1 legacy 2-arg form', () => {
    const g = new PrintElementTypeGroup('文本', [{ tid: 't.a' }, { tid: 't.b' }])
    expect(g.name).toBe('文本')
    expect(g.printElementTypes).toHaveLength(2)
    expect(g.isDynamicSlot).toBeUndefined()
  })

  it('options-object form', () => {
    const g = new PrintElementTypeGroup({
      name: 'Dynamic',
      printElementTypes: [{ tid: 'd.x' }],
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
    expect(!!g.isDynamicSlot).toBe(false)
  })
})
