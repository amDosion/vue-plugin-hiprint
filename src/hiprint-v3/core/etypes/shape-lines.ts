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

export const HLINE_DEFAULT_OPTIONS: Record<string, unknown> = {
  width: 200,
  height: 1,
  borderTop: 'solid',
  borderWidth: 1,
  borderColor: '#000000',
}

export const HLINE_DEFAULT_TYPE_DEF: ElementTypeDef = {
  tid: 'defaultModule.hline',
  title: '横线',
  type: 'hline',
  icon: 'ep:minus',
}

// ============ VLine ============

export const VLINE_DEFAULT_OPTIONS: Record<string, unknown> = {
  width: 1,
  height: 100,
  borderLeft: 'solid',
  borderWidth: 1,
  borderColor: '#000000',
}

export const VLINE_DEFAULT_TYPE_DEF: ElementTypeDef = {
  tid: 'defaultModule.vline',
  title: '竖线',
  type: 'vline',
  icon: 'ep:more-filled',
}

// ============ Rect ============

export const RECT_DEFAULT_OPTIONS: Record<string, unknown> = {
  width: 100,
  height: 60,
  borderStyle: 'solid',
  borderWidth: 1,
  borderColor: '#000000',
}

export const RECT_DEFAULT_TYPE_DEF: ElementTypeDef = {
  tid: 'defaultModule.rect',
  title: '矩形',
  type: 'rect',
  icon: 'ep:crop',
}

// ============ Oval ============

export const OVAL_DEFAULT_OPTIONS: Record<string, unknown> = {
  width: 60,
  height: 60,
  borderStyle: 'solid',
  borderWidth: 1,
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
