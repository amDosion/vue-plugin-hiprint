/**
 * resize.ts — V3 element resize via interact.js (jQuery-free).
 *
 * P16.2 (ADR-0011 §V3 modern UI architecture).
 *
 * Replaces V1/V2 jQuery-UI .resizable() (~500 LOC self-rolled in bundle.js
 * `vendor/jquery-resizable.js`) with a typed, lifecycle-safe wrapper around
 * interact.js Resizable.
 *
 * Public API:
 *   - enableElementResize(el, opts): cleanup
 *   - disableElementResize(el): void
 *
 * Behavior:
 *   - Element 8-corner/edge resize (top/right/bottom/left, opts-configurable).
 *   - min-size clamp via restrictSize modifier.
 *   - Grid snap via snapSize modifier (when gridSize > 1).
 *   - Aspect-ratio lock when (a) opts.lockAspectRatio = true OR (b) shiftKey
 *     held during the gesture (dynamically toggled per `resizemove`).
 *   - Callbacks fire with rect {left, top, width, height} in **pt**
 *     (input element is assumed positioned absolutely in pt — caller maps
 *     these directly to canvas store updateElement options.{left,top,width,height}).
 *
 * Invariants:
 *   - Caller owns element lifecycle: enable/disable is idempotent + safe to
 *     call after element removal (interact.unset on missing target is a no-op).
 *   - All listener exceptions are caught + console.warn'd (P14 R3 pattern).
 *   - We never read jQuery / `$()` — pure interact.js.
 */

import interact from 'interactjs'
import { px, pt } from '../internal/uom'
import { useCanvasStore, useHistoryStore } from '@hiprint-v3/stores'
import { findElement, isSizeLocked } from './lock'

// -----------------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------------

export interface ResizeRect {
  /** Left position in pt. */
  left: number
  /** Top position in pt. */
  top: number
  /** Width in pt. */
  width: number
  /** Height in pt. */
  height: number
}

export interface ElementResizeOptions {
  /** Element id (passed through to callbacks; opaque to this module). */
  elementId: string
  /** Panel id (passed through; opaque). */
  panelId: string
  /** Minimum width in pt. Default: 5. */
  minWidth?: number
  /** Minimum height in pt. Default: 5. */
  minHeight?: number
  /**
   * Snap to grid (pt). Default: 1 (effectively no snap).
   * When > 1, both width/height + left/top are snapped on every move.
   */
  gridSize?: number
  /**
   * Force aspect ratio lock for the whole gesture. Independent of Shift.
   * When false (default), Shift-held during gesture locks dynamically.
   */
  lockAspectRatio?: boolean
  /** Which 8 handles to enable. Default: all four edges/corners. */
  edges?: {
    top?: boolean
    right?: boolean
    bottom?: boolean
    left?: boolean
  }
  /**
   * TKT-104 — fires once when the resize gesture begins (before any tick).
   * Lets the wrapper flip its overlay to 'resize' mode without subscribing
   * to interact.js internals directly.
   */
  onStart?: (startRect: ResizeRect) => void
  /** Called on each resize tick (pt). */
  onResize?: (newRect: ResizeRect) => void
  /** Called once on resize gesture end (pt). */
  onEnd?: (finalRect: ResizeRect) => void
}

// -----------------------------------------------------------------------------
// Internals
// -----------------------------------------------------------------------------

/** Per-element state we need across move events. */
interface ResizeState {
  /** Aspect ratio captured on resizestart (width / height). 0 if not captured. */
  startRatio: number
  /** Whether the gesture is currently aspect-locked (force OR Shift). */
  aspectLocked: boolean
  /** opts.lockAspectRatio snapshot — set on enable. */
  forceLock: boolean
}

const ELEMENT_STATE = new WeakMap<HTMLElement, ResizeState>()

/** Convert px → pt safely (handles SSR / happy-dom DPI=96 fallback). */
function pxToPt(p: number): number {
  return px.toPt(p)
}

/** Snap a value to grid (pt domain). gridSize=1 returns the value unchanged. */
function snapToGrid(value: number, gridSize: number): number {
  if (gridSize <= 1) return value
  return Math.round(value / gridSize) * gridSize
}

/** Safe callback invocation — never lets caller exceptions break interact.js. */
function safeCall<T extends (...args: any[]) => unknown>(
  fn: T | undefined,
  ...args: Parameters<T>
): void {
  if (!fn) return
  try {
    fn(...args)
  } catch (err) {
    // P14 R3 pattern: business callbacks isolated.
    // eslint-disable-next-line no-console
    console.warn('[hiprint-v3:resize] listener threw:', err)
  }
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Enable resize on an element. Returns cleanup function.
 *
 * Caller is expected to:
 *   - Position `el` absolutely in pt (element.style.left/top/width/height in pt).
 *   - On opts.onEnd, push the final rect to the canvas store
 *     (e.g. canvas.updateElement(panelId, elementId, { options: {...rect} })).
 *
 * @example
 *   const cleanup = enableElementResize(el, {
 *     elementId: 'e-1', panelId: 'p-1',
 *     minWidth: 5, minHeight: 5, gridSize: 1,
 *     onEnd: (rect) => store.updateElement('p-1', 'e-1', { options: rect }),
 *   })
 *   // later:
 *   cleanup()
 */
export function enableElementResize(
  el: HTMLElement,
  opts: ElementResizeOptions
): () => void {
  // TKT-027: size-lock gate. If the element is size-locked at registration
  // time we do NOT attach interact.js resizable; this ALSO prevents corner
  // handles from rendering because the ElementWrapper hides them via the
  // `.hiprint-element--locked` BEM hook. Per V1 inventory Section H:
  // `sizeLocked` OR `lock` blocks resize.
  //
  // We attempt to read the canvas store; if Pinia is not active (test path
  // without a designer, or pre-mount call) we fall through to normal
  // registration — those paths use mock data and bypass real lock state.
  try {
    const canvas = useCanvasStore()
    const elRec = findElement(canvas, opts.elementId)
    if (elRec && isSizeLocked(elRec.options)) {
      // No-op cleanup keeps caller lifecycle uniform.
      return () => undefined
    }
  } catch {
    // No active Pinia — proceed with registration.
  }

  const minWidth = opts.minWidth ?? 5
  const minHeight = opts.minHeight ?? 5
  const gridSize = opts.gridSize ?? 1
  // If caller omits `edges`, default to all four. If they pass a partial
  // object, missing keys are treated as `false` (caller explicitly opted in).
  const edges: Required<NonNullable<ElementResizeOptions['edges']>> = opts.edges
    ? {
        top: opts.edges.top ?? false,
        right: opts.edges.right ?? false,
        bottom: opts.edges.bottom ?? false,
        left: opts.edges.left ?? false,
      }
    : { top: true, right: true, bottom: true, left: true }

  // Initialize per-element state.
  const state: ResizeState = {
    startRatio: 0,
    aspectLocked: !!opts.lockAspectRatio,
    forceLock: !!opts.lockAspectRatio,
  }
  ELEMENT_STATE.set(el, state)

  // TKT-020: capture history store at enable-time (multi-designer pinia-pin
  // pattern — same rationale as drag-drop.ts / keyboard.ts). The captured
  // ref stays valid for the lifetime of this resizable; resize-end pushes
  // a snapshot so undo restores the previous geometry.
  //
  // Defensive: useHistoryStore() throws when Pinia isn't active (some unit
  // tests construct resizables outside a Pinia scope to inspect the
  // interact.js wiring). We swallow that and silently skip the snapshot —
  // tests that care about history install Pinia.
  let history: ReturnType<typeof useHistoryStore> | null = null
  try {
    history = useHistoryStore()
  } catch {
    history = null
  }
  // Mirror drag-drop's didMove: a 0-delta resize gesture (handle click, no
  // drag) shouldn't burn an undo slot. Tracks any move-event with non-zero
  // px delta on either axis.
  let didResize = false

  // Build modifiers:
  //   1. restrictSize  — min clamp (pt → px).
  //   2. snapSize      — grid snap (pt → px), only if gridSize > 1.
  const modifiers: unknown[] = [
    interact.modifiers.restrictSize({
      min: { width: pt2px(minWidth), height: pt2px(minHeight) },
    }),
  ]
  if (gridSize > 1) {
    const gridPx = pt2px(gridSize)
    modifiers.push(
      interact.modifiers.snapSize({
        targets: [interact.snappers.grid({ width: gridPx, height: gridPx })],
      })
    )
  }

  interact(el).resizable({
    edges,
    // We don't use inertia for layout-precise editing.
    inertia: false,
    // Cast: interact.js modifier types are generic + union-heavy;
    // we trust the public factory functions.
    modifiers: modifiers as never,
    listeners: {
      start: (event: any) => {
        const rect = event.rect as { width: number; height: number }
        state.startRatio = rect.height > 0 ? rect.width / rect.height : 0
        state.aspectLocked = state.forceLock || !!event.shiftKey
        // TKT-020: reset per-gesture movement flag.
        didResize = false
        // TKT-104: emit starting rect so caller can flip overlay to 'resize'.
        if (opts.onStart) {
          const startRect: ResizeRect = {
            left: parseFloat(el.style.left || '0'),
            top: parseFloat(el.style.top || '0'),
            width: parseFloat(el.style.width || '0'),
            height: parseFloat(el.style.height || '0'),
          }
          safeCall(opts.onStart, startRect)
        }
      },
      move: (event: any) => {
        // Dynamic Shift toggle on every move.
        const desired = state.forceLock || !!event.shiftKey
        state.aspectLocked = desired

        const rect = event.rect as { width: number; height: number }
        const deltaRect = event.deltaRect as
          | { left: number; top: number }
          | undefined
        // TKT-020: any non-zero delta on either axis counts as a real resize.
        const dx = deltaRect?.left ?? 0
        const dy = deltaRect?.top ?? 0
        if (dx !== 0 || dy !== 0) didResize = true

        // event.rect is in px (browser pixel domain). Convert to pt.
        let widthPt = pxToPt(rect.width)
        let heightPt = pxToPt(rect.height)

        // Aspect ratio lock — derive missing dimension from the larger delta.
        if (state.aspectLocked && state.startRatio > 0) {
          const absDx = Math.abs(deltaRect?.left ?? 0)
          const absDy = Math.abs(deltaRect?.top ?? 0)
          // Heuristic: if horizontal delta dominates, drive height from width.
          if (absDx >= absDy) {
            heightPt = widthPt / state.startRatio
          } else {
            widthPt = heightPt * state.startRatio
          }
        }

        // Compute new top/left in pt by reading current style + applying delta.
        // (We trust caller has set style.left/style.top in pt.)
        const curLeft = parseFloat(el.style.left || '0')
        const curTop = parseFloat(el.style.top || '0')
        const leftPt = curLeft + pxToPt(deltaRect?.left ?? 0)
        const topPt = curTop + pxToPt(deltaRect?.top ?? 0)

        // Grid snap (pt domain) — applies to position when modifier didn't
        // cover it (snapSize only snaps dimensions).
        const newRect: ResizeRect = {
          left: snapToGrid(leftPt, gridSize),
          top: snapToGrid(topPt, gridSize),
          width: Math.max(minWidth, snapToGrid(widthPt, gridSize)),
          height: Math.max(minHeight, snapToGrid(heightPt, gridSize)),
        }

        // Reflect to DOM so resize visually tracks the cursor.
        el.style.left = `${newRect.left}pt`
        el.style.top = `${newRect.top}pt`
        el.style.width = `${newRect.width}pt`
        el.style.height = `${newRect.height}pt`

        safeCall(opts.onResize, newRect)
      },
      end: (_event: any) => {
        const finalRect: ResizeRect = {
          left: parseFloat(el.style.left || '0'),
          top: parseFloat(el.style.top || '0'),
          width: parseFloat(el.style.width || '0'),
          height: parseFloat(el.style.height || '0'),
        }
        safeCall(opts.onEnd, finalRect)
        // TKT-020: history snapshot on actual resize commit. Caller's onEnd
        // already pushed the geometry into the canvas store; we record it
        // here so Ctrl+Z restores the prior size. Skip when the gesture
        // didn't move (handle clicked without drag).
        if (didResize && history) {
          try {
            history.pushSnapshot()
          } catch (err) {
            // eslint-disable-next-line no-console
            console.warn('[hiprint-v3:resize] history push threw:', err)
          }
        }
      },
    },
  })

  return () => disableElementResize(el)
}

/**
 * Disable resize handlers + unset interact target.
 * Idempotent: safe to call multiple times or on an unregistered element.
 */
export function disableElementResize(el: HTMLElement): void {
  try {
    interact(el).unset()
  } catch (err) {
    // interact.unset can throw if scope was already torn down — non-fatal.
    // eslint-disable-next-line no-console
    console.warn('[hiprint-v3:resize] unset threw:', err)
  }
  ELEMENT_STATE.delete(el)
}

// -----------------------------------------------------------------------------
// Helpers (not exported)
// -----------------------------------------------------------------------------

/** pt → px (1 pt = dpi/72 px at runtime DPI). */
function pt2px(value: number): number {
  return pt.toPx(value)
}
