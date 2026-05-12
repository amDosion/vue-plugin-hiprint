# ADR-0031: `componentPanelSlot` imperative API replaced by Vue slots

- **Status:** accepted
- **Date:** 2026-05-12
- **Deciders:** amDosion
- **Related:** TKT-323 (Sprint 22g wave 2), V1 bundle.js line 14870 / 15119-15142, V3 `HiprintDesigner.vue` template slot `<slot name="element-list">`
- **Replaces:** V1 `setComponentPanelSlot` / `clearComponentPanelSlot` / `rebuildComponentPanel`

## Context

V1 `buildDesigner` accepts `componentPanelSlot: { moduleName: { itemTid: { html: '...' } } }` as a runtime imperative descriptor that injects per-element-type HTML into the left component palette. V1 also exposes three runtime mutators:

- `designerCtrl.setComponentPanelSlot(slotOptions)`
- `designerCtrl.clearComponentPanelSlot()`
- `designerCtrl.rebuildComponentPanel(moduleName, slotOptions)`

V3 has no component-panel-slot registry. `HiprintDesigner.vue` exposes a Vue named slot:

```vue
<HiprintDesigner>
  <template #element-list>
    <MyCustomPalette />
  </template>
</HiprintDesigner>
```

`buildDesigner` accepts `componentPanelSlot` for surface compatibility (no error), but the three runtime mutators only emit a `console.warn`.

## Decision

**Replace the imperative API with Vue slots permanently. Keep the warn-stubs so legacy callers do not crash.**

Document the migration in `docs/upgrade-to-v3.md` with a cookbook example.

## Rationale

1. **Reactive coverage:** Vue slots react to host component state automatically; the V1 imperative slot map required `rebuildComponentPanel(moduleName)` after every change.
2. **Type safety:** Slots are typed via Vue 3 + `<script setup>`; the V1 HTML-blob registry forced consumers to sanitize their own input (XSS risk surfaced in three pre-V3 audits — see `docs/V1-INVENTORY/styles.md` §2.6).
3. **Removal preserves backward call surface:** `setComponentPanelSlot` etc. accept the original arguments and emit a clear warn; legacy code keeps booting.
4. **`buildDesigner` already mounts an internal `<HiprintDesigner>` SFC:** Hosts wanting slot replacement should migrate to the SFC directly (`docs/upgrade-to-v3.md` covers the swap).

## Consequences

- Hosts that drove the palette via `setComponentPanelSlot` see a single console.warn pointing at the SFC slot doc.
- `compat/build-designer.ts:449-467` keeps the no-op stubs to avoid breaking startup; this ADR is the canonical reference for why they remain.
- E2E + vitest: TKT-323 covered by a single `componentPanelSlot warn-stub` spec that asserts the warn fires and the controller does not throw.

## Migration cookbook

```vue
<!-- V3: replace the element-list slot -->
<HiprintDesigner :template="json">
  <template #element-list>
    <CustomElementPalette :options="myPaletteConfig" />
  </template>
</HiprintDesigner>
```

For `buildDesigner` callers, migrate to the SFC:

```ts
// V1 / V3 compat (legacy)
buildDesigner('#designer', { componentPanelSlot: { /* ... */ } })

// V3 native (recommended)
import { createApp } from 'vue'
import HiprintDesigner from 'vue-plugin-hiprint/v3/HiprintDesigner.vue'
const app = createApp({
  components: { HiprintDesigner, CustomElementPalette },
  template: '<HiprintDesigner :template="json"><template #element-list><CustomElementPalette/></template></HiprintDesigner>',
  data: () => ({ json }),
})
app.mount('#designer')
```
