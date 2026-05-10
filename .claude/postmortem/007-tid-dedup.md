# PM-007: addPrintElementTypes 同 tid 多次注册导致鬼魂元素

- **Category:** API 契约
- **Severity:** MEDIUM
- **First detected:** 2026-04-27 (第 3 轮 type-design-analyzer 发现)
- **Status:** prevented

## What happened

`addPrintElementTypes(moduleName, groups)` 注册元素类型。业务方有时（如 HMR / 重复 build / 多次 useEffect）会同 tid 多次调用。原始实现没有去重：

- `this[moduleName]` 桶里同 tid 的元素出现多次
- 元素列表面板渲染时显示重复条目
- 用户拖一个"文本"元素到画布，可能触发任何一个重复定义（最后一个胜出）
- 内存累积 + 调试困难

**真实影响**：
- 业务方反馈："改完代码 HMR 后元素面板里出现了 2 个一样的'文本'元素"
- 自定义业务元素扩展时，业务方搞不清楚自己注册过没

## Root cause

原始代码只把 incoming groups append 到 `this[moduleName]`：

```js
// ❌ Before
addPrintElementTypes(name, groups) {
  this[name] = (this[name] || []).concat(groups)
  groups.forEach(g => g.printElementTypes.forEach(t => allElementTypes.push(t)))
}
```

完全没考虑同 tid 的重复。

## Where it appeared

`hiprint.bundle.js:8909` `PrintElementTypeManager.prototype.build` / `addPrintElementTypes`。

## How it was fixed

双层去重：先按 incoming tid 收集，再过滤桶 + 平铺缓存：

```js
// ✅ After
addPrintElementTypes(moduleName, groups) {
  const incomingTids = {}
  // 先收集所有 incoming tid
  groups.forEach(g => g.printElementTypes.forEach(t => {
    if (incomingTids[t.tid]) {
      console.warn('[hiprint] duplicate tid in incoming:', t.tid)
    }
    incomingTids[t.tid] = true
  }))

  // 过滤桶：同 tid 的旧元素移除（被新的覆盖）
  if (this[moduleName]) {
    this[moduleName].forEach(g => {
      const before = g.printElementTypes.length
      g.printElementTypes = g.printElementTypes.filter(t => {
        if (incomingTids[t.tid]) {
          console.warn('[hiprint] tid override in', moduleName, ':', t.tid)
          return false
        }
        return true
      })
      // 如果整个 group 没了元素,可以选择留空 group 或删掉
    })
  }

  // 同样过滤平铺缓存
  allElementTypes = allElementTypes.filter(t => !incomingTids[t.tid])

  // append 新的
  this[moduleName] = (this[moduleName] || []).concat(groups)
  groups.forEach(g => g.printElementTypes.forEach(t => allElementTypes.push(t)))
}
```

注：第 2 轮 implementation-reviewer 发现初版只做了 `length === 1` 的 group 桶过滤，没覆盖 multi-element group，第 3 轮改为 per-element 过滤。

## Why it kept happening

1. **API 设计未指定语义**：上游没说"同 tid 重复注册时如何处理"
2. **业务方使用模式多样**：单次注册 / 重复注册 / HMR 重复都有
3. **去重逻辑容易写错**：只过滤一个数据结构（桶 OR 平铺缓存）会留下不一致

## Prevention

### 规则
- `.claude/rules/hiprint-bundle.md` 第 2 节不变式 — addPrintElementTypes 双层去重 + warn

### 自动检查
- `.claude/agents/hiprint-bundle-reviewer.md` 第 4 项 checklist

### e2e
- `e2e/tests/dedup.spec.ts`:
  - 同 moduleName 同 tid 二次注册 → console.warn + 只保留新的
  - 桶 + allElementTypes 一致（不会一处有一处没）
  - 跨 moduleName 的同 tid 互不影响（这是设计意图）

### API 文档
- `docs/API-REFERENCE.md` 明确语义：同 tid 重复注册会被去重 + warn，新覆盖旧
