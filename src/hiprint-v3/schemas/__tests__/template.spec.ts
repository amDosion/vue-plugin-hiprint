/**
 * template.spec.ts — top-level templateSchema + helpers.
 *
 * Critical case: parse the real V1-shaped sample template fixture used by
 * the business consumer in e2e tests. This is the superset-compat smoke test
 * (Invariant #13 — any legacy template must parse).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { templateSchema, parseTemplate, safeParseTemplate } from '../template'

const SAMPLE_TEMPLATE_PATH = resolve(
  __dirname,
  '../../../../e2e/tests/fixtures/sample-template.json',
)

function readSample(): unknown {
  return JSON.parse(readFileSync(SAMPLE_TEMPLATE_PATH, 'utf8'))
}

describe('templateSchema', () => {
  it('parses minimal { panels: [] }', () => {
    const out = templateSchema.parse({ panels: [] })
    expect(out.panels).toEqual([])
  })

  it('parses template with templateName + version', () => {
    const out = templateSchema.parse({
      panels: [],
      templateName: 'Invoice',
      version: '1.0.0',
    })
    expect(out.templateName).toBe('Invoice')
    expect(out.version).toBe('1.0.0')
  })

  it('rejects when panels missing', () => {
    expect(() => templateSchema.parse({})).toThrow()
  })

  it('parses the real V1 business sample fixture', () => {
    const json = readSample()
    const out = templateSchema.parse(json)
    expect(out.panels.length).toBeGreaterThan(0)
    const firstPanel = out.panels[0]
    expect(firstPanel?.printElements?.length).toBeGreaterThan(0)
  })

  it('roundtrip parse(parse(json)) is idempotent', () => {
    const json = readSample()
    const once = templateSchema.parse(json)
    const twice = templateSchema.parse(once)
    expect(twice.panels.length).toBe(once.panels.length)
  })

  it('preserves unknown top-level keys via .loose()', () => {
    const out = templateSchema.parse({
      panels: [],
      bizMeta: { author: 'X' },
    }) as Record<string, unknown>
    expect(out.bizMeta).toEqual({ author: 'X' })
  })
})

describe('parseTemplate helper', () => {
  it('returns parsed value on valid input', () => {
    const out = parseTemplate({ panels: [{ index: 0, name: '1', width: 210, height: 297 }] })
    expect(out.panels[0]?.name).toBe('1')
  })

  it('throws ZodError on invalid input', () => {
    expect(() => parseTemplate({})).toThrow()
  })
})

describe('safeParseTemplate helper', () => {
  it('returns discriminated success result', () => {
    const result = safeParseTemplate({ panels: [] })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.panels).toEqual([])
    }
  })

  it('returns discriminated failure result', () => {
    const result = safeParseTemplate('not an object')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBeDefined()
    }
  })
})
