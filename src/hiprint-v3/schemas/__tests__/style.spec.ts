/**
 * style.spec.ts — sharedStyleSchema / baseElementOptionsSchema.
 *
 * Verifies coerce.number on geometry, booleanLike acceptance of "true"/"false"
 * strings, and that `.loose()` (applied at the element layer) lets unknown
 * keys survive. baseElementOptionsSchema itself is a plain object schema; the
 * looseness check uses the elementSchema wrapper indirectly (see element.spec.ts);
 * here we just verify that valid V1 string-shaped data parses into typed output.
 */
import { describe, it, expect } from 'vitest'
import {
  baseElementOptionsSchema,
  geometryStyleSchema,
  booleanLikeSchema,
  numberLikeSchema,
} from '../style'

describe('numberLikeSchema (z.coerce.number)', () => {
  it('coerces string "100" → 100', () => {
    expect(numberLikeSchema.parse('100')).toBe(100)
  })

  it('accepts native number unchanged', () => {
    expect(numberLikeSchema.parse(42)).toBe(42)
  })

  it('rejects truly non-numeric', () => {
    expect(() => numberLikeSchema.parse('abc')).toThrow()
  })
})

describe('booleanLikeSchema', () => {
  it('accepts boolean true / false', () => {
    expect(booleanLikeSchema.parse(true)).toBe(true)
    expect(booleanLikeSchema.parse(false)).toBe(false)
  })

  it('coerces literal "true" / "false"', () => {
    expect(booleanLikeSchema.parse('true')).toBe(true)
    expect(booleanLikeSchema.parse('false')).toBe(false)
  })

  it('rejects other strings', () => {
    expect(() => booleanLikeSchema.parse('yes')).toThrow()
  })
})

describe('geometryStyleSchema coercion', () => {
  it('parses width/height/x/y from strings', () => {
    const result = geometryStyleSchema.parse({
      left: '10',
      top: '20',
      width: '100',
      height: '50',
    })
    expect(result.left).toBe(10)
    expect(result.top).toBe(20)
    expect(result.width).toBe(100)
    expect(result.height).toBe(50)
  })

  it('all fields optional — empty object parses', () => {
    expect(geometryStyleSchema.parse({})).toEqual({})
  })
})

describe('baseElementOptionsSchema', () => {
  it('parses V1 mixed-shape options object', () => {
    const result = baseElementOptionsSchema.parse({
      left: '12',
      top: 30,
      width: '120',
      height: 16,
      fontSize: '14',
      fontWeight: 'bold',
      textAlign: 'center',
      title: 'Hello',
      field: 'user.name',
      testData: 'preview',
    })
    expect(result.left).toBe(12)
    expect(result.width).toBe(120)
    expect(result.fontSize).toBe(14)
    expect(result.textAlign).toBe('center')
    expect(result.title).toBe('Hello')
  })

  it('rejects invalid textAlign enum', () => {
    expect(() => baseElementOptionsSchema.parse({ textAlign: 'middle' })).toThrow()
  })
})
