# ADR-0010: hiprint.bundle.js 拆分到 V2 (Strangler Fig)

- **Status:** superseded by [ADR-0011](0011-v3-modern-ui-architecture.md) (2026-05-11 PM)
- **Date:** 2026-05-11
- **Deciders:** amDosion
- **Supersedes:** ADR-0004 (单 bundle.js 内修源码而非拆模块)

> ⚠️ **Superseded note** (2026-05-11 PM): V2 ES module 拆分路径 (P0-P13) 已完成 52 modules + 474 unit tests,但用户决定转向 V3 全量重写 (Vue 3 + TS + 去 jQuery),不再以"保留 jQuery 的 ES module split"为终态。V2 codebase 仍保留在 worktree 作为 V3 数据层迁移基础。详见 [ADR-0011](0011-v3-modern-ui-architecture.md)。

## Context

`src/hiprint/hiprint.bundle.js` 是 webpack 4 UMD bundle, 15344 行单文件,内部 60 个 webpack modules。

2026-04-22 ADR-0004 当时拒绝拆分,理由:
1. 上游对比 (检测上游升级 diff)
2. 拆分过程引入风险 (闭包/作用域)
3. 测试覆盖不足

2026-05-11 现状:
1. ✅ ADR-0001 (2026-04-15) 已 detach 上游, 理由 1 不再约束
2. ⚠️ 仍是风险, 但 R1+R2+R3 三轮 audit 把 helper 模块化 (_assertNotDestroyed/_safeCall/_evalCap) + e2e 35/35 PASS 已经建立基础
3. ⚠️ e2e 覆盖率仅 ~40% 设计时/打印路径, P1 前置补到 100% 解决

3 轮 audit ~85 项修复证明 "bundle 内修" 模式 work, 但每次代价:
- 找位置慢 (依赖 docs/CODEMAPS/* 行号索引, 行号偏移要重跑 codemap-syncer)
- 错误率高 (R1/R2 都有反复, 同一 bug pattern 出现 ≥ 2 次才被 reviewer 抓到)
- 上下文负担重 (15344 行无法 fit IDE / LSP / TypeScript inference)
- 测试编写困难 (无 unit test, 全靠 e2e)
- 多人协作几乎不可能 (改 bundle 文件冲突高)

## Decision

**反转 ADR-0004,启动 hiprint.bundle.js 拆分到 V2 (Strangler Fig)**:

- 主 branch `main`: 保持当前 v1.0.3 状态,业务方持续可用
- 新 branch `refactor/hiprint-v2`: 在 git worktree `../vue-plugin-hiprint-v2/` 内完整开发 V2
- 新目录 `src/hiprint-v2/`: ~18 个 ES module 文件 (200-800 行 each)
- V2 完成后跟 v1.0.3 并存 (feature flag 切换),1-2 个 minor release 后才考虑删 bundle.js

### V2 架构

```
src/hiprint-v2/
├── internal/          ← 工具库 + lifecycle helper + i18n + config
├── vendor/            ← bundle 内嵌的 jQuery UI plugin (sortable/draggable/...)
├── renderers/         ← barcode/qrcode/image/long-text/html 渲染器
├── core/
│   ├── etypes/        ← 10 个元素类型 (text/image/.../table 子目录)
│   ├── registry.js    ← PrintElementTypeRegistry (data 单例 getInstance pattern)
│   ├── registry-manager.js  ← UI builder utility
│   ├── group.js
│   ├── panel.js       ← PrintPanel
│   └── print-element-entity.js  ← BasePrintElement (70 处引用, 最高风险)
├── template/          ← PrintTemplate 7 子模块 (含 47 处 _assertNotDestroyed)
├── ui/                ← buildToolbar / buildDesigner / element-list-panel / property-panel
├── socket/            ← hiwebSocket / send-by-fragments
└── index.js           ← re-export
```

### 14 个 Phase (容易 → 复杂)

P0 worktree → P1 e2e 100% → P2 internal → P3 vendor → P4 renderers → P5 registry →
P6 etypes → P7 table → P8 panel → P9 base entity → P10 template → P11 ui →
P12 socket+装配 → P13 切换验证 → P14 合并 cleanup

详见 [`docs/hiprint-v2-refactor-plan.md`](../hiprint-v2-refactor-plan.md)。

## Alternatives

### A. 保持 ADR-0004 不动 (维持现状)
- 优点: 零工作量
- 缺点: 长期技术债加重, R4/R5 audit 仍是 bundle 内修, IDE 不友好
- 拒绝原因: 本次会话用户明确要求拆分

### B. 完全重写 (jQuery-free)
- 优点: 现代架构, 体积可减半
- 缺点: 6+ 月工作量, 业务方风险高, 拖拽 / 编辑 / sortable 等行为难等价
- 拒绝原因: 工作量不可接受, ROI 低

### C. 原地拆 (B - architect agent 推荐)
- 优点: 4-6 周完成
- 缺点: 拆分过程业务方风险高 (无双跑保护), 单 commit revert 不够
- 拒绝原因: 用户选 Strangler Fig 隔离风险

### D. 用 AST 工具自动拆 (例如 webpack-bundle-unwrap)
- 优点: 自动化
- 缺点: webpack 4 bundle AST 还原工具不成熟; 拆分粒度不可控
- 拒绝原因: 工具依赖, 不可控

## Consequences

### 正面 (V2 完成后)
- 文件级 ESLint / Prettier / TypeScript inference 可启用
- IDE refactor (重命名 / 提取函数) 可用
- 多人协作可并行 (不同 module 不冲突)
- 单元测试可写 (vitest 覆盖 internal/ + renderers/ 等)
- 业务方可看清依赖 + 选择性 import
- bundle 体积可减 (tree-shaking 启用)
- 后续 audit 速度提升 (LSP / grep 准确)
- 任何后续重构 (例如 jQuery-free) 成本大降

### 负面 (开发期间)
- 7-10 周工作量 (单人) / 5-6 周 (双人)
- 业务方 P0-P12 期间无新功能 (但 main 仍可 hotfix)
- ADR-0007 PrintElementTypeRegistry export 在 V2 中可能需要再调整
- bundle.js 内既有 13 处 XSS / 47 处守卫 / 24 处 _safeCall 全部要迁移, 任一漏掉就是 regression

### 锁住的不变式 (V2 必须保留)
1. `PrintTemplate.destroy()` 幂等 + 所有公开方法守卫
2. 13 处 XSS 修复 pattern (.text() 默认 / .html() 仅 by-design)
3. _safeCall 业务回调隔离 (24 处)
4. _designerEventNs / _toolbarClickNs / 实例 namespace
5. nested-field reduce ?? "" 安全模式
6. addPrintElementTypes 双层 dedup
7. removePrintElementTypes dotted prefix
8. 80 处 console.* [hiprint] 前缀
9. async race protection (toPdf / getHtmlAsync / loadAllImages / sendByFragments / XHR)
10. design() _designed 幂等
11. deletePanel editingPanel re-select

每个 phase 完成时, grep 这 11 条不变式数量校验。

## 触发条件 (满足才执行)

- ✅ ADR-0001 detach 上游
- ✅ e2e baseline 稳定 (P1 后达 100%)
- ✅ helper 模块化基础已建
- ✅ 用户批准 (本次会话, plan 已批准)

## 终止条件 (任一触发回滚整个拆分)

- ❌ 业务方 vue-admin-main 反馈 V2 regression > 3 个 high severity
- ❌ V2 bundle 体积超过 v1 bundle 30%
- ❌ P1 e2e 补齐失败 (无法达 100% 覆盖)
- ❌ P9 PrintElementEntity 拆分破坏 70 处引用任一

终止时: git revert refactor/hiprint-v2 branch 全部 commit, 删 worktree, main 不动。

## Related

- ADR-0001 (fork detach) - V2 拆分的前提
- ADR-0004 (单 bundle 维护) - 本 ADR superseded
- ADR-0005 (destroy lifecycle) - V2 必须保留
- ADR-0007 (PrintElementTypeRegistry) - V2 可能调整命名
- `.claude/postmortem/001-013` - V2 实现时全部规避的 bug 类
- `docs/hiprint-v2-refactor-plan.md` - 详细 14 phase 路线图
- `C:\Users\12180\.claude\plans\memoized-booping-hearth.md` - 完整 plan 文件
