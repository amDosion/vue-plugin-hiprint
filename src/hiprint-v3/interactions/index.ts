/**
 * src/hiprint-v3/interactions/index.ts — interaction module barrel.
 *
 * Public API for V3 interaction layer (jQuery-free). Consumed by designer
 * components and (later) V3 native composables.
 *
 * Sub-modules:
 *  - drag-drop.ts    (P16.1) — element drag, sidebar source, panel dropzone
 *  - resize.ts       (P16.2) — element resize (interact.js Resizable)
 *  - panel-reflow.ts (P16.2) — ResizeObserver-based panel size watcher
 *  - context-menu.ts (P16.3) — right-click menu (@floating-ui/vue)
 *  - selection.ts    (P16.4) — click selection + lasso + Ctrl+A/Escape
 *  - keyboard.ts     (P16.5) — designer-wide keyboard shortcuts
 */

// ---- P16.1 drag-drop ----
export {
  enableElementDrag,
  enableElementListSource,
  enablePanelDropZone,
  disableInteractions,
} from './drag-drop'

export type {
  Position,
  DragHandle,
  DropZone,
  ElementDragOptions,
  ElementListSourceOptions,
  InteractionRegistration,
} from './types'

// ---- TKT-103 smart-guides ----
export {
  SMART_GUIDE_SNAP_PT,
  computeSnap,
  boxFromElement,
  setSmartGuidePreviews,
  clearSmartGuidePreviews,
  getSmartGuidePreviews,
  onSmartGuidePreviewChange,
} from './smart-guides'
export type {
  ElementBox,
  SmartGuidePreview,
  SnapResult,
  ComputeSnapOptions,
} from './smart-guides'

// ---- P16.2 resize ----
export { enableElementResize, disableElementResize } from './resize'
export type { ResizeRect, ElementResizeOptions } from './resize'

// ---- P16.2 panel reflow ----
export { watchPanelSize } from './panel-reflow'
export type { PanelSize, WatchPanelSizeOptions } from './panel-reflow'

// ---- P16.3 context menu ----
export {
  openContextMenu,
  buildElementContextItems,
  // TKT-107 (Sprint 22c): right-click thead column editor.
  buildTableColumnContextItems,
} from './context-menu'
export type {
  ContextMenuItem,
  ContextMenuOptions,
  ContextMenuController,
} from './context-menu'

// ---- P16.4 selection ----
export {
  enableElementSelection,
  enableLasso,
  enableSelectionShortcuts,
} from './selection'
export type { SelectionEvent } from './selection'

// ---- P16.5 keyboard ----
export { enableDesignerKeyboard } from './keyboard'
export type { KeyboardOptions } from './keyboard'

// ---- TKT-027 lock semantics ----
// Pure-options predicates (call with element.options).
export {
  isFullyLocked,
  isPositionLocked,
  isSizeLocked,
  isAnyLocked,
} from './lock'
// Store-resolving wrappers (call with canvas store + element id).
export {
  isElementFullyLocked,
  isElementPositionLocked,
  isElementSizeLocked,
  isElementAnyLocked,
} from './lock'
