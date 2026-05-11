# ADR-0007: 暴露 PrintElementTypeRegistry export 分离 data 单例与 UI builder

- **Status:** accepted
- **Date:** 2026-05-11
- **Deciders:** amDosion

## Context

上游 hiprint 内部有两个同名概念 "PrintElementTypeManager":
- **a class** (line 8900): data 单例,持 `allElementTypes` 数组 + `addPrintElementTypes` / `removePrintElementTypes` 方法 + `.instance` 静态 getter
- **it class** (line 10591): UI builder utility, 含静态方法 `build / buildByHtml / setPanelSlot / getElementTypeGroups`

webpack `n.d(e, "PrintElementTypeManager", () => it)` 只 export `it` (UI builder)。**业务方与 e2e 测试拿不到 data 层 API**。

R2 e2e dedup.spec.ts × 4 + multi-instance × 1 + xss × 1 全部失败,根因都是:

```js
const mgr = new h.PrintElementTypeManager();  // 拿到 UI builder
mgr.addPrintElementTypes(...);  // ❌ TypeError: not a function
```

业务方 / 测试需要 data 层 API 时,只能通过 `hiprint.appendElementTypeGroups()` 公开函数间接操作,无法直接持有 registry 引用。

## Decision

**新增 `PrintElementTypeRegistry` export 暴露 data 层 class `a`**:

```js
// src/hiprint/hiprint.bundle.js:15140
n.d(e, "PrintElementTypeRegistry", function () {
  // 数据层单例 - 业务方 / e2e 测试访问 allElementTypes / addPrintElementTypes /
  // removePrintElementTypes 等用; PrintElementTypeManager 是 UI builder utility.
  return a;
});
```

```js
// src/index.js
let PrintElementTypeRegistry = hiprint.PrintElementTypeRegistry;
export { PrintElementTypeRegistry, ... };
```

业务方用法:
```js
import { PrintElementTypeRegistry } from 'vue-plugin-hiprint';
const registry = new PrintElementTypeRegistry();
registry.addPrintElementTypes('mod', groups);
registry.allElementTypes.forEach(...);
```

或访问全局单例:
```js
PrintElementTypeRegistry.instance.allElementTypes;  // ← 静态 getter
```

## Alternatives

### A. 替换 PrintElementTypeManager export 指向 `a` 而非 `it`
- 优点: 单一 class
- 缺点: **breaking change** — 业务方现有 `hiprint.PrintElementTypeManager.build(...)` 调用全挂
- 拒绝原因: 不向后兼容

### B. 不暴露 data 层,只用 appendElementTypeGroups 等公开函数
- 优点: 隐藏内部
- 缺点: e2e 无法验证 dedup / 内部状态;业务方需要 inspect registry 时没 path
- 拒绝原因: 测试盲区 + 业务方反馈

### C. 重命名两个 class,完全消除命名冲突
- 优点: 最清晰
- 缺点: 多处文档/调用方/上游对比需同步;risk 高
- 拒绝原因: 改动面太大

## Consequences

### 正面
- e2e 可以直接 `new PrintElementTypeRegistry()` 拿独立 instance 测试 dedup 等
- 业务方 inspect / mutate registry 有正式 path
- PrintElementTypeManager 保持 UI builder 静态方法语义,完全向后兼容
- docs/API-REFERENCE.md 明确两 class 责任分离

### 负面
- 命名仍然有点混乱 (Manager vs Registry),需要文档说明
- 上游 hiprint 若有人 fork 学,可能跟随我们的命名 (反向影响)

### 后续
- 业务方文档示例都改用 PrintElementTypeRegistry (data) + PrintElementTypeManager (UI builder)
- e2e 已建立 `print-element-type-registry.spec.ts` (5 cases) 锁住语义

## Related

- ADR-0001 (fork detach) — 我们能自由扩展 export 的前提
- ADR-0004 (单 bundle 维护) — bundle.js 直接 patch export 注册
- `.claude/rules/api-contract.md` 兼容性矩阵: "新增 export ✅ 兼容,直接发"
- PM-007 (addPrintElementTypes tid 去重)
- e2e/tests/print-element-type-registry.spec.ts
