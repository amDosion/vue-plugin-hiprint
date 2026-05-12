# Toolbar Architecture Codemap

**Last Updated:** 2026-05-12
**Source:** `src/hiprint/hiprint.bundle.js` (lines 13384–14935; `_toolbarUid` @ 13389, `_toolbarClickNs` @ 13390)

## Entry Point

```js
buildToolbar(container: HTMLElement, template: PrintTemplate, opts: object) → toolbarCtrl
```

Called by:
- Direct: `import { buildToolbar } from 'vue-plugin-hiprint'`
- Internal: `buildDesigner()` creates toolbar first

## 12 Button Groups (Rendering Order)

| Group Key | Buttons | Key Control | Defaults |
|-----------|---------|------------|----------|
| `businessSelect` | business selector | `showBusinessSelect` | onBusinessClick → onBusinessSelect |
| `templateSelect` | template selector | `showTemplateSelect` | onTemplateSelect → template pick |
| `paper` | paper type presets + custom | `showPaperSelect` / `showCustomPaper` | setPaper(w,h) |
| `scale` | zoom ±, current level | `showScale` | template.zoom(v) |
| `rotate` | rotate paper 90° | `showRotate` | template.rotatePaper() |
| `align` | 8 alignment buttons | `showAlign` | template.alignElements(type) |
| `preview` | preview | `showPreview` | hook only (no default) |
| `panels` | panel select + add | `showPanelManager` | segmented dropdown + add button |
| `clear` | clear canvas | `showClear` | confirm + clear() |
| `print` | print hook | `showPrint` | hook only |
| `save` | save template | `showSave` | dialog → download JSON |
| `extra` | custom buttons | `extraButtons[]` | user defined |

## Key Options

```js
{
  // Business flow
  showBusinessSelect: true,
  businessListProvider: fn,           // data source
  businessLoader: fn,                 // async load
  onBusinessClick: fn,                // intercept
  onBusinessDialogOpen/Close: fn,
  onBusinessSelect: fn,               // selected callback
  onBusinessSelectError: fn,          // error callback

  // Template selection
  showTemplateSelect: true,
  templateListProvider: fn,
  templateLoader: fn,
  onTemplateSelect/Preview/Edit/Delete: fn,
  onTemplateDeleteConfirm: fn,
  onTemplateSelectError: fn,

  // Paper & custom
  showPaperSelect: true,
  showCustomPaper: true,
  paperTypes: [{name, w, h}],         // replace default
  onPaperChange: fn,

  // Scale zoom
  showScale: true,
  scaleMin: 0.5,
  scaleMax: 2,
  scaleStep: 0.1,
  onScaleChange: fn,

  // Rotate
  showRotate: true,
  rotateButtonText: '旋转',

  // Align — can completely customize
  showAlign: true,
  alignItems: [
    { type: 'left', label: '左对齐', icon: 'xxx' },
    // ... replace all 8 defaults
  ],

  // Panel manager (分页)
  showPanelManager: false,                      // default hidden
  panelManagerLabel: '分页',
  addPanelButtonText: '+',

  // Pagination (canvas bottom)
  showPagination: false,                        // default hidden

  // Preview / Print / Save
  showPreview: true,
  onPreview: fn,                                // required (no default)
  showPrint: true,
  onPrint: fn,
  showSave: true,
  onSave: fn,                                   // (template, json, event, api, {name})
  onSaveDialogOpen/Close: fn,

  // Clear
  showClear: true,
  onClear: fn,
  onClearConfirm: fn,                           // Promise, async confirm
  
  // Custom paper
  onCustomPaperOpen: fn,                        // Promise callback

  // Extra buttons
  extraButtons: [
    {
      key: 'export-pdf',
      label: '导出',
      icon: 'ep:download',
      type: 'primary',
      visible: fn or bool,
      disabled: fn or bool,
      onClick: (template, event, api) => {}
    }
  ],
  extraPosition: 'end',                         // 'start' | 'end'
}
```

## Internal State (Per Instance)

```js
{
  _toolbarUid: string,                          // unique namespace
  toolbarButtonRegistry: {key: {$el, groupKey}},
  toolbarGroupRegistry: {groupKey: $group},
  scaleValue: number,
  businessItems: [],
  templateItems: [],
  $businessDialog: jQuery|null,
  $templateDialog: jQuery|null,
  $saveDialog: jQuery|null,
  toolbarApi: { /* public methods */ },
  toolbarCtrl: { /* return value */ }
}
```

## 3 Extension Mechanisms

### ① extraButtons (Most common)
- Declarative array + onClick handler
- Built-in UI rendering (XSS safe via .text)
- Can use position: 'start' | 'end'

### ② Slot / Hook Callbacks
- onBusinessSelect, onTemplateSelect, onPreview, onPrint, onSave
- Can intercept or fully replace behavior

### ③ Direct Button Manipulation
- toolbarApi.show/hideButton(key)
- toolbarApi.disableButton(key)
- Lower level, manual control

## Event Binding

- jQuery event namespace: `${_toolbarUid}.${_toolbarClickNs}`
- Precise bind/unbind to avoid leaks
- All destroyed on toolbar cleanup

## Related

- See [../TOOLBAR-ARCHITECTURE.md](../TOOLBAR-ARCHITECTURE.md) for usage examples
- See [../API-REFERENCE.md](../API-REFERENCE.md) for complete buildDesigner options
