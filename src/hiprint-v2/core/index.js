/**
 * core/index.js — Barrel export for V2 core types.
 *
 * P5 covers registry + group (data layer).
 * P6-P11 will add: etypes/ + panel.js + print-element-entity.js + manager (UI builder).
 */

export {
  PrintElementTypeRegistry,
  getInstance,
  _resetInstance,
  formatterModule,
} from './registry.js'

export { PrintElementTypeGroup } from './group.js'
