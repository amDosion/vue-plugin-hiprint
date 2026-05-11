# Upgrade to vue-plugin-hiprint V2 (alpha)

> P13 alpha switching guide for business consumers. See [ADR-0010](adr/0010-hiprint-bundle-refactor-strangler-fig.md) for context.

## Status (2026-05-11)

✅ V2 alpha ready for testing in `vue-plugin-hiprint@1.0.3+` tgz.

V2 phases completed:
- ✅ P0-P10 (core / etypes / table / panel / template / 9 internal helpers)
- ✅ P12 socket (web-socket native + send-by-fragments)
- ✅ P11 ui (adapter mode — V2 surface delegates to V1 jQuery internally)
- ⏳ P14 cleanup (waits for business validation)

Stats: 474 unit tests + 92 e2e tests, all passing. ~10 commits on `refactor/hiprint-v2`.

## Why upgrade

1. **ES module API** — IDE refactor / type inference / tree-shaking
2. **Smaller bundle** — when consuming subsets (e.g. socket-only flows)
3. **Future-proof** — V1 bundle.js will be removed in P14
4. **Same R3 invariants** — all 27 fixes (XSS / destroy / async race / silent failure) preserved + locked by unit tests

## How to switch (3 steps)

### Step 1: Install latest tgz

```bash
cp vue-plugin-hiprint.tgz <your-project>/
cd <your-project>
npm install vue-plugin-hiprint.tgz
```

### Step 2: Update imports

```diff
- import { hiprint, PrintTemplate, buildToolbar, buildDesigner } from 'vue-plugin-hiprint'
+ import { PrintTemplate, buildToolbar, buildDesigner } from 'vue-plugin-hiprint/v2'
```

V2 exports the same API surface; signatures unchanged.

### Step 3: Test golden paths

| Scenario | Verify |
|---|---|
| Designer load | designer-shell.vue renders, drag panel works |
| Element drag | drag text/image/barcode → canvas, position updates |
| Property panel | font/color/border/align inputs persist |
| Multi-panel | addPanel / deletePanel / switch — no console errors |
| Print | print/print2 → browser print or socket client |
| Save JSON | getJson() returns serializable template |
| Load JSON | new PrintTemplate({ template: savedJson }) reproduces |
| Undo/Redo | Ctrl+Z / Ctrl+Y restores state |
| Vue route switch | onBeforeUnmount → destroy(), no memory leaks (DevTools Memory tab) |

## V2 API differences (additive only)

V2 adds these exports beyond V1:

- `PrintElementTypeRegistry` (already in v1.0.2+; data layer singleton)
- `getRegistry()` (HMR-safe singleton accessor)
- `BasePrintElement` (formerly internal; now subclass-able)
- `createPrintElementByType(type, options)` factory
- `getTemplateById(id)` cross-template lookup
- `createHiWebSocket(deps)` / `getHiWebSocket()` (HMR-safe socket)
- `getV2PhaseStatus()` (debug)

V2 does NOT remove any V1 exports. Business code unchanged.

## V2 internal vs adapter modules

V2 internals split into 3 maturity levels:

| Level | Modules | Status |
|---|---|---|
| **Native** | internal/ + renderers/ + core/registry+group + core/etypes (10) + core/etypes/table + core/panel + core/print-element-entity + template (skeleton + 7 mixin) + socket | Full V2 ES module |
| **Adapter** | ui/ (buildToolbar / buildDesigner / element-list / property panel) | V2 surface; V1 jQuery DOM internally |
| **Pending** | (none) | All V1 paths covered by V2 |

P11 adapter mode is intentional — V1's 1850 lines of jQuery DOM construction are kept as-is to minimize risk. P14 (after business validation) will rewrite UI natively.

## Reporting issues

Open a GitHub issue: https://github.com/amDosion/vue-plugin-hiprint/issues

Include:
- V2 vs V1 reproducible steps
- Console output (V2 logs all warnings with `[hiprint]` prefix)
- `getV2PhaseStatus()` output

## Rolling back to V1

If V2 regresses, revert imports:

```diff
- import { ... } from 'vue-plugin-hiprint/v2'
+ import { ... } from 'vue-plugin-hiprint'
```

V1 path remains until P14 cleanup (estimated 1-2 minor releases after alpha).

## Verification checklist (developer)

After upgrade, confirm:

```bash
npm run test:e2e   # 92 cases, all PASS on V1; V2 will run same suite at P13b
```

## Roadmap

| Phase | Status | Description |
|---|---|---|
| P13 | ✅ | V2 alpha (this doc) |
| P13b | pending | Run e2e against V2 entry, fix gaps |
| P14 | pending | Remove V1 bundle.js + native rewrite of P11 ui |
| v1.1.0 release | pending | V2-default minor release after business validation |
| v2.0.0 release | pending | V1 fully removed; V2 default |
