/**
 * socket/index.js — Barrel export for hiwebSocket + fragment sender.
 */
export { createHiWebSocket, getInstance, _resetInstance } from './web-socket.js'
export { sendByFragments } from './send-by-fragments.js'
