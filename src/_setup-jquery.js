// hiprint 内部的 jQuery 插件（jquery.hiwprint.js / qrcode.js / watermark.js / hiprint.bundle.js）
// 直接引用全局 jQuery / $，因此必须在加载这些文件之前把 jQuery 挂到 window 上。
// 此模块仅副作用，无导出。
import jQuery from 'jquery'

if (typeof window !== 'undefined' && !window.jQuery) {
  window.jQuery = jQuery
  window.$ = jQuery
}
