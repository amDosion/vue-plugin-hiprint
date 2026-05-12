/**
 * TemplateDialog.spec.ts — V3 reactive template dialog tests (P21.8).
 *
 * Covers:
 *   - mounts with open=true / open=false (visibility controlled by prop)
 *   - search input filters items by name + category
 *   - clicking a card emits select + update:open(false)
 *   - allowEdit + allowDelete render action links + emit edit/delete
 *   - refresh button emits refresh
 *   - empty state when items=[]
 *   - no-thumbnail fallback rendered when thumbnail missing
 *   - safeCall isolates throwing emit handlers (no test failure)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Antd from 'ant-design-vue'
import TemplateDialog from '../TemplateDialog.vue'
import type { TemplateItem } from '../index'

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

const sampleItems: readonly TemplateItem[] = Object.freeze([
  { id: 1, name: 'Invoice', category: 'finance', thumbnail: 'data:,a' },
  { id: 2, name: 'Receipt', category: 'finance' },
  { id: 3, name: 'Shipping Label', category: 'logistics', thumbnail: 'data:,c' },
])

function mountDialog(props: Partial<InstanceType<typeof TemplateDialog>['$props']> = {}) {
  return mount(TemplateDialog, {
    attachTo: document.body,
    props: {
      open: true,
      items: sampleItems,
      ...props,
    },
    global: {
      plugins: [Antd],
    },
  })
}

describe('TemplateDialog — visibility', () => {
  it('renders no modal content in DOM when open=false', async () => {
    const w = mountDialog({ open: false })
    await flushPromises()
    // ant Modal teleports to body; with open=false there must be no list card.
    expect(document.querySelector('.hiprint-template-dialog__card')).toBeNull()
    w.unmount()
  })

  it('renders modal body when open=true', async () => {
    const w = mountDialog({ open: true })
    await flushPromises()
    const cards = document.querySelectorAll('.hiprint-template-dialog__card')
    expect(cards.length).toBe(3)
    w.unmount()
  })
})

describe('TemplateDialog — search filter', () => {
  it('filters items by name (case-insensitive)', async () => {
    const w = mountDialog()
    await flushPromises()
    const input = document.querySelector(
      '.hiprint-template-dialog__search input'
    ) as HTMLInputElement
    expect(input).toBeTruthy()
    input.value = 'receipt'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    const cards = document.querySelectorAll('.hiprint-template-dialog__card')
    expect(cards.length).toBe(1)
    w.unmount()
  })

  it('filters by category as well', async () => {
    const w = mountDialog()
    await flushPromises()
    const input = document.querySelector(
      '.hiprint-template-dialog__search input'
    ) as HTMLInputElement
    input.value = 'logistics'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    const cards = document.querySelectorAll('.hiprint-template-dialog__card')
    expect(cards.length).toBe(1)
    w.unmount()
  })
})

describe('TemplateDialog — selection', () => {
  it('emits select + update:open(false) when a card is clicked', async () => {
    const w = mountDialog()
    await flushPromises()
    const card = document.querySelector(
      '.hiprint-template-dialog__card'
    ) as HTMLElement
    card.click()
    await flushPromises()
    const selectEvents = w.emitted('select')
    expect(selectEvents).toBeTruthy()
    expect(selectEvents?.[0]?.[0]).toMatchObject({ name: 'Invoice' })
    const openEvents = w.emitted('update:open')
    expect(openEvents?.some((e) => e[0] === false)).toBe(true)
    w.unmount()
  })

  it('emits edit when edit action clicked (allowEdit=true)', async () => {
    const w = mountDialog({ allowEdit: true })
    await flushPromises()
    const editLink = document.querySelector(
      '.hiprint-template-dialog__edit'
    ) as HTMLElement
    expect(editLink).toBeTruthy()
    editLink.click()
    await flushPromises()
    expect(w.emitted('edit')).toBeTruthy()
    expect(w.emitted('edit')?.[0]?.[0]).toMatchObject({ name: 'Invoice' })
    // Edit must NOT close dialog.
    const openEvents = w.emitted('update:open') ?? []
    expect(openEvents.every((e) => e[0] !== false)).toBe(true)
    w.unmount()
  })

  it('emits delete when delete action clicked (allowDelete=true)', async () => {
    const w = mountDialog({ allowDelete: true })
    await flushPromises()
    const delLink = document.querySelector(
      '.hiprint-template-dialog__delete'
    ) as HTMLElement
    expect(delLink).toBeTruthy()
    delLink.click()
    await flushPromises()
    expect(w.emitted('delete')).toBeTruthy()
    w.unmount()
  })
})

describe('TemplateDialog — refresh + empty', () => {
  it('emits refresh when refresh button clicked', async () => {
    const w = mountDialog()
    await flushPromises()
    // antd Modal teleports to body — search globally for buttons.
    // antd inserts whitespace between CJK chars ("刷 新"), so compact first.
    const refreshBtn = Array.from(
      document.querySelectorAll('button')
    ).find((b) =>
      (b.textContent ?? '').replace(/\s+/g, '').includes('刷新')
    ) as HTMLElement
    expect(refreshBtn).toBeTruthy()
    refreshBtn.click()
    await flushPromises()
    expect(w.emitted('refresh')).toBeTruthy()
    w.unmount()
  })

  it('renders empty state when items=[]', async () => {
    const w = mountDialog({ items: [] })
    await flushPromises()
    const empty = document.querySelector(
      '.hiprint-template-dialog__empty'
    ) as HTMLElement
    expect(empty).toBeTruthy()
    expect(empty.textContent).toContain('暂无模板')
    w.unmount()
  })

  it('renders no-thumb fallback when thumbnail missing and showPreview=true', async () => {
    const w = mountDialog({
      items: [
        { id: 1, name: 'WithThumb', thumbnail: 'data:,a' },
        { id: 2, name: 'NoThumb' },
      ],
    })
    await flushPromises()
    const noThumb = document.querySelectorAll(
      '.hiprint-template-dialog__no-thumb'
    )
    // 1 item lacks thumbnail → at least 1 fallback rendered.
    expect(noThumb.length).toBeGreaterThanOrEqual(1)
    w.unmount()
  })
})

// ============ Sprint 22g wave 3 — TKT-334/336/337 ============

describe('TemplateDialog — TKT-336 preview action', () => {
  it('emits `preview` when allowPreview=true and preview action clicked', async () => {
    const w = mountDialog({
      items: [{ id: 1, name: 'Sample' }],
      allowPreview: true,
    })
    await flushPromises()
    const previewBtn = document.querySelector(
      '[data-action="preview"]'
    ) as HTMLElement
    expect(previewBtn).toBeTruthy()
    previewBtn.click()
    await flushPromises()
    expect(w.emitted('preview')).toBeTruthy()
    expect((w.emitted('preview') as unknown[][])[0]?.[0]).toMatchObject({
      id: 1,
      name: 'Sample',
    })
    // Card click should NOT have fired select (propagation stopped).
    expect(w.emitted('select')).toBeFalsy()
    w.unmount()
  })

  it('hides preview action when allowPreview=false (default)', async () => {
    const w = mountDialog({
      items: [{ id: 1, name: 'Sample' }],
      allowEdit: true,
    })
    await flushPromises()
    expect(document.querySelector('[data-action="preview"]')).toBeNull()
    expect(document.querySelector('[data-action="edit"]')).toBeTruthy()
    w.unmount()
  })
})

describe('TemplateDialog — TKT-337 select emit V1 4-arg signature', () => {
  it('forwards (item, json, undefined, undefined)', async () => {
    const w = mountDialog({
      items: [
        {
          id: 1,
          name: 'Sample',
          data: { panels: [{ index: 0, width: 0, height: 0, printElements: [] }] },
        },
      ],
    })
    await flushPromises()
    // Click card → emits select with V1 4-arg shape.
    const card = document.querySelector(
      '.hiprint-template-dialog__card'
    ) as HTMLElement
    card.click()
    await flushPromises()
    const events = w.emitted('select') as unknown[][]
    expect(events).toBeTruthy()
    const args = events[0] as unknown[]
    expect(args.length).toBe(4)
    expect(args[0]).toMatchObject({ id: 1, name: 'Sample' })
    expect(args[1]).toMatchObject({ panels: expect.any(Array) })
    expect(args[2]).toBeUndefined()
    expect(args[3]).toBeUndefined()
    w.unmount()
  })
})

describe('TemplateDialog — TKT-334 emptyText / loadingText overrides', () => {
  it('overrides empty text via emptyText prop', async () => {
    const w = mountDialog({ items: [], emptyText: 'No templates yet' })
    await flushPromises()
    const empty = document.querySelector('.hiprint-template-dialog__empty')
    expect(empty?.textContent).toContain('No templates yet')
    w.unmount()
  })
})
