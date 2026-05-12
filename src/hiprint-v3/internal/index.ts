/**
 * src/hiprint-v3/internal/index.ts — internal utilities barrel.
 *
 * Ported from src/hiprint-v2/internal/ to TypeScript with strict typing.
 * Files mirror V2 layout 1:1 to ease porting/diffing.
 *
 * All 27 R3 invariants preserved (see ADR-0011 §"锁住的不变式").
 */

export * from './lifecycle'
export * from './event-bus'
export * from './uom'
export * from './format'
export * from './group-by'
export * from './i18n'
export * from './constants'
export * from './dom-helpers'
export * from './compile-formatter'
// TKT-024: dataType + format pipeline (datetime / boolean conversion).
export * from './data-format'
// TKT-023: V1 Path A → bwip-js value mapping (text+textType compat layer).
export * from './path-a-mapping'
// TKT-364 (Sprint 22g GL): bwip-js extra-opts passthrough (16 fields).
export * from './bwipjs-opts'
// TKT-026: long-text binary-search pagination (V1 9757-9931 port).
export * from './long-text-paginate'
// TKT-021: V3 double-render-path convergence — shared pure table model.
export * from './render-table'
