/**
 * internal/index.js — Barrel export for internal helpers.
 *
 * V2 模块通过 `import { ... } from '@hiprint-v2/internal'` 引用. P12 装配时
 * 会把这些 helper 也挂到 window.hinnn 兼容层 (业务方直接读 hinnn 的代码不挂).
 */

export { assertNotDestroyed, safeCall, evalCap } from './lifecycle.js'
export { createEventBus } from './event-bus.js'
export { pt, px, mm, _resetDpiCache } from './uom.js'
export { dateFormat, numFormat } from './format.js'
export { groupBy, orderBy } from './group-by.js'
export {
  escapeHtml,
  coerceText,
  safeNumber,
  resolveField,
} from './dom-helpers.js'
export {
  SUPPORTED_ELEMENT_TYPES,
  DEFAULT_PAPER_TYPES,
  SCALE_MIN_DEFAULT,
  SCALE_MAX_DEFAULT,
  SCALE_STEP_DEFAULT,
  FORMATTER_MAX_LEN,
} from './constants.js'
export { i18n } from './i18n.js'
