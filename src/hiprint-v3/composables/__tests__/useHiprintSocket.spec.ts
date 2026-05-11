/**
 * useHiprintSocket.spec.ts — connect/disconnect + reactive flags.
 *
 * Reuses the MockSocket pattern from store-level tests so we can fire
 * 'connect' / 'connect_error' synthetically.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

interface MockHandlers {
  [event: string]: Array<(...args: unknown[]) => void>
}
class MockSocket {
  connected = false
  emitted: Array<[string, unknown]> = []
  handlers: MockHandlers = {}
  on(event: string, fn: (...args: unknown[]) => void): this {
    this.handlers[event] ||= []
    this.handlers[event]!.push(fn)
    return this
  }
  emit(event: string, payload: unknown): boolean {
    this.emitted.push([event, payload])
    return true
  }
  close(): void {
    this.connected = false
  }
  fire(event: string, ...args: unknown[]): void {
    ;(this.handlers[event] ?? []).forEach((h) => h(...args))
  }
}
let lastMockSocket: MockSocket | null = null
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => {
    const s = new MockSocket()
    lastMockSocket = s
    return s
  }),
}))

const GLOBAL_KEY = '__hiprintV3SocketSingleton'
function resetSingleton(): void {
  ;(globalThis as Record<string, unknown>)[GLOBAL_KEY] = undefined
}

import { useHiprintSocket } from '../useHiprintSocket'

describe('useHiprintSocket', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetSingleton()
    lastMockSocket = null
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('isConnected flips after socket fires connect', async () => {
    const h = useHiprintSocket()
    expect(h.isConnected.value).toBe(false)
    const promise = h.connect('http://localhost:17521', 'tok')
    // The store wires up handlers synchronously when io() returns; fire connect.
    lastMockSocket!.connected = true
    lastMockSocket!.fire('connect')
    await promise
    expect(h.isConnected.value).toBe(true)
  })

  it('connect rejects on connect_error', async () => {
    const h = useHiprintSocket()
    const promise = h.connect('http://localhost:17521')
    lastMockSocket!.fire('connect_error', new Error('refused'))
    await expect(promise).rejects.toThrow(/refused/)
  })

  it('disconnect clears the socket', async () => {
    const h = useHiprintSocket()
    const promise = h.connect('http://localhost:17521')
    lastMockSocket!.connected = true
    lastMockSocket!.fire('connect')
    await promise
    h.disconnect()
    expect(h.isConnected.value).toBe(false)
    expect(h.clients.value.length).toBe(0)
  })

  it('clients reactive updates after store onClientUpdate', async () => {
    const h = useHiprintSocket()
    const promise = h.connect('http://localhost:17521')
    lastMockSocket!.connected = true
    lastMockSocket!.fire('connect')
    await promise
    lastMockSocket!.fire('clients', [{ id: 'p1', name: 'Printer 1' }])
    expect(h.clients.value.length).toBe(1)
    expect(h.clients.value[0]?.id).toBe('p1')
  })

  it('refreshClients no-ops + warns when disconnected', () => {
    const h = useHiprintSocket()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    h.refreshClients()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('fast-path: connect to same URL while already connected resolves immediately', async () => {
    const h = useHiprintSocket()
    const p1 = h.connect('http://localhost:17521')
    lastMockSocket!.connected = true
    lastMockSocket!.fire('connect')
    await p1
    // Second call to same host — store fast-paths.
    await h.connect('http://localhost:17521')
    expect(h.isConnected.value).toBe(true)
  })
})
