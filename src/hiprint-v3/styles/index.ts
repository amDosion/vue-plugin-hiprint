/**
 * src/hiprint-v3/styles/index.ts — V3 design-token entry (TKT-251 / TKT-252).
 *
 * Side-effect imports of the global CSS variable layer + V1 theme override.
 * `tokens.css` defines defaults (Ant Design palette); `theme-v1.css` is a
 * scoped override applied when the host opts in via `<HiprintDesigner theme="v1" />`
 * (writes `data-hiprint-theme="v1"` + `hiprint-theme-v1` on the root).
 *
 * Importing this module installs both stylesheets. Hosts that prefer to bundle
 * tokens.css separately can do so via `import '@hiprint-v3/styles/tokens.css'`.
 */

import './tokens.css'
import './theme-v1.css'

// Re-exported for documentation hooks only. The value is the literal class
// name applied by HiprintDesigner.vue when `theme="v1"` is passed.
export const V1_THEME_CLASS = 'hiprint-theme-v1' as const
export const THEME_DATA_ATTR = 'data-hiprint-theme' as const
