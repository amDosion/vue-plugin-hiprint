/**
 * HiprintElementList.spec.ts — V3 element list (palette) tests (P18.2).
 *
 * Verifies the palette reads the registry, renders modules+groups+items,
 * accepts modules subset prop, and click-to-add fires canvas.addElement.
 *
 * interact.js side effects (enableElementListSource) are mocked so we only
 * assert that the registration was invoked with the expected tid + factory.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@hiprint-v3/interactions', () => ({
  enableElementListSource: vi.fn(),
  disableInteractions: vi.fn(),
  enableElementDrag: vi.fn(),
  enablePanelDropZone: vi.fn(),
  enableElementResize: vi.fn(),
  disableElementResize: vi.fn(),
  watchPanelSize: vi.fn(),
  openContextMenu: vi.fn(),
  buildElementContextItems: vi.fn(),
  enableElementSelection: vi.fn(),
  enableLasso: vi.fn(),
  enableSelectionShortcuts: vi.fn(),
  enableDesignerKeyboard: vi.fn(),
}))

import {
  enableElementListSource,
  disableInteractions,
} from '@hiprint-v3/interactions'
import {
  getInstance,
  _resetInstance,
  PrintElementTypeGroup,
} from '@hiprint-v3/core'
import { useCanvasStore } from '@hiprint-v3/stores'
import HiprintElementList from '../HiprintElementList.vue'

function seedRegistry(): void {
  _resetInstance()
  const reg = getInstance()
  reg.register('defaultModule', [
    new PrintElementTypeGroup('常规', [
      {
        tid: 'defaultModule.text',
        title: '文本',
        type: 'text',
        icon: 'ep:document',
        data: '',
      },
      {
        tid: 'defaultModule.image',
        title: '图片',
        type: 'image',
        icon: 'ep:picture',
      },
    ]),
    new PrintElementTypeGroup('辅助', [
      {
        tid: 'defaultModule.hline',
        title: '横线',
        type: 'hline',
      },
    ]),
  ])
  reg.register('businessModule', [
    new PrintElementTypeGroup('订单', [
      {
        tid: 'businessModule.orderNo',
        title: '订单号',
        type: 'text',
        field: 'orderNo',
        data: 'SN-001',
      },
    ]),
  ])
}

beforeEach(() => {
  setActivePinia(createPinia())
  _resetInstance()
  vi.mocked(enableElementListSource).mockClear()
  vi.mocked(disableInteractions).mockClear()
})

describe('HiprintElementList — render', () => {
  it('renders empty hint when registry is empty', () => {
    const w = mount(HiprintElementList)
    expect(w.text().toLowerCase()).toContain('no element types registered')
    w.unmount()
  })

  it('renders all registered modules + groups + items', async () => {
    seedRegistry()
    const w = mount(HiprintElementList, { attachTo: document.body })
    await w.vm.$nextTick()
    // Two modules expected.
    const modules = w.findAll('details.hiprint-element-list-module')
    expect(modules.length).toBe(2)
    // Buttons (items) total = 2 (text/image) + 1 (hline) + 1 (orderNo) = 4
    const items = w.findAll('button.hiprint-element-list-item')
    expect(items.length).toBe(4)
    w.unmount()
  })

  it('item button carries data-tid attribute', async () => {
    seedRegistry()
    const w = mount(HiprintElementList, { attachTo: document.body })
    await w.vm.$nextTick()
    const items = w.findAll('button.hiprint-element-list-item')
    const tids = items
      .map((b) => b.attributes('data-tid'))
      .filter((t): t is string => !!t)
    expect(tids).toContain('defaultModule.text')
    expect(tids).toContain('defaultModule.image')
    expect(tids).toContain('defaultModule.hline')
    expect(tids).toContain('businessModule.orderNo')
    w.unmount()
  })

  it('modules subset prop restricts which modules are shown', async () => {
    seedRegistry()
    const w = mount(HiprintElementList, {
      props: { modules: ['businessModule'] },
      attachTo: document.body,
    })
    await w.vm.$nextTick()
    const modules = w.findAll('details.hiprint-element-list-module')
    expect(modules.length).toBe(1)
    const items = w.findAll('button.hiprint-element-list-item')
    expect(items.length).toBe(1)
    expect(items[0]!.attributes('data-tid')).toBe('businessModule.orderNo')
    w.unmount()
  })
})

describe('HiprintElementList — drag source registration', () => {
  it('attaches enableElementListSource to each item on mount', async () => {
    seedRegistry()
    const w = mount(HiprintElementList, { attachTo: document.body })
    await w.vm.$nextTick()
    // queueMicrotask in watcher → wait an extra microtask.
    await new Promise((resolve) => queueMicrotask(() => resolve(null)))
    expect(vi.mocked(enableElementListSource).mock.calls.length).toBe(4)
    // Each call passes a tid + createElement factory.
    const firstCall = vi.mocked(enableElementListSource).mock.calls[0]
    expect(firstCall?.[1]?.tid).toMatch(/^(defaultModule|businessModule)\./)
    expect(typeof firstCall?.[1]?.createElement).toBe('function')
    w.unmount()
  })

  it('disableInteractions called on unmount for each registered item', async () => {
    seedRegistry()
    const w = mount(HiprintElementList, { attachTo: document.body })
    await w.vm.$nextTick()
    await new Promise((resolve) => queueMicrotask(() => resolve(null)))
    const registeredCount = vi.mocked(enableElementListSource).mock.calls.length
    expect(registeredCount).toBeGreaterThan(0)
    w.unmount()
    expect(vi.mocked(disableInteractions).mock.calls.length).toBeGreaterThanOrEqual(
      registeredCount
    )
  })

  it('factory returns base props with tid + options + printElementType', async () => {
    seedRegistry()
    const w = mount(HiprintElementList, { attachTo: document.body })
    await w.vm.$nextTick()
    await new Promise((resolve) => queueMicrotask(() => resolve(null)))
    const orderCall = vi
      .mocked(enableElementListSource)
      .mock.calls.find(
        (call) => call[1]?.tid === 'businessModule.orderNo'
      )
    expect(orderCall).toBeTruthy()
    const factory = orderCall![1]!.createElement
    expect(typeof factory).toBe('function')
    const base = factory!()
    expect(base.tid).toBe('businessModule.orderNo')
    expect(base.printElementType).toMatchObject({
      type: 'text',
      title: '订单号',
      field: 'orderNo',
    })
    expect((base.options as Record<string, unknown>).field).toBe('orderNo')
    expect((base.options as Record<string, unknown>).testData).toBe('SN-001')
    w.unmount()
  })
})

describe('HiprintElementList — click-to-add', () => {
  it('clicking an item adds element to active panel and emits add', async () => {
    seedRegistry()
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    const w = mount(HiprintElementList, { attachTo: document.body })
    await w.vm.$nextTick()
    const textBtn = w
      .findAll('button.hiprint-element-list-item')
      .find((b) => b.attributes('data-tid') === 'defaultModule.text')
    expect(textBtn).toBeTruthy()
    await textBtn!.trigger('click')
    expect(canvas.panels[0]?.printElements.length).toBe(1)
    const added = canvas.panels[0]?.printElements[0]
    expect(added?.tid).toBe('defaultModule.text')
    expect(w.emitted('add')).toBeTruthy()
    w.unmount()
  })

  it('clickToAdd=false disables click-to-add', async () => {
    seedRegistry()
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    const w = mount(HiprintElementList, {
      props: { clickToAdd: false },
      attachTo: document.body,
    })
    await w.vm.$nextTick()
    const items = w.findAll('button.hiprint-element-list-item')
    await items[0]!.trigger('click')
    expect(canvas.panels[0]?.printElements.length).toBe(0)
    w.unmount()
  })

  it('click without active panel warns and does not crash', async () => {
    seedRegistry()
    // No panels added — activePanelId stays null.
    const w = mount(HiprintElementList, { attachTo: document.body })
    await w.vm.$nextTick()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const items = w.findAll('button.hiprint-element-list-item')
    await items[0]!.trigger('click')
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
    w.unmount()
  })
})
