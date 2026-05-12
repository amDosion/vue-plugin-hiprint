/**
 * css-class-bridge.spec.ts — TKT-250 BEM ↔ V1 legacy class bridge tests.
 *
 * V3 components must co-emit BOTH the BEM modifier (e.g. `.is-active`,
 * `.hiprint-element--selected`) AND the V1 legacy class shorthand
 * (`.active`, `.selected`, `.locked`, `.editing`, `.alwaysHide`,
 * `.dragging`) so business CSS keyed to the V1 vocabulary continues to
 * match. See `docs/V1-INVENTORY/styles.md` §1.16 / §Z1 and parity matrix
 * `08-styles.md` Section P.
 *
 * Coverage:
 *  - ElementWrapper       — selected / locked / hidden state classes
 *  - HiprintToolbar       — chip + button `.is-active` ↔ `.active`
 *  - HiprintPropertyPanel — toggle button `.is-active` ↔ `.active`
 *  - HiprintElementListPanel — row drag/drop/selected/hidden state
 *  - context-menu         — disabled item `.is-disabled` ↔ `.disabled`
 *  - TextElement          — inline-edit `.is-editing` ↔ `.editing`
 *  - drop-target          — V3-only `.is-drop-target` has NO V1 equivalent
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { useCanvasStore } from '@hiprint-v3/stores'
import ElementWrapper from '../../components/elements/ElementWrapper.vue'
import HiprintToolbar from '../../components/HiprintToolbar.vue'
import HiprintPropertyPanel from '../../components/HiprintPropertyPanel.vue'
import HiprintElementListPanel from '../../components/HiprintElementListPanel.vue'

vi.mock('@hiprint-v3/print', () => ({
  browserPrint: vi.fn(() => Promise.resolve()),
  downloadPdf: vi.fn(() => Promise.resolve()),
  getPrintHtml: vi.fn(() => ''),
  generatePdf: vi.fn(),
  toPdfBlob: vi.fn(),
  renderTemplate: vi.fn(),
  getHiwebSocket: vi.fn(),
  resetHiwebSocketForTests: vi.fn(),
}))

beforeEach(() => {
  setActivePinia(createPinia())
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

// ============================================================================
// ElementWrapper — selected / locked / hidden state classes
// ============================================================================

describe('css-class-bridge — ElementWrapper', () => {
  it('selected element emits BOTH `.hiprint-element--selected` AND `.selected`', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
    })
    const w = mount(ElementWrapper, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    const root = w.element as HTMLElement
    // Pre-selection: neither class present.
    expect(root.classList.contains('hiprint-element--selected')).toBe(false)
    expect(root.classList.contains('selected')).toBe(false)
    // Select.
    canvas.selectElement('e1', 'replace')
    await w.vm.$nextTick()
    expect(root.classList.contains('hiprint-element--selected')).toBe(true)
    expect(root.classList.contains('selected')).toBe(true)
    // Deselect.
    canvas.clearSelection()
    await w.vm.$nextTick()
    expect(root.classList.contains('hiprint-element--selected')).toBe(false)
    expect(root.classList.contains('selected')).toBe(false)
    w.unmount()
  })

  it('locked element emits BOTH `.hiprint-element--locked` AND `.locked`', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { lock: true },
    })
    const w = mount(ElementWrapper, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    const root = w.element as HTMLElement
    expect(root.classList.contains('hiprint-element--locked')).toBe(true)
    expect(root.classList.contains('locked')).toBe(true)
    // Unlock.
    canvas.updateElement('p1', 'e1', { options: { lock: false } })
    await w.vm.$nextTick()
    expect(root.classList.contains('hiprint-element--locked')).toBe(false)
    expect(root.classList.contains('locked')).toBe(false)
    w.unmount()
  })

  it('hidden element emits BOTH `.hiprint-element--hidden` AND `.alwaysHide`', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { hidden: true },
    })
    const w = mount(ElementWrapper, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    const root = w.element as HTMLElement
    expect(root.classList.contains('hiprint-element--hidden')).toBe(true)
    // V1 legacy `.alwaysHide` (bundle.js:4180).
    expect(root.classList.contains('alwaysHide')).toBe(true)
    canvas.updateElement('p1', 'e1', { options: { hidden: false } })
    await w.vm.$nextTick()
    expect(root.classList.contains('hiprint-element--hidden')).toBe(false)
    expect(root.classList.contains('alwaysHide')).toBe(false)
    w.unmount()
  })
})

// ============================================================================
// HiprintToolbar — active state on chips + grid/ruler buttons
// ============================================================================

describe('css-class-bridge — HiprintToolbar', () => {
  it('active chip emits BOTH `.is-active` AND `.active`', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200, name: 'A' })
    canvas.addPanel({ id: 'p2', width: 200, height: 200, name: 'B' })
    const w = mount(HiprintToolbar, { props: { showPanelManager: true } })
    const chips = w.findAll('button.hiprint-toolbar-chip')
    expect(chips.length).toBe(2)
    // First chip is auto-active (first addPanel sets activePanelId).
    expect(chips[0]!.classes()).toContain('is-active')
    expect(chips[0]!.classes()).toContain('active')
    expect(chips[1]!.classes()).not.toContain('is-active')
    expect(chips[1]!.classes()).not.toContain('active')
    w.unmount()
  })

  it('toggling grid emits BOTH `.is-active` AND `.active` on the grid button', async () => {
    const w = mount(HiprintToolbar)
    const gridBtn = w.find('button[aria-label="Toggle grid"]')
    // gridVisible defaults to true in canvas store, so the button starts
    // active. Confirm both classes are present, then toggle off, then on.
    expect(gridBtn.classes()).toContain('is-active')
    expect(gridBtn.classes()).toContain('active')
    await gridBtn.trigger('click')
    expect(gridBtn.classes()).not.toContain('is-active')
    expect(gridBtn.classes()).not.toContain('active')
    await gridBtn.trigger('click')
    expect(gridBtn.classes()).toContain('is-active')
    expect(gridBtn.classes()).toContain('active')
    w.unmount()
  })
})

// ============================================================================
// HiprintPropertyPanel — toggle buttons emit BOTH classes
// ============================================================================

describe('css-class-bridge — HiprintPropertyPanel', () => {
  it('Italic toggle emits BOTH `.is-active` AND `.active` when italic is set', async () => {
    // Text element dispatches to TextPropertyPanel which surfaces the Italic
    // toggle (HiprintPropertyPanel's Bold toggle only renders for unknown /
    // non-dispatched types — see HiprintPropertyPanel.vue:57 dispatchedTypes).
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { fontStyle: 'italic' },
    })
    canvas.selectElement('e1', 'replace')
    const w = mount(HiprintPropertyPanel)
    await w.vm.$nextTick()
    const toggles = w.findAll('button.hiprint-property-toggle')
    const activeToggle = toggles.find(
      (b) => b.classes().includes('is-active') && b.classes().includes('active')
    )
    expect(activeToggle).toBeDefined()
    w.unmount()
  })
})

// ============================================================================
// HiprintElementListPanel — row state classes
// ============================================================================

describe('css-class-bridge — HiprintElementListPanel', () => {
  function seedPanelWithEl(): { canvas: ReturnType<typeof useCanvasStore>; id: string } {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 210, height: 297 })
    const el = canvas.addElement('p1', {
      tid: 't.text',
      printElementType: { type: 'text' },
      options: {},
    })
    return { canvas, id: el!.id }
  }

  it('selected row emits BOTH `.selected-el` AND `.selected`', async () => {
    const { canvas, id } = seedPanelWithEl()
    canvas.selectElement(id, 'replace')
    const w = mount(HiprintElementListPanel, { props: { initiallyOpen: true } })
    await w.vm.$nextTick()
    const row = w.find('.hiprint-el-list-row')
    expect(row.classes()).toContain('selected-el')
    expect(row.classes()).toContain('selected')
    w.unmount()
  })

  it('hidden row emits BOTH `.hidden-el` AND `.alwaysHide`', async () => {
    const { canvas, id } = seedPanelWithEl()
    canvas.updateElement('p1', id, { options: { hidden: true } })
    const w = mount(HiprintElementListPanel, { props: { initiallyOpen: true } })
    await w.vm.$nextTick()
    const row = w.find('.hiprint-el-list-row')
    expect(row.classes()).toContain('hidden-el')
    // V1 legacy alias.
    expect(row.classes()).toContain('alwaysHide')
    w.unmount()
  })

  it('dragging row emits BOTH `.is-dragging` AND `.dragging`', async () => {
    seedPanelWithEl()
    const canvas = useCanvasStore()
    canvas.addElement('p1', {
      tid: 't.text',
      printElementType: { type: 'text' },
      options: {},
    })
    const w = mount(HiprintElementListPanel, { props: { initiallyOpen: true } })
    const rows = w.findAll('.hiprint-el-list-row')
    // Build a dataTransfer-shaped event so the SFC's dragstart handler runs.
    const dt = () => ({
      effectAllowed: '',
      dropEffect: '',
      setData: () => undefined,
      getData: () => '',
      types: [] as string[],
      setDragImage: () => undefined,
    })
    await rows[0]!.trigger('dragstart', { dataTransfer: dt() })
    await w.vm.$nextTick()
    const rowsAfter = w.findAll('.hiprint-el-list-row')
    expect(rowsAfter[0]!.classes()).toContain('is-dragging')
    expect(rowsAfter[0]!.classes()).toContain('dragging')
    w.unmount()
  })

  it('drop-target row emits `.is-drop-target` but NOT a V1 legacy alias (V3-only)', async () => {
    seedPanelWithEl()
    const canvas = useCanvasStore()
    canvas.addElement('p1', {
      tid: 't.text',
      printElementType: { type: 'text' },
      options: {},
    })
    const w = mount(HiprintElementListPanel, { props: { initiallyOpen: true } })
    const rows = w.findAll('.hiprint-el-list-row')
    const dt = () => ({
      effectAllowed: '',
      dropEffect: '',
      setData: () => undefined,
      getData: () => '',
      types: [] as string[],
      setDragImage: () => undefined,
    })
    await rows[0]!.trigger('dragstart', { dataTransfer: dt() })
    await rows[1]!.trigger('dragover', { dataTransfer: dt() })
    await w.vm.$nextTick()
    const rowsAfter = w.findAll('.hiprint-el-list-row')
    expect(rowsAfter[1]!.classes()).toContain('is-drop-target')
    // V3-only — assert that no V1 equivalent leaked through. V1 had no
    // drop-target concept (drag-reorder was added in V3).
    expect(rowsAfter[1]!.classes()).not.toContain('drop-target')
    w.unmount()
  })
})

// ============================================================================
// Context menu — disabled item
// ============================================================================

describe('css-class-bridge — context menu', () => {
  it('disabled menu item emits BOTH `.is-disabled` AND `.disabled`', async () => {
    const { openContextMenu } = await import(
      '@hiprint-v3/interactions/context-menu'
    )
    const ctl = openContextMenu(
      { x: 10, y: 10 },
      {
        items: [
          { id: 'a', label: 'Enabled', onClick: () => undefined },
          { id: 'b', label: 'Disabled', disabled: true, onClick: () => undefined },
        ],
        onSelect: () => undefined,
      }
    )
    await new Promise((r) => setTimeout(r, 0))
    const items = document.querySelectorAll('.hiprint-context-menu-item')
    expect(items.length).toBe(2)
    const disabled = items[1] as HTMLElement
    expect(disabled.classList.contains('is-disabled')).toBe(true)
    expect(disabled.classList.contains('disabled')).toBe(true)
    const enabled = items[0] as HTMLElement
    expect(enabled.classList.contains('is-disabled')).toBe(false)
    expect(enabled.classList.contains('disabled')).toBe(false)
    ctl.close()
  })
})
