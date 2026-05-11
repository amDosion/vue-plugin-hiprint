/**
 * browser-print.spec.ts — V3 browserPrint + getPrintHtml tests.
 *
 * happy-dom lacks a real native print dialog, so we verify iframe injection,
 * cleanup, the afterprint event handling, and the HTML serialization path.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { browserPrint, getPrintHtml } from '../browser-print'
import type { TemplateJson } from '@hiprint-v3/schemas'

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

function tpl(): TemplateJson {
  return {
    panels: [
      {
        width: 210,
        height: 297,
        printElements: [
          {
            options: { left: 0, top: 0, width: 100, height: 30, title: 'Hello' },
            printElementType: { type: 'text' },
          },
        ],
      },
    ],
  } as TemplateJson
}

describe('getPrintHtml', () => {
  it('returns the rendered template outerHTML as a string', () => {
    const html = getPrintHtml(tpl())
    expect(typeof html).toBe('string')
    expect(html).toContain('hiprint-printTemplate')
    expect(html).toContain('hiprint-printPanel')
  })

  it('text is rendered as textContent (XSS safe)', () => {
    const t: TemplateJson = {
      panels: [
        {
          width: 100,
          height: 100,
          printElements: [
            {
              options: { left: 0, top: 0, width: 100, height: 30, title: '<script>x</script>' },
              printElementType: { type: 'text' },
            },
          ],
        },
      ],
    } as TemplateJson
    const html = getPrintHtml(t)
    // Encoded — no live <script>
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>x</script>')
  })

  it('injects stylesheet link when stylesheetHref provided', () => {
    const html = getPrintHtml(tpl(), { stylesheetHref: 'http://example.com/p.css' })
    expect(html).toContain('rel="stylesheet"')
    expect(html).toContain('http://example.com/p.css')
  })
})

describe('browserPrint — iframe injection', () => {
  it('appends a hidden iframe to body and resolves after print', async () => {
    const bodyBefore = document.querySelectorAll('iframe').length
    const promise = browserPrint(tpl(), { cleanupTimeoutMs: 50 })
    // Right after kickoff, an iframe should be in body.
    expect(document.querySelectorAll('iframe').length).toBeGreaterThan(bodyBefore)
    // happy-dom does not fire afterprint, so fallback timer / no-print-fn paths
    // resolve us deterministically.
    await promise
  })

  it('writes the rendered template into the iframe document', async () => {
    let capturedDoc: Document | null = null
    const origAppend = document.body.appendChild.bind(document.body)
    const spy = vi.spyOn(document.body, 'appendChild').mockImplementation((node: Node) => {
      const out = origAppend(node)
      if (node instanceof HTMLIFrameElement && node.contentDocument) {
        // Capture the iframe doc lazily — afterprint cleanup may remove it.
        Promise.resolve().then(() => {
          capturedDoc = node.contentDocument
        })
      }
      return out
    })

    await browserPrint(tpl(), { cleanupAfter: false, cleanupTimeoutMs: 30 })
    spy.mockRestore()

    // Inspect first iframe — cleanupAfter:false leaves it in DOM.
    const iframe = document.querySelector('iframe') as HTMLIFrameElement
    expect(iframe).not.toBeNull()
    expect(iframe.contentDocument?.body?.innerHTML).toContain('hiprint-printTemplate')

    // Tidy up after the test.
    iframe.parentNode?.removeChild(iframe)
    void capturedDoc
  })

  it('cleanupAfter=true removes iframe after resolution', async () => {
    const before = document.querySelectorAll('iframe').length
    await browserPrint(tpl(), { cleanupAfter: true, cleanupTimeoutMs: 20 })
    expect(document.querySelectorAll('iframe').length).toBe(before)
  })

  it('cleanupAfter=false leaves iframe in DOM', async () => {
    await browserPrint(tpl(), { cleanupAfter: false, cleanupTimeoutMs: 20 })
    const stale = document.querySelectorAll('iframe')
    expect(stale.length).toBeGreaterThanOrEqual(1)
    // Tidy up to avoid affecting later tests.
    stale.forEach((i) => i.parentNode?.removeChild(i))
  })

  it('injects styleText into iframe head when provided', async () => {
    await browserPrint(tpl(), {
      cleanupAfter: false,
      styleText: '.foo{color:red}',
      cleanupTimeoutMs: 20,
    })
    const iframe = document.querySelector('iframe') as HTMLIFrameElement
    expect(iframe).not.toBeNull()
    const styles = iframe.contentDocument?.head.querySelectorAll('style')
    const hit = Array.from(styles ?? []).some((s) => (s.textContent ?? '').includes('.foo{color:red}'))
    expect(hit).toBe(true)
    iframe.parentNode?.removeChild(iframe)
  })

  it('rejects when document.body is unavailable (defensive)', async () => {
    // Simulate a no-op env by removing the body temporarily.
    const origBody = document.body
    Object.defineProperty(document, 'body', {
      configurable: true,
      get() {
        return null
      },
    })
    try {
      await expect(browserPrint(tpl())).rejects.toThrow()
    } finally {
      Object.defineProperty(document, 'body', {
        configurable: true,
        get() {
          return origBody
        },
      })
    }
  })
})
