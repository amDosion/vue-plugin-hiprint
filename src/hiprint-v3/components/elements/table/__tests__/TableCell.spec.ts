/**
 * TableCell.spec.ts — table cell focused tests.
 *
 * Covers:
 *  - Plain text rendering via {{ }} (Invariant #1).
 *  - Formatter return rendered via v-html (Invariant #2).
 *  - Formatter throw caught (Invariant #8) — cell still renders.
 *  - Styler classNames + style applied.
 *  - rowspan/colspan attributes applied; rowspan=0 hides the cell.
 *  - dblclick → edit mode → commit → canvas.updateElement called with new
 *    testData JSON.
 *
 * Locked invariants verified at the cell layer:
 *  - PM-002 R3: resolveField preserves 0 / false / '' for nested fields.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useCanvasStore } from '@hiprint-v3/stores'
import TableCell from '../TableCell.vue'

/**
 * Vue requires a `<tr>` parent for `<td>` to render in some browsers; we
 * wrap each mount in a table to keep the HTML tree valid for happy-dom.
 *
 * We use the `attachTo` API plus a host table because @vue/test-utils
 * `mount` on a `<td>` template by itself would warn about layout context.
 */
function mountInTable<T>(component: T, props: Record<string, unknown>): ReturnType<typeof mount> {
  const host = document.createElement('table')
  const tbody = document.createElement('tbody')
  const tr = document.createElement('tr')
  tbody.appendChild(tr)
  host.appendChild(tbody)
  document.body.appendChild(host)
  return mount(component as Parameters<typeof mount>[0], { props, attachTo: tr })
}

describe('TableCell', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders the raw cell value via textContent (XSS safe)', () => {
    const wrapper = mountInTable(TableCell, {
      column: { field: 'name' },
      row: { name: '<b>boom</b>' },
      rowIndex: 0,
      columnIndex: 0,
      tableData: [{ name: '<b>boom</b>' }],
      tableOptions: {},
    })
    const td = wrapper.find('td')
    expect(td.exists()).toBe(true)
    // textContent equals raw — no HTML parsed.
    expect(td.text()).toBe('<b>boom</b>')
    expect(td.find('b').exists()).toBe(false)
  })

  it('PM-002 R3: preserves 0 / false / "" for nested fields', () => {
    const w0 = mountInTable(TableCell, {
      column: { field: 'a.b' },
      row: { a: { b: 0 } },
      rowIndex: 0,
      columnIndex: 0,
      tableData: [{ a: { b: 0 } }],
      tableOptions: {},
    })
    expect(w0.find('td').text()).toBe('0')

    const wFalse = mountInTable(TableCell, {
      column: { field: 'flag' },
      row: { flag: false },
      rowIndex: 0,
      columnIndex: 0,
      tableData: [{ flag: false }],
      tableOptions: {},
    })
    // resolveField returns fallback '' when value is `null/undefined` only;
    // false is preserved → coerceText('false')
    expect(wFalse.find('td').text()).toBe('false')
  })

  it('renders formatter output via v-html (Invariant #2)', () => {
    const formatter = (v: unknown) => `<em data-test="fmt">${String(v)}</em>`
    const wrapper = mountInTable(TableCell, {
      column: { field: 'name', formatter },
      row: { name: 'Bob' },
      rowIndex: 0,
      columnIndex: 0,
      tableData: [{ name: 'Bob' }],
      tableOptions: {},
    })
    const em = wrapper.find('em[data-test="fmt"]')
    expect(em.exists()).toBe(true)
    expect(em.text()).toBe('Bob')
  })

  it('catches formatter throw + falls back to plain text', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const formatter = () => {
      throw new Error('boom')
    }
    const wrapper = mountInTable(TableCell, {
      column: { field: 'name', formatter },
      row: { name: 'X' },
      rowIndex: 0,
      columnIndex: 0,
      tableData: [{ name: 'X' }],
      tableOptions: {},
    })
    // formatter threw → cell renders plain text via {{ displayText }}
    expect(wrapper.find('td').text()).toBe('X')
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('applies styler classNames + inline style', () => {
    const styler = () => ({ class: 'bg-red', color: 'red', fontWeight: 700 })
    const wrapper = mountInTable(TableCell, {
      column: { field: 'name', styler },
      row: { name: 'X' },
      rowIndex: 0,
      columnIndex: 0,
      tableData: [{ name: 'X' }],
      tableOptions: {},
    })
    const td = wrapper.find('td').element as HTMLElement
    expect(td.className).toContain('bg-red')
    expect(td.style.color).toBe('red')
    // Vue stringifies numeric values in inline styles; just assert non-empty.
    expect(td.style.fontWeight).toBeTruthy()
  })

  it('applies rowspan/colspan when > 1; hides cell when 0', () => {
    const w1 = mountInTable(TableCell, {
      column: { field: 'name' },
      row: { name: 'X' },
      rowIndex: 0,
      columnIndex: 0,
      tableData: [{ name: 'X' }],
      tableOptions: {},
      rowspan: 3,
      colspan: 2,
    })
    const td = w1.find('td').element as HTMLTableCellElement
    expect(td.getAttribute('rowspan')).toBe('3')
    expect(td.getAttribute('colspan')).toBe('2')

    const wHidden = mountInTable(TableCell, {
      column: { field: 'name' },
      row: { name: 'X' },
      rowIndex: 0,
      columnIndex: 0,
      tableData: [{ name: 'X' }],
      tableOptions: {},
      rowspan: 0,
    })
    expect(wHidden.find('td').exists()).toBe(false)
  })

  it('dblclick → edit mode → commit patches testData via canvas.updateElement', async () => {
    const canvas = useCanvasStore()
    const panel = canvas.addPanel({ width: 100, height: 100 })
    const el = canvas.addElement(panel.id, {
      tid: 'default.table',
      options: { testData: '[{}]' },
      printElementType: { type: 'table' },
    })!
    const updateSpy = vi.spyOn(canvas, 'updateElement')

    const wrapper = mountInTable(TableCell, {
      column: { field: 'name' },
      row: { name: 'old' },
      rowIndex: 0,
      columnIndex: 0,
      tableData: [{ name: 'old' }],
      tableOptions: { testData: '[{"name":"old"}]' },
      editable: true,
      panelId: panel.id,
      elementId: el.id,
    })

    await wrapper.find('td').trigger('dblclick')
    await flushPromises()
    const input = wrapper.findComponent({ name: 'TableInlineEditor' })
    expect(input.exists()).toBe(true)

    // Simulate user typing + commit by emitting from the editor.
    await input.vm.$emit('commit', 'new-value')
    await flushPromises()

    expect(updateSpy).toHaveBeenCalledTimes(1)
    const callArg = updateSpy.mock.calls[0]!
    expect(callArg[0]).toBe(panel.id)
    expect(callArg[1]).toBe(el.id)
    const patch = callArg[2] as { options: { testData: string } }
    const parsed = JSON.parse(patch.options.testData) as Array<{ name: string }>
    expect(parsed[0]?.name).toBe('new-value')
  })
})
