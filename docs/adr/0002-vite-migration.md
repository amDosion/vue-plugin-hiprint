# ADR-0002: 从 Vue 2 + Webpack 迁移到 Vue 3 + Vite

- **Status:** accepted
- **Date:** 2026-04-20
- **Deciders:** amDosion

## Context

上游 `vue-plugin-hiprint` 基于 Vue 2 + Webpack 4。我们的业务方 `vue-admin-main` 已经迁到 Vue 3 + Vite 5，被迫继续维护 Vue 2 包是技术债务：

1. Vue 2 已 EOL（2023-12 停止维护）
2. Webpack 4 + node-sass 等依赖链有大量安全告警
3. 业务方需要 Composition API + `<script setup>` 风格的演示
4. dev server 慢（Webpack 冷启动 30+ 秒 vs Vite 1-2 秒）
5. 很多新生态（pinia, vue-router 4）只支持 Vue 3

## Decision

**全面迁移到 Vue 3.4 + Vite 5**：

- 删除 Webpack 配置 (`vue.config.js` / `babel.config.js`)
- 引入 `vite.config.js`，使用 `@vitejs/plugin-vue` + `vite-plugin-commonjs`
- 升级 `package.json`：`vue@^3.4`、`ant-design-vue@^4`、`@vitejs/plugin-vue@^5`
- 改 `src/main.js`：`createApp(App).mount('#app')` 取代 `new Vue()`
- 改 `src/standalone/*.vue`：Composition API + `<script setup>`
- 保留 jQuery 内核不动（见 ADR-0003）
- 用 `vite-plugin-commonjs` 让 jQuery `require()` 风格代码继续工作

## Alternatives

### A. 留在 Vue 2 直到 hiprint.bundle 重写
- 优点：最小风险
- 缺点：业务方 Vue 3 项目集成 Vue 2 包要 `@vue/compat`，复杂度反而高
- **拒绝原因**：业务方明确不接受 Vue 2 包

### B. Vue 3 + Webpack 5
- 优点：渐进迁移
- 缺点：Webpack 5 配置复杂 + dev server 慢；社区已偏向 Vite
- **拒绝原因**：Vite 启动速度对开发体验影响显著

### C. 双版本并存 (Vue 2 包 + Vue 3 包分别发)
- 优点：兼容老业务
- 缺点：维护两套 build 配置 + 两套 demo
- **拒绝原因**：当前没有 Vue 2 业务方了

## Consequences

### 正面
- dev server 1.5 秒冷启动
- `<script setup>` 风格演示，业务方易参考
- 摆脱 Vue 2 EOL 风险
- 安全依赖告警归零

### 负面
- jQuery + Vue 3 共存的边界规则需要记录（已写入 `.claude/rules/jquery-vue3.md`）
- `_setup-jquery.js` 必须先于 hiprint 加载，确保 `window.jQuery = window.$ = $`（已处理）
- 部分 jQuery UI 插件（`jquery-ui-sortable`）需要 commonjs shim
- `nzh/dist/nzh.min.js` 需要 vite alias resolve（已配置）

### 后续注意
- 业务方升级 Vue 3 时务必把 `vue-plugin-hiprint.tgz` 一同升级
- `package.json` "peerDependencies": `vue ^3.0`（不再支持 Vue 2）

## Related

- ADR-0001 (detach) — 前提
- ADR-0003 (保留 jQuery) — 与 Vue 3 共存的核心矛盾解
