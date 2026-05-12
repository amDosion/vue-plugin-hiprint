# ADR-0038: HTML element drag uses sanitized JSON only

- **Status:** accepted
- **Date:** 2026-05-12
- **Deciders:** amDosion
- **Related:** TKT-357 (Sprint 22g wave 3 Stream GL), V3-PARITY-MATRIX 03-image-html §"🔴 MISSING" TKT-357, V1 bundle.js line 5042-5070

## Context

V1 (`bundle.js` 5042-5070) attaches drag-handlers to `.hiprint-printElement-html` such that dragging an html element between panels uses the V1 designer's "selected element" copy buffer rather than HTML5 `dataTransfer`. The dragstart handler in V1 does **not** call `event.dataTransfer.setData('text/html', element.outerHTML)` — only the serializable element JSON travels through `_contextCopyElements`.

V3 wires drag-and-drop via Vue 3 default behaviour. The html element wrapper is `[draggable]="true"` (inherited from `ElementWrapper.vue`), and `@dragstart` on the wrapper sets `event.dataTransfer.setData('application/x-hiprint-element', JSON.stringify(elementJson))` — same payload shape V1's right-click copy used.

The matrix row asks whether V3 should ever ship `event.dataTransfer.setData('text/html', innerHTML)`. That would expose the rendered HTML (including user-supplied formatter output / content string) to drop targets outside the V3 canvas — every other Vue host in the same page, every browser, every text editor. The risk surface is the html etype's Invariant #2 (raw innerHTML by design): a malicious template could ship a payload via "drag this onto Word".

## Decision

**V3 drag from html elements uses sanitized JSON only.**

- `ElementWrapper.vue` sets exactly one MIME type on dataTransfer: `application/x-hiprint-element` (JSON of the element shape).
- `ElementWrapper.vue` does **not** call `setData('text/html', ...)` for any etype, including html. The html etype's `v-html` payload never leaves the V3 canvas via dataTransfer.
- Cross-panel drop within the V3 canvas re-reads the JSON via `JSON.parse` and reconstructs the element. Same code path the right-click "粘贴元素" menu item uses.
- Inter-app drops (Word, browser, text editor) get an empty payload — no `text/html`, no `text/plain` — matching V1 behaviour (V1 drops outside the V3 canvas were also empty).

## Rationale

1. **Invariant alignment.** Invariant #2 says html etype renders via `v-html` because business owns sanitization — the rendered output is _trusted_ inside the canvas. Once that string leaves the canvas via dataTransfer, the trust boundary breaks. JSON-only keeps the rendered HTML inside the canvas.
2. **V1 parity.** V1's dragstart did not set HTML on dataTransfer. ADR aligns V3 with V1 behaviour.
3. **No business demand.** No business consumer has requested cross-app drag of rendered HTML. Adding it later (behind an explicit opt-in flag like `dataTransferHtmlOptIn: true`) is reversible; defaulting to-on is not.
4. **Audit trail.** Every drag in V3 carries the same MIME type. Drop targets that whitelist `application/x-hiprint-element` are immune to MIME-confusion attacks.

## Consequences

### Positive

- One uniform MIME type across all etypes. Simpler drop handlers.
- No content leakage on cross-app drag.
- Honours the html element's "Invariant #2" trust boundary.

### Negative

- Users can _not_ drag an html element from the V3 canvas into another text editor as rendered HTML. (V1 couldn't either, so this is parity, not regression.)
- Future feature request "drag rendered HTML to clipboard" would need a separate opt-in path with explicit sanitization.

## Implementation

- `src/hiprint-v3/components/elements/ElementWrapper.vue` — confirms the single-MIME dataTransfer policy in code comments alongside the existing `@dragstart` handler.
- No code change required by this ADR (V3 already implements the policy); ADR locks the contract.

## Test plan

- `e2e/tests/html-drag-xss.spec.ts` — drag an html element with payload `<img src=x onerror=alert(1)>` between panels and assert (a) it lands correctly in the new panel as a v-html node, (b) the drop event in a non-canvas target produces no `text/html` payload (DataTransfer.getData('text/html') === '').

## Status / lock

- The single-MIME contract is the V3 default. Any future PR that adds `setData('text/html', ...)` to `ElementWrapper.vue` requires an ADR superseding this one.
