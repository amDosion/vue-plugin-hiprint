# SMOKE-TEST V3

> V3 self-validation runbook. Mirrors `docs/SMOKE-TEST.md` (V1) but exercises
> the V3 ES module / Vue 3 / Pinia stack via `src/index-v3.ts` entry.
>
> Status (2026-05-11): V3 P14–P20 complete + P21.1 designer-shell切到 V3 entry.
> 1250/1250 vitest + 92/92 e2e PASS against V3 path.

---

## Level 1 — CI gate (always-on)

Runs in `~30s` total via `npm run build && npm test`. Already wired into CI;
documented here so manual runs match the gate.

```bash
# From E:/Source_code/vue-plugin-hiprint-v2 (worktree, branch refactor/hiprint-v2):
npm run typecheck      # tsc --noEmit -p tsconfig.json — 0 errors required
npm run test:unit      # vitest run — 1250 tests required
npm run build          # vite build (lib mode) — V1 + V2 + V3 dists emit
```

Pass criteria:
- typecheck: exit 0
- vitest: `Test Files N passed (N)` with `Tests 1250 passed (1250)` (or higher;
  must not regress)
- build: 5 dist files emit:
  - `dist/vue-plugin-hiprint.{cjs,esm}.js` (V1 stub re-export)
  - `dist/vue-plugin-hiprint.v2.{cjs,esm}.js` (V2)
  - **`dist/vue-plugin-hiprint.v3.{cjs,esm}.js`** (V3 — primary)
  - `dist/vue-plugin-hiprint.css`

## Level 2 — e2e suite against V3 entry

Runs Playwright (Chromium) `92` cases pointing at the demo `designer-shell.vue`
which imports from `@/index-v3` (V3 compat layer). End-to-end validation that
V3 implements the V1 API surface in a real browser.

```bash
npm run test:e2e
```

Pass criteria:
- 92/92 passed in <90s
- 0 flaky / 0 quarantined

Coverage breakdown of the 92 cases (V3 path):
- destroy lifecycle (4) — destroy idempotency, no leak after route swap
- print pipeline (4) — getHtml DOM structure, getJson roundtrip, multi-panel
- print PDF (3) — toPdf returns Promise, resolves Blob
- print socket (3) — print2 emits via socket, payload protocol byte-stable
- table features (8) — XSS .text() default, by-design formatter, merge, sum
- toolbar / panel-manager (4) — addPanel / deletePanel ≥ 1 guard / setActive
- multi-instance (3) — 2 PrintTemplate instances coexist without cross-talk
- property panel (6) — update / setFontList / setFields / getElementByTid
- xss (6) — `<script>` neutralisation across 6 element paths
- 元素 type / 渲染 / drag etc. (other 51 cases — see e2e/tests/)

Failures in this gate should be triaged and fixed before P22 (业务方 alpha)
hand-off.

## Level 3 — Manual DevTools assertions

For changes that touch the editing UX (P16 interactions, P17/P18 components,
P19 compat layer, P20 composables), run these 8 console checks against
`http://localhost:8080` (`npm run dev`):

### Setup

```js
// Run once in DevTools console
const dz = window.__hiprintDesignerControls
console.assert(dz, 'designer controls not exposed — check designer-shell mount')
```

### Assertions

1. **V3 entry active**:
   ```js
   const has = !!window.hiprint && !!window.hiprint.PrintTemplate
   console.log('hiprint global wired:', has)
   // Should log: true
   ```

2. **`new defaultElementTypeProvider()` constructs an API object**:
   ```js
   const mod = await import('./src/index-v3.ts')
   const p = new mod.defaultElementTypeProvider()
   console.log('provider has addElementTypes:', typeof p.addElementTypes)
   // Should log: function
   ```

3. **PrintTemplate destroy idempotency**:
   ```js
   const tpl = new window.hiprint.PrintTemplate({ template: { panels: [] } })
   tpl.destroy()
   tpl.destroy()   // 2nd call — must NOT throw
   const out = tpl.getJson() // returns fallback { panels: [] } + [hiprint] warn
   console.log('post-destroy getJson:', out)
   ```

4. **setDynamicFields rejects empty moduleName** (Invariant #7):
   ```js
   try { window.hiprint.setDynamicFields('', []) }
   catch (e) { console.log('expected throw:', e.message) }
   // Expected: '[hiprint] setDynamicFields: moduleName is required'
   ```

5. **getJson roundtrip stable** (no aliasing):
   ```js
   const a = dz.getTemplateJson()
   const b = dz.getTemplateJson()
   console.log('different objects:', a !== b, 'same shape:', JSON.stringify(a) === JSON.stringify(b))
   // Both true
   ```

6. **Canvas store reactivity** (V3 native via composable):
   ```js
   const m = await import('./src/index-v3.ts')
   const canvas = m.useHiprintCanvas()
   console.log('panels reactive:', canvas.panels.value.length)
   ```

7. **Socket singleton HMR-safe** (Invariant PM-005):
   ```js
   console.log('hiwebSocket present:', !!window.hiwebSocket)
   const s1 = window.hiwebSocket
   const s2 = window.hiwebSocket
   console.log('same instance:', s1 === s2)
   ```

8. **No jQuery references in V3 dist**:
   ```bash
   # From terminal — should return 0 hits for real jQuery calls
   grep -rn '\$(' dist/vue-plugin-hiprint.v3.esm.js | grep -v '^.*//.*$' | wc -l
   ```
   (Comments OK; real `$()` calls = 0.)

## Level 4 — Business consumer alpha (P22 hand-off)

Once Levels 1-3 pass and ADR-0013 (业务方升级路径) is signed off:

1. `npm run pack:fixed` — generate `vue-plugin-hiprint.tgz` containing V3 dist.
2. `cp vue-plugin-hiprint.tgz E:/Source_code/vue-admin-main/frontend/`
3. In vue-admin-main: `npm install ./vue-plugin-hiprint.tgz`
4. Drop-in path: change one import in `composables/useHiprintRuntime.ts`:
   ```diff
   - import { hiprint, defaultElementTypeProvider } from 'vue-plugin-hiprint'
   + import { hiprint, defaultElementTypeProvider } from 'vue-plugin-hiprint/v3'
   ```
5. Run vue-admin-main dev + production builds, exercise print template editor,
   verify designer / save / print / silent print / dynamic fields all work
   identically to V1.
6. 2-week observation period before v2.0.0 final release.

Failures during alpha should be documented in `docs/postmortems/` and fixed in
worktree before promoting to v2.0.0. Main branch (v1.0.3) is unchanged
throughout the alpha — business consumers retain the option to revert by
reverting the single import line.
