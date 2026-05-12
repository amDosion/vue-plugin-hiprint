# ADR-0036: Header/footer line drag deferred to v2.1 (panel-options replace separator handle)

- **Status:** accepted
- **Date:** 2026-05-12
- **Deciders:** amDosion (Sprint 22g wave 3 — Stream GN)
- **Related:** ADR-0011 (V3 modern UI), ADR-0029 (quirks rollup), TKT-397
- **V1 ref:** `docs/V1-INVENTORY/interactions.md` §6.7 + bundle.js line 9628-9700
- **V3 file:** `src/hiprint-v3/components/HiprintCanvas.vue` (absent — by design)

## Context

V1 renders a draggable horizontal divider on the print paper that demarcates
the **header zone** from the **body zone**, and (when configured) a second
divider for the footer zone. The user drags those lines to resize the
respective zones. The line itself is a sibling DOM node to the user-drawn
guide lines (TKT-102) but bound to `panel.paperHeader` / `panel.paperFooter`
options instead of the `guideLines[]` array.

The V1 implementation has known issues documented in V1-INVENTORY §6.7:

1. **Coordinate ambiguity** — the line stores its position in a different unit
   than the elements inside the header zone (pt for the element, mm for the
   separator), so a 1mm rounding error can leave a small horizontal slice the
   user can't reach.
2. **Coupling to physical paper geometry** — when paper size changes
   mid-design, the separator does not auto-clamp; designers regularly end up
   with header zones taller than the new paper.
3. **No undo capture** — V1 mutates the panel option directly and skips the
   `hiprintTemplateDataChanged_<id>` bus, so Ctrl+Z cannot restore the prior
   header height.

V3 already supports the data-shape via `panel.paperHeader` /
`panel.paperFooter` (canvas store schema) and the property panel exposes both
as numeric inputs. What is missing is the **on-paper draggable line** —
i.e. the interactive surface, not the underlying state.

## Decision

**Defer the header/footer separator drag handle to v2.1.**

Rationale for the deferral (not removal):

- The data shape is already migrated — `panel.paperHeader` /
  `panel.paperFooter` are first-class panel options; tests + history snapshots
  cover them.
- The **property panel** numeric inputs cover the same use case without the
  V1 ambiguity. Designers needing to tune header/footer height enter the
  value directly and Ctrl+Z works correctly.
- The on-paper drag handle is a UX convenience, not a capability gap. Adding
  it correctly requires:
  1. A draggable SVG line component that respects panel scale + paper bounds.
  2. History-snapshot integration so each drag commits an undo entry.
  3. A clamp policy when the body zone would become smaller than the largest
     element inside it.
  4. Visual feedback equivalent to the smart-guide preview (pt label,
     auto-clear on commit).

Items (1)-(4) are a ~M-effort feature on their own. Doing them late in the
v2.0 wave 3 cycle would introduce risk for a UX convenience that has a
working alternative.

## Consequences

- `docs/upgrade-to-v3.md` must note: "Header/footer height: use the property
  panel numeric inputs (`paperHeader` / `paperFooter`). The V1 on-paper drag
  handle is deferred to v2.1."
- e2e baseline already exercises the property-panel path (Sprint 22d
  TKT-150). No additional v2.0 tests required.
- When v2.1 adds the drag handle, the file path will be
  `src/hiprint-v3/components/HiprintCanvas.vue` (new SVG line inside the
  paper overlay layer), keyed off `panel.paperHeader` / `panel.paperFooter`.
  Implementation pattern: same as the user-drawn guide lines (`onGuideLine
  PointerDown` style) but writing to the panel option instead of
  `guideLines[]`.

## Rollback

If a business consumer files this as a v2.0 blocker:

1. Add the drag-handle SVG line inside `HiprintCanvas.vue` overlay slot.
2. Wire `pointerdown` → drag state machine identical to `onGuideLine
   PointerDown` but mutating `canvas.updatePanel(panelId, { paperHeader })`.
3. Push a history snapshot on `pointerup` (mirrors
   `enableElementDrag`'s `end` handler).
4. Add an e2e test asserting drag → property panel reflects new value AND
   Ctrl+Z restores the prior value.

Estimated effort: 4-6 hours including tests. No data migration required —
the field already exists.
