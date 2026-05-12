# ADR-0034: Ctrl/Cmd+click on element selects via TOGGLE (not V1 ADD-only)

- **Status:** accepted
- **Date:** 2026-05-12
- **Deciders:** amDosion (Sprint 22g)
- **Related:** ADR-0011 (V3 modern UI), ADR-0029 (quirks rollup), TKT-395
- **V1 ref:** `docs/V1-INVENTORY/interactions.md` §1.4 + bundle 8172-8181
- **V3 file:** `src/hiprint-v3/interactions/selection.ts:81-86`

## Context

V1 binds Ctrl/⌘+click on an element to "ADD to selection" — clicking an
already-selected element with Ctrl held is a **no-op** (the element stays
selected, never deselects). Removing an element from selection in V1 required
either:
1. Click somewhere else (clears the whole selection), then re-pick the
   remaining elements — clumsy when working with a 5-element group.
2. Shift+click outside the desired set to extend the selection (also clumsy).

Every modern design tool (Figma / Sketch / Illustrator / PS / VS Code multi-
cursor / GitHub file picker / macOS Finder) binds Ctrl/⌘+click to **toggle**
membership: click an unselected element to add, click a selected element to
remove. Users coming from any of those tools hit this expectation as a primary
muscle-memory, and the V1 behavior is documented as a quirk (V1-INVENTORY §1.4
notes "V1 does NOT remove selection on Ctrl+click of an already-selected
element — this is a V1 quirk; modern designs use TOGGLE").

V3 currently implements **TOGGLE** (`modeFromEvent` in selection.ts L83-86:
`if (e.ctrlKey || e.metaKey) return 'toggle'`). This ADR ratifies the V3
modern behavior as the supported contract and documents the deviation so
business consumers expecting V1 can adapt.

## Decision

**Ctrl/Cmd+click on an element TOGGLES that element's selection state.**

- Element NOT in selection → click adds it.
- Element IS in selection → click removes it.
- Shift+click remains the V1-compatible **ADD-only** mode (preserves V1
  workflow for users who insist on it: Shift = grow selection, never shrink).
- Plain click remains **REPLACE** (single selection).

The V3 selection-mode mapping is:

| Modifier            | Mode      | V1 ref            |
|---------------------|-----------|-------------------|
| (none)              | replace   | §1.1              |
| Shift               | add       | §1.3              |
| Ctrl / Meta         | **toggle** (new V3) | §1.4 (was add-only) |

## Rationale

1. **Industry standard.** Every comparable canvas / list / file-picker UI
   binds Ctrl/⌘+click to toggle. New users will hit this expectation and
   filing the V1 quirk as "unintuitive" wastes everyone's time.
2. **No business workflow loss.** Shift+click still provides ADD-only
   behavior for the rare workflow that relied on V1's quirk.
3. **No data shape change.** This is a purely interactive change — the
   resulting selection is still a Set of element ids; no template JSON is
   affected; rollback is a 1-line code revert (no data migration needed).

## Consequences

- **Migration note (must publish to `docs/upgrade-to-v3.md`):**
  "Ctrl/⌘+click on an element now toggles its selection state (industry
  standard). V1 only added; to grow a selection without toggle use Shift+click."
- e2e tests in `e2e/tests/interactions/` already assert TOGGLE (Sprint 22d
  TKT-167 baseline). No additional tests required.
- A small group of V1-trained power users will need ~1 minute to adapt
  muscle memory. We accept this as the cost of cross-tool consistency.

## Mitigation

If a specific business consumer needs V1 behavior:

1. Pass a config flag `selectionToggleAsAdd: true` to `enableElementSelection`
   (not yet implemented; deferred to feedback-driven backlog).
2. Or wrap the click handler to consume Ctrl+click and dispatch
   `canvas.selectElement(id, 'add')` manually.

No business consumer has requested V1 fidelity here as of Sprint 22g; if one
does, file a TKT against this ADR.
