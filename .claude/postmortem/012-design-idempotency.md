# PM-012: design() 重复调用累积 jQuery 事件订阅

- **Category:** 资源管理 / 多实例
- **Severity:** HIGH
- **First detected:** 2026-05-11 (R3 state-modeler)
- **Status:** prevented

## What happened

`PrintTemplate.design(container, opts)` 不幂等:

```js
t.prototype.design = function (container, opts) {
  // ...
  this.createContainer(container);  // ← 替换 this.container
  this.printPanels.forEach(t => {
    t.design(opts);  // ← jQuery 重新 bind drag/drop handler, 不解旧的
  });
};
```

二次调用场景:
- Vite HMR → 整 Vue tree rebuild,新 designer-shell 复用旧 template instance
- KeepAlive activated 第二次
- 业务方代码 bug 多次调 design()

**真实影响**:
- 每次 design() 再绑 5+ jQuery 事件 handlers (drag/drop/click/keydown)
- 拖一次元素触发 N 次 onDrag (N = design() 调用次数)
- 内存累积 + 性能下降
- 不可见的"幽灵 handler" 调试痛苦

## Root cause

`design()` 设计假设 "一次性,永不重入"。但 SPA / HMR 必然重入。

```js
// 上游 panel.design 内
this.target.bind("click.hiprint", ...);  // ← bind 不 off,每次 design 累积
```

panel.disable() 不 off 事件 (只 disable 视觉), 没有真正的 cleanup pathway。

## Where it appeared

`hiprint.bundle.js:12335` `t.prototype.design`

## How it was fixed

```js
return t.prototype.design = function (container, opts) {
  // [idempotency] 二次调用 cleanup 旧 container 的 jQuery 订阅
  if (this._designed) {
    console.warn('[hiprint] design() called twice on same template, cleaning prior bind');
    try {
      if (this.container && this.container.length) {
        this.container.find('*').off('.hiprint');  // 全 namespace off
        this.container.empty();
      }
    } catch (err) { console.warn('[hiprint] design re-entry cleanup failed:', err); }
  }
  this._designed = true;

  // ... 原逻辑
};
```

**Trade-off**: `.find('*').off('.hiprint')` 是粗粒度全清,可能误清业务方加的 namespace 事件。但本仓库内所有 hiprint 订阅都用 `.hiprint*` namespace,业务方应避免用 hiprint 前缀。

## Why it kept happening

1. **上游单实例假设**: hiprint 原始设计是 jQuery-style "一个页面一个 template"
2. **HMR 是后发场景**: Vue 3 + Vite 时代才常见
3. **不可见症状**: 单次 HMR 不易察觉,多次后才性能下降
4. **缺少 idempotency test**: e2e 没有"重复 design 不累积事件"的 case

## Prevention

### 规则
- `.claude/rules/hiprint-bundle.md` 不变式: 任何 design / createContainer / addPrintPanel 等 mutation 必须考虑重入

### 自动检查
- `.claude/agents/hiprint-bundle-reviewer.md` 加 idempotency checklist:
  ```bash
  grep -nE "t\.prototype\.design\s*=\s*function" src/hiprint/hiprint.bundle.js
  ```
  每个 mutation 入口检查是否有 `_designed` / `_built` flag + cleanup

### e2e
- e2e/tests/destroy.spec.ts 加 case:
  ```js
  test('design() 二次调用 cleanup 旧订阅,不累积 jQuery handler', async () => {
    const tpl = new h.PrintTemplate({...});
    tpl.design('#c1');
    const beforeHandlers = $._data($('#c1 .hiprint-printElement')[0], 'events');
    tpl.design('#c1');  // 二次
    const afterHandlers = $._data($('#c1 .hiprint-printElement')[0], 'events');
    expect(afterHandlers.click.length).toBe(beforeHandlers.click.length);
  });
  ```

### 业务方文档
- docs/integration-guide.md 提示: HMR / KeepAlive 场景应在 activate 时检查 designed flag,而非每次重 design

### 教训
- 任何 setup() 方法必须假设可重入,or 强制 only-once with explicit flag
- 静默累积 = 隐形 leak,debug 路径长
