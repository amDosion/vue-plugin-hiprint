# ADR-0026: 方向键移动 1pt + Shift+方向键 10pt(V3 改善,放弃 V1 1.5pt 始终)

- **Status:** accepted
- **Date:** 2026-05-12
- **Deciders:** amDosion
- **Related:** ADR-0011 (V3 现代化), TKT-166 (Sprint 22d), V3-PARITY-MATRIX 07-interactions §1.8 + §8.1

## Context

V1 inventory `docs/V1-INVENTORY/interactions.md` §8.1:
- V1 方向键 nudge step **始终 1.5pt** (即 0.5mm),Shift 修饰键被忽略
- V1 quirk:每次 keypress 都 pushSnapshot,50-entry history 几次按键就填满

V3 `keyboard.ts:222,280` 实现:
- 方向键 → 1pt nudge
- Shift+方向键 → 10pt nudge
- 与设计行业其它工具(Figma/Sketch/Illustrator/PS)一致

## Decision

**保留 V3 行为**(1pt + Shift=10pt)。不还原 V1 1.5pt。

V3 history: 每次 nudge 仍 pushSnapshot(V1-faithful per Sprint 22b BA),配 50-entry capacity。**未来 ticket** 可优化为"trailing-edge debounce"(arrow burst 单次 push)— 但需先观察实际 history-fill 报告。

## Rationale

1. **行业标准**: Figma/Sketch/Illustrator/PS 都是 1pt + Shift=10pt;V1 的 1.5pt 始终非业界惯例。
2. **整数 pt 更易精确对齐**: 设计师常用 grid=5/10pt,1pt 步长更友好。
3. **Shift 加速**: 大幅移动需要,V1 没有这个 affordance 导致设计师手动拖。
4. **vue-admin-main 调研**: 业务方没有依赖 1.5pt step 的代码或文档。

## Consequences

- V1 quirk J.13 (V1 inventory): "Shift+arrow has NO effect" — 现在 V3 改善后 Shift 有 10pt 加速。文档更新到 `docs/upgrade-to-v3.md`。
- 测试: `interactions/__tests__/keyboard.spec.ts` 锁定 1pt / 10pt 双步长。

## Mitigation

- 若业务方需要还原 V1 1.5pt 始终,可通过新加 prop `keyboardArrowStep?: { base: number; shift?: number }` 配置 — **不实现,等真实需求**。
- 未来 history-fill 优化:可加 ADR-0030(trailing-edge debounce for arrow nudge 突发)。
