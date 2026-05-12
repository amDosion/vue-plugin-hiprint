/**
 * print-lock-css-export.spec.ts — TKT-256: package.json `exports` for
 * `vue-plugin-hiprint/print-lock.css`.
 *
 * V3 callers want to opt in to the print-lock stylesheet with a single
 * `import 'vue-plugin-hiprint/print-lock.css'` instead of self-hosting.
 *
 * We assert two things:
 *
 *   1. `package.json` declares a `./print-lock.css` exports field entry that
 *      resolves to a real file on disk.
 *   2. The resolved file is a non-empty CSS document containing the V1
 *      `.hiprint-printPaper` selector (the load-bearing class the print
 *      pipeline injects on every panel — used as a sanity check that we're
 *      pointing at the right file, not e.g. an empty placeholder).
 *
 * We can't `import 'vue-plugin-hiprint/print-lock.css'` literally here
 * because this spec executes from inside the package — Vitest does not
 * resolve the package's own exports. Reading the file the exports field
 * points to is the strongest assertion available without a published-package
 * integration test.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Repo root from this spec's location: src/hiprint-v3/__tests__/x.spec.ts
const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '../../..')

describe('TKT-256 — package.json print-lock.css export', () => {
  it('package.json `exports["./print-lock.css"]` points to a real CSS file with V1 selectors', () => {
    const pkgPath = resolve(REPO_ROOT, 'package.json')
    expect(existsSync(pkgPath)).toBe(true)
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as {
      exports?: Record<string, unknown>
    }
    expect(pkg.exports).toBeDefined()
    const entry = pkg.exports?.['./print-lock.css']
    expect(typeof entry).toBe('string')
    // Resolve the relative path from repo root.
    const cssPath = resolve(REPO_ROOT, String(entry))
    expect(existsSync(cssPath)).toBe(true)
    const css = readFileSync(cssPath, 'utf-8')
    expect(css.length).toBeGreaterThan(0)
    // Sanity-check that this is the print-lock file, not a placeholder —
    // the .hiprint-printPaper selector is the load-bearing class.
    expect(css).toContain('.hiprint-printPaper')
    expect(css).toMatch(/@media\s+print/)
  })
})
