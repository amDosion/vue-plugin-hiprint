/**
 * src/hiprint-v3/components/dialogs/index.ts — V3 dialog components barrel (P21.8).
 *
 * Pure reactive Vue 3 dialogs replacing V1's imperative
 * `openTemplateDialog` / `openBusinessDialog` / `openSaveDialog` callbacks.
 *
 * In V3, business code (vue-admin-main) controls visibility via Vue 3 reactive
 * ref + `v-model:open`. No imperative open/close methods are exposed on these
 * SFCs.
 *
 * Usage example:
 *
 *   <script setup>
 *   import { ref } from 'vue'
 *   import { TemplateDialog, type TemplateItem } from '@hiprint-v3/components/dialogs'
 *
 *   const open = ref(false)
 *   const items = ref<TemplateItem[]>([])
 *   function onSelect(item: TemplateItem) {
 *     // …
 *   }
 *   </script>
 *
 *   <template>
 *     <TemplateDialog v-model:open="open" :items="items" @select="onSelect" />
 *   </template>
 */

import type { TemplateJson } from '@hiprint-v3/schemas'

export { default as TemplateDialog } from './TemplateDialog.vue'
export { default as BusinessDialog } from './BusinessDialog.vue'
export { default as SaveDialog } from './SaveDialog.vue'

// Vue SFCs do not re-export named types through `*.vue`, so we mirror the
// dialog payload types here. Shapes must stay in sync with each SFC's own
// definition.

export interface TemplateItem {
  id: string | number
  name: string
  thumbnail?: string
  data?: TemplateJson
  category?: string
  updatedAt?: string
}

export interface BusinessItem {
  id: string | number
  name: string
  category?: string
  icon?: string
  data?: unknown
}

export interface SaveDialogPayload {
  name: string
  category?: string
  tags?: string[]
  description?: string
}
