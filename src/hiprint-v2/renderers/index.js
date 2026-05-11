/**
 * renderers/index.js — Barrel export for content renderers.
 */
export {
  createImageTarget,
  updateImageTarget,
  loadImage,
  imageToBase64Async,
  createImageFailFallback,
} from './image.js'
export { createHtmlTarget, updateHtmlTarget } from './html.js'
export { buildBarcodeOptions, renderBarcode } from './barcode.js'
export { buildQrcodeOptions, renderQrcode } from './qrcode.js'
export {
  buildLongTextIndent,
  updateLongTextTarget,
  composeLongTextDisplay,
} from './long-text.js'
