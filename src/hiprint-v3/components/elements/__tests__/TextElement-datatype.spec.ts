/**
 * TextElement-datatype.spec.ts — TKT-024 dataType + format pipeline.
 *
 * Verifies that V1's `options.dataType` ('text' / 'datetime' / 'boolean')
 * + `options.format` runs BEFORE the formatter chain, matching V1 bundle.js
 * line 10037 contract (getData → updateTargetText with converted value).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TextElement from '../TextElement.vue'
import { useCanvasStore } from '@hiprint-v3/stores'
import { buildDefaultElementTypeGroups } from '@hiprint-v3/core/default-provider'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('TextElement — dataType datetime', () => {
  it('formats ISO date string via YYYY-MM-DD HH:mm:ss', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: {
        field: 'orderDate',
        hideTitle: true,
        dataType: 'datetime',
        format: 'YYYY-MM-DD HH:mm:ss',
      },
    })
    const w = mount(TextElement, {
      props: {
        elementId: 'e1',
        panelId: 'p1',
        data: { orderDate: '2026-05-09T14:30:00' },
        interactive: false,
      },
    })
    // Day-level assertion (timezone-resilient): just check pattern shape.
    expect(w.text()).toMatch(/^2026-05-09 \d{2}:\d{2}:\d{2}$/)
    w.unmount()
  })

  it('formats epoch number', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    const epoch = Date.UTC(2026, 4, 9, 12, 0, 0)
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: {
        field: 'ts',
        hideTitle: true,
        dataType: 'datetime',
        format: 'yyyy-MM-dd',
      },
    })
    const w = mount(TextElement, {
      props: {
        elementId: 'e1',
        panelId: 'p1',
        data: { ts: epoch },
        interactive: false,
      },
    })
    expect(w.text()).toMatch(/^2026-05-(0[89]|10)$/)
    w.unmount()
  })

  it('preserves title prefix with formatted date', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: {
        title: '下单日期',
        field: 'orderDate',
        dataType: 'datetime',
        format: 'YYYY-MM-DD',
      },
    })
    const w = mount(TextElement, {
      props: {
        elementId: 'e1',
        panelId: 'p1',
        data: { orderDate: '2026-05-09T12:00:00' },
        interactive: false,
      },
    })
    expect(w.text()).toMatch(/^下单日期：2026-05-(0[89]|10)$/)
    w.unmount()
  })

  it('invalid date string renders raw (graceful)', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: {
        field: 'd',
        hideTitle: true,
        dataType: 'datetime',
        format: 'YYYY-MM-DD',
      },
    })
    const w = mount(TextElement, {
      props: {
        elementId: 'e1',
        panelId: 'p1',
        data: { d: 'not-a-date' },
        interactive: false,
      },
    })
    expect(w.text()).toBe('not-a-date')
    w.unmount()
  })
})

describe('TextElement — dataType boolean', () => {
  it('true → trueText', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: {
        field: 'paid',
        hideTitle: true,
        dataType: 'boolean',
        trueText: '已支付',
        falseText: '未支付',
      },
    })
    const w = mount(TextElement, {
      props: {
        elementId: 'e1',
        panelId: 'p1',
        data: { paid: true },
        interactive: false,
      },
    })
    expect(w.text()).toBe('已支付')
    w.unmount()
  })

  it('false → falseText', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: {
        field: 'paid',
        hideTitle: true,
        dataType: 'boolean',
        trueText: '已支付',
        falseText: '未支付',
      },
    })
    const w = mount(TextElement, {
      props: {
        elementId: 'e1',
        panelId: 'p1',
        data: { paid: false },
        interactive: false,
      },
    })
    expect(w.text()).toBe('未支付')
    w.unmount()
  })

  it('V1 legacy format split "Yes:No" applied as fallback', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: {
        field: 'flag',
        hideTitle: true,
        dataType: 'boolean',
        format: '是:否',
      },
    })
    const w = mount(TextElement, {
      props: {
        elementId: 'e1',
        panelId: 'p1',
        data: { flag: true },
        interactive: false,
      },
    })
    expect(w.text()).toBe('是')
    w.unmount()
  })
})

describe('TextElement — V1 orderDate preset wiring (TKT-024)', () => {
  it('defaultModule.orderDate preset has dataType=datetime + format', () => {
    const groups = buildDefaultElementTypeGroups()
    const eCommerce = groups.find((g) => g.name === '电商')
    expect(eCommerce).toBeDefined()
    const orderDate = eCommerce!.printElementTypes.find(
      (t) => t.tid === 'defaultModule.orderDate'
    )
    expect(orderDate).toBeDefined()
    const opts = (orderDate as unknown as { options: Record<string, unknown> })
      .options
    expect(opts.dataType).toBe('datetime')
    expect(opts.format).toBe('YYYY-MM-DD HH:mm:ss')
  })

  it('orderDate-shaped element renders formatted date', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 'defaultModule.orderDate',
      printElementType: { type: 'text', field: 'orderDate' },
      options: {
        title: '下单日期',
        field: 'orderDate',
        dataType: 'datetime',
        format: 'YYYY-MM-DD HH:mm:ss',
        testData: '2026-05-09T14:30:00',
      },
    })
    const w = mount(TextElement, {
      props: {
        elementId: 'e1',
        panelId: 'p1',
        data: { orderDate: '2026-05-09T14:30:00' },
        interactive: false,
      },
    })
    // Title prefix + formatted date
    expect(w.text()).toMatch(/^下单日期：2026-05-09 \d{2}:\d{2}:\d{2}$/)
    w.unmount()
  })
})

describe('TextElement — formatter receives converted value (TKT-024)', () => {
  it('formatter sees the dataType-converted string, not the raw value', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    const seen: unknown[] = []
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: {
        field: 'flag',
        hideTitle: true,
        dataType: 'boolean',
        trueText: 'YES',
        falseText: 'NO',
        formatter: (_title: unknown, value: unknown) => {
          seen.push(value)
          return `<i>${String(value)}</i>`
        },
      },
    })
    const w = mount(TextElement, {
      props: {
        elementId: 'e1',
        panelId: 'p1',
        data: { flag: true },
        interactive: false,
      },
    })
    expect(seen[0]).toBe('YES')
    expect(w.find('i').text()).toBe('YES')
    w.unmount()
  })
})
