/**
 * HiprintPropertyPanel.spec.ts — V3 property panel tests (P18.2).
 *
 * Verifies:
 *  - Empty / single / multi selection modes.
 *  - Input changes call canvas.updateElement with correct option keys.
 *  - Multi-select applies same patch to every selected element.
 *  - Fieldset visibility responds to elementType.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useCanvasStore } from '@hiprint-v3/stores'
import HiprintPropertyPanel from '../HiprintPropertyPanel.vue'

beforeEach(() => {
  setActivePinia(createPinia())
})

// Sprint 22c TKT-108 — text/longText now dispatch to dedicated panels.
// These existing fallback-editor tests use `tableCustomCell` as the
// stand-in non-dispatched etype with `showFont=true` so the generic
// editor's Position/Font/Align/Border/Background/Binding fieldsets render.
function seedSingleText(): void {
  const canvas = useCanvasStore()
  canvas.addPanel({ id: 'p1', width: 200, height: 200 })
  canvas.addElement('p1', {
    id: 'e1',
    tid: 'default.tableCustomCell',
    printElementType: {
      type: 'tableCustomCell',
      title: 'cell',
      field: 'name',
    },
    options: {
      left: 10,
      top: 20,
      width: 100,
      height: 30,
      fontSize: 14,
      color: '#000000',
      borderStyle: 'solid',
      borderWidth: 1,
      borderColor: '#000000',
      textAlign: 'left',
      title: 'Name',
      field: 'name',
    },
  })
  canvas.selectMultiple(['e1'])
}

describe('HiprintPropertyPanel — selection states', () => {
  it('renders PaperPropertyPanel when 0 elements selected (no panel yet → empty aside)', () => {
    const w = mount(HiprintPropertyPanel)
    // Wave 2: empty selection now dispatches to PaperPropertyPanel. With no
    // active panel seeded, PaperPropertyPanel renders nothing (render gate).
    // The orchestrator's <aside> shell stays — there must be no fallback
    // fieldsets and no "Select an element" hint.
    expect(w.find('.hiprint-paper-property-panel').exists()).toBe(false)
    expect(w.findAll('fieldset').length).toBe(0)
    w.unmount()
  })

  it('renders PaperPropertyPanel when 0 elements selected and a panel exists', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 595, height: 842, name: 'P1' })
    const w = mount(HiprintPropertyPanel)
    await w.vm.$nextTick()
    expect(w.find('.hiprint-paper-property-panel').exists()).toBe(true)
    w.unmount()
  })

  it('renders editor when single element selected', async () => {
    seedSingleText()
    const w = mount(HiprintPropertyPanel)
    await w.vm.$nextTick()
    expect(w.find('fieldset').exists()).toBe(true)
    // Should contain Position legend.
    expect(w.text().toLowerCase()).toContain('position')
    expect(w.text().toLowerCase()).toContain('font')
    w.unmount()
  })

  it('renders multi hint when many selected', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { left: 0, top: 0, width: 10, height: 10 },
    })
    canvas.addElement('p1', {
      id: 'e2',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { left: 50, top: 50, width: 10, height: 10 },
    })
    canvas.selectMultiple(['e1', 'e2'])
    const w = mount(HiprintPropertyPanel)
    await w.vm.$nextTick()
    expect(w.text()).toContain('2 elements selected')
    w.unmount()
  })
})

describe('HiprintPropertyPanel — position inputs', () => {
  it('changing X input patches options.left', async () => {
    seedSingleText()
    const canvas = useCanvasStore()
    const w = mount(HiprintPropertyPanel)
    await w.vm.$nextTick()
    // First number input is X.
    const inputs = w.findAll('input[type="number"]')
    expect(inputs.length).toBeGreaterThanOrEqual(4)
    const xInput = inputs[0]!
    await xInput.setValue(99)
    const el = canvas.panels[0]?.printElements[0]
    expect((el?.options as Record<string, unknown>).left).toBe(99)
    w.unmount()
  })

  it('changing W input patches options.width', async () => {
    seedSingleText()
    const canvas = useCanvasStore()
    const w = mount(HiprintPropertyPanel)
    await w.vm.$nextTick()
    const inputs = w.findAll('input[type="number"]')
    // X, Y, W, H — index 2 is width
    const wInput = inputs[2]!
    await wInput.setValue(250)
    const el = canvas.panels[0]?.printElements[0]
    expect((el?.options as Record<string, unknown>).width).toBe(250)
    w.unmount()
  })
})

describe('HiprintPropertyPanel — font inputs', () => {
  it('changing font-family select patches options.fontFamily', async () => {
    seedSingleText()
    const canvas = useCanvasStore()
    const w = mount(HiprintPropertyPanel)
    await w.vm.$nextTick()
    const fontSelect = w.find('select')
    await fontSelect.setValue('Microsoft YaHei')
    const el = canvas.panels[0]?.printElements[0]
    expect((el?.options as Record<string, unknown>).fontFamily).toBe(
      'Microsoft YaHei'
    )
    w.unmount()
  })

  it('toggling Bold patches options.fontWeight = bold then back', async () => {
    seedSingleText()
    const canvas = useCanvasStore()
    const w = mount(HiprintPropertyPanel)
    await w.vm.$nextTick()
    const buttons = w
      .findAll('button.hiprint-property-toggle')
      .filter((b) => b.text() === 'B')
    expect(buttons.length).toBe(1)
    await buttons[0]!.trigger('click')
    let el = canvas.panels[0]?.printElements[0]
    expect((el?.options as Record<string, unknown>).fontWeight).toBe('bold')
    await buttons[0]!.trigger('click')
    el = canvas.panels[0]?.printElements[0]
    expect((el?.options as Record<string, unknown>).fontWeight).toBe('normal')
    w.unmount()
  })

  it('changing color input patches options.color', async () => {
    seedSingleText()
    const canvas = useCanvasStore()
    const w = mount(HiprintPropertyPanel)
    await w.vm.$nextTick()
    const colorInputs = w.findAll('input[type="color"]')
    // First color input is font color.
    expect(colorInputs.length).toBeGreaterThanOrEqual(1)
    const colorInput = colorInputs[0]!
    ;(colorInput.element as HTMLInputElement).value = '#ff0000'
    await colorInput.trigger('input')
    const el = canvas.panels[0]?.printElements[0]
    expect((el?.options as Record<string, unknown>).color).toBe('#ff0000')
    w.unmount()
  })
})

describe('HiprintPropertyPanel — alignment + rotate', () => {
  it('clicking Center align patches options.textAlign=center', async () => {
    seedSingleText()
    const canvas = useCanvasStore()
    const w = mount(HiprintPropertyPanel)
    await w.vm.$nextTick()
    const buttons = w
      .findAll('button.hiprint-property-toggle')
      .filter((b) => b.text().includes('Center'))
    expect(buttons.length).toBeGreaterThanOrEqual(1)
    await buttons[0]!.trigger('click')
    const el = canvas.panels[0]?.printElements[0]
    expect((el?.options as Record<string, unknown>).textAlign).toBe('center')
    w.unmount()
  })

  it('range rotate updates options.rotate', async () => {
    seedSingleText()
    const canvas = useCanvasStore()
    const w = mount(HiprintPropertyPanel)
    await w.vm.$nextTick()
    const range = w.find('input[type="range"]')
    expect(range.exists()).toBe(true)
    ;(range.element as HTMLInputElement).value = '45'
    await range.trigger('input')
    const el = canvas.panels[0]?.printElements[0]
    expect((el?.options as Record<string, unknown>).rotate).toBe(45)
    w.unmount()
  })
})

describe('HiprintPropertyPanel — multi-select bulk patches', () => {
  it('changing X with 2 selected patches both', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 300, height: 300 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { left: 10, top: 0, width: 10, height: 10 },
    })
    canvas.addElement('p1', {
      id: 'e2',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { left: 20, top: 0, width: 10, height: 10 },
    })
    canvas.selectMultiple(['e1', 'e2'])
    const w = mount(HiprintPropertyPanel)
    await w.vm.$nextTick()
    const inputs = w.findAll('input[type="number"]')
    const xInput = inputs[0]!
    await xInput.setValue(123)
    const e1 = canvas.panels[0]?.printElements.find((e) => e.id === 'e1')
    const e2 = canvas.panels[0]?.printElements.find((e) => e.id === 'e2')
    expect((e1?.options as Record<string, unknown>).left).toBe(123)
    expect((e2?.options as Record<string, unknown>).left).toBe(123)
    w.unmount()
  })
})

describe('HiprintPropertyPanel — binding (single only)', () => {
  it('Binding fieldset not shown when many selected', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 300, height: 300 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { left: 0, top: 0 },
    })
    canvas.addElement('p1', {
      id: 'e2',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { left: 0, top: 0 },
    })
    canvas.selectMultiple(['e1', 'e2'])
    const w = mount(HiprintPropertyPanel)
    await w.vm.$nextTick()
    // No "Title" text input expected in multi mode.
    expect(w.text().toLowerCase()).not.toContain('binding')
    w.unmount()
  })

  it('Title commit on blur patches options.title', async () => {
    seedSingleText()
    const canvas = useCanvasStore()
    const w = mount(HiprintPropertyPanel)
    await w.vm.$nextTick()
    const textInputs = w.findAll('input[type="text"]')
    // First text input is Title.
    const titleInput = textInputs[0]!
    await titleInput.setValue('New Title')
    await titleInput.trigger('blur')
    const el = canvas.panels[0]?.printElements[0]
    expect((el?.options as Record<string, unknown>).title).toBe('New Title')
    w.unmount()
  })

  it('Hide title checkbox toggles options.hideTitle', async () => {
    seedSingleText()
    const canvas = useCanvasStore()
    const w = mount(HiprintPropertyPanel)
    await w.vm.$nextTick()
    const checkboxes = w.findAll('input[type="checkbox"]')
    expect(checkboxes.length).toBeGreaterThanOrEqual(1)
    const hideTitleBox = checkboxes[0]!
    ;(hideTitleBox.element as HTMLInputElement).checked = true
    await hideTitleBox.trigger('change')
    const el = canvas.panels[0]?.printElements[0]
    expect((el?.options as Record<string, unknown>).hideTitle).toBe(true)
    w.unmount()
  })
})

describe('HiprintPropertyPanel — fieldset visibility by type', () => {
  it('Font fieldset hidden for non-text etypes (e.g. hline)', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.hline',
      printElementType: { type: 'hline' },
      options: { left: 0, top: 0, width: 100, height: 1 },
    })
    canvas.selectMultiple(['e1'])
    const w = mount(HiprintPropertyPanel)
    await w.vm.$nextTick()
    // Font fieldset has legend "Font"; should be absent for hline.
    const legends = w.findAll('legend').map((l) => l.text())
    expect(legends).not.toContain('Font')
    w.unmount()
  })
})

// =====================================================================
// Wave 2 Stream D — dispatch routing
// =====================================================================

function seedSingleEtype(
  type: string,
  options: Record<string, unknown> = {}
): void {
  const canvas = useCanvasStore()
  canvas.addPanel({ id: 'p1', width: 400, height: 300 })
  canvas.addElement('p1', {
    id: 'e1',
    tid: 'default.' + type,
    printElementType: { type, title: type },
    options: {
      left: 0,
      top: 0,
      width: 100,
      height: 50,
      ...options,
    },
  })
  canvas.selectMultiple(['e1'])
}

describe('HiprintPropertyPanel — dispatch (Wave 2 PP-005/007/008/010/011)', () => {
  it('renders ImagePropertyPanel for single image element', async () => {
    seedSingleEtype('image', { src: 'https://e.com/a.png' })
    const w = mount(HiprintPropertyPanel)
    await w.vm.$nextTick()
    expect(w.find('.hiprint-image-property-panel').exists()).toBe(true)
    // Fallback Position fieldset must NOT render in dispatch path.
    const legends = w.findAll('legend').map((l) => l.text())
    expect(legends).not.toContain('Position')
    w.unmount()
  })

  it('renders BarcodePropertyPanel for single barcode element', async () => {
    // Sprint 22a-r TKT-002: panel uses `barcodeType` (renderer key, lowercase
    // bwip-js bcid) instead of legacy `format` (UPPERCASE JsBarcode vocab).
    seedSingleEtype('barcode', { barcodeType: 'code128' })
    const w = mount(HiprintPropertyPanel)
    await w.vm.$nextTick()
    expect(w.find('.hiprint-barcode-property-panel').exists()).toBe(true)
    expect(w.find('select.bc-barcode-type').exists()).toBe(true)
    w.unmount()
  })

  it('renders QrcodePropertyPanel for single qrcode element', async () => {
    // Sprint 22a-r TKT-003: panel uses `qrCodeLevel` int (renderer key) instead
    // of legacy string `errorCorrectionLevel`.
    seedSingleEtype('qrcode', { qrCodeLevel: 0 })
    const w = mount(HiprintPropertyPanel)
    await w.vm.$nextTick()
    expect(w.find('.hiprint-qrcode-property-panel').exists()).toBe(true)
    w.unmount()
  })

  it('renders ShapePropertyPanel for hline', async () => {
    seedSingleEtype('hline', { strokeWidth: 1 })
    const w = mount(HiprintPropertyPanel)
    await w.vm.$nextTick()
    expect(w.find('.hiprint-shape-property-panel').exists()).toBe(true)
    // hline has no fill fieldset.
    expect(w.find('input.shape-fill-color').exists()).toBe(false)
    w.unmount()
  })

  it('renders ShapePropertyPanel with fill+radius for rect', async () => {
    seedSingleEtype('rect', { strokeWidth: 1, fillColor: '#fff' })
    const w = mount(HiprintPropertyPanel)
    await w.vm.$nextTick()
    expect(w.find('.hiprint-shape-property-panel').exists()).toBe(true)
    expect(w.find('input.shape-fill-color').exists()).toBe(true)
    expect(w.find('input.shape-border-radius').exists()).toBe(true)
    w.unmount()
  })

  it('renders HtmlPropertyPanel for single html element', async () => {
    seedSingleEtype('html', { content: '<b>x</b>' })
    const w = mount(HiprintPropertyPanel)
    await w.vm.$nextTick()
    expect(w.find('.hiprint-html-property-panel').exists()).toBe(true)
    expect(w.find('textarea.html-content').exists()).toBe(true)
    w.unmount()
  })

  it('renders TablePropertyPanel for single table element', async () => {
    // TKT-010: only the canonical 'table' etype dispatches to TablePropertyPanel.
    // See `docs/V3-PARITY-MATRIX/06-table.md` VIOLATION 1.1 for the audit trail.
    seedSingleEtype('table', {
      columns: [[{ title: 'A', field: 'a', width: 100, align: 'left' }]],
    })
    const w = mount(HiprintPropertyPanel)
    await w.vm.$nextTick()
    expect(w.find('.hiprint-table-property-panel').exists()).toBe(true)
    w.unmount()
  })

  it('does NOT dispatch to TablePropertyPanel for legacy tableCustom etype (TKT-010 rollback)', async () => {
    // TKT-010 rollback regression guard. V1 bundle 10737-10739 throws on
    // the legacy etype name; the V3 dispatcher must fall through to the
    // generic editor rather than treating it as a known table-like etype.
    seedSingleEtype('tableCustom', {
      columns: [[{ title: 'A', field: 'a', width: 100, align: 'left' }]],
    })
    const w = mount(HiprintPropertyPanel)
    await w.vm.$nextTick()
    expect(w.find('.hiprint-table-property-panel').exists()).toBe(false)
    // Generic fallback (Position fieldset) renders instead.
    const legends = w.findAll('legend').map((l) => l.text())
    expect(legends).toContain('Position')
    w.unmount()
  })

  // Sprint 22c TKT-108: text/longText now dispatch to dedicated panels
  // (TextPropertyPanel / LongTextPropertyPanel) instead of falling through
  // to the generic editor. Multi-select still uses the generic fallback.
  it('renders TextPropertyPanel for single text element (Sprint 22c TKT-108)', async () => {
    seedSingleEtype('text', { fontSize: 14 })
    const w = mount(HiprintPropertyPanel)
    await w.vm.$nextTick()
    expect(w.find('.hiprint-text-property-panel').exists()).toBe(true)
    expect(w.find('input.tx-left').exists()).toBe(true)
    expect(w.find('select.tx-font-family').exists()).toBe(true)
    expect(w.find('select.tx-text-type').exists()).toBe(true)
    w.unmount()
  })

  it('renders LongTextPropertyPanel for single longText element (Sprint 22c TKT-108)', async () => {
    seedSingleEtype('longText', { fontSize: 12, lineHeight: 15 })
    const w = mount(HiprintPropertyPanel)
    await w.vm.$nextTick()
    expect(w.find('.hiprint-longtext-property-panel').exists()).toBe(true)
    expect(w.find('input.lt-indent').exists()).toBe(true)
    expect(w.find('input.lt-min-height').exists()).toBe(true)
    expect(w.find('select.lt-long-text-paginate').exists()).toBe(true)
    expect(w.find('.hiprint-text-property-panel').exists()).toBe(false)
  })

  it('text/longText multi-select still uses the generic fallback (Sprint 22c TKT-108)', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 400, height: 300 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { left: 0, top: 0, width: 100, height: 20 },
    })
    canvas.addElement('p1', {
      id: 'e2',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { left: 50, top: 0, width: 100, height: 20 },
    })
    canvas.selectMultiple(['e1', 'e2'])
    const w = mount(HiprintPropertyPanel)
    await w.vm.$nextTick()
    expect(w.find('.hiprint-text-property-panel').exists()).toBe(false)
    expect(w.find('.hiprint-longtext-property-panel').exists()).toBe(false)
    expect(w.text()).toContain('2 elements selected')
    const legends = w.findAll('legend').map((l) => l.text())
    expect(legends).toContain('Position')
    w.unmount()
  })

  it('multi-select uses generic editor even for dispatched etypes', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 400, height: 300 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.image',
      printElementType: { type: 'image' },
      options: { left: 0, top: 0, width: 50, height: 50 },
    })
    canvas.addElement('p1', {
      id: 'e2',
      tid: 't.image',
      printElementType: { type: 'image' },
      options: { left: 60, top: 0, width: 50, height: 50 },
    })
    canvas.selectMultiple(['e1', 'e2'])
    const w = mount(HiprintPropertyPanel)
    await w.vm.$nextTick()
    // Per-etype panel must NOT render in multi-select.
    expect(w.find('.hiprint-image-property-panel').exists()).toBe(false)
    // Generic fallback path renders (multi hint + Position fieldset present).
    expect(w.text()).toContain('2 elements selected')
    const legends = w.findAll('legend').map((l) => l.text())
    expect(legends).toContain('Position')
    w.unmount()
  })
})
