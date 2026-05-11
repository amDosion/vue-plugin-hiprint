/**
 * property-panel.spec.js — Property panel adapter contract.
 *
 * Locks:
 *  - createPropertyPanel binds to existing mount target (DOM ref or selector)
 *  - clear() removes children but not the container
 *  - destroy() is idempotent
 *  - bindPropertyPanel sets template.settingContainer to resolved DOM node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createPropertyPanel,
  bindPropertyPanel,
} from '../property-panel.js'

describe('createPropertyPanel', () => {
  let warnSpy

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('returns undefined when mount target not found (string selector)', () => {
    expect(createPropertyPanel('#does-not-exist')).toBeUndefined()
    expect(warnSpy).toHaveBeenCalled()
  })

  it('returns undefined when mount target is null', () => {
    expect(createPropertyPanel(null)).toBeUndefined()
  })

  it('binds to existing DOM element', () => {
    const el = document.createElement('div')
    el.appendChild(document.createElement('span'))
    const ctrl = createPropertyPanel(el)
    expect(ctrl).toBeDefined()
    expect(ctrl.el).toBe(el)
  })

  it('clears children on create by default', () => {
    const el = document.createElement('div')
    el.appendChild(document.createElement('span'))
    el.appendChild(document.createElement('span'))
    expect(el.children.length).toBe(2)
    createPropertyPanel(el)
    expect(el.children.length).toBe(0)
  })

  it('preserves children when clearOnCreate=false', () => {
    const el = document.createElement('div')
    el.appendChild(document.createElement('span'))
    createPropertyPanel(el, { clearOnCreate: false })
    expect(el.children.length).toBe(1)
  })

  it('clear() removes children but keeps container', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const ctrl = createPropertyPanel(el, { clearOnCreate: false })
    el.appendChild(document.createElement('input'))
    el.appendChild(document.createElement('input'))
    ctrl.clear()
    expect(el.children.length).toBe(0)
    expect(el.parentNode).toBe(document.body)
    document.body.removeChild(el)
  })

  it('show() / hide() toggle display style', () => {
    const el = document.createElement('div')
    const ctrl = createPropertyPanel(el)
    ctrl.hide()
    expect(el.style.display).toBe('none')
    ctrl.show()
    expect(el.style.display).toBe('')
  })

  it('destroy() clears children + flips isDestroyed', () => {
    const el = document.createElement('div')
    const ctrl = createPropertyPanel(el, { clearOnCreate: false })
    el.appendChild(document.createElement('span'))
    expect(ctrl.isDestroyed()).toBe(false)
    ctrl.destroy()
    expect(ctrl.isDestroyed()).toBe(true)
    expect(el.children.length).toBe(0)
  })

  it('destroy() is idempotent (no throw on repeat)', () => {
    const ctrl = createPropertyPanel(document.createElement('div'))
    ctrl.destroy()
    expect(() => ctrl.destroy()).not.toThrow()
    expect(ctrl.isDestroyed()).toBe(true)
  })

  it('clear() after destroy warns + no-op', () => {
    const ctrl = createPropertyPanel(document.createElement('div'))
    ctrl.destroy()
    ctrl.clear()
    expect(warnSpy.mock.calls.some((c) => /already destroyed/.test(c[0]))).toBe(true)
  })

  it('show/hide after destroy is no-op (does not throw)', () => {
    const el = document.createElement('div')
    const ctrl = createPropertyPanel(el)
    ctrl.destroy()
    expect(() => ctrl.show()).not.toThrow()
    expect(() => ctrl.hide()).not.toThrow()
  })
})

describe('bindPropertyPanel', () => {
  let warnSpy

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('returns undefined + warns when template is null', () => {
    expect(bindPropertyPanel(null, document.createElement('div'))).toBeUndefined()
    expect(warnSpy).toHaveBeenCalled()
  })

  it('returns undefined when mount target not found', () => {
    expect(bindPropertyPanel({}, '#missing')).toBeUndefined()
  })

  it('sets template.settingContainer to resolved DOM node', () => {
    const el = document.createElement('div')
    const tpl = {}
    expect(bindPropertyPanel(tpl, el)).toBe(el)
    expect(tpl.settingContainer).toBe(el)
  })

  it('resolves selector string to DOM node', () => {
    const el = document.createElement('div')
    el.id = 'prop-panel-test'
    document.body.appendChild(el)
    const tpl = {}
    bindPropertyPanel(tpl, '#prop-panel-test')
    expect(tpl.settingContainer).toBe(el)
    document.body.removeChild(el)
  })
})
