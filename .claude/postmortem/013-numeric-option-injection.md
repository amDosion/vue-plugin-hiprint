# PM-013: 数字 option 字符串拼接进 HTML 导致 XSS

- **Category:** 安全 / 输入校验
- **Severity:** CRITICAL
- **First detected:** 2026-05-11 (R3 security-reviewer C1)
- **Status:** prevented

## What happened

模板 JSON 中的 "数字" option (`longTextIndent`, `paperHeader`, `paperFooter` 等) 拼接进 HTML 字符串:

```js
return this.options.longTextIndent
  ? '<span style="margin-left:' + this.options.longTextIndent + 'pt"></span>'
  : '<span></span>';
```

`longTextIndent` 类型未强制,模板 JSON 设计器写 number 但**篡改后**可以传任意字符串:

```js
// 攻击 payload
{ longTextIndent: '1pt"></span><img src=x onerror=alert(1)>' }
// 拼接后:
// <span style="margin-left:1pt"></span><img src=x onerror=alert(1)>pt"></span>
// → img onerror 执行
```

## Root cause

JS 弱类型 + 字符串拼接的经典 XSS 组合:
- 期望: number
- 实际接受: any string
- 直接拼接进 HTML attribute 无转义

更深层: option schema 没有 runtime 类型校验。

## Where it appeared

`hiprint.bundle.js:9760` `getLongTextIndent`

类似可能存在但**已审查**: paperHeader/paperFooter setValue (5318/5406) 已加 isNaN 校验 → 默认值 fallback (R2 修复)。

## How it was fixed

```js
e.prototype.getLongTextIndent = function () {
  // [XSS C1] longTextIndent 来自模板 JSON, 强制 parseInt + clamp(0, ∞) 阻止注入
  var indent = parseInt(this.options.longTextIndent, 10);
  if (!isFinite(indent) || indent < 0) indent = 0;
  return indent > 0
    ? '<span class="long-text-indent" style="margin-left:' + indent + 'pt"></span>'
    : '<span class="long-text-indent"></span>';
};
```

**关键**: `parseInt('1pt"><img>', 10)` → `1`. 任何注入字符在 parseInt 看来都是后缀,被忽略。

## Why it kept happening

1. **设计假设 "用户在设计器内填数字"**: 但模板 JSON 是 portable,任何来源都可能注入
2. **XSS 路径隐蔽**: 不是显式 `.html(userData)` 而是 `.html('safe-prefix' + userData + 'safe-suffix')`,grep `.html(` 找不到
3. **类型系统弱**: JS 无 runtime 类型校验,option 接受 any
4. **复制粘贴**: pt unit 拼接是 hiprint 普遍模式 (margin-left/top/font-size 等)

## Prevention

### 规则
- `.claude/rules/security.md` 加: 任何数字 option 拼接进 HTML 必须 `parseFloat/parseInt + isFinite + clamp`

### 自动检查
- `.claude/agents/hiprint-bundle-reviewer.md` 加 checklist:
  ```bash
  grep -nE "\.html\([^)]*\+\s*this\.options\." src/hiprint/hiprint.bundle.js
  grep -nE "['\"][^'\"]*\+\s*this\.options\." src/hiprint/hiprint.bundle.js
  ```
  逐条审参数是否数字类型 + 是否 parseInt

### 横向 audit
- 全 bundle grep `style="[^"]*\+` + `style="[^"]*' \+` 找"style attribute 字符串拼接 + 变量"
- 找到的每处都加 parseInt/parseFloat + clamp

### Schema 校验 (defense-in-depth)
- 业务方在 setTemplate(json) 时应做 schema 校验 (Zod / ajv)
- hiprint 内部加 ingestion guard:
  ```js
  if (typeof opts.longTextIndent !== 'number' && opts.longTextIndent != null) {
    console.warn('[hiprint] longTextIndent: expected number, got', typeof opts.longTextIndent);
  }
  ```

### 教训
- 字符串拼接 + user-controlled value = XSS,即使包裹"看似安全"的前后缀
- 强类型转换 (parseInt/parseFloat) 是廉价 + 有效的防御
- 任何 "数字字段" 都应被假设可能传字符串
