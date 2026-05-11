/**
 * ui/property-panel.js — Property panel (V2 adapter).
 *
 * V1 source: there is NO standalone V1 createPropertyPanel function. The right-side
 * property panel is built per-element by BasePrintElement.select() → triggers
 * PrintElementTypeRegistry.instance render of option tabs (font/color/border/...)
 * into the `settingContainer` ref on PrintTemplate. The DOM construction lives
 * across multiple V1 modules (PrintElementOptionItem rendering, see bundle.js
 * ~line 6000-9000 for option-item factories).
 *
 * V2 adapter strategy: provide a minimal control surface around the property
 * panel container so business code can mount/unmount/clear it without reaching
 * into V1 internals.
 *
 * Invariants:
 *  - settingContainer is shared between PrintTemplate and the per-element select()
 *    rendering — clearing it must NOT remove the container element itself, only
 *    its children
 *  - XSS: option labels / select option values use .text() (V1 already does this
 *    via _optionInput / _optionSelect helpers)
 *  - 业务方 reactive data: 应通过 PrintTemplate.update / element.options 改, 不直接
 *    操作 DOM (jquery-vue3.md rule)
 */

/**
 * Create / re-bind the property panel mount container.
 *
 * Used by V2 designer when the right sidebar needs to be set up outside of
 * buildDesigner. Typical V1 / V2 flow is:
 *   1. buildDesigner builds container, passes to PrintTemplate via templateOptions.settingContainer
 *   2. User selects element → BasePrintElement.select() renders options into settingContainer
 *
 * This helper just provides a stable jQuery wrapper around a DOM node so V2
 * consumers can clear / restore visibility without poking V1 internals.
 *
 * @param {HTMLElement|string} mountTarget
 * @param {object} [options]
 * @param {boolean} [options.clearOnCreate=true]
 * @returns {object}  property panel control { el, clear, show, hide, destroy }
 */
export function createPropertyPanel(mountTarget, options) {
  const opts = Object.assign({ clearOnCreate: true }, options || {})

  const el =
    typeof mountTarget === 'string'
      ? typeof document !== 'undefined'
        ? document.querySelector(mountTarget)
        : null
      : mountTarget

  if (!el) {
    console.warn('[hiprint-v2] createPropertyPanel: mount target not found:', mountTarget)
    return undefined
  }

  if (opts.clearOnCreate) {
    while (el.firstChild) el.removeChild(el.firstChild)
  }

  let _destroyed = false

  return {
    /** @type {HTMLElement} the mount container DOM node */
    el,

    /**
     * Clear all child option items. Does NOT remove the container itself.
     */
    clear() {
      if (_destroyed) {
        console.warn('[hiprint-v2] property-panel.clear: already destroyed')
        return
      }
      while (el.firstChild) el.removeChild(el.firstChild)
    },

    /**
     * Show the container.
     */
    show() {
      if (_destroyed) return
      el.style.display = ''
    },

    /**
     * Hide the container (preserves children for re-show).
     */
    hide() {
      if (_destroyed) return
      el.style.display = 'none'
    },

    /**
     * Tear down: clear children + null out internal refs.
     * Caller is responsible for removing the el from DOM if desired.
     */
    destroy() {
      if (_destroyed) return
      _destroyed = true
      while (el.firstChild) el.removeChild(el.firstChild)
    },

    isDestroyed() {
      return _destroyed
    },
  }
}

/**
 * Bind a property panel to a PrintTemplate's settingContainer ref.
 * V2 PrintTemplate already accepts settingContainer in constructor options;
 * this is a convenience helper for late binding.
 *
 * @param {object} template  PrintTemplate-like (V1 or V2)
 * @param {HTMLElement|string} mountTarget
 */
export function bindPropertyPanel(template, mountTarget) {
  if (!template) {
    console.warn('[hiprint-v2] bindPropertyPanel: template is required')
    return undefined
  }
  const el =
    typeof mountTarget === 'string'
      ? typeof document !== 'undefined'
        ? document.querySelector(mountTarget)
        : null
      : mountTarget
  if (!el) {
    console.warn('[hiprint-v2] bindPropertyPanel: mount target not found')
    return undefined
  }
  template.settingContainer = el
  return el
}
