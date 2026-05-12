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
