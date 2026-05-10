# PM-005: 自增 _uid 在 iframe / 微前端场景碰撞

- **Category:** 多实例隔离
- **Severity:** MEDIUM (单页正常,iframe/microfrontend 场景才出)
- **First detected:** 2026-04-27 (第 2 轮 root-cause-hunter 发现)
- **Status:** prevented

## What happened

之前的 toolbar / designer 实例 ID 用模块级自增计数器：

```js
let _toolbarUid = 0
function buildToolbar(...) {
  this._toolbarUid = ++_toolbarUid  // 1, 2, 3, ...
}
```

在以下场景会撞 ID：

1. **iframe**：父页面 `_toolbarUid=1`，子页面（也是 hiprint）也是 `_toolbarUid=1`，它们的 jQuery 事件 namespace 字符串相同
2. **微前端**：多个微应用都加载 vue-plugin-hiprint，各自模块作用域独立，自增数从 0 开始
3. **HMR**：模块重新加载会重置自增数为 0，新 toolbar 的 ID 与旧的某个 toolbar 撞
4. **SSR + hydrate**：服务端渲染计数器与客户端不同步

撞 ID 后果是 PM-004 的延伸：destroy 时 `.off('.hiprintToolbar1')` 可能错解绑了别的实例的事件。

## Root cause

自增 ID 的前提是"单一全局序列"。一旦序列被复制（iframe / microfrontend / HMR），自增就不再唯一。

## Where it appeared

- `_toolbarUid` (line ~13023)
- `_designerUid` (line ~14426)
- `printTemplate._uid`

## How it was fixed

替换为时间戳 + 随机数：

```js
// ❌ Before
let _toolbarUid = 0
function buildToolbar(...) {
  this._toolbarUid = ++_toolbarUid
}

// ✅ After
function buildToolbar(...) {
  this._toolbarUid = Date.now() + '-' + Math.random().toString(36).slice(2, 10)
  // 形如: "1714305600000-x7k3p9q2"
}
```

`Date.now()` 提供毫秒级时间，`Math.random().toString(36).slice(2, 10)` 提供 8 字符随机后缀，碰撞概率 ≈ 0。

## Why it kept happening

1. **单实例测试**：单页测试时自增 ID 没问题
2. **iframe / 微前端是后发场景**：上游 hiprint 时代不流行
3. **撞 ID 症状隐蔽**：表现为"事件偶尔不触发"或"destroy 影响了别的实例"，难复现

## Prevention

### 规则
- `.claude/rules/hiprint-bundle.md` 第 2 节不变式 — _toolbarUid / _designerUid / _uid 必须 `Date.now() + Math.random()`

### 自动检查
- `.claude/agents/hiprint-bundle-reviewer.md` 第 9 项 checklist:
  ```bash
  grep -nE "_(toolbar|designer)Uid" src/hiprint/hiprint.bundle.js
  ```
  必须含 `Date.now()` + `Math.random()`，自增形式 = ❌ FAIL

### e2e
- `e2e/tests/multi-instance.spec.ts` 含 iframe 场景测试

### 后续如果要用 UUID
- 当前 timestamp + random 满足需求且不引入依赖
- 如果需要 RFC4122 UUID（接口契约要求），考虑 `crypto.randomUUID()`（现代浏览器）
- 不要引入 `uuid` npm 包到 bundle.js（增加体积）
