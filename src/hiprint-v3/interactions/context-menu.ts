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
import {
  useCanvasStore,
  useHistoryStore,
  insertTableColumn,
  removeTableColumn,
  setTableColspan,
  setTableRowspan,
} from '@hiprint-v3/stores'
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
      // TKT-253: ensure z-index is set from initial render — even before
      // computePosition resolves the menu is already in the correct stacking
      // tier in case anything inspects it synchronously after mount.
      zIndex: String(CONTEXT_MENU_Z_INDEX),
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
          // TKT-253: pin z-index 10000 so the menu always stacks above
          // ant-design Modal / Popover / Drawer (default 1000-1030).
          zIndex: String(CONTEXT_MENU_Z_INDEX),
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
          zIndex: String(CONTEXT_MENU_Z_INDEX),
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
              // TKT-250 — co-emit BEM `.is-disabled` AND V1 legacy `.disabled`
              // so business CSS keyed to either selector still applies (V1
              // inventory §1.10 line 200 used `.hiprint-ctx-menu-item.disabled`).
              item.disabled ? 'is-disabled' : null,
              item.disabled ? 'disabled' : null,
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
/**
 * TKT-253 — V1 parity: V1 set the context menu z-index to 10000 so it always
 * stacked above ant-design Modal (z=1000), Popover (z=1030), and other
 * overlays. V3's @floating-ui/vue body-portal otherwise relies on natural
 * stacking order and silently goes UNDER modals.
 *
 * We pin both the portal root AND the inner menu via inline style so neither
 * a host stylesheet nor scoped CSS specificity can knock it back down.
 */
const CONTEXT_MENU_Z_INDEX = 10000

export function openContextMenu(
  anchorPoint: { x: number; y: number },
  options: ContextMenuOptions
): ContextMenuController {
  const portal = document.createElement('div')
  portal.className = 'hiprint-context-menu-portal'
  // TKT-253: force z-index on the portal root. The menu DOM lives inside; the
  // portal itself is the stacking context anchor — pin both via inline style
  // for defense-in-depth (CSS rule below covers external authors too).
  portal.style.position = 'absolute'
  portal.style.top = '0'
  portal.style.left = '0'
  portal.style.zIndex = String(CONTEXT_MENU_Z_INDEX)
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

  // Sprint 22d TKT-158/159: multi-select align/distribute live here only
  // (V1 inventory `interactions.md` §7.1 Group 5 + `toolbar-and-shell.md`
  // §1.21/§1.22). Visibility is keyed off the CURRENT selection at menu
  // open time (snapshot — same lifecycle as `disabled` flags above).
  const selectedCount = canvas.selectedElementIds.size

  // Sprint 22d TKT-159: text/longText etype-specific items
  // (V1 inventory `etypes/text-longtext.md` §G + §J.8). Detect via
  // printElementType.type on the right-clicked element.
  const etype = (lockedEl?.printElementType?.type as string | undefined) ?? ''
  const isTextEtype = etype === 'text' || etype === 'longText'

  const items: ContextMenuItem[] = [
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
    {
      // Sprint 22d TKT-159: "上移一层" / "下移一层" — V1 inventory
      // §text-longtext.md G line 11509-11522 (per-element zIndex shift).
      // Available for all etypes (V1 has no etype gating for layer ops).
      id: 'bring-forward',
      label: i18n.__('上移一层') || 'Bring Forward',
      onClick: () => _bringForward(canvas, elementId, history),
    },
    {
      id: 'send-backward',
      label: i18n.__('下移一层') || 'Send Backward',
      onClick: () => _sendBackward(canvas, elementId, history),
    },
    { id: 'sep-move', label: '', divider: true },
    // Sprint 22d TKT-159: 4 directional ±1pt move items (all etypes).
    // Matches arrow-key nudge in `keyboard.ts` (`moveStep = 1`).
    {
      id: 'move-up',
      label: i18n.__('向上') || 'Up 1pt',
      onClick: () => _moveSelectionOrElement(canvas, history, elementId, 0, -1),
    },
    {
      id: 'move-down',
      label: i18n.__('向下') || 'Down 1pt',
      onClick: () => _moveSelectionOrElement(canvas, history, elementId, 0, 1),
    },
    {
      id: 'move-left',
      label: i18n.__('向左') || 'Left 1pt',
      onClick: () => _moveSelectionOrElement(canvas, history, elementId, -1, 0),
    },
    {
      id: 'move-right',
      label: i18n.__('向右') || 'Right 1pt',
      onClick: () => _moveSelectionOrElement(canvas, history, elementId, 1, 0),
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
  ]

  // Sprint 22d TKT-159: text / longText etype-specific items
  // (V1 inventory etypes/text-longtext.md §G lines 11469-11483 + §J.8).
  // Hardcoded fontSize=12 and fontWeight='bolder' per V1.
  if (isTextEtype) {
    items.push({ id: 'sep-text', label: '', divider: true })
    items.push({
      id: 'text-font-12pt',
      label: i18n.__('字体 12pt') || 'Font 12pt',
      onClick: () => _setFontSize12(canvas, elementId, history),
    })
    items.push({
      id: 'text-font-bold',
      label: i18n.__('字体加粗') || 'Bold',
      onClick: () => _toggleBold(canvas, elementId, history),
    })
    items.push({
      id: 'text-set-color',
      label: i18n.__('设置颜色') || 'Color',
      // Color picker delegated to caller via opts.onSelect — opening a native
      // `<input type=color>` from a menu pick requires a DOM activation token
      // that the menu pick already consumed. Caller (HiprintCanvas) opens the
      // color picker imperatively in response to this item id.
    })
  }

  // Sprint 22d TKT-158/159: width / height broadcast — V1 inventory §G lines
  // 11568-11592. Apply first selected element's width/height to all others.
  // Requires ≥2 selected.
  if (selectedCount >= 2) {
    items.push({ id: 'sep-size', label: '', divider: true })
    items.push({
      id: 'size-same-width',
      label: i18n.__('宽度统一') || 'Same Width',
      onClick: () => _broadcastDimension(canvas, history, 'width'),
    })
    items.push({
      id: 'size-same-height',
      label: i18n.__('高度统一') || 'Same Height',
      onClick: () => _broadcastDimension(canvas, history, 'height'),
    })
  }

  // Sprint 22d TKT-158: alignment group — V1 inventory §G lines 11542-11592.
  // Visible only when ≥2 elements selected (matches V1 line 11542).
  if (selectedCount >= 2) {
    items.push({ id: 'sep-align', label: '', divider: true })
    items.push({
      id: 'align-left',
      label: i18n.__('左对齐') || 'Align Left',
      onClick: () => _alignSelection(canvas, history, 'left'),
    })
    items.push({
      id: 'align-center',
      label: i18n.__('水平居中') || 'Align Center (H)',
      onClick: () => _alignSelection(canvas, history, 'center'),
    })
    items.push({
      id: 'align-right',
      label: i18n.__('右对齐') || 'Align Right',
      onClick: () => _alignSelection(canvas, history, 'right'),
    })
    items.push({
      id: 'align-top',
      label: i18n.__('顶对齐') || 'Align Top',
      onClick: () => _alignSelection(canvas, history, 'top'),
    })
    items.push({
      id: 'align-middle',
      label: i18n.__('垂直居中') || 'Align Middle (V)',
      onClick: () => _alignSelection(canvas, history, 'middle'),
    })
    items.push({
      id: 'align-bottom',
      label: i18n.__('底对齐') || 'Align Bottom',
      onClick: () => _alignSelection(canvas, history, 'bottom'),
    })
  }

  // Sprint 22d TKT-158: distribute group — V1 inventory §G lines 11554-11556.
  // Visible only when ≥3 elements selected (V1 requires ≥3 for even spacing).
  if (selectedCount >= 3) {
    items.push({
      id: 'distribute-horizontal',
      label: i18n.__('水平等距') || 'Distribute Horizontally',
      onClick: () => _distributeSelection(canvas, history, 'horizontal'),
    })
    items.push({
      id: 'distribute-vertical',
      label: i18n.__('垂直等距') || 'Distribute Vertically',
      onClick: () => _distributeSelection(canvas, history, 'vertical'),
    })
  }

  items.push({ id: 'sep-2', label: '', divider: true })
  items.push({
    id: 'delete',
    label: i18n.__('删除') || 'Delete',
    shortcut: 'Delete',
    // TKT-027: per V1 inventory §7.3 + §8.3, contextmenu delete respects
    // the catch-all `lock` (same as keyboard). positionLocked alone does
    // NOT block delete (V1 quirk preserved).
    disabled: fullyLocked,
    onClick: () => _deleteElement(canvas, elementId, history),
  })
  items.push({ id: 'sep-3', label: '', divider: true })
  items.push({
    id: 'properties',
    label: i18n.__('属性') || 'Properties',
    // Properties is a no-op here — caller wires via opts.onSelect to open
    // the property panel. We include it so the menu surface matches V1.
  })

  return items
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

// -----------------------------------------------------------------------------
// Sprint 22d TKT-159: layer-shift +/- 1 (V1 inventory §G lines 11509-11522)
// -----------------------------------------------------------------------------

/**
 * Shift an element's `options.zIndex` up by 1. V1 §G 11509-11515 — pure
 * numeric increment with no max clamp (V1 quirk: stacks unboundedly).
 */
function _bringForward(
  canvas: CanvasStore,
  elementId: string,
  history: HistoryStore
): void {
  const hit = _findElement(canvas, elementId)
  if (!hit) return
  const o = hit.el.options as Record<string, unknown>
  const z = Number(o.zIndex ?? 0)
  canvas.updateElement(hit.panelId, elementId, { options: { zIndex: z + 1 } })
  history.pushSnapshot()
}

/**
 * Shift an element's `options.zIndex` down by 1, clamped at 0.
 * V1 §G 11516-11522 — `Math.max(0, zIndex - 1)`.
 */
function _sendBackward(
  canvas: CanvasStore,
  elementId: string,
  history: HistoryStore
): void {
  const hit = _findElement(canvas, elementId)
  if (!hit) return
  const o = hit.el.options as Record<string, unknown>
  const z = Number(o.zIndex ?? 0)
  canvas.updateElement(hit.panelId, elementId, {
    options: { zIndex: Math.max(0, z - 1) },
  })
  history.pushSnapshot()
}

// -----------------------------------------------------------------------------
// Sprint 22d TKT-159: directional ±1pt move (V1 inventory equivalent to
// arrow-key nudge, surfaced as menu items per V1 §G).
// -----------------------------------------------------------------------------

/**
 * Move every selected element by (dx, dy) pt — or fall back to the single
 * right-clicked element when nothing is selected. Matches arrow-key step
 * (keyboard.ts `moveStep = 1`) and respects position-lock (locked elements
 * are silently skipped, V1 parity).
 */
function _moveSelectionOrElement(
  canvas: CanvasStore,
  history: HistoryStore,
  elementId: string,
  dx: number,
  dy: number
): void {
  const ids =
    canvas.selectedElementIds.size > 0
      ? Array.from(canvas.selectedElementIds)
      : [elementId]
  let mutated = false
  for (const id of ids) {
    const hit = _findElement(canvas, id)
    if (!hit) continue
    const o = hit.el.options as Record<string, unknown>
    // Skip position-locked siblings (V1 parity — same as keyboard nudge).
    if (o.positionLocked === true || o.lock === true) continue
    const left = Number(o.left ?? 0) + dx
    const top = Number(o.top ?? 0) + dy
    canvas.updateElement(hit.panelId, id, { options: { left, top } })
    mutated = true
  }
  if (mutated) history.pushSnapshot()
}

// -----------------------------------------------------------------------------
// Sprint 22d TKT-159: width / height broadcast (V1 §G lines 11568-11592)
// -----------------------------------------------------------------------------

/**
 * Apply the FIRST selected element's `width` (or `height`) to every other
 * selected element. V1 §G — "等宽" / "等高" right-click items. Requires ≥2
 * selected (caller gates visibility); no-ops otherwise.
 */
function _broadcastDimension(
  canvas: CanvasStore,
  history: HistoryStore,
  dim: 'width' | 'height'
): void {
  const selected = canvas.selectedElements
  if (selected.length < 2) return
  const first = selected[0]!
  const fo = first.options as Record<string, unknown>
  const value = Number(fo[dim] ?? 0)
  if (!Number.isFinite(value) || value <= 0) return
  let mutated = false
  for (let i = 1; i < selected.length; i++) {
    const el = selected[i]!
    const hit = _findElement(canvas, el.id)
    if (!hit) continue
    const o = hit.el.options as Record<string, unknown>
    // V1 quirk: sizeLocked blocks size mutations.
    if (o.sizeLocked === true || o.lock === true) continue
    canvas.updateElement(hit.panelId, el.id, { options: { [dim]: value } })
    mutated = true
  }
  if (mutated) history.pushSnapshot()
}

// -----------------------------------------------------------------------------
// Sprint 22d TKT-158: multi-select alignment (V1 §G lines 11546-11566)
// -----------------------------------------------------------------------------

type AlignType = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'

/**
 * Align every selected element to one of six anchors derived from the
 * selection bounding box. V1 §G 11546-11566. Requires ≥2 selected (caller
 * gates visibility); no-ops otherwise.
 */
function _alignSelection(
  canvas: CanvasStore,
  history: HistoryStore,
  type: AlignType
): void {
  const selected = canvas.selectedElements
  if (selected.length < 2) return
  const bounds = selected.map((el) => {
    const o = el.options as Record<string, unknown>
    return {
      el,
      left: Number(o.left ?? 0),
      top: Number(o.top ?? 0),
      width: Number(o.width ?? 0),
      height: Number(o.height ?? 0),
    }
  })
  const minLeft = Math.min(...bounds.map((b) => b.left))
  const maxRight = Math.max(...bounds.map((b) => b.left + b.width))
  const minTop = Math.min(...bounds.map((b) => b.top))
  const maxBottom = Math.max(...bounds.map((b) => b.top + b.height))
  const centerX = (minLeft + maxRight) / 2
  const centerY = (minTop + maxBottom) / 2
  let mutated = false
  for (const b of bounds) {
    const hit = _findElement(canvas, b.el.id)
    if (!hit) continue
    const o = hit.el.options as Record<string, unknown>
    if (o.positionLocked === true || o.lock === true) continue
    let nextLeft = b.left
    let nextTop = b.top
    switch (type) {
      case 'left':
        nextLeft = minLeft
        break
      case 'center':
        nextLeft = centerX - b.width / 2
        break
      case 'right':
        nextLeft = maxRight - b.width
        break
      case 'top':
        nextTop = minTop
        break
      case 'middle':
        nextTop = centerY - b.height / 2
        break
      case 'bottom':
        nextTop = maxBottom - b.height
        break
    }
    if (nextLeft === b.left && nextTop === b.top) continue
    canvas.updateElement(hit.panelId, b.el.id, {
      options: { left: nextLeft, top: nextTop },
    })
    mutated = true
  }
  if (mutated) history.pushSnapshot()
}

// -----------------------------------------------------------------------------
// Sprint 22d TKT-158: multi-select distribute (V1 §G lines 11554-11556)
// -----------------------------------------------------------------------------

/**
 * Distribute selected elements evenly along an axis. V1 §G — equal spacing
 * between innermost edges of the bounding box. Requires ≥3 selected (caller
 * gates visibility); no-ops otherwise.
 */
function _distributeSelection(
  canvas: CanvasStore,
  history: HistoryStore,
  direction: 'horizontal' | 'vertical'
): void {
  const selected = canvas.selectedElements
  if (selected.length < 3) return
  const bounds = selected.map((el) => {
    const o = el.options as Record<string, unknown>
    return {
      el,
      left: Number(o.left ?? 0),
      top: Number(o.top ?? 0),
      width: Number(o.width ?? 0),
      height: Number(o.height ?? 0),
    }
  })
  const minLeft = Math.min(...bounds.map((b) => b.left))
  const maxRight = Math.max(...bounds.map((b) => b.left + b.width))
  const minTop = Math.min(...bounds.map((b) => b.top))
  const maxBottom = Math.max(...bounds.map((b) => b.top + b.height))
  let mutated = false
  if (direction === 'horizontal') {
    bounds.sort((a, b) => a.left - b.left)
    const totalW = bounds.reduce((s, b) => s + b.width, 0)
    const gap = (maxRight - minLeft - totalW) / (bounds.length - 1)
    let cursor = (bounds[0]?.left ?? 0) + (bounds[0]?.width ?? 0) + gap
    for (let i = 1; i < bounds.length - 1; i++) {
      const b = bounds[i]!
      const hit = _findElement(canvas, b.el.id)
      if (hit) {
        const o = hit.el.options as Record<string, unknown>
        if (!(o.positionLocked === true || o.lock === true)) {
          canvas.updateElement(hit.panelId, b.el.id, {
            options: { left: cursor, top: b.top },
          })
          mutated = true
        }
      }
      cursor += b.width + gap
    }
  } else {
    bounds.sort((a, b) => a.top - b.top)
    const totalH = bounds.reduce((s, b) => s + b.height, 0)
    const gap = (maxBottom - minTop - totalH) / (bounds.length - 1)
    let cursor = (bounds[0]?.top ?? 0) + (bounds[0]?.height ?? 0) + gap
    for (let i = 1; i < bounds.length - 1; i++) {
      const b = bounds[i]!
      const hit = _findElement(canvas, b.el.id)
      if (hit) {
        const o = hit.el.options as Record<string, unknown>
        if (!(o.positionLocked === true || o.lock === true)) {
          canvas.updateElement(hit.panelId, b.el.id, {
            options: { left: b.left, top: cursor },
          })
          mutated = true
        }
      }
      cursor += b.height + gap
    }
  }
  if (mutated) history.pushSnapshot()
}

// -----------------------------------------------------------------------------
// Sprint 22d TKT-159: text / longText etype-specific actions
// (V1 inventory etypes/text-longtext.md §G lines 11469-11483 + §J.8)
// -----------------------------------------------------------------------------

/**
 * Hardcode `fontSize = 12` on the selection (or the right-clicked element
 * when no selection). V1 §G 11469-11475 + §J.8 — value is hardcoded to 12,
 * no UI for picking a custom value via this menu item.
 */
function _setFontSize12(
  canvas: CanvasStore,
  elementId: string,
  history: HistoryStore
): void {
  const ids =
    canvas.selectedElementIds.size > 0
      ? Array.from(canvas.selectedElementIds)
      : [elementId]
  let mutated = false
  for (const id of ids) {
    const hit = _findElement(canvas, id)
    if (!hit) continue
    canvas.updateElement(hit.panelId, id, { options: { fontSize: 12 } })
    mutated = true
  }
  if (mutated) history.pushSnapshot()
}

/**
 * Toggle `fontWeight` between `'bolder'` (V1 default per §J.8) and
 * `'normal'`. V1 §G 11477-11483 always SET 'bolder' — no toggle in V1.
 * V3 improves UX by toggling: same item un-bolds an already-bold element.
 */
function _toggleBold(
  canvas: CanvasStore,
  elementId: string,
  history: HistoryStore
): void {
  const ids =
    canvas.selectedElementIds.size > 0
      ? Array.from(canvas.selectedElementIds)
      : [elementId]
  let mutated = false
  for (const id of ids) {
    const hit = _findElement(canvas, id)
    if (!hit) continue
    const o = hit.el.options as Record<string, unknown>
    const cur = String(o.fontWeight ?? '')
    const next = cur === 'bolder' || cur === 'bold' ? 'normal' : 'bolder'
    canvas.updateElement(hit.panelId, id, { options: { fontWeight: next } })
    mutated = true
  }
  if (mutated) history.pushSnapshot()
}

// -----------------------------------------------------------------------------
// Public: buildTableColumnContextItems (TKT-107)
// -----------------------------------------------------------------------------

/**
 * Build the V1-faithful table thead context menu for the cell at
 * `(layerIdx, columnIdx)` of the table element `elementId`.
 *
 * Items mirror V1's `HiTable.initContext` (bundle 7200-7329, V1-INVENTORY §J.2)
 * for the COLUMN-LEVEL actions only — row-level entries (insertRow above/below,
 * deleteRow) are excluded for now because row insertion requires a row-merge
 * algorithm we don't have at this layer (the body is data-driven; users insert
 * data rows via the data source, not the UI). The 7 items returned are the
 * subset that mutate `options.columns`:
 *
 *   1. 在左侧插入列   insertTableColumn(layerIdx, columnIdx, 'left')
 *   2. 在右侧插入列   insertTableColumn(layerIdx, columnIdx, 'right')
 *   3. 删除列         removeTableColumn(layerIdx, columnIdx)
 *   4. 合并到右侧     setTableColspan(layerIdx, columnIdx, current + 1)
 *   5. 增加行跨度     setTableRowspan(layerIdx, columnIdx, current + 1)
 *   6. 减少跨度       setTableRowspan(layerIdx, columnIdx, max(1, current - 1))
 *   7. 编辑列属性     no-op handler; caller wires via opts.onSelect (matches
 *                    how the standard "properties" item works in
 *                    buildElementContextItems).
 *
 * The handlers call useCanvasStore()/useHistoryStore() inside table-ops at
 * mutation time so the active pinia is correct under multi-designer (same
 * pattern as buildElementContextItems).
 *
 * V1 quirk preserved (P.9): "right-click only on thead". Body-cell
 * contextmenu does NOT call this helper — the table renderer binds
 * `@contextmenu.prevent` on `<th>` only (TableElement.vue).
 */
function _readCellSpan(
  elementId: string,
  layerIdx: number,
  columnIdx: number,
  key: 'colspan' | 'rowspan'
): number {
  const canvas = useCanvasStore()
  const el = canvas.allElements.find((e) => e.id === elementId)
  if (!el) return 1
  const raw = (el.options as Record<string, unknown>).columns
  let layer: Array<Record<string, unknown>> | undefined
  if (Array.isArray(raw) && Array.isArray(raw[0])) {
    layer = raw[layerIdx] as Array<Record<string, unknown>> | undefined
  } else if (layerIdx === 0) {
    layer = raw as Array<Record<string, unknown>> | undefined
  }
  const cell = layer?.[columnIdx]
  const v = cell?.[key]
  return typeof v === 'number' && v >= 1 ? v : 1
}

export function buildTableColumnContextItems(
  elementId: string,
  layerIdx: number,
  columnIdx: number
): ContextMenuItem[] {
  return [
    {
      id: 'table-insert-col-left',
      label: i18n.__('在左侧插入列') || 'Insert column left',
      onClick: () => insertTableColumn(elementId, layerIdx, columnIdx, 'left'),
    },
    {
      id: 'table-insert-col-right',
      label: i18n.__('在右侧插入列') || 'Insert column right',
      onClick: () => insertTableColumn(elementId, layerIdx, columnIdx, 'right'),
    },
    {
      id: 'table-delete-col',
      label: i18n.__('删除列') || 'Delete column',
      onClick: () => removeTableColumn(elementId, layerIdx, columnIdx),
    },
    { id: 'table-sep-1', label: '', divider: true },
    {
      id: 'table-merge-right',
      label: i18n.__('合并到右侧') || 'Merge with right',
      onClick: () => {
        const cur = _readCellSpan(elementId, layerIdx, columnIdx, 'colspan')
        setTableColspan(elementId, layerIdx, columnIdx, cur + 1)
      },
    },
    {
      id: 'table-rowspan-inc',
      label: i18n.__('增加行跨度') || 'Increase rowspan',
      onClick: () => {
        const cur = _readCellSpan(elementId, layerIdx, columnIdx, 'rowspan')
        setTableRowspan(elementId, layerIdx, columnIdx, cur + 1)
      },
    },
    {
      id: 'table-rowspan-dec',
      label: i18n.__('减少行跨度') || 'Decrease rowspan',
      onClick: () => {
        const cur = _readCellSpan(elementId, layerIdx, columnIdx, 'rowspan')
        setTableRowspan(elementId, layerIdx, columnIdx, Math.max(1, cur - 1))
      },
    },
    { id: 'table-sep-2', label: '', divider: true },
    {
      id: 'table-edit-col',
      // No-op here — caller wires via opts.onSelect (matches the 'properties'
      // pattern in buildElementContextItems). The selection panel will open
      // the column row in TablePropertyPanel.
      label: i18n.__('编辑列属性') || 'Edit column properties',
    },
  ]
}
