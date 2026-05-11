/**
 * selection.ts — V3 selection model bindings (jQuery-free).
 *
 * P16.4 (ADR-0011 §V3 modern UI architecture).
 *
 * Wires the canvas store's selection actions (`selectElement`,
 * `selectMultiple`, `clearSelection`) to three input surfaces:
 *
 *   1. enableElementSelection(el, elementId, panelId)
 *        - click on element root → call `canvas.selectElement(id, mode)`
 *          where mode is derived from event modifiers:
 *            shiftKey → 'add'
 *            ctrlKey/metaKey → 'toggle'
 *            none → 'replace'
 *        - Returns a cleanup function (removes listeners).
 *
 *   2. enableLasso(panelEl, panelId)
 *        - pointerdown on the panel BACKGROUND (target === panelEl, not an
 *          element child) → start a lasso drag.
 *        - pointermove → draw a positioned `<div>` lasso rectangle inside
 *          the panel.
 *        - pointerup → measure each `.hiprint-element` child's bounding rect,
 *          compute intersection with lasso rect, dispatch
 *          `canvas.selectMultiple(intersectingIds)`.
 *        - Returns a cleanup function.
 *
 *   3. enableSelectionShortcuts()
 *        - Global Ctrl+A (select-all in active panel) + Escape (clear).
 *        - Suppressed when focus is in input/textarea/contenteditable (so we
 *          don't hijack form input).
 *        - Returns a cleanup function.
 *
 * Invariants:
 *   - Multi-handler exceptions never propagate (caught + warned).
 *   - Lasso never selects across panels — only intersects children of `panelEl`.
 *   - All listener registration is keyed so cleanup is deterministic + safe.
 */

import { useCanvasStore } from '@hiprint-v3/stores'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface SelectionEvent {
  elementId: string
  mode: 'replace' | 'add' | 'toggle'
}

interface SelectionOpts {
  onChange?: (event: SelectionEvent) => void
}

// -----------------------------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------------------------

function safeCall<T extends (...args: any[]) => unknown>(
  fn: T | undefined,
  ...args: Parameters<T>
): void {
  if (!fn) return
  try {
    fn(...args)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[hiprint-v3:selection] listener threw:', err)
  }
}

function isEditableTarget(t: EventTarget | null): boolean {
  if (!t) return false
  const el = t as HTMLElement
  if (!el || typeof el.tagName !== 'string') return false
  const tag = el.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if (el.isContentEditable) return true
  return false
}

function modeFromEvent(e: MouseEvent): SelectionEvent['mode'] {
  if (e.shiftKey) return 'add'
  // Treat Cmd (mac) the same as Ctrl for cross-platform parity.
  if (e.ctrlKey || e.metaKey) return 'toggle'
  return 'replace'
}

// -----------------------------------------------------------------------------
// enableElementSelection
// -----------------------------------------------------------------------------

/**
 * Attach selection click handler to an element root. Returns cleanup.
 */
export function enableElementSelection(
  el: HTMLElement,
  elementId: string,
  panelId: string,
  opts?: SelectionOpts
): () => void {
  if (!el) {
    // eslint-disable-next-line no-console
    console.warn('[hiprint-v3:selection] enableElementSelection: el required')
    return () => undefined
  }
  if (!elementId || !panelId) {
    // eslint-disable-next-line no-console
    console.warn(
      '[hiprint-v3:selection] enableElementSelection: elementId + panelId required'
    )
    return () => undefined
  }

  // Capture canvas store at enable-time so callbacks (which fire async after
  // enable returns) use the same Pinia instance the component was mounted
  // with — not whichever pinia is active at click time. Multi-designer fix
  // (2026-05-11): symptoms = drag/click no-op or wrong-store mutation.
  const canvas = useCanvasStore()

  function handler(e: MouseEvent): void {
    try {
      // Only treat primary button. Right-click handled by context menu.
      if (e.button !== 0) return
      // Don't fight the click if it bubbles from a control inside (e.g. form
      // editor inline-rendered into the element).
      if (isEditableTarget(e.target)) return
      const mode = modeFromEvent(e)
      canvas.selectElement(elementId, mode)
      // Also activate the panel — clicking elements in an inactive panel
      // should bring it forward (V1 parity).
      if (canvas.activePanelId !== panelId) {
        canvas.setActivePanel(panelId)
      }
      safeCall(opts?.onChange, { elementId, mode })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[hiprint-v3:selection] click handler threw:', err)
    }
  }

  el.addEventListener('click', handler)
  return () => {
    el.removeEventListener('click', handler)
  }
}

// -----------------------------------------------------------------------------
// enableLasso
// -----------------------------------------------------------------------------

/**
 * Internal: compute axis-aligned rectangle intersection.
 * Returns true if rect A and rect B share any area.
 */
function rectsIntersect(a: DOMRect, b: DOMRect): boolean {
  return (
    a.left < b.right &&
    a.right > b.left &&
    a.top < b.bottom &&
    a.bottom > b.top
  )
}

/**
 * Enable lasso (box-select) drag on a panel background.
 *
 * Implementation detail: we install pointerdown on `panelEl`. The drag only
 * starts if the actual `e.target === panelEl` — i.e. the click originated on
 * the empty background and not on a child element. This matches the V1
 * behavior of jQuery UI `.selectable()`.
 */
export function enableLasso(panelEl: HTMLElement, panelId: string): () => void {
  if (!panelEl) {
    // eslint-disable-next-line no-console
    console.warn('[hiprint-v3:selection] enableLasso: panelEl required')
    return () => undefined
  }
  if (!panelId) {
    // eslint-disable-next-line no-console
    console.warn('[hiprint-v3:selection] enableLasso: panelId required')
    return () => undefined
  }

  // Capture canvas store at enable-time (multi-designer Pinia fix — see
  // enableElementSelection comment). pointerup fires async; using a fresh
  // useCanvasStore() inside the closure could resolve to the wrong instance
  // once another designer mounted afterwards has set active pinia.
  const canvas = useCanvasStore()

  let lasso: HTMLDivElement | null = null
  let startX = 0
  let startY = 0
  let active = false

  function onPointerDown(e: PointerEvent): void {
    // Only start on empty background — child elements (.hiprint-element)
    // would handle their own click; lasso must not interfere.
    if (e.target !== panelEl) return
    if (e.button !== 0) return
    active = true
    startX = e.clientX
    startY = e.clientY

    lasso = document.createElement('div')
    lasso.className = 'hiprint-lasso'
    lasso.style.position = 'absolute'
    lasso.style.left = `${startX}px`
    lasso.style.top = `${startY}px`
    lasso.style.width = '0px'
    lasso.style.height = '0px'
    lasso.style.border = '1px dashed #409eff'
    lasso.style.background = 'rgba(64, 158, 255, 0.08)'
    lasso.style.pointerEvents = 'none'
    lasso.style.zIndex = '9999'
    // Attach to document.body so its absolute coords align with clientX/Y.
    document.body.appendChild(lasso)

    // Attach move/up listeners on document so drag tracks past panel bounds.
    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
    document.addEventListener('pointercancel', onPointerUp)
  }

  function onPointerMove(e: PointerEvent): void {
    if (!active || !lasso) return
    const minX = Math.min(startX, e.clientX)
    const minY = Math.min(startY, e.clientY)
    const w = Math.abs(e.clientX - startX)
    const h = Math.abs(e.clientY - startY)
    lasso.style.left = `${minX}px`
    lasso.style.top = `${minY}px`
    lasso.style.width = `${w}px`
    lasso.style.height = `${h}px`
  }

  function onPointerUp(_e: PointerEvent): void {
    if (!active) return
    active = false
    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', onPointerUp)
    document.removeEventListener('pointercancel', onPointerUp)

    try {
      if (lasso) {
        const lassoRect = lasso.getBoundingClientRect()
        // Gather child elements with `.hiprint-element` + data-element-id.
        const children = panelEl.querySelectorAll<HTMLElement>(
          '.hiprint-element[data-element-id]'
        )
        const hitIds: string[] = []
        children.forEach((child) => {
          const r = child.getBoundingClientRect()
          if (rectsIntersect(lassoRect, r)) {
            const id = child.getAttribute('data-element-id')
            if (id) hitIds.push(id)
          }
        })
        canvas.selectMultiple(hitIds)
        if (canvas.activePanelId !== panelId) {
          canvas.setActivePanel(panelId)
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[hiprint-v3:selection] lasso end handler threw:', err)
    } finally {
      if (lasso && lasso.parentNode) {
        lasso.parentNode.removeChild(lasso)
      }
      lasso = null
    }
  }

  panelEl.addEventListener('pointerdown', onPointerDown)

  return () => {
    panelEl.removeEventListener('pointerdown', onPointerDown)
    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', onPointerUp)
    document.removeEventListener('pointercancel', onPointerUp)
    if (lasso && lasso.parentNode) {
      lasso.parentNode.removeChild(lasso)
    }
    lasso = null
    active = false
  }
}

// -----------------------------------------------------------------------------
// enableSelectionShortcuts
// -----------------------------------------------------------------------------

/**
 * Bind window-level Ctrl+A (select-all in active panel) + Escape (clear).
 * Returns cleanup.
 */
export function enableSelectionShortcuts(): () => void {
  // Capture canvas store at enable-time (multi-designer Pinia fix — same
  // rationale as enableElementSelection). Global keydown fires regardless of
  // which designer is "active" in the Vue sense, but the captured store keeps
  // each shortcut binding scoped to the designer that installed it.
  const canvas = useCanvasStore()

  function handler(e: KeyboardEvent): void {
    try {
      if (isEditableTarget(e.target)) return

      // Ctrl/Cmd + A → select all in active panel.
      if (
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
        !e.altKey &&
        (e.key === 'a' || e.key === 'A')
      ) {
        const ids = canvas.activePanel?.printElements.map((el) => el.id) ?? []
        if (ids.length > 0) {
          canvas.selectMultiple(ids)
          e.preventDefault()
        }
        return
      }

      // Escape → clear selection.
      if (e.key === 'Escape') {
        if (canvas.selectedElementIds.size > 0) {
          canvas.clearSelection()
          // Don't preventDefault — Escape may close other UI too.
        }
        return
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[hiprint-v3:selection] shortcut handler threw:', err)
    }
  }

  window.addEventListener('keydown', handler)
  return () => {
    window.removeEventListener('keydown', handler)
  }
}
