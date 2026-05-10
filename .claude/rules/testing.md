# Rule: 测试约束

> 适用范围：本仓库所有改动的测试要求。

## 1. 测试基础设施

- **Playwright E2E**：`e2e/` 目录，已配置（`e2e/playwright.config.ts`），CI 自动跑（`.github/workflows/e2e.yml`）
- **SMOKE-TEST**：`docs/SMOKE-TEST.md` 三档（Level 1 Bash / 2 浏览器 / 3 jsdom 自动化）
- **Vitest 单元测试**：未启用（计划 P0，见 `docs/CODE-BLUEPRINT.md` 引用的 architect 报告）

## 2. 改动后必须跑

| 改动类型 | 必须 |
|---|---|
| 改 `hiprint.bundle.js` | SMOKE Level 1 + Level 2 + 改动相关的 e2e spec |
| 改 `src/index.js` | SMOKE Level 1 + `e2e/tests/api-contract.spec.ts`（如果新加 export 自己加 case）|
| 改 `src/hiprint/css/*` | SMOKE Level 2 + 视觉手测 |
| 新功能（新 opts / 新 method）| 必须加 e2e spec |
| 修 bug | **必须先写失败测试再修**（regression-fix skill 规则）|

## 3. e2e 测试规则

- 测试文件命名：`e2e/tests/<feature>.spec.ts`
- 每文件 ≥ 3 cases，覆盖：happy / edge / failure
- 用 `e2e/tests/helpers/wait-for-hiprint.ts` 等待 `window.hiprint.PrintTemplate` 就绪
- fixture 数据放 `e2e/tests/fixtures/*.json`
- ❌ 禁止用 mock 替代真实 hiprint 加载（dev server 必须真实启动）
- ❌ 禁止 `expect(true).toBe(true)` 占位
- ❌ 禁止 `test.skip` 跳过失败测试 — 失败测试是真信号

## 4. SMOKE Level 1 Bash 验证（升级 tgz 后必跑）

```bash
npm run pack:fixed
node --check dist/vue-plugin-hiprint.cjs.js
node --check dist/vue-plugin-hiprint.esm.js
node -e "const fs=require('fs');const s=fs.statSync('vue-plugin-hiprint.tgz').size; \
  if(s<800000||s>2000000){process.exit(1)}"
```

任一失败 → 不允许 push tgz 给业务方。

## 5. SMOKE Level 2 浏览器验证（修 bundle 必跑）

按 `docs/SMOKE-TEST.md` Level 2 在 DevTools Console 跑 8 项断言。8 项全 ✓ 才算通过。

## 6. 失败测试分类（来自 deep-debug/testing.md）

每个 failing test 必须归入：

| 类别 | 含义 | 处置 |
|---|---|---|
| caused-by-this-change | 本次改动引入 | 必须修 |
| pre-existing | 改动前已 fail | PR 标注，不修可放过 |
| flaky | 间歇性失败 | 不允许 retry 掩盖；记录到 flaky list |
| environment | 环境/网络 | 修环境，不改测试 |

## 7. CI 集成

- `.github/workflows/e2e.yml` 已配置 push/PR 触发
- 失败的 PR 不允许 merge（branch protection 强制）
- artifact 保留：失败截图、视频、trace（Playwright 默认）

## 8. 与全局 testing.md 关系

`~/.claude/rules/common/testing.md` 是通用 80% 覆盖目标。本规则 specialize：
- 80% 目标暂未达到（0 单元测试），**当前最低**：所有新 feature 必须有 e2e
- TDD 流程暂未强制，但修 bug 时**必须**先写失败测试
