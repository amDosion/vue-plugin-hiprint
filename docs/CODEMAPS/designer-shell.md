# Designer Shell Codemap

**Last Updated:** 2026-05-10
**Source:** `src/standalone/designer-shell.vue` (~350 lines)

## Purpose

Development entry point shell for testing hiprint designer in Vue 3 context. Not shipped in dist.

## Architecture

```vue
<template>
  <div id="app" class="app-container">
    <!-- Version & repo link -->
    <header>...</header>
    
    <!-- Designer container (buildDesigner mounts here) -->
    <div id="hiprintDesigner" class="designer-wrapper"></div>
  </div>
</template>

<script setup>
  // Initialize
  hiprint.init({ providers: [defaultElementTypeProvider] })
  
  // Create template
  const hiprintTemplate = new PrintTemplate({ template: {} })
  
  // Build designer
  buildDesigner('#hiprintDesigner', {
    showBusinessSelect: true,
    showTemplateSelect: true,
    showPanelManager: true,         // ← enabled for dev testing
    toolbarOptions: { ... }
  })
</script>

<style>
  #hiprintDesigner {
    padding: 8px;                   /* safe padding for toolbar + panels */
    height: calc(100vh - 8px);
  }
</style>
```

## Template & Options (Setup)

```js
// Empty template — designer renders blank canvas
const hiprintTemplate = new PrintTemplate({
  template: {},
  dataMode: 1,
})

buildDesigner('#hiprintDesigner', {
  templateOptions: {
    template: hiprintTemplate,
    showPagination: false,          // canvas bottom pagination hidden by default
  },
  toolbarOptions: {
    // Business selection flow (dev testing)
    showBusinessSelect: true,
    businessListProvider: () => [
      { id: 'order', name: '订单打印' },
      { id: 'shipping', name: '发货单' },
    ],
    onBusinessSelect: (item) => {
      console.log('Selected business:', item)
    },

    // Template selection
    showTemplateSelect: true,
    templateListProvider: () => [
      { id: 'tpl1', name: 'A4 订单' },
      { id: 'tpl2', name: '8×5 标签' },
    ],
    onTemplateSelect: (tpl) => {
      console.log('Selected template:', tpl)
    },

    // Panel manager (分页) — enabled for UI testing
    showPanelManager: true,
    panelManagerLabel: '分页',
    addPanelButtonText: '+',

    // Alignment customize (example)
    // alignItems: [ /* custom list */ ],

    // Clear confirmation
    onClearConfirm: (template) => {
      return new Promise((resolve) => {
        if (confirm('Clear canvas?')) {
          template.clear()
          resolve(true)
        }
      })
    },

    // Extra buttons (example)
    extraButtons: [
      {
        key: 'export-pdf',
        label: 'Export PDF',
        icon: 'ep:download',
        type: 'primary',
        onClick: (template) => {
          template.toPdf({}, 'export.pdf')
        }
      }
    ],
    extraPosition: 'end',
  }
})
```

## CSS Layout

Container hierarchy:

```
#hiprintDesigner (8px padding)
├── .hiprint-designer-toolbar (top)
├── .hiprint-designer-panel-left (sidebar, element types)
├── .hiprint-designer-panel-center (canvas area with border/radius)
├── .hiprint-designer-panel-right (properties)
└── .hiprint-designer-panel-bottom (pagination bar, default hidden)
```

## Lifecycle

```js
onMounted(() => {
  // Template already exists, designer renders into #hiprintDesigner
})

onBeforeUnmount(() => {
  // Cleanup: destroy template to prevent memory leaks
  hiprintTemplate.destroy()
})
```

## No Demo Component Dependencies

As of v1.0.0:
- ❌ No `src/demo` folder (removed in refactor)
- ✅ Minimal shell (this file)
- ✅ Uses only hiprint API + buildDesigner
- ✅ Can be extended for testing/staging purposes

## For External Integration

This shell is **development-only**. Integration projects should:
1. Use `import { buildDesigner } from 'vue-plugin-hiprint'`
2. Create own Vue component wrapping designer
3. Manage template instance lifecycle with `destroy()` on unmount
4. See [../integration-guide.md](../integration-guide.md) for full example

## Related

- See [../integration-guide.md](../integration-guide.md) for real-world integration
- See [../API-REFERENCE.md](../API-REFERENCE.md) for all options
