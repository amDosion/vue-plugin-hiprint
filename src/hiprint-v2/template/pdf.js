/**
 * template/pdf.js — PrintTemplate.toPdf mixin.
 *
 * V1 source: bundle.js line 12776-12834 (toPdf + tempContainer helpers).
 *
 * Invariants (V2 必须保留):
 *  - PM-003 R3: assertNotDestroyed → reject Deferred (caller can chain .catch)
 *  - R3 silent #3 state-modeler R3: domtoimage .then 内必须再 check _destroyed,
 *    若已 destroy 则 cleanup + reject('template destroyed mid-toPdf')
 *  - R3 silent #3: domtoimage .catch 必须 reject (V1 之前 silent + tempContainer 泄漏)
 *  - tempContainer 一定要在 success / error 两路都 remove
 */

import { assertNotDestroyed, mm, pt } from '@hiprint-v2/internal'

export const pdfMixin = {
  /**
   * Render current template to PDF via jsPDF + dom-to-image.
   *
   * R3 silent #3 + state-modeler R3:
   *  - destroy mid-render → reject(new Error('template destroyed mid-toPdf'))
   *  - domtoimage throw → console.error + reject + tempContainer cleanup
   *
   * @param {object|Array<object>} data
   * @param {string} [filename]  defaults to 'template.pdf' if isDownload
   * @param {object} [options]  { scale, isDownload, type, ... } (forwarded to domtoimage)
   * @returns {Promise<*>|*}  jQuery Deferred promise resolving to undefined (save) or PDF blob
   */
  toPdf(data, filename, options) {
    if (assertNotDestroyed(this, 'toPdf')) {
      const $ = typeof window !== 'undefined' ? window.$ : null
      if ($ && $.Deferred) {
        return $.Deferred().reject(new Error('template destroyed')).promise()
      }
      return Promise.reject(new Error('template destroyed'))
    }
    const $ = typeof window !== 'undefined' ? window.$ : null
    if (!$ || !$.Deferred) {
      return Promise.reject(new Error('toPdf: jQuery / jQuery.Deferred unavailable'))
    }
    const jsPDF =
      typeof window !== 'undefined' && (window.jsPDF || (window.jspdf && window.jspdf.jsPDF))
    const domtoimage = typeof window !== 'undefined' ? window.domtoimage : null
    const self = this
    const dtd = $.Deferred()
    let isDownload = true

    if (!this.printPanels.length) {
      dtd.reject(new Error('toPdf: no panels'))
      return dtd.promise()
    }
    if (!jsPDF || !domtoimage) {
      // SSR / test env: still return a rejected deferred so caller can .catch
      dtd.reject(new Error('toPdf: jsPDF / domtoimage unavailable'))
      return dtd.promise()
    }

    const panel0 = this.printPanels[0]
    const r = mm.toPt(panel0.width)
    const a = mm.toPt(panel0.height)
    const p = Object.assign(
      { scale: 2, width: pt.toPx(r), x: 0, y: 0, useCORS: true },
      options || {}
    )
    const doc = new jsPDF({
      orientation: this.getOrient(0) === 1 ? 'portrait' : 'landscape',
      unit: 'pt',
      format: panel0.paperType ? String(panel0.paperType).toLowerCase() : [r, a],
    })
    const html = this.getHtml(data, options)

    if (options && options.isDownload !== undefined) isDownload = options.isDownload

    this._createTempContainer()
    const tempContainer = this._getTempContainer()
    if (typeof this.svg2canvas === 'function') {
      try {
        this.svg2canvas(html)
      } catch (err) {
        console.warn('[hiprint] toPdf: svg2canvas failed:', err)
      }
    }
    if (tempContainer && html && html[0]) {
      tempContainer.html(html[0])
    }
    const paperCount = tempContainer.find
      ? tempContainer.find('.hiprint-printPanel .hiprint-printPaper').length
      : 0

    if (html && html.css) html.css('position:fixed')

    domtoimage
      .toCanvas(html && html[0] ? html[0] : html, p)
      .then(function (canvas) {
        // [state-modeler R3] destroy 中断 — cleanup + reject
        if (self._destroyed) {
          self._removeTempContainer()
          dtd.reject(new Error('template destroyed mid-toPdf'))
          return
        }
        const ctx = canvas.getContext('2d')
        ctx.mozImageSmoothingEnabled = false
        ctx.webkitImageSmoothingEnabled = false
        ctx.msImageSmoothingEnabled = false
        ctx.imageSmoothingEnabled = false

        const o = canvas.toDataURL('image/jpeg')
        for (let i = 0; i < paperCount; i++) {
          doc.addImage(o, 'JPEG', 0, 0 - i * a, r, paperCount * a)
          if (i < paperCount - 1) doc.addPage()
        }
        if (isDownload) {
          self._removeTempContainer()
          const fn = filename || 'template.pdf'
          if (fn.indexOf('.pdf') > -1) doc.save(fn)
          else doc.save(fn + '.pdf')
          dtd.resolve()
        } else {
          self._removeTempContainer()
          const type = (options && options.type) || 'blob'
          const pdfFile = doc.output(type)
          dtd.resolve(pdfFile)
        }
      })
      .catch(function (err) {
        // [R3 silent #3] domtoimage 失败必须 reject + cleanup, 否则 caller hang + tempContainer 泄漏
        console.error('[hiprint] toPdf: domtoimage failed:', err)
        self._removeTempContainer()
        dtd.reject(err)
      })

    return dtd.promise()
  },

  /** @private */
  _createTempContainer() {
    const $ = typeof window !== 'undefined' ? window.$ : null
    if (!$) return
    this._removeTempContainer()
    $('body').prepend(
      $(
        '<div class="hiprint_temp_Container" style="overflow:hidden;height: 0px;box-sizing: border-box;"></div>'
      )
    )
  },

  /** @private */
  _removeTempContainer() {
    const $ = typeof window !== 'undefined' ? window.$ : null
    if (!$) return
    $('.hiprint_temp_Container').remove()
  },

  /** @private */
  _getTempContainer() {
    const $ = typeof window !== 'undefined' ? window.$ : null
    if (!$) return null
    return $('.hiprint_temp_Container')
  },
}
