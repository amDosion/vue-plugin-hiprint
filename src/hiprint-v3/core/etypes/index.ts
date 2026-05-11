/**
 * etypes/index.ts — V3 element-type data factories barrel.
 *
 * Each factory returns a BaseElement (pure-data reactive record). Renderer
 * lives in P15.2; Vue components in P17. NO DOM construction here.
 *
 * V2 referenced (with DOM): src/hiprint-v2/core/etypes/index.js.
 */

export {
  createTextElement,
  getTextDisplay,
  TEXT_DEFAULT_OPTIONS,
  TEXT_DEFAULT_TYPE_DEF,
  type CreateTextElementInit,
} from './text'
export {
  createImageElement,
  resolveImageSrc,
  IMAGE_DEFAULT_OPTIONS,
  IMAGE_DEFAULT_TYPE_DEF,
  type CreateImageElementInit,
} from './image'
export {
  createLongTextElement,
  composeLongTextDisplay,
  LONG_TEXT_DEFAULT_OPTIONS,
  LONG_TEXT_DEFAULT_TYPE_DEF,
  type CreateLongTextElementInit,
} from './long-text'
export {
  createBarcodeElement,
  BARCODE_DEFAULT_OPTIONS,
  BARCODE_DEFAULT_TYPE_DEF,
  type CreateBarcodeElementInit,
} from './barcode'
export {
  createQrcodeElement,
  QRCODE_DEFAULT_OPTIONS,
  QRCODE_DEFAULT_TYPE_DEF,
  type CreateQrcodeElementInit,
} from './qrcode'
export {
  createHtmlElement,
  HTML_DEFAULT_OPTIONS,
  HTML_DEFAULT_TYPE_DEF,
  type CreateHtmlElementInit,
} from './html'
export {
  createHLineElement,
  createVLineElement,
  createRectElement,
  createOvalElement,
  HLINE_DEFAULT_OPTIONS,
  HLINE_DEFAULT_TYPE_DEF,
  VLINE_DEFAULT_OPTIONS,
  VLINE_DEFAULT_TYPE_DEF,
  RECT_DEFAULT_OPTIONS,
  RECT_DEFAULT_TYPE_DEF,
  OVAL_DEFAULT_OPTIONS,
  OVAL_DEFAULT_TYPE_DEF,
  type CreateShapeElementInit,
} from './shape-lines'
export {
  createTableElement,
  normalizeTableColumn,
  normalizeTableColumns,
  TABLE_DEFAULT_OPTIONS,
  TABLE_DEFAULT_TYPE_DEF,
  type CreateTableElementInit,
  type TableColumnEntity,
  type TableHeaderColumnEntity,
  type TableColumnsLayout,
} from './table'

import { createTextElement } from './text'
import { createImageElement } from './image'
import { createLongTextElement } from './long-text'
import { createBarcodeElement } from './barcode'
import { createQrcodeElement } from './qrcode'
import { createHtmlElement } from './html'
import {
  createHLineElement,
  createVLineElement,
  createRectElement,
  createOvalElement,
} from './shape-lines'
import { createTableElement } from './table'
import type { BaseElement, ElementTypeRef } from '../element-base'

/**
 * Factory dispatcher: build a BaseElement by element type.
 *
 * V2 equivalent: src/hiprint-v2/core/etypes/index.js createPrintElementByType
 * (but returns a BaseElement, not a jQuery-coupled subclass).
 */
export function createElementByType(
  printElementType: ElementTypeRef,
  options?: Record<string, unknown>
): BaseElement {
  const type = printElementType && printElementType.type
  const init = { printElementType, options: options ?? {} }
  switch (type) {
    case 'text':
      return createTextElement(init)
    case 'image':
      return createImageElement(init)
    case 'longText':
      return createLongTextElement(init)
    case 'barcode':
      return createBarcodeElement(init)
    case 'qrcode':
      return createQrcodeElement(init)
    case 'html':
      return createHtmlElement(init)
    case 'hline':
      return createHLineElement(init)
    case 'vline':
      return createVLineElement(init)
    case 'rect':
      return createRectElement(init)
    case 'oval':
      return createOvalElement(init)
    case 'table':
      return createTableElement(init)
    default:
      throw new Error('[hiprint] unsupported element type: ' + type)
  }
}
