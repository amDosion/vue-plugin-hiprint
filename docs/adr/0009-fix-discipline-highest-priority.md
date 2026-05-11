# ADR-0009: 引入 fix-discipline 规则 (最高优先级)

- **Status:** accepted
- **Date:** 2026-05-11
- **Deciders:** amDosion

## Context

R1/R2/R3 累计跑了 ~30 个 agent 审查,发现 ~85+ 项问题。审查过程中观察到:

1. **agent 报告冗长**: 默认 reviewer 输出 1000+ 字,含开场白 / hedge / emoji,信号噪声比低
2. **修复倾向 patch**: 有时为快速过测试,改宽断言或加 if-return 跳过,而非找根因
3. **LOW/MED 容易被搁置**: "暂时保留,后续再修" 后续永远不来,累积技术债

需要把这些教训固化为强约束规则,而不是每次审查时口头提醒。

## Decision

**新建 `.claude/rules/fix-discipline.md`,优先级高于所有其他项目规则**:

### 三条强约束

1. **禁止补丁式修改 (No Patch-Style Fixes)**
   - 禁止: 调用方加 try-catch 掩盖底层 throw / 改宽断言 / if-return 跳过分支 / 改默认值绕过 / fix 中顺手重构
   - 必须: 先 deep-system-debug 找根因 → 修最里层 → 横向 grep → 写回归测试 → PM 蒸馏

2. **Agent 输出纪律 (Output Discipline)**
   - 禁止: 开场白 / hedge 语 / emoji 装饰 / 列读过的文件 / 重复 description
   - 必须: 直奔结论 / file:line / 字面 code 段 / ≤ 400 字 / 按模板 (🔴 BLOCK / 🟡 WARN / 🟢 INFO / ✅ PASS)

3. **Zero-Tolerance Bug Policy**
   - CRITICAL/HIGH/MEDIUM/LOW 全部修
   - 禁止借口: "暂时保留" / "LOW 不影响" / "上游遗留不归我们" / "测试覆盖不到不用修"
   - 例外: 架构级重写 (> 1 周) → 拆 epic + Issue + user 批准

### 引用关系

```
CLAUDE.md (项目入口)
  → .claude/rules/fix-discipline.md (最高优先级)
  → .claude/rules/hiprint-bundle.md
  → .claude/rules/api-contract.md
  → .claude/rules/testing.md
  → .claude/rules/security.md
  → .claude/rules/jquery-vue3.md
```

`.claude/settings.json` 中 `_priority_note: "fix-discipline.md 优先级最高,与其他规则冲突时胜出"`。

3 个项目 agent (`hiprint-bundle-reviewer` / `smoke-runner` / `codemap-syncer`) 顶部强制注明 "按 fix-discipline.md 第 2 节输出纪律"。

## Alternatives

### A. 把约束写进 CLAUDE.md 顶部 (不建独立 rule 文件)
- 优点: 简洁
- 缺点: CLAUDE.md 变长难维护;agent prompt 引用需要拷贝
- 拒绝原因: 强约束应该是独立文件方便引用

### B. 把约束写进各个 agent 定义 (重复)
- 优点: agent 自带规则
- 缺点: 重复维护,改一处要改多处
- 拒绝原因: 违反 DRY

### C. 不写规则,靠每次审查时口头提醒
- 优点: 灵活
- 缺点: 已经证明无效 (R1 之前就有同类问题反复出现)
- 拒绝原因: 试过了不 work

## Consequences

### 正面
- Agent 报告字数从 ~1500 → ~400 (实测 R2/R3 数据)
- LOW/MED 项目从 "保留" 变为 "进队列",R3 全清
- Fix commit 100% 含根因分析 + 横向 grep
- 新加入开发者一份文档就理解项目纪律
- 与 deep-debug 全局规则形成层级 (project > global)

### 负面
- agent 报告偶尔感觉"太干",失去一些 context
- "Zero-Tolerance" 严格执行时单 PR 改动大
- 维护一个额外的规则文件

### 教训
- 软提示 (口头) < 硬规则 (rules file) < 自动门禁 (hook)
- 当前我们停在硬规则,后续可加 PreToolUse hook 强制扫 .html(...) / console.log 等模式

## Related

- ADR-0001 (fork detach) — 我们能定自己的规则
- `~/.claude/rules/deep-debug/core.md` — 全局工程纪律
- `.claude/rules/fix-discipline.md` — 本规则正文
- PM-001 ~ PM-013 — 每个 postmortem 都引用 fix-discipline 作为 Prevention 来源
