# ADR-0005: 引入 PrintTemplate.destroy 生命周期

- **Status:** accepted
- **Date:** 2026-04-25
- **Deciders:** amDosion

## Context

上游 `PrintTemplate` 类没有 `destroy` 方法。在 Vue 路由切换 / KeepAlive 失活 / hot reload 时：

- 全局 `printTemplateContainer` map 累积 stale 实例
- jQuery 事件订阅（`$(document).on('keydown', ...)`）泄漏，新实例创建后多个 handler 同时触发
- 多设计器场景下，旧 toolbar 的 onClick 闭包持有旧 template 引用，导致状态污染
- 业务方反馈："切回模板设计页发现快捷键失效 / 撤销栈错乱"

## Decision

**引入完整的 destroy 生命周期**：

```js
PrintTemplate.prototype.destroy = function () {
  if (this._destroyed) return;          // 1. 幂等
  this._destroyed = true;                // 2. 标志位

  this.printPanels.forEach(p => p.clear()); // 3. 清空面板 DOM
  this.printPanels = [];

  $(document).off('.hiprintTemplate' + this._uid);  // 4. namespace 解绑
  
  // 5. identity check 后从全局 map 删除
  Object.keys(printTemplateContainer).forEach(k => {
    if (printTemplateContainer[k] === this) delete printTemplateContainer[k];
  });

  this.history && (this.history = null); // 6. 清引用
  this.editingPanel = null;
};
```

- **所有公开方法都加 `_destroyed` 守卫**：
  ```js
  if (this._destroyed) {
    console.warn('[hiprint] design called on destroyed template');
    return undefined;  // 或 new st({panels:[]}) 类的明确 fallback
  }
  ```

- `buildDesigner` 返回的 `ctrl.destroy()` 内部调 `hiprintTemplate.destroy()`

## Alternatives

### A. 不加 destroy,业务方自己 cleanup
- 优点：保持 API 简洁
- 缺点：业务方不知道要 cleanup 什么；事件订阅泄漏不可见；多次反馈
- **拒绝原因**：把责任甩给业务方，不专业

### B. 用 WeakRef + FinalizationRegistry 自动清理
- 优点：现代 JS 自动 GC
- 缺点：浏览器兼容性受限；触发时机不确定；jQuery 事件不会因 WeakRef 清理
- **拒绝原因**：不解决核心问题（事件订阅 leak）

### C. 让 ctrl 持有 AbortController,业务方 abort
- 优点：与 fetch 等现代 API 一致
- 缺点：jQuery 不支持 AbortController；改造成本高
- **拒绝原因**：架构不匹配

## Consequences

### 正面
- 业务方在 `onBeforeUnmount` 调 `ctrl.destroy()` 即可，简洁
- 多设计器并存场景安全（每个 destroy 后互不干扰）
- e2e 可锁住此行为（`e2e/tests/destroy.spec.ts` 已有 5+ case）
- `_destroyed` 守卫让破坏性调用降级为 console.warn 而非 crash

### 负面
- 14905 行 bundle 多了 ~80 行 destroy + 守卫代码
- 业务方文档必须强调"必须调 destroy"（已写入 integration-guide.md）
- 守卫代码重复（每个公开方法都要 `if (this._destroyed)`）→ 见 ADR 后续 `code-simplifier` 优化

### 锁住的不变式
- destroy 幂等（多次调安全）
- destroy 后所有公开方法返回明确 fallback（不抛、不静默）
- 事件订阅必须 namespaced（这样能精确解绑，不影响其他实例）
- 全局 map 删除必须 identity check（防止删错实例）

## Related

- ADR-0006 (固定 tgz) — 升级路径上多次回归这个 destroy
- `.claude/rules/hiprint-bundle.md` 第 2 节 destroy 守卫
- `e2e/tests/destroy.spec.ts` — 锁住行为
- 后续 `code-simplifier` plan: `_assertNotDestroyed` helper 可以减 42 行重复
