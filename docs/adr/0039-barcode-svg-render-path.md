# ADR-0039: Barcode / QR code render path — V3 uses SVG, not canvas

- **Status:** accepted
- **Date:** 2026-05-12
- **Deciders:** amDosion
- **Related:** TKT-369 (Sprint 22g wave 3 Stream GL), V3-PARITY-MATRIX 04-barcode-qrcode §"🟡 PARTIAL" TKT-369, V1 bundle.js line 10110-10125

## Context

V1 supports two render paths for 1D barcodes and QR codes:

- **Path A (legacy)** — `text` element with `textType: 'barcode'|'qrcode'`. V1 invokes `JsBarcode` (canvas) for 1D codes and `qrcode.js` (`useSVG: true`) for QR codes.
- **Path B (V1 dedicated etypes)** — `type: 'barcode'|'qrcode'`. V1 invokes `bwip-js` → SVG.

V3 unifies both paths on `bwip-js → SVG`:

- `src/hiprint-v3/components/elements/BarcodeElement.vue` (designer preview) — `bwipjs.toSVG()` → DOMParser → mount.
- `src/hiprint-v3/print/render.ts` `renderBarcodeElement` / `renderQrcodeElement` (print pipeline) — same.

V1 Path A canvas-based barcode rendering is **not** ported to V3. The parity matrix flagged TKT-369 as a PARTIAL because V3 visual output may differ from a printer driver that handles SVG vs PNG differently.

## Decision

**V3 keeps SVG-only barcode / QR rendering. No canvas fallback.**

- Both designer preview and print pipeline use `bwip-js → SVG`.
- bwip-js handles 18 V1 Path A barcodeMode values via `mapBarcodeMode` (TKT-023 / TKT-371) and 19 V1 Path B qrcodeType values via direct `bcid` passthrough.
- `collectBwipPassthrough` (TKT-364) forwards 16 secondary bwip-js opts (backgroundcolor, bordercolor, textyalign, addon, ...) for full V1 Path B parity.

## Rationale

1. **Crisp print output.** SVG vector output scales to any printer DPI without rasterization aliasing. Canvas output (V1 Path A `JsBarcode.canvas`) was capped at the canvas pixel grid and aliased on high-DPI printers.
2. **PDF round-trip.** `jspdf`'s SVG import preserves vector paths; PNG import rasterizes. The vue-admin-main downstream PDF pipeline benefits from SVG end-to-end.
3. **One pipeline.** Designer preview + print pipeline share `bwipjs.toSVG()` so designer WYSIWYG matches print output exactly. V1 Path A's canvas-vs-SVG split produced subtle differences (e.g. text-margin pull-up rendered differently in canvas vs SVG).
4. **Bundle size.** Dropping `JsBarcode` + `qrcode.js` (both V1 plugins) in favour of `bwip-js` (single library) saves ~80 KB minified.
5. **bwip-js feature parity.** bwip-js supports all 18 V1 Path A barcodeMode formats, all 19 V1 Path B qrcodeType values, and exposes more options than V1 surfaced. TKT-364 forwards the additional 16 bwip-js opts (bordercolor, textyalign, addon, etc.) for callers who want them.

## Consequences

### Positive

- One render path; one mental model.
- Vector everywhere — printer-resolution-independent.
- Smaller bundle.
- Full bwip-js opts surface available to designers.

### Negative

- Some legacy printer drivers handle SVG paths less well than rasterized PNG. **Mitigation:** business consumers can use the V3 `print/render.ts` SVG output then convert to PNG at the application boundary via `dom-to-image-more` if a specific driver misbehaves.
- V1 Path A used `JsBarcode` which has slightly different rendering for CODE128 variants A/B/C (subset selection). bwip-js auto-detects the subset based on payload, which usually produces the same result, but a hand-crafted payload that forced CODE128A on JsBarcode may render as auto-128 in bwip-js. **Mitigation:** business consumers that need explicit subset selection can use `bcid: 'code128'` + the `parsefnc: true` mode in bwip-js to embed the function-code switches in the payload itself.

## Implementation

- `src/hiprint-v3/components/elements/BarcodeElement.vue` (lines 100-109) — `bwipjs.toSVG(...)` invocation.
- `src/hiprint-v3/components/elements/QrcodeElement.vue` (lines 95-104) — `bwipjs.toSVG(...)` invocation.
- `src/hiprint-v3/print/render.ts` (lines 475-512 for barcode, 547-579 for qrcode) — same.
- `src/hiprint-v3/internal/path-a-mapping.ts` — V1 Path A enum → bwip-js bcid mapping.
- `src/hiprint-v3/internal/bwipjs-opts.ts` (TKT-364) — extra bwip-js opts passthrough.

## Test plan

- `src/hiprint-v3/components/elements/__tests__/BarcodeElement.spec.ts` — confirms `bwipjs.toSVG` is invoked with the right `bcid` for both Path A barcodeMode JSON and Path B barcodeType JSON.
- `src/hiprint-v3/components/elements/__tests__/QrcodeElement.spec.ts` — confirms SVG output for qrcode.
- `src/hiprint-v3/internal/__tests__/path-a-mapping.spec.ts` — 18-row V1 §B.1.2 enum table.
- `src/hiprint-v3/internal/__tests__/bwipjs-opts.spec.ts` — TKT-364 extra-opts forwarding contract.
- E2E follow-up (deferred to a downstream sprint): pixel-diff a V1 baseline barcode against the V3 SVG output to lock visual parity at the production printer driver.

## Status / lock

- SVG-only is the V3 contract. Any future PR that adds a canvas fallback requires an ADR superseding this one.
