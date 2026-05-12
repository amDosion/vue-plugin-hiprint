/**
 * src/hiprint-v3/interactions/drag-drop.ts — V3 drag/drop interaction layer.
 *
 * Replaces V1/V2 jQuery UI .draggable() / .droppable() with interact.js
 * (1.10.27). Completely jQuery-free.
 *
 * Three primary surfaces:
 *  1. {@link enableElementDrag}         — drag an element ON canvas (move).
 *  2. {@link enableElementListSource}   — drag from sidebar item INTO canvas.
 *  3. {@link enablePanelDropZone}       — panel surface accepts drops.
 *
 * Cleanup: {@link disableInteractions} on the element. Components MUST call
 * this on unmount or interact.js will hold a reference to the element +
 * registered listeners (memory leak).
 *
 * Multi-select drag (P14.7 selection + this module):
 *  - On dragstart, we read `useCanvasStore().selectedElementIds`.
 *  - If the dragged element is part of the selection → ALL selected elements
 *    move together via `canvas.moveSelection(dx, dy)`.
 *  - Otherwise single-element move via `canvas.updateElement(panelId, id,
 *    { options: { left, top } })`.
 *
 * Cross-panel drop (V3 differentiation):
 *  - {@link enablePanelDropZone} registers a dropzone on each panel root.
 *  - On `ondrop`, if the dragged element's `data-panel-id` differs from the
 *    zone's panelId → call `canvas.moveElementBetweenPanels()`.
 *
 * Units:
 *  - interact.js delivers deltas in screen px.
 *  - We convert to pt via `px.toPt()` from internal/uom before patching the
 *    canvas store (canvas store options.left/top are pt).
 *  - Scale: canvas store has `scale` (zoom). The dx/dy from interact.js are
 *    in display px AT THE CURRENT ZOOM. So actual pt delta is
 *    `px.toPt(dx / scale)`.
 *
 * Snap: caller passes `gridSize` (pt). We translate to a px grid via
 * `pt.toPx(gridSize) * scale` before handing to interact.js modifiers.
 *
 * NOTE on data-* attributes: panel dropzones use CSS selector `.hiprint-element`
 * to filter accepted drags. Element roots MUST carry that class + a
 * `data-panel-id` attribute for cross-panel detection to work. We do NOT
 * mutate the element here — that's the component's responsibility.
 */

import interact from 'interactjs'
import type { Interactable } from '@interactjs/types'

// interact.js Modifier type lives inside a namespace and isn't re-exported
// from @interactjs/types in a way we can import directly. The shape is
// validated at runtime by interact.js itself; our buildModifiers call site
// passes objects produced by interact.modifiers.snap()/restrict() which are
// well-typed at point of construction.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InteractModifier = any
import { useCanvasStore, useHistoryStore } from '@hiprint-v3/stores'
import { pt, px } from '@hiprint-v3/internal'
import { isPositionLocked, findElement } from './lock'
import {
  boxFromElement,
  computeSnap,
  setSmartGuidePreviews,
  clearSmartGuidePreviews,
  SMART_GUIDE_SNAP_PT,
} from './smart-guides'
import type {
  ElementDragOptions,
  ElementListSourceOptions,
  Position,
} from './types'

// ============ Registration tracking ============

/**
 * Track Interactable handles per element so {@link disableInteractions} can
 * safely tear down. Using WeakMap so GC reclaims when element is removed.
 */
const _registry = new WeakMap<HTMLElement, Interactable>()

// ============ Internal helpers ============

/**
 * Convert px delta (screen, at current zoom) to pt delta (canvas store space).
 */
function screenPxToPt(deltaPx: number, scale: number): number {
  const safeScale = scale > 0 ? scale : 1
  return px.toPt(deltaPx / safeScale)
}

/**
 * Build interact.js modifiers from our option shape.
 *
 * Snap: convert pt gridSize → px (at current scale) for interact.js.
 * Restrict: keep drag inside the closest ancestor with class `.hiprint-panel`
 * (visual cue; final clamp also happens in updateElement caller).
 */
function buildModifiers(
  gridSize: number | undefined,
  scale: number
): InteractModifier[] {
  const mods: InteractModifier[] = []
  if (gridSize && gridSize > 0) {
    const stepPx = pt.toPx(gridSize) * (scale > 0 ? scale : 1)
    mods.push(
      interact.modifiers.snap({
        targets: [interact.snappers.grid({ x: stepPx, y: stepPx })],
        range: Infinity,
        relativePoints: [{ x: 0, y: 0 }],
      })
    )
  }
  return mods
}

// ============ Public API ============

/**
 * Enable on-canvas element drag.
 *
 * Wires interact.js draggable + multi-select dispatch + snap-to-grid.
 *
 * @param el  Element root (must be absolutely-positioned + carry
 *            `data-element-id` and `data-panel-id`).
 * @param opts See {@link ElementDragOptions}.
 */
export function enableElementDrag(
  el: HTMLElement,
  opts: ElementDragOptions
): void {
  if (!el) {
    console.warn('[hiprint] enableElementDrag: el is required')
    return
  }
  if (!opts || !opts.elementId || !opts.panelId) {
    console.warn(
      '[hiprint] enableElementDrag: opts.elementId + opts.panelId required'
    )
    return
  }

  // Capture the canvas store at enable-time. interact.js callbacks fire
  // asynchronously (after enable() returns), at which point the *active*
  // Pinia instance may have changed (e.g. another <HiprintDesigner> mounted
  // and replaced active pinia). Reusing the captured store reference is
  // safe because Pinia stores are stable singletons per pinia instance —
  // mutating actions still run inside the correct pinia, and reactive reads
  // return the current value of THIS designer's state.
  //
  // BUG fixed (2026-05-11): previously each callback re-called useCanvasStore()
  // which read whatever pinia was active AT CALLBACK TIME, causing multi-
  // designer apps to mutate the wrong store (panels not found / moves silently
  // dropped). Confirmed via dev-server manual test ("组件拖动到画布都不能正常").
  const canvas = useCanvasStore()
  // TKT-020: history-store capture for auto-snapshot on drag-end. Mirrors the
  // multi-designer pinia-pin pattern above so undo/redo binds to the designer
  // that owns this draggable, not whichever pinia happens to be active when
  // the drag ends.
  const history = useHistoryStore()

  // Track totals across the full drag so onEnd can deliver final pos.
  let dragStartPosPt: Position = { x: 0, y: 0 }
  let isMultiDrag = false
  // TKT-020: detect actual movement so we don't push a snapshot for a "click
  // that registered as drag" (interact.js fires start/end with no move calls
  // when the pointer barely jitters). Without this guard we'd flood the
  // 50-entry capacity from harmless clicks.
  let didMove = false
  // TKT-027: capture lock state at drag START so subsequent move/end calls
  // can short-circuit. We re-read from the store on every start (NOT at
  // registration time) so runtime lock toggles (e.g. context-menu "Lock"
  // command) take effect immediately without re-registering interact.js.
  let lockedAtStart = false

  const interactable = interact(el).draggable({
    inertia: false,
    listeners: {
      start: (event: { interaction?: { stop?: () => void } } | undefined) => {
        try {
          // TKT-027 lock gate. Per V1 inventory §8.2 / per-etype Section H:
          // options.lock || options.positionLocked || options.draggable===false
          // → element cannot be moved. We re-check on every start so runtime
          // lock toggles take effect without re-registering interact.js.
          const lockedEl = findElement(canvas, opts.elementId)
          lockedAtStart = isPositionLocked(lockedEl?.options)
          if (lockedAtStart) {
            // Best-effort cancel: ask interact.js to stop the in-flight
            // interaction so move/end don't fire. (interact.js may not honor
            // stop() inside start; the move/end handlers also re-check
            // `lockedAtStart` to be safe.)
            try {
              event?.interaction?.stop?.()
            } catch {
              /* interact internals — best-effort only */
            }
            return
          }
          // Cache start position (pt) so onEnd can compute absolute pos.
          // Pull from store rather than DOM to avoid measurement drift.
          const panel = canvas.panels.find((p) => p.id === opts.panelId)
          const elRec = panel?.printElements.find(
            (e) => e.id === opts.elementId
          )
          const o = (elRec?.options as Record<string, unknown>) ?? {}
          dragStartPosPt = {
            x: Number(o.left ?? 0),
            y: Number(o.top ?? 0),
          }
          // Capture multi-select state at drag START (don't re-check per move).
          isMultiDrag =
            canvas.selectedElementIds.size > 1 &&
            canvas.selectedElementIds.has(opts.elementId)
          // TKT-020: reset movement flag — only flips true when `move` fires.
          didMove = false
          // TKT-104: notify caller drag has begun (overlay flips to drag mode).
          if (opts.onStart) opts.onStart()
        } catch (err) {
          console.warn('[hiprint] enableElementDrag start handler threw:', err)
        }
      },

      move: (event: { dx: number; dy: number; altKey?: boolean }) => {
        // TKT-027: if drag started on a locked element, ignore move events.
        // V1 parity — locked elements are immovable.
        if (lockedAtStart) return
        try {
          const scale = canvas.scale
          const dxPt = screenPxToPt(event.dx, scale)
          const dyPt = screenPxToPt(event.dy, scale)
          // TKT-020: any non-zero pt delta counts as movement. We track in pt
          // (post-scale) so micro-jitters at high zoom that round to 0 pt also
          // skip the snapshot.
          if (dxPt !== 0 || dyPt !== 0) didMove = true

          // TKT-103: Alt held → disable smart-guide snap (V1 parity).
          const altHeld = !!event.altKey
          const snapThreshold = altHeld ? 0 : SMART_GUIDE_SNAP_PT

          if (isMultiDrag) {
            // Multi-select: move ALL selected elements together. Smart-guide
            // snap not applied — V1 also disables alignment lines during
            // multi-select drag (one anchor per N elements is ambiguous).
            canvas.moveSelection(dxPt, dyPt)
            // Clear any stale single-drag previews so they don't linger.
            clearSmartGuidePreviews()
          } else {
            // Single: compute proposed pt position from store + delta, then
            // run smart-guide snap before patching.
            const panel = canvas.panels.find((p) => p.id === opts.panelId)
            const elRec = panel?.printElements.find(
              (e) => e.id === opts.elementId
            )
            if (!elRec || !panel) {
              // Element gone (race with delete) — bail without store update.
              if (opts.onMove) opts.onMove({ x: dxPt, y: dyPt })
              return
            }
            const dragBox = boxFromElement(elRec)
            const proposed = {
              left: dragBox.left + dxPt,
              top: dragBox.top + dyPt,
              width: dragBox.width,
              height: dragBox.height,
            }
            const others = panel.printElements
              .filter((e) => e.id !== opts.elementId)
              .map((e) => boxFromElement(e))
            const snap = computeSnap({
              box: proposed,
              others,
              guides: canvas.guideLines,
              threshold: snapThreshold,
              // gridSize already handled by interact.js modifier on dx/dy
              // (buildModifiers below). Pass 0 here to skip double-snap.
              gridSize: 0,
            })
            canvas.updateElement(opts.panelId, opts.elementId, {
              options: { left: snap.left, top: snap.top },
            })
            setSmartGuidePreviews(snap.previews)
          }

          if (opts.onMove) {
            // Caller wants raw delta this frame.
            opts.onMove({ x: dxPt, y: dyPt })
          }
        } catch (err) {
          console.warn('[hiprint] enableElementDrag move handler threw:', err)
        }
      },

      end: () => {
        // TKT-027: locked drags never reach onMove (move is short-circuited),
        // so there's no state change to commit and no history snapshot to
        // push. Reset the flag so the next gesture starts fresh.
        if (lockedAtStart) {
          lockedAtStart = false
          return
        }
        // TKT-103: always clear smart-guide previews on drag-end so no stale
        // dashed lines remain on the canvas regardless of how the gesture ended.
        clearSmartGuidePreviews()
        try {
          if (opts.onEnd) {
            const panel = canvas.panels.find((p) => p.id === opts.panelId)
            const elRec = panel?.printElements.find(
              (e) => e.id === opts.elementId
            )
            const o = (elRec?.options as Record<string, unknown>) ?? {}
            opts.onEnd({
              x: Number(o.left ?? dragStartPosPt.x),
              y: Number(o.top ?? dragStartPosPt.y),
            })
          }
          // TKT-020: drag-end snapshot. V1 fires history on every drag commit;
          // we match that, but only when the element actually moved (didMove)
          // so a "drag cancelled before movement" or "click registered as
          // drag" doesn't burn an undo slot.
          if (didMove) {
            history.pushSnapshot()
          }
        } catch (err) {
          console.warn('[hiprint] enableElementDrag end handler threw:', err)
        }
      },
    },
    modifiers: buildModifiers(opts.gridSize, canvas.scale),
  })

  _registry.set(el, interactable)
}

/**
 * Enable an element-list (sidebar) row to act as a drag SOURCE that creates
 * a new element on the canvas when dropped.
 *
 * Drop target detection is done by the matching {@link enablePanelDropZone}
 * call on the panel: on ondrop the dropzone checks `data-tid` to decide
 * whether to create a new element.
 *
 * @param el   The sidebar row element. Must carry `data-tid`.
 * @param opts See {@link ElementListSourceOptions}.
 */
export function enableElementListSource(
  el: HTMLElement,
  opts: ElementListSourceOptions
): void {
  if (!el) {
    console.warn('[hiprint] enableElementListSource: el is required')
    return
  }
  if (!opts || !opts.tid) {
    console.warn('[hiprint] enableElementListSource: opts.tid is required')
    return
  }

  // Mark the element so panel dropzones can identify list-source drags.
  el.classList.add('hiprint-list-source')
  el.setAttribute('data-tid', opts.tid)
  if (opts.createElement) {
    // Stash the factory on the element so dropzone can find it without
    // re-resolving registries. We use a Symbol on the DOM element via a side
    // map (avoids polluting element).
    _factoryByEl.set(el, opts.createElement)
  }

  // Cursor-following clone helper. Without this, interact.js does not move
  // the source element with the pointer — it stays in the sidebar, so the
  // panel dropzone never sees ANY overlap (overlap: 'pointer' below uses
  // pointer position, which IS the cursor). The clone is the V1/V2 jQuery UI
  // `helper: 'clone'` equivalent — gives user a draggable visual to follow
  // the cursor; we destroy it at drag end.
  let cloneEl: HTMLElement | null = null

  const interactable = interact(el).draggable({
    inertia: false,
    listeners: {
      start: (event: { clientX0?: number; clientY0?: number }) => {
        el.classList.add('hiprint-dragging')
        try {
          const startX = typeof event.clientX0 === 'number' ? event.clientX0 : 0
          const startY = typeof event.clientY0 === 'number' ? event.clientY0 : 0
          cloneEl = el.cloneNode(true) as HTMLElement
          cloneEl.classList.add('hiprint-drag-clone')
          // Inline styles so we don't depend on host CSS theming.
          Object.assign(cloneEl.style, {
            position: 'fixed',
            pointerEvents: 'none',
            zIndex: '9999',
            opacity: '0.85',
            left: startX + 'px',
            top: startY + 'px',
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
          } as Partial<CSSStyleDeclaration>)
          document.body.appendChild(cloneEl)
        } catch (err) {
          console.warn('[hiprint] enableElementListSource: clone start failed:', err)
        }
      },
      move: (event: { clientX: number; clientY: number }) => {
        if (!cloneEl) return
        try {
          cloneEl.style.left = event.clientX + 'px'
          cloneEl.style.top = event.clientY + 'px'
        } catch {
          /* ignore */
        }
      },
      end: () => {
        el.classList.remove('hiprint-dragging')
        try {
          if (cloneEl && cloneEl.parentNode) {
            cloneEl.parentNode.removeChild(cloneEl)
          }
        } catch {
          /* ignore */
        }
        cloneEl = null
      },
    },
  })

  _registry.set(el, interactable)
}

/**
 * Factory stash keyed by source element (avoid polluting DOM with closures).
 */
const _factoryByEl = new WeakMap<HTMLElement, () => Record<string, unknown>>()

/**
 * Enable a panel root as a drop zone.
 *
 * Accepts:
 *   - Elements with `.hiprint-element` (existing canvas elements — cross-panel
 *     drop).
 *   - Elements with `.hiprint-list-source` (sidebar items — creates new
 *     element).
 *
 * @param el      Panel root.
 * @param panelId Owning panel id.
 */
export function enablePanelDropZone(el: HTMLElement, panelId: string): void {
  if (!el) {
    console.warn('[hiprint] enablePanelDropZone: el is required')
    return
  }
  if (!panelId) {
    console.warn('[hiprint] enablePanelDropZone: panelId is required')
    return
  }

  // Capture canvas store at enable-time (same multi-designer pinia-bug fix
  // as enableElementDrag). interact.js ondrop fires async; reusing the
  // captured store is safe because Pinia singletons stay stable per pinia
  // instance.
  const canvas = useCanvasStore()
  // TKT-020: history store captured here too — palette drop and cross-panel
  // drop both mutate state and need a snapshot for undo/redo.
  const history = useHistoryStore()

  const interactable = interact(el).dropzone({
    accept: '.hiprint-element, .hiprint-list-source',
    // 'pointer' overlap = drop when CURSOR is inside the zone, not when the
    // draggable element's bbox overlaps. Required for list-source drags
    // because the source button stays in the sidebar (we render a clone
    // following the cursor) — element-bbox overlap would never fire.
    overlap: 'pointer',
    ondrop: (event: { relatedTarget: HTMLElement }) => {
      try {
        const dragged = event.relatedTarget
        if (!dragged) return

        if (dragged.classList.contains('hiprint-list-source')) {
          // New element drop from sidebar.
          const tid = dragged.getAttribute('data-tid') ?? ''
          if (!tid) {
            console.warn(
              '[hiprint] dropzone: list-source missing data-tid; ignored'
            )
            return
          }
          const factory = _factoryByEl.get(dragged)
          const base = factory ? factory() : {}
          canvas.addElement(panelId, {
            tid,
            options: (base.options as Record<string, unknown>) ?? {},
            ...base,
          })
          // TKT-020: palette → canvas creates a new element; push a snapshot
          // so the user can undo a mis-drop.
          history.pushSnapshot()
          return
        }

        // Otherwise: existing element. Check for cross-panel.
        const srcPanelId = dragged.getAttribute('data-panel-id')
        const elementId = dragged.getAttribute('data-element-id')
        if (!srcPanelId || !elementId) {
          // Not enough info to identify — same-panel drag handler already
          // moved the element via enableElementDrag. Nothing to do here.
          return
        }
        if (srcPanelId !== panelId) {
          canvas.moveElementBetweenPanels(srcPanelId, panelId, elementId)
          // TKT-020: cross-panel reparent counts as a discrete edit. Same-panel
          // moves are already snapshotted by enableElementDrag's `end` handler.
          history.pushSnapshot()
        }
        // If srcPanelId === panelId, no-op: same-panel drag already handled
        // by the element's own draggable handler (position patched on move).
      } catch (err) {
        console.warn('[hiprint] enablePanelDropZone ondrop threw:', err)
      }
    },
  })

  _registry.set(el, interactable)
}

/**
 * Tear down all interact.js handlers registered on `el`.
 *
 * Idempotent: safe to call multiple times. Safe to call on elements that
 * were never registered (no-op).
 */
export function disableInteractions(el: HTMLElement): void {
  if (!el) return
  try {
    interact(el).unset()
  } catch (err) {
    console.warn('[hiprint] disableInteractions threw:', err)
  }
  _registry.delete(el)
  _factoryByEl.delete(el)
}

/**
 * Internal: read canvas store scale without throwing when Pinia not active.
 * Used at draggable registration time (may be called before component mount
 * in some test paths).
 */
function _safeScale(): number {
  try {
    return useCanvasStore().scale
  } catch {
    return 1
  }
}
