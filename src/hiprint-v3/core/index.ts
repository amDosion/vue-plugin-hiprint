/**
 * src/hiprint-v3/core/index.ts — V3 core data-layer barrel.
 *
 * Exports the pure-data registry, group, BaseElement abstraction, all etype
 * factories, and the default element-type provider. NO DOM, NO jQuery,
 * NO Vue component imports.
 *
 * See P15.1 in docs/adr/0011-v3-modern-ui-architecture.md.
 */

export {
  PrintElementTypeRegistry,
  formatterModule,
  getInstance,
  _resetInstance,
} from './registry'

export {
  PrintElementTypeGroup,
  type PrintElementTypeGroupOptions,
  type ElementTypeDef,
  type ElementTypeGroupDef,
} from './group'

export {
  createBaseElement,
  fromRecord,
  type BaseElement,
  type ElementRecord,
  type ElementTypeRef,
  _snapshot,
} from './element-base'

export * from './etypes'

export {
  buildDefaultElementTypeGroups,
  defaultElementTypeProvider,
  registerDefaultElementTypes,
  DEFAULT_MODULE_NAME,
  type DefaultElementTypeProviderApi,
} from './default-provider'
