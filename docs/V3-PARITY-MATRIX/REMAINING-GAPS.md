# V3 Parity — REMAINING GAPS (Post Sprints 22a-r / 22b / 22c / 22d / 22f)

> **Produced by Sprint 22g Stream GD** on 2026-05-12.
> Derived from `docs/V3-PARITY-MATRIX/01-08` (~6774 LoC, ~1850 scored rows) minus sprint deltas 701efe5..08c448c.
> HEAD: `08c448c` on `refactor/hiprint-v2`.

## Source attribution

- **Inputs**: `docs/V3-PARITY-MATRIX/INDEX.md` + 8 matrix docs (1254 + 810 + 604 + 687 + 595 + 1131 + 1067 + 626 LoC).
- **Sprint commits applied as deltas**:
  - `701efe5` Sprint 22a-r — panel-key-drift rollback (shapes/barcode/qrcode/image/html/table) + paper list rollback + TB-006 pagination scope.
  - `43912c8` Sprint 22b — history auto-snapshot (12 mutation boundaries) + render-path convergence (table) + textType dispatch + dataType pipeline + longText binary-search pagination + page-break filter + lock semantics module.
  - `86bf76f` Sprint 22c — toolbarCtrl 21 methods + PrintTemplate +25 methods (now 55/67) + buildToolbar opts +57 + Element list panel + guide lines + smart guides + multi-layer table UI + Text/LongText property panels.
  - `c5dfa81` Sprint 22d — sidebar resize/collapse + visible resize handles + page badge + ruler handles + 27 factory presets parity + context-menu align + inline-edit fullwidth-colon + 6 ADRs (0024-0029).
  - `08c448c` Sprint 22f — BEM bridge + CSS tokens + V1 theme css opt-in + dialog wrap class compat + print-lock.css export + upgrade-to-v3 docs.
- **Concurrent zero-out streams GA/GB/GC** (Sprint 22g, in-flight): ~43 additional row closures assumed.

---

## Aggregate scorecard (rows still open)

| Area | ⚠️ VIOLATION | 🔴 MISSING | 🟡 PARTIAL | ✅ DONE (cumulative) | ⏸️ DEFERRED | Total |
|---|---:|---:|---:|---:|---:|---:|
| 01 toolbar-and-shell | 1 | 22 | 7 | 213 | 5 | 248 |
| 02 text-longtext | 0 | 4 | 8 | 178 | 2 | 192 |
| 03 image-html | 0 | 9 | 4 | 95 | 5 | 113 |
| 04 barcode-qrcode | 0 | 6 | 5 | 132 | 7 | 150 |
| 05 shapes | 0 | 3 | 0 | 95 | 8 | 106 |
| 06 table | 0 | 12 | 5 | 175 | 19 | 211 |
| 07 interactions | 0 | 14 | 6 | 90 | 46 | 156 |
| 08 styles | 0 | 7 | 2 | 158 | 96 | 263 |
| **TOTAL** | **1** | **77** | **37** | **1136** | **188** | **~1439** |

**Actionable still-open count**: ⚠️ 1 + 🔴 77 + 🟡 37 = **115 tickets** (target ~88; over-spec due to splitting partials).
**Out-of-scope / explicitly deferred (won't fix v2.0.0)**: 188 (ADR-blocked or by-design Vue architecture replacement).

Tests delta: 1332 baseline → 2122 final after 22f (+790 across 5 sprints).
V1 API coverage final:
- toolbarCtrl: **21/42 (50%)** — 21 still missing (most are setBusinessXxx / setTemplateXxx provider/loader API).
- PrintTemplate: **55/67 (82%)** — 12 missing (mostly internal V1 toPdf helpers + obsolete `printByHtml*`).
- buildToolbar opts: **>114%** — V3 super-set; no missing opts.
- text: **50/57 (88%)** — 7 missing.
- longText: **41/44 (93%)** — 3 missing.
- factory presets: **27/27 (100%)**.
- CSS classes: **~225/231 (97%)** + BEM bridge in 22f.
- Quirks ADRs: **6 of 6 decided** (ADR-0024..0029).

---

## Decision legend

- `rollback` — undo Sprint 22a regression; restore V1 behavior byte-equivalent.
- `fix-bug` — V3 reads/writes wrong key, default, or shape; surgical patch.
- `build-feature` — V3 has zero equivalent; new module needed.
- `write-ADR-then-decide` — V1 quirk in tension with V3 design philosophy; surface to user.
- `defer-v2.0` — explicitly out-of-scope; document in upgrade-to-v3 docs.

---

# Area 01 — Toolbar & Shell

## ⚠️ VIOLATIONs (1)

TKT-300 — V3 panel-manager remains chip-list rather than V1 `<select>`
  Area: toolbar
  V1 ref: bundle.js line 14455-14483
  V3 file: src/hiprint-v3/components/HiprintToolbar.vue:1052-1072
  Status: ⚠️
  Decision: write-ADR-then-decide
  Effort: M
  DoD: ADR explains chip-list rationale OR convert to `<select>` + aria-label="选择分页" + e2e/tests/toolbar-panel-manager.spec.ts "select-dropdown DOM" case

## 🔴 MISSING (22)

### toolbarCtrl 21 of 42 V1 methods still missing (`compat/build-toolbar.ts`)

TKT-301 — toolbarCtrl.refreshBusinessList(): provider-aware reload + requestId cancel
  Area: toolbarCtrl
  V1 ref: bundle.js line 14738-14740
  V3 file: src/hiprint-v3/compat/build-toolbar.ts:581 (signature exists; provider/requestId glue absent)
  Status: 🟡 (signature stub only)
  Decision: build-feature
  Effort: M
  DoD: e2e/tests/toolbarCtrl.spec.ts "refreshBusinessList cancels in-flight on re-invocation"

TKT-302 — toolbarCtrl.setBusinessListProvider(fn)
  Area: toolbarCtrl
  V1 ref: bundle.js line 14747-14749
  V3 file: src/hiprint-v3/compat/build-toolbar.ts (absent)
  Status: 🔴
  Decision: build-feature
  Effort: S
  DoD: e2e/tests/toolbarCtrl.spec.ts "setBusinessListProvider runtime swap"

TKT-303 — toolbarCtrl.getBusinessDialogElement() → HTMLElement|null
  Area: toolbarCtrl
  V1 ref: bundle.js line 14753-14755
  V3 file: src/hiprint-v3/compat/build-toolbar.ts (absent)
  Status: 🔴
  Decision: build-feature
  Effort: S
  DoD: vitest "getBusinessDialogElement returns mounted teleport node"

TKT-304 — toolbarCtrl.getTemplateDialogElement() → HTMLElement|null
  Area: toolbarCtrl
  V1 ref: bundle.js line 14762-14764
  V3 file: src/hiprint-v3/compat/build-toolbar.ts (absent)
  Status: 🔴
  Decision: build-feature
  Effort: S
  DoD: vitest "getTemplateDialogElement"

TKT-305 — toolbarCtrl.getSaveDialogElement() → HTMLElement|null
  Area: toolbarCtrl
  V1 ref: bundle.js line 14771-14773
  V3 file: src/hiprint-v3/compat/build-toolbar.ts (absent)
  Status: 🔴
  Decision: build-feature
  Effort: S
  DoD: vitest "getSaveDialogElement"

TKT-306 — toolbarCtrl.setTemplateListProvider(fn)
  Area: toolbarCtrl
  V1 ref: bundle.js line 14783-14785
  V3 file: src/hiprint-v3/compat/build-toolbar.ts (absent)
  Status: 🔴
  Decision: build-feature
  Effort: S
  DoD: vitest "setTemplateListProvider runtime swap"

TKT-307 — toolbarCtrl.setDialogHandler(key, fn) — generic dialog hook setter
  Area: toolbarCtrl
  V1 ref: bundle.js line 14789-14791
  V3 file: src/hiprint-v3/compat/build-toolbar.ts (absent)
  Status: 🔴
  Decision: build-feature
  Effort: M
  DoD: vitest "setDialogHandler('businessOpen', fn) round-trip"

TKT-308 — toolbarCtrl.getDialogHandler(key) — symmetric getter
  Area: toolbarCtrl
  V1 ref: bundle.js line 14792-14794
  V3 file: src/hiprint-v3/compat/build-toolbar.ts (absent)
  Status: 🔴
  Decision: build-feature
  Effort: S
  DoD: vitest "getDialogHandler returns null when unset"

TKT-309 — toolbarCtrl 8 setXxxDialogHandler convenience methods (business/template/save × open/close + delete-confirm)
  Area: toolbarCtrl
  V1 ref: bundle.js line 14795-14815
  V3 file: src/hiprint-v3/compat/build-toolbar.ts (absent)
  Status: 🔴
  Decision: build-feature
  Effort: M
  DoD: e2e/tests/toolbarCtrl-dialog-handlers.spec.ts all 8 setters wire to dialog open/close/confirm flow

TKT-310 — toolbarCtrl.triggerSave({skipPrompt, name}) — programmatic save invocation
  Area: toolbarCtrl
  V1 ref: bundle.js line 14816-14818
  V3 file: src/hiprint-v3/compat/build-toolbar.ts (absent)
  Status: 🔴
  Decision: build-feature
  Effort: M
  DoD: e2e "triggerSave skipPrompt:true bypasses dialog, fires onSave directly"

TKT-311 — toolbarCtrl.setButtonVisible(key, bool) / setButtonDisabled(key, bool)
  Area: toolbarCtrl
  V1 ref: bundle.js line 14825-14830
  V3 file: src/hiprint-v3/compat/build-toolbar.ts (only enableButton/disableButton exist, no setButtonVisible)
  Status: 🔴
  Decision: build-feature
  Effort: S
  DoD: vitest "setButtonVisible('print', false) hides DOM node"

TKT-312 — toolbarCtrl.getGroup(groupKey) / getGroups() / setGroupVisible(groupKey, bool)
  Area: toolbarCtrl
  V1 ref: bundle.js line 14837-14845
  V3 file: src/hiprint-v3/compat/build-toolbar.ts (absent — V3 has no group concept)
  Status: 🔴
  Decision: write-ADR-then-decide
  Effort: M
  DoD: ADR declares "groups removed" OR rebuild group registry + 3 methods + test

### PrintTemplate 12 of 67 V1 methods still missing (`compat/print-template.ts`)

TKT-313 — PrintTemplate.getSimpleHtml(data, options?) — non-async simpler HTML extractor
  Area: PrintTemplate
  V1 ref: bundle.js line 12401-12421
  V3 file: src/hiprint-v3/compat/print-template.ts (absent)
  Status: 🔴
  Decision: build-feature
  Effort: M
  DoD: vitest "getSimpleHtml returns jQuery-wrapper-equivalent string for fixtures/text-only.json"

TKT-314 — PrintTemplate.getSimpleHtmlAsync / getHtmlAsync — async with generateHTMLInterval chunking
  Area: PrintTemplate
  V1 ref: bundle.js line 12422-12459, 12463-12465
  V3 file: src/hiprint-v3/compat/print-template.ts (absent)
  Status: 🔴
  Decision: build-feature
  Effort: M
  DoD: vitest "getHtmlAsync resolves after 10ms chunk completes"

TKT-315 — PrintTemplate.getJointHtml(data, options, n) — joint multi-template HTML
  Area: PrintTemplate
  V1 ref: bundle.js line 12466-12472
  V3 file: src/hiprint-v3/compat/print-template.ts (absent)
  Status: 🔴
  Decision: defer-v2.0
  Effort: M
  DoD: upgrade-to-v3.md "getJointHtml deferred → recommend caller composes via getHtml per template"

TKT-316 — PrintTemplate.printByHtml(html) / printByHtml2(html, options) — legacy hand-written HTML print
  Area: PrintTemplate
  V1 ref: bundle.js line 12733-12764
  V3 file: src/hiprint-v3/compat/print-template.ts (absent)
  Status: 🔴
  Decision: defer-v2.0
  Effort: M
  DoD: upgrade-to-v3.md "printByHtml(2) deferred — use template.print(data) instead; document workaround"

TKT-317 — PrintTemplate.transformImg(data) — pre-render image-to-base64 batch
  Area: PrintTemplate
  V1 ref: bundle.js line 12770-12775
  V3 file: src/hiprint-v3/compat/print-template.ts (absent; pipeline handles inline)
  Status: 🔴
  Decision: defer-v2.0
  Effort: S
  DoD: ADR / upgrade-to-v3 note "transformImg replaced by inline imgToBase64 in print pipeline"

TKT-318 — PrintTemplate.clientIsOpened() — hiwebSocket open state query
  Area: PrintTemplate
  V1 ref: bundle.js line 12864-12865
  V3 file: src/hiprint-v3/compat/print-template.ts (absent; reachable via getHiWebSocket().opened)
  Status: 🔴
  Decision: fix-bug
  Effort: S
  DoD: vitest "clientIsOpened returns hiwebSocket.opened"

TKT-319 — PrintTemplate.getPrinterList() — synchronous list query
  Area: PrintTemplate
  V1 ref: bundle.js line 12866-12869
  V3 file: src/hiprint-v3/compat/print-template.ts (absent)
  Status: 🔴
  Decision: build-feature
  Effort: S
  DoD: vitest "getPrinterList returns hiwebSocket.printerList snapshot"

TKT-320 — PrintTemplate.loadAllImages(data, callback, options) — pre-warm image cache
  Area: PrintTemplate
  V1 ref: bundle.js line 12879-12897
  V3 file: src/hiprint-v3/compat/print-template.ts (absent)
  Status: 🔴
  Decision: defer-v2.0
  Effort: M
  DoD: upgrade-to-v3.md "loadAllImages deferred; inline await Promise.all in print pipeline"

TKT-321 — PrintTemplate.setOnImageChooseClick / getOnImageChooseClick — designer image picker hook
  Area: PrintTemplate
  V1 ref: bundle.js line 12910-12915
  V3 file: src/hiprint-v3/compat/print-template.ts (absent; reactive prop pattern instead)
  Status: 🔴
  Decision: defer-v2.0
  Effort: S
  DoD: upgrade-to-v3.md "use HiprintDesigner :onImageChooseClick reactive prop"

TKT-322 — PrintTemplate.distributeElements(...) returns void; V1 setElsSpace(dis, isHor) signature missing
  Area: PrintTemplate
  V1 ref: bundle.js line 13074-13099
  V3 file: src/hiprint-v3/compat/print-template.ts:773 (only distributeElements covers V3-canonical name)
  Status: 🟡
  Decision: build-feature
  Effort: S
  DoD: vitest "setElsSpace(dis:50, isHor:true) matches V1 horizontal spacing"

### buildDesigner shell (5)

TKT-323 — buildDesigner componentPanelSlot opt — V3 stub-with-warn; provide Vue slot-equivalent docs
  Area: shell
  V1 ref: bundle.js line 14870, 15119-15142
  V3 file: src/hiprint-v3/compat/build-designer.ts:449-467 (no-op stubs)
  Status: 🔴
  Decision: write-ADR-then-decide
  Effort: S
  DoD: ADR-003x explains "imperative slot APIs replaced by Vue slot props"; upgrade-to-v3.md cookbook entry

TKT-324 — buildDesigner.templateOptions drops 9 V1 sub-opts (dataMode, willOutOfBounds, qtDesigner, defaultPanelName, fontList, fields, onImageChooseClick, onPanelAddClick, onDataChanged + onUpdateError)
  Area: shell
  V1 ref: bundle.js line 15074-15080
  V3 file: src/hiprint-v3/compat/build-designer.ts:137-147, 235-248 (forwards only template/history/paginate)
  Status: 🟡
  Decision: build-feature
  Effort: L
  DoD: e2e/tests/build-designer-templateOptions.spec.ts all 9 V1 opts pass-through and trigger expected behaviour

TKT-325 — designerCtrl.getComponentContainer / getTemplateContainer / getSettingContainer (3 escape-hatch element accessors)
  Area: shell
  V1 ref: bundle.js line 15112-15114
  V3 file: src/hiprint-v3/compat/build-designer.ts (absent)
  Status: 🔴
  Decision: build-feature
  Effort: S
  DoD: vitest "getXxxContainer returns mounted ref element"

TKT-326 — designerCtrl.setLeftCollapsed/setRightCollapsed/isLeftCollapsed/isRightCollapsed — programmatic sidebar collapse API
  Area: shell
  V1 ref: bundle.js line 15115-15118
  V3 file: src/hiprint-v3/compat/build-designer.ts (sidebar resize/collapse landed Sprint 22d via HiprintDesigner.vue; programmatic API not exposed on ctrl)
  Status: 🔴
  Decision: build-feature
  Effort: M
  DoD: e2e/tests/sidebar-collapse-api.spec.ts toggle round-trip

TKT-327 — designerCtrl.setPaginationVisible(bool) — runtime pagination bar visibility
  Area: shell
  V1 ref: bundle.js line 15156-15158
  V3 file: src/hiprint-v3/compat/build-designer.ts:469-475 (no-op stub)
  Status: 🔴
  Decision: build-feature
  Effort: S
  DoD: vitest "setPaginationVisible(false) hides toolbar paginate group + paper badge"

### Hooks + dialog text (4)

TKT-328 — onCustomPaperOpen(template, api) → bool hook — allow caller to override popover
  Area: hooks
  V1 ref: bundle.js line 14281-14283
  V3 file: src/hiprint-v3/components/HiprintToolbar.vue:1017-1024 (no hook surface)
  Status: 🔴
  Decision: build-feature
  Effort: M
  DoD: vitest "onCustomPaperOpen returning false suppresses popover toggle"

TKT-329 — onClearConfirm async hook — 3-tier clear chain restoration
  Area: hooks
  V1 ref: bundle.js line 14409-14422
  V3 file: src/hiprint-v3/components/HiprintToolbar.vue:616-621
  Status: 🔴
  Decision: build-feature
  Effort: M
  DoD: e2e/tests/toolbar-clear-confirm.spec.ts "Promise<false> skips clear"

TKT-330 — Save dialog flow re-wiring — saveButton → openSaveDialog → onSaveDialogOpen(context) → openSaveDialogDefault chain
  Area: hooks
  V1 ref: bundle.js line 14502-14506, 14072-14091
  V3 file: src/hiprint-v3/components/HiprintToolbar.vue:494-515 (bypasses SaveDialog SFC)
  Status: 🟡
  Decision: fix-bug
  Effort: M
  DoD: e2e/tests/toolbar-save-flow.spec.ts asserts save name from dialog reaches onSave({name})

## 🟡 PARTIAL (7) — keep covered but needs polish

TKT-331 — onPreview / onPrint / onClear: V3 always invokes default after handler — restore V1 takeover semantics
  Area: hooks
  V1 ref: bundle.js line 14387-14439
  V3 file: src/hiprint-v3/components/HiprintToolbar.vue:540-621
  Status: 🟡
  Decision: fix-bug
  Effort: S
  DoD: vitest "previewHandler returning false skips default browserPreview"

TKT-332 — onPaperChange / onScaleChange / onAlign — emit arg-order swaps V1 `(type, tpl)` to V3 `(tpl, type)`
  Area: hooks
  V1 ref: bundle.js line 13333-13336
  V3 file: src/hiprint-v3/components/HiprintToolbar.vue:160-173, 822
  Status: 🟡
  Decision: fix-bug
  Effort: S
  DoD: emit signature matches V1 order (or write ADR explaining inversion)

TKT-333 — Dialog ARIA: deterministic `aria-labelledby="hp-business-title-<uid>"` / `hp-template-title-<uid>` / `hp-save-name-<uid>` + `aria-busy` + role="alert" on save error
  Area: dialogs
  V1 ref: bundle.js line 13727, 13985, 14102, 14108-14109
  V3 file: src/hiprint-v3/components/dialogs/* (Ant Modal provides role; deterministic IDs missing)
  Status: 🟡
  Decision: fix-bug
  Effort: M
  DoD: a11y axe-core scan clean; vitest snapshots include determined IDs

TKT-334 — Dialog text opts: 13 hardcoded labels — businessDialog{Loading,Error,Empty}Text + saveDialog{NameLabel,NamePlaceholder,NameRequiredText,ConfirmText,CancelText} + templateDialog{Loading,Error,Empty}Text + customPaperConfirmText
  Area: dialogs
  V1 ref: bundle.js line 13343-13379, 13364
  V3 file: src/hiprint-v3/components/dialogs/* + CustomPaperPopover.vue:97-98
  Status: 🟡
  Decision: build-feature
  Effort: M
  DoD: e2e/tests/dialog-text-customization.spec.ts all 13 opts override defaults

TKT-335 — Toolbar button-text props (10): businessButtonText/templateButtonText/saveButtonText/previewButtonText/printButtonText/clearButtonText/rotateButtonText/customPaperButtonText + ZH defaults
  Area: toolbar
  V1 ref: bundle.js line 13338-13369
  V3 file: src/hiprint-v3/components/HiprintToolbar.vue:349-369 (hardcoded emoji + EN)
  Status: 🟡
  Decision: build-feature
  Effort: M
  DoD: vitest "businessButtonText prop overrides default"

TKT-336 — Template dialog preview action — `data-action="preview"` button + `preview` emit + onTemplatePreview hook
  Area: dialogs
  V1 ref: bundle.js line 13823-13826, 13383
  V3 file: src/hiprint-v3/components/dialogs/TemplateDialog.vue:79-91 (3 of 4 V1 actions; preview missing)
  Status: 🟡
  Decision: build-feature
  Effort: S
  DoD: e2e "TemplateDialog preview button emits preview event + opens preview window"

TKT-337 — onBusinessSelect/onTemplateSelect/onTemplateDelete: 4-arg V1 signature `(item, data|json, template, api)` — V3 emits only `(item)`
  Area: dialogs
  V1 ref: bundle.js line 13348, 13382, 13385
  V3 file: src/hiprint-v3/components/dialogs/*.vue (single-arg emit)
  Status: 🟡
  Decision: fix-bug
  Effort: M
  DoD: vitest "BusinessDialog emit select carries (item, data, template, api)"

---

# Area 02 — Text & longText

## 🔴 MISSING (4)

TKT-338 — text `fixed:true` element bypass during pagination — for headers/footers + watermarks
  Area: text
  V1 ref: bundle.js line 1376, 9831
  V3 file: src/hiprint-v3/print/render.ts (page-break-filter present from Sprint 22b, but `fixed` flag check absent on element-level)
  Status: 🔴
  Decision: build-feature
  Effort: M
  DoD: e2e/tests/text-fixed-element.spec.ts "fixed element repeats on every page; non-fixed paginates"

TKT-339 — Coordinate-sync / WidthHeight-sync 🔗 UI toggles (TextPropertyPanel + LongTextPropertyPanel)
  Area: text
  V1 ref: bundle.js line 3617-3661
  V3 file: src/hiprint-v3/components/property/TextPropertyPanel.vue (Sprint 22c added panel but no sync icons)
  Status: 🔴
  Decision: build-feature
  Effort: S
  DoD: vitest "coordinateSync ON: typing X also updates Y for square elements"

TKT-340 — Text `textContentWrap:"nowrap"|"clip"|"ellipsis"` CSS class injection
  Area: text
  V1 ref: bundle.js line 4837-4844
  V3 file: src/hiprint-v3/components/elements/_helpers.ts (computeBaseStyle does not inject `.hiprint-text-content-wrap-<val>`)
  Status: 🔴
  Decision: build-feature
  Effort: S
  DoD: vitest "textContentWrap='ellipsis' adds class + CSS rule clips overflow"

TKT-341 — longText `lHeight` minimum-line-height when content shorter than height
  Area: longText
  V1 ref: bundle.js line 9818-9892 quirk J.9
  V3 file: src/hiprint-v3/internal/long-text-paginate.ts (Sprint 22b paginate, but no lHeight stretching)
  Status: 🔴
  Decision: build-feature
  Effort: M
  DoD: vitest "lHeight:30 expands empty longText render to 30pt baseline"

## 🟡 PARTIAL (8)

TKT-342 — text title `\r\n\t` strip at sanitization boundary (V1 9968 quirk J.1/J.2)
  Area: text
  V1 ref: bundle.js line 9968
  V3 file: src/hiprint-v3/internal/dom-helpers.ts (no replaceEnterAndNewlineAndTab)
  Status: 🟡 (inline-edit fullwidth-colon landed Sprint 22d; \r\n\t strip still missing)
  Decision: fix-bug
  Effort: S
  DoD: vitest "title with newline renders single-line; commit-edit strips newlines"

TKT-343 — text `displayLeft`/`displayTop`/`getWidth`/`getHeight` transform-aware bounding-box (rotated elements)
  Area: text
  V1 ref: bundle.js line 595-633
  V3 file: src/hiprint-v3/components/elements/_helpers.ts (literal left/top, no rotation adjust)
  Status: 🟡
  Decision: fix-bug
  Effort: M
  DoD: vitest "rotated 45deg text left displays bounding-box left, not centre"

TKT-344 — text `getFontSize` central fallback chain (9 vs V3-scattered 10.5 vs panel-14)
  Area: text
  V1 ref: bundle.js line 9966-9968
  V3 file: src/hiprint-v3/core/etypes/text.ts:20-26 vs _helpers.ts:69-71 vs property panel
  Status: 🟡
  Decision: fix-bug
  Effort: S
  DoD: vitest "missing fontSize renders with V1-faithful 9pt; consistent across all 3 paths"

TKT-345 — text `fontFamily=""` falls through to `inherit` (V1 quirk J.5)
  Area: text
  V1 ref: bundle.js line 2489
  V3 file: src/hiprint-v3/components/elements/_helpers.ts:68 (truthy check only)
  Status: 🟡
  Decision: fix-bug
  Effort: S
  DoD: vitest "empty fontFamily resolves to inherit; template fontList applied"

TKT-346 — text `lineHeight` should emit `pt` unit (V1 2454); V3 emits unitless number (treated as multiplier)
  Area: text
  V1 ref: bundle.js line 2454
  V3 file: src/hiprint-v3/components/elements/_helpers.ts:80
  Status: 🟡
  Decision: fix-bug
  Effort: S
  DoD: vitest "lineHeight=12 renders style 'line-height:12pt' not '12'"

TKT-347 — text per-side borderTop/Right/Bottom/Left split (V1 shorthand `border-top-style` vs V3 invalid `border-top: solid`)
  Area: text
  V1 ref: bundle.js line 4521
  V3 file: src/hiprint-v3/components/elements/_helpers.ts:117
  Status: 🟡
  Decision: fix-bug
  Effort: S
  DoD: vitest "borderTop:'solid' renders valid `border-top-style:solid` (width inherits)"

TKT-348 — longText `leftSpaceRemoved` default REMOVE (V1) vs V3 KEEP (CSS pre-wrap)
  Area: longText
  V1 ref: bundle.js line 9870-9872 quirk J.5
  V3 file: src/hiprint-v3/components/elements/LongTextElement.vue (no whitespace strip)
  Status: 🟡
  Decision: write-ADR-then-decide
  Effort: M
  DoD: ADR-003x decides default; vitest + e2e match

TKT-349 — longText per-line indent spans (V1 first + every newline) vs V3 first-line only
  Area: longText
  V1 ref: bundle.js line 1455-1490
  V3 file: src/hiprint-v3/components/elements/LongTextElement.vue:80
  Status: 🟡
  Decision: fix-bug
  Effort: S
  DoD: vitest "longText indent appears at every paragraph start"

---

# Area 03 — Image & html

## 🔴 MISSING (9)

TKT-350 — image `field` formatter — V1 signature (title, value, options, target) — V3 drops `target`
  Area: image
  V1 ref: bundle.js line 1534-1551
  V3 file: src/hiprint-v3/components/elements/ImageElement.vue (3-arg formatter)
  Status: 🔴
  Decision: build-feature
  Effort: M
  DoD: vitest "formatter receives jQuery-equivalent target (HTMLElement) and can DOM-poke"

TKT-351 — image `transform` (rotate deg, scale, skew) full CSS transform — V3 only handles rotate
  Area: image
  V1 ref: bundle.js line 3902-3915
  V3 file: src/hiprint-v3/components/elements/ImageElement.vue
  Status: 🔴
  Decision: build-feature
  Effort: S
  DoD: vitest "image with transform:scaleX(0.5) renders flipped"

TKT-352 — image string-source `formatter` compile via `new Function`
  Area: image
  V1 ref: bundle.js line 1534-1551
  V3 file: src/hiprint-v3/components/elements/ImageElement.vue (only function form accepted)
  Status: 🔴
  Decision: build-feature
  Effort: M
  DoD: vitest "string-source formatter compiles and runs"; security review per fix-discipline.md

TKT-353 — html `field` string-formatter compile chain (parity with TKT-352)
  Area: html
  V1 ref: bundle.js line 1534-1551
  V3 file: src/hiprint-v3/components/elements/HtmlElement.vue
  Status: 🔴
  Decision: build-feature
  Effort: M
  DoD: vitest "html string formatter compiles + XSS-safe via v-html guarded"

TKT-354 — image `fit:"contain"|"cover"|"none"|"fill"` panel UI — render landed Sprint 22a-r; panel missing toggle
  Area: image
  V1 ref: bundle.js line 4019-4035
  V3 file: src/hiprint-v3/components/property/ImagePropertyPanel.vue (no fit dropdown)
  Status: 🔴
  Decision: build-feature
  Effort: S
  DoD: vitest "fit dropdown writes opts.fit; render obeys"

TKT-355 — html `formatter` with explicit `null` return — V1 hides element; V3 renders empty wrapper
  Area: html
  V1 ref: bundle.js line 1547-1551
  V3 file: src/hiprint-v3/components/elements/HtmlElement.vue
  Status: 🔴
  Decision: fix-bug
  Effort: S
  DoD: vitest "formatter returning null hides element from page render"

TKT-356 — image `qiniu` auto-resize URL transformation (V1 quirk: appends `?imageView2/2/w/<width>`)
  Area: image
  V1 ref: bundle.js line 4063-4080
  V3 file: src/hiprint-v3/components/elements/ImageElement.vue (absent)
  Status: 🔴
  Decision: defer-v2.0
  Effort: S
  DoD: upgrade-to-v3.md "qiniu auto-resize URL transform deferred; recommend caller pre-process"

TKT-357 — html element drag XSS-safety review — V1 `dragstart` did not include element HTML in dataTransfer; V3 inherits Vue default
  Area: html
  V1 ref: bundle.js line 5042-5070
  V3 file: src/hiprint-v3/components/elements/HtmlElement.vue
  Status: 🔴
  Decision: write-ADR-then-decide
  Effort: S
  DoD: ADR-003x records "HTML element drag uses sanitized JSON only"

TKT-358 — image `width`/`height` ratio-lock for `<img>` natural-size load (V1 wired via auto-fit)
  Area: image
  V1 ref: bundle.js line 4045-4058
  V3 file: src/hiprint-v3/components/elements/ImageElement.vue
  Status: 🔴
  Decision: build-feature
  Effort: S
  DoD: vitest "loading large image without width/height uses natural aspect ratio"

## 🟡 PARTIAL (4)

TKT-359 — image `error` fallback URL on load failure (V1 onerror chain)
  Area: image
  V1 ref: bundle.js line 4081-4099
  V3 file: src/hiprint-v3/components/elements/ImageElement.vue (no onerror handler)
  Status: 🟡
  Decision: build-feature
  Effort: S
  DoD: e2e "broken image src shows opts.error fallback"

TKT-360 — html element user-input `useHtml=true` opt-in path (V1 default true, V3 default true with v-html — XSS exposure)
  Area: html
  V1 ref: bundle.js line 5071-5092
  V3 file: src/hiprint-v3/components/elements/HtmlElement.vue:70-71
  Status: 🟡
  Decision: write-ADR-then-decide
  Effort: M
  DoD: ADR-003x records V3 default + security review note; vitest XSS injection cases pass

TKT-361 — image testData base64 round-trip (V1 stored data URLs in testData; V3 accepts but no panel UI)
  Area: image
  V1 ref: bundle.js line 4101-4118
  V3 file: src/hiprint-v3/components/property/ImagePropertyPanel.vue
  Status: 🟡
  Decision: build-feature
  Effort: S
  DoD: vitest "ImagePropertyPanel allows pasting data:image/png;base64,…"

TKT-362 — html dynamic field-bound v-html — XSS-safe path missing (escape/DOMPurify)
  Area: html
  V1 ref: bundle.js line 5095-5118
  V3 file: src/hiprint-v3/components/elements/HtmlElement.vue
  Status: 🟡
  Decision: fix-bug
  Effort: M
  DoD: vitest "html element field-binding XSS payload sanitized via DOMPurify"

---

# Area 04 — Barcode & qrcode

## 🔴 MISSING (6)

TKT-363 — Path A factory presets (`defaultModule.trackingNo|barcode|qrcode`) had `type:'text'+textType:'barcode'` shape — Sprint 22b BC mapping landed; verify all 3 presets correct in production
  Area: barcode
  V1 ref: bundle.js line 10051-10122
  V3 file: src/hiprint-v3/internal/path-a-mapping.ts + core/default-provider.ts (mapped Sprint 22b, but presets need e2e visual snapshot)
  Status: 🟡
  Decision: build-feature
  Effort: S
  DoD: e2e/tests/factory-presets-barcode.spec.ts visual diff vs V1 baseline

TKT-364 — bwip-js options forwarding — `bcid|backgroundcolor|barcolor|height|width|includetext|textyalign|...` 16 fields
  Area: barcode
  V1 ref: bundle.js line 10145-10180
  V3 file: src/hiprint-v3/print/render.ts (limited opts pass-through)
  Status: 🔴
  Decision: build-feature
  Effort: M
  DoD: vitest "barcode opts.includetext=true renders text below; opts.barcolor=red recolors bars"

TKT-365 — qrcode `errorCorrectionLevel` integer-to-letter mapping (qrCodeLevel 0→'L', 1→'M', 2→'Q', 3→'H')
  Area: qrcode
  V1 ref: bundle.js line 10183-10195
  V3 file: src/hiprint-v3/internal/path-a-mapping.ts (Sprint 22b BC partial; needs ECC level coverage)
  Status: 🔴
  Decision: fix-bug
  Effort: S
  DoD: vitest "qrCodeLevel:0 maps to eclevel:L"

TKT-366 — qrcode embedded title — V1 prepends `<span>` with options.title above barcode/qrcode
  Area: qrcode
  V1 ref: bundle.js line 10198-10215
  V3 file: src/hiprint-v3/components/elements/QrcodeElement.vue (no title prepend when textType=qrcode in text element)
  Status: 🔴
  Decision: build-feature
  Effort: S
  DoD: vitest "qrcode with title:'TRACK' renders span above QR"

TKT-367 — barcode `padding`/`color`/`backgroundColor` options panel parity (Sprint 22a-r rolled back panel keys; full panel field set still incomplete)
  Area: barcode
  V1 ref: bundle.js line 10220-10240
  V3 file: src/hiprint-v3/components/property/BarcodePropertyPanel.vue (5 of 9 fields)
  Status: 🔴
  Decision: build-feature
  Effort: M
  DoD: vitest "all 9 barcode options editable in panel"

TKT-368 — qrcode `displayValue` (toggle text-below-barcode) — V3 panel uses `hideTitle` (inverted semantics; misleading)
  Area: qrcode
  V1 ref: bundle.js line 10245-10260
  V3 file: src/hiprint-v3/components/property/QrcodePropertyPanel.vue
  Status: 🔴
  Decision: fix-bug
  Effort: S
  DoD: vitest "displayValue:true shows text below QR; opts.hideTitle alias preserved for V1 JSON round-trip"

## 🟡 PARTIAL (5)

TKT-369 — barcode SVG render path (V1 used svg or img; V3 uses canvas) — print compatibility
  Area: barcode
  V1 ref: bundle.js line 10110-10125
  V3 file: src/hiprint-v3/print/render.ts
  Status: 🟡
  Decision: write-ADR-then-decide
  Effort: M
  DoD: ADR records V3 canvas decision + visual regression for PDF export

TKT-370 — barcode `barTextMode:"none"|"text"|"hex"` — V3 only handles boolean displayValue
  Area: barcode
  V1 ref: bundle.js line 10160-10172
  V3 file: src/hiprint-v3/print/render.ts
  Status: 🟡
  Decision: fix-bug
  Effort: S
  DoD: vitest "barTextMode:'hex' renders hex-encoded text"

TKT-371 — barcode `format` 18 enum mappings (CODE128 vs code128 case-sensitivity vs textType selector)
  Area: barcode
  V1 ref: bundle.js line 10128-10148
  V3 file: src/hiprint-v3/internal/path-a-mapping.ts (Sprint 22b partial)
  Status: 🟡
  Decision: fix-bug
  Effort: S
  DoD: vitest "all 18 V1 format strings map to canonical V3 bcid"

TKT-372 — qrcode `padding` (border quiet-zone) — V3 panel writes; render ignores
  Area: qrcode
  V1 ref: bundle.js line 10265-10280
  V3 file: src/hiprint-v3/print/render.ts (no padding handling)
  Status: 🟡
  Decision: fix-bug
  Effort: S
  DoD: vitest "qrcode padding:10 expands quiet zone"

TKT-373 — barcode `barWidth`/`barAutoWidth` interaction (V1 quirk: barAutoWidth string-only-true; V3 widens to boolean — acceptable widening)
  Area: barcode
  V1 ref: bundle.js line 10168-10180 quirk J.4
  V3 file: src/hiprint-v3/components/elements/BarcodeElement.vue
  Status: 🟡
  Decision: fix-bug
  Effort: S
  DoD: vitest "barAutoWidth:true (boolean) parses same as V1 'true' string"

---

# Area 05 — Shapes

## 🔴 MISSING (3)

TKT-374 — Shape `setDefault` per-etype defaults (hline/vline/rect/oval) parity audit
  Area: shapes
  V1 ref: bundle.js line 9990-10018
  V3 file: src/hiprint-v3/core/etypes/shape-lines.ts (Sprint 22d expanded; verify all default geometries)
  Status: 🔴
  Decision: fix-bug
  Effort: S
  DoD: vitest "hline default width=80 height=1; rect width=120 height=60; etc."

TKT-375 — Shape `transform`/`rotate` key alias — V3 reads `rotate`, V1 reads `transform`
  Area: shapes
  V1 ref: bundle.js line 595-599
  V3 file: src/hiprint-v3/components/elements/HlineElement.vue / VlineElement.vue / RectElement.vue / OvalElement.vue
  Status: 🔴
  Decision: fix-bug
  Effort: S
  DoD: vitest "shape with V1 JSON transform:'rotate(30deg)' renders rotated"

TKT-376 — Rect `borderRadius` panel-to-render gap (Sprint 22a-r rolled back panel ShapePropertyPanel exposed UI but RectElement render does not read)
  Area: shapes
  V1 ref: bundle.js line 4710-4730
  V3 file: src/hiprint-v3/components/elements/RectElement.vue
  Status: 🔴
  Decision: fix-bug
  Effort: S
  DoD: vitest "rect with borderRadius:8 renders rounded corners"

## (all 🟡 closed by Sprint 22a-r panel-key-drift rollback)

---

# Area 06 — Table

## 🔴 MISSING (12)

TKT-377 — Table multi-layer header column field inheritance (V1 columns[0]/[1]/[N] declarative tree)
  Area: table
  V1 ref: bundle.js line 2405-2422
  V3 file: src/hiprint-v3/internal/render-table.ts (Sprint 22b BB; multi-layer header support verified — visual regression still needed)
  Status: 🟡 (locked Sprint 22b; needs e2e)
  Decision: build-feature
  Effort: M
  DoD: e2e/tests/table-multi-layer-header.spec.ts visual diff vs V1

TKT-378 — Table rowsColumnsMerge (display:none via `td.style.display='none'`, NOT cell-omit — V1 G.3 quirk)
  Area: table
  V1 ref: bundle.js line 2440-2465
  V3 file: src/hiprint-v3/internal/render-table.ts (Sprint 22b BB locked)
  Status: 🟡
  Decision: build-feature
  Effort: M
  DoD: vitest "table with rowsColumnsMerge produces td[display:none] not omitted tds"

TKT-379 — Table column drag-reorder UI (Sprint 22d landed)
  Area: table
  V1 ref: bundle.js line 2470-2510
  V3 file: src/hiprint-v3/components/elements/table/TableElement.vue (Sprint 22d added column-reorder; needs persistence audit)
  Status: 🟡
  Decision: build-feature
  Effort: S
  DoD: e2e "drag column reorders; persistence in opts.columns[].order"

TKT-380 — Table cell `formatter` per-cell — V1 string + function forms; V3 function-only
  Area: table
  V1 ref: bundle.js line 2520-2545
  V3 file: src/hiprint-v3/components/elements/table/TableCell.vue + render-table.ts (Sprint 22b BB landed compileFormatter)
  Status: 🟡
  Decision: build-feature
  Effort: S
  DoD: vitest "cell with string formatter 'function(v){return v.toUpperCase()}' compiles + applies"

TKT-381 — Table cell `styler` per-cell — string + function forms missing
  Area: table
  V1 ref: bundle.js line 2548-2570
  V3 file: src/hiprint-v3/components/elements/table/TableCell.vue (styler partial)
  Status: 🔴
  Decision: build-feature
  Effort: S
  DoD: vitest "cell styler returns {color:'red'}; cell renders red"

TKT-382 — Table `summary` / `groupHeader` row aggregations
  Area: table
  V1 ref: bundle.js line 2580-2620
  V3 file: src/hiprint-v3/internal/render-table.ts (absent)
  Status: 🔴
  Decision: build-feature
  Effort: L
  DoD: e2e "table summary row sums numeric column"

TKT-383 — Table `column.editor` types: text|number|select|date|textarea (V1 had inline editors)
  Area: table
  V1 ref: bundle.js line 2630-2670
  V3 file: src/hiprint-v3/components/elements/table/TableCell.vue (text-only edit)
  Status: 🔴
  Decision: build-feature
  Effort: L
  DoD: e2e "column.editor:'select' renders dropdown in cell edit mode"

TKT-384 — Table `frozen` columns (V1 first-N column sticky-position)
  Area: table
  V1 ref: bundle.js line 2680-2710
  V3 file: src/hiprint-v3/internal/render-table.ts (absent)
  Status: 🔴
  Decision: defer-v2.0
  Effort: L
  DoD: upgrade-to-v3.md "frozen columns deferred"

TKT-385 — Table `tableHeaderRowHeight`/`tableBodyRowHeight` per-section row heights
  Area: table
  V1 ref: bundle.js line 2720-2735
  V3 file: src/hiprint-v3/internal/render-table.ts (uniform height only)
  Status: 🔴
  Decision: build-feature
  Effort: S
  DoD: vitest "tableHeaderRowHeight:40 produces 40pt header row; body=20 separate"

TKT-386 — Table `tableHeaderFontWeight`/`tableHeaderBackground`/`tableBodyFontFamily` (8 style overrides)
  Area: table
  V1 ref: bundle.js line 2740-2780
  V3 file: src/hiprint-v3/components/property/TablePropertyPanel.vue (Sprint 22c partial; needs all 8 fields)
  Status: 🟡
  Decision: build-feature
  Effort: M
  DoD: vitest "all 8 style override props edit through TablePropertyPanel"

TKT-387 — Table `printElementType.formatter`/`styler` fallback (per-type defaults override)
  Area: table
  V1 ref: bundle.js line 2790-2810
  V3 file: src/hiprint-v3/internal/render-table.ts
  Status: 🔴
  Decision: build-feature
  Effort: S
  DoD: vitest "tableCell with no per-cell formatter falls through to elementType.formatter"

TKT-388 — Table cell `upperCase` (Nzh Chinese-number conversion 数字→壹贰叁)
  Area: table
  V1 ref: bundle.js line 2820-2845
  V3 file: src/hiprint-v3/internal/render-table.ts (absent)
  Status: 🔴
  Decision: build-feature
  Effort: M
  DoD: vitest "cell with upperCase:true converts 123 → 壹佰贰拾叁"

TKT-389 — TableCustomCell etype — V1 supported full ad-hoc <td> markup; V3 dispatches but renders raw
  Area: table
  V1 ref: bundle.js line 2850-2880
  V3 file: src/hiprint-v3/components/elements/table/TableElement.vue + HiprintPropertyPanel.vue dispatch
  Status: 🟡
  Decision: build-feature
  Effort: M
  DoD: vitest "tableCustom cell with options.html injects sanitized DOM"

---

# Area 07 — Interactions

## 🔴 MISSING (14)

TKT-390 — Palette drop coordinate — V1 drops where cursor; V3 drops at panel (0,0)
  Area: drag-drop
  V1 ref: bundle.js line 11250-11265
  V3 file: src/hiprint-v3/interactions/drag-drop.ts:380-386
  Status: 🔴
  Decision: fix-bug
  Effort: S
  DoD: e2e "drag palette element to (100,80) on canvas; element appears at (100,80)"

TKT-391 — Position cross-hairs during drag/resize (live alignment guides + pt labels)
  Area: interactions
  V1 ref: bundle.js line 1380-1451 + 7538-7691
  V3 file: src/hiprint-v3/interactions/smart-guides.ts (Sprint 22c added smart-guides; cross-hair pt labels still missing)
  Status: 🟡
  Decision: build-feature
  Effort: M
  DoD: e2e "drag element shows live x/y pt label at cursor"

TKT-392 — Element-list floating ☰ widget (V1 absolute-positioned, draggable, separate from sidebar) — Sprint 22c added sidebar-style ElementListPanel; floating overlay variant absent
  Area: interactions
  V1 ref: bundle.js line 11679-11867
  V3 file: src/hiprint-v3/components/HiprintElementListPanel.vue (sidebar form only)
  Status: 🟡
  Decision: write-ADR-then-decide
  Effort: M
  DoD: ADR "sidebar replaces floating widget" OR add floating mode toggle

TKT-393 — User-drawn guide-lines (ruler drag-out 参考线) — Sprint 22c stores guide-lines; Sprint 22d ruler handles landed; drag-from-ruler-source absent
  Area: interactions
  V1 ref: bundle.js line 9540-9626
  V3 file: src/hiprint-v3/components/HiprintCanvas.vue:301-363 (Sprint 22c SVG render; drag source missing)
  Status: 🟡
  Decision: build-feature
  Effort: M
  DoD: e2e "drag from horizontal ruler creates horizontal guide-line"

TKT-394 — Multi-element paste preserves spatial layout (V1 incrementPosition relative to each)
  Area: interactions
  V1 ref: bundle.js line 11036-11058
  V3 file: src/hiprint-v3/interactions/keyboard.ts:153-159
  Status: 🔴
  Decision: fix-bug
  Effort: S
  DoD: vitest "Ctrl+V of 3-element clipboard preserves relative positions"

TKT-395 — Ctrl/⌘+click TOGGLE vs V1 ADD-only — write ADR or fix
  Area: interactions
  V1 ref: bundle.js line 8172-8181
  V3 file: src/hiprint-v3/interactions/selection.ts:81-86
  Status: 🔴
  Decision: write-ADR-then-decide
  Effort: S
  DoD: ADR-003x records modern-toggle decision OR revert + e2e

TKT-396 — Multi-select context-menu z-order (V1 acts on all selected; V3 acts on right-clicked only)
  Area: interactions
  V1 ref: bundle.js line 11488-11522
  V3 file: src/hiprint-v3/interactions/context-menu.ts:468-505
  Status: 🔴
  Decision: fix-bug
  Effort: S
  DoD: vitest "right-click in multi-select then 'bring to front' reorders all selected"

TKT-397 — Header/footer line drag — V1 had element handles to drag page header/footer separator
  Area: interactions
  V1 ref: bundle.js line 9628-9700
  V3 file: src/hiprint-v3/components/HiprintCanvas.vue (absent)
  Status: 🔴
  Decision: build-feature
  Effort: M
  DoD: e2e "drag header line to 100pt; subsequent elements respect header zone"

TKT-398 — Panel-bound clamping during drag (V1 clamps element to panel rect; V3 allows out-of-bounds drift)
  Area: interactions
  V1 ref: bundle.js line 8120-8150
  V3 file: src/hiprint-v3/interactions/drag-drop.ts
  Status: 🔴
  Decision: fix-bug
  Effort: S
  DoD: vitest "drag beyond panel.right clamps left to panel.right-element.width"

TKT-399 — Drag scale-awareness in resize (V1 divides delta by scale; V3 ratio off when scale!=1)
  Area: interactions
  V1 ref: bundle.js line 8302-8315
  V3 file: src/hiprint-v3/interactions/resize.ts:198-224
  Status: 🔴
  Decision: fix-bug
  Effort: S
  DoD: vitest "resize at scale=2.0; delta movement matches V1 1:1 actual-px"

TKT-400 — `hiprintTemplateDataChanged_<id>` external event bus — Pinia replaces internally but external integrators have no hook
  Area: interactions
  V1 ref: bundle.js line 10001+
  V3 file: src/hiprint-v3/stores/history.ts pushSnapshot (Sprint 22b auto-snapshot landed)
  Status: 🔴
  Decision: build-feature
  Effort: M
  DoD: vitest "subscribe via template.on('change', fn) fires on every snapshot"

TKT-401 — `PrintElementSelectEventKey_<id>` selection event bus (for non-V3 consumers)
  Area: interactions
  V1 ref: bundle.js line 12562-12564
  V3 file: src/hiprint-v3/stores/canvas.ts (Pinia ref-based; no event)
  Status: 🔴
  Decision: build-feature
  Effort: S
  DoD: vitest "template.on('select', fn) fires on selection change"

TKT-402 — Synthetic `keydown(46)` "delete-selected" trigger — internal trigger for programmatic delete
  Area: interactions
  V1 ref: bundle.js line 8112
  V3 file: src/hiprint-v3/interactions (absent; canvas.removeElement is direct)
  Status: 🔴
  Decision: defer-v2.0
  Effort: S
  DoD: upgrade-to-v3.md "synthetic delete keydown deferred; use canvas.removeElement"

TKT-403 — Arrow keys + Enter on element-list panel header keyboard nav — Sprint 22c element list landed but no keyboard nav
  Area: interactions
  V1 ref: bundle.js line 11774-11791
  V3 file: src/hiprint-v3/components/HiprintElementListPanel.vue
  Status: 🔴
  Decision: build-feature
  Effort: M
  DoD: e2e "ArrowUp/Down moves focus; Enter activates element"

## 🟡 PARTIAL (6) — Sprint 22b/22c/22d partial fixes; remaining polish

TKT-404 — `BuildCustomOptionSettingEventKey_<id>` custom-option rebuild bus
  Area: interactions
  V1 ref: bundle.js line 12565-12567
  V3 file: src/hiprint-v3/stores (absent)
  Status: 🟡 (reactive props replace partially)
  Decision: build-feature
  Effort: M
  DoD: vitest "subscribe; mutate options; bus fires"

TKT-405 — `clearSettingContainer` event on delete-element — clears property panel UI
  Area: interactions
  V1 ref: bundle.js line 1587, 1593, 12075
  V3 file: src/hiprint-v3/stores/canvas.ts (selection cleared but no explicit event)
  Status: 🟡
  Decision: fix-bug
  Effort: S
  DoD: vitest "delete element clears HiprintPropertyPanel.vue UI"

TKT-406 — Inline-edit `replaceEnterAndNewlineAndTab` sanitization on commit (Sprint 22d fullwidth-colon landed; \r\n\t strip pending)
  Area: interactions
  V1 ref: bundle.js line 790-816
  V3 file: src/hiprint-v3/components/elements/TextElement.vue (commitEdit)
  Status: 🟡
  Decision: fix-bug
  Effort: S
  DoD: vitest "commitEdit strips \r\n\t before write"

TKT-407 — Arrow nudge respects `positionLocked` element-level lock (Sprint 22b lock-semantics module exists; keyboard.ts skips check)
  Area: interactions
  V1 ref: bundle.js line 996-1027
  V3 file: src/hiprint-v3/interactions/keyboard.ts:121-124
  Status: 🟡
  Decision: fix-bug
  Effort: S
  DoD: vitest "arrow on positionLocked element no-ops"

TKT-408 — Outside-click custom-paper popover close — Sprint 22f click bridge; outside-click document listener still absent
  Area: interactions
  V1 ref: bundle.js line 14303-14307
  V3 file: src/hiprint-v3/components/CustomPaperPopover.vue
  Status: 🟡
  Decision: fix-bug
  Effort: S
  DoD: e2e "click outside popover closes it"

TKT-409 — Esc on custom-paper popover (focus return to trigger button)
  Area: interactions
  V1 ref: bundle.js line 14294-14300
  V3 file: src/hiprint-v3/components/CustomPaperPopover.vue
  Status: 🟡
  Decision: fix-bug
  Effort: S
  DoD: e2e "Esc closes popover + focus returns to trigger"

---

# Area 08 — Styles

## 🔴 MISSING (7)

TKT-410 — `hiprint-toolbar-group` / `hiprint-toolbar-business-select` / `hiprint-toolbar-template-select` / `hiprint-toolbar-scale` / `hiprint-toolbar-align` / `hiprint-toolbar-extra` group wrappers (6 classes)
  Area: styles
  V1 ref: bundle.js line 14211-14702
  V3 file: src/hiprint-v3/components/HiprintToolbar.vue (no group wrappers; uses inline flex separators)
  Status: 🔴
  Decision: fix-bug
  Effort: S
  DoD: vitest "toolbar renders 6 V1 group classes for E2E selectors"

TKT-411 — `hiprint-toolbar-btn-primary` / `hiprint-toolbar-btn-danger` / `hiprint-toolbar-icon-btn` modifier classes
  Area: styles
  V1 ref: bundle.js line 14323, 14402, 14433
  V3 file: src/hiprint-v3/components/HiprintToolbar.vue (Sprint 22f BEM bridge partial; modifiers missing)
  Status: 🔴
  Decision: fix-bug
  Effort: S
  DoD: vitest "print/save button has -primary; clear has -danger; zoom/icon-buttons have -icon-btn"

TKT-412 — `body.hiprint-guide-dragging` body class during guide drag
  Area: styles
  V1 ref: bundle.js line 9610
  V3 file: src/hiprint-v3/interactions/* (absent — Sprint 22c stores guides but no body class)
  Status: 🔴
  Decision: fix-bug
  Effort: S
  DoD: vitest "body has class during guide drag"

TKT-413 — `body.hiprint-el-list-dragging` body class during element-list drag (V1 had floating panel)
  Area: styles
  V1 ref: bundle.js line 11759
  V3 file: src/hiprint-v3/components/HiprintElementListPanel.vue (sidebar form; no drag at all)
  Status: 🔴
  Decision: defer-v2.0
  Effort: S
  DoD: ADR records "floating element-list dropped"

TKT-414 — `hiprint-toolbar-template-mask` / `hiprint-toolbar-save-mask` Ant Modal mask custom class compat
  Area: styles
  V1 ref: bundle.js line 13728, 13986, 14103
  V3 file: src/hiprint-v3/components/dialogs/* (Ant Modal mask uses `.ant-modal-mask`)
  Status: 🔴
  Decision: fix-bug
  Effort: S
  DoD: vitest "dialogs include V1 mask class via wrapClassName"

TKT-415 — `hiprint-toolbar-template-{header,body,footer,title,state}` + state classes `.loading/.error/.empty`
  Area: styles
  V1 ref: bundle.js line 13730-13737
  V3 file: src/hiprint-v3/components/dialogs/* (Ant Modal slots; state classes only via Ant Spin)
  Status: 🔴
  Decision: fix-bug
  Effort: M
  DoD: vitest "BusinessDialog body has .empty class when items=[]"

TKT-416 — `hiprint-toolbar-popover-content` / `hiprint-toolbar-input` / `hiprint-toolbar-custom-wrap` CustomPaper inner classes
  Area: styles
  V1 ref: bundle.js line 14260-14308
  V3 file: src/hiprint-v3/components/CustomPaperPopover.vue (Sprint 22f wrap class added; inner classes still missing)
  Status: 🔴
  Decision: fix-bug
  Effort: S
  DoD: vitest "popover content + inputs + wrap carry V1 class names"

## 🟡 PARTIAL (2)

TKT-417 — V3 uses `.is-active` for chips/toggles; V1 uses `.active` (Sprint 22f BEM bridge added; aliasing not fully bidirectional)
  Area: styles
  V1 ref: bundle.js line 14244, 14264, 14269-14270
  V3 file: src/hiprint-v3/components/HiprintToolbar.vue:1317-1376
  Status: 🟡
  Decision: fix-bug
  Effort: S
  DoD: vitest "active state element matches both .active AND .is-active selectors"

TKT-418 — i18n ZH defaults for all toolbar aria-labels (V1 缩小/放大/左对齐/etc.; V3 hardcoded English)
  Area: styles
  V1 ref: bundle.js line 14323, 14324, 14374, 14460, 14456
  V3 file: src/hiprint-v3/components/HiprintToolbar.vue:1128, 1149, 1189-1248, 1104, 1052-1057
  Status: 🟡
  Decision: build-feature
  Effort: M
  DoD: e2e "toolbar in zh locale shows 缩小/放大/添加分页 aria-labels"

---

# Deferred (188) — Out of v2.0.0 scope, explicit decision

## Architectural ⏸️ deferred categories

These are intentionally out-of-scope per ADRs 0011 (V3 modern UI) and 0029 (quirks rollup). Documented in `docs/upgrade-to-v3.md` migration matrix.

- **toolbarCtrl 21 missing methods of dialog-handler/setter family** (rows 23-30, 33-40 in `01-toolbar-and-shell.md` §8A.2). Replaced by reactive Vue props per ADR-0011.
- **buildDesigner 7 resize-bar opts** (leftWidth/rightWidth/leftMinWidth/leftMaxWidth/rightMinWidth/rightMaxWidth/designerId). Sprint 22d sidebar resize via component opts replaces them.
- **PrintTemplate internal toPdf helpers** (createTempContainer/removeTempContainer/getTempContainer/svg2canvas/parentWidthHeight/xhrLoadImage). Replaced by jspdf.html() pipeline.
- **PrintTemplate event-bus accessors** (getPrintElementSelectEventKey/getBuildCustomOptionSettingEventKey). Pinia reactivity replaces.
- **23 toolbarCtrl group/button registry methods** (group concept removed per ADR-0011).
- **5 V1 image XSS vectors** (3a-3g). Hardened-by-design in V3; legacy template JSON shape preserved via `.loose()` schema.
- **5 quirks ADR-decided** (ADR-0024 empty-canvas-deselect, ADR-0025 tab-cycles, ADR-0026 arrow-nudge step, ADR-0027 shift-resize aspect lock, ADR-0028 ctrl-z input guard).
- **5 V1-faithful quirks preserved** (Sprint 22b/22c locked: table `<td>` in `<thead>` P.7, rowsColumnsMerge display:none G.3, lineHeight handling, longText pagination J.3 XSS hardening, field-resolve `a != null` PM-002 R3).
- **Style class 6 floating-element-list classes** (per ADR-0011 replaces with sidebar).
- **Style class 38 jQuery-plugin specific** (minicolors/hireizeable/auto-submit). Vue reactivity replaces.
- **Style class 50 ant-design vs V1 dialog DOM tree** (replaced; Sprint 22f wrap class compat bridges 95%).
- **interactions 46 jQuery-namespace event handlers** (V3 uses native event listeners with cleanup refs per ADR-0011).
- **table 19 V1 frozen-column / column-export / row-virtual-scroll** features (P3 backlog).
- **shapes 8 hireizeable resize handle defaults** (V3 uses interact.js).
- **barcode/qrcode 7 jQuery legacy renderer paths** (V3 canvas-only).

---

# Validation

```bash
ls -la docs/V3-PARITY-MATRIX/REMAINING-GAPS.md       # exists
wc -l docs/V3-PARITY-MATRIX/REMAINING-GAPS.md        # ≥ 400 LoC
grep -c "TKT-" docs/V3-PARITY-MATRIX/REMAINING-GAPS.md  # ≥ 88
```

Expected after Sprint 22g zero-out completion: 115 actionable tickets reduced to ~72 (closing GA/GB/GC concurrent work).

---

# Sprint 22h hand-off recommendation

1. **Close the 7 toolbarCtrl provider/dialog-handler tickets (TKT-301..310)** — single PR, ~12h.
2. **Close 5 PrintTemplate quick wins** (TKT-318/319/322 + simple stubs) — ~6h.
3. **Close 8 dialog ARIA/text-customization tickets (TKT-333..337)** — ~10h.
4. **Decide via ADR**: TKT-300 (chip-list), TKT-348 (leftSpaceRemoved), TKT-360 (html v-html default), TKT-392 (floating widget), TKT-395 (Ctrl+click toggle).
5. Push remaining ~80 to Sprint 22i+.

End of file.
