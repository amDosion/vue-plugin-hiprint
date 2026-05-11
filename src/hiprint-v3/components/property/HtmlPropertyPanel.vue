<script setup lang="ts">
/**
 * HtmlPropertyPanel.vue — V3 property editor for `html` etype (PP-011).
 *
 * ⚠️ SECURITY — XSS notice
 *
 * The `html` etype is the ONE V3 etype that renders raw HTML via v-html (see
 * `components/elements/HtmlElement.vue` header — "BY DESIGN INNERHTML"). V3
 * does NOT sanitize this content. Business consumers MUST sanitize input
 * BEFORE it is saved to a template. See:
 *  - docs/integration-guide.md ⚠️ 安全注意事项 #1
 *  - .claude/rules/security.md §1
 *
 * This panel offers no inline sanitization — by design, mirroring V1/V2
 * contract — but emits a visible warning so designers know the field
 * accepts raw HTML.
 *
 * Field:
 *  - `content` — raw HTML string consumed by HtmlElement.vue.
 *
 * All edits go through `canvas.updateElement(activePanelId, element.id,
 * { options: patch })`. History snapshot fires on textarea blur/change.
 *
 * Wave 2 integration — dispatched from HiprintPropertyPanel.vue when
 * `elementType === 'html'`.
 */
import { computed } from 'vue'
import {
  useCanvasStore,
  useHistoryStore,
  type CanvasElement,
} from '@hiprint-v3/stores'

const props = defineProps<{ element: CanvasElement }>()
const canvas = useCanvasStore()
const history = useHistoryStore()

const opts = computed<Record<string, unknown>>(
  () => (props.element.options as Record<string, unknown>) ?? {}
)

function patch(p: Record<string, unknown>, commit = false): void {
  const panelId = canvas.activePanelId
  if (!panelId) return
  canvas.updateElement(panelId, props.element.id, { options: p })
  if (commit) history.pushSnapshot()
}

function onContent(ev: Event): void {
  const target = ev.target as HTMLTextAreaElement | null
  if (!target) return
  patch({ content: String(target.value) }, true)
}
</script>

<template>
  <div class="hiprint-html-property-panel" aria-label="HTML properties">
    <fieldset class="hiprint-property-fieldset">
      <legend>HTML content</legend>
      <p class="hiprint-html-warning" role="note">
        ⚠️ Raw HTML is rendered as-is. Sanitize untrusted input upstream
        (XSS risk).
      </p>
      <label>
        Content
        <textarea
          class="html-content"
          rows="6"
          spellcheck="false"
          :value="String(opts.content ?? '')"
          placeholder="<div>...</div>"
          @change="onContent"
        />
      </label>
    </fieldset>
  </div>
</template>

<style scoped>
.hiprint-html-property-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 12px;
  color: #333;
}
.hiprint-property-fieldset {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid #e5e5e5;
  border-radius: 4px;
  padding: 8px 10px;
  margin: 0;
  background: #fff;
}
.hiprint-property-fieldset legend {
  font-weight: 600;
  padding: 0 4px;
  color: #555;
}
.hiprint-property-fieldset label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: #666;
}
.hiprint-property-fieldset textarea {
  min-height: 26px;
  padding: 4px 6px;
  border: 1px solid #d9d9d9;
  border-radius: 3px;
  font: inherit;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  color: #333;
  background: #fff;
  resize: vertical;
}
.hiprint-html-warning {
  margin: 0;
  padding: 6px 8px;
  background: #fffbe6;
  border: 1px solid #ffe58f;
  border-radius: 3px;
  color: #ad6800;
  font-size: 11px;
}
</style>
