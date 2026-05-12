/**
 * build-toolbar.spec.ts — V3 buildToolbar compat tests.
 *
 * Sprint 22c: 8 baseline tests (P19) + 28 new tests covering:
 *  - TKT-040 ~ TKT-049 ten toolbarCtrl method groups
 *  - TKT-100 V1 opts pass-through (button-text, dialog-title, list-provider,
 *    on-hook, close-on-select toggles, scale-change emission)
 *
 * Each test mounts the toolbar against a PrintTemplate's shared pinia so any
 * canvas/history mutation round-trips correctly.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'

vi.mock('@hiprint-v3/print', async () => {
  const actual = await vi.importActual<typeof import('@hiprint-v3/print')>('@hiprint-v3/print')
  return {
    ...actual,
    browserPrint: vi.fn(() => Promise.resolve()),
    downloadPdf: vi.fn(() => Promise.resolve()),
    getPrintHtml: vi.fn(() => '<div></div>'),
  }
})

import { PrintTemplate } from '../print-template'
import { buildToolbar } from '../build-toolbar'

let host: HTMLElement
beforeEach(() => {
  host = document.createElement('div')
  host.id = 'toolbar-host'
  document.body.appendChild(host)
})
afterEach(() => {
  if (host.parentNode) host.parentNode.removeChild(host)
})

// ============ Baseline (8 tests retained) ============

describe('buildToolbar — mount', () => {
  it('mounts toolbar into target element', () => {
    const tpl = new PrintTemplate()
    const ctrl = buildToolbar(host, tpl)
    expect(ctrl).toBeTruthy()
    expect(ctrl._app).toBeTruthy()
    expect(ctrl._container).toBe(host)
    expect(ctrl._destroyed).toBe(false)
    ctrl.destroy()
    tpl.destroy()
  })

  it('mounts via CSS selector', () => {
    const tpl = new PrintTemplate()
    const ctrl = buildToolbar('#toolbar-host', tpl)
    expect(ctrl._container).toBe(host)
    ctrl.destroy()
    tpl.destroy()
  })

  it('throws when container not found', () => {
    const tpl = new PrintTemplate()
    expect(() => buildToolbar('#missing', tpl)).toThrow(/container not found/)
    tpl.destroy()
  })

  it('throws when template is null', () => {
    expect(() => buildToolbar(host, null as unknown as PrintTemplate)).toThrow(
      /template is required/
    )
  })
})

describe('buildToolbar — controller', () => {
  it('destroy unmounts app and is idempotent', () => {
    const tpl = new PrintTemplate()
    const ctrl = buildToolbar(host, tpl)
    ctrl.destroy()
    expect(ctrl._destroyed).toBe(true)
    expect(() => ctrl.destroy()).not.toThrow()
    tpl.destroy()
  })

  it('getScale returns current canvas scale (default 1)', () => {
    const tpl = new PrintTemplate()
    const ctrl = buildToolbar(host, tpl)
    expect(ctrl.getScale()).toBe(1)
    ctrl.destroy()
    tpl.destroy()
  })

  it('setScale mutates canvas store; visible to template', () => {
    const tpl = new PrintTemplate()
    const ctrl = buildToolbar(host, tpl)
    ctrl.setScale(1.5)
    expect(ctrl.getScale()).toBe(1.5)
    ctrl.destroy()
    tpl.destroy()
  })

  it('getScale / setScale return safe fallback after destroy', () => {
    const tpl = new PrintTemplate()
    const ctrl = buildToolbar(host, tpl)
    ctrl.destroy()
    expect(ctrl.getScale()).toBe(1)
    expect(() => ctrl.setScale(2)).not.toThrow()
    tpl.destroy()
  })
})

// ============ Sprint 22c TKT-040: scale ============

describe('toolbarCtrl — TKT-040 scale extras', () => {
  it('setScale clamps non-finite gracefully', () => {
    const tpl = new PrintTemplate()
    const ctrl = buildToolbar(host, tpl)
    ctrl.setScale(Number.NaN)
    expect(ctrl.getScale()).toBe(1)
    ctrl.setScale(0.0001)
    // clamp lower at 0.1
    expect(ctrl.getScale()).toBeCloseTo(0.1)
    ctrl.setScale(99)
    // clamp upper at 5
    expect(ctrl.getScale()).toBe(5)
    ctrl.destroy()
    tpl.destroy()
  })
})

// ============ Sprint 22c TKT-041: extra-button registry ============

describe('toolbarCtrl — TKT-041 addToolbarButton / removeToolbarButton', () => {
  it('addToolbarButton injects a custom button and removeToolbarButton drops it', async () => {
    const tpl = new PrintTemplate()
    const ctrl = buildToolbar(host, tpl)
    const handler = vi.fn()
    ctrl.addToolbarButton({ id: 'my-pdf', label: 'PDF', onClick: handler })
    await nextTick()
    const btn = host.querySelector('[aria-label="PDF"]') as HTMLButtonElement
    expect(btn).toBeTruthy()
    btn.click()
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.calls[0]?.[0]).toBe(tpl)
    ctrl.removeToolbarButton('my-pdf')
    await nextTick()
    expect(host.querySelector('[aria-label="PDF"]')).toBeNull()
    ctrl.destroy()
    tpl.destroy()
  })

  it('addToolbarButton position="left" renders extras at start', async () => {
    const tpl = new PrintTemplate()
    const ctrl = buildToolbar(host, tpl)
    ctrl.addToolbarButton({ id: 'leader', label: 'LEAD', position: 'left' })
    await nextTick()
    const firstBtn = host.querySelector('.hiprint-toolbar button') as HTMLButtonElement
    expect(firstBtn?.getAttribute('aria-label')).toBe('LEAD')
    ctrl.destroy()
    tpl.destroy()
  })

  it('addToolbarButton with same id replaces previous registration', async () => {
    const tpl = new PrintTemplate()
    const ctrl = buildToolbar(host, tpl)
    ctrl.addToolbarButton({ id: 'x', label: 'first' })
    ctrl.addToolbarButton({ id: 'x', label: 'second' })
    await nextTick()
    const matches = host.querySelectorAll('[aria-label="first"], [aria-label="second"]')
    expect(matches.length).toBe(1)
    expect((matches[0] as HTMLElement).getAttribute('aria-label')).toBe('second')
    ctrl.destroy()
    tpl.destroy()
  })
})

// ============ Sprint 22c TKT-042: enableButton / disableButton ============

describe('toolbarCtrl — TKT-042 enableButton / disableButton', () => {
  it('disableButton flips the :disabled attr; enableButton lifts it', async () => {
    const tpl = new PrintTemplate()
    const ctrl = buildToolbar(host, tpl)
    await nextTick()
    const save = host.querySelector('[aria-label="Save"]') as HTMLButtonElement
    expect(save.disabled).toBe(false)
    ctrl.disableButton('save')
    await nextTick()
    expect(save.disabled).toBe(true)
    ctrl.enableButton('save')
    await nextTick()
    expect(save.disabled).toBe(false)
    ctrl.destroy()
    tpl.destroy()
  })
})

// ============ Sprint 22c TKT-043: setButtonText ============

describe('toolbarCtrl — TKT-043 setButtonText', () => {
  it('setButtonText overrides the label; setButtonText(id, null) clears it', async () => {
    const tpl = new PrintTemplate()
    const ctrl = buildToolbar(host, tpl)
    await nextTick()
    const save = host.querySelector('[aria-label="Save"]') as HTMLButtonElement
    const before = save.textContent?.trim()
    ctrl.setButtonText('save', 'PERSIST')
    await nextTick()
    expect(save.textContent?.trim()).toBe('PERSIST')
    ctrl.setButtonText('save', null)
    await nextTick()
    expect(save.textContent?.trim()).toBe(before)
    ctrl.destroy()
    tpl.destroy()
  })
})

// ============ Sprint 22c TKT-044: getActivePanel / setActivePanel ============

describe('toolbarCtrl — TKT-044 active panel', () => {
  it('getActivePanel returns current panel; setActivePanel by id switches', () => {
    const tpl = new PrintTemplate({
      template: {
        panels: [
          { index: 0, name: '1', width: 100, height: 100, printElements: [] },
          { index: 1, name: '2', width: 200, height: 200, printElements: [] },
        ],
      },
    })
    const ctrl = buildToolbar(host, tpl)
    const ap0 = ctrl.getActivePanel()
    expect(ap0?.name).toBe('1')
    const canvas = ctrl.getCanvasApi()
    const panel1Id = canvas.panels[1]!.id
    ctrl.setActivePanel(panel1Id)
    expect(ctrl.getActivePanel()?.name).toBe('2')
    ctrl.destroy()
    tpl.destroy()
  })

  it('setActivePanel by index (number) resolves to panels[idx].id', () => {
    const tpl = new PrintTemplate({
      template: {
        panels: [
          { index: 0, name: '1', width: 100, height: 100, printElements: [] },
          { index: 1, name: '2', width: 200, height: 200, printElements: [] },
        ],
      },
    })
    const ctrl = buildToolbar(host, tpl)
    ctrl.setActivePanel(1)
    expect(ctrl.getActivePanel()?.name).toBe('2')
    ctrl.setActivePanel(0)
    expect(ctrl.getActivePanel()?.name).toBe('1')
    // out-of-range index is ignored with warn
    ctrl.setActivePanel(99)
    expect(ctrl.getActivePanel()?.name).toBe('1')
    ctrl.destroy()
    tpl.destroy()
  })
})

// ============ Sprint 22c TKT-045: addPanel / removePanel ============

describe('toolbarCtrl — TKT-045 addPanel / removePanel', () => {
  it('addPanel inserts a new panel; removePanel(idx) deletes it', () => {
    const tpl = new PrintTemplate({
      template: {
        panels: [
          { index: 0, name: '1', width: 100, height: 100, printElements: [] },
          { index: 1, name: '2', width: 200, height: 200, printElements: [] },
        ],
      },
    })
    const ctrl = buildToolbar(host, tpl)
    const before = ctrl.getCanvasApi().panels.length
    const added = ctrl.addPanel({ width: 50, height: 50, name: 'extra' })
    expect(added).toBeTruthy()
    expect(ctrl.getCanvasApi().panels.length).toBe(before + 1)
    expect(ctrl.getCanvasApi().panels.at(-1)?.name).toBe('extra')
    ctrl.removePanel(ctrl.getCanvasApi().panels.length - 1)
    expect(ctrl.getCanvasApi().panels.length).toBe(before)
    ctrl.destroy()
    tpl.destroy()
  })

  it('removePanel keeps at least 1 panel (state-modeler R3 invariant)', () => {
    const tpl = new PrintTemplate({
      template: {
        panels: [{ index: 0, name: '1', width: 100, height: 100, printElements: [] }],
      },
    })
    const ctrl = buildToolbar(host, tpl)
    ctrl.removePanel(0)
    expect(ctrl.getCanvasApi().panels.length).toBe(1)
    ctrl.destroy()
    tpl.destroy()
  })
})

// ============ Sprint 22c TKT-046: setPaper / rotatePaper ============

describe('toolbarCtrl — TKT-046 paper', () => {
  it('setPaper switches active-panel dimensions (mm → pt) and label', () => {
    const tpl = new PrintTemplate()
    const ctrl = buildToolbar(host, tpl)
    ctrl.setPaper('A5')
    const panel = ctrl.getActivePanel()
    // A5 is 148 × 210 mm → 148/25.4*72 ≈ 419.53 pt, 210/25.4*72 ≈ 595.28 pt
    expect(panel?.paperType).toBe('A5')
    expect(panel!.width).toBeCloseTo((148 / 25.4) * 72, 1)
    expect(panel!.height).toBeCloseTo((210 / 25.4) * 72, 1)
    ctrl.destroy()
    tpl.destroy()
  })

  it('rotatePaper swaps active-panel width and height', () => {
    const tpl = new PrintTemplate()
    const ctrl = buildToolbar(host, tpl)
    const before = ctrl.getActivePanel()!
    const w0 = before.width
    const h0 = before.height
    ctrl.rotatePaper()
    const after = ctrl.getActivePanel()!
    expect(after.width).toBe(h0)
    expect(after.height).toBe(w0)
    ctrl.destroy()
    tpl.destroy()
  })
})

// ============ Sprint 22c TKT-047: getJson / setJson ============

describe('toolbarCtrl — TKT-047 getJson / setJson', () => {
  it('getJson returns current template JSON; setJson replaces it', () => {
    const tpl = new PrintTemplate({
      template: {
        panels: [{ index: 0, name: 'one', width: 100, height: 100, printElements: [] }],
      },
    })
    const ctrl = buildToolbar(host, tpl)
    expect(ctrl.getJson().panels.length).toBe(1)
    ctrl.setJson({
      panels: [
        { index: 0, name: 'A', width: 100, height: 100, printElements: [] },
        { index: 1, name: 'B', width: 100, height: 100, printElements: [] },
      ],
    })
    expect(ctrl.getJson().panels.length).toBe(2)
    ctrl.destroy()
    tpl.destroy()
  })
})

// ============ Sprint 22c TKT-048: on / off / emit ============

describe('toolbarCtrl — TKT-048 event bus', () => {
  it('on/emit/off basic round-trip with custom event', () => {
    const tpl = new PrintTemplate()
    const ctrl = buildToolbar(host, tpl)
    const handler = vi.fn()
    const off = ctrl.on('custom', handler)
    ctrl.emit('custom', 'a', 'b')
    expect(handler).toHaveBeenCalledWith('a', 'b')
    off()
    ctrl.emit('custom', 'c')
    expect(handler).toHaveBeenCalledTimes(1)
    ctrl.destroy()
    tpl.destroy()
  })

  it('scale-change auto-fires when canvas store scale mutates', async () => {
    const tpl = new PrintTemplate()
    const ctrl = buildToolbar(host, tpl)
    const handler = vi.fn()
    ctrl.on('scale-change', handler)
    ctrl.setScale(1.7)
    await nextTick()
    expect(handler).toHaveBeenCalledWith(1.7)
    ctrl.destroy()
    tpl.destroy()
  })

  it('panel-change auto-fires when active panel id changes', async () => {
    const tpl = new PrintTemplate({
      template: {
        panels: [
          { index: 0, name: '1', width: 100, height: 100, printElements: [] },
          { index: 1, name: '2', width: 200, height: 200, printElements: [] },
        ],
      },
    })
    const ctrl = buildToolbar(host, tpl)
    const handler = vi.fn()
    ctrl.on('panel-change', handler)
    ctrl.setActivePanel(1)
    // Pinia $subscribe is flushed on microtask; await nextTick to observe it.
    await nextTick()
    expect(handler).toHaveBeenCalled()
    const lastCall = handler.mock.calls.at(-1)
    expect((lastCall?.[0] as { name: string } | null)?.name).toBe('2')
    ctrl.destroy()
    tpl.destroy()
  })

  it('paper-change auto-fires when active-panel dimensions change', async () => {
    const tpl = new PrintTemplate()
    const ctrl = buildToolbar(host, tpl)
    const handler = vi.fn()
    ctrl.on('paper-change', handler)
    ctrl.setPaper('A5')
    await nextTick()
    expect(handler).toHaveBeenCalled()
    const lastCall = handler.mock.calls.at(-1)
    const dims = lastCall?.[1] as { width: number; height: number; paperType: string }
    expect(dims.paperType).toBe('A5')
    ctrl.destroy()
    tpl.destroy()
  })

  it('history-change auto-fires when undo/redo state changes', async () => {
    const tpl = new PrintTemplate()
    const ctrl = buildToolbar(host, tpl)
    const handler = vi.fn()
    ctrl.on('history-change', handler)
    // Trigger a real history state change: push a snapshot via setPaper +
    // then undo so canUndo flips false → true → false. Pinia $subscribe
    // is flushed on the *next* microtask after the mutation, so two awaits
    // are required to observe back-to-back actions.
    ctrl.setPaper('A3')
    await nextTick()
    await nextTick()
    tpl.undo()
    await nextTick()
    await nextTick()
    expect(handler).toHaveBeenCalled()
    const last = handler.mock.calls.at(-1)
    expect(last?.[0]).toHaveProperty('canUndo')
    expect(last?.[0]).toHaveProperty('canRedo')
    ctrl.destroy()
    tpl.destroy()
  })
})

// ============ Sprint 22c TKT-049: composition entry points ============

describe('toolbarCtrl — TKT-049 getTemplateApi / getCanvasApi', () => {
  it('getTemplateApi returns the PrintTemplate instance', () => {
    const tpl = new PrintTemplate()
    const ctrl = buildToolbar(host, tpl)
    expect(ctrl.getTemplateApi()).toBe(tpl)
    ctrl.destroy()
    tpl.destroy()
  })

  it('getCanvasApi returns the same canvas store shared with the template', () => {
    const tpl = new PrintTemplate()
    const ctrl = buildToolbar(host, tpl)
    const canvas = ctrl.getCanvasApi()
    expect(canvas).toBeTruthy()
    expect(Array.isArray(canvas.panels)).toBe(true)
    ctrl.setScale(2)
    expect(canvas.scale).toBe(2)
    ctrl.destroy()
    tpl.destroy()
  })
})

// ============ Sprint 22c TKT-100: V1 opt pass-through ============

describe('buildToolbar — TKT-100 V1 opts pass-through', () => {
  it('saveButtonText overrides the save button label', async () => {
    const tpl = new PrintTemplate()
    const ctrl = buildToolbar(host, tpl, { saveButtonText: 'STORE' })
    await nextTick()
    const save = host.querySelector('[aria-label="Save"]') as HTMLButtonElement
    expect(save.textContent?.trim()).toBe('STORE')
    ctrl.destroy()
    tpl.destroy()
  })

  it('previewButtonText / printButtonText / clearButtonText all override defaults', async () => {
    const tpl = new PrintTemplate()
    const ctrl = buildToolbar(host, tpl, {
      previewButtonText: 'PV',
      printButtonText: 'PR',
      clearButtonText: 'RM',
    })
    await nextTick()
    expect(
      (host.querySelector('[aria-label="Preview"]') as HTMLElement).textContent?.trim()
    ).toBe('PV')
    expect(
      (host.querySelector('[aria-label="Print"]') as HTMLElement).textContent?.trim()
    ).toBe('PR')
    expect(
      (host.querySelector('[aria-label="Clear template"]') as HTMLElement).textContent?.trim()
    ).toBe('RM')
    ctrl.destroy()
    tpl.destroy()
  })

  it('templateButtonText + showTemplateSelect true render labelled button', async () => {
    const tpl = new PrintTemplate()
    const ctrl = buildToolbar(host, tpl, {
      showTemplateSelect: true,
      templateButtonText: 'TPL',
    })
    await nextTick()
    const btn = host.querySelector('[aria-label="Templates"]') as HTMLElement
    expect(btn?.textContent?.trim()).toBe('TPL')
    ctrl.destroy()
    tpl.destroy()
  })

  it('businessButtonText + showBusinessSelect true render labelled button', async () => {
    const tpl = new PrintTemplate()
    const ctrl = buildToolbar(host, tpl, {
      showBusinessSelect: true,
      businessButtonText: 'BIZ',
    })
    await nextTick()
    const btn = host.querySelector('[aria-label="Business"]') as HTMLElement
    expect(btn?.textContent?.trim()).toBe('BIZ')
    ctrl.destroy()
    tpl.destroy()
  })

  it('onSave hook receives (tpl, json, event, api, ctx) signature', () => {
    const tpl = new PrintTemplate()
    const onSave = vi.fn()
    const ctrl = buildToolbar(host, tpl, { onSave })
    const save = host.querySelector('[aria-label="Save"]') as HTMLButtonElement
    save.click()
    expect(onSave).toHaveBeenCalledTimes(1)
    const args = onSave.mock.calls[0]!
    expect(args[0]).toBe(tpl) // tpl
    expect(args[1]).toHaveProperty('panels') // json
    expect(args[2]).toBe(null) // event
    expect(args[4]).toEqual({}) // ctx
    ctrl.destroy()
    tpl.destroy()
  })

  it('onScaleChange fires with the new scale value via zoom-in button', () => {
    const tpl = new PrintTemplate()
    const onScaleChange = vi.fn()
    const ctrl = buildToolbar(host, tpl, { onScaleChange })
    const zoomIn = host.querySelector('[aria-label="Zoom in"]') as HTMLButtonElement
    zoomIn.click()
    expect(onScaleChange).toHaveBeenCalled()
    const arg = onScaleChange.mock.calls[0]?.[0]
    expect(typeof arg).toBe('number')
    expect(arg).toBeGreaterThan(1)
    ctrl.destroy()
    tpl.destroy()
  })

  it('onPaperChange fires with (name, {width, height}) after paper select', () => {
    const tpl = new PrintTemplate()
    const onPaperChange = vi.fn()
    const ctrl = buildToolbar(host, tpl, { onPaperChange })
    const sel = host.querySelector('select[aria-label="Paper size"]') as HTMLSelectElement
    sel.value = 'A3'
    sel.dispatchEvent(new Event('change'))
    expect(onPaperChange).toHaveBeenCalled()
    const [name, size] = onPaperChange.mock.calls[0]!
    expect(name).toBe('A3')
    expect(size).toHaveProperty('width', 297)
    expect(size).toHaveProperty('height', 420)
    ctrl.destroy()
    tpl.destroy()
  })

  it('Sprint 22d TKT-158: no Align buttons render in toolbar (align moved to contextmenu)', async () => {
    const tpl = new PrintTemplate()
    const onAlign = vi.fn()
    const ctrl = buildToolbar(host, tpl, { onAlign })
    // V1 inventory §1.21/§1.22: V1 only exposes alignment via the element
    // right-click contextmenu. Sprint 22d rolled back the V3 toolbar
    // alignment buttons to match V1. The `onAlign` callback is still
    // accepted on the opts surface for V1 back-compat but no DOM button
    // fires it from the toolbar — alignment fires from contextmenu via
    // `template.alignElements()` (see context-menu-align.spec.ts).
    await nextTick()
    expect(host.querySelector('[aria-label="Align left"]')).toBeNull()
    expect(host.querySelector('[aria-label="Align center"]')).toBeNull()
    expect(host.querySelector('[aria-label="Align right"]')).toBeNull()
    expect(host.querySelector('[aria-label="Align top"]')).toBeNull()
    expect(host.querySelector('[aria-label="Align middle"]')).toBeNull()
    expect(host.querySelector('[aria-label="Align bottom"]')).toBeNull()
    // Callback never fires — the toolbar no longer invokes it.
    expect(onAlign).not.toHaveBeenCalled()
    ctrl.destroy()
    tpl.destroy()
  })

  it('onRotate hook fires with (tpl) signature', () => {
    const tpl = new PrintTemplate()
    const onRotate = vi.fn()
    const ctrl = buildToolbar(host, tpl, { onRotate })
    const r = host.querySelector('[aria-label="Rotate paper"]') as HTMLButtonElement
    r.click()
    expect(onRotate).toHaveBeenCalled()
    expect(onRotate.mock.calls[0]?.[0]).toBe(tpl)
    ctrl.destroy()
    tpl.destroy()
  })

  it('onPreview hook overrides the V3 default preview', () => {
    const tpl = new PrintTemplate()
    const onPreview = vi.fn()
    const ctrl = buildToolbar(host, tpl, { onPreview })
    const p = host.querySelector('[aria-label="Preview"]') as HTMLButtonElement
    p.click()
    expect(onPreview).toHaveBeenCalled()
    expect(onPreview.mock.calls[0]?.[0]).toBe(tpl)
    ctrl.destroy()
    tpl.destroy()
  })

  it('paperTypes opt overrides defaults; select shows custom labels', async () => {
    const tpl = new PrintTemplate()
    const ctrl = buildToolbar(host, tpl, {
      paperTypes: [
        { label: 'Letter', width: 215.9, height: 279.4 },
        { label: 'Legal', width: 215.9, height: 355.6 },
      ],
    })
    await nextTick()
    const opts = host.querySelectorAll('select[aria-label="Paper size"] option')
    const labels = Array.from(opts).map((o) => (o as HTMLOptionElement).value)
    expect(labels).toEqual(['Letter', 'Legal'])
    ctrl.destroy()
    tpl.destroy()
  })

  it('options that are typed in the V1 opts surface compile-pass-through', () => {
    // Sanity test: every documented dialog-text + list-provider opt should be
    // accepted by the TS surface without `any`. This is a typecheck assertion
    // dressed as a runtime test (passes if the constructor does not throw).
    const tpl = new PrintTemplate()
    const opts = {
      businessDialogTitle: 'biz',
      businessDialogEmptyText: 'empty',
      businessDialogLoadingText: 'load',
      businessDialogErrorText: 'err',
      templateDialogTitle: 'tpl',
      templateDialogEmptyText: 'e',
      templateDialogLoadingText: 'l',
      templateDialogErrorText: 'r',
      saveDialogTitle: 'save',
      saveDialogNameLabel: 'name',
      saveDialogNamePlaceholder: 'enter…',
      saveDialogNameRequiredText: 'required',
      saveDialogConfirmText: 'OK',
      saveDialogCancelText: 'CANCEL',
      closeBusinessDialogOnSelect: false,
      closeTemplateDialogOnSelect: false,
      businessListProvider: () => Promise.resolve([{ id: '1' }]),
      templateListProvider: () => [{ id: 't1' }],
      businessLoader: () => ({ ok: 1 }),
      templateLoader: () => ({ panels: [] }),
      onBusinessSelect: vi.fn(),
      onBusinessError: vi.fn(),
      onBusinessClick: vi.fn(),
      onTemplateSelect: vi.fn(),
      onTemplateSelectError: vi.fn(),
      onTemplatePreview: vi.fn(),
      onTemplateEdit: vi.fn(),
      onTemplateDelete: vi.fn(),
      onTemplateDeleteConfirm: vi.fn(),
      onClearConfirm: vi.fn(),
      onCustomPaperOpen: vi.fn(),
      customPaperConfirmText: 'apply',
      panelManagerLabel: 'pages',
      addPanelButtonText: 'add',
      extraPosition: 'start' as const,
    }
    const ctrl = buildToolbar(host, tpl, opts)
    expect(ctrl).toBeTruthy()
    ctrl.destroy()
    tpl.destroy()
  })
})
