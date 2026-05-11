/**
 * useHiprintSocket.ts — V3 reactive socket composable.
 *
 * Thin facade over `useSocketStore` (Pinia) for connecting to the local
 * electron-hiprint client. Returns plain refs + functions so callers do
 * not need to know about Pinia.
 *
 * V2 / V1 equivalent surface:
 *   window.hiwebSocket.setHost(host, token)  → connect(host, token)
 *   window.hiwebSocket.stop()                → disconnect()
 *   window.hiwebSocket.printerList           → clients
 *
 * Async connect:
 *   The underlying socket.io connect is event-driven, but vue-admin-main's
 *   existing `usePrintService` awaits a connection result. We expose a
 *   Promise<void> that resolves on the first `connect` event or rejects on
 *   `connect_error`. Internally we watch the store flags rather than
 *   re-subscribing to the raw socket (loose coupling).
 *
 * No jQuery. No direct socket.io usage from caller.
 */

import { storeToRefs } from 'pinia'
import { computed, watch, type ComputedRef } from 'vue'
import { useSocketStore, type ClientInfo } from '@hiprint-v3/stores'

// ============ Public types ============

export interface UseHiprintSocketReturn {
  /** True after `connect` event (and false after `disconnect`). */
  isConnected: ComputedRef<boolean>
  /** True while connect() is in-flight. */
  isConnecting: ComputedRef<boolean>
  /** Most recently fetched printer / client list (reactive). */
  clients: ComputedRef<readonly ClientInfo[]>
  /** Most recent connection error message, or null. */
  lastError: ComputedRef<string | null>

  /**
   * Connect to the socket.io server. Resolves on first 'connect' event,
   * rejects on 'connect_error' (or timeout). Idempotent: if already
   * connected to the same URL, resolves immediately.
   */
  connect(host: string, token?: string): Promise<void>
  /** Close + clear singleton. Safe to call repeatedly. */
  disconnect(): void
  /**
   * Ask the server for an updated client list. The store auto-applies the
   * incoming `clients` event; this function emits the request only when a
   * V1-style explicit request is needed.
   */
  refreshClients(): void
}

// ============ Implementation ============

const CONNECT_TIMEOUT_MS = 10_000

export function useHiprintSocket(): UseHiprintSocketReturn {
  const store = useSocketStore()
  const { connected, connecting, lastError } = storeToRefs(store)

  // Cast clients to readonly view (store uses Ref<ClientInfo[]>, but caller
  // shouldn't mutate). computed wraps for the readonly contract.
  const clientsRO: ComputedRef<readonly ClientInfo[]> = computed(() => store.clients)

  // Mirror connected/connecting as ComputedRef (storeToRefs gives writable Ref).
  // Wrapping in computed yields a stable ComputedRef<boolean> for the public type.
  const isConnected = computed<boolean>(() => connected.value)
  const isConnecting = computed<boolean>(() => connecting.value)
  const lastErrorRO = computed<string | null>(() => lastError.value)

  async function connect(host: string, token?: string): Promise<void> {
    // Fast-path: already connected to this host.
    if (store.connected && store.host === host) {
      return
    }
    store.connect(host, token)
    return waitForConnectOrError(store, CONNECT_TIMEOUT_MS)
  }

  function disconnect(): void {
    store.disconnect()
  }

  function refreshClients(): void {
    // V1 protocol: emit 'refreshPrinterList'. We surface this even though
    // the store auto-updates on push events — some servers require a poll.
    if (!store.connected) {
      console.warn('[hiprint] refreshClients ignored: socket not connected')
      return
    }
    store.send({ type: 'refreshPrinterList' })
  }

  return {
    isConnected,
    isConnecting,
    clients: clientsRO,
    lastError: lastErrorRO,
    connect,
    disconnect,
    refreshClients,
  }
}

// ============ Helpers ============

/**
 * Wait for store.connected to flip true (resolve) or lastError to be set
 * (reject), or timeoutMs to elapse (reject). Watch-based — keeps the socket
 * implementation detail out of this composable.
 */
function waitForConnectOrError(
  store: ReturnType<typeof useSocketStore>,
  timeoutMs: number
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false
    let stopWatch: (() => void) | null = null
    let timer: ReturnType<typeof setTimeout> | null = null

    function settle(err?: Error): void {
      if (settled) return
      settled = true
      if (stopWatch) stopWatch()
      if (timer) clearTimeout(timer)
      if (err) reject(err)
      else resolve()
    }

    stopWatch = watch(
      [() => store.connected, () => store.lastError, () => store.connecting],
      ([conn, errMsg, isConnecting]) => {
        if (conn) {
          settle()
          return
        }
        if (errMsg && !isConnecting) {
          settle(new Error(String(errMsg)))
        }
      },
      { immediate: true }
    )

    timer = setTimeout(() => {
      settle(new Error('[hiprint] socket connect timed out after ' + timeoutMs + 'ms'))
    }, timeoutMs)
  })
}
