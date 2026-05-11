/**
 * socket.ts — hiwebSocket V3 (socket.io client wrapper for local print client).
 *
 * V1 source: bundle.js line 8395-8565 (window.hiwebSocket).
 * V2 reference: src/hiprint-v2/socket/web-socket.js
 *
 * V3 changes vs V2:
 *  - TypeScript strict types
 *  - EventBus dependency injected (V3 internal/event-bus) instead of relying
 *    on legacy `hinnn.event` global
 *  - HMR-safe singleton via globalThis cache (preserves V2 GLOBAL_KEY pattern)
 *  - All emit() strings + payload shape are byte-for-byte identical to V2 —
 *    business consumers' silent-print pipeline (electron-hiprint) is
 *    untouched (ADR-0011 invariant #12).
 *
 * Invariants (V3 必须保留, see ADR-0011):
 *  - [security M4] default token 'vue-plugin-hiprint' warned at start() time;
 *    production must call setHost(host, token, cb) with a strong unique token.
 *  - [silent-failure R3] every emit() wrapped in try/catch with [hiprint]
 *    prefix logging.
 *  - [PM-005] reconnect failures trigger 'connect_error' event (not silent).
 */

import { sendByFragments as sendByFragmentsImpl, type FragmentContent } from './send-by-fragments'
import type { EventBus } from '@hiprint-v3/internal'

// ============ Public types ============

/**
 * Minimal socket.io-client Socket surface we depend on. Keeps the dependency
 * narrow so unit tests can mock with a plain object.
 */
export interface SocketIoSocket {
  on(event: string, handler: (...args: unknown[]) => void): unknown
  emit(event: string, ...args: unknown[]): unknown
  close(): void
}

/**
 * socket.io-client factory signature. Library consumers either pass the
 * default `io` import or a mocked one for tests.
 */
export type SocketIoFactory = (
  url: string,
  opts: {
    transports?: string[]
    reconnectionAttempts?: number
    auth?: Record<string, unknown>
    [key: string]: unknown
  }
) => SocketIoSocket

export interface CreateHiWebSocketDeps {
  /** socket.io-client constructor (use `import { io } from 'socket.io-client'`). */
  io?: SocketIoFactory | null
  /** V3 event bus from `@hiprint-v3/internal` (createEventBus()). */
  event?: EventBus | undefined
}

export type SocketConnState = 'connected' | 'reconnecting' | null

export interface HiWebSocket {
  opened: boolean
  readonly name: 'webSockets'
  host: string
  token: string
  reconnectTimeout: number
  reconnectWindowSetTimeout: ReturnType<typeof setTimeout> | null
  reconnectDelay: number
  socket: SocketIoSocket | null
  state: SocketConnState
  printerList: unknown[]

  supportsKeepAlive(): true
  hasIo(): boolean
  setHost(host: string, token?: string | StartCallback, cb?: StartCallback): void
  send(payload: unknown): void
  sendByFragments(content: FragmentContent): void
  start(cb?: StartCallback): void
  stop(): void
  reconnect(): void
  ensureReconnectingState(): boolean
  getPrinterList(): unknown[]
  refreshPrinterList(): void
  ippPrint(options: unknown): void
  ippRequest(options: unknown): void
  getAddress(type: string, ...args: unknown[]): void
  getClients(): void
  getClientInfo(): void
  getPaperSizeInfo(printer: unknown): void
}

export type StartCallback = (opened: boolean, err?: unknown) => void

// ============ Constants ============

const STATE_CONNECTED: SocketConnState = 'connected'
const STATE_RECONNECTING: SocketConnState = 'reconnecting'

const GLOBAL_KEY = '__HIPRINT_V3_HIWEBSOCKET_INSTANCE__'

// ============ Factory ============

/**
 * Create a new hiwebSocket instance.
 *
 * V1 had a single window.hiwebSocket global. V2/V3 support factory + singleton
 * (see getHiWebSocket below); typical production usage is still the singleton.
 */
export function createHiWebSocket(deps?: CreateHiWebSocketDeps): HiWebSocket {
  const dep = deps ?? {}
  const io: SocketIoFactory | null =
    dep.io ??
    (typeof window !== 'undefined'
      ? ((window as unknown as { io?: SocketIoFactory }).io ?? null)
      : null)
  const event = dep.event

  const sock: HiWebSocket = {
    opened: false,
    name: 'webSockets',
    host: 'http://localhost:17521',
    // [M4] default token; production must call setHost(host, token, cb) with strong unique token
    token: 'vue-plugin-hiprint',
    reconnectTimeout: 60_000,
    reconnectWindowSetTimeout: null,
    reconnectDelay: 2_000,
    socket: null,
    state: null,
    printerList: [],

    supportsKeepAlive: () => true,
    hasIo: () => io != null,

    /**
     * Set host + token. V3 best-practice: call this BEFORE start() in production.
     * Legacy V1 signature supports passing the callback as the second arg
     * (no token); we detect and shift.
     */
    setHost(host, token, cb) {
      if (typeof token === 'function') {
        cb = token
        token = undefined
      }
      this.host = host
      if (typeof token === 'string') this.token = token
      this.stop()
      this.start(cb)
    },

    /**
     * Send a single message via socket.emit('news', ...).
     * Protocol identical to V1/V2.
     */
    send(payload) {
      try {
        if (this.socket) this.socket.emit('news', payload)
      } catch (err) {
        console.error(
          '[hiprint] socket send data failed (' + (payload as string | undefined ?? '') + '):',
          err
        )
      }
    },

    /**
     * Send long HTML via batched fragments. See ./send-by-fragments.ts.
     */
    sendByFragments(content) {
      const self = this
      sendByFragmentsImpl(this.socket, content, {
        getSocket: () => self.socket,
      })
    },

    /**
     * Start socket.io connection.
     */
    start(cb) {
      if (typeof window === 'undefined' || !window.WebSocket) {
        console.error('[hiprint] WebSocket start failed (window.WebSocket missing)')
        if (typeof cb === 'function') cb(false)
        return
      }
      // [M4] runtime check default token
      if (this.token === 'vue-plugin-hiprint') {
        console.warn(
          '[hiprint] hiwebSocket using default token "vue-plugin-hiprint"; ' +
            'production should call hiwebSocket.setHost(host, token, cb) with a strong unique token'
        )
      }
      if (this.socket) {
        if (typeof cb === 'function') cb(!!this.opened)
        return
      }
      if (!io) {
        console.error('[hiprint] socket.io not available (window.io missing)')
        if (typeof cb === 'function') cb(false)
        return
      }

      this.socket = io(this.host, {
        transports: ['websocket'],
        reconnectionAttempts: 5,
        auth: { token: this.token },
      })

      this.socket.on('connect', () => {
        this.opened = true
        console.warn('[hiprint] Websocket opened.')
        this.state = STATE_CONNECTED
        event?.trigger('connected', { host: this.host })
        if (typeof cb === 'function') cb(true)
      })

      this.socket.on('connect_error', (...args: unknown[]) => {
        const err = args[0]
        this.opened = false
        console.error('[hiprint] socket connect_error:', err)
        event?.trigger('connect_error', err)
        if (typeof cb === 'function') cb(false, err)
      })

      this.socket.on('disconnect', () => {
        this.opened = false
        this.state = STATE_RECONNECTING
        event?.trigger('disconnected', {})
      })
    },

    /**
     * Close socket + clear printer list.
     */
    stop() {
      if (this.socket) {
        console.warn('[hiprint] Closing the Websocket.')
        this.socket.close()
        this.socket = null
        this.printerList = []
      }
    },

    /**
     * Reconnect (alias to stop + start).
     */
    reconnect() {
      if (this.state === STATE_CONNECTED || this.state === STATE_RECONNECTING) {
        this.stop()
        if (this.ensureReconnectingState()) {
          console.warn('[hiprint] Websocket reconnecting.')
          this.start()
        }
      }
    },

    ensureReconnectingState() {
      this.state = STATE_RECONNECTING
      return this.state === STATE_RECONNECTING
    },

    getPrinterList() {
      return this.printerList || []
    },

    refreshPrinterList() {
      try {
        if (this.socket) this.socket.emit('refreshPrinterList')
      } catch (err) {
        console.error('[hiprint] refreshPrinterList failed:', err)
      }
    },

    ippPrint(options) {
      try {
        if (this.socket) this.socket.emit('ippPrint', options)
      } catch (err) {
        console.error('[hiprint] ippPrint failed:', err)
      }
    },

    ippRequest(options) {
      try {
        if (this.socket) this.socket.emit('ippRequest', options)
      } catch (err) {
        console.error('[hiprint] ippRequest failed:', err)
      }
    },

    getAddress(type, ...args) {
      try {
        if (this.socket) this.socket.emit('address', type, ...args)
      } catch (err) {
        console.error('[hiprint] getAddress failed:', err)
      }
    },

    getClients() {
      try {
        if (this.socket) this.socket.emit('getClients')
      } catch (err) {
        console.error('[hiprint] getClients failed:', err)
      }
    },

    getClientInfo() {
      try {
        if (this.socket) this.socket.emit('getClientInfo')
      } catch (err) {
        console.error('[hiprint] getClientInfo failed:', err)
      }
    },

    getPaperSizeInfo(printer) {
      try {
        console.warn('[hiprint] getPaperSizeInfo is experimental, win client only')
        if (this.socket) this.socket.emit('getPaperSizeInfo', printer)
      } catch (err) {
        console.error('[hiprint] getPaperSizeInfo failed:', err)
      }
    },
  }

  return sock
}

// ============ Singleton accessor ============

interface GlobalCache {
  [GLOBAL_KEY]?: HiWebSocket
}

/**
 * Get the global hiwebSocket instance (HMR-safe).
 *
 * Cached on globalThis under GLOBAL_KEY so HMR re-import yields the same
 * instance — matches V2 PM-005 fix.
 */
export function getHiWebSocket(deps?: CreateHiWebSocketDeps): HiWebSocket {
  const g = (typeof globalThis !== 'undefined' ? globalThis : window) as GlobalCache
  let inst = g[GLOBAL_KEY]
  if (!inst) {
    inst = createHiWebSocket(deps)
    g[GLOBAL_KEY] = inst
  }
  return inst
}

/**
 * Reset singleton (test-only).
 */
export function _resetHiWebSocketSingleton(): void {
  const g = (typeof globalThis !== 'undefined' ? globalThis : window) as GlobalCache
  delete g[GLOBAL_KEY]
}
