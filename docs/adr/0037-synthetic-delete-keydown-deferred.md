# ADR-0037: Synthetic `keydown(46)` "delete-selected" trigger deferred to v2.1

- **Status:** accepted
- **Date:** 2026-05-12
- **Deciders:** amDosion (Sprint 22g wave 3 — Stream GN)
- **Related:** ADR-0011 (V3 modern UI), ADR-0029 (quirks rollup), TKT-402
- **V1 ref:** `docs/V1-INVENTORY/interactions.md` §9.5 + bundle.js line 8112
- **V3 file:** `src/hiprint-v3/interactions/keyboard.ts` (absent — by design)

## Context

V1 exposes a programmatic "delete the currently-selected element(s)" trigger
by **synthesizing a `keydown` event with `keyCode === 46`** on the designer
root and letting the global keyboard handler pick it up:

```js
// V1 (bundle.js line 8112) — synthetic delete shortcut.
$(document).trigger(jQuery.Event('keydown', { keyCode: 46 }))
```

The intent was to provide an imperative API for embedders who want a
"Delete" button on a custom toolbar without re-wiring the keyboard handler.
The mechanism has two problems we deliberately do not bring forward:

1. **Coupled to jQuery's synthetic event system.** V3 uses native
   `addEventListener('keydown', ...)`. Dispatching a `KeyboardEvent` with
   `keyCode: 46` to satisfy V1 semantics would force every native handler
   in the page (form inputs, contenteditable hosts, third-party rich-text
   editors) to participate in our delete keystroke — exactly the kind of
   cross-app pollution the V3 redesign moved away from.
2. **Bypasses lock semantics.** V1's synthetic-delete fires the same path
   as user keydown, including the lock gate. But the API surface gives
   callers no return value indicating whether the delete actually happened
   (a position-locked element silently stays). Consumers expecting an
   "always-delete" semantics were already hitting that V1 quirk.

V3 exposes the underlying capability through the canvas store directly:

```ts
const canvas = useCanvasStore()
canvas.removeElement(panelId, elementId) // or:
for (const id of Array.from(canvas.selectedElementIds)) {
  // Resolve panel + remove. Caller controls lock semantics.
}
```

The store path is **more powerful** (skips the editable-target / lock
gates when the caller decides that's the right semantics) and **more
honest** (the caller knows whether the deletion actually happened).

## Decision

**Defer `keydown(46)` synthetic-trigger compatibility to v2.1.**

Rationale:

- No business consumer of `vue-admin-main` has filed this as a regression
  (verified by grep against `E:/Source_code/vue-admin-main/frontend`).
- The store-direct path is documented in `docs/upgrade-to-v3.md` as the
  replacement.
- Re-introducing a synthetic keystroke dispatch in v2.1 (if asked for)
  is a 1-file ~30 LOC change — we deliberately keep the option open.

## Consequences

`docs/upgrade-to-v3.md` adds:

> **`hiprint` programmatic delete (V1 `keydown(46)` synth):** Use
> `canvas.removeElement(panelId, elementId)` directly. Iterate
> `canvas.selectedElementIds` for multi-delete. The V1 synthetic-keydown
> trigger is not implemented in V3 — it relied on jQuery's event-bubbling
> contract and is incompatible with V3's native listener model.

No new test required. The deletion path itself is covered by
`src/hiprint-v3/interactions/__tests__/keyboard.spec.ts` (Delete/Backspace
case) and `src/hiprint-v3/stores/__tests__/canvas.spec.ts`
(`removeElement` action).

## Rollback (v2.1 plan if requested)

```ts
// src/hiprint-v3/compat/synthetic-delete.ts (proposed):
export function triggerSyntheticDelete(): void {
  const ev = new KeyboardEvent('keydown', {
    key: 'Delete',
    keyCode: 46,
    bubbles: true,
    cancelable: true,
  })
  window.dispatchEvent(ev)
}
```

Surface this via the global `hiprint.triggerDelete()` facade in
`src/hiprint-v3/compat/build-designer.ts`. Estimated effort: ~30 LOC + 1
test. Lock semantics carry through unchanged because the dispatched event
hits the same `handler` in `keyboard.ts`.
