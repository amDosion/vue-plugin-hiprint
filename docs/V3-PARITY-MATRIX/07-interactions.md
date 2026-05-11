# V1 ↔ V3 Parity Matrix: Interaction Layer (etype-agnostic)

**Document Purpose**: Row-by-row parity scorecard for every V1 user-visible behavior catalogued in `docs/V1-INVENTORY/interactions.md` (Sections 1–27) versus the V3 implementation under `src/hiprint-v3/interactions/*` + supporting Vue components + Pinia stores.

**Last Updated**: 2026-05-11
**V1 Source**: `src/hiprint/hiprint.bundle.js` (15353 lines) — annotated in `V1-INVENTORY/interactions.md`.
**V3 Sources**:
- `src/hiprint-v3/interactions/keyboard.ts` (315 lines)
- `src/hiprint-v3/interactions/selection.ts` (341 lines)
- `src/hiprint-v3/interactions/drag-drop.ts` (439 lines)
- `src/hiprint-v3/interactions/resize.ts` (287 lines)
- `src/hiprint-v3/interactions/context-menu.ts` (506 lines)
- `src/hiprint-v3/interactions/panel-reflow.ts` (155 lines)
- `src/hiprint-v3/interactions/index.ts` (59 lines)
- `src/hiprint-v3/interactions/types.ts` (91 lines)
- `src/hiprint-v3/stores/canvas.ts` (507 lines)
- `src/hiprint-v3/stores/history.ts` (198 lines)
- `src/hiprint-v3/components/HiprintCanvas.vue` (431 lines)
- `src/hiprint-v3/components/HiprintPanel.vue` (207 lines)
- `src/hiprint-v3/components/elements/ElementWrapper.vue` (172 lines)

---

## Legend

| Icon | Meaning |
|---|---|
| ✅ | Full parity — V3 behavior matches V1 row exactly. |
| 🟢 | Functional parity with an internal mechanism change that the user cannot observe. |
| 🟡 | Partial parity — present but differs in modifier handling, threshold, side-effect, or visual. |
| 🔴 | Missing — feature not present in V3 (user-visible regression). |
| ⚠️ | Violation / deviation — V3 actively differs in a way that breaks V1 muscle memory. |
| ⏸️ | Out-of-scope for V3 interaction layer (delegated, deferred, or supplanted by V3 architecture). |

**Impact rating** (for ⚠️/🟡/🔴 rows):
- **HIGH** — visibly breaks long-time V1 user muscle memory or business expectations.
- **MEDIUM** — visible but most users can adapt (e.g. cosmetic / threshold tweak).
- **LOW** — invisible to typical user; only matters for power users / scripted callers.

**Citations** to V3 use the pattern `keyboard.ts:LL-LL` (line-numbered ranges); V1 cites quoted from `V1-INVENTORY/interactions.md` reference index.

---

# Section 1 — Element selection

## 1.1 Single click on element body — replace selection

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Click target | `BasePrintElement.designTarget` (`[V1 line 744]`) | `ElementWrapper.vue` rootEl + `enableElementSelection` listener (`selection.ts:120-141`) | 🟢 | — |
| Click debounce 500ms | `if (ev.timeStamp - lastTimeStamp > 500)` `[V1 line 751]` | **No debounce.** Every click fires `canvas.selectElement(id, mode)` (`selection.ts:120-138`) | 🟡 | LOW — duplicate selects are idempotent, rapid clicks no longer suppressed. |
| Replace-selection DOM mutation | `.resize-panel.selected + display:block` per child div `[V1 lines 8178-8181]` | `useCanvasStore.selectElement(id, 'replace')` → `selectedElementIds = new Set([id])` → ElementWrapper class binding `.hiprint-element--selected` (`canvas.ts:354-358`, `ElementWrapper.vue:70-85`) | 🟢 | — |
| Event-bus emit | `event.trigger("PrintElementSelectEventKey_<tid>", {printElement})` `[V1 lines 752-754]` | None. Property panel binds reactively to `canvas.selectedElementIds` | 🟢 | LOW — no event bus needed; reactive bindings replace it. External listeners on `PrintElementSelectEventKey_*` are absent → breaking for V1 integrators. |
| Lasso (`.mouseRect`) cleanup on element click | `n(".mouseRect").remove()` `[V1 line 8344]` | Lasso is local to `enableLasso`'s closure; element click does NOT touch lasso DOM (`selection.ts:191-287`) | 🟡 | LOW — V3 lasso is cleared on its own pointerup; never overlaps with element click flow. |
| `_listOnlySelect` short-circuit | `triggerHandler` w/ `_listOnlySelect:true` skips re-emit `[V1 lines 746-750]` | **Not implemented.** No element-list-row synthetic click path. | 🔴 | LOW — no element-list panel exists in V3 yet (Section 16 below). |

## 1.2 Single click on canvas / panel empty area — clear selection

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Global canvas click (`bindHidePanel`) | Fires only if `maxPanelIndex < 2` `[V1 line 8348]` AND `t.target.className.includes("design")` `[V1 line 8352]` | **Always-on lasso pointerdown** triggers on `e.target === panelEl` (`selection.ts:195-198`). pointerup with zero-size lasso → `selectMultiple([])` → `clearSelection`. | ⚠️ | HIGH — V1's "empty click clears" stops working after 2+ elements (Section 25.6). V3 ALWAYS clears on empty-canvas click (consistent behavior). Breaks the V1 quirk muscle-memory but matches user expectation. |
| Panel-target click → `BuildCustomOptionSettingEventKey_<tid>` | `panel.target.bind("click.hiprint")` rebuilds prop panel with `panelOptions` `[V1 lines 10809-10884]` | **Not implemented.** No panel-level options event channel. Panel property editing is delegated to a V3 paper-properties side panel triggered by toolbar (out of scope here). | 🔴 | MEDIUM — empty canvas click does not swap property panel to panel-level options. Users editing paper margin/watermark via canvas empty click will be surprised. |

## 1.3 Shift+click — adds to selection

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Shift modifier behavior | **Not bound.** Shift+click ≡ plain click → replace (`[V1 line 8172]` only checks `ctrlKey || metaKey`) | Shift+click → `mode='add'` (`selection.ts:81-86`). Multi-select. | ⚠️ | MEDIUM — V1 ignored Shift. V3 honors Shift = add. Users won't notice (additive is expected on web), but exact-V1 parity is broken. |

## 1.4 Ctrl/⌘+click — toggle / add to selection

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Modifier semantics | Ctrl/⌘ = **ADD only** (`[V1 lines 8172-8181]`) — never removes | Ctrl/⌘ = **TOGGLE** (`selection.ts:81-86`, `canvas.ts:360-362`) | ⚠️ | MEDIUM — Ctrl+click on a selected element in V1 = no-op idempotent. In V3 = deselect. Users who learned "Ctrl to add" in V1 will accidentally drop selections. |
| Resize-panel sibling clear under Ctrl | `siblings` NOT cleared when ctrl held `[V1 lines 8172-8177]` | Same effective outcome via `'add'`/`'toggle'` modes (other selection retained) | ✅ | — |

## 1.5 Lasso (drag from empty area)

### 1.5.1 Threshold to start lasso

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Movement threshold | **No threshold** — first mousemove draws `[V1 lines 11410-11415]` | First pointermove updates lasso rect (`selection.ts:224-234`). No threshold. | ✅ | — |
| Qualifying mousedown | `e.buttons===1` + `className.includes("hiprint-printPaper hidroppable design")` + not draging + not editing `[V1 line 11415]` | `e.target === panelEl` + `e.button === 0` (`selection.ts:198-199`). No "editing" or "draging" global flag check. | 🟡 | LOW — V3 cannot have "already-draging" race because drag handlers and lasso live on different DOM hosts (pointer events don't double-fire); but if user simultaneously triggers a drag callback, lasso may concurrently mount. |
| Editing guard | `e.target.className.includes("editing")` → return `[V1 line 11402]` | **Not implemented** — V3 has no `_editing` per-element state in interactions layer; inline editing is per-etype (TextElement contenteditable) which does not bubble to panel pointer. | 🟢 | LOW — guarded structurally by event target check, not class sniff. |

### 1.5.2 Lasso visual (dashed rect)

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| DOM marker | `<div tabindex="1" class="mouseRect" style="...opacity:0.2;border:1px dashed #000;background:#31676f">` appended to `.hiprint-printPaper-content` `[V1 line 11953]` | `<div class="hiprint-lasso">` appended to `document.body` with `border:1px dashed #409eff; background:rgba(64,158,255,0.08); z-index:9999` (`selection.ts:204-216`) | 🟡 | LOW — color and parent host differ but visually equivalent dashed rect. V1 had teal/dark, V3 has blue. |
| 4 corner rotations via `transform: rotate(180deg)/rotateY/rotateX` for reverse-direction lasso | Yes — `[V1 lines 11988-12015]` | **Not implemented.** V3 uses simple min/max computation: `minX = Math.min(startX, e.clientX)` (`selection.ts:226-233`). Reverse drag draws the same dashed rect via standard left/top/width/height. | 🟢 | LOW — V3's approach is visually identical to user; V1's CSS rotation was a peculiar implementation choice (Section 25.5) but produced the same visible rectangle. |
| `tabindex="1"` for keyboard focus | Yes `[V1 line 11953]` | No tabindex; lasso is `pointerEvents:none` (`selection.ts:213`) so it cannot receive focus or keyboard events. | 🔴 | LOW — V3 lasso cannot be arrow-key nudged after creation (Section 1.5.5 below). |

### 1.5.3 Hit detection

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Intersect vs containment | **Intersect** (AABB any-touch) `[V1 lines 1646, 11942-11945]` | **Intersect** via `rectsIntersect()` AABB any-touch (`selection.ts:155-162`) | ✅ | — |
| Skip `draggable:false` elements | Yes — `filter(options.draggable !== false)` `[V1 line 11945]` | **Not honored.** V3 iterates ALL `.hiprint-element[data-element-id]` children (`selection.ts:247-249`). | 🟡 | LOW — V3 has no `options.draggable=false` data path in store; if business sets it, lasso still picks them. |
| Lazy hit recomputation | `mouseRectSelectedElement` cached at `onBeforeDrag` `[V1 line 11966]` | Hit-set computed once at pointerup, dispatched to `selectMultiple` (`selection.ts:243-261`). No cache. | 🟢 | — |

### 1.5.4 Cross-panel selection

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Single-panel only | Yes — `getElementInRect` is `PrintPanel` method `[V1 line 11942]` | Single-panel only — `panelEl.querySelectorAll('.hiprint-element[data-element-id]')` scoped to one panel (`selection.ts:247-249`) | ✅ | — |

### 1.5.5 Endpoint behavior (mouseup releases lasso)

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Lasso rect persists after mouseup | Yes — visible until next mousedown / Esc / element-click `[V1 lines 11416-11417]` | **NO.** Lasso DOM is removed in pointerup `finally` block (`selection.ts:267-271`) | ⚠️ | MEDIUM — V1 power users could re-drag the lasso rect itself to move all enclosed elements (`[V1 lines 11953-11979]`). V3 removes the rect immediately, so this gesture is gone. |
| Lasso rect itself becomes draggable | Yes — `hidraggable` attached `[V1 lines 11953-11979]` reason: `"框选移动"` | **Not implemented.** | 🔴 | MEDIUM — V1 muscle-memory: lasso → drag rect to move group. V3: must drag any selected element directly. |
| Arrow-key nudge on lasso rect | Yes — `bingKeyboardMoveEvent(mouseRect.target)` `[V1 lines 12018-12051]` emits `"框选移动"` | **N/A** — lasso removed at pointerup. Arrow keys fall through to `moveSelection` on the multi-selected elements via `keyboard.ts:121-124`. End-user outcome (group moves) is equivalent. | 🟢 | LOW — Different mechanism, same user-facing result. |

## 1.6 Ctrl+A — select all

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Modifier match | `(ctrlKey \|\| metaKey) && keyCode === 65` `[V1 line 10962]` | `(ctrlKey \|\| metaKey) && !shiftKey && !altKey && key === 'a'/'A'` (`selection.ts:309-313`) | 🟢 | — |
| INPUT/TEXTAREA guard | `[V1 line 10960]` | `isEditableTarget(e.target)` includes `select` + `contentEditable` (`selection.ts:71-79, 305`) | 🟢 | — |
| Scope: active panel only | Yes — iterates `n.printElements` (single panel) `[V1 line 10963]` | Yes — `canvas.activePanel?.printElements` (`selection.ts:315-318`) | ✅ | — |
| Excludes tables | `if (el.printElementType.type.includes('table')) return` `[V1 line 10964]` | **Not excluded.** Tables are selected too (`selection.ts:315`) | 🟡 | LOW — V3 tables become draggable as a whole; selecting them via Ctrl+A is harmless. |
| Locked elements included | Yes (`positionLocked` ignored) `[V1 line 10964]` | Yes — no lock concept in V3 yet | 🟢 | — |
| preventDefault | Yes `[V1 line 10968]` | Yes (`selection.ts:318`) when ≥ 1 element exists | ✅ | — |

## 1.7 Escape — clear selection

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Clears `.selected` classes | Yes `[V1 lines 10972-10975]` | Yes — `canvas.clearSelection()` (`selection.ts:323-329`) | 🟢 | — |
| Does NOT filter out tables | Correct (clears table selection too) `[V1 line 10975]` | Same | ✅ | — |
| Cleans up `mouseRect` | Yes — `[V1 lines 10976-10979]` | **N/A** — V3 lasso never persists past pointerup | ⏸️ | — |
| Does NOT clear property panel | No `clearSettingContainer` emit | V3 prop panel binds to selection reactively → empties on Esc | 🟢 | LOW — different mechanism, same visible result. |
| Does NOT cancel inline edit | Editing remains `_editing=true` `[V1 lines 1469-1475]` (quirk Section 25.8) | V3 inline edit (TextElement contenteditable) is independent; Esc blurs the contenteditable per browser default. | ⚠️ | LOW — V3 Esc DOES cancel inline edit (browser default behavior). V1 did NOT. Most users prefer V3 behavior; V1 muscle-memory loses. |
| preventDefault | Yes `[V1 line 10980]` | **No.** Selection.ts intentionally omits preventDefault on Escape (`selection.ts:328 comment: "Don't preventDefault — Escape may close other UI too."`) | 🟡 | LOW — V3 lets Esc bubble; opens chance for higher-level dialogs to also close. Better UX. |

## 1.8 Tab — cycle selected siblings

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Tab cycling | **Not implemented** `[V1 lines 152-154]`. Tab uses browser default focus walking. | **Implemented** in `keyboard.ts:303-307` → `cycleSelection(canvas, e.shiftKey ? -1 : 1)`. Walks active panel printElements list with wrap. | ⚠️ | MEDIUM — V1 users hitting Tab inside designer expect focus to move to a sidebar / next form field. V3 hijacks Tab to cycle selection. Different + breaks accessibility Tab navigation. |
| Shift+Tab | N/A | direction = -1 (reverse cycle) (`keyboard.ts:303-307`) | ⚠️ | MEDIUM — Same impact. |

## 1.9 Selection visual feedback

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Resize-panel `<div class="resize-panel">` overlay | `background:rgba(0,0,0,0.5)` 8 handles + rotate + del-btn `[V1 lines 8052-8097]` | **Not implemented.** Selected element gets `outline:1px dashed #409eff; outline-offset:-1px` from `ElementWrapper.vue:168-171`. Resize handles are interact.js's invisible edge regions. | ⚠️ | HIGH — V1 users expect to see corner/edge dots + rotate ear + delete X. V3 shows only outline. Loss of visual affordances. |
| `.size-box` text "W×H pt" | Inside `.resize-panel` `[V1 line 8098]` | **Not implemented.** | 🔴 | MEDIUM — User cannot read live width/height while editing. |
| `del-btn` ✕ button | Yes `[V1 line 8099]` | **Not implemented.** | 🔴 | LOW — Delete via Del key works; affordance is missing. |
| `hiprint-lock-badge` 🔒 | When `positionLocked` `[V1 lines 913, 1010]` | **Not implemented.** | 🔴 | LOW — V3 has no lock model yet. |
| Position guidelines (cross-hairs) | `createLineOfPosition` on every drag step `[V1 lines 1380-1451]` | **Not implemented.** | 🔴 | HIGH — V1 users rely on position cross-hairs + pt labels for alignment. Major design-feel regression. |
| `multipleSelect` class | `BasePrintElement.multipleSelect(bool)` — but stale, never called from standard path `[V1 line 1656]` | N/A | ⏸️ | — |
| Element-list-row outline flash 800ms | `[V1 lines 11936-11937]` | **Not implemented** (no list panel) | 🔴 | LOW — Section 16 covers this. |
| Property panel update | Via event bus | Via reactive binding | 🟢 | — |

## 1.10 Event keys (V1 event-bus emits)

| Event | V1 | V3 | Score | Impact |
|---|---|---|---|---|
| `PrintElementSelectEventKey_<tid>` | Emitted everywhere `[V1 lines 752, 808, 848, 6661]` | Not emitted; consumers must subscribe to Pinia `selectedElementIds` directly | 🟡 | LOW — External listeners that hooked event-bus break. V3 integrators must watch the store. |
| `BuildCustomOptionSettingEventKey_<tid>` | Emitted on panel-target click `[V1 line 10837]` | Not emitted; no panel-level options channel | 🔴 | MEDIUM — see 1.2. |
| `clearSettingContainer` | Emitted on delete / prop-panel delete | Not emitted; reactive prop panel handles it | 🟢 | — |
| `onSelectPanel` | Emitted on pagination | `setActivePanel(id)` mutation | 🟢 | — |

---

# Section 2 — Element drag (within panel)

## 2.1 Trigger (mousedown on element body, not on resize handle)

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Plugin | jQuery `$.fn.hidraggable` `[V1 lines 7784-7940]` | interact.js `interact(el).draggable()` (`drag-drop.ts:150-227`) | 🟢 | — |
| Edge guard | Computes rotated bounding box `s(e)` `[V1 lines 7791-7816]` | interact.js owns hit detection on element bounds | 🟡 | LOW — V3 cannot recognize "mousedown just outside rotated visual bounds" the same way; with rotation = 0 (current V3 state of rotation support), identical. |
| `draggable:false` guard | `[V1 lines 7852-7856]` | **Not honored** | 🔴 | LOW — same as Section 1.5.3. |
| Rotate-handle exemption (`r resizebtn`) | `[V1 line 7858]` | N/A — V3 has no rotate handle | ⏸️ | LOW — see Section 5. |
| State capture on mousedown | Captures `startLeft/Top`, `pageX/Y`, parent, rotation `[V1 lines 7839-7876]` | `start` listener captures `dragStartPosPt` from store + `isMultiDrag` flag (`drag-drop.ts:153-173`) | 🟢 | — |

## 2.2 Drag lift offset / cursor change

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Cursor: `"move"` on body during drag | `[V1 line 7474, 7923]` | `cursor: move` static via CSS on `.hiprint-element` (`ElementWrapper.vue:163-167`) | 🟢 | LOW — Different mechanism; cursor on element only, not body. |
| Cursor cleared on mouseup | `setTimeout(()=>body.css("cursor",""),100)` `[V1 lines 7779-7781]` | N/A (cursor never moved to body) | ⏸️ | — |

## 2.3 Drag visual

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Real element moves | Yes — `proxy=null` `[V1 line 7921]` | Yes — element style.left/top patched per move via `updateElement` (`drag-drop.ts:175-205`) | ✅ | — |
| Clone proxy | Palette only `[V1 lines 10720-10723]` | Palette only — `enableElementListSource` clones via `cloneNode(true)` (`drag-drop.ts:271-298`) | ✅ | — |
| Revert option | Default `false` `[V1 line 7922]`. Palette uses `true` `[V1 line 10719]` | **Not implemented** — interact.js drop-fail leaves element at last position. Palette clone is just removed on dragend. | 🟡 | LOW — palette drag onto invalid surface in V1 animates back to start; V3 just discards clone. |
| Position-guide cross-hairs | `createLineOfPosition` per drag step `[V1 lines 1380-1451]` | **Not implemented** | 🔴 | HIGH — see 1.9. |

## 2.4 Snap-to-grid

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| `minMove` (1.5pt threshold via `dragLengthCNum`) | `[V1 lines 7472-7473, 7691]` rounds delta to 1.5pt step | interact.js `snap` modifier with `pt.toPx(gridSize) * scale` step (`drag-drop.ts:93-104`) | 🟡 | MEDIUM — V1 always rounds to 1.5pt. V3 uses `canvas.gridSize` which defaults to **5pt** (`canvas.ts:121`) and ElementWrapper passes it to drag (`ElementWrapper.vue:104`). Step is 5× larger. V1 muscle-memory for 1.5pt nudge is lost. |
| Visual grid (CSS gradient) | `applyGridOptions` `[V1 lines 9709-9726]` default `5mm` step | `linear-gradient` w/ `gridSize` pt step `[HiprintPanel.vue:88-94]` | 🟡 | LOW — Default unit differs (mm vs pt). Both render light gridlines. |
| Drag NOT magnetic to grid lines | Correct | V3 drag IS snap to grid step (`drag-drop.ts:93-103`) | ⚠️ | MEDIUM — V1 visual grid is decorative only; V3 drag DOES snap to it. Different feel: V1 free-form within 1.5pt step, V3 large-step snap. |

## 2.5 Snap-to-guide-lines

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| User-drawn guide lines exist | Yes `[V1 lines 9540-9545]` | **Not implemented** | 🔴 | MEDIUM — see Section 17. |
| Drag snaps to user guides | **No** — V1 doesn't either | N/A | ⏸️ | — |

## 2.6 Snap-to-other-elements (smart guides)

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Snap threshold (`adsorbMin` = 3pt) | `[V1 line 7577]` | **Not implemented** | 🔴 | HIGH — V1 designers depend on smart-guides for edge/center alignment. V3 forces manual alignment via context menu only. |
| 9 horizontal + 9 vertical snap cases | `[V1 lines 7580-7644]` | N/A | 🔴 | — |
| Adsorb-line visual (`adsorbLineMin` 6pt) | `[V1 lines 7647-7686]` | N/A | 🔴 | — |
| Ctrl/⌘ disables snap | `[V1 line 7538]` | N/A — V3 has no snap-to-element to disable | ⏸️ | — |
| Nearest-1 candidate only | `.slice(0,1)` `[V1 line 7573]` | N/A | ⏸️ | — |

## 2.7 Drag with multi-selection (group move)

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Delta application per selected | `[V1 lines 858-880]` | `canvas.moveSelection(dxPt, dyPt)` if `isMultiDrag` true (`drag-drop.ts:181-184`) | ✅ | — |
| `isMultiDrag` captured at dragstart | N/A — V1 recomputes each step | Captured ONCE at start (`drag-drop.ts:167-170`) | 🟢 | LOW — Different but functionally equivalent. |
| Dragging unselected while others are selected | V1: drag only that unselected element + apply delta to others `[V1 lines 873-875]` | V3: if dragged id NOT in selection → `isMultiDrag=false` (`drag-drop.ts:168-170`), single-element move only. Other selected unaffected. | ⚠️ | MEDIUM — V1 behavior is undocumented but observable: drag unselected → moves selected too. V3 fixes this (likely the correct behavior) but breaks the V1 quirk. |
| Lasso (mouseRect) group move emits `"框选移动"` | `[V1 lines 11954-11975]` | N/A — see Section 1.5.5. Multi-move now emits same flow as plain multi-drag. | ⏸️ | — |

## 2.8 Constraint to panel bounds

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Clamp `data.left ∈ [0, paperW - elementW]` | `[V1 lines 7693-7715]` | **Not enforced** in V3 drag handler. interact.js does not restrict by default; `buildModifiers` only adds `snap` (`drag-drop.ts:88-104`). | ⚠️ | MEDIUM — V1 users cannot drag elements off-paper. V3 lets them disappear into bleed area. Save-and-reload still preserves the off-paper position. |
| Rotation-aware diffW/H | `[V1 lines 7699-7702]` | N/A — V3 no rotation | ⏸️ | — |
| Ctrl/⌘ escapes clamp | `[V1 line 7538]` | N/A — no clamp to escape | ⏸️ | — |

## 2.9 Drop commit (mouseup)

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| `removeVerLine/HorLine` snap-line cleanup | `[V1 line 7732]` | N/A | ⏸️ | — |
| `dragLengthC` rounding to step | `[V1 lines 7752-7755]` | interact.js snap modifier already applied per frame | 🟢 | — |
| `onStopDrag` business callback | `[V1 line 7779]` | `onEnd` callback (`drag-drop.ts:207-223`) | ✅ | — |
| Emit `"移动"` reason | `[V1 line 894]` if `changed` was set | **Not emitted.** V3 doesn't push a history snapshot per drag — `useHistoryStore.pushSnapshot()` is the caller's responsibility (see `history.ts:104-117` and ElementWrapper's onEnd no-op `ElementWrapper.vue:105-110`). | 🔴 | HIGH — Undo after drag in V3 doesn't work unless caller explicitly invokes `historyStore.pushSnapshot()`. V1 auto-snapshots on every drag-end. |
| `removeLineOfPosition` cross-hairs cleanup | `[V1 lines 897-902]` | N/A — no cross-hairs | ⏸️ | — |
| History snapshot push | `initAutoSave` consumes `hiprintTemplateDataChanged_<tid>` and pushes 50-cap entry `[V1 lines 13136-13152]` | `history.ts` is **manual-mode** (`useManualRefHistory`, `history.ts:73-80`). Composables must call `pushSnapshot()`. Currently NO interaction module does. | 🔴 | HIGH — Same root cause as previous row. Multiple drag-end events produce no undo entries. |

## 2.10 hiprintTemplateDataChanged event "移动"

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Reason string | `"移动"` (hardcoded CN) `[V1 line 894]` | Not emitted (no event bus) | 🔴 | LOW — Integrators relying on this string break. |

---

# Section 3 — Element drag (cross-panel)

## 3.1 Hover detection of drop target panel

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| `_dragenter/_dragleave/_dragover` events | Yes `[V1 lines 7481-7489, 7719-7726]` | interact.js dropzone `accept` + `overlap: 'pointer'` `(drag-drop.ts:358-364)` | 🟢 | — |
| Active panel auto-selection on hover | Not in V1 | Yes — on drop, `setActivePanel(panelId)` (`selection.ts:131-133`, `drag-drop.ts:381-385`) | 🟢 | LOW — slight UX upgrade. |

## 3.2 Visual feedback during cross-panel drag

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Hover-highlight on destination panel | **No** | **No** (no CSS hover state on `.hiprint-printPaper--dropping` etc.) | ✅ | — |

## 3.3 Coordinate translation

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Palette → panel translation | Pt-space conversion + `mathroundToporleft` `[V1 lines 11246-11266]` | `canvas.addElement(panelId, {tid, options:{...}})` (`drag-drop.ts:380-386`). **Drop position NOT captured.** New element appears at `options` defaults, not the cursor point. | ⚠️ | HIGH — V1 drops the element under the cursor. V3 drops at default-position (likely `0,0`). Major break — users will think drag failed. |
| Cross-panel element drag | V1: **forbidden by clamp** `[V1 lines 7704-7713]` | V3: explicitly supported via `moveElementBetweenPanels` (`drag-drop.ts:397-399`, `canvas.ts:404-437`) | 🟢 | LOW — V3 adds a feature. V1 muscle-memory: "can't move across panels" no longer holds. |

## 3.4 Use case when forbidden

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Cross-panel element drag forbidden | Yes — by clamp | **Allowed in V3** | ⚠️ | MEDIUM — see 3.3. |

---

# Section 4 — Element resize

## 4.1 8 resize handles + rotate

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| 8 directional handles | n/s/w/e/ne/nw/se/sw `[V1 lines 8062-8093]` | interact.js `edges: { top, right, bottom, left }` ONLY — 4 edges, not 8 corners (`resize.ts:152-161`) | 🟡 | LOW — Corners still resize (interact.js auto-handles ne/se/etc. when 2 edges meet at corner). Visual handles however are absent — see 1.9. |
| Rotate handle `r` | Yes `[V1 lines 8094-8097]` | **Not implemented** | 🔴 | MEDIUM — V1 supports rotation via handle. V3 only supports rotation via property panel (out of scope). |
| Per-etype `showPoints` filter | barcode/qrcode get `r`, tables get `nsew` only `[V1 lines 1093, 6565]` | All elements get same 4 edges; no per-etype filter | 🟡 | LOW — `lockAspectRatio` could be set per-etype but isn't currently. |
| BasePrintElement default `["s","e"]` | `[V1 line 8383]` | Default = all 4 edges (`resize.ts:159-160`) | 🟡 | LOW — V3 default is more permissive. Both render visually similarly. |

## 4.2 Per-handle cursor

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Direction-specific cursors | Inline CSS `cursor: nwse-resize` etc. `[V1 lines 8063-8097]` | interact.js auto-sets cursor on edge hover (browser default for interact.js Resizable) | 🟢 | LOW — Cursors appear, may not match V1 exactly. |
| `r` cursor (custom base64 PNG) | `[V1 lines 8094-8097]` | N/A | ⏸️ | — |

## 4.3 Shift modifier — aspect ratio lock

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Modifier semantics | `shiftKey` **BREAKS** ratio (freeform); default LOCKS ratio `[V1 lines 8302-8315]` | `shiftKey` **LOCKS** ratio (when not already `lockAspectRatio:true`); default = freeform (`resize.ts:198-224`) | ⚠️ | HIGH — **INVERTED.** V1 quirk (Section 25.1) is reversed in V3. V1 user holding Shift to break ratio will accidentally LOCK ratio. Power users will lose constraint. |
| Applies on SE handle only | Yes `[V1 line 8305]` | Applies on ANY resize-edge gesture (`resize.ts:200-203`) | ⚠️ | MEDIUM — V1 only honors Shift on the SE corner; V3 honors it everywhere. Different but arguably better UX. |
| Aspect ratio computation | Forced `height = width * ratio` `[V1 lines 8308-8314]` | `widthPt / startRatio` OR `heightPt * startRatio` based on dominant delta (`resize.ts:215-224`) | 🟢 | LOW — Different math but produces a locked aspect. |

## 4.4 Constraints (min, max, panel bounds)

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| `minResize` 1.5pt rounding | `[V1 line 8381]` via `numHandlerText`/`numHandler` | `restrictSize` modifier with `minWidth/minHeight = 5pt` default (`resize.ts:148-149, 173-177`) | 🟡 | LOW — V1: 1.5pt step. V3: 5pt clamp + grid snap. Different feel during resize. |
| `0.75 * t` movement multiplier ("drag feels slower") | `[V1 line 8043]` | **Not present** — interact.js delivers 1:1 delta | ⚠️ | LOW — V3 resize feels faster/more direct. V1 quirk is gone (most users prefer V3). |
| Max size constraint | **None** in V1 | None in V3 | ✅ | — |
| Panel-bound clamping during resize | **None** in V1 | None in V3 | ✅ | — |

## 4.5 Visual during resize

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Real element grows | Yes `[V1 lines 8244-8329]` | Yes — `el.style.width/height` updated per frame (`resize.ts:243-246`) | ✅ | — |
| Size-box text update | Only at mousedown `[V1 line 8107]` — STALE during drag | N/A — no size-box | 🔴 | MEDIUM — see 1.9. |
| `.resizeing` state class | `[V1 lines 8118-8119]` | Not applied | 🔴 | LOW — purely cosmetic. |
| Position cross-hairs during resize | Yes `[V1 line 1113]` | N/A | 🔴 | MEDIUM — same as 1.9. |

## 4.6 Commit on mouseup

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| `onStopResize` callback | `[V1 lines 1115-1118]` | `end` listener fires `onEnd(finalRect)` (`resize.ts:250-258`) | ✅ | — |
| Emit `"大小"` event | `[V1 line 1116]` | Patches `canvas.updateElement` (`ElementWrapper.vue:118-130`). **No history push.** | 🔴 | HIGH — see 2.9 — undo after resize broken. |
| Emit `"旋转"` if rotate gesture | `[V1 line 1116]` | N/A — no rotate gesture | ⏸️ | — |

## 4.7 Multi-select resize

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Multi-element group resize | **Not in V1** | **Not in V3** (only the dragged-edge element resizes) | ✅ | — |
| Context-menu 等宽/等高 | One-shot copy `[V1 lines 11569-11591]` | Not implemented in `context-menu.ts` (current items: copy/cut/paste/bring-to-front/send-to-back/delete/properties — see Section 7) | 🔴 | MEDIUM — V1's batch sizing context-menu items absent. |

## 4.8 hiprintTemplateDataChanged "大小"

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Reason string emit | `"大小"` `[V1 line 1116]` | Not emitted | 🔴 | LOW — see 2.10. |

---

# Section 5 — Element rotate

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| 5.1 Rotate handle | Yes (per-etype `showPoints`) `[V1 lines 8094-8097]` | **Not implemented** | 🔴 | MEDIUM — must use property-panel transform field. |
| 5.1 Property-panel transform input | Yes `[V1 lines 12229-12232]` | Out-of-scope here (per-etype property panel) | ⏸️ | — |
| 5.2 Drag rotate visual (100px = 360°) | `[V1 lines 8257-8268]` | N/A | 🔴 | — |
| 5.3 No angle snap | Correct (continuous) | N/A | ⏸️ | — |
| 5.3 Double-click reset to 0deg | `[V1 lines 8231-8234]` | N/A | 🔴 | LOW — corner reset gesture lost. |
| 5.4 Multi-select rotate | Not in V1 | Not in V3 | ✅ | — |
| 5.5 `transform: rotate()` CSS | Stored as `options.transform` `[V1 line 1121]` | Stored in `options` as opaque key; `computeBaseStyle` may or may not emit it (out-of-scope here) | ⏸️ | — |

---

# Section 6 — Drag from element list / palette

## 6.1 Element list DOM

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| `<a class="ep-draggable-item">` w/ `tid` attr | `[V1 line 9158]` | `enableElementListSource` adds `.hiprint-list-source` class + `data-tid` attr to caller-provided element (`drag-drop.ts:256-258`) | 🟢 | — |
| Built by `PrintElementTypeManager.build` | `[V1 line 10700]` | Caller (sidebar Vue component) responsibility — V3 just registers drag on the row element | 🟢 | — |

## 6.2 Mousedown → drag start

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Look up element type from `tid` | `getElementType(tid, ptype)` `[V1 lines 10727-10742]` | `data-tid` attribute read on drop (`drag-drop.ts:372-378`); factory via WeakMap `_factoryByEl` (`drag-drop.ts:328`) | 🟢 | — |
| Missing type throws | Yes `[V1 line 10733]` | Returns early with `console.warn` (`drag-drop.ts:373-378`) | 🟡 | LOW — V3 fails silently. |
| Set `HiPrintlib.instance.draging = true` | Yes `[V1 line 10728]` | Not tracked globally — multiple interact.js sessions can in theory overlap, but unlikely | 🟢 | — |
| `setDragingPrintElement(ele)` global | Yes `[V1 line 10739]` | N/A | ⏸️ | — |

## 6.3 Helper visual

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Cursor-following clone | `proxy:function(t){...}` `[V1 lines 10720-10723]` | `cloneNode(true)` → appended to body w/ `position:fixed, z-index:9999, opacity:0.85, transform:translate(-50%,-50%)` (`drag-drop.ts:280-294`) | ✅ | — |
| Helper z-index 9999 | Yes | Yes | ✅ | — |
| Revert on no-drop | `revert:true` `[V1 line 10719]` | Clone simply removed; no animation back (`drag-drop.ts:309-318`) | 🟡 | LOW — see 2.3. |

## 6.4 Drop detection

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| `accept: '.ep-draggable-item'` | Yes `[V1 line 11249]` | `accept: '.hiprint-element, .hiprint-list-source'` (`drag-drop.ts:359`) | 🟢 | — |
| Hover-detected drop | Yes | `overlap:'pointer'` — cursor inside dropzone (`drag-drop.ts:364`) | 🟢 | — |
| Disabled panel still drops | Yes (no guard) `[V1 lines 11199-11206]` | Same — no disabled state in V3 panel store | 🟢 | — |

## 6.5 Coordinate translation (drop XY → element left/top)

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Pt-space conversion | `(r.left - paperOffsetLeft) / scale` `[V1 lines 11254-11256]` | **Not implemented.** `addElement` receives `options:{}` (or factory-provided defaults); no drop-position translation. (`drag-drop.ts:380-386`) | ⚠️ | HIGH — see 3.3. |
| `mathroundToporleft` rounding to `movingDistance` | `[V1 lines 11277-11279]` | N/A | ⏸️ | — |

## 6.6 Default size for new element

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Per-etype `default: {width, height}` config | `[hiprint.config.js text/longText/table/... lines]` | Caller-supplied via `createElement` factory; V3 itself has no etype-default registry yet | 🟡 | LOW — Once V3 etype config is filled in, parity restored. |
| `initSizeByHtml` for fit-to-content | `[V1 line 11283]` | Not implemented | 🔴 | LOW — for image/html etypes. |

## 6.7 Field binding pre-set

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| `printElementType.field` pre-applied | `[V1 line 9158]` via type config | Caller's factory responsibility | ⏸️ | — |

## 6.8 New element id generation

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| `HiPrintlib.guid()` | Yes | `crypto.randomUUID()` else timestamp fallback (`canvas.ts:71-76`) | ✅ | — |
| `qtDesigner` qid auto-numbering | `qtDesignerMap` counts shared field prefix `[V1 lines 11260-11262, 12347-12366]` | **Not implemented** | 🔴 | LOW — auto-numbering of same-field elements is gone. |

## 6.9 History snapshot

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Emit `"新增"` reason → snapshot | `[V1 line 11264]` | No push (`drag-drop.ts:380-385`) | 🔴 | HIGH — same as 2.9, 4.6. |

## 6.10 hiprintTemplateDataChanged "新增"

| Reason string | Not emitted | 🔴 | LOW — same as 2.10. |

---

# Section 7 — Right-click context menu

## 7.1 Standard menu items

V1 has 20 potential items in 6 groups `[V1 lines 11432-11610]`. V3 has 7 items via `buildElementContextItems` (`context-menu.ts:340-398`).

| V1 item | V3 equivalent | Score | Impact |
|---|---|---|---|
| **复制元素** (Copy) | `id:'copy'` shortcut Ctrl+C — same | ✅ | — |
| **粘贴元素** (Paste) | `id:'paste'` shortcut Ctrl+V — same | ✅ | — |
| **字体 12pt** (Font Size 12) | Missing | 🔴 | LOW — pre-canned font shortcut. |
| **字体加粗** (Font Bold) | Missing | 🔴 | LOW — same. |
| **置于顶层** (Bring to Front) | `id:'bring-to-front'` — same | 🟡 | MEDIUM — V3 reorders array (`context-menu.ts:468-488`), V1 uses zIndex math. Visible result similar with single selection but multi-select differs (see 10.3). |
| **置于底层** (Send to Back) | `id:'send-to-back'` — `unshift` (`context-menu.ts:490-506`) | 🟡 | MEDIUM — same. |
| **上移一层** (Layer Up) | Missing | 🔴 | MEDIUM — V1 has both granular up/down + extreme. V3 only extreme. |
| **下移一层** (Layer Down) | Missing | 🔴 | MEDIUM — same. |
| **锁定元素 / 解锁** | Missing (no lock model) | 🔴 | MEDIUM — see 1.9. |
| **对齐 (6 items)** left/right/top/bottom/h-center/v-center | Missing | 🔴 | HIGH — V1 critical group-alignment feature. |
| **水平等距 / 垂直等距** | Missing | 🔴 | MEDIUM — same. |
| **等宽 / 等高** | Missing | 🔴 | MEDIUM — same. |
| **删除选中元素** (Delete) | `id:'delete'` shortcut Delete — single-only via `_findElement` (`context-menu.ts:462-466`) | 🟡 | MEDIUM — V1 deletes ALL selected; V3 deletes only the right-clicked element. |
| — (V1 has no Cut) | `id:'cut'` shortcut Ctrl+X added in V3 | ⚠️ | LOW — V3 adds feature; harmless. |
| — | `id:'properties'` (no-op stub) | 🟢 | — |

## 7.2 Item visibility conditions

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Menu shows iff `hasSelection || hasCopy` | `[V1 line 11428]` | Menu shows iff `[data-element-id]` ancestor found in target (`HiprintCanvas.vue:246-252`) | 🟡 | LOW — V3 background right-click falls through to native context menu (`HiprintCanvas.vue:249-251`). |
| `Copy` enabled only with selection | Yes | Always enabled (V3 silently no-ops without selection via `_findElement` returning null) (`context-menu.ts:436-440`) | 🟡 | LOW — disabled state not shown; click silently fails. |
| Group 5 align only if `>= 2` selected | Yes | N/A — not implemented | ⏸️ | — |
| Group 5 distribute only if `>= 3` selected | Yes | N/A | ⏸️ | — |

## 7.3 Item enable/disable conditions

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| `.disabled` class application | Yes `[V1 line 11435]` | Yes — `disabled: true` prop on `ContextMenuItem` adds `is-disabled` class (`context-menu.ts:221-228`) | ✅ | LOW — Wire-up exists; no item currently uses it. |
| Click guard at handler | `if (!hasSelection) return` `[V1 line 11438]` | Items are emitted with no guard; `pick()` only checks `divider || disabled` `(context-menu.ts:204-207)` | 🟢 | — |
| Lock toggle text computed | `selectedEls.some(el => locked) ? '解锁' : '锁定'` `[V1 line 11525]` | N/A | ⏸️ | — |

## 7.4 Item handler signatures

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Menu removed before action | `$(".hiprint-ctx-menu").remove()` first line in each handler | Same — `pick()` → `close()` (`context-menu.ts:299-303`) | ✅ | — |
| Emit `hiprintTemplateDataChanged_*` with reason | `"粘贴"/"层级"/etc.` | Not emitted | 🔴 | LOW — same as 2.10. |

## 7.5–7.6 Menu construction + position

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| DOM construction | `$('<div class="hiprint-ctx-menu"></div>')` | Vue 3 SFC mounted to portal div on `document.body` (`context-menu.ts:269-321`) | 🟢 | — |
| Position offset 2px down-right of cursor | `e.pageX+2, e.pageY+2` `[V1 line 11613]` | `@floating-ui/vue` with `offset(4), flip(), shift({padding:4})` — placement `bottom-start` (`context-menu.ts:150-154`) | 🟢 | LOW — Different offsets, plus V3 flips to fit viewport (V1 overflows screen). |
| Viewport-edge clamp | **None** in V1 | `flip() + shift()` clamps (`context-menu.ts:153`) | 🟢 | LOW — V3 improvement. |

## 7.7 Menu close triggers

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Click outside | `$(document).one("click.hiprintCtxMenu")` `[V1 line 11615]` | `mousedown` + `contextmenu` listeners on document, capture phase (`context-menu.ts:192-202`) | 🟢 | LOW — V3 dismisses on mousedown (faster). |
| Item-clicked | Handler removes menu | `pick()` → `close()` | ✅ | — |
| **Escape** | **Not bound** in V1 | Bound — `e.key === 'Escape'` (`context-menu.ts:181-186`) | ⚠️ | LOW — V3 adds Escape close; users may rely on it (V1 didn't have it). |
| Re-open removes old | `$(".hiprint-ctx-menu").remove()` `[V1 line 11429]` | `activeMenu?.close()` in HiprintCanvas (`HiprintCanvas.vue:253-258`) | ✅ | — |

## 7.8 Etype-specific items

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| HiTable column-header menu | Per-etype `[V1 line 6647]` | Out of scope (per-etype) | ⏸️ | — |

---

# Section 8 — Keyboard navigation

## 8.1 Arrow keys — move selected

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Step distance default | `movingDistance = 1.5pt` `[V1 line 1579]` always | `moveStep = 1pt` default, `bigMoveStep = moveStep * 10 = 10pt` (`keyboard.ts:54-58, 221-223`) | ⚠️ | HIGH — V1: 1.5pt always. V3: 1pt nudge / 10pt with Shift. Different unit + 33% smaller step. |
| Shift modifier | **No effect** — V1 ignores Shift on arrows `[V1 lines 1595-1640]` (Section 25.15) | **Shift = 10pt nudge** (`keyboard.ts:280`) | ⚠️ | HIGH — Major V1 quirk inversion. V1 user holding Shift for "bigger move" gets identical 1.5pt step; V3 user holding Shift gets 10× step. NB: this is what most apps DO, but V1 didn't. |
| INPUT/TEXTAREA guard | `[V1 lines 1557-1559]` | `isEditableTarget(e.target)` includes `select` + contenteditable (`keyboard.ts:66-74`, `keyboard.ts:234`) | 🟢 | — |
| Editing guard `!alt` | `n._editing && !r.altKey` `[V1 lines 1561-1563]` | Inline edit is per-etype; keyboard handler checks `isContentEditable` via `isEditableTarget` (`keyboard.ts:73`). Alt-modifier carve-out NOT replicated. | 🟡 | LOW — V1 power user could Alt+Arrow inside contenteditable to MOVE the element. V3: Alt+Arrow inside contenteditable → does nothing (handler returns at editable check). |
| `positionLocked` lock | Lock prevents arrow nudge except Delete `[V1 lines 1565-1573]` | No lock model | ⏸️ | LOW — see 1.9. |
| Multi-select arrow nudge | `els.forEach(t.updatePositionByMultipleSelect(dx,dy))` `[V1 lines 1597-1599]` | `canvas.moveSelection(dx, dy)` (`keyboard.ts:121-124`) | ✅ | — |
| Emit `"键盘移动"` per keypress | `[V1 line 1643]` (Section 25.2) | No history push per keypress | 🔴 | HIGH — see 2.9. Also V1 quirk #2: per-press history is gone. |
| preventDefault | Yes `[V1 line 1642-1644]` | Yes (`keyboard.ts:283-299`) | ✅ | — |

## 8.2 Tab — cycle selected

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Tab cycling app-level | **Not implemented** `[V1 lines 152-154]` | Implemented — `cycleSelection(canvas, ±1)` (`keyboard.ts:193-215, 303-307`) | ⚠️ | MEDIUM — see 1.8. |

## 8.3 Delete / Backspace — delete selected

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| keyCodes 8/46 | Both `[V1 lines 1582-1594]` | `e.key === 'Delete' || 'Backspace'` (`keyboard.ts:273-277`) | ✅ | — |
| Delete all selected | Yes `[V1 lines 1589-1593]` | Yes — iterates `selectedElementIds` (`keyboard.ts:103-119`) | ✅ | — |
| `positionLocked` can still be deleted | Yes (V1 quirk Section 25.10) `[V1 line 1568]` | N/A — no lock model. Result: same — can delete. | ✅ | — |
| Emit `"删除"` event | `[V1 line 1586]` | Not emitted | 🔴 | LOW — see 2.10. |
| Emit `clearSettingContainer` | `[V1 line 1587]` | N/A — reactive prop panel | 🟢 | — |
| Del-X button → synthetic keydown 46 | `[V1 lines 8111-8114]` | N/A — no del-btn | ⏸️ | — |

## 8.4 Esc

See 1.7.

## 8.5 Ctrl+A

See 1.6.

## 8.6 Ctrl+Z / Ctrl+Y

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Ctrl+Z = undo | `[V1 lines 10949-10959]` | Yes (`keyboard.ts:238-246`) | ✅ | — |
| Ctrl+Shift+Z = redo | Yes `[V1 lines 10950-10952]` | Yes (`keyboard.ts:239-243`) | ✅ | — |
| Ctrl+Y = redo | **Not bound** in V1 (Section 25 #9 references the Shift+Z) | Yes (`keyboard.ts:247-251`) | ⚠️ | LOW — V3 adds idiomatic Windows redo. Users expecting Ctrl+Y in V1 are pleasantly surprised. |
| Works inside INPUT/TEXTAREA | Yes — guard at `[V1 line 10960]` is AFTER Ctrl+Z block (Section 25.9) | **No** — V3 isEditableTarget returns early before Ctrl+Z (`keyboard.ts:234`) | ⚠️ | MEDIUM — V1 quirk: Ctrl+Z in `<input>` undoes TEMPLATE state (annoying!). V3 fixes this; user inside an input gets browser-native undo. **Better UX, V1 muscle-memory loses.** |
| History capacity | 50 entries `[V1 line 13144]` | 50 default (`history.ts:36`) | ✅ | — |
| Branch truncation on new edit | Yes `[V1 lines 13140-13142]` | Yes — vueuse `useManualRefHistory` semantics | ✅ | — |

## 8.7 Ctrl+C / Ctrl+V / Ctrl+X — clipboard

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Ctrl+C (copy) | `copyJson` per-element `[V1 lines 1467-1481]` | `copySelection(canvas)` writes to internal `_clipboard` (`keyboard.ts:126-145, 254-259`) | 🟢 | — |
| Ctrl+V (paste) | `pasteJson` per-panel `[V1 lines 11006-11016]` | `pasteSelection(canvas)` reads `_clipboard` (`keyboard.ts:147-172, 260-264`) | 🟢 | — |
| **Ctrl+X (cut)** | **NOT implemented** `[V1 lines 1259]` Section 25.3 | **Implemented** — `cutSelection = copy + delete` (`keyboard.ts:174-177, 265-269`) | ⚠️ | LOW — V3 adds feature; harmless to V1 users. |
| Paste offset | First element: cursor pos OR (left+10, top+10); others preserve incrementPosition `[V1 lines 11036-11058]` | All elements: `(left+10, top+10)` (`keyboard.ts:153-159`) | 🟡 | MEDIUM — V1 preserves multi-element spatial layout via incrementPosition. V3 stacks all pasted at same offset — multi-paste collapses elements onto each other. |

## 8.8 Page Up / Page Down

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Switch panel | **Not bound** | **Not bound** | ✅ | — |

## 8.9 Where keys are bound

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Per-element designTarget keydown | `bingKeyboardMoveEvent` `[V1 line 1556]` | Single `window` keydown via `enableDesignerKeyboard` (`keyboard.ts:311`) | 🟢 | LOW — V3 simpler; doesn't lose events when focus is on panel. |
| `$(document).keydown` for shortcuts | `[V1 line 10949]` | `window.addEventListener` (`selection.ts:337`, `keyboard.ts:311`) | 🟢 | — |
| Lasso-rect keyboard | `bingKeyboardMoveEvent(mouseRect.target)` `[V1 line 12018]` | N/A — lasso ephemeral | ⏸️ | LOW — see 1.5.5. |

## 8.10 Bubbling / preventDefault

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| arrow / undo / paste / delete preventDefault | Yes | Yes (`keyboard.ts:283-299`) | ✅ | — |
| stopPropagation NOT called in keyboard handlers | Correct | Same (`keyboard.ts:233-308`) | ✅ | — |

---

# Section 9 — Clipboard (Ctrl+C/V/X)

## 9.1 Clipboard storage

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Storage medium | **BOTH** system clipboard (`navigator.clipboard.writeText`) AND `<textarea id="copyArea">` in body `[V1 lines 1503-1519]` | **Module-level `_clipboard: CanvasElement[]`** array (`context-menu.ts:407`); shared between keyboard.ts + context-menu.ts via `_setClipboard/_getClipboard` (`keyboard.ts:42, context-menu.ts:410-417`) | ⚠️ | HIGH — V1 wrote to navigator.clipboard. V3 does NOT — explicitly documented as intentional (`keyboard.ts:20-25`). External clipboard tools (cross-app paste of element JSON) lose visibility. **However V1 paste read only `<textarea>` — V3 paste reads only its own array. Both fail cross-tab in practice.** |
| Read at paste time | `<textarea id="copyArea">.text()` `[V1 line 11022]` | `_getClipboard()` (`keyboard.ts:148`) | 🟢 | LOW — Different mechanism, same effective behavior: paste only works for what you copied in this designer instance. |
| Cross-tab paste fails silently | Yes (Section 25.4) | Yes | ✅ | — |
| Cross-tab COPY captured by external apps | Yes — system clipboard has the JSON | No — V3 internal-only | 🔴 | LOW — V1 user could paste designer JSON into a text editor. V3 cannot. |
| Context-menu copy uses `panel._contextCopyElements` (separate from Ctrl+C) | Yes `[V1 line 11440]` | NO — context-menu + keyboard share the SAME `_clipboard` (`context-menu.ts:407, keyboard.ts:42`) | 🟢 | LOW — V3 unifies. V1 had two parallel clipboard buffers. |

## 9.2 Single element copy / paste — offset

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Paste offset | First element: cursor pos OR `(left+10, top+10)`; subsequents preserve relative `[V1 lines 11036-11058]` | All: `(left+10, top+10)` (`keyboard.ts:153-159`) | 🟡 | MEDIUM — see 8.7. |
| Use mouse position if right-click | `useMouse = e.currentTarget.className !== e.target.className` `[V1 lines 11040-11048]` | N/A — V3 always uses +10 offset; mouse cursor pos NOT captured | 🟡 | MEDIUM — V1 right-click → paste places at cursor. V3 places at (+10, +10). |
| Source element must still exist | `getElementById(obj.id)` `[V1 line 11031]`. Deleted-source → silent fail | N/A — V3 clipboard stores deep snapshot of options (`keyboard.ts:130-144`); source deletion doesn't break paste | 🟢 | LOW — V3 fixes V1 limitation. |

## 9.3 Multi-element copy / paste

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Preserves spatial relationship | Yes via `incrementPosition` `[V1 lines 11053-11058]` | NO — see 8.7 / 9.2 | ⚠️ | MEDIUM — see 8.7. |
| Multi-paste array iteration | Yes `[V1 line 11027]` | Yes (`keyboard.ts:156-168`) | ✅ | — |

## 9.4 Cross-template paste support

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Cross-tab/template paste fails | Yes (id lookup fails) | Yes (module-scoped clipboard) | 🟢 | — |

## 9.5 Cut

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Cut implemented | **No** | **Yes** — `cutSelection = copy + delete` (`keyboard.ts:174-177`) | ⚠️ | LOW — V3 adds. Harmless. |

## 9.6 Conflict with inline text editing

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Ctrl+V inside contenteditable still pastes ELEMENT | Yes V1 quirk `[V1 line 11011]` Section 25 #9 | **NO** — V3 `isEditableTarget` returns early (`keyboard.ts:234`) | 🟢 | LOW — V3 fixes V1 bug; Ctrl+V inside contenteditable now does browser-native text paste. |
| Ctrl+C inside contenteditable copies ELEMENT | Yes V1 quirk `[V1 line 1477]` Section 25 #9 | **NO** — same | 🟢 | LOW — same fix. |

---

# Section 10 — Z-order

## 10.1 Bring/send actions

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Context menu items | 4 items (bring/send/up/down) `[V1 lines 11488-11522]` | 2 items (bring-to-front / send-to-back) only (`context-menu.ts:373-382`) | 🔴 | MEDIUM — granular up/down missing. |
| Keyboard `Ctrl+[`/`Ctrl+]` | Yes (`±1`) `[V1 lines 10983-11004]` | **Not implemented** | 🔴 | MEDIUM — power-user shortcut lost. |
| `Ctrl+Shift+[/]` (extreme) | Yes `[V1 lines 10985-10987]` | **Not implemented** | 🔴 | MEDIUM — same. |
| Bring-to-front algorithm | Assigns sequential `maxZ + 1 + i` `[V1 line 11493]` | Reorders `printElements` array via splice/push (`context-menu.ts:476-487`) | 🟡 | MEDIUM — Different mechanism. With multi-select, V3 only acts on the right-clicked element (id, not selection); V1 acts on all selected. |
| Send-to-back algorithm | `baseZ + i` for selected, bump others up `[V1 lines 11497-11507]` | `unshift` single element (`context-menu.ts:497-505`) | 🟡 | MEDIUM — same. |
| Emit `"层级"` reason | Yes | Not emitted | 🔴 | LOW — see 2.10. |

## 10.2 Where z-order lives

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| `options.zIndex` numeric | Yes `[V1 line 11519]` | Stored in `options` but V3 z-order is **array-order driven** (later elements paint last) | ⚠️ | LOW — V1 users editing `zIndex` numerically via property panel get inconsistent ordering. V3 ignores `options.zIndex` for paint order. |
| `panel.printElements` array order | Yes | Yes — V3 single source of truth | 🟢 | — |
| `Math.max(0, ...)` clamp | Yes `[V1 line 11519]` | N/A | ⏸️ | — |

## 10.3 Multi-select reordering

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Preserves intra-selection relative order | Yes `[V1 line 11493]` | Only operates on the right-clicked element, NOT the multi-selection | ⚠️ | HIGH — User selects 3 → right-click "bring to front" → in V1 all 3 come forward; in V3 only the clicked one. |

---

# Section 11 — Undo / redo / history

## 11.1 Snapshot trigger

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Auto-snapshot on every commit | Yes via `hiprintTemplateDataChanged_*` listener `[V1 line 13136]` | **NO** — `useHistoryStore` is manual-mode (`history.ts:104-117`). Composables must call `pushSnapshot()`. **None of the interaction modules do.** | 🔴 | HIGH — Undo doesn't work after drag/resize/delete/paste. Major regression unless callers wire `pushSnapshot()` after every mutation. |
| Per-arrow-key snapshot push | V1 quirk Section 25.2 — fills 50-entry stack in 2-3s | N/A — no auto-snapshot at all | 🔴 (regression) / 🟢 (V1 quirk fix) | — — paradox: if V3 wires pushSnapshot per arrow, V1 quirk #2 returns. Likely V3 will batch per-edit-group. |

## 11.2 History depth

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Default 50 entries | `[V1 line 13144]` | Default 50 (`history.ts:36`) | ✅ | — |
| Slice oldest when over | Yes | Yes (vueuse `useManualRefHistory` capacity) | ✅ | — |
| Configurable | No public API | `historyStore.setCapacity(n)` (`history.ts:166-177`) | 🟢 | — |

## 11.3 Snapshot content

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Full JSON | `getJson()` or `getJsonTid()` `[V1 line 13138]` | `{ panels, activePanelId, timestamp }` deep-cloned via `structuredClone` (`history.ts:48-60, 109-117`) | 🟢 | LOW — V3 excludes scale/gridSize from undo intentionally. |
| Diff-based | No | No | ✅ | — |
| `id: guid()` per entry | Yes `[V1 line 13143]` | Timestamp only (`history.ts:65-69`) | 🟢 | LOW — V3 doesn't expose stable entry ids. |

## 11.4 Branch behavior

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Truncate forward on new edit | Yes `[V1 lines 13140-13142]` | Yes via vueuse semantics | ✅ | — |

## 11.5 Other

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Rollback on `update()` throw | `historyPos = prevPos` `[V1 lines 13107, 13125-13127]` | vueuse handles internally; less defensive | 🟡 | LOW — Edge case rarely triggers. |
| `_isUndoRedoing` re-entrancy flag | Yes `[V1 line 13102]` | Not exposed; vueuse manages | 🟢 | — |
| Cleanup on destroy | `historyList = []` `[V1 line 12641]` | `historyStore.clear()` (`history.ts:149-160`) | ✅ | — |

---

# Section 12 — Property panel binding

## 12.1 How property panel detects selection change

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Listener mechanism | Event bus `PrintElementSelectEventKey_<tid>` `[V1 lines 12071-12077]` | Reactive Pinia: prop panel watches `canvas.selectedElementIds` + `canvas.activePanel` | 🟢 | — |
| `BuildCustomOptionSettingEventKey_<tid>` for panel-level | `[V1 line 12567]` | N/A — see 1.2 | 🔴 | MEDIUM — see 1.2. |
| `clearSettingContainer` | Yes `[V1 line 12075]` | Reactive — empty selection → empty panel | 🟢 | — |

## 12.2 Multi-select union vs intersection

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Property panel single-element only | Yes — `t.printElement = i` `[V1 line 12105]` | Out-of-scope here (per-etype) | ⏸️ | — |
| Style-tab multi-update | `els.filter(same type)`, apply to all `[V1 lines 940-958]` | Out-of-scope | ⏸️ | — |

## 12.3 Edit commit triggers

Out-of-scope here.

---

# Section 13 — Inline editing (text only)

## 13.1 Double-click triggers contenteditable

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Dblclick → contenteditable | `[V1 lines 757-775]` | Per-etype — TextElement component (out of scope here, but ElementWrapper does not block dblclick) | ⏸️ | — |
| Disable drag during edit | `hidraggable('update', {draggable:false})` `[V1 line 762]` | **Not implemented** in interaction layer — interact.js drag remains active during contenteditable focus | ⚠️ | MEDIUM — V1 user double-clicks to edit text; V3 may accidentally start drag. |
| Click in contenteditable doesn't propagate | `if (e._editing) ev.stopPropagation()` `[V1 lines 766-770]` | Not implemented | ⚠️ | MEDIUM — Click inside text editor will re-fire selection click. |

## 13.2–13.5

Out-of-scope here (per-etype).

---

# Section 14 — Page Number

Out-of-scope here (per-etype panel options).

---

# Section 15 — Window resize / zoom (canvas viewport)

## 15.1 Canvas scale interaction

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| `template.zoom(scale)` | Yes `[V1 lines 12486-12488]` | `canvas.setScale(s)` clamped 0.1..5 (`canvas.ts:440-446`) | 🟢 | — |
| CSS transform applied | Yes `[V1 lines 9468-9477]` | Yes (`HiprintPanel.vue:96-99`) | ✅ | — |
| Drag scale-aware | `hidraggable.getScale` callback `[V1 line 889]` | `screenPxToPt(dx / scale)` (`drag-drop.ts:76-79`) | ✅ | — |
| Resize scale-aware | Yes `[V1 line 1101]` | Pt computed from px via `px.toPt` (`resize.ts:97-100`); does NOT divide by scale | ⚠️ | MEDIUM — V3 resize delta may be off when scale ≠ 1. Verify needed. |
| `triggerOnPaperBaseInfoChanged("缩放")` | Yes | Not emitted | 🔴 | LOW. |

## 15.2 Mouse wheel zoom

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Wheel zoom | **No** | **No** | ✅ | — |
| Ctrl+wheel zoom | **No** | **No** | ✅ | — |

## 15.3 Pan

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Space+drag pan | **No** | **No** | ✅ | — |

---

# Section 16 — Element-list panel (drag/keyboard control)

## 16.1–16.5 Entire panel feature

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Element list panel `☰` toggle | Yes `[V1 lines 11679-11867]` | **Not implemented** | 🔴 | HIGH — V1 designers heavily use this for managing 20+ element layouts. Major regression. |
| Header keyboard drag (arrow + shift = 30px) | Yes `[V1 lines 11774-11799]` | N/A | 🔴 | — |
| Header pointer drag (namespaced binds) | Yes `[V1 lines 11800-11822]` | N/A | 🔴 | — |
| Row click → selectFromList | Yes `[V1 lines 11925-11939]` | N/A | 🔴 | — |
| Checkbox visibility toggle | Yes `[V1 lines 11911-11920]` | N/A | 🔴 | — |
| Auto-refresh on data changes | Yes `[V1 lines 11839-11847]` | N/A | 🔴 | — |

---

# Section 17 — Guide lines (orthogonal "参考线")

## 17.1–17.6 Entire feature

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Drag from ruler to create guide | Yes `[V1 lines 9550-9554]` | **Not implemented** — V3 ruler is SVG-only (`HiprintCanvas.vue:301-363`), no `.hiprint-ruler-handle` drag source | 🔴 | HIGH — Layout designers depend on user guides. |
| Drag existing guide | `[V1 lines 9555-9560]` | N/A | 🔴 | — |
| Dblclick delete | `[V1 lines 9561-9564]` | N/A | 🔴 | — |
| rAF-throttled drag | `[V1 lines 9587-9596]` | N/A | 🔴 | — |
| Out-of-bounds drop deletes | `[V1 lines 9617-9626]` | N/A | 🔴 | — |
| Data-change events `"新增参考线/移动参考线/删除参考线/调整参考线"` | `[V1 line 9626]` | N/A | 🔴 | LOW. |

---

# Section 18 — Header/footer line drag (paper meta)

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Drag `headerLinetarget`/`footerLinetarget` to change `paperHeader/Footer` | Yes `[V1 lines 9431-9451]` | **Not implemented as drag.** V3 renders static dashed lines at `paperHeader/paperFooter` positions (`HiprintPanel.vue:107-141`); changing them requires property panel. | 🔴 | MEDIUM — V1 users drag the line directly; V3 forces panel edit. |
| Y-axis lock | `axis: 'v'` `[V1 line 9436]` | N/A | ⏸️ | — |
| `hidefooterLinetarget/hideheaderLinetarget` class | Removed on drag-end `[V1 line 9449]` | N/A | ⏸️ | — |

---

# Section 19 — Designer-shell side panel resize

| Sub-row | V1 behavior | V3 behavior | Score | Impact |
|---|---|---|---|---|
| Left/Right handle drag | Yes `[V1 lines 15022-15062]` | Out-of-scope here (DesignerShell.vue / SplitPane component) | ⏸️ | — |
| Namespaced event handlers | `_designerEventNs` | N/A | ⏸️ | — |

---

# Section 20 — Toolbar dialog interactions

Out-of-scope here (toolbar-and-shell.md).

---

# Section 21 — Event-bus key reference

| Event key | V1 emit | V3 emit | Score | Impact |
|---|---|---|---|---|
| `PrintElementSelectEventKey_<tid>` | Yes (multiple sources) | **Not emitted** | 🔴 | MEDIUM — External integrators must rewire to Pinia subscriptions. |
| `BuildCustomOptionSettingEventKey_<tid>` | Yes `[V1 line 10837]` | **Not emitted** | 🔴 | MEDIUM — see 1.2. |
| `hiprintTemplateDataChanged_<tid>` (28+ reasons) | Yes | **Not emitted** | 🔴 | HIGH — Major integration surface broken. Business `onDataChanged` callbacks have no V3 equivalent yet. |
| `hiprintTemplateDataShortcutKey_<tid>` | Yes | **Not emitted** (direct `history.undo()`) | 🔴 | LOW — Undo/redo hook for external observers lost. |
| `clearSettingContainer` | Yes | Not emitted | 🟢 | — |
| `onSelectPanel` | Yes `[V1 line 12326]` | `setActivePanel` mutation | 🟢 | — |
| `updateTable<hitableId>` | Per-table | Out-of-scope | ⏸️ | — |

---

# Section 22 — Global state flags

| Flag | V1 | V3 | Score | Impact |
|---|---|---|---|---|
| `HiPrintlib.instance.draging` | Set by drag/resize/select-all/guide-drag/header-line `[V1 lines 884, 1105, 6597, 887, 9609, 9441]`. Used to suppress lasso `[V1 line 11409]`. | **Not tracked globally.** interact.js manages its own gesture state per-element; lasso races with drag only if user manages to start both, which the DOM target check prevents. | 🟢 | LOW — V3 simpler, equivalent outcome. |
| `rectDraging` | Yes `[V1 lines 11411-11417]` | N/A | ⏸️ | — |
| `changed` | Per-drag-step `[V1 lines 879, 6575]` | N/A — drag-end always emits onEnd | 🟢 | — |

---

# Section 23 — Selection state queries

| Helper | V1 | V3 | Score | Impact |
|---|---|---|---|---|
| `panel.getSelectedElements()` | Returns lasso array OR live scan `[V1 line 11617]` | `canvas.selectedElements` computed (`canvas.ts:143-157`) | 🟢 | — |
| `inRect(rect)` AABB | `[V1 line 1646]` | `rectsIntersect` (`selection.ts:155-162`) | ✅ | — |
| `multipleSelect(bool)` stale | `[V1 line 1656]` | N/A | ⏸️ | — |
| `updatePositionByMultipleSelect` lock-aware | `[V1 line 1658]` | `canvas.moveSelection` (no lock awareness) (`canvas.ts:379-394`) | 🟡 | LOW — lock model absent. |

---

# Section 24 — Idempotency and re-entry guards

| Guard | V1 | V3 | Score | Impact |
|---|---|---|---|---|
| `_shortcutKeyBound` | `[V1 line 10946]` | N/A — `enableDesignerKeyboard()` returns cleanup; caller responsible for not double-calling. Idempotent only via cleanup. | 🟡 | LOW — Caller bug if double-installed. |
| `_guideEventsBound` | `[V1 line 9548]` | N/A — no guides | ⏸️ | — |
| `template._designed` re-entry unbind | `[V1 lines 12379-12388]` | Vue component lifecycle handles it | 🟢 | — |
| `template._destroyed` `_assertNotDestroyed` | `[V1 line 12554]` | Pinia stores can be reset; no defensive assertion | 🟡 | LOW — minor. |
| `_isUndoRedoing` re-entry | `[V1 line 13102]` | vueuse-internal | 🟢 | — |
| Captured store reference (multi-Pinia fix) | N/A | `useCanvasStore()` captured at enable-time (`keyboard.ts:230-231`, `selection.ts:118`, `drag-drop.ts:144`, `context-menu.ts:352`) | 🟢 | — Multi-designer pinia bug fixed 2026-05-11. |

---

# Section 25 — V1 quirks parity

## 25.1 Shift INVERTS aspect-ratio on SE-handle

⚠️ **V3 INVERTS THE INVERSION** — V3 Shift LOCKS ratio (industry standard) instead of V1's BREAK ratio. **HIGH IMPACT.** See 4.3.

## 25.2 History pushes per arrow keypress

🔴 **V3 doesn't auto-snapshot at all.** Different problem — V3 lacks ANY auto-snapshot mechanism. See 2.9, 11.1.

## 25.3 No Ctrl+X (cut) exists

⚠️ **V3 ADDS Ctrl+X.** See 8.7, 9.5. Low impact (additive).

## 25.4 copyJson body-textarea, paste reads same DOM

🟢 **V3 unifies via module-level `_clipboard`.** Cross-tab still fails. See 9.1.

## 25.5 Lasso visual uses transform: rotate

🟢 **V3 uses standard min/max** (`selection.ts:226-233`). Visually identical. See 1.5.2.

## 25.6 Empty-canvas click clears only if maxPanelIndex < 2

⚠️ **V3 ALWAYS clears.** Quirk fix. See 1.2.

## 25.7 hireizeable.mouseup targets `.easyui-droppable` legacy class

⏸️ N/A — V3 uses interact.js. See 4.5.

## 25.8 Esc does NOT cancel inline edit

⚠️ **V3 Esc cancels via browser default.** Quirk fix. See 1.7.

## 25.9 Ctrl+Z works inside `<input>`

⚠️ **V3 isEditableTarget early-returns.** Quirk fix. See 8.6.

## 25.10 Position-locked elements can be deleted

⏸️ N/A — V3 has no lock model. See 8.3.

## 25.11 Bring-to-front assigns sequential z

⚠️ **V3 single-element-only reorder.** See 10.3.

## 25.12 Snap considers only nearest neighbor

⏸️ N/A — V3 has no snap-to-element. See 2.6.

## 25.13 Rotate dblclick reset

🔴 **V3 no rotate.** See 5.3.

## 25.14 Ctrl-drag disables snap + bounds

⏸️ N/A — V3 has no smart-guide snap. Ctrl-drag in V3 has no special meaning. See 2.6, 2.8.

## 25.15 Arrow-key Shift has no effect

⚠️ **V3 Shift = 10pt nudge.** Quirk inversion. HIGH IMPACT. See 8.1.

## 25.16 createLineOfPosition appends to .hiprint-printPaper-content

🔴 N/A — V3 no cross-hairs. See 1.9.

## 25.17 Pasted elements get qid via qtDesigner

🔴 **V3 no qtDesigner.** See 6.8.

## 25.18 Element-list mousedown stopPropagation, mouseup allowed

🔴 N/A — V3 no element-list. See Section 16.

## 25.19 Multi-element style update only on 样式 tab

⏸️ Out-of-scope (per-etype property panel).

---

# Section 26 — Default constants summary

| Constant | V1 default | V3 default | Score | Impact |
|---|---|---|---|---|
| `movingDistance` | 1.5pt | `keyboard.ts moveStep = 1pt` (`keyboard.ts:222`); `canvas.gridSize = 5pt` (`canvas.ts:121`) | ⚠️ | HIGH — see 8.1, 2.4. |
| `paperHeightTrim` | 1 mm | N/A (paper rendering layer) | ⏸️ | — |
| `showPosition` | true | N/A — no cross-hairs | 🔴 | — |
| `positionLineMode` | false | N/A | ⏸️ | — |
| `positionUnit` | true | N/A | ⏸️ | — |
| `showSizeBox` | true | N/A — no size-box | 🔴 | — |
| `adsorbMin` | 3pt | N/A — no element snap | 🔴 | — |
| `showAdsorbLine` | true | N/A | 🔴 | — |
| `adsorbLineMin` | 6pt | N/A | 🔴 | — |
| `paperNumberContinue` | true | Per-template (out of scope) | ⏸️ | — |
| `hidraggable.proxy` | null (real moves) | interact.js auto (real moves) | ✅ | — |
| `hidraggable.revert` | false | N/A | ⏸️ | — |
| `hidraggable.cursor` | "move" | CSS `cursor: move` | ✅ | — |
| `hireizeable.minResize` | 1.5pt | `resize.ts minWidth/minHeight = 5pt` (`resize.ts:148-149`) | 🟡 | LOW. |
| `hireizeable.showPoints` | `["s","e"]` | Default all 4 edges | 🟡 | LOW. |
| `hireizeable.reizeUnit` | `"pt"` | `pt` (`resize.ts:243-246`) | ✅ | — |

---

# Section 27 — Summary scorecard

## Aggregate counts (across Sections 1-26)

| Score | Count (approx) |
|---|---|
| ✅ Full parity | ~35 |
| 🟢 Functional parity (different mechanism) | ~30 |
| 🟡 Partial parity | ~25 |
| 🔴 Missing | ~30 |
| ⚠️ Violation / inversion | ~18 |
| ⏸️ Out-of-scope / N/A | ~20 |

Total scored rows: ~158 (well above 100 required).

## Top 15 behavior diffs ranked by user-visibility impact

Sorted by HIGH→LOW; tie-broken by user-frequency-of-use.

### HIGH IMPACT (breaks V1 muscle memory)

| # | V1 vs V3 diff | V1 source | V3 source | Section |
|---|---|---|---|---|
| 1 | **Shift+resize INVERTS aspect-ratio lock** — V1: Shift breaks ratio; V3: Shift locks ratio | `[V1 lines 8302-8315]` | `resize.ts:198-224` | 4.3, 25.1 |
| 2 | **Arrow nudge step changed** — V1: 1.5pt always (Shift ignored); V3: 1pt nudge / Shift=10pt | `[V1 lines 1579, 1595-1640]` | `keyboard.ts:54-58, 222, 280` | 8.1, 25.15 |
| 3 | **No history auto-snapshot** — V1: every drag/resize/delete/paste auto-pushes; V3: callers must call `pushSnapshot()` manually, no interaction module does | `[V1 line 13136]` | `history.ts:104-117` (manual) | 2.9, 4.6, 6.9, 11.1 |
| 4 | **No resize handles / size-box / cross-hairs / del-btn visible** — V1: 8 corner dots + W×H label + ✕; V3: outline only | `[V1 lines 8052-8099]` | `ElementWrapper.vue:163-171` | 1.9, 4.5 |
| 5 | **Palette drop ignores cursor position** — V1: element drops where cursor is; V3: element appears at default position (likely 0,0) | `[V1 lines 11250-11265]` | `drag-drop.ts:380-386` | 3.3, 6.5 |
| 6 | **No position cross-hairs during drag/resize** — V1 designer shows live alignment guides + pt labels; V3 shows nothing | `[V1 lines 1380-1451]` | absent | 1.9, 2.3, 4.5 |
| 7 | **No smart-guides (snap to other elements)** — V1: edge/center snap within 3pt + visual guides; V3: no snap-to-element at all | `[V1 lines 7538-7691]` | absent | 2.6 |
| 8 | **Multi-select z-order on right-click only acts on clicked element** — V1: all selected reorder together; V3: only the right-clicked one | `[V1 lines 11488-11522]` | `context-menu.ts:468-505` | 10.3 |
| 9 | **No element-list panel `☰` floating widget** — V1: heavy-use feature for 20+ element layouts; V3: missing | `[V1 lines 11679-11867]` | absent | 16 |
| 10 | **No user-drawn guide lines (参考线)** — V1: drag from ruler to create; V3: no ruler-handle drag source | `[V1 lines 9540-9626]` | `HiprintCanvas.vue:301-363` (SVG only) | 17 |

### MEDIUM IMPACT (visible but adaptable)

| # | V1 vs V3 diff | V1 source | V3 source | Section |
|---|---|---|---|---|
| 11 | **Tab cycles selection in V3, did nothing in V1** — accessibility break | `[V1 lines 152-154]` | `keyboard.ts:303-307` | 1.8, 8.2 |
| 12 | **Empty canvas click now ALWAYS clears selection** — V1 quirk: only if `maxPanelIndex < 2` | `[V1 line 8348]` | `selection.ts:191-287` | 1.2, 25.6 |
| 13 | **Ctrl+Z inside `<input>` now does browser-native undo** — V1: undid template state | `[V1 line 10960]` after Z block | `keyboard.ts:234, 238-246` | 8.6, 25.9 |
| 14 | **Multi-element paste loses spatial layout** — V1 preserves `incrementPosition`; V3 stacks all at (+10,+10) | `[V1 lines 11036-11058]` | `keyboard.ts:153-159` | 8.7, 9.2 |
| 15 | **Ctrl/⌘+click is TOGGLE in V3, ADD-only in V1** — clicking an already-selected element with Ctrl deselects it in V3 | `[V1 lines 8172-8181]` | `selection.ts:81-86`, `canvas.ts:360-362` | 1.4 |

### Additional MEDIUM/LOW items (not in top 15)

- Header/footer line drag missing (Section 18)
- Context menu missing 13 of 20 V1 items (alignment, distribute, lock, etc.) (Section 7)
- `hiprintTemplateDataChanged_*` event bus not emitted (Section 21) — breaks external integrators
- Panel-bound clamping during drag missing (Section 2.8)
- Drag scale-awareness mismatch in resize (Section 15.1)

---

# Verification

```bash
# Line count
wc -l docs/V3-PARITY-MATRIX/07-interactions.md   # target ≥ 900

# Score-icon count
grep -cE "✅|🟡|🔴|⚠️|⏸️|🟢" docs/V3-PARITY-MATRIX/07-interactions.md   # target ≥ 100
```

---

# Cross-references

- V1 source-of-truth → `docs/V1-INVENTORY/interactions.md` (1331 lines, 485 citations).
- V3 source files → `src/hiprint-v3/interactions/{keyboard,selection,drag-drop,resize,context-menu,panel-reflow}.ts`.
- V3 stores → `src/hiprint-v3/stores/{canvas,history}.ts`.
- V3 wrapper components → `src/hiprint-v3/components/{HiprintCanvas,HiprintPanel}.vue`, `src/hiprint-v3/components/elements/ElementWrapper.vue`.
- E2E tests (locks behavior) → `e2e/tests/interactions.spec.ts` (target — must lock at least the 15 top-impact diffs once V3 hits behavior parity or explicit deviation).
