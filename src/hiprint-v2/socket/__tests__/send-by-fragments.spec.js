/**
 * send-by-fragments.spec.js — Test socket-null guard (R3 silent #4).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendByFragments } from '../send-by-fragments.js'

describe('sendByFragments', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.restoreAllMocks()
  })

  it('returns early when html empty', () => {
    const socket = { emit: vi.fn() }
    sendByFragments(socket, { html: '' })
    vi.runAllTimers()
    expect(socket.emit).not.toHaveBeenCalled()
  })

  it('returns early when socket null', () => {
    sendByFragments(null, { html: 'x'.repeat(100) })
    vi.runAllTimers()
    // no throw
  })

  it('emits fragments for each split', () => {
    const socket = { emit: vi.fn() }
    sendByFragments(socket, {
      html: 'x'.repeat(150_000), // 3 fragments at default 50000
      fragmentSize: 50_000,
      sendInterval: 10,
      jobId: 'abc',
    })
    vi.runAllTimers()
    expect(socket.emit).toHaveBeenCalledTimes(3)
    const firstCall = socket.emit.mock.calls[0]
    expect(firstCall[0]).toBe('printByFragments')
    expect(firstCall[1].index).toBe(0)
    expect(firstCall[1].total).toBe(3)
    expect(firstCall[1].jobId).toBe('abc')
    // internal fields stripped
    expect(firstCall[1].generateHTMLInterval).toBeUndefined()
    expect(firstCall[1].printByFragments).toBeUndefined()
  })

  it('[R3 silent #4] socket null mid-flight → warn + skip emit, no throw', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let socket = { emit: vi.fn() }
    sendByFragments(socket, {
      html: 'x'.repeat(120_000),
      fragmentSize: 50_000,
      sendInterval: 10,
    }, { getSocket: () => socket })
    // Simulate socket invalidation between fragments
    vi.advanceTimersByTime(15) // fire fragment 0
    socket = null // hiwebSocket.stop() invalidates
    vi.runAllTimers()
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('socket closed, dropping fragment')
    )
  })

  it('[R3 silent #4] socket.emit throw caught + logged', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const socket = {
      emit: vi.fn(() => {
        throw new Error('emit boom')
      }),
    }
    sendByFragments(socket, { html: 'x'.repeat(60_000) })
    vi.runAllTimers()
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('emit failed for fragment'),
      expect.any(Error)
    )
  })

  it('single fragment for small content', () => {
    const socket = { emit: vi.fn() }
    sendByFragments(socket, { html: 'short' })
    vi.runAllTimers()
    expect(socket.emit).toHaveBeenCalledTimes(1)
    expect(socket.emit.mock.calls[0][1].total).toBe(1)
    expect(socket.emit.mock.calls[0][1].htmlFragment).toBe('short')
  })
})
