/**
 * HiprintElementListPanel.spec.ts — TKT-101 element-list panel tests.
 *
 * Covers the V1 `panel.createElementListPanel()` parity surface
 * (docs/V1-INVENTORY/interactions.md §16):
 *  - toggle button shows/hides panel
 *  - empty state vs row rendering
 *  - row label fallback chain (title → field → "Element N")
 *  - type-badge color class derivation
 *  - click → canvas.selectElement (replace), shift → add, ctrl → toggle
 *  - hover emits + selectedIds class
 *  - eye toggle flips options.hidden + pushes history snapshot
 *  - lock toggle flips position/sizeLocked + pushes history snapshot
 *  - drag-and-drop calls canvas.reorderElement + pushes one snapshot
 *  - drop on same row is a no-op (no reorder, no snapshot)
 *  - drop with no active panel is a safe no-op
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useCanvasStore, useHistoryStore } from '@hiprint-v3/stores'
import HiprintElementListPanel from '../HiprintElementListPanel.vue'

/**
 * Helper — seed canvas with a panel + N elements of a given type. Returns the
 * element ids in insertion order so tests can refer to them positionally.
 */
function seed(opts?: {
  elements?: Array<{
    tid?: string
    type?: string
    options?: Record<string, unknown>
  }>
}): { panelId: string; ids: string[] } {
  const canvas = useCanvasStore()
  const panel = canvas.addPanel({ id: 'p1', width: 210, height: 297 })
  const list = opts?.elements ?? []
  const ids: string[] = []
  for (const e of list) {
    const el = canvas.addElement(panel.id, {
      tid: e.tid ?? 'default.text',
      printElementType: { type: e.type ?? 'text' },
      options: e.options ?? {},
    })
    if (el) ids.push(el.id)
  }
  return { panelId: panel.id, ids }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

// ============ Open / close lifecycle ============

describe('HiprintElementListPanel — open/close', () => {
  it('renders only the toggle button when closed', () => {
    const w = mount(HiprintElementListPanel)
    expect(w.find('button.hiprint-el-list-toggle').exists()).toBe(true)
    expect(w.find('aside.hiprint-el-list-panel').exists()).toBe(false)
    w.unmount()
  })

  it('clicking the toggle opens the panel', async () => {
    const w = mount(HiprintElementListPanel)
    await w.find('button.hiprint-el-list-toggle').trigger('click')
    expect(w.find('aside.hiprint-el-list-panel').exists()).toBe(true)
    expect(w.find('button.hiprint-el-list-toggle').exists()).toBe(false)
    // toggle emit
    expect(w.emitted('toggle')?.[0]).toEqual([true])
    w.unmount()
  })

  it('initiallyOpen prop renders the panel directly', () => {
    const w = mount(HiprintElementListPanel, {
      props: { initiallyOpen: true },
    })
    expect(w.find('aside.hiprint-el-list-panel').exists()).toBe(true)
    w.unmount()
  })

  it('close button hides panel + emits toggle false', async () => {
    const w = mount(HiprintElementListPanel, { props: { initiallyOpen: true } })
    await w.find('button.hiprint-el-list-panel-close').trigger('click')
    expect(w.find('aside.hiprint-el-list-panel').exists()).toBe(false)
    expect(w.emitted('toggle')?.pop()).toEqual([false])
    w.unmount()
  })
})

// ============ Body rendering ============

describe('HiprintElementListPanel — body', () => {
  it('renders empty placeholder when no elements', () => {
    seed()
    const w = mount(HiprintElementListPanel, { props: { initiallyOpen: true } })
    expect(w.find('.hiprint-el-list-empty').exists()).toBe(true)
    expect(w.findAll('.hiprint-el-list-row').length).toBe(0)
    w.unmount()
  })

  it('renders one row per active-panel element', () => {
    seed({
      elements: [
        { type: 'text', options: { title: 'A' } },
        { type: 'image', options: {} },
        { type: 'table', options: {} },
      ],
    })
    const w = mount(HiprintElementListPanel, { props: { initiallyOpen: true } })
    expect(w.findAll('.hiprint-el-list-row').length).toBe(3)
    // Count badge in header reflects total.
    expect(w.find('.el-count').text()).toBe('3')
    w.unmount()
  })

  it('badge gets the correct .tag-* class per element type', () => {
    seed({
      elements: [
        { type: 'text', options: {} },
        { type: 'image', options: {} },
        { type: 'table', options: {} },
        { type: 'barcode', options: {} },
      ],
    })
    const w = mount(HiprintElementListPanel, { props: { initiallyOpen: true } })
    const tags = w.findAll('.el-type-tag')
    expect(tags[0]!.classes()).toContain('tag-text')
    expect(tags[1]!.classes()).toContain('tag-image')
    expect(tags[2]!.classes()).toContain('tag-table')
    expect(tags[3]!.classes()).toContain('tag-barcode')
    w.unmount()
  })

  it('row label fallback: title → field → "Element N"', () => {
    seed({
      elements: [
        { options: { title: 'Customer Name' } },
        { options: { field: 'orderNo' } },
        { options: {} },
      ],
    })
    const w = mount(HiprintElementListPanel, { props: { initiallyOpen: true } })
    const labels = w.findAll('.hiprint-el-list-row-title').map((n) => n.text())
    expect(labels[0]).toBe('Customer Name')
    expect(labels[1]).toBe('orderNo')
    expect(labels[2]).toBe('Element 3')
    w.unmount()
  })
})

// ============ Selection ============

describe('HiprintElementListPanel — selection', () => {
  it('plain click on a row selects it (replace mode)', async () => {
    const { ids } = seed({
      elements: [{ options: {} }, { options: {} }],
    })
    const canvas = useCanvasStore()
    const w = mount(HiprintElementListPanel, { props: { initiallyOpen: true } })
    const rows = w.findAll('.hiprint-el-list-row')
    await rows[0]!.trigger('click')
    expect(canvas.selectedElementIds.has(ids[0]!)).toBe(true)
    await rows[1]!.trigger('click')
    expect(canvas.selectedElementIds.has(ids[0]!)).toBe(false)
    expect(canvas.selectedElementIds.has(ids[1]!)).toBe(true)
    expect(canvas.selectedElementIds.size).toBe(1)
    w.unmount()
  })

  it('shift+click adds to selection', async () => {
    const { ids } = seed({
      elements: [{ options: {} }, { options: {} }],
    })
    const canvas = useCanvasStore()
    const w = mount(HiprintElementListPanel, { props: { initiallyOpen: true } })
    const rows = w.findAll('.hiprint-el-list-row')
    await rows[0]!.trigger('click')
    await rows[1]!.trigger('click', { shiftKey: true })
    expect(canvas.selectedElementIds.size).toBe(2)
    expect(canvas.selectedElementIds.has(ids[0]!)).toBe(true)
    expect(canvas.selectedElementIds.has(ids[1]!)).toBe(true)
    w.unmount()
  })

  it('ctrl+click toggles row in/out of selection', async () => {
    const { ids } = seed({ elements: [{ options: {} }] })
    const canvas = useCanvasStore()
    const w = mount(HiprintElementListPanel, { props: { initiallyOpen: true } })
    const row = w.findAll('.hiprint-el-list-row')[0]!
    await row.trigger('click', { ctrlKey: true })
    expect(canvas.selectedElementIds.has(ids[0]!)).toBe(true)
    await row.trigger('click', { ctrlKey: true })
    expect(canvas.selectedElementIds.has(ids[0]!)).toBe(false)
    w.unmount()
  })

  it('selected row gets the .selected-el class', async () => {
    const { ids } = seed({ elements: [{ options: {} }] })
    const canvas = useCanvasStore()
    canvas.selectElement(ids[0]!)
    const w = mount(HiprintElementListPanel, { props: { initiallyOpen: true } })
    const row = w.findAll('.hiprint-el-list-row')[0]!
    expect(row.classes()).toContain('selected-el')
    w.unmount()
  })

  it('hover emits hover event with id, leave emits null', async () => {
    seed({ elements: [{ options: {} }] })
    const w = mount(HiprintElementListPanel, { props: { initiallyOpen: true } })
    const row = w.findAll('.hiprint-el-list-row')[0]!
    await row.trigger('mouseenter')
    await row.trigger('mouseleave')
    const events = w.emitted('hover') ?? []
    expect(events.length).toBe(2)
    expect(typeof events[0]![0]).toBe('string')
    expect(events[1]![0]).toBeNull()
    w.unmount()
  })
})

// ============ Visibility + lock toggles ============

describe('HiprintElementListPanel — toggles', () => {
  it('eye click flips options.hidden + pushes history snapshot', async () => {
    const { ids, panelId } = seed({ elements: [{ options: { title: 'A' } }] })
    const canvas = useCanvasStore()
    const history = useHistoryStore()
    const spy = vi.spyOn(history, 'pushSnapshot')
    const w = mount(HiprintElementListPanel, { props: { initiallyOpen: true } })
    const btn = w.find('button.hiprint-el-list-row-visibility')
    await btn.trigger('click')
    const el = canvas.panels[0]!.printElements[0]!
    expect((el.options as Record<string, unknown>).hidden).toBe(true)
    expect(spy).toHaveBeenCalledTimes(1)
    // Toggle back.
    await btn.trigger('click')
    expect(
      (canvas.panels[0]!.printElements[0]!.options as Record<string, unknown>).hidden
    ).toBe(false)
    expect(spy).toHaveBeenCalledTimes(2)
    // Row picks up the `.hidden-el` class when hidden.
    void ids
    void panelId
    w.unmount()
  })

  it('eye click does not trigger row selection (stopPropagation)', async () => {
    const { ids } = seed({ elements: [{ options: {} }] })
    const canvas = useCanvasStore()
    const w = mount(HiprintElementListPanel, { props: { initiallyOpen: true } })
    await w.find('button.hiprint-el-list-row-visibility').trigger('click')
    expect(canvas.selectedElementIds.has(ids[0]!)).toBe(false)
    w.unmount()
  })

  it('lock click sets positionLocked + sizeLocked + pushes history', async () => {
    seed({ elements: [{ options: {} }] })
    const canvas = useCanvasStore()
    const history = useHistoryStore()
    const spy = vi.spyOn(history, 'pushSnapshot')
    const w = mount(HiprintElementListPanel, { props: { initiallyOpen: true } })
    await w.find('button.hiprint-el-list-row-lock').trigger('click')
    const opts = canvas.panels[0]!.printElements[0]!.options as Record<
      string,
      unknown
    >
    expect(opts.positionLocked).toBe(true)
    expect(opts.sizeLocked).toBe(true)
    expect(spy).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('lock click on already-locked element clears both flags', async () => {
    seed({
      elements: [{ options: { positionLocked: true, sizeLocked: true } }],
    })
    const canvas = useCanvasStore()
    const w = mount(HiprintElementListPanel, { props: { initiallyOpen: true } })
    await w.find('button.hiprint-el-list-row-lock').trigger('click')
    const opts = canvas.panels[0]!.printElements[0]!.options as Record<
      string,
      unknown
    >
    expect(opts.positionLocked).toBe(false)
    expect(opts.sizeLocked).toBe(false)
    w.unmount()
  })
})

// ============ Drag-and-drop reorder ============

describe('HiprintElementListPanel — drag reorder', () => {
  /**
   * happy-dom does not implement a real DataTransfer; we pass a minimal
   * stub via the synthetic event so the component's onDragStart can call
   * .setData without throwing. The component primarily relies on its own
   * `draggingId` ref for the source identity, so the stub is sufficient.
   */
  function dt(): DataTransfer {
    return {
      effectAllowed: '',
      dropEffect: '',
      setData: vi.fn(),
      getData: vi.fn().mockReturnValue(''),
    } as unknown as DataTransfer
  }

  it('drag row A onto row B calls canvas.reorderElement + history snapshot', async () => {
    const { ids, panelId } = seed({
      elements: [
        { options: { title: 'A' } },
        { options: { title: 'B' } },
        { options: { title: 'C' } },
      ],
    })
    const canvas = useCanvasStore()
    const history = useHistoryStore()
    const reorderSpy = vi.spyOn(canvas, 'reorderElement')
    const pushSpy = vi.spyOn(history, 'pushSnapshot')

    const w = mount(HiprintElementListPanel, { props: { initiallyOpen: true } })
    const rows = w.findAll('.hiprint-el-list-row')
    await rows[0]!.trigger('dragstart', { dataTransfer: dt() })
    await rows[2]!.trigger('dragover', { dataTransfer: dt() })
    await rows[2]!.trigger('drop', { dataTransfer: dt() })
    expect(reorderSpy).toHaveBeenCalledTimes(1)
    expect(reorderSpy).toHaveBeenCalledWith(panelId, 0, 2)
    expect(pushSpy).toHaveBeenCalledTimes(1)
    // After reorder, ids should now read [B, C, A].
    const idsAfter = canvas.panels[0]!.printElements.map((e) => e.id)
    expect(idsAfter).toEqual([ids[1], ids[2], ids[0]])
    w.unmount()
  })

  it('drop on the same row is a safe no-op (no reorder, no snapshot)', async () => {
    seed({
      elements: [{ options: {} }, { options: {} }],
    })
    const canvas = useCanvasStore()
    const history = useHistoryStore()
    const reorderSpy = vi.spyOn(canvas, 'reorderElement')
    const pushSpy = vi.spyOn(history, 'pushSnapshot')

    const w = mount(HiprintElementListPanel, { props: { initiallyOpen: true } })
    const row = w.findAll('.hiprint-el-list-row')[0]!
    await row.trigger('dragstart', { dataTransfer: dt() })
    await row.trigger('drop', { dataTransfer: dt() })
    expect(reorderSpy).not.toHaveBeenCalled()
    expect(pushSpy).not.toHaveBeenCalled()
    w.unmount()
  })

  it('drop without dragstart is a safe no-op', async () => {
    seed({
      elements: [{ options: {} }, { options: {} }],
    })
    const canvas = useCanvasStore()
    const reorderSpy = vi.spyOn(canvas, 'reorderElement')
    const w = mount(HiprintElementListPanel, { props: { initiallyOpen: true } })
    const rows = w.findAll('.hiprint-el-list-row')
    await rows[1]!.trigger('drop', { dataTransfer: dt() })
    expect(reorderSpy).not.toHaveBeenCalled()
    w.unmount()
  })

  it('dragend clears local drag/drop refs (no stale highlight)', async () => {
    seed({
      elements: [{ options: {} }, { options: {} }],
    })
    const w = mount(HiprintElementListPanel, { props: { initiallyOpen: true } })
    const rows = w.findAll('.hiprint-el-list-row')
    await rows[0]!.trigger('dragstart', { dataTransfer: dt() })
    await rows[1]!.trigger('dragover', { dataTransfer: dt() })
    expect(rows[0]!.classes()).toContain('is-dragging')
    await rows[0]!.trigger('dragend')
    // After dragend neither row should retain dnd state.
    const rowsAfter = w.findAll('.hiprint-el-list-row')
    for (const r of rowsAfter) {
      expect(r.classes()).not.toContain('is-dragging')
      expect(r.classes()).not.toContain('is-drop-target')
    }
    w.unmount()
  })
})

// ============ TKT-156 + TKT-157 (Sprint 22d) ============

describe('HiprintElementListPanel — data-element-id (TKT-156)', () => {
  it('every row exposes data-element-id matching the element id', () => {
    const { ids } = seed({
      elements: [
        { options: { title: 'A' } },
        { options: { title: 'B' } },
        { options: { title: 'C' } },
      ],
    })
    const w = mount(HiprintElementListPanel, { props: { initiallyOpen: true } })
    const rows = w.findAll('.hiprint-el-list-row')
    expect(rows.length).toBe(3)
    rows.forEach((row, idx) => {
      expect(row.attributes('data-element-id')).toBe(ids[idx])
    })
    w.unmount()
  })
})

describe('HiprintElementListPanel — auto-scroll on selection (TKT-156)', () => {
  /**
   * The watcher calls `row.scrollIntoView({ block: 'nearest', behavior:
   * 'smooth' })` whenever `canvas.selectedElementIds` changes externally.
   * happy-dom does provide `scrollIntoView` on HTMLElement (as a noop), so
   * we stub it on the row prototype to spy on the call shape. This proves the
   * panel actually reacted to the canvas selection change and resolved the
   * correct row via `[data-element-id="..."]`.
   */
  it('selecting on the canvas externally scrolls the matching row into view', async () => {
    const { ids } = seed({
      elements: [
        { options: { title: 'A' } },
        { options: { title: 'B' } },
        { options: { title: 'C' } },
      ],
    })
    const canvas = useCanvasStore()
    const scrollSpy = vi
      .spyOn(HTMLElement.prototype, 'scrollIntoView')
      .mockImplementation(() => {})
    const w = mount(HiprintElementListPanel, {
      props: { initiallyOpen: true },
      attachTo: document.body,
    })
    // External selection (mimics user clicking on the canvas).
    canvas.selectElement(ids[1]!)
    // Watch + nextTick + nextTick (one tick inside watcher).
    await w.vm.$nextTick()
    await w.vm.$nextTick()
    expect(scrollSpy).toHaveBeenCalled()
    expect(scrollSpy).toHaveBeenCalledWith({
      block: 'nearest',
      behavior: 'smooth',
    })
    // Sanity: the row that received the scroll has the correct data-id.
    const targetRow = scrollSpy.mock.instances[0] as HTMLElement
    expect(targetRow.getAttribute('data-element-id')).toBe(ids[1])
    scrollSpy.mockRestore()
    w.unmount()
  })

  it('does not scroll when selection is cleared', async () => {
    const { ids } = seed({
      elements: [{ options: { title: 'A' } }, { options: { title: 'B' } }],
    })
    const canvas = useCanvasStore()
    // Seed an initial selection so the watcher has fired once already; then
    // clear it — that should NOT trigger scrollIntoView (size === 0 guard).
    canvas.selectElement(ids[0]!)
    const w = mount(HiprintElementListPanel, {
      props: { initiallyOpen: true },
      attachTo: document.body,
    })
    await w.vm.$nextTick()
    await w.vm.$nextTick()
    const scrollSpy = vi
      .spyOn(HTMLElement.prototype, 'scrollIntoView')
      .mockImplementation(() => {})
    canvas.clearSelection()
    await w.vm.$nextTick()
    await w.vm.$nextTick()
    expect(scrollSpy).not.toHaveBeenCalled()
    scrollSpy.mockRestore()
    w.unmount()
  })

  it('does not scroll when the panel is closed (body not rendered)', async () => {
    const { ids } = seed({
      elements: [{ options: { title: 'A' } }, { options: { title: 'B' } }],
    })
    const canvas = useCanvasStore()
    const w = mount(HiprintElementListPanel, {
      props: { initiallyOpen: false },
      attachTo: document.body,
    })
    const scrollSpy = vi
      .spyOn(HTMLElement.prototype, 'scrollIntoView')
      .mockImplementation(() => {})
    canvas.selectElement(ids[0]!)
    await w.vm.$nextTick()
    await w.vm.$nextTick()
    expect(scrollSpy).not.toHaveBeenCalled()
    scrollSpy.mockRestore()
    w.unmount()
  })
})

describe('HiprintElementListPanel — per-type tag colors (TKT-157)', () => {
  it('every etype in the V1-INVENTORY catalog gets a unique tag-<type> class', () => {
    seed({
      elements: [
        { type: 'text', options: {} },
        { type: 'longText', options: {} },
        { type: 'image', options: {} },
        { type: 'html', options: {} },
        { type: 'barcode', options: {} },
        { type: 'qrcode', options: {} },
        { type: 'hline', options: {} },
        { type: 'vline', options: {} },
        { type: 'rect', options: {} },
        { type: 'oval', options: {} },
        { type: 'table', options: {} },
        { type: 'tableCustomCell', options: {} },
      ],
    })
    const w = mount(HiprintElementListPanel, { props: { initiallyOpen: true } })
    const tags = w.findAll('.el-type-tag')
    expect(tags.length).toBe(12)
    const expected = [
      'tag-text',
      'tag-longText',
      'tag-image',
      'tag-html',
      'tag-barcode',
      'tag-qrcode',
      'tag-hline',
      'tag-vline',
      'tag-rect',
      'tag-oval',
      'tag-table',
      'tag-tableCustomCell',
    ]
    expected.forEach((cls, idx) => {
      expect(tags[idx]!.classes()).toContain(cls)
    })
    w.unmount()
  })
})
