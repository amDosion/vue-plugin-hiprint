/**
 * context-menu-text-etype.spec.ts — Sprint 22d TKT-159 text/longText
 * etype-specific contextmenu items.
 *
 * V1 inventory: etypes/text-longtext.md §G lines 11469-11483 + §J.8.
 *
 * Items only appear for printElementType.type === 'text' | 'longText':
 *   - 字体 12pt  → sets fontSize=12 on selection (or right-clicked element).
 *   - 字体加粗   → toggle fontWeight bolder/normal.
 *   - 设置颜色   → emits item id only; caller wires the color picker.
 *
 * Directional move items (±1pt) are universal — covered here in a 6th spec.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { buildElementContextItems } from '../context-menu'
import { useCanvasStore } from '@hiprint-v3/stores'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('context-menu — TKT-159 text-etype item visibility', () => {
  it('text etype: 字体 12pt + 字体加粗 + 设置颜色 items present', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { fontSize: 10 },
    })
    canvas.selectMultiple(['e1'])
    const items = buildElementContextItems('e1')
    const ids = items.map((i) => i.id)
    expect(ids).toContain('text-font-12pt')
    expect(ids).toContain('text-font-bold')
    expect(ids).toContain('text-set-color')
  })

  it('longText etype: same text-specific items appear', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.longText',
      printElementType: { type: 'longText' },
      options: { fontSize: 10 },
    })
    canvas.selectMultiple(['e1'])
    const items = buildElementContextItems('e1')
    const ids = items.map((i) => i.id)
    expect(ids).toContain('text-font-12pt')
    expect(ids).toContain('text-font-bold')
  })

  it('image etype: NO text-specific items appear', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.image',
      printElementType: { type: 'image' },
      options: {},
    })
    canvas.selectMultiple(['e1'])
    const items = buildElementContextItems('e1')
    const ids = items.map((i) => i.id)
    expect(ids).not.toContain('text-font-12pt')
    expect(ids).not.toContain('text-font-bold')
    expect(ids).not.toContain('text-set-color')
  })
})

describe('context-menu — TKT-159 text-etype item handlers', () => {
  it('字体 12pt sets fontSize=12 on the right-clicked element (no selection)', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { fontSize: 9 },
    })
    // No selectMultiple — exercise fallback to right-clicked element.
    const items = buildElementContextItems('e1')
    items.find((i) => i.id === 'text-font-12pt')!.onClick!()
    const el = canvas.panels[0]!.printElements[0]!
    expect((el.options as Record<string, unknown>).fontSize).toBe(12)
  })

  it('字体加粗 toggles fontWeight bolder ↔ normal', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { fontWeight: 'normal' },
    })
    canvas.selectMultiple(['e1'])

    // First call: normal → bolder
    let items = buildElementContextItems('e1')
    items.find((i) => i.id === 'text-font-bold')!.onClick!()
    expect((canvas.panels[0]!.printElements[0]!.options as Record<string, unknown>).fontWeight).toBe('bolder')

    // Second call: bolder → normal
    items = buildElementContextItems('e1')
    items.find((i) => i.id === 'text-font-bold')!.onClick!()
    expect((canvas.panels[0]!.printElements[0]!.options as Record<string, unknown>).fontWeight).toBe('normal')
  })
})

describe('context-menu — TKT-159 directional move (±1pt) (universal)', () => {
  it('向右 moves selected element +1pt on the x axis (and snapshots)', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { left: 50, top: 30 },
    })
    canvas.selectMultiple(['e1'])
    const items = buildElementContextItems('e1')
    items.find((i) => i.id === 'move-right')!.onClick!()
    const el = canvas.panels[0]!.printElements[0]!
    expect((el.options as Record<string, unknown>).left).toBe(51)
    expect((el.options as Record<string, unknown>).top).toBe(30)
  })

  it('向上 moves element -1pt on the y axis even when selection is empty (fallback to right-clicked element)', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.image',
      printElementType: { type: 'image' },
      options: { left: 10, top: 25 },
    })
    // No selection — should still move the right-clicked element.
    const items = buildElementContextItems('e1')
    items.find((i) => i.id === 'move-up')!.onClick!()
    const el = canvas.panels[0]!.printElements[0]!
    expect((el.options as Record<string, unknown>).top).toBe(24)
  })

  it('directional move respects positionLocked (locked elements stay put)', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { left: 5, top: 5, positionLocked: true },
    })
    canvas.selectMultiple(['e1'])
    const items = buildElementContextItems('e1')
    items.find((i) => i.id === 'move-left')!.onClick!()
    const el = canvas.panels[0]!.printElements[0]!
    // Unchanged because positionLocked === true.
    expect((el.options as Record<string, unknown>).left).toBe(5)
  })
})

describe('context-menu — TKT-159 layer shift items', () => {
  it('上移一层 increments zIndex by 1 (no max clamp per V1 §G)', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { zIndex: 3 },
    })
    canvas.selectMultiple(['e1'])
    const items = buildElementContextItems('e1')
    items.find((i) => i.id === 'bring-forward')!.onClick!()
    const el = canvas.panels[0]!.printElements[0]!
    expect((el.options as Record<string, unknown>).zIndex).toBe(4)
  })

  it('下移一层 clamps at zero (V1 §G Math.max(0, z-1))', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { zIndex: 0 },
    })
    canvas.selectMultiple(['e1'])
    const items = buildElementContextItems('e1')
    items.find((i) => i.id === 'send-backward')!.onClick!()
    const el = canvas.panels[0]!.printElements[0]!
    expect((el.options as Record<string, unknown>).zIndex).toBe(0)
  })
})
