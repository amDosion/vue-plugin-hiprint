/**
 * group.ts — PrintElementTypeGroup (V3 data layer).
 *
 * V1 source: bundle.js line 10691 (class `ot`).
 * V2 source: src/hiprint-v2/core/group.js.
 *
 * A group is a container of element-type definitions surfaced in the element
 * panel as one expandable section. Business consumers register groups via
 * setElementTypeGroups / appendElementTypeGroups.
 *
 * V3 changes vs V2: TS typed, supports both legacy 2-arg form and options
 * object for backward compat with vue-admin-main.
 */

/**
 * The minimal shape of an element type definition (V3 data layer).
 *
 * V1 stored type definitions as plain objects on the registry — V3 keeps this
 * data-only shape (renderers/components consume it through stores in P15.2 +
 * P17). For the JSON storage shape see `@hiprint-v3/schemas` printElementTypeSchema.
 */
export interface ElementTypeDef {
  /** "moduleName.elementId" — e.g. "defaultModule.text". */
  tid: string
  /** Display title shown in the element panel. */
  title?: string
  /** Renderer type (the discriminator used by createPrintElementByType). */
  type: string
  /** Default field-path binding. */
  field?: string
  /** Display icon (V3 components consume; e.g. 'ep:document'). */
  icon?: string
  /** Test data shown in design-time preview. */
  data?: unknown
  /** Default options merged on element creation (V3 options are pure data). */
  options?: Record<string, unknown>
  /** Default formatter (function or string). */
  formatter?: unknown
  /** Default styler (function or string). */
  styler?: unknown
  /** Custom flag (V1 customText markers). */
  custom?: boolean
  customText?: string
  /** For table elements — columns layout. */
  columns?: unknown
  /** Extra arbitrary fields preserved for V1 superset compatibility. */
  [key: string]: unknown
}

/**
 * The constructor options form. Mirror V2 group.js.
 */
export interface PrintElementTypeGroupOptions {
  /** Display name (e.g., "常规", "电商"). */
  name: string
  printElementTypes?: ElementTypeDef[]
  /** True for setPanelSlot-injected dynamic groups. */
  isDynamicSlot?: boolean
  /** Empty-state hint for dynamic slot. */
  emptyTip?: string
  /** Group icon. */
  icon?: string
}

/**
 * Shape used by the registry. Equivalent to `PrintElementTypeGroup` instance,
 * but also accepts plain-object literals for V1 superset compatibility.
 */
export interface ElementTypeGroupDef {
  name?: string | undefined
  printElementTypes: ElementTypeDef[]
  isDynamicSlot?: boolean
  emptyTip?: string | undefined
  icon?: string | undefined
}

/**
 * PrintElementTypeGroup — runtime constructor used by business consumers.
 *
 * V1 constructor signature: `new ot(groupName, configs)`.
 * V2 + V3 accept either positional args OR an options object.
 */
export class PrintElementTypeGroup implements ElementTypeGroupDef {
  public name: string | undefined
  public printElementTypes: ElementTypeDef[]
  public isDynamicSlot: boolean
  public emptyTip: string | undefined
  public icon: string | undefined

  constructor(
    nameOrOpts: string | PrintElementTypeGroupOptions | null | undefined,
    printElementTypes?: ElementTypeDef[]
  ) {
    if (
      nameOrOpts !== null &&
      typeof nameOrOpts === 'object' &&
      !Array.isArray(nameOrOpts)
    ) {
      // Options-object form
      this.name = nameOrOpts.name
      this.printElementTypes = nameOrOpts.printElementTypes ?? []
      this.isDynamicSlot = !!nameOrOpts.isDynamicSlot
      this.emptyTip = nameOrOpts.emptyTip
      this.icon = nameOrOpts.icon
    } else {
      // V1 legacy 2-arg form
      this.name = typeof nameOrOpts === 'string' ? nameOrOpts : undefined
      this.printElementTypes = printElementTypes ?? []
      this.isDynamicSlot = false
      this.emptyTip = undefined
      this.icon = undefined
    }
  }
}
