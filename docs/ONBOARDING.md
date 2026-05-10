# Onboarding — vue-plugin-hiprint

> 新开发者上手指南。预计阅读时间 30 分钟。读完应该能：跑起来 dev server、改一处代码、跑 SMOKE 验证、生成 tgz。

---

## 1. 项目是什么 (3 分钟)

`vue-plugin-hiprint` 是一个 **可视化打印模板设计器**：

```
[业务方在 Vue 项目中]                     [vue-plugin-hiprint 提供]
+----------------------+                  +-----------------------+
|  <PrintDesigner />   | ←—— buildDesigner('#container', opts)
|  用户拖拽元素到画布     |    动态注入工具栏 + 元素面板 + 画布纸张
|  保存模板 JSON         |
|                      |
|  打印按钮             | ←—— hiprint.PrintTemplate(json).print(data)
|  填业务数据 → 输出 PDF |
+----------------------+                  +-----------------------+
```

**用户角色：** 模板设计员（在浏览器拖拽设计一次） + 业务运营（填数据点打印 N 次）。

**核心价值：** 解决"快递单/发票/二维码标签"等高度定制化打印场景。

**fork 状态：** 我们是上游 `CcSimple/vue-plugin-hiprint` 的独立维护版（detached），后续按本仓库自己的路线演进。

---

## 2. 技术栈速览 (5 分钟)

| 层 | 技术 | 文件 |
|---|---|---|
| 打印内核 | **jQuery 3.x**（无法替换，是 hiprint 上游 14905 行 bundle 的原生设计）| `src/hiprint/hiprint.bundle.js` |
| 元素类型 | JS 注册（text/barcode/qrcode/image/table/html/longText）| `src/hiprint/etypes/` + `plugins/` |
| 外壳/Demo | **Vue 3.4 + Composition API** | `src/standalone/*.vue` |
| 构建 | **Vite 5**（从 Vue 2 + Webpack 迁移完成）| `vite.config.js` |
| 测试 | **Playwright E2E** | `e2e/tests/*.spec.ts` |
| 分发 | `vue-plugin-hiprint.tgz` 固定文件名 | `scripts/rename-tgz.js` |

**关键依赖：**
- `jspdf 2.5` / `dom-to-image-more` / `canvg` — PDF 输出
- `bwip-js` / `jsbarcode` / `qrcode` — 条码二维码
- `socket.io-client` — 局域网打印
- `nzh` — 数字转中文大写（金额）
- `ant-design-vue 4` — 演示壳的 UI 组件

---

## 3. 第一次运行 (5 分钟)

### 3.1 装依赖 + 跑 dev server

```bash
git clone https://github.com/amDosion/vue-plugin-hiprint.git
cd vue-plugin-hiprint
npm install               # 不锁 lockfile（package-lock.json 已 .gitignore）
npm run dev               # Vite dev server，默认 http://localhost:5173
```

打开浏览器看到的页面是 `src/standalone/designer-shell.vue`：完整的设计器演示。

### 3.2 第一次构建 + pack tgz

```bash
npm run pack:fixed
# = vite build + npm pack + node scripts/rename-tgz.js
# 产出: vue-plugin-hiprint.tgz (~1.2 MB)
```

`pack:fixed` 关键作用：保证 tgz 文件名固定为 `vue-plugin-hiprint.tgz`（不带版本号），业务方 `package.json` 引用时不用每次升级版本字符串。

### 3.3 在业务方 Vue 项目中使用

```bash
# 业务方 (如 vue-admin-main)
npm install /path/to/vue-plugin-hiprint.tgz
```

```js
// main.js
import { hiPrintPlugin } from 'vue-plugin-hiprint'
import 'vue-plugin-hiprint/dist/vue-plugin-hiprint.css'
import 'vue-plugin-hiprint/dist/print-lock.css'   // 关键: 屏幕预览/打印一致

const app = createApp(App)
app.use(hiPrintPlugin)
```

详见 [docs/integration-guide.md](integration-guide.md)。

---

## 4. 仓库结构地图 (5 分钟)

```
vue-plugin-hiprint/
├── CLAUDE.md                       ← Claude Code 项目级规则入口
├── .claude/
│   ├── rules/                      ← 项目专属规则 (5 个)
│   ├── agents/                     ← 项目专属智能体 (3 个)
│   └── settings.json
│
├── src/
│   ├── index.js                    ← 公开 API (23 个 export) ★必读
│   ├── main.js                     ← Vue 3 入口 (dev server)
│   ├── App.vue
│   ├── _setup-jquery.js            ← window.jQuery / window.$ 桥接
│   │
│   ├── hiprint/
│   │   ├── hiprint.bundle.js       ← 14905 行内核 ★最重要
│   │   ├── hiprint.config.js       ← 默认配置 (paperSize 等)
│   │   ├── plugins/                ← 元素类型注册 + i18n + jQuery UI 补丁
│   │   ├── etypes/                 ← 业务级元素类型扩展
│   │   ├── examples/               ← 示例模板 (delivery-note/eight-loc 等)
│   │   ├── data/                   ← 默认数据 / 假数据
│   │   └── css/
│   │       ├── hiprint.css         ← 主样式
│   │       └── print-lock.css      ← paper:relative 等关键样式 ★
│   │
│   └── standalone/
│       └── designer-shell.vue      ← 模范集成示例 (业务方参考它写)
│
├── docs/                           ← ★所有项目知识沉淀于此
│   ├── ONBOARDING.md               ← 你现在在读
│   ├── CODE-BLUEPRINT.md           ← 14905 行 bundle 完整导航
│   ├── CODEMAPS/                   ← 模块级 codemap
│   ├── API-REFERENCE.md            ← 23 export 速查 + opts 字段表
│   ├── TOOLBAR-ARCHITECTURE.md     ← 工具栏 + slot + addGroup 架构
│   ├── integration-guide.md        ← 业务方完整集成
│   ├── build-designer-vue-integration.md ← 多实例污染历史
│   ├── SMOKE-TEST.md               ← 升级 tgz 后回归
│   └── adr/                        ← 架构决策记录
│
├── e2e/                            ← Playwright E2E 测试
│   ├── playwright.config.ts
│   └── tests/
│       ├── destroy.spec.ts
│       ├── xss.spec.ts
│       ├── nested-field.spec.ts
│       ├── dedup.spec.ts
│       ├── multi-instance.spec.ts
│       ├── a11y.spec.ts
│       └── toolbar-panel-manager.spec.ts
│
├── scripts/
│   ├── rename-tgz.js               ← 固定 tgz 文件名
│   └── analyze-panel-options.py    ← 分析 panel.opts 字段（一次性）
│
├── .github/workflows/
│   ├── e2e.yml                     ← Playwright CI
│   └── deploy-demo.yml             ← GitHub Pages 部署 demo
│
└── vite.config.js                  ← 构建配置 + alias + plugin
```

---

## 5. 核心概念 (10 分钟)

### 5.1 PrintTemplate (ct 类)

模板的 runtime 实例：

```js
const tpl = new hiprint.PrintTemplate({
  template: { panels: [/* 纸张 + 元素 */] },
  settingContainer: '#hiprintEpContainer',  // 元素属性面板挂载点
  paginationContainer: '#hiprint-printPagination',  // 分页栏 (可隐藏)
  history: true                              // 启用撤销/重做
})

tpl.design('#hiprintBgContainer')           // 渲染设计器到画布
tpl.print(data)                              // 用 data 触发打印
tpl.getJson()                                // 导出当前 JSON
tpl.destroy()                                // ★ 销毁,必须调
```

**关键不变式**（见 `.claude/rules/hiprint-bundle.md`）：
- `destroy()` 幂等
- 所有公开方法都有 `_destroyed` 守卫
- 销毁后清空 `printPanels` + 解绑事件 + 从全局 map 删除（identity check）

### 5.2 PrintPanel (pt 类)

模板里的一张"纸"。一个 PrintTemplate 可以有多张纸（A4/A5/小票），通过分页栏切换。

```js
tpl.printPanels[0].printElements        // 当前纸上的元素
tpl.printPanels[0].setPaper(width, height, type)
tpl.deletePanel(panel)                  // 守卫: length>=1 不能删完
```

### 5.3 PrintElementType / Group / Manager

元素类型注册系统：

```
PrintElementTypeManager (单例)
├── allElementTypes[]              ← 平铺缓存,按 tid 查
└── this[moduleName]               ← 桶,按面板分组
    ├── 'default' → [text/image/table/...]
    ├── 'delivery' → [递送单专用]
    └── ...
```

注册新类型：
```js
hiprint.PrintElementTypeManager.build('default', [
  new PrintElementTypeGroup('文字',[
    { tid: 'default.text', name: '文本', type: 'text', field: 'name' /*★必填*/ }
  ])
])
```

**陷阱**：
- 重复 tid 会被去重 + console.warn
- `field` 必填（否则 barcode/qrcode 显示"格式不支持该文本"）
- `removePrintElementTypes('default.t')` 必须精确 prefix（不能 startsWith 误删 `default.text`）

### 5.4 buildToolbar / buildDesigner

工厂函数：组合 toolbar + 画布 + 属性面板 + 元素列表。

```js
const ctrl = hiprint.buildDesigner('#container', {
  templateOptions: { template: {...}, history: true },
  toolbarOptions: { showPanelManager: true, onPreview, onPrint, ... },
  showPagination: false,        // 默认隐藏底部分页栏 (功能集成到 toolbar)
})

// 返回 ctrl 含: hiprintTemplate, refreshPagination, setPaginationVisible, destroy
ctrl.destroy()                  // ← 必须调
```

详见 `docs/TOOLBAR-ARCHITECTURE.md`。

### 5.5 jQuery + Vue 共存

- jQuery 操作 hiprint 内部 DOM（`.hiprint-printElement-*`、`.hiprint-toolbar` 等）
- Vue 操作外壳 DOM（`.designer-shell-header`、`.demo-pane` 等）
- **桥**：通过 `opts.onXxx(template, ...)` 回调让 hiprint 通知 Vue

详见 `.claude/rules/jquery-vue3.md`。

---

## 6. 常见任务 Cookbook

### 6.1 "我要给工具栏加一个按钮"

```js
// designer-shell.vue
buildDesigner('#container', {
  toolbarOptions: {
    extraButtons: [{                  // ← slot 1: 字符串/函数都可
      label: '导出',
      icon: 'export',
      onClick: () => exportTpl(ctrl.hiprintTemplate.getJson())
    }],
    // 或 slot 2: renderExtra(toolbar, $) - 完全自定义
    // 或 slot 3: addGroup(name, items) - 整组按钮
  }
})
```

### 6.2 "我要新增一种元素类型 (例如二维码 + 自定义业务字段)"

```js
import { PrintElementTypeGroup } from 'vue-plugin-hiprint'

hiprint.PrintElementTypeManager.build('default', [
  new PrintElementTypeGroup('业务条码', [{
    tid: 'biz.tracking_qr',
    name: '运单二维码',
    type: 'text',
    textType: 'qrcode',          // ← 关键: type='text' + textType
    field: 'trackingNo',          // ★ 必填
    options: { width: 100, height: 100 }
  }])
])
```

### 6.3 "我要修复 bundle.js 的一个 bug"

```bash
# 1. 跑 deep-system-debug skill 调研根因
/deep-system-debug

# 2. 写失败测试 (e2e/tests/<feature>.spec.ts)
# 3. 改 src/hiprint/hiprint.bundle.js (用 Edit 工具,不要 Write)
# 4. SMOKE Level 1 + Level 2 验证
# 5. 调用 hiprint-bundle-reviewer agent 自审
# 6. commit + push (branch protection 强制走 PR,但你是 admin 可 force)
# 7. codemap-syncer agent 同步 docs 行号
```

### 6.4 "我要升级 tgz 给业务方"

```bash
npm run pack:fixed                 # build + pack + 改名
# 调用 smoke-runner agent 自动跑 Level 1 验证
# 如果 PASS → cp vue-plugin-hiprint.tgz <业务方目录>
# 业务方 npm install vue-plugin-hiprint.tgz
```

### 6.5 "我要加个 e2e 测试"

```ts
// e2e/tests/<feature>.spec.ts
import { test, expect } from '@playwright/test'
import { waitForHiprint } from './helpers/wait-for-hiprint'

test('feature description', async ({ page }) => {
  await page.goto('/')
  await waitForHiprint(page)

  // 用 page.evaluate 操作 hiprint
  const result = await page.evaluate(() => {
    const tpl = new window.hiprint.PrintTemplate({...})
    return tpl.getJson()
  })

  expect(result.panels).toHaveLength(1)
})
```

跑：`npm run test:e2e`。

---

## 7. Required Verification (一定要跑)

| 改动 | 必跑 |
|---|---|
| 改任何源码 | `npm run pack:fixed` (确保不破坏 build) |
| 改 hiprint.bundle.js | + SMOKE Level 1 + Level 2 + hiprint-bundle-reviewer agent |
| 改 src/index.js | + 检查 docs/API-REFERENCE.md 一致性 |
| 改 etypes | + 跑 `e2e/tests/dedup.spec.ts` |
| 升 tgz 给业务方 | + smoke-runner agent + 给业务方说明 changelog |

---

## 8. 该读什么 (按学习顺序)

| # | 文档 | 读完能做什么 |
|---|---|---|
| 1 | `docs/ONBOARDING.md` (本文档) | 知道项目结构 + 跑起来 |
| 2 | `docs/CODE-BLUEPRINT.md` 第 1-3 节 | 知道 14905 行 bundle.js 大概在干嘛 |
| 3 | `docs/integration-guide.md` | 帮业务方接入 |
| 4 | `docs/API-REFERENCE.md` | 知道公开 API 怎么用 |
| 5 | `CLAUDE.md` + `.claude/rules/*.md` | 知道改代码必须遵守的规矩 |
| 6 | `docs/TOOLBAR-ARCHITECTURE.md` | 改工具栏不踩雷 |
| 7 | `docs/CODEMAPS/INDEX.md` → 各模块 | 改具体模块前精读 |
| 8 | `docs/SMOKE-TEST.md` | 知道怎么验证升级 |
| 9 | `docs/build-designer-vue-integration.md` | 理解多实例污染历史 |
| 10 | `docs/adr/*.md` | 知道为啥这么设计 |

---

## 9. 卡住时找谁 / 哪里查

| 问题 | 去哪 |
|---|---|
| 打印输出空白 | `docs/build-designer-vue-integration.md` Section 4 |
| 元素拖到画布显示"格式不支持" | `field` 没填,见 `src/hiprint/etypes/default-etyps-provider.js` |
| 业务方 import 报错 | `docs/integration-guide.md` Section 5 |
| 多个设计器互相影响 | `docs/build-designer-vue-integration.md` Section 3 |
| 打印 PDF 样式跟屏幕差很多 | 检查是否引入 `print-lock.css` |
| Bundle 改完 build 失败 | 调用 `build-error-resolver` agent |

---

## 10. 项目维护节奏

- **不接收上游 PR**（detached fork）
- **业务方反馈 → 我们直接修** → push tgz
- **任何 bug 修复必须**：先写失败测试 → 再修 → SMOKE → push
- **Branch protection**：main 走 PR（admin 可 force-push 紧急修复）
- **CI**：Playwright E2E 必须 pass

---

## 11. 词汇表

- **ct** = `PrintTemplate` 类（hiprint 内部命名）
- **pt** = `PrintPanel` 类
- **et** = `PrintElement` 类
- **tid** = type id（如 `default.text`、`biz.tracking_qr`）
- **panel** = 一张"纸"，对应 `printPanels[i]`
- **paper** = panel 的 DOM 容器（`.hiprint-printPaper`）
- **设计时** vs **打印时** — design() 时是可拖拽 DOM，print() 时是只读 HTML
- **mm/dot** — 单位换算，`hiprint.uomConv` 工具

---

## 下一步

1. 跑 `npm run dev`，浏览器打开试用 designer-shell
2. 读 `docs/CODE-BLUEPRINT.md` 22 区域索引（10 分钟）
3. 看一个真实 bug 修复 commit 学风格：`git log --oneline | head -10`，挑一个 fix(...) 看 diff
4. 找一个标 `good-first-issue` 的 task 上手
