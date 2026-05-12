/**
 * lock.ts — V3 lock semantics (TKT-027).
 *
 * V1 reference: `docs/V1-INVENTORY/interactions.md` §8.2 + per-etype Section H.
 *
 * V1 exposes four overlapping lock fields per element instance:
 *
 *   - `options.lock`            — catch-all full lock; blocks everything
 *                                 except selection + property edit.
 *   - `options.positionLocked`  — move-only block (drag + arrow nudge).
 *                                 V1 quirk: does NOT block keyboard Delete.
 *   - `options.sizeLocked`      — resize-only block (handles hidden).
 *   - `options.draggable=false` — alias of positionLocked (legacy compat).
 *
 * V3 reuses these field names verbatim so business templates carry over.
 *
 * V1 quirk preserved (per inventory §8.3, line 1568):
 *   "Position-locked elements CAN be deleted via Delete/Backspace."
 * → Only the catch-all `lock` blocks keyboard delete. `positionLocked` alone
 *   leaves delete intact.
 *
 * V1 quirk preserved (per inventory §1.5 line 11945):
 *   Lasso filter uses `options.draggable !== false` — lasso-locked elements
 *   are still selectable by direct click. Selection is never locked.
 *
 * Visual indicator: the OR of any of these makes the element appear "locked"
 * (CSS class hook `.hiprint-element--locked` rendered by ElementWrapper).
 *
 * NOTE: We READ from the canvas store rather than from a DOM dataset to avoid
 * staleness between options patches and a follow-up gesture. The store is the
 * source of truth.
 */

import { useCanvasStore, type CanvasElement } from '@hiprint-v3/stores'

// -----------------------------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------------------------

/** Coerce truthy values. Mirrors V1's `=== true` / `!== false` semantics. */
function toBool(v: unknown): boolean {
  return v === true || v === 'true' || v === 1
}

/**
 * Locate a CanvasElement across all panels. Returns null if not found.
 *
 * We accept a pre-captured store so callers can hot-path (e.g. interact.js
 * listeners that fire on every move).
 */
export function findElement(
  canvas: ReturnType<typeof useCanvasStore>,
  elementId: string
): CanvasElement | null {
  for (const p of canvas.panels) {
    const el = p.printElements.find((e) => e.id === elementId)
    if (el) return el
  }
  return null
}

// -----------------------------------------------------------------------------
// Public flag API — operate on a plain options bag (called from listeners that
// already resolved the element record).
// -----------------------------------------------------------------------------

/** Full lock — V1 catch-all. Blocks drag / resize / delete / inline edit. */
export function isFullyLocked(options: Record<string, unknown> | undefined): boolean {
  if (!options) return false
  return toBool(options.lock)
}

/**
 * Position lock — drag + arrow nudge blocked. Delete is NOT blocked (V1 quirk).
 * Aliases: `positionLocked === true` OR `draggable === false`.
 */
export function isPositionLocked(
  options: Record<string, unknown> | undefined
): boolean {
  if (!options) return false
  if (toBool(options.lock)) return true
  if (toBool(options.positionLocked)) return true
  if (options.draggable === false) return true
  return false
}

/** Size lock — resize handles hidden + interact.js resizable not enabled. */
export function isSizeLocked(
  options: Record<string, unknown> | undefined
): boolean {
  if (!options) return false
  if (toBool(options.lock)) return true
  if (toBool(options.sizeLocked)) return true
  return false
}

/** Any-lock — used for visual indicator + context-menu Lock/Unlock toggle. */
export function isAnyLocked(options: Record<string, unknown> | undefined): boolean {
  return isFullyLocked(options) || isPositionLocked(options) || isSizeLocked(options)
}

// -----------------------------------------------------------------------------
// Store-resolving wrappers — for call sites that have only an id.
// -----------------------------------------------------------------------------

export function isElementFullyLocked(
  canvas: ReturnType<typeof useCanvasStore>,
  elementId: string
): boolean {
  const el = findElement(canvas, elementId)
  if (!el) return false
  return isFullyLocked(el.options)
}

export function isElementPositionLocked(
  canvas: ReturnType<typeof useCanvasStore>,
  elementId: string
): boolean {
  const el = findElement(canvas, elementId)
  if (!el) return false
  return isPositionLocked(el.options)
}

export function isElementSizeLocked(
  canvas: ReturnType<typeof useCanvasStore>,
  elementId: string
): boolean {
  const el = findElement(canvas, elementId)
  if (!el) return false
  return isSizeLocked(el.options)
}

export function isElementAnyLocked(
  canvas: ReturnType<typeof useCanvasStore>,
  elementId: string
): boolean {
  const el = findElement(canvas, elementId)
  if (!el) return false
  return isAnyLocked(el.options)
}
