/**
 * useHiprintPrint.spec.ts — isPrinting / lastError flow + composable surface.
 *
 * Mocks @hiprint-v3/print imports so we exercise the composable's try/finally
 * + error capture without touching real browser APIs (which happy-dom only
 * partially supports). Mocks @hiprint-v3/stores socket emit for print2.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// ---- Print module mock -----------------------------------------------------
vi.mock('@hiprint-v3/print', () => ({
  browserPrint: vi.fn(async () => undefined),
  downloadPdf: vi.fn(async () => undefined),
  toPdfBlob: vi.fn(async () => new Blob(['pdf'], { type: 'application/pdf' })),
  getPrintHtml: vi.fn(() => '<div>html</div>'),
}))

import { useHiprintPrint } from '../useHiprintPrint'
import { useHiprintTemplate } from '../useHiprintTemplate'
import {
  browserPrint,
  downloadPdf,
  toPdfBlob,
  getPrintHtml,
} from '@hiprint-v3/print'
import { useSocketStore } from '../../stores'

const SAMPLE_JSON = {
  panels: [{ index: 0, name: '1', width: 210, height: 297 }],
}

describe('useHiprintPrint', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('throws when no template loaded', async () => {
    const p = useHiprintPrint()
    await expect(p.print()).rejects.toThrow(/no template loaded/)
    expect(p.lastError.value).toMatch(/no template loaded/)
  })

  it('print() sets isPrinting true during call, false after', async () => {
    const t = useHiprintTemplate()
    await t.loadFromJson(SAMPLE_JSON)
    const p = useHiprintPrint()
    // Drive the mocked browserPrint to capture isPrinting at mid-flight.
    let captured: boolean | null = null
    ;(browserPrint as unknown as { mockImplementationOnce: Function }).mockImplementationOnce(
      async () => {
        captured = p.isPrinting.value
      }
    )
    await p.print({ foo: 'bar' })
    expect(captured).toBe(true)
    expect(p.isPrinting.value).toBe(false)
    expect(p.lastError.value).toBeNull()
  })

  it('print() captures error message in lastError on throw', async () => {
    const t = useHiprintTemplate()
    await t.loadFromJson(SAMPLE_JSON)
    const p = useHiprintPrint()
    ;(browserPrint as unknown as { mockImplementationOnce: Function }).mockImplementationOnce(
      async () => {
        throw new Error('boom')
      }
    )
    await expect(p.print()).rejects.toThrow(/boom/)
    expect(p.lastError.value).toBe('boom')
    expect(p.isPrinting.value).toBe(false)
  })

  it('print2 rejects when socket not connected', async () => {
    const t = useHiprintTemplate()
    await t.loadFromJson(SAMPLE_JSON)
    const p = useHiprintPrint()
    await expect(p.print2()).rejects.toThrow(/socket not connected/)
  })

  it('print2 sends payload via socket.emit when connected', async () => {
    const t = useHiprintTemplate()
    await t.loadFromJson(SAMPLE_JSON)
    const s = useSocketStore()
    // Simulate a connected socket by stubbing send + connected.
    const sendSpy = vi.spyOn(s, 'send').mockImplementation(() => {})
    ;(s.connected as unknown as boolean) = true // direct mutation acceptable in test
    Object.defineProperty(s, 'connected', { value: true, configurable: true })

    const p = useHiprintPrint()
    await p.print2({ foo: 1 }, { printer: 'P1' })
    expect(getPrintHtml).toHaveBeenCalled()
    expect(sendSpy).toHaveBeenCalledTimes(1)
    const payload = sendSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(payload['html']).toBe('<div>html</div>')
    expect(payload['type']).toBe('send')
    expect(payload['printer']).toBe('P1')
  })

  it('downloadPdf + toPdfBlob delegate to print module', async () => {
    const t = useHiprintTemplate()
    await t.loadFromJson(SAMPLE_JSON)
    const p = useHiprintPrint()
    await p.downloadPdf('out.pdf', { a: 1 })
    expect(downloadPdf).toHaveBeenCalled()
    const blob = await p.toPdfBlob({ a: 2 })
    expect(toPdfBlob).toHaveBeenCalled()
    expect(blob).toBeInstanceOf(Blob)
  })

  it('rejects concurrent prints (single-flight guard)', async () => {
    const t = useHiprintTemplate()
    await t.loadFromJson(SAMPLE_JSON)
    const p = useHiprintPrint()
    let release!: () => void
    ;(browserPrint as unknown as { mockImplementationOnce: Function }).mockImplementationOnce(
      () => new Promise<void>((resolve) => (release = resolve))
    )
    const first = p.print()
    // Second call while first pending — should reject immediately.
    await expect(p.print()).rejects.toThrow(/in progress/)
    release()
    await first
  })
})
