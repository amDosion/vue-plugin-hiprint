/**
 * print-template.js — PrintTemplate (V2 main entry class).
 *
 * V1 source: bundle.js line 12244-13230 (PrintTemplate class `ct`, ~1000 lines,
 * 47 _assertNotDestroyed guards, 24 _safeCall hooks).
 *
 * V2 P10 status: 核心 lifecycle + panels API + serialize.
 *  - design / getHtml / print / toPdf / drag-drop 等 UI 关联 method 标 TODO,P10b/P10c 续做
 *  - 47 _assertNotDestroyed guard 用 assertNotDestroyed helper 集中维护
 *  - destroy 完整 6-step teardown (V1 line 12567-12625)
 *
 * Invariants (V2 必须保留):
 *  - PM-003 R3: destroy 幂等 + 所有公开方法守卫
 *  - PM-004 R3: event-bus.off(key) 清整 key (依赖 createEventBus / V1 hinnn.event)
 *  - PM-005: id 用 crypto.randomUUID()
 *  - state-modeler R3: deletePanel 删 editingPanel 后必须 re-select
 *  - state-modeler R3: design() _designed 幂等守卫 (P10b TODO)
 */

import { PrintPanel } from '../core/panel.js'
import { assertNotDestroyed, safeCall } from '@hiprint-v2/internal'
import { designMixin } from './design.js'
import { getHtmlMixin } from './get-html.js'
import { printMixin } from './print.js'
import { pdfMixin } from './pdf.js'
import { updateMixin } from './update.js'
import { historyMixin } from './history.js'
import { zoomMixin } from './zoom.js'

const GLOBAL_TEMPLATE_MAP = '__HIPRINT_V2_TEMPLATE_MAP__'

/**
 * @typedef {object} PrintTemplateOptions
 * @property {object} [template]  Template JSON { panels: [...] }
 * @property {string|HTMLElement} [settingContainer]  Property panel mount target
 * @property {string|HTMLElement} [paginationContainer]  Pagination bar mount target
 * @property {boolean} [history=true]  Enable undo/redo history
 * @property {boolean} [qtDesigner=true]  Generate field aliases for qt designer
 * @property {string} [defaultPanelName]
 * @property {object} [designOptions]
 */

export class PrintTemplate {
  /**
   * @param {PrintTemplateOptions} options
   */
  constructor(options) {
    options = options || {}

    /** @type {string}  unique template id (crypto-safe) */
    this.id = this._generateId()
    /** @type {boolean}  Destroy flag — set ONCE, never reset (PM-003 R3) */
    this._destroyed = false
    /** @type {boolean}  Design state — true after first design() call (state-modeler R3) */
    this._designed = false
    /** @type {jQuery|HTMLElement|undefined}  Set by design() */
    this.container = undefined
    /** @type {object}  History feature toggle (V1 default true) */
    this.history = options.history !== false

    /** @type {object|null}  Original template JSON snapshot */
    this.template = options.template || null
    /** @type {object|null} */
    this.lastJson = options.template ? JSON.parse(JSON.stringify(options.template)) : {}
    /** @type {Array<{ id: string, type: string, json: object }>} */
    this.historyList = [
      {
        id: this._generateId(),
        type: '初始',
        json: this.lastJson,
      },
    ]
    /** @type {number} */
    this.historyPos = 0

    /** @type {string|HTMLElement|undefined} */
    this.settingContainer = options.settingContainer
    /** @type {string|HTMLElement|undefined} */
    this.paginationContainer = options.paginationContainer
    /** @type {string|undefined} */
    this.defaultPanelName = options.defaultPanelName
    /** @type {object} */
    this.designOptions = options.designOptions || {}
    /** @type {boolean} */
    this.qtDesigner = options.qtDesigner !== false

    /** @type {PrintPanel[]} */
    this.printPanels = []
    /** @type {PrintPanel|undefined}  Currently edited panel */
    this.editingPanel = undefined

    /** @type {Array<string>} */
    this.fontList = []
    /** @type {Array<string>} */
    this.fields = []
    /** @type {Function|undefined} */
    this.onImageChooseClick = undefined

    // Initialize panels from template JSON
    const panelList = (options.template && options.template.panels) || []
    panelList.forEach((panelOpts) => {
      this.printPanels.push(new PrintPanel(panelOpts, this.id))
    })

    // Register in global map for cross-template lookup
    this._registerInMap()
  }

  /** @private */
  _generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
  }

  /** @private */
  _registerInMap() {
    const g = typeof globalThis !== 'undefined' ? globalThis : window
    if (!g[GLOBAL_TEMPLATE_MAP]) g[GLOBAL_TEMPLATE_MAP] = {}
    g[GLOBAL_TEMPLATE_MAP][this.id] = this
  }

  /** @private */
  _unregisterFromMap() {
    const g = typeof globalThis !== 'undefined' ? globalThis : window
    if (g[GLOBAL_TEMPLATE_MAP] && g[GLOBAL_TEMPLATE_MAP][this.id] === this) {
      delete g[GLOBAL_TEMPLATE_MAP][this.id]
    }
  }

  // ============ Lifecycle ============

  /**
   * Public getter for destroyed state.
   * @returns {boolean}
   */
  isDestroyed() {
    return !!this._destroyed
  }

  /**
   * Destroy: 6-step teardown matching V1 line 12567-12625.
   * Idempotent (PM-003 R3).
   */
  destroy() {
    if (this._destroyed) return
    this._destroyed = true

    // Step 0: Reset any in-progress global drag state (V1 line 12585-12588)
    safeCall(
      () => {
        if (typeof window !== 'undefined' && window.HiPrintlib && window.HiPrintlib.instance) {
          window.HiPrintlib.instance.draging = false
        }
        if (typeof window !== 'undefined' && window.$) {
          window
            .$('body')
            .removeClass('hiprint-guide-dragging hiprint-el-list-dragging')
        }
      },
      [],
      'PrintTemplate.destroy: drag state reset'
    )

    // Step 1 (was Step 6): Unbind event-bus subscriptions for this template id
    // (V1 line 12594-12601). Must be BEFORE panel teardown so cleanup events
    // don't fire stale handlers.
    safeCall(
      () => {
        const bus =
          typeof window !== 'undefined' && window.hinnn && window.hinnn.event
            ? window.hinnn.event
            : null
        if (bus && typeof bus.off === 'function') {
          bus.off('hiprintTemplateDataChanged_' + this.id)
          bus.off('hiprintTemplateDataShortcutKey_' + this.id)
          bus.off('PrintElementSelectEventKey_' + this.id)
          bus.off('BuildCustomOptionSettingEventKey_' + this.id)
          bus.off('hiprintTemplateDeleteElement_' + this.id)
        }
      },
      [],
      'PrintTemplate.destroy: event-bus off'
    )

    // Step 2: destroy panels (clears DOM + event listeners)
    safeCall(
      () => {
        this.printPanels.forEach((p) => {
          if (p && typeof p.destroy === 'function') p.destroy()
        })
      },
      [],
      'PrintTemplate.destroy: panel teardown'
    )

    // Step 3: clear panels array
    this.printPanels = []

    // Step 4: empty container DOM (preserve host structure)
    safeCall(
      () => {
        if (this.container && typeof this.container.empty === 'function') {
          this.container.empty()
        }
      },
      [],
      'PrintTemplate.destroy: container empty'
    )

    // Step 5: unregister from global map (only if identity matches)
    this._unregisterFromMap()

    // Step 6: clear template + history + back-refs
    this.template = null
    this.lastJson = null
    this.historyList = []
    this.historyPos = 0
    this.editingPanel = undefined
    this.settingContainer = undefined
    this.paginationContainer = undefined
    this.container = undefined
    this.fontList = []
    this.fields = []
    this.onImageChooseClick = undefined
  }

  // ============ Panels API ============

  /**
   * Add a new panel.
   *
   * @param {object|undefined} panelData  panel JSON; if undefined, creates default A4 panel
   * @param {boolean} [select=false]  if true, select the new panel
   * @returns {PrintPanel|undefined}  the new panel, or undefined if destroyed
   */
  addPrintPanel(panelData, select) {
    if (assertNotDestroyed(this, 'addPrintPanel')) return undefined
    const opts = panelData || this._createDefaultPanelOptions()
    if (panelData) opts.index = this.printPanels.length
    const panel = new PrintPanel(opts, this.id)
    this.printPanels.push(panel)
    if (select) this.selectPanel(panel.index)
    return panel
  }

  /** @private */
  _createDefaultPanelOptions() {
    return {
      index: this.printPanels.length,
      name: this.defaultPanelName || String(this.printPanels.length + 1),
      paperType: 'A4',
      width: 210,
      height: 297,
      paperHeader: 0,
      paperFooter: 780,
      printElements: [],
    }
  }

  /**
   * Select panel by index.
   *
   * @param {number} index
   */
  selectPanel(index) {
    if (assertNotDestroyed(this, 'selectPanel')) return
    const clamped = Math.max(0, Math.min(index, this.printPanels.length - 1))
    this.printPanels.forEach((p, i) => {
      if (i === clamped) {
        this.editingPanel = p
        if (typeof p.enable === 'function') p.enable()
      } else {
        if (typeof p.disable === 'function') p.disable()
      }
    })
  }

  /**
   * Delete panel by index. Enforces ≥ 1 panel invariant (V1 line 12407-12414).
   *
   * @param {number} index
   */
  deletePanel(index) {
    if (assertNotDestroyed(this, 'deletePanel')) return
    if (!this.printPanels || this.printPanels.length <= 1) {
      console.warn('[hiprint] deletePanel ignored: must keep at least 1 panel')
      return
    }
    // [state-modeler R3] track if deleting current editingPanel
    const wasEditing = this.editingPanel && this.editingPanel === this.printPanels[index]
    const panel = this.printPanels[index]
    if (panel) {
      panel.clear()
      panel.destroy()
    }
    this.printPanels.splice(index, 1)
    if (wasEditing) {
      this.selectPanel(Math.min(index, this.printPanels.length - 1))
    }
  }

  /**
   * Get panel by index (default 0).
   *
   * @param {number} [index=0]
   * @returns {PrintPanel|undefined}
   */
  getPanel(index) {
    if (assertNotDestroyed(this, 'getPanel')) return undefined
    return this.printPanels[index == null ? 0 : index]
  }

  /**
   * Get total panel count.
   * @returns {number}
   */
  getPaneltotal() {
    if (assertNotDestroyed(this, 'getPaneltotal')) return 0
    return this.printPanels.length
  }

  /**
   * Find element by tid in a specific (or first) panel.
   *
   * @param {string} tid
   * @param {number} [panelIndex=0]
   * @returns {import('../core/print-element-entity.js').BasePrintElement|undefined}
   */
  getElementByTid(tid, panelIndex) {
    if (assertNotDestroyed(this, 'getElementByTid')) return undefined
    const idx = panelIndex == null ? 0 : panelIndex
    const panel = this.printPanels[idx]
    return panel && typeof panel.getElementByTid === 'function'
      ? panel.getElementByTid(tid)
      : undefined
  }

  // ============ Serialization ============

  /**
   * Serialize entire template to JSON.
   *
   * @returns {{ panels: Array<object> }}
   */
  getJson() {
    if (assertNotDestroyed(this, 'getJson')) return { panels: [] }
    return {
      panels: this.printPanels.map((p) => p.getPanelEntity(false)),
    }
  }

  /**
   * Serialize template with tid-only printElementType refs.
   *
   * @returns {{ panels: Array<object> }}
   */
  getJsonTid() {
    if (assertNotDestroyed(this, 'getJsonTid')) return { panels: [] }
    return {
      panels: this.printPanels.map((p) => p.getPanelEntity(true)),
    }
  }

  /**
   * Collect all referenced fields across all panels.
   *
   * @returns {string[]}
   */
  getFieldsInPanel() {
    if (assertNotDestroyed(this, 'getFieldsInPanel')) return []
    const set = new Set()
    this.printPanels.forEach((p) => {
      const fields = p.getFieldsInPanel ? p.getFieldsInPanel() : []
      fields.forEach((f) => set.add(f))
    })
    return Array.from(set)
  }

  /**
   * Compose test data from each panel's element testData.
   *
   * @returns {object}
   */
  getTestData() {
    if (assertNotDestroyed(this, 'getTestData')) return {}
    return this.printPanels.reduce((acc, p) => {
      return { ...acc, ...(p.getTestData ? p.getTestData() : {}) }
    }, {})
  }

  // ============ Font / Fields / Image-click API (V1 line 12862-12878) ============

  setFontList(list) {
    if (assertNotDestroyed(this, 'setFontList')) return
    this.fontList = list || []
  }

  getFontList() {
    if (assertNotDestroyed(this, 'getFontList')) return []
    return this.fontList
  }

  setFields(fields) {
    if (assertNotDestroyed(this, 'setFields')) return
    this.fields = fields || []
  }

  getFields() {
    if (assertNotDestroyed(this, 'getFields')) return []
    return this.fields
  }

  setOnImageChooseClick(fn) {
    if (assertNotDestroyed(this, 'setOnImageChooseClick')) return
    this.onImageChooseClick = fn
  }

  getOnImageChooseClick() {
    if (assertNotDestroyed(this, 'getOnImageChooseClick')) return undefined
    return this.onImageChooseClick
  }

  // ============ P10b/P10c mixed-in methods (see below Object.assign) ============
  //
  // Wired via Object.assign(PrintTemplate.prototype, mixin) at module bottom:
  //  - designMixin    → design, _createContainer
  //  - getHtmlMixin   → getSimpleHtml, getSimpleHtmlAsync, getHtml, getHtmlAsync
  //  - printMixin     → print, print2, printByHtml, printByHtml2, clientIsOpened,
  //                     getPrinterList, _sentToClient, _clientIsOpened, _guid, ...
  //  - pdfMixin       → toPdf, _createTempContainer, _removeTempContainer, _getTempContainer
  //  - updateMixin    → update
  //  - historyMixin   → undo, redo, addHistoryEntry, getHistoryState
  //  - zoomMixin      → setPaper, rotatePaper, alignElements, zoom,
  //                     getPaperType, getOrient, getPrintStyle
}

// ============ Mixin assembly (P10b) ============
//
// Each mixin is a plain object of method-name → function pairs. Object.assign
// copies them to the prototype so `instanceof PrintTemplate` + `tpl.design()`
// still work. This keeps each concern (design/render/print/pdf/update/history/
// zoom) in its own file while keeping the public API on a single class.

Object.assign(
  PrintTemplate.prototype,
  designMixin,
  getHtmlMixin,
  printMixin,
  pdfMixin,
  updateMixin,
  historyMixin,
  zoomMixin
)

/**
 * Lookup template by id from global map.
 *
 * @param {string} id
 * @returns {PrintTemplate|undefined}
 */
export function getTemplateById(id) {
  const g = typeof globalThis !== 'undefined' ? globalThis : window
  return g[GLOBAL_TEMPLATE_MAP] && g[GLOBAL_TEMPLATE_MAP][id]
}

/**
 * Reset global template map (test-only).
 */
export function _resetTemplateMap() {
  const g = typeof globalThis !== 'undefined' ? globalThis : window
  delete g[GLOBAL_TEMPLATE_MAP]
}
