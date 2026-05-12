/**
 * TableInlineEditor-sprint22g-wave3.spec.ts — Sprint 22g wave 3 GM closeout.
 *
 * Covers TKT-383 — TableInlineEditor now supports `number` / `date` /
 * `textarea` editors in addition to V1's original `text` / `select` set.
 *
 * Assertions exercise:
 *   - Correct native control rendered for each `type`.
 *   - Enter commits text/number/date; Shift+Enter inserts newline in textarea.
 *   - Esc cancels in every type.
 *   - Blur commits in every type.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TableInlineEditor from '../TableInlineEditor.vue'

describe('TableInlineEditor — TKT-383 number editor', () => {
  it('renders <input type="number"> when type=number', () => {
    const w = mount(TableInlineEditor, {
      props: { modelValue: '42', type: 'number' },
    })
    const input = w.find('input[type="number"]')
    expect(input.exists()).toBe(true)
    expect(input.classes('hiprint-cell-editor-number')).toBe(true)
    w.unmount()
  })

  it('Enter commits the current value via @commit', async () => {
    const w = mount(TableInlineEditor, {
      props: { modelValue: '5', type: 'number' },
    })
    const input = w.find('input.hiprint-cell-editor-number')
    ;(input.element as HTMLInputElement).value = '99'
    await input.trigger('input')
    await input.trigger('keydown', { key: 'Enter' })
    const events = w.emitted('commit')
    expect(events).toBeDefined()
    expect(events![0]).toEqual(['99'])
    w.unmount()
  })

  it('Esc emits @cancel without @commit', async () => {
    const w = mount(TableInlineEditor, {
      props: { modelValue: '5', type: 'number' },
    })
    await w.find('input').trigger('keydown', { key: 'Escape' })
    expect(w.emitted('cancel')).toBeDefined()
    expect(w.emitted('commit')).toBeUndefined()
    w.unmount()
  })
})

describe('TableInlineEditor — TKT-383 date editor', () => {
  it('renders <input type="date"> when type=date', () => {
    const w = mount(TableInlineEditor, {
      props: { modelValue: '2025-05-12', type: 'date' },
    })
    const input = w.find('input[type="date"]')
    expect(input.exists()).toBe(true)
    expect(input.classes('hiprint-cell-editor-date')).toBe(true)
    w.unmount()
  })

  it('blur commits ISO date string', async () => {
    const w = mount(TableInlineEditor, {
      props: { modelValue: '2025-05-12', type: 'date' },
    })
    const input = w.find('input.hiprint-cell-editor-date')
    ;(input.element as HTMLInputElement).value = '2026-01-01'
    await input.trigger('input')
    await input.trigger('blur')
    expect(w.emitted('commit')![0]).toEqual(['2026-01-01'])
    w.unmount()
  })
})

describe('TableInlineEditor — TKT-383 textarea editor', () => {
  it('renders <textarea> when type=textarea', () => {
    const w = mount(TableInlineEditor, {
      props: { modelValue: 'multi\nline', type: 'textarea' },
    })
    const ta = w.find('textarea.hiprint-cell-textarea')
    expect(ta.exists()).toBe(true)
    w.unmount()
  })

  it('Enter without Shift commits; Shift+Enter does NOT commit', async () => {
    const w = mount(TableInlineEditor, {
      props: { modelValue: 'hello', type: 'textarea' },
    })
    const ta = w.find('textarea')
    ;(ta.element as HTMLTextAreaElement).value = 'hello world'
    await ta.trigger('input')

    // Shift+Enter — no commit emitted.
    await ta.trigger('keydown', { key: 'Enter', shiftKey: true })
    expect(w.emitted('commit')).toBeUndefined()

    // Plain Enter — commit emitted with the latest value.
    await ta.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('commit')).toBeDefined()
    expect(w.emitted('commit')![0]).toEqual(['hello world'])
    w.unmount()
  })

  it('blur commits the textarea value', async () => {
    const w = mount(TableInlineEditor, {
      props: { modelValue: 'a', type: 'textarea' },
    })
    const ta = w.find('textarea')
    ;(ta.element as HTMLTextAreaElement).value = 'b'
    await ta.trigger('input')
    await ta.trigger('blur')
    expect(w.emitted('commit')![0]).toEqual(['b'])
    w.unmount()
  })

  it('Esc cancels textarea editor', async () => {
    const w = mount(TableInlineEditor, {
      props: { modelValue: 'a', type: 'textarea' },
    })
    await w.find('textarea').trigger('keydown', { key: 'Escape' })
    expect(w.emitted('cancel')).toBeDefined()
    w.unmount()
  })
})

describe('TableInlineEditor — backward compat (default text + select)', () => {
  it('default type is text → <input type="text">', () => {
    const w = mount(TableInlineEditor, { props: { modelValue: 'hello' } })
    const input = w.find('input[type="text"]')
    expect(input.exists()).toBe(true)
    w.unmount()
  })

  it('type=select renders <select> with options', () => {
    const w = mount(TableInlineEditor, {
      props: {
        modelValue: 'b',
        type: 'select',
        options: [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ],
      },
    })
    const sel = w.find('select')
    expect(sel.exists()).toBe(true)
    expect(sel.findAll('option').length).toBe(2)
    w.unmount()
  })
})
