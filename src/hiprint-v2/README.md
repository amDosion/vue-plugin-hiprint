# src/hiprint-v2/

> hiprint V2 - ES module refactor of `src/hiprint/hiprint.bundle.js` (Strangler Fig pattern).

See [docs/hiprint-v2-refactor-plan.md](../../docs/hiprint-v2-refactor-plan.md) for the 14-phase plan and [ADR-0010](../../docs/adr/0010-hiprint-bundle-refactor-strangler-fig.md) for the decision rationale.

## Status

🚧 **Phase 0**: Skeleton (this directory created). Files to be implemented in P2-P12.

## Layout

| Directory | Phase | Status |
|---|---|---|
| `internal/` | P2 | 🚧 pending |
| `vendor/` | P3 | 🚧 pending |
| `renderers/` | P4 | 🚧 pending |
| `core/registry.*` `core/group.js` | P5 | 🚧 pending |
| `core/etypes/` (10 etypes) | P6 | 🚧 pending |
| `core/etypes/table/` | P7 | 🚧 pending |
| `core/panel.js` | P8 | 🚧 pending |
| `core/print-element-entity.js` | P9 (CRITICAL) | 🚧 pending |
| `template/` | P10 (CRITICAL) | 🚧 pending |
| `ui/` | P11 | 🚧 pending |
| `socket/` | P12 | 🚧 pending |
| `index.js` | P12 | 🚧 pending |

## How to use V2 (after P12)

V2 will be wired into `src/index-v2.js` (separate entry) for alpha testing, then become the default at P13.

```js
// During alpha (P13)
// Set window.HIPRINT_USE_V2 = true in your app before importing
import { hiprint, PrintTemplate } from 'vue-plugin-hiprint';

// After P13 default switch
// V2 is default; set window.HIPRINT_USE_V2 = false to fallback to v1
```

## Invariants V2 MUST preserve (verified per-phase)

1. `PrintTemplate.destroy()` idempotency + all public methods guarded
2. 13 XSS fixes (.text() default, .html() only for by-design contracts)
3. _safeCall business callback isolation (24 sites)
4. _designerEventNs / _toolbarClickNs / per-instance namespaces
5. nested-field reduce nullish-safe (`?? ""` not `|| ""`)
6. addPrintElementTypes double dedup
7. removePrintElementTypes dotted prefix
8. 80 console.* sites with [hiprint] prefix
9. async race protection (toPdf / getHtmlAsync / loadAllImages / sendByFragments / XHR)
10. design() _designed idempotency
11. deletePanel editingPanel re-select

## How V2 is verified

- e2e dual-run: `HIPRINT_USE_V2=compare npm run test:e2e` (P13)
- vitest unit tests: `npm run test:unit` (P2-P12)
- SMOKE Level 2 browser test (per-phase manual when applicable)
- hiprint-bundle-reviewer agent (run on V2 files)
- security-reviewer agent (run on V2 architecture)

## Branching

- main: v1.0.3 with bundle.js (business-facing)
- refactor/hiprint-v2: V2 development (this branch)
- worktree at `../vue-plugin-hiprint-v2/`

## Not yet implemented

All `.js` files. `.gitkeep` placeholders mark empty directories.
