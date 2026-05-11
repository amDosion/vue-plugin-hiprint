/**
 * ElementWrapper.spec.ts — V3 ElementWrapper component unit tests (P17.0).
 *
 * Covers:
 *  - mounts with absolute position + pt-suffixed left/top/width/height
 *  - reflects element.options reactively (store mutation → re-render)
 *  - applies .hiprint-element--selected class when in selection set
 *  - exposes element + options + selected via slot scope
 *  - data-element-id + data-panel-id attributes are present
 *  - interactive=false skips registration (no console warnings)
 *  - unmount triggers cleanup (no thrown exception)
 *  - handles missing element id gracefully
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import ElementWrapper from '../ElementWrapper.vue'
import { useCanvasStore } from '@hiprint-v3/stores'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('ElementWrapper — geometry', () => {
  it('mounts with absolute positioning + pt units from options', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { left: 10, top: 20, width: 80, height: 16 },
    })

    const w = mount(ElementWrapper, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    const root = w.element as HTMLElement
    expect(root.style.position).toBe('absolute')
    expect(root.style.left).toBe('10pt')
    expect(root.style.top).toBe('20pt')
    expect(root.style.width).toBe('80pt')
    expect(root.style.height).toBe('16pt')
    w.unmount()
  })

  it('reactively re-renders when canvas store options change', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { left: 5, top: 5, width: 50, height: 12 },
    })

    const w = mount(ElementWrapper, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    expect((w.element as HTMLElement).style.left).toBe('5pt')

    canvas.updateElement('p1', 'e1', { options: { left: 99 } })
    await w.vm.$nextTick()
    expect((w.element as HTMLElement).style.left).toBe('99pt')
    w.unmount()
  })
})

describe('ElementWrapper — classes + data attrs', () => {
  it('emits data-element-id + data-panel-id attributes', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
    })
    const w = mount(ElementWrapper, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    const root = w.element as HTMLElement
    expect(root.getAttribute('data-element-id')).toBe('e1')
    expect(root.getAttribute('data-panel-id')).toBe('p1')
    expect(root.classList.contains('hiprint-element')).toBe(true)
    expect(root.classList.contains('hiprint-printElement-text')).toBe(true)
    w.unmount()
  })

  it('toggles .hiprint-element--selected when in selection set', async () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
    })
    const w = mount(ElementWrapper, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    const root = w.element as HTMLElement
    expect(root.classList.contains('hiprint-element--selected')).toBe(false)

    canvas.selectElement('e1', 'replace')
    await w.vm.$nextTick()
    expect(root.classList.contains('hiprint-element--selected')).toBe(true)

    canvas.clearSelection()
    await w.vm.$nextTick()
    expect(root.classList.contains('hiprint-element--selected')).toBe(false)
    w.unmount()
  })
})

describe('ElementWrapper — slot scope', () => {
  it('exposes element + options + selected to default slot', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
      options: { left: 1, top: 2, title: 'Hello' },
    })
    let receivedTitle = ''
    const Probe = defineComponent({
      template: `<ElementWrapper :element-id="'e1'" :panel-id="'p1'" :interactive="false">
        <template #default="{ options }">
          <span class="probe">{{ options.title }}</span>
        </template>
      </ElementWrapper>`,
      components: { ElementWrapper },
      mounted() {
        receivedTitle = (this.$el as HTMLElement).querySelector('.probe')?.textContent ?? ''
      },
    })
    const w = mount(Probe)
    expect(receivedTitle).toBe('Hello')
    w.unmount()
  })
})

describe('ElementWrapper — lifecycle', () => {
  it('interactive=false skips drag/resize/selection (no errors)', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
    })
    // Should mount + unmount without throwing.
    const w = mount(ElementWrapper, {
      props: { elementId: 'e1', panelId: 'p1', interactive: false },
    })
    expect(() => w.unmount()).not.toThrow()
  })

  it('unmount cleans up interactive registration without throwing', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    canvas.addElement('p1', {
      id: 'e1',
      tid: 't.text',
      printElementType: { type: 'text' },
    })
    const w = mount(ElementWrapper, {
      props: { elementId: 'e1', panelId: 'p1' },
      attachTo: document.body,
    })
    expect(() => w.unmount()).not.toThrow()
  })

  it('renders empty wrapper for unknown elementId (no crash)', () => {
    const canvas = useCanvasStore()
    canvas.addPanel({ id: 'p1', width: 200, height: 200 })
    const w = mount(ElementWrapper, {
      props: { elementId: 'missing-id', panelId: 'p1', interactive: false },
    })
    const root = w.element as HTMLElement
    expect(root.getAttribute('data-element-id')).toBe('missing-id')
    expect(root.classList.contains('hiprint-printElement-unknown')).toBe(true)
    // Render void to avoid unused var warning.
    void h
    w.unmount()
  })
})
