/**
 * print-template.spec.js — PrintTemplate core API.
 * Locks PM-003 R3 (destroy idempotency) + state-modeler R3 (editingPanel re-select).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  PrintTemplate,
  getTemplateById,
  _resetTemplateMap,
} from '../print-template.js'

const makePanelSpec = (idx, name, elements) => ({
  index: idx,
  name: name || 'P' + (idx + 1),
  width: 210,
  height: 297,
  paperHeader: 10,
  paperFooter: 780,
  printElements: elements || [],
})

beforeEach(() => {
  _resetTemplateMap()
  vi.restoreAllMocks()
})

describe('PrintTemplate constructor', () => {
  it('defaults: empty panels + active not destroyed', () => {
    const tpl = new PrintTemplate({})
    expect(tpl.printPanels).toHaveLength(0)
    expect(tpl.isDestroyed()).toBe(false)
    expect(tpl.id).toBeTruthy()
  })

  it('initializes panels from template.panels', () => {
    const tpl = new PrintTemplate({
      template: { panels: [makePanelSpec(0, 'A'), makePanelSpec(1, 'B')] },
    })
    expect(tpl.printPanels).toHaveLength(2)
    expect(tpl.printPanels[0].name).toBe('A')
    expect(tpl.printPanels[1].name).toBe('B')
  })

  it('history initialized with "初始" snapshot', () => {
    const tpl = new PrintTemplate({ template: { panels: [makePanelSpec(0)] } })
    expect(tpl.historyList).toHaveLength(1)
    expect(tpl.historyList[0].type).toBe('初始')
    expect(tpl.historyPos).toBe(0)
  })

  it('registers in global map', () => {
    const tpl = new PrintTemplate({})
    expect(getTemplateById(tpl.id)).toBe(tpl)
  })

  it('multiple templates have unique ids (PM-005)', () => {
    const a = new PrintTemplate({})
    const b = new PrintTemplate({})
    expect(a.id).not.toBe(b.id)
  })
})

describe('PrintTemplate destroy (PM-003 R3)', () => {
  it('idempotent: second destroy() does not throw', () => {
    const tpl = new PrintTemplate({ template: { panels: [makePanelSpec(0)] } })
    tpl.destroy()
    expect(() => tpl.destroy()).not.toThrow()
  })

  it('sets _destroyed flag + isDestroyed() returns true', () => {
    const tpl = new PrintTemplate({})
    expect(tpl.isDestroyed()).toBe(false)
    tpl.destroy()
    expect(tpl.isDestroyed()).toBe(true)
  })

  it('clears printPanels + back-refs', () => {
    const tpl = new PrintTemplate({
      template: { panels: [makePanelSpec(0), makePanelSpec(1)] },
    })
    tpl.destroy()
    expect(tpl.printPanels).toEqual([])
    expect(tpl.template).toBeNull()
    expect(tpl.editingPanel).toBeUndefined()
  })

  it('unregisters from global map (identity check)', () => {
    const tpl = new PrintTemplate({})
    const id = tpl.id
    tpl.destroy()
    expect(getTemplateById(id)).toBeUndefined()
  })

  it('after destroy, all public methods return safe fallbacks (47 _assertNotDestroyed)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const tpl = new PrintTemplate({ template: { panels: [makePanelSpec(0)] } })
    tpl.destroy()
    expect(tpl.addPrintPanel()).toBeUndefined()
    expect(tpl.getPanel()).toBeUndefined()
    expect(tpl.getPaneltotal()).toBe(0)
    expect(tpl.getElementByTid('any')).toBeUndefined()
    expect(tpl.getJson()).toEqual({ panels: [] })
    expect(tpl.getJsonTid()).toEqual({ panels: [] })
    expect(tpl.getFieldsInPanel()).toEqual([])
    expect(tpl.getTestData()).toEqual({})
    expect(tpl.getFontList()).toEqual([])
    expect(tpl.getFields()).toEqual([])
    expect(tpl.getOnImageChooseClick()).toBeUndefined()
    // setters silent no-op
    expect(() => tpl.selectPanel(0)).not.toThrow()
    expect(() => tpl.deletePanel(0)).not.toThrow()
    expect(() => tpl.setFontList(['a'])).not.toThrow()
  })
})

describe('PrintTemplate addPrintPanel / selectPanel / deletePanel', () => {
  it('addPrintPanel(undefined) creates default A4 + appends', () => {
    const tpl = new PrintTemplate({ template: { panels: [makePanelSpec(0)] } })
    const p = tpl.addPrintPanel()
    expect(tpl.printPanels).toHaveLength(2)
    expect(p.width).toBe(210)
    expect(p.height).toBe(297)
    expect(p.paperType).toBe('A4')
  })

  it('addPrintPanel(spec, true) selects new panel', () => {
    const tpl = new PrintTemplate({ template: { panels: [makePanelSpec(0)] } })
    const p = tpl.addPrintPanel({ name: 'New', width: 100, height: 200 }, true)
    expect(tpl.editingPanel).toBe(p)
  })

  it('selectPanel(idx) sets editingPanel', () => {
    const tpl = new PrintTemplate({
      template: { panels: [makePanelSpec(0, 'A'), makePanelSpec(1, 'B')] },
    })
    tpl.selectPanel(1)
    expect(tpl.editingPanel.name).toBe('B')
  })

  it('selectPanel clamps out-of-bounds index', () => {
    const tpl = new PrintTemplate({
      template: { panels: [makePanelSpec(0, 'A'), makePanelSpec(1, 'B')] },
    })
    tpl.selectPanel(99)
    expect(tpl.editingPanel.name).toBe('B') // clamped to length-1
    tpl.selectPanel(-1)
    expect(tpl.editingPanel.name).toBe('A') // clamped to 0
  })

  it('deletePanel rejects when length=1 (V1 invariant)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const tpl = new PrintTemplate({ template: { panels: [makePanelSpec(0)] } })
    tpl.deletePanel(0)
    expect(tpl.printPanels).toHaveLength(1)
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('deletePanel ignored: must keep at least 1 panel')
    )
  })

  it('[state-modeler R3] deletePanel of editingPanel re-selects another', () => {
    const tpl = new PrintTemplate({
      template: [makePanelSpec(0, 'A'), makePanelSpec(1, 'B'), makePanelSpec(2, 'C')].reduce(
        (acc, _, idx) => ({ panels: [makePanelSpec(0, 'A'), makePanelSpec(1, 'B'), makePanelSpec(2, 'C')] }),
        {}
      ).panels,
    })
    // Re-construct with proper structure
    const tpl2 = new PrintTemplate({
      template: { panels: [makePanelSpec(0, 'A'), makePanelSpec(1, 'B'), makePanelSpec(2, 'C')] },
    })
    tpl2.selectPanel(1) // select B
    expect(tpl2.editingPanel.name).toBe('B')
    tpl2.deletePanel(1) // delete B (editing)
    expect(tpl2.printPanels).toHaveLength(2)
    expect(tpl2.editingPanel).toBeDefined()
    expect(tpl2.editingPanel.name).toBe('C') // moved to next valid
  })
})

describe('PrintTemplate.getJson / getJsonTid', () => {
  it('getJson preserves panel structure', () => {
    const tpl = new PrintTemplate({
      template: {
        panels: [makePanelSpec(0, 'P1', [
          {
            options: { left: 0, top: 0, height: 16, width: 100, field: 'name' },
            printElementType: { tid: 'm.text', type: 'text', title: 'N' },
          },
        ])],
      },
    })
    const json = tpl.getJson()
    expect(json.panels).toHaveLength(1)
    expect(json.panels[0].name).toBe('P1')
    expect(json.panels[0].printElements).toHaveLength(1)
  })

  it('getJsonTid only embeds tid + type', () => {
    const tpl = new PrintTemplate({
      template: {
        panels: [makePanelSpec(0, 'P1', [
          {
            options: { field: 'name' },
            printElementType: { tid: 'm.text', type: 'text', title: 'extra-prop' },
          },
        ])],
      },
    })
    const tidJson = tpl.getJsonTid()
    expect(Object.keys(tidJson.panels[0].printElements[0].printElementType).sort()).toEqual([
      'tid',
      'type',
    ])
  })
})

describe('PrintTemplate font / fields / image-click', () => {
  it('setFontList / getFontList', () => {
    const tpl = new PrintTemplate({})
    tpl.setFontList(['Arial', 'Helvetica'])
    expect(tpl.getFontList()).toEqual(['Arial', 'Helvetica'])
  })

  it('setFields / getFields', () => {
    const tpl = new PrintTemplate({})
    tpl.setFields(['id', 'name'])
    expect(tpl.getFields()).toEqual(['id', 'name'])
  })

  it('setOnImageChooseClick / getOnImageChooseClick', () => {
    const tpl = new PrintTemplate({})
    const fn = () => 'choose'
    tpl.setOnImageChooseClick(fn)
    expect(tpl.getOnImageChooseClick()).toBe(fn)
  })
})

describe('PrintTemplate getFieldsInPanel / getTestData (multi-panel aggregation)', () => {
  it('aggregates fields across panels', () => {
    const tpl = new PrintTemplate({
      template: {
        panels: [
          makePanelSpec(0, 'P1', [
            {
              options: { field: 'name' },
              printElementType: { tid: 'm.text', type: 'text', title: 'N' },
            },
          ]),
          makePanelSpec(1, 'P2', [
            {
              options: { field: 'amount' },
              printElementType: { tid: 'm.text', type: 'text', title: 'A' },
            },
          ]),
        ],
      },
    })
    const fields = tpl.getFieldsInPanel()
    expect(fields).toContain('name')
    expect(fields).toContain('amount')
  })
})
