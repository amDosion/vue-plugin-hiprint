# Rule: jQuery + Vue 3 共存指南

> 本仓库特殊性：jQuery 是 hiprint 内核（无法替换），Vue 3 是外壳。两者共存必须遵守边界。

## 1. 责任边界

| 层 | 框架 | 文件 |
|---|---|---|
| 打印内核 / 设计器 | **jQuery 3.x** | `src/hiprint/hiprint.bundle.js` + `src/hiprint/plugins/*` |
| 外壳 / 演示 / 业务集成 | **Vue 3** | `src/standalone/*.vue` + `src/main.js` |
| 桥接 | jQuery 调用 + Vue 生命周期 | `src/standalone/designer-shell.vue` 是模范 |

## 2. 不能跨层做的事

- ❌ Vue 组件内**禁止**直接 `$('.hiprint-xxx').on(...)` 操作 hiprint DOM
- ❌ Vue 组件内**禁止**直接读 `template.printPanels[0].xxx` 访问 hiprint 内部状态
- ❌ hiprint.bundle.js **禁止**`import` 任何 Vue 库 / Vue Composition API
- ❌ hiprint.bundle.js **禁止**触发 Vue 组件自己的事件总线

## 3. 必须做的桥接

### Vue → hiprint

```js
// designer-shell.vue 模范
onMounted(() => {
  this.designerCtrl = hiprint.buildDesigner('#hiprintDesigner', {
    toolbarOptions: { onPreview: this.handlePreview, onPrint: this.handlePrint }
  })
})

onBeforeUnmount(() => {
  // 关键：hiprint 不会自动跟随 Vue 卸载
  this.designerCtrl && this.designerCtrl.destroy()
})
```

### hiprint → Vue

```js
// hiprint 通过 opts.onXxx 回调通知 Vue
buildDesigner({
  toolbarOptions: {
    onSave: (template, json) => {
      // ← 进入 Vue 上下文,可以调 Vuex / Pinia / fetch
      this.$store.dispatch('saveTemplate', json)
    }
  }
})
```

## 4. 共存陷阱（必须避免）

### 4.1 Vue 路由切换不调 destroy

```js
// ❌ 错
onMounted() { hiprint.buildDesigner(...) }
// 路由切走时 hiprint 单例 map 残留 + 事件订阅泄漏

// ✅ 对
onBeforeUnmount() { 
  designerCtrl && designerCtrl.destroy()
  tpl && tpl.destroy() 
}
```

### 4.2 KeepAlive / activated 重复构建

```js
// ✅ 配合 KeepAlive
onActivated() {
  if (!this.designerCtrl) { this.designerCtrl = hiprint.buildDesigner(...) }
}
onDeactivated() {
  // 不立即 destroy（保持状态），但要 setPaginationVisible(false) 等隐藏 UI
}
```

### 4.3 Reactive 数据传给 hiprint

- ❌ 直接传 `reactive(data)` 给 `tpl.print(data)` — Vue Proxy 可能干扰 jQuery DOM 操作
- ✅ 传 `JSON.parse(JSON.stringify(data))` 或 `toRaw(data)` 解 reactive

### 4.4 jQuery 事件冒泡进 Vue

```js
// hiprint 内部 jQuery click 不会自动冒泡为 Vue @click
// 需要业务方在 Vue 组件 mounted 后用 jQuery 绑：
$('.my-toolbar-extra').on('click', vm.handleExtra.bind(vm))
// 在 onBeforeUnmount 解绑
```

## 5. 强制 jQuery 实例

- 全局 `window.jQuery` / `window.$` 必须是 hiprint 用的同一实例
- 业务方**禁止**自己 `import jQuery from 'jquery'` 然后在 hiprint 之前覆盖
- 见 `src/_setup-jquery.js` — 已处理 `window.jQuery = window.$ = $`

## 6. Vite 配置约束

- `vite.config.js` 中 `resolve.alias` 把 `'nzh/dist/nzh.min.js' → 'nzh'`（已配置）
- jspdf / dom-to-image-more / canvg 等不能 tree-shake，必须 全量 bundle

## 7. 改动 designer-shell.vue 的纪律

- 这是 dev server 唯一入口 + demo
- 改动后必须 SMOKE Level 2 验证
- 不要在 designer-shell 里加业务逻辑（业务方有自己的壳）
- `toolbarOptions` 是模范集成示例,改动会影响业务方参考

## 8. 关键参考

- `src/standalone/designer-shell.vue` — Vue 3 + hiprint 共存模范
- `docs/build-designer-vue-integration.md` — 多实例污染历史 + 修复
- `docs/integration-guide.md` Section 3 — Vue 3 注册插件指引
