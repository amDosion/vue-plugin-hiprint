# V3 Parity Matrix — `text` and `longText` etypes

> **Companion to**: `docs/V1-INVENTORY/etypes/text-longtext.md` (1119 lines, 561 citations).
>
> **Scope**: Every option key, every interaction, every render path, every quirk listed in the V1 inventory is graded against the V3 implementation. The V1 inventory is the source of truth; this document does NOT restate behavior, only references it by section letter + row number (e.g. `B.7`, `J.3`).
>
> **V3 sources reviewed**:
> - `src/hiprint-v3/components/elements/TextElement.vue` (171 lines)
> - `src/hiprint-v3/components/elements/LongTextElement.vue` (93 lines)
> - `src/hiprint-v3/components/elements/ElementWrapper.vue` (172 lines)
> - `src/hiprint-v3/components/elements/_helpers.ts` (193 lines)
> - `src/hiprint-v3/components/HiprintPropertyPanel.vue` (787 lines, **generic fallback** for text/longText)
> - `src/hiprint-v3/core/etypes/text.ts` (87 lines)
> - `src/hiprint-v3/core/etypes/long-text.ts` (73 lines)
> - `src/hiprint-v3/core/default-provider.ts` (412 lines)
> - `src/hiprint-v3/print/render.ts` (797 lines — `renderTextElement` + `renderLongTextElement`)
> - `src/hiprint-v3/schemas/element.ts` + `src/hiprint-v3/schemas/style.ts`
> - `src/hiprint-v3/internal/dom-helpers.ts` (`resolveField`, `safeNumber`, `coerceText`)
>
> **CRITICAL GAP**: V3 has NO `TextPropertyPanel.vue` and NO `LongTextPropertyPanel.vue` SFCs. The dispatcher at `HiprintPropertyPanel.vue:55-67` lists `image / barcode / qrcode / hline / vline / rect / oval / html / table / tableCustom` but **explicitly excludes** `text` and `longText`. Both etypes fall through to the generic editor (`HiprintPropertyPanel.vue:332-641`). The generic editor exposes ~12 fields (Position / Font / Border / Background / Alignment / Rotate / Binding / Lock) versus V1's 57+44 options — see Section D below for per-field scoring.

---

## Legend

| Marker | Meaning |
|---|---|
| ✅ DONE | V3 fully replicates the V1 behavior (including known quirks where they are still desired) |
| 🟡 PARTIAL | V3 partially implements; key sub-behaviors or quirks missing |
| 🔴 MISSING | V3 has no corresponding code path |
| ⚠️ VIOLATION | V3 diverges in a way that breaks V1 semantics (incompatible) |
| ⏸️ DEFERRED | V3 explicitly defers (block comments / TODOs / superseded by P-phase plan) |

**Fix effort scale** (rough order-of-magnitude line budget per row):
- `S` (small) — < 50 lines, single-file
- `M` (medium) — 50–200 lines, single feature
- `L` (large) — 200–800 lines, new SFC or pipeline
- `XL` — > 800 lines, new subsystem (e.g. pagination engine)

---

# PART 1 — `text` etype

## Section A — Class hierarchy

V1: `D` (TextPrintElement) extends `BasePrintElement`; `O` (TextPrintElementOption) extends `g.a`. Two-layer class hierarchy with options-class sanitization at construction (V1 9966-9968: `replaceEnterAndNewlineAndTab(n.title, "")`).

| V1 ref | V1 behavior | V3 status | V3 file:line | Diff notes | Fix |
|---|---|---|---|---|---|
| A.1 (class) | Runtime element class `D` extends `BasePrintElement` | 🟡 PARTIAL | `core/element-base.ts` + `core/etypes/text.ts:51-65` | V3 uses a factory `createTextElement()` returning `BaseElement` (pure data) — no class hierarchy. Rendering is split into the SFC + `print/render.ts`. This is intentional (Vue 3 architecture) but means behavior previously colocated in `D.prototype.*` is now scattered across `_helpers.ts`, `TextElement.vue`, and `render.ts`. | M (already-by-design split) |
| A.1 (options class) | `O` options class extends `g.a`; provides `getTitle/getTextType/getFontSize/getbarcodeMode/getBarTextMode/getBarWidth/getBarAutoWidth/getQRcodeLevel/getHideTitle` fallback getters | 🔴 MISSING | n/a | NO equivalent getter chain. V3 reads options directly from `el.options` in render.ts and \_helpers.ts. All V1 fallback defaults (`fontSize → 9`, `barcodeMode → CODE128`, `barWidth → 1`, `barAutoWidth → true`, `barTextMode → text`, `qrCodeLevel → 0`, `textType → text`) are **not centralized**. Some fallbacks exist scattered (e.g. `render.ts:340-342` for lineHeight, 350 for barcodeType, 408 for qrCodeLevel) but inconsistent. Templates that omit these fields will render with wrong defaults. | M |
| A.2 (ctor — title sanitization) | `O` ctor strips `\r\n\t` from title via `x.replaceEnterAndNewlineAndTab(n.title, "")` (V1 9968) | 🔴 MISSING | n/a | V3 stores title verbatim. Templates with multi-line titles will render unintended line breaks in the title prefix. Search confirmed: `replaceEnterAndNewlineAndTab` not present in `hiprint-v3` source. | S |
| A.2 (ctor — setDefault) | `setDefault(p.a.instance.text.default)` merges `width=120, height=9.75` if unset (V1 9962-9963) | 🟡 PARTIAL | `core/etypes/text.ts:20-26` | V3 `TEXT_DEFAULT_OPTIONS` has `width=100, height=12, fontSize=9.75, textAlign='left', textContentVerticalAlign='top'`. **Diverges from V1**: width 100 vs 120, height 12 vs 9.75. Adds fontSize/textAlign/textContentVerticalAlign that V1 does NOT preset (V1 leaves them undefined → falls through to `getFontSize()` → 9). | S (align values with V1) |

---

## Section B — `text` options table (57 fields)

> Status grading interpretation: Since text uses the generic property panel, "DONE" means render + property-panel edit + persistence all work. "PARTIAL" means render works but no panel UI. "MISSING" means neither.

### B.1 – B.16 (Basic + Data Type)

| V1 ref | V1 option | V3 render | V3 panel UI | V3 persistence | Diff notes | Fix |
|---|---|---|---|---|---|---|
| B.1 | `title` (with `\r\n\t` strip) | 🟡 PARTIAL — rendered by `_helpers.ts:188 coerceText(opts.title)` then prefix at `_helpers.ts:192` | ✅ — `HiprintPropertyPanel.vue:594-600` (Binding fieldset, Title input with blur/Enter commit) | ✅ — schema `dataStyleSchema:168` | **Quirk J.1/J.2 lost**: V3 does NOT strip `\r\n\t` from title at any point. Vue `{{ }}` renders newlines as visible whitespace. Inline-edit path (TextElement.vue:108-120) writes raw `draftValue` back without sanitization. | S |
| B.2 | `field` (dot-path with nullish-safe reduce) | ✅ DONE — `_helpers.ts:167-170` calls `resolveField` which uses strict `a != null` check (`internal/dom-helpers.ts:75-79`); preserves 0/false/'' (PM-002 R3 fix carried over) | ✅ — `HiprintPropertyPanel.vue:609-617` (Field input) | ✅ — schema `dataStyleSchema:170` | One notable diff: V1 returns "" when field set but no data passed AT THE GETDATA LEVEL (V1 10037). V3 `getElementValue` (`_helpers.ts:158-173`) returns `opts.testData` when resolved is `undefined` — but V1 only falls back to testData when `t` (templateData) is itself falsy. **Slight semantic drift**: V3 always considers testData when field misses; V1 returns "" for missed lookup, testData only without templateData. | M |
| B.3 | `testData` | ✅ DONE — used as fallback in `_helpers.ts:171-172` | ✅ — `HiprintPropertyPanel.vue:619-626` (Test data input) | ✅ — schema `dataStyleSchema:172` | Inline-edit path in V3 (TextElement.vue:96-100) edits testData ONLY when `hideTitle` is true or title is not a string. V1 edit semantics: testData parsed via `t.split("：")[1]` after fullwidth-colon split (V1 798). V3 stores raw `draftValue`. **Quirk J.1 (fullwidth colon parse) MISSING.** | M |
| B.4 | `left` (pt) | ✅ DONE — `_helpers.ts:38-46` applies `left + 'pt'` with safeNumber clamp | ✅ — `HiprintPropertyPanel.vue:347-352` (X input) | ✅ | `displayLeft(applyTransform)` (V1 595-599) adds `getRectInfo().diffW` when transform set. V3 has no `displayLeft` equivalent — `left` always literal (does not account for rotated bounding box). | M |
| B.5 | `top` (pt) | ✅ DONE — `_helpers.ts:38-46` | ✅ — `HiprintPropertyPanel.vue:356-361` | ✅ | Same `displayTop` divergence as B.4. | M |
| B.6 | `width` (pt) | ✅ DONE — `_helpers.ts:38-46` | ✅ — `HiprintPropertyPanel.vue:364-370` | ✅ | `getWidth()` with transform returns rotated bounding-box width (V1 629-633). V3 has no such adjustment. | M |
| B.7 | `height` (pt) | ✅ DONE | ✅ — `HiprintPropertyPanel.vue:374-380` | ✅ | Same transform-aware diff as B.6. | M |
| B.8 | `positionLocked` | 🔴 MISSING — V3 does NOT read positionLocked anywhere in element components. `interactions/drag-drop.ts` does not check this option before enabling drag. | 🔴 MISSING — generic editor has only a generic `lock` checkbox (`HiprintPropertyPanel.vue:632-639`) writing `opts.lock`; **different option name** | 🟡 PARTIAL — schema `style.ts:142` declares it but unused | V3's `opts.lock` is a different invariant ("not selectable / not editable"). V1's `positionLocked` (V1 996-1027) disables drag, hides resize handles, disables coord inputs, adds 🔒 badge. **All of these behaviors absent.** | L |
| B.9 | `sizeLocked` | 🔴 MISSING — not read by `enableElementResize` | 🔴 MISSING — no UI | 🟡 PARTIAL — schema `style.ts:144` declares it | Same as B.8 — schema-only. | L |
| B.10 | `draggable` | 🔴 MISSING — `enableElementDrag` (`ElementWrapper.vue:101`) always enables drag regardless of opts.draggable | 🔴 MISSING | 🟡 PARTIAL — schema `style.ts:146` | V1 quirk: `draggable=false` does NOT hide delete button (V1 814, 1004); only positionLocked does. V3 lacks both. | M |
| B.11 | `coordinateSync` (UI-only X/Y mirroring) | n/a (UI only) | 🔴 MISSING — no 🔗/🔓 toggle in Position fieldset | 🔴 MISSING | V1 3617-3661 provides clickable sync icon. V3 generic editor has plain X/Y inputs. | S |
| B.12 | `widthHeightSync` (UI-only W/H mirroring) | n/a | 🔴 MISSING | 🔴 MISSING | Same as B.11. | S |
| B.13 | `hideTitle` ("true"/"false"/""→bool, three-way select) | ✅ DONE — `_helpers.ts:189 isTrue(opts.hideTitle)` coerces "true"/true | 🟡 PARTIAL — `HiprintPropertyPanel.vue:602-608` is a **boolean checkbox**, not the V1 three-way select (`默认/显示/隐藏`) | ✅ | V1 distinguishes `undefined` (use type default) vs `"true"`/`"false"`. V3 checkbox can only express `true`/`false` — undefined state is unreachable from the UI. | S |
| B.14 | `fixed` (true → bypass pagination, fixed position) | 🔴 MISSING — V3 render does not check `opts.fixed` (render.ts has no pagination at all yet) | 🔴 MISSING — no UI | 🟡 PARTIAL — not in schema | V1 1376, 9831 short-circuits multi-page render when fixed. V3 print pipeline does not implement multi-page header/footer separation. | L (depends on pagination) |
| B.15 | `dataType` (`""/"datetime"/"boolean"`) | 🔴 MISSING — `render.ts:218-244` and `_helpers.ts:158-193` do NOT branch on opts.dataType | 🔴 MISSING — no UI | 🔴 MISSING — not in schema | V1 10038-10043 routes through `o.a.dateFormat` for datetime and split-on-colon for boolean. **No equivalent in V3.** Date elements with `dataType:"datetime"+format:"yyyy-MM-dd"` will render the raw input value. | M |
| B.16 | `format` (datetime pattern or `"trueText:falseText"`) | 🔴 MISSING — see B.15 | 🔴 MISSING | 🔴 MISSING | Coupled with B.15. | M |

### B.17 – B.30 (Typography + Colors + Decoration + Borders)

| V1 ref | V1 option | V3 render | V3 panel UI | V3 persistence | Diff notes | Fix |
|---|---|---|---|---|---|---|
| B.17 | `fontFamily` (empty → `inherit`) | 🟡 PARTIAL — `_helpers.ts:68 if (typeof opts.fontFamily === 'string') style.fontFamily = opts.fontFamily` | ✅ — `HiprintPropertyPanel.vue:387-400` (Family select) | ✅ | **Quirk J.5 violation**: V1 explicitly sets `font-family: inherit` for empty value (V1 2489: "从父元素继承字体, 否则模板字体无效"). V3 sets only when truthy string. Empty string falls through → CSS default (not template-inherited). | S |
| B.18 | `fontSize` (number, fallback to 9 via `getFontSize`) | 🟡 PARTIAL — `_helpers.ts:69-71` uses fallback **10.5** | ✅ — `HiprintPropertyPanel.vue:404-411` (Size input, default 14) | ✅ | **Default mismatch**: V1 fallback 9, V3 helper fallback 10.5, V3 panel default 14. Three different numbers. | S |
| B.19 | `fontWeight` (string union including 100..900) | ✅ DONE — `_helpers.ts:72` | 🟡 PARTIAL — `HiprintPropertyPanel.vue:423-431` only toggles `bold` ↔ `normal` (button) — V1 has 13-value select with `lighter`/`bolder`/`100..900` | ✅ | Context-menu "字体加粗" sets `"bolder"` in V1 (J.8). V3 panel toggle writes `"bold"`. | S |
| B.20 | `letterSpacing` | ✅ DONE — `_helpers.ts:81-83` | 🔴 MISSING — no letter-spacing input in panel | ✅ | Renders, but no UI to edit. | S |
| B.21 | `color` (minicolors picker) | ✅ DONE — `_helpers.ts:77` | ✅ — `HiprintPropertyPanel.vue:414-420` (native `<input type="color">`) | ✅ | V1 uses `jquery.minicolors` with rgba/hex; V3 uses native HTML5 color picker (no alpha). V3-by-design (replace jQuery plugin). | n/a (intentional) |
| B.22 | `backgroundColor` | ✅ DONE — `_helpers.ts:79` | ✅ — `HiprintPropertyPanel.vue:493-498` (Background color) | ✅ | Same notes as B.21. | n/a |
| B.23 | `textDecoration` (`""`/`underline`/`overline`/`line-through`) | ✅ DONE — `_helpers.ts:74-76` | 🟡 PARTIAL — `HiprintPropertyPanel.vue:441-449` only toggles `underline` ↔ `none` (button) — V1 supports `overline` and `line-through` too | ✅ | Underline-only via UI. Other values writable via JSON only. | S |
| B.24 | `textAlign` (`left/center/right/justify` with `text-align-last` + `text-justify` for justify) | 🟡 PARTIAL — `_helpers.ts:90-94` sets `style.textAlign` only; **does not** set `text-align-last` or `text-justify` for `justify` | 🟡 PARTIAL — `HiprintPropertyPanel.vue:515-541` provides Left/Center/Right buttons; **`justify` missing** | ✅ | V1 2578 sets all 3 properties for justify. V3 only sets textAlign. Justify will not be applied to the last line. | S |
| B.25 | `textContentVerticalAlign` (`middle`/`bottom`, toggles CSS classes) | 🟡 PARTIAL — `_helpers.ts:96-105` uses `display:flex + alignItems` (a different mechanism). V1 uses CSS class toggle (`.hiprint-text-content-middle/-bottom`) | 🟡 PARTIAL — `HiprintPropertyPanel.vue:543-571` provides Top/Middle/Bottom buttons writing `opts.verticalAlign` — **WRONG OPTION KEY** (V1 uses `textContentVerticalAlign`, V3 writes `verticalAlign`) | ✅ (schema unaware) | **⚠️ VIOLATION**: Panel writes `verticalAlign`, _helpers reads `textContentVerticalAlign` (line 97). The two paths do not connect. Edits made in the panel will NOT appear in render. | ⚠️ S (rename) |
| B.26 | `textContentWrap` (`nowrap/clip/ellipsis`) | 🔴 MISSING — no class injection or CSS rule for these | 🔴 MISSING | 🔴 MISSING | V1 4837-4844 adds `.hiprint-text-content-wrap-<val>` to inner. V3 has no equivalent. | M |
| B.27 | `lineHeight` (pt) | ✅ DONE — `_helpers.ts:80` writes `style.lineHeight = String(opts.lineHeight)` (no `pt` suffix) | 🔴 MISSING — no panel UI | ✅ | **Diff**: V1 2454 `line-height: <val>pt`. V3 omits unit — browser interprets unitless `lineHeight` as a multiplier of font-size, not a pt value. Templates set with `lineHeight: 12` will render dramatically larger lines. | S |
| B.28 | `transform` (rotate deg) | 🟡 PARTIAL — `_helpers.ts:53-55` writes `style.transform = 'rotate(<n>deg)'` reading **`opts.rotate`** not `opts.transform` | 🟡 PARTIAL — `HiprintPropertyPanel.vue:577-587` (Rotate range) writes `opts.rotate` | ⚠️ schema mismatch | **⚠️ VIOLATION**: V3 reads/writes `rotate`; V1 reads/writes `transform`. Templates from V1 will not rotate. V1-roundtrip broken. | ⚠️ S (rename/alias) |
| B.29 | `zIndex` | ✅ DONE — `_helpers.ts:50-52` | 🔴 MISSING — no panel UI | ✅ | Right-click 置于顶层/底层/上下移一层 (V1 11488-11521) — see Section G; **MISSING in V3** | S (+ context-menu items) |
| B.30 | `borderTop` (style: `solid/dotted`) | ✅ DONE — `_helpers.ts:117` (`style.borderTop = opts.borderTop`) | 🔴 MISSING — no per-side border UI (only generic Style/Width/Color) | ✅ | V1 4521 sets `border-top-style` only. V3 sets `border-top` shorthand — different semantics: V3 with `borderTop: "solid"` produces `border-top: solid` (no width → invalid → no border rendered). | M |

### B.31 – B.42 (Borders cont. + Padding + Group)

| V1 ref | V1 option | V3 render | V3 panel UI | V3 persistence | Diff notes | Fix |
|---|---|---|---|---|---|---|
| B.31 | `borderLeft` | ✅ DONE — `_helpers.ts:120` | 🔴 MISSING | ✅ | Same shorthand issue as B.30. | M |
| B.32 | `borderRight` | ✅ DONE — `_helpers.ts:118` | 🔴 MISSING | ✅ | Same. | M |
| B.33 | `borderBottom` | ✅ DONE — `_helpers.ts:119` | 🔴 MISSING | ✅ | Same. Factory preset `signature.borderBottom="solid"` (V1 provider:407) — will render incorrectly without width. | M |
| B.34 | `borderWidth` (pt) | 🟡 PARTIAL — `_helpers.ts:114` writes only when `borderStyle` is also set; for V1 per-side borders, width applies via `.hiprint-printElement-content` rule (V1 2891) | ✅ — `HiprintPropertyPanel.vue:468-477` | ✅ | V1 applies width to inner content; V3 to wrapper. May produce overlap with content padding. | M |
| B.35 | `borderColor` | ✅ DONE — `_helpers.ts:115` (when borderStyle set) | ✅ — `HiprintPropertyPanel.vue:480-486` | ✅ | Only applied when borderStyle truthy; V1 always applies. | S |
| B.36 | `borderStyle` (4-way select for shape types; text shouldn't show this) | ✅ DONE — `_helpers.ts:112-116` | ✅ — `HiprintPropertyPanel.vue:456-465` (none/solid/dashed/dotted) | ✅ | V1 quirk J.6: text never shows this in UI; V3 shows it for all types. Not a violation since the option is harmless. | n/a |
| B.37 | `borderRadius` | 🔴 MISSING — _helpers.ts has no borderRadius | 🔴 MISSING — no UI | 🔴 MISSING | V1 4484. Image element does have it (render.ts:271-273) but text/longText not. | S |
| B.38 | `contentPaddingLeft` (pt) — applied to `.hiprint-printElement-content` | 🟡 PARTIAL — `_helpers.ts:133` reads `opts.paddingLeft` — **WRONG OPTION KEY** (V1: `contentPaddingLeft`) | 🔴 MISSING — only generic `padding` input | ⚠️ schema mismatch | V1 4621. **All four contentPadding* options are renamed in V3 to `paddingTop/Right/Bottom/Left`.** V1 templates will fail to apply padding. | ⚠️ S (alias) |
| B.39 | `contentPaddingTop` | 🟡 PARTIAL — reads `opts.paddingTop` | 🔴 MISSING | ⚠️ schema mismatch | Same. | ⚠️ S |
| B.40 | `contentPaddingRight` | 🟡 PARTIAL — reads `opts.paddingRight` | 🔴 MISSING | ⚠️ schema mismatch | Same. | ⚠️ S |
| B.41 | `contentPaddingBottom` | 🟡 PARTIAL — reads `opts.paddingBottom` | 🔴 MISSING | ⚠️ schema mismatch | Same. | ⚠️ S |
| B.42 | `optionsGroup` (UI header placeholder) | n/a (no-op) | 🔴 MISSING — no header label "边框设置" in panel | n/a | UI-only. Skipping is acceptable but reduces panel clarity. | S |

### B.43 – B.57 (Advanced: barcode/qrcode/pagination/formatter/styler)

| V1 ref | V1 option | V3 render | V3 panel UI | V3 persistence | Diff notes | Fix |
|---|---|---|---|---|---|---|
| B.43 | `textType` (`""/text/barcode/qrcode` — switches render path) | 🔴 MISSING — text→barcode/qrcode dispatch happens in `render.ts:163-178` via separate `printElementType.type` literal, NOT `opts.textType`. So a text element with `opts.textType:"barcode"` will still render as text. V1 dispatch (V1 10051-10122) explicitly switches inside the text renderer. | 🔴 MISSING | 🟡 PARTIAL — schema `element.ts:78` declares it but unused at runtime | **⚠️ VIOLATION**: V1 templates with `printElementType.type:"text"` + `options.textType:"barcode"` (e.g. trackingNo factory `provider:275`) will render as plain text, not as a barcode. **Major regression for the 4 V1 factories** (trackingNo / barcode / qrcode + any custom text-with-barcode). Note V3 has separate top-level `barcode`/`qrcode` types — but V1's factories use `type:"text"` with `textType:"barcode"`. | M |
| B.44 | `barcodeMode` (CODE128/...) | 🔴 MISSING (in text path) — `render.ts:350` reads `opts.barcodeType` not `opts.barcodeMode` (V1 10072) | 🔴 MISSING | 🟡 PARTIAL — schema declares `barcodeType` in `barcodeOptionsSchema:118` not `barcodeMode` | **Field name divergence**: V1 uses `barcodeMode`, V3 uses `barcodeType` (also confirmed in `BarcodePropertyPanel.vue`). V1 templates will fail to set format. | S (alias) |
| B.45 | `barTextMode` (`text/svg` — controls displayValue placement) | 🔴 MISSING | 🔴 MISSING | 🔴 MISSING | V1 10068, 10078 conditionally renders `<div class="hibarcode_displayValue">`. V3 always uses `bwip-js includetext` (single mode). | M |
| B.46 | `barWidth` | 🟡 PARTIAL — `render.ts:352` reads as `scale`, with fallback 1 | 🔴 MISSING | 🟡 PARTIAL — schema `barcodeOptionsSchema:120` | Renders but no UI. | S |
| B.47 | `barAutoWidth` (string `"true"`/`"false"`) | 🟡 PARTIAL — `render.ts:347 isTrue(opts.barAutoWidth)` then `width: !barAutoWidth ? ... : ''` | 🔴 MISSING | 🟡 PARTIAL — schema accepts boolean-like | **Quirk J.4 (string-only-true) DIVERGES**: `isTrue` accepts both boolean `true` and string `"true"` (`_helpers.ts:27-29`). V1 ONLY accepts string `"true"` (V1 9984: comment "true 为 true，其余一概为 false"). V3 is more permissive — round-trip from JSON `barAutoWidth: true` will render same as V1 `"true"`, but V1 explicitly rejected boolean. Acceptable widening. | n/a |
| B.48 | `barcodeType` (hi-cascader hierarchical classifier — different from barcodeMode) | 🔴 MISSING | 🔴 MISSING | 🔴 MISSING — schema collapses it into `barcodeType` (same name as B.44) | V1 has TWO fields: `barcodeMode` (`CODE128` etc — passed as JsBarcode format) AND `barcodeType` (high-level cascader value). V3 only has one. May break hi-cascader UI in V1 templates. | M |
| B.49 | `qrCodeLevel` (`0/1/2/3` → correctLevel) | ✅ DONE — `render.ts:408-410` maps to `['M','L','H','Q']` array | 🔴 MISSING | ✅ — schema `qrcodeOptionsSchema:134` | Works for top-level qrcode element type, NOT text-with-textType:qrcode (B.43). | S |
| B.50 | `qrcodeType` (hi-cascader) | 🟡 PARTIAL — `render.ts:413` reads `opts.qrcodeType` as bwip-js bcid, default `'qrcode'` | 🔴 MISSING | ✅ — schema `qrcodeOptionsSchema:133` | Works at the type-`qrcode` level only. | S |
| B.51 | `upperCase` (Chinese number conversion via Nzh library) | 🔴 MISSING — V3 does not bundle `Nzh` library | 🔴 MISSING | 🟡 PARTIAL — schema accepts booleanLike at `tableColumnSchema:199` only (table cells, not text element) | V1 10050 calls `hinnn.toUpperCase(upperCase, str)`. **V3 ignores entirely.** Templates that depend on upperCase (e.g. amount-to-Chinese conversion) will render raw numbers. | M |
| B.52 | `formatter` (string fn source compiled via `new Function`; falls back to printElementType.formatter on eval error) | 🟡 PARTIAL — `TextElement.vue:62-82` + `render.ts:235-237` invoke when `typeof formatter === 'function'`. **Does NOT compile string formatters via `new Function`** — string form silently treated as non-function and ignored. | 🔴 MISSING — no formatter textarea in generic editor | ✅ — schema `dataStyleSchema:179` allows unknown | **V1 templates store formatter as STRING source** (V1 1534-1543: `new Function('return ' + this.options.formatter)()`). V3 expects Function. Round-trip from JSON will lose formatter. Note: `render.ts:235` and `TextElement.vue:67` both check `typeof formatter === 'function'`. | M |
| B.53 | `styler` (string fn → returns CSS object) | 🔴 MISSING — render.ts has no styler invocation for text/longText (only used in table cells `render.ts:586`) | 🔴 MISSING | ✅ — schema declares | V1 1263-1271 applies returned-object CSS via `t.css(key, val)` on each text element. **Completely absent in V3** for text/longText. | M |
| B.54 | `pageBreak` (true → force new page) | 🔴 MISSING — V3 print pipeline has no pagination beyond per-panel page count | 🔴 MISSING | 🟡 PARTIAL — not in schema, but `.loose()` lets it pass | V1 4200-4205 marker for pagination. V3 print runs render-once-per-page-stamp; no element-driven pagination. | L (depends on pagination) |
| B.55 | `showInPage` (`""/none/first/odd/even/last`) | 🔴 MISSING — V3 print does NOT call any showInPage filter | 🔴 MISSING — no UI | 🟡 PARTIAL — `style.ts:150` declares but unused | V1 692-704 evaluates per page. V3 prints all elements unconditionally on every page. | M |
| B.56 | `unShowInPage` (`""/first/last`) | 🔴 MISSING | 🔴 MISSING | 🟡 PARTIAL — `style.ts:152` declares but unused | Same. | M |
| B.57 | `axis` (`""/h/v` — drag direction lock) | 🔴 MISSING — `enableElementDrag` does NOT consult opts.axis | 🔴 MISSING | 🟡 PARTIAL — `style.ts:56` declares | V1 956, 987 passes to hidraggable. interact.js supports `restrict` modifier — would need to wire `axis` to a modifier. | M |

**text option scorecard (57 fields)**:
- ✅ DONE: 6 (B.2, B.3, B.4, B.5, B.6, B.7, B.21, B.22, B.29 → render only)
- 🟡 PARTIAL: 19
- 🔴 MISSING: 27
- ⚠️ VIOLATION: 5 (B.25 verticalAlign mismatch, B.28 rotate-vs-transform, B.38–B.41 padding name mismatch, B.43 textType ignored)

---

## Section C — `text` factory presets (14 factories)

| V1 ref | Factory | V3 status | V3 file:line | Diff notes | Fix |
|---|---|---|---|---|---|
| C.1 | `defaultModule.text` | ✅ DONE | `default-provider.ts:52-58` | All fields match; V3 omits explicit `options` block (lets type defaults apply). V3's `TEXT_DEFAULT_OPTIONS` (text.ts:20-26) sets w=100 h=12 fontSize=9.75 — V1 default is w=120 h=9.75 (config:472-476). | S |
| C.2 | `defaultModule.customText` | ✅ DONE | `default-provider.ts:112-119` | All fields match including `custom: true`. | n/a |
| C.3 | `defaultModule.titleRow` | ✅ DONE | `default-provider.ts:120-134` | All fields match including textContentVerticalAlign. **However** — B.25 violation: panel can't edit verticalAlign correctly. | n/a (until B.25 fixed) |
| C.4 | `defaultModule.url` | ✅ DONE | `default-provider.ts:146-156` | Match. | n/a |
| C.5 | `defaultModule.price` | ✅ DONE | `default-provider.ts:158-170` | Match. | n/a |
| C.6 | `defaultModule.sku` | ✅ DONE | `default-provider.ts:172-177` | Match. | n/a |
| C.7 | `defaultModule.orderNo` | ✅ DONE | `default-provider.ts:198-205` | Match. | n/a |
| C.8 | `defaultModule.orderDate` | ✅ DONE | `default-provider.ts:206-213` | Match. **But** — B.15 missing: `dataType:"datetime"` not supported, so orderDate from real data renders as raw string. Factory works only with the testData string. | M |
| C.9 | `defaultModule.trackingNo` | 🟡 PARTIAL | `default-provider.ts:214-227` | Factory definition present, but **B.43 violation**: textType:"barcode" not honored → renders as plain text, not barcode. **Major regression.** | M |
| C.10 | `defaultModule.totalAmount` | ✅ DONE | `default-provider.ts:228-243` | Match. | n/a |
| C.11 | `defaultModule.barcode` | 🟡 PARTIAL | `default-provider.ts:277-290` | Definition present, but **B.43 violation**: textType:"barcode" not honored. (V3 also has a separate `barcode` top-level type which DOES work — but this V1-compat factory uses `type:"text"`.) | M |
| C.12 | `defaultModule.qrcode` | 🟡 PARTIAL | `default-provider.ts:291-304` | Same as C.11 — qrcode factory uses `type:"text"+textType:"qrcode"`, ignored. | M |
| C.13 | `defaultModule.currentDate` | 🟡 PARTIAL | `default-provider.ts:314-320` | Factory definition present but **`formatter` block MISSING in V3**. V1 provides `function(title, data, options, templateData)` that resolves to `yyyy-MM-dd` (V1 provider:375-386). V3 emits a plain text element with empty data — will render as empty / fall back to title. | S |
| C.14 | `defaultModule.signature` | ✅ DONE | `default-provider.ts:321-338` | All fields including contentPaddingLeft / borderBottom / borderWidth / borderColor / textContentVerticalAlign present. **But** — multiple per-cell violations: paddingLeft (B.38) name mismatch (V3 reads `paddingLeft`, factory writes `contentPaddingLeft`), borderBottom shorthand issue (B.30, no width specified separately), textContentVerticalAlign B.25 violation. Will not render as a signature line in V3. | M |

**text factory scorecard (14)**: ✅ 8 / 🟡 6 / 🔴 0

---

## Section D — `text` property panel sections

V1: 4 tabs (基础 / 样式 / 边框 / 高级) rendered by `ut.buildSetting(t)` (V1 12102-12238) consuming `text.tabs` from config.

V3: NO TextPropertyPanel.vue. Falls through to generic editor at `HiprintPropertyPanel.vue:332-641`.

| V1 ref | V1 section | V3 status | V3 file:line | Diff notes | Fix |
|---|---|---|---|---|---|
| D.1 | 基础 — title / field / testData / coordinate / widthHeight / hideTitle / fixed | 🟡 PARTIAL | `HiprintPropertyPanel.vue:341-383` (Position) + `590-628` (Binding) | Position fieldset has X/Y/W/H but no `positionLocked`/`sizeLocked` checkboxes and no coordinateSync/widthHeightSync toggles. Binding fieldset has title / field / testData / hideTitle (but B.13 quirk lost). **Missing entirely: `fixed` select**. | M |
| D.2 | 样式 — dataType / fontFamily / fontSize / fontWeight / letterSpacing / color / backgroundColor / textDecoration / textAlign / textContentVerticalAlign / textContentWrap / lineHeight / transform / zIndex | 🔴 MISSING (most) | `HiprintPropertyPanel.vue:385-451` (Font) + `490-510` (Background) + `512-572` (Alignment) + `574-588` (Rotate) | **Missing fields**: dataType, letterSpacing, textContentWrap, lineHeight, zIndex. textContentVerticalAlign (B.25) writes wrong key. transform (B.28) writes wrong key. fontWeight (B.19) only toggles bold. textDecoration (B.23) only toggles underline. fontFamily preset list is 8 items vs V1 dynamic from `getFontList()`. | L |
| D.3 | 边框 — optionsGroup / borderLeft / borderTop / borderRight / borderBottom / borderWidth / borderColor / contentPaddingLeft / Top / Right / Bottom | 🟡 PARTIAL | `HiprintPropertyPanel.vue:453-488` (Border) | Only generic Style/Width/Color. **Missing**: per-side borders, all 4 content paddings (and B.38-B.41 name mismatch even if added). | M |
| D.4 | 高级 — textType / barcodeMode / barTextMode / barWidth / barAutoWidth / qrCodeLevel / pageBreak / showInPage / unShowInPage / axis / upperCase / formatter / styler | 🔴 MISSING | n/a | **No equivalent "Advanced" fieldset.** All 13 fields absent from UI. | L |
| D-button | Submit button "确定" + Delete button "删除" | 🟡 PARTIAL | n/a (changes commit on blur/Enter automatically) | V3 commits per-field on blur/Enter (`HiprintPropertyPanel.vue:597-626`). No standalone Submit button. Delete is via keyboard or context menu (`interactions/context-menu.ts`). | n/a |

---

## Section E — `text` render DOM

| V1 ref | V1 DOM contract | V3 status | V3 file:line | Diff notes | Fix |
|---|---|---|---|---|---|
| E.1 | Outer wrapper `<div class="hiprint-printElement hiprint-printElement-text" tabindex="1" style="position:absolute;left/top/width/height">` | 🟡 PARTIAL | `ElementWrapper.vue:147-160` + `_helpers.ts:142-150` | Wrapper has classes `hiprint-element hiprint-printElement hiprint-printElement-text`. **Missing**: `tabindex="1"`. Has extra `hiprint-element` class (used for interact.js dropzone filter — V3 invention). | S |
| E.1 (data-attrs) | n/a in V1 | ✅ EXTRA — `data-element-id` + `data-panel-id` (`ElementWrapper.vue:150-151`) | V3 addition for interaction system. Not a violation. | n/a |
| E.2 (Branch 1 text) | Inner `<div class="hiprint-printElement-text-content hiprint-printElement-content" style="height:100%;width:100%;...">{{ titlePrefix + value }}</div>` via `.text()` | 🟡 PARTIAL | `TextElement.vue:133-154` / `render.ts:218-244` | V3 has `hiprint-printElement-text-content` class but **missing `hiprint-printElement-content`** baseline class (V1 always adds it; V3 only adds the etype-specific name). Affects CSS selectors targeting the shared class. Inline edit input adds different markup (`<input>` not contenteditable). | S |
| E.2 (Branch 2 barcode) | Inner becomes flex column with `<svg class="hibarcode_imgcode">` + optional `<div class="hibarcode_displayValue">` | 🟡 PARTIAL | `render.ts:319-377` (separate barcode type only) | When text element has `textType:"barcode"`, V3 **does NOT switch to barcode rendering** (B.43 violation). Separate `printElementType.type:"barcode"` works but with different class names (`hiprint-printElement-barcode-content` vs `hibarcode_imgcode`). V1 templates expecting `.hibarcode_imgcode` selector will break. | M |
| E.2 (Branch 3 qrcode) | Inner becomes `<div class="hiqrcode_imgcode">` + optional `<div class="hiqrcode_displayValue">` | 🟡 PARTIAL | `render.ts:379-445` | Same naming divergence as barcode: V3 uses `hiprint-printElement-qrcode-content` + `hiprint-printElement-qrcode-content-title` (render.ts:386, 428). V1 selectors broken. | S |
| E.3 (classes) | `editing` toggled on dblclick + commit | 🔴 MISSING | n/a | V3 inline edit uses an `<input>` (TextElement.vue:140-148) — no `editing` class added to content. V1 selectors targeting `.editing` will not match. | S |
| E.3 (alwaysHide) | Added when `showInPage:"none"` or `pageBreak` truthy (V1 4180, 4202) | 🔴 MISSING | n/a | No alwaysHide class in V3. | S |
| E.3 (locked / position-locked / size-locked) | Toggled by lock options (V1 1008-1042) | 🔴 MISSING | n/a | Coupled with B.8/B.9 missing. | S (after B.8/B.9) |
| E.3 (hiprint-text-content-middle / -bottom / wrap variants) | Toggled by textContentVerticalAlign / textContentWrap (V1 4817, 4844) | 🔴 MISSING | n/a | V3 uses flex `alignItems` instead, but the V1 class names are absent. CSS theming targeting these classes will not work. | S |
| E.4 (inline styles via option-item css callbacks) | Per-option `css(target, value)` returns CSS string OR null | 🟡 PARTIAL | `_helpers.ts:37-149` (5 functions: Geometry / Font / Alignment / Border / Padding) | V3 inlines all in `:style` binding rather than per-option callbacks. Net effect similar for the options that ARE implemented, but extensible per-option `css` registration (V1 1252-1259) absent — business code cannot register custom option-items. | L |

---

## Section F — `text` interactions

| V1 ref | V1 interaction | V3 status | V3 file:line | Diff notes | Fix |
|---|---|---|---|---|---|
| F.1 | Double-click → inline edit (contenteditable on `.hiprint-printElement-content`) | 🟡 PARTIAL | `TextElement.vue:90-120` | **Approach diverges**: V3 mounts an `<input>` element (not contenteditable). Edits only `title` or `testData` depending on hideTitle state. **Quirks lost**: title sanitization (J.1/J.2), fullwidth-colon split parse (V1 798), `_editing` flag for clearLastPrintElement, draggable suppression during edit (V1 763), text cursor styling, `selectEnd` cursor placement (V1 776-789). | M |
| F.1 (guard) | `printElementType.type=="text" && !(opts.textType && "text"!=opts.textType)` — barcode/qrcode disallowed | 🔴 MISSING | n/a | V3 startEdit (TextElement.vue:90) checks only `props.editable && element.value`. No textType guard. Inline edit would still trigger on a text-with-barcode (although B.43 means barcode rendering doesn't happen anyway). | S |
| F.1 (commit parse — `t.startsWith(title)`) | Parses `t.split("：")[1]` (fullwidth colon) into testData; else writes to title; strips trailing `"："` portion (V1 790-816) | 🔴 MISSING | n/a | V3 writes draftValue verbatim to one of title/testData. No fullwidth-colon parse, no title trim. | M |
| F.1 (`hiprintTemplateDataChanged_<id>` event) | Fires on every edit commit | 🔴 MISSING | n/a | No event named like this in V3. Business code subscribing to V1 event will silently break. | S (event bridge) |
| F.2 | Field binding resolution — PM-002 R3 nullish-safe reduce | ✅ DONE | `internal/dom-helpers.ts:68-80` + `_helpers.ts:158-173` | PM-002 fix carried over correctly (preserves 0/false/''). | n/a |
| F.3 | Formatter chain — `options.formatter` string → eval; falls back to `printElementType.formatter`; invoked with 5 args `(title, value, options, templateData, target)` | 🟡 PARTIAL | `TextElement.vue:62-82` + `render.ts:218-244` | **Only function form supported** — string source ignored (typeof check fails). **`target` arg missing** (V3 passes 4 args: `title, value, opts, options.data`). V1 reference text formatter signature (B.52) expects 5. Most formatters won't reference target so practical impact moderate. **`printElementType.formatter` fallback MISSING** — V3 reads only `opts.formatter` (not the type-level fallback). | M |
| F.4 | testData rendering when no data | ✅ DONE | `_helpers.ts:171-172` | Works correctly. | n/a |
| F.5 | `pageBreak` (force new page) | 🔴 MISSING | n/a | No pagination engine. | L |
| F.6 | `showInPage` filter | 🔴 MISSING | n/a | Same — pagination engine absent. | L |

---

## Section G — `text` context menu items

V1: 18 menu items + 6 alignment sub-items + 2 size-broadcast items. Source `V1 11421-11616`. Same menu shows for both text and longText.

V3: `interactions/context-menu.ts` provides Copy / Cut / Paste / Bring to Front / Send to Back + a few others.

The V1 menu structure (V1 11421-11616) is grouped under 4 labeled headers:
- 元素操作 (Element Ops) — copy/paste
- 参数更新 (Parameter Update) — font-12pt / font-bold quick-actions
- 层级操作 (Z-order Ops) — top/bottom/up/down
- 对齐操作 (Alignment Ops) — only visible with `>=2` selected, 6 alignment + 2 distribution + 2 size-broadcast items

V3's `buildElementContextMenu()` at `interactions/context-menu.ts:340+` only produces a flat list with dividers, no group headers. The right-click positioning logic uses `@floating-ui/dom` (context-menu.ts:164) which keeps the menu on-screen — improvement over V1.

| V1 ref | V1 menu item | V3 status | V3 file:line | Diff notes | Fix |
|---|---|---|---|---|---|
| G.1 | "复制元素" (Copy) | ✅ DONE | `interactions/context-menu.ts:354-360` | Mapped to canvas clipboard. | n/a |
| G.2 | "粘贴元素" (Paste, offsets +10pt) | 🟡 PARTIAL | `interactions/context-menu.ts:368-372` | Paste likely doesn't preserve the V1 `+10pt` offset; needs verification. | S |
| G.3 | "字体 12pt" (hardcoded font size 12) | 🔴 MISSING | n/a | Not in context-menu.ts default menu. Quick-action shortcut absent. | S |
| G.4 | "字体加粗" (hardcoded bolder) | 🔴 MISSING | n/a | Not in menu. | S |
| G.5 | "置于顶层" (zIndex max+1) | ✅ DONE | `interactions/context-menu.ts:373-380` | "Bring to Front" present. | n/a |
| G.6 | "置于底层" | ✅ DONE | `interactions/context-menu.ts:378-384` | "Send to Back" present. | n/a |
| G.7 | "上移一层" | 🔴 MISSING | n/a | Not in default menu. | S |
| G.8 | "下移一层" | 🔴 MISSING | n/a | Not in default menu. | S |
| G.9 | "锁定元素" / "解锁元素" toggle (sets positionLocked+sizeLocked) | 🔴 MISSING | n/a | Coupled with B.8/B.9 missing. | M |
| G.10 | "左对齐" (≥2 selected) | 🔴 MISSING | n/a | Alignment ops not in V3 context menu. | M |
| G.11 | "右对齐" | 🔴 MISSING | n/a | Same. | M |
| G.12 | "顶对齐" | 🔴 MISSING | n/a | Same. | M |
| G.13 | "底对齐" | 🔴 MISSING | n/a | Same. | M |
| G.14 | "水平居中" | 🔴 MISSING | n/a | Same. | M |
| G.15 | "垂直居中" | 🔴 MISSING | n/a | Same. | M |
| G.16 | "水平等距" (≥3 selected) | 🔴 MISSING | n/a | Same. | M |
| G.17 | "垂直等距" | 🔴 MISSING | n/a | Same. | M |
| G.18 | "等宽" (broadcast first width) | 🔴 MISSING | n/a | Same. | M |
| G.19 | "等高" (broadcast first height) | 🔴 MISSING | n/a | Same. | M |
| G.20 | "删除选中元素 (N)" with dynamic count | 🟡 PARTIAL | likely present somewhere | Needs trace to keyboard.ts or context-menu.ts; V1 dynamic count display likely missing. | S |

---

### G — Detailed alignment ops analysis (relevant for fix #9)

V1's alignment logic (V1 11546-11566) operates on `selectedEls`:

- 左对齐: `el.options.left = Math.min(...selectedEls.map(e => e.options.left))` then assign to all
- 右对齐: rightmost element's `left + width` becomes the alignment line, others shift
- 顶对齐 / 底对齐 / 水平居中 / 垂直居中: analogous
- 水平等距 (`>=3` selected): sort by `left`, compute gap from first to last, redistribute middle elements
- 垂直等距: analogous on `top`
- 等宽: `selectedEls[0].options.width` broadcast to all
- 等高: same for height

V3 fix should encapsulate this in a small `interactions/alignment.ts` module exporting pure functions `alignLeft(els) / alignRight / alignTop / alignBottom / centerH / centerV / distributeH / distributeV / equalWidth / equalHeight`, then wire 10 context-menu items each calling `canvas.updateElement(panelId, id, { options: alignedOptions })` per element.

## Section H — `text` lock behavior

| V1 ref | V1 lock behavior | V3 status | V3 file:line | Diff notes | Fix |
|---|---|---|---|---|---|
| H.1 (drag disable when positionLocked) | `hidraggable update {draggable:false}` | 🔴 MISSING | n/a | enableElementDrag ignores positionLocked. | M |
| H.1 (coord inputs disable) | `<input disabled>` (V1 3613-3614) | 🔴 MISSING | n/a | Generic editor has no positionLocked-aware input disabling. | S |
| H.1 (inline edit through positionLocked = remaining quirk J.3) | V1 still permits inline edit | n/a | n/a | V3 lacks inline edit gating, so this quirk is moot. | n/a |
| H.1 (resize hide when sizeLocked) | `.resizebtn` hidden | 🔴 MISSING | n/a | enableElementResize ignores sizeLocked. | S |
| H.2 (visual indicator 🔒 badge) | `.hiprint-lock-badge` appended to resize panel (V1 1010) | 🔴 MISSING | n/a | No badge rendering. | S |
| H.2 (delete button hidden when positionLocked) | `.del-btn` hidden (V1 1022) | n/a | n/a | V3 has no delete button on the resize panel — uses context menu. | n/a |
| H.3 (property-panel field disabling) | Coord/widthHeight inputs disabled | 🔴 MISSING | n/a | No conditional disabled state in panel. | S |

---

## Section I — `text` style/state classes

Already covered under E.3 above. Summary of class parity:

| Class | V1 | V3 | Status |
|---|---|---|---|
| `.hiprint-printElement` | always | always (`ElementWrapper.vue:81`) | ✅ |
| `.hiprint-printElement-text` | always | always | ✅ |
| `.hiprint-printElement-text-content` | inner | inner (`TextElement.vue:135`) | ✅ |
| `.hiprint-printElement-content` | inner (shared baseline) | 🔴 MISSING | 🔴 |
| `.hiprint-element` | n/a | always (V3 invention for dropzone) | ⚠️ EXTRA |
| `.hiprint-element--selected` | n/a (V1 uses `.selected`) | applied via `ElementWrapper.vue:83` when in `selectedElementIds` | ⚠️ NAME |
| `.selected` | applied during selection | 🔴 MISSING | 🔴 |
| `.editing` | inline-edit state | 🔴 MISSING | 🔴 |
| `.alwaysHide` | showInPage="none" or pageBreak truthy | 🔴 MISSING | 🔴 |
| `.locked` (on .resize-panel) | positionLocked | 🔴 MISSING | 🔴 |
| `.position-locked` (on designTarget) | positionLocked, no resize-panel | 🔴 MISSING | 🔴 |
| `.size-locked` | sizeLocked | 🔴 MISSING | 🔴 |
| `.hiprint-text-content-middle` | textContentVerticalAlign="middle" | 🔴 MISSING | 🔴 |
| `.hiprint-text-content-bottom` | textContentVerticalAlign="bottom" | 🔴 MISSING | 🔴 |
| `.hiprint-text-content-wrap` | wrapper, textContentWrap set | 🔴 MISSING | 🔴 |
| `.hiprint-text-content-wrap-{val}` | inner, textContentWrap value | 🔴 MISSING | 🔴 |
| `.hiprint-lock-badge` | positionLocked indicator | 🔴 MISSING | 🔴 |
| `.del-btn` | resize panel delete | n/a (uses context menu) | n/a |
| `.resize-panel` / `.resizebtn` | hireizeable infra | unknown — needs trace through interactions/resize.ts | TBD |

---

## Section J — `text` V1 quirks (12 total)

| V1 ref | V1 quirk | V3 status | Diff notes | Fix |
|---|---|---|---|---|
| J.1 | Inline-edit fullwidth colon `"："` (U+FF1A) split | 🔴 MISSING | V3 inline edit doesn't parse, just writes draftValue. | S |
| J.2 | `options.title = options.title.split("：")[0]` truncates colons | 🔴 MISSING | Same. | S |
| J.3 | Lock asymmetry — locking sets both positionLocked+sizeLocked, unlocking clears only positionLocked | n/a | Locks not implemented at all. | M |
| J.4 | `barAutoWidth` string-only-true | ⚠️ WIDENED | V3 accepts boolean true (more permissive). Round-trips OK from V1 JSON; opens ambiguity. | n/a |
| J.5 | `fontFamily` empty → `font-family: inherit` (template font inheritance) | ⚠️ VIOLATION | V3 omits the property entirely on empty → CSS default, breaks template-level font inheritance. | S |
| J.6 | `borderRadius` / `borderStyle` not in `text.supportOptions` but still apply via raw JSON | 🟡 N/A | V3 exposes borderStyle in generic editor → MORE features than V1 here (acceptable expansion). borderRadius MISSING for text. | n/a |
| J.7 | `transform: rotate(<n>deg)` on `.hiprint-printElement` wrapper; `getRectInfo` recalculates bounding box | ⚠️ VIOLATION (key name) | B.28 — V3 reads/writes `rotate` not `transform`. No bounding-box recalc (B.4-B.7). | M |
| J.8 | Context-menu hardcodes `fontSize=12` and `fontWeight="bolder"` | 🔴 MISSING | G.3/G.4 not in context menu. | S |
| J.9 | Inline-edit suppressed when textType≠"text" | 🔴 MISSING | F.1 guard missing. Net effect partly mitigated by B.43 (textType ignored). | S |
| J.10 | `_listOnlySelect` flag prevents double property-panel rebuild | n/a | V3 has different selection lifecycle. | n/a |
| J.11 | `hinnn.toUpperCase` for numeric→Chinese conversion | 🔴 MISSING | B.51. No Nzh library. | M |
| J.12 | `dataType:"boolean"` requires `format:"trueText:falseText"`; single-colon parse only | 🔴 MISSING | B.15/B.16. dataType ignored. | M |

---

# PART 2 — `longText` etype

## Section A — Class hierarchy

| V1 ref | V1 behavior | V3 status | V3 file:line | Diff notes | Fix |
|---|---|---|---|---|---|
| A.1 (class) | Runtime element class `w` extends BasePrintElement; options class `b` extends `g.a` | 🟡 PARTIAL | `core/etypes/long-text.ts:39-56` | Same factory pattern as text. No class hierarchy. | n/a (by-design) |
| A.1 (options class) | `b` overrides ONLY `getHideTitle()` (V1 9322-9323); other lookups go through base | 🔴 MISSING | n/a | No getter chain at all. | M |
| A.2 (ctor — leftSpaceRemoved assignment) | `n.leftSpaceRemoved = e.leftSpaceRemoved` (V1 9319) | 🔴 MISSING | n/a | V3 stores arbitrary options; no special handling for leftSpaceRemoved. | n/a (works without special init) |
| A.2 (setDefault) | `longText.default = {height:42, width:540}` (config:882-885) | ⚠️ VIOLATION | `core/etypes/long-text.ts:14-21` | V3 default `width=200, height=30, fontSize=9.75, lineHeight=1.5, textAlign='left', longTextIndent=0` — **different from V1** (V1: w=540 h=42, no fontSize/lineHeight/textAlign/longTextIndent presets). Templates will lay out differently when V1 defaults applied. | S |

---

## Section B — `longText` options table (44 fields)

| V1 ref | V1 option | V3 render | V3 panel UI | V3 persistence | Diff notes | Fix |
|---|---|---|---|---|---|---|
| B.1 | `title` (NO sanitization unlike text) | ✅ DONE — coerceText | ✅ — generic Binding | ✅ | V1 J.7: longText title preserves `\r\n\t` (different from text). V3 behaves the same as both etypes — consistent with longText, inconsistent with text. | n/a |
| B.2 | `field` (nullish-safe reduce) | ✅ DONE | ✅ | ✅ | Same as text B.2. | n/a |
| B.3 | `testData` | ✅ DONE | ✅ | ✅ | Same as text B.3 minus inline-edit quirks (longText has no inline edit). | n/a |
| B.4 | `left` | ✅ DONE | ✅ | ✅ | Same as text B.4. | n/a |
| B.5 | `top` (multi-page adjustment) | 🟡 PARTIAL | ✅ — single position only | ✅ | V1 9856 adjusts top per page. V3 has no multi-page render. | L |
| B.6 | `width` (factory: senderInfo/receiverInfo=240) | ✅ DONE | ✅ | ✅ | n/a |
| B.7 | `height` (initial design height; print height depends on content) | 🟡 PARTIAL | ✅ | ✅ | V3 lets CSS overflow but no `getHeightByData`-style measurement. | M |
| B.8 | `positionLocked` | 🔴 MISSING | 🔴 MISSING | 🟡 PARTIAL | Same as text B.8. | L |
| B.9 | `sizeLocked` | 🔴 MISSING | 🔴 MISSING | 🟡 PARTIAL | Same as text B.9. | L |
| B.10 | `draggable` | 🔴 MISSING | 🔴 MISSING | 🟡 PARTIAL | Same as text B.10. | M |
| B.11 | `coordinateSync` | 🔴 MISSING | 🔴 MISSING | 🔴 MISSING | Same as text B.11. | S |
| B.12 | `widthHeightSync` | 🔴 MISSING | 🔴 MISSING | 🔴 MISSING | Same as text B.12. | S |
| B.13 | `hideTitle` | ✅ DONE | 🟡 PARTIAL (checkbox vs 3-way) | ✅ | Same as text B.13. | S |
| B.14 | `fixed` | 🔴 MISSING | 🔴 MISSING | 🔴 MISSING | Same as text B.14. | L |
| B.15 | `fontFamily` (inherit empty) | 🟡 PARTIAL | ✅ | ✅ | Same as text B.17 (J.5 violation). | S |
| B.16 | `fontSize` (no longText-class fallback) | 🟡 PARTIAL | ✅ | ✅ | Same as text B.18. | S |
| B.17 | `fontWeight` | ✅ DONE | 🟡 PARTIAL (bold only) | ✅ | Same as text B.19. | S |
| B.18 | `letterSpacing` | ✅ DONE | 🔴 MISSING | ✅ | Same as text B.20. | S |
| B.19 | `textAlign` (with justify-last) | 🟡 PARTIAL | 🟡 PARTIAL (no justify) | ✅ | Same as text B.24. | S |
| B.20 | `lineHeight` (factory presets) | 🟡 PARTIAL (unit missing) | 🔴 MISSING | ✅ | Same as text B.27. **Acute for longText**: factory `senderInfo.lineHeight=13.5` will render as 13.5× font-size (gigantic) instead of 13.5pt. | ⚠️ S |
| B.21 | `color` | ✅ DONE | ✅ | ✅ | n/a |
| B.22 | `longTextIndent` (number, sanitized via parseInt + clamp ≥0; renders `<span class="long-text-indent" style="margin-left:Npt">` per line) | 🟡 PARTIAL | 🔴 MISSING — no UI for indent | ✅ — schema `element.ts:104` | **`LongTextElement.vue:84-87` emits SINGLE indent span**, not per-line. V1 emits one per `<br/>`-separated line (V1 9826, 9830). V3 only first-line indent. **Quirk J.2 (parseInt sanitization) DONE** via safeNumber. | M |
| B.23 | `leftSpaceRemoved` (string `"true"/"false"/""→bool`; default: REMOVE unless explicitly false) | 🔴 MISSING — V3 render does NOT strip leading whitespace | 🔴 MISSING — no UI | 🔴 MISSING — not in schema | V1 9802, 9829: `.replace(/^\s*/, "")` per line when `0 != leftSpaceRemoved`. V3 just uses `white-space: pre-wrap` (preserves spaces). Default V1 behavior is to REMOVE; V3 default keeps. | M |
| B.24 | `lHeight` (minimum line height when empty) | 🔴 MISSING | 🔴 MISSING — no UI | 🔴 MISSING — not in schema | V1 9856: `g = d + (f.height > options.lHeight ? f.height : options.lHeight)`. V3 has no lHeight branching. Empty longText collapses (no minimum). | M |
| B.25 | `transform` (rotate deg) | ⚠️ VIOLATION | 🟡 PARTIAL | ⚠️ schema mismatch | Same as text B.28 (rotate vs transform key name). | S |
| B.26 | `zIndex` | ✅ DONE | 🔴 MISSING | ✅ | Same as text B.29. | S |
| B.27 | `pageBreak` | 🔴 MISSING | 🔴 MISSING | 🟡 PARTIAL | Same as text B.54. | L |
| B.28 | `showInPage` | 🔴 MISSING | 🔴 MISSING | 🟡 PARTIAL | Same as text B.55. | M |
| B.29 | `unShowInPage` | 🔴 MISSING | 🔴 MISSING | 🟡 PARTIAL | Same as text B.56. | M |
| B.30 | `axis` | 🔴 MISSING | 🔴 MISSING | 🟡 PARTIAL | Same as text B.57. | M |
| B.31 | `formatter` (renders via `.html(o)` NOT `.text(o)` — semantic difference vs text) | 🟡 PARTIAL | 🔴 MISSING | ✅ | **DONE for HTML render path** at `LongTextElement.vue:89` (`v-html`) and `render.ts:307-309` (innerHTML). String-source compilation **MISSING** — see B.52 of text. | M |
| B.32 | `styler` (same as text, applies returned CSS object) | 🔴 MISSING | 🔴 MISSING | ✅ | Same as text B.53. | M |
| B.33 | `optionsGroup` placeholder | n/a | 🔴 MISSING | n/a | Same as text B.42. | S |
| B.34 | `borderLeft` (in supportOptions only — no longText property-panel UI in V1 either) | ✅ DONE — `_helpers.ts:120` | 🔴 MISSING — and V1 also lacks UI for longText | ✅ | V3 actually **adds UI** that V1 didn't have (B.36 in generic editor). Behavior parity OK. | n/a |
| B.35 | `borderTop` | ✅ DONE | 🔴 MISSING | ✅ | Same. | n/a |
| B.36 | `borderRight` | ✅ DONE | 🔴 MISSING | ✅ | Same. | n/a |
| B.37 | `borderBottom` | ✅ DONE | 🔴 MISSING | ✅ | Same. | n/a |
| B.38 | `borderWidth` | 🟡 PARTIAL | ✅ | ✅ | Same as text B.34. | M |
| B.39 | `borderColor` | ✅ DONE (when borderStyle set) | ✅ | ✅ | Same. | n/a |
| B.40 | `contentPaddingLeft` | 🟡 PARTIAL — V3 reads `paddingLeft` | 🔴 MISSING | ⚠️ schema mismatch | Same as text B.38 — name mismatch. | ⚠️ S |
| B.41 | `contentPaddingTop` | 🟡 PARTIAL | 🔴 MISSING | ⚠️ schema mismatch | Same. | ⚠️ S |
| B.42 | `contentPaddingRight` | 🟡 PARTIAL | 🔴 MISSING | ⚠️ schema mismatch | Same. | ⚠️ S |
| B.43 | `contentPaddingBottom` | 🟡 PARTIAL | 🔴 MISSING | ⚠️ schema mismatch | Same. | ⚠️ S |
| B.44 | `backgroundColor` | ✅ DONE | ✅ | ✅ | n/a |

**longText option scorecard (44 fields)**:
- ✅ DONE: 12
- 🟡 PARTIAL: 13
- 🔴 MISSING: 17
- ⚠️ VIOLATION: 6 (B.25 transform, B.40-B.43 padding keys, A.2 default mismatch)

---

## Section C — `longText` factory presets (3 factories)

| V1 ref | Factory | V3 status | V3 file:line | Diff notes | Fix |
|---|---|---|---|---|---|
| C.1 | `defaultModule.longText` | ✅ DONE | `default-provider.ts:66-72` | Match. V3 sets `data: "155123456789"` — matches V1 provider:41. | n/a |
| C.2 | `defaultModule.senderInfo` | ✅ DONE | `default-provider.ts:178-184` | All fields match. **Caveat**: lineHeight=13.5 will render as multiplier not pt (B.20). | ⚠️ S |
| C.3 | `defaultModule.receiverInfo` | ✅ DONE | `default-provider.ts:185-197` | All fields match. Same lineHeight caveat. | ⚠️ S |

**longText factory scorecard (3)**: ✅ 3 / 🟡 0 / 🔴 0 (modulo lineHeight unit issue)

---

## Section D — `longText` property panel sections

V1: 3 tabs (基础 / 样式 / 高级) — no 边框 tab (V1 config:619-731).

V3: Falls through to generic editor — same fields as text fallback.

| V1 ref | V1 section | V3 status | V3 file:line | Diff notes | Fix |
|---|---|---|---|---|---|
| D.1 | 基础 — title / field / testData / coordinate / widthHeight / hideTitle / fixed | 🟡 PARTIAL | `HiprintPropertyPanel.vue:341-628` | Same as text D.1. | M |
| D.2 | 样式 — fontFamily / fontSize / fontWeight / letterSpacing / textAlign / lineHeight / color / **longTextIndent / leftSpaceRemoved / lHeight** / transform / zIndex | 🔴 MISSING (most) | n/a | **All 3 longText-specific style fields (longTextIndent, leftSpaceRemoved, lHeight) absent from V3 UI.** Generic editor has font/color but none of these unique fields. | L |
| D.3 | 高级 — pageBreak / showInPage / unShowInPage / axis / formatter / styler | 🔴 MISSING | n/a | All 6 absent. | L |

---

## Section E — `longText` render DOM

| V1 ref | V1 DOM | V3 status | V3 file:line | Diff notes | Fix |
|---|---|---|---|---|---|
| E.1 | Outer `<div class="hiprint-printElement hiprint-printElement-longText" style="position:absolute;">` | ✅ DONE | `ElementWrapper.vue:147-160` + `LongTextElement.vue` (type via wrapper class) | Match (modulo extra `.hiprint-element` class). | n/a |
| E.1 (design-time dashed border) | `n.find(".hiprint-printElement-longText-content").css("border", "1px dashed #cebcbc")` (V1 9765) | 🔴 MISSING | n/a | V3 has no design-time visual indicator for empty longText box. UX regression. | S |
| E.1 (height clearing) | `f.target[0].height = ""` after content (V1 9831) | n/a | n/a | V3 sets height via CSS reactive; no post-render fix needed. | n/a |
| E.2 (no formatter) | `.text(o)` — plain text via getText | ✅ DONE | `LongTextElement.vue:90` (`{{ displayText }}`) + `render.ts:313` (createTextNode) | XSS-safe path correct. | n/a |
| E.2 (with formatter) | `.html(o)` — formatter output as HTML | ✅ DONE | `LongTextElement.vue:89` (`v-html`) + `render.ts:308` (innerHTML) | By-design HTML path correct. | n/a |
| E.2 (pagination — binary search) | `getStringBySpecificHeight + BinarySearch` (V1 9873-9892) splits content per page | 🔴 MISSING | n/a (deferred per `LongTextElement.vue:7-9` block comment) | **CRITICAL**: longText cannot paginate. Multi-page content overflows or clips. Block comment explicitly defers: "Full V1 pagination (BinarySearch + offsetHeight measurement) is intentionally deferred to a later pass". | XL |
| E.2 (per-line indent span) | One `<span class="long-text-indent" style="margin-left:Npt">` per `<br/>`-separated line (V1 9826, 9830) | 🟡 PARTIAL | `LongTextElement.vue:83-87` / `render.ts:296-302` | Single span at start only. CSS `text-indent` would be a simpler approach; current V3 uses `marginLeft` on a single inline span (functionally only first-line indent works). | M |
| E.2 (line separator `<br/>`) | Between lines | 🔴 MISSING | n/a | V3 relies on `white-space: pre-wrap` to honor `\n` characters. Functionally similar for text-only content but **NO `<br/>` tags in DOM**. Selectors targeting `.hiprint-printElement-longText-content br` won't match. | S |
| E.3 (no `.editing` class) | longText inline-edit disabled | ✅ DONE | n/a (no inline edit in V3) | Parity correct (since V3 also lacks inline edit for longText). | n/a |
| E.4 (formatter HTML render) | `.html(o)` documented as by-design XSS path (V1 9794) | ✅ DONE | comments at `LongTextElement.vue:14` | Invariant #2 (XSS by-design HTML) explicitly noted. | n/a |
| E.4 (leftSpaceRemoved per-line) | `.replace(/^\s*/, "")` (V1 9802, 9829) | 🔴 MISSING | n/a | See B.23. | M |
| E.4 (longTextIndent sanitization) | `parseInt(val, 10)` clamp ≥0 (V1 9815-9817) | ✅ DONE | `LongTextElement.vue:49` (safeNumber min:0) + `render.ts:296` | XSS C1 hardening carried over. | n/a |

---

### E — Detailed pagination algorithm reference (relevant for fix #3)

V1's binary-search pagination needs porting carefully. The algorithm:

1. **Input**: `t` (character array from `value.split('')`), `e` (available height in pt), `n` (target DOM clone for measurement)
2. **`getStringBySpecificHeight(t, e, n)`** (V1 9873-9882):
   - Convert `e` pt → px via `pt.toPx(e)` (=`e * 96 / 72`)
   - If `panel.panelPageRule == "none"`: call `IsPaginationIndex(t, t.length, -1, n)` (force one-pass measurement, no pagination signal)
   - Else: call `IsPaginationIndex(t, t.length-1, i, n)` to test if full content fits
   - If pagination signal: return paginated result
   - Else: invoke `BinarySearch(t, 0, t.length-1, i, n)` for largest fitting prefix
3. **`BinarySearch(t, lo, hi, threshold, n)`** (V1 9883-9892):
   - `mid = floor((lo + hi) / 2)`
   - Write `t.slice(0, mid).join('')` to `n` via `.text()` (XSS-safe)
   - Measure `n.height()` (px)
   - If too tall: recurse on `[lo, mid-1]`
   - Else: recurse on `[mid+1, hi]` to find more chars that fit
   - Return when `lo > hi`: the largest fitting count
4. **Per-page result** (`PaperHtmlResult` at V1 9856):
   - `target.clone()` with this page's text chars
   - `referenceElement` with `top / left / height / width / beginPrintPaperIndex / bottomInLastPaper / printTopInPaper`
   - Subsequent pages: `target.css('top', paperHeader + 'pt')` to align below page header

V3 port plan (`src/hiprint-v3/print/long-text-pagination.ts`):

```typescript
export interface PageFit {
  charCount: number    // how many chars from input fit
  heightPx: number     // measured height
  isPagination: boolean // true if more chars remain
}

export function fitTextToHeight(
  chars: readonly string[],
  maxHeightPx: number,
  measureFn: (text: string) => number  // injectable for tests
): PageFit {
  if (maxHeightPx < 0) {
    // panelPageRule == 'none' equivalent — try full
    return { charCount: chars.length, heightPx: measureFn(chars.join('')), isPagination: false }
  }
  // Binary search
  let lo = 0, hi = chars.length, bestCount = 0, bestH = 0
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    const h = measureFn(chars.slice(0, mid).join(''))
    if (h <= maxHeightPx) {
      bestCount = mid
      bestH = h
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return { charCount: bestCount, heightPx: bestH, isPagination: bestCount < chars.length }
}
```

This is dependency-injectable for unit testing (mock `measureFn`); production measureFn uses a hidden offscreen DOM clone of the element with `.textContent` set (V1 J.3 XSS hardening preserved).

## Section F — `longText` interactions

| V1 ref | V1 interaction | V3 status | V3 file:line | Diff notes | Fix |
|---|---|---|---|---|---|
| F.1 | Inline edit — DISABLED (V1 761 guard) | ✅ DONE | n/a (V3 also lacks inline edit on longText — wrapper passes `editable=false` by default and only TextElement.vue has dblclick handler) | Parity preserved. | n/a |
| F.2 | Field binding nullish-safe reduce | ✅ DONE | `_helpers.ts:158-173` | Same as text F.2. | n/a |
| F.3 | Formatter chain — 4 args (no `target` arg unlike text) | ✅ DONE | `LongTextElement.vue:58-65` (4 args: `title, value, opts, data`) + `render.ts:305` (same 4 args) | V3 happens to use 4 args here, matching V1 longText. Coincidentally correct. | n/a |
| F.4 | testData when no data | ✅ DONE | `_helpers.ts:171-172` | Same. | n/a |
| F.5 | `pageBreak` | 🔴 MISSING | n/a | Same as text F.5. | L |
| F.6 | `showInPage` | 🔴 MISSING | n/a | Same as text F.6. | M |
| F.7 | **Binary-search text fit (`getStringBySpecificHeight` + `BinarySearch`)** | 🔴 MISSING | n/a (explicit defer at `LongTextElement.vue:7-9`, `print/render.ts:17`) | **CRITICAL GAP**. Algorithm (V1 9873-9892): convert pt→px, run BinarySearch over char array measuring `i.height()` against threshold. V3 has zero pagination infrastructure. Long content prints as single-block-overflow (clipped or causes layout break). | XL (~300-500 lines new module) |
| F.8 | Multi-page result construction (PaperHtmlResult per page with `top: paperHeader+'pt'` continuation positioning) | 🔴 MISSING | n/a | Coupled with F.7. lHeight stretching also absent. | XL |

---

## Section G — `longText` context menu

Same menu as text (Section G of Part 1). All G.1-G.20 items apply identically to longText. Status identical: most MISSING in V3.

---

## Section H — `longText` lock behavior

Same as text Section H. All H.1-H.3 items identical status: MISSING in V3.

Additional V1 note: even when locked, dashed design-time border remains (V1 9765). Since V3 doesn't have the dashed border (E.1), this consideration is moot.

---

## Section I — `longText` style/state classes

| Class | V1 | V3 | Status |
|---|---|---|---|
| `.hiprint-printElement` | always | always | ✅ |
| `.hiprint-printElement-longText` | always | always (via ElementWrapper type class) | ✅ |
| `.hiprint-printElement-longText-content` | inner | inner (`LongTextElement.vue:80`) | ✅ |
| `.hiprint-printElement-content` | inner shared | 🔴 MISSING | 🔴 |
| `.long-text-indent` | per-line span | first-span only | 🟡 |
| Design-time dashed border on `-longText-content` | applied | 🔴 MISSING | 🔴 |
| No `.editing` class (longText inline-edit disabled) | n/a | n/a | ✅ parity |

---

## Section J — `longText` V1 quirks (13 total)

| V1 ref | V1 quirk | V3 status | Diff notes | Fix |
|---|---|---|---|---|
| J.1 | No inline-edit on canvas | ✅ DONE | V3 parity correct. | n/a |
| J.2 | `longTextIndent` parseInt sanitization + clamp ≥0 | ✅ DONE | `safeNumber({min:0})`. | n/a |
| J.3 | Pagination uses `.text()` write for height measurement (XSS hardening) | n/a | No pagination in V3 — quirk not applicable. | n/a (when F.7 implemented, follow same pattern) |
| J.4 | `updateDesignViewFromOptions` uses `contents().clone()` not `.html()` round-trip (XSS hardening) | n/a | V3 uses Vue reactivity, not jQuery clone. Effectively XSS-safe by virtue of Vue's render pipeline. | n/a |
| J.5 | `getText` strips leading whitespace ONLY when `0 != leftSpaceRemoved` (default = REMOVE) | 🔴 MISSING | B.23. V3 default = KEEP (CSS `pre-wrap`). | M |
| J.6 | Formatter renders via `.html(o)` — by-design HTML | ✅ DONE | `v-html` / innerHTML. | n/a |
| J.7 | `getTitle()` does NOT strip `\r\n\t` (unlike text) | ✅ DONE | V3 doesn't strip for either etype — accidental parity. | n/a |
| J.8 | Multi-page render top offset to paperHeader on continuation pages | 🔴 MISSING | F.8. | XL |
| J.9 | `lHeight` minimum line height when empty/short | 🔴 MISSING | B.24. | M |
| J.10 | `getHeightByData` synthesizes 25000pt fake panel to measure unbounded | 🔴 MISSING | No equivalent measurement API. | M |
| J.11 | `panelPageRule == "none"` skips pagination split | n/a | No pagination, so no-op rule exists implicitly. | n/a |
| J.12 | `b` options class overrides ONLY `getHideTitle` | 🔴 MISSING | No getter chain at all. | M |
| J.13 | borderTop/Left/Right/Bottom + 4 contentPadding* in supportOptions only — no longText UI in V1 | 🟡 PARTIAL | V3 generic editor exposes generic borderStyle/Width/Color (more than V1 for longText). Padding name mismatch (B.40-B.43). | n/a |

---

# Appendix — Cross-cutting summary

## Aggregate scorecard

**text etype (57 options + 14 factories + 4 tabs + 20 context menu + 12 quirks = 107 items)**:
- ✅ DONE: ~22
- 🟡 PARTIAL: ~31
- 🔴 MISSING: ~46
- ⚠️ VIOLATION: ~8

**longText etype (44 options + 3 factories + 3 tabs + 20 context menu + 13 quirks = 83 items)**:
- ✅ DONE: ~17
- 🟡 PARTIAL: ~17
- 🔴 MISSING: ~43
- ⚠️ VIOLATION: ~6

**Grand totals (text + longText)**:
- ✅ ~39 / 🟡 ~48 / 🔴 ~89 / ⚠️ ~14
- Pass rate (DONE + PARTIAL) ≈ 46%
- Strict pass rate (DONE only) ≈ 21%

## Top 10 gaps (sorted by impact)

> Each gap lists: severity, V1 source, V3 file:line where the fix should land, recommended approach, and estimated effort.

### 1. 🔴 **No TextPropertyPanel.vue / LongTextPropertyPanel.vue exists**
- **V1**: 4 tabs for text, 3 tabs for longText (V1 12102-12238 dispatcher + `text.tabs`/`longText.tabs` in `hiprint.config.js:96-292, 618-731`)
- **V3 fix location**: `src/hiprint-v3/components/property/TextPropertyPanel.vue` (new file), `src/hiprint-v3/components/property/LongTextPropertyPanel.vue` (new file). Register in `HiprintPropertyPanel.vue:55-67` dispatch set.
- **Approach**: Build 2 new SFCs mirroring `BarcodePropertyPanel.vue` shape. Expose all 57+44 fields organized into V1's tab structure.
- **Effort**: L (~600-800 lines total across 2 SFCs)
- **Affected items**: D.1-D.4 (text), D.1-D.3 (longText), plus ~30 sub-fields each missing UI

### 2. 🔴 ⚠️ **B.43 — `textType:"barcode"|"qrcode"` on `type:"text"` not honored**
- **V1**: bundle.js:10051-10122 — text renderer switches branch based on `options.textType`
- **V3 fix location**: `src/hiprint-v3/print/render.ts:218-244` (`renderTextElement`) + `src/hiprint-v3/components/elements/TextElement.vue:127-156` (template)
- **Approach**: Inside text renderer/component, dispatch to barcode/qrcode rendering when `opts.textType !== 'text'`. Or alternative: at element-creation time, rewrite `printElementType.type = opts.textType` so the existing top-level dispatch (render.ts:163-178) does the right thing. Latter is cleaner.
- **Effort**: M
- **Affected factories**: `defaultModule.trackingNo`, `defaultModule.barcode`, `defaultModule.qrcode` (3 of 14 factories rendered wrong)

### 3. 🔴 ⚠️ **F.7/F.8/E.2 — LongText binary-search pagination MISSING entirely**
- **V1**: bundle.js:9818-9892 (`getStringBySpecificHeight`, `BinarySearch`, `getHeightByData`) + 9856 (PaperHtmlResult multi-page top adjustment)
- **V3 fix location**: New module `src/hiprint-v3/print/long-text-pagination.ts` (estimated 300-500 lines); integrate into `src/hiprint-v3/print/render.ts:279-317` (`renderLongTextElement`) and possibly into the broader page-build pipeline `src/hiprint-v3/print/index.ts`.
- **Approach**: Port V1 BinarySearch character-by-character algorithm. Use offscreen DOM measurement (`offsetHeight`) on a transient clone with text-only writes (preserve V1 J.3 XSS hardening). Emit per-page render targets.
- **Effort**: XL (single biggest item — explicitly deferred in V3 code comments at `LongTextElement.vue:7-9` and `render.ts:17`).
- **Affected items**: B.5 (top adjustment), B.7 (height), B.24 (lHeight), F.7, F.8, J.8, J.10, J.11

### 4. 🔴 ⚠️ **B.8/B.9/B.10/H.1-H.3 — Lock semantics (positionLocked / sizeLocked / draggable) not wired**
- **V1**: bundle.js:996-1042 + 11525-11540 (lock toggle in context menu)
- **V3 fix location**: `src/hiprint-v3/interactions/drag-drop.ts:enableElementDrag` (block drag when `opts.positionLocked`), `src/hiprint-v3/interactions/resize.ts:enableElementResize` (block resize when `opts.sizeLocked`), `src/hiprint-v3/components/elements/ElementWrapper.vue:87-132` (consult options before enabling interactions), `src/hiprint-v3/interactions/context-menu.ts:340+` (add 锁定/解锁 entry).
- **Approach**: Read `element.options.positionLocked / sizeLocked / draggable` in interactions setup; skip respective handler registration. Add CSS class `hiprint-printElement--position-locked` / `--size-locked` on wrapper. Add lock-toggle context menu item.
- **Effort**: L
- **Affected items**: B.8, B.9, B.10, H.1-H.3, E.3 (locked / position-locked / size-locked classes), J.3, G.9

### 5. ⚠️ **B.25 / B.28 / B.38-B.41 — Option name divergence (panel writes wrong keys)**
- **V1**: `textContentVerticalAlign`, `transform`, `contentPaddingLeft/Top/Right/Bottom`
- **V3 (current incorrect)**: panel writes `verticalAlign`, `rotate`, `paddingLeft/Top/Right/Bottom`
- **V3 fix location**: `src/hiprint-v3/components/HiprintPropertyPanel.vue:234, 237, 239` (rename keys) + `src/hiprint-v3/components/elements/_helpers.ts:96-105, 53-55, 130-134` (read both old and new keys, or just rename to V1 names).
- **Approach**: Rename V3 keys to V1 names (`textContentVerticalAlign`, `transform`, `contentPaddingLeft` etc.), or add bidirectional aliasing layer. Aliasing is safer for in-flight templates.
- **Effort**: S (~50 lines + tests)
- **Affected items**: B.25, B.28, B.38-B.41 (5 of 57 text options have wrong key, breaking round-trip)

### 6. 🔴 **B.52 / B.53 — `formatter` / `styler` string-source compilation missing**
- **V1**: bundle.js:1534-1551 — `new Function('return ' + this.options.formatter)()` with fallback to `printElementType.formatter` on eval error
- **V3 fix location**: `src/hiprint-v3/internal/code-eval.ts` (new file with safe Function constructor wrapper, similar to V2's `evalCap` referenced in `schemas/style.ts:177`) + integrate at `_helpers.ts:158-173` (resolve formatter before passing to render path) + `TextElement.vue:66`, `LongTextElement.vue:56`, `render.ts:231, 292`.
- **Approach**: At render time, if `opts.formatter` is a string, eval-compile (with CSP-aware fallback). Cache compiled function on the options object. Also implement `printElementType.formatter` fallback.
- **Effort**: M (~100 lines + careful security review per ADR / CSP policy)
- **Affected items**: B.52, B.53, F.3, J factories (especially C.13 currentDate which relies on a function formatter), styler entirely missing

### 7. 🔴 **B.54/B.55/B.56/F.5/F.6 — `pageBreak` / `showInPage` / `unShowInPage` filter not in V3 print pipeline**
- **V1**: bundle.js:692-704 (`showInPage(t, e)` BasePrintElement method) + 4180-4209 (alwaysHide class application) + per-element pageBreak hooks
- **V3 fix location**: `src/hiprint-v3/print/render.ts:155-213` (renderElement) — filter elements before rendering by page index. Requires page-index awareness which the current renderer does not have.
- **Approach**: Add page-index parameter to renderElement; before rendering, evaluate showInPage/unShowInPage and skip if hidden. Add `alwaysHide` CSS class for css-driven hiding fallback.
- **Effort**: M (~100 lines) — depends on multi-page rendering being implemented for #3.
- **Affected items**: B.54-B.56, F.5/F.6 (both etypes)

### 8. 🔴 **B.15/B.16 — `dataType` (`datetime`/`boolean`) + `format` not applied**
- **V1**: bundle.js:10038-10043 — branches on dataType, calls `o.a.dateFormat(value, format)` for datetime or splits `"true:false"` for boolean
- **V3 fix location**: `src/hiprint-v3/components/elements/_helpers.ts:158-173` (`getElementValue`) — after resolveField, apply dataType transformation. New helper `src/hiprint-v3/internal/data-format.ts` for date pattern (yyyy-MM-dd) interpretation.
- **Approach**: After value resolution, branch on opts.dataType. Implement minimal datetime formatter (or import a small library like dayjs). Boolean format: split format on `:` → trueText/falseText.
- **Effort**: M (~150 lines including date formatter or library wrapping)
- **Affected items**: B.15, B.16, J.12, `defaultModule.orderDate` factory C.8 won't transform real data

### 9. 🔴 **G.7-G.19 — Context menu missing alignment ops, font shortcuts, zIndex shift items**
- **V1**: bundle.js:11469-11521, 11544-11592 (full menu)
- **V3 fix location**: `src/hiprint-v3/interactions/context-menu.ts:340+` (add items: 上移一层 / 下移一层 / 字体12pt / 字体加粗 / 左对齐 / 右对齐 / 顶对齐 / 底对齐 / 水平居中 / 垂直居中 / 水平等距 / 垂直等距 / 等宽 / 等高)
- **Approach**: Add ~13 menu entries. Most depend on `canvas.selectedElements` count guards. Alignment items need geometry helpers (could share with V3's existing snap/grid utilities).
- **Effort**: M (~300 lines including helper for alignment math)
- **Affected items**: G.3, G.4, G.7-G.19

### 10. 🔴 **F.1 — Inline-edit (text only) lost the fullwidth-colon parse + sanitization**
- **V1**: bundle.js:790-816 — parses `t.split("：")[1]` into testData; title stripped at first `"："`; `replaceEnterAndNewlineAndTab` sanitization on commit
- **V3 fix location**: `src/hiprint-v3/components/elements/TextElement.vue:108-120` (`commitEdit`)
- **Approach**: Reproduce V1 commit logic — try fullwidth-colon split, write to title vs testData accordingly. Add `replaceEnterAndNewlineAndTab` helper (~5 lines: regex `/[\r\n\t]/g` → '').
- **Effort**: S (~30 lines + tests). Easiest of the top 10.
- **Affected items**: F.1, J.1, J.2, and a UX regression for designers used to V1 inline-edit semantics.

---

## Sub-systems entirely absent

These are not single-item gaps but missing infrastructure:

| Sub-system | Affects | Effort |
|---|---|---|
| Multi-page pagination engine (alwaysHide, showInPage, pageBreak, fixed, longText binary-search) | B.14, B.54-B.56, F.5-F.8, J.8, J.10 of text+longText | XL |
| Option-item registry + per-option `css()` callback dispatch | E.4 (extensibility); business code can't register custom option-items | L |
| String-source `formatter` / `styler` compilation (new Function eval with fallback) | B.52, B.53, C.13, F.3 | M |
| `Nzh` Chinese-number conversion (`upperCase` field) | B.51, J.11, table-cell upperCase too | M |
| `dataType` + `format` transformation pipeline | B.15, B.16, C.8 (orderDate) | M |
| Per-element lock semantics (positionLocked, sizeLocked, draggable) | B.8-B.10, H.1-H.3, J.3, related context-menu | L |
| Coordinate / WidthHeight sync UI (🔗 toggles) | B.11, B.12 | S |
| `hiprintTemplateDataChanged_<id>` event bridge | F.1 commit, business code subscriptions | S |
| `i18n.__()` infrastructure for property panel labels | every property panel label (entire UI in English vs V1 zh-CN) | M |

---

## Round-trip JSON compatibility risk

A V1 template JSON loaded into V3 today will exhibit:

1. ⚠️ **Silent rendering miss** for elements with `options.textType:"barcode"|"qrcode"` (B.43) — renders as plain text
2. ⚠️ **Silent option-key drops** for `textContentVerticalAlign` / `transform` / `contentPaddingLeft|Top|Right|Bottom` (B.25, B.28, B.38-B.41) — schema accepts via `.loose()` but `_helpers.ts` reads renamed keys
3. ⚠️ **lineHeight rendered as multiplier not pt** — visible giant lines for senderInfo/receiverInfo factories (B.20)
4. ⚠️ **fontFamily empty does not inherit template font** (B.17 / J.5)
5. ⚠️ **String-source formatters silently dropped** (B.52 / J factories)
6. ⚠️ **`textContentWrap` and `textDecoration` non-underline values render-only via JSON, no UI** (B.23, B.26)
7. ⚠️ **All pagination-driven fields ignored** (`fixed`, `pageBreak`, `showInPage`, `unShowInPage`)
8. ⚠️ **All lock-related fields persist in JSON but have no visible effect** (`positionLocked`, `sizeLocked`, `draggable`)

These violations should be tracked in a single `docs/V3-PARITY-MATRIX/round-trip-risks.md` with regression tests in `src/hiprint-v3/__tests__/` covering each.

---

## Recommended fix ordering (P-phase plan suggestion)

| Phase | Focus | Items |
|---|---|---|
| P19.1 | ⚠️ Option-key alignment | Top-10 #5 (B.25, B.28, B.38-B.41 rename) — quick wins, restore V1 JSON round-trip |
| P19.2 | 🔴 Property panels | Top-10 #1 (TextPropertyPanel + LongTextPropertyPanel SFCs) |
| P19.3 | 🔴 textType dispatch | Top-10 #2 (B.43) |
| P19.4 | 🔴 Lock semantics + context menu | Top-10 #4 + #9 |
| P19.5 | 🔴 Formatter/styler string compilation + dataType | Top-10 #6 + #8 |
| P19.6 | 🔴 Inline-edit polish | Top-10 #10 |
| P20.1 | 🔴 Pagination engine (foundational) | Top-10 #3 + #7 |
| P20.2 | longText pagination polish | F.8, J.8, B.24 lHeight, B.7 height-by-data |
| P21.x | Misc parity items (Nzh upperCase, dashed border, i18n labels, etc.) | Remaining MISSING |

---

## Appendix A — V3 component / module inventory cross-reference

Quick lookup of which V3 file owns each text/longText concern:

| V3 file | Lines | Owns | Misses |
|---|---|---|---|
| `core/element-base.ts` | (small) | Element ID generation, BaseElement shape | Class hierarchy, options-class fallbacks |
| `core/etypes/text.ts` | 87 | `createTextElement` factory + `TEXT_DEFAULT_OPTIONS` + `getTextDisplay` data fn | Title sanitization, `getTextType/getFontSize/...` fallback getters |
| `core/etypes/long-text.ts` | 73 | `createLongTextElement` factory + `LONG_TEXT_DEFAULT_OPTIONS` + `composeLongTextDisplay` | leftSpaceRemoved init, `getHideTitle` override semantics, lHeight |
| `core/default-provider.ts` | 412 | All 4 V1 groups + 23 element-type definitions | C.13 currentDate formatter (function omitted); B.43 factories still emit wrong type literal |
| `components/elements/TextElement.vue` | 171 | text rendering via Vue, inline-edit (rudimentary), formatter dispatch | F.1 commit parse (fullwidth-colon, replaceEnter), `target` arg, string-source formatter, textType dispatch, all state classes |
| `components/elements/LongTextElement.vue` | 93 | longText rendering, first-line indent, formatter HTML path | F.7/F.8 pagination, per-line indent spans, leftSpaceRemoved, lHeight, dashed design border |
| `components/elements/ElementWrapper.vue` | 172 | Outer wrapper class + data-attrs, drag/resize/selection wiring | tabindex, lock-aware interaction gating, all state classes (selected name differs) |
| `components/elements/_helpers.ts` | 193 | computeBaseStyle (Geometry/Font/Alignment/Border/Padding), getElementValue, computeDisplayText | dataType/format, displayLeft transform-aware, fontFamily inherit, lineHeight pt unit, name mismatches (rotate/verticalAlign/padding) |
| `components/HiprintPropertyPanel.vue` | 787 | Generic editor with ~12 fields (Position/Font/Border/Background/Alignment/Rotate/Binding/Lock) | TextPropertyPanel/LongTextPropertyPanel SFCs entirely absent; misses 50+ field-level options |
| `print/render.ts` | 797 | renderTextElement (218-244), renderLongTextElement (279-317), barcode/qrcode renderers | textType-as-text-option dispatch, longText pagination, string formatter compilation, styler, dataType, multi-page logic, showInPage filter |
| `schemas/element.ts` | 339 | text/longText option schemas with `.loose()` | dataType, format, lHeight, leftSpaceRemoved, textContentWrap not declared (loose lets them pass but no validation) |
| `schemas/style.ts` | (~200) | Position/Font/Border/Padding/Behavior groups | contentPadding* names not aliased; transform vs rotate |
| `internal/dom-helpers.ts` | (~80) | resolveField (PM-002 R3 fix), safeNumber, coerceText | replaceEnterAndNewlineAndTab missing |
| `interactions/drag-drop.ts` | — | Drag handler, drop, ghost positioning | positionLocked check, axis-restrict, anti-drag-during-edit |
| `interactions/context-menu.ts` | — | Basic Copy/Cut/Paste/Bring/Send/Delete | font shortcuts, alignment ops (10+), lock toggle, zIndex shift up/down |

## Appendix B — V1 → V3 option-key alias table (must implement)

The single most impactful regression is V3 reading wrong option keys. A compatibility shim — either at schema parse time (preferred) or in `_helpers.ts` accessor functions — should bidirectionally map:

| V1 key | V3 (current) | Recommended fix |
|---|---|---|
| `transform` (rotate deg) | `rotate` | Rename V3 → `transform`. Update panel writes (HiprintPropertyPanel.vue:237), helper reads (_helpers.ts:53). |
| `textContentVerticalAlign` | `verticalAlign` | Rename V3 → `textContentVerticalAlign`. Panel writes (HiprintPropertyPanel.vue:234), helper reads (_helpers.ts:97). |
| `contentPaddingLeft` | `paddingLeft` | Add accessor that prefers `contentPaddingLeft` then falls back to `paddingLeft`. Apply to `.hiprint-printElement-content` not the wrapper. |
| `contentPaddingTop` | `paddingTop` | Same. |
| `contentPaddingRight` | `paddingRight` | Same. |
| `contentPaddingBottom` | `paddingBottom` | Same. |
| `barcodeMode` | `barcodeType` (text+barcode collapsed) | Distinguish: `barcodeMode` (JsBarcode/bwip-js format string) vs hi-cascader `barcodeType` (UI classifier). V1 has both; V3 collapses. |
| `transform` (text wrapper class name `.hiprint-text-content-middle`) | flex `alignItems` mechanism | Either add CSS classes OR rename mechanism. Class-based aligns with V1 selectors used in custom CSS themes. |

## Appendix C — Test coverage observations

Existing V3 tests for text/longText (`src/hiprint-v3/components/elements/__tests__/TextElement.spec.ts`, `LongTextElement.spec.ts`):

- Verify XSS-safe rendering (Invariant #1) ✅
- Verify formatter HTML render path (Invariant #2) ✅
- Verify field resolution preserves 0/false/'' (PM-002 R3) ✅
- Verify longText indent sanitization (R3 C1) ✅

But do NOT cover:

- 🔴 Title sanitization (`\r\n\t` strip)
- 🔴 fullwidth-colon parse in inline edit
- 🔴 textType branch dispatch
- 🔴 dataType/format datetime/boolean transformation
- 🔴 leftSpaceRemoved per-line whitespace removal
- 🔴 lHeight minimum height
- 🔴 longText binary-search pagination (deferred)
- 🔴 showInPage / unShowInPage filters
- 🔴 positionLocked / sizeLocked / draggable lock semantics
- 🔴 string-source formatter compilation
- 🔴 styler callback application
- 🔴 upperCase Chinese number conversion
- 🔴 14 text factories + 3 longText factories visual snapshots

Recommended: after each P-phase fix lands, add a regression test under `src/hiprint-v3/components/elements/__tests__/text-parity-<phase>.spec.ts` or `longtext-parity-<phase>.spec.ts` referencing the V1 inventory section letter being closed.

## Appendix D — V1 quirks that V3 INTENTIONALLY drops (acceptable)

Not every V1 quirk must be reproduced. The following are intentional V3 architectural improvements and should NOT be re-introduced:

| V1 quirk | Why dropped | Status |
|---|---|---|
| jQuery `.minicolors` plugin for color pickers | V3 no-jQuery policy; native `<input type="color">` is sufficient | ✅ intentional |
| `_listOnlySelect` flag for selection event de-dup | V3 selection uses different lifecycle (Pinia store reactive) | ✅ intentional |
| `hireizeable` jQuery plugin for resize handles | V3 uses interact.js | ✅ intentional |
| Imperative DOM patching in option-item `css()` callbacks | V3 uses Vue `:style` reactive binding | ✅ intentional |
| `barAutoWidth` string-only-true semantic (V1 J.4) | V3 widens to also accept boolean true — V1 templates still work | ✅ acceptable widening |
| `$(document).on('click.hiprintCtxMenu', ...)` namespaced jQuery event for context menu close | V3 uses native event listeners with cleanup refs | ✅ intentional |

For each of these, V3 must remain backward-compatible reading the V1 JSON shape. None of the above changes the data persisted to template JSON.

---

## End of matrix

This document scores **107 text items + 83 longText items = 190 total** against V3. Combined with the V1 inventory (1119 lines, 561 citations), this should be a complete picture of where text/longText etypes stand on the parity ladder.

**Headline numbers**:
- Strict pass rate (✅ DONE only): ~21%
- Pragmatic pass rate (✅ + 🟡 PARTIAL): ~46%
- Items with active divergence (⚠️ VIOLATION): 14 — these are the **immediate** fix candidates because they affect V1 JSON round-trip
- 🔴 MISSING with no V3 file:line at all: 89 — these are the long-tail features needing new code

**Recommended cadence**: re-run this matrix at the end of each P-phase to track progress. Suggest adding a CI check that fails if the ✅ DONE count regresses or if any new 🔴 MISSING items are introduced for previously-DONE behaviors.
