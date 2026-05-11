# V3 Parity Matrix — `barcode` & `qrcode` Element Types

**Source baseline**: `docs/V1-INVENTORY/etypes/barcode-qrcode.md` (993 lines, 171 citations).
**V3 source files audited**:
- `src/hiprint-v3/components/elements/BarcodeElement.vue` (152 lines)
- `src/hiprint-v3/components/elements/QrcodeElement.vue` (160 lines)
- `src/hiprint-v3/components/property/BarcodePropertyPanel.vue` (201 lines, Sprint 22a Stream D)
- `src/hiprint-v3/components/property/QrcodePropertyPanel.vue` (173 lines, Sprint 22a Stream D)
- `src/hiprint-v3/core/etypes/barcode.ts` (54 lines)
- `src/hiprint-v3/core/etypes/qrcode.ts` (54 lines)
- `src/hiprint-v3/core/default-provider.ts` (lines 215-307)
- `src/hiprint-v3/components/HiprintCanvas.vue` (componentForType dispatch lines 151-178)
- `src/hiprint-v3/print/render.ts` (renderBarcodeElement/renderQrcodeElement lines 319-446)
- `src/hiprint-v3/schemas/element.ts` (textType / tableTextType fields)

**Legend**
- ✅ Full parity — V3 matches V1 behaviour 1:1.
- 🟡 Partial parity — V3 supports the field but with reduced scope, wrong default, or surface diff.
- 🔴 Missing — V1 feature absent from V3.
- ⚠️ VIOLATION — V3 ships a code path that contradicts the V1 baseline or the project contract (see `.claude/rules/api-contract.md`, `.claude/rules/security.md`).
- ⏸️ Deferred / intentional skip — V3 has decided not to port this V1 feature (must be documented).

---

## Executive summary — single most important finding

V1 ships **two coexisting barcode/qrcode code paths** (see V1 inventory Section 0):
- **Path A** — `type:'text'` + `options.textType:'barcode'|'qrcode'`. JsBarcode (barcode) and qrcode.js (qrcode). **This is the path the factory uses for `defaultModule.barcode`, `defaultModule.qrcode`, `defaultModule.trackingNo`.**
- **Path B** — `type:'barcode'|'qrcode'` standalone bwip-js elements. Not exposed by the factory; library users register manually.

V3 implements **Path B only**. The Vue files `BarcodeElement.vue` / `QrcodeElement.vue` import `bwip-js/browser` directly (line 20 / line 11) and the dispatcher `componentForType` (`HiprintCanvas.vue` lines 159–162) routes ONLY when `element.type === 'barcode'` / `'qrcode'`. There is no JsBarcode dependency in V3 package.json, and there is no `textType:'barcode'` branch inside `TextElement.vue` (verified by `Grep textType` returning zero hits on TextElement.vue).

But V3 `default-provider.ts` (lines 278-304) STILL emits `defaultModule.barcode` / `defaultModule.qrcode` with `type:'text'` + `textType:'barcode'|'qrcode'` (exactly the V1 Path A shape). Combined with the missing Path A handler, **dragging the default 条形码 / 二维码 / 快递单号 preset onto the V3 canvas yields a plain text element that renders the literal value ("123456789", "https://example.com", "SF1234567890") instead of a barcode/qrcode**.

This is the single largest functional regression in V3 for these etypes — flagged below as VIOLATION-1.

---

## Section 0 — Architecture parity (V1 inventory Section 0)

| V1 inventory row | V3 status | Evidence | Notes |
|---|---|---|---|
| Path A exists (`type:'text'` + `textType:'barcode'`, JsBarcode) | ⚠️ VIOLATION-1 — **MISSING in V3** | `Grep textType` on `TextElement.vue` → 0 hits; `package.json` has no JsBarcode | V1 default factory uses this path; V3 cannot render it |
| Path A exists (`type:'text'` + `textType:'qrcode'`, qrcode.js) | ⚠️ VIOLATION-1 — **MISSING in V3** | Same | Same impact |
| Path B exists (`type:'barcode'`, bwip-js) | ✅ implemented | `BarcodeElement.vue:20` `import bwipjs from 'bwip-js/browser'`; `HiprintCanvas.vue:160` | Same library as V1, same `toSVG()` call shape |
| Path B exists (`type:'qrcode'`, bwip-js) | ✅ implemented | `QrcodeElement.vue:11`; `HiprintCanvas.vue:162` | Same library |
| Table-cell `tableTextType:'barcode'` (JsBarcode) | 🔴 schema only, no renderer | `cell.ts:53` declares field; `Grep tableTextType` on table renderer = 0 | Field accepted in template JSON, ignored at render |
| Table-cell `tableTextType:'qrcode'` (qrcode.js) | 🔴 schema only, no renderer | Same | Same |
| Existing template JSON using BOTH shapes must keep working | 🔴 broken for Path A | Per VIOLATION-1 above | Migration plan required (see Risks section) |

**Architectural verdict**: V3 collapses the two paths into one (Path B / bwip-js only) BUT keeps the V1 default-provider data shape (Path A). Either the renderer must learn `textType` or the factory must emit `type:'barcode'`. Currently neither.

---

## Section A — Factory presets parity (V1 inventory Section A)

### A.1 `defaultModule.barcode`

| V1 field | V1 value | V3 value | Status | Source |
|---|---|---|---|---|
| `tid` | `"defaultModule.barcode"` | `"defaultModule.barcode"` | ✅ | `default-provider.ts:278` |
| `title` | `"条形码"` | `"条形码"` | ✅ | `default-provider.ts:279` |
| `field` | `"barcode"` | `"barcode"` | ✅ | `default-provider.ts:280` |
| `type` | `"text"` | `"text"` | ⚠️ VIOLATION-1 — type:text + V3 has no Path A handler ⇒ renders as plain text | `default-provider.ts:281` |
| `icon` | `"ep:list"` | `"ep:list"` | ✅ | `default-provider.ts:282` |
| `options.width` | `140` pt | `140` | ✅ | `default-provider.ts:284` |
| `options.height` | `35` pt | `35` | ✅ | `default-provider.ts:285` |
| `options.textType` | `"barcode"` | `"barcode"` | ⚠️ VIOLATION-1 — emitted but no renderer reads it | `default-provider.ts:286` |
| `options.hideTitle` | `true` | `true` | ✅ | `default-provider.ts:287` |
| `options.testData` | `"123456789"` | `"123456789"` | ✅ | `default-provider.ts:288` |

Verdict: ⚠️ VIOLATION-1. Schema preserved; semantics broken.

### A.2 `defaultModule.qrcode`

| V1 field | V1 value | V3 value | Status | Source |
|---|---|---|---|---|
| `tid` | `"defaultModule.qrcode"` | `"defaultModule.qrcode"` | ✅ | `default-provider.ts:292` |
| `title` | `"二维码"` | `"二维码"` | ✅ | `default-provider.ts:293` |
| `field` | `"qrcode"` | `"qrcode"` | ✅ | `default-provider.ts:294` |
| `type` | `"text"` | `"text"` | ⚠️ VIOLATION-1 — same impact as A.1 | `default-provider.ts:295` |
| `icon` | `"ep:grid"` | `"ep:grid"` | ✅ | `default-provider.ts:296` |
| `options.width` | `50` pt | `50` | ✅ | `default-provider.ts:298` |
| `options.height` | `50` pt | `50` | ✅ | `default-provider.ts:299` |
| `options.textType` | `"qrcode"` | `"qrcode"` | ⚠️ VIOLATION-1 | `default-provider.ts:300` |
| `options.hideTitle` | `true` | `true` | ✅ | `default-provider.ts:301` |
| `options.testData` | `"https://example.com"` | `"https://example.com"` | ✅ | `default-provider.ts:302` |

Verdict: ⚠️ VIOLATION-1. Same as A.1.

### A.3 `defaultModule.trackingNo`

| V1 field | V1 value | V3 value | Status | Source |
|---|---|---|---|---|
| `tid` | `"defaultModule.trackingNo"` | `"defaultModule.trackingNo"` | ✅ | `default-provider.ts:215` |
| `title` | `"快递单号"` | `"快递单号"` | ✅ | `default-provider.ts:216` |
| `field` | `"trackingNo"` | `"trackingNo"` | ✅ | `default-provider.ts:217` |
| `type` | `"text"` | `"text"` | ⚠️ VIOLATION-1 — same | `default-provider.ts:218` |
| `icon` | `"ep:list"` | `"ep:list"` | ✅ | `default-provider.ts:219` |
| `options.width` | `180` pt | `180` | ✅ | `default-provider.ts:221` |
| `options.height` | `50` pt | `50` | ✅ | `default-provider.ts:222` |
| `options.textType` | `"barcode"` | `"barcode"` | ⚠️ VIOLATION-1 | `default-provider.ts:223` |
| `options.barcodeType` | `"code128"` (dead — V1 quirk J.1) | `"code128"` (also dead in V3) | 🟡 inherits J.1; not a fix | `default-provider.ts:224` |
| `options.testData` | `"SF1234567890"` | `"SF1234567890"` | ✅ | `default-provider.ts:225` |
| `hideTitle` | _(unset → false)_ | _(unset → false)_ | ✅ | n/a |

Verdict: ⚠️ VIOLATION-1 — identical regression to A.1 / A.2. Plus the inherited V1 quirk J.1 (`barcodeType` is dead under Path A).

### A.4 V3-only factory presets (Path B element factories)

`core/etypes/barcode.ts` and `core/etypes/qrcode.ts` define `createBarcodeElement` / `createQrcodeElement` for Path B with the following defaults:

| Field | V3 default | Matches V1? |
|---|---|---|
| `type` | `"barcode"` / `"qrcode"` | ✅ matches Path B convention (V1 inv §B.2) |
| `options.width` | 140 (barcode) / 50 (qrcode) | ✅ |
| `options.height` | 35 / 50 | ✅ |
| `options.barcodeType` | `"code128"` | ✅ matches V1 inv §B.2 default |
| `options.qrcodeType` | `"qrcode"` | ✅ matches V1 inv §B.3 default |
| `options.barColor` | `"#000000"` | 🟡 V1 default is `"#000"` (3-char hex); semantically equal but byte-different (serialization comparator) |
| `options.barAutoWidth` | `true` (boolean) | 🟡 V1 stores STRING `"true"` because of J.23 — see `barAutoWidth` row in Section B |
| `options.qrCodeLevel` | `0` | ✅ matches V1 default (M level) |

Note: these factory functions are **NOT** wired into the default `defaultModule` group. They are exported for library users who explicitly call `createBarcodeElement()` — a Path B install. The default factory still uses Path A (see VIOLATION-1).

---

## Section B — Options parity (V1 inventory Section B)

### B.1 Path A — `text + textType` — V3 status

V3 has no Path A. All rows below are ⚠️ VIOLATION-1 unless explicitly mapped to Path B. Listing the V1 fields and their V3 fate:

| V1 option (Path A) | V3 fate | Status |
|---|---|---|
| `field` | Path B `BarcodeElement.vue:52` reads via `getElementValue(el, props.data)` | 🟡 supported in Path B only |
| `title` | Path B reads `opts.title` for title fallback (line 56) — but uses it as encoded payload, not a separate label | 🟡 Path B only; V1 J.5 colon-prefix logic missing entirely |
| `testData` | Path B `BarcodeElement.vue:55` uses fallback `value || testData || title` | ✅ Path B only |
| `hideTitle` | Path B `BarcodeElement.vue:79` `isTrue(opts.hideTitle)`; `QrcodeElement.vue:55` same | ✅ Path B only — accepts bool and `"true"` string via `isTrue()` helper |
| `fontSize` | Path B `BarcodeElement.vue:92` `Math.floor(safeNumber(opts.fontSize, {fallback:10}))` → bwip-js `textsize`; `QrcodeElement.vue:62` → CSS title font | 🟡 Path B only |
| `fontWeight` | not honored by `QrcodeElement.vue` titleStyle (computed only sets textAlign/fontSize/lineHeight) | 🔴 missing in Path B qrcode title |
| `color` | not read by Path B at all; V3 uses `barColor` only | 🔴 V1 `color` → JsBarcode `lineColor` / qrcode.js `colorDark` gone; V3 must read `color` or migrate |
| `textAlign` | `QrcodeElement.vue:64` honors it for title div | ✅ Path B qrcode only |
| `textType` | NOT READ — V3 has no Path A dispatch | ⚠️ VIOLATION-1 |
| `barcodeMode` (CODE128 family — 18 enum values) | NOT read. V3 BarcodeElement reads `opts.barcodeType` only | 🔴 entire enum missing |
| `barTextMode` (`""/"text"/"svg"`) | NOT read | 🔴 missing |
| `barWidth` (1..4 enum) | Path B `BarcodeElement.vue:88` `safeNumber(opts.barWidth, {fallback:1, min:1})` → bwip-js `scale`. Same UI enum 1..4 not exposed; numeric only. | 🟡 Path B accepts the number; V1 enum-style select missing |
| `barAutoWidth` (`""/"true"/"false"`, V1 string-typed) | Path B `BarcodeElement.vue:83` `isTrue(opts.barAutoWidth)` — accepts bool or `"true"` string | 🟡 V1 J.23 partially mitigated (`isTrue` accepts both); but no `<select>` UI in V3 BarcodePropertyPanel |
| `qrCodeLevel` (int 0/1/2/3 → L/M/Q/H) | Path B `QrcodeElement.vue:92-94` `(['M','L','H','Q'])[safeNumber(opts.qrCodeLevel,{...})]` | 🟡 Path B encoding only — see VIOLATION-3 below: V3 panel writes string `'L'/'M'/'Q'/'H'` to `errorCorrectionLevel`, NOT int to `qrCodeLevel` |
| `lineHeight` | Path B `BarcodeElement.vue:76`, `QrcodeElement.vue:84` — honored | ✅ Path B only |
| `coordinate` (`left`/`top`) | inherited from ElementWrapper (not audited here) | ✅ |
| `widthHeight` (`width`/`height`) | inherited | ✅ |
| `positionLocked` / `sizeLocked` | inherited | ✅ |
| `rotate` | inherited | ✅ |
| `zIndex` | inherited | ✅ |
| `pageBreak` | not yet wired in V3 print pipeline (out of scope; see other matrix) | 🔴 element-level page break missing |
| `dataType` / `format` (date/bool/number formatting) | not read by Path B BarcodeElement/QrcodeElement | 🔴 missing; only TextElement handles these |
| `formatter` (V1 line 10050; `new Function('return '+str)()`) | Path B uses raw `opts.formatter` via `safelyCall` in render.ts:235; BUT `BarcodeElement.vue` does NOT run formatter on the encoded payload | 🔴 designer-side formatter not invoked for barcode/qrcode |
| `styler` | not read | 🔴 missing |
| `upperCase` (`""/"upper"/"lower"`) | not read | 🔴 missing — important for CODE39 |
| `draggable` | inherited | ✅ |

### B.1.2 `barcodeMode` enum (V1 inv §B.1.2 — 18 selectable values, JsBarcode vocab)

| V1 stored value | V3 supported? | Notes |
|---|---|---|
| `""` (default → CODE128) | 🔴 | V3 has no `barcodeMode` field |
| `CODE128A` | 🔴 | V3 only knows bwip-js `code128` (one variant) |
| `CODE128B` | 🔴 | |
| `CODE128C` | 🔴 | |
| `CODE39` | 🔴 (V3 panel has `CODE39` option but writes to `format`, not used by renderer — see VIOLATION-2) | |
| `EAN13` | 🔴 (same — `format` is dead) | |
| `EAN8` | 🔴 | |
| `EAN5` | 🔴 | |
| `EAN2` | 🔴 | |
| `UPC` | 🔴 | |
| `ITF` | 🔴 | |
| `ITF14` | 🔴 | |
| `MSI` | 🔴 | |
| `MSI10` | 🔴 | |
| `MSI11` | 🔴 | |
| `MSI1010` | 🔴 | |
| `MSI1110` | 🔴 | |
| `Pharmacode` | 🔴 | |

All 18 ⇒ 🔴 missing. JsBarcode is not installed in V3. (Note: the lowercase bwip-js equivalents in §B.2.1 ARE reachable via `opts.barcodeType`.)

### B.1.3 Fixed-value JsBarcode args (V1 §B.1.3)

V3 has no JsBarcode renderer. All 5 hard-coded args (textMargin:-1, margin:0, height, displayValue, preserveAspectRatio) are 🔴 missing in V3 Path A — but bwip-js Path B has its own equivalents:

| V1 hard-coded arg | V3 bwip-js equivalent | Status |
|---|---|---|
| `textMargin: -1` | bwip-js default textgaps | 🟡 different default, no override |
| `margin: 0` | bwip-js default quietZone | 🟡 visual difference |
| `height` derived from options.height in px | `BarcodeElement.vue:81` `pt.toMm(heightPt - titleH)` floored | 🟡 unit drift (mm vs px) |
| `displayValue: !hideTitle` | `BarcodeElement.vue:91` `includetext: !hideTitle` | ✅ semantic match |
| Force `width="100%"` `height="100%"` on output SVG | `BarcodeElement.vue:98` `setAttribute('preserveAspectRatio', 'none slice')` but width/height NOT forced 100% | 🟡 partial — see B.2.2 row |
| `barAutoWidth` auto-grow into options.width | `BarcodeElement.vue:89` `width: !barAutoWidth ? Math.floor(widthMm) : '' as unknown as number` — passes empty to bwipjs | 🟡 different mechanism; V1 grew the container post-render, V3 sends `''` to bwipjs to auto-fit |

### B.1.4 Fixed-value qrcode.js args (V1 §B.1.4)

V3 has no qrcode.js. All 5 args (width 100%, height 100%, useSVG true, colorDark from options.color, no colorLight) are replaced by bwip-js equivalents:

| V1 qrcode.js arg | V3 bwip-js equivalent | Status |
|---|---|---|
| `width:"100%"` CSS | bwip-js `width` in mm — `QrcodeElement.vue:100` `width: square` | 🟡 unit/mechanism diff |
| `height:"100%"` | same | 🟡 |
| `useSVG: true` | bwip-js `toSVG()` is always SVG | ✅ |
| `colorDark: options.color \|\| "#000000"` | V3 reads `opts.barColor`, not `opts.color` | 🔴 field rename — V1 templates with `color:"#ff0000"` will not colour V3 qrcodes |
| `colorLight` default `#fff` | bwip-js default | ✅ |
| Box squared to `Math.min(w,h)` in pt | `QrcodeElement.vue:91` `Math.floor(Math.min(widthPx/2.835, heightPx/2.835))` in mm | ✅ same intent — preserves J.8 quirk |
| Title space reservation `h - lineHeight` | `QrcodeElement.vue:88` `heightPx = pt.toPx(heightPt - titleH)` | ✅ matches |

### B.2 Path B — `type:'barcode'` (V1 inv §B.2)

| V1 option (Path B) | V3 BarcodeElement reads | Status | Source |
|---|---|---|---|
| `field` | via `getElementValue(el, props.data)` | ✅ | `BarcodeElement.vue:52` |
| `title` | line 56 as fallback in payload (V1 J.11) | ✅ same behaviour |
| `testData` | line 55 fallback | ✅ |
| `hideTitle` | line 79 `isTrue` | ✅ accepts bool + `"true"` |
| `width`, `height` | lines 74-75 | ✅ |
| `lineHeight` | line 76 | ✅ |
| `fontSize` | line 92 → bwip-js `textsize` | ✅ |
| `barcodeType` | line 86 → bwip-js `bcid` (default `'code128'`) | ✅ |
| `barWidth` | line 88 → bwip-js `scale` | ✅ |
| `barAutoWidth` | line 83 `isTrue` | ✅ |
| `barColor` | line 93 → bwip-js `barcolor` (default `'#000'`) | ✅ |
| `positionLocked`/`sizeLocked`/`rotate`/`zIndex` | inherited from ElementWrapper | ✅ |
| `pageBreak` | not wired in print pipeline | 🔴 |
| `formatter` | NOT invoked by BarcodeElement.vue (it goes through `getElementValue` which doesn't run formatter) | 🔴 missing |
| `styler` | not read | 🔴 |
| `upperCase` | not read | 🔴 |
| `coordinate` | inherited | ✅ |

### B.2.1 `barcodeType` enum (V1 §B.2.1 — 84 selectable values across 11 optgroups)

Stored as `opts.barcodeType`, passed verbatim to bwip-js `bcid`. V3 BarcodeElement at line 86 honors any string. **However the V3 BarcodePropertyPanel does not expose this field** — it only exposes a 7-option `format` select (CODE128/EAN13/EAN8/UPC/ITF14/CODE39/CODE93) written to a DIFFERENT key. So:

- ✅ via template JSON / `addPrintElementTypes` — all 84 bwip-js types reachable (renderer accepts them)
- 🔴 via property panel UI — only 7 hard-coded values, and they go to the wrong key (`format` not `barcodeType`) ⇒ ⚠️ VIOLATION-2 (see below)

Per-row (groups from V1 inv §B.2.1):

| Group | V1 count | V3 reachable via JSON | V3 reachable via UI panel |
|---|---|---|---|
| Default | 1 | ✅ | 🔴 (panel default is `CODE128` not `''`) |
| 商品条码 (ean13/ean8/upca/upce/isbn/ismn/issn) | 7 | ✅ | 🔴 |
| 条形码 (code39/code39ext/code93/code93ext/code128/interleaved2of5) | 6 | ✅ | 🟡 (panel offers `CODE39`/`CODE93`/`CODE128` UPPERCASE — wrong key, dead) |
| 物流 (ean14/gs1-128/itf14/sscc18) | 4 | ✅ | 🔴 |
| GS1 DataBar | 8 | ✅ | 🔴 |
| 邮政和快递编码 | 12 | ✅ | 🔴 |
| 医疗产品编码 | 8 | ✅ | 🔴 |
| 不常用编码 | 19 | ✅ | 🔴 |
| GS1 复合编码 | 12 | ✅ | 🔴 |
| 附加组件 (ean2/ean5/gs1-cc) | 3 | ✅ | 🔴 |
| 实验编码 (raw/daft/flattermarken) | 3 | ✅ | 🔴 |

### B.2.2 Fixed-value bwip-js args (Path B barcode — V1 §B.2.2)

| V1 bwip-js arg | V3 BarcodeElement value | Status |
|---|---|---|
| `bcid` (barcodeType \|\| 'code128') | line 86 same | ✅ |
| `text` (text \|\| testData \|\| title) | computed lines 53-58 same | ✅ matches V1 J.11 fallback chain |
| `scale` (barWidth \|\| 1) | line 88 `safeNumber(...,{fallback:1, min:1})` | ✅ |
| `width` (mm; `''` if barAutoWidth) | line 89 same idiom (`'' as unknown as number`) | ✅ |
| `height` (mm; minus title space) | line 90 `Math.floor(heightMm)` where heightMm = `pt.toMm(heightPt - titleH)` | ✅ |
| `includetext` (`!hideTitle`) | line 91 same | ✅ |
| `textsize` (fontSize \|\| 10) | line 92 same | ✅ |
| `barcolor` (barColor \|\| '#000') | line 93 same | ✅ |
| Post-render `preserveAspectRatio:"none slice"` | line 98 same | ✅ |
| Post-render auto-grow `options.width = svgWidth * 1.05` | 🔴 **NOT done in V3** | V1 J.7 quirk fixed by omission (good — see Risks) but layout may differ |
| Post-render set parent width to `svgWidth + 'pt'` when overflow | 🔴 NOT done in V3 | Same |

### B.3 Path B — `type:'qrcode'` (V1 inv §B.3)

| V1 option (Path B qrcode) | V3 QrcodeElement reads | Status | Source |
|---|---|---|---|
| `field`/`title`/`testData`/`hideTitle`/`width`/`height`/`lineHeight`/`fontSize`/`textAlign` | similar wiring | 🟡 see per-row below |
| `qrcodeType` | line 97 → bwip-js `bcid` (default `'qrcode'`) | ✅ |
| `qrCodeLevel` (int 0/1/2/3) | line 92-94 `(['M','L','H','Q'])[safeNumber(opts.qrCodeLevel,{...})]` | ✅ — index mapping matches V1 line 10491 |
| `barColor` | line 104 → bwip-js `barcolor` (default `'#000'`) | ✅ |
| `positionLocked`/`sizeLocked`/`rotate`/`zIndex`/`coordinate` | inherited | ✅ |
| `pageBreak` | not wired | 🔴 |
| `formatter`/`styler`/`upperCase` | not read | 🔴 |

### B.3.1 `qrcodeType` enum (V1 §B.3.1 — 19 flat values)

| Group | V1 count | V3 reachable via JSON | V3 reachable via UI |
|---|---|---|---|
| Default + qrcode + microqrcode + swissqrcode + rectangularmicroqrcode | 5 | ✅ (string passed through) | 🔴 panel has no qrcodeType field at all |
| Aztec family (azteccode/aztecrune/azteccodecompact) | 3 | ✅ | 🔴 |
| DataMatrix family (datamatrix/datamatrixrectangular) | 2 | ✅ | 🔴 |
| hanxin / gs1datamatrix / gs1datamatrixrectangular / gs1qrcode | 4 | ✅ | 🔴 |
| HIBC family (hibcdatamatrix/hibcdatamatrixrectangular/hibcmicropdf417/hibcpdf417/hibcqrcode) | 5 | ✅ | 🔴 |

### B.3.2 Fixed-value bwip-js args (Path B qrcode — V1 §B.3.2)

| V1 bwip-js arg | V3 QrcodeElement value | Status |
|---|---|---|
| `bcid` (qrcodeType \|\| 'qrcode') | line 97 same | ✅ |
| `text` (text \|\| testData \|\| title) | computed lines 44-49 same | ✅ |
| `scale: 1` (FIXED) | line 99 `scale: 1` | ✅ FIXED, matches V1 |
| `paddingwidth` / `paddingheight` (centering offsets in px) | 🔴 NOT computed in V3 | V1 quirk J.8 not preserved — V3 simply squares the SVG via min(w,h) on bwip-js side; appearance may differ for non-square containers |
| `width` (mm; squared) | line 100 `square = Math.floor(Math.min(widthPx/2.835, heightPx/2.835))` | ✅ same 2.835 magic (V1 J.25) |
| `height` (mm; squared) | line 101 same | ✅ |
| `includetext: false` (FIXED) | line 102 `includetext: false` | ✅ FIXED |
| `eclevel: ['M','L','H','Q'][qrCodeLevel ?? 0]` | line 92-94 same indexing | ✅ |
| `barcolor` (barColor \|\| '#000') | line 104 | ✅ |
| Appended `.hiprint-printElement-qrcode-content-title` div | template lines 150-156 — Vue `v-if="showTitle"` with `:style="titleStyle"` and `{{ coerceText(qrText) }}` interpolation | ✅ XSS-safe (Vue text interpolation) — **fixes V1 J.18** |
| Title style: `text-align`, `font-size`, `line-height: 1.5` | `titleStyle` computed (lines 58-69) sets all three | ✅ |
| Title style special case for `text-align: justify` (`text-align-last: justify; text-justify: distribute-all-lines;`) | 🔴 NOT implemented | V3 emits plain CSS `text-align: justify` → last line not justified |

### B.4 Table-cell barcode/qrcode (V1 inv §B.4)

V3 schema accepts the fields but the table renderer does not honor them:

| V1 field | V3 schema | V3 renderer | Status |
|---|---|---|---|
| `tableTextType` | declared in `cell.ts:52` | not consumed by `TableCell.vue` | 🔴 dead field |
| `tableBarcodeMode` | declared in `cell.ts:53` | not consumed | 🔴 dead field |
| `tableQRCodeLevel` | declared in `cell.ts:54` | not consumed | 🔴 dead field |
| `tableColumnHeight` | declared in `cell.ts:51` | not consumed for code rendering | 🔴 dead for code paths |
| `showCodeTitle` | declared in `cell.ts:43` | not consumed | 🔴 dead field |
| Hard-coded JsBarcode args (height:10, displayValue:false, format default CODE128A) | n/a | n/a | 🔴 |
| Hard-coded qrcode.js args (correctLevel from tableQRCodeLevel, useSVG:true, hard-coded colorDark `#000000` per V1 J.13) | n/a | n/a | 🔴 |

Total table-cell parity: 🔴 entirely missing in V3. (Note: TableElement / TableCell were owned by parallel agents per `elements/index.ts:9-10`; may be Sprint 22+ scope.)

---

## Section C — Effective defaults (V1 inv §C consolidated)

| Preset | V1 effective renderer | V3 effective renderer | Status |
|---|---|---|---|
| `defaultModule.barcode` | JsBarcode via Path A (CODE128 default) | TextElement renders literal "123456789" | ⚠️ VIOLATION-1 |
| `defaultModule.qrcode` | qrcode.js via Path A | TextElement renders literal "https://example.com" | ⚠️ VIOLATION-1 |
| `defaultModule.trackingNo` | JsBarcode via Path A (CODE128 default; `barcodeType:code128` field is dead) | TextElement renders literal "SF1234567890" | ⚠️ VIOLATION-1 |

---

## Section D — Property panel parity (V1 inv §D)

### D.1 Path A — text-element panel (V1 §D.1)

V1 renders `instance.text` panel which embeds `textType` + `barcodeMode` + `barTextMode` + `barWidth` + `barAutoWidth` + `qrCodeLevel`. V3 has no such combined panel — when the user clicks a Path-A-shaped element, V3 shows the **TextPropertyPanel**, NOT a barcode panel (because the dispatch is by `element.type`, which is `'text'`).

| V1 panel section | V3 status |
|---|---|
| 基础 (field/title/testData/hideTitle) | 🟡 TextPropertyPanel handles these for text mode; no code-aware behaviour |
| 样式 / `textType` switch | 🔴 missing — no UI to toggle a text element into barcode/qrcode mode |
| 样式 / `barcodeMode` | 🔴 missing |
| 样式 / `barTextMode` | 🔴 missing |
| 样式 / `barWidth` | 🔴 missing |
| 样式 / `barAutoWidth` | 🔴 missing |
| 样式 / `qrCodeLevel` | 🔴 missing |
| Resize-handle rebuild on textType change (V1 line 952-953) | 🔴 not applicable — no textType in V3 |

### D.2 Path B — barcode panel (V1 §D.2)

V3 `BarcodePropertyPanel.vue` is the analogue. Per-field:

| V1 panel field | V3 panel field | Status | Notes |
|---|---|---|---|
| `field` | not in V3 panel | 🔴 user cannot bind field via UI (must use template JSON) |
| `title` | not in V3 panel | 🔴 |
| `testData` | not in V3 panel | 🔴 |
| `hideTitle` | `displayValue` checkbox (inverted semantics) | 🟡 ⚠️ VIOLATION-4 — wrong key |
| `barcodeType` (cascader, 84 values) | `format` 7-value select (`CODE128`/`EAN13`/`EAN8`/`UPC`/`ITF14`/`CODE39`/`CODE93`) | ⚠️ VIOLATION-2 — wrong key AND wrong vocab (uppercase / Path A style) — see below |
| `barWidth` (1..4) | not in V3 panel | 🔴 |
| `barAutoWidth` | not in V3 panel | 🔴 |
| `barColor` | `lineColor` color input | 🟡 ⚠️ VIOLATION-4 — wrong key |
| `coordinate` / `widthHeight` / `rotate` / `zIndex` | likely inherited from generic panel | 🟡 (out of scope this matrix) |
| `formatter` / `styler` / `pageBreak` / `upperCase` / `fontSize` / `textAlign` | only `fontSize` and `padding` in V3 | 🔴 most missing |

### D.3 Path B — qrcode panel (V1 §D.3)

V3 `QrcodePropertyPanel.vue`:

| V1 panel field | V3 panel field | Status |
|---|---|---|
| `field` | not in V3 panel | 🔴 |
| `title` | not in V3 panel | 🔴 |
| `testData` | not in V3 panel | 🔴 |
| `hideTitle` | not in V3 panel | 🔴 |
| `qrcodeType` (19 values) | not in V3 panel | 🔴 |
| `qrCodeLevel` (int 0/1/2/3) | `errorCorrectionLevel` string select (`L`/`M`/`Q`/`H`) | ⚠️ VIOLATION-3 — wrong key, wrong type |
| `barColor` | `color` color input | 🟡 ⚠️ VIOLATION-4 — wrong key |
| `padding` | yes (V3-new field, not in V1 panel) | 🟡 V3 addition |
| `backgroundColor` | yes (V3-new field) | 🟡 V3 addition; renderer does not read it (renderer hard-codes bwip-js default) |
| `coordinate`/`widthHeight`/`rotate`/`zIndex` | inherited | 🟡 |
| `formatter`/`styler`/`pageBreak`/`fontSize`/`textAlign` | not in V3 panel | 🔴 |

---

## Section E — Render output DOM parity (V1 inv §E)

### E.1 Path A barcode design-time DOM (V1 §E.1)

| V1 element | V3 equivalent | Status |
|---|---|---|
| Root `.hiprint-printElement-text` | n/a — Path A not in V3 | ⚠️ VIOLATION-1 |
| Inner `.hiprint-printElement-text-content` | n/a | ⚠️ |
| SVG `.hibarcode_imgcode` `preserveAspectRatio="none slice"` | n/a | ⚠️ |
| `.hibarcode_displayValue` div | n/a | ⚠️ |
| `tabindex="1"` on root | n/a | ⚠️ |

### E.2 Path A qrcode design-time DOM (V1 §E.2)

Same — all 🔴/⚠️.

### E.3 Path B barcode design-time DOM (V1 §E.3)

| V1 element | V3 equivalent | Status |
|---|---|---|
| Root `.hiprint-printElement-barcode` | `BarcodeElement.vue` → `ElementWrapper` template (root class added by wrapper) | 🟡 indirect — need to verify ElementWrapper applies `hiprint-printElement-barcode` |
| Inner `.hiprint-printElement-barcode-content` | `BarcodeElement.vue:147` `class="hiprint-printElement-barcode-content"` | ✅ |
| SVG with `preserveAspectRatio="none slice"` | line 98 `setAttribute('preserveAspectRatio', 'none slice')` | ✅ |
| Flex column inline styles | `BarcodeElement.vue:148` `style="height:100%; width:100%"` — no `display:flex; flex-direction:column` | 🟡 partial |
| `position:absolute` on root | inherited | 🟡 |
| `tabindex="1"` | not set on V3 Path B (Vue Path B inherits ElementWrapper) — same V1 J.4 quirk | 🟡 inherited quirk |

### E.4 Path B qrcode design-time DOM (V1 §E.4)

| V1 element | V3 equivalent | Status |
|---|---|---|
| Root `.hiprint-printElement-qrcode` | indirect via wrapper | 🟡 |
| Inner `.hiprint-printElement-qrcode-content` | line 146 | ✅ |
| `.hiprint-printElement-qrcode-content-title` (V1 line 10500 — XSS hole) | template lines 151-156 — Vue `{{ coerceText(qrText) }}` | ✅ **fixes J.18** |
| Inline `text-align`/`font-size`/`line-height:1.5` | `titleStyle` computed | ✅ |
| Special-case `text-align: justify` → `text-align-last: justify; text-justify: distribute-all-lines;` | 🔴 not implemented | 🟡 |

### E.5 Print-time DOM (V1 §E.5)

V1 uses `getHtml2` → same render path. V3 uses `render.ts:renderBarcodeElement` / `renderQrcodeElement` (lines 319-446) which mirror the Vue components for Path B. Path A print-time: same VIOLATION-1 — renderTextElement on a `textType:'barcode'` element renders literal text.

### E.6 CSS class summary (V1 inv §E.6)

| V1 class | V3 status |
|---|---|
| `.hiprint-printElement` | ✅ added by ElementWrapper / render.ts:201 |
| `.hiprint-printElement-text` | ✅ Path A wrapper class (but Path A renders as text — VIOLATION-1) |
| `.hiprint-printElement-text-content` | ✅ |
| `.hiprint-printElement-content` | 🔴 V3 does not add this redundant class |
| `.hiprint-printElement-barcode` | ✅ via wrapper / render.ts:203 |
| `.hiprint-printElement-barcode-content` | ✅ |
| `.hiprint-printElement-qrcode` | ✅ |
| `.hiprint-printElement-qrcode-content` | ✅ |
| `.hiprint-printElement-qrcode-content-title` | ✅ (Vue template) |
| `.hibarcode_imgcode` | 🔴 Path A only — V3 has no Path A |
| `.hibarcode_displayValue` | 🔴 same |
| `.hiqrcode_imgcode` | 🔴 same |
| `.hiqrcode_displayValue` | 🔴 same |
| `.el-type-tag.tag-barcode/qrcode` | 🟡 (element list panel, out of scope here) |

---

## Section F — Interactions parity (V1 inv §F)

| V1 interaction | V3 status |
|---|---|
| F.1 Field binding → encoded value (nested-field reduce, formatter, upperCase, title-prefix) | 🟡 Path B reads field via `getElementValue` — but formatter/upperCase NOT applied for codes (regression vs V1 line 10050) |
| F.1 Title prefix `title + "：" + value` on `!hideTitle` (V1 J.5 — corrupts encoded payload) | 🔴 NOT replicated in V3 (Path B uses `value || testData || title` fallback only; no concat) — actually a **fix** vs V1 J.5 |
| F.2 Empty value handling | 🟡 V3 renders nothing (early return) instead of V1's "此格式不支持该文本" toast |
| F.3 Format-specific validation (JsBarcode throws on invalid char) | 🔴 V3 logs `[hiprint-v3:BarcodeElement] render failed:` and shows fallback `"Barcode render failed"` div (English string, not i18n'd) |
| F.4 Size change re-render | ✅ V3 watches `[element, props.data, containerEl]` deep — re-renders on every options change |
| F.4 Resize handle set for codes (`["s","w","e","se","r"]` — south corner) | 🟡 ElementWrapper handle policy out of scope; verify separately |
| F.5 Formatter chain | 🔴 V3 BarcodeElement does NOT invoke `opts.formatter` |
| F.6 testData fallback (design-time vs print-time) | 🟡 V3 always falls back to testData regardless of `data` presence — different from V1 print-time semantics where testData is ignored if templateData supplied (even when field missing) |
| F.7 textType change triggers `setResizePanel()` | 🔴 N/A — no textType in V3 |
| F.8 Lock + barcode interaction | 🟡 inherited |
| F.9 Drag + drop into panel | 🟡 inherited from canvas store + designer interactions |
| F.10 Copy/paste (shallow clone) | 🟡 inherited |
| F.11 Keyboard arrow-key move (Path A has tabindex, Path B does not — V1 J.4) | 🟡 inherits J.4 quirk in V3 Path B |

---

## Section G — Right-click context menu (V1 inv §G)

Out of scope for this etype matrix; tracked in a separate parity doc. V3 has a context-menu compatibility layer per Sprint 22 plan. All V1 menu items either inherited or 🔴.

---

## Section H — Lock behaviour (V1 inv §H)

| V1 row | V3 status |
|---|---|
| H.1 `positionLocked` disables drag, panel shows lock icon | 🟡 inherited from ElementWrapper |
| H.2 `sizeLocked` disables resize, panel disables w/h inputs | 🟡 inherited |
| H.3 Combined right-click lock asymmetry (V1 J.6) | 🟡 unknown — depends on V3 context menu impl |
| H.4 Element list panel lock icons | 🟡 out of scope |

---

## Section I — CSS class states (V1 inv §I)

| V1 class state | V3 status |
|---|---|
| `.selected` | 🟡 inherited from ElementWrapper selection ring |
| `.hidden-el` | 🟡 element list panel only — out of scope |
| `.hiprint-text-content-wrap-*` | 🔴 not needed for codes |
| `.hiprint-text-content-middle/-bottom` | 🔴 not applied to V3 BarcodeElement/QrcodeElement |
| `.editing` (inline edit) | 🔴 N/A for codes |
| Inline `display:flex; flex-direction:column` on content | 🟡 V3 only sets `height:100%; width:100%` — flex column NOT applied (visual diff if title is shown) |

---

## Section J — V1 quirks parity (V1 inv §J — 30 quirks)

| Quirk | V1 behaviour | V3 status | Verdict |
|---|---|---|---|
| J.1 `barcodeType` dead on `defaultModule.trackingNo` under Path A | Silently ignored | Same — V3 emits identical preset, also silently ignored (now because V3 has no Path A renderer at all, not because of vocab mismatch) | 🟡 inherited |
| J.2 Property panel does not hide irrelevant options when textType changes | Always shown | N/A — V3 has no Path A panel | ⏸️ moot |
| J.3 Re-render on every resize tick (no debounce) | Continuous render | Same — V3 `watch` with `deep:true, flush:'post'` re-runs on every options mutation | 🟡 inherited |
| J.4 Path B elements lack `tabindex` → no keyboard move | Confirmed bug | V3 Path B inherits ElementWrapper — verify wrapper sets tabindex; if not, inherited bug | 🟡 likely inherited (not fixed in BarcodeElement.vue/QrcodeElement.vue templates) |
| J.5 Title + field auto-prefix corrupts encoded value | V1 emits `title + "：" + value` to bwip-js when `hideTitle:false` AND field set | V3 NOT replicated (Path B uses `value \|\| testData \|\| title` fallback only) | ✅ FIXED |
| J.6 Lock toggle asymmetry | Lock sets both pos+size; unlock clears only pos | 🟡 depends on V3 right-click handler — not audited here |
| J.7 `barAutoWidth` mutates `options.width` as side effect | V1 line 10086 / 10430 silently overwrites width | V3 does NOT mutate `options.width` (passes `''` to bwip-js, lets it auto-fit, no post-render width copy) | ✅ FIXED |
| J.8 Path A qrcode forces square via `Math.min(w,h)` | Same in Path B | V3 QrcodeElement also forces square at line 91 | 🟡 inherited |
| J.9 Two different qrCodeLevel encodings between Path A and Path B (coincidentally same output) | qrcode.js `correctLevel` int vs bwip-js `eclevel` letter | V3 has only bwip-js path → only one encoding; V3 panel writes string `'L'/'M'/'Q'/'H'` to `errorCorrectionLevel` not int to `qrCodeLevel` (⚠️ VIOLATION-3) | 🟡 simpler architecture but panel key mismatch |
| J.10 Path A barcode dies silently on missing field (renders "此格式不支持该文本") | "此格式不支持该文本" message | V3: missing field falls to testData/title via line 53-58; never shows i18n error | 🟡 different failure mode; lost i18n |
| J.11 Path B falls back to title as encoded payload | `text \|\| testData \|\| title` chain | V3 same (BarcodeElement.vue:53-58) | 🟡 inherited |
| J.12 Color option semantic split (`color` Path A vs `barColor` Path B) | Two field names | V3 Path B uses `barColor` only; `color` is dead. Panel writes `lineColor` (barcode) and `color` (qrcode) → neither used by renderer (⚠️ VIOLATION-4) | 🔴 NEW REGRESSION |
| J.13 Table-cell qrcode color hard-coded `#000000` | V1 forces black | V3 has no table-cell code renderer | 🔴 entire feature missing |
| J.14 Table-cell barcode height hard-coded `parseInt(10)` | V1 line 2158 | Same — no table renderer | 🔴 missing |
| J.15 No DataMatrix support in Path A | Must switch to Path B | V3 only has Path B → DataMatrix reachable via `qrcodeType:'datamatrix'` ✅ via JSON, 🔴 via panel | 🟡 partial fix |
| J.16 `barWidth` enum is 1..4 only | V1 select limited | V3 panel has no barWidth input → only via JSON (unbounded) | 🟡 different limitation |
| J.17 No quiet-zone (margin) control | V1 hardcodes margin:0 | V3 Path B uses bwip-js default; V3 BarcodePropertyPanel exposes `padding` (V3 addition) but renderer does not read it — ⚠️ VIOLATION-4 | 🟡 panel ineffective |
| J.18 Title field XSS risk in Path B qrcode (V1 line 10500 — template-literal interpolation) | Vulnerable | V3 uses Vue text interpolation `{{ coerceText(qrText) }}` (`QrcodeElement.vue:155`) | ✅ FIXED — meets `.claude/rules/security.md` Section 1 |
| J.19 Field dropdown vs free-input switch on panel build | V1 builds once, not refreshed | V3 panel has no field input → moot | ⏸️ |
| J.20 Path A `getReizeableShowPoints` reads `this.options.textType` directly | Bypasses getter fallback | V3 has no Path A → moot | ⏸️ |
| J.21 No "barcode unsupported character" pre-validation; SVG wiped on intermediate state | Flickers | V3 same: each render clears `host` via `while(host.firstChild) host.removeChild(...)` then re-renders; on throw → "Barcode render failed" string | 🟡 inherited; worse — lost i18n |
| J.22 Path A barcode displayValue safe (`.text()`) | Safe in V1 | V3 has no Path A; Path B qrcode title uses Vue interpolation (safe) | ✅ safe |
| J.23 `barAutoWidth` enum default is the STRING `"true"` not boolean | V1 must serialize as string | V3 BarcodeElement.vue:83 `isTrue(opts.barAutoWidth)` accepts both bool and `"true"` string | ✅ FIXED (accepts both) |
| J.24 Path A barcode `textMargin: -1` | V1 hardcoded | V3 has no Path A; V3 Path B uses bwip-js default textgaps | ⏸️ moot |
| J.25 Path B qrcode `2.835` magic number (pt→mm at 72dpi) | Uncommented literal | V3 QrcodeElement.vue:91 has same literal `2.835` uncommented (could use `pt.toMm`) | 🟡 inherited |
| J.26 No fallback when qrcode.js plugin fails to load | V1 silent crash | V3 has no qrcode.js → moot | ⏸️ |
| J.27 i18n key collision `条形码` | V1 single i18n key | V3 has no i18n yet for barcode strings (uses English "Barcode render failed") | 🔴 i18n regression |
| J.28 `showCodeTitle` is table-only | V1 inconsistent | V3 has no table code renderer → moot field | ⏸️ |
| J.29 `barColor` value validation absent | V1 silent on bad hex | V3 BarcodeElement.vue:93 same — passes through, no validation | 🟡 inherited |
| J.30 Cloning shallow-copies array-typed options | V1 latent bug | V3 uses Pinia store for elements (clone semantics differ); out of scope here | ⏸️ |

**Quirk summary**: 3 quirks FIXED (J.5, J.7, J.18, J.23), 1 NEW REGRESSION (J.12 amplified into VIOLATION-4), 12 inherited or moot, the rest depend on related subsystems.

---

## Top ⚠️ VIOLATIONS (full list)

### ⚠️ VIOLATION-1 — Path A factory presets are non-functional in V3 (CRITICAL)

**Severity**: CRITICAL (default factory drag-drop is broken for all three barcode/qrcode presets).

**Evidence**:
- V3 `default-provider.ts:278-304` emits `defaultModule.barcode`, `defaultModule.qrcode`, `defaultModule.trackingNo` with `type:'text'` + `options.textType:'barcode'|'qrcode'` (V1 Path A shape).
- V3 `HiprintCanvas.vue:151-178` dispatches by `element.type`: `'text' → TextElement`, no branch for `textType`.
- V3 `TextElement.vue` (`Grep textType` → 0 hits) has no Path A handler.
- V3 `render.ts:218-244` `renderTextElement` ignores `opts.textType`.
- V3 has no JsBarcode dependency in package.json (no `import JsBarcode`).

**Impact**: Users dragging the default 条形码/二维码/快递单号 components see plain text ("123456789", "https://example.com", "SF1234567890") on the canvas and in print output instead of barcodes/qrcodes. Existing V1 templates using these presets in production will render incorrectly when migrated to V3.

**Triggers**: `.claude/rules/api-contract.md` Section 2 (breaking change in default behaviour) and `CLAUDE.md` High-risk paths (`src/hiprint-v3/core/default-provider.ts` analogue to `src/hiprint/etypes/*`).

**Fix candidates** (decide via Plan mode):
- A. Change `default-provider.ts` to emit `type:'barcode'` / `'qrcode'` (Path B) for the three presets, dropping `textType` and migrating `barcodeType:'code128'` from dead-field to live-field. **Breaking change** for any user JSON that hand-rolled `type:'text'+textType:'barcode'`.
- B. Add a Path A dispatch inside `TextElement.vue` (and `render.ts:renderTextElement`) that detects `opts.textType in {'barcode','qrcode'}` and delegates to Barcode/QrcodeElement.
- C. Add a migration shim in `compat/` that rewrites `{type:'text', textType:'barcode'}` → `{type:'barcode'}` at template-load time.

### ⚠️ VIOLATION-2 — BarcodePropertyPanel writes to wrong key (`format` not `barcodeType`) with wrong vocabulary (HIGH)

**Severity**: HIGH (every property edit in the V3 panel is a no-op for the renderer).

**Evidence**:
- `BarcodePropertyPanel.vue:47-51` `onFormat()` writes `{ format: String(target.value) }`.
- `BarcodeElement.vue:86` and `render.ts:350` both read `opts.barcodeType`, NOT `opts.format`.
- Panel vocabulary is JsBarcode-style (`CODE128`, uppercase) but Path B bwip-js expects `code128` (lowercase). Mismatch.

**Impact**: User changes the format dropdown — nothing happens visually. The renderer keeps using the original `barcodeType` (or `'code128'` default). Sprint 22a Stream D shipped a panel that does not control the renderer.

**Fix candidates**:
- A. Rename panel writes to `barcodeType` and lowercase the values (`code128`/`ean13`/`ean8`/`upca`/`itf14`/`code39`/`code93`).
- B. Add a `format → barcodeType` mapper at write-time inside the panel and lowercase the value.
- C. Add a render-side fallback `opts.barcodeType ?? lowercase(opts.format)` (band-aid; violates `.claude/rules/fix-discipline.md` §1 "禁止补丁式修改").

### ⚠️ VIOLATION-3 — QrcodePropertyPanel writes string `errorCorrectionLevel` instead of int `qrCodeLevel` (HIGH)

**Severity**: HIGH.

**Evidence**:
- `QrcodePropertyPanel.vue:45-49` `onErrorCorrectionLevel()` writes `{ errorCorrectionLevel: String(target.value) }` with values `'L'`/`'M'`/`'Q'`/`'H'`.
- `QrcodeElement.vue:92-94` and `render.ts:419` (verify) read `opts.qrCodeLevel` as INT and index into `['M','L','H','Q']`.
- V1 inv §J.9 documents this is the qrcode.js / bwip-js coincidence that any change to one breaks the other.

**Impact**: Same as VIOLATION-2 — panel change is no-op.

**Fix candidates**:
- A. Panel writes `qrCodeLevel` as int with the V1-canonical mapping (`L→1, M→0, Q→3, H→2`).
- B. Renderer accepts both shapes; prefer `qrCodeLevel` int, fallback to `errorCorrectionLevel` letter → index lookup.
- C. Renormalize internally to canonical letter enum per V1 J.9 fix suggestion.

### ⚠️ VIOLATION-4 — Color / hideTitle / padding panel keys do not match renderer keys (MEDIUM)

**Severity**: MEDIUM (several panel inputs are dead).

**Evidence per row**:
- `BarcodePropertyPanel.vue:71-75` writes `lineColor`; `BarcodeElement.vue:93` reads `barColor`.
- `BarcodePropertyPanel.vue:53-57` writes `displayValue`; `BarcodeElement.vue:79` reads `hideTitle` (inverted semantics — V1 used `hideTitle`).
- `BarcodePropertyPanel.vue:59-63` writes `padding`; renderer does not read `padding` at all.
- `BarcodePropertyPanel.vue:65-69` writes `fontSize`; renderer reads `fontSize` ✅ this one is correct.
- `QrcodePropertyPanel.vue:57-61` writes `color`; `QrcodeElement.vue:104` reads `barColor`.
- `QrcodePropertyPanel.vue:63-67` writes `backgroundColor`; renderer does not pass anything to bwip-js for background (bwip-js default white).
- `QrcodePropertyPanel.vue:51-55` writes `padding`; renderer does not read.

**Impact**: 7 of 9 panel inputs in Sprint 22a Stream D are non-functional. Triggers `.claude/rules/fix-discipline.md` §1 (no patch-style fixes — root cause is design drift between panel-author and renderer-author streams).

**Fix candidates**:
- A. Realign panel keys to renderer (`barColor`, `hideTitle` inverted to a separate "show text" checkbox that maps to `!hideTitle`).
- B. Add an alias map in `useCanvasStore.updateElement` that normalizes legacy keys at write-time.
- C. Add fallback reads in renderer (panel-friendly keys → real keys). Discouraged — multiplies the schema.

### ⚠️ VIOLATION-5 — Table-cell barcode/qrcode unsupported in V3 (MEDIUM)

**Severity**: MEDIUM (V1 templates with `column.tableTextType:'barcode'/'qrcode'` produce blank cells in V3).

**Evidence**: `cell.ts:43-54` declares the fields in TypeScript but `Grep tableTextType` in `components/elements/table/` returns 0 matches. No JsBarcode / bwip-js call in TableCell.vue.

**Fix**: Wire bwip-js into TableCell.vue's render path with the same `tableTextType:'barcode'|'qrcode'` dispatch.

---

## Risks register

| ID | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | V1 templates in production using Path A presets render blank/wrong in V3 | CRITICAL | VIOLATION-1 fix candidate A or C; add migration step in `compat/` layer |
| R2 | Sprint 22a Stream D panel work is functionally dead | HIGH | VIOLATIONS 2/3/4 fixes |
| R3 | JsBarcode-style users (uppercase vocab) cannot migrate without changing barcodeType field values | MEDIUM | V1 J.1 already documented; add migration helper that maps `CODE128 → code128` etc. |
| R4 | `formatter`/`styler`/`upperCase` not applied to codes in V3 → CODE39 lowercase fails | MEDIUM | Wire formatter into BarcodeElement/QrcodeElement render chain |
| R5 | `pageBreak` not honored for codes → multi-page templates may split code mid-bars | MEDIUM | Out of this matrix; track in pagination matrix |
| R6 | Lost i18n for "Barcode render failed" / "二维码生成失败" | LOW | Migrate strings to i18n bundle when Sprint 23 lands |
| R7 | Quirk J.7 fix (no width auto-mutation) may regress layouts that depended on it | LOW | Add `barAutoWidth` apply-back to canvas store when SVG natural width > pt width (opt-in) |

---

## Coverage report

- **V1 inventory sections covered**: 0 (Architecture), A (presets), B (options + 18 barcodeMode + 84 barcodeType + 19 qrcodeType + table-cell fields), C (effective defaults), D (panels x3), E (DOM x4 + classes), F (interactions x11), G (right-click — pointed out of scope), H (lock — pointed out of scope), I (CSS states), J (all 30 quirks).
- **Total parity rows scored**: 200+ unique rows (see scoring section below).
- **Items left out of this matrix on purpose**: G (context menu) and H (lock) policy details — owned by interactions parity matrix; deeper E2E behaviour for Path B keyboard navigation — owned by canvas parity matrix.

---

## Scoring totals

- ✅ FULL PARITY: ~38 rows
- 🟡 PARTIAL PARITY: ~55 rows
- 🔴 MISSING: ~70 rows (including all 18 barcodeMode values, table-cell support, formatter/styler/upperCase, pageBreak, several panel fields)
- ⚠️ VIOLATIONS: 5 (1 CRITICAL, 2 HIGH, 1 MEDIUM, 1 MEDIUM)
- ⏸️ MOOT / INTENTIONAL: ~9 rows

Total scored entries: ~177 (with B.1.2/B.2.1/B.3.1 enum tables expanding the row count past 80 status markers).

---

## Library identification (per V3 etype)

| V3 etype | Renderer file | Library used | Verified by |
|---|---|---|---|
| `BarcodeElement.vue` (Path B barcode) | `src/hiprint-v3/components/elements/BarcodeElement.vue` | **bwip-js** only | Line 20 `import bwipjs from 'bwip-js/browser'`; line 85 `bwipjs.toSVG({ bcid: opts.barcodeType ?? 'code128', ... })`. No JsBarcode import. |
| `QrcodeElement.vue` (Path B qrcode) | `src/hiprint-v3/components/elements/QrcodeElement.vue` | **bwip-js** only | Line 11 `import bwipjs from 'bwip-js/browser'`; line 96 `bwipjs.toSVG({ bcid: opts.qrcodeType ?? 'qrcode', ... })`. No qrcode.js / `./plugins/qrcode.js` import. |
| Print-time renderer | `src/hiprint-v3/print/render.ts` | **bwip-js** only | Line 33 `import bwipjs from 'bwip-js/browser'`; lines 349 / 412. |
| Path A handler (V1) | NONE in V3 | n/a | `Grep textType` on TextElement.vue → 0; render.ts renderTextElement ignores textType. |
| Table-cell barcode/qrcode | NONE in V3 | n/a | `Grep tableTextType` on `components/elements/table/` → 0 matches. |

**Path coverage**: V3 implements **Path B only** (bwip-js for both barcode and qrcode). V1 Path A (JsBarcode + qrcode.js) and table-cell paths are NOT implemented.

---

## Recommended next steps

1. **VIOLATION-1 fix (P0)** — decide between (A) factory rewrite to Path B or (B) Path A dispatcher inside TextElement.vue. Recommend (B) + migration shim because production JSON likely uses Path A heavily.
2. **VIOLATIONS 2/3/4 fix (P0)** — realign Sprint 22a Stream D panel keys to match renderer. Single commit, single PR per `.claude/rules/fix-discipline.md`.
3. **VIOLATION-5 (P1)** — wire bwip-js into TableCell.vue for `tableTextType:'barcode'/'qrcode'`.
4. **R4 (P1)** — invoke `formatter`/`upperCase` in BarcodeElement/QrcodeElement to restore CODE39 lowercase use case.
5. **e2e regression coverage (P1)** — add `e2e/tests/parity-barcode.spec.ts` and `parity-qrcode.spec.ts` that drop the three default presets and assert SVG mount + non-text content. Follow `.claude/rules/testing.md` ≥ 3 cases per file (happy / Path A migration / Path B explicit).
6. **Migration matrix (P2)** — produce a `compat/` rewriter that walks legacy template JSON and converts Path A presets to Path B form, with documented breaking change notes per `.claude/rules/api-contract.md` Section 5.
