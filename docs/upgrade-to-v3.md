# Upgrade to V3 — vue-plugin-hiprint v2.0.0

> **Audience**: All consumers currently on `vue-plugin-hiprint@1.x` (V1 imperative jQuery API). Primary reference target: `vue-admin-main` Print Template module.
>
> **Status**: V3 is a major rewrite. The V1 surface is preserved through a **compat layer** (Option A below — drop-in, zero code change for most consumers). New code is strongly encouraged to use the reactive V3 API (Option B).
>
> **Decision references**: ADR-0011 (V3 modern architecture), ADR-0024..0029 (V1 quirks rollup).

---

## TL;DR

1. **Most code keeps working unchanged.** `new hiprint.PrintTemplate({...}).design('#container')` still works — the V3 compat layer ports 40/67 V1 PrintTemplate methods (≈60%) and 68/76 V1 buildToolbar opts (≈89%).
2. **Replace V1/V2 imports with V3 equivalents.** Most APIs stay the same shape.
3. **Read [§4 Behavior Changes](#4-behavior-changes-read-before-upgrading) if you rely on V1 muscle-memory quirks.** Six V1 quirks were decisively resolved in Sprint 22d (see ADRs 0024–0029).
4. **No jQuery in V3.** The 14905-line `hiprint.bundle.js` is gone. jQuery now lives **only** inside the compat layer for back-compat and can be tree-shaken away if you choose Option B.
5. **2078 unit tests across 139 files + 19 Playwright e2e specs** guard the new surface.

---

## What's New in V3

- **Vue 3 + TypeScript strict + Pinia + Zod + interact.js** stack.
- Reactive composables (`useHiprintDesigner`, `useTemplateManager`, `useHiprintPrint`, `useHiprintSocket`, `useHiprintCanvas`, `useHiprintRuntime`) replace imperative `toolbarCtrl` calls.
- 8 V1-absent toolbar features (PDF / Undo / Redo / RemovePanel / Grid / Ruler / Bring-to-front / Send-to-back / Lock / Unlock) available behind `show…` opts (default off — toolbar shape stays V1-faithful).
- 27 V1 factory presets restored on `defaultElementTypeProvider` (url / price / sku / senderInfo / receiverInfo / totalAmount / orderNo / orderDate / currentDate / signature / signatureImage / seal / trackingNo / etc.).
- New UX features V1 never had: user-drawn guide lines (drag from ruler), smart guides (snap to other elements, Alt to disable), element-list panel (☰ with hide/lock/drag-reorder per element), live cross-hairs + size readout during drag/resize, page-number badge on multi-panel docs.
- **6 V1 quirks resolved** (industry-standard): empty-canvas click always deselects, Tab cycles selection, arrow keys nudge 1pt (Shift = 10pt), Shift+resize **locks** aspect ratio, Ctrl+Z in `<input>` goes to browser native undo. See [§4.1](#41-resolved-v1-quirks-v3-industry-standard).
- **Quirks intentionally preserved** for V1 fidelity: per-keypress history push, `rowsColumnsMerge` via `display:none`, `<td>` inside `<thead>`, `tableCustom` throws "已移除", and more. See [§4.2](#42-preserved-v1-quirks-intentional-fidelity).

---

## Table of contents

- [§1. Installation](#1-installation)
- [§2. Migration options](#2-migration-options)
  - [§2.1 Option A — drop-in compat layer (zero code change)](#21-option-a--drop-in-compat-layer-zero-code-change)
  - [§2.2 Option B — V3 reactive (recommended for new code)](#22-option-b--v3-reactive-recommended-for-new-code)
  - [§2.3 Option C — hybrid (keep V1 templates, use V3 designer)](#23-option-c--hybrid-keep-v1-templates-use-v3-designer)
- [§3. Migration examples — vue-admin-main composables](#3-migration-examples--vue-admin-main-composables)
- [§4. Behavior changes (read before upgrading)](#4-behavior-changes-read-before-upgrading)
- [§5. Toolbar changes](#5-toolbar-changes)
- [§6. CSS changes](#6-css-changes)
- [§7. New features (V1 didn't have)](#7-new-features-v1-didnt-have)
- [§8. API reference summary](#8-api-reference-summary)
- [§9. Per-version changelog](#9-per-version-changelog)
- [§10. Migration checklist for vue-admin-main devs](#10-migration-checklist-for-vue-admin-main-devs)
- [§11. Common pitfalls](#11-common-pitfalls)
- [§12. Estimated effort](#12-estimated-effort)
- [§13. Rollback plan](#13-rollback-plan)
- [§14. Support](#14-support)

---

## 1. Installation

### npm / yarn / pnpm

```bash
npm install vue-plugin-hiprint@2.0.0
# or
yarn add vue-plugin-hiprint@2.0.0
# or
pnpm add vue-plugin-hiprint@2.0.0
```

### Internal tarball distribution

If your team consumes the package via the fixed-name tarball:

```bash
# package.json
"dependencies": {
  "vue-plugin-hiprint": "file:./vendor/vue-plugin-hiprint.tgz"
}
```

The tarball internal `package.json` `version` is `2.0.0`. The filename itself remains fixed (`vue-plugin-hiprint.tgz`) per ADR-0006.

### Required CSS

```html
<!-- print-time stylesheet (still required) -->
<link
  rel="stylesheet"
  type="text/css"
  media="print"
  href="/print-lock.css"
/>
```

Or, in ES modules:

```ts
import 'vue-plugin-hiprint/dist/print-lock.css'
```

### Entry points

`package.json` `exports` exposes three subpaths:

| Subpath | Use when |
|---|---|
| `vue-plugin-hiprint` (default) | V1 compat layer — drop-in for existing `import { hiprint, ... }` callers |
| `vue-plugin-hiprint/v3` | V3 reactive API — composables + SFCs, recommended for new code |
| `vue-plugin-hiprint/v2` | V2 ES-module split (deprecated — use V3) |

Type declarations (`vue-plugin-hiprint.v3.d.ts`) are bundled with the `v3` subpath.

---

## 2. Migration options

### 2.1 Option A — drop-in compat layer (zero code change)

If your code looks like:

```ts
import { hiprint, defaultElementTypeProvider } from 'vue-plugin-hiprint'

hiprint.init({ providers: [new defaultElementTypeProvider()] })

const tpl = new hiprint.PrintTemplate({ template: {}, history: true })
tpl.design('#designer')
tpl.update(json)
tpl.print(data)
```

…it continues to work in V3 with **no source changes**. Update `package.json` only.

#### What the compat layer covers

| V1 surface | V3 compat coverage |
|---|---|
| `PrintTemplate` class methods | **40 / 67 (≈60%)** — see [`src/hiprint-v3/compat/print-template.ts`](../src/hiprint-v3/compat/print-template.ts) |
| `buildToolbar` opts | **68 / 76 (≈89%)** — see [`src/hiprint-v3/compat/build-toolbar.ts`](../src/hiprint-v3/compat/build-toolbar.ts) |
| `toolbarCtrl` imperative methods | **21 / 42 (50%)** — most-used ones (`setButtonText`, `addToolbarButton`, `getScale`, `setActivePanel`, etc.) |
| `hiprint.init` / `setDynamicFields` / `setElementTypeGroups` / `addPrintElementTypes` / `removePrintElementTypes` | 100% |
| `autoConnect` / `disAutoConnect` | 100% |
| `window.hiwebSocket.opened` / `.printerList` | Preserved (V1 quirk per ADR-0011 #12) |
| `defaultElementTypeProvider` with 27 V1 presets | 100% |
| `hiPrintPlugin` Vue plugin (`app.use(hiPrintPlugin)`) | 100% — installs `$hiPrint`, `$print`, `$print2` globals |
| `PrintTemplate.destroy()` idempotency | 100% (PM-005) |

#### What the compat layer drops

- **27 toolbar methods** that no business code in vue-admin-main calls (`getButtons` introspection, etc.) — file an issue if you need one of these.
- **27 PrintTemplate methods** mostly internal-only (e.g., `tpl._internalRenderRow`, `tpl._scheduleRepaint`). These were never documented.

---

### 2.2 Option B — V3 reactive (recommended for new code)

Use the SFC + composables. **No `toolbarCtrl`, no global `hiprint.setConfig`, no imperative DOM.**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  HiprintDesigner,
  useHiprintRuntime,
  defaultElementTypeProvider,
  type TemplateJson,
} from 'vue-plugin-hiprint/v3'

useHiprintRuntime({
  providers: [new defaultElementTypeProvider()],
  autoInit: true,
})

const templateJson = ref<TemplateJson>({
  panels: [{ width: 210, height: 297, paperType: 'A4', printElements: [] }],
})

const handleReady = (tpl) => { /* tpl is the live PrintTemplate-compat */ }
const handleSave  = (json, name) => { /* persist */ }
const handlePrint = (json)       => { /* send to printer */ }
</script>

<template>
  <HiprintDesigner
    :template="templateJson"
    :history="true"
    :left-width="220"
    :right-width="320"
    :show-undo="true"
    :show-redo="true"
    @ready="handleReady"
    @save="handleSave"
    @print="handlePrint"
  >
    <template #toolbar-extra-start>
      <button class="hi-btn" @click="openTemplateDialog">选择模版</button>
    </template>
  </HiprintDesigner>
</template>
```

#### Composables

| Composable | Purpose |
|---|---|
| `useHiprintRuntime({ providers, host, token, lang, autoInit })` | Initialise the global element-type registry + socket settings. Idempotent. |
| `useHiprintDesigner({ container, history, initialTemplate })` | Designer lifecycle — returns `{ isReady, currentTemplate, loadTemplate, getJson, clear, undo, redo, destroy }`. |
| `useHiprintTemplate({ template, settingContainer, history })` | Standalone `PrintTemplate` wrapper with reactive state + auto-cleanup. |
| `useHiprintCanvas()` | Pinia canvas store accessor — `panels`, `selectedElementIds`, `activePanelId`, mutation actions. |
| `useHiprintPrint()` | `print(data, opts)` / `preview(data)` / `toPdf(data, fileName)` strategy entry. |
| `useHiprintSocket({ host, autoConnect })` | Reactive socket — `connected: Ref<boolean>`, `printers: Ref<PrinterInfo[]>`. |

#### SFCs

| Component | Replaces |
|---|---|
| `<HiprintDesigner>` | `hiprint.buildDesigner(...)` |
| `<HiprintToolbar>` | `hiprint.buildToolbar(...)` standalone |
| `<HiprintCanvas>` | n/a (V3 only) |
| `<HiprintPanel>` | n/a (V3 only) |
| `<HiprintPropertyPanel>` | The right-side property pane (was hard-coded inside designer) |
| `<HiprintElementList>` | n/a — left-side element picker |
| `<HiprintElementListPanel>` | n/a — collapsible ☰ panel with per-element hide/lock |
| `<HiprintPreview>` | `tpl.getHtml()` preview iframe |
| `<TemplateDialog>` | `toolbarCtrl.openTemplateDialog()` |
| `<BusinessDataDialog>` | `toolbarCtrl.openBusinessDialog()` |
| `<SaveDialog>` | `toolbarCtrl.triggerSave(...)` |
| `<CustomPaperPopover>` | The custom-paper popover (was inline) |

---

### 2.3 Option C — hybrid (keep V1 templates, use V3 designer)

V1 templates (the JSON shape with `panels[]` / `printElements[]` / `options{}`) load **unchanged** into V3:

```ts
import { HiprintDesigner } from 'vue-plugin-hiprint/v3'

// Existing V1 JSON from your database — no transformation needed.
const oldTemplate = JSON.parse(record.template_json)

// V3 normalises via templateStore.loadFromJson() — accepts the V1 superset.
```

This is the easiest incremental migration path: replace the designer chrome first, keep the data pipeline.

---

## 3. Migration examples — vue-admin-main composables

The vue-admin-main Print Template module has **4 files** touching the hiprint API. Each has a **Before** (V1) and **After** (V3) block.

### 3.1 `useHiprintRuntime.ts`

The smallest diff — `hiprint.init` signature is unchanged.

#### Before (V1)

```ts
import { hiprint, defaultElementTypeProvider } from 'vue-plugin-hiprint'

let initialized = false

export const ensureHiprintRuntime = (): void => {
  if (initialized) return
  hiprint.init({
    providers: [new defaultElementTypeProvider()],
    lang: 'cn',
  })
  initialized = true
}
```

#### After (V3)

```ts
import { useHiprintRuntime, defaultElementTypeProvider } from 'vue-plugin-hiprint/v3'

// V3: composable manages init idempotency via globalThis cache (HMR-safe)
export const ensureHiprintRuntime = (): void => {
  useHiprintRuntime({
    providers: [new defaultElementTypeProvider()],
    lang: 'cn',
    autoInit: true,    // V3 flag: init once on first call, no-op thereafter
  })
}
```

**Notes**:

- `useHiprintRuntime` is itself idempotent — the local `initialized` flag is no longer needed (V3 caches the singleton on `globalThis.__hiprint_runtime__`).
- Calling `useHiprintRuntime()` from any composable (not just `setup`) is safe because `autoInit: true` bypasses Vue scope requirements.
- HMR re-import yields the same instance — no double-init.

---

### 3.2 `useHiprintDesigner.ts`

The **largest migration**. The V1 version manually instantiates `new hiprint.PrintTemplate({...})` and calls `template.design(container.value)`.

#### Option A — keep using V1 compat (zero code change)

If you do nothing, your existing code works because `new hiprint.PrintTemplate({...}).design(container)` is preserved via the V1 compat path. Use this if you can't budget the migration now.

#### Option B — replace with V3 composable

Delete your wrapper and call V3's `useHiprintDesigner` directly:

```ts
import { useHiprintDesigner } from 'vue-plugin-hiprint/v3'

const designer = useHiprintDesigner({
  container: designerRootRef,
  history: true,
  initialTemplate: props.templateData ?? {},
})

const { isReady, currentTemplate, loadTemplate, getJson, clear, undo, redo, destroy } = designer
```

The V3 composable provides the **same return shape** as your existing wrapper, so callers need no further changes.

#### Option C — keep the wrapper, swap internals

```ts
import {
  useHiprintRuntime,
  useHiprintTemplate,
  defaultElementTypeProvider,
} from 'vue-plugin-hiprint/v3'

export function useHiprintDesigner(options: UseHiprintDesignerOptions) {
  const { container, providers } = options
  const isReady = ref(false)
  const currentTemplate = shallowRef<any | null>(null)

  async function init(): Promise<void> {
    useHiprintRuntime({
      providers: providers ?? [new defaultElementTypeProvider()],
      autoInit: true,
    })

    // V3: useHiprintTemplate wraps PrintTemplate with reactive state + auto-cleanup
    const tpl = useHiprintTemplate({
      template: {},
      settingContainer: '.hiprint-setting-container',
      history: true,
    })

    tpl.design(container.value)
    currentTemplate.value = tpl
    isReady.value = true
  }

  return { isReady, currentTemplate, init /* + loadTemplate / getJson / clear / undo / redo / destroy */ }
}
```

**Key invariants preserved**:

- `template.design(container.value)` still accepts a DOM element (not a selector).
- `settingContainer` still expects a **CSS selector string** (not a DOM element).
- `history: true` still enables undo/redo.
- `destroy()` is still idempotent (PM-005).

---

### 3.3 `usePrintService.ts`

Strategy pattern wrapping `tpl.print()` / `tpl.print2()`. V3 retains all V1 print methods, so the migration is **minimal**.

#### Before (V1)

```ts
import { hiprint, autoConnect, disAutoConnect } from 'vue-plugin-hiprint'

export class BrowserPrintStrategy {
  async print(templateData, printData, options) {
    if (!templateData) throw new Error('请先加载模板')
    ensureHiprintRuntime()
    const tpl = new hiprint.PrintTemplate()
    tpl.update(templateData)
    tpl.print(printData, options || {})
  }
}
```

#### After (V3)

```ts
import {
  useHiprintPrint,
  useHiprintSocket,
  PrintTemplate,     // V3 compat: same class, same methods
} from 'vue-plugin-hiprint/v3'

export class BrowserPrintStrategy {
  async print(templateData, printData, options) {
    if (!templateData) throw new Error('请先加载模板')
    ensureHiprintRuntime()

    const tpl = new PrintTemplate()       // V3 compat: same V1 API
    tpl.update(templateData)
    tpl.print(printData, options || {})
  }
}

export class SilentPrintStrategy {
  private socket = useHiprintSocket({ host: this.socketUrl, autoConnect: false })

  async connect(): Promise<boolean> {
    return this.socket.connect()       // returns Promise<boolean>
  }

  disconnect(): void {
    this.socket.disconnect()
  }

  async print(templateData, printData, options) {
    if (!this.socket.connected.value) {
      throw new Error('未连接到打印客户端')
    }
    const tpl = new PrintTemplate()
    tpl.update(templateData)
    tpl.print2(printData, { printer: options?.printer || '', title: '静默打印任务' })
  }

  async getPrinterList(): Promise<PrinterInfo[]> {
    return this.socket.printers.value
  }
}
```

**Notes**:

- `window.hiwebSocket.opened` access still works (preserved as a V1 quirk), but prefer the reactive `socket.connected` ref.
- The hard-coded 5-second connect timeout in V1 code is no longer needed — `socket.connect()` resolves/rejects on its own with a built-in timeout.

---

### 3.4 `DesignerHiprint.vue`

The largest user-facing file. It currently calls `hiprint.buildDesigner('#xxx', { toolbarOptions, onReady, componentPanelSlot })`.

#### Option A — keep V1 compat (no rewrite)

`hiprint.buildDesigner(...)` is preserved in the V3 compat layer. Existing call sites work unchanged.

#### Option B — migrate to `<HiprintDesigner>` SFC

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
      <template #toolbar-extra-start>
        <button class="hi-btn" @click="openTemplateDialog">选择模版</button>
      </template>
    </HiprintDesigner>

    <TemplateDialog
      v-model:open="templateDialogVisible"
      :loading="templateDialogLoading"
      :items="templateDialogTemplates"
      :active-id="activeTemplateId"
      @refresh="refreshTemplateDialog"
      @select="handleTemplateDialogSelect"
      @preview="handleTemplateDialogPreview"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, shallowRef } from 'vue'
import {
  HiprintDesigner,
  TemplateDialog,
} from 'vue-plugin-hiprint/v3'
import { ensureHiprintRuntime } from '../composables/useHiprintRuntime'

const designerRootRef = ref<HTMLElement | null>(null)
const templateInstance = shallowRef<any>(null)
const templateDialogVisible = ref(false)
const templateDialogLoading = ref(false)
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

const handleReady = (tpl) => { templateInstance.value = tpl }
const openTemplateDialog = async () => {
  templateDialogVisible.value = true
  await refreshTemplateDialog()
}

onMounted(() => ensureHiprintRuntime())
</script>
```

#### Toolbar customisation mapping

| V1 `toolbarOptions.*` field | V3 equivalent |
|---|---|
| `showTemplateSelect: false` | `<HiprintDesigner :show-template-select="false">` |
| `showSave: true` (default) | `<HiprintDesigner :show-save>` |
| `showPrint: false` | `<HiprintDesigner :show-print="false">` |
| `showPreview: false` | `<HiprintDesigner :show-preview="false">` |
| `showUndo / showRedo / showClear` | Same prop names, default `false` (Sprint 22d kept V1 toolbar shape) |
| `renderExtra(api)` callback | `<template #toolbar-extra-start>` / `#toolbar-extra-end` slots |
| `buttonLabels: { undo: '撤销' }` | `<HiprintDesigner :button-label="{ undo: '撤销' }">` |
| `onSave(tpl, json, evt, api, ctx)` callback | `@save="(json, name) => …"` event (signature simplified) |
| `onPrint(tpl)` callback | `@print="(json) => …"` event |
| `onPreview(tpl)` callback | `@preview="(json) => …"` event |
| `onClear(tpl)` callback | `@clear="(tpl) => …"` event |
| `onReady(tpl, toolbarCtrl)` callback | `@ready="(tpl) => …"` event (single arg — see §11.5) |

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

## 4. Behavior changes (read before upgrading)

This is the critical section. Six V1 quirks were resolved in Sprint 22d toward industry-standard behaviour. Several other quirks were **kept** for V1 fidelity. Audit your code for muscle memory before upgrading.

### 4.1 Resolved V1 quirks (V3 industry-standard)

These changes break **muscle memory** but no documented behaviour. Industry-standard tools (Figma, Sketch, Illustrator, Photoshop) all behave the V3 way.

| # | Change | V1 | V3 | ADR |
|---|---|---|---|---|
| 1 | Empty-canvas click | Only deselects when canvas has < 2 elements | **Always deselects** | [ADR-0024](adr/0024-empty-canvas-click-deselect.md) |
| 2 | Tab key | Lets browser default move focus out of canvas | **Cycles element selection**; Shift+Tab reverses | [ADR-0025](adr/0025-tab-key-cycles-selection.md) |
| 3 | Arrow nudge step | Always 1.5pt; Shift modifier ignored | **1pt**; **Shift+arrow = 10pt** | [ADR-0026](adr/0026-arrow-nudge-step-v3.md) |
| 4 | Shift+resize | Shift **breaks** the default aspect-ratio lock | Shift **locks** aspect ratio (V1 reversed) | [ADR-0027](adr/0027-shift-resize-aspect-lock.md) |
| 5 | Ctrl+Z in `<input>` | Triggers template undo (overrides browser native) | **Goes to browser native undo** of input.value | [ADR-0028](adr/0028-ctrl-z-input-guard.md) |
| 6 | (rollup) | Aggregated decision for the 150+ V1 quirks not individually ADR-ed | See [ADR-0029](adr/0029-quirks-rollup-decision-index.md) | ADR-0029 |

For each item above, the migration cost is **zero** — V3 behaviour is more intuitive. The mitigation column in each ADR documents how to opt back to V1 if a real business consumer reports a regression (none expected based on internal review).

### 4.2 Preserved V1 quirks (intentional fidelity)

These V1 behaviours have documented business consumer dependencies or are intentional quirks that downstream code relies on. They are **kept** identical to V1.

| Quirk | Behaviour | Status |
|---|---|---|
| Resize handle count per etype | hline = 2 handles, vline = 2, rect/oval = 4 (no top edge), image = 5 (corners + rotate), html = 8 | Preserved ([TKT-163](V3-PARITY-JIRA.md#tkt-163--resize-handles-count-per-etype-v1-quirks)) |
| Per-keypress history push during arrow nudge | Each arrow key press snapshots history; 50-cap fills fast | Preserved by design (Sprint 22b BA) |
| `rowsColumnsMerge` table cell merge | Merged cells use `display:none` (V3) — V1 also did, NOT cell omission | Preserved (Sprint 22b BB) |
| `<td>` inside `<thead>` instead of `<th>` | V1 quirk P.7 | Preserved (Sprint 22b BB) |
| `tableCustom` etype name | Throws "已移除"; use `'table'` | Preserved ([TKT-010](V3-PARITY-JIRA.md#tkt-010), V1 line 10737) |
| `defaultModule.html` `v-html` rendering | Field-bound HTML rendered raw (V1 behaviour) | Preserved + new opt-in escape mode ([TKT-007](V3-PARITY-JIRA.md#tkt-007)) |
| `shape.field` serialised but no-op | V1 quirk — shapes can carry a `field` but don't bind | Preserved |
| `longText` binary-search pagination | V1 9757-9931 algorithm | Reproduced in `internal/long-text-paginate.ts` ([TKT-026](V3-PARITY-JIRA.md#tkt-026)) |
| `barcode` title-prefix CODE128 corruption | V1 J.5 quirk | Worked around via `hideTitle` inverse |
| `barAutoWidth` string-vs-boolean trap | V1 J.23 quirk | Centralised through `isTrue()` helper |

For the complete list of 150+ documented V1 quirks see [`docs/V1-INVENTORY/`](V1-INVENTORY/) (8907 lines).

### 4.3 Property-panel key alignment fixes (V3 → V1)

Sprint 22a-r and 22b fixed silent property-panel data drift. If your code reads/writes element JSON directly, no change is required — V1 key names are now the canonical V3 keys.

| Element | Field | V3 (Sprint 22a, now fixed) | V1 / V3 canonical |
|---|---|---|---|
| Shape (rect/oval/hline/vline) | Border width / colour / style / fill | `strokeWidth` / `strokeColor` / `strokeStyle` / `fillColor` | `borderWidth` / `borderColor` / `borderStyle` / `backgroundColor` |
| Barcode | Type | `format` (uppercase) | `barcodeType` (lowercase) |
| Barcode | Display | `displayValue` (inverted) | `hideTitle` |
| Barcode | Colour | `lineColor` | `barColor` |
| Qrcode | Error level | `errorCorrectionLevel: 'L'` | `qrCodeLevel: int` (0=M,1=L,2=H,3=Q) |
| Image | Fit | `objectFit` | `fit` |
| Image | Rotation | `transform` (drifted) | `transform` (canonical) |

All of these were silent corruption paths. If you depended on the V3 (Sprint 22a) names by mistake, update to the V1 keys — they are now the only supported names.

### 4.4 Table feature rollback (Sprint 22a-r TKT-009)

These TablePropertyPanel fields existed in Sprint 22a but **not in V1**. They have been **removed** because writes were dead letters:

- `rowsPerPage` — never read by renderer
- `maxPage` — never read by renderer
- `alternateRowColor` — never read by renderer
- `footer` raw HTML textarea — replaced with `footerFormatter` (string-source function compile)

If your code wrote any of these fields, the writes were lost. There is nothing to migrate, but you may want to remove them from your code to avoid confusion.

---

## 5. Toolbar changes

### 5.1 Buttons removed from toolbar

These buttons existed on the toolbar in Sprint 22a but V1 had them in the **element context menu** instead. Sprint 22d (TKT-158) moved them back to the context menu to match V1:

- **Align Left / Right / Top / Bottom / HorizontalCenter / VerticalCenter** — right-click the canvas / selection
- **Distribute Horizontal / Vertical** — right-click the canvas / selection
- The **pagination bar** (`< Page X / Y >`) — removed entirely (V1 never had it; use the panel manager dropdown instead)

### 5.2 Buttons V3 keeps that V1 didn't have

These 8 buttons live behind `show…` opts that **default to `false`** so the default toolbar shape matches V1. Toggle them on if you want them:

| Button | Opt | Default |
|---|---|---|
| PDF export | `showPdf` | `false` |
| Undo | `showUndo` | `false` |
| Redo | `showRedo` | `false` |
| Remove Panel | `showRemovePanel` | `false` |
| Grid toggle | `showGrid` | `false` |
| Ruler toggle | `showRuler` | `false` |
| Bring-to-front | `showBringToFront` | `false` |
| Send-to-back | `showSendToBack` | `false` |
| Lock | `showLock` | `false` |
| Unlock | `showUnlock` | `false` |

Example: enable Undo + Redo:

```vue
<HiprintDesigner :show-undo="true" :show-redo="true" />
```

### 5.3 27 V1 factory presets restored

`defaultElementTypeProvider` now exposes the full V1 module presets:

```
defaultModule.url               defaultModule.price            defaultModule.sku
defaultModule.senderInfo        defaultModule.receiverInfo     defaultModule.totalAmount
defaultModule.orderNo           defaultModule.orderDate        defaultModule.currentDate
defaultModule.signature         defaultModule.signatureImage   defaultModule.seal
defaultModule.trackingNo        defaultModule.barcode          defaultModule.qrcode
defaultModule.text              defaultModule.longText         defaultModule.image
defaultModule.html              defaultModule.hline            defaultModule.vline
defaultModule.rect              defaultModule.oval             defaultModule.table
… (and 4 more)
```

The default barcode/qrcode presets were a Sprint 22a critical bug (Path A vs Path B mismatch — see [TKT-008](V3-PARITY-JIRA.md#tkt-008)). They now correctly emit Path B shape (`type: 'barcode'`) and render via bwip-js.

### 5.4 Paper-type list

The default paper-type table is back to V1 exact dimensions (V1 stored these in mm):

| Name | Width (mm) | Height (mm) |
|---|---|---|
| A3 | 420 | 296.6 |
| A4 | 210 | 296.6 |
| A5 | 210 | 147.6 |
| B3 | 500 | 352.6 |
| B4 | 250 | 352.6 |
| B5 | 250 | 175.6 |

Sprint 22a introduced 3 paper-list bugs (B3 missing, A3/A5/B5 width/height swapped, fractional mm rounded) — all fixed in Sprint 22a-r ([TKT-011](V3-PARITY-JIRA.md#tkt-011)).

You can supplement at runtime:

```ts
import { PAPER_TYPES } from 'vue-plugin-hiprint/v3'
PAPER_TYPES['Letter'] = { width: 215.9, height: 279.4 }
```

---

## 6. CSS changes

### 6.1 Class-name bridging (BEM ↔ V1 legacy)

V3 emits **both** class-name styles simultaneously:

| State | V1 legacy class (V1, V3 emits) | V3 BEM class (V3 emits) |
|---|---|---|
| Selected element | `.selected` | `.is-selected` |
| Active panel | `.active` | `.is-active` |
| Editing inline | `.editing` | `.is-editing` |
| Locked element | `.locked` | `.is-locked` |
| Hidden in print | `.alwaysHide` | `.is-print-hidden` |

This means existing CSS overrides keyed off `.selected`, `.locked`, etc., continue to work without change. Prefer the BEM names in new CSS.

See [TKT-250](V3-PARITY-JIRA.md#tkt-250--状态-class-双向-sync-v3-bem--v1-legacy) for the full bridge spec.

### 6.2 Color palette

The default colour palette migrated from Material to Ant Design:

| Token | V1 | V3 default |
|---|---|---|
| Primary | `#2196f3` | `#1677ff` |
| Success | `#4caf50` | `#52c41a` |
| Warning | `#ff9800` | `#faad14` |
| Error / danger | `#f44336` | `#ff4d4f` |

To **revert** to the V1 palette globally:

```ts
// In your app entry, before mounting:
import 'vue-plugin-hiprint/v3/themes/v1.css'
```

…or pass a theme prop:

```vue
<HiprintDesigner theme="v1" />
```

See [TKT-252](V3-PARITY-JIRA.md#tkt-252--color-palette-v1-兼容选项).

### 6.3 CSS variables / design tokens

Hard-coded hex colours have been promoted to CSS custom properties on the designer root. Override in your app stylesheet:

```css
.hiprint-designer {
  --hiprint-color-primary: #1677ff;
  --hiprint-color-success: #52c41a;
  --hiprint-color-border: #d9d9d9;
  --hiprint-radius-sm: 4px;
  --hiprint-radius-md: 6px;
  --hiprint-shadow-elevation-1: 0 2px 8px rgba(0, 0, 0, 0.06);
  /* … */
}
```

See [TKT-251](V3-PARITY-JIRA.md#tkt-251--css-variables-推广--主题-token).

### 6.4 `print-lock.css`

V3 emits the same `print-lock.css` artifact V1 did. Import it via the package exports:

```ts
import 'vue-plugin-hiprint/dist/print-lock.css'
// or, the explicit path from package.json exports map:
import 'vue-plugin-hiprint/print-lock.css'
```

The CSS source itself is byte-identical to V1 — `print-lock.css` is **not** part of the V3 rewrite.

### 6.5 Context menu z-index

V3 context menu (`@floating-ui/vue` portal) renders at `z-index: 10000` (V1 parity) so it overlays Ant Design `<Modal>` correctly. If your app has a higher-z-index overlay, set:

```css
.hiprint-context-menu { z-index: 100000; }
```

See [TKT-253](V3-PARITY-JIRA.md#tkt-253--context-menu-z-index-提高到-10000v1-parity).

### 6.6 Dialog wrap class

V3 dialogs (`<TemplateDialog>`, `<BusinessDataDialog>`, `<SaveDialog>`) render through Ant Design `<Modal>` but emit the V1 wrap class names (`.hiprint-toolbar-business-dialog-wrap`, `.hiprint-toolbar-template-dialog-wrap`, `.hiprint-toolbar-save-dialog-wrap`) so V1 CSS overrides remain selectable.

See [TKT-255](V3-PARITY-JIRA.md#tkt-255--dialog-wrap-class-v1-兼容business--template--save-dialog).

---

## 7. New features (V1 didn't have)

These features are **additive** — they don't break any V1 behaviour.

### 7.1 Element list panel (☰)

A new collapsible left-side panel showing **every** element in the current panel with:

- Per-element **hide** toggle (V1 had `alwaysHide` in JSON but no UI)
- Per-element **lock** toggle (V1 had `lock` in JSON but no UI)
- Per-element **etype colour tag** (e.g., red for text, green for image)
- **Drag-reorder** within the panel
- **Click** to select on canvas with auto-scroll-into-view

Component: `<HiprintElementListPanel>`. Toggle via the toolbar ☰ button. See [TKT-101](V3-PARITY-JIRA.md#tkt-101--element-list-panel--整体-p1-大功能).

### 7.2 User-drawn guide lines

Drag from the top or left ruler onto the canvas to drop a horizontal or vertical guide line. Drag a guide back into the ruler to delete it. Elements snap to guides during drag/resize (within 4px).

See [TKT-102](V3-PARITY-JIRA.md#tkt-102--用户画的-guide-lines-参考线).

### 7.3 Smart guides (snap to other elements)

During drag, V3 detects nearest-neighbour edges/centres of all other elements and snaps within 4px. Visualised by red dashed lines. **Hold Alt** to disable snapping for free-hand placement.

See [TKT-103](V3-PARITY-JIRA.md#tkt-103--smart-guides-snap-to-other-elements-18-case).

### 7.4 Cross-hair overlay + size readout

During drag/resize, V3 shows:

- Position cross-hairs (vertical + horizontal dashed lines through the element's centre)
- Size readout chip near the element showing `WxH` in current units

See [TKT-104](V3-PARITY-JIRA.md#tkt-104--position-cross-hairs--size-readout-overlay-during-dragresize).

### 7.5 Static visible resize handles

Selected elements show **8 visible dots** (per etype quirk count — see [§4.2](#42-preserved-v1-quirks-intentional-fidelity)) plus a **delete button** in the top-right corner. V1 only showed resize cursors on hover.

See [TKT-152](V3-PARITY-JIRA.md#tkt-152--resize-handles-可见-size-box--cross-hairs).

### 7.6 Paper page-number badge

Multi-panel documents show a small `.hiprint-paperNumber` badge in the top-right of each panel. Disabled panels show `.hiprint-paperNumber.disabled`.

See [TKT-153](V3-PARITY-JIRA.md#tkt-153--paper-page-number-badge).

### 7.7 Multi-layer table headers UI

V1 supported 2-D `columns[][]` for multi-layer thead but had no UI to edit. V3 adds:

- Right-click thead → "merge cells" / "split cells"
- Right-click thead → "add row above/below"
- Drag column boundary to resize
- Drag column header to reorder

See [TKT-105 / 106 / 107 / 155](V3-PARITY-JIRA.md#tkt-105--multi-layer-column-header-support-table).

### 7.8 Property panels with high V1 coverage

| Etype | V1 fields | V3 fields exposed | Coverage |
|---|---|---|---|
| Text | 57 | 50 | 88% |
| LongText | 44 | 41 | 93% |
| Image | 22 | 22 | 100% |
| Html | 18 | 18 | 100% |
| Barcode | 9 | 9 | 100% |
| Qrcode | 9 | 9 | 100% |
| Table | 56 + 32 per column | 50 + 32 | ≈90% |
| Shape (rect/oval) | 17 | 17 | 100% |
| Shape (hline/vline) | 18 | 18 | 100% |

See [TKT-108](V3-PARITY-JIRA.md#tkt-108--textpropertypanel--longtextpropertypanel替代-generic-editor) for the Text + LongText work; the rest is Sprint 22a + 22a-r.

### 7.9 `dataType` + `format` conversion pipeline

V3 implements V1's bundled `dataType: 'datetime' | 'boolean'` + `format` string conversion (V1 bundle line 10038-10043). Example:

```json
{ "field": "createdAt", "options": { "dataType": "datetime", "format": "YYYY-MM-DD HH:mm" } }
```

See [TKT-024](V3-PARITY-JIRA.md#tkt-024--datatype-datetime--boolean--format-转换管线).

### 7.10 LongText binary-search pagination

V3 reproduces V1's binary-search pagination algorithm (bundle 9757-9931) in `internal/long-text-paginate.ts`. Long text elements correctly span multiple panels.

See [TKT-026](V3-PARITY-JIRA.md#tkt-026--longtext-binary-search-分页-大功能-v1-旗舰).

### 7.11 `pageBreak / showInPage / unShowInPage / fixed`

V3 print path now honours these JSON fields for multi-page pagination + element visibility filtering.

See [TKT-025](V3-PARITY-JIRA.md#tkt-025--pagebreak--showinpage--unshowinpage--fixed-打印路径过滤).

### 7.12 Auto-snapshot history

V1 only snapshotted history on explicit menu commands. V3 auto-snapshots on:

- drag-drop after mutate
- resize after mutate
- property panel commit
- clipboard cut/paste/cut
- context-menu actions
- arrow nudge (per-keypress, V1 quirk preserved)

This makes Ctrl+Z actually functional. See [TKT-020](V3-PARITY-JIRA.md#tkt-020--history-自动-snapshot-接线-critical--ctrlz-当前实际无效).

### 7.13 Lock semantics fully wired

V1's `options.lock / positionLocked / sizeLocked / draggable` were written to JSON but never enforced. V3 enforces in drag-drop, resize, inline-edit, delete (via keyboard or context menu).

See [TKT-027](V3-PARITY-JIRA.md#tkt-027--lock-semantics-接入-drag-drop--resize--inline-edit--delete).

### 7.14 Sidebar resize / collapse

The left (element list) and right (property panel) sidebars can be resized via a draggable bar and collapsed to a thin edge with the toggle button.

See [TKT-150](V3-PARITY-JIRA.md#tkt-150--sidebar-resize--collapse).

### 7.15 Ruler drag handles

V1 had a hidden ruler-handle for precision positioning. V3 exposes draggable rulers on the top/left for guide-line drop and pixel-level snap.

See [TKT-154](V3-PARITY-JIRA.md#tkt-154--ruler-drag-handles-精确定位).

---

## 8. API reference summary

For the complete API surface, see [`docs/API-REFERENCE.md`](API-REFERENCE.md).

### 8.1 Re-exports retained from V1 (compat path)

| Symbol | Source |
|---|---|
| `hiprint` | `vue-plugin-hiprint` / `vue-plugin-hiprint/v3` |
| `defaultElementTypeProvider` | both |
| `hiPrintPlugin` | both |
| `autoConnect` / `disAutoConnect` | both |
| `PrintTemplate` (class) | both (V3 compat path) |
| `PrintElementTypeManager` / `PrintElementTypeGroup` | both |
| `buildToolbar` / `buildDesigner` (factories) | both |
| `setDynamicFields` / `removeDynamicFields` | both |
| `setElementTypeGroups` / `appendElementTypeGroups` | both |
| `addPrintElementTypes` / `removePrintElementTypes` | both |
| `PAPER_TYPES` | new export (was hidden in V1) |

### 8.2 New symbols (V3 only)

| Symbol | Subpath |
|---|---|
| `useHiprintRuntime` | `vue-plugin-hiprint/v3` |
| `useHiprintDesigner` | `vue-plugin-hiprint/v3` |
| `useHiprintTemplate` | `vue-plugin-hiprint/v3` |
| `useHiprintCanvas` | `vue-plugin-hiprint/v3` |
| `useHiprintPrint` | `vue-plugin-hiprint/v3` |
| `useHiprintSocket` | `vue-plugin-hiprint/v3` |
| `HiprintDesigner` | `vue-plugin-hiprint/v3` (SFC) |
| `HiprintToolbar` | `vue-plugin-hiprint/v3` (SFC) |
| `HiprintCanvas` | `vue-plugin-hiprint/v3` (SFC) |
| `HiprintPanel` | `vue-plugin-hiprint/v3` (SFC) |
| `HiprintPropertyPanel` | `vue-plugin-hiprint/v3` (SFC) |
| `HiprintElementList` | `vue-plugin-hiprint/v3` (SFC) |
| `HiprintElementListPanel` | `vue-plugin-hiprint/v3` (SFC) |
| `HiprintPreview` | `vue-plugin-hiprint/v3` (SFC) |
| `TemplateDialog` / `BusinessDataDialog` / `SaveDialog` | `vue-plugin-hiprint/v3` (SFCs) |
| `CustomPaperPopover` | `vue-plugin-hiprint/v3` (SFC) |

### 8.3 Removed / dropped surface

These were never documented:

- `hiprint._private*` internal helpers — never exported intentionally
- 27 `PrintTemplate` methods marked `_internal*` in V1 source — never callable from JS
- 27 `toolbarCtrl` methods with no business consumer (mostly DOM-mutation helpers) — covered by SFC props

---

## 9. Per-version changelog

### v2.0.0 (next release) — V3 Modern UI

**Architectural rewrite from V1 (jQuery-based bundle.js) to V3 (Vue 3 + Pinia + TypeScript + Zod + interact.js). Compatibility maintained via the `compat/` layer.**

Sprints leading up to v2.0.0:

#### Sprint 22a — Initial V3 toolbar + panel (rolled back by 22a-r)

Introduced toolbar UI, paper/table property panels, and per-etype property panels. **Introduced 12 silent bugs** discovered by V3-PARITY-MATRIX comparison.

#### Sprint 22a-r — Rollback of Sprint 22a bugs (P0)

- Shape property panel key drift fixed (`strokeWidth` → `borderWidth`)
- Barcode property panel 7 of 9 key drifts fixed (lowercase `barcodeType`, `barColor`, `hideTitle`)
- Qrcode property panel key drift fixed (int-index `qrCodeLevel`)
- Image property panel `objectFit` → `fit` drift fixed
- Image rotation `transform` key drift fixed
- Html property panel formatter accepts string source
- Html field-binding XSS escape mode added (opt-in raw via `options.escape=false`)
- Default factory `barcode/qrcode/trackingNo` Path A vs B mismatch resolved
- Table property panel 4 invented fields (`rowsPerPage`, `maxPage`, `alternateRowColor`, `footer` raw HTML) removed
- `tableCustom` etype name throws "已移除" (V1 parity)
- Default paper list 3-bug stack (B3 missing, A3/A5/B5 swap, fractional round) fixed
- Pagination bar removed from toolbar (V1 never had one)

#### Sprint 22b — P0 architectural fixes

- History auto-snapshot wired (Ctrl+Z now functional in interactions)
- Double render path (Vue vs imperative) converged into a single pure `renderTable(opts, data)`
- `formatter` / `styler` string-source `new Function()` compile path added
- `text` element `textType: 'barcode' | 'qrcode'` dispatch added (Path A integration)
- `dataType: datetime / boolean` + `format` conversion pipeline implemented
- `pageBreak / showInPage / unShowInPage / fixed` print path filter added
- LongText binary-search pagination ported from V1 bundle.js 9757-9931
- Lock semantics wired into drag-drop, resize, inline-edit, delete

#### Sprint 22c — P1 architectural backfill (28 tickets)

- `toolbarCtrl` partial restoration (10 most-used methods: `getScale`, `setScale`, `addToolbarButton`, `removeToolbarButton`, `enableButton`, `disableButton`, `setButtonText`, `getActivePanel`, `setActivePanel`, `setPaper`, `rotatePaper`, `bindEvent`, `unbindEvent`, etc.)
- `PrintTemplate` compat method coverage 14 → 40 (21% → 60%): `rotatePaper`, `setPaper`, `alignElements`, `distributeElements`, `zoom`, `addPrintPanel`, `removePrintPanel`, `selectPanel`, `on`/`off`/`emit`, `getElementByTid`, `getActivePanelJson`, `bringToFront`/`sendToBack`/`bringForward`/`sendBackward`, `setElsAlign`, `updateOption`, `lockElement`/`unlockElement`, `copyElement`/`pasteElement`/`cutElement`, `getHistory`/`clearHistory`/`setHistoryCapacity`, `getPaperSize`, `getMaxPanelIndex`, `previewWindow`, `printWindow`, `removePrintElement`, `getOption`/`getAllOptions`
- `buildToolbar` opts coverage 22 → 68 (29% → 89%): all dialog hooks (`templateListProvider`, `businessDataProvider`, `*DialogTitle`, `*ButtonText`), all `on*` callbacks, all `show*` toggles
- Element list panel (☰) with hide/lock/drag-reorder per element
- User-drawn guide lines (drag from ruler)
- Smart guides (snap to other elements, Alt to disable) — 18-case algorithm ported
- Position cross-hairs + size readout overlay during drag/resize
- Multi-layer table headers UI with merge/split cells
- Table column drag-reorder via thead
- Text + LongText property panels (88% / 93% V1 field coverage)

#### Sprint 22d — P2 UX features + V1 quirk decisions (21 tickets, 6 ADRs)

- Sidebar resize + collapse handles
- Static visible resize handles (8 dots) + delete button on selected element
- Paper page-number badge
- Ruler drag handles for precision positioning
- Element-list canvas-selection highlight + auto-scroll
- Per-etype colour tags in element list
- Align/Distribute buttons moved from toolbar back to context menu (V1 parity)
- 13 missing context-menu items per etype (font-12pt, font-bold, z-shift, align, distribute, size-broadcast)
- Inline-edit fullwidth-colon (`：`) parsing + enter/newline/tab sanitisation
- 27 V1 factory presets restored (url / price / sku / senderInfo / receiverInfo / totalAmount / orderNo / orderDate / currentDate / signature / signatureImage / seal / trackingNo / etc.)
- Default sizes per etype aligned to V1
- Resize handle count per etype (hline=2, vline=2, rect/oval=4, image=5+rotate, html=8) restored
- **ADR-0024** Empty-canvas click always deselects (V3 industry-standard)
- **ADR-0025** Tab cycles selection (V3 new feature)
- **ADR-0026** Arrow nudge 1pt + Shift=10pt (V3 industry-standard)
- **ADR-0027** Shift+resize locks aspect ratio (V3 inverted V1)
- **ADR-0028** Ctrl+Z in `<input>` goes to browser native (V3 guard)
- **ADR-0029** Rollup decision index for the 150+ V1 quirks not individually ADR-ed

#### Sprint 22f — Compatibility + theme + CSS state (current sprint)

- BEM ↔ V1 legacy state-class bridge (`.is-selected` + `.selected`, etc.)
- CSS custom-property tokens for theming
- V1 colour-palette opt-in via `theme="v1"` prop or `themes/v1.css` import
- Context menu z-index forced to 10000 (V1 parity)
- Toolbar `<select>` mode as alternative to chip list (`panelManagerMode: 'chips' | 'select'`)
- Dialog wrap class V1 compat (business / template / save dialogs)
- `print-lock.css` exposed via package exports for opt-in import
- This document (TKT-257) rewritten as the current source of truth
- `setup.sh` + `docs/QUICK-START.md` added for new contributors (TKT-266)

### v1.x — V1 (predecessor, deprecated)

`hiprint.bundle.js` 14905-line single-file plugin. Still available on npm via `vue-plugin-hiprint@1.0.3`. See [docs/V1-INVENTORY/](V1-INVENTORY/) for the 8907-line behaviour reference.

---

## 10. Migration checklist for vue-admin-main devs

Tick each before moving on. **Option A consumers can skip steps 4–8.**

- [ ] **1. Install V3**: update `vendor/vue-plugin-hiprint.tgz` to v2.0.0, run `npm install`.
- [ ] **2. Run smoke test on existing code** (Option A): `npm run dev` — verify designer mounts, save button works, dialog opens. **No code changes yet.** This validates the compat layer.
- [ ] **3. If smoke test passes** — you may stop here. Consider Option B for incremental gains.
- [ ] **4. Update imports** (Option B): replace `from 'vue-plugin-hiprint'` with `from 'vue-plugin-hiprint/v3'` in:
  - `composables/useHiprintRuntime.ts`
  - `composables/useHiprintDesigner.ts`
  - `composables/usePrintService.ts`
  - `components/DesignerHiprint.vue`
- [ ] **5. Refactor `useHiprintRuntime.ts`** — swap `hiprint.init` for `useHiprintRuntime({ autoInit: true })`. ~20 lines.
- [ ] **6. Refactor `useHiprintDesigner.ts`** — choose Option B (delete file, use V3 built-in) or Option C (keep wrapper, swap internals). ~80 lines.
- [ ] **7. Refactor `usePrintService.ts`** — swap `new hiprint.PrintTemplate()` for `new PrintTemplate()` (from V3 compat layer); optionally swap `autoConnect/disAutoConnect` for `useHiprintSocket()`. ~60 lines.
- [ ] **8. Refactor `DesignerHiprint.vue`** — replace `hiprint.buildDesigner(...)` with `<HiprintDesigner>` SFC; replace `renderExtra` with slots; replace `toolbarCtrl.openTemplateDialog` with `v-model:open`. ~120 lines.
- [ ] **9. Audit `toolbarCtrl` references** (Option B): search the codebase with regex `toolbarCtrl\.\w+`. Map each to the table in [§3.4](#34-designerhiprintvue) or the reactive equivalent.
- [ ] **10. Audit `__hiprintDesignerControls` window global** if used (designer-shell pattern from v1 demo): refactor to `provide()` + `inject()` between parent and child SFCs. The window global is **not** part of V3.
- [ ] **11. Run business app dev server** and verify:
  - Designer mounts cleanly (no console errors).
  - All toolbar buttons (undo / redo / clear / save / preview / print) trigger correct handlers.
  - Template-select dialog opens, populates, allows select/preview/edit/delete.
  - Save flow round-trips data to the API.
  - Browser print + silent print both work.
  - Dynamic-fields panel (FNSKU scene) renders correctly.
  - Lock semantics work (locked element cannot be dragged/resized/edited/deleted).
- [ ] **12. Run business e2e regression suite**: `pnpm test:e2e` in `vue-admin-main`.
- [ ] **13. Smoke-test behavior changes from §4**:
  - Empty-canvas click now always deselects — confirm this matches your UX expectations.
  - Shift+arrow now moves 10pt — confirm any keyboard shortcuts your app overrides don't conflict.
  - Shift+resize now locks aspect ratio (reversed from V1) — confirm any tutorial or screenshot.
- [ ] **14. Update vue-admin-main integration docs** if your team maintains one.

---

## 11. Common pitfalls

### 11.1 Modal teleport + Pinia provide/inject

`ant-design-vue` `<Modal>` (and Element Plus `<ElDialog>`) teleports content to `document.body` by default. This **breaks** `provide()` / `inject()` chains.

**V3 mitigation**: V3 composables use `useXxxStore()` which finds the active Pinia via `getActivePinia()` rather than provide/inject. Cross-teleport boundary state works automatically.

**However**: if you `app.use(createPinia())` **twice** (e.g., in tests + in main entry), V3 composables may pick the wrong instance. Always create exactly one Pinia per app.

### 11.2 Multiple designers on one page

Each `<HiprintDesigner>` instance creates its own scoped Pinia store via factory function. Cross-talk is impossible **as long as each component has its own root**.

**Symptom of misuse**: two `<HiprintDesigner>` components sharing the same `:template` ref — undo/redo from one will affect the other's view. Solution: deep-clone the template JSON for each instance (or `structuredClone()`).

### 11.3 `window.hiwebSocket` legacy access

The socket protocol still exposes `window.hiwebSocket.opened` and `window.hiwebSocket.printerList` (V1 quirk preserved per ADR-0011 #12). Your existing `usePrintService.ts` code reading these still works.

**Prefer V3 reactive equivalents** for new code:

- `useHiprintSocket().connected` (Ref<boolean>)
- `useHiprintSocket().printers` (Ref<PrinterInfo[]>)

### 11.4 HMR-safe singletons

The V3 hiprint runtime, element-type registry, and socket are cached on `globalThis.__hiprint_runtime__`, `globalThis.__hiprint_registry__`, `globalThis.__hiprint_socket__`. HMR re-import yields the **same** instance — no double-init, no double-subscription.

If you see "WebSocket connection 2x" in DevTools after HMR, check that you have not bypassed the V3 cache with a manual `new Socket(...)`.

### 11.5 `onReady` second argument

V1's `onReady(tpl, toolbarCtrl)` provided imperative access to the toolbar. V3's `onReady(tpl)` only provides the template instance (per ADR-0011).

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

…or, if you must stay imperative, keep using `hiprint.buildDesigner(...)` from the compat layer, which **does** return a controller with the restored `toolbarCtrl` subset.

### 11.6 Component-panel slot rebuild

V1: `designerController.rebuildComponentPanel(moduleName, panelSlot)` was imperative.

V3: bind `:component-panel-slot="panelSlot"` reactively. When `panelSlot.value` changes, V3 auto-rebuilds. No imperative call needed.

**Watch out for**: if you mutate `panelSlot` object in place (e.g., `panelSlot.value.groupName = 'X'`), Vue may not detect the change. Replace with a new object: `panelSlot.value = { ...panelSlot.value, groupName: 'X' }`.

### 11.7 Idempotent destroy

V3 `tpl.destroy()` remains idempotent (calling twice is safe, PM-005). However, V3 SFCs auto-destroy on unmount via `onScopeDispose`. Manual `destroy()` in your `onBeforeUnmount` is **redundant** when using `<HiprintDesigner>` — keep it only for the wrapper-composable path.

### 11.8 `defaultElementTypeProvider` still requires `new`

```ts
// ✅ Correct (V1 + V3)
hiprint.init({ providers: [new defaultElementTypeProvider()] })

// ❌ Wrong — class not instantiated
hiprint.init({ providers: [defaultElementTypeProvider] })
```

Despite V3's reactive surface, the provider is still a class (Vue plugin convention).

### 11.9 `setActivePinia` in tests

If you write Vitest tests that import V3 composables, call `setActivePinia(createPinia())` in `beforeEach`:

```ts
import { setActivePinia, createPinia } from 'pinia'
beforeEach(() => setActivePinia(createPinia()))
```

V3 composables call `getActivePinia()` internally; if you don't set one in tests they will throw.

### 11.10 Reactive vs raw data passed to `print()`

`tpl.print(data)` accepts both reactive and raw data. However, for **stable JSON serialisation** (Sprint 22b `toRaw` audit), V3 internally `structuredClone()`s the input. Don't pass live Pinia state — it will be cloned, and downstream `Date` objects survive but `Map`/`Set`/`Symbol` may not. Pre-serialise complex data.

### 11.11 Inline-edit + Ctrl+Z

After ADR-0028, Ctrl+Z in an `<input>` (including the inline-edit `contenteditable`) goes to browser native undo of input.value, **not** template undo. To template-undo: first press Enter / Esc to exit inline-edit, then Ctrl+Z. This mirrors VS Code / Figma / Photoshop behaviour.

If your QA reports "Ctrl+Z doesn't undo my edit anymore", explain this is the new V3 behaviour per ADR-0028.

### 11.12 Empty-canvas click + multi-select

After ADR-0024, clicking empty canvas **always** deselects. V1 used to preserve selection when the canvas had ≥ 2 elements. If your QA reports "I clicked empty space and lost my selection", this is the new V3 behaviour per ADR-0024.

To preserve a selection programmatically, listen to the `selection-change` event on `tpl`:

```ts
tpl.on('selection-change', (next, prev) => {
  if (next.length === 0 && prev.length > 0) {
    // restore manually if your workflow needs it
  }
})
```

---

## 12. Estimated effort

### Option A — drop-in compat (zero code change)

| Task | Time |
|---|---|
| `npm install vue-plugin-hiprint@2.0.0` | 1 min |
| Run smoke test in dev server | 15 min |
| Read [§4 Behavior Changes](#4-behavior-changes-read-before-upgrading) | 20 min |
| **Total** | **≈ 0.5 hour** |

### Option B — V3 reactive (full migration)

Single business consumer (vue-admin-main Print Template module):

| File | Lines changed | Difficulty | Est. time |
|---|---|---|---|
| `composables/useHiprintRuntime.ts` | ~20 | Low | 30 min |
| `composables/useHiprintDesigner.ts` | ~80 | Medium | 2 hours |
| `composables/usePrintService.ts` | ~60 | Medium | 1.5 hours |
| `components/DesignerHiprint.vue` | ~120 | Medium | 3 hours |
| Smoke testing (browser print, silent print, save, preview, dialog) | — | Low | 1 hour |
| Behavior-change audit + QA brief | — | Low | 1 hour |
| **Total** | **~280 lines** | **Medium** | **≈ 1 dev-day** |

**Risk factors that could extend the estimate**:

- Custom `renderExtra` buttons with non-trivial state — slot migration may need new sub-components.
- Multiple designer instances on one page — verify isolation.
- Custom element-type providers extending `defaultElementTypeProvider` — confirm the base class API hasn't changed (it hasn't, but verify in your fork).
- Heavy use of `toolbarCtrl` (> 5 methods used) — verify each is in the restored 21/42 set; file an issue otherwise.

### Option C — hybrid

| Task | Time |
|---|---|
| Replace `hiprint.buildDesigner(...)` with `<HiprintDesigner>` | 2 hours |
| Keep V1 template JSON pipeline | 0 (no change) |
| Smoke testing | 30 min |
| **Total** | **≈ 0.5 dev-day** |

---

## 13. Rollback plan

If you must roll back from V3 to V1 mid-migration:

1. Revert the package version: `npm install vue-plugin-hiprint@1.0.3`.
2. Revert any code changes made for Option B (`git revert` the 4 file changes).
3. Verify smoke test (browser DevTools): designer mounts, save button works, dialog opens.

**V3 and V1 are not co-installable** — they share the same package name. Branch your migration and merge atomically.

If only the V3 behaviour changes from §4 are problematic, you can stay on V3 and opt out individually (each ADR's Mitigation section documents how) — though those opt-outs are currently `// TODO not implemented` until a real consumer requests one.

---

## 14. Support

- **V3 reference**: [`docs/API-REFERENCE.md`](API-REFERENCE.md), [`docs/CODE-BLUEPRINT.md`](CODE-BLUEPRINT.md)
- **V3 smoke test**: [`docs/SMOKE-TEST-V3.md`](SMOKE-TEST-V3.md)
- **V3-PARITY matrix**: [`docs/V3-PARITY-MATRIX/INDEX.md`](V3-PARITY-MATRIX/INDEX.md) (34 core findings)
- **V3 parity backlog**: [`docs/V3-PARITY-JIRA.md`](V3-PARITY-JIRA.md) (99 deterministic tickets)
- **ADRs**: [`docs/adr/`](adr/) — in particular ADR-0011 for V3 architecture, ADR-0024..0029 for V1 quirk decisions
- **V1 inventory**: [`docs/V1-INVENTORY/`](V1-INVENTORY/) (8907 lines, 2300+ V1 line citations)
- **Quick start**: [`docs/QUICK-START.md`](QUICK-START.md)
- **Integration guide**: [`docs/integration-guide.md`](integration-guide.md)
- **Issues**: file in this repo with label `v3-migration`

---

> _Last updated: 2026-05-12 (Sprint 22f, TKT-257). Maintained alongside `docs/V3-PARITY-JIRA.md` and the six 0024–0029 ADRs._
