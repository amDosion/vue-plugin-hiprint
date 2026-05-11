/**
 * barcode.js — Barcode SVG rendering via bwip-js.
 *
 * V1 source: bundle.js line 10405-10437 (initBarcode).
 *
 * V2 split:
 *  - buildBarcodeOptions(opts, computedHeight) — pure: maps hiprint options → bwip-js input
 *  - renderBarcode($container, text, options) — DOM: generates SVG + appends
 *
 * Invariants (V2 必须保留):
 *  - [R3 B7] never `.html(userData)` — bwip-js returns SVG string, append via jQuery.
 *  - [silent #2] try/catch around eval + per-call fallback i18n "条形码生成失败"
 *  - bwip-js auto-width: when options.barAutoWidth + svg width exceeds container, fit parent width
 */

import bwipjs from 'bwip-js'
import { pt, px } from '@hiprint-v2/internal'
import { i18n } from '@hiprint-v2/internal'

/**
 * Compute bwip-js input options from hiprint barcode options.
 *
 * @param {object} options  hiprint barcode element options
 * @param {number} options.height  element height in pt
 * @param {boolean} [options.hideTitle]
 * @param {number} [options.lineHeight]
 * @param {number} [options.fontSize]
 * @param {string} [options.barcodeType='code128']
 * @param {number} [options.barWidth=1]
 * @param {number} [options.width]
 * @param {boolean} [options.barAutoWidth]
 * @param {string} [options.barColor='#000']
 * @param {string} [text]  fallback if options.testData / options.title also empty
 * @returns {object}  bwip-js options
 */
export function buildBarcodeOptions(options, text) {
  const lineH = options.lineHeight ?? (options.fontSize ?? 10.5) * 1.5
  const titleH = !options.hideTitle ? lineH : 0
  const heightMm = pt.toMm(options.height - titleH)
  return {
    bcid: options.barcodeType || 'code128',
    text: text || options.testData || options.title || '',
    scale: options.barWidth || 1,
    width: !options.barAutoWidth ? parseInt(pt.toMm(options.width)) : '',
    height: parseInt(heightMm),
    includetext: !options.hideTitle,
    textsize: options.fontSize ? parseInt(options.fontSize) : 10,
    barcolor: options.barColor || '#000',
  }
}

/**
 * Render barcode into target container. Handles auto-width + error fallback.
 *
 * @param {jQuery} $container  .hiprint-printElement-barcode-content
 * @param {string} text
 * @param {object} options
 * @returns {{ svgWidth: number|null }}  computed svg width if auto-fit applied
 */
export function renderBarcode($container, text, options) {
  try {
    const bwipOpts = buildBarcodeOptions(options, text)
    let svgStr = bwipjs.toSVG(bwipOpts)
    const $svg = window.$(svgStr).attr('preserveAspectRatio', 'none slice')
    const viewBox = $svg[0].attributes.viewBox.value.split(' ')
    let svgWidthPt = Math.ceil(px.toPt(parseFloat(viewBox[2]) * 1.05))

    let appliedWidth = null
    if (options.barAutoWidth && svgWidthPt > options.width) {
      $container.parent().css('width', svgWidthPt + 'pt')
      $svg.css('height', '100%')
      appliedWidth = svgWidthPt
    }

    $container.empty().append($svg)
    return { svgWidth: appliedWidth }
  } catch (err) {
    console.error('[hiprint] barcode render failed:', err)
    $container
      .empty()
      .append(
        window
          .$('<div></div>')
          .text(i18n.__('条形码生成失败') || 'Barcode render failed')
      )
    return { svgWidth: null }
  }
}
