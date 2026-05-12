/**
 * TablePropertyPanel-multi-layer.spec.ts — TKT-105/106 (Sprint 22c Stream CE).
 *
 * Covers the user-interaction layer added on top of Sprint 22b BB's
 * render-table data layer:
 *
 *  - TKT-105: multi-layer header UI
 *    - Two layers render as two tabs.
 *    - Active layer's column rows render below the tabs.
 *    - addLayer appends to the bottom (becomes new leaf).
 *    - removeLayer drops the layer; refuses to drop the last (≥ 1 invariant
 *      mirrors removePanel R3).
 *    - Switching tabs swaps which layer's columns the panel edits.
 *
 *  - TKT-106: merge cells UI
 *    - colspan / rowspan inputs write through to render-table model.
 *    - "Merge with right" button increments colspan by 1.
 *    - Boundary: last column's merge button is disabled (no neighbor).
 *
 *  - JSON round-trip: state shape `Array<Array<column>>` survives history
 *    push + undo + redo without flattening to single-layer.
 *
 * Strategy: real Pinia store (no mocks) — exercises the full
 * `canvas.updateElement → applyElementPatch → history.pushSnapshot` chain.
 * That's what catches the reactivity / immutability bugs Sprint 22a-r had.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import {
  useCanvasStore,
  useHistoryStore,
  type CanvasElement,
} from '@hiprint-v3/stores'
import TablePropertyPanel from '../TablePropertyPanel.vue'

beforeEach(() => {
  setActivePinia(createPinia())
})

function seedTable(
  columns:
    | Array<Record<string, unknown>>
    | Array<Array<Record<string, unknown>>>,
  extraOptions: Record<string, unknown> = {}
): {
  canvas: ReturnType<typeof useCanvasStore>
  history: ReturnType<typeof useHistoryStore>
  getElement: () => CanvasElement | undefined
} {
  const canvas = useCanvasStore()
  const history = useHistoryStore()
  canvas.addPanel({ id: 'p1', width: 400, height: 300 })
  canvas.addElement('p1', {
    id: 'e1',
    tid: 'default.table',
    printElementType: { type: 'table', title: 'Table' },
    options: {
      left: 10,
      top: 20,
      width: 300,
      height: 150,
      columns,
      ...extraOptions,
    },
  })
  canvas.selectMultiple(['e1'])
  const getElement = () =>
    canvas.panels[0]?.printElements.find((e) => e.id === 'e1')
  return { canvas, history, getElement }
}

function getColumns(
  el: CanvasElement | undefined
): Array<Array<Record<string, unknown>>> {
  const c = (el?.options as Record<string, unknown>)?.columns
  if (!Array.isArray(c)) return [[]]
  if (Array.isArray(c[0])) return c as Array<Array<Record<string, unknown>>>
  return [c as Array<Record<string, unknown>>]
}

// ============ TKT-105: multi-layer header UI ============

describe('TablePropertyPanel — TKT-105 multi-layer header rendering', () => {
  it('renders one layer tab per header layer', async () => {
    const layers = [
      [{ title: 'Group A', colspan: 2 }],
      [
        { title: 'A1', field: 'a1', width: 100, align: 'left' },
        { title: 'A2', field: 'a2', width: 100, align: 'left' },
      ],
    ]
    const { getElement } = seedTable(layers)
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    const tabs = w.findAll('button.layer-tab')
    expect(tabs.length).toBe(2)
    // Default active layer is the leaf (last) — clamp logic.
    const active = tabs.find((t) => t.classes('is-active'))
    expect(active).toBeDefined()
    w.unmount()
  })

  it('switching tabs changes which layer is rendered as column rows', async () => {
    const layers = [
      [
        { title: 'Group A', colspan: 1 },
        { title: 'Group B', colspan: 1 },
      ],
      [
        { title: 'A', field: 'a', width: 100, align: 'left' },
        { title: 'B', field: 'b', width: 100, align: 'center' },
      ],
    ]
    const { getElement } = seedTable(layers)
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    // Click first tab.
    const tabs = w.findAll('button.layer-tab')
    await tabs[0]!.trigger('click')
    const titleInputs = w.findAll('input.col-title')
    expect((titleInputs[0]!.element as HTMLInputElement).value).toBe('Group A')
    expect((titleInputs[1]!.element as HTMLInputElement).value).toBe('Group B')
    // Switch to second tab.
    await tabs[1]!.trigger('click')
    const titleInputs2 = w.findAll('input.col-title')
    expect((titleInputs2[0]!.element as HTMLInputElement).value).toBe('A')
    expect((titleInputs2[1]!.element as HTMLInputElement).value).toBe('B')
    w.unmount()
  })

  it('addLayer appends a new layer at the bottom', async () => {
    const layers = [
      [{ title: 'A', field: 'a', width: 100, align: 'left' }],
    ]
    const { getElement } = seedTable(layers)
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    const addBtn = w.find('button.layer-add')
    expect(addBtn.exists()).toBe(true)
    await addBtn.trigger('click')
    const cols = getColumns(getElement())
    expect(cols.length).toBe(2)
    // New layer mirrors previous bottom column count.
    expect(cols[1]!.length).toBe(1)
    w.unmount()
  })

  it('removeLayer drops the layer at the given index', async () => {
    const layers = [
      [{ title: 'L1', field: 'l1' }],
      [{ title: 'L2', field: 'l2' }],
      [{ title: 'L3', field: 'l3' }],
    ]
    const { getElement } = seedTable(layers)
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    // Click the ✕ on the middle layer tab (index 1).
    const removes = w.findAll('span.layer-tab-remove')
    expect(removes.length).toBe(3) // one per tab when >1 layer
    await removes[1]!.trigger('click')
    const cols = getColumns(getElement())
    expect(cols.length).toBe(2)
    expect(cols[0]![0]!.field).toBe('l1')
    expect(cols[1]![0]!.field).toBe('l3')
    w.unmount()
  })

  it('removeLayer refuses to drop the last layer (≥ 1 invariant)', async () => {
    const layers = [
      [{ title: 'A', field: 'a', width: 100, align: 'left' }],
    ]
    const { getElement } = seedTable(layers)
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    // With only one layer, the remove ✕ is not rendered (v-if guard).
    const removes = w.findAll('span.layer-tab-remove')
    expect(removes.length).toBe(0)
    // Column count stays at 1.
    const cols = getColumns(getElement())
    expect(cols.length).toBe(1)
    w.unmount()
  })

  it('addColumn appends to the active layer (not always layer 0)', async () => {
    const layers = [
      [{ title: 'Top', colspan: 1 }],
      [{ title: 'Leaf', field: 'l', width: 100, align: 'left' }],
    ]
    const { getElement } = seedTable(layers)
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    // Default active layer = leaf (index 1).
    await w.find('.col-add').trigger('click')
    const cols = getColumns(getElement())
    expect(cols[0]!.length).toBe(1) // unchanged
    expect(cols[1]!.length).toBe(2) // appended
    w.unmount()
  })
})

// ============ TKT-106: merge cells UI ============

describe('TablePropertyPanel — TKT-106 merge cells inputs', () => {
  it('colspan input writes through to render-table model', async () => {
    const { getElement } = seedTable([
      [
        { title: 'A', field: 'a', width: 100, align: 'left' },
        { title: 'B', field: 'b', width: 100, align: 'left' },
      ],
    ])
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    const colspanInputs = w.findAll('input.col-colspan')
    expect(colspanInputs.length).toBe(2)
    ;(colspanInputs[0]!.element as HTMLInputElement).value = '2'
    await colspanInputs[0]!.trigger('change')
    const cols = getColumns(getElement())
    expect(cols[0]![0]!.colspan).toBe(2)
    expect(cols[0]![1]!.colspan).toBeUndefined() // untouched
    w.unmount()
  })

  it('rowspan input writes through to render-table model', async () => {
    const { getElement } = seedTable([
      [
        { title: 'A', field: 'a', width: 100, align: 'left' },
        { title: 'B', field: 'b', width: 100, align: 'left' },
      ],
    ])
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    const rowspanInputs = w.findAll('input.col-rowspan')
    expect(rowspanInputs.length).toBe(2)
    ;(rowspanInputs[1]!.element as HTMLInputElement).value = '3'
    await rowspanInputs[1]!.trigger('change')
    const cols = getColumns(getElement())
    expect(cols[0]![1]!.rowspan).toBe(3)
    expect(cols[0]![0]!.rowspan).toBeUndefined()
    w.unmount()
  })

  it('merge-with-right button increments colspan by 1', async () => {
    const { getElement } = seedTable([
      [
        { title: 'A', field: 'a', width: 100, align: 'left', colspan: 1 },
        { title: 'B', field: 'b', width: 100, align: 'left' },
        { title: 'C', field: 'c', width: 100, align: 'left' },
      ],
    ])
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    const mergeBtns = w.findAll('button.col-merge-right')
    expect(mergeBtns.length).toBe(3)
    // First column: merge with right → colspan 1 → 2.
    await mergeBtns[0]!.trigger('click')
    let cols = getColumns(getElement())
    expect(cols[0]![0]!.colspan).toBe(2)
    // Click again: 2 → 3.
    const mergeBtns2 = w.findAll('button.col-merge-right')
    await mergeBtns2[0]!.trigger('click')
    cols = getColumns(getElement())
    expect(cols[0]![0]!.colspan).toBe(3)
    w.unmount()
  })

  it('merge-with-right last column button is disabled (no right neighbor)', async () => {
    const { getElement } = seedTable([
      [
        { title: 'A', field: 'a' },
        { title: 'B', field: 'b' },
      ],
    ])
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    const mergeBtns = w.findAll('button.col-merge-right')
    expect(mergeBtns.length).toBe(2)
    // First col: enabled
    expect((mergeBtns[0]!.element as HTMLButtonElement).disabled).toBe(false)
    // Last col: disabled
    expect((mergeBtns[1]!.element as HTMLButtonElement).disabled).toBe(true)
    w.unmount()
  })

  it('colspan/rowspan default to 1 in UI when option missing', async () => {
    const { getElement } = seedTable([
      [{ title: 'A', field: 'a', width: 100, align: 'left' }],
    ])
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    const colspan = w.find('input.col-colspan').element as HTMLInputElement
    const rowspan = w.find('input.col-rowspan').element as HTMLInputElement
    expect(colspan.value).toBe('1')
    expect(rowspan.value).toBe('1')
    w.unmount()
  })
})

// ============ JSON round-trip ============

describe('TablePropertyPanel — multi-layer state survives history undo/redo', () => {
  it('layered columns shape preserved across pushSnapshot + undo + redo', async () => {
    const layers = [
      [{ title: 'Top', colspan: 2 }],
      [
        { title: 'A', field: 'a', width: 100, align: 'left' },
        { title: 'B', field: 'b', width: 100, align: 'center' },
      ],
    ]
    const { history, getElement } = seedTable(layers)
    history.pushSnapshot()
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    // Add a column to the active (leaf) layer → second history snapshot.
    await w.find('.col-add').trigger('click')
    let cols = getColumns(getElement())
    expect(cols.length).toBe(2) // still 2 layers
    expect(cols[1]!.length).toBe(3) // added one
    // Undo: back to 2 columns in leaf, layered shape preserved.
    history.undo()
    cols = getColumns(getElement())
    expect(cols.length).toBe(2)
    expect(cols[1]!.length).toBe(2)
    expect(cols[0]![0]!.title).toBe('Top')
    // Redo: forward to 3 again.
    history.redo()
    cols = getColumns(getElement())
    expect(cols.length).toBe(2)
    expect(cols[1]!.length).toBe(3)
    w.unmount()
  })
})
