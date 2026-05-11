/**
 * useHiprintTemplate.spec.ts — load/save/undo/redo + dirty surface.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useHiprintTemplate } from '../useHiprintTemplate'
import { useHiprintCanvas } from '../useHiprintCanvas'

const SAMPLE_JSON = {
  panels: [{ index: 0, name: '1', width: 210, height: 297 }],
}

describe('useHiprintTemplate', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initial state — not loaded, not dirty, not loading', () => {
    const t = useHiprintTemplate()
    expect(t.isLoaded.value).toBe(false)
    expect(t.isDirty.value).toBe(false)
    expect(t.isLoading.value).toBe(false)
    expect(t.currentJson.value).toBeNull()
  })

  it('loadFromJson resolves as a promise + sets isLoaded', async () => {
    const t = useHiprintTemplate()
    await t.loadFromJson(SAMPLE_JSON)
    expect(t.isLoaded.value).toBe(true)
    expect(t.currentJson.value).not.toBeNull()
  })

  it('loadFromJson rejects invalid JSON via Promise rejection', async () => {
    const t = useHiprintTemplate()
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(t.loadFromJson('not-an-object')).rejects.toBeDefined()
    err.mockRestore()
  })

  it('getJson roundtrips panels in canvas store', async () => {
    const t = useHiprintTemplate()
    await t.loadFromJson(SAMPLE_JSON)
    const out = t.getJson()
    expect(out.panels.length).toBe(1)
    expect(out.panels[0]?.width).toBe(210)
  })

  it('clear resets isLoaded + currentJson', async () => {
    const t = useHiprintTemplate()
    await t.loadFromJson(SAMPLE_JSON)
    t.clear()
    expect(t.isLoaded.value).toBe(false)
    expect(t.currentJson.value).toBeNull()
  })

  it('save returns null when no template loaded', () => {
    const t = useHiprintTemplate()
    expect(t.save()).toBeNull()
  })

  it('save returns JSON + resets dirty after load + dirty mutation', async () => {
    const t = useHiprintTemplate()
    const c = useHiprintCanvas()
    await t.loadFromJson(SAMPLE_JSON)
    // Simulate a dirty edit
    ;(t.isDirty as { value: boolean }).value = true
    expect(t.isDirty.value).toBe(true)
    const saved = t.save()
    expect(saved).not.toBeNull()
    expect(t.isDirty.value).toBe(false)
    void c
  })

  it('canUndo/canRedo flip with undo()/redo()', async () => {
    const t = useHiprintTemplate()
    const c = useHiprintCanvas()
    await t.loadFromJson(SAMPLE_JSON)
    // Push a new history entry by adding a panel.
    c.addPanel({ width: 100, height: 100 })
    // Use the underlying store to push snapshot for the test
    const { useHistoryStore } = await import('../../stores')
    useHistoryStore().pushSnapshot()
    expect(t.canUndo.value).toBe(true)
    t.undo()
    expect(t.canRedo.value).toBe(true)
  })
})
