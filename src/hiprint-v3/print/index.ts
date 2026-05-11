/**
 * src/hiprint-v3/print/index.ts — print pipeline barrel.
 *
 * Print pipeline modules (to be filled in across P15.2/P15.3/P15.4/P15.5):
 *  - send-by-fragments — batch HTML over socket (P15.5)
 *  - socket            — hiwebSocket + singleton (P15.5)
 *  - render            — native DOM template rendering (P15.2)
 *  - pdf               — jspdf 2.5+ wrapper (P15.3)
 *  - browser-print     — window.print() pipeline (P15.4)
 */

export * from './send-by-fragments'
export * from './socket'
export * from './render'
export * from './pdf'
export * from './browser-print'
