# ADR-0033: longText — `leftSpaceRemoved` default + per-line indent semantics

- **Status:** accepted
- **Date:** 2026-05-12
- **Deciders:** amDosion
- **Related:** TKT-348 + TKT-349 (Sprint 22g wave 2), V3-PARITY-MATRIX 02-text-longtext §J.5, V1 `bundle.js` line 9812-9830
- **Replaces:** none

## Context

V1 `longText` renders text differently from a plain `<div>` with CSS `white-space: pre-wrap`. Two specific behaviors are baked into V1 line 9826-9830 (`getPaperHtmlResult`):

```js
var l = [this.getLongTextIndent()],
    u = p.split(new RegExp("\r|\n", "g"));
u.forEach(function (t, e) {
  var n = 0 != i.options.leftSpaceRemoved
        ? (t || "").toString().replace(/^\s*/, "")
        : t;
  l = l.concat(n.split(""));
  e < u.length - 1 && l.push("<br/>" + i.getLongTextIndent());
});
```

Translating to plain English:

1. **`leftSpaceRemoved`** default = strip leading whitespace **every line**, unless the user
   explicitly sets `leftSpaceRemoved: 0` (i.e. `!== 0`). Because V1 stores templates as JSON and
   the property is rarely persisted, the effective default for ~all templates in the wild is
   **strip**.
2. **Per-line indent**: V1 inserts a `<span class="long-text-indent" style="margin-left:Xpt">`
   at the very start of the rendered output AND after every `<br/>`. The visual effect: a
   first-line indent that **repeats at every newline** in the user's text — V1's idiom for a
   "paragraph indent at every paragraph".

V3 (`LongTextElement.vue` 173-181 + `print/render.ts` 374-381) up to Sprint 22g first wave:
- Indent is emitted **once at the start** (V3 puts the `<span>` outside the `pre-wrap` text node,
  so subsequent lines after a `\n` start at the LEFT margin, not at the indent).
- `leftSpaceRemoved` is consumed in `LongTextPropertyPanel.vue` (writes the option) but
  the **renderer never reads it** — V3 simply lets CSS `pre-wrap` keep leading whitespace.

Both differences are visible to anyone migrating a V1 template that contains multi-line free-text
(e.g. terms-and-conditions blocks). The mismatch is silent — the output renders but the layout
is wrong, and users typically blame "the new font" rather than spot the missing indent.

## Decision

**Both V3 quirks are reverted to V1-faithful by default**, because:

1. Existing V1 templates depend on the V1 layout.
2. The behavior is template-data-driven (template JSON sets it, business code does not), so the
   migration burden is zero — the template author already chose.
3. No reasonable counter-argument: nothing about industry-standard text rendering says "first
   line of a paragraph indents but the second line does not". V1's behavior is the conventional
   one; V3's was an accident of using CSS `pre-wrap` instead of explicit `<br/>` injection.

### Implementation

V3 renderer path (`src/hiprint-v3/print/render.ts` `renderLongTextElement`):
- Split the composed text on `/\r|\n/g`.
- For each segment, if `options.leftSpaceRemoved !== 0` (V1-faithful default = strip), apply
  `/^\s*/ → ''`.
- Emit a per-line `<span class="long-text-indent" style="margin-left:Xpt">` at the start of
  each line followed by the line text as a Text node.
- Separate lines with `<br>` elements.
- All text emitted via `document.createTextNode` (Invariant #1 — XSS safe).

V3 Vue path (`src/hiprint-v3/components/elements/LongTextElement.vue`):
- Mirror the renderer: pre-process `displayText` (or formatter HTML — when formatter, indent only
  the first line because the author is now responsible for the HTML), split, render an array of
  `<span class="long-text-indent" /><text/>` then a `<br>`.
- Indent spans use Vue text interpolation `{{ }}` (Invariant #1). Width comes from
  `safeNumber(longTextIndent, { min: 0 })`.

### Opt-out

Users who want CSS-driven `pre-wrap` behavior (V3-original) can set `leftSpaceRemoved: 0`
on the element options AND `longTextIndent: 0`. This was already a V1-supported escape hatch.

## Consequences

- Existing V1 templates render identically (including the indent-at-each-line quirk).
- Property panel checkbox already wires `leftSpaceRemoved` (Sprint 22g GC). Now the renderer
  consumes it — no panel change required.
- V3 longText `getPaginatedPages` measurement code (`LongTextElement.vue` `getPaginatedPages`)
  is unaffected because measurement happens on the composed text (DOM Measure probe handles
  whitespace identically pre/post-strip).
- Regression risk: extremely low — only templates that *deliberately* set
  `leftSpaceRemoved: 0` previously got V3-style retain-spaces; if any business depended on V3
  retaining, they were already broken vs V1 and now match V1.

## Mitigation

- Added vitest case `render.ts:renderLongTextElement` "per-line indent appears after every newline".
- Added vitest case `render.ts:renderLongTextElement` "leftSpaceRemoved default strips leading
  whitespace on every line".
- Added explicit `leftSpaceRemoved: 0` case proving opt-out path still works.
- Documented in `docs/upgrade-to-v3.md` Behavior Changes — Free-form longText that previously
  rendered with persistent leading whitespace via V3 will now strip; set `leftSpaceRemoved: 0`
  to restore.
