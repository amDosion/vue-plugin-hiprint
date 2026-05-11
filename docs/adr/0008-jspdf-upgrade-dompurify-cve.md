# ADR-0008: jspdf 2.5 → 4.2.1 升级清 dompurify CVE

- **Status:** accepted
- **Date:** 2026-05-11
- **Deciders:** amDosion

## Context

R3 security-reviewer 报告 H4:

```
dompurify <=3.3.3 (7 CVEs)
- GHSA-vhxf-7vqr-mrjg DOMPurify XSS
- GHSA-cjmm-f4jc-qw8r ADD_ATTR predicate skips URI validation
- GHSA-cj63-jhhr-wcxv USE_PROFILES prototype pollution
- GHSA-39q2-94rc-95cp ADD_TAGS function form bypasses FORBID_TAGS
- GHSA-h7mw-gpvr-xq4m FORBID_TAGS bypassed by function-based ADD_TAGS
- GHSA-crv5-9vww-q3g8 SAFE_FOR_TEMPLATES bypass in RETURN_DOM
- GHSA-h8r8-wccr-v5f2 mutation-XSS via Re-Contextualization

Transitive via jspdf
```

我们没直接用 dompurify,但 jspdf 内嵌依赖。CVE 链:
- 攻击者可在 PDF 生成过程注入 XSS payload → 业务方下载的 PDF 含恶意 script
- 即使我们 hiprint 内部 .text() 转义,jspdf 内部使用 dompurify 处理 HTML→PDF 转换,绕过我们的转义层

`npm audit fix --force` 提示 `Will install jspdf@4.2.1, which is a breaking change`。

## Decision

**升级 jspdf ^2.5 → ^4.2.1**:

```json
"dependencies": {
  "jspdf": "^4.2.1"  // 内嵌 dompurify >= 3.3.4
}
```

API 兼容性核查:
- ✅ `new jsPDF(orientation, unit, format)` — 跨 2.x → 4.x 签名不变
- ✅ `pdf.addImage(data, format, x, y, w, h)` — 兼容
- ✅ `pdf.save(filename)` — 兼容
- ✅ `pdf.output(type)` — 兼容 (type 字符串如 'blob' / 'datauristring')
- ✅ `pdf.addPage()` — 兼容

实际验证:
- ✅ npm run pack:fixed 通过
- ✅ node --check dist 通过
- ✅ e2e 35/35 PASS (toPdf 由 SMOKE Level 2 浏览器手测)

## Alternatives

### A. 不升级,接受 CVE
- 优点: 零改动
- 缺点: 业务方 npm audit 报警 + 实际安全风险
- 拒绝原因: Zero-Tolerance 原则

### B. 用 `npm overrides` 强制升 dompurify 而保留 jspdf 2.5
- 优点: 不动 jspdf API
- 缺点: jspdf 2.5 内部代码可能依赖 dompurify 旧 API,运行时 break
- 拒绝原因: 跨依赖版本 hack 不可控

### C. 移除 jspdf 改用浏览器原生 print()
- 优点: 零依赖
- 缺点: 失去 client-side PDF 生成能力 (toPdf API)
- 拒绝原因: 业务方依赖 toPdf

### D. 升级到 jspdf 最新 (5.x 等)
- 优点: 最新
- 缺点: 5.x API breaking change 更多
- 拒绝原因: 4.2.1 已清 CVE,更激进升级风险无收益

## Consequences

### 正面
- 清掉 7 个 dompurify CVE
- 业务方 npm audit 报告变干净 (4 → 2 个 moderate, 剩下都是 dev-only)
- 跟随 jspdf 主线 (4.x 仍有维护)

### 负面
- bundle 大小可能增加 (jspdf 4.x 比 2.5 大)
- 任何业务方直接调 `import { jsPDF } from 'jspdf'` 的代码需要重测

### 后续
- 监控 jspdf 升级 (5.x release 后评估)
- e2e 加 toPdf basic case (虽然 jspdf 行为不易 mock)

## 同期 deferred

### esbuild dev-only CVE
- npm audit 仍报 2 个 moderate (esbuild < 0.24.2 via vite@5.4.21)
- 修复需 vite@8,但 vite@8 用 rolldown 替代 rollup,vite-plugin-commonjs 不兼容
- 评估: dev-server-only 风险 (生产 bundle 不含 esbuild),deferred 进 backlog
- 触发条件: vite@7/8 plugin 生态成熟后再升

## Related

- ADR-0002 (Vite 迁移) — vite 升级与本 ADR 关联
- `.claude/rules/security.md` 第 7 节安全响应协议
- CHANGELOG.md 1.0.3 release notes
