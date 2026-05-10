# PM-006: 业务回调抛错导致整个工具链崩溃

- **Category:** 健壮性
- **Severity:** MEDIUM
- **First detected:** 2026-04-27 (第 2 轮 silent-failure-hunter 发现)
- **Status:** prevented

## What happened

`buildDesigner` / `buildToolbar` 接受大量 `opts.onXxx` 业务回调（onSave / onPreview / onPrint / onClear / onTemplateChange 等）。如果业务方回调内部 throw，整个 hiprint 内部流程被中断：

- toolbar onClick 触发 onPreview 回调
- onPreview 内 `JSON.parse(invalidJson)` throw
- 异常冒泡到 jQuery click handler，jQuery 输出 console error 但不再触发后续逻辑
- 设计器其他按钮疑似失灵（实际是 jQuery 事件队列状态混乱）

**真实影响**：
- 业务方反馈："点了打印按钮后所有按钮都失灵了"
- 业务方调试困难（hiprint 不能告诉他们是哪个回调抛了）
- jQuery 内部状态不可恢复

## Root cause

```js
// 上游原始代码
toolbar.find('.preview-btn').on('click', () => {
  opts.onPreview && opts.onPreview(this.hiprintTemplate)  // ← 业务回调 throw 直接冒泡
})
```

业务方代码与 hiprint 内部代码没有错误隔离。

## Where it appeared

20+ 处涉及 `opts.onXxx` 调用：

- `onPreview` / `onPrint` / `onPrintBefore` / `onPrintAfter`
- `onSave` / `onClear` / `onCopy` / `onPaste` / `onDelete`
- `onTemplateChange` / `onElementChange` / `onPanelChange`
- `onAddPanel` / `onDeletePanel` / `onSelectPanel`
- `onZoomChange` / `onUndo` / `onRedo`

## How it was fixed

统一包 try-catch + 带前缀 console.error：

```js
// ❌ Before
opts.onPreview && opts.onPreview(this.hiprintTemplate)

// ✅ After
if (opts.onPreview) {
  try {
    opts.onPreview(this.hiprintTemplate)
  } catch (err) {
    console.error('[hiprint] onPreview threw:', err)
  }
}
```

或者用 helper（见后续 code-simplifier）：

```js
this._safeCall('onPreview', [this.hiprintTemplate])
```

## Why it kept happening

1. **设计假设错误**：上游假设"业务回调不会 throw"
2. **JS 错误传播默认行为**：throw 会冒泡到 jQuery，jQuery 会切换到错误状态
3. **复制粘贴**：每处 `opts.onXxx` 都是 `opts.onXxx && opts.onXxx(...)` 模板
4. **测试不到**：单元测试 mock onXxx 通常不 throw

## Prevention

### 规则
- `.claude/rules/hiprint-bundle.md` 第 2 节不变式 — 业务回调 try-catch + console.error('[hiprint] xxx:', err) 强制

### 自动检查
- `.claude/agents/hiprint-bundle-reviewer.md` 第 7 项 checklist:
  ```bash
  grep -nE "opts\.on[A-Z]\w+\(" src/hiprint/hiprint.bundle.js
  ```
  每个调用必须包 try-catch

### e2e
- `e2e/tests/destroy.spec.ts` 含一个 case：onSave throw 后 toolbar 其他按钮仍工作

### 后续优化（code-simplifier plan）
引入 `_safeCall(name, args)` helper 把样板代码减少：

```js
PrintTemplate.prototype._safeCall = function (name, args) {
  const fn = this.opts && this.opts[name]
  if (typeof fn !== 'function') return undefined
  try {
    return fn.apply(this, args || [])
  } catch (err) {
    console.error('[hiprint] ' + name + ' threw:', err)
    return undefined
  }
}

// 调用方简化为
this._safeCall('onPreview', [this.hiprintTemplate])
```

预计减少 ~25 处 try-catch 重复样板,共 ~30 行净减少。
