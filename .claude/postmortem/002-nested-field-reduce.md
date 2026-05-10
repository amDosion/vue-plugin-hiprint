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

### Round 1 (2026-04-27): reduce 内部回调
统一改为 null-safe pattern：

```js
// ✅ Round 1 修复
f.split('.').reduce((a, c) => (a != null ? a[c] : undefined), t)
```

### Round 2 (2026-05-10): 外层 || "" falsy fallback (e2e 暴露)
e2e nested-field.spec.ts `data.a.b === 0` 渲染为空字符串而非 "0",证明 reduce 内部正确但外层有第二个 falsy 回退:

```js
// ❌ Round 1 修完但还有这层
... reduce(...) || ""    // 0 || "" === ""; false || "" === ""
```

### Round 2 修复

```diff
- f.split('.').reduce((a, c) => (a != null ? a[c] : undefined), t) || ""
+ f.split('.').reduce((a, c) => (a != null ? a[c] : undefined), t) ?? ""
```

`??` (nullish coalescing) 只在 null/undefined 回退,保留 0/false/"" 原值。
全 7 处统一替换 (text/longText/image/barcode/qrcode/html/table)。

## Why it kept happening

1. **复制粘贴**：6+ 处 reduce 模式相似，开发时 copy
2. **测试盲区**：上游 hiprint 没有 falsy-中间值 的测试 case
3. **隐蔽**：bug 不会 throw，只是返回错的数据，业务方很久才发现
4. **直觉错误**：JS 开发者写 `a ? a[c] : ...` / `expr || ""` 习惯成自然
5. **Round 1 覆盖不完整**: reviewer 只 grep 内部回调 pattern, 漏了外层 `|| ""`. 必须按完整 falsy-rejection 链 audit 才发现.
6. **e2e 是唯一发现路径**: 单元测试缺失,只有运行时渲染对比才暴露 0/false 显示空

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
- 全仓库 grep `reduce.*split` 统一 audit (内部回调)
- **新增**: grep `reduce(...) || ""` audit 外层 falsy fallback (Round 2 教训)
- 业务方代码也提醒：如果他们扩展了元素类型且自己实现 getData，要遵循同一 pattern

### 教训 (Round 2 后补)
- 修一个 falsy bug 必须同时审查"内部回调" + "外层 fallback chain" + "渲染层 toString" 三处
- 单纯改 reduce 内部不够,JS 的 `||` 运算符是隐藏 falsy trap
- e2e 必须覆盖 0/false/""/null 边界值的实际渲染输出对比 (不只是 throw 与否)
