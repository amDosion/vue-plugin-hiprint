# 工具栏 + 动态组件注入 架构地图

> 给业务集成方看的内部结构 + 扩展点速查。
>
> 主要源文件：`src/hiprint/hiprint.bundle.js`
> 公开 export：`src/index.js`
>
> 配套文档：
> - [`API-REFERENCE.md`](./API-REFERENCE.md) — API 速查
> - [`integration-guide.md`](./integration-guide.md) — 完整集成指南

---

## 一、工具栏架构（buildToolbar）

### 入口

| 调用方 | 位置 | 说明 |
|---|---|---|
| 直接调用 | `src/index.js` | `import { buildToolbar } from 'vue-plugin-hiprint'` |
| `buildDesigner` 内部 | `hiprint.bundle.js` | `var toolbarCtrl = buildToolbar($toolbarContainer[0], hiprintTemplate, opts.toolbarOptions || {})` |

签名：`buildToolbar(container: DOMElement, template: HiprintTemplate, options: object) → toolbarCtrl`

### 按钮清单（DOM 渲染顺序）

| 按钮 key | group key | opts 显示控制 | 主回调 | 默认行为 | 业务可控点 |
|---|---|---|---|---|---|
| `businessSelect` | `businessSelect` | `showBusinessSelect` | `onBusinessClick` 拦截 → `onBusinessDialogOpen/Close` → `onBusinessSelect` | 内置弹窗选择业务 | `businessListProvider` / `businessLoader` 替换数据源 |
| `templateSelect` | `templateSelect` | `showTemplateSelect` | `onTemplateDialogOpen/Close` → `onTemplateSelect/Preview/Edit/Delete` | 内置弹窗选择模板 | `templateListProvider` / `templateLoader` 替换数据源；`onTemplateDeleteConfirm` 自定义删除确认 |
| `paper:<name>` (各纸型) | `paper` | `showPaperSelect` + `paperTypes` | `onPaperChange(name, size)` | `template.setPaper(w, h)` | 替换 `paperTypes` 完全自定义纸型列表 |
| `paper:custom` | `paper` | `showCustomPaper` | `onPaperChange('custom', {w,h})` | popover 输入宽高后 `setPaper` | 仅控制显隐，UI 不可替换 |
| `scale:zoomOut` / `scale:zoomIn` | `scale` | `showScale` | `onScaleChange(value)` | `template.zoom(v)` | `scaleMin/Max/Step` 可配 |
| `rotate` | `rotate` | `showRotate` | `onRotate(template)` | `template.rotatePaper()` | `rotateButtonText` 改文本 |
| `align:*` (×8) | `align` | `showAlign` | `onAlign(type, template)` | `template.alignElements(type)` | 8 种对齐类型当前硬编码（计划暴露 `alignItems` 配置）|
| `preview` | `preview` | `showPreview` | `onPreview(template)` | **无默认行为**（必须传 onPreview） | 纯钩子 |
| `clear` | `clear` | `showClear` | `onClear(template)` | `confirm()` + `template.clear()` | 业务接管完全替换 |
| `print` | `print` | `showPrint` | `onPrint(template)` | **无默认行为** | 纯钩子 |
| `save` | `save` | `showSave` | `onSave(template, json, event, api, {name})` | 内置保存弹窗 → 无 onSave 时下载 JSON | `onSaveDialogOpen/Close` 拦截弹窗 |
| `extra:*` | `extra` | `extraButtons[]` | `btnOpt.onClick(template, event, api)` | 无 | `extraButtons[]` + `extraPosition: 'start'\|'end'` |

### 内部 state（每次 buildToolbar 独立闭包）

| 变量 | 类型 | 说明 |
|---|---|---|
| `_toolbarUid` / `_toolbarClickNs` | string | 实例唯一 namespace（基于 timestamp+random），用于 jQuery 事件精确绑/解绑 |
| `toolbarButtonRegistry` | `{key: {$el, groupKey}}` | 已注册按钮的 jQuery 引用 |
| `toolbarGroupRegistry` | `{groupKey: $group}` | 已注册分组的 jQuery 引用 |
| `scaleValue` | number | 当前缩放倍率 |
| `businessItems / templateItems` | object[] | 弹窗数据列表 |
| `$businessDialog / $templateDialog / $saveDialog` | jQuery\|null | 懒创建（首次打开时创建后复用）|
| `toolbarApi` | object | 传给所有回调的上下文 |
| `toolbarCtrl` | object | 对外返回值（toolbarApi 的公开代理）|

### toolbarCtrl API（构建后仍可调用）

| API | 用途 |
|---|---|
| `setButtonText(key, text, useHtml?)` | 改按钮文本（`useHtml` 默认 `false` 防 XSS）|
| `setButtonVisible(key, visible)` | 显隐单个按钮，自动级联 group 显隐 |
| `setButtonDisabled(key, disabled)` | 禁用/启用按钮 |
| `triggerButton(key)` | 代码触发按钮点击 |
| `setGroupVisible(groupKey, visible)` | 整组显隐 |
| `getButton(key) / getButtons()` | 获取 jQuery 按钮元素 |
| `getGroup(key) / getGroups()` | 获取 jQuery 分组元素 |
| `setScale(v) / getScale()` | 设置/读取缩放值 |
| `openBusinessDialog() / closeBusinessDialog()` | 命令式开关业务 Dialog |
| `setBusinessItems(list) / setBusinessListProvider(fn) / setBusinessLoader(fn)` | 业务数据源运行时替换 |
| `openTemplateDialog() / closeTemplateDialog()` / 同上 template 系列 | 模板 Dialog 控制 |
| `triggerSave(payload?)` | 触发保存（`{skipPrompt, name}` 跳过 Dialog）|
| `setDialogHandler(handlerKey, fn)` | 运行时替换 Dialog 生命周期回调 |
| `getToolbarElement()` | 获取 toolbar jQuery 元素 |
| `destroy()` | **必调**：解绑事件 + 清空 DOM 防内存泄漏 |

### Dialog 数据流（业务选择为例）

```
用户点 [业务选择]
  → onBusinessClick(template, toolbarApi) [可拦截 return false]
    → openBusinessDialog()
      → onBusinessDialogOpen(context) [可拦截]
        → openBusinessDialogDefault()
          → ensureBusinessDialog()  [懒创建 DOM]
          → refreshBusinessList()
            → opts.businessListProvider(template, toolbarApi) → Promise<item[]>
              → renderBusinessDialog() → DOM
用户点 [选择]
  → handleBusinessSelect(item)
    → opts.businessLoader(item, ...) [可选]
      → opts.onBusinessSelect(item, parsedData, template, toolbarApi)
        → closeBusinessDialog() [closeBusinessDialogOnSelect=true 时]
          → onBusinessDialogClose(context)
失败时
  → opts.onBusinessSelectError(err, item, template, toolbarApi) [可选]
  → closeBusinessDialog() [防卡死]
```

模板选择有完全对称的 `onTemplateClick / onTemplateDialogOpen / onTemplateSelect / onTemplateSelectError` 回调流。

---

## 二、动态组件注入架构

### 5 个入口 API 关系

| API | 签名 | 作用层 | 内部实现 |
|---|---|---|---|
| `hiprint.init({providers})` | `init(config)` | **初始化** | `providers[].addElementTypes(a.instance)` → `addPrintElementTypes(moduleName, groups)` |
| `setDynamicFields(moduleName, fieldGroups)` | `(string, FieldGroup[])` | **字段级** | `removePrintElementTypes` → `mapFieldGroupsToElementTypeGroups` → `addPrintElementTypes` |
| `setElementTypeGroups(moduleName, groups)` | `(string, Group[])` | **组级（全量替换）** | `removePrintElementTypes` → `normalizeElementTypeGroups` → `addPrintElementTypes` |
| `appendElementTypeGroups(moduleName, groups)` | `(string, Group[])` | **组级（追加）** | `normalizeElementTypeGroups` → `addPrintElementTypes`（不删旧）|
| `renameElementType(tid, title)` | `(string, string)` | **单元素改名** | `a.instance.updateElementType(tid, fn)` 就地修改 |

`componentPanelSlot`（buildDesigner 的 opts 字段）控制左侧面板的"动态字段"插槽位置。

### 核心数据结构 PrintElementTypeManager（单例 `a.instance`）

```
a.instance (PrintElementTypeManager 单例)
  ├── [moduleName]: PrintElementTypeGroup[]   ← 按 moduleName 分桶
  └── allElementTypes: PrintElementType[]     ← 所有 group 的 types 平铺缓存（已去重 by tid）
```

`addPrintElementTypes(moduleName, groups)`：把 groups 追加到 `[moduleName]` 桶 + 平铺到 `allElementTypes`（**已去重 by tid**，多次注入同 tid 会替换而非累积）。
`removePrintElementTypes(moduleName)`：删除该桶 + 从 `allElementTypes` 过滤掉 `tid.startsWith(moduleName)` 的项。

### 调用顺序约束

1. **必须先 `hiprint.init({providers})`**（providers 通过 `addElementTypes` 向 `a.instance` 注册）
2. **注入后必须 `designerCtrl.rebuildComponentPanel(moduleName?)`** 重绘面板 DOM（`setXxx` 仅改内存）

### 扩展数据流

```
业务方调 setDynamicFields / setElementTypeGroups / appendElementTypeGroups
  → a.instance.removePrintElementTypes(moduleName)   [set* 系列先清]
  → a.instance.addPrintElementTypes(moduleName, groups)
      → a.instance[moduleName] = groups
      → a.instance.allElementTypes 去重后追加

业务方调 designerCtrl.rebuildComponentPanel(moduleName)
  → $componentContainer.empty()
  → it.setPanelSlot(opts.componentPanelSlot)   [若配置了动态字段插槽]
  → it.build($componentContainer, moduleName)
      → it.getElementTypeGroups(moduleName)   [从 a.instance 读分组]
      → createPrintElementTypeHtml(...)        [渲染 DOM]
      → it.enableDrag(...)                     [绑定拖拽事件]
```

### componentPanelSlot 插槽机制

`buildDesigner` 的 `opts.componentPanelSlot` 字段或 `designerCtrl.setComponentPanelSlot(slotOptions)` 可在面板中插入动态字段虚拟分组：

```js
{
  enabled: true,
  moduleName: 'commonModule',     // 从哪个 module 取动态字段
  anchorGroupName: '辅助',         // 插入到该 group 之后（不填则追加末尾）
  groupName: '动态字段',
  emptyTip: '暂无动态字段'
}
```

插槽数据来源独立于 `setDynamicFields`：读取 `a.instance[moduleName]` 中标记 `isDynamic` 的类型。

---

## 三、错误处理 / 可见性约定

### 工具栏回调 try-catch

`onPreview / onPrint / onClear` / Dialog handlers 全部 try-catch 隔离：
- 业务回调抛错 → `console.error('[hiprint] xxx threw:', err)` 但不冒泡
- UI 仍能正常运行（不卡死）
- 业务方可选注册 `onBusinessSelectError / onTemplateSelectError` 接收错误事件

### 销毁清理

`buildDesigner.destroy()` + `tpl.destroy()` 必须在 Vue `onBeforeUnmount` 调用，否则：
- toolbar 全局 click handler 累积（每次 buildDesigner 1 个）
- panel 事件订阅累积
- 元素列表面板 DOM 闭包持有 panel 引用 → GC 无法回收
- HiPrintlib 单例 map 持续增长

详见 [`API-REFERENCE.md`](./API-REFERENCE.md) 的"完整集成示例"章节。

---

## 四、扩展点 gap 已知列表

以下能力业务方目前需要 monkey-patch 才能实现，**未来版本将暴露官方 API**：

| 优先级 | 能力 | 当前 workaround |
|---|---|---|
| HIGH | align 按钮子集配置（仅显示部分对齐类型）| 需 monkey-patch buildToolbar.opts |
| HIGH | 自定义清空确认弹窗（异步 onClearConfirm 钩子）| 完全接管 `onClear`，丢失默认 `template.clear()` |
| HIGH | 自定义纸张 popover UI 替换 | 监听 `onPaperChange('custom', ...)` 后自己调 setPaper |
| MED | 单组移除（appendElementTypeGroups 后只能整 module 级 remove）| 整 module 级 setElementTypeGroups 重设 |
| MED | renameElementType 不可撤销 | 无（保留原始 title 自己存）|

---

## 五、关键文件位置速查

| 关键位置 | 文件 |
|---|---|
| `buildToolbar` 函数定义 | `src/hiprint/hiprint.bundle.js` |
| `toolbarApi / toolbarCtrl` 对象定义 | 同上 |
| `buildDesigner` 函数定义 | 同上 |
| `setDynamicFields / setElementTypeGroups / appendElementTypeGroups / renameElementType` | 同上 |
| `PrintElementTypeManager.addPrintElementTypes / removePrintElementTypes` | 同上 |
| `PrintElementTypeManager.build / setPanelSlot` | 同上 |
| `designerCtrl.rebuildComponentPanel` | 同上 |
| `hiprint.init`（mt 函数）| 同上 |
| 所有公开 export | `src/index.js` |
| 默认元素类型 provider | `src/hiprint/etypes/default-etyps-provider.js` |
