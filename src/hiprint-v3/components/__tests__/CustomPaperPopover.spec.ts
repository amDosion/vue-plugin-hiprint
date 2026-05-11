/**
 * CustomPaperPopover.spec.ts — TB-004 popover SFC unit tests (Sprint 22a).
 *
 * Pure component tests — no stores. The popover is dumb: it owns its own
 * w/h refs, prefills from `initialWidth` / `initialHeight` (pt → mm) when
 * `open` flips true, and emits `submit` (mm payload) / `close` on actions.
 * Conversion mm → pt is the parent's concern (HiprintToolbar covers that).
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CustomPaperPopover from '../CustomPaperPopover.vue'

describe('CustomPaperPopover — render', () => {
  it('renders nothing when open=false', () => {
    const w = mount(CustomPaperPopover, { props: { open: false } })
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    w.unmount()
  })

  it('renders dialog with two number inputs + 2 action buttons when open=true', () => {
    const w = mount(CustomPaperPopover, { props: { open: true } })
    const dialog = w.find('[role="dialog"][aria-label="Custom paper size"]')
    expect(dialog.exists()).toBe(true)
    const inputs = dialog.findAll('input[type="number"]')
    expect(inputs.length).toBe(2)
    const buttons = dialog.findAll('.actions button')
    expect(buttons.length).toBe(2)
    // Cancel + Apply
    expect(buttons[0]!.text()).toBe('Cancel')
    expect(buttons[1]!.text()).toBe('Apply')
    w.unmount()
  })

  it('defaults to A4 (210 x 297 mm) when no initialWidth/Height supplied', () => {
    const w = mount(CustomPaperPopover, { props: { open: true } })
    const inputs = w.findAll('input[type="number"]')
    expect((inputs[0]!.element as HTMLInputElement).value).toBe('210')
    expect((inputs[1]!.element as HTMLInputElement).value).toBe('297')
    w.unmount()
  })

  it('prefills inputs by converting initialWidth/Height from pt → mm', () => {
    // A4 in pt = (210/25.4)*72 ≈ 595.276; (297/25.4)*72 ≈ 841.890
    const ptW = (210 / 25.4) * 72
    const ptH = (297 / 25.4) * 72
    const w = mount(CustomPaperPopover, {
      props: { open: true, initialWidth: ptW, initialHeight: ptH },
    })
    const inputs = w.findAll('input[type="number"]')
    expect((inputs[0]!.element as HTMLInputElement).value).toBe('210')
    expect((inputs[1]!.element as HTMLInputElement).value).toBe('297')
    w.unmount()
  })

  it('round-trips arbitrary pt values to nearest mm', () => {
    // 100 mm = (100/25.4)*72 ≈ 283.464 pt
    const ptW = (100 / 25.4) * 72
    const ptH = (50 / 25.4) * 72
    const w = mount(CustomPaperPopover, {
      props: { open: true, initialWidth: ptW, initialHeight: ptH },
    })
    const inputs = w.findAll('input[type="number"]')
    expect((inputs[0]!.element as HTMLInputElement).value).toBe('100')
    expect((inputs[1]!.element as HTMLInputElement).value).toBe('50')
    w.unmount()
  })
})

describe('CustomPaperPopover — events', () => {
  it('emits submit with current { width, height } in mm', async () => {
    const w = mount(CustomPaperPopover, { props: { open: true } })
    const inputs = w.findAll('input[type="number"]')
    await inputs[0]!.setValue(120)
    await inputs[1]!.setValue(80)
    await w.find('.actions button.primary').trigger('click')
    const events = w.emitted('submit')
    expect(events).toBeTruthy()
    expect(events!.length).toBe(1)
    expect(events![0]![0]).toEqual({ width: 120, height: 80 })
    w.unmount()
  })

  it('emits close on Cancel click', async () => {
    const w = mount(CustomPaperPopover, { props: { open: true } })
    const cancel = w.findAll('.actions button')[0]!
    await cancel.trigger('click')
    expect(w.emitted('close')).toBeTruthy()
    expect(w.emitted('submit')).toBeFalsy()
    w.unmount()
  })

  it('stops click propagation so clicks inside do not close via outer handlers', async () => {
    const w = mount(CustomPaperPopover, { props: { open: true } })
    const dialog = w.find('[role="dialog"]')
    // The popover binds @click.stop — a click inside should not bubble.
    // We simulate by listening on the document and verifying no bubble.
    let bubbled = false
    const listener = (): void => {
      bubbled = true
    }
    document.addEventListener('click', listener)
    await dialog.trigger('click')
    document.removeEventListener('click', listener)
    expect(bubbled).toBe(false)
    w.unmount()
  })
})

describe('CustomPaperPopover — open watcher', () => {
  it('re-prefills inputs when open flips false → true with new initial values', async () => {
    const w = mount(CustomPaperPopover, {
      props: { open: false, initialWidth: undefined, initialHeight: undefined },
    })
    // First open: A4 defaults
    await w.setProps({ open: true })
    let inputs = w.findAll('input[type="number"]')
    expect((inputs[0]!.element as HTMLInputElement).value).toBe('210')
    // Close, change initial, reopen → values reflect new initial
    await w.setProps({ open: false })
    await w.setProps({
      open: true,
      initialWidth: (148 / 25.4) * 72, // A5 width
      initialHeight: (210 / 25.4) * 72, // A5 height
    })
    inputs = w.findAll('input[type="number"]')
    expect((inputs[0]!.element as HTMLInputElement).value).toBe('148')
    expect((inputs[1]!.element as HTMLInputElement).value).toBe('210')
    w.unmount()
  })
})
