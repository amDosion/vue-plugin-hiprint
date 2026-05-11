/**
 * template/zoom.js — PrintTemplate zoom / rotate / align / paper meta mixin.
 *
 * V1 source: bundle.js line 12473-12489, 12642-12650.
 *
 * Invariants (V2 必须保留):
 *  - PM-003 R3: assertNotDestroyed → silent no-op
 *  - 操作必须 delegate 到 editingPanel; editingPanel undefined 时 silent skip
 *  - setPaper: 接受 named paperType (A4/A5/...) 或 numeric width+height
 */

import { assertNotDestroyed } from '@hiprint-v2/internal'

// Default paper sizes (mm). V1 reads from HiPrintConfig.instance.<name>.
const DEFAULT_PAPER_SIZES = {
  A3: { width: 297, height: 420 },
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
  B3: { width: 353, height: 500 },
  B4: { width: 250, height: 353 },
  B5: { width: 176, height: 250 },
  Letter: { width: 215.9, height: 279.4 },
  Legal: { width: 215.9, height: 355.6 },
}

function _resolvePaperSize(typeName) {
  if (typeof window !== 'undefined' && window.HiPrintConfig && window.HiPrintConfig.instance) {
    const v = window.HiPrintConfig.instance[typeName]
    if (v && typeof v.width === 'number' && typeof v.height === 'number') return v
  }
  return DEFAULT_PAPER_SIZES[typeName]
}

export const zoomMixin = {
  /**
   * Set current panel paper (V1 line 12473-12479).
   *
   * @param {string|number} typeOrWidth  Named paper type OR numeric width
   * @param {number} [height]  Used only if typeOrWidth is numeric
   */
  setPaper(typeOrWidth, height) {
    if (assertNotDestroyed(this, 'setPaper')) return
    if (!this.editingPanel) return
    // Numeric: width + height direct
    if (/^(([1-9][0-9]*)|(([0]\.\d{1,2}|[1-9][0-9]*\.\d{1,2})))$/.test(typeOrWidth)) {
      this.editingPanel.resize(undefined, parseFloat(typeOrWidth), parseFloat(height), false)
      return
    }
    // Named paperType
    const size = _resolvePaperSize(typeOrWidth)
    if (!size) {
      throw new Error('not found pagetype:' + (typeOrWidth || ''))
    }
    this.editingPanel.resize(typeOrWidth, size.width, size.height, false)
  },

  /**
   * Rotate paper (swap width/height) (V1 line 12480-12482).
   */
  rotatePaper() {
    if (assertNotDestroyed(this, 'rotatePaper')) return
    if (this.editingPanel && typeof this.editingPanel.rotatePaper === 'function') {
      this.editingPanel.rotatePaper()
    }
  },

  /**
   * Align selected elements (V1 line 12483-12485).
   *
   * @param {string} type  'left' / 'right' / 'top' / 'bottom' / 'horizontal' / 'vertical'
   */
  alignElements(type) {
    if (assertNotDestroyed(this, 'alignElements')) return
    if (this.editingPanel && typeof this.editingPanel.alignElements === 'function') {
      this.editingPanel.alignElements(type)
    }
  },

  /**
   * Zoom editing panel (V1 line 12486-12488).
   *
   * @param {number} scale  e.g. 1, 1.5, 0.5
   * @param {object} [opts]
   */
  zoom(scale, opts) {
    if (assertNotDestroyed(this, 'zoom')) return
    if (this.editingPanel && typeof this.editingPanel.zoom === 'function') {
      this.editingPanel.zoom(scale, opts)
    }
  },

  /**
   * Get current panel paper type name (V1 line 12642-12644).
   *
   * @param {number} [panelIdx=0]
   * @returns {string|undefined}
   */
  getPaperType(panelIdx) {
    if (assertNotDestroyed(this, 'getPaperType')) return undefined
    const idx = panelIdx == null ? 0 : panelIdx
    return this.printPanels[idx] && this.printPanels[idx].paperType
  },

  /**
   * Get orientation: 1 = portrait, 2 = landscape (V1 line 12645-12647).
   *
   * @param {number} [panelIdx=0]
   * @returns {1|2|undefined}
   */
  getOrient(panelIdx) {
    if (assertNotDestroyed(this, 'getOrient')) return undefined
    const idx = panelIdx == null ? 0 : panelIdx
    const p = this.printPanels[idx]
    if (!p) return undefined
    return p.height > p.width ? 1 : 2
  },

  /**
   * Get print style for given panel (V1 line 12648-12650).
   *
   * @param {number} panelIdx
   * @returns {string|undefined}
   */
  getPrintStyle(panelIdx) {
    if (assertNotDestroyed(this, 'getPrintStyle')) return undefined
    const p = this.printPanels[panelIdx]
    return p && typeof p.getPrintStyle === 'function' ? p.getPrintStyle() : undefined
  },
}
