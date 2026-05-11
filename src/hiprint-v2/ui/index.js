/**
 * ui/index.js — Barrel for V2 UI factories.
 *
 * P11 status: adapter-mode. V2 surface declarations delegate to V1 bundle for
 * the heavy DOM construction (~1850 lines combined). Full V2-native rewrite is
 * deferred to P14 (after V1 deletion) and requires:
 *  - P7 done (table)
 *  - P8b done (panel.design / drag)
 *  - P9b done (BasePrintElement drag/keyboard)
 *  - P10b done (PrintTemplate.design + getHtml + print + pdf)
 *
 * Until then, P11 adapters add the V2 invariant guards (safeCall on onXxx,
 * namespace verification, destroy idempotency) at the V1 boundary so V2
 * consumers get the right behavior contract.
 */

export { buildToolbar, _generateToolbarUid } from './toolbar.js'
export { buildDesigner, _generateDesignerUid } from './designer.js'
export {
  createElementListPanel,
  refreshElementList,
  destroyElementListPanel,
} from './element-list-panel.js'
export { createPropertyPanel, bindPropertyPanel } from './property-panel.js'
