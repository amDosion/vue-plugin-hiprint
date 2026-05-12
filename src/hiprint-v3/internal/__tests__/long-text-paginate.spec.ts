/**
 * long-text-paginate.spec.ts — Binary-search pagination tests for V1 longText
 * parity (TKT-026).
 *
 * Coverage:
 *  - empty string  → 1 page with text=''
 *  - short text fits on page 1 → single page
 *  - long text splits across 2-3 pages with convergent binary search
 *  - 5-page convergence test (ticket acceptance criterion)
 *  - measure() throw → loop survives (defensive)
 *  - measure() never fits → forward progress 1 char per page
 *  - binary search invocation count is O(log n) per page
 *  - createDomMeasure happy-dom probe — offsetHeight comparison works
 */
import { describe, it, expect, vi } from 'vitest'
import { paginateLongText, createDomMeasure } from '../long-text-paginate'

describe('paginateLongText — edge cases', () => {
  it('empty fullText → single page with empty text', () => {
    const result = paginateLongText({
      fullText: '',
      maxHeightPt: 100,
      perPageHeightPt: 100,
      fontSizePt: 10.5,
      lineHeightPt: 16,
      fontFamily: 'sans-serif',
      width: 200,
      measure: () => true,
    })
    expect(result.pages.length).toBe(1)
    expect(result.pages[0]!.text).toBe('')
    expect(result.pages[0]!.height).toBe(0)
  })

  it('null-ish fullText (treated as empty) → single empty page', () => {
    const result = paginateLongText({
      fullText: null as unknown as string,
      maxHeightPt: 100,
      perPageHeightPt: 100,
      fontSizePt: 10.5,
      lineHeightPt: 16,
      fontFamily: 'sans-serif',
      width: 200,
      measure: () => true,
    })
    expect(result.pages.length).toBe(1)
    expect(result.pages[0]!.text).toBe('')
  })

  it('measure missing → single-page passthrough (no infinite loop)', () => {
    const result = paginateLongText({
      fullText: 'hello',
      maxHeightPt: 100,
      perPageHeightPt: 100,
      fontSizePt: 10.5,
      lineHeightPt: 16,
      fontFamily: 'sans-serif',
      width: 200,
      // @ts-expect-error — deliberately invalid for defensive test
      measure: null,
    })
    expect(result.pages.length).toBe(1)
    expect(result.pages[0]!.text).toBe('hello')
  })
})

describe('paginateLongText — single-page fit', () => {
  it('short text fits in one page (no binary search needed beyond probe)', () => {
    let calls = 0
    const measure = (text: string, _h: number): boolean => {
      calls++
      return text.length <= 100
    }
    const result = paginateLongText({
      fullText: 'short',
      maxHeightPt: 50,
      perPageHeightPt: 50,
      fontSizePt: 10.5,
      lineHeightPt: 16,
      fontFamily: 'sans-serif',
      width: 200,
      measure,
    })
    expect(result.pages.length).toBe(1)
    expect(result.pages[0]!.text).toBe('short')
    expect(calls).toBeGreaterThan(0)
  })
})

describe('paginateLongText — multi-page', () => {
  it('long text splits across 2 pages when budget = 5 chars each', () => {
    const measure = (text: string, _h: number): boolean => text.length <= 5
    // 10 chars, 5 per page → 2 pages
    const result = paginateLongText({
      fullText: 'abcdefghij',
      maxHeightPt: 50,
      perPageHeightPt: 50,
      fontSizePt: 10.5,
      lineHeightPt: 16,
      fontFamily: 'sans-serif',
      width: 200,
      measure,
    })
    expect(result.pages.length).toBe(2)
    expect(result.pages[0]!.text).toBe('abcde')
    expect(result.pages[1]!.text).toBe('fghij')
    // Reassemble => identity preservation.
    expect(result.pages.map((p) => p.text).join('')).toBe('abcdefghij')
  })

  it('splits across 3 pages with non-uniform first-page budget', () => {
    // First page budget tighter than per-page: emulate "first page already
    // had a header consuming some space, subsequent pages have more room".
    const measure = (text: string, h: number): boolean => {
      // We use h as the per-call signal since paginateLongText passes
      // maxHeightPt on iter 1 and perPageHeightPt thereafter.
      const budget = h <= 30 ? 3 : 6
      return text.length <= budget
    }
    const result = paginateLongText({
      fullText: 'abcdefghijklmno', // 15 chars
      maxHeightPt: 30, // first-page budget → 3 chars
      perPageHeightPt: 60, // subsequent → 6 chars
      fontSizePt: 10.5,
      lineHeightPt: 16,
      fontFamily: 'sans-serif',
      width: 200,
      measure,
    })
    // 15 = 3 + 6 + 6 → 3 pages.
    expect(result.pages.length).toBe(3)
    expect(result.pages[0]!.text).toBe('abc')
    expect(result.pages[1]!.text).toBe('defghi')
    expect(result.pages[2]!.text).toBe('jklmno')
    expect(result.pages.map((p) => p.text).join('')).toBe(
      'abcdefghijklmno'
    )
  })

  it('5-page convergence — 25 chars, 5 per page (ticket acceptance)', () => {
    const measure = (text: string, _h: number): boolean => text.length <= 5
    const result = paginateLongText({
      fullText: 'abcdefghijklmnopqrstuvwxy', // 25 chars
      maxHeightPt: 50,
      perPageHeightPt: 50,
      fontSizePt: 10.5,
      lineHeightPt: 16,
      fontFamily: 'sans-serif',
      width: 200,
      measure,
    })
    expect(result.pages.length).toBe(5)
    expect(result.pages[0]!.text).toBe('abcde')
    expect(result.pages[1]!.text).toBe('fghij')
    expect(result.pages[2]!.text).toBe('klmno')
    expect(result.pages[3]!.text).toBe('pqrst')
    expect(result.pages[4]!.text).toBe('uvwxy')
    expect(result.pages.map((p) => p.text).join('')).toBe(
      'abcdefghijklmnopqrstuvwxy'
    )
  })
})

describe('paginateLongText — binary search complexity', () => {
  it('uses O(log n) probes per page (not linear scan)', () => {
    let calls = 0
    const charsPerPage = 50
    const measure = (text: string, _h: number): boolean => {
      calls++
      return text.length <= charsPerPage
    }
    // 1000-char input → 20 pages × ~log2(1000) ≈ 10 probes/page = ~200 total.
    const fullText = 'x'.repeat(1000)
    const result = paginateLongText({
      fullText,
      maxHeightPt: 50,
      perPageHeightPt: 50,
      fontSizePt: 10.5,
      lineHeightPt: 16,
      fontFamily: 'sans-serif',
      width: 200,
      measure,
    })
    expect(result.pages.length).toBe(20)
    // Linear scan would be 1000+ calls; assert binary is well below.
    expect(calls).toBeLessThan(500)
  })
})

describe('paginateLongText — defensive', () => {
  it('measure() throws → loop survives (treats as does-not-fit)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    let probes = 0
    const measure = (text: string, _h: number): boolean => {
      probes++
      if (probes > 50) throw new Error('boom') // throw after some probes
      return text.length <= 3
    }
    const result = paginateLongText({
      fullText: 'abcdefghij', // 10 chars, 3 per page → 4 pages
      maxHeightPt: 30,
      perPageHeightPt: 30,
      fontSizePt: 10.5,
      lineHeightPt: 16,
      fontFamily: 'sans-serif',
      width: 200,
      measure,
    })
    // Result is bounded — never infinite. Sum may be partial if throws hit.
    expect(result.pages.length).toBeGreaterThan(0)
    expect(result.pages.map((p) => p.text).join('').length).toBeLessThanOrEqual(
      10
    )
  })

  it('measure() always-false → forward progress 1 char per page', () => {
    const measure = (_text: string, _h: number): boolean => false
    const result = paginateLongText({
      fullText: 'abcde',
      maxHeightPt: 50,
      perPageHeightPt: 50,
      fontSizePt: 10.5,
      lineHeightPt: 16,
      fontFamily: 'sans-serif',
      width: 200,
      measure,
    })
    // Each page emits exactly 1 char (forced forward progress).
    expect(result.pages.length).toBe(5)
    expect(result.pages.map((p) => p.text).join('')).toBe('abcde')
  })
})

describe('createDomMeasure — DOM-backed probe', () => {
  it('returns a callable measure function', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const measure = createDomMeasure(host, 10.5, 16, 'sans-serif', 200)
    expect(typeof measure).toBe('function')
    document.body.removeChild(host)
  })

  it('writes textContent (not innerHTML) — XSS Invariant #1', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const measure = createDomMeasure(host, 10.5, 16, 'sans-serif', 200)
    // Call with HTML-like input — the probe must not parse as elements.
    measure('<script>alert(1)</script>', 1000)
    // Probe div is the only child of host.
    const probe = host.firstChild as HTMLElement
    expect(probe.querySelectorAll('script').length).toBe(0)
    expect(probe.textContent).toContain('<script>')
    document.body.removeChild(host)
  })

  it('respects width/font config on the probe div', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    createDomMeasure(host, 12, 18, 'Arial', 150, 0.5)
    const probe = host.firstChild as HTMLElement
    expect(probe.style.width).toBe('150pt')
    expect(probe.style.fontSize).toBe('12pt')
    expect(probe.style.lineHeight).toBe('18pt')
    expect(probe.style.fontFamily).toBe('Arial')
    expect(probe.style.letterSpacing).toBe('0.5pt')
    document.body.removeChild(host)
  })

  it('integrates with paginateLongText end-to-end (happy-dom path)', () => {
    // happy-dom's offsetHeight is 0 by default, so every text "fits" → 1 page.
    // We do not depend on real measurement — this asserts plumbing only.
    const host = document.createElement('div')
    document.body.appendChild(host)
    const measure = createDomMeasure(host, 10.5, 16, 'sans-serif', 200)
    const result = paginateLongText({
      fullText: 'integration test text',
      maxHeightPt: 100,
      perPageHeightPt: 100,
      fontSizePt: 10.5,
      lineHeightPt: 16,
      fontFamily: 'sans-serif',
      width: 200,
      measure,
    })
    expect(result.pages.length).toBe(1)
    expect(result.pages[0]!.text).toBe('integration test text')
    document.body.removeChild(host)
  })
})
