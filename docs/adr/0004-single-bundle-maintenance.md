# ADR-0004: 单 bundle.js 内修源码而非拆模块

- **Status:** superseded by [ADR-0010](0010-hiprint-bundle-refactor-strangler-fig.md) (2026-05-11)
- **Date:** 2026-04-22
- **Deciders:** amDosion

> ⚠️ **Superseded note** (2026-05-11): 当时拒绝拆分的理由 (上游对比 / 测试基础不足) 已不成立:
> - ADR-0001 已 detach 上游 (2026-04-15)
> - R1+R2+R3 audit 后 e2e 35/35 baseline + helper 模块化基础已建
>
> 拆分启动详见 ADR-0010。本 ADR 保留作历史记录。

## Context

`src/hiprint/hiprint.bundle.js` 是 14905 行单一文件，是 hiprint 上游的打包产物（webpack 打的 UMD bundle）。它包含：

- IIFE wrapper + webpack runtime shim（`__webpack_require__` 等）
- 拷贝进来的 `jquery-minicolors`、`jquery-print-style` 等小型 jQuery 插件源码
- hiprint 的 BasePrintElement / PrintTemplate / PrintPanel / PrintElementType 系列类
- buildToolbar / buildDesigner 顶层工厂函数

修 bug 时面临选择：

- A. 在这个 14905 行文件里改（"内修"）
- B. 拆成多个小文件（按区域，比如 `core/`、`elements/`、`toolbar/`、`designer/`）

## Decision

**继续在单 bundle.js 内修源码**：

- 任何 bug 修复 → 直接在 `hiprint.bundle.js` 改
- 改动必须用 `Edit` 工具（精确 patch）
- 不允许全量重写（用 `Write` 工具）
- 维护 `docs/CODE-BLUEPRINT.md` 提供 22 区域索引 + 行号定位

## Alternatives

### A. 拆成多个小文件
- 优点：模块化、可读性高、tree-shaking
- 缺点：
  - 拆分过程引入风险（极易破坏闭包/作用域）
  - 上游打包器是 webpack，拆分意味着重新维护打包配置
  - 拆完后再升 hiprint 上游版本无法对比 diff
  - 需要为每个模块写测试，但上游没测试基础
- **拒绝原因**：风险/收益比差

### B. 用 AST 工具自动拆分
- 优点：自动化
- 缺点：webpack 打包产物的 AST 很难还原成"原始模块结构"；工具不成熟
- **拒绝原因**：需要专门项目投入

### C. Fork 上游 hiprint 项目本身（不是 vue-plugin-hiprint）
- 优点：拿到 hiprint 真正的源码（拆分后的模块）
- 缺点：hiprint 上游也已不活跃；需要 fork + 自己打包；维护成本翻倍
- **拒绝原因**：不在当前精力范围

## Consequences

### 正面
- 修 bug 流程简单：grep 行号 → Edit
- diff 可读（一处只改几行）
- 上游升级（如果将来要做）只需对比 14905 行 → N+M 行
- e2e 锁住公开行为，内部重构不阻塞

### 负面
- 单文件 14905 行违反通常的"800 行上限"软规则
- IDE / type checker 难以处理大文件
- 新人看到这个文件会被吓退
- 行号容易因为细微修改偏移（影响 docs/CODEMAPS）

### 缓解措施
- `docs/CODE-BLUEPRINT.md` 22 区域索引 + 关键函数行号速查
- `docs/CODEMAPS/core-bundle.md` 函数级 codemap
- `.claude/agents/codemap-syncer.md` 改动后自动同步行号
- `.claude/rules/hiprint-bundle.md` 改动纪律 (Diff ≤ 100 行)
- `.claude/agents/hiprint-bundle-reviewer.md` 改完自动审

## Reconsidered When

如果未来：
- 上游 hiprint 项目复活并重写为 ES modules → 重新评估
- bundle.js 因频繁改动行号偏移到无法定位 → 考虑按 22 区域拆分

## Related

- ADR-0003 (保留 jQuery) — 不重写的前提
- `.claude/rules/hiprint-bundle.md` — 改动纪律
