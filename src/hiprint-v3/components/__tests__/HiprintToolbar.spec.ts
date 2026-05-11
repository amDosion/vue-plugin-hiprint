/**
 * HiprintToolbar.spec.ts — V3 toolbar component tests (P18.2).
 *
 * Verifies button-to-store wiring + override behavior + accessibility.
 *
 * print/pdf modules are mocked so tests don't exercise the real DOM print
 * pipeline (already covered by their own specs).
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

import { browserPrint, downloadPdf } from '@hiprint-v3/print'
import {
  useCanvasStore,
  useHistoryStore,
  useTemplateStore,
} from '@hiprint-v3/stores'
import HiprintToolbar from '../HiprintToolbar.vue'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(browserPrint).mockClear()
  vi.mocked(downloadPdf).mockClear()
})

describe('HiprintToolbar — render', () => {
  it('renders with toolbar role and all default buttons', () => {
    const w = mount(HiprintToolbar)
    const toolbar = w.find('[role="toolbar"]')
    expect(toolbar.exists()).toBe(true)
    // 22 default buttons (some implemented as label/select). Confirm
    // a handful of the key ones by aria-label.
    expect(w.find('button[aria-label="Undo"]').exists()).toBe(true)
    expect(w.find('button[aria-label="Redo"]').exists()).toBe(true)
    expect(w.find('button[aria-label="Save"]').exists()).toBe(true)
    expect(w.find('button[aria-label="Print"]').exists()).toBe(true)
    expect(w.find('button[aria-label="Download PDF"]').exists()).toBe(true)
    expect(w.find('button[aria-label="Add panel"]').exists()).toBe(true)
    expect(w.find('button[aria-label="Remove panel"]').exists()).toBe(true)
    expect(w.find('button[aria-label="Zoom in"]').exists()).toBe(true)
    w.unmount()
  })

  it('subset via buttons prop hides others', () => {
    const w = mount(HiprintToolbar, { props: { buttons: ['undo', 'save'] } })
    expect(w.find('button[aria-label="Undo"]').exists()).toBe(true)
    expect(w.find('button[aria-label="Save"]').exists()).toBe(true)
    expect(w.find('button[aria-label="Redo"]').exists()).toBe(false)
    expect(w.find('button[aria-label="Print"]').exists()).toBe(false)
    w.unmount()
  })
})

describe('HiprintToolbar — undo/redo disabled state', () => {
  it('Undo + Redo disabled when no history', () => {
    const w = mount(HiprintToolbar)
    const undoBtn = w.find('button[aria-label="Undo"]')
    const redoBtn = w.find('button[aria-label="Redo"]')
    expect((undoBtn.element as HTMLButtonElement).disabled).toBe(true)
    expect((redoBtn.element as HTMLButtonElement).disabled).toBe(true)
    w.unmount()
  })

  it('Undo enabled after pushSnapshot then mutation', async () => {
    const canvas = useCanvasStore()
    const history = useHistoryStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    history.pushSnapshot()
    canvas.addElement('p1', { id: 'e1', tid: 't.text', options: {} })
    history.pushSnapshot()
    const w = mount(HiprintToolbar)
    await w.vm.$nextTick()
    const undoBtn = w.find('button[aria-label="Undo"]')
    expect((undoBtn.element as HTMLButtonElement).disabled).toBe(false)
    w.unmount()
  })
})

describe('HiprintToolbar — store-action wiring', () => {
  it('Save click calls template.save when no onSave prop', async () => {
    const tpl = useTemplateStore()
    const spy = vi.spyOn(tpl, 'save')
    const w = mount(HiprintToolbar)
    await w.find('button[aria-label="Save"]').trigger('click')
    expect(spy).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('Save click prefers saveHandler override + emits save', async () => {
    const tpl = useTemplateStore()
    const spy = vi.spyOn(tpl, 'save')
    const saveHandler = vi.fn()
    const w = mount(HiprintToolbar, { props: { saveHandler } })
    await w.find('button[aria-label="Save"]').trigger('click')
    expect(saveHandler).toHaveBeenCalledTimes(1)
    expect(spy).not.toHaveBeenCalled()
    expect(w.emitted('save')).toBeTruthy()
    w.unmount()
  })

  it('Print click calls browserPrint with current json', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    const w = mount(HiprintToolbar)
    await w.find('button[aria-label="Print"]').trigger('click')
    expect(vi.mocked(browserPrint)).toHaveBeenCalledTimes(1)
    const firstCall = vi.mocked(browserPrint).mock.calls[0]
    expect(firstCall?.[0]).toMatchObject({
      panels: expect.any(Array),
    })
    w.unmount()
  })

  it('Print click prefers printHandler override', async () => {
    const printHandler = vi.fn()
    const w = mount(HiprintToolbar, { props: { printHandler } })
    await w.find('button[aria-label="Print"]').trigger('click')
    expect(printHandler).toHaveBeenCalledTimes(1)
    expect(vi.mocked(browserPrint)).not.toHaveBeenCalled()
    w.unmount()
  })

  it('PDF click calls downloadPdf', async () => {
    const w = mount(HiprintToolbar)
    await w.find('button[aria-label="Download PDF"]').trigger('click')
    expect(vi.mocked(downloadPdf)).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('Add panel adds a panel and emits addPanel', async () => {
    const canvas = useCanvasStore()
    expect(canvas.panels.length).toBe(0)
    const w = mount(HiprintToolbar)
    await w.find('button[aria-label="Add panel"]').trigger('click')
    expect(canvas.panels.length).toBe(1)
    expect(w.emitted('addPanel')).toBeTruthy()
    w.unmount()
  })

  it('Remove panel disabled when only 1 panel', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    const w = mount(HiprintToolbar)
    await w.vm.$nextTick()
    const btn = w.find('button[aria-label="Remove panel"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
    w.unmount()
  })

  it('Remove panel works when 2+ panels exist', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addPanel({ id: 'p2', width: 200, height: 200 })
    expect(canvas.panels.length).toBe(2)
    const w = mount(HiprintToolbar)
    await w.vm.$nextTick()
    await w.find('button[aria-label="Remove panel"]').trigger('click')
    expect(canvas.panels.length).toBe(1)
    expect(w.emitted('removePanel')).toBeTruthy()
    w.unmount()
  })

  it('Zoom in / out updates canvas.scale and emits scaleChange', async () => {
    const canvas = useCanvasStore()
    canvas.setScale(1)
    const w = mount(HiprintToolbar)
    await w.find('button[aria-label="Zoom in"]').trigger('click')
    expect(canvas.scale).toBeGreaterThan(1)
    expect(w.emitted('scaleChange')).toBeTruthy()
    await w.find('button[aria-label="Zoom out"]').trigger('click')
    expect(canvas.scale).toBeLessThan(1.05)
    await w.find('button[aria-label="Reset zoom"]').trigger('click')
    expect(canvas.scale).toBe(1)
    w.unmount()
  })

  it('paper select change rewrites active panel width/height + emits paperChange', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 100, height: 100 })
    const w = mount(HiprintToolbar)
    const select = w.find('select[aria-label="Paper size"]')
    expect(select.exists()).toBe(true)
    await select.setValue('A5')
    const p = canvas.panels[0]
    expect(p?.width).toBe(148)
    expect(p?.height).toBe(210)
    expect(w.emitted('paperChange')).toBeTruthy()
    w.unmount()
  })

  it('rotate swaps active panel width and height', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 210, height: 297 })
    const w = mount(HiprintToolbar)
    await w.find('button[aria-label="Rotate paper"]').trigger('click')
    const p = canvas.panels[0]
    expect(p?.width).toBe(297)
    expect(p?.height).toBe(210)
    expect(w.emitted('rotate')).toBeTruthy()
    w.unmount()
  })

  it('grid + ruler toggle buttons flip aria-pressed and emit', async () => {
    const w = mount(HiprintToolbar)
    const grid = w.find('button[aria-label="Toggle grid"]')
    expect(grid.attributes('aria-pressed')).toBe('true')
    await grid.trigger('click')
    expect(grid.attributes('aria-pressed')).toBe('false')
    expect(w.emitted('toggleGrid')).toBeTruthy()
    const ruler = w.find('button[aria-label="Toggle ruler"]')
    await ruler.trigger('click')
    expect(w.emitted('toggleRuler')).toBeTruthy()
    w.unmount()
  })

  it('align buttons disabled when no selection', () => {
    const w = mount(HiprintToolbar)
    const left = w.find('button[aria-label="Align left"]')
    expect((left.element as HTMLButtonElement).disabled).toBe(true)
    w.unmount()
  })

  it('align left snaps selected elements to leftmost left value', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 300, height: 300 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      options: { left: 50, top: 10, width: 30, height: 10 },
    })
    canvas.addElement('p1', {
      id: 'e2',
      tid: 't.text',
      options: { left: 80, top: 30, width: 30, height: 10 },
    })
    canvas.selectMultiple(['e1', 'e2'])
    const w = mount(HiprintToolbar)
    await w.vm.$nextTick()
    await w.find('button[aria-label="Align left"]').trigger('click')
    const p = canvas.panels[0]
    const e1 = p?.printElements.find((e) => e.id === 'e1')
    const e2 = p?.printElements.find((e) => e.id === 'e2')
    expect((e1?.options as Record<string, unknown>).left).toBe(50)
    expect((e2?.options as Record<string, unknown>).left).toBe(50)
    expect(w.emitted('align')).toBeTruthy()
    w.unmount()
  })

  it('Clear button calls tpl.clear and emits clear', async () => {
    const tpl = useTemplateStore()
    const spy = vi.spyOn(tpl, 'clear')
    const w = mount(HiprintToolbar)
    await w.find('button[aria-label="Clear template"]').trigger('click')
    expect(spy).toHaveBeenCalled()
    expect(w.emitted('clear')).toBeTruthy()
    w.unmount()
  })

  it('Undo click triggers history.undo', async () => {
    const canvas = useCanvasStore()
    const history = useHistoryStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    history.pushSnapshot()
    canvas.addElement('p1', { id: 'e1', tid: 't.text', options: {} })
    history.pushSnapshot()
    const spy = vi.spyOn(history, 'undo')
    const w = mount(HiprintToolbar)
    await w.vm.$nextTick()
    await w.find('button[aria-label="Undo"]').trigger('click')
    expect(spy).toHaveBeenCalled()
    w.unmount()
  })
})
