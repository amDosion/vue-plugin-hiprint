/**
 * default-sizes-v1-parity.spec.ts — Sprint 22d TKT-162 parity tests.
 *
 * Pins each V3 etype's `*_DEFAULT_OPTIONS.width/height` (and a couple of
 * V1-tracked extras like hline `borderWidth: 0.75`) to the V1 hiprint.config.js
 * `instance.<type>.default` block. Sprint 22a's defaults drifted away from
 * V1 (hline 200×1, rect 100×60, etc.); 22d realigns them so templates created
 * in V1 and V3 share the same drop-time dimensions.
 *
 * V1 source: `src/hiprint/hiprint.config.js` (vue-plugin-hiprint main worktree).
 * V1 inventory: `docs/V1-INVENTORY/etypes/shapes.md` §E.2 + `text-longtext.md` §C.
 *
 * Intentional V3 deviations (kept explicit so the diff is visible if anyone
 * reverts them):
 *   - hline / vline / rect / oval ship `borderColor:'#000000'` +
 *     `border{Top,Left,Style}:'solid'` defaults (V1 left these implicit via
 *     `print-lock.css`). V3 has no print-lock stylesheet equivalent, so these
 *     have to be in `*_DEFAULT_OPTIONS`.
 *   - vline / rect / oval ship `borderWidth:0.75` (V1 was `undefined` and let
 *     `print-lock.css` set the visible stroke). Same rationale.
 *   - image ships `fit:'contain'` (V1 default was `{}`). Sensible V3-only
 *     addition; no width/height per V1.
 *
 * Each test cites the V1 line range it pins.
 */

import { describe, it, expect } from 'vitest'
import {
  TEXT_DEFAULT_OPTIONS,
  IMAGE_DEFAULT_OPTIONS,
  LONG_TEXT_DEFAULT_OPTIONS,
  TABLE_DEFAULT_OPTIONS,
  HTML_DEFAULT_OPTIONS,
  BARCODE_DEFAULT_OPTIONS,
  QRCODE_DEFAULT_OPTIONS,
  HLINE_DEFAULT_OPTIONS,
  VLINE_DEFAULT_OPTIONS,
  RECT_DEFAULT_OPTIONS,
  OVAL_DEFAULT_OPTIONS,
} from '../index'

describe('TKT-162 — V3 etype defaults track V1 hiprint.config.js', () => {
  it('text default matches V1 line 472-476 (width:120, height:9.75)', () => {
    expect(TEXT_DEFAULT_OPTIONS.width).toBe(120)
    expect(TEXT_DEFAULT_OPTIONS.height).toBe(9.75)
  })

  it('image default matches V1 line 615 ({}) — no width/height', () => {
    // V1 image.default is empty; the V3 default keeps only `fit:'contain'`
    // (sensible explicit default — not a V1 violation since V1 had no value).
    expect(IMAGE_DEFAULT_OPTIONS.width).toBeUndefined()
    expect(IMAGE_DEFAULT_OPTIONS.height).toBeUndefined()
    expect(IMAGE_DEFAULT_OPTIONS.fit).toBe('contain')
  })

  it('longText default matches V1 line 882-885 (width:540, height:42)', () => {
    expect(LONG_TEXT_DEFAULT_OPTIONS.width).toBe(540)
    expect(LONG_TEXT_DEFAULT_OPTIONS.height).toBe(42)
  })

  it('table default matches V1 line 1216-1218 (width:550)', () => {
    expect(TABLE_DEFAULT_OPTIONS.width).toBe(550)
  })

  it('html default matches V1 line 1773-1776 (width:90, height:90)', () => {
    expect(HTML_DEFAULT_OPTIONS.width).toBe(90)
    expect(HTML_DEFAULT_OPTIONS.height).toBe(90)
  })

  it('barcode default matches V1 line 2062-2068 (width:160, height:40, code128)', () => {
    expect(BARCODE_DEFAULT_OPTIONS.width).toBe(160)
    expect(BARCODE_DEFAULT_OPTIONS.height).toBe(40)
    expect(BARCODE_DEFAULT_OPTIONS.barcodeType).toBe('code128')
  })

  it('qrcode default matches V1 line 2245-2250 (width:80, height:80, qrcode)', () => {
    expect(QRCODE_DEFAULT_OPTIONS.width).toBe(80)
    expect(QRCODE_DEFAULT_OPTIONS.height).toBe(80)
    expect(QRCODE_DEFAULT_OPTIONS.qrcodeType).toBe('qrcode')
  })

  it('hline default matches V1 line 1325-1329 (width:90, height:9, borderWidth:0.75)', () => {
    expect(HLINE_DEFAULT_OPTIONS.width).toBe(90)
    expect(HLINE_DEFAULT_OPTIONS.height).toBe(9)
    // hline is the only V1 shape whose borderWidth was non-undefined.
    expect(HLINE_DEFAULT_OPTIONS.borderWidth).toBe(0.75)
  })

  it('vline default matches V1 line 1436-1440 (width:9, height:90)', () => {
    expect(VLINE_DEFAULT_OPTIONS.width).toBe(9)
    expect(VLINE_DEFAULT_OPTIONS.height).toBe(90)
    // V3 makes the V1 print-lock.css 0.75pt stroke explicit (V1 was undefined).
    expect(VLINE_DEFAULT_OPTIONS.borderWidth).toBe(0.75)
  })

  it('rect default matches V1 line 1555-1559 (width:90, height:90)', () => {
    expect(RECT_DEFAULT_OPTIONS.width).toBe(90)
    expect(RECT_DEFAULT_OPTIONS.height).toBe(90)
    expect(RECT_DEFAULT_OPTIONS.borderWidth).toBe(0.75)
  })

  it('oval default matches V1 line 1674-1678 (width:90, height:90)', () => {
    expect(OVAL_DEFAULT_OPTIONS.width).toBe(90)
    expect(OVAL_DEFAULT_OPTIONS.height).toBe(90)
    expect(OVAL_DEFAULT_OPTIONS.borderWidth).toBe(0.75)
    // V1 oval applies border-radius:50% inline at DOM construction
    // (`bundle.js:10376`); V3 keeps `borderRadius:50` so OvalElement.vue's
    // hardcoded `'50%'` rendering remains the source of truth but business
    // consumers can override.
    expect(OVAL_DEFAULT_OPTIONS.borderRadius).toBe(50)
  })
})
