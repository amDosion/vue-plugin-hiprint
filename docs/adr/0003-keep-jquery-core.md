# ADR-0003: 保留 jQuery 内核 (不重写为纯 Vue)

- **Status:** accepted
- **Date:** 2026-04-22
- **Deciders:** amDosion

## Context

迁移到 Vue 3 后，最大的"诱惑"是把 14905 行 `hiprint.bundle.js` 也重写为纯 Vue 3。但仔细评估：

- `hiprint.bundle.js` 是上游 hiprint 项目的打包产物，包含：
  - 拖拽（jQuery UI sortable）
  - DOM 测量（jQuery `.offset()`、`.outerWidth()` 等）
  - 事件委托（jQuery `.on('click.namespace', ...)`）
  - 序列化（`$.extend(true, {}, ...)`）
- 重写为纯 Vue 3 + Composition API 估算 6 人月
- 重写期间：
  - 业务方继续依赖 hiprint，不能停
  - 测试覆盖必须从 0 建起（上游也没单元测试）
  - 拖拽逻辑用 Vue 重新实现等于重做 jQuery UI 30 年的边界 case

## Decision

**保留 jQuery 内核，定边界**：

- `src/hiprint/` 目录下所有代码用 jQuery（这是 hiprint 内核）
- `src/standalone/` 目录下用 Vue 3 + Composition API（这是外壳）
- 桥接通过 `opts.onXxx(...)` 回调（Vue 不直接读 hiprint 内部状态）
- 全局 `window.jQuery = window.$ = $`，整个 app 用同一 jQuery 实例

## Alternatives

### A. 重写为纯 Vue 3 Composition API
- 优点：技术栈统一、测试可写得更细
- 缺点：6 人月成本；重写过程拖累业务；丢失上游已修复的边界 case
- **拒绝原因**：成本不可接受；增量价值低（hiprint 是设计器,业务方不会自己改它）

### B. 用 lit-element / web components 替代
- 优点：脱离框架绑定
- 缺点：仍需重写所有 jQuery 代码；web components 在拖拽场景不成熟
- **拒绝原因**：换汤不换药

### C. 把 jQuery 部分包装成 Vue Composable
- 优点：API 更"Vue 范"
- 缺点：表面包装,内部仍是 jQuery；增加抽象层成本
- **拒绝原因**：无实质好处

## Consequences

### 正面
- 14905 行 bundle.js 不动 (除非修 bug)
- 业务方接入只看 `src/index.js` 的 23 个 export，不感知内部 jQuery
- 修 bug 速度快（直接 grep + Edit）

### 负面
- jQuery 加载体积（~85kb gzipped）无法摆脱
- Vue 开发者首次接触会困惑（"为什么 designer-shell 里不能 ref 到 paper DOM"）
- 必须维护 `_setup-jquery.js` + window.jQuery 全局

### 缓解措施
- `.claude/rules/jquery-vue3.md` 明确边界规则
- `docs/build-designer-vue-integration.md` 记录多实例陷阱
- `src/standalone/designer-shell.vue` 是模范集成示例

## Related

- ADR-0002 (Vite 迁移) — 必须配合 jQuery commonjs shim
- ADR-0004 (单 bundle 维护) — 不重写 = 在 bundle 内修
