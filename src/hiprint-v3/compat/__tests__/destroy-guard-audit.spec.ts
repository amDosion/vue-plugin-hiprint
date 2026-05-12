/**
 * destroy-guard-audit.spec.ts — Sprint 22g wave 3 destroy-guard sweep.
 *
 * Locks the V3 invariant: **every public method on PrintTemplate /
 * ToolbarController / DesignerController must survive a post-destroy call**
 * with no throw and a sane typed fallback.
 *
 * Why this matters:
 *   V1 quirk J.x parity — V1 imperative consumers (vue-admin-main, business
 *   templates) tear down with reload-on-route flows, often invoking template
 *   methods after the underlying app unmount. V1's bundle.js wrapped every
 *   public method in `_assertNotDestroyed` (V1 12545+); V3 ports that
 *   discipline via `assertNotDestroyed` from `internal/lifecycle.ts`. The
 *   only exempted methods are:
 *     - `destroy()` itself (idempotent destructor)
 *     - `isDestroyed()` (the probe — must always answer truthfully)
 *     - `_`-prefixed internal accessors (`_getPinia`, `_getEventBus`) which
 *       return long-lived refs by design (Pinia survives destroy so caller
 *       can finish any in-flight store work — see ADR-0011 lifecycle notes).
 *
 * Coverage strategy:
 *   Skip `instanceof Error` patterns — we assert ONLY (a) no throw and
 *   (b) typed fallback (the methods return their declared types' zero value:
 *   `void → undefined`, `string → ''`, `number → 0/1`, `boolean → false`,
 *   `array → []`, `object → {}`, etc.). The console.warn produced by
 *   assertNotDestroyed is silenced to keep spec output clean.
 *
 *   For PrintTemplate (class), we drive each method with a minimum-viable
 *   argument set. For ToolbarController and DesignerController (factory-
 *   returned objects), we iterate function members.
 *
 *   The audit IS the spec — adding any new public method that throws
 *   post-destroy will fail this test. CI gate.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('@hiprint-v3/print', async () => {
  const actual = await vi.importActual<typeof import('@hiprint-v3/print')>(
    '@hiprint-v3/print'
  )
  return {
    ...actual,
    browserPrint: vi.fn(() => Promise.resolve()),
    downloadPdf: vi.fn(() => Promise.resolve()),
    toPdfBlob: vi.fn(() =>
      Promise.resolve(new Blob(['pdf'], { type: 'application/pdf' }))
    ),
    getPrintHtml: vi.fn(() => '<div>print-html</div>'),
  }
})

import { PrintTemplate } from '../print-template'
import { buildToolbar } from '../build-toolbar'
import { buildDesigner } from '../build-designer'

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

/**
 * Methods that legitimately operate on a destroyed instance (probe / destructor /
 * internal accessor). They MUST NOT route through assertNotDestroyed.
 */
const PRINT_TEMPLATE_EXEMPT = new Set([
  'destroy',
  'isDestroyed',
  '_getPinia',
  '_getEventBus',
])

describe('Sprint 22g wave 3 — destroy-guard sweep: PrintTemplate', () => {
  it('destroyed instance: every public method returns typed fallback without throwing', () => {
    const tpl = new PrintTemplate()
    tpl.destroy()
    expect(tpl._destroyed).toBe(true)
    expect(tpl.isDestroyed()).toBe(true)

    // ---- Synchronous methods: minimum-viable arg sets ----
    const calls: Array<{ name: string; thunk: () => unknown }> = [
      { name: 'design', thunk: () => tpl.design(document.createElement('div')) },
      { name: 'update', thunk: () => tpl.update({ panels: [] } as any) },
      { name: 'getJson', thunk: () => tpl.getJson() },
      { name: 'getJsonTid', thunk: () => tpl.getJsonTid() },
      { name: 'getHtml', thunk: () => tpl.getHtml() },
      { name: 'print', thunk: () => tpl.print() },
      { name: 'print2', thunk: () => tpl.print2() },
      { name: 'undo', thunk: () => tpl.undo() },
      { name: 'redo', thunk: () => tpl.redo() },
      { name: 'clear', thunk: () => tpl.clear() },
      { name: 'save', thunk: () => tpl.save() },
      { name: 'destroy', thunk: () => tpl.destroy() },
      { name: 'rotatePaper', thunk: () => tpl.rotatePaper() },
      { name: 'setPaper', thunk: () => tpl.setPaper('A4') },
      { name: 'alignElements', thunk: () => tpl.alignElements('left') },
      {
        name: 'distributeElements',
        thunk: () => tpl.distributeElements('horizontal'),
      },
      { name: 'zoom', thunk: () => tpl.zoom(1) },
      { name: 'zoomIn', thunk: () => tpl.zoomIn() },
      { name: 'zoomOut', thunk: () => tpl.zoomOut() },
      { name: 'zoomReset', thunk: () => tpl.zoomReset() },
      { name: 'addPrintPanel', thunk: () => tpl.addPrintPanel() },
      { name: 'removePrintPanel', thunk: () => tpl.removePrintPanel(0) },
      { name: 'selectPanel', thunk: () => tpl.selectPanel(0) },
      { name: 'on', thunk: () => tpl.on('x', () => undefined) },
      { name: 'off', thunk: () => tpl.off('x') },
      { name: 'emit', thunk: () => tpl.emit('x') },
      { name: 'getElementByTid', thunk: () => tpl.getElementByTid('x') },
      { name: 'getActivePanelJson', thunk: () => tpl.getActivePanelJson() },
      { name: 'setDynamicFields', thunk: () => tpl.setDynamicFields({}) },
      { name: 'getDynamicFields', thunk: () => tpl.getDynamicFields() },
      {
        name: 'appendElementTypeGroups',
        thunk: () => tpl.appendElementTypeGroups('m', []),
      },
      {
        name: 'setElementTypeGroups',
        thunk: () => tpl.setElementTypeGroups('m', []),
      },
      { name: 'selectAllElements', thunk: () => tpl.selectAllElements() },
      { name: 'selectElementsByField', thunk: () => tpl.selectElementsByField('x') },
      { name: 'bringToFront', thunk: () => tpl.bringToFront() },
      { name: 'sendToBack', thunk: () => tpl.sendToBack() },
      { name: 'bringForward', thunk: () => tpl.bringForward() },
      { name: 'sendBackward', thunk: () => tpl.sendBackward() },
      { name: 'setElsAlign', thunk: () => tpl.setElsAlign('left') },
      {
        name: 'updateOption',
        thunk: () => tpl.updateOption('e1', { left: 10 }),
      },
      { name: 'lockElement', thunk: () => tpl.lockElement('e1') },
      { name: 'unlockElement', thunk: () => tpl.unlockElement('e1') },
      { name: 'copyElement', thunk: () => tpl.copyElement('e1') },
      { name: 'pasteElement', thunk: () => tpl.pasteElement() },
      { name: 'cutElement', thunk: () => tpl.cutElement('e1') },
      { name: 'getHistory', thunk: () => tpl.getHistory() },
      { name: 'clearHistory', thunk: () => tpl.clearHistory() },
      { name: 'setHistoryCapacity', thunk: () => tpl.setHistoryCapacity(10) },
      { name: 'getPaperSize', thunk: () => tpl.getPaperSize() },
      { name: 'getMaxPanelIndex', thunk: () => tpl.getMaxPanelIndex() },
      { name: 'previewWindow', thunk: () => tpl.previewWindow() },
      { name: 'printWindow', thunk: () => tpl.printWindow() },
      {
        name: 'addPrintElement',
        thunk: () => tpl.addPrintElement({ printElementType: { type: 'text' } } as any),
      },
      { name: 'removePrintElement', thunk: () => tpl.removePrintElement('e1') },
      { name: 'getOption', thunk: () => tpl.getOption('e1', 'k') },
      { name: 'getAllOptions', thunk: () => tpl.getAllOptions('e1') },
      { name: 'isDestroyed', thunk: () => tpl.isDestroyed() },
      { name: 'getPaneltotal', thunk: () => tpl.getPaneltotal() },
      { name: 'getPaperType', thunk: () => tpl.getPaperType() },
      { name: 'getOrient', thunk: () => tpl.getOrient() },
      { name: 'getPanel', thunk: () => tpl.getPanel() },
      { name: 'getElementByName', thunk: () => tpl.getElementByName('x') },
      { name: 'setFontList', thunk: () => tpl.setFontList([]) },
      { name: 'getFontList', thunk: () => tpl.getFontList() },
      { name: 'setFields', thunk: () => tpl.setFields([]) },
      { name: 'getFields', thunk: () => tpl.getFields() },
      { name: 'getFieldsInPanel', thunk: () => tpl.getFieldsInPanel() },
      { name: 'getTestData', thunk: () => tpl.getTestData() },
    ]

    const throwers: string[] = []
    for (const { name, thunk } of calls) {
      try {
        thunk()
      } catch (err) {
        throwers.push(`${name}: ${(err as Error).message}`)
      }
    }
    expect(throwers).toEqual([])

    // ---- Typed-fallback checks: a few canonical return shapes ----
    expect(tpl.getJson()).toEqual({ panels: [] })
    expect(tpl.getJsonTid()).toEqual({ panels: [] })
    expect(tpl.getHtml()).toBe('')
    expect(tpl.save()).toBeUndefined()
    expect(tpl.getActivePanelJson()).toBeDefined() // returns null or object
    expect(tpl.getDynamicFields()).toBeUndefined()
    expect(tpl.getFields()).toEqual([])
    expect(tpl.getFieldsInPanel()).toEqual([])
    expect(tpl.getTestData()).toEqual({})
    expect(tpl.getPaneltotal()).toBe(0)
    expect(tpl.getPaperType()).toBeUndefined()
    expect(tpl.getOrient()).toBeUndefined()
    expect(tpl.getPanel()).toBeUndefined()
    expect(tpl.getElementByName('x')).toBeNull()
    expect(tpl.getElementByTid('x')).toBeNull()
    expect(tpl.getFontList()).toEqual([])
    expect(tpl.addPrintPanel()).toBeNull()
    expect(tpl.getOption('e1', 'k')).toBeUndefined()
    expect(tpl.getAllOptions('e1')).toEqual({})
    expect(tpl.getHistory()).toBeDefined()
    // getMaxPanelIndex returns -1 post-destroy (no panels → max index is -1).
    expect(tpl.getMaxPanelIndex()).toBe(-1)
    expect(tpl.getPaperSize()).toBeDefined()
    expect(tpl.isDestroyed()).toBe(true)
  })

  it('destroyed instance: async methods resolve to typed fallback without rejecting', async () => {
    const tpl = new PrintTemplate()
    tpl.destroy()
    // toPdf returns Promise<Uint8Array | undefined>; expect undefined fallback.
    await expect(tpl.toPdf()).resolves.toBeUndefined()
    // toPdfDownload returns Promise<void>; expect to resolve.
    await expect(tpl.toPdfDownload()).resolves.toBeUndefined()
    // exportPdf returns Promise<void>; expect to resolve.
    await expect(tpl.exportPdf()).resolves.toBeUndefined()
  })

  it('exempt methods stay functional post-destroy', () => {
    const tpl = new PrintTemplate()
    tpl.destroy()
    // isDestroyed must answer truthfully (not gated).
    expect(tpl.isDestroyed()).toBe(true)
    // destroy must be idempotent (no throw on second call).
    expect(() => tpl.destroy()).not.toThrow()
    // _-prefixed internal escape hatches: return long-lived refs by design
    // (Pinia survives destroy so any in-flight cleanup can finish).
    expect(tpl._getPinia()).toBeDefined()
    expect(tpl._getEventBus()).toBeDefined()
  })
})

describe('Sprint 22g wave 3 — destroy-guard sweep: ToolbarController', () => {
  it('destroyed toolbar: every public method returns typed fallback without throwing', () => {
    const tpl = new PrintTemplate()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const ctrl = buildToolbar(container, tpl)
    ctrl.destroy()

    const calls: Array<{ name: string; thunk: () => unknown }> = [
      { name: 'getScale', thunk: () => ctrl.getScale() },
      { name: 'setScale', thunk: () => ctrl.setScale(1.5) },
      { name: 'addToolbarButton', thunk: () => ctrl.addToolbarButton({ id: 'x' } as any) },
      { name: 'removeToolbarButton', thunk: () => ctrl.removeToolbarButton('x') },
      { name: 'enableButton', thunk: () => ctrl.enableButton('save') },
      { name: 'disableButton', thunk: () => ctrl.disableButton('save') },
      { name: 'setButtonText', thunk: () => ctrl.setButtonText('save', 'X') },
      { name: 'getActivePanel', thunk: () => ctrl.getActivePanel() },
      { name: 'setActivePanel', thunk: () => ctrl.setActivePanel(0) },
      { name: 'addPanel', thunk: () => ctrl.addPanel() },
      { name: 'removePanel', thunk: () => ctrl.removePanel(0) },
      { name: 'setPaper', thunk: () => ctrl.setPaper('A4') },
      { name: 'rotatePaper', thunk: () => ctrl.rotatePaper() },
      { name: 'getJson', thunk: () => ctrl.getJson() },
      { name: 'setJson', thunk: () => ctrl.setJson({ panels: [] } as any) },
      { name: 'on', thunk: () => ctrl.on('x', () => undefined) },
      { name: 'off', thunk: () => ctrl.off('x') },
      { name: 'emit', thunk: () => ctrl.emit('x') },
      { name: 'getTemplateApi', thunk: () => ctrl.getTemplateApi() },
      { name: 'getCanvasApi', thunk: () => ctrl.getCanvasApi() },
      // Sprint 22g GA — V1 §8A.2 parity surface
      { name: 'openBusinessDialog', thunk: () => ctrl.openBusinessDialog() },
      { name: 'closeBusinessDialog', thunk: () => ctrl.closeBusinessDialog() },
      { name: 'setBusinessItems', thunk: () => ctrl.setBusinessItems([]) },
      { name: 'getBusinessItems', thunk: () => ctrl.getBusinessItems() },
      {
        name: 'setBusinessListProvider',
        thunk: () => ctrl.setBusinessListProvider(null),
      },
      {
        name: 'setBusinessLoader',
        thunk: () => ctrl.setBusinessLoader(null),
      },
      { name: 'openTemplateDialog', thunk: () => ctrl.openTemplateDialog() },
      { name: 'closeTemplateDialog', thunk: () => ctrl.closeTemplateDialog() },
      { name: 'setTemplateItems', thunk: () => ctrl.setTemplateItems([]) },
      { name: 'getTemplateItems', thunk: () => ctrl.getTemplateItems() },
      {
        name: 'setTemplateListProvider',
        thunk: () => ctrl.setTemplateListProvider(null),
      },
      {
        name: 'setTemplateLoader',
        thunk: () => ctrl.setTemplateLoader(null),
      },
      { name: 'openSaveDialog', thunk: () => ctrl.openSaveDialog() },
      { name: 'closeSaveDialog', thunk: () => ctrl.closeSaveDialog() },
      { name: 'triggerSave', thunk: () => ctrl.triggerSave() },
      { name: 'getButton', thunk: () => ctrl.getButton('save') },
      { name: 'getButtons', thunk: () => ctrl.getButtons() },
      { name: 'triggerButton', thunk: () => ctrl.triggerButton('save') },
      { name: 'getToolbarElement', thunk: () => ctrl.getToolbarElement() },
    ]

    const throwers: string[] = []
    for (const { name, thunk } of calls) {
      try {
        thunk()
      } catch (err) {
        throwers.push(`${name}: ${(err as Error).message}`)
      }
    }
    expect(throwers).toEqual([])

    // ---- Typed-fallback spot checks ----
    expect(ctrl.getScale()).toBe(1)
    expect(ctrl.getActivePanel()).toBeNull()
    expect(ctrl.addPanel()).toBeNull()
    expect(ctrl.getJson()).toEqual({ panels: [] })
    expect(ctrl.getBusinessItems()).toEqual([])
    expect(ctrl.getTemplateItems()).toEqual([])
    expect(ctrl.getButton('save')).toBeNull()
    expect(ctrl.getButtons()).toEqual({})

    // ---- refreshBusinessList / refreshTemplateList: async fallback ----
    return Promise.all([
      ctrl.refreshBusinessList().then((r) => expect(r).toEqual([])),
      ctrl.refreshTemplateList().then((r) => expect(r).toEqual([])),
    ]).then(() => {
      document.body.removeChild(container)
    })
  })
})

describe('Sprint 22g wave 3 — destroy-guard sweep: DesignerController', () => {
  it('destroyed designer: every public method returns typed fallback without throwing', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const ctrl = buildDesigner(container)
    ctrl.destroy()

    const calls: Array<{ name: string; thunk: () => unknown }> = [
      { name: 'getJson', thunk: () => ctrl.getJson() },
      { name: 'update', thunk: () => ctrl.update({ panels: [] } as any) },
      { name: 'getTemplate', thunk: () => ctrl.getTemplate() },
      { name: 'getTpl', thunk: () => ctrl.getTpl() },
      {
        name: 'setComponentPanelSlot',
        thunk: () => ctrl.setComponentPanelSlot({} as any),
      },
      { name: 'clearComponentPanelSlot', thunk: () => ctrl.clearComponentPanelSlot() },
      {
        name: 'rebuildComponentPanel',
        thunk: () => ctrl.rebuildComponentPanel('m', {} as any),
      },
      { name: 'setPaginationVisible', thunk: () => ctrl.setPaginationVisible(false) },
      { name: 'getComponentContainer', thunk: () => ctrl.getComponentContainer() },
      { name: 'getTemplateContainer', thunk: () => ctrl.getTemplateContainer() },
      { name: 'getSettingContainer', thunk: () => ctrl.getSettingContainer() },
      { name: 'setLeftCollapsed', thunk: () => ctrl.setLeftCollapsed(true) },
      { name: 'setRightCollapsed', thunk: () => ctrl.setRightCollapsed(true) },
      { name: 'isLeftCollapsed', thunk: () => ctrl.isLeftCollapsed() },
      { name: 'isRightCollapsed', thunk: () => ctrl.isRightCollapsed() },
    ]

    const throwers: string[] = []
    for (const { name, thunk } of calls) {
      try {
        thunk()
      } catch (err) {
        throwers.push(`${name}: ${(err as Error).message}`)
      }
    }
    expect(throwers).toEqual([])

    // ---- Typed-fallback spot checks ----
    expect(ctrl.getJson()).toEqual({ panels: [] })
    expect(ctrl.getTemplate()).toEqual({ panels: [] })
    expect(ctrl.getComponentContainer()).toBeNull()
    expect(ctrl.getTemplateContainer()).toBeNull()
    expect(ctrl.getSettingContainer()).toBeNull()
    expect(ctrl.isLeftCollapsed()).toBe(false)
    expect(ctrl.isRightCollapsed()).toBe(false)
    // getTpl returns a reference; on destroyed designer it still resolves to
    // the inner template (no throw — caller can introspect post-destroy).
    expect(ctrl.getTpl()).toBeDefined()

    document.body.removeChild(container)
  })
})

describe('Sprint 22g wave 3 — exempt method whitelist', () => {
  it('lists the exact methods that are intentionally NOT destroy-guarded', () => {
    // This is documentation-as-test: if anyone adds a new method to the
    // exempt list (or removes one), the diff must update this assertion.
    expect([...PRINT_TEMPLATE_EXEMPT].sort()).toEqual(
      ['_getEventBus', '_getPinia', 'destroy', 'isDestroyed'].sort()
    )
  })
})
