/**
 * qrcode.js — QR Code SVG rendering via bwip-js.
 *
 * V1 source: bundle.js line 10471-10506 (initQrcode).
 *
 * V2 split:
 *  - buildQrcodeOptions(opts) — pure: maps hiprint options → bwip-js qrcode input
 *  - renderQrcode($container, text, options) — DOM
 *
 * Invariants (V2 必须保留):
 *  - [R3 C3] title text 用 .text() 转义 (V1 之前用模板字符串拼接 .html() — XSS)
 *  - Square preservation: width === height = min(width, height)
 *  - Error correction level: ['M', 'L', 'H', 'Q'][qrCodeLevel ?? 0]
 */

import bwipjs from 'bwip-js'
import { pt } from '@hiprint-v2/internal'
import { i18n } from '@hiprint-v2/internal'

/**
 * Build bwip-js qrcode options.
 *
 * @param {object} options
 * @returns {{ width: number, height: number, paddingwidth: number, paddingheight: number, bwipOpts: object }}
 */
export function buildQrcodeOptions(options, text) {
  const width = pt.toPx(options.width)
  const lineH = options.lineHeight ?? (options.fontSize ?? 10.5) * 1.5
  const titleH = !options.hideTitle ? lineH : 0
  const height = pt.toPx(options.height - titleH)
  const paddingwidth = width >= height ? Math.abs(parseInt((width - height) / 2)) : 0
  const paddingheight = width >= height ? 0 : Math.abs(parseInt((height - width) / 2))
  const square = Math.min(parseInt(width / 2.835), parseInt(height / 2.835))
  const ecLevel = ['M', 'L', 'H', 'Q'][options.qrCodeLevel ?? 0]
  return {
    width,
    height,
    paddingwidth,
    paddingheight,
    bwipOpts: {
      bcid: options.qrcodeType || 'qrcode',
      text: text || options.testData || options.title || '',
      scale: 1,
      paddingwidth,
      paddingheight,
      width: square,
      height: square,
      includetext: false,
      eclevel: ecLevel,
      barcolor: options.barColor || '#000',
    },
  }
}

/**
 * Render qrcode + (optional) title into target container.
 *
 * @param {jQuery} $container  .hiprint-printElement-qrcode-content
 * @param {string} text
 * @param {object} options
 * @param {string} [title]  display below qrcode if !options.hideTitle
 */
export function renderQrcode($container, text, options, title) {
  try {
    const { bwipOpts } = buildQrcodeOptions(options, text)
    const svgStr = bwipjs.toSVG(bwipOpts)
    $container.empty().append(window.$(svgStr))

    if (!options.hideTitle) {
      const textAlign = options.textAlign || 'center'
      const fontSize = options.fontSize ? options.fontSize + 'pt' : '9pt'
      const align =
        textAlign === 'justify'
          ? 'text-align-last: justify;text-justify: distribute-all-lines;'
          : 'text-align: ' + textAlign + ';'
      const style = align + 'font-size:' + fontSize + ';line-height:1.5;'
      // [XSS R3 C3] title 是 user-controlled (options.title / 业务方传入), 必须 .text()
      $container.append(
        window
          .$('<div class="hiprint-printElement-qrcode-content-title"></div>')
          .attr('style', style)
          .text(title == null ? '' : String(title))
      )
    }
  } catch (err) {
    console.error('[hiprint] qrcode render failed:', err)
    $container
      .empty()
      .append(
        window
          .$('<div></div>')
          .text(i18n.__('二维码生成失败') || 'QRCode render failed')
      )
  }
}
