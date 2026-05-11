/**
 * template/update.js — PrintTemplate.update mixin.
 *
 * V1 source: bundle.js line 12747-12790 area.
 *
 * Invariants (V2 必须保留):
 *  - PM-003 R3: assertNotDestroyed → silent no-op
 *  - update 接受新 template JSON, 重建 panels (clear 旧 + new PrintPanel)
 *  - 必须保留 ≥ 1 panel
 *  - 触发 dataChanged event-bus 以便 historyList 同步
 */

import { assertNotDestroyed, safeCall } from '@hiprint-v2/internal'
import { PrintPanel } from '../core/panel.js'

export const updateMixin = {
  /**
   * Replace entire template with new JSON. Existing panels are destroyed first.
   *
   * @param {{ panels: Array<object> }} json
   * @param {number} [selectIndex=0]  panel to select after update
   */
  update(json, selectIndex) {
    if (assertNotDestroyed(this, 'update')) return
    if (!json || !Array.isArray(json.panels)) {
      console.warn('[hiprint] update: invalid json (missing panels[])')
      return
    }

    // Destroy existing panels (clear DOM + event listeners)
    safeCall(
      () => {
        this.printPanels.forEach((p) => {
          if (p && typeof p.destroy === 'function') p.destroy()
        })
      },
      [],
      'PrintTemplate.update: panel teardown'
    )
    this.printPanels = []
    this.editingPanel = undefined

    // Build new panels
    json.panels.forEach((panelOpts) => {
      this.printPanels.push(new PrintPanel(panelOpts, this.id))
    })

    // Snapshot new state
    this.template = json
    this.lastJson = JSON.parse(JSON.stringify(json))

    // Re-mount into container if previously designed
    if (this._designed && this.container) {
      safeCall(
        () => {
          const $ = typeof window !== 'undefined' ? window.$ : null
          if ($ && this.container.empty) this.container.empty()
          const self = this
          this.printPanels.forEach(function (p) {
            if (self.container && typeof p.getTarget === 'function') {
              const t = p.getTarget()
              if (t && t.length && self.container.append) self.container.append(t)
            }
            if (typeof p.design === 'function') p.design(self.designOptions || {})
          })
        },
        [],
        'PrintTemplate.update: re-design'
      )
    }

    const idx =
      typeof selectIndex === 'number'
        ? Math.max(0, Math.min(selectIndex, this.printPanels.length - 1))
        : 0
    if (this.printPanels.length > 0) this.selectPanel(idx)

    // Notify history mixin
    const bus = typeof window !== 'undefined' && window.hinnn && window.hinnn.event
    if (bus) {
      bus.trigger('hiprintTemplateDataChanged_' + this.id, 'update')
    }
  },
}
