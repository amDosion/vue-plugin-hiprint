/**
 * text.ts — Text element data factory (V3 pure data).
 *
 * V2 reference: src/hiprint-v2/core/etypes/text.js (DOM-coupled).
 * V3: data factory returning a BaseElement; DOM rendering is P15.2 / P17.
 *
 * Default printElementType + options mirror V1 (bundle.js line 9961-10020).
 *
 * Invariants:
 *  - R3 B7: getTextDisplay returns plain string; renderers apply .text() by
 *    default and .html() only when formatter is present (XSS-safe path).
 *  - PM-002 R3: getTextDisplay preserves 0 / false / '' via resolveField caller.
 */

import { createBaseElement, type BaseElement, type ElementTypeRef } from '../element-base'
import { coerceText } from '@hiprint-v3/internal'
import type { ElementTypeDef } from '../group'

/** V1/V2 default text options (V1 line 9961+). */
export const TEXT_DEFAULT_OPTIONS: Record<string, unknown> = {
  width: 100,
  height: 12,
  fontSize: 9.75,
  textAlign: 'left',
  textContentVerticalAlign: 'top',
}

/** Default ElementTypeDef definition for a built-in text element. */
export const TEXT_DEFAULT_TYPE_DEF: ElementTypeDef = {
  tid: 'defaultModule.text',
  title: '文本',
  type: 'text',
  data: '',
  icon: 'ep:document',
}

export interface CreateTextElementInit {
  tid?: string
  /** Override printElementType (merges into the built-in default). */
  printElementType?: Partial<ElementTypeRef>
  /** Element-instance options (left/top/width/height/...). */
  options?: Record<string, unknown>
  /** Force a specific id (else generated). */
  id?: string
  templateId?: string
}

/**
 * Build a BaseElement of type 'text' with V1-compatible defaults.
 */
export function createTextElement(init: CreateTextElementInit = {}): BaseElement {
  const printElementType: ElementTypeRef = {
    tid: init.tid ?? init.printElementType?.tid ?? TEXT_DEFAULT_TYPE_DEF.tid,
    type: 'text',
    title: init.printElementType?.title ?? TEXT_DEFAULT_TYPE_DEF.title,
    ...(init.printElementType ?? {}),
  }
  return createBaseElement({
    tid: printElementType.tid ?? TEXT_DEFAULT_TYPE_DEF.tid!,
    printElementType,
    options: { ...TEXT_DEFAULT_OPTIONS, ...(init.options ?? {}) },
    ...(init.id !== undefined ? { id: init.id } : {}),
    ...(init.templateId !== undefined ? { templateId: init.templateId } : {}),
  })
}

/**
 * Compose text display value (title-prefix + value) — V2 TextPrintElement.getText
 * data-layer extract. Returns plain string (renderer decides .text()/.html()).
 *
 * @param value      raw extracted data value (from resolveField caller)
 * @param title      element title (e.g. '订单号')
 * @param hideTitle  when true, return only the value
 * @param titleSep   separator between title and value (default '：')
 */
export function getTextDisplay(
  value: unknown,
  title?: string,
  hideTitle?: boolean,
  titleSep: string = '：'
): string {
  const valueStr = coerceText(value)
  if (hideTitle) return valueStr
  if (title == null || title === '') return valueStr
  return title + titleSep + valueStr
}
