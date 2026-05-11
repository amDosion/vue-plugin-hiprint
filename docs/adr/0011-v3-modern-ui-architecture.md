# ADR-0011: V3 现代化架构 — 去 jQuery + Vue 3 + TypeScript + interact.js

- **Status:** accepted
- **Date:** 2026-05-11
- **Deciders:** amDosion
- **Supersedes:** ADR-0003 (保留 jQuery), ADR-0004 (单 bundle 内修), ADR-0010 (V2 Strangler Fig)
- **Related:** ADR-0001 (fork detach), ADR-0007 (PrintElementTypeRegistry)

## Context

ADR-0010 (2026-05-11 上午) 启动 V2 Strangler Fig 把 `hiprint.bundle.js` 拆为 ~18 个 ES module,完成 P0-P13 (52 modules + 474 unit tests + 92 e2e),但 P11 ui 仍是 adapter 模式 — V2 surface 暴露 buildToolbar/buildDesigner,内部仍 delegate V1 jQuery DOM。

2026-05-11 下午用户明确要求转向:
1. **完整 V3** — 不接受 adapter 半 jQuery 半 V2
2. **完全替换 jQuery**,现代化方案
3. **不分两期发布** — V2.x 中间发布 (v1.1.0) 跳过,合并为一次 v2.0.0 发布
4. **拖拽用 interact.js** — 40k stars + Adobe/类 Figma 商业项目验证,不用 @vue-dnd-kit/core (stars < 500 风险高)

三个并行调研 agent 给出关键数据:

| 维度 | 结论 |
|---|---|
| V1 jQuery 调用 | 519 个 `$()` + 84 个 `hidraggable` + 9 个 `minicolors` |
| V2 jQuery 调用 | 54 个 (24 个 in ui adapter,30 个 in 渲染管线可去) |
| 业务方迁移面 | 30 文件,但 4 个 composables 隔离 (`useHiprintDesigner` / `useHiprintRuntime` / `usePrintService` / `useTemplateManager`),只有 3 个 .vue 文件直接调用,**无自定义 element types** |
| 完全去 jQuery 工期 | 6-9 个月单人 / 5-6 个月双人 |

业务方 vue-admin-main 已在做 TypeScript + Vue 3 现代化,愿意接受新 reactive API,接受一次性 v2.0.0 升级。

## Decision

**反转 ADR-0010 的 "ES module 拆分保留 jQuery" 路径,启动 V3 全量重写**:

- 在同一 worktree `refactor/hiprint-v2` branch 内推进 (不开新 worktree,V2 codebase 作为 V3 数据层基础)
- 新目录 `src/hiprint-v3/` 替代 `src/hiprint-v2/`
- 完全替换 jQuery: hidraggable → interact.js + 自实现多选;hiresizable → interact.js + ResizeObserver;hicontextmenu → @floating-ui/vue;minicolors → 原生 color input
- 现代化 stack: Vue 3 + TypeScript strict + Pinia + Zod
- 业务方升级路径 **双轨**:
  - **drop-in**: 不改任何代码,走 compat 层(内部 V3)
  - **V3 native**: 4 个 composables 升级到 V3 reactive composables(推荐)
- 一次性发布 v2.0.0,删除 jQuery 主依赖 + hiprint.bundle.js + src/hiprint-v2/

### V3 架构

```
src/hiprint-v3/
├── stores/         ← Pinia (canvas / history / template / socket)
├── composables/    ← Vue 3 composables (业务方主入口)
├── components/     ← Vue 3 components (HiprintDesigner / Toolbar / Canvas / ElementList / PropertyPanel / Panel / Preview)
│   └── elements/   ← 11 etype 各一个 Vue component (含 table 子目录)
├── interactions/   ← drag-drop / resize / context-menu / selection / keyboard (interact.js 基)
├── schemas/        ← Zod (template / element / panel / style)
├── print/          ← jQuery-free 打印管线 (render / pdf / socket / browser-print)
├── core/           ← 数据层 (registry / group / element-base / etypes data / default-provider)
├── internal/       ← 工具 (hinnn / lifecycle / i18n / constants / dom-helpers)
└── compat/         ← 老 API 兼容层 (hiprint-global / print-template / build-toolbar / build-designer / vue-plugin)
```

详见 [`C:\Users\12180\.claude\plans\memoized-booping-hearth.md`](../../../../../C:/Users/12180/.claude/plans/memoized-booping-hearth.md)。

### 9 个 Phase (P14-P22)

```
P14 基建 + TS + Pinia stores       (3-4 周)
P15 打印管线 + 数据层               (3 周)
P16 交互系统 (interact.js)         (4 周, P16 第 1 周 POC 验证)
P17 元素 Vue components            (4-5 周)
P18 设计器 Vue components          (4-5 周)
P19 兼容层 (业务方零改动)           (2-3 周)
P20 V3 native composables 发布     (2 周)
P21 V1 + V2 cleanup                (2-3 周)
P22 业务方升级 + 发布 + 观察期      (2-3 周 + 2 周观察)
─────────────────────────────────────────────
总计: 单人 26-32 周 / 双人 20-23 周
```

## Alternatives

### A. 继续 ADR-0010 V2 ES module 路径 (保留 jQuery)
- 优点: P0-P13 已完成,继续做 P14 (业务方零迁移) 最快 14 周
- 缺点: 保留 jQuery,无 TS 严格,无 reactive API,业务方现代化需求未满足
- **拒绝原因**: 用户明确要求"完整 V3 + 去 jQuery + 现代化",此路径不满足

### B. V2.x + V3 两期发布 (先 v1.1.0 中间版,再 v2.0.0)
- 优点: 业务方提前 4 个月拿到 jQuery-free 打印管线 + TS 类型
- 缺点: 双 release 验证负担,业务方两次集成测试
- **拒绝原因**: 用户决定"不分两期,直接全量 V3 一次发布"

### C. 拖拽用 @vue-dnd-kit/core
- 优点: Vue 3 native, headless API, 现代设计
- 缺点: GitHub stars < 500, 商业项目验证不足, 多选/canvas 绝对定位场景未验证
- **拒绝原因**: 风险过高,关键基础设施不押早期库

### D. 拖拽用 Sortable.js
- 优点: 28k stars 成熟稳定
- 缺点: 列表拖拽主,canvas 绝对定位 + 多选/跨 panel 需大量自实现 (+1-2 周)
- **备选**: 若 P16 第 1 周 POC 验证 interact.js 不行,则切此路径

### E. 完全保留 V2 + 仅做 P11 native UI rewrite
- 优点: 工期可减半
- 缺点: 仍保留 V2 ES module split + bundle.js,业务方 API 不变,无 reactive,不算"V3 现代化"
- **拒绝原因**: 不满足用户"完整 V3"要求

## Consequences

### 正面 (V3 发布后)
- jQuery 主依赖完全移除 (Playwright e2e 例外)
- TypeScript strict 全栈类型推断,IDE 重构友好
- Pinia + useRefHistory 内建 undo/redo,业务方 Vue devtools 调试无痛
- 原生 reactive API (composables) 替代命令式 API
- Zod schema 提供运行时 + 编译时双重保证
- Bundle 体积下降 ≥ 40% (移除 jquery + jquery-minicolors + jquery-contextmenu)
- Core Web Vitals 改善 (LCP < 2.5s / INP < 200ms / CLS < 0.1)
- 业务方 vue-admin-main 4 个 composables 接入 V3 composables 后享 reactive + 类型推断
- 后续维护 + 新功能开发速度大幅提升

### 负面 (开发期间)
- 7-8 个月单人工期 / 5.5-6 个月双人
- 业务方 main 始终 v1.0.3,期间无新功能(可走 hotfix cherry-pick)
- 474 V2 unit tests 部分需要 port 到 V3 + 部分丢弃
- 92 e2e 需要更新断言路径 (V2 → V3 DOM 结构变化)
- 一次性 cutover 风险:V3 发布即业务方升级,无渐进 fallback
- Pinia + Vue runtime 引入 ~30kb gzip (但 jquery 移除 ~80kb gzip 净节省)

### 锁住的不变式 (V3 必须保留 — 从 V1/V2 继承)

1. `PrintTemplate.destroy()` 幂等 + 所有公开方法守卫
2. 13 处 XSS 修复 pattern (.text() 默认 / .html() 仅 by-design)
3. 业务回调隔离 (V2 _safeCall 24 处 → V3 try-catch in composables)
4. 实例 namespace 隔离 (多设计器共存,V2 _designerEventNs → V3 store 隔离)
5. nested-field reduce `?? ""` 安全模式
6. addPrintElementTypes 双层 dedup
7. removePrintElementTypes dotted prefix (`tid === t || tid.indexOf(t + '.') === 0`)
8. async race protection (toPdf / getHtmlAsync / loadAllImages / sendByFragments / XHR)
9. design() 幂等
10. deletePanel editingPanel re-select
11. 公开 API contract (PrintTemplate / buildToolbar / buildDesigner) — 通过 compat 层兼容
12. silent print socket 协议 (业务方 print2 不能破)
13. PrintTemplate JSON schema 向后兼容 (业务方现有模板可加载,Zod superset)

每个 Phase 完成时,grep 这 13 条不变式数量校验。

### 业务方 (vue-admin-main) 影响

| 路径 | 工作量 | 收益 |
|---|---|---|
| Drop-in (走 compat 层) | 零代码改动,仅 `npm install vue-plugin-hiprint@2.0.0` | 享性能 + bundle 减小,API 不变 |
| V3 native composables | 4 个 composables 改写 (低-中-中-零),~1-2 天 | 享 reactive + TS 类型推断 + Pinia devtools |

## 触发条件 (满足才执行)

- ✅ ADR-0001 detach 上游 (2026-04-15)
- ✅ V2 P0-P13 完成 (52 modules + 474 unit tests + 92 e2e baseline)
- ✅ 业务方 vue-admin-main 现代化压力确认 (TypeScript + Vue 3 复杂场景)
- ✅ 用户明确批准 (2026-05-11 plan 已批准)

## 终止条件 (任一触发回滚 V3 路径)

- ❌ P16 第 1 周 interact.js POC 失败 → 切 Sortable.js (备选 D),不终止 V3
- ❌ 业务方 vue-admin-main P19 alpha 测试 regression > 5 个 high severity 且 2 周内无法收敛 → 暂停 V3,回到 V2 完成 P14-P17 中间发布路径
- ❌ V3 bundle 体积反而比 V1 增加 → 审计依赖,若无法 < 0% diff 则暂停
- ❌ TypeScript strict 完整通过工期超 8 周 (P14 预算 4 周) → 部分 strict 让步

终止时: V3 已成果保留在 `src/hiprint-v3/` 不删,但发布版本仍是 v1.0.3 + V2 修订版。

## Related

- ADR-0001 (fork detach) — V3 前提
- ADR-0003 (保留 jQuery) — 本 ADR superseded
- ADR-0004 (单 bundle 内修) — 本 ADR superseded (与 ADR-0010 一起)
- ADR-0007 (PrintElementTypeRegistry export) — V3 中扩展为 Pinia store
- ADR-0010 (V2 Strangler Fig) — 本 ADR superseded (V2 codebase 仍作 V3 数据层参考)
- `.claude/postmortem/001-013` — V3 实现时全部规避
- `C:\Users\12180\.claude\plans\memoized-booping-hearth.md` — 完整 plan 文件
- 计划 ADR-0012 (P21): V1 + jQuery 完全移除决策
- 计划 ADR-0013 (P22): 业务方升级路径 (drop-in vs V3 composables)
