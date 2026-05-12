/**
 * SaveDialog.spec.ts — V3 reactive save dialog tests (P21.8).
 *
 * Covers:
 *   - mounts with open=true / open=false
 *   - name field required validation blocks submit
 *   - submit emits payload with trimmed name + optional fields
 *   - initialValue prefills form on open
 *   - cancel emit + update:open(false)
 *   - categoryOptions renders select dropdown
 *   - opening dialog resets to latest initialValue
 *   - long name (>64) is rejected
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Antd from 'ant-design-vue'
import SaveDialog from '../SaveDialog.vue'
import type { SaveDialogPayload } from '../index'

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

function mountDialog(props: Partial<InstanceType<typeof SaveDialog>['$props']> = {}) {
  return mount(SaveDialog, {
    attachTo: document.body,
    props: {
      open: true,
      ...props,
    },
    global: {
      plugins: [Antd],
    },
  })
}

function getNameInput(): HTMLInputElement {
  // antd v4 applies our `class` directly to the <input> element.
  return document.querySelector(
    'input.hiprint-save-dialog__name'
  ) as HTMLInputElement
}

/** Strip whitespace antd inserts between CJK characters ("保 存" → "保存"). */
function compactText(el: Element | null | undefined): string {
  return (el?.textContent ?? '').replace(/\s+/g, '')
}

function getOkButton(): HTMLElement {
  return Array.from(
    document.querySelectorAll('.ant-modal-footer button')
  ).find((b) => compactText(b).includes('保存')) as HTMLElement
}

function getCancelButton(): HTMLElement {
  return Array.from(
    document.querySelectorAll('.ant-modal-footer button')
  ).find((b) => compactText(b).includes('取消')) as HTMLElement
}

describe('SaveDialog — visibility', () => {
  it('does not render form when open=false', async () => {
    const w = mountDialog({ open: false })
    await flushPromises()
    expect(getNameInput()).toBeNull()
    w.unmount()
  })

  it('renders form when open=true', async () => {
    const w = mountDialog()
    await flushPromises()
    expect(getNameInput()).toBeTruthy()
    w.unmount()
  })
})

describe('SaveDialog — validation', () => {
  it('blocks submit when name is empty', async () => {
    const w = mountDialog()
    await flushPromises()
    const ok = getOkButton()
    expect(ok).toBeTruthy()
    ok.click()
    await flushPromises()
    expect(w.emitted('submit')).toBeFalsy()
    // Error text rendered.
    const help = document.querySelector('.ant-form-item-explain-error')
    expect(help?.textContent).toContain('请输入')
    w.unmount()
  })

  it('blocks submit when name exceeds 64 chars', async () => {
    // a-input maxlength prevents typing > 64; we set value directly via the
    // bound state by typing a 64-char string then force-extend via internal API.
    const w = mountDialog()
    await flushPromises()
    const input = getNameInput()
    const longName = 'a'.repeat(65)
    input.value = longName
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    // a-input maxlength=64 truncates to 64 → submit succeeds with 64-char name.
    // To assert > 64 logic, bypass via component-level state.
    const vm = w.vm as unknown as { formState: { name: string } }
    vm.formState.name = longName
    await flushPromises()
    getOkButton().click()
    await flushPromises()
    expect(w.emitted('submit')).toBeFalsy()
    const help = document.querySelector('.ant-form-item-explain-error')
    expect(help?.textContent).toContain('64')
    w.unmount()
  })
})

describe('SaveDialog — submit', () => {
  it('emits submit with trimmed name + optional fields', async () => {
    const w = mountDialog()
    await flushPromises()
    const input = getNameInput()
    input.value = '  My Template  '
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    getOkButton().click()
    await flushPromises()
    const submitEvents = w.emitted('submit')
    expect(submitEvents).toBeTruthy()
    const payload = submitEvents?.[0]?.[0] as SaveDialogPayload
    expect(payload.name).toBe('My Template')
    // Optional fields omitted when empty.
    expect(payload.category).toBeUndefined()
    expect(payload.description).toBeUndefined()
    w.unmount()
  })

  it('emits submit with category + description + tags when set', async () => {
    const w = mountDialog()
    await flushPromises()
    const input = getNameInput()
    input.value = 'Tmpl'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    // Directly set form state for category/description/tags.
    const vm = w.vm as unknown as {
      formState: { category: string; description: string; tags: string[] }
    }
    vm.formState.category = 'finance'
    vm.formState.description = 'Hello'
    vm.formState.tags = ['a', 'b']
    await flushPromises()
    getOkButton().click()
    await flushPromises()
    const payload = w.emitted('submit')?.[0]?.[0] as SaveDialogPayload
    expect(payload).toMatchObject({
      name: 'Tmpl',
      category: 'finance',
      description: 'Hello',
      tags: ['a', 'b'],
    })
    w.unmount()
  })
})

describe('SaveDialog — initialValue', () => {
  it('prefills form when opened with initialValue', async () => {
    const w = mountDialog({
      open: true,
      initialValue: { name: 'Preset', category: 'finance' },
    })
    await flushPromises()
    expect(getNameInput().value).toBe('Preset')
    w.unmount()
  })

  it('re-applies initialValue when reopened', async () => {
    const w = mountDialog({
      open: false,
      initialValue: { name: 'First' },
    })
    await flushPromises()
    await w.setProps({ open: true })
    await flushPromises()
    expect(getNameInput().value).toBe('First')
    await w.setProps({ open: false, initialValue: { name: 'Second' } })
    await flushPromises()
    await w.setProps({ open: true })
    await flushPromises()
    expect(getNameInput().value).toBe('Second')
    w.unmount()
  })
})

describe('SaveDialog — cancel', () => {
  it('emits cancel + update:open(false) on cancel button', async () => {
    const w = mountDialog()
    await flushPromises()
    getCancelButton().click()
    await flushPromises()
    expect(w.emitted('cancel')).toBeTruthy()
    expect(w.emitted('update:open')?.some((e) => e[0] === false)).toBe(true)
    w.unmount()
  })
})

describe('SaveDialog — categoryOptions', () => {
  it('renders select dropdown when categoryOptions provided', async () => {
    const w = mountDialog({ categoryOptions: ['finance', 'logistics'] })
    await flushPromises()
    // a-select renders inside the dialog
    expect(
      document.querySelector('.hiprint-save-dialog__category.ant-select')
    ).toBeTruthy()
    w.unmount()
  })
})

// ============ Sprint 22g wave 3 — TKT-333 / TKT-334 ============

describe('SaveDialog — TKT-334 text-opt overrides', () => {
  it('overrides namePlaceholder + nameRequiredText + button labels', async () => {
    const w = mountDialog({
      namePlaceholder: 'Type here',
      nameRequiredText: 'Required.',
      confirmText: 'Persist',
      cancelText: 'Discard',
    })
    await flushPromises()
    // Placeholder applied to the underlying <input> — verifies namePlaceholder.
    expect(getNameInput().placeholder).toBe('Type here')
    // Submit with empty → error text uses nameRequiredText override.
    const okButtons = Array.from(
      document.querySelectorAll('.ant-modal-footer button')
    )
    const persistBtn = okButtons.find((b) => compactText(b).includes('Persist'))
    const discardBtn = okButtons.find((b) => compactText(b).includes('Discard'))
    expect(persistBtn).toBeTruthy()
    expect(discardBtn).toBeTruthy()
    ;(persistBtn as HTMLElement).click()
    await flushPromises()
    const help = document.querySelector('.ant-form-item-explain-error')
    expect(help?.textContent).toContain('Required.')
    w.unmount()
  })

  it('TKT-333 deterministic name input id derives from uid prop', async () => {
    const w = mountDialog({ uid: 'unit-001' })
    await flushPromises()
    expect(document.getElementById('hp-save-name-unit-001')).toBeTruthy()
    w.unmount()
  })

  it('TKT-333 errorMessage renders inside a role="alert" surface', async () => {
    const w = mountDialog({ errorMessage: 'Network down' })
    await flushPromises()
    // role=alert may be on our wrapping <div> or on antd's modal — search both.
    const alerts = Array.from(document.querySelectorAll('[role="alert"]'))
    const ours = alerts.find((a) => a.textContent?.includes('Network down'))
    expect(ours).toBeTruthy()
    w.unmount()
  })
})
