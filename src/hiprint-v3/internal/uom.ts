/**
 * uom.ts — Unit of measurement conversions (pt / px / mm).
 *
 * V1: hinnn.pt / hinnn.px / hinnn.mm (bundle.js line 197-237).
 * V3: 与 V2 一致, TS 类型化.
 *
 * 关键: DPI 动态从 DOM 测量 (因为浏览器 zoom / device pixel ratio 影响 1in 的实际像素数).
 * V3 缓存 DPI 在模块作用域 (避免每次转换都创建 DOM element).
 *
 * V1 quirk fixed: 测量元素插 body 后 V1 未 remove (potential leak); V2/V3 修.
 */

let _dpiCache = 0

function getDpi(): number {
  if (_dpiCache) return _dpiCache
  if (typeof document === 'undefined') return 96 // SSR / unit-test fallback
  const el = document.createElement('DIV')
  el.style.cssText =
    'width:1in;height:1in;position:absolute;left:0;top:0;z-index:99;visibility:hidden'
  document.body.appendChild(el)
  _dpiCache = el.offsetHeight || 96 // fallback to 96 if happy-dom returns 0
  document.body.removeChild(el)
  return _dpiCache
}

/** Reset DPI cache (test helper). Not used in production. */
export function _resetDpiCache(): void {
  _dpiCache = 0
}

export interface PtUnit {
  toPx(t: number): number
  toMm(t: number): number
  readonly dpi: number
}

export interface PxUnit {
  toPt(t: number): number
  toMm(t: number): number
  readonly dpi: number
}

export interface MmUnit {
  toPt(t: number): number
  toPx(t: number): number
}

export const pt: PtUnit = {
  toPx(t) {
    return t * (getDpi() / 72)
  },
  toMm(t) {
    return px.toMm(pt.toPx(t))
  },
  get dpi() {
    return getDpi()
  },
}

export const px: PxUnit = {
  toPt(t) {
    return t * (72 / getDpi())
  },
  toMm(t) {
    return Math.round((t / getDpi()) * 25.4 * 100) / 100
  },
  get dpi() {
    return getDpi()
  },
}

export const mm: MmUnit = {
  toPt(t) {
    return (72 / 25.4) * t
  },
  toPx(t) {
    return pt.toPx(mm.toPt(t))
  },
}
