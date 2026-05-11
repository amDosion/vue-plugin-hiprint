/**
 * useHiprintDesigner.spec.ts — lifecycle + reactive template prop.
 *
 * Uses defineComponent + mount so onMounted / onBeforeUnmount fire under a
 * real Vue setup() context. Asserts:
 *   - opts.template loads on mount
 *   - dirty-guard skips reactive reload
 *   - destroy() clears template
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { useHiprintDesigner } from '../useHiprintDesigner'

const SAMPLE_A = {
  panels: [{ index: 0, name: 'A', width: 210, height: 297 }],
}
const SAMPLE_B = {
  panels: [{ index: 0, name: 'B', width: 100, height: 150 }],
}

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
    global: {
      plugins: [createPinia()],
    },
  })
}

describe('useHiprintDesigner', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('loads opts.template on mount', async () => {
    let captured!: ReturnType<typeof useHiprintDesigner>
    const wrapper = mountHarness(() => {
      captured = useHiprintDesigner({ template: SAMPLE_A })
      return { captured }
    })
    await nextTick()
    await nextTick()
    expect(captured.template.isLoaded.value).toBe(true)
    expect(captured.isReady.value).toBe(true)
    wrapper.unmount()
  })

  it('does NOT load when template option is null', async () => {
    let captured!: ReturnType<typeof useHiprintDesigner>
    const wrapper = mountHarness(() => {
      captured = useHiprintDesigner({})
      return { captured }
    })
    await nextTick()
    expect(captured.template.isLoaded.value).toBe(false)
    // isReady true because there was nothing to wait for
    expect(captured.isReady.value).toBe(true)
    wrapper.unmount()
  })

  it('reactive template prop reloads when changed and not dirty', async () => {
    const tplRef = ref<unknown>(SAMPLE_A)
    let captured!: ReturnType<typeof useHiprintDesigner>
    const wrapper = mountHarness(() => {
      captured = useHiprintDesigner({ template: tplRef })
      return { captured }
    })
    await nextTick()
    expect(captured.template.currentJson.value?.panels[0]?.name).toBe('A')

    tplRef.value = SAMPLE_B
    await nextTick()
    await nextTick()
    expect(captured.template.currentJson.value?.panels[0]?.name).toBe('B')
    wrapper.unmount()
  })

  it('reactive template change SKIPS reload when dirty (edits-protect)', async () => {
    const tplRef = ref<unknown>(SAMPLE_A)
    let captured!: ReturnType<typeof useHiprintDesigner>
    const wrapper = mountHarness(() => {
      captured = useHiprintDesigner({ template: tplRef })
      return { captured }
    })
    await nextTick()
    await nextTick()
    // Mark dirty
    captured.template.isDirty.value = true
    tplRef.value = SAMPLE_B
    await nextTick()
    await nextTick()
    // Still A because reload skipped
    expect(captured.template.currentJson.value?.panels[0]?.name).toBe('A')
    wrapper.unmount()
  })

  it('destroyOnUnmount clears template on unmount', async () => {
    let captured!: ReturnType<typeof useHiprintDesigner>
    const wrapper = mountHarness(() => {
      captured = useHiprintDesigner({ template: SAMPLE_A })
      return { captured }
    })
    await nextTick()
    await nextTick()
    expect(captured.template.isLoaded.value).toBe(true)
    wrapper.unmount()
    expect(captured.template.isLoaded.value).toBe(false)
  })
})
