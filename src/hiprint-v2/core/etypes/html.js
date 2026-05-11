/**
 * html.js — HtmlPrintElement (V2).
 *
 * V1 source: bundle.js line 10108-10148.
 *
 * ⚠️ by-design: html element 类型的语义就是渲染业务方提供的 HTML 字符串.
 * 业务方在 formatter 内必须自行 escape user data. See ADR-0010.
 */

import { BasePrintElement } from '../print-element-entity.js'
import { createHtmlTarget, updateHtmlTarget } from '../../renderers/html.js'

export class HtmlPrintElement extends BasePrintElement {
  createTarget(_title, data) {
    const $target = createHtmlTarget()
    this.updateContent($target, data)
    return $target
  }

  updateContent($target, _data) {
    const formatter = this.getFormatter()
    if (typeof formatter === 'function') {
      // by-design: formatter return is the HTML
      const html = formatter(this.getData(), this.options, this._currentTemplateData)
      const $content = $target.find('.hiprint-printElement-html-content')
      updateHtmlTarget($content, html)
    }
  }

  updateDesignViewFromOptions() {
    if (!this.designTarget) return
    this.updateContent(this.designTarget, this.getData())
  }
}
