/**
 * src/hiprint-v3/composables/index.ts — V3 native composables barrel.
 *
 * V3 reactive API replacement for the 4 composables vue-admin-main currently
 * keeps in its own codebase (`useHiprintRuntime`, `useHiprintDesigner`,
 * `usePrintService`, `useTemplateManager`).
 *
 * Migration target (vue-admin-main):
 *
 *   // BEFORE (vue-admin-main owned shim)
 *   import { useHiprintDesigner } from './composables/useHiprintDesigner'
 *
 *   // AFTER (vue-plugin-hiprint owns the composable)
 *   import { useHiprintDesigner } from 'vue-plugin-hiprint/v3'
 *
 * P20 (this) — composables added.
 * P21        — V1 + V2 cleanup, jQuery removal.
 * P22        — vue-admin-main migration + v2.0.0 release.
 */

export { useHiprintCanvas } from './useHiprintCanvas'
export type { UseHiprintCanvasReturn } from './useHiprintCanvas'

export {
  useHiprintTemplate,
  type TemplateJson,
  type Panel,
  type CanvasElement,
} from './useHiprintTemplate'
export type { UseHiprintTemplateReturn } from './useHiprintTemplate'

export { useHiprintPrint } from './useHiprintPrint'
export type { UseHiprintPrintReturn } from './useHiprintPrint'

export { useHiprintSocket } from './useHiprintSocket'
export type { UseHiprintSocketReturn } from './useHiprintSocket'

export { useHiprintDesigner } from './useHiprintDesigner'
export type {
  UseHiprintDesignerReturn,
  UseHiprintDesignerOptions,
} from './useHiprintDesigner'

export { useHiprintRuntime } from './useHiprintRuntime'
export type {
  UseHiprintRuntimeReturn,
  UseHiprintRuntimeOptions,
  RuntimeProviderInput,
} from './useHiprintRuntime'
