/**
 * TablePropertyPanel-sprint22g-wave3.spec.ts — Sprint 22g wave 3 GM closeout.
 *
 * Asserts that the property panel exposes the V1 `tableColumn.supportOptions`
 * surface (column-level advanced fieldset) and the V1 Section O.1 "样式" +
 * "高级" tabs (table-level Style + Advanced fieldsets).
 *
 * Tickets closed by this spec:
 *  - TKT-386 — 8 table-level style overrides editable via panel
 *    (tableHeaderRowHeight, tableHeaderBackground, tableHeaderFontWeight,
 *     tableHeaderFontSize, tableBodyRowHeight, tableBodyFontFamily,
 *     tableBorder, autoCompletion, maxRows)
 *  - Column-level coverage (advanced fieldset): halign, vAlign, fixed,
 *    paddingLeft, paddingRight, columnId, tableTextType, formatter2, styler2,
 *    stylerHeader, renderFormatter, tableSummary, tableSummaryTitle,
 *    tableSummaryText, tableSummaryColspan, tableSummaryAlign,
 *    tableSummaryNumFormat, tableSummaryFormatter, upperCase, editor
 *
 * Strategy: real Pinia store, no mocks. Every assertion writes through the
 * canvas store so applyElementPatch + history.pushSnapshot are exercised.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useCanvasStore, type CanvasElement } from '@hiprint-v3/stores'
import TablePropertyPanel from '../TablePropertyPanel.vue'

beforeEach(() => {
  setActivePinia(createPinia())
})

function seedTable(extraOptions: Record<string, unknown> = {}): {
  canvas: ReturnType<typeof useCanvasStore>
  getElement: () => CanvasElement | undefined
} {
  const canvas = useCanvasStore()
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
      columns: [
        [
          { title: 'A', field: 'a', width: 100, align: 'left' },
          { title: 'B', field: 'b', width: 120, align: 'center' },
        ],
      ],
      ...extraOptions,
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

describe('TablePropertyPanel — Sprint 22g wave 3 table-level style fieldset', () => {
  it.each([
    ['tableHeaderRowHeight', 'input.table-header-row-height', 'number', 30],
    ['tableHeaderBackground', 'input.table-header-background', 'text', '#abcdef'],
    ['tableHeaderFontWeight', 'input.table-header-font-weight', 'text', 'bold'],
    ['tableHeaderFontSize', 'input.table-header-font-size', 'number', 14],
    ['tableBodyRowHeight', 'input.table-body-row-height', 'number', 24],
    ['tableBodyFontFamily', 'input.table-body-font-family', 'text', 'SimSun'],
  ])('%s — selector %s writes through the canvas store', async (key, sel, _kind, value) => {
    const { getElement } = seedTable()
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    const input = w.find(sel)
    expect(input.exists()).toBe(true)
    await input.setValue(value)
    expect(getOptions(getElement())[key]).toEqual(
      typeof value === 'number' ? value : String(value)
    )
    w.unmount()
  })

  it('tableBorder select writes V1 variant suffix', async () => {
    const { getElement } = seedTable()
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    const sel = w.find('select.table-border')
    expect(sel.exists()).toBe(true)
    await sel.setValue('all')
    expect(getOptions(getElement()).tableBorder).toBe('all')
    await sel.setValue('lr')
    expect(getOptions(getElement()).tableBorder).toBe('lr')
    w.unmount()
  })

  it('autoCompletion checkbox + maxRows number input commit', async () => {
    const { getElement } = seedTable()
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    const cb = w.find('input.table-auto-completion')
    expect(cb.exists()).toBe(true)
    await cb.setValue(true)
    expect(getOptions(getElement()).autoCompletion).toBe(true)
    const max = w.find('input.table-max-rows')
    await max.setValue(15)
    expect(getOptions(getElement()).maxRows).toBe(15)
    w.unmount()
  })
})

describe('TablePropertyPanel — Sprint 22g wave 3 table-level advanced fieldset', () => {
  it('groupFields textarea split into trimmed array', async () => {
    const { getElement } = seedTable()
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    const input = w.find('input.table-group-fields')
    expect(input.exists()).toBe(true)
    ;(input.element as HTMLInputElement).value = 'region, category, '
    await input.trigger('change')
    expect(getOptions(getElement()).groupFields).toEqual([
      'region',
      'category',
    ])
    w.unmount()
  })

  it('groupFormatter / groupFooterFormatter persist as raw strings', async () => {
    const { getElement } = seedTable()
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    const gh = w.find('textarea.table-group-formatter')
    const gf = w.find('textarea.table-group-footer-formatter')
    expect(gh.exists()).toBe(true)
    expect(gf.exists()).toBe(true)
    const src = 'function(){return "x"}'
    ;(gh.element as HTMLTextAreaElement).value = src
    await gh.trigger('change')
    expect(getOptions(getElement()).groupFormatter).toBe(src)
    ;(gf.element as HTMLTextAreaElement).value = src + '2'
    await gf.trigger('change')
    expect(getOptions(getElement()).groupFooterFormatter).toBe(src + '2')
    w.unmount()
  })

  it('rowStyler / rowsColumnsMerge / rowsColumnsMergeClean / groupSequenceContinue commit', async () => {
    const { getElement } = seedTable()
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    const rs = w.find('textarea.table-row-styler')
    expect(rs.exists()).toBe(true)
    ;(rs.element as HTMLTextAreaElement).value = 'function(){return {}}'
    await rs.trigger('change')
    expect(typeof getOptions(getElement()).rowStyler).toBe('string')
    const rcm = w.find('textarea.table-rows-columns-merge')
    ;(rcm.element as HTMLTextAreaElement).value = 'function(){return [1,1]}'
    await rcm.trigger('change')
    expect(typeof getOptions(getElement()).rowsColumnsMerge).toBe('string')
    const cb1 = w.find('input.table-rows-columns-merge-clean')
    await cb1.setValue(true)
    expect(getOptions(getElement()).rowsColumnsMergeClean).toBe(true)
    const cb2 = w.find('input.table-group-seq-continue')
    await cb2.setValue(true)
    expect(getOptions(getElement()).groupSequenceContinue).toBe(true)
    w.unmount()
  })
})

describe('TablePropertyPanel — Sprint 22g wave 3 column-level advanced fieldset', () => {
  async function openAdvanced(
    w: ReturnType<typeof mount<typeof TablePropertyPanel>>
  ): Promise<void> {
    // First column's advanced toggle.
    const toggles = w.findAll('.col-adv-toggle')
    expect(toggles.length).toBe(2)
    await toggles[0]!.trigger('click')
    await w.vm.$nextTick()
  }

  it('halign / vAlign selects + fixed / hide checkboxes commit', async () => {
    const { getElement } = seedTable()
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    await openAdvanced(w)
    const halign = w.find('select.col-halign')
    await halign.setValue('center')
    expect(getColumns(getElement())[0]![0]!.halign).toBe('center')
    const valign = w.find('select.col-valign')
    await valign.setValue('middle')
    expect(getColumns(getElement())[0]![0]!.vAlign).toBe('middle')
    const fixed = w.find('input.col-fixed')
    await fixed.setValue(true)
    expect(getColumns(getElement())[0]![0]!.fixed).toBe(true)
    const hide = w.find('input.col-hide')
    await hide.setValue(true)
    // hide ↔ checked: inverted, so checked === false now.
    expect(getColumns(getElement())[0]![0]!.checked).toBe(false)
    w.unmount()
  })

  it('paddingLeft / paddingRight / columnId / tableColumnHeight / qrcode level commit', async () => {
    const { getElement } = seedTable()
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    await openAdvanced(w)
    await w.find('input.col-padding-left').setValue(8)
    await w.find('input.col-padding-right').setValue(12)
    await w.find('input.col-column-id').setValue('myCol')
    await w.find('input.col-column-height').setValue(40)
    await w.find('input.col-qrcode-level').setValue(2)
    const c = getColumns(getElement())[0]![0]!
    expect(c.paddingLeft).toBe(8)
    expect(c.paddingRight).toBe(12)
    expect(c.columnId).toBe('myCol')
    expect(c.tableColumnHeight).toBe(40)
    expect(c.tableQRCodeLevel).toBe(2)
    w.unmount()
  })

  it('tableTextType / tableBarcodeMode / showCodeTitle commit', async () => {
    const { getElement } = seedTable()
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    await openAdvanced(w)
    await w.find('select.col-text-type').setValue('barcode')
    await w.find('input.col-barcode-mode').setValue('EAN13')
    await w.find('input.col-show-code-title').setValue(true)
    const c = getColumns(getElement())[0]![0]!
    expect(c.tableTextType).toBe('barcode')
    expect(c.tableBarcodeMode).toBe('EAN13')
    expect(c.showCodeTitle).toBe(true)
    w.unmount()
  })

  it('formatter2 / styler2 / stylerHeader / renderFormatter persist as raw strings', async () => {
    const { getElement } = seedTable()
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    await openAdvanced(w)
    const f2 = w.find('textarea.col-formatter2')
    ;(f2.element as HTMLTextAreaElement).value = 'function(v){return v}'
    await f2.trigger('change')
    const s2 = w.find('textarea.col-styler2')
    ;(s2.element as HTMLTextAreaElement).value = 'function(){return {color:"red"}}'
    await s2.trigger('change')
    const sh = w.find('textarea.col-styler-header')
    ;(sh.element as HTMLTextAreaElement).value = 'function(){return {}}'
    await sh.trigger('change')
    const rf = w.find('textarea.col-render-formatter')
    ;(rf.element as HTMLTextAreaElement).value = 'function(){return "<b>x</b>"}'
    await rf.trigger('change')
    const c = getColumns(getElement())[0]![0]!
    expect(typeof c.formatter2).toBe('string')
    expect(typeof c.styler2).toBe('string')
    expect(typeof c.stylerHeader).toBe('string')
    expect(typeof c.renderFormatter).toBe('string')
    w.unmount()
  })

  it('tableSummary* family + upperCase + editor commit', async () => {
    const { getElement } = seedTable()
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    await openAdvanced(w)
    await w.find('select.col-summary').setValue('sum')
    await w.find('input.col-summary-title').setValue(false)
    await w.find('input.col-summary-text').setValue('Total:')
    await w.find('input.col-summary-colspan').setValue(2)
    await w.find('select.col-summary-align').setValue('right')
    await w.find('input.col-summary-numformat').setValue(0)
    const sf = w.find('textarea.col-summary-formatter')
    ;(sf.element as HTMLTextAreaElement).value = 'function(){return 0}'
    await sf.trigger('change')
    await w.find('input.col-uppercase').setValue('4')
    await w.find('select.col-editor').setValue('number')
    const c = getColumns(getElement())[0]![0]!
    expect(c.tableSummary).toBe('sum')
    expect(c.tableSummaryTitle).toBe(false)
    expect(c.tableSummaryText).toBe('Total:')
    expect(c.tableSummaryColspan).toBe(2)
    expect(c.tableSummaryAlign).toBe('right')
    expect(c.tableSummaryNumFormat).toBe(0)
    expect(typeof c.tableSummaryFormatter).toBe('string')
    expect(c.upperCase).toBe('4')
    expect(c.editor).toBe('number')
    w.unmount()
  })

  it('column-advanced fieldset is collapsed by default and toggled by the ▸ button', async () => {
    const { getElement } = seedTable()
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    // Without clicking the toggle the advanced fieldset must be hidden
    // (v-show=false → display:none). Selecting a control inside it should
    // therefore return an element whose style.display is 'none'.
    const advFieldsetsHidden = w.findAll('.hiprint-table-col-adv')
    // Two columns → two advanced wrappers, both initially hidden.
    expect(advFieldsetsHidden.length).toBe(2)
    expect((advFieldsetsHidden[0]!.element as HTMLElement).style.display).toBe('none')
    expect((advFieldsetsHidden[1]!.element as HTMLElement).style.display).toBe('none')
    // After clicking toggle, the first one is visible (display === '').
    await w.findAll('.col-adv-toggle')[0]!.trigger('click')
    await w.vm.$nextTick()
    expect((w.findAll('.hiprint-table-col-adv')[0]!.element as HTMLElement).style.display).toBe('')
    w.unmount()
  })
})

describe('TablePropertyPanel — Sprint 22g wave 3 TKT-383 editor selector', () => {
  it('column.editor select offers 5 inline-editor types', async () => {
    const { getElement } = seedTable()
    const w = mount(TablePropertyPanel, { props: { element: getElement()! } })
    await w.vm.$nextTick()
    // Open advanced for col 0
    await w.findAll('.col-adv-toggle')[0]!.trigger('click')
    await w.vm.$nextTick()
    const sel = w.find('select.col-editor')
    expect(sel.exists()).toBe(true)
    const opts = sel.findAll('option').map((o) => (o.element as HTMLOptionElement).value)
    expect(opts).toEqual(['text', 'number', 'date', 'textarea', 'select'])
    w.unmount()
  })
})
