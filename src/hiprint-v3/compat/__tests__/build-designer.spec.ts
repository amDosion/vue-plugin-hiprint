/**
 * build-designer.spec.ts — V3 buildDesigner compat tests (P19).
 *
 * Mounts designer SFC + verifies controller surface (getJson / update / destroy /
 * stub setComponentPanelSlot warning).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@hiprint-v3/print', async () => {
  const actual = await vi.importActual<typeof import('@hiprint-v3/print')>('@hiprint-v3/print')
  return {
    ...actual,
    browserPrint: vi.fn(() => Promise.resolve()),
    downloadPdf: vi.fn(() => Promise.resolve()),
    getPrintHtml: vi.fn(() => '<div></div>'),
  }
})

import { buildDesigner } from '../build-designer'
import type { TemplateJson } from '@hiprint-v3/schemas'

const SAMPLE: TemplateJson = {
  panels: [
    {
      index: 0,
      name: '1',
      width: 210,
      height: 297,
      printElements: [],
    },
  ],
}

let host: HTMLElement
beforeEach(() => {
  host = document.createElement('div')
  host.id = 'designer-host'
  document.body.appendChild(host)
})
afterEach(() => {
  if (host.parentNode) host.parentNode.removeChild(host)
})

describe('buildDesigner — mount', () => {
  it('mounts designer into target element', () => {
    const ctrl = buildDesigner(host)
    expect(ctrl._app).toBeTruthy()
    expect(ctrl._container).toBe(host)
    expect(ctrl._destroyed).toBe(false)
    ctrl.destroy()
  })

  it('mounts via CSS selector', () => {
    const ctrl = buildDesigner('#designer-host')
    expect(ctrl._container).toBe(host)
    ctrl.destroy()
  })

  it('throws when container not found', () => {
    expect(() => buildDesigner('#missing')).toThrow(/container not found/)
  })
})

describe('buildDesigner — controller', () => {
  it('getJson returns the loaded template', () => {
    const ctrl = buildDesigner(host, { template: SAMPLE })
    const json = ctrl.getJson()
    expect(json.panels.length).toBe(1)
    ctrl.destroy()
  })

  it('update replaces JSON; getJson reflects new state', () => {
    const ctrl = buildDesigner(host, { template: SAMPLE })
    expect(ctrl.getJson().panels.length).toBe(1)
    ctrl.update({
      panels: [
        { index: 0, name: '1', width: 100, height: 100, printElements: [] },
        { index: 1, name: '2', width: 100, height: 100, printElements: [] },
      ],
    })
    expect(ctrl.getJson().panels.length).toBe(2)
    ctrl.destroy()
  })

  it('getTemplate is alias of getJson', () => {
    const ctrl = buildDesigner(host, { template: SAMPLE })
    const a = ctrl.getJson()
    const b = ctrl.getTemplate()
    expect(a.panels.length).toBe(b.panels.length)
    ctrl.destroy()
  })

  it('destroy unmounts + clears stores; idempotent', () => {
    const ctrl = buildDesigner(host, { template: SAMPLE })
    ctrl.destroy()
    expect(ctrl._destroyed).toBe(true)
    expect(() => ctrl.destroy()).not.toThrow()
  })

  it('getJson after destroy returns safe fallback', () => {
    const ctrl = buildDesigner(host, { template: SAMPLE })
    ctrl.destroy()
    const json = ctrl.getJson()
    expect(json.panels.length).toBe(0)
  })

  it('setComponentPanelSlot warns + no-op', () => {
    const ctrl = buildDesigner(host)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    ctrl.setComponentPanelSlot({ foo: 'bar' })
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('setComponentPanelSlot is a no-op')
    )
    warn.mockRestore()
    ctrl.destroy()
  })

  it('rebuildComponentPanel warns + no-op', () => {
    const ctrl = buildDesigner(host)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    ctrl.rebuildComponentPanel('moduleA')
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('rebuildComponentPanel: V3 element list is reactive')
    )
    warn.mockRestore()
    ctrl.destroy()
  })

  it('getToolbarCtrl returns stub with getScale/setScale', () => {
    const ctrl = buildDesigner(host)
    const tb = ctrl.getToolbarCtrl()
    expect(typeof tb.getScale).toBe('function')
    expect(typeof tb.setScale).toBe('function')
    expect(tb.getScale()).toBe(1)
    expect(() => tb.setScale(2)).not.toThrow()
    ctrl.destroy()
  })
})
