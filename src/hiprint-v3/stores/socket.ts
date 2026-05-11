/**
 * stores/socket.ts — useSocketStore: socket.io connection state.
 *
 * Wraps socket.io-client into a reactive Pinia store. Replaces V1's global
 * `window.hiwebSocket` (P19 compat layer will mirror state back to that
 * global for legacy consumers).
 *
 * V2 reference:
 *  - src/hiprint-v2/socket/web-socket.js — createHiWebSocket() factory
 *  - src/hiprint-v2/socket/send-by-fragments.js — batched fragment send
 *
 * Invariants preserved (see ADR-0010 + ADR-0011):
 *  - [security M4] default token 'vue-plugin-hiprint' warns at connect()
 *  - [silent R3]   catch blocks log with [hiprint] prefix
 *  - [PM-005]      HMR-safe singleton on globalThis to prevent multi-instance
 *                  socket leaks across HMR re-imports
 *
 * The singleton socket lives on globalThis so HMR re-imports of this module
 * still share one socket.io connection. Without this, every dev reload would
 * leak a new socket and break server-side client list tracking (resurfaces
 * the PM-005 multi-instance issue).
 */

import { defineStore, acceptHMRUpdate } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { io, type Socket } from 'socket.io-client'

// ============ Types ============

/** Subset of socket.io client info returned by 'getClients' emit (V1 contract). */
export interface ClientInfo {
  id?: string
  name?: string
  ip?: string
  // V1 servers add arbitrary fields; preserve via index signature.
  [key: string]: unknown
}

/** Generic payload sent via socket.emit('news', payload) (V1 send() contract). */
export type SocketPayload = Record<string, unknown> | string

// ============ HMR-safe singleton cache ============
//
// Symbol key avoids name collision with V2's __HIPRINT_V2_HIWEBSOCKET_INSTANCE__.

const GLOBAL_SOCKET_KEY = '__hiprintV3SocketSingleton'

interface SocketSingleton {
  socket: Socket | null
  url: string | null
}

interface GlobalWithSingleton {
  [GLOBAL_SOCKET_KEY]?: SocketSingleton
}

function getGlobalRoot(): GlobalWithSingleton {
  return globalThis as unknown as GlobalWithSingleton
}

function getSingleton(): SocketSingleton {
  const root = getGlobalRoot()
  if (!root[GLOBAL_SOCKET_KEY]) {
    root[GLOBAL_SOCKET_KEY] = { socket: null, url: null }
  }
  return root[GLOBAL_SOCKET_KEY]
}

const DEFAULT_TOKEN = 'vue-plugin-hiprint'
const DEFAULT_HOST = 'http://localhost:17521'

// ============ Store ============

export const useSocketStore = defineStore('hiprint-v3-socket', () => {
  // -------- State --------

  const connected = ref<boolean>(false)
  const connecting = ref<boolean>(false)
  const clients = ref<ClientInfo[]>([])
  const lastError = ref<string | null>(null)
  const token = ref<string>(DEFAULT_TOKEN)
  const host = ref<string>(DEFAULT_HOST)

  /**
   * Socket instance is shallowRef + parallel singleton cache. shallowRef
   * because Socket is a class instance with circular refs — Vue's deep
   * reactivity would blow up traversing it.
   */
  const socketRef = shallowRef<Socket | null>(null)

  // -------- Getters --------

  const hasClients = computed<boolean>(() => clients.value.length > 0)
  const clientCount = computed<number>(() => clients.value.length)

  // -------- Actions --------

  /**
   * Connect to socket.io server. Idempotent across HMR thanks to globalThis
   * singleton cache.
   *
   * @param url    server URL (defaults to V1's localhost:17521 electron-hiprint)
   * @param tok    auth token; warns if left at DEFAULT_TOKEN in production
   */
  function connect(url: string = DEFAULT_HOST, tok: string = DEFAULT_TOKEN): void {
    const singleton = getSingleton()

    // If we already have a live socket to the same URL, reuse it (HMR path).
    if (singleton.socket && singleton.url === url && singleton.socket.connected) {
      socketRef.value = singleton.socket
      connected.value = true
      connecting.value = false
      return
    }

    // Different URL or stale socket → tear down before reconnecting.
    if (singleton.socket) {
      try {
        singleton.socket.close()
      } catch (err) {
        console.error('[hiprint] socket close before reconnect failed:', err)
      }
      singleton.socket = null
      singleton.url = null
    }

    host.value = url
    token.value = tok

    // [M4] default-token warning (mirrors V2 web-socket.js line 103-108)
    if (tok === DEFAULT_TOKEN) {
      console.warn(
        '[hiprint] socket connecting with default token "vue-plugin-hiprint"; ' +
          'production should pass a strong unique token to useSocketStore.connect(url, token)'
      )
    }

    connecting.value = true
    lastError.value = null

    try {
      const sock = io(url, {
        transports: ['websocket'],
        reconnectionAttempts: 5,
        auth: { token: tok },
      })

      sock.on('connect', () => {
        connected.value = true
        connecting.value = false
        lastError.value = null
        console.warn('[hiprint] V3 socket opened.')
      })

      sock.on('connect_error', (err: Error) => {
        connected.value = false
        connecting.value = false
        lastError.value = err?.message ?? String(err)
        console.error('[hiprint] socket connect_error:', err)
      })

      sock.on('disconnect', () => {
        connected.value = false
        connecting.value = false
      })

      // V1 server emits 'clients' updates for printer/client list.
      sock.on('clients', (list: ClientInfo[]) => {
        onClientUpdate(Array.isArray(list) ? list : [])
      })

      singleton.socket = sock
      singleton.url = url
      socketRef.value = sock
    } catch (err) {
      connecting.value = false
      lastError.value = err instanceof Error ? err.message : String(err)
      console.error('[hiprint] socket connect threw:', err)
    }
  }

  /**
   * Disconnect + clear singleton. Composables call this on app unmount;
   * P19 compat layer also wires this to window.hiwebSocket.stop().
   */
  function disconnect(): void {
    const singleton = getSingleton()
    if (singleton.socket) {
      try {
        singleton.socket.close()
      } catch (err) {
        console.error('[hiprint] socket close failed:', err)
      }
    }
    singleton.socket = null
    singleton.url = null
    socketRef.value = null
    connected.value = false
    connecting.value = false
    clients.value = []
  }

  /**
   * Send a payload via socket.emit('news', payload). Matches V1 contract
   * (see hiwebSocket.send in V2 web-socket.js line 73-82). Silently no-ops
   * if disconnected — caller should gate via `connected` getter.
   */
  function send(payload: SocketPayload): void {
    const sock = socketRef.value
    if (!sock || !sock.connected) {
      console.warn('[hiprint] send ignored: socket not connected')
      return
    }
    try {
      sock.emit('news', payload)
    } catch (err) {
      console.error('[hiprint] socket send failed:', err)
    }
  }

  /**
   * Replace the cached client list. Called from the internal 'clients' event
   * listener; also exposed so test code / business consumers can stub it.
   */
  function onClientUpdate(list: ClientInfo[]): void {
    clients.value = list.slice()
  }

  return {
    // state
    connected,
    connecting,
    clients,
    lastError,
    token,
    host,
    // getters
    hasClients,
    clientCount,
    // actions
    connect,
    disconnect,
    send,
    onClientUpdate,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSocketStore, import.meta.hot))
}
