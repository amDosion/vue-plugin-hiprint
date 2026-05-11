# V1 User-Visible Behavior Inventory: Toolbar & Shell

**Document Purpose**: Complete catalog of V1 toolbar and shell UI, for V3 rewrite behavioral parity validation.

**Last Updated**: 2026-05-11
**V1 Source Bundle**: `src/hiprint/hiprint.bundle.js` (15353 lines)
**Key Sections**: buildToolbar [V1 line 13305], buildDesigner [V1 line 14859], dialogs [V1 lines 13612-14196], exports [V1 lines 15291-15340]

> Convention: every property row cites the exact V1 bundle line `[V1 line N]`. ZH translations are taken from defaults in `buildToolbar` opts block [V1 lines 13315-13390] or `i18n.__('...')` literals. No invented behavior — sections marked "NOT IN V1 TOOLBAR" reflect grep results showing zero matches in the bundle.

---

## Section 1: Toolbar Buttons (Complete Enumeration)

All toolbar buttons defined in `buildToolbar()` function [V1 line 13305]. Each button is **conditionally rendered** based on opts flag. Button + group registration via `registerToolbarButton(key, $el, {groupKey})` [V1 line 13484] / `registerToolbarGroup(key, $el)` [V1 line 13478] — registries used by `toolbarCtrl.getButton/setButtonText/setButtonVisible/setButtonDisabled/triggerButton/getButtons/getGroup/setGroupVisible/getGroups` runtime API.

Render order (top→bottom in source) [V1 lines 14209-14509]:

1. `businessSelect` group → `businessSelect` button
2. `templateSelect` group → `templateSelect` button
3. `paper` group → `paper:<name>` buttons (one per `opts.paperTypes` entry) + optional `paper:custom` + `paper:customConfirm` (inside popover)
4. `scale` group → `scale:zoomOut` + label + `scale:zoomIn`
5. `rotate` group → `rotate` button
6. `align` group → `align:left/horizontalCenter/right/top/verticalCenter/bottom/distributeHorizontal/distributeVertical` (default 8) or whatever `opts.alignItems` overrides
7. `preview` group → `preview` button
8. `clear` group → `clear` button
9. `print` group → `print` button
10. `panels` group → `panels:add` + select (composite control, only if `opts.showPanelManager === true`)
11. `save` group → `save` button
12. `extra` group → `extra:<key>` buttons (from `opts.extraButtons[]`, position controlled by `opts.extraPosition`)
13. Optional `opts.renderExtra(toolbarApi)` runs after registration

### 1.1 Business Selection Button

| Property | Value | Source |
|---|---|---|
| **Button ID (registry key)** | `businessSelect` | [V1 line 14212] |
| **Group Key** | `businessSelect` | [V1 line 14211] |
| **Group DOM Class** | `hiprint-toolbar-group hiprint-toolbar-business-select` | [V1 line 14211] |
| **Button DOM Class** | `hiprint-toolbar-btn` | [V1 line 14212] |
| **Label (EN/default text)** | "Business Select" (translation key) | [V1 line 14212] |
| **Label (ZH)** | "业务选择" | [V1 line 13338] `opts.businessButtonText` default `i18n.__('业务选择')` |
| **Icon** | None (text-only) | [V1 line 14212] |
| **Visibility Opt** | `opts.showBusinessSelect` (default `true`) | [V1 line 13337] |
| **Text Customizable Via** | `opts.businessButtonText` | [V1 line 13338] |
| **Click Handler** | `opts.onBusinessClick(template, toolbarApi)` then `openBusinessDialog()` | [V1 lines 14213-14221] |
| **Hook Return Semantics** | `false` = skip default dialog open | [V1 line 14218] |
| **`_safeCall` Wrapped?** | Yes — `onBusinessClick` is wrapped, throws are caught + logged | [V1 line 14216] |
| **Disabled Condition** | N/A — always enabled (can be disabled at runtime via `toolbarCtrl.setButtonDisabled('businessSelect', true)`) | N/A |
| **State** | Triggers business dialog (Section 2.1) | [V1 14219] |

### 1.2 Template Selection Button

| Property | Value | Source |
|---|---|---|
| **Button ID (registry key)** | `templateSelect` | [V1 line 14229] |
| **Group Key** | `templateSelect` | [V1 line 14228] |
| **Group DOM Class** | `hiprint-toolbar-group hiprint-toolbar-template-select` | [V1 line 14228] |
| **Button DOM Class** | `hiprint-toolbar-btn` | [V1 line 14229] |
| **Label (ZH)** | "选择模版" | [V1 line 13360] `opts.templateButtonText` default `i18n.__('选择模版')` |
| **Icon** | None (text-only) | [V1 line 14229] |
| **Visibility Opt** | `opts.showTemplateSelect` (default `true`) | [V1 line 13353] |
| **Text Customizable Via** | `opts.templateButtonText` | [V1 line 13360] |
| **Click Handler** | `openTemplateDialog()` directly (no pre-click hook, but `opts.onTemplateDialogOpen(context)` fires from inside `openTemplateDialog`) | [V1 lines 14230-14232], [V1 14041-14055] |
| **Hook Signature (open)** | `onTemplateDialogOpen({type:'template', payload, template, api, openDefault, closeDefault}) → bool` | [V1 line 14050] |
| **Hook Return Semantics** | `false` / `true` = caller takes over default | [V1 lines 14051-14053] |
| **Disabled Condition** | N/A — always enabled | N/A |
| **State** | Triggers template dialog (Section 2.2) | [V1 14041] |

### 1.3 Save Button

| Property | Value | Source |
|---|---|---|
| **Button ID (registry key)** | `save` | [V1 line 14503] |
| **Group Key** | `save` | [V1 line 14502] |
| **Group DOM Class** | `hiprint-toolbar-group` | [V1 line 14502] |
| **Button DOM Class** | `hiprint-toolbar-btn` | [V1 line 14503] |
| **Label (ZH)** | "保存" | [V1 line 13369] `opts.saveButtonText` default `i18n.__('保存')` |
| **Icon** | None (text-only) | [V1 line 14503] |
| **Visibility Opt** | `opts.showSave` (default `true`) | [V1 line 13354] |
| **Text Customizable Via** | `opts.saveButtonText` | [V1 line 13369] |
| **Click Handler** | `triggerSave(e)` → routes through `openSaveDialog(undefined, e)` → `opts.onSaveDialogOpen(context)` → `openSaveDialogDefault()` | [V1 lines 14504-14506], [V1 14198-14207], [V1 14178-14196] |
| **Hook Signature (open)** | `onSaveDialogOpen({type:'save', payload, defaultName, template, api, openDefault(name), closeDefault}) → bool` | [V1 lines 14179-14195] |
| **Hook Signature (save)** | `onSave(template, json, event, api, {name}) → Promise|any` | [V1 line 14086] |
| **Disabled Condition** | N/A — always enabled | N/A |
| **Programmatic Trigger** | `toolbarCtrl.triggerSave({skipPrompt:true, name:'...'})` to skip dialog | [V1 lines 14198-14207] |
| **Default Action (no `onSave`)** | Downloads JSON Blob via `downloadTemplateJson(json, name+'.json')` | [V1 lines 14088-14092], [V1 13593-13610] |
| **State** | Opens save dialog (Section 2.3) unless `skipPrompt` | [V1 14178] |

### 1.4 Preview Button

| Property | Value | Source |
|---|---|---|
| **Button ID (registry key)** | `preview` | [V1 line 14387] |
| **Group Key** | `preview` | [V1 line 14386] |
| **Group DOM Class** | `hiprint-toolbar-group` | [V1 line 14386] |
| **Button DOM Class** | `hiprint-toolbar-btn` | [V1 line 14387] |
| **Label (ZH)** | "预览" | [V1 line 13366] `opts.previewButtonText` default `i18n.__('预览')` |
| **Icon** | None (text-only) | [V1 line 14387] |
| **Visibility Opt** | `opts.showPreview` (default `true`) | [V1 line 13326] |
| **Text Customizable Via** | `opts.previewButtonText` | [V1 line 13366] |
| **Click Handler** | `opts.onPreview(template)` if provided; else `console.warn('[hiprint] preview button clicked but opts.onPreview not provided')` | [V1 lines 14388-14393] |
| **Hook Signature** | `onPreview(template) → void` | [V1 line 14390] |
| **`_safeCall` Wrapped?** | Yes — `onPreview` is wrapped | [V1 line 14390] |
| **Disabled Condition** | N/A — always enabled | N/A |
| **State** | No built-in preview surface — business must implement (e.g., open modal with `template.getHtml(data)`) | [V1 14389-14393] |

### 1.5 Print Button (browser print)

| Property | Value | Source |
|---|---|---|
| **Button ID (registry key)** | `print` | [V1 line 14433] |
| **Group Key** | `print` | [V1 line 14432] |
| **Group DOM Class** | `hiprint-toolbar-group` | [V1 line 14432] |
| **Button DOM Class** | `hiprint-toolbar-btn hiprint-toolbar-btn-primary` | [V1 line 14433] |
| **Label (ZH)** | "打印" | [V1 line 13368] `opts.printButtonText` default `i18n.__('打印')` |
| **Icon** | None (text-only) | [V1 line 14433] |
| **Visibility Opt** | `opts.showPrint` (default `true`) | [V1 line 13328] |
| **Text Customizable Via** | `opts.printButtonText` | [V1 line 13368] |
| **Click Handler** | `opts.onPrint(template)` if provided; else `console.warn('[hiprint] print button clicked but opts.onPrint not provided')` | [V1 lines 14434-14439] |
| **Hook Signature** | `onPrint(template) → void` | [V1 line 14436] |
| **`_safeCall` Wrapped?** | Yes | [V1 line 14436] |
| **Disabled Condition** | N/A — always enabled | N/A |
| **State** | Caller normally calls `template.print(data, options)` or `template.print2(data, options)` from this hook | [V1 14434], [V1 12651], [V1 12654] |

### 1.6 PDF Export Button — **NOT IN V1 TOOLBAR**

Grep result for `pdfButtonText|toPdfButtonText|downloadPdfButtonText|showPdf` → 0 matches. No PDF button is rendered by `buildToolbar`. The underlying API `PrintTemplate.toPdf(data, filename, options)` exists at [V1 line 12776] and returns `$.Deferred().promise()`; business code must invoke it directly (e.g., from an `extraButtons` entry or custom `onPreview` flow).

### 1.7 Clear Button

| Property | Value | Source |
|---|---|---|
| **Button ID (registry key)** | `clear` | [V1 line 14402] |
| **Group Key** | `clear` | [V1 line 14401] |
| **Group DOM Class** | `hiprint-toolbar-group` | [V1 line 14401] |
| **Button DOM Class** | `hiprint-toolbar-btn hiprint-toolbar-btn-danger` (red) | [V1 line 14402] |
| **Label (ZH)** | "清空" | [V1 line 13367] `opts.clearButtonText` default `i18n.__('清空')` |
| **Icon** | None (text-only) | [V1 line 14402] |
| **Visibility Opt** | `opts.showClear` (default `true`) | [V1 line 13327] |
| **Text Customizable Via** | `opts.clearButtonText` | [V1 line 13367] |
| **Click Handler (3-tier priority)** | (1) `opts.onClear(template)` totally takes over; (2) `opts.onClearConfirm(template) → Promise|bool` returning truthy runs `template.clear()`; (3) native `confirm(i18n.__('是否确认清空') + '?')` | [V1 lines 14403-14425] |
| **Hook Signature (full takeover)** | `onClear(template) → void` | [V1 line 14406] |
| **Hook Signature (async confirm)** | `onClearConfirm(template) → Promise<bool>|bool` (truthy/resolve(true) = run clear; false/reject = cancel) | [V1 lines 14409-14422] |
| **`_safeCall` Wrapped?** | `onClear` wrapped [V1 14406]; `onClearConfirm` wrapped in explicit `try/Promise.resolve(...).catch()` [V1 14413-14421] |
| **Disabled Condition** | N/A — always enabled | N/A |
| **State** | Calls `template.clear()` which keeps panel index 0, removes index>0 panels' DOM | [V1 lines 12568-12575] |

### 1.8 Undo Button — **NOT IN V1 TOOLBAR**

Grep result for `undoButtonText|showUndo` → 0 matches. Undo is keyboard-only via `Ctrl/Cmd + Z` [V1 lines 10951-10958]: triggers event `hiprintTemplateDataShortcutKey_<templateId>` with `"undo"` → `PrintTemplate.initAutoSave` listener → restores from `historyList[historyPos - 1]` [V1 lines 13103-13116, V1 line 12545]. Programmatic equivalent: `template.undo()` at [V1 line 12545].

### 1.9 Redo Button — **NOT IN V1 TOOLBAR**

Grep result for `redoButtonText|showRedo` → 0 matches. Redo is keyboard-only via `Ctrl/Cmd + Shift + Z` [V1 lines 10952-10956]: triggers event `hiprintTemplateDataShortcutKey_<templateId>` with `"redo"` → restores from `historyList[historyPos + 1]` [V1 lines 13117-13122]. Programmatic equivalent: `template.redo()` at [V1 line 12548].

### 1.10 Add Panel Button (`panels:add`)

| Property | Value | Source |
|---|---|---|
| **Button ID (registry key)** | `panels:add` | [V1 line 14457] |
| **Group Key** | `panels` | [V1 line 14452] |
| **Group DOM Class** | `hiprint-toolbar-group hiprint-toolbar-panels` | [V1 line 14452] |
| **Inner Control Class** | `hiprint-toolbar-panel-manager` (composite: label + select + add button) | [V1 line 14453] |
| **Button DOM Class** | `hiprint-toolbar-panel-manager-add` | [V1 line 14458] |
| **Label (text content)** | `opts.addPanelButtonText` default `'+'` | [V1 lines 13359, 14461] |
| **`title` attr** | `i18n.__('添加分页')` | [V1 line 14459] |
| **`aria-label`** | `i18n.__('添加分页')` | [V1 line 14460] |
| **Visibility Opt** | `opts.showPanelManager` default **`false`** (uniquely opt-in — V1's only default-off toolbar group) | [V1 lines 13355-13357, 14448] |
| **Click Handler** | `template.addPrintPanel(undefined, true)` then `refreshPanelSelect()` (try/catch with `console.error('[hiprint] addPrintPanel failed:', err)`) | [V1 lines 14484-14492] |
| **Hook** | None — uses bare `template.addPrintPanel` API | N/A |
| **Disabled Condition** | If `template.addPrintPanel` is missing returns silently | [V1 line 14485] |

### 1.11 Remove Panel Button — **NOT IN V1 TOOLBAR**

Grep result for `removePanelButtonText|showRemovePanel|deletePanelButtonText` → 0 matches. Panel removal is via the legacy bottom pagination strip (rendered inside canvas `.hiprint-printPagination` only when `buildDesigner` is called with `opts.showPagination: true` [V1 lines 14921-14927]). Programmatic equivalent: `template.deletePanel(idx)` at [V1 line 12500] which enforces "must keep at least 1 panel" invariant [V1 lines 12504-12507] and re-selects clamped next index if the deleted panel was editing [V1 lines 12510-12515].

### 1.12 Zoom Out Button (`scale:zoomOut`)

| Property | Value | Source |
|---|---|---|
| **Button ID (registry key)** | `scale:zoomOut` | [V1 line 14323] |
| **Group Key** | `scale` | [V1 line 14317] |
| **Group DOM Class** | `hiprint-toolbar-group hiprint-toolbar-scale` | [V1 line 14317] |
| **Button DOM Class** | `hiprint-toolbar-btn hiprint-toolbar-icon-btn` | [V1 line 14323] |
| **Label (text content)** | `"−"` (unicode minus) | [V1 line 14323] |
| **`title` attr** | `i18n.__('缩小')` | [V1 line 14323] |
| **`aria-label`** | `i18n.__('缩小')` | [V1 line 14323] |
| **Visibility Opt** | `opts.showScale` (default `true`) | [V1 line 13323] |
| **Text Customizable Via** | Not exposed — fixed `−` glyph; can override via `toolbarCtrl.setButtonText('scale:zoomOut', '...')` at runtime | [V1 line 14323] |
| **Click Handler** | `scaleValue = Math.max(opts.scaleMin, scaleValue − opts.scaleStep)`, `template.zoom(scaleValue)`, `updateScaleLabel()`, `_safeCall(opts.onScaleChange, [scaleValue], 'onScaleChange')` | [V1 lines 14325-14330] |
| **Hook Signature** | `onScaleChange(scale: number) → void` | [V1 line 14329] |
| **Bounds** | `opts.scaleMin` default `0.5`; `opts.scaleStep` default `0.1` | [V1 lines 13318-13320] |
| **Disabled Condition** | N/A — clamped by `Math.max(scaleMin)` | [V1 line 14326] |

### 1.13 Zoom Reset Label (`scaleLabel` — not a button)

| Property | Value | Source |
|---|---|---|
| **Element Type** | `<span class="hiprint-toolbar-scale-label">` — display only, not registered as button | [V1 line 14318] |
| **Initial Text** | `"100%"` | [V1 line 14318] |
| **Update Trigger** | `updateScaleLabel()` writes `Math.round(scaleValue * 100) + '%'` | [V1 lines 14319-14321] |
| **Reset Programmatic** | `toolbarCtrl.setScale(1)` to restore 100% | [V1 line 14725] |
| **Clickable to reset?** | **No** — V1 has no "click 100% to reset" affordance; user must zoom in/out to reach 100% | [V1 line 14318 — no `.on('click')` binding] |

### 1.14 Zoom In Button (`scale:zoomIn`)

| Property | Value | Source |
|---|---|---|
| **Button ID (registry key)** | `scale:zoomIn` | [V1 line 14324] |
| **Group Key** | `scale` | [V1 line 14324] |
| **Button DOM Class** | `hiprint-toolbar-btn hiprint-toolbar-icon-btn` | [V1 line 14324] |
| **Label (text content)** | `"+"` | [V1 line 14324] |
| **`title` attr** | `i18n.__('放大')` | [V1 line 14324] |
| **`aria-label`** | `i18n.__('放大')` | [V1 line 14324] |
| **Visibility Opt** | `opts.showScale` (default `true`) shares with zoomOut | [V1 line 13323] |
| **Click Handler** | `scaleValue = Math.min(opts.scaleMax, scaleValue + opts.scaleStep)`, `template.zoom(scaleValue)`, `updateScaleLabel()`, `_safeCall(opts.onScaleChange)` | [V1 lines 14331-14336] |
| **Bounds** | `opts.scaleMax` default `5`; `opts.scaleStep` default `0.1` | [V1 lines 13319-13320] |
| **Disabled Condition** | N/A — clamped by `Math.min(scaleMax)` | [V1 line 14332] |

### 1.15 Paper Size Buttons (one per `opts.paperTypes` entry)

| Property | Value | Source |
|---|---|---|
| **Button ID (registry key)** | `paper:<name>` — e.g., `paper:A4`, `paper:A5`, `paper:B5`, `paper:Letter`, `paper:A3`, `paper:B3`, `paper:B4` | [V1 line 14243] |
| **Group Key** | `paper` | [V1 line 14239] |
| **Group DOM Class** | `hiprint-toolbar-group hiprint-toolbar-paper` | [V1 line 14239] |
| **Button DOM Class** | `hiprint-toolbar-btn` (with `.active` on the selected one) | [V1 line 14244] |
| **`data-paper` attr** | the paper-type name | [V1 line 14244] |
| **`aria-pressed`** | `"true"` if active else `"false"` (toggle state for SR) | [V1 line 14244] |
| **Label (text content)** | The paper-type key itself (e.g., `A4`, `Letter`) | [V1 line 14244] |
| **Visibility Opt** | `opts.showPaperSelect` (default `true`) | [V1 line 13321] |
| **Buttons Set Source** | `opts.paperTypes` (default `_defaultPaperTypes` — A3/A4/A5/B3/B4/B5 [V1 lines 13296-13303]) | [V1 lines 13316, 14242] |
| **Click Handler** | (a) set `curPaper = name`; (b) remove `.active` + set `aria-pressed='false'` on all paper buttons [V1 14247]; (c) add `.active` + `aria-pressed='true'` on clicked [V1 14248]; (d) `$customBtn.removeClass('active')` if present [V1 14249]; (e) `template.setPaper(size.width, size.height)` [V1 14250]; (f) `_safeCall(opts.onPaperChange, [name, size], 'onPaperChange')` [V1 14251] |
| **Hook Signature** | `onPaperChange(name: string, size: {width, height}) → void` — fires for built-in buttons (size = mm dimensions); fires with `'custom'` + `{width, height}` for custom popover confirm [V1 14273] |
| **Disabled Condition** | N/A — always enabled | N/A |
| **Default Selection** | `opts.defaultPaper` default `'A4'` → matching button starts with `.active` | [V1 lines 13317, 14240, 14244] |

> NOTE: V1's default `_defaultPaperTypes` dictionary (and dimensions) [V1 lines 13296-13303]:
>
> | Name | Width (mm) | Height (mm) |
> |---|---|---|
> | A3 | 420 | 296.6 |
> | A4 | 210 | 296.6 |
> | A5 | 210 | 147.6 |
> | B3 | 500 | 352.6 |
> | B4 | 250 | 352.6 |
> | B5 | 250 | 175.6 |
>
> The previous doc table (A4/Letter/B5/A5 with 215.9×279.4 etc.) was inaccurate — Letter is not in V1's default set, dimensions match the literal V1 dictionary above.

### 1.16 Rotate Paper Button

| Property | Value | Source |
|---|---|---|
| **Button ID (registry key)** | `rotate` | [V1 line 14345] |
| **Group Key** | `rotate` | [V1 line 14343] |
| **Group DOM Class** | `hiprint-toolbar-group` | [V1 line 14343] |
| **Button DOM Class** | `hiprint-toolbar-btn` | [V1 line 14345] |
| **Label (ZH)** | "旋转" (also includes leading `'↻ '` glyph) → "↻ 旋转" | [V1 lines 13365, 14345] |
| **`title` attr** | Same as label (`rotateText`) | [V1 line 14345] |
| **Visibility Opt** | `opts.showRotate` (default `true`) | [V1 line 13324] |
| **Text Customizable Via** | `opts.rotateButtonText` (note: glyph `↻ ` is hard-prepended) | [V1 lines 13365, 14344] |
| **Click Handler** | `template.rotatePaper()` then `_safeCall(opts.onRotate, [template], 'onRotate')` | [V1 lines 14346-14349] |
| **Hook Signature** | `onRotate(template) → void` | [V1 line 14348] |
| **State** | Swaps the editing panel's width and height [V1 line 12480-12482]; toggles between portrait/landscape | [V1 line 11176] |

### 1.17 Custom Paper Button (`paper:custom`)

| Property | Value | Source |
|---|---|---|
| **Button ID (registry key)** | `paper:custom` | [V1 line 14258] |
| **Group Key** | `paper` (shares group with paper-size buttons) | [V1 line 14258] |
| **Button DOM Class** | `hiprint-toolbar-btn` | [V1 line 14258] |
| **`data-paper` attr** | `"custom"` | [V1 line 14258] |
| **`aria-haspopup`** | `"dialog"` | [V1 line 14258] |
| **`aria-expanded`** | `"false"` initially; synced to `"true"`/`"false"` on toggle | [V1 lines 14258, 14287] |
| **Label (ZH)** | "自定义" | [V1 line 13363] `opts.customPaperButtonText` default `i18n.__('自定义')` |
| **Visibility Opt** | `opts.showCustomPaper` (default `true`) **AND** parent `opts.showPaperSelect` (default `true`) | [V1 lines 13321, 13322, 14256] |
| **Text Customizable Via** | `opts.customPaperButtonText` | [V1 line 13363] |
| **Click Handler** | `e.stopPropagation()`; if `opts.onCustomPaperOpen(template, toolbarApi) === false` → block default popover (business renders own dialog); else `$customPopover.toggle()` + sync `aria-expanded` + `setTimeout(0)` focus first input | [V1 lines 14278-14292] |
| **Hook Signature** | `onCustomPaperOpen(template, toolbarApi) → bool` (return `false` to suppress built-in popover) | [V1 line 14282] |
| **State** | Shows popover with two number inputs (default w=220, h=80 mm) + confirm button | [V1 lines 14259-14276] |

### 1.18 Custom Paper Confirm Button (`paper:customConfirm`)

| Property | Value | Source |
|---|---|---|
| **Button ID (registry key)** | `paper:customConfirm` | [V1 line 14264] |
| **Group Key** | `paper` | [V1 line 14264] |
| **Button DOM Class** | `hiprint-toolbar-btn active` (note: `.active` is preset in markup, providing styled affirmative button) | [V1 line 14264] |
| **Label (ZH)** | "确定" | [V1 line 13364] `opts.customPaperConfirmText` default `i18n.__('确定')` |
| **Visibility Opt** | inherits `opts.showCustomPaper` | [V1 line 14256] |
| **Text Customizable Via** | `opts.customPaperConfirmText` | [V1 line 13364] |
| **Click Handler** | Read w/h from `$wInput.val()` / `$hInput.val()`; if both `> 0`: set `curPaper='custom'`, swap `.active` to `$customBtn`, `template.setPaper(w, h)`, hide popover, fire `onPaperChange('custom', {width:w, height:h})` | [V1 lines 14265-14275] |
| **Inputs** | `$wInput = <input type="number" placeholder="宽(mm)" value="220" style="width:80px;">`, `$hInput = <input type="number" placeholder="高(mm)" value="80" style="width:80px;">` | [V1 lines 14261, 14263] |
| **Separator** | `<span style="margin:0 4px;">×</span>` | [V1 line 14262] |

### 1.19 Panel Manager Dropdown (`<select>` inside `panels` group)

| Property | Value | Source |
|---|---|---|
| **Element Type** | `<select class="hiprint-toolbar-panel-manager-select">` — not registered as button (no key in registry) | [V1 line 14455] |
| **`aria-label`** | `i18n.__('选择分页')` | [V1 line 14456] |
| **Group Key** | `panels` | [V1 line 14452] |
| **Label Sibling** | `<span class="hiprint-toolbar-panel-manager-label">` + text `opts.panelManagerLabel` default `i18n.__('分页')` ("分页") | [V1 lines 13358, 14454] |
| **Visibility Opt** | `opts.showPanelManager` (default **`false`**) | [V1 lines 13355-13357] |
| **Item Source** | `template.printPanels[i].name` or fallback `'第' + (i+1) + '页'`; `.text()` safe (XSS-defended) | [V1 lines 14467-14471] |
| **Refresh Trigger** | `mousedown` and `focus` on the select run `refreshPanelSelect()` (lazy sync; no event bus subscription, simpler destroy) | [V1 line 14479] |
| **Change Handler** | `change` event → parses `val()` to int → `template.selectPanel(idx)` | [V1 lines 14480-14483] |
| **Initial Selection** | `template.editingPanel.index` | [V1 lines 14473-14474] |

### 1.20 Grid Toggle Button — **NOT IN V1 TOOLBAR**

Grep result for `gridButtonText|showGrid|gridToggle` → 0 matches in `buildToolbar`. Grid options exist as an element-level option (`gridOptions`) and panel-level config, but no toolbar-level button toggles them.

### 1.21 Ruler Toggle Button — **NOT IN V1 TOOLBAR**

Grep result for `ruler|showRuler` → 0 matches in `buildToolbar`. Rulers are not implemented in V1.

### 1.22 Alignment Buttons (8 default items, group `align`)

Rendered as a **flyout of icon-only buttons** inside one toolbar group (not a single popover) — each alignment is a separate button. [V1 lines 14354-14382].

| `type` | `label` (ZH) | `icon` | Registry Key | V1 source |
|---|---|---|---|---|
| `left` | "左对齐" | `⫷` | `align:left` | [V1 line 14359] |
| `horizontalCenter` | "水平居中" | `⫿` | `align:horizontalCenter` | [V1 line 14360] |
| `right` | "右对齐" | `⫸` | `align:right` | [V1 line 14361] |
| `top` | "顶对齐" | `⫠` | `align:top` | [V1 line 14362] |
| `verticalCenter` | "垂直居中" | `⫥` | `align:verticalCenter` | [V1 line 14363] |
| `bottom` | "底对齐" | `⫡` | `align:bottom` | [V1 line 14364] |
| `distributeHorizontal` | "水平等距" | `⇔` | `align:distributeHorizontal` | [V1 line 14365] |
| `distributeVertical` | "垂直等距" | `⇕` | `align:distributeVertical` | [V1 line 14366] |

| Property | Value | Source |
|---|---|---|
| **Group Key** | `align` | [V1 line 14371] |
| **Group DOM Class** | `hiprint-toolbar-group hiprint-toolbar-align` | [V1 line 14371] |
| **Button DOM Class** | `hiprint-toolbar-btn hiprint-toolbar-icon-btn` (icon-only) | [V1 line 14374] |
| **`title`** | `item.label` (e.g., "左对齐") | [V1 line 14374] |
| **`aria-label`** | `item.label` (icon-only buttons MUST have aria-label) | [V1 line 14374] |
| **Visibility Opt** | `opts.showAlign` (default `true`) — toggles entire group | [V1 lines 13325, 14355] |
| **Override Items** | `opts.alignItems: [{type, label, icon}]` — array fully replaces default set when non-empty; filtered to ensure `type && label && icon` are truthy [V1 lines 14368-14370] |
| **Click Handler** | `template.alignElements(item.type)` then `_safeCall(opts.onAlign, [item.type, template], 'onAlign')` | [V1 lines 14375-14378] |
| **Hook Signature** | `onAlign(type: string, template) → void` | [V1 line 14377] |
| **Underlying logic** | `template.alignElements` → `editingPanel.alignElements(type)` [V1 lines 12483-12485, 11626-11678]; uses `getSelectedElements()` (which honors `mouseRect.mouseRectSelectedElement` first); requires `≥2` selected for align, `≥3` for distribute |

### 1.23 Distribute Buttons

Not a separate group — distribute is two entries inside the alignment-button group (`distributeHorizontal`, `distributeVertical`). See Section 1.22 rows 7-8 above. No standalone "distribute" group exists in V1.

### 1.24 Bring-to-Front / Send-to-Back Buttons — **NOT IN V1 TOOLBAR**

Grep result for `bringToFront|sendToBack|zIndexBtn|showZIndex` in `buildToolbar` → 0 matches. Z-index changes are **keyboard-only** in V1 via `Ctrl/Cmd + ]` (up one layer), `Ctrl/Cmd + [` (down one layer), `Ctrl/Cmd + Shift + ]` (to-front), `Ctrl/Cmd + Shift + [` (to-back) [V1 lines 10983-11003]. The element-level z-index option exists as a per-element property [V1 referenced via `zIndex()` option entry, line 5989 registry list]. Right-click context menu also provides programmatic access at [V1 line 11553+ approx within `bingPasteEvent`/contextmenu block].

### 1.25 Lock / Unlock Button — **NOT IN V1 TOOLBAR**

Grep result for `lockBtn|showLock|positionLocked.*button` → 0 toolbar matches. `options.positionLocked` is an element-level option (used during keyboard move to suppress arrow-key movement while still allowing delete) [V1 lines 1566-1572]. Toolbar surface does not expose lock.

### 1.26 ExtraButtons API (`opts.extraButtons[]` and `opts.renderExtra`)

The `extra` group is rendered last (or first, see `extraPosition`) using `createExtraButton(btnOpt, api)` [V1 lines 14520-14556] and `addToolbarGroup($group, position)` [V1 lines 14511-14518].

| `btnOpt` field | Type | Required | Effect | V1 source |
|---|---|---|---|---|
| `key` | `string` | recommended (auto-assigned as `''+index` if omitted) | Registry key → button accessible via `toolbarCtrl.getButton('extra:'+key)` | [V1 lines 14546-14548, 14705] |
| `label` | `string` | yes (unless `html` provided) | Text label rendered with `.text()` (XSS-safe) | [V1 line 14540] |
| `text` | `string` | alias of `label` (used if `label` falsy) | Text content | [V1 line 14540] |
| `icon` | `string` | no | Prepended glyph (joined with space) — `text = icon + ' ' + label` | [V1 lines 14539-14541] |
| `html` | `string` | no | If non-null, calls `.html(html)` instead of `.text(...)` — **business is responsible for XSS-escaping HTML content** | [V1 lines 14533-14536] |
| `type` | `'primary'` / `'danger'` / `''` | no | Adds `hiprint-toolbar-btn-primary` (blue) or `hiprint-toolbar-btn-danger` (red) classes | [V1 lines 14525-14528] |
| `className` | `string` | no | Extra space-separated class appended | [V1 line 14529] |
| `title` | `string` | no | `title` attribute for tooltip | [V1 line 14532] |
| `visible` | `bool` / `function(template, api) → bool` | no | Defaults to `true`; if function evaluated at render | [V1 lines 14522-14523] |
| `disabled` | `bool` / `function(template, api) → bool` | no | Defaults to `false`; if function evaluated at render; **NOT re-evaluated** on state change | [V1 lines 14544-14545] |
| `onClick` | `function(template, event, api) → void` | recommended | Called on click (suppressed if `disabled`) | [V1 lines 14549-14554] |
| **NOT in V1** | `tooltipPlacement` / `confirmText` / `loading` | — | — | grep yields 0 |

Group-level options:

| `opts.*` | Default | Effect | V1 source |
|---|---|---|---|
| `extraButtons` | `[]` | Array of `btnOpt` objects (above) | [V1 line 13388] |
| `extraPosition` | `'end'` | `'start'` prepends extra group, `'end'` appends | [V1 lines 13387, 14513-14517] |
| `renderExtra` | `null` | Function `(toolbarApi) → void` called after `extraButtons` group append (sync, business inserts custom DOM via `toolbarApi.toolbar.append(...)` or `addGroup(...)`) | [V1 lines 13389, 14716-14718] |

Programmatic group insertion at runtime:

- `toolbarApi.addGroup($jqueryEl, position)` — inserts arbitrary `$el` as a toolbar group at `'start'` or `'end'` (defaults to `opts.extraPosition`) [V1 lines 14565-14567]
- `toolbarApi.createButton(btnOpt)` — exposes `createExtraButton` for ad-hoc button creation that participates in registry [V1 lines 14568-14570]

---

## Section 2: Dialogs (Complete)

Each dialog is **lazily created on first open** via `ensureXxxDialog()`, then `show()`/`hide()` thereafter [V1 lines 13722-13769, 13980-14032, 14095-14158]. All three dialogs are appended to the toolbar's `$container` (not `document.body`) [V1 lines 13741, 13999, 14118].

### 2.1 Business Selection Dialog [V1 lines 13612-13792]

**Trigger**: `businessSelect` button click → `opts.onBusinessClick` (skip if returns `false`) → `openBusinessDialog()` → `opts.onBusinessDialogOpen({...}) → bool` (skip default if returns `false`/`true`) → `openBusinessDialogDefault()` → `ensureBusinessDialog()` + `$businessDialog.show()` + `renderBusinessDialog()` + `refreshBusinessList()` [V1 lines 13771-13792].

| Property | Value | V1 source |
|---|---|---|
| **Root Wrap Class** | `hiprint-toolbar-business-dialog-wrap` | [V1 line 13727] |
| **ARIA** | `role="dialog"`, `aria-modal="true"`, `aria-labelledby="hp-business-title-<uid>"`, `tabindex="-1"` | [V1 line 13727] |
| **Inner Layers** | `.hiprint-toolbar-template-mask` (clickable backdrop) + `.hiprint-toolbar-template-dialog` (panel) | [V1 lines 13728-13729] |
| **Title** | `<h2 id="hp-business-title-<uid>" class="hiprint-toolbar-template-title">` text = `opts.businessDialogTitle` (default "选择业务") | [V1 lines 13731, 13614] |
| **Title customizable** | `opts.businessDialogTitle` default `i18n.__('选择业务')` | [V1 line 13342] |
| **Body** | `<div class="hiprint-toolbar-template-body" aria-live="polite" aria-busy="false">` | [V1 line 13733] |
| **Footer Buttons** | (1) "刷新" `.hiprint-toolbar-business-refresh` [V1 13735]; (2) "关闭" `.js-business-close` with `aria-label="关闭"` [V1 13736] |
| **Loading State** | `<div class="hiprint-toolbar-template-state loading">` text = `opts.businessDialogLoadingText` (default "业务加载中...") | [V1 lines 13618, 13344] |
| **Error State** | `<div class="hiprint-toolbar-template-state error">` text = (err.message || `opts.businessDialogErrorText` "业务加载失败") | [V1 lines 13622, 13672, 13345] |
| **Empty State** | `<div class="hiprint-toolbar-template-state empty">` text = `opts.businessDialogEmptyText` (default "暂无业务") | [V1 lines 13626, 13343] |
| **Item Normalization** | `normalizeBusinessItem(item, index)` adds `_bid` (id), `_name` (name/title/businessName/label/'未命名业务 N'), `_idx` to each item | [V1 lines 13455-13464] |
| **Data Source** | `opts.businessListProvider(template, toolbarApi) → Promise<list>|list` — items normalized; if `null` provider → no auto-load, `setBusinessItems([...])` API available | [V1 lines 13649-13679, 13346] |
| **Card Markup (per item)** | `.hiprint-toolbar-template-card` (with `data-business-index`); inner: title (`.hiprint-toolbar-template-card-title` using `.text()` XSS-safe), description (`.hiprint-toolbar-template-card-desc`, fallback "暂无描述"), optional meta (`.hiprint-toolbar-template-card-meta` with "更新时间:") | [V1 lines 13629-13646] |
| **Description Fields** | `item.description || item.desc || item.remark` | [V1 line 13631] |
| **Update Time Fields** | `item.updatedAt || item.updateTime || item.modifiedAt` | [V1 line 13632] |
| **Card Action Button** | "选择" button `.hiprint-toolbar-business-action[data-action="select"][data-index="<idx>"]` (class adds primary blue) | [V1 line 13642] |
| **Select Action** | `handleBusinessSelect(item)` → `resolveBusinessData(item)` → `opts.businessLoader(item, template, api)` (if defined) OR `item.businessConfig || item.fieldsConfig || item.config || item.data || null` → `_safeCall(opts.onBusinessSelect, [item, parsedData, template, api])` → close dialog if `opts.closeBusinessDialogOnSelect !== false` | [V1 lines 13709-13719, 13702-13707] |
| **Auto-Close on Select** | `opts.closeBusinessDialogOnSelect` (default `true`) | [V1 lines 13349, 13714] |
| **ESC Close** | `keydown` → `Escape || keyCode === 27` → `closeBusinessDialog()` | [V1 lines 13746-13751] |
| **Mask Click Close** | click on `.hiprint-toolbar-template-mask` or `.js-business-close` | [V1 lines 13742-13744] |
| **Dialog Body Stop Propagation** | click on `.hiprint-toolbar-template-dialog` → `e.stopPropagation()` so mask handler doesn't see inner clicks | [V1 lines 13752-13754] |
| **Refresh Button** | click on `.hiprint-toolbar-business-refresh` → `refreshBusinessList()` | [V1 lines 13755-13757] |
| **Hooks Lifecycle** | `onBusinessClick`, `onBusinessDialogOpen({type:'business', payload, template, api, openDefault, closeDefault})`, `onBusinessDialogClose({type:'business', ...})`, `onBusinessSelect(item, data, template, api)`, `onBusinessSelectError` (silent — only logged, no opts hook) | [V1 lines 13339-13348, 13713, 13718] |
| **Programmatic API** | `toolbarCtrl.openBusinessDialog()`, `closeBusinessDialog()`, `refreshBusinessList()`, `setBusinessItems(list)`, `getBusinessItems()`, `setBusinessListProvider(fn)`, `setBusinessLoader(fn)`, `getBusinessDialogElement()` | [V1 lines 14574-14602, 14732-14755] |
| **RequestId Cancellation** | `businessDialogRequestId` counter cancels stale `.then()` if user re-triggers refresh mid-flight | [V1 lines 13656, 13661, 13671] |

### 2.2 Template Selection Dialog [V1 lines 13794-14055]

**Trigger**: `templateSelect` button click → `openTemplateDialog()` → `opts.onTemplateDialogOpen({...}) → bool` (skip default if returns `false`/`true`) → `openTemplateDialogDefault()` → `ensureTemplateDialog()` + `$templateDialog.show()` + `renderTemplateDialog()` + `refreshTemplateList()` [V1 lines 14034-14055].

| Property | Value | V1 source |
|---|---|---|
| **Root Wrap Class** | `hiprint-toolbar-template-dialog-wrap` | [V1 line 13985] |
| **ARIA** | `role="dialog"`, `aria-modal="true"`, `aria-labelledby="hp-template-title-<uid>"`, `tabindex="-1"` | [V1 line 13985] |
| **Inner Layers** | `.hiprint-toolbar-template-mask` + `.hiprint-toolbar-template-dialog` | [V1 lines 13986-13987] |
| **Title** | `<h2 id="hp-template-title-<uid>" class="hiprint-toolbar-template-title">` text = `opts.templateDialogTitle` (default "选择模版") | [V1 lines 13989, 13796, 13376] |
| **Body** | `<div class="hiprint-toolbar-template-body" aria-live="polite" aria-busy="false">` | [V1 line 13991] |
| **Footer Buttons** | (1) "刷新" `.hiprint-toolbar-template-refresh` [V1 13993]; (2) "关闭" `.js-template-close` with `aria-label="关闭"` [V1 13994] |
| **Loading State** | `<div class="hiprint-toolbar-template-state loading">` text = `opts.templateDialogLoadingText` (default "模版加载中...") | [V1 lines 13800, 13378] |
| **Error State** | `<div class="hiprint-toolbar-template-state error">` text = (err.message || `opts.templateDialogErrorText` "模版加载失败") | [V1 lines 13804, 13858, 13379] |
| **Empty State** | `<div class="hiprint-toolbar-template-state empty">` text = `opts.templateDialogEmptyText` (default "暂无模版") | [V1 lines 13808, 13377] |
| **Item Normalization** | `normalizeTemplateItem(item, index)` adds `_tid` (id), `_name` (name/title/templateName/label/'未命名模版 N'), `_idx` | [V1 lines 13432-13441] |
| **Data Source** | `opts.templateListProvider(template, toolbarApi) → Promise<list>|list` | [V1 lines 13833-13865, 13380] |
| **Card Markup (per item)** | `.hiprint-toolbar-template-card[data-template-index]`; title/desc/meta same as business [V1 lines 13816-13821] |
| **Card Action Buttons** | (1) "选择" primary `[data-action="select"]` [V1 13823]; (2) "预览" `[data-action="preview"]` [V1 13824]; (3) "编辑" `[data-action="edit"]` [V1 13825]; (4) "删除" danger red `[data-action="delete"]` [V1 13826] |
| **Select Action** | `handleTemplateSelect(item)` → `resolveTemplateData(item)` → `opts.templateLoader(item, template, api)` OR `item.template || item.templateJson || item.json || item.data || null` → `parseTemplateData(rawData)` (parses string JSON or passes object) → `applyTemplateData(json)` (calls `template.update(json)`) → `_safeCall(opts.onTemplateSelect, [item, json|raw, template, api])` → close if `opts.closeTemplateDialogOnSelect !== false`; on `.catch` → `_safeCall(opts.onTemplateSelectError, [err, item, template, api])` + close anyway | [V1 lines 13895-13912] |
| **Preview Action** | `_safeCall(opts.onTemplatePreview, [item, template, api])` (business shows preview UI) | [V1 line 14023] |
| **Edit Action** | `_safeCall(opts.onTemplateEdit, [item, template, api])` (business opens own editor) | [V1 line 14025] |
| **Delete Action** | `handleTemplateDelete(item)` → `confirmTemplateDelete(item)` (uses `opts.onTemplateDeleteConfirm(context) → Promise<bool>` if provided, else native `confirm('是否确认删除?')`) → if `allow !== false` → `executeDelete()` (calls `opts.onTemplateDelete(item, template, api) → Promise<bool>`; if returns `false` skip refresh, else `refreshTemplateList()`; if no hook → local remove + render) | [V1 lines 13914-13978] |
| **Auto-Close on Select** | `opts.closeTemplateDialogOnSelect` (default `true`) | [V1 lines 13386, 13903] |
| **ESC Close** | `Escape || keyCode === 27` → `closeTemplateDialog()` | [V1 lines 14003-14008] |
| **Mask/Close Button** | `.hiprint-toolbar-template-mask`, `.js-template-close` → `closeTemplateDialog()` | [V1 lines 14000-14002] |
| **Refresh Button** | `.hiprint-toolbar-template-refresh` → `refreshTemplateList()` | [V1 lines 14012-14014] |
| **Hooks Lifecycle** | `onTemplateDialogOpen(context)`, `onTemplateDialogClose(context)`, `onTemplateSelect(item, json, template, api)`, `onTemplateSelectError(err, item, template, api)`, `onTemplatePreview(item, template, api)`, `onTemplateEdit(item, template, api)`, `onTemplateDelete(item, template, api) → Promise<bool>`, `onTemplateDeleteConfirm(context) → Promise<bool>` | [V1 lines 13350-13386, 13918, 13948] |
| **Programmatic API** | `toolbarCtrl.openTemplateDialog()`, `closeTemplateDialog()`, `refreshTemplateList()`, `setTemplateItems(list)`, `getTemplateItems()`, `setTemplateListProvider(fn)`, `setTemplateLoader(fn)`, `getTemplateDialogElement()` | [V1 lines 14603-14642, 14756-14787] |
| **Sync `throw` Safety** | `onTemplateDeleteConfirm` and `onTemplateDelete` both wrap sync calls in `try` to prevent `Promise.resolve(throw)` losing the throw — sync throw → log + return `Promise.resolve(false)` for confirm, void for delete | [V1 lines 13929-13937, 13952-13959] |

### 2.3 Save Dialog [V1 lines 14057-14207]

**Trigger**: `save` button click → `triggerSave(e)` → with no `skipPrompt` falls through to `openSaveDialog(undefined, e)` → `opts.onSaveDialogOpen({type:'save', payload, defaultName, template, api, openDefault, closeDefault}) → bool` (skip default if returns) → `openSaveDialogDefault(defaultName)` → `ensureSaveDialog()` + populate input + show + focus [V1 lines 14160-14196].

| Property | Value | V1 source |
|---|---|---|
| **Root Wrap Class** | `hiprint-toolbar-save-dialog-wrap` | [V1 line 14102] |
| **ARIA** | `role="dialog"`, `aria-modal="true"`, `aria-labelledby="hp-save-title-<uid>"`, `tabindex="-1"` | [V1 line 14102] |
| **Title** | `<h2 id="hp-save-title-<uid>" class="hiprint-toolbar-save-header">` text = `opts.saveDialogTitle` (default "保存模版") | [V1 lines 14105, 13370] |
| **Name Field Label** | `<label for="hp-save-name-<uid>" class="hiprint-toolbar-save-label">` text = `opts.saveDialogNameLabel` (default "模版名称") | [V1 lines 14107, 13371] |
| **Name Input** | `<input id="hp-save-name-<uid>" type="text" class="hiprint-toolbar-save-input">` placeholder = `opts.saveDialogNamePlaceholder` (default "请输入模版名称") `aria-describedby="hp-save-err-<uid>"` | [V1 lines 14108, 13372] |
| **Error Div** | `<div id="hp-save-err-<uid>" class="hiprint-toolbar-save-error" role="alert" style="display:none;">` | [V1 line 14109] |
| **Footer Buttons** | (1) Cancel `.js-save-cancel` text = `opts.saveDialogCancelText` (default "取消") [V1 14112, 13375]; (2) Confirm primary `.js-save-confirm` text = `opts.saveDialogConfirmText` (default "确定") [V1 14113, 13374] |
| **Validation** | Trim input; if empty → show error text = `opts.saveDialogNameRequiredText` (default "请输入模版名称"), focus input, abort | [V1 lines 14134-14140, 13373] |
| **Save Pipeline** | `Promise.resolve(saveTemplateWithName(name, e)).then(closeSaveDialog).catch(err → show error, dialog stays open)` | [V1 lines 14144-14149] |
| **Save Function (`saveTemplateWithName`)** | (1) `json = template.getJson()` if available [V1 14080]; (2) name trim, default "未命名模版" if empty [V1 14081-14084]; (3) if `opts.onSave` → `_safeCall(opts.onSave, [template, json, event, toolbarApi, {name}])` [V1 14086]; (4) else `downloadTemplateJson(json, name + '.json')` triggers `Blob` + `<a download>` click [V1 14088-14091] |
| **Default JSON Download** | Filename = `name + '.json'` (or as-is if already ends in `.json`); type `application/json;charset=utf-8`; uses `URL.createObjectURL` + ephemeral `<a>` + `URL.revokeObjectURL` | [V1 lines 13593-13610] |
| **Enter Key Submit** | `keydown` on input + `keyCode === 13` → trigger click on `.js-save-confirm` | [V1 lines 14151-14156] |
| **Initial Name Value** | `defaultName || template.name || ''` then trimmed; cursor placed at end via `setSelectionRange(len, len)` | [V1 lines 14165-14175] |
| **ESC Close** | `keydown` on dialog + `Escape || keyCode === 27` → `closeSaveDialog()` | [V1 lines 14123-14128] |
| **Mask/Cancel Click Close** | `.hiprint-toolbar-save-mask`, `.js-save-cancel` → `closeSaveDialog()` | [V1 lines 14119-14121] |
| **Programmatic Trigger** | `toolbarCtrl.triggerSave({skipPrompt: true, name: '...'})` skips dialog and calls `saveTemplateWithName` directly; `triggerSave({...})` opens with `payload.name` prefilled; `triggerSave('myName')` shortcut treats string as name+skip | [V1 lines 14198-14207] |
| **Hooks Lifecycle** | `onSaveDialogOpen(context)`, `onSaveDialogClose(context)`, `onSave(template, json, event, api, {name}) → Promise|any` | [V1 lines 13361-13362, 14072-14073, 14086] |
| **Failure Behavior** | `.catch` shows `err.message` (or "保存失败") in `.hiprint-toolbar-save-error`; dialog stays open for retry | [V1 lines 14146-14149] |

### 2.4 Custom Paper Popover [V1 lines 14258-14310]

**Trigger**: `paper:custom` button click → `e.stopPropagation()` → `opts.onCustomPaperOpen(template, api) → bool` (return `false` to skip default UI) → `$customPopover.toggle()` + `aria-expanded` sync + focus first input.

| Property | Value | V1 source |
|---|---|---|
| **Root Class** | `hiprint-toolbar-popover` | [V1 line 14259] |
| **ARIA** | `role="dialog"`, `aria-label="自定义纸张大小"` | [V1 line 14259] |
| **Initial Style** | `display:none;` | [V1 line 14259] |
| **Container Wrap** | `.hiprint-toolbar-custom-wrap` (`position:relative; display:inline-block;`) contains trigger button + popover | [V1 lines 14308-14310] |
| **Content Wrap** | `.hiprint-toolbar-popover-content` | [V1 line 14260] |
| **Width Input** | `<input type="number" class="hiprint-toolbar-input" placeholder="宽(mm)" style="width:80px;" value="220">` | [V1 line 14261] |
| **Separator** | `<span style="margin:0 4px;">×</span>` | [V1 line 14262] |
| **Height Input** | `<input type="number" class="hiprint-toolbar-input" placeholder="高(mm)" style="width:80px;" value="80">` | [V1 line 14263] |
| **Confirm Button** | `paper:customConfirm` (Section 1.18) — class `hiprint-toolbar-btn active` + `style="margin-left:6px;"` | [V1 line 14264] |
| **Toggle Logic** | `$customPopover.toggle()`; `aria-expanded` synced to `$customPopover.is(':visible') ? 'true' : 'false'`; on show, `setTimeout(0)` focuses `$wInput` | [V1 lines 14285-14291] |
| **ESC Close** | `keydown` → `Escape || keyCode === 27` → `$customPopover.hide()` + `aria-expanded='false'` + `focus()` returns to trigger | [V1 lines 14294-14300] |
| **Outside-Click Close** | `$(document).on('click' + _toolbarClickNs, ...)` checks `!$(e.target).closest('.hiprint-toolbar-popover, [data-paper="custom"]').length` → hide popover; **uses toolbar instance namespace** for safe `destroy()` cleanup | [V1 lines 14303-14307] |
| **Hook** | `opts.onCustomPaperOpen(template, toolbarApi) → bool` (return `false` blocks default popover, business renders own UI) | [V1 lines 14281-14283] |
| **Confirm Validation** | Read `parseFloat($wInput.val())` and `parseFloat($hInput.val())`; only if **both > 0** apply changes and close popover (silent reject for invalid) | [V1 lines 14266-14275] |
| **Confirm Side Effects** | `curPaper='custom'`, swap `.active` to custom button, `template.setPaper(w, h)`, `$customPopover.hide()`, `_safeCall(opts.onPaperChange, ['custom', {width, height}], 'onPaperChange')` | [V1 lines 14267-14274] |

---

## Section 3: Keyboard Shortcuts & Global Events (Complete Enumeration)

### 3.1 Keyboard Shortcuts (across the bundle)

Grouped by binding target and key combo. Each row cites the exact V1 line.

| Combo | Context (binding target) | Effect | `e.preventDefault()`? | V1 line |
|---|---|---|---|---|
| `Ctrl/Cmd + Z` | `$(document)` (global) | Trigger event `hiprintTemplateDataShortcutKey_<id>` with `"undo"` → restores prior `historyList` snapshot | yes | [V1 10951-10957] |
| `Ctrl/Cmd + Shift + Z` | `$(document)` (global) | Trigger event with `"redo"` → restores next `historyList` snapshot | yes | [V1 10952-10954] |
| `Ctrl/Cmd + A` | `$(document)` (skip if INPUT/TEXTAREA active) | Select all elements on editing panel (except tables) — adds `.selected` to last child div + `display:block` | yes | [V1 10960-10969] |
| `Esc` | `$(document)` (skip if INPUT/TEXTAREA active) | Deselect all elements; remove `mouseRect.target` and null out `mouseRect` | yes | [V1 10971-10981] |
| `Ctrl/Cmd + ]` | `$(document)` (skip if INPUT/TEXTAREA active) | Bring selected elements up one z-index layer (delta=+1) | yes | [V1 10983-11003] |
| `Ctrl/Cmd + [` | `$(document)` (skip if INPUT/TEXTAREA active) | Send selected elements down one z-index layer (delta=−1) | yes | [V1 10983-11003] |
| `Ctrl/Cmd + Shift + ]` | `$(document)` (skip if INPUT/TEXTAREA active) | Bring selected to **front** (z = maxZ + 1 + i; others unchanged) | yes | [V1 10987-10992] |
| `Ctrl/Cmd + Shift + [` | `$(document)` (skip if INPUT/TEXTAREA active) | Send selected to **back** (selected z=i; other elements push z + selectedEls.length + 1) | yes | [V1 10993-10996] |
| `Ctrl/Cmd + V` | `n.designPaper.target` (per panel; skip if INPUT) | Paste — runs `pasteJson(e)` from `$('#copyArea')` text content | yes | [V1 11009-11015] |
| `Ctrl/Cmd + C` | per-element `t` jQuery target | Copy — runs `copyJson()` writing to `#copyArea` + clipboard API + execCommand fallback | yes | [V1 1467-1481] |
| `Backspace (8)` / `Delete (46)` | per-element `t` (with `tabindex="1"`); skip if INPUT or `_editing` | Delete element + all multi-selected siblings (non-table), trigger `hiprintTemplateDataChanged_<id>` "删除" | no | [V1 1568-1594] |
| `ArrowLeft (37)` | per-element `t` (skip if INPUT or `_editing`, skip if `positionLocked`) | Move element(s) left by `HiPrintConfig.instance.movingDistance`; multi-select aware | yes | [V1 1595-1604] |
| `ArrowUp (38)` | per-element | Move up by `movingDistance` | yes | [V1 1607-1617] |
| `ArrowRight (39)` | per-element | Move right by `movingDistance` | yes | [V1 1619-1629] |
| `ArrowDown (40)` | per-element | Move down by `movingDistance` | yes | [V1 1631-1640] |
| `Enter (13)` (in element with `_editing`) | per-element + Alt modifier flips behavior | Without Alt: `updateByContent()` exits inline edit; with Alt: lets newline through | conditional | [V1 1469-1474] |
| `ArrowLeft/Up/Right/Down` | `panel.target` (with `tabindex="1"`) | Move mouseRect selection by `movingDistance`; triggers "框选移动" event | yes | [V1 12020-12050] |
| `Enter (13)` | inline cell editor (table column select) | End cell editing | no | [V1 1764-1765] |
| `Enter (13)` | inline cell editor (text) | End cell editing | no | [V1 1772-1773] |
| `Enter (13)` | `.auto-submit:input` (option panel) | Submit option panel field | no | [V1 12158-12159, 12231-12232, 12269-12270] |
| `Esc (27)` | `.hiprint-toolbar-popover` (custom paper popover) | Hide popover + restore focus to trigger + `aria-expanded='false'` | yes | [V1 14294-14299] |
| `Esc (27)` | `.hiprint-toolbar-business-dialog-wrap` | Close business dialog (via `closeBusinessDialog()`) | yes | [V1 13746-13750] |
| `Esc (27)` | `.hiprint-toolbar-template-dialog-wrap` | Close template dialog | yes | [V1 14003-14007] |
| `Esc (27)` | `.hiprint-toolbar-save-dialog-wrap` | Close save dialog | yes | [V1 14123-14127] |
| `Enter (13)` | `.hiprint-toolbar-save-input` | Trigger click on `.js-save-confirm` (programmatic submit) | yes | [V1 14151-14156] |
| `ArrowLeft (37)` | element-list panel header (drag handle, draggable popover) | Move panel left by step (10 / 30 with Shift) | yes | [V1 11774-11781] |
| `ArrowRight (39)` | element-list panel header | Move right by step | yes | [V1 11781-11783] |
| `ArrowUp (38)` | element-list panel header | Move up | yes | [V1 11783-11785] |
| `ArrowDown (40)` | element-list panel header | Move down | yes | [V1 11785-11787] |
| `Enter (13)` | element-list panel header | Reset panel position to default top-right | yes | [V1 11787-11791] |
| Synthetic `keydown(46)` | issued internally for "delete selected" code path | Simulates Delete via `new KeyboardEvent("keydown", {bubbles, keyCode:46})` | n/a | [V1 8112] |

### 3.2 Global Event Bindings (`$(document)` / `$(window)` / `$('body')`)

Every binding **must** use a namespace if it lives beyond a single event handler so `destroy()` can off it cleanly. Each row identifies the namespace and the cleanup site.

| # | Target | Event(.namespace) | Handler | Cleanup site | V1 line |
|---|---|---|---|---|---|
| 1 | `$(document)` | `mousemove<this._guideDragNamespace>` (form: `.hiprintGuideDrag_<panelId>`) | Update guide-line drag pointer (rAF-throttled `_onGuideMove`) | Per-panel: explicit `.off("mousemove" + p).off("mouseup" + p)` before re-binding [V1 9599]; on `finishGuideDrag` (mouseup) | [V1 9600] |
| 2 | `$(document)` | `mouseup<this._guideDragNamespace>` | Cancel pending rAF, `finishGuideDrag(t)`, `s.a.instance.draging = false` | Same as #1 — implicit (handler is single-shot per drag) | [V1 9601-9608] |
| 3 | `$("body")` | (class add) `addClass('hiprint-guide-dragging')` | CSS state class for active guide drag | `destroy()` removes via `removeClass('hiprint-guide-dragging hiprint-el-list-dragging')` [V1 12587]; `stopDragging()` removes `hiprint-el-list-dragging` [V1 11759] | [V1 9610] |
| 4 | `$(document)` | `one('click.hiprintCtxMenu', ...)` (single-shot, auto-off) | Close context menu — `$('.hiprint-ctx-menu').remove()` | self-removing | [V1 11615] |
| 5 | `$(document)` | `mousemove.hiprintElListDrag_<templateId>` | Drag element-list popover panel by header | `stopDragging()` → `$(document).off('.hiprintElListDrag_<templateId>')` [V1 11761] | [V1 11815] |
| 6 | `$(document)` | `mouseup.hiprintElListDrag_<templateId>` | End element-list panel drag | Same as #5 | [V1 11820] |
| 7 | `$(window)` | `mouseup.hiprintElListDrag_<templateId> blur.hiprintElListDrag_<templateId>` | Same — also handles window blur as drag terminator | `$(window).off('.hiprintElListDrag_<templateId>')` [V1 11762] | [V1 11821] |
| 8 | `$(document)` | `keydown` (NO namespace — see note) | Global shortcuts (undo/redo/select-all/esc/z-index) for active panel | Guarded by `this._shortcutKeyBound` once-flag [V1 10946] — NOT removed on destroy (known leak unless full panel cleanup) | [V1 10949] |
| 9 | `$(document)` | `click<_toolbarClickNs>` (form: `.hiprintToolbar_<uid>`) | Close custom-paper popover on outside click | `toolbarCtrl.destroy()` → `$(document).off(_toolbarClickNs)` [V1 14852] | [V1 14303] |
| 10 | `$(document)` | `mousemove<_designerEventNs>` (form: `.hiprintDesigner_<uid>`) — left resize | Throttled column-resize update for left panel | Released on `mouseup` handler [V1 15033] | [V1 15039] |
| 11 | `$(document)` | `mouseup<_designerEventNs>` — left resize | End left drag; remove cursor styles | self-removing | [V1 15040] |
| 12 | `$(document)` | `mousemove<_designerEventNs>` — right resize | Throttled right panel column resize | Same as #10 | [V1 15060] |
| 13 | `$(document)` | `mouseup<_designerEventNs>` — right resize | End right drag | self-removing | [V1 15061] |
| 14 | `$(document).ready(...)` | DOMContentLoaded | If `hiwebSocket.hasIo() && window.autoConnect` → `hiwebSocket.start()` | n/a (one-time) | [V1 15341-15344] |

> Note on row 8: the global keydown at line 10949 is gated by `_shortcutKeyBound` once-flag per panel; it is **NOT** removed in `destroy()` (no `.off('keydown')` in `template.destroy()`), making this a known cross-instance keyboard handler that persists for the lifetime of the page. V3 must address this.

### 3.3 Synthetic Events / Trigger-Based

| Event Key (`hinnn.event` / `o.a.event`) | Trigger Site | Listener Site | Cleanup | V1 line |
|---|---|---|---|---|
| `hiprintTemplateDataShortcutKey_<id>` | `Ctrl+Z` / `Ctrl+Shift+Z` keydown | `initAutoSave` listener for "undo"/"redo" | `template.destroy()` → `event.off("hiprintTemplateDataShortcutKey_<id>")` [V1 12596] | [V1 10953, 10955, 13103] |
| `hiprintTemplateDataChanged_<id>` | element delete, keyboard move, z-index change, align, paste, multi-update | `initAutoSave` listener appends history snapshot | `template.destroy()` → `event.off("hiprintTemplateDataChanged_<id>")` [V1 12595] | [V1 10001, 11001, 11586, 11591, 11608, 11678, 12049, 12993, 13136] |
| `PrintElementSelectEventKey_<id>` | element click/select | `OptionSettingPanel` updates right panel | `destroy()` → `event.off("PrintElementSelectEventKey_<id>")` [V1 12597] | [V1 12562, 12070] |
| `BuildCustomOptionSettingEventKey_<id>` | custom option rebuild | `OptionSettingPanel` rebuilds custom UI | `destroy()` → `event.off("BuildCustomOptionSettingEventKey_<id>")` [V1 12598] | [V1 12565, 12073] |
| `clearSettingContainer` | delete element | OptionSettingPanel `.clearSettingContainer()` | not removed in destroy (global-scope event key) — leaks unless caller manually offs | [V1 1587, 1593, 12075] |
| `onSelectPanel` | pagination strip click | bottom-strip pagination select | n/a (creator-scoped) | [V1 12326] |

---

## Section 4: CSS Classes & ARIA

### 4.1 Structural Classes

| Class | Element | Purpose | V1 line |
|---|---|---|---|
| `hiprint-toolbar` | root `<div>` | Main toolbar wrapper | [V1 13394] |
| `hiprint-toolbar-group` | group `<div>` | Container for related buttons | [V1 14211, 14228, etc.] |
| `hiprint-toolbar-business-select` | suffix class on businessSelect group | Identifier for E2E selectors | [V1 14211] |
| `hiprint-toolbar-template-select` | suffix on templateSelect group | E2E | [V1 14228] |
| `hiprint-toolbar-paper` | suffix on paper group | E2E | [V1 14239] |
| `hiprint-toolbar-scale` | suffix on scale group | E2E | [V1 14317] |
| `hiprint-toolbar-align` | suffix on align group | E2E | [V1 14371] |
| `hiprint-toolbar-panels` | suffix on panels group | E2E | [V1 14452] |
| `hiprint-toolbar-extra` | suffix on extra group | E2E | [V1 14702] |
| `hiprint-toolbar-btn` | button base | Standard styling | [V1 14212, 14229, etc.] |
| `hiprint-toolbar-btn-primary` | button modifier | Affirmative (blue) — used by print + save-confirm + business-select-action + template-select-action | [V1 14433, 14113, 13642, 13823] |
| `hiprint-toolbar-btn-danger` | button modifier | Destructive (red) — used by clear + template-delete-action | [V1 14402, 13826] |
| `hiprint-toolbar-icon-btn` | button modifier | Icon-only (smaller padding) — used by scale/align buttons | [V1 14323, 14324, 14374] |
| `active` | button state | Selected paper/custom-paper button | [V1 14244, 14264, 14269-14270] |
| `hiprint-toolbar-popover` | popover root | Custom paper popover | [V1 14259] |
| `hiprint-toolbar-popover-content` | popover inner | Form layout | [V1 14260] |
| `hiprint-toolbar-input` | input control | Width/height numeric inputs | [V1 14261, 14263] |
| `hiprint-toolbar-custom-wrap` | wrapper | Holds custom button + popover with `position:relative` | [V1 14308] |
| `hiprint-toolbar-panel-manager` | composite | Page selector segmented control | [V1 14453] |
| `hiprint-toolbar-panel-manager-label` | label | Label inside panel manager | [V1 14454] |
| `hiprint-toolbar-panel-manager-select` | select | Dropdown for page list | [V1 14455] |
| `hiprint-toolbar-panel-manager-add` | button | `+` add page button | [V1 14458] |
| `hiprint-toolbar-scale-label` | span | Live "100%" display | [V1 14318] |
| `hiprint-toolbar-business-dialog-wrap` | dialog wrap | Business dialog root | [V1 13727] |
| `hiprint-toolbar-template-dialog-wrap` | dialog wrap | Template dialog root | [V1 13985] |
| `hiprint-toolbar-save-dialog-wrap` | dialog wrap | Save dialog root | [V1 14102] |
| `hiprint-toolbar-template-mask` | mask | Click-to-close backdrop (shared business+template dialog) | [V1 13728, 13986] |
| `hiprint-toolbar-save-mask` | mask | Save dialog backdrop | [V1 14103] |
| `hiprint-toolbar-template-dialog` | dialog panel | Inner panel (business+template) | [V1 13729, 13987] |
| `hiprint-toolbar-save-dialog` | dialog panel | Save dialog inner panel | [V1 14104] |
| `hiprint-toolbar-template-header` / `-body` / `-footer` / `-title` / `-state` | dialog parts | Header (h2), body, footer with buttons, state messages (loading/error/empty) | [V1 13730-13737, 13988-13995] |
| `hiprint-toolbar-template-grid` / `-card` / `-card-title` / `-card-desc` / `-card-meta` / `-card-actions` | dialog item grid | Cards layout (business+template share class names) | [V1 13629-13644, 13811-13830] |
| `hiprint-toolbar-template-state.loading/error/empty` | state divs | Status messages | [V1 13618, 13622, 13626, 13800, 13804, 13808] |
| `hiprint-toolbar-business-refresh` / `js-business-close` | dialog buttons | Refresh / Close (business) | [V1 13735, 13736] |
| `hiprint-toolbar-template-refresh` / `js-template-close` | dialog buttons | Refresh / Close (template) | [V1 13993, 13994] |
| `hiprint-toolbar-business-action` / `hiprint-toolbar-template-action` | per-card | Action buttons (`data-action`, `data-index`) | [V1 13642, 13823-13826] |
| `hiprint-toolbar-save-header` / `-body` / `-footer` / `-label` / `-input` / `-error` | save dialog parts | Title/body/footer | [V1 14105-14111] |
| `js-save-cancel` / `js-save-confirm` | save dialog buttons | Cancel / Confirm | [V1 14112, 14113] |
| `hiprint-printTemplate` | designer canvas | Template root | [V1 12528, 14919] |
| `hiprint-printPanel` | per-panel | Page container | [V1 11744 ref] |
| `hiprint-printPaper` / `-content` | paper element | Page surface | [V1 11744] |
| `hiprint-printPagination` | bottom pagination strip | Inside designer card; hidden if `showPagination:false` | [V1 14921, 14926] |
| `hiprint-printElement-panel` | (designer left panel composition) | Component types | (rendered via `hiprintEpContainer`) [V1 14901] |
| `hiprint-design` | (designer canvas area) | Workspace | (CSS only, see `hiprint.css`) |
| `hiprint-option-panel` / `hiprint-option-setting-container` | designer right panel | Element properties editor | [V1 14941, 14946] |
| `hiprint-designer` | designer root | buildDesigner wrapper | [V1 14895] |
| `hiprint-designer-toolbar` | inner toolbar host | Where buildToolbar mounts | [V1 14896] |
| `hiprint-designer-layout` | flex layout | Holds left / resize / center / resize / right | [V1 14897] |
| `hiprint-designer-panel-left` / `-panel-right` / `-panel-center` | layout panels | Three-column | [V1 14900, 14940, 14918] |
| `hiprint-designer-panel-body` | inner body | Used in left + right panels | [V1 14901, 14944] |
| `hiprint-designer-sidebar` | container | Holds header + body in side panels | [V1 14903, 14943] |
| `hiprint-designer-panel-header` | header `<div>` | Inner panel title bar | [V1 14905, 14949] |
| `hiprint-designer-resize-bar` | resize column | Holds handle + edge-toggle | [V1 14911, 14933] |
| `hiprint-designer-resize-handle` | drag handle | mousedown initiator | [V1 14912, 14934] |
| `hiprint-designer-edge-toggle` / `-edge-toggle-left` / `-edge-toggle-right` | toggle arrow | Collapse / expand panel | [V1 14913, 14935] |
| `hiprint-designer-card` | canvas card | Holds template + pagination; element-list popover anchors here | [V1 14928, 11698] |
| `hiprint-designer-pagination` | suffix on pagination | E2E | [V1 14921] |
| `rect-printElement-types hiprintEpContainer` | left panel content | Component-types host | [V1 14901] |
| `params_setting_container` | right panel | Properties container | [V1 14940] |
| `hinnn-layout-sider` | inner sider | Inside right panel body | [V1 14945] |
| `hiprint-el-list-toggle` | popup toggle button | Element-list show/hide button (`☰`) | [V1 11682] |
| `hiprint-el-list-panel` | popup panel | Movable element-list panel | [V1 11684] |
| `hiprint-el-list-panel-header` / `-panel-body` / `.el-count` | panel parts | Header / count / body | [V1 11685, 11686] |
| `hiprint-el-list-dragging` (on `body`) | drag state | CSS state during drag | [V1 11759, 11811] |
| `hiprint-guide-dragging` (on `body`) | drag state | Guide-line drag in flight | [V1 9610, 12587] |
| `hipanel-disable` | panel state | Disabled (non-editing) panel — hides element-list toggle | [V1 11752] |
| `mouseRect` | selection rect | Box-select visual | [V1 10976 ref] |
| `multipleSelect` | element state | Multi-selected element | [V1 1657] |
| `selected` | element state | Selected element child marker | [V1 10965 etc.] |
| `hiprint-printElement-tableTarget` | table wrap | TablePrintElement marker | [V1 6307] |
| `hiprint-ctx-menu` | context menu | Right-click menu | [V1 11615] |
| `hiprint_temp_Container` | temp host | toPdf temporary hidden DOM | [V1 12836] |

### 4.2 ARIA Attributes

| Element | Attribute | Value | Purpose | V1 line |
|---|---|---|---|---|
| Custom Paper Button | `aria-haspopup` | `"dialog"` | Popover existence | [V1 14258] |
| Custom Paper Button | `aria-expanded` | `"true" | "false"` | Popover state synced on toggle/ESC | [V1 14258, 14287, 14298] |
| Custom Paper Popover | `role` | `"dialog"` | Semantic role | [V1 14259] |
| Custom Paper Popover | `aria-label` | "自定义纸张大小" | Dialog label | [V1 14259] |
| Zoom Out Button | `aria-label` | "缩小" | Icon-only label | [V1 14323] |
| Zoom In Button | `aria-label` | "放大" | Icon-only label | [V1 14324] |
| Align Buttons | `aria-label` | each item's `label` | Icon-only labels | [V1 14374] |
| Paper Size Buttons | `aria-pressed` | `"true" | "false"` | Toggle state | [V1 14244, 14247-14248] |
| Add Panel Button | `aria-label` | "添加分页" | Icon-only label | [V1 14460] |
| Panel Manager Select | `aria-label` | "选择分页" | Form control label | [V1 14456] |
| Business Dialog Wrap | `role` | `"dialog"` | Modal dialog | [V1 13727] |
| Business Dialog Wrap | `aria-modal` | `"true"` | Modal state | [V1 13727] |
| Business Dialog Wrap | `aria-labelledby` | `"hp-business-title-<uid>"` | Associated H2 title | [V1 13727] |
| Business Dialog Wrap | `tabindex` | `"-1"` | Programmatically focusable | [V1 13727] |
| Business Dialog Body | `aria-live` | `"polite"` | SR announces loading/empty/error states | [V1 13733] |
| Business Dialog Body | `aria-busy` | `"false"` | (Static — not updated; should be true during loading) | [V1 13733] |
| Business Dialog Close Btn | `aria-label` | "关闭" | Close action label | [V1 13736] |
| Template Dialog Wrap | `role` / `aria-modal` / `aria-labelledby` / `tabindex` | Same as business — `hp-template-title-<uid>` | Modal dialog | [V1 13985] |
| Template Dialog Body | `aria-live="polite" aria-busy="false"` | Same pattern | (Static) | [V1 13991] |
| Template Dialog Close Btn | `aria-label` | "关闭" | Close action | [V1 13994] |
| Save Dialog Wrap | `role` / `aria-modal` / `aria-labelledby` / `tabindex` | Same — `hp-save-title-<uid>` | Modal | [V1 14102] |
| Save Dialog Input | `aria-describedby` | `"hp-save-err-<uid>"` | Associated error region | [V1 14108] |
| Save Dialog Error Div | `role` | `"alert"` | Live announcement on validation fail | [V1 14109] |
| Save Dialog Label | `for` | `"hp-save-name-<uid>"` | Form-input pairing | [V1 14107] |
| Element-list Panel Header | `tabindex` | `"0"` | Keyboard-focusable drag handle | [V1 11772] |
| Element-list Panel Header | `role` | `"button"` | Treat as action | [V1 11772] |
| Element-list Panel Header | `aria-label` | "元素列表标题，可拖动；按方向键移动，按 Enter 重置位置" | Action description with keyboard hint | [V1 11773] |

---

## Section 5: buildDesigner Shell Structure [V1 lines 14859-15160]

`buildDesigner(container, options)` constructs the full design surface: toolbar + 3-column layout (left | center | right) with draggable resize handles and collapse arrows.

### 5.1 Main DOM Tree

```
$container (cleared via .empty())
└── .hiprint-designer  ($root)
    ├── .hiprint-designer-toolbar  ($toolbarContainer)   ← buildToolbar mounts here
    └── .hiprint-designer-layout  ($layout)
        ├── .hiprint-designer-panel-left  ($panelLeft)
        │   └── .hiprint-designer-sidebar  ($leftSidebar)
        │       ├── .hiprint-designer-panel-header → "组件"
        │       └── .hiprint-designer-panel-body.rect-printElement-types.hiprintEpContainer
        │             (id="<designerId>-ep-container")  ← element types panel mounts here
        ├── .hiprint-designer-resize-bar  ($leftResizeBar)
        │   ├── .hiprint-designer-resize-handle  ($leftResizeHandle)
        │   └── .hiprint-designer-edge-toggle.hiprint-designer-edge-toggle-left  ($leftToggle)
        │         title="折叠组件栏" → renderIconHtml('ep:arrow-left','<')
        ├── .hiprint-designer-panel-center  ($panelCenter)
        │   └── .hiprint-designer-card  ($cardDesign)
        │       ├── .hiprint-printTemplate  ($printTemplateContainer)
        │       │     (id="<designerId>-print-template")  ← template.design() target
        │       └── .hiprint-printPagination.hiprint-designer-pagination  ($paginationContainer)
        │             (hidden if !opts.showPagination)
        ├── .hiprint-designer-resize-bar  ($rightResizeBar)
        │   ├── .hiprint-designer-resize-handle  ($rightResizeHandle)
        │   └── .hiprint-designer-edge-toggle.hiprint-designer-edge-toggle-right  ($rightToggle)
        │         title="折叠属性栏" → renderIconHtml('ep:arrow-right','>')
        └── .hiprint-designer-panel-right.params_setting_container  ($panelRight)
            └── .hiprint-designer-sidebar  ($rightSidebar)
                ├── .hiprint-designer-panel-header → "属性"
                └── .hiprint-designer-panel-body  ($rightBody)
                    └── .hinnn-layout-sider  ($rightSider)
                        └── .hiprint-option-setting-container  ($optionSettingContainer)
                              (id="<designerId>-option-setting")
```

### 5.2 buildDesigner opts (Complete) [V1 lines 14859-14877]

| `opts.*` | Default | Type | Effect | V1 line |
|---|---|---|---|---|
| `leftWidth` | `200` | `number` (px) | Initial width of left component panel | [V1 14861] |
| `rightWidth` | `280` | `number` (px) | Initial width of right properties panel | [V1 14862] |
| `leftMinWidth` | `140` | `number` (px) | Lower bound for left drag-resize | [V1 14863] |
| `leftMaxWidth` | `400` | `number` (px) | Upper bound for left drag-resize | [V1 14864] |
| `rightMinWidth` | `200` | `number` (px) | Lower bound for right drag-resize | [V1 14865] |
| `rightMaxWidth` | `500` | `number` (px) | Upper bound for right drag-resize | [V1 14866] |
| `leftCollapsed` | `false` | `bool` | Initial collapse state of left panel | [V1 14867] |
| `rightCollapsed` | `false` | `bool` | Initial collapse state of right panel | [V1 14868] |
| `componentModule` | `'defaultModule'` | `string` | Element-type registry module to render in left panel | [V1 14869, 15071] |
| `componentPanelSlot` | `null` | `{enabled, ...}` or `null` | Override component panel slot configuration; calls `it.setPanelSlot(opts)` if `enabled` else `it.clearPanelSlot()` | [V1 14870, 15065-15069] |
| `templateOptions` | `{}` | `object` | Passed to `new ct(templateOpts)` — extended with `settingContainer` and `paginationContainer` then forwarded to `PrintTemplate` constructor (supports `template`, `dataMode`, `history`, `willOutOfBounds`, `onDataChanged`, `onUpdateError`, `defaultPanelName`, `qtDesigner`, `fontList`, `fields`, `onImageChooseClick`, `onPanelAddClick`) | [V1 14871, 15074-15080], [V1 12331-12372] |
| `toolbarOptions` | `{}` | `object` | Forwarded to `buildToolbar(host, hiprintTemplate, opts.toolbarOptions)` | [V1 14872, 15099] |
| `onReady` | `null` | `function(template, toolbarCtrl) → void` | Called after toolbar built; `_safeCall` wrapped | [V1 14873, 15102-15104] |
| `showPagination` | **`false`** (V1 default off) | `bool` | When `false`, bottom `.hiprint-printPagination` is `display:none` | [V1 14876, 14925-14927] |
| `designerId` | auto-generated `'hiprint-designer-' + Date.now().toString(36) + '_' + Math.random()` | `string` | Sanitized via `.replace(/[^\w-]/g, '-')`; used as DOM id prefix | [V1 14890, 14892] |

### 5.3 Internal Generated Identifiers [V1 lines 14887-14892]

| Identifier | Format | Lifetime | Purpose |
|---|---|---|---|
| `_designerUid` | `Date.now().toString(36) + '_' + Math.floor(random*1679616).toString(36)` | Per `buildDesigner` call | Cross-iframe unique base for namespaces/IDs |
| `_designerEventNs` | `'.hiprintDesigner_' + _designerUid` | Per call | Used for resize `mousemove`/`mouseup` namespaced binding [V1 15039-15040, 15060-15061] |
| `designerId` (from `_designerUid`) | `'hiprint-designer-<uid>'` (sanitized) | Per call | DOM element id prefix |

### 5.4 Designer Internal Behaviors

- **rAF throttling**: `_rafThrottle(fn)` aligns mousemove handlers to `requestAnimationFrame` (or 16ms setTimeout fallback) to avoid layout thrashing at 60fps [V1 15002-15019].
- **Drag cursor lock**: during resize, `document.body.style.cursor = 'col-resize'` and `userSelect = 'none'` are set; cleared on mouseup [V1 15037-15038, 15054-15055].
- **Collapse toggle**: `$leftToggle` / `$rightToggle` click flips `leftCollapsed` / `rightCollapsed` and `applyLeftState()`/`applyRightState()` resets width to `0px` (hidden) or stored width [V1 14960-14998]. Icons swap via `setToggleIcon($toggle, 'ep:arrow-left|right', '<|>')`.
- **Component panel click → element select**: clicking `.ep-draggable-item` in left panel finds matching element on editing panel and calls `el.selectFromList(false)` to highlight in canvas [V1 15084-15096].
- **Template lifecycle**: `var hiprintTemplate = new ct(templateOpts); hiprintTemplate.design($printTemplateContainer[0], {});` [V1 15080-15081].

### 5.5 Designer Control Object Returned [V1 lines 15107-15159]

| Method | Signature | Purpose | V1 line |
|---|---|---|---|
| `getTemplate()` | `() → PrintTemplate` | Returns underlying template instance | [V1 15108] |
| `getToolbarCtrl()` | `() → toolbarCtrl` | Returns inner toolbar control object | [V1 15109] |
| `getLeftWidth()` | `() → number` | Current left panel width in px | [V1 15110] |
| `getRightWidth()` | `() → number` | Current right panel width in px | [V1 15111] |
| `getComponentContainer()` | `() → DOMElement` | The `.hiprintEpContainer` element | [V1 15112] |
| `getTemplateContainer()` | `() → DOMElement` | The `.hiprint-printTemplate` element | [V1 15113] |
| `getSettingContainer()` | `() → DOMElement` | The `.hiprint-option-setting-container` element | [V1 15114] |
| `setLeftCollapsed(bool)` | `(v: bool) → void` | Programmatic collapse left | [V1 15115] |
| `setRightCollapsed(bool)` | `(v: bool) → void` | Programmatic collapse right | [V1 15116] |
| `isLeftCollapsed()` | `() → bool` | State accessor | [V1 15117] |
| `isRightCollapsed()` | `() → bool` | State accessor | [V1 15118] |
| `setComponentPanelSlot(slotOptions)` | `(slotOptions: object) → void` | Update slot config + reapply | [V1 15119-15123] |
| `clearComponentPanelSlot()` | `() → void` | Clear slot config | [V1 15124-15127] |
| `rebuildComponentPanel(moduleName?, slotOptions?)` | `(name?: string, slot?: object) → void` | Empty `$componentContainer`, reconfigure slot, call `it.build(...)`; `console.warn` if module is missing/empty | [V1 15128-15142] |
| `destroy()` | `() → void` | Cleanup: `toolbarCtrl.destroy()` + `hiprintTemplate.destroy()` (try/catch with `console.warn`) + `$container.empty()` | [V1 15143-15152] |
| `setPaginationVisible(bool)` | `(visible: bool) → void` | Runtime show/hide pagination strip | [V1 15156-15158] |

---

## Section 6: Public API Exports (23 Total)

All exports are routed through `src/index.js` (re-exports from `src/hiprint/hiprint.bundle.js`). The bundle's webpack `n.d(e, "...", fn)` registrations are at [V1 lines 15291-15340]. Below is each export with full signature, types, defaults, side effects, and citations.

### 6.1 `hiprint` (default namespace)

| Field | Value |
|---|---|
| **Type** | `object` (global) — also assigned to `window.hiprint` |
| **Signature** | `hiprint.PrintTemplate`, `hiprint.buildDesigner`, `hiprint.buildToolbar`, `hiprint.print`, `hiprint.print2`, `hiprint.getHtml`, `hiprint.init`, `hiprint.setConfig`, `hiprint.updateElementType`, `hiprint.setDynamicFields`, `hiprint.removeDynamicFields`, `hiprint.setElementTypeGroups`, `hiprint.appendElementTypeGroups`, `hiprint.renameElementType`, `hiprint.getClients`, `hiprint.getClientInfo`, `hiprint.getAddress`, `hiprint.ippPrint`, `hiprint.ippRequest`, `hiprint.refreshPrinterList`, `hiprint.hiwebSocket`, `hiprint.PrintElementTypeManager`, `hiprint.PrintElementTypeRegistry`, `hiprint.PrintElementTypeGroup`, `hiprint.version` |
| **Side Effects** | `window.hiprint = hiprint` at index.js line 78; `hiprint.version` set from `package.json` |
| **Source** | `src/index.js:2, 76, 78`; bundle exports [V1 15291-15340] |

### 6.2 `PrintTemplate` (class)

| Field | Value |
|---|---|
| **Type** | `class` (function constructor) — `hiprint.PrintTemplate` |
| **Constructor Signature** | `new PrintTemplate(opts: { template?: object | string, dataMode?: 1|2, history?: bool, willOutOfBounds?: bool, onDataChanged?: function(type, json), onUpdateError?: function(err), defaultPanelName?: string, qtDesigner?: bool, fontList?: string[], fields?: object, onImageChooseClick?: function, onPanelAddClick?: function(panel, createPanel), settingContainer?: HTMLElement, paginationContainer?: HTMLElement })` |
| **Defaults** | `dataMode = 1`, `history = true`, `willOutOfBounds = true`, `qtDesigner = true`, `template = []`, `printPanels = []`, `tempimageBase64 = {}`, `historyList = [{id, type:'初始', json: lastJson}]`, `historyPos = 0` |
| **Side Effects** | `s.a.instance.setPrintTemplateById(this.id, this)` — registers in singleton map; `this.id = guid()` |
| **Return** | instance |
| **Source** | [V1 lines 12329-12373]; exported as `PrintTemplate` [V1 15333] |

### 6.3 `PrintElementTypeManager`

| Field | Value |
|---|---|
| **Type** | `static utility class` — exposes `build(container, moduleName)`, `buildByHtml`, `setPanelSlot(slotOptions)`, `clearPanelSlot()` |
| **Signature** | `PrintElementTypeManager.build(container: HTMLElement, moduleName: string): void` — populates left-panel UI with element types from `PrintElementTypeRegistry.instance[moduleName]` |
| **Side Effects** | DOM manipulation only — appends draggable `.ep-draggable-item` entries to container |
| **Source** | exported as `PrintElementTypeManager` [V1 15325-15326] (bundle ref `it`) |

### 6.4 `PrintElementTypeRegistry`

| Field | Value |
|---|---|
| **Type** | `class` with singleton `.instance` |
| **Key Methods (on `.instance`)** | `addPrintElementTypes(moduleName, groups[])`, `removePrintElementTypes(moduleName | tid_prefix)`, `setPrintTemplateById(id, template)`, `getPrintTemplateById(id)`, `removePrintTemplateById(id)`, `updateElementType(tid, callback)`, `guid()`, `init({providers})`, `allElementTypes` (object map), `<moduleName>` array buckets |
| **Side Effects** | All state in-memory in the singleton |
| **Source** | exported as `PrintElementTypeRegistry` (bundle ref `a`) [V1 15327-15330] |

### 6.5 `PrintElementTypeGroup`

| Field | Value |
|---|---|
| **Type** | `class` |
| **Signature** | `new PrintElementTypeGroup(groupName: string, configs: object[])` — `configs` items have `{tid, title, type, field, data, icon, options}` |
| **Source** | exported as `PrintElementTypeGroup` (bundle ref `ot`) [V1 15331-15332] |

### 6.6 `hiPrintPlugin` (Vue 3 plugin)

| Field | Value |
|---|---|
| **Type** | `{ disAutoConnect, install(app, name?='$hiPrint', autoConnect?=false) }` |
| **Effect** | Sets `app.config.globalProperties[name] = hiprint`, adds `$print(provider, template, ...args)` and `$print2(...)`. If `!autoConnect`, calls `disAutoConnect()`. |
| **Source** | `src/index.js:33-74` |

### 6.7 `defaultElementTypeProvider`

| Field | Value |
|---|---|
| **Type** | `class` (factory bound to `hiprint`) — `new defaultElementTypeProvider()` produces a provider object with `.addElementTypes(registryInstance)` |
| **Source** | exported from `hiprint.bundle.js` last line: `var defaultElementTypeProvider = defaultTypeProvider(hiprint)` [V1 15348-15351] |

### 6.8 `buildDesigner`

| Field | Value |
|---|---|
| **Signature** | `buildDesigner(container: HTMLElement | string, options?: buildDesignerOpts): designerCtrl` |
| **Return** | designerCtrl (see Section 5.5) |
| **Side Effects** | Empties container, builds DOM tree, creates `new PrintTemplate(...)` internally, calls `buildToolbar` internally |
| **Source** | [V1 14859-15160]; exported [V1 15323] |

### 6.9 `buildToolbar`

| Field | Value |
|---|---|
| **Signature** | `buildToolbar(container: HTMLElement | string, template: PrintTemplate, options?: buildToolbarOpts): toolbarCtrl` |
| **Return** | toolbarCtrl (Section 8A) |
| **Side Effects** | Empties container, builds button DOM, registers `$(document).on('click' + _toolbarClickNs, ...)` [V1 14303] |
| **Source** | [V1 13305-14857]; exported [V1 15321] |

### 6.10 `setDynamicFields`

| Field | Value |
|---|---|
| **Signature** | `setDynamicFields(moduleName: string, fieldGroups: Array<{groupName, fields: Array<{field, title?, type?, data?, icon?, options?}>}>): void` |
| **Validation** | Throws `Error("setDynamicFields: moduleName is required")` if `!moduleName`; calls `validateFieldGroups` which throws if any `field` is empty or `type` not in `SUPPORTED_ELEMENT_TYPES` |
| **Side Effects** | `registry.removePrintElementTypes(moduleName)` then `registry.addPrintElementTypes(moduleName, groups)` with normalized configs (`tid: moduleName + '.' + field`) |
| **Source** | [V1 13261-13269]; exported [V1 15311] |

### 6.11 `removeDynamicFields`

| Field | Value |
|---|---|
| **Signature** | `removeDynamicFields(moduleName: string): void` |
| **Side Effects** | `registry.removePrintElementTypes(moduleName)` |
| **Source** | [V1 13271-13273]; exported [V1 15313] |

### 6.12 `setElementTypeGroups`

| Field | Value |
|---|---|
| **Signature** | `setElementTypeGroups(moduleName: string, groups: Array<{groupName?: string, name?: string, printElementTypes?: object[], items?: object[], fields?: object[]}>): void` |
| **Validation** | Throws `Error("setElementTypeGroups: moduleName is required")` if `!moduleName` |
| **Side Effects** | `removePrintElementTypes(moduleName)` + `addPrintElementTypes(moduleName, normalized)`; normalization adds default `tid`, `title`, `type='text'` if missing |
| **Source** | [V1 13275-13280]; exported [V1 15315] |

### 6.13 `appendElementTypeGroups`

| Field | Value |
|---|---|
| **Signature** | `appendElementTypeGroups(moduleName: string, groups: object[]): void` |
| **Validation** | Throws if `!moduleName` |
| **Side Effects** | `addPrintElementTypes(moduleName, normalized)` (no remove — appends to existing bucket; same-tid is de-duplicated via `incomingTids` per-element filter in registry) |
| **Source** | [V1 13282-13286]; exported [V1 15317] |

### 6.14 `renameElementType`

| Field | Value |
|---|---|
| **Signature** | `renameElementType(tid: string, title: string): void` |
| **Side Effects** | Delegates to `uep(tid, fn)` which calls `registry.updateElementType(tid, callback)`; callback sets `type.title = title` |
| **Source** | [V1 13288-13294]; exported [V1 15319] |

### 6.15 `print` (direct print)

| Field | Value |
|---|---|
| **Signature** | `print(data: object): void` — `bind(hiprint)` is mandatory at export, otherwise `this.getHtml` lookup fails in strict mode |
| **Side Effects** | Calls `this.getHtml(data).hiwprint()` (browser-print path via jQuery hiwprint plugin) |
| **Source** | [V1 13156-13158] `function ht`; exported [V1 15335]; rebound in `src/index.js:100` |

### 6.16 `print2` (silent print via socket)

| Field | Value |
|---|---|
| **Signature** | `print2(opts: { imgToBase64?: bool, options?: object, ... }, onSuccess?: function, onError?: function): void` |
| **Side Effects** | Creates internal `new ct({})`, registers `on('printSuccess', e)` + `on('printError', n)`, calls `printByHtml2(this.getHtml(t), t.options)`. Requires `hiwebSocket` connection (`clientIsOpened()`); otherwise alerts "连接客户端失败" |
| **Source** | [V1 13160-13165]; exported [V1 15337]; rebound `src/index.js:101` |

### 6.17 `getHtml`

| Field | Value |
|---|---|
| **Signature** | `getHtml(opts: { templates: [{template, data, options}], imgToBase64?: bool }): jQuery` |
| **Return** | jQuery wrapped `<div class="hiprint-printTemplate">...</div>` |
| **Side Effects** | None (read-only) |
| **Source** | [V1 13167-13173] `function gt`; exported [V1 15339]; rebound `src/index.js:102` |

### 6.18 `autoConnect`

| Field | Value |
|---|---|
| **Signature** | `autoConnect(cb?: function(status: bool, msg) → void): void` |
| **Side Effects** | `window.autoConnect = true`; if `hiwebSocket.hasIo()` → `hiwebSocket.start(cb)` |
| **Source** | `src/index.js:20-23` |

### 6.19 `disAutoConnect`

| Field | Value |
|---|---|
| **Signature** | `disAutoConnect(): void` |
| **Side Effects** | `window.autoConnect = false`; if `hiwebSocket.hasIo()` → `hiwebSocket.stop()` |
| **Source** | `src/index.js:28-31` |

### 6.20 `getClients`

| Field | Value |
|---|---|
| **Signature** | `getClients(cb: function(clients[]) → void): void` |
| **Side Effects** | `registry.clear("clients") + on("clients", cb)`; `hiwebSocket.getClients()` |
| **Source** | [V1 15259-15263]; exported [V1 15301]; rebound `src/index.js:107` (required to preserve `this`) |

### 6.21 `getClientInfo`

| Field | Value |
|---|---|
| **Signature** | `getClientInfo(cb: function(info) → void): void` |
| **Side Effects** | `clear("clientInfo") + on("clientInfo", cb)`; `hiwebSocket.getClientInfo()` |
| **Source** | [V1 15265-15269]; exported [V1 15303]; rebound `src/index.js:108` |

### 6.22 `getAddress`

| Field | Value |
|---|---|
| **Signature** | `getAddress(type: string, cb: function(addr) → void, ...args): void` |
| **Side Effects** | `clear("address_" + type) + on("address_" + type, cb)`; `hiwebSocket.getAddress(type, ...args)` |
| **Source** | [V1 15271-15275]; exported [V1 15305] (as `getAddr`); rebound `src/index.js:109` |

### 6.23 `ippPrint` / `ippRequest`

| Field | Value |
|---|---|
| **`ippPrint` Signature** | `ippPrint(options: object, callback: function(result), connected: function() → void): void` |
| **`ippRequest` Signature** | `ippRequest(options: object, callback: function(result) → void): void` |
| **Side Effects** | Register IPP callback handlers in registry, dispatch to `hiwebSocket.ippPrint/ippRequest(options)` |
| **Source** | [V1 15277-15289]; exported [V1 15307, 15309]; rebound `src/index.js:110-111` |

---

## Section 7: PrintTemplate Public Methods (Complete)

All methods on `ct.prototype` (a.k.a. `PrintTemplate.prototype`) [V1 lines 12329-13154]. Every method except `clientIsOpened()`, `getPrintStyle()`, `parentWidthHeight()`, `transformImg`, `xhrLoadImage`, `_assertNotDestroyed`, `initAutoSave`, `getSelectEls` is guarded by `_assertNotDestroyed(name)` which logs `'[hiprint] <method> called on destroyed template'` and returns a typed fallback when `_destroyed=true`.

| # | Method | Signature | Returns | Destroy-Guarded | Side Effects | V1 line |
|---|---|---|---|---|---|---|
| 1 | `design` | `(t: HTMLElement, e?: object) → void` | void | no (but checks `_designed` for re-entry) | Re-binds jQuery namespace `.hiprint` and empties prior container if `_designed`; creates default panel if `printPanels` empty; calls `this.createContainer(t)`, appends each panel's target, disables non-zero panels, then `this.selectPanel(0)` | [V1 12375-12400] |
| 2 | `getSimpleHtml` | `(t: object|object[], e?: object) → jQuery` | `<div class="hiprint-printTemplate">` jQuery | yes (returns empty `<div>`) | If `t` is an array → iterate data items; each panel `printPanel.getHtml(data, e)` appended; deletes `hinnn._paperList` after last; optional `imgToBase64` transforms `<img>` srcs | [V1 12401-12421] |
| 3 | `getSimpleHtmlAsync` | `(dataItemOrList: object|object[], e?: object) → Promise<jQuery>` | Promise resolved with built `<div>` | yes (resolves `<div></div>`) | Builds via `setTimeout(0)` between panel appends (`generateHTMLInterval` default 10ms); rejects if destroyed mid-async with `Error('aborted: template destroyed mid-async')` | [V1 12422-12459] |
| 4 | `getHtml` | `(t: object, e?: object) → jQuery` | jQuery `<div>` | yes (returns `<div></div>`) | Wrapper around `getSimpleHtml(t || {}, e)` | [V1 12460-12462] |
| 5 | `getHtmlAsync` | `(t: object, e?: object) → Promise<jQuery>` | Promise<jQuery> | yes (via `getSimpleHtmlAsync`) | Wrapper around `getSimpleHtmlAsync` | [V1 12463-12465] |
| 6 | `getJointHtml` | `(t: object, e: object, n: ?) → jQuery` | jQuery `<div>` | yes (returns empty) | Concatenates each panel's HTML using a shared `o = []` array | [V1 12466-12472] |
| 7 | `setPaper` | `(t: string \| number, e?: number) → void` | void | yes | If `t` matches numeric regex → `editingPanel.resize(undefined, t, e, false)`; else look up `s.a.instance[t]` (paper-type config) and `editingPanel.resize(t, w, h, false)`; throws `Error("not found pagetype:" + t)` if unknown name | [V1 12473-12479] |
| 8 | `rotatePaper` | `() → void` | void | yes | `editingPanel && editingPanel.rotatePaper()` — swaps width and height [V1 11176] | [V1 12480-12482] |
| 9 | `alignElements` | `(type: string) → void` | void | yes | `editingPanel && editingPanel.alignElements(type)` — applies multi-select alignment (left/right/top/bottom/horizontalCenter/verticalCenter/distributeHorizontal/distributeVertical) [V1 11626-11678] | [V1 12483-12485] |
| 10 | `zoom` | `(s: number, p?: any) → void` | void | yes | `editingPanel && editingPanel.zoom(s, p)` — CSS transform on panel | [V1 12486-12488] |
| 11 | `addPrintPanel` | `(t?: object, e?: bool) → Panel | undefined` | new `pt` instance or undefined | yes (returns `undefined`) | Creates `pt(new rt(t), this.id)` (or `createDefaultPanel()`); if `t`, sets `t.index = printPanels.length`; if `e` (select), `container.append(getTarget())` + `design()` + `selectPanel(index)` | [V1 12489-12492] |
| 12 | `selectPanel` | `(t: number) → void` | void | yes | Clamps `t` to `printPanels.length - 1`; iterates: matching index → `panel.enable()` + sets `editingPanel = panel` + `printPaginationCreator.selectPanel(t)`; others → `panel.disable()` | [V1 12493-12499] |
| 13 | `deletePanel` | `(t: number) → void` | void | yes | **Invariant: must keep ≥1 panel** — `console.warn` and return if `printPanels.length ≤ 1` [V1 12504-12507]; `printPanels[t].clear() + .getTarget().remove() + splice(t, 1)`; if deleted was editing → `selectPanel(Math.min(t, printPanels.length - 1))` | [V1 12500-12515] |
| 14 | `getPaneltotal` | `() → number` | `printPanels.length` (0 if destroyed) | yes (returns 0) | Pure | [V1 12516-12518] |
| 15 | `createDefaultPanel` | `() → Panel | undefined` | new `pt` panel | yes (returns undefined) | Creates `new pt(new rt({index: printPanels.length, name: defaultPanelName, paperType: 'A4'}), this.id)` | [V1 12519-12525] |
| 16 | `createContainer` | `(t: HTMLElement) → void` | void | yes | If `t`: `this.container = $(t).addClass('hiprint-printTemplate')`; else `this.container = $('<div class="hiprint-printTemplate"></div>')` | [V1 12526-12528] |
| 17 | `getJsonTid` | `() → st` | `new st({panels})` (empty `panels:[]` if destroyed) | yes (returns `new st({panels:[]})`) | Only includes panels with non-empty `printElements`; uses `getPanelEntity()` (tid mode) | [V1 12529-12536] |
| 18 | `getJson` | `() → st` | `new st({panels})` | yes (returns `new st({panels:[]})`) | All panels via `getPanelEntity(true)` (full options) | [V1 12537-12544] |
| 19 | `undo` | `(t?: any) → void` | void | yes | Triggers `hiprintTemplateDataShortcutKey_<id>` with `"undo"` → restores prior `historyList` snapshot | [V1 12545-12547] |
| 20 | `redo` | `(t?: any) → void` | void | yes | Triggers same event with `"redo"` → restores next snapshot | [V1 12548-12550] |
| 21 | `isDestroyed` | `() → bool` | `!!this._destroyed` | no (it's the destroy probe) | Pure | [V1 12551-12553] |
| 22 | `_assertNotDestroyed` | `(name: string) → bool` (true if destroyed) | bool | no (internal) | Logs `'[hiprint] <name> called on destroyed template'` if destroyed | [V1 12554-12561] |
| 23 | `getPrintElementSelectEventKey` | `() → string` | `"PrintElementSelectEventKey_" + this.id` (or "" if destroyed) | yes (returns "") | Pure (key generator) | [V1 12562-12564] |
| 24 | `getBuildCustomOptionSettingEventKey` | `() → string` | `"BuildCustomOptionSettingEventKey_" + this.id` (or "") | yes (returns "") | Pure | [V1 12565-12567] |
| 25 | `clear` | `() → void` | void | yes | Iterates `printPanels`, `panel.clear()`, removes index > 0 panel targets; `this.printPanels = [printPanels[0]]`; `printPaginationCreator && .buildPagination()` | [V1 12568-12575] |
| 26 | `destroy` | `() → void` | void | **destroy itself; idempotent** (early return if `_destroyed`) | (1) `_destroyed=true`; (2) reset `s.a.instance.draging=false` + remove body classes [V1 12585-12587]; (3) `event.off` for 4 event-bus keys [V1 12595-12598]; (4) iterate panels: `panel.clear()`, `target.off('.hiprint')`, remove `_elListPanel`/`_elListToggle` [V1 12605-12614]; (5) identity-check remove from singleton map [V1 12621-12626]; (6) `target.empty()` and `container.empty()` [V1 12630-12635]; (7) nullify `printPanels=[], template=null, lastJson=null, historyList=[]` [V1 12638-12641] | [V1 12576-12641] |
| 27 | `getPaperType` | `(t?: number) → string | undefined` | first panel's `paperType` | yes (returns undefined) | Pure (defaults `t=0`) | [V1 12642-12644] |
| 28 | `getOrient` | `(t?: number) → 1 | 2 | undefined` | 1 (portrait, h > w) or 2 (landscape) | yes (returns undefined) | Pure | [V1 12645-12647] |
| 29 | `getPrintStyle` | `(t?: number) → string \| undefined` | per-panel CSS | yes (returns undefined) | Calls `printPanels[t].getPrintStyle()` | [V1 12648-12650] |
| 30 | `print` | `(t: object, e?: object, o?: object) → void` | void | yes | `t || (t = {})`; `this.getHtml(t, e).hiwprint(o)` — invokes browser print via jQuery `.hiwprint` plugin | [V1 12651-12653] |
| 31 | `print2` | `(t: object, e?: object) → void` | void | yes | Loads `link[media=print][href*="print-lock"]` via XHR (with `onerror` + `ontimeout` diagnostics — non-200 logged); on all-loaded → calls `n.sentToClient(p, t, e)`; throws `Error("请在 入口文件(index.html) 中引入 print-lock.css")` if no print-lock link found; alerts "连接客户端失败" if `clientIsOpened() === false` | [V1 12654-12690] |
| 32 | `imageToBase64` | `(t: jQuery) → void` | void | yes | If `src` doesn't contain "base64": creates `<canvas>` + new Image, draws, stores `t.attr('src') → dataURL` in `tempimageBase64`; on exception → fallback `xhrLoadImage(t)` | [V1 12691-12708] |
| 33 | `xhrLoadImage` | `(t: jQuery) → void` | void | yes | Currently empty body (no-op fallback) | [V1 12709-12711] |
| 34 | `sentToClient` | `(t: string, e: object, n?: object) → void` | void | yes | `imgToBase64 ?? false`; if `printByFragments`: `getHtmlAsync(...).then(...)` builds outerHTML, assigns `id/html/templateId`, `hiwebSocket.sendByFragments(i, n)` (with `.catch(console.error)`); else sync: `getHtml(e, i)` + `hiwebSocket.send(i)` | [V1 12711-12732] |
| 35 | `printByHtml` | `(t: HTMLElement) → void` | void | yes | `$(t).hiwprint()` — browser print of arbitrary HTML | [V1 12733-12735] |
| 36 | `printByHtml2` | `(t: HTMLElement, e?: object) → void` | void | yes | Similar to `print2` but accepts custom HTML; loads print-lock CSS, builds payload, `hiwebSocket.send(c)`; alerts if `clientIsOpened() === false` | [V1 12736-12764] |
| 37 | `deletePrintElement` | `(t: BasePrintElement) → void` | void | yes | Iterates all panels: `panel.deletePrintElement(t)` | [V1 12765-12769] |
| 38 | `transformImg` | `(t: jQuery imgs) → void` | void | yes | Iterates `t.map(...)` and calls `imageToBase64($(n))` per image | [V1 12770-12775] |
| 39 | `toPdf` | `(t: object, e: string, options?: object) → jQuery.Promise` | `$.Deferred().promise()` — resolves with `pdfFile` (Blob by default) or undefined (if downloaded), rejects on destroy/domtoimage failure | yes (rejects with `Error('template destroyed')`) | Creates `new jsPDF({orientation, unit:'pt', format})`, builds HTML via `getHtml`, `svg2canvas` + `domtoimage.toCanvas` → JPEG; if `options.isDownload !== false` → `s.save(e + '.pdf')` + `dtd.resolve()`; else `s.output(options.type || 'blob')` + `dtd.resolve(pdfFile)`; on `domtoimage.catch` → `console.error('[hiprint] toPdf: domtoimage failed:', err)` + cleanup + `dtd.reject(err)`; mid-Promise destroy check → reject `Error('template destroyed mid-toPdf')` | [V1 12776-12834] |
| 40 | `createTempContainer` | `() → void` | void | no | Removes existing `.hiprint_temp_Container` then prepends new hidden `<div>` to `body` | [V1 12835-12836] |
| 41 | `removeTempContainer` | `() → void` | void | no | `$('.hiprint_temp_Container').remove()` | [V1 12837-12838] |
| 42 | `getTempContainer` | `() → jQuery` | `$('.hiprint_temp_Container')` | no | Pure | [V1 12839-12840] |
| 43 | `svg2canvas` | `(t: jQuery) → void` | void | no | For each SVG inside `t`: serialize via `XMLSerializer`, render via `Canvg.fromString(ctx, str).render()`, insert canvas before SVG, remove SVG node | [V1 12841-12850] |
| 44 | `parentWidthHeight` | `(t: HTMLElement) → {width, height}` | `{width, height}` in px | no | Recursive lookup until non-`%` width or `hiprint-printPaper-content` ancestor; returns `{10, 10}` fallback | [V1 12851-12859] |
| 45 | `on` | `(t: string, e: function) → void` | void | yes | `event.clear(t + "_" + this.id)` then `event.on(t + "_" + this.id, e)` (single-listener semantics — replaces prior) | [V1 12860-12863] |
| 46 | `clientIsOpened` | `() → bool` | `hiwebSocket.opened` | no | Pure | [V1 12864-12865] |
| 47 | `getPrinterList` | `() → string[]` | array of printer names (empty if destroyed) | yes (returns []) | `hiwebSocket.getPrinterList()` | [V1 12866-12869] |
| 48 | `getElementByTid` | `(t: string, e?: number) → element | undefined` | matched element | yes (returns undefined) | `printPanels[e || 0].getElementByTid(t)` | [V1 12870-12872] |
| 49 | `getElementByName` | `(t: string, e?: number) → element | undefined` | matched element | yes (returns undefined) | `printPanels[e || 0].getElementByName(t)` | [V1 12873-12875] |
| 50 | `getPanel` | `(t?: number) → Panel | undefined` | the panel | yes (returns undefined) | `printPanels[t || 0]` | [V1 12876-12878] |
| 51 | `loadAllImages` | `(t: jQuery, e: function, n?: number) → void` | void (calls `e()` callback) | destroy-aware (invokes `e()` even if destroyed with warning) | Polls every 500ms up to 10 retries (~5s) for all `<img>` to load (`naturalWidth > 0` or `complete`); if exhausted, warns "[hiprint] loadAllImages: gave up after 10 retries" and still calls `e()` | [V1 12879-12897] |
| 52 | `setFontList` | `(t: string[]) → void` | void | yes | Sets `this.fontList` | [V1 12898-12900] |
| 53 | `getFontList` | `() → string[]` | `this.fontList` (`[]` if destroyed) | yes (returns []) | Pure | [V1 12901-12903] |
| 54 | `setFields` | `(t: object) → void` | void | yes | Sets `this.fields` | [V1 12904-12906] |
| 55 | `getFields` | `() → object` | `this.fields` (`[]` if destroyed) | yes (returns []) | Pure | [V1 12907-12909] |
| 56 | `setOnImageChooseClick` | `(t: function) → void` | void | yes | Sets `this.onImageChooseClick` | [V1 12910-12912] |
| 57 | `getOnImageChooseClick` | `() → function | undefined` | the callback | yes (returns undefined) | Pure | [V1 12913-12915] |
| 58 | `getFieldsInPanel` | `() → field[]` | concatenated fields | yes (returns []) | Iterates panels, concat `panel.getFieldsInPanel()` | [V1 12916-12921] |
| 59 | `getTestData` | `() → object` | merged test data object | yes (returns `{}`) | `Object.assign({}, ...panels.map(p => p.getTestData()))` | [V1 12922-12927] |
| 60 | `update` | `(t: object | string, idx?: number) → void` | void | yes | Wrapped in `try/catch`; iterates `t.panels`: if `index > curLen` push new `pt` + design + buildPagination; for all, build `new rt(panel)`, set `editingPanel = printPanels[index]`, call `editingPanel.update(temp)`; finally `selectPanel(idx || 0)`. On catch → `console.warn('[hiprint] template.update failed:', er)` + `onUpdateError(er)` if provided | [V1 12928-12950] |
| 61 | `getSelectEls` | `() → element[]` | array of selected elements | no | Reads `editingPanel.mouseRect.mouseRectSelectedElement` if active; else filters `printElements` where last child display=block and not table type | [V1 12951-12962] |
| 62 | `selectElementsByField` | `(fieldsArray: string[]) → void` | void | no (not guarded) | Iterates panel `printElements`; for each matching `e.options.field`, calls `e.selectFromList(appendSelect)` (first false, then true) | [V1 12964-12975] |
| 63 | `selectAllElements` | `() → void` | void | no (not guarded) | Iterates panel `printElements`, all visible → `selectFromList(appendSelect)` | [V1 12976-12986] |
| 64 | `updateOption` | `(option: string, v: any) → void` | void | no (not guarded) | Batch update: `getSelectEls()` → each `el.updateOption(option, v, true)`; trigger `hiprintTemplateDataChanged_<id>` "批量修改" | [V1 12987-12994] |
| 65 | `setElsAlign` | `(e: 'left'\|'vertical'\|'right'\|'top'\|'horizontal'\|'bottom'\|'distributeHor'\|'distributeVer') → void` | void | no (not guarded) | Selects via `getSelectEls()`; computes `minLeft/maxRight/minTop/maxBottom`; per-case calls `el.updateSizeAndPositionOptions(...)` and updates `designTarget.css('left'|'top', ...)`. Note: alignment cases here use names `vertical`/`horizontal` instead of `horizontalCenter`/`verticalCenter` (different from `alignElements` API on PrintPanel) | [V1 12995-13073] |
| 66 | `setElsSpace` | `(dis: number, isHor: bool) → void` | void | no (not guarded) | Sorts selected elements by left (`isHor=true`) or top; sets each subsequent element to `prev.left + prev.width + dis` (horizontal) or top + height + dis (vertical) | [V1 13074-13099] |
| 67 | `initAutoSave` | `() → void` | void | no (called by constructor) | Subscribes to `hiprintTemplateDataShortcutKey_<id>` (undo/redo via `historyPos` adjustment) and `hiprintTemplateDataChanged_<id>` (pushes snapshot; trims to 50 entries; calls `onDataChanged(type, json)`). On undo/redo error, rolls back `historyPos` to `prevPos` (defensive — prevents pointer drift). | [V1 13100-13152] |

> NOTE: Methods 62-66 (`selectElementsByField`, `selectAllElements`, `updateOption`, `setElsAlign`, `setElsSpace`) are **NOT** destroy-guarded in V1. Calling them after `destroy()` will hit null `editingPanel`. V3 should guard these.

---

## Section 8A: buildToolbar opts (Complete Reference)

Compiled from `$.extend({...}, options || {})` block [V1 lines 13315-13390]. Listed in source order; each row shows name, default, type, what it controls, V1 line, and example value.

| # | `opts.*` | Default | Type | What it controls | V1 line | Example |
|---|---|---|---|---|---|---|
| 1 | `paperTypes` | `_defaultPaperTypes` (A3/A4/A5/B3/B4/B5 dict) | `Record<string, {width, height}>` (mm) | Set of preset paper size buttons (Section 1.15) | [V1 13316, 13296-13303] | `{A4:{width:210,height:297}, Letter:{width:215.9,height:279.4}}` |
| 2 | `defaultPaper` | `'A4'` | `string` | Initially-active paper-button name (`.active` class) | [V1 13317] | `'Letter'` |
| 3 | `scaleMin` | `0.5` | `number` | Lower zoom bound (Section 1.12) | [V1 13318] | `0.25` |
| 4 | `scaleMax` | `5` | `number` | Upper zoom bound (Section 1.14) | [V1 13319] | `8` |
| 5 | `scaleStep` | `0.1` | `number` | Increment per zoom click | [V1 13320] | `0.25` |
| 6 | `showPaperSelect` | `true` | `bool` | Show paper-size button group | [V1 13321] | `false` |
| 7 | `showCustomPaper` | `true` | `bool` | Show custom-paper button (Section 1.17) — gated by `showPaperSelect` | [V1 13322] | `false` |
| 8 | `showScale` | `true` | `bool` | Show zoom in/out group (Section 1.12-1.14) | [V1 13323] | `false` |
| 9 | `showRotate` | `true` | `bool` | Show rotate button (Section 1.16) | [V1 13324] | `false` |
| 10 | `showAlign` | `true` | `bool` | Show alignment buttons (Section 1.22) | [V1 13325] | `false` |
| 11 | `showPreview` | `true` | `bool` | Show preview button (Section 1.4) | [V1 13326] | `false` |
| 12 | `showClear` | `true` | `bool` | Show clear button (Section 1.7) | [V1 13327] | `false` |
| 13 | `showPrint` | `true` | `bool` | Show print button (Section 1.5) | [V1 13328] | `false` |
| 14 | `onPreview` | `null` | `function(template) → void` | Click handler for preview button | [V1 13329] | `(tpl) => openPreviewModal(tpl)` |
| 15 | `onClear` | `null` | `function(template) → void` | Total takeover of clear button (skips both `onClearConfirm` and native `confirm`) | [V1 13330] | `(tpl) => myModal.confirm().then(ok => ok && tpl.clear())` |
| 16 | `onPrint` | `null` | `function(template) → void` | Click handler for print button | [V1 13331] | `(tpl) => tpl.print(data)` |
| 17 | `onSave` | `null` | `function(template, json, event, api, {name}) → Promise<any> | any` | Handler for save action (skips default JSON download) | [V1 13332] | `(tpl, json, e, api, {name}) => fetch('/save', {body:JSON.stringify({name, json})})` |
| 18 | `onPaperChange` | `null` | `function(name: string, size: {width, height}) → void` | Fired after every paper-size or custom-paper confirm | [V1 13333] | `(name, {width, height}) => storeUI.setPaper(name, width, height)` |
| 19 | `onScaleChange` | `null` | `function(scale: number) → void` | Fired after every zoom in/out | [V1 13334] | `(s) => storeUI.setZoom(s)` |
| 20 | `onRotate` | `null` | `function(template) → void` | Fired after rotate button click | [V1 13335] | `(tpl) => storeUI.setOrient(tpl.getOrient())` |
| 21 | `onAlign` | `null` | `function(type: string, template) → void` | Fired after each alignment-button click | [V1 13336] | `(type) => analytics.send('align', type)` |
| 22 | `showBusinessSelect` | `true` | `bool` | Show business-select button (Section 1.1) | [V1 13337] | `false` |
| 23 | `businessButtonText` | `i18n.__('业务选择')` ("业务选择") | `string` | Business-select button label | [V1 13338] | `'选业务'` |
| 24 | `onBusinessClick` | `null` | `function(template, api) → bool` | Pre-dialog hook; return `false` to suppress dialog open | [V1 13339] | `(tpl, api) => { if (busy) return false; }` |
| 25 | `onBusinessDialogOpen` | `null` | `function(context: {type, payload, template, api, openDefault, closeDefault}) → bool` | Override dialog open (return `true`/`false` to skip default) | [V1 13340] | `(ctx) => { myDrawer.open(); return false; }` |
| 26 | `onBusinessDialogClose` | `null` | `function(context: {type, payload, template, api, closeDefault}) → bool` | Override dialog close | [V1 13341] | `(ctx) => { myDrawer.close(); return false; }` |
| 27 | `businessDialogTitle` | `i18n.__('选择业务')` ("选择业务") | `string` | Dialog `<h2>` title | [V1 13342] | `'选择订单'` |
| 28 | `businessDialogEmptyText` | `i18n.__('暂无业务')` ("暂无业务") | `string` | Empty-state message | [V1 13343] | `'未匹配到订单'` |
| 29 | `businessDialogLoadingText` | `i18n.__('业务加载中...')` ("业务加载中...") | `string` | Loading-state message | [V1 13344] | `'加载中…'` |
| 30 | `businessDialogErrorText` | `i18n.__('业务加载失败')` ("业务加载失败") | `string` | Error-state fallback (used if `err.message` falsy) | [V1 13345] | `'加载失败，请重试'` |
| 31 | `businessListProvider` | `null` | `function(template, api) → Promise<item[]> \| item[]` | Items source for business dialog | [V1 13346] | `(tpl, api) => fetch('/business').then(r=>r.json())` |
| 32 | `businessLoader` | `null` | `function(item, template, api) → Promise<config> \| config` | Per-item lazy-load on select (returns business config) | [V1 13347] | `(item) => fetch('/business/'+item.id).then(r=>r.json())` |
| 33 | `onBusinessSelect` | `null` | `function(item, parsedData, template, api) → void` | Fired when business card "选择" clicked + data resolved | [V1 13348] | `(item, data) => template.setFields(data.fields)` |
| 34 | `closeBusinessDialogOnSelect` | `true` | `bool` | If `false`, dialog stays open after select | [V1 13349] | `false` |
| 35 | `onTemplateDialogOpen` | `null` | `function(context) → bool` | Override template-dialog open | [V1 13350] | similar to onBusinessDialogOpen |
| 36 | `onTemplateDialogClose` | `null` | `function(context) → bool` | Override template-dialog close | [V1 13351] | similar |
| 37 | `onTemplateDeleteConfirm` | `null` | `function(context: {type, item, template, api, confirmDefault}) → Promise<bool> \| bool` | Replaces native `confirm()` before delete; truthy = proceed | [V1 13352] | `(ctx) => myModal.confirm(`删除 ${ctx.item._name}?`)` |
| 38 | `showTemplateSelect` | `true` | `bool` | Show template-select button (Section 1.2) | [V1 13353] | `false` |
| 39 | `showSave` | `true` | `bool` | Show save button (Section 1.3) | [V1 13354] | `false` |
| 40 | `showPanelManager` | **`false`** | `bool` | Show panel-manager group (label + select + add button); **uniquely opt-in** | [V1 13357] | `true` |
| 41 | `panelManagerLabel` | `i18n.__('分页')` ("分页") | `string` | Label sibling text | [V1 13358] | `'页码'` |
| 42 | `addPanelButtonText` | `'+'` | `string` | Add-page button text | [V1 13359] | `'新增'` |
| 43 | `templateButtonText` | `i18n.__('选择模版')` ("选择模版") | `string` | Template-select button label | [V1 13360] | `'选模板'` |
| 44 | `onSaveDialogOpen` | `null` | `function(context: {type, payload, defaultName, template, api, openDefault, closeDefault}) → bool` | Override save-dialog open | [V1 13361] | `(ctx) => myModal.openSave(ctx.defaultName).then(name => ctx.openDefault(name)); return false` |
| 45 | `onSaveDialogClose` | `null` | `function(context: {type, payload, template, api, closeDefault}) → bool` | Override save-dialog close | [V1 13362] | similar |
| 46 | `customPaperButtonText` | `i18n.__('自定义')` ("自定义") | `string` | Custom-paper button label | [V1 13363] | `'自定义尺寸'` |
| 47 | `customPaperConfirmText` | `i18n.__('确定')` ("确定") | `string` | Custom-paper confirm-button text | [V1 13364] | `'应用'` |
| 48 | `rotateButtonText` | `i18n.__('旋转')` ("旋转") | `string` | Rotate-button label (note: `↻ ` glyph prepended) | [V1 13365] | `'90°'` |
| 49 | `previewButtonText` | `i18n.__('预览')` ("预览") | `string` | Preview-button label | [V1 13366] | `'打印预览'` |
| 50 | `clearButtonText` | `i18n.__('清空')` ("清空") | `string` | Clear-button label | [V1 13367] | `'重置'` |
| 51 | `printButtonText` | `i18n.__('打印')` ("打印") | `string` | Print-button label | [V1 13368] | `'立即打印'` |
| 52 | `saveButtonText` | `i18n.__('保存')` ("保存") | `string` | Save-button label | [V1 13369] | `'保存模板'` |
| 53 | `saveDialogTitle` | `i18n.__('保存模版')` ("保存模版") | `string` | Save dialog `<h2>` title | [V1 13370] | `'保存当前设计'` |
| 54 | `saveDialogNameLabel` | `i18n.__('模版名称')` ("模版名称") | `string` | Save dialog input `<label>` text | [V1 13371] | `'模板名'` |
| 55 | `saveDialogNamePlaceholder` | `i18n.__('请输入模版名称')` ("请输入模版名称") | `string` | Save dialog input placeholder | [V1 13372] | `'例如 订单打印模板 v2'` |
| 56 | `saveDialogNameRequiredText` | `i18n.__('请输入模版名称')` ("请输入模版名称") | `string` | Validation error text when input empty | [V1 13373] | `'名称必填'` |
| 57 | `saveDialogConfirmText` | `i18n.__('确定')` ("确定") | `string` | Save dialog confirm button text | [V1 13374] | `'保存'` |
| 58 | `saveDialogCancelText` | `i18n.__('取消')` ("取消") | `string` | Save dialog cancel button text | [V1 13375] | `'放弃'` |
| 59 | `templateDialogTitle` | `i18n.__('选择模版')` ("选择模版") | `string` | Template dialog `<h2>` title | [V1 13376] | `'载入模板'` |
| 60 | `templateDialogEmptyText` | `i18n.__('暂无模版')` ("暂无模版") | `string` | Template empty state | [V1 13377] | `'未发现已存模板'` |
| 61 | `templateDialogLoadingText` | `i18n.__('模版加载中...')` ("模版加载中...") | `string` | Template loading state | [V1 13378] | `'载入中…'` |
| 62 | `templateDialogErrorText` | `i18n.__('模版加载失败')` ("模版加载失败") | `string` | Template error fallback | [V1 13379] | `'载入失败'` |
| 63 | `templateListProvider` | `null` | `function(template, api) → Promise<item[]> \| item[]` | Items source for template dialog | [V1 13380] | `(tpl, api) => fetch('/templates').then(r=>r.json())` |
| 64 | `templateLoader` | `null` | `function(item, template, api) → Promise<json> \| json` | Per-item lazy template JSON loader | [V1 13381] | `(item) => fetch('/template/'+item.id).then(r=>r.json())` |
| 65 | `onTemplateSelect` | `null` | `function(item, json, template, api) → void` | Fired when template card "选择" + JSON applied | [V1 13382] | `(item, json) => analytics.send('template_loaded')` |
| 66 | `onTemplatePreview` | `null` | `function(item, template, api) → void` | Fired when "预览" clicked | [V1 13383] | `(item) => openPreviewDrawer(item)` |
| 67 | `onTemplateEdit` | `null` | `function(item, template, api) → void` | Fired when "编辑" clicked | [V1 13384] | `(item) => router.push('/templates/'+item.id+'/edit')` |
| 68 | `onTemplateDelete` | `null` | `function(item, template, api) → Promise<bool> \| bool` | Fired when "删除" confirmed; if `false`-returning, refresh skipped | [V1 13385] | `(item) => fetch('/template/'+item.id, {method:'DELETE'})` |
| 69 | `closeTemplateDialogOnSelect` | `true` | `bool` | If `false`, dialog stays open after select | [V1 13386] | `false` |
| 70 | `extraPosition` | `'end'` | `'start' \| 'end'` | Extra-button group placement | [V1 13387] | `'start'` |
| 71 | `extraButtons` | `[]` | `Array<extraBtnOpt>` (Section 1.26) | Configuration-driven extra buttons | [V1 13388] | `[{key:'pdf', label:'PDF', onClick: tpl => tpl.toPdf(data, 'out.pdf')}]` |
| 72 | `renderExtra` | `null` | `function(toolbarApi) → void` | Imperative hook called after `extraButtons` group append; business may `toolbarApi.addGroup(...)` | [V1 13389] | `(api) => api.toolbar.append($myCustomDom)` |
| 73 | `alignItems` | `defaultAlignItems` (8 default) | `Array<{type, label, icon}>` | Replace default alignment buttons (Section 1.22) | [V1 14368-14370] | `[{type:'left',label:'L',icon:'⫷'}, {type:'right',label:'R',icon:'⫸'}]` |
| 74 | `onClearConfirm` | `null` | `function(template) → Promise<bool> \| bool` | Async-confirm hook instead of native `confirm()` (sub-priority to `onClear`) | [V1 14409-14422] | `(tpl) => myModal.confirm('确定清空?')` |
| 75 | `onCustomPaperOpen` | `null` | `function(template, api) → bool` | Override default custom-paper popover (return `false`) | [V1 14281-14283] | `(tpl) => { myDrawer.openCustomPaper(); return false; }` |
| 76 | `onTemplateSelectError` | `null` | `function(err, item, template, api) → void` | Fired when template select fails (loader/parse error) | [V1 13909] | `(err, item) => toast.error('模板加载失败: ' + err.message)` |

> **Note**: `onCustomPaperOpen`, `onClearConfirm`, `onTemplateSelectError`, and `alignItems` are NOT in the default `$.extend(...)` block — they're read directly from `options` later in the code. They are still valid opts and exhaustively documented above.

### 8A.2 toolbarCtrl Returned Methods [V1 lines 14722-14856]

Top-level return value of `buildToolbar`. Mirrors `toolbarApi` (used internally) but adds `getScale`/`setScale`/`triggerSave`/`destroy`.

| # | Method | Signature | V1 line |
|---|---|---|---|
| 1 | `getScale` | `() → number` | [V1 14724] |
| 2 | `setScale` | `(v: number) → void` — also updates `.hiprint-toolbar-scale-label` if `showScale` | [V1 14725-14731] |
| 3 | `openBusinessDialog` | `() → void` | [V1 14732-14734] |
| 4 | `closeBusinessDialog` | `() → void` | [V1 14735-14737] |
| 5 | `refreshBusinessList` | `() → Promise<item[]>` | [V1 14738-14740] |
| 6 | `setBusinessItems` | `(list: item[]) → void` | [V1 14741-14743] |
| 7 | `getBusinessItems` | `() → item[]` | [V1 14744-14746] |
| 8 | `setBusinessListProvider` | `(provider: function | null) → void` | [V1 14747-14749] |
| 9 | `setBusinessLoader` | `(loader: function | null) → void` | [V1 14750-14752] |
| 10 | `getBusinessDialogElement` | `() → jQuery` | [V1 14753-14755] |
| 11 | `openTemplateDialog` | `() → void` | [V1 14756-14758] |
| 12 | `closeTemplateDialog` | `() → void` | [V1 14759-14761] |
| 13 | `getTemplateDialogElement` | `() → jQuery` | [V1 14762-14764] |
| 14 | `openSaveDialog` | `(defaultName?: string) → void` | [V1 14765-14767] |
| 15 | `closeSaveDialog` | `() → void` | [V1 14768-14770] |
| 16 | `getSaveDialogElement` | `() → jQuery` | [V1 14771-14773] |
| 17 | `refreshTemplateList` | `() → Promise<item[]>` | [V1 14774-14776] |
| 18 | `setTemplateItems` | `(list: item[]) → void` | [V1 14777-14779] |
| 19 | `getTemplateItems` | `() → item[]` | [V1 14780-14782] |
| 20 | `setTemplateListProvider` | `(provider: function | null) → void` | [V1 14783-14785] |
| 21 | `setTemplateLoader` | `(loader: function | null) → void` | [V1 14786-14788] |
| 22 | `setDialogHandler` | `(handlerKey: 'businessOpen' | 'businessClose' | 'templateOpen' | 'templateClose' | 'saveOpen' | 'saveClose' | 'templateDeleteConfirm', handler: function) → function` (returns updated handler) | [V1 14789-14791], handler-key map [V1 13411-13419] |
| 23 | `getDialogHandler` | `(handlerKey: string) → function | null` | [V1 14792-14794] |
| 24 | `setBusinessDialogOpenHandler` | `(handler: function) → function` | [V1 14795-14797] |
| 25 | `setBusinessDialogCloseHandler` | `(handler: function) → function` | [V1 14798-14800] |
| 26 | `setTemplateDialogOpenHandler` | `(handler: function) → function` | [V1 14801-14803] |
| 27 | `setTemplateDialogCloseHandler` | `(handler: function) → function` | [V1 14804-14806] |
| 28 | `setSaveDialogOpenHandler` | `(handler: function) → function` | [V1 14807-14809] |
| 29 | `setSaveDialogCloseHandler` | `(handler: function) → function` | [V1 14810-14812] |
| 30 | `setTemplateDeleteConfirmHandler` | `(handler: function) → function` | [V1 14813-14815] |
| 31 | `triggerSave` | `(payload?: { skipPrompt?: bool, name?: string, event? } \| string) → null \| any` — string short-form treats arg as `name`; `{skipPrompt:true,name}` skips dialog and calls `saveTemplateWithName` directly | [V1 14816-14818], [V1 14198-14207] |
| 32 | `getButton` | `(key: string) → jQuery | null` | [V1 14819-14821] |
| 33 | `getButtons` | `() → Record<string, jQuery>` | [V1 14822-14824] |
| 34 | `setButtonVisible` | `(key: string, visible: bool) → bool` (true if found) | [V1 14825-14827] |
| 35 | `setButtonDisabled` | `(key: string, disabled: bool) → bool` | [V1 14828-14830] |
| 36 | `setButtonText` | `(key: string, text: string, useHtml?: bool=false) → bool` — when `useHtml === true`, `.html(text)` (caller responsible for XSS escape); otherwise `.text(text)` | [V1 14831-14833], [V1 13539-13549] |
| 37 | `triggerButton` | `(key: string) → bool` — programmatic click | [V1 14834-14836] |
| 38 | `getGroup` | `(groupKey: string) → jQuery | null` | [V1 14837-14839] |
| 39 | `getGroups` | `() → Record<string, jQuery>` | [V1 14840-14842] |
| 40 | `setGroupVisible` | `(groupKey: string, visible: bool) → bool` | [V1 14843-14845] |
| 41 | `getToolbarElement` | `() → jQuery` (the `.hiprint-toolbar` root) | [V1 14846] |
| 42 | `destroy` | `() → void` — `closeBusinessDialog/closeTemplateDialog/closeSaveDialog`, `$(document).off(_toolbarClickNs)`, `$container.empty()` | [V1 14847-14854] |

> Additional `toolbarApi`-only methods exposed via `opts.renderExtra(api)` [V1 14716-14718]: `api.toolbar`, `api.container`, `api.template`, `api.getToolbarCtrl()`, `api.addGroup($group, position)`, `api.createButton(btnOpt)`. See [V1 14559-14570].

---

## Section 8B: buildDesigner opts (Complete Reference)

See Section 5.2 above for the canonical buildDesigner opts table (17 options including the auto-generated `designerId`). They are duplicated here for symmetry as the second half of "Section 8":

| # | `opts.*` | Default | Type | What it controls | V1 line |
|---|---|---|---|---|---|
| 1 | `leftWidth` | `200` | `number` (px) | Initial left panel width | [V1 14861] |
| 2 | `rightWidth` | `280` | `number` (px) | Initial right panel width | [V1 14862] |
| 3 | `leftMinWidth` | `140` | `number` (px) | Left drag-resize lower bound | [V1 14863] |
| 4 | `leftMaxWidth` | `400` | `number` (px) | Left drag-resize upper bound | [V1 14864] |
| 5 | `rightMinWidth` | `200` | `number` (px) | Right drag-resize lower bound | [V1 14865] |
| 6 | `rightMaxWidth` | `500` | `number` (px) | Right drag-resize upper bound | [V1 14866] |
| 7 | `leftCollapsed` | `false` | `bool` | Start with left panel collapsed | [V1 14867] |
| 8 | `rightCollapsed` | `false` | `bool` | Start with right panel collapsed | [V1 14868] |
| 9 | `componentModule` | `'defaultModule'` | `string` | Module key to fetch element types from registry | [V1 14869] |
| 10 | `componentPanelSlot` | `null` | `{enabled, ...}` | Pass-through slot config to `it.setPanelSlot` if `enabled` else `it.clearPanelSlot()` | [V1 14870] |
| 11 | `templateOptions` | `{}` | `PrintTemplate ctor opts` | Forwarded to `new ct(templateOpts)` constructor (with auto-injected `settingContainer` + `paginationContainer`) | [V1 14871, 15075-15080] |
| 12 | `toolbarOptions` | `{}` | `buildToolbar opts` | Forwarded to `buildToolbar(host, tpl, opts.toolbarOptions)` | [V1 14872, 15099] |
| 13 | `onReady` | `null` | `function(template, toolbarCtrl) → void` | Called after toolbar built; `_safeCall` wrapped | [V1 14873, 15102-15104] |
| 14 | `showPagination` | **`false`** | `bool` | Show bottom pagination strip `.hiprint-printPagination` | [V1 14876, 14925-14927] |
| 15 | `designerId` | auto `'hiprint-designer-<uid>'` | `string` | DOM id prefix (sanitized to `/[^\w-]/g`); affects ep-container/print-template/option-setting IDs | [V1 14892] |

---

## Section 9: Data Structures

### 9.1 Template JSON Schema

```json
{
  "panels": [
    {
      "index": 0,
      "name": "第1页",
      "paperType": "A4",
      "width": 210,
      "height": 297,
      "paperHeader": 0,
      "paperFooter": 0,
      "paperNumberDisabled": false,
      "panelLayoutOptions": {},
      "printElements": [
        {
          "options": {
            "left": 10, "top": 10,
            "width": 100, "height": 30,
            "field": "...",
            "title": "...",
            "fontSize": 12,
            "textAlign": "left",
            "color": "#000",
            "lineHeight": 1.2,
            "draggable": true,
            "positionLocked": false,
            "zIndex": 0,
            "formatter": "function(value){return value;}",
            "styler": "function(value){return {color:'red'};}"
          },
          "printElementType": {
            "tid": "configModule.text",
            "title": "文本",
            "type": "text",
            "field": "...",
            "data": "...",
            "icon": "..."
          }
        }
      ]
    }
  ]
}
```

### 9.2 Normalized Business/Template Item Format

After `normalizeBusinessItem(item, idx)` [V1 13455-13464] or `normalizeTemplateItem(item, idx)` [V1 13432-13441]:

```js
// Business
{
  ...originalItem,           // preserved via $.extend({}, item, ...)
  _idx: 0,
  _bid: item.id || item.businessId || item.key || item.code || ('business_' + index),
  _name: item.name || item.title || item.businessName || item.label || ('未命名业务 N'),
}
// Template
{
  ...originalItem,
  _idx: 0,
  _tid: item.id || item.templateId || item.key || item.code || ('template_' + index),
  _name: item.name || item.title || item.templateName || item.label || ('未命名模版 N'),
}
```

### 9.3 ExtraButton Option (`extraBtnOpt`) [V1 14520-14555]

```ts
interface extraBtnOpt {
  key?: string;                              // registry key (auto = ''+index)
  label?: string;                            // primary text (XSS-safe via .text())
  text?: string;                             // fallback if label missing
  icon?: string;                             // prepended glyph (joined with ' ')
  html?: string;                             // overrides label/icon — uses .html() (caller-XSS-responsible)
  type?: '' | 'primary' | 'danger';          // adds matching class
  className?: string;                        // extra space-separated classes
  title?: string;                            // title attribute (tooltip)
  visible?: boolean | ((template, api) => boolean);   // default true
  disabled?: boolean | ((template, api) => boolean);  // default false (not re-evaluated)
  onClick?: (template, event, api) => void;  // suppressed if disabled
}
```

### 9.4 Default Paper Types (`_defaultPaperTypes`) [V1 13296-13303]

| Name | Width (mm) | Height (mm) |
|---|---|---|
| A3 | 420 | 296.6 |
| A4 | 210 | 296.6 |
| A5 | 210 | 147.6 |
| B3 | 500 | 352.6 |
| B4 | 250 | 352.6 |
| B5 | 250 | 175.6 |

### 9.5 Default Alignment Items (`defaultAlignItems`) [V1 14358-14367]

| `type` | `label` (ZH) | `icon` |
|---|---|---|
| `left` | "左对齐" | `⫷` |
| `horizontalCenter` | "水平居中" | `⫿` |
| `right` | "右对齐" | `⫸` |
| `top` | "顶对齐" | `⫠` |
| `verticalCenter` | "垂直居中" | `⫥` |
| `bottom` | "底对齐" | `⫡` |
| `distributeHorizontal` | "水平等距" | `⇔` |
| `distributeVertical` | "垂直等距" | `⇕` |

---

## Section 10: Destruction & Memory Management

Must call in `onBeforeUnmount()` (Vue) / `componentWillUnmount` (React):

```js
if (designerCtrl) {
  designerCtrl.destroy();   // → toolbarCtrl.destroy() + hiprintTemplate.destroy() + $container.empty()
}
// If you built toolbar manually (no designer):
if (toolbarCtrl) {
  toolbarCtrl.destroy();    // closes 3 dialogs, $(document).off(_toolbarClickNs), $container.empty()
}
if (template) {
  template.destroy();       // idempotent (returns early if _destroyed); see Section 7 row 26 for full 7-step sequence
}
```

**Failure to destroy** causes:

1. Cumulative `$(document).on('click' + _toolbarClickNs, ...)` handlers → memory grows with every route mount
2. Per-template event subscriptions on 4 bus keys never released → closures hold the template, GC can't reclaim
3. `s.a.instance.printTemplateContainer[id]` singleton-map entries pile up (one per non-destroyed template)
4. Element-list panel + toggle DOM nodes remain in `$mountTarget` even after `$container.empty()`
5. Global `$(document).keydown` shortcut handler (line 10949) has the once-flag `_shortcutKeyBound` but is NEVER `.off()` — known leak
6. Guide-line drag handlers `.hiprintGuideDrag_<panelId>` left dangling if drag terminated outside `finishGuideDrag`

The `destroy()` 7-step sequence (Section 7 row 26 / [V1 12576-12641]) handles 1, 2, 3, 4 directly. Items 5 and 6 are known V1 issues.

---

## Section 11: Known Gaps & Workarounds (V1 Limitations)

| Feature | Severity | Workaround | V1 Source |
|---|---|---|---|
| Subset of alignment buttons | HIGH | Set `opts.alignItems = [...]` to fully replace defaults; items must have `type/label/icon` all truthy | [V1 14368-14370] |
| Async clear confirmation | HIGH | Provide `opts.onClearConfirm(template) → Promise<bool>` to replace native `confirm()` | [V1 14409-14422] |
| Custom paper popover UI override | HIGH | Return `false` from `opts.onCustomPaperOpen(template, api)` to suppress built-in popover | [V1 14281-14283] |
| Single-group element-type removal | MED | Call `setElementTypeGroups(moduleName, ...)` with reduced groups to replace the module's bucket | [V1 13275-13280] |
| Rename element type undo | MED | Not supported — `renameElementType` does not push to historyList | [V1 13288-13294] |
| No PDF/Undo/Redo/RemovePanel/Grid/Ruler/Lock toolbar buttons | MED | Use `opts.extraButtons[]` with `onClick: tpl => tpl.toPdf(...)` / `tpl.undo()` / etc. | [V1 14701-14713] |
| Global keydown handler at [V1 10949] not removed on destroy | MED | Manually `$(document).off('keydown')` after template destroy (note: may affect other instances) | [V1 10949] |
| `aria-busy` not toggled on dialog body during load | LOW | Static `"false"` — fix at V3 by toggling during refreshXxxList | [V1 13733, 13991] |
| `extraButtons.disabled` function not re-evaluated on state change | LOW | Manually `toolbarCtrl.setButtonDisabled('extra:<key>', bool)` on state changes | [V1 14544-14545] |
| Letter paper size not in default `_defaultPaperTypes` | LOW | Pass `opts.paperTypes = {Letter: {width:215.9, height:279.4}, A4: ...}` | [V1 13296-13303] |
| Z-index controls toolbar-less | MED | Use keyboard `Ctrl+]`/`Ctrl+[`/`Ctrl+Shift+]`/`Ctrl+Shift+[` or add `extraButtons` with handlers that mutate `el.options.zIndex` | [V1 10983-11003] |
| `setElsAlign` uses different alignment names than `alignElements` | LOW | Use `template.alignElements(type)` (the PrintPanel API exposed via `template.alignElements` → editingPanel) for canonical 8 alignment types; reserve `setElsAlign` for legacy calls | [V1 12483, 11626, 12995] |

---

## Section 12: QA Checklist for V3 Implementation

### 12.1 Toolbar Button Tests

- [ ] Each of 14 button groups (businessSelect / templateSelect / paper / scale / rotate / align / preview / clear / print / panels / save / extra) renders with correct label given default opts
- [ ] Button visibility controlled by every `opts.show*` flag (12 total: `showPaperSelect`, `showCustomPaper`, `showScale`, `showRotate`, `showAlign`, `showPreview`, `showClear`, `showPrint`, `showBusinessSelect`, `showTemplateSelect`, `showSave`, `showPanelManager`)
- [ ] Click handlers call exactly the documented hooks with documented signatures
- [ ] `toolbarCtrl.setButtonText(key, text)` works (safe `.text()` path) and `setButtonText(key, html, true)` works (caller-XSS html path)
- [ ] `toolbarCtrl.setButtonVisible(key, bool)` toggles button display + auto-hides empty groups via `syncToolbarGroupVisibility` [V1 13502-13514]
- [ ] `toolbarCtrl.setButtonDisabled(key, bool)` toggles `disabled` prop
- [ ] `toolbarCtrl.triggerButton(key)` programmatically clicks
- [ ] Extra buttons via `opts.extraButtons[]` render with all 11 documented fields (key/label/text/icon/html/type/className/title/visible/disabled/onClick)
- [ ] `toolbarCtrl.addGroup($el, position)` works at runtime with both `'start'` and `'end'`
- [ ] `opts.renderExtra(api)` invoked exactly once after extra-buttons-group append
- [ ] Paper-size buttons toggle `.active` + `aria-pressed` correctly
- [ ] Default-paper button starts active (`A4` by default)
- [ ] Custom-paper popover synced `aria-expanded` state
- [ ] Alignment items respect `opts.alignItems` override (filtered for truthy type/label/icon)

### 12.2 Dialog Tests

- [ ] Business dialog: opens, runs `businessListProvider`, displays cards with title/desc/meta, refresh button works, ESC closes
- [ ] Business dialog cancellation: rapid open/refresh increments `businessDialogRequestId` and stale responses are dropped
- [ ] Template dialog: 4 actions (Select/Preview/Edit/Delete) each fire correct hook
- [ ] Template delete confirm flow: native `confirm()` fallback works when no `onTemplateDeleteConfirm`; async hook returning resolved-true proceeds; resolved-false cancels; sync throws caught and treated as false
- [ ] Save dialog: validates non-empty trimmed name; saves via `opts.onSave` if provided, else downloads JSON Blob via `URL.createObjectURL`
- [ ] Save dialog Enter key submits
- [ ] Save dialog ESC closes (without saving)
- [ ] All 3 dialogs lazy-create on first open (`ensureXxxDialog`) then `show()`/`hide()` thereafter
- [ ] All 3 dialog ARIA: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `tabindex="-1"`
- [ ] Lifecycle hooks `onXxxDialogOpen`/`onXxxDialogClose` receive correct context (`type`, `payload`, `template`, `api`, `openDefault`, `closeDefault`)
- [ ] Save dialog `Promise.resolve(saveTemplateWithName).catch(err)` shows error inline without auto-closing
- [ ] Custom paper popover validates `w > 0 && h > 0`
- [ ] Outside-click closes custom paper popover (namespace-bound `$(document).on('click' + _toolbarClickNs, ...)`)

### 12.3 Keyboard & Accessibility

- [ ] All 27 keyboard combos enumerated in Section 3.1 work
- [ ] Custom paper popover ESC restores focus to trigger button
- [ ] Icon-only buttons have `aria-label`
- [ ] Paper buttons have `aria-pressed`
- [ ] Popover trigger has `aria-haspopup` + `aria-expanded`
- [ ] Tab navigation works through visible buttons
- [ ] Save dialog input is auto-focused with caret at end on open
- [ ] Element-list panel header has tabindex/role/aria-label and arrow-key drag

### 12.4 Multi-Instance Safety

- [ ] Multiple toolbars use unique `_toolbarUid` (timestamp + random)
- [ ] Multiple designers use unique `_designerUid`
- [ ] Each toolbar destroys independently — `$(document).off(_toolbarClickNs)` only removes its own namespace
- [ ] `toolbarCtrl.destroy()` is idempotent
- [ ] `template.destroy()` is idempotent (early-return on `_destroyed`)
- [ ] No event handler leaks after destroy+rebuild loop (run 10x in dev tools)
- [ ] `s.a.instance.printTemplateContainer` does not grow over destroy/rebuild cycles

### 12.5 Configuration Tests

- [ ] All 76 documented `buildToolbar` opts have V3 parity
- [ ] All 15 documented `buildDesigner` opts have V3 parity
- [ ] Defaults match exactly (e.g., `showPanelManager: false`, `showPagination: false`, `scaleMax: 5`, `scaleStep: 0.1`)
- [ ] `extraPosition: 'start'` prepends group; `'end'` appends
- [ ] `opts.alignItems` empty array → falls back to defaults (Array filter check)
- [ ] `opts.businessListProvider === null` → no auto-load; `setBusinessItems` still works

### 12.6 Integration Tests

- [ ] `buildDesigner()` internally calls `buildToolbar()` with `opts.toolbarOptions`
- [ ] `showPagination` toggle works at runtime via `designerCtrl.setPaginationVisible(bool)`
- [ ] Panel manager dropdown syncs with `template.printPanels` on every mousedown/focus
- [ ] Add-page button creates a new panel and switches to it
- [ ] `deletePanel` keeps at least 1 panel (invariant enforced)
- [ ] `template.destroy()` removes element-list panel + toggle from `$mountTarget` (not just `$container`)
- [ ] `template.update(json, idx)` survives wrong shape (try/catch + `onUpdateError`)

---

## Appendix A: Default Paper Types (corrected)

See Section 9.4. The V1 default `_defaultPaperTypes` dictionary [V1 lines 13296-13303] contains A3/A4/A5/B3/B4/B5 (NOT Letter, NOT the imperial 215.9×279.4 dimensions previously documented). Letter and other custom sizes must be passed via `opts.paperTypes`.

## Appendix B: Alignment Types

See Section 9.5 for default `defaultAlignItems` [V1 14358-14367]. Note that `template.alignElements(type)` accepts these 8 types via `PrintPanel.prototype.alignElements` [V1 11626-11678]; the older `PrintTemplate.prototype.setElsAlign(e)` API uses different alignment names (`left`/`vertical`/`right`/`top`/`horizontal`/`bottom`/`distributeHor`/`distributeVer`) [V1 12995-13073] — V3 should consolidate.

## Appendix C: Internal Utility Helpers

| Helper | Signature | Purpose | V1 line |
|---|---|---|---|
| `_safeCall(fn, args, name)` | `(fn, args[], name) → any` | Wraps `opts.onXxx` calls to log+swallow throws (returns `undefined` on error) | [V1 13243-13247] |
| `_evalCap(src, name)` | `(src: string, name: string) → function | undefined` | Caps formatter/styler eval at 5000 chars (DoS guard); `new Function('return ' + src)()` on success | [V1 13251-13259] |
| `validateFieldGroups(fieldGroups)` | `(groups) → void / throws` | Throws if any `field` is empty/undefined or `type` not in `SUPPORTED_ELEMENT_TYPES` | [V1 13175-13188] |
| `mapFieldGroupsToElementTypeGroups(moduleName, fieldGroups)` | `(name, groups) → ot[]` | Build `PrintElementTypeGroup` array; default `type='text'`, default `title=field` | [V1 13190-13213] |
| `normalizeElementTypeGroups(moduleName, groups)` | `(name, groups) → ot[]` | For `setElementTypeGroups`/`append…`; auto-tid (`moduleName + '.' + slug(field|title|name|'item_N')`) | [V1 13215-13238] |
| `normalizeTemplateItem(item, index)` | `(item, i) → templateItem` | Adds `_idx`, `_tid`, `_name` (Section 9.2) | [V1 13432-13441] |
| `normalizeBusinessItem(item, index)` | `(item, i) → businessItem` | Adds `_idx`, `_bid`, `_name` (Section 9.2) | [V1 13455-13464] |
| `parseTemplateData(data)` / `parseBusinessData(data)` | `(data) → parsed | null | original` | If string, `JSON.parse` (returns null/original on failure); else returns as-is | [V1 13443-13453, 13466-13476] |
| `registerToolbarGroup(key, $group)` / `registerToolbarButton(key, $button, meta)` | adds to internal registries | Enables `getButton`/`setButtonText` etc. | [V1 13478-13491] |
| `syncToolbarGroupVisibility(groupKey)` | `(groupKey) → void` | Auto-hides group if all child buttons hidden | [V1 13502-13514] |
| `downloadTemplateJson(json, filename)` | `(json, name) → void` | Creates Blob, ephemeral `<a>`, click, revokeObjectURL | [V1 13593-13610] |
| `_rafThrottle(fn)` | `(fn) → throttledFn` (with `.cancel()`) | rAF-aligned event throttling for drag mousemove | [V1 15002-15019] |

---

**End of V1 Inventory Document**

**Summary of Sections:**

1. Toolbar Buttons — 26 subsections (1.1-1.26), enumerating every button incl. "NOT IN V1 TOOLBAR" markers for absent buttons (PDF/Undo/Redo/RemovePanel/Grid/Ruler/Lock/BringToFront)
2. Dialogs — 4 subsections (Business, Template, Save, Custom Paper Popover), full hook lifecycle
3. Keyboard Shortcuts (27 combos) + Global Events (14 namespace-bound bindings) + Synthetic Events (6 bus keys)
4. CSS Classes (90+) & ARIA Attributes (24)
5. buildDesigner Shell Structure — DOM tree + 15 opts + control object (17 methods)
6. Public API Exports (23 total) — each with signature, types, defaults, side effects, V1 line
7. PrintTemplate Public Methods (67 numbered rows including private helpers)
8. buildToolbar opts (76) + buildDesigner opts (15) + toolbarCtrl methods (42)
9. Data Structures (Template JSON / Normalized items / extraBtnOpt / Default paper types / Default alignment items)
10. Destruction & Memory Management
11. Known Gaps & Workarounds (12 entries)
12. QA Checklist for V3 Implementation (6 subsections)

**Appendices:**

- A: Default Paper Types (corrected vs prior doc)
- B: Alignment Types (with API naming consolidation note)
- C: Internal Utility Helpers (12 entries)

**Completeness**: Every V1 button, dialog, hook, opt, keyboard combo, global event binding, and PrintTemplate method cataloged with exact `[V1 line N]` source citations from `src/hiprint/hiprint.bundle.js` (15353 lines).
