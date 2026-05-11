/**
 * html.js — html element type renderer (by-design HTML rendering).
 *
 * ⚠️ SECURITY by-design: html element 类型的语义就是渲染业务方提供的 HTML 字符串
 * (类似 React `dangerouslySetInnerHTML`). 业务方在 formatter 内必须自行 escape
 * user data. hiprint 内部不做防御 — 这是 by-design 安全权衡, see ADR-0010
 * + docs/integration-guide.md "⚠️ 安全注意事项" 第 1 条.
 *
 * V1 source: bundle.js line 10118-10122 (updateDesignViewFromOptions),
 *            line 10131-10145 (createTarget + updateTargetHtml).
 *
 * Invariants (V2 必须保留):
 *  - html element 才允许 .html() 渲染 formatter 输出
 *  - text element 必须用 .text() (R3 B7)
 */

/**
 * Update html element content from formatter output.
 *
 * @param {jQuery} $container  parent (.hiprint-printElement-html-content)
 * @param {string} htmlString  formatter return value (业务方负责 XSS 安全)
 */
export function updateHtmlTarget($container, htmlString) {
  // [security by-design] business contract: html element accepts pre-escaped HTML.
  // See ADR-0010 + docs/integration-guide.md ⚠️ 安全注意事项 #1.
  $container.html(htmlString == null ? '' : String(htmlString))
}

/**
 * Build a fresh html-element design target with empty content.
 *
 * @returns {jQuery}
 */
export function createHtmlTarget() {
  return window.$(
    '<div class="hiprint-printElement hiprint-printElement-html" style="position: absolute;">' +
      '<div class="hiprint-printElement-html-content" style="height:100%;width:100%"></div>' +
      '</div>'
  )
}
