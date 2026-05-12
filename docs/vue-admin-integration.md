# vue-admin-main 集成指南 — UI 100% 一致复刻

> 问题:"我在 vue-admin-main 里用 hiprint,UI 跟 dev server 看到的不一样,怎么搞?"
>
> 答:dev server 看到的 UI **完全来自 `buildDesigner` 这个函数**,业务方在 vue-admin-main
> 内只要给它正确的容器 + CSS + opts,就 100% 像素级一致。

## 1. 关键认知:UI 是谁画的

`buildDesigner('#xxx', opts)` 内部已经把 toolbar + 左侧组件面板 + 中间画布 + 右侧属性面板 + 底部分页栏全部建好了。**业务方不需要、也无法重写这部分 UI**。

dev server 的 `src/standalone/designer-shell.vue` 只是个**外壳**:
- 提供一个有高度的 `<div id="hiprintDesigner"></div>` 容器
- 调用 `buildDesigner`
- 提供预览 Modal(用 ant-design-vue)和打印模式切换
- 处理 `onBeforeUnmount` 销毁

业务方 vue-admin-main 内**复制这个外壳模式**即可。

## 2. UI 不一致的 4 个常见坑

| # | 症状 | 根因 | 修法 |
|---|---|---|---|
| 1 | 三栏塌陷 / toolbar 撑满整页 | 容器高度未设 | `#hiprintDesigner { height: 100% }` 且父级有高度 |
| 2 | 字体 / 按钮样式不对 | CSS 未 import 或 import 顺序错(ant-design-vue 覆盖) | 在 ant-design-vue CSS 之后 import `vue-plugin-hiprint.css` |
| 3 | 按钮文字英文 | `lang` opts 没传 | `hiprint.init({ lang: 'cn' })` 在 buildDesigner 之前 |
| 4 | 颜色选择器(minicolors)点了无反应 | 业务方只 import 了 hiprint-core.css,缺 designer.css | 见下"CSS 引入"段 |

## 3. 拷贝即用的 Vue 3 集成模板

把下面文件直接放进 vue-admin-main,如 `src/views/print-designer/index.vue`:

```vue
<template>
  <!-- 关键: 外层必须有明确高度,否则 buildDesigner 内部三栏 flex 会塌陷 -->
  <div class="print-designer-page">
    <div id="hiprintDesigner"></div>

    <!-- 预览 Modal — 业务方用什么 UI 框架就换什么,逻辑不变 -->
    <a-modal
      v-model:open="previewVisible"
      title="打印预览"
      :width="1100"
      :footer="null"
      :maskClosable="false"
      @cancel="previewVisible = false"
    >
      <div ref="previewContainer" class="preview-content"></div>
      <div class="preview-footer">
        <a-button @click="previewVisible = false">关闭</a-button>
        <a-button type="primary" @click="handlePrint">打印</a-button>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { hiprint, defaultElementTypeProvider } from 'vue-plugin-hiprint'
// CSS — 顺序很关键,见 §4
import 'vue-plugin-hiprint/dist/vue-plugin-hiprint.css'

const designerCtrl = ref(null)
const template = ref(null)
const previewVisible = ref(false)
const previewContainer = ref(null)
let previewNode = null

onMounted(() => {
  // 必须先 init 注册 elementTypeProvider, 否则左侧组件面板空
  hiprint.init({
    providers: [new defaultElementTypeProvider()],
    lang: 'cn',                                    // 坑 #3
  })
  // setConfig() 可选, 用业务方自定义默认值时调
  hiprint.setConfig()

  designerCtrl.value = hiprint.buildDesigner('#hiprintDesigner', {
    componentModule: 'defaultModule',              // 关键: 必须传, 否则左侧面板空
    templateOptions: {
      template: {},
      dataMode: 1,
      history: true,                                // 启用撤销/重做
      willOutOfBounds: true,
      qtDesigner: true,                            // 启用 Qt 风格设计器
    },
    toolbarOptions: {
      showPanelManager: true,                       // 顶部工具栏分页管理下拉
      onPreview: (tpl) => handlePreview(tpl),
      onPrint: (tpl) => tpl.print({ /* 业务测试数据 */ }),
      onClear: (tpl) => {
        // 业务方用自己的 confirm
        if (confirm('确认清空设计器?')) tpl.clear()
      },
      // 见 docs/API-REFERENCE.md 高频回调列表
    },
    onReady: (tpl /* , toolbarCtrl */) => {
      template.value = tpl
    },
  })
})

onBeforeUnmount(() => {
  // ⚠️ 必须销毁! buildDesigner 内部持有全局事件订阅 + 单例 map,
  // Vue 路由切走时不销毁 = 内存泄漏 + 下次进来事件双绑
  designerCtrl.value && designerCtrl.value.destroy && designerCtrl.value.destroy()
})

function handlePreview(tpl) {
  const $html = tpl.getHtml({ /* 业务数据 */ })
  if (!$html || !$html.length) return
  previewNode = $html
  previewVisible.value = true
  // DOM 节点用 appendChild, 不用 v-html (避免业务方 formatter HTML 被 Vue 重解析触发 XSS)
  nextTick(() => {
    if (previewContainer.value && previewNode) {
      previewContainer.value.replaceChildren()
      previewContainer.value.appendChild(previewNode[0])
    }
  })
}

function handlePrint() {
  if (template.value) template.value.print({ /* 业务数据 */ })
}
</script>

<style scoped>
/* 坑 #1: 容器必须有明确高度 */
.print-designer-page {
  height: calc(100vh - 64px);  /* 减掉 vue-admin 顶部 header,按实际改 */
  overflow: hidden;
}

#hiprintDesigner {
  height: 100%;
  overflow: hidden;
  box-sizing: border-box;
  padding: 8px;
}

.preview-content {
  max-height: 70vh;
  overflow: auto;
  padding: 12px;
  background: #f5f5f5;
  display: flex;
  justify-content: center;
}

.preview-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 12px;
}
</style>
```

## 4. CSS 引入 — 顺序与拆分选择

### 完整集成(含颜色选择器,推荐 vue-admin-main 默认用)

```js
// main.js 或 print-designer/index.vue 内
import 'ant-design-vue/dist/reset.css'             // 先 import ant-design (低优先级)
import 'vue-plugin-hiprint/dist/vue-plugin-hiprint.css'  // 后 import hiprint (覆盖)
```

CSS 大小:144 KB(含 minicolors PNG inline 68 KB)。

### 纯打印场景(业务方有现成模板 JSON,不用设计器)

```js
import 'vue-plugin-hiprint/dist/hiprint-core.css'  // 60 KB, 省 84 KB
// 不要 import vue-plugin-hiprint.css
```

详见 [`CSS-BUNDLE.md`](CSS-BUNDLE.md)。

### `print-lock.css` — 单独引

打印窗口隔离需要,业务方 `index.html` 单独 link:

```html
<link rel="stylesheet" media="print" href="/path-to/dist/print-lock.css" />
```

## 5. UI 一致性验证清单

业务方接好后跑一遍以下检查:

- [ ] toolbar 在顶部一行(图标 + 文字 + 下拉)
- [ ] 左侧组件面板有"文本 / 长文本 / 图片 / 条码 / 二维码 / 表格 / 直线 / 矩形 / HTML"等元素卡片
- [ ] 中间画布有 A4 纸张,可拖拽元素到画布
- [ ] 右侧选中元素后属性面板出现(尺寸 / 字体 / 颜色 等)
- [ ] 颜色选择器(minicolors)点击后弹出色板可选色(若 UI 全黑或不弹 → CSS 没 import 全)
- [ ] 中文 i18n:按钮文字"预览 / 打印 / 撤销 / 清空"等(若英文 → `lang: 'cn'` 未传)
- [ ] 拖拽 longText 元素到画布,设置 longTextIndent:18 → 渲染首行缩进真实生效(若显示字面 `<span class="long-text-indent">` → 老 tgz,需升级到 commit 8a2bb98+)
- [ ] 路由切走再回来不卡顿 / 无重复 toolbar(若有 → destroy 没调)

## 6. 与 vue-admin-main 全局菜单 / 路由集成

在 vue-admin-main 内,推荐路由配置:

```js
// router/modules/business.js (按你的目录约定)
{
  path: '/print/designer',
  name: 'PrintDesigner',
  component: () => import('@/views/print-designer/index.vue'),
  meta: {
    title: '打印模板设计器',
    icon: 'PrinterOutlined',
    keepAlive: false,   // ⚠️ 关闭 keep-alive, 让 onBeforeUnmount 触发 destroy
  },
}
```

**为何关 keep-alive**:hiprint 实例持有 jQuery 全局事件 + 单例 map。keep-alive 缓存组件 = 销毁不触发 = 第二次访问 buildDesigner 二次注册 = UI 异常(双 toolbar / 事件双触发)。

如果**必须**保留 keep-alive,在 `onActivated` 内重新 buildDesigner,`onDeactivated` 内调 `destroy`(见 [`build-designer-vue-integration.md`](build-designer-vue-integration.md))。

## 7. 常见问题快查

| 问题 | 原因 | 修法 |
|---|---|---|
| toolbar 撑满整页 | 容器无高度 | §3 模板的 `height: calc(100vh - 64px)` |
| 点不动颜色选择器 | minicolors CSS / PNG 缺 | 用 `vue-plugin-hiprint.css` 而非 `hiprint-core.css` |
| 左侧面板空白 | `componentModule` 未传 | buildDesigner opts 加 `componentModule: 'defaultModule'` |
| 第二次进页面 UI 乱 | destroy 未调 + keep-alive 开 | 关 keep-alive 或加 onActivated/Deactivated |
| 全部按钮英文 | lang 未传 | `hiprint.init({ lang: 'cn' })` |
| 长文本显示 `<span class="long-text-indent">` | tgz 是旧版 (v1.0.3 之前) | 升级到 v1.0.3+ (commit 8a2bb98) |

## 8. 相关文档

- [`API-REFERENCE.md`](API-REFERENCE.md) — 23 个 export + buildToolbar/buildDesigner opts 速查
- [`integration-guide.md`](integration-guide.md) — 完整 60+ opts 详解 + Vue 2 / 3 注册 + 客户端打印
- [`build-designer-vue-integration.md`](build-designer-vue-integration.md) — Vue 多实例场景 / keep-alive 陷阱
- [`CSS-BUNDLE.md`](CSS-BUNDLE.md) — 3 套 CSS 文件选择
- [`SMOKE-TEST.md`](SMOKE-TEST.md) — 升级 tgz 后回归验证
