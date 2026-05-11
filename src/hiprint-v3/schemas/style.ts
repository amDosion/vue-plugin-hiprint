/**
 * style.ts — Shared style / geometry / behavior props used by most elements.
 *
 * These props are union'd into every element's `options` schema. Each
 * sub-schema below is a partial — every field is `.optional()` since V1
 * templates omit defaults.
 *
 * Superset-compatible (see ADR-0011 invariant #13): unknown keys are
 * preserved via `.loose()` at the element level. Here we just enumerate
 * the keys we know about for editor IntelliSense.
 *
 * V1 reference: bundle.js line 677-1660 (BasePrintElement option getters).
 */

import { z } from 'zod'

// ============ Coercion helpers ============
//
// V1 historically accepted strings for numeric fields (e.g. options.width = "100")
// because property panels wrote raw <input> string values. V3 must still parse them.

/** Number or numeric string. Coerce to number. Used for left/top/width/height/x/y. */
export const numberLikeSchema = z.coerce.number()

/** Optional number-like. */
export const numberLikeOptional = numberLikeSchema.optional()

/** Boolean or 'true'/'false' string (V1 some checkbox panels stored strings). */
export const booleanLikeSchema = z.union([
  z.boolean(),
  z.literal('true').transform(() => true),
  z.literal('false').transform(() => false),
])

export const booleanLikeOptional = booleanLikeSchema.optional()

// ============ Geometry / position ============
//
// V1 BasePrintElement options used by every visible element. units are 'pt'
// in V1 (1pt = 1/72 inch). Image / shapes may set borderRadius separately.

export const geometryStyleSchema = z.object({
  /** Left position in pt. */
  left: numberLikeOptional,
  /** Top position in pt. */
  top: numberLikeOptional,
  /** Width in pt. */
  width: numberLikeOptional,
  /** Height in pt. */
  height: numberLikeOptional,
  /** Z-index / stacking order (V1 line 1410). */
  zIndex: numberLikeOptional,
  /** Rotation degrees (V1 line 1095). */
  rotate: numberLikeOptional,
  /** 'x' | 'y' axis lock during drag (V1 line 873). */
  axis: z.enum(['x', 'y']).optional(),
})

export type GeometryStyle = z.infer<typeof geometryStyleSchema>

// ============ Font ============
//
// V1 line 1126-1190 (fontSize/fontFamily/fontWeight/fontStyle/textDecoration).

export const fontStyleSchema = z.object({
  fontSize: numberLikeOptional,
  fontFamily: z.string().optional(),
  /** 'normal' | 'bold' | numeric weight. */
  fontWeight: z.union([z.string(), z.number()]).optional(),
  /** 'normal' | 'italic'. */
  fontStyle: z.string().optional(),
  textDecoration: z.string().optional(),
  textIndent: numberLikeOptional,
  lineHeight: numberLikeOptional,
  letterSpacing: numberLikeOptional,
  /** Inline color css. */
  color: z.string().optional(),
  /** Background color (V1 element option). */
  backgroundColor: z.string().optional(),
  textColor: z.string().optional(),
})

export type FontStyle = z.infer<typeof fontStyleSchema>

// ============ Text alignment ============

export const alignSchema = z.enum(['left', 'center', 'right']).optional()
export const verticalAlignSchema = z.enum(['top', 'middle', 'bottom']).optional()

export const alignmentStyleSchema = z.object({
  /** Horizontal text alignment. */
  textAlign: alignSchema,
  /** Vertical alignment (cell-style). */
  textContentVerticalAlign: verticalAlignSchema,
  /** Horizontal alignment alias used in table cells (V1 halign). */
  halign: alignSchema,
  /** Vertical alignment alias used in table cells (V1 vAlign). */
  vAlign: verticalAlignSchema,
  /** Generic align (V1 column alignment). */
  align: alignSchema,
})

export type AlignmentStyle = z.infer<typeof alignmentStyleSchema>

// ============ Border ============
//
// V1 stores borders as individual sides plus a shorthand option (V1 ~1320).

export const borderStyleSchema = z.object({
  borderStyle: z.string().optional(),
  borderColor: z.string().optional(),
  borderWidth: numberLikeOptional,
  borderTop: z.string().optional(),
  borderRight: z.string().optional(),
  borderBottom: z.string().optional(),
  borderLeft: z.string().optional(),
  /** Radius (V1 image option, also used by rect/oval). */
  borderRadius: numberLikeOptional,
})

export type BorderStyle = z.infer<typeof borderStyleSchema>

// ============ Padding (inner spacing) ============

export const paddingStyleSchema = z.object({
  /** Shorthand '5 10 5 10' or single number. */
  padding: z.union([z.string(), z.number()]).optional(),
  paddingTop: numberLikeOptional,
  paddingRight: numberLikeOptional,
  paddingBottom: numberLikeOptional,
  paddingLeft: numberLikeOptional,
})

export type PaddingStyle = z.infer<typeof paddingStyleSchema>

// ============ Behavior toggles (interaction) ============
//
// V1 line 880-928 (positionLocked / sizeLocked / draggable / hideTitle).

export const behaviorStyleSchema = z.object({
  /** Lock position from drag (V1 line 880). */
  positionLocked: booleanLikeOptional,
  /** Lock size from resize handles (V1 line 882). */
  sizeLocked: booleanLikeOptional,
  /** Disable drag entirely (V1 line 542). */
  draggable: booleanLikeOptional,
  /** Hide the title prefix on rendered text (V1 line 41 of text.js). */
  hideTitle: booleanLikeOptional,
  /** Conditional rendering per page (first/last/odd/even) — V1 line 212. */
  showInPage: z.enum(['first', 'last', 'odd', 'even']).optional(),
  /** Conditional suppression (first/last) — V1 line 213. */
  unShowInPage: z.enum(['first', 'last']).optional(),
  /** Element instance name (used by getElementByName + table id). */
  name: z.string().optional(),
  /** Custom right-click menu disable. */
  customDisabled: booleanLikeOptional,
})

export type BehaviorStyle = z.infer<typeof behaviorStyleSchema>

// ============ Title / Field / Data ============
//
// V1 stores title separately from field path. testData is design-time preview
// data used when templateData not passed at render.

export const dataStyleSchema = z.object({
  /** Label prefix shown before data ("姓名：" + value). */
  title: z.string().optional(),
  /** Dotted field path into template data ("user.name"). */
  field: z.string().optional(),
  /** Design-time preview value (used when templateData missing). */
  testData: z.unknown().optional(),
  /**
   * Formatter — string form persisted to JSON (deserialized via evalCap at
   * runtime); runtime can also be a Function injected by business code.
   * `z.unknown()` keeps both shapes valid without coupling to Zod's function
   * schema API (which changed signatures between Zod 3.x and 4.x).
   */
  formatter: z.unknown().optional(),
  /** Styler — same dual nature as formatter (string at design-time, Function at runtime). */
  styler: z.unknown().optional(),
})

export type DataStyle = z.infer<typeof dataStyleSchema>

// ============ Composite: base options every element shares ============
//
// Merging is done via .extend() at the element layer; here we provide the
// merged shape as a convenience. Element schemas may override individual
// fields (e.g. text adds `textType`, image adds `src`/`fit`, table adds
// `columns`).

export const baseElementOptionsSchema = geometryStyleSchema
  .extend(fontStyleSchema.shape)
  .extend(alignmentStyleSchema.shape)
  .extend(borderStyleSchema.shape)
  .extend(paddingStyleSchema.shape)
  .extend(behaviorStyleSchema.shape)
  .extend(dataStyleSchema.shape)

export type BaseElementOptions = z.infer<typeof baseElementOptionsSchema>
