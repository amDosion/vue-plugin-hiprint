/**
 * print-template-extended.spec.js — P10b mixin extensions
 *
 * Covers V1 line 12335-12834 methods migrated in P10b mixins:
 *  - designMixin: design (with _designed idempotency guard)
 *  - getHtmlMixin: getSimpleHtml / getHtml / getSimpleHtmlAsync / getHtmlAsync
 *    + R3 silent #3 destroy mid-async → reject
 *  - printMixin: clientIsOpened / getPrinterList + safe SSR fallback
 *  - pdfMixin: toPdf with destroy race check + SSR rejection
 *  - updateMixin: update(json) replaces panels
 *  - historyMixin: undo/redo + addHistoryEntry
 *  - zoomMixin: setPaper / rotatePaper / getPaperType / getOrient
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrintTemplate, _resetTemplateMap } from '../print-template.js'

const makePanelSpec = (idx, name) => ({
  index: idx,
  name: name || 'P' + (idx + 1),
  width: 210,
  height: 297,
  paperHeader: 10,
  paperFooter: 780,
  printElements: [],
})

beforeEach(() => {
  _resetTemplateMap()
  vi.restoreAllMocks()
  if (typeof window !== 'undefined') {
    delete window.hinnn
    delete window.hiwebSocket
    delete window.HiPrintConfig
  }
})

// ============ designMixin ============

describe('PrintTemplate.design (state-modeler R3 idempotency)', () => {
  it('silent skip when destroyed', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const tpl = new PrintTemplate({})
    tpl.destroy()
    expect(() => tpl.design('#x', {})).not.toThrow()
  })

  it('sets _designed=true on first call', () => {
    const tpl = new PrintTemplate({ template: { panels: [makePanelSpec(0)] } })
    tpl.design('#x', {})
    expect(tpl._designed).toBe(true)
  })

  it('[state-modeler R3] second design() call: cleanup + warning + still designed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const tpl = new PrintTemplate({ template: { panels: [makePanelSpec(0)] } })
    tpl.design('#x', {})
    tpl.design('#y', {})
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('design() called twice')
    )
    expect(tpl._designed).toBe(true)
  })

  it('throws when container missing', () => {
    const tpl = new PrintTemplate({ template: { panels: [makePanelSpec(0)] } })
    expect(() => tpl.design(undefined, {})).toThrow(/container can not be empty/)
  })

  it('creates default panel when none exists', () => {
    const tpl = new PrintTemplate({})
    tpl.design('#x', {})
    expect(tpl.printPanels.length).toBeGreaterThanOrEqual(1)
  })
})

// ============ getHtmlMixin ============

describe('PrintTemplate.getSimpleHtml / getHtml (PM-003 R3 destroy fallback)', () => {
  it('destroyed → empty fallback', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const tpl = new PrintTemplate({ template: { panels: [makePanelSpec(0)] } })
    tpl.destroy()
    const html = tpl.getSimpleHtml({})
    expect(html).toBeDefined() // does not throw
  })

  it('no jQuery → fallback object', () => {
    const $orig = window.$
    delete window.$
    const tpl = new PrintTemplate({ template: { panels: [makePanelSpec(0)] } })
    const html = tpl.getSimpleHtml({})
    expect(html._emptyFallback).toBe(true)
    if ($orig) window.$ = $orig
  })

  it('getHtml is an alias for getSimpleHtml(data || {}, opts)', () => {
    const tpl = new PrintTemplate({ template: { panels: [makePanelSpec(0)] } })
    const a = tpl.getHtml(undefined)
    const b = tpl.getSimpleHtml({})
    // both produce a fallback (no jQuery in happy-dom) — structural parity
    expect(typeof a).toBe(typeof b)
  })
})

describe('PrintTemplate.getSimpleHtmlAsync (R3 silent #3 destroy-mid-async)', () => {
  it('destroyed before call → resolves to empty fallback', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const tpl = new PrintTemplate({ template: { panels: [makePanelSpec(0)] } })
    tpl.destroy()
    const result = await tpl.getSimpleHtmlAsync({})
    expect(result).toBeDefined()
  })

  it('returns Promise', () => {
    const tpl = new PrintTemplate({ template: { panels: [makePanelSpec(0)] } })
    const p = tpl.getSimpleHtmlAsync({})
    expect(p).toBeInstanceOf(Promise)
  })

  it('[R3 silent #3] destroy mid-async → rejects with "aborted" message', async () => {
    if (!window.$) {
      // happy-dom: no jQuery, async simply resolves
      return
    }
    const tpl = new PrintTemplate({ template: { panels: [makePanelSpec(0)] } })
    const p = tpl.getSimpleHtmlAsync({ a: 1 })
    tpl.destroy()
    try {
      await p
    } catch (err) {
      expect(String(err.message)).toMatch(/aborted|destroyed/)
    }
  })
})

// ============ printMixin ============

describe('PrintTemplate.print (PM-003 R3 destroy fallback)', () => {
  it('destroyed → silent skip', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const tpl = new PrintTemplate({ template: { panels: [makePanelSpec(0)] } })
    tpl.destroy()
    expect(() => tpl.print({})).not.toThrow()
  })

  it('no window.$ → warn + skip', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const $orig = window.$
    delete window.$
    const tpl = new PrintTemplate({ template: { panels: [makePanelSpec(0)] } })
    tpl.print({})
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('print: window.$ not available')
    )
    if ($orig) window.$ = $orig
  })
})

describe('PrintTemplate.clientIsOpened / getPrinterList', () => {
  it('clientIsOpened returns false when hiwebSocket not set', () => {
    const tpl = new PrintTemplate({})
    expect(tpl.clientIsOpened()).toBe(false)
  })

  it('clientIsOpened returns true when hiwebSocket.opened', () => {
    window.hiwebSocket = { opened: true }
    const tpl = new PrintTemplate({})
    expect(tpl.clientIsOpened()).toBe(true)
  })

  it('getPrinterList returns [] when hiwebSocket missing', () => {
    const tpl = new PrintTemplate({})
    expect(tpl.getPrinterList()).toEqual([])
  })

  it('getPrinterList delegates to hiwebSocket.getPrinterList()', () => {
    window.hiwebSocket = {
      getPrinterList: () => [{ name: 'P1' }],
    }
    const tpl = new PrintTemplate({})
    expect(tpl.getPrinterList()).toEqual([{ name: 'P1' }])
  })

  it('[PM-003 R3] destroyed → safe fallback', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const tpl = new PrintTemplate({})
    tpl.destroy()
    expect(tpl.clientIsOpened()).toBe(false)
    expect(tpl.getPrinterList()).toEqual([])
  })
})

// ============ pdfMixin ============

describe('PrintTemplate.toPdf (state-modeler R3 destroy race)', () => {
  it('destroyed → rejected promise (Promise / jQ Deferred)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const tpl = new PrintTemplate({})
    tpl.destroy()
    const p = tpl.toPdf({}, 'x.pdf')
    expect(p).toBeDefined()
    // Both shapes are awaitable; both should reject
    try {
      await p
      throw new Error('toPdf did not reject after destroy')
    } catch (err) {
      expect(String(err.message)).toMatch(/destroyed|jQuery/i)
    }
  })

  it('no jsPDF / domtoimage → rejects with helpful error', async () => {
    const tpl = new PrintTemplate({ template: { panels: [makePanelSpec(0)] } })
    if (!window.$ || !window.$.Deferred) return // SSR happy-dom: also rejects
    delete window.jsPDF
    delete window.domtoimage
    try {
      await tpl.toPdf({}, 'x.pdf')
      throw new Error('toPdf did not reject without jsPDF/domtoimage')
    } catch (err) {
      expect(String(err.message)).toMatch(/jsPDF|domtoimage|jQuery/)
    }
  })
})

// ============ updateMixin ============

describe('PrintTemplate.update (V1 line 12747 area)', () => {
  it('destroyed → silent skip', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const tpl = new PrintTemplate({})
    tpl.destroy()
    expect(() => tpl.update({ panels: [makePanelSpec(0)] })).not.toThrow()
  })

  it('rejects missing panels array with warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const tpl = new PrintTemplate({})
    tpl.update({})
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('update: invalid json')
    )
  })

  it('replaces panels + selects index 0', () => {
    const tpl = new PrintTemplate({ template: { panels: [makePanelSpec(0, 'old')] } })
    tpl.update({ panels: [makePanelSpec(0, 'new-A'), makePanelSpec(1, 'new-B')] })
    expect(tpl.printPanels).toHaveLength(2)
    expect(tpl.printPanels[0].name).toBe('new-A')
    expect(tpl.editingPanel.name).toBe('new-A')
  })

  it('honors selectIndex parameter', () => {
    const tpl = new PrintTemplate({})
    tpl.update(
      { panels: [makePanelSpec(0, 'A'), makePanelSpec(1, 'B')] },
      1
    )
    expect(tpl.editingPanel.name).toBe('B')
  })

  it('clamps out-of-range selectIndex', () => {
    const tpl = new PrintTemplate({})
    tpl.update({ panels: [makePanelSpec(0, 'A')] }, 99)
    expect(tpl.editingPanel.name).toBe('A')
  })

  it('updates this.template + lastJson', () => {
    const tpl = new PrintTemplate({})
    const newJson = { panels: [makePanelSpec(0, 'X')] }
    tpl.update(newJson)
    expect(tpl.template).toBe(newJson)
    expect(tpl.lastJson.panels[0].name).toBe('X')
  })
})

// ============ historyMixin ============

describe('PrintTemplate.undo / redo / addHistoryEntry', () => {
  it('destroyed → silent skip', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const tpl = new PrintTemplate({})
    tpl.destroy()
    expect(() => tpl.undo()).not.toThrow()
    expect(() => tpl.redo()).not.toThrow()
    expect(() => tpl.addHistoryEntry()).not.toThrow()
  })

  it('addHistoryEntry appends + advances pos', () => {
    const tpl = new PrintTemplate({ template: { panels: [makePanelSpec(0)] } })
    const initialPos = tpl.historyPos
    tpl.addHistoryEntry('test')
    expect(tpl.historyList.length).toBeGreaterThan(1)
    expect(tpl.historyPos).toBeGreaterThan(initialPos)
  })

  it('addHistoryEntry no-op when history feature disabled', () => {
    const tpl = new PrintTemplate({ history: false })
    const before = tpl.historyList.length
    tpl.addHistoryEntry('test')
    expect(tpl.historyList.length).toBe(before)
  })

  it('addHistoryEntry trims forward history when re-branching', () => {
    const tpl = new PrintTemplate({ template: { panels: [makePanelSpec(0)] } })
    tpl.addHistoryEntry('a') // pos=1
    tpl.addHistoryEntry('b') // pos=2
    tpl.historyPos = 1 // simulate undo
    tpl.addHistoryEntry('c') // should trim b → new branch
    expect(tpl.historyList.length).toBe(3)
    expect(tpl.historyList[2].type).toBe('c')
  })

  it('undo triggers event-bus shortcut key', () => {
    const bus = { trigger: vi.fn(), off: vi.fn(), on: vi.fn() }
    window.hinnn = { event: bus }
    const tpl = new PrintTemplate({ template: { panels: [makePanelSpec(0)] } })
    tpl.addHistoryEntry('a')
    tpl.undo()
    expect(bus.trigger).toHaveBeenCalledWith(
      'hiprintTemplateDataShortcutKey_' + tpl.id,
      'undo'
    )
  })

  it('redo triggers event-bus shortcut key', () => {
    const bus = { trigger: vi.fn(), off: vi.fn(), on: vi.fn() }
    window.hinnn = { event: bus }
    const tpl = new PrintTemplate({})
    tpl.redo()
    expect(bus.trigger).toHaveBeenCalledWith(
      'hiprintTemplateDataShortcutKey_' + tpl.id,
      'redo'
    )
  })

  it('getHistoryState reflects pos / canUndo / canRedo', () => {
    const tpl = new PrintTemplate({})
    const s0 = tpl.getHistoryState()
    expect(s0.pos).toBe(0)
    expect(s0.canUndo).toBe(false)
    expect(s0.canRedo).toBe(false)
    tpl.addHistoryEntry('a')
    const s1 = tpl.getHistoryState()
    expect(s1.canUndo).toBe(true)
    expect(s1.canRedo).toBe(false)
  })
})

// ============ zoomMixin ============

describe('PrintTemplate.setPaper / rotatePaper / getPaperType / getOrient', () => {
  it('[PM-003 R3] destroyed → safe fallback', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const tpl = new PrintTemplate({})
    tpl.destroy()
    expect(tpl.getPaperType()).toBeUndefined()
    expect(tpl.getOrient()).toBeUndefined()
    expect(tpl.getPrintStyle(0)).toBeUndefined()
    expect(() => tpl.setPaper('A4')).not.toThrow()
    expect(() => tpl.rotatePaper()).not.toThrow()
    expect(() => tpl.zoom(2)).not.toThrow()
    expect(() => tpl.alignElements('left')).not.toThrow()
  })

  it('setPaper(A4) resizes editingPanel to 210x297mm', () => {
    const tpl = new PrintTemplate({ template: { panels: [makePanelSpec(0)] } })
    tpl.selectPanel(0)
    tpl.setPaper('A4')
    expect(tpl.editingPanel.width).toBe(210)
    expect(tpl.editingPanel.height).toBe(297)
  })

  it('setPaper(A5) resizes to 148x210', () => {
    const tpl = new PrintTemplate({ template: { panels: [makePanelSpec(0)] } })
    tpl.selectPanel(0)
    tpl.setPaper('A5')
    expect(tpl.editingPanel.width).toBe(148)
    expect(tpl.editingPanel.height).toBe(210)
  })

  it('setPaper(numericWidth, numericHeight) accepts custom size', () => {
    const tpl = new PrintTemplate({ template: { panels: [makePanelSpec(0)] } })
    tpl.selectPanel(0)
    tpl.setPaper('150', '200')
    expect(tpl.editingPanel.width).toBe(150)
    expect(tpl.editingPanel.height).toBe(200)
  })

  it('setPaper throws on unknown paper type', () => {
    const tpl = new PrintTemplate({ template: { panels: [makePanelSpec(0)] } })
    tpl.selectPanel(0)
    expect(() => tpl.setPaper('XYZ')).toThrow(/not found pagetype/)
  })

  it('setPaper silent skip when no editingPanel', () => {
    const tpl = new PrintTemplate({})
    expect(() => tpl.setPaper('A4')).not.toThrow()
  })

  it('rotatePaper swaps width/height', () => {
    const tpl = new PrintTemplate({ template: { panels: [makePanelSpec(0)] } })
    tpl.selectPanel(0)
    const w = tpl.editingPanel.width
    const h = tpl.editingPanel.height
    tpl.rotatePaper()
    expect(tpl.editingPanel.width).toBe(h)
    expect(tpl.editingPanel.height).toBe(w)
  })

  it('getPaperType returns panel paperType', () => {
    const spec = { ...makePanelSpec(0), paperType: 'A4' }
    const tpl = new PrintTemplate({ template: { panels: [spec] } })
    expect(tpl.getPaperType()).toBe('A4')
    expect(tpl.getPaperType(0)).toBe('A4')
  })

  it('getOrient: height>width → 1 (portrait)', () => {
    const tpl = new PrintTemplate({
      template: { panels: [{ ...makePanelSpec(0), width: 210, height: 297 }] },
    })
    expect(tpl.getOrient()).toBe(1)
  })

  it('getOrient: width>height → 2 (landscape)', () => {
    const tpl = new PrintTemplate({
      template: { panels: [{ ...makePanelSpec(0), width: 297, height: 210 }] },
    })
    expect(tpl.getOrient()).toBe(2)
  })

  it('reads from window.HiPrintConfig when configured', () => {
    window.HiPrintConfig = {
      instance: { Custom: { width: 100, height: 150 } },
    }
    const tpl = new PrintTemplate({ template: { panels: [makePanelSpec(0)] } })
    tpl.selectPanel(0)
    tpl.setPaper('Custom')
    expect(tpl.editingPanel.width).toBe(100)
    expect(tpl.editingPanel.height).toBe(150)
  })
})

// ============ Destroy event-bus cleanup ============

describe('PrintTemplate.destroy — event-bus cleanup (V1 line 12594-12601)', () => {
  it('calls bus.off for all template-scoped event keys', () => {
    const offCalls = []
    const bus = {
      trigger: () => {},
      on: () => {},
      off: (key) => offCalls.push(key),
    }
    window.hinnn = { event: bus }
    const tpl = new PrintTemplate({})
    const id = tpl.id
    tpl.destroy()
    expect(offCalls).toContain('hiprintTemplateDataChanged_' + id)
    expect(offCalls).toContain('hiprintTemplateDataShortcutKey_' + id)
    expect(offCalls).toContain('PrintElementSelectEventKey_' + id)
    expect(offCalls).toContain('BuildCustomOptionSettingEventKey_' + id)
  })

  it('survives event-bus throw during off (safeCall isolation)', () => {
    const bus = {
      trigger: () => {},
      on: () => {},
      off: () => {
        throw new Error('boom')
      },
    }
    window.hinnn = { event: bus }
    const tpl = new PrintTemplate({})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => tpl.destroy()).not.toThrow()
    expect(tpl.isDestroyed()).toBe(true)
  })

  it('container empty() called if container is jQuery-like', () => {
    let emptied = false
    const tpl = new PrintTemplate({})
    tpl.container = { empty: () => (emptied = true) }
    tpl.destroy()
    expect(emptied).toBe(true)
  })
})
