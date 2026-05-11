/**
 * src/hiprint-v3/stores/index.ts — Pinia stores barrel.
 *
 * Stores are the V3 source of truth for designer state. Composables
 * (src/hiprint-v3/composables/) and components (src/hiprint-v3/components/)
 * consume these stores reactively.
 *
 * HMR safety: each store uses Pinia's built-in HMR support. Singletons
 * (e.g. socket) use globalThis cache for HMR re-import safety.
 */

export { useCanvasStore } from './canvas'
export { useHistoryStore } from './history'
export { useTemplateStore } from './template'
export { useSocketStore } from './socket'
