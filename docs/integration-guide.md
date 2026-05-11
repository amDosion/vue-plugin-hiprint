# vue-plugin-hiprint 集成指南

## 0. 当前版本变更摘要（2026-03）

本指南已按当前仓库代码状态整理，以下为你本轮改造后需要重点关注的变化：

## ⚠️ 安全注意事项（业务方必读, v1.0.2+）

hiprint 内部已修 12+ 处 XSS、补 47+ 处 lifecycle 守卫、80 处日志带 `[hiprint]` 前缀。但以下 **by-design HTML 渲染路径** 由业务方负责安全：

### 1. `html` 元素类型 — 渲染业务方提供的 HTML 字符串（同 React `dangerouslySetInnerHTML`）
- 业务方 formatter 输出的 HTML 直接 `.html()` 进入 DOM。
- 若 formatter 内含用户数据 → **必须** 业务方自行转义 / 用 DOMPurify 过滤。

### 2. 表格 column `renderFormatter` — `r.html(rf(...))`
- 业务方在模板设计器写的 renderFormatter 字符串 `new Function`化后调用，返回值通过 `.html()` 渲染。
- 设计时合约：业务方知道在写 HTML，自行负责安全。

### 3. 表格 `gridColumnsFooterFormatter` — 同上
- 业务方 formatter 输出渲染为 footer HTML。

### 4. `setButtonText(key, html, useHtml=true)` / `extraButtons[].html`
- 主动用 `html` 字段或 `useHtml=true` 时业务方接受 HTML 渲染。
- 默认 `text/label` 字段走 `.text()` safe path。

### 5. socket token 配置
- 默认 `hiwebSocket.token = 'vue-plugin-hiprint'` 是公开值。生产环境**必须**调用 `hiwebSocket.setHost(host, token, cb)` 显式设置强 token。
- 启动时检测到 default 会 `console.warn` 警告。

### 6. CSP 配置（业务方应用层）
- 业务方 `index.html` 应配 strict CSP。本库内部用 `new Function()` 渲染 formatter，要求 `script-src 'unsafe-eval'` 或 wrapped 策略。
- 参考 demo CSP: 见仓库 `index.html`。
- 移除 `'unsafe-eval'` 方案: 不使用 formatter / styler 功能 (设计时不输入 fn 字符串)。

### 7. `window.__hiprintDesignerControls` (demo)
- 仅 demo shell 暴露,生产业务方**不应**暴露任何 window 全局给页面其他脚本调用。

### 8. 模板 JSON 来源
- hiprint 内部限制 formatter / styler 字符串 ≤ 5000 字符 (security M3 cap)。
- 业务方接收外部模板 JSON 时应 **schema 验证 + length cap** 防 DoS。



1. 启动入口已不再依赖 `src/demo`（且 `src/demo` 已物理移除）。
2. 当前仓库开发态页面使用独立壳层：`src/standalone/designer-shell.vue`。
3. 默认即加载空模板（`templateOptions.template = {}`），不再依赖演示开关。
4. 三栏设计器布局已保留且优化：
   - 宿主容器 `#hiprintDesigner` 支持安全内边距（当前为 `8px`）。
   - 中间画布区 `.hiprint-designer-panel-center` 已补齐边框/圆角，视觉与左右面板风格统一。
5. 设计态标尺为代码生成，不依赖 `l_img.svg` / `v_img.svg` 静态资源。
6. 工具栏已支持“业务选择（模板前）+ 选择模版（纸张前）+ 保存（打印后）+ 保存名称二次确认弹窗 + 模版中心卡片操作”，并暴露按钮级控制 API 便于业务端二次定制。

## 1. 安装

将 `vue-plugin-hiprint-0.0.61.tgz` 文件复制到你的项目目录，然后执行：

```bash
npm install ./vue-plugin-hiprint-0.0.61.tgz
```

安装完成后 `package.json` 中会出现：

```json
{
  "dependencies": {
    "vue-plugin-hiprint": "file:vue-plugin-hiprint-0.0.61.tgz"
  }
}
```

### 升级/覆盖安装（旧版本已安装时）

如果项目之前装过旧版本（尤其是 `file:xxx.tgz` 本地包），建议先卸载旧依赖并清理旧压缩包，再安装新包，避免锁文件与缓存导致“看起来安装成功但实际未生效”。

#### npm

```bash
# 1) 卸载旧包
npm uninstall vue-plugin-hiprint

# 2) 删除旧 tgz（按你的实际文件名）
rm -f ./vue-plugin-hiprint-0.0.61-beta5.tgz

# 3) 安装正式版 tgz
npm install ./vue-plugin-hiprint-0.0.61.tgz

# 4) 校验当前生效版本
npm ls vue-plugin-hiprint
```

#### pnpm

```bash
pnpm remove vue-plugin-hiprint
rm -f ./vue-plugin-hiprint-0.0.61-beta5.tgz
pnpm add ./vue-plugin-hiprint-0.0.61.tgz
pnpm list vue-plugin-hiprint
```

#### yarn

```bash
yarn remove vue-plugin-hiprint
rm -f ./vue-plugin-hiprint-0.0.61-beta5.tgz
yarn add ./vue-plugin-hiprint-0.0.61.tgz
yarn list --pattern vue-plugin-hiprint
```

#### 二次确认（建议）

1. 确认 `package.json` 依赖已指向：`"vue-plugin-hiprint": "file:vue-plugin-hiprint-0.0.61.tgz"`。
2. 确认锁文件已更新（`package-lock.json` / `pnpm-lock.yaml` / `yarn.lock`）。
3. 执行一次重启：停止 dev server 后重新 `npm run dev`（或 `pnpm dev` / `yarn dev`）。

#### 仍未生效时（兜底）

```bash
rm -rf node_modules
rm -f package-lock.json pnpm-lock.yaml yarn.lock
npm install
```

> 兜底步骤会重建全部依赖，仅在版本仍异常时使用。

### 前置依赖

项目需要全局引入 jQuery（插件内部依赖）：

```bash
npm install jquery
```

在入口文件中确保 jQuery 挂载到 window：

```js
import jQuery from 'jquery'
window.jQuery = jQuery
window.$ = jQuery
```

### 引入样式

样式接入要区分两种模式：

1. `npm/tgz` 安装插件（推荐）：
   - 设计器核心样式（`hiprint.css`）由 `dist/vue-plugin-hiprint.js` 自动注入。
   - 你仍然必须手动引入打印样式 `print-lock.css`。
2. 直接拷贝源码内置到你的项目：
   - 必须手动引入 `src/hiprint/css/hiprint.css` 和 `src/hiprint/css/print-lock.css` 两个文件。

在 `npm/tgz` 模式下，入口文件或组件中至少要引入：

```js
import 'vue-plugin-hiprint/dist/print-lock.css'
```

若你采用“源码内置”模式，入口需要显式引入：

```js
import '@/hiprint/css/hiprint.css'
import '@/hiprint/css/print-lock.css'
```

可选样式（按需）：

```js
// 若你希望保留旧版 glyphicon 图标观感（部分元素卡片图标）
import 'bootstrap/dist/css/bootstrap.min.css'
```

样式接入验收（建议）：

1. 左/中/右三栏都显示正常（中间画布区有边框与圆角）。
2. 元素卡片、工具栏、右侧属性面板样式完整，不是裸 HTML。
3. 预览/打印时分页与隐藏规则按 `print-lock.css` 生效。

---

## 2. Vue 2.x 注册插件

```js
// main.js
import jQuery from 'jquery'
window.jQuery = jQuery
window.$ = jQuery

import Vue from 'vue'
import { hiPrintPlugin } from 'vue-plugin-hiprint'
import 'vue-plugin-hiprint/dist/print-lock.css'

Vue.use(hiPrintPlugin, '$bindName')
// 第二个参数为挂载到 Vue.prototype 的属性名，默认 '$hiPrint'
// 第三个参数为是否自动连接打印客户端，默认 true
```

## 3. Vue 3.x 注册插件

```js
// main.js
import jQuery from 'jquery'
window.jQuery = jQuery
window.$ = jQuery

import { createApp } from 'vue'
import App from './App.vue'
import { hiPrintPlugin } from 'vue-plugin-hiprint'
import 'vue-plugin-hiprint/dist/print-lock.css'

const app = createApp(App)
app.use(hiPrintPlugin, '$hiPrint')
app.mount('#app')
```

## 4. 直接导入使用（推荐）

不使用 Vue 插件模式，直接按需导入：

```js
import { hiprint, defaultElementTypeProvider } from 'vue-plugin-hiprint'
import 'vue-plugin-hiprint/dist/print-lock.css'
```

---

## 5. 基础用法：初始化 + 设计器

### 5.1 初始化

```js
import { hiprint, defaultElementTypeProvider } from 'vue-plugin-hiprint'

// 初始化，注册默认的元素类型 Provider
hiprint.init({
  providers: [new defaultElementTypeProvider()],
  lang: 'cn'  // 支持: cn, cn_tw, en, de, es, fr, it, ja, ru
})
```

### 5.2 渲染左侧拖拽组件面板

```html
<div id="hiprintEpContainer"></div>
```

```js
// 将默认模块的拖拽组件渲染到容器中
hiprint.PrintElementTypeManager.build('#hiprintEpContainer', 'defaultModule')
```

### 5.3 创建打印模板

```js
const hiprintTemplate = new hiprint.PrintTemplate({
  template: {},           // 模板 JSON 对象（空对象为新建）
  settingContainer: '#PrintElementOptionSetting',  // 右侧属性设置容器
  paginationContainer: '.hiprint-printPagination'  // 页码容器
})

// 将设计器渲染到指定容器
hiprintTemplate.design('#hiprint-printTemplate')
```

### 5.4 构建工具栏

插件内置了纯 jQuery 实现的工具栏，包含业务选择、模版选择、纸张选择、缩放、旋转、对齐、预览、清空、打印、保存，不依赖任何 UI 框架。点击“保存”会先弹出输入框，要求填写模版名称后再执行保存回调。

> 生产项目请始终传入 `onClear`，并使用你项目的组件化对话框（如 Ant Design Vue / Element Plus）。不要直接使用原生 `confirm` 作为业务交互弹窗。

```html
<div id="hiprintToolbar"></div>
```

```js
const toolbarCtrl = hiprint.buildToolbar('#hiprintToolbar', hiprintTemplate, {
  // 所有选项均可选，以下为默认值
  defaultPaper: 'A4',
  scaleMin: 0.5,
  scaleMax: 5,
  scaleStep: 0.1,

  // 控制显示/隐藏各功能区
  showPaperSelect: true,   // 纸张选择按钮组（A3~B5）
  showCustomPaper: true,   // 自定义纸张按钮
  showScale: true,         // 缩放按钮
  showRotate: true,        // 旋转按钮
  showAlign: true,         // 对齐按钮组（8个，可通过 alignItems 自定义）
  showPreview: true,       // 预览按钮
  showClear: true,         // 清空按钮
  showPrint: true,         // 打印按钮
  showBusinessSelect: true, // 业务选择按钮（位于模板选择前）
  showTemplateSelect: true, // 模版选择按钮（位于纸张选择前）
  showSave: true,          // 保存按钮（位于打印后）
  showPanelManager: false, // (NEW) 分页管理 UI（segmented 下拉 + add 按钮），默认关闭
  showPagination: false,   // (NEW) 画布底部分页栏，默认关闭。多页打印时设 true 或调 tpl.setPaginationVisible(true)

  // 回调函数
  onPreview: (template) => {
    // 自定义预览逻辑
  },
  onPrint: (template) => {
    // 建议必传：工具栏“打印”按钮仅触发 onPrint 回调
    // 你可以在这里调用浏览器打印（template.print）或静默打印（template.print2）
    template.print(printData)
  },
  onClear: (template) => {
    // 必传：使用项目 UI 组件弹窗确认后再清空
  },
  onClearConfirm: (template) => {
    // (NEW) Promise 风格确认，返回 Promise<boolean>
    // 优先级：onClear > onClearConfirm > 原生 confirm
    return new Promise((resolve) => {
      if (confirm('确定清空？')) {
        template.clear()
        resolve(true)
      } else {
        resolve(false)
      }
    })
  },
  onSave: (template, json, event, api, ctx) => {
    // ctx.name 为”保存弹窗”中输入的模版名称
    // 保存按钮回调（可直接对接后端 API）
    // 未传 onSave 时，内置默认下载 json 文件
    return fetch('/api/templates/save', {
      method: 'POST',
      body: JSON.stringify({
        name: ctx.name,
        templateJson: json
      })
    })
  },
  onCustomPaperOpen: (template, toolbarApi) => {
    // (NEW) 自定义纸张弹窗打开时回调（Promise）
    // 可用于 custom paper 前的业务逻辑（如权限检查、引导）
    console.log('Custom paper dialog opened')
    return Promise.resolve()
  },
  onPaperChange: (name, size) => {
    console.log('纸张切换:', name, size.width, 'x', size.height)
  },
  onScaleChange: (scaleValue) => {
    console.log('缩放:', scaleValue)
  },

  // 业务选择数据接口（对接后端业务字段/业务场景）
  businessListProvider: async () => {
    const list = await fetch('/api/print-business/list').then(r => r.json())
    return list
  },
  businessLoader: async (item) => {
    const detail = await fetch(`/api/print-business/${item.id}`).then(r => r.json())
    return detail
  },
  onBusinessSelect: (item, businessData, template, api) => {
    // businessData 可携带后端返回的字段配置、默认模板、打印策略等
    // 例如：
    // hiprint.setDynamicFields('orderModule', businessData.fieldGroups || [])
  },
  onBusinessSelectError: (err) => {
    // (NEW) 业务选择过程中的错误回调
    console.error('Business select error:', err)
  },
  onTemplateSelectError: (err) => {
    // (NEW) 模板选择过程中的错误回调
    console.error('Template select error:', err)
  },
  panelManagerLabel: '分页',         // (NEW) panel manager 标签文本（默认'分页'）
  addPanelButtonText: '+',          // (NEW) add panel 按钮文本（默认'+'）
  alignItems: [                     // (NEW) 自定义对齐选项，可完全替换默认的8个
    // { type: 'left', label: '左对齐', icon: 'icon-left' },
    // { type: 'right', label: '右对齐', icon: 'icon-right' },
    // ...
    // 留空或不传则使用默认8项
  ],
    // if (businessData.templateJson) template.update(businessData.templateJson)
    console.log('已选择业务', item, businessData)
  },

  // 模版中心数据接口（对接后端）
  templateListProvider: async () => {
    const list = await fetch('/api/templates').then(r => r.json())
    return list
  },
  templateLoader: async (item) => {
    const detail = await fetch(`/api/templates/${item.id}`).then(r => r.json())
    return detail.templateJson
  },
  onTemplateSelect: (item, templateJson, template) => {
    console.log('已选择模版', item.id)
  },
  onTemplatePreview: (item) => {
    console.log('预览模版', item.id)
  },
  onTemplateEdit: (item) => {
    console.log('编辑模版', item.id)
  },
  onTemplateDelete: async (item) => {
    await fetch(`/api/templates/${item.id}`, { method: 'DELETE' })
    return true
  },

  // 扩展按钮（配置式）
  extraPosition: 'end',    // start | end，默认 end
  extraButtons: [
    {
      label: '保存模板',
      type: 'primary',      // default | primary | danger
      onClick: (template, event, api) => {
        console.log('保存', template.getJson())
      }
    },
    {
      label: '重置参考线',
      type: 'danger',
      visible: (template) => true,
      onClick: (template) => {
        const json = template.getJson()
        json.panels && json.panels.forEach(p => { p.guideLines = [] })
        template.update(json)
      }
    }
  ],

  // 扩展渲染（高级用法）
  renderExtra: (api) => {
    const $group = $('<div class="hiprint-toolbar-group"></div>')
    const $btn = api.createButton({
      label: '导出JSON',
      onClick: (template) => console.log(template.getJson())
    })
    $group.append($btn)
    api.addGroup($group, 'end')
  }
})

// 返回的控制对象
toolbarCtrl.getScale()      // 获取当前缩放值
toolbarCtrl.setScale(1.5)   // 设置缩放值
toolbarCtrl.openBusinessDialog() // 打开业务选择弹窗
toolbarCtrl.refreshBusinessList() // 刷新业务列表
toolbarCtrl.openTemplateDialog() // 打开模版选择弹窗
toolbarCtrl.refreshTemplateList() // 刷新模版列表
toolbarCtrl.triggerSave()   // 触发保存动作
toolbarCtrl.setButtonVisible('print', false) // 控制内置按钮显隐
toolbarCtrl.setButtonText('businessSelect', '订单业务') // 修改内置按钮文案
toolbarCtrl.getToolbarElement() // 获取工具栏 jQuery 对象
toolbarCtrl.destroy()       // 销毁工具栏
```

### 5.4.1 工具栏扩展点（插槽式能力）

`buildToolbar` 现已支持“配置式按钮扩展 + 自定义渲染扩展”，可用于后续业务按钮接入。

**扩展参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `showBusinessSelect` | boolean | `true` | 是否显示“业务选择”按钮（位于“选择模版”前） |
| `businessButtonText` | string | `'业务选择'` | 业务选择按钮文案 |
| `onBusinessClick` | `(template, api) => boolean \| void` | `null` | 业务按钮点击回调；返回 `false` 可阻止默认弹窗 |
| `onBusinessDialogOpen` | `(ctx) => boolean \| void` | `null` | 业务弹窗打开钩子；返回 `false/true` 可阻止内置弹窗（用于完全自定义） |
| `onBusinessDialogClose` | `(ctx) => boolean \| void` | `null` | 业务弹窗关闭钩子；返回 `false/true` 可阻止内置关闭行为 |
| `businessListProvider` | `(template, api) => Promise<BusinessItem[]>` | `null` | 获取业务卡片列表（通常对接后端） |
| `businessLoader` | `(item, template, api) => Promise<any>` | `null` | 加载业务详情（字段配置/默认模板/打印策略等） |
| `onBusinessSelect` | `(item, data, template, api) => void` | `null` | 点击业务“选择”后的回调，`data` 为业务详情 |
| `showTemplateSelect` | boolean | `true` | 是否显示“选择模版”按钮（位于纸张按钮前） |
| `onTemplateDialogOpen` | `(ctx) => boolean \| void` | `null` | 模版弹窗打开钩子；返回 `false/true` 可阻止内置弹窗 |
| `onTemplateDialogClose` | `(ctx) => boolean \| void` | `null` | 模版弹窗关闭钩子；返回 `false/true` 可阻止内置关闭 |
| `onTemplateDeleteConfirm` | `(ctx) => boolean \| Promise<boolean>` | `null` | 删除模版确认钩子；不传时默认原生 `confirm` |
| `showSave` | boolean | `true` | 是否显示“保存”按钮（位于打印按钮后） |
| `onSaveDialogOpen` | `(ctx) => boolean \| void` | `null` | 保存弹窗打开钩子；返回 `false/true` 可阻止内置弹窗 |
| `onSaveDialogClose` | `(ctx) => boolean \| void` | `null` | 保存弹窗关闭钩子；返回 `false/true` 可阻止内置关闭 |
| `onPrint` | `(template) => void` | `null` | 打印按钮回调。建议始终传入并在回调内调用 `template.print(data)` 或 `template.print2(data, options)`。 |
| `onClear` | `(template) => void` | `null` | 清空按钮回调。建议始终传入并使用组件化弹窗确认，避免原生 `confirm` 交互不一致。 |
| `onSave` | `(template, json, event, api, ctx) => any` | `null` | 保存回调，`ctx.name` 为输入的模版名称；不传则默认下载 JSON |
| `previewButtonText` | string | `'预览'` | 预览按钮文案 |
| `clearButtonText` | string | `'清空'` | 清空按钮文案 |
| `printButtonText` | string | `'打印'` | 打印按钮文案 |
| `rotateButtonText` | string | `'旋转'` | 旋转按钮文案 |
| `customPaperButtonText` | string | `'自定义'` | 自定义纸张按钮文案 |
| `customPaperConfirmText` | string | `'确定'` | 自定义纸张确认按钮文案 |
| `onRotate` | `(template) => void` | `null` | 旋转按钮回调（执行 `rotatePaper` 后触发） |
| `onAlign` | `(type, template) => void` | `null` | 对齐按钮回调（执行 `alignElements` 后触发） |
| `templateListProvider` | `(template, api) => Promise<TemplateItem[]>` | `null` | 获取模版列表（通常对接后端） |
| `templateLoader` | `(item, template, api) => Promise<object \| string>` | `null` | 加载指定模版 JSON |
| `onTemplateSelect` | `(item, json, template, api) => void` | `null` | 点击“选择”后回调 |
| `onTemplatePreview` | `(item, template, api) => void` | `null` | 点击“预览”回调 |
| `onTemplateEdit` | `(item, template, api) => void` | `null` | 点击“编辑”回调 |
| `onTemplateDelete` | `(item, template, api) => Promise<boolean \| void>` | `null` | 点击“删除”回调，返回 `false` 可阻止刷新 |
| `extraPosition` | `'start' \| 'end'` | `'end'` | 扩展按钮分组插入位置 |
| `extraButtons` | `ToolbarButton[]` | `[]` | 配置式扩展按钮数组 |
| `renderExtra` | `(api) => void` | `null` | 自定义渲染扩展，适合复杂按钮/下拉 |

**ToolbarButton 结构：**

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `label`/`text` | string | 否 | 按钮文字 |
| `icon` | string | 否 | 按钮图标文本 |
| `html` | string | 否 | 按钮 HTML（优先级高于 label） |
| `type` | `'default' \| 'primary' \| 'danger'` | 否 | 按钮样式 |
| `className` | string | 否 | 自定义 class |
| `title` | string | 否 | title 提示 |
| `visible` | boolean \| `(template, api) => boolean` | 否 | 是否显示 |
| `disabled` | boolean \| `(template, api) => boolean` | 否 | 是否禁用 |
| `onClick` | `(template, event, api) => void` | 否 | 点击回调 |

**renderExtra(api) 提供能力：**

| API | 说明 |
|-----|------|
| `api.toolbar` | 工具栏 jQuery 对象 |
| `api.container` | 工具栏容器 jQuery 对象 |
| `api.template` | 当前 `PrintTemplate` 实例 |
| `api.createButton(btnOpt)` | 创建一个扩展按钮 |
| `api.addGroup(group, position?)` | 插入按钮分组 |
| `api.openBusinessDialog()` | 打开业务选择弹窗 |
| `api.getBusinessDialogElement()` | 获取业务弹窗 jQuery 对象（可用于样式/行为二次定制） |
| `api.refreshBusinessList()` | 重新拉取业务列表 |
| `api.setBusinessItems(list)` | 直接设置业务列表 |
| `api.setBusinessListProvider(fn)` | 动态设置业务列表提供器 |
| `api.setBusinessLoader(fn)` | 动态设置业务详情加载器 |
| `api.openTemplateDialog()` | 打开模版选择弹窗 |
| `api.getTemplateDialogElement()` | 获取模版弹窗 jQuery 对象 |
| `api.closeTemplateDialog()` | 关闭模版选择弹窗 |
| `api.refreshTemplateList()` | 重新拉取模版列表 |
| `api.setTemplateItems(list)` | 直接设置模版列表（无需远程请求） |
| `api.getTemplateItems()` | 获取当前模版列表 |
| `api.setTemplateListProvider(fn)` | 动态设置模版列表提供器 |
| `api.setTemplateLoader(fn)` | 动态设置模版详情加载器 |
| `api.getSaveDialogElement()` | 获取保存弹窗 jQuery 对象 |
| `api.setDialogHandler(name, handler)` | 设置对话框钩子（`businessOpen/templateOpen/saveOpen/...`） |
| `api.getDialogHandler(name)` | 获取当前对话框钩子 |
| `api.getButton(key)` | 获取内置按钮（jQuery 对象） |
| `api.setButtonVisible(key, visible)` | 设置内置按钮显隐 |
| `api.setButtonText(key, text, useHtml?)` | 设置内置按钮文案/HTML |
| `api.setButtonDisabled(key, disabled)` | 设置内置按钮禁用状态 |
| `api.triggerButton(key)` | 触发指定按钮点击 |
| `api.getGroup(groupKey)` | 获取内置分组（jQuery 对象） |
| `api.setGroupVisible(groupKey, visible)` | 设置内置分组显隐 |

### 5.4.2-A 业务卡片数据结构（BusinessItem）

业务弹窗中的每张卡片由 `BusinessItem` 渲染，后端可返回：

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string \| number | 否 | 业务唯一标识（建议提供） |
| `name`/`title`/`businessName` | string | 否 | 业务名称（至少提供一个） |
| `description`/`desc`/`remark` | string | 否 | 业务描述 |
| `updatedAt`/`updateTime`/`modifiedAt` | string | 否 | 更新时间文案 |
| `businessConfig`/`fieldsConfig`/`config`/`data` | object \| string | 否 | 业务详情（字段配置、打印配置等） |

### 5.4.2 模版卡片数据结构（TemplateItem）

模版弹窗中的每张卡片由 `TemplateItem` 渲染，后端返回字段可按下面结构提供：

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string \| number | 否 | 模版唯一标识（建议提供） |
| `name`/`title`/`templateName` | string | 否 | 模版名称（至少提供一个） |
| `description`/`desc`/`remark` | string | 否 | 模版描述 |
| `updatedAt`/`updateTime`/`modifiedAt` | string | 否 | 更新时间文案 |
| `template`/`templateJson`/`json`/`data` | object \| string | 否 | 模版 JSON（不配 `templateLoader` 时可直接放这里） |

常用控制方法（`toolbarCtrl`）：

```js
toolbarCtrl.openBusinessDialog()
toolbarCtrl.closeBusinessDialog()
toolbarCtrl.getBusinessDialogElement()
toolbarCtrl.refreshBusinessList()
toolbarCtrl.setBusinessItems(list)
toolbarCtrl.getBusinessItems()
toolbarCtrl.setBusinessListProvider(asyncProvider)
toolbarCtrl.setBusinessLoader(asyncLoader)

toolbarCtrl.openTemplateDialog()
toolbarCtrl.closeTemplateDialog()
toolbarCtrl.getTemplateDialogElement()
toolbarCtrl.refreshTemplateList()
toolbarCtrl.setTemplateItems(list)
toolbarCtrl.getTemplateItems()
toolbarCtrl.setTemplateListProvider(asyncProvider)
toolbarCtrl.setTemplateLoader(asyncLoader)
toolbarCtrl.openSaveDialog('默认模版名')
toolbarCtrl.closeSaveDialog()
toolbarCtrl.getSaveDialogElement()
toolbarCtrl.triggerSave() // 正常流程：弹出名称输入框
toolbarCtrl.triggerSave({ skipPrompt: true, name: '快速保存模版' }) // 直接保存

toolbarCtrl.setDialogHandler('templateOpen', (ctx) => false)
toolbarCtrl.setBusinessDialogOpenHandler((ctx) => false)
toolbarCtrl.setTemplateDialogOpenHandler((ctx) => false)
toolbarCtrl.setSaveDialogOpenHandler((ctx) => false)

toolbarCtrl.setButtonVisible('print', false)
toolbarCtrl.setButtonText('businessSelect', '订单业务')
toolbarCtrl.setButtonDisabled('save', true)
toolbarCtrl.triggerButton('preview')
```

内置按钮 key（常用）：

- `businessSelect`、`templateSelect`、`preview`、`clear`、`print`、`save`、`rotate`
- `scale:zoomOut`、`scale:zoomIn`
- `align:left`、`align:horizontalCenter`、`align:right`、`align:top`、`align:verticalCenter`、`align:bottom`、`align:distributeHorizontal`、`align:distributeVertical`
- `paper:A3` / `paper:A4` / ...、`paper:custom`

对话框钩子说明：

1. `setDialogHandler('businessOpen' | 'businessClose' | 'templateOpen' | 'templateClose' | 'saveOpen' | 'saveClose' | 'templateDeleteConfirm', handler)`
2. `handler(ctx)` 中可使用 `ctx.openDefault()` / `ctx.closeDefault()` / `ctx.confirmDefault()` 调回内置逻辑
3. `handler` 返回 `false` 或 `true` 均会阻止内置对话框流程，适合完全改为业务侧组件弹窗

### 5.4.3 清空按钮弹窗（组件化示例）

推荐做法：清空按钮统一走 `toolbarOptions.onClear`，在回调内调用项目 UI 组件弹窗。

Ant Design Vue（Vue2）示例：

```js
hiprint.buildToolbar('#hiprintToolbar', hiprintTemplate, {
  onClear: (template) => {
    this.$confirm({
      title: '是否确认清空?',
      content: '清空后将无法恢复，是否继续?',
      okText: '确定',
      cancelText: '取消',
      centered: true,
      getContainer: () => document.querySelector('#hiprintDesigner') || document.body,
      onOk: () => {
        template.clear()
      }
    })
  }
})
```

Element Plus（Vue3）示例：

```ts
import { ElMessageBox } from 'element-plus'

hiprint.buildToolbar('#hiprintToolbar', hiprintTemplate, {
  onClear: async (template) => {
    await ElMessageBox.confirm('清空后将无法恢复，是否继续?', '是否确认清空?', {
      type: 'warning',
      confirmButtonText: '确定',
      cancelButtonText: '取消'
    })
    template.clear()
  }
})
```

说明：若未传 `onClear`，核心会退回原生 `confirm`。该行为仅建议用于开发调试，不建议用于正式业务界面。

### 5.4.4 打印按钮调用（推荐接管）

推荐做法：打印按钮统一走 `toolbarOptions.onPrint`，由业务层决定打印数据来源和打印方式。

```js
hiprint.buildToolbar('#hiprintToolbar', hiprintTemplate, {
  onPrint: (template) => {
    const printData = {
      orderNo: 'SO20260302001',
      customerName: '测试客户'
    }
    // 浏览器打印预览
    template.print(printData, {
      callback: () => console.log('打印完成')
    })
  }
})
```

如需静默打印（客户端模式）：

```js
hiprint.buildToolbar('#hiprintToolbar', hiprintTemplate, {
  onPrint: (template) => {
    const printData = { orderNo: 'SO20260302001' }
    template.print2(printData, {
      printer: 'Microsoft Print to PDF',
      title: '订单打印'
    })
  }
})
```

说明：若未传 `onPrint`，点击工具栏“打印”按钮不会执行任何默认打印逻辑。

### 5.4.5 壳层打印模式开关（browser/client）

当前仓库内置壳层（`src/standalone/designer-shell.vue`）已暴露打印策略开关，便于按数据库配置动态切换“浏览器打印 / 客户端静默打印”。

可用控制接口（`window.__hiprintDesignerControls`）：

| 方法 | 说明 |
|------|------|
| `setPrintMode('browser' \| 'client')` | 设置打印模式，默认 `browser` |
| `getPrintMode()` | 获取当前打印模式 |
| `setClientPrintOptions(options)` | 设置客户端打印参数（`printer/title/copies/...`） |
| `getClientPrintOptions()` | 获取当前客户端打印参数 |
| `setPrintData(data)` | 设置打印数据 |
| `print(options?)` | 立即打印。`browser` 模式走 `template.print`；`client` 模式走 `template.print2` |
| `setPrintConfig({ mode, clientOptions, printData })` | 一次性更新打印配置 |

示例（从后端读取配置后切换）：

```js
const controls = window.__hiprintDesignerControls

// 假设后端返回:
// { mode: 'client', clientOptions: { printer: 'Zebra-01', title: '订单打印' } }
controls.setPrintConfig(serverPrintConfig)

// 用户点击业务按钮时触发打印
controls.print()
```

说明：

1. `client` 模式下若未连接打印客户端，会自动回退到浏览器打印并提示。
2. `print(options)` 在 `browser` 模式下会透传到 `template.print(data, options)`。
3. 你可以把 `mode` 存在模板表或系统配置表里，实现按租户/场景切换。

自定义纸张类型：

```js
hiprint.buildToolbar('#toolbar', template, {
  paperTypes: {
    'A4': { width: 210, height: 296.6 },
    'A5': { width: 210, height: 147.6 },
    '热敏80mm': { width: 80, height: 120 },
    '快递面单': { width: 100, height: 180 }
  },
  defaultPaper: 'A4'
})
```

### 5.5 一键构建完整设计器（推荐）

`buildDesigner` 将工具栏、左侧组件面板、中间设计区域、右侧属性面板整合为一个完整的三栏布局设计器，包含拖拽调整宽度和折叠/展开功能，不依赖任何 UI 框架。

当前仓库开发态启动也采用同一条链路（`hiprint.init -> hiprint.buildDesigner`），并且已移除对 `src/demo` 的依赖。
如需在其他项目复刻当前效果，直接复用此节配置即可。

```html
<div id="hiprintDesigner"></div>
```

```js
const designerCtrl = hiprint.buildDesigner('#hiprintDesigner', {
  // 三栏布局配置（均可选，以下为默认值）
  leftWidth: 200,        // 左侧组件栏初始宽度(px)
  rightWidth: 280,       // 右侧属性栏初始宽度(px)
  leftMinWidth: 140,     // 左侧最小宽度
  leftMaxWidth: 400,     // 左侧最大宽度
  rightMinWidth: 200,    // 右侧最小宽度
  rightMaxWidth: 500,    // 右侧最大宽度
  leftCollapsed: false,  // 左侧是否默认折叠
  rightCollapsed: false, // 右侧是否默认折叠

  // 组件面板模块名（对应 init 中注册的 provider）
  componentModule: 'defaultModule',

  // 组件面板动态插槽（插入到“辅助”分组后）
  componentPanelSlot: {
    enabled: true,
    moduleName: 'orderModule',   // 作为插槽数据源的模块
    anchorGroupName: '辅助',      // 锚点分组名，默认“辅助”
    groupName: '动态字段',        // 插槽分组标题
    emptyTip: '暂无动态字段'      // 无字段时的占位文案
  },

  // 模板配置（传给 new hiprint.PrintTemplate 的参数）
  templateOptions: {
    template: {},          // 模板 JSON（空对象为新建，传入已有 JSON 可恢复）
    dataMode: 1,
    history: true,
    onDataChanged: (type, json) => {
      console.log('模板变更:', type)
    }
  },

  // 工具栏配置（传给 buildToolbar 的参数）
  toolbarOptions: {
    onPreview: (template) => {
      // 自定义预览逻辑
    },
    onPrint: () => {
      // 自定义打印逻辑
    },
    onScaleChange: (val) => {
      console.log('缩放:', val)
    }
  },

  // 设计器就绪回调
  onReady: (template, toolbarCtrl) => {
    // template: PrintTemplate 实例
    // toolbarCtrl: buildToolbar 返回的控制对象
    console.log('设计器已就绪')
  }
})

// 返回的控制对象
designerCtrl.getTemplate()              // 获取 PrintTemplate 实例
designerCtrl.getToolbarCtrl()           // 获取工具栏控制对象
designerCtrl.getLeftWidth()             // 获取左侧当前宽度
designerCtrl.getRightWidth()            // 获取右侧当前宽度
designerCtrl.setLeftCollapsed(true)     // 折叠/展开左侧
designerCtrl.setRightCollapsed(true)    // 折叠/展开右侧
designerCtrl.isLeftCollapsed()          // 左侧是否折叠
designerCtrl.isRightCollapsed()         // 右侧是否折叠
designerCtrl.setComponentPanelSlot(slotOptions)    // 运行时设置插槽
designerCtrl.clearComponentPanelSlot()             // 清空插槽
designerCtrl.rebuildComponentPanel('orderModule', slotOptions)  // 重建组件面板（可同时更新插槽）
designerCtrl.destroy()                  // 销毁设计器
```

左侧组件面板已改为自适应网格布局（`auto-fill + minmax`）。当左侧面板宽度被拖拽改变时，组件卡片会自动换行，不再固定 3 列。

完整示例（从后端加载模板 + 动态字段）：

```js
import { hiprint, defaultElementTypeProvider } from 'vue-plugin-hiprint'

// 1. 初始化
hiprint.init({
  providers: [new defaultElementTypeProvider()],
  lang: 'cn'
})

// 2. 注册动态字段
hiprint.setDynamicFields('orderModule', [
  {
    groupName: '订单信息',
    fields: [
      { field: 'orderNo', title: '订单编号' },
      { field: 'customerName', title: '客户名称' }
    ]
  }
])

// 3. 从后端加载已保存的模板
const savedTemplate = await fetch('/api/template/123').then(r => r.json())

// 4. 一键构建设计器
const designer = hiprint.buildDesigner('#designer', {
  componentModule: 'orderModule',
  templateOptions: {
    template: savedTemplate,
    history: true
  },
  toolbarOptions: {
    onPreview: (tpl) => { /* 预览 */ },
    onPrint: () => { /* 打印 */ }
  },
  onReady: (template) => {
    // 保存模板
    document.getElementById('saveBtn').onclick = () => {
      const json = template.getJson()
      fetch('/api/template/123', {
        method: 'PUT',
        body: JSON.stringify(json)
      })
    }
  }
})
```

### 5.6 获取/加载模板 JSON

```js
// 获取当前模板 JSON（可存入数据库）
const templateJson = hiprintTemplate.getJson()

// 新建空白模板
const template = new hiprint.PrintTemplate({
  template: {},
  settingContainer: '#PrintElementOptionSetting'
})
template.design('#hiprint-printTemplate')

// 从已保存的 JSON 恢复模板（如从数据库读取）
const savedJson = await fetch('/api/template/123').then(r => r.json())
const template = new hiprint.PrintTemplate({
  template: savedJson,
  settingContainer: '#PrintElementOptionSetting'
})
template.design('#hiprint-printTemplate')
```

模板 JSON 结构示例：

```json
{
  "panels": [
    {
      "index": 0,
      "height": 297,
      "width": 210,
      "paperHeader": 49.5,
      "paperFooter": 780,
      "guideLines": [
        { "id": "guide_h_0_1", "type": "h", "pos": 120.5 },
        { "id": "guide_v_0_2", "type": "v", "pos": 58 }
      ],
      "printElements": [
        {
          "options": {
            "left": 175.5,
            "top": 10.5,
            "height": 27,
            "width": 259,
            "title": "标题文本",
            "fontSize": 19,
            "fontWeight": "600",
            "textAlign": "center",
            "lineHeight": 26,
            "fontFamily": "微软雅黑",
            "color": "#333",
            "coordinateSync": true,
            "widthHeightSync": true
          },
          "printElementType": {
            "title": "自定义文本",
            "type": "text"
          }
        },
        {
          "options": {
            "left": 60,
            "top": 61.5,
            "height": 48,
            "width": 87,
            "src": "https://example.com/logo.png",
            "fit": "contain"
          },
          "printElementType": {
            "title": "图片",
            "type": "image"
          }
        }
      ]
    }
  ]
}
```

每个元素的 `options` 中包含完整的位置（`left`、`top`）、尺寸（`width`、`height`）和样式信息（字体、颜色、对齐等）。`guideLines` 用于保存设计态参考线（横线/竖线）。`getJson()` 导出的数据与设计时一致，重新加载后组件与参考线都会还原。

### 5.7 打印预览（调起浏览器打印）

```js
const printData = {
  name: '张三',
  orderNo: '2024010100001',
  items: [
    { productName: '商品A', qty: 2, price: 100 },
    { productName: '商品B', qty: 1, price: 200 }
  ]
}

hiprintTemplate.print(printData, { callback: () => console.log('打印完成') })
```

---

## 6. 动态字段 API（新功能）

此功能允许外部项目通过 API 传入字段定义，插件自动在组件面板中生成对应的可拖拽元素。典型场景：后端 API 返回业务字段列表（如 asin、fnsku、image 等），前端动态生成打印组件。

### 6.1 hiprint.setDynamicFields(moduleName, fieldGroups)

注册动态字段到组件面板。

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| moduleName | string | 模块名称，唯一标识这组动态字段 |
| fieldGroups | FieldGroup[] | 字段分组数组 |

**FieldGroup 结构：**

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| groupName | string | 是 | 分组名称，显示在面板中 |
| fields | FieldDefinition[] | 是 | 该分组下的字段列表 |

**FieldDefinition 结构：**

| 属性 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| field | string | 是 | - | 字段标识，用于数据绑定（如 `orderNo`） |
| title | string | 否 | field 的值 | 显示名称（如 `订单编号`） |
| type | string | 否 | `'text'` | 元素类型，见下方支持列表 |
| data | any | 否 | `''` | 默认数据/占位内容 |
| icon | string | 否 | - | 图标 CSS 类名 |
| options | object | 否 | - | 元素配置项（如 fontSize、fontWeight、columns 等） |

**支持的 type 类型：**

`text`、`image`、`longText`、`table`、`barcode`、`qrcode`、`hline`、`vline`、`rect`、`oval`、`html`

### 6.2 hiprint.removeDynamicFields(moduleName)

移除指定模块的动态字段。

```js
hiprint.removeDynamicFields('orderModule')
```

### 6.3 完整示例

```js
import { hiprint, defaultElementTypeProvider } from 'vue-plugin-hiprint'

// 1. 初始化（可选，如果需要默认组件）
hiprint.init({
  providers: [new defaultElementTypeProvider()],
  lang: 'cn'
})

// 2. 注册动态字段 —— 假设这些数据来自后端 API
const apiFields = {
  groups: [
    {
      groupName: '订单信息',
      fields: [
        { field: 'orderNo', title: '订单编号' },
        { field: 'orderDate', title: '下单日期' },
        { field: 'customerName', title: '客户名称' },
        { field: 'totalAmount', title: '总金额', options: { fontSize: 14, fontWeight: 'bold' } }
      ]
    },
    {
      groupName: '商品信息',
      fields: [
        { field: 'asin', title: 'ASIN' },
        { field: 'fnsku', title: 'FNSKU' },
        { field: 'productImage', title: '商品图片', type: 'image' },
        { field: 'productBarcode', title: '商品条码', type: 'barcode' },
        { field: 'productQrcode', title: '二维码', type: 'qrcode' }
      ]
    },
    {
      groupName: '商品明细表',
      fields: [
        {
          field: 'items',
          title: '商品明细',
          type: 'table',
          options: {
            columns: [[
              { title: '商品名', field: 'productName', width: 150 },
              { title: '数量', field: 'qty', width: 80 },
              { title: '单价', field: 'price', width: 80 },
              { title: '小计', field: 'subtotal', width: 80 }
            ]]
          }
        }
      ]
    }
  ]
}

hiprint.setDynamicFields('orderModule', apiFields.groups)

// 3. 渲染组件面板
$('#defaultPanel').empty()
$('#dynamicPanel').empty()
hiprint.PrintElementTypeManager.build('#defaultPanel', 'defaultModule')   // 默认组件
hiprint.PrintElementTypeManager.build('#dynamicPanel', 'orderModule')     // 动态字段组件

// 4. 创建设计器
const hiprintTemplate = new hiprint.PrintTemplate({
  template: {},
  settingContainer: '#PrintElementOptionSetting'
})
hiprintTemplate.design('#hiprint-printTemplate')

// 5. 打印时传入数据，field 会自动绑定
const printData = {
  orderNo: 'ORD-2025-001',
  orderDate: '2025-03-01',
  customerName: '张三',
  totalAmount: '¥1,280.00',
  asin: 'B0XXXXXXXXX',
  fnsku: 'X00XXXXXXX',
  productImage: 'https://example.com/product.jpg',
  productBarcode: '6901234567890',
  productQrcode: 'https://example.com/product/001',
  items: [
    { productName: '商品A', qty: 2, price: 100, subtotal: 200 },
    { productName: '商品B', qty: 3, price: 360, subtotal: 1080 }
  ]
}

hiprintTemplate.print(printData)
```

### 6.4 运行时动态更新

```js
// 业务场景变化时，重新设置字段
hiprint.setDynamicFields('orderModule', newFieldGroups)

// 重新渲染面板
$('#dynamicPanel').empty()
hiprint.PrintElementTypeManager.build('#dynamicPanel', 'orderModule')
```

### 6.5 多模块共存

```js
// 不同业务模块各自注册，互不影响
hiprint.setDynamicFields('orderModule', orderFieldGroups)
hiprint.setDynamicFields('warehouseModule', warehouseFieldGroups)

// 各自渲染到不同容器
hiprint.PrintElementTypeManager.build('#orderPanel', 'orderModule')
hiprint.PrintElementTypeManager.build('#warehousePanel', 'warehouseModule')

// 移除某个模块不影响其他模块
hiprint.removeDynamicFields('warehouseModule')
```

### 6.6 与后端 API 集成示例

```js
// 从后端获取字段配置
async function loadPrintFields() {
  const res = await fetch('/api/print/fields')
  const data = await res.json()

  // data 格式示例：
  // [
  //   {
  //     groupName: "基础信息",
  //     fields: [
  //       { field: "asin", title: "ASIN" },
  //       { field: "fnsku", title: "FNSKU" },
  //       { field: "image", title: "商品图片", type: "image" }
  //     ]
  //   }
  // ]

  hiprint.setDynamicFields('bizModule', data)
  $('#bizPanel').empty()
  hiprint.PrintElementTypeManager.build('#bizPanel', 'bizModule')
}
```

### 6.7 左侧动态插槽（辅助分组后）

当你希望“内置组件 + 动态业务字段”在同一组件面板中展示时，可启用组件面板插槽。插槽会插入到锚点分组（默认 `辅助`）后方。

```js
const designerCtrl = hiprint.buildDesigner('#designer', {
  componentModule: 'defaultModule',
  componentPanelSlot: {
    enabled: true,
    moduleName: 'orderModule',
    anchorGroupName: '辅助',
    groupName: '订单字段',
    emptyTip: '当前业务暂无字段'
  }
})

// 业务切换时动态刷新插槽数据源
hiprint.setDynamicFields('warehouseModule', warehouseFieldGroups)
designerCtrl.rebuildComponentPanel('defaultModule', {
  enabled: true,
  moduleName: 'warehouseModule',
  anchorGroupName: '辅助',
  groupName: '出库字段'
})
```

### 6.8 内置组件扩展接口（支持改名/新增/后端驱动）

除了 `setDynamicFields` 外，还可使用更底层的组件分组接口。适合从数据库下发“内置组件配置”并动态扩展左侧面板。

#### 6.8.1 hiprint.setElementTypeGroups(moduleName, groups)

覆盖指定模块的全部组件分组（先清空再设置）。

```js
hiprint.setElementTypeGroups('builtinExt', [
  {
    groupName: '业务组件',
    items: [
      { tid: 'builtinExt.orderNo', title: '订单号', type: 'text', field: 'orderNo' },
      { tid: 'builtinExt.logo', title: '品牌Logo', type: 'image', field: 'logo' }
    ]
  }
])
```

#### 6.8.2 hiprint.appendElementTypeGroups(moduleName, groups)

向指定模块追加组件分组（不清空原有分组）。

```js
hiprint.appendElementTypeGroups('builtinExt', [
  {
    groupName: '扩展组件',
    items: [
      { title: '仓库条码', type: 'barcode', field: 'warehouseCode' }
    ]
  }
])
```

#### 6.8.3 hiprint.renameElementType(tid, title)

重命名任意组件（内置/动态均可），用于不同业务场景下展示不同名称。

```js
hiprint.renameElementType('defaultModule.text', '普通文本')
hiprint.renameElementType('builtinExt.orderNo', '销售单号')
```

> `groups` 结构兼容 `groupName/name + printElementTypes/items/fields`，当 `tid` 缺失时会自动生成。

---

## 7. 设计态标尺与 PS 式参考线

新版设计器中的标尺由代码按当前纸张尺寸实时生成，不再依赖静态 SVG（如 `l_img.svg` / `v_img.svg`），因此在 A3/A4/自定义纸张切换时可保持精确长度。

### 7.1 交互行为

1. 从顶部标尺拖出横向参考线（`h`）。
2. 从左侧标尺拖出纵向参考线（`v`）。
3. 直接拖动已有参考线可调整位置。
4. 双击参考线可删除。
5. 将参考线拖出纸张范围也会删除。

### 7.2 模板持久化

参考线会自动写入模板 JSON 的 `panels[].guideLines`，并在 `template.design(...)` 时自动恢复：

```json
{
  "panels": [
    {
      "guideLines": [
        { "id": "guide_h_0_1", "type": "h", "pos": 120.5 },
        { "id": "guide_v_0_2", "type": "v", "pos": 58 }
      ]
    }
  ]
}
```

### 7.3 纸张尺寸变化时自动重建

当纸张大小改变（例如切换到 A3 或自定义尺寸）时，设计器会：

1. 按新宽高重新生成横/竖标尺刻度。
2. 自动重建标尺 DOM。
3. 将参考线位置归一化到新纸张范围内（越界参考线会被裁剪/移除）。

---

## 8. 静默打印（需配合 electron-hiprint 客户端）

```js
import { hiprint, autoConnect } from 'vue-plugin-hiprint'

// 连接打印客户端
autoConnect((connected) => {
  if (connected) {
    console.log('打印客户端已连接')
  }
})

// 或手动指定地址
hiprint.init({
  host: 'http://localhost:17521',
  token: 'your-token'
})

// 静默打印
hiprintTemplate.print2(printData, {
  printer: 'Microsoft Print to PDF',
  title: '订单打印'
})

hiprintTemplate.on('printSuccess', () => console.log('打印成功'))
hiprintTemplate.on('printError', (err) => console.error('打印失败', err))
```

---

## 9. 常用 API 速查

| API | 说明 |
|-----|------|
| `hiprint.init(options)` | 初始化插件，注册 Provider、设置语言等 |
| `hiprint.setConfig(config)` | 自定义配置（隐藏/显示属性面板选项等） |
| `hiprint.buildToolbar(container, template, options)` | 构建核心工具栏（纸张/缩放/对齐/预览/打印） |
| `toolbarCtrl.getToolbarElement()` | 获取工具栏 jQuery 对象（用于高级自定义） |
| `toolbarCtrl.openBusinessDialog()` | 打开业务选择弹窗 |
| `toolbarCtrl.getBusinessDialogElement()` | 获取业务弹窗 jQuery 对象 |
| `toolbarCtrl.refreshBusinessList()` | 刷新业务卡片列表 |
| `toolbarCtrl.setBusinessItems(list)` | 设置业务卡片列表（无远程请求） |
| `toolbarCtrl.setBusinessListProvider(fn)` | 设置业务列表提供器 |
| `toolbarCtrl.setBusinessLoader(fn)` | 设置业务详情加载器 |
| `toolbarCtrl.openTemplateDialog()` | 打开模版选择弹窗 |
| `toolbarCtrl.getTemplateDialogElement()` | 获取模版弹窗 jQuery 对象 |
| `toolbarCtrl.refreshTemplateList()` | 刷新模版卡片列表 |
| `toolbarCtrl.openSaveDialog(defaultName)` | 打开“保存模版”名称输入弹窗 |
| `toolbarCtrl.getSaveDialogElement()` | 获取保存弹窗 jQuery 对象 |
| `toolbarCtrl.triggerSave()` | 触发保存动作 |
| `toolbarCtrl.setDialogHandler(name, handler)` | 设置内置对话框钩子（可替换为业务弹窗） |
| `toolbarCtrl.setButtonVisible(key, visible)` | 控制内置按钮显隐 |
| `toolbarCtrl.setButtonText(key, text, useHtml?)` | 修改内置按钮文案/HTML |
| `toolbarCtrl.setButtonDisabled(key, disabled)` | 控制内置按钮禁用 |
| `toolbarCtrl.triggerButton(key)` | 触发内置按钮点击 |
| `hiprint.buildDesigner(container, options)` | 一键构建完整设计器（工具栏+三栏布局+拖拽+折叠+组件插槽） |
| `hiprint.setDynamicFields(moduleName, fieldGroups)` | 注册动态字段 |
| `hiprint.removeDynamicFields(moduleName)` | 移除动态字段 |
| `hiprint.setElementTypeGroups(moduleName, groups)` | 覆盖设置组件分组 |
| `hiprint.appendElementTypeGroups(moduleName, groups)` | 追加组件分组 |
| `hiprint.renameElementType(tid, title)` | 重命名组件显示名称 |
| `hiprint.PrintElementTypeManager.build(container, moduleName)` | 渲染拖拽组件到容器 |
| `hiprint.PrintElementTypeManager.setPanelSlot(options)` | 设置组件插槽（辅助分组后） |
| `hiprint.PrintElementTypeManager.clearPanelSlot()` | 清空组件插槽 |
| `new hiprint.PrintTemplate(options)` | 创建打印模板实例 |
| `template.design(container)` | 渲染设计器 |
| `template.getJson()` | 获取模板 JSON |
| `template.print(data, options)` | 浏览器打印预览 |
| `template.print2(data, options)` | 静默打印（需客户端） |
| `template.toPdf(data, filename)` | 导出 PDF |

---

## 10. 无损接入方案（整合版）

本章节由原 `docs/no-loss-integration-plan.md` 合并而来，作为唯一维护版本。

### 10.1 目标与原则

目标：将当前 `vue-plugin-hiprint-main` 的设计器能力完整接入到其他前端项目，保证“启动后现有每个功能都可用”，并对接你们现有模板 API。

原则：

1. 功能不删减：先做到 1:1 保留，再做样式或结构重构。
2. 接口适配不侵入核心：通过适配层对接后端，不在核心逻辑里写死业务接口。
3. 可回滚：接入失败时可一键退回“本地 JSON 保存/读取”模式。
4. 可验证：每个阶段都有明确验收清单和回归用例。

### 10.2 接入模式（推荐）

推荐模式：源码内置 + 适配层（无损、可控、迭代成本低）

1. 将本项目核心源码内置到目标项目，例如 `src/libs/print-template/`。
2. 保留当前设计器初始化链路：`hiprint.init -> buildDesigner -> toolbarOptions/templateOptions`。
3. 新增业务适配层：专门处理模板 CRUD、复制、分类等后端接口。
4. UI 可先保持当前行为，后续再按设计系统做皮肤替换。

不推荐第一步就重写组件（风险高，容易丢边角功能）。

### 10.3 功能保留范围（必须全保留）

以下能力必须保持可用：

1. 三栏布局设计器：左中右拖拽宽度、折叠/展开。
2. 左侧组件面板：自适应换行、动态插槽、内置组件扩展/改名。
3. 画布：缩放、旋转、对齐、拖拽编辑、页眉页脚线。
4. 标尺与参考线：拖出、移动、双击删除、越界删除、模板持久化。
5. 工具栏：业务选择、选择模版、纸张、自定义纸张、缩放、旋转、对齐、预览、清空、打印、保存。
6. 模版弹窗：卡片列表、选择、预览、编辑、删除。
7. 保存弹窗：输入模板名称后保存。
8. 模板 JSON 导入导出：`getJson()/update()` 链路。
9. 动态字段：后端驱动字段分组渲染。

### 10.4 后端 API 映射（按你们接口）

你们已定义接口如下：

1. 新增模板：`POST /api/print-template/add`
2. 更新模板：`PUT /api/print-template/{templateId}`
3. 删除模板：`DELETE /api/print-template/{templateId}`
4. 编辑模板：`GET /api/print-template/{templateId}` + `PUT /api/print-template/{templateId}`
5. 获取模板：`GET /api/print-template/{templateId}`
6. 保存模板：新建 `POST /add`，已有 `PUT /{templateId}`
7. 模板列表：`GET /api/print-template/list`
8. 模板详情：`GET /api/print-template/{templateId}`
9. 复制模板：`POST /api/print-template/copy/{templateId}`
10. 分类列表：`GET /api/print-template/categories`

与当前工具栏扩展点的映射关系：

| 工具栏扩展点 | 对应后端接口 | 用途 |
|---|---|---|
| `businessListProvider` | `GET /api/print-business/list` | 业务卡片列表（字段配置入口） |
| `businessLoader(item)` | `GET /api/print-business/{businessId}` | 选择业务时加载字段/打印配置 |
| `onBusinessSelect(item, data)` | 业务接口返回详情对象 | 应用动态字段、默认模板、打印策略 |
| `templateListProvider` | `GET /api/print-template/list` | 模版卡片列表 |
| `templateLoader(item)` | `GET /api/print-template/{templateId}` | 选择模版时加载 JSON |
| `onTemplateDelete(item)` | `DELETE /api/print-template/{templateId}` | 删除模版 |
| `onSave(template, json, ..., ctx)` | `POST /add` or `PUT /{templateId}` | 保存模版（`ctx.name` 为输入名称） |
| `onTemplatePreview(item)` | `GET /api/print-template/{templateId}` | 预览前取详情（可选） |
| `onTemplateEdit(item)` | `GET + PUT /{templateId}` | 编辑流程入口（可跳转编辑页） |

建议把 `copy/categories` 接口放在业务适配层中，供弹窗扩展按钮调用。

### 10.5 前端数据结构约定

建议在前端统一两类对象，避免组件直接依赖后端原始结构。

#### 10.5.1 模版列表项（TemplateListItem）

```ts
type TemplateListItem = {
  id: string | number
  name: string
  description?: string
  categoryId?: string | number
  categoryName?: string
  updatedAt?: string
  creatorName?: string
}
```

#### 10.5.2 模版详情（TemplateDetail）

```ts
type TemplateDetail = {
  id: string | number
  name: string
  templateJson: object | string
  categoryId?: string | number
}
```

### 10.6 适配层设计（建议单独模块）

文件建议：`src/services/printTemplateService.ts`

```ts
import request from '@/utils/request'

export async function listTemplates(params?: Record<string, any>) {
  return request.get('/api/print-template/list', { params })
}

export async function getTemplateDetail(templateId: string | number) {
  return request.get(`/api/print-template/${templateId}`)
}

export async function addTemplate(payload: { name: string; templateJson: any; categoryId?: any }) {
  return request.post('/api/print-template/add', payload)
}

export async function updateTemplate(templateId: string | number, payload: { name?: string; templateJson: any; categoryId?: any }) {
  return request.put(`/api/print-template/${templateId}`, payload)
}

export async function deleteTemplate(templateId: string | number) {
  return request.delete(`/api/print-template/${templateId}`)
}

export async function copyTemplate(templateId: string | number) {
  return request.post(`/api/print-template/copy/${templateId}`)
}

export async function listTemplateCategories() {
  return request.get('/api/print-template/categories')
}
```

### 10.7 设计器接入示例（无损版）

核心思路：把后端逻辑全放在 `toolbarOptions` 回调里。

```js
const state = {
  currentTemplateId: null
}

const designerCtrl = hiprint.buildDesigner('#designer', {
  componentModule: 'defaultModule',
  templateOptions: {
    template: {}, // 初始空模板
    history: true
  },
  toolbarOptions: {
    showTemplateSelect: true,
    showSave: true,

    templateListProvider: async () => {
      const res = await listTemplates()
      return (res.data || []).map(row => ({
        id: row.templateId,
        name: row.templateName,
        description: row.description,
        updatedAt: row.updateTime
      }))
    },

    templateLoader: async (item) => {
      const detail = await getTemplateDetail(item.id)
      state.currentTemplateId = item.id
      return detail.data.templateJson
    },

    onTemplateDelete: async (item) => {
      await deleteTemplate(item.id)
      return true
    },

    onSave: async (template, json, _event, _api, ctx) => {
      const payload = {
        name: ctx.name,
        templateJson: json
      }
      if (state.currentTemplateId) {
        await updateTemplate(state.currentTemplateId, payload)
      } else {
        const created = await addTemplate(payload)
        state.currentTemplateId = created.data?.templateId || null
      }
    }
  }
})
```

### 10.8 分阶段实施计划（可执行）

#### 阶段 A：基线冻结

1. 固定当前版本代码并打 tag。
2. 录制全功能操作视频（作为回归基线）。
3. 导出一份“标准模板 JSON”用于比对。

#### 阶段 B：接入主站

1. 将设计器页面挂到主站路由。
2. 保留原有功能开关与交互，不做功能删减。
3. 接入后端 API 适配层。

#### 阶段 C：联调与验收

1. 模版列表/详情/新增/更新/删除全链路联调。
2. 验证保存时名称输入框及 `ctx.name` 流转。
3. 验证选中模版后 JSON 完整恢复（含 guideLines）。

#### 阶段 D：增强（可选）

1. 接入模板分类筛选。
2. 接入复制模板按钮。
3. 接入权限控制（可见、可编辑、可删除）。

### 10.9 无损验收清单（上线门禁）

1. 选择模版弹窗可正常显示、刷新、选择、删除。
2. 保存按钮必须弹“模板名输入框”。
3. 新建模板时走 `POST /add`，已有模板走 `PUT /{id}`。
4. 模板切换后画布完整恢复（位置、样式、参考线）。
5. 页眉/页脚复选状态不会自动误勾选。
6. A3/A4/自定义纸张切换时标尺长度正确。
7. 左侧组件面板自适应换行和插槽仍可用。
8. 打印、预览、清空、对齐、缩放功能正常。
9. 组件拖拽与右侧属性联动正常。
10. `npm run build-demo` 或目标项目构建通过。

### 10.10 回滚策略

1. 保留“本地 JSON 下载保存”兜底：不传 `onSave` 时可直接回退。
2. API 异常时弹错误提示但不清空画布状态。
3. 通过开关关闭模板远程能力：
   - `showTemplateSelect: false`
   - `showSave: false` 或不传 `onSave`
4. 保留上一稳定版本构建产物，支持快速回滚部署。

### 10.11 交付物清单

1. 核心源码（含 toolbar 模版弹窗与保存弹窗能力）。
2. 业务适配层 `printTemplateService`。
3. 页面级接入代码（`buildDesigner` 初始化与回调）。
4. 回归测试清单与录屏基线。
5. 本文档（无损接入方案）。

### 10.12 第三方项目接入时如何确保布局不变（关键）

当前三栏设计器布局已按“顶层不滚动、仅内部滚动”优化。第三方项目接入时请保持以下约束，避免出现顶层父级滚动条。

#### 10.12.1 根容器高度链路（必须）

```css
html,
body,
#app {
  height: 100%;
}

body {
  margin: 0;
  overflow: hidden;
}
```

#### 10.12.2 设计器宿主容器契约（必须）

```css
#hiprintDesigner {
  position: relative;
  box-sizing: border-box;
  height: 100%;
  overflow: hidden;
  padding: 8px; /* 需要保留时必须配合 box-sizing */
}

#hiprintDesigner .hiprint-designer {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

#hiprintDesigner .hiprint-designer-layout {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

#hiprintDesigner .hiprint-designer-panel-center {
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  overflow: hidden;
}
```

#### 10.12.3 反例（不要这样做）

1. 不要在设计区外层再叠加 `100vh + padding/margin`。
2. 不要在 `html/body/#app` 保留默认 margin。
3. 不要把 `.hiprint-designer-layout` 固定为 `height: calc(100vh - x)`。
4. 不要把页面级滚动和设计器内部滚动同时开启。

#### 10.12.4 路由页有顶部导航时的写法

如果第三方页面有固定头部，请让“头部 + 设计器”使用列布局，设计器容器吃掉剩余空间：

```css
.page {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.page-header {
  flex: 0 0 auto;
}

.page-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
```

把 `#hiprintDesigner` 放入 `.page-content` 内即可。

#### 10.12.5 布局验收清单

1. 页面最外层（浏览器窗口）无垂直滚动条。
2. 画布缩放后，仅中间画布区域出现滚动条。
3. 左侧组件栏与右侧属性栏滚动互不影响主页面。
4. 切换 A3/A4/自定义纸张后，外层仍无滚动条抖动。

#### 10.12.6 样式接入清单（必须）

1. `npm/tgz` 模式：至少引入 `vue-plugin-hiprint/dist/print-lock.css`。
2. 源码内置模式：必须同时引入 `hiprint.css` + `print-lock.css`。
3. 如出现图标缺失，可按需引入 `bootstrap/dist/css/bootstrap.min.css`。
4. 不要在业务全局样式中覆盖 `.hiprint-*` 关键布局类（尤其 `display/height/overflow/flex`）。

---

## 11. Vue3 + Element Plus + TypeScript + Vite 完整接入

本章节用于“在另一个 Vue3 项目中完整复用当前设计器能力（含三栏布局、工具栏、标尺与参考线、模板中心、保存弹窗）”。

### 11.1 适用环境

1. `vue@3.x`
2. `vite@4.x/5.x`
3. `typescript@5.x`
4. `element-plus@2.x`
5. `node >= 18`（建议）

### 11.2 安装依赖

将打包产物（`.tgz`）放入目标项目后安装：

```bash
npm install ./vue-plugin-hiprint-0.0.61.tgz
npm install jquery
```

可选依赖：

```bash
# 若你希望保留旧版 glyphicon 图标表现（部分组件卡片会用到）
npm install bootstrap

# 对接后端 API 示例会使用 axios
npm install axios
```

### 11.3 main.ts（推荐写法）

```ts
import { createApp } from 'vue'
import App from './App.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

import $ from 'jquery'
;(window as any).$ = $
;(window as any).jQuery = $

import { hiPrintPlugin } from 'vue-plugin-hiprint'
import 'vue-plugin-hiprint/dist/print-lock.css'
// 可选：保留 glyphicons
// import 'bootstrap/dist/css/bootstrap.min.css'

const app = createApp(App)
app.use(ElementPlus)
app.use(hiPrintPlugin, '$hiPrint')
app.mount('#app')
```

### 11.4 TypeScript 类型声明（无官方 d.ts 时）

若项目出现 TS 报错 `Cannot find module 'vue-plugin-hiprint'`，新增声明文件：

`src/types/vue-plugin-hiprint.d.ts`

```ts
declare module 'vue-plugin-hiprint' {
  export const hiprint: any
  export const defaultElementTypeProvider: any
  export const hiPrintPlugin: any
  export const autoConnect: any
}
```

确保 `tsconfig.json` 包含 `src/types/**/*.d.ts`（默认通常已包含）。

### 11.5 页面布局骨架（防止顶层滚动条）

```vue
<template>
  <div class="page">
    <div class="page-header">
      <!-- 你的业务头部 -->
    </div>
    <div class="page-content">
      <div id="hiprintDesigner"></div>
    </div>
  </div>
</template>

<style scoped>
.page {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.page-header {
  flex: 0 0 auto;
}
.page-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
#hiprintDesigner {
  height: 100%;
  min-height: 0;
  overflow: hidden;
  position: relative;
  box-sizing: border-box;
  padding: 8px;
}
</style>
```

并确保全局：

```css
html,
body,
#app {
  height: 100%;
  margin: 0;
}
body {
  overflow: hidden;
}
```

### 11.6 设计器完整示例（Vue3 + TS）

`src/views/PrintTemplateDesigner.vue`

```vue
<template>
  <div class="page-content">
    <div id="hiprintDesigner"></div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { hiprint, defaultElementTypeProvider } from 'vue-plugin-hiprint'
import {
  listTemplates,
  getTemplateDetail,
  addTemplate,
  updateTemplate,
  deleteTemplate
} from '@/services/printTemplateService'

let designerCtrl: any = null
const state = reactive({
  currentTemplateId: null as number | string | null
})

onMounted(() => {
  hiprint.init({
    providers: [new defaultElementTypeProvider()],
    lang: 'cn'
  })

  designerCtrl = hiprint.buildDesigner('#hiprintDesigner', {
    componentModule: 'defaultModule',
    templateOptions: {
      template: {},
      history: true
    },
    toolbarOptions: {
      showTemplateSelect: true,
      showSave: true,
      templateListProvider: async () => {
        const res = await listTemplates()
        return (res.data || []).map((row: any) => ({
          id: row.templateId,
          name: row.templateName,
          description: row.description,
          updatedAt: row.updateTime
        }))
      },
      templateLoader: async (item: any) => {
        const detail = await getTemplateDetail(item.id)
        state.currentTemplateId = item.id
        return detail.data.templateJson
      },
      onTemplateDelete: async (item: any) => {
        await deleteTemplate(item.id)
        ElMessage.success('模板已删除')
        if (state.currentTemplateId === item.id) state.currentTemplateId = null
        return true
      },
      onSave: async (_template: any, json: any, _event: any, _api: any, ctx: any) => {
        const payload = {
          name: ctx.name,
          templateJson: json
        }
        if (state.currentTemplateId) {
          await updateTemplate(state.currentTemplateId, payload)
          ElMessage.success('模板已更新')
        } else {
          const created = await addTemplate(payload)
          state.currentTemplateId = created.data?.templateId || null
          ElMessage.success('模板已保存')
        }
      }
    }
  })
})

onBeforeUnmount(() => {
  designerCtrl?.destroy?.()
  designerCtrl = null
})
</script>

<style scoped>
.page-content {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
#hiprintDesigner {
  height: 100%;
  min-height: 0;
  overflow: hidden;
  position: relative;
  box-sizing: border-box;
  padding: 8px;
}
</style>
```

### 11.7 后端服务层（按你们接口）

`src/services/printTemplateService.ts`

```ts
import axios from 'axios'

export function listTemplates(params?: Record<string, any>) {
  return axios.get('/api/print-template/list', { params })
}

export function getTemplateDetail(templateId: string | number) {
  return axios.get(`/api/print-template/${templateId}`)
}

export function addTemplate(payload: { name: string; templateJson: any; categoryId?: any }) {
  return axios.post('/api/print-template/add', payload)
}

export function updateTemplate(
  templateId: string | number,
  payload: { name?: string; templateJson: any; categoryId?: any }
) {
  return axios.put(`/api/print-template/${templateId}`, payload)
}

export function deleteTemplate(templateId: string | number) {
  return axios.delete(`/api/print-template/${templateId}`)
}

export function copyTemplate(templateId: string | number) {
  return axios.post(`/api/print-template/copy/${templateId}`)
}

export function listTemplateCategories() {
  return axios.get('/api/print-template/categories')
}
```

### 11.8 Vite 配置建议（可选但推荐）

`vite.config.ts`

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  optimizeDeps: {
    include: ['jquery']
  }
})
```

### 11.9 Element Plus 共存说明

1. hiprint 核心工具栏和设计器 UI 是插件内部渲染，不依赖 Element Plus。
2. 业务层可在回调中使用 `ElMessage`、`ElMessageBox` 做通知和二次确认。
3. 不要直接覆盖 `.hiprint-*` 关键布局类（尤其 `.hiprint-designer-layout` 高度与 overflow 相关规则）。

### 11.10 常见问题排查

1. 页面白屏或报 `$ is not defined`：
   - 检查 `main.ts` 是否已把 jQuery 挂到 `window.$/window.jQuery`。
2. 顶层出现滚动条：
   - 检查 `html/body/#app` 是否 `height: 100%` 且 `body` 是否 `overflow: hidden`。
3. 左侧图标缺失：
   - 按需引入 `bootstrap/dist/css/bootstrap.min.css`（可选）。
4. TS 找不到模块类型：
   - 添加 `src/types/vue-plugin-hiprint.d.ts` 声明。
5. 模板保存后变成新建而不是更新：
   - 检查是否正确维护 `state.currentTemplateId`。

### 11.11 该技术栈上线验收

1. `npm run dev` 可正常启动，设计器渲染成功。
2. 模板列表、选择、删除、保存链路可用。
3. 保存弹窗可输入名称并透传到 `ctx.name`。
4. 从标尺拖出参考线、拖动/删除、刷新后恢复正常。
5. 切换 A3/A4/自定义纸张后，标尺长度与纸张一致。
6. 顶层无滚动条，仅设计器内部按区域滚动。

### 11.12 复刻当前项目一致界面与功能（关键）

如果你的目标是“在别的项目里保持和当前仓库启动后一致的界面与功能”，`integration-guide.md` 必须按本节执行。

#### 11.12.1 先明确边界：`src/demo` 不是运行时依赖

1. 历史版本存在 `src/demo/*`，用于演示页面与示例数据；当前主线已移除该目录。
2. 第三方项目不需要复制任何 `src/demo` 代码，只需要使用插件导出的 `hiprint` 能力。
3. 当前仓库默认空模板来自独立壳层初始化（`templateOptions.template = {}`），不是演示开关逻辑。

#### 11.12.2 想保持一致，必须对齐这 4 层

1. 初始化层：`hiprint.init({ providers, lang })` 与当前项目一致。
2. 设计器层：使用 `hiprint.buildDesigner(...)`，不要自行拼接三栏 DOM。
3. 工具栏层：对齐 `toolbarOptions`（业务选择、模板中心、保存、纸张、缩放、旋转、对齐、预览、清空、打印）。
4. 样式层：严格遵循 `10.12` 的布局约束（根高度链路 + 宿主容器契约）。

#### 11.12.3 建议使用的最小初始化（与当前项目一致）

```ts
hiprint.init({
  providers: [new defaultElementTypeProvider()],
  lang: 'cn'
})

hiprint.buildDesigner('#hiprintDesigner', {
  componentModule: 'defaultModule',
  templateOptions: {
    template: {},   // 新项目若需“默认空模板”就传 {}
    history: true
  },
  toolbarOptions: {
    showTemplateSelect: true,
    showSave: true
  }
})
```

#### 11.12.4 不一致最常见原因

1. 误把历史 demo 逻辑当插件运行时逻辑（当前主线已移除 `src/demo`）。
2. 自己写了工具栏/三栏布局，未走 `buildDesigner`。
3. 缺少 `print-lock.css` 或缺失 jQuery 全局挂载。
4. 根容器高度链路不完整导致滚动与定位行为变化。

#### 11.12.5 一致性验收（第三方项目）

1. 左中右三栏可拖拽宽度、可折叠。
2. 左侧组件卡片可随面板宽度自适应换行。
3. 工具栏含“业务选择、选择模版、保存”且行为一致。
4. 参考线支持拖出、移动、删除、模板持久化。
5. 切换纸张后标尺长度正确，且不依赖 svg。
6. 页面顶层无滚动条，内部分区滚动正常。
