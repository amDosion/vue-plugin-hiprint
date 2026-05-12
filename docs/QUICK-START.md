# Quick Start — vue-plugin-hiprint v2.0.0 (V3)

> Get a designer rendering on screen in under 5 minutes. For the full migration story see [`docs/upgrade-to-v3.md`](upgrade-to-v3.md). For contributing to this repo see [§3 Contributor setup](#3-contributor-setup) below.

---

## 1. Consumer quick start

### 1.1 Install

```bash
npm install vue-plugin-hiprint
# or
yarn add vue-plugin-hiprint
# or
pnpm add vue-plugin-hiprint
```

### 1.2 Minimal V3 reactive designer

```vue
<script setup lang="ts">
import { ref } from 'vue'
import {
  HiprintDesigner,
  useHiprintRuntime,
  defaultElementTypeProvider,
} from 'vue-plugin-hiprint/v3'

// One-time runtime init (idempotent — safe to call from any composable / SFC).
useHiprintRuntime({
  providers: [new defaultElementTypeProvider()],
  autoInit: true,
})

const templateJson = ref({
  panels: [
    {
      width: 210,
      height: 297,
      paperType: 'A4',
      printElements: [],
    },
  ],
})
</script>

<template>
  <HiprintDesigner
    :template="templateJson"
    :history="true"
    @save="(json) => console.log('save', json)"
    @print="(json) => console.log('print', json)"
  />
</template>
```

Add the print stylesheet to your `index.html`:

```html
<link rel="stylesheet" media="print" href="/print-lock.css" />
```

…or import it once in your app entry:

```ts
import 'vue-plugin-hiprint/dist/print-lock.css'
```

### 1.3 Minimal V1-compat designer (drop-in for v1 callers)

If you are upgrading from v1.x and want zero code change, use the V1 compat path:

```ts
import { hiprint, defaultElementTypeProvider } from 'vue-plugin-hiprint'

hiprint.init({ providers: [new defaultElementTypeProvider()] })

const tpl = new hiprint.PrintTemplate({ template: {}, history: true })
tpl.design('#designer')
```

```html
<div id="designer"></div>
```

### 1.4 Print + preview + PDF

```ts
import { useHiprintTemplate } from 'vue-plugin-hiprint/v3'

const tpl = useHiprintTemplate({ template: templateJson.value })

// Browser print
tpl.print({ name: '张三', amount: 100 })

// Silent print (requires electron-hiprint client running)
tpl.print2({ name: '张三', amount: 100 }, { printer: 'HP LaserJet' })

// PDF
tpl.toPdf({ name: '张三', amount: 100 }, 'invoice.pdf')

// Preview (returns HTML string)
const html = tpl.getHtml({ name: '张三', amount: 100 })
```

### 1.5 Common props on `<HiprintDesigner>`

| Prop | Type | Default | Use |
|---|---|---|---|
| `template` | `TemplateJson` | `{ panels: [] }` | Initial template (reactive) |
| `history` | `boolean \| number` | `true` | Enable undo/redo; pass a number for capacity (default 30) |
| `left-width` | `number` | `220` | Element-list sidebar width in px |
| `right-width` | `number` | `320` | Property-panel sidebar width in px |
| `component-module` | `string` | `'defaultModule'` | Module to use for the element picker |
| `dynamic-fields` | `DynamicFieldGroup[]` | `[]` | Business-injected dynamic field groups |
| `locale` | `Record<string, string>` | `{}` | i18n overrides keyed by message id |
| `theme` | `'v3' \| 'v1'` | `'v3'` | Colour palette — `'v1'` reverts to Material |
| `show-undo` / `show-redo` / `show-clear` / `show-pdf` / `show-grid` / `show-ruler` / `show-lock` / `show-unlock` / `show-bring-to-front` / `show-send-to-back` / `show-remove-panel` | `boolean` | `false` | Toggle V1-absent toolbar buttons (default off, V1 parity) |
| `show-save` / `show-print` / `show-preview` / `show-template-select` | `boolean` | `true` | Toggle V1-present toolbar buttons |

### 1.6 Common events on `<HiprintDesigner>`

| Event | Payload | Fires when |
|---|---|---|
| `ready` | `(tpl)` | Designer mounted and PrintTemplate-compat exposed |
| `save` | `(json, name)` | Save button clicked or save dialog confirmed |
| `print` | `(json)` | Print button clicked |
| `preview` | `(json)` | Preview button clicked |
| `clear` | `(tpl)` | Clear button clicked |
| `selection-change` | `(next, prev)` | Element selection changed |
| `template-change` | `(json)` | Any JSON mutation (drag / resize / property edit / undo / redo) |

### 1.7 Composable cheat sheet

```ts
import {
  useHiprintRuntime,   // global init (idempotent)
  useHiprintDesigner,  // designer lifecycle
  useHiprintTemplate,  // standalone PrintTemplate wrapper
  useHiprintCanvas,    // Pinia canvas store
  useHiprintPrint,     // print / preview / pdf
  useHiprintSocket,    // reactive socket state
} from 'vue-plugin-hiprint/v3'
```

See [`docs/API-REFERENCE.md`](API-REFERENCE.md) for the complete signatures.

---

## 2. Common recipes

### 2.1 Load a saved template

```ts
const designer = useHiprintDesigner({ container: rootRef })
designer.loadTemplate(savedJson)
```

### 2.2 Add a custom toolbar button

```vue
<HiprintDesigner :template="tpl">
  <template #toolbar-extra-start>
    <button class="hi-btn" @click="openMyDialog">我的按钮</button>
  </template>
  <template #toolbar-extra-end>
    <button class="hi-btn" @click="toggleFullscreen">全屏</button>
  </template>
</HiprintDesigner>
```

### 2.3 Inject dynamic fields (e.g., business module fields)

```ts
const dynamicFields = ref([
  {
    name: '订单字段',
    items: [
      { name: '订单号', field: 'orderNo' },
      { name: '客户姓名', field: 'customer.name' },
      { name: '总金额', field: 'totals.amount' },
    ],
  },
])
```

```vue
<HiprintDesigner
  :template="tpl"
  :dynamic-fields="dynamicFields"
  :module-name="'businessModule'"
/>
```

### 2.4 Theme override

```vue
<HiprintDesigner theme="v1" />     <!-- Material palette -->
<HiprintDesigner theme="v3" />     <!-- Ant Design palette (default) -->
```

Or via CSS custom properties:

```css
.hiprint-designer {
  --hiprint-color-primary: #1677ff;
  --hiprint-color-border: #d9d9d9;
  --hiprint-radius-sm: 4px;
}
```

### 2.5 Multi-designer on one page

Each `<HiprintDesigner>` has its own Pinia instance. Pass independent template refs:

```vue
<HiprintDesigner :template="leftTemplate" />
<HiprintDesigner :template="rightTemplate" />
```

Both instances run independently — no cross-talk on undo/redo/selection.

### 2.6 Lock an element programmatically

```ts
tpl.lockElement('elementId')   // disable drag/resize/edit/delete
tpl.unlockElement('elementId') // re-enable
```

### 2.7 Listen to lifecycle events

```ts
tpl.on('selection-change', (next, prev) => { /* … */ })
tpl.on('template-change',  (json)       => { /* … */ })
tpl.on('panel-change',     (id)         => { /* … */ })
tpl.on('paper-change',     (paper)      => { /* … */ })
tpl.on('history-change',   (info)       => { /* … */ })
```

---

## 3. Contributor setup

If you're contributing to **this repository** (not just consuming the package), run the bootstrap script:

```bash
# macOS / Linux / Git Bash on Windows
./setup.sh
```

```powershell
# Windows PowerShell
./setup.ps1
```

The script installs dependencies, runs `typecheck`, executes the Vitest unit suite, and confirms a clean baseline. After it completes, start the dev server:

```bash
npm run dev
```

### 3.1 Useful commands

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server (open <http://localhost:5173>) |
| `npm run build` | Library build → `dist/` |
| `npm run pack:fixed` | Build + `npm pack` + rename to `vue-plugin-hiprint.tgz` |
| `npm run typecheck` | TypeScript strict check (no emit) |
| `npm run test:unit` | Vitest unit tests (2078 tests across 139 files) |
| `npm run test:unit:watch` | Vitest in watch mode |
| `npm run test:e2e` | Playwright e2e suite (19 specs) |
| `npm run test:e2e:headed` | Playwright with visible browser |

### 3.2 Smoke test after every change

After modifying any V3 source file, run:

```bash
npm run typecheck && npm run test:unit
```

Before pushing, run the full e2e suite:

```bash
npm run test:e2e
```

See [`docs/SMOKE-TEST-V3.md`](SMOKE-TEST-V3.md) for the V3 smoke-test playbook and [`docs/SMOKE-TEST.md`](SMOKE-TEST.md) for the legacy V1 bundle test (still useful for the compat path).

### 3.3 Where things live

```
src/hiprint-v3/
├── stores/          ← Pinia (canvas / history / template / socket)
├── composables/     ← Vue 3 composables (useHiprintRuntime / Designer / Print / …)
├── components/      ← SFCs (HiprintDesigner / Toolbar / Canvas / PropertyPanel / …)
│   └── elements/    ← One SFC per etype (text / image / barcode / …)
├── interactions/    ← drag-drop / resize / context-menu / selection / keyboard
├── schemas/         ← Zod (template / element / panel / style)
├── print/           ← jQuery-free print pipeline (render / pdf / socket)
├── core/            ← Data layer (registry / group / element-base / etypes)
├── internal/        ← Utilities (hinnn / lifecycle / i18n / dom-helpers)
└── compat/          ← V1 surface (hiprint / PrintTemplate / buildToolbar / …)
```

See [`docs/CODE-BLUEPRINT.md`](CODE-BLUEPRINT.md) for the full code map.

### 3.4 Pre-commit checklist

Before opening a PR:

- [ ] `npm run typecheck` passes
- [ ] `npm run test:unit` passes (≥ 2078 tests)
- [ ] `npm run test:e2e` passes (19 specs) for any change touching `src/hiprint-v3/`
- [ ] If you touched `src/hiprint-v3/compat/*`, also run `docs/SMOKE-TEST.md` Level 1 + Level 2 to validate V1 callers
- [ ] If you added a public-API symbol, update `docs/API-REFERENCE.md`
- [ ] If you changed behaviour, update or add an ADR under `docs/adr/`
- [ ] If you touched anything in `.claude/rules/` high-risk paths, run `/deep-system-debug` first

---

## 4. Troubleshooting

### 4.1 "WebSocket connection refused" in DevTools

The silent-print socket tries to connect on first use. Either:

- Start `electron-hiprint` locally (port 17521 by default), or
- Disable autoconnect: `useHiprintSocket({ autoConnect: false })`.

### 4.2 "ReferenceError: __hiprint_runtime__ is not defined"

You are running V3 in an environment with strict CSP that blocks `globalThis` mutation. Either:

- Relax CSP to allow `globalThis` properties, or
- Pre-init manually in your app entry: `import { initRuntime } from 'vue-plugin-hiprint/v3'; initRuntime({...})`.

### 4.3 Two Pinia instances detected

You called `app.use(createPinia())` twice (e.g., once in main entry and once in tests). Create exactly one Pinia per app. In tests:

```ts
import { setActivePinia, createPinia } from 'pinia'
beforeEach(() => setActivePinia(createPinia()))
```

### 4.4 Designer mounts but is blank

Check the browser console — most "blank designer" cases are a Zod validation error on the template JSON. V3 logs `[hiprint] template schema validation failed: …` with the field path. Fix the JSON (or set `template: {}` for a fresh start).

### 4.5 Ctrl+Z doesn't undo my inline edit

Per ADR-0028, Ctrl+Z inside an `<input>` or `contenteditable` goes to **browser native undo** of input value, not template undo. Press Enter / Esc to exit inline-edit first, then Ctrl+Z.

### 4.6 Shift+resize stretches instead of locking aspect ratio

V3 reversed V1 behaviour (ADR-0027). Shift now **locks** aspect ratio. To resize freely, drop the Shift key. If you have muscle memory from V1, this is the breaking change you'll feel most often.

---

## 5. Further reading

- [`docs/upgrade-to-v3.md`](upgrade-to-v3.md) — full migration guide with V1 → V3 examples
- [`docs/API-REFERENCE.md`](API-REFERENCE.md) — every exported symbol with signature + example
- [`docs/integration-guide.md`](integration-guide.md) — business-consumer integration recipes
- [`docs/CODE-BLUEPRINT.md`](CODE-BLUEPRINT.md) — repository code map
- [`docs/SMOKE-TEST-V3.md`](SMOKE-TEST-V3.md) — V3 smoke-test playbook
- [`docs/V3-PARITY-MATRIX/INDEX.md`](V3-PARITY-MATRIX/INDEX.md) — V1 vs V3 behaviour scorecard
- [`docs/adr/`](adr/) — architecture decision records
- [`docs/V1-INVENTORY/`](V1-INVENTORY/) — 8907-line V1 behaviour reference

---

> _Last updated: 2026-05-12 (Sprint 22f, TKT-266)._
