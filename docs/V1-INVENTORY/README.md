# V1-INVENTORY — 行为对照基线

> **2026-05-11 重置**: 之前的 V3 重构(P14–P22)以"我觉得"的 backlog 推进,
> 用户验证后明确反馈:必须按"V1 每个功能、作用、样式、行为生成文档,然后逐个对比"
> 的方式重做。本目录是行为对照重写的**唯一权威基线**。

## 工作流

```
┌─ Phase 1 (穷举) ──────────────────────────────────────────────┐
│  toolbar-and-shell.md      32+ toolbar / 5+ dialogs /          │
│                            keyboard / 23 API / 60+ opts        │
│  element-and-interaction.md  12 etypes / property panel /      │
│                              drag / resize / contextmenu /     │
│                              selection / clipboard             │
│  styles.md                 128 CSS classes / inline styles /   │
│                            动态 addClass / state 映射 /         │
│                            @media print / z-index 表           │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌─ Phase 2 (对照) ──────────────────────────────────────────────┐
│  ../V3-PARITY-MATRIX.md    每条 Phase 1 row →                  │
│                            ✅ done / 🟡 partial / 🔴 missing   │
│                            + V3 file:line + 差异说明           │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌─ Phase 3 (Backlog) ──────────────────────────────────────────┐
│  ~/.claude/plans/v3-parity-jira-v2.md                         │
│  Deterministic ticket 列表 (基于 Phase 2 🟡 + 🔴 行),         │
│  按 user-visible 重要度排 sprint, 每 ticket DoD:               │
│    e2e 测试锁定 V1 vs V3 行为字节级一致                        │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌─ Phase 4 (执行) ──────────────────────────────────────────────┐
│  按新 backlog 逐条 ticket 修 → 写 Playwright spec 对照 V1      │
│  视觉录制 + DOM 断言 → 不再有"猜测式漏修"                       │
└──────────────────────────────────────────────────────────────┘
```

## 与上一版方案的差异

| 维度 | 旧 (memoized-booping-hearth.md) | 新 (本目录) |
|---|---|---|
| 来源 | 2 个 Explore agent 凭印象出 150 stories | 3 个 Explore agent 穷举 bundle.js + CSS |
| 粒度 | 25 sprint ticket | 每个 V1 user-visible 行为 = 1 row |
| 完整性 | 我"觉得"覆盖了 80% | mechanical 100% (每行有 V1 file:line) |
| 验证 | 单元测试 mock 层 + 用户验证 | Playwright 视觉录制 + DOM 断言 |
| 漏修风险 | "我没想到这功能" → 漏 | 表里全有 → 不漏 |

## 状态

| Phase | Doc | 状态 | 期望产出 |
|---|---|---|---|
| 1A | toolbar-and-shell.md | 🟡 in-progress | 1000-2500 行 |
| 1B | element-and-interaction.md | 🟡 in-progress | 1500-3000 行 |
| 1C | styles.md | 🟡 in-progress | 800-1800 行 |
| 2 | ../V3-PARITY-MATRIX.md | ⏳ blocked by Phase 1 | mechanical 生成 |
| 3 | ~/.claude/plans/v3-parity-jira-v2.md | ⏳ blocked by Phase 2 | deterministic backlog |

## 引用规范

每行声明形式:
```
[bundle.js:LINE] / [hiprint.css:LINE] / [print-lock.css:LINE]
```
不允许"大约""可能"。Unknown → `Uncertain — needs verification` 并附可疑代码区间。

## 完成定义 (Phase 1 done)

- 3 个 inventory doc 总行数 ≥ 3500
- 每个表里每行都有 V1 file:line 引用
- 12 个 etype 全部覆盖
- 32+ toolbar 按钮全部覆盖
- 128 CSS class 全部覆盖
- 用户审过 (TBD)
