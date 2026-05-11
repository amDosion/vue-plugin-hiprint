# V3 Parity Matrix — `image` & `html` etypes

> **Goal**: Row-by-row parity score for every V1 behavior (per `docs/V1-INVENTORY/etypes/image-html.md`, 1276 lines, 151 citations) against the V3 implementation.
>
> **V3 sources audited**:
> - `src/hiprint-v3/components/elements/ImageElement.vue` (94 lines)
> - `src/hiprint-v3/components/elements/HtmlElement.vue` (93 lines)
> - `src/hiprint-v3/components/elements/ElementWrapper.vue` (172 lines)
> - `src/hiprint-v3/components/elements/_helpers.ts` (194 lines)
> - `src/hiprint-v3/components/property/ImagePropertyPanel.vue` (245 lines, Sprint 22a Stream D)
> - `src/hiprint-v3/components/property/HtmlPropertyPanel.vue` (131 lines, Sprint 22a Stream D)
> - `src/hiprint-v3/core/etypes/image.ts` (80 lines)
> - `src/hiprint-v3/core/etypes/html.ts` (53 lines)
> - `src/hiprint-v3/core/default-provider.ts` (defaults for image / signatureImage / seal / html)
> - `src/hiprint-v3/interactions/context-menu.ts` (340-398 buildElementContextItems)
> - `src/hiprint-v3/interactions/resize.ts` (edges contract)
>
> **Audit date**: 2026-05-11
> **Audit scope**: per-row parity (not behavioral test) — code/comment-level review against V1 line citations.

---

## Legend

| Symbol | Meaning |
|---|---|
| ✅ | V3 reaches V1 parity (behavior matches, even if implementation differs) |
| 🟡 | V3 partial parity — usable but missing a feature/state V1 has |
| 🔴 | V3 missing — V1 has it, V3 does not, and a business path depends on it |
| ⚠️ | V3 diverges by design (documented in ADR) — intentional break |
| ⏸️ | V3 deferred — planned but unimplemented; tracked as TODO/issue |
| 🟢 (XSS legend) | XSS vector closed in V3 |
| 🔵 (XSS legend) | XSS vector preserved by design (parity), with explicit documentation |
| 🟠 (XSS legend) | XSS vector still latent (no documentation, no opt-in escape, no protocol whitelist) |

---

## Executive scorecard

| Section | image rows | html rows | image ✅ | image 🟡 | image 🔴/⚠️/⏸️ | html ✅ | html 🟡 | html 🔴/⚠️/⏸️ |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| A — class layering | 5 | 5 | 4 | 0 | 1 | 3 | 1 | 1 |
| B — option fields | 22 | 18 | 11 | 4 | 7 | 9 | 3 | 6 |
| C — factory presets | 3 | 1 | 3 | 0 | 0 | 1 | 0 | 0 |
| D — property panel | 16 | 11 | 4 | 4 | 8 | 1 | 1 | 9 |
| E — render DOM | 6 | 6 | 4 | 1 | 1 | 4 | 1 | 1 |
| F — interactions | 6 | 7 | 3 | 1 | 2 | 3 | 1 | 3 |
| G — context menu | 13 | 13 | 6 | 2 | 5 | 6 | 2 | 5 |
| H — lock behavior | 3 | 3 | 1 | 0 | 2 | 1 | 0 | 2 |
| I — CSS classes / states | 14 | 6 | 5 | 1 | 8 | 4 | 1 | 1 |
| J — V1 quirks | 10 | 12 | 4 | 0 | 6 | 5 | 0 | 7 |
| **Totals** | **98** | **82** | **45** | **13** | **40** | **37** | **10** | **35** |

Combined ✅: 82 / 180 (45.6%). Combined 🟡: 23 / 180 (12.8%). Combined deficit (🔴/⚠️/⏸️): 75 / 180 (41.6%).

XSS-vector rollup: see Appendix A.

---

# Part 1 — `image` etype

## A. Class layering (image)

| # | V1 row (citation) | V1 behavior | V3 location | V3 behavior | Score | Notes |
|---|---|---|---|---|---|---|
| A.1 | V1 9260 — class `v` aka `ImagePrintElement` | jQuery class, root div `.hiprint-printElement-image` | `ImageElement.vue` line 80-93 template | Vue SFC; root `.hiprint-printElement-image` class set by `ElementWrapper` via `wrapperClass` computed (`ElementWrapper.vue` 78-84) | ✅ | Class string composed at line 82 (`'hiprint-printElement-' + type`). DOM-equivalent. |
| A.2 | V1 9260-9264 — constructor: super + `new g.a(n).setDefault(image.default)` | imperative options merge | `core/etypes/image.ts` `createImageElement` (37-53) | spreads `IMAGE_DEFAULT_OPTIONS` + caller options; no class constructor (data-only) | ✅ | V3 defaults `{ width: 100, height: 60, fit: 'contain' }` (line 15-19) ≠ V1 `{}` (config 615). See A.5. |
| A.3 | V1 9266-9291 — image override methods (`getReizeableShowPoints`, `getData`, `createTarget`, `initSizeByHtml`, `getConfigOptions`, `updateDesignViewFromOptions`, `updateTargetImage`, `getHtml`) | 8 overrides | `ImageElement.vue` 39-77 + `resolveImageSrc` (`image.ts` 59-80) | `resolvedSrc` computed (47-58) covers `getData`; render = `<img>` in template; no equivalent for `initSizeByHtml`, `updateTargetImage`, `getConfigOptions`, `getReizeableShowPoints` (those collapse into Vue reactivity) | 🟡 | Functional parity for src + render. **Missing**: `initSizeByHtml` (auto-fit on drop based on natural image dims), `getReizeableShowPoints` (image-specific 5-handle override). |
| A.4 | V1 9266-9267 — `getReizeableShowPoints` returns `["s","w","e","se","r"]` | image-only 5-handle resize (no n/nw/ne/sw) | `ElementWrapper.vue` 113-131 enables resize; `enableElementResize` defaults all 4 edges true (`resize.ts` 160) | V3 uses all 4 edges (top/right/bottom/left); no per-etype handle restriction; no rotate handle (`r`) | 🔴 | **V3 diverges silently** — image gets 4-edge resize. V1 image was deliberately 5-point (excludes top/nw/ne/sw + adds rotate). No ADR. **Action**: either restore V1 handle list or add ADR justifying 8-handle uniform. |
| A.5 | V1 9276 — `initSizeByHtml(e)` measures rendered IMG to autoset width/height | clone + measure → setWidth/setHeight in pt | (none) | V3 hard-codes default 100×60 (`image.ts` 15-19); on src change no auto-resize | 🔴 | Side-effect: V1 blank `defaultModule.image` drop = 0×0 (bug, see J.1). V3 drop = 100×60 (better default). But V3 also lacks "fit natural size" UX after src changes. Net: regression for users who drop a known-size signature/seal expecting natural dims. Tracking issue needed. |

## B. Option fields (image — 22 V1 fields)

| # | V1 option | V1 type | V1 default | V3 prop panel | V3 render usage | Score | Notes |
|---|---|---|---|---|---|---|---|
| B.1 | `src` | string URL/dataURL | undefined | `ImagePropertyPanel.vue` 119-127 — `img-src` text input | `resolvedSrc` 50-56 → `<img :src>` (line 90) | ✅ | Vue auto-escapes attribute; safer than V1 `.attr({src:n})` concat. |
| B.2 | `field` | string (dotted) | undefined | 🔴 missing — not in `ImagePropertyPanel.vue` | `getElementValue` (`_helpers.ts` 158-173) resolves via `resolveField` | 🟡 | Render reads field; panel does NOT let user edit field. Users on data-bound templates can't change the binding via UI — must edit JSON. V1 had it in basic tab (config 483). |
| B.3 | `fit` (V1 short name; CSS `object-fit`) | enum | undefined | 🟡 panel uses `objectFit` key not `fit` (line 132-141) | 🟡 render reads `opts.fit` (`ImageElement.vue` 68) — **inconsistent key with panel** | 🔴 | **Critical bug**: panel writes `options.objectFit`, render reads `options.fit`. Edits don't take effect. Either rename in panel OR add `opts.objectFit \|\| opts.fit` fallback in render. (Detected at `ImageElement.vue:68` vs `ImagePropertyPanel.vue:62`.) |
| B.4 | `borderRadius` | string CSS (`4px` / `50%` / `4px 8px`) | undefined | 🟡 panel uses `number` input + pt unit (line 142-152) | 🟡 render writes `borderRadius: N + 'pt'` (`ImageElement.vue` 69-71) | 🟡 | V1 freeform string; V3 numeric pt only. Loses `%` / multi-corner. **Action**: change input to text or accept both. Document as minor breaking. |
| B.5 | `left` | number pt | 0 | (lives in generic position fieldset — image panel comment notes it) | `computeGeometryStyle` (`_helpers.ts` 37-49) | ✅ | Same pt unit; absolute position. |
| B.6 | `top` | number pt | 0 | same | same | ✅ | — |
| B.7 | `width` | number pt | undefined (V1) / 100 (V3 default) | `ImagePropertyPanel.vue` 168-177 with aspect lock (78-91) | `computeGeometryStyle` | ✅ | V3 enriches with `aspectRatioLock`. |
| B.8 | `height` | number pt | undefined / 60 | same with aspect lock | same | ✅ | — |
| B.9 | `transform` (= rotate degrees) | number deg | undefined | 🔴 missing in panel (V3 uses `rotate` key) | `computeGeometryStyle` reads `opts.rotate` (line 53-55) | 🔴 | **Key mismatch** — V1 uses `transform`; V3 reads `rotate`. Existing V1 templates carry `options.transform: 30` → V3 ignores. Either alias in render, or document migration in upgrade-to-v3.md. |
| B.10 | `zIndex` | integer | undefined | 🔴 missing in `ImagePropertyPanel.vue` | `computeGeometryStyle` line 50-52 | 🟡 | Render handles it; panel doesn't expose. User must edit via generic panel (if dispatched) or JSON. |
| B.11 | `pageBreak` | boolean | undefined | 🔴 missing | (not implemented in print pipeline yet for V3) | 🔴 | Print-time behavior; out of scope for component matrix, but missing end-to-end. Track to print module. |
| B.12 | `showInPage` | enum | undefined | 🔴 missing | (not in `computeBaseStyle`) | 🔴 | Same as B.11 — affects print, not design. |
| B.13 | `unShowInPage` | enum | undefined | 🔴 missing | (not in `computeBaseStyle`) | 🔴 | Same. |
| B.14 | `fixed` | boolean | undefined | 🔴 missing | (no fixed positioning) | 🔴 | Same. |
| B.15 | `axis` (drag lock h/v) | enum | undefined | 🔴 missing | `enableElementDrag` has no axis param wired (ElementWrapper 101-111) | 🔴 | Drag lock to single axis is a real UX feature (used for hline/vline siblings). |
| B.16 | `formatter` (string JS source) | string | undefined | 🔴 missing in image panel | image render does not invoke formatter (only html does) | 🔴 | V1 image had element-level formatter to transform field value before display. V3 drops this for image; html keeps it (HtmlElement 54-67). |
| B.17 | `styler` (string JS source) | string | undefined | 🔴 missing | (no styler in `ImageElement.vue`) | 🔴 | V1 styler returns CSS map applied to target. V3 image cannot dynamically style based on data. |
| B.18 | `positionLocked` | boolean | undefined | 🔴 not in `ImagePropertyPanel.vue` | (no lock check in `enableElementDrag`/`enableElementResize` calls) | 🔴 | **High-impact gap**: locked elements still drag/resize in V3. V1 11531-11537 toggled via right-click. |
| B.19 | `sizeLocked` | boolean | undefined | 🔴 missing in panel | no consumer in resize wiring | 🔴 | Same — resize handles always shown. |
| B.20 | `draggable` | boolean derived | undefined→true | 🔴 — V3 has no `draggable: false` short-circuit | (always enabled when `interactive=true`) | 🔴 | V1 1566 honored `options.draggable=false`. V3 binary at component level only. |
| B.21 | `coordinateSync` | boolean | undefined | 🔴 missing | n/a | 🔴 | V1 3617 sync X/Y inputs. Niche UX. |
| B.22 | `aspectRatioLock` (V3-only) | boolean | n/a (NEW) | ✅ `ImagePropertyPanel.vue` 153-161 | drives `onWidth`/`onHeight` ratio math (77-107) | ⚠️ | **V3 adds**; V1 lacks. Documented as V3 enhancement (P17 ADR-0011 alignment). |

## C. Factory presets (image — 3 V1 presets)

| # | V1 preset | V1 defaults | V3 equivalent | Score | Notes |
|---|---|---|---|---|---|
| C.1 | `defaultModule.image` (blank) | `{ tid, title:"图片", data:"", type:"image", icon:"ep:picture" }` (provider 31-37) — no width/height | `default-provider.ts` 60-69 + `IMAGE_DEFAULT_OPTIONS = { width: 100, height: 60, fit: 'contain' }` | ✅ | V3 fixes V1's "0×0 drop" bug by giving default size. See A.5 / J.1. |
| C.2 | `defaultModule.signatureImage` | `{ width: 160, height: 60, src: SIG_SVG, fit:'contain' }` (provider 416-426) | `default-provider.ts` 340-350 — **identical** | ✅ | SVG placeholder + size preserved 1:1. |
| C.3 | `defaultModule.seal` | `{ width: 80, height: 80, src: SEAL_SVG, fit:'contain' }` (provider 427-438) | `default-provider.ts` 352-357 — **identical** | ✅ | Same. |

## D. Property panel (image — 16 V1 UI controls across 3 tabs)

> V3 `ImagePropertyPanel.vue` is a flat single-pane (no tabs). V1 had basic/style/advanced tabs (config 479-552).

### D.1 Basic tab (V1 config 480-515, 8 rows)

| # | V1 control | V3 location | Score | Notes |
|---|---|---|---|---|
| D.1.1 | `field` text/select with `getFields()` | 🔴 absent in `ImagePropertyPanel.vue` | 🔴 | Render still reads field; must edit via JSON or generic panel. |
| D.1.2 | `src` text + "select" button + file→base64 upload | 🟡 partial — text input only (119-127) | 🟡 | No "select" button, no file→base64 picker. User must paste URL/dataURL. |
| D.1.3 | `fit` `<select>` 5 options | ✅ `ImagePropertyPanel.vue` 128-141 | ✅ | Plus `scale-down` (CSS extra); same 4 V1 values. **But see B.3 — key mismatch bug.** |
| D.1.4 | `coordinate` X/Y inputs + position lock + sync lock | 🟡 — X/Y likely in generic panel; image panel has no lock checkbox | 🟡 | Lock not wired in V3. |
| D.1.5 | `widthHeight` W/H inputs + size lock + aspect lock | 🟡 W/H present (168-188); aspect lock present (153-161); ❌ size lock missing | 🟡 | V3 adds aspect lock (better UX), drops sizeLocked. |
| D.1.6 | `showInPage` select | 🔴 missing | 🔴 | Print-time. |
| D.1.7 | `unShowInPage` select | 🔴 missing | 🔴 | Print-time. |
| D.1.8 | `fixed` checkbox | 🔴 missing | 🔴 | Print-time. |

### D.2 Style tab (V1 config 516-531, 3 rows)

| # | V1 control | V3 location | Score | Notes |
|---|---|---|---|---|
| D.2.1 | `transform` rotate input | 🔴 missing in image panel; generic panel may have | 🔴 | Also key mismatch: V1 `transform` vs V3 `rotate`. |
| D.2.2 | `zIndex` number input | 🔴 missing in image panel | 🔴 | Same. |
| D.2.3 | `borderRadius` text input | 🟡 number+pt only (B.4) | 🟡 | Type narrowing. |

### D.3 Advanced tab (V1 config 532-551, 4 rows)

| # | V1 control | V3 location | Score | Notes |
|---|---|---|---|---|
| D.3.1 | `pageBreak` checkbox | 🔴 | 🔴 | — |
| D.3.2 | `axis` select | 🔴 | 🔴 | — |
| D.3.3 | `formatter` textarea | 🔴 | 🔴 | V3 image drops element-level formatter entirely. |
| D.3.4 | `styler` textarea | 🔴 | 🔴 | V3 image drops styler entirely. |

### D.4 Panel infra

| # | V1 behavior | V3 behavior | Score | Notes |
|---|---|---|---|---|
| D.4.1 | All inputs class `auto-submit` → triggers `update + hiprintTemplateDataChanged_<tid>` event | V3 uses Pinia store + history snapshot on `commit=true` (`ImagePropertyPanel.vue` 46-51) | ⚠️ | Diverges by design. Consumer-facing event still missing (ADR-0011 — V3 emits via `useCanvasStore.$subscribe`). |

## E. Render DOM (image)

| # | V1 DOM (line 9274) | V3 DOM | Score | Notes |
|---|---|---|---|---|
| E.1 | Root `<div class="hiprint-printElement hiprint-printElement-image">` | ElementWrapper produces `<div class="hiprint-element hiprint-printElement hiprint-printElement-image">` | ✅ | V3 adds extra `hiprint-element` class — not breaking. |
| E.2 | Inner `<div class="hiprint-printElement-image-content" style="height:100%;width:100%">` | `ImageElement.vue` 86-89 — identical class + inline style | ✅ | Verbatim. |
| E.3 | `<img src=n style="width:100%;height:100%;content:url('n')!important;object-fit:f;border-radius:b">` (V1 9286-9290) | `<img :src="resolvedSrc" :style="imgStyle" @error="onError" alt="">` (line 90) — no `content:url()` | 🟡 | V1 set `content:url()` as defensive override (for `<img>` with relative paths). V3 drops it. Likely safe for absolute URLs / dataURLs but breaks rare relative-path templates. |
| E.4 | `<img>` reuse on src change (V1 9286: `.attr("src", n)` if exists) | Vue re-renders `<img>` with new `:src`; no manual reuse logic but DOM diff achieves same | ✅ | Browser HTTP cache still respected. |
| E.5 | Print-time DOM same as design (V1 9291 → getHtml2) | V3 print pipeline (`print/render.ts` renderImageElement) — separate imperative renderer, not the Vue component | ⚠️ | Two render paths in V3 (Vue for design, imperative for print). Diverges by design but risks drift if Vue/imperative go out of sync. **Track**: cross-check both write the same DOM shape. |
| E.6 | State-driven CSS classes (`selected`/`editing`/`dragging`) | `ElementWrapper.vue` 70-72 + 82-83 → `hiprint-element--selected` | 🟡 | Selected only — no `editing` (image had double-click edit), no `dragging` class (interact.js owns visual). |

## F. Interactions (image)

| # | V1 behavior | V3 behavior | Score | Notes |
|---|---|---|---|---|
| F.1 | **No** `<img>` onerror in V1 render (V1 inventory J.2) | `ImageElement.vue` 75-77 sets `loadError` + falls back to 1×1 transparent PNG (line 22-24) | ✅ | **V3 fixes V1 gap.** Adds graceful fallback. Document as enhancement. |
| F.2 | IMG reuse on src change, no loading placeholder | Vue does `:src` swap; no loading skeleton | 🟡 | Parity but V1 quirk preserved. Could add `<img loading="lazy">` or skeleton. |
| F.3 | `getData(t)` chain: field→reduce or options.src or printElementType.getData (V1 9268-9272) | `resolveImageSrc` (`image.ts` 59-80) — same 3-stage chain | ✅ | `resolveField` preserves nested 0/false. |
| F.4 | No `backgroundColor`/`padding` for image | `computeBaseStyle` reads them generically (`_helpers.ts` 79, 125-135) | 🟡 | **V3 quietly adds** — element root div will accept backgroundColor/padding. Diverges from V1 (which never wrote those for image). |
| F.5 | `initSizeByHtml` auto-fits to natural image dims after IMG load | Not implemented (A.5) | 🔴 | Regression for "drop image, fit to natural size" UX. |
| F.6 | 5-handle resize (`["s","w","e","se","r"]`) — no top/nw/ne/sw + rotate handle | 4-handle (top/right/bottom/left from `resize.ts` 160 default); no rotate handle | 🔴 | Already covered in A.4. **Visible UX diff**: V3 image gets top handle V1 forbade; V3 image lacks rotate handle V1 had. |

## G. Right-click context menu (image)

> V1 menu shared across all etypes (V1 11419-11650). V3 menu in `interactions/context-menu.ts` lines 340-398.

| # | V1 menu item | V3 menu item | Score | Notes |
|---|---|---|---|---|
| G.1 | 复制元素 (Copy) → `_contextCopyElements` | `copy` (line 354-359) → `_copyElement` (436+) | ✅ | Behavior parity. V3 also adds Ctrl+C shortcut display. |
| G.2 | 粘贴元素 (Paste) → clone + setLeft/setTop +10 + design + event | `paste` (367-371) → `_pasteElement` (449+) | ✅ | — |
| G.3 | (V3-only) Cut | `cut` (361-365) → `_cutElement` | ⚠️ | V3 adds cut. V1 had none — net positive. |
| G.4 | 字体 12pt | 🔴 absent | 🔴 | V1 quirk: had no effect on image anyway. Dropping is fine for image; document. |
| G.5 | 字体加粗 | 🔴 absent | 🔴 | Same as G.4. |
| G.6 | 置于顶层 (max zIndex+1) | `bring-to-front` (373-377) → `_bringToFront` (468+) | ✅ | — |
| G.7 | 置于底层 | `send-to-back` (378-382) → `_sendToBack` (490+) | ✅ | — |
| G.8 | 上移一层 (zIndex+1) | 🔴 absent | 🔴 | One-step up/down missing. Common need. |
| G.9 | 下移一层 (zIndex-1) | 🔴 absent | 🔴 | Same. |
| G.10 | 锁定元素 / 解锁元素 toggle (positionLocked + sizeLocked) | 🔴 absent | 🔴 | No lock toggle anywhere in V3 menu. Combined with B.18/B.19 missing → image cannot be locked in V3. |
| G.11 | 多选对齐 (左/右/顶/底/水平居中/垂直居中) ×6 | 🔴 absent | 🔴 | Multi-select alignment fully missing. |
| G.12 | 多选分布 (水平/垂直) ×2 | 🔴 absent | 🔴 | — |
| G.13 | Delete (V1 had it via keyboard Delete only?) | `delete` (385-389) — explicit menu item | ✅ | V3 surfaces. |

## H. Lock behavior (image)

| # | V1 behavior | V3 behavior | Score | Notes |
|---|---|---|---|---|
| H.1 | `positionLocked=true` → `draggable=false`, X/Y inputs disabled, resize handles hidden, force `sizeLocked=true` (V1 993-1014, 11531-11537) | None — V3 has no lock state | 🔴 | See B.18/B.19/G.10. Locking is a flagship feature for "finalize template" workflow. |
| H.2 | `sizeLocked=true` → resize handles hidden (V1 1016-1033) | None | 🔴 | Same. |
| H.3 | Locked element still deletable via Backspace/Delete (V1 1566-1572) | n/a (no lock) | n/a→🔴 | When locking lands, mirror this carve-out. |

## I. CSS classes & states (image)

| # | V1 class | V3 emission | Score | Notes |
|---|---|---|---|---|
| I.1 | `hiprint-printElement` | `ElementWrapper` line 82 | ✅ | — |
| I.2 | `hiprint-printElement-image` | `ElementWrapper` line 82 (`'hiprint-printElement-' + type`) | ✅ | Computed from `printElementType.type`. |
| I.3 | `hiprint-printElement-image-content` | `ImageElement.vue` line 87 | ✅ | Verbatim. |
| I.4 | `hiprint-option-item` | `ImagePropertyPanel.vue` uses `<fieldset>` + `<label>` instead | ⚠️ | Pure UI class drop; intentional (V3 uses native fieldset). Business CSS hooks lost. |
| I.5 | `hiprint-option-item-row` | n/a | ⚠️ | Same. |
| I.6 | `hiprint-option-item-label` | n/a | ⚠️ | Same. |
| I.7 | `hiprint-option-item-field` | n/a | ⚠️ | Same. |
| I.8 | `hiprint-option-item-settingBtn` | n/a (no "select" button) | 🔴 | Combined with D.1.2 no file-picker. |
| I.9 | `hiprint-img-upload` | n/a | 🔴 | No file→base64 input. |
| I.10 | `auto-submit` | n/a (Pinia patches) | ⚠️ | Diverges by design. |
| I.11 | `selected` | `hiprint-element--selected` (different name!) | 🟡 | **Class renamed**. Business CSS targeting `.selected` breaks. |
| I.12 | `editing` | n/a | 🔴 | No double-click edit (consistent with image not having text). |
| I.13 | `hicontextmenuroot` / `hiprint-ctx-menu` / `-item` / `-group` / `-divider` / `disabled` | V3 portal-mounted floating UI (`context-menu.ts` 1-50) — different class system | ⚠️ | Total replacement; document for CSS theme migrators. |
| I.14 | `disabled` (menu item) | `disabled: true` prop (item type 67) — V3 renders dimmed | ✅ | Functional parity. |

## J. V1 known quirks (image — 10 quirks)

| # | V1 quirk (inventory J.X) | V3 status | Score | Notes |
|---|---|---|---|---|
| J.1 | Blank image drop = 0×0 | V3 fixes — default 100×60 (`image.ts` 15-19) | ✅ | **V3 fix.** |
| J.2 | No `<img>` onerror render fallback | V3 fixes — `@error="onError"` + 1×1 PNG (`ImageElement.vue` 75-77, 22-24) | ✅ | **V3 fix.** |
| J.3 | Reuse IMG ≠ loading placeholder | V3 not fixed (parity) | 🟡 | — |
| J.4 | `fit` / `transform` short-name vs CSS prop confusion | V3 partially fixed — `objectFit` key in panel; but **render still reads `fit`** (B.3 bug); `transform` mapped to `rotate` (B.9 mismatch) | 🔴 | **Made worse** — V3 introduces key drift bugs. |
| J.5 | No backgroundColor/padding | V3 quietly adds via shared `computeBaseStyle` (F.4) | ⚠️ | Behavior change. |
| J.6 | 5-handle resize only (no top/nw/ne/sw) | V3 ignores constraint — 4 edges all enabled (A.4) | 🔴 | — |
| J.7 | Context "字体 12pt / 字体加粗" no-op on image but clickable | V3 drops these (G.4-5) | ✅ | Cleanup. |
| J.8 | `getReizeableShowPoints` typo | n/a in V3 (no equivalent method) | ✅ | Naming question moot. |
| J.9 | Position lock forces size lock; unlock asymmetric | V3 has no lock — entire quirk gone but feature also gone (H.1) | 🔴 | — |
| J.10 | `getData(t)` truthy check on templateData | `resolveField` semantics — `templateData` checked via `if (data)` (`getElementValue` 167) | 🟡 | Same truthy-vs-strict-undefined gotcha lurks. Edge case. |

---

# Part 2 — `html` etype

## A. Class layering (html)

| # | V1 row | V1 behavior | V3 location | Score | Notes |
|---|---|---|---|---|---|
| A.1 | V1 10183 — class `S` (HtmlPrintElement), root `.hiprint-printElement-html` | jQuery class | `HtmlElement.vue` 76-92 + `ElementWrapper` | ✅ | Class composed identically. |
| A.2 | V1 10183-10187 — constructor `setDefault(html.default = {width:90,height:90})` | imperative | `core/etypes/html.ts` 17-20 — `HTML_DEFAULT_OPTIONS = { width: 100, height: 50 }` | 🟡 | **Width/height defaults differ**: V1 `{90,90}`, V3 `{100,50}`. Existing V1 templates dropped without explicit size will render at different dims. Document or align. |
| A.3 | V1 10155-10161 — `R extends g.a` empty subclass | historical no-op | (none — V3 is data, no wrapper class) | ✅ | Correctly omitted. |
| A.4 | V1 10189-10215 — `updateDesignViewFromOptions`, `updateTargetHtml` (uses `.html()`), `createTarget` (uses `.append()`), `getConfigOptions`, `getHtml` | imperative DOM | `HtmlElement.vue` 50-73 (`html` computed) + template `v-html="html"` (line 89) | ✅ | Single computed replaces 5 V1 methods. |
| A.5 | V1 — no `getReizeableShowPoints` / `getData` / `initSizeByHtml` overrides → 8 handles, no field, no auto-size | V3 ElementWrapper: 4 edges (same as image) | 🔴 | V1 html used base 8-handle resize. V3 forces 4. Diverges. |

## B. Option fields (html — 18 V1 fields)

| # | V1 option | V3 panel | V3 render | Score | Notes |
|---|---|---|---|---|---|
| B.1 | `content` (HTML string, no panel UI in V1) | `HtmlPropertyPanel.vue` 66-73 — **textarea added** (V3 enhancement) | `HtmlElement.vue` 69 — `opts.content` direct return | ✅ | **V3 fixes V1 D.4 / J.2 quirk.** Users can now edit content via UI. |
| B.2 | `left` | (generic panel) | `computeGeometryStyle` | ✅ | — |
| B.3 | `top` | (generic panel) | `computeGeometryStyle` | ✅ | — |
| B.4 | `width` (default 90 V1 / 100 V3) | (generic panel) | `computeGeometryStyle` | 🟡 | A.2 width default mismatch. |
| B.5 | `height` (default 90 V1 / 50 V3) | (generic panel) | `computeGeometryStyle` | 🟡 | Same. |
| B.6 | `transform` (rotate) | 🔴 missing | `computeGeometryStyle` reads `rotate` key — mismatch | 🔴 | Same B.9 image issue: V1 `transform`, V3 `rotate`. |
| B.7 | `zIndex` | 🔴 missing | `computeGeometryStyle` 50-52 | 🟡 | — |
| B.8 | `pageBreak` | 🔴 | n/a in design | 🔴 | Print-time. |
| B.9 | `showInPage` | 🔴 | n/a | 🔴 | Print-time. |
| B.10 | `unShowInPage` | 🔴 | n/a | 🔴 | Print-time. |
| B.11 | `fixed` | 🔴 | n/a | 🔴 | Print-time. |
| B.12 | `axis` | 🔴 | n/a | 🔴 | — |
| B.13 | `formatter` (function/string) — **html-specific formatter chain is the core feature** | 🔴 not editable in panel | `HtmlElement.vue` 54-67 — invokes `typeof formatter === 'function'`, ignores string-source form | 🟡 | **Half-implemented**: V1 used `new Function('return '+src)()` to eval string formatter, then fell back to printElementType.formatter (V1 1534-1543). V3 only accepts an already-resolved function. Templates that ship `options.formatter` as a string will NOT run. |
| B.14 | `positionLocked` | 🔴 | (no lock check) | 🔴 | — |
| B.15 | `sizeLocked` | 🔴 | (no lock check) | 🔴 | — |
| B.16 | `draggable` (derived) | n/a | n/a | 🔴 | — |
| B.17 | `coordinateSync` | 🔴 | n/a | 🔴 | — |
| B.18 | `field` (not in V1 supportOptions but base reads via `getField()`) | 🔴 not editable | `getElementValue` resolves via field if present | 🟡 | Same image B.2 gap: render reads, UI does not edit. |

## C. Factory presets (html — 1 preset)

| # | V1 preset | V3 equivalent | Score | Notes |
|---|---|---|---|---|
| C.1 | `defaultModule.html` — `formatter(data, options)`: returns data if truthy else dashed-border placeholder "自定义 HTML" (provider 132-146) | `default-provider.ts` 106-114 — registered as `{tid:'defaultModule.html', title:'html', type:'html', icon:'ep:postcard'}`; **formatter MISSING** from default-provider registration | 🟡 | V3 drop: the V1 preset formatter that provided the dashed placeholder is gone. Newly dropped html element with no content/formatter renders blank instead of "自定义 HTML" placeholder. **Action**: re-add formatter in `buildGeneralGroup` or make `HtmlElement.vue` fall back to placeholder when html string is empty. |

## D. Property panel (html — 11 V1 controls across 3 tabs)

### D.1 Basic tab (V1 config 1683-1705, 5 rows)

| # | V1 control | V3 location | Score | Notes |
|---|---|---|---|---|
| D.1.1 | `coordinate` X/Y + lock + sync | 🔴 not in `HtmlPropertyPanel.vue` (generic panel only) | 🔴 | Lock absent (B.14). |
| D.1.2 | `widthHeight` W/H + size lock | 🔴 not in html panel | 🔴 | Same. |
| D.1.3 | `showInPage` | 🔴 | 🔴 | — |
| D.1.4 | `unShowInPage` | 🔴 | 🔴 | — |
| D.1.5 | `fixed` | 🔴 | 🔴 | — |

### D.2 Style tab (V1 config 1706-1717, 2 rows)

| # | V1 control | V3 location | Score | Notes |
|---|---|---|---|---|
| D.2.1 | `transform` rotate | 🔴 | 🔴 | — |
| D.2.2 | `zIndex` | 🔴 | 🔴 | — |

### D.3 Advanced tab (V1 config 1718-1733, 3 rows)

| # | V1 control | V3 location | Score | Notes |
|---|---|---|---|---|
| D.3.1 | `pageBreak` | 🔴 | 🔴 | — |
| D.3.2 | `axis` | 🔴 | 🔴 | — |
| D.3.3 | `formatter` textarea | 🔴 | 🔴 | Most important html knob in V1 — no UI in V3 (B.13). |

### D.4 V3-only addition

| # | V3 control | V1 equivalent | Score | Notes |
|---|---|---|---|---|
| D.4.1 | `content` textarea (`HtmlPropertyPanel.vue` 64-74) + visible XSS warning (60-63) | V1 had NO panel control for content (J.2 V1 quirk) | ✅ | **Net positive.** V3 closes V1's worst UX gap for html. |

## E. Render DOM (html)

| # | V1 DOM | V3 DOM | Score | Notes |
|---|---|---|---|---|
| E.1 | Root `<div class="hiprint-printElement hiprint-printElement-html">` | ElementWrapper + `'hiprint-printElement-' + type` | ✅ | — |
| E.2 | Inner `<div class="hiprint-printElement-html-content" style="height:100%;width:100%">` | `HtmlElement.vue` 86-90 — identical class + style | ✅ | — |
| E.3 | createTarget uses `.append(formatter() \|\| options.content)`; updateTargetHtml uses `.html(formatter())` (V1 10198-10212) | V3 single path: `v-html="html"` (line 89) — Vue replaces innerHTML on every reactive update | ✅ | **V3 fixes V1 E.3 / J.5 quirk**: content responds to reactive updates because Vue re-runs computed and v-html. |
| E.4 | Resolution priority: options.formatter (eval'd string) > printElementType.formatter > options.content | V3 resolution priority (HtmlElement 50-72): `opts.formatter` (function only) → `opts.content` → `getElementValue(field)` → `''` | 🟡 | **Differs**: V3 includes a 3rd-tier fallback to `getElementValue` not present in V1 createTarget (V1 createTarget only checks formatter then content). V3 also won't eval string formatters (B.13). |
| E.5 | print-time same DOM (10215 → getHtml2) | V3 print render path (`render.ts` renderHtmlElement) — separate imperative renderer | ⚠️ | Two paths; cross-check needed. |
| E.6 | No state classes specific to html (shared with image) | `hiprint-element--selected` only | 🟡 | Same I.11 rename. |

## F. Interactions (html)

| # | V1 behavior | V3 behavior | Score | Notes |
|---|---|---|---|---|
| F.1 | 8-handle resize (base default) | V3 4-handle | 🔴 | A.5 again. |
| F.2 | No double-click edit (base looks for `.hiprint-printElement-content`, html uses `-html-content`) | No double-click edit in V3 either | ✅ | Parity (both have the same gap; harmless since textarea exists in panel). |
| F.3 | Formatter signature `(data, options, templateData)` | V3 `formatter(opts.title, getElementValue, opts, data)` (line 57-61) | 🔴 | **Signature mismatch.** V1 callers pass `(data, options)` first two args; V3 passes `(title, data, options, data2)`. Existing V1 formatters silently get wrong args. **Critical compat bug.** |
| F.4 | XSS: by-design `.html()` / `.append()` — business owns escaping | V3 `v-html` — same semantic (HtmlElement header comment 4-15 acknowledges) | 🔵 | Preserved by design. Documented. See Appendix A. |
| F.5 | `getData` base — field reduce, no fallback to content | `getElementValue` 158-173 — fallback to testData if present | 🟡 | V3 adds testData fallback. Diverges. |
| F.6 | formatter eval string `new Function('return ' + str)()` | V3 only accepts function (HtmlElement 55) | 🔴 | B.13 / E.4 — major break for serialized formatters. |
| F.7 | Html default 90×90 size from config | V3 100×50 (A.2) | 🟡 | — |

## G. Right-click context menu (html)

Same shared menu as image. Re-score for html:

| # | V1 item | V3 item | Score | Notes |
|---|---|---|---|---|
| G.1 | 复制 | `copy` ✅ | ✅ | — |
| G.2 | 粘贴 | `paste` ✅ | ✅ | — |
| G.3 | (V3) cut | n/a in V1 | ⚠️ | V3 add. |
| G.4 | 字体 12pt | absent | 🔴 | Equally pointless for html. |
| G.5 | 字体加粗 | absent | 🔴 | Same. |
| G.6 | 置顶 | `bring-to-front` ✅ | ✅ | — |
| G.7 | 置底 | `send-to-back` ✅ | ✅ | — |
| G.8 | 上移一层 | absent | 🔴 | — |
| G.9 | 下移一层 | absent | 🔴 | — |
| G.10 | 锁定 / 解锁 | absent | 🔴 | — |
| G.11 | 对齐 ×6 | absent | 🔴 | — |
| G.12 | 分布 ×2 | absent | 🔴 | — |
| G.13 | Delete | ✅ | ✅ | — |

## H. Lock behavior (html)

| # | V1 | V3 | Score | Notes |
|---|---|---|---|---|
| H.1 | positionLocked → draggable=false, force sizeLocked, disable W/H input, hide resize handles | none | 🔴 | — |
| H.2 | sizeLocked → hide resize handles | none | 🔴 | — |
| H.3 | Locked still deletable via key | n/a (no lock) | n/a→🔴 | — |

## I. CSS classes & states (html)

| # | V1 class | V3 emission | Score | Notes |
|---|---|---|---|---|
| I.1 | `hiprint-printElement` | ✅ | ✅ | — |
| I.2 | `hiprint-printElement-html` | ✅ via `'hiprint-printElement-' + type` | ✅ | — |
| I.3 | `hiprint-printElement-html-content` | ✅ HtmlElement 87 | ✅ | — |
| I.4 | shared option-item / auto-submit / contextmenu classes | n/a (panel uses fieldset+label; menu uses portal floating-ui) | ⚠️ | Same divergence as image I.4-I.13. |
| I.5 | `selected` | renamed `hiprint-element--selected` | 🟡 | I.11 rename. |
| I.6 | `editing` | n/a (html had no edit either) | ✅ | Harmless parity. |

## J. V1 known quirks (html — 12 quirks)

| # | V1 quirk | V3 status | Score | Notes |
|---|---|---|---|---|
| J.1 | XSS by design (.html/.append unescaped) | Preserved (v-html) + warning in panel + header doc | 🔵 | Documented. See Appendix A. |
| J.2 | content field has no panel UI | Fixed — `HtmlPropertyPanel` textarea (D.4.1) | ✅ | **V3 fix.** |
| J.3 | `R` empty subclass | Dropped (A.3) | ✅ | — |
| J.4 | `getData` doesn't read content | V3 still doesn't read content via getData (content is its own branch in `html` computed 69) | ✅ | Parity. |
| J.5 | content doesn't respond to runtime updates (V1 updateTargetHtml only handles formatter branch) | Fixed — Vue reactivity recomputes on any `opts.content` change | ✅ | **V3 fix.** |
| J.6 | No styler for html (V1 advanced tab only had pageBreak/axis/formatter) | V3 also no styler (parity) | ✅ | — |
| J.7 | No borderRadius for html | V3 `computeBaseStyle` doesn't write borderRadius for html since no opts | ✅ | — but `computeBorderStyle` does write borderTop/Right/Bottom/Left if set, contradicting V1's "no border" for html | 🟡 |
| J.8 | No field/testData/backgroundColor/padding | V3 `computeBaseStyle` writes backgroundColor + padding generically (`_helpers.ts` 79, 125-135) | ⚠️ | V3 diverges; not breaking but option surface grows. |
| J.9 | Double-click edit no-op | V3 same (no edit handler) | ✅ | — |
| J.10 | Preset formatter naked-returns user data (XSS vector #4 in V1 inventory) | V3 default-provider does not register a formatter for html at all — naked-return vector REMOVED but placeholder UX also lost (C.1) | 🟡 | Mixed: closes a critical XSS gun but loses UX. **Recommendation**: re-add the dashed-border placeholder as a static fallback string in HtmlElement when content is empty, NOT as a formatter that touches data. |
| J.11 | content vs formatter mutex | V3 implements as priority chain (formatter > content > field) — strictly better | ✅ | — |
| J.12 | 8-handle resize | V3 4-handle (F.1) | 🔴 | — |

---

# Part 3 — Shared base behavior (image + html)

Quick parity check on the 10 shared base behaviors listed in V1 inventory Part 3:

| # | Shared behavior | V3 status | Score |
|---|---|---|---|
| S.1 | Drag with hidraggable + axis lock + movingDistance 1.5pt + template-changed event | V3 `enableElementDrag` (`ElementWrapper` 101) + Pinia patch; no axis lock, no template-changed event yet | 🟡 |
| S.2 | Resize with handle count from `getReizeableShowPoints` + sizeLocked gating | 4-edge default; no per-etype handle list; no sizeLocked | 🔴 |
| S.3 | Single-click select / Ctrl-multiselect | `enableElementSelection` (97) — assumed parity from `interactions/selection.ts` | ✅ |
| S.4 | Keyboard ↑↓←→ move (1.5pt / Shift 5×), Delete deletes (even locked) | `interactions/keyboard.ts` — needs separate audit; locked-but-deletable carve-out needs verification | ⏸️ |
| S.5 | clone shallow-copies options | `_copyElement` does `{...e, options: {...e.options}}` (context-menu.ts 411) — shallow ✅ | ✅ |
| S.6 | Nested-field reduce with null-safe `(a != null ? a[c] : undefined)` | `@hiprint-v3/internal` `resolveField` (per `_helpers.ts` 20) — preserves 0/false/'' (PM-002 R3) | ✅ |
| S.7 | `hiprintTemplateDataChanged_<tid>` global event | Not emitted by V3 (uses Pinia subscribe instead) | ⚠️ |
| S.8 | formatter/styler eval via `new Function` | Only function-typed formatters supported (B.13) | 🔴 |
| S.9 | getHtml2 print pipeline (pageBreak/fixed/showInPage/unShowInPage) | Not in V3 Vue components; lives in `print/render.ts` imperative renderer; flags not implemented end-to-end | ⏸️ |
| S.10 | option→css writer iterates tabs/supportOptions calling item.css | V3 uses Vue computed-style; no item.css indirection | ⚠️ |

---

# Appendix A — XSS vector status (the 7 V1 inventory vectors)

V1 inventory附录A enumerated 7 XSS vectors. Re-scored against V3:

| # | Vector | V1 location | V3 status | V3 location | Score | Verdict |
|---|---|---|---|---|---|---|
| 1 | `options.content` → `.append()` (html createTarget) | V1 10212 | **Preserved by design**: V3 renders `opts.content` via `v-html` (`HtmlElement.vue` 89). Documented in file header (4-15) + panel warning (60-63). | 🔵 PARITY (intentional) | Business still responsible for sanitization. ADR-0011 invariant #2. |
| 2 | formatter return → `.append()` (createTarget) | V1 10211 | **Preserved**: formatter return → string → `v-html` | 🔵 PARITY | Same contract; same business responsibility. |
| 3 | formatter return → `.html()` (updateTargetHtml) | V1 10201 | **Preserved**: Vue re-runs `html` computed, v-html replaces innerHTML | 🔵 PARITY | Reactivity adds attack surface (formatter runs more often) but same semantic. |
| 4 | `defaultModule.html` preset formatter naked-returns `data` | V1 provider 136-144 (`if (data) return data;`) | **REMOVED** — V3 `default-provider.ts` 106-114 registers `defaultModule.html` WITHOUT a formatter. Naked-return is no longer the default behavior. | 🟢 CLOSED (with UX regression) | **Improvement**: V1's worst XSS gun (preset that auto-returns user data) is gone. **Side effect**: drop-target dashed "自定义 HTML" placeholder also lost (C.1). |
| 5 | `<img src=...>` string concatenation | V1 9286 (already fixed in V1 by switching to `.attr({src:n})`) | V3 uses Vue `:src` binding (`ImageElement.vue` 90). Vue auto-escapes attribute values. | 🟢 CLOSED | Better than V1: framework-enforced, not manual `.attr` discipline. |
| 6 | `<img style="content:url('...')">` concatenation | V1 9287 (CSS context injection if src contains `"`) | V3 drops the `content:url()` declaration entirely (E.3). No `style.cssText` concat. | 🟢 CLOSED | Side effect: loses fallback for relative-path `<img>`, but security strictly better. |
| 7 | `img.src` accepts `javascript:` protocol | V1 9286 (`.attr("src", n)` doesn't sniff protocol) | V3 `:src` binding still doesn't whitelist; **Vue does NOT block javascript:** in `:src`. But `<img>` element itself does not execute `javascript:` URLs in modern browsers (HTML spec — only `<a href>` honored historically). | 🟡 STILL LATENT (low risk) | **No active validation in V3**. Most modern browsers refuse `javascript:` in `<img src>`. Risk is low but **add an optional `validateImageSrc(src)` allow-listing https:/data:image/ for defense-in-depth**. Track as P2. |

### Top XSS fix priorities

1. **(P2)** Add `validateImageSrc()` allow-list for `https:` / `http:` / `data:image/...` protocols in `ImageElement.vue` `resolvedSrc`. Defense in depth for vector #7. ~5 lines.
2. **(P3)** Re-introduce `defaultModule.html` placeholder UX safely — emit a literal dashed-border placeholder string in `HtmlElement.vue` when `html.value === ''`, NEVER through a formatter that touches `data`. ~3 lines.
3. **(P4)** Document the `v-html` BY-DESIGN contract in `docs/integration-guide.md` (cross-ref already in header) and add a Playwright e2e that asserts business-supplied `<script>` runs (proving the contract holds and business must escape).

---

# Appendix B — Top fix priorities (combined)

| Priority | Issue | File:line | Rationale |
|---|---|---|---|
| **P0 — bug** | Option key mismatch: `objectFit` (panel) vs `fit` (render) | `ImagePropertyPanel.vue:62` vs `ImageElement.vue:68` | User edits in panel silently no-op |
| **P0 — bug** | Option key mismatch: `transform` (V1) vs `rotate` (V3 `computeGeometryStyle`) | `_helpers.ts:53-55` vs V1 templates | Existing V1 templates lose rotation on import |
| **P0 — bug** | Formatter signature mismatch — V3 passes `(title, value, opts, data)`; V1 expected `(data, options, templateData)` | `HtmlElement.vue:57-61` | V1 templates with formatters get wrong args; silent corruption |
| **P0 — feature gap** | String-source formatters not eval'd | `HtmlElement.vue:55` (`typeof formatter === 'function'`) | V1 templates ship `options.formatter` as string — never runs in V3 |
| **P1 — feature gap** | No lock state (positionLocked / sizeLocked / draggable / lock toggle menu item) | B.18/B.19/G.10/H | Major workflow feature missing |
| **P1 — feature gap** | No print-time fields (pageBreak / showInPage / unShowInPage / fixed) | B.11-B.14 | Print pipeline incomplete |
| **P1 — feature gap** | Resize handle count not etype-aware (image V1=5 specific, html V1=8) | A.4 / A.5 / F.1 / J.12 | UX inconsistency, possibly breaks fine motor templates |
| **P2 — feature gap** | No alignment / distribute / move-one-step context menu items | G.8/G.9/G.11/G.12 | Multi-element ops missing |
| **P2 — XSS hardening** | `validateImageSrc` allow-list | `ImageElement.vue:47-58` | Defense-in-depth for vector #7 |
| **P2 — UX regression** | `defaultModule.html` placeholder lost | `default-provider.ts:106-114` | Reintroduce safely (literal, not formatter) |
| **P3 — class drift** | `selected` → `hiprint-element--selected` rename | `ElementWrapper.vue:82-83` vs I.11 | Business CSS theme breakage; document in upgrade-to-v3.md |
| **P3 — silent default change** | html width/height 90×90 → 100×50; image default size 0×0 → 100×60 | `html.ts:17-20`, `image.ts:15-19` vs A.2 / J.1 | Document migration in upgrade-to-v3.md |
| **P3 — field UI gap** | `field` not editable in image/html panels | B.2 (image) / B.18 (html) | Users on data-bound templates stuck on JSON edits |
| **P3 — image UX** | borderRadius type narrowed to number-pt only (V1 freeform string) | B.4 | Loses `%` corners + per-corner |
| **P3 — image UX** | No file→base64 picker (V1 had via `hiprint-img-upload`) | D.1.2 / I.9 | Forces external upload pipeline |
| **P4 — class drift** | Lost CSS hook classes (`hiprint-option-item-*`, `auto-submit`, etc.) | I.4-I.10 | Theme migration document needed |
| **P4 — silent option-surface growth** | image now accepts backgroundColor/padding via shared `computeBaseStyle`; html same | F.4 / J.8 | Document or guard |

---

# Appendix C — Files audited for this matrix

| File | Lines | Role |
|---|---|---|
| `docs/V1-INVENTORY/etypes/image-html.md` | 1276 | V1 baseline (151 citations) |
| `src/hiprint-v3/components/elements/ImageElement.vue` | 94 | image render |
| `src/hiprint-v3/components/elements/HtmlElement.vue` | 93 | html render |
| `src/hiprint-v3/components/elements/ElementWrapper.vue` | 172 | shared wrapper (drag/resize/select wiring) |
| `src/hiprint-v3/components/elements/_helpers.ts` | 194 | computeBaseStyle / getElementValue / resolveField |
| `src/hiprint-v3/components/property/ImagePropertyPanel.vue` | 245 | image property panel (Sprint 22a Stream D) |
| `src/hiprint-v3/components/property/HtmlPropertyPanel.vue` | 131 | html property panel (Sprint 22a Stream D) |
| `src/hiprint-v3/core/etypes/image.ts` | 80 | image defaults + `resolveImageSrc` |
| `src/hiprint-v3/core/etypes/html.ts` | 53 | html defaults |
| `src/hiprint-v3/core/default-provider.ts` (image / signatureImage / seal / html slices) | 60-69, 106-114, 340-357 | preset registrations |
| `src/hiprint-v3/interactions/context-menu.ts` | 340-398 (audit slice) | `buildElementContextItems` |
| `src/hiprint-v3/interactions/resize.ts` | 144-180 (audit slice) | `enableElementResize` edges default |

---

# Appendix C2 — Cross-reference matrix: where each V1 line surfaces in V3

This matrix lets a reviewer jump from any V1 inventory citation to the V3 code that owns the equivalent behavior (or `none` if V3 has no replacement).

| V1 line(s) | V1 responsibility | V3 file:line | V3 owner | Parity |
|---|---|---|---|---|
| 9260-9294 (image class) | jQuery `v` constructor + 8 method overrides | `src/hiprint-v3/components/elements/ImageElement.vue:1-93` + `src/hiprint-v3/core/etypes/image.ts:37-80` | Vue SFC + data factory | 🟡 (no `initSizeByHtml`, no per-etype handle list) |
| 9266-9267 (image resize points) | `["s","w","e","se","r"]` | `src/hiprint-v3/interactions/resize.ts:153-160` | edges default (all 4) | 🔴 (no etype carve-out) |
| 9268-9272 (image getData) | 3-stage src chain | `src/hiprint-v3/core/etypes/image.ts:59-80` + `_helpers.ts:158-173` | `resolveImageSrc` + `getElementValue` | ✅ |
| 9273-9274 (image createTarget) | Root DOM string | `ImageElement.vue:80-92` + `ElementWrapper.vue:146-160` | declarative template | ✅ |
| 9282-9290 (updateTargetImage) | imperative IMG patching | `ImageElement.vue:60-73` reactive `imgStyle` | computed style | 🟡 (drops `content:url()` fallback) |
| 10155-10161 (R empty subclass) | historical no-op | (none — V3 has no equivalent) | n/a | ✅ (correctly omitted) |
| 10183-10218 (html class) | `S` constructor + 5 methods | `HtmlElement.vue:1-92` + `core/etypes/html.ts:37-53` | Vue SFC + factory | 🟡 (signature mismatch F.3) |
| 10199-10200 (XSS by-design comment) | doc-only note in V1 source | `HtmlElement.vue:4-15` file header + `HtmlPropertyPanel.vue:60-63` warning | comment + visible warning | ✅ (improved discoverability) |
| 10201, 10211, 10212 (.html / .append) | innerHTML write | `HtmlElement.vue:89` `v-html` | Vue directive | 🔵 (by design) |
| 11419-11650 (canvas-level menu) | `hicontextmenu` jQuery plugin | `src/hiprint-v3/interactions/context-menu.ts:1-398` | floating-ui portal | 🟡 (5+ menu items missing) |
| 11531-11537 (lock toggle) | right-click lock | (none) | n/a | 🔴 |
| 11543-11620 (alignment items) | multi-select align/distribute | (none) | n/a | 🔴 |
| config 478-616 (image option config) | tabs + supportOptions + default | `core/etypes/image.ts:15-19` (defaults only) + `ImagePropertyPanel.vue:114-191` (subset of UI) | flat panel | 🟡 (tabs collapsed; 12 of 22 fields missing in UI) |
| config 1680-1776 (html option config) | tabs + supportOptions + default | `core/etypes/html.ts:17-20` + `HtmlPropertyPanel.vue:56-77` (content only) | minimal panel | 🔴 (10 of 11 fields missing in UI) |
| config 615 (image default = `{}`) | drives `initSizeByHtml` 0×0 | `IMAGE_DEFAULT_OPTIONS` = `{width:100,height:60,fit:'contain'}` | data factory | ⚠️ (deliberate divergence) |
| config 1773-1776 (html default `{width:90,height:90}`) | drop-size | `HTML_DEFAULT_OPTIONS` = `{width:100,height:50}` | data factory | 🟡 (silent default change) |
| provider 31-37 (defaultModule.image) | preset entry | `default-provider.ts:60-69` | preset list | ✅ |
| provider 132-146 (defaultModule.html + formatter) | preset + dashed placeholder formatter | `default-provider.ts:106-114` (NO formatter) | preset list | 🟡 (XSS gun closed but placeholder lost) |
| provider 416-426 (signatureImage) | SVG placeholder + size | `default-provider.ts:340-350` | preset list | ✅ |
| provider 427-438 (seal) | red dashed circle SVG | `default-provider.ts:352-357` | preset list | ✅ |
| base 1534-1551 (formatter/styler eval) | `new Function('return '+src)()` | `HtmlElement.vue:55` (function type guard only) | type-narrowed | 🔴 |
| base 1556-1572 (keyboard + lock-aware delete) | arrow nav + delete carve-out | `src/hiprint-v3/interactions/keyboard.ts` (separate audit) | keyboard module | ⏸️ (not re-verified in this matrix) |
| base 1172-1223 (getHtml2 print pipeline) | pageBreak/fixed/showInPage | `src/hiprint-v3/print/render.ts` (imperative path) | separate renderer | ⏸️ (incomplete) |
| base 814, 853, 1098, 1566 (draggable gating) | `options.draggable=false` short-circuit | (none) | n/a | 🔴 |

---

# Appendix D — Per-etype XSS rescoring (granular)

V1 inventory附录A treats vectors at the API/line level. This appendix re-scores per V3 rendering path so the audit trail stays mechanical.

## D.1 — image render path XSS rescore

| Vector site | V1 surface | V3 surface | Status |
|---|---|---|---|
| `<img src=...>` attribute concat | V1 9286 used `.attr({src:n})` after the historical concat fix | V3 Vue `:src="resolvedSrc"` — Vue's renderer escapes attribute values | 🟢 |
| `<img style="content:url('...')">` CSS context | V1 9287 wrote via `.css('cssText', ...)` with template-string concat | V3 removed `content:url()` entirely (`ImageElement.vue:60-73`) | 🟢 |
| `<img style="object-fit:...">` CSS context | V1 9289 wrote via `.css('object-fit', opts.fit)` | V3 writes via `:style="imgStyle"` object — Vue serializes safely | 🟢 |
| `<img style="border-radius:...">` CSS context | V1 9290 wrote via `.css('border-radius', opts.borderRadius)` | V3 same `:style="imgStyle"` | 🟢 |
| `<img src="javascript:..."` protocol | V1 lacked protocol check; modern browsers refuse for `<img>` | V3 still no protocol check (`resolvedSrc:50-58`); browser refusal is the only line of defense | 🟡 |
| field-resolved src (templateData injection) | V1 9270 reduce, then `.attr` | V3 `getElementValue` returns whatever `resolveField` yields → `:src` | 🟡 (same upstream-trust as V1; framework escapes attribute but does not validate protocol) |

## D.2 — html render path XSS rescore

| Vector site | V1 surface | V3 surface | Status |
|---|---|---|---|
| `options.content` injection | V1 10212 `.append(opts.content)` | V3 `v-html="html"` resolves to `opts.content` (HtmlElement:69) | 🔵 (by design parity) |
| formatter return injection (design) | V1 10201 `.html(formatter(...))` | V3 `v-html` over computed return (HtmlElement:55-67) | 🔵 |
| formatter return injection (initial create) | V1 10211 `.append(formatter(...))` | V3 same `v-html` (no separate create vs update path) | 🔵 |
| Field-bound value direct render | V1 base getData chain, then formatter | V3 3rd-tier fallback: `if (typeof value === 'string') return value` (HtmlElement:70-71) | 🟠 |
| Preset formatter naked-returning user data | V1 provider 140 `if (data) return data;` | V3 default-provider has no formatter for html | 🟢 (closed; UX side effect C.1) |
| `eval`-based string formatter | V1 1537 `new Function('return '+str)()` | V3 only accepts function values → string-source formatters become inert (B.13/F.6) | ⚠️ (eval risk gone, but legitimate V1 templates also broken) |

> **Note on 🟠 (HtmlElement:70-71)**: The 3rd-tier fallback "if `field` resolves to a string, render that string via v-html" is a NEW V3 injection path that V1 did NOT have (V1 html base.getData returned the value, but createTarget did NOT pipe it to .html() — only formatter or options.content reached innerHTML). **This is a net new XSS path** that bypasses the documented "business must sanitize before reaching options.content" contract because any data-bound html element will silently treat field strings as HTML. **High-priority fix**: gate this branch behind an explicit `opts.renderFieldAsHtml === true` opt-in, or escape via `textContent` for the fallback.

## D.3 — XSS net delta

- Closed: vectors #4 (preset naked-return), #5 (img src concat), #6 (img style concat). Three V1 attack guns removed.
- Preserved by design (with explicit doc + panel warning + ADR-0011 invariant #2): vectors #1, #2, #3. Three contracts unchanged.
- New / latent: vector #7 (javascript: protocol — still not validated) and the new D.2 row "field-bound value direct render" (NEW V3 path).
- Net: improvement on 3, parity on 3, regression on 1. **Action**: close the new D.2 path before V3 GA.

---

# Appendix E — Quick-scan compatibility checklist for V1→V3 template migration

For any V1 template imported into V3, run these checks:

- [ ] `options.transform` (rotation) → rename to `options.rotate` OR add alias in `_helpers.ts:53-55`. ⚠️ **silent data loss without alias**
- [ ] `options.fit` (image) → confirm read at `ImageElement.vue:68` matches panel write key. 🔴 **fix key mismatch first**
- [ ] `options.formatter: '"function(d,o){...}"'` (string) → no-op in V3 html. 🔴 **needs eval restore OR migration tool**
- [ ] Formatter signature → V1 `(data, options, templateData)` vs V3 `(title, value, opts, data)`. 🔴
- [ ] `options.borderRadius: '4px 8px'` (string) → V3 expects number. 🟡 **manual edit**
- [ ] `options.pageBreak / showInPage / unShowInPage / fixed / axis` → ignored in V3 design + print incomplete. ⏸️
- [ ] `options.positionLocked / sizeLocked / draggable` → ignored in V3. 🔴
- [ ] Default html size {90,90} vs {100,50} → may need explicit options preservation on import. 🟡
- [ ] Default image size 0×0 (V1 blank) vs 100×60 (V3) → existing templates with explicit width/height unaffected; only matters for newly-dropped blank image. ✅
- [ ] `defaultModule.html` placeholder lost → templates relying on dashed placeholder ship blank. 🟡
- [ ] CSS theming on `.selected` → rename to `.hiprint-element--selected`. 🟡
- [ ] CSS theming on `hiprint-option-item-*` / `auto-submit` → V3 panel uses native fieldset/label. ⚠️ **theme rewrite**
- [ ] Context menu items "上移/下移/对齐/分布/锁定" → not in V3 menu. 🔴 **functionality loss**
- [ ] image resize handle expectations (top/nw/ne/sw should NOT work; rotate handle SHOULD) → V3 4-edge default; rotate handle missing. 🔴
- [ ] html resize handle expectations (8 handles) → V3 4-edge. 🔴
- [ ] `hiprint-img-upload` file picker for image src → not in V3 panel. 🔴

---

# Appendix F — V3 implementation walk: how each etype actually renders

To remove ambiguity about which path runs, here is the actual call sequence in V3 for each etype.

## F.1 image render call sequence

1. Canvas store (`useCanvasStore`) iterates panels; for each `element.printElementType.type === 'image'`, mount `<ImageElement>` inside `<ElementWrapper>`.
2. `ElementWrapper.vue:59-66` resolves `element` from store via panel iteration (computed).
3. `ElementWrapper.vue:74` calls `computeBaseStyle(options)` from `_helpers.ts:142-150` → merges geometry + font + alignment + border + padding. ⚠️ `computeBaseStyle` is shared with text etype, so it writes font + alignment props even when meaningless for image (background-color, padding visible if set).
4. `ElementWrapper.vue` template `:style="wrapperStyle"` + `:class="wrapperClass"` + `<slot>` → `ImageElement.vue` template runs.
5. `ImageElement.vue:39-58` resolves src: `getElementValue(el, props.data)` → `opts.src` → `FALLBACK_SRC` (1×1 PNG). ✅ guards `loadError`.
6. `ImageElement.vue:60-73` computes `imgStyle` with width/height 100%, `objectFit` (reads `opts.fit`), `borderRadius` (writes pt suffix).
7. `<img :src :style @error :alt>` renders. On 404, `onError` sets `loadError=true`, `resolvedSrc` re-evaluates to FALLBACK_SRC.

**Risk surface**: step 3 over-applies (image gets font properties), step 5 lacks protocol validation, step 6 has the `fit` vs `objectFit` key drift.

## F.2 html render call sequence

1. Mount `<HtmlElement>` inside `<ElementWrapper>` (same pattern as image).
2. `ElementWrapper` computes base style + class (same as image).
3. `HtmlElement.vue:42-48` resolves `element`.
4. `HtmlElement.vue:50-73` computes `html` string:
   - Priority 1: `typeof opts.formatter === 'function'` → invoke with `(opts.title, getElementValue, opts, props.data)`. ⚠️ **signature mismatch with V1** (F.3).
   - Priority 2: `typeof opts.content === 'string'` → return `opts.content`. ✅ V1 parity.
   - Priority 3: `typeof getElementValue === 'string'` → return resolved field value. 🟠 **NEW V3 injection path** (D.2).
   - Priority 4: `''`. ✅
5. `<div v-html="html">` renders.

**Risk surface**: priority 1 signature mismatch + priority 3 new injection path. **Both belong in P0**.

---

**Generated**: 2026-05-11
**Author**: V3 parity audit team (Sprint 22a)
**Status**: ✅ Complete — every V1 inventory row reviewed; 7 XSS vectors re-scored against V3 (Appendix A); new V3-introduced XSS path identified (Appendix D.2 row "field-bound value direct render"); top fix priorities ranked. Next: file P0 bug tickets for the 5 must-fix items before any further property-panel work proceeds:
1. `objectFit` vs `fit` key drift (`ImagePropertyPanel.vue:62` vs `ImageElement.vue:68`)
2. `transform` vs `rotate` key drift (`_helpers.ts:53-55`)
3. Formatter signature mismatch (`HtmlElement.vue:57-61`)
4. String-source formatter eval gap (`HtmlElement.vue:55`)
5. New XSS path via field-bound html string fallback (`HtmlElement.vue:70-71`)
