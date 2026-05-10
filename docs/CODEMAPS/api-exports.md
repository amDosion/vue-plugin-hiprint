# API Exports Codemap

**Last Updated:** 2026-05-10
**Source:** `src/index.js` (142 lines)

## 23 Total Exports

All exports from `import { ... } from 'vue-plugin-hiprint'`:

### Core (6)
```
hiprint              → hiprint.bundle.js main export
hiPrintPlugin        → Vue plugin (app.use)
defaultElementTypeProvider → class
PrintTemplate        → main print template class
PrintElementTypeManager → element type registry
PrintElementTypeGroup → element grouping
```

### Element Type Config (5)
```
setDynamicFields(moduleName, groups)
removeDynamicFields(moduleName)
setElementTypeGroups(moduleName, groups)
appendElementTypeGroups(moduleName, groups)
renameElementType(tid, title)
```

### Designer Builder (2)
```
buildToolbar(container, template, opts) → toolbarCtrl
buildDesigner(container, opts) → designer with toolbar
```

### Print / HTML (3)
```
print(provider, template, ...args) .bind(hiprint)
print2(provider, template, ...args) .bind(hiprint)
getHtml(template, ...args) .bind(hiprint)
```

### Client / Silent Print (5 methods — all .bind(hiprint))
```
getClients() → list of connected clients
getClientInfo(clientId) → client details
getAddress(type, callback, ...args) → fetch client address
ippPrint(options) → IPP protocol print
ippRequest(options) → IPP request
```

### Socket Connection (2)
```
autoConnect(cb) → window.hiwebSocket.start(cb)
disAutoConnect() → window.hiwebSocket.stop()
```

## Why .bind(hiprint)?

Functions `print`, `print2`, `getHtml`, and 5 client methods use `.bind(hiprint)` because:
- Internal code uses `this.getHtml()`, `this.socket`, etc.
- When destructured (`import { print }`), `this` is lost in strict mode → TypeError
- Binding ensures `this` stays bound to hiprint object at call time

## Version

- `hiprint.version` ← from `package.json.version`

## Entry Point

- `/dist/vue-plugin-hiprint.esm.js` - main entry
- `/dist/vue-plugin-hiprint.cjs.js` - CommonJS
- `/dist/vue-plugin-hiprint.umd.js` - UMD (unpkg / jsdelivr)
