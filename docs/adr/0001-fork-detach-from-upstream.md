# ADR-0001: 从上游 detach 为独立维护 fork

- **Status:** accepted
- **Date:** 2026-04-15
- **Deciders:** amDosion (项目维护者)

## Context

`vue-plugin-hiprint` 的上游是 `CcSimple/vue-plugin-hiprint`（基于更上游 hiprint 的 Vue 包装层）。我们 fork 后发现：

1. **上游响应慢**：业务关键 bug（XSS / multi-instance 污染 / destroy 缺失）等待上游修复不现实
2. **上游同步成本高**：上游有大量我们不需要的演示代码、文档、CI 工作流
3. **上游不支持 Vue 3**：我们要从 Vue 2 + Webpack 迁到 Vue 3 + Vite（见 ADR-0002）
4. **业务专属定制**：业务方需求与上游路线不一致（如 `field` 必填、`textType:barcode/qrcode` 统一、固定 tgz 名）

## Decision

**与上游 detach**：

- 删除 `upstream` remote 引用
- 删除上游专属文章、群组、捐赠、star history 等 README 段落
- README 顶部明确标注 fork 状态、当前维护者、三层 license 关系
- 自己维护 main 分支，不接收上游 PR（也不发送 PR 回上游）
- 重置 commit 历史为本地 main 为最新（force-push 一次清理）

## Alternatives

### A. 保持 fork 状态 + 定期 cherry-pick 上游
- 优点：享受上游 bug 修复
- 缺点：合并冲突频繁；上游路线偏离我们需求；本地修改容易在 cherry-pick 中丢
- **拒绝原因**：上游 bug 修复速度慢于我们自己修；冲突成本 > 收益

### B. 重写为纯 Vue 3 项目
- 优点：摆脱 jQuery
- 缺点：14905 行 hiprint.bundle.js 是核心，重写约 6 人月成本
- **拒绝原因**：见 ADR-0003，jQuery 内核保留是更务实的选择

### C. fork 为公开开源 + 接受社区 PR
- 优点：社区贡献
- 缺点：私有业务依赖（vue-admin-main）暴露技术栈；维护社区 PR 成本
- **拒绝原因**：当前阶段是私有项目，开源时机未到

## Consequences

### 正面
- 修 bug 速度：发现 → 修 → 业务方拿到新 tgz 在 1 小时内
- 自由迁移技术栈（Vite, Vue 3）
- 文档可以聚焦本仓库特殊性，不背上游历史
- branch protection + admin force-push 应急通道

### 负面
- 失去上游 bug 修复（需要自己 grep 上游 issues）
- 长远看代码与上游分歧越大，将来再合并越难
- 维护责任完全在我们：每个修复都要经过 SMOKE Level 2 + e2e

### 缓解措施
- 监控上游 commits，关键安全/正确性 fix 手动评估是否 cherry-pick
- 完整 docs (CODE-BLUEPRINT/CODEMAPS/INDEX) 让代码可由其他人接手
- e2e + SMOKE 锁住关键行为，防止退化

## Related

- ADR-0002 (Vite 迁移) — detach 后才能改技术栈
- ADR-0006 (固定 tgz 名) — detach 后自定义分发流程
