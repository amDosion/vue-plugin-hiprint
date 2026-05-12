# ADR-0030: Panel manager — chip list as V3 default, V1 `<select>` as opt-in

- **Status:** accepted
- **Date:** 2026-05-12
- **Deciders:** amDosion
- **Related:** TKT-300 (Sprint 22g wave 2), V3-PARITY-MATRIX 01-toolbar-and-shell §1.18, V1 bundle.js line 14455-14483
- **Replaces:** none

## Context

V1 (`bundle.js` 14455-14483) renders the active-panel picker as a `<select>` dropdown:

```html
<select class="hiprint-panel-manager">
  <option value="0">1</option>
  <option value="1">2</option>
</select>
```

V3 (`HiprintToolbar.vue` 1000-1023) renders a **chip list** by default — one `<button class="hiprint-toolbar-chip" aria-pressed="..">` per panel. Sprint 22a-r already shipped `panelManagerMode='chips' | 'select'` as a prop so consumers who need the V1 dropdown can opt in (lines 1024-1053 in `HiprintToolbar.vue`).

The parity matrix flagged TKT-300 as a ⚠️ VIOLATION because V3 default differs from V1. This ADR decides whether to flip the default or keep V3 behaviour and document the rationale.

## Decision

**Keep V3 default as chip list. Keep `panelManagerMode='select'` as the V1-compatible opt-in.**

The default is _not_ flipped to `select`. Business code that requires the V1 `<select>` DOM (e.g. for E2E selectors that hard-code `select.hiprint-panel-manager`) passes `panelManagerMode='select'`.

## Rationale

1. **Discoverability:** Chips show every panel name inline. The dropdown hides them behind a click. For typical designer use (1-4 panels) chips are faster to scan.
2. **Active state:** Chip `aria-pressed="true"` is more visually distinct than a collapsed `<select>`. AT users and sighted users both benefit.
3. **Tap targets:** Chips meet WCAG 2.5.5 (44×44 px) out of the box; the `<select>` arrow control on mobile is < 24 px wide.
4. **Many-panel escape hatch:** Documents with ≥ 8 panels can still pass `panelManagerMode='select'` to compact the UI. No information is lost.
5. **V1 parity preserved:** The `select` mode renders the exact V1 markup (`<select class="hiprint-toolbar-select hiprint-toolbar-panel-select">`) so consumers depending on V1 DOM can opt in.

## Consequences

- New consumers see chips by default (modern, accessible).
- Legacy consumers that need V1 DOM pass one prop.
- Spec lock-in: `panel-manager-mode.spec.ts` covers both modes; the `select-mode` case includes a `<select>` DOM assertion so we never regress the opt-in path.

## Migration

For business code that hard-codes the V1 `<select>` selector:

```js
// V1
$('.hiprint-panel-manager').val(2)

// V3 with panelManagerMode='select'
buildDesigner('#hiprintDesigner', {
  toolbarOptions: { panelManagerMode: 'select' },
})
```

For new code we recommend leaving the default and reading active panel from the Pinia store (`useCanvasStore().activePanelId`).
