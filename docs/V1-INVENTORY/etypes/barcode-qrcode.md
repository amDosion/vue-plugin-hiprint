# V1 User-Visible Behavior Inventory: `barcode` & `qrcode` Element Types

**Document Purpose**: Exhaustive catalog of every field, default, render path, interaction, and quirk for V1 barcode and qrcode element types. Used as the parity baseline for V3 rewrite — every row must map 1:1 to a V3 implementation point.

**Last Updated**: 2026-05-11
**V1 Source Bundle**: `src/hiprint/hiprint.bundle.js` (15353 lines)
**V1 Factory Source**: `src/hiprint/etypes/default-etyps-provider.js` (447 lines)

---

## Section 0: Architecture overview — TWO implementations coexist

V1 ships **two distinct barcode/qrcode code paths** that look identical to a user but use different libraries and option schemas. This is the single most important fact about these etypes — every other entry in this inventory has to specify which path it applies to.

### Path A — `type: 'text'` + `options.textType: 'barcode' | 'qrcode'` (DEFAULT in factory)

- Underlying library: **JsBarcode** for barcodes [V1 line 42 import], **qrcode.js** (`./plugins/qrcode.js`) for qrcodes [V1 line 44 import]
- Element class: shared text class `D` (line 9985+), branching at `updateTargetText` line 10046+
- Used by factory entries: `defaultModule.barcode` [V1 etypes-provider line 330–342], `defaultModule.qrcode` [V1 etypes-provider line 346–358], `defaultModule.trackingNo` [V1 etypes-provider line 267–279]
- Property panel: text element's `instance.text` config (`textType` select dropdown switches the panel mode)
- Field resolution: `f.split('.').reduce((a,c) => (a != null ? a[c] : undefined), t)` — nested-field safe [V1 line 10037]
- Output DOM: `<div class="hiprint-printElement hiprint-printElement-text"><div class="hiprint-printElement-text-content"><svg class="hibarcode_imgcode">…</svg></div></div>` [V1 line 10128 + 10066]
- This is the path the factory installs by default and the path real users hit when they drag "条形码"/"二维码" from the component panel.

### Path B — `type: 'barcode' | 'qrcode'` (standalone classes, library users must register explicitly)

- Underlying library: **bwip-js** [V1 line 45 import] for BOTH barcode and qrcode
- Element classes: `barcode` (line 10381–10448), `qrcode` (line 10449–10517)
- Factory: NOT registered in `defaultModule` — see comment in [V1 etypes-provider line 264–265] saying "用 textType 而非 type:'barcode'" by design
- Factory routing: `createPrintElement` dispatch at line 10523 — `"barcode" == t.type ? new barcode(t,e) : "qrcode" == t.type ? new qrcode(t,e) : void 0`
- Property panel: separate `instance.barcode` and `instance.qrcode` configs accessed via `getConfigOptions()` at lines 10391–10392 and 10459–10460
- Field resolution: same `f.split('.').reduce` pattern, lines 10403 and 10469
- Output DOM: `<div class="hiprint-printElement hiprint-printElement-barcode"><div class="hiprint-printElement-barcode-content">…</div></div>` [V1 line 10442]; analogous `hiprint-printElement-qrcode` for qrcode [V1 line 10511]
- Listed in `SUPPORTED_ELEMENT_TYPES` at line 10660 alongside text/image/etc.
- Used internally by the i18n typeNames lookup at line 11882 (`barcode:'条码', qrcode:'二维码'`).

### Why both exist

The text+textType path is the legacy/default ("统一渲染管道，用户可在属性面板切换为文本/二维码/图片" — etypes-provider line 264). The standalone path was added later for users who want a true single-purpose element. Both must be supported in V3 because:
1. Existing template JSON in production uses **both** shapes.
2. The `getConfigOptions()` schemas are different (instance.barcode vs instance.text), so property panel rendering must branch.
3. Render libraries differ (JsBarcode vs bwip-js for barcode; qrcode.js vs bwip-js for qrcode), and they support **different format/type vocabularies** (`CODE128` vs `code128`, etc.).

This document covers BOTH paths. Each subsection labels which path it describes.

---

## Section A — Pre-built factory presets

### A.1 `defaultModule.barcode` — "条形码"

Source: [V1 etypes-provider line 330–342].

| Field | Value | Notes |
|---|---|---|
| `tid` | `"defaultModule.barcode"` | Identifier in template JSON |
| `title` | `"条形码"` | Group: 辅助 |
| `field` | `"barcode"` | **Required** — without it `updateTargetText` would use `title` as the encoded payload and `code128` does not support Chinese, producing "此格式不支持该文本" [V1 etypes-provider line 326–328] |
| `type` | `"text"` | Path A |
| `icon` | `"ep:list"` | Element Plus icon name |
| `options.width` | `140` (pt) | Initial drag size |
| `options.height` | `35` (pt) | Initial drag size |
| `options.textType` | `"barcode"` | Switches renderer to JsBarcode branch [V1 line 10058] |
| `options.hideTitle` | `true` | Suppresses the text under the bars [V1 line 10078] |
| `options.testData` | `"123456789"` | Used when no `printData.barcode` is supplied [V1 line 10037 fallback] |

### A.2 `defaultModule.qrcode` — "二维码"

Source: [V1 etypes-provider line 346–358].

| Field | Value | Notes |
|---|---|---|
| `tid` | `"defaultModule.qrcode"` | Identifier in template JSON |
| `title` | `"二维码"` | Group: 辅助 |
| `field` | `"qrcode"` | **Required** for same reason as barcode |
| `type` | `"text"` | Path A |
| `icon` | `"ep:grid"` | Element Plus icon |
| `options.width` | `50` (pt) | Initial size — kept small because square |
| `options.height` | `50` (pt) | Initial size — must match width for clean square; if not, render computes `min(width,height)` [V1 line 10105] |
| `options.textType` | `"qrcode"` | Switches renderer to qrcode.js branch [V1 line 10093] |
| `options.hideTitle` | `true` | Suppresses the label below code [V1 line 10117] |
| `options.testData` | `"https://example.com"` | Default test payload |

### A.3 `defaultModule.trackingNo` — "快递单号" (barcode preset for shipping)

Source: [V1 etypes-provider line 267–279]. Distinct from `defaultModule.barcode` because it pre-renders the displayValue text under the bars (no `hideTitle`).

| Field | Value | Notes |
|---|---|---|
| `tid` | `"defaultModule.trackingNo"` | |
| `title` | `"快递单号"` | Group: 电商 |
| `field` | `"trackingNo"` | Default field binding for SF/JD style tracking numbers |
| `type` | `"text"` | Path A |
| `icon` | `"ep:list"` | |
| `options.width` | `180` (pt) | Wider than `defaultModule.barcode` to fit alphanumeric SF number |
| `options.height` | `50` (pt) | Taller to include displayValue text |
| `options.textType` | `"barcode"` | |
| `options.barcodeType` | `"code128"` | **CODE128 default** — picked for SF/JD compatibility [V1 etypes-provider line 265] |
| `options.testData` | `"SF1234567890"` | |
| `hideTitle` | _(omitted)_ | Defaults to `false` → bars include text underneath via JsBarcode `displayValue:true` [V1 line 10078] |

NOTE: `options.barcodeType` here uses bwip-js naming (`code128`, lowercase) — but Path A reads `barcodeMode` (uppercase `CODE128`). The `barcodeType` on this preset is **dead** under Path A; renderer uses `getbarcodeMode()` which falls through to default `"CODE128"` [V1 line 9978]. This is a V1 quirk (Section J.1).

---

## Section B — Options table (deep enumeration)

### B.1 Path A — `text + textType:'barcode'`

#### B.1.1 Common text-element options inherited by barcode mode

These come from `instance.text.supportOptions` and apply to every text element regardless of textType. The "Used by barcode?" column says whether the renderer's barcode branch (line 10058) reads it.

| Option | Default | Type | Property panel control | Used by barcode? | Source |
|---|---|---|---|---|---|
| `field` | `(none — required)` | string | Text input or `<select>` if `getFields()` returns list; "请选择字段"/"请输入字段名" placeholder | YES — `getField()` line 10036 controls "title + ：" prefix at line 10050 | [V1 line 3544–3568] |
| `title` | from `printElementType.title` | string | Multiline `<textarea height:50px>`, placeholder "请输入标题" | YES — emitted in displayValue when `hideTitle:false` (Path A barcode uses JsBarcode internal text, qrcode appends `.hiqrcode_displayValue`) | [V1 line 3572–3585] |
| `testData` | `""` | string | `<input>` with placeholder "仅字段名称存在时有效" | YES — fallback when `getData(undefined)` returns no live data, line 10037 | [V1 line 3588–3601] |
| `hideTitle` | `undefined` (treated as `false`) | bool/string | `<select>` with options "默认"/"显示(false)"/"隐藏(true)" | YES — controls `displayValue` flag passed to JsBarcode line 10078 | [V1 line 2594–2608] |
| `fontSize` | `9` (pt) | number | Number input | YES — Path A barcode uses it for divMode height calc indirectly; Path A qrcode uses it to size the appended title `<div>` line 10103, 10498 | [V1 line 2504, 9976] |
| `fontWeight` | `undefined` | string ("bold","bolder","normal") | `<select>` | NO for barcode bars themselves; affects appended title text only | [V1 line 2528] |
| `color` | `undefined` (renders `#000000`) | string (hex/rgb) | Color picker (minicolors) | YES — Path A barcode passes as `lineColor` to JsBarcode line 10075; Path A qrcode passes as `colorDark` line 10112 | [V1 line 3494] |
| `textAlign` | `"left"` | enum: left/center/right/justify | `<select>` | YES — Path A qrcode title text alignment line 10499; Path A barcode displayValue alignment via parent | [V1 line 2574] |
| `textType` | `"text"` (effective default via `getTextType()`) | enum: `""/"text"/"barcode"/"qrcode"` | `<select>` "打印类型": 默认 / 文本 / 条形码 / 二维码 | YES — **THE switch** that selects the renderer branch at line 10051. Setting it triggers `setResizePanel()` rebuild [V1 line 952–953] because resize handles change [V1 line 1093]. | [V1 line 5000–5013, 9973] |
| `barcodeMode` | `"CODE128"` (via `getbarcodeMode()`) | enum (17 values) | `<select>` "条形码格式" with options listed in Section B.1.2 | YES — Path A barcode `format` arg to JsBarcode line 10072 | [V1 line 2906–2921, 9977] |
| `barTextMode` | `"text"` (via `getBarTextMode()`) | enum: `""/"text"/"svg"` | `<select>` "条码文本模式": 默认/单独文本/svg文本 | YES — When `"text"`, displayValue is appended as separate `<div class="hibarcode_displayValue">` line 10068, 10080. Else JsBarcode renders text inside the SVG. | [V1 line 2922–2937, 9979] |
| `barWidth` | `1` (via `getBarWidth()`) | enum: `""/1/2/3/4` | `<select>` "条码宽度" | YES — Passed as `width` (bar unit width) to JsBarcode line 10073 | [V1 line 2938–2953, 9981] |
| `barAutoWidth` | `true` (via `getBarAutoWidth()`) | enum: `""/"true"/"false"` (string!) | `<select>` "条码自动增宽": 默认/自动/不自动 | YES — When true, after render the parent `<div>` width is expanded to the SVG's natural width if larger [V1 line 10084–10087]. **Tricky default**: `"" → true` via `defaultOptions.barAutoWidth === "true"` fallback then `?? true` [V1 line 9983–9985] | [V1 line 2954–2969, 9983] |
| `qrCodeLevel` | `0` (M) | int: 0/1/2/3 | `<select>` "二维码容错率": 默认(0) / 7% L(1) / 15% M(0) / 25% Q(3) / 30% H(2) | YES — Path A qrcode `correctLevel` arg to QRCode constructor line 10114 | [V1 line 3476–3491, 9986] |
| `lineHeight` | `(fontSize ?? 10.5) * 1.5` | number | Number input (mm or pt) | YES — used in qrcode to reserve space for the title `<div>` at line 10103 | [V1 line 10103, 10477] |
| `coordinate` (`left` + `top`) | from drop position | numbers (pt) | Two number inputs side-by-side | YES (positioning) | [V1 line 3602+] |
| `widthHeight` (`width` + `height`) | from preset (140×35 etc.) | numbers (pt) | Two number inputs + checkbox "锁定大小" | YES — width drives SVG width line 10079; height drives bar pixel height line 10077 | [V1 line 3686+] |
| `positionLocked` | `false` | bool | Checkbox in coordinate row | YES — disables dragging, line 1098 | [V1 line 814, 855, 906, 1098, 3609] |
| `sizeLocked` | `false` | bool | Checkbox in widthHeight row | YES — disables resize, line 3692 | [V1 line 907, 3687] |
| `rotate` | `0` | int (degrees) | `<input>` (default placeholder "25") | YES — rotates the entire DOM element including barcode SVG | [V1 line 3975, 11227, 1120] |
| `zIndex` | `(none)` | int | Number input | YES — stacking order; affected by right-click "置于顶层/底层" [V1 line 11488–11522] | [V1 line 11227] |
| `pageBreak` | `false` | bool | `<select>` "分页": 默认/分页/不分页 | YES — element-level page break | [V1 line 1203] |
| `dataType` | `undefined` | enum: `"text"/"datetime"/"boolean"` | `<select>` "数据类型" | NO directly for code rendering (only triggers `getData` format branching at line 10038 for text mode) | [V1 line 5605] |
| `format` | `undefined` | string (e.g. `YYYY-MM-DD`) | Text input | NO for code rendering (text only) | [V1 line 10038] |
| `formatter` | `undefined` | string (stringified function) | `<textarea>` "格式化函数" | YES — function transforms the value before it is passed to JsBarcode/QRCode at line 10050. **`new Function('return ' + str)()`** at line 1537. | [V1 line 1534–1543, 5639] |
| `styler` | `undefined` | string (stringified function) | `<textarea>` | YES — modifies element style before render | [V1 line 1544–1551] |
| `upperCase` | `undefined` | enum: `""/"upper"/"lower"` | `<select>` "大小写转换" | YES — `hinnn.toUpperCase` wraps the value at line 10050 → affects encoded payload (uppercase CODE39 etc.) | [V1 line 5219] |
| `draggable` | `true` | bool | (no panel — set by lock state) | YES — disabled when `positionLocked:true` line 814, 998 | [V1 line 814–998] |

#### B.1.2 `barcodeMode` enum values (CODE128 family — JsBarcode vocabulary)

From [V1 line 2912] `<select>` HTML. These are the values stored in `options.barcodeMode` and passed as JsBarcode's `format`. Note **uppercase** convention.

| Stored value | Label (UI) | JsBarcode `format` |
|---|---|---|
| `""` | 默认 | (renderer falls back to `"CODE128"` via `getbarcodeMode()` line 9978) |
| `CODE128A` | CODE128A | CODE128A |
| `CODE128B` | CODE128B | CODE128B |
| `CODE128C` | CODE128C | CODE128C |
| `CODE39` | CODE39 | CODE39 |
| `EAN13` | EAN-13 | EAN13 |
| `EAN8` | EAN-8 | EAN8 |
| `EAN5` | EAN-5 | EAN5 |
| `EAN2` | EAN-2 | EAN2 |
| `UPC` | UPC（A） | UPC |
| `ITF` | ITF | ITF |
| `ITF14` | ITF-14 | ITF14 |
| `MSI` | MSI | MSI |
| `MSI10` | MSI10 | MSI10 |
| `MSI11` | MSI11 | MSI11 |
| `MSI1010` | MSI1010 | MSI1010 |
| `MSI1110` | MSI1110 | MSI1110 |
| `Pharmacode` | Pharmacode | pharmacode |

Total: 17 explicit + 1 default = **18 selectable values**.

#### B.1.3 Fixed-value (non-configurable) JsBarcode args under Path A

Hard-coded in `updateTargetText` barcode branch [V1 line 10071–10079]:

| JsBarcode arg | Hard-coded V1 value | Source |
|---|---|---|
| `textMargin` | `-1` | line 10074 |
| `margin` | `0` | line 10076 |
| `height` (px) | `parseInt(pt.toPx(this.options.getHeight() \|\| 10))` | line 10077 — depends on `options.height` |
| `displayValue` | `divMode ? false : !this.options.hideTitle` | line 10078 — when barTextMode is `"text"`, JsBarcode internal text is OFF and the separate div takes over |

After JsBarcode renders, the SVG attrs are forcibly set [V1 line 10079]:
- `height="100%"`
- `width="100%"`
- `preserveAspectRatio` inherited from initial template at line 10066: `"none slice"`

Then auto-expand: if `barAutoWidth && svgWidth > options.width`, parent `<div>` is widened in pt to `Math.ceil(pt.fromPx(svg_w_attr * 1.05))` [V1 line 10082–10087].

#### B.1.4 Fixed-value (non-configurable) qrcode.js args under Path A

Hard-coded in `updateTargetText` qrcode branch [V1 line 10109–10115]:

| qrcode.js arg | Hard-coded V1 value | Source |
|---|---|---|
| `width` | `"100%"` (CSS string) | line 10110 |
| `height` | `"100%"` | line 10111 |
| `useSVG` | `true` | line 10113 |
| `colorDark` | `this.options.color \|\| "#000000"` | line 10112 |
| (no `colorLight` — qrcode.js defaults to `#ffffff`) | | |

The actual square size is calculated **before** instantiating QRCode: `box` div is sized to `Math.min(width, height)` in pt [V1 line 10104–10107]. If `hideTitle:false`, height is reduced by `lineHeight ?? fontSize*1.5` to reserve space for the appended `.hiqrcode_displayValue` div [V1 line 10103].

### B.2 Path B — `type: 'barcode'` (standalone bwip-js)

Element class at [V1 line 10381–10448]. Options table — these all live in `options` and are read by `initBarcode` (line 10405).

| Option | Default | Type | Source |
|---|---|---|---|
| `field` | `(none — required if data binding)` | string | inherited from `printElementType.field` via `getField()` (BasePrintElement line 709). Property panel via `_` instance line 3544. |
| `title` | from `printElementType.title` | string | `getTitle()` line 10399 — uses `this.options.title \|\| this.printElementType.title` |
| `testData` | `""` | string | line 10403 — fallback chain: live data → testData → `printElementType.getData()` → `""` |
| `hideTitle` | `undefined` (false) | bool | line 10410, 10417 — controls whether the title is included in the SVG via bwip-js `includetext` |
| `width`, `height` | (varies per drop) | numbers (pt) | line 10410, 10415, 10416 |
| `lineHeight` | `(fontSize ?? 10.5) * 1.5` | number | line 10410 — used to reserve title space |
| `fontSize` | `10` (default fallback in textsize) | number | line 10418 — `parseInt(this.options.fontSize) \|\| 10` |
| `barcodeType` | `"code128"` | string (bwip-js bcid) | line 10412 — full enum listed in Section B.2.1 (84 values across 9 groups) |
| `barWidth` | `1` | number | line 10414 — bwip-js `scale` |
| `barAutoWidth` | `"true"` (string) → true | string | line 10394 `getBarAutoWidth` returns `options.barAutoWidth === "true"` then `?? true` |
| `barColor` | `"#000"` | string (hex) | line 10419 — bwip-js `barcolor` |
| `positionLocked`, `sizeLocked`, `rotate`, `zIndex`, `pageBreak`, `formatter`, `styler`, `coordinate` | (same as B.1.1) | (same) | inherited from BasePrintElement; property panel composed from `instance.barcode.supportOptions` |

#### B.2.1 `barcodeType` enum (bwip-js — 84+ values in 9 optgroups)

From [V1 line 2976–3357]. This is the cascader/select for **Path B**. Vocabulary is **lowercase + bwip-js naming**, distinct from Path A's CODE128 family. Grouped:

**Group 1 — 默认** (1)
- `""` → "默认(Code 128)"

**Group 2 — 商品条码** (7)
- `ean13`, `ean8`, `upca`, `upce`, `isbn`, `ismn`, `issn`

**Group 3 — 条形码** (6)
- `code39`, `code39ext`, `code93`, `code93ext`, `code128`, `interleaved2of5`

**Group 4 — 物流** (4)
- `ean14`, `gs1-128`, `itf14`, `sscc18`

**Group 5 — GS1 DataBar** (8)
- `databarexpanded`, `databarexpandedstacked`, `databarlimited`, `databaromni`, `databarstacked`, `databarstackedomni`, `databartruncated`, `gs1northamericancoupon`

**Group 6 — 邮政和快递编码** (12)
- `auspost`, `identcode`, `leitcode`, `japanpost`, `kix`, `royalmail`, `mailmark`, `maxicode`, `symbol`, `onecode`, `planet`, `postnet`

**Group 7 — 医疗产品编码** (8)
- `code32`, `pharmacode`, `pzn`, `pharmacode2`, `hibcazteccode`, `hibccodablockf`, `hibccode128`, `hibccode39`

**Group 8 — 不常用编码** (16)
- `code11`, `code16k`, `code2of5`, `code49`, `codeone`, `rationalizedCodabar`, `codablockf`, `bc412`, `coop2of5`, `channelcode`, `datalogic2of5`, `dotcode`, `iata2of5`, `msi`, `matrix2of5`, `plessey`, `posicode`, `telepen`, `telepennumeric`

**Group 9 — GS1 复合编码** (12)
- `ean13composite`, `ean8composite`, `upcacomposite`, `upcecomposite`, `databarexpandedstackedcomposite`, `databarexpandedcomposite`, `databarlimitedcomposite`, `databaromnicomposite`, `databarstackedcomposite`, `databarstackedomnicomposite`, `databartruncatedcomposite`, `gs1-128composite`

**Group 10 — 附加组件** (3)
- `ean2`, `ean5`, `gs1-cc`

**Group 11 — 实验编码** (3)
- `raw`, `daft`, `flattermarken`

Total: 1 + 7 + 6 + 4 + 8 + 12 + 8 + 19 + 12 + 3 + 3 = **83 explicit values** plus default = 84 selectable. [V1 line 2976–3357]

#### B.2.2 Fixed-value bwip-js args (Path B barcode)

Hard-coded in `initBarcode` [V1 line 10411–10420]:

| bwip-js arg | V1 value | Source |
|---|---|---|
| `bcid` | `this.options.barcodeType \|\| 'code128'` | line 10412 |
| `text` | `text \|\| testData \|\| title` | line 10413 |
| `scale` | `this.options.barWidth \|\| 1` | line 10414 |
| `width` (mm) | If `!getBarAutoWidth()`: `pt.toMm(options.getWidth())`. Else `''` (bwip-js auto-fits). | line 10415 |
| `height` (mm) | `pt.toMm(options.height - (hideTitle ? 0 : lineHeight ?? fontSize*1.5))` | line 10410, 10416 |
| `includetext` | `!this.options.hideTitle` | line 10417 |
| `textsize` | `parseInt(options.fontSize) \|\| 10` | line 10418 |
| `barcolor` | `options.barColor \|\| "#000"` | line 10419 |

Post-render SVG modification [V1 line 10422–10431]:
- `preserveAspectRatio` forced to `"none slice"`
- `svgWidth` read from `viewBox` attr `[2]`, then `Math.ceil(px.toPt(svgWidth * 1.05))`
- If `getBarAutoWidth() && svgWidth > options.width`: parent set to `svgWidth + 'pt'`, SVG `height:100%`, `options.width` mutated in place

### B.3 Path B — `type: 'qrcode'` (standalone bwip-js)

Element class at [V1 line 10449–10517]. Options table:

| Option | Default | Type | Source |
|---|---|---|---|
| `field`, `title`, `testData`, `hideTitle`, `width`, `height`, `lineHeight`, `fontSize`, `textAlign` | same shape as Path B barcode | | line 10464, 10469, 10477, 10497–10500 |
| `qrcodeType` | `"qrcode"` | string (bwip-js bcid) | line 10482 — full enum in Section B.3.1 |
| `qrCodeLevel` | `0` (M) | int 0/1/2/3 | line 10491 — but **note**: index into `['M','L','H','Q']` (different from Path A's correctLevel int encoding!) |
| `barColor` | `"#000"` | string (hex) | line 10492 |
| `positionLocked`, `sizeLocked`, `rotate`, `zIndex`, `pageBreak`, `formatter`, `styler`, `coordinate` | inherited | | |

#### B.3.1 `qrcodeType` enum (bwip-js — 18 values flat list)

From [V1 line 3385–3461]. NOT grouped (single flat select).

| Stored value | Label |
|---|---|
| `""` | 默认(qrcode) |
| `qrcode` | QR Code |
| `microqrcode` | Micro QR Code |
| `swissqrcode` | Swiss QR Code |
| `rectangularmicroqrcode` | Rectangular Micro QR Code |
| `azteccode` | Aztec Code |
| `aztecrune` | Aztec Runes |
| `azteccodecompact` | Compact Aztec Code |
| `datamatrix` | Data Matrix |
| `datamatrixrectangular` | Data Matrix Rectangular |
| `hanxin` | 汉信码 |
| `gs1datamatrix` | GS1 Data Matrix |
| `gs1datamatrixrectangular` | GS1 Data Matrix Rectangular |
| `gs1qrcode` | GS1 QR Code |
| `hibcdatamatrix` | HIBC Data Matrix |
| `hibcdatamatrixrectangular` | HIBC Data Matrix Rectangular |
| `hibcmicropdf417` | HIBC MicroPDF417 |
| `hibcpdf417` | HIBC PDF417 |
| `hibcqrcode` | HIBC QR Code |

Total **19** including default. [V1 line 3385–3461]

#### B.3.2 Fixed-value bwip-js args (Path B qrcode)

Hard-coded in `initQrcode` [V1 line 10481–10493]:

| bwip-js arg | V1 value | Source |
|---|---|---|
| `bcid` | `this.options.qrcodeType \|\| 'qrcode'` | line 10482 |
| `text` | `text \|\| testData \|\| title` | line 10483 |
| `scale` | `1` (FIXED — not user-configurable in Path B qrcode!) | line 10484 |
| `paddingwidth` | If `width >= height`: `Math.abs((width-height)/2)`; else `0` | line 10479 (px), used at 10485 |
| `paddingheight` | If `height > width`: `Math.abs((height-width)/2)`; else `0` | line 10480, 10486 |
| `width` (mm) | `Math.min(width/2.835, height/2.835)` parsed as int | line 10488 — `2.835` ≈ px-per-mm at 72dpi |
| `height` (mm) | same as width above (forced square) | line 10489 |
| `includetext` | `false` (FIXED — qrcode never bakes title into SVG; appended below as separate div) | line 10490 |
| `eclevel` | `['M','L','H','Q'][this.options.qrCodeLevel ?? 0]` | line 10491 — **0=M, 1=L, 2=H, 3=Q** |
| `barcolor` | `options.barColor \|\| "#000"` | line 10492 |

After render, if `!hideTitle`, an extra `<div class="hiprint-printElement-qrcode-content-title">` is appended below the SVG [V1 line 10495–10501] with computed style:
- `text-align` from `options.textAlign` (default `"center"`)
- `font-size` from `options.fontSize + 'pt'` (default `9pt`)
- `line-height: 1.5`
- Special-case for `textAlign === 'justify'`: emits `text-align-last: justify; text-justify: distribute-all-lines;`

### B.4 Table-cell barcode/qrcode (Path A-table)

When a table column has `tableTextType: 'barcode'` or `'qrcode'` [V1 line 2147, 2180], the renderer uses JsBarcode/QRCode (same libraries as Path A).

Column-level options (read from `column` object, not `element.options`):

| Option | Default | Path | Source |
|---|---|---|---|
| `tableTextType` | `(unset = text)` | enum: `""/"text"/"sequence"/"barcode"/"qrcode"/"image"` | `<select>` "字段类型" [V1 line 5020–5031] |
| `tableBarcodeMode` | `"CODE128A"` | enum: same as B.1.2 but UI uses `EAN-13` etc. instead of `EAN13` (UI-only naming difference) | `<select>` "条形码格式" [V1 line 5038–5050] |
| `tableQRCodeLevel` | `0` (M) | int 0/1/2/3 | `<select>` "二维码容错率" [V1 line 5051–5068] |
| `tableColumnHeight` | `30` (pt for barcode) / `20` (pt for qrcode) / `50` (pt for image) | string (placeholder "条形码、二维码以及图片有效") | `<input>` "单元格高度" [V1 line 5069–5086] |
| `showCodeTitle` | `false` | bool | `<select>` "显示码值" [V1 line 5176+] |

Fixed args in table-cell barcode JsBarcode [V1 line 2152–2160]:
- `format: tableBarcodeMode || "CODE128A"`
- `width: 1`, `textMargin: -1`, `lineColor: "#000000"`, `margin: 0`
- `height: parseInt(10)` (FIXED!)
- `displayValue: false` (text drawn via separate `.hibarcode_displayValue` div only when `showCodeTitle`)
- Post: SVG `height` attr forced to `tableColumnHeight || '30pt'`, margin `'5pt 10pt'`, width `"calc(100% - 20pt)"`

Fixed args in table-cell qrcode QRCode [V1 line 2189–2195]:
- `width/height: min(column.width || targetWidth || 20, tableColumnHeight || 20)` (square in pt)
- `colorDark: "#000000"` (FIXED — no per-column color!)
- `useSVG: true`
- `correctLevel: tableQRCodeLevel || 0`

---

## Section C — Pre-built factory presets default options (consolidated)

Already covered in A.1–A.3. This table summarizes the **effective** defaults a user sees on drag:

| Preset | textType | Width×Height | barcodeType/Mode | qrCodeLevel | hideTitle | testData |
|---|---|---|---|---|---|---|
| `defaultModule.barcode` | `barcode` | 140×35 pt | `barcodeMode: <unset> → "CODE128"` | n/a | `true` | `"123456789"` |
| `defaultModule.qrcode` | `qrcode` | 50×50 pt | n/a | `<unset> → 0 (M)` | `true` | `"https://example.com"` |
| `defaultModule.trackingNo` | `barcode` | 180×50 pt | `barcodeType: "code128"` (dead under Path A — see J.1) | n/a | `<unset> → false` | `"SF1234567890"` |

There are no factory presets for Path B (separate `type:'barcode'/'qrcode'`); library users must register them manually via `addPrintElementTypes`.

---

## Section D — Property panel sections rendered for these etypes

### D.1 Path A — text element panel

`getConfigOptions()` returns `instance.text` [V1 line 10029–10030]. The text panel's `supportOptions` (assembled at bundle init, line 5989) includes — at minimum — these items relevant to barcode/qrcode mode:

| Section (panel order) | Option name | Visible when `textType=` |
|---|---|---|
| **基础** | `field` | always |
| | `title` | always |
| | `testData` | always |
| | `hideTitle` | always (semantic differs by textType) |
| **样式** | `textType` | always — **the switch** |
| | `barcodeMode` | barcode (UI does NOT auto-hide in V1 — it's always shown; just no-op for text/qrcode mode) |
| | `barTextMode` | barcode |
| | `barWidth` | barcode |
| | `barAutoWidth` | barcode |
| | `qrCodeLevel` | qrcode |
| | `color` | always (lineColor / colorDark for codes) |
| | `fontSize`, `fontWeight`, `textAlign` | always (affect appended title for codes) |
| | `lineHeight` | always |
| **位置与尺寸** | `coordinate` (left,top + posLock) | always |
| | `widthHeight` (w,h + sizeLock) | always |
| | `rotate` | always |
| | `zIndex` | always |
| **高级** | `dataType`, `format` | text mode primarily |
| | `formatter`, `styler` | always |
| | `upperCase` | always |
| | `pageBreak` | always |

NOTE: V1 does not gate barcode-only fields behind `textType === 'barcode'` in the panel — they always render. The dropdown values are simply ignored when `textType` is something else. This is a UX quirk users sometimes hit (Section J.2).

Switching `textType` triggers `setResizePanel()` rebuild because resize handles differ ([V1 line 1093] returns `["s","w","e","se","r"]` for codes vs `["s","w","e","r"]` for text — codes have an extra `"se"` corner handle). See [V1 line 947, 962, 978] for the dirty-check + trigger.

### D.2 Path B — barcode element panel

`getConfigOptions()` returns `instance.barcode` [V1 line 10391–10392]. This is a **separate** supportOptions list (assembled at instance init), distinct from text's. Visible items:

| Section | Option name |
|---|---|
| 基础 | `field`, `title`, `testData`, `hideTitle` |
| 样式 | `barcodeType` (cascader-style optgroup select, 84 values), `barWidth`, `barAutoWidth`, `barColor` |
| 位置与尺寸 | `coordinate`, `widthHeight`, `rotate`, `zIndex` |
| 高级 | `formatter`, `styler`, `pageBreak`, `upperCase`, `fontSize`, `textAlign` |

`textType`, `barcodeMode`, `barTextMode`, `qrCodeLevel` are NOT in Path B's panel.

### D.3 Path B — qrcode element panel

`getConfigOptions()` returns `instance.qrcode` [V1 line 10459–10460]. Visible items:

| Section | Option name |
|---|---|
| 基础 | `field`, `title`, `testData`, `hideTitle` |
| 样式 | `qrcodeType` (flat 19-value select), `qrCodeLevel`, `barColor` |
| 位置与尺寸 | `coordinate`, `widthHeight`, `rotate`, `zIndex` |
| 高级 | `formatter`, `styler`, `pageBreak`, `fontSize`, `textAlign` |

`barcodeMode`, `barTextMode`, `barWidth`, `barAutoWidth`, `textType` are NOT in Path B's panel.

---

## Section E — Render output DOM

### E.1 Path A barcode design-time DOM

Created at [V1 line 10127–10129]:
```html
<div tabindex="1" class="hiprint-printElement hiprint-printElement-text" style="position:absolute;">
  <div class="hiprint-printElement-text-content hiprint-printElement-content" style="height:100%;width:100%; display:flex; flex-direction:column;">
    <svg width="100%" height="100%" display="block" class="hibarcode_imgcode" preserveAspectRatio="none slice">
      <!-- JsBarcode-generated <rect>s -->
    </svg>
    <!-- IF barTextMode === 'text' AND !hideTitle: -->
    <div class="hibarcode_displayValue" style="white-space:nowrap">{value}</div>
  </div>
</div>
```

Notes:
- Width/height attrs are forced after JsBarcode runs [V1 line 10079]
- `display:flex; flex-direction:column` set inline at line 10059–10062
- `tabindex="1"` enables keyboard focus for arrow-key move
- The text-content div is the renderer's mount point; JsBarcode replaces its `.html()` each call

### E.2 Path A qrcode design-time DOM

Created at [V1 line 10094–10117]:
```html
<div tabindex="1" class="hiprint-printElement hiprint-printElement-text" style="position:absolute;">
  <div class="hiprint-printElement-text-content hiprint-printElement-content" style="height:100%;width:100%; display:flex; flex-direction:column;">
    <div class="hiqrcode_imgcode" style="width:{min}pt; height:{min}pt; margin:auto;">
      <svg><!-- qrcode.js useSVG output --></svg>
    </div>
    <!-- IF !hideTitle: -->
    <div class="hiqrcode_displayValue" style="white-space:nowrap">{value}</div>
  </div>
</div>
```

Notes:
- The box is squared to `Math.min(width, height)` in pt [V1 line 10104–10107]
- `margin:auto` centers the square inside non-square containers
- `useSVG:true` is hard-coded — the qrcode plugin emits an inline SVG with `<rect>` cells

### E.3 Path B barcode design-time DOM

Created at [V1 line 10442]:
```html
<div class="hiprint-printElement hiprint-printElement-barcode" style="position:absolute;">
  <div class="hiprint-printElement-barcode-content" style="height:100%; width:100%; display:flex; flex-direction:column;">
    <svg preserveAspectRatio="none slice" viewBox="..."><!-- bwip-js output --></svg>
  </div>
</div>
```

Notes:
- Distinct class `.hiprint-printElement-barcode` (not `-text`)
- Inner `.hiprint-printElement-barcode-content` mount point
- bwip-js generates a self-contained SVG including the text if `includetext:true`

### E.4 Path B qrcode design-time DOM

Created at [V1 line 10511]:
```html
<div class="hiprint-printElement hiprint-printElement-qrcode" style="position:absolute;">
  <div class="hiprint-printElement-qrcode-content" style="height:100%; width:100%; display:flex; flex-direction:column;">
    <svg><!-- bwip-js qrcode output --></svg>
    <!-- IF !hideTitle: -->
    <div class="hiprint-printElement-qrcode-content-title" style="text-align:{textAlign}; font-size:{fontSize}pt; line-height:1.5;">{title}</div>
  </div>
</div>
```

Notes:
- The appended title `<div>` style is **interpolated as a string** at line 10500. Title text is also interpolated. This is a known XSS risk if `title` is sourced from untrusted input (see project rule `.claude/rules/security.md`). V1 does NOT escape `title` here. **V3 must use `.text()` or sanitization.**

### E.5 Print-time DOM (getHtml2 path)

All four paths (A-barcode, A-qrcode, B-barcode, B-qrcode) override `getHtml(t,e,n)` to simply call `getHtml2(t,e,n)` [V1 line 10131, 10215 etc., 10446, 10515]. `getHtml2` (BasePrintElement, line 1172) computes pagination then calls `createTarget(title, data)` → which re-renders the SVG via the same `initBarcode`/`initQrcode`/`updateTargetText` path. Output is identical to design-time DOM except `tabindex="1"` is preserved and absolute positioning uses computed pt offsets.

### E.6 CSS classes summary

| Class | Applies to | V1 source |
|---|---|---|
| `.hiprint-printElement` | All elements (root) | [V1 line 10128, 10442, 10511] |
| `.hiprint-printElement-text` | Path A barcode/qrcode root | [V1 line 10128] |
| `.hiprint-printElement-text-content` | Path A inner mount | [V1 line 10128] |
| `.hiprint-printElement-content` | Path A inner (added at line 10128) | |
| `.hiprint-printElement-barcode` | Path B barcode root | [V1 line 10442] |
| `.hiprint-printElement-barcode-content` | Path B barcode inner | [V1 line 10442] |
| `.hiprint-printElement-qrcode` | Path B qrcode root | [V1 line 10511] |
| `.hiprint-printElement-qrcode-content` | Path B qrcode inner | [V1 line 10511] |
| `.hiprint-printElement-qrcode-content-title` | Path B qrcode appended title | [V1 line 10500] |
| `.hibarcode_imgcode` | Path A barcode SVG | [V1 line 10066] |
| `.hibarcode_displayValue` | Path A barcode separate-text div | [V1 line 10068] |
| `.hiqrcode_imgcode` | Path A qrcode SVG wrapper | [V1 line 10104] |
| `.hiqrcode_displayValue` | Path A qrcode title div | [V1 line 10117] |
| `.el-type-tag.tag-barcode` | Element list panel tag (red bg `#f56c6c`) | hiprint.css line 1824 |
| `.el-type-tag.tag-qrcode` | Element list panel tag (red bg `#f56c6c`) | hiprint.css line 1825 |
| `.hiprint-printElement-text` | Print-lock screen layout | print-lock.css line 89, 111 |

---

## Section F — Interactions

### F.1 Field binding → encoded value

The flow (Path A):
1. `updateTargetText(target, title, data, templateData)` called by `updateDesignViewFromOptions()` on every options change, drop, or `template.print(data)` cycle.
2. Inside: `n = data` (already resolved via `getData(templateData)` line 10034–10045).
3. `getData(t)` runs nested-field reduce: `f.split('.').reduce((a,c) => (a != null ? a[c] : undefined), t)` [V1 line 10037]. So `field: "user.profile.name"` works correctly even when intermediate values are `0`, `false`, or `""` (because the guard is `a != null` — not falsy).
4. If no live template data, fallback chain: `testData` → `printElementType.getData()` → `""`.
5. If `options.formatter` is set, `getFormatter()` `new Function('return ' + str)()`'s it and runs `r(title, n, options, templateData, target)` [V1 line 10050]. The formatter return value becomes the encoded payload.
6. If `options.upperCase`, `hinnn.toUpperCase(upperCase, value)` wraps it [V1 line 10050]. Common case: `'upper'` for CODE39 which requires uppercase only.
7. **Title prefix**: if `getField()` is truthy AND `getHideTitle()` is falsy, payload becomes `title + "：" + value` [V1 line 10050]. **This means**: with `hideTitle:false` AND a `field`, the encoded barcode value will include the Chinese full-width colon! Most CODE128 implementations support it via CODE128B but EAN/UPC will fail. **V1 quirk → V3 should probably split title display from encoded payload.**
8. Payload `n` is passed to JsBarcode/QRCode as the text argument.

Special characters in value:
- JsBarcode validates against the chosen format and throws on invalid char → caught at [V1 line 10088], element shows `i18n.__('此格式不支持该文本')` ("此格式不支持该文本") via `.html()`.
- QRCode supports all UTF-8 (8-bit byte mode) — no exceptions thrown in practice for valid strings.

### F.2 Empty value handling

Path A barcode: if `n` is falsy → `a.html("")` [V1 line 10080 ternary `else` branch]. Element shows empty space (no placeholder). NO error toast.

Path A qrcode: outer guard `if (n)` at line 10097 — if falsy, the qrcode branch is skipped entirely and `a.html("")` at line 10094 leaves the element blank.

Path B barcode: `text = text || testData || title` [V1 line 10413] — falls back to `title` ("条形码") if nothing else. **This means an unbound Path B barcode will always render with the title as the encoded payload**, which differs from Path A. Caught error → shows `i18n.__('条形码生成失败')` ("条形码生成失败") [V1 line 10435].

Path B qrcode: same fallback chain [V1 line 10483]. Catches at line 10503, displays `i18n.__('二维码生成失败')` ("二维码生成失败").

### F.3 Format-specific validation

V1 does **NOT** pre-validate value against format. It relies on JsBarcode/bwip-js to throw at render time:

- EAN-13 with non-13-digit string → JsBarcode throws → catch at line 10088 → "此格式不支持该文本" message
- CODE39 with lowercase letter → throws → same handling
- QR code → no length validation in practice (handles up to ~4000 chars at level L; throws "Code length overflow" if exceeded — caught at line 10119 → "二维码生成失败")

There is **NO inline error visualization**; the element just shows the i18n error message inside its body. Users have to read the message to understand what went wrong. No tooltip, no red border, no console diagnostic (only `console.warn` line 10089/10120 with `[hiprint] barcode render failed:`/`[hiprint] qrcode render failed:`).

### F.4 Size change re-render

`onResize(e, n, i, o, r)` override [V1 line 10124–10126 for Path A]:
- Path A: calls super.onResize, then **only if textType is barcode/qrcode**, re-runs `updateTargetText`.
- Path B barcode: line 10395–10397 — always re-runs `initBarcode`.
- Path B qrcode: line 10461–10463 — always re-runs `initQrcode`.

**Re-render fires on every resize tick**, not just on commit. This means dragging the corner handle re-renders the SVG continuously (potentially expensive for long EAN13/Aztec/QR data — V1 quirk J.3). No debouncing.

Resize handle set for codes [V1 line 1093 + 10440 + 10509]:
- Path A barcode/qrcode: `["s", "w", "e", "se", "r"]` — south, west, east, southeast corner, rotate
- Path B barcode/qrcode: same `["s", "w", "e", "se", "r"]`
- Pure text: `["s", "w", "e", "r"]` — no `"se"` corner

(Note: "n"/"nw"/"ne" handles are NOT shown for codes. This is asymmetric — you can resize down/right/down-right but not up/left/up-left.)

### F.5 Formatter chain interaction

The formatter is invoked **before** the value is sent to the barcode/qrcode library [V1 line 10050]. Signature is the standard text-element signature: `formatter(title, data, options, templateData, target)`.

Common use cases:
- Stripping prefixes: `function(t,d){return String(d).replace(/^TN_/, '')}`
- Number formatting before encoding: `function(t,d){return d.toFixed(2)}`
- Conditional encoding: `function(t,d,o,td){return td.region === 'CN' ? d : 'INTL_'+d}`

If `new Function('return ' + str)()` throws (syntax error in user-supplied code), the renderer falls back to `printElementType.formatter` and logs `[hiprint] element formatter eval failed, fallback to printElementType.formatter:` [V1 line 1538–1541]. The element will still render but with the type-level formatter (or no formatter if none).

### F.6 testData fallback rendering

Path A `getData(t)` [V1 line 10034–10045]:
```
e = t
  ? f
    ? f.split('.').reduce(...) ?? ""    // live template data
    : ""                                   // no field bound, no testData visible at print time
  : this.options.testData || this.printElementType.getData() || ""  // design time
```

Design-time (`t === undefined`): testData is used. This is what users see in the editor.
Print-time (`t === templateData`): testData is **ignored**; live data wins. If field missing in templateData, value becomes `""` → blank barcode → empty space.

Path B `getData(t)` [V1 line 10401–10404 and 10466–10470]: same fallback chain, but the bwip-js call at line 10413/10483 has an **extra** fallback `text || testData || title`. So even if `getData` returns `""`, bwip-js gets the element's `title` as the encoded payload at the very last step. This is a subtle Path B-only behavior.

### F.7 textType change interaction

When user changes `textType` in the property panel (Path A only):
1. `applyOptionsValue` (line 962) detects `'textType' == e.name && t.options[e.name] !== n` → sets dirty flag `r=true`.
2. Writes new value into `options.textType`.
3. Calls `t.setResizePanel()` [V1 line 968] to rebuild resize handles (because the handle set differs between text/code).
4. `updateDesignViewFromOptions()` re-runs `updateTargetText` → re-renders with the new branch.

The same flow runs when multiple elements are selected and the user changes textType — applied to all via the `els.forEach` at line 945.

### F.8 Lock + barcode interaction

- `positionLocked: true` → element cannot be dragged ([V1 line 814, 1098]), but resize still works unless `sizeLocked:true`.
- Right-click "锁定元素" sets **both** `positionLocked:true` AND `sizeLocked:true` [V1 line 11531–11533].
- Locking does NOT pause re-renders — the barcode/qrcode still re-renders on options changes.
- Lock state is reflected in the element list panel as a lock icon [V1 line 11892–11893].

### F.9 Drag + drop into panel

When user drags `defaultModule.barcode` from the component panel and drops it:
1. Drop handler (line 1500-ish region) reads `printElementType.options`.
2. Instantiates new text element via factory `createPrintElement` at line 10523.
3. Calls `updateDesignViewFromOptions()` → `updateTargetText` → JsBarcode renders with `testData:"123456789"`.
4. Initial position: drop coordinates snapped to `movingDistance` grid.

### F.10 Copy/paste

Right-click "复制元素" [V1 line 11436–11442]:
- Stores **element reference** in `panel._contextCopyElements` (NOT deep clone).
- Paste uses `srcEl.clone()` at line 11449. The clone copies the options object via [V1 line 1530–1532] `Object.keys(n.options).forEach(key => newObj.options[key] = n.options[key])` → shallow copy. Same `barcodeType`/`testData`/`hideTitle`/etc.
- Pasted element offset by +10pt from source [V1 line 11451–11452].

### F.11 Keyboard arrow-key move

Path A elements have `tabindex="1"` [V1 line 10128] → focusable → arrow keys nudge position by `movingDistance` units. No code-specific behavior; inherited from BasePrintElement.

Path B elements do NOT have `tabindex` on createTarget [V1 line 10442, 10511]. **This means Path B barcode/qrcode cannot be keyboard-moved.** Likely a V1 oversight (J.4).

---

## Section G — Right-click context menu items

When user right-clicks a barcode/qrcode in the design panel, the context menu at [V1 line 11421–11616] renders:

### G.1 Always visible (regardless of selection)

| Item | Source | Behavior |
|---|---|---|
| 元素操作 (group header) | [V1 line 11432] | non-clickable |
| 复制元素 | [V1 line 11435–11441] | disabled if no selection; stores selectedEls reference |
| 粘贴元素 | [V1 line 11444–11461] | disabled if no copy buffer; clones with +10pt offset |

### G.2 Selection-conditional (hasSelection === true)

| Item | Group | Source | Effect on barcode/qrcode |
|---|---|---|---|
| 字体 12pt | 参数更新 | [V1 line 11469–11475] | Sets `options.fontSize=12`. Affects appended title text for codes (NOT bar size). |
| 字体加粗 | 参数更新 | [V1 line 11477–11483] | Sets `options.fontWeight='bolder'`. Same as above. |
| 置于顶层 | 层级操作 | [V1 line 11488–11496] | maxZ+1 of all elements |
| 置于底层 | 层级操作 | [V1 line 11497–11508] | Push others up by selectedEls.length+1 |
| 上移一层 | 层级操作 | [V1 line 11509–11515] | zIndex += 1 |
| 下移一层 | 层级操作 | [V1 line 11516–11522] | zIndex = max(0, zIndex-1) |
| 锁定元素/解锁元素 | (toggle) | [V1 line 11525–11540] | Sets posLocked + sizeLocked together when locking; only unsets posLocked when unlocking |
| 左对齐 / 右对齐 / 顶对齐 / 底对齐 / 水平居中 / 垂直居中 | 对齐操作 (multi-select ≥ 2) | [V1 line 11546–11566] | Position-only; does not re-render code |
| 水平等距 / 垂直等距 | (multi-select ≥ 3) | [V1 line 11554–11557] | Even-distribute positions |
| 等宽 / 等高 | (multi-select ≥ 2) | [V1 line 11569–11592] | Sets width/height to selectedEls[0]'s — triggers re-render via `updateDesignViewFromOptions` |
| 删除选中元素 (count) | (danger style) | [V1 line 11596–11610] | Removes from panel.printElements |

### G.3 NOT in context menu (must use property panel)

- Change `textType`
- Change `barcodeMode` / `barcodeType` / `qrcodeType`
- Change `field` / `testData`
- Change `hideTitle`
- Toggle `barAutoWidth`

---

## Section H — Lock behavior

### H.1 positionLocked

When `options.positionLocked === true`:
- Drag disabled: `draggable: false` set on the hireizeable instance [V1 line 1098].
- Mouse cursor over element does NOT show move cursor.
- Drag attempt is no-op.
- Keyboard arrow-key still works (V1 quirk J.5 — arrow keys check `draggable !== false` and `!positionLocked`, line 1659 — but with both being false this might be inconsistent; verify in practice).

Property panel: coordinate row shows a locked icon next to the position inputs [V1 line 3609 + 3662 setValue].

### H.2 sizeLocked

When `options.sizeLocked === true`:
- Width/height inputs in panel are `disabled` [V1 line 3692–3693].
- Resize handles do not appear on the element (or are disabled — verify).
- Lock checkbox shows checked state [V1 line 3690].

### H.3 Combined lock (right-click "锁定元素")

[V1 line 11528–11539]:
```js
selectedEls.forEach(function (el) {
  var newVal = !hasLocked;
  el.options.positionLocked = newVal;
  if (newVal) el.options.sizeLocked = true;    // lock both when locking
  // unlock only positionLocked; sizeLocked NOT reset
  el.updateDesignViewFromOptions();
  ...
});
```

**Asymmetric**: locking sets BOTH; unlocking only clears `positionLocked`, leaves `sizeLocked` as-is. Users must manually uncheck the size lock checkbox. V1 quirk J.6.

### H.4 Lock state in element list panel

[V1 line 11892–11893]: `posLocked` and `sizeLocked` are computed per row and rendered as lock icons. Click handler toggles `positionLocked` only (size lock is read-only icon in the list — confirm by reading more lines).

---

## Section I — CSS classes & states

Already enumerated in E.6. Additional state classes:

| Class | When applied | Source |
|---|---|---|
| `.selected` | Element is the currently selected one (single-select) | applied via `.children().last().addClass('selected')` pattern, [V1 line 11622–11623] |
| `.hidden-el` | Row in element list panel for elements with `display:none` | [V1 line 11897] |
| `.hiprint-text-content-wrap-nowrap` / `-clip` / `-ellipsis` | `textContentWrap` option | [V1 line 4837–4844] — applies to text but NOT typically used for codes (no wrapping needed for SVG bars) |
| `.hiprint-text-content-middle` / `-bottom` | `textContentVerticalAlign` option | [V1 line 4814–4818] |
| `.editing` | When element is in inline-edit mode (text only) | [V1 line 11401–11403] |

For Path A code mode, the `.hiprint-text-content-wrap-*` and `-vertical-align-*` classes are still applied (the renderer doesn't strip them) but they have no visible effect because the SVG fills the content area.

Inline styles applied at runtime (Path A):
- `display:flex` + `flex-direction:column` on `.hiprint-printElement-text-content` [V1 line 10059–10062 for barcode, 10098–10101 for qrcode]
- `.hibarcode_imgcode` gets `height:100%`, `width:100%` forced after JsBarcode runs [V1 line 10079]
- `.hibarcode_displayValue` gets `white-space:nowrap` inline [V1 line 10068]
- `.hiqrcode_imgcode` gets `width:{min}pt`, `height:{min}pt`, `margin:auto` [V1 line 10104–10107]
- `.hiqrcode_displayValue` gets `white-space:nowrap` [V1 line 10117]

Path B inline styles:
- Root `.hiprint-printElement-barcode` has `position:absolute` [V1 line 10442]
- `.hiprint-printElement-barcode-content` has `display:flex; flex-direction:column` [V1 line 10442]
- Same pattern for qrcode at line 10511

---

## Section J — V1 quirks

### J.1 `barcodeType` on `defaultModule.trackingNo` is dead under Path A

`defaultModule.trackingNo` is `type:'text'` with `textType:'barcode'`, which routes to Path A (JsBarcode). Path A's renderer reads `options.barcodeMode` (uppercase, JsBarcode vocab) — NOT `options.barcodeType` (lowercase, bwip-js vocab). The `barcodeType: 'code128'` on the preset [V1 etypes-provider line 277] is therefore **silently ignored**. The effective format is whatever `getbarcodeMode()` returns, which falls back to `"CODE128"` [V1 line 9978]. Result: trackingNo *happens* to render as CODE128 because both defaults agree, but if a user assumes setting `barcodeType` in the JSON will change the format, they'll be wrong.

V3 fix candidate: either remove the dead `barcodeType` field or migrate the preset to Path B.

### J.2 Property panel does not hide irrelevant options when textType changes

When `textType === 'text'`, the barcodeMode / barTextMode / barWidth / barAutoWidth / qrCodeLevel fields are still rendered in the panel. They are no-ops. Users get confused (especially with `barcodeMode` defaulting to "默认" so they expect it does something). [V1 line 5989 supportOptions list is built once and shared.]

V3 fix: conditional rendering based on `textType`.

### J.3 Re-render on every resize tick (no debouncing)

Both Path A and Path B re-run the full library render on **every resize event**. For large QR codes (Aztec, hibcpdf417) this can be visually janky on slow machines. No throttle/debounce [V1 line 10125, 10396, 10462].

### J.4 Path B elements lack `tabindex` → no keyboard move

`createTarget` for Path B at [V1 line 10442, 10511] omits `tabindex="1"`. The element cannot be focused, so arrow keys do nothing. Path A (line 10128) has `tabindex="1"` and works correctly. Likely an oversight when the Path B classes were added.

V3 fix: add `tabindex="1"` to both Path B createTarget calls.

### J.5 Title + field auto-prefix corrupts encoded barcode value

If `hideTitle:false` AND `field` is set, `updateTargetText` line 10050 builds the encoded payload as `title + "：" + value`. The full-width colon is a non-ASCII character that breaks EAN/UPC/Code39. CODE128B tolerates it but CODE128A doesn't.

[V1 etypes-provider line 339] avoids this trap for `defaultModule.barcode` by setting `hideTitle:true`. But `defaultModule.trackingNo` does NOT set `hideTitle` — relies on CODE128 (auto-mode) which falls through to CODE128B (Latin-1 supported) so the colon doesn't crash. Fragile.

V3 fix: separate `displayLabel` from `encodedValue`. The label should be a sibling DOM node, not concatenated into the bwip/JsBarcode `text` argument.

### J.6 Lock toggle asymmetry

Right-click "锁定元素" sets BOTH `positionLocked:true` and `sizeLocked:true`. Right-click "解锁元素" only clears `positionLocked`. User must manually uncheck size lock in the panel. [V1 line 11531–11533]

V3 fix: symmetrize — unlock should clear both.

### J.7 `barAutoWidth` mutates `options.width` as side effect

When Path A barcode renders and `barAutoWidth:true` + `svgWidth > options.width`, line 10086 does `this.options.width = svgWidth;`. This **silently overwrites the template's saved width**. Next time the template is serialized to JSON, the new wider width is persisted. If user explicitly sets a narrow width but provides a long value, the width gets bumped without warning.

Same pattern in Path B at line 10430.

V3 fix: keep `options.width` immutable from render; track displayed width as a separate runtime field.

### J.8 Path A qrcode forces square via `Math.min(width, height)`

If user sets width=100, height=50 on a qrcode element, the rendered SVG box is 50×50pt (the min), and `margin:auto` centers it horizontally in the wider container. There's no visual warning; users may think their qrcode is "shrunk" when it's actually constrained to a square.

Path B qrcode also forces square but via `Math.min(width/2.835, height/2.835)` in mm [V1 line 10488–10489]. Same UX issue.

V3 candidate: either enforce square (lock aspect ratio) or warn the user.

### J.9 Two different qrCodeLevel encodings between Path A and Path B

Path A (Element-level, qrcode.js):
```
correctLevel: this.options.qrCodeLevel       // 0=M, 1=L, 2=H, 3=Q (qrcode.js native)
```

Path B (bwip-js):
```
eclevel: ['M','L','H','Q'][this.options.qrCodeLevel ?? 0]  // index lookup
```

Both **happen to** produce the same letter for the same numeric value (0→M, 1→L, 2→H, 3→Q), so the property panel's same `<select>` works for both. But this is fragile coincidence; the underlying API contracts are different. [V1 line 10114 vs 10491.]

V3 fix: normalize internally to a single canonical enum (e.g. `'L'|'M'|'Q'|'H'`) and convert at the library boundary.

### J.10 Path A barcode dies silently on missing `field` for the default preset

Comment at [V1 etypes-provider line 326–328]:
> `必须有 field —— hiprint 内部 updateTargetText 在 textType=barcode 分支 无 field 时会把 title 作为 barcode 编码内容渲染, "条形码" 中文字符 code128 不支持，会显示"此格式不支持该文本"。`

That is: if a user removes the default `field:"barcode"` from the preset (or registers a custom preset without `field`), the title string ("条形码") gets passed to JsBarcode, which throws because CODE128 doesn't support Chinese. The fallback line 10089 displays `"此格式不支持该文本"` instead of the barcode. No alert; users may not understand why their element is showing an error string.

V3 fix: validate `field` is present at registration time, or fall back to a sentinel like `"NO_FIELD"` that the user clearly sees.

### J.11 Path B barcode falls back to title as encoded payload

Path B line 10413: `text: text || this.options.testData || this.options.title`. If everything is empty, the literal string `"条形码"` (or whatever title is set) becomes the bwip-js `text` arg. This either renders nonsense bars or throws "条形码生成失败". V1 quirk: silent fallback to title is rarely what users want.

V3 fix: explicit empty-state UI ("Please set a field or testData") instead of falling through to title.

### J.12 Color option semantic split

For Path A:
- `options.color` → barcode `lineColor`, qrcode `colorDark`. Single field, two libraries.
- Background color of the entire element comes from `backgroundColor` (separate option), but qrcode.js does NOT use it (`colorLight` defaults to `#fff`). So setting a backgroundColor for a qrcode element shows the bg behind the white space around the qr modules, which is usually correct.

For Path B:
- `options.barColor` → bwip-js `barcolor`. **Different field name** from Path A's `color`.
- bwip-js `bordercolor` and `backgroundcolor` are NOT exposed in the property panel.

V3 fix: unify to a single `foregroundColor` (or `barColor`) option name across both paths.

### J.13 Table-cell qrcode color is hard-coded `#000000`

[V1 line 2192]: `colorDark: "#000000"`. Unlike standalone qrcode where `options.color` is honored, table cells always render black. There is no `tableQRColor` option. Users wanting colored qrcodes in tables are out of luck.

### J.14 Table-cell barcode height hard-coded to `parseInt(10)`

[V1 line 2158]: `height: parseInt(10)`. The `10` is a literal int — `parseInt(10)` is `10`. Probably a leftover from a stringified default. The actual displayed height is then forced to `tableColumnHeight || '30pt'` via SVG attr at line 2160. So the JsBarcode `height:10` only affects the internal raster proportions; visible height is column-driven. Confusing.

### J.15 No DataMatrix support in Path A

Path A's `textType` enum only has `barcode`/`qrcode`/`text`. To render DataMatrix or Aztec, users MUST use Path B with `qrcodeType: 'datamatrix'` etc. This is the main reason Path B exists — and most users don't realize they need to switch paths.

### J.16 `barWidth` enum is 1..4 only

Path A's `barWidth` `<select>` [V1 line 2943] offers only `1/2/3/4`. There's no "thicker" option. For high-DPI printing of small barcodes, users sometimes need barWidth=5 or 6. Path B's `barWidth` (mapped to bwip-js `scale`) is technically unbounded, but the panel select limits it to 1..4 anyway.

### J.17 No quiet-zone (margin) control

Path A barcode hardcodes `margin: 0` [V1 line 10076]. Path A qrcode has no margin/quiet-zone arg (qrcode.js doesn't expose it). Path B barcode uses bwip-js defaults (which have small quiet zones). None of the property panels expose margin/padding.

Users sometimes need to add quiet zones for scanners that fail without them; V1 forces them to use a wrapping `<div>` with padding in CSS, which doesn't actually create true SVG quiet zones (just visual padding).

### J.18 Title field XSS risk in Path B qrcode

[V1 line 10500]: `content.append($(\`<div class="hiprint-printElement-qrcode-content-title" style="${ textStyle }">${ titleText }</div>\`))`. `titleText` is interpolated as raw HTML. If `title` contains `<script>` or `<img onerror>`, it executes. This is fixed in the text path (line 10056 uses `.text()`) but the Path B qrcode path is **not yet fixed** as of bundle line 10500.

Confirmed by `.claude/rules/security.md` Section 1 — this is on the list of historical XSS targets but the bundle still uses template-literal interpolation here.

V3 fix: replace with jQuery DOM API + `.text()` per project rule.

### J.19 Field dropdown vs free-input switch

`field` property panel control [V1 line 3550–3559]:
- If `getFields()` returns a non-empty list → renders as `<select>` (`isSelect = true`)
- Else → renders as free-text `<input>`

The decision happens once at panel build. If user later updates the template's `fields` (e.g. via API), the field control type is **not** refreshed. User has to close and reopen the panel.

### J.20 Path A `getReizeableShowPoints` reads `this.options.textType` directly, not via getter

[V1 line 1093]: `return ['barcode', 'qrcode'].includes(this.options.textType) ? ...`. This bypasses `getTextType()` which has the default-fallback chain (line 9973). So if `options.textType` is `null` (cleared) but `defaultOptions.textType` was set to `'barcode'`, the resize handle set will be wrong (gets the text set instead of the code set). Edge case but real.

V3 fix: use `getTextType()` consistently.

### J.21 No "barcode unsupported character" pre-validation

JsBarcode silently throws for invalid chars. The catch at line 10088 replaces the SVG with the i18n message — but **the previous SVG is lost**. If user is typing into the testData input character by character, every invalid intermediate state wipes the barcode and shows the error message, then on next valid state re-renders the barcode. The flicker can be jarring.

V3 candidate: keep last-valid SVG visible with an overlay error indicator instead of wiping.

### J.22 Path A barcode displayValue uses `.text()` but inside an SVG-only initial `.html()`

[V1 line 10066]: `a.html('<svg ...></svg>')` — wipes the container.
[V1 line 10068]: `a.append('<div class="hibarcode_displayValue" style="white-space:nowrap">')` — appended **inside** the same container that holds the SVG.
[V1 line 10080]: `a.find(".hibarcode_displayValue").text(n)` — safe, uses `.text()`.

This is OK for XSS but layout-wise the displayValue div ends up beside the SVG inside the flex column. Make sure CSS doesn't break.

### J.23 `barAutoWidth` enum default is the string `"true"`, not the boolean `true`

[V1 line 9985]: `return (null == this.barAutoWidth ? this.defaultOptions.barAutoWidth === "true" : this.barAutoWidth === "true") ?? true;`

The check `=== "true"` (string comparison) is necessary because the property panel `<select>` stores `"true"` or `"false"` as string values. Anyone setting `barAutoWidth: true` (boolean) in JSON-generated templates will get `false` (because `true === "true"` is `false`)! V1 quirk J.23: must serialize as **string**.

The `?? true` at the end is a defense-in-depth fallback that fires when both `this.barAutoWidth` and `defaultOptions.barAutoWidth` are nullish — in which case the result is `true`.

V3 fix: accept both boolean and string, normalize internally.

### J.24 Path A barcode `textMargin: -1`

[V1 line 10074]: hardcodes `textMargin: -1`. Reason (per JsBarcode docs): pulls the displayValue text upward to overlap the bottom of the bars by 1px, reducing visual gap. This is fine for screen but can fail on printers that don't render negative margins. No way to disable.

### J.25 Path B qrcode `2.835` magic number

[V1 line 10488]: `parseInt(width / 2.835)`. This is `pt → mm` conversion (1mm ≈ 2.835pt at 72dpi). The literal `2.835` appears uncommented. V3 should use `pt.toMm()` helper for consistency.

### J.26 No fallback when qrcode.js plugin fails to load

`./plugins/qrcode.js` is side-effect imported [V1 line 44]. If the plugin fails to register `window.QRCode`, the runtime `new QRCode(...)` at line 10109 throws → caught at line 10119 → "二维码生成失败". No initialization-time check.

### J.27 i18n key collision with text type

`i18n.__('条形码')` appears for:
- Path A textType select label [V1 line 5005]
- Path A barcodeType cascader group label [V1 line 3014]
- Element list type tag [V1 line 11882]

All resolve to the same i18n entry. If a translator localizes "条形码" to "Barcode" they get the same label in three places, which is intended. But changing only one without the others would require renaming the i18n keys.

### J.28 `showCodeTitle` is table-only

[V1 line 5176]: This option is only in the table-cell property panel, not in standalone barcode/qrcode panels. Standalone codes use `hideTitle` (inverse semantics). Confusing because the user might look for "显示码值" in a standalone element panel and not find it.

### J.29 `barColor` value validation absent

[V1 line 4779]: getValue returns the raw input string. No hex/rgb validation. If user types `red123` it gets passed to bwip-js's `barcolor` which expects 6-hex. bwip-js silently fails or renders black. No error feedback.

### J.30 Cloning a barcode does not deep-copy `options.barcodeType`

`clone()` at [V1 line 1525–1533] does `Object.keys(n.options).forEach(key => newObj.options[key] = n.options[key])`. For primitives (strings, numbers, bools) this is fine. But if a future V1 patch adds an array-typed barcode option (e.g. `gs1ai: [01, 17, ...]`), the array reference would be shared between clone and original — a known V1 cloning bug shape (not yet manifest for current barcode options).

---

## Summary

| Path | Default factory? | Underlying lib | Element class | Options panel | Output root class |
|---|---|---|---|---|---|
| A barcode | YES (defaultModule.barcode, trackingNo) | JsBarcode | text (`D`) | text panel | `.hiprint-printElement-text` |
| A qrcode | YES (defaultModule.qrcode) | qrcode.js (`./plugins/qrcode.js`) | text (`D`) | text panel | `.hiprint-printElement-text` |
| B barcode | NO (library users must register) | bwip-js | `barcode` (separate class) | barcode-specific panel | `.hiprint-printElement-barcode` |
| B qrcode | NO | bwip-js | `qrcode` (separate class) | qrcode-specific panel | `.hiprint-printElement-qrcode` |
| Table-cell barcode | column-level | JsBarcode | (table column renderer) | table-column panel | inside `<td>` |
| Table-cell qrcode | column-level | qrcode.js | (table column renderer) | table-column panel | inside `<td>` |

**Total option/config rows enumerated**: ~40 unique option fields × 4 paths + 84 barcodeType enum values + 19 qrcodeType enum values + 18 barcodeMode enum values = comprehensive.

V3 parity work must cover every entry above. Each Section J quirk is a candidate either-fix-or-document decision for V3.
