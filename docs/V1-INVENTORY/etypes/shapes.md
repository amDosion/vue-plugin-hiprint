# V1 Inventory — Shape Elements (`hline`, `vline`, `rect`, `oval`)

> Exhaustive user-visible behavior spec for V1 shape element types. Every field,
> every interaction, every CSS class, every DOM detail listed. All claims cite a
> V1 source line.
>
> **V1 sources scanned:**
> - `src/hiprint/hiprint.bundle.js` (15353 lines) — class implementations + option items + context menu
> - `src/hiprint/hiprint.config.js` (2254 lines) — `instance.{hline,vline,rect,oval}` config (tabs, supportOptions, defaults)
> - `src/hiprint/etypes/default-etyps-provider.js` (447 lines) — pre-built factory entries under `"辅助"` group
> - `src/hiprint/css/print-lock.css` lines 264-285 — runtime default border styles
>
> **Naming inside the bundle:** the four classes are letter-mangled. From V1 evidence:
>
> | Shape | Class symbol | Constructor branch | Class body |
> |---|---|---|---|
> | `vline` | `F` | `[V1 line 10523]` `"vline" == t.type ? new F(t, e)` | `[V1 line 10240]` `F = function (t) { ... }(f.a)` |
> | `hline` | `A` | `[V1 line 10523]` `"hline" == t.type ? new A(t, e)` | `[V1 line 10282]` `A = function (t) { ... }(f.a)` |
> | `rect`  | `k` | `[V1 line 10523]` `"rect" == t.type ? new k(t, e)`  | `[V1 line 10322]` `k = function (t) { ... }(f.a)` |
> | `oval`  | `V` | `[V1 line 10523]` `"oval" == t.type ? new V(t, e)`  | `[V1 line 10362]` `V = function (t) { ... }(f.a)` |
>
> Parent class `f.a` is `BasePrintElement` defined at `[V1 line 676]`.

---

## 0 — Cross-shape facts (referenced from per-shape sections)

### 0.1 Dispatch / factory

`[V1 line 10523]`
```js
"text" == t.type ? new D(t, e) : "image" == t.type ? new v(t, e) :
"longText" == t.type ? new w(t, e) : "table" == t.type ? new d.a(t, e) :
"html" == t.type ? new S(t, e) : "vline" == t.type ? new F(t, e) :
"hline" == t.type ? new A(t, e) : "rect" == t.type ? new k(t, e) :
"oval" == t.type ? new V(t, e) : "barcode" == t.type ? new barcode(t, e) :
"qrcode" == t.type ? new qrcode(t, e) : void 0;
```

All four shapes go through the same dispatch as text/image/longText/table/html/barcode/qrcode.

### 0.2 Supported-type whitelist

`[V1 line 10660]`
```js
SUPPORTED_ELEMENT_TYPES = ['text', 'image', 'longText', 'table', 'barcode',
                            'qrcode', 'hline', 'vline', 'rect', 'oval', 'html'],
```

Shapes are first-class element types — `setDynamicFields`, `setElementTypeGroups`, and template JSON serialization treat them identically to text/image.

### 0.3 i18n type names

`[V1 line 11882]`
```js
var typeNames = { text: '文本', longText: '长文本', image: '图片', table: '表格',
                  barcode: '条码', qrcode: '二维码',
                  hline: '横线', vline: '竖线', rect: '矩形', oval: '椭圆',
                  html: 'HTML' };
```

Used in element-list panel, alignment dialogs, history log labels.

### 0.4 Toolbar / panel injection helpers

`[V1 line 11336-11343]`
```js
t.prototype.addPrintVline = function (t) {
  t.printElementType = t.printElementType || {};
  t.printElementType.type = "vline";
  this.insertPrintElementToPanel(t);
}, t.prototype.addPrintHline = function (t) {
  t.printElementType = t.printElementType || {};
  t.printElementType.type = "hline";
  this.insertPrintElementToPanel(t);
}, t.prototype.addPrintRect = function (t) {
  t.printElementType = t.printElementType || {};
  t.printElementType.type = "rect";
  this.insertPrintElementToPanel(t);
}, t.prototype.addPrintOval = function (t) {
  t.printElementType = t.printElementType || {};
  t.printElementType.type = "oval";
  this.insertPrintElementToPanel(t);
}
```

These four `addPrintXxx` methods exist on `PrintTemplate` and let programmatic
callers insert shapes without dragging from the toolbar.

### 0.5 Property-panel label re-mapping (shape-aware)

The same three option items (`borderWidth`, `borderColor`, `borderStyle`)
render with **different Chinese labels** for shapes vs other elements:

| Option | Label for shapes | Label for other elements | Evidence |
|---|---|---|---|
| `borderWidth` | `线宽` | `边框大小` | `[V1 line 2885]` ternary on `['hline','vline','rect','oval'].includes(t.printElementType.type)` |
| `borderColor` | `颜色` | `边框颜色` | `[V1 line 3900]` same ternary |
| `borderStyle` | `样式` | `边框样式` | `[V1 line 4729]` same ternary |

This is the only place V1 special-cases shapes inside the option-item layer —
the actual CSS behavior is identical (border-width / border-color / border-style).

### 0.6 Base class behavior (applies to all four shapes)

The four shape classes all `extend(f.a)` where `f.a === BasePrintElement` defined at
`[V1 line 676]`. Inherited behavior reused unchanged by all shapes:

- `getField()` `[V1 line 709]` — returns `options.field || printElementType.field`. Shapes have no `data` and ignore `field` for rendering, but the option still survives serialization.
- `getTitle()` `[V1 line 711]` — returns `printElementType.title`. Used by the element-list panel.
- `updateSizeAndPositionOptions()` `[V1 line 713]` — bounds-checks against panel width/height in pt, then commits left/top/width/height.
- `updateTargetSize()` `[V1 line 738]` — applies `displayWidth()`/`displayHeight()` to the design DOM after every resize.
- `getDesignTarget()` `[V1 line 742]` — registers single-click select + double-click edit handlers. For shapes the double-click branch at `[V1 line 761]` `if (e.printElementType.type == "text" && ...)` short-circuits → **shapes have no inline edit mode**.
- `selectFromList()` `[V1 line 817]` — element-list left-panel click → select path; same for shapes as for text.
- `design()` `[V1 line 851]` — installs `hidraggable` with `axis` / `minMove` / `getScale` callbacks; this is what makes the shape draggable on the canvas.
- `setResizePanel()` `[V1 line 1094]` — installs `hireizeable` using the shape's own `getReizeableShowPoints()`. See section F.2 per shape.
- `submitOption()` `[V1 line 932]` — applies property-panel edits; also processes `positionLocked`/`sizeLocked` and updates `.resize-panel` overlay (lock badge `🔒`, hidden `.resizebtn` etc.).
- `css()` `[V1 line 1237]` — iterates the shape's `tabs[].options[]` config and dispatches each option's `.css(target, value)` setter; this is what propagates `borderWidth`/`borderColor`/`borderStyle`/`backgroundColor`/`transform`/`zIndex` from `options` to the live DOM.

### 0.7 Print rendering helpers shared by all shapes

Both `getHtml` and `getHtml2` defined on `BasePrintElement`:

- `getHtml` `[V1 line 1126]` — runs pagination check first (`r > a` test only), then `createTarget` + `updateTargetSize` + `css` + `setLeft`/`setTop`, returns `PaperHtmlResult[]`. Handles `options.pageBreak` by prepending an empty page.
- `getHtml2` `[V1 line 1172]` — same as `getHtml` plus the additional condition `(r <= a && e && r + this.options.getHeight() > a) && "none" != t.panelPageRule` that also pushes a forced page-break when an element about to be rendered would overflow page footer. Used by **vline / rect / oval** but **not hline** (see per-shape sections).

### 0.8 `BasePrintElement.getReizeableShowPoints` default

`[V1 line 1092]`
```js
return ['barcode', 'qrcode'].includes(this.options.textType)
  ? ["s", "w", "e", "se", "r"]
  : ["s", "w", "e", "r"];
```

`rect` and `oval` inherit this directly (no override) → they get the
non-barcode/qrcode branch, i.e. `["s","w","e","r"]` (south handle, west handle,
east handle, rotate handle).

Resize handle codes are decoded at `[V1 line 8064-8092]`:
- `"n"` north (top)
- `"s"` south (bottom)
- `"w"` west (left)
- `"e"` east (right)
- `"ne" / "nw" / "se" / "sw"` corners
- `"r"` rotate handle

### 0.9 Context-menu items (apply to selected shapes, same as other elements)

`[V1 line 11421]` registers the canvas-level `contextmenu` handler. The full
menu list (when ≥1 shape is selected) at `[V1 line 11430-11611]`:

| Item | Group | Shape behavior | Evidence |
|---|---|---|---|
| 复制元素 | 元素操作 | Stores selected shapes into `panel._contextCopyElements` for later paste. | `[V1 line 11435-11442]` |
| 粘贴元素 | 元素操作 | Clones each stored shape; new copy offset `+10pt` in both X and Y. | `[V1 line 11444-11461]` |
| 字体 12pt | 参数更新 | `el.updateOption('fontSize', 12, true)` — **no-op visible effect on shapes** (no text in shape DOM), but the option is still written into shape's `options.fontSize`. | `[V1 line 11469-11475]` |
| 字体加粗 | 参数更新 | `el.updateOption('fontWeight', 'bolder', true)` — same no-op visible effect on shapes. | `[V1 line 11477-11483]` |
| 置于顶层 | 层级操作 | Sets shape's `zIndex` to `maxZ + 1`. | `[V1 line 11488-11496]` |
| 置于底层 | 层级操作 | Recalculates: selected shapes get `baseZ + i`, others shifted up. | `[V1 line 11497-11508]` |
| 上移一层 | 层级操作 | `zIndex = z + 1`. | `[V1 line 11509-11515]` |
| 下移一层 | 层级操作 | `zIndex = max(0, z - 1)`. | `[V1 line 11516-11522]` |
| 锁定元素 / 解锁元素 | (no group) | Toggles `options.positionLocked`. If locking, also force-sets `options.sizeLocked = true`. | `[V1 line 11525-11540]` |
| 左对齐 / 右对齐 / 顶对齐 / 底对齐 / 水平居中 / 垂直居中 | 对齐操作 | Shown only with ≥2 selected. Standard alignment via `panel.alignElements(op.type)`. | `[V1 line 11542-11566]` |
| 水平等距 / 垂直等距 | 对齐操作 | Shown only with ≥3 selected. | `[V1 line 11554-11557]` |
| 等宽 / 等高 | 对齐操作 | Shown only with ≥2 selected. Uses first selected as reference width/height; applies to all. **For hline this also writes height (ignored by hline’s width-locked-by-display)**. | `[V1 line 11569-11592]` |
| 删除选中元素 (N) | (danger) | Removes `designTarget` and splices `panel.printElements`. | `[V1 line 11596-11610]` |

---

## A — `hline` (横线 / horizontal line)

### A.1 Class hierarchy

`[V1 line 10282]`
```js
A = function (t) {
  function e(e, n) {
    var i = t.call(this, e) || this;
    return i.options = new g.a(n),
      i.options.setDefault(new g.a(p.a.instance.hline.default).getPrintElementOptionEntity()),
      i;
  }
  return L(e, t),
    e.prototype.updateDesignViewFromOptions = function () { ... },
    e.prototype.getConfigOptions = function () { return p.a.instance.hline; },
    e.prototype.createTarget = function (t, e) { ... },
    e.prototype.getReizeableShowPoints = function () { return ["e", "r"]; },
    e;
}(f.a),
```

- Extends `BasePrintElement` (`f.a`) via the typescript-style `L(e, t)` inheritance helper at `[V1 line 10261]`.
- Constructor takes `(printElementType, savedOptions)`; merges saved options on top of `p.a.instance.hline.default` (see A.2).
- **Does not override** `getHtml`. → Inherits `BasePrintElement.getHtml` `[V1 line 1126]` (single-condition pagination).
- Overrides `updateDesignViewFromOptions` `[V1 line 10288]`, `getConfigOptions` `[V1 line 10293]`, `createTarget` `[V1 line 10295]`, `getReizeableShowPoints` `[V1 line 10297]`.

### A.2 Default option values

`[V1 line 1325]` (`hiprint.config.js`)
```js
default: {
  borderWidth: 0.75,
  height: 9,
  width: 90
}
```

Note: `borderWidth: 0.75` is the **only** shape whose default is non-`undefined`.
The other three shapes default `borderWidth: undefined` and rely on the CSS
`border-left/border-top` rule for visible appearance.

### A.3 Options table

Reads in V1 class body: `this.options.field` (inherited via `getField`),
`this.options.transform`, `this.options.left`, `this.options.top`,
`this.options.width`, `this.options.height`, `this.options.borderWidth`,
`this.options.borderStyle`, `this.options.borderColor`, `this.options.zIndex`,
`this.options.pageBreak`, `this.options.showInPage`, `this.options.unShowInPage`,
`this.options.fixed`, `this.options.axis`, `this.options.positionLocked`,
`this.options.sizeLocked`, `this.options.draggable`, `this.options.coordinateSync`,
`this.options.widthHeightSync`.

| Field | Type | Default | Range / values | UI control | Renders as | V1 line — config | V1 line — option item / CSS |
|---|---|---|---|---|---|---|---|
| `width` | number (pt) | `90` | > 0 | `widthHeight` (paired input) | `<div>.css("width", N + "pt")` | `[V1 line 1328]` | `[V1 line 3680-3759]` widthHeight item |
| `height` | number (pt) | `9` | > 0 | `widthHeight` (paired input) | `<div>.css("height", N + "pt")` | `[V1 line 1327]` | `[V1 line 3680-3759]` widthHeight item |
| `left` | number (pt) | (panel-relative drop position) | ≥ 0 | `coordinate` (paired input) | `<div>.css("left", N + "pt")` | n/a (set on drop) | `[V1 line 3602-3678]` coordinate item |
| `top` | number (pt) | (panel-relative drop position) | ≥ 0 | `coordinate` (paired input) | `<div>.css("top", N + "pt")` | n/a | `[V1 line 3602-3678]` |
| `borderWidth` | number (pt) | `0.75` | `0.75`, `1.5`, `2.25`, `3`, `3.75`, `4.5`, `5.25`, `6`, `6.75` (UI presets) | `borderWidth` `<select>` | `border-width: Npt` (applied to `.hiprint-printElement-content` if found, else element) | `[V1 line 1326]` | `[V1 line 2879-2904]` definition, `[V1 line 2885]` shape-aware label "线宽" |
| `borderStyle` | string | (CSS default `solid`) | `""`, `solid`, `dashed`, `dotted` | `borderStyle` `<select>` | `border-style: <value>` | n/a | `[V1 line 4716-4738]`, `[V1 line 4729]` label "样式" |
| `borderColor` | string (CSS color) | (CSS default `#000`) | any minicolors value | `borderColor` `<input>` w/ minicolors | `border-color: <value>` | n/a | `[V1 line 3885-3912]`, `[V1 line 3900]` label "颜色" |
| `transform` | number (deg) | undefined | any number | `transform` `<input type=number>` | `transform: rotate(Ndeg)` on element OR its `.hiprint-printElement-content` parent | n/a | `[V1 line 4429-4454]` |
| `zIndex` | integer | undefined | any int | `zIndex` `<input type=number>` | `z-index: N` | n/a | `[V1 line 4456-4475]` |
| `pageBreak` | boolean | undefined | `true` only | `pageBreak` `<select>` (default / 是) | Print-time: forces page break before this element via `getHtml` branch `[V1 line 1151-1170]` | n/a | `[V1 line 4195-4214]` |
| `showInPage` | string | undefined | `""`, `none`, `first`, `odd`, `even`, `last` | `showInPage` `<select>` | Print-time gate via `BasePrintElement.showInPage` `[V1 line 692]`; `none` also adds `alwaysHide` class | n/a | `[V1 line 4173-4193]` |
| `fixed` | boolean | undefined | `true` / `false` | `fixed` `<select>` | When true, `isFixed()` short-circuits pagination (`getHtml` early-out at `[V1 line 1132]`) | n/a | `[V1 line 4327-4340]` |
| `axis` | string | undefined | `""`, `h`, `v` | `axis` `<select>` | Constrains drag direction via `hidraggable({ axis })` `[V1 line 856]` | n/a | `[V1 line 4342-4356]` |
| `positionLocked` | boolean | undefined | `true` / `false` | `coordinate`'s inline checkbox | `draggable=false` + hides delete btn + shows `🔒` badge | n/a | `[V1 line 3611]`, lock-state handler at `[V1 line 1008-1027]` |
| `sizeLocked` | boolean | undefined | `true` / `false` | `widthHeight`'s inline checkbox | Hides `.resizebtn` on `.resize-panel` | n/a | `[V1 line 3690]`, lock handler at `[V1 line 1016]` |
| `draggable` | boolean | (true unless positionLocked) | `true` / `false` | (no direct UI; derived from positionLocked) | Controls `hidraggable` enable | n/a | `[V1 line 855]` |
| `coordinateSync` | boolean | `false` | `true` / `false` | 🔗/🔓 toggle next to coordinate inputs | When true, editing one coordinate input mirrors the other | n/a | `[V1 line 3617]` |
| `widthHeightSync` | boolean | `false` | `true` / `false` | 🔗/🔓 toggle next to width/height inputs | Same idea, for width/height | n/a | `[V1 line 3696]` |

Hline does **not** read `backgroundColor`, `borderRadius`, `fillColor`,
`borderTop/Right/Bottom/Left`, `textType`, `fontSize`, `fontWeight`, or any
text/image option.

### A.4 Pre-built factory preset

`[V1 line 300-305]` (`default-etyps-provider.js`)
```js
{
  tid: "defaultModule.hline",
  title: "横线",
  type: "hline",
  icon: "ep:minus"
}
```

Lives in the `"辅助"` (auxiliary) print-element-type group. No additional
`options` block — fully relies on `hiprint.config.js` defaults.

### A.5 Property-panel sections rendered

`[V1 line 1220-1330]` (`hiprint.config.js` `instance.hline.tabs`):

| Tab | Options in order |
|---|---|
| **基础** (basics) | `coordinate`, `widthHeight`, `showInPage`, `fixed` |
| **样式** (style)  | `borderWidth`, `borderStyle`, `borderColor`, `transform`, `zIndex` |
| **高级** (advanced) | `pageBreak`, `axis` |

Compared to `rect`/`oval`, hline's 样式 tab **does NOT include `backgroundColor`** — a horizontal line has no fill.

`supportOptions` `[V1 line 1279-1324]` mirrors the union of the three tabs; this
is what `panel.supportOptions.filter(...)` at `[V1 line 12244]` uses to decide
which options to render when shapes are mixed-selected with other elements.

### A.6 Render output DOM

`[V1 line 10295-10296]`
```js
e.prototype.createTarget = function (t, e) {
  return $('<div class="hiprint-printElement hiprint-printElement-hline" style="border-top:1px solid;position: absolute;"></div>');
}
```

- Single empty `<div>` — **no SVG, no `<hr>`**.
- Inline style: `border-top:1px solid; position: absolute;`.
- The user-visible line is **the top border of the div**, not the div body. The
  div's `height` value (default 9pt) is just the click/select hit-box —
  visually only the 1-pixel top edge is drawn.
- After `createTarget`, the `BasePrintElement.getHtml` pipeline at `[V1 line 1138]`
  applies `width`/`height` via `updateTargetSize`, then iterates option items
  via `css()` `[V1 line 1237]` to push `border-width`/`border-style`/`border-color`
  onto the div.

### A.7 CSS classes applied (cumulative)

`hiprint-printElement` + `hiprint-printElement-hline` on the root div.

External CSS rules:

`[print-lock.css line 264-267]`
```css
.hiprint-printElement-vline, .hiprint-printElement-hline {
  border: 0px none rgb(0, 0, 0);
}
```

`[print-lock.css line 276-281]`
```css
.hiprint-printElement-hline {
  border-top: 0.75pt solid #000;
  border-right: 0px none rgb(0, 0, 0) !important;
  border-bottom: 0px none rgb(0, 0, 0) !important;
  border-left: 0px none rgb(0, 0, 0) !important;
}
```

`!important` on the three non-top borders means user-entered `borderWidth` /
`borderColor` / `borderStyle` only affect the **top border** — the other three
sides remain forced 0. This is the V1 mechanism that prevents an hline from
"becoming a box" when the user cranks up `borderWidth`.

Conditional classes added at runtime:
- `alwaysHide` — when `showInPage === 'none'`. Source: `[V1 line 4180]`.
- `locked` (on `.resize-panel` child) — when `positionLocked`. `[V1 line 1009]`
- `size-locked` / `position-locked` (on root) — for noContainer fallback path `[V1 line 923, 926]`. Not applicable to hline (it has a `.resize-panel`).

### A.8 Resize handles

`[V1 line 10297]`
```js
e.prototype.getReizeableShowPoints = function () { return ["e", "r"]; },
```

- `"e"` — east handle (right side). Resizes **width** only. Height stays constant.
- `"r"` — rotate handle.

**No "s" / "w" / "n" / corner handles** → user cannot resize height interactively.
Height can still be edited via the right-panel `widthHeight` numeric input.

### A.9 Interactions

#### A.9.1 Drag
Inherits `BasePrintElement.design` `[V1 line 851]`. Drag-axis can be constrained
via `options.axis` (`h` / `v` / default). Position is snapped to
`movingDistance` (instance config) via `hidraggable.minMove`.

Multi-select drag (≥2 selected): `[V1 line 858-878]` computes a relative delta
and applies it to every selected shape. The active dragged shape can be
unselected and still move via the `notSelected` branch at `[V1 line 873]`.

#### A.9.2 Resize
- East handle drags `width` only.
- Rotate handle calls `BasePrintElement.onRotate` `[V1 line 1120]` → `options.setRotate(angle)`. Visually applies `transform: rotate(Ndeg)` via the `transform` option item's `css()` `[V1 line 4434]`.

#### A.9.3 Inline edit
**None.** Double-click handler at `[V1 line 757]` gates on `printElementType.type == "text"` → false for hline. No `contenteditable` mode.

#### A.9.4 Field binding
- The `field` option survives JSON serialization (via `init` `[V1 line 655]` on `PrintElementOption`).
- Render path never consults `field` (no `getData` override; `createTarget` ignores data argument).
- Property panel has no `field` editor in any of hline's three tabs.
- → **Effectively no field binding for hline.** Setting it via JSON is a no-op for rendering.

#### A.9.5 Keyboard moves
`bingKeyboardMoveEvent` at `[V1 line 904]` is inherited. Arrow keys translate
the shape by `movingDistance` pt (config global, typically 1pt). Holds + ctrl
move all selected.

#### A.9.6 Copy / paste
- Keyboard copy/paste via `bingCopyEvent` at `[V1 line 904]`.
- Context-menu 复制/粘贴 path stores `panel._contextCopyElements` and re-instantiates via `srcEl.clone()` with `+10pt` offset `[V1 line 11448-11458]`.

#### A.9.7 Click vs list-click
`[V1 line 744-756]` distinguishes `ev._listOnlySelect` (set by the
element-list panel’s `triggerHandler` at `[V1 line 823]`) from real canvas
clicks. List clicks just select; canvas clicks trigger the property-panel
event `[V1 line 752]`.

### A.10 Pagination behavior (key difference from rect/oval/vline)

**Hline does not override `getHtml`** — it inherits `BasePrintElement.getHtml`
`[V1 line 1126]`. That implementation checks ONLY the first condition
`r > a && "none" != t.panelPageRule` at `[V1 line 1132]`.

It does **NOT** include the second `getHtml2` condition `r <= a && e && r + height > a`
at `[V1 line 1183]`. Consequence: when an hline is positioned just above the
page footer such that `top + height` would cross the footer, **hline does NOT
force an additional page break** — the second visible page break only fires
for vline/rect/oval.

In practice this is rarely user-visible because hline default `height` is only
9pt, but it matters when a user manually grows the hline's height for hit-box
reasons.

### A.11 Lock behavior

- `positionLocked === true`:
  - `design()` initial pass at `[V1 line 906-928]` adds `locked` class to `.resize-panel`, inserts `<div class="hiprint-lock-badge">🔒</div>`, hides `.del-btn`, hides `.resizebtn`.
  - `submitOption()` post-change path at `[V1 line 996-1027]` mirrors the same.
  - `hidraggable('update', {draggable: false})` `[V1 line 1004]`.
- `sizeLocked === true`:
  - Hides `.resizebtn` only; drag still works.
- Locking position **auto-locks size**: context menu lock handler `[V1 line 11533]`
  `if (newVal) el.options.sizeLocked = true`. Unlocking does NOT auto-unlock size.

### A.12 V1 quirks

- **Default width 90pt vs height 9pt** — height represents click target; user-perceived "line thickness" is governed entirely by `borderWidth` (default 0.75pt). Naive users who try to make a "thicker line" by editing height get no visual change.
- **`!important` on the non-active borders** means you cannot make an hline have left/right/bottom borders even by writing `options.borderLeft`/`borderBottom` directly — print-lock.css always wins.
- **Inherited `getHtml` (not `getHtml2`)** means hline behaves slightly differently from the other three shapes on the page-overflow edge case. Likely an unintended inconsistency; documented for parity.
- **`field` survives in JSON but is a no-op at render** — confusing if developers try to bind data to a shape.
- **Context menu’s 字体 12pt and 字体加粗 items** write `fontSize` / `fontWeight` onto a shape with no visible effect; harmless but noisy.

---

## B — `vline` (竖线 / vertical line)

### B.1 Class hierarchy

`[V1 line 10240]`
```js
F = function (t) {
  function e(e, n) {
    var i = t.call(this, e) || this;
    return i.options = new g.a(n),
      i.options.setDefault(new g.a(p.a.instance.vline.default).getPrintElementOptionEntity()),
      i;
  }
  return B(e, t),
    e.prototype.updateDesignViewFromOptions = function () { ... },
    e.prototype.getConfigOptions = function () { return p.a.instance.vline; },
    e.prototype.createTarget = function (t, e) { ... },
    e.prototype.getReizeableShowPoints = function () { return ["s", "r"]; },
    e.prototype.getHtml = function (t, e, n) { return this.getHtml2(t, e, n); },
    e;
}(f.a),
```

- Extends `BasePrintElement` (`f.a`).
- **Overrides `getHtml`** to delegate to `getHtml2` `[V1 line 10257-10259]` — *opposite* of hline (which inherits the base `getHtml`).
- Constructor identical pattern to hline; defaults merge from `p.a.instance.vline.default`.

### B.2 Default option values

`[V1 line 1436]` (`hiprint.config.js`)
```js
default: {
  borderWidth: undefined,
  height: 90,
  width: 9
}
```

- `borderWidth: undefined` — unlike hline. With no inline `borderWidth`, the
  `border-left: 0.75pt solid #000` from `print-lock.css line 269-274` provides
  the visual line. When user sets a non-undefined value via the panel,
  inline `border-width: Npt` overrides it.
- `height: 90`, `width: 9` — mirror of hline (90/9 → 9/90).

### B.3 Options table

Same field set as hline. Differences:
- `width` default `9`, `height` default `90`.
- `borderWidth` default `undefined`.

| Field | Type | Default | Range | UI | Renders | V1 line — config | V1 line — option item |
|---|---|---|---|---|---|---|---|
| `width` | number (pt) | `9` | > 0 | `widthHeight` | `width: Npt` | `[V1 line 1439]` | `[V1 line 3680-3759]` |
| `height` | number (pt) | `90` | > 0 | `widthHeight` | `height: Npt` | `[V1 line 1438]` | `[V1 line 3680-3759]` |
| `left` | number (pt) | drop | ≥0 | `coordinate` | `left: Npt` | n/a | `[V1 line 3602-3678]` |
| `top` | number (pt) | drop | ≥0 | `coordinate` | `top: Npt` | n/a | `[V1 line 3602-3678]` |
| `borderWidth` | number (pt) | `undefined` | preset `0.75`–`6.75` | `borderWidth` select | `border-width: Npt` | `[V1 line 1437]` | `[V1 line 2879-2904]`, label `线宽` `[V1 line 2885]` |
| `borderStyle` | string | undefined | `solid`/`dashed`/`dotted` | `borderStyle` select | `border-style: <v>` | n/a | `[V1 line 4716-4738]`, label `样式` `[V1 line 4729]` |
| `borderColor` | string | undefined | minicolors value | `borderColor` minicolors | `border-color: <v>` | n/a | `[V1 line 3885-3912]`, label `颜色` `[V1 line 3900]` |
| `transform` | number (deg) | undefined | any | `transform` input | `transform: rotate(Ndeg)` | n/a | `[V1 line 4429-4454]` |
| `zIndex` | int | undefined | any | `zIndex` input | `z-index: N` | n/a | `[V1 line 4456-4475]` |
| `pageBreak` | bool | undefined | `true` | `pageBreak` select | Force break via `getHtml2` `[V1 line 1203]` | n/a | `[V1 line 4195-4214]` |
| `showInPage` | string | undefined | `none`/`first`/`odd`/`even`/`last` | `showInPage` select | Print-time gating | n/a | `[V1 line 4173-4193]` |
| `fixed` | bool | undefined | `true`/`false` | `fixed` select | Disables pagination | n/a | `[V1 line 4327-4340]` |
| `axis` | string | undefined | `h`/`v` | `axis` select | Drag constraint | n/a | `[V1 line 4342-4356]` |
| `positionLocked` | bool | undefined | t/f | coordinate checkbox | Drag off + 🔒 | n/a | `[V1 line 3611]` |
| `sizeLocked` | bool | undefined | t/f | widthHeight checkbox | Hide resize dots | n/a | `[V1 line 3690]` |
| `coordinateSync` | bool | `false` | t/f | 🔗 toggle | Coord input sync | n/a | `[V1 line 3617]` |
| `widthHeightSync` | bool | `false` | t/f | 🔗 toggle | W/H input sync | n/a | `[V1 line 3696]` |

Vline does **not** read `backgroundColor`, `borderRadius`, `fillColor`.

### B.4 Pre-built factory preset

`[V1 line 306-311]` (`default-etyps-provider.js`)
```js
{
  tid: "defaultModule.vline",
  title: "竖线",
  type: "vline",
  icon: "ep:more-filled"
}
```

In the `"辅助"` group. No extra options.

### B.5 Property-panel sections

`[V1 line 1331-1441]` (`hiprint.config.js` `instance.vline`):

| Tab | Options |
|---|---|
| **基础** | `coordinate`, `widthHeight`, `showInPage`, `fixed` |
| **样式** | `borderWidth`, `borderStyle`, `borderColor`, `transform`, `zIndex` |
| **高级** | `pageBreak`, `axis` |

**Identical** option lists to hline. The only structural difference between
hline and vline is the resize-handle set (B.8) and the default size + the
`getHtml`/`getHtml2` override.

`supportOptions` `[V1 line 1390-1434]` matches the union of the three tabs.

### B.6 Render output DOM

`[V1 line 10254]`
```js
return $('<div class="hiprint-printElement hiprint-printElement-vline" style="border-left:1px solid;position: absolute;"></div>');
```

- Empty `<div>`.
- Inline style: `border-left:1px solid; position:absolute;`.
- The visible line is the **left border**, hit-box is the full div.

### B.7 CSS classes

`hiprint-printElement` + `hiprint-printElement-vline`.

`[print-lock.css line 264-267]`
```css
.hiprint-printElement-vline, .hiprint-printElement-hline {
  border: 0px none rgb(0, 0, 0);
}
```

`[print-lock.css line 269-274]`
```css
.hiprint-printElement-vline {
  border-left: 0.75pt solid #000;
  border-right: 0px none rgb(0, 0, 0) !important;
  border-bottom: 0px none rgb(0, 0, 0) !important;
  border-top: 0px none rgb(0, 0, 0) !important;
}
```

Same `!important`-mirror trick as hline, but on the left edge.

Conditional classes: `alwaysHide` (showInPage=none), `locked` (positionLocked) — same as hline.

### B.8 Resize handles

`[V1 line 10255]`
```js
e.prototype.getReizeableShowPoints = function () { return ["s", "r"]; }
```

- `"s"` — south handle (bottom). Resizes **height** only. Width stays constant.
- `"r"` — rotate handle.

Inverse of hline (which had `["e", "r"]`). No corner handles, no west/east — user cannot resize width interactively.

### B.9 Interactions

Same suite as hline (A.9.1–A.9.7):
- Drag inherits `BasePrintElement.design`.
- Inline edit: **none** (text-only feature).
- Field binding: **field option survives in JSON but no-op at render**.
- Keyboard arrows: move by `movingDistance` pt.
- Copy/paste: keyboard + context menu, `+10pt` offset.

### B.10 Pagination

Vline overrides `getHtml` to call `getHtml2` `[V1 line 10257-10259]`. So vline
DOES apply the second condition at `[V1 line 1183]` (forces a page break when
`r + height > a`). This matters when a tall vline is dropped near the page
footer — V1 will push it to the next page rather than clipping.

### B.11 Lock behavior

Identical to hline (A.11). `positionLocked` adds `🔒` badge to
`.resize-panel`, hides `.del-btn`, hides `.resizebtn`. Context-menu lock toggle
auto-sets `sizeLocked = true` when locking.

### B.12 V1 quirks

- **Default width 9pt vs height 90pt** — mirror of hline. "Line thickness" actually controlled by `borderWidth`, not `width`.
- **`getHtml` delegates to `getHtml2`** — opposite of hline. Documented inconsistency.
- **Default `borderWidth: undefined`** vs hline's `0.75`. End-user-visible appearance is identical (both render at 0.75pt thanks to `print-lock.css`), but the JSON differs.
- **`!important` mirror** means cranking `borderWidth` makes the visible left edge thicker without ever drawing a right/top/bottom border.

---

## C — `rect` (矩形 / rectangle)

### C.1 Class hierarchy

`[V1 line 10322]`
```js
k = function (t) {
  function e(e, n) {
    var i = t.call(this, e) || this;
    return i.options = new g.a(n),
      i.options.setDefault(new g.a(p.a.instance.rect.default).getPrintElementOptionEntity()),
      i;
  }
  return z(e, t),
    e.prototype.updateDesignViewFromOptions = function () { ... },
    e.prototype.getConfigOptions = function () { return p.a.instance.rect; },
    e.prototype.createTarget = function (t, e) { ... },
    e.prototype.getHtml = function (t, e, n) { return this.getHtml2(t, e, n); },
    e;
}(f.a),
```

- Extends `BasePrintElement`.
- Overrides `getHtml` → `getHtml2`.
- **Does NOT override** `getReizeableShowPoints` — inherits base default (section 0.8) → `["s","w","e","r"]`.

### C.2 Default option values

`[V1 line 1555]` (`hiprint.config.js`)
```js
default: {
  borderWidth: undefined,
  height: 90,
  width: 90
}
```

Square by default (90pt × 90pt). `borderWidth: undefined` — relies on
`print-lock.css line 283-285` for the visible 0.75pt border.

### C.3 Options table

Adds `backgroundColor` over hline/vline. Same coordinate/size/transform/zIndex/pageBreak/showInPage/fixed/axis/locks.

| Field | Type | Default | Range | UI | Renders | V1 line — config | V1 line — option item |
|---|---|---|---|---|---|---|---|
| `width` | number (pt) | `90` | > 0 | `widthHeight` | `width: Npt` | `[V1 line 1558]` | `[V1 line 3680-3759]` |
| `height` | number (pt) | `90` | > 0 | `widthHeight` | `height: Npt` | `[V1 line 1557]` | `[V1 line 3680-3759]` |
| `left` | number (pt) | drop | ≥0 | `coordinate` | `left: Npt` | n/a | `[V1 line 3602-3678]` |
| `top` | number (pt) | drop | ≥0 | `coordinate` | `top: Npt` | n/a | `[V1 line 3602-3678]` |
| `borderWidth` | number (pt) | `undefined` | preset `0.75`–`6.75` | `borderWidth` select | `border-width: Npt` (all 4 sides) | `[V1 line 1556]` | `[V1 line 2879-2904]`, label `线宽` |
| `borderStyle` | string | undefined | `solid`/`dashed`/`dotted` | `borderStyle` select | `border-style: <v>` | n/a | `[V1 line 4716-4738]`, label `样式` |
| `borderColor` | string | undefined | minicolors | `borderColor` input | `border-color: <v>` | n/a | `[V1 line 3885-3912]`, label `颜色` |
| `backgroundColor` | string | undefined | minicolors | `backgroundColor` input | `background-color: <v>` | n/a | `[V1 line 4740-4760]` |
| `transform` | number (deg) | undefined | any | `transform` input | `transform: rotate(Ndeg)` | n/a | `[V1 line 4429-4454]` |
| `zIndex` | int | undefined | any | `zIndex` input | `z-index: N` | n/a | `[V1 line 4456-4475]` |
| `pageBreak` | bool | undefined | `true` | `pageBreak` select | Force break | n/a | `[V1 line 4195-4214]` |
| `showInPage` | string | undefined | enum | `showInPage` select | Print-time gate | n/a | `[V1 line 4173-4193]` |
| `fixed` | bool | undefined | `true`/`false` | `fixed` select | Disable pagination | n/a | `[V1 line 4327-4340]` |
| `axis` | string | undefined | `h`/`v` | `axis` select | Drag constraint | n/a | `[V1 line 4342-4356]` |
| `positionLocked` | bool | undefined | t/f | coord checkbox | Drag off + 🔒 | n/a | `[V1 line 3611]` |
| `sizeLocked` | bool | undefined | t/f | wh checkbox | Hide resize dots | n/a | `[V1 line 3690]` |
| `coordinateSync` | bool | `false` | t/f | 🔗 toggle | Coord sync | n/a | `[V1 line 3617]` |
| `widthHeightSync` | bool | `false` | t/f | 🔗 toggle | W/H sync | n/a | `[V1 line 3696]` |

`borderRadius` option item EXISTS in V1 (`[V1 line 4477-4498]` defines the
`borderRadius` option class) but is **NOT registered** in `rect.tabs` or
`rect.supportOptions` in `hiprint.config.js`. Consequence: there is **no UI
field** to edit `borderRadius` for a rect in V1. A value can still be written
into `options.borderRadius` via raw JSON edits and `css()` `[V1 line 1237]`
would dispatch it if registered, but with no tab entry the property never
flows through the panel.

Rect does **not** read `fillColor`, `borderTop/Right/Bottom/Left`, `textType`,
`fontSize`, `fontWeight`, image options.

### C.4 Pre-built factory preset

`[V1 line 312-317]` (`default-etyps-provider.js`)
```js
{
  tid: "defaultModule.rect",
  title: "矩形",
  type: "rect",
  icon: "ep:crop"
}
```

In the `"辅助"` group. No extra options.

### C.5 Property-panel sections

`[V1 line 1442-1560]`:

| Tab | Options |
|---|---|
| **基础** | `coordinate`, `widthHeight`, `showInPage`, `fixed` |
| **样式** | `borderWidth`, `borderStyle`, `borderColor`, **`backgroundColor`**, `transform`, `zIndex` |
| **高级** | `pageBreak`, `axis` |

**Difference vs hline/vline**: the 样式 tab adds **`backgroundColor`** between
`borderColor` and `transform`. This is the only structural difference in the
property panel between rect and hline/vline.

`supportOptions` `[V1 line 1505-1553]` — same set extended with `backgroundColor`.

### C.6 Render output DOM

`[V1 line 10335-10336]`
```js
e.prototype.createTarget = function (t, e) {
  return $('<div class="hiprint-printElement hiprint-printElement-rect" style="border:1px solid;position: absolute;"></div>');
};
```

- Empty `<div>`.
- Inline style: `border:1px solid; position: absolute;` — all four borders
  active (vs hline's `border-top` only and vline's `border-left` only).
- No SVG, no canvas.

### C.7 CSS classes

`hiprint-printElement` + `hiprint-printElement-rect`.

`[print-lock.css line 283-285]`
```css
.hiprint-printElement-oval, .hiprint-printElement-rect {
  border: 0.75pt solid #000;
}
```

Note: **rect & oval share the same external CSS rule** (`border: 0.75pt solid #000`).
There are no `!important` modifiers like hline/vline, so user-entered
`borderWidth`/`borderColor`/`borderStyle` override cleanly.

Conditional classes: same as hline (`alwaysHide`, `locked`).

### C.8 Resize handles

Inherits `BasePrintElement.getReizeableShowPoints` `[V1 line 1092]` →
`["s","w","e","r"]` (no override). South, west, east, rotate. **No `n`
(north), `ne`, `nw`, `se`, `sw` handles** — the design lets users drag the
rect's right/bottom/left edges but not top edge or corners.

### C.9 Interactions

Same as hline/vline (A.9.1–A.9.7):
- Drag via inherited `design()`.
- No inline edit.
- `field` is no-op for rendering.
- Keyboard arrows + copy/paste behave identically.

### C.10 Pagination

Rect overrides `getHtml` → `getHtml2` `[V1 line 10337-10339]`. So rect applies
both the first and the second page-break conditions (overflow into footer
forces a page break). Same behavior as vline / oval.

### C.11 Lock behavior

Same lock semantics as hline/vline. `positionLocked` → adds 🔒 badge,
disables drag, hides delete. `sizeLocked` → hides resize dots. Locking
position auto-locks size via context menu `[V1 line 11533]`.

### C.12 V1 quirks

- **No `borderRadius` UI**: the rect cannot be made into a rounded-rect through the V1 property panel. Manual JSON edit can set `options.borderRadius` but with no tab entry it’s not iterated by `css()` `[V1 line 1244]`, so the value never reaches the DOM.
- **No top edge resize handle**: dragging the rect's top requires using the `coordinate` numeric inputs in the right panel; cannot grab the top edge with the mouse.
- **Square default**: width === height === 90pt. Users dragging the south handle alone produce a tall rectangle; dragging east alone produces a wide rectangle.
- **Shared default-border CSS with oval** but `border-radius: 50%` makes oval round; rect stays rectangular.
- **Context menu 字体 12pt / 字体加粗 items** write into `options.fontSize` / `options.fontWeight` with no visible effect — same noise as hline/vline.

---

## D — `oval` (椭圆 / oval)

### D.1 Class hierarchy

`[V1 line 10362]`
```js
V = function (t) {
  function e(e, n) {
    var i = t.call(this, e) || this;
    return i.options = new g.a(n),
      i.options.setDefault(new g.a(p.a.instance.oval.default).getPrintElementOptionEntity()),
      i;
  }
  return N(e, t),
    e.prototype.updateDesignViewFromOptions = function () { ... },
    e.prototype.getConfigOptions = function () { return p.a.instance.oval; },
    e.prototype.createTarget = function (t, e) { ... },
    e.prototype.getHtml = function (t, e, n) { return this.getHtml2(t, e, n); },
    e;
}(f.a),
```

- Extends `BasePrintElement`.
- Overrides `getHtml` → `getHtml2`.
- **Does NOT override** `getReizeableShowPoints` — inherits base default → `["s","w","e","r"]`. Identical to rect.

### D.2 Default option values

`[V1 line 1674]` (`hiprint.config.js`)
```js
default: {
  borderWidth: undefined,
  height: 90,
  width: 90
}
```

Identical to rect: 90 × 90, `borderWidth: undefined`.

### D.3 Options table

Identical to rect (C.3). Adds `backgroundColor` over hline/vline. No additional fields specific to oval (no `radiusX`/`radiusY` — the round shape comes purely from CSS `border-radius: 50%`).

| Field | Type | Default | Range | UI | Renders | V1 line — config | V1 line — option item |
|---|---|---|---|---|---|---|---|
| `width` | number (pt) | `90` | > 0 | `widthHeight` | `width: Npt` | `[V1 line 1677]` | `[V1 line 3680-3759]` |
| `height` | number (pt) | `90` | > 0 | `widthHeight` | `height: Npt` | `[V1 line 1676]` | `[V1 line 3680-3759]` |
| `left` | number (pt) | drop | ≥0 | `coordinate` | `left: Npt` | n/a | `[V1 line 3602-3678]` |
| `top` | number (pt) | drop | ≥0 | `coordinate` | `top: Npt` | n/a | `[V1 line 3602-3678]` |
| `borderWidth` | number (pt) | `undefined` | preset `0.75`–`6.75` | `borderWidth` select | `border-width: Npt` | `[V1 line 1675]` | `[V1 line 2879-2904]` |
| `borderStyle` | string | undefined | `solid`/`dashed`/`dotted` | `borderStyle` select | `border-style: <v>` | n/a | `[V1 line 4716-4738]` |
| `borderColor` | string | undefined | minicolors | `borderColor` input | `border-color: <v>` | n/a | `[V1 line 3885-3912]` |
| `backgroundColor` | string | undefined | minicolors | `backgroundColor` input | `background-color: <v>` | n/a | `[V1 line 4740-4760]` |
| `transform` | number (deg) | undefined | any | `transform` input | `transform: rotate(Ndeg)` | n/a | `[V1 line 4429-4454]` |
| `zIndex` | int | undefined | any | `zIndex` input | `z-index: N` | n/a | `[V1 line 4456-4475]` |
| `pageBreak` | bool | undefined | `true` | `pageBreak` select | Force break | n/a | `[V1 line 4195-4214]` |
| `showInPage` | string | undefined | enum | `showInPage` select | Print-time gate | n/a | `[V1 line 4173-4193]` |
| `fixed` | bool | undefined | `true`/`false` | `fixed` select | Disable pagination | n/a | `[V1 line 4327-4340]` |
| `axis` | string | undefined | `h`/`v` | `axis` select | Drag constraint | n/a | `[V1 line 4342-4356]` |
| `positionLocked` | bool | undefined | t/f | coord checkbox | Drag off + 🔒 | n/a | `[V1 line 3611]` |
| `sizeLocked` | bool | undefined | t/f | wh checkbox | Hide resize dots | n/a | `[V1 line 3690]` |
| `coordinateSync` | bool | `false` | t/f | 🔗 toggle | Coord sync | n/a | `[V1 line 3617]` |
| `widthHeightSync` | bool | `false` | t/f | 🔗 toggle | W/H sync | n/a | `[V1 line 3696]` |

### D.4 Pre-built factory preset

`[V1 line 318-323]` (`default-etyps-provider.js`)
```js
{
  tid: "defaultModule.oval",
  title: "椭圆",
  type: "oval",
  icon: "ep:aim"
}
```

In the `"辅助"` group. No extra options.

### D.5 Property-panel sections

`[V1 line 1561-1679]`:

| Tab | Options |
|---|---|
| **基础** | `coordinate`, `widthHeight`, `showInPage`, `fixed` |
| **样式** | `borderWidth`, `borderStyle`, `borderColor`, **`backgroundColor`**, `transform`, `zIndex` |
| **高级** | `pageBreak`, `axis` |

**Identical** to rect's tab structure. The only difference between oval and
rect is the inline `border-radius: 50%` in the DOM — there is no
oval-specific option.

`supportOptions` `[V1 line 1624-1672]` — same set as rect's.

### D.6 Render output DOM

`[V1 line 10375-10376]`
```js
e.prototype.createTarget = function (t, e) {
  return $('<div class="hiprint-printElement hiprint-printElement-oval" style="border:1px solid;position: absolute;border-radius: 50%;"></div>');
};
```

- Empty `<div>`.
- Inline style: `border:1px solid; position: absolute; border-radius: 50%;`.
- **`border-radius: 50%` is the only thing that distinguishes oval from rect at the DOM level.**
- A square (width === height) renders as a perfect circle; non-square renders as a stretched ellipse.

### D.7 CSS classes

`hiprint-printElement` + `hiprint-printElement-oval`.

`[print-lock.css line 283-285]`
```css
.hiprint-printElement-oval, .hiprint-printElement-rect {
  border: 0.75pt solid #000;
}
```

Shared with rect. No `!important` modifiers.

Conditional classes: `alwaysHide`, `locked` — same as the other shapes.

### D.8 Resize handles

Inherits base default `["s","w","e","r"]` `[V1 line 1092]`. Identical to rect.
No north handle, no corners. Resizing south or east stretches the ellipse
non-uniformly (no aspect-ratio lock).

### D.9 Interactions

Same as hline/vline/rect:
- Drag inherits `BasePrintElement.design`.
- No inline edit.
- `field` no-op for rendering.
- Keyboard / copy / paste / context-menu identical.

Selecting the oval and resizing south + east together (sequentially) produces
ellipses — there is no V1 affordance for "lock to circle" beyond using the
🔗 width/height sync toggle in the `widthHeight` panel.

### D.10 Pagination

Oval overrides `getHtml` → `getHtml2` `[V1 line 10377-10379]`. Same as
rect/vline — applies both first and second page-break conditions.

### D.11 Lock behavior

Same as hline/vline/rect.

### D.12 V1 quirks

- **No aspect-ratio lock**: dragging south or east independently produces a stretched ellipse. User needs to manually equalize width and height (or activate the `widthHeightSync` 🔗 toggle in the `widthHeight` field before resizing via numeric inputs).
- **`border-radius: 50%` is inline-styled** in `createTarget`, not in print-lock.css. This means the oval's roundness is "baked in" the moment `createTarget` runs — cannot be undone by an option toggle.
- **No `borderRadius` option in oval's tabs** (same as rect). User cannot make an oval into a "less round" rect via the panel.
- **Background color fills the bounding rect, not the ellipse interior**: V1 sets `background-color` on the outer `<div>`, which has the rectangular hit-box; the visible shape is the elliptical clip from `border-radius: 50%`. CSS `background-color` follows the rounded border in modern browsers, so the visible fill IS elliptical — but historically older browsers showed rectangular fill. Not a V1 bug per se, but a behavior worth flagging.
- **Same context-menu noise** as the other shapes: 字体 12pt / 字体加粗 work but have no visible effect.

---

## E — Cross-shape comparison summary

### E.1 Class extension chain

| Shape | Symbol | Extends | Override `getHtml`? | Override `getReizeableShowPoints`? | `createTarget` returns |
|---|---|---|---|---|---|
| `hline` | `A` | `BasePrintElement` | **No** (inherits base) | `["e","r"]` | `<div class="hiprint-printElement hiprint-printElement-hline" style="border-top:1px solid;position: absolute;">` |
| `vline` | `F` | `BasePrintElement` | Yes → `getHtml2` | `["s","r"]` | `<div class="hiprint-printElement hiprint-printElement-vline" style="border-left:1px solid;position: absolute;">` |
| `rect` | `k` | `BasePrintElement` | Yes → `getHtml2` | (inherits `["s","w","e","r"]`) | `<div class="hiprint-printElement hiprint-printElement-rect" style="border:1px solid;position: absolute;">` |
| `oval` | `V` | `BasePrintElement` | Yes → `getHtml2` | (inherits `["s","w","e","r"]`) | `<div class="hiprint-printElement hiprint-printElement-oval" style="border:1px solid;position: absolute;border-radius: 50%;">` |

### E.2 Default sizes / borderWidth

| Shape | width | height | borderWidth | V1 line |
|---|---|---|---|---|
| `hline` | 90 | 9 | **0.75** | `[V1 line 1325-1329]` |
| `vline` | 9 | 90 | `undefined` | `[V1 line 1436-1440]` |
| `rect`  | 90 | 90 | `undefined` | `[V1 line 1555-1559]` |
| `oval`  | 90 | 90 | `undefined` | `[V1 line 1674-1678]` |

### E.3 Property-panel "样式" tab options

| Shape | borderWidth | borderStyle | borderColor | backgroundColor | transform | zIndex |
|---|---|---|---|---|---|---|
| `hline` | ✅ | ✅ | ✅ | — | ✅ | ✅ |
| `vline` | ✅ | ✅ | ✅ | — | ✅ | ✅ |
| `rect`  | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `oval`  | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### E.4 Rendering strategy

**All four shapes use CSS-styled `<div>` — no SVG, no canvas, no `<hr>` / `<svg>` element.**

- `hline` — `<div>` with `border-top` only (other sides forced `0px !important` via print-lock.css).
- `vline` — `<div>` with `border-left` only (other sides forced `0px !important` via print-lock.css).
- `rect`  — `<div>` with all four borders active (print-lock.css `border: 0.75pt solid #000`).
- `oval`  — same as `rect` plus inline `border-radius: 50%`.

This means:
- The shapes share their entire interaction layer (`BasePrintElement.design` / `setResizePanel` / `submitOption`) with text/image/longText.
- The shapes carry the standard `.resize-panel` overlay (with delete button, resize dots, lock badge).
- Rotation works for all four via CSS `transform: rotate(Ndeg)` applied to the root element.
- The `field` option is structurally available but render-time meaningless (no `getData` consumption).

### E.5 Pre-built factory grouping

All four shapes live in the **`"辅助"`** (auxiliary) `PrintElementTypeGroup`,
declared at `[V1 line 299-359]` of `default-etyps-provider.js`. The group also
contains `barcode` and `qrcode`. None of the four shapes carries any extra
`options` block in the factory entry — they all rely entirely on
`hiprint.config.js` defaults.

### E.6 Inserter helpers on `PrintTemplate`

- `addPrintHline(t)` `[V1 line 11338]`
- `addPrintVline(t)` `[V1 line 11336]`
- `addPrintRect(t)`  `[V1 line 11340]`
- `addPrintOval(t)`  `[V1 line 11342]`

Each one stamps `t.printElementType.type` to the shape type and calls
`this.insertPrintElementToPanel(t)`. These four helpers exist as
programmatic equivalents of dragging the corresponding factory tile from the
toolbar.

---

## F — Out-of-scope notes (for completeness, sourced)

- **Adsorb / snap lines** at `[V1 line 7495]` and `[V1 line 7515]` apply to shape drags the same as any element; they use `HIPRINT_CONFIG.adsorbLineMin` and `adsorbMin`.
- **Pagination panel-level rule** `panelPageRule === 'none'` (configured per-panel, not per-shape) at `[V1 line 1183, 1189, 1225]` causes vline/rect/oval to grow the panel rather than break.
- **`isHeaderOrFooter()` and `isFixed()`** at `[V1 line 1132]` and `[V1 line 1179]` are not implemented in the shape classes; they’re inherited from `BasePrintElement`. A shape can be placed in a `header`/`footer` panel and will be excluded from pagination logic.
- **`updateDesignViewFromOptions`** is overridden identically in all four shapes `[V1 line 10246, 10288, 10328, 10368]` — they all call `this.css(this.designTarget, this.getData())`. This is what makes a property-panel edit immediately reflect on the canvas.
