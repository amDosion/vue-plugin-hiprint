# ADR-0024: 空画布点击 → 总是清空选中(V3 改善,放弃 V1 quirk)

- **Status:** accepted
- **Date:** 2026-05-12
- **Deciders:** amDosion
- **Related:** ADR-0011 (V3 现代化架构), TKT-164 (Sprint 22d), V3-PARITY-MATRIX 07-interactions §1.2

## Context

V1 inventory `docs/V1-INVENTORY/interactions.md` §12 揭示 V1 bug-as-feature:
- 当画布只有 1 个 element 时,点击空白 → 清空选中(预期行为)
- 当 `maxPanelIndex ≥ 2`(画布有 ≥ 2 element)时,点击空白 → **不清空选中**;只把 property panel 切换为 panel-level options
- V1 line 8348 是这个 quirk 的源头 — `bindHidePanel` 只在 panel index < 2 时绑定

V3 `selection.ts:191-287` 实现:点击空白 → **总是清空选中**。

## Decision

**保留 V3 行为(总清空)。删除 V1 quirk。** 不提供 opt-in 还原。

## Rationale

1. **V1 quirk 是 bug**,不是 design intent。V1 inventory 明确标 quirk 而非 spec。
2. **用户期待**: 行业标准 (Figma/Sketch/PS/Illustrator) 都是空白点击清选。V1 quirk 违反直觉。
3. **vue-admin-main 业务方调研**: 无业务流程依赖此 quirk。
4. **多选场景**: V1 行为导致用户误认为"选中卡住了" — 反馈 UX bug 数量 > 期待此 quirk 的用户数量。

## Consequences

- 业务方 muscle memory 调整: 0-成本,行为更直觉。
- 测试: `e2e/tests/selection-deselect.spec.ts` 锁定 V3 行为 — 单 element + 双 element 场景都清空。
- V1 quirk 与 V3 改善的差异在 `docs/upgrade-to-v3.md` 标红 "行为改善" section。

## Mitigation

- 业务方若依赖 V1 quirk,可通过 `template.on('selection-change', handler)` 拦截 + 自行恢复(Sprint 22c CB 已暴露 event-bus)。
- 未来若用户反馈,可加 `selectionMode: 'v1-quirk' | 'always-clear'` opt — **暂不实现,等真实需求触发**。

## Status of related quirks

- ADR-0029 (TKT-169) 与此重复,作废 TKT-169。本 ADR 覆盖 V1 inventory §1.2 + §12 两条 row。
