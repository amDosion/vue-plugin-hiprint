/**
 * panel.spec.ts — panelSchema + nested option groups.
 *
 * Verifies the panel envelope around printElements, optional sub-schemas
 * (watermark / grid / guideLines / printMargin), and that paper-number
 * positioning fields coerce strings.
 */
import { describe, it, expect } from 'vitest'
import {
  panelSchema,
  watermarkOptionsSchema,
  gridOptionsSchema,
  guideLineSchema,
  printMarginOptionsSchema,
} from '../panel'

describe('panelSchema', () => {
  it('parses minimal valid panel', () => {
    const out = panelSchema.parse({ index: 0, name: '1', width: 210, height: 297 })
    expect(out.index).toBe(0)
    expect(out.width).toBe(210)
    expect(out.height).toBe(297)
  })

  it('parses panel with printElements', () => {
    const out = panelSchema.parse({
      index: 0,
      name: '1',
      width: 210,
      height: 297,
      printElements: [
        {
          options: { left: 10, top: 10 },
          printElementType: { type: 'text', tid: 'default.text' },
        },
      ],
    })
    expect(out.printElements?.length).toBe(1)
  })

  it('parses paper number positioning (string coercion)', () => {
    const out = panelSchema.parse({
      width: 210,
      height: 297,
      paperNumberLeft: '100',
      paperNumberTop: '20',
      paperNumberDisabled: 'true',
    })
    expect(out.paperNumberLeft).toBe(100)
    expect(out.paperNumberTop).toBe(20)
    expect(out.paperNumberDisabled).toBe(true)
  })

  it('accepts name as number (V1 legacy)', () => {
    const out = panelSchema.parse({ index: 0, name: 1, width: 210, height: 297 })
    expect(out.name).toBe(1)
  })

  it('parses orient enum', () => {
    expect(
      panelSchema.parse({ width: 210, height: 297, orient: 'landscape' }).orient,
    ).toBe('landscape')
    expect(() => panelSchema.parse({ orient: 'diagonal' })).toThrow()
  })

  it('preserves unknown panel keys via .loose()', () => {
    const out = panelSchema.parse({
      width: 210,
      height: 297,
      customBizFlag: true,
    }) as Record<string, unknown>
    expect(out.customBizFlag).toBe(true)
  })
})

describe('watermarkOptionsSchema', () => {
  it('parses with all fields', () => {
    const out = watermarkOptionsSchema.parse({
      text: '机密',
      color: '#999999',
      fontSize: '14',
      angle: -30,
      opacity: '0.5',
    })
    expect(out.text).toBe('机密')
    expect(out.fontSize).toBe(14)
    expect(out.opacity).toBe(0.5)
  })
})

describe('gridOptionsSchema', () => {
  it('parses with show + size', () => {
    const out = gridOptionsSchema.parse({ show: true, size: '5', color: '#eee' })
    expect(out.show).toBe(true)
    expect(out.size).toBe(5)
  })
})

describe('guideLineSchema', () => {
  it('parses axis x/y + numeric position', () => {
    const a = guideLineSchema.parse({ axis: 'x', position: '50' })
    expect(a.axis).toBe('x')
    expect(a.position).toBe(50)
    const b = guideLineSchema.parse({ axis: 'y', position: 100 })
    expect(b.axis).toBe('y')
  })
})

describe('printMarginOptionsSchema', () => {
  it('parses 4-sided margins with coercion', () => {
    const out = printMarginOptionsSchema.parse({
      top: '10',
      right: 10,
      bottom: '10',
      left: 10,
    })
    expect(out.top).toBe(10)
    expect(out.right).toBe(10)
  })
})
