/**
 * print-element.spec.js — TablePrintElement (V2 P7 main class).
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import jQuery from 'jquery'
import { TablePrintElement } from '../print-element.js'
import { BasePrintElement } from '../../../print-element-entity.js'

beforeAll(() => {
  window.$ = window.jQuery = jQuery
  globalThis.$ = jQuery
})

beforeEach(() => {
  document.body.innerHTML = ''
})

function basicTablePet(extraType = {}) {
  return {
    tid: 'm.table',
    type: 'table',
    title: 'Order',
    columns: [
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
          {
            id: 'qty',
            columnId: 'qty',
            field: 'qty',
            title: 'Qty',
            width: 50,
            colspan: 1,
            rowspan: 1,
            checked: true,
            tableTextType: 'text',
          },
        ],
      },
    ],
    ...extraType,
  }
}

describe('TablePrintElement construction', () => {
  it('extends BasePrintElement', () => {
    const el = new TablePrintElement(basicTablePet(), {})
    expect(el).toBeInstanceOf(BasePrintElement)
  })

  it('defaults gridColumnsFooterCss / tableGridRowCss', () => {
    const el = new TablePrintElement(basicTablePet(), {})
    expect(el.gridColumnsFooterCss).toBe('hiprint-gridColumnsFooter')
    expect(el.tableGridRowCss).toBe('table-grid-row')
  })

  it('getColumns returns the multi-layer columns', () => {
    const pet = basicTablePet()
    const el = new TablePrintElement(pet, { columns: pet.columns })
    expect(el.getColumns()).toBe(pet.columns)
  })

  it('getColumnByColumnId looks up by id or columnId', () => {
    const pet = basicTablePet()
    const el = new TablePrintElement(pet, { columns: pet.columns })
    expect(el.getColumnByColumnId('name').field).toBe('name')
    expect(el.getColumnByColumnId('qty').field).toBe('qty')
    expect(el.getColumnByColumnId('nonexistent')).toBeUndefined()
  })
})

describe('TablePrintElement.getData (PM-002 R3 safe nested-field)', () => {
  it('design-time: parses options.testData JSON', () => {
    const el = new TablePrintElement(basicTablePet(), {
      testData: '[{"name":"A","qty":1}]',
    })
    const d = el.getData()
    expect(d).toEqual([{ name: 'A', qty: 1 }])
  })

  it('design-time: malformed testData → log + [{}]', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const el = new TablePrintElement(basicTablePet(), { testData: 'not json' })
    expect(el.getData()).toEqual([{}])
    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })

  it('design-time: default testData "[{}]" when not set', () => {
    const el = new TablePrintElement(basicTablePet(), {})
    expect(el.getData()).toEqual([{}])
  })

  it('runtime: extracts field path safely (nested)', () => {
    const el = new TablePrintElement(basicTablePet(), { field: 'order.items' })
    const data = el.getData({ order: { items: [{ name: 'A', qty: 1 }] } })
    expect(data).toEqual([{ name: 'A', qty: 1 }])
  })

  it('[PM-002 R3] runtime: nested null intermediate → []', () => {
    const el = new TablePrintElement(basicTablePet(), { field: 'a.b' })
    expect(el.getData({ a: null })).toEqual([])
  })

  it('runtime: clones data (no shared mutation)', () => {
    const el = new TablePrintElement(basicTablePet(), { field: 'items' })
    const src = [{ name: 'A' }]
    const out = el.getData({ items: src })
    out[0].name = 'B'
    expect(src[0].name).toBe('A')
  })
})

describe('TablePrintElement.getFooterFormatter / getGridColumnsFooterFormatter', () => {
  it('returns elementType function-form footerFormatter directly', () => {
    const fn = () => 'FF'
    const el = new TablePrintElement(basicTablePet({ footerFormatter: fn }), {})
    expect(el.getFooterFormatter()).toBe(fn)
  })

  it('evals options string-form footerFormatter via evalCap', () => {
    const el = new TablePrintElement(basicTablePet(), {
      footerFormatter: 'function(){ return "X" }',
    })
    const fn = el.getFooterFormatter()
    expect(typeof fn).toBe('function')
    expect(fn()).toBe('X')
  })

  it('returns undefined when no formatter set', () => {
    const el = new TablePrintElement(basicTablePet(), {})
    expect(el.getFooterFormatter()).toBeUndefined()
  })

  it('gridColumnsFooterFormatter evals string-form', () => {
    const el = new TablePrintElement(basicTablePet(), {
      gridColumnsFooterFormatter: 'function(){ return "<div>GF</div>" }',
    })
    const fn = el.getGridColumnsFooterFormatter()
    expect(typeof fn).toBe('function')
  })
})

describe('TablePrintElement.getTableHtml (head/body/footer)', () => {
  it('renders <table.hiprint-printElement-tableTarget> with thead + tbody', () => {
    const pet = basicTablePet()
    const el = new TablePrintElement(pet, {
      columns: pet.columns,
      gridColumns: 1,
      width: 200,
      tableHeaderRepeat: 'every',
      tableFooterRepeat: 'no',
    })
    const $table = el.getTableHtml([{ name: 'A', qty: 1 }], {})
    expect($table.hasClass('hiprint-printElement-tableTarget')).toBe(true)
    expect($table.find('thead').length).toBe(1)
    expect($table.find('tbody tr').length).toBe(1)
    expect($table.find('tbody tr td').first().text()).toBe('A')
  })

  it('[R3 B2] cell text via .text() — XSS safe', () => {
    const pet = basicTablePet()
    const el = new TablePrintElement(pet, {
      columns: pet.columns,
      gridColumns: 1,
      width: 200,
      tableHeaderRepeat: 'every',
      tableFooterRepeat: 'no',
    })
    const $table = el.getTableHtml([{ name: '<script>alert(1)</script>', qty: 1 }], {})
    expect($table.find('script').length).toBe(0)
  })
})

describe('TablePrintElement.createTarget', () => {
  it('renders the full wrapper (printElement + grid-row + table)', () => {
    const pet = basicTablePet()
    const el = new TablePrintElement(pet, {
      columns: pet.columns,
      gridColumns: 1,
      width: 200,
      tableHeaderRepeat: 'every',
      tableFooterRepeat: 'no',
    })
    const $target = el.createTarget('Order', [{ name: 'A', qty: 1 }], {})
    expect($target.hasClass('hiprint-printElement-table')).toBe(true)
    expect($target.find('.hiprint-printElement-table-handle').length).toBe(1)
    expect($target.find('.hiprint-printElement-table-content').length).toBe(1)
    expect($target.find('.table-grid-row').length).toBe(1)
  })

  it('multi-grid-columns: gridColumns=2 → 2 grid columns', () => {
    const pet = basicTablePet()
    const el = new TablePrintElement(pet, {
      columns: pet.columns,
      gridColumns: 2,
      width: 200,
      tableHeaderRepeat: 'every',
      tableFooterRepeat: 'no',
    })
    const $target = el.createTarget('Order', [{ name: 'A', qty: 1 }], {})
    expect($target.find('.hi-grid-col').length).toBe(2)
  })

  it('gridColumnsFooterFormatter renders footer div', () => {
    const pet = basicTablePet()
    const el = new TablePrintElement(pet, {
      columns: pet.columns,
      gridColumns: 1,
      width: 200,
      gridColumnsFooterFormatter: 'function(){ return "<span>F</span>" }',
      tableHeaderRepeat: 'every',
      tableFooterRepeat: 'no',
    })
    const $target = el.createTarget('Order', [{ name: 'A' }], {})
    expect($target.find('.hiprint-gridColumnsFooter').length).toBe(1)
  })
})

describe('TablePrintElement.getHtml (single-paper render)', () => {
  it('returns [{target}]', () => {
    const pet = basicTablePet()
    const el = new TablePrintElement(pet, {
      columns: pet.columns,
      gridColumns: 1,
      width: 200,
      tableHeaderRepeat: 'every',
      tableFooterRepeat: 'no',
    })
    const result = el.getHtml({}, [{ name: 'A' }])
    expect(Array.isArray(result)).toBe(true)
    expect(result[0].target).toBeDefined()
    expect(el.isNotDesign).toBe(true)
  })

  it('design-time: isNotDesign=false', () => {
    const pet = basicTablePet()
    const el = new TablePrintElement(pet, {
      columns: pet.columns,
      gridColumns: 1,
      width: 200,
      tableHeaderRepeat: 'every',
      tableFooterRepeat: 'no',
    })
    el.getHtml({})
    expect(el.isNotDesign).toBe(false)
  })
})

describe('TablePrintElement.updateDesignViewFromOptions', () => {
  it('no-op when designTarget is undefined', () => {
    const el = new TablePrintElement(basicTablePet(), {})
    expect(() => el.updateDesignViewFromOptions()).not.toThrow()
  })

  it('re-renders into existing designTarget content', () => {
    const pet = basicTablePet()
    const el = new TablePrintElement(pet, {
      columns: pet.columns,
      gridColumns: 1,
      width: 200,
      tableHeaderRepeat: 'every',
      tableFooterRepeat: 'no',
    })
    el.designTarget = el.createTarget('Order', [{ name: 'A' }], {})
    el.designPaper = {}
    expect(() => el.updateDesignViewFromOptions()).not.toThrow()
    expect(el.designTarget.find('.table-grid-row').length).toBe(1)
  })
})

describe('TablePrintElement.filterOptionItems', () => {
  it('keeps "columns" item when editable + single-column layer', () => {
    const pet = basicTablePet({ editable: true })
    pet.columns = [pet.columns[0]] // single layer
    const el = new TablePrintElement(pet, { columns: pet.columns })
    const items = [{ name: 'columns' }, { name: 'other' }]
    expect(el.filterOptionItems(items)).toBe(items)
  })

  it('strips "columns" when editable + multi-column layers', () => {
    const pet = basicTablePet({ editable: true })
    pet.columns = [pet.columns[0], { columns: [] }]
    const el = new TablePrintElement(pet, { columns: pet.columns })
    const out = el.filterOptionItems([{ name: 'columns' }, { name: 'other' }])
    expect(out.find((i) => i.name === 'columns')).toBeUndefined()
  })
})

describe('TablePrintElement.getReizeableShowPoints', () => {
  it('returns the n/s/w/e set (V1 line 6564-6566)', () => {
    const el = new TablePrintElement(basicTablePet(), {})
    expect(el.getReizeableShowPoints()).toEqual(['n', 's', 'w', 'e'])
  })
})
