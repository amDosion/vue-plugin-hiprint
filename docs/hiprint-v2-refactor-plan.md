# hiprint V2 Refactor Plan

> 业务方友好的 V2 拆分路线图。详细技术 plan 见 [ADR-0010](adr/0010-hiprint-bundle-refactor-strangler-fig.md)。

## 为什么拆分

`src/hiprint/hiprint.bundle.js` 是 15344 行单文件 (webpack 4 UMD bundle)。3 轮 audit 累计 ~85 项修复证明能 work,但:

- IDE 处理大文件慢 + 不准
- 多人协作冲突高
- 单元测试无法粒度化写
- bundle 体积大 (~1.18 MB tgz)

V2 目标: ~18 个 ES module 文件,每个 200-800 行,可独立测试 / 可 tree-shake / 可多人协作。

## 业务方零风险

- **主 branch `main` 不动**: 业务方继续用 v1.0.3 (bundle.js)
- **V2 在 git worktree** `../vue-plugin-hiprint-v2/` 内独立开发
- **完成后切换**: 业务方升级时 V2 + V1 并存 (feature flag),1-2 个 minor release 稳定后再删 bundle.js

## 14 个 Phase

| Phase | 内容 | 风险 | 工期 | 业务方影响 |
|---|---|---|---|---|
| P0 | worktree + ADR + V2 骨架 | LOW | 4h | 零 |
| P1 | e2e 100% 覆盖补齐 (main) | HIGH | 5-7d | 零 |
| P2 | V2 internal/ 基建 | LOW | 1.5d | 零 |
| P3 | V2 vendor/ jQuery 插件 | LOW | 1.5d | 零 |
| P4 | V2 renderers/ 渲染器 | MED | 2d | 零 |
| P5 | V2 core/registry + group | MED | 1d | 零 |
| P6 | V2 core/etypes/ (10 etype) | MED | 4d | 零 |
| P7 | V2 core/etypes/table/ | HIGH | 4-5d | 零 |
| P8 | V2 core/panel.js | HIGH | 2d | 零 |
| P9 | V2 core/print-element-entity (基类) | CRITICAL | 5-6d | 零 |
| P10 | V2 template/ PrintTemplate (7 子模块) | CRITICAL | 4-5d | 零 |
| P11 | V2 ui/ buildToolbar/buildDesigner | HIGH | 4d | 零 |
| P12 | V2 socket/ + 入口装配 | MED | 1d | 零 |
| P13 | V2 切换 + 业务方 alpha | HIGH | 2d + 1-2 周 | alpha 自愿测试 |
| P14 | 合并 main + cleanup | LOW | 2d | 升级 minor release |

**总计**: 单人 ~8 周 (含业务方 alpha 1-2 周),双人 ~5-6 周。

## 业务方时间表 (估算)

| 周次 | 内部进度 | 业务方 |
|---|---|---|
| W1-2 | P0+P1 (worktree + e2e 100%) | 无感知 |
| W3-5 | P2-P8 (V2 工具+核心) | 无感知 |
| W6-7 | P9-P12 (V2 模板+UI+装配) | 无感知 |
| W8 | P13 alpha tgz 推 vue-admin-main | 自愿测试 (可选) |
| W9-10 | 业务方 SMOKE Level 2 验证 | 反馈问题 |
| W10+ | P14 切换 + 1-2 minor 后删 bundle | 升级新 tgz |

## V2 API 兼容性

✅ **完全兼容**: V2 与 V1 通过相同的 `src/index.js` 公开 23 个 export, 业务方代码零修改:
```js
import { hiprint, PrintTemplate, buildDesigner } from 'vue-plugin-hiprint';
```

✅ **新增** (V1 也已有 since v1.0.2): `PrintElementTypeRegistry` (data 单例 class)

❌ **不破坏**: 所有 PrintTemplate / buildToolbar / buildDesigner / hiwebSocket 公开方法签名不变

## V2 性能预期

| 指标 | V1 (bundle) | V2 (modular) | 提升 |
|---|---|---|---|
| tgz 体积 | 1.18 MB | ~1.0-1.1 MB | -10~15% (tree-shaking) |
| 冷启动 build | ~15s | ~8-10s (vite 原生 ES module) | -30% |
| 业务方 import 体积 | 全 bundle | 按需 import (e.g. 不用 socket 时 -100KB) | 可观 |
| HMR 速度 | 全文件 reload | 单 module reload | -50%+ |

## 业务方升级路径

### Phase 13 (V2 alpha)

```bash
# 业务方目录
cp ../vue-plugin-hiprint/vue-plugin-hiprint.tgz ./
# package.json: "vue-plugin-hiprint": "file:./vue-plugin-hiprint.tgz"
npm install vue-plugin-hiprint.tgz
# 默认仍是 V1 路径
```

可选启用 V2 (alpha test):
```js
// vite.config.js / main.js
window.HIPRINT_USE_V2 = true;  // 切换至 V2 路径
```

### Phase 14 (V2 正式)

V2 默认开启, V1 保留 fallback:
```js
window.HIPRINT_USE_V2 = false;  // 强制走 V1 (仅紧急回滚用)
```

### Phase 15 (deprecation)

1-2 个 minor release 后 bundle.js 被删, V2 是唯一路径。

## 业务方关键 checklist (Phase 13 alpha 时)

升级 V2 后业务方应验证:
- [ ] 模板设计器加载正常 (designer-shell 正常)
- [ ] 元素拖拽 / 编辑 / 调整大小工作
- [ ] 属性面板所有字段保存生效
- [ ] 多面板分页 (addPanel / deletePanel) 工作
- [ ] 打印按钮 → 出 PDF / 打印窗口
- [ ] 撤销/重做 (Ctrl+Z/Y) 工作
- [ ] 复制/粘贴 (Ctrl+C/V) 工作
- [ ] socket 静默打印 (如有用)
- [ ] 业务方自定义元素类型 (appendElementTypeGroups) 注册成功
- [ ] 业务方 formatter / styler 字符串仍 work
- [ ] Vue 路由切换不内存泄漏 (打开 DevTools Memory)

## 反馈

V2 alpha / 正式发布期间, 业务方可通过以下渠道反馈:
- GitHub Issue: <amDosion/vue-plugin-hiprint>
- 内部 IM 群直接联系维护者

## 相关文档

- [ADR-0010](adr/0010-hiprint-bundle-refactor-strangler-fig.md): 拆分决策
- [ADR-0004](adr/0004-single-bundle-maintenance.md): 之前拒绝拆分的决策 (superseded)
- [docs/CODE-BLUEPRINT.md](CODE-BLUEPRINT.md): bundle.js 22 区域索引 (V2 完成后 deprecated)
- [docs/CODEMAPS/INDEX.md](CODEMAPS/INDEX.md): 模块级 codemap (V2 完成后重写)
- [docs/integration-guide.md](integration-guide.md): 业务方集成指南
- [CHANGELOG.md](../CHANGELOG.md): 版本变更日志
