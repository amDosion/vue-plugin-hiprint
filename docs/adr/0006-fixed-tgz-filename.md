# ADR-0006: tgz 固定文件名 + 内部 version

- **Status:** accepted
- **Date:** 2026-04-28
- **Deciders:** amDosion

## Context

业务方 (`vue-admin-main`) 通过本地 tgz 安装我们：

```json
"dependencies": {
  "vue-plugin-hiprint": "file:../vue-plugin-hiprint/vue-plugin-hiprint-1.0.0.tgz"
}
```

`npm pack` 默认生成的文件名是 `<name>-<version>.tgz`。如果我们升 `package.json` version 从 `1.0.0` → `1.0.1`，业务方的 `package.json` 也要改文件名引用，每次升级都要改两边。

业务方反馈：

- 内部 monorepo 升级流程繁琐（git diff 看到一堆文件名变化）
- CI 缓存 key 含文件名，每次升版本就缓存击穿

## Decision

**tgz 固定为 `vue-plugin-hiprint.tgz`**（不带版本号）：

- `package.json` 加 `pack:fixed` script：
  ```json
  "scripts": {
    "pack:fixed": "vite build && npm pack && node scripts/rename-tgz.js"
  }
  ```
- `scripts/rename-tgz.js` 把 `vue-plugin-hiprint-X.Y.Z.tgz` 改名为 `vue-plugin-hiprint.tgz`
- 内部 `package.json.version` 仍随 changelog 升（用于 npm cache key 区分）
- 业务方 `package.json` 永远写：
  ```json
  "vue-plugin-hiprint": "file:./vue-plugin-hiprint.tgz"
  ```

## Alternatives

### A. 业务方每次手改文件名
- 优点：跟 npm 默认行为一致
- 缺点：业务方多次反馈麻烦
- **拒绝原因**：升级流程的痛点

### B. 发布到内部 npm registry
- 优点：标准 npm 流程，版本管理清晰
- 缺点：当前没有内部 registry 基础设施；跨网络拉包慢
- **拒绝原因**：基础设施不到位（未来可能采纳）

### C. 用 git submodule
- 优点：版本是 commit hash
- 缺点：业务方 CI 需要 git access；编译时 vue-plugin-hiprint 需要重新 build
- **拒绝原因**：增加业务方 CI 复杂度

### D. monorepo 化（lerna / pnpm workspace）
- 优点：业务方与本仓库共享 package.json
- 缺点：vue-admin-main 是独立仓库，合并 monorepo 工程量大
- **拒绝原因**：组织架构不允许

## Consequences

### 正面
- 业务方 `package.json` 里 vue-plugin-hiprint 行永远不动
- 升级流程：本地 `npm run pack:fixed` → cp 到业务目录 → `npm install`
- npm 缓存基于内容 hash 不是文件名，固定名不会击穿缓存
- CI 缓存 key 简化

### 负面
- 失去文件名 → 版本的直观对应
- 业务方看不到升级的"版本号变化"（要看 CHANGELOG.md）
- npm registry 发布时如果将来要做，需要额外步骤（恢复版本号文件名）

### 缓解措施
- `CHANGELOG.md` 严格维护
- `package.json.version` 仍升（包内部能查到）
- SMOKE-TEST 必跑 + smoke-runner agent 防退化
- README 顶部说明此约定，避免新人困惑

## Related

- `scripts/rename-tgz.js` — 实现文件
- `docs/integration-guide.md` Section 2 — 业务方安装指引
- `docs/SMOKE-TEST.md` — 升级回归
- `.claude/agents/smoke-runner.md` — 自动化 SMOKE Level 1
