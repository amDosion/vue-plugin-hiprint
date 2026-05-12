# ADR-0025: Tab 键循环选中下一 element(V3 新增,V1 不支持)

- **Status:** accepted
- **Date:** 2026-05-12
- **Deciders:** amDosion
- **Related:** ADR-0011 (V3 现代化), TKT-165 (Sprint 22d), V3-PARITY-MATRIX 07-interactions §1.8

## Context

V1 inventory `docs/V1-INVENTORY/interactions.md` §8.2:
- V1 完全不处理 Tab 键(无 keydown 监听器),Tab 走浏览器默认 → 焦点离开画布跳到下一个表单元素或浏览器 chrome。
- 设计师反馈这"中断 flow"。

V3 `keyboard.ts:303-307` 已实现:
- Tab → 选中当前选中 element 的"下一个"(按 panel.printElements 顺序)
- Shift+Tab → 上一个
- 没有选中时 Tab → 选中第一个 element
- 焦点保留在画布

## Decision

**保留 V3 行为**(Tab 循环选中)。不还原 V1。

## Rationale

1. **V1 行为**等同"无功能",Tab 流出画布是浏览器默认,不是 V1 design intent。
2. **行业标准**: 大多数设计工具都用 Tab 循环 selectable objects(Figma 用 Tab + Esc 退出 group; Illustrator 用 Tab 切换选中)。
3. **可访问性 +**: 键盘导航更完整,a11y 用户得益。
4. **零业务方依赖**: 没有 vue-admin-main 代码处理 Tab。

## Consequences

- 业务方在 inline-edit 模式时:Tab 行为应该 commit + 移动到下一 element(待 TKT-160 inline-edit 完成 — 默认保留 Tab 在 input 内的 native 行为,即跳出 input 然后触发 element cycle)
- 测试: `interactions/__tests__/keyboard.spec.ts` 锁定 V3 Tab 循环 + Shift+Tab 反向 + 空选中时 Tab 选第一个

## Mitigation

- 若业务方需要还原 V1(让 Tab 跳出画布到下一个 form field):通过 `template.on('keydown', ev => { if (ev.key === 'Tab') ev.preventDefault() === false })` 拦截 — Sprint 22c CB event-bus 提供 hook。
- 也可在 designer container 加 `tabindex="-1"` 让 Tab 跳过整个画布(业务方决定 wrap UX)。
