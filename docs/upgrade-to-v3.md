# Upgrade Guide: V1 → V3 (Reactive-Only)

> **Audience**: Business consumers currently on `vue-plugin-hiprint@1.x` (V1 imperative API). Primary reference target: `vue-admin-main` Print Template module.
>
> **Status**: V3 is a **breaking** release. All consumers must migrate — V1 imperative facade (`toolbarCtrl`, `hiprint.setConfig`, `hiprint.buildToolbar` as global, etc.) has been **deleted**.
>
> **Decision reference**: User confirmation 2026-05-11 — *"纯 V3,业务方必须迁移 — 完全删除 V1 imperative API"*.

---

## TL;DR

1. **`toolbarCtrl` is gone.** All 27 imperative methods (`setButtonText` / `openTemplateDialog` / `setTemplateListProvider` / `triggerButton` / etc.) replaced by **reactive props on SFCs** or **direct Pinia store actions**.
2. **`hiprint.setConfig` / `hiprint.buildToolbar` / `hiprint.buildDesigner` as facade properties are gone.** Import standalone: `import { buildDesigner, useHiprintDesigner } from 'vue-plugin-hiprint/v3'`.
3. **`onReady(tpl, toolbarCtrl)` → `onReady(tpl)`** — single argument. Drop the second param everywhere.
4. **`new hiprint.PrintTemplate({...})` + its V1 methods (`design/update/getJson/print/print2/toPdf/undo/redo/clear/destroy`) are retained** as a compat layer — same signatures, V3 reactive implementation under the hood. Existing call sites work unchanged.
5. **Effort estimate**: vue-admin-main migration ≈ **1 dev-day** (4 files, ~280 lines touched).

---

## 1. Overview

V3 is a ground-up reactive rewrite of the toolbar/designer/property-panel UI layer, while the **print core** (PrintTemplate, panel rendering, paper sizing, jspdf pipeline, socket.io client) is preserved.

| Layer | V1 (deprecated) | V3 (new) |
|---|---|---|
| UI shell | jQuery DOM + imperative `toolbarCtrl` | Vue 3 SFCs + reactive props |
| State | Hidden inside `hiprint.PrintTemplate` instance | Pinia stores (per-designer instance) |
| Lifecycle | Manual `destroy()` choreography | Composables with `onScopeDispose` |
| Multi-instance | UID-based namespacing on `$(document)` | Pinia instance isolation + scoped event buses |
| Customization | `setButtonText / setButtonVisible / triggerButton` | Reactive props + slot fallbacks |
| Dialogs | `openTemplateDialog()` → opaque modal | `<TemplateDialog v-model:open="...">` SFC |
| Print core | `tpl.print() / .print2() / .toPdf()` | **Unchanged** (V1 method names + signatures retained) |
| Sockets | `autoConnect/disAutoConnect/window.hiwebSocket` | **Unchanged** |
| Dynamic fields | `hiprint.setDynamicFields/removeDynamicFields` | **Unchanged** |

### Why this break

The V1 surface had structural defects which `vue-admin-main` hit repeatedly:

1. **`toolbarCtrl.setButtonText` was imperative DOM mutation** — invisible to Vue reactivity, lost on HMR, race conditions during `buildDesigner` mount.
2. **`openTemplateDialog()` returned `void`** — caller could not control modal state; closing required hidden side-effects.
3. **Multi-designer instances collided on global `$(document)` events** despite namespace patches.
4. **`hiprint.setConfig` was a global side-effect** — incompatible with two designers on one page having different toolbar configs.

V3 inverts the relationship: business code **owns the data**, V3 SFCs **render it reactively**.

---

## 2. Breaking changes summary table

| V1 surface | V3 status | Replacement |
|---|---|---|
| `toolbarCtrl.setButtonText(key, text)` | **REMOVED** | `<HiprintToolbar :button-label="{ undo: '撤销' }" />` reactive prop |
| `toolbarCtrl.setButtonVisible(key, vis)` | **REMOVED** | `<HiprintToolbar :show-undo="false" />` reactive prop |
| `toolbarCtrl.setButtonDisabled(key, dis)` | **REMOVED** | `<HiprintToolbar :button-disabled="{ save: true }" />` |
| `toolbarCtrl.triggerButton(key)` | **REMOVED** | Call store action directly: `useHistoryStore().undo()` |
| `toolbarCtrl.openTemplateDialog()` | **REMOVED** | `<TemplateDialog v-model:open="dialogOpen" :items="..." />` SFC + v-model |
| `toolbarCtrl.closeTemplateDialog()` | **REMOVED** | `dialogOpen.value = false` |
| `toolbarCtrl.refreshTemplateList()` | **REMOVED** | Parent fetches data + passes via `:items` prop (data flows in, not out) |
| `toolbarCtrl.setTemplateListProvider(fn)` | **REMOVED** | Parent owns data fetch; pass results as `:items` prop |
| `toolbarCtrl.setBusinessDialogOpenHandler(fn)` | **REMOVED** | `v-model:open` on `<BusinessDataDialog>` + parent watch |
| `toolbarCtrl.openBusinessDialog()` | **REMOVED** | `businessOpen.value = true` |
| `toolbarCtrl.triggerSave(payload)` | **REMOVED** | `useTemplateStore().save(payload)` or `<SaveDialog>` v-model |
| `toolbarCtrl.triggerPrint()` / `.triggerPreview()` | **REMOVED** | `useHiprintPrint().print(data)` / `.preview(data)` |
| `toolbarCtrl.setI18n(dict)` | **REMOVED** | `<HiprintDesigner :locale="dict" />` reactive prop |
| `toolbarCtrl.addExtraButton(opts)` | **REMOVED** | `<template #extra-start>` / `#extra-end` slots on `<HiprintToolbar>` |
| `toolbarCtrl.removeExtraButton(key)` | **REMOVED** | `v-if` on slot content |
| `toolbarCtrl.getButtons()` | **REMOVED** | Inspect `useToolbarStore().buttons` reactive ref |
| `toolbarCtrl.destroy()` | **REMOVED** | Unmount the SFC (handled by Vue) |
| `hiprint.setConfig(opts)` | **REMOVED** | Pass opts directly as props to `<HiprintDesigner>` / `<HiprintToolbar>` |
| `hiprint.buildToolbar(container, tpl, opts)` | **REMOVED as facade method** | Import standalone: `import { buildToolbar } from 'vue-plugin-hiprint/v3'` — or use `<HiprintToolbar>` SFC |
| `hiprint.buildDesigner(container, opts)` | **CHANGED** | Returns minimal V3 controller (no `toolbarCtrl`). Same call site, fewer return fields. |
| `onReady(tpl, toolbarCtrl)` callback | **CHANGED** | `onReady(tpl)` — single arg. **Delete the second param.** |
| `hiprint.init(opts)` | **RETAINED** | Same signature: `{ providers, host, token, lang }` |
| `hiprint.setDynamicFields(moduleName, groups)` | **RETAINED** | Same |
| `hiprint.removeDynamicFields(moduleName)` | **RETAINED** | Same |
| `new hiprint.PrintTemplate({ template, settingContainer, history })` | **RETAINED** | Same ctor, same fields |
| `tpl.design(container)` | **RETAINED** | Same |
| `tpl.update(json)` | **RETAINED** | Same |
| `tpl.getJson()` | **RETAINED** | Same |
| `tpl.print(data, opts)` | **RETAINED** | Same |
| `tpl.print2(data, opts)` | **RETAINED** | Same |
| `tpl.toPdf(data, fileName)` | **RETAINED** | Same |
| `tpl.undo()` / `.redo()` / `.clear()` | **RETAINED** | Same |
| `tpl.destroy()` | **RETAINED** | Same (idempotent guard preserved) |
| `autoConnect(callback)` / `disAutoConnect()` | **RETAINED** | Same |
| `window.hiwebSocket.opened` / `.printerList` | **RETAINED** | Same (V1 quirk preserved per ADR-0011 #12) |
| `defaultElementTypeProvider` | **RETAINED** | Same — instantiate with `new defaultElementTypeProvider()` |
| `hiPrintPlugin` Vue plugin (`app.use(hiPrintPlugin)`) | **RETAINED** | Same — installs `$hiPrint / $print / $print2` globals |
| `$hiPrint` / `$print` / `$print2` globals | **RETAINED** | Same |

---

## 3. Migration examples — vue-admin-main composables

The following sections cover **all four files** in `vue-admin-main` that touch the hiprint API. Each has a **before** block (current V1 usage) and an **after** block (V3 target).

### 3.1 `useHiprintRuntime.ts`

Initialization composable. Smallest diff — `hiprint.init` signature is unchanged.

#### Before (V1)

```diff
- import { hiprint, defaultElementTypeProvider } from 'vue-plugin-hiprint'
- import { createModuleLogger } from '@/utils/logger'
-
- const logger = createModuleLogger('PrintTemplate/useHiprintRuntime')
-
- let initialized = false
-
- export const ensureHiprintRuntime = (): void => {
-   if (initialized) return
-
-   try {
-     hiprint.init({
-       providers: [new defaultElementTypeProvider()],
-       lang: 'cn'
-     })
-     initialized = true
-   } catch (error) {
-     logger.warn('[hiprint] 初始化失败:', error)
-   }
- }
```

#### After (V3)

```diff
+ import { useHiprintRuntime, defaultElementTypeProvider } from 'vue-plugin-hiprint/v3'
+ import { createModuleLogger } from '@/utils/logger'
+
+ const logger = createModuleLogger('PrintTemplate/useHiprintRuntime')
+
+ // V3: composable manages init idempotency via globalThis cache (HMR-safe)
+ export const ensureHiprintRuntime = (): void => {
+   try {
+     useHiprintRuntime({
+       providers: [new defaultElementTypeProvider()],
+       lang: 'cn',
+       autoInit: true,        // V3 flag: init once on first call, no-op thereafter
+     })
+   } catch (error) {
+     logger.warn('[hiprint] 初始化失败:', error)
+   }
+ }
```

**Notes**:
- `useHiprintRuntime` is itself idempotent — the local `initialized` flag is no longer needed (V3 caches the singleton on `globalThis.__hiprint_runtime__`).
- Calling `useHiprintRuntime()` from any composable (not just Setup) is safe because `autoInit: true` bypasses Vue scope requirements.
- For HMR scenarios, the runtime survives module re-import — no double-init.

---

### 3.2 `useHiprintDesigner.ts`

This is the **largest migration**. The V1 version manually instantiates `new hiprint.PrintTemplate({...})` and calls `template.design(container.value)`. V3 offers two options:

- **Option A (recommended)**: Replace the entire composable with the built-in `useHiprintDesigner` from V3.
- **Option B**: Keep your wrapper composable but delegate to V3 primitives.

#### Option A — Use V3's built-in composable

Delete the file entirely and use V3's `useHiprintDesigner` directly in the consuming SFC:

```diff
- // useHiprintDesigner.ts — DELETE THIS FILE
+ // Consumer SFC imports V3 composable directly
```

In `DesignerHiprint.vue`:

```ts
import { useHiprintDesigner } from 'vue-plugin-hiprint/v3'

const designer = useHiprintDesigner({
  container: designerRootRef,
  history: true,
  initialTemplate: props.templateData ?? {},
})

const { isReady, currentTemplate, loadTemplate, getJson, clear, undo, redo, destroy } = designer
```

The V3 composable provides the **same return shape** (`isReady`, `currentTemplate`, `loadTemplate`, `getJson`, `clear`, `undo`, `redo`, `destroy`) so no further changes are needed in callers.

#### Option B — Keep the wrapper, swap internals

```diff
- import { hiprint, defaultElementTypeProvider } from 'vue-plugin-hiprint'
+ import {
+   useHiprintRuntime,
+   useHiprintTemplate,
+   defaultElementTypeProvider
+ } from 'vue-plugin-hiprint/v3'

  export function useHiprintDesigner(options: UseHiprintDesignerOptions): UseHiprintDesignerReturn {
    const { container, settingContainer, providers } = options
    const isReady = ref(false)
    const currentTemplate = shallowRef<any | null>(null)

    async function init(): Promise<void> {
      try {
-       const elementProviders = providers ?? [new defaultElementTypeProvider()]
-       hiprint.init({ providers: elementProviders })
-
-       const settingSelector = '.hiprint-setting-container'
-
-       const template = new hiprint.PrintTemplate({
-         template: {},
-         settingContainer: settingSelector,
-         history: true
-       })
-
-       template.design(container.value)
+       useHiprintRuntime({
+         providers: providers ?? [new defaultElementTypeProvider()],
+         autoInit: true,
+       })
+
+       // V3: useHiprintTemplate wraps PrintTemplate with reactive state + auto-cleanup
+       const tpl = useHiprintTemplate({
+         template: {},
+         settingContainer: '.hiprint-setting-container',
+         history: true,
+       })
+
+       tpl.design(container.value)
+       currentTemplate.value = tpl

-       currentTemplate.value = template
        isReady.value = true
      } catch (error) {
        isReady.value = false
        logger.error('[useHiprintDesigner] 设计器初始化失败:', error)
      }
    }

-   // loadTemplate / getJson / clear / undo / redo / destroy unchanged
-   // (V3 PrintTemplate exposes same methods)
+   // loadTemplate / getJson / clear / undo / redo / destroy unchanged
+   // (V3 PrintTemplate compat layer exposes same methods)

    return { isReady, currentTemplate, init, loadTemplate, getJson, clear, undo, redo, destroy }
  }
```

**Key invariants** (preserved across V1→V3):
- `template.design(container.value)` still accepts a DOM element (not a selector).
- `settingContainer` still expects a **CSS selector string** (not a DOM element).
- `history: true` still enables undo/redo.
- `destroy()` is still idempotent.

---

### 3.3 `usePrintService.ts`

Strategy pattern wrapping `tpl.print()` / `tpl.print2()`. V3 retains all V1 print methods, so the migration is **minimal**.

#### Before (V1)

```diff
- import { hiprint, autoConnect, disAutoConnect } from 'vue-plugin-hiprint'
- import { ensureHiprintRuntime } from './useHiprintRuntime'
-
- export class BrowserPrintStrategy implements PrintStrategy {
-   async print(templateData, printData, options) {
-     if (!templateData) throw new Error('请先加载模板')
-     ensureHiprintRuntime()
-
-     const printTemplate = new hiprint.PrintTemplate()
-     printTemplate.update(templateData)
-     printTemplate.print(printData, options || {})
-   }
- }
-
- export class SilentPrintStrategy implements PrintStrategy {
-   connect(): Promise<boolean> {
-     return new Promise((resolve) => {
-       hiprint.init({ host: this.socketUrl })
-       autoConnect((status, msg) => { /* ... */ })
-     })
-   }
-
-   async print(templateData, printData, options) {
-     ensureHiprintRuntime()
-     const printTemplate = new hiprint.PrintTemplate()
-     printTemplate.update(templateData)
-     printTemplate.print2(printData, { printer: options?.printer || '', title: '静默打印任务' })
-   }
- }
```

#### After (V3)

```diff
+ import {
+   useHiprintPrint,
+   useHiprintSocket,
+   PrintTemplate,        // V3 compat: same class, same methods
+ } from 'vue-plugin-hiprint/v3'
+ import { ensureHiprintRuntime } from './useHiprintRuntime'
+
+ export class BrowserPrintStrategy implements PrintStrategy {
+   async print(templateData, printData, options) {
+     if (!templateData) throw new Error('请先加载模板')
+     ensureHiprintRuntime()
+
+     // V3: PrintTemplate compat class — same V1 API
+     const printTemplate = new PrintTemplate()
+     printTemplate.update(templateData)
+     printTemplate.print(printData, options || {})
+   }
+ }
+
+ export class SilentPrintStrategy implements PrintStrategy {
+   private socket = useHiprintSocket({ host: this.socketUrl, autoConnect: false })
+
+   async connect(): Promise<boolean> {
+     // V3: reactive socket — `socket.connected` is a ref<boolean>
+     return this.socket.connect()       // returns Promise<boolean>
+   }
+
+   disconnect(): void {
+     this.socket.disconnect()
+   }
+
+   async print(templateData, printData, options) {
+     if (!this.socket.connected.value) {
+       throw new Error('未连接到打印客户端，请先启动 electron-hiprint')
+     }
+     ensureHiprintRuntime()
+
+     const printTemplate = new PrintTemplate()
+     printTemplate.update(templateData)
+     printTemplate.print2(printData, {
+       printer: options?.printer || '',
+       title: '静默打印任务'
+     })
+   }
+
+   getConnectionStatus(): PrintConnectionStatus {
+     return this.socket.connected.value ? 'connected' : 'disconnected'
+   }
+
+   async getPrinterList(): Promise<PrinterInfo[]> {
+     // V3: socket.printers is a ref<PrinterInfo[]> — already normalized
+     return this.socket.printers.value
+   }
+ }
```

**Notes**:
- `window.hiwebSocket.opened` access still works (V1 quirk preserved per ADR-0011 #12), but **prefer** the reactive `socket.connected` ref in V3.
- `autoConnect()` / `disAutoConnect()` are retained but `useHiprintSocket()` is the V3-native equivalent with reactive state.
- The 5-second connect timeout in the old code is no longer needed — `socket.connect()` resolves/rejects on its own with built-in timeout.

---

### 3.4 `DesignerHiprint.vue`

The largest user-facing file. It currently calls `hiprint.buildDesigner('#xxx', { toolbarOptions, onReady, componentPanelSlot })` and treats the toolbar as an imperative black box.

#### Before (V1) — abbreviated

```diff
- import { hiprint, type DynamicFieldGroup } from 'vue-plugin-hiprint'
-
- const designerController = shallowRef<any>(null)
- const templateInstance = shallowRef<any>(null)
-
- const initDesigner = async () => {
-   await nextTick()
-   ensureHiprintRuntime()
-   destroy()
-   syncDynamicFields()
-
-   const options = {
-     leftWidth: 220,
-     rightWidth: 320,
-     componentModule: 'defaultModule',
-     templateOptions: { template: initialTemplate, history: true },
-     toolbarOptions: {
-       showTemplateSelect: false,
-       showSave: true,
-       renderExtra: (toolbarApi) => {
-         const btn = toolbarApi.createButton({
-           key: 'template-select',
-           label: '选择模版',
-           onClick: () => void openTemplateDialog()
-         })
-         toolbarApi.addGroup(btn, 'start')
-       },
-       onClear: async (template) => { await clearTemplateWithConfirm(template) },
-       onPrint: (template) => { printWithBrowser(template) },
-       onPreview: (template) => { emit('preview', template?.getJson?.()) },
-       onSave: async (_tpl, json, _ev, _api, ctx) => {
-         await saveTemplateByApi(json, ctx?.name)
-       }
-     },
-     onReady: (template) => { templateInstance.value = template }
-   }
-
-   designerController.value = hiprint.buildDesigner(`#${designerContainerId}`, options)
-   templateInstance.value = designerController.value?.getTemplate?.()
- }
```

#### After (V3) — composable + SFC

The recommended V3 pattern replaces `buildDesigner` with the `<HiprintDesigner>` SFC:

```vue
<template>
  <div ref="designerRootRef" class="designer-hiprint">
    <HiprintDesigner
      :template="props.templateData ?? {}"
      :history="true"
      :left-width="220"
      :right-width="320"
      :component-module="'defaultModule'"
      :component-panel-slot="panelSlot"
      :dynamic-fields="sceneFieldGroups"
      :module-name="sceneModuleName"
      :locale="locale"
      @ready="handleReady"
      @preview="(json) => emit('preview', json)"
      @print="printWithBrowser"
      @clear="clearTemplateWithConfirm"
      @save="(json, name) => saveTemplateByApi(json, name)"
    >
      <!-- V3: extra toolbar buttons via slots instead of renderExtra() -->
      <template #toolbar-extra-start>
        <button class="hi-btn" @click="openTemplateDialog">选择模版</button>
      </template>
      <template #toolbar-extra-end>
        <button class="hi-btn" @click="toggleFullscreen">全屏</button>
      </template>

      <!-- V3: toolbar button visibility via prop, not toolbarCtrl method -->
      <template #toolbar-buttons="{ buttons }">
        <!-- Optional: override button rendering entirely -->
      </template>
    </HiprintDesigner>

    <!-- V3: template-select dialog via v-model — no toolbarCtrl.openTemplateDialog() -->
    <TemplateDialog
      v-model:open="templateDialogVisible"
      :loading="templateDialogLoading"
      :error="templateDialogError"
      :items="templateDialogTemplates"
      :active-id="activeTemplateId"
      @refresh="refreshTemplateDialog"
      @select="handleTemplateDialogSelect"
      @preview="handleTemplateDialogPreview"
      @edit="handleTemplateDialogEdit"
      @delete="handleTemplateDialogDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, shallowRef, onMounted, onBeforeUnmount, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  HiprintDesigner,
  TemplateDialog,
  useHiprintRuntime,
  type DynamicFieldGroup,
} from 'vue-plugin-hiprint/v3'
import { ensureHiprintRuntime } from '../composables/useHiprintRuntime'
// ... other imports unchanged

const designerRootRef = ref<HTMLElement | null>(null)
const templateInstance = shallowRef<any>(null)
const templateDialogVisible = ref(false)
const templateDialogLoading = ref(false)
const templateDialogError = ref('')
const templateDialogTemplates = ref<PrintTemplateResponse[]>([])

const panelSlot = computed(() => {
  if (sceneFieldGroups.value.length === 0) return null
  return {
    enabled: true,
    moduleName: sceneModuleName,
    anchorGroupName: '辅助',
    groupName: '动态字段',
    emptyTip: '暂无动态字段',
  }
})

// V3: ready callback receives only the template instance (no toolbarCtrl)
const handleReady = (tpl: any) => {
  templateInstance.value = tpl
}

// V3: open dialog by mutating reactive ref — no toolbarCtrl.openTemplateDialog()
const openTemplateDialog = async () => {
  templateDialogVisible.value = true
  await refreshTemplateDialog()
}

// All business handlers (refreshTemplateDialog / handleTemplateDialogSelect /
// saveTemplateByApi / clearTemplateWithConfirm / printWithBrowser) remain
// **unchanged** from V1 — they work with template JSON, not with toolbarCtrl.

onMounted(() => ensureHiprintRuntime())

defineExpose({
  loadTemplate: (json) => templateInstance.value?.update(json),
  getJson: () => templateInstance.value?.getJson() ?? { panels: [] },
  clear: () => templateInstance.value?.clear(),
  undo: () => templateInstance.value?.undo(),
  redo: () => templateInstance.value?.redo(),
})
</script>
```

#### Toolbar customization mapping

| V1 `toolbarOptions.*` field | V3 equivalent |
|---|---|
| `showTemplateSelect: false` | `<HiprintDesigner :show-template-select="false">` |
| `showSave: true` | `<HiprintDesigner :show-save>` (default `true`) |
| `showPrint: false` | `<HiprintDesigner :show-print="false">` |
| `showPreview: false` | `<HiprintDesigner :show-preview="false">` |
| `showUndo: false` | `<HiprintDesigner :show-undo="false">` |
| `showRedo: false` | `<HiprintDesigner :show-redo="false">` |
| `showClear: false` | `<HiprintDesigner :show-clear="false">` |
| `renderExtra(api)` callback | `<template #toolbar-extra-start>` and `#toolbar-extra-end` slots |
| `buttonLabels: { undo: '撤销' }` | `<HiprintDesigner :button-label="{ undo: '撤销' }">` |
| `onSave(tpl, json, evt, api, ctx)` callback | `@save="(json, name) => ..."` event (signature simplified) |
| `onPrint(tpl)` callback | `@print="(json) => ..."` event |
| `onPreview(tpl)` callback | `@preview="(json) => ..."` event |
| `onClear(tpl)` callback | `@clear="(tpl) => ..."` event |
| `onReady(tpl, toolbarCtrl)` callback | `@ready="(tpl) => ..."` event (single arg) |

#### Dialog migration mapping

| V1 imperative | V3 reactive |
|---|---|
| `toolbarCtrl.openTemplateDialog()` | `dialogOpen.value = true` |
| `toolbarCtrl.closeTemplateDialog()` | `dialogOpen.value = false` |
| `toolbarCtrl.setTemplateListProvider(fn)` | Parent owns fetch; pass `:items="templates"` |
| `toolbarCtrl.refreshTemplateList()` | Parent calls own fetch fn; updates `:items` ref |
| `toolbarCtrl.setBusinessDialogOpenHandler(fn)` | `<BusinessDataDialog v-model:open="businessOpen">` + parent `watch` |
| `toolbarCtrl.openBusinessDialog()` | `businessOpen.value = true` |

---

## 4. Migration checklist for vue-admin-main devs

Sequential steps. Tick each before moving on.

- [ ] **1. Install V3**: `npm install vue-plugin-hiprint@2.0.0` (when published) or update the `.tgz` reference in `package.json`.
- [ ] **2. Update imports**: Replace `from 'vue-plugin-hiprint'` with `from 'vue-plugin-hiprint/v3'` in all 4 files:
  - `composables/useHiprintRuntime.ts`
  - `composables/useHiprintDesigner.ts`
  - `composables/usePrintService.ts`
  - `components/DesignerHiprint.vue`
- [ ] **3. Refactor `useHiprintRuntime.ts`** — swap `hiprint.init` for `useHiprintRuntime({autoInit: true})`. ~20 lines.
- [ ] **4. Refactor `useHiprintDesigner.ts`** — choose Option A (delete file, use V3 built-in) or Option B (keep wrapper, swap internals). ~80 lines.
- [ ] **5. Refactor `usePrintService.ts`** — swap `new hiprint.PrintTemplate()` for `new PrintTemplate()` (from V3 compat layer); optionally swap `autoConnect/disAutoConnect` for `useHiprintSocket()`. ~60 lines.
- [ ] **6. Refactor `DesignerHiprint.vue`** — replace `hiprint.buildDesigner(...)` with `<HiprintDesigner>` SFC; replace `renderExtra` with slots; replace `toolbarCtrl.openTemplateDialog` with `v-model:open`. ~120 lines.
- [ ] **7. Drop `toolbarCtrl` references**: search the codebase with regex `toolbarCtrl\.\w+` and remove each call per the table above. (vue-admin-main: 0 hits expected after step 6.)
- [ ] **8. Drop `designerController` calls** that depend on V1-only fields:
  - `designerController.getTemplate()` → use `@ready` event to capture the template instance
  - `designerController.rebuildComponentPanel()` → bind `:dynamic-fields` reactive prop, V3 auto-rebuilds
  - `designerController.clearComponentPanelSlot()` → set `:component-panel-slot="null"`, V3 auto-clears
- [ ] **9. If `__hiprintDesignerControls` window global is used** (designer-shell pattern from v1 demo): refactor to use `provide()` + `inject()` between parent and child SFCs. The window global is **not** part of V3 surface.
- [ ] **10. Run business app dev server**: verify
  - Designer mounts cleanly (no console errors).
  - All toolbar buttons (undo / redo / clear / save / preview / print) trigger correct handlers.
  - Template-select dialog opens, populates, allows select/preview/edit/delete.
  - Save flow round-trips data to the API.
  - Browser print + silent print both work.
  - Dynamic-fields panel (FNSKU scene) renders correctly.
- [ ] **11. Run business e2e regression suite** — `pnpm test:e2e` in `vue-admin-main`.
- [ ] **12. Update `vue-admin-main` integration docs** if your team maintains one.

---

## 5. Common pitfalls

### 5.1 Modal teleport + Pinia provideInject

`ant-design-vue` Modal (and Element Plus `ElDialog`) teleports content to `document.body` by default. This **breaks** `provide()/inject()` chains.

**V3 mitigation**: V3 composables use `useXxxStore()` which finds the active Pinia via `getActivePinia()` rather than provide/inject. Cross-teleport boundary state works automatically.

**However**: If you `app.use(createPinia())` **twice** (e.g., in tests + in main entry), V3 composables may pick the wrong instance. Always create exactly one Pinia per app.

### 5.2 Multiple designers on one page

Each `<HiprintDesigner>` instance creates its own scoped Pinia store via factory function. Cross-talk is impossible **as long as each component has its own root**.

**Symptom of misuse**: Two `<HiprintDesigner>` components sharing the same `:template` ref — undo/redo from one will affect the other's view. Solution: deep-clone the template JSON for each instance.

### 5.3 `window.hiwebSocket` legacy access

The socket protocol still exposes `window.hiwebSocket.opened` and `window.hiwebSocket.printerList` (V1 quirk preserved — see ADR-0011 #12). Your existing `usePrintService.ts` code reading these still works.

**Prefer V3 reactive equivalents** for new code:
- `useHiprintSocket().connected` (ref<boolean>)
- `useHiprintSocket().printers` (ref<PrinterInfo[]>)

### 5.4 HMR-safe singletons

The V3 hiprint global, element-type registry, and socket are cached on `globalThis.__hiprint_runtime__`, `globalThis.__hiprint_registry__`, `globalThis.__hiprint_socket__`. HMR re-import yields the **same** instance — no `init` is repeated, no double-subscription.

If you see "WebSocket connection 2x" in DevTools after HMR, check that you have not bypassed the V3 cache with a manual `new Socket(...)`.

### 5.5 `onReady` second argument

V1's `onReady(tpl, toolbarCtrl)` provided imperative access to the toolbar. V3's `onReady(tpl)` only provides the template instance.

**If your existing code does**:
```ts
onReady: (tpl, toolbarCtrl) => {
  toolbarCtrl.setButtonText('save', '保存模板')
}
```

**Migrate to**:
```vue
<HiprintDesigner :button-label="{ save: '保存模板' }" @ready="(tpl) => ..." />
```

### 5.6 Component-panel slot rebuild

V1: `designerController.rebuildComponentPanel(moduleName, panelSlot)` was imperative.

V3: bind `:component-panel-slot="panelSlot"` reactively. When `panelSlot.value` changes, V3 auto-rebuilds. No imperative call needed.

**Watch out for**: if you mutate `panelSlot` object in place (e.g., `panelSlot.value.groupName = 'X'`), Vue may not detect the change. Replace with a new object: `panelSlot.value = { ...panelSlot.value, groupName: 'X' }`.

### 5.7 Idempotent destroy

V3 `tpl.destroy()` remains idempotent (calling twice is safe). However, V3 SFCs auto-destroy on unmount via `onScopeDispose`. Manual `destroy()` in your `onBeforeUnmount` is **redundant** when using `<HiprintDesigner>` — keep it only for the Option-B wrapper composable path.

### 5.8 `defaultElementTypeProvider` still requires `new`

```ts
// ✅ Correct (V1 + V3)
hiprint.init({ providers: [new defaultElementTypeProvider()] })

// ❌ Wrong — class not instantiated
hiprint.init({ providers: [defaultElementTypeProvider] })
```

Despite V3's reactive surface, the provider is still a class (Vue plugin convention).

---

## 6. Estimated effort

Single business consumer (vue-admin-main Print Template module):

| File | Lines changed | Difficulty | Est. time |
|---|---|---|---|
| `composables/useHiprintRuntime.ts` | ~20 | Low | 30 min |
| `composables/useHiprintDesigner.ts` | ~80 | Medium | 2 hours |
| `composables/usePrintService.ts` | ~60 | Medium | 1.5 hours |
| `components/DesignerHiprint.vue` | ~120 | Medium | 3 hours |
| Smoke testing (browser print, silent print, save, preview, dialog) | — | Low | 1 hour |
| **Total** | **~280 lines** | **Medium** | **≈ 1 dev-day** |

**Risk factors that could extend the estimate**:
- Custom `renderExtra` buttons with non-trivial state — slot migration may need new sub-components.
- Multiple designer instances on one page — verify isolation.
- Custom element-type providers extending `defaultElementTypeProvider` — confirm the base class API hasn't changed (it hasn't, but verify in your fork).

---

## 7. Rollback plan

If you must roll back from V3 to V1 mid-migration:

1. Revert the 4 files via `git revert`.
2. Reinstall V1 tgz: `npm install ./vue-plugin-hiprint-1.x.tgz`.
3. Verify smoke test (browser DevTools): designer mounts, save button works, dialog opens.

**V3 and V1 are not co-installable** — they share the same package name. Branch your migration and merge atomically.

---

## 8. Support

- **V3 reference**: `docs/API-REFERENCE.md`, `docs/CODE-BLUEPRINT.md`
- **V3 smoke test**: `docs/SMOKE-TEST-V3.md`
- **ADRs**: `docs/adr/` (in particular ADR-0011 for V1-quirk-preservation decisions)
- **Issues**: file in this repo with label `v3-migration`
