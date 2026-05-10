# Rule: 修复纪律（最高优先级）

> **强约束规则**。优先级高于本仓库其他所有规则。冲突时本规则胜出。

## 1. 禁止补丁式修改（No Patch-Style Fixes）

修复 bug 必须**精准修到根因**，不允许"让症状消失"的补丁。

### 禁止的"补丁式"修改

- ❌ 在调用方加 `try-catch` 来掩盖底层 throw
  ```js
  // 错: 调用方吞错让"症状消失"
  try { tpl.print(data) } catch { /* swallow */ }
  ```
  应该: 找出 `print()` 为什么 throw（数据 schema / destroyed / 字段缺失）→ 修真正原因

- ❌ 改测试断言宽容来让红测试变绿
  ```js
  // 错
  expect(result).toBe(5)  →  expect(result).toBeDefined()
  ```
  应该: 失败测试是真信号；查实现为什么不返回 5；修实现而不是修测试

- ❌ 加 `if (xxx) return` / `if (xxx) return undefined` 跳过有问题的分支
  ```js
  // 错: "出错就跳过"
  if (!this.editingPanel) return  // 不应静默 skip
  ```
  应该: 论证为什么 editingPanel 可能为空 → 是 destroy 后调用？修守卫；是初始化时序？修时序

- ❌ 加 `console.error` 后继续跑（吞错继续）
  ```js
  // 错
  } catch (e) { console.error(e); /* 继续 */ }
  ```
  应该: catch 必须有明确处置（重抛、降级 fallback、用户 toast）；不允许"打印后假装没事"

- ❌ 改默认值/降阈值让边界 case 不再触发
  ```js
  // 错
  scaleMax: 5  →  scaleMax: 100  // 因为业务用 6 触发了 bug 就把上限拉高
  ```
  应该: 修 6 为什么 bug；不改默认避问题

- ❌ 在 fix 里"顺手"重构 / 改名 / 加日志
  bug 修复 PR 必须只含 bug 修复 + 回归测试，其他改动单独 PR

### 必须做的"精准修复"

1. **先问根因**: 为什么会有这个 bug？(数据 / 时序 / 类型 / 边界 / 假设)
2. **修最里层**: bug 出现在 view 层不代表修在 view 层；修最里层导致它的代码
3. **横向 grep**: 修完同 pattern 全仓库 grep，看其他位置是否有同样 bug
4. **写回归测试**: 测试名直接描述 root cause，不是"症状不出现"
5. **PM 蒸馏**: 同类 bug 出现 ≥ 2 次 → 写 `.claude/postmortem/NNN-*.md`

### 决策树

```
发现 bug → 必须先 /deep-system-debug 调研根因
             ↓
        找到根因？
        ├─ 找到 → 直接修根因 (即使 diff 跨多个文件)
        └─ 暂找不到 → STOP, 不允许"先 patch 让症状消失"
                      → 写 root-cause hypothesis 给用户审
                      → 用户批准 patch-as-stopgap 才允许 patch
                      → patch 必须有 TODO 注释 + .claude/postmortem/ 跟踪
```

## 2. Agent 输出纪律（无用输出 = ❌）

所有 agent 输出必须**精准、可执行、无填充**。

### 禁止的"无用输出"

- ❌ 长篇开场白 ("好的，让我分析一下..." / "I'll analyze...")
- ❌ 重复用户已知信息 (用户给了文件路径还回声它)
- ❌ "可能" / "建议" / "也许" 等 hedge 语 (除非是真的不确定)
- ❌ "Let me think step by step..." / "首先让我..." 等过程性废话
- ❌ 没有结论的"分析" — 看完不知道下一步做什么
- ❌ 列出所有看过的文件（除非用户问"你看了哪些文件"）
- ❌ 用 emoji 装饰 (用户没主动要求时)
- ❌ 重复 agent 自己 description / role 定义

### 必须的"精准输出"

- ✅ **直奔结论**: 第一句话给答案 (PASS / BLOCK / 具体修法 / 文件:行号)
- ✅ **引用 file:line**: 而不是描述"那个 PrintTemplate 类"
- ✅ **字面 code 段**: 用 ` ``` ` 块给出确切代码 / diff 片段
- ✅ **报告体量**: < 400 字 (复杂任务 ≤ 800 字)
- ✅ **格式按 agent 定义**: 不自创新格式
- ✅ **明确分级**: 🔴 BLOCK / 🟡 WARN / 🟢 INFO / ✅ PASS — 每条都给出级别
- ✅ **可执行 next**: 报告结尾给"下一步做什么" (除非已 PASS)

### Agent 输出模板

```markdown
## <agent 名> 报告

### 🔴 BLOCK (必须修)
- src/xxx.js:LLLL — <bug 描述> — <怎么修(1 行)>

### 🟡 WARN
- ...

### ✅ PASS 项
- <checklist 项> — 一行说明为什么通过

### Next
- <下一个 commit 该做什么 / 调用什么 agent / 跑什么命令>
```

### 例外（允许详细输出的场景）

- 用户明确要求 "详细分析" / "give me a deep dive"
- onboarding / 架构文档生成（写 docs，不是 review）
- post-mortem 蒸馏（要写历史 + 修复路径）

## 3. Zero-Tolerance Bug Policy（任何 bug 都必须修）

CRITICAL / HIGH / MEDIUM / LOW **全部**修复。不允许"MED/LOW 故意保留"。

### 禁止的"放过"借口

- ❌ "MED 暂时保留，后续再修" — 后续永远不会来
- ❌ "LOW 不影响功能跳过" — LOW 累积成技术债务
- ❌ "这是上游遗留不归我们修" — fork detached 后所有 bug 都归我们（见 ADR-0001）
- ❌ "测试覆盖不到的代码不用修" — 反过来，测试覆盖不到才更危险
- ❌ "这处代码没人调用" — 没人调用就删掉（见 refactor-cleaner agent）
- ❌ "改了会破坏 API 兼容" — 走 deprecation 流程（见 .claude/rules/api-contract.md）

### 必须的"全修"流程

1. **审查发现 N 项问题** → 全部进入修复队列（无论级别）
2. **修复顺序**: CRITICAL → HIGH → MEDIUM → LOW
3. **修完每条都写**:
   - commit message 带级别（如 `fix(security): [CRITICAL] XSS in element-list`）
   - 回归测试（e2e 或 unit）
   - 如果是 bug 类的第 ≥2 次出现 → 写 postmortem
4. **真不能修的特殊情况**:
   - 必须在 `plan` 中明确说明
   - 必须有 GitHub Issue 跟踪 + 截止日期
   - 必须 user 批准
   - commit message 标注 `[deferred: <issue-link>]`

### 例外名单（仅以下场景可暂不修）

- 改动会破坏明确的 API 契约 → 走 ADR + deprecation
- 修复需要架构级重写 (>1 周工作量) → 拆 epic + 立 issue
- 上游产物的格式问题 (如 webpack chunk 命名) → 不属于 bug

**没有"小问题不重要"的概念。**

## 4. 与其他规则的关系

- 本规则 > `.claude/rules/hiprint-bundle.md` — 即使 bundle 改动 ≤ 100 行，也不允许补丁式修
- 本规则 > `~/.claude/rules/deep-debug/core.md` — 同方向，本规则更严
- 本规则 > `~/.claude/rules/common/coding-style.md` — 修复纪律高于风格

## 5. 触发场景

每当：
- Claude 调用任何 agent → agent 输出必须按本规则格式
- Claude 写 fix commit → 必须满足"精准修复"
- 审查发现任何级别的 bug → 全部进入修复队列

## 6. 自我检查

每次 commit 前问自己：

- [ ] 这是补丁还是根因修复？
- [ ] 我有 grep 横向看其他位置吗？
- [ ] 我的 commit message 有级别标注吗？
- [ ] 回归测试写了吗？
- [ ] 同类问题是否需要 postmortem？

任一答 NO → 不允许 commit。
