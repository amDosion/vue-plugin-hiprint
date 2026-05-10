# PM-004: 全局事件订阅缺少 namespace 导致多实例污染

- **Category:** 多实例隔离
- **Severity:** HIGH
- **First detected:** 2026-04-26 (第 1 轮 state-modeler 发现)
- **Status:** prevented

## What happened

`hiprint.bundle.js` 多处用 `$(document).on('keydown', handler)` 等订阅全局事件（用于实现快捷键 Ctrl+Z 撤销、Delete 删除元素等）。但订阅时不带 namespace（`'keydown'` 而非 `'keydown.hiprintTemplate-XXX'`），导致：

- 多个 PrintTemplate 实例同时订阅 `keydown` → 一次按键触发多个 handler
- destroy 时 `$(document).off('keydown')` **会解绑掉所有 keydown handler**（包括其他实例 + 业务方自己的）
- 如果用 `$(document).off('keydown', oldHandler)` 精确解绑，要保留 handler 引用，但函数表达式不可比较

## Root cause

jQuery `.on(events, handler)` / `.off(events)` 的 namespace 机制是为多实例隔离设计的：

```js
// 不带 namespace
$(doc).on('keydown', h1)
$(doc).on('keydown', h2)
$(doc).off('keydown')  // ← 解绑了 h1 和 h2

// 带 namespace
$(doc).on('keydown.tplA', h1)
$(doc).on('keydown.tplB', h2)
$(doc).off('.tplA')    // ← 只解绑 tplA
```

上游开发时假设"只有一个 template"，所以省略了 namespace。当业务方在 SPA 中创建多个设计器（同时显示 / 路由切换 / KeepAlive），缺失 namespace 就成 bug。

## Where it appeared

多处涉及全局事件 + `$(document).on(...)`：

- 快捷键监听（Ctrl+Z / Ctrl+Y / Delete）
- toolbar 内的全局点击关闭浮层
- 拖拽时的 mousemove / mouseup 监听
- 元素列表面板的 outside-click 关闭
- 属性面板的 outside-click 提交

## How it was fixed

统一引入实例级 namespace：

```js
// PrintTemplate 构造时生成唯一 ID
this._uid = Date.now() + '-' + Math.random().toString(36).slice(2)

// 所有 $(document).on(...) 都带 namespace
$(document).on('keydown.hiprintTemplate' + this._uid, this._onKeydown.bind(this))
$(document).on('mousemove.hiprintTemplate' + this._uid, ...)

// destroy 时一次性解绑
$(document).off('.hiprintTemplate' + this._uid)
```

toolbar / designer 同样：

```js
this._toolbarUid = Date.now() + '-' + Math.random().toString(36).slice(2)
$(document).on('click.hiprintToolbar' + this._toolbarUid, ...)
```

## Why it kept happening

1. **上游单实例假设**：原始代码作者只测一个 template
2. **多实例隐蔽**：单实例正常时 namespace 缺失没有任何症状
3. **jQuery 文档**：`.on/.off` 的 namespace 是 advanced feature，不常被强调
4. **复制粘贴**：写完一处 `$(doc).on('xxx', ...)` 类似场景就 copy

## Prevention

### 规则
- `.claude/rules/hiprint-bundle.md` 第 2 节不变式 — 全局事件 namespace 强制
- 严格规则：所有 `$(document).on(...)` 必须 namespaced
- 实例 ID 必须 `Date.now() + Math.random()` 而非自增 `_uid`（避免 iframe 共享冲突,见 PM-005）

### 自动检查
- `.claude/agents/hiprint-bundle-reviewer.md` 第 6 项 checklist:
  ```bash
  grep -nE "\\\$\\(document\\)\\.on\\(" src/hiprint/hiprint.bundle.js
  ```
  逐条检查是否带 namespace

### e2e
- `e2e/tests/multi-instance.spec.ts`:
  - 创建 2 个设计器，按 Ctrl+Z 只影响 focused 那个
  - destroy 设计器 A 不影响设计器 B 的快捷键
  - 设计器 A destroy 后业务方自己的 keydown handler 仍工作

### 横向 audit
- 包含 jQuery 事件订阅的所有插件文件 (`src/hiprint/plugins/*.js`) 都查一遍
