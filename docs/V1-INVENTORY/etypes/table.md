# V1-INVENTORY · etype: `table` (incl. former `tableCustom` / `tableCustomCell`)

> Exhaustive V1 user-visible behavior spec, every field and every interaction
> enumerated and cited to a concrete line in
> `E:/Source_code/vue-plugin-hiprint-v2/src/hiprint/hiprint.bundle.js`
> (`bundle` below) or `E:/Source_code/vue-plugin-hiprint-v2/src/hiprint/hiprint.config.js`
> (`config` below). All `[V1 line N]` citations refer to those two files unless
> stated otherwise.
>
> This is the heaviest etype in the library; it owns
>
> * the row/cell DOM generator (`TableExcelHelper`, bundle 1924-2427),
> * the design-time live editor (`HiTable`, bundle 6712-7337 + 1750-1875),
> * the auto-pagination engine (bundle 6317-6509),
> * the column resizer (`HiTresizer`, bundle 6807-6905),
> * the property panel "列" tab (config 1009-1012).
>
> `tableCustom` and `tableCustomCell` no longer exist as standalone etypes.
> Drag-creating a `tid` whose `type === "tableCustom"` throws explicit error
> `已移除'tableCustom',请替换使用'table'详情见更新记录` at bundle 10737-10739.
> The "Cell" handling moved into per-column options on the unified `table`
> (Section C below).

Conventions:

* "design" / "design time" = the visible editor in `buildDesigner`.
* "print" / "print time" = `getHtml(paper, data)` invoked from
  `PrintTemplate.print(data)`.
* "options" = `printElementOptionEntity` stored on each cell of the template
  JSON (`element.options`).
* "printElementType" = static definition on the registered etype
  (`provider.printElementTypes[].columns`, `.editable`, etc.).
* `t` / `e` / `n` are the original minified parameter names — kept here so
  citations work when grepping the bundle.

---

## Section A — Class hierarchy for `table` and table cells

### A.1 `TablePrintElement` class

* **Defined**: bundle 6245-6709.
* **Extends**: `BasePrintElement` (webpack module 0) via the
  `__extends(TablePrintElement, _super)` call [V1 line 6251].
* **Constructor signature**: `TablePrintElement(t, e)` [V1 line 6246].
  * `t` = the resolved `printElementType` (the static definition with
    `columns`, `editable`, `groupFields`, ...).
  * `e` = the per-instance `options` blob from the template JSON.
* **Constructor body** [V1 line 6247-6249]:
  1. `_super.call(this, t)` — `BasePrintElement` ctor stores `printElementType`.
  2. `n.gridColumnsFooterCss = "hiprint-gridColumnsFooter"` — CSS class for the
     grid-columns footer row container (Section L.2).
  3. `n.tableGridRowCss = "table-grid-row"` — CSS class for the outer
     grid-columns wrapper.
  4. `n.options = new TablePrintElementOption(e, n.printElementType)` (option
     constructor at bundle 7385-7400; this is webpack module 18 referenced by
     `__webpack_require__(18)` [V1 line 6222]).
  5. `n.options.setDefault(...)` — folds in the global default for `table`,
     which is `{ width: 550 }` [config 1216-1218].
* **Public methods on the class** (all at top-level prototype assignments
  inside the same chain starting [V1 line 6251]):

  | Method | Bundle line | Purpose |
  |---|---|---|
  | `getColumns()` | 6251-6253 | Returns `this.options.columns` (2-D array of cell objects). |
  | `getColumnByColumnId(t)` | 6253-6255 | Looks up a flattened cell by `columnId`. |
  | `updateDesignViewFromOptions()` | 6255-6263 | Re-renders the design `<table>` body in place after the user edits an option. Also re-runs `setHitable` and `setColumnsOptions`. |
  | `css(t, e)` | 6263-6265 | Suppresses base CSS application when an explicit `formatter` or static `content` is in use. |
  | `getDesignTarget(t)` | 6265-6277 | Builds the design DOM, binds `hidroppable` on every `td` (enables drag-drop of free elements into the cells). |
  | `getConfigOptions()` | 6277-6279 | Returns `HiPrintConfig.instance.table` — the entire `table` section of `hiprint.config.js`. |
  | `createTarget(t, e, n)` | 6279-6285 | Builds the wrapper `div.hiprint-printElement.hiprint-printElement-table` (Section L). |
  | `createGridColumnsStructure(t)` | 6285-6299 | Builds the multi-column grid layout (`gridColumns > 1`). |
  | `createtempEmptyRowsTargetStructure(t)` | 6299-6303 | Builds a clone with empty `<tbody>` used as the pagination scratch container. |
  | `getTableHtml(t, e)` | 6303-6309 | Builds the actual `<table>` with `<thead>`, `<tbody>` (rows from data), `<tfoot>` (summary footer). |
  | `getEmptyRowTarget()` | 6310-6312 | Returns a single empty `<tr>` template for `autoCompletion`. |
  | `getHtml(t, e)` | 6312-6317 | Public entrypoint; wraps `getPaperHtmlResult` with `createTempContainer` / `removeTempContainer`. |
  | `getPaperHtmlResult(t, e)` | 6317-6377 | Pagination loop — emits one `PaperHtmlResult` per paper page. |
  | `getRowsInSpecificHeight(t, e, n, i, o, r, tfh)` | 6377-6509 | Single-page row-fitting algorithm. |
  | `fixMergeSpan(tr, tbody)` | 6510-6535 | Re-computes `rowspan` for the first row of a paginated chunk when `rowsColumnsMerge` is in use and the row that "owns" the rowspan landed on a previous page. |
  | `autoCompletion(t, e, tfh)` | 6535-6545 | Pads the bottom of the last page with empty rows so the table reaches its bottom edge. |
  | `getData(t)` | 6545-6559 | Resolves the array of row objects from the data parameter or `testData`. |
  | `onResize(t, e, n, i, o)` | 6559-6564 | Re-calculates column widths on right-edge resize; sets a `pt`-precise `height` on the `<table>`. |
  | `getReizeableShowPoints()` | 6564-6566 | Returns `["n","s","w","e"]` — corners are disabled (no diagonal resize). |
  | `design(t, e)` | 6566-6624 | Wires `hidraggable` + `hireizeable` on the design wrapper, applies `position-locked` / `size-locked` classes. |
  | `setHitable()` | 6624-6652 | Instantiates the `HiTable` design helper, listens for `updateTable<id>` to re-render. |
  | `setColumnsOptions()` | 6652-6686 | Binds `click.hiprint` on every `thead td` so clicking a column header opens the per-column property panel. |
  | `filterOptionItems(t)` | 6686-6692 | Hides the `columns` tab when `editable === false` or only one row of columns exists. |
  | `getFooterFormatter()` | 6692-6700 | Resolves the table-footer formatter (from `printElementType.footerFormatter` or `options.footerFormatter` evaluated as a `Function` string). |
  | `getGridColumnsFooterFormatter()` | 6700-6708 | Same pattern for the grid-columns footer (multi-column layout). |

* **Returned at end of chain**: `TablePrintElement` [V1 line 6708-6709], wrapped
  in IIFE inheriting from `_BasePrintElement.a`.

### A.2 `tableCustomCell` — is it a real class?

* **No, it never was a class on the print element level.** It used to be a
  *registered etype tid alias*; the bundle now refuses to instantiate it
  [V1 line 10737-10739]:

  ```text
  if (n.type == 'tableCustom') {
    throw new Error(`${i18n.__("已移除'tableCustom',请替换使用'table'详情见更新记录")}`);
  }
  ```
* The "cell" data is the per-column object inside `options.columns[ri][ci]`
  (Section C). At print time it is materialised as a `<td>` by
  `TableExcelHelper.createRowTarget` [V1 line 2093-2233]. At design time it is
  wrapped by the `l.a` cell class (`d` inside bundle module 13) at
  [V1 line 1798-1875], which exposes:
  * `beginEdit()` [V1 line 1811-1816] — replaces cell DOM with an inline text
    editor.
  * `endEdit()` [V1 line 1817-1823] — writes value back via `.text()` (XSS
    safe; see `fix-discipline.md` rule).
  * `setAlign(t)` / `setVAlign(t)` [V1 line 1868-1872].
  * `select()` [V1 line 1864-1866] — adds `.selected` class for multi-select.
* For **header cells**, an extra wrapper `l` (alias `innerElement`) at
  [V1 line 1750-1791] adds `dblclick.hitable` to enter title-edit mode and
  understands the `title#field` syntax that `isEnableEditField` enables
  [V1 line 1763-1788].

### A.3 Support classes

| Class | Bundle range | Role |
|---|---|---|
| `TablePrintElementOption` (module 18) | 7384-7421 | Option entity — owns `columns`, `lHeight`, `autoCompletion`, `tableFooterRepeat`; exposes `getGridColumns()` (default 1) and `makeColumnObj()` flatten map. |
| `TableExcelHelper` (module 16) | 1924-2427 | All header/row/footer DOM builders. |
| `ReconsitutionTableColumns` (module 19) | 2284-2296 / 6766-6804 | Reshapes the 2-D `columns` config into a logical row/column tree understanding `rowspan` / `colspan`. |
| `HiTable` (module 8 inner `y` class) | 6920-7337 | Design-time interactive editor (selection, context menu, insert/delete/merge/split). |
| `HiTresizer` (module 8 inner `m` class) | 6807-6905 | Column-grip drag-to-resize widget overlaid on `thead`. |
| `GridColumnsStructure` (module 22 inner `i`) | 7442-7450 | Indexed access to the N grid columns inside `table-grid-row`. |
| `TableCell` (module 13 inner `d`) | 1798-1875 | Per-cell wrapper for selection + edit. |
| `TableHeaderInnerElement` (module 13 inner `l`) | 1750-1791 | Header cell dblclick title editor. |

---

## Section B — Top-level `table` options

These are the 35+ fields stored on `element.options` for a `table` element.
Every one is read at runtime by `TablePrintElement`, `TableExcelHelper`, or
the property-panel rendering. UI control identifiers in the third column are
the names from `config.table.tabs[*].options[*].name` (see
[config 887-1218]).

### B.1 Identity and data binding

| Field | Type | Default | Range / shape | UI control | What it does | V1 line read | V1 line default |
|---|---|---|---|---|---|---|---|
| `field` | string | `"table"` for `defaultModule.table` | dot-path | `field` (tab "基础") | Root data path; `getData()` does `field.split('.').reduce(...)` to find the array of rows [V1 line 6557]. | bundle 6557 | etype default: provider file [`default-etyps-provider.js` line 47] |
| `testData` | JSON-string | `'[{}]'` if absent | parseable JSON array | `testData` (tab "基础") | Design-time fallback row data. Parsed in `try/catch`; `[{}]` fallback on parse error [V1 line 6549-6554]. | bundle 6549-6554 | bundle 6549 |
| `title` | string | `"表格"` for the default etype | free | (read-only on `printElementType`) | The label shown in the component panel sidebar. | bundle 9168, 11882 | provider file 48 |

### B.2 Geometry

| Field | Type | Default | Range | UI control | What it does | V1 line read | V1 line default |
|---|---|---|---|---|---|---|---|
| `width` | number (pt) | `550` | > 0 | `widthHeight` | Outer width of the wrapper `div`. Drives column-width recomputation in `resizeTableCellWidth` [V1 line 2260-2267]. | bundle 6308, 6343 | config 1217 |
| `height` | number (pt) | undefined (auto) | > 0 | `widthHeight` | Used as `lHeight` upper bound for last-page total height [V1 line 6356]. After resize, written as `.css('height', ...)` on the `<table>` [V1 line 6562]. | bundle 6342, 6562 | n/a |
| `top` | number (pt) | from drop position | ≥ 0 | `coordinate` | Absolute `top` of the wrapper inside the panel. | bundle 6340 | n/a |
| `left` | number (pt) | from drop position | ≥ 0 | `coordinate` | Absolute `left` of the wrapper. | bundle 6341 | n/a |

### B.3 Pagination / repeat behavior

| Field | Type | Default | Range | UI control | What it does | V1 line read | V1 line default |
|---|---|---|---|---|---|---|---|
| `tableHeaderRepeat` | string | `"every"` (implicit) | `"every"` / `"first"` / `"none"` | `tableHeaderRepeat` | "every" repeats `<thead>` on every printed page; "first" removes it after page 1 [V1 line 6388-6390]; "none" removes it always (and in design draws it with `firebrick` background as warning) [V1 line 6390-6398]. Also affects whether headers are emitted on the print DOM [V1 line 6308]. | bundle 6308, 6388-6398 | n/a (defaults to `every`) |
| `tableFooterRepeat` | string | `"every"` (implicit) | `"every"` / `"last"` / `"no"` | `tableFooterRepeat` | "every" — `<tfoot>` rendered on each page (insertBefore tbody) [V1 line 6466]; "last" — only on last page (uses full `e` data, not per-page slice) [V1 line 1964]; "no" — never. Also influences pagination-height accounting: when not `"last"`, the `tfh` (footer height) is added to the per-row height check [V1 line 6452]. | bundle 6309, 6384-6386, 6452, 6461-6469 | n/a |
| `autoCompletion` | boolean | from drag default (depends on etype) | true/false | `autoCompletion` (tab "基础") | If true and the last paginated chunk does not fill `lHeight`/page height, append empty `<tr>`s until it does (or until `maxRows`). [V1 line 6535-6545]. | bundle 6535-6545 | n/a |
| `maxRows` | number | undefined | ≥ 1 | `maxRows` (tab "基础") | Hard cap on rows-per-page. When set, a page stops slicing once `h.length > +maxRows` even if vertical space remains [V1 line 6452]. Also caps `autoCompletion` to avoid infinite padding [V1 line 6539-6541]. | bundle 6452, 6539 | n/a |
| `lHeight` | number (pt) | undefined | > 0 | `lHeight` | "Last-row height" — guarantees the *last* paginated chunk reports at least this much vertical extent so subsequent absolutely-positioned elements line up [V1 line 6356]. | bundle 6356, 7387 | n/a |

> Note: V1 does **not** expose `rowsPerPage` directly — the row count per
> page is derived from vertical space + `maxRows`. The old `rowsPerPage`
> name does not appear anywhere in the bundle.

### B.4 Grouping

| Field | Type | Default | UI control | What it does | V1 line read | V1 line default |
|---|---|---|---|---|---|---|
| `groupFields` | string[] OR string of JSON | `[]` | (advanced; set on `printElementType` not options) | When non-empty, `TableExcelHelper.createTableRow` groups rows via `hinnn.groupBy` keyed by the listed fields [V1 line 2052, 2054]. Triggers `groupFormatter` header row + `groupFooterFormatter` row per group. | bundle 2052-2087 | provider file 51 |
| `groupFieldsFormatter` | function string | undefined | `groupFieldsFormatter` (tab "高级") | `function(type, options, data){ return ['field1','field2'] }` — alternative dynamic version. Evaluated via `new Function('return '+...)` inside try/catch [V1 line 2309-2313]. | bundle 2303-2314 | n/a |
| `groupFormatter` | function string | undefined | `groupFormatter` (tab "高级") | `function(colspan, allData, printData, group, options)` returning HTML for the group header row [V1 line 2060-2070]. Result is wrapped in `<tr>` if not already `<tr>` or `<td>`. | bundle 2060-2070, 2315-2322 | n/a |
| `groupFooterFormatter` | function string | demo string in provider | `groupFooterFormatter` (tab "高级") | Same shape as `groupFormatter`; emitted after each group's rows [V1 line 2078-2087]. Default demo: `"分组小计：共 N 条"` (provider 57). | bundle 2078-2087, 2323-2331 | provider file 57 |
| `groupSequenceContinue` | boolean | false | `groupSequenceContinue` (tab "高级") | If true, the per-row `sequenceIndex` continues across groups; otherwise it restarts at 0 in each group [V1 line 2074]. | bundle 2074 | n/a |

### B.5 Merge across rows/cells

| Field | Type | Default | UI control | What it does | V1 line read | V1 line default |
|---|---|---|---|---|---|---|
| `rowsColumnsMerge` | function string | undefined | `rowsColumnsMerge` (tab "高级") | `function(row, column, colIdx, rowIdx, tableData, printData)` returns `[rowspan, colspan]`. Per-cell merge attribute. Wrapped in try/catch — cell-level throw downgrades to `[1,1]` [V1 line 2103-2115]. | bundle 2103-2116 | n/a |
| `rowsColumnsMergeClean` | boolean | false | `rowsColumnsMergeClean` (tab "高级") | When `fixMergeSpan` re-anchors a `rowspan` to the new first row of a page, clears the cell text so it doesn't visually duplicate [V1 line 6529-6531]. | bundle 6529-6531 | n/a |

### B.6 Multi-column grid layout

| Field | Type | Default | UI control | What it does | V1 line read | V1 line default |
|---|---|---|---|---|---|---|
| `gridColumns` | number | `1` | `gridColumns` (tab "样式") | Number of side-by-side grid columns within a single table element (e.g. label-printer layouts that print 3 tables wide). `getGridColumns()` returns 1 if unset [V1 line 7411]. | bundle 7411, 6286-6298 | n/a |
| `gridColumnsGutter` | number (pt) | undefined | `gridColumnsGutter` (tab "样式") | Horizontal gutter between grid columns. (Used inside CSS for `.tableGridColumnsGutterRow` — bundle 6287.) | bundle 6287 | n/a |
| `gridColumnsFooterFormatter` | function string | undefined | `gridColumnsFooterFormatter` (tab "高级") | Footer rendered *below* the grid (full-width). Evaluated via `new Function('return '+...)` [V1 line 6700-6708]. Result appended to `.hiprint-gridColumnsFooter` [V1 line 6294-6296, 6477]. | bundle 6294, 6477, 6700-6708 | n/a |

### B.7 Cell-level (table-wide) text / typography

| Field | Type | Default | UI control | What it does | V1 line |
|---|---|---|---|---|---|
| `fontFamily` | string | inherit | `fontFamily` (样式) | CSS `font-family` on the wrapper. Falls back to `'SimSun'` via stylesheet [print-lock.css 146]. | print-lock.css 146 |
| `fontSize` | number (pt) | 9 | `fontSize` (样式) | CSS `font-size` on the wrapper. | print-lock.css 147 |
| `lineHeight` | number (pt) | 9.75 | `lineHeight` (样式) | CSS `line-height` on the wrapper; applied by the base `lineHeight` option. | print-lock.css 158 |
| `textAlign` | string | "left" | `textAlign` (样式) | CSS `text-align` for all cells unless a column overrides. | print-lock.css 154 |

### B.8 Table-level borders

All border-config options translate to one of the `hiprint-printElement-tableTarget-border-*` CSS classes (Section M).

| Field | Type | Default | UI control | V1 line |
|---|---|---|---|---|
| `tableBorder` | string | `"all"` (default look) | `tableBorder` (样式) | print-lock.css 189-214 |
| `tableHeaderBorder` | string | undefined | `tableHeaderBorder` (样式) | bundle 2615-2617 |
| `tableHeaderCellBorder` | string | undefined | `tableHeaderCellBorder` (样式) | bundle option-item; config 962-966 |
| `tableHeaderRowHeight` | number (pt) | undefined | `tableHeaderRowHeight` (样式) | applied as inline `style="height:Xpt"` on `<thead><tr>`; config 967-970 |
| `tableHeaderBackground` | color string | `"#e8e8e8"` (CSS) | `tableHeaderBackground` (样式) | print-lock.css 162 |
| `tableHeaderFontSize` | number (pt) | undefined | `tableHeaderFontSize` (样式) | config 975-978 |
| `tableHeaderFontWeight` | string | `700` (default thead) | `tableHeaderFontWeight` (样式) | print-lock.css 163 |
| `tableBodyRowHeight` | number (pt) | `18` (CSS) | `tableBodyRowHeight` (样式) | print-lock.css 234; explicit set in `createEmptyRowTarget` [V1 line 2243-2245] |
| `tableBodyRowBorder` | string | undefined | `tableBodyRowBorder` (样式) | config 988-994 |
| `tableBodyCellBorder` | string | undefined | `tableBodyCellBorder` (样式) | config 991-994 |
| `tableFooterBorder` | string | undefined | `tableFooterBorder` (样式) | config 995-998 |
| `tableFooterCellBorder` | string | undefined | `tableFooterCellBorder` (样式) | config 1000-1003 |

### B.9 Styler / formatter hooks (table-level)

| Field | Type | UI control | What it does | V1 line |
|---|---|---|---|---|
| `styler` | function string OR fn | `styler` (高级) | Table-element wrapper styler — same shape as base `BasePrintElement.styler`. | resolved by `BasePrintElement`; not bundle-specific |
| `rowStyler` | function string OR fn | `rowStyler` (高级) | `function(row, options)` returning `{prop: value}` for `<tr>`. [V1 line 2226-2231]. | bundle 2226-2231, 2339-2346 |
| `footerFormatter` | function string | `footerFormatter` (高级) | `function(options, allData, printData, pageData, pageIndex)` returning a `<tr>` (or HTML containing one) appended after the summary footer row [V1 line 2038-2041]. | bundle 2038-2041, 2331-2338 |
| `axis` | string | `axis` (高级) | Drag axis lock: `"h"` / `"v"` / unset. Forwarded to `hidraggable` [V1 line 6571]. | bundle 6571 |

### B.10 Designer-permissions (read off `printElementType`, copied through `ctable`)

These appear on the static `printElementType` (not in `options`), but every
table element sees them via `this.printElementType`:

| Field | Default (from `defaultModule.table`) | What it does | V1 line read | V1 line set on default |
|---|---|---|---|---|
| `editable` | `true` | Master switch: enables `HiTable`, column dblclick edit, context menu. False ⇒ no design interactivity. | bundle 6635, 9180 | provider 91 |
| `columnDisplayEditable` | `true` | Whether per-column "显示/隐藏" checkbox appears in the property panel. | bundle 6636 | provider 92 |
| `columnDisplayIndexEditable` | `true` | Whether columns can be reordered by dragging in the property panel's columns tab. | bundle 6637 | provider 93 |
| `columnResizable` | `true` | Enables `HiTresizer` column grips (drag header right edges to resize). | bundle 6638 | provider 95 |
| `columnAlignEditable` | `true` | Whether the "对齐" submenu appears in the right-click menu. | bundle 6639 | provider 96 |
| `columnTitleEditable` | `true` | Whether double-clicking a header opens the text editor. | bundle 6640 | provider 94 |
| `isEnableEditField` | `true` | When editing a header, enables the `title#field` two-part syntax so the user can edit `field` at the same time [V1 line 1763, 1782-1786]. | bundle 6641, 1763 | provider 97 |
| `isEnableContextMenu` | `true` | Master switch for the right-click context menu on header cells. | bundle 6642, 7202 | provider 98 |
| `isEnableInsertRow` | `true` | Enables "在上方/下方插入行" menu entries. | bundle 6643, 7206, 7216 | provider 99 |
| `isEnableDeleteRow` | `true` | Enables "删除行" entry. | bundle 6644, 7244 | provider 100 |
| `isEnableInsertColumn` | `true` | Enables "向左/右方插入列" entries. | bundle 6645, 7225, 7234 | provider 101 |
| `isEnableDeleteColumn` | `true` | Enables "删除列" entry. | bundle 6646, 7254 | provider 102 |
| `isEnableMergeCell` | `true` | Enables "合并单元格" / "解开单元格" entries (require multi-select / single-select respectively). | bundle 6647, 7309, 7318 | provider 103 |

### B.11 Position / size lock (shared with base element, but applied specially)

| Field | Default | What it does | V1 line |
|---|---|---|---|
| `positionLocked` | undefined | `design()` reads it [V1 line 6611] and if true, disables hidraggable + adds `.position-locked` class. Also masked out via `hidraggable('update', {draggable:false})` [V1 line 6620]. | bundle 6611-6622 |
| `sizeLocked` | undefined | Hides `.resizebtn` and adds `.size-locked` class so visual handles disappear [V1 line 6615-6617]. | bundle 6615-6617 |

### B.12 Other (less common)

| Field | Type | What it does | V1 line |
|---|---|---|---|
| `content` | HTML string | If set **and** no `field`, the table renders the literal HTML; `getTableHtml` parses it as a `<table>` template [V1 line 6305]. | bundle 6305 |
| `striped` | boolean | Stored on `printElementType` [V1 line 9182] but no styling consumer in the bundle — vestigial. | bundle 9182 |
| `fixed` | boolean | When true, the element repeats in every page header/footer band (handled at panel level, not table-specific). | base |

---

## Section C — Column-object schema (per-cell options inside `columns[ri][ci]`)

A column / cell object lives at `options.columns[rowIdx][cellIdx]`. There are
**two distinct shapes** depending on lifecycle:

* On the static `printElementType` (provider definition) the cell is a `u`
  / `r` instance — bundle 1793-1796 / 7355-7359.
* On the live `options.columns` it goes through `m` / `r` again with a few
  extra runtime fields (`id`, `targetWidth`, `hasWidth`, `targetEl`).

Each entry below is also a property-panel field (registered under
`tableColumn.supportOptions` in config 1779-1875).

| Cell option | Type | Default | What it does | UI control name | V1 line |
|---|---|---|---|---|---|
| `title` | string | "" | Header text; rendered via `.text()` [V1 line 1945]. The two-part `title#field` syntax is handled inside `endEdit` [V1 line 1783-1788]. | `title` | bundle 1902, 1945 |
| `descTitle` | string | "" | Optional secondary header text — used by `e.descTitle` capture in cell ctor [V1 line 1902]. | (none in `tableColumn.supportOptions` — internal) | bundle 1902 |
| `field` | string | "" | Source data key for this cell. `r.attr("field", t.field)` set on every `<td>` so `fixMergeSpan` can match cells across rows by their `field` [V1 line 2122, 6513-6519]. Nested paths like `"a.b"` are **not** auto-resolved here — only the table-level `field` is split with `reduce`. | column-edit (popup) | bundle 1902, 2122, 6513 |
| `width` | number (pt) | `100` | Logical width; combined with `allAutoWidth` ratio to determine actual pt width [V1 line 1902, 2247-2259]. | (resizer grips; column-edit popup) | bundle 1902, 2247-2259 |
| `fixed` | boolean | `false` | When true, `width` is exact (not scaled). `allFixedWidth` accumulates these separately and removes them from the scale base [V1 line 2276-2283]. | column-edit popup | bundle 1902, 2276 |
| `rowspan` | number | `1` | Header-row rowspan. Read in `reconsitutionTableColumnTree` to decide which logical row a cell belongs to [V1 line 6794-6803]. | column-edit popup | bundle 1902, 6794 |
| `colspan` | number | `1` | Header-row colspan. Used by `getOrderdColumns` to splat the cell across N logical columns of the bottom layer [V1 line 2387-2425]. | column-edit popup | bundle 1902, 2393 |
| `align` | string | "left" (CSS default) | `text-align` for body cells of this column [V1 line 2122, 2136]. | "对齐" submenu (`align`) | bundle 2122, 2136 |
| `halign` | string | undefined | "Header align" — if set, used for header `<td>` text-align (preferred over `align` for the header) [V1 line 1945]. | `halign` | bundle 1945, config 1788-1791 |
| `vAlign` | string | undefined | `vertical-align` for body cells [V1 line 2122]. | "对齐" submenu (`vAlign`) | bundle 2122 |
| `formatter` | function | undefined (the JS-supplied form) | `function(value, row, colIdx, options) => display`. Used when the etype is registered from JS code (not from JSON). | (advanced) | bundle 2138-2139, 2379-2386 |
| `formatter2` | function string | undefined (the JSON form) | Same as `formatter` but supplied as a string and `new Function('return '+...)`'d. Wrapped in try/catch [V1 line 2381-2385]. | `formatter2` | bundle 2381-2385 |
| `styler` / `styler2` | fn / string | undefined | Cell styler: `function(value, row, colIdx, options) => {prop:value}` [V1 line 2213-2220, 2355-2362]. | `styler2` | bundle 2355-2362 |
| `stylerHeader` | function string | undefined | Header-cell styler: `function(column) => {prop:value}` [V1 line 1946-1952, 2363-2370]. | `stylerHeader` | bundle 1946-1952, 2363-2370 |
| `renderFormatter` | function string | undefined | Replaces the *entire* `<td>` content with HTML — bypasses `.text()`. Output is treated as trusted (business-supplied) [V1 line 2140-2143]. | `renderFormatter` | bundle 2140-2143, 2371-2378 |
| `cellRender` | (none) | n/a | NOT a real V1 field. Equivalent functionality is `renderFormatter` above. Listed here to debunk the term that sometimes appears in business code: **V1 has no `cellRender`.** | — | n/a |
| `checkbox` | boolean | undefined | Marks the cell as a checkbox column — captured in ctor at [V1 line 1902] but no rendering consumer in this bundle (vestigial; was used by an older standalone widget). | — | bundle 1902 |
| `checked` | boolean | `true` | Display toggle. `false` removes the cell from header **and** body via `.filter(t => t.checked)` [V1 line 1939-1941, 2099]. The checkbox UI is `columnDisplayEditable`. | (column-display checklist) | bundle 1939, 2099 |
| `columnId` | string | falls back to `field` | Stable identifier used to wire header cells to the property-panel callback and to the resizer grips [V1 line 2253-2257, 6655-6685]. | (internal; written when user uses `#` syntax) | bundle 1902, 6655 |
| `id` | string | generated | DOM id, also used as the lookup key in `makeColumnObj()` [V1 line 7407]. | — | bundle 7407 |
| `tableColumnHeight` | number (pt) | depends on `tableTextType` | Height in pt of in-cell rendered media (barcode SVG / image / qrcode). [V1 line 2160, 2175, 2188]. | `tableColumnHeight` | bundle 2160, 2175 |
| `tableTextType` | string | `"text"` | One of `text` / `barcode` / `image` / `qrcode` / `sequence`. Drives rendering branch [V1 line 2145-2211]. `"sequence"` writes `rowIndex+1` [V1 line 2209-2211]. | `tableTextType` | bundle 2145-2211 |
| `tableBarcodeMode` | string | `"CODE128A"` | Passed as `format` to `JsBarcode` when `tableTextType==="barcode"` [V1 line 2153]. | `tableBarcodeMode` | bundle 2153 |
| `tableQRCodeLevel` | number | `0` | EC level (0=L,1=M,2=Q,3=H) for `QRCode` when `tableTextType==="qrcode"` [V1 line 2194]. | `tableQRCodeLevel` | bundle 2194 |
| `showCodeTitle` | boolean | undefined | When `tableTextType` is barcode or qrcode, show the raw value below the symbol [V1 line 2162-2164, 2198-2203]. | `showCodeTitle` | bundle 2162, 2198 |
| `upperCase` | string | undefined | Pre-processes summary footer numbers via `hinnn.toUpperCase` to Chinese capital form [V1 line 1981-1982, 1992-2024]. | `upperCase` | bundle 1981, 1992 |
| `paddingLeft` / `paddingRight` | number (pt) | undefined | Inline cell padding — set via option-item `paddingLeft` / `paddingRight` (config 1817-1823). | `paddingLeft` / `paddingRight` | config 1817-1823 |
| `tableSummary` | string | undefined | Summary aggregator. One of `count` / `sum` / `avg` / `min` / `max` / `text`. Activates the `<tfoot>` row for this column [V1 line 1989-2034]. | `tableSummary` | bundle 1989-2034 |
| `tableSummaryTitle` | bool/string | `true` (no `firebrick` warning) | Controls whether the auto-generated localized label (e.g. "合计:") is shown [V1 line 2043-2045]. | `tableSummaryTitle` | bundle 2043 |
| `tableSummaryText` | string | undefined | Override the auto label entirely (e.g. `"Total: "`) [V1 line 1977, 1991]. | `tableSummaryText` | bundle 1977 |
| `tableSummaryColspan` | number | `1` | Colspan of the summary cell — lets one `<td>` summary span several columns [V1 line 1980]. | `tableSummaryColspan` | bundle 1980 |
| `tableSummaryAlign` | string | `"center"` | `text-align` of the summary `<td>` [V1 line 1979]. | `tableSummaryAlign` | bundle 1979 |
| `tableSummaryNumFormat` | number | `2` | Decimal places for `hinnn.numFormat(sum, n)` [V1 line 1978, 1999]. | `tableSummaryNumFormat` | bundle 1978 |
| `tableSummaryFormatter` | function string | undefined | Per-column summary formatter; if it returns truthy HTML, replaces the auto `<td>` entirely [V1 line 1983-1988, 2347-2354]. | `tableSummaryFormatter` | bundle 1983, 2347 |
| `hasWidth` / `targetWidth` | runtime | n/a | Set by `createTableHead` after width calculation [V1 line 1945]. Internal only — do not write into JSON. | — | bundle 1945 |

> The full `tableColumn.supportOptions` list (i.e. what the property-panel
> *can* render) is at [config 1779-1875]: `title`, `align`, `halign`,
> `vAlign`, `tableTextType`, `tableBarcodeMode`, `tableQRCodeLevel`,
> `tableColumnHeight`, `showCodeTitle`, `paddingLeft`, `paddingRight`,
> `tableSummaryTitle`, `tableSummaryText`, `tableSummaryColspan`,
> `tableSummary`, `tableSummaryAlign`, `tableSummaryNumFormat`,
> `tableSummaryFormatter`, `upperCase`, `renderFormatter`, `formatter2`,
> `styler2`, `stylerHeader`.

---

## Section D — Multi-layer column header

### D.1 How V1 represents grouped headers

The `options.columns` is a **2-D array**:

```js
options.columns = [
  // row 0 of header (top-most row)
  [
    { title: "行号",   fixed: true,  rowspan: 2, field: "id",   width: 70 },
    { title: "人员信息", colspan: 2 },
    { title: "销售统计", colspan: 2 }
  ],
  // row 1 of header (sub-headers under the colspan groups above)
  [
    { title: "姓名",   align: "left", field: "name",  width: 100 },
    { title: "性别",                  field: "gender",width: 100 },
    { title: "销售数量",              field: "count", width: 100 },
    { title: "销售金额",              field: "amount",width: 100 }
  ]
];
```

(See provider file [`default-etyps-provider.js` line 59-90].)

* Outer index = **header row**, top-down.
* Inner index = cell within that header row.
* A cell with `colspan: N` will span N final columns; its sub-columns appear
  in row[1], etc.
* A cell with `rowspan: K` "punches through" K rows and so does **not** have
  a sub-row entry — see `reconsitutionTableColumnTree` [V1 line 6794-6803].

### D.2 How `columns[0]`, `columns[1]`, ..., `columns[N]` are interpreted

* `columns.length === totalLayer` of the header [V1 line 6796:
  `i.totalLayer = e + 1`].
* The deepest row (`columns[totalLayer-1]`) is special: this is the one that
  is used to render body cells in `createTableRow`. `getOrderdColumns`
  [V1 line 2387-2425] expands `colspan` and `rowspan` from upper layers into
  this bottom layer, and fills missing `field` values from the layer above
  ("把上层/其他层的 field 赋值给最下层" — comment at [V1 line 2405]).
* The result is exposed as `t.rowColumns` [V1 line 2424] — a *flat* array of
  bottom-layer cells used everywhere that body rendering happens.

### D.3 Rendering each row as `<thead><tr>...</tr></thead>`

`createTableHead` [V1 line 1934-1959]:

* Builds a new `<thead>` outer wrapper.
* For each `a` from `0` to `totalLayer - 1`, builds a `<tr>` and appends
  every `checked` cell as a `<td>` (note: V1 uses `<td>` inside `<thead>`,
  not `<th>` — this is intentional; see [V1 line 1942: `var n = $("<td></td>");`]).
* Per-cell logic for the header `<td>`:
  1. `n.attr("id", t.id)` and `n.attr("column-id", t.columnId)` [V1 line 1945].
  2. Text-align via `halign || align` [V1 line 1945].
  3. Vertical-align via `vAlign`.
  4. `colspan` / `rowspan` attrs if > 1.
  5. **`.text(t.title)` not `.html(...)` — XSS-safe** [V1 line 1945,
     comment 1943].
  6. Width: if `getColumnsWidth` returned a value, `haswidth="haswidth"` is
     attached and `width: Xpt` set [V1 line 1945].
  7. `stylerHeader` is applied if present.
* A parallel `<colgroup>` is built (one `<col>` per bottom-layer column)
  [V1 line 1954] and returned alongside `<thead>`.
* The function returns `[thead, colgroup]` [V1 line 1959].

At print time, `getTableHtml` decides whether to include the `<colgroup>`:

```js
return (this.isNotDesign && ['first','none'].includes(this.options.tableHeaderRepeat))
  ? o.append(headerList)        // both <thead> and <colgroup>
  : o.append(headerList[0]),    // only <thead>
```

[V1 line 6308].

### D.4 colspan / rowspan computation

* The 2-D `columns` is converted to a flat bottom layer by `getOrderdColumns`
  [V1 line 2387-2425]:
  1. For each layer, splat each cell into `colspan` clones (with their own
     `colspan: 1`) [V1 line 2393-2395].
  2. For each layer, push the cell down `rowspan` additional layers
     [V1 line 2398-2403].
  3. Inherit `field` from upper layers when a bottom cell has none
     [V1 line 2405-2422].
* The grid bookkeeping in design mode (insertColumn, deleteColumn, etc.) uses
  `getCellGrid` [V1 line 7147-7188]: it builds a 2-D `a` instance grid where
  each occupied logical cell is either `cell` (the owner) or `link` (a
  ghost cell consumed by rowspan/colspan).

---

## Section E — Pagination behavior

### E.1 Algorithm

`getPaperHtmlResult(t, e)` at [V1 line 6317-6377]:

1. Compute total data via `getData(e)` [V1 line 6319].
2. Build the live `<table>` via `getTableHtml(i, e)` (with **all** rows in
   `<tbody>`) — this is the "source" the paginator pulls from
   [V1 line 6320].
3. Build a separate empty-row scratch `<table>` via
   `createtempEmptyRowsTargetStructure(e)` — `<tbody>` is wiped [V1 line 6321-6322].
4. Measure the existing `<tfoot>` height (`tfh`) and remove it from the
   scratch table so it doesn't pollute height calculations
   [V1 line 6324-6325].
5. Loop `while (!l)`:
   1. Determine available height `d` for the current page via
      `t.getPaperFooter(s)` and the running `p` (the printLine offset)
      [V1 line 6326-6332].
   2. If `p > d` on page 0 and `panelPageRule !== "none"`, emit an empty
      placeholder page and start counting from page 1 [V1 line 6329-6332].
   3. Call `getRowsInSpecificHeight(...)` to fill **one** page's worth of
      rows [V1 line 6334].
   4. If the page had negative remaining height (`u < 0`), the page is too
      small to even hold one row → emit a red warning element with text
      `没有足够空间进行表格分页，请调整页眉/页脚线` [V1 line 6337-6350] and
      break.
   5. Append the page result to `n` (an array of `PaperHtmlResult`)
      [V1 line 6360-6372].
   6. Increment `s` (page index).

### E.2 `rowsPerPage` interaction with `maxPage`

V1 has **no** `rowsPerPage` or `maxPage` option. The closest field is
`maxRows`, which is per-page (Section B.3). To force the table onto a single
page set `panelPageRule: "none"` at the panel level — the pagination loop
short-circuits and dumps all rows into one page [V1 line 6399-6411].

### E.3 `tableHeaderRepeat` (repeat on every page)

Inside `getRowsInSpecificHeight` [V1 line 6388-6398]:

| Value | Page 0 | Page ≥ 1 | Design mode |
|---|---|---|---|
| `"every"` (default) | `<thead>` kept | `<thead>` kept | `<thead>` shown |
| `"first"` | `<thead>` kept | `<thead>` removed | `<thead>` shown but `none` background |
| `"none"` | `<thead>` removed (in print mode) | `<thead>` removed | `<thead>` shown with `firebrick` background (visual warning that print won't show it) |

When `panelPageRule === "none"` (no pagination) and there is real data, the
header `<tr>` is preserved but **moved into the body** so it appears once at
the very top [V1 line 6402-6411].

### E.4 Footer placement: last page only vs every page

`tableFooterRepeat`:

* `"every"` (default): footer rendered after every page's body [V1 line 6466].
* `"last"`: footer rendered only on the last page; the per-page slicer uses
  `h.length`/`r` correctly but appends the footer once at the bottom of the
  last page. The summary footer's `tSumData` switches from per-page (`r`) to
  full (`e`) [V1 line 1964].
* `"no"`: footer never rendered.

The footer height (`tfh`) is included in the per-row fit calculation only
when `tableFooterRepeat !== "last"` [V1 line 6452].

### E.5 Key V1 lines for the pagination algorithm

| Step | Bundle line |
|---|---|
| Top-level page loop | 6317-6377 |
| Per-page header logic | 6388-6398 |
| No-pagination branch | 6399-6411 |
| Single-row paginate (no-paging) | 6423-6440 |
| Single-row paginate (with-paging) | 6442-6457 |
| Footer insertion after page fill | 6461-6469 |
| `fixMergeSpan` for crossing-row merges | 6510-6535 |
| `autoCompletion` padding | 6535-6545 |
| End-of-loop empty-page or final emit | 6493-6509 |
| Red overflow warning | 6336-6350, 6481-6491 |

---

## Section F — Row data resolution

### F.1 How `field` resolves to an array

`getData(t)` [V1 line 6545-6559]:

```js
TablePrintElement.prototype.getData = function (t) {
  if (!t) {
    // 设计时表格 测试数据
    try {
      let testData = this.options.testData || '[{}]';
      return JSON.parse(testData);
    } catch (e) {
      console.error('[hiprint] table testData parse failed:', e);
      return [{}];
    }
  };
  var f = this.getField();
  var e = f ? f.split('.').reduce((a, c) => (a != null ? a[c] : undefined), t) ?? "" : "";
  return e ? JSON.parse(JSON.stringify(e)) : [];
};
```

* In design (no `t` parameter): parses `options.testData` (JSON string),
  fallback `[{}]` on parse error.
* In print (with `t` = data root): resolves `field` as a dot-path with **the
  hardened nullish reducer** so intermediate `0` / `false` don't leak (see
  rule `hiprint-bundle.md` for the original bug).
* Returns a **deep clone** via `JSON.parse(JSON.stringify(e))` so subsequent
  mutations (formatters, groupBy) don't pollute caller's data.

### F.2 Cell value resolution

In `createRowTarget` [V1 line 2138-2139]:

```js
var a = TableExcelHelper.getColumnFormatter(t),
    p = a ? a(e[t.field], e, i, n) : e[t.field];
```

* `e[t.field]` — a **single-level** field access on the row object.
* No `field.split('.').reduce(...)` — dot-paths in column `field` are
  **not** auto-resolved. Use a `formatter`/`formatter2` if you need nested.

### F.3 Empty cell handling

`r.text(p == null ? "" : p)` [V1 line 2145]:

* `null` / `undefined` → empty string.
* Numeric `0` → `"0"` (NOT empty).
* `false` → `"false"`.

### F.4 `testData` fallback rows

`testData` JSON-parsing branch already covered in F.1. If the JSON is malformed
the console gets `[hiprint] table testData parse failed:` followed by the
caught error [V1 line 6552], and rendering falls back to `[{}]` so the
designer remains usable.

### F.5 Field formatter chain per cell

Resolution order in `createRowTarget` per cell:

1. `renderFormatter` (if present) — writes `r.html(rf(...))` and skips
   further branches [V1 line 2140-2143].
2. Otherwise, branch on `tableTextType`:
   * `"text"` / undefined → `r.text(p)` where `p = formatter(value)` or
     `value` [V1 line 2145].
   * `"barcode"` → JsBarcode rendering [V1 line 2147-2168].
   * `"image"` → `<img src>` [V1 line 2169-2179].
   * `"qrcode"` → QRCode rendering [V1 line 2180-2208].
   * `"sequence"` → `r.html(rowIndex + 1)` [V1 line 2209-2211].
3. `getColumnStyler(t)` is applied last [V1 line 2213-2220].
4. `getRowStyler(n, i)` is applied to the whole `<tr>` [V1 line 2224-2231].

### F.6 `cellRender` / `renderFormatter`

* `cellRender` is **not a V1 field**.
* The equivalent is **`renderFormatter`** (string form, `new Function`'d via
  `getColumnRenderFormatter` [V1 line 2371-2378]).
* Signature: `function(value, row, colIdx, options, rowIndex) => "html"`.
* Output is treated as **trusted**; written via `r.html(...)` [V1 line 2143].
  Source comment notes: "renderFormatter 是业务方主动提供的 HTML 渲染回调;
  业务方负责其输出的 XSS 安全" — business code is responsible for sanitising
  the output (analogous to `useHtml` opt-in elsewhere).

---

## Section G — Merge cells (`rowsColumnsMerge`)

### G.1 Data model for merge metadata

`rowsColumnsMerge` is a **function string** (not a static config). It is
called once per body cell at render time and returns `[rowspan, colspan]`
for that cell [V1 line 2104-2115]:

```js
rowsColumnsMerge = new Function('return ' + n.rowsColumnsMerge)();
rowsColumnsArr = rowsColumnsMerge(row, column, colIdx, rowIdx, tableData, printData) || [1, 1];
```

When either rowspan or colspan is 0, the cell's `style.display` is set to
`"none"` and the attribute pair is written as-is — the rendered DOM keeps
the cell but hides it [V1 line 2116].

### G.2 How merge is computed at render time

* Per-cell: `createRowTarget` evaluates the function and writes
  `rowspan='K' colspan='J' style='display:none'` if either is 0
  [V1 line 2116].
* **Width compensation** when `colspan > 1` and there is no `<thead>`:
  width is recomputed by summing the widths of the spanned columns
  [V1 line 2124-2133].
* **Cross-page merge fix** (`fixMergeSpan`) [V1 line 6510-6535]: when the
  first row of a paginated chunk owns a cell with `rowspan="0"` (it was the
  continuation of a merged cell on the previous page), re-anchor the
  rowspan to this row by:
  1. Looking at the same-`field` cells in `tr.nextAll()`.
  2. Counting consecutive `rowspan=0` cells.
  3. Setting `td.attr("rowspan", newCount)` and `display: ""` on this cell.
  4. If `rowsColumnsMergeClean` is true, also `text("")` to avoid visual
     duplication of the merged value [V1 line 6529-6531].

### G.3 Visual feedback in designer

`rowsColumnsMerge` is only invoked at print time (where data exists). In
design mode `e` (the row object) is empty `{}` so the function may return
`[1,1]` trivially. Designers see the **unmerged** preview unless a
`testData` JSON contains keys the function actually inspects.

---

## Section H — Column editor / inline column UI (design time)

All of these only fire when `printElementType.editable === true`. They are
wired by `HiTable.setHitable()` [V1 line 6624-6651] and the inline header
edit handler [V1 line 1750-1791].

### H.1 Add a column at design time

Two ways:

1. **Right-click → "向左方插入列" / "向右方插入列"** — context menu items
   [V1 line 7224-7241]. Both call `HiTable.insertColumn(t)` [V1 line 6969-7049].
2. **No "+" button.** V1 does not show a `+` glyph anywhere in the table UI.

Insertion logic [V1 line 6969-7049]:

* For each row in the `cellGrid`, materialise a new cell.
* For the *top header row* (row 0 only), auto-assign:
  ```
  u.title = i18n.__('列') + ' ' + nextIdx;
  u.field = u.columnId = 'col' + nextIdx;
  u.getTarget().text(u.title).attr('column-id', u.columnId);
  ```
  Where `nextIdx` is computed by scanning existing `colN` fields
  [V1 line 6992-7003 (left) / 7022-7033 (right)].
* For lower header rows, just splice the new logical cell into place.
* For sub-rows blocked by a rowspan from above, the rowspan is extended by 1
  [V1 line 7005-7008 / 7038-7041].
* Triggers `newCell<id>` event so the resizer can rebuild grips
  [V1 line 7004, 7034].

### H.2 Remove a column

* Right-click → **"删除列"** [V1 line 7252-7260].
* Disabled when `rows[0].columns.length <= 1` (would leave zero columns)
  [V1 line 7257].
* Logic: `deleteColums` [V1 line 7072-7084]:
  * If the cell has `colspan === 1`, remove it.
  * Otherwise decrement `colspan` by 1 and update the DOM attribute.
  * Same logic for rowspan-linked cells in the grid.

### H.3 Reorder columns

The column property panel renders a **drag-sortable column list** when
`columnDisplayIndexEditable === true` (in property panel code outside this
file; the flag is captured at [V1 line 6637]). There is **no in-place
drag of header `<td>`s** — reordering is exclusively via the property panel
list.

### H.4 Edit a column's title / field / width / align

* **Title (or `title#field`)**: double-click the header `<td>` →
  `t.getTarget().dblclick(...)` [V1 line 1756] → `beginEdit(t)`
  [V1 line 1761] opens an inline `<textarea>`-like editor. On Enter / blur,
  `endEdit` writes back via `.text()` [V1 line 1790].
* **Field**: same flow; if `isEnableEditField` is true the editor value is
  `(title || "") + "#" + (field || "")` [V1 line 1772], and on commit the
  `#`-split assigns `title` and `field` [V1 line 1783-1786].
  * If `options.fields` is non-empty, a `<select>` editor is used instead
    of a free `<input>` so the user picks from a known list
    [V1 line 1763-1770].
* **Width**: dragging the `columngrip` overlays on the header row
  [V1 line 6817-6856]. Minimum cell width clamped to 10pt
  [V1 line 6846-6850].
* **Align**: right-click → "对齐" submenu → `setAlign` / `setVAlign`
  [V1 line 6566-6624 inside `HiTable.initContext`, specifically
  7262-7306].

### H.5 Inline-edit on the column title (contenteditable?)

V1 does **not** use `contenteditable` for table headers. Instead it
swaps the `<td>` contents for a `<textarea>` editor via
`r.Instance.createEditor("text")` [V1 line 1772]. This editor:

* Is a plain `<textarea>` (created by the option-item editor factory).
* Listens for `Enter` (keyCode 13) → commit [V1 line 1772-1774].
* Listens for `blur` → commit.
* On `change` (only when the `select` variant is used) → commit
  [V1 line 1766].

(Body cells, on the other hand, can be set `contenteditable` — see
[V1 line 771: `c.attr("contenteditable", true)`] which is the base-element
double-click handler at bundle 757-816, used for non-table elements.)

---

## Section I — Cell inline edit (body cell)

### I.1 Trigger

* `td.dblclick` fires the base `dblclick` handler at [V1 line 757] for all
  non-table elements; for table body cells, the trigger is `HiTable`'s own
  `dblclick` binding at [V1 line 1756] on the **header** wrapper cell, or
  for body cells, the per-cell `TableCell.beginEdit()` invoked from the
  selector mousedown/up handlers [V1 line 7116-7124].

### I.2 What gets edited

* **Header cell**: `title` (and optionally `field` via `#` syntax)
  [V1 line 1783-1788].
* **Body cell**: the cell's display *text* (whatever is currently in
  `<td>`). The editor is created with `r.Instance.createEditor("text")`
  [V1 line 1815] and the existing value is read via `this.target.text()`
  [V1 line 1828].

### I.3 Commit / cancel

* Commit triggers: Enter (keyCode 13) → `endEdit` [V1 line 1765, 1773];
  `blur` → `endEdit` [V1 line 1769, 1775]; `change` (select variant)
  → `endEdit` [V1 line 1767].
* On commit, the editor is `destroy()`'d and the value written back via
  `.text()` [V1 line 1790, 1821] — XSS-safe.
* On `tableOptions.editingCell` being already set (i.e. user dblclicks a
  second cell), the first cell's `endEdit` is invoked first
  [V1 line 1776, 7115].
* There is **no explicit Esc/cancel binding** — blur acts as commit. Esc
  is treated as a blur trigger by the browser only if it removes focus.

### I.4 Bundle line

* `beginEdit`: [V1 line 1811-1816] (body), [V1 line 1761-1791] (header).
* `endEdit`: [V1 line 1817-1823] (body), [V1 line 1778-1791] (header).

---

## Section J — Right-click context menu

Bound by `HiTable.initContext()` [V1 line 7200-7329]. Only fires when
`isEnableContextMenu === true` (master switch) [V1 line 7202].

### J.1 Standard menu entries

V1's table context menu is **table-only**; standard element actions (delete,
copy, lock) come from the wrapper element's own context menu, not from
HiTable.

### J.2 Table-specific entries (in order)

| Entry text (zh) | `enabled` flag | `disable` condition | Callback | V1 line |
|---|---|---|---|---|
| 在上方插入行 | `isEnableInsertRow` | no single cell selected | `insertRow("above")` | 7205-7212 |
| 在下方插入行 | `isEnableInsertRow` | no single cell selected | `insertRow("below")` (borderBottom: true) | 7214-7222 |
| 向左方插入列 | `isEnableInsertColumn` | no single cell selected | `insertColumn("left")` | 7224-7231 |
| 向右方插入列 | `isEnableInsertColumn` | no single cell selected | `insertColumn("right")` (borderBottom: true) | 7233-7241 |
| 删除行 | `isEnableDeleteRow` | no single cell selected OR only one row left | `deleteRow()` | 7243-7250 |
| 删除列 | `isEnableDeleteColumn` | no single cell selected OR only one column left | `deleteColums()` (borderBottom: true) | 7252-7260 |
| 对齐 (submenu) | `columnAlignEditable` | — | submenu of 8 entries: 左 / 左右居中 / 右 / 默认 (horizontal) / 上 / 垂直居中 / 下 / 默认 (vertical) | 7262-7306 |
| 合并单元格 | `isEnableMergeCell` | a single cell is selected (needs multi-select) | `mergeCell()` | 7307-7315 |
| 解开单元格 | `isEnableMergeCell` | no selection OR cell already 1×1 | `splitCell()` | 7316-7325 |

After applying any of the menu items, the entry triggers `updateTable<id>`
on `hinnn.event` so `TablePrintElement.setHitable`'s listener
[V1 line 6648-6651] can call `updateDesignViewFromOptions()` and then
`hiprintTemplateDataChanged_<templateId>` is fired with reason `"调整表头"`.

### J.3 Menu binding

* Menu is wired on `this.handle` — which is set to
  `this.designTarget.find(".hiprint-printElement-tableTarget:eq(0)").find("thead")`
  [V1 line 6634]. **Right-click only triggers from the header row.**
* Body-cell right-click is not bound separately; the user must right-click
  inside the header to access these items, even for "insert row" actions.

### J.4 Final filtering

Items with `enabled: false` are filtered out before menu construction
[V1 line 7326-7328]:

```js
}].filter(function (t) { return t.enabled; })
```

So disabling any of `isEnableInsertRow` / `isEnableDeleteRow` etc. truly
removes the entry; it does not just grey it out. (`disable` controls
runtime greying.)

---

## Section K — Footer / groupFooter

V1 supports **three** kinds of footer in a single table, in this DOM order:

1. **Per-group footer**: `groupFooterFormatter` — emitted inside `<tbody>`
   after each group's rows [V1 line 2078-2087].
2. **Summary footer row(s)**: built from per-column `tableSummary`
   aggregators — emitted as `<tfoot><tr>` [V1 line 1960-2037].
3. **Custom footer formatter**: `footerFormatter` — appended after the
   summary row inside `<tfoot>` [V1 line 2038-2041].
4. **Grid-columns footer**: `gridColumnsFooterFormatter` — emitted **below
   the table**, inside `.hiprint-gridColumnsFooter` (only when
   `gridColumns > 1`) [V1 line 6294-6296, 6477].

### K.1 footer template string or function

* Both `footerFormatter` and `groupFooterFormatter` accept either
  a function (from JS registration) or a string (from JSON), with
  `new Function('return ' + str)` evaluation [V1 line 2323-2338].
* Signature for `footerFormatter`:
  `function(options, allData, printData, pageData, pageIndex) => "html"`.
* Signature for `groupFooterFormatter`:
  `function(colspanTotal, allData, printData, group, options) => "html"`.

### K.2 `groupFooter` when grouping by a field

Grouping is keyed by `groupFields` (Section B.4). For each group:

1. `groupFormatter` emits a *header* row for the group [V1 line 2060-2070].
2. The group's rows are emitted in order, indexed by `sequenceIndex` (either
   continuous across groups or restarted per group, controlled by
   `groupSequenceContinue`) [V1 line 2073-2077].
3. `groupFooterFormatter` emits a *footer* row for the group, immediately
   after the rows [V1 line 2078-2087].

If the formatter returns a `<tr>`, it's appended as-is; if `<td>`, wrapped
in `<tr>...</tr>`; otherwise wrapped in `<tr><td>...</td></tr>`
[V1 line 2080-2086].

### K.3 Where footer DOM lives

```
<table.hiprint-printElement-tableTarget>
  <colgroup>...</colgroup>
  <thead>... (header rows) ...</thead>
  <tfoot>... (summary + footerFormatter) ...</tfoot>     ← inserted before <tbody> at bundle 6466
  <tbody>
    (group 0 header)
    (group 0 rows...)
    (group 0 footer)
    (group 1 header)
    ...
  </tbody>
</table>
```

The `<tfoot>` is positioned **before** the `<tbody>` element in DOM order
because some browsers' table layout requires `<tfoot>` to follow `<thead>`;
visually it still renders at the bottom of the table via the standard table
algorithm.

### K.4 Aggregation functions

Per-column `tableSummary` aggregator branch [V1 line 1989-2034]:

| Value | Computation | Display |
|---|---|---|
| `"count"` | filter truthy rows: `tSumData.filter(i => i).length` | `<title>` + count |
| `"sum"` | `fieldData.reduce((p,c) => p+c, 0)` then `numFormat` | `<title>` + sum |
| `"avg"` | `sum / (fieldData.length || 1)` then `numFormat` | `<title>` + avg |
| `"min"` | `Math.min(...fieldData) || 0`, `Infinity → 0` | `<title>` + min |
| `"max"` | `Math.max(...fieldData)`, `-Infinity → 0` | `<title>` + max |
| `"text"` | (no aggregation) | `tableSummaryText` only |
| any other / empty | (no aggregation) | `tableSummaryText` only (if `colspan >= 1`) |

`fieldData` is built by `tSumData.filter(r => r && r[column.field]).map(r => Number(r[column.field]) or 0)` [V1 line 1972-1976]. Non-numeric values are coerced to 0.

`upperCase` is applied after numeric formatting via
`hinnn.toUpperCase(upperCaseType, formattedValue)` [V1 line 1982, 1999,
2008, 2015, 2022] — used for Chinese capital-number renderings (e.g.
"壹仟贰佰元整").

---

## Section L — Render output DOM

### L.1 Full DOM tree skeleton (single grid column, default)

```
<div class="hiprint-printElement hiprint-printElement-table" style="position:absolute; top:Xpt; left:Ypt; width:Wpt; height:Hpt;">
  <div class="hiprint-printElement-table-handle"></div>     ← drag handle (design only)
  <div class="hiprint-printElement-table-content" style="height:100%;width:100%">
    <div class="hi-grid-row table-grid-row">                ← grid-columns wrapper
      <div class="tableGridColumnsGutterRow hi-grid-col" style="width:100%;">
        <table class="hiprint-printElement-tableTarget" style="border-collapse:collapse;">
          <colgroup>
            <col column-id="..." width="...pt"></col>
            ...
          </colgroup>
          <thead>
            <tr>
              <td id="..." column-id="..." colspan="..." rowspan="..." haswidth="haswidth" style="width:Xpt; text-align:...; vertical-align:...">Title</td>
              ...
            </tr>
            ... (more header rows for multi-layer headers)
          </thead>
          <tfoot>                                            ← only when tableFooterRepeat !== "no"
            <tr>
              <td style="text-align:center" colspan="1">合计: 1234.56</td>
              ...
            </tr>
            ... (footerFormatter row, if any)
          </tfoot>
          <tbody>
            <tr>                                             ← per-row; .data("rowData", row)
              <td field="..." style="text-align:...">value</td>
              ...
            </tr>
            ...
          </tbody>
        </table>
      </div>
      ... (more .hi-grid-col entries when gridColumns > 1)
      <div class="hiprint-gridColumnsFooter">...</div>       ← only when gridColumnsFooterFormatter set
    </div>
  </div>
</div>
```

* `position: absolute` on the wrapper [V1 line 6280].
* `border-collapse: collapse` on the `<table>` [V1 line 6307].
* `<td>` (NOT `<th>`) is used in `<thead>` — see [V1 line 1942].

### L.2 CSS classes per part

| Class | Where written | Bundle/CSS line |
|---|---|---|
| `.hiprint-printElement` | wrapper | bundle 6280 |
| `.hiprint-printElement-table` | wrapper | bundle 6280; print-lock.css 139 |
| `.hiprint-printElement-table-handle` | drag handle inside wrapper | bundle 6280; print-lock.css 241-253 |
| `.hiprint-printElement-table-content` | inner full-fill div | bundle 6280; print-lock.css 79 |
| `.hi-grid-row` + `.table-grid-row` | grid-columns outer row | bundle 6286; print-lock.css 347-350 |
| `.tableGridColumnsGutterRow` + `.hi-grid-col` | grid-columns column | bundle 6287; print-lock.css 352-355 |
| `.hiprint-gridColumnsFooter` | grid-columns footer container | bundle 6294; print-lock.css 357-360 |
| `.hiprint-printElement-tableTarget` | the `<table>` itself | bundle 6307; print-lock.css 166-187 |
| `.hiprint-printElement-tableTarget-border-all` etc. | applied based on `tableBorder` | print-lock.css 189-214 |
| `.hiprint-printElement-tableTarget-border-td-all` / `-none` | applied based on `tableBodyCellBorder` | print-lock.css 216-230 |
| `.hibarcode_imgcode`, `.hibarcode_displayValue` | barcode-cell SVG/text | bundle 2148-2150 |
| `.hiqrcode_imgcode`, `.hiqrcode_displayValue` | qrcode-cell containers | bundle 2183, 2199-2202 |
| `.hitable` | applied to `<table>` by `HiTable.init` | bundle 7113 |
| `.columngrips`, `.columngrip`, `.gripResizer`, `.columngripDraging` | column resizer overlays | bundle 6821, 6825, 6840 |
| `.rowgrips`, `.rowgrip`, `.rowgripDraging` | row resizer overlays (unused — `resizeRow: false`) | bundle 6864-6884 |
| `.selected` | applied to selected `<td>` | bundle 1865 |
| `.editing` | applied to editing `<td>` (via base) | bundle 793 (non-table) |
| `.position-locked`, `.size-locked` | wrapper lock state | bundle 6616, 6619 |

### L.3 Inline styles applied per cell

Header `<td>`:

* `id="..."` (random id from `hinnn.createId`) [V1 line 1945].
* `column-id="..."` (matches `options.columns[ri][ci].columnId`) [V1 line 1945].
* `text-align: halign || align` [V1 line 1945].
* `vertical-align: vAlign` [V1 line 1945].
* `colspan` / `rowspan` attrs (only when > 1) [V1 line 1945].
* `haswidth="haswidth"` attribute + `width: Xpt` (when width is auto-calculated) [V1 line 1945].
* Custom styler properties from `stylerHeader(column)` [V1 line 1946-1952].

Body `<td>`:

* `field="..."` [V1 line 2122, 2136].
* `text-align: t.align` [V1 line 2122, 2136].
* `vertical-align: t.vAlign` [V1 line 2122, 2136].
* `width: Xpt` (only when there is no header repeat AND rowsColumnsMerge is producing variable widths) [V1 line 2124-2134].
* `display: none` when `rowsColumnsMerge` returns `[0, 0]` etc. [V1 line 2116].
* `rowspan` / `colspan` attrs from `rowsColumnsMerge` [V1 line 2116].
* Custom styler properties from `styler2(value,row,colIdx,options)` [V1 line 2213-2220].

`<tr>` (body):

* `data("rowData", row)` — jQuery data binding used by `getRowsInSpecificHeight` to recover the source row [V1 line 2098, 6434, 6451].
* Custom styler properties from `rowStyler(row, options)` [V1 line 2224-2231].

---

## Section M — CSS classes and states

### M.1 `.hiprint-printElement-table` family

* `.hiprint-printElement-table` — wrapper (background transparent, fontSize 9pt, padding 0, lineHeight 9.75pt) — [print-lock.css 139-159].
* `.hiprint-printElement-table thead` — background `#e8e8e8`, font-weight 700 — [print-lock.css 161-164].
* `table.hiprint-printElement-tableTarget` — width 100% — [print-lock.css 166-168].
* `.hiprint-printElement-tableTarget, ... tr, ... td` — `border-color: rgb(0,0,0)`, padding 0/4/0/4pt, vertical-align middle, `word-wrap: break-word`, `word-break: break-all` — [print-lock.css 170-187].
* Border variants:
  * `-border-all`: `border: 1px solid` — [print-lock.css 189-191].
  * `-border-none`: `border: 0px solid` — [print-lock.css 192-194].
  * `-border-lr` / `-border-left` / `-border-right`: side borders — [print-lock.css 195-203].
  * `-border-tb` / `-border-top` / `-border-bottom`: top/bottom borders — [print-lock.css 205-213].
* TD-level border variants:
  * `-border-td-none td`: zero border — [print-lock.css 216-217].
  * `-border-td-all td:not(:nth-last-child(-n+2))`: right-border 1pt — [print-lock.css 219-220].
  * `-border-td-all td:last-child:first-child`: removes border for single-column tables — [print-lock.css 228-230].
* Default cell height: 18pt — [print-lock.css 233-235].
* Drag handle: 16×16pt rgba blue, SVG dots icon — [print-lock.css 241-253].

### M.2 Selected cell / editing cell / dragging column states

* `.selected` (added to `<td>` by `TableCell.select()`) — [V1 line 1864-1866]. No matching CSS in `print-lock.css`; the visual style comes from the designer's stylesheet (not in scope here).
* `.editing` — non-table base; for table body cells, the inline editor wraps the cell in its own `<input>` so there's no `.editing` class.
* `.columngrip` — invisible draggable handle on the column right-edge (height 30 by JS) — [V1 line 6889-6892].
* `.columngripDraging` — visual cue while dragging — [V1 line 6839-6840, 6851].

### M.3 Editing cell state

When `TableCell.beginEdit()` runs [V1 line 1815-1816]:

1. `this.target.empty()` — clears the `<td>`.
2. `editor.init(this)` + `editor.setValue(value)` — inserts an inline editor (`<textarea>` from `r.Instance.createEditor("text")`).
3. `this.tableOptions.editingCell = this` — single-cell-at-a-time invariant.

On `endEdit()` [V1 line 1817-1823]:

1. `editor.getValue()` → write back via `target.text(value)` (XSS-safe).
2. `editor.destroy()` — removes the editor.
3. `this.tableOptions.editingCell = null` — releases the lock (the `if` guard added in fix-discipline ensures stale references are cleared).

---

## Section N — Lock behavior

### N.1 `positionLocked`

* When true and `editable === true`, `design()` runs [V1 line 6611-6622]:
  1. `.resizebtn` (resize-handles overlay) hidden via `.hide()` — but this is part of the `_tblSizeLocked || _tblPosLocked` branch [V1 line 6615].
  2. `.size-locked` class added to the wrapper.
  3. `.position-locked` class added.
  4. `hidraggable('update', { draggable: false })` — disables drag at the
     interaction layer.
  5. Wrapped in try/catch with explicit warn message
     `[hiprint] hidraggable update failed (table posLock):` so a state
     mismatch doesn't kill the designer.

### N.2 `sizeLocked`

* Same branch as above. The condition `_tblSizeLocked || _tblPosLocked` is
  shared, so setting **either** lock hides resize handles. To hide *only*
  resize handles but keep dragging, set `sizeLocked: true` alone.

### N.3 Per-column locks

V1 has **no per-column lock options**. The `fixed` flag on columns
[V1 line 1902] is a *width-fix* (excluded from auto-scaling), not a
positional lock. To prevent users editing one column's title at design
time, the global `columnTitleEditable` is the only option.

---

## Section O — Property panel sections for `table`

The property panel reads `HiPrintConfig.instance.table.tabs` (config 887-1061)
and `tableColumn.supportOptions` (config 1779-1875) to know which fieldsets
to render.

### O.1 Tabs (top-level)

| Tab name (zh) | Option keys | Config range |
|---|---|---|
| 基础 | `field`, `testData`, `coordinate`, `widthHeight`, `tableHeaderRepeat`, `tableFooterRepeat`, `autoCompletion`, `maxRows`, `columns` | 889-928 |
| 样式 | `fontFamily`, `fontSize`, `lineHeight`, `textAlign`, `gridColumns`, `gridColumnsGutter`, `tableBorder`, `tableHeaderBorder`, `tableHeaderCellBorder`, `tableHeaderRowHeight`, `tableHeaderBackground`, `tableHeaderFontSize`, `tableHeaderFontWeight`, `tableBodyRowHeight`, `tableBodyRowBorder`, `tableBodyCellBorder`, `tableFooterBorder`, `tableFooterCellBorder`, `lHeight` | 929-1008 |
| 列 | `[]` (empty array → triggers special "列管理" UI) | 1009-1012 |
| 高级 | `axis`, `styler`, `rowStyler`, `footerFormatter`, `rowsColumnsMerge`, `rowsColumnsMergeClean`, `groupSequenceContinue`, `groupFieldsFormatter`, `groupFormatter`, `groupFooterFormatter`, `gridColumnsFooterFormatter` | 1013-1060 |

The "列" tab having an empty `options: []` is the convention V1 uses to ask
the property-panel renderer to substitute a custom **columns editor** UI in
place of the generic option-item list (config 1009-1012 with explicit
comment "留空即显示 表格 列 属性").

### O.2 Per-column editor (opens on header click)

When a header `<td>` is clicked [V1 line 6654-6685]:

1. Look up the cell by `column-id` / `id` via `getColumnByColumnId`.
2. Emit `getPrintElementOptionItemsByName("tableColumn")` — the property
   items registered for `tableColumn` (config 1778-1881).
3. Trigger `getPrintElementSelectEventKey()` with a `customOptionsInput`
   payload that includes:
   * `title`: `"<column.title> - 列属性"` (i18n'd).
   * `optionItems`: from `tableColumn.supportOptions`.
   * `options`: the column object itself.
   * `callback(t)`: when a control changes, the new value is written back
     to the column. Special handling for `title` field: if the value
     contains a `#`, splits into `title` and `columnId/field`, syncs the
     header DOM via `t.target.attr("column-id", ...)` and refreshes the
     textarea display [V1 line 6670-6675].

### O.3 `supportOptions` (un-tabbed)

The `table.supportOptions` (config 1062-1215) is the **superset** of
fields a programmer can configure via `setPrintElementTypeSupportOptions`
(or by passing `supportOptions` in `provider`). The tabs above are
the *default* layout; passing a custom `tabs` override re-arranges them.

---

## Section P — Known V1 quirks / bugs / limitations

### P.1 Performance with > 1000 rows

* The paginator clones DOM rows one by one (`a.find("tr:lt(1)")`,
  `d.find("tbody").append(f)`) and re-measures `outerHeight()` each
  iteration [V1 line 6442-6457]. This is O(n²) in worst case for very tall
  tables. Empirically ≥ 5000 rows blocks the main thread for several
  seconds during `getHtml`.
* Recommendation in production: pre-paginate at the data layer and call
  `getHtml` per chunk if you have > 2000 rows.

### P.2 Empty-data pagination edge cases

* `getData(undefined)` falls back to `[{}]` (one empty object) in design
  [V1 line 6549-6554]. The renderer will still produce one row.
* `getData(data)` with `field` resolving to `0` / `false` / `null` returns
  `[]` because of `e ? JSON.parse(...) : []` [V1 line 6558]. The table
  renders the header (and `<tfoot>` if any) and zero body rows.
* `autoCompletion: true` pads the empty area with rows up to `maxRows` (or
  until the visual height is filled).

### P.3 Single-row, exactly-`rowsPerPage`, off-by-one

* When a single row's height exceeds the available `<paperFooter - top>`
  space *and* it's the only row left, the paginator detects this and emits
  a red warning element containing the row, instead of attempting infinite
  pagination [V1 line 6481-6491]. Warning text:
  `没有足够空间,显示下方内容, 可分页高度: Xpx < 当前需要高度: Ypx`.
* `maxRows + autoCompletion` boundary: if `maxRows: 10` and only 7 rows
  exist, `autoCompletion` pads up to `maxRows` (10) [V1 line 6539-6541] —
  but only if the rendered table doesn't exceed page height.

### P.4 colspan/rowspan + pagination interaction

* When a `rowspan` cell starts on page N and the merge continues to page
  N+1, `fixMergeSpan` is called on the first row of page N+1 to re-anchor
  the rowspan [V1 line 6510-6535].
* The previous-page anchor cell still has its original `rowspan`, so the
  same value appears twice visually. `rowsColumnsMergeClean: true`
  blanks out the page-N+1 anchor text to mask the duplication.

### P.5 `testData` behavior

* `testData` is a **JSON string**, not an object — `JSON.parse(testData)`.
  Setting `testData: [{a:1}]` (an array literal) won't work in JSON-form
  templates; it must be `testData: '[{"a":1}]'` (or the property-panel UI
  serializes the user input as a string).
* Parse failure logs `[hiprint] table testData parse failed:` + error, and
  falls back to `[{}]` so the designer keeps working [V1 line 6551-6554].

### P.6 Single-grid-column footer ordering

* The summary `<tfoot>` is inserted **before** `<tbody>` in DOM order
  [V1 line 6466: `.insertBefore(d.find("tbody"))`]. Browsers visually
  render `<tfoot>` at the bottom regardless. PDF generators that don't
  honour HTML `<tfoot>` (e.g. naïve canvas-based PDF) may show the footer
  *above* the body — known PDF-export gotcha.

### P.7 `<th>` vs `<td>` in `<thead>`

* V1 uses `<td>` inside `<thead>` [V1 line 1942]. Some accessibility
  tooling (axe, JAWS) will not recognise this as a header. If a11y is a
  requirement, you must override the renderer or post-process the DOM.

### P.8 No `rowsPerPage` / `maxPage`

* Despite the user-summary mentioning these, **V1 has neither field**.
  Pagination is purely vertical-space-driven with `maxRows` as the only
  per-page hard cap.

### P.9 Header right-click only

* The context menu is bound on `thead`, not on the body
  [V1 line 6634, 7203]. Users who right-click a body cell get the browser
  context menu, not the table tools. This is an intentional V1 design
  choice — workaround: right-click any header to insert a row/column
  affecting the body row of the current selection.

### P.10 `editable: false` disables ALL design-time editing including
context menu

* `setHitable()` is gated on `printElementType.editable`
  [V1 line 6591: `this.printElementType.editable && this.setHitable()`]
  and on `setColumnsOptions()` (same call). When `editable: false`, even
  `isEnableContextMenu: true` won't show the menu, because
  `HiTable.initContext` never runs.

### P.11 `formatter` (string) vs `formatter` (function) at the column level

* The column-level field is named **`formatter2`** (string) in the
  property panel UI (config 1864-1866). The plain `formatter` field on
  the same column is reserved for the JS-supplied function version. If a
  template JSON contains a `formatter` (plain string) it is **not
  evaluated** — only `formatter2` is `new Function('return '+...)`'d
  [V1 line 2381-2385]. This is a footgun.

### P.12 `rowsColumnsMerge` re-eval per row

* `rowsColumnsMerge` is `new Function`'d **once per row inside the cell
  loop** [V1 line 2104] — the parse happens for every cell of every
  row. For 100-row × 8-column tables that's 800 `new Function` calls,
  ~50-200ms on cold cache. Cache the parsed function externally if you
  need speed.

### P.13 `groupFields` static vs dynamic

* If `groupFields` is set on `printElementType` (array of strings), it's
  serialised back into `groupFieldsFormatter` as a constant return
  function [V1 line 2305-2307]. This means runtime mutation of
  `printElementType.groupFields` after element creation is ineffective
  — only `groupFieldsFormatter` (the function form) responds to runtime
  changes.

### P.14 `setColumnsOptions` click binding is bound on every render

* `setColumnsOptions()` [V1 line 6652-6685] binds
  `thead td.click.hiprint`. Because the namespace is shared
  (`.hiprint`), each call after `updateDesignViewFromOptions` rebinds
  cleanly without leak. But if the same element is re-designed twice
  rapidly the previous handler is removed only when
  `updateDesignViewFromOptions` runs — not on `setHitable` itself.

### P.15 No `<thead>` for design when `tableHeaderRepeat === "none"`

* In design mode with `tableHeaderRepeat: "none"`, the `<thead>` row stays
  visible but is dyed `firebrick` (red) as a UX warning that print mode
  will hide it [V1 line 6395-6397]. This includes a `firebrick`
  background on both `<thead>` and `<thead> <tr>`.

### P.16 Grid-columns footer renders only once

* `gridColumnsFooterFormatter` is invoked **once per grid render**
  (during `getPaperHtmlResult` and at design refresh) and writes into
  `.hiprint-gridColumnsFooter` [V1 line 6294-6296, 6477]. It does *not*
  re-fire per page. If you want a per-page grid footer, use
  `footerFormatter` on each inner table instead.

### P.17 Resizer minimum width

* The column resizer clamps each cell to a 10pt minimum
  [V1 line 6846-6850]:
  ```js
  if (s.cell.width + o < 10) o = 10 - s.cell.width;
  else if (s.nextGrip.cell.width - o < 10) o = s.nextGrip.cell.width - 10;
  ```
  Below 10pt, drags are silently ignored. There is no user feedback.

### P.18 `gridColumns > 1` and pagination interact poorly

* When `gridColumns > 1`, each grid column gets its **own** `<table>`
  instance but they share the same pagination loop. The current
  implementation iterates `for u = 0; u < getGridColumns; u++` *inside*
  the per-page slicer [V1 line 6420-6473]. This means uneven row heights
  across grid columns can shift the per-page totals.

### P.19 `splitCell` only undoes uniform merges

* `HiTable.splitCell()` [V1 line 7097-7110] assumes the selected cell's
  `rowspan` × `colspan` is a clean rectangle. Non-rectangular merges
  (rare but constructable via repeated mergeCell on disjoint selections)
  may produce extra orphan cells.

### P.20 No `<th>` semantics for sticky headers

* V1's `tableHeaderRepeat` only repeats `<thead>` in print DOM. There is
  no CSS `position: sticky` applied. For on-screen preview with
  long tables you don't get a sticky header.

---

## Cross-reference index

| Behavior | Primary V1 line | Secondary V1 line |
|---|---|---|
| Constructor | bundle 6245-6249 | — |
| Render entrypoint | bundle 6312-6317 | bundle 6317 |
| Pagination loop | bundle 6317-6377 | bundle 6377-6509 |
| Header rendering | bundle 1934-1959 | bundle 6308 |
| Row rendering | bundle 2046-2092 | bundle 2093-2233 |
| Footer rendering | bundle 1960-2042 | bundle 6464-6467 |
| Empty-row autoCompletion | bundle 6535-6545 | bundle 2234-2246 |
| Column resizer | bundle 6807-6905 | bundle 6817-6856 |
| Inline column editing | bundle 1750-1791 | bundle 6624-6651 |
| Inline cell editing | bundle 1798-1875 | bundle 1811-1823 |
| Context menu | bundle 7200-7329 | bundle 6624-6651 |
| getCellGrid (insert/delete) | bundle 7147-7188 | bundle 6969-7110 |
| Merge cell logic | bundle 7085-7110 | bundle 2103-2116, 6510-6535 |
| Grouping | bundle 2046-2087 | bundle 2303-2330 |
| Summary footer aggregators | bundle 1960-2037 | bundle 2347-2354 |
| `getData` (data resolution) | bundle 6545-6559 | — |
| Property panel column click | bundle 6652-6685 | bundle 6660-6680 |
| CSS class skeleton | print-lock.css 139-235 | print-lock.css 347-360 |
| `tableCustom` removal error | bundle 10737-10739 | — |
| Default etype `defaultModule.table` | provider 46-104 | provider 105-131 (emptyTable) |
| Default config block `table.default` | config 887-1218 | — |
| Default config block `tableColumn.supportOptions` | config 1778-1881 | — |
