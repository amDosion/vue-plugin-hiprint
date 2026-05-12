# Architecture Decision Records (ADR)

> 本仓库的关键架构决策固化记录。每条决策含背景、备选方案、决定、后果。

格式参考 Michael Nygard 的 ADR 模板，简化为：
- **Status** (proposed / accepted / deprecated / superseded)
- **Context** — 为什么需要决策
- **Decision** — 选了什么
- **Alternatives** — 看过的备选
- **Consequences** — 后续影响（正/负）

## Index

| ADR | 标题 | Status |
|---|---|---|
| [0001](0001-fork-detach-from-upstream.md) | 从上游 detach 为独立维护 fork | accepted |
| [0002](0002-vite-migration.md) | 从 Vue 2 + Webpack 迁移到 Vue 3 + Vite | accepted |
| [0003](0003-keep-jquery-core.md) | 保留 jQuery 内核 (不重写为纯 Vue) | accepted |
| [0004](0004-single-bundle-maintenance.md) | 单 bundle.js 内修源码而非拆模块 | accepted |
| [0005](0005-print-template-destroy-lifecycle.md) | 引入 PrintTemplate.destroy 生命周期 | accepted |
| [0006](0006-fixed-tgz-filename.md) | tgz 固定文件名 + 内部 version | accepted |
| [0007](0007-print-element-type-registry-export.md) | 暴露 PrintElementTypeRegistry export 分离 data 与 UI builder | accepted |
| [0008](0008-jspdf-upgrade-dompurify-cve.md) | jspdf 2.5 → 4.2.1 升级清 dompurify CVE | accepted |
| [0009](0009-fix-discipline-highest-priority.md) | 引入 fix-discipline 规则 (最高优先级) | accepted |
| [0010](0010-hiprint-bundle-refactor-strangler-fig.md) | V2 Strangler Fig 拆 bundle.js | superseded by 0011 |
| [0011](0011-v3-modern-ui-architecture.md) | V3 现代化 — 去 jQuery + Vue 3 + TS | accepted |
| [0024](0024-empty-canvas-click-deselect.md) | 空画布点击总是清选(V3 改善,放弃 V1 quirk) | accepted |
| [0025](0025-tab-key-cycles-selection.md) | Tab 键循环选中(V3 新增) | accepted |
| [0026](0026-arrow-nudge-step-v3.md) | 方向键 1pt + Shift=10pt(V3 行业标准) | accepted |
| [0027](0027-shift-resize-aspect-lock.md) | Shift+resize 锁定 aspect(V3 反转 V1) | accepted |
| [0028](0028-ctrl-z-input-guard.md) | Ctrl+Z 在 input 内走浏览器默认(V3 改善) | accepted |
| [0029](0029-quirks-rollup-decision-index.md) | V1 quirks 决议索引 + 整体策略 | accepted |

## When to write a new ADR

写 ADR 当：
- 决策影响整个项目结构 / 长期维护方向
- 选择有竞争方案，需要记录"为什么不选 B"
- 未来开发者会问"为什么这么干" → 现在写下来
- 决策被重新评估时（mark old ADR as superseded by new ADR）

不写 ADR 当：
- 普通 bug 修复（用 commit message + postmortem）
- 单文件重构
- 文档更新
