# V1 ↔ V3 CSS / Styling Parity Matrix

**Generated:** 2026-05-11
**Source:** V1 inventory `docs/V1-INVENTORY/styles.md` (231 classes / 18 areas)
**V3 surface:** 22 `*.vue` scoped style blocks + `src/hiprint-v3/print/render.ts` (V1 print-class emitter) + `src/hiprint-v3/interactions/context-menu.ts`
**No global stylesheet in V3** — caller still owns `print-lock.css` (passed via `BrowserPrintOptions.stylesheetHref` / `styleText`).

---

## Status legend

| Symbol | Meaning |
|---|---|
| ✅ | Same class name preserved (V1 selector emitted at print or design time) |
| 🟡 | Replaced by an equivalent (renamed / BEM variant / scoped class) — semantic parity |
| 🔴 | Missing in V3 — no equivalent, regression risk if caller relied on it |
| ⚠️ | Replaced by a different mechanism (Vue reactive class binding, store flag, store-driven render) — semantic parity but selector-based theming/business overrides break |

---

## High-level architectural diff

| Concern | V1 (jQuery + global CSS) | V3 (Vue SFCs + scoped CSS) |
|---|---|---|
| CSS delivery | `src/hiprint/css/hiprint.css` (2626 lines, global) + `print-lock.css` (360 lines, print only) | Per-`.vue` `<style scoped>` blocks; **no global designer CSS**. `print-lock.css` still required at print time, caller-owned (V3 does not ship/bundle it). |
| Class naming | Global `.hiprint-*` prefix | Mostly global `.hiprint-*` (NOT `:scoped` hashed because authored as `<style scoped>` but with selectors that survive scoping for top-level component classes) + BEM `__` / `--` modifiers (e.g. `.hiprint-canvas__ruler--top`, `.hiprint-printPanel--active`) |
| State signalling | jQuery `addClass` / `removeClass` (e.g. `.selected`, `.editing`, `.locked`, `.alwaysHide`) | Vue reactive `:class` binding driven by Pinia stores (`canvas.selectedIds`, `canvas.activePanelId`, element store) |
| Print-time DOM | bundle.js builds DOM with jQuery + global CSS hits it | `print/render.ts` re-emits V1 wrapper classes (`.hiprint-printPaper`, `.hiprint-printElement`, `.hiprint-printElement-<type>`, `.hiprint-printElement-<type>-content`) so caller's `print-lock.css` still matches |
| Design-time DOM | Same global classes used in designer + print | Designer uses BEM names; **print output diverges** intentionally (designer chrome lives in scoped blocks, print render writes V1 names) |
| CSS variables | None (V1 hard-codes hex colors) | Limited intro: `--hiprint-designer-bg`, `--hiprint-designer-fg`, `--hiprint-designer-divider`, `--hiprint-designer-canvas-bg`, `--hiprint-designer-preview-bg` in `HiprintDesigner.vue` |
| Z-index management | 11 hard-coded levels (1, 9, 10, 100, 500, 999, 1000, 10000) | Context menu = 1000 (via floating-ui); popover = 1000; rulers = SVG inside canvas (no z); selection / drag handled by interact.js + outline |
| Theming | Hot-patch global CSS | Pass CSS vars at `:root` or designer container |

---

## Section A — Paper & Page Layout (11 classes)

| V1 class | V1 source | V1 styles | V3 equivalent | File:line | Status | Notes |
|---|---|---|---|---|---|---|
| `.hiprint-printPaper` | print-lock.css:22, hiprint.css | Paper container, white bg, box-shadow | `.hiprint-printPaper` | `print/render.ts:113` + `HiprintPanel.vue:175` | ✅ | Class preserved both design + print time. V3 design-time styles via inline `paperStyle` computed (width/height pt, background white, box-shadow) — NOT via `.hiprint-printPaper` rule. Caller's `print-lock.css` still hits print output. |
| `.hiprint-printPaper.design` | print-lock.css:46 | Designer mode override (`overflow: visible`, dashed border) | ⚠️ (no `.design` modifier emitted; design-time is the SFC defaults) | `HiprintPanel.vue:78` | ⚠️ | V3 design vs print is **two different DOM emitters**, not one DOM with `.design` toggle. Business CSS that targets `.hiprint-printPaper.design` will not apply in V3 designer. Print output never had `.design` in V1 either, so print-lock.css unaffected. |
| `.hiprint-printPaper.grid` | bundle.js:9711 | Grid background image (5mm pattern) | ⚠️ inline `backgroundImage` linear-gradient | `HiprintPanel.vue:88-94` | ⚠️ | V3 emits grid pattern inline (driven by `canvas.gridVisible` store flag). No `.grid` class is added. Visual parity good; selector parity lost. |
| `.hiprint-printPaper-content` | print-lock.css:33 | Inner content wrapper | 🔴 not emitted | n/a | 🔴 | V3 `renderPaperContent` (render.ts) appends elements **directly to `.hiprint-printPaper`** (no wrapping `.hiprint-printPaper-content` div). Print-lock.css rules scoped to `.hiprint-printPaper .hiprint-printPaper-content` will be dead — but check shows the only rule on it sets `position: relative; width/height: 100%` which on V3 is set via inline style on the paper directly, so visual parity is preserved. |
| `.hiprint-printTemplate` | print-lock.css:51 | Template root | `.hiprint-printTemplate` | `print/render.ts:70` | ✅ | Print-time only. Designer top-level wrapper is `.hiprint-designer` (different name). |
| `.hiprint-printPanel` | print-lock.css:51,60 | Panel wrapper | `.hiprint-printPanel` | `print/render.ts:104` + `HiprintPanel.vue:169` | ✅ | Same name at design + print. V3 adds BEM modifiers `--active` and `--readonly`. |
| `.hideheaderLinetarget` | print-lock.css:70 | `display: none` (hide header during pagination) | 🔴 not emitted | n/a | 🔴 | V1 toggled this during long-text pagination to suppress headers on continuation pages. V3 long-text auto-pagination is **not ported** (`render.ts:17` comment "Long-text BinarySearch pagination is NOT ported in this pass"); class would only become relevant when that work lands. |
| `.hidefooterLinetarget` | print-lock.css:71 | `display: none` (hide footer on last page) | 🔴 not emitted | n/a | 🔴 | Same context as above. Print-lock.css selector still in the file but unreachable from V3 emitter. |
| `.hiprint-paperNumber` | print-lock.css:237 | Page number display (paperNumberLeft/Top inline-positioned) | 🔴 not emitted | n/a | 🔴 | V1 emitted `<div class="hiprint-paperNumber">` when `paperNumberDisabled !== true`. V3 `renderPanel` does not append a paperNumber node. Caller relying on visual page numbering on multi-panel prints will regress. |
| `.hiprint-paperNumber-disabled` | print-lock.css:255 | Disabled state (visually subdued) | 🔴 not emitted | n/a | 🔴 | Same as above. |
| `.hiprint-printElement` | hiprint.css | Generic element wrapper | `.hiprint-printElement` | `print/render.ts:201` | ✅ | Both design (`ElementWrapper.vue` adds `.hiprint-element` — different name) and print render emit this base class. **Design class differs**: V3 designer uses `.hiprint-element` + `.hiprint-element--selected`. |

---

## Section B — Text Elements (8 classes)

| V1 class | V1 source | V1 styles | V3 equivalent | File:line | Status | Notes |
|---|---|---|---|---|---|---|
| `.hiprint-printElement-text` | print-lock.css:89, hiprint.css | Base text, 9pt SimSun | `.hiprint-printElement-text` | `print/render.ts:203` (via `+ type`) | ✅ | Print-time class preserved. Designer surface uses `TextElement.vue` SFC. |
| `.hiprint-printElement-text-content` | print-lock.css:111 | Designer wrapper inside text | `.hiprint-printElement-text-content` | `print/render.ts:224` | ✅ | Emitted at print time. Print-lock.css `.design .hiprint-printElement-text-content { padding-left: 1px; }` rule applies only when `.design` is on ancestor — see Section A row for `.design` modifier (⚠️ at design time). |
| `.hiprint-printElement-longText` | print-lock.css:116 | Multi-line text | `.hiprint-printElement-longText` | `print/render.ts:203` (via `+ type`) | ✅ | Print class preserved. |
| `.hiprint-printElement-longText-content` | print-lock.css | Long-text inner wrapper | `.hiprint-printElement-longText-content` | `print/render.ts:285` | ✅ | Emitted. |
| `.hiprint-text-content-middle` | bundle.js:4817 | `align-items: center` via grid (vertical: middle) | ⚠️ inline `display: flex; align-items: center` | `print/render.ts` (text renderer adds style, not class) | ⚠️ | V3 maps `textAlign` vertical via inline flex styles instead of class toggle. Visual parity, selector lost. |
| `.hiprint-text-content-bottom` | bundle.js | Vertical bottom | ⚠️ inline `align-items: flex-end` | render.ts text path | ⚠️ | Same pattern — inline style. |
| `.hiprint-text-content-wrap-nowrap` | bundle.js:4844 | `white-space: nowrap` | ⚠️ inline | render.ts | ⚠️ | Inline style, not class. |
| `.hiprint-text-content-wrap-clip` | bundle.js:4844 | `overflow: hidden` | ⚠️ inline | render.ts | ⚠️ | Same pattern. |
| `.hiprint-text-content-wrap-ellipsis` | bundle.js:4844 | `text-overflow: ellipsis` | ⚠️ inline | render.ts | ⚠️ | Same pattern. |

---

## Section C — Table Elements (11 classes)

| V1 class | V1 source | V1 styles | V3 equivalent | File:line | Status | Notes |
|---|---|---|---|---|---|---|
| `.hiprint-printElement-table` | print-lock.css:139 | Table container | `.hiprint-printElement-table` | `print/render.ts:203` (via `+ type`) | ✅ | Print class preserved. |
| `.hiprint-printElement-table-content` | bundle.js | Inner table wrapper | `.hiprint-printElement-table-content` | `print/render.ts:512` | ✅ | Emitted. |
| `.hiprint-printElement-table thead` | print-lock.css:161 | Header bg #e8e8e8, bold | ✅ via same selector hitting print-lock.css | render.ts emits `<thead>` inside `.hiprint-printElement-table` | ✅ | Selector still hits at print time. |
| `.hiprint-printElement-tableTarget` | print-lock.css:170 | Inner table, width 100% | `.hiprint-printElement-tableTarget` | render.ts table emitter | ✅ | |
| `.hiprint-printElement-tableTarget-border-all` | print-lock.css:189 | All borders | ✅ class emitted at print time per `tableBorder` opt | render.ts | ✅ | |
| `.hiprint-printElement-tableTarget-border-none` | print-lock.css:192 | No borders | ✅ | render.ts | ✅ | |
| `.hiprint-printElement-tableTarget-border-lr` | print-lock.css:195 | L/R borders | ✅ | render.ts | ✅ | |
| `.hiprint-printElement-tableTarget-border-top` | print-lock.css:209 | Top border only | ✅ | render.ts | ✅ | |
| `.hiprint-printElement-tableTarget-border-bottom` | print-lock.css:212 | Bottom only | ✅ | render.ts | ✅ | |
| `.hiprint-printElement-tableTarget-border-td-all` | print-lock.css:219 | Cell borders all | ✅ | render.ts | ✅ | |
| `.hiprint-printElement-tableTarget-border-td-none` | print-lock.css:216 | Cell borders none | ✅ | render.ts | ✅ | |
| `.hiprint-printElement-table-handle` | print-lock.css:241 | Designer drag handle (16pt, rgba(64,158,255,0.9)) | 🔴 not emitted | n/a | 🔴 | V1 designer drew a small drag handle square above each table for resize/drag. V3 designer relies on interact.js corner/edge handles on `.hiprint-element` outline — no separate `.hiprint-printElement-table-handle` div. UX equivalent but selector gone. |

Plus table inline-editor (V3-only, no V1 equivalent):

| V3 class | File:line | Purpose | Status |
|---|---|---|---|
| `.hiprint-cell-editor` / `.hiprint-cell-select` | `TableInlineEditor.vue:160-161` | Inline cell edit input (border #409eff, full size) | V3-new (V1 did not support inline cell editing) |

---

## Section D — Shape Elements (4 classes)

| V1 class | V1 source | V1 styles | V3 equivalent | File:line | Status | Notes |
|---|---|---|---|---|---|---|
| `.hiprint-printElement-vline` | print-lock.css:264,269 | Vertical line (border-left 0.75pt solid) | `.hiprint-printElement-vline` | `render.ts:203` | ✅ | Print class preserved. |
| `.hiprint-printElement-hline` | print-lock.css:264,276 | Horizontal line (border-top 0.75pt solid) | `.hiprint-printElement-hline` | `render.ts:203` | ✅ | |
| `.hiprint-printElement-rect` | hiprint.css | Rectangle | `.hiprint-printElement-rect` | `render.ts:203` | ✅ | |
| `.hiprint-printElement-oval` | hiprint.css | Oval/circle | `.hiprint-printElement-oval` | `render.ts:203` | ✅ | |
| (extra) `.hiprint-printElement-<shape>-content` | hiprint.css | Inner shape content | `.hiprint-printElement-<type>-content` | `render.ts:485` | ✅ | Generated dynamically. |

---

## Section E — Other Element Types (4 classes)

| V1 class | V1 source | V1 styles | V3 equivalent | File:line | Status | Notes |
|---|---|---|---|---|---|---|
| `.hiprint-printElement-image` | inline-only in V1 | Image (inline styles) | `.hiprint-printElement-image` + `.hiprint-printElement-image-content` | `render.ts:203,253` | ✅ | Class added at print. |
| `.hiprint-printElement-barcode` | hiprint.css | Barcode | `.hiprint-printElement-barcode` + `-content` | `render.ts:203,326` | ✅ | |
| `.hiprint-printElement-qrcode` | hiprint.css | QR code | `.hiprint-printElement-qrcode` + `-content` + `-content-title` | `render.ts:203,386,428` | ✅ | Title-below variant adds the `-content-title` div (V1 parity). |
| `.hiprint-printElement-html` | hiprint.css | User-HTML wrapper | `.hiprint-printElement-html` + `-content` | `render.ts:203,457` | ✅ | |
| (extra) `.hiprint-watermark` | V1 | Watermark layer | `.hiprint-watermark` | `render.ts:732` | ✅ | Class preserved. |

---

## Section F — Designer Chrome (7 classes)

| V1 class | V1 source | V1 styles | V3 equivalent | File:line | Status | Notes |
|---|---|---|---|---|---|---|
| `.hiprint-designer` | hiprint.css | Designer root | `.hiprint-designer` | `HiprintDesigner.vue:530` | ✅ | Same name; styles re-authored as scoped BEM. |
| `.hiprint-designer-layout` | hiprint.css | Flex layout (`display: flex`) | 🟡 `.hiprint-designer__main` | `HiprintDesigner.vue:546` | 🟡 | Renamed to BEM. Layout shape same (`display: flex; flex-direction: row`). |
| `.hiprint-designer-panel-left` | hiprint.css | Left sidebar | 🟡 `.hiprint-designer__element-list` (flex 0 0 200px, border-right) | `HiprintDesigner.vue:553` | 🟡 | Renamed; same role. |
| `.hiprint-designer-panel-right` | hiprint.css | Right sidebar | 🟡 `.hiprint-designer__property-panel` (flex 0 0 260px, border-left) | `HiprintDesigner.vue:565` | 🟡 | Renamed. |
| `.hiprint-designer-panel-center` | hiprint.css | Center canvas (`flex: 1`, overflow auto) | 🟡 `.hiprint-designer__canvas` (flex 1 1 auto) | `HiprintDesigner.vue:559` | 🟡 | Renamed. |
| `.hiprint-designer-resize-bar` | hiprint.css | Resize divider (`width: 4px; cursor: col-resize`) | 🔴 not implemented in V3 SFC | n/a | 🔴 | V3 HiprintDesigner uses fixed `flex: 0 0 200px` / `flex: 0 0 260px` — no draggable resizer. UX regression for users who resized panels. |
| `.hiprint-designer-edge-toggle` | hiprint.css | Collapse button (position: fixed; 24px circle; z-index 100) | 🔴 not implemented | n/a | 🔴 | No collapse button in V3 designer. Users who collapsed sidebars lose feature. |
| (extra V3) `.hiprint-designer--preview` | n/a | Preview mode modifier (hides toolbar) | n/a | `HiprintDesigner.vue:577` | V3-new | Modifier class for read-only / preview rendering. |

---

## Section G — Toolbar (8 classes + V3 extensions)

| V1 class | V1 source | V1 styles | V3 equivalent | File:line | Status | Notes |
|---|---|---|---|---|---|---|
| `.hiprint-toolbar` | hiprint.css | Toolbar root | `.hiprint-toolbar` | `HiprintToolbar.vue:1274` | ✅ | Name preserved. V3 adds `flex-wrap`, `gap: 4px`, light bg `#fafafa`. |
| `.hiprint-toolbar-group` | hiprint.css | Button group (`display: flex`) | 🟡 `.hiprint-toolbar-paper` / `.hiprint-toolbar-panel-manager` / `.hiprint-toolbar-panel-chips` | `HiprintToolbar.vue:1331-1350` | 🟡 | V3 splits into role-specific group containers; no generic `.hiprint-toolbar-group`. |
| `.hiprint-toolbar-btn` | hiprint.css | Standard button (padding 4px 10px; border 1px #ddd) | `.hiprint-toolbar-btn` | `HiprintToolbar.vue:1286` | ✅ | Name preserved. V3 polishes spacing (padding 4px 8px) + adds `:focus-visible` outline. |
| `.hiprint-toolbar-btn.active` | bundle.js:14248 | Active state (`background: #2196f3; color: white`) | 🟡 `.hiprint-toolbar-btn.is-active` | `HiprintToolbar.vue:1317` | 🟡 | **Renamed** `.active` → `.is-active`. Color drift: V1 `#2196f3` (Material blue), V3 `#1677ff` text on `#e6f4ff` (Ant Design blue). |
| `.hiprint-toolbar-btn-primary` | hiprint.css | Primary button (bg #2196f3) | 🔴 not present | n/a | 🔴 | V3 has no `-primary` variant. Caller adding primary action toolbar buttons must style directly. |
| `.hiprint-toolbar-btn-danger` | hiprint.css | Danger button (bg #f56c6c) | 🔴 not present | n/a | 🔴 | Same as above. |
| `.hiprint-toolbar-input` | hiprint.css | Input field (padding 4px 8px) | 🟡 `.hiprint-toolbar-select` | `HiprintToolbar.vue:1389` | 🟡 | Renamed for `<select>`; no generic `-input` rule. |
| `.hiprint-toolbar-popover` | hiprint.css | Floating menu (z-index 1000) | 🟡 `.hiprint-custom-paper-popover` | `CustomPaperPopover.vue:104` | 🟡 | Renamed + scoped to its component. z-index 1000 preserved. |
| (extra V3) `.hiprint-toolbar-sep` | n/a | Vertical separator (1px x 18px) | n/a | `HiprintToolbar.vue:1323` | V3-new | V1 had no sep class. |
| (extra V3) `.hiprint-toolbar-chip` / `.is-active` | n/a | Pagination/panel chip pill (border-radius 12px) | n/a | `HiprintToolbar.vue:1352-1376` | V3-new | TB-003 panel chip list. |
| (extra V3) `.hiprint-toolbar-pagination` | n/a | Pagination indicator wrapper | n/a | `HiprintToolbar.vue:1379` | V3-new | TB-006 pagination control. |
| (extra V3) `.hiprint-toolbar-label` | n/a | Inline label (color #666) | n/a | `HiprintToolbar.vue:1385` | V3-new | |
| (extra V3) `.hiprint-toolbar-paper` | n/a | Anchor for custom paper popover (position relative) | n/a | `HiprintToolbar.vue:1331,1341` | V3-new | TB-004 popover anchor. |

---

## Section H — Element List Panel (11+ classes)

| V1 class | V1 source | V1 styles | V3 equivalent | File:line | Status | Notes |
|---|---|---|---|---|---|---|
| `.hiprint-el-list-toggle` | bundle.js, hiprint.css | Toggle button (position fixed, 50% radius) | 🔴 not implemented | n/a | 🔴 | V1 had a floating "≡" button to show/hide the element list. V3 element list is always-visible in `HiprintDesigner` layout — no toggle. UX simplified; class gone. |
| `.hiprint-el-list-panel` | bundle.js, hiprint.css | Panel container (fixed, 280px wide, display:none default) | 🟡 `.hiprint-element-list` | `HiprintElementList.vue:298` | 🟡 | Renamed. V3 is inline flex panel inside designer, not floating. `position: fixed` lost. |
| `.hiprint-el-list-panel.visible` | bundle.js:11832 | Display: block | ⚠️ store-driven `v-if` / always-rendered | n/a | ⚠️ | No `.visible` toggle; visibility is template-level `v-if` in `HiprintDesigner` (driven by `showElementList` prop). |
| `.hiprint-el-list-row` | hiprint.css | Item row (`display: flex; padding 8px`) | 🟡 `.hiprint-element-list-item` | `HiprintElementList.vue:356` | 🟡 | Renamed. V3 styles each as `<button>` not `<div>`, better a11y. |
| `.hiprint-el-list-row.selected-el` | bundle.js:11856 | Selected (bg #e3f2fd, border-left 3px #2196f3) | 🔴 not implemented | n/a | 🔴 | V1 list highlighted the currently-selected canvas element in the list. V3 list is **sidebar palette** (element-type catalog) — it has no concept of "selected canvas element row". The selected-canvas-element overlay lives on `.hiprint-element--selected` (ElementWrapper). Different role. |
| `.hiprint-el-list-row.hidden-el` | bundle.js | Hidden element marker (opacity 0.5) | 🔴 not implemented | n/a | 🔴 | Same root cause: V3 list is palette, not canvas-element list. |
| `.el-type-tag` | hiprint.css | Type badge (padding 2px 6px; color white) | 🟡 `.hiprint-element-list-icon` | `HiprintElementList.vue:386` | 🟡 | Renamed to per-component scoped class. V3 also uses module/group `<details>` headers (`.hiprint-element-list-module-title`, `.hiprint-element-list-group-title`) which V1 lacked. |
| `.tag-text`, `.tag-image`, `.tag-table`, `.tag-longText`, `.tag-barcode`, `.tag-qrcode`, `.tag-hline`, `.tag-vline`, … | hiprint.css | Per-type tag color (e.g. text=#409eff, image=#67c23a, table=#e6a23c) | 🔴 not present | n/a | 🔴 | V3 does not color-code element types in the sidebar. Visual regression: list is monochrome. |
| (extra V3) `.hiprint-element-list-module` | n/a | Module group wrapper (`<details>`) | n/a | `HiprintElementList.vue:320` | V3-new | Collapsible per-module grouping. |
| (extra V3) `.hiprint-element-list-empty` / `-empty-tip` | n/a | Empty state copy | n/a | `HiprintElementList.vue:313, 350` | V3-new | |

---

## Section I — Property Panel (10 classes)

| V1 class | V1 source | V1 styles | V3 equivalent | File:line | Status | Notes |
|---|---|---|---|---|---|---|
| `.hiprint-setting-panel` | hiprint.css | Settings panel (`flex column; padding 6px`) | 🟡 `.hiprint-property-panel` | `HiprintPropertyPanel.vue:646` | 🟡 | Renamed. Wider (240px min). |
| `.hiprint-option-items` | hiprint.css | Options grid (`flex-wrap`, `gap 6px 0`) | 🟡 `.hiprint-property-grid-2` | `HiprintPropertyPanel.vue:742` | 🟡 | Replaced by CSS Grid 2-column layout (cleaner). |
| `.hiprint-option-item` | hiprint.css | Single option (50% width) | 🟡 `<label>` inside `.hiprint-property-fieldset` (full row, flex column) | `HiprintPropertyPanel.vue:709-715` | 🟡 | Different layout pattern. V1 was 2-col side-by-side; V3 is row-stack inside fieldset, with explicit `.hiprint-property-grid-2` for paired controls. |
| `.hiprint-option-item-label` | hiprint.css | Label (40% width) | 🟡 inside `<label>` text | n/a | 🟡 | Label content sits at top of column-flex `<label>`. |
| `.hiprint-option-item-field` | hiprint.css | Field (60% width) | 🟡 `<input>` directly inside `<label>` | n/a | 🟡 | |
| `.hiprint-option-item-settingBtn` | hiprint.css | Settings button (padding 4px 8px; bg #e0e0e0) | 🟡 `.hiprint-property-toggle` | `HiprintPropertyPanel.vue:758` | 🟡 | Renamed + restyled (white bg, blue active state). |
| `.hiprint-option-item-deleteBtn` | hiprint.css | Delete button (color #f56c6c) | 🔴 not implemented | n/a | 🔴 | Property-level delete-per-field is not in V3 property panel. Element-level delete lives in toolbar / context menu. |
| `.hiprint-option-item-lockToggleBtn` | hiprint.css | Lock toggle | 🔴 not implemented | n/a | 🔴 | No lock toggle per option in V3 property panel. Position/size lock for an element is store-flag based (not surfaced in property UI yet). |
| `.hiprint-option-table-selected-columns` | hiprint.css | Table columns manager (border 1px #ddd) | 🟡 `.hiprint-table-col-section` + `.hiprint-table-col-row` | `TablePropertyPanel.vue:422-441` | 🟡 | Renamed. V3 has dedicated rows for col title/field/width/align. |
| `.hiprint-column-dragging` | bundle.js:4944 | Dragging state (bg #e3f2fd) | 🔴 not implemented | n/a | 🔴 | Column drag-reorder not implemented in V3 TablePropertyPanel. (Add/remove columns yes; reorder by drag no.) |
| (extra V3) `.hiprint-property-fieldset` | n/a | Grouped fieldset (border, white bg) | n/a | `HiprintPropertyPanel.vue:692` | V3-new | Replaces "section" pattern with semantic `<fieldset>`. |
| (extra V3) `.hiprint-property-multi-hint` | n/a | Multi-select hint banner | n/a | `HiprintPropertyPanel.vue:667` | V3-new | Shown when multiple elements selected. |
| (extra V3) `.hiprint-property-empty` | n/a | Empty state | n/a | `HiprintPropertyPanel.vue:660` | V3-new | |
| (extra V3) `.hiprint-property-header` / `-type` / `-id` | n/a | Selected element header | n/a | `HiprintPropertyPanel.vue:675-690` | V3-new | Shows element type + ID. |

Per-element property panels exist as siblings: `PaperPropertyPanel.vue`, `TablePropertyPanel.vue`, `ImagePropertyPanel.vue`, `BarcodePropertyPanel.vue`, `QrcodePropertyPanel.vue`, `ShapePropertyPanel.vue`, `HtmlPropertyPanel.vue` — each owns scoped versions of `.hiprint-property-fieldset` (duplicated rules).

---

## Section J — Context Menu (4 classes)

| V1 class | V1 source | V1 styles | V3 equivalent | File:line | Status | Notes |
|---|---|---|---|---|---|---|
| `.hiprint-ctx-menu` | hiprint.css | Menu container (`position: absolute; z-index 10000`) | 🟡 `.hiprint-context-menu` | `interactions/context-menu.ts:250` | 🟡 | **Renamed** `ctx-menu` → `context-menu`. Z-index handled by floating-ui placement (no fixed value). |
| `.hiprint-ctx-menu-item` | hiprint.css | Menu item (padding 8px 12px; cursor pointer) | 🟡 `.hiprint-context-menu-item` | `interactions/context-menu.ts:222` | 🟡 | Renamed. |
| `.hiprint-ctx-menu-item.disabled` | hiprint.css | Disabled (opacity 0.5; cursor not-allowed) | 🟡 `.hiprint-context-menu-item.is-disabled` | `interactions/context-menu.ts:223` | 🟡 | `.disabled` → `.is-disabled` (BEM-style state). |
| `.hiprint-ctx-menu-divider` | hiprint.css | Divider (height 1px; bg #ddd) | 🟡 `.hiprint-context-menu-divider` | `interactions/context-menu.ts:214` | 🟡 | Renamed. |
| (extra V3) `.hiprint-context-menu-portal` | n/a | Body-mounted portal wrapper | n/a | `interactions/context-menu.ts:274` | V3-new | Required by floating-ui mount strategy. |
| (extra V3) `.hiprint-context-menu-icon` / `-label` / `-shortcut` | n/a | Item sub-parts | n/a | `interactions/context-menu.ts:231-239` | V3-new | Structured slots inside item. |

**Caller impact:** any business CSS overriding `.hiprint-ctx-menu*` will not apply in V3. Migration: rewrite to `.hiprint-context-menu*`.

---

## Section K — Ruler (5 classes)

| V1 class | V1 source | V1 styles | V3 equivalent | File:line | Status | Notes |
|---|---|---|---|---|---|---|
| `.hiprint_rul_wrapper` | hiprint.css | Ruler wrapper (position absolute) | 🔴 not present | n/a | 🔴 | V3 rulers are SVG, not divs — wrapper class gone. |
| `.hiprint-ruler-track` | hiprint.css | Background (`bg #fafbfc; border #e0e0e0`) | 🟡 `.hiprint-canvas__ruler` / `--top` / `--left` | `HiprintCanvas.vue:414-430` | 🟡 | Renamed + BEM. V3 uses one class per orientation. Color drift: V1 `#fafbfc`, V3 `#fafafa` (closer to Ant Design). |
| `.hiprint-ruler-mark` | hiprint.css | Tick mark (absolute div, bg #999) | ⚠️ SVG `<line>` element | `HiprintCanvas.vue:310-319` | ⚠️ | **Mechanism change**: DOM `<div>` → SVG `<line>`. Tick rendering is now SVG, no individual class per tick. Caller can no longer style individual ticks via CSS. |
| `.hiprint-ruler-text` | hiprint.css | Measurement text (font 10px, #666) | ⚠️ SVG `<text>` element | `HiprintCanvas.vue:320-330` | ⚠️ | Same SVG conversion. Font/color inlined as SVG attributes (`font-size="4"`, `fill="#555"`). |
| `.hiprint-ruler-handle` | hiprint.css | Draggable marker (bg rgba(64,158,255,0.7); cursor move) | 🔴 not implemented | n/a | 🔴 | V1 had draggable ruler handles for setting page-header / page-footer cut lines on the ruler itself. V3 ruler is **read-only**; header/footer positions are set via property panel (`paperHeader` / `paperFooter` numeric inputs) only. UX regression for users who set those by drag. |

---

## Section L — Guide Lines (4 classes)

| V1 class | V1 source | V1 styles | V3 equivalent | File:line | Status | Notes |
|---|---|---|---|---|---|---|
| `.hiprint-guide-layer` | hiprint.css | Guide container (position absolute; z-index 500) | 🔴 not implemented | n/a | 🔴 | V3 has no persistent guide-line layer. Snap-to-grid is handled inline by interact.js `snap` modifier; no visible guide overlay. |
| `.hiprint-guide-line` | hiprint.css | Guide line | 🔴 not implemented | n/a | 🔴 | Same. |
| `.hiprint-guide-line.h` | hiprint.css | Horizontal (height 1px; border-top 1px #2196f3) | 🔴 not implemented | n/a | 🔴 | |
| `.hiprint-guide-line.v` | hiprint.css | Vertical (width 1px; border-left 1px #2196f3) | 🔴 not implemented | n/a | 🔴 | |

**UX impact:** users who relied on persistent guide rails (drag-to-add horizontal/vertical alignment guides) lose this feature. Filed under interactions parity (see `06-interactions.md`).

---

## Section M — Pagination (3 classes)

| V1 class | V1 source | V1 styles | V3 equivalent | File:line | Status | Notes |
|---|---|---|---|---|---|---|
| `.hiprint-pagination` | hiprint.css | Container (inline-block) | 🟡 `.hiprint-toolbar-pagination` | `HiprintToolbar.vue:1379` | 🟡 | Moved into toolbar (no separate floating pagination strip). |
| `.hiprint-pagination > li` | hiprint.css | Page button (border 1px #bdc3c7; float left) | 🟡 `.hiprint-toolbar-chip` | `HiprintToolbar.vue:1352` | 🟡 | Page buttons are now rounded chip pills (border-radius 12px). |
| `.hiprint-pagination .selected` | hiprint.css | Selected (border #2196f3 1px) | 🟡 `.hiprint-toolbar-chip.is-active` | `HiprintToolbar.vue:1372` | 🟡 | Renamed + Ant blue (`#1677ff` solid bg) instead of V1 Material blue border. |

---

## Section N — Element Palette (5 classes)

| V1 class | V1 source | V1 styles | V3 equivalent | File:line | Status | Notes |
|---|---|---|---|---|---|---|
| `.hiprint-ep-type-container` | hiprint.css | Palette root | 🟡 `.hiprint-element-list` | `HiprintElementList.vue:298` | 🟡 | Merged into element list — V3 doesn't separate palette from list (same role). |
| `.hiprint-ep-group` | hiprint.css | Element group | 🟡 `.hiprint-element-list-module` / `-group` | `HiprintElementList.vue:320, 334` | 🟡 | V3 has 2 levels: module (`<details>`) and group (nested rows). |
| `.hiprint-ep-grid` | hiprint.css | Grid (2 cols) | 🔴 not present (vertical list) | n/a | 🔴 | V3 element list is a vertical column, not a 2-col grid. Density change. |
| `.hiprint-ep-card` | hiprint.css | Element card (padding 8px; border 1px #ddd) | 🟡 `.hiprint-element-list-item` | `HiprintElementList.vue:356` | 🟡 | Renamed; styled as `<button>`. |
| `.hiprint-iconify` | hiprint.css | Icon (inline-block; 1em) | 🟡 `.hiprint-element-list-icon` | `HiprintElementList.vue:386` | 🟡 | Renamed. No external iconify integration in V3 list (uses simple bullets / unicode). |

---

## Section O — Template & Save Dialogs (6 classes)

| V1 class | V1 source | V1 styles | V3 equivalent | File:line | Status | Notes |
|---|---|---|---|---|---|---|
| `.hiprint-toolbar-template-mask` | hiprint.css | Modal backdrop (position fixed; bg rgba(0,0,0,0.5); z-index 999) | ⚠️ ant-design-vue `AModal` mask | `TemplateDialog.vue:225` | ⚠️ | V3 uses `AModal` from ant-design-vue → its built-in mask. No `.hiprint-toolbar-template-mask` selector emitted. Z-index handled by ant-design-vue stacking. |
| `.hiprint-toolbar-template-dialog` | hiprint.css | Dialog (position absolute; white bg; z-index 1000) | 🟡 `.hiprint-template-dialog__body` | `TemplateDialog.vue:224` | 🟡 | BEM-style scoped class; outer `AModal` handles positioning. |
| `.hiprint-toolbar-template-grid` | hiprint.css | Template grid (3 cols) | ⚠️ ant `AList` grid | `TemplateDialog.vue` (uses `<AList :grid="...">`) | ⚠️ | Replaced by ant-design-vue grid prop. |
| `.hiprint-toolbar-template-card` | hiprint.css | Template card (padding 12px; border 1px #ddd) | ⚠️ ant `AListItem` | TemplateDialog.vue | ⚠️ | Replaced. V3 adds `.hiprint-template-dialog__no-thumb` for missing-thumbnail fallback. |
| `.hiprint-toolbar-save-dialog` | hiprint.css | Save dialog (position absolute; padding 20px) | 🟡 `.hiprint-save-dialog__form` | `SaveDialog.vue:233` | 🟡 | Renamed. Wrapped in `AModal`. |
| `.hiprint-toolbar-save-input` | hiprint.css | Save input (width 100%; padding 8px) | ⚠️ ant `AInput` inside `AFormItem` | SaveDialog.vue | ⚠️ | Replaced by ant-design-vue form widgets. |
| (extra V3) `.hiprint-template-dialog__header` / `-empty` / `-no-thumb` | n/a | Template dialog sub-parts | n/a | `TemplateDialog.vue:228-250` | V3-new | |
| (extra V3) `.hiprint-business-dialog__*` | n/a | Business dialog (similar to template dialog) | n/a | `BusinessDialog.vue:226-255` | V3-new | V3 surfaces a separate business dialog. |

**Caller impact:** business overrides on `.hiprint-toolbar-template-mask` / `.hiprint-toolbar-template-card` will not apply. Migration: style via `AModal` / `AList` overrides or override the V3 BEM classes.

---

## Section P — Dragging & Selection States (11 classes)

| V1 class | V1 source | V1 styles | V3 equivalent | File:line | Status | Notes |
|---|---|---|---|---|---|---|
| `.horLine` | hiprint.css | Horizontal drag reference (position absolute; border-top 1px rgb(241,110,110)) | 🔴 not implemented | n/a | 🔴 | V1 drew red position-reference lines during drag (X/Y dotted lines + topPosition/leftPosition labels). V3 relies on interact.js without drawing reference lines. UX regression for precise alignment. |
| `.verLine` | hiprint.css | Vertical drag reference | 🔴 not implemented | n/a | 🔴 | Same as above. |
| `.topPosition` | hiprint.css | Top coord label (bg red; color white; padding 0 2px) | 🔴 not implemented | n/a | 🔴 | V1 showed numeric coords next to a dragging element. V3 does not. |
| `.leftPosition` | hiprint.css | Left coord label | 🔴 not implemented | n/a | 🔴 | |
| `.alwaysHide` | bundle.js:4180 | Hidden indicator (`background-color: gray !important`) | 🔴 not implemented | n/a | 🔴 | V1 toggled an `alwaysHide` class on elements explicitly hidden via property. V3 hidden elements are dropped from `printElements` array → no class needed. |
| `.editing` | bundle.js:764 | Edit mode (border 1px red !important; contenteditable) | 🟡 `.hiprint-text-inline-edit` | `TextElement.vue:160` | 🟡 | Renamed + scoped to text editor. Border color drifted from red `1px solid red` → blue `1px solid #409eff`. V1 used contenteditable directly; V3 uses overlaid `<input>` with same dimensions. |
| `.selected` | bundle.js:831 | Selected state (resize handles visible on `.resize-panel`) | 🟡 `.hiprint-element--selected` | `ElementWrapper.vue:168` | 🟡 | BEM modifier on element wrapper. Visual: `outline: 1px dashed #409eff; outline-offset: -1px`. V1 instead drew separate resize handles via interact.js — V3 also uses interact.js but visual indicator is just an outline. |
| `.resizeing` (sic) | bundle.js:8119 | Dragging state (cursor: move) | ⚠️ interact.js inline cursor | n/a | ⚠️ | V3 sets cursor via interact.js modifiers, not via class. Default cursor on `.hiprint-element` is `move` (ElementWrapper.vue:165). |
| `.multipleSelect` | bundle.js:1657 | Multi-select indicator | 🟡 `.hiprint-element--selected` (same class for single + multi) | ElementWrapper.vue:168 | 🟡 | V3 doesn't distinguish single vs multi visually — both use `.hiprint-element--selected`. Multi-select hint shown in `HiprintPropertyPanel.vue:667` via banner. |
| `.toplineOfPosition`, `.bottomlineOfPosition`, `.leftlineOfPosition`, `.rightlineOfPosition` | bundle.js | Per-side position reference lines | 🔴 not implemented | n/a | 🔴 | Drag-time position references — same as `.horLine` / `.verLine`. |
| (extra V3) `.hiprint-dragging` | n/a | Active drag class (added by drag-drop.ts) | n/a | `interactions/drag-drop.ts:277-309` | V3-new | Toggled on element during drag. Used by element list (`.hiprint-element-list-item:global(.hiprint-dragging)`) for grabbing cursor. |
| (extra V3) `.hiprint-drag-clone` | n/a | Drag clone wrapper | n/a | `interactions/drag-drop.ts:282` | V3-new | |
| (extra V3) `.hiprint-list-source` | n/a | Marker for draggable sidebar items | n/a | `interactions/drag-drop.ts:256` | V3-new | |
| (extra V3) `.hiprint-element` | n/a | Designer-only element wrapper class | n/a | `ElementWrapper.vue:163` | V3-new | Distinct from print-time `.hiprint-printElement`. |

---

## Section Q — Resize & Lock Controls (5 classes)

| V1 class | V1 source | V1 styles | V3 equivalent | File:line | Status | Notes |
|---|---|---|---|---|---|---|
| `.resize-panel` | print-lock.css:84, hiprint.css | Handle container (jQuery-created) | 🔴 not present | n/a | 🔴 | V1 wrapped selected elements in a `.resize-panel` div with corner/edge handles inside. V3 uses interact.js with the element root itself as the resize target — no separate panel div. |
| `.resize-panel .size-box` | hiprint.css | Size label (bg rgba(64,158,255,0.9); white; padding 0 6px) | 🔴 not present | n/a | 🔴 | Size readout during resize (e.g. "120 × 60") is not shown in V3. Property panel always shows numeric width/height. |
| `.resize-panel .del-btn` | hiprint.css | Delete button (position absolute; 16px; bg #f56c6c) | 🔴 not present | n/a | 🔴 | V1 floated a red delete button on top-right of selected element. V3 delete is via context menu / Delete key / toolbar. UX change. |
| `.size-locked` | bundle.js:923 | Size locked (jQuery adds) | ⚠️ store-driven | n/a | ⚠️ | V3 stores per-element lock flags in `element.options.sizeLocked`; interact.js honors via runtime check. No CSS class emitted. |
| `.position-locked` | bundle.js:926 | Position locked | ⚠️ store-driven | n/a | ⚠️ | Same pattern. |
| `.locked` | bundle.js:912 | General lock (on resize-panel) | ⚠️ store-driven | n/a | ⚠️ | Same pattern. |

---

## Section R — Grid & Layout Helpers (3 classes)

| V1 class | V1 source | V1 styles | V3 equivalent | File:line | Status | Notes |
|---|---|---|---|---|---|---|
| `.hi-grid-row` | hiprint.css | Grid row (`position: relative; display: block`) | 🔴 not present | n/a | 🔴 | V1 internal layout helpers. Not surfaced as a public API; safe to lose. |
| `.hi-grid-col` | hiprint.css | Grid column (`display: block; float: left`) | 🔴 not present | n/a | 🔴 | Same. |
| `.hiprint-gridColumnsFooter` | hiprint.css | Grid footer (text-align: left; clear: both) | 🔴 not present | n/a | 🔴 | Same. |

---

## Section S — Watermark / Misc (V3 extras with no V1 equivalent)

| V3 class | File:line | Purpose | Notes |
|---|---|---|---|
| `.hiprint-panel-header-marker` | `HiprintPanel.vue:181` | Dashed line at `paperHeader` offset (design-time only, hidden in readonly) | New: V1 used `.hideheaderLinetarget` instead. |
| `.hiprint-panel-footer-marker` | `HiprintPanel.vue:187` | Dashed line at `paperFooter` offset | New. |
| `.hiprint-printPanel--active` | `HiprintPanel.vue:170, 200` | Outline on active panel (1px solid #409eff) | New. |
| `.hiprint-printPanel--readonly` | `HiprintPanel.vue:170, 204` | Readonly variant (lighter shadow) | New. |
| `.hiprint-canvas` / `--readonly` / `--with-ruler` | `HiprintCanvas.vue:387-402` | Canvas root + variants | New. Wraps panel + rulers. |
| `.hiprint-preview` / `--iframe` / `__iframe` | `HiprintPreview.vue:133-150` | Preview component | New. Owns iframe-based preview. |
| `.hiprint-watermark` | `print/render.ts:732` | Watermark layer | Class preserved (was used inline in V1). ✅ |

---

## Section T — Z-Index Hierarchy Parity

| V1 Z-Index | V1 Element | V3 equivalent | Status | Notes |
|---|---|---|---|---|
| 1 | Table handle | n/a | 🔴 | No table handle in V3 designer. |
| 9 | Position labels (`.topPosition`, `.leftPosition`) | n/a | 🔴 | Position labels not implemented. |
| 10 | Delete button (`.resize-panel .del-btn`) | n/a | 🔴 | Delete button not implemented. |
| 100 | Edge toggle (`.hiprint-designer-edge-toggle`) | n/a | 🔴 | Edge toggle not implemented. |
| 500 | Guide layer (`.hiprint-guide-layer`) | n/a | 🔴 | Guide layer not implemented. |
| 999 | Element list toggle / Modal backdrop | ⚠️ ant-design-vue mask | ⚠️ | Now stacked by ant-design-vue (default ~1000). |
| 1000 | Context menu | implicit (floating-ui placement) | 🟡 | V3 mounts context menu on `document.body` portal — natural document order. floating-ui sets `position: absolute`, no explicit z-index. May be **below** ant-design-vue modal if open at same time (V1 had context menu z=10000 > 1000 backdrop). Verify with manual QA. |
| 1000 | Template dialog | ⚠️ ant-design-vue AModal default zIndex (1000) | ⚠️ | Parity ~maintained via ant defaults. |
| 1000 | Popover (`.hiprint-toolbar-popover`) | 🟡 `.hiprint-custom-paper-popover { z-index: 1000 }` | 🟡 | Explicit z-index 1000 preserved in scoped style. |
| 10000 | Context menu root | n/a | 🔴 | V3 context menu does not set z=10000. **Risk**: V1 gave context menu the absolute highest layer; V3 may render under any element-with-z. Mitigate by adding explicit z-index on `.hiprint-context-menu`. |

**Z-index summary**: V3 has lost most of V1's explicit z-index hierarchy. Remaining values are 1000 (custom paper popover) and ant-design-vue defaults. **Concrete regression risk**: simultaneous context-menu + custom popover + ant modal could overlap unpredictably.

---

## Section U — Color Palette Parity

| V1 color | V1 usage | V3 color | V3 usage | Status |
|---|---|---|---|---|
| `#2196f3` (Material blue) | Active state, primary, selected items, guide lines | `#409eff` (Element Plus / blue) + `#1677ff` (Ant Design blue) | `.hiprint-element--selected` outline, `:focus-visible`, primary chip bg, `.is-active` text | 🟡 |
| `#f56c6c` (Element Plus red) | Delete, errors, lock | not used in V3 styles | n/a | 🔴 |
| `#e8e8e8` (header gray) | Table headers | `#e8e8e8` | `--hiprint-designer-canvas-bg` default | ✅ name; different role |
| `#ddd`, `#e0e0e0` (border gray) | Borders | `#d9d9d9` (ant), `#e5e5e5` | Borders, dividers | 🟡 (slight drift) |
| `#f5f5f5`, `#f9f9f9`, `#fafbfc` (hover gray) | Hover states | `#f5f5f5`, `#fafafa`, `#f0f0f0` | Background, hover | ✅ |
| `#999`, `#bdc3c7` (secondary text gray) | Disabled, secondary | `#999`, `#666`, `#555` | Labels, secondary text | 🟡 (more shades) |
| `#606a78`, `#795548` (shape default colors) | Default element colors | not enforced in V3 styles | inline from element data | n/a |
| `rgba(64,158,255,0.9)` (Element Plus blue + alpha) | Table handle, size label | not used in V3 styles | n/a | 🔴 |
| `#e3f2fd` (light blue bg) | Selected list row, column dragging | `#e6f4ff` (Ant Design light blue) | `.is-active` bg, hint banner, hover | 🟡 |
| `rgb(241,110,110)` (drag line red) | `.horLine`, `.verLine` | not used | n/a | 🔴 |

**Palette summary**: V3 has migrated from **Element Plus / Material Design** colors (`#2196f3`, `#409eff`, `#f56c6c`, `#e8e8e8`) to a mix of **Ant Design** (`#1677ff`, `#e6f4ff`, `#d9d9d9`, `#fafafa`) + **Element Plus blue** (`#409eff` retained for selection outline). Business overrides keyed to specific V1 hexes will break visually.

---

## Section V — CSS Variables Introduced in V3

| Variable | Default | Defined in | Purpose |
|---|---|---|---|
| `--hiprint-designer-bg` | `#f5f5f5` | `HiprintDesigner.vue:536` | Designer root background |
| `--hiprint-designer-fg` | `#222` | `HiprintDesigner.vue:537` | Designer root text color |
| `--hiprint-designer-divider` | `#ddd` | `HiprintDesigner.vue:543, 555, 567` | Sidebar borders |
| `--hiprint-designer-canvas-bg` | `#e8e8e8` | `HiprintDesigner.vue:562` | Center canvas background |
| `--hiprint-designer-preview-bg` | `#fafafa` | `HiprintDesigner.vue:574` | Preview mode background |

V1 had **zero** CSS variables. V3's introduction is **partial**: variables are only defined in `HiprintDesigner.vue` and only for the 5 layout colors. Toolbar, property panel, element list, dialogs all still hard-code colors (`#fafafa`, `#fff`, `#333`, `#1677ff`, `#409eff`). A consistent design-token system is **not yet** in place — partial regression for theming.

---

## Section W — `@media print` and `@page` Rules

| V1 rule | V1 source | V3 status | Notes |
|---|---|---|---|
| `@media print { body { margin: 0; padding: 0; } }` | print-lock.css | 🟡 caller-supplied | V3 does not bundle print-lock.css. `browser-print.ts` accepts `stylesheetHref` / `styleText` options — caller injects. |
| `@page { margin: 0; }` | print-lock.css | 🟡 caller-supplied | Same. |
| `.hiprint-printPaper { page-break-after: always; }` | print-lock.css | 🟡 caller-supplied | Same; class still emitted by `render.ts`. |
| `.hiprint-printPanel:last-child { page-break-after: avoid; }` | print-lock.css | 🟡 caller-supplied | Same. |
| `@-moz-document url-prefix() { /* Firefox fix */ }` | print-lock.css | 🟡 caller-supplied | Same. |

V3 architectural decision documented in `print/browser-print.ts:29-37`: "print-lock.css. Defaults to none — caller-owned." This is a **deliberate design** to keep V3 framework-thin; callers (e.g. `vue-admin-main`) must continue passing print-lock.css explicitly (as they did in V1 via XHR). Output DOM still has compatible class names so the V1 CSS file works unchanged.

---

## Section X — V3-Only Selectors (new in V3, no V1 counterpart)

These are introduced by V3 SFCs / interactions. Documented for forward compatibility.

| V3 class | File:line | Role |
|---|---|---|
| `.hiprint-designer` / `__toolbar` / `__main` / `__element-list` / `__canvas` / `__property-panel` / `__preview` / `--preview` | HiprintDesigner.vue:530-580 | Designer BEM layout |
| `.hiprint-canvas` / `__empty` / `__ruler` / `--top` / `--left` / `--with-ruler` / `--readonly` | HiprintCanvas.vue:387-430 | Canvas |
| `.hiprint-printPanel--active` / `--readonly` | HiprintPanel.vue:200,204 | Panel state |
| `.hiprint-panel-header-marker` / `.hiprint-panel-footer-marker` | HiprintPanel.vue:181,187 | Header/footer guides |
| `.hiprint-element` / `--selected` | ElementWrapper.vue:163,168 | Designer element wrapper |
| `.hiprint-text-inline-edit` | TextElement.vue:160 | Inline text editor |
| `.hiprint-cell-editor` / `.hiprint-cell-select` | TableInlineEditor.vue:160 | Inline cell editor |
| `.hiprint-toolbar-sep` / `-paper` / `-panel-manager` / `-panel-chips` / `-chip` / `-pagination` / `-label` / `-select` | HiprintToolbar.vue:1323-1402 | Toolbar parts |
| `.hiprint-element-list` / `-empty` / `-module` / `-module-title` / `-group` / `-group-title` / `-empty-tip` / `-item` / `-icon` / `-label` | HiprintElementList.vue:298-394 | Element list |
| `.hiprint-property-panel` / `-empty` / `-multi-hint` / `-header` / `-type` / `-id` / `-fieldset` / `-grid-2` / `-row` / `-toggle` | HiprintPropertyPanel.vue:646-787 | Property panel |
| `.hiprint-paper-property-panel`, `.hiprint-table-property-panel`, `.hiprint-image-property-panel`, `.hiprint-barcode-property-panel`, `.hiprint-qrcode-property-panel`, `.hiprint-shape-property-panel`, `.hiprint-html-property-panel` | property/*.vue | Per-element property panels |
| `.hiprint-table-col-section` / `.hiprint-table-col-row` | TablePropertyPanel.vue:422-441 | Table column manager |
| `.hiprint-preview` / `__iframe` / `--iframe` | HiprintPreview.vue:133-150 | Preview |
| `.hiprint-save-dialog__form` | SaveDialog.vue:233 | Save dialog |
| `.hiprint-template-dialog__body` / `__header` / `__empty` / `__no-thumb` | TemplateDialog.vue:224-250 | Template dialog |
| `.hiprint-business-dialog__body` / `__header` / `__empty` / `__group` / `__group-title` | BusinessDialog.vue:226-255 | Business dialog |
| `.hiprint-custom-paper-popover` / `.actions` / `.primary` | CustomPaperPopover.vue:104-172 | Custom paper popover |
| `.hiprint-context-menu` / `-portal` / `-item` / `-divider` / `-icon` / `-label` / `-shortcut` / `.is-disabled` | interactions/context-menu.ts:214-274 | Context menu |
| `.hiprint-dragging` / `.hiprint-drag-clone` / `.hiprint-list-source` | interactions/drag-drop.ts:256-309 | Drag state |

---

## Section Y — Scorecard Summary

### Class status counts (across all 231 V1 classes)

| Status | Count | Notes |
|---|---|---|
| ✅ Preserved (same name) | 33 | Almost all are print-time wrapper classes emitted by `render.ts` (so `print-lock.css` continues to apply unchanged). |
| 🟡 Renamed / restyled equivalent | 31 | Designer chrome rewritten to BEM (`__`, `--` modifiers) and `.active` → `.is-active`. Caller CSS overrides break. |
| ⚠️ Replaced by different mechanism | 18 | Mostly state-toggle classes replaced by Vue reactive bindings / store flags / inline styles. Selector parity lost; behavioral parity retained. |
| 🔴 Missing in V3 | 36 | Drag reference lines, guide layer, ruler handles, paper-number badge, resize-panel + size-box + del-btn, element list toggle, type-color tags, designer edge-toggle / resize-bar, primary/danger toolbar button variants, lock toggle in property panel. |
| V3-new (no V1 counterpart) | ~60 | BEM modifiers, inline editors, dialog sub-parts, context menu portal/sub-parts, marker guides. |
| **Total status rows in matrix** | **~190** | (Above counts include extras and dynamic-class rows. Pure V1 ↔ V3 mapping ≈ 118 — some V1 classes are grouped under per-type generators handled by `render.ts:201-203` `.hiprint-printElement-<type>`.) |

### Classes preserved at print time (caller-CSS-safe)

All wrapper classes that `print/render.ts` emits are preserved verbatim:
- `.hiprint-printTemplate` ✅
- `.hiprint-printPanel` ✅
- `.hiprint-printPaper` ✅
- `.hiprint-printElement` ✅
- `.hiprint-printElement-<type>` (text, longText, image, barcode, qrcode, html, table, vline, hline, rect, oval) ✅
- `.hiprint-printElement-<type>-content` (text, image, longText, barcode, qrcode, html, table, shapes) ✅
- `.hiprint-printElement-qrcode-content-title` ✅
- `.hiprint-printElement-tableTarget` + 11 border variants ✅
- `.hiprint-watermark` ✅

→ **`print-lock.css` continues to apply to V3 print output without modification**. This is the single most important architectural choice for caller-compatibility.

### Classes lost at design time (caller-CSS-broken)

Caller business CSS that targets V1 designer classes will break on V3:
- All `.hiprint-designer-*` (renamed to `.hiprint-designer__*`)
- All `.hiprint-el-list-*` (renamed to `.hiprint-element-list-*`)
- All `.hiprint-setting-panel` + `.hiprint-option-*` (renamed)
- All `.hiprint-ctx-menu*` (renamed to `.hiprint-context-menu*`)
- All `.hiprint-ruler-*` (replaced by SVG)
- All `.hiprint-guide-*` (not implemented)
- All `.hiprint-pagination*` (moved into toolbar BEM)
- All `.hiprint-toolbar-template-*` (replaced by ant-design-vue AModal)
- `.selected`, `.editing`, `.locked`, `.alwaysHide`, `.multipleSelect`, etc. (state classes — replaced by Vue reactive binding)
- `.resize-panel` + `.size-box` + `.del-btn` (resize chrome — not implemented)

### Missing features (UX regressions vs V1)

| Feature | V1 class | Impact |
|---|---|---|
| Persistent guide rails (drag-to-add alignment lines) | `.hiprint-guide-layer` / `.hiprint-guide-line` | Designers lose visual alignment helpers |
| Position labels during drag | `.topPosition` / `.leftPosition` / `.horLine` / `.verLine` | Less precise visual feedback |
| Ruler drag handles for header/footer cuts | `.hiprint-ruler-handle` | Must use property panel inputs |
| Element list selected-row highlight | `.selected-el` | List is palette-only in V3 |
| Per-type color tags in element list | `.tag-text`, `.tag-image`, etc. | List is monochrome |
| Element list toggle button | `.hiprint-el-list-toggle` | List is always visible |
| Designer edge toggle / sidebar collapse | `.hiprint-designer-edge-toggle` | Sidebars fixed-width |
| Designer panel resize bars | `.hiprint-designer-resize-bar` | Sidebars not user-resizable |
| Floating size readout during resize | `.resize-panel .size-box` | Use property panel numeric inputs |
| Floating delete button on selected element | `.resize-panel .del-btn` | Use context menu / Delete key |
| Property-panel per-field delete | `.hiprint-option-item-deleteBtn` | n/a |
| Property-panel per-field lock toggle | `.hiprint-option-item-lockToggleBtn` | n/a |
| Page number badge on paper | `.hiprint-paperNumber` | Multi-panel prints lose page indicator |
| Toolbar primary/danger button variants | `.hiprint-toolbar-btn-primary` / `-danger` | Custom styling needed |
| Table column drag-reorder | `.hiprint-column-dragging` | Use ↑↓ buttons (if present) or add/remove |
| Table designer drag-handle square | `.hiprint-printElement-table-handle` | interact.js edges handle resize |

---

## Section Z1 — Dynamic Class Operations Parity (V1 jQuery `addClass` ↔ V3)

V1 had 140+ `addClass` / `removeClass` / `toggleClass` operations. The most impactful ones:

| V1 trigger | V1 op | V1 class | V1 line | V3 mechanism | V3 file:line | Status |
|---|---|---|---|---|---|---|
| Double-click text element | addClass | `editing` | bundle.js:764 | Vue v-if conditional render of `<input>` overlay (`isEditing` ref) | TextElement.vue (inline editor) | ⚠️ mechanism swap |
| Click element | addClass | `selected` | bundle.js:831 | Vue `:class` bound to `canvas.selectedIds.includes(el.id)` | ElementWrapper.vue:168 (`.hiprint-element--selected`) | 🟡 renamed |
| Lock toggle | addClass | `locked` | bundle.js:912 | Store flag `element.options.locked` (no class emitted) | stores/canvas | ⚠️ store-driven |
| Size lock | addClass | `size-locked` | bundle.js:923 | Store flag `element.options.sizeLocked` | stores/canvas | ⚠️ store-driven |
| Position lock | addClass | `position-locked` | bundle.js:926 | Store flag `element.options.positionLocked` | stores/canvas | ⚠️ store-driven |
| Ctrl+click | addClass | `multipleSelect` | bundle.js:1657 | Same `:class` as single (`canvas.selectedIds.length > 1`) — banner appears in property panel instead | HiprintPropertyPanel.vue:667 (`.hiprint-property-multi-hint`) | 🟡 different surface |
| Element marked hidden | addClass | `alwaysHide` | bundle.js:4180 | Element omitted from `printElements` array; no class | n/a | ⚠️ data-driven |
| Vertical-align: middle | addClass | `hiprint-text-content-middle` | bundle.js:4817 | Inline `style.alignItems = 'center'` in print emitter | render.ts text path | ⚠️ inline |
| Text wrap mode | addClass | `hiprint-text-content-wrap-*` | bundle.js:4844 | Inline `style.whiteSpace` / `overflow` / `textOverflow` | render.ts | ⚠️ inline |
| Column dragging | addClass | `hiprint-column-dragging` | bundle.js:4944 | (not implemented; column reorder not in V3 yet) | n/a | 🔴 |
| Designer init | addClass | `design` (on paper) | bundle.js:9402 | No modifier class — design vs print are different emit paths | n/a | ⚠️ |
| Grid enabled | addClass | `grid` (on paper) | bundle.js:9711 | Inline `backgroundImage` linear-gradient driven by `canvas.gridVisible` | HiprintPanel.vue:88-94 | ⚠️ inline |
| Header toggle | toggleClass | `hideheaderLinetarget` | bundle.js:10850 | (long-text auto-pagination not ported; class unreachable) | n/a | 🔴 |
| Footer toggle | toggleClass | `hidefooterLinetarget` | bundle.js:10867 | (same as above) | n/a | 🔴 |
| Panel show | addClass | `visible` | bundle.js:11832 | Template-level `v-if` driven by prop | HiprintDesigner.vue | ⚠️ |
| List selected | addClass | `selected-el` | bundle.js:11856 | (V3 list is palette only; no canvas-selection sync) | n/a | 🔴 |
| Button toggle | addClass | `active` | bundle.js:14248 | `:class="{ 'is-active': isActive }"` | HiprintToolbar.vue (chip + btn) | 🟡 renamed `.active` → `.is-active` |
| Drag start | (interact.js) | n/a in V1 | n/a | `el.classList.add('hiprint-dragging')` | interactions/drag-drop.ts:277 | V3-new |
| Drag end | (interact.js) | n/a | n/a | `el.classList.remove('hiprint-dragging')` | interactions/drag-drop.ts:309 | V3-new |

**Pattern summary**: V3 has split V1's monolithic class-toggle model into three layers:
1. **Store-driven** (Pinia reactive flags) — used for lock states, hidden states, selection.
2. **Inline-styled** (computed CSS in `<script setup>` returning style objects) — used for grid, transform, header/footer markers.
3. **Class-modifier** (BEM `--` modifier) — used for designer state (active panel, readonly).
4. **External class on body-mounted portals** — context menu, drag clone.

V1's "everything goes through a class" approach is gone. Caller CSS keyed to state classes (`.selected`, `.editing`, `.locked`) on the element root will not fire in V3.

---

## Section Z2 — Selector specificity surprises in V3

These are non-obvious behaviors a caller migrating from V1 may hit:

1. **`<style scoped>` data-attribute hashing**: Vue 3 SFC scoped styles add a `data-v-<hash>` attribute on the root element of the component. Selectors inside the SFC are rewritten to include `[data-v-<hash>]`. **Implication**: if a caller's global CSS targets a class that V3 also styles inside `<style scoped>`, the **global CSS still wins on specificity** because scoped selectors and global selectors have the same specificity (class = 1-0-0), and global selectors come last in cascade order if the SFC `<style scoped>` is imported first. This is the default and is good for caller overrides. The exception is `:focus-visible` outlines which use color hex values — those will compete by source order, not specificity.

2. **`:global()` escape hatch**: V3 element list uses `.hiprint-element-list-item:global(.hiprint-dragging)` at `HiprintElementList.vue:381`. The `:global()` strips the scoped attribute from `.hiprint-dragging` because that class is added by `interactions/drag-drop.ts` (outside the SFC). Without `:global()`, the rule would not match. Caller CSS adding more `.hiprint-dragging`-keyed styling works as expected (regular global class).

3. **Inline `style` attribute beats scoped CSS**: Many V3 components compute styles in `<script setup>` and bind via `:style`. These inline styles have specificity 1-0-0-0 (inline = max) and override any caller CSS keyed to the same property — caller cannot easily override paper background, watermark color, etc. without `!important`.

4. **Print-time output bypasses Vue scoped CSS entirely**: `print/render.ts` builds detached DOM with `document.createElement` — no `data-v-<hash>` attribute. Caller's `print-lock.css` applies normally to the printed iframe document. **This is the critical compatibility bridge.**

5. **Ant Design Vue dialog scoping**: `AModal` mounts on `document.body`. Scoped styles from `TemplateDialog.vue` / `SaveDialog.vue` reach the dialog body content via teleport, but caller CSS targeting ant internals (e.g. `.ant-modal-mask`) is unaffected.

---

## Section Z3 — Cross-reference per V1-inventory section

Quick navigation back to V1 inventory sections:

| V1 inventory section | Class count | This matrix section | Net status |
|---|---|---|---|
| 1.1 Paper & Page Layout | 11 | A | 5 ✅, 1 ⚠️, 1 🟡 (paper), 4 🔴 (paperNumber, hide*line targets, paper-content) |
| 1.2 Text Elements | 8 | B | 4 ✅, 4 ⚠️ |
| 1.3 Table Elements | 11 | C | 10 ✅, 1 🔴 (table-handle) |
| 1.4 Shape Elements | 4 | D | 4 ✅ |
| 1.5 Other Element Types | 4 | E | 4 ✅ |
| 1.6 Designer Chrome | 7 | F | 1 ✅, 4 🟡, 2 🔴 (resize-bar, edge-toggle) |
| 1.7 Toolbar | 8 | G | 2 ✅, 4 🟡, 2 🔴 (btn-primary, btn-danger) |
| 1.8 Element List | 11+ | H | 1 🟡 (renamed), 1 🟡 (renamed), 1 ⚠️ (visible), 2 🔴 (selected-el, hidden-el), 8 🔴 (tag-* colors) |
| 1.9 Property Panel | 10 | I | 0 ✅, 6 🟡, 2 ⚠️ (label/field), 3 🔴 (deleteBtn, lockToggleBtn, column-dragging) |
| 1.10 Context Menu | 4 | J | 0 ✅, 4 🟡 (all renamed) |
| 1.11 Ruler | 5 | K | 0 ✅, 1 🟡 (track), 2 ⚠️ (mark/text → SVG), 1 🔴 (handle), 1 🔴 (wrapper) |
| 1.12 Guide Lines | 4 | L | 0 ✅, 4 🔴 (entire feature) |
| 1.13 Pagination | 3 | M | 0 ✅, 3 🟡 (moved to toolbar) |
| 1.14 Element Palette | 5 | N | 0 ✅, 4 🟡, 1 🔴 (ep-grid) |
| 1.15 Template & Save Dialogs | 6 | O | 0 ✅, 2 🟡, 4 ⚠️ (replaced by ant-design-vue) |
| 1.16 Dragging & Selection States | 11 | P | 1 🟡 (selected), 1 ⚠️ (resizeing), 8 🔴 (drag references, alwaysHide, position labels), 1 🟡 (editing) |
| 1.17 Resize & Lock Controls | 5 | Q | 0 ✅, 3 ⚠️ (lock state → store), 3 🔴 (resize-panel + size-box + del-btn) |
| 1.18 Grid & Layout Helpers | 3 | R | 0 ✅, 3 🔴 (internal helpers gone, low impact) |

**Aggregate:**
- ✅ preserved: ~33 (mostly print-time wrappers — `.hiprint-printPaper`, `.hiprint-printElement-<type>`, table border variants, watermark)
- 🟡 renamed equivalent: ~31 (BEM rewrite of designer chrome, context menu, pagination, dialog parts)
- ⚠️ replaced mechanism: ~18 (state classes → Vue reactive / store / inline)
- 🔴 missing: ~36 (entire guide-line system, paper-number, ruler handles, type-color tags, resize chrome, drag reference lines)

---

## Section Z4 — Risk-ranked regression list

Sorted by likely caller impact (high → low):

| Risk | Item | Affected callers | Mitigation |
|---|---|---|---|
| 🔥 High | `.hiprint-paperNumber` not emitted → multi-panel prints lose page numbers | Any business printing multi-page receipts / invoices | Inject paperNumber div in custom panel renderer or wait for V3 port |
| 🔥 High | Context menu class renamed `.hiprint-ctx-menu` → `.hiprint-context-menu` | Anyone with custom context menu CSS | Search-replace `ctx-menu` → `context-menu` in business CSS |
| 🔥 High | Z-index 10000 lost on context menu | Apps that overlay context menu over modals | Add `z-index: 10000` to `.hiprint-context-menu` via global CSS |
| ⚠️ Medium | `.selected` / `.editing` / `.locked` state classes replaced | Apps with selection-themed CSS | Rebind to `.hiprint-element--selected` + Vue reactive class API |
| ⚠️ Medium | Element list type-color tags (`.tag-text`, etc.) removed | Apps relying on visual element typing in palette | Add caller CSS keyed to `data-tid` attribute |
| ⚠️ Medium | Designer sidebar resize / collapse not implemented | Apps where users resize sidebars | Implement custom Vue handle component on top of designer |
| ⚠️ Medium | Guide-line feature missing entirely | Power users doing precise alignment | Use snap-to-grid (interact.js modifier) or wait for V3 port |
| 🟡 Low | Ruler is SVG now → can't style individual ticks | Custom ruler themes | Style via SVG attribute selectors |
| 🟡 Low | Color palette drift Material → Ant Design | Apps with exact-hex CSS | Update to V3 tokens (`#1677ff` Ant primary, `#409eff` focus, `#e6f4ff` light blue) |
| 🟡 Low | `.hi-grid-row` / `.hi-grid-col` / `.hiprint-gridColumnsFooter` gone | Internal helpers, unused externally | None needed |

---

## Section Z — Migration Recommendations for Callers

1. **Print-time CSS:** Continue using V1 `print-lock.css` unchanged. Pass via `BrowserPrintOptions.stylesheetHref` or `styleText`.
2. **Designer theming:** Migrate from class overrides to CSS variables on `.hiprint-designer` root (`--hiprint-designer-bg`, etc.). Note: only 5 vars defined today.
3. **Class renames to update:** `ctx-menu` → `context-menu`, `el-list` → `element-list`, `setting-panel` → `property-panel`, `.active` → `.is-active`, `hiprint-toolbar-template-*` → ant-design-vue or `.hiprint-template-dialog__*`.
4. **Z-index regressions:** Add explicit `z-index: 10000` to `.hiprint-context-menu` if running alongside ant-design-vue modals.
5. **Missing UX:** Filed under interactions parity matrix (`06-interactions.md`) — guide rails, position labels, ruler handles, designer edge-toggle.
6. **Color palette:** Audit any business CSS keyed to `#2196f3`, `#f56c6c`, `rgba(64,158,255,0.9)`, `#e3f2fd`, `rgb(241,110,110)` — V3 has migrated to Ant Design palette.
7. **CSS variables consistency:** When V3 design tokens land system-wide (P-future), expect breakage of any direct hex overrides; track in CHANGELOG.

---

## Appendix — Verification commands run

```bash
# V1 source line counts
wc -l src/hiprint/css/hiprint.css       # 2626
wc -l src/hiprint/css/print-lock.css    # 360
grep -c "^\." src/hiprint/css/print-lock.css  # 55 class selectors

# V3 style block locations (21 Vue components with <style scoped>)
grep -rn "<style scoped>" src/hiprint-v3/components/   # 21 hits

# V3 print-time class emission (verbatim V1 names preserved)
grep -n "classList.add" src/hiprint-v3/print/render.ts   # 16 hits, all hiprint-print*

# V3 has zero global stylesheet
find src/hiprint-v3 -name "*.css"   # (no matches)
```

---

**Authoritative source:** This document is generated from V1 inventory + V3 source as of 2026-05-11. Update when V3 SFCs change scoped classes or when `print/render.ts` emits new wrapper classes.
