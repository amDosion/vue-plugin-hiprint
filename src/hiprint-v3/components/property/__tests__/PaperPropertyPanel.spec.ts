/**
 * PaperPropertyPanel.spec.ts — V3 paper property panel tests (PP-101 ~ PP-113).
 *
 * Verifies:
 *  - Render gate on activePanel (null vs present).
 *  - Paper presets compute width/height in pt (A4 ≈ 595×842 pt).
 *  - mm↔pt conversion on width/height inputs.
 *  - Orientation toggle swaps width/height in-place.
 *  - Margins / header / footer write to nested + flat panel keys (pt-stored).
 *  - Background color, watermark text, page number show/position, skip
 *    empty pages, and panel name go through canvas.updatePanel().
 *  - Grid + ruler visibility toggle canvas store flags (no history push).
 *
 * Pattern follows HiprintPropertyPanel.spec.ts (P18.2) — fresh Pinia per test.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useCanvasStore } from '@hiprint-v3/stores'
import PaperPropertyPanel from '../PaperPropertyPanel.vue'

beforeEach(() => {
  setActivePinia(createPinia())
})

function seedPanel(extra: Record<string, unknown> = {}): void {
  const canvas = useCanvasStore()
  canvas.addPanel({
    id: 'p1',
    width: 595, // ≈ A4 width in pt
    height: 842, // ≈ A4 height in pt
    paperType: 'A4',
    name: 'Sheet 1',
    ...extra,
  })
}

describe('PaperPropertyPanel — render gate', () => {
  it('renders nothing when no activePanel', () => {
    const w = mount(PaperPropertyPanel)
    expect(w.find('.hiprint-paper-property-panel').exists()).toBe(false)
    w.unmount()
  })

  it('renders fieldsets when activePanel exists', async () => {
    seedPanel()
    const w = mount(PaperPropertyPanel)
    await w.vm.$nextTick()
    expect(w.find('.hiprint-paper-property-panel').exists()).toBe(true)
    // Has the eight fieldsets we declared.
    expect(w.findAll('fieldset').length).toBe(8)
    w.unmount()
  })
})

describe('PaperPropertyPanel — PP-101 preset', () => {
  it('preset A4 sets width/height to A4 in pt (~595×842)', async () => {
    seedPanel({ width: 100, height: 100, paperType: 'custom' })
    const canvas = useCanvasStore()
    const w = mount(PaperPropertyPanel)
    await w.vm.$nextTick()
    const select = w.find('select')
    await select.setValue('A4')
    const p = canvas.activePanel!
    // A4 = 210mm × 297mm → 595.275... × 841.889... pt
    expect(p.width).toBeGreaterThan(594)
    expect(p.width).toBeLessThan(596)
    expect(p.height).toBeGreaterThan(840)
    expect(p.height).toBeLessThan(843)
    expect(p.paperType).toBe('A4')
    w.unmount()
  })

  it('preset Custom sets paperType=custom (no width/height change)', async () => {
    seedPanel({ width: 500, height: 700 })
    const canvas = useCanvasStore()
    const w = mount(PaperPropertyPanel)
    await w.vm.$nextTick()
    await w.find('select').setValue('Custom')
    const p = canvas.activePanel!
    expect(p.paperType).toBe('custom')
    // Dimensions untouched for Custom.
    expect(p.width).toBe(500)
    expect(p.height).toBe(700)
    w.unmount()
  })
})

describe('PaperPropertyPanel — PP-102 dimensions', () => {
  it('width input converts mm to pt', async () => {
    seedPanel()
    const canvas = useCanvasStore()
    const w = mount(PaperPropertyPanel)
    await w.vm.$nextTick()
    // Find the Width input inside the Paper fieldset's grid.
    const inputs = w.findAll('input[type="number"]')
    // Order: width, height, margin top, margin right, margin bottom, margin left, header, footer, grid size
    const widthInput = inputs[0]!
    await widthInput.setValue('100') // 100mm → ≈ 283.46 pt
    const p = canvas.activePanel!
    expect(p.width).toBeGreaterThan(283)
    expect(p.width).toBeLessThan(284)
    w.unmount()
  })
})

describe('PaperPropertyPanel — PP-103 orientation', () => {
  it('orientation toggle swaps width and height', async () => {
    seedPanel({ width: 595, height: 842 }) // portrait
    const canvas = useCanvasStore()
    const w = mount(PaperPropertyPanel)
    await w.vm.$nextTick()
    const buttons = w.findAll('button.hiprint-property-toggle')
    // Click "Landscape" (index 1)
    await buttons[1]!.trigger('click')
    const p = canvas.activePanel!
    expect(p.width).toBe(842)
    expect(p.height).toBe(595)
    w.unmount()
  })
})

describe('PaperPropertyPanel — PP-104 margins', () => {
  it('margin input writes pt-converted value to paperMargin.top', async () => {
    seedPanel()
    const canvas = useCanvasStore()
    const w = mount(PaperPropertyPanel)
    await w.vm.$nextTick()
    const inputs = w.findAll('input[type="number"]')
    // Margins are inputs[2..5]: top, right, bottom, left
    await inputs[2]!.setValue('10') // 10mm → ~28.35 pt
    const p = canvas.activePanel!
    const m = p['paperMargin'] as Record<string, number>
    expect(m).toBeDefined()
    expect(m.top).toBeGreaterThan(28)
    expect(m.top).toBeLessThan(29)
    w.unmount()
  })
})

describe('PaperPropertyPanel — PP-105/106 header & footer', () => {
  it('header height updates panel.paperHeader (pt)', async () => {
    seedPanel()
    const canvas = useCanvasStore()
    const w = mount(PaperPropertyPanel)
    await w.vm.$nextTick()
    const inputs = w.findAll('input[type="number"]')
    // Header is index 6, footer index 7
    await inputs[6]!.setValue('20') // 20mm → ~56.69 pt
    const p = canvas.activePanel!
    expect(p.paperHeader).toBeGreaterThan(56)
    expect(p.paperHeader).toBeLessThan(57)
    w.unmount()
  })

  it('footer height updates panel.paperFooter (pt)', async () => {
    seedPanel()
    const canvas = useCanvasStore()
    const w = mount(PaperPropertyPanel)
    await w.vm.$nextTick()
    const inputs = w.findAll('input[type="number"]')
    await inputs[7]!.setValue('15') // 15mm → ~42.52 pt
    const p = canvas.activePanel!
    expect(p.paperFooter).toBeGreaterThan(42)
    expect(p.paperFooter).toBeLessThan(43)
    w.unmount()
  })
})

describe('PaperPropertyPanel — PP-107 background color', () => {
  it('bg color change writes backgroundColor on panel', async () => {
    seedPanel()
    const canvas = useCanvasStore()
    const w = mount(PaperPropertyPanel)
    await w.vm.$nextTick()
    const colorInput = w.find('input[type="color"]')
    await colorInput.setValue('#ff00aa')
    await colorInput.trigger('change')
    const p = canvas.activePanel!
    expect(p['backgroundColor']).toBe('#ff00aa')
    w.unmount()
  })
})

describe('PaperPropertyPanel — PP-108 watermark', () => {
  it('watermark text commits on blur', async () => {
    seedPanel()
    const canvas = useCanvasStore()
    const w = mount(PaperPropertyPanel)
    await w.vm.$nextTick()
    const textInputs = w.findAll('input[type="text"]')
    // Watermark text is first text input (panel name is the second)
    const wmInput = textInputs[0]!
    await wmInput.setValue('CONFIDENTIAL')
    await wmInput.trigger('blur')
    const p = canvas.activePanel!
    const wm = p['watermark'] as Record<string, unknown>
    expect(wm).toBeDefined()
    expect(wm.text).toBe('CONFIDENTIAL')
    w.unmount()
  })
})

describe('PaperPropertyPanel — PP-109/110 grid & ruler', () => {
  it('grid toggle flips canvas.gridVisible', async () => {
    seedPanel()
    const canvas = useCanvasStore()
    const before = canvas.gridVisible
    const w = mount(PaperPropertyPanel)
    await w.vm.$nextTick()
    const checkboxes = w.findAll('input[type="checkbox"]')
    // First checkbox is the grid toggle.
    await checkboxes[0]!.setValue(!before)
    expect(canvas.gridVisible).toBe(!before)
    w.unmount()
  })

  it('ruler toggle flips canvas.rulerVisible', async () => {
    seedPanel()
    const canvas = useCanvasStore()
    const before = canvas.rulerVisible
    const w = mount(PaperPropertyPanel)
    await w.vm.$nextTick()
    const checkboxes = w.findAll('input[type="checkbox"]')
    // Second checkbox is the ruler toggle (after grid).
    await checkboxes[1]!.setValue(!before)
    expect(canvas.rulerVisible).toBe(!before)
    w.unmount()
  })
})

describe('PaperPropertyPanel — PP-111 page numbering', () => {
  it('page number show toggle updates pageNumber.show', async () => {
    seedPanel()
    const canvas = useCanvasStore()
    const w = mount(PaperPropertyPanel)
    await w.vm.$nextTick()
    const checkboxes = w.findAll('input[type="checkbox"]')
    // Third checkbox is the page-number toggle (after grid + ruler).
    await checkboxes[2]!.setValue(true)
    const p = canvas.activePanel!
    const pn = p['pageNumber'] as Record<string, unknown>
    expect(pn.show).toBe(true)
    w.unmount()
  })

  it('page number position select updates pageNumber.position', async () => {
    seedPanel()
    const canvas = useCanvasStore()
    const w = mount(PaperPropertyPanel)
    await w.vm.$nextTick()
    const selects = w.findAll('select')
    // 0: preset, 1: page-number position
    await selects[1]!.setValue('top-right')
    const p = canvas.activePanel!
    const pn = p['pageNumber'] as Record<string, unknown>
    expect(pn.position).toBe('top-right')
    w.unmount()
  })
})

describe('PaperPropertyPanel — PP-112 skip empty pages', () => {
  it('skip empty pages toggle updates skipEmptyPages', async () => {
    seedPanel()
    const canvas = useCanvasStore()
    const w = mount(PaperPropertyPanel)
    await w.vm.$nextTick()
    const checkboxes = w.findAll('input[type="checkbox"]')
    // Fourth checkbox: skip empty pages (after grid, ruler, page-number).
    await checkboxes[3]!.setValue(true)
    const p = canvas.activePanel!
    expect(p['skipEmptyPages']).toBe(true)
    w.unmount()
  })
})

describe('PaperPropertyPanel — PP-113 panel name', () => {
  it('panel name commit updates panel.name', async () => {
    seedPanel({ name: 'Sheet 1' })
    const canvas = useCanvasStore()
    const w = mount(PaperPropertyPanel)
    await w.vm.$nextTick()
    const textInputs = w.findAll('input[type="text"]')
    // Panel name is the second text input (watermark is the first).
    const nameInput = textInputs[1]!
    await nameInput.setValue('Invoice page')
    await nameInput.trigger('blur')
    const p = canvas.activePanel!
    expect(p.name).toBe('Invoice page')
    w.unmount()
  })
})
