/**
 * pdf.spec.ts — V3 PDF generation tests (jsPDF mocked).
 *
 * Coverage:
 *  - generatePdf returns a jsPDF instance (mocked surface)
 *  - toPdfBlob returns a Blob
 *  - downloadPdf creates an anchor + clicks it with a .pdf filename
 *  - Per-panel pagination: 1 panel = 1 page, 3 panels = 2 addPage calls
 *  - Empty panels → rejects with 'no panels'
 *  - Custom paper / orientation passed to jsPDF constructor
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// jsPDF is mocked at the module boundary so we can inspect calls without
// happy-dom needing real PDF generation (which html2canvas can't do offscreen).
// vi.mock is hoisted to the top of the file by Vitest, so we must declare the
// spy holders INSIDE the factory and re-expose them via the imported module.
vi.mock('jspdf', () => {
  const htmlMock = vi.fn((_el: HTMLElement, opts: Record<string, unknown>) => {
    if (typeof opts['callback'] === 'function') {
      ;(opts['callback'] as () => void)()
    }
    return undefined
  })
  const addPageMock = vi.fn()
  const saveMock = vi.fn()
  const outputMock = vi.fn((type: string) => {
    if (type === 'blob') return new Blob(['fake-pdf'], { type: 'application/pdf' })
    return 'fake-output'
  })
  // Real constructor (callable with `new`) — vi.fn alone is callable with `new`
  // but its return-shape via mockImplementation((...args) => obj) only works
  // when the function is called as a function. For `new`, define a class.
  class JsPdfMock {
    constructor(opts: Record<string, unknown>) {
      jspdfCtorMock(opts)
    }
    html(el: HTMLElement, opts: Record<string, unknown>) {
      return htmlMock(el, opts)
    }
    addPage(format?: unknown, orientation?: unknown) {
      return addPageMock(format, orientation)
    }
    save(name: string) {
      return saveMock(name)
    }
    output(type: string) {
      return outputMock(type)
    }
  }
  const jspdfCtorMock = vi.fn()
  return {
    jsPDF: JsPdfMock,
    __mocks: { htmlMock, addPageMock, saveMock, outputMock, jspdfCtorMock },
  }
})

import { generatePdf, toPdfBlob, downloadPdf } from '../pdf'
import type { TemplateJson } from '@hiprint-v3/schemas'

// Reach into the mock module record to access the inner mocks (declared above).
const mockedModule = (await import('jspdf')) as unknown as {
  __mocks: {
    htmlMock: ReturnType<typeof vi.fn>
    addPageMock: ReturnType<typeof vi.fn>
    saveMock: ReturnType<typeof vi.fn>
    outputMock: ReturnType<typeof vi.fn>
    jspdfCtorMock: ReturnType<typeof vi.fn>
  }
}
const { htmlMock, addPageMock, outputMock, jspdfCtorMock } = mockedModule.__mocks

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

function tpl(panelsCount = 1): TemplateJson {
  return {
    panels: Array.from({ length: panelsCount }, () => ({
      width: 210,
      height: 297,
      printElements: [
        {
          options: { left: 0, top: 0, width: 100, height: 30, title: 'X' },
          printElementType: { type: 'text' },
        },
      ],
    })),
  } as TemplateJson
}

describe('generatePdf', () => {
  it('instantiates jsPDF with derived orientation + format', async () => {
    await generatePdf(tpl(1))
    expect(jspdfCtorMock).toHaveBeenCalledTimes(1)
    const ctorArg = jspdfCtorMock.mock.calls[0]![0] as Record<string, unknown>
    expect(ctorArg['orientation']).toBe('p')
    expect(ctorArg['unit']).toBe('mm')
  })

  it('renders 1 panel → 1 page (no addPage)', async () => {
    await generatePdf(tpl(1))
    expect(htmlMock).toHaveBeenCalledTimes(1)
    expect(addPageMock).toHaveBeenCalledTimes(0)
  })

  it('renders 3 panels → 3 pages (2 addPage calls)', async () => {
    await generatePdf(tpl(3))
    expect(htmlMock).toHaveBeenCalledTimes(3)
    expect(addPageMock).toHaveBeenCalledTimes(2)
  })

  it('rejects with "no panels" when template panels empty', async () => {
    await expect(generatePdf({ panels: [] } as TemplateJson)).rejects.toThrow(/no panels/)
  })

  it('respects options.paper string (a5)', async () => {
    await generatePdf(tpl(1), { paper: 'A5' })
    const ctorArg = jspdfCtorMock.mock.calls[0]![0] as Record<string, unknown>
    expect(ctorArg['format']).toBe('a5')
  })

  it('respects custom {width,height} paper', async () => {
    await generatePdf(tpl(1), { paper: { width: 100, height: 80 } })
    const ctorArg = jspdfCtorMock.mock.calls[0]![0] as Record<string, unknown>
    expect(ctorArg['format']).toEqual([100, 80])
  })

  it('explicit orientation overrides derived', async () => {
    await generatePdf(tpl(1), { orientation: 'l' })
    const ctorArg = jspdfCtorMock.mock.calls[0]![0] as Record<string, unknown>
    expect(ctorArg['orientation']).toBe('l')
  })

  it('applies margin offset to html() call', async () => {
    await generatePdf(tpl(1), { margins: { top: 10, left: 5 } })
    const htmlOpts = htmlMock.mock.calls[0]![1] as Record<string, unknown>
    expect(htmlOpts['x']).toBe(5)
    expect(htmlOpts['y']).toBe(10)
  })

  it('continues to next panel on per-panel failure (Invariant #8)', async () => {
    htmlMock
      .mockImplementationOnce((_el, opts) => {
        if (typeof opts['callback'] === 'function') (opts['callback'] as () => void)()
        return undefined
      })
      .mockImplementationOnce(() => {
        throw new Error('mid-render boom')
      })
      .mockImplementationOnce((_el, opts) => {
        if (typeof opts['callback'] === 'function') (opts['callback'] as () => void)()
        return undefined
      })
    await generatePdf(tpl(3))
    // All three html() calls attempted
    expect(htmlMock).toHaveBeenCalledTimes(3)
    expect(addPageMock).toHaveBeenCalledTimes(2)
  })
})

describe('toPdfBlob', () => {
  it('returns a Blob', async () => {
    const blob = await toPdfBlob(tpl(1))
    expect(blob).toBeInstanceOf(Blob)
    expect(outputMock).toHaveBeenCalledWith('blob')
  })
})

describe('downloadPdf', () => {
  it('appends an anchor with .pdf filename and clicks it', async () => {
    const clicks: string[] = []
    const origCreateEl = document.createElement.bind(document)
    const createElSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tag: string) => {
        const el = origCreateEl(tag) as HTMLElement
        if (tag === 'a') {
          // Intercept click → record download attribute
          ;(el as HTMLAnchorElement).click = () => {
            clicks.push((el as HTMLAnchorElement).getAttribute('download') ?? '')
          }
        }
        return el
      })

    // Polyfill URL.createObjectURL for happy-dom
    const origCreateObjectURL = URL.createObjectURL
    const origRevokeObjectURL = URL.revokeObjectURL
    URL.createObjectURL = vi.fn(() => 'blob:fake-url')
    URL.revokeObjectURL = vi.fn()

    try {
      await downloadPdf(tpl(1), { filename: 'report' })
      expect(clicks).toEqual(['report.pdf'])
      expect(URL.createObjectURL).toHaveBeenCalled()
      expect(URL.revokeObjectURL).toHaveBeenCalled()
    } finally {
      createElSpy.mockRestore()
      URL.createObjectURL = origCreateObjectURL
      URL.revokeObjectURL = origRevokeObjectURL
    }
  })

  it('uses default filename when omitted', async () => {
    const clicks: string[] = []
    const origCreateEl = document.createElement.bind(document)
    const createElSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tag: string) => {
        const el = origCreateEl(tag) as HTMLElement
        if (tag === 'a') {
          ;(el as HTMLAnchorElement).click = () => {
            clicks.push((el as HTMLAnchorElement).getAttribute('download') ?? '')
          }
        }
        return el
      })
    const origCreateObjectURL = URL.createObjectURL
    const origRevokeObjectURL = URL.revokeObjectURL
    URL.createObjectURL = vi.fn(() => 'blob:fake-url')
    URL.revokeObjectURL = vi.fn()
    try {
      await downloadPdf(tpl(1))
      expect(clicks).toEqual(['template.pdf'])
    } finally {
      createElSpy.mockRestore()
      URL.createObjectURL = origCreateObjectURL
      URL.revokeObjectURL = origRevokeObjectURL
    }
  })
})
