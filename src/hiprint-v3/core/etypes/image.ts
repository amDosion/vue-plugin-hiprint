/**
 * image.ts — Image element data factory (V3 pure data).
 *
 * V2 reference: src/hiprint-v2/core/etypes/image.js (jQuery DOM coupled).
 * V3: data only — DOM rendering moves to P15.2 / P17.
 *
 * V1/V2 image getData has a 3-stage fallback chain:
 *   templateData[field] → options.src → printElementType.getData()
 */

import { createBaseElement, type BaseElement, type ElementTypeRef } from '../element-base'
import { resolveField } from '@hiprint-v3/internal'
import type { ElementTypeDef } from '../group'

export const IMAGE_DEFAULT_OPTIONS: Record<string, unknown> = {
  width: 100,
  height: 60,
  fit: 'contain',
}

export const IMAGE_DEFAULT_TYPE_DEF: ElementTypeDef = {
  tid: 'defaultModule.image',
  title: '图片',
  type: 'image',
  data: '',
  icon: 'ep:picture',
}

export interface CreateImageElementInit {
  tid?: string
  printElementType?: Partial<ElementTypeRef>
  options?: Record<string, unknown>
  id?: string
  templateId?: string
}

export function createImageElement(
  init: CreateImageElementInit = {}
): BaseElement {
  const printElementType: ElementTypeRef = {
    tid: init.tid ?? init.printElementType?.tid ?? IMAGE_DEFAULT_TYPE_DEF.tid,
    type: 'image',
    title: init.printElementType?.title ?? IMAGE_DEFAULT_TYPE_DEF.title,
    ...(init.printElementType ?? {}),
  }
  return createBaseElement({
    tid: printElementType.tid ?? IMAGE_DEFAULT_TYPE_DEF.tid!,
    printElementType,
    options: { ...IMAGE_DEFAULT_OPTIONS, ...(init.options ?? {}) },
    ...(init.id !== undefined ? { id: init.id } : {}),
    ...(init.templateId !== undefined ? { templateId: init.templateId } : {}),
  })
}

/**
 * Resolve image src: templateData[field] → options.src → printElementType.getData().
 * (Pure data — P15.2 renderer will call this and write to <img> via .attr().)
 */
export function resolveImageSrc(
  options: Record<string, unknown>,
  printElementType: ElementTypeRef,
  templateData?: Record<string, unknown>
): string {
  const field = (options.field as string | undefined) ?? printElementType.field
  if (templateData) {
    const v = field ? (resolveField(templateData, field, '') as string) : ''
    if (v) return v
  }
  if (typeof options.src === 'string') return options.src
  const getData = printElementType.getData
  if (typeof getData === 'function') {
    try {
      const ret = (getData as (...args: unknown[]) => unknown)()
      if (typeof ret === 'string') return ret
    } catch (err) {
      console.error('[hiprint] image printElementType.getData threw:', err)
    }
  }
  return ''
}
