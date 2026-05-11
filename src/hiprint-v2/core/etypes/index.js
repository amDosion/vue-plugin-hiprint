/**
 * etypes/index.js — Barrel export for element-type subclasses (V2).
 *
 * Subclasses extend BasePrintElement (P9) and override createTarget /
 * getData / updateDesignViewFromOptions.
 *
 * P6 covers: text / longText / image / html / barcode / qrcode + 4 shape lines.
 * P7 covers: table (TablePrintElement + sub-modules).
 */

export { TextPrintElement } from './text.js'
export { LongTextPrintElement } from './long-text.js'
export { ImagePrintElement } from './image.js'
export { HtmlPrintElement } from './html.js'
export { BarcodePrintElement } from './barcode.js'
export { QRCodePrintElement } from './qrcode.js'
export {
  HLinePrintElement,
  VLinePrintElement,
  RectPrintElement,
  OvalPrintElement,
} from './shape-lines.js'
export { TablePrintElement } from './table/index.js'

import { TextPrintElement } from './text.js'
import { LongTextPrintElement } from './long-text.js'
import { ImagePrintElement } from './image.js'
import { HtmlPrintElement } from './html.js'
import { BarcodePrintElement } from './barcode.js'
import { QRCodePrintElement } from './qrcode.js'
import {
  HLinePrintElement,
  VLinePrintElement,
  RectPrintElement,
  OvalPrintElement,
} from './shape-lines.js'
import { TablePrintElement } from './table/index.js'

/**
 * Factory: instantiate the correct subclass for a given type string.
 * V1 equivalent: W.createPrintElement(t) at line 10523.
 *
 * Note: P7 will register 'table' → TablePrintElement.
 *
 * @param {object} printElementType  { type: 'text' | 'image' | ... }
 * @param {object} [options]
 * @returns {BasePrintElement}
 */
export function createPrintElementByType(printElementType, options) {
  const type = printElementType && printElementType.type
  switch (type) {
    case 'text':
      return new TextPrintElement(printElementType, options)
    case 'longText':
      return new LongTextPrintElement(printElementType, options)
    case 'image':
      return new ImagePrintElement(printElementType, options)
    case 'html':
      return new HtmlPrintElement(printElementType, options)
    case 'barcode':
      return new BarcodePrintElement(printElementType, options)
    case 'qrcode':
      return new QRCodePrintElement(printElementType, options)
    case 'hline':
      return new HLinePrintElement(printElementType, options)
    case 'vline':
      return new VLinePrintElement(printElementType, options)
    case 'rect':
      return new RectPrintElement(printElementType, options)
    case 'oval':
      return new OvalPrintElement(printElementType, options)
    case 'table':
      return new TablePrintElement(printElementType, options)
    default:
      throw new Error('[hiprint] unsupported element type: ' + type)
  }
}
