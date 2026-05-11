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

    // Step 1: destroy panels (clears DOM + event listeners)
    safeCall(
      () => {
        this.printPanels.forEach((p) => {
          if (p && typeof p.destroy === 'function') p.destroy()
        })
      },
      [],
      'PrintTemplate.destroy: panel teardown'
    )

    // Step 2: clear panels array
    this.printPanels = []

    // Step 3: unregister from global map (only if identity matches)
    this._unregisterFromMap()

    // Step 4: clear template + history refs
    this.template = null
    this.lastJson = null
    this.historyList = []
    this.historyPos = 0

    // Step 5: clear back-refs
    this.editingPanel = undefined
    this.settingContainer = undefined
    this.paginationContainer = undefined
    this.fontList = []
    this.fields = []
    this.onImageChooseClick = undefined

    // Step 6 (TODO P10b): unbind document-level keyboard / clicked handlers
    // (V1 calls hinnn.event.off('hiprintTemplateDataShortcutKey_' + this.id))
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

  // ============ TODO P10b (UI / drag / print / pdf) ============
  //
  // Pending V1 method migration:
  //
  // - design(container, opts) — Build full design DOM, mount to container.
  //   V1 line 12335-12347 + state-modeler R3 _designed idempotency guard.
  // - getHtml(data) / getSimpleHtml(data) — Print-time HTML render.
  // - getHtmlAsync / getSimpleHtmlAsync — Batched async render with destroy abort.
  // - print(data) / print2(data) — Local browser print + socket print.
  // - printByHtml / printByHtml2 — Print arbitrary HTML.
  // - toPdf(data, filename, opts) — jspdf integration with destroy race check (R3 state-modeler).
  // - alignElements / zoom / rotatePaper — Editing operations.
  // - getPaperType / getOrient / getPrintStyle — Page metadata.
  // - update(json) — Replace template.
  // - undo / redo — History.
  //
  // These will be ported in P10b/P10c with full V1 line-by-line migration.
}

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
