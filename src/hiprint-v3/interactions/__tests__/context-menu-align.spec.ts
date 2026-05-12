/**
 * context-menu-align.spec.ts — Sprint 22d TKT-158 alignment + distribute items.
 *
 * Scope: align/distribute used to live on the HiprintToolbar. Sprint 22d rolled
 * them back into the right-click contextmenu (V1 inventory §G lines 11542-11593
 * + interactions.md §7.1 Group 5). This spec confirms:
 *
 *   1. Items only appear with the right selection cardinality (≥2 for align,
 *      ≥3 for distribute) — V1 parity.
 *   2. Align actions snap each element to the selection bounding box.
 *   3. Distribute spreads the inner elements evenly between the outer two.
 *   4. Width/height broadcast applies the first selected element's dimension.
 *   5. Each mutating action snapshots history (undo restores prior state).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { buildElementContextItems } from '../context-menu'
import {
  useCanvasStore,
  useHistoryStore,
} from '@hiprint-v3/stores'

beforeEach(() => {
  setActivePinia(createPinia())
})

function setupSelectionN(n: number): void {
  const canvas = useCanvasStore()
  canvas.addPanel({ id: 'p1', width: 1000, height: 1000 })
  for (let i = 0; i < n; i++) {
    canvas.addElement('p1', {
      id: `e${i + 1}`,
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { left: 10 + i * 100, top: 20 + i * 5, width: 50, height: 20 },
    })
  }
  canvas.selectMultiple(Array.from({ length: n }, (_, i) => `e${i + 1}`))
}

describe('context-menu — TKT-158 align/distribute visibility', () => {
  it('with 1 selected: NO align or distribute items appear', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text', options: {} })
    canvas.selectMultiple(['e1'])
    const items = buildElementContextItems('e1')
    const ids = items.map((i) => i.id)
    expect(ids).not.toContain('align-left')
    expect(ids).not.toContain('align-center')
    expect(ids).not.toContain('align-right')
    expect(ids).not.toContain('align-top')
    expect(ids).not.toContain('align-middle')
    expect(ids).not.toContain('align-bottom')
    expect(ids).not.toContain('distribute-horizontal')
    expect(ids).not.toContain('distribute-vertical')
    expect(ids).not.toContain('size-same-width')
  })

  it('with 2 selected: 6 align items + width/height broadcast appear; distribute does NOT', () => {
    setupSelectionN(2)
    const items = buildElementContextItems('e1')
    const ids = items.map((i) => i.id)
    expect(ids).toEqual(expect.arrayContaining([
      'align-left',
      'align-center',
      'align-right',
      'align-top',
      'align-middle',
      'align-bottom',
      'size-same-width',
      'size-same-height',
    ]))
    expect(ids).not.toContain('distribute-horizontal')
    expect(ids).not.toContain('distribute-vertical')
  })

  it('with 3 selected: 6 align items + 2 distribute items + width/height broadcast all appear', () => {
    setupSelectionN(3)
    const items = buildElementContextItems('e1')
    const ids = items.map((i) => i.id)
    expect(ids).toEqual(expect.arrayContaining([
      'align-left',
      'align-center',
      'align-right',
      'align-top',
      'align-middle',
      'align-bottom',
      'distribute-horizontal',
      'distribute-vertical',
      'size-same-width',
      'size-same-height',
    ]))
  })
})

describe('context-menu — TKT-158 align handler behavior', () => {
  it('align-left snaps every selected element to minLeft', () => {
    setupSelectionN(2)
    const canvas = useCanvasStore()
    // e1 left=10, e2 left=110 → minLeft=10
    const items = buildElementContextItems('e1')
    items.find((i) => i.id === 'align-left')!.onClick!()
    const els = canvas.panels[0]!.printElements
    expect((els[0]!.options as Record<string, unknown>).left).toBe(10)
    expect((els[1]!.options as Record<string, unknown>).left).toBe(10)
  })

  it('align-top snaps every selected element to minTop', () => {
    setupSelectionN(2)
    const canvas = useCanvasStore()
    // e1 top=20, e2 top=25 → minTop=20
    const items = buildElementContextItems('e1')
    items.find((i) => i.id === 'align-top')!.onClick!()
    const els = canvas.panels[0]!.printElements
    expect((els[0]!.options as Record<string, unknown>).top).toBe(20)
    expect((els[1]!.options as Record<string, unknown>).top).toBe(20)
  })

  it('align-right snaps every selected element so right edges line up', () => {
    setupSelectionN(2)
    const canvas = useCanvasStore()
    // e1 left=10 width=50 → right=60; e2 left=110 width=50 → right=160; max=160
    const items = buildElementContextItems('e1')
    items.find((i) => i.id === 'align-right')!.onClick!()
    const els = canvas.panels[0]!.printElements
    // e1 should move so its right edge = 160 → new left = 110
    expect((els[0]!.options as Record<string, unknown>).left).toBe(110)
    // e2 already at right=160
    expect((els[1]!.options as Record<string, unknown>).left).toBe(110)
  })

  it('align-center centers each element on the selection bounding-box midline', () => {
    setupSelectionN(2)
    const canvas = useCanvasStore()
    // bbox: minLeft=10, maxRight=160 → centerX=85; each element width=50
    const items = buildElementContextItems('e1')
    items.find((i) => i.id === 'align-center')!.onClick!()
    const els = canvas.panels[0]!.printElements
    expect((els[0]!.options as Record<string, unknown>).left).toBe(85 - 25)
    expect((els[1]!.options as Record<string, unknown>).left).toBe(85 - 25)
  })
})

describe('context-menu — TKT-158 distribute handler behavior', () => {
  it('distribute-horizontal spreads middle elements evenly between outer edges', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 1000, height: 1000 })
    // Three elements: e1 left=0 width=10, e3 left=100 width=10, e2 left=70 width=10
    canvas.addElement('p1', { id: 'e1', tid: 't.text', options: { left: 0, top: 0, width: 10, height: 10 } })
    canvas.addElement('p1', { id: 'e2', tid: 't.text', options: { left: 70, top: 0, width: 10, height: 10 } })
    canvas.addElement('p1', { id: 'e3', tid: 't.text', options: { left: 100, top: 0, width: 10, height: 10 } })
    canvas.selectMultiple(['e1', 'e2', 'e3'])
    const items = buildElementContextItems('e1')
    items.find((i) => i.id === 'distribute-horizontal')!.onClick!()
    const els = canvas.panels[0]!.printElements
    // minLeft=0, maxRight=110, totalW=30, gap=(110-0-30)/(3-1)=40
    // cursor after e1: 0+10+40=50 → e2.left=50
    const e2 = els.find((e) => e.id === 'e2')
    expect((e2!.options as Record<string, unknown>).left).toBe(50)
  })

  it('distribute-vertical spreads middle elements evenly along Y axis', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 1000, height: 1000 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text', options: { left: 0, top: 0, width: 10, height: 10 } })
    canvas.addElement('p1', { id: 'e2', tid: 't.text', options: { left: 0, top: 60, width: 10, height: 10 } })
    canvas.addElement('p1', { id: 'e3', tid: 't.text', options: { left: 0, top: 100, width: 10, height: 10 } })
    canvas.selectMultiple(['e1', 'e2', 'e3'])
    const items = buildElementContextItems('e1')
    items.find((i) => i.id === 'distribute-vertical')!.onClick!()
    const els = canvas.panels[0]!.printElements
    // minTop=0, maxBottom=110, totalH=30, gap=40 → e2.top = 0+10+40 = 50
    const e2 = els.find((e) => e.id === 'e2')
    expect((e2!.options as Record<string, unknown>).top).toBe(50)
  })
})

describe('context-menu — TKT-159 width/height broadcast', () => {
  it('size-same-width applies first selected element width to the others', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 500, height: 500 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text', options: { left: 0, top: 0, width: 77, height: 20 } })
    canvas.addElement('p1', { id: 'e2', tid: 't.text', options: { left: 100, top: 0, width: 30, height: 20 } })
    canvas.selectMultiple(['e1', 'e2'])
    const items = buildElementContextItems('e1')
    items.find((i) => i.id === 'size-same-width')!.onClick!()
    const els = canvas.panels[0]!.printElements
    expect((els[0]!.options as Record<string, unknown>).width).toBe(77)
    expect((els[1]!.options as Record<string, unknown>).width).toBe(77)
  })

  it('size-same-height applies first selected element height to the others', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 500, height: 500 })
    canvas.addElement('p1', { id: 'e1', tid: 't.text', options: { left: 0, top: 0, width: 30, height: 33 } })
    canvas.addElement('p1', { id: 'e2', tid: 't.text', options: { left: 0, top: 60, width: 30, height: 10 } })
    canvas.selectMultiple(['e1', 'e2'])
    const items = buildElementContextItems('e1')
    items.find((i) => i.id === 'size-same-height')!.onClick!()
    const els = canvas.panels[0]!.printElements
    expect((els[1]!.options as Record<string, unknown>).height).toBe(33)
  })
})

describe('context-menu — TKT-158 history snapshots', () => {
  it('align-left pushes a history snapshot so undo restores prior left', () => {
    setupSelectionN(2)
    const canvas = useCanvasStore()
    const history = useHistoryStore()
    history.pushSnapshot()
    const items = buildElementContextItems('e1')
    items.find((i) => i.id === 'align-left')!.onClick!()
    expect(history.canUndo).toBe(true)
    // After undo, e2 should be back at left=110
    history.undo()
    const e2 = canvas.panels[0]!.printElements.find((e) => e.id === 'e2')
    expect((e2!.options as Record<string, unknown>).left).toBe(110)
  })
})
