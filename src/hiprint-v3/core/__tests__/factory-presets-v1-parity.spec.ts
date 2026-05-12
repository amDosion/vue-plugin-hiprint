/**
 * factory-presets-v1-parity.spec.ts — Sprint 22d TKT-161 + TKT-170 parity tests.
 *
 * Pins every `defaultModule.*` factory preset emitted by
 * `buildDefaultElementTypeGroups()` to the V1 inventory shape so a future
 * refactor cannot silently drift away from V1 (or business-template) parity.
 *
 * V1 source: `src/hiprint/etypes/default-etyps-provider.js` (vue-plugin-hiprint
 * main worktree) lines 22-441.
 * V1 inventory: `docs/V1-INVENTORY/etypes/text-longtext.md` §C +
 *                `docs/V1-INVENTORY/etypes/image-html.md` §C.
 *
 * Notes on intentional V3 deviations (NOT bugs — pinned here so the diff is
 * visible if anyone reverts them):
 *   - `defaultModule.trackingNo` / `barcode` / `qrcode` emit Path B
 *     `type:'barcode'` / `'qrcode'` instead of V1 Path A
 *     `type:'text' + textType:'barcode'`. See TKT-008 in
 *     `docs/V3-PARITY-MATRIX/04-barcode-qrcode.md`.
 *   - `defaultModule.orderDate` adds V1's `dataType:'datetime' +
 *     format:'YYYY-MM-DD HH:mm:ss'`. See TKT-024 / Sprint 22b BC notes.
 */

import { describe, it, expect } from 'vitest'
import { buildDefaultElementTypeGroups } from '../default-provider'
import type { ElementTypeDef } from '../group'

function presetByTid(tid: string): ElementTypeDef {
  const groups = buildDefaultElementTypeGroups()
  for (const g of groups) {
    const hit = g.printElementTypes.find((e) => e.tid === tid)
    if (hit) return hit
  }
  throw new Error('preset not found: ' + tid)
}

function presetGroup(tid: string): string {
  const groups = buildDefaultElementTypeGroups()
  for (const g of groups) {
    if (g.printElementTypes.some((e) => e.tid === tid)) return g.name ?? ''
  }
  throw new Error('preset not found: ' + tid)
}

function opts(p: ElementTypeDef): Record<string, unknown> {
  return (p.options ?? {}) as Record<string, unknown>
}

describe('TKT-161 — common group presets', () => {
  it('defaultModule.text → type=text, no preset options (uses text.default)', () => {
    const p = presetByTid('defaultModule.text')
    expect(p.type).toBe('text')
    expect(p.title).toBe('文本')
    expect(p.icon).toBe('ep:document')
    expect(p.data).toBe('')
    // V1 provider has no `options` block — element creation falls back to
    // text.default = `{width:120, height:9.75}` (now TEXT_DEFAULT_OPTIONS).
    expect(p.options).toBeUndefined()
    expect(presetGroup('defaultModule.text')).toBe('常规')
  })

  it('defaultModule.customText → type=text, custom flag, customText payload', () => {
    const p = presetByTid('defaultModule.customText')
    expect(p.type).toBe('text')
    expect(p.title).toBe('自定义文本')
    expect(p.custom).toBe(true)
    expect(p.customText).toBe('自定义文本')
    expect(p.icon).toBe('ep:edit-pen')
    expect(presetGroup('defaultModule.customText')).toBe('常规')
  })

  it('defaultModule.titleRow → 540×18, bold, gray bg, V1 parity', () => {
    const p = presetByTid('defaultModule.titleRow')
    const o = opts(p)
    expect(p.type).toBe('text')
    expect(p.title).toBe('标题行')
    expect(o.width).toBe(540)
    expect(o.height).toBe(18)
    expect(o.fontSize).toBe(14.25)
    expect(o.fontWeight).toBe('bold')
    expect(o.textAlign).toBe('center')
    expect(o.backgroundColor).toBe('#F2F6FC')
    expect(o.textContentVerticalAlign).toBe('middle')
    expect(presetGroup('defaultModule.titleRow')).toBe('常规')
  })

  it('defaultModule.longText → type=longText, V1 data "155123456789"', () => {
    const p = presetByTid('defaultModule.longText')
    expect(p.type).toBe('longText')
    expect(p.title).toBe('长文')
    expect(p.data).toBe('155123456789')
    expect(p.icon).toBe('ep:tickets')
    expect(presetGroup('defaultModule.longText')).toBe('常规')
  })

  it('defaultModule.image → type=image, blank data, no preset options', () => {
    const p = presetByTid('defaultModule.image')
    expect(p.type).toBe('image')
    expect(p.title).toBe('图片')
    expect(p.data).toBe('')
    expect(p.icon).toBe('ep:picture')
    // V1 image preset has no inline options block.
    expect(p.options).toBeUndefined()
    expect(presetGroup('defaultModule.image')).toBe('常规')
  })

  it('defaultModule.html → type=html, has placeholder formatter', () => {
    const p = presetByTid('defaultModule.html')
    expect(p.type).toBe('html')
    expect(p.title).toBe('html')
    expect(p.icon).toBe('ep:postcard')
    expect(typeof p.formatter).toBe('function')
    // No data → returns the dashed placeholder HTML (V1 line 137-144).
    const html = (p.formatter as (data: unknown) => string)(undefined)
    expect(html).toContain('自定义 HTML')
    expect(html).toContain('border:1px dashed')
    // With data string → returns it (V1 short-circuit).
    expect(
      (p.formatter as (data: unknown) => string)('<b>hello</b>')
    ).toBe('<b>hello</b>')
  })
})

describe('TKT-170 — e-commerce group presets (V1 inventory §C.4-C.10)', () => {
  it('defaultModule.url → blue underlined text, V1 color=#409eff', () => {
    const p = presetByTid('defaultModule.url')
    const o = opts(p)
    expect(p.type).toBe('text')
    expect(p.title).toBe('链接')
    expect(o.width).toBe(180)
    expect(o.height).toBe(9.75)
    // V1 inventory §C.4 — explicit #409eff (Element Plus blue), NOT
    // ant-design's #1677ff which the task example showed.
    expect(o.color).toBe('#409eff')
    expect(o.textDecoration).toBe('underline')
    expect(presetGroup('defaultModule.url')).toBe('电商')
  })

  it('defaultModule.price → red bold right-aligned (V1 inventory §C.5)', () => {
    const p = presetByTid('defaultModule.price')
    const o = opts(p)
    expect(p.type).toBe('text')
    expect(p.title).toBe('价格')
    expect(o.width).toBe(80)
    expect(o.height).toBe(12)
    expect(o.fontSize).toBe(12)
    expect(o.fontWeight).toBe('bold')
    expect(o.color).toBe('#f56c6c')
    expect(o.textAlign).toBe('right')
  })

  it('defaultModule.sku → small gray text (V1 inventory §C.6)', () => {
    const p = presetByTid('defaultModule.sku')
    const o = opts(p)
    expect(p.type).toBe('text')
    expect(p.title).toBe('SKU')
    expect(o.width).toBe(120)
    expect(o.height).toBe(9.75)
    expect(o.fontSize).toBe(9)
    expect(o.color).toBe('#909399')
  })

  it('defaultModule.senderInfo → longText 9pt sender block (V1 inventory C.2)', () => {
    const p = presetByTid('defaultModule.senderInfo')
    const o = opts(p)
    expect(p.type).toBe('longText')
    expect(p.title).toBe('寄件人信息')
    expect(o.width).toBe(240)
    expect(o.height).toBe(42)
    expect(o.fontSize).toBe(9)
    expect(o.lineHeight).toBe(13.5)
  })

  it('defaultModule.receiverInfo → longText 12pt bold (V1 inventory C.3)', () => {
    const p = presetByTid('defaultModule.receiverInfo')
    const o = opts(p)
    expect(p.type).toBe('longText')
    expect(p.title).toBe('收件人信息')
    expect(o.width).toBe(240)
    expect(o.height).toBe(42)
    expect(o.fontSize).toBe(12)
    expect(o.fontWeight).toBe('bold')
    expect(o.lineHeight).toBe(15)
  })

  it('defaultModule.orderNo → bound 10pt text, field=orderNo (V1 §C.7)', () => {
    const p = presetByTid('defaultModule.orderNo')
    const o = opts(p)
    expect(p.type).toBe('text')
    expect(p.title).toBe('订单号')
    expect(p.field).toBe('orderNo')
    expect(o.width).toBe(200)
    expect(o.height).toBe(12)
    expect(o.fontSize).toBe(10)
    expect(o.testData).toBe('DD20260509001')
  })

  it('defaultModule.orderDate → dataType=datetime + V1 format (TKT-024)', () => {
    const p = presetByTid('defaultModule.orderDate')
    const o = opts(p)
    expect(p.type).toBe('text')
    expect(p.title).toBe('下单日期')
    expect(p.field).toBe('orderDate')
    expect(o.width).toBe(160)
    expect(o.height).toBe(12)
    expect(o.fontSize).toBe(10)
    // Sprint 22b BC: format pipeline required so any Date / epoch / ISO
    // shape renders as YYYY-MM-DD HH:mm:ss.
    expect(o.dataType).toBe('datetime')
    expect(o.format).toBe('YYYY-MM-DD HH:mm:ss')
    expect(o.testData).toBe('2026-05-09 14:30')
  })

  it('defaultModule.totalAmount → red bold right (V1 inventory §C.10)', () => {
    const p = presetByTid('defaultModule.totalAmount')
    const o = opts(p)
    expect(p.type).toBe('text')
    expect(p.title).toBe('金额合计')
    expect(p.field).toBe('totalAmount')
    expect(o.width).toBe(120)
    expect(o.height).toBe(14)
    expect(o.fontSize).toBe(12)
    expect(o.fontWeight).toBe('bold')
    expect(o.color).toBe('#f56c6c')
    expect(o.textAlign).toBe('right')
    // V1 source supplies the ¥ prefix in testData, no `format` pipeline.
    expect(o.testData).toBe('¥ 1234.56')
  })

  it('defaultModule.trackingNo → Path B barcode, code128, field=trackingNo (TKT-008)', () => {
    const p = presetByTid('defaultModule.trackingNo')
    const o = opts(p)
    // V3 emits the renderer-supported Path B shape (`type:'barcode'`)
    // instead of V1 Path A (`type:'text' + textType:'barcode'`).
    expect(p.type).toBe('barcode')
    expect(p.title).toBe('快递单号')
    expect(p.field).toBe('trackingNo')
    expect(o.width).toBe(180)
    expect(o.height).toBe(50)
    expect(o.barcodeType).toBe('code128')
    expect(o.testData).toBe('SF1234567890')
    // V1 Path A textType must NOT be present (it would shadow Path B).
    expect(o.textType).toBeUndefined()
  })
})

describe('TKT-161 — auxiliary + utility group presets', () => {
  it('defaultModule.barcode → Path B, hideTitle, field=barcode (TKT-008)', () => {
    const p = presetByTid('defaultModule.barcode')
    const o = opts(p)
    expect(p.type).toBe('barcode')
    expect(p.title).toBe('条形码')
    expect(p.field).toBe('barcode')
    expect(o.width).toBe(140)
    expect(o.height).toBe(35)
    expect(o.barcodeType).toBe('code128')
    expect(o.hideTitle).toBe(true)
    expect(o.testData).toBe('123456789')
    expect(o.textType).toBeUndefined()
    expect(presetGroup('defaultModule.barcode')).toBe('辅助')
  })

  it('defaultModule.qrcode → Path B, qrCodeLevel=0 (M), hideTitle (TKT-008)', () => {
    const p = presetByTid('defaultModule.qrcode')
    const o = opts(p)
    expect(p.type).toBe('qrcode')
    expect(p.title).toBe('二维码')
    expect(p.field).toBe('qrcode')
    expect(o.width).toBe(50)
    expect(o.height).toBe(50)
    expect(o.qrCodeLevel).toBe(0)
    expect(o.hideTitle).toBe(true)
    expect(o.testData).toBe('https://example.com')
    expect(o.textType).toBeUndefined()
    expect(presetGroup('defaultModule.qrcode')).toBe('辅助')
  })

  it('defaultModule.currentDate → text + V1 formatter (templateData fallback)', () => {
    const p = presetByTid('defaultModule.currentDate')
    const o = opts(p)
    expect(p.type).toBe('text')
    expect(p.title).toBe('当前日期')
    expect(o.width).toBe(100)
    expect(o.height).toBe(12)
    expect(o.fontSize).toBe(9)
    expect(o.textAlign).toBe('left')
    expect(typeof p.formatter).toBe('function')
    // Formatter precedence: templateData.currentDate wins.
    const fmt = p.formatter as (
      title: unknown,
      data: unknown,
      options: unknown,
      templateData?: Record<string, unknown>
    ) => string
    const out = fmt(undefined, undefined, undefined, {
      currentDate: '2026-05-09',
    })
    expect(out).toBe('2026-05-09')
    // Falls back to templateData.printDate when currentDate absent.
    const out2 = fmt(undefined, undefined, undefined, {
      printDate: '2026-03-01',
    })
    expect(out2).toBe('2026-03-01')
    // No templateData → returns today (just verify format YYYY-MM-DD).
    const today = fmt(undefined, undefined, undefined)
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(presetGroup('defaultModule.currentDate')).toBe('实用')
  })

  it('defaultModule.signature → text with dashed bottom border (V1 §C.14)', () => {
    const p = presetByTid('defaultModule.signature')
    const o = opts(p)
    expect(p.type).toBe('text')
    expect(p.title).toBe('签名')
    expect(p.field).toBe('signature')
    expect(o.width).toBe(220)
    expect(o.height).toBe(32)
    expect(o.fontSize).toBe(11)
    expect(o.textAlign).toBe('left')
    expect(o.contentPaddingLeft).toBe(4)
    expect(o.borderBottom).toBe('solid')
    expect(o.borderWidth).toBe(0.75)
    expect(o.borderColor).toBe('#000000')
    expect(o.textContentVerticalAlign).toBe('bottom')
  })

  it('defaultModule.signatureImage → image 160×60 with SVG placeholder', () => {
    const p = presetByTid('defaultModule.signatureImage')
    const o = opts(p)
    expect(p.type).toBe('image')
    expect(p.title).toBe('签名图')
    expect(o.width).toBe(160)
    expect(o.height).toBe(60)
    expect(o.fit).toBe('contain')
    expect(o.src).toMatch(/^data:image\/svg\+xml/)
    // V1 placeholder has 4,3 dasharray + viewBox 0 0 160 60.
    expect(decodeURIComponent(o.src as string)).toContain('viewBox="0 0 160 60"')
    expect(decodeURIComponent(o.src as string)).toContain('点此上传签名')
  })

  it('defaultModule.seal → image 80×80 red circle placeholder', () => {
    const p = presetByTid('defaultModule.seal')
    const o = opts(p)
    expect(p.type).toBe('image')
    expect(p.title).toBe('印章')
    expect(o.width).toBe(80)
    expect(o.height).toBe(80)
    expect(o.fit).toBe('contain')
    expect(o.src).toMatch(/^data:image\/svg\+xml/)
    expect(decodeURIComponent(o.src as string)).toContain('<circle')
    expect(decodeURIComponent(o.src as string)).toContain('#d4380d')
    expect(decodeURIComponent(o.src as string)).toContain('印章')
  })
})

describe('TKT-161 — preset registry coverage', () => {
  it('all V1 default-etyps-provider tids are present in V3', () => {
    const groups = buildDefaultElementTypeGroups()
    const v3tids = new Set<string>()
    groups.forEach((g) =>
      g.printElementTypes.forEach((e) => v3tids.add(e.tid))
    )
    const v1Required = [
      'defaultModule.text',
      'defaultModule.image',
      'defaultModule.longText',
      'defaultModule.table',
      'defaultModule.emptyTable',
      'defaultModule.html',
      'defaultModule.customText',
      'defaultModule.titleRow',
      'defaultModule.url',
      'defaultModule.price',
      'defaultModule.sku',
      'defaultModule.senderInfo',
      'defaultModule.receiverInfo',
      'defaultModule.orderNo',
      'defaultModule.orderDate',
      'defaultModule.trackingNo',
      'defaultModule.totalAmount',
      'defaultModule.hline',
      'defaultModule.vline',
      'defaultModule.rect',
      'defaultModule.oval',
      'defaultModule.barcode',
      'defaultModule.qrcode',
      'defaultModule.currentDate',
      'defaultModule.signature',
      'defaultModule.signatureImage',
      'defaultModule.seal',
    ]
    v1Required.forEach((tid) => {
      expect(v3tids.has(tid)).toBe(true)
    })
  })
})
