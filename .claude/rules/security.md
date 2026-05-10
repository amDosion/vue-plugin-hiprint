# Rule: 安全（XSS / 注入 / 凭据）

> 项目专属安全规则。在 `~/.claude/rules/common/security.md` 之上 specialize。

## 1. XSS 防护（最关键）

hiprint 是 jQuery + 业务数据混合渲染，XSS 是主要威胁。已修过 5 处历史 XSS（barcode/qrcode/element-list/business-card/template-card），有路径遵循。

### 强制规则

- ❌ **禁止** `$el.html(userValue)`，**任何**包含业务数据/用户输入的字符串
- ✅ 必须 `$el.text(userValue)`
- ✅ HTML 结构必须用 jQuery 链构建：
  ```js
  $('<div></div>').addClass('xxx').attr('title', desc).text(content)
  ```
- ❌ 禁止字符串拼接 HTML 后 `$(...)` 解析（`$('<div title="' + desc + '">' + content + '</div>')` 直接死刑）

### 例外（受控）

- 业务方主动传入的 `useHtml=true`（如 `setButtonText(key, html, true)`）— JSDoc 必须警告
- 内部固定字符串（i18n 翻译 / 硬编码 SVG）— 不含动态数据，OK

## 2. CSP 配合

业务方在 `index.html` 应配 strict CSP。本库**禁止**：

- ❌ `eval()`、`new Function('return ' + ...)` 中放 user input
- ✅ 唯一 `new Function()` 用法是 formatter / styler 字符串（设计时业务方写死的，不是 runtime user input）

## 3. 凭据管理

- ❌ 禁止任何 secret 进 bundle（API key / token / password）
- ✅ socket.io / IPP 等连接信息由业务方在 runtime 传入
- `.claude/settings.json` **不允许** 含真实 secret（template 在 `.claude/settings.local.json`，已 .gitignore）

## 4. 文件上传 / Image base64

- `tempimageBase64` 缓存只放 dataURL，不放原始 file 引用
- 业务方传入 image src 必须是 https / data:image — 不允许 file:// / javascript: 协议

## 5. 公开 API 安全约束

- `removePrintElementTypes('')` 必须拒绝（已修，line 8927+）
- `setDynamicFields(undefined)` 必须 throw（已修）
- `addPrintElementTypes` tid 唯一性 + console.warn

## 6. 升级 tgz 前 mandatory 安全 checklist

- [ ] grep `'\.html('` 整个 hiprint.bundle.js，确认所有调用都不接 user input
- [ ] grep `eval(` 确认无新增（除 formatter/styler 既有 2 处）
- [ ] 跑 `e2e/tests/xss.spec.ts` 8 个 case 全过
- [ ] grep `console.log` 看是否有打印 user input（敏感数据泄漏）

## 7. 安全响应协议（已发现漏洞时）

1. 立即停止当前任务
2. 用 `security-reviewer` agent 或 `/security-review` skill 全面扫
3. 修 CRITICAL 前不做其他改动
4. 已暴露 secret 立即轮换
5. 全仓库 grep 同类问题
6. 写 postmortem 到 `~/.claude/skills/postmortem-memory/` 或本仓库 `.claude/postmortem/`

## 8. 与全局 security.md 关系

`~/.claude/rules/common/security.md` 是通用 OWASP baseline。本规则 specialize 到 hiprint：
- 重点是 **XSS via .html()**（不是 SQL 注入 — 不适用）
- 重点是 **eval() of user input**（不是 input validation — 业务方负责）
- 重点是 **bundle.js 不能放 secret**（不是 env vars — 已是约定）
