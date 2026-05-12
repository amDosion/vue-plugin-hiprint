/**
 * TableElement-render-parity.spec.ts — TKT-021 Sprint 22b parity proof.
 *
 * Asserts that for the same template fixture, the V3 designer path
 * (`TableElement.vue` Vue-mounted DOM) and the V3 print path
 * (`print/render.ts` imperative HTML emission) produce STRUCTURALLY
 * EQUIVALENT DOM trees. Whitespace, ordering of style sub-properties, and
 * comment nodes are ignored.
 *
 * Why this matters:
 *  - Before Sprint 22b the two paths had inconsistent semantics
 *    (V3-PARITY-MATRIX 06-table.md Appendix G). ~85% of fields silently
 *    corrupted in V1↔V3 round-trip.
 *  - After Sprint 22b both paths route through `buildTableModel`. This spec
 *    locks that contract so future drift surfaces immediately.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useCanvasStore } from '@hiprint-v3/stores'
import TableElement from '../TableElement.vue'
import { renderElement } from '../../../../print/render'
import type {
  ElementJson,
  PanelJson,
} from '../../../../../hiprint-v3/schemas'

const PANEL: PanelJson = {
  index: 0,
  width: 210,
  height: 297,
  paperHeader: 0,
  paperFooter: 0,
  printElements: [],
}

/**
 * Normalize a DOM `<table>` (or sub-tree) into a canonical comparable
 * string. We extract the structural skeleton — tag name, attributes that
 * affect layout (rowspan / colspan / class / colspan), and the text content
 * of leaf nodes. Inline-style declarations are normalized to a sorted
 * `key:value;` form so property-order doesn't trip the assertion.
 */
function normalizeTable(node: HTMLElement | null | undefined): string {
  if (!node) return ''
  const lines: string[] = []
  function walk(n: Node, depth: number): void {
    if (n.nodeType === 3 /* text */) {
      const t = (n.textContent || '').replace(/\s+/g, ' ').trim()
      if (t) lines.push(indent(depth) + '#text: ' + t)
      return
    }
    if (n.nodeType !== 1 /* element */) return
    const el = n as Element
    const tag = el.tagName.toLowerCase()
    const parts: string[] = [tag]
    // Sort attributes alphabetically for determinism.
    const attrNames: string[] = []
    for (let i = 0; i < el.attributes.length; i++) {
      const a = el.attributes.item(i)
      if (a) attrNames.push(a.name)
    }
    attrNames.sort()
    for (const an of attrNames) {
      if (an === 'style') {
        const s = el.getAttribute('style') ?? ''
        const norm = normalizeStyle(s)
        if (norm) parts.push('style="' + norm + '"')
      } else if (an === 'class') {
        const cls = (el.getAttribute('class') ?? '')
          .split(/\s+/)
          .filter(Boolean)
          .sort()
          .join(' ')
        if (cls) parts.push('class="' + cls + '"')
      } else {
        parts.push(an + '="' + el.getAttribute(an) + '"')
      }
    }
    lines.push(indent(depth) + parts.join(' '))
    for (let i = 0; i < el.childNodes.length; i++) {
      const child = el.childNodes[i]
      if (child) walk(child, depth + 1)
    }
  }
  function indent(d: number): string {
    return '  '.repeat(d)
  }
  function normalizeStyle(s: string): string {
    const pairs = s
      .split(';')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        const idx = p.indexOf(':')
        if (idx < 0) return p
        const k = p.slice(0, idx).trim()
        const v = p.slice(idx + 1).trim()
        return k + ':' + v
      })
    pairs.sort()
    return pairs.join(';')
  }
  walk(node, 0)
  return lines.join('\n')
}

/**
 * Mount TableElement with the given options + data, and return the inner
 * `<table>` element used for parity comparison.
 */
function mountTable(
  options: Record<string, unknown>,
  data?: Record<string, unknown>
): { tableEl: HTMLElement | null } {
  const canvas = useCanvasStore()
  const panel = canvas.addPanel({ width: 210, height: 297 })
  const el = canvas.addElement(panel.id, {
    tid: 'default.table',
    options,
    printElementType: { type: 'table' },
  })!
  const wrapper = mount(TableElement, {
    props: {
      elementId: el.id,
      panelId: panel.id,
      data,
      interactive: false,
    },
  })
  const tableEl = wrapper.find('table.hiprint-printElement-tableTarget')
  return { tableEl: tableEl.exists() ? (tableEl.element as HTMLElement) : null }
}

/**
 * Render the same fixture via print/render.ts and return its inner `<table>`.
 */
function renderTable(
  options: Record<string, unknown>,
  data?: Record<string, unknown>
): HTMLElement | null {
  const element: ElementJson = {
    id: 'parity-' + Math.random().toString(36).slice(2),
    tid: 'default.table',
    options,
    printElementType: { type: 'table' },
  }
  const wrapper = renderElement(element, PANEL, { data })
  // `renderElement` returns the outer absolute-positioned wrapper. The table
  // is one level down in the inner content div.
  const table = wrapper.querySelector('table.hiprint-printElement-tableTarget')
  return table as HTMLElement | null
}

describe('TableElement vs render.ts — DOM parity', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('simple single-layer columns + bound data', () => {
    const options = {
      columns: [
        [
          { title: 'Name', field: 'name' },
          { title: 'Qty', field: 'qty' },
        ],
      ],
      field: 'rows',
    }
    const data = { rows: [{ name: 'Alice', qty: 3 }, { name: 'Bob', qty: 7 }] }
    const { tableEl } = mountTable(options, data)
    const renderedEl = renderTable(options, data)
    expect(tableEl).not.toBeNull()
    expect(renderedEl).not.toBeNull()
    expect(normalizeTable(tableEl)).toBe(normalizeTable(renderedEl))
  })

  it('multi-layer columns + field inheritance + testData', () => {
    const options = {
      columns: [
        [{ title: 'Group', colspan: 2, field: 'g' }],
        [{ title: 'A', field: 'a' }, { title: 'B', field: 'b' }],
      ],
      testData: '[{"a":1,"b":2},{"a":3,"b":4}]',
    }
    const { tableEl } = mountTable(options)
    const renderedEl = renderTable(options)
    expect(normalizeTable(tableEl)).toBe(normalizeTable(renderedEl))
  })

  it('rowsColumnsMerge → display:none on hidden cell (V1 G.3)', () => {
    const options = {
      columns: [
        [
          { title: 'G', field: 'g' },
          { title: 'V', field: 'v' },
        ],
      ],
      testData: '[{"g":"x","v":1},{"g":"x","v":2}]',
      rowsColumnsMerge: function (
        _r: unknown,
        _c: unknown,
        cIdx: number,
        rIdx: number
      ): [number, number] {
        if (cIdx === 0 && rIdx === 0) return [2, 1]
        if (cIdx === 0 && rIdx === 1) return [0, 1]
        return [1, 1]
      },
    }
    const { tableEl } = mountTable(options)
    const renderedEl = renderTable(options)
    expect(tableEl).not.toBeNull()
    expect(renderedEl).not.toBeNull()
    // Both paths must keep the merged-away cell in DOM with display:none
    // rather than omitting it (V1 G.3 parity).
    const tableElHiddenCells = tableEl
      ? Array.from(tableEl.querySelectorAll('tbody td')).filter((td) =>
          (td as HTMLElement).style.display === 'none'
        )
      : []
    const renderedHiddenCells = renderedEl
      ? Array.from(renderedEl.querySelectorAll('tbody td')).filter(
          (td) => (td as HTMLElement).style.display === 'none'
        )
      : []
    expect(tableElHiddenCells.length).toBe(renderedHiddenCells.length)
    expect(tableElHiddenCells.length).toBe(1)
    expect(normalizeTable(tableEl)).toBe(normalizeTable(renderedEl))
  })

  it('gridColumnsFooter rows agree on schema', () => {
    const options = {
      columns: [[{ title: 'A', field: 'a' }]],
      testData: '[{"a":1}]',
      gridColumnsFooter: [
        [{ title: 'Total:', colspan: 1 }],
        [{ title: 'Notes' }],
      ],
    }
    const { tableEl } = mountTable(options)
    const renderedEl = renderTable(options)
    expect(tableEl?.querySelectorAll('tfoot tr').length).toBe(2)
    expect(renderedEl?.querySelectorAll('tfoot tr').length).toBe(2)
    expect(normalizeTable(tableEl)).toBe(normalizeTable(renderedEl))
  })

  it('formatter string-source compiles in both paths (V1 P.11)', () => {
    const options = {
      columns: [
        [
          {
            title: 'V',
            field: 'v',
            formatter: 'function(v) { return "<em>" + v + "</em>"; }',
          },
        ],
      ],
      testData: '[{"v":42}]',
    }
    const { tableEl } = mountTable(options)
    const renderedEl = renderTable(options)
    expect(tableEl?.querySelectorAll('em').length).toBe(1)
    expect(renderedEl?.querySelectorAll('em').length).toBe(1)
    expect(normalizeTable(tableEl)).toBe(normalizeTable(renderedEl))
  })

  it('column.field flat key (V1 line 2138-2139) — both paths agree', () => {
    // Row has literal-dot key. V1 fidelity: column.field "user.name" should
    // resolve to the flat key, not the nested object.
    const options = {
      columns: [[{ title: 'N', field: 'user.name' }]],
      testData: '[{"user.name":"Literal","user":{"name":"Nested"}}]',
    }
    const { tableEl } = mountTable(options)
    const renderedEl = renderTable(options)
    expect(tableEl?.querySelector('tbody td')?.textContent).toBe('Literal')
    expect(renderedEl?.querySelector('tbody td')?.textContent).toBe('Literal')
    expect(normalizeTable(tableEl)).toBe(normalizeTable(renderedEl))
  })

  it('column.field dot-path fallback (V3 extension) — both paths agree', () => {
    const options = {
      columns: [[{ title: 'N', field: 'user.name' }]],
      testData: '[{"user":{"name":"Nested"}}]',
    }
    const { tableEl } = mountTable(options)
    const renderedEl = renderTable(options)
    expect(tableEl?.querySelector('tbody td')?.textContent).toBe('Nested')
    expect(renderedEl?.querySelector('tbody td')?.textContent).toBe('Nested')
    expect(normalizeTable(tableEl)).toBe(normalizeTable(renderedEl))
  })

  it('table.field dot-path resolution (V1 F.1 line 6533) — both paths agree', () => {
    const options = {
      columns: [[{ title: 'N', field: 'n' }]],
      field: 'biz.items',
    }
    const data = { biz: { items: [{ n: 100 }, { n: 200 }] } }
    const { tableEl } = mountTable(options, data)
    const renderedEl = renderTable(options, data)
    expect(tableEl?.querySelectorAll('tbody tr').length).toBe(2)
    expect(renderedEl?.querySelectorAll('tbody tr').length).toBe(2)
    expect(normalizeTable(tableEl)).toBe(normalizeTable(renderedEl))
  })
})
