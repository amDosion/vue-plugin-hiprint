/**
 * TableElement-sprint22g-wave3.spec.ts — Sprint 22g wave 3 GM closeout.
 *
 * Covers the user-visible rendering of features that wave 2 produced in the
 * model but wave 3 wires into the DOM:
 *
 *  - TKT-382 — summary row renders inside <tfoot> when any column has
 *    `tableSummary` set.
 *  - TKT-382 — groupedBodyRows interleave `<tr class="...-group-header">` /
 *    `<tr class="...-group-footer">` between data rows when `groupFields` is set.
 *  - TKT-385/386 — table-level style overrides applied to <thead> / <tbody>
 *    / per body <tr>.
 *  - TKT-388 — body cell upperCase conversion via column.upperCase.
 *  - TKT-389 — tableCustomCell HTML payload renders as v-html.
 *  - TKT-381 — column.styler2 string source compiles in the designer path.
 *  - TKT-387 — printElementType.styler fallback applied when column has none.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useCanvasStore } from '@hiprint-v3/stores'
import TableElement from '../TableElement.vue'

function mountTable(
  options: Record<string, unknown>,
  data?: Record<string, unknown>,
  extraType: Record<string, unknown> = {}
) {
  const canvas = useCanvasStore()
  const panel = canvas.addPanel({ width: 210, height: 297 })
  const el = canvas.addElement(panel.id, {
    tid: 'default.table',
    options,
    printElementType: { type: 'table', ...extraType },
  })!
  const wrapper = mount(TableElement, {
    props: {
      elementId: el.id,
      panelId: panel.id,
      data,
      interactive: false,
    },
  })
  return { wrapper, canvas, panel, el }
}

describe('TableElement — Sprint 22g wave 3 summary row (TKT-382)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('renders <tfoot><tr class=...-summary> when a column has tableSummary', () => {
    const { wrapper } = mountTable({
      columns: [
        [
          { title: 'Item', field: 'item' },
          {
            title: 'Qty',
            field: 'qty',
            tableSummary: 'sum',
            tableSummaryText: 'Total: ',
          },
        ],
      ],
      testData: '[{"item":"A","qty":10},{"item":"B","qty":15}]',
    })
    const summary = wrapper.find('tr.hiprint-printElement-table-summary')
    expect(summary.exists()).toBe(true)
    // First cell empty (no summary on item column).
    const cells = summary.findAll('td')
    expect(cells.length).toBe(2)
    expect(cells[1]!.text()).toContain('25')
    wrapper.unmount()
  })

  it('omits summary row when no column has tableSummary', () => {
    const { wrapper } = mountTable({
      columns: [[{ title: 'A', field: 'a' }]],
      testData: '[{"a":1}]',
    })
    expect(
      wrapper.find('tr.hiprint-printElement-table-summary').exists()
    ).toBe(false)
    wrapper.unmount()
  })
})

describe('TableElement — Sprint 22g wave 3 grouped body (TKT-382)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('interleaves group-header rows when groupFields + groupFormatter set', () => {
    const { wrapper } = mountTable({
      columns: [
        [
          { title: 'Type', field: 'type' },
          { title: 'N', field: 'n' },
        ],
      ],
      groupFields: ['type'],
      groupFormatter:
        'function(cs, all, pd, g){return "<b>Group "+g.type+"</b>"}',
      testData:
        '[{"type":"a","n":1},{"type":"a","n":2},{"type":"b","n":3}]',
    })
    const headers = wrapper.findAll(
      'tr.hiprint-printElement-table-group-header'
    )
    expect(headers.length).toBe(2)
    // group-header content is by-design HTML → <b> tag rendered.
    expect(headers[0]!.find('b').exists()).toBe(true)
    wrapper.unmount()
  })

  it('emits group-footer rows when groupFooterFormatter set', () => {
    const { wrapper } = mountTable({
      columns: [
        [
          { title: 'Type', field: 'type' },
          { title: 'N', field: 'n' },
        ],
      ],
      groupFields: ['type'],
      groupFooterFormatter:
        'function(cs, all, pd, g){return "sub "+g.rows.length}',
      testData:
        '[{"type":"a","n":1},{"type":"a","n":2},{"type":"b","n":3}]',
    })
    const footers = wrapper.findAll(
      'tr.hiprint-printElement-table-group-footer'
    )
    expect(footers.length).toBe(2)
    wrapper.unmount()
  })
})

describe('TableElement — Sprint 22g wave 3 style overrides (TKT-385/386)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('applies tableHeaderRowHeight + tableHeaderBackground to <thead>', () => {
    const { wrapper } = mountTable({
      columns: [[{ title: 'A', field: 'a' }]],
      tableHeaderRowHeight: 40,
      tableHeaderBackground: '#ccc',
      tableHeaderFontWeight: 'bold',
      tableHeaderFontSize: 16,
      testData: '[{"a":1}]',
    })
    const thead = wrapper.find('thead').element as HTMLTableSectionElement
    expect(thead.style.height).toBe('40pt')
    // Browsers / happy-dom may keep the raw hex or normalize to rgb(); accept either.
    expect(
      thead.style.background === '#ccc' ||
        thead.style.background.includes('204, 204, 204')
    ).toBe(true)
    expect(thead.style.fontWeight).toBe('bold')
    expect(thead.style.fontSize).toBe('16pt')
    wrapper.unmount()
  })

  it('applies tableBodyRowHeight to body <tr> and bodyFontFamily to <tbody>', () => {
    const { wrapper } = mountTable({
      columns: [[{ title: 'A', field: 'a' }]],
      tableBodyRowHeight: 30,
      tableBodyFontFamily: 'SimSun',
      testData: '[{"a":1},{"a":2}]',
    })
    const tbody = wrapper.find('tbody').element as HTMLTableSectionElement
    expect(tbody.style.fontFamily).toContain('SimSun')
    const tr = wrapper.find('tbody tr').element as HTMLTableRowElement
    expect(tr.style.height).toBe('30pt')
    wrapper.unmount()
  })

  it('emits no inline style when overrides are at V1 defaults (sentinel 0)', () => {
    const { wrapper } = mountTable({
      columns: [[{ title: 'A', field: 'a' }]],
      testData: '[{"a":1}]',
    })
    const thead = wrapper.find('thead').element as HTMLTableSectionElement
    expect(thead.style.height).toBe('')
    expect(thead.style.background).toBe('')
    expect(thead.style.fontWeight).toBe('')
    wrapper.unmount()
  })
})

describe('TableElement — Sprint 22g wave 3 cell extensions', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('TKT-388: column.upperCase=true converts body cell text to upper case', () => {
    const { wrapper } = mountTable({
      columns: [[{ title: 'V', field: 'v', upperCase: 'true' }]],
      testData: '[{"v":"hello"}]',
    })
    const td = wrapper.find('tbody td')
    expect(td.text()).toBe('HELLO')
    wrapper.unmount()
  })

  it('TKT-389: tableTextType=custom + customCellHtml renders as v-html', () => {
    const { wrapper } = mountTable({
      columns: [
        [
          {
            title: 'C',
            field: 'c',
            tableTextType: 'custom',
            customCellHtml: '<i>injected</i>',
          },
        ],
      ],
      testData: '[{"c":1}]',
    })
    const td = wrapper.find('tbody td')
    expect(td.find('i').exists()).toBe(true)
    expect(td.find('i').text()).toBe('injected')
    wrapper.unmount()
  })

  it('TKT-381: column.styler2 string source applies CSS to cell', () => {
    const { wrapper } = mountTable({
      columns: [
        [
          {
            title: 'V',
            field: 'v',
            styler2: 'function(){return {color:"red"}}',
          },
        ],
      ],
      testData: '[{"v":1}]',
    })
    const td = wrapper.find('tbody td').element as HTMLTableCellElement
    expect(td.style.color).toBe('red')
    wrapper.unmount()
  })

  it('TKT-387: printElementType.styler fallback applies when column.styler absent', () => {
    const { wrapper } = mountTable(
      {
        columns: [[{ title: 'V', field: 'v' }]],
        testData: '[{"v":1}]',
      },
      undefined,
      { styler: () => ({ background: 'yellow' }) }
    )
    const td = wrapper.find('tbody td').element as HTMLTableCellElement
    // Note: jsdom serializes "yellow" → "rgb(255, 255, 0)" in some envs.
    expect(
      td.style.background === 'yellow' ||
        td.style.background.includes('255, 255, 0')
    ).toBe(true)
    wrapper.unmount()
  })
})
