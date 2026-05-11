/**
 * barcode.ts — Barcode element data factory (V3 pure data).
 *
 * V2 reference: src/hiprint-v2/core/etypes/barcode.js (jQuery + bwip-js).
 * V3: data only — bwip-js render moves to P15.2.
 *
 * Defaults mirror V1 (bundle.js line 10380-10448).
 */

import { createBaseElement, type BaseElement, type ElementTypeRef } from '../element-base'
import type { ElementTypeDef } from '../group'

export const BARCODE_DEFAULT_OPTIONS: Record<string, unknown> = {
  width: 140,
  height: 35,
  barcodeType: 'code128',
  barColor: '#000000',
  barAutoWidth: true,
}

export const BARCODE_DEFAULT_TYPE_DEF: ElementTypeDef = {
  tid: 'defaultModule.barcode',
  title: '条形码',
  type: 'barcode',
  data: '123456789',
  icon: 'ep:list',
}

export interface CreateBarcodeElementInit {
  tid?: string
  printElementType?: Partial<ElementTypeRef>
  options?: Record<string, unknown>
  id?: string
  templateId?: string
}

export function createBarcodeElement(
  init: CreateBarcodeElementInit = {}
): BaseElement {
  const printElementType: ElementTypeRef = {
    tid: init.tid ?? init.printElementType?.tid ?? BARCODE_DEFAULT_TYPE_DEF.tid,
    type: 'barcode',
    title: init.printElementType?.title ?? BARCODE_DEFAULT_TYPE_DEF.title,
    ...(init.printElementType ?? {}),
  }
  return createBaseElement({
    tid: printElementType.tid ?? BARCODE_DEFAULT_TYPE_DEF.tid!,
    printElementType,
    options: { ...BARCODE_DEFAULT_OPTIONS, ...(init.options ?? {}) },
    ...(init.id !== undefined ? { id: init.id } : {}),
    ...(init.templateId !== undefined ? { templateId: init.templateId } : {}),
  })
}
