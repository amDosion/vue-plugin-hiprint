/**
 * src/hiprint-v3/index.ts — V3 main barrel entry.
 *
 * V3 is a complete rewrite removing jQuery, built on Vue 3 + TypeScript +
 * Pinia + Zod + interact.js. See ADR-0011 for architecture rationale.
 *
 * Status: P14 (basebuild + Pinia stores) — in progress
 *
 * Phase status (see also getV3PhaseStatus()):
 *   P14: V3 baseline + TS strict + Pinia stores + Zod schemas + internal/ migration (.ts)
 *   P15: Print pipeline + data layer (jQuery-free)
 *   P16: Interaction system (interact.js + custom multi-select)
 *   P17: Element Vue components (11 etypes)
 *   P18: Designer Vue components (HiprintDesigner / Toolbar / Canvas / PropertyPanel)
 *   P19: Compat layer (drop-in for vue-admin-main)
 *   P20: V3 native composables published
 *   P21: V1 + V2 cleanup + jQuery removal
 *   P22: Business consumer migration + v2.0.0 release
 *
 * @see docs/adr/0011-v3-modern-ui-architecture.md
 */

export const V3_VERSION = '0.1.0-alpha.0' as const

export type V3PhaseStatus = {
  phase: 'P14' | 'P15' | 'P16' | 'P17' | 'P18' | 'P19' | 'P20' | 'P21' | 'P22'
  description: string
  done: boolean
}

export function getV3PhaseStatus(): readonly V3PhaseStatus[] {
  return Object.freeze([
    { phase: 'P14', description: 'V3 baseline + TS + Pinia stores + Zod schemas + internal/', done: false },
    { phase: 'P15', description: 'Print pipeline + data layer (jQuery-free)', done: false },
    { phase: 'P16', description: 'Interaction system (interact.js)', done: false },
    { phase: 'P17', description: 'Element Vue components (11 etypes)', done: false },
    { phase: 'P18', description: 'Designer Vue components', done: false },
    { phase: 'P19', description: 'Compat layer (drop-in)', done: false },
    { phase: 'P20', description: 'V3 native composables', done: false },
    { phase: 'P21', description: 'V1 + V2 cleanup', done: false },
    { phase: 'P22', description: 'Business migration + v2.0.0 release', done: false },
  ])
}
