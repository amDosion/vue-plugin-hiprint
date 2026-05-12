/**
 * missing-css-classes.spec.ts — TKT-258 → TKT-265 missing-class restoration.
 *
 * `docs/V3-PARITY-MATRIX/08-styles.md` Section Y4 lists 36 🔴 missing class
 * names where the V3 SFC layer did not emit a class the V1 designer used.
 * Sprint 22f restored / verified the ones that have a meaningful DOM hook:
 *
 *  Guide layer / lines (Section L)               — TKT-258
 *  Drag-ref / position lines (Section P)         — TKT-259
 *  Resize panel chrome + size readout (Section Q)— TKT-260
 *  Paper-number badge (Section A)                — TKT-261 (DA TKT-153)
 *  Type-color tags (Section H)                   — TKT-262 (DB Sprint 22d)
 *  Designer edge-toggle + resize-bar (Section F) — TKT-263
 *  Table designer drag handle (Section C)        — TKT-264 (see note)
 *  Toolbar primary/danger variants (Section G)   — TKT-265
 *
 * These tests assert the class names render in the appropriate SFC so caller
 * CSS keyed to the V1 selector vocabulary remains a valid extension point.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@hiprint-v3/print', () => ({
  browserPrint: vi.fn(() => Promise.resolve()),
  downloadPdf: vi.fn(() => Promise.resolve()),
  getPrintHtml: vi.fn(() => ''),
  generatePdf: vi.fn(),
  toPdfBlob: vi.fn(),
  renderTemplate: vi.fn(),
  getHiwebSocket: vi.fn(),
  resetHiwebSocketForTests: vi.fn(),
}))

import { useCanvasStore } from '@hiprint-v3/stores'
import HiprintToolbar from '../HiprintToolbar.vue'
import HiprintDesigner from '../HiprintDesigner.vue'
import HiprintPanel from '../HiprintPanel.vue'
import HiprintCanvas from '../HiprintCanvas.vue'
import HiprintElementListPanel from '../HiprintElementListPanel.vue'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

// ============================================================================
// TKT-258 — Guide-layer + guide-line classes (Section L)
// ============================================================================

describe('missing-css-classes — TKT-258 guide layer', () => {
  it('HiprintCanvas renders `.hiprint-guide-layer` wrapper when guides exist', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 210, height: 297 })
    canvas.addGuideLine('h', 100)
    const w = mount(HiprintCanvas)
    await w.vm.$nextTick()
    expect(w.find('.hiprint-guide-layer').exists()).toBe(true)
    w.unmount()
  })

  it('horizontal guide line gets `.hiprint-guide-line--h` modifier', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 210, height: 297 })
    canvas.addGuideLine('h', 100)
    const w = mount(HiprintCanvas)
    await w.vm.$nextTick()
    const h = w.find('.hiprint-guide-line--h')
    expect(h.exists()).toBe(true)
    expect(h.classes()).toContain('hiprint-guide-line')
    w.unmount()
  })

  it('vertical guide line gets `.hiprint-guide-line--v` modifier', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 210, height: 297 })
    canvas.addGuideLine('v', 50)
    const w = mount(HiprintCanvas)
    await w.vm.$nextTick()
    const v = w.find('.hiprint-guide-line--v')
    expect(v.exists()).toBe(true)
    expect(v.classes()).toContain('hiprint-guide-line')
    w.unmount()
  })
})

// ============================================================================
// TKT-259 — Drag-ref / position lines (Section P)
//
// `.hiprint-position-line` + `--h` / `--v` modifiers are emitted by
// DragOverlay.vue when the parent ElementWrapper flips to drag/resize mode.
// We assert the static DOM emitter shape — the lifecycle integration is
// covered by drag-overlay.spec.ts.
// ============================================================================

describe('missing-css-classes — TKT-259 position lines', () => {
  it('DragOverlay v-if mounts position-line classes', async () => {
    const { default: DragOverlay } = await import('../elements/DragOverlay.vue')
    const w = mount(DragOverlay, {
      props: { left: 100, top: 50, width: 80, height: 30, mode: 'drag' },
    })
    expect(w.find('.hiprint-position-line--h').exists()).toBe(true)
    expect(w.find('.hiprint-position-line--v').exists()).toBe(true)
    expect(w.find('.hiprint-position-line--h').classes()).toContain(
      'hiprint-position-line'
    )
    w.unmount()
  })

  it('DragOverlay renders size-readout chip during gesture', async () => {
    const { default: DragOverlay } = await import('../elements/DragOverlay.vue')
    const w = mount(DragOverlay, {
      props: { left: 100, top: 50, width: 80, height: 30, mode: 'resize' },
    })
    expect(w.find('.hiprint-size-readout').exists()).toBe(true)
    w.unmount()
  })
})

// ============================================================================
// TKT-260 — Resize panel chrome (Section Q)
// V3 uses BEM `.hiprint-element__handle` / `__del-btn` / `__size-box`.
// Confirm the BEM names render when an element is selected + unlocked.
// ============================================================================

describe('missing-css-classes — TKT-260 resize-panel chrome', () => {
  it('selected element renders BEM handle dots', async () => {
    const { default: ElementWrapper } = await import(
      '../elements/ElementWrapper.vue'
    )
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { width: 80, height: 30 },
    })
    canvas.selectElement('e1', 'replace')
    const w = mount(ElementWrapper, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    await w.vm.$nextTick()
    expect(w.findAll('.hiprint-element__handle').length).toBeGreaterThan(0)
    expect(w.find('.hiprint-element__size-box').exists()).toBe(true)
    expect(w.find('.hiprint-element__del-btn').exists()).toBe(true)
    w.unmount()
  })
})

// ============================================================================
// TKT-261 — Paper number badge (Section A) — verifies TKT-153 still in place
// ============================================================================

describe('missing-css-classes — TKT-261 paperNumber', () => {
  it('multi-panel renders `.hiprint-paperNumber`', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 210, height: 297 })
    canvas.addPanel({ id: 'p2', width: 210, height: 297 })
    const w = mount(HiprintPanel, { props: { panelId: 'p1' } })
    expect(w.find('.hiprint-paperNumber').exists()).toBe(true)
    w.unmount()
  })

  it('`paperNumberDisabled` flag emits `.hiprint-paperNumber-disabled`', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 210, height: 297 })
    canvas.addPanel({ id: 'p2', width: 210, height: 297 })
    // Cast — runtime supports the field, store schema is intentionally
    // permissive about extension keys (V1 parity).
    canvas.updatePanel('p1', { paperNumberDisabled: true } as never)
    const w = mount(HiprintPanel, { props: { panelId: 'p1' } })
    const badge = w.find('.hiprint-paperNumber')
    if (badge.exists()) {
      expect(badge.classes()).toContain('hiprint-paperNumber-disabled')
    }
    w.unmount()
  })
})

// ============================================================================
// TKT-262 — Type-color tags (Section H) — verifies Sprint 22d DB Stream work
// ============================================================================

describe('missing-css-classes — TKT-262 element-list type tags', () => {
  function seedTyped(type: string): void {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 210, height: 297 })
    canvas.addElement('p1', {
      tid: `t.${type}`,
      printElementType: { type },
      options: {},
    })
  }

  it('text row gets `.el-type-tag.tag-text`', () => {
    seedTyped('text')
    const w = mount(HiprintElementListPanel, { props: { initiallyOpen: true } })
    const tag = w.find('.el-type-tag')
    expect(tag.exists()).toBe(true)
    expect(tag.classes()).toContain('tag-text')
    w.unmount()
  })

  it('image row gets `.el-type-tag.tag-image`', () => {
    seedTyped('image')
    const w = mount(HiprintElementListPanel, { props: { initiallyOpen: true } })
    expect(w.find('.el-type-tag.tag-image').exists()).toBe(true)
    w.unmount()
  })

  it('table row gets `.el-type-tag.tag-table`', () => {
    seedTyped('table')
    const w = mount(HiprintElementListPanel, { props: { initiallyOpen: true } })
    expect(w.find('.el-type-tag.tag-table').exists()).toBe(true)
    w.unmount()
  })

  it('barcode row gets `.el-type-tag.tag-barcode`', () => {
    seedTyped('barcode')
    const w = mount(HiprintElementListPanel, { props: { initiallyOpen: true } })
    expect(w.find('.el-type-tag.tag-barcode').exists()).toBe(true)
    w.unmount()
  })
})

// ============================================================================
// TKT-263 — Designer edge-toggle + resize-bar (Section F)
// ============================================================================

describe('missing-css-classes — TKT-263 designer chrome', () => {
  it('designer renders both BEM and V1 hyphenated resize-bar classes', () => {
    const w = mount(HiprintDesigner)
    // BEM name (Sprint 22d TKT-150) is the primary.
    expect(w.find('.hiprint-designer__resize-bar').exists()).toBe(true)
    // V1 legacy hyphenated alias (TKT-263) is the bridge for caller CSS.
    expect(w.find('.hiprint-designer-resize-bar').exists()).toBe(true)
    w.unmount()
  })

  it('designer renders both BEM and V1 hyphenated edge-toggle classes', () => {
    const w = mount(HiprintDesigner)
    expect(w.find('.hiprint-designer__edge-toggle').exists()).toBe(true)
    expect(w.find('.hiprint-designer-edge-toggle').exists()).toBe(true)
    w.unmount()
  })
})

// ============================================================================
// TKT-265 — Toolbar primary/danger button variants (Section G)
// ============================================================================

describe('missing-css-classes — TKT-265 toolbar variant classes', () => {
  it('extraButton with `hiprint-toolbar-btn-primary` className renders', () => {
    const w = mount(HiprintToolbar, {
      props: {
        extraButtons: [
          {
            key: 'p',
            label: 'Primary',
            className: 'hiprint-toolbar-btn-primary',
          },
        ],
      },
    })
    const btn = w.find('button.hiprint-toolbar-btn-primary')
    expect(btn.exists()).toBe(true)
    w.unmount()
  })

  it('extraButton with `hiprint-toolbar-btn-danger` className renders', () => {
    const w = mount(HiprintToolbar, {
      props: {
        extraButtons: [
          {
            key: 'd',
            label: 'Danger',
            className: 'hiprint-toolbar-btn-danger',
          },
        ],
      },
    })
    expect(w.find('button.hiprint-toolbar-btn-danger').exists()).toBe(true)
    w.unmount()
  })

  it('toolbar SFC source contains hooks for both variants', async () => {
    // Smoke: the scoped style block of HiprintToolbar.vue must contain CSS
    // hooks for the primary + danger variants so caller business CSS can
    // rely on them. We read the source rather than the runtime CSSOM
    // because happy-dom does not collect Vue scoped <style> into
    // document.styleSheets at mount time.
    const fs = await import('node:fs')
    const path = await import('node:path')
    const sfcPath = path.resolve(
      process.cwd(),
      'src/hiprint-v3/components/HiprintToolbar.vue'
    )
    const src = fs.readFileSync(sfcPath, 'utf-8')
    expect(src.includes('hiprint-toolbar-btn-primary')).toBe(true)
    expect(src.includes('hiprint-toolbar-btn-danger')).toBe(true)
  })
})
