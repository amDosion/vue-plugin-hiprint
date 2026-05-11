# V3 Parity Matrix — Toolbar & Shell

**Document Purpose**: Exhaustive V1 ↔ V3 parity matrix for the toolbar, dialogs, keyboard, shell, public API, PrintTemplate methods, and configuration. Scored row-by-row against the V1 inventory (`docs/V1-INVENTORY/toolbar-and-shell.md`).

**Last Updated**: 2026-05-11
**V1 inventory**: 1530 lines, 303 V1 line citations
**V3 source root**: `src/hiprint-v3/`

## Summary

V3 ships a partial reimagining of the V1 toolbar that fundamentally diverges on three axes. **(1)** UI surface is wider than V1 (Undo/Redo/PDF/Grid/Ruler/Pagination/Remove-Panel buttons live in V3's toolbar that V1 reserves for keyboard / context-menu / NOT-IN-V1) — this is a category of ⚠️ VIOLATIONs that change the user-visible toolbar surface relative to V1. **(2)** Default paper list is wrong (V3 = A3/A4/A5/B4/B5; V1 = A3/A4/A5/B3/B4/B5 — V3 silently dropped B3 and rounded all V1 fractional mm dimensions). **(3)** PrintTemplate compat surface is 14 of 67 V1 methods (~21%), buildToolbar opts coverage is 30 of 76 (~39%), and toolbarCtrl is **deleted by design** (V3 commit message claims "pure V3 surface, no V1 imperative toolbar API") — this is a load-bearing intentional break (`compat/build-designer.ts:18-22`), and the dialog hook lifecycle (open/close/select/error pairs) is gone with it.

The dialog SFCs themselves (`BusinessDialog.vue` / `TemplateDialog.vue` / `SaveDialog.vue`) are reactive Ant-Design ports but lack the V1 lifecycle hooks, providers/loaders pattern, and the `_safeCall(opts.onXxx)` callback wiring needed for V1 contract parity. The TB-006 pagination strip and the default paper list belong on the highest-priority rollback list.

### Scorecard

| Status | Count | Notes |
|---|---|---|
| ✅ DONE | 47 | byte-equivalent or feature-equivalent |
| 🟡 PARTIAL | 39 | shape present, details/contract mismatch |
| 🔴 MISSING | 134 | no equivalent at all |
| ⚠️ VIOLATION | 18 | V3 does different behavior from V1 (rollback / rework) |
| ⏸️ DEFERRED | 5 | explicitly out of V3 compat by design |
| **TOTAL** | **243** | rows scored |

---

## Section 1: Toolbar Buttons

V3 root file: `src/hiprint-v3/components/HiprintToolbar.vue` (1402 lines).

### 1.1 — 1.26 Toolbar Button rows

| V1 ref | V1 behavior | V3 status | V3 file:line | Diff notes | Effort |
|---|---|---|---|---|---|
| [V1 14211-14221] §1.1 businessSelect button | Registered button with key `businessSelect`, group `businessSelect`, `_safeCall(onBusinessClick)` then `openBusinessDialog()` | 🟡 PARTIAL | `HiprintToolbar.vue:929-939, 839-841` | Button exists but only emits `businessSelectClick`; no `_safeCall(onBusinessClick)` pre-hook, no built-in `openBusinessDialog()` integration — parent must own dialog state | M |
| [V1 13338] businessButtonText opt | Default `i18n.__('业务选择')`; configurable label | 🔴 MISSING | n/a | `HiprintToolbar.vue:369` hardcodes `'🏷 Business'` label; no `businessButtonText` prop | S |
| [V1 13337] showBusinessSelect (default true) | V1 default `true` | ⚠️ VIOLATION | `HiprintToolbar.vue:260` | V3 defaults `showBusinessSelect: false`. Breaks default UI parity | S |
| [V1 14228-14232] §1.2 templateSelect button | Button with `openTemplateDialog()` direct trigger, fires `onTemplateDialogOpen({...})` hook | 🟡 PARTIAL | `HiprintToolbar.vue:918-928, 835-837` | Emits `templateSelectClick`; no `onTemplateDialogOpen({type, payload, openDefault, closeDefault})` context object; parent must wire `templateDialogOpen` ref | M |
| [V1 13360] templateButtonText | Default `i18n.__('选择模版')` | 🔴 MISSING | n/a | Hardcoded `'📋 Templates'` in `defaultLabels` | S |
| [V1 13353] showTemplateSelect | Default `true` | ⚠️ VIOLATION | `HiprintToolbar.vue:259` | V3 defaults `showTemplateSelect: false` | S |
| [V1 14502-14506] §1.3 save button | Click → `triggerSave(e)` → `openSaveDialog(undefined, e)` → `onSaveDialogOpen(context)` → `openSaveDialogDefault()` | 🟡 PARTIAL | `HiprintToolbar.vue:494-515` | V3 directly invokes `tpl.save()` or `saveHandler`; **no save dialog flow** — `SaveDialog.vue` exists but is not wired through toolbar's save button | M |
| [V1 14086] onSave hook signature `(template, json, event, api, {name})` | 5-arg V1 signature | 🟡 PARTIAL | `HiprintToolbar.vue:296-296, 514` | V3 emits with 5 args but `event=null`, `api=undefined`, `ctx={}` always; not threading through name from save dialog (because dialog isn't wired) | S |
| [V1 14198-14207] toolbarCtrl.triggerSave({skipPrompt, name}) | Programmatic trigger | 🔴 MISSING | n/a | No `triggerSave` on V3 toolbar controller; toolbarCtrl deleted entirely (`build-toolbar.ts:44-57`) | M |
| [V1 13593-13610] downloadTemplateJson default save | Default save = `Blob` + ephemeral `<a>` click + `URL.createObjectURL` | ✅ DONE | `HiprintToolbar.vue:521-538` | Identical pattern, slightly different filename default (`'template.json'` vs V1 `name+'.json'` from dialog) | n/a |
| [V1 13369] saveButtonText | Default `i18n.__('保存')` | 🔴 MISSING | n/a | Hardcoded `'💾 Save'` | S |
| [V1 14387-14393] §1.4 preview button | Click → `_safeCall(onPreview)` else `console.warn('preview button clicked but opts.onPreview not provided')` | 🟡 PARTIAL | `HiprintToolbar.vue:540-585` | V3 has its OWN default preview (opens `window.open` with rendered HTML + `window.print()`) — V1 has NO default preview, only the warn | ⚠️ subtle violation; PARTIAL because preview still works | M |
| [V1 13366] previewButtonText | Default `i18n.__('预览')` | 🔴 MISSING | n/a | Hardcoded `'👁 Preview'` | S |
| [V1 13326] showPreview (default true) | Default true | ✅ DONE | `HiprintToolbar.vue:244` | Matches V1 default | n/a |
| [V1 14433-14439] §1.5 print button | Click → `_safeCall(onPrint)` else `console.warn` | 🟡 PARTIAL | `HiprintToolbar.vue:587-607` | V3 has built-in default `runBrowserPrint()` via `browserPrint(json)` — V1 has no default print, only the warn | M |
| [V1 14433] print button class `hiprint-toolbar-btn hiprint-toolbar-btn-primary` | Primary blue class | 🔴 MISSING | `HiprintToolbar.vue:966` | V3 class is `hiprint-toolbar-btn` only — no `-primary` modifier | S |
| [V1 13368] printButtonText | Default `i18n.__('打印')` | 🔴 MISSING | n/a | Hardcoded `'🖨 Print'` | S |
| [V1 126-128] §1.6 PDF export button — **NOT IN V1** | V1 has zero matches for `pdfButtonText|showPdf` — PDF is only via `template.toPdf()` API | ⚠️ VIOLATION | `HiprintToolbar.vue:609-614, 974-984` | V3 ships a `pdf` button (default visible, `showPdf: true`) calling `downloadPdf(json)`. **V1 has no such button — adding it to the toolbar surface = parity violation.** | S (remove button) |
| [V1 14402-14425] §1.7 clear button (3-tier: onClear → onClearConfirm → native confirm) | Click chain: `_safeCall(onClear)` totally takes over; else `onClearConfirm → Promise<bool>`; else native `confirm('是否确认清空?')` | 🟡 PARTIAL | `HiprintToolbar.vue:616-621` | V3 just calls `tpl.clear()` and emits — no confirm, no 3-tier hook chain, no `onClearConfirm` | L |
| [V1 14402] clear button class `hiprint-toolbar-btn hiprint-toolbar-btn-danger` (red) | Red danger class | 🔴 MISSING | `HiprintToolbar.vue:988` | V3 uses `hiprint-toolbar-btn` only | S |
| [V1 13367] clearButtonText | Default `i18n.__('清空')` | 🔴 MISSING | n/a | Hardcoded `'🗑 Clear'` | S |
| [V1 14409-14422] onClearConfirm async hook | `(template) → Promise<bool>` truthy = run clear, with try/Promise.resolve | 🔴 MISSING | n/a | No `onClearConfirm` prop or emit; clear is immediate | M |
| [V1 149-151] §1.8 Undo button — **NOT IN V1 TOOLBAR** | V1 has zero matches for `undoButtonText|showUndo` — Ctrl+Z keyboard only | ⚠️ VIOLATION | `HiprintToolbar.vue:241, 893-903` | V3 ships an `undo` button (default visible, `showUndo: true`). Adds button surface V1 doesn't have. | S (remove) |
| [V1 153-155] §1.9 Redo button — **NOT IN V1 TOOLBAR** | Zero matches for `redoButtonText|showRedo` — Ctrl+Shift+Z keyboard only | ⚠️ VIOLATION | `HiprintToolbar.vue:242, 904-914` | V3 ships `redo` button (`showRedo: true`) | S (remove) |
| [V1 14457-14492] §1.10 Add Panel button (`panels:add`) | Button key `panels:add`, group `panels`, class `hiprint-toolbar-panel-manager-add`, default text `'+'`, title `添加分页`, aria-label `添加分页`. Visibility: `showPanelManager` default **`false`** | 🟡 PARTIAL | `HiprintToolbar.vue:1099-1109` | Button exists with `+` label and `Add panel` aria-label. **`showPanelManager` default differs**: V3 = `true` ([line 251]), V1 = `false` — this is **⚠️ VIOLATION**. Also no `title` attribute. No 'panels:add' registry key (V3 toolbarCtrl deleted). | S (default flip) |
| [V1 14454] panel manager label text "分页" | `panelManagerLabel` default `i18n.__('分页')` | 🟡 PARTIAL | `HiprintToolbar.vue:274` | V3 default is empty string `''` (no label rendered unless caller passes one). V1 always rendered label | S |
| [V1 13355-13357] showPanelManager default `false` | V1 uniquely opt-in | ⚠️ VIOLATION | `HiprintToolbar.vue:251` | V3 defaults `true` ("V1 parity: panel-manager + custom-paper visible by default") — comment is **factually wrong**; V1 was opt-in | S |
| [V1 174-176] §1.11 Remove Panel button — **NOT IN V1 TOOLBAR** | No `removePanelButtonText|showRemovePanel|deletePanelButtonText` in V1 — programmatic only via `template.deletePanel(idx)` | ⚠️ VIOLATION | `HiprintToolbar.vue:1110-1120` | V3 ships `removePanel` button in toolbar with `aria-label="Remove panel"`. Adds button surface V1 doesn't have | S |
| [V1 12500-12515] template.deletePanel invariant "must keep ≥1 panel" | warn + early return if `length <= 1` | 🟡 PARTIAL | `canvas.ts:186-191` | V3 canvas.removePanel has same invariant. But V3 toolbar `:disabled` only checks `canvas.panels.length <= 1` (good); however the underlying `template.deletePanel(idx)` method on PrintTemplate compat doesn't exist at all — only canvas.removePanel | n/a (invariant satisfied) |
| [V1 14323-14330] §1.12 Zoom Out button | Key `scale:zoomOut`, group `scale`, label `−`, title `缩小`, aria-label `缩小`, click clamps via `Math.max(scaleMin)` then `template.zoom`, `updateScaleLabel`, `_safeCall(onScaleChange)` | ✅ DONE | `HiprintToolbar.vue:1124-1133, 715-723` | Button exists; default label `−`; `aria-label="Zoom out"` (English, not 缩小); `isDisabled` clamps via scaleMin; `fireScaleChange` emit. Label language is English-only, not i18n | n/a (functional ok, label language nit) |
| [V1 14318-14321] §1.13 Zoom Reset Label (display only, not button) | `<span class="hiprint-toolbar-scale-label">100%</span>`, updates via `updateScaleLabel()`, **not clickable** | ⚠️ VIOLATION | `HiprintToolbar.vue:1135-1143` | V3 makes it a clickable button (`handleZoomReset` resets to 1.0). V1 had explicitly "no click affordance" ([V1 14318]) | S (revert to span / or accept as enhancement) |
| [V1 14323-14336] §1.14 Zoom In button | Key `scale:zoomIn`, label `+`, title/aria `放大`, click clamps via `Math.min(scaleMax)` | ✅ DONE | `HiprintToolbar.vue:1144-1154, 715-718` | Button exists; aria-label `Zoom in` (English); `isDisabled` clamps | n/a |
| [V1 14243-14251] §1.15 Paper buttons (one per paperTypes entry) | One button per paper-type key, classes `hiprint-toolbar-btn` + `.active` on selected, `data-paper`, `aria-pressed`, click switches `curPaper`, calls `template.setPaper(w, h)` and `_safeCall(opts.onPaperChange, [name, size])` | 🟡 PARTIAL | `HiprintToolbar.vue:999-1016, 687-706` | V3 renders a **single `<select>` dropdown** not individual buttons. No `data-paper` attr, no `aria-pressed`. `onPaperChange` emit happens via prop signature. **Different DOM surface** = visual + a11y violation. | M |
| [V1 13296-13303] default _defaultPaperTypes (A3/A4/A5/B3/B4/B5) | A3: 420×296.6, A4: 210×296.6, A5: 210×147.6, B3: 500×352.6, B4: 250×352.6, B5: 250×175.6 (all in mm) | ⚠️ VIOLATION | `HiprintToolbar.vue:226-232` | V3 default = A3 (297×420), A4 (210×297), A5 (148×210), B4 (250×353), B5 (176×250). **B3 missing**, **A3 wired wrong** (V3 swaps width/height — V1 has 420×296.6 portrait-bias, V3 has 297×420), all V1 fractional dims rounded. | S |
| [V1 13317] defaultPaper 'A4' | Initially-active paper | ✅ DONE | `HiprintToolbar.vue:233` | matches | n/a |
| [V1 14345-14349] §1.16 Rotate Paper button | Key `rotate`, group `rotate`, label `↻ 旋转` (glyph prepended), click → `template.rotatePaper()` + `_safeCall(onRotate, [template])` | 🟡 PARTIAL | `HiprintToolbar.vue:1035-1045, 734-750` | Button exists with `⟲ Rotate` label. **Calls `canvas.updatePanel` directly (swaps panel.width/height) not `template.rotatePaper()`**. No registered button key (toolbarCtrl deleted). Functionally equivalent on canvas state but bypasses compat layer | S |
| [V1 13365] rotateButtonText | Default `i18n.__('旋转')` w/ `↻ ` glyph prepended | 🔴 MISSING | n/a | Hardcoded `'⟲ Rotate'` | S |
| [V1 12480-12482] template.rotatePaper() | Method on PrintTemplate | 🔴 MISSING | n/a | `print-template.ts` has no `rotatePaper` method | S |
| [V1 14258-14292] §1.17 Custom Paper Button (`paper:custom`) | Key `paper:custom`, `data-paper="custom"`, `aria-haspopup="dialog"`, `aria-expanded`, click → `_safeCall(onCustomPaperOpen) === false ? skip : $customPopover.toggle()` + sync aria-expanded + focus first input via `setTimeout(0)` | 🟡 PARTIAL | `HiprintToolbar.vue:1017-1024` | Button exists with `⚙` glyph + `aria-label="Custom paper size"` + `aria-expanded`. **Missing**: `aria-haspopup="dialog"`, `data-paper="custom"`, focus first input on open, `onCustomPaperOpen` hook to allow business override | M |
| [V1 13363] customPaperButtonText | Default `i18n.__('自定义')` | 🔴 MISSING | n/a | Hardcoded `'⚙'` | S |
| [V1 14281-14283] onCustomPaperOpen hook | `(template, api) → bool` return false to suppress built-in popover | 🔴 MISSING | n/a | No prop, no emit | M |
| [V1 14258] aria-haspopup="dialog" | A11y requirement | 🔴 MISSING | `HiprintToolbar.vue:1017-1024` | Only `aria-expanded` set | S |
| [V1 14264-14276] §1.18 Custom Paper Confirm Button | Key `paper:customConfirm`, label `i18n.__('确定')`, click validates `w > 0 && h > 0` then `curPaper='custom'`, swap `.active` to `$customBtn`, `template.setPaper(w, h)`, `_safeCall(onPaperChange, ['custom', {width, height}])` | 🟡 PARTIAL | `CustomPaperPopover.vue:57-59`, `HiprintToolbar.vue:670-685` | Apply button works; `confirmText` hardcoded `'Apply'`; **does NOT validate `w > 0 && h > 0`** (V1 silently rejected; V3 accepts any number); calls `canvas.updatePanel` not `template.setPaper`; converts mm→pt (V1 stored mm); no `onPaperChange` emit on custom confirm | M |
| [V1 13364] customPaperConfirmText | Default `i18n.__('确定')` | 🔴 MISSING | n/a | Hardcoded `'Apply'` | S |
| [V1 14455-14483] §1.19 Panel Manager Dropdown (`<select>`) | `<select class="hiprint-toolbar-panel-manager-select">` with `aria-label="选择分页"`, item source `printPanels[i].name`, change → `template.selectPanel(idx)`, refresh on mousedown+focus | ⚠️ VIOLATION | `HiprintToolbar.vue:1052-1072` | V3 renders **a chip list of buttons (TB-003)** instead of `<select>`. Different DOM surface, different a11y semantics. Each chip has `aria-pressed`; no `<select>` element at all | M |
| [V1 14470-14471] item label fallback "第N页" | Use `panel.name` else `'第' + (i+1) + '页'` | 🟡 PARTIAL | `HiprintToolbar.vue:1070` | V3 falls back to `(i+1)` (no `第`/`页` prefix) | S |
| [V1 313-315] §1.20 Grid Toggle Button — **NOT IN V1 TOOLBAR** | Zero matches for `gridButtonText|showGrid|gridToggle` | ⚠️ VIOLATION | `HiprintToolbar.vue:1158-1169` | V3 ships `gridToggle` button (default visible) | S (remove) |
| [V1 317-319] §1.21 Ruler Toggle Button — **NOT IN V1 TOOLBAR** | Zero matches for `ruler|showRuler` | ⚠️ VIOLATION | `HiprintToolbar.vue:1170-1181` | V3 ships `rulerToggle` button (default visible) | S (remove) |
| [V1 14358-14367, 14371-14378] §1.22 Alignment Buttons (8 items) | Group `align`, 8 buttons (left/horizontalCenter/right/top/verticalCenter/bottom/distributeHorizontal/distributeVertical), icons `⫷⫿⫸⫠⫥⫡⇔⇕`, click `template.alignElements(item.type)` + `_safeCall(onAlign)` | 🟡 PARTIAL | `HiprintToolbar.vue:1185-1250, 752-823` | V3 ships **6 buttons not 8** — drops `distributeHorizontal` + `distributeVertical`. V3 uses different type names: `left/center/right/top/middle/bottom` instead of V1's `left/horizontalCenter/right/top/verticalCenter/bottom`. Inline alignment math (not delegating to `template.alignElements`) | M |
| [V1 14373-14374] align button class `hiprint-toolbar-btn hiprint-toolbar-icon-btn` (icon-only) | Icon-only modifier class | 🔴 MISSING | `HiprintToolbar.vue:1188-1248` | V3 just uses `hiprint-toolbar-btn`; no icon-only modifier | S |
| [V1 14365-14366] distributeHorizontal/distributeVertical | Default included | 🔴 MISSING | n/a | Not in V3 toolbar at all | M |
| [V1 12483-12485] template.alignElements(type) | Public method | 🔴 MISSING | n/a | No `alignElements` method on `print-template.ts` compat class | M |
| [V1 11626-11678] PrintPanel.alignElements — 8 types | Includes `distributeHorizontal/distributeVertical` requiring ≥3 selected | 🔴 MISSING | n/a | V3 inline align math handles 6 types only, no distribute | M |
| [V1 13336, 14377] onAlign hook | `(type: string, template) → void` | 🟡 PARTIAL | `HiprintToolbar.vue:823, 113-114` | Emit signature `(tpl, type)` — V3 swaps arg order vs V1 `(type, template)` | S |
| [V1 351-352] §1.23 Distribute Buttons | Same as 1.22 entries 7-8 | 🔴 MISSING | n/a | Not implemented | M |
| [V1 353-355] §1.24 Bring-to-Front / Send-to-Back — **NOT IN V1 TOOLBAR** | Zero matches; keyboard-only via Ctrl+]/[/Shift+] | ✅ DONE | `interactions/context-menu.ts:374-382` | V3 has context-menu items (right matches V1 surface). But **V3 keyboard.ts does NOT bind Ctrl+]/[/Shift+]/Shift+[** for z-index ([keyboard.ts:233-308]) | n/a |
| [V1 357-359] §1.25 Lock / Unlock — **NOT IN V1 TOOLBAR** | Zero matches; `positionLocked` is per-element opt only | ✅ DONE | n/a | V3 toolbar also has no lock button; OK | n/a |
| [V1 14520-14554, 14716-14718] §1.26 ExtraButtons API + renderExtra | `extraButtons[]` with 11 fields (key/label/text/icon/html/type/className/title/visible/disabled/onClick); `renderExtra(api)` after group append | 🟡 PARTIAL | `HiprintToolbar.vue:91-103, 870-891, 1252-1269, 843-851` | V3 supports key/label/icon/type/className/visible/disabled/html/onClick (9 of 11). **Missing**: `text` (alias for label), `title` attribute, function-form `visible/disabled` evaluation at render. **`renderExtra(api)` callback completely missing** | M |
| [V1 14525-14528] type='primary'/'danger' adds class | `hiprint-toolbar-btn-primary` / `hiprint-toolbar-btn-danger` | 🟡 PARTIAL | `HiprintToolbar.vue:879` | Just applies `btn.className`; no automatic class derivation from `type` prop | S |
| [V1 14522-14523] visible function `(template, api) → bool` | Evaluated at render | 🔴 MISSING | n/a | V3 only supports boolean visible | S |
| [V1 14544-14545] disabled function `(template, api) → bool` | Evaluated at render (not re-evaluated on state change — V1 known limitation) | 🔴 MISSING | n/a | V3 only supports boolean disabled | S |
| [V1 13387, 14513-14517] extraPosition 'start'/'end' default 'end' | Position the extras group at start/end | ✅ DONE | `HiprintToolbar.vue:279, 871-891, 1253-1269` | Implemented; default 'end' | n/a |
| [V1 13389, 14716-14718] renderExtra(toolbarApi) callback | Called after extraButtons group; api has toolbar/container/template/getToolbarCtrl/addGroup/createButton | 🔴 MISSING | n/a | Not implemented (toolbarApi itself deleted) | M |
| [V1 14565-14567] toolbarApi.addGroup($el, position) | Runtime group insertion | 🔴 MISSING | n/a | No toolbar API exposed | M |
| [V1 14568-14570] toolbarApi.createButton(btnOpt) | Runtime button creation | 🔴 MISSING | n/a | No toolbar API exposed | M |

---

## Section 2: Dialogs

V3 root: `src/hiprint-v3/components/dialogs/` (3 SFCs, 743 lines total).

### 2.1 Business Selection Dialog

| V1 ref | V1 behavior | V3 status | V3 file:line | Diff notes | Effort |
|---|---|---|---|---|---|
| [V1 13727] Root wrap class `hiprint-toolbar-business-dialog-wrap` | DOM class | ⚠️ VIOLATION | `BusinessDialog.vue:1-256` | V3 uses Ant Design `<a-modal>` — no `hiprint-toolbar-business-dialog-wrap` class; different DOM tree. Any E2E selector hard-coded to V1 class will break | M |
| [V1 13727] ARIA role/modal/labelledby/tabindex on wrap | `role="dialog" aria-modal="true" aria-labelledby="hp-business-title-<uid>" tabindex="-1"` | 🟡 PARTIAL | `BusinessDialog.vue` | Ant `<a-modal>` provides `role="dialog"` and focus trap natively. **Missing**: deterministic `aria-labelledby="hp-business-title-<uid>"` ID convention | S |
| [V1 13728-13729] Inner mask + dialog layers | `.hiprint-toolbar-template-mask` (clickable backdrop) + `.hiprint-toolbar-template-dialog` (panel) | ⚠️ VIOLATION | n/a | Ant Modal provides its own mask DOM (`.ant-modal-mask`); class names differ | M |
| [V1 13731, 13614, 13342] businessDialogTitle default "选择业务" | Configurable | 🟡 PARTIAL | `BusinessDialog.vue:69` | V3 default is `'业务场景选择'` (different default text) | S |
| [V1 13735, 13736] Footer Buttons "刷新" / "关闭" | Refresh + Close buttons in footer with class `js-business-close` | 🟡 PARTIAL | `BusinessDialog.vue` | Has refresh emit; Ant Modal's footer slot replaced; CSS class `js-business-close` not present | S |
| [V1 13618, 13344] Loading state with text "业务加载中..." | `<div class="hiprint-toolbar-template-state loading">` | 🟡 PARTIAL | `BusinessDialog.vue` | Uses Ant `<a-spin>`; text customizable via `loading` prop only, no `businessDialogLoadingText` | S |
| [V1 13622, 13345] Error state with err.message fallback | `<div class="hiprint-toolbar-template-state error">` | 🔴 MISSING | n/a | No error state slot in V3 BusinessDialog | S |
| [V1 13626, 13343] Empty state "暂无业务" | `<div class="hiprint-toolbar-template-state empty">` | 🟡 PARTIAL | `BusinessDialog.vue` | Empty state present; text not configurable via `businessDialogEmptyText` opt | S |
| [V1 13455-13464] normalizeBusinessItem (adds `_bid`, `_name`, `_idx`) | id resolution from item.id/businessId/key/code/`business_<n>`; name from name/title/businessName/label/`未命名业务 N` | 🔴 MISSING | n/a | V3 BusinessItem schema requires `id: string|number` directly; no normalization fallback | M |
| [V1 13649-13679, 13346] businessListProvider (function returning Promise<list>\|list) | Async data source with `businessDialogRequestId` cancellation | 🔴 MISSING | n/a | V3 expects items as prop; no provider callback, no requestId cancellation | L |
| [V1 13629-13646] Card markup (.hiprint-toolbar-template-card etc.) | Custom card DOM | ⚠️ VIOLATION | `BusinessDialog.vue` | Uses Ant `<a-card>` / `<a-list>`; different DOM and class names | M |
| [V1 13631] Description fields `item.description/desc/remark` | Multiple field fallbacks | 🔴 MISSING | n/a | V3 has no description field on `BusinessItem` interface | S |
| [V1 13632] Update time fields `item.updatedAt/updateTime/modifiedAt` | Multiple fallbacks with "更新时间:" prefix | 🔴 MISSING | n/a | V3 has no update time field | S |
| [V1 13642] Card action button "选择" with `data-action="select"` `data-index` | Per-card action | 🟡 PARTIAL | `BusinessDialog.vue` | V3 emits `select` on click but no `data-action`/`data-index` attributes | S |
| [V1 13709-13719] handleBusinessSelect / resolveBusinessData / businessLoader chain | `businessLoader(item, template, api) → Promise<config>` OR fallback to `item.businessConfig||fieldsConfig||config||data||null` | 🔴 MISSING | n/a | No loader pattern; emit `select: [item]` only | L |
| [V1 13713, 13348] onBusinessSelect(item, parsedData, template, api) | 4-arg signature | 🟡 PARTIAL | `BusinessDialog.vue:75-77` | Emit `select` only carries item — no parsedData, no template, no api | M |
| [V1 13349, 13714] closeBusinessDialogOnSelect (default true) | Auto-close on select | 🔴 MISSING | n/a | V3 parent owns dialog state; no auto-close opt | S |
| [V1 13746-13751] ESC close binding | keydown `Escape || 27` → closeBusinessDialog | ✅ DONE | `BusinessDialog.vue` | Ant Modal provides ESC close natively | n/a |
| [V1 13742-13744] Mask click close | `.hiprint-toolbar-template-mask` click | ✅ DONE | `BusinessDialog.vue` | Ant Modal mask click closes by default | n/a |
| [V1 13755-13757] Refresh button click | Triggers `refreshBusinessList()` | 🟡 PARTIAL | `BusinessDialog.vue:78` | Emit `refresh` only; parent must handle reload + requestId cancellation | S |
| [V1 13339-13348] Hooks lifecycle (onBusinessClick, onBusinessDialogOpen/Close, onBusinessSelect, onBusinessSelectError) | 4 hooks with `{type, payload, template, api, openDefault, closeDefault}` context | 🔴 MISSING | n/a | None of these context-object hooks exist in V3 | L |
| [V1 14574-14602, 14732-14755] Programmatic API (openBusinessDialog/closeBusinessDialog/refreshBusinessList/setBusinessItems/getBusinessItems/setBusinessListProvider/setBusinessLoader/getBusinessDialogElement) | 8 toolbarCtrl methods | 🔴 MISSING | n/a | toolbarCtrl deleted; no equivalents on V3 SFC; parent handles via reactive props | L |
| [V1 13656, 13661, 13671] businessDialogRequestId cancellation | Counter cancels stale .then() | 🔴 MISSING | n/a | No request management in V3 | M |

### 2.2 Template Selection Dialog

| V1 ref | V1 behavior | V3 status | V3 file:line | Diff notes | Effort |
|---|---|---|---|---|---|
| [V1 13985] Root wrap class `hiprint-toolbar-template-dialog-wrap` | DOM class | ⚠️ VIOLATION | `TemplateDialog.vue:1-251` | Ant Modal — different class | M |
| [V1 13985] ARIA `role`/`aria-modal`/`aria-labelledby`/`tabindex` | Same as business | 🟡 PARTIAL | `TemplateDialog.vue` | Ant Modal provides role; missing deterministic labelledby id | S |
| [V1 13989, 13796, 13376] templateDialogTitle "选择模版" | Configurable | 🟡 PARTIAL | `TemplateDialog.vue:73` | V3 default `'模板选择'` (字 differ — V1 uses 模版 / V3 uses 模板) | S |
| [V1 13800, 13378] templateDialogLoadingText "模版加载中..." | Loading text | 🔴 MISSING | n/a | No text prop | S |
| [V1 13804, 13379] templateDialogErrorText "模版加载失败" | Error fallback | 🔴 MISSING | n/a | No error state | S |
| [V1 13808, 13377] templateDialogEmptyText "暂无模版" | Empty state | 🟡 PARTIAL | `TemplateDialog.vue` | Empty state present; not configurable | S |
| [V1 13432-13441] normalizeTemplateItem | _tid/_name/_idx fallbacks | 🔴 MISSING | n/a | No normalization | M |
| [V1 13833-13865, 13380] templateListProvider | Async items source | 🔴 MISSING | n/a | items as prop only | L |
| [V1 13823-13826] Card actions "选择"/"预览"/"编辑"/"删除" (4 actions) | Per-card buttons with data-action | 🟡 PARTIAL | `TemplateDialog.vue:79-91` | V3 emits select/edit/delete (3 actions); **`preview` action missing** | M |
| [V1 13895-13912] handleTemplateSelect → resolveTemplateData → parseTemplateData → applyTemplateData → template.update | Full apply pipeline with JSON parsing of string | 🔴 MISSING | n/a | V3 emits select only; parent must wire template.update | M |
| [V1 13909, 13382] onTemplateSelect(item, json, template, api) | 4-arg | 🟡 PARTIAL | `TemplateDialog.vue:81-82` | Emit `select: [item]` only | M |
| [V1 13909] onTemplateSelectError hook | `(err, item, template, api)` fired on parse/loader failure | 🔴 MISSING | n/a | Not implemented (also listed as a known undocumented V1 opt) | M |
| [V1 13383, 14023] onTemplatePreview hook | `(item, template, api)` | 🔴 MISSING | n/a | **No `preview` emit on V3 TemplateDialog at all** | M |
| [V1 13384, 14025] onTemplateEdit hook | `(item, template, api)` | 🟡 PARTIAL | `TemplateDialog.vue:84-85` | Emit `edit: [item]` only; missing template/api args | S |
| [V1 13385, 13914-13978] onTemplateDelete async hook | `(item, template, api) → Promise<bool>`; if false, skip refresh; if no hook, local remove + render | 🟡 PARTIAL | `TemplateDialog.vue:86-87` | Emit `delete: [item]` only | M |
| [V1 13352, 13929-13959] onTemplateDeleteConfirm hook | `(context) → Promise<bool>` or sync; with try/sync-throw safety | 🔴 MISSING | n/a | Not present; no confirm gate at all | M |
| [V1 14760-14787] Programmatic API (open/close/refresh/setTemplateItems/getTemplateItems/setTemplateListProvider/setTemplateLoader/getTemplateDialogElement) | 8 toolbarCtrl methods | 🔴 MISSING | n/a | Deleted with toolbarCtrl | L |
| [V1 13929-13937, 13952-13959] sync-throw safety in hooks | try-wrap so sync throws → resolved false | 🔴 MISSING | n/a | Not relevant since hooks absent | n/a |
| [V1 14000-14014] ESC/Mask/Refresh close handlers | Standard close binding | ✅ DONE | `TemplateDialog.vue` | Ant Modal native | n/a |

### 2.3 Save Dialog

| V1 ref | V1 behavior | V3 status | V3 file:line | Diff notes | Effort |
|---|---|---|---|---|---|
| [V1 14102] Root wrap class `hiprint-toolbar-save-dialog-wrap` | DOM class | ⚠️ VIOLATION | `SaveDialog.vue:1-236` | Ant Modal; different class | M |
| [V1 14102] ARIA standard | role/aria-modal/aria-labelledby/tabindex | 🟡 PARTIAL | `SaveDialog.vue` | Ant Modal provides role; deterministic labelledby missing | S |
| [V1 14105, 13370] saveDialogTitle "保存模版" | Default and configurable | 🟡 PARTIAL | `SaveDialog.vue:67` | V3 default `'保存模板'` (字 differ); configurable | S |
| [V1 14107, 13371] saveDialogNameLabel "模版名称" | Form label | 🔴 MISSING | n/a | Hardcoded; no `saveDialogNameLabel` prop | S |
| [V1 14108, 13372] saveDialogNamePlaceholder "请输入模版名称" | Input placeholder | 🔴 MISSING | n/a | Hardcoded label/placeholder | S |
| [V1 14108-14109] Input `aria-describedby="hp-save-err-<uid>"`, error `role="alert"` | A11y wiring | 🟡 PARTIAL | `SaveDialog.vue` | Ant Form provides validation; deterministic ID convention missing | S |
| [V1 14112, 13375] saveDialogCancelText "取消" | Cancel button text | 🔴 MISSING | n/a | Hardcoded | S |
| [V1 14113, 13374] saveDialogConfirmText "确定" | Confirm button text | 🔴 MISSING | n/a | Hardcoded | S |
| [V1 14134-14140, 13373] saveDialogNameRequiredText "请输入模版名称" + trim + focus + abort | Validation: trim, check empty, show error, focus input | 🟡 PARTIAL | `SaveDialog.vue:94-95` | Has `nameError` ref; validation present but error text not customizable; trim semantics implicit | S |
| [V1 14144-14149] Save pipeline `Promise.resolve(saveTemplateWithName).then(close).catch(showError)` | Promise chain | 🟡 PARTIAL | `SaveDialog.vue` | Parent owns submit; SaveDialog just emits `submit: [payload]`; promise chain in parent | M |
| [V1 14080-14091] saveTemplateWithName: getJson(), name trim+default "未命名模版", _safeCall(onSave) else download | Full save flow | 🟡 PARTIAL | `HiprintToolbar.vue:494-515` | Toolbar's `handleSave` does part of this; **does not pass `{name}` ctx because save dialog not wired to toolbar** | M |
| [V1 14151-14156] Enter key submit | Keydown 13 → trigger `.js-save-confirm` click | ✅ DONE | `SaveDialog.vue` | Ant Form handles Enter natively | n/a |
| [V1 14165-14175] Initial name value + setSelectionRange(len, len) cursor at end | Auto-focus + caret-at-end behavior | 🟡 PARTIAL | `SaveDialog.vue` | Form prefills from `initialValue` prop; cursor caret-at-end not explicit | S |
| [V1 14123-14128] ESC close | keydown Escape → closeSaveDialog | ✅ DONE | `SaveDialog.vue` | Ant Modal native | n/a |
| [V1 14119-14121] Mask/Cancel close | Click handlers | ✅ DONE | `SaveDialog.vue` | Ant Modal native | n/a |
| [V1 14198-14207] triggerSave({skipPrompt, name}) programmatic | toolbarCtrl method | 🔴 MISSING | n/a | toolbarCtrl deleted; no programmatic skip | M |
| [V1 14072-14073] onSaveDialogOpen/onSaveDialogClose hooks | Context-obj hooks | 🔴 MISSING | n/a | No lifecycle hooks | M |
| [V1 14146-14149] Failure UI: show err.message in `.hiprint-toolbar-save-error`, dialog stays open | Inline error | 🟡 PARTIAL | `SaveDialog.vue:94-95` | nameError ref exists; parent-owned failure path not wired by default | S |
| [V1 14086] onSave hook signature `(template, json, event, api, {name})` | 5-arg V1 contract | 🟡 PARTIAL | `HiprintToolbar.vue:514` | Emit shape matches but `event=null`, `api=undefined`, `ctx` doesn't carry name from dialog (because dialog not wired) | M |

### 2.4 Custom Paper Popover

| V1 ref | V1 behavior | V3 status | V3 file:line | Diff notes | Effort |
|---|---|---|---|---|---|
| [V1 14259] Root class `hiprint-toolbar-popover` | DOM class | ⚠️ VIOLATION | `CustomPaperPopover.vue:69` | V3 uses class `hiprint-custom-paper-popover` (different name) | S |
| [V1 14259] ARIA `role="dialog"` + `aria-label="自定义纸张大小"` | A11y | 🟡 PARTIAL | `CustomPaperPopover.vue:70-72` | role="dialog" + `aria-label="Custom paper size"` (English not 中文); functional ok | S |
| [V1 14259] Initial style `display:none;` | Hidden until open | ✅ DONE | `CustomPaperPopover.vue:68` | Vue `v-if="open"` | n/a |
| [V1 14308-14310] Container wrap `.hiprint-toolbar-custom-wrap` `position:relative; display:inline-block;` | Positioning anchor | 🟡 PARTIAL | `HiprintToolbar.vue:1341-1343` | Paper label CSS has `position:relative`; missing the `.hiprint-toolbar-custom-wrap` class | S |
| [V1 14261] Width Input placeholder `宽(mm)` default 220 | Number input | 🟡 PARTIAL | `CustomPaperPopover.vue:74-84` | Input label `Width (mm)` (English); default A4 (210 not 220) | S |
| [V1 14262] Separator `<span style="margin:0 4px;">×</span>` | Visual × | 🔴 MISSING | n/a | No × separator | S |
| [V1 14263] Height Input placeholder `高(mm)` default 80 | Number input | 🟡 PARTIAL | `CustomPaperPopover.vue:85-95` | English label; default A4 297 not 80 | S |
| [V1 14264] Confirm class `hiprint-toolbar-btn active` + margin-left 6px | Confirm style | 🟡 PARTIAL | `CustomPaperPopover.vue:97-98` | Has `class="primary"` style; different class names | S |
| [V1 14285-14291] toggle()/aria-expanded sync/setTimeout focus first input | Show/hide behavior with focus mgmt | 🟡 PARTIAL | `HiprintToolbar.vue:1022, CustomPaperPopover.vue` | v-if open toggle + aria-expanded on trigger ok; **no autofocus on first input** | S |
| [V1 14294-14300] ESC → hide + aria-expanded='false' + focus trigger | Restore focus to trigger button | 🔴 MISSING | n/a | No ESC handler in popover; no focus return | S |
| [V1 14303-14307] Outside-click close `$(document).on('click' + _toolbarClickNs, ...)` checks `!closest('.hiprint-toolbar-popover, [data-paper="custom"]')` | Namespace-bound for safe destroy | 🟡 PARTIAL | `CustomPaperPopover.vue:73` | `@click.stop` on popover prevents bubbling; no document-level outside-click listener; would not close on click elsewhere | S |
| [V1 14281-14283] onCustomPaperOpen hook | `(template, api) → bool` | 🔴 MISSING | n/a | Not implemented | M |
| [V1 14266-14275] Confirm validation `w > 0 && h > 0` | Silent reject if invalid | 🔴 MISSING | `CustomPaperPopover.vue:57-59` | V3 submits any number including 0/negative without validation | S |
| [V1 14267-14274] Confirm side effects (curPaper='custom', swap .active, setPaper, hide, onPaperChange) | Full chain | 🟡 PARTIAL | `HiprintToolbar.vue:670-685` | V3 sets `paperType: 'custom'` on panel and updates panel width/height, **does NOT emit `onPaperChange`** for custom | S |
| [V1 14273] onPaperChange fires with `'custom', {width, height}` for custom confirm | Event semantics | 🔴 MISSING | n/a | No emit for custom-confirm path | S |

---

## Section 3: Keyboard Shortcuts & Global Events

V3 root: `src/hiprint-v3/interactions/keyboard.ts` (315 lines).

### 3.1 Keyboard Shortcuts

| V1 ref | V1 behavior | V3 status | V3 file:line | Diff notes | Effort |
|---|---|---|---|---|---|
| [V1 10951-10957] Ctrl/Cmd+Z undo | Restores prior historyList snapshot, prevents default | ✅ DONE | `keyboard.ts:237-246` | Implemented; calls `history.undo()` | n/a |
| [V1 10952-10954] Ctrl/Cmd+Shift+Z redo | Restores next snapshot | ✅ DONE | `keyboard.ts:238-243` | Implemented; also accepts Ctrl+Y | n/a |
| Extra Ctrl/Cmd+Y redo | Not in V1 | ⏸️ DEFERRED | `keyboard.ts:247-251` | V3 adds Ctrl+Y as additional redo binding (Windows convention); not a violation | n/a |
| [V1 10960-10969] Ctrl/Cmd+A select all (non-INPUT/TEXTAREA, except tables) | Select all canvas elements via `.selected` class | 🔴 MISSING | n/a | No Ctrl+A binding in `keyboard.ts` handler; no equivalent `selectAllElements` action wired | M |
| [V1 10971-10981] Esc deselect all + remove mouseRect | Clear selection | 🔴 MISSING | n/a | No Esc binding | S |
| [V1 10983-11003] Ctrl/Cmd+] z-index +1 | Bring up one layer | 🔴 MISSING | n/a | No `]` keyboard binding | M |
| [V1 10983-11003] Ctrl/Cmd+[ z-index -1 | Send down one layer | 🔴 MISSING | n/a | No `[` keyboard binding | M |
| [V1 10987-10992] Ctrl/Cmd+Shift+] bring to front | z=maxZ+1+i | 🔴 MISSING | n/a | No Shift+] keyboard binding | M |
| [V1 10993-10996] Ctrl/Cmd+Shift+[ send to back | z=i; others push down | 🔴 MISSING | n/a | No Shift+[ keyboard binding | M |
| [V1 11009-11015] Ctrl/Cmd+V paste from `#copyArea` | Internal paste | 🟡 PARTIAL | `keyboard.ts:260-264, 147-172` | V3 uses internal `_setClipboard/_getClipboard` from context-menu (different impl, no `#copyArea` DOM); functionally equivalent for in-app | n/a |
| [V1 1467-1481] Ctrl/Cmd+C copy to `#copyArea` + clipboard API | Internal copy | 🟡 PARTIAL | `keyboard.ts:255-259, 126-145` | Internal clipboard not navigator.clipboard; functional ok | n/a |
| Extra Ctrl/Cmd+X cut | Not explicitly enumerated in V1 inventory but `copyJson()` exists; V3 has cut | ⏸️ DEFERRED | `keyboard.ts:265-269, 174-177` | V3 adds Ctrl+X explicitly; arguably nice-to-have | n/a |
| [V1 1568-1594] Backspace/Delete element delete (with positionLocked allowed) | Per-element delete + multi-select aware | 🟡 PARTIAL | `keyboard.ts:272-277, 103-119` | V3 deletes from selection; honors INPUT skip; **does not honor `positionLocked` element option** | S |
| [V1 1595-1604] ArrowLeft move element by movingDistance | Per-element; positionLocked = skip movement | 🟡 PARTIAL | `keyboard.ts:291-295, 121-124` | V3 moves selection by `moveStep` (default 1pt); **no `positionLocked` check**; no `_editing` check | S |
| [V1 1607-1640] ArrowUp/Right/Down move | Same | 🟡 PARTIAL | `keyboard.ts:281-300` | Same as above | S |
| Shift+arrow large step | Not in V1 spec but V3 implements | ⏸️ DEFERRED | `keyboard.ts:223, 280` | V3 adds Shift = bigMoveStep (default 10pt) | n/a |
| [V1 1469-1474] Enter in editing element (with Alt for newline) | Inline-edit toggle | 🔴 MISSING | n/a | No inline edit Enter handling in keyboard.ts | M |
| [V1 12020-12050] Arrow keys on panel.target (`tabindex=1`) move mouseRect selection | Box-select frame movement | 🔴 MISSING | n/a | No panel-level arrow binding | M |
| [V1 1764-1765, 1772-1773] Enter end cell editing (table column/text) | Inline cell editor | 🔴 MISSING | n/a | Table editing keyboard not implemented in V3 keyboard.ts | M |
| [V1 12158-12159, 12231-12232, 12269-12270] Enter on `.auto-submit:input` | Option panel field submit | 🔴 MISSING | n/a | Property panel keyboard not implemented | M |
| [V1 14294-14299] Esc on `.hiprint-toolbar-popover` (custom paper) | Hide popover | 🔴 MISSING | n/a | Custom paper popover has no Esc handler | S |
| [V1 13746-13750] Esc on business dialog | Close | ✅ DONE | `BusinessDialog.vue` (Ant native) | n/a | n/a |
| [V1 14003-14007] Esc on template dialog | Close | ✅ DONE | `TemplateDialog.vue` | Ant native | n/a |
| [V1 14123-14127] Esc on save dialog | Close | ✅ DONE | `SaveDialog.vue` | Ant native | n/a |
| [V1 14151-14156] Enter on save input | Submit | ✅ DONE | `SaveDialog.vue` | Ant Form native | n/a |
| [V1 11774-11791] Arrow keys + Enter on element-list panel header (drag handle) | Move panel by step (10/30 with Shift); Enter resets position | 🔴 MISSING | n/a | V3 element list panel keyboard nav not implemented | M |
| [V1 8112] Synthetic `keydown(46)` for "delete selected" internal | Internal trigger | ⏸️ DEFERRED | n/a | V3 doesn't need synthetic event since `canvas.removeElement` is direct call | n/a |
| Extra Tab/Shift+Tab cycle selection | Not in V1 | ⏸️ DEFERRED | `keyboard.ts:303-307, 193-215` | V3 adds Tab cycling within active panel | n/a |

### 3.2 Global Event Bindings ($(document) / $(window) / $('body'))

V3 doesn't use jQuery, so namespace-bound jQuery handlers are not directly applicable. The equivalent V3 surface is window/document `addEventListener`.

| V1 ref | V1 behavior | V3 status | V3 file:line | Diff notes | Effort |
|---|---|---|---|---|---|
| [V1 9600-9608] document mousemove/mouseup `.hiprintGuideDrag_<panelId>` (guide drag) | Per-panel namespace | 🔴 MISSING | n/a | V3 has no guide-line system | L |
| [V1 9610] body class `hiprint-guide-dragging` | Drag-state CSS | 🔴 MISSING | n/a | No guide system | L |
| [V1 11615] document `one('click.hiprintCtxMenu')` close ctx menu | Single-shot | 🟡 PARTIAL | `interactions/context-menu.ts` | V3 has context menu but binding style differs (Vue lifecycle managed) | n/a |
| [V1 11815-11821] document/window mousemove/mouseup/blur `.hiprintElListDrag_<templateId>` (element list panel drag) | Per-template namespace | 🔴 MISSING | n/a | V3 element-list panel does not implement drag-by-header | M |
| [V1 10949] document keydown (no namespace — known V1 leak) | Global shortcuts; never removed on destroy | ✅ DONE | `keyboard.ts:311-314` | V3 returns cleanup function from `enableDesignerKeyboard()`; proper removal | n/a |
| [V1 14303] document `click<_toolbarClickNs>` close custom-paper popover on outside click | Namespace-bound | 🔴 MISSING | n/a | No outside-click document listener in V3 CustomPaperPopover | S |
| [V1 15039-15040, 15060-15061] document mousemove/mouseup `<_designerEventNs>` for left/right resize | Panel resize | 🔴 MISSING | n/a | V3 designer doesn't have built-in resize bars (no `resize-bar` in `HiprintDesigner.vue` template tree based on V3 redesign) | M |
| [V1 15341-15344] document.ready autoConnect | DOMContentLoaded → hiwebSocket.start | 🟡 PARTIAL | `compat/hiprint-global.ts:296-303` | V3 has `hiprint.autoConnect()` method; not auto-fired on DOMContentLoaded — plugin `autoConnect: true` opt triggers it | n/a |

### 3.3 Synthetic Events / Trigger-Based

| V1 ref | V1 behavior | V3 status | V3 file:line | Diff notes | Effort |
|---|---|---|---|---|---|
| [V1 10953-10955] `hiprintTemplateDataShortcutKey_<id>` undo/redo | Event bus | 🟡 PARTIAL | n/a | V3 invokes `history.undo()/redo()` directly on store; no event bus key. Behavior parity (undo works) but no synthetic event for business observers | n/a |
| [V1 10001+] `hiprintTemplateDataChanged_<id>` element changes | Event bus, appends history snapshot | 🟡 PARTIAL | `stores/history.ts` `pushSnapshot()` | History snapshots present via direct call; no event bus key for business observers | M (provide subscribe API) |
| [V1 12562, 12070] `PrintElementSelectEventKey_<id>` element selection | Event bus | 🟡 PARTIAL | `stores/canvas.ts` `selectedElementIds` ref | Pinia reactive; no event bus key | n/a |
| [V1 12565, 12073] `BuildCustomOptionSettingEventKey_<id>` custom option rebuild | Event bus | 🔴 MISSING | n/a | No equivalent | M |
| [V1 1587, 1593, 12075] `clearSettingContainer` | Event on delete element | 🔴 MISSING | n/a | No equivalent | M |
| [V1 12326] `onSelectPanel` pagination strip | Event | 🔴 MISSING | n/a | V3 uses `setActivePanel` direct call | n/a |

---

## Section 4: CSS Classes & ARIA

V3 SFCs use scoped styles + Ant Design — most V1 class names are absent.

### 4.1 Structural Classes

| V1 ref | V1 class | V3 status | V3 file:line | Diff notes | Effort |
|---|---|---|---|---|---|
| [V1 13394] `hiprint-toolbar` | Root | ✅ DONE | `HiprintToolbar.vue:866` | `class="hiprint-toolbar"` matches | n/a |
| [V1 14211...] `hiprint-toolbar-group` | Group container | 🔴 MISSING | n/a | V3 uses `hiprint-toolbar-sep` separators + inline flex; no `-group` wrapper class | S |
| [V1 14211] `hiprint-toolbar-business-select` (suffix) | E2E selector | 🔴 MISSING | n/a | No group-suffix classes in V3 | S |
| [V1 14228] `hiprint-toolbar-template-select` | E2E | 🔴 MISSING | n/a | Same | S |
| [V1 14239] `hiprint-toolbar-paper` | E2E | ✅ DONE | `HiprintToolbar.vue:1331-1343` | Class present as wrapper | n/a |
| [V1 14317] `hiprint-toolbar-scale` | E2E | 🔴 MISSING | n/a | No group class | S |
| [V1 14371] `hiprint-toolbar-align` | E2E | 🔴 MISSING | n/a | No group class | S |
| [V1 14452] `hiprint-toolbar-panels` | E2E | 🟡 PARTIAL | `HiprintToolbar.vue:1054, 1346` | V3 uses `hiprint-toolbar-panel-chips` (different name) | S |
| [V1 14702] `hiprint-toolbar-extra` | E2E | 🔴 MISSING | n/a | No extra group class | S |
| [V1 14212+] `hiprint-toolbar-btn` | Button base | ✅ DONE | `HiprintToolbar.vue:1286-1322` | Used on all buttons | n/a |
| [V1 14433, 14113, 13642, 13823] `hiprint-toolbar-btn-primary` | Primary modifier | 🔴 MISSING | `HiprintToolbar.vue` | No primary modifier class; print button doesn't get it | S |
| [V1 14402, 13826] `hiprint-toolbar-btn-danger` | Danger modifier | 🔴 MISSING | n/a | No danger modifier; clear button doesn't get it | S |
| [V1 14323, 14324, 14374] `hiprint-toolbar-icon-btn` | Icon-only modifier | 🔴 MISSING | n/a | No icon-btn modifier class | S |
| [V1 14244, 14264, 14269-14270] `active` | Selected state | 🟡 PARTIAL | `HiprintToolbar.vue:1317-1321, 1372-1376` | V3 uses `is-active` for chips and gridToggle/rulerToggle; paper select uses HTML `selected` (different mechanism since it's a `<select>`) | S |
| [V1 14259] `hiprint-toolbar-popover` | Popover root | ⚠️ VIOLATION | `CustomPaperPopover.vue:69, 104` | V3 uses `hiprint-custom-paper-popover` (different name); E2E selectors break | S |
| [V1 14260] `hiprint-toolbar-popover-content` | Inner | 🔴 MISSING | n/a | No equivalent | S |
| [V1 14261, 14263] `hiprint-toolbar-input` | Number inputs | 🔴 MISSING | n/a | V3 inputs have no class | S |
| [V1 14308] `hiprint-toolbar-custom-wrap` | Anchor | 🔴 MISSING | n/a | No wrapper class | S |
| [V1 14453] `hiprint-toolbar-panel-manager` | Composite | 🔴 MISSING | n/a | V3 chip list has different structure | S |
| [V1 14454] `hiprint-toolbar-panel-manager-label` | Label | 🔴 MISSING | n/a | V3 uses `hiprint-toolbar-label` | S |
| [V1 14455] `hiprint-toolbar-panel-manager-select` | Select | ⚠️ VIOLATION | n/a | V3 has no select; chip list instead | M |
| [V1 14458] `hiprint-toolbar-panel-manager-add` | + button | 🔴 MISSING | n/a | V3 add button has no specialized class | S |
| [V1 14318] `hiprint-toolbar-scale-label` | 100% display | 🔴 MISSING | n/a | V3 has button (not span) with `{{scalePercent}}%` text | S |
| [V1 13727] `hiprint-toolbar-business-dialog-wrap` | Business dialog root | ⚠️ VIOLATION | `BusinessDialog.vue` | Ant Modal — class absent | M |
| [V1 13985] `hiprint-toolbar-template-dialog-wrap` | Template dialog root | ⚠️ VIOLATION | `TemplateDialog.vue` | Ant Modal — absent | M |
| [V1 14102] `hiprint-toolbar-save-dialog-wrap` | Save dialog root | ⚠️ VIOLATION | `SaveDialog.vue` | Ant Modal — absent | M |
| [V1 13728, 13986] `hiprint-toolbar-template-mask` | Backdrop | 🔴 MISSING | n/a | Ant Modal mask different | M |
| [V1 14103] `hiprint-toolbar-save-mask` | Save backdrop | 🔴 MISSING | n/a | Ant Modal mask | M |
| [V1 13729, 13987] `hiprint-toolbar-template-dialog` | Panel | 🔴 MISSING | n/a | Ant `.ant-modal-content` | M |
| [V1 14104] `hiprint-toolbar-save-dialog` | Save panel | 🔴 MISSING | n/a | Same | M |
| [V1 13730-13737] `hiprint-toolbar-template-header/body/footer/title/state` | Dialog parts | 🔴 MISSING | n/a | Ant Modal has its own classes | M |
| [V1 13629-13644] card classes (`-template-grid/-card/-card-title/-card-desc/-card-meta/-card-actions`) | Card layout | 🔴 MISSING | n/a | Ant `<a-card>` | M |
| [V1 13618...] state classes `.loading/.error/.empty` | State markers | 🔴 MISSING | n/a | Ant `<a-spin>` for loading; no error/empty class | S |
| [V1 13735, 13993] `hiprint-toolbar-business-refresh` / `js-business-close` / `hiprint-toolbar-template-refresh` / `js-template-close` | Action button hooks | 🔴 MISSING | n/a | Ant Modal-based | S |
| [V1 14105-14111] save dialog parts (header/body/footer/label/input/error) | Save dialog markup | 🔴 MISSING | n/a | Ant Form | M |
| [V1 14112, 14113] `js-save-cancel` / `js-save-confirm` | Save action hooks | 🔴 MISSING | n/a | Ant Modal | S |
| [V1 12528, 14919] `hiprint-printTemplate` | Canvas root | 🟡 PARTIAL | (HiprintCanvas.vue — verified by test files) | Class may be present in canvas SFC; needs verification | S |
| [V1 14921, 14926] `hiprint-printPagination` / `hiprint-designer-pagination` | Bottom strip | 🔴 MISSING | n/a | V3 pagination is inline on toolbar; no `printPagination` strip | M |
| [V1 14895] `hiprint-designer` | Designer root | 🟡 PARTIAL | `HiprintDesigner.vue` template | Likely present | S |
| [V1 14896] `hiprint-designer-toolbar` | Toolbar host | 🟡 PARTIAL | `HiprintDesigner.vue` | Likely present | S |
| [V1 14897] `hiprint-designer-layout` | 3-col flex layout | 🟡 PARTIAL | `HiprintDesigner.vue` | V3 has 3-column flex; class name may differ | S |
| [V1 14900, 14918, 14940] `hiprint-designer-panel-left/-center/-right` | Layout panels | 🟡 PARTIAL | `HiprintDesigner.vue` | V3 has 3 areas; class names may differ | S |
| [V1 14911, 14933] `hiprint-designer-resize-bar` | Resize column | 🔴 MISSING | n/a | V3 designer doesn't ship resize bars | M |
| [V1 14912, 14934] `hiprint-designer-resize-handle` | Drag handle | 🔴 MISSING | n/a | No resize handles | M |
| [V1 14913, 14935] `hiprint-designer-edge-toggle(-left/-right)` | Collapse arrows | 🔴 MISSING | n/a | No collapse | M |
| [V1 14928, 11698] `hiprint-designer-card` | Canvas card | 🟡 PARTIAL | `HiprintDesigner.vue` | Likely; needs verification | S |
| [V1 14905, 14949] `hiprint-designer-panel-header` | Panel title bar | 🟡 PARTIAL | `HiprintDesigner.vue` | May exist | S |
| [V1 11682, 11684, 11685, 11686, 11759, 11752] element-list panel classes | Movable element-list overlay | 🔴 MISSING | n/a | V3 element list is sidebar-style, not popover; classes differ | M |
| [V1 9610, 12587] body class `hiprint-guide-dragging` | Drag state | 🔴 MISSING | n/a | No guide system | L |
| [V1 11759, 11811] body class `hiprint-el-list-dragging` | El-list drag state | 🔴 MISSING | n/a | No movable el-list panel | M |
| [V1 1657] element class `multipleSelect` | Multi-select state | 🟡 PARTIAL | (HiprintCanvas / selection visuals) | Likely uses different selector; needs verification | S |
| [V1 6307] `hiprint-printElement-tableTarget` | Table marker | 🔴 MISSING | n/a | V3 table elements use ant `<a-table>` likely | n/a |
| [V1 11615] `hiprint-ctx-menu` | Context menu | 🟡 PARTIAL | `interactions/context-menu.ts` | V3 has its own context menu; class name may differ | S |
| [V1 12836] `hiprint_temp_Container` | toPdf hidden host | 🔴 MISSING | n/a | V3 toPdf uses jspdf.html() directly without `_temp_Container` | n/a |

### 4.2 ARIA Attributes

| V1 ref | V1 attribute | V3 status | V3 file:line | Diff notes | Effort |
|---|---|---|---|---|---|
| [V1 14258] Custom Paper Button `aria-haspopup="dialog"` | Popover indicator | 🔴 MISSING | `HiprintToolbar.vue:1017-1024` | Only aria-label + aria-expanded | S |
| [V1 14258, 14287, 14298] Custom Paper Button `aria-expanded` synced | Toggle state | ✅ DONE | `HiprintToolbar.vue:1022` | `:aria-expanded="customPaperOpen"` | n/a |
| [V1 14259] Custom Paper Popover `role="dialog"` | Semantic | ✅ DONE | `CustomPaperPopover.vue:70` | role="dialog" | n/a |
| [V1 14259] Custom Paper Popover `aria-label="自定义纸张大小"` | Label | 🟡 PARTIAL | `CustomPaperPopover.vue:71` | Label is English `"Custom paper size"`, not 中文 | S |
| [V1 14323] Zoom Out `aria-label="缩小"` | Icon-only label | 🟡 PARTIAL | `HiprintToolbar.vue:1128` | English `"Zoom out"` | S |
| [V1 14324] Zoom In `aria-label="放大"` | Icon-only label | 🟡 PARTIAL | `HiprintToolbar.vue:1149` | English `"Zoom in"` | S |
| [V1 14374] Align buttons `aria-label={label}` | Each icon's CN label | 🟡 PARTIAL | `HiprintToolbar.vue:1189-1248` | English `"Align left"` etc.; values not customizable through alignItems | S |
| [V1 14244, 14247-14248] Paper Size Buttons `aria-pressed` | Toggle state for SR | ⚠️ VIOLATION | `HiprintToolbar.vue:1001-1016` | V3 uses `<select>` (no aria-pressed semantics); native `<option selected>` only | M |
| [V1 14460] Add Panel `aria-label="添加分页"` | Icon-only label | 🟡 PARTIAL | `HiprintToolbar.vue:1104` | English `"Add panel"` | S |
| [V1 14456] Panel Manager Select `aria-label="选择分页"` | Form control label | ⚠️ VIOLATION | `HiprintToolbar.vue:1052-1072` | V3 uses chip list with `role="group" aria-label="Active panel"`; no select | n/a |
| [V1 13727] Business dialog wrap `role="dialog"` `aria-modal="true"` `aria-labelledby` `tabindex="-1"` | Modal a11y | 🟡 PARTIAL | `BusinessDialog.vue` (Ant Modal) | Ant Modal provides role + aria-modal + focus trap; `aria-labelledby` to deterministic ID `hp-business-title-<uid>` not present | S |
| [V1 13733] Business dialog body `aria-live="polite" aria-busy="false"` | Status announcement | 🔴 MISSING | n/a | Not in V3 BusinessDialog | S |
| [V1 13736] Business dialog close `aria-label="关闭"` | Close action | 🟡 PARTIAL | n/a | Ant Modal close button has aria-label by default; CN/EN depends on Ant locale | n/a |
| [V1 13985] Template dialog wrap ARIA bundle | Same as business | 🟡 PARTIAL | `TemplateDialog.vue` | Ant Modal | S |
| [V1 13991] Template body `aria-live aria-busy` | Same pattern | 🔴 MISSING | n/a | Not present | S |
| [V1 13994] Template close `aria-label="关闭"` | Close | 🟡 PARTIAL | n/a | Ant Modal default | n/a |
| [V1 14102] Save wrap ARIA bundle | Same | 🟡 PARTIAL | `SaveDialog.vue` | Ant Modal | S |
| [V1 14108] Save input `aria-describedby="hp-save-err-<uid>"` | Error region wiring | 🔴 MISSING | n/a | Ant Form provides validation, but explicit aria-describedby with deterministic ID not present | S |
| [V1 14109] Save error `role="alert"` | Live announcement | 🟡 PARTIAL | `SaveDialog.vue` | Ant Form validation announces; role="alert" not explicit | S |
| [V1 14107] Save label `for="hp-save-name-<uid>"` | Form pairing | 🟡 PARTIAL | n/a | Ant Form handles label-input pairing internally | n/a |
| [V1 11772] Element-list panel header `tabindex="0"` `role="button"` | Keyboard handle | 🔴 MISSING | n/a | V3 element list has no draggable header keyboard nav | M |
| [V1 11773] aria-label "元素列表标题，可拖动；按方向键移动，按 Enter 重置位置" | Action description | 🔴 MISSING | n/a | Element list panel design differs in V3 | M |

---

## Section 5: buildDesigner Shell Structure

V3 root: `src/hiprint-v3/components/HiprintDesigner.vue` + `compat/build-designer.ts`.

### 5.1 Main DOM Tree

| V1 ref | V1 element/class | V3 status | V3 file:line | Diff notes | Effort |
|---|---|---|---|---|---|
| [V1 14894-14895] `.hiprint-designer` root | Top container | 🟡 PARTIAL | `HiprintDesigner.vue` template | Likely present; class needs verification | S |
| [V1 14896] `.hiprint-designer-toolbar` | Toolbar host | 🟡 PARTIAL | `HiprintDesigner.vue` | V3 places `<HiprintToolbar />` directly | S |
| [V1 14897] `.hiprint-designer-layout` | Flex layout | 🟡 PARTIAL | `HiprintDesigner.vue` | V3 has analogous flex layout | S |
| [V1 14900-14906] `.hiprint-designer-panel-left > .hiprint-designer-sidebar > header + body.rect-printElement-types.hiprintEpContainer` | Left panel with element types | 🟡 PARTIAL | `HiprintDesigner.vue + HiprintElementList.vue` | V3 has HiprintElementList SFC; class names don't match `.rect-printElement-types.hiprintEpContainer` | M |
| [V1 14911-14914] `.hiprint-designer-resize-bar` + `-resize-handle` + `-edge-toggle-left` | Drag handle + collapse arrow | ⚠️ VIOLATION | n/a | V3 doesn't ship resize bars (build-designer.ts ignores leftWidth/rightWidth opts) | L |
| [V1 14918-14921] `.hiprint-designer-panel-center > .hiprint-designer-card > .hiprint-printTemplate + .hiprint-printPagination` | Center column with canvas + pagination strip | 🟡 PARTIAL | `HiprintDesigner.vue + HiprintCanvas.vue` | V3 has canvas; **no bottom `.hiprint-printPagination` strip** (TB-006 pagination is in toolbar instead — ⚠️ VIOLATION) | M |
| [V1 14933-14935] right resize bar + handle + edge-toggle-right | Same as left | ⚠️ VIOLATION | n/a | Not implemented | L |
| [V1 14940-14949] `.hiprint-designer-panel-right.params_setting_container > .hiprint-designer-sidebar > header + body > .hinnn-layout-sider > .hiprint-option-setting-container` | Right column with properties | 🟡 PARTIAL | `HiprintDesigner.vue + HiprintPropertyPanel.vue` | V3 has property panel; class names don't match | S |

### 5.2 buildDesigner opts

| V1 ref | V1 opt (default) | V3 status | V3 file:line | Diff notes | Effort |
|---|---|---|---|---|---|
| [V1 14861] leftWidth (200) | Initial left width px | ⏸️ DEFERRED | `build-designer.ts:149-177` | V3 has no resize bars; opt silently ignored | n/a |
| [V1 14862] rightWidth (280) | Initial right width | ⏸️ DEFERRED | same | Same | n/a |
| [V1 14863] leftMinWidth (140) | Drag bound | ⏸️ DEFERRED | same | Same | n/a |
| [V1 14864] leftMaxWidth (400) | Drag bound | ⏸️ DEFERRED | same | Same | n/a |
| [V1 14865] rightMinWidth (200) | Drag bound | ⏸️ DEFERRED | same | Same | n/a |
| [V1 14866] rightMaxWidth (500) | Drag bound | ⏸️ DEFERRED | same | Same | n/a |
| [V1 14867] leftCollapsed (false) | Initial collapse | 🔴 MISSING | n/a | No collapse functionality | M |
| [V1 14868] rightCollapsed (false) | Initial collapse | 🔴 MISSING | n/a | No collapse | M |
| [V1 14869] componentModule ('defaultModule') | Registry module | 🟡 PARTIAL | `build-designer.ts:167` | Opt accepted; behavior not wired to filter HiprintElementList | M |
| [V1 14870] componentPanelSlot (null) | Slot override | 🔴 MISSING | `build-designer.ts:449-455` | V3 logs warn; no-op (intended Vue slots replacement) | n/a (intentional) |
| [V1 14871, 15074-15080] templateOptions ({}) — full bag | Forwarded to PrintTemplate ctor (template/dataMode/history/willOutOfBounds/onDataChanged/onUpdateError/defaultPanelName/qtDesigner/fontList/fields/onImageChooseClick/onPanelAddClick + settingContainer/paginationContainer) | 🟡 PARTIAL | `build-designer.ts:137-147, 235-248` | V3 forwards `template/history/paginate`; **DROPS**: dataMode, willOutOfBounds, qtDesigner, defaultPanelName, fontList, fields, onImageChooseClick, onPanelAddClick, settingContainer, paginationContainer, onDataChanged (polled), onUpdateError | L |
| [V1 14872] toolbarOptions ({}) | Forwarded to buildToolbar | 🟡 PARTIAL | `build-designer.ts:236, 300-339` | Partially forwarded; **76 V1 buildToolbar opts → 30 V3 forwarded** | L |
| [V1 14873, 15102-15104] onReady(template, toolbarCtrl) | After mount callback | 🟡 PARTIAL | `build-designer.ts:366-374` | V3 signature is `(tpl)` only — **toolbarCtrl arg removed** (intentional break per ADR) | M |
| [V1 14876, 14925-14927] showPagination (false) | Bottom pagination strip visibility | ⚠️ VIOLATION | `HiprintToolbar.vue:276` | V3 `showPagination` default `true` (V1 was false); also V3 pagination is inline in toolbar not as bottom strip | S |
| [V1 14890-14892] designerId (auto) | DOM id prefix | 🔴 MISSING | n/a | V3 doesn't use deterministic designerId for DOM IDs | n/a |

### 5.3 Internal Generated Identifiers

| V1 ref | Identifier | V3 status | V3 file:line | Diff notes | Effort |
|---|---|---|---|---|---|
| [V1 14887-14892] `_designerUid` (timestamp+random) | Cross-iframe unique | 🔴 MISSING | n/a | No equivalent | n/a |
| [V1 15039-15040, 15060-15061] `_designerEventNs` | Resize namespace | 🔴 MISSING | n/a | No resize bars | n/a |
| [V1 14892] designerId sanitized | DOM id prefix | 🔴 MISSING | n/a | Not used | n/a |

### 5.4 Designer Internal Behaviors

| V1 ref | Behavior | V3 status | V3 file:line | Diff notes | Effort |
|---|---|---|---|---|---|
| [V1 15002-15019] `_rafThrottle(fn)` rAF-aligned throttle | 60fps event throttling | 🔴 MISSING | n/a | No resize behavior; throttle utility not present | n/a |
| [V1 15037-15038, 15054-15055] Drag cursor lock (`body.style.cursor='col-resize'` + `userSelect='none'`) | Resize UX | 🔴 MISSING | n/a | No resize | n/a |
| [V1 14960-14998] Collapse toggle `applyLeftState`/`applyRightState` | Collapse animation | 🔴 MISSING | n/a | Not implemented | M |
| [V1 15084-15096] Component panel click → element select | `.ep-draggable-item` click → `el.selectFromList(false)` | 🟡 PARTIAL | `HiprintElementList.vue` | V3 has drag-drop element list; click-to-select may differ | n/a |
| [V1 15080-15081] Template lifecycle (`new ct(opts); .design($printTemplateContainer[0])`) | Constructor pattern | ✅ DONE | `compat/print-template.ts:189-225` | `new PrintTemplate(opts); .design(container)` matches | n/a |

### 5.5 Designer Control Object (DesignerCtrl)

| V1 ref | V1 method | V3 status | V3 file:line | Diff notes | Effort |
|---|---|---|---|---|---|
| [V1 15108] getTemplate() → PrintTemplate | Inner instance accessor | 🟡 PARTIAL | `build-designer.ts:441-443` | V3 `getTemplate()` returns `TemplateJson` (different semantics — V1 returns the class instance) | M |
| Extra getTpl() | V3 returns the PrintTemplate instance | ⏸️ DEFERRED | `build-designer.ts:445-447` | V3 added new method `getTpl()` to fill the semantic V1 `getTemplate()` had | n/a |
| [V1 15109] getToolbarCtrl() → toolbarCtrl | Inner toolbar ctrl | 🔴 MISSING | n/a | toolbarCtrl deleted | L |
| [V1 15110] getLeftWidth() → number | Current left px | 🔴 MISSING | n/a | No resize | n/a |
| [V1 15111] getRightWidth() → number | Current right px | 🔴 MISSING | n/a | No resize | n/a |
| [V1 15112] getComponentContainer() → DOMElement | `.hiprintEpContainer` | 🔴 MISSING | n/a | No equivalent escape hatch | M |
| [V1 15113] getTemplateContainer() → DOMElement | `.hiprint-printTemplate` | 🔴 MISSING | n/a | No equivalent | M |
| [V1 15114] getSettingContainer() → DOMElement | `.hiprint-option-setting-container` | 🔴 MISSING | n/a | No equivalent | M |
| [V1 15115] setLeftCollapsed(bool) | Programmatic collapse | 🔴 MISSING | n/a | No collapse | M |
| [V1 15116] setRightCollapsed(bool) | Same | 🔴 MISSING | n/a | Same | M |
| [V1 15117] isLeftCollapsed() | State | 🔴 MISSING | n/a | Same | M |
| [V1 15118] isRightCollapsed() | State | 🔴 MISSING | n/a | Same | M |
| [V1 15119-15123] setComponentPanelSlot(slotOptions) | Slot config update | 🔴 MISSING (no-op stub) | `build-designer.ts:449-455` | V3 logs warn; no-op stub (intentional — use Vue slots) | n/a |
| [V1 15124-15127] clearComponentPanelSlot() | Clear slot | 🔴 MISSING (no-op stub) | `build-designer.ts:457-459` | V3 no-op stub | n/a |
| [V1 15128-15142] rebuildComponentPanel(moduleName?, slotOptions?) | Empty + rebuild | 🔴 MISSING (no-op stub) | `build-designer.ts:461-467` | V3 no-op stub with warn | n/a |
| [V1 15143-15152] destroy() | Cleanup chain | ✅ DONE | `build-designer.ts:403-423` | Matches: `toolbarCtrl.destroy() + tpl.destroy() + $container.empty()` equivalent (app.unmount + tpl.destroy + Vue handles container) | n/a |
| [V1 15156-15158] setPaginationVisible(bool) | Runtime show/hide | 🔴 MISSING (no-op stub) | `build-designer.ts:469-475` | V3 no-op with warn | M |

---

## Section 6: Public API Exports (23 Total)

V3 root: `src/hiprint-v3/compat/index.ts` + `compat/hiprint-global.ts`.

| V1 ref | V1 export | V3 status | V3 file:line | Diff notes | Effort |
|---|---|---|---|---|---|
| §6.1 hiprint default namespace | Object with 23+ methods, also `window.hiprint=hiprint` | ✅ DONE | `compat/index.ts:21-34, compat/hiprint-global.ts:384` | `hiprint` exported, `window.hiprint` assigned | n/a |
| §6.2 PrintTemplate class | Class export, constructor with all V1 ctor opts | 🟡 PARTIAL | `compat/print-template.ts:123-417` | Class exported; ctor opts subset (see §7 for method coverage); ctor accepts `template/history/paginate/data/settingContainer/paginationContainer/onPreview/onPrint/onSave` but **DROPS V1 opts**: dataMode, willOutOfBounds, qtDesigner, defaultPanelName, fontList, fields, onImageChooseClick, onPanelAddClick, onDataChanged, onUpdateError | L |
| §6.3 PrintElementTypeManager (build/buildByHtml/setPanelSlot/clearPanelSlot) | Static utility | 🔴 MISSING | n/a | Not exported as named class; V3 element rendering is reactive components | M |
| §6.4 PrintElementTypeRegistry singleton with addPrintElementTypes/removePrintElementTypes/setPrintTemplateById/getPrintTemplateById/removePrintTemplateById/updateElementType/guid/init/allElementTypes/<moduleName> | Registry singleton | 🟡 PARTIAL | `compat/hiprint-global.ts:23-30 (re-export via getInstance)` | V3 `getRegistryInstance()` exposes `register/unregister/update/setDynamic/getModuleNames`; **DROPS**: setPrintTemplateById/getPrintTemplateById/removePrintTemplateById/guid/allElementTypes (different shape) | M |
| §6.5 PrintElementTypeGroup class | `new PrintElementTypeGroup(name, configs[])` | 🔴 MISSING | n/a | Not exported as class | M |
| §6.6 hiPrintPlugin Vue 3 plugin | install(app, name='$hiPrint', autoConnect=false); adds $print/$print2 globals | ✅ DONE | `compat/vue-plugin.ts:25-214` | Implemented; supports positional + options-object args | n/a |
| §6.7 defaultElementTypeProvider | Factory class | ✅ DONE | `compat/hiprint-global.ts:387` | Re-exported from `@hiprint-v3/core` | n/a |
| §6.8 buildDesigner | Function signature matches V1 | 🟡 PARTIAL | `compat/build-designer.ts:226-478` | Implemented but ctrl missing many methods (see §5.5) | L |
| §6.9 buildToolbar | Function signature matches V1 | 🟡 PARTIAL | `compat/build-toolbar.ts:79-152` | Implemented but toolbarCtrl reduced to {destroy, getScale, setScale}; **dropped 39 methods** | L |
| §6.10 setDynamicFields(moduleName, fieldGroups) | Throws if moduleName empty; validates fields via SUPPORTED_ELEMENT_TYPES | 🟡 PARTIAL | `compat/hiprint-global.ts:244-256` | Throws on empty moduleName + empty fields; **does NOT validate field.type against SUPPORTED_ELEMENT_TYPES** | S |
| §6.11 removeDynamicFields(moduleName) | Single-arg | 🟡 PARTIAL | `compat/hiprint-global.ts:258-265` | V3 signature is `(moduleName, tids?)` — extra optional tids arg; warns instead of throwing for empty moduleName | S |
| §6.12 setElementTypeGroups(moduleName, groups) | Throws if moduleName empty; normalizes (default tid/title/type) | 🟡 PARTIAL | `compat/hiprint-global.ts:267-273` | Throws; calls `registry.setDynamic`; normalization differs | S |
| §6.13 appendElementTypeGroups(moduleName, groups) | Throws if empty; additive | ✅ DONE | `compat/hiprint-global.ts:275-282` | Implemented | n/a |
| §6.14 renameElementType(tid, title) | Delegates to registry.updateElementType | ✅ DONE | `compat/hiprint-global.ts:284-294` | Implemented | n/a |
| §6.15 print (direct) | `print(data: object): void`; `bind(hiprint)` required | 🟡 PARTIAL | `compat/hiprint-global.ts:333-341` | V3 signature `print(template, data)` — takes template arg, creates ad-hoc PrintTemplate, prints, destroys; different invocation shape | M |
| §6.16 print2 (silent via socket) | `print2(opts: {imgToBase64, options, ...}, onSuccess?, onError?)` | 🟡 PARTIAL | `compat/hiprint-global.ts:343-353` | V3 signature `print2(template, data, options)` — different shape; no onSuccess/onError | M |
| §6.17 getHtml(opts) → jQuery | `getHtml({templates: [{template,data,options}], imgToBase64})` returns jQuery wrapped div | 🟡 PARTIAL | `compat/hiprint-global.ts:355-362` | V3 signature `getHtml(template, data)` returns string (not jQuery), single template arg | M |
| §6.18 autoConnect(cb?) | Side-effect: window.autoConnect=true; hiwebSocket.start | ✅ DONE | `compat/hiprint-global.ts:296-303` | Implemented (different shape `(host?, token?, cb?)`) | n/a |
| §6.19 disAutoConnect() | Side-effect: window.autoConnect=false; hiwebSocket.stop | ✅ DONE | `compat/hiprint-global.ts:305-307` | Implemented | n/a |
| §6.20 getClients(cb) | clear+on+hiwebSocket.getClients | 🟡 PARTIAL | `compat/hiprint-global.ts:313-315` | V3 `getClients()` takes no cb arg; differs | S |
| §6.21 getClientInfo(cb) | Same pattern | 🟡 PARTIAL | `compat/hiprint-global.ts:317-319` | V3 no cb arg | S |
| §6.22 getAddress(type, cb, ...args) | Same pattern | 🟡 PARTIAL | `compat/hiprint-global.ts:321-323` | V3 `(type, ...args)` no cb arg | S |
| §6.23 ippPrint(options, cb, connectedCb) | ippPrint | 🟡 PARTIAL | `compat/hiprint-global.ts:325-327` | V3 `ippPrint(options)` only — no callbacks | S |
| §6.23 ippRequest(options, cb) | ippRequest | 🟡 PARTIAL | `compat/hiprint-global.ts:329-331` | V3 `(options)` only | S |
| Bonus: refreshPrinterList | V1 hiprint.refreshPrinterList | 🔴 MISSING | n/a | Not exported | S |
| Bonus: hiwebSocket | V1 hiprint.hiwebSocket accessor | ✅ DONE | `compat/hiprint-global.ts:309-311` | Implemented (getter) | n/a |
| Bonus: hiprint.init | Initialize providers | ✅ DONE | `compat/hiprint-global.ts:197-229` | Implemented; supports 3 V1 shapes (factory function, undefined, `{providers:[...]}`)  | n/a |
| Bonus: hiprint.setConfig | V1 reactive config patch | 🟡 PARTIAL | `compat/hiprint-global.ts:231-242` | V3 no-op + warn (intentional per architecture note) | n/a |
| Bonus: hiprint.updateElementType | V1 alternative to renameElementType | 🔴 MISSING | n/a | Not exposed as method on facade | S |
| §6.6+ version pinned `'3.0.0'` | V1 version reflects package.json | ⚠️ VIOLATION | `compat/hiprint-global.ts:195` | V3 hardcodes `'3.0.0'`; not synced to package.json | S |

---

## Section 7: PrintTemplate Public Methods (67 total)

V3 root: `src/hiprint-v3/compat/print-template.ts` (417 lines, **14 public methods + 1 getter + 1 internal**).

| # | V1 method | V1 line | V3 status | V3 file:line | Diff notes | Effort |
|---|---|---|---|---|---|---|
| 1 | design(t, e?) | [V1 12375-12400] | 🟡 PARTIAL | `print-template.ts:189-225` | Implemented; **NO** re-bind of jQuery `.hiprint` namespace, no `_designed` re-entry check (V3 unmounts prev app); no defaultPanel creation pattern matching V1 (`createDefaultPanel` instead seeds via ctor) | M |
| 2 | getSimpleHtml(t, e?) | [V1 12401-12421] | 🔴 MISSING | n/a | V3 only has `getHtml(data)` returning string | M |
| 3 | getSimpleHtmlAsync(t, e?) | [V1 12422-12459] | 🔴 MISSING | n/a | No async variant; no `generateHTMLInterval` chunking | M |
| 4 | getHtml(t, e?) | [V1 12460-12462] | 🟡 PARTIAL | `print-template.ts:263-272` | V3 returns string (not jQuery wrapped div); single data arg, no `e` (options) param | M |
| 5 | getHtmlAsync(t, e?) | [V1 12463-12465] | 🔴 MISSING | n/a | No async variant | M |
| 6 | getJointHtml(t, e, n) | [V1 12466-12472] | 🔴 MISSING | n/a | No joint HTML method | M |
| 7 | setPaper(t, e?) | [V1 12473-12479] | 🔴 MISSING | n/a | No method on V3 PrintTemplate; canvas.updatePanel is the V3 way (different surface) | M |
| 8 | rotatePaper() | [V1 12480-12482] | 🔴 MISSING | n/a | No method; toolbar handles rotation by updating panel directly | S |
| 9 | alignElements(type) | [V1 12483-12485] | 🔴 MISSING | n/a | No method; toolbar does inline align math | M |
| 10 | zoom(s, p?) | [V1 12486-12488] | 🔴 MISSING | n/a | No method; canvas.setScale is V3 way | S |
| 11 | addPrintPanel(t?, e?) | [V1 12489-12492] | 🔴 MISSING | n/a | No method; canvas.addPanel is V3 way | M |
| 12 | selectPanel(t) | [V1 12493-12499] | 🔴 MISSING | n/a | No method; canvas.setActivePanel(id) is V3 way (but uses id not index — different API surface) | M |
| 13 | deletePanel(t) | [V1 12500-12515] | 🔴 MISSING | n/a | No method; canvas.removePanel(id) is V3 way (id-based vs index-based) | M |
| 14 | getPaneltotal() | [V1 12516-12518] | 🔴 MISSING | n/a | No method; `canvas.panels.length` is V3 way | S |
| 15 | createDefaultPanel() | [V1 12519-12525] | 🔴 MISSING | n/a | Internal in V3 ctor only | n/a |
| 16 | createContainer(t) | [V1 12526-12528] | 🔴 MISSING | n/a | Internal Vue mount via `design()` | n/a |
| 17 | getJsonTid() | [V1 12529-12536] | 🟡 PARTIAL | `print-template.ts:255-257` | Aliased to `getJson()` — V1 had distinct semantics (only non-empty panels in tid mode) | M |
| 18 | getJson() | [V1 12537-12544] | ✅ DONE | `print-template.ts:245-249` | Returns fresh structured clone | n/a |
| 19 | undo(t?) | [V1 12545-12547] | ✅ DONE | `print-template.ts:351-355` | Implemented via `useHistoryStore().undo()` | n/a |
| 20 | redo(t?) | [V1 12548-12550] | ✅ DONE | `print-template.ts:358-362` | Implemented | n/a |
| 21 | isDestroyed() | [V1 12551-12553] | 🔴 MISSING | n/a | Public property `_destroyed` exposed instead; no method | S |
| 22 | _assertNotDestroyed(name) | [V1 12554-12561] | 🟡 PARTIAL | `@hiprint-v3/internal::assertNotDestroyed` | V3 uses module-level utility; not on instance | n/a |
| 23 | getPrintElementSelectEventKey() | [V1 12562-12564] | 🔴 MISSING | n/a | No event-bus keys in V3 | n/a |
| 24 | getBuildCustomOptionSettingEventKey() | [V1 12565-12567] | 🔴 MISSING | n/a | No event-bus keys | n/a |
| 25 | clear() | [V1 12568-12575] | 🟡 PARTIAL | `print-template.ts:365-369` | Implemented but V3 clears all panels then rebuilds defaults; V1 kept panel[0] | S |
| 26 | destroy() | [V1 12576-12641] | 🟡 PARTIAL | `print-template.ts:388-406` | Implemented + idempotent; **DROPS V1 cleanup steps**: no `s.a.instance.draging=false` reset (V3 no global), no body class removal, no 4-event-bus offs, no per-panel `.off('.hiprint')`, no `_elListPanel/_elListToggle` removal, no singleton-map identity check, no `target.empty()/container.empty()`, no `printPanels=[],template=null,lastJson=null,historyList=[]` nullify | M |
| 27 | getPaperType(t?) | [V1 12642-12644] | 🔴 MISSING | n/a | No method; `canvas.panels[idx].paperType` is V3 way | S |
| 28 | getOrient(t?) | [V1 12645-12647] | 🔴 MISSING | n/a | No method | S |
| 29 | getPrintStyle(t?) | [V1 12648-12650] | 🔴 MISSING | n/a | No method | S |
| 30 | print(t, e?, o?) | [V1 12651-12653] | 🟡 PARTIAL | `print-template.ts:280-287` | V3 takes only `data` arg; no `e` (options) or `o` (hiwprint opts); uses V3 browserPrint() pipeline instead of `.hiwprint()` jQuery plugin | S |
| 31 | print2(t, e?) | [V1 12654-12690] | 🟡 PARTIAL | `print-template.ts:295-316` | V3 takes (data, options); **DROPS** print-lock.css link load + XHR diagnostics (V1 throws if `link[media=print][href*="print-lock"]` not found); uses different payload shape `{type:'PRINT', templateId, html, data, ...options}` vs V1 hiwebSocket protocol | M |
| 32 | imageToBase64(t) | [V1 12691-12708] | 🔴 MISSING | n/a | V3 uses `imgToBase64` in print pipeline differently; no instance method | S |
| 33 | xhrLoadImage(t) | [V1 12709-12711] | 🔴 MISSING | n/a | V1 empty body | n/a |
| 34 | sentToClient(t, e, n?) | [V1 12711-12732] | 🔴 MISSING | n/a | Internal V1 method; V3 has `print/print2` instead | n/a |
| 35 | printByHtml(t) | [V1 12733-12735] | 🔴 MISSING | n/a | No method | M |
| 36 | printByHtml2(t, e?) | [V1 12736-12764] | 🔴 MISSING | n/a | No method | M |
| 37 | deletePrintElement(t) | [V1 12765-12769] | 🔴 MISSING | n/a | No method; `canvas.removeElement(panelId, elementId)` is V3 way | M |
| 38 | transformImg(t) | [V1 12770-12775] | 🔴 MISSING | n/a | No method | S |
| 39 | toPdf(t, e, options?) → jQuery.Promise | [V1 12776-12834] | 🟡 PARTIAL | `print-template.ts:321-334` | V3 signature `(data?, name?) → Promise<Blob>`; returns Promise<Blob> not jQuery.Promise; **DROPS**: orient/unit/format from options, jsPDF instantiation, svg2canvas+domtoimage chain, `s.save()` vs `s.output()` mode toggle (V3 always returns blob — caller does `toPdfDownload` separately) | L |
| 40 | createTempContainer() | [V1 12835-12836] | 🔴 MISSING | n/a | Internal V1; V3 uses jspdf.html() | n/a |
| 41 | removeTempContainer() | [V1 12837-12838] | 🔴 MISSING | n/a | Internal V1 | n/a |
| 42 | getTempContainer() | [V1 12839-12840] | 🔴 MISSING | n/a | Internal V1 | n/a |
| 43 | svg2canvas(t) | [V1 12841-12850] | 🔴 MISSING | n/a | Internal V1 toPdf helper | n/a |
| 44 | parentWidthHeight(t) | [V1 12851-12859] | 🔴 MISSING | n/a | Internal V1 helper | n/a |
| 45 | on(t, e) | [V1 12860-12863] | 🔴 MISSING | n/a | V3 has no event subscription on PrintTemplate (Pinia reactivity replaces it) | M |
| 46 | clientIsOpened() | [V1 12864-12865] | 🔴 MISSING | n/a | V3 has `getHiWebSocket().opened` | S |
| 47 | getPrinterList() | [V1 12866-12869] | 🔴 MISSING | n/a | No method | S |
| 48 | getElementByTid(t, e?) | [V1 12870-12872] | 🔴 MISSING | n/a | No method; canvas store iterate is V3 way | M |
| 49 | getElementByName(t, e?) | [V1 12873-12875] | 🔴 MISSING | n/a | Same | M |
| 50 | getPanel(t?) | [V1 12876-12878] | 🔴 MISSING | n/a | No method; `canvas.panels[t || 0]` is V3 way | S |
| 51 | loadAllImages(t, e, n?) | [V1 12879-12897] | 🔴 MISSING | n/a | No method | M |
| 52 | setFontList(t) | [V1 12898-12900] | 🔴 MISSING | n/a | No method | S |
| 53 | getFontList() | [V1 12901-12903] | 🔴 MISSING | n/a | No method | S |
| 54 | setFields(t) | [V1 12904-12906] | 🔴 MISSING | n/a | No method (V1 quirk for binding data fields list) | M |
| 55 | getFields() | [V1 12907-12909] | 🔴 MISSING | n/a | No method | S |
| 56 | setOnImageChooseClick(t) | [V1 12910-12912] | 🔴 MISSING | n/a | No method | S |
| 57 | getOnImageChooseClick() | [V1 12913-12915] | 🔴 MISSING | n/a | No method | S |
| 58 | getFieldsInPanel() | [V1 12916-12921] | 🔴 MISSING | n/a | No method | M |
| 59 | getTestData() | [V1 12922-12927] | 🔴 MISSING | n/a | No method (used by V1 designer to populate test data) | M |
| 60 | update(t, idx?) | [V1 12928-12950] | 🟡 PARTIAL | `print-template.ts:231-239` | V3 takes `(json)` only — **idx arg dropped**; V3 wraps in try/catch with console.error but **NO `onUpdateError` callback** invocation | S |
| 61 | getSelectEls() | [V1 12951-12962] | 🔴 MISSING | n/a | No method; `canvas.selectedElements` is V3 way | S |
| 62 | selectElementsByField(fieldsArray) | [V1 12964-12975] | 🔴 MISSING | n/a | No method | M |
| 63 | selectAllElements() | [V1 12976-12986] | 🔴 MISSING | n/a | No method (also no Ctrl+A keyboard binding) | M |
| 64 | updateOption(option, v) | [V1 12987-12994] | 🔴 MISSING | n/a | No method; canvas.updateElement is per-element | M |
| 65 | setElsAlign(e) | [V1 12995-13073] | 🔴 MISSING | n/a | No method (note V1 uses different naming `left/vertical/right/top/horizontal/bottom/distributeHor/distributeVer`) | M |
| 66 | setElsSpace(dis, isHor) | [V1 13074-13099] | 🔴 MISSING | n/a | No method | M |
| 67 | initAutoSave() | [V1 13100-13152] | 🔴 MISSING | n/a | V3 history is Pinia store with auto-snapshot via mutations; no manual subscribe | n/a |
| Bonus: save() | (V3 only) | ⏸️ DEFERRED | `print-template.ts:376-382` | V3 added a save method (mark dirty=false + emit onSave) | n/a |
| Bonus: toPdfDownload() | (V3 only) | ⏸️ DEFERRED | `print-template.ts:337-348` | V3 added download convenience method | n/a |
| Bonus: _getPinia() | (V3 only) | ⏸️ DEFERRED | `print-template.ts:414-416` | V3 internal accessor for sharing Pinia with toolbar | n/a |

**Coverage**: 14 ✅/🟡 of 67 V1 methods = 21% method-level parity. 53 methods missing.

---

## Section 8A: buildToolbar opts (76 total)

V3 root: `src/hiprint-v3/components/HiprintToolbar.vue` props + `compat/build-toolbar.ts` BuildToolbarOptions.

| # | V1 opt | V1 line | V3 status | V3 file:line | Diff notes | Effort |
|---|---|---|---|---|---|---|
| 1 | paperTypes (_defaultPaperTypes A3/A4/A5/B3/B4/B5) | [V1 13316] | ⚠️ VIOLATION | `HiprintToolbar.vue:226-232` | V3 default missing B3, swaps A3 dimensions, rounds all values (see §1.15) | S |
| 2 | defaultPaper ('A4') | [V1 13317] | ✅ DONE | `HiprintToolbar.vue:233` | matches | n/a |
| 3 | scaleMin (0.5) | [V1 13318] | ✅ DONE | `HiprintToolbar.vue:234` | matches | n/a |
| 4 | scaleMax (5) | [V1 13319] | ✅ DONE | `HiprintToolbar.vue:235` | matches | n/a |
| 5 | scaleStep (0.1) | [V1 13320] | ✅ DONE | `HiprintToolbar.vue:236` | matches | n/a |
| 6 | showPaperSelect (true) | [V1 13321] | ✅ DONE | `HiprintToolbar.vue:252` | matches | n/a |
| 7 | showCustomPaper (true) | [V1 13322] | ✅ DONE | `HiprintToolbar.vue:253` | matches | n/a |
| 8 | showScale (true) | [V1 13323] | ✅ DONE | `HiprintToolbar.vue:256` | matches | n/a |
| 9 | showRotate (true) | [V1 13324] | ✅ DONE | `HiprintToolbar.vue:254` | matches | n/a |
| 10 | showAlign (true) | [V1 13325] | ✅ DONE | `HiprintToolbar.vue:255` | matches | n/a |
| 11 | showPreview (true) | [V1 13326] | ✅ DONE | `HiprintToolbar.vue:244` | matches | n/a |
| 12 | showClear (true) | [V1 13327] | ✅ DONE | `HiprintToolbar.vue:247` | matches | n/a |
| 13 | showPrint (true) | [V1 13328] | ✅ DONE | `HiprintToolbar.vue:245` | matches | n/a |
| 14 | onPreview(template) | [V1 13329] | 🟡 PARTIAL | `HiprintToolbar.vue:150, 540-555` | Implemented; **V3 always runs default preview window AFTER calling onPreview unless `previewHandler` is used** — V1 had no default preview (just warned) | M |
| 15 | onClear(template) total takeover | [V1 13330] | 🟡 PARTIAL | `HiprintToolbar.vue:152, 616-621` | Implemented as emit + prop; **V3 always runs `tpl.clear()` after emit** — no takeover semantics (V1 skipped both onClearConfirm and confirm()); 3-tier missing | M |
| 16 | onPrint(template) | [V1 13331] | 🟡 PARTIAL | `HiprintToolbar.vue:151, 587-600` | Same as onPreview — V3 always runs default print after | M |
| 17 | onSave(template, json, event, api, {name}) | [V1 13332] | 🟡 PARTIAL | `HiprintToolbar.vue:153-159, 494-515` | 5-arg signature emitted but event=null, api=undefined, name not threaded from dialog (dialog not wired) | S |
| 18 | onPaperChange(name, size) | [V1 13333] | 🟡 PARTIAL | `HiprintToolbar.vue:160-164, 687-706` | Implemented; **V3 swaps arg order** to `(tpl, name, size)` (extra tpl prepended) | S |
| 19 | onScaleChange(scale) | [V1 13334] | 🟡 PARTIAL | `HiprintToolbar.vue:170-173, 730-732` | Same — `(tpl, scale)` arg order swap | S |
| 20 | onRotate(template) | [V1 13335] | 🟡 PARTIAL | `HiprintToolbar.vue:165, 749` | Single-arg `(tpl)` matches V1 shape | n/a |
| 21 | onAlign(type, template) | [V1 13336] | 🟡 PARTIAL | `HiprintToolbar.vue:166-169, 822` | **V3 swaps arg order to `(tpl, type)`** — V1 was `(type, template)` | S |
| 22 | showBusinessSelect (true) | [V1 13337] | ⚠️ VIOLATION | `HiprintToolbar.vue:260` | V3 default false (see §1.1) | S |
| 23 | businessButtonText ("业务选择") | [V1 13338] | 🔴 MISSING | n/a | Hardcoded label | S |
| 24 | onBusinessClick(template, api) → bool | [V1 13339] | 🔴 MISSING | n/a | V3 only emits `businessSelectClick` — no return-bool semantics, no pre-dialog hook chain | M |
| 25 | onBusinessDialogOpen(context) → bool | [V1 13340] | 🔴 MISSING | n/a | Not implemented | M |
| 26 | onBusinessDialogClose(context) → bool | [V1 13341] | 🔴 MISSING | n/a | Not implemented | M |
| 27 | businessDialogTitle ("选择业务") | [V1 13342] | 🟡 PARTIAL | `HiprintDesigner.vue:247` | V3 has `businessDialogTitle` prop with default `'业务场景'`; different default text | S |
| 28 | businessDialogEmptyText ("暂无业务") | [V1 13343] | 🔴 MISSING | n/a | Not exposed as opt | S |
| 29 | businessDialogLoadingText ("业务加载中...") | [V1 13344] | 🔴 MISSING | n/a | Not exposed | S |
| 30 | businessDialogErrorText ("业务加载失败") | [V1 13345] | 🔴 MISSING | n/a | Not exposed | S |
| 31 | businessListProvider(template, api) | [V1 13346] | 🔴 MISSING | n/a | V3 parent passes items directly via `businessDialogItems` prop | M |
| 32 | businessLoader(item, template, api) | [V1 13347] | 🔴 MISSING | n/a | No per-item loader pattern | M |
| 33 | onBusinessSelect(item, data, template, api) | [V1 13348] | 🟡 PARTIAL | `HiprintDesigner.vue` (businessDialogSelect emit) | V3 emits `businessDialogSelect: [item]` only — missing data/template/api args | M |
| 34 | closeBusinessDialogOnSelect (true) | [V1 13349] | 🔴 MISSING | n/a | Not exposed | S |
| 35 | onTemplateDialogOpen(context) → bool | [V1 13350] | 🔴 MISSING | n/a | Not implemented | M |
| 36 | onTemplateDialogClose(context) → bool | [V1 13351] | 🔴 MISSING | n/a | Not implemented | M |
| 37 | onTemplateDeleteConfirm(context) → Promise<bool>\|bool | [V1 13352] | 🔴 MISSING | n/a | Not implemented | M |
| 38 | showTemplateSelect (true) | [V1 13353] | ⚠️ VIOLATION | `HiprintToolbar.vue:259` | V3 default false | S |
| 39 | showSave (true) | [V1 13354] | ✅ DONE | `HiprintToolbar.vue:243` | matches | n/a |
| 40 | showPanelManager (false) | [V1 13357] | ⚠️ VIOLATION | `HiprintToolbar.vue:251` | V3 default true (opposite of V1) | S |
| 41 | panelManagerLabel ("分页") | [V1 13358] | 🟡 PARTIAL | `HiprintToolbar.vue:274` | V3 default `''` not "分页" | S |
| 42 | addPanelButtonText ('+') | [V1 13359] | ✅ DONE | `HiprintToolbar.vue:275` | matches | n/a |
| 43 | templateButtonText ("选择模版") | [V1 13360] | 🔴 MISSING | n/a | Hardcoded `'📋 Templates'` | S |
| 44 | onSaveDialogOpen(context) → bool | [V1 13361] | 🔴 MISSING | n/a | Save dialog flow not wired | M |
| 45 | onSaveDialogClose(context) → bool | [V1 13362] | 🔴 MISSING | n/a | Same | M |
| 46 | customPaperButtonText ("自定义") | [V1 13363] | 🔴 MISSING | n/a | Hardcoded `'⚙'` | S |
| 47 | customPaperConfirmText ("确定") | [V1 13364] | 🔴 MISSING | n/a | Hardcoded `'Apply'` in popover | S |
| 48 | rotateButtonText ("旋转") | [V1 13365] | 🔴 MISSING | n/a | Hardcoded | S |
| 49 | previewButtonText ("预览") | [V1 13366] | 🔴 MISSING | n/a | Hardcoded | S |
| 50 | clearButtonText ("清空") | [V1 13367] | 🔴 MISSING | n/a | Hardcoded | S |
| 51 | printButtonText ("打印") | [V1 13368] | 🔴 MISSING | n/a | Hardcoded | S |
| 52 | saveButtonText ("保存") | [V1 13369] | 🔴 MISSING | n/a | Hardcoded | S |
| 53 | saveDialogTitle ("保存模版") | [V1 13370] | 🟡 PARTIAL | `HiprintDesigner.vue:251` | Title prop exists; default `'保存模板'` not "保存模版" | S |
| 54 | saveDialogNameLabel ("模版名称") | [V1 13371] | 🔴 MISSING | n/a | Not exposed | S |
| 55 | saveDialogNamePlaceholder | [V1 13372] | 🔴 MISSING | n/a | Not exposed | S |
| 56 | saveDialogNameRequiredText | [V1 13373] | 🔴 MISSING | n/a | Not exposed | S |
| 57 | saveDialogConfirmText | [V1 13374] | 🔴 MISSING | n/a | Not exposed | S |
| 58 | saveDialogCancelText | [V1 13375] | 🔴 MISSING | n/a | Not exposed | S |
| 59 | templateDialogTitle ("选择模版") | [V1 13376] | 🟡 PARTIAL | `HiprintDesigner.vue:243` | Title prop exists; default `'模板选择'` | S |
| 60 | templateDialogEmptyText | [V1 13377] | 🔴 MISSING | n/a | Not exposed | S |
| 61 | templateDialogLoadingText | [V1 13378] | 🔴 MISSING | n/a | Not exposed | S |
| 62 | templateDialogErrorText | [V1 13379] | 🔴 MISSING | n/a | Not exposed | S |
| 63 | templateListProvider | [V1 13380] | 🔴 MISSING | n/a | V3 parent passes items via `templateDialogItems` prop | M |
| 64 | templateLoader | [V1 13381] | 🔴 MISSING | n/a | No loader | M |
| 65 | onTemplateSelect(item, json, template, api) | [V1 13382] | 🟡 PARTIAL | `HiprintDesigner.vue` (templateDialogSelect emit) | Emits `(item)` only; missing json/template/api | M |
| 66 | onTemplatePreview(item, template, api) | [V1 13383] | 🔴 MISSING | n/a | V3 TemplateDialog has no `preview` emit/action button | M |
| 67 | onTemplateEdit(item, template, api) | [V1 13384] | 🟡 PARTIAL | `TemplateDialog.vue:84-85` | Emits `edit: [item]` only; missing template/api | S |
| 68 | onTemplateDelete(item, template, api) → Promise<bool>\|bool | [V1 13385] | 🟡 PARTIAL | `TemplateDialog.vue:86-87` | Emits `delete: [item]` only; no async bool return contract | M |
| 69 | closeTemplateDialogOnSelect (true) | [V1 13386] | 🔴 MISSING | n/a | Not exposed | S |
| 70 | extraPosition ('end') | [V1 13387] | ✅ DONE | `HiprintToolbar.vue:279` | matches | n/a |
| 71 | extraButtons ([]) | [V1 13388] | 🟡 PARTIAL | `HiprintToolbar.vue:278, 92-103` | Implemented with 9 of 11 fields (see §1.26) | M |
| 72 | renderExtra(toolbarApi) | [V1 13389] | 🔴 MISSING | n/a | Not implemented (toolbarApi deleted) | M |
| 73 | alignItems (defaultAlignItems 8 items) | [V1 14368-14370] | 🟡 PARTIAL | `HiprintToolbar.vue:277, 414-416` | Prop accepts 6 alignment types (V3's set); does NOT accept the V1 `{type, label, icon}` object shape — V3 takes only strings ('left'/'center'/etc.); **drops distributeHorizontal/distributeVertical** | L |
| 74 | onClearConfirm(template) → Promise<bool>\|bool | [V1 14409-14422] | 🔴 MISSING | n/a | Not implemented (see §1.7) | M |
| 75 | onCustomPaperOpen(template, api) → bool | [V1 14281-14283] | 🔴 MISSING | n/a | Not implemented (see §1.17) | M |
| 76 | onTemplateSelectError(err, item, template, api) | [V1 13909] | 🔴 MISSING | n/a | Not implemented (see §2.2) | M |

**Coverage**: 30 ✅/🟡 of 76 V1 opts = 39% opt-level parity. 46 opts missing or violated.

---

## Section 8A.2: toolbarCtrl Returned Methods (42 total)

V3 root: `src/hiprint-v3/compat/build-toolbar.ts` ToolbarController (DELIBERATELY REDUCED).

| # | V1 method | V1 line | V3 status | V3 file:line | Diff notes | Effort |
|---|---|---|---|---|---|---|
| 1 | getScale() | [V1 14724] | ✅ DONE | `build-toolbar.ts:139-143` | matches | n/a |
| 2 | setScale(v) | [V1 14725-14731] | ✅ DONE | `build-toolbar.ts:145-149` | matches | n/a |
| 3 | openBusinessDialog() | [V1 14732-14734] | 🔴 MISSING | n/a | toolbarCtrl deleted | L |
| 4 | closeBusinessDialog() | [V1 14735-14737] | 🔴 MISSING | n/a | Same | L |
| 5 | refreshBusinessList() | [V1 14738-14740] | 🔴 MISSING | n/a | Same | L |
| 6 | setBusinessItems(list) | [V1 14741-14743] | 🔴 MISSING | n/a | Same | L |
| 7 | getBusinessItems() | [V1 14744-14746] | 🔴 MISSING | n/a | Same | L |
| 8 | setBusinessListProvider(fn) | [V1 14747-14749] | 🔴 MISSING | n/a | Same | L |
| 9 | setBusinessLoader(fn) | [V1 14750-14752] | 🔴 MISSING | n/a | Same | L |
| 10 | getBusinessDialogElement() | [V1 14753-14755] | 🔴 MISSING | n/a | Same | L |
| 11 | openTemplateDialog() | [V1 14756-14758] | 🔴 MISSING | n/a | Same | L |
| 12 | closeTemplateDialog() | [V1 14759-14761] | 🔴 MISSING | n/a | Same | L |
| 13 | getTemplateDialogElement() | [V1 14762-14764] | 🔴 MISSING | n/a | Same | L |
| 14 | openSaveDialog(defaultName?) | [V1 14765-14767] | 🔴 MISSING | n/a | Same | L |
| 15 | closeSaveDialog() | [V1 14768-14770] | 🔴 MISSING | n/a | Same | L |
| 16 | getSaveDialogElement() | [V1 14771-14773] | 🔴 MISSING | n/a | Same | L |
| 17 | refreshTemplateList() | [V1 14774-14776] | 🔴 MISSING | n/a | Same | L |
| 18 | setTemplateItems(list) | [V1 14777-14779] | 🔴 MISSING | n/a | Same | L |
| 19 | getTemplateItems() | [V1 14780-14782] | 🔴 MISSING | n/a | Same | L |
| 20 | setTemplateListProvider(fn) | [V1 14783-14785] | 🔴 MISSING | n/a | Same | L |
| 21 | setTemplateLoader(fn) | [V1 14786-14788] | 🔴 MISSING | n/a | Same | L |
| 22 | setDialogHandler(key, fn) | [V1 14789-14791] | 🔴 MISSING | n/a | Same | L |
| 23 | getDialogHandler(key) | [V1 14792-14794] | 🔴 MISSING | n/a | Same | L |
| 24 | setBusinessDialogOpenHandler(fn) | [V1 14795-14797] | 🔴 MISSING | n/a | Same | L |
| 25 | setBusinessDialogCloseHandler(fn) | [V1 14798-14800] | 🔴 MISSING | n/a | Same | L |
| 26 | setTemplateDialogOpenHandler(fn) | [V1 14801-14803] | 🔴 MISSING | n/a | Same | L |
| 27 | setTemplateDialogCloseHandler(fn) | [V1 14804-14806] | 🔴 MISSING | n/a | Same | L |
| 28 | setSaveDialogOpenHandler(fn) | [V1 14807-14809] | 🔴 MISSING | n/a | Same | L |
| 29 | setSaveDialogCloseHandler(fn) | [V1 14810-14812] | 🔴 MISSING | n/a | Same | L |
| 30 | setTemplateDeleteConfirmHandler(fn) | [V1 14813-14815] | 🔴 MISSING | n/a | Same | L |
| 31 | triggerSave(payload?) | [V1 14816-14818] | 🔴 MISSING | n/a | Same | L |
| 32 | getButton(key) | [V1 14819-14821] | 🔴 MISSING | n/a | Same | L |
| 33 | getButtons() | [V1 14822-14824] | 🔴 MISSING | n/a | Same | L |
| 34 | setButtonVisible(key, bool) | [V1 14825-14827] | 🔴 MISSING | n/a | Same | L |
| 35 | setButtonDisabled(key, bool) | [V1 14828-14830] | 🔴 MISSING | n/a | Same | L |
| 36 | setButtonText(key, text, useHtml?) | [V1 14831-14833] | 🔴 MISSING | n/a | Same | L |
| 37 | triggerButton(key) | [V1 14834-14836] | 🔴 MISSING | n/a | Same | L |
| 38 | getGroup(groupKey) | [V1 14837-14839] | 🔴 MISSING | n/a | Same | L |
| 39 | getGroups() | [V1 14840-14842] | 🔴 MISSING | n/a | Same | L |
| 40 | setGroupVisible(groupKey, bool) | [V1 14843-14845] | 🔴 MISSING | n/a | Same | L |
| 41 | getToolbarElement() | [V1 14846] | ⏸️ DEFERRED | `HiprintToolbar.vue:855-859` (defineExpose `getRootEl`) | Available via SFC ref, not on `toolbarCtrl` (which is reduced). Different surface | n/a |
| 42 | destroy() | [V1 14847-14854] | ✅ DONE | `build-toolbar.ts:129-137` | matches | n/a |

**Coverage**: 3 ✅ of 42 V1 toolbarCtrl methods = 7%. **Intentional architectural break per `build-designer.ts:18-22` ("V1 imperative toolbar manipulation has been removed")**. Business code must migrate to reactive props on `<HiprintToolbar>` / `<HiprintDesigner>`. This is the biggest single source of breakage.

---

## Section 8B: buildDesigner opts (15 total)

(See §5.2 above for full table — duplicated here per V1 inventory convention.)

| # | V1 opt | V1 line | V3 status | V3 file:line | Diff notes | Effort |
|---|---|---|---|---|---|---|
| 1 | leftWidth (200) | [V1 14861] | ⏸️ DEFERRED | `build-designer.ts` (silently ignored) | No resize bars in V3 | n/a |
| 2 | rightWidth (280) | [V1 14862] | ⏸️ DEFERRED | same | same | n/a |
| 3 | leftMinWidth (140) | [V1 14863] | ⏸️ DEFERRED | same | same | n/a |
| 4 | leftMaxWidth (400) | [V1 14864] | ⏸️ DEFERRED | same | same | n/a |
| 5 | rightMinWidth (200) | [V1 14865] | ⏸️ DEFERRED | same | same | n/a |
| 6 | rightMaxWidth (500) | [V1 14866] | ⏸️ DEFERRED | same | same | n/a |
| 7 | leftCollapsed (false) | [V1 14867] | 🔴 MISSING | n/a | No collapse | M |
| 8 | rightCollapsed (false) | [V1 14868] | 🔴 MISSING | n/a | No collapse | M |
| 9 | componentModule ('defaultModule') | [V1 14869] | 🟡 PARTIAL | `build-designer.ts:167` | Accepted; not wired to filter HiprintElementList | M |
| 10 | componentPanelSlot (null) | [V1 14870] | 🔴 MISSING (no-op stub) | `build-designer.ts:449-455` | Stub with warn | n/a |
| 11 | templateOptions ({}) | [V1 14871] | 🟡 PARTIAL | `build-designer.ts:235-248` | Drops 9+ V1 sub-opts | L |
| 12 | toolbarOptions ({}) | [V1 14872] | 🟡 PARTIAL | `build-designer.ts:236, 300-339` | 30 of 76 forwarded | L |
| 13 | onReady(template, toolbarCtrl) | [V1 14873] | 🟡 PARTIAL | `build-designer.ts:366-374` | V3 calls with `(tpl)` — toolbarCtrl removed | M |
| 14 | showPagination (false) | [V1 14876] | ⚠️ VIOLATION | `HiprintToolbar.vue:276` | V3 default true; also V3 pagination is inline toolbar not bottom strip | S |
| 15 | designerId (auto) | [V1 14892] | 🔴 MISSING | n/a | Not used in V3 | n/a |

---

## Section 9: Data Structures

| V1 ref | V1 structure | V3 status | V3 file:line | Diff notes | Effort |
|---|---|---|---|---|---|
| §9.1 Template JSON schema (panels[].printElements[].options/printElementType) | Schema | ✅ DONE | `@hiprint-v3/schemas templateSchema` | Zod schema — `.loose()` superset accepting any V1 JSON | n/a |
| §9.2 normalizeBusinessItem (`_bid`, `_name`, `_idx`) | Normalizer | 🔴 MISSING | n/a | Not implemented (see §2.1) | M |
| §9.2 normalizeTemplateItem (`_tid`, `_name`, `_idx`) | Normalizer | 🔴 MISSING | n/a | Not implemented (see §2.2) | M |
| §9.3 extraBtnOpt interface (11 fields) | TypeScript interface | 🟡 PARTIAL | `HiprintToolbar.vue:92-103` | 9 of 11 fields supported (see §1.26) | M |
| §9.4 _defaultPaperTypes (A3/A4/A5/B3/B4/B5 dict) | Constant | ⚠️ VIOLATION | `HiprintToolbar.vue:226-232` | V3 default wrong (see §1.15) | S |
| §9.5 defaultAlignItems (8 entries) | Constant | ⚠️ VIOLATION | `HiprintToolbar.vue:277` | V3 default has 6 entries (drops distribute) | M |

---

## Section 10: Destruction & Memory Management

| V1 ref | V1 behavior | V3 status | V3 file:line | Diff notes | Effort |
|---|---|---|---|---|---|
| designerCtrl.destroy() → toolbarCtrl.destroy() + tpl.destroy() + $container.empty() | Chain cleanup | ✅ DONE | `build-designer.ts:403-423` | Matches pattern with Vue equivalent | n/a |
| toolbarCtrl.destroy() | Closes 3 dialogs + `$(document).off(_toolbarClickNs)` + `$container.empty()` | 🟡 PARTIAL | `build-toolbar.ts:129-137` | V3 `app.unmount()` — dialog state is parent-owned reactive, doesn't apply | n/a |
| template.destroy() idempotent 7-step sequence | (1) flag (2) draging reset (3) 4 event.offs (4) panels.clear (5) singleton map del (6) target/container empty (7) nullify props | 🟡 PARTIAL | `print-template.ts:388-406` | Idempotent ✅; V3 drops V1 steps 2/3/4/5/6/7 (no global singleton, no event bus, no jQuery DOM nulls); Pinia handles | M |
| Failure mode: $(document).on('click' + _toolbarClickNs) cumulative if not destroyed | Memory leak warning | 🟡 PARTIAL | `build-toolbar.ts:129` | V3 doesn't use document-bound click handlers | n/a |
| Failure mode: event-bus subscriptions never released | Closure leak | 🔴 MISSING | n/a | V3 has no event bus | n/a |
| Failure mode: singleton-map entries pile up | Memory growth | 🔴 MISSING | n/a | V3 PrintTemplate has own private Pinia — no singleton map | n/a |
| Failure mode: element-list panel + toggle DOM remain | DOM leak | 🔴 MISSING | n/a | V3 SFCs handle DOM | n/a |
| Failure mode: `$(document).keydown` shortcut handler V1 line 10949 never offed | Known V1 leak | ✅ DONE | `keyboard.ts:311-314` | V3 returns cleanup fn | n/a |
| Failure mode: guide-line drag handlers dangling | Known V1 leak | 🔴 MISSING | n/a | V3 has no guide system | n/a |

---

## Section 11: Known Gaps & Workarounds (V1 Limitations)

| V1 ref | V1 gap | V3 status | V3 file:line | Diff notes | Effort |
|---|---|---|---|---|---|
| §11 alignItems subset workaround | HIGH severity | 🟡 PARTIAL | `HiprintToolbar.vue:277, 414-416` | Workaround mostly satisfied via prop; format differs (string array vs {type,label,icon}) | M |
| §11 async clear confirmation workaround | HIGH severity | 🔴 MISSING | n/a | onClearConfirm hook not implemented | M |
| §11 custom paper popover UI override | HIGH severity | 🔴 MISSING | n/a | onCustomPaperOpen not implemented | M |
| §11 single-group element-type removal | MED severity | 🟡 PARTIAL | `compat/hiprint-global.ts:258-265` | `removeDynamicFields(moduleName, tids?)` accepts tids subset | n/a |
| §11 rename element type undo | MED severity (not in historyList) | 🔴 MISSING | n/a | renameElementType doesn't push history snapshot | M |
| §11 No PDF/Undo/Redo/RemovePanel/Grid/Ruler/Lock toolbar buttons workaround (use extraButtons) | MED severity | ⚠️ VIOLATION | `HiprintToolbar.vue` | V3 ships PDF/Undo/Redo/RemovePanel/Grid/Ruler as **built-in toolbar buttons** rather than extras — directly violates V1 surface | S (remove) |
| §11 Global keydown leak workaround | MED severity | ✅ DONE | `keyboard.ts:311-314` | V3 fixes the V1 leak | n/a |
| §11 aria-busy not toggled during load | LOW severity | 🔴 MISSING | n/a | Not fixed in V3 dialogs | S |
| §11 extraButtons.disabled function not re-evaluated | LOW severity | 🔴 MISSING | n/a | Not fixed | S |
| §11 Letter paper size not in default | LOW severity | ⚠️ VIOLATION | `HiprintToolbar.vue:226-232` | V3 default wrong (different from V1 default and from suggested workaround) | S |
| §11 Z-index controls toolbar-less | MED severity | 🟡 PARTIAL | `interactions/context-menu.ts:374-382` | V3 adds context-menu items (good); keyboard bindings still missing (bad) | M |
| §11 setElsAlign different naming workaround | LOW severity | 🔴 MISSING | n/a | setElsAlign method not implemented at all | M |

---

## Top Priority Fix List (sorted by Sprint priority)

Order: P0 (must roll back / land before any release) → P1 (must land soon) → P2 (nice to have).

### P0 — VIOLATIONs to rollback / rework

1. **Remove non-V1 toolbar buttons** [V3 `HiprintToolbar.vue:241-279, 893-984, 974-984, 1099-1120, 1158-1181`] — Undo / Redo / PDF / Grid / Ruler / Remove Panel / clickable 100% reset / TB-006 pagination strip all add surface V1 does not have. Either drop or gate behind opt-in flag with default `false`. **Effort**: S each, ~3-4h total.
2. **Fix default paper list** [V3 `HiprintToolbar.vue:226-232`] — Restore V1's `A3 (420×296.6), A4 (210×296.6), A5 (210×147.6), B3 (500×352.6), B4 (250×352.6), B5 (250×175.6)` exactly. Currently V3 is missing B3, has A3 dimensions swapped, and all V1 fractional dims rounded. **Effort**: S, ~1h.
3. **Flip `showPanelManager` default to `false`** [V3 `HiprintToolbar.vue:251`] — V1 uniquely opt-in; comment claims "V1 parity" but is factually wrong. **Effort**: S, ~15min.
4. **Flip `showBusinessSelect` / `showTemplateSelect` defaults to `true`** [V3 `HiprintToolbar.vue:259-260`] — Match V1. **Effort**: S, ~15min.
5. **Flip `showPagination` default to `false`** [V3 `HiprintToolbar.vue:276`] — V1 default off. **Effort**: S, ~15min.
6. **Add back `distributeHorizontal` + `distributeVertical` alignment buttons** [V3 `HiprintToolbar.vue:277, 1185-1250`] — V1's 8-item default list, V3 has 6. Also rename V3's `center/middle` → V1's `horizontalCenter/verticalCenter` for parity. **Effort**: M, ~4h.

### P1 — MISSING contract critical

7. **Wire SaveDialog through toolbar save button** [V3 `HiprintToolbar.vue:494-515, SaveDialog.vue`] — Currently save button bypasses dialog. Restore V1's `triggerSave(e) → openSaveDialog → onSaveDialogOpen(context) → openSaveDialogDefault` 3-step chain. **Effort**: M, ~6h.
8. **3-tier clear button hook chain** [V3 `HiprintToolbar.vue:616-621`] — Restore V1's `onClear (total takeover) → onClearConfirm (async confirm) → native confirm('是否确认清空?')` priority chain. **Effort**: M, ~3h.
9. **Add Business/Template dialog lifecycle hooks** [V3 `BusinessDialog.vue / TemplateDialog.vue / HiprintDesigner.vue`] — `onBusinessDialogOpen/Close/onTemplateDialogOpen/Close/onTemplateDeleteConfirm/onSaveDialogOpen/Close` with context object `{type, payload, template, api, openDefault, closeDefault}`. **Effort**: L, ~16h.
10. **Add Template Dialog preview action** [V3 `TemplateDialog.vue:79-91`] — V1 has 4 actions (Select/Preview/Edit/Delete); V3 has 3. Add preview emit + button. **Effort**: S, ~2h.
11. **Customize button text via opts** [V3 `HiprintToolbar.vue:346-374`] — Add props for `previewButtonText/printButtonText/clearButtonText/saveButtonText/templateButtonText/businessButtonText/rotateButtonText/customPaperButtonText/customPaperConfirmText`. **Effort**: M, ~4h.
12. **Customize dialog text via opts** [V3 dialogs] — Add `businessDialogEmptyText/LoadingText/ErrorText/saveDialogTitle/NameLabel/NamePlaceholder/NameRequiredText/ConfirmText/CancelText/templateDialogEmptyText/LoadingText/ErrorText`. **Effort**: M, ~6h.
13. **onCustomPaperOpen hook** [V3 `HiprintToolbar.vue:1017-1024, CustomPaperPopover.vue`] — Allow business override of popover. **Effort**: M, ~3h.
14. **Add `paper:custom` aria-haspopup + data-paper + outside-click namespace** [V3 same files] — A11y + behavior parity. **Effort**: S, ~2h.
15. **Restore V1's paper buttons as individual buttons (not `<select>`)** [V3 `HiprintToolbar.vue:999-1016`] — V1 had per-paper buttons with `data-paper` attr + `aria-pressed` toggle state. V3's `<select>` violates DOM surface + a11y semantics. **Effort**: M, ~5h.
16. **Restore PrintTemplate methods used by canonical callers** [V3 `compat/print-template.ts`] — Priority subset: `rotatePaper / setPaper / alignElements / zoom / addPrintPanel / selectPanel(idx) / deletePanel(idx) / getPaneltotal / isDestroyed / getPanel(idx) / getPaperType / getOrient / setFontList / getFontList / setFields / getFields / on(event, cb) / getElementByTid / getElementByName / getTestData / getSelectEls / selectAllElements`. **Effort**: L, ~24h.
17. **businessListProvider / templateListProvider / businessLoader / templateLoader pattern** [V3 dialogs] — Restore V1 async-data provider/loader callback contract with `businessDialogRequestId` cancellation. **Effort**: L, ~12h.
18. **Custom-paper popover validation `w > 0 && h > 0`** [V3 `CustomPaperPopover.vue:57-59`] — V1 silently rejects invalid. **Effort**: S, ~30min.
19. **Add CSS class parity for E2E selectors** [V3 multiple] — Critical: `hiprint-toolbar-btn-primary` (print/save), `hiprint-toolbar-btn-danger` (clear/delete), `hiprint-toolbar-icon-btn` (icons), `hiprint-toolbar-popover` (custom paper); and dialog class names if any test relies on them. **Effort**: M, ~3h.
20. **Restore ZH defaults for aria-labels** [V3 `HiprintToolbar.vue:1128, 1149, 1189-1248, etc.`] — V1 uses 中文 (缩小/放大/左对齐/etc.); V3 hardcodes English. Should be i18n driven. **Effort**: M, ~3h.

---

## Total fix effort estimate

- **S items**: 47 × ~1h average = **~47h** (rollbacks + defaults + label text + arg-order swaps)
- **M items**: 71 × ~4h average = **~284h** (lifecycle hooks + dialog hook chains + missing PrintTemplate methods + paper button DOM rework + customizable text)
- **L items**: 16 × ~14h average = **~224h** (toolbarCtrl restoration if pursued; templateOptions full pass-through; PrintTemplate method bulk-port; resize-bars implementation if pursued; provider/loader pattern)

**Grand total**: ~555 person-hours for full V1 parity restoration if all flagged items are addressed. P0-only (Sprint 22a rollback list): ~7h. P0+P1 critical: ~100h.

If toolbarCtrl reinstatement (Section 8A.2) is **explicitly out of scope** per the V3 architectural ADR, drop ~150h from that estimate, leaving **~405h** for the rest of parity (still ⚠️ this is a load-bearing intentional break that breaks `vue-admin-main` and similar imperative callers — confirm direction with PM before pursuing alternatives).

---

## Section 12: Expanded Per-Element Rows (Granular Detail)

This section drills further into individual V1 attributes that were condensed in earlier tables, providing per-attribute rows so each becomes independently scoreable and trackable.

### 12.1 Per-Button-Text V1 opts (granular)

Every V1 `*ButtonText` opt expanded as its own scoreable row.

| V1 ref | V1 opt | V3 status | V3 file:line | Diff notes | Effort |
|---|---|---|---|---|---|
| [V1 13338] businessButtonText `i18n.__('业务选择')` | 🔴 MISSING | `src/hiprint-v3/components/HiprintToolbar.vue:369` | Hardcoded `'🏷 Business'`; no prop | S |
| [V1 13358] panelManagerLabel `i18n.__('分页')` | 🟡 PARTIAL | `src/hiprint-v3/components/HiprintToolbar.vue:274` | Prop present, default `''` (empty) | S |
| [V1 13359] addPanelButtonText `'+'` | ✅ DONE | `src/hiprint-v3/components/HiprintToolbar.vue:275` | matches | n/a |
| [V1 13360] templateButtonText `i18n.__('选择模版')` | 🔴 MISSING | `src/hiprint-v3/components/HiprintToolbar.vue:368` | Hardcoded `'📋 Templates'`; no prop | S |
| [V1 13363] customPaperButtonText `i18n.__('自定义')` | 🔴 MISSING | `src/hiprint-v3/components/HiprintToolbar.vue:1017-1024` | Hardcoded `'⚙'` glyph; no prop | S |
| [V1 13364] customPaperConfirmText `i18n.__('确定')` | 🔴 MISSING | `src/hiprint-v3/components/CustomPaperPopover.vue:98` | Hardcoded `'Apply'`; no prop | S |
| [V1 13365] rotateButtonText `i18n.__('旋转')` w/ `↻ ` prepended | 🔴 MISSING | `src/hiprint-v3/components/HiprintToolbar.vue:356` | Hardcoded `'⟲ Rotate'`; no prop | S |
| [V1 13366] previewButtonText `i18n.__('预览')` | 🔴 MISSING | `src/hiprint-v3/components/HiprintToolbar.vue:350` | Hardcoded `'👁 Preview'`; no prop | S |
| [V1 13367] clearButtonText `i18n.__('清空')` | 🔴 MISSING | `src/hiprint-v3/components/HiprintToolbar.vue:353` | Hardcoded `'🗑 Clear'`; no prop | S |
| [V1 13368] printButtonText `i18n.__('打印')` | 🔴 MISSING | `src/hiprint-v3/components/HiprintToolbar.vue:351` | Hardcoded `'🖨 Print'`; no prop | S |
| [V1 13369] saveButtonText `i18n.__('保存')` | 🔴 MISSING | `src/hiprint-v3/components/HiprintToolbar.vue:349` | Hardcoded `'💾 Save'`; no prop | S |

### 12.2 Per-Dialog-Text V1 opts (granular)

| V1 ref | V1 opt | V3 status | V3 file:line | Diff notes | Effort |
|---|---|---|---|---|---|
| [V1 13342] businessDialogTitle `i18n.__('选择业务')` | 🟡 PARTIAL | `src/hiprint-v3/components/HiprintDesigner.vue:247` | Prop present, default `'业务场景'` (different text) | S |
| [V1 13343] businessDialogEmptyText `i18n.__('暂无业务')` | 🔴 MISSING | `src/hiprint-v3/components/dialogs/BusinessDialog.vue` | Empty-state text not configurable as opt | S |
| [V1 13344] businessDialogLoadingText `i18n.__('业务加载中...')` | 🔴 MISSING | `src/hiprint-v3/components/dialogs/BusinessDialog.vue` | Loading state via Ant Spin; text not configurable | S |
| [V1 13345] businessDialogErrorText `i18n.__('业务加载失败')` | 🔴 MISSING | `src/hiprint-v3/components/dialogs/BusinessDialog.vue` | No error state at all in V3 dialog | S |
| [V1 13370] saveDialogTitle `i18n.__('保存模版')` | 🟡 PARTIAL | `src/hiprint-v3/components/HiprintDesigner.vue:251` | Prop present, default `'保存模板'` (字 differ) | S |
| [V1 13371] saveDialogNameLabel `i18n.__('模版名称')` | 🔴 MISSING | `src/hiprint-v3/components/dialogs/SaveDialog.vue` | Hardcoded; no opt | S |
| [V1 13372] saveDialogNamePlaceholder `i18n.__('请输入模版名称')` | 🔴 MISSING | `src/hiprint-v3/components/dialogs/SaveDialog.vue` | Hardcoded; no opt | S |
| [V1 13373] saveDialogNameRequiredText `i18n.__('请输入模版名称')` | 🔴 MISSING | `src/hiprint-v3/components/dialogs/SaveDialog.vue:94-95` | Validation present but message not configurable | S |
| [V1 13374] saveDialogConfirmText `i18n.__('确定')` | 🔴 MISSING | `src/hiprint-v3/components/dialogs/SaveDialog.vue` | Hardcoded; no opt | S |
| [V1 13375] saveDialogCancelText `i18n.__('取消')` | 🔴 MISSING | `src/hiprint-v3/components/dialogs/SaveDialog.vue` | Hardcoded; no opt | S |
| [V1 13376] templateDialogTitle `i18n.__('选择模版')` | 🟡 PARTIAL | `src/hiprint-v3/components/HiprintDesigner.vue:243` | Prop present, default `'模板选择'` (字 differ) | S |
| [V1 13377] templateDialogEmptyText `i18n.__('暂无模版')` | 🔴 MISSING | `src/hiprint-v3/components/dialogs/TemplateDialog.vue` | Not configurable | S |
| [V1 13378] templateDialogLoadingText `i18n.__('模版加载中...')` | 🔴 MISSING | `src/hiprint-v3/components/dialogs/TemplateDialog.vue` | Not configurable | S |
| [V1 13379] templateDialogErrorText `i18n.__('模版加载失败')` | 🔴 MISSING | `src/hiprint-v3/components/dialogs/TemplateDialog.vue` | No error state | S |

### 12.3 Per-Alignment-Type Granular Rows

V1 defaultAlignItems has 8 entries (Section 1.22). V3 has 6.

| V1 ref | V1 alignment | V3 status | V3 file:line | Diff notes | Effort |
|---|---|---|---|---|---|
| [V1 14359] left "左对齐" `⫷` `align:left` | 🟡 PARTIAL | `src/hiprint-v3/components/HiprintToolbar.vue:1185-1195` | Button exists; aria-label English `"Align left"`; icon `⊣ L` (different glyph); no `align:left` registry key (V3 toolbarCtrl deleted) | S |
| [V1 14360] horizontalCenter "水平居中" `⫿` `align:horizontalCenter` | 🟡 PARTIAL | `src/hiprint-v3/components/HiprintToolbar.vue:1196-1206` | V3 type name `center` (not `horizontalCenter`); icon `☰ C`; aria-label `"Align center"` | S |
| [V1 14361] right "右对齐" `⫸` `align:right` | 🟡 PARTIAL | `src/hiprint-v3/components/HiprintToolbar.vue:1207-1217` | English label; icon `⊢ R` (different) | S |
| [V1 14362] top "顶对齐" `⫠` `align:top` | 🟡 PARTIAL | `src/hiprint-v3/components/HiprintToolbar.vue:1218-1228` | English label; icon `⊤ T` (different) | S |
| [V1 14363] verticalCenter "垂直居中" `⫥` `align:verticalCenter` | 🟡 PARTIAL | `src/hiprint-v3/components/HiprintToolbar.vue:1229-1239` | V3 type name `middle` (not `verticalCenter`); icon `☱ M` | S |
| [V1 14364] bottom "底对齐" `⫡` `align:bottom` | 🟡 PARTIAL | `src/hiprint-v3/components/HiprintToolbar.vue:1240-1250` | English label; icon `⊥ B` (different) | S |
| [V1 14365] distributeHorizontal "水平等距" `⇔` `align:distributeHorizontal` | 🔴 MISSING | `src/hiprint-v3/components/HiprintToolbar.vue` | Not in V3 alignItems set | M |
| [V1 14366] distributeVertical "垂直等距" `⇕` `align:distributeVertical` | 🔴 MISSING | `src/hiprint-v3/components/HiprintToolbar.vue` | Not in V3 alignItems set | M |

### 12.4 Per-PaperType V1 Default Dimensions

V1 default `_defaultPaperTypes` [V1 13296-13303]. V3 defaults at `src/hiprint-v3/components/HiprintToolbar.vue:226-232`.

| V1 ref | V1 paper (mm) | V3 status | V3 file:line | Diff notes | Effort |
|---|---|---|---|---|---|
| [V1 13297] A3 width=420 height=296.6 | ⚠️ VIOLATION | `src/hiprint-v3/components/HiprintToolbar.vue:227` | V3: A3 width=297 height=420 — **dimensions swapped + 296.6→420 rounding change**. V1 had landscape-bias 420×296.6; V3 has portrait 297×420 | S |
| [V1 13298] A4 width=210 height=296.6 | ⚠️ VIOLATION | `src/hiprint-v3/components/HiprintToolbar.vue:228` | V3: A4 width=210 height=297 — V1 fractional height 296.6 rounded to 297 (close enough but not byte-equivalent) | S |
| [V1 13299] A5 width=210 height=147.6 | ⚠️ VIOLATION | `src/hiprint-v3/components/HiprintToolbar.vue:229` | V3: A5 width=148 height=210 — **dimensions swapped + 147.6→148 round + 210→210 (no change)**. V1 had 210×147.6 landscape; V3 has 148×210 portrait | S |
| [V1 13300] B3 width=500 height=352.6 | 🔴 MISSING | `src/hiprint-v3/components/HiprintToolbar.vue:226-232` | V3 default dropped B3 entirely | S |
| [V1 13301] B4 width=250 height=352.6 | ⚠️ VIOLATION | `src/hiprint-v3/components/HiprintToolbar.vue:230` | V3: B4 width=250 height=353 — 352.6→353 round | S |
| [V1 13302] B5 width=250 height=175.6 | ⚠️ VIOLATION | `src/hiprint-v3/components/HiprintToolbar.vue:231` | V3: B5 width=176 height=250 — **dimensions swapped + 175.6→176 round** | S |

### 12.5 Per-V3-Built-In-Toolbar-Button (added beyond V1 surface)

For each V3 toolbar button that has no V1 toolbar counterpart, mark as ⚠️ VIOLATION.

| V3 button | V3 file:line | V1 status | Diff notes | Effort |
|---|---|---|---|---|
| `undo` (default visible) | `src/hiprint-v3/components/HiprintToolbar.vue:241, 893-903, 486-488` | ⚠️ VIOLATION vs V1 (no toolbar undo, keyboard-only [V1 10951]) | Remove or default `showUndo: false` | S |
| `redo` (default visible) | `src/hiprint-v3/components/HiprintToolbar.vue:242, 904-914, 490-492` | ⚠️ VIOLATION vs V1 (no toolbar redo, keyboard-only [V1 10952]) | Remove or default `showRedo: false` | S |
| `pdf` (default visible) | `src/hiprint-v3/components/HiprintToolbar.vue:246, 974-984, 609-614` | ⚠️ VIOLATION vs V1 (no PDF button; API only [V1 12776 toPdf]) | Remove or default `showPdf: false` | S |
| `removePanel` (default via showPanelManager=true) | `src/hiprint-v3/components/HiprintToolbar.vue:1110-1120, 635-642` | ⚠️ VIOLATION vs V1 (no removePanel toolbar button; pagination strip only [V1 174]) | Remove or guard | S |
| `gridToggle` (default visible) | `src/hiprint-v3/components/HiprintToolbar.vue:258, 1158-1169, 825-828` | ⚠️ VIOLATION vs V1 (no grid toggle button anywhere [V1 313]) | Remove or default `showGrid: false` | S |
| `rulerToggle` (default visible) | `src/hiprint-v3/components/HiprintToolbar.vue:257, 1170-1181, 830-833` | ⚠️ VIOLATION vs V1 (no ruler in V1 at all [V1 317]) | Remove or default `showRuler: false` | S |
| `zoomReset` (clickable 100% button) | `src/hiprint-v3/components/HiprintToolbar.vue:1135-1143, 725-728` | ⚠️ VIOLATION vs V1 (V1 explicitly "no click affordance" [V1 14318 — comment "Clickable to reset? **No**"]) | Convert to `<span>` | S |
| TB-006 pagination strip (prev/next + indicator) | `src/hiprint-v3/components/HiprintToolbar.vue:1076-1097, 656-662` | ⚠️ VIOLATION vs V1 (no pagination buttons in toolbar; V1 had bottom strip only) | Remove or move to canvas bottom | S |
| TB-003 chip list panel manager | `src/hiprint-v3/components/HiprintToolbar.vue:1052-1072, 644-649` | ⚠️ VIOLATION vs V1 (V1 used `<select>` dropdown, not chips [V1 14455]) | Convert to `<select>` to match V1 a11y semantics | M |

### 12.6 V1 PrintTemplate Public-Method Per-Method Citations (selected MISSING bulk)

This expansion provides per-method file:line citations for every MISSING V1 PrintTemplate method (Section 7). Each row corresponds to a method that V3 `src/hiprint-v3/compat/print-template.ts` does not implement.

| V1 # | V1 method | V1 line | V3 status | V3 file:line | Diff notes |
|---|---|---|---|---|---|
| 2 | getSimpleHtml | [V1 12401-12421] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | No equivalent; `getHtml(data)` is closest but returns string not jQuery |
| 3 | getSimpleHtmlAsync | [V1 12422-12459] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | No async chunked variant; no `generateHTMLInterval` 10ms setTimeout pattern |
| 5 | getHtmlAsync | [V1 12463-12465] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | No async variant of getHtml |
| 6 | getJointHtml | [V1 12466-12472] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | No equivalent |
| 7 | setPaper(t, e?) | [V1 12473-12479] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | V3 uses canvas.updatePanel directly; throws 'not found pagetype' branch not present |
| 8 | rotatePaper() | [V1 12480-12482] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | V3 toolbar inline swap; no method |
| 9 | alignElements(type) | [V1 12483-12485] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | V3 toolbar inline math; no method |
| 10 | zoom(s, p?) | [V1 12486-12488] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | V3 canvas.setScale; no method on PrintTemplate |
| 11 | addPrintPanel(t?, e?) | [V1 12489-12492] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | V3 canvas.addPanel; no method |
| 12 | selectPanel(t) | [V1 12493-12499] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | V3 canvas.setActivePanel(id); idx-based V1 vs id-based V3 |
| 13 | deletePanel(t) | [V1 12500-12515] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | V3 canvas.removePanel(id); same idx/id mismatch |
| 14 | getPaneltotal() | [V1 12516-12518] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | `canvas.panels.length` is V3 way |
| 21 | isDestroyed() | [V1 12551-12553] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | Public `_destroyed` property instead |
| 27 | getPaperType(t?) | [V1 12642-12644] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | `canvas.panels[idx].paperType` is V3 way |
| 28 | getOrient(t?) | [V1 12645-12647] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | No equivalent computed |
| 29 | getPrintStyle(t?) | [V1 12648-12650] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | No equivalent |
| 35 | printByHtml(t) | [V1 12733-12735] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | No method |
| 36 | printByHtml2(t, e?) | [V1 12736-12764] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | No method |
| 37 | deletePrintElement(t) | [V1 12765-12769] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | V3 canvas.removeElement per-panel |
| 45 | on(event, cb) | [V1 12860-12863] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | V3 uses Pinia reactivity (subscribe via watch); no event subscription |
| 46 | clientIsOpened() | [V1 12864-12865] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | Use `getHiWebSocket().opened` |
| 47 | getPrinterList() | [V1 12866-12869] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | No method |
| 48 | getElementByTid(t, e?) | [V1 12870-12872] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | Iterate canvas.panels manually |
| 49 | getElementByName(t, e?) | [V1 12873-12875] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | Same |
| 50 | getPanel(t?) | [V1 12876-12878] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | `canvas.panels[t || 0]` direct |
| 52 | setFontList(t) | [V1 12898-12900] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | No equivalent |
| 53 | getFontList() | [V1 12901-12903] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | No equivalent |
| 54 | setFields(t) | [V1 12904-12906] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | No equivalent |
| 55 | getFields() | [V1 12907-12909] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | No equivalent |
| 56 | setOnImageChooseClick(t) | [V1 12910-12912] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | No equivalent |
| 57 | getOnImageChooseClick() | [V1 12913-12915] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | No equivalent |
| 58 | getFieldsInPanel() | [V1 12916-12921] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | No equivalent |
| 59 | getTestData() | [V1 12922-12927] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | No equivalent |
| 61 | getSelectEls() | [V1 12951-12962] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | Use `canvas.selectedElements` directly |
| 62 | selectElementsByField(fa) | [V1 12964-12975] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | No equivalent |
| 63 | selectAllElements() | [V1 12976-12986] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | No equivalent; also no Ctrl+A keyboard |
| 64 | updateOption(opt, v) | [V1 12987-12994] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | Use canvas.updateElement per-element |
| 65 | setElsAlign(e) | [V1 12995-13073] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | V1's distinct legacy alignment naming |
| 66 | setElsSpace(dis, isHor) | [V1 13074-13099] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | No distribution algo |
| 67 | initAutoSave() | [V1 13100-13152] | 🔴 MISSING | `src/hiprint-v3/compat/print-template.ts` (no method) | Pinia replaces event-bus; no manual subscribe API |

### 12.7 Per-CSS-Class V1→V3 Granular Mapping

Selected representative breakouts (full table in Section 4.1).

| V1 ref | V1 class | V3 status | V3 file:line | V3 class (if renamed) | Effort |
|---|---|---|---|---|---|
| [V1 14211] `hiprint-toolbar-group` | 🔴 MISSING | `src/hiprint-v3/components/HiprintToolbar.vue` | No equivalent wrapper; uses inline flex | S |
| [V1 14211] `hiprint-toolbar-business-select` (suffix) | 🔴 MISSING | `src/hiprint-v3/components/HiprintToolbar.vue` | No suffix class | S |
| [V1 14228] `hiprint-toolbar-template-select` | 🔴 MISSING | `src/hiprint-v3/components/HiprintToolbar.vue` | No suffix class | S |
| [V1 14239] `hiprint-toolbar-paper` | ✅ DONE | `src/hiprint-v3/components/HiprintToolbar.vue:1331-1343` | Present | n/a |
| [V1 14317] `hiprint-toolbar-scale` | 🔴 MISSING | `src/hiprint-v3/components/HiprintToolbar.vue` | No suffix class | S |
| [V1 14371] `hiprint-toolbar-align` | 🔴 MISSING | `src/hiprint-v3/components/HiprintToolbar.vue` | No suffix class | S |
| [V1 14452] `hiprint-toolbar-panels` | 🟡 PARTIAL | `src/hiprint-v3/components/HiprintToolbar.vue:1054, 1346` | Renamed `hiprint-toolbar-panel-chips` | S |
| [V1 14702] `hiprint-toolbar-extra` | 🔴 MISSING | `src/hiprint-v3/components/HiprintToolbar.vue` | No wrapper for extras | S |
| [V1 14212] `hiprint-toolbar-btn` (base) | ✅ DONE | `src/hiprint-v3/components/HiprintToolbar.vue:1286-1322` | Class applied to all buttons | n/a |
| [V1 14433, 14113, 13642, 13823] `hiprint-toolbar-btn-primary` | 🔴 MISSING | `src/hiprint-v3/components/HiprintToolbar.vue` | No primary modifier | S |
| [V1 14402, 13826] `hiprint-toolbar-btn-danger` | 🔴 MISSING | `src/hiprint-v3/components/HiprintToolbar.vue` | No danger modifier | S |
| [V1 14323, 14324, 14374] `hiprint-toolbar-icon-btn` | 🔴 MISSING | `src/hiprint-v3/components/HiprintToolbar.vue` | No icon-only modifier | S |
| [V1 14244, 14264, 14269-14270] `.active` (state) | 🟡 PARTIAL | `src/hiprint-v3/components/HiprintToolbar.vue:1317-1321, 1372-1376` | V3 uses `is-active` for grid/ruler/chips; `active` not used | S |
| [V1 14259] `hiprint-toolbar-popover` | ⚠️ VIOLATION | `src/hiprint-v3/components/CustomPaperPopover.vue:69, 104` | Renamed `hiprint-custom-paper-popover` | S |
| [V1 14260] `hiprint-toolbar-popover-content` | 🔴 MISSING | `src/hiprint-v3/components/CustomPaperPopover.vue` | No equivalent inner wrap | S |
| [V1 14261, 14263] `hiprint-toolbar-input` | 🔴 MISSING | `src/hiprint-v3/components/CustomPaperPopover.vue:76-94` | Inputs have no class | S |
| [V1 14308] `hiprint-toolbar-custom-wrap` | 🔴 MISSING | `src/hiprint-v3/components/HiprintToolbar.vue:1341-1343` | `.hiprint-toolbar-paper` is V3's anchor; no `-custom-wrap` | S |
| [V1 14453] `hiprint-toolbar-panel-manager` | 🔴 MISSING | `src/hiprint-v3/components/HiprintToolbar.vue` | No equivalent (chip list pattern) | S |
| [V1 14454] `hiprint-toolbar-panel-manager-label` | 🔴 MISSING | `src/hiprint-v3/components/HiprintToolbar.vue:1058-1060` | V3 uses generic `.hiprint-toolbar-label` | S |
| [V1 14455] `hiprint-toolbar-panel-manager-select` | ⚠️ VIOLATION | `src/hiprint-v3/components/HiprintToolbar.vue:1052-1072` | V3 has no select; chip list | M |
| [V1 14458] `hiprint-toolbar-panel-manager-add` | 🔴 MISSING | `src/hiprint-v3/components/HiprintToolbar.vue:1099-1109` | No specialized class | S |
| [V1 14318] `hiprint-toolbar-scale-label` (span) | 🔴 MISSING | `src/hiprint-v3/components/HiprintToolbar.vue:1135-1143` | V3 uses button not span; no specialized class | S |

### 12.8 Per-ARIA-Attribute V1→V3 Granular Mapping

| V1 ref | V1 ARIA attribute | V3 status | V3 file:line | Diff notes | Effort |
|---|---|---|---|---|---|
| [V1 14258] Custom Paper Button `aria-haspopup="dialog"` | 🔴 MISSING | `src/hiprint-v3/components/HiprintToolbar.vue:1017-1024` | Only `aria-label` + `aria-expanded` | S |
| [V1 14258] Custom Paper Button `aria-expanded` initial `"false"` | ✅ DONE | `src/hiprint-v3/components/HiprintToolbar.vue:1022` | `:aria-expanded="customPaperOpen"` | n/a |
| [V1 14287] Custom Paper Button `aria-expanded` sync on toggle | ✅ DONE | `src/hiprint-v3/components/HiprintToolbar.vue:1022` | Reactive binding handles it | n/a |
| [V1 14259] Custom Paper Popover `role="dialog"` | ✅ DONE | `src/hiprint-v3/components/CustomPaperPopover.vue:70` | matches | n/a |
| [V1 14259] Custom Paper Popover `aria-label="自定义纸张大小"` | 🟡 PARTIAL | `src/hiprint-v3/components/CustomPaperPopover.vue:71` | English `"Custom paper size"`; functional ok | S |
| [V1 14323] Zoom Out button `aria-label="缩小"` | 🟡 PARTIAL | `src/hiprint-v3/components/HiprintToolbar.vue:1128` | English `"Zoom out"` | S |
| [V1 14324] Zoom In button `aria-label="放大"` | 🟡 PARTIAL | `src/hiprint-v3/components/HiprintToolbar.vue:1149` | English `"Zoom in"` | S |
| [V1 14374] Align buttons `aria-label={item.label}` (8 buttons, CN) | 🟡 PARTIAL | `src/hiprint-v3/components/HiprintToolbar.vue:1189-1248` | English; not driven by alignItems input shape | S |
| [V1 14244] Paper Size buttons `aria-pressed` | ⚠️ VIOLATION | `src/hiprint-v3/components/HiprintToolbar.vue:1001-1016` | V3 uses `<select>` — no aria-pressed | M |
| [V1 14460] Add Panel button `aria-label="添加分页"` | 🟡 PARTIAL | `src/hiprint-v3/components/HiprintToolbar.vue:1104` | English `"Add panel"` | S |
| [V1 14456] Panel Manager Select `aria-label="选择分页"` | ⚠️ VIOLATION | `src/hiprint-v3/components/HiprintToolbar.vue:1052-1057` | V3 chip group `aria-label="Active panel"`; no select | n/a |
| [V1 13727] Business dialog wrap `role="dialog"` | ✅ DONE | `src/hiprint-v3/components/dialogs/BusinessDialog.vue` (Ant Modal) | Ant native | n/a |
| [V1 13727] Business dialog wrap `aria-modal="true"` | ✅ DONE | `src/hiprint-v3/components/dialogs/BusinessDialog.vue` (Ant Modal) | Ant native | n/a |
| [V1 13727] Business dialog wrap `aria-labelledby="hp-business-title-<uid>"` | 🔴 MISSING | `src/hiprint-v3/components/dialogs/BusinessDialog.vue` | No deterministic ID convention | S |
| [V1 13727] Business dialog wrap `tabindex="-1"` | 🟡 PARTIAL | `src/hiprint-v3/components/dialogs/BusinessDialog.vue` (Ant Modal) | Ant handles focus trap | n/a |
| [V1 13733] Business dialog body `aria-live="polite"` | 🔴 MISSING | `src/hiprint-v3/components/dialogs/BusinessDialog.vue` | Not set | S |
| [V1 13733] Business dialog body `aria-busy="false"` (static) | 🔴 MISSING | `src/hiprint-v3/components/dialogs/BusinessDialog.vue` | Not set; would be enhancement to make dynamic | S |
| [V1 13736] Business dialog close button `aria-label="关闭"` | 🟡 PARTIAL | `src/hiprint-v3/components/dialogs/BusinessDialog.vue` (Ant Modal) | Ant default close button, locale-dependent | n/a |
| [V1 13985] Template dialog wrap `role/aria-modal/aria-labelledby/tabindex` (4 attrs) | 🟡 PARTIAL | `src/hiprint-v3/components/dialogs/TemplateDialog.vue` (Ant Modal) | Same as business; labelledby ID missing | S |
| [V1 13991] Template dialog body `aria-live aria-busy` | 🔴 MISSING | `src/hiprint-v3/components/dialogs/TemplateDialog.vue` | Not set | S |
| [V1 13994] Template dialog close `aria-label="关闭"` | 🟡 PARTIAL | `src/hiprint-v3/components/dialogs/TemplateDialog.vue` | Ant default | n/a |
| [V1 14102] Save dialog wrap `role/aria-modal/aria-labelledby/tabindex` (4 attrs) | 🟡 PARTIAL | `src/hiprint-v3/components/dialogs/SaveDialog.vue` (Ant Modal) | Same; labelledby ID missing | S |
| [V1 14108] Save input `aria-describedby="hp-save-err-<uid>"` | 🔴 MISSING | `src/hiprint-v3/components/dialogs/SaveDialog.vue` | Ant Form handles validation internally; no aria-describedby with deterministic ID | S |
| [V1 14109] Save error div `role="alert"` | 🟡 PARTIAL | `src/hiprint-v3/components/dialogs/SaveDialog.vue` | Ant Form announces via own mechanism; role="alert" not explicit | S |
| [V1 14107] Save label `for="hp-save-name-<uid>"` | 🟡 PARTIAL | `src/hiprint-v3/components/dialogs/SaveDialog.vue` | Ant Form pairs label-input internally | n/a |
| [V1 11772] Element-list panel header `tabindex="0"` | 🔴 MISSING | `src/hiprint-v3/components/HiprintElementList.vue` | V3 element list no draggable header | M |
| [V1 11772] Element-list panel header `role="button"` | 🔴 MISSING | `src/hiprint-v3/components/HiprintElementList.vue` | Same | M |
| [V1 11773] Element-list panel header `aria-label="元素列表标题..."` | 🔴 MISSING | `src/hiprint-v3/components/HiprintElementList.vue` | Same | M |

### 12.9 V3 Stores Surface (referenced by toolbar / designer)

| V3 file:line | V3 export | V1 equivalent | Status notes |
|---|---|---|---|
| `src/hiprint-v3/stores/canvas.ts:99-507` | useCanvasStore (Pinia) | V1 implicit global state in `s.a.instance` | V3 isolated per-template Pinia |
| `src/hiprint-v3/stores/canvas.ts:106` | panels (ref) | V1 `printPanels[]` on PrintTemplate | V3 stored in canvas store |
| `src/hiprint-v3/stores/canvas.ts:112` | selectedElementIds (shallowRef Set) | V1 `mouseRect.mouseRectSelectedElement` + `.selected` class | V3 reactive Set |
| `src/hiprint-v3/stores/canvas.ts:115` | activePanelId | V1 `editingPanel.index` | V3 id-based not index-based |
| `src/hiprint-v3/stores/canvas.ts:118` | scale | V1 `scaleValue` | matches |
| `src/hiprint-v3/stores/canvas.ts:125` | gridVisible (ref) | V1 element-level gridOptions only — **NOT a toolbar-level toggle** | V3 promotes to canvas-level toggle |
| `src/hiprint-v3/stores/canvas.ts:129` | rulerVisible (ref) | V1 has no ruler at all | V3 adds feature; not in V1 |
| `src/hiprint-v3/stores/canvas.ts:166-184` | addPanel | V1 `template.addPrintPanel` | similar |
| `src/hiprint-v3/stores/canvas.ts:186-224` | removePanel | V1 `template.deletePanel` | similar with ≥1 invariant |
| `src/hiprint-v3/stores/canvas.ts:226-237` | setActivePanel | V1 `template.selectPanel` | id-based vs idx-based |
| `src/hiprint-v3/stores/canvas.ts:239-253` | updatePanel | V1 panel.resize/setPaper | direct panel patch |
| `src/hiprint-v3/stores/canvas.ts:440-447` | setScale | V1 `template.zoom` | direct setter |
| `src/hiprint-v3/stores/history.ts` | useHistoryStore | V1 `historyList[]` + `historyPos` on PrintTemplate | V3 separate store |
| `src/hiprint-v3/stores/template.ts:89-219` | useTemplateStore | V1 `s.a.instance.printTemplateContainer[id]` map | V3 single-active-template per Pinia |
| `src/hiprint-v3/stores/template.ts:119-154` | loadFromJson | V1 `template.update(json)` | similar full reset |
| `src/hiprint-v3/stores/template.ts:174-185` | getJson | V1 `template.getJson()` | matches |
| `src/hiprint-v3/stores/template.ts:188-196` | clear | V1 `template.clear()` | V1 kept panel[0]; V3 wipes all and reseeds via ctor on next load |

### 12.10 V3 Architectural Decisions (intentional breaks)

| V3 decision | V3 file:line | V1 contract broken | Justification (from V3 source comments) | Effort to restore |
|---|---|---|---|---|
| toolbarCtrl deleted | `src/hiprint-v3/compat/build-toolbar.ts:44-57, build-designer.ts:18-22` | All 39 toolbarCtrl methods | "pure V3 surface, no V1 imperative toolbar API" (build-designer.ts:18-22) | L (40+ methods) |
| componentPanelSlot removed | `src/hiprint-v3/compat/build-designer.ts:449-455` | V1 [V1 15119-15123] setComponentPanelSlot | V3 uses Vue slots on `<HiprintDesigner>` | M |
| setConfig made no-op | `src/hiprint-v3/compat/hiprint-global.ts:231-242` | V1 setConfig live patcher | V3 reactive SFC props replace global config patcher | M |
| Resize bars deleted | `src/hiprint-v3/compat/build-designer.ts` (no implementation) | [V1 14911-14913, 14933-14935] | V3 designer does not ship 3-column layout with collapse | L (full re-architecture) |
| Event bus deleted (`hiprintTemplateDataChanged_<id>` etc.) | n/a — no `o.a.event` infrastructure in V3 | 6 V1 event-bus keys | Pinia reactivity replaces it | M (provide subscribe API) |
| `hiprint.print/print2/getHtml` accept template arg not data only | `src/hiprint-v3/compat/hiprint-global.ts:333-362` | V1 `print(data)` with bound `this=hiprint` | Different invocation pattern; V3 wraps each call in transient PrintTemplate | M |

### 12.11 V3 Sprint 22a Findings Re-verified

| Sprint 22a flagged item | V3 status confirmation | V3 file:line evidence |
|---|---|---|
| TB-006 pagination bar (V3 added but V1 doesn't have separate pagination bar) | ⚠️ VIOLATION confirmed | `src/hiprint-v3/components/HiprintToolbar.vue:1076-1097` — pagination strip rendered inline in toolbar; V1 has bottom canvas strip only (`.hiprint-printPagination`) and only via opt-in `showPagination:false` default |
| Default paper list (V3 Letter/A4/B5/A5 — actually V3 is A3/A4/A5/B4/B5; B3 missing, fractional dims rounded) | ⚠️ VIOLATION confirmed | `src/hiprint-v3/components/HiprintToolbar.vue:226-232` (see §12.4 row-by-row) |
| PDF button claimed but absent in V1 | ⚠️ VIOLATION confirmed | `src/hiprint-v3/components/HiprintToolbar.vue:246, 974-984` (V1 grep yields zero matches for `pdfButtonText/showPdf`) |
| Undo button (V1 keyboard-only) | ⚠️ VIOLATION confirmed | `src/hiprint-v3/components/HiprintToolbar.vue:241, 893-903` (V1 [V1 149-151] explicit "NOT IN V1 TOOLBAR") |
| Redo button (V1 keyboard-only) | ⚠️ VIOLATION confirmed | `src/hiprint-v3/components/HiprintToolbar.vue:242, 904-914` (V1 [V1 153-155] explicit "NOT IN V1 TOOLBAR") |
| RemovePanel button (V1 keyboard-/pagination-strip-only) | ⚠️ VIOLATION confirmed | `src/hiprint-v3/components/HiprintToolbar.vue:1110-1120` (V1 [V1 174-176] explicit "NOT IN V1 TOOLBAR") |
| Grid toggle (V1 element-level only) | ⚠️ VIOLATION confirmed | `src/hiprint-v3/components/HiprintToolbar.vue:258, 1158-1169` (V1 [V1 313-315] explicit "NOT IN V1 TOOLBAR") |
| Ruler toggle (V1 has no ruler at all) | ⚠️ VIOLATION confirmed | `src/hiprint-v3/components/HiprintToolbar.vue:257, 1170-1181` (V1 [V1 317-319] zero matches) |
| Bring-to-Front (V1 ctxmenu+keyboard) | ✅ DONE in V3 ctxmenu — but V3 keyboard.ts MISSES Ctrl+]/Shift+] | `src/hiprint-v3/interactions/context-menu.ts:374-382` ✓; `src/hiprint-v3/interactions/keyboard.ts:233-308` ✗ no `]` |
| Send-to-Back | ✅ DONE in V3 ctxmenu — keyboard same gap | `src/hiprint-v3/interactions/context-menu.ts:379-381` ✓; same keyboard gap |
| Lock/Unlock (V1 element opt, no toolbar) | ✅ DONE no toolbar in V3 (matches V1) | n/a |
| 67 PrintTemplate methods | 🟡 14 of 67 ≈ 21% (see §7 + §12.6) | `src/hiprint-v3/compat/print-template.ts:123-417` |
| 76 buildToolbar opts | 🟡 30 of 76 ≈ 39% (see §8A) | `src/hiprint-v3/components/HiprintToolbar.vue:105-199` props + `compat/build-toolbar.ts:27-42` |
| onCustomPaperOpen / onClearConfirm / onTemplateSelectError / alignItems V1 undocumented opts | 🔴 MISSING (onCustomPaperOpen, onClearConfirm, onTemplateSelectError); 🟡 PARTIAL (alignItems via different shape) | confirmed; see rows 73-76 of §8A |

---

### 12.12 Per-Keyboard-Combo V1→V3 Granular Mapping

This expands V1 inventory §3.1 (27 keyboard combos) into individual rows, each scored against V3's `src/hiprint-v3/interactions/keyboard.ts` window-keydown handler.

| V1 ref | V1 keyboard combo | V3 status | V3 file:line | Diff notes | Effort |
|---|---|---|---|---|---|
| [V1 10951-10957] Ctrl/Cmd+Z (undo) | ✅ DONE | `src/hiprint-v3/interactions/keyboard.ts:237-246` | Implemented; calls `history.undo()` | n/a |
| [V1 10952-10954] Ctrl/Cmd+Shift+Z (redo) | ✅ DONE | `src/hiprint-v3/interactions/keyboard.ts:238-243` | Implemented | n/a |
| [V1 10960-10969] Ctrl/Cmd+A (select all) | 🔴 MISSING | `src/hiprint-v3/interactions/keyboard.ts:233-308` | No Ctrl+A binding | M |
| [V1 10971-10981] Esc (deselect all) | 🔴 MISSING | `src/hiprint-v3/interactions/keyboard.ts:233-308` | No Esc binding | S |
| [V1 10983-11003] Ctrl/Cmd+] (z-index up 1) | 🔴 MISSING | `src/hiprint-v3/interactions/keyboard.ts:233-308` | No `]` binding | M |
| [V1 10983-11003] Ctrl/Cmd+[ (z-index down 1) | 🔴 MISSING | `src/hiprint-v3/interactions/keyboard.ts:233-308` | No `[` binding | M |
| [V1 10987-10992] Ctrl/Cmd+Shift+] (to front) | 🔴 MISSING | `src/hiprint-v3/interactions/keyboard.ts:233-308` | No Shift+] binding | M |
| [V1 10993-10996] Ctrl/Cmd+Shift+[ (to back) | 🔴 MISSING | `src/hiprint-v3/interactions/keyboard.ts:233-308` | No Shift+[ binding | M |
| [V1 11009-11015] Ctrl/Cmd+V paste from `#copyArea` | 🟡 PARTIAL | `src/hiprint-v3/interactions/keyboard.ts:260-264, 147-172` | V3 uses internal clipboard not DOM `#copyArea` | n/a |
| [V1 1467-1481] Ctrl/Cmd+C copy to `#copyArea`+ clipboard API | 🟡 PARTIAL | `src/hiprint-v3/interactions/keyboard.ts:255-259, 126-145` | Internal clipboard; not navigator.clipboard | n/a |
| [V1 1568-1594] Backspace/Delete (per-element delete) | 🟡 PARTIAL | `src/hiprint-v3/interactions/keyboard.ts:272-277` | Delete selected; doesn't honor `positionLocked` element option | S |
| [V1 1595-1604] ArrowLeft (per-element move) | 🟡 PARTIAL | `src/hiprint-v3/interactions/keyboard.ts:291-295` | Moves selection by moveStep; no positionLocked check; no `_editing` check | S |
| [V1 1607-1617] ArrowUp (per-element move) | 🟡 PARTIAL | `src/hiprint-v3/interactions/keyboard.ts:281-285` | Same | S |
| [V1 1619-1629] ArrowRight (per-element move) | 🟡 PARTIAL | `src/hiprint-v3/interactions/keyboard.ts:296-300` | Same | S |
| [V1 1631-1640] ArrowDown (per-element move) | 🟡 PARTIAL | `src/hiprint-v3/interactions/keyboard.ts:286-290` | Same | S |
| [V1 1469-1474] Enter in `_editing` element (Alt=newline) | 🔴 MISSING | `src/hiprint-v3/interactions/keyboard.ts:233-308` | No inline-edit Enter handling | M |
| [V1 12020-12050] ArrowKeys on panel.target (mouseRect move) | 🔴 MISSING | `src/hiprint-v3/interactions/keyboard.ts:233-308` | No panel-level mouseRect arrow handling | M |
| [V1 1764-1765] Enter (table column-select cell end edit) | 🔴 MISSING | `src/hiprint-v3/interactions/keyboard.ts:233-308` | No table-cell editing | M |
| [V1 1772-1773] Enter (text cell end edit) | 🔴 MISSING | `src/hiprint-v3/interactions/keyboard.ts:233-308` | No cell editing | M |
| [V1 12158-12159] Enter on `.auto-submit:input` (option panel submit) | 🔴 MISSING | `src/hiprint-v3/interactions/keyboard.ts:233-308` | No option-panel keyboard binding | M |
| [V1 12231-12232] Enter `.auto-submit:input` (option panel field 2) | 🔴 MISSING | `src/hiprint-v3/interactions/keyboard.ts:233-308` | Same | M |
| [V1 12269-12270] Enter `.auto-submit:input` (option panel field 3) | 🔴 MISSING | `src/hiprint-v3/interactions/keyboard.ts:233-308` | Same | M |
| [V1 14294-14299] Esc on `.hiprint-toolbar-popover` (custom paper) | 🔴 MISSING | `src/hiprint-v3/components/CustomPaperPopover.vue:66-101` | Popover has no Esc handler | S |
| [V1 13746-13750] Esc on business dialog | ✅ DONE | `src/hiprint-v3/components/dialogs/BusinessDialog.vue` | Ant Modal native | n/a |
| [V1 14003-14007] Esc on template dialog | ✅ DONE | `src/hiprint-v3/components/dialogs/TemplateDialog.vue` | Ant Modal native | n/a |
| [V1 14123-14127] Esc on save dialog | ✅ DONE | `src/hiprint-v3/components/dialogs/SaveDialog.vue` | Ant Modal native | n/a |
| [V1 14151-14156] Enter on save input | ✅ DONE | `src/hiprint-v3/components/dialogs/SaveDialog.vue` | Ant Form native | n/a |
| [V1 11774-11781] ArrowLeft on element-list panel header | 🔴 MISSING | `src/hiprint-v3/components/HiprintElementList.vue` | No draggable header in V3 element list | M |
| [V1 11781-11783] ArrowRight on element-list panel header | 🔴 MISSING | `src/hiprint-v3/components/HiprintElementList.vue` | Same | M |
| [V1 11783-11785] ArrowUp on element-list panel header | 🔴 MISSING | `src/hiprint-v3/components/HiprintElementList.vue` | Same | M |
| [V1 11785-11787] ArrowDown on element-list panel header | 🔴 MISSING | `src/hiprint-v3/components/HiprintElementList.vue` | Same | M |
| [V1 11787-11791] Enter on element-list panel header (reset position) | 🔴 MISSING | `src/hiprint-v3/components/HiprintElementList.vue` | Same | M |
| [V1 8112] Synthetic keydown(46) for "delete selected" | ⏸️ DEFERRED | n/a | V3 calls `canvas.removeElement` directly; synthetic event not needed | n/a |

### 12.13 Per-V1-Synthetic-Event Granular Mapping

V1 §3.3 enumerates 6 synthetic event bus keys. V3 replaces with Pinia reactivity.

| V1 ref | V1 synthetic event | V3 status | V3 file:line | Diff notes | Effort |
|---|---|---|---|---|---|
| [V1 10953, 10955, 13103] `hiprintTemplateDataShortcutKey_<id>` (undo/redo dispatch) | 🟡 PARTIAL | `src/hiprint-v3/interactions/keyboard.ts:240, 243`, `src/hiprint-v3/compat/print-template.ts:351-362` | V3 direct store call; no event-bus name; subscribers via Pinia watch instead | M (if business needs subscribe API) |
| [V1 10001, 11001, 11586, etc.] `hiprintTemplateDataChanged_<id>` (data mutation observer) | 🟡 PARTIAL | `src/hiprint-v3/stores/history.ts pushSnapshot()` | V3 history snapshots, but no event-bus signal for business listeners | M |
| [V1 12562, 12070] `PrintElementSelectEventKey_<id>` (selection events) | 🟡 PARTIAL | `src/hiprint-v3/stores/canvas.ts selectedElementIds (shallowRef)` | Pinia reactivity; no event-bus key | n/a |
| [V1 12565, 12073] `BuildCustomOptionSettingEventKey_<id>` (rebuild custom option UI) | 🔴 MISSING | n/a | Property panel doesn't have custom option rebuild signal | M |
| [V1 1587, 1593, 12075] `clearSettingContainer` (delete element triggers panel clear) | 🔴 MISSING | n/a | No equivalent event | M |
| [V1 12326] `onSelectPanel` (pagination strip click) | 🔴 MISSING | n/a | V3 setActivePanel direct call; no event | n/a |

### 12.14 Per-V1-Global-Event-Binding Granular Mapping

V1 §3.2 enumerates 14 jQuery `$(document)/$(window)/$('body')` bindings. V3 replaces with addEventListener / Vue lifecycle.

| V1 ref | V1 binding | V3 status | V3 file:line | Diff notes | Effort |
|---|---|---|---|---|---|
| [V1 9600] `$(document).on('mousemove<this._guideDragNamespace>', ...)` | 🔴 MISSING | n/a | V3 has no guide-line system | L |
| [V1 9601-9608] `$(document).on('mouseup<ns>', finishGuideDrag)` | 🔴 MISSING | n/a | Same | L |
| [V1 9610] `$('body').addClass('hiprint-guide-dragging')` | 🔴 MISSING | n/a | Same | L |
| [V1 11615] `$(document).one('click.hiprintCtxMenu', ...)` (close ctx menu) | 🟡 PARTIAL | `src/hiprint-v3/interactions/context-menu.ts` | V3 ctx menu has Vue lifecycle-bound close; different namespace style | n/a |
| [V1 11815] `$(document).on('mousemove.hiprintElListDrag_<tid>', ...)` (el-list drag) | 🔴 MISSING | n/a | V3 element list not draggable | M |
| [V1 11820] `$(document).on('mouseup.hiprintElListDrag_<tid>', ...)` | 🔴 MISSING | n/a | Same | M |
| [V1 11821] `$(window).on('mouseup blur.hiprintElListDrag_<tid>', ...)` | 🔴 MISSING | n/a | Same | M |
| [V1 10949] `$(document).on('keydown', ...)` (NO namespace — known V1 leak) | ✅ DONE (and improved) | `src/hiprint-v3/interactions/keyboard.ts:311-314` | V3 returns cleanup fn; V1's leak is fixed | n/a |
| [V1 14303] `$(document).on('click<_toolbarClickNs>', ...)` (close custom-paper popover) | 🔴 MISSING | `src/hiprint-v3/components/CustomPaperPopover.vue:73` | V3 popover has `@click.stop` but no document-level outside-click listener; click outside trigger button won't close | S |
| [V1 15039] `$(document).on('mousemove<_designerEventNs>', leftResize)` | 🔴 MISSING | n/a | No resize bars in V3 designer | L |
| [V1 15040] `$(document).on('mouseup<_designerEventNs>', leftResizeEnd)` | 🔴 MISSING | n/a | Same | L |
| [V1 15060] `$(document).on('mousemove<_designerEventNs>', rightResize)` | 🔴 MISSING | n/a | Same | L |
| [V1 15061] `$(document).on('mouseup<_designerEventNs>', rightResizeEnd)` | 🔴 MISSING | n/a | Same | L |
| [V1 15341-15344] `$(document).ready(...)` autoConnect on DOMContentLoaded | 🟡 PARTIAL | `src/hiprint-v3/compat/hiprint-global.ts:296-303` | Method exists; not auto-triggered on DOMContentLoaded | n/a |

### 12.15 V1 Toolbar Section 12 QA Checklist Coverage

V1 inventory ships a 6-subsection QA checklist (Section 12). Track per-item against V3.

| V1 ref | QA item | V3 status | V3 file:line | Diff notes |
|---|---|---|---|---|
| §12.1 14 button groups render with correct label | 🟡 PARTIAL | `src/hiprint-v3/components/HiprintToolbar.vue:893-1269` | Most buttons render; labels are English emoji-prefixed not 中文 |
| §12.1 12 `show*` flags toggle visibility | 🟡 PARTIAL | `src/hiprint-v3/components/HiprintToolbar.vue:241-260` | Has 14 show* props (more than V1's 12); some defaults wrong (see P0 fix list) |
| §12.1 Click handlers call documented hooks with documented signatures | 🟡 PARTIAL | `src/hiprint-v3/components/HiprintToolbar.vue:484-851` | Click handlers exist; signatures often differ (arg order swapped, missing args) |
| §12.1 toolbarCtrl.setButtonText(key, text) safe + html path | 🔴 MISSING | n/a | toolbarCtrl deleted |
| §12.1 toolbarCtrl.setButtonVisible + auto-hide empty groups | 🔴 MISSING | n/a | toolbarCtrl deleted; reactive show* props instead |
| §12.1 toolbarCtrl.setButtonDisabled toggles disabled | 🔴 MISSING | n/a | toolbarCtrl deleted |
| §12.1 toolbarCtrl.triggerButton programmatic click | 🔴 MISSING | n/a | toolbarCtrl deleted |
| §12.1 extraButtons render with 11 documented fields | 🟡 PARTIAL | `src/hiprint-v3/components/HiprintToolbar.vue:92-103` | 9 of 11 fields |
| §12.1 toolbarCtrl.addGroup($el, position) at runtime | 🔴 MISSING | n/a | toolbarCtrl deleted |
| §12.1 opts.renderExtra invoked once after extra group append | 🔴 MISSING | n/a | renderExtra not implemented |
| §12.1 Paper-size buttons toggle .active + aria-pressed | ⚠️ VIOLATION | `src/hiprint-v3/components/HiprintToolbar.vue:1001-1016` | V3 uses select not buttons |
| §12.1 Default-paper button starts active | 🟡 PARTIAL | `src/hiprint-v3/components/HiprintToolbar.vue:321, 1004` | `selectedPaperLabel = props.defaultPaper` — select element shows default; no .active class semantics |
| §12.1 Custom-paper popover synced aria-expanded state | ✅ DONE | `src/hiprint-v3/components/HiprintToolbar.vue:1022` | matches |
| §12.1 Alignment items respect opts.alignItems override | 🟡 PARTIAL | `src/hiprint-v3/components/HiprintToolbar.vue:277, 414-416` | Different shape (string[] vs `{type,label,icon}[]`) |
| §12.2 Business dialog opens / listProvider / cards / refresh / ESC | 🟡 PARTIAL | `src/hiprint-v3/components/dialogs/BusinessDialog.vue` | Dialog renders; provider pattern missing; refresh emit only |
| §12.2 Business dialog cancellation (requestId) | 🔴 MISSING | n/a | No request management |
| §12.2 Template dialog 4 actions (Select/Preview/Edit/Delete) each fire correct hook | 🟡 PARTIAL | `src/hiprint-v3/components/dialogs/TemplateDialog.vue:79-91` | 3 actions only — Preview missing |
| §12.2 Template delete confirm flow with onTemplateDeleteConfirm | 🔴 MISSING | n/a | No confirm hook |
| §12.2 Save dialog validates non-empty trimmed name | 🟡 PARTIAL | `src/hiprint-v3/components/dialogs/SaveDialog.vue:94-95` | nameError ref present; trim semantics implicit |
| §12.2 Save dialog Enter key submits | ✅ DONE | `src/hiprint-v3/components/dialogs/SaveDialog.vue` | Ant Form native |
| §12.2 Save dialog ESC closes without saving | ✅ DONE | `src/hiprint-v3/components/dialogs/SaveDialog.vue` | Ant Modal native |
| §12.2 Lazy-create dialogs (`ensureXxxDialog`) | 🟡 PARTIAL | `src/hiprint-v3/components/dialogs/*` | Vue v-if mounts on first show; lazy by default |
| §12.2 3 dialog ARIA bundle | 🟡 PARTIAL | Ant Modal native | Missing deterministic labelledby IDs |
| §12.2 Lifecycle hooks `onXxxDialogOpen/Close` correct context | 🔴 MISSING | n/a | No context-object hooks |
| §12.2 Save dialog Promise.resolve catch shows error inline | 🟡 PARTIAL | `src/hiprint-v3/components/dialogs/SaveDialog.vue:94-95` | nameError ref; parent owns submit flow |
| §12.2 Custom paper popover w/h validation | 🔴 MISSING | `src/hiprint-v3/components/CustomPaperPopover.vue:57-59` | No validation |
| §12.2 Outside-click closes custom paper popover (namespace-bound) | 🔴 MISSING | n/a | No document-level listener |
| §12.3 All 27 keyboard combos work | 🟡 PARTIAL | `src/hiprint-v3/interactions/keyboard.ts` | 6 of 27 work; 18+ missing (see §12.12) |
| §12.3 Custom paper popover ESC restores focus to trigger | 🔴 MISSING | n/a | No ESC handler at all |
| §12.3 Icon-only buttons have aria-label | 🟡 PARTIAL | `src/hiprint-v3/components/HiprintToolbar.vue:*` | aria-label present but English not 中文 |
| §12.3 Paper buttons have aria-pressed | ⚠️ VIOLATION | `src/hiprint-v3/components/HiprintToolbar.vue:1001-1016` | Select not buttons |
| §12.3 Popover trigger has aria-haspopup + aria-expanded | 🟡 PARTIAL | `src/hiprint-v3/components/HiprintToolbar.vue:1020-1023` | aria-expanded only; aria-haspopup missing |
| §12.3 Tab navigation works through visible buttons | ✅ DONE | n/a (default behavior) | Native button tab |
| §12.3 Save dialog input auto-focused with caret at end on open | 🟡 PARTIAL | `src/hiprint-v3/components/dialogs/SaveDialog.vue` | Ant Form autofocus may apply; caret-at-end not explicit |
| §12.3 Element-list panel header tabindex/role/aria-label/arrow drag | 🔴 MISSING | `src/hiprint-v3/components/HiprintElementList.vue` | No draggable header |
| §12.4 Multiple toolbars use unique _toolbarUid | 🔴 MISSING | n/a | No uid; Vue component instances are scoped |
| §12.4 Multiple designers use unique _designerUid | 🔴 MISSING | n/a | Same |
| §12.4 Each toolbar destroys independently | ✅ DONE | `src/hiprint-v3/compat/build-toolbar.ts:129-137` | Vue app.unmount() scoped |
| §12.4 toolbarCtrl.destroy idempotent | ✅ DONE | `src/hiprint-v3/compat/build-toolbar.ts:129-137` | `if (this._destroyed) return;` |
| §12.4 template.destroy idempotent | ✅ DONE | `src/hiprint-v3/compat/print-template.ts:388-406` | `if (this._destroyed) return;` |
| §12.4 No event handler leaks after destroy+rebuild loop 10x | 🟡 PARTIAL | n/a | V3's cleaner shouldn't leak; not formally tested |
| §12.4 No singleton-map growth | ✅ DONE | n/a | V3 has no singleton map |
| §12.5 All 76 buildToolbar opts have parity | 🟡 PARTIAL | (see §8A) | 30 of 76 ≈ 39% |
| §12.5 All 15 buildDesigner opts have parity | 🟡 PARTIAL | (see §8B) | ~7 of 15 covered; 6 deferred (resize), 2 missing |
| §12.5 Defaults match exactly | ⚠️ VIOLATION | (see P0 list) | showPanelManager, showPagination, paperTypes, showBusiness/Template all wrong |
| §12.5 extraPosition 'start' prepends; 'end' appends | ✅ DONE | `src/hiprint-v3/components/HiprintToolbar.vue:871-1269` | matches |
| §12.5 opts.alignItems empty array falls back to defaults | 🟡 PARTIAL | `src/hiprint-v3/components/HiprintToolbar.vue:277, 414-416` | Default factory provides 6 entries (not 8); empty array would be respected |
| §12.5 opts.businessListProvider===null no auto-load; setBusinessItems works | 🔴 MISSING | n/a | Provider not implemented; setBusinessItems toolbarCtrl method missing |
| §12.6 buildDesigner internally calls buildToolbar | 🟡 PARTIAL | `src/hiprint-v3/compat/build-designer.ts:288-360` | V3 mounts HiprintDesigner which renders HiprintToolbar; no separate buildToolbar call |
| §12.6 showPagination toggle works at runtime via designerCtrl.setPaginationVisible | 🔴 MISSING (no-op stub) | `src/hiprint-v3/compat/build-designer.ts:469-475` | Stub with warn |
| §12.6 Panel manager dropdown syncs with template.printPanels on mousedown/focus | ⚠️ VIOLATION | `src/hiprint-v3/components/HiprintToolbar.vue:1052-1072` | V3 chip list; reactive via Pinia (no mousedown/focus refresh needed but different pattern) |
| §12.6 Add-page button creates new panel and switches | ✅ DONE | `src/hiprint-v3/components/HiprintToolbar.vue:623-633` | matches |
| §12.6 deletePanel keeps at least 1 panel | ✅ DONE | `src/hiprint-v3/stores/canvas.ts:186-191` | invariant enforced |
| §12.6 template.destroy removes element-list panel + toggle from $mountTarget | n/a | n/a | V3 has no movable element-list panel |
| §12.6 template.update(json, idx) survives wrong shape (try/catch + onUpdateError) | 🟡 PARTIAL | `src/hiprint-v3/compat/print-template.ts:231-239` | try/catch present; **no onUpdateError invocation**; also drops `idx` arg |

---

## Appendix A: V3 Source File Coverage Summary

For documentation purposes, every V3 source file referenced in this matrix.

| V3 file | Purpose | Line count (approx) |
|---|---|---|
| `src/hiprint-v3/components/HiprintToolbar.vue` | Toolbar SFC | 1402 |
| `src/hiprint-v3/components/HiprintDesigner.vue` | Designer SFC | 580 |
| `src/hiprint-v3/components/HiprintCanvas.vue` | Canvas SFC | (not measured this pass) |
| `src/hiprint-v3/components/HiprintPanel.vue` | Panel SFC | (not measured) |
| `src/hiprint-v3/components/HiprintElementList.vue` | Element list SFC | (not measured) |
| `src/hiprint-v3/components/CustomPaperPopover.vue` | Custom paper popover SFC | 173 |
| `src/hiprint-v3/components/dialogs/BusinessDialog.vue` | Business dialog SFC | 256 |
| `src/hiprint-v3/components/dialogs/TemplateDialog.vue` | Template dialog SFC | 251 |
| `src/hiprint-v3/components/dialogs/SaveDialog.vue` | Save dialog SFC | 236 |
| `src/hiprint-v3/compat/print-template.ts` | PrintTemplate compat class | 417 |
| `src/hiprint-v3/compat/build-toolbar.ts` | buildToolbar function | 152 |
| `src/hiprint-v3/compat/build-designer.ts` | buildDesigner function | 478 |
| `src/hiprint-v3/compat/hiprint-global.ts` | hiprint facade | 387 |
| `src/hiprint-v3/compat/vue-plugin.ts` | Vue plugin install | 214 |
| `src/hiprint-v3/compat/index.ts` | Compat barrel | 51 |
| `src/hiprint-v3/interactions/keyboard.ts` | Keyboard shortcuts | 315 |
| `src/hiprint-v3/interactions/context-menu.ts` | Context menu | (not measured) |
| `src/hiprint-v3/stores/canvas.ts` | Canvas state store | 507 |
| `src/hiprint-v3/stores/template.ts` | Template state store | 223 |
| `src/hiprint-v3/stores/history.ts` | Undo/redo state store | 198 |

## Appendix B: V1 Inventory Section Index

| V1 inventory section | V1 lines | V3 parity rating (qualitative) |
|---|---|---|
| §1 Toolbar Buttons (26 subsections) | 1530:14-393 | 🟡 surface present but with multiple ⚠️ VIOLATIONs |
| §2 Dialogs (4 subsections) | 1530:395-509 | 🟡 SFCs exist; lifecycle hooks + provider/loader pattern missing |
| §3 Keyboard & Global Events (27 combos + 14 bindings + 6 sync) | 1530:511-585 | 🔴 most missing — 6 of 27 keyboard combos, ~1 of 14 bindings |
| §4 CSS Classes & ARIA (24 ARIA attrs + ~90 classes) | 1530:587-698 | 🔴 most classes renamed/missing; Ant Modal-based dialogs lose all V1 class names |
| §5 buildDesigner Shell + 15 opts + designerCtrl (17 methods) | 1530:700-796 | 🟡 7 of 15 opts (6 deferred), 4 of 17 designerCtrl methods (rest deleted) |
| §6 Public API Exports (23 total) | 1530:798-996 | 🟡 all 23 named exports present but ~half have signature/contract drift |
| §7 PrintTemplate Public Methods (67 total) | 1530:998-1075 | 🔴 14 of 67 ≈ 21% |
| §8A buildToolbar opts (76 total) | 1530:1078-1161 | 🟡 30 of 76 ≈ 39% |
| §8A.2 toolbarCtrl Methods (42 total) | 1530:1163-1212 | 🔴 3 of 42 ≈ 7% (intentional architectural break) |
| §8B buildDesigner opts (15 total) | 1530:1216-1237 | 🟡 7 of 15 (6 deferred, 2 missing) |
| §9 Data Structures (5 entries) | 1530:1240-1351 | 🟡 templateSchema ✅ DONE; defaultPaperTypes + defaultAlignItems ⚠️ VIOLATION; normalizers MISSING |
| §10 Destruction & Memory (8 failure modes) | 1530:1354-1380 | 🟡 V3 fixes V1's keydown leak; loses some V1 cleanup steps |
| §11 Known Gaps & Workarounds (12 entries) | 1530:1384-1399 | 🟡 mixed — some fixed in V3, others worsened (PDF/Undo/Redo etc. became toolbar buttons rather than extras) |
| §12 QA Checklist (6 subsections) | 1530:1403-1477 | 🟡 (see §12.15 above) — most items partial or missing |

**End of V3 Parity Matrix — Toolbar & Shell**

Status counts: ✅ 47 / 🟡 39 / 🔴 134 / ⚠️ 18 / ⏸️ 5 / **TOTAL 243 rows scored** in top-level matrix; §12 adds ~150 further drill-down rows for granularity (deliberately not aggregated into headline summary to avoid double-counting).

Cross-references: docs/V1-INVENTORY/toolbar-and-shell.md (1530 lines, source of truth).
