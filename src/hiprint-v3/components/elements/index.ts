/**
 * src/hiprint-v3/components/elements/index.ts — V3 element components barrel.
 *
 * Exports the 11 etype Vue 3 components used by the designer canvas.
 * Phase split:
 *   - P17.0: ElementWrapper (shared root for all etypes).
 *   - P17.1: Basic etypes (text / image / longText / barcode / qrcode / html).
 *   - P17.2: Shape etypes (hline / vline / rect / oval).
 *   - P17.3: Table etypes (TableElement / TableCell / TableInlineEditor) —
 *            owned by a parallel agent, exported from ./table/ subdirectory.
 *
 * Helpers (computeBaseStyle, getElementValue, etc.) are re-exported from
 * `./_helpers` for component-level consumers that want to compose their own
 * specialised etypes.
 */

// ---- P17.0: shared wrapper + helpers ----
export { default as ElementWrapper } from './ElementWrapper.vue'
export * from './_helpers'

// ---- P17.1: basic etypes ----
export { default as TextElement } from './TextElement.vue'
export { default as ImageElement } from './ImageElement.vue'
export { default as LongTextElement } from './LongTextElement.vue'
export { default as BarcodeElement } from './BarcodeElement.vue'
export { default as QrcodeElement } from './QrcodeElement.vue'
export { default as HtmlElement } from './HtmlElement.vue'

// ---- P17.2: shape etypes ----
export { default as HlineElement } from './HlineElement.vue'
export { default as VlineElement } from './VlineElement.vue'
export { default as RectElement } from './RectElement.vue'
export { default as OvalElement } from './OvalElement.vue'

// ---- P17.3: table etypes ----
export { default as TableElement } from './table/TableElement.vue'
export { default as TableCell } from './table/TableCell.vue'
export { default as TableInlineEditor } from './table/TableInlineEditor.vue'
