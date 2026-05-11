/**
 * ui/designer.js — buildDesigner (V2 adapter).
 *
 * V1 source: bundle.js line 14859-15160 (~300 行, function buildDesigner).
 *
 * P11 status (adapter): V1 buildDesigner 内部
 *  - new ct(templateOpts) — V1 PrintTemplate
 *  - hiprintTemplate.design($printTemplateContainer[0], {}) — V1 only, V2 P10b TODO
 *  - it.build($componentContainer[0], opts.componentModule) — V1 PrintElementTypeManager
 *  - buildToolbar(...) — 已经经 V2 adapter wrapped (此文件 dependency)
 *
 * 这些 V1-only 链路在 P10b/P11 真实迁移完成前, 必须 delegate V1.
 * V2 adapter 在 boundary 做:
 *  1. opts.onReady 业务回调走 safeCall (R3 W2)
 *  2. _designed 幂等守卫 — 同一 designer ctrl 重复调用 destroy 是 OK (V1 idempotent)
 *  3. 验证返回 ctrl 含 destroy + getTemplate (R3 W1)
 *  4. PM-005: _designerUid 唯一性 (V1 内部已实现 + 加 V2 自检)
 *
 * Invariants:
 *  - R3 W1: _designerEventNs = '.hiprintDesigner_' + uid (V1 line 14705)
 *  - R3 W1: $(document).on(...) 必须 + namespace (V1 resize handle line 14852-14874)
 *  - PM-005: _designerUid = Date.now() + Math.random()
 *  - state-modeler R3: design() 加 _designed 守卫 + cleanup 旧 container bindings (V1 内部)
 *  - 业务方 destroy 后必须 release hiprintTemplate (V1 line 15143-15151)
 */

import { safeCall } from '@hiprint-v2/internal'

const DESIGNER_ON_XXX_KEYS = ['onReady']

/**
 * Wrap onReady (and future onXxx) callbacks with safeCall.
 *
 * @param {object} options
 * @returns {object}
 */
function wrapBusinessCallbacks(options) {
  if (!options || typeof options !== 'object') return options
  const wrapped = Object.assign({}, options)
  DESIGNER_ON_XXX_KEYS.forEach((key) => {
    const fn = wrapped[key]
    if (typeof fn === 'function') {
      wrapped[key] = function (/* ...args */) {
        return safeCall(fn, Array.prototype.slice.call(arguments), 'buildDesigner:' + key)
      }
    }
  })
  // toolbarOptions 中的 onXxx 已经由 ui/toolbar.js adapter 在 V1 内部调用前 wrap,
  // 不在此重复 (V1 buildDesigner line 15099 → 调本 adapter 经 V1 → V2 toolbar adapter).
  return wrapped
}

/**
 * Resolve V1 hiprint global.
 *
 * @returns {object|undefined}
 */
function resolveV1Hiprint() {
  if (typeof window !== 'undefined' && window.hiprint && typeof window.hiprint.buildDesigner === 'function') {
    return window.hiprint
  }
  if (typeof globalThis !== 'undefined' && globalThis.hiprint && typeof globalThis.hiprint.buildDesigner === 'function') {
    return globalThis.hiprint
  }
  return undefined
}

/**
 * Generate a V2 designer uid (PM-005). Used in diagnostic; V1 internal
 * generates its own _designerUid for actual namespace use.
 *
 * @returns {string}
 */
export function _generateDesignerUid() {
  return (
    Date.now().toString(36) +
    '_' +
    Math.floor(Math.random() * 1679616).toString(36)
  )
}

/**
 * Build a designer (toolbar + left component panel + center canvas + right property panel).
 *
 * @param {HTMLElement|string} container  Mount target
 * @param {object} [options]
 * @param {object} [options.templateOptions]  passed to new PrintTemplate
 * @param {object} [options.toolbarOptions]   passed to buildToolbar
 * @param {string} [options.componentModule='defaultModule']
 * @param {object} [options.componentPanelSlot]
 * @param {boolean} [options.showPagination=false]
 * @param {Function} [options.onReady]  (template, toolbarCtrl) => void
 * @returns {object|undefined}  designer control object
 */
export function buildDesigner(container, options) {
  if (container == null) {
    console.warn('[hiprint-v2] buildDesigner: container is required')
    return undefined
  }

  const v1 = resolveV1Hiprint()
  if (!v1) {
    console.warn(
      '[hiprint-v2] buildDesigner: V1 bundle not loaded (window.hiprint missing).' +
        ' P11 adapter requires V1 bundle.js side-effect.'
    )
    return undefined
  }

  const wrappedOpts = wrapBusinessCallbacks(options || {})

  let ctrl
  try {
    ctrl = v1.buildDesigner(container, wrappedOpts)
  } catch (err) {
    console.error('[hiprint-v2] buildDesigner: V1 buildDesigner threw:', err)
    return undefined
  }

  // Validate returned ctrl shape (R3 W1)
  if (!ctrl) {
    console.warn('[hiprint-v2] buildDesigner: V1 returned undefined')
    return undefined
  }
  if (typeof ctrl.destroy !== 'function') {
    console.warn('[hiprint-v2] buildDesigner: ctrl missing destroy() — memory leak risk')
  }
  if (typeof ctrl.getTemplate !== 'function') {
    console.warn('[hiprint-v2] buildDesigner: ctrl missing getTemplate()')
  }

  // Wrap ctrl.destroy with idempotency guard (state-modeler R3)
  // V1 already calls toolbarCtrl.destroy + hiprintTemplate.destroy, but doesn't
  // track its own _destroyed flag, so a second call would re-throw .empty()
  // on an already-emptied container. We add a one-shot guard at the V2 boundary.
  const originalDestroy = ctrl.destroy
  let _destroyed = false
  ctrl.destroy = function () {
    if (_destroyed) {
      console.warn('[hiprint-v2] designer.destroy already called (idempotent guard)')
      return
    }
    _destroyed = true
    try {
      originalDestroy.call(ctrl)
    } catch (err) {
      console.error('[hiprint-v2] designer.destroy threw:', err)
    }
  }
  ctrl.isDestroyed = function () {
    return _destroyed
  }

  return ctrl
}

/**
 * @internal exported for tests
 */
export const __testing__ = {
  wrapBusinessCallbacks,
  DESIGNER_ON_XXX_KEYS,
  resolveV1Hiprint,
}
