# Core Bundle Codemap

**Last Updated:** 2026-05-11
**Source:** `src/hiprint/hiprint.bundle.js` (15344 lines)

## Architecture

```
hiprint (global object)
├── PrintTemplate (class, ~2000 lines)
│   ├── design(selector, opts) → full designer
│   ├── update(json) / getJson() → template IO
│   ├── print(data, opts) → browser preview
│   ├── print2(data, opts) → client silent print
│   ├── getHtml(data, opts) → HTML string
│   ├── toJpeg() / toPdf(args, filename) → export
│   ├── destroy() → cleanup (NEW, idempotent)
│   ├── setPaginationVisible(show) → toggle pagination bar (NEW)
│   ├── isDestroyed → boolean property (NEW)
│   └── on(eventName, cb) → event listener
│
├── PrintElementTypeManager (class)
│   ├── add(type, opts)
│   ├── remove(typeId)
│   └── get(typeId) → PrintElementType
│
├── PrintElementTypeGroup (class)
│   ├── add(type)
│   └── getTypes() → []
│
└── Core Functions
    ├── buildDesigner(sel, opts) → designer UI
    ├── buildToolbar(sel, template, opts) → toolbar UI
    ├── setDynamicFields(module, groups)
    ├── removeDynamicFields(module)
    ├── setElementTypeGroups(module, groups)
    ├── appendElementTypeGroups(module, groups)
    ├── renameElementType(typeId, label)
    ├── print(provider, template, ...args) .bind
    ├── print2(provider, template, ...args) .bind
    ├── getHtml(template, ...args) .bind
    ├── getClients() .bind (NEW)
    ├── getClientInfo(id) .bind (NEW)
    ├── getAddress(type, cb, ...args) .bind (NEW)
    ├── ippPrint(opts) .bind (NEW)
    ├── ippRequest(opts) .bind (NEW)
    ├── getClientSocket() → socket or null
    └── i18n() → translation wrapper
```

## PrintTemplate Key Methods

### Design & I/O
```js
design(selector, opts)                 // render full designer with toolbar + panels
update(json)                           // replace template
getJson()                              // export template JSON
getJsonTid()                           // export with field name → type id mapping
```

### Printing
```js
print(data, opts)                      // browser print preview
print2(data, opts)                     // client silent print
getHtml(data, opts)                    // raw HTML string
```

### Export
```js
toJpeg()                               // → Promise<Blob>
toPdf(args, filename)                  // → Promise<void>
```

### Lifecycle (NEW)
```js
destroy()                              // (line 12567) idempotent cleanup:
                                       // • abort in-flight global drag (draging=false + remove body class)
                                       // • remove event subscriptions
                                       // • clear canvas elements
                                       // • remove panel manager UI
                                       // • deregister from singleton map
                                       // • mark _destroyed = true

_assertNotDestroyed(name)              // (line 12545) shared guard helper.
                                       // Used by 16+ public methods:
                                       //   if (this._assertNotDestroyed('getJson'))
                                       //     return <safe fallback>;
                                       // Logs `[hiprint] <name> called on destroyed template`
                                       // once per call. Replaces ad-hoc
                                       // `if (this._destroyed) return ...` checks.

isDestroyed()                          // (line 12542) public getter, returns
                                       // !!this._destroyed for business code
                                       // (replaces direct read of private _destroyed).

design(selector, opts)                 // (line 12366) idempotent. Twice-call
                                       // (HMR / KeepAlive re-mount) detects
                                       // `this._designed` and runs cleanup:
                                       // container.find('*').off('.hiprint') +
                                       // container.empty() before re-binding.
                                       // Prevents accumulated jQuery handler leaks.
```

### Pagination (NEW)
```js
setPaginationVisible(show: bool)       // toggle canvas bottom pagination bar
```

### Events
```js
on(eventName, cb)
  'hiprintTemplateDataChanged_' + id   // data mutation (clear/add element/etc)
  'hiprintTemplateSaved_' + id         // template saved
  'hiprintTemplateSelectPanel_' + id   // panel selected
```

## PrintTemplate Options

```js
new PrintTemplate({
  template: {},           // JSON object or {}
  dataMode: 1,            // 1: single object, 2: array
  pid: undefined,         // custom print ID
})
```

## Key Modules (Internal)

| Module | Purpose |
|--------|---------|
| DefaultElementTypeProvider | built-in element types (text, barcode, QR, line, table, rect, etc.) |
| PrintElementType | element render/drag/property logic |
| Canvas Manager | DOM element layer, guide lines, grid snap, drag-drop |
| PagePanel Manager | multi-page UI (segmented select + add button) |
| Designer Panel Manager | left sidebar element type panel |
| Property Panel | right sidebar element property editor |
| Socket (hiwebSocket) | WebSocket client for silent print (optional) |

## A11y Additions (v1.0.0)

- `focus-visible` border on all interactive elements
- `aria-pressed` on toggle buttons
- `button type="button"` / `type="submit"` explicit
- Dialog `.role="dialog"` + aria-labelledby/describedby
- Popover `.role="dialog"` + aria-hidden
- Panel manager keyboard: arrow keys to navigate, Enter/Space to select
- Drag-drop keyboard support (Space to drag, arrow keys to move)

## Recent Fixes (25+ commits summary)

- Round 1-5: security (XSS vectors closed), this-binding (all 5 client methods .bind), destroy safety (idempotent, guards checks)
- A11y: focus-visible, aria attributes, button types, dialog/popover roles, keyboard nav
- Panel manager UI refactored to segmented component (v1.0.0)
- Pagination bar now default hidden (showPagination: false)
- Silent failure guards: methods after destroy() return undefined + warn
- Field override: nested paths support (customer.name, address.0.line1)
- Refactor (c0fd3a1): introduced `PrintTemplate.prototype._assertNotDestroyed`
  for unified destroy guards, and `_safeCall(fn, args, name)` for unified
  business-callback isolation.
- R3 round: `_safeCall` promoted to **module-level** (shared by buildToolbar +
  buildDesigner). New module-level helper `_evalCap(src, name)` (security M3)
  caps formatter / styler string length at 5000 chars before `new Function`,
  defending against malicious template JSON. `design()` got `_designed`
  idempotency guard. `deletePanel()` got editingPanel re-select semantics.
  `destroy()` got step 0 drag-state abort. `isDestroyed()` exposed as public
  getter. All `$(document)` handlers in buildDesigner now use
  `_designerEventNs` namespace.

## Key Function Line Numbers (R3, bundle = 15344 lines)

| Function | Line |
|----------|------|
| `BasePrintElement.prototype.getDesignTarget` | 735 |
| `BasePrintElement.prototype.getData` | 1265 |
| `t.prototype.addPrintElementTypes` (PrintElementTypeManager) | 8961 |
| `t.prototype.removePrintElementTypes` | 9011 |
| `PrintPanel.prototype.getHtml` | 11077 |
| `PrintPanel.prototype.droppablePaper` | 11237 |
| `PrintPanel.prototype.clear` | 11293 |
| `PrintTemplate` (`ct = function () { ... }`) class start | ~12244 |
| `PrintTemplate.prototype.design` (idempotency guard) | 12366 |
| `PrintTemplate.prototype.getHtml` | 12451 |
| `PrintTemplate.prototype.selectPanel` | 12484 |
| `PrintTemplate.prototype.deletePanel` (editingPanel re-select) | 12491 |
| `PrintTemplate.prototype.getJson` | 12528 |
| `PrintTemplate.prototype.isDestroyed` (NEW public getter) | 12542 |
| `PrintTemplate.prototype._assertNotDestroyed` | 12545 |
| `PrintTemplate.prototype.clear` | 12559 |
| `PrintTemplate.prototype.destroy` | 12567 |
| `PrintTemplate.prototype.toPdf` | 12767 |
| `_safeCall(fn, args, name)` (module-level, R3) | 13234 |
| `_evalCap(src, name)` (module-level, R3 security M3) | 13242 |
| `function buildToolbar` | 13296 |
| `_toolbarUid` declaration | 13301 |
| `_toolbarClickNs` | 13302 |
| `function buildDesigner` | 14850 |
| `_designerUid` declaration | 14881 |
| `_designerEventNs` declaration | 14882 |

## Related

- See [./api-exports.md](./api-exports.md) for public API
- See [./toolbar-architecture.md](./toolbar-architecture.md) for toolbar UI
- See [../SMOKE-TEST.md](../SMOKE-TEST.md) for test coverage
