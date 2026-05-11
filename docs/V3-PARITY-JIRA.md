# V3 Parity Jira Backlog v2 (deterministic)

> **替代** `memoized-booping-hearth.md`(已 deprecated,基于猜测)。本 backlog 严格由 `docs/V3-PARITY-MATRIX/INDEX.md` 的 34 core findings + 8 个 matrix docs 的 ⚠️ VIOLATION / 🔴 MISSING / 🟡 PARTIAL 行机械翻译而来。
>
> **生成时间**: 2026-05-11
> **依据 Phase 1 inventory**: 8907 行 / 2300+ V1 line citations
> **依据 Phase 2 matrix**: 6774 行 / ~1300 scored rows / 2830 status markers
> **总 ticket 数**: ~150
> **总修复 effort**: ~293h(若 toolbarCtrl 部分恢复)
> **DoD 模板**: 每个 ticket 须有 Playwright spec 录制 V1 行为 + DOM 断言对比 V3
>
> **本 backlog 的合同**: 每 ticket 必有 V1 file:line + V3 file:line + 决策类型 + e2e spec 名

---

## Sprint 标识规则

- **22a-r**: rollback Sprint 22a 引入的真 bug (P0,~12h)
- **22b**: P0 fix-bug 架构核心(history, default factory, render path)(~25h)
- **22c**: P1 缺失大功能(~120h)
- **22d**: P2 UX 大功能(~80h)
- **22e**: P3 quirks ADR 决策(~16h)
- **22f**: P4 主题/CSS/toolbarCtrl 兼容(~40h)

---

## SPRINT 22a-r — Sprint 22a 引入的真 bug rollback (P0, ~12h)

每条都是 Sprint 22a (commits `b7ac0d2` + `0239850`) 引入的 silent bug — 用户验证后必碰到。

### TKT-001 — Shape Property Panel key drift (CRITICAL)
- V3: `src/hiprint-v3/components/property/ShapePropertyPanel.vue:60-86`
- V1: `docs/V1-INVENTORY/etypes/shapes.md` 中 ShapePropertyPanel option-item registry
- Status: ⚠️ VIOLATION
- Bug: panel 写 `strokeWidth/strokeColor/strokeStyle/fillColor`,SFC + render.ts 都读 `borderWidth/borderColor/borderStyle/backgroundColor`
- 决策: **fix-bug** — 改 panel 写正确 key
- Effort: S (1h)
- DoD: `e2e/tests/shape-property-panel.spec.ts` — edit rect borderWidth,断言 V3 渲染 border-width = N,JSON 包含 `borderWidth: N`(非 `strokeWidth`)

### TKT-002 — Barcode Property Panel 7 of 9 key 错位
- V3: `src/hiprint-v3/components/property/BarcodePropertyPanel.vue:47-51`
- V1: 04-barcode-qrcode matrix VIOLATION-2/3/4
- Bug: `format` (UPPERCASE) vs `barcodeType` (lowercase); `lineColor` vs `barColor`; `displayValue` vs `hideTitle` (倒置); `padding/color/backgroundColor` 全未读
- 决策: **fix-bug** — 改 panel 写 V1 兼容 key,select value 改 lowercase
- Effort: M (3h)
- DoD: `e2e/tests/barcode-property-panel.spec.ts` — edit each field, 断言 bwip-js render output 反映 panel 值

### TKT-003 — Qrcode Property Panel key 错位
- V3: `src/hiprint-v3/components/property/QrcodePropertyPanel.vue:45-49`
- Bug: `errorCorrectionLevel='L'` vs `qrCodeLevel: int index into ['M','L','H','Q']`; `color/backgroundColor` 未读
- 决策: **fix-bug** — 改 panel select 写 int index;color → `barColor`
- Effort: S (1h)
- DoD: `e2e/tests/qrcode-property-panel.spec.ts` — edit ECC level,断言 qrcode DOM data-level 反映

### TKT-004 — Image Property Panel `objectFit` vs `fit` drift
- V3: `ImagePropertyPanel.vue:62` writes `objectFit` / `ImageElement.vue:68` reads `fit`
- 决策: **fix-bug** — panel 写 `fit`
- Effort: S (0.5h)
- DoD: `e2e/tests/image-property-panel.spec.ts` — change fit dropdown, 断言 `<img style="object-fit:...">`

### TKT-005 — Image Property Panel `transform` vs `rotate` drift
- V3: `_helpers.ts:53-55` mismatch
- 决策: **fix-bug** — 用统一 key `transform`(V1 命名)
- Effort: S (0.5h)
- DoD: `e2e/tests/image-rotate.spec.ts`

### TKT-006 — Html Property Panel formatter signature mismatch
- V3: `HtmlElement.vue:57-61` accepts function, V1 also accepts string source via `new Function()`
- 决策: **fix-bug** — V3 加 string-source 接受 + `new Function('return '+src)()` compile
- Effort: M (2h)
- DoD: `e2e/tests/html-formatter-string.spec.ts`

### TKT-007 — Html field-bound v-html XSS path (NEW V3-introduced)
- V3: `HtmlElement.vue:70-71`
- V1 此路径不存在(V1 只支持 content + formatter via `.html()`)
- 决策: **fix-bug** — 字段绑定结果走 sanitize(可选) 或 escape default; opt-in raw via `options.escape=false`
- Effort: M (2h)
- DoD: `e2e/tests/html-xss-field-binding.spec.ts` — 字段值含 `<script>`,断言不执行(默认 escape) + opt-in 模式可保留 HTML

### TKT-008 — Default factory `defaultModule.barcode/qrcode/trackingNo` 完全坏 (CRITICAL)
- V3: `src/hiprint-v3/registry/default-provider.ts:215-304` emits Path A shape (`type:'text'+textType:'barcode'`); V3 only has Path B renderer (bwip-js)
- 决策: **fix-bug** — **任选一个**: (A) 在 V3 加 Path A renderer (read `options.textType` from text element, dispatch to JsBarcode/qrcode.js); (B) 改 default-provider 输出 Path B shape (`type:'barcode'`)。**推荐 (B)** 因 Path B 更现代且 bwip-js 已 import。
- Effort: M (3h)
- DoD: `e2e/tests/default-factory.spec.ts` — 从 element list 拖默认 barcode → 画布显示真条码,不是文本

### TKT-009 — TablePropertyPanel 4 个 invented field rollback
- V3: `TablePropertyPanel.vue:167-180, 317-368`
- V1 不存在: `rowsPerPage`, `maxPage`, `alternateRowColor`, `footer` (raw HTML textarea)
- 决策: **rollback** — 删 panel UI;`footer` 改为 `footerFormatter` (string-source function compile)
- Effort: S (1h)
- DoD: `e2e/tests/table-property-panel.spec.ts` — panel 不再显示 rowsPerPage 等字段

### TKT-010 — TablePropertyPanel `tableCustom` 等型名复活 rollback
- V3: `HiprintPropertyPanel.vue:65-66, 101, 274` 重新引入 `tableCustom`
- V1: bundle 10737-10739 显式 throw "已移除"
- 决策: **rollback** — 统一用 `type:'table'`,去 `tableCustom`
- Effort: S (1h)

### TKT-011 — Default paper list 3-bug stack rollback
- V3: `HiprintToolbar.vue:226-232` — B3 丢、A3/A5/B5 width/height swap、所有 V1 fractional mm round
- V1: A3/A4/A5/B3/B4/B5 with exact dims
- 决策: **fix-bug** — 改默认 paperTypes 数组与 V1 一致
- Effort: S (0.5h)
- DoD: `e2e/tests/default-paper.spec.ts`

### TKT-012 — Sprint 22a TB-006 pagination bar rollback
- V3: `HiprintToolbar.vue:1076-1097` — `< Page X / Y >` 指示器 + prev/next 按钮
- V1: 整个 toolbar 无 pagination bar(只有 panel manager dropdown)
- 决策: **rollback** — 删 pagination bar(panel chip list 保留即可,V1 同等)
- Effort: S (0.5h)
- DoD: panel chip 现存功能不动;pagination bar 不再渲染

---

## SPRINT 22b — P0 fix-bug 架构核心 (~25h)

### TKT-020 — History 自动 snapshot 接线 (CRITICAL — Ctrl+Z 当前实际无效)
- V3: `stores/history.ts:104-117` pushSnapshot() 存在但 interactions 模块从未调用
- 决策: **fix-bug** — 在 drag-drop / resize / property-panel commit / clipboard / context-menu actions 全部 `pushSnapshot()` after-mutate
- Effort: M (3h)
- DoD: `e2e/tests/history.spec.ts` — drag element + Ctrl+Z 恢复;resize + Ctrl+Z 恢复;edit color + Ctrl+Z 恢复

### TKT-021 — V3 双 render path 不一致收敛
- V3: `TableElement.vue` (Vue) vs `print/render.ts` (imperative) — 对 `table.field` dot-path 处理分歧
- 决策: **fix-bug** — 抽 `renderTable(opts, data)` 纯函数到 `internal/`,两路径都用此函数。Vue 模板包裹返回 string,imperative path 直接拼。
- Effort: L (8h)
- DoD: `e2e/tests/table-render-parity.spec.ts` — designer 视图 + print 视图同 template 渲染字节相同(忽略 white-space)

### TKT-022 — `formatter` / `styler` string-source 编译路径
- V3: 仅接 function value (text/html/image/html-property)
- V1: `new Function('return '+src)()` 编译 string source
- 决策: **fix-bug** — V3 加 `compileFormatter(src: string | Function): Function`,JSON 持久化按 V1 字符串形式
- Effort: M (3h)
- DoD: `e2e/tests/formatter-string-source.spec.ts` — JSON 含 `formatter: "function(v){return v.toUpperCase()}"` 时渲染正确

### TKT-023 — text 元素 `textType: barcode/qrcode` 不识别 (Path A 整合)
- V3: `TextElement.vue` 不识 textType
- V1: text 可承载 barcode/qrcode 通过 textType
- 决策: **fix-bug** — TextElement.vue 加 dispatch:若 `options.textType=='barcode'` → 转 BarcodeElement render;`textType=='qrcode'` 同;其他 → normal text
- Effort: M (3h)
- DoD: `e2e/tests/text-textType-dispatch.spec.ts` + 确认 TKT-008 default factory 不再坏

### TKT-024 — `dataType: datetime / boolean` + `format` 转换管线
- V3: 缺
- V1: bundle 10038-10043
- 决策: **build-feature** — `internal/data-format.ts` impl + TextElement use
- Effort: M (3h)
- DoD: `e2e/tests/datatype-format.spec.ts` — date/time/boolean 字段 + format pattern 正确显示;`defaultModule.orderDate` 工作

### TKT-025 — `pageBreak / showInPage / unShowInPage / fixed` 打印路径过滤
- V3: render.ts 全忽略
- V1: 用于多页打印时分页规则
- 决策: **build-feature** — render.ts 加分页 + 元素 visibility 过滤
- Effort: M (3h)
- DoD: `e2e/tests/page-break.spec.ts`

### TKT-026 — longText binary-search 分页 (大功能, V1 旗舰)
- V3: 完全缺,显式 deferred 标注 `LongTextElement.vue:7-9`
- V1: bundle 9757-9931 (LongTextPrintElement 含 binary-search pagination)
- 决策: **build-feature** — V3 加 `internal/long-text-paginate.ts` 实现等同算法
- Effort: L (8h)
- DoD: `e2e/tests/long-text-pagination.spec.ts` — 长文本元素跨多页正确分页

### TKT-027 — Lock semantics 接入 drag-drop + resize + inline-edit + delete
- V3: `options.positionLocked / sizeLocked / draggable / lock` 在 panel 写但 interactions 不读
- 决策: **fix-bug** — drag-drop.ts / resize.ts / keyboard.ts / context-menu.ts 全加守卫
- Effort: M (3h)
- DoD: `e2e/tests/lock.spec.ts` — locked element 拖拽 + resize + 删除 + inline-edit 全 blocked

---

## SPRINT 22c — P1 架构级缺失大功能 (~120h)

### TKT-040 ~ TKT-050 — toolbarCtrl 部分恢复 (10 个最常用方法)
依据 01-toolbar-and-shell §architectural finding,toolbarCtrl 3 of 42 (7%) 覆盖远不够。

按业务方使用频率优先级:
- TKT-040: `getScale()` / `setScale(s)` — Effort: S, DoD: 业务方 zoom 控件可同步
- TKT-041: `addToolbarButton(opts)` / `removeToolbarButton(id)` — Effort: M
- TKT-042: `enableButton(id)` / `disableButton(id)` — Effort: S
- TKT-043: `setButtonText(id, text)` — Effort: S
- TKT-044: `getActivePanel() / setActivePanel(id)` — Effort: S
- TKT-045: `addPanel(opts) / removePanel(id)` — Effort: M
- TKT-046: `setPaper(name)` / `rotatePaper()` — Effort: M
- TKT-047: `getJson() / setJson(json)` 通过 toolbar — Effort: S(委派 PrintTemplate)
- TKT-048: `bindEvent(name, handler) / unbindEvent` — Effort: M
- TKT-049: `getTemplateApi()` / `getCanvasApi()` (composition 入口) — Effort: M
- TKT-050: 测试 + docs/upgrade-to-v3.md 同步 — Effort: M

总 effort: ~25h
DoD: 业务方 vue-admin-main 切 V3 entry 后 toolbar API 可用

### TKT-060 ~ TKT-085 — PrintTemplate compat 缺失 53 方法 (优先选 25)
按 vue-admin-main 实际使用率筛 25 method:
- TKT-060: `rotatePaper()` — Effort: S
- TKT-061: `setPaper(name)` — Effort: S
- TKT-062: `alignElements(type)` 6 种 — Effort: M
- TKT-063: `distributeElements(direction)` — Effort: M
- TKT-064: `zoom(percent) / zoomIn / zoomOut / zoomReset` — Effort: S
- TKT-065: `addPrintPanel(opts) / removePrintPanel(id)` — Effort: M
- TKT-066: `selectPanel(id)` — Effort: S
- TKT-067: `on(name, handler) / off(name, handler) / emit(name, args)` event-bus — Effort: M
- TKT-068: `getElementByTid(tid)` — Effort: S
- TKT-069: `getActivePanelJson()` — Effort: S
- TKT-070: `setDynamicFields(fields)` — Effort: S
- TKT-071: `appendElementTypeGroups(groups)` — Effort: M
- TKT-072: `setElementTypeGroups(groups)` — Effort: M
- TKT-073: `selectAllElements / selectElementsByField` — Effort: M
- TKT-074: `bringToFront / sendToBack / bringForward / sendBackward` — Effort: S
- TKT-075: `setElsAlign(type)` / `setElsSpace(direction)` — Effort: M
- TKT-076: `updateOption(elId, patch)` — Effort: S
- TKT-077: `lockElement / unlockElement(elId)` — Effort: S
- TKT-078: `copyElement / pasteElement / cutElement` (programmatic) — Effort: S
- TKT-079: `getHistory / clearHistory / setHistoryCapacity` — Effort: S
- TKT-080: `getPaperSize / getMaxPanelIndex` — Effort: S
- TKT-081: `exportPdf / exportPng` — Effort: M
- TKT-082: `previewWindow / printWindow` — Effort: M
- TKT-083: `addPrintElement(panelId, opts) / removePrintElement(elId)` — Effort: M
- TKT-084: `getOption(elId, key) / getAllOptions(elId)` — Effort: S
- TKT-085: 全套 destroy-guard + spec 同步 — Effort: M

总 effort: ~35h
DoD: V3 PrintTemplate compat 67 method 25 个覆盖率 ≥ 60%,vue-admin-main 切 V3 后调 API 全工作

### TKT-100 — buildToolbar opts 46 缺失字段补齐 (按优先级 25)
依据 01-toolbar-and-shell §8A:`businessButtonText / templateButtonText / saveButtonText / *DialogTitle / *ListProvider / on* hooks` 等
- 决策: **build-feature** — 在 build-toolbar.ts 加 opts 透传 + 默认值
- Effort: M (8h)
- DoD: `e2e/tests/buildtoolbar-opts.spec.ts` — 每个 opt 改默认值后 V3 UI 反映

### TKT-101 — Element list panel ☰ 整体 (P1 大功能)
- V3: 缺
- V1: `docs/V1-INVENTORY/interactions.md` §16 整套元素列表面板
- 决策: **build-feature** — 全新 `src/hiprint-v3/components/HiprintElementListPanel.vue`(替代当前简单 sidebar)
- Effort: L (12h)
- DoD: `e2e/tests/element-list-panel.spec.ts` — toggle button + panel collapse + 选中元素高亮 + drag from panel

### TKT-102 — 用户画的 guide lines 参考线
- V3: 缺
- V1: interactions.md §17
- 决策: **build-feature** — store action + ruler pointerdown 拖出 + panel render + 拖回 ruler 删除
- Effort: L (10h)
- DoD: `e2e/tests/guide-lines.spec.ts` — 拖出 / 拖动 / 删除

### TKT-103 — Smart guides (snap to other elements 18-case)
- V3: 缺
- V1: interactions.md §6 + drag-drop logic with adsorb
- 决策: **build-feature** — drag-drop.ts 加 nearest-neighbor 算法
- Effort: L (10h)
- DoD: `e2e/tests/smart-guides.spec.ts`

### TKT-104 — Position cross-hairs + size readout overlay during drag/resize
- V3: 缺
- V1: `createLineOfPosition`
- 决策: **build-feature** — overlay div 跟随光标
- Effort: M (4h)
- DoD: `e2e/tests/cross-hairs.spec.ts`

### TKT-105 — Multi-layer column header support (table)
- V3: 单层 columns[]
- V1: 严格 2-D columns[][]
- 决策: **build-feature** — TableElement.vue + render.ts 实现 multi-row thead
- Effort: L (8h)
- DoD: `e2e/tests/table-multi-layer-header.spec.ts`

### TKT-106 — Table merge cells (rowsColumnsMerge)
- V3: 缺
- 决策: **build-feature** — 实现 V1 行为(`display:none` 不是 omit)
- Effort: L (8h)

### TKT-107 — Table column editor inline 加/删/重排/编辑
- V3: TablePropertyPanel 有简单 +/- 按钮,但 V1 在 designer 直接右键 thead context menu
- 决策: **build-feature** — context-menu.ts 加 column-specific items + thead 右键检测
- Effort: M (4h)

### TKT-108 — TextPropertyPanel + LongTextPropertyPanel(替代 generic editor)
- V3: 当前用 HiprintPropertyPanel.vue 内的 generic fallback,只暴露 12 of 101 V1 字段
- 决策: **build-feature** — 新建两个 SFC + 暴露 57+44 字段
- Effort: L (12h)
- DoD: `e2e/tests/text-property-panel.spec.ts` + `long-text-property-panel.spec.ts`

总 22c effort: ~120h

---

## SPRINT 22d — P2 UX 大功能 (~80h)

### TKT-150 — Sidebar resize / collapse
- V3: 缺;V1: `.hiprint-designer-resize-bar / -edge-toggle / -toggle`
- 决策: **build-feature** — HiprintDesigner.vue 加 col-resize handle + collapse button
- Effort: M (4h)

### TKT-151 — Floating size readout + delete button on selected element
- V3: 缺;V1: 8 hiprint-printElement-... 状态 chrome
- 决策: **build-feature** — ElementWrapper.vue 加 overlay
- Effort: M (4h)

### TKT-152 — Resize handles 可见 (size-box / cross-hairs)
- V3: 现仅 outline;V1: 8 visible handles
- 决策: **build-feature** — ElementWrapper.vue 加 8 handle divs
- Effort: M (3h)

### TKT-153 — Paper page-number badge
- V3: 缺;V1: `.hiprint-paperNumber / -disabled`
- 决策: **build-feature**
- Effort: S (1h)

### TKT-154 — Ruler drag handles (精确定位)
- V3: 缺;V1: `.hiprint-ruler-handle / -handle-h / -handle-v`
- 决策: **build-feature**
- Effort: M (4h)

### TKT-155 — Table column drag-reorder
- V3: 缺;V1: column-dragging class + drop logic
- 决策: **build-feature** — TableElement.vue 加 drag handle on thead
- Effort: M (4h)

### TKT-156 — Element list 高亮 canvas selected element
- V3: 缺;V1: `.hiprint-el-list-row.selected-el`
- 决策: **build-feature** — element list watch selection + scroll into view
- Effort: S (1h)

### TKT-157 — Per-element-type color tags (.tag-text/.tag-image/etc.)
- V3: 缺
- 决策: **build-feature** — 在 element list 中显示 type badge
- Effort: S (1h)

### TKT-158 — Distribute / Align toolbar 改 contextmenu (per V1)
- V3: toolbar 有 8 buttons;V1: 全在 contextmenu
- 决策: **rollback** — 删 toolbar 按钮 + 在 contextmenu 加 6 项 align + 2 项 distribute
- Effort: M (3h)

### TKT-159 — 各 etype 缺失 contextmenu items (13 项 — text/longText)
- V3: 缺 font-12pt / font-bold / z-shift / align / distribute / size-broadcast
- 决策: **build-feature** — context-menu.ts items
- Effort: M (3h)

### TKT-160 — Inline-edit fullwidth-colon (`：`) + sanitization
- V3: 缺
- V1: `TextElement` 解析 `title：testData`,清 enter/newline/tab
- 决策: **build-feature** — TextElement.vue inline-edit handler
- Effort: S (1h)

### TKT-161 — 9 个 V1 image factory preset(currentDate / signature / signatureImage / seal / orderNo / orderDate / trackingNo / etc.)
- V3: 缺
- 决策: **build-feature** — default-provider.ts 注册
- Effort: M (3h)

### TKT-162 — V3 default sizes 与 V1 对齐
- V3 / V1 现存差异: hline 200×1 vs 90×9, rect 100×60 vs 90×90, etc.
- 决策: **rollback** — 默认尺寸改 V1
- Effort: S (1h)

### TKT-163 — Resize handles count per etype (V1 quirks)
- V1: hline=2, vline=2, rect/oval=4(no top edge),image=5+rotate, html=8
- V3: 统一 8
- 决策: **fix-bug** — ElementWrapper.vue 按 etype.type 配置 edges
- Effort: M (3h)

### TKT-164 — Click empty canvas always deselect (V3 fix V1 quirk)
- V3 行为更合理(总清空),但破坏 V1 muscle memory
- 决策: **write-ADR** — 写 ADR-0024 决定:保留 V3 fix。然后 ADR doc 公开。
- Effort: S (0.5h)

### TKT-165 — V3 Tab cycles selection vs V1 nothing
- 决策: **write-ADR** — 保留 V3 改善;ADR-0025
- Effort: S (0.5h)

### TKT-166 — Arrow nudge step 1pt vs V1 1.5pt; Shift+arrow 10pt vs V1 ignored
- 决策: **write-ADR** — 保留 V3(更符合行业标准);ADR-0026
- Effort: S (0.5h)

### TKT-167 — Shift+resize lock vs V1 break
- 决策: **write-ADR** — 保留 V3 industry-standard;ADR-0027
- Effort: S (0.5h)

### TKT-168 — Ctrl+Z 在 input 内 — V3 guards, V1 不
- 决策: **write-ADR** — 保留 V3 fix;ADR-0028
- Effort: S (0.5h)

### TKT-169 — Empty canvas click 2+ elements quirk(V1 quirk 不清空)
- 决策: **write-ADR** — 保留 V3 always clear;ADR-0029
- Effort: S (0.5h)

### TKT-170 — Etype factory pre-built 6 个 (e-commerce: url / price / sku / senderInfo / receiverInfo / totalAmount)
- V3: 缺
- 决策: **build-feature**
- Effort: M (3h)

总 22d effort: ~40h

---

## SPRINT 22e — P3 quirks ADR 决策 (~16h)

汇总 22d 的 6 个 ADR + 6 个新 ADR + 决策后实施。

### TKT-200 ~ TKT-211 — 写 12 个 ADR
- ADR-0024 ~ 0035:每个 ADR 描述 V1 行为 + V3 行为 + 推荐保留哪个 + 用户调研 / 业务方接口稳定性论据 + 决议 + 实施 ticket 链接
- Effort: 12 × ~1h = 12h

### TKT-212 — 实施 ADR 接受的 V3 改善(若有 — 上方多数已 default 保留)
- Effort: 4h

总 22e effort: ~16h

---

## SPRINT 22f — P4 兼容 + 主题 + CSS state (~40h)

### TKT-250 — 状态 class 双向 sync (V3 BEM + V1 legacy)
- V3: `.is-active / .is-selected / .is-locked / .is-editing` (BEM)
- V1 caller CSS: `.selected / .locked / .editing / .alwaysHide` (legacy)
- 决策: **fix-bug** — ElementWrapper.vue + components 在 `:class` 同时输出两套 class 名(legacy + BEM),向后兼容 caller
- Effort: M (4h)
- DoD: `e2e/tests/state-class-bridge.spec.ts`

### TKT-251 — CSS variables 推广 + 主题 token
- V3: 5 vars on designer shell only
- 决策: **build-feature** — 把 toolbar / property / list / dialog 等模块的硬编码 hex 提为 vars
- Effort: M (8h)

### TKT-252 — Color palette V1 兼容选项
- V3: 默认 Ant Design;V1: Material
- 决策: **build-feature** — 加 `--hiprint-theme-v1` opt-in mode 还原 V1 颜色
- Effort: M (4h)

### TKT-253 — Context menu z-index 提高到 10000(V1 parity)
- V3: floating-ui natural;V1: 10000
- 决策: **fix-bug** — context-menu portal 强制 z-index 10000
- Effort: S (1h)

### TKT-254 — Toolbar `<select>` 加回为对 panel manager 备选方案
- TB-003 panel chip list 仍保留,但加 `panelManagerMode: 'chips' | 'select'` opt 让业务方选
- Effort: S (1h)

### TKT-255 — Dialog wrap class V1 兼容(business / template / save dialog)
- V3: 用 Ant Design Modal,丢 `hiprint-toolbar-business-dialog-wrap` 等 class
- 决策: **fix-bug** — Dialog SFC 加 V1 class 名(visual hidden ok,但 selector 可寻)
- Effort: M (2h)

### TKT-256 — print-lock.css 接入 V3 build (可选导入)
- V3 当前要求 caller 自带 print-lock.css
- 决策: **build-feature** — V3 可 export `import 'vue-plugin-hiprint/print-lock.css'` 供 caller 选择
- Effort: S (1h)

### TKT-257 — vue-admin-main upgrade-to-v3.md 重写
- 基于本 backlog 全部 P0/P1/P2 完成后,docs/upgrade-to-v3.md 重列 breaking changes + migration recipes
- Effort: M (4h)

### TKT-258 ~ TKT-265 — V3 missing/violation CSS class 表(231 个里 ~36 missing 全部 fix)
- 按 08-styles matrix 列出
- 每条 effort S
- 总 effort: ~10h

### TKT-266 — V3 加 setup.sh / Quick start docs
- Effort: S (2h)

总 22f effort: ~40h

---

## 总 effort 汇总

| Sprint | 主题 | Ticket count | Effort |
|---|---|---|---|
| 22a-r | Sprint 22a bug rollback (P0) | 12 | ~12h |
| 22b | 架构核心 fix (P0) | 8 | ~25h |
| 22c | 大功能补齐 (P1) | 28 (toolbarCtrl 10 + PrintTemplate 25 + 其他 ~13) | ~120h |
| 22d | UX (P2) | 21 | ~40h |
| 22e | Quirk ADR (P3) | 13 | ~16h |
| 22f | 兼容 + 主题 (P4) | ~17 | ~40h |
| **TOTAL** | | **~99 ticket** | **~253h** |

(原 INDEX 估的 293h 中 40h 来自冗余 ticket — 重新审视后聚合为 253h)

## Sprint 启动顺序 + 风险

1. **先 22a-r** — Sprint 22a 引入的 silent bug 用户立即可见,必须先回。**完成定义**: 用户验证 panel 编辑反映到 element 渲染 + JSON round-trip。
2. **22b 并行 22a-r** — 因 22b 是架构修复(history / render path / formatter / lock),与 22a-r 文件相对独立。
3. **22c 串行 22b** — toolbarCtrl + PrintTemplate compat 大批接入,depends on 22b 稳定。
4. **22d / 22e / 22f 并行** — UX 功能 + ADR + 主题独立。

## 监控指标

| 指标 | 当前 | 目标 (Sprint 22a-r + 22b 后) | 目标 (22c 后) |
|---|---|---|---|
| ⚠️ VIOLATION 行 | ~94 | < 10 | 0 |
| 🔴 MISSING 行 | ~370 | ~270 | < 50 |
| Property panel → element JSON round-trip 通过率 | 估 30% | 95% | 99% |
| V1 vs V3 e2e 行为对比 spec pass | 0/0 | 50/50 | 150/150 |
| typecheck + vitest pass | 1432 | 1500+ | 1600+ |
| toolbarCtrl method 覆盖 | 7% (3/42) | 7% (deferred) | 50% (21/42) |
| PrintTemplate method 覆盖 | 21% (14/67) | 21% (deferred) | 60% (40/67) |

## DoD: Playwright spec 录制模板

每个 fix-bug / build-feature ticket 必须包含一个对应 `e2e/tests/<feature>.spec.ts`。结构:

```ts
import { test, expect } from '@playwright/test'

test.describe('<TKT-NNN> <feature name>', () => {
  test('V1 expected behavior reproduced', async ({ page }) => {
    await page.goto('http://localhost:5173/?mode=v3')
    // setup: load V1 template JSON or interact
    // ... behavior
    // assert: V3 DOM matches V1 expected
    await expect(page.locator('.hiprint-printElement-text')).toHaveText('...')
    await expect(page.locator(... `[style*="..."]` ...)).toBeVisible()
  })

  test('round-trip JSON parity', async ({ page }) => {
    // load V1 JSON → render in V3 → getJson() → assert key by key
    const json = await page.evaluate(() => window.__tpl__.getJson())
    expect(json.panels[0].printElements[0].options.borderWidth).toBe(2)
  })
})
```

## 与 memoized-booping-hearth.md 废止说明

`C:\Users\12180\.claude\plans\memoized-booping-hearth.md` 已 **DEPRECATED**。所有未完成 ticket(Sprint 22b/22c/22d/22e) 被本 backlog **覆盖**且**重定向**:

- 原 SB-001/002/003 (sidebar drag-resize) → TKT-150
- 原 CV-006-010 (guide lines) → TKT-102
- 原 IT-007 (clipboard cut/paste/cut/前后置) → 已存在 + history 修 → TKT-020/078
- 原 IT-008 (Ctrl+C/V/X) → 已存在 + history fix → TKT-020
- 原 IT-009 (Bring-to-Front / Send-to-Back) → TKT-074
- 原 MP-004 (Panel name editable inline) → 已部分,加 TKT 入 22c
- 原 MP-005 (Panel reorder drag) → 现有 store.reorderPanel + 加 toolbar chip drag → TKT 入 22d
- 原 MP-007 (Pagination bar) → TKT-012 (rollback,V1 无此 bar)
- 原 IT-005 (Snap to guide lines) → TKT-102 + smart-guides TKT-103
- 原 IT-013 (Tab cycle) → TKT-165 ADR(决议保留 V3 改善)
- 原 MS-001 (Window resize) → 已在 V3
- 原 MS-002 (Mouse wheel zoom) → 入 22d 未列(低优先级)
- 原 I8-001-004 (i18n) → 未列(等业务方通知)

旧 ticket 全部已映射 → 本 backlog 现 99 个 ticket 即为新唯一权威来源。
