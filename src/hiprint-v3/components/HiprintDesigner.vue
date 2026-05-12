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
import {
  TemplateDialog,
  BusinessDialog,
  SaveDialog,
  type TemplateItem,
  type BusinessItem,
  type SaveDialogPayload,
} from './dialogs'
import type { PrintTemplate } from '@hiprint-v3/compat/print-template'

// Local mirrors of HiprintToolbar.vue public types — Vue SFCs do not re-export
// named types through the `*.vue` module resolver. Shapes must stay in sync.
interface ToolbarPaperType {
  label: string
  width: number
  height: number
}
type ToolbarAlignType =
  | 'left'
  | 'center'
  | 'right'
  | 'top'
  | 'middle'
  | 'bottom'
interface ToolbarExtraButton {
  key: string
  label?: string
  icon?: string
  type?: string
  className?: string
  visible?: boolean
  disabled?: boolean
  html?: string
  onClick?: (tpl: PrintTemplate | null | undefined, event?: Event) => void
}

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
  /** PrintTemplate to forward to HiprintToolbar so V1 callbacks get tpl. */
  tpl?: PrintTemplate | null
  // ---- Toolbar opts pass-through (P21.6 + P21.7) ----
  toolbarButtons?: readonly string[]
  toolbarPaperTypes?: readonly ToolbarPaperType[]
  toolbarDefaultPaper?: string
  toolbarScaleMin?: number
  toolbarScaleMax?: number
  toolbarScaleStep?: number
  toolbarShowUndo?: boolean
  toolbarShowRedo?: boolean
  toolbarShowSave?: boolean
  toolbarShowPreview?: boolean
  toolbarShowPrint?: boolean
  toolbarShowPdf?: boolean
  toolbarShowClear?: boolean
  toolbarShowPanelManager?: boolean
  toolbarShowPaperSelect?: boolean
  toolbarShowCustomPaper?: boolean
  toolbarShowRotate?: boolean
  toolbarShowAlign?: boolean
  toolbarShowScale?: boolean
  toolbarShowRuler?: boolean
  toolbarShowGrid?: boolean
  toolbarShowTemplateSelect?: boolean
  toolbarShowBusinessSelect?: boolean
  toolbarOnPreview?: (tpl: PrintTemplate | null | undefined) => void
  toolbarOnPrint?: (tpl: PrintTemplate | null | undefined) => void
  toolbarOnClear?: (tpl: PrintTemplate | null | undefined) => void
  toolbarOnSave?: (
    tpl: PrintTemplate | null | undefined,
    json: TemplateJson,
    event?: Event | null,
    api?: unknown,
    ctx?: { name?: string }
  ) => void
  toolbarOnPaperChange?: (
    tpl: PrintTemplate | null | undefined,
    name: string,
    size: { width: number; height: number }
  ) => void
  toolbarOnRotate?: (tpl: PrintTemplate | null | undefined) => void
  toolbarOnAlign?: (
    tpl: PrintTemplate | null | undefined,
    type: ToolbarAlignType
  ) => void
  toolbarOnScaleChange?: (
    tpl: PrintTemplate | null | undefined,
    scale: number
  ) => void
  toolbarOnAddPanel?: (tpl: PrintTemplate | null | undefined) => void
  toolbarOnRemovePanel?: (
    tpl: PrintTemplate | null | undefined,
    idx: number
  ) => void
  toolbarOnSwitchPanel?: (
    tpl: PrintTemplate | null | undefined,
    idx: number
  ) => void
  toolbarPanelManagerLabel?: string
  toolbarAddPanelButtonText?: string
  toolbarAlignItems?: readonly ToolbarAlignType[]
  toolbarExtraButtons?: readonly ToolbarExtraButton[]
  toolbarExtraPosition?: 'start' | 'end'
  // ---- Dialog data + handlers (P21.8 integration) ----
  /** Template list shown in the templateSelect dialog. Empty by default. */
  templateDialogItems?: readonly TemplateItem[]
  templateDialogLoading?: boolean
  templateDialogTitle?: string
  /** Business / scene items shown in the businessSelect dialog. */
  businessDialogItems?: readonly BusinessItem[]
  businessDialogCategories?: readonly string[]
  businessDialogLoading?: boolean
  businessDialogTitle?: string
  /** Save dialog options. */
  saveDialogInitialValue?: Partial<SaveDialogPayload>
  saveDialogCategoryOptions?: readonly string[]
  saveDialogSaving?: boolean
  saveDialogTitle?: string
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
  tpl: null,
  toolbarButtons: undefined,
  toolbarPaperTypes: undefined,
  toolbarDefaultPaper: 'A4',
  toolbarScaleMin: 0.5,
  toolbarScaleMax: 5,
  toolbarScaleStep: 0.1,
  toolbarShowUndo: true,
  toolbarShowRedo: true,
  toolbarShowSave: true,
  toolbarShowPreview: true,
  toolbarShowPrint: true,
  toolbarShowPdf: true,
  toolbarShowClear: true,
  toolbarShowPanelManager: false,
  toolbarShowPaperSelect: true,
  toolbarShowCustomPaper: false,
  toolbarShowRotate: true,
  toolbarShowAlign: true,
  toolbarShowScale: true,
  toolbarShowRuler: true,
  toolbarShowGrid: true,
  toolbarShowTemplateSelect: false,
  toolbarShowBusinessSelect: false,
  toolbarOnPreview: undefined,
  toolbarOnPrint: undefined,
  toolbarOnClear: undefined,
  toolbarOnSave: undefined,
  toolbarOnPaperChange: undefined,
  toolbarOnRotate: undefined,
  toolbarOnAlign: undefined,
  toolbarOnScaleChange: undefined,
  toolbarOnAddPanel: undefined,
  toolbarOnRemovePanel: undefined,
  toolbarOnSwitchPanel: undefined,
  toolbarPanelManagerLabel: '',
  toolbarAddPanelButtonText: '+',
  toolbarAlignItems: undefined,
  toolbarExtraButtons: undefined,
  toolbarExtraPosition: 'end',
  templateDialogItems: undefined,
  templateDialogLoading: false,
  templateDialogTitle: '模板选择',
  businessDialogItems: undefined,
  businessDialogCategories: undefined,
  businessDialogLoading: false,
  businessDialogTitle: '业务场景',
  saveDialogInitialValue: undefined,
  saveDialogCategoryOptions: undefined,
  saveDialogSaving: false,
  saveDialogTitle: '保存模板',
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
  /** Fired when user selects a template from the TemplateDialog. */
  templateSelect: [item: TemplateItem]
  /** Fired when user selects a business item from BusinessDialog. */
  businessSelect: [item: BusinessItem]
  /** Fired when user submits the SaveDialog form. */
  saveDialogSubmit: [payload: SaveDialogPayload]
  /** Fired when user requests refresh of template / business list. */
  refreshTemplates: []
  refreshBusinesses: []
}>()

// ---- Dialog visibility refs (P21.8 default integration) ----
// V3 reactive: parent (or this SFC itself) controls dialog open state via
// these refs. Toolbar emit('templateSelectClick' / 'businessSelectClick')
// flips the corresponding ref. Save dialog opens when toolbar @save handler
// chooses to defer to a save form (default save downloads JSON directly;
// the dialog flow is opt-in by passing saveHandler that flips this ref).
const templateDialogOpen = ref(false)
const businessDialogOpen = ref(false)
const saveDialogOpen = ref(false)

function onToolbarTemplateSelectClick(): void {
  templateDialogOpen.value = true
}

function onToolbarBusinessSelectClick(): void {
  businessDialogOpen.value = true
}

function onTemplateDialogSelect(item: TemplateItem): void {
  if (item.data) {
    try {
      tpl.loadFromJson(item.data)
    } catch (err) {
      console.warn('[hiprint-v3:designer] templateSelect loadFromJson failed:', err)
    }
  }
  emit('templateSelect', item)
}

function onBusinessDialogSelect(item: BusinessItem): void {
  emit('businessSelect', item)
}

function onSaveDialogSubmit(payload: SaveDialogPayload): void {
  emit('saveDialogSubmit', payload)
}

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
          :tpl="props.tpl"
          :buttons="props.toolbarButtons as undefined"
          :paper-types="props.toolbarPaperTypes as undefined"
          :default-paper="props.toolbarDefaultPaper"
          :scale-min="props.toolbarScaleMin"
          :scale-max="props.toolbarScaleMax"
          :scale-step="props.toolbarScaleStep"
          :show-undo="props.toolbarShowUndo"
          :show-redo="props.toolbarShowRedo"
          :show-save="props.toolbarShowSave"
          :show-preview="props.toolbarShowPreview"
          :show-print="props.toolbarShowPrint"
          :show-pdf="props.toolbarShowPdf"
          :show-clear="props.toolbarShowClear"
          :show-panel-manager="props.toolbarShowPanelManager"
          :show-paper-select="props.toolbarShowPaperSelect"
          :show-custom-paper="props.toolbarShowCustomPaper"
          :show-rotate="props.toolbarShowRotate"
          :show-align="props.toolbarShowAlign"
          :show-scale="props.toolbarShowScale"
          :show-ruler="props.toolbarShowRuler"
          :show-grid="props.toolbarShowGrid"
          :show-template-select="props.toolbarShowTemplateSelect"
          :show-business-select="props.toolbarShowBusinessSelect"
          :on-preview="props.toolbarOnPreview"
          :on-print="props.toolbarOnPrint"
          :on-clear="props.toolbarOnClear"
          :on-save="props.toolbarOnSave"
          :on-paper-change="props.toolbarOnPaperChange"
          :on-rotate="props.toolbarOnRotate"
          :on-align="props.toolbarOnAlign"
          :on-scale-change="props.toolbarOnScaleChange"
          :on-add-panel="props.toolbarOnAddPanel"
          :on-remove-panel="props.toolbarOnRemovePanel"
          :on-switch-panel="props.toolbarOnSwitchPanel"
          :panel-manager-label="props.toolbarPanelManagerLabel"
          :add-panel-button-text="props.toolbarAddPanelButtonText"
          :align-items="props.toolbarAlignItems as undefined"
          :extra-buttons="props.toolbarExtraButtons as undefined"
          :extra-position="props.toolbarExtraPosition"
          :preview-handler="props.previewHandler ?? onToolbarPreview"
          :print-handler="props.printHandler ?? onToolbarPrint"
          :save-handler="props.saveHandler ?? onToolbarSave"
          @save="onToolbarSave"
          @preview="onToolbarPreview"
          @print="onToolbarPrint"
          @templateSelectClick="onToolbarTemplateSelectClick"
          @businessSelectClick="onToolbarBusinessSelectClick"
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

    <!-- Default V3 dialog integration (P21.8). Business code can override via
         the named slots; otherwise toolbar templateSelect/businessSelect
         buttons + saveDialog opt-in flip these refs. -->
    <slot name="template-dialog" :open="templateDialogOpen">
      <TemplateDialog
        v-model:open="templateDialogOpen"
        :items="props.templateDialogItems as TemplateItem[] | undefined"
        :loading="props.templateDialogLoading"
        :title="props.templateDialogTitle"
        @select="onTemplateDialogSelect"
        @refresh="emit('refreshTemplates')"
      />
    </slot>
    <slot name="business-dialog" :open="businessDialogOpen">
      <BusinessDialog
        v-model:open="businessDialogOpen"
        :items="props.businessDialogItems as BusinessItem[] | undefined"
        :categories="props.businessDialogCategories"
        :loading="props.businessDialogLoading"
        :title="props.businessDialogTitle"
        @select="onBusinessDialogSelect"
        @refresh="emit('refreshBusinesses')"
      />
    </slot>
    <slot name="save-dialog" :open="saveDialogOpen">
      <SaveDialog
        v-model:open="saveDialogOpen"
        :initial-value="props.saveDialogInitialValue"
        :category-options="props.saveDialogCategoryOptions"
        :saving="props.saveDialogSaving"
        :title="props.saveDialogTitle"
        @submit="onSaveDialogSubmit"
      />
    </slot>
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
