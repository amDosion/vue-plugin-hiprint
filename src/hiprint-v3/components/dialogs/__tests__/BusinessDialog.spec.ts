/**
 * BusinessDialog.spec.ts — V3 reactive business dialog tests (P21.8).
 *
 * Covers:
 *   - mounts with open=true / open=false
 *   - flat list when no categories prop
 *   - grouping mode when categories prop provided
 *   - select emits item + closes
 *   - refresh emit
 *   - empty state
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Antd from 'ant-design-vue'
import BusinessDialog from '../BusinessDialog.vue'
import type { BusinessItem } from '../index'

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

const sampleItems: readonly BusinessItem[] = Object.freeze([
  { id: 1, name: '发货单', category: '物流' },
  { id: 2, name: '收货单', category: '物流' },
  { id: 3, name: '发票', category: '财务' },
  { id: 4, name: '未分类项', category: undefined },
])

function mountDialog(props: Partial<InstanceType<typeof BusinessDialog>['$props']> = {}) {
  return mount(BusinessDialog, {
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

describe('BusinessDialog — visibility', () => {
  it('does not render cards when open=false', async () => {
    const w = mountDialog({ open: false })
    await flushPromises()
    expect(
      document.querySelectorAll('.hiprint-business-dialog__card').length
    ).toBe(0)
    w.unmount()
  })

  it('renders cards when open=true', async () => {
    const w = mountDialog()
    await flushPromises()
    expect(
      document.querySelectorAll('.hiprint-business-dialog__card').length
    ).toBe(4)
    w.unmount()
  })
})

describe('BusinessDialog — flat vs grouped', () => {
  it('renders flat list when no categories prop', async () => {
    const w = mountDialog()
    await flushPromises()
    // No group titles in flat mode.
    expect(
      document.querySelectorAll('.hiprint-business-dialog__group-title').length
    ).toBe(0)
    w.unmount()
  })

  it('groups by category when categories prop provided', async () => {
    const w = mountDialog({ categories: ['物流', '财务'] })
    await flushPromises()
    const titles = Array.from(
      document.querySelectorAll('.hiprint-business-dialog__group-title')
    ).map((el) => el.textContent?.trim())
    expect(titles).toContain('物流')
    expect(titles).toContain('财务')
    // Uncategorised → "其他" bucket.
    expect(titles).toContain('其他')
    w.unmount()
  })
})

describe('BusinessDialog — selection + refresh', () => {
  it('emits select + closes when card clicked', async () => {
    const w = mountDialog()
    await flushPromises()
    const card = document.querySelector(
      '.hiprint-business-dialog__card'
    ) as HTMLElement
    card.click()
    await flushPromises()
    expect(w.emitted('select')).toBeTruthy()
    expect(w.emitted('update:open')?.some((e) => e[0] === false)).toBe(true)
    w.unmount()
  })

  it('emits refresh when refresh button clicked', async () => {
    const w = mountDialog()
    await flushPromises()
    // antd Modal teleports to body — search globally; antd splits CJK with
    // whitespace ("刷 新"), so compact text before matching.
    const btn = Array.from(
      document.querySelectorAll('button')
    ).find((b) =>
      (b.textContent ?? '').replace(/\s+/g, '').includes('刷新')
    ) as HTMLElement
    expect(btn).toBeTruthy()
    btn.click()
    await flushPromises()
    expect(w.emitted('refresh')).toBeTruthy()
    w.unmount()
  })
})

describe('BusinessDialog — empty', () => {
  it('renders empty state when items=[]', async () => {
    const w = mountDialog({ items: [] })
    await flushPromises()
    const empty = document.querySelector(
      '.hiprint-business-dialog__empty'
    ) as HTMLElement
    expect(empty).toBeTruthy()
    expect(empty.textContent).toContain('暂无业务场景')
    w.unmount()
  })
})
