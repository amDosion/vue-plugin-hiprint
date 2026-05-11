/**
 * long-text.ts — LongText element data factory (V3 pure data).
 *
 * V2 reference: src/hiprint-v2/core/etypes/long-text.js (jQuery DOM coupled).
 * V3: data only — pagination/binary-search/indent rendering moves to P15.2.
 *
 * Defaults mirror V1 (bundle.js line 9705-9870).
 */

import { createBaseElement, type BaseElement, type ElementTypeRef } from '../element-base'
import { coerceText } from '@hiprint-v3/internal'
import type { ElementTypeDef } from '../group'

export const LONG_TEXT_DEFAULT_OPTIONS: Record<string, unknown> = {
  width: 200,
  height: 30,
  fontSize: 9.75,
  lineHeight: 1.5,
  textAlign: 'left',
  longTextIndent: 0,
}

export const LONG_TEXT_DEFAULT_TYPE_DEF: ElementTypeDef = {
  tid: 'defaultModule.longText',
  title: '长文',
  type: 'longText',
  data: '',
  icon: 'ep:tickets',
}

export interface CreateLongTextElementInit {
  tid?: string
  printElementType?: Partial<ElementTypeRef>
  options?: Record<string, unknown>
  id?: string
  templateId?: string
}

export function createLongTextElement(
  init: CreateLongTextElementInit = {}
): BaseElement {
  const printElementType: ElementTypeRef = {
    tid: init.tid ?? init.printElementType?.tid ?? LONG_TEXT_DEFAULT_TYPE_DEF.tid,
    type: 'longText',
    title:
      init.printElementType?.title ?? LONG_TEXT_DEFAULT_TYPE_DEF.title,
    ...(init.printElementType ?? {}),
  }
  return createBaseElement({
    tid: printElementType.tid ?? LONG_TEXT_DEFAULT_TYPE_DEF.tid!,
    printElementType,
    options: { ...LONG_TEXT_DEFAULT_OPTIONS, ...(init.options ?? {}) },
    ...(init.id !== undefined ? { id: init.id } : {}),
    ...(init.templateId !== undefined ? { templateId: init.templateId } : {}),
  })
}

/**
 * Compose long-text display (title + value). Mirrors V2
 * composeLongTextDisplay but pure data — renderer (P15.2) handles indent
 * <span> + line wrapping.
 */
export function composeLongTextDisplay(
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
