/**
 * text-longtext-wrap-lheight.spec.ts — Sprint 22g wave 3 final 2 tickets.
 *
 * TKT-340 (textContentWrap CSS class injection) and TKT-341 (longText
 * lHeight minimum-line-height) — last actionable rows in Section 02 of the
 * V3 parity matrix REMAINING-GAPS doc.
 *
 * Coverage:
 *   - TKT-340 — TextElement + LongTextElement emit
 *     `.hiprint-text-content-wrap` parent class + per-value modifier
 *     (`-nowrap` / `-clip` / `-ellipsis`). Default (no opt) emits parent
 *     only. Unknown values are ignored (no modifier).
 *   - TKT-341 — LongTextElement with `lHeight: N` sets inner div
 *     `min-height: Npt`. Accepts `minHeight` alias. Zero / negative / NaN
 *     are dropped (no minHeight).
 *
 * V1 ref: bundle.js 4837-4844 (textContentWrap class injection),
 * bundle.js 9818-9892 (lHeight quirk J.9).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TextElement from '../TextElement.vue'
import LongTextElement from '../LongTextElement.vue'
import { useCanvasStore } from '@hiprint-v3/stores'

beforeEach(() => {
  setActivePinia(createPinia())
})

function seedText(opts: Record<string, unknown>) {
  const canvas = useCanvasStore()
  canvas.addPanel({ id: 'p1', width: 200, height: 200 })
  canvas.addElement('p1', {
    id: 'e1',
    tid: 't.text',
    printElementType: { type: 'text' },
    options: { hideTitle: true, ...opts },
  })
}

function seedLongText(opts: Record<string, unknown>) {
  const canvas = useCanvasStore()
  canvas.addPanel({ id: 'p1', width: 200, height: 200 })
  canvas.addElement('p1', {
    id: 'e1',
    tid: 't.longText',
    printElementType: { type: 'longText' },
    options: { hideTitle: true, ...opts },
  })
}

describe('TKT-340 — textContentWrap CSS class injection', () => {
  it('TextElement emits parent `.hiprint-text-content-wrap` class when no opt set', () => {
    seedText({ field: 'name', testData: 'foo' })
    const w = mount(TextElement, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    const inner = w.find('.hiprint-printElement-text-content')
    expect(inner.exists()).toBe(true)
    expect(inner.classes()).toContain('hiprint-text-content-wrap')
    // No modifier class when textContentWrap unset.
    expect(
      inner.classes().some((c) => c.startsWith('hiprint-text-content-wrap-'))
    ).toBe(false)
    w.unmount()
  })

  it.each(['nowrap', 'clip', 'ellipsis'] as const)(
    'TextElement emits `.hiprint-text-content-wrap-%s` when set',
    (mode) => {
      seedText({ field: 'name', testData: 'foo', textContentWrap: mode })
      const w = mount(TextElement, {
        props: { elementId: 'e1', panelId: 'p1', interactive: false },
      })
      const inner = w.find('.hiprint-printElement-text-content')
      expect(inner.classes()).toContain('hiprint-text-content-wrap')
      expect(inner.classes()).toContain('hiprint-text-content-wrap-' + mode)
      w.unmount()
    }
  )

  it('TextElement ignores unknown wrap value (no modifier emitted)', () => {
    seedText({ field: 'name', testData: 'foo', textContentWrap: 'bogus' })
    const w = mount(TextElement, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    const inner = w.find('.hiprint-printElement-text-content')
    expect(inner.classes()).toContain('hiprint-text-content-wrap')
    expect(
      inner.classes().some((c) => c.startsWith('hiprint-text-content-wrap-'))
    ).toBe(false)
    w.unmount()
  })

  it.each(['nowrap', 'clip', 'ellipsis'] as const)(
    'LongTextElement emits `.hiprint-text-content-wrap-%s` when set',
    (mode) => {
      seedLongText({ field: 'body', testData: 'foo bar', textContentWrap: mode })
      const w = mount(LongTextElement, {
        props: { elementId: 'e1', panelId: 'p1', interactive: false },
      })
      const inner = w.find('.hiprint-printElement-longText-content')
      expect(inner.classes()).toContain('hiprint-text-content-wrap')
      expect(inner.classes()).toContain('hiprint-text-content-wrap-' + mode)
      w.unmount()
    }
  )
})

describe('TKT-341 — longText lHeight minimum line height', () => {
  it('LongTextElement with lHeight:30 sets inner min-height to 30pt', () => {
    seedLongText({ field: 'body', testData: 'tiny', lHeight: 30 })
    const w = mount(LongTextElement, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    const inner = w.find('.hiprint-printElement-longText-content')
    const el = inner.element as HTMLElement
    expect(el.style.minHeight).toBe('30pt')
    w.unmount()
  })

  it('LongTextElement accepts `minHeight` as alias for `lHeight`', () => {
    seedLongText({ field: 'body', testData: 'tiny', minHeight: 45 })
    const w = mount(LongTextElement, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    const inner = w.find('.hiprint-printElement-longText-content')
    expect((inner.element as HTMLElement).style.minHeight).toBe('45pt')
    w.unmount()
  })

  it('LongTextElement with no lHeight/minHeight emits no min-height inline style', () => {
    seedLongText({ field: 'body', testData: 'tiny' })
    const w = mount(LongTextElement, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    const inner = w.find('.hiprint-printElement-longText-content')
    expect((inner.element as HTMLElement).style.minHeight).toBe('')
    w.unmount()
  })

  it('LongTextElement with lHeight:0 emits no min-height (V1 zero == disabled)', () => {
    seedLongText({ field: 'body', testData: 'tiny', lHeight: 0 })
    const w = mount(LongTextElement, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    const inner = w.find('.hiprint-printElement-longText-content')
    expect((inner.element as HTMLElement).style.minHeight).toBe('')
    w.unmount()
  })

  it('LongTextElement with negative lHeight clamps to 0 (no min-height)', () => {
    seedLongText({ field: 'body', testData: 'tiny', lHeight: -5 })
    const w = mount(LongTextElement, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    const inner = w.find('.hiprint-printElement-longText-content')
    expect((inner.element as HTMLElement).style.minHeight).toBe('')
    w.unmount()
  })

  it('LongTextElement prefers lHeight over minHeight when both present', () => {
    // V1 canonical key wins. LongTextPropertyPanel writes lHeight directly,
    // so a template carrying both should resolve to lHeight.
    seedLongText({ field: 'body', testData: 'tiny', lHeight: 50, minHeight: 99 })
    const w = mount(LongTextElement, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    const inner = w.find('.hiprint-printElement-longText-content')
    expect((inner.element as HTMLElement).style.minHeight).toBe('50pt')
    w.unmount()
  })
})

// =============================================================================
// Print-pipeline parity tests — `renderElement` (imperative, DOM-direct) must
// emit the same class + style structure as the SFC. Same fixtures, different
// path. Ensures both designer + print HTML stay in sync.
// =============================================================================

import { renderElement } from '@hiprint-v3/print/render'
import type { ElementJson, PanelJson } from '@hiprint-v3/schemas'

const PRINT_PANEL: PanelJson = {
  width: 210,
  height: 297,
  printElements: [],
} as PanelJson

function pe(type: string, opts: Record<string, unknown> = {}): ElementJson {
  return {
    options: { left: 0, top: 0, width: 100, height: 30, ...opts },
    printElementType: { type },
  } as ElementJson
}

describe('TKT-340 — render.ts text path', () => {
  it('emits parent `.hiprint-text-content-wrap` even without opt', () => {
    const node = renderElement(pe('text', { title: 'x' }), PRINT_PANEL)
    const inner = node.querySelector('.hiprint-printElement-text-content')
    expect(inner).not.toBeNull()
    expect(inner!.classList.contains('hiprint-text-content-wrap')).toBe(true)
  })

  it.each(['nowrap', 'clip', 'ellipsis'] as const)(
    'emits `.hiprint-text-content-wrap-%s` when set on text element',
    (mode) => {
      const node = renderElement(
        pe('text', { title: 'x', textContentWrap: mode }),
        PRINT_PANEL
      )
      const inner = node.querySelector('.hiprint-printElement-text-content')
      expect(inner!.classList.contains('hiprint-text-content-wrap-' + mode)).toBe(true)
    }
  )

  it('ignores unknown textContentWrap on text element (no modifier class)', () => {
    const node = renderElement(
      pe('text', { title: 'x', textContentWrap: 'invalid' }),
      PRINT_PANEL
    )
    const inner = node.querySelector('.hiprint-printElement-text-content')!
    const classes = Array.from(inner.classList)
    expect(classes.some((c) => c.startsWith('hiprint-text-content-wrap-'))).toBe(false)
  })
})

describe('TKT-340 + TKT-341 — render.ts longText path', () => {
  it.each(['nowrap', 'clip', 'ellipsis'] as const)(
    'emits `.hiprint-text-content-wrap-%s` when set on longText element',
    (mode) => {
      const node = renderElement(
        pe('longText', { hideTitle: true, testData: 'x', textContentWrap: mode }),
        PRINT_PANEL
      )
      const inner = node.querySelector('.hiprint-printElement-longText-content')
      expect(inner!.classList.contains('hiprint-text-content-wrap-' + mode)).toBe(
        true
      )
    }
  )

  it('emits inline min-height when lHeight is set', () => {
    const node = renderElement(
      pe('longText', { hideTitle: true, testData: 'tiny', lHeight: 36 }),
      PRINT_PANEL
    )
    const inner = node.querySelector(
      '.hiprint-printElement-longText-content'
    ) as HTMLElement
    expect(inner.style.minHeight).toBe('36pt')
  })

  it('emits inline min-height from minHeight alias', () => {
    const node = renderElement(
      pe('longText', { hideTitle: true, testData: 'tiny', minHeight: 12 }),
      PRINT_PANEL
    )
    const inner = node.querySelector(
      '.hiprint-printElement-longText-content'
    ) as HTMLElement
    expect(inner.style.minHeight).toBe('12pt')
  })

  it('emits no min-height when neither key set', () => {
    const node = renderElement(
      pe('longText', { hideTitle: true, testData: 'tiny' }),
      PRINT_PANEL
    )
    const inner = node.querySelector(
      '.hiprint-printElement-longText-content'
    ) as HTMLElement
    expect(inner.style.minHeight).toBe('')
  })
})
