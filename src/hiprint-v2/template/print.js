/**
 * template/print.js — PrintTemplate browser-print + socket-print mixin.
 *
 * V1 source: bundle.js line 12651-12763.
 *
 * Invariants (V2 必须保留):
 *  - PM-003 R3: assertNotDestroyed → silent no-op
 *  - R3 silent #5: XHR onerror / ontimeout / non-200 status 都必须诊断 (V1
 *    曾经全部 silent → 印字静默丢失)
 *  - 客户端断开 alert i18n key
 *  - sentToClient 支持 printByFragments async fallback (R3 .catch console.error)
 */

import { assertNotDestroyed } from '@hiprint-v2/internal'

export const printMixin = {
  /**
   * Browser-side print via hiwprint plugin (V1 line 12651-12653).
   *
   * @param {object|Array<object>} data
   * @param {object} [opts]
   * @param {object} [printOpts]  passed to .hiwprint()
   */
  print(data, opts, printOpts) {
    if (assertNotDestroyed(this, 'print')) return
    const $ = typeof window !== 'undefined' ? window.$ : null
    if (!$) {
      console.warn('[hiprint] print: window.$ not available (SSR / test env)')
      return
    }
    const html = this.getHtml(data || {}, opts)
    if (html && typeof html.hiwprint === 'function') {
      html.hiwprint(printOpts)
    } else {
      console.warn('[hiprint] print: jQuery.fn.hiwprint plugin not loaded')
    }
  },

  /**
   * Socket-print via hiwebSocket (V1 line 12654-12690). Loads print-lock.css
   * via XHR fragments then sends bundle to client. R3 silent #5: every XHR
   * gets onerror/ontimeout/status diagnostics.
   *
   * @param {object|Array<object>} data
   * @param {object} [opts]
   */
  print2(data, opts) {
    if (assertNotDestroyed(this, 'print2')) return
    const $ = typeof window !== 'undefined' ? window.$ : null
    if (!$) {
      console.warn('[hiprint] print2: window.$ not available (SSR / test env)')
      return
    }
    data = data || {}
    opts = opts || {}
    if (!this._clientIsOpened()) {
      this._alertClientFailed()
      return
    }
    const self = this
    let collectedCount = 0
    const cssMap = {}
    const $links = $('link[media=print][href*="print-lock"]')
    let css = ''
    if (opts.styleHandler && typeof opts.styleHandler === 'function') {
      css += opts.styleHandler()
    }
    if ($links.length <= 0) {
      throw new Error(
        '请在 入口文件(index.html) 中引入 print-lock.css. 注意: link[media="print"]'
      )
    }
    $links.each(function (a, p) {
      const xhr = new XMLHttpRequest()
      const href = $(p).attr('href')
      xhr.onerror = function () {
        console.error('[hiprint] print2: CSS XHR failed for', href)
      }
      xhr.ontimeout = function () {
        console.error('[hiprint] print2: CSS XHR timeout for', href)
      }
      xhr.open('GET', href)
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return
        if (xhr.status === 200) {
          cssMap[a + ''] =
            '<style rel="stylesheet" type="text/css">' + xhr.responseText + '</style>'
          if (++collectedCount === $links.length) {
            let combined = ''
            for (let l = 0; l < $links.length; l++) combined += cssMap[l + '']
            if (css) combined = css + combined
            self._sentToClient(combined, data, opts)
          }
        } else if (xhr.status !== 0) {
          console.error('[hiprint] print2: CSS load got HTTP', xhr.status, 'for', href)
        }
      }
      xhr.send()
    })
  },

  /**
   * Browser print of arbitrary HTML (V1 line 12733-12735).
   *
   * @param {*} html  jQuery element or HTML string
   */
  printByHtml(html) {
    if (assertNotDestroyed(this, 'printByHtml')) return
    const $ = typeof window !== 'undefined' ? window.$ : null
    if (!$) return
    const wrapped = $(html)
    if (typeof wrapped.hiwprint === 'function') wrapped.hiwprint()
  },

  /**
   * Socket print of arbitrary HTML (V1 line 12736-12764). R3 silent #5: same
   * XHR diagnostic story as print2.
   *
   * @param {*} html
   * @param {object} [opts]
   */
  printByHtml2(html, opts) {
    if (assertNotDestroyed(this, 'printByHtml2')) return
    const $ = typeof window !== 'undefined' ? window.$ : null
    if (!$) return
    opts = opts || {}
    if (!this._clientIsOpened()) {
      this._alertClientFailed()
      return
    }
    const self = this
    let collectedCount = 0
    const cssMap = {}
    const $links = $('link[media=print][href*="print-lock"]')
    if ($links.length <= 0) {
      throw new Error(
        '请在 入口文件(index.html) 中引入 print-lock.css. 注意: link[media="print"]'
      )
    }
    $links.each(function (a, p) {
      const xhr = new XMLHttpRequest()
      const href = $(p).attr('href')
      xhr.onerror = function () {
        console.error('[hiprint] printByHtml2: CSS XHR failed for', href)
      }
      xhr.ontimeout = function () {
        console.error('[hiprint] printByHtml2: CSS XHR timeout for', href)
      }
      xhr.open('GET', href)
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return
        if (xhr.status === 200) {
          cssMap[a + ''] =
            '<style rel="stylesheet" type="text/css">' + xhr.responseText + '</style>'
          if (++collectedCount === $links.length) {
            let combined = ''
            for (let l = 0; l < $links.length; l++) combined += cssMap[l + '']
            const fullHtml = combined + $(html)[0].outerHTML
            const payload = Object.assign({}, opts, {
              id: self._guid(),
              html: fullHtml,
              templateId: self.id,
            })
            if (typeof window !== 'undefined' && window.hiwebSocket && window.hiwebSocket.send) {
              window.hiwebSocket.send(payload)
            }
          }
        } else if (xhr.status !== 0) {
          console.error('[hiprint] printByHtml2: CSS load got HTTP', xhr.status, 'for', href)
        }
      }
      xhr.send()
    })
  },

  /**
   * Internal: send rendered HTML + CSS bundle to client (V1 line 12711-12732).
   * Handles both sync and printByFragments async path. R3 silent #3: async
   * .catch surfaces destroy-mid-async errors.
   *
   * @private
   */
  _sentToClient(css, data, opts) {
    if (assertNotDestroyed(this, '_sentToClient')) return
    const $ = typeof window !== 'undefined' ? window.$ : null
    const self = this
    const payload = Object.assign({}, opts || {})
    if (payload.imgToBase64 === undefined) payload.imgToBase64 = false

    if (payload.printByFragments) {
      this.getHtmlAsync(data, payload)
        .then((rootElement) => {
          if (self._destroyed) return
          const fullHtml = css + (rootElement && rootElement[0] ? rootElement[0].outerHTML : '')
          payload.id = self._guid()
          payload.html = fullHtml
          payload.templateId = self.id
          if (
            typeof window !== 'undefined' &&
            window.hiwebSocket &&
            typeof window.hiwebSocket.sendByFragments === 'function'
          ) {
            window.hiwebSocket.sendByFragments(payload, opts)
          }
        })
        .catch((err) => {
          // R3 silent #3: getHtmlAsync reject 时印字静默丢失 → console.error
          console.error('[hiprint] sentToClient printByFragments failed:', err)
        })
    } else {
      const html = this.getHtml(data, payload)
      const outer = html && html[0] && html[0].outerHTML ? html[0].outerHTML : ''
      const fullHtml = css + outer
      payload.id = self._guid()
      payload.html = fullHtml
      payload.templateId = self.id
      if (
        typeof window !== 'undefined' &&
        window.hiwebSocket &&
        typeof window.hiwebSocket.send === 'function'
      ) {
        window.hiwebSocket.send(payload)
      }
    }
  },

  /** @private */
  _clientIsOpened() {
    return !!(
      typeof window !== 'undefined' &&
      window.hiwebSocket &&
      window.hiwebSocket.opened
    )
  },

  /** @private */
  _alertClientFailed() {
    const msg =
      typeof window !== 'undefined' && window.i18n && typeof window.i18n.__ === 'function'
        ? window.i18n.__('连接客户端失败')
        : '连接客户端失败'
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(msg)
    }
  },

  /** @private */
  _guid() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
  },

  /**
   * Check if hiwebSocket client is currently connected.
   * @returns {boolean}
   */
  clientIsOpened() {
    if (assertNotDestroyed(this, 'clientIsOpened')) return false
    return this._clientIsOpened()
  },

  /**
   * Get list of available printers from connected client.
   * @returns {Array<object>}
   */
  getPrinterList() {
    if (assertNotDestroyed(this, 'getPrinterList')) return []
    if (
      typeof window !== 'undefined' &&
      window.hiwebSocket &&
      typeof window.hiwebSocket.getPrinterList === 'function'
    ) {
      const list = window.hiwebSocket.getPrinterList()
      return list || []
    }
    return []
  },
}
