# ADR-0027: Shift+resize 锁定 aspect ratio(V3 改善,反转 V1 quirk)

- **Status:** accepted
- **Date:** 2026-05-12
- **Deciders:** amDosion
- **Related:** ADR-0011 (V3 现代化), TKT-167 (Sprint 22d), V3-PARITY-MATRIX 07-interactions HIGH #1

## Context

V1 inventory `docs/V1-INVENTORY/interactions.md` HIGH #1 + §2.6/§4.3:
- V1 resize 默认从 X-delta 强制等比(aspect ratio 锁定)
- V1 quirk:**Shift 修饰键反转默认行为** → 按住 Shift 时 aspect ratio **解锁** → 自由 resize
- 行业标准相反:多数工具默认自由 resize,Shift 锁定 aspect ratio。

V3 `resize.ts:198-224` 实现:
- 默认自由 resize(width/height 独立)
- Shift+resize **锁定** aspect ratio
- 标准方向(与 Figma/Sketch/Illustrator/PS 一致)

## Decision

**保留 V3 行为**(默认自由,Shift 锁定)。**反转** V1 quirk。

## Rationale

1. **muscle memory**: 行业标准是 V3 方向;V1 反转是 1+ 设计师反馈"违反直觉"。
2. **a11y / discoverability**: 默认自由更易上手,Shift 加修饰是渐进发现。
3. **Image 元素特殊**:对 Image 默认应该 aspect-lock(per Sprint 22a-r TKT-001 image aspectRatioLock 选项)。Shift 在 image 上仍为"打破 aspect ratio"。
4. **vue-admin-main 用户调研**: 0 投诉指向 V3 方向。

## Consequences

- 业务方 muscle memory 调整: 零成本(行业标准方向)。
- V1 quirk J.6 image-aspect-stretch: image 现在默认 aspect-lock,Shift 才能拉变形。
- 测试: `interactions/__tests__/resize.spec.ts` 锁定:不按 Shift = 自由 resize(width/height 独立 patch);按 Shift = aspect lock(width 变 height 同步)。

## Mitigation

- 若 1+ 业务方反馈需要还原 V1 反转,可加 `resizeShiftBehavior: 'lock' | 'break'` opt(默认 'lock')— **不实现,等真实需求**。
- 若想行业标准 + V1 兼容并存,Shift+Alt 可作"反转模式"快捷键 — 暂不实现。

## Related ADRs

- ADR-0011: V3 现代化决定整体走"行业标准方向"
- ADR-0026: Shift+arrow nudge 同方向 — Shift 也作"加强修饰"
