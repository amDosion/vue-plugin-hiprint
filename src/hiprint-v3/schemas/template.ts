/**
 * template.ts — Top-level PrintTemplate JSON schema.
 *
 * V1 source: bundle.js line 12244-13230 (PrintTemplate class).
 * V2 reference: src/hiprint-v2/template/print-template.js — getJson() emits
 * `{ panels: [...] }`. Update.js consumes the same shape.
 *
 * The wrapper is the smallest persistable unit business consumers exchange
 * with this library. Everything else (toolbar / designer state / dynamic
 * fields) is runtime configuration, not part of the JSON template.
 *
 * Superset-compatible (ADR-0011 invariant #13): `.loose()` permits unknown
 * top-level keys (V1 sometimes embedded templateName / version / extra
 * metadata in the same JSON).
 */

import { z } from 'zod'
import { panelSchema } from './panel'
import { numberLikeOptional } from './style'

// ============ Template-level schema ============

export const templateSchema = z
  .object({
    /** Panels — at least one required at runtime, but JSON may temporarily be empty. */
    panels: z.array(panelSchema),

    /** Optional template id (V1 sometimes persisted; runtime regenerates). */
    templateId: z.string().optional(),
    /** Optional friendly name. */
    templateName: z.string().optional(),
    /** Optional version stamp (business metadata; not used by hiprint runtime). */
    version: z.union([z.string(), z.number()]).optional(),

    /** Default designer zoom for the template. */
    scale: numberLikeOptional,
    /** Default font family cascaded to panels. */
    fontFamily: z.string().optional(),
    /** Default font size in pt. */
    fontSize: numberLikeOptional,

    /** Designer ruler / grid global toggles. */
    showRuler: z.boolean().optional(),
    showGrid: z.boolean().optional(),

    /** Test data preview (V1 stored test data alongside template — design-time only). */
    testData: z.unknown().optional(),
  })
  .loose()

export type TemplateJson = z.infer<typeof templateSchema>

// ============ Safe-parse helpers ============
//
// Convenience wrappers callers may use instead of `.parse()` / `.safeParse()`.

/**
 * Parse a template JSON. Throws on schema violation.
 * @throws ZodError
 */
export function parseTemplate(json: unknown): TemplateJson {
  return templateSchema.parse(json)
}

/**
 * Safe-parse a template JSON. Returns a discriminated result.
 */
export function safeParseTemplate(json: unknown) {
  return templateSchema.safeParse(json)
}
