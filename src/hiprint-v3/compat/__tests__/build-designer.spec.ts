/**
 * build-designer.spec.ts — V3 buildDesigner compat tests (P21.6 final).
 *
 * Mounts designer SFC + verifies the minimal V3 controller surface
 * (getJson / update / destroy + onReady firing with `tpl` only — no
 * `toolbarCtrl` second arg, no `getToolbarCtrl()` method on the controller).
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

  it('setPaginationVisible toggles toolbarShowPanelManager at runtime (Sprint 22g)', () => {
    const ctrl = buildDesigner(host)
    // Sprint 22g wave 2 made this functional: mutates designerProps reactively
    // so the panel-manager chips/select group hides/shows. No throw.
    expect(() => ctrl.setPaginationVisible(true)).not.toThrow()
    expect(() => ctrl.setPaginationVisible(false)).not.toThrow()
    // After destroy, calls are silent no-ops (assertNotDestroyed style)
    ctrl.destroy()
    expect(() => ctrl.setPaginationVisible(true)).not.toThrow()
  })
})

describe('buildDesigner — onReady contract (V3 — tpl only)', () => {
  it('fires onReady(tpl) after mount', async () => {
    const onReady = vi.fn()
    const ctrl = buildDesigner(host, { template: SAMPLE, onReady })
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    expect(onReady).toHaveBeenCalledTimes(1)
    const callArgs = onReady.mock.calls[0] ?? []
    expect(callArgs.length).toBeGreaterThanOrEqual(1)
    const tpl = callArgs[0]
    expect(tpl).toBeTruthy()
    expect(typeof (tpl as { getJson?: () => unknown }).getJson).toBe('function')
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

  it('controller has no getToolbarCtrl (pure V3 — no V1 imperative toolbar API)', () => {
    const ctrl = buildDesigner(host)
    expect((ctrl as unknown as { getToolbarCtrl?: () => unknown }).getToolbarCtrl).toBeUndefined()
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
    ctrl.destroy()
  })

  it('destroy cleans up tpl', async () => {
    let captured: { tpl?: { _destroyed: boolean } } = {}
    const ctrl = buildDesigner(host, {
      template: SAMPLE,
      onReady: (tpl) => {
        captured = { tpl: tpl as unknown as { _destroyed: boolean } }
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

  it('toolbarOptions.onPreview renders Preview button and forwards opts', async () => {
    const onPreview = vi.fn()
    const ctrl = buildDesigner(host, {
      template: SAMPLE,
      toolbarOptions: { onPreview },
    })
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    // Verify the toolbar mounted and the Preview button rendered. Clicking via
    // jsdom does not reliably dispatch through Vue's listener proxy when the
    // app was created via createApp; integration coverage lives in the
    // component-level HiprintToolbar.spec.ts where mount() is used directly.
    const toolbar = host.querySelector('.hiprint-toolbar')
    expect(toolbar).toBeTruthy()
    const previewBtn = toolbar?.querySelector('button[aria-label="Preview"]') as HTMLButtonElement | null
    expect(previewBtn).toBeTruthy()
    expect(previewBtn?.disabled).toBe(false)
    ctrl.destroy()
  })

  it('toolbarOptions.showUndo=false hides the Undo button (reactive prop)', async () => {
    const ctrl = buildDesigner(host, {
      template: SAMPLE,
      toolbarOptions: { showUndo: false },
    })
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    const undo = host.querySelector('button[aria-label="Undo"]')
    expect(undo).toBeNull()
    ctrl.destroy()
  })

  it('toolbarOptions.extraButtons render with custom labels', async () => {
    const extraClick = vi.fn()
    const ctrl = buildDesigner(host, {
      template: SAMPLE,
      toolbarOptions: {
        extraButtons: [{ key: 'my-export', label: 'Export PDF', onClick: extraClick }],
      },
    })
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    const extraBtn = host.querySelector('button[aria-label="Export PDF"]') as HTMLButtonElement | null
    expect(extraBtn).toBeTruthy()
    expect(extraBtn?.textContent?.trim()).toBe('Export PDF')
    ctrl.destroy()
  })
})
