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
          // Remove all hiprint-namespaced handlers (.hiprint / .hiprint-edit / .hiprint-move)
          this.designTarget.off('.hiprint').off('.hiprint-edit').off('.hiprint-move').remove()
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

  // ============ P9b: Design-time DOM construction (V1 line 742-930) ============

  /**
   * Get the event-bus instance. V1 used global `hinnn.event`; V2 looks at
   * window.hinnn.event when available (P12 bridge sets it).
   *
   * @private
   * @returns {{ trigger:Function, on:Function, off:Function }|undefined}
   */
  _getEventBus() {
    if (typeof window === 'undefined') return undefined
    return window.hinnn && window.hinnn.event ? window.hinnn.event : undefined
  }

  /**
   * Build design-mode jQuery target with click/dblclick handlers (V1 line 742-775).
   *
   * R3 silent #5: click handler differentiates element-list-only-select (passes
   * ev._listOnlySelect) vs real canvas click to avoid duplicate property-panel
   * event triggers. dblclick switches text-class element into edit mode.
   *
   * @param {object} designPaper  parent paper context (carries scale, etc.)
   * @returns {*}  jQuery designTarget (or undefined if window.$ unavailable)
   */
  getDesignTarget(designPaper) {
    if (typeof window === 'undefined' || typeof window.$ !== 'function') {
      // happy-dom / SSR: no jQuery → skeleton-safe noop
      return undefined
    }
    const self = this
    let lastTimeStamp = 0

    const html = this.getHtml(designPaper)
    if (!html || !html.target) return undefined
    this.designTarget = html.target
    this.designPaper = designPaper

    // Click handler (V1 line 744-756) — list-only-select carries flag
    this.designTarget.on('click.hiprint', function (ev) {
      if (ev._listOnlySelect) {
        lastTimeStamp = ev.timeStamp
        ev.stopPropagation()
        return
      }
      if (ev.timeStamp - lastTimeStamp > 500) {
        const bus = self._getEventBus()
        if (bus) {
          bus.trigger(self.getPrintElementSelectEventKey(), { printElement: self })
        }
      }
      lastTimeStamp = ev.timeStamp
    })

    // Dblclick — switch text-type into contenteditable (V1 line 757-774)
    this.designTarget.on('dblclick.hiprint', function () {
      const c = self.designTarget.find('.hiprint-printElement-content')
      if (!c || !c.length) return
      const p = self.designTarget.find('.resize-panel')
      const type = self.printElementType && self.printElementType.type
      const textType = self.options && self.options.textType
      if (type === 'text' && !(textType && textType !== 'text')) {
        self._editing = true
        if (typeof self.designTarget.hidraggable === 'function') {
          self.designTarget.hidraggable('update', { draggable: false })
        }
        c.css('cursor', 'text').addClass('editing')
        self.designTarget.addClass('editing')
        c.on('click.hiprint-edit', function (ev) {
          if (self._editing) ev.stopPropagation()
        })
        c.attr('contenteditable', 'true')
        if (p && p.length) p.css('display', 'none')
        self.selectEnd(c)
      }
    })

    return this.designTarget
  }

  /**
   * Move text cursor to end of contenteditable element (V1 line 776-789).
   *
   * @param {*} el  jQuery element
   */
  selectEnd(el) {
    if (!el || !el[0]) return
    el.focus()
    if (
      typeof window !== 'undefined' &&
      typeof window.getSelection !== 'undefined' &&
      typeof document.createRange !== 'undefined'
    ) {
      const r = document.createRange()
      r.selectNodeContents(el[0])
      r.collapse(false)
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(r)
    } else if (
      typeof document !== 'undefined' &&
      document.body &&
      typeof document.body.createTextRange !== 'undefined'
    ) {
      // IE legacy fallback (V1 still supports)
      const r = document.body.createTextRange()
      r.moveToElementText(el[0])
      r.collapse(false)
      r.select()
    }
  }

  /**
   * Commit contenteditable edits back to options.title / options.testData
   * (V1 line 790-816). Idempotent — exits if not in edit mode.
   *
   * @param {boolean} [clear]  if true, skip event-bus property-refresh trigger
   */
  updateByContent(clear) {
    if (!this._editing) return
    const c = this.designTarget && this.designTarget.find
      ? this.designTarget.find('.hiprint-printElement-content')
      : null
    if (c && c.length) {
      c.css('cursor', '').removeClass('editing').removeAttr('contenteditable')
    }
    if (this.designTarget && this.designTarget.removeClass) {
      this.designTarget.removeClass('editing')
    }

    if (c && c.length) {
      const t = c.text()
      const title = this.options.title
      if (typeof t === 'string' && typeof title === 'string' && t.startsWith(title) && this.options.field) {
        if (t.length > title.length) {
          this.options.testData = t.split('：')[1]
        } else {
          this.options.title = t
          this.options.testData = ''
        }
      } else if (typeof t === 'string') {
        this.options.title = t
      }
      if (typeof this.options.title === 'string') {
        this.options.title = this.options.title.split('：')[0]
      }
    }

    const bus = this._getEventBus()
    if (!clear && bus) {
      bus.trigger(this.getPrintElementSelectEventKey(), { printElement: this })
    }

    safeCall(() => this.updateDesignViewFromOptions(), [], 'BasePrintElement.updateByContent')

    if (bus) {
      bus.trigger('hiprintTemplateDataChanged_' + this.templateId, '编辑修改')
    }
    this._editing = false

    if (this.designTarget && typeof this.designTarget.hidraggable === 'function') {
      const draggable =
        !this.options.positionLocked &&
        (this.options.draggable === undefined || this.options.draggable === true)
      this.designTarget.hidraggable('update', { draggable })
    }
  }

  /**
   * Programmatic "select-from-list" — fires synthetic click flagged with
   * _listOnlySelect so the canvas-click handler skips and only the property
   * panel listens (V1 line 817-848).
   *
   * @param {boolean} [appendSelect]  ctrl/meta multi-select
   */
  selectFromList(appendSelect) {
    if (!this.designTarget || !this.designTarget.length) return
    if (this.designTarget.css && this.designTarget.css('display') === 'none') return
    const append = !!appendSelect

    const $ = typeof window !== 'undefined' ? window.$ : null
    const panelHandle = this.designTarget.children
      ? this.designTarget.children('div[panelindex]')
      : null

    if ($ && $.Event) {
      this.designTarget.triggerHandler(
        $.Event('click', {
          _listOnlySelect: true,
          ctrlKey: append,
          metaKey: append,
        })
      )
    }

    // Fallback: ensure DOM selected class set even if event chain broke
    if (panelHandle && !panelHandle.hasClass('selected')) {
      if (!append) {
        const siblings = this.designTarget.siblings
          ? this.designTarget.siblings().children('div[panelindex]')
          : null
        if (siblings) siblings.removeClass('selected').css({ display: 'none' })
      }
      panelHandle.addClass('selected').css({ display: 'block' })
    }

    // Always trigger property-sync (defense)
    const bus = this._getEventBus()
    if (bus) {
      bus.trigger(this.getPrintElementSelectEventKey(), { printElement: this })
    }
  }

  // ============ P9b: Drag + Resize (V1 line 851-930) ============

  /**
   * Wire jQuery hidraggable + multi-select onDrag handler, plus bind copy +
   * keyboard handlers (V1 line 851-930).
   *
   * @param {*} designTarget  not used in V2 (kept for V1 signature parity)
   * @param {*} designPaper
   */
  design(_designTarget, designPaper) {
    if (!this.designTarget || typeof this.designTarget.hidraggable !== 'function') {
      // happy-dom / no plugin → still call bind helpers so they exit silently
      this.bindCopyEvent(this.designTarget)
      this.bindKeyboardMoveEvent(this.designTarget, designPaper)
      return
    }
    const self = this
    this.designTarget.hidraggable({
      draggable: self.options.positionLocked ? false : self.options.draggable,
      axis: self.options.axis ? self.options.axis : undefined,
      designTarget: self,
      moveUnit: 'pt',
      onDrag: function (_e, i, o) {
        // Multi-select cooperation (V1 line 858-878)
        const elsAll = (self.panel && self.panel.printElements) || []
        const els = elsAll.filter(function (t) {
          if (!t.designTarget || !t.designTarget.children) return false
          const last = t.designTarget.children().last()
          return (
            last.css('display') === 'block' &&
            last.hasClass('selected') &&
            t.printElementType &&
            !String(t.printElementType.type || '').includes('table')
          )
        })
        const isMultiple = els.length > 1
        const notSelected =
          !self.designTarget.children().last().hasClass('selected')
        if (isMultiple) {
          const left = i - self.options.left
          const top = o - self.options.top
          els.forEach(function (t) {
            t.updateSizeAndPositionOptions(
              left + (t.options.getLeft ? t.options.getLeft() : t.options.left),
              top + (t.options.getTop ? t.options.getTop() : t.options.top)
            )
            if (t.options.displayLeft) {
              t.designTarget.css('left', t.options.displayLeft())
            }
            if (t.options.displayTop) {
              t.designTarget.css('top', t.options.displayTop())
            }
          })
          if (notSelected) {
            self.updateSizeAndPositionOptions(i, o)
          }
        } else {
          self.updateSizeAndPositionOptions(i, o)
        }
      },
      getScale: function () {
        return (self.designPaper && self.designPaper.scale) || 1
      },
      onBeforeDrag: function () {
        self.designTarget.focus()
      },
      onStopDrag: function () {
        const bus = self._getEventBus()
        if (bus) {
          bus.trigger('hiprintTemplateDataChanged_' + self.templateId, '移动')
        }
      },
    })

    this.bindCopyEvent(this.designTarget)
    this.bindKeyboardMoveEvent(this.designTarget, designPaper)

    // Initial lock visual state (V1 line 906-928)
    const posLocked = !!this.options.positionLocked
    const sizeLocked = !!this.options.sizeLocked
    if (posLocked || sizeLocked) {
      const $rp = this.designTarget.find('.resize-panel')
      if ($rp && $rp.length) {
        if (posLocked) {
          $rp.addClass('locked')
          if (!$rp.find('.hiprint-lock-badge').length) {
            $rp.append('<div class="hiprint-lock-badge">🔒</div>')
          }
          $rp.find('.del-btn').hide()
        }
        if (sizeLocked || posLocked) {
          $rp.find('.resizebtn').hide()
        }
      } else {
        if (sizeLocked || posLocked) {
          this.designTarget.find('.resizebtn').hide()
          this.designTarget.addClass('size-locked')
        }
        if (posLocked) {
          this.designTarget.addClass('position-locked')
        }
      }
    }
  }

  // ============ P9c: Serialization + Copy/Paste (V1 line 930-1534) ============

  /**
   * Serialize element to JSON-friendly entity. V1 returned a `PrintElementEntity`
   * class; V2 uses plain object for cleanliness.
   *
   * @param {boolean} [withType]  if true, embed full printElementType clone;
   *   otherwise only embed tid (designed → JSON storage path)
   * @returns {{ tid:string, options:object, printElementType?:object }}
   */
  getPrintElementEntity(withType) {
    const opts = { ...this.options }
    // Strip ephemeral function-valued options that pollute JSON
    Object.keys(opts).forEach((k) => {
      if (typeof opts[k] === 'function') delete opts[k]
    })
    if (withType) {
      return {
        tid: undefined,
        options: opts,
        printElementType: this.printElementType ? { ...this.printElementType } : {},
      }
    }
    return {
      tid: this.printElementType && this.printElementType.tid,
      options: opts,
    }
  }

  /**
   * Bind Ctrl+C / Cmd+C copy handler on designTarget (V1 line 1467-1481).
   * Also handles Enter → commit-edit when in editing mode.
   *
   * @param {*} target  jQuery element
   */
  bindCopyEvent(target) {
    if (!target || typeof target.on !== 'function') return
    const self = this
    target.on('keydown.hiprint', function (r) {
      if (self._editing && !r.altKey && r.keyCode === 13) {
        self.updateByContent()
        return
      }
      if ((r.ctrlKey || r.metaKey) && r.keyCode === 67) {
        self.copyJson()
        r.preventDefault()
      }
    })
  }

  /**
   * Copy selected elements (+ this one) to clipboard as JSON. Uses Clipboard
   * API with execCommand fallback. V1 line 1482-1526.
   *
   * @returns {boolean}  true if write was scheduled, false on failure
   */
  copyJson() {
    try {
      const $ = typeof window !== 'undefined' ? window.$ : null
      if (!$) return false
      let copyArea = $('#copyArea')
      if (!copyArea.length) {
        copyArea = $(
          '<textarea id="copyArea" style="position: absolute; left: 0px; top: 0px; opacity: 0"></textarea>'
        )
      }
      $('body').append(copyArea)
      const elsAll = (this.panel && this.panel.printElements) || []
      let copyElements = elsAll.filter((ele) => {
        if (!ele.designTarget || !ele.designTarget.children) return false
        const last = ele.designTarget.children().last()
        return (
          last.css('display') === 'block' &&
          ele.printElementType &&
          !String(ele.printElementType.type || '').includes('table')
        )
      })
      copyElements = copyElements.map((ele) => ({
        options: ele.options,
        printElementType: ele.printElementType,
        id: ele.id,
        templateId: ele.templateId,
      }))
      const json = JSON.stringify(copyElements)
      copyArea.text(json)
      let scheduled = false
      if (
        typeof navigator !== 'undefined' &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === 'function'
      ) {
        navigator.clipboard
          .writeText(json)
          .then(() => {
            console.warn('[hiprint] copyJson success (clipboard API)')
          })
          .catch((err) => {
            // R3 silent: surface NotAllowedError vs SecurityError
            console.warn('[hiprint] copyJson clipboard API failed, fallback to execCommand:', err)
          })
        scheduled = true
      } else if (typeof document !== 'undefined' && document.execCommand) {
        copyArea.css('visibility', 'visible')
        const node = copyArea[0]
        if (node && node.setSelectionRange) {
          node.setSelectionRange(0, (node.value || '').length)
        } else if (copyArea.select) {
          copyArea.select()
        }
        scheduled = document.execCommand('copy')
        copyArea.css('visibility', 'hidden')
      }
      if (this.designTarget && this.designTarget.focus) this.designTarget.focus()
      return scheduled
    } catch (err) {
      console.error('[hiprint] copyJson failed:', err)
      return false
    }
  }

  /**
   * Clone this element. Copies all options into a fresh instance via the
   * printElementType.createPrintElement factory (V1 line 1527-1534).
   *
   * @returns {BasePrintElement|undefined}
   */
  clone() {
    if (
      !this.printElementType ||
      typeof this.printElementType.createPrintElement !== 'function'
    ) {
      return undefined
    }
    const newObj = this.printElementType.createPrintElement()
    Object.keys(this.options).forEach((key) => {
      newObj.options[key] = this.options[key]
    })
    return newObj
  }

  // ============ P9c: Keyboard move + multi-select (V1 line 1552-1660) ============

  /**
   * Bind arrow-key + delete handlers on designTarget. Coordinates with
   * multi-select state (V1 line 1552-1645).
   *
   * Default movingDistance: 1pt unless overridden by window.HiPrintConfig.
   *
   * @param {*} target  jQuery element
   * @param {*} _designPaper
   */
  bindKeyboardMoveEvent(target, _designPaper) {
    if (!target || typeof target.attr !== 'function' || typeof target.on !== 'function') return
    const self = this
    target.attr('tabindex', '1')
    target.on('keydown.hiprint-move', function (r) {
      if (r.target && r.target.tagName === 'INPUT') return
      if (self._editing && !r.altKey) return
      if (
        self.options &&
        (self.options.draggable === false || self.options.positionLocked)
      ) {
        // position-locked: allow only delete/backspace passthrough
        if (r.keyCode !== 8 && r.keyCode !== 46) return
      }

      const bus = self._getEventBus()
      const movingDistance = self._getMovingDistance()
      const elsAll = (self.panel && self.panel.printElements) || []
      const els = elsAll.filter(function (t) {
        if (!t.designTarget || !t.designTarget.children) return false
        const last = t.designTarget.children().last()
        return (
          last.css('display') === 'block' &&
          t.printElementType &&
          !String(t.printElementType.type || '').includes('table')
        )
      })
      const isMultiple = els.length > 1

      switch (r.keyCode) {
        case 8:
        case 46:
          // Delete — defer to template.deletePrintElement via event bus
          if (bus) {
            bus.trigger('hiprintTemplateDeleteElement_' + self.templateId, {
              element: self,
              multi: els,
            })
            bus.trigger('hiprintTemplateDataChanged_' + self.templateId, '删除')
            bus.trigger('clearSettingContainer')
          }
          break
        case 37: // left
          if (isMultiple) {
            els.forEach((t) => t.updatePositionByMultipleSelect(-movingDistance, 0))
          } else {
            const lf = self.options.getLeft ? self.options.getLeft() : self.options.left
            const tp = self.options.getTop ? self.options.getTop() : self.options.top
            self.updateSizeAndPositionOptions(
              lf - movingDistance,
              tp,
              self._currentWidth(),
              self._currentHeight()
            )
            if (self.options.displayLeft) target.css('left', self.options.displayLeft())
          }
          r.preventDefault()
          break
        case 38: // up
          if (isMultiple) {
            els.forEach((t) => t.updatePositionByMultipleSelect(0, -movingDistance))
          } else {
            const lf = self.options.getLeft ? self.options.getLeft() : self.options.left
            const tp = self.options.getTop ? self.options.getTop() : self.options.top
            self.updateSizeAndPositionOptions(
              lf,
              tp - movingDistance,
              self._currentWidth(),
              self._currentHeight()
            )
            if (self.options.displayTop) target.css('top', self.options.displayTop())
          }
          r.preventDefault()
          break
        case 39: // right
          if (isMultiple) {
            els.forEach((t) => t.updatePositionByMultipleSelect(movingDistance, 0))
          } else {
            const lf = self.options.getLeft ? self.options.getLeft() : self.options.left
            const tp = self.options.getTop ? self.options.getTop() : self.options.top
            self.updateSizeAndPositionOptions(
              lf + movingDistance,
              tp,
              self._currentWidth(),
              self._currentHeight()
            )
            if (self.options.displayLeft) target.css('left', self.options.displayLeft())
          }
          r.preventDefault()
          break
        case 40: // down
          if (isMultiple) {
            els.forEach((t) => t.updatePositionByMultipleSelect(0, movingDistance))
          } else {
            const lf = self.options.getLeft ? self.options.getLeft() : self.options.left
            const tp = self.options.getTop ? self.options.getTop() : self.options.top
            self.updateSizeAndPositionOptions(
              lf,
              tp + movingDistance,
              self._currentWidth(),
              self._currentHeight()
            )
            if (self.options.displayTop) target.css('top', self.options.displayTop())
          }
          r.preventDefault()
          break
      }
      if ([37, 38, 39, 40].indexOf(r.keyCode) >= 0 && bus) {
        bus.trigger('hiprintTemplateDataChanged_' + self.templateId, '键盘移动')
      }
    })
  }

  /** @private */
  _getMovingDistance() {
    if (typeof window === 'undefined') return 1
    if (window.HiPrintConfig && window.HiPrintConfig.instance) {
      const v = window.HiPrintConfig.instance.movingDistance
      if (typeof v === 'number' && v > 0) return v
    }
    return 1
  }

  /**
   * Test if this element's designTarget rectangle intersects a target rect.
   * Used by marquee multi-select. (V1 line 1646-1655.)
   *
   * @param {{ target: object }} t  has .target jQuery element with offset/size
   * @returns {boolean}
   */
  inRect(t) {
    if (!this.designTarget || !this.designTarget[0] || !t || !t.target || !t.target[0]) {
      return false
    }
    const $ = typeof window !== 'undefined' ? window.$ : null
    const ptr = (this.designPaper && this.designPaper.scale) || 1
    const x1 = this.designTarget[0].offsetLeft
    const y1 = this.designTarget[0].offsetTop
    const h = this.designTarget[0].offsetHeight
    const w = this.designTarget[0].offsetWidth
    const x2 = x1 + w
    const y2 = y1 + h
    const tNode = t.target[0]
    let ex1 = 0
    let ey1 = 0
    if ($ && $(tNode).position) {
      ex1 = $(tNode).position().left / ptr
      ey1 = $(tNode).position().top / ptr
    } else {
      ex1 = tNode.offsetLeft
      ey1 = tNode.offsetTop
    }
    const ew = tNode.offsetWidth
    const eh = tNode.offsetHeight
    const ex2 = ex1 + ew
    const ey2 = ey1 + eh
    return ex1 < x2 && ex2 > x1 && y1 < ey2 && y2 > ey1
  }

  /**
   * Toggle multipleSelect visual class on designTarget (V1 line 1656-1658).
   *
   * @param {boolean} on
   */
  multipleSelect(on) {
    if (!this.designTarget || !this.designTarget.addClass) return
    if (on) {
      this.designTarget.addClass('multipleSelect')
    } else {
      this.designTarget.removeClass('multipleSelect')
    }
  }

  /**
   * Position update for marquee multi-select (V1 line 1658-1660).
   *
   * V2 note: V2 updateSizeAndPositionOptions enforces all 4 numeric args
   * (PM-013 R3 stricter than V1). We forward current width/height so the
   * call passes validation when only position changes.
   *
   * @param {number} dx
   * @param {number} dy
   */
  updatePositionByMultipleSelect(dx, dy) {
    if (this.options && (this.options.draggable === false || this.options.positionLocked)) return
    const lf = this.options.getLeft ? this.options.getLeft() : this.options.left || 0
    const tp = this.options.getTop ? this.options.getTop() : this.options.top || 0
    const w = this._currentWidth()
    const h = this._currentHeight()
    this.updateSizeAndPositionOptions(lf + dx, tp + dy, w, h)
    if (this.designTarget && this.designTarget.css) {
      if (this.options.displayLeft) this.designTarget.css('left', this.options.displayLeft())
      if (this.options.displayTop) this.designTarget.css('top', this.options.displayTop())
    }
  }

  /** @private */
  _currentWidth() {
    if (this.options && typeof this.options.getWidth === 'function') return this.options.getWidth()
    if (this.options && typeof this.options.width === 'number') return this.options.width
    return 1
  }

  /** @private */
  _currentHeight() {
    if (this.options && typeof this.options.getHeight === 'function') return this.options.getHeight()
    if (this.options && typeof this.options.height === 'number') return this.options.height
    return 1
  }
}
