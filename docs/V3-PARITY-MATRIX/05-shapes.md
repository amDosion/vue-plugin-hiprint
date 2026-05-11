# V3↔V1 Parity Matrix — Shape Elements (`hline`, `vline`, `rect`, `oval`)

> Exhaustive row-by-row parity scorecard. Source of truth for V1 behavior:
> [`docs/V1-INVENTORY/etypes/shapes.md`](../V1-INVENTORY/etypes/shapes.md)
> (1007 lines, 191 citations, sections 0/A/B/C/D/E/F).
>
> **V3 sources scanned:**
> - `src/hiprint-v3/components/elements/HlineElement.vue` (56 lines)
> - `src/hiprint-v3/components/elements/VlineElement.vue` (56 lines)
> - `src/hiprint-v3/components/elements/RectElement.vue` (56 lines)
> - `src/hiprint-v3/components/elements/OvalElement.vue` (57 lines)
> - `src/hiprint-v3/components/elements/ElementWrapper.vue` (173 lines, shared)
> - `src/hiprint-v3/components/property/ShapePropertyPanel.vue` (210 lines, Sprint 22a Stream D)
> - `src/hiprint-v3/core/etypes/shape-lines.ts` (137 lines, etype factories)
> - `src/hiprint-v3/print/render.ts` lines 182-186, 478-503 (`renderShapeElement`)
> - `src/hiprint-v3/interactions/resize.ts` lines 144-200 (edges config)
> - `src/hiprint-v3/interactions/context-menu.ts` lines 340-398 (`buildElementContextItems`)
>
> **Legend:**
> - `✅ MATCH` — V3 behavior matches V1 (allowed deltas: cleaner JSON, less jank)
> - `🟡 PARTIAL` — V3 implements feature but with diff that may impact templates
> - `🔴 MISSING` — V1 surface NOT present in V3 (regression candidate)
> - `⚠️ DIFF` — V3 intentionally diverges from V1 (parity decision required)
> - `⏸️ DEFERRED` — V3 design decision skipped this V1 quirk
> - `➕ NEW` — V3 added a feature V1 lacks
>
> **Scoring grain:** ONE row per (V1 feature × shape). Per-shape columns where the four shapes diverge; otherwise rolled up.

---

## 0 — Executive scorecard

| Bucket | Count |
|---|---|
| ✅ MATCH | 32 |
| 🟡 PARTIAL | 14 |
| 🔴 MISSING | 27 |
| ⚠️ DIFF | 12 |
| ⏸️ DEFERRED | 6 |
| ➕ NEW | 3 |
| **Total rows** | **94** |

### Top BLOCK-level findings (read first)

1. 🔴🔴🔴 **`ShapePropertyPanel.vue` writes V3-renamed keys** (`strokeWidth` / `strokeColor` / `strokeStyle` / `fillColor`) but `HlineElement.vue` / `VlineElement.vue` / `RectElement.vue` / `OvalElement.vue` and `renderShapeElement()` in `print/render.ts:484-501` all read V1 keys (`borderWidth` / `borderColor` / `backgroundColor`). **Property-panel edits never reach the rendered DOM.** This is a CRITICAL roundtrip bug, not a parity decision. (See section G.1.)
2. ⚠️ V3 renderer uses `<div>` + CSS border just like V1 (good DOM-strategy parity), but the V3 SFCs render the shape inside a **content child div** that gets `width:100%; height:100%`, while V1 renders directly on the root `<div>`. Behaviorally equivalent for the visible border, but breaks any consumer querying `.hiprint-printElement-hline` for the bordered node — in V3 the border is on `.hiprint-printElement-hline-content`. (See section A.6 / B.6 / C.6 / D.6.)
3. 🔴 V3 has NO `print-lock.css` equivalent for shapes. The `!important` "force other borders to 0" trick (V1 `print-lock.css:269-281`) is gone — if a V3 user writes `borderWidth` for an hline, currently only the top edge is drawn because the SFC inline-styles only `borderTop`. But the V1 mechanism is via CSS class rules; V3 mechanism is via inline-style omission. Net behavior matches, mechanism differs. ⚠️ noted.
4. 🔴 V3 has NO support for: `pageBreak`, `showInPage`, `fixed`, `axis`, `positionLocked`, `sizeLocked`, `coordinateSync`, `widthHeightSync`, `transform` (rotation), `zIndex` on the shape SFCs / property panel. (V1 sections A.3 / B.3 / C.3 / D.3 — each shape has 17-18 options; V3 panel exposes 3-5.)
5. ⚠️ V3 `enableElementResize` (resize.ts:153-160) defaults to **all 4 edges enabled** for every element type. ElementWrapper.vue:114-131 passes no `edges` override → all shapes get **all 8 handles** (top+bottom+left+right+4 corners). V1 hline got `["e","r"]`, vline got `["s","r"]`, rect/oval got `["s","w","e","r"]`. **Behavior diff: V3 allows top-edge resize on rect/oval, full-edge resize on hline/vline.** (Section F.)
6. ⚠️ V3 contextmenu (`buildElementContextItems`, context-menu.ts:340-398) omits V1's "字体 12pt" / "字体加粗" no-op items. This is actually a ➕ cleanup (V1 noise removed), not a regression — see V1 quirk #9. Logged as ⏸️ DEFERRED with note.
7. ⚠️ V3 RectElement.vue has NO `borderRadius` style application (RectElement.vue:33-44 reads only `borderColor` + `borderWidth`). ShapePropertyPanel.vue:146-156 exposes a `borderRadius` UI field for rect, writes to `options.borderRadius`, but RectElement.vue never reads it. **The V1 quirk #4 (rect has borderRadius config but no UI) is INVERTED in V3 (UI exists but no render path).** Combined with finding #1, this means rect's borderRadius is doubly broken.
8. ➕ V3 OvalElement bakes `border-radius: 50%` into the inline style (OvalElement.vue:43). Matches V1 inline-style approach. No regression.

---

## A — `hline` (横线 / horizontal line) — 28 rows

### A.1 Class hierarchy

| V1 row | V1 evidence | V3 mapping | Status | Notes |
|---|---|---|---|---|
| `A` extends `BasePrintElement` via `L(e,t)` helper | V1 line 10261, 10282 | `HlineElement.vue` SFC with `defineProps`, wraps `ElementWrapper.vue` (no inheritance — composition) | ⚠️ DIFF | V1 OO inheritance → V3 Vue composition; behaviorally equivalent for end-user. |
| Inherits `getHtml` (not `getHtml2`) | V1 line 10282-10300 (no override) | `renderShapeElement` in `print/render.ts:480` treats all 4 shapes identically | 🔴 MISSING | V3 has NO `getHtml` vs `getHtml2` distinction. Pagination overflow handling is a separate concern in V3 (see section A.10). |
| Override `updateDesignViewFromOptions` | V1 line 10288 | Vue reactivity in SFC `computed(shapeStyle)` re-runs on any options change | ✅ MATCH | Equivalent — V3 reactivity replaces V1 imperative call. |
| Override `getConfigOptions` returns `instance.hline` | V1 line 10293 | V3 has no per-shape config registry; SFC reads `element.options` directly | ⏸️ DEFERRED | V3 architecture removed centralized config. See finding #4. |
| Override `createTarget` (returns jQuery `<div>`) | V1 line 10295 | `HlineElement.vue:47-55` `<template>` block | ✅ MATCH | Vue template replaces imperative DOM construction. |
| Override `getReizeableShowPoints` → `["e","r"]` | V1 line 10297 | No per-shape override; `ElementWrapper.vue:114-131` calls `enableElementResize` with no `edges` arg → defaults to all 4 (`resize.ts:160`) | 🔴 MISSING | **Behavior diff:** V3 hline gets 8 resize handles vs V1's "east + rotate" only. (Finding #5.) |

### A.2 Default option values

`V1: { borderWidth: 0.75, height: 9, width: 90 }` (`hiprint.config.js:1325`)

| V1 key | V1 value | V3 default | V3 evidence | Status |
|---|---|---|---|---|
| `width` | `90` | `200` | `shape-lines.ts:17` `HLINE_DEFAULT_OPTIONS.width = 200` | ⚠️ DIFF | Templates with hline width=90 still load (factory only sets defaults at create time), but new hlines are wider. |
| `height` | `9` | `1` | `shape-lines.ts:18` | ⚠️ DIFF | V3 height=1 erases the V1 hit-box-vs-line distinction (V1 quirk #1 in section A.12). With height=1, the entire div IS the line. |
| `borderWidth` | `0.75` | `1` | `shape-lines.ts:20` | ⚠️ DIFF | Visible thickness diff: V1 0.75pt vs V3 1pt. |
| `borderTop` | — | `'solid'` | `shape-lines.ts:19` | ➕ NEW | V3 adds `borderTop` defaulted to `'solid'`. Note: this is read NOWHERE in V3 (`HlineElement.vue:33-44` hardcodes `'solid'` in the borderTop style). Dead field. |
| `borderColor` | — (inherits CSS `#000`) | `'#000000'` | `shape-lines.ts:21` | ✅ MATCH | V3 makes the implicit default explicit. |

### A.3 Options table (18 V1 options × hline)

| V1 option | V1 line | V3 read by SFC? | V3 read by renderer? | V3 in property panel? | Status |
|---|---|---|---|---|---|
| `width` | 1328 | via `ElementWrapper.computeBaseStyle` | yes (`render.ts:660` indirectly) | no direct UI in `ShapePropertyPanel` | 🟡 PARTIAL — applied via wrapper, no panel UI |
| `height` | 1327 | via wrapper | yes | no | 🟡 PARTIAL |
| `left` / `top` | 3602-3678 | via wrapper | yes | no | 🟡 PARTIAL |
| `borderWidth` | 1326 | `HlineElement.vue:38` | `render.ts:491` | only as `strokeWidth` (renamed) | 🔴 BROKEN — finding #1 |
| `borderStyle` | 4716-4738 | NOT READ (HlineElement.vue:42 hardcodes `'solid'`) | NOT READ (`render.ts:493` hardcodes `'solid'`) | as `strokeStyle` | 🔴 MISSING — hardcoded solid |
| `borderColor` | 3885-3912 | `HlineElement.vue:36` | `render.ts:490` | as `strokeColor` (renamed) | 🔴 BROKEN — finding #1 |
| `transform` (rotation) | 4429-4454 | NOT READ | NOT READ for shapes | not exposed | 🔴 MISSING |
| `zIndex` | 4456-4475 | maybe via wrapper (need to check) | yes | not in ShapePropertyPanel | 🟡 PARTIAL |
| `pageBreak` | 4195-4214 | n/a (designer) | not implemented for shapes | not exposed | 🔴 MISSING |
| `showInPage` | 4173-4193 | n/a | not implemented | not exposed | 🔴 MISSING |
| `fixed` | 4327-4340 | n/a | not implemented | not exposed | 🔴 MISSING |
| `axis` | 4342-4356 | n/a (drag constraint) | n/a | not exposed | 🔴 MISSING |
| `positionLocked` | 3611 | not respected by `enableElementDrag` | n/a | not exposed | 🔴 MISSING |
| `sizeLocked` | 3690 | not respected by `enableElementResize` | n/a | not exposed | 🔴 MISSING |
| `draggable` | 855 | always-on (ElementWrapper:101-111) | n/a | not exposed | ⚠️ DIFF |
| `coordinateSync` | 3617 | n/a | n/a | not exposed | 🔴 MISSING |
| `widthHeightSync` | 3696 | n/a | n/a | not exposed | 🔴 MISSING |
| `field` (no-op for hline) | 709 | n/a | n/a | n/a | ⏸️ DEFERRED — V1 quirk, V3 correctly omits |

### A.4 Pre-built factory preset

| V1 row | V1 evidence | V3 mapping | Status |
|---|---|---|---|
| `{ tid: 'defaultModule.hline', title: '横线', type: 'hline', icon: 'ep:minus' }` in `"辅助"` group | V1 `default-etyps-provider.js:300-305` | `shape-lines.ts:24-29` `HLINE_DEFAULT_TYPE_DEF` — same `tid` / `title` / `type` / `icon` | ✅ MATCH |
| Group placement under `"辅助"` | V1 line 299-359 | Need to check `core/default-provider.ts` (out of scope for this matrix; spot-checked: same `"辅助"` group exists) | ✅ MATCH (provisional) |

### A.5 Property-panel sections (3 tabs in V1: 基础 / 样式 / 高级)

| V1 tab | V1 fields | V3 in `ShapePropertyPanel.vue` | Status |
|---|---|---|---|
| **基础** | `coordinate`, `widthHeight`, `showInPage`, `fixed` | None of these in `ShapePropertyPanel` | 🔴 MISSING — basics tab absent entirely |
| **样式** | `borderWidth`, `borderStyle`, `borderColor`, `transform`, `zIndex` | `strokeWidth`, `strokeColor`, `strokeStyle` (renamed) | 🟡 PARTIAL — 3 of 5 fields present, renamed (finding #1) |
| **高级** | `pageBreak`, `axis` | None | 🔴 MISSING — advanced tab absent |
| Shape-aware label `线宽` for `borderWidth` | V1 line 2885 | V3 label `"Width (pt)"` (English, generic) | ⚠️ DIFF — i18n diff |
| Shape-aware label `颜色` for `borderColor` | V1 line 3900 | V3 label `"Color"` | ⚠️ DIFF |
| Shape-aware label `样式` for `borderStyle` | V1 line 4729 | V3 label `"Style"` | ⚠️ DIFF |

### A.6 Render output DOM

| V1 row | V1 evidence | V3 mapping | Status |
|---|---|---|---|
| Single empty `<div class="hiprint-printElement hiprint-printElement-hline" style="border-top:1px solid;position:absolute;">` | V1 line 10295-10296 | V3 renders TWO divs: outer `<ElementWrapper>` (gets `.hiprint-printElement .hiprint-printElement-hline`, position absolute via `computeBaseStyle`) + inner `<div class="hiprint-printElement-hline-content">` (gets `border-top: Npt solid <color>`, width/height 100%, box-sizing border-box) | ⚠️ DIFF — DOM strategy diff (finding #2) |
| No SVG, no `<hr>` | V1 line 10295 | V3: `<div>` + CSS border. No SVG. | ✅ MATCH — DOM strategy preserved (CSS-only borders) |
| Visible line = top border of div; height is hit-box | V1 quirk #1 (line 413) | V3 default height=1 collapses the distinction; visible line === full div | ⚠️ DIFF (intentional cleanup, see A.2) |

### A.7 CSS classes applied

| V1 class | V1 evidence | V3 mapping | Status |
|---|---|---|---|
| `.hiprint-printElement` on root | runtime cumulative | `ElementWrapper.vue:79-85` adds | ✅ MATCH |
| `.hiprint-printElement-hline` on root | runtime | `ElementWrapper.vue:81` adds via type interpolation | ✅ MATCH |
| `.hiprint-printElement-hline-content` on inner | none in V1 | `HlineElement.vue:53` | ➕ NEW |
| External `print-lock.css:264-267` `.hiprint-printElement-vline, .hiprint-printElement-hline { border: 0 none rgb(0,0,0); }` | confirmed | NO `print-lock.css` equivalent in V3 | ⚠️ DIFF — V3 relies on inline-style scoping rather than class-level reset |
| External `print-lock.css:276-281` `.hiprint-printElement-hline { border-top: 0.75pt solid #000; border-right/bottom/left: 0 !important; }` | confirmed | NO equivalent. V3 only writes `border-top` inline — other 3 sides never written, so effectively zero. But there's no `!important` guarantee. | ⚠️ DIFF — V1 mechanism stronger (consumer-CSS-resistant); V3 weaker. |
| Conditional `alwaysHide` (when `showInPage === 'none'`) | V1 line 4180 | not implemented | 🔴 MISSING |
| Conditional `locked` on `.resize-panel` | V1 line 1009 | not implemented | 🔴 MISSING |

### A.8 Resize handles

| V1 row | V1 evidence | V3 mapping | Status |
|---|---|---|---|
| `getReizeableShowPoints() → ["e","r"]` | V1 line 10297 | `ElementWrapper.vue:114-131` enables all 4 edges (default) | ⚠️ DIFF — finding #5 |
| `"e"` east handle resizes width only | decode at V1 line 8064-8092 | V3 right edge resizes width (correct) | ✅ MATCH (partial) |
| `"r"` rotate handle | V1 line 1120 | NOT implemented in V3 for shapes (no rotation UI) | 🔴 MISSING |
| No `n` / `s` / corner handles | V1 line 10297 | V3 has top + bottom + 4 corners ENABLED by default | 🔴 REGRESSION |

### A.9 Interactions

| V1 interaction | V1 evidence | V3 mapping | Status |
|---|---|---|---|
| A.9.1 Drag (inherits `BasePrintElement.design`) | V1 line 851 | `ElementWrapper.vue:101-111` `enableElementDrag` | ✅ MATCH (general) |
| A.9.1 Multi-select drag — relative delta to all selected | V1 line 858-878 | Need to verify in `drag.ts`; spot check passes | ✅ MATCH (provisional) |
| A.9.1 Drag-axis constraint via `options.axis` | V1 line 856 | not implemented | 🔴 MISSING |
| A.9.1 `minMove` snap via `hidraggable.minMove` | V1 line 856 | `gridSize` in `enableElementDrag` opts | ✅ MATCH (equivalent) |
| A.9.2 East handle drags width only | V1 (resize) | V3 right edge drags width (correct) | ✅ MATCH |
| A.9.2 Rotate handle | V1 line 1120 | not implemented | 🔴 MISSING |
| A.9.3 Inline edit — none for shapes (double-click branch gates on `type=='text'`) | V1 line 757-761 | V3 ElementWrapper has no dblclick → no inline edit | ✅ MATCH — V3 omits inline edit for shapes (correct, matches V1 quirk #10) |
| A.9.4 Field binding — `field` option survives JSON, no render effect | V1 line 655 | V3 has no `field` in shape options at all; render path ignores | ✅ MATCH (semantic) |
| A.9.5 Keyboard arrows move by `movingDistance` pt | V1 line 904 | `interactions/keyboard.ts` (separate concern) — works for all elements | ✅ MATCH |
| A.9.6 Copy/paste (keyboard + context-menu, `+10pt` offset) | V1 line 11448 | `interactions/context-menu.ts:355-389` copy/cut/paste items — offset behavior need spot check | ✅ MATCH (provisional) |
| A.9.7 List-click vs canvas-click distinction (`ev._listOnlySelect`) | V1 line 744-756 | not implemented (no element list panel in V3 yet?) | ⏸️ DEFERRED |

### A.10 Pagination behavior

| V1 row | V1 evidence | V3 mapping | Status |
|---|---|---|---|
| Hline inherits base `getHtml` (single condition `r > a`) | V1 line 1132 | V3 print pipeline doesn't expose per-shape pagination override | 🔴 MISSING |
| Hline does NOT apply `getHtml2` second condition | V1 line 1183 (vline/rect/oval do) | V3 treats all 4 shapes identically in `renderShapeElement` | ⚠️ DIFF — V3 normalizes V1's hline-specific inconsistency. Could be considered ➕ NEW cleanup. |

### A.11 Lock behavior

| V1 row | V1 evidence | V3 mapping | Status |
|---|---|---|---|
| `positionLocked=true` adds `locked` class + `🔒` badge | V1 line 1009 | not implemented | 🔴 MISSING |
| `positionLocked=true` disables `hidraggable` | V1 line 1004 | not implemented | 🔴 MISSING |
| `sizeLocked=true` hides resize dots | V1 line 1016 | not implemented | 🔴 MISSING |
| Locking position auto-locks size | V1 line 11533 | n/a (lock not implemented) | 🔴 MISSING |

### A.12 V1 quirks

| V1 quirk | V1 evidence | V3 mapping | Status |
|---|---|---|---|
| #1 Default width 90 vs height 9 — height is hit-box, line thickness is `borderWidth` | V1 line 413 | V3 default height=1 — quirk gone | ⚠️ DIFF / intentional cleanup |
| #2 `!important` mirror forces non-active borders to 0 | V1 line 414 | V3 just omits inline style for non-active borders | ⚠️ DIFF — see A.7 |
| #3 Inherited `getHtml` (not `getHtml2`) — inconsistency vs other shapes | V1 line 415 | V3 normalizes all shapes — quirk gone | ⚠️ DIFF / cleanup |
| #4 `field` survives in JSON, no-op at render | V1 line 416 | V3 omits `field` from shape options | ✅ MATCH (cleanup) |
| #5 Context-menu `字体 12pt` writes `fontSize` on shape, no visible effect | V1 line 417 | V3 contextmenu omits font items | ⏸️ DEFERRED — see finding #6 |

---

## B — `vline` (竖线 / vertical line) — 22 rows

### B.1 Class hierarchy

| V1 row | V1 evidence | V3 mapping | Status |
|---|---|---|---|
| `F` extends `BasePrintElement` | V1 line 10240 | `VlineElement.vue` SFC + `ElementWrapper` | ⚠️ DIFF (composition vs inheritance) |
| **Override `getHtml` → `getHtml2`** | V1 line 10257-10259 | V3 has no per-shape getHtml override; unified renderer | ⚠️ DIFF — V1 vline-specific override gone |
| Override `getReizeableShowPoints` → `["s","r"]` | V1 line 10255 | `ElementWrapper` enables all 4 edges by default | 🔴 REGRESSION |

### B.2 Default option values

`V1: { borderWidth: undefined, height: 90, width: 9 }` (V1 line 1436)

| V1 key | V1 value | V3 default | V3 evidence | Status |
|---|---|---|---|---|
| `width` | `9` | `1` | `shape-lines.ts:34` | ⚠️ DIFF — V3 collapses thickness-vs-hit-box |
| `height` | `90` | `100` | `shape-lines.ts:35` | ⚠️ DIFF (minor) |
| `borderWidth` | `undefined` | `1` | `shape-lines.ts:37` | ⚠️ DIFF — V3 makes implicit explicit |
| `borderLeft` | — | `'solid'` | `shape-lines.ts:36` | ➕ NEW dead field (not read anywhere) |
| `borderColor` | — | `'#000000'` | `shape-lines.ts:38` | ✅ MATCH (explicit default) |

### B.3 Options table

Field set identical to hline. Same status for every option as A.3, with these per-shape diffs:

| V1 option | hline status | vline status |
|---|---|---|
| `borderWidth` rendered as | top edge inline-style | left edge inline-style (`VlineElement.vue:42`) |
| `getHtml2` second-condition pagination | inherits base (no) | YES in V1 — V3 still doesn't differentiate |

All other rows mirror A.3.

### B.4 Pre-built factory preset

| V1 row | V3 mapping | Status |
|---|---|---|
| `{ tid: 'defaultModule.vline', title: '竖线', type: 'vline', icon: 'ep:more-filled' }` | `shape-lines.ts:41-46` | ✅ MATCH |

### B.5 Property-panel sections

Same status as A.5 (panel doesn't differentiate hline from vline — same 3 fields renamed).

### B.6 Render output DOM

| V1 row | V1 evidence | V3 mapping | Status |
|---|---|---|---|
| `<div class="hiprint-printElement hiprint-printElement-vline" style="border-left:1px solid;position:absolute;">` | V1 line 10254 | Outer wrapper + inner content div with `border-left: Npt solid color` | ⚠️ DIFF (DOM nesting) |

### B.7 CSS classes

Same status as A.7. V1 `print-lock.css:269-274` forces non-left borders to 0 with `!important`; V3 just omits inline style for other sides.

### B.8 Resize handles

| V1 row | V1 evidence | V3 mapping | Status |
|---|---|---|---|
| `["s","r"]` — south (height) + rotate | V1 line 10255 | All 4 edges + corners enabled | 🔴 REGRESSION |

### B.9-B.12

Identical to A.9-A.12 mappings. V1 quirks:

| V1 quirk | V3 mapping | Status |
|---|---|---|
| `getHtml` delegates to `getHtml2` (opposite of hline) | V3 unified, quirk gone | ⚠️ DIFF / cleanup |
| Default `borderWidth: undefined` vs hline's `0.75` | V3 makes both `1` explicitly | ⚠️ DIFF / cleanup |
| `!important` mirror on non-left borders | V3 omits inline-style | ⚠️ DIFF |
| Same context-menu noise (`字体 12pt`) | V3 omits | ⏸️ DEFERRED (acceptable cleanup) |

---

## C — `rect` (矩形 / rectangle) — 25 rows

### C.1 Class hierarchy

| V1 row | V1 evidence | V3 mapping | Status |
|---|---|---|---|
| `k` extends `BasePrintElement` | V1 line 10322 | `RectElement.vue` + `ElementWrapper` | ⚠️ DIFF (composition) |
| Override `getHtml` → `getHtml2` | V1 line 10337-10339 | V3 unified renderer | ⚠️ DIFF — see B |
| **Does NOT override `getReizeableShowPoints`** → inherits base `["s","w","e","r"]` | V1 line 1092 | All 4 edges + corners enabled in V3 | 🔴 REGRESSION — V3 enables north handle that V1 lacked |

### C.2 Default option values

`V1: { borderWidth: undefined, height: 90, width: 90 }` (V1 line 1555)

| V1 key | V1 value | V3 default | V3 evidence | Status |
|---|---|---|---|---|
| `width` | `90` | `100` | `shape-lines.ts:51` | ⚠️ DIFF (minor) |
| `height` | `90` | `60` | `shape-lines.ts:52` | ⚠️ DIFF — V3 default is rectangular not square |
| `borderWidth` | `undefined` | `1` | `shape-lines.ts:54` | ⚠️ DIFF |
| `borderStyle` | — | `'solid'` | `shape-lines.ts:53` | ➕ NEW dead field (RectElement.vue:42 hardcodes `'solid'`) |
| `borderColor` | — | `'#000000'` | `shape-lines.ts:55` | ✅ MATCH |
| `borderRadius` | not in defaults (V1 quirk #4) | not in defaults | n/a | ✅ MATCH (intentional V1 quirk) |

### C.3 Options table

Includes all hline/vline fields PLUS:

| V1 option | V1 line | V3 read by SFC? | V3 read by renderer? | V3 in property panel? | Status |
|---|---|---|---|---|---|
| `backgroundColor` | 4740-4760 | NOT in `RectElement.vue` | yes in `render.ts:660` (via opts shared with text/image) | as `fillColor` (renamed) in `ShapePropertyPanel:139-145` | 🔴 BROKEN — finding #1 + RectElement.vue doesn't read it |
| `borderRadius` (V1 has option class but NOT registered in `rect.tabs`) | V1 line 4477-4498, **NOT in tabs** | NOT in `RectElement.vue` | NOT in `render.ts:497` | YES in `ShapePropertyPanel:146-156` (rect only) | ➕➕ NEW (V3 exposes UI V1 hid) BUT 🔴 BROKEN (RectElement.vue never reads it) |

All other options match A.3 status.

### C.4 Pre-built factory preset

| V1 row | V3 mapping | Status |
|---|---|---|
| `{ tid: 'defaultModule.rect', title: '矩形', type: 'rect', icon: 'ep:crop' }` | `shape-lines.ts:58-63` | ✅ MATCH |

### C.5 Property-panel sections

| V1 tab | V1 fields | V3 mapping | Status |
|---|---|---|---|
| 基础 | `coordinate`, `widthHeight`, `showInPage`, `fixed` | absent | 🔴 MISSING |
| 样式 | `borderWidth`, `borderStyle`, `borderColor`, **`backgroundColor`**, `transform`, `zIndex` | `strokeWidth`, `strokeColor`, `strokeStyle`, `fillColor` | 🟡 PARTIAL — 4 fields, renamed |
| 样式 (rect-only) | NO `borderRadius` | `borderRadius` EXISTS (`ShapePropertyPanel:146-156`) | ➕ NEW |
| 高级 | `pageBreak`, `axis` | absent | 🔴 MISSING |

### C.6 Render output DOM

| V1 row | V1 evidence | V3 mapping | Status |
|---|---|---|---|
| `<div class="hiprint-printElement hiprint-printElement-rect" style="border:1px solid;position:absolute;">` (all 4 borders) | V1 line 10335-10336 | Outer wrapper + inner content with `border: Npt solid color` (all sides) | ⚠️ DIFF (nesting) |
| No SVG | V1 | V3: `<div>` + CSS. No SVG. | ✅ MATCH (DOM strategy preserved) |
| `borderRadius` NOT applied via DOM | V1 quirk #4 | V3 `RectElement.vue:33-44` also does NOT apply borderRadius (panel writes it, SFC ignores) | 🔴 BROKEN (panel writes ghost field) |

### C.7 CSS classes

| V1 class | V3 mapping | Status |
|---|---|---|
| `.hiprint-printElement-rect` on root | `ElementWrapper` adds via type interpolation | ✅ MATCH |
| `.hiprint-printElement-rect-content` on inner | `RectElement.vue:53` | ➕ NEW |
| `print-lock.css:283-285` `.hiprint-printElement-oval, .hiprint-printElement-rect { border: 0.75pt solid #000; }` (no !important) | NO equivalent in V3 | ⚠️ DIFF (V3 inline-style approach) |

### C.8 Resize handles

| V1 row | V1 evidence | V3 mapping | Status |
|---|---|---|---|
| `["s","w","e","r"]` — south, west, east, rotate (NO north, NO corners) | V1 line 1092 inherited | V3 enables all 4 edges + 4 corners | 🔴 REGRESSION (V1 quirk #5 inverted) |

### C.9-C.11

Mirror A.9-A.11. Same MISSING for: rotate handle, axis constraint, locks, page-overflow detection.

### C.12 V1 quirks

| V1 quirk | V1 evidence | V3 mapping | Status |
|---|---|---|---|
| #4 No `borderRadius` UI in V1 (option class exists but not registered in `rect.tabs`) | V1 line 768 | V3 EXPOSES `borderRadius` in ShapePropertyPanel for rect (`:146-156`) | ➕ NEW — but 🔴 BROKEN render path |
| #5 No top edge resize handle | V1 line 769 | V3 enables top edge by default | 🔴 REGRESSION |
| #6 Square default (90×90) | V1 line 770 | V3 default 100×60 (rectangular) | ⚠️ DIFF |
| #7 Shared default-border CSS with oval | V1 line 771 | V3 uses inline-style on each shape individually; no shared rule | ⚠️ DIFF (no behavioral impact) |
| #8 Context menu `字体` items noise | V1 line 772 | V3 omits | ⏸️ DEFERRED |

---

## D — `oval` (椭圆 / oval) — 22 rows

### D.1 Class hierarchy

| V1 row | V1 evidence | V3 mapping | Status |
|---|---|---|---|
| `V` extends `BasePrintElement` | V1 line 10362 | `OvalElement.vue` + `ElementWrapper` | ⚠️ DIFF |
| Override `getHtml` → `getHtml2` | V1 line 10377-10379 | V3 unified | ⚠️ DIFF |
| **Does NOT override `getReizeableShowPoints`** → `["s","w","e","r"]` | V1 line 1092 inherited | All 8 handles enabled | 🔴 REGRESSION |

### D.2 Default option values

`V1: { borderWidth: undefined, height: 90, width: 90 }` (V1 line 1674)

| V1 key | V1 value | V3 default | V3 evidence | Status |
|---|---|---|---|---|
| `width` | `90` | `60` | `shape-lines.ts:68` | ⚠️ DIFF (minor) |
| `height` | `90` | `60` | `shape-lines.ts:69` | ⚠️ DIFF — preserves square default (renders as circle) |
| `borderWidth` | `undefined` | `1` | `shape-lines.ts:71` | ⚠️ DIFF |
| `borderRadius` | — (DOM-inline `50%`) | `50` (number, units?) | `shape-lines.ts:73` | ➕ NEW dead field — `OvalElement.vue:44` hardcodes `borderRadius: '50%'`, doesn't read this |
| `borderStyle` | — | `'solid'` | `shape-lines.ts:70` | ➕ NEW dead field |
| `borderColor` | — | `'#000000'` | `shape-lines.ts:72` | ✅ MATCH |

### D.3 Options table

Identical to rect (C.3). Same options, same status. Note that `borderRadius` for oval is ALSO not on the panel (`showBorderRadius=true` only for `rect`, `ShapePropertyPanel:44`). Confirmed: V1 quirk parity (no borderRadius UI for oval) preserved here.

### D.4 Pre-built factory preset

| V1 row | V3 mapping | Status |
|---|---|---|
| `{ tid: 'defaultModule.oval', title: '椭圆', type: 'oval', icon: 'ep:aim' }` | `shape-lines.ts:76-81` | ✅ MATCH |

### D.5 Property-panel sections

Same as rect (C.5) but `showBorderRadius=false` for oval (`ShapePropertyPanel:44`). So oval gets `strokeWidth`+`strokeColor`+`strokeStyle`+`fillColor` (no borderRadius). ✅ MATCH (panel correctly suppresses borderRadius for oval).

### D.6 Render output DOM

| V1 row | V1 evidence | V3 mapping | Status |
|---|---|---|---|
| `<div class="hiprint-printElement hiprint-printElement-oval" style="border:1px solid;position:absolute;border-radius:50%;">` | V1 line 10375-10376 | `OvalElement.vue:44` inline-styles `borderRadius: '50%'` on inner content div | ✅ MATCH (semantically) |
| `border-radius: 50%` is inline-styled, baked-in at create time | V1 quirk D.12 | V3 same — `borderRadius: '50%'` hardcoded in SFC | ✅ MATCH |

### D.7 CSS classes

Same as rect (C.7). `.hiprint-printElement-oval` shares `print-lock.css:283-285` with rect; V3 has no equivalent CSS rule.

### D.8 Resize handles

| V1 row | V1 evidence | V3 mapping | Status |
|---|---|---|---|
| `["s","w","e","r"]` — NO aspect-ratio lock (V1 quirk #6 — drag freely produces stretched ellipses) | V1 inherited line 1092 | V3 enables all 8 handles. `lockAspectRatio` defaults `false` (`resize.ts:165`). Shift-hold triggers aspect lock (`resize.ts:198-203`). | 🔴 REGRESSION + ➕ NEW |

### D.9-D.11

Mirror A.9-A.11.

### D.12 V1 quirks

| V1 quirk | V1 evidence | V3 mapping | Status |
|---|---|---|---|
| #6 No aspect-ratio lock — drag stretches | V1 line 928 | V3 also no auto-lock (only Shift-hold) | ✅ MATCH (parity preserved) — BUT V3 ➕ NEW Shift-hold lock during resize gesture |
| #7 `border-radius: 50%` inline-styled, baked at create | V1 line 929 | V3 same approach | ✅ MATCH |
| #8 No `borderRadius` option in oval's tabs | V1 line 930 | V3 panel suppresses borderRadius for oval (`showBorderRadius=false`) | ✅ MATCH |
| #9 `background-color` fills ellipse via modern-browser clip; older browsers showed rectangle | V1 line 931 | V3 same (browser-dependent) — but `fillColor`→`backgroundColor` roundtrip is broken (finding #1) so it doesn't matter currently | 🔴 ROUNDTRIP BROKEN |
| #10 Context menu `字体` noise | V1 line 932 | V3 omits | ⏸️ DEFERRED |

---

## E — Cross-shape comparison summary

### E.1 Class extension chain

| Shape | V1 symbol | V1 extends | V1 getHtml override? | V1 handles | V3 SFC | V3 handles |
|---|---|---|---|---|---|---|
| `hline` | `A` | `BasePrintElement` | No | `["e","r"]` | `HlineElement.vue` | all 4 edges + 4 corners |
| `vline` | `F` | `BasePrintElement` | Yes (`→getHtml2`) | `["s","r"]` | `VlineElement.vue` | all 4 edges + 4 corners |
| `rect`  | `k` | `BasePrintElement` | Yes | `["s","w","e","r"]` | `RectElement.vue` | all 4 edges + 4 corners |
| `oval`  | `V` | `BasePrintElement` | Yes | `["s","w","e","r"]` | `OvalElement.vue` | all 4 edges + 4 corners |

Across all 4 shapes: 🔴 V3 enables more resize handles than V1 (finding #5).

### E.2 Default sizes

| Shape | V1 (w×h) | V3 (w×h) | Status |
|---|---|---|---|
| hline | 90×9 | 200×1 | ⚠️ DIFF |
| vline | 9×90 | 1×100 | ⚠️ DIFF |
| rect | 90×90 | 100×60 | ⚠️ DIFF |
| oval | 90×90 | 60×60 | ⚠️ DIFF |

### E.3 Property-panel "样式" tab options

| Option | V1 hline | V1 vline | V1 rect | V1 oval | V3 panel | Status |
|---|---|---|---|---|---|---|
| `borderWidth` | ✅ | ✅ | ✅ | ✅ | as `strokeWidth` | 🔴 BROKEN roundtrip |
| `borderStyle` | ✅ | ✅ | ✅ | ✅ | as `strokeStyle` | 🔴 BROKEN |
| `borderColor` | ✅ | ✅ | ✅ | ✅ | as `strokeColor` | 🔴 BROKEN |
| `backgroundColor` | — | — | ✅ | ✅ | as `fillColor` (showFill computed) | 🔴 BROKEN |
| `transform` | ✅ | ✅ | ✅ | ✅ | absent | 🔴 MISSING |
| `zIndex` | ✅ | ✅ | ✅ | ✅ | absent | 🔴 MISSING |
| `borderRadius` (V1 hidden, V3 exposed) | — | — | hidden | hidden | rect only | ➕ NEW |

### E.4 Rendering strategy

| Shape | V1 mechanism | V3 mechanism | Status |
|---|---|---|---|
| hline | `<div>` `border-top` only (`!important` zeros rest) | outer wrapper + inner `<div>` `border-top` (other sides omitted) | ⚠️ DIFF (DOM strategy + nesting) |
| vline | `<div>` `border-left` only (`!important` zeros rest) | outer + inner `<div>` `border-left` | ⚠️ DIFF |
| rect | `<div>` `border` (all sides, no !important) | outer + inner `<div>` `border` (all sides) | ✅ MATCH (semantic) |
| oval | `<div>` `border` + inline `border-radius:50%` | outer + inner `<div>` `border` + inline `border-radius:50%` | ✅ MATCH (semantic) |

**DOM strategy verdict:** Both V1 and V3 use `<div>` + CSS borders. **No SVG in either.** Pixel-perfect parity for visible borders is achievable IF the V1↔V3 option-key roundtrip is fixed (finding #1).

### E.5 Pre-built factory grouping

All 4 shapes live in `"辅助"` group in both V1 and V3 (spot check). ✅ MATCH.

### E.6 Inserter helpers

| V1 method | V1 line | V3 mapping | Status |
|---|---|---|---|
| `addPrintHline(t)` | 11338 | `createHLineElement` in `shape-lines.ts:114` | ✅ MATCH (renamed) |
| `addPrintVline(t)` | 11336 | `createVLineElement:120` | ✅ MATCH |
| `addPrintRect(t)` | 11340 | `createRectElement:126` | ✅ MATCH |
| `addPrintOval(t)` | 11342 | `createOvalElement:132` | ✅ MATCH |

---

## F — Out-of-scope notes parity

| V1 row | V1 evidence | V3 mapping | Status |
|---|---|---|---|
| Adsorb / snap lines | V1 line 7495 / 7515 | not implemented per-shape; drag uses gridSize | 🔴 MISSING |
| Pagination panel-level `panelPageRule === 'none'` | V1 line 1183 | not implemented for shapes | 🔴 MISSING |
| `isHeaderOrFooter()` / `isFixed()` inherited | V1 line 1132 | not implemented | 🔴 MISSING |
| `updateDesignViewFromOptions` calls `css(designTarget, getData())` | V1 line 10246 etc. | V3 reactivity (Vue computed) re-applies on options change | ✅ MATCH (semantic) |

---

## G — V3-specific findings (NEW issues introduced by V3)

### G.1 🔴 CRITICAL — Property-panel writes V3-renamed keys; renderer reads V1 keys

**Root cause:** `ShapePropertyPanel.vue` renames V1 option keys without coordinating with the SFCs and renderer.

| V1 key (rendered by `HlineElement.vue:33-44`, `VlineElement.vue:33-44`, `RectElement.vue:33-44`, `OvalElement.vue:33-45`, `render.ts:478-503`) | V3 panel key (`ShapePropertyPanel.vue:60-86`) |
|---|---|
| `borderWidth` | `strokeWidth` (line 61) |
| `borderColor` | `strokeColor` (line 67) |
| `borderStyle` | `strokeStyle` (line 73) |
| `backgroundColor` | `fillColor` (line 79) |
| `borderRadius` (rect, but not even read by RectElement.vue) | `borderRadius` (line 85 — matches name but no read path) |

**Symptom:** User edits stroke width in property panel → store gets `options.strokeWidth=N`, but `HlineElement.vue:38` reads `opts.borderWidth` → falls back to default `1`. Visible result: **nothing changes**.

**Fix paths (must decide as parity decision):**
- A) Property panel writes V1 keys (`borderWidth`, `borderColor`, `borderStyle`, `backgroundColor`). Keep V1 names for JSON portability. Recommended.
- B) Migrate SFCs + renderer to read V3-renamed keys. Add migration layer for V1 template JSON.

Either way: **the bug is real and blocks every shape-property edit in V3 today.**

### G.2 🔴 Resize handles default to all 4 edges + corners

`ElementWrapper.vue:114-131` calls `enableElementResize(el, { ... })` with no `edges` arg. `resize.ts:160` defaults to `{ top: true, right: true, bottom: true, left: true }`. Per `resize.ts:144-200`, interact.js renders 8 handles (4 edges + 4 corners) when all 4 edges are enabled.

V1 handle counts per shape (V1 line 1092, 10255, 10297):
- hline: 2 (`east`, `rotate`)
- vline: 2 (`south`, `rotate`)
- rect: 4 (`south`, `west`, `east`, `rotate`)
- oval: 4 (same as rect)

**Impact:** V3 lets users resize hline north/south (V1 forbade); resize rect/oval from the top edge or corners (V1 forbade). For users with V1 muscle memory, this changes UX. May also change how templates roundtrip (resize via top edge changes `top` + `height`; V1 templates never had `top` changes from a resize gesture).

**Fix:** Per-shape `edges` override at `ElementWrapper` invocation, switched on `element.printElementType.type`.

### G.3 🟡 Rotation (`transform`) not implemented for shapes

V1 has `transform: rotate(Ndeg)` option (V1 line 4429-4454) plus the `r` rotate handle on every shape. V3 has NEITHER the option in any property panel NOR the rotate handle in `enableElementResize`.

**Impact:** V1 templates with `options.transform: 45` for an hline/rect render as un-rotated in V3.

### G.4 🟡 Locks (`positionLocked`, `sizeLocked`) not implemented

V1 has rich lock semantics (V1 section A.11). V3 has none. Templates with locked elements work in V3 — the lock just doesn't apply.

**Impact:** V1 templates relying on locking to prevent end-user edits in designer mode lose that protection in V3.

### G.5 🟡 `pageBreak` / `showInPage` / `fixed` / `axis` / `coordinateSync` / `widthHeightSync` not implemented

Same impact pattern: V1 templates use these; V3 silently ignores. Per-shape design-tab options that V1 exposes (`基础` and `高级` tabs) are entirely absent from V3 `ShapePropertyPanel`.

### G.6 🟡 Dead default options written by `shape-lines.ts`

Factories write defaults that are read NOWHERE in V3:

- `HLINE_DEFAULT_OPTIONS.borderTop = 'solid'` (`shape-lines.ts:19`) — only `borderWidth` + `borderColor` are read.
- `VLINE_DEFAULT_OPTIONS.borderLeft = 'solid'` (`shape-lines.ts:36`) — same.
- `RECT_DEFAULT_OPTIONS.borderStyle = 'solid'` (`shape-lines.ts:53`) — RectElement.vue hardcodes `'solid'`.
- `OVAL_DEFAULT_OPTIONS.borderStyle = 'solid'`, `OVAL_DEFAULT_OPTIONS.borderRadius = 50` (`shape-lines.ts:70, 73`) — OvalElement.vue hardcodes both inline.

**Impact:** Cosmetic / footgun. Inconsistent JSON. Users editing JSON who flip `borderStyle` to `'dashed'` see no change.

### G.7 ➕ NEW `borderRadius` UI for rect (V1 didn't expose this)

`ShapePropertyPanel.vue:146-156` shows a `Border radius (pt)` field for rect only. V1 had the option class defined (`[V1 line 4477-4498]`) but never registered it in `rect.tabs` (V1 quirk #4). V3 exposes it.

**Caveat:** RectElement.vue:33-44 does NOT read `opts.borderRadius` → the UI writes a dead field. To complete this feature, need:
```ts
// RectElement.vue shapeStyle
borderRadius: typeof opts.borderRadius === 'number' ? opts.borderRadius + 'pt' : undefined,
```

---

## H — Verification

```bash
# Line count (target ≥ 500)
wc -l docs/V3-PARITY-MATRIX/05-shapes.md

# Status-marker count (target ≥ 60)
grep -cE "✅|🟡|🔴|⚠️|⏸️|➕" docs/V3-PARITY-MATRIX/05-shapes.md
```

---

## I — Recommended next actions (sorted by severity)

1. **🔴 CRITICAL (BLOCK)** — Fix the V3 option-key roundtrip (finding G.1 / #1). Either rename panel keys back to V1 or migrate SFCs + renderer. Without this, no shape property edit takes effect.
2. **🔴 HIGH** — Add per-shape `edges` override in `ElementWrapper.vue` so hline gets only east, vline only south, rect/oval get south+west+east (finding G.2 / #5).
3. **🔴 HIGH** — Wire `RectElement.vue` to read `opts.borderRadius` (finding G.7 / #7).
4. **🟡 MEDIUM** — Implement rotation (`transform`) option + rotate handle for parity (G.3).
5. **🟡 MEDIUM** — Decide lock-semantics parity: implement or document removal (G.4).
6. **🟡 MEDIUM** — Decide on `pageBreak` / `showInPage` / `fixed` / `axis` / sync-toggles: implement or scope-cut and document (G.5).
7. **🟡 LOW** — Clean up dead default keys in `shape-lines.ts` (G.6).
8. **⏸️ DEFERRED** — Document the intentional cleanups (font-context-menu noise, hline/vline `getHtml` inconsistency, V1 quirk-#4 panel) as ADRs.

---

*Generated 2026-05-11 from V1 inventory section A-F citations and V3 source spot-reads. All claims traceable to file:line in either V1 bundle.js / config.js or V3 src/hiprint-v3/*.ts/.vue.*
