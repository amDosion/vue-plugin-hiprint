/**
 * browser-print.ts — window.print() pipeline via hidden iframe (jQuery-free).
 *
 * V1 source: bundle.js line 12651-12763 (PrintTemplate.print +
 *            jQuery.fn.hiwprint plugin).
 * V2 reference: src/hiprint-v2/template/print.js (used $.fn.hiwprint).
 *
 * V3 strategy:
 *  - Render template to detached HTMLElement via renderTemplate.
 *  - Inject a hidden <iframe> into document.body.
 *  - Write a complete document into iframe (head + style links + body).
 *  - Call iframe.contentWindow.print() — browser opens native print dialog.
 *  - Listen for 'afterprint' (or fall back to a timeout) to clean iframe up.
 *
 * Invariants (ADR-0011):
 *  - #1/#2: rendered DOM is XSS-safe (renderTemplate uses textContent default)
 *  - #8: errors in cleanup logged + swallowed; primary print still proceeds
 */

import { renderTemplate } from './render'
import type { TemplateJson } from '@hiprint-v3/schemas'

// ============ Public types ============

export interface BrowserPrintOptions {
  /** Data for binding. */
  data?: Record<string, unknown> | undefined
  /**
   * Stylesheet href injected into iframe `<head>`. Typically a hosted
   * print-lock.css. Defaults to none — caller-owned.
   */
  stylesheetHref?: string | undefined
  /**
   * Inline CSS text injected into iframe `<head>`. Useful when business has
   * already collected print-lock.css via XHR (parity with V1 print2 flow).
   */
  styleText?: string | undefined
  /**
   * Cleanup iframe after print dialog dismissed. Default true.
   * Set false for debugging / inspection.
   */
  cleanupAfter?: boolean
  /**
   * Cleanup fallback timeout in ms when 'afterprint' is not fired
   * (some Safari / older Edge). Default 60_000.
   */
  cleanupTimeoutMs?: number
}

// ============ Public API ============

/**
 * Return the rendered template HTML as a string. Useful for socket print2
 * payload assembly (where the socket transport prepends CSS fragments).
 *
 * Note: this is the body inner HTML only (no <html>/<head>/<body>) — call
 * sites that need a full document typically wrap with their own template.
 */
export function getPrintHtml(
  template: TemplateJson,
  options: BrowserPrintOptions = {}
): string {
  const root = renderTemplate(template, {
    data: options.data,
    stylesheetHref: options.stylesheetHref,
  })
  return root.outerHTML
}

/**
 * Trigger browser print dialog. Resolves once 'afterprint' fires (or the
 * fallback timeout elapses).
 *
 * @throws Error if document / iframe injection unavailable.
 */
export function browserPrint(
  template: TemplateJson,
  options: BrowserPrintOptions = {}
): Promise<void> {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return Promise.reject(new Error('browserPrint: document unavailable (SSR / Node)'))
  }
  const cleanupAfter = options.cleanupAfter !== false
  const cleanupTimeoutMs = typeof options.cleanupTimeoutMs === 'number' ? options.cleanupTimeoutMs : 60_000

  return new Promise<void>((resolve, reject) => {
    let iframe: HTMLIFrameElement | null = null
    let cleanedUp = false
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null

    function cleanup(): void {
      if (cleanedUp) return
      cleanedUp = true
      if (fallbackTimer) {
        clearTimeout(fallbackTimer)
        fallbackTimer = null
      }
      if (cleanupAfter && iframe && iframe.parentNode) {
        try {
          iframe.parentNode.removeChild(iframe)
        } catch (err) {
          // Invariant #8
          console.warn('[hiprint] browserPrint cleanup failed:', err)
        }
      }
    }

    try {
      const rendered = renderTemplate(template, { data: options.data })

      iframe = document.createElement('iframe')
      iframe.setAttribute('aria-hidden', 'true')
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = '0'
      iframe.style.visibility = 'hidden'
      document.body.appendChild(iframe)

      const idoc = iframe.contentDocument || iframe.contentWindow?.document
      if (!idoc) {
        cleanup()
        reject(new Error('browserPrint: iframe document unavailable'))
        return
      }

      idoc.open()
      idoc.write('<!doctype html><html><head><meta charset="utf-8"><title>print</title>')
      if (options.stylesheetHref) {
        // [Invariant #1] href set via setAttribute — escaped by browser.
        // We emit a literal string here because we're writing into a new doc;
        // surround with quotes to be safe but use no untrusted interpolation.
        idoc.write(
          '<link rel="stylesheet" href="' + escapeAttr(options.stylesheetHref) + '">'
        )
      }
      idoc.write('</head><body></body></html>')
      idoc.close()

      // Inject inline CSS into the new doc head.
      if (options.styleText) {
        const styleEl = idoc.createElement('style')
        styleEl.appendChild(idoc.createTextNode(String(options.styleText)))
        idoc.head.appendChild(styleEl)
      }

      // Inject rendered template body — move (don't innerHTML) to preserve
      // the XSS-safe tree we already built.
      const imported = idoc.importNode(rendered, true)
      idoc.body.appendChild(imported)

      const cwin = iframe.contentWindow
      if (!cwin) {
        cleanup()
        reject(new Error('browserPrint: iframe contentWindow unavailable'))
        return
      }

      // afterprint may fire on either the iframe window or the parent window
      // (browser-specific). Bind both for safety.
      let resolved = false
      function onAfterPrint(): void {
        if (resolved) return
        resolved = true
        cwin?.removeEventListener('afterprint', onAfterPrint)
        if (typeof window !== 'undefined') window.removeEventListener('afterprint', onAfterPrint)
        cleanup()
        resolve()
      }
      cwin.addEventListener('afterprint', onAfterPrint)
      if (typeof window !== 'undefined') {
        window.addEventListener('afterprint', onAfterPrint)
      }

      // Fallback: cleanup + resolve even if afterprint never fires.
      fallbackTimer = setTimeout(onAfterPrint, cleanupTimeoutMs)

      // Trigger print dialog. happy-dom defines no print() on contentWindow —
      // call it defensively.
      if (typeof cwin.print === 'function') {
        try {
          cwin.focus()
          cwin.print()
        } catch (err) {
          console.warn('[hiprint] browserPrint: window.print() threw:', err)
          // Don't fail the promise here — afterprint timer will resolve.
        }
      } else {
        // Test / non-print env — fire onAfterPrint synchronously on next tick.
        setTimeout(onAfterPrint, 0)
      }
    } catch (err) {
      cleanup()
      reject(err as Error)
    }
  })
}

// ============ Helpers ============

/**
 * Escape value for safe insertion into an HTML attribute literal in a
 * `document.write` context.
 *
 * Note: distinct from the textContent path. Limited to ascii safe set —
 * complex escaping would require full HTML serializer; here we only need to
 * keep an href intact in an attribute literal.
 */
function escapeAttr(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
