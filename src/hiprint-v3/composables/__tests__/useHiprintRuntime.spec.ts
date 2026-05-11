/**
 * useHiprintRuntime.spec.ts — init() + setDynamicFields invariants.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { useHiprintRuntime } from '../useHiprintRuntime'
import {
  PrintElementTypeGroup,
  getInstance as getRegistryInstance,
  _resetInstance,
} from '@hiprint-v3/core'

function mountHarness<T extends object>(setupFactory: () => T) {
  const Comp = defineComponent({
    setup() {
      const api = setupFactory()
      return { api }
    },
    render() {
      return h('div')
    },
  })
  return mount(Comp, {
    global: { plugins: [createPinia()] },
  })
}

describe('useHiprintRuntime', () => {
  beforeEach(() => {
    _resetInstance()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('auto-init registers default groups on mount', async () => {
    let captured!: ReturnType<typeof useHiprintRuntime>
    const wrapper = mountHarness(() => {
      captured = useHiprintRuntime()
      return { captured }
    })
    await nextTick()
    expect(captured.isInitialized.value).toBe(true)
    const reg = getRegistryInstance()
    const tids = reg.getAll().map((e) => e.tid)
    expect(tids).toContain('defaultModule.text')
    wrapper.unmount()
  })

  it('autoInit: false disables auto-registration', async () => {
    let captured!: ReturnType<typeof useHiprintRuntime>
    const wrapper = mountHarness(() => {
      captured = useHiprintRuntime({ autoInit: false })
      return { captured }
    })
    await nextTick()
    expect(captured.isInitialized.value).toBe(false)
    wrapper.unmount()
  })

  it('manual init() registers groups + sets isInitialized', async () => {
    let captured!: ReturnType<typeof useHiprintRuntime>
    const wrapper = mountHarness(() => {
      captured = useHiprintRuntime({ autoInit: false })
      return { captured }
    })
    await nextTick()
    captured.init()
    expect(captured.isInitialized.value).toBe(true)
    const reg = getRegistryInstance()
    expect(reg.getAll().length).toBeGreaterThan(0)
    wrapper.unmount()
  })

  it('setDynamicFields overwrites a module bucket', async () => {
    let captured!: ReturnType<typeof useHiprintRuntime>
    const wrapper = mountHarness(() => {
      captured = useHiprintRuntime()
      return { captured }
    })
    await nextTick()
    const group = new PrintElementTypeGroup('Custom', [
      { tid: 'biz.invoice', title: 'Invoice', type: 'text' },
    ])
    captured.setDynamicFields('biz', [group])
    const reg = getRegistryInstance()
    expect(reg.getByTid('biz.invoice')).toBeDefined()
    wrapper.unmount()
  })

  it('setDynamicFields throws on empty moduleName (invariant)', async () => {
    let captured!: ReturnType<typeof useHiprintRuntime>
    const wrapper = mountHarness(() => {
      captured = useHiprintRuntime()
      return { captured }
    })
    await nextTick()
    expect(() => captured.setDynamicFields('', [])).toThrow(/moduleName/)
    wrapper.unmount()
  })

  it('removeDynamicFields with prefix preserves siblings (PM-008)', async () => {
    let captured!: ReturnType<typeof useHiprintRuntime>
    const wrapper = mountHarness(() => {
      captured = useHiprintRuntime()
      return { captured }
    })
    await nextTick()
    const orderGroup = new PrintElementTypeGroup('Order', [
      { tid: 'order.item', title: 'Item', type: 'text' },
    ])
    const order2Group = new PrintElementTypeGroup('Order v2', [
      { tid: 'order_v2.item', title: 'Item V2', type: 'text' },
    ])
    captured.setDynamicFields('order', [orderGroup])
    captured.setDynamicFields('order_v2', [order2Group])
    captured.removeDynamicFields('order')
    const reg = getRegistryInstance()
    expect(reg.getByTid('order.item')).toBeUndefined()
    expect(reg.getByTid('order_v2.item')).toBeDefined()
    wrapper.unmount()
  })
})
