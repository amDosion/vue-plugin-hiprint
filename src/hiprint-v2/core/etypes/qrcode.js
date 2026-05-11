/**
 * qrcode.js — QRCodePrintElement (V2).
 *
 * V1 source: bundle.js line 10449-10515.
 */

import { BasePrintElement } from '../print-element-entity.js'
import { renderQrcode } from '../../renderers/qrcode.js'

export class QRCodePrintElement extends BasePrintElement {
  createTarget(title, data) {
    const $target = window.$(
      '<div class="hiprint-printElement hiprint-printElement-qrcode" style="position: absolute;">' +
        '<div class="hiprint-printElement-qrcode-content" style="height:100%;width:100%;display:flex;flex-direction:column"></div>' +
        '</div>'
    )
    this.initQrcode($target, title, data)
    return $target
  }

  initQrcode($target, title, text) {
    const $content = $target.find('.hiprint-printElement-qrcode-content')
    renderQrcode($content, text, this.options, title)
  }

  updateDesignViewFromOptions() {
    if (!this.designTarget) return
    this.initQrcode(this.designTarget, this.getTitle(), this.getData())
  }

  getReizeableShowPoints() {
    return ['s', 'w', 'e', 'se', 'r']
  }
}
