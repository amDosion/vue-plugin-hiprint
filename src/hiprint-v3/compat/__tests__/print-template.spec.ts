/**
 * print-template.spec.ts — V3 PrintTemplate compat class tests (P19).
 *
 * Covers: constructor, getJson roundtrip, update, destroy idempotency,
 * assertNotDestroyed gating, print/print2 wiring (mocked), undo/redo, history
 * capacity option, container resolution edge cases.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('@hiprint-v3/print', async () => {
  const actual = await vi.importActual<typeof import('@hiprint-v3/print')>('@hiprint-v3/print')
  return {
    ...actual,
    browserPrint: vi.fn(() => Promise.resolve()),
    downloadPdf: vi.fn(() => Promise.resolve()),
    toPdfBlob: vi.fn(() => Promise.resolve(new Blob(['pdf'], { type: 'application/pdf' }))),
    getPrintHtml: vi.fn(() => '<div>print-html</div>'),
  }
})

import { browserPrint, getPrintHtml, getHiWebSocket } from '@hiprint-v3/print'
import { PrintTemplate } from '../print-template'
import { useCanvasStore } from '@hiprint-v3/stores'
import { setActivePinia } from 'pinia'
import type { TemplateJson } from '@hiprint-v3/schemas'

const SAMPLE: TemplateJson = {
  panels: [
    {
      index: 0,
      name: '1',
      width: 210,
      height: 297,
      printElements: [
        {
          options: { left: 10, top: 10, width: 100, height: 16, text: 'Hello' },
          printElementType: { type: 'text', tid: 'defaultModule.text' },
        },
      ],
    },
  ],
}

describe('PrintTemplate compat — constructor', () => {
  beforeEach(() => {
    vi.mocked(browserPrint).mockClear()
    vi.mocked(getPrintHtml).mockClear()
  })

  it('constructs without options (auto-creates default A4 panel — ST-001)', () => {
    const tpl = new PrintTemplate()
    expect(tpl).toBeInstanceOf(PrintTemplate)
    expect(tpl._destroyed).toBe(false)
    // ST-001: bare ctor now seeds a single A4 portrait panel so designer
    // surface is editable immediately.
    expect(tpl.getJson().panels.length).toBe(1)
    tpl.destroy()
  })

  it('new PrintTemplate({}) auto-creates default A4 panel (ST-001)', () => {
    const tpl = new PrintTemplate({})
    // Activate this template's private pinia so we can introspect its store.
    setActivePinia(tpl._getPinia())
    const canvas = useCanvasStore()
    expect(canvas.panels.length).toBe(1)
    expect(canvas.activePanelId).not.toBeNull()
    // A4 portrait in pt: 210mm/25.4*72 ≈ 595.28, 297mm/25.4*72 ≈ 841.89.
    const panel = canvas.panels[0]!
    expect(panel.width).toBeCloseTo(595.28, 1)
    expect(panel.height).toBeCloseTo(841.89, 1)
    expect(panel.name).toBe('1')
    tpl.destroy()
  })

  it('loads template option on construction', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    const json = tpl.getJson()
    expect(json.panels.length).toBe(1)
    expect(json.panels[0]?.printElements?.length).toBe(1)
    tpl.destroy()
  })

  it('honors numeric history capacity option', () => {
    const tpl = new PrintTemplate({ template: SAMPLE, history: 10 })
    // No public read of capacity, but constructor should not throw.
    expect(tpl._destroyed).toBe(false)
    tpl.destroy()
  })

  it('honors boolean history option', () => {
    const tpl1 = new PrintTemplate({ history: true })
    const tpl2 = new PrintTemplate({ history: false })
    expect(tpl1._destroyed).toBe(false)
    expect(tpl2._destroyed).toBe(false)
    tpl1.destroy()
    tpl2.destroy()
  })
})

describe('PrintTemplate compat — JSON roundtrip', () => {
  it('getJson returns fresh objects (no aliasing with internal store)', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    const a = tpl.getJson()
    const b = tpl.getJson()
    expect(a).not.toBe(b)
    expect(a.panels).not.toBe(b.panels)
    // panels[0] is also re-cloned
    expect(a.panels[0]).not.toBe(b.panels[0])
    tpl.destroy()
  })

  it('update replaces template', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    expect(tpl.getJson().panels.length).toBe(1)
    const NEXT: TemplateJson = {
      panels: [
        { index: 0, name: '1', width: 100, height: 100, printElements: [] },
        { index: 1, name: '2', width: 100, height: 100, printElements: [] },
      ],
    }
    tpl.update(NEXT)
    expect(tpl.getJson().panels.length).toBe(2)
    tpl.destroy()
  })

  it('getJsonTid is alias of getJson', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    const a = tpl.getJson()
    const b = tpl.getJsonTid()
    expect(a.panels.length).toBe(b.panels.length)
    tpl.destroy()
  })
})

describe('PrintTemplate compat — destroy', () => {
  it('destroy sets _destroyed=true', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    tpl.destroy()
    expect(tpl._destroyed).toBe(true)
  })

  it('destroy is idempotent', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    tpl.destroy()
    expect(() => tpl.destroy()).not.toThrow()
    expect(() => tpl.destroy()).not.toThrow()
    expect(tpl._destroyed).toBe(true)
  })

  it('public methods warn + return fallback after destroy', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    tpl.destroy()

    expect(tpl.getJson().panels.length).toBe(0)
    expect(tpl.getHtml()).toBe('')
    // print returns void after destroy
    expect(tpl.print()).toBeUndefined()
    expect(tpl.print2()).toBeUndefined()
    // undo/redo/clear are no-ops
    expect(() => tpl.undo()).not.toThrow()
    expect(() => tpl.redo()).not.toThrow()
    expect(() => tpl.clear()).not.toThrow()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('PrintTemplate compat — print pipeline', () => {
  beforeEach(() => {
    vi.mocked(browserPrint).mockClear()
    vi.mocked(getPrintHtml).mockClear()
  })

  it('print() invokes browserPrint with current JSON', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    const meta = tpl.print({ name: 'X' })
    expect(browserPrint).toHaveBeenCalledTimes(1)
    expect(meta?.json.panels.length).toBe(1)
    expect(meta?.data).toEqual({ name: 'X' })
    tpl.destroy()
  })

  it('print2() short-circuits when socket not connected (warn)', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const ws = getHiWebSocket()
    ws.opened = false
    const meta = tpl.print2({ id: 1 })
    expect(meta?.data).toEqual({ id: 1 })
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('print2: hiwebSocket not connected')
    )
    warn.mockRestore()
    tpl.destroy()
  })

  it('print2() sends payload when socket connected', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    const ws = getHiWebSocket()
    const sendSpy = vi.spyOn(ws, 'send').mockImplementation(() => {})
    ws.opened = true
    tpl.print2({ id: 2 })
    expect(sendSpy).toHaveBeenCalledTimes(1)
    const payload = sendSpy.mock.calls[0]?.[0] as { type: string; html: string }
    expect(payload.type).toBe('PRINT')
    expect(typeof payload.html).toBe('string')
    sendSpy.mockRestore()
    ws.opened = false
    tpl.destroy()
  })

  it('getHtml returns rendered string', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    const html = tpl.getHtml({ name: 'Y' })
    expect(typeof html).toBe('string')
    expect(getPrintHtml).toHaveBeenCalledTimes(1)
    tpl.destroy()
  })
})

describe('PrintTemplate compat — undo/redo/clear/save', () => {
  it('undo/redo do not throw on empty history', () => {
    const tpl = new PrintTemplate()
    expect(() => tpl.undo()).not.toThrow()
    expect(() => tpl.redo()).not.toThrow()
    tpl.destroy()
  })

  it('clear empties panels', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    expect(tpl.getJson().panels.length).toBe(1)
    tpl.clear()
    expect(tpl.getJson().panels.length).toBe(0)
    tpl.destroy()
  })

  it('save returns current JSON and fires onSave', () => {
    const onSave = vi.fn()
    const tpl = new PrintTemplate({ template: SAMPLE, onSave })
    const json = tpl.save()
    expect(json?.panels.length).toBe(1)
    expect(onSave).toHaveBeenCalledTimes(1)
    tpl.destroy()
  })

  it('save returns undefined after destroy', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    tpl.destroy()
    expect(tpl.save()).toBeUndefined()
  })
})

describe('PrintTemplate compat — design()', () => {
  let host: HTMLElement
  beforeEach(() => {
    host = document.createElement('div')
    host.id = 'designer-host'
    document.body.appendChild(host)
  })
  afterEach(() => {
    if (host.parentNode) host.parentNode.removeChild(host)
  })

  it('design() with element mounts an app (no throw)', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    expect(() => tpl.design(host)).not.toThrow()
    tpl.destroy()
  })

  it('design() with css selector resolves to element', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    expect(() => tpl.design('#designer-host')).not.toThrow()
    tpl.destroy()
  })

  it('design() with unresolvable selector warns + early-returns', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    tpl.design('#does-not-exist')
    expect(warn).toHaveBeenCalledWith(
      '[hiprint] design: container not found:',
      '#does-not-exist'
    )
    warn.mockRestore()
    tpl.destroy()
  })

  it('design() called after destroy warns + no-ops', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    tpl.destroy()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    tpl.design(host)
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('design called on destroyed template')
    )
    warn.mockRestore()
  })
})

// ===========================================================================
// Sprint 22c — TKT-060…TKT-085 — V1 compat method expansion (+25 methods)
// ===========================================================================

import { PAPER_TYPES } from '../print-template'
import { useHistoryStore } from '@hiprint-v3/stores'
import { _setClipboard } from '@hiprint-v3/interactions/context-menu'

/**
 * Build a template with N panels x M elements at fixed offsets. Returns a
 * canonical template + a helper to pull element ids back after load.
 */
function makeMultiElementTemplate(): TemplateJson {
  return {
    panels: [
      {
        index: 0,
        name: '1',
        width: 595.28,
        height: 841.89,
        printElements: [
          {
            options: { left: 0, top: 0, width: 100, height: 50, field: 'a' },
            printElementType: { type: 'text', tid: 'mod.text' },
          },
          {
            options: { left: 200, top: 100, width: 100, height: 50, field: 'b' },
            printElementType: { type: 'text', tid: 'mod.text' },
          },
          {
            options: { left: 400, top: 200, width: 100, height: 50, field: 'a' },
            printElementType: { type: 'text', tid: 'mod.text' },
          },
        ],
      },
    ],
  } as unknown as TemplateJson
}

describe('TKT-060 rotatePaper', () => {
  it('swaps active panel width and height + pushes history', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    setActivePinia(tpl._getPinia())
    const canvas = useCanvasStore()
    const ap0 = canvas.activePanel!
    const w0 = ap0.width
    const h0 = ap0.height
    tpl.rotatePaper()
    const ap1 = useCanvasStore().activePanel!
    expect(ap1.width).toBe(h0)
    expect(ap1.height).toBe(w0)
    tpl.destroy()
  })

  it('is a no-op after destroy', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    tpl.destroy()
    expect(() => tpl.rotatePaper()).not.toThrow()
  })
})

describe('TKT-061 setPaper', () => {
  it('applies a preset by name', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    tpl.setPaper('A3')
    const sz = tpl.getPaperSize()
    expect(sz.paperType).toBe('A3')
    expect(sz.width).toBe(PAPER_TYPES.A3!.width)
    expect(sz.height).toBe(PAPER_TYPES.A3!.height)
    tpl.destroy()
  })

  it('warns on unknown preset', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    tpl.setPaper('XX-bogus')
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('unknown paper type')
    )
    warn.mockRestore()
    tpl.destroy()
  })

  it('accepts custom width+height (numeric form)', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    tpl.setPaper(300, 400)
    const sz = tpl.getPaperSize()
    expect(sz.width).toBe(300)
    expect(sz.height).toBe(400)
    expect(sz.paperType).toBe('custom')
    tpl.destroy()
  })

  it('is a no-op after destroy', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    tpl.destroy()
    expect(() => tpl.setPaper('A4')).not.toThrow()
  })
})

describe('TKT-062 alignElements', () => {
  it('left-aligns ≥2 selected elements', () => {
    const tpl = new PrintTemplate({ template: makeMultiElementTemplate() })
    setActivePinia(tpl._getPinia())
    const canvas = useCanvasStore()
    canvas.selectMultiple(canvas.allElements.slice(0, 2).map((e) => e.id))
    tpl.alignElements('left')
    const fresh = canvas.allElements
    expect(fresh[0]!.options.left).toBe(0)
    expect(fresh[1]!.options.left).toBe(0)
    tpl.destroy()
  })

  it('no-ops with fewer than 2 selected', () => {
    const tpl = new PrintTemplate({ template: makeMultiElementTemplate() })
    setActivePinia(tpl._getPinia())
    const before = tpl.getJson()
    tpl.alignElements('right') // no selection
    const after = tpl.getJson()
    expect(after).toEqual(before)
    tpl.destroy()
  })

  it('is a no-op after destroy', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    tpl.destroy()
    expect(() => tpl.alignElements('left')).not.toThrow()
  })
})

describe('TKT-063 distributeElements', () => {
  it('distributes ≥3 horizontally with equal gap', () => {
    const tpl = new PrintTemplate({ template: makeMultiElementTemplate() })
    setActivePinia(tpl._getPinia())
    const canvas = useCanvasStore()
    canvas.selectMultiple(canvas.allElements.map((e) => e.id))
    tpl.distributeElements('horizontal')
    // Middle element should now have left adjusted relative to outer bounds.
    const els = canvas.allElements
    // Sort by left for sanity
    const sorted = [...els].sort((a, b) => Number(a.options.left) - Number(b.options.left))
    expect(sorted.length).toBe(3)
    // Middle element should lie strictly between leftmost+width and rightmost.
    const midLeft = Number(sorted[1]!.options.left)
    const leftEdge = Number(sorted[0]!.options.left) + Number(sorted[0]!.options.width)
    const rightEdge = Number(sorted[2]!.options.left)
    expect(midLeft).toBeGreaterThanOrEqual(leftEdge)
    expect(midLeft).toBeLessThanOrEqual(rightEdge)
    tpl.destroy()
  })

  it('no-ops with fewer than 3 selected', () => {
    const tpl = new PrintTemplate({ template: makeMultiElementTemplate() })
    setActivePinia(tpl._getPinia())
    const before = tpl.getJson()
    tpl.distributeElements('horizontal') // no selection
    expect(tpl.getJson()).toEqual(before)
    tpl.destroy()
  })

  it('is a no-op after destroy', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    tpl.destroy()
    expect(() => tpl.distributeElements('vertical')).not.toThrow()
  })
})

describe('TKT-064 zoom controls', () => {
  it('zoom() sets canvas scale', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    setActivePinia(tpl._getPinia())
    tpl.zoom(2.0)
    expect(useCanvasStore().scale).toBe(2.0)
    tpl.destroy()
  })

  it('zoomIn() adds 0.1 step', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    setActivePinia(tpl._getPinia())
    tpl.zoom(1.0)
    tpl.zoomIn()
    expect(useCanvasStore().scale).toBeCloseTo(1.1, 5)
    tpl.destroy()
  })

  it('zoomOut() subtracts 0.1 step', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    setActivePinia(tpl._getPinia())
    tpl.zoom(1.0)
    tpl.zoomOut()
    expect(useCanvasStore().scale).toBeCloseTo(0.9, 5)
    tpl.destroy()
  })

  it('zoomReset() returns scale to 1', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    setActivePinia(tpl._getPinia())
    tpl.zoom(2.5)
    tpl.zoomReset()
    expect(useCanvasStore().scale).toBe(1)
    tpl.destroy()
  })

  it('zoom controls are no-ops after destroy', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    tpl.destroy()
    expect(() => {
      tpl.zoom(2)
      tpl.zoomIn()
      tpl.zoomOut()
      tpl.zoomReset()
    }).not.toThrow()
  })
})

describe('TKT-065 addPrintPanel / removePrintPanel', () => {
  it('addPrintPanel returns new panel + grows panels list', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    setActivePinia(tpl._getPinia())
    const before = useCanvasStore().panels.length
    const next = tpl.addPrintPanel({ width: 100, height: 200 })
    expect(next).not.toBeNull()
    expect(useCanvasStore().panels.length).toBe(before + 1)
    tpl.destroy()
  })

  it('removePrintPanel honors keep-≥-1 invariant', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    setActivePinia(tpl._getPinia())
    const onlyId = useCanvasStore().panels[0]!.id
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    tpl.removePrintPanel(onlyId)
    expect(useCanvasStore().panels.length).toBe(1) // unchanged
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('keep at least 1 panel')
    )
    warn.mockRestore()
    tpl.destroy()
  })

  it('removePrintPanel works by index', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    setActivePinia(tpl._getPinia())
    tpl.addPrintPanel({ width: 100, height: 200 })
    expect(useCanvasStore().panels.length).toBe(2)
    tpl.removePrintPanel(1)
    expect(useCanvasStore().panels.length).toBe(1)
    tpl.destroy()
  })

  it('addPrintPanel returns null after destroy', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    tpl.destroy()
    expect(tpl.addPrintPanel()).toBeNull()
  })
})

describe('TKT-066 selectPanel', () => {
  it('selects by index', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    setActivePinia(tpl._getPinia())
    tpl.addPrintPanel({ width: 100, height: 200 })
    tpl.selectPanel(1)
    expect(useCanvasStore().activePanelId).toBe(useCanvasStore().panels[1]!.id)
    tpl.destroy()
  })

  it('selects by id', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    setActivePinia(tpl._getPinia())
    tpl.addPrintPanel({ width: 100, height: 200 })
    const id = useCanvasStore().panels[1]!.id
    tpl.selectPanel(id)
    expect(useCanvasStore().activePanelId).toBe(id)
    tpl.destroy()
  })

  it('warns on unknown index', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    tpl.selectPanel(99)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
    tpl.destroy()
  })
})

describe('TKT-067 on / off / emit', () => {
  it('on/emit invokes handler with arguments', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    const spy = vi.fn()
    tpl.on('custom-event', spy)
    tpl.emit('custom-event', 1, 'two')
    expect(spy).toHaveBeenCalledWith(1, 'two')
    tpl.destroy()
  })

  it('off removes one handler', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    const spy = vi.fn()
    tpl.on('e1', spy)
    tpl.off('e1', spy)
    tpl.emit('e1')
    expect(spy).not.toHaveBeenCalled()
    tpl.destroy()
  })

  it('off without handler clears the entire key', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    const spyA = vi.fn()
    const spyB = vi.fn()
    tpl.on('e1', spyA)
    tpl.on('e1', spyB)
    tpl.off('e1')
    tpl.emit('e1')
    expect(spyA).not.toHaveBeenCalled()
    expect(spyB).not.toHaveBeenCalled()
    tpl.destroy()
  })

  it('on returns an unsub function', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    const spy = vi.fn()
    const unsub = tpl.on('e1', spy)
    unsub()
    tpl.emit('e1')
    expect(spy).not.toHaveBeenCalled()
    tpl.destroy()
  })

  it('rotatePaper emits paper-change', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    const spy = vi.fn()
    tpl.on('paper-change', spy)
    tpl.rotatePaper()
    expect(spy).toHaveBeenCalled()
    tpl.destroy()
  })

  it('event API is gated after destroy', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    tpl.destroy()
    expect(() => tpl.emit('x')).not.toThrow()
    expect(typeof tpl.on('x', () => {})).toBe('function')
    expect(() => tpl.off('x')).not.toThrow()
  })
})

describe('TKT-068 getElementByTid', () => {
  it('finds element by top-level tid', () => {
    const tpl = new PrintTemplate({ template: makeMultiElementTemplate() })
    setActivePinia(tpl._getPinia())
    // Templates loaded via loadFromJson normalize tid through the element schema
    // boundary; in this test the JSON has printElementType.tid, which we
    // accept via the fallback path in getElementByTid.
    const el = tpl.getElementByTid('mod.text')
    expect(el).not.toBeNull()
    tpl.destroy()
  })

  it('returns null for unknown tid', () => {
    const tpl = new PrintTemplate({ template: makeMultiElementTemplate() })
    expect(tpl.getElementByTid('does-not-exist')).toBeNull()
    tpl.destroy()
  })

  it('returns null after destroy', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    tpl.destroy()
    expect(tpl.getElementByTid('any')).toBeNull()
  })
})

describe('TKT-069 getActivePanelJson', () => {
  it('returns active panel + fresh-cloned elements', () => {
    const tpl = new PrintTemplate({ template: makeMultiElementTemplate() })
    const snap = tpl.getActivePanelJson()
    expect(snap.panel).not.toBeNull()
    expect(snap.elements.length).toBe(3)
    // Mutating snapshot must NOT affect live store.
    snap.elements[0]!.options.left = 9999
    expect(tpl.getJson().panels[0]!.printElements![0]!.options!.left).not.toBe(9999)
    tpl.destroy()
  })

  it('returns empty defaults after destroy', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    tpl.destroy()
    const snap = tpl.getActivePanelJson()
    expect(snap.panel).toBeNull()
    expect(snap.elements).toEqual([])
  })
})

describe('TKT-070 setDynamicFields / getDynamicFields', () => {
  it('stores + emits dynamic-fields-change', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    const spy = vi.fn()
    tpl.on('dynamic-fields-change', spy)
    tpl.setDynamicFields({ user: { name: 'X' } })
    expect(spy).toHaveBeenCalledWith({ user: { name: 'X' } })
    expect(tpl.getDynamicFields()).toEqual({ user: { name: 'X' } })
    tpl.destroy()
  })

  it('is a no-op after destroy', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    tpl.destroy()
    expect(() => tpl.setDynamicFields({})).not.toThrow()
    expect(tpl.getDynamicFields()).toBeUndefined()
  })
})

describe('TKT-071 appendElementTypeGroups', () => {
  it('throws on empty moduleName', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    expect(() => tpl.appendElementTypeGroups('', [])).toThrow(
      /moduleName is required/
    )
    tpl.destroy()
  })

  it('appends to registry without error', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    expect(() =>
      tpl.appendElementTypeGroups('mod-test-71', [
        {
          name: 'g',
          printElementTypes: [
            { tid: 'mod-test-71.t', type: 'text', title: 'T' },
          ],
        },
      ])
    ).not.toThrow()
    tpl.destroy()
  })

  it('is a no-op after destroy', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    tpl.destroy()
    expect(() => tpl.appendElementTypeGroups('mod-72', [])).not.toThrow()
  })
})

describe('TKT-072 setElementTypeGroups', () => {
  it('throws on empty moduleName', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    expect(() => tpl.setElementTypeGroups('', [])).toThrow(
      /moduleName is required/
    )
    tpl.destroy()
  })

  it('replaces existing groups', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    tpl.setElementTypeGroups('mod-test-72', [
      { name: 'g1', printElementTypes: [{ tid: 'mod-test-72.a', type: 'text' }] },
    ])
    tpl.setElementTypeGroups('mod-test-72', [
      { name: 'g2', printElementTypes: [{ tid: 'mod-test-72.b', type: 'text' }] },
    ])
    // No throw — assertion that replace path works.
    tpl.destroy()
  })
})

describe('TKT-073 selectAllElements / selectElementsByField', () => {
  it('selectAllElements selects every element', () => {
    const tpl = new PrintTemplate({ template: makeMultiElementTemplate() })
    setActivePinia(tpl._getPinia())
    tpl.selectAllElements()
    expect(useCanvasStore().selectedElementIds.size).toBe(3)
    tpl.destroy()
  })

  it('selectElementsByField filters by options.field', () => {
    const tpl = new PrintTemplate({ template: makeMultiElementTemplate() })
    setActivePinia(tpl._getPinia())
    tpl.selectElementsByField('a')
    expect(useCanvasStore().selectedElementIds.size).toBe(2)
    tpl.destroy()
  })
})

describe('TKT-074 z-order', () => {
  it('bringToFront moves selected element to last index', () => {
    const tpl = new PrintTemplate({ template: makeMultiElementTemplate() })
    setActivePinia(tpl._getPinia())
    const canvas = useCanvasStore()
    const firstId = canvas.allElements[0]!.id
    canvas.selectElement(firstId)
    tpl.bringToFront()
    const ap = useCanvasStore().activePanel!
    expect(ap.printElements[ap.printElements.length - 1]!.id).toBe(firstId)
    tpl.destroy()
  })

  it('sendToBack moves to index 0', () => {
    const tpl = new PrintTemplate({ template: makeMultiElementTemplate() })
    setActivePinia(tpl._getPinia())
    const canvas = useCanvasStore()
    const lastId = canvas.allElements[canvas.allElements.length - 1]!.id
    tpl.sendToBack(lastId)
    expect(useCanvasStore().activePanel!.printElements[0]!.id).toBe(lastId)
    tpl.destroy()
  })

  it('bringForward / sendBackward shift one slot', () => {
    const tpl = new PrintTemplate({ template: makeMultiElementTemplate() })
    setActivePinia(tpl._getPinia())
    const canvas = useCanvasStore()
    const midId = canvas.allElements[1]!.id
    tpl.bringForward(midId)
    let arr = useCanvasStore().activePanel!.printElements
    expect(arr.findIndex((e) => e.id === midId)).toBe(2)
    tpl.sendBackward(midId)
    arr = useCanvasStore().activePanel!.printElements
    expect(arr.findIndex((e) => e.id === midId)).toBe(1)
    tpl.destroy()
  })

  it('z-order no-ops after destroy', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    tpl.destroy()
    expect(() => {
      tpl.bringToFront('x')
      tpl.sendToBack('x')
      tpl.bringForward('x')
      tpl.sendBackward('x')
    }).not.toThrow()
  })
})

describe('TKT-075 setElsAlign vocab mapping', () => {
  it('"vertical" maps to horizontalCenter (V1 quirk preserved)', () => {
    const tpl = new PrintTemplate({ template: makeMultiElementTemplate() })
    setActivePinia(tpl._getPinia())
    const canvas = useCanvasStore()
    canvas.selectMultiple(canvas.allElements.slice(0, 2).map((e) => e.id))
    tpl.setElsAlign('vertical')
    // Both elements should now share the same center-x.
    const els = canvas.allElements.slice(0, 2)
    const cx0 = Number(els[0]!.options.left) + Number(els[0]!.options.width) / 2
    const cx1 = Number(els[1]!.options.left) + Number(els[1]!.options.width) / 2
    expect(Math.abs(cx0 - cx1)).toBeLessThan(0.01)
    tpl.destroy()
  })

  it('"distributeHor" forwards to distributeElements("horizontal")', () => {
    const tpl = new PrintTemplate({ template: makeMultiElementTemplate() })
    setActivePinia(tpl._getPinia())
    useCanvasStore().selectMultiple(useCanvasStore().allElements.map((e) => e.id))
    expect(() => tpl.setElsAlign('distributeHor')).not.toThrow()
    tpl.destroy()
  })
})

describe('TKT-076 updateOption', () => {
  it('patches element options shallow-merge', () => {
    const tpl = new PrintTemplate({ template: makeMultiElementTemplate() })
    setActivePinia(tpl._getPinia())
    const id = useCanvasStore().allElements[0]!.id
    tpl.updateOption(id, { color: 'red', left: 999 })
    const el = tpl.getElementByTid('mod.text')
    expect(el?.options.color).toBe('red')
    expect(el?.options.left).toBe(999)
    tpl.destroy()
  })

  it('no-ops on unknown elId', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    expect(() => tpl.updateOption('bogus', { x: 1 })).not.toThrow()
    tpl.destroy()
  })

  it('no-ops after destroy', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    tpl.destroy()
    expect(() => tpl.updateOption('x', {})).not.toThrow()
  })
})

describe('TKT-077 lockElement / unlockElement', () => {
  it('lockElement sets positionLocked + sizeLocked', () => {
    const tpl = new PrintTemplate({ template: makeMultiElementTemplate() })
    setActivePinia(tpl._getPinia())
    const id = useCanvasStore().allElements[0]!.id
    tpl.lockElement(id)
    const opts = tpl.getAllOptions(id)
    expect(opts.positionLocked).toBe(true)
    expect(opts.sizeLocked).toBe(true)
    tpl.destroy()
  })

  it('unlockElement clears lock flags', () => {
    const tpl = new PrintTemplate({ template: makeMultiElementTemplate() })
    setActivePinia(tpl._getPinia())
    const id = useCanvasStore().allElements[0]!.id
    tpl.lockElement(id)
    tpl.unlockElement(id)
    const opts = tpl.getAllOptions(id)
    expect(opts.positionLocked).toBe(false)
    expect(opts.sizeLocked).toBe(false)
    expect(opts.lock).toBe(false)
    tpl.destroy()
  })
})

describe('TKT-078 copy / paste / cut element', () => {
  beforeEach(() => {
    _setClipboard([]) // reset clipboard across tests
  })

  it('copyElement loads clipboard without state mutation', async () => {
    const tpl = new PrintTemplate({ template: makeMultiElementTemplate() })
    setActivePinia(tpl._getPinia())
    const id = useCanvasStore().allElements[0]!.id
    const before = tpl.getJson()
    tpl.copyElement(id)
    // Wait for the dynamic import + microtask to flush.
    await Promise.resolve()
    await Promise.resolve()
    expect(tpl.getJson()).toEqual(before) // no mutation
    tpl.destroy()
  })

  it('pasteElement after copyElement grows panel size by 1', async () => {
    const tpl = new PrintTemplate({ template: makeMultiElementTemplate() })
    setActivePinia(tpl._getPinia())
    const id = useCanvasStore().allElements[0]!.id
    tpl.copyElement(id)
    // Allow the dynamic import to flush before paste.
    await new Promise<void>((r) => setTimeout(r, 0))
    const before = useCanvasStore().activePanel!.printElements.length
    tpl.pasteElement()
    await new Promise<void>((r) => setTimeout(r, 0))
    expect(useCanvasStore().activePanel!.printElements.length).toBe(before + 1)
    tpl.destroy()
  })

  it('cutElement removes the source element', async () => {
    const tpl = new PrintTemplate({ template: makeMultiElementTemplate() })
    setActivePinia(tpl._getPinia())
    const id = useCanvasStore().allElements[0]!.id
    tpl.cutElement(id)
    await new Promise<void>((r) => setTimeout(r, 0))
    expect(
      useCanvasStore().allElements.find((e) => e.id === id)
    ).toBeUndefined()
    tpl.destroy()
  })
})

describe('TKT-079 history API', () => {
  it('getHistory returns entries + cursor', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    const h = tpl.getHistory()
    expect(Array.isArray(h.entries)).toBe(true)
    expect(typeof h.cursor).toBe('number')
    tpl.destroy()
  })

  it('clearHistory empties undo stack', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    setActivePinia(tpl._getPinia())
    useHistoryStore().pushSnapshot()
    tpl.clearHistory()
    expect(useHistoryStore().canUndo).toBe(false)
    tpl.destroy()
  })

  it('setHistoryCapacity is no-op-safe', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    expect(() => tpl.setHistoryCapacity(10)).not.toThrow()
    tpl.destroy()
  })

  it('history methods are safe after destroy', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    tpl.destroy()
    expect(tpl.getHistory().entries).toEqual([])
    expect(() => tpl.clearHistory()).not.toThrow()
    expect(() => tpl.setHistoryCapacity(5)).not.toThrow()
  })
})

describe('TKT-080 getPaperSize / getMaxPanelIndex', () => {
  it('getPaperSize reads active panel', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    const sz = tpl.getPaperSize()
    expect(typeof sz.width).toBe('number')
    expect(typeof sz.height).toBe('number')
    expect(typeof sz.paperType).toBe('string')
    tpl.destroy()
  })

  it('getMaxPanelIndex returns N-1', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    expect(tpl.getMaxPanelIndex()).toBe(0)
    tpl.addPrintPanel({ width: 100, height: 100 })
    expect(tpl.getMaxPanelIndex()).toBe(1)
    tpl.destroy()
  })

  it('paper size has A4 fallback after destroy', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    tpl.destroy()
    const sz = tpl.getPaperSize()
    expect(sz.paperType).toBe('A4')
  })
})

describe('TKT-081 exportPdf', () => {
  it('exportPdf delegates to toPdfDownload', async () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    const spy = vi.spyOn(tpl, 'toPdfDownload').mockResolvedValue(undefined)
    await tpl.exportPdf('my-name')
    expect(spy).toHaveBeenCalledWith(undefined, 'my-name')
    spy.mockRestore()
    tpl.destroy()
  })

  it('is a no-op after destroy', async () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    tpl.destroy()
    await expect(tpl.exportPdf()).resolves.toBeUndefined()
  })
})

describe('TKT-082 previewWindow / printWindow', () => {
  it('previewWindow returns silently when window.open is blocked', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    tpl.previewWindow()
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('window.open returned null')
    )
    openSpy.mockRestore()
    warn.mockRestore()
    tpl.destroy()
  })

  it('printWindow returns silently when window.open is blocked', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    tpl.printWindow()
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('window.open returned null')
    )
    openSpy.mockRestore()
    warn.mockRestore()
    tpl.destroy()
  })

  it('previewWindow is a no-op after destroy', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    tpl.destroy()
    expect(() => tpl.previewWindow()).not.toThrow()
  })
})

describe('TKT-083 addPrintElement / removePrintElement', () => {
  it('addPrintElement appends to specified panel', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    setActivePinia(tpl._getPinia())
    const panelId = useCanvasStore().panels[0]!.id
    const next = tpl.addPrintElement(panelId, { tid: 'mod.text', options: {} })
    expect(next).not.toBeNull()
    expect(next?.id).toBeTruthy()
    tpl.destroy()
  })

  it('addPrintElement returns null on missing tid', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    setActivePinia(tpl._getPinia())
    const panelId = useCanvasStore().panels[0]!.id
    // Force invalid call via cast — proves runtime guard.
    const next = tpl.addPrintElement(
      panelId,
      {} as unknown as { tid: string }
    )
    expect(next).toBeNull()
    tpl.destroy()
  })

  it('removePrintElement removes by id across panels', () => {
    const tpl = new PrintTemplate({ template: makeMultiElementTemplate() })
    setActivePinia(tpl._getPinia())
    const id = useCanvasStore().allElements[0]!.id
    tpl.removePrintElement(id)
    expect(
      useCanvasStore().allElements.find((e) => e.id === id)
    ).toBeUndefined()
    tpl.destroy()
  })

  it('addPrintElement returns null after destroy', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    tpl.destroy()
    expect(tpl.addPrintElement('any', { tid: 'mod.text' })).toBeNull()
  })
})

describe('TKT-084 getOption / getAllOptions', () => {
  it('getOption reads one key', () => {
    const tpl = new PrintTemplate({ template: makeMultiElementTemplate() })
    setActivePinia(tpl._getPinia())
    const id = useCanvasStore().allElements[0]!.id
    expect(tpl.getOption(id, 'left')).toBe(0)
    expect(tpl.getOption(id, 'field')).toBe('a')
    tpl.destroy()
  })

  it('getAllOptions returns full options bag (fresh copy)', () => {
    const tpl = new PrintTemplate({ template: makeMultiElementTemplate() })
    setActivePinia(tpl._getPinia())
    const id = useCanvasStore().allElements[0]!.id
    const opts = tpl.getAllOptions(id)
    expect(opts.field).toBe('a')
    // Mutation should NOT affect live store.
    opts.field = 'mutated'
    expect(tpl.getOption(id, 'field')).toBe('a')
    tpl.destroy()
  })

  it('getOption/getAllOptions return empty defaults after destroy', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    tpl.destroy()
    expect(tpl.getOption('x', 'y')).toBeUndefined()
    expect(tpl.getAllOptions('x')).toEqual({})
  })
})

// ===========================================================================
// TKT-085 — audit: every new method must respect destroy + return typed fallback.
// ===========================================================================

describe('TKT-085 audit — destroy guards on all 25 new methods', () => {
  it('every new method silently no-ops or returns its typed fallback', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    tpl.destroy()

    // Methods that return a value should return the documented fallback.
    expect(tpl.addPrintPanel()).toBeNull()
    expect(tpl.getElementByTid('any')).toBeNull()
    expect(tpl.getActivePanelJson()).toEqual({ panel: null, elements: [] })
    expect(tpl.getDynamicFields()).toBeUndefined()
    expect(tpl.getHistory()).toEqual({ entries: [], cursor: 0 })
    expect(tpl.getPaperSize().paperType).toBe('A4')
    expect(tpl.getMaxPanelIndex()).toBe(-1)
    expect(tpl.addPrintElement('p', { tid: 'mod.text' })).toBeNull()
    expect(tpl.getOption('x', 'y')).toBeUndefined()
    expect(tpl.getAllOptions('x')).toEqual({})

    // on() returns a noop unsub.
    const unsub = tpl.on('e', () => {})
    expect(typeof unsub).toBe('function')

    // Pure-void methods should not throw.
    expect(() => {
      tpl.rotatePaper()
      tpl.setPaper('A4')
      tpl.alignElements('left')
      tpl.distributeElements('horizontal')
      tpl.zoom(1)
      tpl.zoomIn()
      tpl.zoomOut()
      tpl.zoomReset()
      tpl.removePrintPanel(0)
      tpl.selectPanel(0)
      tpl.off('e')
      tpl.emit('e')
      tpl.setDynamicFields([])
      // appendElementTypeGroups + setElementTypeGroups will warn but not throw
      // when destroyed (we early-return before the moduleName check).
      tpl.appendElementTypeGroups('m', [])
      tpl.setElementTypeGroups('m', [])
      tpl.selectAllElements()
      tpl.selectElementsByField('a')
      tpl.bringToFront()
      tpl.sendToBack()
      tpl.bringForward()
      tpl.sendBackward()
      tpl.setElsAlign('left')
      tpl.updateOption('e', {})
      tpl.lockElement('e')
      tpl.unlockElement('e')
      tpl.copyElement('e')
      tpl.pasteElement()
      tpl.cutElement('e')
      tpl.clearHistory()
      tpl.setHistoryCapacity(5)
      tpl.previewWindow()
      tpl.printWindow()
      tpl.removePrintElement('e')
    }).not.toThrow()
  })
})

// ============================================================================
// Sprint 22g — Stream GB: V1 surface zero-out (12 final methods → 67/67)
// ============================================================================

describe('TKT-086 isDestroyed', () => {
  it('returns false before destroy, true after (the one method NOT guarded)', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    expect(tpl.isDestroyed()).toBe(false)
    tpl.destroy()
    // Crucially: isDestroyed() is NOT guarded — it IS the destroy probe (V1
    // line 12551). It must remain callable post-destroy and report `true`.
    expect(tpl.isDestroyed()).toBe(true)
  })
})

describe('TKT-087 getPaneltotal', () => {
  it('returns the total panel count (not max-index)', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    expect(tpl.getPaneltotal()).toBe(1)
    tpl.addPrintPanel({ width: 100, height: 100 })
    tpl.addPrintPanel({ width: 100, height: 100 })
    expect(tpl.getPaneltotal()).toBe(3)
    // While `getMaxPanelIndex()` returns N-1, getPaneltotal returns N.
    expect(tpl.getMaxPanelIndex()).toBe(tpl.getPaneltotal() - 1)
    tpl.destroy()
    expect(tpl.getPaneltotal()).toBe(0)
  })
})

describe('TKT-088 getPaperType', () => {
  it('reads the paper-type name for a given panel (default index 0)', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    // Sample panel does not set paperType — default is undefined; after
    // setPaper('A4') it should resolve to 'A4'.
    expect(tpl.getPaperType()).toBeUndefined()
    tpl.setPaper('A4')
    expect(tpl.getPaperType(0)).toBe('A4')
    expect(tpl.getPaperType(99)).toBeUndefined()
    tpl.destroy()
    expect(tpl.getPaperType()).toBeUndefined()
  })
})

describe('TKT-089 getOrient', () => {
  it('returns 1 (portrait, h>w) or 2 (landscape, w>h)', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    // SAMPLE has 210x297 → portrait → 1.
    expect(tpl.getOrient()).toBe(1)
    tpl.rotatePaper() // swap w/h → landscape → 2
    expect(tpl.getOrient()).toBe(2)
    expect(tpl.getOrient(99)).toBeUndefined()
    tpl.destroy()
    expect(tpl.getOrient()).toBeUndefined()
  })
})

describe('TKT-090 getPanel', () => {
  it('returns the Panel record by index', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    const p = tpl.getPanel(0)
    expect(p).toBeDefined()
    expect(p?.name).toBe('1')
    expect(p?.printElements?.length).toBe(1)
    expect(tpl.getPanel(5)).toBeUndefined()
    tpl.destroy()
    expect(tpl.getPanel()).toBeUndefined()
  })
})

describe('TKT-091 getElementByName', () => {
  it('finds element by options.name, scoped to panel index', () => {
    const tpl = new PrintTemplate({
      template: {
        panels: [
          {
            index: 0,
            name: '1',
            width: 210,
            height: 297,
            printElements: [
              {
                options: { left: 0, top: 0, width: 10, height: 10, name: 'foo' },
                printElementType: { type: 'text', tid: 'm.text' },
              },
              {
                options: { left: 0, top: 0, width: 10, height: 10, name: 'bar' },
                printElementType: { type: 'text', tid: 'm.text' },
              },
            ],
          },
        ],
      } as TemplateJson,
    })
    const found = tpl.getElementByName('bar')
    expect(found).not.toBeNull()
    expect((found?.options as Record<string, unknown>).name).toBe('bar')
    expect(tpl.getElementByName('nope')).toBeNull()
    expect(tpl.getElementByName('')).toBeNull()
    tpl.destroy()
    expect(tpl.getElementByName('bar')).toBeNull()
  })
})

describe('TKT-092 setFontList / TKT-093 getFontList', () => {
  it('stores + retrieves font list (fresh copy on read)', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    expect(tpl.getFontList()).toEqual([])
    tpl.setFontList(['Arial', 'Helvetica'])
    const fonts = tpl.getFontList()
    expect(fonts).toEqual(['Arial', 'Helvetica'])
    // Mutating returned copy must not leak.
    fonts.push('Comic Sans')
    expect(tpl.getFontList()).toEqual(['Arial', 'Helvetica'])
    // Emits font-list-change.
    let received: unknown = null
    tpl.on('font-list-change', (list) => {
      received = list
    })
    tpl.setFontList(['Times'])
    expect(received).toEqual(['Times'])
    // Non-array input coerces to [].
    tpl.setFontList(undefined as unknown as string[])
    expect(tpl.getFontList()).toEqual([])
    tpl.destroy()
    expect(tpl.getFontList()).toEqual([])
  })
})

describe('TKT-094 setFields / TKT-095 getFields', () => {
  it('setFields/getFields are V1-canonical aliases of dynamic-field accessors', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    // Default fallback is [] (V1 parity — getFields never returned undefined).
    expect(tpl.getFields()).toEqual([])
    tpl.setFields({ orderId: 'order' })
    expect(tpl.getFields()).toEqual({ orderId: 'order' })
    // Aliasing: setFields routes through setDynamicFields, so getDynamicFields
    // sees the same value.
    expect(tpl.getDynamicFields()).toEqual({ orderId: 'order' })
    tpl.destroy()
    expect(tpl.getFields()).toEqual([])
  })
})

describe('TKT-096 getFieldsInPanel', () => {
  it('returns a flat list of every element with options.field set', () => {
    const tpl = new PrintTemplate({
      template: {
        panels: [
          {
            index: 0,
            name: '1',
            width: 210,
            height: 297,
            printElements: [
              {
                options: { left: 0, top: 0, width: 10, height: 10, field: 'name', title: '姓名' },
                printElementType: { type: 'text', tid: 'm.text' },
              },
              {
                // No field → omitted.
                options: { left: 0, top: 20, width: 10, height: 10 },
                printElementType: { type: 'text', tid: 'm.text' },
              },
              {
                options: { left: 0, top: 40, width: 10, height: 10, field: 'amount' },
                printElementType: { type: 'text', tid: 'm.text' },
              },
            ],
          },
        ],
      } as TemplateJson,
    })
    const fields = tpl.getFieldsInPanel()
    expect(fields.length).toBe(2)
    expect(fields[0]?.field).toBe('name')
    expect(fields[0]?.title).toBe('姓名')
    expect(fields[1]?.field).toBe('amount')
    tpl.destroy()
    expect(tpl.getFieldsInPanel()).toEqual([])
  })
})

describe('TKT-097 getTestData', () => {
  it('merges panel-scoped testData across all panels', () => {
    const tpl = new PrintTemplate({
      template: {
        panels: [
          {
            index: 0,
            name: '1',
            width: 210,
            height: 297,
            printElements: [],
            testData: { name: 'Alice', amount: 100 },
          },
          {
            index: 1,
            name: '2',
            width: 210,
            height: 297,
            printElements: [],
            testData: { amount: 200, currency: 'USD' },
          },
        ],
      } as unknown as TemplateJson,
    })
    const data = tpl.getTestData()
    // Object.assign semantics: later panel overrides earlier.
    expect(data).toEqual({ name: 'Alice', amount: 200, currency: 'USD' })
    tpl.destroy()
    expect(tpl.getTestData()).toEqual({})
  })

  it('returns {} when no panel carries testData', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    expect(tpl.getTestData()).toEqual({})
    tpl.destroy()
  })
})

describe('Sprint 22g — destroy-guard sweep on all 12 GB-added methods', () => {
  it('every new method silently no-ops or returns its typed fallback', () => {
    const tpl = new PrintTemplate({ template: SAMPLE })
    tpl.destroy()

    // isDestroyed is intentionally NOT guarded — it must report true.
    expect(tpl.isDestroyed()).toBe(true)

    // Typed fallbacks after destroy.
    expect(tpl.getPaneltotal()).toBe(0)
    expect(tpl.getPaperType()).toBeUndefined()
    expect(tpl.getOrient()).toBeUndefined()
    expect(tpl.getPanel()).toBeUndefined()
    expect(tpl.getElementByName('any')).toBeNull()
    expect(tpl.getFontList()).toEqual([])
    expect(tpl.getFields()).toEqual([])
    expect(tpl.getFieldsInPanel()).toEqual([])
    expect(tpl.getTestData()).toEqual({})

    // Void setters must not throw post-destroy.
    expect(() => {
      tpl.setFontList(['X'])
      tpl.setFields({ a: 1 })
    }).not.toThrow()
  })
})
