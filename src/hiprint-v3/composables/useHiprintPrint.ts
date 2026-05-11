/**
 * useHiprintPrint.ts — V3 reactive print composable.
 *
 * Wraps `@hiprint-v3/print` (`browserPrint`, `downloadPdf`, `toPdfBlob`,
 * `getPrintHtml`) into a single surface aligned with vue-admin-main's
 * existing `usePrintService` strategy pattern:
 *
 *   print(data)       → browserPrint(currentTemplate, { data })
 *   print2(data)      → socket.send({ html, type: 'send' }) (silent / electron)
 *   downloadPdf(...)  → downloadPdf(currentTemplate, ...)
 *   toPdfBlob(data)   → toPdfBlob(currentTemplate, { data })
 *
 * Reactive flags:
 *   isPrinting        — true while any print fn is in-flight (try/finally toggle)
 *   lastError         — most recent error message (cleared on next successful call)
 *
 * V1 / V2 equivalent:
 *   PrintTemplate.print(data)   → browser print
 *   PrintTemplate.print2(data)  → silent print via window.hiwebSocket
 *
 * No jQuery. No DOM coupling beyond what `browser-print` / `pdf` already own.
 */

import { ref, type Ref } from 'vue'
import { useTemplateStore, useSocketStore } from '@hiprint-v3/stores'
import {
  browserPrint,
  downloadPdf as downloadPdfImpl,
  toPdfBlob as toPdfBlobImpl,
  getPrintHtml,
} from '@hiprint-v3/print'

// ============ Public types ============

export interface UseHiprintPrintReturn {
  /** True while any of {print, print2, downloadPdf, toPdfBlob} is mid-flight. */
  isPrinting: Ref<boolean>
  /** Most recent error message, or null. Reset to null at the start of each call. */
  lastError: Ref<string | null>

  /**
   * Trigger browser print (window.print dialog). Resolves after `afterprint`
   * fires (or the cleanup timeout in `browser-print`).
   */
  print(data?: Record<string, unknown>): Promise<void>
  /**
   * Silent print via socket.io to electron-hiprint local client.
   * Payload protocol matches V1 `socket.emit('news', { html, type: 'send', ... })`.
   */
  print2(
    data?: Record<string, unknown>,
    options?: { printer?: string; templateId?: string }
  ): Promise<void>
  /** Generate PDF + trigger download anchor. */
  downloadPdf(filename?: string, data?: Record<string, unknown>): Promise<void>
  /** Return rendered PDF as a `Blob` (for upload / preview). */
  toPdfBlob(data?: Record<string, unknown>): Promise<Blob>
}

// ============ Implementation ============

export function useHiprintPrint(): UseHiprintPrintReturn {
  const tpl = useTemplateStore()
  const socket = useSocketStore()

  const isPrinting = ref<boolean>(false)
  const lastError = ref<string | null>(null)

  /**
   * Async wrapper that toggles isPrinting + captures errors uniformly.
   * Centralizes the try/finally so each public fn stays simple.
   */
  async function runGuarded<T>(label: string, fn: () => Promise<T>): Promise<T> {
    if (isPrinting.value) {
      // Multiple concurrent prints would race document.body iframe injection;
      // serialize via the flag and surface a clear message to callers.
      const err = `[hiprint] ${label} ignored: another print is in progress`
      lastError.value = err
      throw new Error(err)
    }
    isPrinting.value = true
    lastError.value = null
    try {
      return await fn()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      lastError.value = msg
      throw err
    } finally {
      isPrinting.value = false
    }
  }

  /** Resolve a template JSON, throwing a clear error if no template loaded. */
  function requireTemplate() {
    if (!tpl.isLoaded) {
      throw new Error('[hiprint] no template loaded — call loadFromJson() first')
    }
    return tpl.getJson()
  }

  // -------- print (browser) --------

  async function print(data?: Record<string, unknown>): Promise<void> {
    return runGuarded('print', async () => {
      const template = requireTemplate()
      await browserPrint(template, { data })
    })
  }

  // -------- print2 (silent / electron-hiprint over socket) --------

  async function print2(
    data?: Record<string, unknown>,
    options?: { printer?: string; templateId?: string }
  ): Promise<void> {
    return runGuarded('print2', async () => {
      const template = requireTemplate()
      if (!socket.connected) {
        throw new Error(
          '[hiprint] print2: socket not connected — call useHiprintSocket().connect() first'
        )
      }
      // Build full-document HTML payload for the local client to print.
      // `getPrintHtml` mirrors V1 print2's `getHtml(data)` step (XSS-safe).
      const html = getPrintHtml(template, { data })
      const payload: Record<string, unknown> = {
        html,
        type: 'send',
        templateId: options?.templateId ?? tpl.templateId ?? 'hiprint-template',
      }
      if (options?.printer) payload['printer'] = options.printer
      // Use the simple emit path; fragment splitting lives in the V3
      // hiwebSocket wrapper for very long HTML (P21 cleanup will unify).
      socket.send(payload)
    })
  }

  // -------- PDF (download + blob) --------

  async function downloadPdf(
    filename?: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    return runGuarded('downloadPdf', async () => {
      const template = requireTemplate()
      await downloadPdfImpl(template, { filename, data })
    })
  }

  async function toPdfBlob(data?: Record<string, unknown>): Promise<Blob> {
    return runGuarded('toPdfBlob', async () => {
      const template = requireTemplate()
      return await toPdfBlobImpl(template, { data })
    })
  }

  return {
    isPrinting,
    lastError,
    print,
    print2,
    downloadPdf,
    toPdfBlob,
  }
}
