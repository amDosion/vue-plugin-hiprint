<script setup lang="ts">
/**
 * HiprintDesigner.vue — V3 top-level designer composition (P18.3).
 *
 * Replaces V2 `buildDesigner` (V1 bundle.js line 13235-13305 + V2 ui/designer.js)
 * with a Vue 3 SFC that composes the toolbar / element-list / canvas / property-
 * panel into the conventional designer layout:
 *
 *   ┌───────────────────────────────────────┐
 *   │ Toolbar                                │
 *   ├──────────┬───────────────┬─────────────┤
 *   │ Element  │               │             │
 *   │ List     │   Canvas      │  Property   │
 *   │ Palette  │   (paper)     │  Panel      │
 *   │          │               │             │
 *   └──────────┴───────────────┴─────────────┘
 *
 * Slots permit hosts to replace any region (toolbar, element-list, canvas,
 * property-panel) without re-implementing the layout.
 *
 * Two operating modes (toggleable at runtime by parent or via showPreview):
 *  - 'design': Canvas (editable) + property panel + element list
 *  - 'preview': HiprintPreview (read-only render) full-bleed
 *
 * Lifecycle:
 *  - onMounted: if props.template provided, call template.loadFromJson(...) —
 *    this resets canvas + history (see useTemplateStore.loadFromJson).
 *  - onBeforeUnmount: if props.destroyOnUnmount=true (default true), clear
 *    template + canvas to avoid stale state when re-mounting in a route.
 *
 * Compat layer note:
 *  - P19 will wrap this SFC in `buildDesigner(container, options)` to preserve
 *    the V1 API surface (imperative createApp + mount). For new V3 consumers,
 *    the SFC is the canonical entrypoint.
 */

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  useCanvasStore,
  useHistoryStore,
  useTemplateStore,
} from '@hiprint-v3/stores'
import type { TemplateJson } from '@hiprint-v3/schemas'
import HiprintToolbar from './HiprintToolbar.vue'
import HiprintElementList from './HiprintElementList.vue'
import HiprintCanvas from './HiprintCanvas.vue'
import HiprintPropertyPanel from './HiprintPropertyPanel.vue'
import HiprintPreview from './HiprintPreview.vue'

// ============ Props / Emits ============

interface Props {
  /** Initial template JSON. Loaded into stores on mount; later changes via prop
   *  trigger reload (subject to dirty-state gate; see watch below). */
  template?: TemplateJson | undefined
  /** Test data for binding (passed to preview + print pipeline). */
  data?: Record<string, unknown> | undefined
  /** Hide regions selectively. */
  showToolbar?: boolean
  showElementList?: boolean
  showPropertyPanel?: boolean
  /** Switch between 'design' (default) and 'preview' modes. */
  mode?: 'design' | 'preview'
  /** Whether to clear stores on unmount (default true — fresh state when
   *  re-routing back into the designer). */
  destroyOnUnmount?: boolean
  /** Override Toolbar handlers (forwarded — see HiprintToolbar props). */
  previewHandler?: () => void
  printHandler?: () => void
  saveHandler?: () => void
}

const props = withDefaults(defineProps<Props>(), {
  template: undefined,
  data: undefined,
  showToolbar: true,
  showElementList: true,
  showPropertyPanel: true,
  mode: 'design',
  destroyOnUnmount: true,
  previewHandler: undefined,
  printHandler: undefined,
  saveHandler: undefined,
})

const emit = defineEmits<{
  /** Fired when the toolbar Save button is clicked (after default save). */
  save: [json: TemplateJson]
  /** Fired when toolbar Preview is clicked (host can swap mode='preview'). */
  preview: []
  /** Fired when toolbar Print is clicked. */
  print: []
  /** Fired when template changes (after any user edit + history push). */
  templateChange: [json: TemplateJson]
}>()

// ============ Stores ============

const canvas = useCanvasStore()
const history = useHistoryStore()
const tpl = useTemplateStore()

// ============ Computed layout flags ============

const isDesignMode = computed(() => props.mode === 'design')
const isPreviewMode = computed(() => props.mode === 'preview')

// ============ Lifecycle ============

function loadInitialTemplate(): void {
  if (!props.template) return
  try {
    tpl.loadFromJson(props.template)
  } catch (err) {
    console.error('[hiprint-v3:designer] loadFromJson failed:', err)
  }
}

onMounted(() => {
  loadInitialTemplate()
})

// React to template prop changes only when stores are not dirty — otherwise we
// would silently lose unsaved edits.
watch(
  () => props.template,
  (next) => {
    if (!next) return
    if (tpl.dirty) {
      console.warn(
        '[hiprint-v3:designer] template prop changed while store dirty; ignoring (call template.save() first)'
      )
      return
    }
    try {
      tpl.loadFromJson(next)
    } catch (err) {
      console.error('[hiprint-v3:designer] reload failed:', err)
    }
  }
)

onBeforeUnmount(() => {
  if (props.destroyOnUnmount) {
    tpl.clear()
  }
})

// ============ Toolbar event re-emit ============

function onToolbarSave(): void {
  const json = tpl.save()
  emit('save', json)
}

function onToolbarPreview(): void {
  emit('preview')
}

function onToolbarPrint(): void {
  emit('print')
}

// Watch canvas changes → emit templateChange for hosts that want to autosave /
// observe edits. Coarse-grained: fires on history snapshot pushes (i.e. after
// gesture-end), not on every mid-drag pixel.
watch(
  () => history.pos,
  () => {
    if (!tpl.currentTemplate) return
    emit('templateChange', tpl.getJson())
  }
)

// ============ Exposed refs (for parent imperative access) ============

const toolbarRef = ref<InstanceType<typeof HiprintToolbar> | null>(null)
const canvasRef = ref<InstanceType<typeof HiprintCanvas> | null>(null)

defineExpose({
  /** Imperative access: get current JSON snapshot. */
  getJson: () => tpl.getJson(),
  /** Imperative access: replace current template. */
  loadJson: (json: TemplateJson) => tpl.loadFromJson(json),
  /** Imperative access: clear everything (matches V2 PrintTemplate.destroy). */
  destroy: () => tpl.clear(),
  /** Direct refs for advanced integrations. */
  toolbar: toolbarRef,
  canvas: canvasRef,
})
</script>

<template>
  <div class="hiprint-designer" :class="{ 'hiprint-designer--preview': isPreviewMode }">
    <header v-if="showToolbar && isDesignMode" class="hiprint-designer__toolbar">
      <slot name="toolbar">
        <HiprintToolbar
          ref="toolbarRef"
          :preview-handler="props.previewHandler ?? onToolbarPreview"
          :print-handler="props.printHandler ?? onToolbarPrint"
          :save-handler="props.saveHandler ?? onToolbarSave"
          @save="onToolbarSave"
          @preview="onToolbarPreview"
          @print="onToolbarPrint"
        />
      </slot>
    </header>

    <main v-if="isDesignMode" class="hiprint-designer__main">
      <aside v-if="showElementList" class="hiprint-designer__element-list">
        <slot name="element-list">
          <HiprintElementList />
        </slot>
      </aside>

      <section class="hiprint-designer__canvas">
        <slot name="canvas">
          <HiprintCanvas ref="canvasRef" />
        </slot>
      </section>

      <aside v-if="showPropertyPanel" class="hiprint-designer__property-panel">
        <slot name="property-panel">
          <HiprintPropertyPanel />
        </slot>
      </aside>
    </main>

    <section v-if="isPreviewMode" class="hiprint-designer__preview">
      <slot name="preview">
        <HiprintPreview :data="props.data" />
      </slot>
    </section>
  </div>
</template>

<style scoped>
.hiprint-designer {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 480px;
  background: var(--hiprint-designer-bg, #f5f5f5);
  color: var(--hiprint-designer-fg, #222);
  font-family: inherit;
}

.hiprint-designer__toolbar {
  flex: 0 0 auto;
  border-bottom: 1px solid var(--hiprint-designer-divider, #ddd);
}

.hiprint-designer__main {
  flex: 1 1 auto;
  display: flex;
  flex-direction: row;
  overflow: hidden;
}

.hiprint-designer__element-list {
  flex: 0 0 200px;
  border-right: 1px solid var(--hiprint-designer-divider, #ddd);
  overflow-y: auto;
}

.hiprint-designer__canvas {
  flex: 1 1 auto;
  overflow: auto;
  background: var(--hiprint-designer-canvas-bg, #e8e8e8);
  padding: 16px;
}

.hiprint-designer__property-panel {
  flex: 0 0 260px;
  border-left: 1px solid var(--hiprint-designer-divider, #ddd);
  overflow-y: auto;
}

.hiprint-designer__preview {
  flex: 1 1 auto;
  overflow: auto;
  background: var(--hiprint-designer-preview-bg, #fafafa);
}

.hiprint-designer--preview .hiprint-designer__toolbar {
  display: none;
}
</style>
