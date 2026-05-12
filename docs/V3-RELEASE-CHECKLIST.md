# V3 Release Checklist — v2.0.0

> Produced by **Sprint 22g wave 3 — Stream GQ** on 2026-05-12.
> Branch: `refactor/hiprint-v2` HEAD `7a33838`.
> Status: **DRAFT** — items below must be greenlit before `npm version 2.0.0 && npm publish`.

This checklist is the single gate between current alpha (`1.0.3` with V3 phases P14–P18 done, P19 in-flight) and the `2.0.0` stable release that flips `vue-admin-main` from V1 over to the modern V3 stack.

---

## 0. Quick status snapshot (as of 2026-05-12)

| Signal | Value | Source |
|---|---|---|
| Branch | `refactor/hiprint-v2` HEAD `7a33838` | `git rev-parse HEAD` |
| Vitest pass count | **2165 / 2200+** target | `npm run test:unit` (Stream GQ run) |
| TS typecheck | **0 errors** | `npm run typecheck` |
| `vite build` | **PASS** (3393 modules, 12.25 s) | `npm run build` |
| Bundle parse (node --check) | 6 / 6 PASS | cjs + esm × V1 / V2 / V3 |
| tgz size | **5.37 MB** (with sourcemaps) / 1.10 MB (existing) | `npm run pack:fixed` |
| `vue-plugin-hiprint.v3.esm.js` | **2601 KB raw / 604 KB gzip** | this run |
| `vue-plugin-hiprint.v3.cjs.js` | **1855 KB raw / 516 KB gzip** | this run |
| V3 ESM exports | 19 named exports | dynamic import probe |
| jQuery references in V3 bundle | 2 (both docstrings: "no jQuery", "jQuery-free") | grep audit |

---

## 1. Sprint completion (must be 100% per stream)

- [ ] Sprint 22a-r ticket sweep — V3 panel-key-drift rollback (shapes/barcode/qrcode/image/html/table)
- [ ] Sprint 22b ticket sweep — history auto-snapshot + render-path convergence + dataType pipeline
- [ ] Sprint 22c ticket sweep — toolbarCtrl 21 methods + PrintTemplate 55/67 methods + Element list panel
- [ ] Sprint 22d ticket sweep — sidebar/handles/badge/ruler + 27 factory presets parity + ADRs 0024–0029
- [ ] Sprint 22f ticket sweep — BEM bridge + CSS tokens + V1 theme opt-in + dialog compat
- [ ] Sprint 22g wave 1 ticket sweep — toolbarCtrl 42/42 + PrintTemplate 67/67 + text/longText 100%
- [ ] Sprint 22g wave 2 ticket sweep — 6 streams that hit rate-limit mid-flight (re-verify each)
- [ ] Sprint 22g wave 3 ticket sweep — current wave (GA…GR streams)

Source of truth: `docs/V3-PARITY-JIRA.md` (539 LoC) + per-stream commit messages from `git log --oneline c5dfa81..HEAD`.

## 2. V1 → V3 parity matrix at 100% for critical areas

Source: `docs/V3-PARITY-MATRIX/REMAINING-GAPS.md` aggregate scorecard.

- [ ] `01-toolbar-and-shell.md` — close last 1 ⚠️ VIOLATION + 22 🔴 MISSING + 7 🟡 PARTIAL
- [ ] `02-text-longtext.md` — close 4 🔴 + 8 🟡
- [ ] `03-image-html.md` — close 9 🔴 + 4 🟡 + verify the V3-introduced XSS path (`HtmlElement.vue:70-71`) is dead
- [ ] `04-barcode-qrcode.md` — close 6 🔴 + 5 🟡 + verify Path A presets render correctly
- [ ] `05-shapes.md` — close 3 🔴 (ShapePropertyPanel key drift must remain rolled back)
- [ ] `06-table.md` — close 12 🔴 + 5 🟡 (and remove the 4 invented dead-letter fields if any remain)
- [ ] `07-interactions.md` — close 14 🔴 + 6 🟡
- [ ] `08-styles.md` — close any 🔴/🟡 (231 CSS classes / z-index / state machine)

✅ DEFERRED rows remain deferred; ADR reference required for each in the release notes.

## 3. Test gate

- [ ] `npm run test:unit` ≥ **2200 passing** (currently 2165 — gap 35; wave 3 streams must close)
- [ ] 0 `test.skip` left in `src/hiprint-v3/**/__tests__/**`
- [ ] V3 compat layer (`src/hiprint-v3/compat/__tests__/`) — `hiprint-global.spec.ts` (26) and `vue-plugin.spec.ts` (9) still pass
- [ ] `npm run test:e2e` — Playwright suite passes locally and on CI (`.github/workflows/e2e.yml`)
- [ ] No `test.only` left anywhere
- [ ] Coverage report attached to release PR (target: 80% lines on `src/hiprint-v3/`)

## 4. SMOKE Level 1 (Bash, per `CLAUDE.md`)

Mandatory before tgz publish. Stream GQ ran this on 2026-05-12 with the results below — re-run **at tag time** with no source diff:

```bash
npm run typecheck                                    # 0 errors  ✓
npm run build                                        # PASS (12.25s, 3393 modules)  ✓
node --check dist/vue-plugin-hiprint.cjs.js          # OK  ✓
node --check dist/vue-plugin-hiprint.esm.js          # OK  ✓
node --check dist/vue-plugin-hiprint.v2.cjs.js       # OK  ✓
node --check dist/vue-plugin-hiprint.v2.esm.js       # OK  ✓
node --check dist/vue-plugin-hiprint.v3.cjs.js       # OK  ✓
node --check dist/vue-plugin-hiprint.v3.esm.js       # OK  ✓
node -e "import('./dist/vue-plugin-hiprint.v3.esm.js').then(m=>console.log(Object.keys(m).length))"  # 19 exports  ✓
```

- [ ] All 9 commands PASS at tag time
- [ ] Output captured in release PR

## 5. SMOKE Level 2 (browser DevTools)

Per `docs/SMOKE-TEST.md` Level 2 — 8 assertions in browser. Run against demo `npm run dev` and against a freshly installed tgz inside `vue-admin-main`.

- [ ] Demo SMOKE Level 2 — 8 / 8 assertions
- [ ] `vue-admin-main` SMOKE Level 2 — 8 / 8 assertions

## 6. Bundle sanity audit (Stream GQ findings)

### 6.1 V3 bundle is jQuery-free  ✅

Grep `jQuery` against `dist/vue-plugin-hiprint.v3.esm.js` returns **2 hits, both inside docstrings**:
- `print/render.ts` toPdf docblock: "V3 strategy uses jspdf.html() directly (no jQuery)"
- `getV3PhaseStatus()` P15 description: "Print pipeline + data layer (jQuery-free)"

No `from "jquery"` / `require("jquery")` / `jquery-minicolors` references. V3 promise upheld.

- [ ] Re-verify at tag time (`node -e "const fs=require('fs'); const b=fs.readFileSync('dist/vue-plugin-hiprint.v3.esm.js','utf8'); console.log(/from\s+['\"]jquery['\"]|require\(['\"]jquery['\"]\)/.test(b))"` must print `false`).

### 6.2 Externals contract correct  ✅

V3 ESM top-level imports observed: `vue`, `pinia`, `@vueuse/core`, `zod`, `jspdf`, `interactjs`, `@floating-ui/vue`, `socket.io-client` + 1 shared chunk (`./ru-Q6rmn0Nb.js`). Matches `vite.config.js` `rollupOptions.external`.

- [ ] No drift between `peerDependencies` and `rollupOptions.external` at tag time

### 6.3 ⚠️ Bundle bloat — bwip-js deep import not externalized

`vite.config.js` externalizes `'bwip-js'` (line 104) but V3 source uses `'bwip-js/browser'` (deep path) — Rollup string-exact matcher does not match, so the browser entry is **inlined**, contributing ≈886 occurrences of "bwip" strings to `vue-plugin-hiprint.v3.esm.js`. Likely accounts for several hundred KB of the 2.6 MB raw size.

Files using `bwip-js/browser`:
- `src/hiprint-v3/print/render.ts:33`
- `src/hiprint-v3/components/elements/QrcodeElement.vue:11`
- `src/hiprint-v3/components/elements/BarcodeElement.vue:20`
- (+ 5 test files which are excluded from build)

Recommended remediation before `2.0.0`:
- Either add the regex `/^bwip-js(\/.*)?$/` to `rollupOptions.external` and document business-consumer requirement to also install `bwip-js`, **or**
- Switch back to the package root `import bwipjs from 'bwip-js'` (smaller surface, larger payload but already external).

- [ ] Decision recorded in an ADR (e.g. `docs/adr/0030-bwip-js-external-strategy.md`)
- [ ] V3 bundle gzip drops to ≤ 450 KB before tag, **or** decision to ship as-is is signed off

### 6.4 Dynamic-vs-static import warning

Vite reporter warns:
> `src/hiprint-v3/interactions/context-menu.ts` is dynamically imported by `compat/print-template.ts` but also statically imported by `interactions/index.ts`, `keyboard.ts` — dynamic import will not move module into another chunk.

Effect: chunk-splitting unrealized; not a correctness bug, but should be cleaned for release.

- [ ] Resolve the dynamic/static import collision in `context-menu.ts` consumers

## 7. CHANGELOG entry

`CHANGELOG.md` currently tops out at `1.0.3 (2026-05-11)` — Round 3 multi-agent audit closure.

- [ ] Add `## 2.0.0 (YYYY-MM-DD) — V3 Modern Rewrite GA` section above the `1.0.3` entry covering:
  - V3 architectural rewrite summary (ADR-0011 reference)
  - Drop-in compatibility surface (`@vue-plugin-hiprint/v3` exports + `hiprint`/`buildDesigner`/`buildToolbar` compat shims)
  - Breaking changes (if any) with migration recipes
  - Deprecation notes for V1 jQuery internals (P21 cleanup follow-up)
  - Bundle size delta vs `1.0.3`
  - Performance deltas (paint, drag latency) — fill in from `vue-admin-main` measurements
  - Acknowledgements / contributor list

## 8. Version bump

- [ ] `node ./scripts/change-version.js 2.0.0` (verify it touches `package.json`, `package-lock.json`, anything else)
- [ ] Verify `package.json` `main` / `module` / `exports.*` paths still resolve post-bump
- [ ] Verify `exports['./v3']` still points at the V3 ESM/CJS pair and a `.d.ts`

## 9. tgz pack test

- [ ] `npm run pack:fixed` produces `vue-plugin-hiprint.tgz`
- [ ] Stream GQ run: tarball 5.37 MB / unpacked 25.8 MB / 21 files / shasum recorded — see also npm pack stdout
- [ ] Sourcemap inclusion decision: keep (debugging) **or** strip from published tgz before tag — record in CHANGELOG
- [ ] Drop the tarball into a scratch `vue-admin-main` checkout and run its e2e to confirm install resolves

## 10. vue-admin-main switchover guide

Source: `docs/upgrade-to-v3.md` (1273 LoC).

- [ ] Walk the guide end-to-end against a clean `vue-admin-main` clone
- [ ] Update each section that references "alpha", "Sprint 22*", or "not yet stable"
- [ ] Add a final "Production switchover checklist" section pinning the resolved bwip-js / sourcemap / theme-opt-in decisions
- [ ] Confirm the deprecation note for V1 internals points at a real follow-up issue

## 11. Post-release follow-ups (do not block 2.0.0 but must be tracked)

- [ ] E2E visual-regression baseline against the live `2.0.0` build (snapshot suite to be added — currently 0 baseline screenshots in `e2e/`)
- [ ] Schedule jQuery removal milestone (`P21` per `getV3PhaseStatus()`) and lock the date in an ADR
- [ ] Open issue for `context-menu.ts` chunk-split cleanup (item 6.4)
- [ ] Open issue for `bwip-js` external strategy ADR if not resolved pre-tag (item 6.3)

---

## Sign-offs required to tag `v2.0.0`

| Role | Person | Date | Notes |
|---|---|---|---|
| Maintainer | amDosion | | |
| `vue-admin-main` lead | | | |
| Security review (per `.claude/rules/security.md`) | | | |

> **Do not bump `package.json` to `2.0.0` until every box in sections 1–10 is checked and all three sign-offs are filed in the release PR.**
