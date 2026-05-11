/**
 * panel.ts — PrintPanel JSON schema.
 *
 * V1 source: bundle.js line 10800-12200 (PrintPanel class `pt`).
 * V2 reference: src/hiprint-v2/core/panel.js — getPanelEntity() emits this
 * exact shape.
 *
 * The panel is the page-sized container holding print elements + paper
 * metadata + design-time guides / watermark / grid.
 */

import { z } from 'zod'
import { elementJsonSchema } from './element'
import { numberLikeOptional, booleanLikeOptional } from './style'

// ============ Paper-related option groups ============

export const watermarkOptionsSchema = z
  .object({
    text: z.string().optional(),
    color: z.string().optional(),
    fontSize: numberLikeOptional,
    angle: numberLikeOptional,
    opacity: numberLikeOptional,
  })
  .loose()

export const printMarginOptionsSchema = z
  .object({
    top: numberLikeOptional,
    right: numberLikeOptional,
    bottom: numberLikeOptional,
    left: numberLikeOptional,
  })
  .loose()

export const gridOptionsSchema = z
  .object({
    show: booleanLikeOptional,
    size: numberLikeOptional,
    color: z.string().optional(),
  })
  .loose()

/**
 * Guide line — single ruler-aligned helper line drawn in the designer.
 * V1 stores as { axis: 'x'|'y', position: number }.
 */
export const guideLineSchema = z
  .object({
    axis: z.enum(['x', 'y']).optional(),
    position: numberLikeOptional,
  })
  .loose()

// ============ Panel schema ============
//
// `.loose()` permits unknown panel-level keys (V1 occasionally added fields
// like paperNumberFormat or custom flags from business consumers).

export const panelSchema = z
  .object({
    /** Panel index (0-based). */
    index: numberLikeOptional,
    /** Display name (e.g. "P1" or custom). */
    name: z.union([z.string(), z.number()]).optional(),

    /** Paper width in mm. Default A4 = 210. */
    width: numberLikeOptional,
    /** Paper height in mm. Default A4 = 297. */
    height: numberLikeOptional,
    /** Named paper type (A4 / A5 / B5 / custom...). */
    paperType: z.string().optional(),

    /** Header bottom edge in pt. V1 default 10 (V2 0). */
    paperHeader: numberLikeOptional,
    /** Footer top edge in pt. V1 default 780. */
    paperFooter: numberLikeOptional,
    /** Page-number positioning. */
    paperNumberLeft: numberLikeOptional,
    paperNumberTop: numberLikeOptional,
    paperNumberDisabled: booleanLikeOptional,
    paperNumberContinue: booleanLikeOptional,

    /** Default font family for the panel (cascades to elements w/o explicit font). */
    fontFamily: z.string().optional(),
    fontSize: numberLikeOptional,

    /** Page orientation. */
    orient: z.enum(['portrait', 'landscape']).optional(),
    /** Rotation in degrees (0/90/180/270). */
    rotate: numberLikeOptional,
    /** Designer zoom factor. */
    scale: numberLikeOptional,

    /** Print elements (any element shape — see element.ts). */
    printElements: z.array(elementJsonSchema).optional(),

    /** Designer-only guide lines. */
    guideLines: z.array(guideLineSchema).optional(),
    /** Watermark configuration. */
    watermarkOptions: watermarkOptionsSchema.optional(),
    /** Print margin (4-sided). */
    printMarginOptions: printMarginOptionsSchema.optional(),
    /** Designer grid options. */
    gridOptions: gridOptionsSchema.optional(),

    /** Background image / color (V1 panel option). */
    backgroundColor: z.string().optional(),
    backgroundImage: z.string().optional(),

    /** Allow pagination on this panel. */
    pagination: booleanLikeOptional,
    /** Suppress empty pages (V1 line ~11800). */
    skipEmptyPage: booleanLikeOptional,
  })
  .loose()

export type PanelJson = z.infer<typeof panelSchema>
