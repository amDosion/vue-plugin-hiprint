/**
 * qrcode.ts — QRCode element data factory (V3 pure data).
 *
 * V2 reference: src/hiprint-v2/core/etypes/qrcode.js (jQuery + bwip-js).
 * V3: data only — bwip-js render moves to P15.2.
 *
 * Defaults mirror V1 (bundle.js line 10449-10515).
 */

import { createBaseElement, type BaseElement, type ElementTypeRef } from '../element-base'
import type { ElementTypeDef } from '../group'

/**
 * V1 default qrcode options.
 *
 * Sprint 22d TKT-162: width/height aligned to V1 `qrcode.default`
 * (hiprint.config.js line 2245-2250): `width:80, height:80, qrcodeType:'qrcode'`.
 */
export const QRCODE_DEFAULT_OPTIONS: Record<string, unknown> = {
  width: 80,
  height: 80,
  qrcodeType: 'qrcode',
  qrCodeLevel: 0,
  barColor: '#000000',
}

export const QRCODE_DEFAULT_TYPE_DEF: ElementTypeDef = {
  tid: 'defaultModule.qrcode',
  title: '二维码',
  type: 'qrcode',
  data: 'https://example.com',
  icon: 'ep:grid',
}

export interface CreateQrcodeElementInit {
  tid?: string
  printElementType?: Partial<ElementTypeRef>
  options?: Record<string, unknown>
  id?: string
  templateId?: string
}

export function createQrcodeElement(
  init: CreateQrcodeElementInit = {}
): BaseElement {
  const printElementType: ElementTypeRef = {
    tid: init.tid ?? init.printElementType?.tid ?? QRCODE_DEFAULT_TYPE_DEF.tid,
    type: 'qrcode',
    title: init.printElementType?.title ?? QRCODE_DEFAULT_TYPE_DEF.title,
    ...(init.printElementType ?? {}),
  }
  return createBaseElement({
    tid: printElementType.tid ?? QRCODE_DEFAULT_TYPE_DEF.tid!,
    printElementType,
    options: { ...QRCODE_DEFAULT_OPTIONS, ...(init.options ?? {}) },
    ...(init.id !== undefined ? { id: init.id } : {}),
    ...(init.templateId !== undefined ? { templateId: init.templateId } : {}),
  })
}
