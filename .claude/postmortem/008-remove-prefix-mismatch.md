# PM-008: removePrintElementTypes prefix 误删兄弟元素

- **Category:** API 契约
- **Severity:** HIGH
- **First detected:** 2026-04-27 (第 3 轮 type-design-analyzer 发现)
- **Status:** prevented

## What happened

`removePrintElementTypes(moduleName, tidOrPrefix)` 支持按精确 tid 或 prefix 删除元素类型。原始实现用了 `String.prototype.startsWith`：

```js
// ❌ Before
removePrintElementTypes(moduleName, t) {
  this[moduleName].forEach(g => {
    g.printElementTypes = g.printElementTypes.filter(et => !et.tid.startsWith(t))
  })
}
```

调用 `removePrintElementTypes('default', 'order')` 期望删 `order.text` / `order.barcode` 等所有 `order.*`，但实际：

- 误删 `order_v2.text`（startsWith('order') 命中）
- 误删 `order2024.invoice`
- 误删 `orderitem.qty` （任何 order 开头的）

**真实影响**：
- 业务方批量管理元素类型时，删除一个 module 误伤兄弟
- 不可逆（元素被删后，业务方原始 group 数据已丢）

## Root cause

prefix 匹配的语义边界没定义清楚。`order.text` 和 `order_v2.text` 都 startsWith `order`，但只有前者是 `order` 模块的子元素。

正确语义应该是：**精确等于 t** 或 **以 `t.` 开头**（dotted prefix）。

## Where it appeared

`hiprint.bundle.js:8925+` `removePrintElementTypes`。

## How it was fixed

精确 dotted prefix + 空字符串拒绝：

```js
// ✅ After
removePrintElementTypes(moduleName, t) {
  if (typeof t !== 'string' || t.length === 0) {
    console.warn('[hiprint] removePrintElementTypes: empty t rejected')
    return
  }

  if (!this[moduleName]) return

  this[moduleName].forEach(g => {
    g.printElementTypes = g.printElementTypes.filter(et => {
      const tid = et.tid
      // 精确等于 OR 以 't.' 开头（dotted prefix）
      const matches = (tid === t) || (tid.indexOf(t + '.') === 0)
      return !matches  // matches → 删；否则保留
    })
  })

  // 同步平铺缓存
  allElementTypes = allElementTypes.filter(et => {
    const tid = et.tid
    return !(tid === t || tid.indexOf(t + '.') === 0)
  })
}
```

关键差异：
- `tid.indexOf(t + '.') === 0` 强制 prefix 后必须是 `.`
- `t === ''` 拒绝（防止误删全部）
- `!this[moduleName]` 早返回

## Why it kept happening

1. **prefix 语义未定义**：上游 API 文档没说边界
2. **`startsWith` 语义错误但直觉对**：开发者第一眼觉得"order 开头就是 order 的"
3. **测试覆盖不足**：上游只测了 happy case（`removePrintElementTypes('default', 'default.text')`），没测 prefix 场景

## Prevention

### 规则
- `.claude/rules/hiprint-bundle.md` 第 2 节不变式 — removePrintElementTypes 必须 dotted prefix

### 自动检查
- `.claude/agents/hiprint-bundle-reviewer.md` 第 5 项 checklist:
  ```bash
  grep -nE "tid\.startsWith\(t\)" src/hiprint/hiprint.bundle.js
  ```
  命中 = ❌ FAIL

### e2e
- `e2e/tests/dedup.spec.ts` 含：
  - `removePrintElementTypes('default', 'order')` 删 `order.text` 但保留 `order_v2.text`
  - `removePrintElementTypes('default', '')` 拒绝并 warn
  - `removePrintElementTypes('default', 'order.text')` 精确删一个

### API 文档
- `docs/API-REFERENCE.md` 明确 prefix 语义：dotted prefix（必须 `<name>.<rest>`）
