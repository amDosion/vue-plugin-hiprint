# V1 Inventory — `text` and `longText` etypes

> **Scope**: Exhaustive user-visible behavior spec for the two V1 print-element types `text` (factory `defaultModule.text`, `defaultModule.customText`, `defaultModule.titleRow`, `defaultModule.url`, `defaultModule.price`, `defaultModule.sku`, `defaultModule.orderNo`, `defaultModule.orderDate`, `defaultModule.trackingNo`, `defaultModule.totalAmount`, `defaultModule.barcode`, `defaultModule.qrcode`, `defaultModule.currentDate`, `defaultModule.signature`) and `longText` (factory `defaultModule.longText`, `defaultModule.senderInfo`, `defaultModule.receiverInfo`).
>
> **V1 sources cited**:
> - `src/hiprint/hiprint.bundle.js` (15353 lines, post-fork)
> - `src/hiprint/hiprint.config.js` (2254 lines, default config loaded into `HIPRINT_CONFIG` then `$.extend`-merged into `HiPrintConfig` instance — see bundle line 415)
> - `src/hiprint/etypes/default-etyps-provider.js` (447 lines, factory definitions)
>
> **Citation format**: `[V1 line N]` references hiprint.bundle.js unless prefixed `[config:N]` (= hiprint.config.js) or `[provider:N]` (= default-etyps-provider.js).
>
> **Doctrine**: "每个字段、每个交互逐个列出, 不允许总结跳过" — completeness mandates separate rows for every option key even when patterns repeat.

---

## PART 1 — `text` element type

The `text` etype is the workhorse of hiprint. It renders a single-line, fixed-height label that combines an optional title prefix with one piece of data (either a literal `testData` string, a `data[field]` value via dot-path lookup, or the element type's fallback data). The same class also covers `barcode` and `qrcode` rendering via the `textType` switch (see Section E.2).

### A. Class hierarchy

#### A.1 V1 class identity

- **Runtime element class**: `D` (minified) — `class TextPrintElement extends BasePrintElement` semantically. Defined at `[V1 line 10011]` as `D = function (t) { ... }(f.a)` where `f.a` is `BasePrintElement` from webpack module 4 `[V1 line 676]`.
- **Inheritance chain**: `D` (TextPrintElement) → `BasePrintElement` (f.a) → no further extension; BasePrintElement constructor stores `printElementType` and assigns `this.id` via `HiPrintlib.instance.guid()` `[V1 line 678]`.
- **Options class**: `O` (minified) — `class TextPrintElementOption extends g.a` semantically. Defined at `[V1 line 9965]`. Extends `g.a` (= `PrintElementOption`, the base options class `o` defined at `[V1 line 561]`).
- **Element-type factory class**: dispatched by `nt.createPrintElementType` `[V1 line 10656-10658]` — when input `t.type == "text"`, it returns `new et(t)` where `et` is at `[V1 line 10637]` and extends `j` (base PrintElementType, line ~10522 vicinity). `et` provides the `createPrintElement(t)` method which delegates to `W.createPrintElement(this, e)` at `[V1 line 10522-10524]`, that switch returns `new D(t, e)` for `type == "text"`.
- **Factory instances**: see Section C.

#### A.2 Constructor

V1 source `[V1 line 10012-10015]`:

```js
function e(e, n) {
  var i = t.call(this, e) || this;
  return i.options = new O(n),
         i.options.setDefault(new O(p.a.instance.text.default).getPrintElementOptionEntity()),
         i;
}
```

- Param `e` = `printElementType` object (the descriptor from element-type registration, e.g. `{tid: "defaultModule.text", title: "文本", type: "text", icon: "ep:document"}`).
- Param `n` = `options` object (merged at `[V1 line 10535-10537]`: `$.extend(e, this.getOptions() || {}, t || {})` — combines the type's preset options with per-instance options).
- `t.call(this, e)` invokes `BasePrintElement` constructor `[V1 line 677]`, which sets `this.printElementType = t` and `this.id = guid()`.
- `new O(n)` constructs `TextPrintElementOption`. `O` constructor `[V1 line 9966-9969]` calls super `g.a(e)` then sanitizes `n.title` via `x.replaceEnterAndNewlineAndTab(n.title, "")` `[V1 line 9968]` — strips `\r`, `\n`, `\t` from the title to keep it single-line.
- `setDefault(defaults)` `[V1 line 566-570]` merges in any unset fields from `p.a.instance.text.default` (= `{width: 120, height: 9.75}` `[config:472-476]`).
- The options instance stores defaults at `this.defaultOptions` and fills in `this[key]` from defaults if not already present `[V1 line 566-570]`.

### B. Options table — `text` etype (every field)

> Every option key the `text` element ever reads via `this.options.xxx` is listed below. Source: `text.tabs[].options[].name` and `text.supportOptions[].name` in `[config:95-477]`, plus runtime reads of `this.options.*` in class `D` `[V1 line 10011-10133]`, `O` `[V1 line 9965-9989]`, and `BasePrintElement` getters.

| # | Option key | Type | Default | Range / valid values | UI control | What it renders / affects | V1 line(s) read | V1 line(s) default |
|---|------------|------|---------|---------------------|------------|--------------------------|-----------------|--------------------|
| B.1 | `title` | string | element-type's `title` (e.g. `"文本"`) | any string (sanitized — `\r\n\t` stripped at construction `[V1 line 9968]`) | `<textarea>` 50px high `[V1 line 3576]` | Rendered as prefix `title + "："` before data IF `field` is set AND `getHideTitle()` falsy `[V1 line 10050]`. Single-line only; multi-line input is sanitized by `replaceEnterAndNewlineAndTab` `[V1 line 10032-10033]`. Editable inline (double-click on element `[V1 line 757-773]`). | 10032, 10050, 795, 800, 804, 806 | provider:25-29 `text` factory has no preset `options.title`, so options.title=undefined initially; getTitle returns `this.options.title \|\| this.printElementType.title \|\| ""` `[V1 line 10032]`. |
| B.2 | `field` | string | undefined (or factory preset, e.g. `"orderNo"` `[provider:239]`) | dot-path string (e.g. `"user.name"`); empty / undefined → no field binding | `<select>` if `getFields()` returns array (table column-field), else `<input type="text" placeholder="请输入字段名">` `[V1 line 3547-3559]` | When set + data passed to print: looked up via `field.split('.').reduce((a,c) => a != null ? a[c] : undefined, t) ?? ""` `[V1 line 10037]` — nested path safe, 0/false/"" preserved. Without field, falls back to `options.testData` then `printElementType.getData()` `[V1 line 10037]`. Title prefix `"title："` only rendered when field set `[V1 line 10050]`. | 709-710, 10036-10037 | undefined |
| B.3 | `testData` | string | undefined (or factory preset, e.g. `"DD20260509001"` `[provider:246]`) | any string | `<input type="text" placeholder="仅字段名称存在时有效">` `[V1 line 3592]` | Design-time preview value when no `data` object passed to `print()`. At print-time without `data`, value is `options.testData \|\| printElementType.getData() \|\| ""` `[V1 line 10037]`. Edited inline by typing after the `"："` separator `[V1 line 795-805]`. | 10037, 798, 801 | undefined |
| B.4 | `left` | number (pt) | provided by user drag-drop placement | ≥ 0 (clamped by `updateSizeAndPositionOptions` against panel width `[V1 line 715-731]`) | `<input type="number">` X position (left field of `coordinate` widget) `[V1 line 3613]` | Sets element's `position: absolute; left: <left>pt;` in design + print DOM `[V1 line 9831, 870, 1138]`. Read via `options.getLeft()` `[V1 line 587-588]` and `options.displayLeft(applyTransform)` `[V1 line 595-599]`. With `transform` set, displayLeft adds `getRectInfo().diffW`. | 9831, 870, 870, 1138, 587, 595, 9836 | initial value from drag-drop position (`s.a.instance.dragLengthCNum` `[V1 line 11415]`) |
| B.5 | `top` | number (pt) | provided by user drag-drop placement | ≥ 0 (clamped against panel height) | `<input type="number">` Y position `[V1 line 3614]` | Sets element's `top: <top>pt;` `[V1 line 9831, 1138]`. `options.getTop()` `[V1 line 602-603]`, `displayTop(applyTransform)` `[V1 line 610-614]`. `topInDesign` mirrors top initially `[V1 line 563]`. | 9831, 1138, 870, 602, 610 | initial drag-drop position |
| B.6 | `width` | number (pt) | factory preset or `120` (config default) | > 0 | `<input type="number">` 宽 field of `widthHeight` widget `[V1 line 3692]` | Sets `width: <width>pt;` `[V1 line 739, 741]`. Read by `getWidth()` `[V1 line 629-633]` and `displayWidth()` `[V1 line 635-636]`. With `transform`, getWidth returns rotated bounding-box width. | 739, 741, 629, 635, 10084 | config:473 (`width: 120`) |
| B.7 | `height` | number (pt) | factory preset or `9.75` (config default) | > 0 | `<input type="number">` 高 field `[V1 line 3693]` | Sets `height: <height>pt;` `[V1 line 739]`. Read by `getHeight()` `[V1 line 619-624]`, `displayHeight()` `[V1 line 625-626]`. | 739, 619, 625, 10077, 10103 | config:474 (`height: 9.75`) |
| B.8 | `positionLocked` | boolean | undefined (=false) | true / false | checkbox in `coordinate` widget label `[V1 line 3611, 3620-3624]` | When true: `draggable = false` `[V1 line 996-1001]`; resize-panel gets `.locked` class + 🔒 badge `[V1 line 1008-1014]`; resize-btn hidden `[V1 line 1016-1020]`; delete-btn hidden `[V1 line 1021-1027]`; `coordinate` inputs disabled `[V1 line 3613-3614]`. Also synced from right-click "锁定元素" menu `[V1 line 11525-11540]` (sets sizeLocked=true too). | 996-1027, 11525-11540, 3611, 3620 | undefined |
| B.9 | `sizeLocked` | boolean | undefined | true / false | checkbox in `widthHeight` widget `[V1 line 3690]` | When true: width/height inputs disabled; resize-btn hidden `[V1 line 1016, 1031]`; design target gets `.size-locked` class `[V1 line 1032]`. Auto-set true when `positionLocked` toggled via lock menu `[V1 line 11533]`. | 1016-1042, 3690 | undefined |
| B.10 | `draggable` | boolean | undefined (=true) | true / false | not directly in panel; controlled via `positionLocked` `[V1 line 996-1001]` | `false` disables hidraggable on element `[V1 line 1004]`. Delete button still rendered (only positionLocked hides it). Affects `getReizeableShowPoints` indirectly. | 1004, 814, 1098, 1566, 12200 | undefined |
| B.11 | `coordinateSync` | boolean | false | true / false | 🔗/🔓 button in `coordinate` widget `[V1 line 3628-3637]` | UI-only — when true, editing X auto-mirrors to Y and vice versa `[V1 line 3639-3648]`. Persisted in options so reload restores sync state. | 3617, 3661 | undefined |
| B.12 | `widthHeightSync` | boolean | false | true / false | 🔗/🔓 button in `widthHeight` widget `[V1 line 3697]` (analogous to coordinateSync) | UI-only — editing width auto-mirrors to height and vice versa. | 3696 | undefined |
| B.13 | `hideTitle` | boolean | false (per config-default mechanism) | "true" / "false" / "" (UI select) → boolean | `<select>` 标题显示隐藏: 默认/显示/隐藏 `[V1 line 2600]` | When true: title prefix NOT rendered `[V1 line 10050]` (`getHideTitle()` `[V1 line 9971-9972]` reads `null == this.hideTitle ? this.defaultOptions.hideTitle : this.hideTitle`). Also affects barcode/qrcode display value: `displayValue: !this.options.hideTitle` `[V1 line 10078]`; `!this.options.hideTitle && a.append(...)` `[V1 line 10117]`. | 10050, 10078, 10080, 10103, 10117, 9971 | undefined; `getHideTitle()` falls back to defaultOptions.hideTitle (undefined → falsy) |
| B.14 | `fixed` | boolean | undefined | "true" / "false" / "" (UI) → boolean | `<select>` 位置固定: 默认/否/是 `[V1 line 4333]` | When true: element treated as fixed in pagination `[V1 line 1376, 9831]` (`isFixed()` returns truthy → bypass header/footer/auto-pagination, always at literal top). | 1376, 9831 | undefined |
| B.15 | `dataType` | string | undefined | `""` (默认) / `"datetime"` / `"boolean"` `[V1 line 5610]` | `<select>` 数据类型 + sub-select/input for format `[V1 line 5610]` | When `"datetime"` + `format` set: data goes through `o.a.dateFormat(e, format)` `[V1 line 10038]`. When `"boolean"`: format is `"trueText:falseText"`, displayed accordingly `[V1 line 10040-10043]`. Default ("") passes data through unchanged. | 10038, 10040 | undefined |
| B.16 | `format` | string | undefined | datetime pattern (e.g. `"yyyy-MM-dd"`) or `"trueText:falseText"` for boolean | `<select>` (datetime format list `[V1 line 5634]`) or `<input>` for boolean format | Combined with `dataType` to drive value formatting. Datetime list includes 40+ patterns `[V1 line 5634]`. | 10038, 10041 | undefined |
| B.17 | `fontFamily` | string | undefined → CSS `inherit` `[V1 line 2489]` | `""` / `"SimSun"` / `"Microsoft YaHei"` / or values from `printTemplate.getFontList()` `[V1 line 2477]` | `<select>` 字体 `[V1 line 2478-2484]` | Sets `font-family: <val>` on element `[V1 line 2488]`. Empty falls back to `inherit` (so template-level font is inherited) `[V1 line 2489]`. | 2486-2492 | undefined |
| B.18 | `fontSize` | number (pt) | 9 (`getFontSize()` fallback `[V1 line 9975-9976]`) | `""` / `6` / `6.75` / `7.5` / `8.25` / `9` / `9.75` / `10.5` / `11.25` / `12` / `12.75` / `13.5` / `14.25` / `15` / `15.75` / `16.5` / `17.25` / `18` / `18.75` / `19.5` / `20.25` / `21` / `21.75` `[V1 line 2515]` | `<select>` 字体大小 `[V1 line 2515]` | Sets `font-size: <val>pt;` `[V1 line 2509]`. Used in barcode height calc (`this.options.fontSize` for barcode text margin) `[V1 line 10103, 10498]`. Right-click "字体 12pt" menu sets to `12` `[V1 line 11469-11475]`. | 2509, 10103, 10498, 11472, 9975 | undefined; falls back via `getFontSize()` to `9` |
| B.19 | `fontWeight` | string | undefined | `""` / `"lighter"` / `"bold"` / `"bolder"` / `"100"` / `"200"` / `"300"` / `"400"` / `"500"` / `"600"` / `"700"` / `"800"` / `"900"` `[V1 line 2539]` | `<select>` 字体粗细 `[V1 line 2539]` | Sets `font-weight: <val>` `[V1 line 2533]`. Right-click "字体加粗" sets `"bolder"` `[V1 line 11477-11483]`. | 2533, 11480 | undefined |
| B.20 | `letterSpacing` | number (pt) | undefined | `""` / `0.75` / `1.5` / `2.25` / `3` / `3.75` / `4.5` / `5.25` / `6` / `6.75` / `7.5` / `8.25` / `9` / `9.75` / `10.5` / `11.25` / `12` `[V1 line 2561]` | `<select>` 字间距 `[V1 line 2561]` | Sets `letter-spacing: <val>pt;` `[V1 line 2556]`. | 2556 | undefined |
| B.21 | `color` | string | undefined → CSS default (black) | hex / rgb / rgba string from minicolors picker `[V1 line 3510]` | `<input type="text">` with minicolors widget `[V1 line 3505, 3510]` | Sets `color: <val>` `[V1 line 3499]`. In barcode rendering used as `lineColor` `[V1 line 10075]`. In qrcode used as `colorDark` `[V1 line 10112]`. | 3499, 10075, 10112 | undefined |
| B.22 | `backgroundColor` | string | undefined | hex / rgb / rgba | `<input type="text">` minicolors `[V1 line 4753, 4758]` | Sets `background-color: <val>` `[V1 line 4747]`. Factory preset on `titleRow`: `"#F2F6FC"` `[provider:166]`. | 4747 | undefined |
| B.23 | `textDecoration` | string | undefined | `""` / `"underline"` / `"overline"` / `"line-through"` `[V1 line 3524]` | `<select>` 文本修饰 `[V1 line 3524]` | Sets `text-decoration: <val>` `[V1 line 3527]`. Factory preset on `url`: `"underline"` `[provider:181]`. | 3527 | undefined |
| B.24 | `textAlign` | string | undefined | `""` / `"left"` / `"center"` / `"right"` / `"justify"` `[V1 line 2584]` | `<select>` 左右对齐 `[V1 line 2584]` | Sets `text-align: <val>`; when `justify`, also `text-align-last: justify; text-justify: distribute-all-lines` `[V1 line 2578]`. Factory presets: `titleRow="center"` `[provider:165]`, `price="right"`, `totalAmount="right"`. | 2578 | undefined |
| B.25 | `textContentVerticalAlign` | string | undefined | `""` / `"middle"` / `"bottom"` `[V1 line 4814]` | `<select>` 上下对齐 `[V1 line 4814]` | Toggles CSS classes `.hiprint-text-content-middle` / `.hiprint-text-content-bottom` on element wrapper `[V1 line 4817-4818]`. Factory presets: `titleRow="middle"` `[provider:167]`, `signature="bottom"` `[provider:410]`. | 4817-4818 | undefined |
| B.26 | `textContentWrap` | string | undefined | `""` / `"nowrap"` / `"clip"` / `"ellipsis"` `[V1 line 4837]` | `<select>` 文本换行 `[V1 line 4837]` | Adds `.hiprint-text-content-wrap` to outer + `.hiprint-text-content-wrap-{val}` to inner content `[V1 line 4844]`. | 4840-4844 | undefined |
| B.27 | `lineHeight` | number (pt) | undefined | `""` / `6` / `6.75` / `7.5` / `8.25` / `9` / `9.75` / `10.5` / `11.25` / `12` / ... up to `36` (38 values) `[V1 line 2460]` | `<select>` 字体行高 `[V1 line 2460]` | Sets `line-height: <val>pt;` `[V1 line 2454]`. Used in qrcode + barcode height calculation as fallback height adjustment `[V1 line 10103, 10410, 10477]`. | 2454, 10103, 10410, 10477 | undefined |
| B.28 | `transform` | number (deg) | undefined | any number; UI accepts integer / float | `<input type="number">` 旋转角度 `[V1 line 4446]` | Sets `transform: rotate(<val>deg)` plus vendor-prefixed equivalents on the `.hiprint-printElement` wrapper `[V1 line 4440]`. Affects `getRectInfo()` computation of rotated bounding box `[V1 line 575-586]`. | 4440, 575, 591, 606 | undefined |
| B.29 | `zIndex` | number | 0 (CSS default) | any integer | `<input type="number">` 元素层级 `[V1 line 4467]` | Sets `z-index: <val>` `[V1 line 4463]`. Right-click 置于顶层/底层/上移/下移 manipulate this `[V1 line 11488-11521]`. | 4463, 11492, 11502, 11512, 11519 | undefined |
| B.30 | `borderTop` | string | undefined | `""` / `"solid"` / `"dotted"` `[V1 line 4527]` | `<select>` 上边框 `[V1 line 4527]` | Sets `border-top-style: <val>` on `.hiprint-printElement-content` (or wrapper if content not found) `[V1 line 4521]`. | 4521 | undefined |
| B.31 | `borderLeft` | string | undefined | `""` / `"solid"` / `"dotted"` `[V1 line 4552]` | `<select>` 左边框 `[V1 line 4552]` | Sets `border-left-style: <val>` `[V1 line 4546]`. | 4546 | undefined |
| B.32 | `borderRight` | string | undefined | `""` / `"solid"` / `"dotted"` `[V1 line 4577]` | `<select>` 右边框 `[V1 line 4577]` | Sets `border-right-style: <val>` `[V1 line 4571]`. | 4571 | undefined |
| B.33 | `borderBottom` | string | undefined | `""` / `"solid"` / `"dotted"` `[V1 line ~4602]` | `<select>` 下边框 | Sets `border-bottom-style: <val>` `[V1 line 4596]`. Factory preset: `signature="solid"` `[provider:407]`. | 4596 | undefined |
| B.34 | `borderWidth` | number (pt) | undefined | `""` / `0.75` / `1.5` / `2.25` / `3` / `3.75` / `4.5` / `5.25` / `6` / `6.75` `[V1 line 2886]` | `<select>` 边框大小 (or 线宽 for line types) `[V1 line 2886]` | Sets `border-width: <val>pt` on content `[V1 line 2891]`. Factory preset: `signature=0.75` `[provider:408]`. | 2891 | undefined |
| B.35 | `borderColor` | string | undefined | hex / rgb | `<input type="text">` minicolors (similar to color) `[V1 line ~3905]` | Sets `border-color` (via CSS). Factory preset: `signature="#000000"` `[provider:409]`. | TBD line in 3850-3915 range | undefined |
| B.36 | `borderStyle` | string | undefined | `""` / `"solid"` / `"dashed"` / `"dotted"` `[V1 line 4730]` | `<select>` 边框样式 `[V1 line 4730]` (labeled "样式" for hline/vline/rect/oval) | Sets `border-style: <val>` on wrapper `[V1 line 4723]`. **Note**: `text` does NOT include `borderStyle` in `text.supportOptions` or `text.tabs.边框` — borderStyle is listed for `image`/lines. However Object key still readable from JSON. | 4723 | undefined; for `text` etype this UI never appears |
| B.37 | `borderRadius` | string | undefined | any CSS border-radius value (e.g. `"4pt"`, `"50%"`) | `<input type="text">` 边框圆角 `[V1 line 4489]` | Sets `border-radius: <val>` `[V1 line 4484]`. Not in text.supportOptions either — UI doesn't appear for text. | 4484 | undefined |
| B.38 | `contentPaddingLeft` | number (pt) | undefined | `""` / 30 graduated steps `0.75 .. 21.75` `[V1 line 4627]` | `<select>` 左内边距 `[V1 line 4627]` | Sets `padding-left: <val>pt` on `.hiprint-printElement-content` `[V1 line 4621]`. Factory preset: `signature=4` `[provider:406]`. | 4621 | undefined |
| B.39 | `contentPaddingTop` | number (pt) | undefined | same steps as left `[V1 line 4653]` | `<select>` 上内边距 `[V1 line 4653]` | `padding-top: <val>pt;` on `.hiprint-printElement-content` `[V1 line 4647]`. | 4647 | undefined |
| B.40 | `contentPaddingRight` | number (pt) | undefined | same steps `[V1 line 4679]` | `<select>` 右内边距 `[V1 line 4679]` | `padding-right: <val>pt;` `[V1 line 4673]`. | 4673 | undefined |
| B.41 | `contentPaddingBottom` | number (pt) | undefined | same steps `[V1 line 4705]` | `<select>` 下内边距 `[V1 line 4705]` | `padding-bottom: <val>pt;` `[V1 line 4699]`. | 4699 | undefined |
| B.42 | `optionsGroup` | (placeholder) | n/a | n/a | header label "边框设置" `[V1 line 4505]` | UI grouping only; `getValue()` returns undefined and `css()` is a no-op (item has no `css` method). | n/a | n/a |
| B.43 | `textType` | string | `"text"` (`getTextType()` fallback `[V1 line 9973-9974]`) | `""` / `"barcode"` / `"qrcode"` `[V1 line 5005]` | `<select>` 打印类型 `[V1 line 5005]` | Switches render path in `updateTargetText` `[V1 line 10051-10122]`: `"text"` → plain text, `"barcode"` → JsBarcode SVG, `"qrcode"` → QRCode SVG. Determines resize handles via `getReizeableShowPoints()` `[V1 line 1093]` (`"barcode"`/`"qrcode"` add `"se"` for free resize). Also disables inline-edit when not `"text"` `[V1 line 761]` (`!(e.options.textType && "text" != e.options.textType)`). Factory presets: `trackingNo="barcode"` `[provider:275]`, `barcode="barcode"` `[provider:338]`, `qrcode="qrcode"` `[provider:354]`. | 10051, 1093, 761, 9974 | undefined; `getTextType()` returns `"text"` |
| B.44 | `barcodeMode` | string | `"CODE128"` (`getbarcodeMode()` fallback `[V1 line 9977-9978]`) | `""` / `"CODE128A"` / `"CODE128B"` / `"CODE128C"` / `"CODE39"` / `"EAN13"` / `"EAN8"` / `"EAN5"` / `"EAN2"` / `"UPC"` / `"ITF"` / `"ITF14"` / `"MSI"` / `"MSI10"` / `"MSI11"` / `"MSI1010"` / `"MSI1110"` / `"Pharmacode"` `[V1 line 2912]` | `<select>` 条形码格式 `[V1 line 2912]` | Passed as `format` to JsBarcode `[V1 line 10072]`. Only used when `textType == "barcode"`. | 10072, 9977 | undefined; fallback `"CODE128"` |
| B.45 | `barTextMode` | string | `"text"` (`getBarTextMode()` fallback `[V1 line 9979-9980]`) | `""` / `"text"` / `"svg"` `[V1 line 2927]` | `<select>` 条码文本模式 `[V1 line 2927]` | When `"text"`: adds separate `<div class="hibarcode_displayValue">` with `white-space:nowrap` `[V1 line 10068]`; barcode SVG renders WITHOUT JsBarcode `displayValue` (set false) `[V1 line 10078]`. When `"svg"`: JsBarcode renders text inside SVG. | 10064, 10068, 10078, 9979 | undefined; fallback `"text"` |
| B.46 | `barWidth` | number | `1` (`getBarWidth()` fallback `[V1 line 9981-9982]`) | `""` / `1` / `2` / `3` / `4` `[V1 line 2943]` | `<select>` 条码宽度 `[V1 line 2943]` | Passed to JsBarcode `width` option `[V1 line 10073]`. | 10073, 9981 | undefined; fallback `1` |
| B.47 | `barAutoWidth` | string ("true"/"false") | falls back to `true` semantically (`getBarAutoWidth()` `[V1 line 9983-9985]`) | `""` / `"true"` / `"false"` `[V1 line 2959]` (string-typed by design — comment line 9984 says "true 为 true，其余一概为 false") | `<select>` 条码自动增宽 `[V1 line 2959]` | When truthy: if JsBarcode-generated SVG width > options.width, the parent's width is expanded to fit `[V1 line 10084-10087]`. | 10084, 9983 | config:475-476 comment "barAutoWidth: 'true' 这里必须使用字符串" but text.default omits it; getBarAutoWidth ?? true `[V1 line 9985]` |
| B.48 | `barcodeType` | string | undefined | from a hierarchical group of option labels including `"ean13"`, etc. `[V1 line 2980-2985]` (used by hi-cascader UI, `qrcodeType` is the qrcode counterpart) | hi-cascader (custom widget) `[V1 line 2975+]` | Alternative high-level barcode classifier used by `printElementType` `[V1 line 2972]` — surfaced when user picks a sub-format from the hierarchy. Distinct from `barcodeMode`. | TBD usage in barcode render | undefined |
| B.49 | `qrCodeLevel` | number | `0` (`getQRcodeLevel()` fallback `[V1 line 9986-9987]`) | `""` / `1` (7% L) / `0` (15% M) / `3` (25% Q) / `2` (30% H) `[V1 line 3482]` | `<select>` 二维码容错率 `[V1 line 3482]` | Passed to `QRCode` as `correctLevel` `[V1 line 10114]`. Only used when `textType == "qrcode"`. | 10114, 9986 | undefined; fallback `0` |
| B.50 | `qrcodeType` | string | undefined | (similar to barcodeType) `[V1 line 3382]` | hi-cascader widget | High-level qrcode classifier. | (parallel to barcodeType) | undefined |
| B.51 | `upperCase` | string | undefined | `""` / `"0"` / `"1"` / `"2"` / `"3"` / `"4"` / `"5"` / `"6"` / `"7"` `[V1 line 5223-5230]` (Chinese number conversions) | `<select>` 转大小写 `[V1 line 5237]` | Value passed to `hinnn.toUpperCase(upperCase, str)` `[V1 line 10050]` — converts numeric data to various Chinese readings (`"小写"十点八`, `"大写"拾点捌`, `"金额"人民币壹拾元`, etc. via `Nzh` library). | 10050 | undefined |
| B.52 | `formatter` | string (function source) | undefined; defaults to element-type's own `formatter` `[V1 line 1536]` | a function string `function(title, value, options, templateData, target) { return ...; }` | `<textarea>` 格式化函数 `[V1 line 5643]` | Compiled via `new Function('return ' + this.options.formatter)()` at runtime `[V1 line 1537]`. Falls back silently on syntax error → `console.warn` `[V1 line 1541]`. Called by `updateTargetText` `[V1 line 10050]` as `r(title, value, options, templateData, target)`. Factory preset: `currentDate` etype has a formatter `[provider:375-386]`. | 1534-1543, 10047-10050 | undefined |
| B.53 | `styler` | string (function source) | undefined; defaults to element-type's own `styler` `[V1 line 1546]` | function string `function(value, options, target, templateData) { return {cssKey: cssVal} }` | `<textarea>` 样式函数 `[V1 line 5660]` | Compiled and returned object's keys are applied as CSS `[V1 line 1267-1270]`. Called in `stylerCss(t, e)` `[V1 line 1263-1271]`. | 1263-1271, 1544-1551 | undefined |
| B.54 | `pageBreak` | boolean | undefined | `""` / `"true"` (boolean coerced) `[V1 line 4207]` | `<select>` 强制分页 (only "默认" + "是") `[V1 line 4207]` | When truthy: forces a new page before this element at print time. `css` implementation `[V1 line 4200-4205]` adds `alwaysHide` class — but this is a buggy artifact; primary effect is in pagination logic (`getPaperHtmlResult`). `getValue` returns `true` only if select value `"true"`. | 4200-4209 | undefined |
| B.55 | `showInPage` | string | undefined | `""` / `"none"` (始终隐藏) / `"first"` / `"odd"` / `"even"` / `"last"` `[V1 line 4185]` | `<select>` 显示规则 `[V1 line 4185]` | `"none"` → adds `alwaysHide` CSS class (display:none) `[V1 line 4180]`. Other values consulted by `showInPage(t, e)` check on BasePrintElement `[V1 line 692-704]` to decide if element is rendered on a given page index. | 4180, 692-704 | undefined |
| B.56 | `unShowInPage` | string | undefined | `""` / `"first"` / `"last"` `[V1 line 4396]` | `<select>` 隐藏规则 `[V1 line 4396]` | Inverse of showInPage — `"first"` hides on first page only, `"last"` on last page only. Logic in `showInPage` `[V1 line 692-704]`. | 692-704 | undefined |
| B.57 | `axis` | string | undefined | `""` / `"h"` (横向) / `"v"` (竖向) `[V1 line 4348]` | `<select>` 拖动方向 `[V1 line 4348]` | Passed to `hidraggable` as `{axis: <val>}` constraining drag direction `[V1 line 956, 987]`. | 956, 987 | undefined |

**`text` etype option count: 57 fields cataloged.**

> Notes on options NOT in supportOptions but still readable: `borderRadius`, `borderStyle`, `optionsGroup` appear in some etypes' `tabs` but not in `text.tabs.边框` (`[config:190-235]`) — code reads `this.options.borderRadius` regardless if a property panel widget is registered. `borderRadius` UI never renders for `text` but the raw option key can still be set via JSON template.

### C. Default options — factory presets for `text` etype

Multiple element-type factories produce `text` instances. Each factory's `options` block forms the initial `n` parameter `[V1 line 10012, 10535]`. Listed below from `default-etyps-provider.js`.

#### C.1 `defaultModule.text` (常规 / 文本) `[provider:24-30]`

| Field | Value |
|-------|-------|
| `tid` | `"defaultModule.text"` |
| `title` | `"文本"` |
| `data` | `""` |
| `type` | `"text"` |
| `icon` | `"ep:document"` |
| `options` | (none — uses `text.default` from config `[config:472-476]`: `width=120`, `height=9.75`) |

#### C.2 `defaultModule.customText` (常规 / 自定义文本) `[provider:147-154]`

| Field | Value |
|-------|-------|
| `tid` | `"defaultModule.customText"` |
| `title` | `"自定义文本"` |
| `customText` | `"自定义文本"` |
| `custom` | `true` |
| `type` | `"text"` |
| `icon` | `"ep:edit-pen"` |
| (no preset `options`) | falls back to `text.default` |

#### C.3 `defaultModule.titleRow` (常规 / 标题行) `[provider:155-169]`

| Field | Value |
|-------|-------|
| `tid` | `"defaultModule.titleRow"` |
| `title` | `"标题行"` |
| `type` | `"text"` |
| `icon` | `"ep:minus"` |
| `options.width` | `540` |
| `options.height` | `18` |
| `options.fontSize` | `14.25` |
| `options.fontWeight` | `"bold"` |
| `options.textAlign` | `"center"` |
| `options.backgroundColor` | `"#F2F6FC"` |
| `options.textContentVerticalAlign` | `"middle"` |

#### C.4 `defaultModule.url` (电商 / 链接) `[provider:172-183]`

| Field | Value |
|-------|-------|
| `tid` | `"defaultModule.url"` |
| `title` | `"链接"` |
| `type` | `"text"` |
| `icon` | `"ep:link"` |
| `options.width` | `180` |
| `options.height` | `9.75` |
| `options.color` | `"#409eff"` |
| `options.textDecoration` | `"underline"` |

#### C.5 `defaultModule.price` (电商 / 价格) `[provider:184-197]`

| Field | Value |
|-------|-------|
| `tid` | `"defaultModule.price"` |
| `title` | `"价格"` |
| `type` | `"text"` |
| `icon` | `"ep:money"` |
| `options.width` | `80` |
| `options.height` | `12` |
| `options.fontSize` | `12` |
| `options.fontWeight` | `"bold"` |
| `options.color` | `"#f56c6c"` |
| `options.textAlign` | `"right"` |

#### C.6 `defaultModule.sku` (电商 / SKU) `[provider:198-209]`

| Field | Value |
|-------|-------|
| `tid` | `"defaultModule.sku"` |
| `title` | `"SKU"` |
| `type` | `"text"` |
| `icon` | `"ep:price-tag"` |
| `options.width` | `120` |
| `options.height` | `9.75` |
| `options.fontSize` | `9` |
| `options.color` | `"#909399"` |

#### C.7 `defaultModule.orderNo` (电商 / 订单号) `[provider:236-248]`

| Field | Value |
|-------|-------|
| `tid` | `"defaultModule.orderNo"` |
| `title` | `"订单号"` |
| `field` | `"orderNo"` |
| `type` | `"text"` |
| `icon` | `"ep:tickets"` |
| `options.width` | `200` |
| `options.height` | `12` |
| `options.fontSize` | `10` |
| `options.testData` | `"DD20260509001"` |

#### C.8 `defaultModule.orderDate` (电商 / 下单日期) `[provider:249-263]`

| Field | Value |
|-------|-------|
| `tid` | `"defaultModule.orderDate"` |
| `title` | `"下单日期"` |
| `field` | `"orderDate"` |
| `type` | `"text"` |
| `icon` | `"ep:calendar"` |
| `options.width` | `160` |
| `options.height` | `12` |
| `options.fontSize` | `10` |
| `options.testData` | `"2026-05-09 14:30"` |

#### C.9 `defaultModule.trackingNo` (电商 / 快递单号) `[provider:264-279]`

| Field | Value |
|-------|-------|
| `tid` | `"defaultModule.trackingNo"` |
| `title` | `"快递单号"` |
| `field` | `"trackingNo"` |
| `type` | `"text"` |
| `icon` | `"ep:list"` |
| `options.width` | `180` |
| `options.height` | `50` |
| `options.textType` | `"barcode"` |
| `options.barcodeType` | `"code128"` |
| `options.testData` | `"SF1234567890"` |

#### C.10 `defaultModule.totalAmount` (电商 / 金额合计) `[provider:280-297]`

| Field | Value |
|-------|-------|
| `tid` | `"defaultModule.totalAmount"` |
| `title` | `"金额合计"` |
| `field` | `"totalAmount"` |
| `type` | `"text"` |
| `icon` | `"ep:money"` |
| `options.width` | `120` |
| `options.height` | `14` |
| `options.fontSize` | `12` |
| `options.fontWeight` | `"bold"` |
| `options.color` | `"#f56c6c"` |
| `options.textAlign` | `"right"` |
| `options.testData` | `"¥ 1234.56"` |

#### C.11 `defaultModule.barcode` (辅助 / 条形码) `[provider:325-342]`

| Field | Value |
|-------|-------|
| `tid` | `"defaultModule.barcode"` |
| `title` | `"条形码"` |
| `field` | `"barcode"` |
| `type` | `"text"` |
| `icon` | `"ep:list"` |
| `options.width` | `140` |
| `options.height` | `35` |
| `options.textType` | `"barcode"` |
| `options.hideTitle` | `true` |
| `options.testData` | `"123456789"` |

#### C.12 `defaultModule.qrcode` (辅助 / 二维码) `[provider:343-358]`

| Field | Value |
|-------|-------|
| `tid` | `"defaultModule.qrcode"` |
| `title` | `"二维码"` |
| `field` | `"qrcode"` |
| `type` | `"text"` |
| `icon` | `"ep:grid"` |
| `options.width` | `50` |
| `options.height` | `50` |
| `options.textType` | `"qrcode"` |
| `options.hideTitle` | `true` |
| `options.testData` | `"https://example.com"` |

#### C.13 `defaultModule.currentDate` (实用 / 当前日期) `[provider:361-387]`

| Field | Value |
|-------|-------|
| `tid` | `"defaultModule.currentDate"` |
| `title` | `"当前日期"` |
| `type` | `"text"` |
| `icon` | `"ep:calendar"` |
| `options.width` | `100` |
| `options.height` | `12` |
| `options.fontSize` | `9` |
| `options.textAlign` | `"left"` |
| `formatter` | `function(title, data, options, templateData) { ... reads templateData.currentDate/printDate/date or new Date(); formats as yyyy-MM-dd ... }` `[provider:375-386]` |

#### C.14 `defaultModule.signature` (实用 / 签名) `[provider:388-412]`

| Field | Value |
|-------|-------|
| `tid` | `"defaultModule.signature"` |
| `title` | `"签名"` |
| `field` | `"signature"` |
| `type` | `"text"` |
| `icon` | `"ep:edit-pen"` |
| `options.width` | `220` |
| `options.height` | `32` |
| `options.fontSize` | `11` |
| `options.textAlign` | `"left"` |
| `options.contentPaddingLeft` | `4` |
| `options.borderBottom` | `"solid"` |
| `options.borderWidth` | `0.75` |
| `options.borderColor` | `"#000000"` |
| `options.textContentVerticalAlign` | `"bottom"` |

### D. Property panel sections rendered for `text` etype

The property panel is built by `ut.buildSetting(t)` `[V1 line 12102-12238]`. It reads `i.getPrintElementOptionTabs()` `[V1 line 1294-1310]`, which returns `text.tabs` `[config:96-292]` filtered by `hidden:false`. Each tab maps to a side-panel section (UI: clickable tab list at top, content below `[V1 line 12111-12114]`). Tabs are skipped if `tab.list.length === 0` and no `customOptionsInput` is provided `[V1 line 12112]`.

| Section title (i18n key) | Fields shown (in order) | When shown | V1 source line |
|--------------------------|-------------------------|------------|----------------|
| **D.1 基础 (Basic)** | `title`, `field`, `testData`, `coordinate`, `widthHeight`, `hideTitle`, `fixed` | always (when text element selected) | `[config:97-128]` |
| **D.2 样式 (Style)** | `dataType`, `fontFamily`, `fontSize`, `fontWeight`, `letterSpacing`, `color`, `backgroundColor`, `textDecoration`, `textAlign`, `textContentVerticalAlign`, `textContentWrap`, `lineHeight`, `transform`, `zIndex` | always | `[config:129-188]` |
| **D.3 边框 (Border)** | `optionsGroup` (header), `borderLeft`, `borderTop`, `borderRight`, `borderBottom`, `borderWidth`, `borderColor`, `contentPaddingLeft`, `contentPaddingTop`, `contentPaddingRight`, `contentPaddingBottom` | always | `[config:189-236]` |
| **D.4 高级 (Advanced)** | `textType`, `barcodeMode`, `barTextMode`, `barWidth`, `barAutoWidth`, `qrCodeLevel`, `pageBreak`, `showInPage`, `unShowInPage`, `axis`, `upperCase`, `formatter`, `styler` | always | `[config:237-292]` |

Below the tab list, `<button>` 确定 (`a` `[V1 line 12196]`) submits via `i.submitOption()` `[V1 line 12223]`. `<button>` 删除 (`p` `[V1 line 12197]`) calls `deletePrintElement` `[V1 line 12225-12227]` — but only appended when `i.options.draggable != false || i.options.positionLocked` `[V1 line 12200]` (i.e. always for unlocked text; positionLocked elements still expose delete `[V1 line 12201-12203]`).

Inline `auto-submit` triggers on `change` event `[V1 line 12229]` and on Enter keydown `[V1 line 12231]`.

### E. Render output DOM — `text` etype

#### E.1 Top-level wrapping DOM

Generated by `createTarget(t, e, n)` `[V1 line 10127-10129]`:

```html
<div tabindex="1" class="hiprint-printElement hiprint-printElement-text"
     style="position: absolute;">
  <div class="hiprint-printElement-text-content hiprint-printElement-content"
       style="height:100%;width:100%"></div>
</div>
```

Inline styles set at design / print time (`[V1 line 1138, 9831, 1660, 870]` and friends):

- `position: absolute` (from template literal)
- `left: <options.left>pt` via `options.displayLeft()` `[V1 line 870, 1138]`
- `top: <options.top>pt` via `options.displayTop()` (or panelHeader-adjusted top for paginated) `[V1 line 870, 1138]`
- `width: <options.width>pt` via `updateTargetSize` `[V1 line 739]`
- `height: <options.height>pt` via `updateTargetSize` `[V1 line 739]`
- `transform: rotate(<n>deg)` (+ vendor prefixes) when `options.transform` set `[V1 line 4440]`
- `z-index: <options.zIndex>` when set `[V1 line 4463]`
- `background-color`, `color`, `font-family`, `font-size`, etc. from option-item `css()` callbacks `[V1 line 1252-1259]`

#### E.2 Content DOM (inner)

Inner `.hiprint-printElement-text-content.hiprint-printElement-content` receives the actual rendered output. The branch depends on `getTextType()`:

**Branch 1: textType == "text"** `[V1 line 10052-10056]`

```html
<div class="hiprint-printElement-text-content hiprint-printElement-content"
     style="height:100%;width:100%; padding-left:<contentPaddingLeft>pt; ... text-align:<textAlign>; font-size:<fontSize>pt; ...">
  {{ titlePrefix + formattedValue }}
</div>
```

Text is set via `.text(p)` `[V1 line 10056]` — `p` is computed as:

- If `field` set: `(hideTitle ? "" : (title ? title + "：" : "")) + toUpperCase(upperCase, formatter ? formatter(title, value, options, templateData, target) : value)` `[V1 line 10050]`
- Else: `toUpperCase(upperCase, formatter ? formatter(title, title, options, templateData, target) : title)` `[V1 line 10050]`

**Branch 2: textType == "barcode"** `[V1 line 10058-10090]`

```html
<div class="hiprint-printElement-text-content hiprint-printElement-content"
     style="display:flex; flex-direction:column">
  <svg width="100%" display="block" height="100%" class="hibarcode_imgcode"
       preserveAspectRatio="none slice"></svg>
  <!-- if barTextMode == 'text': -->
  <div class="hibarcode_displayValue" style="white-space:nowrap">{{ value }}</div>
</div>
```

JsBarcode is invoked with options `[V1 line 10071-10079]`:

- `format: options.getbarcodeMode()` (default `"CODE128"`)
- `width: options.getBarWidth()` (default `1`)
- `textMargin: -1`
- `lineColor: options.color || "#000000"`
- `margin: 0`
- `height: pt.toPx(options.getHeight() || 10)`
- `displayValue: barTextMode == 'text' ? false : !options.hideTitle`

On error (`JsBarcode` throws): inner HTML replaced with i18n `"此格式不支持该文本"` `[V1 line 10089]`.

Auto-expand: if `getBarAutoWidth()` true AND generated SVG `rect.width * 1.05` (in pt) > options.width: parent width is expanded `[V1 line 10082-10087]`.

**Branch 3: textType == "qrcode"** `[V1 line 10093-10121]`

```html
<div class="hiprint-printElement-text-content hiprint-printElement-content"
     style="display:flex; flex-direction:column">
  <div class="hiqrcode_imgcode" style="width:<min>pt; height:<min>pt; margin:auto">
    <!-- QRCode lib injects an <svg> here -->
  </div>
  <!-- if !hideTitle: -->
  <div class="hiqrcode_displayValue" style="white-space:nowrap">{{ value }}</div>
</div>
```

`QRCode` constructor `[V1 line 10109-10115]`:

- `width: "100%"`, `height: "100%"`
- `colorDark: options.color || "#000000"`
- `useSVG: true`
- `correctLevel: options.getQRcodeLevel()` (default `0` = 15% M)

`width/height` constraint: inner box is `Math.min(width, height) + 'pt'`; `height` deducts title row when title shown: `height - (!hideTitle ? (lineHeight ?? fontSize ?? 10.5) * 1.5 : 0)` `[V1 line 10103]`.

On error: inner HTML replaced with i18n `"二维码生成失败"` `[V1 line 10120]`.

#### E.3 CSS classes dynamically added/removed

| Class | When added | When removed | V1 line |
|-------|------------|--------------|---------|
| `selected` | element clicked / multi-selected | another element selected, or canvas clicked | (via design event handler, hireizeable) |
| `editing` | double-click on text element with `textType=="text"` | `updateByContent` called (blur, Enter outside, or selecting another element) | 764-765, 793-794 |
| `alwaysHide` | `showInPage === "none"` OR `pageBreak` truthy `[V1 line 4180, 4202]` | `showInPage` cleared | 4180, 4202 |
| `locked` (on `.resize-panel`) | `positionLocked == true` | unlock | 1008-1014 |
| `position-locked` (on designTarget when no resize-panel) | positionLocked && no resize-panel | unlock | 1037-1040 |
| `size-locked` (on designTarget when no resize-panel) | sizeLocked or positionLocked | unlock | 1031-1035 |
| `hiprint-text-content-middle` | `textContentVerticalAlign == "middle"` | other value | 4817 |
| `hiprint-text-content-bottom` | `textContentVerticalAlign == "bottom"` | other value | 4818 |
| `hiprint-text-content-wrap` (wrapper) | `textContentWrap` set | cleared | 4844 |
| `hiprint-text-content-wrap-nowrap` / `-clip` / `-ellipsis` (on inner) | matching textContentWrap value | other | 4844 |

#### E.4 Inline styles inserted from options

All applied through option-item `css()` callbacks during `BasePrintElement.prototype.css(t, e)` `[V1 line 1237-1262]`. Each option item's `css(target, value)` returns either a CSS string or null. Specific text-relevant items:

| Option | CSS property applied | Target element | V1 line |
|--------|---------------------|----------------|---------|
| `lineHeight` | `line-height: <val>pt` | wrapper `t` | 2454 |
| `fontFamily` | `font-family: <val>` (else `inherit`) | wrapper | 2488-2489 |
| `fontSize` | `font-size: <val>pt` | wrapper | 2509 |
| `fontWeight` | `font-weight: <val>` | wrapper | 2533 |
| `letterSpacing` | `letter-spacing: <val>pt` | wrapper | 2556 |
| `textAlign` | `text-align: <val>` (+ `text-align-last` + `text-justify` for justify) | wrapper | 2578 |
| `color` | `color: <val>` | wrapper | 3499 |
| `textDecoration` | `text-decoration: <val>` | wrapper | 3527 |
| `backgroundColor` | `background-color: <val>` | wrapper | 4747 |
| `transform` | `transform: rotate(<n>deg)` (+ vendor prefixes) | wrapper (or parent `.hiprint-printElement`) | 4440 |
| `zIndex` | `z-index: <val>` | wrapper | 4463 |
| `borderTop` | `border-top-style: <val>` | `.hiprint-printElement-content` (or wrapper) | 4521 |
| `borderLeft` | `border-left-style: <val>` | same | 4546 |
| `borderRight` | `border-right-style: <val>` | same | 4571 |
| `borderBottom` | `border-bottom-style: <val>` | same | 4596 |
| `borderWidth` | `border-width: <val>pt` | `.hiprint-printElement-content` | 2891 |
| `contentPaddingLeft` | `padding-left: <val>pt` | `.hiprint-printElement-content` | 4621 |
| `contentPaddingTop` | `padding-top: <val>pt` | same | 4647 |
| `contentPaddingRight` | `padding-right: <val>pt` | same | 4673 |
| `contentPaddingBottom` | `padding-bottom: <val>pt` | same | 4699 |
| `showInPage` (when `"none"`) | adds class `alwaysHide` (CSS rule sets `display:none`) | wrapper | 4180 |
| `pageBreak` (when `"none"`) | same | wrapper | 4202 |

User-defined `styler` callback returns an object whose keys are applied via `t.css(key, val)` `[V1 line 1268-1270]`.

### F. Interactions specific to `text` etype

#### F.1 Double-click → inline edit (text only)

Source: `BasePrintElement.prototype.getDesignTarget` `[V1 line 757-775]`.

Path:

1. `this.designTarget.dblclick(function (ev) { ... })` binding `[V1 line 757]`
2. Find `.hiprint-printElement-content` and `.resize-panel` `[V1 line 758-760]`
3. Guard: `printElementType.type == "text" && !(options.textType && "text" != options.textType)` `[V1 line 761]` — barcode/qrcode flavours of text reject inline edit
4. Set `e._editing = true` `[V1 line 762]`
5. Update hidraggable: `{draggable: false}` (prevents accidental drag during edit) `[V1 line 763]`
6. CSS: `c.css("cursor", "text"); c.addClass("editing"); designTarget.addClass("editing")` `[V1 line 764-765]`
7. Subscribe click on content while editing to stop propagation `[V1 line 766-770]`
8. `c.attr("contenteditable", true)` enables direct typing `[V1 line 771]`
9. Hide resize panel: `p.css("display", "none")` `[V1 line 771]`
10. `selectEnd(c)` places cursor at end via `Range.collapse(false)` or IE's TextRange `[V1 line 776-789]`

Commit triggers: any change of selected element fires `clearLastPrintElement` `[V1 line 12083-12101]` which detects `lastPrintElement._editing` and calls `lastPrintElement.updateByContent(true)` `[V1 line 12086]`.

Parse logic in `updateByContent(clear)` `[V1 line 790-816]`:

1. Remove `editing` classes, `cursor`, `contenteditable` `[V1 line 793-794]`
2. Read `t = c.text()` `[V1 line 795]`
3. Read `title = options.title` `[V1 line 795]`
4. If `t.startsWith(title) && options.field` `[V1 line 796]`:
   - If `t.length > title.length`: `options.testData = t.split("：")[1]` (everything after the first `"："`) `[V1 line 797-798]`
   - Else: `options.title = t` AND `options.testData = ""` `[V1 line 799-802]`
5. Else: `options.title = t` `[V1 line 803-805]`
6. Strip everything after a `"："` from title: `options.title = options.title.split("：")[0]` `[V1 line 806]`
7. If `!clear`: re-fire select event for property panel sync `[V1 line 807-810]`
8. `updateDesignViewFromOptions()` repaints `[V1 line 812]`
9. Fire `hiprintTemplateDataChanged_<id>` `[V1 line 812]`
10. Reset `_editing = false` `[V1 line 813]`
11. Restore hidraggable draggability respecting `positionLocked` and `draggable` option `[V1 line 814-815]`

Quirk: the `"："` separator is **U+FF1A FULLWIDTH COLON** (Chinese colon) not ASCII `":"`. This matters when titles or testData contain colons — design-time parsing splits on `"："` only.

#### F.2 Field binding resolution

In `D.prototype.getData(t)` `[V1 line 10034-10045]`:

1. `f = this.getField()` returns `options.field || printElementType.field` `[V1 line 709-710]`
2. If `t` (= templateData runtime obj):
   - If `f`: `e = f.split('.').reduce((a, c) => (a != null ? a[c] : undefined), t) ?? ""` `[V1 line 10037]` — nested path safe, 0/false/"" preserved (no longer falls back through `||`)
   - Else: `e = ""` `[V1 line 10037]`
3. Else (no data): `e = this.options.testData || this.printElementType.getData() || ""` `[V1 line 10037]`

Then if `this.options.format` is set: applies datetime / boolean transformations `[V1 line 10038-10043]`. Then returns `e`.

> **Historical note** [PM-002 Round 3, referenced in `[V1 line 9788-9789]` for longText analogue]: the V1 fix replaced earlier `f.split('.').reduce((a,c) => a ? a[c] : t[c], !1)` (which fell back to `t[c]` whenever any intermediate path was falsy → 0/false/"" all triggered fallback to root) with `?? ""` to honor user-set zero/false values. `text` follows the same fixed pattern at line 10037.

#### F.3 Formatter chain

Defined in `BasePrintElement.prototype.getFormatter()` `[V1 line 1534-1543]`:

1. `formatter = void 0`
2. If `printElementType.formatter`: `formatter = printElementType.formatter` `[V1 line 1536]`
3. If `options.formatter` (string): try `formatter = new Function('return ' + options.formatter)()` `[V1 line 1537]`. On eval error: silently fall back to `printElementType.formatter` (priority) with `console.warn` `[V1 line 1541]`.
4. Return formatter.

Priority order: `options.formatter` (eval ok) > `printElementType.formatter` > no formatter (pass-through).

Invocation in `updateTargetText` `[V1 line 10050]`:

```js
r ? r(title, value, options, templateData, target) : value
```

So formatter receives `(title, value, options, templateData, target)` — 5 args. Factory preset `currentDate` `[provider:375-386]` uses this signature.

`styler` chain parallels the same pattern `[V1 line 1544-1551]`, invoked in `stylerCss` `[V1 line 1263-1271]` with `(value, options, target, templateData)` — note the different arg order.

#### F.4 testData rendering when no `data` passed

When `print()` is called without a `data` payload (design-time and certain previews), `getData(undefined)` falls through to `options.testData || printElementType.getData() || ""` `[V1 line 10037]`. `printElementType.getData()` returns `printElementType.data` if set `[V1 line typical PrintElementType getData]`.

So preview priority:

1. Element's `options.testData` if set (e.g. `"DD20260509001"` from `orderNo` `[provider:246]`)
2. PrintElementType's `data` if set (e.g. `"155123456789"` for `defaultModule.longText` `[provider:41]`)
3. Empty string

#### F.5 `pageBreak` option behavior

When `options.pageBreak === true`:

- `pageBreak.css(t, e)` `[V1 line 4200-4205]` adds `alwaysHide` class — semantically off-target, but the primary effect is in pagination logic of long-text / table multi-page (not directly invoked for plain text elements).
- For simple `text` elements: `pageBreak` is essentially a marker; the runtime pagination algorithm in `getPaperHtmlResult` checks `options.pageBreak` to force a new page.

#### F.6 `showInPage` option behavior

`showInPage(t, e)` on BasePrintElement `[V1 line 692-704]` evaluates whether element should render on a given page:

- `t` = page index (0-based)
- `e` = total pages
- Reads `options.unShowInPage` and `options.showInPage`:
  - `unShowInPage === "first" && t === 0` → hide
  - `unShowInPage === "last" && t === e-1` → hide
  - `showInPage === "first" && t !== 0` → hide
  - `showInPage === "odd" && t % 2 !== 0` → hide
  - `showInPage === "even" && t % 2 !== 1` → hide
  - `showInPage === "last" && t !== e-1` → hide
- `showInPage === "none"` (always hide) is handled separately via CSS class `alwaysHide` `[V1 line 4180]`

### G. Right-click context menu items for `text` etype

Source: `t.designPaper.getTarget().on("contextmenu", function (e) { ... })` `[V1 line 11421-11616]`.

Menu items (same for all element types selected on canvas — there are NO `text`-specific items, but several apply specifically when one `text` is selected):

| Item | Visible when | Action | V1 line |
|------|--------------|--------|---------|
| **元素操作** group header | always when menu shows | label only | 11432 |
| 复制元素 | `hasSelection` (disabled when no selection) | stores `panel._contextCopyElements = selectedEls.slice()` | 11435-11442 |
| 粘贴元素 | `hasCopy` (disabled when no copy buffer) | clones each, offsets +10pt, appends to panel | 11444-11461 |
| **参数更新** group header | hasSelection | label | 11466 |
| 字体 12pt | hasSelection | `el.updateOption('fontSize', 12, true)` for each selected | 11469-11475 |
| 字体加粗 | hasSelection | `el.updateOption('fontWeight', 'bolder', true)` for each | 11477-11483 |
| **层级操作** group header | hasSelection | label | 11486 |
| 置于顶层 | hasSelection | computes max zIndex and assigns max+1+i | 11488-11496 |
| 置于底层 | hasSelection | shifts other elements up by selectedCount+1 | 11497-11508 |
| 上移一层 | hasSelection | `zIndex += 1` for each | 11509-11515 |
| 下移一层 | hasSelection | `zIndex = max(0, zIndex - 1)` | 11516-11522 |
| 锁定元素 / 解锁元素 | hasSelection (text varies with current state) | toggles `positionLocked` AND `sizeLocked=true` when locking | 11525-11540 |
| **对齐操作** group header | `selectedEls.length >= 2` | label | 11544 |
| 左对齐 / 右对齐 / 顶对齐 / 底对齐 / 水平居中 / 垂直居中 | `>= 2` selected | calls `panel.alignElements(type)` | 11546-11566 |
| 水平等距 / 垂直等距 | `>= 3` selected | adds to alignOps | 11554-11556 |
| 等宽 | `>= 2` selected | first element's width broadcast to all | 11569-11580 |
| 等高 | `>= 2` selected | first element's height broadcast to all | 11581-11592 |
| 删除选中元素 (count) | hasSelection | removes each from DOM and `panel.printElements` | 11596-11610 |

The menu is appended to `<body>` (not the paper), positioned at `{left: e.pageX+2, top: e.pageY+2}` `[V1 line 11613]`. Single-shot close: `$(document).one("click.hiprintCtxMenu", ...)` `[V1 line 11615]`.

### H. Lock behavior for `text` etype

#### H.1 What's disabled

When `options.positionLocked === true`:

- Drag disabled: `hidraggable update {draggable: false}` `[V1 line 1004]`
- Coordinate inputs disabled: `<input ... disabled>` `[V1 line 3613-3614, 3622, 3675]`
- Inline edit blocked: in `getDesignTarget` `[V1 line 762]` sets `_editing = true` and `update {draggable: false}` — note: positionLocked does NOT directly block double-click → editing (only `_editing` flag). But hidraggable being disabled means drag-during-edit is impossible, and the resize panel is hidden in `submitOption` `[V1 line 1008-1027]`. Inline edit remains possible — V1 quirk.

When `options.sizeLocked === true`:

- Resize handles hidden: `_$rp.find('.resizebtn').hide()` `[V1 line 1017]`
- Width/height inputs disabled in widthHeight widget `[V1 line 3692-3693, 3699]`
- Design target gets `.size-locked` class `[V1 line 1032]`

Lock state auto-sync via right-click "锁定元素" `[V1 line 11525-11540]`: locking sets BOTH `positionLocked = true` AND `sizeLocked = true`. Unlocking clears `positionLocked` only (sizeLocked retained — V1 quirk).

#### H.2 Visual indicator

`.hiprint-lock-badge` with emoji 🔒 appended to `.resize-panel` when positionLocked:

```html
<div class="hiprint-lock-badge">🔒</div>
```

Source `[V1 line 1010]`. Removed on unlock `[V1 line 1013]`.

`.del-btn` hidden when positionLocked `[V1 line 1022-1023]` (deletion still works through context menu or property-panel button).

#### H.3 Property panel fields disabled

The `coordinate` widget renders X/Y inputs with `disabled` attribute when `posLocked` `[V1 line 3613-3614]`. The `widthHeight` widget renders W/H inputs with `disabled` when `sizeLocked` `[V1 line 3692-3693]`. The lock checkbox (`.coord-pos-lock`) is checked/unchecked accordingly `[V1 line 3611, 3674]`.

### I. Style classes & state classes — `text` etype

Static structural classes (always present):

- `.hiprint-printElement` (outer)
- `.hiprint-printElement-text` (outer, text-specific)
- `.hiprint-printElement-text-content` (inner)
- `.hiprint-printElement-content` (inner)

Dynamic / state classes — see Section E.3 above for full table.

Resize panel injected during `setResizePanel()` `[V1 line 1094-1119]` — class `.resize-panel`, with sub-elements `.resizebtn` (8 corner/edge handles), `.del-btn` (delete), `.hiprint-lock-badge` (when locked).

### J. Known V1 quirks / bugs for `text` etype

- **J.1**: Inline-edit parsing splits on **fullwidth colon `"："` (U+FF1A)** not ASCII `":"`. If user types ASCII colon, `t.split("：")[1]` returns undefined and `testData` becomes undefined `[V1 line 798]`.
- **J.2**: After `updateByContent` runs `options.title = options.title.split("：")[0]` `[V1 line 806]`, any colon characters in `title` are silently truncated — even if the colon was part of the original (e.g. "时间:" → "时间"). Only fullwidth `"："` affected.
- **J.3**: When locked via right-click menu, `sizeLocked` is set true but never cleared on unlock `[V1 line 11531-11533]` — re-unlocking only clears positionLocked, leaving sizeLocked sticky.
- **J.4**: `barAutoWidth` is **string-typed by design** — `getBarAutoWidth()` returns true only if literal string `"true"`, any other value (including boolean true) returns false `[V1 line 9984-9985]`. Comment at line 9984: "该属性 'true' 为 true，其余一概为 false".
- **J.5**: `fontFamily` empty value sets `font-family: inherit` (not unset) `[V1 line 2489]` — comment "从父元素继承字体, 否则模板字体无效".
- **J.6**: `borderRadius` and `borderStyle` are NOT in `text.supportOptions`, so the property panel never renders these widgets for text. But raw JSON templates can include them and they take effect via CSS `[V1 line 4723, 4484]`.
- **J.7**: `transform: rotate(<n>deg)` is applied to the `.hiprint-printElement` wrapper (or the parent if found different) `[V1 line 4436-4441]`. The rotated bounding box (`getRectInfo`) recalculates width/height via trigonometry `[V1 line 575-586]` — non-trivial for layout calculation.
- **J.8**: Right-click "字体 12pt" and "字体加粗" buttons hardcode the values `12` and `"bolder"` `[V1 line 11472, 11480]` — no option for custom values via context menu.
- **J.9**: Inline editing while `textType == "barcode"` or `"qrcode"` is suppressed `[V1 line 761]` — but only if user-set `options.textType !== "text"`. Empty/undefined textType still allows editing (because getTextType defaults to `"text"`).
- **J.10**: `_listOnlySelect` event flag is used to distinguish element-list-panel triggered selection from canvas-click selection `[V1 line 746-749]` to prevent double property-panel rebuild.
- **J.11**: `hiprint.toUpperCase(upperCase, str)` for numeric → Chinese conversion uses the `Nzh` library `[V1 line 10050]` — if `str` is not numeric, conversion may produce unexpected output.
- **J.12**: `dataType: "boolean"` requires `format` shape `"trueText:falseText"` — if no colon in format, `format.split(":")` length check (`> 0`) is always truthy `[V1 line 10041-10043]` so single-colon parse is the only safe form.

---

## PART 2 — `longText` element type

The `longText` etype is the multi-line, multi-page wrapping text element. It splits content character-by-character (using binary search over height measurement) to fill available page space and span across page breaks. Unlike `text`, it has indentation support, leading-space removal, and `lHeight` (minimum height when empty).

### A. Class hierarchy — `longText`

#### A.1 V1 class identity

- **Runtime element class**: `w` (minified) — `class LongTextPrintElement extends BasePrintElement` semantically. Defined at `[V1 line 9757-9931]`.
- **Inheritance chain**: `w` → `BasePrintElement` (f.a).
- **Options class**: `b` (minified) — `class LongTextPrintElementOption extends g.a` semantically. Defined at `[V1 line 9316-9325]`.
- **Element-type factory**: created via `nt.createPrintElementType(t)` — when `t.type` is **not** `"text"` and not `"table"`, returns `new j(t)` `[V1 line 10657]`. So longText uses the base `j` printElementType class.
- **Element instance factory**: `W.createPrintElement(t, e)` switch `[V1 line 10522-10524]` returns `new w(t, e)` when `t.type == "longText"`.
- **Insertion helper**: `t.printElementType.type = "longText"` via `insertElementToPanel('longText')` `[V1 line 11335]`.

#### A.2 Constructor

V1 source `[V1 line 9758-9761]`:

```js
function e(e, n) {
  var i = t.call(this, e) || this;
  return i.options = new b(n),
         i.options.setDefault(new b(p.a.instance.longText.default).getPrintElementOptionEntity()),
         i;
}
```

- `e` = printElementType descriptor (`{tid: "defaultModule.longText", title: "长文", data: "155123456789", type: "longText", icon: "ep:tickets"}`).
- `n` = merged options.
- `t.call(this, e)` invokes BasePrintElement ctor.
- `new b(n)` constructs options. The `b` constructor `[V1 line 9317-9320]` calls super then assigns `n.leftSpaceRemoved = e.leftSpaceRemoved`.
- `setDefault` merges in `longText.default = {height: 42, width: 540}` `[config:882-885]`.

### B. Options table — `longText` etype (every field)

> Source: `longText.tabs` `[config:618-731]`, `longText.supportOptions` `[config:732-881]`, and runtime reads in `w` class `[V1 line 9757-9931]`. Options shared with `text` are repeated below for completeness (not abbreviated, per doctrine).

| # | Option key | Type | Default | Range / valid values | UI control | What it renders / affects | V1 line(s) read | V1 line(s) default |
|---|------------|------|---------|---------------------|------------|--------------------------|-----------------|--------------------|
| B.1 | `title` | string | element-type's `title` (e.g. `"长文"`) | any string | `<textarea>` 50px high `[V1 line 3576]` | Used as title prefix `title + "："` when `field` set AND `getHideTitle()` false `[V1 line 9803]`. Different from text: longText `getTitle()` does NOT strip newlines (no replaceEnterAndNewlineAndTab call) `[V1 line 9783-9784]`. | 9783, 9803 | undefined |
| B.2 | `field` | string | undefined | dot-path string | `<input type="text">` / `<select>` 字段名 `[V1 line 3547-3559]` | Nested lookup: `field.split('.').reduce((a, c) => a != null ? a[c] : undefined, t) ?? ""` `[V1 line 9787]` — PM-002 fix preserves 0/false/"". | 9786-9787 | undefined |
| B.3 | `testData` | string | undefined | any string | `<input type="text">` 测试数据 `[V1 line 3592]` | Design-time / no-data preview: `options.testData || printElementType.getData() || ""` `[V1 line 9790]`. | 9790, 9824 | undefined |
| B.4 | `left` | number (pt) | drag-drop position | ≥ 0 | coordinate widget X input `[V1 line 3613]` | Sets `left: <val>pt` `[V1 line 9831, 9836]`. | 9831, 9836 | drag position |
| B.5 | `top` | number (pt) | drag-drop position | ≥ 0 | coordinate widget Y input `[V1 line 3614]` | Sets `top: <val>pt` `[V1 line 9831, 9835]`. Multi-page: `top` adjusted per page in `getPaperHtmlResult` `[V1 line 9856]`. | 9831, 9835, 9856 | drag position |
| B.6 | `width` | number (pt) | `540` (config:884) | > 0 | widthHeight 宽 input `[V1 line 3692]` | Sets `width: <val>pt`. Factory presets: senderInfo/receiverInfo=240 `[provider:217, 229]`. | 9838, 9863 | config:884 |
| B.7 | `height` | number (pt) | `42` (config:883) | > 0 | widthHeight 高 input `[V1 line 3693]` | Initial design height. For longText, actual print height depends on content length + pagination, but this `height` is reserved for design panel size. | 9837, 9862, 9869 | config:883 |
| B.8 | `positionLocked` | boolean | undefined | true/false | coordinate widget checkbox `[V1 line 3611]` | Same as text: disables drag, hides resize handles, adds lock badge. | 996-1027 | undefined |
| B.9 | `sizeLocked` | boolean | undefined | true/false | widthHeight checkbox `[V1 line 3690]` | Same as text: disables resize. | 1016-1042 | undefined |
| B.10 | `draggable` | boolean | undefined | true/false | n/a (managed via positionLocked) | Same as text. | 1004, 814 | undefined |
| B.11 | `coordinateSync` | boolean | false | true/false | 🔗/🔓 toggle in coordinate `[V1 line 3628-3637]` | UI-only sync between X/Y inputs. | 3617 | undefined |
| B.12 | `widthHeightSync` | boolean | false | true/false | 🔗/🔓 toggle in widthHeight | UI-only sync between W/H inputs. | 3696 | undefined |
| B.13 | `hideTitle` | boolean | undefined | "true"/"false"/"" → bool | `<select>` 标题显示隐藏 `[V1 line 2600]` | `getHideTitle()` in `b` class `[V1 line 9322-9323]` reads `null == this.hideTitle ? defaultOptions.hideTitle : this.hideTitle`. When true: title prefix not rendered `[V1 line 9803]`. | 9803, 9322 | undefined |
| B.14 | `fixed` | boolean | undefined | true/false | `<select>` 位置固定 `[V1 line 4333]` | When true: `getPaperHtmlResult` `[V1 line 9831]` short-circuits multi-page logic and renders only on the current page (treated as fixed). | 9831 | undefined |
| B.15 | `fontFamily` | string | inherit | various | `<select>` 字体 `[V1 line 2478]` | Same as text. | 2488 | undefined |
| B.16 | `fontSize` | number (pt) | undefined (no longText-class fallback) | same value set as text `[V1 line 2515]` | `<select>` 字体大小 `[V1 line 2515]` | Sets `font-size: <val>pt`. Factory presets: senderInfo=9 `[provider:218]`, receiverInfo=12 `[provider:230]`. | 2509 | undefined |
| B.17 | `fontWeight` | string | undefined | various `[V1 line 2539]` | `<select>` 字体粗细 `[V1 line 2539]` | Same as text. Factory preset: receiverInfo=`"bold"` `[provider:231]`. | 2533 | undefined |
| B.18 | `letterSpacing` | number (pt) | undefined | various `[V1 line 2561]` | `<select>` 字间距 `[V1 line 2561]` | Same as text. | 2556 | undefined |
| B.19 | `textAlign` | string | undefined | left/center/right/justify `[V1 line 2584]` | `<select>` 左右对齐 `[V1 line 2584]` | Same as text. | 2578 | undefined |
| B.20 | `lineHeight` | number (pt) | undefined | various `[V1 line 2460]` | `<select>` 字体行高 `[V1 line 2460]` | Same as text. Factory presets: senderInfo=13.5 `[provider:219]`, receiverInfo=15 `[provider:232]`. | 2454 | undefined |
| B.21 | `color` | string | undefined | hex/rgb | minicolors `[V1 line 3505]` | Same as text. | 3499 | undefined |
| B.22 | `longTextIndent` | number (pt) | undefined → 0 (sanitized) | 6/6.75/7.5/.../36 `[V1 line 4162]` | `<select>` 每行缩进 `[V1 line 4162]` | Generates `<span class="long-text-indent" style="margin-left:<n>pt"></span>` prepended to each line `[V1 line 9817]`. Sanitization: `parseInt(val, 10)` → if `!isFinite || <0`: indent=0 (XSS C1 hardening note `[V1 line 9813-9817]`). | 9815-9817 | undefined |
| B.23 | `leftSpaceRemoved` | boolean | undefined ("不移除") | "true"/"false"/"" → bool `[V1 line 4254]` | `<select>` 移除段落左侧空白 `[V1 line 4254]` | When NOT explicitly false (`0 != options.leftSpaceRemoved`): each line's leading whitespace stripped via `.replace(/^\s*/, "")` `[V1 line 9802, 9829]`. | 9802, 9829 | undefined; assigned at construction `[V1 line 9319]` |
| B.24 | `lHeight` | number (pt) | undefined | any number | `<input type="text">` 最低高度 (placeholder "文本过短或为空时的高度") `[V1 line 4380]` | When set: if rendered text height < lHeight, line height extends to lHeight `[V1 line 9856]`. | 9856 | undefined |
| B.25 | `transform` | number (deg) | undefined | any number | `<input type="number">` 旋转角度 `[V1 line 4446]` | Same as text. | 4440 | undefined |
| B.26 | `zIndex` | number | 0 | any integer | `<input type="number">` 元素层级 `[V1 line 4467]` | Same as text. | 4463 | undefined |
| B.27 | `pageBreak` | boolean | undefined | "true"/"" `[V1 line 4207]` | `<select>` 强制分页 `[V1 line 4207]` | Force new page before this element. | 4202 | undefined |
| B.28 | `showInPage` | string | undefined | none/first/odd/even/last `[V1 line 4185]` | `<select>` 显示规则 `[V1 line 4185]` | Same as text. | 4180, 692-704 | undefined |
| B.29 | `unShowInPage` | string | undefined | first/last `[V1 line 4396]` | `<select>` 隐藏规则 `[V1 line 4396]` | Same as text. | 692-704 | undefined |
| B.30 | `axis` | string | undefined | h/v `[V1 line 4348]` | `<select>` 拖动方向 `[V1 line 4348]` | Same as text. | 956, 987 | undefined |
| B.31 | `formatter` | string (function source) | undefined; falls back to printElementType.formatter | function signature: `(title, value, options, templateData)` for longText | `<textarea>` 格式化函数 `[V1 line 5643]` | Eval'd via `new Function`. When formatter present, longText uses `.html(o)` NOT `.text(o)` `[V1 line 9795]` — formatter output is treated as HTML (semantic difference vs text). | 9795, 9801 | undefined |
| B.32 | `styler` | string (function source) | undefined; falls back to printElementType.styler | function `(value, options, target, templateData) → {cssKey: cssVal}` | `<textarea>` 样式函数 `[V1 line 5660]` | Same as text — applies returned CSS object keys via `t.css(key, val)` `[V1 line 1267-1270]`. | 1263-1271 | undefined |
| B.33 | `optionsGroup` | placeholder | n/a | n/a | label "边框设置" `[V1 line 4505]` | UI grouping only, no value. Listed in supportOptions `[config:825-827]` but NOT in tabs — appears only when no tabs (legacy supportOptions path). | n/a | n/a |
| B.34 | `borderLeft` | string | undefined | ""/solid/dotted | `<select>` 左边框 `[V1 line 4552]` | In supportOptions `[config:829]` but NOT in tabs — UI doesn't render in tabbed property panel. Raw JSON still applies CSS via css() callback. | 4546 | undefined |
| B.35 | `borderTop` | string | undefined | ""/solid/dotted | `<select>` 上边框 | Same as borderLeft: in supportOptions only `[config:833]`. | 4521 | undefined |
| B.36 | `borderRight` | string | undefined | ""/solid/dotted | `<select>` 右边框 | Same: in supportOptions only `[config:837]`. | 4571 | undefined |
| B.37 | `borderBottom` | string | undefined | ""/solid/dotted | `<select>` 下边框 | Same: in supportOptions only `[config:841]`. | 4596 | undefined |
| B.38 | `borderWidth` | number (pt) | undefined | 0.75/1.5/.../6.75 `[V1 line 2886]` | `<select>` 边框大小 | In supportOptions only `[config:845]`. | 2891 | undefined |
| B.39 | `borderColor` | string | undefined | hex/rgb | minicolors | In supportOptions only `[config:849]`. | n/a | undefined |
| B.40 | `contentPaddingLeft` | number (pt) | undefined | various `[V1 line 4627]` | `<select>` 左内边距 | In supportOptions only `[config:853]`. | 4621 | undefined |
| B.41 | `contentPaddingTop` | number (pt) | undefined | various `[V1 line 4653]` | `<select>` 上内边距 | In supportOptions only `[config:857]`. | 4647 | undefined |
| B.42 | `contentPaddingRight` | number (pt) | undefined | various `[V1 line 4679]` | `<select>` 右内边距 | In supportOptions only `[config:861]`. | 4673 | undefined |
| B.43 | `contentPaddingBottom` | number (pt) | undefined | various `[V1 line 4705]` | `<select>` 下内边距 | In supportOptions only `[config:865]`. | 4699 | undefined |
| B.44 | `backgroundColor` | string | undefined | hex/rgb | minicolors `[V1 line 4753]` | In supportOptions only `[config:869]`. | 4747 | undefined |

**`longText` etype option count: 44 fields cataloged.** (Target was ≥15, exceeded by 29.)

> Options that exist for `text` but NOT for `longText` (absent from both tabs AND supportOptions, confirmed by grep `[config:617-886]`):
> - `dataType` / `format` (no datetime/boolean formatting in longText)
> - `textDecoration` (no underline/overline in longText property panel)
> - `textContentVerticalAlign` (no vertical-align option in longText)
> - `textContentWrap` (longText is wrapping by nature; nowrap doesn't fit semantics)
> - `textType` (longText cannot be barcode/qrcode)
> - `barcodeMode`, `barTextMode`, `barWidth`, `barAutoWidth`, `barcodeType`, `qrCodeLevel`, `qrcodeType` (barcode/qrcode options)
> - `upperCase` (Chinese number conversion — not useful for paragraph text)
> - `borderStyle` (not in either)
> - `borderRadius` (not in either)

### C. Default options — factory presets for `longText` etype

#### C.1 `defaultModule.longText` (常规 / 长文) `[provider:38-44]`

| Field | Value |
|-------|-------|
| `tid` | `"defaultModule.longText"` |
| `title` | `"长文"` |
| `data` | `"155123456789"` |
| `type` | `"longText"` |
| `icon` | `"ep:tickets"` |
| (no preset `options`) | uses `longText.default`: `width=540, height=42` `[config:882-885]` |

#### C.2 `defaultModule.senderInfo` (电商 / 寄件人信息) `[provider:210-221]`

| Field | Value |
|-------|-------|
| `tid` | `"defaultModule.senderInfo"` |
| `title` | `"寄件人信息"` |
| `type` | `"longText"` |
| `icon` | `"ep:promotion"` |
| `options.width` | `240` |
| `options.height` | `42` |
| `options.fontSize` | `9` |
| `options.lineHeight` | `13.5` |

#### C.3 `defaultModule.receiverInfo` (电商 / 收件人信息) `[provider:222-233]`

| Field | Value |
|-------|-------|
| `tid` | `"defaultModule.receiverInfo"` |
| `title` | `"收件人信息"` |
| `type` | `"longText"` |
| `icon` | `"ep:user"` |
| `options.width` | `240` |
| `options.height` | `42` |
| `options.fontSize` | `12` |
| `options.fontWeight` | `"bold"` |
| `options.lineHeight` | `15` |

### D. Property panel sections rendered for `longText` etype

Source: `longText.tabs` `[config:618-731]`.

| Section title | Fields shown (in order) | When | V1 source |
|---------------|-------------------------|------|-----------|
| **D.1 基础** | `title`, `field`, `testData`, `coordinate`, `widthHeight`, `hideTitle`, `fixed` | always | `[config:619-650]` |
| **D.2 样式** | `fontFamily`, `fontSize`, `fontWeight`, `letterSpacing`, `textAlign`, `lineHeight`, `color`, `longTextIndent`, `leftSpaceRemoved`, `lHeight`, `transform`, `zIndex` | always | `[config:651-702]` |
| **D.3 高级** | `pageBreak`, `showInPage`, `unShowInPage`, `axis`, `formatter`, `styler` | always | `[config:703-731]` |

Note: longText property panel has **3 tabs** (基础/样式/高级) vs text's **4 tabs** (基础/样式/边框/高级). longText DOES NOT have a "边框" tab — although border options are present in `supportOptions` `[config:825-871]` they don't surface in any tab. This is intentional: longText is treated as a multi-page text body where border styling is rare; the `optionsGroup` and border items in `supportOptions` are legacy retainers for non-tabbed config mode.

### E. Render output DOM — `longText`

#### E.1 Top-level wrapping DOM

Generated by `createTarget(t, e)` `[V1 line 9797-9799]`:

```html
<div class="hiprint-printElement hiprint-printElement-longText"
     style="position: absolute;">
  <div class="hiprint-printElement-longText-content hiprint-printElement-content"
       style="height:100%; width:100%"></div>
</div>
```

Inline styles applied at design / print time `[V1 line 9831, 9856]`:

- `position: absolute`
- `left: <options.displayLeft()>pt`
- `top: <options.displayTop()>pt` (per page, may differ across multi-page renders)
- `width: <options.width>pt` (via `updateTargetWidth` `[V1 line 9825, 740-741]`)
- `height: <options.height>pt` (via `updateTargetSize` `[V1 line 9825, 738-739]`) — note in `getPaperHtmlResult` after rendering, `f.target[0].height = ""` `[V1 line 9831]` clears the inline height so content drives layout

Design-time addition: `n.find(".hiprint-printElement-longText-content").css("border", "1px dashed #cebcbc")` `[V1 line 9765]` — adds a dashed border so the empty longText container is visible during editing.

#### E.2 Content DOM

Inner `.hiprint-printElement-longText-content.hiprint-printElement-content` receives content:

**Without formatter** (default): plain text via `.text(o)` `[V1 line 9796]`. The text is computed by `getText(title, value)` `[V1 line 9800-9803]`:

- If `field`: `(hideTitle ? "" : (title ? title + "：" : "")) + (formatter ? formatter(title, value, options, templateData) : value)`
- Else: `(formatter ? formatter(title, title, options, templateData) : (title || ""))`

**With formatter**: `.html(o)` `[V1 line 9795]` — formatter return value rendered as HTML. (Semantic distinction from text element, which always uses `.text()` except for barcode/qrcode.)

**Pagination rendering** (`getPaperHtmlResult` `[V1 line 9818-9872]`): splits text character-by-character (`l = l.concat(n.split(""))`) and iterates with `BinarySearch` `[V1 line 9883-9892]` to find how many chars fit on the current page. Each page gets its own DOM target via `target.clone()` `[V1 line 9889]`.

Each new line begins with the indent span `[V1 line 9826]`:

```html
<span class="long-text-indent" style="margin-left:<longTextIndent>pt"></span>
```

or without margin if longTextIndent is 0 / undefined:

```html
<span class="long-text-indent"></span>
```

Line separator: `<br/>` followed by next line's indent span `[V1 line 9830]`.

#### E.3 CSS classes dynamically added/removed

Same baseline as text (selected, locked, etc., see Section E.3 of text). longText-specific:

| Class | When added | When removed | V1 line |
|-------|------------|--------------|---------|
| `.long-text-indent` (on `<span>` inside content) | every line start | n/a (rebuilt each render) | 9817 |
| dashed border on `-longText-content` | design-time mount | n/a | 9765 |

Inline editing path (double-click → contenteditable) is **disabled for longText** — the dblclick handler `[V1 line 757-774]` guards with `printElementType.type == "text"` only `[V1 line 761]`. longText cannot be inline-edited.

#### E.4 Inline styles inserted from options

Same option-item css callbacks as text (see Section E.4 of text). longText-specific behavior:

- `formatter` output goes through `.html()` not `.text()` `[V1 line 9795]` — caller is responsible for escaping (XSS by-design path, see comment `[V1 line 9794]`).
- `leftSpaceRemoved` per-line `.replace(/^\s*/, "")` `[V1 line 9802, 9829]` applies before line split.
- `longTextIndent` injected as `<span>` not as CSS `[V1 line 9817]` — sanitized via `parseInt` (XSS C1 hardening `[V1 line 9813-9817]`).

### F. Interactions specific to `longText` etype

#### F.1 Double-click → inline edit — DOES NOT APPLY

The dblclick handler at `[V1 line 757-774]` guards with `printElementType.type == "text"` `[V1 line 761]`. For longText, the dblclick event still fires but no editing state is entered — `_editing` never becomes true.

To edit longText content design-time, user must edit via the right property panel (`title` and `testData` fields) — there is no canvas-direct typing.

#### F.2 Field binding resolution

`w.prototype.getData(t)` `[V1 line 9785-9790]`:

```js
var f = this.getField();
var e = f ? f.split('.').reduce((a, c) => (a != null ? a[c] : undefined), t) ?? "" : "";
return t ? e : this.options.testData || this.printElementType.getData() || "";
```

Comment `[V1 line 9788-9789]`: "reduce 已经 ?? '' 处理 null-safe + 保留 0/false/''. 不要再 `e || ''` 把 0/false 当 falsy 转空 (PM-002 第三层 fallthrough,e2e nested-field 暴露)".

So zero, false, empty-string values from nested data lookup are preserved as-is, not coerced to fallback.

#### F.3 Formatter chain

Same as text but invoked differently — formatter returns HTML (rendered via `.html(o)` `[V1 line 9795]`). Signature in `getText` `[V1 line 9803]`:

- If `field`: `formatter(title, value, options, templateData)` — only 4 args (no `target`)
- Else: `formatter(title, title, options, templateData)`

Note: `target` is NOT passed to longText formatter `[V1 line 9803]` (4-arg signature) whereas text formatter receives 5 args `[V1 line 10050]`.

#### F.4 testData rendering when no `data`

`getData(undefined)` → returns `options.testData || printElementType.getData() || ""` `[V1 line 9790]`. Factory preset `defaultModule.longText` has `data: "155123456789"` `[provider:41]` so unbound longText shows that string in preview.

#### F.5 `pageBreak` option behavior

For longText, `pageBreak` is also a marker checked by pagination logic. The pagination algorithm in `getPaperHtmlResult` `[V1 line 9845-9870]` doesn't directly read `options.pageBreak` but the panel-level loop that calls `getHtml(t, e)` does — when this element's `pageBreak === true`, prior content is flushed and this element starts on a new page.

#### F.6 `showInPage` option behavior

Same logic as text via `showInPage(t, e)` on BasePrintElement `[V1 line 692-704]`. longText elements respect first/odd/even/last hide rules.

#### F.7 LongText-specific: Pagination — binary search text fit

The defining behavior of longText: it physically wraps and paginates by measuring rendered height.

Algorithm in `getStringBySpecificHeight(t, e, n)` `[V1 line 9873-9882]`:

1. `i = pt.toPx(e)` — convert available height to pixels
2. If `panel.panelPageRule == "none"` (no pagination): `r = IsPaginationIndex(t, t.length, -1, n)` — try full length, no height constraint
3. Else: `r = IsPaginationIndex(t, t.length - 1, i, n)` — try full minus one with height constraint
4. If pagination signaled: return r
5. Else: `BinarySearch(t, 0, t.length-1, i, n)` — find the largest prefix that fits within height

`BinarySearch(t, e, n, i, o)` `[V1 line 9883-9892]`:
- Standard binary search with mid `r = Math.floor((e+n)/2)`
- Sets target's content text to `t.slice(0, r).join("")` and measures `i.height()`
- Recurses left if too tall, right if room remains

Height measurement uses `.text()` for safety `[V1 line 9897, 9906, 9908]` — comment `[V1 line 9894-9895]`: "BinarySearch 仅为测量高度,用 .text() 写 textContent 等价高度且不解析为 HTML".

Returns DTO with `IsPagination`, `height`, `length`, `target` (cloned).

#### F.8 LongText-specific: Multi-page result construction

After binary-search returns `f` (the fit chunk), result is wrapped in `PaperHtmlResult` `[V1 line 9831, 9856]` with:

```js
new P.a({
  target: f.target,          // cloned DOM with this page's chars
  printLine: <bottom y>,
  referenceElement: new E.a({ top, left, height, width,
                              beginPrintPaperIndex, bottomInLastPaper, printTopInPaper })
})
```

Subsequent pages set `target.css("top", paperHeader + "pt")` to align under page header `[V1 line 9856]`.

When `lHeight` set and the fit is shorter than `lHeight`: `g = d + (f.height > options.lHeight ? f.height : options.lHeight)` `[V1 line 9856]` — line stretches to at least lHeight.

### G. Right-click context menu — same as text

The contextmenu handler `[V1 line 11421-11616]` is bound on the paper, not the element. It works identically for longText. See Section G of Part 1.

Specific applicability:

- "字体 12pt" works (longText has `fontSize`).
- "字体加粗" works (longText has `fontWeight`).
- "置于顶层/底层/上下移一层" work (longText has `zIndex`).
- "锁定/解锁" work (positionLocked/sizeLocked).
- "对齐操作" work.

The context menu has NO items specific to longText.

### H. Lock behavior — same as text

See Section H of Part 1. Lock mechanics are inherited from BasePrintElement `[V1 line 996-1042, 11525-11540]` — identical for longText.

Additional longText note: when locked, the dashed border on the content area `[V1 line 9765]` still renders (visual cue is preserved even during lock).

### I. Style classes & states — `longText`

Static structural:

- `.hiprint-printElement` (outer)
- `.hiprint-printElement-longText` (outer, longText-specific)
- `.hiprint-printElement-longText-content` (inner)
- `.hiprint-printElement-content` (inner, shared with text)
- `.long-text-indent` (per-line span, inside content)

Dynamic state classes: same set as text (selected, locked, alwaysHide, etc.) — see Section E.3 of Part 1. longText does NOT use `editing` class because inline edit is disabled.

### J. Known V1 quirks / bugs — `longText`

- **J.1**: longText has NO inline-edit on canvas `[V1 line 761]` — must use property panel to change title/testData.
- **J.2**: `longTextIndent` value is sanitized via `parseInt(val, 10)` and clamped to `>= 0` `[V1 line 9815-9816]` (XSS C1 hardening note) — non-numeric values silently become `0`.
- **J.3**: Pagination height measurement uses `.text()` write (line 9897, 9906, 9908) NOT `.html()` — intentional security hardening `[V1 line 9894-9895]`.
- **J.4**: `updateDesignViewFromOptions` uses `contents().clone()` to transfer DOM nodes rather than serialize → re-parse via `.html()` `[V1 line 9777-9778]` (XSS hardening, comment `[V1 line 9775-9776]`).
- **J.5**: `getText` strips leading whitespace from `e` (the value) ONLY when `0 != leftSpaceRemoved` `[V1 line 9802]`. The semantic is "remove unless explicitly disabled" — `leftSpaceRemoved == false` (string `"false"` mapped to bool false in `S.getValue()` `[V1 line 4256]`) preserves spaces. `undefined` and `0` both remove. Notable: pattern `0 != x` returns true for `undefined`, so undefined removes spaces.
- **J.6**: When `formatter` is set, longText uses `.html(o)` `[V1 line 9795]` — formatter output is HTML, NOT text. This is documented as "by-design HTML render path" `[V1 line 9794]` — business code must escape user data inside the formatter.
- **J.7**: `getTitle()` for longText returns `options.title || printElementType.title` `[V1 line 9783-9784]` — NO `replaceEnterAndNewlineAndTab` call (unlike text `[V1 line 10033]`). So longText titles can contain newlines/tabs. They will be rendered as-is in the title prefix.
- **J.8**: Multi-page rendering creates one `PaperHtmlResult` per page `[V1 line 9856]`. Each subsequent page's element gets `top: paperHeader + "pt"` `[V1 line 9856]` — element starts at the page header line on continuation pages.
- **J.9**: `lHeight` is the **minimum** line height for empty / short content `[V1 line 4380]` (placeholder: "文本过短或为空时的高度"). Without lHeight, an empty longText collapses to 0 height.
- **J.10**: `getHeightByData(t)` `[V1 line 9808-9811]` synthesizes a fake panel of `25000pt` height to render unbounded and measure resulting height — used by callers needing the total height without committing to layout.
- **J.11**: Multi-page pagination panel rule `panelPageRule == "none"` causes the algorithm to skip splitting entirely `[V1 line 9876-9881]` — all content rendered on one page even if it overflows.
- **J.12**: The `b` (LongTextPrintElementOption) class only overrides `getHideTitle()` `[V1 line 9322-9323]` — all other option lookups go through the base `g.a` defaults pipeline `[V1 line 566-570, 639-640]`.
- **J.13**: longText `borderTop`/`borderLeft`/`borderRight`/`borderBottom` and the four `contentPadding*` options are in `supportOptions` `[config:829-867]` but NOT in `tabs` `[config:619-731]` — they have NO property-panel UI for longText. Templates can still set them via JSON, and CSS callbacks apply them `[V1 line 4521, 4546, 4571, 4596, 4621, 4647, 4673, 4699]`, but designers can't toggle them in the GUI.

---

## Appendix — Cross-cutting V1 facts

### Shared option-item registry

All option items are registered via `HiPrintConfig.prototype.registerItems` `[V1 line 409-412]` which calls `PrintElementOptionItemManager.registerItem(new ItemClass())` `[V1 line 411]`. The instance singleton `[V1 line 415]` auto-registers `optionItems` array on first access, after `window.HIPRINT_CONFIG` merge. Items are then looked up by `name` via `lt.a.getItem(name)` `[V1 line 1253, 1305]` during property-panel construction.

Option items implement (most of):

- `this.name` — string key matching `options.<name>`
- `createTarget(printElement, options, printElementType)` → jQuery wrapper of DOM for the panel entry
- `getValue()` → reads the entry's current value
- `setValue(val, ...)` → sets the entry
- `css(targetEl, value)` → returns CSS string OR null (applies CSS at print-time)
- `destroy()` → removes target DOM
- `submit` — callback wired by panel builder `[V1 line 12117, 12174]` to trigger element re-render

### Property panel build pipeline

For both `text` and `longText`:

1. User clicks element → `BasePrintElement.designTarget.click` fires `getPrintElementSelectEventKey()` event `[V1 line 752-755]`
2. `ut.buildSetting(t)` invoked `[V1 line 12071-12078]`
3. `i.getPrintElementOptionTabs()` returns tabs from config `[V1 line 1294-1310]`
4. For each non-empty tab: render fields via `t.createTarget(i, i.options, i.printElementType)` then `setValue(...)` `[V1 line 12116-12140]`
5. Wire `auto-submit` change + Enter handlers `[V1 line 12229-12232]`
6. `i.submitOption()` `[V1 line 932-1060]` walks tabs, reads `getValue()` from each item, writes back to `options[name]`, then `updateDesignViewFromOptions()` repaints

### Type-specific `getConfigOptions()` returns

- `D.prototype.getConfigOptions = function () { return p.a.instance.text; }` `[V1 line 10029-10030]`
- `w.prototype.getConfigOptions = function () { return p.a.instance.longText; }` `[V1 line 9781-9782]`

These return the `text:` / `longText:` blocks from `hiprint.config.js` after merge into `HiPrintConfig` singleton.

### Type-specific element-type group placement

Both etypes appear in `defaultModule` groups via `default-etyps-provider.js`:

- `常规`: contains `text` (defaultModule.text), `longText` (defaultModule.longText), `customText`, `titleRow`, plus image / table / html
- `电商`: contains `url`, `price`, `sku`, `orderNo`, `orderDate`, `trackingNo`, `totalAmount` (text), plus `senderInfo`, `receiverInfo` (longText)
- `辅助`: contains `barcode`, `qrcode` (text via textType)
- `实用`: contains `currentDate`, `signature` (text)

Groups rendered in element-list panel by `getElementTypeGroups` `[V1 line 10665-10694]`.

### Insertion via toolbar / programmatic API

Bundle exposes two insertion helpers `[V1 line 11322, 11335]`:

- `t.printElementType.type = "text"` for `insertElementToPanel('text')` style — common path
- `t.printElementType.type = "longText"` for longText insertion

Both call `this.insertPrintElementToPanel(t)` which routes through `addPrintElement(panel, options)` → `appendDesignPrintElement` → `design()` on the element.

### Persistence & template JSON shape

When templates are serialized via `getJson()`, each print element produces:

```json
{
  "tid": "defaultModule.text",
  "options": {
    "left": 12, "top": 8, "width": 120, "height": 9.75,
    "title": "...", "field": "...", "testData": "...",
    "fontSize": 9, ... (all options.* properties)
  }
}
```

Only `string` / `number` / `boolean` / `style` keys are kept by `getPrintElementOptionEntity()` `[V1 line 641-654]` — functions and arrays are stripped except `fields`.

### Test data fallback for unmounted templates

For elements with `field` set but no matching `templateData`, `getData(templateData)` returns `""` `[V1 line 10037, 9787]`. For elements with NO field, fall back to `options.testData || printElementType.getData() || ""` `[V1 line 10037, 9790]` — only used when `templateData` arg is undefined (design-time).

### Internationalization

All option-item labels go through `i18n.__('...')` `[V1 line 2460, 4162, 4185, etc.]`. Field titles like "字体行高", "每行缩进", "显示规则" etc. are i18n keys. Default locale is zh-CN; English mapping in `i18n.json` (not in scope here).

### Event names referenced

- `hiprintTemplateDataChanged_<templateId>` fired on any element mutation `[V1 line 812, 1060, 11459, etc.]`
- `BuildCustomOptionSettingEventKey_<templateId>` for custom option settings panel `[V1 line 9405, 10837, 12073]`
- `PrintElementSelect_<id>` for element selection `[V1 line 849-850, 752-755]`
- `clearSettingContainer` global event `[V1 line 12075]`

---

## End of inventory

This document catalogs **57 options for `text`** and **44 options for `longText`** from V1 source. All claims cite `[V1 line N]` or `[config:N]` or `[provider:N]`. Behaviors not present in V1 are explicitly noted (e.g. "Does not exist in V1: longText has no `textType` field — confirmed via grep `[config:617-886]`").
