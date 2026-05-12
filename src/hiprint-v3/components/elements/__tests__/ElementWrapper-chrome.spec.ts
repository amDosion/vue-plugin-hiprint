/**
 * ElementWrapper-chrome.spec.ts — TKT-151 / TKT-152 / TKT-163.
 *
 * Covers the STATIC selection chrome rendered by ElementWrapper.vue when an
 * element is selected (NOT during an in-flight drag/resize — DragOverlay
 * owns that). V1 references:
 *   - delete-X button: docs/V1-INVENTORY/interactions.md §1 line 163
 *   - size-box readout: §1 line 162
 *   - 8 resize handle dots: §1 lines 8127-8135
 *   - etype handle quirks: shapes.md quirk #5 + image-html.md §F.1
 *
 * Asserts:
 *  1. unselected → no chrome rendered.
 *  2. selected + idle + unlocked → del-btn + size-box + 8 handles rendered.
 *  3. del-btn click removes element + the row drops from the store.
 *  4. size-box label shows W×H in mm rounded to 1 decimal.
 *  5. locked element → no chrome (V1 hides .resizebtn / .del-btn).
 *  6. TKT-163 handle counts: hline → 2 (e,w); vline → 2 (n,s); rect → 4
 *     (s,w,e,se); image → 4 (corners); text → 8 (full set).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ElementWrapper from '../ElementWrapper.vue'
import { useCanvasStore } from '@hiprint-v3/stores'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

function seedTextElement(): void {
  const canvas = useCanvasStore()
  canvas.addPanel({ id: 'p1', width: 200, height: 200 })
  canvas.addElement('p1', {
    id: 'e1',
    tid: 't.text',
    printElementType: { type: 'text' },
    options: { left: 10, top: 20, width: 100, height: 50 },
  })
}

describe('ElementWrapper — TKT-151 / TKT-152 selection chrome', () => {
  it('renders no del-btn / size-box / handles when unselected', () => {
    seedTextElement()
    const w = mount(ElementWrapper, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    const root = w.element as HTMLElement
    expect(root.querySelector('.hiprint-element__del-btn')).toBeNull()
    expect(root.querySelector('.hiprint-element__size-box')).toBeNull()
    expect(root.querySelectorAll('.hiprint-element__handle').length).toBe(0)
    w.unmount()
  })

  it('renders del-btn + size-box + 8 handles when selected + idle (text)', async () => {
    seedTextElement()
    const canvas = useCanvasStore()
    const w = mount(ElementWrapper, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    canvas.selectElement('e1', 'replace')
    await w.vm.$nextTick()
    const root = w.element as HTMLElement
    expect(root.querySelector('.hiprint-element__del-btn')).not.toBeNull()
    expect(root.querySelector('.hiprint-element__size-box')).not.toBeNull()
    expect(root.querySelectorAll('.hiprint-element__handle').length).toBe(8)
    w.unmount()
  })

  it('del-btn click removes element from store', async () => {
    seedTextElement()
    const canvas = useCanvasStore()
    const w = mount(ElementWrapper, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
      attachTo: document.body,
    })
    canvas.selectElement('e1', 'replace')
    await w.vm.$nextTick()
    const delBtn = (w.element as HTMLElement).querySelector(
      '.hiprint-element__del-btn'
    ) as HTMLButtonElement
    expect(delBtn).not.toBeNull()
    delBtn.click()
    await w.vm.$nextTick()
    // Element gone from the store.
    const panel = canvas.panels.find((p) => p.id === 'p1')
    expect(panel?.printElements.find((el) => el.id === 'e1')).toBeUndefined()
    w.unmount()
  })

  it('size-box shows W×H label in mm (1 decimal)', async () => {
    seedTextElement()
    const canvas = useCanvasStore()
    const w = mount(ElementWrapper, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    canvas.selectElement('e1', 'replace')
    await w.vm.$nextTick()
    const box = (w.element as HTMLElement).querySelector(
      '.hiprint-element__size-box'
    ) as HTMLElement
    // 100 pt → 35.3 mm, 50 pt → 17.6 mm (rounded to 1 decimal).
    // 100 / (72/25.4) = 35.277… → 35.3
    // 50 / (72/25.4) = 17.638… → 17.6
    expect(box.textContent).toContain('35.3')
    expect(box.textContent).toContain('17.6')
    expect(box.textContent).toContain('mm')
    w.unmount()
  })

  it('locked element renders no del-btn / handles even when selected', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { left: 10, top: 20, width: 100, height: 50, lock: true },
    })
    const w = mount(ElementWrapper, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    canvas.selectElement('e1', 'replace')
    await w.vm.$nextTick()
    const root = w.element as HTMLElement
    expect(root.querySelector('.hiprint-element__del-btn')).toBeNull()
    expect(root.querySelector('.hiprint-element__size-box')).toBeNull()
    expect(root.querySelectorAll('.hiprint-element__handle').length).toBe(0)
    // Lock badge still shows (existing TKT-027 behavior).
    expect(root.querySelector('.hiprint-element__lock-badge')).not.toBeNull()
    w.unmount()
  })
})

describe('ElementWrapper — TKT-163 etype-aware handle counts', () => {
  /** Helper: seed + mount + select + return the handle elements rendered. */
  async function handlesForType(etype: string): Promise<NodeListOf<Element>> {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: `t.${etype}`,
      printElementType: { type: etype },
      options: { left: 10, top: 20, width: 100, height: 50 },
    })
    const w = mount(ElementWrapper, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    canvas.selectElement('e1', 'replace')
    await w.vm.$nextTick()
    const handles = (w.element as HTMLElement).querySelectorAll(
      '.hiprint-element__handle'
    )
    return handles
  }

  it('hline renders exactly 2 handles (e + w)', async () => {
    const handles = await handlesForType('hline')
    expect(handles.length).toBe(2)
    const positions = new Set<string>()
    handles.forEach((h) => positions.add(h.getAttribute('data-handle') ?? ''))
    expect(positions.has('e')).toBe(true)
    expect(positions.has('w')).toBe(true)
  })

  it('vline renders exactly 2 handles (n + s)', async () => {
    const handles = await handlesForType('vline')
    expect(handles.length).toBe(2)
    const positions = new Set<string>()
    handles.forEach((h) => positions.add(h.getAttribute('data-handle') ?? ''))
    expect(positions.has('n')).toBe(true)
    expect(positions.has('s')).toBe(true)
  })

  it('rect renders 4 handles (s + w + e + se) — no top edge (V1 quirk)', async () => {
    const handles = await handlesForType('rect')
    expect(handles.length).toBe(4)
    const positions = new Set<string>()
    handles.forEach((h) => positions.add(h.getAttribute('data-handle') ?? ''))
    expect(positions).toEqual(new Set(['s', 'w', 'e', 'se']))
    expect(positions.has('n')).toBe(false)
    expect(positions.has('nw')).toBe(false)
    expect(positions.has('ne')).toBe(false)
  })

  it('oval mirrors rect (4 handles, no top)', async () => {
    const handles = await handlesForType('oval')
    expect(handles.length).toBe(4)
    const positions = new Set<string>()
    handles.forEach((h) => positions.add(h.getAttribute('data-handle') ?? ''))
    expect(positions).toEqual(new Set(['s', 'w', 'e', 'se']))
  })

  it('image renders 4 corner handles only', async () => {
    const handles = await handlesForType('image')
    expect(handles.length).toBe(4)
    const positions = new Set<string>()
    handles.forEach((h) => positions.add(h.getAttribute('data-handle') ?? ''))
    expect(positions).toEqual(new Set(['nw', 'ne', 'sw', 'se']))
  })

  it('text falls back to the full 8-handle set', async () => {
    const handles = await handlesForType('text')
    expect(handles.length).toBe(8)
  })

  it('unknown etype falls back to the full 8-handle set', async () => {
    const handles = await handlesForType('not-a-real-etype')
    expect(handles.length).toBe(8)
  })
})
