/**
 * shape-lines.ts — Shape elements (hline / vline / rect / oval) — V3 pure data.
 *
 * V2 reference: src/hiprint-v2/core/etypes/shape-lines.js (jQuery DOM).
 * V3: data only — purely decorative, no data binding. Renderer (P15.2) draws
 * via SVG / CSS borders.
 *
 * Defaults mirror V1 (bundle.js line 10160-10260).
 */

import { createBaseElement, type BaseElement, type ElementTypeRef } from '../element-base'
import type { ElementTypeDef } from '../group'

// ============ HLine ============

/**
 * V1 default hline options.
 *
 * Sprint 22d TKT-162: aligned to V1 `hline.default`
 * (hiprint.config.js line 1325-1329): `width:90, height:9, borderWidth:0.75`.
 * V3 keeps the explicit `borderTop:'solid'` + `borderColor:'#000000'` defaults
 * so the renderer emits a visible line without depending on print-lock.css
 * fallback that V3 hasn't shipped.
 */
export const HLINE_DEFAULT_OPTIONS: Record<string, unknown> = {
  width: 90,
  height: 9,
  borderTop: 'solid',
  borderWidth: 0.75,
  borderColor: '#000000',
}

export const HLINE_DEFAULT_TYPE_DEF: ElementTypeDef = {
  tid: 'defaultModule.hline',
  title: '横线',
  type: 'hline',
  icon: 'ep:minus',
}

// ============ VLine ============

/**
 * V1 default vline options.
 *
 * Sprint 22d TKT-162: aligned to V1 `vline.default`
 * (hiprint.config.js line 1436-1440): `width:9, height:90`.
 * V1's `borderWidth: undefined` relies on print-lock.css `0.75pt` fallback;
 * V3 sets `borderWidth:0.75` explicitly to keep the visible line under V3's
 * print stylesheet (which doesn't ship the V1 !important fallback).
 */
export const VLINE_DEFAULT_OPTIONS: Record<string, unknown> = {
  width: 9,
  height: 90,
  borderLeft: 'solid',
  borderWidth: 0.75,
  borderColor: '#000000',
}

export const VLINE_DEFAULT_TYPE_DEF: ElementTypeDef = {
  tid: 'defaultModule.vline',
  title: '竖线',
  type: 'vline',
  icon: 'ep:more-filled',
}

// ============ Rect ============

/**
 * V1 default rect options.
 *
 * Sprint 22d TKT-162: aligned to V1 `rect.default`
 * (hiprint.config.js line 1555-1559): `width:90, height:90`.
 * V1's `borderWidth: undefined` relies on print-lock.css `0.75pt` fallback;
 * V3 sets `borderWidth:0.75` explicitly so the rect outline is visible
 * without the V1 fallback CSS.
 */
export const RECT_DEFAULT_OPTIONS: Record<string, unknown> = {
  width: 90,
  height: 90,
  borderStyle: 'solid',
  borderWidth: 0.75,
  borderColor: '#000000',
}

export const RECT_DEFAULT_TYPE_DEF: ElementTypeDef = {
  tid: 'defaultModule.rect',
  title: '矩形',
  type: 'rect',
  icon: 'ep:crop',
}

// ============ Oval ============

/**
 * V1 default oval options.
 *
 * Sprint 22d TKT-162: aligned to V1 `oval.default`
 * (hiprint.config.js line 1674-1678): `width:90, height:90`.
 * V1's `borderWidth: undefined` relies on print-lock.css `0.75pt` fallback;
 * V3 sets `borderWidth:0.75` explicitly. V3 keeps `borderRadius:50` so
 * OvalElement.vue's `50%` rendering can degrade to a panel-driven value
 * if a business consumer rebinds the percentage to a number.
 */
export const OVAL_DEFAULT_OPTIONS: Record<string, unknown> = {
  width: 90,
  height: 90,
  borderStyle: 'solid',
  borderWidth: 0.75,
  borderColor: '#000000',
  borderRadius: 50,
}

export const OVAL_DEFAULT_TYPE_DEF: ElementTypeDef = {
  tid: 'defaultModule.oval',
  title: '椭圆',
  type: 'oval',
  icon: 'ep:aim',
}

// ============ Generic factory ============

export interface CreateShapeElementInit {
  tid?: string
  printElementType?: Partial<ElementTypeRef>
  options?: Record<string, unknown>
  id?: string
  templateId?: string
}

function buildShape(
  typeName: 'hline' | 'vline' | 'rect' | 'oval',
  defaultDef: ElementTypeDef,
  defaultOptions: Record<string, unknown>,
  init: CreateShapeElementInit
): BaseElement {
  const printElementType: ElementTypeRef = {
    tid: init.tid ?? init.printElementType?.tid ?? defaultDef.tid,
    type: typeName,
    title: init.printElementType?.title ?? defaultDef.title,
    ...(init.printElementType ?? {}),
  }
  return createBaseElement({
    tid: printElementType.tid ?? defaultDef.tid!,
    printElementType,
    options: { ...defaultOptions, ...(init.options ?? {}) },
    ...(init.id !== undefined ? { id: init.id } : {}),
    ...(init.templateId !== undefined ? { templateId: init.templateId } : {}),
  })
}

export function createHLineElement(
  init: CreateShapeElementInit = {}
): BaseElement {
  return buildShape('hline', HLINE_DEFAULT_TYPE_DEF, HLINE_DEFAULT_OPTIONS, init)
}

export function createVLineElement(
  init: CreateShapeElementInit = {}
): BaseElement {
  return buildShape('vline', VLINE_DEFAULT_TYPE_DEF, VLINE_DEFAULT_OPTIONS, init)
}

export function createRectElement(
  init: CreateShapeElementInit = {}
): BaseElement {
  return buildShape('rect', RECT_DEFAULT_TYPE_DEF, RECT_DEFAULT_OPTIONS, init)
}

export function createOvalElement(
  init: CreateShapeElementInit = {}
): BaseElement {
  return buildShape('oval', OVAL_DEFAULT_TYPE_DEF, OVAL_DEFAULT_OPTIONS, init)
}
