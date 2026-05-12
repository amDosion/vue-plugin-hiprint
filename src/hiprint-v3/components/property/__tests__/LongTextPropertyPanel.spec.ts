/**
 * LongTextPropertyPanel.spec.ts — Sprint 22c TKT-108.
 *
 * Covers longText-specific surface from
 * `docs/V1-INVENTORY/etypes/text-longtext.md` PART 2 Section B that the
 * generic fallback previously hid: longTextIndent, leftSpaceRemoved,
 * lHeight (= minHeight), and the panel-introduced longTextPaginate
 * tri-state. Position/Font/Padding/Border/Binding share the same shape as
 * TextPropertyPanel and are smoke-checked here.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import {
  useCanvasStore,
  useHistoryStore,
  type CanvasElement,
} from '@hiprint-v3/stores'
import LongTextPropertyPanel from '../LongTextPropertyPanel.vue'

beforeEach(() => {
  setActivePinia(createPinia())
})

function seedLongText(extra: Record<string, unknown> = {}): {
  canvas: ReturnType<typeof useCanvasStore>
  history: ReturnType<typeof useHistoryStore>
  getElement: () => CanvasElement | undefined
} {
  const canvas = useCanvasStore()
  const history = useHistoryStore()
  canvas.addPanel({ id: 'p1', width: 540, height: 600 })
  canvas.addElement('p1', {
    id: 'e1',
    tid: 'default.longText',
    printElementType: { type: 'longText', title: 'longText' },
    options: {
      left: 5,
      top: 8,
      width: 540,
      height: 42,
      fontSize: 12,
      lineHeight: 15,
      color: '#000000',
      title: 'LT',
      field: 'address',
      ...extra,
    },
  })
  canvas.selectMultiple(['e1'])
  const getElement = () =>
    canvas.panels[0]?.printElements.find((e) => e.id === 'e1')
  return { canvas, history, getElement }
}

function getOpts(el: CanvasElement | undefined): Record<string, unknown> {
  return (el?.options as Record<string, unknown>) ?? {}
}

describe('LongTextPropertyPanel — surface', () => {
  it('renders bound to element.options', async () => {
    const { getElement } = seedLongText()
    const w = mount(LongTextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    expect(
      (w.find('input.lt-left').element as HTMLInputElement).value
    ).toBe('5')
    expect(
      (w.find('input.lt-width').element as HTMLInputElement).value
    ).toBe('540')
    expect(
      (w.find('input.lt-font-size').element as HTMLInputElement).value
    ).toBe('12')
    expect(
      (w.find('input.lt-line-height').element as HTMLInputElement).value
    ).toBe('15')
    w.unmount()
  })

  it('Position / Font / Align / Layout / Border / Padding / Background / Binding / Pagination / Misc legends render', async () => {
    const { getElement } = seedLongText()
    const w = mount(LongTextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const legends = w.findAll('legend').map((l) => l.text())
    expect(legends).toContain('Position')
    expect(legends).toContain('Font')
    expect(legends).toContain('Align')
    expect(legends).toContain('Layout')
    expect(legends).toContain('Border')
    expect(legends).toContain('Padding')
    expect(legends).toContain('Background')
    expect(legends).toContain('Binding')
    expect(legends).toContain('Pagination')
    expect(legends).toContain('Misc')
    w.unmount()
  })

  it('does NOT render textType / textContentVerticalAlign / dataType controls (longText-incompatible)', async () => {
    const { getElement } = seedLongText()
    const w = mount(LongTextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    // None of these classes should exist anywhere in the longText panel.
    expect(w.find('select.tx-text-type').exists()).toBe(false)
    expect(w.find('button.tx-valign-middle').exists()).toBe(false)
    expect(w.find('select.tx-data-type').exists()).toBe(false)
    // And our own naming should be present.
    expect(w.find('.hiprint-longtext-property-panel').exists()).toBe(true)
    w.unmount()
  })
})

describe('LongTextPropertyPanel — field changes', () => {
  it('longTextIndent input writes a sanitized integer (≥ 0)', async () => {
    const { getElement } = seedLongText()
    const w = mount(LongTextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const ind = w.find('input.lt-indent')
    ;(ind.element as HTMLInputElement).value = '12'
    await ind.trigger('input')
    expect(getOpts(getElement()).longTextIndent).toBe(12)
    // Negative input gets clamped to 0 (V1 XSS-C1 hardening parity).
    ;(ind.element as HTMLInputElement).value = '-7'
    await ind.trigger('input')
    expect(getOpts(getElement()).longTextIndent).toBe(0)
    w.unmount()
  })

  it('leftSpaceRemoved checkbox toggles options.leftSpaceRemoved', async () => {
    const { getElement } = seedLongText()
    const w = mount(LongTextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const cb = w.find('input.lt-left-space-removed')
    ;(cb.element as HTMLInputElement).checked = true
    await cb.trigger('change')
    expect(getOpts(getElement()).leftSpaceRemoved).toBe(true)
    w.unmount()
  })

  it('Min height input writes options.lHeight (V1 key)', async () => {
    const { getElement } = seedLongText()
    const w = mount(LongTextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const mh = w.find('input.lt-min-height')
    await mh.setValue('60')
    await mh.trigger('blur')
    expect(getOpts(getElement()).lHeight).toBe(60)
    w.unmount()
  })

  it('Min height empty input clears lHeight to undefined', async () => {
    const { getElement } = seedLongText({ lHeight: 50 })
    const w = mount(LongTextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const mh = w.find('input.lt-min-height')
    await mh.setValue('')
    await mh.trigger('blur')
    expect(getOpts(getElement()).lHeight).toBeUndefined()
    w.unmount()
  })

  it('lineHeight commit fires a history snapshot', async () => {
    const { getElement, history } = seedLongText()
    const w = mount(LongTextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const lh = w.find('input.lt-line-height')
    ;(lh.element as HTMLInputElement).value = '20'
    await lh.trigger('input')
    expect(getOpts(getElement()).lineHeight).toBe(20)
    const before = history.canUndo
    await lh.trigger('change')
    expect(history.canUndo).not.toBe(before)
    w.unmount()
  })

  it('longTextPaginate tri-state: empty=auto (undefined), true=on, false=off', async () => {
    const { getElement, canvas } = seedLongText({ longTextPaginate: true })
    const w = mount(LongTextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    await w.find('select.lt-long-text-paginate').setValue('false')
    expect(getOpts(getElement()).longTextPaginate).toBe(false)
    await w.setProps({
      element: canvas.panels[0]!.printElements.find((e) => e.id === 'e1')!,
    })
    await w.find('select.lt-long-text-paginate').setValue('')
    expect(getOpts(getElement()).longTextPaginate).toBeUndefined()
    await w.setProps({
      element: canvas.panels[0]!.printElements.find((e) => e.id === 'e1')!,
    })
    await w.find('select.lt-long-text-paginate').setValue('true')
    expect(getOpts(getElement()).longTextPaginate).toBe(true)
    w.unmount()
  })

  it('formatter textarea writes string source to options.formatter', async () => {
    const { getElement } = seedLongText()
    const w = mount(LongTextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const ta = w.find('textarea.lt-formatter')
    await ta.setValue('function(){ return "x"; }')
    await ta.trigger('blur')
    expect(getOpts(getElement()).formatter).toBe(
      'function(){ return "x"; }'
    )
    w.unmount()
  })

  it('field commit on Enter writes options.field', async () => {
    const { getElement } = seedLongText()
    const w = mount(LongTextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const f = w.find('input.lt-field')
    await f.setValue('user.address.line1')
    await f.trigger('keydown.enter')
    expect(getOpts(getElement()).field).toBe('user.address.line1')
    w.unmount()
  })

  it('pageBreak comma-list parses to number[]', async () => {
    const { getElement } = seedLongText()
    const w = mount(LongTextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const pb = w.find('input.lt-page-break')
    await pb.setValue('2, 4')
    await pb.trigger('blur')
    expect(getOpts(getElement()).pageBreak).toEqual([2, 4])
    w.unmount()
  })

  it('textAlign center button writes options.textAlign=center', async () => {
    const { getElement } = seedLongText()
    const w = mount(LongTextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    await w.find('button.lt-align-center').trigger('click')
    expect(getOpts(getElement()).textAlign).toBe('center')
    w.unmount()
  })

  it('positionLocked + fixed checkboxes round-trip', async () => {
    const { getElement } = seedLongText()
    const w = mount(LongTextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    const pl = w.find('input.lt-position-locked')
    ;(pl.element as HTMLInputElement).checked = true
    await pl.trigger('change')
    expect(getOpts(getElement()).positionLocked).toBe(true)
    const fx = w.find('input.lt-fixed')
    ;(fx.element as HTMLInputElement).checked = true
    await fx.trigger('change')
    expect(getOpts(getElement()).fixed).toBe(true)
    w.unmount()
  })

  it('border side selects write borderTop / borderLeft V1 keys', async () => {
    const { getElement } = seedLongText()
    const w = mount(LongTextPropertyPanel, {
      props: { element: getElement()! },
    })
    await w.vm.$nextTick()
    await w.find('select.lt-border-top').setValue('solid')
    await w.find('select.lt-border-left').setValue('dotted')
    const o = getOpts(getElement())
    expect(o.borderTop).toBe('solid')
    expect(o.borderLeft).toBe('dotted')
    w.unmount()
  })
})
