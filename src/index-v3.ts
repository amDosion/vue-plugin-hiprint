/**
 * src/index-v3.ts — V3 entry (modern, jQuery-free; see ADR-0011).
 *
 * Business consumers opt-in to V3 by:
 *   import { hiprint, PrintTemplate, buildToolbar, hiPrintPlugin } from 'vue-plugin-hiprint/v3'
 *
 * Or directly:
 *   import { PrintTemplate } from 'vue-plugin-hiprint/dist/vue-plugin-hiprint.v3.esm.js'
 *
 * V3 status (see getV3PhaseStatus()):
 *  - P14 done — V3 baseline (internal + schemas + Pinia stores)
 *  - P15 done — core data layer + jQuery-free print pipeline
 *  - P16 done — interactions (interact.js drag/resize + @floating-ui/vue menu)
 *  - P17 done — element Vue components (11 etype SFCs + ElementWrapper)
 *  - P18 done — designer Vue components (Toolbar / Canvas / Panel / Preview /
 *               ElementList / PropertyPanel / Designer)
 *  - P19 done — compat layer (this entry). Business consumers can drop-in
 *               without any code changes (V1 surface preserved).
 *  - P20 pending — V3 native composables (useHiprintCanvas / useHiprintTemplate /
 *                  useHiprintPrint / useHiprintSocket) for modern reactive API.
 *  - P21 pending — V1 + V2 + jQuery removal.
 *  - P22 pending — v2.0.0 release + business migration.
 *
 * No V1 bundle.js side-effects. No jQuery. Pure ES module.
 *
 * Side-effect on import (preserved from V1 ergonomics):
 *  - window.hiprint = facade (so legacy global access still works)
 *  - window.hiwebSocket = V3 socket singleton (usePrintService relies on this)
 *
 * @see docs/adr/0011-v3-modern-ui-architecture.md
 */

// ============ V1-compatible drop-in surface ============
//
// Importing from `./hiprint-v3/compat` triggers the window.hiprint /
// window.hiwebSocket bootstrap as a side-effect (one-time, idempotent).
export {
  hiprint,
  PrintTemplate,
  defaultElementTypeProvider,
  buildToolbar,
  buildDesigner,
  hiPrintPlugin,
} from './hiprint-v3/compat'

export type {
  PrintTemplateOptions,
  PrintInvocationMeta,
  HiprintFacade,
  HiprintInitOptions,
  HiprintInitResult,
  BuildToolbarOptions,
  ToolbarController,
  BuildDesignerOptions,
  DesignerController,
  HiPrintPlugin,
  HiPrintPluginOptions,
} from './hiprint-v3/compat'

// ============ V3 phase status helper ============
export { V3_VERSION, getV3PhaseStatus } from './hiprint-v3'
export type { V3PhaseStatus } from './hiprint-v3'

// ============ V3 schemas — for TypeScript consumers ============
//
// Persistable JSON shapes (Zod-validated supersets of V1/V2 templates).
// Business code that types its template payload imports from here:
//   import type { TemplateJson, PanelJson, ElementJson } from 'vue-plugin-hiprint/v3'
export type {
  TemplateJson,
  PanelJson,
  ElementJson,
} from './hiprint-v3/schemas'
export {
  templateSchema,
  panelSchema,
  elementSchema,
  parseTemplate,
  safeParseTemplate,
} from './hiprint-v3/schemas'
