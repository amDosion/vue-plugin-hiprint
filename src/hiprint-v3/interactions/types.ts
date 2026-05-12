/**
 * src/hiprint-v3/interactions/types.ts — shared interaction types.
 *
 * Used by drag-drop.ts and consumed by designer components.
 */

/** A 2D position. Units: pt unless otherwise noted. */
export interface Position {
  /** Horizontal coordinate in pt. */
  x: number
  /** Vertical coordinate in pt. */
  y: number
}

/** A registered draggable handle. */
export interface DragHandle {
  /** Element id (matches CanvasElement.id). */
  id: string
  /** Bound DOM node. */
  el: HTMLElement
}

/** A registered drop zone (a panel surface). */
export interface DropZone {
  /** Panel id this zone represents. */
  panelId: string
  /** Bound DOM node. */
  el: HTMLElement
  /** Cached bounds (may be re-measured on demand). */
  bounds: DOMRect
}

/**
 * Options for {@link enableElementDrag}.
 *
 * The handler operates in pt-space (the same unit canvas store uses for
 * `options.left` / `options.top`). The caller is responsible for converting
 * between screen px (delivered by interact.js) and pt before applying the
 * patch — we use `px.toPt()` from internal/uom.
 */
export interface ElementDragOptions {
  /** Element id (matches CanvasElement.id in canvas store). */
  elementId: string
  /** Owning panel id. */
  panelId: string
  /**
   * Snap grid step in pt. Pass 0 / undefined to disable snap (free move).
   * Default: 0 (caller decides; canvas store has its own `gridSize`).
   */
  gridSize?: number
  /**
   * TKT-104 — fires once at drag start (before any movement). Used by
   * ElementWrapper to flip the cross-hair/size-readout overlay into 'drag'
   * mode without subscribing to interact.js directly.
   */
  onStart?: () => void
  /**
   * Optional callback during drag (called on every move). Receives the
   * delta in pt since drag start.
   */
  onMove?: (deltaPt: Position) => void
  /**
   * Optional callback when drag ends. Receives the FINAL position in pt
   * (absolute, relative to panel origin).
   */
  onEnd?: (finalPosPt: Position) => void
}

/**
 * Options for {@link enableElementListSource}.
 *
 * Used on element-list (sidebar) item drags: drag from list → drop on panel.
 */
export interface ElementListSourceOptions {
  /**
   * The element TID (template type id, e.g. 'configModule.text'). Used to
   * locate the etype factory on drop.
   */
  tid: string
  /**
   * Factory that produces the initial element record. Caller-provided so we
   * don't take a hard dep on @hiprint-v3/etypes (P17).
   */
  createElement?: () => Record<string, unknown>
}

/**
 * Internal: tracked handler registration so we can clean up.
 *
 * Stored on the element via a WeakMap to avoid leaking on dispose.
 */
export interface InteractionRegistration {
  kind: 'element-drag' | 'list-source' | 'panel-dropzone'
  panelId?: string
  elementId?: string
  tid?: string
}
