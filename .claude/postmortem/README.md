# Postmortem Memory

> 项目的事后复盘库。每个 postmortem 把"曾经发生过的 bug 类"蒸馏成"未来如何避免"。
>
> 来源：5 轮 ~85 项审查发现 + 修复历史。

## 目的

记录到这里的不是单个 bug 的 commit，而是 **bug 类**：同一个根因催生过多次相似问题，需要规则化。

## Index

| Postmortem | 类别 | Severity | Prevention 已落 |
|---|---|---|---|
| [PM-001 XSS via .html()](001-xss-via-html.md) | 安全 | CRITICAL | ✅ rules/security.md + agent checklist |
| [PM-002 嵌套字段 reduce 回退根](002-nested-field-reduce.md) | 数据正确性 | HIGH | ✅ rules/hiprint-bundle.md + agent checklist |
| [PM-003 destroy 守卫缺失](003-destroy-guard.md) | 资源管理 | HIGH | ✅ ADR-0005 + e2e tests |
| [PM-004 全局事件 namespace 缺失](004-global-event-namespace.md) | 多实例隔离 | HIGH | ✅ rules/hiprint-bundle.md |
| [PM-005 _uid 自增冲突](005-uid-collision.md) | 多实例隔离 | MEDIUM | ✅ Date.now()+Math.random() pattern |
| [PM-006 业务回调未隔离](006-business-callback-throw.md) | 健壮性 | MEDIUM | ✅ rules/hiprint-bundle.md |
| [PM-007 addPrintElementTypes tid 冲突](007-tid-dedup.md) | API 契约 | MEDIUM | ✅ Bucket-level dedup + warn |
| [PM-008 removePrintElementTypes prefix 误删](008-remove-prefix-mismatch.md) | API 契约 | HIGH | ✅ exact match + dotted prefix |
| [PM-009 Promise.resolve(syncThrow) 绕 .catch](009-promise-sync-throw.md) | 异步 | HIGH | ✅ try 包外层 + Promise.resolve |
| [PM-010 destroy 后 async stale resolve](010-async-stale-resolve.md) | 异步竞态 | HIGH | ✅ _destroyed 入口检查 + .catch + abort reject |
| [PM-011 XHR 网络错静默](011-xhr-silent-network-failure.md) | silent failure | HIGH | ✅ onerror/ontimeout + status 分类 |
| [PM-012 design() 非幂等](012-design-idempotency.md) | 资源管理 | HIGH | ✅ _designed flag + cleanup |
| [PM-013 数字 option 拼接 XSS](013-numeric-option-injection.md) | 安全 | CRITICAL | ✅ parseInt + isFinite + clamp |

## 写新 Postmortem 时的模板

每个 postmortem 必须含：

```markdown
# PM-NNN: <短标题>

- **Category:** 安全 / 数据正确性 / 资源管理 / 多实例 / API / 性能
- **Severity:** CRITICAL / HIGH / MEDIUM / LOW
- **First detected:** YYYY-MM-DD (第 N 轮审查 / 哪个 agent 发现)
- **Status:** prevented (已规则化) / monitoring (有方法但未自动化)

## What happened
具体表现 + 影响

## Root cause
代码层面真正原因 (具体到 reduce 回调 / 闭包 / 命名空间)

## Where it appeared
相同根因的所有出现地点 (file:line)

## How it was fixed
具体修复 pattern + 一处 before/after diff

## Why it kept happening
为什么这个 class 会反复出现 (复制粘贴 / 上游遗留 / 缺少守卫)

## Prevention
- 规则: rules/<file>.md 哪一节
- 自动检查: agent / hook / lint
- e2e/单测: file:line
```

## 阅读顺序建议

1. 看 Index — 了解都有哪些 class
2. 重点读 **CRITICAL/HIGH**: PM-001/002/003/004/008
3. Onboarding 时读 1-2 篇 → 培养"这种代码长这样有没有问题"的直觉
