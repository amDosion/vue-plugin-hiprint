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
// Action helpers — each reads stores lazily so the listener stays single-fn.
// -----------------------------------------------------------------------------

function deleteSelection(): void {
  const canvas = useCanvasStore()
  const ids = Array.from(canvas.selectedElementIds)
  if (ids.length === 0) return
  // Resolve each id to its panel + remove. Snapshot panels FIRST so the
  // mutation loop sees a stable list.
  const removals: Array<{ panelId: string; elementId: string }> = []
  for (const p of canvas.panels) {
    for (const el of p.printElements) {
      if (canvas.selectedElementIds.has(el.id)) {
        removals.push({ panelId: p.id, elementId: el.id })
      }
    }
  }
  for (const r of removals) {
    canvas.removeElement(r.panelId, r.elementId)
  }
}

function moveSelectionByPt(dx: number, dy: number): void {
  const canvas = useCanvasStore()
  if (canvas.selectedElementIds.size === 0) return
  canvas.moveSelection(dx, dy)
}

function copySelection(): void {
  const canvas = useCanvasStore()
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

function pasteSelection(): void {
  const items = _getClipboard()
  if (items.length === 0) return
  const canvas = useCanvasStore()
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

function cutSelection(): void {
  copySelection()
  deleteSelection()
}

function undoHistory(): void {
  const history = useHistoryStore()
  history.undo()
}

function redoHistory(): void {
  const history = useHistoryStore()
  history.redo()
}

/**
 * Cycle selection within the active panel.
 *  - direction = +1 → next element (wraps).
 *  - direction = -1 → previous element (wraps).
 *  - If nothing selected → first / last element.
 */
function cycleSelection(direction: 1 | -1): void {
  const canvas = useCanvasStore()
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

  function handler(e: KeyboardEvent): void {
    if (isEditableTarget(e.target)) return

    safeRun(() => {
      // -- Undo / Redo (check FIRST so Ctrl+Z doesn't fall through to other) --
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        if (e.shiftKey) {
          redoHistory()
        } else {
          undoHistory()
        }
        e.preventDefault()
        return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        redoHistory()
        e.preventDefault()
        return
      }

      // -- Clipboard --
      if (enableClipboard && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        if (e.key === 'c' || e.key === 'C') {
          copySelection()
          e.preventDefault()
          return
        }
        if (e.key === 'v' || e.key === 'V') {
          pasteSelection()
          e.preventDefault()
          return
        }
        if (e.key === 'x' || e.key === 'X') {
          cutSelection()
          e.preventDefault()
          return
        }
      }

      // -- Delete --
      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelection()
        e.preventDefault()
        return
      }

      // -- Arrow move --
      const step = e.shiftKey ? bigMoveStep : moveStep
      if (e.key === 'ArrowUp') {
        moveSelectionByPt(0, -step)
        e.preventDefault()
        return
      }
      if (e.key === 'ArrowDown') {
        moveSelectionByPt(0, step)
        e.preventDefault()
        return
      }
      if (e.key === 'ArrowLeft') {
        moveSelectionByPt(-step, 0)
        e.preventDefault()
        return
      }
      if (e.key === 'ArrowRight') {
        moveSelectionByPt(step, 0)
        e.preventDefault()
        return
      }

      // -- Tab cycle --
      if (e.key === 'Tab') {
        cycleSelection(e.shiftKey ? -1 : 1)
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
