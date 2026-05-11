/**
 * web-socket.js — hiwebSocket V2 (socket.io client wrapper for local print client).
 *
 * V1 source: bundle.js line 8395-8565 (window.hiwebSocket).
 *
 * V2 改进:
 *  - export `createHiWebSocket()` factory + getInstance() singleton (HMR-safe)
 *  - V1 是 window.hiwebSocket 全局单例, V2 也保留 (P12 装配时 window.hiwebSocket = getInstance())
 *
 * Invariants (V2 必须保留, see ADR-0010):
 *  - [security M4] default token 'vue-plugin-hiprint' 启动时 warn (业务方应 setHost 设强 token)
 *  - [silent R3] catch 块都带 [hiprint] 前缀 console.error + JSON.stringify err
 *  - [PM-005] reconnect 失败不静默 (业务方 hinnn.event.trigger("connect_error", e) 监听)
 */

import { sendByFragments as sendByFragmentsImpl } from './send-by-fragments.js'

const STATE_CONNECTED = 'connected'
const STATE_RECONNECTING = 'reconnecting'

const GLOBAL_KEY = '__HIPRINT_V2_HIWEBSOCKET_INSTANCE__'

/**
 * Create a new hiwebSocket instance.
 * Note: V1 has 1 global; V2 supports factory but typical usage is still singleton.
 *
 * @param {object} [deps]
 * @param {*} [deps.io]  socket.io-client constructor (window.io fallback)
 * @param {{ trigger: Function, on: Function, off: Function }} [deps.event]  event bus
 *   (V1 hinnn.event); for V2, pass an internal/event-bus.createEventBus() instance
 */
export function createHiWebSocket(deps) {
  const dep = deps || {}
  const io = dep.io || (typeof window !== 'undefined' ? window.io : null)
  const event = dep.event

  const sock = {
    opened: false,
    name: 'webSockets',
    host: 'http://localhost:17521',
    // [M4] default token; production must call setHost(host, token, cb) explicitly
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
     * Set host + token. V2 best-practice: call this BEFORE start() in production.
     * @param {string} host
     * @param {string|Function} token  if function: treated as cb (legacy V1 form)
     * @param {Function} [cb]
     */
    setHost(host, token, cb) {
      if (typeof token === 'function') {
        cb = token
        token = undefined
      }
      this.host = host
      if (token != null) this.token = token
      this.stop()
      this.start(cb)
    },

    /**
     * Send a single message via socket.emit('news', ...).
     */
    send(payload) {
      try {
        if (this.socket) this.socket.emit('news', payload)
      } catch (err) {
        console.error(
          '[hiprint] socket send data failed (' + (payload || '') + '):',
          err
        )
      }
    },

    /**
     * Send long HTML via batched fragments. See ./send-by-fragments.js.
     */
    sendByFragments(content) {
      sendByFragmentsImpl(this.socket, content, {
        getSocket: () => this.socket,
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

      const self = this
      this.socket = io(this.host, {
        transports: ['websocket'],
        reconnectionAttempts: 5,
        auth: { token: this.token },
      })

      this.socket.on('connect', function () {
        self.opened = true
        console.warn('[hiprint] Websocket opened.')
        self.state = STATE_CONNECTED
        if (event && typeof event.trigger === 'function') {
          event.trigger('connected', { host: self.host })
        }
        if (typeof cb === 'function') cb(true)
      })

      this.socket.on('connect_error', function (err) {
        self.opened = false
        console.error('[hiprint] socket connect_error:', err)
        if (event && typeof event.trigger === 'function') {
          event.trigger('connect_error', err)
        }
        if (typeof cb === 'function') cb(false, err)
      })

      this.socket.on('disconnect', function () {
        self.opened = false
        self.state = STATE_RECONNECTING
        if (event && typeof event.trigger === 'function') {
          event.trigger('disconnected', {})
        }
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

    /**
     * Get cached printer list (last received from server).
     */
    getPrinterList() {
      return this.printerList || []
    },

    /**
     * Request printer list refresh (emit + callback).
     */
    refreshPrinterList() {
      try {
        if (this.socket) this.socket.emit('refreshPrinterList')
      } catch (err) {
        console.error('[hiprint] refreshPrinterList failed:', err)
      }
    },

    /**
     * Send IPP print request.
     */
    ippPrint(options) {
      try {
        if (this.socket) this.socket.emit('ippPrint', options)
      } catch (err) {
        console.error('[hiprint] ippPrint failed:', err)
      }
    },

    /**
     * Generic IPP request (vendor-specific calls).
     */
    ippRequest(options) {
      try {
        if (this.socket) this.socket.emit('ippRequest', options)
      } catch (err) {
        console.error('[hiprint] ippRequest failed:', err)
      }
    },

    /**
     * Generic get-address. V1 supports rest-args.
     */
    getAddress(type, ...args) {
      try {
        if (this.socket) this.socket.emit('address', type, ...args)
      } catch (err) {
        console.error('[hiprint] getAddress failed:', err)
      }
    },

    /**
     * Get clients (printer machines on LAN).
     */
    getClients() {
      try {
        if (this.socket) this.socket.emit('getClients')
      } catch (err) {
        console.error('[hiprint] getClients failed:', err)
      }
    },

    /**
     * Get info for a specific client.
     */
    getClientInfo() {
      try {
        if (this.socket) this.socket.emit('getClientInfo')
      } catch (err) {
        console.error('[hiprint] getClientInfo failed:', err)
      }
    },

    /**
     * getPaperSizeInfo (experimental, Windows client only).
     */
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

/**
 * Get the global hiwebSocket instance (HMR-safe).
 */
export function getInstance(deps) {
  /* eslint-disable no-undef */
  const g = typeof globalThis !== 'undefined' ? globalThis : window
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = createHiWebSocket(deps)
  }
  return g[GLOBAL_KEY]
}

/**
 * Reset singleton (test-only).
 */
export function _resetInstance() {
  const g = typeof globalThis !== 'undefined' ? globalThis : window
  delete g[GLOBAL_KEY]
}
