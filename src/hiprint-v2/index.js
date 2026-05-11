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

// =========== P12 (partial): socket ===========
export {
  createHiWebSocket,
  sendByFragments,
  getInstance as getHiWebSocket,
} from './socket/index.js'

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
    P6_etypes: 'pending',
    P7_table: 'pending',
    P8_panel: 'pending',
    P9_base_print_element: 'pending', // CRITICAL — 70+ V1 references, P9 is gating
    P10_template: 'pending',
    P11_ui_toolbar_designer: 'pending',
    P12_socket: 'partial', // socket done; full entry wiring pending P6-P11
    P13_switch: 'pending',
    P14_cleanup: 'pending',
  }
}
