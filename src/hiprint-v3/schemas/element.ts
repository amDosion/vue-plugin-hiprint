/**
 * element.ts — Print element JSON schema (discriminated union over type).
 *
 * V1 JSON storage shape:
 *   { options: {...}, printElementType: { tid: 'text.xx', type: 'text', ... } }
 *
 * The discriminator field is `printElementType.type`, NOT `tid`. `tid` is the
 * developer-facing module-namespaced identity ("groupName.elementId") while
 * `type` is the renderer dispatch key ('text' / 'image' / 'table' / ...).
 *
 * V1 SUPPORTED_ELEMENT_TYPES (see internal/constants.ts):
 *   text, image, longText, table, barcode, qrcode, hline, vline, rect, oval, html
 *
 * Each member schema below extends `baseElementOptionsSchema` from style.ts
 * and adds element-specific options. The wrapper object uses `.loose()` so
 * unknown V1 fields (added in the future by upstream) parse without error —
 * critical for invariant #13 (ADR-0011 superset compatibility).
 */

import { z } from 'zod'
import { baseElementOptionsSchema, numberLikeOptional, booleanLikeOptional } from './style'

// ============ printElementType inner schema ============
//
// V1 line 10660+: each element has a printElementType definition merged from
// the registry. JSON storage normally serializes only { tid, type }; full-clone
// mode (panel.getPanelEntity(true)) embeds the entire type definition.

export const printElementTypeSchema = z
  .object({
    /** "moduleName.elementId" — e.g., "default.text". */
    tid: z.string().optional(),
    /** Renderer type — the discriminator. */
    type: z.enum([
      'text',
      'image',
      'longText',
      'table',
      'barcode',
      'qrcode',
      'hline',
      'vline',
      'rect',
      'oval',
      'html',
    ]),
    /** Display title shown in element panel. */
    title: z.string().optional(),
    /** Default field path. */
    field: z.string().optional(),
    /** Default data accessor for design preview (function — preserved as-is). */
    getData: z.unknown().optional(),
    /** Default formatter — function form preserved, string form parses at runtime. */
    formatter: z.unknown().optional(),
    /** Default styler. */
    styler: z.unknown().optional(),
    /** Image-only on-image-choose-click handler reference. */
    onImageChooseClick: z.unknown().optional(),
  })
  .loose()

export type PrintElementType = z.infer<typeof printElementTypeSchema>

// ============ Per-element option schemas ============
//
// Strategy: extend baseElementOptionsSchema with element-specific fields,
// then mark the resulting object `.loose()` so unrecognized keys pass through.

// ---------- text ----------
//
// V1 text: bundle.js 9961-10020 + property panel (V1 ~7800).
//  - textType: 'text' | 'qrcode' | 'barcode' inline switch (rarely used)
//  - longTextIndent: first-line indent count (V1 long-text-indent renderer)

export const textOptionsSchema = baseElementOptionsSchema
  .extend({
    textType: z.string().optional(),
    longTextIndent: numberLikeOptional,
    /** Render fragment between title and value (default '：'). V1 hardcoded. */
    titleSep: z.string().optional(),
  })
  .loose()

// ---------- image ----------
//
// V1 image: bundle.js 9220-9265 (entity) + renderers/image.js.
//  - src: image URL or data: URI (also a fallback when field value empty)
//  - fit: CSS object-fit value ('contain'|'cover'|'fill'|'none')

export const imageOptionsSchema = baseElementOptionsSchema
  .extend({
    src: z.string().optional(),
    fit: z.enum(['contain', 'cover', 'fill', 'none', 'scale-down']).optional(),
  })
  .loose()

// ---------- longText ----------
//
// V1 long-text: bundle.js 9705-9870 + renderers/long-text.js. Auto-pagination
// uses binary search; the indent option drives first-line indent rendering.

export const longTextOptionsSchema = baseElementOptionsSchema
  .extend({
    longTextIndent: numberLikeOptional,
    /** Render lines with this minimum height (V1 lineHeight default 1.5 of fontSize). */
    lineHeight: numberLikeOptional,
  })
  .loose()

// ---------- barcode ----------
//
// V1 barcode renderer: renderers/barcode.js + etypes/barcode.js (10380-10448).
//  - barcodeType: bwip-js bcid string (code128 default)
//  - barColor / barWidth / barAutoWidth: rendering tuning

export const barcodeOptionsSchema = baseElementOptionsSchema
  .extend({
    barcodeType: z.string().optional(),
    barColor: z.string().optional(),
    barWidth: numberLikeOptional,
    barAutoWidth: booleanLikeOptional,
  })
  .loose()

// ---------- qrcode ----------
//
// V1 qrcode renderer: renderers/qrcode.js + etypes/qrcode.js (10449-10515).
//  - qrcodeType: bwip-js bcid (default 'qrcode')
//  - qrCodeLevel: 0-3 → ['M','L','H','Q'] error-correction mapping

export const qrcodeOptionsSchema = baseElementOptionsSchema
  .extend({
    qrcodeType: z.string().optional(),
    qrCodeLevel: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(),
    barColor: z.string().optional(),
  })
  .loose()

// ---------- html ----------
//
// V1 html: bundle.js 10108-10148. Custom-HTML element. Renders formatter return
// value directly (by-design: business owns escaping — see ADR-0010 B7).

export const htmlOptionsSchema = baseElementOptionsSchema
  .extend({
    /** Raw HTML to render (when no formatter / field given). */
    content: z.string().optional(),
  })
  .loose()

// ---------- hline / vline / rect / oval (shapes) ----------
//
// V1 shape-lines: bundle.js 10160-10260. Pure decoration — no data binding.
// They share the base options (border / color / radius / geometry).

export const hlineOptionsSchema = baseElementOptionsSchema.loose()
export const vlineOptionsSchema = baseElementOptionsSchema.loose()
export const rectOptionsSchema = baseElementOptionsSchema.loose()
export const ovalOptionsSchema = baseElementOptionsSchema.loose()

// ---------- table ----------
//
// V1 table: bundle.js 6210-6709 + etypes/table/* (V2 modular port).
//  - columns: array of column-row arrays (multi-layer header). Each cell has
//    title/field/width/align/colspan/rowspan/formatter/styler/...
//  - testData: JSON string '[{}]' (parsed at runtime in TablePrintElement.getData)
//  - footerFormatter / gridColumnsFooter / repeatHeader: table-level options
//
// Column shape mirrors TableColumnEntity (V2 etypes/table/cell.js lines 35-66).

export const tableColumnSchema = z
  .object({
    title: z.string().optional(),
    field: z.string().optional(),
    width: numberLikeOptional,
    align: z.enum(['left', 'center', 'right']).optional(),
    halign: z.enum(['left', 'center', 'right']).optional(),
    vAlign: z.enum(['top', 'middle', 'bottom']).optional(),
    colspan: numberLikeOptional,
    rowspan: numberLikeOptional,
    checked: booleanLikeOptional,
    columnId: z.string().optional(),
    /** Per-cell formatter — string form persisted, function form runtime. */
    renderFormatter: z.unknown().optional(),
    formatter: z.unknown().optional(),
    formatter2: z.unknown().optional(),
    styler: z.unknown().optional(),
    styler2: z.unknown().optional(),
    stylerHeader: z.unknown().optional(),
    /** Per-column footer summary. */
    tableSummaryTitle: z.string().optional(),
    tableSummaryText: z.string().optional(),
    tableSummaryColspan: numberLikeOptional,
    tableSummary: z.unknown().optional(),
    tableSummaryAlign: z.enum(['left', 'center', 'right']).optional(),
    tableSummaryNumFormat: z.string().optional(),
    tableSummaryFormatter: z.unknown().optional(),
    showCodeTitle: booleanLikeOptional,
    upperCase: booleanLikeOptional,
    tableColumnHeight: numberLikeOptional,
    tableTextType: z.string().optional(),
    tableBarcodeMode: z.string().optional(),
    tableQRCodeLevel: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(),
  })
  .loose()

export type TableColumn = z.infer<typeof tableColumnSchema>

/**
 * V1 stores `columns` as either:
 *  - Array<Array<TableColumn>>  (multi-layer headers)
 *  - Array<TableColumn>         (single-layer — older templates)
 * Accept both for backward compatibility.
 */
export const tableColumnsSchema = z.union([
  z.array(z.array(tableColumnSchema)),
  z.array(tableColumnSchema),
])

export const tableOptionsSchema = baseElementOptionsSchema
  .extend({
    /** Columns layout (multi-layer or single-layer). */
    columns: tableColumnsSchema.optional(),
    /** testData JSON string ('[{}]' default — parsed at runtime). */
    testData: z.union([z.string(), z.array(z.unknown())]).optional(),
    /** Footer formatter (string at design-time, function at runtime). */
    footerFormatter: z.unknown().optional(),
    /** Grid-columns footer formatter (V1 gridColumnsFooter). */
    gridColumnsFooter: z.unknown().optional(),
    gridColumnsFooterFormatter: z.unknown().optional(),
    /** Group-by configuration for grouped tables (V2 etypes/table/row-merge.js). */
    groupFields: z.array(z.string()).optional(),
    groupFieldsFormatter: z.unknown().optional(),
    groupFormatter: z.unknown().optional(),
    groupFooterFormatter: z.unknown().optional(),
    /** Cell vertical merging configuration. */
    rowsColumnsMerge: z.unknown().optional(),
    /** Repeat table header on each printed page. */
    repeatHeader: booleanLikeOptional,
    /** Row styler. */
    rowStyler: z.unknown().optional(),
    /** Header styler. */
    headerStyler: z.unknown().optional(),
    /** Min row height for empty / data rows. */
    rowHeight: numberLikeOptional,
    headerRowHeight: numberLikeOptional,
    footerRowHeight: numberLikeOptional,
  })
  .loose()

// ============ Discriminated union ============
//
// Each member wraps the per-type options schema inside the V1 storage envelope:
//   { options, printElementType: { tid, type, ... } }
//
// Zod 4.x discriminatedUnion requires every member to share the same discriminator
// path. We discriminate on `printElementType.type` by giving each member a
// `printElementType: z.object({ type: z.literal('xxx'), ... })` clause.

function makeElement<T extends z.ZodTypeAny, K extends string>(
  typeLiteral: K,
  optionsSchema: T,
) {
  return z
    .object({
      options: optionsSchema,
      printElementType: printElementTypeSchema.extend({
        type: z.literal(typeLiteral),
      }),
      /** Optional element id (runtime-generated; absent from fresh templates). */
      id: z.string().optional(),
      /** Optional template back-ref id. */
      templateId: z.string().optional(),
    })
    .loose()
}

export const textElementSchema = makeElement('text', textOptionsSchema)
export const imageElementSchema = makeElement('image', imageOptionsSchema)
export const longTextElementSchema = makeElement('longText', longTextOptionsSchema)
export const tableElementSchema = makeElement('table', tableOptionsSchema)
export const barcodeElementSchema = makeElement('barcode', barcodeOptionsSchema)
export const qrcodeElementSchema = makeElement('qrcode', qrcodeOptionsSchema)
export const hlineElementSchema = makeElement('hline', hlineOptionsSchema)
export const vlineElementSchema = makeElement('vline', vlineOptionsSchema)
export const rectElementSchema = makeElement('rect', rectOptionsSchema)
export const ovalElementSchema = makeElement('oval', ovalOptionsSchema)
export const htmlElementSchema = makeElement('html', htmlOptionsSchema)

/**
 * Strict element schema — discriminated union of per-type element schemas.
 *
 * V1 storage shape places the type literal at `printElementType.type` (NOT
 * top-level). Zod 4.x `discriminatedUnion` requires a top-level discriminator
 * key, so we instead use `z.union` and rely on the nested literal in each
 * member to drive parse selection. The cost is slightly worse parse error
 * messages; the gain is exact V1 JSON shape parity (invariant #13).
 */
export const elementSchema = z.union([
  textElementSchema,
  imageElementSchema,
  longTextElementSchema,
  tableElementSchema,
  barcodeElementSchema,
  qrcodeElementSchema,
  hlineElementSchema,
  vlineElementSchema,
  rectElementSchema,
  ovalElementSchema,
  htmlElementSchema,
])

/**
 * Permissive element schema — V1 superset fallback.
 *
 * Accepts ANY object with `options` + `printElementType`, regardless of
 * whether `printElementType.type` matches a known V1 literal. Use this when
 * parsing legacy templates that may carry custom element types registered by
 * business code at runtime (e.g. setDynamicFields adds new tids beyond the
 * V1 built-in set).
 */
export const elementJsonSchema = z
  .object({
    options: z.record(z.string(), z.unknown()).optional(),
    printElementType: printElementTypeSchema,
    id: z.string().optional(),
    templateId: z.string().optional(),
  })
  .loose()

export type ElementJson = z.infer<typeof elementJsonSchema>
export type TextElementJson = z.infer<typeof textElementSchema>
export type ImageElementJson = z.infer<typeof imageElementSchema>
export type LongTextElementJson = z.infer<typeof longTextElementSchema>
export type TableElementJson = z.infer<typeof tableElementSchema>
export type BarcodeElementJson = z.infer<typeof barcodeElementSchema>
export type QrcodeElementJson = z.infer<typeof qrcodeElementSchema>
export type HtmlElementJson = z.infer<typeof htmlElementSchema>
