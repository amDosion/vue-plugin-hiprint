/**
 * long-text.js — LongTextPrintElement (V2).
 *
 * V1 source: bundle.js line 9705-9870.
 *
 * Long-text 元素支持多行 + 自动分页 (BinarySearch 算法, P10 内 template/ 时一起做).
 * P6 阶段提供基础 createTarget + updateTarget; BinarySearch 推迟到 P10.
 *
 * Invariants:
 *  - R3 B4: 默认 .text() (XSS safe), formatter 路径 .html()
 *  - PM-002 R3: getData via resolveField (preserve 0/false/'')
 */

import { BasePrintElement } from '../print-element-entity.js'
import {
  buildLongTextIndent,
  composeLongTextDisplay,
  updateLongTextTarget,
} from '../../renderers/long-text.js'

export class LongTextPrintElement extends BasePrintElement {
  /**
   * Compose text for rendering: title + ':' + value (preserve 0/false/'').
   *
   * @param {*} value
   * @returns {string}
   */
  getText(value) {
    return composeLongTextDisplay(this.getTitle(), value, {
      hideTitle:
        typeof this.options.getHideTitle === 'function'
          ? this.options.getHideTitle()
          : this.options.hideTitle,
    })
  }

  createTarget(_title, data) {
    const $target = window.$(
      '<div class="hiprint-printElement hiprint-printElement-longText" style="position:absolute;">' +
        '<div class="hiprint-printElement-longText-content hiprint-printElement-content" style="height:100%;width:100%"></div>' +
        '</div>'
    )
    this.updateTargetText($target, _title, data)
    return $target
  }

  updateTargetText($target, _title, value) {
    const $content = $target.find('.hiprint-printElement-longText-content')
    const text = this.getText(value)
    const hasFormatter = typeof this.getFormatter() === 'function'

    // First-line indent (R3 C1 safe via buildLongTextIndent)
    $content.empty()
    const $indent = buildLongTextIndent(this.options.longTextIndent)
    $content.append($indent)

    // Append text content
    if (hasFormatter) {
      // by-design: formatter returns HTML
      $content.append(window.$('<span>').html(text))
    } else {
      // R3 B4: default text-safe
      $content.append(window.$('<span>').text(text))
    }
  }

  updateDesignViewFromOptions() {
    if (!this.designTarget) return
    const data = this.getData()
    this.updateTargetText(this.designTarget, this.getTitle(), data)
  }
}
