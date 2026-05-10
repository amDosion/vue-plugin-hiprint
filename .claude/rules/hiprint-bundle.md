# Rule: 改 hiprint.bundle.js 的纪律

> 适用范围：`src/hiprint/hiprint.bundle.js`（14905 行单文件）的任何改动。
>
> 这是 high-risk path（见 `CLAUDE.md`），改动易引入跨层 bug。

## 1. 改动前必须做

- [ ] 用 `Grep` / `Read` 定位精确行号 + 阅读上下文 ±20 行
- [ ] 查 `docs/CODE-BLUEPRINT.md` 该行所在的"区域"和"职责"
- [ ] 查 `docs/CODEMAPS/core-bundle.md` 该函数的依赖
- [ ] 列出"我即将改动的行为可能影响"的所有调用方（grep 函数名）
- [ ] 如果改 BasePrintElement / PrintTemplate / PrintPanel 类方法 → 必须列改动类型：
  - 新增方法（不破坏）
  - 改方法签名（**破坏 — 走 deep-system-debug**）
  - 改方法行为但保持签名（评估调用方，可能仍需 deep-system-debug）

## 2. 必须遵守的不变式

### 安全（XSS 防护）

- ❌ **禁止** `.html(userValue)` — `userValue` 包括 `options.title`、`field` 取出的 data、`testData`、业务 dialog 的 item 字段
- ✅ 用 `.text(userValue)`
- ✅ 必须 HTML 时用 jQuery 链：`$('<div></div>').addClass('xxx').text(userValue)`
- ✅ 已修过的 5 处 XSS 是先例参考（barcode/qrcode/element-list/business-card/template-card）

### 嵌套字段 reduce

- ❌ **禁止** `f.split('.').reduce((a, c) => a ? a[c] : t[c], !1)`（中间值 0/false/null 会回退到根）
- ✅ 必须 `f.split('.').reduce((a, c) => (a != null ? a[c] : undefined), t)`

### destroy 守卫

- 给 `PrintTemplate` 公开方法加 `if (this._destroyed)` 守卫
- 守卫错误返回值要明确：`undefined` / `new st({panels:[]})` / `$('<div></div>')`，不要静默成功
- 加新公开方法时**必须**加守卫

### addPrintElementTypes 去重

- 同 tid 多次注册 → 用 `incomingTids[tid]=true` + per-element 过滤
- ❌ 禁止只过滤 `allElementTypes` 平铺缓存而不过滤 `this[moduleName]` 桶

### removePrintElementTypes prefix

- 必须用 `tid === t || tid.indexOf(t + '.') === 0`
- ❌ 禁止 `tid.startsWith(t)`（会误删 `order` vs `order_v2`）

### 全局事件 namespace

- `$(document).on('xxx', handler)` → **必须**带 namespace（如 `'click.hiprintToolbar' + uid`）
- toolbar / designer 实例 ID 必须 `Date.now() + Math.random()`，**禁止** 自增 `_uid`（多 iframe 共享失败）

### 业务回调 try-catch

- 所有 `opts.onXxx(...)` 调用必须包 `try-catch`
- catch 内 `console.error('[hiprint] onXxx threw:', err)` 带前缀

## 3. 改动后必须做

- [ ] 跑 `npm run pack:fixed`（如果 build 失败 → 回滚分析）
- [ ] 跑 `node --check dist/vue-plugin-hiprint.cjs.js && node --check dist/vue-plugin-hiprint.esm.js`
- [ ] 跑 `docs/SMOKE-TEST.md` Level 1 + Level 2（浏览器 DevTools 8 项断言）
- [ ] 如果改了核心生命周期 / API 公开行为 → 跑 `npm run test:e2e`
- [ ] 改完更新 `docs/CODEMAPS/core-bundle.md`（行号偏移）
- [ ] commit message 必须含：影响的"区域名"（来自 CODE-BLUEPRINT 22 区域索引）

## 4. 不允许的"改动模式"

- ❌ 顺手添加日志 / 顺手改名变量 / 顺手重构 — 一次只改一件事
- ❌ 用 `console.log` — 一律用 `console.warn('[hiprint] xxx:', err)`
- ❌ 引入新依赖（`npm install xxx` 在 bundle 路径） — bundle.js 是上游产物，不能加新 import
- ❌ 修复测试断言而不是修代码 — 失败测试是真 bug 信号

## 5. Diff 体量

- 单次 bundle.js 改动 ≤ 100 行（除非整段重构 + plan 批准）
- 每处改动必须有 commit message + 行号 + "为什么这么改"

## 与全局规则的关系

- `~/.claude/rules/common/coding-style.md` — 通用编码风格 baseline
- `~/.claude/rules/deep-debug/core.md` — 改高风险路径流程 baseline
- 本规则在两者之上，专门针对 hiprint.bundle.js 的特殊性
