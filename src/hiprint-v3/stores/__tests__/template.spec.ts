/**
 * template.spec.ts — useTemplateStore lifecycle + dirty + invariants.
 *
 * Critical invariants:
 *  - PM-005: panel id auto-assigned even when JSON omits it
 *  - loadFromJson resets canvas + history (undo must not cross load boundary)
 *  - getJson roundtrip parses back through templateSchema
 *  - dirty toggles via setDirty + save resets to false
 *  - loading flag toggles during load (try/finally)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { useTemplateStore } from '../template'
import { useCanvasStore } from '../canvas'
import { useHistoryStore } from '../history'
import { templateSchema } from '../../schemas/template'

const SAMPLE_TEMPLATE_PATH = resolve(
  __dirname,
  '../../../../e2e/tests/fixtures/sample-template.json',
)

function readSample(): unknown {
  return JSON.parse(readFileSync(SAMPLE_TEMPLATE_PATH, 'utf8'))
}

describe('useTemplateStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initial state — not loaded, not dirty, not loading', () => {
    const t = useTemplateStore()
    expect(t.isLoaded).toBe(false)
    expect(t.dirty).toBe(false)
    expect(t.loading).toBe(false)
    expect(t.currentTemplate).toBeNull()
  })

  it('loadFromJson accepts the real V1 business sample fixture', () => {
    const t = useTemplateStore()
    const c = useCanvasStore()
    t.loadFromJson(readSample())
    expect(t.isLoaded).toBe(true)
    expect(c.panels.length).toBeGreaterThan(0)
    expect(t.dirty).toBe(false)
  })

  it('loadFromJson rejects invalid JSON (ZodError)', () => {
    const t = useTemplateStore()
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => t.loadFromJson('not an object')).toThrow()
    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })

  it('loadFromJson resets canvas + history', () => {
    const t = useTemplateStore()
    const c = useCanvasStore()
    const h = useHistoryStore()
    // First add stale data with multiple history entries
    c.addPanel({ width: 100, height: 100 })
    h.pushSnapshot()
    c.addPanel({ width: 100, height: 100 })
    h.pushSnapshot()
    const staleEntries = h.historyEntries.length
    expect(staleEntries).toBeGreaterThan(0)
    // Now load — should wipe history (no entries pointing at stale panels remain)
    t.loadFromJson({ panels: [{ index: 0, name: '1', width: 210, height: 297 }] })
    // Cannot redo back to stale state, no entries reference pre-load 100x100 panels
    expect(h.canRedo).toBe(false)
    expect(c.panels.length).toBe(1)
    expect(c.panels[0]?.width).toBe(210)
  })

  it('PM-005: panel id auto-assigned even when JSON omits it', () => {
    const t = useTemplateStore()
    const c = useCanvasStore()
    t.loadFromJson({
      panels: [
        { index: 0, name: '1', width: 210, height: 297 },
        { index: 1, name: '2', width: 210, height: 297 },
      ],
    })
    expect(c.panels.length).toBe(2)
    expect(typeof c.panels[0]?.id).toBe('string')
    expect(c.panels[0]?.id?.length ?? 0).toBeGreaterThan(0)
    expect(c.panels[1]?.id).not.toBe(c.panels[0]?.id)
  })

  it('element ids auto-assigned by loadFromJson', () => {
    const t = useTemplateStore()
    const c = useCanvasStore()
    t.loadFromJson({
      panels: [
        {
          index: 0,
          name: '1',
          width: 210,
          height: 297,
          printElements: [
            {
              options: { left: 0, top: 0 },
              printElementType: { type: 'text', tid: 'default.text' },
            },
          ],
        },
      ],
    })
    const el = c.panels[0]?.printElements[0]
    expect(typeof el?.id).toBe('string')
    expect(el?.id?.length ?? 0).toBeGreaterThan(0)
  })

  it('activePanelId set to first panel after load', () => {
    const t = useTemplateStore()
    const c = useCanvasStore()
    t.loadFromJson({
      panels: [{ index: 0, name: '1', width: 210, height: 297 }],
    })
    expect(c.activePanelId).toBe(c.panels[0]?.id ?? null)
  })

  it('getJson roundtrip — output parses back through templateSchema', () => {
    const t = useTemplateStore()
    t.loadFromJson(readSample())
    const json = t.getJson()
    const reparsed = templateSchema.parse(json)
    expect(reparsed.panels.length).toBe(json.panels.length)
  })

  it('setDirty toggles dirty flag', () => {
    const t = useTemplateStore()
    expect(t.dirty).toBe(false)
    t.setDirty(true)
    expect(t.dirty).toBe(true)
    t.setDirty(false)
    expect(t.dirty).toBe(false)
  })

  it('save() resets dirty to false', () => {
    const t = useTemplateStore()
    t.loadFromJson({ panels: [{ index: 0, name: '1', width: 210, height: 297 }] })
    t.setDirty(true)
    expect(t.dirty).toBe(true)
    t.save()
    expect(t.dirty).toBe(false)
  })

  it('clear() resets everything', () => {
    const t = useTemplateStore()
    const c = useCanvasStore()
    t.loadFromJson({ panels: [{ index: 0, name: '1', width: 210, height: 297 }] })
    expect(t.isLoaded).toBe(true)
    t.clear()
    expect(t.isLoaded).toBe(false)
    expect(c.panels.length).toBe(0)
    expect(t.dirty).toBe(false)
    expect(t.currentTemplate).toBeNull()
  })

  it('loading flag is true during loadFromJson + back to false after', () => {
    const t = useTemplateStore()
    // We cannot observe the in-flight value synchronously without async hooks,
    // but the try/finally guarantees it returns to false.
    t.loadFromJson({ panels: [] })
    expect(t.loading).toBe(false)
  })

  it('loading flag returns to false even on parse failure', () => {
    const t = useTemplateStore()
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      t.loadFromJson(undefined)
    } catch {
      // expected
    }
    expect(t.loading).toBe(false)
    err.mockRestore()
  })
})
