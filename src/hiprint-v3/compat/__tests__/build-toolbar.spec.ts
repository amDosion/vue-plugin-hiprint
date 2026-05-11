/**
 * build-toolbar.spec.ts — V3 buildToolbar compat tests (P19).
 *
 * Mounts toolbar against a template's pinia, verifies destroy, getScale/setScale.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@hiprint-v3/print', async () => {
  const actual = await vi.importActual<typeof import('@hiprint-v3/print')>('@hiprint-v3/print')
  return {
    ...actual,
    browserPrint: vi.fn(() => Promise.resolve()),
    downloadPdf: vi.fn(() => Promise.resolve()),
    getPrintHtml: vi.fn(() => '<div></div>'),
  }
})

import { PrintTemplate } from '../print-template'
import { buildToolbar } from '../build-toolbar'

let host: HTMLElement
beforeEach(() => {
  host = document.createElement('div')
  host.id = 'toolbar-host'
  document.body.appendChild(host)
})
afterEach(() => {
  if (host.parentNode) host.parentNode.removeChild(host)
})

describe('buildToolbar — mount', () => {
  it('mounts toolbar into target element', () => {
    const tpl = new PrintTemplate()
    const ctrl = buildToolbar(host, tpl)
    expect(ctrl).toBeTruthy()
    expect(ctrl._app).toBeTruthy()
    expect(ctrl._container).toBe(host)
    expect(ctrl._destroyed).toBe(false)
    ctrl.destroy()
    tpl.destroy()
  })

  it('mounts via CSS selector', () => {
    const tpl = new PrintTemplate()
    const ctrl = buildToolbar('#toolbar-host', tpl)
    expect(ctrl._container).toBe(host)
    ctrl.destroy()
    tpl.destroy()
  })

  it('throws when container not found', () => {
    const tpl = new PrintTemplate()
    expect(() => buildToolbar('#missing', tpl)).toThrow(/container not found/)
    tpl.destroy()
  })

  it('throws when template is null', () => {
    expect(() => buildToolbar(host, null as unknown as PrintTemplate)).toThrow(
      /template is required/
    )
  })
})

describe('buildToolbar — controller', () => {
  it('destroy unmounts app and is idempotent', () => {
    const tpl = new PrintTemplate()
    const ctrl = buildToolbar(host, tpl)
    ctrl.destroy()
    expect(ctrl._destroyed).toBe(true)
    expect(() => ctrl.destroy()).not.toThrow()
    tpl.destroy()
  })

  it('getScale returns current canvas scale (default 1)', () => {
    const tpl = new PrintTemplate()
    const ctrl = buildToolbar(host, tpl)
    expect(ctrl.getScale()).toBe(1)
    ctrl.destroy()
    tpl.destroy()
  })

  it('setScale mutates canvas store; visible to template', () => {
    const tpl = new PrintTemplate()
    const ctrl = buildToolbar(host, tpl)
    ctrl.setScale(1.5)
    expect(ctrl.getScale()).toBe(1.5)
    ctrl.destroy()
    tpl.destroy()
  })

  it('getScale / setScale return safe fallback after destroy', () => {
    const tpl = new PrintTemplate()
    const ctrl = buildToolbar(host, tpl)
    ctrl.destroy()
    expect(ctrl.getScale()).toBe(1)
    expect(() => ctrl.setScale(2)).not.toThrow()
    tpl.destroy()
  })
})
