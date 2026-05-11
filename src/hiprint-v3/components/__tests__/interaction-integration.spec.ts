/**
 * interaction-integration.spec.ts — V3 interaction wire-up integration tests
 * (P21.9).
 *
 * P21.9 was opened after a report that "the designer appears broken in dev
 * server" — i.e. the interaction modules existed but the components were not
 * actually invoking them on mount. These tests fix that contract by mocking
 * the entire `@hiprint-v3/interactions` barrel and asserting:
 *
 *   1. HiprintCanvas (non-readonly) → enableDesignerKeyboard +
 *      enableSelectionShortcuts called exactly once on mount; cleanup
 *      functions returned by each are called on unmount.
 *   2. HiprintCanvas → enableLasso re-attached when activePanelId changes
 *      (the per-panel paper element host is owned by HiprintPanel and the
 *      lasso must follow the active paper).
 *   3. HiprintCanvas with readonly=true → none of these interactions install.
 *   4. HiprintPanel → enablePanelDropZone called with (paperEl, panelId);
 *      paper element carries `data-panel-id` (drop detection contract);
 *      disableInteractions called on unmount.
 *   5. ElementWrapper → enableElementSelection + enableElementDrag +
 *      enableElementResize all called on mount; cleanup runs on unmount.
 *   6. ElementWrapper → data-element-id + data-panel-id attrs present.
 *   7. HiprintCanvas right-click on element → openContextMenu invoked with
 *      anchor coords + buildElementContextItems(elementId) result.
 *
 * NOTE: We mock `@hiprint-v3/interactions` rather than running real interact.js
 * — the goal of P21.9 is to verify wire-up (call shape), not the underlying
 * libraries. Real lifecycle is covered by the per-module __tests__/*.spec.ts.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'

// -----------------------------------------------------------------------------
// Mocks — vi.mock is hoisted above imports, so the factory cannot close over
// module-level `const` declarations. Use vi.hoisted() to lift mock fns + their
// returned cleanup spies up alongside the mock so they remain accessible from
// the test bodies below.
// -----------------------------------------------------------------------------

const {
  cleanupKeyboard,
  cleanupShortcuts,
  cleanupLasso,
  cleanupSelection,
  cleanupResize,
  closeMenu,
  enableDesignerKeyboard,
  enableSelectionShortcuts,
  enableLasso,
  enableElementSelection,
  enableElementDrag,
  enableElementResize,
  enablePanelDropZone,
  disableInteractions,
  openContextMenu,
  buildElementContextItems,
} = vi.hoisted(() => {
  const cleanupKeyboard = vi.fn()
  const cleanupShortcuts = vi.fn()
  const cleanupLasso = vi.fn()
  const cleanupSelection = vi.fn()
  const cleanupResize = vi.fn()
  const closeMenu = vi.fn()
  return {
    cleanupKeyboard,
    cleanupShortcuts,
    cleanupLasso,
    cleanupSelection,
    cleanupResize,
    closeMenu,
    enableDesignerKeyboard: vi.fn(() => cleanupKeyboard),
    enableSelectionShortcuts: vi.fn(() => cleanupShortcuts),
    enableLasso: vi.fn(() => cleanupLasso),
    enableElementSelection: vi.fn(() => cleanupSelection),
    enableElementDrag: vi.fn(),
    enableElementResize: vi.fn(() => cleanupResize),
    enablePanelDropZone: vi.fn(),
    disableInteractions: vi.fn(),
    openContextMenu: vi.fn(() => ({ close: closeMenu, isOpen: true })),
    buildElementContextItems: vi.fn((id: string) => [
      { id: 'copy', label: `copy:${id}` },
    ]),
  }
})

vi.mock('@hiprint-v3/interactions', () => ({
  enableDesignerKeyboard,
  enableSelectionShortcuts,
  enableLasso,
  enableElementSelection,
  enableElementDrag,
  enableElementResize,
  enablePanelDropZone,
  disableInteractions,
  openContextMenu,
  buildElementContextItems,
}))

// -----------------------------------------------------------------------------
// Components under test (import AFTER vi.mock).
// -----------------------------------------------------------------------------

import HiprintCanvas from '../HiprintCanvas.vue'
import HiprintPanel from '../HiprintPanel.vue'
import ElementWrapper from '../elements/ElementWrapper.vue'
import { useCanvasStore } from '@hiprint-v3/stores'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

// =============================================================================
// HiprintCanvas — designer-wide interactions
// =============================================================================

describe('HiprintCanvas — interaction wire-up', () => {
  it('mounts → enableDesignerKeyboard called exactly once', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 100, height: 100 })
    const w = mount(HiprintCanvas)
    expect(enableDesignerKeyboard).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('mounts → enableSelectionShortcuts called exactly once', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 100, height: 100 })
    const w = mount(HiprintCanvas)
    expect(enableSelectionShortcuts).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('mounts → enableLasso called for the active panel paper', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'pA', width: 100, height: 100 })
    const w = mount(HiprintCanvas, { attachTo: document.body })
    await nextTick()
    await nextTick()
    expect(enableLasso).toHaveBeenCalled()
    const firstCall = enableLasso.mock.calls[0]
    expect(firstCall?.[1]).toBe('pA')
    w.unmount()
  })

  it('activePanelId change → re-attaches lasso to new panel', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'pA', width: 100, height: 100 })
    canvas.addPanel({ id: 'pB', width: 100, height: 100 })
    const w = mount(HiprintCanvas, { attachTo: document.body })
    await nextTick()
    await nextTick()
    const initial = enableLasso.mock.calls.length
    cleanupLasso.mockClear()
    canvas.setActivePanel('pB')
    await nextTick()
    await nextTick()
    // Previous lasso cleanup invoked + lasso re-enabled for pB.
    expect(cleanupLasso).toHaveBeenCalled()
    expect(enableLasso.mock.calls.length).toBeGreaterThan(initial)
    const last = enableLasso.mock.calls[enableLasso.mock.calls.length - 1]
    expect(last?.[1]).toBe('pB')
    w.unmount()
  })

  it('unmount → all designer-level cleanups invoked', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'pA', width: 100, height: 100 })
    const w = mount(HiprintCanvas, { attachTo: document.body })
    await nextTick()
    await nextTick()
    w.unmount()
    expect(cleanupKeyboard).toHaveBeenCalledTimes(1)
    expect(cleanupShortcuts).toHaveBeenCalledTimes(1)
    expect(cleanupLasso).toHaveBeenCalled()
  })

  it('readonly=true → no designer interactions installed', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'pA', width: 100, height: 100 })
    const w = mount(HiprintCanvas, {
      props: { readonly: true },
      attachTo: document.body,
    })
    await nextTick()
    await nextTick()
    expect(enableDesignerKeyboard).not.toHaveBeenCalled()
    expect(enableSelectionShortcuts).not.toHaveBeenCalled()
    expect(enableLasso).not.toHaveBeenCalled()
    w.unmount()
  })

  it('right-click on element → openContextMenu + buildElementContextItems', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'pA', width: 100, height: 100 })
    canvas.addElement('pA', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { left: 0, top: 0, width: 30, height: 12, title: 'Hi' },
    })
    const w = mount(HiprintCanvas, { attachTo: document.body })
    await nextTick()
    const elNode = w.element.querySelector(
      '[data-element-id="e1"]'
    ) as HTMLElement | null
    expect(elNode).not.toBeNull()
    // Dispatch a real contextmenu event from the element so it bubbles up
    // to the canvas root listener.
    const evt = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 42,
      clientY: 99,
    })
    elNode!.dispatchEvent(evt)
    expect(buildElementContextItems).toHaveBeenCalledWith('e1')
    expect(openContextMenu).toHaveBeenCalledTimes(1)
    const args = openContextMenu.mock.calls[0]!
    expect(args[0]).toEqual({ x: 42, y: 99 })
    w.unmount()
  })

  it('right-click on background (no element) → no context menu', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'pA', width: 100, height: 100 })
    const w = mount(HiprintCanvas, { attachTo: document.body })
    await nextTick()
    const root = w.element as HTMLElement
    const evt = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 1,
      clientY: 1,
    })
    root.dispatchEvent(evt)
    expect(openContextMenu).not.toHaveBeenCalled()
    w.unmount()
  })
})

// =============================================================================
// HiprintPanel — dropzone wire-up
// =============================================================================

describe('HiprintPanel — dropzone wire-up', () => {
  it('mounts → enablePanelDropZone called with paperEl + panelId', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 100, height: 100 })
    const w = mount(HiprintPanel, {
      props: { panelId: 'p1' },
      attachTo: document.body,
    })
    expect(enablePanelDropZone).toHaveBeenCalledTimes(1)
    const args = enablePanelDropZone.mock.calls[0]!
    const paperEl = w.element.querySelector(
      '.hiprint-printPaper'
    ) as HTMLElement
    expect(args[0]).toBe(paperEl)
    expect(args[1]).toBe('p1')
    w.unmount()
  })

  it('paper element has data-panel-id attribute matching props', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'pZ', width: 100, height: 100 })
    const w = mount(HiprintPanel, {
      props: { panelId: 'pZ' },
      attachTo: document.body,
    })
    const paper = w.element.querySelector('.hiprint-printPaper') as HTMLElement
    expect(paper.getAttribute('data-panel-id')).toBe('pZ')
    w.unmount()
  })

  it('readonly=true → no dropzone registered', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 100, height: 100 })
    const w = mount(HiprintPanel, {
      props: { panelId: 'p1', readonly: true },
      attachTo: document.body,
    })
    expect(enablePanelDropZone).not.toHaveBeenCalled()
    w.unmount()
  })

  it('unmount → disableInteractions called on paper element', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 100, height: 100 })
    const w = mount(HiprintPanel, {
      props: { panelId: 'p1' },
      attachTo: document.body,
    })
    const paper = w.element.querySelector('.hiprint-printPaper') as HTMLElement
    w.unmount()
    expect(disableInteractions).toHaveBeenCalledWith(paper)
  })
})

// =============================================================================
// ElementWrapper — per-element interactions
// =============================================================================

describe('ElementWrapper — element interaction wire-up', () => {
  function seed(): void {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 100, height: 100 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { left: 5, top: 5, width: 30, height: 12 },
    })
  }

  it('mounts → enableElementSelection + enableElementDrag + enableElementResize all called', () => {
    seed()
    const w = mount(ElementWrapper, {
      props: { elementId: 'e1', panelId: 'p1', interactive: true },
      attachTo: document.body,
    })
    expect(enableElementSelection).toHaveBeenCalledTimes(1)
    expect(enableElementDrag).toHaveBeenCalledTimes(1)
    expect(enableElementResize).toHaveBeenCalledTimes(1)
    // Selection passed (el, elementId, panelId).
    const selArgs = enableElementSelection.mock.calls[0]!
    expect(selArgs[1]).toBe('e1')
    expect(selArgs[2]).toBe('p1')
    // Drag opts.elementId + panelId present.
    const dragArgs = enableElementDrag.mock.calls[0]! as unknown as [
      HTMLElement,
      { elementId: string; panelId: string },
    ]
    expect(dragArgs[1].elementId).toBe('e1')
    expect(dragArgs[1].panelId).toBe('p1')
    // Resize opts.elementId + panelId present.
    const rzArgs = enableElementResize.mock.calls[0]! as unknown as [
      HTMLElement,
      { elementId: string; panelId: string },
    ]
    expect(rzArgs[1].elementId).toBe('e1')
    expect(rzArgs[1].panelId).toBe('p1')
    w.unmount()
  })

  it('root has data-element-id + data-panel-id attributes', () => {
    seed()
    const w = mount(ElementWrapper, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    const root = w.element as HTMLElement
    expect(root.getAttribute('data-element-id')).toBe('e1')
    expect(root.getAttribute('data-panel-id')).toBe('p1')
    w.unmount()
  })

  it('unmount → selection + resize cleanups + disableInteractions called', () => {
    seed()
    const w = mount(ElementWrapper, {
      props: { elementId: 'e1', panelId: 'p1', interactive: true },
      attachTo: document.body,
    })
    const root = w.element as HTMLElement
    w.unmount()
    expect(cleanupSelection).toHaveBeenCalledTimes(1)
    expect(cleanupResize).toHaveBeenCalledTimes(1)
    expect(disableInteractions).toHaveBeenCalledWith(root)
  })

  it('interactive=false → no interactions installed', () => {
    seed()
    const w = mount(ElementWrapper, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    expect(enableElementSelection).not.toHaveBeenCalled()
    expect(enableElementDrag).not.toHaveBeenCalled()
    expect(enableElementResize).not.toHaveBeenCalled()
    w.unmount()
  })
})
