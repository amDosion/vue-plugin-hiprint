# V1 Inventory — `image` & `html` 元素类型完整行为基线

> **来源**: `src/hiprint/hiprint.bundle.js` (15353 行) + `src/hiprint/hiprint.config.js` (2254 行) + `src/hiprint/etypes/default-etyps-provider.js` (447 行)
> **范围**: 仅这两个 etype 的"用户可见行为"。每一条 claim 标 `[V1 line N]`。
> **用法**: 任何 V3 重写在 image / html 上,DOM 结构、option key、属性面板项、回调时序必须与本文件逐字段对照。
> **注**: V1 base class `BasePrintElement` 行为 (拖拽 / 缩放 / 键盘 / 选中 / contextmenu) 在 image 和 html 两个 etype 上共享 — 这部分一次性写在 Section F 末尾"共享行为"小节,避免冗余,但每条仍带 `[V1 line N]`。

---

## 概览

V1 把所有元素的实现拆为三层 (定义见 `[V1 line 10523]` 工厂函数 `W.createPrintElement`):

| 层 | 文件/类 | 角色 | image | html |
|---|---|---|---|---|
| 类型注册 (`PrintElementType`) | `j` `[V1 line 10526–10560]` | 提供 `tid` / `title` / `field` / `formatter` / `data` / `icon` 等模板级元数据 | `defaultModule.image` `[provider line 32]` | `defaultModule.html` `[provider line 133]` |
| 元素实例 (`PrintElement`) | `v` `[V1 line 9260–9294]` (image); `S` `[V1 line 10183–10218]` (html) | 创建实际 DOM / 持有 options / 实现 render | `v extends f.a` `[V1 line 9294]` | `S extends f.a` `[V1 line 10218]` |
| 选项实体 (`PrintElementOption`) | `g.a` `[V1 line 397+]` 基类; image 用 `g.a` 自身 `[V1 line 9263]`; html 用 `R extends g.a` `[V1 line 10155–10161]` | 持有 `left/top/width/height/field/src/fit/...` 字段 | `new g.a(n)` `[V1 line 9263]` | `new R(n)` `[V1 line 10186]` |

**派遣表 `[V1 line 10523]`**:
```js
return "text" == t.type ? new D(t, e)
     : "image" == t.type ? new v(t, e)        //  ←  image
     : "longText" == t.type ? new w(t, e)
     : "table" == t.type ? new d.a(t, e)
     : "html" == t.type ? new S(t, e)         //  ←  html
     : "vline" == t.type ? new F(t, e) : ... ;
```

**SUPPORTED_ELEMENT_TYPES** `[V1 line 10660]`: `['text', 'image', 'longText', 'table', 'barcode', 'qrcode', 'hline', 'vline', 'rect', 'oval', 'html']` — image 与 html 都在白名单。

---

# Part 1 — `image` 元素类型

## A. 类层级 (image)

### A.1 类标识

- **JS class symbol**: `v` `[V1 line 9260]` (webpack 压缩后短名)
- **未压缩等价名 (来自上游 src)**: `ImagePrintElement`
- **DOM 类名**: `hiprint-printElement-image` (位于元素根 `<div>`) `[V1 line 9274]`
- **内容容器类名**: `hiprint-printElement-image-content` `[V1 line 9274]`
- **派生关系**: `v extends f.a` `[V1 line 9294]` — 即 `extends BasePrintElement` (`[V1 line 676]`)

### A.2 构造函数 (image)

```js
// [V1 line 9260–9264]
v = function (t) {
  function e(e, n) {
    var i = t.call(this, e) || this;
    return i.options = new g.a(n),
           i.options.setDefault(
             new g.a(p.a.instance.image.default).getPrintElementOptionEntity()
           ),
           i;
  }
  // ...
}(f.a)
```

- 参数 1 `e` (实际名 `t` in superclass call): `PrintElementType` 实例 — 即注册的 `defaultModule.image` `[V1 line 9261]`
- 参数 2 `n`: 业务方传入的 element-instance options (left/top/width/height/src/field/...) `[V1 line 9263]`
- 行为:
  1. 调用 `BasePrintElement` 构造: 保存 `this.printElementType = t`, 生成 `this.id = guid()` `[V1 line 678]`
  2. 创建 `g.a` (PrintElementOption) 实例 `[V1 line 9263]`
  3. 把 `p.a.instance.image.default` (即 `HIPRINT_CONFIG.image.default = {}` `[config line 615]`) 作为默认值合并 `[V1 line 9263]`
  4. `setDefault` 内部把 default 里每个 key 用 `||` 回填到 self `[V1 line 568–570]` (注意: `||` 而非 `??`,因此 `width: 0` 会被回填)

### A.3 重写的方法 (image-specific)

| 方法 | V1 行号 | 行为说明 |
|---|---|---|
| `getReizeableShowPoints()` | 9266 | 返回 `["s","w","e","se","r"]` — 拖拽 4 个边/角 + 旋转柄 |
| `getData(t)` | 9268–9272 | 见 Section F.3 字段绑定 |
| `createTarget(t, e)` | 9273 | 创建根 `<div class="hiprint-printElement hiprint-printElement-image">` |
| `initSizeByHtml(e)` | 9276 | 调 super.initSizeByHtml + `css(e, this.getData())` |
| `getConfigOptions()` | 9278 | 返回 `p.a.instance.image` (即 `[config line 478–616]`) |
| `updateDesignViewFromOptions()` | 9280–9281 | 设计期 options 改变时重新应用 css + updateTargetImage |
| `updateTargetImage(t, e, n)` | 9282–9290 | 见 Section F.1 |
| `getHtml(t, e, n)` | 9291 | 委托 `getHtml2` (基类) — 即打印期 `[V1 line 1172]` |

### A.4 未重写的方法 (image 继承自 BasePrintElement)

按 `[V1 line 676–1700]` 完全继承下列基类方法,等同于 text 元素:

`getConfigOptionsByName / getProxyTarget / SetProxyTargetOption / showInPage / setTemplateId / setPanel / getField / getTitle / updateSizeAndPositionOptions / initSizeByHtml (image override 后仍 super.call) / updateTargetSize / updateTargetWidth / getDesignTarget / design / drag / resize / select / cut / clone / delete / getFields / getFormatter / getStyler / bingKeyboardMoveEvent / getHtml2 / css / stylerCss / copyFromType / getPrintElementOptionTabs / getPrintElementOptionItems / updateOption / ...`

---

## B. Image 完整选项表

> **来源**: 三个地方
> 1. 元素 class 直接 `this.options.xxx` 读取 → V1 line 9269/9270/9281/9286/9287/9289/9290 等
> 2. 基类 `BasePrintElement` `this.options.xxx` 读取 → 继承所有 base option
> 3. `[config line 478–616]` 注册到属性面板的所有 supportOptions/tabs

| Option key | 类型 | 默认 (来自 V1) | 取值范围 | UI 控件 | 渲染影响 | V1 line — 读取 | V1 line — 默认/注册 |
|---|---|---|---|---|---|---|---|
| `src` | string (URL / dataURL) | undefined → fallback to `printElementType.getData()` (空字符串) | http(s):// / data:image/... / file:/// (浏览器自身权限决定) | 文本输入框 + "选择"按钮 + "上传 → FileReader → base64" | `<img src="...">` 渲染源 | 9270 (`this.options.src`); 9286 (作为 `n` 写入 `<img>`); 9287 (写入 `content:url("...")`) | config 487, supportOptions 559; UI: 3778 |
| `field` | string | undefined → fallback to `printElementType.field` | 嵌套 key 用 `.` 分隔 (如 `customer.signImage`) | 字段下拉 (业务方提供 `getFields()`) 或文本输入 | 设置后绑定 templateData[field] 作为 src | 9269 `getField()` → base 710; 9270 reduce | config 483, supportOptions 555; UI: 3544 |
| `fit` | string enum | undefined → fallback 不设 object-fit | `''` (默认) / `contain` / `cover` / `fill` / `none` | `<select>` 5 选项 | `<img>` 的 CSS `object-fit` | 9289 (写入 css) | config 491, supportOptions 563; UI: 3875 + 3863 |
| `borderRadius` | string (CSS) | undefined | `4px` / `50%` / `4px 8px` 等 | 文本输入框 | `<img>` 的 CSS `border-radius` | 9290 (写入 css) | config 527, supportOptions 567; UI: 4488 |
| `left` | number (pt) | 0 | ≥ 0 | "X位置(左)" number input | 元素绝对定位 left | base 587 `getLeft()` / 600 `setLeft()` / 1190 写入 css `displayLeft()` | base 563 (constructor); UI: 3604 (coordinate) |
| `top` | number (pt) | 0 | ≥ 0 | "Y位置(上)" number input | 元素绝对定位 top | base 602 `getTop()` / 615 `setTop()` / 1190 写入 css | base 563; UI: 3604 |
| `width` | number (pt) | undefined → fallback to `image.default.width` (config 615 是 `{}` 即 undefined; 实际拖入大小由 SVG/IMG 加载后 `initSizeByHtml` 决定) | ≥ 0 | "宽" number input | css width | base 629 / 637 / 738 `updateTargetSize` | base 563; UI: 3690 (widthHeight) |
| `height` | number (pt) | undefined → 同 width | ≥ 0 | "高" number input | css height | base 619 / 627 / 738 | base 563; UI: 3690 |
| `transform` | number (deg) | undefined | 任意浮点 | "旋转角度" number input | css `transform: rotate(Xdeg)` (同时 -ms- / -moz- / -webkit- / -o-) | base 563 持有; option-item U.css 4440 写入 | config 519, supportOptions 599; UI: 4445 |
| `zIndex` | integer | undefined | 整数 | "元素层级" number input | css `z-index` | option-item `zIndex.css` 4463 | config 523, supportOptions 603; UI: 4467 |
| `pageBreak` | boolean | undefined (false-y) | true / false | checkbox | true 时 getHtml2 强制新页打印 `[V1 line 1203]` | base.getHtml2 1203 | config 535, supportOptions 591; UI: 4197 |
| `showInPage` | string enum | undefined → 全部页都显示 | `''` / `first` / `last` / `odd` / `even` | `<select>` | 决定该元素在哪些页打印 | base 692–704 | config 503, supportOptions 579; UI: 4175 |
| `unShowInPage` | string enum | undefined | `''` / `first` / `last` | `<select>` | 决定不打印的页 | base 694, 698, 704 | config 507, supportOptions 583; UI: 4392 |
| `fixed` | boolean | undefined | true / false | checkbox | 固定定位,不参与分页流 (isFixed 用于跳过分页) | base.isFixed (在 getHtml2 1179 调用) | config 511, supportOptions 587; UI: 4329 |
| `axis` | string enum | undefined | `''` / `'h'` / `'v'` | `<select>` | 拖拽轴向锁定 | drag 时 `hidraggable({axis})` 见 line 956/971/987 | config 539, supportOptions 595; UI: 4344 |
| `formatter` | string (JS 函数源码) | undefined | `function(value, options, templateData) { return ... }` | textarea (高级页) | element-级 formatter,优先于 printElementType.formatter `[V1 line 1536]` | base 1534–1542 | config 543, supportOptions 607; UI: 5639 |
| `styler` | string (JS 函数源码) | undefined | `function(value, options, target, templateData) { return {color:'red'} }` | textarea (高级页) | 返回对象的每个 key 用 `target.css(k,v)` 应用 `[V1 line 1268]` | base 1544–1551 | config 547, supportOptions 611; UI: 5656 |
| `positionLocked` | boolean | undefined | true / false | "位置坐标" 区域的 checkbox `[V1 line 3611]` | true → `draggable = false` `[V1 line 1566]`,X/Y 输入禁用 | 1566, 906, 993 | UI: 3604 (coordinate); set: 993 |
| `sizeLocked` | boolean | undefined | true / false | "宽高大小" 区域的 checkbox `[V1 line 3690]` | true → 宽高 input 禁用,resize handle 隐藏 `[V1 line 1016, 1030]` | 907, 994, 1016 | UI: 3682 (widthHeight); set: 3700 |
| `draggable` | boolean | undefined (即 true) | true / false | 无独立 UI (随 positionLocked 联动) | false 时不能拖 `[V1 line 1566]` | 814, 853, 1098, 1566, 1659, 997 | base 814 派生 |
| `coordinateSync` | boolean | undefined (即 false) | true / false | "位置坐标" 区域内的"X/Y 锁定"checkbox `[V1 line 3617]` | true → 改 X 时 Y 同步,或反之 | 3617 | UI: 3604 |

**显式不存在的字段** (用户可能预期但 V1 image 不支持):

| 期待字段 | 在 V1 image 是否存在 | 证据 |
|---|---|---|
| `backgroundColor` | ❌ — 不在 `image.supportOptions` (`[config line 553–614]`) 也不在 `image.tabs` (`[config line 479–552]`) | `image.supportOptions` 完整列表只有 15 项:field, src, fit, borderRadius, coordinate, widthHeight, showInPage, unShowInPage, fixed, pageBreak, axis, transform, zIndex, formatter, styler — 不包含 backgroundColor |
| `padding` | ❌ — 同上 | 同上 |
| `objectFit` | ⚠️ — V1 用 `fit` (短名),写入 css 是 `object-fit` `[V1 line 9289]` | option key 是 `fit`,实际渲染属性是 `object-fit` |
| `rotate` | ⚠️ — V1 用 `transform` (短名),写入 css 是 `rotate(Xdeg)` `[V1 line 4440]` | option key 是 `transform`,渲染属性是 `transform: rotate(...)` |

---

## C. Image 预设工厂 (image / signatureImage / seal)

V1 在 `default-etyps-provider.js` 注册了 3 个使用 `type: "image"` 的预设。它们的区别仅在默认 options:

### C.1 `defaultModule.image` (空白图片)

`[provider line 31–37]`
```js
{
  tid: "defaultModule.image",
  title: "图片",
  data: "",
  type: "image",
  icon: "ep:picture"
}
```

- 没有 options.src → 拖入后是空 `<img>` (无 src,但元素 DOM 已渲染)
- 没有默认宽高 → 走 `image.default = {}` `[config line 615]` → 通过 `initSizeByHtml` 在 img 加载后才有尺寸,空 src 时为 0 (空白方框)

### C.2 `defaultModule.signatureImage` (签名图占位)

`[provider line 416–426]`
```js
{
  tid: "defaultModule.signatureImage",
  title: "签名图",
  type: "image",
  icon: "ep:edit-pen",
  options: {
    width: 160,
    height: 60,
    src: SIGNATURE_IMAGE_PLACEHOLDER_SRC,  // [provider line 3–8] SVG dataURL
    fit: "contain",
  },
}
```

- **占位 SVG** `[provider line 3–8]`:
  - viewBox="0 0 160 60"
  - 灰色虚线 rect (stroke="#bfbfbf", stroke-dasharray="4,3")
  - 中央文字 "点此上传签名" (SimSun, 11px, #bfbfbf)
- 拖入后用户右侧"图片地址 → 上传"或"选择" → src 替换为业务 base64/URL

### C.3 `defaultModule.seal` (印章占位)

`[provider line 427–438]`
```js
{
  tid: "defaultModule.seal",
  title: "印章",
  type: "image",
  icon: "ep:medal",
  options: {
    width: 80,
    height: 80,
    src: SEAL_PLACEHOLDER_SRC,            // [provider line 11–16] SVG dataURL
    fit: "contain",
  },
}
```

- **占位 SVG** `[provider line 11–16]`:
  - viewBox="0 0 80 80"
  - 红色虚线圆 (cx=40, cy=40, r=36, stroke="#d4380d", stroke-dasharray="4,3")
  - 中央文字 "印章" (SimSun, 18px, bold, #d4380d)
- 印章 SVG 直接渲染 — 业务方也可不替换,直接打印这个占位

### C.4 不存在的预设 (用户可能预期)

- ❌ 没有 `defaultModule.signature` 类型的 image — `defaultModule.signature` `[provider line 396–412]` 是 `type: "text"`,带 `borderBottom + textContentVerticalAlign: bottom` 视觉是"签字行下划线",**不是 image**
- ❌ 没有 `defaultModule.qrcodeImage` / `defaultModule.barcode` 作为 image 类型 — 它们是 `type: 'text'` + `textType: 'barcode'/'qrcode'` `[provider line 330–358]`

---

## D. Image 属性面板渲染 (Property Panel)

> **来源**: `[config line 478–616]` 的 `image.tabs` 决定面板的 tab 结构和每个 tab 的字段顺序。
> Tab 系统在 `[V1 line 1294–1310]` `getPrintElementOptionTabs()` 实现。

### D.1 Image 的 tabs 顺序 (左 → 右)

`[config line 479–552]`

#### 基础 tab `[config line 480–515]`

按顺序渲染:

| # | option name | UI 控件 | V1 row |
|---|---|---|---|
| 1 | `field` | "字段名" 下拉/文本框 `[V1 line 3547–3568]` | config 483 |
| 2 | `src` | "图片地址" 文本框 + "选择" 按钮 + "上传" file input `[V1 line 3770–3861]` | config 487 |
| 3 | `fit` | "图片缩放" 下拉 (默认/等比/剪裁/填充/原始尺寸) `[V1 line 3863–3884]` | config 491 |
| 4 | `coordinate` | "位置坐标" 双 number input + 位置锁定 checkbox + 同步锁定 checkbox `[V1 line 3602–3680]` | config 495 |
| 5 | `widthHeight` | "宽高大小" 双 number input + 大小锁定 checkbox `[V1 line 3682–3768]` | config 499 |
| 6 | `showInPage` | "页面显示" `<select>` (全部/首页/末页/奇数/偶数) `[V1 line 4173+]` | config 503 |
| 7 | `unShowInPage` | "页面隐藏" `<select>` `[V1 line 4390+]` | config 507 |
| 8 | `fixed` | "固定" checkbox `[V1 line 4327+]` | config 511 |

#### 样式 tab `[config line 516–531]`

| # | option name | UI 控件 |
|---|---|---|
| 1 | `transform` | "旋转角度" number input `[V1 line 4445]` |
| 2 | `zIndex` | "元素层级" number input `[V1 line 4467]` |
| 3 | `borderRadius` | "边框圆角" 文本框 `[V1 line 4488]` |

#### 高级 tab `[config line 532–551]`

| # | option name | UI 控件 |
|---|---|---|
| 1 | `pageBreak` | "强制分页" checkbox |
| 2 | `axis` | "拖拽轴向" `<select>` |
| 3 | `formatter` | "格式化函数" textarea |
| 4 | `styler` | "样式函数" textarea |

### D.2 supportOptions (回退列表)

`[config line 553–614]` — 当 tabs 为空时使用的扁平 supportOptions 列表。`BasePrintElement.css` 优先用 tabs,空时退到 supportOptions `[V1 line 1244–1251]`。这层用于:
- 拖入元素时初始化 css (遍历所有支持的 option item, 调 `item.css(target, value)` `[V1 line 1252–1258]`)
- 业务方通过 `setConfig` 注入 `image.supportOptions: [...]` 覆盖默认时 `[V1 line 15217]`

### D.3 panel 的 onChange 走 auto-submit

每个 option 控件都有 class `auto-submit` `[V1 line 3552, 3558, 3592, ...]`。input/change 事件触发 `update + 渲染 + 触发 hiprintTemplateDataChanged_<templateId>` (位于 `[V1 line 11473, 11481, ...]`)。

---

## E. Image 渲染 DOM 输出

### E.1 设计期 (画布) DOM

`[V1 line 9274]`:
```html
<div class="hiprint-printElement hiprint-printElement-image"
     style="position: absolute; left:{left}pt; top:{top}pt; width:{width}pt; height:{height}pt;
            transform:rotate({transform}deg); z-index:{zIndex};">
  <div class="hiprint-printElement-image-content"
       style="height:100%; width:100%;">
    <!-- 由 updateTargetImage() 注入 -->
    <img src="{src}"
         style="width:100%; height:100%; content:url('{src}')!important;
                object-fit:{fit}; border-radius:{borderRadius};">
  </div>
</div>
```

**关键细节**:

- 根 `<div>` 上的 CSS 类是固定的两个: `hiprint-printElement` (基类 + 通用样式) + `hiprint-printElement-image` (image 专属) `[V1 line 9274]`
- 内层 wrap `<div class="hiprint-printElement-image-content">` 是 100% 撑满 — `[V1 line 9274]` 写死了 `height:100%;width:100%`
- `<img>` 由 `updateTargetImage` 创建/复用 `[V1 line 9286]`

### E.2 `<img>` 标签详细属性

`[V1 line 9286–9290]`:

```js
i.find("img").length
  ? i.find("img").attr("src", n)                                  // 复用已存在的 img
  : i.empty().append($("<img>").attr({ src: n,
                                       style: "width:100%;height:100%;" })); // 首次创建

if (n.length)
  i.find("img").css('cssText', `width:100%;height:100%;content:url("${n}")!important`)
else
  i.find("img").css('cssText', 'width:100%;height:100%;')

if (this.options.fit)         i.find("img").css("object-fit", this.options.fit);
if (this.options.borderRadius) i.find("img").css("border-radius", this.options.borderRadius);
```

| `<img>` 属性 | 来源 | V1 line |
|---|---|---|
| `src` | `this.getData()` (即 field 解析后或 options.src) | 9286 |
| `style.width` | `100%` 写死 | 9286, 9287, 9288 |
| `style.height` | `100%` 写死 | 9286, 9287, 9288 |
| `style.content` | `url("{src}")!important` (n 非空时) | 9287 |
| `style.objectFit` | `this.options.fit` (条件: fit 非空) | 9289 |
| `style.borderRadius` | `this.options.borderRadius` (条件: 非空) | 9290 |

### E.3 打印期 (getHtml2 → 渲染到纸张) DOM

`[V1 line 9291]` 委托基类 `getHtml2`:

`[V1 line 1187–1190]`:
```js
var p = this.getData(e),                            // e = templateData
    s = this.createTarget(this.getTitle(), p);      // ← image 的 createTarget 9273
this.updateTargetSize(s);                           // base 738
this.css(s, p);                                     // base 1237 (遍历所有 option 调用 item.css)
s.css("position", "absolute");
s.css("left", this.options.displayLeft());          // {left}pt
s.css("top", r + "pt");                              // 计算后的纸面 y
```

打印期 DOM 与设计期一致 (同 createTarget + updateTargetImage 链)。但有以下额外行为:

- `pageBreak: true` `[V1 line 1203]` → 在元素前插入空 paper result,强制元素出现在新页
- `fixed: true` `[V1 line 1179]` (`isFixed()`) → 跳过分页流,固定 y 位置
- `showInPage / unShowInPage` `[V1 line 692–704]` → 决定该 paper 是否包含此元素

### E.4 image 的 CSS class 在不同 state 下的差异

| State | 额外 class | V1 line |
|---|---|---|
| 选中 (单选) | 根元素加 `selected` | 见 base `selectFromList` |
| 多选 | 同 selected | base |
| 拖拽中 | hidraggable 内部添加 `dragging` (依赖 hidraggable 插件实现) | 853 |
| 缩放中 | hiresizable 内部添加 (依赖插件) | base |
| positionLocked | 无显式 class,但 draggable=false → 失去 hidraggable 提供的 drag cursor `[V1 line 814, 1004]` | 814 |
| sizeLocked | resize handle 隐藏 `[V1 line 1016, 1030]` (CSS 控制) | 1016 |
| 元素编辑中 (`_editing`) | 加 `editing` (基类通用) | 1562 |

---

## F. Image 专属交互

### F.1 Image 加载失败处理

**V1 当前缺失**: image 的 `<img>` 标签**没有** `onerror` 绑定 → broken URL 会显示浏览器默认 broken-image icon,**没有 fallback / 没有日志**。

唯一加 onerror 的是**属性面板** `src` 输入框的 `refresh()` 函数 `[V1 line 3810–3816]`:
```js
img.onerror = function () {
  console.warn('[hiprint] image refresh: failed to load', t);
  if (typeof cb === 'function') cb();
};
```
但这只对**用户在属性面板填地址时**生效,不影响实际渲染的 `<img>`。

**结论**: V1 image 加载失败时,画布和打印输出都会显示 broken-image icon,无日志。V3 应补 onerror handler。

### F.2 Image src 变化时的替换

`[V1 line 9286]`:
```js
i.find("img").length
  ? i.find("img").attr("src", n)               // 复用,只换 src 属性
  : i.empty().append($("<img>")...)            // 首次创建
```

复用策略的副作用:
- 浏览器对相同 src 不重新解析 (HTTP cache)
- 不同 src 会触发新的 HTTP request / dataURL 解码
- ❌ 没有 loading 占位 (用户看到的是旧图直到新图加载完)

### F.3 Image data 字段解析 (field binding)

`[V1 line 9268–9272]`:
```js
e.prototype.getData = function (t) {
  var e = "", f = this.getField();
  t ? e = f
        ? f.split('.').reduce((a, c) => (a != null ? a[c] : undefined), t) ?? ""
        : this.options.src || this.printElementType.getData()
    : e = this.options.src || this.printElementType.getData();
  var n = this.getFormatter();
  return n && (e = n(e, this.options, this._currenttemplateData)), e || "";
};
```

**解析优先级**:

| 场景 | t (templateData) | f (field) | 结果 src |
|---|---|---|---|
| 设计期 (无 templateData) | undefined / null | — | `options.src ?? printElementType.data ?? ""` |
| 打印期 + 无 field | object | "" / undefined | `options.src ?? printElementType.data ?? ""` |
| 打印期 + 有 field + 数据存在 | `{user: {signImage: "data:..."}}` | `"user.signImage"` | `"data:..."` (reduce 嵌套读取) |
| 打印期 + 有 field + 中间路径为 null | `{user: null}` | `"user.signImage"` | `""` (reduce 安全保护) |
| 打印期 + 有 field + 终值为 0/false | `{count: 0}` | `"count"` | `0` (返回非空标量) — 但 `??` 仅守 null/undefined |
| formatter 存在 | 任意 | 任意 | `formatter(e, options, templateData)` 转换后 |

**嵌套字段安全 reduce**:
- ✅ `(a != null ? a[c] : undefined)` `[V1 line 9270]` — 与 V1 base.getData `[V1 line 1274]` 用相同 pattern,避免中间路径 0/false 回退到根。

**与 `data:URL` 的关系**: src 可以是 `data:image/png;base64,...`,`getData` 不区分协议 — 整个字符串原样写入 `<img src>`。浏览器原生支持。

### F.4 Image backgroundColor / 透明 PNG

**V1 不支持 image 元素的 backgroundColor**:
- ❌ `image.supportOptions` `[config line 553–614]` 不含 `backgroundColor`
- ❌ `image.tabs` `[config line 479–552]` 不含 `backgroundColor`
- → 用户即使在 element JSON 里手动加 `options.backgroundColor: "#ff0"`,属性面板不会显示该控件,且 `BasePrintElement.css` `[V1 line 1244–1258]` 遍历 supportOptions/tabs 调用每个 item 的 css() → 找不到 backgroundColor item → **不会写入根 div 的 background**

**透明 PNG 行为**: `<img src="data:image/png;base64,...alpha...">` 渲染时,透明部分会显示**根 div 默认背景** (即空 / 父 panel 背景色)。这是浏览器原生行为,V1 不提供任何 alpha 合成控制。

### F.5 Image 拖入大小 (initSizeByHtml)

`[V1 line 9276–9277]`:
```js
e.prototype.initSizeByHtml = function (e) {
  t.prototype.initSizeByHtml.call(this, e), this.css(e, this.getData());
};
```

调用 base.initSizeByHtml `[V1 line 732–737]`:
- 把元素 clone 到临时容器,用 jQuery 测量 px width/height
- 转换为 pt → setWidth/setHeight (前提: options 中未提供 width/height)

→ 对 `defaultModule.image` (无默认尺寸), 拖入时 IMG 尚未加载,测量值 = 0 → 元素实际宽高为 0 (用户看到 0×0 占位)。这是 V1 的已知行为缺陷。

→ 对 `signatureImage` (默认 160×60)、`seal` (默认 80×80),拖入时直接用默认尺寸。

### F.6 Image 拖拽缩放点位

`[V1 line 9266–9267]`:
```js
e.prototype.getReizeableShowPoints = function () {
  return ["s","w","e","se","r"];
};
```

5 个 handle:
- `s` = south (底边中点) — 改 height
- `w` = west (左边中点) — 改 width + left
- `e` = east (右边中点) — 改 width
- `se` = southeast (右下角) — 改 width + height (等比拖)
- `r` = rotate handle (顶部柄) — 改 transform

**显式缺失**: 没有 `n` (north) / `nw` / `ne` / `sw` → image 不允许从顶部、左上、右上、左下拖。原因不明,可能是上游设计为"image 锚点在左上角,只能向右下扩张"。

**与 base.options.sizeLocked 联动**: sizeLocked=true → 所有 5 个 handle 隐藏 `[V1 line 1016, 1030]`。

---

## G. Image 右键上下文菜单

> **来源**: `[V1 line 11419–11650]` 的 panel-级 contextmenu (所有 etype 共享,image 也走这条).

绑定: `t.designPaper.getTarget().on("contextmenu", ...)` `[V1 line 11421]` — 即每个 panel (画布) 都绑了同一个右键。

**显示条件** `[V1 line 11425–11428]`:
- `panel.getSelectedElements().length > 0` 或 `panel._contextCopyElements` 非空
- 否则不弹

**菜单结构** (按出现顺序):

| 分组 | 项 | enabled 条件 | V1 line | 行为 |
|---|---|---|---|---|
| 元素操作 | 复制元素 | hasSelection | 11435 | 把当前选中存到 `panel._contextCopyElements` |
| 元素操作 | 粘贴元素 | hasCopy (`_contextCopyElements` 存在) | 11444 | 对每个复制项 clone → setLeft/setTop +10 → append → design → trigger `hiprintTemplateDataChanged_` |
| 参数更新 | 字体 12pt | hasSelection | 11469 | 对每个选中调用 `updateOption('fontSize', 12, true)` — 对 image **无视觉效果** (image 不读 fontSize),但 option 值仍写入 |
| 参数更新 | 字体加粗 | hasSelection | 11477 | 同上,`fontWeight = bolder` — image 无效果 |
| 层级操作 | 置于顶层 | hasSelection | 11488 | 求 panel 所有 element 的 max zIndex,自己设为 max+1 |
| 层级操作 | 置于底层 | hasSelection | 11497 | 把自己设为最低,其它 element +1 |
| 层级操作 | 上移一层 | hasSelection | 11509 | zIndex +1 |
| 层级操作 | 下移一层 | hasSelection | 11516 | zIndex = max(0, z-1) |
| 锁定 | 锁定元素 / 解锁元素 (动态) | hasSelection | 11527 | toggle positionLocked + (锁定时同时锁 sizeLocked) |
| 对齐操作 (仅多选 ≥2) | 左对齐 / 右对齐 / 顶对齐 / 底对齐 / 水平居中 / 垂直居中 / 水平分布 / 垂直分布 | length ≥ 2 | 11543–11620 (附近) | 多选对齐 |

**image-specific 缺失**:
- ❌ 没有"裁剪图片"
- ❌ 没有"旋转 90°" (虽然 transform 可手动改)
- ❌ 没有"重置尺寸到原图"

---

## H. Image 锁定行为 (positionLocked / sizeLocked)

### H.1 positionLocked 状态机

`[V1 line 993–1014]`:
```js
var _posLocked = !!this.options.positionLocked;
var _sizeLocked = !!this.options.sizeLocked;
if (_posLocked) {
  this.options.draggable = false;
} else if (existed) {
  delete this.options.draggable;  // 解锁时清字段
}
try {
  this.designTarget.hidraggable('update', { draggable: !_posLocked });
} catch (ex) {
  console.warn('[hiprint] hidraggable update failed (posLock):', ex);
}
```

| positionLocked | sizeLocked 派生 | UI 表现 |
|---|---|---|
| false → true | true (强制) `[V1 line 11533]` | 拖拽禁用,X/Y input 禁用,resize handle 隐藏,锁定图标 |
| true → false | 保持 false | 拖拽恢复,所有 input 可编辑 |

`[V1 line 11531–11537]` (右键菜单的锁定切换):
```js
selectedEls.forEach(function (el) {
  var newVal = !hasLocked;
  el.options.positionLocked = newVal;
  if (newVal) el.options.sizeLocked = true;     // 锁位置时强制锁大小
  el.updateDesignViewFromOptions();
  el.designTarget.find('.auto-submit').first().trigger($.Event("change"));
});
```

### H.2 sizeLocked 独立状态

`[V1 line 1016–1033]` 决定 resize handle 显隐 (image 的 5 个 handle 都受 sizeLocked 控制):
```js
if (_sizeLocked || _posLocked) {
  // hide resize handles
} else { /* show */ }
```

### H.3 键盘移动在锁定下的行为

`[V1 line 1566–1572]`:
```js
if (false === n.options.draggable || n.options.positionLocked) {
  // 位置锁定时仍允许删除操作 (Backspace/Delete)
  if (r.keyCode === 8 || r.keyCode === 46) {
    // 允许 delete/backspace 继续执行
  } else {
    return;  // 其它键 (方向键) 全部禁用
  }
}
```

→ 锁定的 image 仍可用 Delete / Backspace 删除,但**不能用方向键移动**。

---

## I. Image CSS 类与状态映射

| CSS 类 | 出现位置 | 含义 |
|---|---|---|
| `hiprint-printElement` | 根 div (所有 etype 共享) | 通用 element 容器 |
| `hiprint-printElement-image` | 根 div (image 专属) `[V1 line 9274]` | image 类型标识 |
| `hiprint-printElement-image-content` | 内层 wrap `[V1 line 9274]` | 占满父容器,容纳 `<img>` |
| `hiprint-option-item` | 属性面板每个 option 控件外层 (src/fit/...) | 属性项容器 |
| `hiprint-option-item-row` | src/coordinate/widthHeight 等需要换行的项 | row layout |
| `hiprint-option-item-label` | 每个 option 控件的 label | 文本标签 |
| `hiprint-option-item-field` | 每个 option 控件的输入区 | input/select/textarea 容器 |
| `hiprint-option-item-settingBtn` | src option 的"选择"按钮 + "上传" label | 次级按钮 |
| `hiprint-img-upload` | src option 的隐藏 file input | 触发 base64 上传 |
| `auto-submit` | 所有 input/select/textarea | 触发 change → updateOption |
| `selected` | 元素被选中时的根 div (通用) | 视觉高亮 |
| `editing` | 元素 `_editing=true` 时 | 双击编辑态 |
| `hicontextmenuroot` | 右键弹出的菜单 | 由 line 8906/8919 控制位置 |
| `hiprint-ctx-menu` | 新的画布级右键菜单 `[V1 line 11430]` | 复制/粘贴/层级/锁定/对齐 |
| `hiprint-ctx-menu-item` | 菜单项 `[V1 line 11435]` | 单条菜单 |
| `hiprint-ctx-menu-group` | 菜单分组标题 `[V1 line 11432]` | "元素操作" / "参数更新" 等 |
| `hiprint-ctx-menu-divider` | 分组分隔 `[V1 line 11464]` | 横线 |
| `disabled` | 菜单项不可点 `[V1 line 11435]` | 灰显 |

---

## J. Image 已知 V1 缺陷 / 行为陷阱

1. **空 image 拖入大小为 0** (`F.5`): `defaultModule.image` 无默认宽高 + IMG 加载前 0×0 → 用户看到不可见元素,必须右侧手动设置宽高。
2. **`<img>` 无 onerror 渲染期 fallback** (`F.1`): broken URL 显示浏览器默认图标,无日志。
3. **复用 IMG 不触发 loading state** (`F.2`): 切换 src 时旧图保留直到新图就绪,无 placeholder。
4. **`fit` / `transform` 名字误导**: option key 是短名 (`fit`, `transform`),实际渲染是 `object-fit` / `transform: rotate(...)` — 与 CSS 属性名不一致。
5. **不支持 backgroundColor / padding**: V1 image 没有这两个选项 (`F.4`),即使手动写入 JSON 也不渲染。
6. **不支持顶部/左上等 resize handle** (`F.6`): 只能从右下方向扩展。
7. **右键菜单"字体 12pt / 字体加粗"对 image 无效但仍可点击** (`G`): 通用菜单未按 etype 过滤。
8. **`getReizeableShowPoints` 返回 `["s","w","e","se","r"]`** `[V1 line 9267]` — 与方法名拼写 "Reizeable" (缺少 's') 是上游遗留拼写错误,但不影响功能。
9. **位置锁定时强制大小锁定** (`H.1`): 但解锁时**不自动解大小锁定** — 不对称行为,用户需手动二次解锁。
10. **`getData(t)` 在 templateData 为 falsy (如 `0` / `""`) 时走 src 分支** `[V1 line 9270]`: `t ? ... : this.options.src` — 三元运算用 truthy 判断,`t = 0` 时表现为"无 templateData"。但 templateData 通常是对象,标量传入是边缘情况。

---

# Part 2 — `html` 元素类型

## A. 类层级 (html)

### A.1 类标识

- **JS class symbol**: `S` `[V1 line 10183]`
- **未压缩等价名**: `HtmlPrintElement`
- **DOM 类名**: `hiprint-printElement-html` `[V1 line 10206]`
- **内容容器类名**: `hiprint-printElement-html-content` `[V1 line 10201, 10206, 10211]`
- **派生关系**: `S extends f.a` `[V1 line 10218]` — 即 `extends BasePrintElement`

### A.2 构造函数 (html)

`[V1 line 10183–10187]`:
```js
S = function (t) {
  function e(e, n) {
    var i = t.call(this, e) || this;
    return i.options = new R(n),
           i.options.setDefault(
             new R(p.a.instance.html.default).getPrintElementOptionEntity()
           ),
           i;
  }
  // ...
}(f.a)
```

- 参数 1 `e`: `PrintElementType` (即 `defaultModule.html` `[provider line 133–146]`)
- 参数 2 `n`: business-passed options
- 行为:
  1. 调用 super 构造,赋 `printElementType` + `id`
  2. 创建 `R` 实例 `[V1 line 10186]` — `R` 是 `g.a` 的薄子类 `[V1 line 10155–10161]`,**完全继承,不加任何新方法**
  3. setDefault 用 `p.a.instance.html.default` = `{ height: 90, width: 90 }` `[config line 1773–1776]`

### A.3 html 用 `R` 包装的原因

`[V1 line 10155–10161]`:
```js
R = function (t) {
  function e(e) {
    return t.call(this, e) || this;
  }
  return I(e, t), e;
}(g.a)
```

`R extends g.a` 但**不重写任何方法** → 行为完全等同于直接用 `g.a`。这是上游历史遗留的占位类 (估计预留给将来添加 html-specific option 但从未使用)。

### A.4 重写的方法 (html-specific)

| 方法 | V1 line | 行为 |
|---|---|---|
| `updateDesignViewFromOptions()` | 10189–10193 | 重新应用 css + updateTargetHtml |
| `updateTargetHtml()` | 10194–10202 | **见 Section F.4 — XSS 边界** |
| `getConfigOptions()` | 10203 | 返回 `p.a.instance.html` (即 `[config line 1680–1777]`) |
| `createTarget(t, e)` | 10205–10214 | 创建根 div + 初始化 content |
| `getHtml(t, e, n)` | 10215 | 委托 `getHtml2` 基类 |

### A.5 显著缺失的 html-specific 方法

- ❌ `getReizeableShowPoints()` 未重写 → 走 `BasePrintElement` 默认 `[V1 line 之前的某处]`,即 8 个 handle (与 image 5 个 handle 不同)
- ❌ `getData(t)` 未重写 → 走基类 `[V1 line 1272–1274]`: `t ? f ? reduce : "" : this.printElementType.getData()` — **不读 options.content** (与 image 读 options.src 形成对照)
- ❌ `initSizeByHtml(e)` 未重写

---

## B. Html 完整选项表

> html 的 option 集合比 image 小: 没有 src/fit/borderRadius/field 默认绑定。

| Option key | 类型 | 默认 (来自 V1) | 取值范围 | UI 控件 | 渲染影响 | V1 line — 读取 | V1 line — 注册/默认 |
|---|---|---|---|---|---|---|---|
| `content` | string (HTML) | undefined | 任意 HTML 字符串 | **无属性面板控件** (见 D.4) | 通过 `.html(content)` 注入 inner DOM `[V1 line 10212]` | 10212 (`this.options.content`) | 不在 config.html.supportOptions; 仅 createTarget 直读 |
| `left` | number (pt) | 0 | ≥ 0 | "X位置(左)" number input | 元素绝对定位 | base 587 / 1190 | base 563; UI 3604 |
| `top` | number (pt) | 0 | ≥ 0 | "Y位置(上)" number input | 元素绝对定位 | base 602 / 1190 | base 563; UI 3604 |
| `width` | number (pt) | 90 | ≥ 0 | "宽" number input | css width | base 629 / 738 | config 1775; UI 3690 |
| `height` | number (pt) | 90 | ≥ 0 | "高" number input | css height | base 619 / 738 | config 1774; UI 3690 |
| `transform` | number (deg) | undefined | 任意浮点 | "旋转角度" number input | css `transform: rotate(...)` | option-item U.css 4440 | config 1709, supportOptions—无,tab-only;UI 4445 |
| `zIndex` | integer | undefined | 整数 | "元素层级" number input | css `z-index` | option-item zIndex.css 4463 | config 1713;UI 4467 |
| `pageBreak` | boolean | undefined | true/false | checkbox | 强制分页 | base.getHtml2 1203 | config 1721;UI 4197 |
| `showInPage` | string enum | undefined | `''`/`first`/`last`/`odd`/`even` | `<select>` | 控制元素在哪些页打印 | base 692–704 | config 1693;UI 4175 |
| `unShowInPage` | string enum | undefined | `''`/`first`/`last` | `<select>` | 控制不打印的页 | base 694 | config 1697;UI 4392 |
| `fixed` | boolean | undefined | true/false | checkbox | 固定位置 | base.isFixed | config 1701;UI 4329 |
| `axis` | string enum | undefined | `''`/`h`/`v` | `<select>` | 拖拽轴向 | drag config 956 | config 1725;UI 4344 |
| `formatter` | string (JS 函数源码) | undefined | `function(data, options, templateData) { return htmlStr }` | textarea (高级页) | 元素级 formatter — **优先级最高,绕开 content** `[V1 line 10210]` | 10195, 10210; base 1534 | config 1729, supportOptions 1769;UI 5639 |
| `positionLocked` | boolean | undefined | true/false | checkbox `[V1 line 3611]` | 锁定拖拽 | 1566, 906, 993 | UI 3604 |
| `sizeLocked` | boolean | undefined | true/false | checkbox `[V1 line 3690]` | 锁定缩放 | 907, 994, 1016 | UI 3682 |
| `draggable` | boolean | undefined→true | true/false | 无独立 UI | false 时不能拖 | 814, 853, 1098 | base 814 |
| `coordinateSync` | boolean | undefined | true/false | checkbox `[V1 line 3617]` | X/Y 输入同步 | 3617 | UI 3604 |

**显式不存在的字段** (用户可能预期但 V1 html 不支持):

| 期待字段 | V1 是否存在 | 证据 |
|---|---|---|
| `field` | ❌ — **不在 html.supportOptions / tabs** `[config line 1680–1777]` | html 不支持字段绑定 (但**基类 `getField()` 仍会查 `options.field`** `[V1 line 710]`,如果用户在 JSON 里偷偷写了 field,基类 getData 会用,但 html 自己的 createTarget 不读) |
| `testData` | ❌ — 同上 | html.tabs / supportOptions 均无 |
| `backgroundColor` | ❌ — 同上 | html.supportOptions `[config line 1735–1772]` 完整 9 项: coordinate/widthHeight/pageBreak/showInPage/unShowInPage/fixed/zIndex/axis/formatter — 不含 backgroundColor |
| `padding` | ❌ — 同上 | 同上 |
| `borderRadius` | ❌ — 同上 | 同上 |
| `styler` | ❌ — **关键差异** | `html.tabs` `[config line 1718–1733]` 高级 tab 仅含 `pageBreak/axis/formatter` 三项,**没有 styler**;`html.supportOptions` 同样无 styler。**与 image 不同 (image 高级 tab 有 styler)** |
| `src` | ❌ — html 不是图片 | — |
| `fit` | ❌ — 同上 | — |

---

## C. Html 预设工厂 (唯一: `defaultModule.html`)

`[provider line 132–146]`:
```js
{
  tid: "defaultModule.html",
  title: "html",
  icon: "ep:postcard",
  formatter: function (data, options) {
    if (data) return data;
    return '<div style="width:100%;height:100%;display:flex;align-items:center;'
         + 'justify-content:center;border:1px dashed #c0c4cc;color:#909399;'
         + 'font-size:12px;box-sizing:border-box;background:#fafbfc;">'
         + '自定义 HTML</div>';
  },
  type: "html"
}
```

**关键**:
- `printElementType.formatter` 是一个**函数对象** (不是字符串) `[provider line 136–144]`
- formatter 签名: `(data, options)` — **不是基类 `getFormatter()` 期望的 string 源码**,而是直接函数。base.getFormatter `[V1 line 1534–1542]` 会优先返回 printElementType.formatter (此处即此函数),然后才检查 options.formatter (string + eval)。
- **拖入时**:
  - getData() 走基类 `[V1 line 1272–1274]`: 设计期无 templateData → 返回 `this.printElementType.getData()` 即 `data` 字段 (provider 未指定 → undefined)
  - createTarget 走 `[V1 line 10205–10214]`,先取 `getFormatter()`,有 formatter → 调 `formatter(data, options, templateData)` → data 是 undefined → 返回**虚线占位 HTML** "自定义 HTML"
- **运行期**:
  - 业务方传 `template.print({ ... })`,如果 `formatter` 在 element 实例上没被业务覆盖,依然走预设 formatter
  - 当业务方需要绑定 templateData 字段,**必须自己写 `options.formatter` 字符串覆盖**,或者直接传 `options.content`

---

## D. Html 属性面板渲染

### D.1 Html 的 tabs `[config line 1680–1734]`

#### 基础 tab `[config line 1683–1705]`

| # | option name | UI 控件 | V1 row |
|---|---|---|---|
| 1 | `coordinate` | "位置坐标" 双 number input + 锁定 checkbox | config 1685 |
| 2 | `widthHeight` | "宽高大小" 双 number input + 锁定 checkbox | config 1689 |
| 3 | `showInPage` | "页面显示" `<select>` | config 1693 |
| 4 | `unShowInPage` | "页面隐藏" `<select>` | config 1697 |
| 5 | `fixed` | "固定" checkbox | config 1701 |

**与 image 基础 tab 的差异**:
- ❌ html 基础 tab **没有 `field`**
- ❌ html 基础 tab **没有 `src`**
- ❌ html 基础 tab **没有 `fit`**

#### 样式 tab `[config line 1706–1717]`

| # | option name | UI 控件 |
|---|---|---|
| 1 | `transform` | "旋转角度" number input |
| 2 | `zIndex` | "元素层级" number input |

**与 image 样式 tab 的差异**: ❌ html 没有 `borderRadius`。

#### 高级 tab `[config line 1718–1733]`

| # | option name | UI 控件 |
|---|---|---|
| 1 | `pageBreak` | "强制分页" checkbox |
| 2 | `axis` | "拖拽轴向" `<select>` |
| 3 | `formatter` | "格式化函数" textarea |

**与 image 高级 tab 的差异**: ❌ html 没有 `styler`。

### D.2 supportOptions `[config line 1735–1772]`

完整 9 项:
1. coordinate
2. widthHeight
3. pageBreak
4. showInPage
5. unShowInPage
6. fixed
7. zIndex
8. axis
9. formatter

→ 当业务方通过 `setConfig({ html: { supportOptions: [...] } })` `[V1 line 15217]` 覆盖时,这 9 项是基线。

### D.3 default `[config line 1773–1776]`

```js
default: {
  height: 90,
  width: 90
}
```

`p.a.instance.html.default = { height: 90, width: 90 }` — 这是构造函数 `[V1 line 10186]` 用 setDefault 回填的值 → 拖入 html 元素时,如果 options 没指定 width/height,会被默认填为 90pt × 90pt。

### D.4 `content` 字段无属性面板控件

**核心异常**: `content` 是 html 的核心数据字段 (`[V1 line 10212]` 直接读),但**没有任何属性面板控件让用户编辑 content**。
- 不在 `html.tabs` 任一项 `[config line 1681–1734]`
- 不在 `html.supportOptions` `[config line 1735–1772]`

**业务方设置 content 的途径**:
1. 模板 JSON 中直接写 `printElements[N].options.content = "<div>...</div>"`
2. 通过 `printElementType` 上的 `formatter` 函数返回 HTML 字符串 (优先级高于 content,见 F.6)
3. 通过 `options.formatter` 字符串 (eval 后) 返回 HTML
4. 通过 `template.print({...})` 提供 templateData,由 formatter 读取

→ 用户用 UI 拖入 `defaultModule.html` 后,**只能看到占位虚线框 "自定义 HTML"**,要让它显示真实内容**必须通过代码**修改模板 JSON,UI 不提供编辑入口。这是 V1 html 元素的**最大用户体验缺陷**。

---

## E. Html 渲染 DOM 输出

### E.1 设计期 DOM `[V1 line 10206]`

```html
<div class="hiprint-printElement hiprint-printElement-html"
     style="position: absolute; left:{left}pt; top:{top}pt; width:{width}pt; height:{height}pt;
            transform:rotate({transform}deg); z-index:{zIndex};">
  <div class="hiprint-printElement-html-content"
       style="height:100%; width:100%;">
    {formatter(data, options, templateData) 或 options.content 直接插入}
  </div>
</div>
```

**与 image 的对比**:
- 根 div 类名差异: `hiprint-printElement-html` vs `hiprint-printElement-image`
- 内层 wrap 类名差异: `hiprint-printElement-html-content` vs `hiprint-printElement-image-content`
- **内容注入方式根本不同**:
  - image: 内层 wrap append `<img>`,**结构固定**
  - html: 内层 wrap 用 `.append(o)` (createTarget) 或 `.html(e)` (updateTargetHtml),**结构由用户的 HTML 字符串决定**

### E.2 createTarget 详细行为 `[V1 line 10205–10214]`

```js
e.prototype.createTarget = function (t, e) {
  var n = $('<div  class="hiprint-printElement hiprint-printElement-html" style="position: absolute;"><div class="hiprint-printElement-html-content" style="height:100%;width:100%"></div></div>'),
      i = this.getFormatter();

  if (i) {
    var o = i(this.getData(), this.options, this._currenttemplateData);
    n.find(".hiprint-printElement-html-content").append(o);   // ← formatter 模式
  } else this.options.content && n.find(".hiprint-printElement-html-content").append(this.options.content);  // ← 静态 content 模式

  return n;
};
```

**注入方式**: `.append(o)` `[V1 line 10211 / 10212]` — jQuery `append` 既接受字符串 (作为 HTML 解析) 也接受 DOM 节点。

- 当 formatter 返回 string:`.append("<div>...</div>")` → jQuery 解析为 DOM 后插入
- 当 formatter 返回 jQuery 对象 / DOM Node:直接插入
- 当 options.content 是 string:同 string 路径

### E.3 updateDesignViewFromOptions / updateTargetHtml `[V1 line 10194–10202]`

```js
e.prototype.updateTargetHtml = function () {
  var t = this.getFormatter();

  if (t) {
    var e = t(this.getData(), this.options, this._currenttemplateData);
    this.designTarget.find(".hiprint-printElement-html-content").html(e == null ? "" : e);
  }
};
```

**注意差异**:
- createTarget 用 `.append()` `[V1 line 10211]`
- updateTargetHtml 用 `.html()` `[V1 line 10201]`

→ updateTargetHtml **替换** 整个内层 content,createTarget **追加** 到空容器。功能上一致 (容器初始为空),但语义不同。

**只有当 formatter 存在时 updateTargetHtml 才工作**:
- 没有 formatter + 只设置 `options.content` 后改 options → `updateTargetHtml` 不会触发更新 (只检查 formatter 分支)
- → V1 html 的 content 不响应运行时改变,必须用 formatter 才能动态更新

### E.4 打印期 DOM `[V1 line 10215]` → `getHtml2`

委托基类 → 与 image 流程相同 (createTarget + css + 位置定位)。pageBreak / fixed / showInPage 行为与 image 一致。

---

## F. Html 专属交互

### F.1 Html resize handle (基类默认)

由于 `S.prototype.getReizeableShowPoints` **未重写** → 走基类默认。基类返回值在 `[V1 line ~700–710 之前]` (text 元素也未重写),实际由 hiresizable 默认提供 — 通常为 8 个 handle (n/s/e/w/ne/nw/se/sw + 旋转柄)。

**与 image 对比**: image 强制 5 handle,html 用 8 handle (上游设计:html 容器需要从任意方向扩展)。

### F.2 Html 双击编辑 (无)

`[V1 line 757]` 基类 `dblclick`:
```js
this.designTarget.dblclick(function (ev) {
  var c = e.designTarget.find(".hiprint-printElement-content");
  if (c) { ... }
});
```

- 基类查找的是 `.hiprint-printElement-content` (普通 text 元素)
- html 内层是 `.hiprint-printElement-html-content` → **基类的双击逻辑找不到目标,不进入编辑态**
- → html 不支持画布上双击直接编辑 HTML 内容

### F.3 Html formatter 函数签名

`[V1 line 10198, 10210]`:
```js
formatter(this.getData(), this.options, this._currenttemplateData)
```

签名: `formatter(data, options, templateData) → string | DOMNode | jQuery`

**调用时机**:
1. `createTarget` 首次创建画布 DOM `[V1 line 10210]`
2. `updateTargetHtml` 设计期 options 变化 `[V1 line 10198]`
3. `getHtml2` 打印期对每张 paper 调用 `[V1 line 1187 → createTarget]`

**预设 formatter 行为** (`defaultModule.html` `[provider line 136–144]`):
- data 真值 → 返回 data 原样 (即 templateData 里的 HTML 字符串)
- data 假值 → 返回虚线占位 "自定义 HTML"

**业务方 element-级 options.formatter 覆盖**:
- options.formatter 是**字符串**,通过 `new Function('return ' + str)()` eval `[V1 line 1537]`
- eval 失败 → console.warn,回退到 printElementType.formatter `[V1 line 1539–1541]`

### F.4 Html XSS 边界 — **关键安全节**

#### F.4.1 受影响的 V1 line

| V1 line | API | 内容来源 | 是否转义 |
|---|---|---|---|
| 10201 | `.html(e)` | `e = formatter(getData(), options, templateData)` — 即业务方返回的 string | ❌ 不转义,直接作为 HTML 解析 |
| 10211 | `.append(o)` | `o = formatter(getData(), options, templateData)` | ❌ 不转义 |
| 10212 | `.append(this.options.content)` | `options.content` — 业务方/模板 JSON 直接提供 | ❌ 不转义 |

#### F.4.2 攻击向量

**场景 A — 模板 JSON 注入**:
攻击者控制模板 JSON (例如通过后端 API 返回模板数据,模板 JSON 来自数据库):
```json
{
  "panels": [{
    "printElements": [{
      "options": { "content": "<img src=x onerror='alert(document.cookie)'>" },
      "printElementType": { "type": "html" }
    }]
  }]
}
```
→ 渲染时 `[V1 line 10212]` 直接 `.append(content)`,`<img onerror>` 会执行 attacker script。

**场景 B — formatter 返回未转义的 user data**:
```js
formatter: function(data, options, templateData) {
  return "<div>" + templateData.userName + "</div>";
}
```
当 `userName = "<script>steal()</script>"` → 注入。

**场景 C — templateData 直接作为 HTML**:
`defaultModule.html` 预设的 formatter `[provider line 136–144]`:
```js
formatter: function (data, options) {
  if (data) return data;       // ← data 直接返回,作为 HTML
  return '<div ...>...</div>';
}
```
→ 业务方 print({htmlField: "<script>..."})` 时,如果元素绑定了 field=htmlField,data 是 user input,直接返回 → 注入。

#### F.4.3 V1 的安全设计意图

`[V1 line 10199–10200]` 有注释明确说明:
```js
// html-element 类型的语义就是渲染业务方提供的 HTML; 业务方需在 formatter 内自行转义 user data。
// 这是 by-design 的安全权衡 (类似 React dangerouslySetInnerHTML),不是 XSS bug。
```

→ V1 明确把 XSS 责任推给业务方。html 元素的语义就是"render arbitrary HTML",不做转义。

#### F.4.4 V3 重写约束

V3 实现 html 元素时:
- **必须保留** `.html()` 注入行为 (否则破坏 V1 兼容)
- **必须在文档显式标注** XSS 边界 (类似 React `dangerouslySetInnerHTML`)
- **应增加** 业务方 opt-in 的转义模式 (例如 `options.escape: true` → 用 `.text()` 替代 `.html()`)
- **应有** CSP 配合建议 (业务方在 index.html 配 strict CSP,即使 html 元素被注入也限制 inline script)

### F.5 Html 字段绑定 (基类默认)

由于 `S.prototype.getData` **未重写** → 走基类 `[V1 line 1272–1274]`:
```js
BasePrintElement.prototype.getData = function (t) {
  var f = this.getField();
  return t ? f ? f.split('.').reduce((a, c) => (a != null ? a[c] : undefined), t) ?? "" : "" : this.printElementType.getData();
};
```

- 设计期 (无 templateData): 返回 `printElementType.getData()` (`PrintElementType` 的 `data` 字段 `[V1 line 10533]`)
- 打印期 + 有 field: 嵌套 reduce 解析
- 打印期 + 无 field: 返回 `""`

**关键差异 vs image**: image 在 `getData` 内做了 fallback 到 `options.src` (`[V1 line 9270]`),html **没有 fallback 到 options.content** — html 的 content 仅在 `createTarget` 阶段独立处理。

→ html 元素的 field 绑定**只能通过 formatter 间接使用** (formatter 拿到 data 后自行处理),不能像 image 那样"直接绑 field 到 content"。

### F.6 Html formatter 链 (printElementType vs options)

`[V1 line 1534–1543]`:
```js
BasePrintElement.prototype.getFormatter = function () {
  var formatter = void 0;
  if (this.printElementType.formatter && (formatter = this.printElementType.formatter), this.options.formatter) try {
    formatter = new Function('return ' + this.options.formatter)();
  } catch (t) {
    console.warn('[hiprint] element formatter eval failed, fallback to printElementType.formatter:', t);
  }
  return formatter;
};
```

**优先级 (高 → 低)**:
1. `options.formatter` (string source code,eval 通过)
2. `printElementType.formatter` (函数对象,如 provider 注册的 `defaultModule.html.formatter`)
3. (无 formatter 时) `options.content` (仅在 createTarget 直接 append `[V1 line 10212]`)

**注意死角**: 当 `options.formatter` eval 失败 → warn + 回退到 `printElementType.formatter` `[V1 line 1541]`。但**回退依然有效** (不是 silently failing)。

### F.7 Html 拖入时的尺寸

由于 `[config line 1774–1775]` 设了 `default: { height: 90, width: 90 }` → 拖入即 90×90pt,无需 initSizeByHtml 测量。

**与 image 的差异**: image 没有默认尺寸 (空 image 拖入是 0×0),html 总是 90×90。

---

## G. Html 右键上下文菜单

与 image 共享 `[V1 line 11419–11650]` 同一套画布级菜单 — **见 image Section G**。

**html 特殊点**:
- ❌ "字体 12pt" / "字体加粗" 菜单项对 html 同样无意义 (html 不读 fontSize/fontWeight)
- ✅ 层级 / 锁定 / 复制粘贴 / 对齐 完全可用

---

## H. Html 锁定行为

与 image 完全一致 — positionLocked / sizeLocked 走同一段基类逻辑 `[V1 line 993–1014, 1016–1033, 11527–11540]`。**见 image Section H**。

---

## I. Html CSS 类与状态映射

| CSS 类 | 出现位置 | 含义 |
|---|---|---|
| `hiprint-printElement` | 根 div | 通用 element 容器 |
| `hiprint-printElement-html` | 根 div (html 专属) `[V1 line 10206]` | html 类型标识 |
| `hiprint-printElement-html-content` | 内层 wrap `[V1 line 10206, 10201, 10211]` | 占满父容器,容纳用户 HTML |
| `hiprint-option-item` / `auto-submit` / `selected` / `editing` 等 | 同 image | 通用 |

**与 image 的 class 差异**:
- 仅根 div 后缀和内层 wrap 后缀不同 (`-html` vs `-image`)
- 内层 wrap 内的子元素**结构完全由业务方控制** — V1 不约束 (image 有 `<img>` 固定结构)

---

## J. Html 已知 V1 缺陷 / 行为陷阱

1. **XSS by design** (`F.4`): `.html()` / `.append()` 不转义,业务方 user-supplied HTML 直接执行 inline script / onerror。
2. **content 字段无 UI 控件** (`D.4`): 必须通过模板 JSON 或 formatter 设置,UI 拖入只能看到占位。
3. **`R` 类无用** (`A.3`): `R extends g.a` 但不重写任何方法,纯历史遗留。
4. **`getData` 未重写,不读 content** (`F.5`): html 的 content 与 field 体系分离 — 拖入元素绑定 field 后,**不会自动渲染 templateData[field] 作为 HTML**。
5. **content 不响应运行时更新** (`E.3`): updateTargetHtml 只走 formatter 分支,纯 content 模式下改 options.content 不重渲染。
6. **不支持 styler** (`D.4`): 与 image 的高级 tab 不一致 — html 高级 tab 仅 `pageBreak/axis/formatter`,无 styler。
7. **不支持 borderRadius** (`D.1`): 样式 tab 仅 `transform/zIndex`。
8. **不支持 field / testData / backgroundColor / padding 等图形通用属性** (`B`)。
9. **双击编辑无效** (`F.2`): 基类 dblclick 查找 `.hiprint-printElement-content`,html 用 `.hiprint-printElement-html-content` → 不进入编辑态。
10. **预设 formatter 直接返回 user data** (`provider 136–144 + F.4.2 场景 C`): `defaultModule.html` 的 formatter 在 `data` 为真时**裸返回** `data` 字符串,业务方误用为"渲染 user-supplied HTML"时直接 XSS。
11. **content 模式与 formatter 模式互斥** (`E.2`): `if (formatter) ... else (content) ...` — 一旦有 formatter 就忽略 content,反之亦然。无法 fallback 链 (例如 formatter 返回 null 时用 content)。
12. **resize handle 走基类 8 handle** (`F.1`),与 image 5 handle 不一致 — 跨 etype 行为不统一。

---

# Part 3 — image 和 html 共享的基类行为

> 以下行为对 image 和 html **完全一致**,因为两者都 `extends f.a` (`BasePrintElement`)。每条只列一次,避免冗余。

## 共享 1 — 拖拽 (drag)

`[V1 line 813–905]` — `BasePrintElement.prototype.design` 内部:

- `hidraggable` 初始化 `[V1 line 853]`,`draggable` 由 `positionLocked` 决定 `[V1 line 854–855]`
- 拖拽距离量化为 `movingDistance` (default 1.5pt) `[V1 line 882]`
- 拖拽时其它元素 `axis` 临时被禁用 `[V1 line 956, 971, 987]`
- 拖入时触发 `hiprintTemplateDataChanged_<templateId>` 事件 `[V1 line 11473 等多处]`

## 共享 2 — 缩放 (resize)

- handle 数量由 `getReizeableShowPoints()` 决定:image 5 个,html 8 个 (基类默认)
- sizeLocked=true 时全隐藏 `[V1 line 1016, 1030]`
- 缩放时实时更新 `options.width/height` + 内联 `style.width/height`

## 共享 3 — 选中 (selection)

- 单击 → `selectFromList(true)` → 触发 `getPrintElementSelectEventKey()` 事件 `[V1 line 744–756]`
- Ctrl/Cmd + 单击 → 多选
- 选中后属性面板渲染 (走 `getPrintElementOptionTabs()` `[V1 line 1294–1310]`)

## 共享 4 — 键盘移动

`[V1 line 1556+]`:
- ↑↓←→ → 移动 1 movingDistance (默认 1.5pt)
- Shift+方向 → 移动 5×movingDistance
- Delete / Backspace → 删除元素 (即使 locked 也可删 `[V1 line 1568–1570]`)
- locked + 方向键 → 阻断 `[V1 line 1571]`

## 共享 5 — clone (复制粘贴)

`[V1 line 1525–1533]`:
```js
BasePrintElement.prototype.clone = function () {
  var newObj = ... ; // 同 printElementType
  Object.keys(n.options).forEach(function (key) {
    newObj.options[key] = n.options[key];
  });
  return newObj;
}
```
- 复制 options 浅拷贝
- 右键"复制元素 / 粘贴元素" `[V1 line 11435, 11444]` 调用 clone + setLeft/setTop +10

## 共享 6 — 字段解析嵌套安全

`[V1 line 1274 (base), 9270 (image override)]`:
```js
f.split('.').reduce((a, c) => (a != null ? a[c] : undefined), t) ?? ""
```
- 用 `(a != null ? a[c] : undefined)` 而非 `a ? a[c] : t[c]`,避免中间为 0/false 时回退到根
- 终值用 `?? ""` 保护 null/undefined,但 0/false 保留

## 共享 7 — 事件总线触发

每次 option 改变都触发 `hinnn.event.trigger('hiprintTemplateDataChanged_' + templateId, reason)` — 业务方 listen 此事件做"模板已变"提示。

## 共享 8 — formatter / styler eval

`[V1 line 1534–1551]`:
- options.formatter / options.styler 是 **string source code**,用 `new Function('return ' + str)()` eval
- eval 失败 console.warn + 回退到 printElementType.formatter / printElementType.styler

## 共享 9 — getHtml2 (打印期)

`[V1 line 1172–1223]`:
- 处理分页 (panelPageRule != 'none' 时跨页拆分)
- pageBreak=true 时强制新页
- fixed=true 时跳过分页流
- showInPage / unShowInPage 决定该 paper 是否渲染

## 共享 10 — option 写入 css

`[V1 line 1237–1262]`:
- 遍历 tabs (优先) 或 supportOptions
- 每项调 `optionItem.css(target, value)` (如 `transform.css` 在 4434, `zIndex.css` 在 4461,`borderRadius.css` 在 4482)
- 最后调 `stylerCss` 应用 user-defined styler `[V1 line 1263–1271]`

---

# 附录 A — XSS 攻击向量汇总 (要求 task 单独总结)

| # | 向量 | etype | V1 line | 触发条件 | 严重度 |
|---|---|---|---|---|---|
| 1 | `options.content` 直接 `.append()` 解析 HTML | html | 10212 | 业务方/模板 JSON 中 content 含恶意 HTML (从后端 API / DB / 用户输入流入) | 🔴 CRITICAL — 可执行任意 JS,by-design 但需文档警告 |
| 2 | `formatter` 返回值直接 `.append()` (createTarget) | html | 10211 | formatter 拼接 user data 未转义 (如 `"<div>" + userName + "</div>"`) | 🔴 CRITICAL — 业务方写 formatter 时极易遗漏转义 |
| 3 | `formatter` 返回值直接 `.html()` (updateTargetHtml) | html | 10201 | 设计期 options 变化时,formatter 用 user data 拼接 | 🔴 CRITICAL — 同上,且设计期也触发 |
| 4 | `defaultModule.html` 预设 formatter 裸返回 `data` | html | provider 140 (`if (data) return data;`) | 业务方 print 时绑定 field 到 html 元素,templateData[field] 含恶意 HTML | 🔴 CRITICAL — 预设行为直接放过 user data |
| 5 | `<img src="...">` 拼接 (历史) | image | 9286 | 已修复 — 改用 `.attr({src: n})` 强制 attribute 转义 | 🟢 已修 (注释 `[V1 line 9284–9285]`) |
| 6 | `<img style="content:url('...')">` 拼接 | image | 9287 | n 含 `"` 可逃逸出 url() | 🟡 MEDIUM — n 来自 getData(),如果业务方传 `'data:..."<script>"'` 可注入到 CSS context; 但 CSS context 不直接执行 JS,需配合其它向量 |
| 7 | image 元素 `src` 取自 templateData (无清理) | image | 9270 (reduce) → 9286 (`.attr("src", n)`) | 业务方传 `src = "javascript:alert(1)"` | 🟡 MEDIUM — `.attr` 不阻止 javascript: 协议,部分浏览器仍执行 (现代浏览器多数已阻止 img 触发 javascript:) |

**V3 重写时必须**:
- (a) 对 html etype 提供 `options.escape: true` opt-in,改用 `.text()` 替代 `.html()`
- (b) 对 image src 增加 `javascript:` / `data:text/html` 协议白名单校验
- (c) 在 `defaultModule.html` 预设 formatter 增加显式 XSS 警告 (注释或 console.warn devmode)
- (d) 业务方文档显式声明 html etype = `dangerouslySetInnerHTML` 语义,XSS 责任在业务侧
- (e) CSP 推荐 (业务方 index.html 配 `script-src 'self' 'nonce-...'`)

---

# 附录 B — image vs html 字段对照速查表

| 字段 | image 是否支持 | html 是否支持 | image V1 line | html V1 line |
|---|---|---|---|---|
| field | ✅ | ❌ (UI 无,但基类有 getField) | 9269 | base 710 (only) |
| src | ✅ | ❌ | 9270 | — |
| content | ❌ | ✅ (无 UI) | — | 10212 |
| fit | ✅ | ❌ | 9289 | — |
| borderRadius | ✅ | ❌ | 9290 | — |
| transform (rotate) | ✅ | ✅ | option-item 4440 | option-item 4440 |
| zIndex | ✅ | ✅ | 4463 | 4463 |
| pageBreak | ✅ | ✅ | base 1203 | base 1203 |
| showInPage | ✅ | ✅ | base 692 | base 692 |
| unShowInPage | ✅ | ✅ | base 694 | base 694 |
| fixed | ✅ | ✅ | base | base |
| axis | ✅ | ✅ | 956, 971 | 956, 971 |
| formatter | ✅ | ✅ | base 1534 | base 1534 |
| styler | ✅ | ❌ | base 1544 | — |
| positionLocked | ✅ | ✅ | 993 | 993 |
| sizeLocked | ✅ | ✅ | 994 | 994 |
| coordinateSync | ✅ | ✅ | 3617 | 3617 |
| width / height | ✅ (无默认) | ✅ (默认 90×90) | base 629/619 | base 629/619 + config 1774 |
| left / top | ✅ | ✅ | base 587/602 | base 587/602 |
| backgroundColor | ❌ | ❌ | — | — |
| padding | ❌ | ❌ | — | — |
| testData | ❌ | ❌ | — | — |

---

# 附录 C — 引用 V1 line 完整列表

本文件引用的 V1 source line (按文件):

**hiprint.bundle.js** (15353 总行):
- 397, 398, 415 — HiPrintConfig 单例
- 561, 563, 568, 587, 600, 602, 615, 619, 627, 629, 637 — PrintElementOption 基类 getter/setter
- 676, 678, 692–704, 705–712, 732–737, 738, 744–756, 757 — BasePrintElement 基础
- 813–905, 853–855, 882, 906–907, 956, 971, 987, 993–1014, 1016–1033 — drag / lock 流程
- 1172–1223, 1224–1234 — getHtml2 打印期分页
- 1237–1262, 1263–1271, 1272–1274, 1294–1310, 1311–1335 — css / styler / option panel
- 1525–1533, 1534–1551, 1556+, 1566–1572, 1659 — clone / formatter / styler / 键盘
- 3544, 3552, 3558, 3568, 3604, 3611, 3617, 3682, 3690, 3700, 3742, 3754, 3756, 3770–3861, 3863–3884, 4173, 4175, 4197, 4327–4329, 4344, 4390–4392, 4429–4476, 4477–4498 — option item UI
- 5639, 5656 — formatter / styler UI
- 9260–9294 — `v` (ImagePrintElement)
- 9267, 9268–9272, 9273, 9274, 9276–9277, 9278–9279, 9280–9281, 9282–9290, 9291 — image 方法
- 10155–10161 — `R` (HtmlPrintElementOption,占位子类)
- 10183–10218 — `S` (HtmlPrintElement)
- 10189–10193, 10194–10202, 10203, 10205–10214, 10215 — html 方法
- 10199–10200 — XSS by-design 注释
- 10523 — `W.createPrintElement` 派遣表
- 10526–10560 — `j` (PrintElementType)
- 10660 — SUPPORTED_ELEMENT_TYPES
- 11324, 11333 — insertPrintElementToPanel for html/image
- 11419–11650 — 画布级右键菜单
- 11425–11428, 11430, 11432, 11435, 11444, 11461, 11464, 11466, 11469, 11473, 11477, 11481, 11484, 11487, 11488, 11497, 11509, 11516, 11523, 11525, 11527, 11531–11540, 11543 — 菜单项细节
- 15187, 15217 — setConfig 覆盖
- 15348 — defaultElementTypeProvider 注册

**hiprint.config.js** (2254 总行):
- 478 (image 起点)
- 480–515 (image 基础 tab)
- 516–531 (image 样式 tab)
- 532–551 (image 高级 tab)
- 553–614 (image supportOptions)
- 615 (image default = {})
- 1680 (html 起点)
- 1681–1734 (html tabs)
- 1735–1772 (html supportOptions)
- 1773–1776 (html default = { height: 90, width: 90 })

**default-etyps-provider.js** (447 总行):
- 3–8 (signatureImage 占位 SVG)
- 11–16 (seal 占位 SVG)
- 31–37 (defaultModule.image)
- 132–146 (defaultModule.html + 占位 formatter)
- 396–412 (defaultModule.signature — 注意是 text 类型,不是 image)
- 416–426 (defaultModule.signatureImage)
- 427–438 (defaultModule.seal)

---

**生成时间**: 2026-05-11
**作者**: V1-INVENTORY 阶段穷举团队
**对照基线状态**: ✅ 完整 — 任何 V3 重写必须逐项 diff,任何字段缺失需写入 V3-PARITY-MATRIX 🔴 missing 行
