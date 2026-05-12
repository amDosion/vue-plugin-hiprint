/**
 * TablePropertyPanel.spec.ts — V3 table property panel tests.
 *
 * TKT-009 rollback: tests for the four invented options (`rowsPerPage`,
 * `maxPage`, `alternateRowColor`, raw-HTML `footer`) were removed because
 * the underlying UI was removed. Replacement coverage:
 *   - `footerFormatter` textarea writes the literal string source
 *     (V1 function-string contract, bundle 2038-2041).
 *   - `tableHeaderRepeat` 3-state select writes `every` / `first` / `none`
 *     (V1 bundle 6308, replaces the wrong-type boolean `columnHeader`).
 *   - `tableFooterRepeat` 3-state select writes `every` / `last` / `no`
 *     (V1 bundle 6309).
 *
 * Covers:
 *  - Columns CRUD (add / remove / update title / reorder up & down).
 *  - Boundary moveColumn (first col up, last col down) is a no-op.
 *  - V1-faithful Header/Footer handlers (tableHeaderRepeat / tableFooterRepeat /
 *    headerType / footerFormatter).
 *  - rowHeight handler.
 *
 * TKT-010 follow-on: the seed now writes `type: 'table'` (the canonical V1
 * etype) instead of the resurrected legacy name; V1 bundle 10737-10739
 * explicitly throws for the legacy etype.
 *
 * All assertions go through the real Pinia canvas store (no mocks) so
 * `applyElementPatch`'s shallow-merge semantics are exercised end-to-end.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useCanvasStore, type CanvasElement } from '@hiprint-v3/stores'
import TablePropertyPanel from '../TablePropertyPanel.vue'

beforeEach(() => {
  setActivePinia(createPinia())
})

interface SeedOptions {
  columns?: unknown
  [k: string]: unknown
}

/**
 * Seed a single `table` element on panel "p1" and return the live
 * CanvasElement reference (re-fetch from store after each mutation —
 * applyElementPatch produces a NEW object on every update).
 */
function seedTable(options: SeedOptions = {}): {
  canvas: ReturnType<typeof useCanvasStore>
  getElement: () => CanvasElement | undefined
} {
  const canvas = useCanvasStore()
  canvas.addPanel({ id: 'p1', width: 400, height: 300 })
  const defaultColumns = [
    [
      { title: 'A', field: 'a', width: 100, align: 'left' },
      { title: 'B', field: 'b', width: 120, align: 'center' },
      { title: 'C', field: 'c', width: 80, align: 'right' },
    ],
  ]
  canvas.addElement('p1', {
    id: 'e1',
    tid: 'default.table',
    printElementType: { type: 'table', title: 'Table' },
    options: {
      left: 10,
      top: 20,
      width: 300,
      height: 150,
      columns: options.columns ?? defaultColumns,
      ...options,
    },
  })
  canvas.selectMultiple(['e1'])
  const getElement = () =>
    canvas.panels[0]?.printElements.find((e) => e.id === 'e1')
  return { canvas, getElement }
}

function getOptions(el: CanvasElement | undefined): Record<string, unknown> {
  return (el?.options as Record<string, unknown>) ?? {}
}

function getColumns(
  el: CanvasElement | undefined
): Array<Array<Record<string, unknown>>> {
  const c = getOptions(el)['columns']
  return Array.isArray(c)
    ? (c as Array<Array<Record<string, unknown>>>)
    : [[]]
}

describe('TablePropertyPanel — column rendering', () => {
  it('renders columns from element.options.columns', async () => {
    const { getElement } = seedTable()
    const el = getElement()!
    const w = mount(TablePropertyPanel, { props: { element: el } })
    await w.vm.$nextTick()
    const rows = w.findAll('.hiprint-table-col-row')
    expect(rows.length).toBe(3)
    const titleInputs = w.findAll('input.col-title')
    expect((titleInputs[0]!.element as HTMLInputElement).value).toBe('A')
    expect((titleInputs[2]!.element as HTMLInputElement).value).toBe('C')
    w.unmount()
  })
})

describe('TablePropertyPanel — columns CRUD', () => {
  it('addColumn appends to first row', async () => {
    const { getElement } = seedTable()
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    await w.find('.col-add').trigger('click')
    const cols = getColumns(getElement())
    expect(cols[0]!.length).toBe(4)
    expect(cols[0]![3]!.title).toBe('col4')
    expect(cols[0]![3]!.width).toBe(100)
    expect(cols[0]![3]!.align).toBe('left')
    w.unmount()
  })

  it('removeColumn drops at given index', async () => {
    const { getElement } = seedTable()
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    // Delete middle column ("B") via the second row's ✕ button.
    const deleteBtns = w.findAll('.col-delete')
    expect(deleteBtns.length).toBe(3)
    await deleteBtns[1]!.trigger('click')
    const cols = getColumns(getElement())
    expect(cols[0]!.length).toBe(2)
    expect(cols[0]!.map((c) => c.title)).toEqual(['A', 'C'])
    w.unmount()
  })

  it('moveColumn up swaps with previous', async () => {
    const { getElement } = seedTable()
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    // Find the up-button for second column (index 1).
    const upBtns = w.findAll('button[aria-label="Move column up"]')
    expect(upBtns.length).toBe(3)
    await upBtns[1]!.trigger('click')
    const cols = getColumns(getElement())
    expect(cols[0]!.map((c) => c.title)).toEqual(['B', 'A', 'C'])
    w.unmount()
  })

  it('moveColumn down swaps with next', async () => {
    const { getElement } = seedTable()
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    const downBtns = w.findAll('button[aria-label="Move column down"]')
    expect(downBtns.length).toBe(3)
    await downBtns[1]!.trigger('click') // Move "B" down → swap with "C"
    const cols = getColumns(getElement())
    expect(cols[0]!.map((c) => c.title)).toEqual(['A', 'C', 'B'])
    w.unmount()
  })

  it('moveColumn at boundary is no-op', async () => {
    const { getElement } = seedTable()
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    // First column up = no-op; last column down = no-op. Both buttons are
    // also disabled — confirm both: disabled attribute AND store unchanged
    // if the click somehow fired.
    const upBtns = w.findAll('button[aria-label="Move column up"]')
    const downBtns = w.findAll('button[aria-label="Move column down"]')
    expect((upBtns[0]!.element as HTMLButtonElement).disabled).toBe(true)
    expect(
      (downBtns[downBtns.length - 1]!.element as HTMLButtonElement).disabled
    ).toBe(true)
    // Force-fire anyway by calling the handler indirectly — disabled
    // buttons should not change state.
    await upBtns[0]!.trigger('click')
    await downBtns[downBtns.length - 1]!.trigger('click')
    const cols = getColumns(getElement())
    expect(cols[0]!.map((c) => c.title)).toEqual(['A', 'B', 'C'])
    w.unmount()
  })

  it('updateColumn(title) calls canvas.updateElement with patched options.columns', async () => {
    const { getElement } = seedTable()
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    const titleInputs = w.findAll('input.col-title')
    const second = titleInputs[1]!
    ;(second.element as HTMLInputElement).value = 'B-new'
    await second.trigger('change')
    const cols = getColumns(getElement())
    expect(cols[0]!.length).toBe(3)
    expect(cols[0]![0]!.title).toBe('A')
    expect(cols[0]![1]!.title).toBe('B-new')
    expect(cols[0]![1]!.field).toBe('b') // other keys preserved
    expect(cols[0]![2]!.title).toBe('C')
    w.unmount()
  })
})

describe('TablePropertyPanel — header / footer handlers (V1-faithful)', () => {
  it('tableHeaderRepeat select writes 3-state value', async () => {
    const { getElement } = seedTable({ tableHeaderRepeat: 'every' })
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    const sel = w.find('select.table-header-repeat')
    expect(sel.exists()).toBe(true)
    await sel.setValue('first')
    expect(getOptions(getElement()).tableHeaderRepeat).toBe('first')
    await sel.setValue('none')
    expect(getOptions(getElement()).tableHeaderRepeat).toBe('none')
    w.unmount()
  })

  it('tableFooterRepeat select writes 3-state value', async () => {
    const { getElement } = seedTable({ tableFooterRepeat: 'last' })
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    const sel = w.find('select.table-footer-repeat')
    expect(sel.exists()).toBe(true)
    await sel.setValue('every')
    expect(getOptions(getElement()).tableFooterRepeat).toBe('every')
    await sel.setValue('no')
    expect(getOptions(getElement()).tableFooterRepeat).toBe('no')
    w.unmount()
  })

  it('headerType select updates option', async () => {
    const { getElement } = seedTable()
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    // Sprint 22g wave 3: many <select>s now exist. Find headerType select by
    // its parent <label> text — robust against new column/table-level selects.
    const labels = w.findAll('label')
    const headerLabel = labels.find((l) =>
      (l.text() || '').trim().startsWith('Header type')
    )
    expect(headerLabel).toBeDefined()
    const headerSelect = headerLabel!.find('select')
    expect(headerSelect.exists()).toBe(true)
    await headerSelect.setValue('group')
    expect(getOptions(getElement()).headerType).toBe('group')
    w.unmount()
  })

  it('footerFormatter textarea writes the literal function source string', async () => {
    const { getElement } = seedTable()
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    const ta = w.find('textarea.footer-formatter')
    expect(ta.exists()).toBe(true)
    const src =
      "function(opts, allData, printData, pageData, pageIndex){ return '<tr><td>summary</td></tr>' }"
    ;(ta.element as HTMLTextAreaElement).value = src
    await ta.trigger('change')
    // The renderer is responsible for `new Function('return '+src)()`; the
    // panel only writes the raw string (V1 contract, bundle 2038-2041).
    expect(getOptions(getElement()).footerFormatter).toBe(src)
    w.unmount()
  })
})

describe('TablePropertyPanel — rows config handlers', () => {
  it('rowHeight commits on change', async () => {
    const { getElement } = seedTable()
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    const input = w.find('input.row-height')
    expect(input.exists()).toBe(true)
    await input.setValue(28)
    expect(getOptions(getElement()).rowHeight).toBe(28)
    w.unmount()
  })
})

describe('TablePropertyPanel — TKT-009 rollback (invented options are gone)', () => {
  it('does not render rowsPerPage input', async () => {
    const { getElement } = seedTable()
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    expect(w.find('input.rows-per-page').exists()).toBe(false)
    w.unmount()
  })

  it('does not render maxPage input', async () => {
    const { getElement } = seedTable()
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    expect(w.find('input.max-page').exists()).toBe(false)
    w.unmount()
  })

  it('does not render alternateRowColor input', async () => {
    const { getElement } = seedTable()
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    expect(w.find('input.alt-row-color').exists()).toBe(false)
    w.unmount()
  })

  it('does not render a raw-HTML `footer` textarea (only footerFormatter)', async () => {
    const { getElement } = seedTable()
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    // Sprint 22g wave 3: the panel now exposes additional function-source
    // textareas (rowStyler / rowsColumnsMerge / groupFormatter / per-column
    // formatter2 / styler2 / etc.). The invented raw-HTML `footer` textarea
    // (TKT-009 rollback) must STILL be absent — verify by class name.
    expect(w.find('textarea.footer').exists()).toBe(false)
    expect(w.find('textarea.footer-formatter').exists()).toBe(true)
    w.unmount()
  })
})
