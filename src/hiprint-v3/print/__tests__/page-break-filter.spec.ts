/**
 * page-break-filter.spec.ts — TKT-025 pageBreak / showInPage / unShowInPage /
 * fixed per-element filtering (panel-level).
 *
 * V1 source:
 *  - bundle.js 692-704  BasePrintElement.showInPage
 *  - bundle.js 4200-4209 pageBreak option
 *  - bundle.js 4396     unShowInPage option
 *  - bundle.js 9831     isFixed() bypass in getPaperHtmlResult
 *
 * V3 surface: array-of-1-indexed-page-numbers (TKT-025 ticket) PLUS V1-compat
 * string semantics ('first'/'last'/'odd'/'even'/'none') for legacy templates.
 *
 * Tests assert per-page render outcomes by counting matched elements in the
 * rendered DOM for a specific `pageIndex` + `pageCount` combination.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderPanel } from '../render'
import type { PanelJson, ElementJson } from '@hiprint-v3/schemas'

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

function el(
  type: string,
  opts: Record<string, unknown>,
  id = 'e1'
): ElementJson {
  return {
    id,
    options: { left: 0, top: 0, width: 100, height: 20, ...opts },
    printElementType: { type },
  } as ElementJson
}

function makePanel(elements: ElementJson[]): PanelJson {
  return {
    width: 210,
    height: 297,
    printElements: elements,
  } as PanelJson
}

/** Count rendered wrapper divs in panel DOM (one per visible element). */
function countElements(panelEl: HTMLElement): number {
  // Match only direct wrapper children of the paper — sub-content divs may
  // also carry .hiprint-printElement-<type>-content but not the wrapper class.
  return panelEl.querySelectorAll(':scope > .hiprint-printPaper > .hiprint-printElement').length
}

describe('TKT-025 — pageBreak filter (array form)', () => {
  it('pageBreak=[1,3] renders on page 0 and page 2 (1-indexed)', () => {
    const e = el('text', { title: 'x', pageBreak: [1, 3] })
    const panel = makePanel([e])

    // Page index 0 → V1 page 1 → in whitelist → renders.
    const page0 = renderPanel(panel, { pageIndex: 0, pageCount: 4 })
    expect(countElements(page0)).toBe(1)

    // Page index 1 → V1 page 2 → NOT in whitelist → hidden.
    const page1 = renderPanel(panel, { pageIndex: 1, pageCount: 4 })
    expect(countElements(page1)).toBe(0)

    // Page index 2 → V1 page 3 → in whitelist → renders.
    const page2 = renderPanel(panel, { pageIndex: 2, pageCount: 4 })
    expect(countElements(page2)).toBe(1)

    // Page index 3 → V1 page 4 → NOT in whitelist → hidden.
    const page3 = renderPanel(panel, { pageIndex: 3, pageCount: 4 })
    expect(countElements(page3)).toBe(0)
  })

  it('pageBreak as boolean true (V1 marker) does NOT filter', () => {
    // V1 boolean pageBreak is a "force new page" marker, not a filter.
    const e = el('text', { title: 'always', pageBreak: true })
    const panel = makePanel([e])
    expect(countElements(renderPanel(panel, { pageIndex: 0 }))).toBe(1)
    expect(countElements(renderPanel(panel, { pageIndex: 5 }))).toBe(1)
  })

  it('pageBreak empty array hides on every page', () => {
    const e = el('text', { title: 'x', pageBreak: [] })
    const panel = makePanel([e])
    expect(countElements(renderPanel(panel, { pageIndex: 0 }))).toBe(0)
    expect(countElements(renderPanel(panel, { pageIndex: 5 }))).toBe(0)
  })
})

describe('TKT-025 — showInPage filter', () => {
  it('showInPage=[2] (V3 array) renders only on page index 1', () => {
    const e = el('text', { title: 'header', showInPage: [2] })
    const panel = makePanel([e])
    expect(countElements(renderPanel(panel, { pageIndex: 0, pageCount: 3 }))).toBe(0)
    expect(countElements(renderPanel(panel, { pageIndex: 1, pageCount: 3 }))).toBe(1)
    expect(countElements(renderPanel(panel, { pageIndex: 2, pageCount: 3 }))).toBe(0)
  })

  it('showInPage="first" (V1 legacy) renders only on first page', () => {
    const e = el('text', { title: 'cover', showInPage: 'first' })
    const panel = makePanel([e])
    expect(countElements(renderPanel(panel, { pageIndex: 0, pageCount: 3 }))).toBe(1)
    expect(countElements(renderPanel(panel, { pageIndex: 1, pageCount: 3 }))).toBe(0)
    expect(countElements(renderPanel(panel, { pageIndex: 2, pageCount: 3 }))).toBe(0)
  })

  it('showInPage="last" renders only on final page', () => {
    const e = el('text', { title: 'summary', showInPage: 'last' })
    const panel = makePanel([e])
    expect(countElements(renderPanel(panel, { pageIndex: 0, pageCount: 3 }))).toBe(0)
    expect(countElements(renderPanel(panel, { pageIndex: 1, pageCount: 3 }))).toBe(0)
    expect(countElements(renderPanel(panel, { pageIndex: 2, pageCount: 3 }))).toBe(1)
  })

  it('showInPage="odd" renders on V1 odd page numbers (1,3,5... → idx 0,2,4)', () => {
    const e = el('text', { title: 'odd', showInPage: 'odd' })
    const panel = makePanel([e])
    expect(countElements(renderPanel(panel, { pageIndex: 0, pageCount: 5 }))).toBe(1)
    expect(countElements(renderPanel(panel, { pageIndex: 1, pageCount: 5 }))).toBe(0)
    expect(countElements(renderPanel(panel, { pageIndex: 2, pageCount: 5 }))).toBe(1)
    expect(countElements(renderPanel(panel, { pageIndex: 3, pageCount: 5 }))).toBe(0)
    expect(countElements(renderPanel(panel, { pageIndex: 4, pageCount: 5 }))).toBe(1)
  })

  it('showInPage="even" renders on V1 even page numbers (2,4 → idx 1,3)', () => {
    const e = el('text', { title: 'even', showInPage: 'even' })
    const panel = makePanel([e])
    expect(countElements(renderPanel(panel, { pageIndex: 0, pageCount: 4 }))).toBe(0)
    expect(countElements(renderPanel(panel, { pageIndex: 1, pageCount: 4 }))).toBe(1)
    expect(countElements(renderPanel(panel, { pageIndex: 2, pageCount: 4 }))).toBe(0)
    expect(countElements(renderPanel(panel, { pageIndex: 3, pageCount: 4 }))).toBe(1)
  })

  it('showInPage="none" hides on every page', () => {
    const e = el('text', { title: 'invisible', showInPage: 'none' })
    const panel = makePanel([e])
    expect(countElements(renderPanel(panel, { pageIndex: 0, pageCount: 3 }))).toBe(0)
    expect(countElements(renderPanel(panel, { pageIndex: 1, pageCount: 3 }))).toBe(0)
  })
})

describe('TKT-025 — unShowInPage filter', () => {
  it('unShowInPage=[1] (V3 array) hides on page index 0', () => {
    const e = el('text', { title: 'noFirst', unShowInPage: [1] })
    const panel = makePanel([e])
    expect(countElements(renderPanel(panel, { pageIndex: 0, pageCount: 3 }))).toBe(0)
    expect(countElements(renderPanel(panel, { pageIndex: 1, pageCount: 3 }))).toBe(1)
    expect(countElements(renderPanel(panel, { pageIndex: 2, pageCount: 3 }))).toBe(1)
  })

  it('unShowInPage="first" (V1 legacy) hides only first page', () => {
    const e = el('text', { title: 'x', unShowInPage: 'first' })
    const panel = makePanel([e])
    expect(countElements(renderPanel(panel, { pageIndex: 0, pageCount: 3 }))).toBe(0)
    expect(countElements(renderPanel(panel, { pageIndex: 1, pageCount: 3 }))).toBe(1)
    expect(countElements(renderPanel(panel, { pageIndex: 2, pageCount: 3 }))).toBe(1)
  })

  it('unShowInPage="last" (V1 legacy) hides only last page', () => {
    const e = el('text', { title: 'x', unShowInPage: 'last' })
    const panel = makePanel([e])
    expect(countElements(renderPanel(panel, { pageIndex: 0, pageCount: 3 }))).toBe(1)
    expect(countElements(renderPanel(panel, { pageIndex: 1, pageCount: 3 }))).toBe(1)
    expect(countElements(renderPanel(panel, { pageIndex: 2, pageCount: 3 }))).toBe(0)
  })

  it('unShowInPage=[2,3] blacklists pages 1 and 2 (1-indexed)', () => {
    const e = el('text', { title: 'x', unShowInPage: [2, 3] })
    const panel = makePanel([e])
    expect(countElements(renderPanel(panel, { pageIndex: 0, pageCount: 4 }))).toBe(1)
    expect(countElements(renderPanel(panel, { pageIndex: 1, pageCount: 4 }))).toBe(0)
    expect(countElements(renderPanel(panel, { pageIndex: 2, pageCount: 4 }))).toBe(0)
    expect(countElements(renderPanel(panel, { pageIndex: 3, pageCount: 4 }))).toBe(1)
  })
})

describe('TKT-025 — fixed element (V1 isFixed bypass)', () => {
  it('fixed=true renders on every page regardless of other filters', () => {
    // fixed should win over showInPage='first' (which would normally hide
    // on pages 1+).
    const e = el('text', {
      title: 'header',
      fixed: true,
      showInPage: 'first',
    })
    const panel = makePanel([e])
    expect(countElements(renderPanel(panel, { pageIndex: 0, pageCount: 5 }))).toBe(1)
    expect(countElements(renderPanel(panel, { pageIndex: 1, pageCount: 5 }))).toBe(1)
    expect(countElements(renderPanel(panel, { pageIndex: 4, pageCount: 5 }))).toBe(1)
  })

  it('fixed="true" string form also recognized (V1 select widget)', () => {
    const e = el('text', { title: 'x', fixed: 'true', unShowInPage: 'first' })
    const panel = makePanel([e])
    // fixed bypasses unShowInPage filter.
    expect(countElements(renderPanel(panel, { pageIndex: 0, pageCount: 3 }))).toBe(1)
  })

  it('fixed=false (or missing) does NOT bypass filters', () => {
    const e = el('text', { title: 'x', fixed: false, showInPage: 'last' })
    const panel = makePanel([e])
    expect(countElements(renderPanel(panel, { pageIndex: 0, pageCount: 3 }))).toBe(0)
    expect(countElements(renderPanel(panel, { pageIndex: 2, pageCount: 3 }))).toBe(1)
  })
})

describe('TKT-025 — combined filters', () => {
  it('multiple filters AND together (showInPage + unShowInPage)', () => {
    // showInPage=[1,2,3,4] AND unShowInPage=[2] → renders on pages 1,3,4 only.
    const e = el('text', {
      title: 'combo',
      showInPage: [1, 2, 3, 4],
      unShowInPage: [2],
    })
    const panel = makePanel([e])
    expect(countElements(renderPanel(panel, { pageIndex: 0, pageCount: 4 }))).toBe(1)
    expect(countElements(renderPanel(panel, { pageIndex: 1, pageCount: 4 }))).toBe(0)
    expect(countElements(renderPanel(panel, { pageIndex: 2, pageCount: 4 }))).toBe(1)
    expect(countElements(renderPanel(panel, { pageIndex: 3, pageCount: 4 }))).toBe(1)
  })

  it('no filter options → element renders on every page', () => {
    const e = el('text', { title: 'always' })
    const panel = makePanel([e])
    expect(countElements(renderPanel(panel, { pageIndex: 0, pageCount: 1 }))).toBe(1)
    expect(countElements(renderPanel(panel, { pageIndex: 5, pageCount: 10 }))).toBe(1)
  })

  it('default pageIndex=0 + no pageCount → all filters apply with idx=0', () => {
    const e = el('text', { title: 'first only', showInPage: 'first' })
    const panel = makePanel([e])
    // No options → pageIndex defaults to 0 → 'first' rule matches.
    expect(countElements(renderPanel(panel))).toBe(1)
  })
})

describe('TKT-025 — multiple elements per panel', () => {
  it('only matching elements render; others are skipped', () => {
    const panel = makePanel([
      el('text', { title: 'first only', showInPage: 'first' }, 'e1'),
      el('text', { title: 'last only', showInPage: 'last' }, 'e2'),
      el('text', { title: 'every', fixed: true }, 'e3'),
      el('text', { title: 'page 2', showInPage: [2] }, 'e4'),
    ])
    // pageIndex=0 (first page of 3) → e1 (first), e3 (fixed) render.
    const page0 = renderPanel(panel, { pageIndex: 0, pageCount: 3 })
    expect(countElements(page0)).toBe(2)

    // pageIndex=1 (middle) → e3 (fixed), e4 (page 2) render.
    const page1 = renderPanel(panel, { pageIndex: 1, pageCount: 3 })
    expect(countElements(page1)).toBe(2)

    // pageIndex=2 (last) → e2 (last), e3 (fixed) render.
    const page2 = renderPanel(panel, { pageIndex: 2, pageCount: 3 })
    expect(countElements(page2)).toBe(2)
  })
})
