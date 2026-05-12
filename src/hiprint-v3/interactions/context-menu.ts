/**
 * context-menu.ts — V3 right-click context menu (jQuery-free).
 *
 * P16.3 (ADR-0011 §V3 modern UI architecture).
 *
 * V1 reference: hiprint.bundle.js used the `hicontextmenu` jQuery plugin for
 * the designer right-click menu (Copy/Paste/Cut/Delete/Properties/...).
 * V3 replaces it with:
 *   - A small inline Vue 3 component rendered to a portal `<div>` mounted on
 *     `document.body` (no v-popper / shadcn dropdown deps).
 *   - `@floating-ui/vue` for placement (computePosition + offset + flip + shift
 *     middleware so the menu always stays on-screen near the click point).
 *
 * Public API:
 *   - openContextMenu(anchorPoint, options) → ContextMenuController
 *   - buildElementContextItems(elementId)  → ContextMenuItem[]
 *
 * Lifecycle:
 *   - Caller obtains a controller; calling `controller.close()` unmounts the
 *     Vue app + removes the portal `<div>`. Closing is idempotent.
 *   - Outside-click / Escape auto-close handlers are installed inside the
 *     component and torn down on unmount.
 *
 * Invariants:
 *   - Only one menu open per controller; opening a new one returns a new
 *     controller (caller decides whether to close the previous).
 *   - All item `onClick` handlers are invoked inside try/catch; exceptions
 *     warn instead of bubbling (P14 R3 pattern). Same applies to `onSelect`.
 *   - Items prop can be a ref/getter — re-evaluated lazily at mount time.
 *     We do NOT re-evaluate continuously while menu is open (V1 parity).
 */

import {
  createApp,
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  toValue,
  type App,
  type MaybeRefOrGetter,
} from 'vue'
import {
  computePosition,
  flip,
  offset,
  shift,
} from '@floating-ui/vue'
import { useCanvasStore, useHistoryStore } from '@hiprint-v3/stores'
import { i18n } from '../internal/i18n'
import {
  findElement as findLockedElement,
  isAnyLocked,
  isFullyLocked,
} from './lock'

// -----------------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------------

export interface ContextMenuItem {
  /** Stable identifier (used as key + passed to `onSelect`). */
  id: string
  /** Display label. Ignored when `divider === true`. */
  label: string
  /** Optional icon name (consumer-defined; emitted as class hook). */
  icon?: string
  /** Display hint, e.g. "Ctrl+C". Optional. */
  shortcut?: string
  /** When true, item renders dimmed + click does nothing. */
  disabled?: boolean
  /** When true, item renders as a divider; `label` ignored. */
  divider?: boolean
  /** Invoked on click (in addition to top-level `onSelect`). */
  onClick?: () => void
}

export interface ContextMenuOptions {
  /** Items shown. Re-evaluated once when menu opens. */
  items: MaybeRefOrGetter<ContextMenuItem[]>
  /** Called when user picks any non-divider, non-disabled item. */
  onSelect?: (item: ContextMenuItem) => void
}

export interface ContextMenuController {
  /** Tear down the menu (idempotent). */
  close(): void
  /** Whether the menu is currently mounted. */
  readonly isOpen: boolean
}

// -----------------------------------------------------------------------------
// Safe callback helper (P14 R3)
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
    console.warn('[hiprint-v3:context-menu] listener threw:', err)
  }
}

// -----------------------------------------------------------------------------
// Inline Vue component
// -----------------------------------------------------------------------------

interface MenuComponentProps {
  items: ContextMenuItem[]
  anchorPoint: { x: number; y: number }
  onPick: (item: ContextMenuItem) => void
  onDismiss: () => void
}

const HiprintContextMenu = defineComponent<MenuComponentProps>({
  name: 'HiprintContextMenu',
  // Use a plain props object so we can avoid generic prop validators.
  // eslint-disable-next-line vue/require-prop-types
  props: ['items', 'anchorPoint', 'onPick', 'onDismiss'] as unknown as undefined,
  setup(props) {
    const rootRef = ref<HTMLElement | null>(null)
    const posStyle = ref<Record<string, string>>({
      position: 'absolute',
      top: '0px',
      left: '0px',
      visibility: 'hidden',
    })

    // Virtual reference element keyed to the anchor coords (floating-ui
    // accepts a getBoundingClientRect()-shaped object).
    const virtualRef = {
      getBoundingClientRect: () => ({
        x: props.anchorPoint.x,
        y: props.anchorPoint.y,
        top: props.anchorPoint.y,
        left: props.anchorPoint.x,
        right: props.anchorPoint.x,
        bottom: props.anchorPoint.y,
        width: 0,
        height: 0,
      }),
    }

    async function place(): Promise<void> {
      const floatingEl = rootRef.value
      if (!floatingEl) return
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { x, y } = await computePosition(virtualRef as any, floatingEl, {
          placement: 'bottom-start',
          strategy: 'absolute',
          middleware: [offset(4), flip(), shift({ padding: 4 })],
        })
        posStyle.value = {
          position: 'absolute',
          top: `${y}px`,
          left: `${x}px`,
          visibility: 'visible',
        }
      } catch (err) {
        // happy-dom may not implement layout APIs; fall back to raw anchor.
        // eslint-disable-next-line no-console
        console.warn('[hiprint-v3:context-menu] computePosition failed:', err)
        posStyle.value = {
          position: 'absolute',
          top: `${props.anchorPoint.y}px`,
          left: `${props.anchorPoint.x}px`,
          visibility: 'visible',
        }
      }
    }

    function onOutsideClick(e: MouseEvent): void {
      const root = rootRef.value
      if (!root) return
      if (e.target instanceof Node && root.contains(e.target)) return
      props.onDismiss()
    }

    function onKeydown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.stopPropagation()
        props.onDismiss()
      }
    }

    onMounted(() => {
      void place()
      // `mousedown` fires before `click`; using it prevents missed dismisses
      // when the user clicks somewhere that swallows the click event.
      document.addEventListener('mousedown', onOutsideClick, true)
      document.addEventListener('keydown', onKeydown, true)
      // Also dismiss on a subsequent contextmenu (right-click somewhere else).
      document.addEventListener('contextmenu', onOutsideClick, true)
    })

    onBeforeUnmount(() => {
      document.removeEventListener('mousedown', onOutsideClick, true)
      document.removeEventListener('keydown', onKeydown, true)
      document.removeEventListener('contextmenu', onOutsideClick, true)
    })

    function pick(item: ContextMenuItem): void {
      if (item.divider || item.disabled) return
      props.onPick(item)
    }

    return () => {
      const children = props.items.map((item, i) => {
        if (item.divider) {
          return h('div', {
            key: `divider-${i}`,
            class: 'hiprint-context-menu-divider',
          })
        }
        return h(
          'div',
          {
            key: item.id,
            class: [
              'hiprint-context-menu-item',
              item.disabled ? 'is-disabled' : null,
              item.icon ? `has-icon icon-${item.icon}` : null,
            ],
            // P14 R3: safeCall via parent (onPick wraps onClick + onSelect).
            onClick: () => pick(item),
          },
          [
            item.icon
              ? h('span', { class: 'hiprint-context-menu-icon' })
              : null,
            // Use .text via raw string (Vue escapes by default) — no XSS path.
            h('span', { class: 'hiprint-context-menu-label' }, item.label),
            item.shortcut
              ? h(
                  'span',
                  { class: 'hiprint-context-menu-shortcut' },
                  item.shortcut
                )
              : null,
          ]
        )
      })

      return h(
        'div',
        {
          ref: rootRef,
          class: 'hiprint-context-menu',
          style: posStyle.value,
          // Prevent native context menu reopening on right-click inside.
          onContextmenu: (e: Event) => e.preventDefault(),
        },
        children
      )
    }
  },
})

// -----------------------------------------------------------------------------
// Public: openContextMenu
// -----------------------------------------------------------------------------

/**
 * Open a context menu anchored to a screen point (e.g. mouse coords).
 * Returns a controller; call `controller.close()` to dismiss.
 */
export function openContextMenu(
  anchorPoint: { x: number; y: number },
  options: ContextMenuOptions
): ContextMenuController {
  const portal = document.createElement('div')
  portal.className = 'hiprint-context-menu-portal'
  document.body.appendChild(portal)

  let app: App | null = null
  let state = { open: true }

  function close(): void {
    if (!state.open) return
    state.open = false
    try {
      app?.unmount()
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[hiprint-v3:context-menu] unmount threw:', err)
    }
    app = null
    if (portal.parentNode) portal.parentNode.removeChild(portal)
  }

  // Snapshot items NOW (V1 parity: items frozen at open time).
  const items = toValue(options.items) ?? []

  app = createApp(HiprintContextMenu, {
    items,
    anchorPoint,
    onPick: (item: ContextMenuItem) => {
      safeCall(item.onClick)
      safeCall(options.onSelect, item)
      close()
    },
    onDismiss: () => close(),
  })

  try {
    app.mount(portal)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[hiprint-v3:context-menu] mount threw:', err)
    close()
  }

  return {
    close,
    get isOpen() {
      return state.open
    },
  }
}

// -----------------------------------------------------------------------------
// Public: buildElementContextItems
// -----------------------------------------------------------------------------

/**
 * Build the canonical element context menu (Copy/Paste/Cut/Delete/Bring
 * to Front/Send to Back/Properties). Handlers dispatch to canvas store.
 *
 * Internal element-clipboard: stored module-level so paste reuses copied
 * element JSON. (Cross-window clipboard is delegated to keyboard module's
 * own clipboard; this menu shares its source via copy/cut wiring.)
 *
 * IMPORTANT: the items returned are detached from any reactive context — the
 * caller chooses when to re-evaluate (e.g. open right-click). The handlers
 * each re-read canvas store at click time, so menu state stays fresh even
 * if the user changed selection between right-click and item click.
 */
export function buildElementContextItems(
  elementId: string
): ContextMenuItem[] {
  // Capture the canvas store ONCE here, at factory call time.
  //
  // Multi-designer Pinia fix (2026-05-11): buildElementContextItems is invoked
  // from HiprintCanvas.vue's contextmenu handler, which runs inside the
  // designer's Vue setup/event context — at that moment the active pinia is
  // the correct one. The returned items[]'s onClick closures, however, fire
  // later when the user picks a menu entry, by which point another designer
  // may have called setActivePinia(). Capturing once here pins every handler
  // to this designer's store.
  const canvas = useCanvasStore()
  // TKT-020: capture history store at factory time, same rationale as the
  // canvas pin above. Every mutating menu action pushes a snapshot so undo
  // can roll back delete / paste / reorder.
  const history = useHistoryStore()

  // TKT-027: resolve lock state at menu-build time. V1 inventory §7.3 lines
  // 11525-11540 — the lock menu item's label flips based on current state
  // ("锁定元素" vs "解锁元素"). Per V1, contextmenu delete DOES respect the
  // catch-all `lock` (matches the keyboard delete path).
  const lockedEl = findLockedElement(canvas, elementId)
  const fullyLocked = isFullyLocked(lockedEl?.options)
  const anyLocked = isAnyLocked(lockedEl?.options)

  return [
    {
      id: 'copy',
      label: i18n.__('复制') || 'Copy',
      shortcut: 'Ctrl+C',
      // TKT-020: copy is read-only — no history push (V1 parity).
      onClick: () => _copyElement(canvas, elementId),
    },
    {
      id: 'cut',
      label: i18n.__('剪切') || 'Cut',
      shortcut: 'Ctrl+X',
      // TKT-027: cut = copy + delete; if fully locked we cannot delete →
      // disable. Position-lock alone does NOT disable (V1 quirk: lock granular
      // fields don't block delete).
      disabled: fullyLocked,
      onClick: () => _cutElement(canvas, elementId, history),
    },
    {
      id: 'paste',
      label: i18n.__('粘贴') || 'Paste',
      shortcut: 'Ctrl+V',
      onClick: () => _pasteElement(canvas, history),
    },
    { id: 'sep-1', label: '', divider: true },
    {
      id: 'bring-to-front',
      label: i18n.__('置顶') || 'Bring to Front',
      onClick: () => _bringToFront(canvas, elementId, history),
    },
    {
      id: 'send-to-back',
      label: i18n.__('置底') || 'Send to Back',
      onClick: () => _sendToBack(canvas, elementId, history),
    },
    { id: 'sep-lock', label: '', divider: true },
    {
      // TKT-027: Lock/Unlock toggle. V1 inventory §H.1 line 11533 — lock
      // sets BOTH positionLocked + sizeLocked; unlock clears positionLocked
      // only (V1 retains sizeLocked — quirk preserved). We deliberately do
      // NOT touch the catch-all `lock` field: that's reserved for
      // template-author intent and round-trips with V1 templates.
      id: anyLocked ? 'unlock' : 'lock',
      label: anyLocked
        ? i18n.__('解锁元素') || 'Unlock'
        : i18n.__('锁定元素') || 'Lock',
      icon: anyLocked ? 'unlock' : 'lock',
      onClick: () => _toggleLock(canvas, elementId, history),
    },
    { id: 'sep-2', label: '', divider: true },
    {
      id: 'delete',
      label: i18n.__('删除') || 'Delete',
      shortcut: 'Delete',
      // TKT-027: per V1 inventory §7.3 + §8.3, contextmenu delete respects
      // the catch-all `lock` (same as keyboard). positionLocked alone does
      // NOT block delete (V1 quirk preserved).
      disabled: fullyLocked,
      onClick: () => _deleteElement(canvas, elementId, history),
    },
    { id: 'sep-3', label: '', divider: true },
    {
      id: 'properties',
      label: i18n.__('属性') || 'Properties',
      // Properties is a no-op here — caller wires via opts.onSelect to open
      // the property panel. We include it so the menu surface matches V1.
    },
  ]
}

// -----------------------------------------------------------------------------
// Element-clipboard (shared with keyboard.ts intentionally via getter/setter)
// -----------------------------------------------------------------------------

import type { CanvasElement } from '@hiprint-v3/stores'

/** Internal clipboard. Module-level so context-menu + keyboard share it. */
let _clipboard: CanvasElement[] = []

/** @internal — for tests / keyboard.ts integration. */
export function _setClipboard(els: CanvasElement[]): void {
  _clipboard = els.map((e) => ({ ...e, options: { ...e.options } }))
}

/** @internal — for tests / keyboard.ts integration. */
export function _getClipboard(): CanvasElement[] {
  return _clipboard.map((e) => ({ ...e, options: { ...e.options } }))
}

// Captured store type alias — keep typed without leaking internal store types.
type CanvasStore = ReturnType<typeof useCanvasStore>
// TKT-020: history store typed the same way so internal helpers can accept it
// without exporting the Pinia generic surface.
type HistoryStore = ReturnType<typeof useHistoryStore>

function _findElement(
  canvas: CanvasStore,
  elementId: string
): {
  panelId: string
  el: CanvasElement
} | null {
  for (const p of canvas.panels) {
    const el = p.printElements.find((x) => x.id === elementId)
    if (el) return { panelId: p.id, el }
  }
  return null
}

function _copyElement(canvas: CanvasStore, elementId: string): void {
  // TKT-020: read-only — no history push.
  const hit = _findElement(canvas, elementId)
  if (!hit) return
  _setClipboard([hit.el])
}

function _cutElement(
  canvas: CanvasStore,
  elementId: string,
  history: HistoryStore
): void {
  const hit = _findElement(canvas, elementId)
  if (!hit) return
  // TKT-027: cut = copy + delete. If fully locked we still won't delete, so
  // skip the copy too (V1 parity — cut is a single user action). Position-
  // lock alone does NOT block (V1 quirk preserved).
  if (isFullyLocked(hit.el.options)) {
    // eslint-disable-next-line no-console
    console.warn('[hiprint] cannot cut locked element', elementId)
    return
  }
  _setClipboard([hit.el])
  canvas.removeElement(hit.panelId, elementId)
  // TKT-020: cut mutated state → snapshot.
  history.pushSnapshot()
}

function _pasteElement(canvas: CanvasStore, history: HistoryStore): void {
  if (_clipboard.length === 0) return
  const activeId = canvas.activePanelId
  if (!activeId) return
  for (const el of _clipboard) {
    canvas.addElement(activeId, {
      tid: el.tid,
      options: { ...el.options },
      printElementType: el.printElementType,
    })
  }
  // TKT-020: paste added ≥1 element (guarded by _clipboard.length > 0 above)
  // and activePanelId is non-null → guaranteed mutation → snapshot.
  history.pushSnapshot()
}

function _deleteElement(
  canvas: CanvasStore,
  elementId: string,
  history: HistoryStore
): void {
  const hit = _findElement(canvas, elementId)
  if (!hit) return
  // TKT-027: defense-in-depth. The menu item is rendered with `disabled` when
  // fully locked, but a programmatic invocation (custom menu wrapping, e2e
  // misuse) could bypass that. We re-check here so the contract holds.
  // Position-lock alone does NOT block (V1 quirk preserved).
  if (isFullyLocked(hit.el.options)) {
    // eslint-disable-next-line no-console
    console.warn('[hiprint] cannot delete locked element', elementId)
    return
  }
  canvas.removeElement(hit.panelId, elementId)
  // TKT-020: removed exactly one element → snapshot.
  history.pushSnapshot()
}

/**
 * TKT-027: Lock / Unlock toggle. V1 inventory §7.3 line 11525-11540 + §H.1:
 *
 *   - On LOCK: set BOTH `positionLocked = true` AND `sizeLocked = true`.
 *   - On UNLOCK: clear `positionLocked` (V1 retains `sizeLocked` — quirk).
 *
 * We deliberately do NOT touch the catch-all `lock` field: that's reserved
 * for templates that ship pre-locked via JSON; the interactive toggle uses
 * the granular fields so V1-saved templates round-trip cleanly.
 */
function _toggleLock(
  canvas: CanvasStore,
  elementId: string,
  history: HistoryStore
): void {
  const hit = _findElement(canvas, elementId)
  if (!hit) return
  const currentlyLocked = isAnyLocked(hit.el.options)
  if (currentlyLocked) {
    // Unlock — clear positionLocked; sizeLocked retained per V1.
    canvas.updateElement(hit.panelId, elementId, {
      options: { positionLocked: false },
    })
  } else {
    canvas.updateElement(hit.panelId, elementId, {
      options: { positionLocked: true, sizeLocked: true },
    })
  }
  history.pushSnapshot()
}

function _bringToFront(
  canvas: CanvasStore,
  elementId: string,
  history: HistoryStore
): void {
  const hit = _findElement(canvas, elementId)
  if (!hit) return
  const panel = canvas.panels.find((p) => p.id === hit.panelId)
  if (!panel) return
  // Reorder: move element to end of printElements array.
  const idx = panel.printElements.findIndex((e) => e.id === elementId)
  if (idx < 0 || idx === panel.printElements.length - 1) return
  const next = panel.printElements.slice()
  const [moved] = next.splice(idx, 1)
  if (!moved) return
  next.push(moved)
  // Use updateElement on each shifted element to trigger reactivity via the
  // store's immutable patch path. Simpler: replace panels directly.
  const pIdx = canvas.panels.findIndex((p) => p.id === hit.panelId)
  if (pIdx < 0) return
  const nextPanels = canvas.panels.slice()
  nextPanels[pIdx] = { ...panel, printElements: next }
  // canvas.panels is reactive via Pinia; direct assignment triggers diff.
  canvas.panels = nextPanels
  // TKT-020: z-order changed → snapshot. (Early-returns above guarantee that
  // reaching this line means the array actually shifted.)
  history.pushSnapshot()
}

function _sendToBack(
  canvas: CanvasStore,
  elementId: string,
  history: HistoryStore
): void {
  const hit = _findElement(canvas, elementId)
  if (!hit) return
  const panel = canvas.panels.find((p) => p.id === hit.panelId)
  if (!panel) return
  const idx = panel.printElements.findIndex((e) => e.id === elementId)
  if (idx <= 0) return
  const next = panel.printElements.slice()
  const [moved] = next.splice(idx, 1)
  if (!moved) return
  next.unshift(moved)
  const pIdx = canvas.panels.findIndex((p) => p.id === hit.panelId)
  if (pIdx < 0) return
  const nextPanels = canvas.panels.slice()
  nextPanels[pIdx] = { ...panel, printElements: next }
  canvas.panels = nextPanels
  // TKT-020: z-order changed → snapshot.
  history.pushSnapshot()
}
