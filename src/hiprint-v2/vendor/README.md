# vendor/ — jQuery plugins

## P3 决策: 运行时复用 (不重新实现)

bundle.js 内嵌 ~2500 行 jQuery UI 自实现 (sortable / draggable / droppable / resizable / hicontextmenu)。这些代码:

1. **无 hiprint 业务依赖**: 通用 jQuery 插件,挂载在 `$.fn.hidraggable` / `$.fn.hidroppable` 等
2. **运行时全局注册**: bundle.js 加载时 `(function($) { $.fn.hidraggable = function(...) {...} })(jQuery)` 副作用
3. **V2 共享 `window.jQuery`**: V2 module 调用 `$('.x').hidraggable(...)` 时,bundle.js 已注册的插件可用

## 当前状态 (P3): 复用 bundle.js 注册

V2 modules 不需要 import vendor/* — bundle.js 加载时 (v1 入口仍在),`$.fn.hidraggable` 等已经在 jQuery prototype 上。

V2 入口装配 (P12) 时:
```js
// src/hiprint-v2/index.js (P12 时)
import 'src/hiprint/hiprint.bundle.js'; // 仅触发 $.fn.* 注册的 side effect (P14 时移除)
// V2 主代码用 window.$.fn.hidraggable 等
```

## 未来 (P14 cleanup 阶段) - 真实拷贝

P14 完全删 bundle.js 时, 需要把 jQuery 插件搬到这里。届时:

- `vendor/jquery-sortable.js` (bundle line ~2000-2800)
- `vendor/jquery-draggable.js` (bundle line ~2800-3500)
- `vendor/jquery-droppable.js` (bundle line ~3500-4000)
- `vendor/jquery-resizable.js` (bundle line ~4000-4500)
- `vendor/jquery-context-menu.js` (bundle line ~4500-5000)

每个文件: IIFE wrap `(function($) { ... })(window.jQuery || window.$)`,无业务依赖,直接拷贝即可。

## 单元测试策略

jQuery plugin 测试用 `vitest + happy-dom + jquery` 组合:

```js
import $ from 'jquery'
import './jquery-sortable.js'  // 注册到 $.fn

test('hidraggable 加 class', () => {
  const el = $('<div>').appendTo(document.body)
  el.hidraggable()
  expect(el.attr('data-draggable')).toBe('true')
})
```

P14 拷贝时同步建 vitest spec。

## 不变式 (V2 必须保留, 见 ADR-0010)

- jQuery plugin 注册到 `$.fn.*` 必须 idempotent (重复加载不重复注册)
- 销毁 (`.hidraggable('destroy')` 等) 必须解绑事件 + 移除 data + 还原 DOM
- 多实例 (`$('.a').hidraggable(); $('.b').hidraggable();`) 互不干扰
