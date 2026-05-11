/**
 * send-by-fragments.js — 分批发送 HTML 给本地打印 client.
 *
 * V1 source: bundle.js line 8418-8470.
 *
 * Why fragments: 长模板 HTML 字符串 (10000+ 字符) 直接 socket.emit 易丢包 /
 * 客户端解析慢. 拆成 ~50000 字符片段 + setInterval 间隔发, client 端拼回.
 *
 * Invariants (V2 必须保留, see ADR-0010):
 *  - [silent-failure R3] setTimeout 内 this.socket null 守卫 + try-catch
 *    (hiwebSocket.stop() 后已 schedule 的 setTimeout 仍会 fire → emit on null
 *    抛 TypeError; 必须 guard)
 *  - 每段独立 id (guid) 让 client 区分 retry vs new
 */

/**
 * Split content into fragments + emit on socket.
 *
 * @param {object} socket  socket.io client (with .emit())
 * @param {object} content  {html, fragmentSize?, sendInterval?, ...otherFields}
 * @param {{ getSocket?: () => object|null }} [opts]  socket may be invalidated mid-flight;
 *   pass getSocket() to re-read each tick. Defaults to closure over `socket`.
 */
export function sendByFragments(socket, content, opts) {
  try {
    const {
      fragmentSize = 50000,
      sendInterval = 10,
      html,
      generateHTMLInterval, // strip — internal, not for client
      printByFragments, // strip — internal
      ...otherFields
    } = content

    const contentToSplit = html
    if (!contentToSplit || !socket) return

    const getSocket = opts && opts.getSocket ? opts.getSocket : () => socket

    const charsCount = contentToSplit.length
    const fragmentsCount = Math.ceil(charsCount / fragmentSize)

    Array.apply(undefined, { length: fragmentsCount }).forEach((_, index) => {
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
    })
  } catch (err) {
    console.error('[hiprint] socket send fragment failed:', err)
  }
}
