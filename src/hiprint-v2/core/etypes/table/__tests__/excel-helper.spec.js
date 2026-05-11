/**
 * excel-helper.spec.js — TableExcelHelper unit tests (head/body/footer/formatters).
 *
 * happy-dom + jquery for DOM ops.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import jQuery from 'jquery'
import {
  reconsitutionTableColumnTree,
  getColumnsWidth,
  getOrderdColumns,
  allAutoWidth,
  allFixedWidth,
  createTableHead,
  createTableRow,
  createTableFooter,
  createEmptyRowTarget,
  createRowTarget,
  resizeTableCellWidth,
  getColumnFormatter,
  getColumnRenderFormatter,
  getColumnStyler,
  getHeaderStyler,
  getRowStyler,
  getFooterFormatter,
  getGroupFormatter,
  getGroupFieldsFormatter,
  getGroupFooterFormatter,
  getColumnTableSummaryFormatter,
  tableSummaryTitle,
  TableExcelHelper,
} from '../excel-helper.js'

beforeAll(() => {
  window.$ = window.jQuery = jQuery
  globalThis.$ = jQuery
})

// =============== Reconstitution + width math ===============

describe('reconsitutionTableColumnTree', () => {
  it('flattens single-layer columns to rowColumns', () => {
    const layers = [
      {
        columns: [
          { id: 'a', columnId: 'a', field: 'a', title: 'A', width: 100, colspan: 1, rowspan: 1, checked: true },
          { id: 'b', columnId: 'b', field: 'b', title: 'B', width: 100, colspan: 1, rowspan: 1, checked: true },
        ],
      },
    ]
    const tree = reconsitutionTableColumnTree(layers)
    expect(tree.totalLayer).toBe(1)
    expect(tree.colspan).toBe(2)
    expect(tree.rowColumns).toHaveLength(2)
    expect(tree.rowColumns[0].field).toBe('a')
  })

  it('expands colspan: 2 → 2 leaf entries', () => {
    const layers = [
      {
        columns: [
          { id: 'a', field: 'a', title: 'A', width: 100, colspan: 2, rowspan: 1, checked: true },
        ],
      },
      {
        columns: [
          { id: 'a1', field: 'a1', title: 'A1', width: 50, colspan: 1, rowspan: 1, checked: true },
          { id: 'a2', field: 'a2', title: 'A2', width: 50, colspan: 1, rowspan: 1, checked: true },
        ],
      },
    ]
    const tree = reconsitutionTableColumnTree(layers)
    expect(tree.totalLayer).toBe(2)
    // leaf row is layer 1
    expect(tree.rowColumns).toHaveLength(2)
  })
})

describe('width math (allAutoWidth / allFixedWidth / getColumnsWidth)', () => {
  const layers = [
    {
      columns: [
        { id: 'a', field: 'a', width: 100, colspan: 1, rowspan: 1, checked: true, fixed: true },
        { id: 'b', field: 'b', width: 50, colspan: 1, rowspan: 1, checked: true },
        { id: 'c', field: 'c', width: 50, colspan: 1, rowspan: 1, checked: true },
      ],
    },
  ]
  it('allFixedWidth sums fixed-width columns', () => {
    const tree = reconsitutionTableColumnTree(layers)
    expect(allFixedWidth(tree)).toBe(100)
  })

  it('allAutoWidth sums auto-width columns', () => {
    const tree = reconsitutionTableColumnTree(layers)
    expect(allAutoWidth(tree)).toBe(100)
  })

  it('getColumnsWidth keeps fixed, scales auto', () => {
    const tree = reconsitutionTableColumnTree(layers)
    const widths = getColumnsWidth(tree, 300) // 300 total, 100 fixed, 200 remaining for 100 auto
    expect(widths.a).toBe(100)
    expect(widths.b).toBe(100) // 50/100 * 200
    expect(widths.c).toBe(100)
  })
})

// =============== Head rendering ===============

describe('createTableHead', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('renders <thead> with column titles via .text()', () => {
    const layers = [
      {
        columns: [
          { id: 'a', columnId: 'a', field: 'a', title: 'Name', width: 100, colspan: 1, rowspan: 1, checked: true },
        ],
      },
    ]
    const [$thead] = createTableHead(layers, 200)
    expect($thead.find('td').length).toBe(1)
    expect($thead.find('td').text()).toBe('Name')
  })

  it('[R3 B8] header XSS-safe: scripts in title are text-escaped', () => {
    const layers = [
      {
        columns: [
          {
            id: 'a',
            columnId: 'a',
            field: 'a',
            title: '<script>alert(1)</script>',
            width: 100,
            colspan: 1,
            rowspan: 1,
            checked: true,
          },
        ],
      },
    ]
    const [$thead] = createTableHead(layers, 200)
    const html = $thead.html()
    // .text() escapes < → &lt; — no raw <script> tag
    expect(html).not.toContain('<script>')
    expect($thead.find('script').length).toBe(0)
    expect($thead.find('td').text()).toBe('<script>alert(1)</script>')
  })

  it('applies colspan/rowspan attributes', () => {
    const layers = [
      {
        columns: [
          { id: 'a', columnId: 'a', field: 'a', title: 'A', width: 100, colspan: 3, rowspan: 2, checked: true },
        ],
      },
    ]
    const [$thead] = createTableHead(layers, 200)
    expect($thead.find('td').attr('colspan')).toBe('3')
    expect($thead.find('td').attr('rowspan')).toBe('2')
  })

  it('skips unchecked columns', () => {
    const layers = [
      {
        columns: [
          { id: 'a', columnId: 'a', field: 'a', title: 'A', width: 100, colspan: 1, rowspan: 1, checked: true },
          { id: 'b', columnId: 'b', field: 'b', title: 'B', width: 100, colspan: 1, rowspan: 1, checked: false },
        ],
      },
    ]
    const [$thead] = createTableHead(layers, 200)
    expect($thead.find('td').length).toBe(1)
  })
})

// =============== Empty row ===============

describe('createEmptyRowTarget', () => {
  it('renders <tr> with checked columns only', () => {
    const layers = [
      {
        columns: [
          { id: 'a', field: 'a', width: 100, colspan: 1, rowspan: 1, checked: true },
          { id: 'b', field: 'b', width: 100, colspan: 1, rowspan: 1, checked: false },
        ],
      },
    ]
    const $tr = createEmptyRowTarget(layers)
    expect($tr.find('td').length).toBe(1)
    expect($tr.find('td').attr('field')).toBe('a')
  })

  it('applies tableBodyRowHeight when set', () => {
    const layers = [
      {
        columns: [
          { id: 'a', field: 'a', width: 100, colspan: 1, rowspan: 1, checked: true },
        ],
      },
    ]
    const $tr = createEmptyRowTarget(layers, { options: { tableBodyRowHeight: 30 } })
    expect($tr.find('td').css('height')).toBe('30pt')
  })
})

// =============== Row rendering (incl. XSS / formatters) ===============

describe('createRowTarget', () => {
  const baseLayers = [
    {
      columns: [
        {
          id: 'name',
          columnId: 'name',
          field: 'name',
          title: 'Name',
          width: 100,
          colspan: 1,
          rowspan: 1,
          checked: true,
          tableTextType: 'text',
        },
      ],
    },
  ]
  let tree
  beforeEach(() => {
    tree = reconsitutionTableColumnTree(baseLayers)
  })

  it('[R3 B2] cell text default .text() — XSS safe', () => {
    const $tr = createRowTarget(
      tree,
      { name: '<script>alert(1)</script>' },
      { tableHeaderRepeat: 'every' },
      {},
      0,
      [{ name: '<script>alert(1)</script>' }],
      {}
    )
    expect($tr.find('script').length).toBe(0)
    expect($tr.find('td').text()).toBe('<script>alert(1)</script>')
  })

  it('preserves 0 / false / "" in cell values', () => {
    const $tr = createRowTarget(
      tree,
      { name: 0 },
      { tableHeaderRepeat: 'every' },
      {},
      0,
      [],
      {}
    )
    expect($tr.find('td').text()).toBe('0')
  })

  it('column formatter receives (value, row, idx, options)', () => {
    const formatter = vi.fn((v) => 'F:' + v)
    const layers = [
      {
        columns: [
          {
            id: 'a',
            columnId: 'a',
            field: 'name',
            title: 'Name',
            width: 100,
            colspan: 1,
            rowspan: 1,
            checked: true,
            formatter,
          },
        ],
      },
    ]
    const localTree = reconsitutionTableColumnTree(layers)
    const $tr = createRowTarget(localTree, { name: 'Alice' }, { tableHeaderRepeat: 'every' }, {}, 0, [], {})
    expect(formatter).toHaveBeenCalled()
    expect($tr.find('td').text()).toBe('F:Alice')
  })

  it('[R3 H1] renderFormatter → .html() by-design', () => {
    const layers = [
      {
        columns: [
          {
            id: 'a',
            columnId: 'a',
            field: 'name',
            title: 'Name',
            width: 100,
            colspan: 1,
            rowspan: 1,
            checked: true,
            renderFormatter: () => '<b class="render">X</b>',
          },
        ],
      },
    ]
    const localTree = reconsitutionTableColumnTree(layers)
    const $tr = createRowTarget(localTree, { name: 'x' }, { tableHeaderRepeat: 'every' }, {}, 0, [], {})
    expect($tr.find('b.render').length).toBe(1)
  })

  it('sequence cell renders rowIndex+1', () => {
    const layers = [
      {
        columns: [
          {
            id: 'seq',
            columnId: 'seq',
            field: 'seq',
            title: '#',
            width: 30,
            colspan: 1,
            rowspan: 1,
            checked: true,
            tableTextType: 'sequence',
          },
        ],
      },
    ]
    const localTree = reconsitutionTableColumnTree(layers)
    const $tr = createRowTarget(localTree, {}, { tableHeaderRepeat: 'every' }, {}, 4, [], {})
    expect($tr.find('td').text()).toBe('5')
  })

  it('column styler returns css map', () => {
    const layers = [
      {
        columns: [
          {
            id: 'a',
            columnId: 'a',
            field: 'name',
            title: 'Name',
            width: 100,
            colspan: 1,
            rowspan: 1,
            checked: true,
            styler: () => ({ color: 'red' }),
          },
        ],
      },
    ]
    const localTree = reconsitutionTableColumnTree(layers)
    const $tr = createRowTarget(localTree, { name: 'x' }, { tableHeaderRepeat: 'every' }, {}, 0, [], {})
    expect($tr.find('td').css('color')).toBe('red')
  })

  it('[R3 silent #2] rowsColumnsMerge throw → cell falls back to [1,1] without breaking row', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const layers = [
      {
        columns: [
          { id: 'a', columnId: 'a', field: 'name', title: 'N', width: 100, colspan: 1, rowspan: 1, checked: true },
          { id: 'b', columnId: 'b', field: 'age', title: 'Age', width: 100, colspan: 1, rowspan: 1, checked: true },
        ],
      },
    ]
    const localTree = reconsitutionTableColumnTree(layers)
    const $tr = createRowTarget(
      localTree,
      { name: 'A', age: 1 },
      {
        tableHeaderRepeat: 'every',
        rowsColumnsMerge: () => {
          throw new Error('user fn throw')
        },
      },
      {},
      0,
      [{ name: 'A', age: 1 }],
      {}
    )
    // Row must still render both cells
    expect($tr.find('td').length).toBe(2)
    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })

  it('row styler applies css to <tr>', () => {
    const $tr = createRowTarget(
      tree,
      { name: 'x' },
      { tableHeaderRepeat: 'every', rowStyler: () => ({ 'background-color': 'yellow' }) },
      {},
      0,
      [],
      {}
    )
    expect($tr.css('background-color')).toBe('yellow')
  })
})

// =============== Body grouping ===============

describe('createTableRow grouping', () => {
  const layers = [
    {
      columns: [
        { id: 'g', columnId: 'g', field: 'group', title: 'G', width: 50, colspan: 1, rowspan: 1, checked: true },
        { id: 'n', columnId: 'n', field: 'name', title: 'N', width: 50, colspan: 1, rowspan: 1, checked: true },
      ],
    },
  ]

  it('renders all rows when no grouping', () => {
    const $tbody = createTableRow(layers, [{ group: 'a', name: 'A1' }, { group: 'a', name: 'A2' }], {}, { tableHeaderRepeat: 'every' }, {})
    expect($tbody.find('tr').length).toBe(2)
  })

  it('emits group header via groupFormatter when groupFields set', () => {
    const elementType = { groupFields: ['group'] }
    const $tbody = createTableRow(
      layers,
      [
        { group: 'a', name: 'A1' },
        { group: 'a', name: 'A2' },
        { group: 'b', name: 'B1' },
      ],
      {},
      { tableHeaderRepeat: 'every', groupFormatter: () => '<tr class="grp"><td>group</td></tr>' },
      elementType
    )
    expect($tbody.find('tr.grp').length).toBe(2) // 2 groups
  })
})

// =============== Footer rendering ===============

describe('createTableFooter', () => {
  const cols = [
    {
      columns: [
        {
          id: 'a',
          columnId: 'a',
          field: 'price',
          title: 'Price',
          width: 100,
          colspan: 1,
          rowspan: 1,
          checked: true,
          tableSummary: 'sum',
          tableSummaryColspan: 1,
          tableSummaryAlign: 'right',
          tableSummaryText: 'Sum:',
          tableSummaryNumFormat: 2,
        },
      ],
    },
  ]

  it('renders sum row', () => {
    const data = [{ price: 10 }, { price: 20 }, { price: 30 }]
    const $tfoot = createTableFooter(cols, data, { columns: cols, tableFooterRepeat: 'every' }, {}, {}, data, 0)
    const text = $tfoot.find('td').text()
    expect(text).toContain('Sum:')
    expect(text).toContain('60.00')
  })

  it('renders count row', () => {
    const counterCols = [
      {
        columns: [
          {
            id: 'a',
            columnId: 'a',
            field: 'name',
            width: 50,
            colspan: 1,
            rowspan: 1,
            checked: true,
            tableSummary: 'count',
            tableSummaryText: 'Total:',
          },
        ],
      },
    ]
    const data = [{ name: 'A' }, { name: 'B' }]
    const $tfoot = createTableFooter(counterCols, data, { columns: counterCols, tableFooterRepeat: 'every' }, {}, {}, data, 0)
    const text = $tfoot.find('td').text()
    expect(text).toContain('Total:')
    expect(text).toContain('2')
  })

  it('tableFooterRepeat=no → no summary row', () => {
    const data = [{ price: 10 }]
    const $tfoot = createTableFooter(cols, data, { columns: cols, tableFooterRepeat: 'no' }, {}, {}, data, 0)
    expect($tfoot.find('tr').length).toBe(0)
  })

  it('footerFormatter result is appended', () => {
    const data = [{ price: 10 }]
    const $tfoot = createTableFooter(
      cols,
      data,
      {
        columns: cols,
        tableFooterRepeat: 'every',
        footerFormatter: 'function(){ return "<tr class=\\"ff\\"><td>X</td></tr>" }',
      },
      {},
      {},
      data,
      0
    )
    expect($tfoot.find('tr.ff').length).toBe(1)
  })
})

// =============== tableSummaryTitle ===============

describe('tableSummaryTitle', () => {
  it('shows title when tableSummaryTitle is undefined or true', () => {
    expect(tableSummaryTitle({}, 'Sum:', null)).toBe('Sum:')
    expect(tableSummaryTitle({ tableSummaryTitle: true }, 'Sum:', null)).toBe('Sum:')
  })

  it('hides title (returns empty) when tableSummaryTitle=false and data truthy', () => {
    expect(tableSummaryTitle({ tableSummaryTitle: false }, 'Sum:', { x: 1 })).toBe('')
  })
})

// =============== Formatter accessors (evalCap path) ===============

describe('formatter accessors (evalCap)', () => {
  it('getColumnFormatter prefers formatter2 string over function formatter', () => {
    const fn = () => 'X'
    const col = { formatter: fn, formatter2: 'function(){ return "Y" }' }
    const out = getColumnFormatter(col)
    expect(typeof out).toBe('function')
    expect(out()).toBe('Y')
  })

  it('getColumnStyler styler2 string', () => {
    const col = { styler2: 'function(){ return {color: "blue"} }' }
    const out = getColumnStyler(col)
    expect(out()).toEqual({ color: 'blue' })
  })

  it('getColumnRenderFormatter evals string', () => {
    const col = { renderFormatter: 'function(){ return "<b>X</b>" }' }
    expect(getColumnRenderFormatter(col)()).toBe('<b>X</b>')
  })

  it('getHeaderStyler returns undefined when missing', () => {
    expect(getHeaderStyler({})).toBeUndefined()
  })

  it('getRowStyler from options string', () => {
    const out = getRowStyler({ rowStyler: 'function(){ return {color: "red"} }' }, {})
    expect(out()).toEqual({ color: 'red' })
  })

  it('getFooterFormatter from elementType function', () => {
    const fn = () => 'X'
    expect(getFooterFormatter({}, { footerFormatter: fn })).toBe(fn)
  })

  it('getGroupFormatter from options string', () => {
    const out = getGroupFormatter({ groupFormatter: 'function(){ return "GF" }' }, {})
    expect(out()).toBe('GF')
  })

  it('getGroupFieldsFormatter derives from groupFields array', () => {
    const opts = {}
    const elementType = { groupFields: ['region', 'sub'] }
    const fn = getGroupFieldsFormatter(opts, elementType)
    expect(typeof fn).toBe('function')
    // opts is mutated with derived string
    expect(typeof opts.groupFieldsFormatter).toBe('string')
  })

  it('getColumnTableSummaryFormatter string-form', () => {
    const col = { tableSummaryFormatter: 'function(){ return "<td>S</td>" }' }
    const fn = getColumnTableSummaryFormatter(col)
    expect(typeof fn).toBe('function')
  })
})

// =============== TableExcelHelper façade ===============

describe('TableExcelHelper façade', () => {
  it('exposes all key static helpers (V1 parity)', () => {
    expect(typeof TableExcelHelper.createTableHead).toBe('function')
    expect(typeof TableExcelHelper.createTableRow).toBe('function')
    expect(typeof TableExcelHelper.createTableFooter).toBe('function')
    expect(typeof TableExcelHelper.createRowTarget).toBe('function')
    expect(typeof TableExcelHelper.createEmptyRowTarget).toBe('function')
    expect(typeof TableExcelHelper.resizeTableCellWidth).toBe('function')
    expect(typeof TableExcelHelper.reconsitutionTableColumnTree).toBe('function')
  })
})
