/**
 * vue-plugin.spec.ts — V3 hiPrintPlugin Vue plugin tests (P19).
 *
 * Verifies install registers $hiPrint / $print / $print2 globals and provides
 * 'hiprint' to inject().
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@hiprint-v3/print', async () => {
  const actual = await vi.importActual<typeof import('@hiprint-v3/print')>('@hiprint-v3/print')
  return {
    ...actual,
    browserPrint: vi.fn(() => Promise.resolve()),
    getPrintHtml: vi.fn(() => '<div></div>'),
  }
})

import { createApp, h, defineComponent, inject } from 'vue'
import { hiPrintPlugin } from '../vue-plugin'
import { hiprint } from '../hiprint-global'
import { browserPrint, getHiWebSocket, _resetHiWebSocketSingleton } from '@hiprint-v3/print'

beforeEach(() => {
  _resetHiWebSocketSingleton()
  vi.mocked(browserPrint).mockClear()
})

describe('hiPrintPlugin — install', () => {
  it('default install registers $hiPrint global', () => {
    const app = createApp({ render: () => h('div') })
    app.use(hiPrintPlugin)
    expect(app.config.globalProperties.$hiPrint).toBe(hiprint)
  })

  it('install with custom name registers under that name', () => {
    const app = createApp({ render: () => h('div') })
    app.use(hiPrintPlugin, '$myPrint')
    expect((app.config.globalProperties as Record<string, unknown>).$myPrint).toBe(hiprint)
  })

  it('install with options object honors name', () => {
    const app = createApp({ render: () => h('div') })
    app.use(hiPrintPlugin, { name: '$customPrint' })
    expect(
      (app.config.globalProperties as Record<string, unknown>).$customPrint
    ).toBe(hiprint)
  })

  it('registers $print and $print2 as functions', () => {
    const app = createApp({ render: () => h('div') })
    app.use(hiPrintPlugin)
    expect(typeof app.config.globalProperties.$print).toBe('function')
    expect(typeof app.config.globalProperties.$print2).toBe('function')
  })

  it('provides hiprint via app.provide()', () => {
    const captured: { hiprint?: unknown } = {}
    const Probe = defineComponent({
      setup() {
        captured.hiprint = inject('hiprint')
        return () => h('div', 'probe')
      },
    })
    const host = document.createElement('div')
    document.body.appendChild(host)
    const app = createApp(Probe)
    app.use(hiPrintPlugin)
    app.mount(host)
    expect(captured.hiprint).toBe(hiprint)
    app.unmount()
    host.remove()
  })
})

describe('hiPrintPlugin — $print / $print2', () => {
  it('$print invokes browserPrint with template', () => {
    const app = createApp({ render: () => h('div') })
    app.use(hiPrintPlugin)
    const $print = app.config.globalProperties.$print as (...args: unknown[]) => void
    const template = { panels: [] }
    $print(template, { id: 1 })
    expect(browserPrint).toHaveBeenCalled()
  })

  it('$print2 warns when socket not connected', () => {
    const app = createApp({ render: () => h('div') })
    app.use(hiPrintPlugin)
    const $print2 = app.config.globalProperties.$print2 as (...args: unknown[]) => void
    const ws = getHiWebSocket()
    ws.opened = false
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    $print2({ panels: [] }, { id: 2 })
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('$print2 called but hiwebSocket not connected')
    )
    warn.mockRestore()
  })

  it('$print2 sends payload when socket connected', () => {
    const app = createApp({ render: () => h('div') })
    app.use(hiPrintPlugin)
    const $print2 = app.config.globalProperties.$print2 as (...args: unknown[]) => void
    const ws = getHiWebSocket()
    const send = vi.spyOn(ws, 'send').mockImplementation(() => {})
    ws.opened = true
    $print2({ panels: [] }, { id: 3 })
    expect(send).toHaveBeenCalledTimes(1)
    const payload = send.mock.calls[0]?.[0] as { type: string }
    expect(payload.type).toBe('PRINT')
    send.mockRestore()
    ws.opened = false
  })
})

describe('hiPrintPlugin — disAutoConnect', () => {
  it('top-level disAutoConnect calls socket.stop', () => {
    const ws = getHiWebSocket()
    const stop = vi.spyOn(ws, 'stop').mockImplementation(() => {})
    hiPrintPlugin.disAutoConnect()
    expect(stop).toHaveBeenCalled()
    stop.mockRestore()
  })
})
