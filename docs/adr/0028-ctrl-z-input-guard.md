# ADR-0028: Ctrl+Z 在 `<input>` 内走浏览器默认(V3 改善,放弃 V1 quirk)

- **Status:** accepted
- **Date:** 2026-05-12
- **Deciders:** amDosion
- **Related:** ADR-0011 (V3 现代化), TKT-168 (Sprint 22d), V3-PARITY-MATRIX 07-interactions §13 + §11

## Context

V1 inventory `docs/V1-INVENTORY/interactions.md` §11 quirk #9:
- V1 全局 keydown 监听器在 `<input>` / `<textarea>` 焦点内仍触发 `Ctrl+Z` template undo
- 用户在 property panel 文字字段编辑文本时,Ctrl+Z 不撤销 input 内容,而是撤销了上一个 element 移动
- TEXTAREA guard 在 V1 line ~10960 位置错误 → 在 `Ctrl+Z` 分支**之后**

V3 `keyboard.ts:234` 实现 guard:
- 检测 `event.target instanceof HTMLInputElement` 或 `HTMLTextAreaElement` 或 `contentEditable === 'true'`
- 若是 → 跳过 template undo,走浏览器默认 undo(input.value 历史)

## Decision

**保留 V3 行为**(input 内 Ctrl+Z 走浏览器默认)。**关闭** V1 quirk。

## Rationale

1. **V1 行为破坏直觉**: 文字编辑撤销字符是直觉,撤销 element 移动是出乎意料。
2. **行业标准**: 所有 GUI app(IDE/document editor/design tool)在 input focus 时 Ctrl+Z 都走 input。
3. **a11y**: 屏幕阅读器 / 辅助技术用户依赖 input native undo。
4. **vue-admin-main 用户调研**: 0 用户依赖 V1 quirk。

## Consequences

- 若 inline-edit(TextElement contenteditable Sprint 22b BA + 22d DC TKT-160)处于 active:
  - Ctrl+Z 走浏览器默认 — 撤销 inline-edit 字符
  - 用户先 Enter/Esc 退出 inline-edit,然后 Ctrl+Z 才撤销 template
- 测试: `interactions/__tests__/keyboard.spec.ts` 锁定:input focus 时 Ctrl+Z 不触发 template undo

## Mitigation

- 若业务方需要还原 V1 quirk,可通过 `keyboardShortcutsRespectInputFocus: false` opt 关 guard — **不实现,等真实需求**。
- 复杂场景:input 内 Ctrl+Z 用尽 input native history 后,继续按 Ctrl+Z 应不应该接着撤销 template?**当前 V3 行为**: 否(input 不响应说明 native history empty,但 Ctrl+Z 仍被 guard 拦截 → 用户感知"卡住")。**未来 ticket** 可改进 — 暂不动。
