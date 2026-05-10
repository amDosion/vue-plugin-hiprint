# Rule: 公开 API 契约

> 适用范围：`src/index.js` 的 23 个 export + `PrintTemplate` 公开方法 + `buildToolbar/buildDesigner` opts。
>
> 业务方（`vue-admin-main` 等）依赖这些 API。**任何破坏性变更**必须走 deprecation 流程。

## 1. 公开 API 清单

详见 [`docs/API-REFERENCE.md`](../../docs/API-REFERENCE.md)。简要：

### 核心类（不可改签名）
- `PrintTemplate` — 构造参数 / 公开方法
- `PrintElementTypeManager` / `PrintElementTypeGroup`

### 直接 export 函数（必须 `.bind(hiprint)`，否则 this 丢失）
- `print` / `print2` / `getHtml` / `getClients` / `getClientInfo` / `getAddress` / `ippPrint` / `ippRequest`

### 工厂函数 opts（嵌套 schema）
- `buildToolbar(container, template, options)` — 60+ opts 字段
- `buildDesigner(container, options)` — 含 `templateOptions/toolbarOptions/componentPanelSlot/showPagination/...`

## 2. 兼容性矩阵

| 改动类型 | 兼容 | 处置 |
|---|---|---|
| 新增 opts 字段（默认值不影响旧行为）| ✅ | 直接发，docs 同步 |
| 新增 export | ✅ | 直接发 |
| 新增 PrintTemplate 方法 | ✅ | docs 同步，加 `_destroyed` 守卫 |
| 改 opts 默认值（如 `showPagination: true → false`）| ⚠️ minor breaking | commit message 标 `Breaking change note (minor)`，下个 minor 版本 |
| 删 / 重命名 export | ❌ breaking | 走 deprecation：先标 `@deprecated` 注释 + console.warn 1 个版本，再删 |
| 改公开方法签名 | ❌ breaking | 同上，或重载（多签名） |
| 改返回值类型 | ❌ breaking | 同上 |

## 3. 不变式（必须维持）

- `PrintTemplate.destroy()` 必须幂等
- `PrintTemplate.print()` 必须 `.bind(hiprint)`（否则 this.getHtml 丢失）
- `setDynamicFields/setElementTypeGroups/appendElementTypeGroups` `moduleName` 必填
- `removePrintElementTypes` 空 t 拒绝
- `addPrintElementTypes` 同 tid 去重（warn）
- `deletePanel` 守卫 `length >= 1`
- 所有 `opts.onXxx` 业务回调 try-catch 隔离
- 所有 `$(document).on(...)` 必须带实例 namespace

## 4. 改动前必跑

- [ ] grep 业务方代码（`E:/Source_code/vue-admin-main/frontend`）确认是否使用了即将改的 API
- [ ] 如果使用 → docs/integration-guide.md 必须同步更新
- [ ] 必须给 e2e 加测试 case 锁住新行为（`e2e/tests/api-contract.spec.ts`）

## 5. Deprecation 流程

破坏性变更必须分 3 阶段：

```
v1.x.0  — 加 @deprecated 注释 + console.warn 提示业务方迁移
v1.(x+1).0 — 仍兼容,加更醒目的 warn
v2.0.0  — 移除老 API,changelog 显式标注
```

不允许跳过中间阶段直接删。

## 6. 文档同步要求

| 改动 | 必须同步的 docs |
|---|---|
| 新 export | `docs/API-REFERENCE.md` 表 + `docs/CODEMAPS/api-exports.md` |
| 新 buildToolbar opts | `docs/TOOLBAR-ARCHITECTURE.md` |
| 新 buildDesigner opts | `docs/integration-guide.md` |
| 新 PrintTemplate 方法 | `docs/API-REFERENCE.md` 主要方法表 |
| 改 destroy 流程 | `docs/SMOKE-TEST.md` Level 2 断言 + `e2e/tests/destroy.spec.ts` |

## 7. 与全局 api.md 关系

`~/.claude/rules/deep-debug/api.md` 是通用 API 契约规则。本文件 specialize 到 vue-plugin-hiprint 项目：
- 把"客户端"映射为"业务方 vue-admin-main"
- 把"幂等键"映射为"PrintTemplate.destroy 幂等"
- 把"版本化"映射为"vue-plugin-hiprint.tgz 内部 version + npm publish"
