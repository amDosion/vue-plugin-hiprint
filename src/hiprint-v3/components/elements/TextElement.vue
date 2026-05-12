<script setup lang="ts">
/**
 * TextElement.vue — V3 text etype (P17.1).
 *
 * Renders the title-prefixed value via Vue interpolation `{{ }}`, which is
 * automatically HTML-escaped by Vue's compiler. This satisfies Invariant #1
 * (.textContent default, no innerHTML with user data) without any manual
 * escapeHtml call.
 *
 * V2 reference: `render.ts` renderTextElement (function body line 218-244)
 * — same logic, but Vue handles the DOM mutation reactively.
 *
 * Features:
 *  - Title prefix (options.title + separator + value).
 *  - hideTitle option suppresses the title.
 *  - Optional inline edit: double-click → temporary `<input>` that commits to
 *    canvas.updateElement on blur or Enter. This is a designer-only convenience
 *    (matches V2 designer's `.hiprint-printElement-text-content` dblclick edit).
 *  - When `options.formatter` is a function, the formatter output is rendered
 *    via `v-html` (Invariant #2: by-design HTML; business owns escaping).
 */
// TKT-023: textType dispatch to dedicated barcode/qrcode elements for V1
// Path A template compatibility (text element with options.textType set).
// TKT-024: dataType + format pre-conversion through getFormattedValue
// (order: raw → dataType+format → formatter → DOM).
import { computed, nextTick, ref } from 'vue'
import { useCanvasStore, useHistoryStore } from '@hiprint-v3/stores'
import ElementWrapper from './ElementWrapper.vue'
import BarcodeElement from './BarcodeElement.vue'
import QrcodeElement from './QrcodeElement.vue'
import {
  computeDisplayText,
  getFormattedValue,
  isTrue,
  type Opts,
} from './_helpers'
import { coerceText, compileFormatter } from '@hiprint-v3/internal'
import { isFullyLocked } from '@hiprint-v3/interactions/lock'

const props = withDefaults(
  defineProps<{
    elementId: string
    panelId: string
    /** Bound business data — used by field resolution. */
    data?: Record<string, unknown>
    /** Designer mode enables dblclick inline edit. Default false (preview). */
    editable?: boolean
    interactive?: boolean
  }>(),
  { editable: false, interactive: true }
)

const canvas = useCanvasStore()
// TKT-020: history store for inline-edit commit snapshots — Ctrl+Z restores
// the prior title/testData after a dblclick edit.
const history = useHistoryStore()

const element = computed(() => {
  for (const panel of canvas.panels) {
    const el = panel.printElements.find((e) => e.id === props.elementId)
    if (el) return el
  }
  return null
})

const displayText = computed(() => computeDisplayText(element.value, props.data))

/**
 * TKT-023 — Detect V1 Path A `options.textType`. Returns `'barcode'` /
 * `'qrcode'` / `null`. When non-null, the template dispatches to
 * BarcodeElement / QrcodeElement instead of rendering text.
 *
 * COMPAT layer for legacy V1 templates. New code should use Path B
 * (`printElementType.type: 'barcode' | 'qrcode'`) directly.
 */
const textTypeDispatch = computed<'barcode' | 'qrcode' | null>(() => {
  const el = element.value
  if (!el) return null
  const tt = (el.options as Opts).textType
  if (tt === 'barcode' || tt === 'qrcode') return tt
  return null
})

/**
 * Formatter output — by-design HTML (Invariant #2). Returns `null` when no
 * formatter is configured, so the template falls back to text interpolation.
 *
 * TKT-024 pipeline: raw → dataType+format → formatter → DOM. Formatter
 * receives the already-converted value (matches V1 bundle.js line 10037).
 */
const formatterHtml = computed<string | null>(() => {
  const el = element.value
  if (!el) return null
  const opts = el.options as Opts
  // TKT-006: accept string-source formatter as well (V1 parity).
  const fn = compileFormatter(opts.formatter)
  if (!fn) return null
  try {
    const title = coerceText(opts.title)
    // TKT-024: pre-convert via dataType+format BEFORE formatter chain.
    const value = getFormattedValue(el, props.data)
    const out = fn(title, value, opts, props.data)
    return out == null ? '' : String(out)
  } catch (err) {
    console.warn('[hiprint-v3:TextElement] formatter threw:', err)
    return ''
  }
})

// ----- Inline edit (designer only) -----

const isEditing = ref(false)
const draftValue = ref('')
const inputEl = ref<HTMLInputElement | null>(null)

function startEdit(): void {
  if (!props.editable || !element.value) return
  const opts = element.value.options as Opts
  // TKT-027: block inline edit when the element carries the catch-all `lock`
  // field. V1 inventory §H.1 line 622: V1 quirk allows positionLocked to
  // still enter edit mode — we mirror that. Only `lock === true` blocks edit.
  if (isFullyLocked(opts)) return
  // Title editing is more common than value editing in V1. To keep semantics
  // explicit, we edit options.title when hideTitle=false; otherwise edit the
  // raw `options.testData` (design-time value).
  if (!isTrue(opts.hideTitle) && typeof opts.title === 'string') {
    draftValue.value = String(opts.title ?? '')
  } else {
    draftValue.value = String(opts.testData ?? '')
  }
  isEditing.value = true
  nextTick(() => {
    inputEl.value?.focus()
    inputEl.value?.select()
  })
}

function commitEdit(): void {
  if (!isEditing.value || !element.value) {
    isEditing.value = false
    return
  }
  const opts = element.value.options as Opts
  // TKT-020: capture prior value so we only snapshot when the user actually
  // changed something. Hitting Enter/blur on an unchanged field shouldn't
  // burn an undo slot.
  const isTitleEdit =
    !isTrue(opts.hideTitle) && typeof opts.title === 'string'
  const prior = String((isTitleEdit ? opts.title : opts.testData) ?? '')

  // Sprint 22d TKT-160 — sanitize + parse per V1 inventory etypes/text-longtext.md
  // §F.1 + §J.12:
  //   1. Strip enter/newline/tab → space (V1 quirk J.12 — inline-edit must
  //      stay single-line; multi-line goes through longText).
  //   2. Parse `title：testData` (fullwidth colon U+FF1A) into BOTH title +
  //      testData simultaneously, so users can author both via inline edit.
  //      Also accept ASCII `:` — V1 §J.1 only honored fullwidth colon, V3
  //      fixes that bug by also splitting on ASCII (matches the visual cue
  //      from the colon separator rendered between title and value).
  //   3. Title-only edits when no colon present (preserves prior behavior).
  const raw = String(draftValue.value ?? '')
  const sanitized = raw.replace(/[\r\n\t]+/g, ' ').trim()
  const colonMatch = sanitized.match(/^([^：:]+)\s*[：:]\s*(.+)$/)
  let patch: Opts
  if (colonMatch) {
    // Both title and testData supplied — patch both. This branch wins
    // regardless of isTitleEdit because the user explicitly asked for both
    // values by typing a colon (V1 inventory F.1 — colon parse is the
    // documented way to author title + value inline).
    patch = {
      title: colonMatch[1]!.trim(),
      testData: colonMatch[2]!.trim(),
    }
  } else if (isTitleEdit) {
    patch = { title: sanitized }
  } else {
    patch = { testData: sanitized }
  }
  canvas.updateElement(props.panelId, props.elementId, { options: patch })
  isEditing.value = false
  // TKT-020: history snapshot on a real edit only. Matches the property
  // panels' commit-on-blur semantics. Compare against the *committed* value
  // for the relevant field (post-sanitization) rather than the raw draft, so
  // whitespace-only sanitization changes still snapshot when they actually
  // changed the stored value.
  const committedSample = colonMatch
    ? `${colonMatch[1]!.trim()}：${colonMatch[2]!.trim()}`
    : sanitized
  if (committedSample !== prior) history.pushSnapshot()
}

function cancelEdit(): void {
  isEditing.value = false
}
</script>

<template>
  <!--
    TKT-023 — V1 Path A compat: when `options.textType` is barcode / qrcode,
    delegate to the dedicated element renderer. Same elementId/panelId so
    the delegate reads the same canvas record and honors the user's options.
  -->
  <BarcodeElement
    v-if="textTypeDispatch === 'barcode'"
    :element-id="elementId"
    :panel-id="panelId"
    :data="data"
    :interactive="interactive"
  />
  <QrcodeElement
    v-else-if="textTypeDispatch === 'qrcode'"
    :element-id="elementId"
    :panel-id="panelId"
    :data="data"
    :interactive="interactive"
  />
  <ElementWrapper
    v-else
    :element-id="elementId"
    :panel-id="panelId"
    :interactive="interactive"
  >
    <template #default>
      <div
        class="hiprint-printElement-text-content"
        style="height: 100%; width: 100%"
        @dblclick="startEdit"
      >
        <!-- Inline edit (designer mode) -->
        <input
          v-if="isEditing"
          ref="inputEl"
          v-model="draftValue"
          class="hiprint-text-inline-edit is-editing editing"
          @blur="commitEdit"
          @keydown.enter.prevent="commitEdit"
          @keydown.esc.prevent="cancelEdit"
        />
        <!-- Formatter output (by-design HTML, Invariant #2) -->
        <!-- eslint-disable-next-line vue/no-v-html -->
        <span v-else-if="formatterHtml !== null" v-html="formatterHtml" />
        <!-- Default text interpolation (XSS-safe, Invariant #1) -->
        <template v-else>{{ displayText }}</template>
      </div>
    </template>
  </ElementWrapper>
</template>

<style scoped>
/* TKT-250 / TKT-251 — inline editor; co-emit V1 legacy `.editing` (V1
 * inventory §1.16 line 764) on top of BEM `.is-editing`. Color uses the
 * design token for theme compatibility. */
.hiprint-text-inline-edit,
.hiprint-text-inline-edit.is-editing,
.hiprint-text-inline-edit.editing {
  width: 100%;
  height: 100%;
  border: 1px solid var(--hiprint-selection-outline, #409eff);
  outline: none;
  padding: 0 2px;
  font: inherit;
  color: inherit;
  background: white;
  box-sizing: border-box;
}
</style>
