# vue-admin-main 集成审计清单

> **审计日期**: 2026-05-12
> **审计范围**: `E:\Source_code\vue-admin-main\frontend` 内所有 `vue-plugin-hiprint` 集成点
> **业务方 tgz 版本**: 580520 bytes — 与本仓库 v1.0.3 + commit K (CSS 拆分) 同步
> **本次仅 read-only 检查,未修改 vue-admin-main 任何代码**

## 验证清单(执行人勾选用)

- [ ] BLOCK #1 — PrintTemplate 路由 meta 添加 `noCache: true`
- [ ] BLOCK #2 — `PrintBarcodeDialog.handleClosed` 添加 `destroy()` 调用
- [ ] WARN #3 — hiprint CSS import 移到 `main.ts` 最末尾
- [ ] INFO #4 — 删除死代码 `composables/useHiprintDesigner.ts`
- [ ] 修复后跑一遍下方 §6 验证步骤

## 1. 严重度说明

| 级别 | 含义 | SLA |
|---|---|---|
| 🔴 **BLOCK** | 实际会导致线上 bug (内存泄漏 / UI 双触发 / 资源累积) | 本周内修 |
| 🟡 **WARN** | 当前未出问题,但有未来升级时踩坑风险 | 下个迭代修 |
| 🟢 **INFO** | 代码卫生 / 死代码 | 顺手清理 |

---

## 2. 🔴 BLOCK #1 — keep-alive 缓存下 destroy 永不触发

### 证据链

| 文件 | 行 | 代码 | 含义 |
|---|---|---|---|
| `src/layout/components/AppView.vue` | 28 | `<keep-alive :include="getCaches">` | 全局 keep-alive 开启 |
| `src/store/modules/tagsView.ts` | 199 | `needCache = !item?.meta?.noCache` | **默认 noCache=false → 缓存** |
| 路由(后端动态加载) | — | PrintTemplate 路由 meta 未显式设置 noCache | 走默认路径 = 被缓存 |
| `src/views/Tools/PrintTemplate/components/DesignerHiprint.vue` | 540 | `onBeforeUnmount(() => destroy())` | **keep-alive 缓存时不触发** |

### 影响

用户操作时序:
```
T1  用户进入 /tools/print-template               → onMounted → buildDesigner 建 UI
T2  用户切到 /product/listing                    → keep-alive 保留组件
                                                  → onBeforeUnmount 不触发
                                                  → destroy() 不调用
T3  用户回到 /tools/print-template               → keep-alive 复活组件
                                                  → onMounted 不触发(已挂载)
                                                  → UI 看起来正常
T4  在 T2-T3 之间,DesignerHiprint 的 jQuery 全局事件订阅 / 单例 map 仍在内存
T5  用户多次切换路由 + 父组件 props 变化触发 watch → DesignerHiprint 的
    initDesigner() (line 416) 重跑 destroy + buildDesigner → 之前缓存的实例
    被丢弃,但 hiprint 全局事件还在
T6  长时间后 toolbar 双触发 / 内存增长 / jQuery body click handler 累积
```

### 当前代码状态

`src/views/Tools/PrintTemplate/components/DesignerHiprint.vue:540-542`
```js
onBeforeUnmount(() => {
  destroy()
})
```

缺失:`onActivated` / `onDeactivated` hooks。

### 修复方案(任选其一)

#### 方案 A(推荐 — 最简,无副作用)

PrintTemplate 路由 meta 加 `noCache: true`。该页面禁用 keep-alive 缓存。

业务方后端菜单管理接口添加该 meta,或者前端 router 手动给路由打:
```ts
{
  path: '/tools/print-template',
  component: () => import('@/views/Tools/PrintTemplate/PrintTemplate.vue'),
  meta: {
    title: '打印模板设计器',
    noCache: true,   // ← 关键
  },
}
```

**理由**:设计器是低频高复杂度页面,缓存收益(快速恢复滚动位置)远不及泄漏代价。

#### 方案 B(中等 — 保留缓存)

`DesignerHiprint.vue` script 内增加生命周期:

```vue
<script setup lang="ts">
import { onActivated, onDeactivated } from 'vue'
// ... 现有 imports

// ... 现有逻辑

onMounted(async () => {
  await initDesigner()
})

onBeforeUnmount(() => {
  destroy()
})

// 🆕 keep-alive 场景:每次激活重建,每次离开销毁,
// 与 onMounted/onBeforeUnmount 互斥但确保两种路由模式都安全
let _activatedReady = false
onActivated(async () => {
  if (_activatedReady) {           // 首次激活由 onMounted 处理,跳过
    await initDesigner()
  }
  _activatedReady = true
})
onDeactivated(() => {
  destroy()
})
</script>
```

**理由**:既能享受 keep-alive 的快速切换,又保证 destroy 一定被调。

#### 方案 C(复杂 — 不推荐)

保留缓存且不重建,仅靠 hiprint 自身的 `_destroyed` 守卫(commit 95b6fab 已加)防止崩溃。**不解决内存泄漏,不推荐**。

### 验证

修复后,业务方在浏览器 DevTools 跑:
```js
// 进入 /tools/print-template, 看一次 hiprint 单例数
Object.keys(window.$.hinnn.instance._printTemplates || {}).length

// 切到 /product/listing, 再回来 /tools/print-template
// 重复 3 次

// 再看单例数 — 应该 ≤ 1 (方案 A/B 都满足);
// 修复前会累积到 3+ (每次激活创建新实例)
```

---

## 3. 🔴 BLOCK #2 — PrintBarcodeDialog 没调 destroy

### 证据

`src/views/Product/Listing/components/PrintBarcodeDialog.vue`

```js
// line 459 — 每次需要预览时创建
previewTemplate.value = new hiprint.PrintTemplate()

// line 512-518 — dialog 关闭回调
const handleClosed = () => {
  previewError.value = ''
  previewTemplate.value = null              // ❌ 只清 Vue ref
  // 缺: previewTemplate.value?.destroy?.()
  if (previewHostRef.value) {
    previewHostRef.value.innerHTML = ''
  }
}
```

### 影响

每次打开打印 dialog → 一个新 `PrintTemplate` → hiprint 单例 map 累加一条 + 全局事件总线 `hiprintTemplateDataChanged_<id>` 订阅累加。`previewTemplate.value = null` 只断 Vue 引用,hiprint 内部不知道实例已被丢弃。

用户场景:`Listing.vue` / `LocalProducts.vue` 中打开 PrintBarcodeDialog 多次 → 每次 close 都泄漏一个 PrintTemplate。

### 修复方案

`handleClosed` 改为:

```js
const handleClosed = () => {
  previewError.value = ''
  // 🆕 显式销毁 hiprint 实例,释放事件订阅与单例 map 引用
  try {
    previewTemplate.value?.destroy?.()
  } catch (e) {
    // hiprint destroy 是幂等且 fail-safe 的,catch 仅防御性
  }
  previewTemplate.value = null
  if (previewHostRef.value) {
    previewHostRef.value.innerHTML = ''
  }
}
```

### 验证

```js
// 重复打开关闭 PrintBarcodeDialog 5 次, 然后:
Object.keys(window.$.hinnn.instance._printTemplates || {}).length
// 期望: ≤ 1 (修复前会 = 5)
```

---

## 4. 🟡 WARN #3 — CSS import 顺序倒置

### 证据

`src/main.ts:6`
```ts
import jQuery from 'jquery'
;(window as any).jQuery = jQuery
;(window as any).$ = jQuery

import 'vue-plugin-hiprint/dist/vue-plugin-hiprint.css'   // ← 太早

// 后面才是 unocss / svgIcon / setupStore / setupGlobCom / setupElementPlus / 全局 less
import '@/plugins/unocss'
// ...
import '@/styles/index.less'
```

而 `src/plugins/elementPlus/index.ts:18`:
```ts
if (import.meta.env.VITE_USE_ALL_ELEMENT_PLUS_STYLE === 'true') {
  import('element-plus/dist/index.css')         // ← element-plus CSS 后到
}
```

### 影响

CSS 顺序决定优先级。当前 hiprint CSS **先**加载,element-plus CSS / 全局 less **后**加载且权重相同时,后到者覆盖。

潜在冲突点:全局 reset、`button` / `ul` / `li` 元素默认样式、`* { box-sizing }`。

实际症状(经验):大概率不冲突(hiprint 用 `.hiprint-*` 前缀 class,element-plus 用 `.el-*` 前缀)。但未来升级 element-plus 主版本时容易踩坑。

### 修复方案

`main.ts` 把 hiprint CSS 移到**所有其他 CSS / element-plus setup 之后**:

```ts
import 'vue/jsx'
import jQuery from 'jquery'
;(window as any).jQuery = jQuery
;(window as any).$ = jQuery

// 删掉这行原来在第 6 行的 import
// import 'vue-plugin-hiprint/dist/vue-plugin-hiprint.css'

import '@/plugins/unocss'
import '@/plugins/svgIcon'
import { setupStore } from '@/store'
// ...
import '@/styles/index.less'
import { setupElementPlus } from '@/plugins/elementPlus'

// 🆕 移到这里,让 hiprint CSS 拥有最高优先级覆盖 element-plus / unocss / 自定义全局样式
import 'vue-plugin-hiprint/dist/vue-plugin-hiprint.css'

// ... 后续 createApp + use(setupElementPlus) + mount
```

### 验证

修复后视觉对比:
- 设计器 toolbar 按钮 / 颜色选择器面板 / 属性面板字段间距 与本仓库 `npm run dev` (designer-shell.vue) 像素级一致
- 没有 hiprint 元素被 element-plus reset.css 影响的样式(如 `button` 默认 border)

---

## 5. 🟢 INFO #4 — 死代码 useHiprintDesigner.ts

### 证据

`src/views/Tools/PrintTemplate/composables/useHiprintDesigner.ts` 188 行,用旧 API:
```ts
const template = new hiprint.PrintTemplate({ ... })
template.design(container.value)
```

但 `DesignerHiprint.vue` 实际用新 API `hiprint.buildDesigner('#xxx', opts)`,**完全没 import `useHiprintDesigner`**:

```bash
# read-only 验证
grep -rn "useHiprintDesigner" frontend/src/views/Tools/PrintTemplate/
# 仅自身定义,无 import 调用方
```

### 影响

无运行时影响,但属于:
1. 误导(后来人改错文件)
2. lint 报 unused export 警告
3. 占代码量统计

### 修复方案

```bash
rm frontend/src/views/Tools/PrintTemplate/composables/useHiprintDesigner.ts
```

如果有相关 test 也一起删。

---

## 6. 修复完成后的回归验证

按以下顺序检查(任一项失败 → 回滚对应 commit):

### 6.1 设计器主流程
1. 进入 `/tools/print-template`,UI 与本仓库 `npm run dev` 一致
2. 拖拽 text / longText / barcode / qrcode / image 元素到画布,渲染正常
3. **longText 设 indent 18,显示真实首行缩进(不是 `<span class="long-text-indent"></span>长文` 字面)**
4. 颜色选择器(属性面板内)点击弹出色板可选色
5. 保存模板 / 加载模板 / 撤销重做 全部正常

### 6.2 keep-alive 修复验证(BLOCK #1)
1. 进入设计器
2. 切到 `/product/listing` 后再回来
3. 重复 3 次
4. DevTools Console 跑:`Object.keys(window.$.hinnn.instance._printTemplates || {}).length` → ≤ 1

### 6.3 dialog 修复验证(BLOCK #2)
1. 在 Listing 页面打开 PrintBarcodeDialog 5 次,每次关闭
2. DevTools Console 同上脚本 → ≤ 1

### 6.4 CSS 修复验证(WARN #3)
1. 视觉对比设计器 UI 与本仓库 dev server 像素级一致
2. 颜色选择器边框 / hover 状态正常

---

## 7. ✅ 当前已正确的部分(无需动)

| 检查项 | 文件 | 行 | 状态 |
|---|---|---|---|
| 容器高度链完整 | `PrintTemplate.vue` / `AppView.vue` / `DesignerHiprint.vue` | 各 style | ✅ flex + min-h-0 + h-full 链路完整 |
| 注册 i18n 中文 | `useHiprintRuntime.ts` | 14 | ✅ `lang: 'cn'` |
| componentModule 传值 | `DesignerHiprint.vue` | 434 | ✅ `'defaultModule'` |
| 用新 API buildDesigner | `DesignerHiprint.vue` | 489 | ✅ 不是旧 `template.design()` |
| Unique container id | `DesignerHiprint.vue` | 67 | ✅ `${Date.now()}_${Math.random()}` 防多实例 |
| 重建前先 destroy | `DesignerHiprint.vue:initDesigner` | 419 | ✅ `destroy()` 重入保险 |
| 业务方 tgz 已含最新修复 | `backend/print/vue-plugin-hiprint.tgz` | 580520 bytes | ✅ = repo v1.0.3+K |
| CSS 用完整版含 minicolors | `main.ts` | 6 | ✅ `vue-plugin-hiprint.css` 而非 `hiprint-core.css` |
| `hiprint.removeDynamicFields` 在 destroy 中清理 | `DesignerHiprint.vue` | 324 | ✅ 防 setDynamicFields 累积 |
| 动态字段 sceneModuleName 用 unique suffix | `DesignerHiprint.vue` | 68 | ✅ `scene-module-${uniqueSuffix}` |

---

## 8. 相关文档

- 本仓库 `docs/vue-admin-integration.md` — 完整 vue-admin-main 集成指南(本审计依据)
- 本仓库 `docs/API-REFERENCE.md` — 23 export + opts 速查
- 本仓库 `docs/build-designer-vue-integration.md` — Vue 多实例 / keep-alive 详解
- 本仓库 `docs/SMOKE-TEST.md` — 升级 tgz 后的回归验证 8 项断言
