# Claude Code Working Rules — vue-plugin-hiprint

> 项目级 Claude 规则。每次 Claude 接手该仓库的任务时自动加载。

## Project context

`amDosion/vue-plugin-hiprint` — 上游 `CcSimple/vue-plugin-hiprint` 的独立维护 fork，已 detach 为私有项目。

**技术栈：**
- Vue 3.4+ + Vite 5（从 Vue 2 + Webpack 迁移完成）
- jQuery 3.x + ant-design-vue 4 + jspdf 2.5（核心打印 + UI）
- bwip-js / JsBarcode / QRCode（条码/二维码）
- 单一 14905 行 `hiprint.bundle.js`（上游打包产物，我们持续在内修源码）

**分发模式：**
- `vue-plugin-hiprint.tgz` 文件名固定，内部版本号控制
- 私有分发给 `vue-admin-main` 等业务方
- 未来考虑发布到内部 npm registry（`@amDosion/vue-plugin-hiprint`）

## Operating rules — 优先级层叠

### Baseline (全局,自动加载)

- `~/.claude/rules/common/` — 通用工程纪律
- `~/.claude/rules/web/` — 前端规则
- `~/.claude/rules/typescript/` — JS/TS 规则
- `~/.claude/rules/zh/` — 中文语境
- `~/.claude/rules/deep-debug/` — 反复 bug + 高风险目录主动启用

### Project-specific (本仓库专属)

- `.claude/rules/fix-discipline.md` — **修复纪律（最高优先级）** ⚠️
- `.claude/rules/hiprint-bundle.md` — 改 bundle.js 的纪律
- `.claude/rules/api-contract.md` — public API surface 契约
- `.claude/rules/testing.md` — 测试约束（SMOKE-TEST + e2e/）
- `.claude/rules/security.md` — XSS 防护 + jQuery `.text/.html` 规则
- `.claude/rules/jquery-vue3.md` — jQuery + Vue 3 共存指南

**冲突优先级**：fix-discipline > 其他项目规则 > 全局规则。

## 三条强约束（来自 fix-discipline.md，永远生效）

1. **禁止补丁式修改** — 必须精准修根因；调用方加 try-catch 掩盖、改宽断言、加 if-return 跳过都是补丁，禁止
2. **Agent 输出纪律** — 直奔结论、引用 file:line、< 400 字、按 agent 模板、无填充语
3. **Zero-Tolerance Bug Policy** — CRITICAL/HIGH/MEDIUM/LOW **全部**修；"暂时保留"等于不会修；上游遗留 = 我们的 bug

## High-risk paths

下列路径任何改动 → 必须走 `deep-system-debug` 流程（`~/.claude/rules/deep-debug/core.md`）：

```
src/hiprint/hiprint.bundle.js     ← 14905 行单文件,改动易引入跨层 bug
src/index.js                      ← 公开 API 契约,必须保持向后兼容
src/hiprint/etypes/*              ← 元素类型定义,影响所有业务模板
src/hiprint/css/print-lock.css    ← paper:relative 等屏幕样式,改动需测打印输出
.github/workflows/                ← CI 配置
package.json (deps)               ← 依赖升级走独立 worktree
```

修复流程：

```
1. /deep-system-debug 流程
2. 产出 System Understanding Report
3. 写入 .claude/.approved-deep-debug-plan
4. 实施修复 + 写回归测试 (e2e/tests/*.spec.ts)
5. 跑 SMOKE-TEST Level 1 + 2
6. commit + push
```

## Required verification commands

每次声称"已完成"前，必须跑下列命令并贴输出片段：

```bash
typecheck:    not applicable (vanilla JS, 无 .ts 源码)
build:        npm run pack:fixed       # vite build + npm pack + rename
syntax:       node --check dist/vue-plugin-hiprint.cjs.js && \
              node --check dist/vue-plugin-hiprint.esm.js
e2e:          npm run test:e2e         # Playwright (需要 npm i -D @playwright/test 一次)
smoke-l1:     见 docs/SMOKE-TEST.md Level 1 (Bash + node --check, 30 秒)
smoke-l2:     见 docs/SMOKE-TEST.md Level 2 (浏览器 DevTools, 5 分钟)
```

## Project-specific agents

`.claude/agents/`:
- `hiprint-bundle-reviewer.md` — bundle.js 改动专审（重点 XSS / destroy 守卫 / nested field）
- `smoke-runner.md` — 自动跑 SMOKE-TEST Level 1 + 报告
- `codemap-syncer.md` — bundle.js 改动后同步 `docs/CODEMAPS/*`

## Key references (按学习顺序)

| 顺序 | 文档 | 用途 |
|---|---|---|
| 1 | [docs/CODE-BLUEPRINT.md](docs/CODE-BLUEPRINT.md) | 14905 行 bundle.js 完整代码导航 |
| 2 | [docs/CODEMAPS/INDEX.md](docs/CODEMAPS/INDEX.md) | 模块级 codemap 总览 |
| 3 | [docs/API-REFERENCE.md](docs/API-REFERENCE.md) | 23 个 export 速查 |
| 4 | [docs/TOOLBAR-ARCHITECTURE.md](docs/TOOLBAR-ARCHITECTURE.md) | 工具栏 + 动态注入架构 |
| 5 | [docs/integration-guide.md](docs/integration-guide.md) | 业务方完整集成指南 |
| 6 | [docs/SMOKE-TEST.md](docs/SMOKE-TEST.md) | 升级 tgz 后回归验证 |
| 7 | [docs/build-designer-vue-integration.md](docs/build-designer-vue-integration.md) | buildDesigner Vue 多实例修复 |

## Communication

- 中文交流（用户偏好）
- 改动 bundle.js 前，先用 `/deep-system-debug` 调研后再 plan
- 测试用真实 Playwright（已建好 `e2e/`），别用 mock
- 不要轻易跑 `git push --force` — branch protection 已启用
