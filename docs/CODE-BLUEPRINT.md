# hiprint.bundle.js 代码导航 + 实现 Blueprint

> 给"接管者"用：从零理解 15147 行单文件 bundle.js 的代码地图。
> 假设读者：懂 Vue 3 + jQuery，但不熟 hiprint。
>
> 配套：[`CODEMAPS/`](./CODEMAPS/) 各模块详细 codemap、[`TOOLBAR-ARCHITECTURE.md`](./TOOLBAR-ARCHITECTURE.md) 工具栏专用、[`API-REFERENCE.md`](./API-REFERENCE.md) 公开 API 速查。

---

## 一、代码区域索引（22 块）

| 行号范围 | 区域名 | 职责 |
|---|---|---|
| 1-97 | 模块头 / 依赖导入 | `"use strict"` + 所有 npm 依赖 import + `i18n` 国际化对象初始化 |
| 97-143 | Webpack 运行时 shim | 模拟 `require`/`define`/`n.d` 等 CommonJS 运行时，整个 bundle 的自执行框架 |
| 144-382 | `hinnn` 工具对象 | 全局工具库：事件总线 `hinnn.event`、单位换算 `hinnn.px/pt/mm`、throttle/debounce、日期/数字格式化、中文大写金额 |
| 383-541 | `HiPrintConfig` + `HiPrintlib` 单例 | 全局配置 + `printTemplateContainer` 注册表 + GUID 生成 |
| 542-654 | `PrintElementOption` | 元素坐标/尺寸 Value Object，`getRectInfo()` 旋转包围盒计算 |
| 655-1652 | **`BasePrintElement`（核心基类）** | 拖拽 (`design`/`hidraggable`)、选中 (`getDesignTarget`)、属性提交 (`submitOption`)、键盘移动、复制粘贴、`getHtml`/`getHtml2` 生成打印 DOM、`getData` 取字段值 |
| 1653-1893 | 表格内编辑器 | 单元格行内 `text editor`/`select editor` + `HiTableColumn` 表头列名编辑 |
| 1894-2398 | `TableExcelHelper` | 静态工具：`<thead>/<tbody>/<tfoot>` 生成 / 列宽分配 / 多层表头展平 / 行分组汇总 / barcode/qrcode/image 内嵌 |
| 2399-2540 | `PrintReferenceElement` + 属性选项 Item Manager | 翻页计算位置 + 单例管理所有属性控件 |
| 2540-6170 | 属性面板选项控件集 | `lineHeight/fontSize/fontWeight/textAlign/borderStyle/tableBorder/widthHeight/formatter` 等数十个控件，每个 4 方法：`createTarget/getValue/setValue/css` |
| 6171-8876 | `TablePrintElement` + `HiTable` | 表格元素子类（覆盖 `createTarget/getHtml/getDesignTarget`）+ 设计时右键菜单（插行/删列/合并）|
| 8877-9182 | `PrintElementTypeManager` + `PrintElementType` | 单例管理可拖拽元素类型注册/查询；`PrintElementType` 类 `h`（普通）和 `ctable`（表格）；`createPrintElementTypeHtml` 渲染左侧组件面板 |
| 9183-9265 | `ImagePrintElement` (`v`) | 图片渲染 + base64 转换 |
| 9266-9935 | `LongTextPrintElement` (`w`) | 长文本，含分页计算（逐行分割至剩余高度）|
| 9936-10103 | `TextPrintElement` (`D`) | 普通文本 + `updateTargetText` + barcode/qrcode 文本类型内联渲染 |
| 10103-10600 | `HtmlPrintElement` / `VLine` / `HLine` / `Rect` / `Oval` / `Barcode` / `QRCode` | 各辅助图形 + 码类元素 |
| 10600-10712 | `PrintElementTypeGroup` + `PrintPanelEntity` | 分组注册 + 面板序列化 Value Object |
| 10712-11100 | `PrintPanel` 上半 | 构造/`design`/`droppablePaper`(drop)/`initPrintElements`/键盘快捷键/多选框选 |
| 11100-12103 | `PrintPanel` 下半 | `getPanelEntity`(序列化)/`getHtml`(打印)/`alignElements`/`update`(undo-redo)/`deletePrintElement` |
| 12103-12243 | `PrintPaginationCreator` + `OptionSettingPanel` | 底部分页栏 + 右侧属性面板 |
| 12244-13107 | **`PrintTemplate` (`ct`) 主类** | 多 `PrintPanel` 管理 + `design/print/getJson/update/undo/redo/destroy` + `_assertNotDestroyed` 守卫 helper + 历史栈 + 自动保存 |
| 13108-14657 | **`buildToolbar` 函数** | 工具栏构造：`_toolbarUid` + `_safeCall` helper + 纸张/缩放/旋转/对齐/预览/打印/保存/分页管理；返回 `toolbarCtrl` |
| 14658-14952 | **`buildDesigner` 函数** | 设计器工厂：`_designerUid` + 三栏布局 + 初始化 `PrintTemplate` + 调 `buildToolbar`；返回 `designerCtrl` |
| 14953-15147 | 入口 `mt` (hiprint.init) + 公开导出 | `hiprint.init`、`PrintTemplate`、`buildToolbar`、`buildDesigner`、`print`、`getHtml` 等对外挂载 |

---

## 二、关键类继承关系

```
BasePrintElement (655)
├── ImagePrintElement       v  (9203)  — 图片
├── LongTextPrintElement    w  (9697)  — 长文本，覆盖 getHtml 做行级分页
├── TextPrintElement        D  (9937)  — 普通文本/barcode/qrcode 文本模式
├── HtmlPrintElement        S  (10103) — 富文本
├── VLinePrintElement       F  (10159) — 竖线
├── HLinePrintElement       A  (10200) — 横线
├── RectPrintElement        k  (10240) — 矩形
├── OvalPrintElement        V  (10280) — 椭圆
├── BarcodePrintElement   barcode (10299) — JsBarcode
├── QRCodePrintElement   qrcode (10367) — bwip-js
└── TablePrintElement      (6206) — 覆盖 getDesignTarget/createTarget/getHtml

PrintElementOption (553)
└── TablePrintElementOption — 扩展 columns 字段
```

---

## 三、5 个核心数据流场景

### 1. 拖入元素 → DOM

```
左侧面板 .ep-draggable-item[tid]
  → PrintElementTypeManager.enableDrag.onBeforeDrag
      → getElementType(tid).createPrintElement()
      → HiPrintlib.setDragingPrintElement(ele)
  → onDrop (hidroppable, 11164)
      → getDragingPrintElement() 取 ele
      → ele.updateSizeAndPositionOptions(left, top)
      → PrintPanel.appendDesignPrintElement(designPaper, ele)
          → ele.getDesignTarget(paper) → jQuery DOM
          → paper.append(DOM)
      → ele.design(opts, paper)  // 绑定 hidraggable/hireizeable
```

### 2. 业务数据替换 → 打印渲染

```
ct.print(data) → ct.getHtml(data) → ct.getSimpleHtml(data)
  → PrintPanel.getHtml(data)
      → 对每个 printElement 调 el.getHtml(paper, data)
          → el.getData(data)         // field.split('.').reduce 取值
          → formatter && formatter(val, options, data)
          → el.createTarget(title, val)  // 生成 jQuery DOM
          → el.css(target, val)          // 写样式
  → 返回完整 <div class="hiprint-printTemplate">
  → .hiwprint(opts) 触发浏览器打印
```

### 3. Undo / Redo

```
Ctrl+Z → $(document).keydown
  → hinnn.event.trigger("hiprintTemplateDataShortcutKey_" + templateId, "undo")
  → ct 监听器 (initAutoSave 内)
      → historyPos--
      → ct.update(historyList[historyPos].json)
          → 每个 PrintPanel.update(panelEntity)
              → initPrintElements(panelEntity.printElements)  // 重建元素
              → 每个元素 el.design(opts, paper)
```

### 4. destroy

```
ct.destroy() (12458)
  1. _destroyed = true
  2. hinnn.event.off("hiprintTemplateDataChanged_"+id) 等 4 个事件
  3. printPanels.forEach → panel.clear() → el.designTarget.remove()
  4. HiPrintlib.removePrintTemplateById(id)
  5. container.empty()
  6. 解引用 printPanels/historyList

注：destroy 后,所有公开方法通过 `_assertNotDestroyed(name)` (12439)
统一返回安全 fallback (undefined / 空 PrintTemplateEntity / 空 jQuery),
不再各处重复 `if (this._destroyed) return ...`。
```

### 5. 模板序列化 getJson

```
ct.getJson() (12423)
  → printPanels.forEach → panel.getPanelEntity(withType=true) (11125)
      → printElements.forEach → el.getPrintElementEntity(true)
          → { tid?: string, options: PrintElementOptionEntity, printElementType: {type, title} }
  → 返回 PrintTemplateEntity { panels: [ {
      index, width, height, paperType, paperHeader, paperFooter,
      printElements:[...], watermarkOptions, guideLines, ...
    } ] }
```

---

## 四、新开发者最该读的 5 个函数

读完这 5 个函数，整个 hiprint 设计原理基本理清：

### 1. `BasePrintElement.prototype.getDesignTarget` (735)
绑定 click 选中、dblclick 行内编辑 — 元素进入设计画布的唯一入口。读懂它才能理解"选中"和"属性面板联动"的事件链。

### 2. `BasePrintElement.prototype.getData` (1263)
`field.split('.').reduce(...)` 一行决定字段取值规则（支持嵌套路径）。是"数据绑定"的最小核心。

### 3. `PrintPanel.prototype.droppablePaper` (11164)
drop 事件完整处理：坐标换算（px→pt→缩放补偿）、元素挂载、触发历史记录。理解它 = 理解拖放全流程。

### 4. `PrintPanel.prototype.getHtml` (11004)
打印渲染主流程：按 top 排序 → 计算翻页 → 调每个元素的 `getHtml`。是"设计 → 打印"转化枢纽。

### 5. `PrintTemplate.prototype.destroy` (12458)
4 步 teardown 顺序（事件→DOM→注册表→引用）展示整个对象图的生命周期。读懂它能快速定位所有资源持有点，对 Vue 路由复用场景尤为关键。

### Bonus: 两个新加的 helper

- **`PrintTemplate.prototype._assertNotDestroyed(name)` (12439)** —
  统一 destroy 守卫：`if (this._assertNotDestroyed('getJson')) return new st({panels:[]})`。
  替代分散在每个公开方法的 `if (this._destroyed) return ...` 逻辑，所有方法行为一致。
- **`_safeCall(fn, args, name)` (13118, buildToolbar 内部)** —
  统一业务回调隔离：`_safeCall(opts.onPreview, [template], 'onPreview')`。
  catch 业务方异常 + console.error 带 `[hiprint]` 前缀，避免单个回调抛错炸掉整个工具栏点击链。

---

## 五、相关文档导航

- 整体公开 API：[`API-REFERENCE.md`](./API-REFERENCE.md)
- 工具栏深入：[`TOOLBAR-ARCHITECTURE.md`](./TOOLBAR-ARCHITECTURE.md)
- 业务集成 + 设计器构建：[`integration-guide.md`](./integration-guide.md)
- 模块级 codemap：[`CODEMAPS/INDEX.md`](./CODEMAPS/INDEX.md)
- 升级 tgz 后回归验证：[`SMOKE-TEST.md`](./SMOKE-TEST.md)
- E2E 测试套件：`/e2e/` (`npm run test:e2e`)
