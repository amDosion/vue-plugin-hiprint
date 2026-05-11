/**
 * print-element-entity.js — BasePrintElement (V2).
 *
 * V1 source: bundle.js line 677-1660 (BasePrintElement class, 60 prototype methods).
 *
 * V2 P9 status (Strangler Fig stage):
 *  - 接口契约 + 核心 getter/setter + 安全 helper (PM-013 R3 numeric coerce)
 *  - 拖拽 / DOM 创建 / event handler 等复杂 method 标 TODO,P9b/P9c 续做
 *  - 子类 (P6 etypes) 可继承本基类 + override `createTarget` / `getData` 等关键方法
 *
 * Invariants (V2 必须保留, see ADR-0010 + .claude/postmortem):
 *  - PM-002 R3: getData reduce ?? "" (nested-field, preserve 0/false/'')
 *  - PM-013 R3: numeric option (width/height/left/top/padding/indent) parseInt + clamp
 *  - R3 B7 default text rendering for text-class elements (subclass override)
 */

import { resolveField, safeNumber, safeCall } from '@hiprint-v2/internal'
import { mm, pt as ptUnit } from '@hiprint-v2/internal'

/**
 * BasePrintElement V2 — abstract base class for print elements.
 *
 * Subclasses (P6) override:
 *  - createTarget(title, data) — return jQuery element
 *  - getData(templateData) — extract field value from data
 *  - getHtml(designPaper) — return print-time DOM { target }
 *  - updateDesignViewFromOptions() — re-render on option change
 *  - getConfigOptions() — returns HiPrintConfig section for this element type
 */
export class BasePrintElement {
  /**
   * @param {object} printElementType  PrintElementType definition (tid/title/type/field/...)
   * @param {object} [options]  element instance options (left/top/width/height/...)
   */
  constructor(printElementType, options) {
    if (!printElementType) {
      throw new Error('BasePrintElement: printElementType is required')
    }
    this.printElementType = printElementType
    this.options = options || {}
    /** @type {string} unique id (V2 uses crypto.randomUUID when available, fallback to ts+random) */
    this.id = this._generateId()
    /** @type {string|undefined} */
    this.templateId = undefined
    /** @type {object|undefined} */
    this.panel = undefined
    /** @type {jQuery|undefined} */
    this.designTarget = undefined
    /** @type {jQuery|undefined} */
    this.designPaper = undefined
    /** @type {boolean} */
    this._editing = false
  }

  /**
   * Generate a unique element id. V1 used HiPrintlib.instance.guid().
   * V2 uses crypto.randomUUID() when available (modern browser + Node 19+),
   * fallback to ts+random for SSR / older runtimes.
   * @private
   */
  _generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
  }

  // ============ Setters (V2 core) ============

  setTemplateId(id) {
    this.templateId = id
  }

  setPanel(panel) {
    this.panel = panel
  }

  // ============ Getters (V2 core) ============

  getField() {
    return this.options.field || this.printElementType.field
  }

  getTitle() {
    return this.printElementType.title
  }

  /**
   * Extract data value from `templateData` using field path. Preserves 0/false/''
   * leaves (PM-002 R3). Falls back to testData / printElementType.getData() if
   * templateData not supplied.
   *
   * Subclasses (image / barcode / qrcode) usually override to adapt fallback chain.
   *
   * @param {object} [templateData]
   * @returns {*}
   */
  getData(templateData) {
    const field = this.getField()
    if (templateData) {
      // PM-002 R3 safe: resolveField preserves 0/false/'', returns '' for missing path
      const value = field ? resolveField(templateData, field, '') : ''
      return value
    }
    return (
      this.options.testData ||
      (typeof this.printElementType.getData === 'function'
        ? this.printElementType.getData()
        : '') ||
      ''
    )
  }

  /**
   * Get the element's formatter function. Uses _evalCap (P2) for cap + safe parse.
   * Subclasses can override to provide different fallback paths.
   * @returns {Function|undefined}
   */
  getFormatter() {
    if (typeof this.options.formatter === 'function') return this.options.formatter
    if (this.options.formatter) {
      // String-form formatter (designed-time eval-capped via P2 internal)
      const { evalCap } = require('@hiprint-v2/internal')
      return evalCap(this.options.formatter, 'options.formatter')
    }
    if (this.printElementType.formatter) {
      return typeof this.printElementType.formatter === 'function'
        ? this.printElementType.formatter
        : null
    }
    return undefined
  }

  /**
   * Get the styler function (returns a CSS-properties object).
   * @returns {Function|undefined}
   */
  getStyler() {
    if (typeof this.options.styler === 'function') return this.options.styler
    if (this.options.styler) {
      const { evalCap } = require('@hiprint-v2/internal')
      return evalCap(this.options.styler, 'options.styler')
    }
    if (this.printElementType.styler) {
      return typeof this.printElementType.styler === 'function'
        ? this.printElementType.styler
        : null
    }
    return undefined
  }

  /**
   * Get the on-image-choose-click callback (for image element option panels).
   * @returns {Function|undefined}
   */
  getOnImageChooseClick() {
    return this.options.onImageChooseClick || this.printElementType.onImageChooseClick
  }

  // ============ Size + Position safe updates (PM-013 R3) ============

  /**
   * Update size and position. Clamps numeric inputs (PM-013 R3) and skips
   * out-of-bounds writes when panel ref is set.
   *
   * @param {number} left
   * @param {number} top
   * @param {number} width
   * @param {number} height
   */
  updateSizeAndPositionOptions(left, top, width, height) {
    // PM-013 R3 numeric coerce: refuse non-numeric writes (parseFloat-safe via safeNumber)
    const lf = safeNumber(left, { min: 0, fallback: NaN })
    const tp = safeNumber(top, { min: 0, fallback: NaN })
    const wd = safeNumber(width, { min: 1, fallback: NaN })
    const ht = safeNumber(height, { min: 1, fallback: NaN })
    if (!isFinite(lf) || !isFinite(tp) || !isFinite(wd) || !isFinite(ht)) {
      // Silently refuse — V1 also early-returns on negative input
      return
    }

    // Out-of-bounds guard (when panel known + template hasn't opted out)
    if (this.panel) {
      const panelW = mm.toPt(this.panel.width)
      const panelH = mm.toPt(this.panel.height)
      if (lf + wd > panelW) return
      if (tp + ht > panelH) return
    }

    if (typeof this.options.setLeft === 'function') this.options.setLeft(lf)
    if (typeof this.options.setTop === 'function') this.options.setTop(tp)
    if (typeof this.options.copyDesignTopFromTop === 'function') {
      this.options.copyDesignTopFromTop()
    }
    if (typeof this.options.setWidth === 'function') this.options.setWidth(wd)
    if (typeof this.options.setHeight === 'function') this.options.setHeight(ht)
  }

  // ============ ShowInPage (multi-page render condition) ============

  /**
   * Determine if this element should render on a given page.
   *
   * V1 line 692-704: showInPage option supports "first" / "last" / "odd" / "even".
   *
   * @param {number} pageIndex  0-based
   * @param {number} totalPages
   * @returns {boolean}
   */
  showInPage(pageIndex, totalPages) {
    const showOpt = this.options.showInPage
    const unShowOpt = this.options.unShowInPage

    if (showOpt) {
      if (showOpt === 'first') return pageIndex === 0
      if (showOpt === 'last') return pageIndex === totalPages - 1
      if (showOpt === 'odd') {
        return (pageIndex !== 0 || unShowOpt !== 'first') && pageIndex % 2 === 0
      }
      if (showOpt === 'even') return pageIndex % 2 === 1
    }
    // Default: show unless explicitly suppressed on first/last
    return (
      (pageIndex !== 0 || unShowOpt !== 'first') &&
      (pageIndex !== totalPages - 1 || unShowOpt !== 'last')
    )
  }

  // ============ Event hook (V2 cleaner than V1 direct hinnn.event ref) ============

  /**
   * Get event-bus key for "this element selected" event.
   * @returns {string}
   */
  getPrintElementSelectEventKey() {
    return 'PrintElementSelectEventKey_' + this.templateId
  }

  // ============ Abstract / overridable (subclasses MUST implement) ============

  /**
   * Create the design-mode DOM target.
   * V2 P6 subclasses (text/image/barcode/qrcode/long-text/html/hline/vline/rect/oval)
   * override this to return their type-specific jQuery container.
   *
   * @param {string} title
   * @param {*} data
   * @returns {jQuery}
   */
  createTarget(_title, _data) {
    throw new Error(
      '[hiprint] BasePrintElement.createTarget must be overridden by subclass (' +
        this.printElementType.type +
        ')'
    )
  }

  /**
   * Render print-time HTML for a paper. Subclasses produce { target: jQuery, ... }.
   *
   * @param {*} designPaper
   * @returns {object}  { target: jQuery, ...extras }
   */
  getHtml(_designPaper) {
    throw new Error(
      '[hiprint] BasePrintElement.getHtml must be overridden by subclass (' +
        this.printElementType.type +
        ')'
    )
  }

  /**
   * Re-render design view from current options (called on option change in property panel).
   * Default: no-op (subclasses override).
   */
  updateDesignViewFromOptions() {
    /* default no-op */
  }

  /**
   * Get HiPrintConfig section for this element type. Subclasses return
   * `HiPrintConfig.instance[type]`.
   * @returns {object}
   */
  getConfigOptions() {
    return {}
  }

  // ============ Lifecycle (P9b/P9c TODO) ============

  /**
   * Detach + cleanup DOM + event handlers. Called when panel.clear() or element delete.
   * Default V2 impl removes designTarget + breaks back-refs.
   */
  destroy() {
    safeCall(
      () => {
        if (this.designTarget && this.designTarget.length) {
          this.designTarget.off('.hiprint').remove()
        }
      },
      [],
      'BasePrintElement.destroy'
    )
    this.designTarget = undefined
    this.designPaper = undefined
    this.panel = undefined
    this._editing = false
  }

  // ============ TODO P9b/P9c (continue when scheduled) ============
  //
  // The following V1 methods are pending V2 migration:
  //
  // P9b — DOM/design (line 692-1100):
  //   - getProxyTarget / SetProxyTargetOption
  //   - initSizeByHtml / updateTargetSize / updateTargetWidth
  //   - getDesignTarget (click + dblclick handlers + contenteditable)
  //   - selectEnd / updateByContent / selectFromList
  //   - design (drag handlers, ~80 lines)
  //
  // P9c — Interaction (line 1100-1660):
  //   - getPrintElementEntity / copy / clone (Ctrl+C/V)
  //   - keyboard move (Arrow keys, line 1552-1646)
  //   - inRect / multipleSelect / updatePositionByMultipleSelect
  //   - css / cssElement (style mapping)
  //
  // These are jQuery-heavy DOM operations; will reuse V1 helpers via
  // window.hiprint side-effects until P11 fully wires V2 entry.
}
