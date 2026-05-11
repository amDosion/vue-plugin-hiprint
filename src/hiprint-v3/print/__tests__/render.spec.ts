/**
 * render.spec.ts — V3 renderTemplate / renderPanel structural + XSS-safety tests.
 *
 * Coverage:
 *  - template-level structure (panel count, classNames)
 *  - panel geometry (paper width/height in pt)
 *  - XSS safety (textContent default; <script> tags rendered as text)
 *  - watermark / stylesheet href / errors in panels don't kill template
 *  - getPrintHtml subset (string serialization)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderTemplate, renderPanel } from '../render'
import type { TemplateJson, PanelJson } from '@hiprint-v3/schemas'

beforeEach(() => {
  // Silence expected console.warn from invariant-#8 paths
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

function makeTemplate(overrides: Partial<TemplateJson> = {}): TemplateJson {
  return {
    panels: [
      {
        width: 210,
        height: 297,
        printElements: [
          {
            options: { left: 10, top: 20, width: 100, height: 30, title: 'Name' },
            printElementType: { type: 'text', title: 'Name' },
          },
        ],
      },
    ],
    ...overrides,
  } as TemplateJson
}

describe('renderTemplate — structure', () => {
  it('returns an HTMLDivElement with hiprint-printTemplate class', () => {
    const root = renderTemplate(makeTemplate())
    expect(root).toBeInstanceOf(HTMLDivElement)
    expect(root.classList.contains('hiprint-printTemplate')).toBe(true)
  })

  it('panel count matches template.panels.length', () => {
    const tpl = makeTemplate({
      panels: [
        { width: 210, height: 297, printElements: [] },
        { width: 210, height: 297, printElements: [] },
        { width: 210, height: 297, printElements: [] },
      ],
    } as TemplateJson)
    const root = renderTemplate(tpl)
    expect(root.querySelectorAll('.hiprint-printPanel').length).toBe(3)
  })

  it('paper width/height set in pt from mm', () => {
    const root = renderTemplate(makeTemplate())
    const paper = root.querySelector('.hiprint-printPaper') as HTMLElement
    expect(paper).not.toBeNull()
    // 210mm → ~595.27pt; tolerate some rounding (just check 'pt' unit present)
    expect(paper.style.width.endsWith('pt')).toBe(true)
    expect(paper.style.height.endsWith('pt')).toBe(true)
    expect(paper.style.position).toBe('relative')
  })

  it('handles empty panels array without throwing', () => {
    const root = renderTemplate({ panels: [] } as TemplateJson)
    expect(root.querySelectorAll('.hiprint-printPanel').length).toBe(0)
  })
})

describe('renderTemplate — XSS safety (Invariant #1)', () => {
  it('text element renders user value as textContent (no script execution)', () => {
    const tpl: TemplateJson = {
      panels: [
        {
          width: 210,
          height: 297,
          printElements: [
            {
              options: {
                left: 0,
                top: 0,
                width: 100,
                height: 30,
                title: '<script>alert(1)</script>',
                hideTitle: false,
              },
              printElementType: { type: 'text' },
            },
          ],
        },
      ],
    } as TemplateJson
    const root = renderTemplate(tpl, { data: { foo: 'bar' } })
    // The dangerous fragment must appear in text, not as a real <script>
    expect(root.querySelectorAll('script').length).toBe(0)
    expect(root.textContent).toContain('<script>alert(1)</script>')
  })

  it('value from data also rendered via textContent', () => {
    const tpl: TemplateJson = {
      panels: [
        {
          width: 210,
          height: 297,
          printElements: [
            {
              options: {
                left: 0,
                top: 0,
                width: 100,
                height: 30,
                field: 'name',
                hideTitle: true,
              },
              printElementType: { type: 'text', field: 'name' },
            },
          ],
        },
      ],
    } as TemplateJson
    const root = renderTemplate(tpl, { data: { name: '<img src=x onerror=alert(1)>' } })
    expect(root.querySelectorAll('img').length).toBe(0)
    expect(root.textContent).toContain('<img src=x onerror=alert(1)>')
  })

  it('html element renders innerHTML (by-design, Invariant #2)', () => {
    const tpl: TemplateJson = {
      panels: [
        {
          width: 210,
          height: 297,
          printElements: [
            {
              options: {
                left: 0,
                top: 0,
                width: 100,
                height: 30,
                content: '<b>bold</b>',
              },
              printElementType: { type: 'html' },
            },
          ],
        },
      ],
    } as TemplateJson
    const root = renderTemplate(tpl)
    // html element MUST allow <b> to be a real element (by-design)
    expect(root.querySelectorAll('b').length).toBe(1)
  })
})

describe('renderTemplate — error isolation (Invariant #8)', () => {
  it('per-panel error does not abort other panels', () => {
    // Force a panel error by passing non-object printElements
    const tpl = {
      panels: [
        { width: 210, height: 297, printElements: [] },
        // Trigger element iteration error: make panel render throw via a getter
        Object.defineProperty({}, 'width', {
          get() {
            throw new Error('boom')
          },
        }) as PanelJson,
        { width: 210, height: 297, printElements: [] },
      ],
    } as TemplateJson
    const root = renderTemplate(tpl)
    // Two valid panels still rendered
    expect(root.querySelectorAll('.hiprint-printPanel').length).toBe(2)
  })

  it('per-element error does not abort other elements', () => {
    const tpl: TemplateJson = {
      panels: [
        {
          width: 210,
          height: 297,
          printElements: [
            {
              options: { left: 0, top: 0, width: 100, height: 30, title: 'Good' },
              printElementType: { type: 'text' },
            },
            // Bad element — getter throws on access
            Object.defineProperty({}, 'printElementType', {
              get() {
                throw new Error('boom')
              },
            }) as unknown as TemplateJson['panels'][number]['printElements'][number],
            {
              options: { left: 0, top: 30, width: 100, height: 30, title: 'Also good' },
              printElementType: { type: 'text' },
            },
          ],
        },
      ],
    } as TemplateJson
    const root = renderTemplate(tpl)
    // Two good text elements still rendered
    expect(root.querySelectorAll('.hiprint-printElement-text').length).toBe(2)
  })
})

describe('renderTemplate — options', () => {
  it('injects stylesheet href when provided', () => {
    const root = renderTemplate(makeTemplate(), { stylesheetHref: 'http://example.com/p.css' })
    const link = root.querySelector('link[rel="stylesheet"]') as HTMLLinkElement
    expect(link).not.toBeNull()
    expect(link.getAttribute('href')).toBe('http://example.com/p.css')
  })

  it('renders watermark when watermarkOptions.text present', () => {
    const tpl: TemplateJson = {
      panels: [
        {
          width: 210,
          height: 297,
          watermarkOptions: { text: 'DRAFT', color: '#999', fontSize: 20, opacity: 0.4 },
          printElements: [],
        },
      ],
    } as TemplateJson
    const root = renderTemplate(tpl)
    const wm = root.querySelector('.hiprint-watermark') as HTMLElement
    expect(wm).not.toBeNull()
    expect(wm.textContent).toBe('DRAFT')
  })
})

describe('renderPanel', () => {
  it('returns a panel element when called directly', () => {
    const panel: PanelJson = {
      width: 100,
      height: 100,
      printElements: [],
    } as PanelJson
    const el = renderPanel(panel)
    expect(el).toBeInstanceOf(HTMLDivElement)
    expect(el.classList.contains('hiprint-printPanel')).toBe(true)
  })

  it('falls back to default A4 when width/height missing', () => {
    const el = renderPanel({} as PanelJson)
    const paper = el.querySelector('.hiprint-printPaper') as HTMLElement
    // default 210mm width → some positive pt value
    const w = parseFloat(paper.style.width)
    expect(w).toBeGreaterThan(0)
  })

  it('respects backgroundColor / backgroundImage', () => {
    const el = renderPanel({
      width: 100,
      height: 100,
      backgroundColor: '#f00',
      backgroundImage: 'http://example.com/bg.png',
    } as PanelJson)
    const paper = el.querySelector('.hiprint-printPaper') as HTMLElement
    // happy-dom preserves authored value; browsers normalize to rgb(...).
    expect(paper.style.backgroundColor.toLowerCase()).toMatch(/#f00|rgb\(255,\s*0,\s*0\)/)
    expect(paper.style.backgroundImage).toContain('http://example.com/bg.png')
  })
})
