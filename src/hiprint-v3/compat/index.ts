/**
 * src/hiprint-v3/compat/index.ts — V1 compat barrel (drop-in replacement).
 *
 * This module exposes the V1 surface (`hiprint`, `PrintTemplate`,
 * `defaultElementTypeProvider`, `hiPrintPlugin`, `buildToolbar`,
 * `buildDesigner`) backed by the V3 implementation. Business consumers
 * (vue-admin-main) import these symbols and their existing code works
 * without modification.
 *
 * Side effects on import:
 *   - sets `window.hiwebSocket` to the V3 socket singleton (V1 quirk —
 *     business consumers' usePrintService.ts reads `window.hiwebSocket.opened`).
 *
 * Status: P19 — see ADR-0011 §"分阶段路线图".
 */

import { getHiWebSocket } from '@hiprint-v3/print'
import { hiprint } from './hiprint-global'

// Side-effect: window.hiwebSocket — matches V1 export shape.
if (typeof window !== 'undefined') {
  try {
    const w = window as unknown as Record<string, unknown>
    if (!w.hiwebSocket) {
      w.hiwebSocket = getHiWebSocket()
    }
    if (!w.hiprint) {
      w.hiprint = hiprint
    }
  } catch (err) {
    // window may be a Proxy in some test envs — log + continue.
    console.warn('[hiprint] compat: window.hiwebSocket bootstrap failed:', err)
  }
}

// ============ Re-exports ============

export { PrintTemplate } from './print-template'
export type { PrintTemplateOptions, PrintInvocationMeta } from './print-template'

export { hiprint, defaultElementTypeProvider } from './hiprint-global'
export type { HiprintFacade, HiprintInitOptions, HiprintInitResult } from './hiprint-global'

export { buildToolbar } from './build-toolbar'
export type { BuildToolbarOptions, ToolbarController } from './build-toolbar'

export { buildDesigner } from './build-designer'
export type { BuildDesignerOptions, DesignerController } from './build-designer'

export { hiPrintPlugin } from './vue-plugin'
export type { HiPrintPlugin, HiPrintPluginOptions } from './vue-plugin'
