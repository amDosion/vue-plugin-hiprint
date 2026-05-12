/**
 * dialog-wrap-class.spec.ts — TKT-255: V1 selector parity.
 *
 * V3 ported dialogs to ant-design `<Modal>` which exposes its own root
 * classes (`.ant-modal-wrap` / `.ant-modal-root`). Caller E2E suites built
 * against V1 still match on V1's wrap classes:
 *
 *   .hiprint-toolbar-business-dialog-wrap
 *   .hiprint-toolbar-template-dialog-wrap
 *   .hiprint-toolbar-save-dialog-wrap
 *   .hiprint-toolbar-custom-paper-dialog-wrap
 *
 * To keep those selectors working without coupling V3 to ant-design's
 * internal class names, the V3 dialogs forward each Modal's `wrapClassName`
 * prop with the matching V1 string (CustomPaperPopover is a plain div, so
 * the class is applied to its root element directly).
 *
 * These specs prove each wrap class is reachable from `document.body` when
 * the dialog is open — exactly what V1 e2e suites expect.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Antd from 'ant-design-vue'
import BusinessDialog from '../dialogs/BusinessDialog.vue'
import TemplateDialog from '../dialogs/TemplateDialog.vue'
import SaveDialog from '../dialogs/SaveDialog.vue'
import CustomPaperPopover from '../CustomPaperPopover.vue'

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  // Clean any stray modal mount points left by previous suites.
  document
    .querySelectorAll('.hiprint-toolbar-business-dialog-wrap')
    .forEach((n) => n.parentNode?.removeChild(n))
  document
    .querySelectorAll('.hiprint-toolbar-template-dialog-wrap')
    .forEach((n) => n.parentNode?.removeChild(n))
  document
    .querySelectorAll('.hiprint-toolbar-save-dialog-wrap')
    .forEach((n) => n.parentNode?.removeChild(n))
})

describe('TKT-255 — V1 dialog wrap-class compat', () => {
  it('BusinessDialog mounts with .hiprint-toolbar-business-dialog-wrap on document.body', async () => {
    const w = mount(BusinessDialog, {
      attachTo: document.body,
      props: { open: true, items: [{ id: 1, name: 'x' }] },
      global: { plugins: [Antd] },
    })
    await flushPromises()
    const wrap = document.querySelector('.hiprint-toolbar-business-dialog-wrap')
    expect(wrap).toBeTruthy()
    w.unmount()
  })

  it('TemplateDialog mounts with .hiprint-toolbar-template-dialog-wrap on document.body', async () => {
    const w = mount(TemplateDialog, {
      attachTo: document.body,
      props: { open: true, items: [{ id: 1, name: 'x' }] },
      global: { plugins: [Antd] },
    })
    await flushPromises()
    const wrap = document.querySelector('.hiprint-toolbar-template-dialog-wrap')
    expect(wrap).toBeTruthy()
    w.unmount()
  })

  it('SaveDialog mounts with .hiprint-toolbar-save-dialog-wrap on document.body', async () => {
    const w = mount(SaveDialog, {
      attachTo: document.body,
      props: { open: true },
      global: { plugins: [Antd] },
    })
    await flushPromises()
    const wrap = document.querySelector('.hiprint-toolbar-save-dialog-wrap')
    expect(wrap).toBeTruthy()
    w.unmount()
  })

  it('CustomPaperPopover root element has .hiprint-toolbar-custom-paper-dialog-wrap when open', async () => {
    const w = mount(CustomPaperPopover, {
      attachTo: document.body,
      props: { open: true, initialWidth: 595, initialHeight: 842 },
    })
    await flushPromises()
    const wrap = w.find('.hiprint-toolbar-custom-paper-dialog-wrap')
    expect(wrap.exists()).toBe(true)
    // Also reachable from document (popover is not teleported).
    expect(
      document.querySelector('.hiprint-toolbar-custom-paper-dialog-wrap')
    ).toBeTruthy()
    w.unmount()
  })
})
