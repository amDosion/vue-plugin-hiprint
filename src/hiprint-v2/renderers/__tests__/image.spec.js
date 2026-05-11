/**
 * image.spec.js — image renderer (loadImage onerror, base64 conversion).
 */
import { describe, it, expect, vi } from 'vitest'
import { loadImage } from '../image.js'

describe('loadImage', () => {
  it('calls onerror immediately when src is empty', () => {
    const onerror = vi.fn()
    const onload = vi.fn()
    loadImage('', onload, onerror)
    expect(onerror).toHaveBeenCalledWith(expect.any(Error))
    expect(onload).not.toHaveBeenCalled()
  })

  it('calls onerror immediately when src is null/undefined', () => {
    const onerror = vi.fn()
    loadImage(null, () => {}, onerror)
    expect(onerror).toHaveBeenCalled()
  })

  it('does not throw when onerror is missing (empty src)', () => {
    expect(() => loadImage('', () => {})).not.toThrow()
  })

  it('[silent #8] binds onerror BEFORE setting src (callback chain safety)', () => {
    // Mock Image constructor to inspect order
    const operations = []
    const origImage = global.Image
    global.Image = class MockImage {
      set onerror(fn) {
        operations.push('onerror-bound')
      }
      set onload(fn) {
        operations.push('onload-bound')
      }
      set src(v) {
        operations.push('src-set:' + v)
      }
      get complete() {
        return false
      }
    }
    loadImage('http://example.com/img.png', () => {}, () => {})
    // onerror + onload bound first, src set last
    expect(operations[operations.length - 1]).toBe('src-set:http://example.com/img.png')
    expect(operations).toContain('onerror-bound')
    global.Image = origImage
  })
})
