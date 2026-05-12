# ADR-0029: V1 quirks rollup — 决议索引 + 整体策略

- **Status:** accepted
- **Date:** 2026-05-12
- **Deciders:** amDosion
- **Related:** ADR-0011 (V3 现代化), V3-PARITY-MATRIX 全部 8 docs(150+ V1 quirks)

## Context

`docs/V1-INVENTORY/` 8 inventory docs 共记录 **150+ V1 quirks**(每个 doc 的 J/P/Q section)。在 V3 重写过程中,每个 quirk 需要个体决议:
- 保留(V1-faithful — muscle memory)
- 改善(V3 industry-standard — break compat)
- 文档化(标 quirk,既不主动保留也不主动改)

逐个 ADR 不现实(150 个)。本 ADR 设立**整体策略 + 决议索引**,只为"高影响、改善 vs 保留有争议"的 quirk 单独 ADR。

## Decision

### 策略

1. **默认行业标准**: 当 V1 行为偏离 Figma/Sketch/Illustrator/PS 等行业惯例,且无明确业务依赖 → V3 取行业标准。
2. **V1-faithful 例外**: 当 V1 行为有具体业务依赖(vue-admin-main 数据流 / 用户期待)→ V1-faithful。
3. **文档化 quirks**: 所有 V1 quirks 在 `docs/V1-INVENTORY/*.md` 已记录;V3 实现差异在 `docs/V3-PARITY-MATRIX/*.md` 已 score。**两份**就是单一信息源,无需重复在 ADR 罗列。
4. **个体 ADR 触发条件**: quirk 同时满足:
   - HIGH 影响(reasonable user 会 notice)
   - V1 / V3 双方都有 reasonable 用户基础
   - 需公示决议给业务方

### 已签发个体 ADR(对应 Sprint 22d ticket)

| ADR | Quirk 主题 | V3 决议 | Sprint 22d ticket |
|---|---|---|---|
| ADR-0024 | 空画布点击 deselect | V3 总清空 | TKT-164 + TKT-169 |
| ADR-0025 | Tab 键循环选中 | V3 循环 | TKT-165 |
| ADR-0026 | 方向键步长 | V3 1pt + Shift=10pt | TKT-166 |
| ADR-0027 | Shift+resize aspect | V3 锁定(反转 V1) | TKT-167 |
| ADR-0028 | Ctrl+Z input guard | V3 guard | TKT-168 |

### 大类 quirks(无个体 ADR,统一决议)

| 大类 | V1 行为 | V3 决议 | 出处 |
|---|---|---|---|
| Default sizes per etype | 散乱 | TKT-162 已对齐 V1 | sprint 22d DA |
| Resize handles count | etype-aware(hline=2/vline=2/rect=4/image=5+rot) | TKT-163 复原 V1 quirk #5 | sprint 22d DA |
| Shape contextmenu font-12pt / 加粗 no-op | 有但无效 | V3 删除(TKT-159 etype menu 不加) | sprint 22d DC |
| Empty-edit text inline 字段:`title：testData` 解析 | V1 line 760 | V3 保留(TKT-160) | sprint 22d DC |
| Empty enter/newline/tab sanitization | V1 quirk J.12 | V3 保留(TKT-160) | sprint 22d DC |
| `rowsColumnsMerge` 合并单元格 → display:none(不 omit) | V1 G.3 | V3 保留(Sprint 22b BB render-table) | sprint 22b |
| `<td>` in `<thead>` 不用 `<th>` | V1 P.7 | V3 保留(Sprint 22b BB) | sprint 22b |
| `tableCustom` etype 名 throw "已移除" | V1 line 10737 | V3 保留 throw(Sprint 22a-r TKT-010 完成) | sprint 22a-r |
| Image `aspectRatioLock` UI | V1 没有 | V3 新增(Sprint 22a-r TKT-001 已加,非 V1 parity 但优化) | sprint 22a-r |
| Smart guides Alt-disable | V1 行业标准 | V3 保留(Sprint 22c CD smart-guides.ts) | sprint 22c |
| Multi-select drag no smart-snap | V1 行业标准 | V3 保留(Sprint 22c CD) | sprint 22c |
| Shape 字段 `field` 序列化但 no-op | V1 quirk(shapes don't bind) | V3 保留 — 字段写出但 render 忽略 | docs/V1-INVENTORY/etypes/shapes.md J.8 |
| 标尺 click → 不响应(V1 没有) | V1 无功能 | V3 ruler pointerdown 拖出 guide line(Sprint 22c CD) | sprint 22c |
| Element list panel(V1 有 ☰) | V1 line panel.js ~860 | V3 实现(Sprint 22c CC HiprintElementListPanel) | sprint 22c |

### 文档化但保留(V1-faithful)

| Quirk | V1 ref | V3 行为 |
|---|---|---|
| barAutoWidth string-vs-bool trap | V1 J.23 | V3 用 `isTrue()` helper(Sprint 22a-r 修) |
| barcode title-prefix corrupts CODE128 | V1 J.5 | V3 关闭(Sprint 22a-r — title 写到 hideTitle inverse 实现) |
| html v-html by-design | V1 line 10199 | V3 保留(已文档 + 加 escape opt-in) |
| longText pagination binary-search | V1 9757-9931 | V3 实现等价(Sprint 22b BD long-text-paginate.ts) |
| Per-keypress history push for arrow | V1 quirk J.18 | V3 V1-faithful(Sprint 22b BA) |

## Consequences

- 业务方升级到 V3 时**有 1 个 doc 必读**: `docs/upgrade-to-v3.md` Behavior Changes section(基于本 ADR + ADR-0024~28 拼装)。
- 个体 ADR 总数控制在 5 个(0024-0028),其余 150+ quirks 在 matrix doc 索引。
- 未来若新 quirk 需个体 ADR:遵从 §策略 §4 触发条件;否则补 §大类 / §文档化 section。

## Mitigation

- V3-PARITY-MATRIX 各 doc 末尾的 quirk 总结表 + 本 ADR 的 3 个 section 共同构成完整 quirks 信息源。
- 业务方反馈影响 V3 决议 → 触发**新** ADR 0030+。
