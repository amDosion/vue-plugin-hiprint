/**
 * TableElement-column-reorder.spec.ts — TKT-155 (Sprint 22d).
 *
 * V3 brings back V1's on-canvas thead column drag-reorder. The user grabs a
 * column header and drops it on another column to swap their positions;
 * TablePropertyPanel still owns the explicit up/down buttons as a fallback.
 *
 * Surface under test:
 *  - `<th draggable="true">` only when `editable=true` (designer mode).
 *  - `dragstart` records `(layerIdx, columnIdx)` for the source.
 *  - `dragover` on another `<th>` in the SAME layer adds the
 *    `.hiprint-column-drop-target` class (and `.hiprint-column-dragging` on
 *    the source); cross-layer dragover never highlights (multi-layer headers
 *    anchor on their grouping, reorder is intra-layer only).
 *  - `drop` delegates to `reorderTableColumn` (table-ops) which pushes
 *    history; drop-on-self is a no-op (no history push).
 *  - `dragend` clears both refs so a cancelled drag leaves no stale highlight.
 *
 * happy-dom's DataTransfer is the minimal stub used in
 * HiprintElementListPanel.spec.ts — same approach here.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useCanvasStore, useHistoryStore } from '@hiprint-v3/stores'
import TableElement from '../TableElement.vue'

function dt(): DataTransfer {
  return {
    effectAllowed: '',
    dropEffect: '',
    setData: vi.fn(),
    getData: vi.fn().mockReturnValue(''),
  } as unknown as DataTransfer
}

function mountTable(
  options: Record<string, unknown>,
  opts?: { editable?: boolean }
): {
  wrapper: ReturnType<typeof mount>
  canvas: ReturnType<typeof useCanvasStore>
  history: ReturnType<typeof useHistoryStore>
  elementId: string
} {
  const canvas = useCanvasStore()
  const history = useHistoryStore()
  const panel = canvas.addPanel({ width: 210, height: 297 })
  const el = canvas.addElement(panel.id, {
    tid: 'default.table',
    options,
    printElementType: { type: 'table' },
  })!
  // Initial snapshot so undo round-trips have somewhere to land.
  history.pushSnapshot()
  const wrapper = mount(TableElement, {
    props: {
      elementId: el.id,
      panelId: panel.id,
      editable: opts?.editable ?? true,
      interactive: false,
    },
  })
  return { wrapper, canvas, history, elementId: el.id }
}

beforeEach(() => {
  setActivePinia(createPinia())
})

// ============ draggable attribute gating ============

describe('TableElement column reorder — draggable gating', () => {
  it('thead <th> is draggable when editable=true', () => {
    const { wrapper } = mountTable(
      {
        columns: [
          [
            { title: 'A', field: 'a' },
            { title: 'B', field: 'b' },
          ],
        ],
        testData: '[{"a":1,"b":2}]',
      },
      { editable: true }
    )
    const ths = wrapper.findAll('thead th')
    expect(ths.length).toBe(2)
    // attribute('draggable') normalises to the string 'true' in happy-dom.
    expect(ths[0]!.attributes('draggable')).toBe('true')
    expect(ths[1]!.attributes('draggable')).toBe('true')
    wrapper.unmount()
  })

  it('thead <th> is NOT draggable when editable=false (preview)', () => {
    const { wrapper } = mountTable(
      {
        columns: [[{ title: 'A', field: 'a' }]],
        testData: '[{"a":1}]',
      },
      { editable: false }
    )
    const th = wrapper.find('thead th')
    // We bind `:draggable="editable ? true : undefined"` so the attribute is
    // OMITTED entirely in preview mode. This keeps DOM byte-identical with
    // print/render.ts output (parity test contract — see TableElement.vue
    // template comment + TableElement-render-parity.spec.ts).
    expect(th.attributes('draggable')).toBeUndefined()
    wrapper.unmount()
  })
})

// ============ dragstart / dragover / dragend lifecycle ============

describe('TableElement column reorder — drag lifecycle', () => {
  it('dragstart on a <th> records the source column index (dragging class)', async () => {
    const { wrapper } = mountTable({
      columns: [
        [
          { title: 'A', field: 'a' },
          { title: 'B', field: 'b' },
        ],
      ],
      testData: '[{"a":1,"b":2}]',
    })
    const ths = wrapper.findAll('thead th')
    await ths[0]!.trigger('dragstart', { dataTransfer: dt() })
    // Source cell picks up the .hiprint-column-dragging class.
    expect(ths[0]!.classes()).toContain('hiprint-column-dragging')
    // The other cell is not the source.
    expect(ths[1]!.classes()).not.toContain('hiprint-column-dragging')
    wrapper.unmount()
  })

  it('dragover on another <th> applies .hiprint-column-drop-target class', async () => {
    const { wrapper } = mountTable({
      columns: [
        [
          { title: 'A', field: 'a' },
          { title: 'B', field: 'b' },
          { title: 'C', field: 'c' },
        ],
      ],
      testData: '[{"a":1,"b":2,"c":3}]',
    })
    const ths = wrapper.findAll('thead th')
    await ths[0]!.trigger('dragstart', { dataTransfer: dt() })
    await ths[2]!.trigger('dragover', { dataTransfer: dt() })
    expect(ths[2]!.classes()).toContain('hiprint-column-drop-target')
    // Source still shows .hiprint-column-dragging, but should NOT be marked
    // as its own drop-target (isDropTargetColumn excludes the source).
    expect(ths[0]!.classes()).toContain('hiprint-column-dragging')
    expect(ths[0]!.classes()).not.toContain('hiprint-column-drop-target')
    wrapper.unmount()
  })

  it('dragend clears both drag + drop-target highlights', async () => {
    const { wrapper } = mountTable({
      columns: [
        [
          { title: 'A', field: 'a' },
          { title: 'B', field: 'b' },
        ],
      ],
      testData: '[{"a":1,"b":2}]',
    })
    const ths = wrapper.findAll('thead th')
    await ths[0]!.trigger('dragstart', { dataTransfer: dt() })
    await ths[1]!.trigger('dragover', { dataTransfer: dt() })
    await ths[0]!.trigger('dragend')
    const after = wrapper.findAll('thead th')
    for (const th of after) {
      expect(th.classes()).not.toContain('hiprint-column-dragging')
      expect(th.classes()).not.toContain('hiprint-column-drop-target')
    }
    wrapper.unmount()
  })
})

// ============ drop → reorderTableColumn ============

describe('TableElement column reorder — drop action', () => {
  it('drop on a different <th> reorders columns + pushes history', async () => {
    const { wrapper, canvas, history, elementId } = mountTable({
      columns: [
        [
          { title: 'A', field: 'a' },
          { title: 'B', field: 'b' },
          { title: 'C', field: 'c' },
        ],
      ],
      testData: '[{"a":1,"b":2,"c":3}]',
    })
    const pushSpy = vi.spyOn(history, 'pushSnapshot')
    const ths = wrapper.findAll('thead th')
    await ths[0]!.trigger('dragstart', { dataTransfer: dt() })
    await ths[2]!.trigger('dragover', { dataTransfer: dt() })
    await ths[2]!.trigger('drop', { dataTransfer: dt() })
    // After moving A to index 2, layer should be [B, C, A].
    const el = canvas.panels[0]!.printElements.find((e) => e.id === elementId)!
    const cols = (el.options as Record<string, unknown>).columns as Array<
      Array<Record<string, unknown>>
    >
    expect(cols[0]!.map((c) => c.title)).toEqual(['B', 'C', 'A'])
    // History snapshot pushed exactly once for the drop.
    expect(pushSpy).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('drop on the SAME <th> is a safe no-op (no reorder, no history push)', async () => {
    const { wrapper, canvas, history, elementId } = mountTable({
      columns: [
        [
          { title: 'A', field: 'a' },
          { title: 'B', field: 'b' },
        ],
      ],
      testData: '[{"a":1,"b":2}]',
    })
    const pushSpy = vi.spyOn(history, 'pushSnapshot')
    const th = wrapper.findAll('thead th')[0]!
    await th.trigger('dragstart', { dataTransfer: dt() })
    await th.trigger('drop', { dataTransfer: dt() })
    const el = canvas.panels[0]!.printElements.find((e) => e.id === elementId)!
    const cols = (el.options as Record<string, unknown>).columns as Array<
      Array<Record<string, unknown>>
    >
    expect(cols[0]!.map((c) => c.title)).toEqual(['A', 'B'])
    expect(pushSpy).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('drop after dragend cleared state is a no-op (cancelled drag)', async () => {
    const { wrapper, canvas, history, elementId } = mountTable({
      columns: [
        [
          { title: 'A', field: 'a' },
          { title: 'B', field: 'b' },
        ],
      ],
      testData: '[{"a":1,"b":2}]',
    })
    const pushSpy = vi.spyOn(history, 'pushSnapshot')
    const ths = wrapper.findAll('thead th')
    await ths[0]!.trigger('dragstart', { dataTransfer: dt() })
    await ths[0]!.trigger('dragend')
    // Drop after dragend should NOT mutate (draggedColumn was cleared).
    await ths[1]!.trigger('drop', { dataTransfer: dt() })
    const el = canvas.panels[0]!.printElements.find((e) => e.id === elementId)!
    const cols = (el.options as Record<string, unknown>).columns as Array<
      Array<Record<string, unknown>>
    >
    expect(cols[0]!.map((c) => c.title)).toEqual(['A', 'B'])
    expect(pushSpy).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('cross-layer dragover/drop is ignored (multi-layer headers anchor)', async () => {
    const { wrapper, canvas, history, elementId } = mountTable({
      columns: [
        // Layer 0 (group row)
        [{ title: 'Group', colspan: 2 }],
        // Layer 1 (leaf row)
        [
          { title: 'A', field: 'a' },
          { title: 'B', field: 'b' },
        ],
      ],
      testData: '[{"a":1,"b":2}]',
    })
    const pushSpy = vi.spyOn(history, 'pushSnapshot')
    // Layer 0 has 1 th, Layer 1 has 2 ths → flat findAll returns 3 in DOM
    // order (top row first).
    const ths = wrapper.findAll('thead th')
    expect(ths.length).toBe(3)
    // Drag layer-1 cell A and try to drop on the layer-0 Group cell.
    await ths[1]!.trigger('dragstart', { dataTransfer: dt() })
    await ths[0]!.trigger('dragover', { dataTransfer: dt() })
    await ths[0]!.trigger('drop', { dataTransfer: dt() })
    // No layer mutation should have happened.
    const el = canvas.panels[0]!.printElements.find((e) => e.id === elementId)!
    const cols = (el.options as Record<string, unknown>).columns as Array<
      Array<Record<string, unknown>>
    >
    expect(cols[0]!.length).toBe(1)
    expect(cols[1]!.map((c) => c.title)).toEqual(['A', 'B'])
    expect(pushSpy).not.toHaveBeenCalled()
    // The cross-layer drop-target highlight should also never appear.
    expect(ths[0]!.classes()).not.toContain('hiprint-column-drop-target')
    wrapper.unmount()
  })
})
