# PM-002: 嵌套字段 reduce 中间值 0/false/null 回退到根对象

- **Category:** 数据正确性
- **Severity:** HIGH
- **First detected:** 2026-04-27 (第 2 轮 silent-failure-hunter 发现)
- **Status:** prevented

## What happened

模板里支持嵌套字段如 `field: 'order.amount'`、`field: 'user.profile.name'`，运行时通过 `field.split('.').reduce(...)` 从 data 取值。但当中间值是 falsy（`0`、`false`、`null`、`""`），reduce 回调把"中间断链"误判为"中间不存在"，回退到根对象 `t`，最终拿到错误数据。

**真实影响**：
- 模板字段 `data.user.deleted` 当 `data.user = null` 时，会回退到 `data.deleted`，造成数据错位
- 二维码字段为 `data.tracking.id` 时，`tracking=0` 会变成 `data.id`
- 已生成 PDF 含错误数据，业务侧不可见的数据污染

## Root cause

错误的 reduce 回调模式：

```js
// ❌ 上游原始代码
f.split('.').reduce((a, c) => a ? a[c] : t[c], !1)
```

含义：`a ? a[c] : t[c]` 中的 `a` 是中间累积值。当 `a = 0` 或 `a = false` → `a ? ...` 为 false → 回退到 `t[c]`（根对象的 c 字段）。

正确语义应该是：**中间值是 null/undefined 才回退**，其他 falsy（0、false、""）只表示"这一层就是这个值"。

## Where it appeared

6 处：

1. `BasePrintElement.prototype.getData` line ~1263 (text 元素)
2. `BasePrintElement.prototype.getDesignTarget` line ~735 (设计时预览)
3. `image` 元素 getData (line ~9205) — 略不同的 pattern: `a ? a[c] : t[c]`
4. `barcode` 元素 getData
5. `qrcode` 元素 getData
6. `longText` 元素 getData

## How it was fixed

统一改为 null-safe pattern：

```js
// ✅ 修复后
f.split('.').reduce((a, c) => (a != null ? a[c] : undefined), t)
```

关键差异：
- `a != null` 同时排除 `null` 和 `undefined`，但允许 `0`/`false`/`""` 通过
- 失败 fallback 是 `undefined`（不是根对象），让上层显式处理"取不到"
- 起始值是 `t`（根对象），不是 `!1`

具体 diff（一例）：

```diff
- f.split('.').reduce((a, c) => a ? a[c] : t[c], !1)
+ f.split('.').reduce((a, c) => (a != null ? a[c] : undefined), t)
```

## Why it kept happening

1. **复制粘贴**：6 处 reduce 模式相似，开发时 copy
2. **测试盲区**：上游 hiprint 没有 falsy-中间值 的测试 case
3. **隐蔽**：bug 不会 throw，只是返回错的数据，业务方很久才发现
4. **直觉错误**：JS 开发者写 `a ? a[c] : ...` 习惯成自然，意识不到语义跟"安全嵌套访问"不一样

## Prevention

### 规则
- `.claude/rules/hiprint-bundle.md` 第 2 节不变式 — 嵌套字段 reduce 必须 `(a != null ? a[c] : undefined)`

### 自动检查
- `.claude/agents/hiprint-bundle-reviewer.md` 第 3 项 checklist:
  ```bash
  grep -E "reduce\(\(a, c\) => a \? a\[c\] : t\[c\]" src/hiprint/hiprint.bundle.js
  ```
  命中 = ❌ FAIL
- `.claude/rules/hiprint-bundle.md` 改动后 checklist 必跑

### e2e
- `e2e/tests/nested-field.spec.ts` 锁住 4 个 case：
  - `data.user.amount = 0` 应取到 0 而非根 amount
  - `data.user = null` 应返回 undefined 不回退
  - `data.user.name = ""` 应取到 ""
  - `data.deeply.nested.path` 多层正常工作

### 类似 pattern 的横向检查
- 全仓库 grep `reduce.*split` 统一 audit
- 业务方代码也提醒：如果他们扩展了元素类型且自己实现 getData，要遵循同一 pattern
