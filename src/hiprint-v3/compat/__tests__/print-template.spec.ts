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

  it('constructs without options (panels empty)', () => {
    const tpl = new PrintTemplate()
    expect(tpl).toBeInstanceOf(PrintTemplate)
    expect(tpl._destroyed).toBe(false)
    expect(tpl.getJson().panels.length).toBe(0)
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
