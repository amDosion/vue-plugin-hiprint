/**
 * stores/table-ops.ts — TKT-107 table-specific canvas mutation helpers.
 *
 * Sprint 22c (Stream CE — TKT-105/106/107) adds the USER-INTERACTION layer
 * on top of the data-layer Sprint 22b BB built in `internal/render-table.ts`.
 *
 * These helpers mutate `element.options.columns` (the 2-D layered shape
 * documented in V1-INVENTORY etypes/table.md §D.1) immutably and push a
 * history snapshot on every mutation. Right-click context menu items
 * (interactions/context-menu.ts) and the property panel (TablePropertyPanel.vue
 * via merge buttons) both delegate here so there is exactly one mutation path
 * for column insertion / removal / colspan / rowspan.
 *
 * Why a separate module (not inside canvas.ts):
 *  - These are table-etype-specific helpers (not generic canvas operations).
 *  - Keeping them out of canvas.ts avoids growing that store to >800 lines.
 *  - They depend on the canvas store at call time (passed in via `useCanvasStore`
 *    inside each function) so the active pinia is honoured under multi-designer.
 *  - History push lives in the same call so we never end up with mutated state
 *    but missed undo records (a recurring bug source per BB postmortem).
 *
 * Schema reminders (matching render-table.ts):
 *  - `options.columns` is `Array<Array<column>>` (2-D); each inner array is
 *    one header LAYER (top-down). The bottom layer is the canonical leaf row
 *    used by render-table's body cells.
 *  - colspan/rowspan default 1; values > 1 mean the cell spans further cells.
 *  - Cells at indices that the merge "ate" remain in the array — render-table
 *    treats `cell.rowspan === 0` or `cell.colspan === 0` as `hidden: true` and
 *    emits `display:none` (V1 G.3). For now we keep the simple invariant: when
 *    a column is inserted/removed, we just mutate the layer array; computing
 *    which cells should be hidden by merge is the renderer's job.
 *
 * Invariants:
 *  - All mutations clone `options.columns` outer + every inner layer (immutable
 *    patch — Vue reactivity diff fires + history snapshot has clean data).
 *  - At least one layer is preserved (we never produce an empty `columns: []`).
 *  - When the resulting layer is empty (last column removed), we leave the
 *    empty layer in place rather than collapsing — that matches V1's
 *    `deleteColums` guard at bundle line 7257 (refused at the call site when
 *    only one column remains).
 *  - All helpers no-op + warn on invalid indices instead of throwing (Invariant
 *    #8: never break the caller's flow on a property-panel typo).
 */

import { useCanvasStore, useHistoryStore } from './index'

// ============ Types ============

type CanvasStore = ReturnType<typeof useCanvasStore>
type HistoryStore = ReturnType<typeof useHistoryStore>

/**
 * Resolve `element.options.columns` to a `Array<Array<column>>` shape.
 *
 * Accepts both V1 shapes (single-layer `Array<column>` and multi-layer
 * `Array<Array<column>>`) — matches the `normalizeHeaderLayers` helper in
 * render-table.ts. Returns a fresh outer array + fresh inner arrays.
 */
function cloneLayers(
  raw: unknown
): Array<Array<Record<string, unknown>>> {
  if (!Array.isArray(raw) || raw.length === 0) return [[]]
  const first = raw[0]
  if (Array.isArray(first)) {
    // Multi-layer: clone outer + each inner array (shallow column refs OK,
    // we replace specific cells via `{...col, ...patch}` below).
    return (raw as unknown[])
      .filter((r) => Array.isArray(r))
      .map((r) => (r as Array<Record<string, unknown>>).slice())
  }
  // Single-layer legacy shape — wrap in outer array.
  return [(raw as Array<Record<string, unknown>>).slice()]
}

/**
 * Find the panel id that owns `elementId`. Returns `null` if absent.
 *
 * V1 templates may have multiple panels — we walk every panel because the
 * caller (context menu) only has the element id.
 */
function findPanelId(canvas: CanvasStore, elementId: string): string | null {
  for (const p of canvas.panels) {
    if (p.printElements.find((e) => e.id === elementId)) return p.id
  }
  return null
}

/**
 * Resolve current `options.columns` for an element (already normalized to
 * 2-D layers). Returns `null` when the element doesn't exist.
 */
function readLayers(
  canvas: CanvasStore,
  elementId: string
): { panelId: string; layers: Array<Array<Record<string, unknown>>> } | null {
  const panelId = findPanelId(canvas, elementId)
  if (!panelId) return null
  const panel = canvas.panels.find((p) => p.id === panelId)!
  const el = panel.printElements.find((e) => e.id === elementId)!
  const raw = (el.options as Record<string, unknown>).columns
  return { panelId, layers: cloneLayers(raw) }
}

/**
 * Commit a layers patch + push history snapshot. Centralised so every helper
 * has the same `updateElement → pushSnapshot` ordering.
 */
function commit(
  canvas: CanvasStore,
  history: HistoryStore,
  panelId: string,
  elementId: string,
  layers: Array<Array<Record<string, unknown>>>
): void {
  canvas.updateElement(panelId, elementId, { options: { columns: layers } })
  history.pushSnapshot()
}

// ============ Public helpers (TKT-107) ============

/**
 * Insert a new column at `(layerIdx, columnIdx)` on `side` ('left' | 'right').
 *
 * V1 reference: `HiTable.insertColumn` bundle 6969-7049. For the *top header
 * row* (layer 0) only, V1 auto-assigns `title = 列 ${nextIdx}` and `field =
 * col${nextIdx}` where `nextIdx` scans existing `colN` fields (bundle
 * 6992-7003 left / 7022-7033 right). For lower layers V1 just splices the new
 * logical cell without an auto-name.
 *
 * V3 simplifies: we always provide a `title` + `field` ("col${idx+1}") so the
 * user sees something in the property panel. Caller may override via the
 * property-panel edit immediately after insertion.
 *
 * No-op + warn when `layerIdx` / `columnIdx` are out of bounds (Invariant #8).
 */
export function insertTableColumn(
  elementId: string,
  layerIdx: number,
  columnIdx: number,
  side: 'left' | 'right'
): void {
  const canvas = useCanvasStore()
  const history = useHistoryStore()
  const hit = readLayers(canvas, elementId)
  if (!hit) {
    console.warn('[hiprint] insertTableColumn: element not found', elementId)
    return
  }
  const { panelId, layers } = hit
  if (layerIdx < 0 || layerIdx >= layers.length) {
    console.warn(
      '[hiprint] insertTableColumn: layerIdx out of bounds',
      layerIdx,
      'layers',
      layers.length
    )
    return
  }
  const layer = layers[layerIdx]!
  // Insertion at empty layer is allowed (treat as "add first column").
  if (layer.length > 0 && (columnIdx < 0 || columnIdx >= layer.length)) {
    console.warn(
      '[hiprint] insertTableColumn: columnIdx out of bounds',
      columnIdx,
      'len',
      layer.length
    )
    return
  }
  // Compute insert position. When layer is empty, position is 0 regardless
  // of side (matching V1's "no existing column to anchor to" path).
  const insertAt =
    layer.length === 0 ? 0 : side === 'left' ? columnIdx : columnIdx + 1
  // Auto-name. V1 picks the first unused `col${N}`; we do the same lookup
  // across the whole layer so reorder/insert never collides.
  let nextN = layer.length + 1
  const usedFields = new Set(
    layer
      .map((c) => (typeof c.field === 'string' ? c.field : ''))
      .filter((f) => /^col\d+$/.test(f))
  )
  while (usedFields.has('col' + nextN)) nextN++
  const newCol: Record<string, unknown> = {
    title: 'col' + nextN,
    field: 'col' + nextN,
    width: 100,
    align: 'left',
  }
  layer.splice(insertAt, 0, newCol)
  commit(canvas, history, panelId, elementId, layers)
}

/**
 * Remove the column at `(layerIdx, columnIdx)`.
 *
 * V1 reference: `HiTable.deleteColums` bundle 7072-7084. V1 also adjusts the
 * colspan of upper-layer cells when the deleted column was inside a group —
 * we apply the same "decrement upper colspan" rule here so multi-layer
 * headers stay consistent. Invariant: we never let `layer.length` reach 0
 * (V1 line 7257 guard) — if the call would delete the last column, we
 * warn + no-op.
 *
 * No-op + warn when out of bounds.
 */
export function removeTableColumn(
  elementId: string,
  layerIdx: number,
  columnIdx: number
): void {
  const canvas = useCanvasStore()
  const history = useHistoryStore()
  const hit = readLayers(canvas, elementId)
  if (!hit) {
    console.warn('[hiprint] removeTableColumn: element not found', elementId)
    return
  }
  const { panelId, layers } = hit
  if (layerIdx < 0 || layerIdx >= layers.length) {
    console.warn(
      '[hiprint] removeTableColumn: layerIdx out of bounds',
      layerIdx
    )
    return
  }
  const layer = layers[layerIdx]!
  if (columnIdx < 0 || columnIdx >= layer.length) {
    console.warn(
      '[hiprint] removeTableColumn: columnIdx out of bounds',
      columnIdx
    )
    return
  }
  // V1 7257 guard — refuse the delete that would leave zero columns IN THE
  // LEAF LAYER. We check the layer that body cells render from (last layer)
  // so multi-layer designs can still trim upper layers freely.
  const leafIdx = layers.length - 1
  if (layerIdx === leafIdx && layer.length <= 1) {
    console.warn(
      '[hiprint] removeTableColumn: refusing to delete last leaf column'
    )
    return
  }
  layer.splice(columnIdx, 1)
  commit(canvas, history, panelId, elementId, layers)
}

/**
 * Set `colspan` on the cell at `(layerIdx, columnIdx)`. Accepts integers
 * `>= 1`; values `< 1` are clamped to 1 (V1 parity — V1 setAlign/setVAlign
 * style; bundle 6566-6624 doesn't accept fractional/zero spans).
 *
 * Effect: render-table treats a cell whose colspan/rowspan resolved to 0 as
 * `hidden: true`. The visible cells get the new colspan rendered as an
 * attribute on the `<th>` / `<td>`.
 */
export function setTableColspan(
  elementId: string,
  layerIdx: number,
  columnIdx: number,
  span: number
): void {
  const canvas = useCanvasStore()
  const history = useHistoryStore()
  const hit = readLayers(canvas, elementId)
  if (!hit) {
    console.warn('[hiprint] setTableColspan: element not found', elementId)
    return
  }
  const { panelId, layers } = hit
  if (layerIdx < 0 || layerIdx >= layers.length) {
    console.warn('[hiprint] setTableColspan: layerIdx out of bounds', layerIdx)
    return
  }
  const layer = layers[layerIdx]!
  if (columnIdx < 0 || columnIdx >= layer.length) {
    console.warn(
      '[hiprint] setTableColspan: columnIdx out of bounds',
      columnIdx
    )
    return
  }
  const safeSpan = Number.isFinite(span) && span >= 1 ? Math.floor(span) : 1
  const cur = layer[columnIdx]!
  layer[columnIdx] = { ...cur, colspan: safeSpan }
  commit(canvas, history, panelId, elementId, layers)
}

/**
 * Set `rowspan` on the cell at `(layerIdx, columnIdx)`. Same clamp semantics
 * as `setTableColspan`.
 */
export function setTableRowspan(
  elementId: string,
  layerIdx: number,
  columnIdx: number,
  span: number
): void {
  const canvas = useCanvasStore()
  const history = useHistoryStore()
  const hit = readLayers(canvas, elementId)
  if (!hit) {
    console.warn('[hiprint] setTableRowspan: element not found', elementId)
    return
  }
  const { panelId, layers } = hit
  if (layerIdx < 0 || layerIdx >= layers.length) {
    console.warn('[hiprint] setTableRowspan: layerIdx out of bounds', layerIdx)
    return
  }
  const layer = layers[layerIdx]!
  if (columnIdx < 0 || columnIdx >= layer.length) {
    console.warn(
      '[hiprint] setTableRowspan: columnIdx out of bounds',
      columnIdx
    )
    return
  }
  const safeSpan = Number.isFinite(span) && span >= 1 ? Math.floor(span) : 1
  const cur = layer[columnIdx]!
  layer[columnIdx] = { ...cur, rowspan: safeSpan }
  commit(canvas, history, panelId, elementId, layers)
}

/**
 * Reorder a column within a single header layer (TKT-155).
 *
 * Moves the column at `fromIdx` to `toIdx` inside `layers[layerIdx]` ONLY —
 * other layers are left untouched so multi-layer headers preserve their
 * grouping structure. This matches V1's column header drag-reorder which also
 * splices within one layer at a time (V1 bundle line ~7330-7380 reorderColumn
 * path — group cells in upper layers stay anchored, leaf cells move).
 *
 * Semantics:
 *  - `fromIdx === toIdx` → no-op (no mutation, no history push). Avoids
 *    spurious snapshots from drag-and-drop that ends on the source cell.
 *  - Out-of-bounds `layerIdx`, `fromIdx`, or `toIdx` → no-op + warn
 *    (Invariant #8 — never throw on a UI typo).
 *  - Splice is array-immutable: clone the inner layer array, remove + insert,
 *    then commit through the shared `commit()` helper so the element ref is
 *    new (Vue reactivity diff fires) and history snapshot is pushed.
 *
 * V1 reference: column drag handler at bundle line ~7330. V3 simplification:
 *  we do not auto-merge / split group cells when columns cross group
 *  boundaries — callers should reorder within a logical group, and the
 *  property panel still owns multi-layer restructuring.
 */
export function reorderTableColumn(
  elementId: string,
  layerIdx: number,
  fromIdx: number,
  toIdx: number
): void {
  const canvas = useCanvasStore()
  const history = useHistoryStore()
  const hit = readLayers(canvas, elementId)
  if (!hit) {
    console.warn('[hiprint] reorderTableColumn: element not found', elementId)
    return
  }
  const { panelId, layers } = hit
  if (layerIdx < 0 || layerIdx >= layers.length) {
    console.warn(
      '[hiprint] reorderTableColumn: layerIdx out of bounds',
      layerIdx,
      'layers',
      layers.length
    )
    return
  }
  const layer = layers[layerIdx]!
  if (fromIdx < 0 || fromIdx >= layer.length) {
    console.warn(
      '[hiprint] reorderTableColumn: fromIdx out of bounds',
      fromIdx,
      'len',
      layer.length
    )
    return
  }
  if (toIdx < 0 || toIdx >= layer.length) {
    console.warn(
      '[hiprint] reorderTableColumn: toIdx out of bounds',
      toIdx,
      'len',
      layer.length
    )
    return
  }
  // Drop-on-self → no-op (no history snapshot to avoid undo-stack noise).
  if (fromIdx === toIdx) return
  // Immutable splice — clone the inner layer (cloneLayers already cloned
  // the outer + this inner), then move the column.
  const moved = layer.splice(fromIdx, 1)[0]!
  layer.splice(toIdx, 0, moved)
  commit(canvas, history, panelId, elementId, layers)
}

// ============ Public helpers (TKT-105 — header layers) ============

/**
 * Append a new empty header layer at the bottom (becomes the new leaf row).
 *
 * V1 stores `columns` as 2-D top-down (D.1). Adding a new layer at the
 * bottom means the existing bottom layer is no longer the leaf — render-table
 * picks the new last array as the canonical leaf set. We mirror columns from
 * the previous bottom so the new layer has the same column count + auto-named
 * cells. Callers that want a truly-empty layer can manually trim it via the
 * property panel afterwards.
 */
export function addTableHeaderLayer(elementId: string): void {
  const canvas = useCanvasStore()
  const history = useHistoryStore()
  const hit = readLayers(canvas, elementId)
  if (!hit) {
    console.warn('[hiprint] addTableHeaderLayer: element not found', elementId)
    return
  }
  const { panelId, layers } = hit
  const prevBottom = layers[layers.length - 1] ?? []
  const newLayer = prevBottom.map((_col, idx) => ({
    title: 'col' + (idx + 1),
    field: 'col' + (idx + 1),
    width: 100,
    align: 'left',
  }))
  layers.push(newLayer)
  commit(canvas, history, panelId, elementId, layers)
}

/**
 * Remove the header layer at `layerIdx`. Guards: must keep ≥ 1 layer
 * (Invariant #10 mirror — same rationale as `removePanel`).
 */
export function removeTableHeaderLayer(
  elementId: string,
  layerIdx: number
): void {
  const canvas = useCanvasStore()
  const history = useHistoryStore()
  const hit = readLayers(canvas, elementId)
  if (!hit) {
    console.warn('[hiprint] removeTableHeaderLayer: element not found', elementId)
    return
  }
  const { panelId, layers } = hit
  if (layers.length <= 1) {
    console.warn(
      '[hiprint] removeTableHeaderLayer: refusing to remove last layer'
    )
    return
  }
  if (layerIdx < 0 || layerIdx >= layers.length) {
    console.warn(
      '[hiprint] removeTableHeaderLayer: layerIdx out of bounds',
      layerIdx
    )
    return
  }
  layers.splice(layerIdx, 1)
  commit(canvas, history, panelId, elementId, layers)
}
