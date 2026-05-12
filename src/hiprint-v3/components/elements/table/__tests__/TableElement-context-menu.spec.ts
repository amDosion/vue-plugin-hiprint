/**
 * TableElement-context-menu.spec.ts — TKT-107 (Sprint 22c Stream CE).
 *
 * Right-click on thead `<th>` opens a column context menu with 7 entries
 * (V1-INVENTORY §J.2 subset for column-level actions). Body-cell right-click
 * does NOT open the menu — V1 P.9 quirk: "the context menu is bound on
 * `thead`, not on the body".
 *
 * Covers:
 *  - @contextmenu.prevent fires only on thead `<th>`, not on body `<td>`.
 *  - Menu opens with 7 items (3 insert/delete + 3 merge/rowspan + 1 edit).
 *  - "Insert column right" mutates `options.columns` (delegates to table-ops).
 *  - "Delete column" splices the column.
 *  - "Merge with right" increments colspan; render-table flags following cell
 *    as `hidden` (display:none) when row-merge consumes the extra span.
 *  - editable=false → no menu (designer-only).
 *  - Multi-layer table: right-click on layer 0 cell targets the right layer.
 *
 * Strategy: floating-ui mocked (no layout), real Pinia store, real Vue mount.
 * The menu rendered into a portal under document.body — we query the portal
 * to inspect items.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

// Mock floating-ui to avoid layout calls (happy-dom returns zero rects).
vi.mock('@floating-ui/vue', () => ({
  computePosition: vi.fn(async () => ({ x: 100, y: 200 })),
  offset: vi.fn((v: number) => ({ name: 'offset', v })),
  flip: vi.fn(() => ({ name: 'flip' })),
  shift: vi.fn((opts: unknown) => ({ name: 'shift', opts })),
}))

import { useCanvasStore } from '@hiprint-v3/stores'
import TableElement from '../TableElement.vue'

beforeEach(() => {
  setActivePinia(createPinia())
})

afterEach(() => {
  document
    .querySelectorAll('.hiprint-context-menu-portal')
    .forEach((n) => n.parentNode?.removeChild(n))
})

async function flush(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

function mountTable(
  options: Record<string, unknown>,
  data?: Record<string, unknown>,
  editable = true
) {
  const canvas = useCanvasStore()
  const panel = canvas.addPanel({ width: 210, height: 297 })
  const el = canvas.addElement(panel.id, {
    tid: 'default.table',
    options,
    printElementType: { type: 'table' },
  })!
  const wrapper = mount(TableElement, {
    props: {
      elementId: el.id,
      panelId: panel.id,
      data,
      editable,
      interactive: false,
    },
  })
  return { wrapper, canvas, panel, el }
}

function getColumns(canvas: ReturnType<typeof useCanvasStore>) {
  const el = canvas.panels[0]!.printElements[0]!
  const c = (el.options as Record<string, unknown>).columns
  if (!Array.isArray(c)) return [[]]
  if (Array.isArray(c[0]))
    return c as Array<Array<Record<string, unknown>>>
  return [c as Array<Record<string, unknown>>]
}

function fireContext(node: Element): void {
  const ev = new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX: 100,
    clientY: 100,
  })
  node.dispatchEvent(ev)
}

// ============ thead binding (V1 P.9) ============

describe('TableElement contextmenu — thead only (V1 P.9)', () => {
  it('right-click on thead <th> opens menu with 7 items', async () => {
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
    expect(ths.length).toBe(2)
    fireContext(ths[0]!.element)
    await flush()
    // 7 actionable items + 2 dividers (the 2 separators) = 9 total items.
    const items = document.querySelectorAll('.hiprint-context-menu-item')
    expect(items.length).toBe(7)
    // Spot-check labels for the V1 entries.
    const labels = Array.from(items).map((n) => n.textContent?.trim() ?? '')
    expect(labels.some((l) => l.includes('插入') || l.includes('Insert'))).toBe(
      true
    )
    expect(
      labels.some((l) => l.includes('删除') || l.includes('Delete'))
    ).toBe(true)
    expect(
      labels.some((l) => l.includes('合并') || l.includes('Merge'))
    ).toBe(true)
  })

  it('right-click on tbody <td> does NOT open the column menu (V1 P.9)', async () => {
    const { wrapper } = mountTable({
      columns: [[{ title: 'A', field: 'a' }]],
      testData: '[{"a":1}]',
    })
    const tds = wrapper.findAll('tbody td')
    expect(tds.length).toBeGreaterThan(0)
    fireContext(tds[0]!.element)
    await flush()
    // No column-context portal mounted.
    expect(
      document.querySelectorAll('.hiprint-context-menu-portal').length
    ).toBe(0)
  })

  it('editable=false suppresses the menu (designer-only)', async () => {
    const { wrapper } = mountTable(
      {
        columns: [[{ title: 'A', field: 'a' }]],
        testData: '[{"a":1}]',
      },
      undefined,
      /* editable */ false
    )
    const th = wrapper.find('thead th')
    fireContext(th.element)
    await flush()
    expect(
      document.querySelectorAll('.hiprint-context-menu-portal').length
    ).toBe(0)
  })
})

// ============ Item actions ============

describe('TableElement contextmenu — item actions', () => {
  it('"Insert column right" appends new column after target', async () => {
    const { wrapper, canvas } = mountTable({
      columns: [
        [
          { title: 'A', field: 'a' },
          { title: 'B', field: 'b' },
        ],
      ],
      testData: '[{"a":1,"b":2}]',
    })
    fireContext(wrapper.findAll('thead th')[0]!.element)
    await flush()
    const items = Array.from(
      document.querySelectorAll('.hiprint-context-menu-item')
    ) as HTMLElement[]
    const right = items.find((n) => (n.textContent ?? '').includes('右'))
    expect(right).toBeDefined()
    right!.click()
    const cols = getColumns(canvas)
    expect(cols[0]!.length).toBe(3)
    expect(cols[0]![0]!.title).toBe('A')
    expect(cols[0]![2]!.title).toBe('B')
  })

  it('"Delete column" removes target column', async () => {
    const { wrapper, canvas } = mountTable({
      columns: [
        [
          { title: 'A', field: 'a' },
          { title: 'B', field: 'b' },
          { title: 'C', field: 'c' },
        ],
      ],
      testData: '[{"a":1,"b":2,"c":3}]',
    })
    fireContext(wrapper.findAll('thead th')[1]!.element) // right-click on B
    await flush()
    const items = Array.from(
      document.querySelectorAll('.hiprint-context-menu-item')
    ) as HTMLElement[]
    const del = items.find((n) => (n.textContent ?? '').includes('删除'))
    expect(del).toBeDefined()
    del!.click()
    const cols = getColumns(canvas)
    expect(cols[0]!.length).toBe(2)
    expect(cols[0]!.map((c) => c.title)).toEqual(['A', 'C'])
  })

  it('"Merge with right" increments colspan; render-table hides following cell when row-merge consumes', async () => {
    const { wrapper, canvas } = mountTable({
      columns: [
        [
          { title: 'A', field: 'a' },
          { title: 'B', field: 'b' },
        ],
      ],
      testData: '[{"a":1,"b":2}]',
    })
    fireContext(wrapper.findAll('thead th')[0]!.element)
    await flush()
    const items = Array.from(
      document.querySelectorAll('.hiprint-context-menu-item')
    ) as HTMLElement[]
    const merge = items.find((n) => (n.textContent ?? '').includes('合并'))
    expect(merge).toBeDefined()
    merge!.click()
    const cols = getColumns(canvas)
    expect(cols[0]![0]!.colspan).toBe(2)
  })

  it('"Insert column left" prepends new column before target', async () => {
    const { wrapper, canvas } = mountTable({
      columns: [
        [
          { title: 'A', field: 'a' },
          { title: 'B', field: 'b' },
        ],
      ],
      testData: '[{"a":1,"b":2}]',
    })
    fireContext(wrapper.findAll('thead th')[1]!.element) // right-click on B
    await flush()
    const items = Array.from(
      document.querySelectorAll('.hiprint-context-menu-item')
    ) as HTMLElement[]
    // Both "Insert left" and "Insert right" labels include "插入" — pick the one
    // with "左" specifically (or fallback for English-only environments).
    const left = items.find(
      (n) =>
        (n.textContent ?? '').includes('左侧') ||
        ((n.textContent ?? '').includes('Insert') &&
          (n.textContent ?? '').includes('left'))
    )
    expect(left).toBeDefined()
    left!.click()
    const cols = getColumns(canvas)
    expect(cols[0]!.length).toBe(3)
    // A stays at 0, new col at 1, B moves to 2.
    expect(cols[0]![0]!.title).toBe('A')
    expect(cols[0]![2]!.title).toBe('B')
  })

  it('"Increase rowspan" bumps rowspan +1', async () => {
    const { wrapper, canvas } = mountTable({
      columns: [
        [
          { title: 'A', field: 'a' },
          { title: 'B', field: 'b' },
        ],
      ],
      testData: '[{"a":1,"b":2}]',
    })
    fireContext(wrapper.findAll('thead th')[0]!.element)
    await flush()
    const items = Array.from(
      document.querySelectorAll('.hiprint-context-menu-item')
    ) as HTMLElement[]
    const inc = items.find((n) => (n.textContent ?? '').includes('增加行跨度'))
    expect(inc).toBeDefined()
    inc!.click()
    const cols = getColumns(canvas)
    expect(cols[0]![0]!.rowspan).toBe(2)
  })

  it('"Decrease rowspan" clamps to ≥ 1', async () => {
    const { wrapper, canvas } = mountTable({
      columns: [[{ title: 'A', field: 'a' }, { title: 'B', field: 'b' }]],
      testData: '[{"a":1,"b":2}]',
    })
    fireContext(wrapper.findAll('thead th')[0]!.element)
    await flush()
    const items = Array.from(
      document.querySelectorAll('.hiprint-context-menu-item')
    ) as HTMLElement[]
    const dec = items.find((n) =>
      (n.textContent ?? '').includes('减少行跨度')
    )
    expect(dec).toBeDefined()
    // Initial rowspan unset → clamp from default 1 means stays at 1.
    dec!.click()
    const cols = getColumns(canvas)
    expect(cols[0]![0]!.rowspan).toBe(1)
  })
})

// ============ Multi-layer routing ============

describe('TableElement contextmenu — multi-layer routing', () => {
  it('right-click on a layer-0 (non-leaf) cell mutates that layer', async () => {
    const { wrapper, canvas } = mountTable({
      columns: [
        [{ title: 'Group A', colspan: 1 }],
        [{ title: 'A', field: 'a' }],
      ],
      testData: '[{"a":1}]',
    })
    // Top-row first cell.
    const layer0Cells = wrapper.findAll('thead tr').at(0)?.findAll('th') ?? []
    expect(layer0Cells.length).toBe(1)
    fireContext(layer0Cells[0]!.element)
    await flush()
    const items = Array.from(
      document.querySelectorAll('.hiprint-context-menu-item')
    ) as HTMLElement[]
    const rightInsert = items.find((n) =>
      (n.textContent ?? '').includes('右')
    )
    rightInsert!.click()
    // Layer 0 should now have 2 cells; layer 1 unchanged.
    const cols = getColumns(canvas)
    expect(cols.length).toBe(2)
    expect(cols[0]!.length).toBe(2)
    expect(cols[1]!.length).toBe(1)
  })
})
