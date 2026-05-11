/**
 * socket.spec.ts — V3 createHiWebSocket + default token warning (R3 M4).
 * Ported from V2 socket/__tests__/web-socket.spec.js with V3 names + types.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createHiWebSocket,
  getHiWebSocket,
  _resetHiWebSocketSingleton,
  type SocketIoFactory,
  type SocketIoSocket,
} from '../socket'

const mockSocket = (): SocketIoSocket => ({
  on: vi.fn(),
  emit: vi.fn(),
  close: vi.fn(),
})

describe('createHiWebSocket', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    _resetHiWebSocketSingleton()
  })

  it('exposes V1 fields (host/token/state)', () => {
    const sock = createHiWebSocket()
    expect(sock.host).toBe('http://localhost:17521')
    expect(sock.token).toBe('vue-plugin-hiprint') // M4 default
    expect(sock.opened).toBe(false)
    expect(sock.socket).toBeNull()
  })

  it('setHost(host, token, cb) updates host + token', () => {
    const sock = createHiWebSocket()
    sock.setHost('http://other:1234', 'strong-token', () => {})
    expect(sock.host).toBe('http://other:1234')
    expect(sock.token).toBe('strong-token')
  })

  it('setHost(host, cb) — legacy V1 form (token omitted)', () => {
    const sock = createHiWebSocket()
    const origToken = sock.token
    sock.setHost('http://other:1234', () => {})
    expect(sock.host).toBe('http://other:1234')
    expect(sock.token).toBe(origToken) // unchanged
  })

  it('hasIo reflects deps.io presence', () => {
    expect(createHiWebSocket({ io: null }).hasIo()).toBe(false)
    const ioFactory: SocketIoFactory = () => mockSocket()
    expect(createHiWebSocket({ io: ioFactory }).hasIo()).toBe(true)
  })

  it('[R3 M4] start() warns about default token', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const ioFactory: SocketIoFactory = () => mockSocket()
    const sock = createHiWebSocket({ io: ioFactory })
    sock.start(() => {})
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('using default token')
    )
  })

  it('start() does NOT warn when token set explicitly', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const ioFactory: SocketIoFactory = () => mockSocket()
    const sock = createHiWebSocket({ io: ioFactory })
    sock.setHost('http://x:1', 'strong-token', () => {})
    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining('using default token')
    )
  })

  it('[silent R3] send() catches emit throw', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const sock = createHiWebSocket()
    sock.socket = {
      on: vi.fn(),
      emit: () => {
        throw new Error('boom')
      },
      close: vi.fn(),
    }
    expect(() => sock.send({ msg: 'hi' })).not.toThrow()
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('socket send data failed'),
      expect.any(Error)
    )
  })

  it('stop() closes socket + clears printer list', () => {
    const closed = vi.fn()
    const sock = createHiWebSocket()
    sock.socket = { on: vi.fn(), emit: vi.fn(), close: closed }
    sock.printerList = ['printer1', 'printer2']
    sock.stop()
    expect(closed).toHaveBeenCalled()
    expect(sock.socket).toBeNull()
    expect(sock.printerList).toEqual([])
  })

  it('getHiWebSocket returns same instance (HMR-safe)', () => {
    const a = getHiWebSocket()
    const b = getHiWebSocket()
    expect(a).toBe(b)
  })

  it('_resetHiWebSocketSingleton allows fresh test setup', () => {
    const a = getHiWebSocket()
    a.host = 'changed'
    _resetHiWebSocketSingleton()
    const b = getHiWebSocket()
    expect(b.host).toBe('http://localhost:17521')
  })

  it('IPP / address calls noop when socket null', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const sock = createHiWebSocket()
    expect(() => sock.ippPrint({})).not.toThrow()
    expect(() => sock.ippRequest({})).not.toThrow()
    expect(() => sock.getAddress('mac')).not.toThrow()
    expect(() => sock.getClients()).not.toThrow()
    expect(() => sock.getClientInfo()).not.toThrow()
    expect(() => sock.refreshPrinterList()).not.toThrow()
    expect(error).not.toHaveBeenCalled() // no socket → silent skip
  })
})
