/**
 * pdf.ts — jspdf 2.5+ direct wrapper (jQuery-free, no dom-to-image-more).
 *
 * V1 source: bundle.js line 12776-12834 (toPdf — used dom-to-image as a
 *            jQuery bridge).
 * V2 reference: src/hiprint-v2/template/pdf.js (V1 strategy: rasterize via
 *               dom-to-image then addImage). V3 replaces this with the direct
 *               `jsPDF.html()` API (jspdf 2.5+ ships html2canvas inline).
 *
 * Trade-offs / V2 behaviors deliberately omitted:
 *  - dom-to-image-more is NOT used. jspdf 2.5+ html() handles `<canvas>` /
 *    `<svg>` / `<img>` natively via html2canvas. Saves a 50kb dep.
 *  - svg2canvas pre-conversion step is dropped (jspdf handles SVG directly).
 *  - hi-print-mode `temp container` body-prepend trick is dropped (we hand
 *    jsPDF a detached HTMLElement; html2canvas measures via its own offscreen
 *    pipeline).
 *  - Per-page panel snapshot via addImage(i*h) is dropped — each panel is now
 *    a real PDF page via `doc.addPage()` + `doc.html()` chained calls.
 *  - Chinese / non-Latin fonts require the consumer to call `doc.addFileToVFS`
 *    + `doc.addFont` prior to render (jspdf doesn't bundle CJK fonts). Noted
 *    in business-consumer docs.
 *
 * Locked invariants (ADR-0011):
 *  - #1/#2: all DOM produced via renderTemplate (already XSS-safe)
 *  - #8: per-panel errors caught + console.warn; remaining panels still render
 */

import { jsPDF } from 'jspdf'
import { renderPanel } from './render'
import { mm, safeNumber } from '@hiprint-v3/internal'
import type { TemplateJson, PanelJson } from '@hiprint-v3/schemas'

// ============ Public types ============

export interface PdfMargins {
  top?: number
  right?: number
  bottom?: number
  left?: number
}

export interface PdfOptions {
  /** Output filename for downloadPdf(). Defaults to 'template.pdf'. */
  filename?: string
  /**
   * Paper format. Either a jspdf-recognized string ('a4'/'a5'/'letter'/...) or
   * an explicit `{ width, height }` in mm. Defaults to first panel's geometry.
   */
  paper?: string | { width: number; height: number }
  /**
   * Page orientation. 'p' portrait | 'l' landscape. Defaults to derived from
   * paper geometry (height >= width → portrait).
   */
  orientation?: 'p' | 'l'
  /** Page margins in mm. */
  margins?: PdfMargins
  /** Data for binding (forwarded to renderPanel). */
  data?: Record<string, unknown>
}

// ============ Defaults ============

const DEFAULT_FILENAME = 'template.pdf'

// ============ Internal helpers ============

/** Derive paper format + orientation for a panel. */
function derivePageConfig(
  panel: PanelJson | undefined,
  options: PdfOptions
): {
  format: string | [number, number]
  orientation: 'p' | 'l'
} {
  let widthMm = 210
  let heightMm = 297
  if (panel) {
    widthMm = safeNumber(panel.width, { min: 1, fallback: 210 })
    heightMm = safeNumber(panel.height, { min: 1, fallback: 297 })
  }

  let format: string | [number, number]
  if (typeof options.paper === 'string') {
    format = options.paper.toLowerCase()
  } else if (
    options.paper &&
    typeof options.paper === 'object' &&
    typeof options.paper.width === 'number' &&
    typeof options.paper.height === 'number'
  ) {
    format = [options.paper.width, options.paper.height]
  } else if (typeof panel?.paperType === 'string' && panel.paperType.length > 0) {
    format = panel.paperType.toLowerCase()
  } else {
    format = [widthMm, heightMm]
  }

  let orientation: 'p' | 'l'
  if (options.orientation === 'p' || options.orientation === 'l') {
    orientation = options.orientation
  } else if (panel?.orient === 'landscape') {
    orientation = 'l'
  } else if (panel?.orient === 'portrait') {
    orientation = 'p'
  } else {
    orientation = heightMm >= widthMm ? 'p' : 'l'
  }

  return { format, orientation }
}

/**
 * Render all panels of a template into a jsPDF instance. Each panel becomes a
 * fresh PDF page. The rendered HTMLElement is appended to body offscreen
 * during html() invocation (html2canvas requires a measurable layout) and
 * cleaned up immediately after.
 */
async function renderTemplateIntoPdf(
  template: TemplateJson,
  options: PdfOptions
): Promise<jsPDF> {
  const panels = Array.isArray(template.panels) ? template.panels : []
  if (panels.length === 0) {
    throw new Error('toPdf: no panels')
  }

  const firstPanel = panels[0]
  const firstConfig = derivePageConfig(firstPanel, options)
  const doc = new jsPDF({
    orientation: firstConfig.orientation,
    unit: 'mm',
    format: firstConfig.format,
  })

  const margins: PdfMargins = options.margins ?? {}
  const top = safeNumber(margins.top, { min: 0, fallback: 0 })
  const left = safeNumber(margins.left, { min: 0, fallback: 0 })

  for (let i = 0; i < panels.length; i++) {
    const panel = panels[i]!
    try {
      if (i > 0) {
        const cfg = derivePageConfig(panel, options)
        doc.addPage(cfg.format as string | [number, number], cfg.orientation)
      }
      const panelEl = renderPanel(panel, { data: options.data })
      // Stage offscreen — html2canvas needs DOM in document tree for measure.
      // Use far off-viewport position to avoid flicker on UA repaints.
      panelEl.style.position = 'fixed'
      panelEl.style.left = '-99999px'
      panelEl.style.top = '0'
      document.body.appendChild(panelEl)
      try {
        await new Promise<void>((resolve, reject) => {
          try {
            // jspdf 2.5+ html() — promise-friendly via callback
            ;(doc as unknown as {
              html: (el: HTMLElement, opts: Record<string, unknown>) => unknown
            }).html(panelEl, {
              x: left,
              y: top,
              callback: () => resolve(),
            })
          } catch (err) {
            reject(err as Error)
          }
        })
      } finally {
        if (panelEl.parentNode) panelEl.parentNode.removeChild(panelEl)
      }
    } catch (err) {
      // Invariant #8 — log + continue; partial PDF still valid.
      console.warn('[hiprint] toPdf: panel ' + i + ' failed:', err)
    }
  }
  return doc
}

// ============ Public API ============

/**
 * Build the jsPDF document. Caller may invoke `.save()`, `.output('blob')`,
 * etc. — full jsPDF surface area exposed.
 */
export async function generatePdf(
  template: TemplateJson,
  options: PdfOptions = {}
): Promise<jsPDF> {
  return renderTemplateIntoPdf(template, options)
}

/** Generate a `Blob` of the PDF (for download / upload). */
export async function toPdfBlob(
  template: TemplateJson,
  options: PdfOptions = {}
): Promise<Blob> {
  const doc = await renderTemplateIntoPdf(template, options)
  const out = doc.output('blob') as unknown
  if (out instanceof Blob) return out
  // happy-dom may return a stub — wrap to a real Blob for consistent caller API
  return new Blob([String(out)], { type: 'application/pdf' })
}

/** Trigger a browser download of the rendered PDF. */
export async function downloadPdf(
  template: TemplateJson,
  options: PdfOptions = {}
): Promise<void> {
  const blob = await toPdfBlob(template, options)
  const filename = options.filename ?? DEFAULT_FILENAME
  const finalName = filename.toLowerCase().endsWith('.pdf') ? filename : filename + '.pdf'

  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new Error('downloadPdf: URL.createObjectURL unavailable in this environment')
  }
  const url = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.setAttribute('href', url)
    anchor.setAttribute('download', finalName)
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    anchor.click()
    if (anchor.parentNode) anchor.parentNode.removeChild(anchor)
  } finally {
    if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url)
  }
}

// ============ Re-exports (helpers for advanced consumers) ============

export { mm }
