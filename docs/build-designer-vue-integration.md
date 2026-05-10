# buildDesigner Vue 集成修复说明

## 背景

`vue-admin-main` 的 `/tools/print-template` 页面通过 `hiprint.buildDesigner(container, options)` 创建设计器。
此前 `buildDesigner` 内部使用固定全局 ID 初始化设计器核心区域：

- `#hiprintEpContainer`：左侧组件面板
- `#hiprint-printTemplate`：中间画布
- `#PrintElementOptionSetting`：右侧属性面板

这些选择器是页面全局匹配的。在 Vue 页面中，如果发生组件重建、路由缓存、预览实例并存或多设计器实例并存，jQuery 可能绑定到旧节点或其他实例节点，导致拖拽源、画布和属性面板不属于同一个设计器实例。

直接表现是：左侧组件看似存在，但拖不进画布，或者拖拽后属性面板、分页、画布状态错位。

## 修复原则

修复位置必须在 `vue-plugin-hiprint` 源码侧完成，主业务项目只消费重新打包后的 `vue-plugin-hiprint.tgz`。

不要在业务项目里通过延迟初始化、重复查询全局 ID、手动移动 DOM、或者兼容旧 ID 的方式修补。那会继续保留跨实例污染风险。

## 代码修改点

源码文件：

- `src/hiprint/hiprint.bundle.js`
- `src/hiprint/css/hiprint.css`

核心修改：

1. `buildDesigner` 每次创建实例时生成独立 `designerId`。
2. 左侧组件容器、中间画布容器、右侧属性容器改为实例级 DOM。
3. 初始化时直接传 DOM 引用，不再传全局选择器：
   - `it.build($componentContainer[0], opts.componentModule)`
   - `new ct({ settingContainer: $optionSettingContainer[0], paginationContainer: $paginationContainer[0], ... })`
   - `hiprintTemplate.design($printTemplateContainer[0], {})`
4. `rebuildComponentPanel` 只清理当前实例的 `$componentContainer`。
5. 分页选择逻辑从全局 `.hiprint-pagination` 改为当前 `jqPaginationContainer.find(...)`。
6. 属性容器样式从 `#PrintElementOptionSetting` 改为 `.hiprint-option-setting-container`。

## 主项目同步边界

业务项目不应该承载拖拽根因修复，只需要消费插件产物：

1. 在 `vue-plugin-hiprint` 中执行：

```bash
npm run pack:fixed
```

2. 将生成的包同步到业务项目：

```powershell
Copy-Item -LiteralPath E:\Source_code\vue-plugin-hiprint\vue-plugin-hiprint.tgz -Destination E:\Source_code\vue-admin-main\backend\print\vue-plugin-hiprint.tgz -Force
```

3. 在业务项目前端重新安装本地包：

```bash
pnpm ensure:hiprint
```

业务项目里如有针对旧属性容器 ID 的样式，应改为 `.hiprint-option-setting-container`。这不是拖拽修复逻辑，只是插件 DOM 类名变化后的样式选择器同步。

## 验证方式

在 `vue-plugin-hiprint`：

```bash
npm run pack:fixed
```

在 `vue-admin-main/frontend`：

```bash
pnpm ensure:hiprint
pnpm ts:check
pnpm build:dev
```

静态检查不应再出现旧的设计器全局绑定：

```bash
rg "#hiprintEpContainer|#hiprint-printTemplate|#PrintElementOptionSetting|id=\"hiprintEpContainer\"|id=\"hiprint-printTemplate\"|id=\"PrintElementOptionSetting\"" node_modules/vue-plugin-hiprint/dist
```

## 回归关注点

- 左侧组件可以拖到中间画布。
- 多次进入、退出 `/tools/print-template` 后仍可拖拽。
- 重建组件面板后，左侧组件仍绑定到当前设计器。
- 点击画布元素后，右侧属性面板显示当前元素属性。
- 增加/切换分页时，不影响其他页面或其他设计器实例。

