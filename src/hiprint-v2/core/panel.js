/**
 * panel.js — PrintPanel (V2).
 *
 * V1 source: bundle.js line 10800-12200 (PrintPanel class `pt`, ~1400 行).
 *
 * V2 P8 status: skeleton + 序列化 + element list management.
 *  - DOM 构建 / 拖拽 / 快捷键 / paper-info 等复杂 method 标 TODO,推 P8b/P8c 续做
 *  - 序列化 (getPanelEntity / getJson) 完整迁移
 *
 * Invariants:
 *  - V1 panel 必须保留 ≥ 1 个 (deletePanel length=1 拒绝, 已在 PrintTemplate.deletePanel)
 *  - paperHeader/paperFooter setValue isNaN 守卫
 *  - clear() 清元素 + designTarget DOM + 解绑事件
 *  - destroy 后 panel 引用清空
 */

import { createPrintElementByType } from './etypes/index.js'
import { safeNumber } from '@hiprint-v2/internal'

/**
 * @typedef {object} PrintPanelOptions
 * @property {number} index  panel index (0-based)
 * @property {string} name  display name (e.g., "P1")
 * @property {number} width  in mm
 * @property {number} height  in mm
 * @property {number} [paperHeader]  page header height in pt
 * @property {number} [paperFooter]  page footer position in pt
 * @property {string} [paperType]  named paper type (A4/A5/...)
 * @property {Array<object>} [printElements]  serialized element list
 * @property {number} [paperNumberLeft]
 * @property {number} [paperNumberTop]
 * @property {Array} [guideLines]
 * @property {object} [watermarkOptions]
 * @property {object} [printMarginOptions]
 * @property {object} [gridOptions]
 */

export class PrintPanel {
  /**
   * @param {PrintPanelOptions} options
   * @param {string} [templateId]  parent template id
   */
  constructor(options, templateId) {
    options = options || {}

    /** @type {number} */
    this.index = options.index || 0
    /** @type {string} */
    this.name = options.name || String(this.index + 1)
    /** @type {number} mm */
    this.width = options.width || 210
    /** @type {number} mm */
    this.height = options.height || 297
    /** @type {number} pt — header bottom edge */
    this.paperHeader = safeNumber(options.paperHeader, { min: 0, fallback: 10 })
    /** @type {number} pt — footer top edge */
    this.paperFooter = safeNumber(options.paperFooter, { min: 0, fallback: 780 })
    /** @type {string} */
    this.paperType = options.paperType
    /** @type {number} */
    this.paperNumberLeft = options.paperNumberLeft || 0
    /** @type {number} */
    this.paperNumberTop = options.paperNumberTop || 0
    /** @type {Array} */
    this.guideLines = options.guideLines || []
    /** @type {object} */
    this.watermarkOptions = options.watermarkOptions || {}
    /** @type {object} */
    this.printMarginOptions = options.printMarginOptions || {}
    /** @type {object} */
    this.gridOptions = options.gridOptions || {}
    /** @type {string|undefined} */
    this.fontFamily = options.fontFamily
    /** @type {string|undefined} 'landscape' / 'portrait' */
    this.orient = options.orient
    /** @type {number} 1-360 */
    this.rotate = options.rotate || 0
    /** @type {number} */
    this.scale = options.scale || 1

    /** @type {string} parent template id */
    this.templateId = templateId

    /** @type {Array<import('./print-element-entity.js').BasePrintElement>} */
    this.printElements = []

    /** @type {jQuery|undefined} */
    this.target = undefined

    /** @type {boolean} */
    this._destroyed = false

    // Initialize elements from serialized list
    if (Array.isArray(options.printElements) && options.printElements.length > 0) {
      this.initPrintElements(options.printElements)
    }
  }

  /**
   * Initialize element list from serialized data.
   *
   * @param {Array<object>} serialized  array of { options, printElementType }
   */
  initPrintElements(serialized) {
    this.printElements = []
    if (!Array.isArray(serialized)) return
    serialized.forEach((el) => {
      try {
        if (!el || !el.printElementType) return
        const instance = createPrintElementByType(el.printElementType, el.options || {})
        instance.setTemplateId(this.templateId)
        instance.setPanel(this)
        this.printElements.push(instance)
      } catch (err) {
        console.error('[hiprint] PrintPanel.initPrintElements: skip element due to error:', err)
      }
    })
  }

  /**
   * Add a new element to the panel.
   *
   * @param {object} printElementType
   * @param {object} options
   * @returns {import('./print-element-entity.js').BasePrintElement}
   */
  addPrintElement(printElementType, options) {
    const el = createPrintElementByType(printElementType, options || {})
    el.setTemplateId(this.templateId)
    el.setPanel(this)
    this.printElements.push(el)
    return el
  }

  /**
   * Remove an element by reference or id.
   *
   * @param {string|import('./print-element-entity.js').BasePrintElement} ref
   */
  deletePrintElement(ref) {
    const id = typeof ref === 'string' ? ref : ref && ref.id
    const idx = this.printElements.findIndex((el) => el.id === id)
    if (idx >= 0) {
      const el = this.printElements[idx]
      if (typeof el.destroy === 'function') el.destroy()
      this.printElements.splice(idx, 1)
    }
  }

  /**
   * Find element by tid (first match) or name.
   *
   * @param {string} tid
   * @returns {import('./print-element-entity.js').BasePrintElement|undefined}
   */
  getElementByTid(tid) {
    return this.printElements.find(
      (el) => el.printElementType && el.printElementType.tid === tid
    )
  }

  getElementByName(name) {
    return this.printElements.find((el) => el.options && el.options.name === name)
  }

  /**
   * Update paper size + paperHeader/paperFooter.
   * P8b TODO: actual DOM resize, ruler / paper-number reposition.
   *
   * @param {string} [paperType]  named paper type or undefined for custom w/h
   * @param {number} [width]  mm
   * @param {number} [height]  mm
   * @param {boolean} [_isRotate]  internal flag from rotatePaper()
   */
  resize(paperType, width, height, _isRotate) {
    if (paperType) this.paperType = paperType
    if (width != null) {
      const w = safeNumber(width, { min: 1, fallback: this.width })
      this.width = w
    }
    if (height != null) {
      const h = safeNumber(height, { min: 1, fallback: this.height })
      this.height = h
    }
    // P8b: re-apply CSS to this.target / designPaper
  }

  /**
   * Rotate paper (swap width/height).
   */
  rotatePaper() {
    const tmp = this.width
    this.width = this.height
    this.height = tmp
    this.rotate = (this.rotate + 90) % 360
  }

  /**
   * Serialize panel state to JSON-compatible entity.
   *
   * @param {boolean} [includeTid=false]  if true, embed printElementType id ref;
   *   otherwise inline printElementType properties.
   * @returns {object}  panel entity (see PrintPanelOptions)
   */
  getPanelEntity(includeTid) {
    return {
      index: this.index,
      name: this.name || this.index + 1,
      width: this.width,
      height: this.height,
      paperType: this.paperType,
      paperHeader: this.paperHeader,
      paperFooter: this.paperFooter,
      paperNumberLeft: this.paperNumberLeft,
      paperNumberTop: this.paperNumberTop,
      guideLines: (this.guideLines || []).slice(),
      watermarkOptions: this.watermarkOptions,
      printMarginOptions: this.printMarginOptions,
      gridOptions: this.gridOptions,
      fontFamily: this.fontFamily,
      orient: this.orient,
      rotate: this.rotate,
      scale: this.scale,
      printElements: this.printElements.map((el) => ({
        options: { ...el.options },
        printElementType: includeTid
          ? { tid: el.printElementType.tid, type: el.printElementType.type }
          : { ...el.printElementType },
      })),
    }
  }

  /**
   * Collect all unique field names referenced by elements in this panel.
   *
   * @returns {string[]}
   */
  getFieldsInPanel() {
    const fields = new Set()
    this.printElements.forEach((el) => {
      const f = el.getField && el.getField()
      if (f) fields.add(f)
    })
    return Array.from(fields)
  }

  /**
   * Collect testData from each element (for "design preview without templateData").
   *
   * @returns {object}  { fieldName: testValue, ... }
   */
  getTestData() {
    const out = {}
    this.printElements.forEach((el) => {
      const f = el.getField && el.getField()
      if (!f) return
      if (el.options && el.options.testData != null) {
        // Nested field: set last segment
        const parts = f.split('.')
        let target = out
        for (let i = 0; i < parts.length - 1; i++) {
          if (!target[parts[i]]) target[parts[i]] = {}
          target = target[parts[i]]
        }
        target[parts[parts.length - 1]] = el.options.testData
      }
    })
    return out
  }

  /**
   * Clear all elements (designTarget + remove + clear array). Guide-lines also reset.
   */
  clear() {
    this.printElements.forEach((el) => {
      if (el.designTarget && el.designTarget.length) {
        el.designTarget.remove()
      }
    })
    this.printElements = []
    this.guideLines = []
  }

  /**
   * Get the rendered jQuery target (created via design()).
   * P8b TODO: full design() with droppablePaper + paper-number setup.
   */
  getTarget() {
    return this.target
  }

  /**
   * Enable panel (visual selection / accept drag drops).
   * P8b TODO.
   */
  enable() {
    if (this.target) this.target.addClass('hiprint-printPanel-enabled')
  }

  disable() {
    if (this.target) this.target.removeClass('hiprint-printPanel-enabled')
  }

  /**
   * Destroy: clear elements + DOM + break back-refs.
   */
  destroy() {
    if (this._destroyed) return
    this._destroyed = true
    this.clear()
    if (this.target && this.target.length) {
      this.target.off('.hiprint').remove()
    }
    this.target = undefined
    this.templateId = undefined
  }

  // ============ TODO P8b (panel-specific DOM / drag) ============
  //
  // Pending V1 method migration:
  //
  // - design(options) — Build full design DOM, droppablePaper, ruler, paperNumber, watermark
  //   (V1 line 10874-10941)
  // - update(t) — Re-build panel from serialized t (V1 line 10940-10995)
  // - getHtml(...) — Print-time HTML render (V1 line 11200+)
  // - appendDesignPrintElement / removeDesignPrintElement — DOM mounting
  // - bindShortcutKeyEvent — Ctrl+Z/Y, Delete, Arrow keys (V1 line 10985-11050)
  // - droppablePaper — jQuery droppable accept for new element drop (V1 ~11164)
  // - createPaperNumber / resetPaperNumber — paginated paper number rendering
  // - paperHeader/paperFooter setValue isNaN guard (R3 PM-013 invariant)
  //
  // These will be ported when P11 wires V2 entry; until then, panel is data-only.
}
