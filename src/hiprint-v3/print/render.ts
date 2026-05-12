/**
 * render.ts — jQuery-free native DOM rendering of PrintTemplate JSON.
 *
 * V1 source: bundle.js line 12401-12472 (getSimpleHtml) + per-element renderers
 *            scattered across 9223 (image), 9755-9870 (longText), 9961-10020
 *            (text), 10118-10148 (html), 10160-10260 (shapes), 10380-10515
 *            (barcode/qrcode), 6210-6709 (table).
 * V2 reference (jQuery-coupled, for parity diffing):
 *   - src/hiprint-v2/template/get-html.js
 *   - src/hiprint-v2/renderers/{barcode,qrcode,image,long-text,html}.js
 *   - src/hiprint-v2/core/etypes/{text,image,long-text,table,...}.js
 *
 * V3 strategy:
 *  - All DOM via `document.createElement` + classList + style — NO jQuery.
 *  - bwip-js called via `bwipjs.toSVG()` (string) → parsed via DOMParser →
 *    appended (V2 used `window.$(svgStr)`; V3 uses native).
 *  - Long-text BinarySearch pagination is NOT ported in this pass — V1's
 *    algorithm requires repeated DOM measurement (offsetHeight) which happy-dom
 *    cannot reliably provide; we render the full text into a single block and
 *    let CSS overflow handle it. P10 of the V2 roadmap had the same caveat.
 *  - Table rendering supports the common single-layer and multi-layer header
 *    + footer + grouping subset; advanced rowsColumnsMerge / repeatHeader
 *    options pass through unchanged (consumers can post-process).
 *
 * Locked invariants (ADR-0011):
 *  - #1: `.textContent` is default — never `.innerHTML` with user-controlled data
 *  - #2: `html` element is the ONE by-design exception (innerHTML allowed)
 *  - #5: `resolveField` preserves 0 / false / '' (PM-002 R3)
 *  - #8: per-element render errors caught + console.warn'd; other elements
 *        continue rendering (caller still gets a partial DOM tree)
 */

import bwipjs from 'bwip-js/browser'
import {
  coerceText,
  escapeHtml,
  resolveField,
  safeNumber,
  mm,
  pt,
  compileFormatter,
} from '@hiprint-v3/internal'
import type {
  TemplateJson,
  PanelJson,
  ElementJson,
} from '@hiprint-v3/schemas'

// ============ Public types ============

export interface RenderOptions {
  /** Data to bind into element fields. V1 testData is the design-time fallback. */
  data?: Record<string, unknown> | undefined
  /** Optional total page count for paper numbering (ignored if disabled). */
  pageCount?: number
  /** Optional stylesheet href injected as <link rel="stylesheet"> inside root. */
  stylesheetHref?: string | undefined
}

// ============ Public API ============

/**
 * Render a full PrintTemplate into a detached `<div class="hiprint-printTemplate">`.
 * Does NOT auto-append to document — caller owns insertion / disposal.
 */
export function renderTemplate(
  template: TemplateJson,
  options: RenderOptions = {}
): HTMLDivElement {
  const root = document.createElement('div')
  root.classList.add('hiprint-printTemplate')

  // Inject optional stylesheet (for printable iframe / preview pipelines)
  if (options.stylesheetHref) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.setAttribute('href', options.stylesheetHref)
    root.appendChild(link)
  }

  const panels = Array.isArray(template.panels) ? template.panels : []
  for (let i = 0; i < panels.length; i++) {
    const panel = panels[i]!
    try {
      const panelEl = renderPanel(panel, options)
      root.appendChild(panelEl)
    } catch (err) {
      // Invariant #8: per-panel error must not abort the whole template
      console.warn('[hiprint] render panel ' + i + ' failed:', err)
    }
  }

  return root
}

/**
 * Render a single panel into a `<div class="hiprint-printPanel">` containing
 * a `<div class="hiprint-printPaper">` and its absolutely-positioned elements.
 */
export function renderPanel(
  panel: PanelJson,
  options: RenderOptions = {}
): HTMLDivElement {
  const panelEl = document.createElement('div')
  panelEl.classList.add('hiprint-printPanel')

  const widthMm = safeNumber(panel.width, { min: 0, fallback: 210 })
  const heightMm = safeNumber(panel.height, { min: 0, fallback: 297 })
  const widthPt = mm.toPt(widthMm)
  const heightPt = mm.toPt(heightMm)

  // paper container — absolute pt sizing, mirrors V1 .hiprint-printPaper
  const paper = document.createElement('div')
  paper.classList.add('hiprint-printPaper')
  paper.style.position = 'relative'
  paper.style.width = widthPt + 'pt'
  paper.style.height = heightPt + 'pt'

  if (panel.backgroundColor) {
    paper.style.backgroundColor = String(panel.backgroundColor)
  }
  if (panel.backgroundImage) {
    // [Invariant #1] attribute set via setAttribute → browser escapes; no innerHTML
    paper.style.backgroundImage = "url('" + String(panel.backgroundImage).replace(/'/g, '%27') + "')"
    paper.style.backgroundSize = 'cover'
  }

  // Optional watermark
  const wm = panel.watermarkOptions
  if (wm && wm.text) {
    paper.appendChild(buildWatermark(wm))
  }

  // Print elements
  const elements = Array.isArray(panel.printElements) ? panel.printElements : []
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i]!
    try {
      const node = renderElement(el, panel, options)
      paper.appendChild(node)
    } catch (err) {
      // Invariant #8
      console.warn('[hiprint] render element ' + i + ' failed:', err)
    }
  }

  panelEl.appendChild(paper)
  return panelEl
}

/**
 * Render a single element into its appropriate HTMLElement. Dispatches by
 * `element.printElementType.type`. Unknown types render an empty positioned div.
 */
export function renderElement(
  element: ElementJson,
  panel: PanelJson,
  options: RenderOptions = {}
): HTMLElement {
  const type = element.printElementType?.type
  const opts = (element.options ?? {}) as Record<string, unknown>

  let inner: HTMLElement
  switch (type) {
    case 'text':
      inner = renderTextElement(element, opts, options)
      break
    case 'image':
      inner = renderImageElement(element, opts, options)
      break
    case 'longText':
      inner = renderLongTextElement(element, opts, options)
      break
    case 'barcode':
      inner = renderBarcodeElement(element, opts, options)
      break
    case 'qrcode':
      inner = renderQrcodeElement(element, opts, options)
      break
    case 'html':
      inner = renderHtmlElement(element, opts, options)
      break
    case 'hline':
    case 'vline':
    case 'rect':
    case 'oval':
      inner = renderShapeElement(type, opts)
      break
    case 'table':
      inner = renderTableElement(element, opts, options)
      break
    default:
      inner = document.createElement('div')
      console.warn(
        '[hiprint] render: unknown element type "' + String(type) + '" — empty placeholder rendered'
      )
  }

  // Outer wrapper — always position:absolute with geometry from options.
  // V1 wrapper class pattern: hiprint-printElement + hiprint-printElement-<type>
  const wrapper = document.createElement('div')
  wrapper.classList.add('hiprint-printElement')
  if (typeof type === 'string') {
    wrapper.classList.add('hiprint-printElement-' + type)
  }
  applyGeometry(wrapper, opts)
  applyFont(wrapper, opts, panel)
  applyAlignment(wrapper, opts)
  applyBorder(wrapper, opts)
  applyPadding(wrapper, opts)

  wrapper.appendChild(inner)
  return wrapper
}

// ============ Per-element renderers ============

/** Text element — title-prefix + value, .textContent default (XSS-safe). */
function renderTextElement(
  element: ElementJson,
  opts: Record<string, unknown>,
  options: RenderOptions
): HTMLElement {
  const content = document.createElement('div')
  content.classList.add('hiprint-printElement-text-content')
  content.style.height = '100%'
  content.style.width = '100%'

  const value = getElementValue(element, opts, options)
  const title = coerceText(opts.title)
  const hideTitle = isTrue(opts.hideTitle)
  // TKT-006: accept string-source formatter as well (V1 parity).
  const formatter = compileFormatter(opts.formatter)
  const separator = typeof opts.titleSep === 'string' ? opts.titleSep : '：'

  // Formatter is by-design HTML (Invariant #2); else default text-safe.
  if (formatter) {
    const out = safelyCall(formatter, [title, value, opts, options.data])
    content.innerHTML = out == null ? '' : String(out)
  } else {
    const valueStr = coerceText(value)
    const text = hideTitle || !title ? valueStr : title + separator + valueStr
    content.textContent = text // [Invariant #1]
  }
  return content
}

/** Image element — `<img>` with src from data / options. */
function renderImageElement(
  element: ElementJson,
  opts: Record<string, unknown>,
  options: RenderOptions
): HTMLElement {
  const content = document.createElement('div')
  content.classList.add('hiprint-printElement-image-content')
  content.style.height = '100%'
  content.style.width = '100%'

  const fieldValue = getElementValue(element, opts, options)
  const src =
    (typeof fieldValue === 'string' && fieldValue) ||
    (typeof opts.src === 'string' && opts.src) ||
    ''

  const img = document.createElement('img')
  // [Invariant #1] setAttribute escapes — no string concat into innerHTML
  img.setAttribute('src', String(src))
  img.style.width = '100%'
  img.style.height = '100%'
  if (typeof opts.fit === 'string') {
    img.style.objectFit = String(opts.fit)
  }
  if (opts.borderRadius != null) {
    img.style.borderRadius = safeNumber(opts.borderRadius, { min: 0 }) + 'pt'
  }
  content.appendChild(img)
  return content
}

/** longText — text-safe single block. Pagination split deferred to future pass. */
function renderLongTextElement(
  element: ElementJson,
  opts: Record<string, unknown>,
  options: RenderOptions
): HTMLElement {
  const content = document.createElement('div')
  content.classList.add('hiprint-printElement-longText-content')
  content.style.height = '100%'
  content.style.width = '100%'

  const value = getElementValue(element, opts, options)
  const title = coerceText(opts.title)
  const hideTitle = isTrue(opts.hideTitle)
  // TKT-006: accept string-source formatter as well (V1 parity).
  const formatter = compileFormatter(opts.formatter)
  const separator = '：'

  // Leading indent <span> — V1 R3 C1 fix (numeric clamp)
  const indentPt = safeNumber(opts.longTextIndent, { min: 0 })
  if (indentPt > 0) {
    const indent = document.createElement('span')
    indent.classList.add('long-text-indent')
    indent.style.marginLeft = indentPt + 'pt'
    content.appendChild(indent)
  }

  if (formatter) {
    const out = safelyCall(formatter, [title, value, opts, options.data])
    // by-design HTML for longText with formatter (Invariant #2)
    const span = document.createElement('span')
    span.innerHTML = out == null ? '' : String(out)
    content.appendChild(span)
  } else {
    const valueStr = coerceText(value)
    const text = hideTitle || !title ? valueStr : title + separator + valueStr
    const textNode = document.createTextNode(text) // [Invariant #1]
    content.appendChild(textNode)
  }
  return content
}

/** barcode — bwip-js → SVG string → parse → append. */
function renderBarcodeElement(
  element: ElementJson,
  opts: Record<string, unknown>,
  options: RenderOptions
): HTMLElement {
  const content = document.createElement('div')
  content.classList.add('hiprint-printElement-barcode-content')
  content.style.height = '100%'
  content.style.width = '100%'

  const value = getElementValue(element, opts, options)
  const text =
    (typeof value === 'string' && value) ||
    (typeof opts.testData === 'string' && opts.testData) ||
    (typeof opts.title === 'string' && opts.title) ||
    ''

  try {
    const widthPt = safeNumber(opts.width, { min: 0, fallback: 100 })
    const heightPt = safeNumber(opts.height, { min: 0, fallback: 30 })
    const lineH = safeNumber(opts.lineHeight, {
      fallback: safeNumber(opts.fontSize, { fallback: 10.5 }) * 1.5,
    })
    const hideTitle = isTrue(opts.hideTitle)
    const titleH = !hideTitle ? lineH : 0
    const heightMm = Math.max(0, pt.toMm(heightPt - titleH))
    const widthMm = Math.max(0, pt.toMm(widthPt))
    const barAutoWidth = isTrue(opts.barAutoWidth)

    const svgStr = bwipjs.toSVG({
      bcid: typeof opts.barcodeType === 'string' ? opts.barcodeType : 'code128',
      text: text || '',
      scale: safeNumber(opts.barWidth, { fallback: 1, min: 1 }),
      width: !barAutoWidth ? Math.floor(widthMm) : ('' as unknown as number),
      height: Math.floor(heightMm),
      includetext: !hideTitle,
      textsize: Math.floor(safeNumber(opts.fontSize, { fallback: 10 })),
      barcolor: typeof opts.barColor === 'string' ? opts.barColor : '#000',
    } as Parameters<typeof bwipjs.toSVG>[0])

    const svgEl = parseSvgString(svgStr)
    if (svgEl) {
      svgEl.setAttribute('preserveAspectRatio', 'none slice')
      content.appendChild(svgEl)
    } else {
      // bwipjs returned a non-svg / parse failed
      const fallback = document.createElement('div')
      fallback.textContent = 'Barcode render failed'
      content.appendChild(fallback)
    }
  } catch (err) {
    console.warn('[hiprint] barcode render failed:', err)
    const fallback = document.createElement('div')
    fallback.textContent = 'Barcode render failed'
    content.appendChild(fallback)
  }
  return content
}

/** qrcode — bwip-js → SVG. Title rendered below via .textContent (XSS-safe). */
function renderQrcodeElement(
  element: ElementJson,
  opts: Record<string, unknown>,
  options: RenderOptions
): HTMLElement {
  const content = document.createElement('div')
  content.classList.add('hiprint-printElement-qrcode-content')
  content.style.height = '100%'
  content.style.width = '100%'

  const value = getElementValue(element, opts, options)
  const text =
    (typeof value === 'string' && value) ||
    (typeof opts.testData === 'string' && opts.testData) ||
    (typeof opts.title === 'string' && opts.title) ||
    ''

  try {
    const widthPt = safeNumber(opts.width, { min: 1, fallback: 50 })
    const heightPt = safeNumber(opts.height, { min: 1, fallback: 50 })
    const lineH = safeNumber(opts.lineHeight, {
      fallback: safeNumber(opts.fontSize, { fallback: 10.5 }) * 1.5,
    })
    const hideTitle = isTrue(opts.hideTitle)
    const titleH = !hideTitle ? lineH : 0
    const widthPx = pt.toPx(widthPt)
    const heightPx = pt.toPx(heightPt - titleH)
    const square = Math.max(1, Math.floor(Math.min(widthPx / 2.835, heightPx / 2.835)))
    const ecLevel = (['M', 'L', 'H', 'Q'] as const)[
      safeNumber(opts.qrCodeLevel, { min: 0, max: 3, fallback: 0 })
    ]

    const svgStr = bwipjs.toSVG({
      bcid: typeof opts.qrcodeType === 'string' ? opts.qrcodeType : 'qrcode',
      text: text || '',
      scale: 1,
      width: square,
      height: square,
      includetext: false,
      eclevel: ecLevel,
      barcolor: typeof opts.barColor === 'string' ? opts.barColor : '#000',
    } as Parameters<typeof bwipjs.toSVG>[0])

    const svgEl = parseSvgString(svgStr)
    if (svgEl) content.appendChild(svgEl)

    if (!hideTitle && text) {
      const titleDiv = document.createElement('div')
      titleDiv.classList.add('hiprint-printElement-qrcode-content-title')
      const fontSize = opts.fontSize != null ? String(opts.fontSize) + 'pt' : '9pt'
      const align = typeof opts.textAlign === 'string' ? opts.textAlign : 'center'
      titleDiv.style.textAlign = align
      titleDiv.style.fontSize = fontSize
      titleDiv.style.lineHeight = '1.5'
      // [Invariant #1] qrcode title is user data; .textContent escape
      titleDiv.textContent = coerceText(text)
      content.appendChild(titleDiv)
    }
  } catch (err) {
    console.warn('[hiprint] qrcode render failed:', err)
    const fallback = document.createElement('div')
    fallback.textContent = 'QRCode render failed'
    content.appendChild(fallback)
  }
  return content
}

/**
 * html element — by-design HTML render (Invariant #2). Business owns escaping.
 * See ADR-0010 docs/integration-guide.md ⚠️ 安全注意事项 #1.
 */
function renderHtmlElement(
  element: ElementJson,
  opts: Record<string, unknown>,
  options: RenderOptions
): HTMLElement {
  const content = document.createElement('div')
  content.classList.add('hiprint-printElement-html-content')
  content.style.height = '100%'
  content.style.width = '100%'

  // TKT-006: accept string-source formatter as well (V1 parity).
  const formatter = compileFormatter(opts.formatter)
  const value = getElementValue(element, opts, options)
  let html: string
  let mode: 'html' | 'text' = 'html'
  if (formatter) {
    const out = safelyCall(formatter, [opts.title, value, opts, options.data])
    html = out == null ? '' : String(out)
  } else if (typeof opts.content === 'string') {
    html = opts.content
  } else if (typeof value === 'string') {
    // TKT-007: field-bound runtime data is the NEW V3 path. V1 never had this
    // surface; it was introduced in Sprint 22a. Escape by default; require
    // explicit opt-in (options.escape === false OR options.html === true) to
    // keep V1's by-design HTML behavior.
    html = value
    const optIn = opts.escape === false || opts.html === true
    if (!optIn) mode = 'text'
  } else {
    html = ''
  }
  // [Invariant #2] by-design HTML for formatter/content/opt-in field paths;
  // textContent for default field-binding (TKT-007).
  if (mode === 'html') {
    content.innerHTML = html
  } else {
    content.textContent = html
  }
  return content
}

/** hline / vline / rect / oval — pure CSS shapes, no data binding. */
function renderShapeElement(
  type: 'hline' | 'vline' | 'rect' | 'oval',
  opts: Record<string, unknown>
): HTMLElement {
  const shape = document.createElement('div')
  shape.classList.add('hiprint-printElement-' + type + '-content')
  shape.style.width = '100%'
  shape.style.height = '100%'
  shape.style.boxSizing = 'border-box'

  const color = typeof opts.borderColor === 'string' ? opts.borderColor : '#000'
  const width = safeNumber(opts.borderWidth, { fallback: 1, min: 0 })
  if (type === 'hline') {
    shape.style.borderTop = width + 'pt solid ' + color
  } else if (type === 'vline') {
    shape.style.borderLeft = width + 'pt solid ' + color
  } else if (type === 'rect') {
    shape.style.border = width + 'pt solid ' + color
    // TKT-001 — apply optional V3-exposed borderRadius + V1 backgroundColor.
    if (opts.borderRadius != null) {
      const r = safeNumber(opts.borderRadius, { fallback: 0, min: 0 })
      if (r > 0) shape.style.borderRadius = r + 'pt'
    }
    if (typeof opts.backgroundColor === 'string') {
      shape.style.backgroundColor = opts.backgroundColor
    }
  } else if (type === 'oval') {
    shape.style.border = width + 'pt solid ' + color
    shape.style.borderRadius = '50%'
    if (typeof opts.backgroundColor === 'string') {
      shape.style.backgroundColor = opts.backgroundColor
    }
  }
  return shape
}

/** Table — single + multi-layer header + footer + group subset. */
function renderTableElement(
  element: ElementJson,
  opts: Record<string, unknown>,
  options: RenderOptions
): HTMLElement {
  const content = document.createElement('div')
  content.classList.add('hiprint-printElement-table-content')
  content.style.height = '100%'
  content.style.width = '100%'

  const table = document.createElement('table')
  table.style.width = '100%'
  table.style.borderCollapse = 'collapse'

  const columnsRaw = opts.columns as unknown
  if (!Array.isArray(columnsRaw) || columnsRaw.length === 0) {
    content.appendChild(table)
    return content
  }
  // Normalize to Array<Array<col>> — V1 stored either shape.
  const layers: unknown[][] = Array.isArray(columnsRaw[0]) ? (columnsRaw as unknown[][]) : [columnsRaw as unknown[]]
  const leafColumns = (layers[layers.length - 1] ?? []) as Array<Record<string, unknown>>

  // ===== thead (multi-layer support) =====
  const thead = document.createElement('thead')
  for (const layer of layers) {
    const tr = document.createElement('tr')
    for (const col of layer as Array<Record<string, unknown>>) {
      const th = document.createElement('th')
      const colspan = safeNumber(col.colspan, { fallback: 1, min: 1 })
      const rowspan = safeNumber(col.rowspan, { fallback: 1, min: 1 })
      if (colspan > 1) th.setAttribute('colspan', String(colspan))
      if (rowspan > 1) th.setAttribute('rowspan', String(rowspan))
      const halign = typeof col.halign === 'string' ? col.halign : (typeof col.align === 'string' ? col.align : 'center')
      th.style.textAlign = String(halign)
      th.style.border = '0.5pt solid #000'
      th.style.padding = '2pt 4pt'
      // [Invariant #1] header title is user data
      th.textContent = coerceText(col.title)
      tr.appendChild(th)
    }
    thead.appendChild(tr)
  }
  table.appendChild(thead)

  // ===== tbody =====
  const rawData = options.data
  const fieldName = typeof opts.field === 'string' ? opts.field : undefined
  let rows: Array<Record<string, unknown>> = []
  if (fieldName && rawData) {
    const v = resolveField(rawData, fieldName, [])
    if (Array.isArray(v)) rows = v as Array<Record<string, unknown>>
  }
  if (rows.length === 0) {
    // fallback to testData (V1 design-time)
    const td = opts.testData
    if (typeof td === 'string') {
      try {
        const parsed = JSON.parse(td)
        if (Array.isArray(parsed)) rows = parsed
      } catch {
        /* ignore */
      }
    } else if (Array.isArray(td)) {
      rows = td as Array<Record<string, unknown>>
    }
  }

  const tbody = document.createElement('tbody')
  for (const row of rows) {
    const tr = document.createElement('tr')
    for (const col of leafColumns) {
      const td = document.createElement('td')
      const halign = typeof col.halign === 'string' ? col.halign : (typeof col.align === 'string' ? col.align : 'left')
      td.style.textAlign = String(halign)
      td.style.border = '0.5pt solid #000'
      td.style.padding = '2pt 4pt'
      const cellField = typeof col.field === 'string' ? col.field : undefined
      const cellValue = cellField ? resolveField(row, cellField, '') : ''
      // TKT-006: accept string-source formatter as well (V1 parity).
      const formatter = compileFormatter(col.formatter)
      if (formatter) {
        // by-design HTML for cell formatter
        const out = safelyCall(formatter, [cellValue, row, col, options.data])
        td.innerHTML = out == null ? '' : String(out)
      } else {
        td.textContent = coerceText(cellValue)
      }
      tr.appendChild(td)
    }
    tbody.appendChild(tr)
  }
  table.appendChild(tbody)

  // ===== tfoot (gridColumnsFooter) — optional =====
  const footer = opts.gridColumnsFooter
  if (Array.isArray(footer) && footer.length > 0) {
    const tfoot = document.createElement('tfoot')
    for (const footRow of footer as unknown[]) {
      const tr = document.createElement('tr')
      if (Array.isArray(footRow)) {
        for (const cell of footRow as Array<Record<string, unknown>>) {
          const td = document.createElement('td')
          const colspan = safeNumber(cell.colspan, { fallback: 1, min: 1 })
          if (colspan > 1) td.setAttribute('colspan', String(colspan))
          td.style.border = '0.5pt solid #000'
          td.style.padding = '2pt 4pt'
          td.textContent = coerceText(cell.title ?? cell.text)
          tr.appendChild(td)
        }
      }
      tfoot.appendChild(tr)
    }
    table.appendChild(tfoot)
  }

  content.appendChild(table)
  return content
}

// ============ Style appliers ============

function applyGeometry(el: HTMLElement, opts: Record<string, unknown>): void {
  el.style.position = 'absolute'
  const left = safeNumber(opts.left, { fallback: 0 })
  const top = safeNumber(opts.top, { fallback: 0 })
  const width = safeNumber(opts.width, { fallback: 100 })
  const height = safeNumber(opts.height, { fallback: 20 })
  el.style.left = left + 'pt'
  el.style.top = top + 'pt'
  el.style.width = width + 'pt'
  el.style.height = height + 'pt'
  if (opts.zIndex != null) el.style.zIndex = String(safeNumber(opts.zIndex, { fallback: 0 }))
  if (opts.rotate != null) {
    el.style.transform = 'rotate(' + safeNumber(opts.rotate, { fallback: 0 }) + 'deg)'
  }
}

function applyFont(
  el: HTMLElement,
  opts: Record<string, unknown>,
  panel: PanelJson
): void {
  const fontFamily =
    (typeof opts.fontFamily === 'string' && opts.fontFamily) ||
    (typeof panel.fontFamily === 'string' && panel.fontFamily) ||
    null
  if (fontFamily) el.style.fontFamily = String(fontFamily)
  const fontSize = opts.fontSize ?? panel.fontSize
  if (fontSize != null) el.style.fontSize = safeNumber(fontSize, { fallback: 10.5 }) + 'pt'
  if (opts.fontWeight != null) el.style.fontWeight = String(opts.fontWeight)
  if (typeof opts.fontStyle === 'string') el.style.fontStyle = opts.fontStyle
  if (typeof opts.textDecoration === 'string') el.style.textDecoration = opts.textDecoration
  if (typeof opts.color === 'string') el.style.color = opts.color
  if (typeof opts.textColor === 'string') el.style.color = opts.textColor
  if (typeof opts.backgroundColor === 'string') el.style.backgroundColor = opts.backgroundColor
  if (opts.lineHeight != null) el.style.lineHeight = String(opts.lineHeight)
  if (opts.letterSpacing != null) {
    el.style.letterSpacing = safeNumber(opts.letterSpacing, { fallback: 0 }) + 'pt'
  }
}

function applyAlignment(el: HTMLElement, opts: Record<string, unknown>): void {
  const horizontal =
    (typeof opts.textAlign === 'string' && opts.textAlign) ||
    (typeof opts.align === 'string' && opts.align) ||
    null
  if (horizontal) el.style.textAlign = String(horizontal)
  const vertical =
    (typeof opts.textContentVerticalAlign === 'string' && opts.textContentVerticalAlign) ||
    (typeof opts.vAlign === 'string' && opts.vAlign) ||
    null
  if (vertical) {
    // Map V1 'middle' → CSS 'center' via flex centering
    el.style.display = 'flex'
    if (vertical === 'top') el.style.alignItems = 'flex-start'
    else if (vertical === 'bottom') el.style.alignItems = 'flex-end'
    else el.style.alignItems = 'center'
  }
}

function applyBorder(el: HTMLElement, opts: Record<string, unknown>): void {
  if (typeof opts.borderStyle === 'string' && opts.borderStyle !== 'none') {
    el.style.borderStyle = opts.borderStyle
    el.style.borderWidth = safeNumber(opts.borderWidth, { fallback: 1, min: 0 }) + 'pt'
    if (typeof opts.borderColor === 'string') el.style.borderColor = opts.borderColor
  }
  if (typeof opts.borderTop === 'string') el.style.borderTop = opts.borderTop
  if (typeof opts.borderRight === 'string') el.style.borderRight = opts.borderRight
  if (typeof opts.borderBottom === 'string') el.style.borderBottom = opts.borderBottom
  if (typeof opts.borderLeft === 'string') el.style.borderLeft = opts.borderLeft
}

function applyPadding(el: HTMLElement, opts: Record<string, unknown>): void {
  if (opts.padding != null) {
    el.style.padding = typeof opts.padding === 'number' ? opts.padding + 'pt' : String(opts.padding)
  }
  if (opts.paddingTop != null) el.style.paddingTop = safeNumber(opts.paddingTop, { fallback: 0 }) + 'pt'
  if (opts.paddingRight != null) el.style.paddingRight = safeNumber(opts.paddingRight, { fallback: 0 }) + 'pt'
  if (opts.paddingBottom != null) el.style.paddingBottom = safeNumber(opts.paddingBottom, { fallback: 0 }) + 'pt'
  if (opts.paddingLeft != null) el.style.paddingLeft = safeNumber(opts.paddingLeft, { fallback: 0 }) + 'pt'
}

// ============ Helpers ============

/**
 * Resolve the user-visible value for an element: data via field (nested-safe)
 * with testData fallback. PM-002 R3 preserves 0/false/''.
 */
function getElementValue(
  element: ElementJson,
  opts: Record<string, unknown>,
  options: RenderOptions
): unknown {
  const field = typeof opts.field === 'string' ? opts.field : (element.printElementType?.field as string | undefined)
  const data = options.data
  if (field && data) {
    const resolved = resolveField(data, field, undefined)
    if (resolved !== undefined) return resolved
  }
  if (opts.testData !== undefined) return opts.testData
  return ''
}

/** Build a watermark layer that overlays the paper. */
function buildWatermark(wm: NonNullable<PanelJson['watermarkOptions']>): HTMLElement {
  const layer = document.createElement('div')
  layer.classList.add('hiprint-watermark')
  layer.style.position = 'absolute'
  layer.style.left = '0'
  layer.style.top = '0'
  layer.style.right = '0'
  layer.style.bottom = '0'
  layer.style.pointerEvents = 'none'
  layer.style.display = 'flex'
  layer.style.alignItems = 'center'
  layer.style.justifyContent = 'center'
  const inner = document.createElement('div')
  inner.style.color = typeof wm.color === 'string' ? wm.color : '#cccccc'
  inner.style.fontSize = safeNumber(wm.fontSize, { fallback: 24 }) + 'pt'
  inner.style.opacity = String(safeNumber(wm.opacity, { fallback: 0.3, min: 0, max: 1 }))
  inner.style.transform = 'rotate(' + safeNumber(wm.angle, { fallback: -30 }) + 'deg)'
  // [Invariant #1] watermark text is user data
  inner.textContent = coerceText(wm.text)
  layer.appendChild(inner)
  return layer
}

/**
 * Parse an SVG string into an SVGElement using DOMParser. Returns null on
 * parse failure. We use DOMParser instead of `innerHTML` to keep XML-namespace
 * correctness (bwip-js emits `xmlns` attributes; happy-dom requires the proper
 * parse mode).
 */
function parseSvgString(svgStr: string): SVGElement | null {
  if (!svgStr || typeof svgStr !== 'string') return null
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(svgStr, 'image/svg+xml')
    const errEl = doc.getElementsByTagName('parsererror')[0]
    if (errEl) return null
    const root = doc.documentElement
    if (!root || root.tagName.toLowerCase() !== 'svg') return null
    // Import into the current document so style/CSS resolves correctly
    return document.importNode(root, true) as unknown as SVGElement
  } catch (err) {
    console.warn('[hiprint] parseSvgString failed:', err)
    return null
  }
}

/** Coerce option to a strict boolean (accept boolean or 'true' literal). */
function isTrue(v: unknown): boolean {
  return v === true || v === 'true'
}

/**
 * Invoke a user-supplied callback with try/catch. Returns undefined on throw.
 * Invariant #8: business-callback throws must never crash render pipeline.
 */
function safelyCall(fn: unknown, args: unknown[]): unknown {
  if (typeof fn !== 'function') return undefined
  try {
    return (fn as (...a: unknown[]) => unknown).apply(undefined, args)
  } catch (err) {
    console.warn('[hiprint] render: user callback threw:', err)
    return undefined
  }
}

// escapeHtml currently unused at render time — re-exported for tests + future
// attribute-injection paths.
export { escapeHtml }
