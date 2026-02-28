# hiprint.bundle.js 功能抽离实施文档（确保功能与样式不变）

## 1. 背景与目标

当前 `src/hiprint/hiprint.bundle.js` 是一个约 1.16 万行的混合文件，包含：

- 顶层 ESM `import`
- 内部 webpack 模块运行时
- 核心业务逻辑（模板设计、渲染、打印、Socket 通信）
- jQuery 插件（拖拽/缩放/右键菜单）
- 内联样式注入（style-loader）

本次抽离目标：

1. 仅拆分文件与模块边界，不改变运行行为。
2. 页面样式、打印样式、交互样式保持一致。
3. 对外 API 保持不变（包含导出、全局对象、副作用时机）。
4. 支持按阶段回滚，避免一次性大改导致不可控风险。

不在本次范围：

- 不做功能增强。
- 不做参数默认值重构。
- 不做 className/style 命名清理。
- 不做 TypeScript 重写。

---

## 2. 现状分析（关键约束）

### 2.1 顶层副作用（必须保序）

`src/hiprint/hiprint.bundle.js` 顶部存在全局注入与 i18n 加载：

- `window.$ = window.jQuery = $`
- `window.autoConnect = true`
- `window.io = io`
- `require.context("../i18n", true, /\.json$/)`

这些逻辑在初始化阶段即执行，拆分后必须保留同样执行时机。

### 2.2 内联样式注入（必须保序）

入口逻辑会主动加载样式模块（类似 `n(22), n(23), n(24), n(25)`），并通过 style-loader 注入一段 `.hicontextmenu` CSS。

结论：

1. 不能只依赖 `src/hiprint/css/hiprint.css`，否则右键菜单样式会丢失。
2. 抽离后需显式保证该 CSS 与现有样式的加载顺序一致。

### 2.3 对外 API（必须完全一致）

现有导出必须不变：

- `hiprint`
- `defaultElementTypeProvider`
- 以及 `hiprint` 对象上的方法与类（`init`、`setConfig`、`PrintTemplate`、`print`、`print2` 等）。

### 2.4 全局对象（必须保留）

当前运行依赖如下全局对象：

- `window.hinnn`（event、工具函数）
- `window.hiwebSocket`
- `window.hiLocalStorage`

拆分后这些对象名和生命周期不能改变。

---

## 3. 拆分原则（强约束）

1. **先搬运，后整理**：第一阶段仅“代码位置变化”，不改语义。
2. **先副作用外围，后核心对象**：先拆工具层、插件层，再拆模板/元素核心层。
3. **保持入口单点**：外部仍从 `src/hiprint/hiprint.bundle.js`（或同名适配层）进入。
4. **每阶段可回退**：每次只做一类模块，失败可快速回滚。
5. **样式快照对比**：每阶段结束必须跑样式回归。

---

## 4. 目标目录结构

建议新增目录（示例）：

```text
src/hiprint/
  core/
    boot.js                    # 顶层副作用与初始化桥接
    i18n.js
    globals.js                 # window.$ / window.io / autoConnect
    api.js                     # 组装最终 hiprint 对外 API
  runtime/
    webpack-runtime-compat.js  # 仅迁移期可用，最终可删除
  infra/
    event-bus.js               # hinnn.event 与工具函数
    storage.js                 # hiLocalStorage
    websocket.js               # hiwebSocket
  plugins/
    jquery.hidraggable.js
    jquery.hidroppable.js
    jquery.hireizeable.js
    jquery.hicontextMenu.js
    qrcode.js
    watermark.js
    jquery.hiwprint.js
  elements/
    base/
      BasePrintElement.js
      PrintElementOption.js
    text/
      TextPrintElement.js
      LongTextPrintElement.js
      HtmlPrintElement.js
    media/
      ImagePrintElement.js
      BarcodePrintElement.js
      QrcodePrintElement.js
    table/
      TablePrintElement.js
      TableColumn.js
      TableExcelHelper.js
  template/
    PrintPaper.js
    PrintPanel.js
    PrintTemplate.js
  manager/
    PrintElementTypeManager.js
    PrintElementTypeGroup.js
  styles/
    hicontextmenu.css          # 从 bundle 内联 CSS 原样提取
```

说明：

- 上述命名可按团队偏好微调，但层次建议保持：`infra -> elements/template -> api`。
- 迁移期间允许保留 `runtime/webpack-runtime-compat.js` 作为临时兼容层，最后阶段删除。

---

## 5. 分阶段实施方案

## Phase 0：基线冻结（必须先做）

目标：建立“改动前”行为与样式基准。

执行：

1. 建立回归场景（见第 7 节）。
2. 记录关键页面截图（设计态 + 预览态 + 打印预览）。
3. 记录关键 API 输出样例（`getJson` / `getJsonTid` / `getHtml`）。
4. 记录网络行为（socket 连接、打印回调事件）。

产出：

- `docs/hiprint-regression-baseline.md`
- 基线截图目录 `res/regression/baseline/*`

通过标准：

- 所有基线样例可重复运行。

---

## Phase 1：入口与副作用分离（低风险）

目标：拆出顶层副作用，不动核心实现。

执行：

1. 新建 `core/globals.js`，迁移：
   - `window.$ = window.jQuery = $`
   - `window.autoConnect = true`
   - `window.io = io`
2. 新建 `core/i18n.js`，迁移 `require.context` 与 `i18n` 对象。
3. 新建 `core/boot.js` 聚合副作用初始化。
4. 原 `hiprint.bundle.js` 保持导出不变，仅改为调用 `core/boot.js`。

约束：

- 不能延迟执行 `boot`。
- 不能改 `lang` 默认值。

通过标准：

- 对外 API 无变更。
- 初始化日志与连接行为一致。

---

## Phase 2：样式抽离（关键）

目标：把 bundle 内联 `.hicontextmenu` 样式抽到独立 CSS，保持 100% 一致。

执行：

1. 从 bundle 中提取 `.hicontextmenu` 原文，保存为 `src/hiprint/styles/hicontextmenu.css`。
2. 在入口中显式引入该 CSS，加载顺序固定为：
   1. `hicontextmenu.css`
   2. `src/hiprint/css/hiprint.css`
   3. `src/hiprint/css/print-lock.css`
3. 删除内联 style-loader 模块的依赖链（迁移完成后）。

约束：

- CSS 文本不改动（包括空格、边框、字号、hover）。
- 不调整 class 名称。

通过标准：

- 右键菜单样式像素级对比一致。
- 打印样式与屏幕样式不受影响。

---

## Phase 3：基础设施模块拆分（中低风险）

目标：拆出独立基础能力模块。

执行：

1. `hinnn.event` 与工具方法迁移到 `infra/event-bus.js`。
2. `hiLocalStorage` 迁移到 `infra/storage.js`。
3. `hiwebSocket` 迁移到 `infra/websocket.js`。
4. jQuery 插件迁移到 `plugins/*`，按依赖顺序加载：
   - `hidraggable` -> `hidroppable` -> `hireizeable` -> `hicontextMenu`

约束：

- 事件名不改。
- socket 回调事件名不改（`printerList`、`clients`、`ippPrinterCallback` 等）。

通过标准：

- 打印客户端连接与回调正常。
- 设计区拖拽、缩放、吸附逻辑无差异。

---

## Phase 4：元素体系拆分（中风险）

目标：拆分 `BasePrintElement` 及各元素类型。

执行：

1. 抽出 `BasePrintElement` 与通用 Option。
2. 按元素类型拆文件：
   - 文本、长文本、HTML
   - 图片、条码、二维码
   - 表格与表格辅助类
3. 保留原有原型链、默认配置读取路径、formatter/styler 调用时机。

约束：

- `getHtml/getHtml2` 分页逻辑不改。
- `designTarget` 交互行为不改。
- `updateSizeAndPositionOptions` 触发时机不改。

通过标准：

- 各元素设计态与打印态一致。
- 表格分页、合并单元格、表头表脚行为一致。

---

## Phase 5：模板与管理器拆分（中风险）

目标：拆 `PrintPaper/PrintPanel/PrintTemplate` 与类型管理器。

执行：

1. `PrintPaper`、`PrintPanel`、`PrintTemplate` 拆分为独立模块。
2. `PrintElementTypeManager/Group` 拆分到 `manager/`。
3. 统一在 `core/api.js` 中装配 `hiprint` 对象。

约束：

- `hiprint.init`、`setConfig`、`print/print2/getHtml` 签名不变。
- `document.ready` 中 autoConnect 逻辑不变。

通过标准：

- demo 的设计、预览、打印、直接打印都通过。

---

## Phase 6：兼容层收敛与清理（收尾）

目标：去掉临时兼容代码，保持对外不变。

执行：

1. 删除不再需要的 webpack runtime 兼容代码。
2. 保留 `src/hiprint/hiprint.bundle.js` 作为对外稳定入口（可仅做 re-export）。
3. 更新文档与注释。

通过标准：

- 构建产物与导出 API 一致。
- 所有回归项通过。

---

## 6. 功能不变保障清单

每次提交必须核对：

1. `window.hiprint` 可用，且关键方法存在。
2. `hiprint.init` 后 provider 能正常注册元素。
3. `PrintTemplate.design` 可拖拽新增元素。
4. 元素移动/缩放/旋转/键盘微调可用。
5. `print` 与 `print2` 行为一致。
6. `getHtml` 输出结构与原来一致。
7. `setConfig` 合并逻辑（tabs/supportOptions）一致。
8. `autoConnect/disAutoConnect` 行为一致。

---

## 7. 样式不变保障清单

至少覆盖以下视觉点：

1. 设计器画布尺寸、网格、标尺、水印。
2. 选中态边框、resize 面板、辅助线。
3. 右键菜单样式（`.hicontextmenu`）。
4. 表格边框模式（全边框/左右/上下/无边框）。
5. 打印预览页页码、页眉页脚线位置。
6. `print-lock.css` 在 `media=print` 场景效果。

建议：

- 对关键页面做截图对比（同分辨率、同缩放）。
- 打印预览使用相同浏览器版本进行比对。

---

## 8. 回归用例矩阵（最小集合）

### A. 基础交互

1. 拖入文本元素，修改字体/对齐/边框/背景色。
2. 拖入图片元素，触发 `onImageChooseClick`。
3. 拖入条码、二维码并打印预览。

### B. 表格复杂场景

1. 多列、多行、分页。
2. 合并单元格后分页。
3. 表头重复、表脚显示、行高列宽调整。

### C. 模板能力

1. 缩放、撤销、重做。
2. 多选对齐、均分、分布。
3. 复制粘贴、键盘位移、删除。

### D. 连接与打印

1. `autoConnect` 默认连接。
2. `disAutoConnect` 后不自动连接。
3. `refreshPrinterList/getClients/getAddress` 事件回调正常。
4. `ippPrint/ippRequest` 回调正常。

### E. 多语言

1. `lang=cn/en` 切换后 UI 文案正常。

---

## 9. 提交与回滚策略

建议一个 Phase 一个 PR，提交粒度如下：

1. `refactor(hiprint): extract boot and globals`
2. `refactor(hiprint): extract contextmenu css without style change`
3. `refactor(hiprint): extract websocket and storage infra`
4. `refactor(hiprint): split base element and element types`
5. `refactor(hiprint): split template and manager layers`
6. `chore(hiprint): remove temporary runtime compat`

回滚策略：

- 任一阶段出现样式/行为偏差，直接回滚当前阶段 PR，不跨阶段修补。
- 保持主干始终可发布。

---

## 10. 风险清单与规避

1. **风险：副作用执行时机变化**
   - 规避：`boot.js` 在入口第一时间执行，不延迟加载。

2. **风险：菜单样式丢失**
   - 规避：优先完成 Phase 2，并加入视觉回归。

3. **风险：jQuery 插件加载顺序错乱**
   - 规避：插件入口文件显式按顺序 import。

4. **风险：全局对象名变化导致第三方调用失败**
   - 规避：保留原全局名称并增加兼容测试。

5. **风险：表格分页算法回归**
   - 规避：Phase 4 单独做表格专项回归。

---

## 11. 验收标准（最终）

必须全部满足：

1. 对外 API 与使用方式不变（README 示例可直接运行）。
2. 主要 demo 页面交互行为与原版本一致。
3. 样式视觉对比无显著差异，打印效果一致。
4. 构建通过，`dist` 可正常发布。
5. 文档与迁移说明完整。

---

## 12. 推荐实施顺序（简版）

1. Phase 0 基线冻结  
2. Phase 1 入口副作用拆分  
3. Phase 2 样式抽离  
4. Phase 3 基础设施拆分  
5. Phase 4 元素体系拆分  
6. Phase 5 模板与管理器拆分  
7. Phase 6 清理收敛

以上顺序的核心是：先保样式、再拆逻辑、最后做收敛。

