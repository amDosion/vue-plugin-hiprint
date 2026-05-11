/**
 * template/get-html.js — PrintTemplate render-to-HTML mixin.
 *
 * V1 source: bundle.js line 12401-12472.
 *
 * Invariants (V2 必须保留):
 *  - PM-003 R3: assertNotDestroyed → safe fallback ($('<div></div>') or Promise.resolve)
 *  - R3 silent #3: getSimpleHtmlAsync setTimeout 内必须检查 _destroyed → reject('aborted')
 *  - 不允许 setTimeout 闭包内访问 stale panel.printElements DOM 而崩溃
 */

import { assertNotDestroyed } from '@hiprint-v2/internal'

/**
 * Empty fallback element. happy-dom / SSR safe (returns plain object proxy).
 *
 * @private
 */
function _emptyHtml() {
  const $ = typeof window !== 'undefined' ? window.$ : null
  if ($) return $('<div class="hiprint-printTemplate"></div>')
  return { length: 0, find: () => ({ length: 0 }), append: () => {}, _emptyFallback: true }
}

export const getHtmlMixin = {
  /**
   * Build print-time HTML. Sync version. Accepts single data object or array of data.
   *
   * @param {object|Array<object>} data
   * @param {object} [opts]
   * @returns {*}  jQuery wrapped <div class="hiprint-printTemplate">
   */
  getSimpleHtml(data, opts) {
    if (assertNotDestroyed(this, 'getSimpleHtml')) return _emptyHtml()
    const $ = typeof window !== 'undefined' ? window.$ : null
    if (!$) return _emptyHtml()
    opts = opts || {}
    const root = $('<div class="hiprint-printTemplate"></div>')
    const self = this

    if (data && Array.isArray(data)) {
      data.forEach(function (item, dataIndex) {
        if (!item) return
        self.printPanels.forEach(function (panel, o) {
          if (typeof panel.getHtml === 'function') {
            root.append(panel.getHtml(item, opts))
          }
          if (
            dataIndex === data.length - 1 &&
            o === self.printPanels.length - 1 &&
            typeof window !== 'undefined' &&
            window.hinnn
          ) {
            delete window.hinnn._paperList
          }
        })
      })
    } else {
      this.printPanels.forEach(function (panel, panelIndex) {
        if (typeof panel.getHtml === 'function') {
          root.append(panel.getHtml(data, opts))
        }
        if (
          panelIndex === self.printPanels.length - 1 &&
          typeof window !== 'undefined' &&
          window.hinnn
        ) {
          delete window.hinnn._paperList
        }
      })
    }

    if (opts.imgToBase64 && typeof this.transformImg === 'function') {
      this.transformImg(root.find('img'))
    }
    return root
  },

  /**
   * Async batched render. Yields between panels with setTimeout to keep socket
   * keepalive responsive during large prints.
   *
   * R3 silent #3: each setTimeout callback re-checks `_destroyed` → reject so
   * caller can distinguish "success" vs "destroyed mid-print".
   *
   * @param {object|Array<object>} dataItemOrList
   * @param {object} [opts]
   * @returns {Promise<*>}
   */
  getSimpleHtmlAsync(dataItemOrList, opts) {
    if (assertNotDestroyed(this, 'getSimpleHtmlAsync')) {
      return Promise.resolve(_emptyHtml())
    }
    const $ = typeof window !== 'undefined' ? window.$ : null
    if (!$) return Promise.resolve(_emptyHtml())
    const self = this
    opts = opts || {}

    return new Promise(function (resolve, reject) {
      const rootElement = $('<div class="hiprint-printTemplate"></div>')
      const dataList = Array.isArray(dataItemOrList) ? dataItemOrList : [dataItemOrList]
      const paramsListToCreateHTML = []
      dataList.forEach(function (item) {
        if (!item) return
        self.printPanels.forEach(function (panel) {
          paramsListToCreateHTML.push([panel, item, opts])
        })
      })

      function appendElementByParamsList(list, onFinish) {
        // R3 silent #3: destroy 中断 → reject (let caller know vs silent stall)
        if (self._destroyed) {
          console.warn('[hiprint] getHtmlAsync aborted: template destroyed mid-async')
          return reject(new Error('aborted: template destroyed mid-async'))
        }
        if (!list.length) return onFinish()
        const [panel, item, e] = list.shift()
        try {
          if (typeof panel.getHtml === 'function') {
            rootElement.append(panel.getHtml(item, e))
          }
        } catch (err) {
          // surface render error, do not silently stall
          console.error('[hiprint] getHtmlAsync panel render error:', err)
          return reject(err)
        }
        const interval = e && typeof e.generateHTMLInterval === 'number' ? e.generateHTMLInterval : 10
        setTimeout(() => appendElementByParamsList(list, onFinish), interval)
      }

      function onFinish() {
        if (self._destroyed) {
          return reject(new Error('aborted: template destroyed mid-async'))
        }
        if (typeof window !== 'undefined' && window.hinnn) delete window.hinnn._paperList
        if (opts.imgToBase64 && typeof self.transformImg === 'function') {
          self.transformImg(rootElement.find('img'))
        }
        resolve(rootElement)
      }

      appendElementByParamsList(paramsListToCreateHTML, onFinish)
    })
  },

  /**
   * Alias for getSimpleHtml (V1 line 12460-12462). Both expose the same shape.
   *
   * @param {object} [data]
   * @param {object} [opts]
   */
  getHtml(data, opts) {
    if (assertNotDestroyed(this, 'getHtml')) return _emptyHtml()
    return this.getSimpleHtml(data || {}, opts)
  },

  /**
   * Async alias (V1 line 12463-12466).
   *
   * @param {object|Array<object>} data
   * @param {object} [opts]
   * @returns {Promise<*>}
   */
  getHtmlAsync(data, opts) {
    if (assertNotDestroyed(this, 'getHtmlAsync')) return Promise.resolve(_emptyHtml())
    return this.getSimpleHtmlAsync(data || {}, opts)
  },
}
