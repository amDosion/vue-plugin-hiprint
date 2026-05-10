# vue-plugin-hiprint Codemaps

**Last Updated:** 2026-05-10

vue-plugin-hiprint 是 Vue 3 + Vite 的打印设计/预览库，基于 hiprint 2.5.4 深度定制。本 codemaps 覆盖核心模块、关键类、API 导出、工具栏架构及 UX 改进。

## 模块地图

| Area | Entry | Status | Lines |
|------|-------|--------|-------|
| [Bundle / Core](./core-bundle.md) | `src/hiprint/hiprint.bundle.js` | v1.0.0 | ~15000 |
| [Public API](./api-exports.md) | `src/index.js` | v1.0.0 (23 exports) | ~142 |
| [Toolbar](./toolbar-architecture.md) | `buildToolbar` in bundle | v1.0.0+ segmented panel manager | ~1200 |
| [Designer Shell](./designer-shell.md) | `src/standalone/designer-shell.vue` | v1.0.0 (dev entry) | ~350 |
| [A11y & UX](./accessibility.md) | focus-visible, aria-* attrs, keyboard nav | v1.0.0 | Coverage map |

## Key Classes

- **PrintTemplate** - 打印模板单例，包含所有设计/打印逻辑；支持 destroy() 销毁、事件监听、多页分页
- **PrintElementTypeManager** - 元素类型注册表（文本/条形码/二维码/...）
- **PrintElementTypeGroup** - 元素类型分组（按 module 组织）
- **PrintElementType** - 单个元素类型定义（render/drag-drop/properties）

## Key Options (buildDesigner / buildToolbar)

**Toolbar Options:**
- `showBusinessSelect` / `onBusinessSelect` - 业务选择钩子
- `showTemplateSelect` / `onTemplateSelect` - 模板选择钩子
- `showPanelManager` / `panelManagerLabel` / `addPanelButtonText` - 分页管理 UI
- `showPagination` - 画布底部分页栏显示
- `alignItems` - 自定义对齐选项（可完全替换）
- `onClearConfirm` / `onCustomPaperOpen` - 异步钩子（Promise）
- `extraButtons[]` - 声明式按钮扩展

## Recent Changes (25+ commits)

- 新增 5 个 export：PrintTemplate / PrintElementTypeManager / getClients/getClientInfo/getAddress/ippPrint/ippRequest (5 client methods .bind)
- 新增 9 个 opts：showPagination / showPanelManager / panelManagerLabel / addPanelButtonText / alignItems / onClearConfirm / onCustomPaperOpen / onBusinessSelectError / onTemplateSelectError
- 新增 3 个 API：PrintTemplate.destroy() / isDestroyed / setPaginationVisible()
- A11y 改进：focus-visible border / aria-pressed / button type / dialog/popover ARIA / panel keyboard drag
- 工具栏分页管理用 segmented 组件

## Quick Links

- See [./core-bundle.md](./core-bundle.md) for bundle structure
- See [./api-exports.md](./api-exports.md) for all 23 exports
- See [./toolbar-architecture.md](./toolbar-architecture.md) for button registry + slot mechanism
- See [../SMOKE-TEST.md](../SMOKE-TEST.md) for test coverage against review findings
