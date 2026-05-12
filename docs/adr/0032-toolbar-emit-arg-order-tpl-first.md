# ADR-0032: Toolbar emit signature — `tpl` as first arg (V3 canonical)

- **Status:** accepted
- **Date:** 2026-05-12
- **Deciders:** amDosion
- **Related:** TKT-332 (Sprint 22g wave 2), V1 bundle.js line 13333-13336, V3 `HiprintToolbar.vue` 339-353

## Context

V1 `buildToolbar` fires three callbacks with a `(type, tpl)` argument order:

```js
onPaperChange: function (type, template) { /* ... */ }
onScaleChange: function (scale, template) { /* ... */ }
onAlign: function (type, template) { /* ... */ }
```

V3 `<HiprintToolbar>` emits the same events with `tpl` first:

```ts
emit('paperChange', tpl, name, size)
emit('scaleChange', tpl, scale)
emit('align', tpl, type)
```

TKT-332 flagged this as a 🟡 PARTIAL — V3 inverted the V1 order. The decision was either to flip the emit signatures (breaking change for V3 consumers that already wired @paperChange / @scaleChange / @align) or document and standardise on `tpl` first.

## Decision

**Standardise on `tpl` first across every V3 toolbar event.** Do not flip back to V1 order.

The V1 `(type, tpl)` shape is preserved at the **compat surface** (`buildToolbar` opts.onPaperChange / onScaleChange / onAlign) — `compat/build-toolbar.ts` re-orders args when invoking the V1 callback. This ADR locks the rule: SFC emits use `tpl` first; the compat layer re-orders for V1.

## Rationale

1. **Internal consistency:** Every other V3 emit (save / preview / print / clear / rotate / addPanel / removePanel / switchPanel / templateSelectClick / businessSelectClick) already passes `tpl` first. Inverting only three would create a special case that consumers must memorise.
2. **TypeScript narrowing:** `tpl: PrintTemplate | null | undefined` is the most stable arg and benefits from being first when consumers destructure `(tpl, ...rest)`.
3. **V1 surface untouched:** `compat/build-toolbar.ts:226-237 + 870-879` already wraps V3 emits and re-invokes V1 callbacks with `(type, tpl)`. V1 consumers see the original signature.
4. **No public migration needed:** Only direct SFC consumers (`<HiprintToolbar @paperChange="...">`) follow the V3 rule. Direct SFC use is a V3-new code path — there is no legacy V1 SFC API.

## Consequences

- The 🟡 status moves to ✅ via this ADR (decision-not-code-change).
- V3 SFC consumers: `@paperChange="(tpl, name, size) => ..."` etc.
- V1 compat consumers: `buildToolbar('#tb', tpl, { onPaperChange: (type, tpl) => ... })` keeps working.

## Test lock-in

`build-toolbar.spec.ts` `onPaperChange` test (line 556) asserts the V1 `(type, tpl)` re-order is honoured.

`HiprintToolbar.spec.ts` `paper select change` test (line 190) asserts the SFC emit fires `(tpl, name, size)`.

If either test changes signature, this ADR must be revised first.
