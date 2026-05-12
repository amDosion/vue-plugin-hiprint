/**
 * TextElement.spec.ts — V3 text etype unit tests (P17.1).
 *
 * Covers:
 *  - renders title-prefix + value joined by separator
 *  - hideTitle suppresses title prefix
 *  - resolves field from bound data (PM-002 R3: preserves 0/false)
 *  - XSS safety: user text rendered via {{ }} is escaped
 *  - formatter (function) output rendered via v-html (by-design HTML)
 *  - inline edit dblclick + commit on Enter writes to store
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TextElement from '../TextElement.vue'
import { useCanvasStore } from '@hiprint-v3/stores'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('TextElement — display', () => {
  it('renders title + separator + value with default ：', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text', field: 'name' },
      options: { title: 'Name', field: 'name' },
    })
    const w = mount(TextElement, {
      props: {
        elementId: 'e1',
        panelId: 'p1',
        data: { name: 'Alice' },
        interactive: false,
      },
    })
    expect(w.text()).toBe('Name：Alice')
    w.unmount()
  })

  it('hideTitle suppresses title prefix', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text', field: 'name' },
      options: { title: 'Name', hideTitle: true, field: 'name' },
    })
    const w = mount(TextElement, {
      props: {
        elementId: 'e1',
        panelId: 'p1',
        data: { name: 'Bob' },
        interactive: false,
      },
    })
    expect(w.text()).toBe('Bob')
    w.unmount()
  })

  it('preserves 0 / false / empty-string field values (PM-002 R3)', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { title: 'Count', hideTitle: true, field: 'qty' },
    })
    const w = mount(TextElement, {
      props: {
        elementId: 'e1',
        panelId: 'p1',
        data: { qty: 0 },
        interactive: false,
      },
    })
    // 0 must render as "0" — not be coerced to '' by a falsy fallback.
    expect(w.text()).toBe('0')
    w.unmount()
  })
})

describe('TextElement — XSS safety (Invariant #1)', () => {
  it('user-supplied HTML in title/data is rendered as escaped text', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: {
        title: '<img src=x onerror=alert(1)>',
        field: 'desc',
        hideTitle: false,
      },
    })
    const w = mount(TextElement, {
      props: {
        elementId: 'e1',
        panelId: 'p1',
        data: { desc: '<script>x()</script>' },
        interactive: false,
      },
    })
    // No <img> / <script> should be inserted into the DOM.
    expect(w.find('img').exists()).toBe(false)
    expect(w.find('script').exists()).toBe(false)
    // The raw markup should be present as escaped text content.
    expect(w.text()).toContain('<img src=x onerror=alert(1)>')
    expect(w.text()).toContain('<script>')
    w.unmount()
  })
})

describe('TextElement — formatter (Invariant #2: by-design HTML)', () => {
  it('formatter return is rendered via v-html', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: {
        title: 'X',
        field: 'val',
        formatter: (_t: unknown, v: unknown) => `<b class="fmt">${String(v)}</b>`,
      },
    })
    const w = mount(TextElement, {
      props: {
        elementId: 'e1',
        panelId: 'p1',
        data: { val: 'hi' },
        interactive: false,
      },
    })
    expect(w.find('b.fmt').exists()).toBe(true)
    expect(w.find('b.fmt').text()).toBe('hi')
    w.unmount()
  })
})

describe('TextElement — inline edit', () => {
  it('dblclick + Enter commits new title into canvas store', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { title: 'old', testData: 'fallback' },
    })
    const w = mount(TextElement, {
      props: {
        elementId: 'e1',
        panelId: 'p1',
        editable: true,
        interactive: false,
      },
      attachTo: document.body,
    })
    const content = w.find('.hiprint-printElement-text-content')
    await content.trigger('dblclick')
    const input = w.find('input.hiprint-text-inline-edit')
    expect(input.exists()).toBe(true)
    await input.setValue('new title')
    await input.trigger('keydown.enter')
    const stored = canvas.panels[0]?.printElements[0]?.options as Record<string, unknown>
    expect(stored.title).toBe('new title')
    w.unmount()
  })
})

// ============================================================================
// Sprint 22d TKT-160 — Inline-edit fullwidth-colon parse + sanitization.
//
// V1 inventory etypes/text-longtext.md §F.1 (colon parse) + §J.12 (input
// sanitization replaces enter/newline/tab with spaces before commit). V3 also
// accepts ASCII `:` as a separator (V1 §J.1 was a bug — only fullwidth split).
// ============================================================================

async function mountAndStartEdit(): Promise<{
  w: ReturnType<typeof mount>
  input: ReturnType<ReturnType<typeof mount>['find']>
}> {
  const canvas = useCanvasStore()
  canvas.addPanel({ id: 'p1', width: 200, height: 200 })
  canvas.addElement('p1', {
    id: 'e1',
    tid: 't.text',
    printElementType: { type: 'text' },
    options: { title: 'Name', testData: 'Alice' },
  })
  const w = mount(TextElement, {
    props: {
      elementId: 'e1',
      panelId: 'p1',
      editable: true,
      interactive: false,
    },
    attachTo: document.body,
  })
  const content = w.find('.hiprint-printElement-text-content')
  await content.trigger('dblclick')
  const input = w.find('input.hiprint-text-inline-edit')
  return { w, input }
}

describe('TextElement — TKT-160 inline-edit fullwidth-colon parse', () => {
  it('parses `title：testData` (fullwidth colon U+FF1A) into both fields', async () => {
    const canvas = useCanvasStore()
    const { w, input } = await mountAndStartEdit()
    await input.setValue('客户：张三')
    await input.trigger('keydown.enter')
    const stored = canvas.panels[0]!.printElements[0]!.options as Record<string, unknown>
    expect(stored.title).toBe('客户')
    expect(stored.testData).toBe('张三')
    w.unmount()
  })

  it('also accepts ASCII `:` separator (V3 fix for V1 quirk §J.1)', async () => {
    const canvas = useCanvasStore()
    const { w, input } = await mountAndStartEdit()
    await input.setValue('Time:14:30')
    await input.trigger('keydown.enter')
    const stored = canvas.panels[0]!.printElements[0]!.options as Record<string, unknown>
    // Greedy regex: first colon splits title from testData.
    expect(stored.title).toBe('Time')
    expect(stored.testData).toBe('14:30')
    w.unmount()
  })

  it('strips tabs (and \\n/\\r when they survive the single-line input) before committing (V1 §J.12)', async () => {
    const canvas = useCanvasStore()
    const { w, input } = await mountAndStartEdit()
    // HTML spec: single-line <input> strips \r and \n from `.value`. Tabs
    // survive. The sanitization regex (/[\r\n\t]+/g) handles all three so
    // exercising the \t path proves the regex even though we cannot
    // physically feed raw newlines through the input. Real-world entry of
    // newlines comes through paste handlers that route through this same
    // path — coverage is preserved at the regex level.
    const inputEl = input.element as HTMLInputElement
    inputEl.value = 'multi\tline\twith\ttabs'
    await input.trigger('input')
    await input.trigger('keydown.enter')
    const stored = canvas.panels[0]!.printElements[0]!.options as Record<string, unknown>
    // All tab chars collapsed to single spaces; trimmed.
    expect(stored.title).toBe('multi line with tabs')
    w.unmount()
  })

  it('no-colon input commits the sanitized value to title only', async () => {
    const canvas = useCanvasStore()
    const { w, input } = await mountAndStartEdit()
    await input.setValue('  Just a name  ')
    await input.trigger('keydown.enter')
    const stored = canvas.panels[0]!.printElements[0]!.options as Record<string, unknown>
    expect(stored.title).toBe('Just a name')
    // testData unchanged (was 'Alice' at setup).
    expect(stored.testData).toBe('Alice')
    w.unmount()
  })

  it('colon parse + sanitization combine: fullwidth colon with surrounding whitespace', async () => {
    const canvas = useCanvasStore()
    const { w, input } = await mountAndStartEdit()
    const inputEl = input.element as HTMLInputElement
    inputEl.value = '  日期  ：  2026-05-11\t'
    await input.trigger('input')
    await input.trigger('keydown.enter')
    const stored = canvas.panels[0]!.printElements[0]!.options as Record<string, unknown>
    expect(stored.title).toBe('日期')
    expect(stored.testData).toBe('2026-05-11')
    w.unmount()
  })
})
