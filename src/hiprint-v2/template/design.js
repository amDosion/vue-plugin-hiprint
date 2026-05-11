/**
 * template/design.js — PrintTemplate.design mixin.
 *
 * V1 source: bundle.js line 12335-12347, 12526-12528 (createContainer).
 *
 * Invariants (V2 必须保留):
 *  - state-modeler R3: _designed 幂等守卫 (二次调用必须先 cleanup, 否则 jQuery 事件累积)
 *  - PM-003 R3: assertNotDestroyed → silent no-op
 *  - container 必填: throw helpful error
 */

import { assertNotDestroyed, safeCall } from '@hiprint-v2/internal'

export const designMixin = {
  /**
   * Build full designer DOM into container. Idempotent:
   *  - 二次调用先 unbind 旧 container 内 jQuery 事件 + empty container, 再走流程
   *
   * @param {string|HTMLElement} container  mount target (jQuery selector or DOM node)
   * @param {object} [opts]  passed to panel.design()
   */
  design(container, opts) {
    if (assertNotDestroyed(this, 'design')) return
    opts = opts || {}

    // [state-modeler R3] 二次调用 cleanup
    if (this._designed) {
      console.warn('[hiprint] design() called twice on same template, cleaning prior bind')
      safeCall(
        () => {
          if (this.container && this.container.length) {
            this.container.find('*').off('.hiprint')
            this.container.empty()
          }
        },
        [],
        'PrintTemplate.design re-entry cleanup'
      )
    }
    this._designed = true

    if (this.printPanels.length === 0) {
      const p = this.addPrintPanel(undefined, false)
      // addPrintPanel already pushes to this.printPanels
      if (!p) return
    }

    if (!container) {
      throw new Error('options.container can not be empty')
    }

    this.designOptions = opts
    this._createContainer(container)

    const $ = typeof window !== 'undefined' ? window.$ : null
    const self = this
    this.printPanels.forEach(function (panel, idx) {
      if ($ && self.container && typeof panel.getTarget === 'function') {
        const t = panel.getTarget()
        if (t && t.length) self.container.append(t)
      }
      if (idx > 0 && typeof panel.disable === 'function') panel.disable()
      if (typeof panel.design === 'function') {
        safeCall(() => panel.design(opts), [], 'PrintPanel.design')
      }
    })
    this.selectPanel(0)
  },

  /**
   * Create / wrap the container element. V1 line 12526-12528.
   *
   * @private
   * @param {string|HTMLElement} t
   */
  _createContainer(t) {
    if (assertNotDestroyed(this, '_createContainer')) return
    const $ = typeof window !== 'undefined' ? window.$ : null
    if (!$) {
      // happy-dom / SSR: store ref but no jQuery wrap
      this.container = t
      return
    }
    if (t) {
      this.container = $(t)
      if (this.container && this.container.addClass) {
        this.container.addClass('hiprint-printTemplate')
      }
    } else {
      this.container = $('<div class="hiprint-printTemplate"></div>')
    }
  },
}
