/**
 * hiprint-v2/index.js — V2 entry (Strangler Fig bridge).
 *
 * Current status (P5 done, P6-P11 pending):
 *  - V2-native modules re-exported here directly
 *  - V2-not-yet-done modules (BasePrintElement / etypes / panel / template / toolbar /
 *    designer) still imported from V1 bundle.js via the v1 entry. They will be
 *    swapped progressively as P6-P11 complete.
 *
 * Business consumer migration path:
 *   import * from 'vue-plugin-hiprint'          // v1 (default, via src/index.js)
 *   import * from 'vue-plugin-hiprint/v2'       // V2 alpha (P13 will wire this)
 *
 * Until P12 装配 is complete, V2 内部模块只导出 helpers, 业务方主入口仍走 v1.
 */

// =========== P2: internal/ ===========
export {
  // lifecycle
  assertNotDestroyed,
  safeCall,
  evalCap,
  // event-bus
  createEventBus,
  // uom
  pt,
  px,
  mm,
  // format
  dateFormat,
  numFormat,
  // group-by
  groupBy,
  orderBy,
  // dom-helpers
  escapeHtml,
  coerceText,
  safeNumber,
  resolveField,
  // constants
  SUPPORTED_ELEMENT_TYPES,
  DEFAULT_PAPER_TYPES,
  SCALE_MIN_DEFAULT,
  SCALE_MAX_DEFAULT,
  SCALE_STEP_DEFAULT,
  FORMATTER_MAX_LEN,
  // i18n
  i18n,
} from './internal/index.js'

// =========== P4: renderers/ ===========
export {
  createImageTarget,
  updateImageTarget,
  loadImage,
  imageToBase64Async,
  createImageFailFallback,
  createHtmlTarget,
  updateHtmlTarget,
  buildBarcodeOptions,
  renderBarcode,
  buildQrcodeOptions,
  renderQrcode,
  buildLongTextIndent,
  updateLongTextTarget,
  composeLongTextDisplay,
} from './renderers/index.js'

// =========== P5: core (registry + group) ===========
export {
  PrintElementTypeRegistry,
  PrintElementTypeGroup,
  formatterModule,
  // singleton accessor (HMR-safe via globalThis cache)
  getInstance as getRegistry,
} from './core/index.js'

// =========== P9: BasePrintElement (skeleton, P9b TODO for drag/design) ===========
export { BasePrintElement } from './core/print-element-entity.js'

// =========== P6: 10 element-type subclasses + factory ===========
export {
  TextPrintElement,
  LongTextPrintElement,
  ImagePrintElement,
  HtmlPrintElement,
  BarcodePrintElement,
  QRCodePrintElement,
  HLinePrintElement,
  VLinePrintElement,
  RectPrintElement,
  OvalPrintElement,
  createPrintElementByType,
} from './core/etypes/index.js'

// =========== P7: table element ===========
export {
  TablePrintElement,
  TableExcelHelper,
  TableCell,
  TableHeaderCell,
  TableColumnEntity,
  TextInlineEditor,
  SelectInlineEditor,
  TableColumnInlineEditor,
  createEditor,
  createSelect,
  applyRowsColumnsMerge,
  resolveRowsColumnsMerge,
  createTableHead,
  createTableRow,
  createTableFooter,
  createRowTarget,
  createEmptyRowTarget,
  resizeTableCellWidth,
  reconsitutionTableColumnTree,
  getColumnsWidth,
  getOrderdColumns,
} from './core/etypes/table/index.js'

// =========== P8: PrintPanel (skeleton + serialize) ===========
export { PrintPanel } from './core/panel.js'

// =========== P10: PrintTemplate (V2 main entry class, skeleton) ===========
export {
  PrintTemplate,
  getTemplateById,
} from './template/index.js'

// =========== P12 (partial): socket ===========
export {
  createHiWebSocket,
  sendByFragments,
  getInstance as getHiWebSocket,
} from './socket/index.js'

// =========== P11: UI factories (adapter mode — delegates to V1 bundle) ===========
// P11 adapter mode: V2 surface declarations delegate to V1 `window.hiprint` for the
// heavy jQuery DOM construction (buildToolbar ~1550 lines, buildDesigner ~300 lines,
// createElementListPanel ~260 lines). Adapters add R3 invariant guards at the
// V1 boundary (safeCall on opts.onXxx, namespace verification, destroy idempotency).
// Full V2-native rewrite deferred to P14 (after V1 deletion) and depends on
// P7/P8b/P9b/P10b completion.
export {
  buildToolbar,
  buildDesigner,
  createElementListPanel,
  refreshElementList,
  destroyElementListPanel,
  createPropertyPanel,
  bindPropertyPanel,
  _generateToolbarUid,
  _generateDesignerUid,
} from './ui/index.js'

// =========== P6-P11: pending — re-export from V1 bundle ===========
// Until P6-P11 are migrated, the following symbols still come from the
// V1 bundle (src/hiprint/hiprint.bundle.js) via the legacy entry.
//
// Re-exporting them here so that V2 consumers (P13 alpha tgz) can write:
//   import { PrintTemplate, buildToolbar } from 'vue-plugin-hiprint/v2'
// and get a unified V2 namespace.
//
// See docs/hiprint-v2-refactor-plan.md for phase progression.

// Note: dynamic re-export from V1 is gated behind P12 actual wiring;
// for now V2 consumers should still use the v1 entry (src/index.js).
// This file serves as the V2 surface declaration and the P12 wiring point.

/**
 * Phase status snapshot.
 * @returns {object}
 */
export function getV2PhaseStatus() {
  return {
    P0_worktree: 'done',
    P1_e2e_baseline: 'done', // 92 e2e cases on main, cherry-picked to refactor/hiprint-v2
    P2_internal: 'done',
    P3_vendor: 'stub', // jQuery plugins still loaded via V1 bundle.js side-effects
    P4_renderers: 'done',
    P5_core_registry: 'done',
    P6_etypes: 'done', // 10 subclasses + factory
    P7_table: 'done', // cell + excel-helper + inline-editor + row-merge + print-element
    P8_panel: 'skeleton', // data layer + serialize; design/drag/shortcuts TODO P8b
    P9_base_print_element: 'extended', // P9b done: drag/copy/keyboard/clone/selectFromList/inRect/multiSelect
    P10_template: 'extended', // P10b done: design/getHtml/print/print2/printByHtml*/toPdf/update/undo/redo/zoom/setPaper
    P11_ui_toolbar_designer: 'adapter', // V2 surface declared, delegates to V1 bundle internally
    P12_socket: 'partial', // socket done; full entry wiring pending P6-P11
    P13_switch: 'pending',
    P14_cleanup: 'pending',
  }
}
