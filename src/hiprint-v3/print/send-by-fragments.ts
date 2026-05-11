/**
 * send-by-fragments.ts — Batch-send long HTML to local print client.
 *
 * V1 source: bundle.js line 8418-8470.
 * V2 reference: src/hiprint-v2/socket/send-by-fragments.js
 *
 * Why fragments: long template HTML strings (10000+ chars) sent directly via
 * socket.emit() risk packet loss / slow client-side parse. Split into ~50000
 * char fragments + interval-spaced emit; client reassembles.
 *
 * Invariants (V3 必须保留, see ADR-0011 #8):
 *  - [silent-failure R3] setTimeout 内 socket null guard + try-catch
 *    (hiwebSocket.stop() 后已 schedule 的 setTimeout 仍会 fire; emit on null
 *    会抛 TypeError, 必须 guard).
 *  - protocol byte-compatible with electron-hiprint: `socket.emit('printByFragments', { index, total, htmlFragment, ...otherFields })`.
 */

/**
 * Minimal socket shape we depend on. Matches the socket.io-client `Socket`
 * surface used by V2 — we keep the surface narrow so unit tests can mock
 * trivially.
 */
export interface FragmentSocket {
  emit(event: string, payload: unknown): unknown
}

export interface FragmentContent {
  html?: string
  fragmentSize?: number
  sendInterval?: number
  generateHTMLInterval?: unknown
  printByFragments?: unknown
  [key: string]: unknown
}

export interface SendByFragmentsOpts {
  /**
   * Socket may be invalidated mid-flight (hiwebSocket.stop() after scheduling).
   * Pass `getSocket()` to re-read each tick. Defaults to closure over `socket`.
   */
  getSocket?: () => FragmentSocket | null | undefined
}

/**
 * Split content into fragments + emit them on a socket with interval spacing.
 *
 * Drops fragments silently (with console.warn) when the socket has been closed
 * between scheduling and dispatch — this is intentional (R3) so the caller
 * does not see a crash from late timers.
 */
export function sendByFragments(
  socket: FragmentSocket | null | undefined,
  content: FragmentContent,
  opts?: SendByFragmentsOpts
): void {
  try {
    const {
      fragmentSize = 50000,
      sendInterval = 10,
      html,
      // strip internal-only fields — not forwarded to client
      generateHTMLInterval: _generateHTMLInterval,
      printByFragments: _printByFragments,
      ...otherFields
    } = content

    void _generateHTMLInterval
    void _printByFragments

    const contentToSplit = html
    if (!contentToSplit || !socket) return

    const getSocket = opts?.getSocket ?? ((): FragmentSocket | null => socket)

    const charsCount = contentToSplit.length
    const fragmentsCount = Math.ceil(charsCount / fragmentSize)

    for (let index = 0; index < fragmentsCount; index++) {
      const startIndex = index * fragmentSize
      const endIndex =
        index + 1 === fragmentsCount ? charsCount : (index + 1) * fragmentSize

      setTimeout(() => {
        const live = getSocket()
        if (!live) {
          console.warn(
            '[hiprint] sendByFragments: socket closed, dropping fragment ' +
              index +
              '/' +
              fragmentsCount
          )
          return
        }
        try {
          live.emit('printByFragments', {
            ...otherFields,
            index,
            total: fragmentsCount,
            htmlFragment: contentToSplit.slice(startIndex, endIndex),
          })
        } catch (err) {
          console.error(
            '[hiprint] sendByFragments: emit failed for fragment ' + index + ':',
            err
          )
        }
      }, sendInterval * index)
    }
  } catch (err) {
    console.error('[hiprint] socket send fragment failed:', err)
  }
}
