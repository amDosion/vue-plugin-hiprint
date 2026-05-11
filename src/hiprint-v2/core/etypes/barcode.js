/**
 * barcode.js — BarcodePrintElement (V2).
 *
 * V1 source: bundle.js line 10380-10448.
 */

import { BasePrintElement } from '../print-element-entity.js'
import { renderBarcode } from '../../renderers/barcode.js'

export class BarcodePrintElement extends BasePrintElement {
  createTarget(title, data) {
    const $target = window.$(
      '<div class="hiprint-printElement hiprint-printElement-barcode" style="position: absolute;">' +
        '<div class="hiprint-printElement-barcode-content" style="height:100%;width:100%;display:flex;flex-direction:column"></div>' +
        '</div>'
    )
    this.initBarcode($target, title, data)
    return $target
  }

  initBarcode($target, _title, text) {
    const $content = $target.find('.hiprint-printElement-barcode-content')
    const result = renderBarcode($content, text, this.options)
    // Apply auto-fit width to parent if renderer asked for it
    if (result && result.svgWidth && this.options) {
      this.options.width = result.svgWidth
    }
  }

  updateDesignViewFromOptions() {
    if (!this.designTarget) return
    this.initBarcode(this.designTarget, this.getTitle(), this.getData())
  }

  /**
   * V1 also exposed `getReizeableShowPoints()` (note: V1 typo preserved as alias).
   * @returns {string[]}
   */
  getReizeableShowPoints() {
    return ['s', 'w', 'e', 'se', 'r']
  }
}
