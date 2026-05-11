# V3-PARITY-MATRIX — 行为对照总览

> Phase 2 产出。基于 `docs/V1-INVENTORY/` 的 V1 行为穷举(8907 行),逐行对照 V3 当前实现,产出 deterministic gap 列表。Phase 3 的 Jira backlog 直接由本目录"⚠️ VIOLATION + 🔴 MISSING"行翻译而来。

## 评分图例

| 标记 | 含义 |
|---|---|
| ✅ DONE | V3 实现行为字节等价 |
| 🟡 PARTIAL | 部分实现,缺关键字段或边界 case |
| 🔴 MISSING | V3 完全无等价实现 |
| ⚠️ VIOLATION | V3 实现不同行为,需 rollback 或重做 |
| ⏸️ DEFERRED | 故意 out-of-scope (V3 ADR 显式标注) |

## 文件清单

| # | 文件 | LoC | Status markers | 关注重点 |
|---|---|---|---|---|
| 01 | [toolbar-and-shell.md](01-toolbar-and-shell.md) | 1254 | 852 | toolbar + 4 dialogs + keyboard + 23 export + 67 PrintTemplate methods + 76 buildToolbar opts + toolbarCtrl |
| 02 | [text-longtext.md](02-text-longtext.md) | 810 | 318 | text 57 fields + longText 44 fields + 14 / 3 factories |
| 03 | [image-html.md](03-image-html.md) | 604 | 244 | image 22 + html 18 fields + 7 XSS 向量 |
| 04 | [barcode-qrcode.md](04-barcode-qrcode.md) | 687 | 316 | Path A (JsBarcode/qrcode.js) vs Path B (bwip-js) 共存 |
| 05 | [shapes.md](05-shapes.md) | 595 | 183 | hline/vline/rect/oval 17-18 fields each |
| 06 | [table.md](06-table.md) | 1131 | 435 | 56 top + 32 column opts + 多层 header + 分页 + 合并单元格 |
| 07 | [interactions.md](07-interactions.md) | 1067 | 273 | 27 sections — 选择/拖动/调整/旋转/快捷键/剪贴板/历史 |
| 08 | [styles.md](08-styles.md) | 626 | 209 | 231 CSS classes 18 areas + z-index + 颜色 + 状态机 |
| | **TOTAL** | **6774** | **2830** | **~1300+ scored rows** |

## 核心发现汇总

### A. Sprint 22a 直接引入的真 bug (高优先级 rollback)

1. **🔴 Shape Property Panel key drift** — V3 ShapePropertyPanel 写 `strokeWidth/strokeColor/strokeStyle/fillColor`,SFC 与 render.ts 都读 V1 key `borderWidth/borderColor/borderStyle/backgroundColor`。**所有 shape 属性编辑被静默丢弃**。([05-shapes #G.1])
2. **🔴 Barcode/Qrcode Property Panel 7 of 9 key 全错** — `format` UPPERCASE vs renderer lowercase `barcodeType`; `errorCorrectionLevel='L'` vs `qrCodeLevel=int`; `lineColor` vs `barColor`; `displayValue` vs `hideTitle` (倒置); `padding/color/backgroundColor` 全未读。**Panel 全无效**。([04-barcode-qrcode #VIOLATION 2-4])
3. **🔴 Image/Html Property Panel 4 个 P0 silent-corruption** — `objectFit` vs `fit`; `transform` vs `rotate`; formatter signature mismatch; string-source formatter eval gap。([03-image-html P0])
4. **🔴 Default barcode/qrcode 工厂 preset 完全坏** — `defaultModule.barcode/qrcode/trackingNo` 用 Path A 数据形状 (`type:'text'+textType:'barcode'`),V3 只有 Path B renderer → 拖默认 preset 渲染纯文本。([04-barcode-qrcode #VIOLATION-1 CRITICAL])
5. **🔴 V3 引入新 XSS 路径** — `HtmlElement.vue:70-71` field-bound string → `v-html`,V1 此路径不存在。([03-image-html P0])
6. **🔴 Table Property Panel 4 个 invented field** — `rowsPerPage` / `maxPage` / `alternateRowColor` / `footer` 纯 raw HTML textarea — V1 全不存在,V3 写入是 dead-letter。([06-table 1-3])
7. **🔴 ShapePropertyPanel 暴露 rect `borderRadius` UI,但 RectElement 从不读** ([05-shapes #G.7])
8. **⚠️ toolbar 加了 V1 toolbar 没有的按钮**: PDF / Undo / Redo / RemovePanel / Grid toggle / Ruler toggle / Bring-to-Front / Send-to-Back / Lock / Unlock (V1 只在 contextmenu 或不存在) ([01-toolbar-and-shell VIOLATION 1])
9. **⚠️ Default paper 3-bug stack** — B3 丢、A3/A5/B5 width/height swap、所有 V1 fractional mm round。([01 VIOLATION 2])
10. **⚠️ TB-003 chip list / TB-006 pagination bar / paper select** — V1 不存在,Sprint 22a 加。([01 VIOLATION 6-8])

### B. 架构级缺失 (大功能)

11. **🔴 toolbarCtrl 整体删除** (3 of 42 方法,7%) — vue-admin-main imperative caller 完全 break。([01 §architectural])
12. **🔴 PrintTemplate compat 只覆盖 14 of 67 V1 方法 (21%)** — 缺 `rotatePaper/setPaper/alignElements/zoom/addPrintPanel/deletePanel/selectPanel/on/getElementByTid` 等。([01 §architectural])
13. **🔴 buildToolbar opts 30 of 76 (39%)** — 缺所有 dialog hooks + button text 自定义 + provider 模式。([01 §architectural])
14. **🔴 History 从不 auto-snapshot** — V3 `pushSnapshot()` 存在但 interaction 模块从未自动调用,Ctrl+Z 实际无效。([07-interactions HIGH #3])
15. **🔴 longText binary-search 分页缺失** — V3 显式 deferred,V1 旗舰功能。([02 #3])
16. **🔴 multi-page pagination + pageBreak/showInPage/fixed/lHeight 全缺** ([02 #7])
17. **🔴 dataType datetime/boolean + format 转换管线缺** → V1 `orderDate` factory 坏。([02 #8])
18. **🔴 formatter/styler 字符串源 `new Function()` 编译缺** — V3 只接函数,V1 接字符串(行为 narrowing)。([02 #6])
19. **🔴 Table 多层 header (columns[0]/[1]/[N]) + merge cells + column editor 全缺。** ([06 §D-H])
20. **🔴 V3 Table 有两套不一致 render path** (TableElement.vue Vue vs print/render.ts imperative),85% 字段在 round-trip 时静默腐蚀。([06 §architectural])

### C. UX 大功能缺失

21. **🔴 No element list panel ☰** (V1 整个 sidebar 隐藏触发) ([07 §16])
22. **🔴 No user-drawn guide lines (参考线)** — V1 整个 Section 17。([07 §17])
23. **🔴 No smart guides (snap to other elements)** — V1 有 18-case 吸附算法。([07 #7])
24. **🔴 No position cross-hairs during drag/resize** — V1 `createLineOfPosition`。([07 #6])
25. **🔴 No floating size readout + delete button on selected element** ([08 § UX])
26. **🔴 No sidebar resize / collapse** ([08 § UX])
27. **🔴 Paper page-number badge UI 缺** ([08 § UX])
28. **🔴 Element list 不高亮 canvas 已选元素** ([08 § UX])
29. **🔴 Table 列 drag-reorder 缺** ([06 § H])
30. **🔴 Ruler 拖动 handle 缺** (V1 用于精确定位) ([08 § UX])

### D. 安全 + 兼容

31. **🔴 toolbar/dialog/property/list/state-class 全 BEM 重命名** — caller 基于 `.hiprint-toolbar-btn / .selected / .editing / .locked` 等的 CSS override 全失效。([08 § Z1])
32. **🔴 Color palette: Material → Ant Design** — `#2196f3 → #1677ff` 等,caller 主题 override 全 break。([08 § U])
33. **⚠️ z-index regression** — V1 context menu z=10000,V3 靠 floating-ui body-portal 自然顺序,与 ant-design modal 叠加时风险。([08 § §3])
34. **✅ print compatibility 保留** — `src/hiprint-v3/print/render.ts` 输出 V1 wrapper class 名 (`hiprint-printPaper/Element*`),`print-lock.css` 不动可用。([08 ✓])

### E. 行为 quirks 必须保留 vs 改善

V1 quirks 总数:**150+ 项** (quirks 分布在每个 doc 的 J/P/Q section)。

**必须保留 (V3 现已 fix 但破坏 V1 muscle memory)**:
- Shift INVERTS aspect lock (V1 quirk,V3 industry-standard) — 决策 ADR 后再定 ([07 HIGH #1])
- Empty canvas click only deselect when `maxPanelIndex < 2` (V1 quirk,V3 总清空) ([07 #12])
- Arrow nudge 1.5pt 始终 (V1) vs V3 1pt + Shift=10pt ([07 #2])
- Ctrl+Z 在 `<input>` 内 (V1) vs V3 guards (V3 改善) ([07 #13])

**已 fix 但要文档化 (改善但 break compat)**:
- `defaultModule.html` naked formatter XSS (V3 drop formatter,UX 副作用:虚线 placeholder 没了) ([03 § XSS-4])
- 5 V1 image XSS 关掉 ([03 § XSS-5/6])

## Phase 3 设计原则

Phase 3 (Jira backlog rewrite) 将本 INDEX 的 34 个核心 finding 拆为 deterministic ticket。每个 ticket:

- 引 V1 file:line + V3 file:line 双向
- 决策类型: rollback / fix-bug / build-feature / write-ADR-then-decide
- e2e test 用 Playwright 录制 V1 行为对比 V3 行为 (visual + DOM 双断言)
- Sprint 排序: P0 (Sprint 22a 引入的 bug) → P1 (架构级缺失) → P2 (UX 大功能) → P3 (quirk 决策) → P4 (浮表 z-index / 主题等)

预计总修复:
- P0 rollback: ~12h (Sprint 22a 5 个 panel 全 key-drift fix + paper list rollback)
- P0 fix-bug: ~25h (history auto-snapshot, default factory paths, render path 收敛)
- P1 大功能: ~120h (element list panel / guide lines / smart guides / longText 分页 / multi-page)
- P2 UX: ~80h (sidebar resize / cross-hairs / size readout / del-btn / column reorder)
- P3 quirks ADR: ~16h (write 6 ADRs + 决策 fix or preserve)
- P4 兼容修复: ~40h (CSS state classes / 主题 token / toolbarCtrl 部分恢复)
- **TOTAL: ~293h** (远低于 toolbar agent 估的 555h — 因部分功能可 defer 或 cleanly drop)

## 与之前 plan 差异

| 维度 | memoized-booping-hearth.md (旧) | 本目录 + Phase 3 (新) |
|---|---|---|
| 来源 | 2 Explore agent 凭印象 | 8 V1 inventory docs (8907 行) + 8 parity matrix docs (6774 行) |
| 行数 | 单文件 ~300 行 | 总计 15681 行 + INDEX |
| Ticket 数 | 25 sprint ticket | ~150 deterministic ticket (1:1 对应 V1 row) |
| Sprint 22a 评估 | "完成 80% gap" (错) | 引入 10+ silent bug (matrix 确认) |
| 完成定义 | unit test pass | Playwright V1 vs V3 行为录制对比 |
| 漏修风险 | 高 (无 inventory) | 低 (mechanical 1:1 mapping) |
