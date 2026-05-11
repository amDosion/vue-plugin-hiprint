/**
 * shape-lines.js — Decoration shape elements (hline / vline / rect / oval).
 *
 * V1 source: bundle.js line 10160-10260 (4 simple element types).
 *
 * 这些元素无 user data, 仅装饰. createTarget 创建固定 DOM 结构, 不需 updateOptions.
 */

import { BasePrintElement } from '../print-element-entity.js'

class _ShapeBase extends BasePrintElement {
  // Shape elements ignore template data
  getData() {
    return ''
  }

  // Property change → re-create only updates CSS via css() (P9b TODO).
  updateDesignViewFromOptions() {
    /* shapes have no inner content to re-render; css update handled by panel */
  }
}

export class HLinePrintElement extends _ShapeBase {
  createTarget() {
    return window.$(
      '<div class="hiprint-printElement hiprint-printElement-hline" style="position:absolute;">' +
        '<div class="hiprint-printElement-content hiprint-printElement-hline-content" style="height:100%;width:100%;border-top:1px solid #000;"></div>' +
        '</div>'
    )
  }
}

export class VLinePrintElement extends _ShapeBase {
  createTarget() {
    return window.$(
      '<div class="hiprint-printElement hiprint-printElement-vline" style="position:absolute;">' +
        '<div class="hiprint-printElement-content hiprint-printElement-vline-content" style="height:100%;width:100%;border-left:1px solid #000;"></div>' +
        '</div>'
    )
  }
}

export class RectPrintElement extends _ShapeBase {
  createTarget() {
    return window.$(
      '<div class="hiprint-printElement hiprint-printElement-rect" style="position:absolute;">' +
        '<div class="hiprint-printElement-content hiprint-printElement-rect-content" style="height:100%;width:100%;border:1px solid #000;"></div>' +
        '</div>'
    )
  }
}

export class OvalPrintElement extends _ShapeBase {
  createTarget() {
    return window.$(
      '<div class="hiprint-printElement hiprint-printElement-oval" style="position:absolute;">' +
        '<div class="hiprint-printElement-content hiprint-printElement-oval-content" style="height:100%;width:100%;border:1px solid #000;border-radius:50%;"></div>' +
        '</div>'
    )
  }
}
