/**
 * compile-formatter.ts — TKT-006 helper.
 *
 * V1 accepts a `formatter` option as EITHER:
 *   - a real function (preferred, current V3 only-accepted form), or
 *   - a string of JS source which V1 compiles via `new Function('return ' + src)()`
 *     (designer-only "advanced tab" textarea — see V1-INVENTORY/etypes/image-html.md).
 *
 * V3 SFCs/render.ts previously only accepted functions, so templates that came
 * from V1 with string-source formatters silently dropped to the default
 * rendering path. This helper normalizes both forms to a function (or null).
 *
 * Behavior:
 *   - typeof input === 'function' → returned as-is.
 *   - typeof input === 'string' and non-empty after trim → compiled via
 *     `new Function('return (' + src + ')')()`. If compilation throws or the
 *     compiled value is not a function, returns null (warned to console).
 *   - anything else (null/undefined/number/object/array) → null.
 *
 * SECURITY: the compiled string source runs in the page context with full DOM
 * access. This is by-design parity with V1 — designer-trusted input only.
 * Business consumers MUST NOT feed untrusted strings here. Document this in
 * integration-guide.md.
 *
 * Signature is generic: the produced function is called with the same args as
 * the V1 formatter contract (value, options, templateData, ...). The return
 * type is widened to unknown so callers explicitly coerce to string.
 */

export type FormatterFn = (...args: unknown[]) => unknown

/**
 * Normalize a formatter option to a callable function (or null).
 *
 * @param input  formatter option from element/printElementType (string or function).
 * @returns      a callable function on success; null if not compilable.
 */
export function compileFormatter(input: unknown): FormatterFn | null {
  if (typeof input === 'function') {
    return input as FormatterFn
  }
  if (typeof input === 'string' && input.trim()) {
    try {
      // Wrap in parens so anonymous `function (..) {..}` parses as expression.
      // V1 uses `new Function('return ' + src)()` — equivalent semantics.
      const fn = new Function('return (' + input + ')')()
      if (typeof fn === 'function') {
        return fn as FormatterFn
      }
    } catch (err) {
      console.warn('[hiprint] compileFormatter failed:', err)
    }
  }
  return null
}
