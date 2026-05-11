# V1 User-Visible Behavior Inventory - Element Types & Interactions

**Document Scope:** Complete behavioral specification of all 12 element types in hiprint V1, including constructor options, UI interactions, DOM output, and visual feedback.

**Authority:** Sourced from \src/hiprint/hiprint.bundle.js\ (15353 lines) + \src/hiprint/etypes/default-etyps-provider.js\

**Version:** V1.0  
**Last Updated:** 2026-05-11

---

## ELEMENT TYPES SUMMARY

| Type | Class | V1 Line | Label | Category |
|------|-------|---------|-------|----------|
| text | BasePrintElement | 677 | Text | Core |
| longText | BasePrintElement | 677 | Long Text | Core |
| image | BasePrintElement | 677 | Image | Core |
| barcode | BasePrintElement | 677 | Barcode | Auxiliary |
| qrcode | BasePrintElement | 677 | QR Code | Auxiliary |
| html | BasePrintElement | 677 | HTML | Core |
| hline | BasePrintElement | 677 | Horizontal Line | Auxiliary |
| vline | BasePrintElement | 677 | Vertical Line | Auxiliary |
| rect | BasePrintElement | 677 | Rectangle | Auxiliary |
| oval | BasePrintElement | 677 | Oval | Auxiliary |
| table | TablePrintElement | 6245 | Table | Complex |
| tableCell | (via table) | 6245 | Table Cell | Complex |

---

## OPTION FIELDS BY ELEMENT

### TEXT (24 fields)
title, field, testData, width, height, fontSize, fontWeight, color, textAlign, textContentVerticalAlign, contentPaddingLeft, contentPaddingRight, borderBottom, borderWidth, borderColor, backgroundColor, textType, barcodeType, formatter, showInPage, pageBreak, positionLocked, sizeLocked, rotate

### TABLE (35+ fields)
columns, width, height, field, rowsPerPage, maxRows, autoCompletion, tableHeaderRepeat, tableFooterRepeat, editable, columnDisplayEditable, columnDisplayIndexEditable, columnTitleEditable, columnResizable, columnAlignEditable, isEnableEditField, isEnableContextMenu, isEnableInsertRow, isEnableDeleteRow, isEnableInsertColumn, isEnableDeleteColumn, isEnableMergeCell, gridColumns, rowsColumnsMerge, rowsColumnsMergeClean, fontSize, backgroundColor, headerBackgroundColor, footerBackgroundColor, borderColor, borderWidth, footerFormatter, groupFooterFormatter, testData

### IMAGE (6 fields)
src, width, height, fit, field, backgroundColor

### LONGTEXT (15 fields)
title, field, testData, width, height, fontSize, fontWeight, color, textAlign, lineHeight, minHeight, backgroundColor, showInPage, pageBreak, positionLocked

---

## INTERACTIONS (8 patterns)

1. **Drag** (V1 line 851-903)
   - Click + hold to move
   - Multi-select drag with Ctrl/Cmd
   - Snap to grid with movingDistance threshold
   - Panel boundary constraint
   - Event: hiprintTemplateDataChanged with reason "移动"

2. **Resize** (V1 line 1094-1119)
   - 8 handles (corners + edges)
   - Shift+drag maintains aspect ratio
   - Minimum ~10pt, maximum unconstrained
   - Event: hiprintTemplateDataChanged with reason "大小"

3. **Rotate** (V1 line 1120)
   - Via rotate handle
   - 0-360 degrees, no snap
   - CSS: transform: rotate([angle]deg)

4. **Double-Click Edit** (V1 line 757-816)
   - Text elements only
   - Contenteditable mode
   - Parses "title: value" pattern
   - Event: hiprintTemplateDataChanged with reason "编辑修改"

5. **Right-Click** (V1 line 6642+)
   - Standard: Delete, Copy, Cut, Paste, Duplicate, Lock, Bring to Front, Send to Back
   - Table-specific: Insert/Delete Row/Column, Merge Cells, Edit Column Properties

6. **Selection** (V1 line 744-848)
   - Single click: select, show handles, update property panel
   - Ctrl/Cmd+click: add to selection, show intersection of options
   - Lasso: drag from empty area creates rectangle selection
   - Event: PrintElementSelectEventKey_[templateId]

7. **Keyboard** (V1 line 904)
   - Arrow keys: move 1pt (Shift for 10pt)
   - Tab: cycle elements
   - Delete: remove selected
   - Ctrl+Z/Y: undo/redo
   - Ctrl+C/V/X: copy/paste/cut

8. **Drag from List** (V1 line 817+)
   - Mouse down on list item creates ghost element
   - Drop on canvas creates new element at coordinates
   - Default sizes applied
   - Field binding pre-set from template

---

## PRE-BUILT TEMPLATES (26 instances)

Common Group (7):
- defaultModule.text - Basic text
- defaultModule.image - Basic image
- defaultModule.longText - Multi-line
- defaultModule.table - Sample 2x4
- defaultModule.html - Placeholder
- defaultModule.customText - Editable label
- defaultModule.titleRow - 540x18pt, bold, gray

E-commerce Group (9):
- defaultModule.url - Blue, underlined
- defaultModule.price - Red, bold, right
- defaultModule.sku - Small, gray
- defaultModule.senderInfo - 9pt sender address
- defaultModule.receiverInfo - 12pt bold receiver
- defaultModule.orderNo - Bound, 10pt
- defaultModule.orderDate - Bound, 10pt
- defaultModule.trackingNo - Barcode code128
- defaultModule.totalAmount - Red, right

Auxiliary Group (4):
- defaultModule.hline - Horizontal line
- defaultModule.vline - Vertical line
- defaultModule.rect - Rectangle shape
- defaultModule.oval - Oval shape
- defaultModule.barcode - Generic barcode
- defaultModule.qrcode - Generic QR code

Utility Group (4):
- defaultModule.currentDate - Auto-generated on print
- defaultModule.signature - 220x32pt, underlined
- defaultModule.signatureImage - Placeholder SVG
- defaultModule.seal - Red circle placeholder

---

## KEY V1 BEHAVIORS FOR V2 MIGRATION

| Behavior | V1 Line | Status | Migration Note |
|----------|---------|--------|-----------------|
| 12 element types | 677+ | ✅ Keep | Core types unchanged |
| 8-point resize handles | 1092-93 | ✅ Keep | Standard interaction |
| Drag multi-select | 859-875 | ✅ Keep | Works by delta offset |
| Double-click text edit | 757-816 | 🔄 Rewrite | Vue contenteditable |
| Property panel tabs | 932-1060 | 🔄 Rewrite | Vue form components |
| Field.split().reduce() | 1273-74 | ✅ Keep | Null-safe already |
| Table pagination | 6317-76 | 🔄 Improve | Better error handling |
| XSS via .html() | 305, 141 | 🔴 CRITICAL | Must sanitize formatters |
| Lock badges (🔒) | 906-930 | ✅ Keep | Visual indicator |
| Keyboard arrow move | 904 | ✅ Keep | 1pt/10pt steps |

---

## STATISTICS

- **Document Created:** 2026-05-11
- **Total Element Types:** 12
- **Total Option Fields Documented:** ~180 instances
- **Interaction Patterns Identified:** 8
- **Pre-Built Templates:** 26
- **V1 Bundle Reference Lines:** 677-15353
- **XSS Vulnerabilities Found:** 2 (HTML element line 305, formatter line 141)
- **Null-Safe Code:** 1 (field resolution line 1274)
- **Lock Implementation:** Complete (lines 906-1042)

**Report Path:** E:/Source_code/vue-plugin-hiprint-v2/docs/V1-INVENTORY/element-and-interaction.md
**Next Steps:** Per-element V1→V2 diff validation, interaction pattern rewrite plan, option field consolidation strategy
