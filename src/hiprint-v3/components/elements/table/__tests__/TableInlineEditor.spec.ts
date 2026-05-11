/**
 * TableInlineEditor.spec.ts — table inline editor focused tests.
 *
 * Covers V2 inline-editor.js (TextInlineEditor / SelectInlineEditor) behaviors:
 *  - Auto-focus on mount (V2 line 1668).
 *  - v-model two-way binding (text input).
 *  - Enter / blur → commit emission.
 *  - Escape → cancel emission (no commit).
 *  - Select flavor commits on change (V2 line 1717).
 *
 * Locked invariants verified:
 *  - Value rendered via DOM input.value (NOT innerHTML) → no XSS path.
 */
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TableInlineEditor from '../TableInlineEditor.vue'

describe('TableInlineEditor', () => {
  it('renders an <input> by default and binds value to modelValue', () => {
    const wrapper = mount(TableInlineEditor, {
      props: { modelValue: 'hello' },
    })
    const input = wrapper.find('input')
    expect(input.exists()).toBe(true)
    expect((input.element as HTMLInputElement).value).toBe('hello')
  })

  it('auto-focuses input on mount', async () => {
    // Attach to document so focus moves to the input (happy-dom requires this).
    const root = document.createElement('div')
    document.body.appendChild(root)
    const wrapper = mount(TableInlineEditor, {
      props: { modelValue: 'x' },
      attachTo: root,
    })
    await flushPromises()
    // Allow the queueMicrotask in onMounted to flush.
    await new Promise<void>((r) => queueMicrotask(r))
    const input = wrapper.find('input').element as HTMLInputElement
    expect(document.activeElement === input).toBe(true)
    wrapper.unmount()
    root.remove()
  })

  it('emits update:modelValue on input and commit on Enter', async () => {
    const wrapper = mount(TableInlineEditor, {
      props: { modelValue: 'old' },
    })
    const input = wrapper.find('input')
    await input.setValue('new')
    const updates = wrapper.emitted('update:modelValue')
    expect(updates).toBeTruthy()
    expect(updates && updates[updates.length - 1]).toEqual(['new'])

    await input.trigger('keydown', { key: 'Enter' })
    const commits = wrapper.emitted('commit')
    expect(commits).toBeTruthy()
    expect(commits && commits[commits.length - 1]).toEqual(['new'])
  })

  it('emits cancel (not commit) on Escape', async () => {
    const wrapper = mount(TableInlineEditor, {
      props: { modelValue: 'hello' },
    })
    const input = wrapper.find('input')
    await input.trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('cancel')).toBeTruthy()
    expect(wrapper.emitted('commit')).toBeFalsy()
  })

  it('renders <select> when type=select and commits on change', async () => {
    const wrapper = mount(TableInlineEditor, {
      props: {
        modelValue: 'a',
        type: 'select',
        options: [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ],
      },
    })
    expect(wrapper.find('select').exists()).toBe(true)
    const select = wrapper.find('select')
    await select.setValue('b')
    const commits = wrapper.emitted('commit')
    expect(commits).toBeTruthy()
    expect(commits && commits[commits.length - 1]).toEqual(['b'])
  })

  it('emits commit on blur', async () => {
    const wrapper = mount(TableInlineEditor, {
      props: { modelValue: 'v' },
    })
    const input = wrapper.find('input')
    await input.setValue('x')
    await input.trigger('blur')
    const commits = wrapper.emitted('commit')
    expect(commits).toBeTruthy()
    expect(commits && commits[commits.length - 1]).toEqual(['x'])
  })

  // Verify there is NO path that ever inserts user-supplied HTML.
  it('XSS: dangerous strings appear as literal text in input.value', async () => {
    const xss = '<script>alert(1)</script>'
    const wrapper = mount(TableInlineEditor, {
      props: { modelValue: xss },
    })
    const input = wrapper.find('input').element as HTMLInputElement
    expect(input.value).toBe(xss)
    // No <script> element should exist anywhere.
    expect(wrapper.find('script').exists()).toBe(false)
    // Silence warning spy noise on teardown.
    vi.restoreAllMocks()
  })
})
