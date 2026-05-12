/**
 * panel-manager-mode.spec.ts — TKT-254: `panelManagerMode` prop on the toolbar.
 *
 * V3 default keeps the Sprint 22a-r TB-003 chip switcher (one button per panel
 * with `aria-pressed`). Setting `panelManagerMode='select'` falls back to V1's
 * classic single `<select>` dropdown, useful for documents with many panels.
 *
 * These specs assert the SFC renders ONE branch only — the unused branch is
 * fully omitted from the DOM (v-if not v-show) so AT users don't see ghost
 * widgets.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

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

import { useCanvasStore } from '@hiprint-v3/stores'
import HiprintToolbar from '../HiprintToolbar.vue'

beforeEach(() => {
  setActivePinia(createPinia())
})

function seedPanels(): void {
  const canvas = useCanvasStore()
  canvas.addPanel({ id: 'p1', width: 200, height: 200, name: 'Page 1' })
  canvas.addPanel({ id: 'p2', width: 200, height: 200, name: 'Page 2' })
  canvas.addPanel({ id: 'p3', width: 200, height: 200, name: 'Page 3' })
  canvas.setActivePanel('p1')
}

describe('HiprintToolbar — panelManagerMode (TKT-254)', () => {
  it("default (mode='chips') renders one chip button per panel and no <select>", async () => {
    seedPanels()
    const w = mount(HiprintToolbar, {
      props: { showPanelManager: true },
      attachTo: document.body,
    })
    await w.vm.$nextTick()

    const chips = w.findAll('.hiprint-toolbar-chip')
    expect(chips.length).toBe(3)
    // Active chip carries aria-pressed='true'.
    expect(
      chips.some(
        (c) =>
          (c.element as HTMLButtonElement).getAttribute('aria-pressed') ===
          'true'
      )
    ).toBe(true)

    // No <select> panel switcher in chip mode.
    expect(w.find('.hiprint-toolbar-panel-select').exists()).toBe(false)
    w.unmount()
  })

  it("mode='select' renders a single <select> with one <option> per panel and no chips", async () => {
    seedPanels()
    const w = mount(HiprintToolbar, {
      props: { showPanelManager: true, panelManagerMode: 'select' },
      attachTo: document.body,
    })
    await w.vm.$nextTick()

    const sel = w.find('.hiprint-toolbar-panel-select')
    expect(sel.exists()).toBe(true)
    const options = sel.findAll('option')
    expect(options.length).toBe(3)

    // The <select>'s value matches the active panel's index (0 for p1).
    expect((sel.element as HTMLSelectElement).value).toBe('0')

    // Chips suppressed in select mode.
    expect(w.findAll('.hiprint-toolbar-chip').length).toBe(0)
    w.unmount()
  })
})
