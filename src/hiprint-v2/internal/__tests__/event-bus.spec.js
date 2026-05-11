/**
 * event-bus.spec.js — V2 createEventBus unit tests.
 * 锁住 PM-004 R3 fix: off(key) 不传 fn 时清整 key.
 */
import { describe, it, expect, vi } from 'vitest'
import { createEventBus } from '../event-bus.js'

describe('createEventBus', () => {
  it('on/trigger 基础订阅 + 触发', () => {
    const bus = createEventBus()
    const handler = vi.fn()
    bus.on('greet', handler)
    bus.trigger('greet', 'world')
    expect(handler).toHaveBeenCalledWith('world')
  })

  it('on multiple handlers, trigger 全部调用', () => {
    const bus = createEventBus()
    const h1 = vi.fn()
    const h2 = vi.fn()
    bus.on('e', h1)
    bus.on('e', h2)
    bus.trigger('e', 1, 2)
    expect(h1).toHaveBeenCalledWith(1, 2)
    expect(h2).toHaveBeenCalledWith(1, 2)
  })

  it('off(key, fn) 仅移除该 handler', () => {
    const bus = createEventBus()
    const h1 = vi.fn()
    const h2 = vi.fn()
    bus.on('e', h1)
    bus.on('e', h2)
    bus.off('e', h1)
    bus.trigger('e')
    expect(h1).not.toHaveBeenCalled()
    expect(h2).toHaveBeenCalled()
  })

  it('[PM-004 R3] off(key) 不传 fn 时清整 key', () => {
    const bus = createEventBus()
    const h1 = vi.fn()
    const h2 = vi.fn()
    bus.on('e', h1)
    bus.on('e', h2)
    bus.off('e') // ← undefined fn, 应清整 key
    bus.trigger('e')
    expect(h1).not.toHaveBeenCalled()
    expect(h2).not.toHaveBeenCalled()
  })

  it('off 不存在的 key 无副作用', () => {
    const bus = createEventBus()
    expect(() => bus.off('nope')).not.toThrow()
    expect(() => bus.off('nope', () => {})).not.toThrow()
  })

  it('trigger 不存在 key 无副作用', () => {
    const bus = createEventBus()
    expect(() => bus.trigger('nope', 'arg')).not.toThrow()
  })

  it('clear(key) 等同 off(key)', () => {
    const bus = createEventBus()
    const h = vi.fn()
    bus.on('e', h)
    bus.clear('e')
    bus.trigger('e')
    expect(h).not.toHaveBeenCalled()
  })

  it('getId / getNameWithId 单调递增', () => {
    const bus = createEventBus()
    expect(bus.getId()).toBe(1)
    expect(bus.getId()).toBe(2)
    expect(bus.getNameWithId('panel')).toBe('panel-3')
  })

  it('多个 bus 实例完全独立 (HMR 安全)', () => {
    const a = createEventBus()
    const b = createEventBus()
    const ha = vi.fn()
    a.on('e', ha)
    b.trigger('e')
    expect(ha).not.toHaveBeenCalled()
  })

  it('handler unsubscribe during trigger 不影响当轮其他 handler', () => {
    const bus = createEventBus()
    const calls = []
    const h1 = () => {
      calls.push('h1')
      bus.off('e', h2)
    }
    const h2 = () => {
      calls.push('h2')
    }
    bus.on('e', h1)
    bus.on('e', h2)
    bus.trigger('e')
    // 用 snapshot, h2 在当轮仍被调用
    expect(calls).toEqual(['h1', 'h2'])
  })
})
