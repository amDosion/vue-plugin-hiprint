/**
 * group.js — PrintElementTypeGroup.
 *
 * V1 source: bundle.js line 10691 (class `ot`).
 *
 * Group 容纳一组 element types, 在 panel 元素列表面板内渲染成一个 expandable
 * section. 业务方通过 setElementTypeGroups / appendElementTypeGroups 注册.
 */

/**
 * @typedef {object} PrintElementTypeGroupOptions
 * @property {string} name  Display name (e.g., "通用文本", "客户信息")
 * @property {Array<object>} printElementTypes  Array of element type definitions
 * @property {boolean} [isDynamicSlot]  true for setPanelSlot-injected dynamic groups
 * @property {string} [emptyTip]  Empty-state hint for dynamic slot
 * @property {string} [icon]  Group icon
 */

/**
 * V1 constructor signature: `new ot(groupName, configs)`.
 * V2 prefers options object pattern but keeps legacy 2-arg form for parity.
 */
export class PrintElementTypeGroup {
  /**
   * @param {string|PrintElementTypeGroupOptions} nameOrOpts
   * @param {Array<object>} [printElementTypes]
   */
  constructor(nameOrOpts, printElementTypes) {
    if (typeof nameOrOpts === 'object' && nameOrOpts !== null && !Array.isArray(nameOrOpts)) {
      // Options-object form
      this.name = nameOrOpts.name
      this.printElementTypes = nameOrOpts.printElementTypes || []
      this.isDynamicSlot = !!nameOrOpts.isDynamicSlot
      this.emptyTip = nameOrOpts.emptyTip
      this.icon = nameOrOpts.icon
    } else {
      // V1 legacy 2-arg form: new PrintElementTypeGroup('name', [...types])
      this.name = nameOrOpts
      this.printElementTypes = printElementTypes || []
    }
  }
}
