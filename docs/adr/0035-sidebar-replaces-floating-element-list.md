# ADR-0035: Sidebar replaces V1 floating element-list widget

- **Status:** accepted
- **Date:** 2026-05-12
- **Deciders:** amDosion (Sprint 22g)
- **Related:** ADR-0011 (V3 modern UI), TKT-392, TKT-413
- **V1 ref:** `docs/V1-INVENTORY/interactions.md` §16 + bundle 11679-11867
- **V3 file:** `src/hiprint-v3/components/HiprintElementListPanel.vue`

## Context

V1's `panel.createElementListPanel()` (`[V1 lines 11679-11867]`) produces a
**floating, draggable, absolute-positioned panel** anchored by a `☰` toggle
button. The user can:
- Click ☰ to toggle the panel open/closed.
- Drag the panel header to move it anywhere on screen.
- Resize via header pointer drag (arrow keys also adjust position).
- The panel sits **on top** of the canvas, occluding part of the design.

V3 ships an **HiprintElementListPanel.vue** that lists the same data
(elements in the active panel) but renders as a **sidebar aside**, not a
floating widget. The sidebar:
- Lives in the designer shell layout (configurable left / right slot).
- Is keyboard-navigable (TKT-403: ArrowUp/Down, Enter, Home/End).
- Supports drag-and-drop reorder via HTML5 DnD.
- Does NOT occlude the canvas (it's a layout sibling, not an overlay).
- Has no draggable header (sidebar position is shell-controlled).

## Decision

**V3 ships the SIDEBAR variant as the only element-list surface.**

The floating-widget variant is **deferred indefinitely** (effectively
dropped). The two CSS classes `.hiprint-el-list-toggle` (☰ button) and the
sidebar-shell wrapper are co-emitted with their V1 names so business CSS
overrides still apply (TKT-250 dual-class pattern).

## Rationale

1. **Modern design tools use sidebars, not floating widgets.** Figma layers,
   Sketch layers, Illustrator's Layers panel, VS Code's outline view — all
   are dockable sidebars. The floating-widget pattern is a legacy holdover
   from desktop apps where window real estate was scarce; in a web canvas
   designer the shell layout is the appropriate home.
2. **No occlusion is a feature.** Floating element-list overlaps the design
   area; users complained in V1 (no formal report, but commit history shows
   multiple attempts at reposition + arrow-key nudge to "get it out of the
   way"). Sidebar layout eliminates the class of bug.
3. **A11y wins.** Sidebar receives keyboard focus naturally via Tab; the
   floating-widget required custom focus management and didn't ship with
   ArrowUp/Down navigation. TKT-403 adds keyboard nav to the sidebar.
4. **Maintenance cost.** Floating panel requires:
   - Drag-to-reposition (mousemove document listeners, namespaced cleanup).
   - Resize handles + clamp to viewport.
   - z-index management (over canvas, under modal).
   - `body.hiprint-el-list-dragging` class for cursor + selection guards.
   None of that is needed for a sidebar.
5. **Toggle ☰ still ships.** Users who like the keyboard shortcut to expand /
   collapse keep the affordance — it just toggles the sidebar's `isOpen`,
   not the position.

## Consequences

- **Migration note (`docs/upgrade-to-v3.md`):**
  "The floating element-list panel is replaced by a docked sidebar. The
  `☰` toggle button still expands / collapses the panel; drag-to-reposition
  is removed (sidebar position is shell-controlled via the
  `<HiprintDesigner>` slot system)."
- **Dropped V1 features (documented in `docs/V3-PARITY-MATRIX/07-interactions.md` §16):**
  - Header drag-to-reposition.
  - Arrow-key panel-position nudge.
  - Enter-to-reset-to-default-position.
  - `body.hiprint-el-list-dragging` class (TKT-413 deferred-v2.0).
- **CSS class compatibility preserved.**
  `.hiprint-el-list-toggle` and `.hiprint-el-list-panel` are kept verbatim
  (V1-INVENTORY §1.8). Business overrides on those selectors carry over.
- **Tests:** existing keyboard-nav spec (Sprint 22g TKT-403) covers the
  sidebar interaction surface. No floating-panel tests are added (per ADR).

## Mitigation

If a business consumer requires the V1 floating widget:

1. The sidebar implementation is layout-agnostic — caller can wrap
   `HiprintElementListPanel` in their own absolute-positioned container with
   custom drag-to-move handlers (~50 LoC).
2. We will NOT add a `mode: 'floating'` opt-in to the component itself; that
   doubles the surface area and re-introduces the maintenance cost we're
   shedding here.
3. No business consumer has requested floating mode in Sprint 22a-g; if one
   does, file a TKT against this ADR with the specific business workflow
   that requires it.
