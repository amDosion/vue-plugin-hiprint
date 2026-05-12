/**
 * keyboard.ts — V3 designer-wide keyboard shortcuts (jQuery-free).
 *
 * P16.5 (ADR-0011 §V3 modern UI architecture).
 *
 * Wires a single `window`-scoped `keydown` listener that translates designer
 * shortcuts into canvas-store / history-store dispatches.
 *
 * Supported shortcuts:
 *   - Delete / Backspace        → remove selected elements
 *   - Arrow{Up,Down,Left,Right} → move selection (Shift = bigMoveStep)
 *   - Ctrl+C                    → copy selection (internal clipboard)
 *   - Ctrl+V                    → paste from internal clipboard
 *   - Ctrl+X                    → cut (copy + delete)
 *   - Ctrl+Z                    → history.undo
 *   - Ctrl+Y, Ctrl+Shift+Z      → history.redo
 *   - Tab                       → cycle selection forward in active panel
 *   - Shift+Tab                 → cycle selection backward
 *
 * Why internal clipboard (not navigator.clipboard / ClipboardEvent):
 *   1. Security — system clipboard requires user-gesture handling that's
 *      brittle across browsers + happy-dom tests.
 *   2. Cross-app paste isn't a designer use case; copy/paste only needs to
 *      survive within the running designer session.
 *
 * Input-focus suppression: when `event.target` is an `<input>`, `<textarea>`,
 * `<select>` or `contentEditable` host, all shortcuts pass through. This is
 * essential for property-panel editing.
 *
 * Invariants:
 *   - Single listener install / clean uninstall via returned cleanup.
 *   - Listener catches its own exceptions (P14 R3).
 *   - Copy/paste uses the SAME internal clipboard as context-menu via the
 *     `_setClipboard` / `_getClipboard` accessors exported from context-menu.
 */

import {
  useCanvasStore,
  useHistoryStore,
  type CanvasElement,
} from '@hiprint-v3/stores'
import { _getClipboard, _setClipboard } from './context-menu'
import { isFullyLocked, isPositionLocked } from './lock'

// Captured store types — keep typed to ReturnType so action helpers stay
// 1:1 with the store interface without exporting internal types.
type CanvasStore = ReturnType<typeof useCanvasStore>
type HistoryStore = ReturnType<typeof useHistoryStore>

// -----------------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------------

export interface KeyboardOptions {
  /** Move increment in pt (Shift = bigMoveStep). Default 1. */
  moveStep?: number
  /** Larger move step (Shift). Default = moveStep * 10. */
  bigMoveStep?: number
  /** Enable clipboard shortcuts. Default true. */
  enableClipboard?: boolean
}

// -----------------------------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------------------------

function isEditableTarget(t: EventTarget | null): boolean {
  if (!t) return false
  const el = t as HTMLElement
  if (!el || typeof el.tagName !== 'string') return false
  const tag = el.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if (el.isContentEditable) return true
  return false
}

function newElementId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

function safeRun(fn: () => void): void {
  try {
    fn()
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[hiprint-v3:keyboard] handler threw:', err)
  }
}

// -----------------------------------------------------------------------------
// Action helpers — each takes the captured stores from enableDesignerKeyboard.
//
// Multi-designer Pinia fix (2026-05-11): previously each helper called
// useCanvasStore() / useHistoryStore() at invoke time, which resolved against
// whichever pinia was active when the key was pressed. With multiple
// <HiprintDesigner> components on a page, that meant shortcuts mutated the
// wrong store (or no store at all). Capturing the stores at enable-time keeps
// each keyboard binding scoped to the designer that installed it.
// -----------------------------------------------------------------------------

function deleteSelection(canvas: CanvasStore): void {
  const ids = Array.from(canvas.selectedElementIds)
  if (ids.length === 0) return
  // Resolve each id to its panel + remove. Snapshot panels FIRST so the
  // mutation loop sees a stable list.
  //
  // TKT-027 lock semantics:
  //   - V1 quirk preserved (inventory §8.3, line 1568): the catch-all
  //     `options.lock` blocks keyboard delete; `positionLocked` ALONE does
  //     NOT — position-locked elements remain delete-able by keyboard.
  //   - If EVERY selected element is fully-locked → no-op + warn.
  //   - If selection is MIXED → delete only the non-fully-locked ones.
  const removals: Array<{ panelId: string; elementId: string }> = []
  let lockedSkipped = 0
  for (const p of canvas.panels) {
    for (const el of p.printElements) {
      if (!canvas.selectedElementIds.has(el.id)) continue
      if (isFullyLocked(el.options)) {
        lockedSkipped++
        continue
      }
      removals.push({ panelId: p.id, elementId: el.id })
    }
  }
  if (removals.length === 0 && lockedSkipped > 0) {
    // All selected elements are fully locked. Per spec we emit a structured
    // warn so the host can surface a toast / dev console signal.
    // eslint-disable-next-line no-console
    console.warn('[hiprint] cannot delete locked elements')
    return
  }
  for (const r of removals) {
    canvas.removeElement(r.panelId, r.elementId)
  }
}

function moveSelectionByPt(canvas: CanvasStore, dx: number, dy: number): void {
  if (canvas.selectedElementIds.size === 0) return
  // TKT-027: lock semantics for arrow-key nudge.
  //   - If ALL selected elements are position-locked → no-op (silent — users
  //     hold arrow keys; a noisy warn would spam the console).
  //   - If MIXED → move only the non-locked ones (V1 parity: locked elements
  //     stay in place while the rest of the selection moves).
  const movable: Array<{ panelId: string; elementId: string }> = []
  let lockedSkipped = 0
  for (const p of canvas.panels) {
    for (const el of p.printElements) {
      if (!canvas.selectedElementIds.has(el.id)) continue
      if (isPositionLocked(el.options)) {
        lockedSkipped++
        continue
      }
      movable.push({ panelId: p.id, elementId: el.id })
    }
  }
  if (movable.length === 0) return
  if (lockedSkipped === 0) {
    // Fast path — all selected are movable; use the bulk store action.
    canvas.moveSelection(dx, dy)
    return
  }
  // Mixed selection — patch only the non-locked subset element-by-element so
  // locked siblings don't drift.
  for (const m of movable) {
    const panel = canvas.panels.find((p) => p.id === m.panelId)
    const el = panel?.printElements.find((e) => e.id === m.elementId)
    if (!el) continue
    const o = el.options as Record<string, unknown>
    const left = Number(o.left ?? 0) + dx
    const top = Number(o.top ?? 0) + dy
    canvas.updateElement(m.panelId, m.elementId, { options: { left, top } })
  }
}

function copySelection(canvas: CanvasStore): void {
  if (canvas.selectedElementIds.size === 0) return
  // Resolve selected elements (deep snapshot — store may patch later).
  const copies: CanvasElement[] = []
  for (const p of canvas.panels) {
    for (const el of p.printElements) {
      if (canvas.selectedElementIds.has(el.id)) {
        copies.push({
          id: el.id,
          tid: el.tid,
          options: { ...el.options },
          printElementType: el.printElementType
            ? { ...el.printElementType }
            : undefined,
        })
      }
    }
  }
  if (copies.length > 0) _setClipboard(copies)
}

function pasteSelection(canvas: CanvasStore): void {
  const items = _getClipboard()
  if (items.length === 0) return
  const target = canvas.activePanelId
  if (!target) return

  // Slight offset so pasted elements don't visually overlap the source.
  const OFFSET = 10 // pt
  const newIds: string[] = []
  for (const el of items) {
    const opts: Record<string, unknown> = { ...el.options }
    if (typeof opts.left === 'number') opts.left = Number(opts.left) + OFFSET
    if (typeof opts.top === 'number') opts.top = Number(opts.top) + OFFSET
    const newId = newElementId()
    const created = canvas.addElement(target, {
      tid: el.tid,
      options: opts,
      ...(el.printElementType ? { printElementType: el.printElementType } : {}),
      id: newId,
    })
    if (created) newIds.push(created.id)
  }
  if (newIds.length > 0) {
    canvas.selectMultiple(newIds)
  }
}

function cutSelection(canvas: CanvasStore): void {
  copySelection(canvas)
  deleteSelection(canvas)
}

function undoHistory(history: HistoryStore): void {
  history.undo()
}

function redoHistory(history: HistoryStore): void {
  history.redo()
}

/**
 * Cycle selection within the active panel.
 *  - direction = +1 → next element (wraps).
 *  - direction = -1 → previous element (wraps).
 *  - If nothing selected → first / last element.
 */
function cycleSelection(canvas: CanvasStore, direction: 1 | -1): void {
  const panel = canvas.activePanel
  if (!panel || panel.printElements.length === 0) return
  const ids = panel.printElements.map((e) => e.id)
  let idx: number
  if (canvas.selectedElementIds.size === 0) {
    idx = direction === 1 ? 0 : ids.length - 1
  } else {
    // Anchor on the LAST selected id by insertion order.
    let lastSelected: string | null = null
    canvas.selectedElementIds.forEach((id) => {
      lastSelected = id
    })
    const cur = lastSelected !== null ? ids.indexOf(lastSelected) : -1
    if (cur < 0) {
      idx = direction === 1 ? 0 : ids.length - 1
    } else {
      idx = (cur + direction + ids.length) % ids.length
    }
  }
  const nextId = ids[idx]
  if (nextId) canvas.selectElement(nextId, 'replace')
}

// -----------------------------------------------------------------------------
// Public: enableDesignerKeyboard
// -----------------------------------------------------------------------------

export function enableDesignerKeyboard(opts?: KeyboardOptions): () => void {
  const moveStep = opts?.moveStep ?? 1
  const bigMoveStep = opts?.bigMoveStep ?? moveStep * 10
  const enableClipboard = opts?.enableClipboard !== false

  // Capture stores at enable-time so callbacks (which fire async on every
  // window keydown) target the SAME Pinia instance the component was mounted
  // with — not whichever pinia happens to be active when the key is pressed.
  // Multi-designer fix (2026-05-11) — see file header doc.
  const canvas = useCanvasStore()
  const history = useHistoryStore()

  function handler(e: KeyboardEvent): void {
    if (isEditableTarget(e.target)) return

    safeRun(() => {
      // -- Undo / Redo (check FIRST so Ctrl+Z doesn't fall through to other) --
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        if (e.shiftKey) {
          redoHistory(history)
        } else {
          undoHistory(history)
        }
        e.preventDefault()
        return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        redoHistory(history)
        e.preventDefault()
        return
      }

      // -- Clipboard --
      if (enableClipboard && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        if (e.key === 'c' || e.key === 'C') {
          // TKT-020: copy is read-only — no history push (V1 parity).
          copySelection(canvas)
          e.preventDefault()
          return
        }
        if (e.key === 'v' || e.key === 'V') {
          // TKT-020: paste only changes state when there was something on
          // the clipboard AND an active panel to paste into. Track size
          // delta on the active panel so we don't snapshot a no-op.
          const beforeCount = canvas.activePanel?.printElements.length ?? -1
          pasteSelection(canvas)
          const afterCount = canvas.activePanel?.printElements.length ?? -1
          if (afterCount > beforeCount) history.pushSnapshot()
          e.preventDefault()
          return
        }
        if (e.key === 'x' || e.key === 'X') {
          // TKT-020: cut mutates iff something was selected. Empty-selection
          // Ctrl+X is a no-op.
          const sizeBefore = canvas.selectedElementIds.size
          cutSelection(canvas)
          if (sizeBefore > 0) history.pushSnapshot()
          e.preventDefault()
          return
        }
      }

      // -- Delete --
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // TKT-020: snapshot ONLY when we actually removed something. Pressing
        // Delete on an empty selection is a no-op; we should not consume an
        // undo slot.
        const sizeBefore = canvas.selectedElementIds.size
        deleteSelection(canvas)
        if (sizeBefore > 0) history.pushSnapshot()
        e.preventDefault()
        return
      }

      // -- Arrow move --
      // TKT-020: per-keypress snapshot for arrows (V1-faithful). V1 fills the
      // 50-cap fast with nudges but that's V1's accepted UX; matrix says
      // match V1 here. moveSelectionByPt itself early-returns when nothing's
      // selected, so we mirror that guard before pushing.
      const step = e.shiftKey ? bigMoveStep : moveStep
      const hasSelection = canvas.selectedElementIds.size > 0
      if (e.key === 'ArrowUp') {
        moveSelectionByPt(canvas, 0, -step)
        if (hasSelection) history.pushSnapshot()
        e.preventDefault()
        return
      }
      if (e.key === 'ArrowDown') {
        moveSelectionByPt(canvas, 0, step)
        if (hasSelection) history.pushSnapshot()
        e.preventDefault()
        return
      }
      if (e.key === 'ArrowLeft') {
        moveSelectionByPt(canvas, -step, 0)
        if (hasSelection) history.pushSnapshot()
        e.preventDefault()
        return
      }
      if (e.key === 'ArrowRight') {
        moveSelectionByPt(canvas, step, 0)
        if (hasSelection) history.pushSnapshot()
        e.preventDefault()
        return
      }

      // -- Tab cycle --
      if (e.key === 'Tab') {
        cycleSelection(canvas, e.shiftKey ? -1 : 1)
        e.preventDefault()
        return
      }
    })
  }

  window.addEventListener('keydown', handler)
  return () => {
    window.removeEventListener('keydown', handler)
  }
}
