# PM-009: Promise.resolve(syncThrow()) 绕过 .catch

- **Category:** 健壮性 / 异步
- **Severity:** HIGH
- **First detected:** 2026-05-11 (R3 silent-failure-hunter)
- **Status:** prevented

## What happened

业务方回调返回 Promise (`opts.onTemplateDeleteConfirm` / `opts.onTemplateDelete`) 被 `Promise.resolve(fn())` 包裹后链式 `.then(...).catch(...)`。但 `fn()` **同步 throw** 时, JS 引擎在 `Promise.resolve` 之前就冒泡, `.catch` **不接**。

**真实影响**:
- 业务方 sync throw → toolbar 卡死,delete 永远不执行
- console 出现 unhandled rejection (生产环境可能被 Sentry 报警淹没)
- 重现成本低 (业务方 `onTemplateDeleteConfirm(ctx) { throw new Error('x'); }`)

## Root cause

JS Promise 语义:

```js
Promise.resolve(fn())  // ← fn() 在 Promise.resolve 调用之前已 throw, .catch 看不到
  .then(...)
  .catch(err => ...)   // ← 只接 fn 内 async throw 或 .then handler throw
```

`.catch` 只接两类 reject:
1. 异步 reject (Promise.reject / 异步 throw 抛进 then)
2. .then handler 自身 throw

**同步 throw 必须 try 包外层**。

## Where it appeared

`hiprint.bundle.js`:
- line 13775 `Promise.resolve(opts.onTemplateDeleteConfirm(context))`
- line 13789 `Promise.resolve(opts.onTemplateDelete(item, template, toolbarApi))`

## How it was fixed

```js
// Before
return Promise.resolve(opts.onTemplateDeleteConfirm(context))
  .then(r => r !== false)
  .catch(err => false);  // 只接 async, 接不住 sync throw

// After
var syncResult;
try {
  syncResult = opts.onTemplateDeleteConfirm(context);
} catch (err) {
  console.error('[hiprint] onTemplateDeleteConfirm threw (sync):', err);
  return Promise.resolve(false);  // 取消 delete (安全 default)
}
return Promise.resolve(syncResult)
  .then(r => r !== false)
  .catch(err => {
    console.error('[hiprint] onTemplateDeleteConfirm rejected (async):', err);
    return false;
  });
```

## Why it kept happening

1. **JS Promise 模型反直觉**: `.catch` 名字 "catch" 让开发者以为它接所有 throw
2. **类似 React Suspense 设计**: 与 React error boundary 也不接同步 throw 形成对照
3. **复制粘贴 pattern**: 一处错全仓库复制
4. **测试盲区**: 业务方 mock 通常不 sync throw

## Prevention

### 规则
- `.claude/rules/hiprint-bundle.md` 不变式: Promise.resolve(opts.onXxx()) 必须包 try / 或用 _safeCall

### 自动检查
- `.claude/agents/hiprint-bundle-reviewer.md` 第 7 项加 Promise 模式检查:
  ```bash
  grep -nE "Promise\.resolve\(opts\.on" src/hiprint/hiprint.bundle.js
  ```
  每条必须有外层 try / _safeCall

### e2e
- 给 e2e/tests/destroy.spec.ts 加 case: 业务方 sync-throw 不让 toolbar 卡死

### 教训
- 任何 Promise.resolve(externalFn()) 都必须假设 externalFn() sync throw
- 业务方契约边界 = 永远 try
