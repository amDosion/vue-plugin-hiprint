/**
 * text.js — TextPrintElement (V2).
 *
 * V1 source: bundle.js line 9961-10020 (text element subclass).
 *
 * Invariants (V2 必须保留, see ADR-0010):
 *  - R3 B7: 默认 .text() 渲染 (XSS safe), formatter 路径仍可 .html() (by-design)
 *  - PM-002 R3: getData via resolveField (preserve 0/false/'')
 */

import { BasePrintElement } from '../print-element-entity.js'
import { coerceText, escapeHtml } from '@hiprint-v2/internal'

export class TextPrintElement extends BasePrintElement {
  /**
   * @param {object} printElementType
   * @param {object} options
   */
  constructor(printElementType, options) {
    super(printElementType, options)
  }

  /**
   * Compose text value (title-prefix + value) with formatter pass.
   *
   * @param {*} value  raw value (from getData)
   * @param {boolean} [hideTitle]
   * @returns {string}
   */
  getText(value, hideTitle) {
    const title = this.getTitle()
    const formatter = this.getFormatter()

    // If formatter provided, business owns the HTML output (by-design)
    if (typeof formatter === 'function') {
      const formatted = formatter(title, value, this.options, this._currentTemplateData)
      return formatted == null ? '' : String(formatted)
    }

    const valueStr = coerceText(value)
    if (hideTitle) return valueStr
    if (title == null || title === '') return valueStr
    return title + '：' + valueStr
  }

  /**
   * Create design-time DOM target.
   *
   * @param {string} _title  (unused here, getText composes the rendered string)
   * @param {*} data
   * @returns {jQuery}
   */
  createTarget(_title, data) {
    const $div = window.$(
      '<div class="hiprint-printElement hiprint-printElement-text" style="position: absolute;">' +
        '<div class="hiprint-printElement-text-content hiprint-printElement-content" style="height:100%;width:100%"></div>' +
        '</div>'
    )
    this.updateTargetText($div, this.getTitle(), data)
    return $div
  }

  /**
   * Update inner text content based on formatter / hideTitle / text.
   *
   * @param {jQuery} $target
   * @param {string} title
   * @param {*} value
   */
  updateTargetText($target, _title, value) {
    const $content = $target.find('.hiprint-printElement-text-content')
    const text = this.getText(value, this.options.hideTitle)
    const formatter = this.getFormatter()
    if (typeof formatter === 'function') {
      // by-design: formatter return is HTML (business-owned safety)
      $content.html(text)
    } else {
      // R3 B7: default text-safe
      $content.text(text)
    }
  }

  /**
   * Re-render on options change.
   */
  updateDesignViewFromOptions() {
    if (!this.designTarget) return
    const data = this.getData()
    this.updateTargetText(this.designTarget, this.getTitle(), data)
  }

  /**
   * Get HiPrintConfig section.
   */
  getConfigOptions() {
    // V1: HiPrintConfig.instance.text. V2 (P9b): wire via registry. For now {}.
    return {}
  }
}
