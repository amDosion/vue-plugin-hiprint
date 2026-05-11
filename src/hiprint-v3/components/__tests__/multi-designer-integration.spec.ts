/**
 * multi-designer-integration.spec.ts — P21.9b
 *
 * Regression: V3 designer broken when MULTIPLE <HiprintDesigner> components
 * mount on the same page (separate Pinia instances). Symptoms:
 *   - element drag from sidebar onto canvas → no-op (or wrong store mutated)
 *   - left/right panel drag → silently dropped
 *   - selection clicks → wrong store updated
 *
 * Root cause: interactions/* modules (drag-drop / selection / keyboard /
 * context-menu) used to call `useCanvasStore()` lazily INSIDE async callbacks
 * (interact.js listeners, window keydown, lasso pointerup, menu onClick).
 * By callback time, another designer may have called setActivePinia(), so the
 * lookup resolved to the WRONG store.
 *
 * Fix (2026-05-11): each `enableXxx()` captures the store at enable-time and
 * closes over it. Pinia stores are stable singletons per pinia instance, so a
 * captured ref stays bound to its original pinia regardless of later
 * setActivePinia() calls.
 *
 * This spec asserts two invariants:
 *  A) Two designers on the same page own independent stores (no cross-talk).
 *  B) Interaction callbacks installed on designer A mutate A's store even
 *     after setActivePinia(B) flips the active pinia.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia, getActivePinia } from 'pinia'
import HiprintDesigner from '../HiprintDesigner.vue'
import { useCanvasStore, useHistoryStore } from '@hiprint-v3/stores'
import {
  enableElementDrag,
  enablePanelDropZone,
  enableElementSelection,
  enableLasso,
  enableSelectionShortcuts,
  enableDesignerKeyboard,
  buildElementContextItems,
  disableInteractions,
} from '../../interactions'

// happy-dom doesn't implement interact.js drag events natively; we exercise
// the public API surface that's purely store-driven (selection, keyboard,
// context-menu) and assert store isolation. Drag flows are validated in
// drag-drop.spec.ts; this file proves the SHARED store-capture pattern.

describe('Multi-designer Pinia isolation (P21.9b)', () => {
  beforeEach(() => {
    // Reset active pinia to a throwaway instance — keeps each test
    // hermetic and prevents any stray document-bubbled events from a
    // previous test's HiprintDesigner mount affecting the next.
    setActivePinia(createPinia())
  })

  afterEach(() => {
    // Stray menu portals or DOM leaks.
    document.body.innerHTML = ''
  })

  it('A: two designers have independent canvas stores (no cross-talk)', () => {
    const piniaA = createPinia()
    setActivePinia(piniaA)
    const cA = useCanvasStore()
    cA.addPanel({ width: 100, height: 100 })
    expect(cA.panels.length).toBe(1)

    const piniaB = createPinia()
    setActivePinia(piniaB)
    const cB = useCanvasStore()
    expect(cB.panels.length).toBe(0)

    setActivePinia(piniaA)
    expect(useCanvasStore().panels.length).toBe(1)
    setActivePinia(piniaB)
    expect(useCanvasStore().panels.length).toBe(0)
  })

  it('A: HiprintDesigner mounts isolate per pinia', () => {
    const piniaA = createPinia()
    const piniaB = createPinia()

    setActivePinia(piniaA)
    const wA = mount(HiprintDesigner, { global: { plugins: [piniaA] } })

    setActivePinia(piniaB)
    const wB = mount(HiprintDesigner, { global: { plugins: [piniaB] } })

    // Active is now B. Push state into B's store only.
    useCanvasStore().addPanel({ width: 50, height: 50 })

    // Switch active back to A and verify A's store is untouched.
    setActivePinia(piniaA)
    expect(useCanvasStore().panels.length).toBe(0)

    setActivePinia(piniaB)
    expect(useCanvasStore().panels.length).toBe(1)

    wA.unmount()
    wB.unmount()
  })

  it('B: enableElementSelection callback hits CAPTURED store, not active', () => {
    const piniaA = createPinia()
    const piniaB = createPinia()

    // Designer A's store gets an element + bind selection at enable-time.
    setActivePinia(piniaA)
    const cA = useCanvasStore()
    const panel = cA.addPanel({ width: 100, height: 100 })
    cA.addElement(panel.id, { id: 'a-el-1', tid: 't.text' })

    const el = document.createElement('div')
    document.body.appendChild(el)
    const cleanup = enableElementSelection(el, 'a-el-1', panel.id)

    // Snapshot B's pristine state BEFORE flipping (sanity: new pinia, empty).
    setActivePinia(piniaB)
    const cB = useCanvasStore()
    expect(cB.panels.length).toBe(0)
    expect(cB.selectedElementIds.size).toBe(0)

    // Fire click while B is active.
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }))

    // Assert: A's store received the selection (captured at enable-time).
    expect(cA.selectedElementIds.has('a-el-1')).toBe(true)
    // B should remain pristine — captured-A path bypassed B entirely.
    expect(cB.panels.length).toBe(0)

    cleanup()
    document.body.removeChild(el)
  })

  it('B: enableSelectionShortcuts hits captured store on Escape', () => {
    const piniaA = createPinia()
    const piniaB = createPinia()

    setActivePinia(piniaA)
    const cA = useCanvasStore()
    const panel = cA.addPanel({ width: 100, height: 100 })
    cA.addElement(panel.id, { id: 'k-el', tid: 't.text' })
    cA.selectElement('k-el', 'replace')
    expect(cA.selectedElementIds.size).toBe(1)

    const cleanup = enableSelectionShortcuts()

    // Switch active pinia AFTER install, then dispatch Escape.
    setActivePinia(piniaB)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    // A's selection cleared (captured), B unaffected.
    expect(cA.selectedElementIds.size).toBe(0)

    cleanup()
  })

  it('B: enableDesignerKeyboard delete shortcut hits captured store', () => {
    const piniaA = createPinia()
    const piniaB = createPinia()

    setActivePinia(piniaA)
    const cA = useCanvasStore()
    const panel = cA.addPanel({ width: 100, height: 100 })
    cA.addElement(panel.id, { id: 'd-el', tid: 't.text' })
    cA.selectElement('d-el', 'replace')
    expect(cA.panels[0]!.printElements.length).toBe(1)

    // Force-touch history store inside A so the keyboard install sees a
    // valid useHistoryStore() at enable-time.
    useHistoryStore()

    const cleanup = enableDesignerKeyboard()

    setActivePinia(piniaB)
    // Set up B with its own panel but DIFFERENT element so we can verify
    // the keyboard handler doesn't touch B.
    const cBfresh = useCanvasStore()
    const pB = cBfresh.addPanel({ width: 50, height: 50 })
    cBfresh.addElement(pB.id, { id: 'b-keep', tid: 't.text' })
    cBfresh.selectElement('b-keep', 'replace')
    useHistoryStore()

    // Dispatch Delete. Pre-fix this would resolve useCanvasStore() at call
    // time → B's store → wrong element deleted (or no-op if B selection
    // doesn't match). Post-fix the captured A-store is mutated.
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))

    expect(cA.panels[0]!.printElements.length).toBe(0) // A's element gone
    expect(cBfresh.panels[0]!.printElements.length).toBe(1) // B intact

    cleanup()
  })

  it('B: buildElementContextItems handlers hit pinia active at build time', () => {
    const piniaA = createPinia()
    const piniaB = createPinia()

    setActivePinia(piniaA)
    const cA = useCanvasStore()
    const panel = cA.addPanel({ width: 100, height: 100 })
    cA.addElement(panel.id, { id: 'ctx-el', tid: 't.text' })

    // Build items while A is active — captures A's store.
    const items = buildElementContextItems('ctx-el')
    const del = items.find((i) => i.id === 'delete')!

    // Flip active to B BEFORE invoking onClick.
    setActivePinia(piniaB)
    // Pre-fix: del.onClick() would resolve useCanvasStore() against B and
    // _findElement('ctx-el') returns null (no such element in B) → silent
    // no-op. Post-fix: captured A-store is used.
    del.onClick!()

    expect(cA.panels[0]!.printElements.length).toBe(0)
  })

  it('B: enableLasso pointerup uses captured store', () => {
    const piniaA = createPinia()
    const piniaB = createPinia()

    setActivePinia(piniaA)
    const cA = useCanvasStore()
    const panel = cA.addPanel({ width: 200, height: 200 })
    cA.addElement(panel.id, { id: 'lasso-el', tid: 't.text' })
    // Pre-fix, lasso pointerup would call useCanvasStore() against the
    // active pinia → wrong panel/store mutated. Set A.activePanelId to
    // something else so we can check the captured-A setActivePanel(panel.id)
    // fired correctly.
    cA.activePanelId = null

    const panelEl = document.createElement('div')
    panelEl.style.position = 'absolute'
    panelEl.style.left = '0px'
    panelEl.style.top = '0px'
    panelEl.style.width = '200px'
    panelEl.style.height = '200px'
    document.body.appendChild(panelEl)

    const cleanup = enableLasso(panelEl, panel.id)

    // Snapshot B's pristine state (empty) before flipping active.
    setActivePinia(piniaB)
    const cBSnapshot = useCanvasStore()
    expect(cBSnapshot.panels.length).toBe(0)
    expect(cBSnapshot.activePanelId).toBe(null)

    // Fire pointerdown/up while B is active. Even with zero child
    // intersections (happy-dom returns zeros), the handler dispatches
    // selectMultiple + setActivePanel against the captured store.
    panelEl.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, button: 0 })
    )
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))

    // A's captured store received setActivePanel(panel.id).
    expect(cA.activePanelId).toBe(panel.id)
    // B untouched — pre-fix this would have been mutated.
    expect(cBSnapshot.activePanelId).toBe(null)

    cleanup()
    document.body.removeChild(panelEl)
  })

  it('B: enablePanelDropZone keeps captured-store reference stable', () => {
    // Same-shape contract test for the drop zone fix already applied in
    // drag-drop.ts. We can't fire a real interact.js drop in happy-dom, so
    // we exercise the enable + disable lifecycle and assert that running
    // setActivePinia between them does NOT leak (i.e. no console errors,
    // no thrown exceptions).
    const piniaA = createPinia()
    const piniaB = createPinia()

    setActivePinia(piniaA)
    const cA = useCanvasStore()
    const p = cA.addPanel({ width: 100, height: 100 })

    const el = document.createElement('div')
    document.body.appendChild(el)
    enablePanelDropZone(el, p.id)

    // Flip active and tear down.
    setActivePinia(piniaB)
    expect(() => disableInteractions(el)).not.toThrow()

    document.body.removeChild(el)
  })

  it('B: enableElementDrag enable + active-pinia flip + disable is safe', () => {
    const piniaA = createPinia()
    const piniaB = createPinia()

    setActivePinia(piniaA)
    const cA = useCanvasStore()
    const p = cA.addPanel({ width: 100, height: 100 })
    cA.addElement(p.id, { id: 'drag-el', tid: 't.text' })

    const el = document.createElement('div')
    el.setAttribute('data-element-id', 'drag-el')
    el.setAttribute('data-panel-id', p.id)
    document.body.appendChild(el)

    enableElementDrag(el, { elementId: 'drag-el', panelId: p.id })

    setActivePinia(piniaB)
    expect(() => disableInteractions(el)).not.toThrow()
    // Active pinia after teardown is still B (sanity).
    expect(getActivePinia()).toBe(piniaB)

    document.body.removeChild(el)
  })
})
