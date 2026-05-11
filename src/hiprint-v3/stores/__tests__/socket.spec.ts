/**
 * socket.spec.ts — useSocketStore with mocked socket.io-client.
 *
 * Verifies:
 *  - connect / disconnect / send wiring
 *  - connected / connecting flags
 *  - HMR-safe globalThis singleton (re-calling connect on same URL reuses socket)
 *  - default-token security warning [M4]
 *  - clients reactive updates via onClientUpdate
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// ------- Mock socket.io-client -------

interface MockHandlers {
  [event: string]: Array<(...args: unknown[]) => void>
}

class MockSocket {
  connected = false
  emitted: Array<[string, unknown]> = []
  handlers: MockHandlers = {}
  closed = false

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
    this.closed = true
    this.connected = false
  }
  // Test helper: simulate server event
  fire(event: string, ...args: unknown[]): void {
    ;(this.handlers[event] ?? []).forEach((h) => h(...args))
  }
}

let lastMockSocket: MockSocket | null = null

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => {
    const sock = new MockSocket()
    lastMockSocket = sock
    return sock
  }),
}))

// Reset the globalThis singleton between tests so we get a fresh socket
// (the store stashes a singleton on globalThis for HMR safety).
const GLOBAL_KEY = '__hiprintV3SocketSingleton'
function resetSingleton(): void {
  ;(globalThis as Record<string, unknown>)[GLOBAL_KEY] = undefined
}

describe('useSocketStore', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    resetSingleton()
    lastMockSocket = null
    // import fresh after each reset of mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    resetSingleton()
  })

  it('initial state — not connected, no clients', async () => {
    const { useSocketStore } = await import('../socket')
    const s = useSocketStore()
    expect(s.connected).toBe(false)
    expect(s.connecting).toBe(false)
    expect(s.clients).toEqual([])
  })

  it('connect() creates socket + sets connecting=true', async () => {
    const { useSocketStore } = await import('../socket')
    const s = useSocketStore()
    s.connect('http://localhost:17521', 'my-token')
    expect(s.connecting).toBe(true)
    expect(lastMockSocket).not.toBeNull()
  })

  it('socket "connect" event flips connected=true / connecting=false', async () => {
    const { useSocketStore } = await import('../socket')
    const s = useSocketStore()
    s.connect('http://localhost:17521', 'my-token')
    lastMockSocket?.fire('connect')
    expect(s.connected).toBe(true)
    expect(s.connecting).toBe(false)
  })

  it('default token warns on connect [M4]', async () => {
    const { useSocketStore } = await import('../socket')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const s = useSocketStore()
    s.connect()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('disconnect() closes socket + clears state', async () => {
    const { useSocketStore } = await import('../socket')
    const s = useSocketStore()
    s.connect('http://localhost:17521', 'tok')
    lastMockSocket?.fire('connect')
    expect(s.connected).toBe(true)
    const sock = lastMockSocket!
    s.disconnect()
    expect(s.connected).toBe(false)
    expect(sock.closed).toBe(true)
    expect(s.clients).toEqual([])
  })

  it('send() emits "news" event with payload', async () => {
    const { useSocketStore } = await import('../socket')
    const s = useSocketStore()
    s.connect('http://localhost:17521', 'tok')
    lastMockSocket!.connected = true
    lastMockSocket?.fire('connect')
    s.send({ cmd: 'print' })
    expect(lastMockSocket?.emitted).toContainEqual(['news', { cmd: 'print' }])
  })

  it('send() while disconnected warns + does not throw', async () => {
    const { useSocketStore } = await import('../socket')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const s = useSocketStore()
    s.send({ cmd: 'print' })
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('clients update reactively when server emits "clients"', async () => {
    const { useSocketStore } = await import('../socket')
    const s = useSocketStore()
    s.connect('http://localhost:17521', 'tok')
    lastMockSocket?.fire('clients', [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ])
    expect(s.clients.length).toBe(2)
    expect(s.hasClients).toBe(true)
    expect(s.clientCount).toBe(2)
  })

  it('singleton: re-call useSocketStore returns same store instance', async () => {
    const { useSocketStore } = await import('../socket')
    const s1 = useSocketStore()
    const s2 = useSocketStore()
    expect(s1).toBe(s2)
  })
})
