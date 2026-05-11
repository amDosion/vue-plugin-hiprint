/**
 * default-provider.ts — Built-in element-type provider (V3).
 *
 * V1 source: src/hiprint/etypes/default-etyps-provider.js (in main worktree).
 * V2 had no equivalent (default groups were applied via designer wiring).
 *
 * Builds the four standard groups (常规 / 电商 / 辅助 / 实用) and registers
 * them under the `defaultModule` bucket. Business consumers usually call
 * `registerDefaultElementTypes()` once at app boot, then layer their own
 * dynamic fields via `setDynamicFields(moduleName, …)`.
 *
 * NO DOM. NO jQuery. NO Vue component imports.
 */

import {
  PrintElementTypeGroup,
  type ElementTypeDef,
  type ElementTypeGroupDef,
} from './group'
import {
  type PrintElementTypeRegistry,
  getInstance as getRegistryInstance,
} from './registry'

const DEFAULT_MODULE_NAME = 'defaultModule'

// Signature placeholder (V1 default-etyps-provider line 1-8).
const SIGNATURE_IMAGE_PLACEHOLDER_SRC =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 60" preserveAspectRatio="none">' +
      '<rect x="1" y="1" width="158" height="58" fill="none" stroke="#bfbfbf" stroke-width="1" stroke-dasharray="4,3"/>' +
      '<text x="80" y="35" text-anchor="middle" font-size="11" fill="#bfbfbf" font-family="SimSun, sans-serif">点此上传签名</text>' +
      '</svg>'
  )

// Seal placeholder (V1 line 11-16).
const SEAL_PLACEHOLDER_SRC =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">' +
      '<circle cx="40" cy="40" r="36" fill="none" stroke="#d4380d" stroke-width="2" stroke-dasharray="4,3"/>' +
      '<text x="40" y="48" text-anchor="middle" font-size="18" fill="#d4380d" font-weight="bold" font-family="SimSun, sans-serif">印章</text>' +
      '</svg>'
  )

/**
 * Build the "常规" group — text / image / longText / table / html / customText / titleRow.
 */
function buildGeneralGroup(): PrintElementTypeGroup {
  const types: ElementTypeDef[] = [
    {
      tid: 'defaultModule.text',
      title: '文本',
      data: '',
      type: 'text',
      icon: 'ep:document',
    },
    {
      tid: 'defaultModule.image',
      title: '图片',
      data: '',
      type: 'image',
      icon: 'ep:picture',
    },
    {
      tid: 'defaultModule.longText',
      title: '长文',
      data: '155123456789',
      type: 'longText',
      icon: 'ep:tickets',
    },
    {
      tid: 'defaultModule.table',
      field: 'table',
      title: '表格',
      type: 'table',
      icon: 'ep:grid',
      groupFields: ['name'],
      columns: [
        [
          { title: '行号', fixed: true, rowspan: 2, field: 'id', width: 70 },
          { title: '人员信息', colspan: 2 },
          { title: '销售统计', colspan: 2 },
        ],
        [
          { title: '姓名', align: 'left', field: 'name', width: 100 },
          { title: '性别', field: 'gender', width: 100 },
          { title: '销售数量', field: 'count', width: 100 },
          { title: '销售金额', field: 'amount', width: 100 },
        ],
      ],
    },
    {
      tid: 'defaultModule.emptyTable',
      title: '空表格',
      type: 'table',
      icon: 'ep:grid',
      columns: [
        [
          { title: '列 1', field: 'col1', width: 100 },
          { title: '列 2', field: 'col2', width: 100 },
        ],
      ],
    },
    {
      tid: 'defaultModule.html',
      title: 'html',
      type: 'html',
      icon: 'ep:postcard',
    },
    {
      tid: 'defaultModule.customText',
      title: '自定义文本',
      customText: '自定义文本',
      custom: true,
      type: 'text',
      icon: 'ep:edit-pen',
    },
    {
      tid: 'defaultModule.titleRow',
      title: '标题行',
      type: 'text',
      icon: 'ep:minus',
      options: {
        width: 540,
        height: 18,
        fontSize: 14.25,
        fontWeight: 'bold',
        textAlign: 'center',
        backgroundColor: '#F2F6FC',
        textContentVerticalAlign: 'middle',
      },
    },
  ]
  return new PrintElementTypeGroup('常规', types)
}

/**
 * Build the "电商" group — url / price / sku / sender / receiver / orderNo /
 * orderDate / trackingNo / totalAmount.
 */
function buildECommerceGroup(): PrintElementTypeGroup {
  const types: ElementTypeDef[] = [
    {
      tid: 'defaultModule.url',
      title: '链接',
      type: 'text',
      icon: 'ep:link',
      options: {
        width: 180,
        height: 9.75,
        color: '#409eff',
        textDecoration: 'underline',
      },
    },
    {
      tid: 'defaultModule.price',
      title: '价格',
      type: 'text',
      icon: 'ep:money',
      options: {
        width: 80,
        height: 12,
        fontSize: 12,
        fontWeight: 'bold',
        color: '#f56c6c',
        textAlign: 'right',
      },
    },
    {
      tid: 'defaultModule.sku',
      title: 'SKU',
      type: 'text',
      icon: 'ep:price-tag',
      options: { width: 120, height: 9.75, fontSize: 9, color: '#909399' },
    },
    {
      tid: 'defaultModule.senderInfo',
      title: '寄件人信息',
      type: 'longText',
      icon: 'ep:promotion',
      options: { width: 240, height: 42, fontSize: 9, lineHeight: 13.5 },
    },
    {
      tid: 'defaultModule.receiverInfo',
      title: '收件人信息',
      type: 'longText',
      icon: 'ep:user',
      options: {
        width: 240,
        height: 42,
        fontSize: 12,
        fontWeight: 'bold',
        lineHeight: 15,
      },
    },
    {
      tid: 'defaultModule.orderNo',
      title: '订单号',
      field: 'orderNo',
      type: 'text',
      icon: 'ep:tickets',
      options: { width: 200, height: 12, fontSize: 10, testData: 'DD20260509001' },
    },
    {
      tid: 'defaultModule.orderDate',
      title: '下单日期',
      field: 'orderDate',
      type: 'text',
      icon: 'ep:calendar',
      options: { width: 160, height: 12, fontSize: 10, testData: '2026-05-09 14:30' },
    },
    {
      tid: 'defaultModule.trackingNo',
      title: '快递单号',
      field: 'trackingNo',
      type: 'text',
      icon: 'ep:list',
      options: {
        width: 180,
        height: 50,
        textType: 'barcode',
        barcodeType: 'code128',
        testData: 'SF1234567890',
      },
    },
    {
      tid: 'defaultModule.totalAmount',
      title: '金额合计',
      field: 'totalAmount',
      type: 'text',
      icon: 'ep:money',
      options: {
        width: 120,
        height: 14,
        fontSize: 12,
        fontWeight: 'bold',
        color: '#f56c6c',
        textAlign: 'right',
        testData: '¥ 1234.56',
      },
    },
  ]
  return new PrintElementTypeGroup('电商', types)
}

/**
 * Build the "辅助" group — hline / vline / rect / oval / barcode / qrcode.
 */
function buildAuxiliaryGroup(): PrintElementTypeGroup {
  const types: ElementTypeDef[] = [
    {
      tid: 'defaultModule.hline',
      title: '横线',
      type: 'hline',
      icon: 'ep:minus',
    },
    {
      tid: 'defaultModule.vline',
      title: '竖线',
      type: 'vline',
      icon: 'ep:more-filled',
    },
    {
      tid: 'defaultModule.rect',
      title: '矩形',
      type: 'rect',
      icon: 'ep:crop',
    },
    {
      tid: 'defaultModule.oval',
      title: '椭圆',
      type: 'oval',
      icon: 'ep:aim',
    },
    {
      tid: 'defaultModule.barcode',
      title: '条形码',
      field: 'barcode',
      type: 'text',
      icon: 'ep:list',
      options: {
        width: 140,
        height: 35,
        textType: 'barcode',
        hideTitle: true,
        testData: '123456789',
      },
    },
    {
      tid: 'defaultModule.qrcode',
      title: '二维码',
      field: 'qrcode',
      type: 'text',
      icon: 'ep:grid',
      options: {
        width: 50,
        height: 50,
        textType: 'qrcode',
        hideTitle: true,
        testData: 'https://example.com',
      },
    },
  ]
  return new PrintElementTypeGroup('辅助', types)
}

/**
 * Build the "实用" group — currentDate / signature / signatureImage / seal.
 */
function buildUtilityGroup(): PrintElementTypeGroup {
  const types: ElementTypeDef[] = [
    {
      tid: 'defaultModule.currentDate',
      title: '当前日期',
      type: 'text',
      icon: 'ep:calendar',
      options: { width: 100, height: 12, fontSize: 9, textAlign: 'left' },
    },
    {
      tid: 'defaultModule.signature',
      title: '签名',
      field: 'signature',
      type: 'text',
      icon: 'ep:edit-pen',
      options: {
        width: 220,
        height: 32,
        fontSize: 11,
        textAlign: 'left',
        contentPaddingLeft: 4,
        borderBottom: 'solid',
        borderWidth: 0.75,
        borderColor: '#000000',
        textContentVerticalAlign: 'bottom',
      },
    },
    {
      tid: 'defaultModule.signatureImage',
      title: '签名图',
      type: 'image',
      icon: 'ep:edit-pen',
      options: {
        width: 160,
        height: 60,
        src: SIGNATURE_IMAGE_PLACEHOLDER_SRC,
        fit: 'contain',
      },
    },
    {
      tid: 'defaultModule.seal',
      title: '印章',
      type: 'image',
      icon: 'ep:medal',
      options: { width: 80, height: 80, src: SEAL_PLACEHOLDER_SRC, fit: 'contain' },
    },
  ]
  return new PrintElementTypeGroup('实用', types)
}

/**
 * Compose all four built-in groups (data only — no registry side effect).
 */
export function buildDefaultElementTypeGroups(): readonly PrintElementTypeGroup[] {
  return [
    buildGeneralGroup(),
    buildECommerceGroup(),
    buildAuxiliaryGroup(),
    buildUtilityGroup(),
  ]
}

/**
 * Result of `defaultElementTypeProvider()` — mirrors V1 provider's
 * `{ addElementTypes }` shape so business consumers can wire it lazily.
 */
export interface DefaultElementTypeProviderApi {
  addElementTypes(registry?: PrintElementTypeRegistry): void
  groups(): readonly PrintElementTypeGroup[]
}

/**
 * Default element type provider — V3 equivalent of V1
 * `defaultTypeProvider(hiprint)` (bundle.js line 15348). Returns an API that
 * registers the four built-in groups under `defaultModule`.
 */
export function defaultElementTypeProvider(): DefaultElementTypeProviderApi {
  const groups = buildDefaultElementTypeGroups()
  return {
    groups(): readonly PrintElementTypeGroup[] {
      return groups
    },
    addElementTypes(registry?: PrintElementTypeRegistry): void {
      const reg = registry ?? getRegistryInstance()
      reg.unregister(DEFAULT_MODULE_NAME)
      reg.register(DEFAULT_MODULE_NAME, groups as ElementTypeGroupDef[])
    },
  }
}

/**
 * Convenience: register the default groups on the global singleton.
 */
export function registerDefaultElementTypes(
  registry?: PrintElementTypeRegistry
): void {
  defaultElementTypeProvider().addElementTypes(registry)
}

export { DEFAULT_MODULE_NAME }
