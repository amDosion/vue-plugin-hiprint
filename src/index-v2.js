/**
 * src/index-v2.js — V2 alpha entry (Strangler Fig P13).
 *
 * Business consumers opt-in to V2 by:
 *   import { PrintTemplate, buildToolbar } from 'vue-plugin-hiprint/v2'
 *
 * Or directly:
 *   import { PrintTemplate } from 'vue-plugin-hiprint/dist/vue-plugin-hiprint.v2.esm.js'
 *
 * V2 status (see getV2PhaseStatus()):
 *  - P0-P10 done (core + serialize + drag + render)
 *  - P11 adapter (V2 surface delegates to V1 for jQuery DOM)
 *  - P12 partial (socket native; entry wiring done here)
 *  - P13 alpha (this file)
 *  - P14 cleanup (after business validation)
 *
 * For business validation:
 *   1. Install v1.0.3+ tgz
 *   2. Swap import path from 'vue-plugin-hiprint' to 'vue-plugin-hiprint/v2'
 *   3. Run app, verify designer / print / save flows
 *   4. Report issues via GitHub Issue
 *
 * Note: V2 still requires V1 bundle.js side-effects (jQuery plugin registration,
 * P11 adapter mode). Loading order: v1 main entry → v2 entry.
 *
 * See: docs/adr/0010-hiprint-bundle-refactor-strangler-fig.md
 *      docs/hiprint-v2-refactor-plan.md
 */

// ============ V1 side-effects bootstrap ============
// V2 currently depends on V1 jQuery plugin registrations (hidraggable / hidroppable /
// hicontextmenu) + V1 PrintTemplate.design path (P11 adapter mode). Importing the
// V1 main entry triggers these side-effects before V2 takes over.
//
// Once P14 cleanup removes V1, this import is also removed.
import './index.js'

// ============ V2 public API ============
export * from './hiprint-v2/index.js'

// Re-export Vue plugin shim from V1 (no V2-native equivalent needed; Vue plugin
// just registers $hiPrint / $print / $print2 globals which are V1-style).
export { hiPrintPlugin, defaultElementTypeProvider } from './index.js'
