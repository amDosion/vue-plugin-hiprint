/**
 * ui/element-list-panel.js — Element list panel factory (V2 adapter).
 *
 * V1 source: bundle.js line 11679-11867 (createElementListPanel as PrintPanel.prototype method)
 *            + line 11868-11941 (refreshElementList).
 *
 * P11 status (adapter): V1 createElementListPanel 内 ~190 行 jQuery DOM 构建 + 拖拽 +
 * a11y 键盘移动 + per-instance namespace event 订阅 (".hiprintElListDrag_<templateId>").
 * V2 暂未独立实现, 因为依赖 V1 PrintPanel 实例的 target / designPaper / printElements
 * (V2 PrintPanel skeleton 还未挂 target jQuery wrapper, 推 P8b).
 *
 * V2 adapter 提供:
 *  - createElementListPanel(panel) — 调 V1 panel 实例的 prototype method
 *  - destroyElementListPanel(panel) — 移除 listPanel DOM + 解绑 namespace 事件
 *
 * Invariants:
 *  - WCAG 2.5.7: header tabindex+role+aria-label + 方向键移动 (V1 line 11772-11799)
 *  - XSS 防护: 全部用 jQuery DOM API + .text() 构建 row (V1 line 11894+)
 *  - per-instance namespace: ".hiprintElListDrag_" + panel.templateId (V1 line 11761)
 *  - panel.destroy 时移除 _elListPanel / _elListToggle (V1 line 12610-12613)
 */

/**
 * Attach an element list panel to a PrintPanel.
 *
 * @param {object} panel  V1 PrintPanel instance (must have prototype.createElementListPanel)
 * @returns {object|undefined}  reference to listPanel jQuery wrapper, or undefined on failure
 */
export function createElementListPanel(panel) {
  if (!panel) {
    console.warn('[hiprint-v2] createElementListPanel: panel is required')
    return undefined
  }
  if (typeof panel.createElementListPanel !== 'function') {
    console.warn(
      '[hiprint-v2] createElementListPanel: panel.createElementListPanel not found.' +
        ' V2 PrintPanel skeleton has no element-list-panel method yet (P8b TODO).' +
        ' Currently delegates to V1 PrintPanel prototype.'
    )
    return undefined
  }

  try {
    panel.createElementListPanel()
    return panel._elListPanel
  } catch (err) {
    console.error('[hiprint-v2] createElementListPanel threw:', err)
    return undefined
  }
}

/**
 * Refresh the list panel rows (rebuild from panel.printElements).
 *
 * @param {object} panel
 */
export function refreshElementList(panel) {
  if (!panel || typeof panel.refreshElementList !== 'function') {
    console.warn('[hiprint-v2] refreshElementList: panel missing refreshElementList method')
    return
  }
  try {
    panel.refreshElementList()
  } catch (err) {
    console.error('[hiprint-v2] refreshElementList threw:', err)
  }
}

/**
 * Tear down the element list panel attached to a PrintPanel.
 * V1 PrintPanel.destroy() already does this internally — this is a manual
 * trigger for cases where the panel itself stays alive but the list panel
 * should be released (e.g., Vue route deactivation).
 *
 * @param {object} panel
 */
export function destroyElementListPanel(panel) {
  if (!panel) return
  try {
    // V1 stores jQuery wrapper refs as _elListPanel / _elListToggle / _elListBody
    if (panel._elListPanel && typeof panel._elListPanel.remove === 'function') {
      panel._elListPanel.remove()
    }
    if (panel._elListToggle && typeof panel._elListToggle.remove === 'function') {
      panel._elListToggle.remove()
    }
    // Unbind drag namespace (V1 uses ".hiprintElListDrag_" + templateId)
    const $ = typeof window !== 'undefined' ? window.$ || window.jQuery : null
    if ($ && panel.templateId) {
      $(document).off('.hiprintElListDrag_' + panel.templateId)
      $(window).off('.hiprintElListDrag_' + panel.templateId)
    }
    panel._elListPanel = null
    panel._elListBody = null
    panel._elListHeader = null
    panel._elListToggle = null
  } catch (err) {
    console.error('[hiprint-v2] destroyElementListPanel threw:', err)
  }
}
