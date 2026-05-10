# vue-plugin-hiprint API Reference

外部项目通过 `tgz` 集成本库时的 API 速查。重点章节：

- [安装](#安装)
- [所有导出（Exports）](#所有导出exports)
- [核心：PrintTemplate](#核心printtemplate)
- [字段绑定（field + templateData）— 用 API 替换打印数据](#字段绑定field--templatedata--用-api-替换打印数据)
- [自定义元素类型（PrintElementTypeGroup / Manager）](#自定义元素类型printelementtypegroup--manager)
- [客户端 / 静默打印（getClients / getAddress / ippPrint）](#客户端--静默打印)
- [完整集成示例](#完整集成示例-vue-3)
- [常见问题](#常见问题)

> 设计器内部行为、工具栏定制等请看 [`integration-guide.md`](./integration-guide.md)。

---

## 安装

```bash
# 把 vue-plugin-hiprint.tgz 复制到项目根目录后
npm install ./vue-plugin-hiprint.tgz
# 或 pnpm
pnpm add file:./vue-plugin-hiprint.tgz
```

`package.json` 出现：

```json
{
  "dependencies": {
    "vue-plugin-hiprint": "file:vue-plugin-hiprint.tgz"
  }
}
```

**重要：** tgz 文件名固定为 `vue-plugin-hiprint.tgz`（内部版本由 `package.json.version` 控制），升级时直接覆盖文件 + 重装即可，不需要改 `package.json`。

### 必需的同伴依赖

```bash
npm install jquery@^3.6 ant-design-vue@^4.2 vue@^3.4
```

### 引入样式

```js
import 'vue-plugin-hiprint/dist/vue-plugin-hiprint.css'
// 打印锁定样式（仅打印时生效，screen 模式不应用）
// 推荐方式：在 index.html <head> 加 <link media="print">
```

`index.html`:

```html
<link rel="stylesheet" media="print" href="/path/to/print-lock.css" />
```

---

## 所有导出（Exports）

来自 `vue-plugin-hiprint` 主入口（`import { ... } from 'vue-plugin-hiprint'`）共 **23 个**：

### 核心
| 名称 | 类型 | 用途 |
|---|---|---|
| `hiprint` | object | 全局对象，所有 API 的根。`window.hiprint` 也可访问 |
| `hiPrintPlugin` | Vue plugin | `app.use(hiPrintPlugin)` 注册全局 `$hiPrint` / `$print` / `$print2` |
| `defaultElementTypeProvider` | class | 默认元素类型 provider（订单号 / 条形码 / 二维码 / 横线 / ...） |
| `PrintTemplate` | class | **核心类**，所有打印模板都是它的实例 |
| `PrintElementTypeManager` | class | 元素类型注册器 |
| `PrintElementTypeGroup` | class | 元素类型分组 |

### 元素类型 / 模板配置
| 名称 | 用途 |
|---|---|
| `setDynamicFields(moduleName, fieldGroups)` | 设置左侧动态字段分组 |
| `removeDynamicFields(moduleName)` | 移除动态字段 |
| `setElementTypeGroups(moduleName, groups)` | 替换元素类型分组（模块级）|
| `appendElementTypeGroups(moduleName, groups)` | 追加元素类型分组 |
| `renameElementType(tid, title)` | 修改单个元素的中文标签 |

### 设计器构建
| 名称 | 用途 |
|---|---|
| `buildToolbar(host, options)` | 构建顶部工具栏 |
| `buildDesigner(host, options)` | **一键构建完整设计器**（toolbar + 三栏 + 画布）|

### 直接打印 / HTML 输出
| 名称 | 用途 |
|---|---|
| `print(provider, template, ...args)` | 直接打印（不需要设计器）。`...args` 透传给 `PrintTemplate.print(data, options)` |
| `print2(provider, template, ...args)` | 直接打印走客户端（静默打印）。`...args` 透传给 `PrintTemplate.print2(data, options)` |
| `getHtml(template, ...args)` | 取出打印 HTML 字符串（自定义场景）。`...args` 透传给 `PrintTemplate.getHtml(data, options)` |

> 这 3 个函数都已 `.bind(hiprint)`，可放心解构 `import { print } from 'vue-plugin-hiprint'` 后调用。

### 客户端 / 静默打印（需配合 electron-hiprint）
| 名称 | 用途 |
|---|---|
| `autoConnect(cb)` | 自动连接客户端 |
| `disAutoConnect()` | 断开客户端 |
| `getClients()` | 取已连接客户端列表 |
| `getClientInfo(clientId)` | 取客户端详细信息 |
| `getAddress(type, callback, ...args)` | 取客户端地址。`type`: 通常 `'MAC'` 或 `'IP'`；`callback(addr)`: 收到地址后调用；`...args`: 透传给底层 socket emit |
| `ippPrint(options)` | IPP 协议打印 |
| `ippRequest(options)` | 发送 IPP 请求 |

---

## 核心：PrintTemplate

最常用的类。所有打印模板都通过它创建。

```js
import { PrintTemplate } from 'vue-plugin-hiprint'

const tpl = new PrintTemplate({
  template: { /* 模板 JSON，从设计器导出或写死 */ },
  dataMode: 1,            // 1: 单数据对象, 2: 数据数组
})
```

### 主要方法

| 方法 | 用途 | 例子 |
|---|---|---|
| `tpl.design(selector)` | 在指定容器渲染设计器 | `tpl.design('#designer')` |
| `tpl.update(template)` | 更新整个模板 JSON | `tpl.update(newTplJson)` |
| `tpl.getJson()` | 导出模板 JSON | `const json = tpl.getJson()` |
| `tpl.getJsonTid()` | 导出模板 JSON（含 tid 字段名）| `const json = tpl.getJsonTid()` |
| `tpl.print(data, options)` | 浏览器预览打印 | `tpl.print({ orderNo: 'A001' })` |
| `tpl.print2(data, options)` | 客户端静默打印 | `tpl.print2({ orderNo: 'A001' }, { client: cid, printer: 'XP-365B' })` |
| `tpl.getHtml(data, options)` | 取打印 HTML | `const html = tpl.getHtml(data)` |
| `tpl.toJpeg()` | 导出 JPEG（需 `dom-to-image-more`）| `tpl.toJpeg().then(blob => ...)` |
| `tpl.toPdf(args, name)` | 导出 PDF | `tpl.toPdf({}, '订单A001.pdf')` |
| `tpl.clear()` | 清空画布元素 + 参考线 | `tpl.clear()` |
| **`tpl.destroy()`** | **完全销毁实例**（幂等；清事件订阅 + 画布 + 元素列表面板 + 移出单例 map + 解引用），Vue/SPA 必备 | `onBeforeUnmount(() => tpl.destroy())` |
| **`tpl.isDestroyed`** | **属性，销毁后为 `true`**。destroy 后调 `print/print2/getHtml/getPaperType/getOrient/getPrintStyle` 会 `console.warn` 并返回 undefined（不抛错也不静默工作）| `if (!tpl.isDestroyed) tpl.print(...)` |
| **`tpl.setPaginationVisible(show: boolean)`** | **显示/隐藏画布底部分页栏**。默认隐藏（`showPagination: false`），多页打印时调用显示 | `tpl.setPaginationVisible(true)` |
| `tpl.on(event, callback)` | 监听事件（数据变更、保存等）| 见下 |

### 事件

```js
import { hiprint } from 'vue-plugin-hiprint'

tpl.on('hiprintTemplateDataChanged_' + tpl.id, (action) => {
  // action: 字符串描述（"清空"、"参考线"、"新增打印元素" 等）
  console.log('模板数据已变更:', action)
})
```

---

## 字段绑定（field + templateData）— 用 API 替换打印数据

**核心机制**：每个文本/条形码/二维码元素有 `field` 属性，渲染时按 `field` 从 `data` 对象取值。

### 1. 模板里定义 field

```json
{
  "panels": [{
    "printElements": [{
      "options": {
        "left": 30,
        "top": 30,
        "width": 200,
        "height": 14,
        "title": "订单号",
        "field": "orderNo",            // ← 业务字段名
        "testData": "A001-DEFAULT"     // ← 设计时占位
      },
      "printElementType": { "title": "订单号", "type": "text" }
    }]
  }]
}
```

### 2. 打印时传 templateData

```js
tpl.print({
  orderNo: 'A20260510-001',           // ← 替换 field=orderNo 的元素
  customerName: '张三',
  totalAmount: '¥ 1234.56',
  trackingNo: 'SF1234567890',
  barcode: '6901234567890',           // ← 条形码内容
  qrcode: 'https://order.example.com/A20260510-001',
})
```

### 3. 嵌套字段（点路径）

```js
{ field: 'customer.name' }   // → data.customer.name
{ field: 'address.0.line1' } // → data.address[0].line1
```

### 4. 内置元素的 field 约定（`defaultElementTypeProvider` 默认）

| 元素 | field | 数据类型 |
|---|---|---|
| 订单号 | `orderNo` | string |
| 下单日期 | `orderDate` | string（业务方自己格式化）|
| 快递单号 | `trackingNo` | string（条形码编码）|
| 金额合计 | `totalAmount` | string（含 ¥ 前缀）|
| 寄件人信息 | `senderInfo` | string / object |
| 收件人信息 | `receiverInfo` | string / object |
| **条形码** | `barcode` | string（编码内容）|
| **二维码** | `qrcode` | string（URL 或文本）|
| 签名 | `signature` | string / DataURL |
| 印章 | `stamp` | string / DataURL |

### 5. 数据数组（多页 / 表格）

```js
const tpl = new PrintTemplate({ template: tplJson, dataMode: 2 })

tpl.print([
  { orderNo: 'A001', barcode: '111' },
  { orderNo: 'A002', barcode: '222' },
  { orderNo: 'A003', barcode: '333' },
])
// 自动每条数据生成一页
```

---

## 自定义元素类型（PrintElementTypeGroup / Manager）

### 方式 1：覆盖整个 provider（推荐用业务专属 provider）

```js
import { hiprint, PrintElementTypeManager, PrintElementTypeGroup } from 'vue-plugin-hiprint'

class MyProvider {
  build() {
    return new PrintElementTypeManager({
      type: 'commonModule',
      groups: [
        new PrintElementTypeGroup('业务字段', [
          {
            tid: 'commonModule.shopName',
            title: '门店名',
            field: 'shopName',
            type: 'text',
            options: { width: 150, height: 14, fontWeight: 'bold' }
          },
          {
            tid: 'commonModule.invoiceNo',
            title: '发票号',
            field: 'invoiceNo',
            type: 'text',
            icon: 'ep:list',
            options: {
              width: 180,
              height: 35,
              textType: 'barcode',       // ← 用 textType 渲染条形码
              barcodeType: 'code128',
              hideTitle: true,
              testData: 'INV-2026-001',
            }
          },
        ]),
      ],
    })
  }
}

hiprint.init({ providers: [new MyProvider()] })
```

### 方式 2：动态追加到默认 provider

```js
import { appendElementTypeGroups, PrintElementTypeGroup } from 'vue-plugin-hiprint'

appendElementTypeGroups('defaultModule', [
  new PrintElementTypeGroup('扩展', [
    { tid: 'defaultModule.coupon', title: '优惠码', field: 'coupon', type: 'text' },
  ])
])
```

### 方式 3：动态字段（只加字段，不加完整元素类型）

```js
import { setDynamicFields } from 'vue-plugin-hiprint'

setDynamicFields('defaultModule', [
  { name: '订单字段', items: [
    { field: 'pickupTime', title: '取件时间' },
    { field: 'driverName', title: '司机姓名' },
  ]},
])
// 用户在设计器左侧"动态字段"分组看到这些字段，可拖拽
```

### 元素 type 完整列表

`type` 决定底层渲染管道，详见 hiprint 内部：

| type | 用途 |
|---|---|
| `text` | 文本（支持 `options.textType: text/barcode/qrcode/image/longText`）|
| `html` | 自定义 HTML 片段 |
| `image` | 图片（DataURL 或 URL）|
| `longText` | 长文本（自动分页）|
| `table` | 表格（含 columns 配置）|
| `tableCustom` | 自定义空表格 |
| `hline` | 横线 |
| `vline` | 竖线 |
| `rect` | 矩形 |
| `oval` | 椭圆 |

> **重要：** 之前 `type: 'barcode'` / `type: 'qrcode'` 仍然兼容（旧模板照常加载），但**新模板推荐用 `type: 'text' + options.textType: 'barcode'/'qrcode'`**，统一渲染管道，可在属性面板自由切换。

---

## 客户端 / 静默打印

### 前置：安装 [electron-hiprint](https://github.com/CcSimple/electron-hiprint)

桌面客户端启动后会暴露 socket.io 服务端，浏览器通过 `socket.io-client` 连接。

### 自动连接 / 取列表

```js
import { autoConnect, getClients, getAddress } from 'vue-plugin-hiprint'

autoConnect((status, msg) => {
  if (status) {
    console.log('已连接 hi 客户端')
    const clients = getClients()
    // [{ clientId: 'xxx', name: 'PC-01', printerList: [...] }, ...]
    getAddress('MAC', (addr) => {
      console.log('客户端 MAC:', addr)
    })
  }
})
```

### 静默打印

```js
tpl.print2(data, {
  client: 'xxx',                  // 来自 getClients()
  printer: 'XP-365B (副本)',       // 来自 getClientInfo()
  type: 'pdf',                    // 'html' | 'pdf' | 'image'
  pageSize: { width: 100, height: 180 },
  drawer: false,                  // 是否开钱箱
  copies: 1,
})
```

---

## 完整集成示例 (Vue 3)

```js
// main.js
import { createApp } from 'vue'
import App from './App.vue'
import { hiPrintPlugin } from 'vue-plugin-hiprint'
import 'vue-plugin-hiprint/dist/vue-plugin-hiprint.css'

const app = createApp(App)
app.use(hiPrintPlugin)
app.mount('#app')
```

```vue
<!-- PrintDesigner.vue -->
<template>
  <div id="hiprintDesigner" style="height: 100vh"></div>
</template>

<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import { hiprint, PrintTemplate, defaultElementTypeProvider, buildDesigner } from 'vue-plugin-hiprint'

let tpl = null

onMounted(() => {
  hiprint.init({ providers: [new defaultElementTypeProvider()] })

  tpl = new PrintTemplate({
    template: {},     // 空模板，用户从 0 开始设计
    dataMode: 1,
  })

  buildDesigner('#hiprintDesigner', {
    template: tpl,
    onSave: (json) => {
      // 保存模板 JSON 到后端
      fetch('/api/template/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      })
    },
    onPrint: () => {
      // 业务方自定义打印数据
      tpl.print({
        orderNo: 'A20260510-001',
        barcode: '6901234567890',
        qrcode: 'https://example.com/order/A20260510-001',
      })
    },
  })
})

onBeforeUnmount(() => {
  tpl && tpl.destroy && tpl.destroy()
})
</script>
```

```vue
<!-- 简化场景：只打印不要设计器 -->
<template>
  <button @click="doPrint">打印</button>
</template>

<script setup>
import { hiprint, PrintTemplate, defaultElementTypeProvider } from 'vue-plugin-hiprint'

const TEMPLATE_JSON = {
  panels: [{
    index: 0, name: '运单',
    height: 180, width: 100,
    paperHeader: 0, paperFooter: 0,
    printElements: [
      { options: { left: 30, top: 10, width: 100, height: 20, fontSize: 14, fontWeight: 'bold', title: '订单号', field: 'orderNo' },
        printElementType: { title: '订单号', type: 'text' } },
      { options: { left: 30, top: 40, width: 180, height: 35, textType: 'barcode', barcodeType: 'code128', hideTitle: true, field: 'trackingNo' },
        printElementType: { title: '快递单号', type: 'text' } },
    ],
  }]
}

function doPrint() {
  hiprint.init({ providers: [new defaultElementTypeProvider()] })
  const tpl = new PrintTemplate({ template: TEMPLATE_JSON })
  tpl.print({
    orderNo: 'A20260510-001',
    trackingNo: 'SF1234567890',
  })
}
</script>
```

---

## 常见问题

### Q: 我的项目用 Vue 2 还是 Vue 3？

A: **本库自 v0.0.61 起仅支持 Vue 3.4+**。Vue 2 用户请用上游 [`CcSimple/vue-plugin-hiprint`](https://github.com/CcSimple/vue-plugin-hiprint) 0.0.56 之前的版本。

### Q: 拖入条形码显示"此格式不支持该文本"？

A: 元素**没有 `field` 属性**。textType:barcode/qrcode 元素必须有 field（hiprint 内部会把 title 当编码源），中文 title 在 code128 格式下不支持。

修复：在元素定义里加 `field: 'xxxName'`。

### Q: 字段绑定后打印没替换成业务数据？

A: 检查：
1. `tpl.print(data)` 的 `data` key 是否与 field 一致（区分大小写）
2. 嵌套字段用 `.` 分隔（`customer.name`）
3. 设计时占位 `testData` 不影响生产，但 `templateData` 缺 key 时会 fallback 到 `testData`

### Q: PDF 导出报错 / 中文乱码？

A: 需要 jspdf 字体。本库默认依赖 `jspdf@^2.5.1`，如果业务方升到 jspdf v4+ 需要重新适配 API。

### Q: 怎么自定义工具栏 / 隐藏某些按钮？

A: 见 `integration-guide.md` 第 5.4 节，`buildToolbar(host, { ...buttons })`。

### Q: 静默打印报"找不到客户端"？

A: 客户端（electron-hiprint）必须先启动。检查：
- `getClients()` 返回不为空
- `client` 参数是否对应 `getClients()` 里的 `clientId`
- 防火墙是否拦截 socket.io 端口（默认 17521）

### Q: 怎么完整销毁设计器实例？

A:
```js
// designer 是 buildDesigner() 的返回值
designer && designer.destroy()    // 清 toolbar + 解绑全局 click + 清容器

// tpl 是 new PrintTemplate(...) 的实例
tpl && tpl.destroy()              // 清画布 + 解绑 panel 事件 + 移出单例 map
```

Vue 3 完整示例：

```vue
<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import { PrintTemplate, buildDesigner } from 'vue-plugin-hiprint'

let tpl = null
let designer = null

onMounted(() => {
  tpl = new PrintTemplate({ template: {}, dataMode: 1 })
  designer = buildDesigner('#hiprintDesigner', { template: tpl })
})

onBeforeUnmount(() => {
  designer && designer.destroy()
  tpl && tpl.destroy()
})
</script>
```

**KeepAlive / 路由切换场景必须做 destroy**，否则全局 click handler、单例 map 条目、panel 事件都会累积，造成内存泄漏。

---

## 类型定义

本库目前**没有 TypeScript 类型定义文件（`.d.ts`）**。如果你的项目用 TypeScript，建议：

1. 在 `src/types/vue-plugin-hiprint.d.ts` 加 module declaration：

```ts
declare module 'vue-plugin-hiprint' {
  export const hiprint: any
  export const hiPrintPlugin: any
  export class PrintTemplate {
    constructor(options: { template: any; dataMode?: 1 | 2 })
    design(selector: string): void
    update(template: any): void
    getJson(): any
    getJsonTid(): any
    print(data?: any, options?: any): void
    print2(data?: any, options?: any): void
    getHtml(data?: any, options?: any): string
    toJpeg(): Promise<Blob>
    toPdf(args?: any, name?: string): void
    clear(): void
    destroy(): void
    readonly _destroyed?: boolean
    on(event: string, callback: (action: string) => void): void
  }
  export class PrintElementTypeManager { /* ... */ }
  export class PrintElementTypeGroup {
    constructor(name: string, items: any[])
  }
  export const defaultElementTypeProvider: any
  export function setDynamicFields(moduleName: string, fieldGroups: any[]): void
  export function removeDynamicFields(moduleName: string): void
  export function setElementTypeGroups(moduleName: string, groups: any[]): void
  export function appendElementTypeGroups(moduleName: string, groups: any[]): void
  export function renameElementType(tid: string, title: string): void
  export function buildToolbar(host: string, options?: any): void
  export function buildDesigner(host: string, options?: any): any
  export function autoConnect(cb?: (status: boolean, msg?: any) => void): void
  export function disAutoConnect(): void
  export function getClients(): Array<{ clientId: string; [k: string]: any }>
  export function getClientInfo(clientId: string): any
  export function getAddress(type: 'MAC' | 'IP' | string, cb: (addr: string) => void, ...args: any[]): void
  export function print(provider: any, template: any, data?: any, options?: any): any
  export function print2(provider: any, template: any, data?: any, options?: any): any
  export function getHtml(template: any, data?: any, options?: any): string
  export function ippPrint(options: any): any
  export function ippRequest(options: any): any
}
```

或者向我们 PR 完善 `.d.ts`！

---

## 反馈

issues：https://github.com/amDosion/vue-plugin-hiprint/issues
