# PM-001: XSS via $el.html(userValue)

- **Category:** 安全
- **Severity:** CRITICAL
- **First detected:** 2026-04-26 (第 1 轮 security-reviewer 发现)
- **Status:** prevented

## What happened

5 处不同位置直接把业务数据 / 模板字段值 / 用户输入用 `$el.html(value)` 注入 DOM。攻击者只要在 testData / 模板 title / panel.name / item 字段中放 `<img src=x onerror=alert(1)>` 就能执行任意脚本。

**真实影响**：
- 业务方测试模板时，模板设计员可能贴入恶意 HTML（信任内部用户也不应假设）
- 公开模板市场（如果将来开放）会成为 XSS 散播渠道
- 已生成的 PDF 不直接受影响，但屏幕预览会被劫持

## Root cause

`hiprint.bundle.js` 是 jQuery 代码，jQuery `.html(str)` 解析 str 为 HTML。上游开发时假设业务数据"不会含 HTML"，但这是错误的安全模型——任何走数据路径的字符串都必须当作不可信。

## Where it appeared

5 处：

1. `src/hiprint/etypes/default-etyps-provider.js` barcode displayValue → 已修
2. `src/hiprint/hiprint.bundle.js:2173` 表格单元格 qrcode 渲染 → 已修
3. `src/hiprint/hiprint.bundle.js:11528+` 元素列表面板（createElementListPanel） → 已修
4. `src/hiprint/plugins/business-card.js` business card item → 已修
5. `src/hiprint/plugins/template-card.js` template card title/desc → 已修

## How it was fixed

统一 pattern：用 jQuery 链构建 DOM，对动态部分用 `.text()` / `.attr()`：

```js
// ❌ Before (XSS)
$el.html('<div title="' + desc + '"><span>' + content + '</span></div>')

// ✅ After (safe)
const $div = $('<div></div>').attr('title', desc)
const $span = $('<span></span>').text(content)
$div.append($span)
$el.empty().append($div)
```

或更紧凑：

```js
$el.empty()
  .append($('<div></div>').attr('title', desc).text(content))
```

## Why it kept happening

1. **复制粘贴**：写完一处 `.html(...)` 模板字符串，下次有类似场景就 copy
2. **上游遗留**：5 处中 4 处来自 hiprint 上游原始代码（detach 前不属我们修）
3. **审查盲区**：早期审查没把 XSS 列入必查清单
4. **业务数据假设**：开发者潜意识觉得"模板内部数据是可信的"

## Prevention

### 规则
- `.claude/rules/security.md` 第 1 节 — XSS 强制规则 + jQuery 链 pattern
- `.claude/rules/hiprint-bundle.md` 第 2 节 — 不变式 1: 安全 (XSS 防护)

### 自动检查
- `.claude/agents/hiprint-bundle-reviewer.md` 第 1 项 checklist:
  ```bash
  grep -nE "\.html\(" src/hiprint/hiprint.bundle.js | grep -vE "html\(\"\"\)|html\(''\)|html\(\`"
  ```
  逐条审参数是否含 user input
- `.claude/rules/security.md` 第 6 节 — 升级 tgz 前 mandatory checklist

### e2e
- `e2e/tests/xss.spec.ts` 8 个 case 锁住 5 个修复点 + 3 个边界（`<script>`/`onerror`/`javascript:` URL）

### 例外白名单
- 业务方主动传入 `useHtml=true`（如 `setButtonText(key, html, true)`）— JSDoc 必须警告调用者
- 内部固定字符串（i18n / 硬编码 SVG）— 不含动态数据
