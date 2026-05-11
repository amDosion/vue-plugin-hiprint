# V1 User-Visible Behavior Inventory: Interaction Layer (etype-agnostic)

**Document Purpose**: Complete catalog of every V1 mouse/keyboard interaction in the designer surface, independent of element type. For each interaction every code path, state transition, modifier-key branch, side-effect, and DOM mutation is enumerated with the exact V1 line(s).

**Last Updated**: 2026-05-11
**V1 Source Bundle**: `src/hiprint/hiprint.bundle.js` (15353 lines)
**V1 Source Plugins**: `src/hiprint/plugins/jquery.hiwprint.js` (119 lines; print-only, no interactions)
**V1 Source Config**: `src/hiprint/hiprint.config.js` (constants: `movingDistance`, `adsorbMin`, `adsorbLineMin`, `showAdsorbLine`, `showPosition`, `positionLineMode`, `positionUnit`, `showSizeBox`)
**Scope**: ALL interactive behaviors at the designer surface level — selection / drag / resize / rotate / lasso / keyboard / clipboard / context menu / inline edit / undo-redo / property-panel binding / palette drag / guide-line drag / paper-line drag / element-list-panel drag.
**Out of Scope**: per-etype rendering (see `etypes/*.md`), toolbar buttons (see `toolbar-and-shell.md`), property-panel field schemas (see `etypes/*` per-etype docs).

---

## Conventions

- `[V1 line N]` cites the exact bundle.js line number.
- Modifier keys: `Ctrl/⌘` means `ctrlKey || metaKey` (V1 unifies them in all keyboard handlers — e.g. `[V1 line 1477]`, `[V1 line 10951]`, `[V1 line 10962]`, `[V1 line 10983]`).
- Coordinate unit: V1 stores `options.left/top/width/height` in **pt**; DOM `left/top` rendered in **pt** via `displayLeft()/displayTop()`. Scale-aware ops divide by `panel.designPaper.scale || 1` `[V1 line 7461]`, `[V1 line 8244]`, `[V1 line 11254]`.
- Selection visual: each element has a `<div panelindex="..." class="resize-panel">` child injected by `hireizeable` `[V1 line 8051]`. "Selected" = the resize-panel child has `.selected` class AND `display:block`. The check is **exactly** `el.designTarget.children().last().css('display') === 'block' && el.designTarget.children().last().hasClass('selected')` and is repeated in 12+ places (e.g. `[V1 line 861]`, `[V1 line 897]`, `[V1 line 934]`, `[V1 line 1489]`, `[V1 line 1576]`, `[V1 line 7541]`, `[V1 line 10965]`, `[V1 line 11622]`).
- Event-bus prefix patterns:
  - `PrintElementSelectEventKey_<templateId>` — select event `[V1 line 849]`, `[V1 line 12564]`.
  - `BuildCustomOptionSettingEventKey_<templateId>` — custom prop-panel `[V1 line 12567]`.
  - `hiprintTemplateDataChanged_<templateId>` — any persisted mutation, second-arg = `reason: string` `[V1 line 812]`, `[V1 line 894]`, etc.
  - `hiprintTemplateDataShortcutKey_<templateId>` — undo/redo `[V1 line 10953]`, `[V1 line 10955]`, `[V1 line 12547]`.
  - `clearSettingContainer` — global (NOT per-template) `[V1 line 1587]`, `[V1 line 1593]`, `[V1 line 12075]`.
  - `onSelectPanel` — global `[V1 line 12326]`.
  - `updateTable<hitableId>` — per-table-instance `[V1 line 6648]`.
- The `movingDistance` constant defaults to **1.5pt** `[V1 line 4 of hiprint.config.js]` and is used by both pointer-drag minMove `[V1 line 882]` and keyboard nudge step `[V1 line 1579]`.
- `adsorbMin` (snap-to-element threshold) = **3pt** `[hiprint.config.js line 10]`; `adsorbLineMin` (guide-line VISUAL threshold) = **6pt** `[hiprint.config.js line 12]`; `showAdsorbLine` default **true** `[hiprint.config.js line 11]`.

---

# Section 1 — Element selection

Selection state lives **per element** as the DOM child `<div panelindex=N class="resize-panel">` injected during `hireizeable.initResizeBox` `[V1 line 8051]`. The child default style is `display:none; cursor:move; background-color:rgba(0,0,0,0.5);` `[V1 lines 8052-8059]`. Selecting an element sets `.selected` class + `display:block` on this child `[V1 lines 8178-8181]`.

## 1.1 Single click on element body — replace selection

- **Trigger**: any `click` bubbling to `BasePrintElement.designTarget` `[V1 line 744]`.
  - The **delete-bubble path**: click first hits `.resize-panel` child, where `bindTrigger` (in hireizeable) calls `triggerResize(t, _n)` then `_n.stopPropagation()` `[V1 lines 8341-8345]`. So `BasePrintElement.designTarget.click` fires through the resize-panel's `bindTrigger` chain.
- **Debounce**: same `designTarget` click fired twice within ≤500ms is ignored (the second event ONLY updates `lastTimeStamp`, no event-bus emit). Logic: `if (ev.timeStamp - lastTimeStamp > 500)` `[V1 line 751]`. `lastTimeStamp` is a closure variable initialized to `0` `[V1 line 743]`.
- **DOM mutation** done by `triggerResize(t, n)` BEFORE the BasePrintElement click handler fires (because `.resize-panel` is the click target, then bubbles up):
  - If `!(n.ctrlKey || n.metaKey)`: clear other selected siblings — `t.siblings().children("div[panelindex]").removeClass('selected')` AND `.css({display:'none'})` `[V1 lines 8173-8176]`.
  - Add `.selected` to THIS element's `div[panelindex]` AND set `display:block` `[V1 lines 8178-8181]`.
  - Call `this.refreshSizeBox(t)` to update the `.size-box` content (renders "Wpt x Hpt" string) `[V1 line 8182]`.
- **Event-bus emit**: `hinnn.event.trigger("PrintElementSelectEventKey_" + templateId, { printElement: e })` `[V1 lines 752-754]`. This is what causes the property panel `ut.buildSetting` to redraw `[V1 lines 12071-12073]`.
- **Side effect — mouseRect (lasso) cleanup**: `bindTrigger` ALSO removes any existing `.mouseRect` lasso rect: `n(".mouseRect").remove()` `[V1 line 8344]` (this runs BEFORE the click bubbles to BasePrintElement).
- **`_listOnlySelect` short-circuit**: when an element-list row triggers the click via `triggerHandler(...$.Event('click', {_listOnlySelect:true,...}))` `[V1 lines 823-827]`, BasePrintElement's click handler returns early without emitting the event `[V1 lines 746-750]` (it does `ev.stopPropagation()` to prevent the canvas-empty handler from claiming the click). The list-row path emits the select event itself a few lines later `[V1 line 848]`.

## 1.2 Single click on canvas / panel empty area — clear selection

- **Trigger A — global canvas click (`hireizeable.bindHidePanel`)**: bound ONLY when `maxPanelIndex < 2` `[V1 line 8348]`. Listens on `document` `[V1 line 8350]`. Fires only if `t.target.className.includes("design")` (CSS-class string sniff) `[V1 line 8352]`. Action: hide ALL `div[panelindex]` (`.css({display:'none'})`) AND remove `.selected` from them `[V1 lines 8353-8357]`. Does NOT clear the property panel `settingContainer` (that requires a separate `clearSettingContainer` event).
- **Trigger B — panel-target click (`panelTarget.bind("click.hiprint")`)**: `[V1 line 10809]`. Fires for ANY click bubbling to `panel.target` that DOESN'T originate inside `.hiprint-printElement, .hiprint-el-list-panel, .hiprint-el-list-toggle` (the guard at `[V1 line 10810]`). Action: trigger `BuildCustomOptionSettingEventKey_<tid>` with `{options: panelOptions, callback: ...}` `[V1 lines 10837-10884]`. This rebuilds the property panel with **panel-level options** (paperHeader/Footer, watermark, gridOptions, etc.) — NOT empty.
- **No selection clearing happens in Trigger B**: it only swaps property-panel content. Element selection state (resize-panel `.selected` classes) is untouched.

## 1.3 Shift+click — adds to selection

- **V1 has NO explicit Shift+click handler.** The selection-toggle modifier is `ctrlKey || metaKey` ONLY `[V1 line 8172]`.
- Shift modifier exists ONLY in 2 other places, both non-selection:
  - Resize SE handle: `shiftKey` toggles "freeform" mode (skip aspect-ratio constraint) `[V1 line 8305]`.
  - `hidraggable` global e-handler: `e.shiftKey` constrains drag to X-axis when `e.shiftKey && !e.altKey` `[V1 line 7464]`; both shift+alt constrains to Y-axis.
- **Behavior under Shift+click**: same as plain click — replaces selection.

## 1.4 Ctrl/⌘+click — toggle / add to selection

- **Resize-panel `bindTrigger` path**: `if (!(n.ctrlKey || n.metaKey)) { siblings.removeClass('selected').hide() }` `[V1 lines 8172-8177]`. So with Ctrl/⌘ held, siblings are NOT cleared, AND this element is added to selection (its `panelindex` div gets `.selected` + `display:block`) `[V1 lines 8178-8181]`.
- **NOT a toggle**: V1 only adds, does not remove. Clicking an already-selected element with Ctrl/⌘ adds `.selected` (idempotent) but never removes it. To deselect, user must click empty canvas (Section 1.2) or press Esc (Section 1.7).
- **Element-list-row "append" path**: `selectFromList(true)` `[V1 lines 817-848]` mirrors Ctrl-click by passing `ctrlKey: true, metaKey: true` to the synthetic click event `[V1 lines 823-827]`.

## 1.5 Lasso (drag from empty area)

The lasso is internally called `mouseRect` and lives in `bindBatchMoveElement` `[V1 line 11398]`. The lasso class is `at` `[V1 line 10773]`.

### 1.5.1 Threshold to start lasso (movement distance)

- **There is no movement threshold**. Lasso starts on the FIRST `mousemove` (any pixel) after the qualifying `mousedown`.
- Qualifying mousedown conditions, ALL required `[V1 lines 11410-11415]`:
  - `e.buttons === 1` (primary button held during mousemove) `[V1 line 11415]`.
  - `_typeof(e.target.className) === "string"` AND `e.target.className.includes("hiprint-printPaper hidroppable design")` `[V1 line 11415]` — must land EXACTLY on the design paper itself.
  - NOT during another drag: `s.a.instance.draging` must be falsy `[V1 line 11415]`.
  - NOT during another lasso: any pre-existing `t.mouseRect.target` is `.remove()`d at the same line.
- `mousedown` ALSO sets `s.a.instance.rectDraging = true` `[V1 line 11411]`. `mouseup` clears it `[V1 line 11417]`.
- **Editing guard**: if `e.target.className` includes `"editing"`, both mousedown and mousemove return early `[V1 lines 11401-11402]`, `[V1 lines 11412-11414]`.

### 1.5.2 Lasso visual (dashed rect)

- DOM injected lazily on FIRST qualifying mousemove `[V1 line 11953]`:
  - `<div tabindex="1" class="mouseRect" style="z-index:2;position:absolute;opacity:0.2;border:1px dashed #000;background-color:#31676f;"><span></span></div>`.
- Appended to `.hiprint-printPaper-content` `[V1 line 11953]`.
- Updated by `updateRect(pageX, pageY, panel)` `[V1 line 10778]` which scales `(pageX/scale, pageY/scale)` and recomputes `minX/maxX/minY/maxY` `[V1 lines 10782-10785]`.
- `updateRectPanel(rect)` re-applies CSS `[V1 lines 11949-12017]`:
  - Stored origin = `bx,by`; current pointer = `ex,ey`.
  - 4 corner cases (each with its own `transform`):
    - `ex >= bx && ey >= by` (down-right): `transform: unset` `[V1 lines 11980-11987]`.
    - `ex < bx && ey < by` (up-left): `transform: rotate(180deg); transform-origin: 0 0` `[V1 lines 11988-11996]`.
    - `ex < bx && ey > by` (down-left): `transform: rotateY(180deg); transform-origin: 0 0` `[V1 lines 11998-12006]`.
    - `ex > bx && ey < by` (up-right): `transform: rotateX(180deg); transform-origin: 0 0` `[V1 lines 12007-12015]`.
- After update: `mouseRect.target.focus()` so keyboard nudges work `[V1 line 12017]`.

### 1.5.3 Hit detection (full containment vs intersect)

- **Intersect (NOT full containment)**. `BasePrintElement.inRect(t)` `[V1 line 1646]` returns `true` iff:
  ```
  ex1 < x2 && ex2 > x1 && y1 < ey2 && y2 > ey1
  ```
  where `(x1,y1)-(x2,y2)` = element bounding box (scale-divided from `offsetLeft/Top/Width/Height` `[V1 lines 1647-1651]`) and `(ex1,ey1)-(ex2,ey2)` = lasso rect bounding box `[V1 lines 1652-1654]`. This is a standard AABB intersect test — any touch counts.
- Aggregator: `PrintPanel.getElementInRect(t)` `[V1 line 11942]` iterates `printElements` filtered by `options.draggable !== false` (elements with `draggable:false` are NOT lasso-selectable) `[V1 line 11945]`.
- Computed lazily inside `mouseRect.target.hidraggable.onBeforeDrag` (first time the lasso rect itself is dragged) `[V1 line 11966]`: `e.mouseRect.mouseRectSelectedElement = e.getElementInRect(e.mouseRect)`. Also recomputed inside `bingKeyboardMoveEvent` if not yet cached `[V1 line 12021]`.

### 1.5.4 Cross-panel selection — allowed? forbidden?

- **Single-panel only.** `getElementInRect` is a method of `PrintPanel` `[V1 line 11942]` — iterates `this.printElements` (one panel's elements only). The `mouseRect` is attached to `this.designPaper.target.find(".hiprint-printPaper-content")` `[V1 line 11953]` — also single-panel scope.
- Cross-panel multi-select via Ctrl/⌘+click is also impossible because the resize-panel `bindTrigger` clears `siblings()` (sibling = same parent `.hiprint-printPaper-content`) `[V1 lines 8173-8177]`.

### 1.5.5 Endpoint behavior (mouseup releases lasso)

- `panel.designPaper.getTarget().on("mouseup", ...)` `[V1 line 11416]` sets `s.a.instance.rectDraging = false` `[V1 line 11417]`. The visible rect REMAINS — it does NOT auto-vanish on mouseup.
- The rect is ONLY removed when:
  - Resize-panel `bindTrigger` runs (any click on any element) — `n(".mouseRect").remove()` `[V1 line 8344]`.
  - New mousedown on empty design paper — `t.mouseRect.target.remove()` `[V1 line 11415]`.
  - Esc key — `n.mouseRect.target.remove(); n.mouseRect = null` `[V1 lines 10976-10979]`.
  - Right-click context menu "delete selected" — `panel.mouseRect.target.remove(); panel.mouseRect = null` `[V1 lines 11604-11607]`.
- After mouseup, the lasso rect itself becomes draggable (the `hidraggable` was attached at first `updateRectPanel`) `[V1 lines 11953-11979]`. Dragging the rect moves all `mouseRectSelectedElement` by delta `[V1 lines 11954-11961]`.
- After mouseup, the rect ALSO accepts arrow-key nudge (focus is on the rect's `<div tabindex="1">`) `[V1 lines 12018-12051]`.
- `mouseRect.mouseRectSelectedElement` is captured at `onBeforeDrag` time `[V1 line 11966]`. So if a user first selects via lasso, then clicks individual elements with Ctrl, the lasso's selection-array goes stale (it doesn't track later edits). `panel.getSelectedElements()` `[V1 line 11617]` returns the cached lasso array if present, OTHERWISE the live `.selected`-class scan.

## 1.6 Ctrl+A — select all

- **Trigger**: `$(document).keydown` registered in `PrintPanel.bindShortcutKeyEvent` `[V1 lines 10945-10947]`. Idempotent guard `_shortcutKeyBound` prevents double-binding `[V1 lines 10946-10947]`.
- **Guard**: `'INPUT' === e.target.tagName || 'TEXTAREA' === e.target.tagName` → no-op `[V1 line 10960]`.
- **Match**: `(e.ctrlKey || e.metaKey) && e.keyCode === 65` `[V1 line 10962]`.
- **Scope (active panel only or all panels?)**: **active panel only** — iterates `n.printElements` where `n = this` (the panel that bound the handler) `[V1 line 10963]`. NB: `bindShortcutKeyEvent` is called per-panel inside `design()` chain `[V1 line 10884]`, so technically EVERY panel binds its OWN `$(document).keydown`, and ALL of them fire. Disabled (`hipanel-disable`) panels do NOT get their handlers removed — so Ctrl+A WILL apply to invisible panels' elements too (but their UI is hidden, so user-invisible).
- **Locked elements excluded?** **No.** No `options.positionLocked` filter. The only filter is `if (el.printElementType.type.includes('table')) return;` — tables are excluded from select-all `[V1 line 10964]`.
- **DOM mutation per element** `[V1 lines 10965-10966]`:
  - `el.designTarget.children("div[panelindex]").addClass("selected")`.
  - `el.designTarget.children().last().css({display:"block"})`.
- **Side effects**: `e.preventDefault()` `[V1 line 10968]`. Property panel is NOT redrawn (no `PrintElementSelectEventKey` emit). `hiprintTemplateDataChanged` is NOT emitted (select-all isn't a data change).

## 1.7 Escape — clear selection

- **Trigger**: same `bindShortcutKeyEvent` keydown, `e.keyCode === 27` `[V1 line 10971]`.
- **Guard**: same INPUT/TEXTAREA guard `[V1 line 10960]`.
- **DOM mutation** `[V1 lines 10972-10975]`:
  - For each `el` in `printElements`: `el.designTarget.children("div[panelindex]").removeClass("selected")` AND `.css({display:"none"})`.
  - Does NOT filter out tables (unlike Ctrl+A).
- **Lasso cleanup**: `if (n.mouseRect && n.mouseRect.target) { n.mouseRect.target.remove(); n.mouseRect = null }` `[V1 lines 10976-10979]`.
- **Side effects**: `e.preventDefault()` `[V1 line 10980]`. Property panel NOT cleared (no `clearSettingContainer` emit).
- **Inline-edit cancel**: Esc does NOT explicitly cancel inline text editing. The `_editing` state is only exited on Enter `[V1 line 1471]` or via `updateByContent` from the prop-panel buildSetting path `[V1 line 12086]`. So Esc during inline edit DOES clear other elements' selection but the edit-in-progress remains in `_editing=true` with `contenteditable=true` and the resize-panel hidden (see Section 13).

## 1.8 Tab — cycle through selected siblings / all elements?

- **No Tab key handler exists.** No `keydown` branch matches `e.keyCode === 9` in the entire bundle. (Verified by grep — only matches are unrelated to keyboard cycling.)
- Tab navigates between DOM focusable elements per browser default. Each element gets `tabindex="1"` `[V1 line 1556]`, the mouseRect rect gets `tabindex="1"` `[V1 line 11953]`, designPaper target gets `tabindex="1"` `[V1 line 11008]`, certain DOM nodes have `tabindex` too `[V1 line 10128]`. So Tab WILL move browser focus among them and KeyboardMove handlers attached via `bingKeyboardMoveEvent` will start firing on whichever has focus — but no app-level "next-element" cycling logic exists.

## 1.9 Selection visual feedback

- **Resize handles render**: `hireizeable` is called for every element during `BasePrintElement.design` `[V1 line 1096]` (or the table-specific design `[V1 line 6591]`). Default handles `["s","e"]` `[V1 line 8383]`; effective set comes from `getReizeableShowPoints()` which returns `["s","w","e","se","r"]` for barcode/qrcode `[V1 line 1093]` and `["s","w","e","r"]` otherwise (general BasePrintElement). Tables override to `["n","s","w","e"]` `[V1 line 6565]`.
- **Resize-panel overlay**: the `<div class="resize-panel">` with `background-color:rgba(0,0,0,0.5)` `[V1 line 8057]` covers the element when `display:block` (i.e. selected). Inner handles `n/s/e/w/ne/nw/se/sw/r` are absolutely positioned `[V1 lines 8062-8097]`. Each handle is `8px x 8px`, `#409eff` blue, `border-radius:50%`, white border, slight shadow `[V1 lines 8127-8135]`.
- **Multi-select visual** (the `multipleSelect` class): `BasePrintElement.multipleSelect(bool)` toggles `.multipleSelect` on `designTarget` `[V1 line 1656]`. **Note**: V1 never calls `multipleSelect()` from any standard path — it's a stale method. Visual feedback for multi-select comes purely from each element's `.resize-panel.selected` overlay.
- **Outline (in element-list-row hover)**: when a list-row is clicked, the element gets `outline: 2px solid #409eff` for 800ms then cleared `[V1 lines 11936-11937]`.
- **Property panel update**: see Section 12.
- **`.size-box` (W×H text)**: lives inside the `.resize-panel` as `<div class="size-box" style="position:absolute;left:-2px">` `[V1 line 8098]`. Updated on every `refreshSizeBox(t, box, o)` call `[V1 lines 8144-8168]`. Format: `<width> x <height>` (e.g. `100pt x 50pt`) `[V1 line 8166]`. Hidden while position-guides are showing: `this.designTarget.find('.size-box').toggleClass('hide', true)` `[V1 line 1402]` (and reverted on `removeLineOfPosition` `[V1 line 1453]`).
- **Delete-X button**: `<div class="del-btn">✕</div>` `[V1 line 8099]` appended to the resize-panel ONLY when `options.draggable !== false` `[V1 line 8109]`. Its click dispatches a synthetic `keydown {keyCode:46}` on the element `[V1 lines 8111-8114]` (so the existing keyboard-delete path handles it).
- **Lock badge**: when `options.positionLocked === true`, `<div class="hiprint-lock-badge">🔒</div>` is appended to `.resize-panel` `[V1 line 913]`, `[V1 line 1010]`. del-btn is hidden `[V1 line 1023]`. resizebtn is hidden `[V1 line 1017]`.
- **Position guidelines (cross-hairs)**: 4 absolutely-positioned divs `.toplineOfPosition / .leftlineOfPosition / .rightlineOfPosition / .bottomlineOfPosition` are appended to `.hiprint-printPaper-content` on every drag step (`createLineOfPosition` `[V1 lines 1380-1451]`) and removed on `mouseup` via `removeLineOfPosition` `[V1 lines 1452-1453]`. If `HIPRINT_CONFIG.showPosition` `[hiprint.config.js line 6]` is true (default), label divs `.topPosition / .leftPosition` are also rendered with `${pt}pt` text. Mode toggle `positionLineMode` `[hiprint.config.js line 7]` changes label placement.

## 1.10 Event keys fired (V1 event-bus emits) on selection

| Sub-event | Trigger | Event key | Payload | V1 line |
|---|---|---|---|---|
| Plain click on element | BasePrintElement.designTarget.click (non-_listOnlySelect, !debounced) | `PrintElementSelectEventKey_<tid>` | `{ printElement: e }` | `[V1 line 752]` |
| List-row click (synthetic) | BasePrintElement.selectFromList | `PrintElementSelectEventKey_<tid>` | `{ printElement: this }` | `[V1 line 848]` |
| Inline-edit commit (Enter / blur) | updateByContent (non-clear branch) | `PrintElementSelectEventKey_<tid>` | `{ printElement: e }` | `[V1 line 808]` |
| Custom-options panel (table column click) | TablePrintElement.setColumnsOptions thead click | `PrintElementSelectEventKey_<tid>` | `{ printElement: t, customOptionsInput: [...] }` | `[V1 line 6661]` |
| Panel-level prop edit (canvas empty click) | panel target click.hiprint | `BuildCustomOptionSettingEventKey_<tid>` | `{ options: panelOptions, callback }` | `[V1 line 10837]` |
| Property panel listener | PrintTemplateOptionSettingPanel ctor | `on(eventKey, buildSetting)` | — | `[V1 lines 12071-12077]` |
| Element-list panel highlight | createElementListPanel listener | `on(PrintElementSelectEventKey_..., ...)` | row highlight + scrollIntoView | `[V1 lines 11849-11867]` |

---

# Section 2 — Element drag (within panel)

Drag is implemented by the custom jQuery plugin `$.fn.hidraggable` `[V1 lines 7784-7940]`. It is registered on EACH `BasePrintElement.designTarget` during `BasePrintElement.design()` `[V1 line 853]` (or in `TablePrintElement.design` with `handle: ...table-handle` `[V1 line 6569]`).

## 2.1 Trigger (mousedown on element body, but not on resize handle)

- The mousedown handler `[V1 lines 7832-7880]` is bound to either `target` itself OR `options.handle` if provided. For tables: `options.handle = this.designTarget.find(".hiprint-printElement-table-handle")` `[V1 line 6569]`.
- **Edge guard** `s(e)` `[V1 lines 7791-7816]`: returns `true` iff cursor is INSIDE the element body bounds (accounts for transform/rotation and scale). Otherwise mousedown is ignored. The `edge` default is `0` `[V1 line 7928]`.
- **draggable=false guard**: `if (ops.options.draggable === false) return` `[V1 lines 7852-7856]`.
- **Rotate-handle exemption**: `if ('r resizebtn' === e.target.className) return` `[V1 line 7858]` — clicking the rotate handle does NOT start drag.
- **`onBeforeDrag` hook**: must return truthy to proceed `[V1 line 7878]`. The BasePrintElement onBeforeDrag sets `HiPrintlib.instance.draging=true`, calls `n.designTarget.focus()`, and `n.createLineOfPosition(e)` `[V1 line 884]`.
- **State captured on mousedown** `[V1 lines 7839-7851]`:
  - `startPosition` = computed CSS position (usually `absolute`).
  - `startLeft / startTop` = `$(target).position().left/top`.
  - `left / top` = same as start.
  - `startX / startY` = `e.pageX/Y`.
  - `offsetWidth / offsetHeight` = `pageX - $(target).offset().left` / `pageY - $(target).offset().top`.
  - `target / parent` = drag target + its parent DOM node.
- **Scale normalization**: `if (ptr) { p.left /= ptr; p.top /= ptr; p.startLeft /= ptr; p.startTop /= ptr }` `[V1 lines 7861-7864]`.
- **Rotation normalization**: if `transform: rotate(<deg>)` is set, recomputes bounding box and offsets `diffW/diffH` `[V1 lines 7865-7876]`.

## 2.2 Drag lift offset / cursor change

- `body.css("cursor", options.cursor)` where `cursor` defaults to `"move"` `[V1 lines 7474, 7923]`.
- The handle had cursor set on mousemove BEFORE mousedown: `mousemove.hidraggable` sets `cursor` based on `s(e)` `[V1 lines 7821-7827]`.
- On mouseup, `setTimeout(() => body.css("cursor",""), 100)` clears `[V1 lines 7779-7781]`.

## 2.3 Drag visual (real element moves? ghost element? both?)

- **Real element moves.** `proxy` defaults to `null` `[V1 line 7921]`. With `proxy=null`, `o = $(target)` (the element itself becomes the proxy) `[V1 line 7491]`. So the live element's `left/top` CSS is updated each mousemove.
- **Optional clone proxy**: `enableDrag` (palette items) sets `proxy: function(t) { ... appendTo("body") ... css("z-index","9999") }` `[V1 lines 10720-10723]` to produce a `getProxyTarget()` floating helper that lives in the body. (This is palette drag — Section 6 — NOT regular element drag.)
- **Revert option**: `revert: true` snaps back to start position if no `hidroppable` accepts the drop `[V1 lines 7738-7752]`. Default `revert: false` `[V1 line 7922]`. Palette uses `revert: true` `[V1 line 10719]`.
- **Position-guide cross-hairs**: created on `onBeforeDrag` `[V1 line 884]`, updated on each `onDrag` callback `[V1 lines 871, 874, 877]`, removed on `onStopDrag` `[V1 lines 901, 902]`.

## 2.4 Snap-to-grid (gridSize pt, snap threshold, configurable)

- **No discrete grid snap.** V1 does NOT round the dragged position to a grid. The `minMove` option `[V1 line 882]` controls only the minimum movement BEFORE a `onDrag` event fires (default `_HiPrintConfig.movingDistance` = 1.5pt).
- `minMove` is applied in `dragLengthC` via `dragLengthCNum` `[V1 lines 7472-7473, 7691]` — it rounds the `data.left/top` to the nearest `minMove` step. So effective grid snap = 1.5pt in default config.
- **Visual grid (NOT snap)**: `panel.designPaper.applyGridOptions(opts)` `[V1 lines 9709-9726]`. If `opts.enabled`, applies `background-image: linear-gradient(...)` with `size` (default `5mm`) and `color` (default `rgba(0,0,0,0.1)`) on `paper.target`. This is purely visual — drag is NOT magnetic to these grid lines.

## 2.5 Snap-to-guide-lines (does V1 have guide lines? If so, snap interaction)

- V1 DOES have guide lines (orthogonal "参考线" — see Section "Guide Lines" at end of this doc), drawn by `renderGuideLines` `[V1 lines 9540-9545]`.
- **Drag does NOT snap to user-drawn guide lines.** The snap logic in `hidraggable.o` `[V1 lines 7534-7715]` only considers OTHER elements as snap targets, not `panel.designPaper.guideLines`. Guide lines are visually overlaid but have no magnetic interaction with element drag.

## 2.6 Snap-to-other-elements (smart guides)

- Implemented INSIDE `hidraggable.o` (the `onDrag` step) `[V1 lines 7538-7691]`. Skipped when Ctrl/⌘ is held: `if (!(i.ctrlKey || i.metaKey) && (...class checks...))` `[V1 line 7538]`. So Ctrl/⌘+drag disables snap.
- **Snap-candidate elements**: only OTHER elements in same panel with `block` resize-panel visible AND not tables (single-select state required) `[V1 lines 7540-7542]`.
- **Position computation**: cPosition = current dragged element rect + center points (`left/top/right/bottom/vCenter/hCenter`) `[V1 lines 7543-7551]`.
- **Candidate selection**: For each non-self element, compute distance d1/d2/d3 from cPosition to candidate's left/center/right, take min `[V1 lines 7559-7562]`. Sort all candidates by min-distance asc. **Pick top-1 nearest** (`.slice(0,1)`) `[V1 line 7573]`. So smart-guide considers only the SINGLE nearest neighbor per drag step.
- **Snap thresholds**: `aMin = HIPRINT_CONFIG.adsorbMin` (=3pt) `[V1 line 7577]`. If candidate's edge/center is within `aMin` pt of current edge/center, position is snapped (re-assigned exactly to candidate edge):
  - 9 horizontal snap cases (3 candidate edges × 3 current edges): left-left, left-vCenter, left-right, vCenter-left, vCenter-vCenter, vCenter-right, right-left, right-vCenter, right-right `[V1 lines 7580-7611]`.
  - 9 vertical snap cases mirror: top-top, top-hCenter, top-bottom, hCenter-top, hCenter-hCenter, hCenter-bottom, bottom-top, bottom-hCenter, bottom-bottom `[V1 lines 7613-7644]`.
- **Adsorb-line visual** (`HIPRINT_CONFIG.showAdsorbLine`, default `true`): If candidate is BETWEEN `aMin` (3pt, no snap yet) and `aLMin` (6pt) — a visual line is drawn but NO position change. 18 cases total (9 horizontal verLine + 9 horizontal horLine equivalents) `[V1 lines 7647-7686]`. Lines are `<div class='verLine id-N'>` / `<div class='horLine id-N'>` `[V1 lines 7497-7507, 7514-7523]`.
- **Line removal**: `removeVerLine(op)` / `removeHorLine(op)` `[V1 lines 7509-7531]` remove either specific (by id) or ALL (`$(".verLine").remove()`) — invoked on each snap-found-match AND on `onStopDrag` via `removeVerLine(); removeHorLine()` `[V1 line 7732]`.

## 2.7 Drag with multi-selection (group move — delta-based)

- Implemented inside `onDrag` callback in `BasePrintElement.design` `[V1 lines 858-880]`.
- Detection: filter `printElements` for those with `.selected` resize-panel display:block AND type !== table `[V1 lines 860-863]`. `isMultiple = els.length > 1` `[V1 line 864]`.
- `notSelected = !n.designTarget.children().last().hasClass('selected')` `[V1 line 865]` — true if user is dragging an unselected element while OTHERS are selected.
- **Delta computation**: `left = i - n.options.left`, `top = o - n.options.top` `[V1 line 867]` (i = new x, o = new y from hidraggable, n.options.left/top = current stored position).
- **Per-selected-element apply** `[V1 lines 868-872]`:
  - `t.updateSizeAndPositionOptions(left + t.options.getLeft(), top + t.options.getTop())`.
  - `t.designTarget.css("left", t.options.displayLeft())`, `t.designTarget.css("top", t.options.displayTop())`.
  - `t.createLineOfPosition(e)` — cross-hairs per element.
- **If dragged-element is NOT in selection**: additionally update the dragged element itself with absolute `(i, o)` `[V1 lines 873-875]`.
- **Lasso (mouseRect) group move**: mirrors the above but uses `mouseRect.mouseRectSelectedElement` array `[V1 lines 11954-11960]`.

## 2.8 Constraint to panel bounds? Or allowed off-paper?

- **Constrained to paper bounds.** Code path `[V1 lines 7693-7715]`:
  - `paperW = parent.clientWidth`, `paperH = parent.clientHeight`.
  - `elementW = data.target.clientWidth`, `elementH = data.target.clientHeight`.
  - If element has `options.transform` (rotation), computes `diffLeft/diffTop` from `getRectInfo()` to allow rotated bounding-box to extend `diffW/diffH` beyond paper `[V1 lines 7699-7702]`.
  - Clamp `data.left ∈ [0 - diffLeft, paperW - elementW + diffLeft]` `[V1 lines 7704-7708]`.
  - Clamp `data.top ∈ [0 - diffTop, paperH - elementH + diffTop]` `[V1 lines 7710-7713]`.
- These constraints apply ONLY when `!(i.ctrlKey || i.metaKey)` (Ctrl-drag escapes them) `[V1 line 7538]`.

## 2.9 Drop commit (mouseup) — what gets updated, history snapshot push

- `mouseup` handler in `hidraggable.r` `[V1 lines 7729-7782]`:
  - `t.fn.hidraggable.isDragging = false`.
  - `removeVerLine(); removeHorLine()` `[V1 line 7732]` clear snap-line overlays.
  - `target.css({position:"absolute", left: dragLengthC(left, p), top: dragLengthC(top, p)})` `[V1 lines 7752-7755]`.
  - `l()` checks hidroppables and triggers `_drop` event if cursor is over one `[V1 lines 7762-7777]`.
  - `p.onStopDrag.call(target, e)` invokes the user callback `[V1 line 7779]`.
- **`BasePrintElement.design.onStopDrag` callback** `[V1 lines 892-903]`:
  - If `HiPrintlib.instance.changed`: emit `hiprintTemplateDataChanged_<tid>` with reason `"移动"` `[V1 line 894]`.
  - Set `draging=false`, `changed=false` `[V1 line 895]`.
  - For each currently `.selected` non-table element: `t.removeLineOfPosition()` `[V1 lines 897-902]`.
- **History snapshot**: triggered by the `hiprintTemplateDataChanged_<tid>` event handler in `initAutoSave` `[V1 lines 13136-13152]`. The handler:
  - Skips if `!t.history` (configurable; default `true`) `[V1 line 13104, 12336]`.
  - Skips if `t._isUndoRedoing` `[V1 line 13137]`.
  - Truncates history forward if `historyPos < historyList.length - 1` `[V1 lines 13140-13142]`.
  - Pushes `{id: guid(), type: reason, json: getJson() or getJsonTid()}` `[V1 line 13143]`.
  - **Caps at 50 entries** `[V1 line 13144]`: if `length > 50`, slices to last 50 and sets `historyPos = length - 1`.
  - Calls `t.onDataChanged && t.onDataChanged(type, j)` business callback `[V1 line 13150]`.

## 2.10 hiprintTemplateDataChanged event with reason "移动"

- Emitted in `BasePrintElement.design.onStopDrag` `[V1 line 894]`. The string `"移动"` is hard-coded and i18n-untranslated (lookups go through i18n elsewhere, but reason strings are bare CN).
- Listener: `initAutoSave` `[V1 line 13136]` consumes; element-list panel listens for refresh `[V1 line 11839]`.
- Reasons seen for drag-class operations:
  - `"移动"` — single + multi-select pointer drag `[V1 line 894]`, `[V1 line 6586]` (table).
  - `"框选移动"` — lasso-rect drag of all enclosed elements `[V1 line 11975]`.
  - `"键盘移动"` — arrow-key nudge `[V1 line 1643]`.

---

# Section 3 — Element drag (cross-panel)

## 3.1 How V1 detects drop target panel (hover detection? mouseover event?)

- `hidraggable` `onDrag` iterates `o.hidroppables` (panels that `accept` this element) `[V1 lines 7481-7489, 7719-7726]`:
  - For each `hidroppable`, check `cursor ∈ [offset.left, offset.left + outerWidth]` AND `cursor ∈ [offset.top, offset.top + outerHeight]`.
  - If inside AND `!this.entered`: trigger `_dragenter` event AND set `this.entered = true` `[V1 line 7724]`.
  - If outside AND `this.entered`: trigger `_dragleave` AND set `entered=false`.
  - If inside (every move): trigger `_dragover`.
- `hidroppable` plugin binds `_dragenter/_dragleave/_dragover/_drop` jQuery events `[V1 lines 7947-7955]` mapping to user-supplied `onDragEnter/onDragLeave/onDragOver/onDrop` `[V1 line 7948-7954]`.

## 3.2 Visual feedback during cross-panel drag

- **No explicit visual** in V1. There is no hover-highlight on the destination panel.
- The CSS class `easyui-droppable` on the panel target gets `mouseup → removeClass("resizeing")` `[V1 lines 8120-8121]` — but `resizeing` is a resize-state class, not a drop-state class.

## 3.3 Coordinate translation when dropped on different panel

- For palette → panel drop (the only V1 cross-target drop), see `PrintPanel.droppablePaper.onDrop` `[V1 lines 11246-11266]`:
  - `r = HiPrintlib.instance.getDragingPrintElement()` retrieves the drag-in-progress element.
  - `ptr = panel.designPaper.scale || 1`.
  - `left = (r.left - hinnn.px.toPt(panel.target.children(".hiprint-printPaper").offset().left)) / ptr` `[V1 line 11255]`.
  - `top = (r.top - hinnn.px.toPt(panel.target.children(".hiprint-printPaper").offset().top)) / ptr` `[V1 line 11256]`.
  - `a.updateSizeAndPositionOptions(panel.mathroundToporleft(left), panel.mathroundToporleft(top))` snaps to nearest `movingDistance` step `[V1 line 11257, 11277-11279]`.
- For ELEMENT → another panel drag (not palette): V1 does NOT have cross-panel element drag. The `hidraggable` defaults only allow drop on the same `.hiprint-printPaper-content` `[V1 line 7706]` due to clamp logic to the parent's `paperW/paperH`. The drag is constrained to the source panel.

## 3.4 Use case when forbidden

- **Cross-panel element drag is forbidden by clamping**. The clamp logic `[V1 lines 7704-7713]` uses `data.parent.clientWidth/Height` (single panel). So the element cannot leave its source panel pixel-wise.
- **Ctrl/⌘+drag escapes the clamp** `[V1 line 7538]` but does NOT register the element with a new panel. Its `templateId/panel` references stay with the source `panel.printElements`. So even if visually crossed, the element belongs to its origin panel.

---

# Section 4 — Element resize

Implemented by `hireizeable` jQuery plugin `[V1 lines 8030-8392]`. Bound to each element via `BasePrintElement.setResizePanel` `[V1 lines 1094-1119]`.

## 4.1 8 resize handles (NW/N/NE/E/SE/S/SW/W) + rotate — V1 lines where they're rendered

- 8 directional handles + 1 rotate handle defined in `initResizeBox` `[V1 lines 8062-8097]`:
  - `n` — `[V1 lines 8063-8065]`: `cursor: n-resize; top:-12px; margin-left:-4px; left:50%`.
  - `s` — `[V1 lines 8066-8069]`: `cursor: s-resize; bottom:-12px; margin-left:-4px; left:50%`.
  - `w` — `[V1 lines 8070-8073]`: `cursor: w-resize; left:-12px; margin-top:-4px; top:50%`.
  - `e` — `[V1 lines 8074-8077]`: `cursor: e-resize; top:50%; margin-top:-4px; right:-12px`.
  - `ne` — `[V1 lines 8078-8081]`: `cursor: ne-resize; top:-12px; right:-12px`.
  - `nw` — `[V1 lines 8082-8085]`: `cursor: nw-resize; top:-12px; left:-12px`.
  - `se` — `[V1 lines 8086-8089]`: `cursor: se-resize; bottom:-12px; right:-12px`.
  - `sw` — `[V1 lines 8090-8093]`: `cursor: sw-resize; bottom:-12px; left:-12px`.
  - `r` (rotate) — `[V1 lines 8094-8097]`: base64-encoded custom rotate-cursor PNG; `top:-16px; margin-left:-4px; left:50%`.
- Filter by `showPoints` option: only handles whose name is in `options.showPoints` array are appended `[V1 lines 8100-8106]`. Default `["s","e"]` `[V1 line 8383]`.
- BasePrintElement effective showPoints: barcode/qrcode → `["s","w","e","se","r"]`; else → `["s","w","e","r"]` `[V1 line 1093]`. Tables → `["n","s","w","e"]` `[V1 line 6565]`.

## 4.2 Per-handle cursor (nwse-resize etc.)

- Cursor for each handle is set INLINE on creation `[V1 lines 8063-8097]` as listed above. The `r` handle uses a custom base64 PNG cursor + `alias` fallback.
- `body.css("cursor", options.cursor)` is set during `hidraggable` drag but NOT during `hireizeable` resize — only the handle has its own cursor.
- After mouseup, no cursor cleanup is needed (handles aren't moving).

## 4.3 Shift modifier — aspect ratio lock

- **Only applies to `se` (SE / bottom-right) handle.** All other handles ignore `shiftKey`.
- Logic at `[V1 lines 8302-8315]`:
  - `n = (pageX - o) / scale`, `E = (pageY - r) / scale`.
  - `if (e.shiftKey)`: set width and height INDEPENDENTLY (i.e. `shiftKey` = freeform / break aspect):
    - `u.css({width: numHandlerText(a + n), height: numHandlerText(p + E)})`.
    - `i.options.onResize(e, numHandler(p + E), numHandler(a + n), void 0, void 0)`.
  - `else` (default): MAINTAIN aspect ratio:
    - `ratio = p / a` (initial height/width).
    - `width = a + n; height = p + E; height = width * ratio` (FORCED ratio from X-delta).
    - `u.css({width, height})`.
- **Counter-intuitive**: in V1, `shiftKey` BREAKS aspect ratio, default LOCKS aspect ratio. (Many other apps invert this — V1 reverses convention.) Only applies on `se` handle.

## 4.4 Constraints (min size, max size, panel bounds)

- `minResize` option `[V1 line 8381]` defaults to `1.5pt`. Applied in `numHandlerText` (via `numHandler` `[V1 lines 8040-8043]`):
  - `e = 1.5` if no minResize, else `options.minResize`.
  - `n = 0.75 * t`.
  - Returns `Math.round(n / e) * e` — rounds the resize delta to nearest `minResize` step.
- **No maximum size constraint.** Resize CAN grow beyond panel bounds.
- **No panel-bound clamping** during resize (unlike drag — Section 2.8). Element can extend past paper edge.
- **Min height/width via `0.75 * t`**: the *.75 multiplier reduces the visible movement to ~75% of mouse delta — a deliberate "drag feels slower" UX choice. (No comment in source.)

## 4.5 Visual during resize (real element grows? outline overlay?)

- **Real element grows**: `u.css({width: numHandlerText(a+n), height: numHandlerText(p+E)})` updates the parent element `u` (the actual `.hiprint-printElement`) `[V1 lines 8244-8329]`.
- The resize-panel inner `t` (the overlay div) gets `width:100%; height:100%` during resize `[V1 lines 8246-8248]` etc., so it fills.
- The `<div class="size-box">` text updates via `refreshSizeBox` — but ONLY refreshed at `mousedown` `[V1 line 8107]`, NOT during mousemove. So the size text shown is the STARTING size, not the live size.
- **Resize-state CSS**: when any resize handle is mousedowned, `resize-panel` parent gets `.resizeing` class `[V1 lines 8118-8119]`. Removed on `mouseup` of any `.easyui-droppable` `[V1 lines 8120-8121]` — note this uses the OLD class name `easyui-droppable` which is set on the panel; modern code uses `hidroppable` but the mouseup handler still targets `easyui-droppable` — a legacy compatibility class.
- Position cross-hairs (`createLineOfPosition`) are NOT shown during resize, only during drag. They are shown during multi-element resize? — yes, via `setResizePanel.onResize` which calls `n.createLineOfPosition(e)` `[V1 line 1113]`.

## 4.6 Commit on mouseup

- `mouseup` handler in `bindResizeEvent` `[V1 lines 8332-8339]`:
  - If any of `d,c,h,f,g,m,y,v,b,rt` flag is true (i.e. some handle WAS active):
    - Call `i.options.onStopResize(rt)` — passes `rt` (rotate flag) so user can distinguish.
  - Reset ALL flags to false.
- `BasePrintElement.setResizePanel.onStopResize` `[V1 lines 1115-1118]`:
  - `hinnn.event.trigger("hiprintTemplateDataChanged_" + n.templateId, r ? "旋转" : "大小")` — emits reason `"旋转"` if `rt`, else `"大小"`.
  - `HiPrintlib.instance.draging = false`.
  - `n.removeLineOfPosition()`.

## 4.7 Multi-select resize behavior (group resize? individual?)

- **No multi-select group resize in V1.** Each element's resize is INDEPENDENT. Resizing element A while elements A,B,C are all selected only changes A's size — B and C are untouched.
- Multi-element "等宽" / "等高" actions exist via right-click context menu (Section 7), where size is COPIED FROM `selectedEls[0]` to all others `[V1 lines 11569-11591]`. This is a one-shot menu action, not a live resize.

## 4.8 hiprintTemplateDataChanged event with reason "大小"

- Emitted exactly once per resize gesture, at mouseup `[V1 line 1116]`.
- For rotate gestures: emitted with reason `"旋转"` at same V1 line.
- Table resize uses identical logic `[V1 line 6606]`.

---

# Section 5 — Element rotate

## 5.1 Trigger (rotate handle visible above element? or property panel only?)

- Two triggers:
  1. **Rotate handle** `r resizebtn` `[V1 lines 8094-8097]`, visible IFF `r ∈ options.showPoints`. Per Section 4.1: barcode/qrcode have it; default BasePrintElement has it; tables do NOT (`["n","s","w","e"]` `[V1 line 6565]`).
  2. **Property panel `transform` input** — text input directly editing the CSS `transform: rotate(<deg>deg)` value, committed via `auto-submit` change/keydown(13) `[V1 lines 12229-12232]`.

## 5.2 Drag rotate visual

- `mousedown` on `.r` records `o=pageX, r=pageY, a=width, p=height, rt=true, s=a/2+u.offset().left, l=p/2+u.offset().top` `[V1 lines 8228-8230]`. So `(s,l)` = element center (used as rotation pivot reference).
- `mousemove` while `rt` `[V1 lines 8257-8268]`:
  - `t.css({height:"100%"})` — pads the resize-panel to fill (no visible change).
  - `direct = (eo - o) * 360 / 100` — mouse-x-delta of 100px = 360 degrees. So full rotation = 100px horizontal mouse travel. NB: `eo - o` increments by the LAST mousemove (since `o = e.pageX` `[V1 line 8261]`).
  - `lastAngle = parseInt(u[0].style.transform.slice(7, -1)) || 0` — parses existing `rotate(Xdeg)` substring (7 chars = `rotate(`, -1 strips `)`).
  - `R = lastAngle + direct` accumulates.
  - `if (Math.abs(R) > 360): R = R % 360` — keep within [-360,360] but no snap to [0,360].
  - `u.css({transform: "rotate(" + R + "deg)"})` — applies rotation to actual element.
  - `i.options.onResize(e, void 0, void 0, void 0, void 0, R)` — calls onResize with rotation in 6th arg (signature `(e, h, w, top, left, rotateDeg)`).
- `BasePrintElement.setResizePanel.onResize` `[V1 lines 1107-1114]` routes by `rt != undefined`:
  - If `rt !== undefined`: `n.onRotate(t, rt)` → `this.options.setRotate(rt)` `[V1 lines 1120-1121]`.
  - Else: `n.onResize(t, h, w, top, left)` → `this.updateSizeAndPositionOptions(left, top, w, h)` `[V1 lines 1122-1123]`.

## 5.3 Snap angles (0, 45, 90, 180...) if any

- **No angle snap during drag rotate.** The rotation value is continuous.
- **Reset-to-zero on double-click** of the rotate handle `[V1 lines 8231-8234]`:
  - `u.css({transform: "rotate(0deg)"})`.
  - `i.options.onResize(e, void 0, void 0, void 0, void 0, 0)` — onRotate with R=0.
- No 45° / 90° snap key (no Shift modifier in rotate path).

## 5.4 Multi-select rotate

- **No multi-element rotate.** Only the dragged-from element rotates. Other selected elements are untouched.

## 5.5 CSS: transform: rotate([angle]deg)

- Applied to `u` (the actual `.hiprint-printElement` parent) `[V1 line 8267]`.
- Storage: `options.setRotate(angle)` `[V1 line 1121]` — likely stores in `options.transform` (per config `transform` is a supported option in all etypes).
- **Rotation impact on drag**: `s(e)` edge-check `[V1 lines 7791-7816]` computes rotated bounding box via `sin/cos`. Drag offsets are adjusted by `diffW/diffH` `[V1 lines 7874-7876]`. Drag clamp uses rotated `diffLeft/diffTop` `[V1 lines 7699-7713]`.

---

# Section 6 — Drag from element list / palette

## 6.1 Element list DOM (left sidebar)

- The palette is built via `PrintElementTypeManager.build(container, moduleName)` `[V1 lines 10700-10702]`. Each draggable item is `<a class="ep-draggable-item hiprint-ep-card" tid="<tid>">...icon + <span>text</span></a>` `[V1 line 9158]`.
- Container CSS class: `.ep-draggable-item` is the canonical selector used by all hidroppables `[V1 line 11249]`.
- Items rendered via `createPrintElementTypeHtml` `[V1 line 10702]` based on `printElementTypeGroups` config.

## 6.2 Mousedown on list item → drag start

- `PrintElementTypeManager.enableDrag(elements)` `[V1 lines 10717-10750]` wraps `.hidraggable({...})`.
- `onBeforeDrag(e)` `[V1 lines 10727-10742]`:
  - Set `HiPrintlib.instance.draging = true`.
  - Read `tid = $(e.data.target).attr('tid')`.
  - Look up element type via `t.getElementType(tid, $(e.data.target).attr('ptype'))`.
  - If not found: `throw new Error(...)` with i18n msg (BLOCKS drag).
  - Create new element instance: `ele = n.createPrintElement()`.
  - If new element creation fails AND type is `tableCustom`: throw with deprecation message (no replacement now).
  - Set `HiPrintlib.instance.setDragingPrintElement(ele)` (stores the in-progress element globally) — accessed during drop in `panel.droppablePaper.onDrop` `[V1 line 11252]`.
  - Return `true` to allow drag.

## 6.3 Helper visual: clone? ghost? cursor-following preview?

- `proxy: function(t) { var e = HiPrintlib.instance.getDragingPrintElement(); var n = e.printElement.getProxyTarget(e.printElement.printElementType.getOptions()); return n.appendTo("body").css("z-index","9999"), n; }` `[V1 lines 10720-10723]`.
- `getProxyTarget()` is per-printElementType `[V1 line 10722]` — returns a custom DOM node (typically a clone of the rendered element).
- **Floating in body**: the helper is appended to `document.body` `[V1 line 10723]` with z-index 9999.
- **Updated on each mousemove**: `onDrag(t, e, n) { HiPrintlib.instance.getDragingPrintElement().updatePosition(e, n) }` `[V1 lines 10744-10746]`.
- **Revert on no-drop**: `revert: true` `[V1 line 10719]` — if no `hidroppable` accepts, helper animates back to start position `[V1 lines 7738-7747]`.

## 6.4 Drop detection — which panel claims drop? Active panel only? Or hover-detected?

- The accept clause: `accept: '.ep-draggable-item'` `[V1 line 11249]`. Each panel's `designPaper.getTarget()` has `hidroppable` bound `[V1 lines 11246-11266]`.
- `hidraggable.o` hover-detection `[V1 lines 7719-7726]` iterates ALL `hidroppable` divs that accept this draggable. So **drop is hover-detected**, not active-panel-locked.
- However, disabled panels (`hipanel-disable` class, `.disable()` `[V1 lines 11199-11206]`) still have hidroppable bound — they're just visually grayed out. So technically a drop on a disabled panel WILL fire onDrop too (no guard).

## 6.5 Coordinate translation (drop XY → element left/top)

- `panel.droppablePaper.onDrop` `[V1 lines 11250-11265]`:
  - `r = HiPrintlib.instance.getDragingPrintElement()`.
  - `a = r.printElement`.
  - `ptr = e.designPaper.scale || 1`.
  - `left = (r.left - hinnn.px.toPt(panel.target.children(".hiprint-printPaper").offset().left)) / ptr`.
  - `top = (r.top - hinnn.px.toPt(panel.target.children(".hiprint-printPaper").offset().top)) / ptr`.
  - `panel.mathroundToporleft(t)` rounds to `movingDistance` step `[V1 lines 11277-11279]`.
  - `a.updateSizeAndPositionOptions(roundedLeft, roundedTop)`.

## 6.6 Default size for new element

- Default size comes from the printElementType's config `default: {width: X, height: Y}` (see `hiprint.config.js`).
- Defaults per type (from config):
  - `text`: `width:120, height:9.75` `[hiprint.config.js lines 473-474]`.
  - `longText`: `height:42, width:540` `[hiprint.config.js lines 882-885]`.
  - `table`: `width:550` `[hiprint.config.js line 1217]`.
  - `hline`: `width:90, height:9, borderWidth:0.75` `[hiprint.config.js lines 1326-1329]`.
  - `vline`: `width:9, height:90` `[hiprint.config.js lines 1437-1440]`.
  - `rect/oval`: `width:90, height:90` `[hiprint.config.js lines 1556-1559, 1674-1678]`.
  - `barcode`: `width:160, height:40, title:'条形码', barcodeType:'code128', testData:'barcode'` `[hiprint.config.js lines 2062-2069]`.
  - `qrcode`: `width:80, height:80, title:'二维码', qrcodeType:'qrcode', testData:'qrcode'` `[hiprint.config.js lines 2245-2251]`.
  - `image`, `html`: have `default: {}` (rely on createPrintElement defaults).
- `initSizeByHtml(designTarget)` `[V1 line 11283]` is called with `n=true` from `appendDesignPrintElement(t, e, true)` (on first drop) — this initializes size to fit DOM.

## 6.7 Field binding pre-set from list item template

- The palette item carries `tid` (printElementType.tid) via the `tid="..."` attr `[V1 line 9158]`.
- `getElementType(tid, ptype)` returns the registered printElementType.
- `printElementType.createPrintElement(options?)` is called WITHOUT options `[V1 line 10735]` — so default config values + per-printElementType-defaults are used.
- The user-specific field binding (`options.field`) comes from `printElementType.field` if defined in the type config — NOT from the palette UI.

## 6.8 New element id generation

- `BasePrintElement.id` is set inside `printElementType.createPrintElement()` via `HiPrintlib.guid()` or similar.
- `qtDesigner` extra: if `template.qtDesigner === true` (default `true` `[V1 line 12345]`), the dropped element's `options.qid` is set via `template.qtDesignderFunction(field)` `[V1 lines 11260-11262]`:
  - Walks all `editingPanel.printElements`, counts how many share the same `field.split("_")[0]` prefix → builds `qtDesignerMap`.
  - Returns either `fieldTitle` (if count == 0 or undefined) OR `fieldTitle + "_" + count` `[V1 lines 12347-12366]`.

## 6.9 History snapshot

- After successful drop `[V1 line 11264]`:
  - `panel.printElements.push(a)`.
  - `a.design(undefined, t)` registers all interactions.
  - `o.a.event.trigger("hiprintTemplateDataChanged_" + e.templateId, "新增")`.
- The `"新增"` reason triggers `initAutoSave` to push a history snapshot.

## 6.10 hiprintTemplateDataChanged event with reason "新增"

- Per Section 6.9. Emitted exactly once per drop, with reason string `"新增"` `[V1 line 11264]`.

---

# Section 7 — Right-click context menu (generic layer)

The context menu is bound in `bindBatchMoveElement` `[V1 line 11421]` on `panel.designPaper.getTarget()`. It is a custom DOM-injected menu, NOT the hicontextMenu plugin at `[V1 lines 8924-8934]` (which is unused on the canvas).

## 7.1 Standard menu items always present

The menu has 6 SECTIONS, each prefixed with a `.hiprint-ctx-menu-group` title row:

**Group 1: 元素操作 (Element Ops)** — always rendered `[V1 lines 11432-11461]`:
- 复制元素 (Copy Element) — `[V1 lines 11435-11442]`.
- 粘贴元素 (Paste Element) — `[V1 lines 11444-11461]`.

**Group 2: 参数更新 (Param Update)** — only if `hasSelection` `[V1 lines 11463-11484]`:
- 字体 12pt (Font Size 12pt) — sets `fontSize=12` on all selected `[V1 lines 11469-11475]`.
- 字体加粗 (Font Bold) — sets `fontWeight='bolder'` on all selected `[V1 lines 11477-11483]`.

**Group 3: 层级操作 (Z-order)** — only if `hasSelection` `[V1 lines 11486-11522]`:
- 置于顶层 (Bring to Front) — `[V1 lines 11488-11496]`.
- 置于底层 (Send to Back) — `[V1 lines 11497-11508]`.
- 上移一层 (Layer Up) — `[V1 lines 11509-11515]`.
- 下移一层 (Layer Down) — `[V1 lines 11516-11522]`.

**Group 4: 锁定 (Lock)** — only if `hasSelection`. Renders SINGLE toggle (text changes based on current state of selection) `[V1 lines 11524-11540]`:
- 锁定元素 / 解锁元素 (Lock/Unlock) — `[V1 lines 11525-11540]`.

**Group 5: 对齐操作 (Alignment)** — only if `selectedEls.length >= 2` `[V1 lines 11542-11593]`:
- 左对齐 / 右对齐 / 顶对齐 / 底对齐 / 水平居中 / 垂直居中 (6 items) `[V1 lines 11547-11553]`.
- 水平等距 / 垂直等距 (2 more items) ONLY if `selectedEls.length >= 3` `[V1 lines 11554-11557]`.
- 等宽 / 等高 (Same Width / Same Height) `[V1 lines 11568-11592]`.

**Group 6: 删除 (Delete)** — only if `hasSelection` `[V1 lines 11595-11610]`:
- 删除选中元素 (count) — `[V1 lines 11596-11609]`. Red/danger styled.

**Total potential items**: 2 + 2 + 4 + 1 + 6 + 2 + 2 + 1 = 20 items.

## 7.2 Item visibility conditions

| Item | Condition | V1 line |
|---|---|---|
| Menu itself | `hasSelection || hasCopy` | `[V1 line 11428]` |
| 复制元素 | enabled if `hasSelection` else `.disabled` | `[V1 line 11435]` |
| 粘贴元素 | enabled if `hasCopy` else `.disabled` | `[V1 line 11444]` |
| Group 2,3,4,6 | `if (hasSelection)` wrapping `[V1 line 11463]` |
| Group 5 (align) | `if (selectedEls.length >= 2)` | `[V1 line 11542]` |
| Group 5 distribute | `if (selectedEls.length >= 3)` | `[V1 line 11554]` |

`hasCopy = !!panel._contextCopyElements` `[V1 line 11426]`. `_contextCopyElements` is set ONLY by clicking the "复制元素" item — it's a panel-level local array, NOT Ctrl+C clipboard.

## 7.3 Item enable/disable conditions

- `.disabled` class applied via inline string `(!hasSelection ? ' disabled' : '')` `[V1 line 11435]`.
- The handlers DO check at execution time: `if (!hasSelection) return;` `[V1 line 11438]` and `if (!panel._contextCopyElements || !panel._contextCopyElements.length) return;` `[V1 line 11447]`. So even if the user manages to click a disabled item, it no-ops.
- Lock toggle text computed from `selectedEls.some(el => el.options.positionLocked)` `[V1 line 11525]` — if ANY selected is locked, button reads "解锁元素", else "锁定元素".

## 7.4 Item handler signatures (callback bindings)

- All handlers are `function() { ... }` arrow-less, bound via `.on("click", fn)`.
- Each handler FIRST removes the menu: `$(".hiprint-ctx-menu").remove()` (executed before the action).
- Each handler ends with `o.a.event.trigger("hiprintTemplateDataChanged_" + panel.templateId, "<reason>")` where reason matches the action:
  - "粘贴" `[V1 line 11459]`, "批量修改" `[V1 lines 11473, 11481]`, "层级" `[V1 lines 11494, 11506, 11513, 11520]`, "锁定" `[V1 line 11538]`, "对齐" `[V1 line 11563]`, "等宽" `[V1 line 11578]`, "等高" `[V1 line 11590]`, "删除" `[V1 line 11608]`.

## 7.5 V1 line where menu is constructed

- `[V1 line 11430]`: `var menu = $('<div class="hiprint-ctx-menu"></div>')`.
- `[V1 line 11612]`: `$("body").append(menu)`.

## 7.6 Menu position calculation (offset to cursor)

- `menu.css({ left: e.pageX + 2, top: e.pageY + 2 })` `[V1 line 11613]` — 2px down-right of cursor.
- No viewport-edge clamping (menu can overflow off-screen).

## 7.7 Menu close triggers (click outside, escape, item-clicked)

- **Click outside**: `$(document).one("click.hiprintCtxMenu", function() { $(".hiprint-ctx-menu").remove() })` `[V1 line 11615]`. Namespaced + one-shot to avoid double-firing.
- **Item-clicked**: each handler does `$(".hiprint-ctx-menu").remove()` as the first line `[V1 lines 11437, 11446, etc.]`.
- **Escape**: NO escape handler binds to context menu. Esc only clears selection (Section 1.7).
- **Re-open**: if a contextmenu event fires while menu exists, the OLD menu is removed first via `$(".hiprint-ctx-menu").remove()` at `[V1 line 11429]`.

## 7.8 Etype-specific items contributing extra context-menu items

- **HiTable** (table edit mode) has its OWN context menu via `hitable.isEnableContextMenu` `[V1 line 6647]`. Triggered ON `thead td` click? — table has its own context menu logic. Not enumerated here (per-etype, see `etypes/table.md`).
- No other etype contributes extra items to the panel-level contextmenu. The 20-item menu is the complete generic layer.

---

# Section 8 — Keyboard navigation

Two registration paths:
- Per-element keyboard handler: `BasePrintElement.bingKeyboardMoveEvent(designTarget)` `[V1 line 1552]` — bound during `BasePrintElement.design` `[V1 line 904]`.
- Per-panel shortcut handler: `PrintPanel.bindShortcutKeyEvent` `[V1 line 10945]` — bound during `panel.design` chain `[V1 line 10884]`.
- Per-panel paste handler: `PrintPanel.bingPasteEvent` `[V1 line 11006]`.
- Lasso-rect keyboard: `PrintPanel.bingKeyboardMoveEvent(mouseRect.target)` `[V1 line 12018]`.

## 8.1 Arrow keys — move selected by 1pt (Shift+arrow = 10pt?)

- **Arrow key handler is in `bingKeyboardMoveEvent`** `[V1 lines 1556-1645]`.
- **Guard: target must NOT be `INPUT`** `[V1 lines 1557-1559]`.
- **Guard: NOT editing** (unless `altKey`): `if (n._editing && !(r.altKey)) return` `[V1 lines 1561-1563]`.
- **Guard: not lockable**: `if (false === n.options.draggable || n.options.positionLocked)`: only Delete/Backspace allowed `[V1 lines 1565-1573]`.
- **Step distance**: `movingDistance = HiPrintConfig.instance.movingDistance` (default 1.5pt) `[V1 line 1579]`. **No Shift modifier — Shift+arrow has NO effect** (Shift is not checked in any arrow case `[V1 lines 1595-1640]`). Step is ALWAYS 1.5pt.
- Per-key:
  - **37 (Left)** `[V1 lines 1595-1605]`:
    - If multi-select: `els.forEach(t => t.updatePositionByMultipleSelect(-movingDistance, 0))`.
    - Else: `n.updateSizeAndPositionOptions(left - movingDistance)` + `t.css("left", n.options.displayLeft())`.
    - `r.preventDefault()`.
  - **38 (Up)** `[V1 lines 1607-1617]`: mirror with `top - movingDistance`.
  - **39 (Right)** `[V1 lines 1619-1629]`: mirror with `left + movingDistance`.
  - **40 (Down)** `[V1 lines 1631-1640]`: mirror with `top + movingDistance`.
- **After any arrow**: `if ([37,38,39,40].includes(r.keyCode))`: emit `hiprintTemplateDataChanged_<tid>` with reason `"键盘移动"` `[V1 lines 1642-1644]`.
- **Lasso-rect arrow handler** `[V1 lines 12020-12051]`: identical pattern but moves `mouseRect` AND all `mouseRectSelectedElement`. Emits reason `"框选移动"` `[V1 line 12049]`.

## 8.2 Tab — cycle selected

- **Not implemented.** No keyCode 9 handler. See Section 1.8.

## 8.3 Delete / Backspace — delete selected

- In `bingKeyboardMoveEvent` `[V1 lines 1582-1594]`:
  - keyCodes `8` (Backspace) and `46` (Delete) fall into the same case.
  - `templete = HiPrintlib.instance.getPrintTemplateById(n.templateId)`.
  - `templete.deletePrintElement(n)` — deletes the focused element.
  - `event.trigger("hiprintTemplateDataChanged_" + n.templateId, "删除")`.
  - `event.trigger("clearSettingContainer")` — clears property panel.
  - ALSO delete all OTHER selected elements: `els.forEach(ele => { templete.deletePrintElement(ele); event.trigger("hiprintTemplateDataChanged_...", "删除") })`.
  - `event.trigger("clearSettingContainer")` again (idempotent).
- **Position-locked elements CAN be deleted** — the explicit guard at `[V1 line 1568]` allows keyCode 8/46 through.
- **Delete-X button** dispatches a synthetic `keydown {keyCode:46}` `[V1 lines 8111-8114]` so the existing handler covers it.

## 8.4 Esc — clear selection / close menu / cancel inline edit

- Esc → clear selection: Section 1.7.
- Esc → close context menu: NO. Context menu only closes via item-click or click-outside.
- Esc → cancel inline edit: NO. Inline edit only commits on Enter or `updateByContent` from prop panel.

## 8.5 Ctrl+A — select all

- See Section 1.6.

## 8.6 Ctrl+Z / Ctrl+Y — undo / redo (history depth)

- In `bindShortcutKeyEvent` `[V1 lines 10949-10959]`:
  - `if ((e.ctrlKey || e.metaKey) && e.keyCode === 90)`:
    - If `e.shiftKey`: emit `hiprintTemplateDataShortcutKey_<tid>` with `"redo"`.
    - Else: emit with `"undo"`.
  - `e.preventDefault()`.
- **Works even inside INPUT/TEXTAREA**: `[V1 line 10960]` is the `'INPUT'/'TEXTAREA'` guard for the OTHER shortcuts (Ctrl+A / Esc) — it's positioned AFTER the Ctrl+Z block. So Ctrl+Z fires inside text inputs too.
- **History depth**: 50 entries max `[V1 line 13144]`. Adding the 51st truncates the oldest.
- **Ctrl+Y is NOT bound** — only Ctrl+Shift+Z for redo.

## 8.7 Ctrl+C / Ctrl+V / Ctrl+X — clipboard

- **Ctrl+C** (`bingCopyEvent`) bound per-element `[V1 lines 1467-1481]`:
  - `if ((r.ctrlKey || r.metaKey) && r.keyCode === 67)`: `n.copyJson(); r.preventDefault();`.
  - `copyJson()` `[V1 lines 1482-1527]` serializes ALL currently-selected non-table elements (filtered same way as drag, `[V1 lines 1488-1490]`) to JSON, writes to:
    - **Clipboard API first**: `navigator.clipboard.writeText(json)` if available `[V1 lines 1503-1510]` — fire-and-forget Promise.
    - **execCommand fallback**: hidden `<textarea id="copyArea">` appended to body, `document.execCommand("copy")` `[V1 lines 1511-1519]`.
- **Ctrl+V** (`bingPasteEvent`) bound per-panel `[V1 lines 11006-11016]`:
  - `n.designPaper.target.attr("tabindex","1")` ensures focus capability.
  - `if ('INPUT' === e.target.tagName) return;` `[V1 line 11011]`.
  - `if ((e.ctrlKey || e.metaKey) && e.keyCode === 86)`: `n.pasteJson(e); e.preventDefault();`.
- **Ctrl+X** is NOT bound.

## 8.8 Page Up / Page Down — switch active panel?

- Not bound. No keyCode 33/34 handlers exist.
- Panel switching is via:
  - Pagination select dropdown (toolbar) `[V1 lines 14463-14497]`.
  - Bottom-of-canvas `.hiprint-pagination` clicks `[V1 lines 12318-12325]`.

## 8.9 Where keys are bound (window? document? specific selectors?)

| Binding | Target | V1 line |
|---|---|---|
| `bingKeyboardMoveEvent` | `BasePrintElement.designTarget` (each element) | `[V1 line 1556]` |
| `bindShortcutKeyEvent` | `$(document).keydown` | `[V1 line 10949]` |
| `bingPasteEvent` | `panel.designPaper.target.keydown` | `[V1 line 11009]` |
| `bingKeyboardMoveEvent` (lasso) | `mouseRect.target.keydown` | `[V1 line 12020]` |
| Guide line drag | `$(document).on("mousemove"+ns, "mouseup"+ns)` | `[V1 lines 9600-9601]` |
| El-list-panel drag | `$(document).on("mousemove.hiprintElListDrag_<tid>", ...)` | `[V1 line 11815]` |
| Designer side-panel resize | `$(document).on("mousemove"+_designerEventNs, ...)` | `[V1 lines 15039-15040]` |

## 8.10 Bubbling / preventDefault behavior

- All arrow-key / undo-redo / paste / delete handlers call `e.preventDefault()` when matching their action.
- Esc / Ctrl+A: `e.preventDefault()` always called `[V1 lines 10968, 10980]`.
- `e.stopPropagation()` is NOT explicitly called in keyboard handlers — only in click handlers (e.g. `[V1 line 11425]` contextmenu).
- The `_listOnlySelect` synthetic click uses `triggerHandler` `[V1 line 823]` instead of `trigger` — this prevents BUBBLING TO PARENT (only the direct handler fires).

---

# Section 9 — Clipboard (Ctrl+C/V/X)

## 9.1 Clipboard storage (in-memory? localStorage? system clipboard?)

- **Both system clipboard AND in-memory**:
  - **System clipboard** via `navigator.clipboard.writeText(json)` `[V1 line 1504]` OR `execCommand("copy")` from `<textarea id="copyArea">` `[V1 line 1517]`.
  - **In-memory** via the same `<textarea id="copyArea">` DOM element appended to body. Persisted across pastes within the SAME tab. The `pasteJson` ONLY reads from this textarea: `var copyArea = $('#copyArea'); ... json = copyArea.text()` `[V1 lines 11018-11022]`. **It does NOT read from `navigator.clipboard.readText`** — so external clipboard content cannot be pasted, only what was copied via Ctrl+C in this same tab.
- **Context menu copy is SEPARATE**: `panel._contextCopyElements` `[V1 line 11440]` is a panel-instance-level array of element references (NOT JSON). Used only by context menu "粘贴元素" `[V1 lines 11444-11460]`.

## 9.2 Single element copy / paste — paste offset (e.g. +10pt down-right)

- **Copy** stores entries: `{ options, printElementType, id, templateId }` (NOT a deep clone of options; reference) `[V1 lines 1491-1498]`.
- **Paste** algorithm `[V1 lines 11017-11077]`:
  - Parse JSON, iterate `objList`.
  - **First element (index 0)** `[V1 lines 11036-11048]`:
    - Record original position `operationPasterPosition = { x: obj.options.left, y: obj.options.top }`.
    - Determine paste position:
      - If `useMouse = e.currentTarget.className !== e.target.className`: use current mouse offset (last `mousemove` cached on panel as `mouseOffsetX/Y` `[V1 lines 11404-11405]`).
      - Else: paste at `obj.options.left + 10, obj.options.top + 10` (10pt offset).
    - Store as `replacePosition`.
  - **Subsequent elements (index >= 1)** `[V1 lines 11049-11058]`:
    - Compute `incrementPosition` = obj's offset from first obj.
    - Final position = `replacePosition + incrementPosition`.
  - For each pasted element:
    - `a = ele.clone(obj)` — clone the existing in-panel element (the source MUST still exist in `panel.printElements`).
    - `a.options.setLeft(left); a.options.setTop(top)`.
    - `a.setTemplateId(n.templateId); a.setPanel(n)`.
    - `n.appendDesignPrintElement(panel.designPaper, a, false)`.
    - If `template.qtDesigner && a.options.field`: `a.options.qid = template.qtDesignderFunction(a.options.field)` `[V1 lines 11066-11069]`.
    - `n.printElements.push(a)`.
    - `a.design(undefined, n.designPaper)`.
    - `event.trigger("hiprintTemplateDataChanged_<tid>", "复制")` `[V1 line 11072]`.
    - Click on the cloned element's resize-panel to select it: `a.designTarget.children('.resize-panel').trigger($.Event('click'))` `[V1 line 11075]`.
    - Focus on cloned: `a.designTarget.trigger($.Event('focus'))` `[V1 line 11076]`.
- **Critical limitation**: clone is via `getElementById(obj.id)` `[V1 line 11031]`. If the source element was deleted between copy and paste, the paste FAILS silently (`if (!ele) return`).

## 9.3 Multi-element copy / paste

- `copyJson` serializes ALL selected elements `[V1 lines 1488-1499]`. Stored as array.
- `pasteJson` iterates entire array `[V1 line 11027]`. Spatial relationship between pasted elements is PRESERVED via `incrementPosition` `[V1 lines 11053-11058]`.

## 9.4 Cross-template paste support

- **Cross-tab/cross-template paste fails**: `pasteJson` does `ele = n.getElementById(obj.id)` `[V1 line 11031]`. If pasting into a different panel/template, the source id doesn't exist there → `ele = undefined` → `return` skips this entry.
- **Cross-panel within same template**: same issue — id lookup is per-panel.
- **Cross-tab paste**: would require reading `navigator.clipboard.readText()`, which V1 does NOT do.

## 9.5 Cut = copy + delete

- **Not implemented.** No Ctrl+X handler exists.

## 9.6 Conflict with system clipboard while editing text inline

- `bingPasteEvent` early-returns for `INPUT`: `if ('INPUT' === e.target.tagName) return;` `[V1 line 11011]`. But it does NOT check for `contenteditable` (inline-editing element body has `contenteditable=true` `[V1 line 771]`).
- So Ctrl+V WHILE inline-editing WILL trigger `pasteJson` — pasting elements into the design, NOT pasting text into the editing field. This is a V1 quirk.
- `bingCopyEvent` per-element: same issue. Ctrl+C while inside the contenteditable WILL fire `copyJson` `[V1 line 1477]` — copying elements, not selected text.

---

# Section 10 — Z-order

## 10.1 Bring to front / send to back actions

Four operations, all available via:
- Context menu (Section 7) `[V1 lines 11488-11522]`.
- Keyboard: `Ctrl/⌘+[` (layer down), `Ctrl/⌘+]` (layer up), `Ctrl/⌘+Shift+[` (send to back), `Ctrl/⌘+Shift+]` (bring to front) `[V1 lines 10983-11004]`.

Algorithms:

- **置于顶层 (bring to front)** `[V1 lines 11488-11495]`:
  - `maxZ = max(parseInt(el.options.zIndex) || 0)` across `panel.printElements`.
  - For each selected (indexed `i`): `el.updateOption('zIndex', maxZ + 1 + i, true)`.
  - This assigns each selected a UNIQUE z above max, preserving relative order.

- **置于底层 (send to back)** `[V1 lines 11497-11507]`:
  - `otherEls = printElements - selectedEls`.
  - `minZ = min(other zIndex)`, `baseZ = max(0, minZ)`.
  - Selected get `baseZ + i` (i = index in selection).
  - Others get bumped up: `z + selectedEls.length + 1`.

- **上移一层 (layer up)** `[V1 lines 11509-11514]`:
  - For each selected: `z = parseInt(el.options.zIndex) || 0`; set `el.updateOption('zIndex', z+1, true)`.

- **下移一层 (layer down)** `[V1 lines 11516-11521]`:
  - Set `el.updateOption('zIndex', Math.max(0, z-1), true)`.

- **Keyboard shortcut** `[V1 lines 10983-11004]`:
  - `(e.ctrlKey||e.metaKey) && (e.keyCode===221||e.keyCode===219)` — `]` or `[`.
  - `delta = 221 ? +1 : -1`.
  - If `e.shiftKey`:
    - `delta>0`: same as bring-to-front.
    - `delta<0`: send-to-back logic.
  - Else: ±1 layer (same as up/down).
  - Emit `hiprintTemplateDataChanged_<tid>, "层级"`.
  - `e.preventDefault()`.

## 10.2 Where z-order lives (array order? z-index?)

- **Both**:
  - `options.zIndex` stored per-element (numeric int) `[V1 line 11519]`. Applied as inline CSS via `updateDesignViewFromOptions`.
  - `panel.printElements` array order — used for rendering iteration. Also reordered after `orderPrintElements` (sort by `getTop()` then `getLeft()` `[V1 lines 11287-11292]`).
- z-Index ALWAYS clamped to `>= 0` via `Math.max(0, ...)` `[V1 lines 11519, 11000]`.

## 10.3 Multi-select reordering behavior

- "Bring to front" assigns sequential z values to preserve intra-selection relative order `[V1 line 11493]`.
- "Layer up/down" applies SAME delta to each, so distinct z values in selection are preserved.
- "Send to back" mirrors "front" by sequential assign starting from `baseZ` `[V1 line 11504]`.

---

# Section 11 — Undo / redo / history

## 11.1 Snapshot trigger (every commit? every keystroke?)

- Triggered by `hiprintTemplateDataChanged_<id>` event in `initAutoSave` `[V1 line 13136]`.
- The event is emitted at each user-action commit:
  - `"移动"` (drag end) `[V1 line 894]`.
  - `"键盘移动"` (arrow nudge each keypress) `[V1 line 1643]`.
  - `"框选移动"` (lasso group move end / lasso arrow nudge each keypress) `[V1 lines 11975, 12049]`.
  - `"大小"` (resize end) `[V1 line 1116]`.
  - `"旋转"` (rotate end OR rotate-handle dblclick reset) `[V1 line 1116]`.
  - `"删除"` (delete via key, context menu, or property-panel button) `[V1 lines 1586, 1591, 11608, 12226]`.
  - `"新增"` (palette drop) `[V1 line 11264]`.
  - `"粘贴"` (context menu paste) `[V1 line 11459]`.
  - `"复制"` (Ctrl+V paste; NB the *reason* is `"复制"` not `"粘贴"`) `[V1 line 11072]`.
  - `"层级"` (z-order shortcut) `[V1 line 11001]`. Also from context menu z-order items `[V1 lines 11494, 11506, 11513, 11520]`.
  - `"对齐"` (alignment from context menu / `alignElements`) `[V1 lines 11563, 11678]`.
  - `"等宽"` `[V1 line 11578]`, `"等高"` `[V1 line 11590]`.
  - `"锁定"` (lock toggle) `[V1 line 11538]`.
  - `"批量修改"` (multi-update font/weight from context menu) `[V1 lines 11473, 11481]`.
  - `"元素修改"` (property panel submit) `[V1 line 1060]`.
  - `"参数修改"` (updateOption when `!b`) `[V1 line 1078]`.
  - `"编辑修改"` (inline edit commit) `[V1 line 812]`.
  - `"清空"` (panel.clear) `[V1 line 11313]`.
  - `"参考线"` (guide line add/move) `[V1 line 9626]`, "新增参考线", "移动参考线", "删除参考线", "调整参考线".
  - `"调整大小"` (paper resize) `[V1 line 9467]`.
  - `"调整表头"` (table column header change) `[V1 line 6650]`.

## 11.2 History depth (default 50)

- `historyList` is initialized with a single `{type:'初始', json: lastJson}` entry `[V1 line 12341]`.
- `historyPos = 0` initial `[V1 line 12342]`.
- **Max depth = 50** `[V1 line 13144]`. When exceeded: `historyList = historyList.slice(historyList.length - 50)` and `historyPos = historyList.length - 1` `[V1 lines 13145-13146]`.

## 11.3 What's saved in a snapshot (full template JSON? diff?)

- **Full template JSON**, NOT a diff `[V1 line 13138]`:
  - `j = (1 === t.dataMode) ? t.getJson() : t.getJsonTid()`.
- `getJson()` returns full `new st({panels: panels.map(getPanelEntity(true))})` — all panels, all elements `[V1 lines 12537-12544]`.
- `getJsonTid()` is similar but uses `tid` references for printElementType instead of full entity.
- Each history entry: `{id: guid(), type: reasonString, json: fullJson}` `[V1 line 13143]`.

## 11.4 Branch behavior (undo then new edit truncates redo stack?)

- **Yes, truncates forward branch** `[V1 lines 13140-13142]`:
  - `if (t.historyPos < t.historyList.length - 1): t.historyList = t.historyList.slice(0, t.historyPos + 1)`.
  - Then push new entry.

## 11.5 V1 line of history module

- Constructor init: `[V1 lines 12336-12342]`.
- `undo` method (public): `[V1 lines 12545-12547]` — emits shortcut event.
- `redo` method: `[V1 lines 12548-12550]`.
- Shortcut handler: `[V1 lines 13100-13135]`.
- Data-change handler: `[V1 lines 13136-13152]`.
- Cleanup on destroy: `this.historyList = []` `[V1 line 12641]`.

**Rollback safety**: if `t.update(cur.json)` throws inside the undo/redo branch, `historyPos` is reset to `prevPos` `[V1 lines 13107, 13125-13127]` — prevents "pointer moved but DOM stale" desync.

---

# Section 12 — Property panel binding (mechanism, not the fields themselves)

## 12.1 How property panel detects selection change

- The `PrintTemplateOptionSettingPanel` class (`ut`) is instantiated by `PrintTemplate` constructor IF `opts.settingContainer` is provided `[V1 line 12372]`.
- Constructor registers 3 listeners `[V1 lines 12071-12077]`:
  - `on(PrintElementSelectEventKey_<tid>, function(t) { n.buildSetting(t) })`.
  - `on(BuildCustomOptionSettingEventKey_<tid>, function(t) { n.buildSettingByCustomOptions(t) })`.
  - `on('clearSettingContainer', function() { n.clearSettingContainer() })`.
- `buildSetting(t)` `[V1 lines 12102-12238]`:
  - `clearSettingContainer()` first (removes previous handlers + DOM).
  - If `tabs.length > 0`: build tabbed UI `[V1 lines 12110-12170]`.
  - Else: build flat list `[V1 lines 12172-12193]`.
  - For each option item: `t.createTarget(printElement, options, printElementType)` returns the input DOM, appended.
  - Default `setValue(...)` called per item; some need 2 args (`coordinate`, `widthHeight`).

## 12.2 Multi-select union vs intersection of options

- **No multi-select union/intersection.** The property panel ALWAYS targets a SINGLE element (`t.printElement = i` in `buildSetting` `[V1 line 12105]`).
- When `submitOption` is invoked on the panel, it propagates to other selected elements OF THE SAME type only for the `样式` (Style) tab `[V1 lines 940-958]`:
  - `els = printElements.filter(... .selected ... !table)`.
  - `els = els.filter(ele => ele.printElementType.type === this.printElementType.type)`.
  - For each style-tab option: apply to all `els` (not just `t`).
- For Base, Border, Advanced tabs (and flat list): ONLY the focused element is updated `[V1 lines 977-989]`.

## 12.3 Edit commit triggers and validation

- Two triggers `[V1 lines 12229-12232]`:
  - `.auto-submit` `change` event → `i.submitOption()` `[V1 line 12229]`.
  - `.auto-submit:input` `keydown` Enter (keyCode 13) → `submitOption()` `[V1 line 12231]`.
- Bottom buttons `[V1 lines 12196-12203]`:
  - 确定 (OK) button → `submitOption()` `[V1 line 12223]`.
  - 删除 (Delete) button → `deletePrintElement(i)` + emit `"删除"` event + `clearSettingContainer()` `[V1 lines 12225-12228]`. Delete button is rendered ONLY if `options.draggable !== false || options.positionLocked` `[V1 lines 12200-12203]`.
- **Validation**: per-option-item's own `getValue()` may parse/validate (e.g. number conversion). No global validation gate.

## 12.4 Property panel attach target (`settingContainer` opt)

- `PrintTemplate` constructor opt `n.settingContainer` `[V1 line 12372]`.
- Wrapped: `this.settingContainer = $(e)` `[V1 line 12069]`.
- Final root DOM: `<div class="hiprint-setting-panel">` `[V1 line 12194]`.

---

# Section 13 — Inline editing (text only)

## 13.1 Double-click triggers contenteditable=true

- `BasePrintElement.designTarget.dblclick` `[V1 lines 757-775]`:
  - `c = e.designTarget.find(".hiprint-printElement-content")` (the inner text container).
  - `p = e.designTarget.find(".resize-panel")`.
  - Guard: `if (printElementType.type === "text" && !(options.textType && "text" !== options.textType))`:
    - `e._editing = true`.
    - `e.designTarget.hidraggable('update', {draggable: false})` — disable drag during edit.
    - `c.css("cursor", "text"); c.addClass("editing")`.
    - `e.designTarget.addClass("editing")`.
    - Attach `c.click` handler: `if (e._editing) ev.stopPropagation()` — clicks inside contenteditable don't propagate to the parent click handler `[V1 lines 766-770]`.
    - `c.attr("contenteditable", true)`.
    - `p && p.css("display", "none")` — hide resize-panel while editing.
    - `e.selectEnd(c)` — place caret at end.
- **Applies to TEXT etype only.** If `printElementType.type !== "text"` OR `options.textType` is set to non-`"text"` (i.e. barcode/qrcode/longText sub-type), the dblclick is a no-op.

## 13.2 Cursor placement on enter edit

- `selectEnd(c)` `[V1 lines 776-789]`:
  - Branch A (`window.getSelection && document.createRange`):
    - `r = document.createRange(); r.selectNodeContents(el[0]); r.collapse(false)` — collapse to END.
    - `sel.removeAllRanges(); sel.addRange(r)`.
  - Branch B (IE legacy `document.body.createTextRange`):
    - `r.moveToElementText(el[0]); r.collapse(false); r.select()`.

## 13.3 Commit triggers (Enter / blur / Escape cancel)

- **Enter (commit)**: `bingCopyEvent` per-element keydown `[V1 lines 1469-1474]`:
  - `if (n._editing && !(r.altKey) && 13 === r.keyCode): n.updateByContent(); return;`.
- **Blur**: NOT explicitly bound. There is no `blur` handler for inline edit. So clicking elsewhere does NOT auto-commit unless that click also triggers `buildSetting` (selecting another element) → `clearLastPrintElement` `[V1 line 12083]` → `lastPrintElement.updateByContent(true)` `[V1 line 12086]`. So switching selection commits via the clear-handler chain (with `clear=true` flag suppressing the `PrintElementSelectEvent` re-emit).
- **Escape**: NO cancel handler. Pressing Esc clears selection (Section 1.7) but the `_editing=true` flag and `contenteditable=true` REMAIN. The element shows resize-panel hidden until next click.
- **Alt+Enter**: NO special handling. Alt prevents the Enter-commit guard `[V1 line 1471]` because of `!(r.altKey)` — so Alt+Enter inserts a line break (browser default) without committing.

## 13.4 Parsing patterns ("title:value")

- `updateByContent(clear)` `[V1 lines 790-816]`:
  - `c = e.designTarget.find(".hiprint-printElement-content")`.
  - Reset editing state: remove cursor, classes, contenteditable.
  - `t = c.text(); title = e.options.title`.
  - **Title prefix parsing** `[V1 lines 796-805]`:
    - `if (t.startsWith(title) && e.options.field)`:
      - If `t.length > title.length`: `options.testData = t.split("：")[1]` — text after `：` (Chinese full-width colon) becomes testData.
      - Else: `options.title = t; options.testData = ""`.
    - Else: `options.title = t`.
  - `options.title = options.title.split("：")[0]` — strip any colon-after part from title.
- **Format**: `<title>：<testData>` using Chinese full-width colon (`：` U+FF1A), NOT regular `:`. Two reasons documented in summary:
  - Field-bound text shows `title：testData` in the canvas; user edits the testData inline; commit splits on `：`.

## 13.5 Side effect on options.title / options.testData

- `updateByContent` mutates `options.title` AND `options.testData` per Section 13.4.
- Then `if (!clear): event.trigger(PrintElementSelectEventKey_<tid>, {printElement:e})` `[V1 lines 807-811]` — refreshes prop panel.
- `updateDesignViewFromOptions()` re-renders content.
- `event.trigger(hiprintTemplateDataChanged_<tid>, "编辑修改")` `[V1 line 812]`.
- `_editing = false`.
- Restore drag: `draggable = !options.positionLocked && (options.draggable === undefined || true === options.draggable)`; `hidraggable('update', {draggable})` `[V1 lines 814-815]`.

---

# Section 14 — Page Number

## 14.1 hiprint-paperNumber div behavior at print time

- Created via `createPaperNumber(text, isDesignMode)` (per `paperNumberTarget` references `[V1 line 9420]`, `[V1 line 10912]`).
- Default format string: `paperNumberFormat || defaultPaperNumberFormat` (`${paperNo}-${paperCount}`) `[V1 lines 9421-9430]`.
- Format expansion via `.replace(/\$\{paperNo\}/g, n).replace(/\$\{paperCount\}/g, e).replace(/\bpaperNo\b/g, n).replace(/\bpaperCount\b/g, e)` `[V1 lines 9426-9430]` — supports BOTH `${paperNo}` (template literal style) AND bare `paperNo` (word boundary replace).
- Positioned at `paperNumberLeft/Top` (pt) `[V1 line 9420]`, `[V1 line 9462]`.
- Even-paper offset: `n && this.index % 2 == 1 && (i[0].style.left = "", i.css("right", this.paperNumberLeft + "pt"))` `[V1 line 9420]` — alternates left/right on even-index papers.

## 14.2 hiprint-paperNumber-disabled state

- `paperNumberDisabled` is an `options` field on PrintPanel.
- When `true`: the `<div class="hiprint-paperNumber">` is HIDDEN `[V1 line 9420]` (`.hide()`).
- Set via:
  - Constructor option `t.paperNumberDisabled` `[V1 line 10796]`.
  - Panel-level prop editing (canvas empty click) via callback `[V1 line 10843]`: `e.paperNumberDisabled = !!t.paperNumberDisabled || void 0`.

---

# Section 15 — Window resize / zoom (canvas viewport)

## 15.1 Canvas scale interaction with property panel

- `template.zoom(scale, paperIdx?)` `[V1 lines 12486-12488]` → `editingPanel.zoom(scale, paperIdx)` → `designPaper.zoom(scale)`.
- `designPaper.zoom(s)` `[V1 lines 9468-9477]`:
  - `this.scale = s`.
  - `target.css("transform", "scale(" + s + ")")`.
  - If `s > 1`: `transform-origin: -${s}% -${s}%`.
  - Else: `transform-origin: 0 0`.
  - `triggerOnPaperBaseInfoChanged("缩放")`.
- Property panel does NOT directly react to zoom. The zoom is propagated to:
  - `hidraggable.getScale` callback `[V1 line 889]` for drag scale-awareness.
  - `hireizeable.getScale` callback `[V1 line 1101]` for resize scale-awareness.

## 15.2 Mouse wheel zoom (does V1 support it?)

- **No.** V1 has NO mouse wheel handler. Zoom is ONLY via toolbar buttons (`$zoomIn / $zoomOut`) `[V1 lines 14325-14336]`.
- Toolbar zoom config: `scaleMin = 0.5`, `scaleMax = 5`, `scaleStep = 0.1` (from toolbar-and-shell.md defaults).
- No Ctrl+wheel binding either.

## 15.3 Pan (drag empty area while holding space)

- **Not implemented.** No space-key handler (`keyCode === 32`). No pan-mode state machine.
- The only "drag from empty area" gesture is lasso (Section 1.5).

---

# Section 16 — Element-list panel (drag/keyboard control)

The element-list-panel is the toggleable "☰" floating widget that lists all elements in the active panel.

## 16.1 DOM and creation

- Created by `panel.createElementListPanel()` `[V1 lines 11679-11867]`. Invoked in `panel.design` chain `[V1 line 10887]`.
- Toggle button: `<div class="hiprint-el-list-toggle">☰</div>` `[V1 line 11682]`. Mounted on the paper target.
- Panel: `<div class="hiprint-el-list-panel">` `[V1 line 11684]`. Mounted on `.hiprint-designer-card` (designer card) `[V1 line 11747]` — fallback to `panel.parent()` if card not found.

## 16.2 Drag the panel header

- Header keyboard drag `[V1 lines 11774-11799]`:
  - `e.key === 'ArrowLeft' / keyCode 37`: `applyPanelPosition(pos.left - step, pos.top)`.
  - Arrow Right: `pos.left + step`. Arrow Up: `pos.top - step`. Arrow Down: `pos.top + step`.
  - `step = e.shiftKey ? 30 : 10` (px) `[V1 line 11776]`.
  - `e.key === 'Enter' / keyCode 13`: reset position — clear `positioned` flag, set `left:auto; right:6px; top:40px`, then `ensurePanelPosition()` `[V1 lines 11787-11791]`.
  - `e.preventDefault(); listPanel.data('positioned', true)`.
- Header pointer drag `[V1 lines 11800-11822]`:
  - `e.which !== 1`: ignore (left button only).
  - `if (!listPanel.hasClass("visible"))`: ignore.
  - `ensurePanelPosition()`.
  - Record `dragOffsetX = e.pageX - parentOffset.left - pos.left`, similar for Y.
  - `isDragging = true; e.preventDefault(); e.stopPropagation()`.
  - `body.addClass("hiprint-el-list-dragging")`.
  - **Namespaced binds**: `$(document).on("mousemove.hiprintElListDrag_<tid>", ...)` AND `mouseup.hiprintElListDrag_<tid>` AND `$(window).on("mouseup.hiprintElListDrag_<tid> blur.hiprintElListDrag_<tid>", stopDragging)` `[V1 lines 11815-11821]`.
- `stopDragging` `[V1 lines 11756-11763]`:
  - If `!isDragging`: return.
  - Set `isDragging = false`.
  - `body.removeClass("hiprint-el-list-dragging")`.
  - `$(document).off(".hiprintElListDrag_<tid>")`.
  - `$(window).off(".hiprintElListDrag_<tid>")`.
- `applyPanelPosition(left, top)` `[V1 lines 11710-11722]` clamps to mountTarget bounds.

## 16.3 Click row in list

- Row click `[V1 lines 11925-11939]`:
  - `e.stopPropagation()`.
  - If `$(e.target).is("input")`: return (checkbox/input clicks ignored).
  - If `el.designTarget.css("display") !== "none"`:
    - `el.selectFromList(false)` (Section 1.1's selection path).
    - **Outline flash** `[V1 lines 11936-11937]`: `el.designTarget.css("outline", "2px solid #409eff")`, `setTimeout(() => el.designTarget.css("outline",""), 800)`.

## 16.4 Checkbox toggle visibility

- `cb.on("change", function(e) { e.stopPropagation(); ... })` `[V1 lines 11911-11920]`:
  - If `this.checked`: `el.designTarget.show(); row.removeClass("hidden-el")`.
  - Else: `el.designTarget.hide(); row.addClass("hidden-el")`.
- Also stops `click mousedown mouseup` propagation `[V1 lines 11921-11923]`.

## 16.5 Auto-refresh on data changes

- `event.on("hiprintTemplateDataChanged_<tid>", function() { refreshElementList() ... })` `[V1 lines 11839-11847]` — refreshes list rows on every history-emit.
- `event.on("PrintElementSelectEventKey_<tid>", function(data) { row highlight + scrollIntoView })` `[V1 lines 11849-11867]` — syncs list-row highlight to selection.

---

# Section 17 — Guide lines (orthogonal "参考线") interaction

User-drawn orthogonal guide lines, separate from snap-to-other-element lines (Section 2.6).

## 17.1 Drag from ruler to create guide

- Bound in `bindGuideEvents` `[V1 lines 9546-9565]`:
  - `mousedown.hiprintGuide` on `.hiprint-ruler-handle` `[V1 lines 9550-9554]`:
    - `e.which !== 1`: ignore.
    - `e.preventDefault(); e.stopPropagation()`.
    - `n = $(this).attr('data-guide-type')` (`"h"` or `"v"`).
    - `t.startGuideDrag(n, e)`.

## 17.2 Drag existing guide

- `mousedown.hiprintGuide` on `.hiprint-guide-line` `[V1 lines 9555-9560]`:
  - Read `data-guide-id` and `data-guide-type`.
  - `t.startGuideDrag(i, e, n)`.

## 17.3 Double-click delete guide

- `dblclick.hiprintGuide` on `.hiprint-guide-line` `[V1 lines 9561-9564]`:
  - `removeGuide(n, false, "删除参考线")`.

## 17.4 Guide drag mousemove (rAF-throttled)

- `startGuideDrag(type, e, id?)` `[V1 lines 9566-9610]`:
  - Find or create guide via `getGuideLineById(id)`.
  - `updateGuideDrag(e)` initial position.
  - **rAF throttling** `[V1 lines 9587-9596]`:
    - Single `requestAnimationFrame` queued at a time.
    - mousemove handler stores `_guideMoveLastEv`; on rAF callback, applies latest event.
  - `$(document).on("mousemove<ns>", _onGuideMove)`.
  - `$(document).on("mouseup<ns>", function(t) { cancel rAF; finishGuideDrag(t) })` `[V1 lines 9601-9608]`.
  - `body.addClass("hiprint-guide-dragging")`.
- Namespace: `".hiprintGuideDrag_<templateId>_<panelIdx>_<index>"` `[V1 line 9583]`.

## 17.5 Drop guide out-of-bounds removes it

- `finishGuideDrag` `[V1 lines 9617-9626]`:
  - `if (e.pos < 0 || e.pos > i)`: `removeGuide(e.id, false, "删除参考线")`.
  - Else: clamp to `[0, paperDim]`, render, trigger `"新增参考线"` (if new) or `"移动参考线"` (if existing).

## 17.6 Trigger data-changed events

- `triggerGuideLinesChanged(reason)` `[V1 lines 9485-9486]` calls `onGuideLinesChanged(getGuideLines(), reason)`. The panel's `subscribeGuideLinesChanged` `[V1 lines 10805-10806]` translates this to `event.trigger("hiprintTemplateDataChanged_<tid>", reason)` — so guide changes are part of undo history.
- Reasons: `"参考线"`, `"新增参考线"`, `"移动参考线"`, `"删除参考线"`, `"调整参考线"` (normalize after paper resize) `[V1 line 9646]`.

---

# Section 18 — Header/footer line drag (paper meta)

V1 supports dragging the paper's `headerLinetarget` / `footerLinetarget` divs to change `paperHeader` / `paperFooter` values.

- Bound via `dragHeadLineOrFootLine(t, e, n)` `[V1 lines 9431-9451]`:
  - `t.hidraggable({axis: n ? undefined : "v", ...})` — Y-axis lock unless `n` truthy.
  - `onDrag(t, x, y) { e(x, y) }` — calls user callback with new x,y.
  - `onBeforeDrag`: `HiPrintlib.instance.draging = true`.
  - `onStopDrag`: revert temporary CSS, set `paperHeader/Footer` final pos.
  - **Note**: `hidefooterLinetarget` / `hideheaderLinetarget` class removed on drag-end `[V1 line 9449]` — drag a line to unhide it.

---

# Section 19 — Designer-shell side panel resize

V1's `buildDesigner` shell `[V1 lines 15022-15061]`:

- `$leftResizeHandle.on('mousedown', function (e) {...})` `[V1 lines 15022-15042]`:
  - `e.preventDefault()`.
  - Record `startX = e.pageX, startWidth = parseInt($panelLeft.css('width'), 10)`.
  - `$(document).on('mousemove<ns>', onMouseMove)` and `$(document).on('mouseup<ns>', onMouseUp)`.
  - `onMouseMove`: `newWidth = clamp(startWidth + e.pageX - startX, leftMinW, leftMaxW)`; `applyLeftWidth(newWidth)`.
  - `onMouseUp`: `$(document).off('<ns>')`.
- `$rightResizeHandle.on('mousedown', ...)` `[V1 lines 15043-15062]` mirrors for right panel.
- Namespace: `_designerEventNs` (instance-unique).

---

# Section 20 — Toolbar dialog interactions

(Generic dialog patterns; full toolbar/dialog spec in `toolbar-and-shell.md`.)

- Close-mask click: `.hiprint-toolbar-business-mask, .js-business-close` `[V1 line 13742]`. Similar for template / save `[V1 lines 14000, 14119]`.
- ESC key: `$dialog.on('keydown', function(e) { if (e.keyCode === 27) close() })` for business `[V1 line 13746]`, template `[V1 line 14003]`, save `[V1 line 14123]`.
- Click inside dialog body: `stopPropagation` to prevent mask close `[V1 lines 13752, 14009, 14129]`.

---

# Section 21 — Event-bus key reference (cross-section)

Complete enumeration of all event-bus events triggered by interactions:

| Event key | Where emitted | Where consumed | V1 line(s) |
|---|---|---|---|
| `PrintElementSelectEventKey_<tid>` | designTarget click, selectFromList, updateByContent, table column click | prop panel buildSetting, el-list panel highlight | `[V1 line 752, 808, 848, 6661, 6682]` |
| `BuildCustomOptionSettingEventKey_<tid>` | panel.target click.hiprint | prop panel buildSettingByCustomOptions | `[V1 line 10837]` |
| `hiprintTemplateDataChanged_<tid>` | every commit (drag, resize, key, delete, paste, lock, align, ...) | initAutoSave, el-list refresh, onDataChanged callback | `[V1 lines 812, 894, 1060, 1078, 1116, 1586, 1643, 9626, 11001, 11264, 11313, 11459, 11473, 11481, 11494, 11506, 11513, 11520, 11538, 11563, 11578, 11590, 11608, 11678, 11975, 12049, 12226]` |
| `hiprintTemplateDataShortcutKey_<tid>` | Ctrl+Z, Ctrl+Shift+Z, public `undo()/redo()` | initAutoSave undo/redo branch | `[V1 lines 10953, 10955, 12547, 12550]` |
| `clearSettingContainer` | Delete key handler, prop-panel delete button | prop panel | `[V1 lines 1587, 1593, 12075]` |
| `onSelectPanel` | pagination selectPanel | external listener (no internal consumer) | `[V1 line 12326]` |
| `updateTable<hitableId>` | per-table HiTable | TablePrintElement listener | `[V1 lines 6648-6650]` |

---

# Section 22 — Global state flags (HiPrintlib.instance)

V1 tracks several global drag-state flags used as guards across multiple interaction handlers:

| Flag | Set to true at | Set to false at | Purpose |
|---|---|---|---|
| `draging` | `onBeforeDrag` (every drag), `onBeforeResize` `[V1 lines 884, 1105, 6597]`, `onBeforeSelectAllDrag` `[V1 line 887]`, `startGuideDrag` `[V1 line 9609]`, `dragHeadLineOrFootLine.onBeforeDrag` `[V1 line 9441]` | `onStopDrag` (every drag) `[V1 line 895]`, `onStopResize` `[V1 line 1117]`, `finishGuideDrag` `[V1 line 9622]`, destroy `[V1 line 12586]` | Suppress lasso start when ANY drag is in progress `[V1 line 11409]` |
| `rectDraging` | designPaper mousedown `[V1 line 11411]` | designPaper mouseup `[V1 line 11417]` | Lasso-drag state (allows lasso mousemove update) |
| `changed` | inside `onDrag` callback (every drag step) `[V1 lines 879, 6575]` | `onStopDrag` `[V1 line 896]` | Emit `"移动"` event ONLY if any drag step actually moved (i.e. minMove threshold crossed) |

---

# Section 23 — Selection state queries (helper functions)

| Helper | Returns | V1 line |
|---|---|---|
| `panel.getSelectedElements()` | Lasso's `mouseRectSelectedElement` IF set, else live `.selected`-class scan | `[V1 line 11617]` |
| `BasePrintElement.inRect(rect)` | bool — AABB intersect | `[V1 line 1646]` |
| `BasePrintElement.multipleSelect(bool)` | mutator — toggles `.multipleSelect` class (rarely called) | `[V1 line 1656]` |
| `BasePrintElement.updatePositionByMultipleSelect(dx,dy)` | mutator — applies delta, respects positionLocked guard | `[V1 line 1658]` |

Live `.selected`-class scan filter (canonical) `[V1 line 11622]`:
```
return t.designTarget
  && 'block' == t.designTarget.children().last().css('display')
  && t.designTarget.children().last().hasClass('selected')
  && !t.printElementType.type.includes('table');
```

---

# Section 24 — Idempotency and re-entry guards

- `_shortcutKeyBound` `[V1 line 10946]` — prevents `$(document).keydown` double-bind on second `design()` call.
- `_guideEventsBound` `[V1 line 9548]` — prevents `target.on('.hiprintGuide')` double-bind on `bindGuideEvents` re-entry.
- `template._designed` `[V1 lines 12379-12388]` — on second `design()` invocation, unbind `*.hiprint` events on container, empty DOM, then proceed.
- `template._destroyed` `[V1 line 12579]` — every public method checks via `_assertNotDestroyed(name)` `[V1 line 12554]`; logs warn + returns early.
- `template._isUndoRedoing` `[V1 line 13102]` — prevents `hiprintTemplateDataChanged_` snapshot push during undo/redo replay `[V1 line 13137]`.
- `mouseRect.mouseRectSelectedElement` `[V1 line 11966]` — cached at lasso `onBeforeDrag`; stale-tolerated (live `.selected` scan is fallback in `getSelectedElements`).

---

# Section 25 — Notable V1 quirks / surprising findings (parity hazards)

1. **`shiftKey` INVERTS aspect-ratio lock on SE-handle resize**: most apps use shift to LOCK aspect; V1 uses shift to UNLOCK it `[V1 lines 8305-8315]`. V3 must mirror this exact inversion to avoid behavioral regression.
2. **History snapshot pushes on EVERY arrow key press** (not debounced): a long press of arrow-down can fill 50-entry history in 2-3 seconds `[V1 line 1643]` → `[V1 line 13143]`. V3 should match unless redesign is approved.
3. **No Ctrl+X (cut) exists**: V1 only has Ctrl+C and Ctrl+V `[V1 lines 1477, 11012]`. Cut must be reproduced as "Copy then Delete" by the user.
4. **`copyJson` uses `<textarea id="copyArea">` in body — `pasteJson` READS THE SAME DOM, NOT navigator.clipboard.readText**. So cross-tab paste fails silently `[V1 lines 11018-11022]`. Even if user copies via Ctrl+C in tab A then tries Ctrl+V in tab B, the body-textarea isn't shared.
5. **Lasso visual uses CSS `transform: rotate(180deg)/rotateY(180deg)/rotateX(180deg)` to render the 4 corner cases** `[V1 lines 11988-12015]` — rather than swapping x/y coordinates. Reverse-direction lasso looks DIFFERENT than forward (rotated rect via transform).
6. **`bindHidePanel`-based canvas-empty selection clear only fires if `maxPanelIndex < 2`** `[V1 line 8348]` — i.e. it stops working after 2+ elements have been added. After that, canvas-empty click goes through `panel.target.bind("click.hiprint")` `[V1 line 10809]` which DOES NOT clear selection — only swaps prop panel to panel-level options. So selection persists when clicking empty area in multi-element panels.
7. **`hireizeable.mouseup` listener targets `.easyui-droppable`** (legacy class name) `[V1 line 8120]` to remove the `.resizeing` state — the panel DOES have this class due to legacy compatibility.
8. **Esc does NOT cancel inline edit**: contenteditable element remains editable after Esc; only Enter or selecting another element commits. V3 must replicate this or document the breaking change `[V1 lines 1469-1475]`.
9. **Ctrl+Z works inside `<input>` and `<textarea>`**: the `INPUT/TEXTAREA` guard at `[V1 line 10960]` comes AFTER the Ctrl+Z branch `[V1 lines 10949-10959]` — so Ctrl+Z fires globally and undoes a TEMPLATE action even when user expected text-undo in an input. This is a known V1 UX flaw to consider.
10. **Position-locked elements can still be deleted via keyboard**: the `positionLocked` guard at `[V1 line 1566]` EXPLICITLY allows keyCode 8/46 through `[V1 lines 1568-1570]`. So lock prevents drag/resize but not delete.
11. **Bring-to-front assigns SEQUENTIAL z values per selected element** `[V1 line 11493]` rather than all selected → same max+1. This preserves intra-selection ordering but produces many distinct zIndex values.
12. **Snap-to-other-elements considers ONLY THE SINGLE NEAREST NEIGHBOR** `[V1 line 7573]` (`.slice(0,1)`). Multi-anchor smart guides are NOT supported — only one snap candidate per drag step.
13. **Rotate-handle dblclick resets to 0deg AND calls onResize with R=0** `[V1 lines 8231-8234]` — this emits `"旋转"` reason like a regular rotate end. There is NO separate "reset rotation" reason.
14. **Smart-guide snap is disabled by Ctrl/⌘ during drag** `[V1 line 7538]` — and so is panel-bounds clamping `[V1 line 7538]`. Ctrl-drag = "free move with no snap or bounds".
15. **Arrow-key Shift modifier has NO EFFECT in V1**: many designers use Shift+arrow for 10pt nudge but V1 uses fixed 1.5pt always `[V1 lines 1595-1640]`. Element-list-panel header keyboard drag DOES use Shift for 30px step `[V1 line 11776]`, but that's the floating-panel position, not element nudge.
16. **`createLineOfPosition` cross-hairs append to `.hiprint-printPaper-content`** (not `.resize-panel` overlay) `[V1 line 1390]` — so they appear behind/around the element, full paper-width. Removed on `onStopDrag` and `onStopResize`.
17. **Pasted elements get unique `options.qid` only if `template.qtDesigner === true`** (default) AND `options.field` is set `[V1 lines 11066-11069]`. Without field, no qid is generated.
18. **Element-list panel mousedown propagation is stopped to prevent canvas-click** `[V1 lines 11767-11769]` BUT mouseup is intentionally allowed through to prevent stuck drag-state.
19. **Multi-element style update only fires for the `样式` (Style) tab** `[V1 lines 940-958]` (`tab.name === "样式"`). Base/Border/Advanced tab edits only affect the single focused element. So changing fontSize via property panel WHILE multi-select WILL update all same-type selected; changing position via `coordinate` panel will NOT.

---

# Section 26 — Default constants summary

From `hiprint.config.js`:

| Constant | Value | Used in | hiprint.config.js line |
|---|---|---|---|
| `movingDistance` | `1.5` pt | drag minMove `[V1 line 882]`, keyboard nudge `[V1 line 1579]`, drop rounding `[V1 line 11278]` | line 4 |
| `paperHeightTrim` | `1` mm | paper sizing | line 5 |
| `showPosition` | `true` | cross-hairs labels | line 6 |
| `positionLineMode` | `false` | label placement | line 7 |
| `positionUnit` | `true` | append "pt" to labels | line 8 |
| `showSizeBox` | `true` | size-box display | line 9 |
| `adsorbMin` | `3` pt | snap threshold | line 10 |
| `showAdsorbLine` | `true` | adsorb-line visual | line 11 |
| `adsorbLineMin` | `6` pt | adsorb-line max distance | line 12 |
| `paperNumberContinue` | `true` | page-num continuous numbering | line 13 |

From hidraggable defaults `[V1 lines 7920-7939]`:

| Option | Default | Notes |
|---|---|---|
| `proxy` | `null` | If null, real element drags |
| `revert` | `false` | If true, snap-back on no-drop |
| `cursor` | `"move"` | body cursor during drag |
| `deltaX / deltaY` | `null` | Proxy offset adjustments |
| `handle` | `null` | If null, target itself is handle |
| `disabled` | `false` | When true, cursor cleared |
| `edge` | `0` | Edge-detect padding |
| `axis` | `null` | `"h"` / `"v"` to lock axis |

From hireizeable defaults `[V1 lines 8378-8392]`:

| Option | Default |
|---|---|
| `stage` | `document` |
| `reizeUnit` | `"pt"` |
| `minResize` | `1.5` |
| `showSizeBox` | `true` |
| `showPoints` | `["s","e"]` |
| `noContainer` | `false` |
| `noDrag` | `false` |

---

# Section 27 — End of inventory

Each row in this document represents a single user-visible interaction or sub-state. V3 parity must reproduce every cited V1 line's effect or explicitly document a deviation in `../V3-PARITY-MATRIX.md`.

Cross-references:
- Per-etype overrides → `etypes/<type>.md` (e.g. text dblclick inline edit applies ONLY to text etype but the dblclick TRIGGER is documented here Section 13.1).
- Toolbar buttons → `toolbar-and-shell.md`.
- CSS classes / inline styles → `styles.md`.
- Verification → `e2e/tests/interactions.spec.ts` (Playwright fixtures must lock every section).
