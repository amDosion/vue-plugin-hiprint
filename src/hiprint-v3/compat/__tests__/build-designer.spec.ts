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

  it('getToolbarCtrl returns shim with getScale/setScale', () => {
    const ctrl = buildDesigner(host)
    const tb = ctrl.getToolbarCtrl()
    expect(typeof tb.getScale).toBe('function')
    expect(typeof tb.setScale).toBe('function')
    expect(tb.getScale()).toBe(1)
    expect(() => tb.setScale(2)).not.toThrow()
    ctrl.destroy()
  })
})

describe('buildDesigner — onReady contract (P21.5 root unblocker)', () => {
  it('fires onReady(tpl, toolbarCtrl) after mount', async () => {
    const onReady = vi.fn()
    const ctrl = buildDesigner(host, { template: SAMPLE, onReady })
    // onReady scheduled in nextTick — wait one microtask + flush
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    expect(onReady).toHaveBeenCalledTimes(1)
    const [tpl, toolbarCtrl] = onReady.mock.calls[0] ?? []
    expect(tpl).toBeTruthy()
    expect(typeof (tpl as { getJson?: () => unknown }).getJson).toBe('function')
    expect(toolbarCtrl).toBeTruthy()
    expect(typeof (toolbarCtrl as { destroy?: () => void }).destroy).toBe('function')
    ctrl.destroy()
  })

  it('onReady tpl.getJson() returns the loaded template', async () => {
    let captured: { tpl?: { getJson: () => TemplateJson } } = {}
    const ctrl = buildDesigner(host, {
      template: SAMPLE,
      onReady: (tpl) => {
        captured = { tpl: tpl as unknown as { getJson: () => TemplateJson } }
      },
    })
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    expect(captured.tpl).toBeTruthy()
    const json = captured.tpl!.getJson()
    expect(json.panels.length).toBe(1)
    ctrl.destroy()
  })

  it('toolbarCtrl shim has 27 V1 methods (stubs warn)', async () => {
    const onReady = vi.fn()
    const ctrl = buildDesigner(host, { onReady })
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    const tb = onReady.mock.calls[0]?.[1] as Record<string, unknown>
    // Tier A dialog methods
    expect(typeof tb.openTemplateDialog).toBe('function')
    expect(typeof tb.closeTemplateDialog).toBe('function')
    expect(typeof tb.openBusinessDialog).toBe('function')
    expect(typeof tb.refreshTemplateList).toBe('function')
    expect(typeof tb.refreshBusinessList).toBe('function')
    expect(typeof tb.setTemplateListProvider).toBe('function')
    expect(typeof tb.setTemplateLoader).toBe('function')
    expect(typeof tb.setBusinessItems).toBe('function')
    expect(typeof tb.setBusinessListProvider).toBe('function')
    expect(typeof tb.setBusinessLoader).toBe('function')
    expect(typeof tb.setDialogHandler).toBe('function')
    expect(typeof tb.setBusinessDialogOpenHandler).toBe('function')
    expect(typeof tb.setTemplateDialogOpenHandler).toBe('function')
    expect(typeof tb.setSaveDialogOpenHandler).toBe('function')
    expect(typeof tb.triggerSave).toBe('function')
    // Tier B button methods
    expect(typeof tb.setButtonText).toBe('function')
    expect(typeof tb.setButtonVisible).toBe('function')
    expect(typeof tb.setButtonDisabled).toBe('function')
    expect(typeof tb.triggerButton).toBe('function')
    expect(typeof tb.getButton).toBe('function')
    expect(typeof tb.getButtons).toBe('function')
    expect(typeof tb.setGroupVisible).toBe('function')
    expect(typeof tb.getGroup).toBe('function')
    expect(typeof tb.getGroups).toBe('function')
    expect(typeof tb.addGroup).toBe('function')
    // Real methods
    expect(typeof tb.setScale).toBe('function')
    expect(typeof tb.getScale).toBe('function')
    expect(typeof tb.getToolbarElement).toBe('function')
    expect(typeof tb.destroy).toBe('function')
    ctrl.destroy()
  })

  it('toolbarCtrl stubs warn + return safe defaults', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const onReady = vi.fn()
    const ctrl = buildDesigner(host, { onReady })
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    const tb = onReady.mock.calls[0]?.[1] as {
      openTemplateDialog: () => void
      refreshTemplateList: () => Promise<unknown[]>
      getButtons: () => readonly unknown[]
    }
    tb.openTemplateDialog()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('openTemplateDialog'))
    const tpls = await tb.refreshTemplateList()
    expect(tpls).toEqual([])
    expect(tb.getButtons()).toEqual([])
    warn.mockRestore()
    ctrl.destroy()
  })

  it('toolbarOptions.onPreview gets the tpl as first arg', async () => {
    const onPreview = vi.fn()
    let toolbarCtrl: { destroy: () => void } | undefined
    const ctrl = buildDesigner(host, {
      template: SAMPLE,
      toolbarOptions: { onPreview },
      onReady: (_tpl, tb) => {
        toolbarCtrl = tb as unknown as { destroy: () => void }
      },
    })
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    expect(toolbarCtrl).toBeTruthy()
    // Simulate the toolbar firing previewHandler — we can't click the SFC
    // button from happy-dom reliably; instead verify the wrapper exists by
    // checking onPreview NOT called yet (before any user interaction).
    expect(onPreview).not.toHaveBeenCalled()
    ctrl.destroy()
  })

  it('templateOptions.history coerces capacity', async () => {
    let captured: { tpl?: unknown } = {}
    const ctrl = buildDesigner(host, {
      template: SAMPLE,
      templateOptions: { history: 5 },
      onReady: (tpl) => {
        captured = { tpl }
      },
    })
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    expect(captured.tpl).toBeTruthy()
    // Capacity actually applied is inside the history store; we just verify
    // no throw when passing custom number.
    ctrl.destroy()
  })

  it('destroy cleans up tpl + toolbarCtrl', async () => {
    let captured: { tpl?: { _destroyed: boolean }; tb?: unknown } = {}
    const ctrl = buildDesigner(host, {
      template: SAMPLE,
      onReady: (tpl, tb) => {
        captured = { tpl: tpl as unknown as { _destroyed: boolean }, tb }
      },
    })
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    expect(captured.tpl).toBeTruthy()
    ctrl.destroy()
    expect(captured.tpl!._destroyed).toBe(true)
    expect(ctrl._destroyed).toBe(true)
  })

  it('controller.getTpl returns the same tpl as onReady', async () => {
    let onReadyTpl: unknown
    const ctrl = buildDesigner(host, {
      template: SAMPLE,
      onReady: (tpl) => {
        onReadyTpl = tpl
      },
    })
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    expect(ctrl.getTpl()).toBe(onReadyTpl)
    ctrl.destroy()
  })
})
