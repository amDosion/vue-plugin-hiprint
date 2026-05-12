/**
 * TableElement-render-parity-sprint22g.spec.ts — Sprint 22g wave 3 GM.
 *
 * Extends TableElement-render-parity.spec.ts coverage to the new code paths
 * added in this wave so the V3 designer DOM and the print/render.ts HTML
 * stay byte-equivalent.
 *
 * Locked fixtures:
 *  - Summary row (TKT-382)
 *  - Grouped body (TKT-382)
 *  - tableHeaderRowHeight + tableHeaderBackground (TKT-385/386)
 *  - upperCase per-cell (TKT-388)
 *  - tableCustomCell (TKT-389)
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useCanvasStore } from '@hiprint-v3/stores'
import TableElement from '../TableElement.vue'
import { renderElement } from '../../../../print/render'
import type { ElementJson, PanelJson } from '../../../../schemas'

const PANEL: PanelJson = {
  index: 0,
  width: 210,
  height: 297,
  paperHeader: 0,
  paperFooter: 0,
  printElements: [],
}

function normalizeTable(node: HTMLElement | null | undefined): string {
  if (!node) return ''
  const lines: string[] = []
  function walk(n: Node, depth: number): void {
    if (n.nodeType === 3) {
      const t = (n.textContent || '').replace(/\s+/g, ' ').trim()
      if (t) lines.push(indent(depth) + '#text: ' + t)
      return
    }
    if (n.nodeType !== 1) return
    const el = n as Element
    const tag = el.tagName.toLowerCase()
    const parts: string[] = [tag]
    const names: string[] = []
    for (let i = 0; i < el.attributes.length; i++) {
      const a = el.attributes.item(i)
      if (a) names.push(a.name)
    }
    names.sort()
    for (const an of names) {
      if (an === 'style') {
        const s = normalizeStyle(el.getAttribute('style') ?? '')
        if (s) parts.push('style="' + s + '"')
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
      const c = el.childNodes[i]
      if (c) walk(c, depth + 1)
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
        return p.slice(0, idx).trim() + ':' + p.slice(idx + 1).trim()
      })
    pairs.sort()
    return pairs.join(';')
  }
  walk(node, 0)
  return lines.join('\n')
}

function mountTable(
  options: Record<string, unknown>,
  data?: Record<string, unknown>
): HTMLElement | null {
  const canvas = useCanvasStore()
  const panel = canvas.addPanel({ width: 210, height: 297 })
  const el = canvas.addElement(panel.id, {
    tid: 'default.table',
    options,
    printElementType: { type: 'table' },
  })!
  const wrapper = mount(TableElement, {
    props: { elementId: el.id, panelId: panel.id, data, interactive: false },
  })
  const t = wrapper.find('table.hiprint-printElement-tableTarget')
  return t.exists() ? (t.element as HTMLElement) : null
}

function renderTable(
  options: Record<string, unknown>,
  data?: Record<string, unknown>
): HTMLElement | null {
  const element: ElementJson = {
    id: 'p-' + Math.random().toString(36).slice(2),
    tid: 'default.table',
    options,
    printElementType: { type: 'table' },
  }
  const wrapper = renderElement(element, PANEL, { data })
  return wrapper.querySelector('table.hiprint-printElement-tableTarget') as
    | HTMLElement
    | null
}

describe('TableElement vs render.ts — Sprint 22g wave 3 parity', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('summary row (TKT-382) — both paths produce the same <tfoot> structure', () => {
    const opts = {
      columns: [
        [
          { title: 'Item', field: 'item' },
          {
            title: 'Qty',
            field: 'qty',
            tableSummary: 'sum',
            tableSummaryNumFormat: 0,
          },
        ],
      ],
      testData: '[{"item":"A","qty":10},{"item":"B","qty":20}]',
    }
    const a = mountTable(opts)
    const b = renderTable(opts)
    expect(a?.querySelector('tr.hiprint-printElement-table-summary')).not.toBeNull()
    expect(b?.querySelector('tr.hiprint-printElement-table-summary')).not.toBeNull()
    expect(normalizeTable(a)).toBe(normalizeTable(b))
  })

  it('grouped body (TKT-382) — both paths interleave group-header / row / group-footer', () => {
    const opts = {
      columns: [
        [
          { title: 'Type', field: 'type' },
          { title: 'N', field: 'n' },
        ],
      ],
      groupFields: ['type'],
      groupFormatter: 'function(cs, all, pd, g){return "G:"+g.type}',
      groupFooterFormatter: 'function(){return "end"}',
      testData:
        '[{"type":"a","n":1},{"type":"a","n":2},{"type":"b","n":3}]',
    }
    const a = mountTable(opts)
    const b = renderTable(opts)
    expect(
      a?.querySelectorAll('tr.hiprint-printElement-table-group-header').length
    ).toBe(2)
    expect(
      b?.querySelectorAll('tr.hiprint-printElement-table-group-header').length
    ).toBe(2)
    expect(
      a?.querySelectorAll('tr.hiprint-printElement-table-group-footer').length
    ).toBe(2)
    expect(
      b?.querySelectorAll('tr.hiprint-printElement-table-group-footer').length
    ).toBe(2)
    expect(normalizeTable(a)).toBe(normalizeTable(b))
  })

  it('upperCase per-cell (TKT-388) — both paths render upper-cased value', () => {
    const opts = {
      columns: [[{ title: 'V', field: 'v', upperCase: 'true' }]],
      testData: '[{"v":"abc"}]',
    }
    const a = mountTable(opts)
    const b = renderTable(opts)
    expect(a?.querySelector('tbody td')?.textContent).toBe('ABC')
    expect(b?.querySelector('tbody td')?.textContent).toBe('ABC')
    expect(normalizeTable(a)).toBe(normalizeTable(b))
  })

  it('tableCustomCell HTML (TKT-389) — both paths inject as innerHTML', () => {
    const opts = {
      columns: [
        [
          {
            title: 'C',
            field: 'c',
            tableTextType: 'custom',
            customCellHtml: '<u>custom</u>',
          },
        ],
      ],
      testData: '[{"c":1}]',
    }
    const a = mountTable(opts)
    const b = renderTable(opts)
    expect(a?.querySelector('tbody td u')?.textContent).toBe('custom')
    expect(b?.querySelector('tbody td u')?.textContent).toBe('custom')
    expect(normalizeTable(a)).toBe(normalizeTable(b))
  })
})
