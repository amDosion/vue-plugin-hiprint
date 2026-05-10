# PM-003: PrintTemplate 销毁后调用方法导致 stale 状态污染

- **Category:** 资源管理 / 多实例
- **Severity:** HIGH
- **First detected:** 2026-04-25 (业务方多次反馈 + 第 1 轮 state-modeler 确认)
- **Status:** prevented

## What happened

Vue 路由切换 / KeepAlive 失活 / hot reload 时，`PrintTemplate` 实例没有 cleanup 流程。stale 实例在全局 `printTemplateContainer` map 里堆积；jQuery 事件订阅泄漏；新实例创建后 keydown / click 等事件被多个 handler 同时触发。

**真实影响**：
- 业务方反馈："切回模板设计页发现 Ctrl+Z 撤销栈错乱"
- 业务方反馈："多个设计器并存时点击 toolbar 影响了别的设计器"
- 内存泄漏：stale 实例 + jQuery 事件 handler + DOM 引用累积
- 测试不可重复：第二次 buildDesigner 拿到污染的全局 map

## Root cause

`PrintTemplate` 上游设计假设"一个页面一个生命周期内只有一个 template"。Vue 3 SPA 完全打破这个假设：

- 路由是动态的（`<router-view>`），组件 mount/unmount 多次
- KeepAlive 让组件 deactivated 后 DOM 还在但状态停滞
- HMR 触发整个 Vue tree 重建，但 hiprint 内部 map 不知道

没有 destroy 方法 = 没有 unsubscribe 机制 = 必然泄漏。

## Where it appeared

体现在多处：

- 全局 `printTemplateContainer` map 永远只 add 不 delete
- `$(document).on('keydown', ...)` 没 namespace 不能精确解绑
- toolbar 内的 onClick 闭包持有旧 template 引用
- panel 的 DOM 节点被替换时旧的 jQuery 事件 handler 仍在

## How it was fixed

引入完整 destroy 生命周期（详见 ADR-0005）：

```js
PrintTemplate.prototype.destroy = function () {
  if (this._destroyed) return;             // 1. 幂等
  this._destroyed = true;

  this.printPanels.forEach(p => p.clear());
  this.printPanels = [];

  $(document).off('.hiprintTemplate' + this._uid);  // namespace 解绑

  Object.keys(printTemplateContainer).forEach(k => {
    if (printTemplateContainer[k] === this) delete printTemplateContainer[k];  // identity check
  });

  this.history && (this.history = null);
  this.editingPanel = null;
};
```

所有公开方法加 `_destroyed` 守卫：

```js
PrintTemplate.prototype.design = function (container) {
  if (this._destroyed) {
    console.warn('[hiprint] design called on destroyed template');
    return undefined;
  }
  // ...原逻辑
};
```

`buildDesigner` 返回的 `ctrl` 也有 destroy：

```js
return {
  hiprintTemplate: tpl,
  destroy: () => {
    tpl.destroy();
    // 移除 toolbar / 元素列表 DOM
  }
};
```

## Why it kept happening

1. **上游假设错误**：原始代码假设"模板只创建不销毁"
2. **Vue 3 + SPA 是后发场景**：上游 hiprint 时代多是单页静态使用
3. **业务方反馈滞后**：泄漏不立即可见，要切多次路由才显现
4. **缺少多实例 e2e**：早期没测多实例场景

## Prevention

### 规则
- `.claude/rules/hiprint-bundle.md` 第 2 节不变式 — destroy 守卫强制
- `.claude/rules/jquery-vue3.md` 第 4.1 节 — onBeforeUnmount 必调 destroy
- ADR-0005 — 完整决策记录

### 自动检查
- `.claude/agents/hiprint-bundle-reviewer.md` 第 2 项 checklist:
  ```bash
  grep -nE "t\.prototype\.\w+ = function" src/hiprint/hiprint.bundle.js
  ```
  每个 PrintTemplate 公开方法必须有 `_destroyed` 守卫

### e2e
- `e2e/tests/destroy.spec.ts` 5+ case:
  - destroy 幂等（多次调安全）
  - destroy 后 design/print/getJson 返回 undefined + warn
  - destroy 后全局 map 没残留
  - 多实例 destroy 不互相影响
  - destroy 后 jQuery 事件不再触发

### 业务方文档
- `docs/integration-guide.md` 强调"必须调 destroy"
- `docs/build-designer-vue-integration.md` Vue 3 集成模板含 onBeforeUnmount

### 后续优化
- `_assertNotDestroyed(name)` helper 减少守卫样板代码（见 code-simplifier plan）
