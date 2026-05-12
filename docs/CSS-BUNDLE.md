# CSS Bundle Split — 按需引入指南

> 自 v1.0.3+ 起,`dist/` 同时分发 3 套 CSS 文件,业务方按使用场景选择。
> 向后兼容:**默认 `dist/vue-plugin-hiprint.css` 仍含全部样式,无破坏性变更**。

## 背景

`hiprint.css` 原始包含 jquery.minicolors 颜色选择器约 289 行 CSS + 一张 **68 KB jquery.minicolors.png** sprite。Vite lib mode 默认把 PNG inline 为 base64 进 CSS,导致单一 CSS 体积 **144 KB (gzip 80 KB)**,超出 `~/.claude/rules/ecc/web/performance.md` 的 50 KB gzip 阈值。

minicolors **仅设计器场景**使用(`buildDesigner` / `buildToolbar` 内的属性面板才会实例化颜色选择器)。纯打印场景(业务方已有模板 JSON,只调 `tpl.print()` / `getHtml()`)不需要它。

## 分发文件

| 文件 | 大小 | 内容 | 适用场景 |
|---|---|---|---|
| `dist/vue-plugin-hiprint.css` | **144 KB** | 全部(含 minicolors + base64 PNG) | **默认,向后兼容** |
| `dist/hiprint-core.css` | **60 KB** | 核心:打印元素 / 纸张 / 工具栏 / 属性面板骨架 | **纯打印场景** |
| `dist/hiprint-designer.css` | 7.8 KB | minicolors CSS(引用 `./image/jquery.minicolors.png`) | 配合 core 用于设计器 |
| `dist/image/jquery.minicolors.png` | 68.6 KB | minicolors sprite(外置) | designer.css 引用 |
| `dist/print-lock.css` | 8.4 KB | 打印窗口 `@page` 隔离 | `index.html` link[media=print] 单独引用 |

## 业务方选择

### 场景 A:不动现有代码(默认)

```js
// 仍照旧 — 向后兼容,行为 100% 不变
import 'vue-plugin-hiprint/dist/vue-plugin-hiprint.css'
```

CSS 大小:144 KB(gzip 80 KB)。无需任何修改。

### 场景 B:纯打印 — 业务方有现成模板 JSON,只调 print/getHtml

```js
// 替换原 vue-plugin-hiprint.css 为 core 单文件
import 'vue-plugin-hiprint/dist/hiprint-core.css'
```

CSS 大小:**60 KB**(gzip ≈ 20 KB)。**省 84 KB / 58%**。

不要 buildDesigner、不要 buildToolbar 属性面板中的颜色选择器时适用。

### 场景 C:设计器 — 显式按需引入

```js
import 'vue-plugin-hiprint/dist/hiprint-core.css'
import 'vue-plugin-hiprint/dist/hiprint-designer.css'
```

CSS 大小:60 + 8 KB = 68 KB(gzip ≈ 22 KB) + 外置 68.6 KB PNG(浏览器自动缓存,跨页面复用)。

总传输 ≈ 136 KB 但 PNG 缓存后第二次访问只 ≈ 22 KB。比场景 A 的 144 KB 单文件(每次解析 base64)更优。

## 业务方迁移检查清单

如果当前用场景 A,**不需要做任何事**。

如果想切到场景 B/C:

- [ ] 确认是否用了颜色选择器(grep `minicolors` 或 buildDesigner/buildToolbar 属性面板中"颜色"选项)
- [ ] 切到对应 import 方式
- [ ] 验证视觉:颜色选择器、打印元素、对齐工具、纸张样式都正常
- [ ] 跑 `docs/SMOKE-TEST.md` Level 2 8 项断言

## 内部实现

源码:`src/hiprint/css/`
- `hiprint.css` — core 样式(60 KB,移除了 minicolors 段)
- `hiprint-designer.css` — minicolors only(7 KB + url(./image/...png) 引用)
- `print-lock.css` — 打印窗口隔离

构建:`vite.config.js` 的 `copyPrintLockCss` plugin 在 `closeBundle` 时:
1. vite 默认把 `src/index.js` import 的两个 CSS 合并 → `dist/vue-plugin-hiprint.css`(向后兼容)
2. plugin 把 source CSS 单独 raw copy → `dist/hiprint-core.css` + `dist/hiprint-designer.css`
3. plugin 把 `src/hiprint/css/image/` 全 copy → `dist/image/`

未来工作(超出本次 PR):

- 进一步拆 toolbar / params_setting_container 等 designer 专属规则到 designer.css,让 core.css 更瘦
- 引入 postcss 处理把 vue-plugin-hiprint.css(场景 A)中的 PNG inline 也外置(Vite 5 lib mode 已知限制)
