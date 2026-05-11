/**
 * html.ts — Html element data factory (V3 pure data).
 *
 * V2 reference: src/hiprint-v2/core/etypes/html.js (jQuery DOM).
 * V3: data only — renderer (P15.2) emits HTML via formatter return.
 *
 * Defaults mirror V1 (bundle.js line 10108-10148).
 *
 * ⚠️ by-design: html element semantics = render the formatter's return as
 * HTML. Business owns escaping (ADR-0010 B7). V3 renderer DOES use innerHTML
 * for this element; that is the documented contract.
 */

import { createBaseElement, type BaseElement, type ElementTypeRef } from '../element-base'
import type { ElementTypeDef } from '../group'

export const HTML_DEFAULT_OPTIONS: Record<string, unknown> = {
  width: 100,
  height: 50,
}

export const HTML_DEFAULT_TYPE_DEF: ElementTypeDef = {
  tid: 'defaultModule.html',
  title: 'html',
  type: 'html',
  icon: 'ep:postcard',
}

export interface CreateHtmlElementInit {
  tid?: string
  printElementType?: Partial<ElementTypeRef>
  options?: Record<string, unknown>
  id?: string
  templateId?: string
}

export function createHtmlElement(
  init: CreateHtmlElementInit = {}
): BaseElement {
  const printElementType: ElementTypeRef = {
    tid: init.tid ?? init.printElementType?.tid ?? HTML_DEFAULT_TYPE_DEF.tid,
    type: 'html',
    title: init.printElementType?.title ?? HTML_DEFAULT_TYPE_DEF.title,
    ...(init.printElementType ?? {}),
  }
  return createBaseElement({
    tid: printElementType.tid ?? HTML_DEFAULT_TYPE_DEF.tid!,
    printElementType,
    options: { ...HTML_DEFAULT_OPTIONS, ...(init.options ?? {}) },
    ...(init.id !== undefined ? { id: init.id } : {}),
    ...(init.templateId !== undefined ? { templateId: init.templateId } : {}),
  })
}
