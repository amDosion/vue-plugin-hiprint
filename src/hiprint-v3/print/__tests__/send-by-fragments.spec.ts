/**
 * send-by-fragments.spec.ts — V3 sendByFragments tests (R3 silent #4).
 * Ported 1:1 from V2 socket/__tests__/send-by-fragments.spec.js.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendByFragments, type FragmentSocket } from '../send-by-fragments'

describe('sendByFragments', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.restoreAllMocks()
  })

  it('returns early when html empty', () => {
    const socket: FragmentSocket = { emit: vi.fn() }
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
    const emit = vi.fn()
    const socket: FragmentSocket = { emit }
    sendByFragments(socket, {
      html: 'x'.repeat(150_000), // 3 fragments at default 50000
      fragmentSize: 50_000,
      sendInterval: 10,
      jobId: 'abc',
    })
    vi.runAllTimers()
    expect(emit).toHaveBeenCalledTimes(3)
    const firstCall = emit.mock.calls[0]!
    expect(firstCall[0]).toBe('printByFragments')
    const payload = firstCall[1] as Record<string, unknown>
    expect(payload.index).toBe(0)
    expect(payload.total).toBe(3)
    expect(payload.jobId).toBe('abc')
    // internal fields stripped
    expect(payload.generateHTMLInterval).toBeUndefined()
    expect(payload.printByFragments).toBeUndefined()
  })

  it('[R3 silent #4] socket null mid-flight → warn + skip emit, no throw', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let socket: FragmentSocket | null = { emit: vi.fn() }
    sendByFragments(
      socket,
      {
        html: 'x'.repeat(120_000),
        fragmentSize: 50_000,
        sendInterval: 10,
      },
      { getSocket: () => socket }
    )
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
    const socket: FragmentSocket = {
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
    const emit = vi.fn()
    const socket: FragmentSocket = { emit }
    sendByFragments(socket, { html: 'short' })
    vi.runAllTimers()
    expect(emit).toHaveBeenCalledTimes(1)
    const payload = emit.mock.calls[0]![1] as Record<string, unknown>
    expect(payload.total).toBe(1)
    expect(payload.htmlFragment).toBe('short')
  })
})
