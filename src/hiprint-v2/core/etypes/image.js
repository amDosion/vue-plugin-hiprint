/**
 * image.js — ImagePrintElement (V2).
 *
 * V1 source: bundle.js line 9220-9265.
 *
 * Invariants:
 *  - R3 B1: src 通过 .attr() 设置 (renderers/image.js), 不字符串拼接
 *  - R3 silent #8: loadImage 内 onerror 必先于 src bind
 */

import { BasePrintElement } from '../print-element-entity.js'
import {
  createImageTarget,
  updateImageTarget,
} from '../../renderers/image.js'
import { resolveField } from '@hiprint-v2/internal'

export class ImagePrintElement extends BasePrintElement {
  /**
   * V1 image getData has different fallback chain: testData → options.src → printElementType.getData()
   *
   * @param {object} [templateData]
   * @returns {string}  src URL or data: URI
   */
  getData(templateData) {
    const field = this.getField()
    if (templateData) {
      const v = field ? resolveField(templateData, field, '') : ''
      // For image element, empty value falls back to options.src (default image)
      return v || this.options.src || (typeof this.printElementType.getData === 'function'
        ? this.printElementType.getData()
        : '')
    }
    return (
      this.options.src ||
      (typeof this.printElementType.getData === 'function'
        ? this.printElementType.getData()
        : '')
    )
  }

  createTarget(_title, data) {
    const $target = window.$(
      '<div class="hiprint-printElement hiprint-printElement-image" style="position: absolute;">' +
        '<div class="hiprint-printElement-image-content" style="height:100%;width:100%"></div>' +
        '</div>'
    )
    this.updateTargetImage($target, _title, data)
    return $target
  }

  updateTargetImage($target, _title, src) {
    const $content = $target.find('.hiprint-printElement-image-content')
    const $img = updateImageTarget($content, src, {
      fit: this.options.fit,
      borderRadius: this.options.borderRadius,
    })
    return $img
  }

  updateDesignViewFromOptions() {
    if (!this.designTarget) return
    this.updateTargetImage(this.designTarget, this.getTitle(), this.getData())
  }
}
