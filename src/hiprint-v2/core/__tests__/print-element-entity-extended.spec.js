/**
 * print-element-entity-extended.spec.js — P9b extensions
 *
 * Covers V1 line 742-1660 methods migrated in P9b:
 *  - selectFromList (event-bus trigger fallback)
 *  - getPrintElementEntity (serialization)
 *  - bindCopyEvent / copyJson (clipboard fallback)
 *  - clone (factory delegation)
 *  - inRect / multipleSelect / updatePositionByMultipleSelect
 *  - bindKeyboardMoveEvent (arrow + delete event-bus delegation)
 *  - Safe handling when window.$ / jQuery plugin unavailable
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BasePrintElement } from '../print-element-entity.js'

function makeType(overrides = {}) {
  return {
    tid: 'mod.test',
    title: 'Test',
    type: 'text',
    ...overrides,
  }
}

beforeEach(() => {
  // Reset any test-installed window globals
  if (typeof window !== 'undefined') {
    delete window.hinnn
    delete window.HiPrintConfig
  }
})

describe('BasePrintElement._getEventBus / event integration', () => {
  it('returns undefined when window.hinnn unset', () => {
    const el = new BasePrintElement(makeType())
    expect(el._getEventBus()).toBeUndefined()
  })

  it('returns event-bus when window.hinnn.event set', () => {
    const bus = { trigger: vi.fn(), on: vi.fn(), off: vi.fn() }
    window.hinnn = { event: bus }
    const el = new BasePrintElement(makeType())
    expect(el._getEventBus()).toBe(bus)
  })
})

describe('BasePrintElement.getPrintElementEntity (P9c serialize)', () => {
  it('returns { tid, options } shape by default', () => {
    const el = new BasePrintElement(makeType({ tid: 'mod.text' }), {
      left: 10,
      top: 5,
      field: 'name',
    })
    const ent = el.getPrintElementEntity()
    expect(ent.tid).toBe('mod.text')
    expect(ent.options.left).toBe(10)
    expect(ent.options.field).toBe('name')
    expect(ent.printElementType).toBeUndefined()
  })

  it('embeds printElementType when withType=true', () => {
    const t = makeType({ tid: 'mod.text', title: 'X' })
    const el = new BasePrintElement(t, { field: 'a' })
    const ent = el.getPrintElementEntity(true)
    expect(ent.printElementType.tid).toBe('mod.text')
    expect(ent.printElementType.title).toBe('X')
  })

  it('strips function-valued options (avoid JSON pollution)', () => {
    const el = new BasePrintElement(makeType(), {
      field: 'a',
      onClick: () => {},
      formatter: 'function(){return 1}', // string formatter is kept (legit)
    })
    const ent = el.getPrintElementEntity()
    expect(ent.options.onClick).toBeUndefined()
    expect(ent.options.formatter).toBe('function(){return 1}')
  })

  it('shallow-clones options (mutating returned options does not affect el)', () => {
    const el = new BasePrintElement(makeType(), { left: 10 })
    const ent = el.getPrintElementEntity()
    ent.options.left = 999
    expect(el.options.left).toBe(10)
  })
})

describe('BasePrintElement.clone', () => {
  it('returns undefined when printElementType has no createPrintElement factory', () => {
    const el = new BasePrintElement(makeType())
    expect(el.clone()).toBeUndefined()
  })

  it('delegates to printElementType.createPrintElement + copies options', () => {
    const tFactory = makeType({
      createPrintElement() {
        return new BasePrintElement(tFactory, {})
      },
    })
    const el = new BasePrintElement(tFactory, { left: 10, top: 20, field: 'name' })
    const c = el.clone()
    expect(c).toBeDefined()
    expect(c.options.left).toBe(10)
    expect(c.options.field).toBe('name')
  })
})

describe('BasePrintElement.selectFromList (R3 silent #5: list-only-select flag)', () => {
  it('silent skip when designTarget undefined', () => {
    const el = new BasePrintElement(makeType())
    expect(() => el.selectFromList()).not.toThrow()
  })

  it('triggers event-bus PrintElementSelectEventKey on fallback path', () => {
    const bus = { trigger: vi.fn(), on: vi.fn(), off: vi.fn() }
    window.hinnn = { event: bus }
    const el = new BasePrintElement(makeType())
    el.setTemplateId('tpl-1')
    // Mock designTarget jQuery surface (full chain)
    const panelHandleMock = {
      hasClass: () => false,
      addClass: () => panelHandleMock,
      removeClass: () => panelHandleMock,
      css: () => panelHandleMock,
    }
    el.designTarget = {
      length: 1,
      css: () => 'block',
      children: () => panelHandleMock,
      siblings: () => ({ children: () => panelHandleMock }),
      triggerHandler: () => {},
    }
    el.selectFromList()
    expect(bus.trigger).toHaveBeenCalledWith(
      'PrintElementSelectEventKey_tpl-1',
      { printElement: el }
    )
  })
})

describe('BasePrintElement.copyJson (R3 silent: clipboard API fallback)', () => {
  it('returns false when window.$ unavailable', () => {
    const $original = window.$
    delete window.$
    const el = new BasePrintElement(makeType())
    expect(el.copyJson()).toBe(false)
    if ($original) window.$ = $original
  })

  it('catches throw + returns false (defensive)', () => {
    const originalError = console.error
    console.error = vi.fn()
    const el = new BasePrintElement(makeType())
    el.panel = {
      get printElements() {
        throw new Error('boom')
      },
    }
    window.$ = () => ({ length: 0, append: () => {}, text: () => ({}), css: () => ({}), focus: () => {} })
    const result = el.copyJson()
    expect(result).toBe(false)
    console.error = originalError
  })
})

describe('BasePrintElement.bindCopyEvent / bindKeyboardMoveEvent — safe with no jQuery', () => {
  it('bindCopyEvent silent-noop when target lacks .on', () => {
    const el = new BasePrintElement(makeType())
    expect(() => el.bindCopyEvent(undefined)).not.toThrow()
    expect(() => el.bindCopyEvent({})).not.toThrow()
  })

  it('bindKeyboardMoveEvent silent-noop when target lacks .on/.attr', () => {
    const el = new BasePrintElement(makeType())
    expect(() => el.bindKeyboardMoveEvent(undefined, undefined)).not.toThrow()
    expect(() => el.bindKeyboardMoveEvent({}, undefined)).not.toThrow()
  })
})

describe('BasePrintElement._getMovingDistance (HiPrintConfig integration)', () => {
  it('returns 1 by default', () => {
    const el = new BasePrintElement(makeType())
    expect(el._getMovingDistance()).toBe(1)
  })

  it('reads from window.HiPrintConfig.instance.movingDistance', () => {
    window.HiPrintConfig = { instance: { movingDistance: 5 } }
    const el = new BasePrintElement(makeType())
    expect(el._getMovingDistance()).toBe(5)
  })

  it('ignores non-numeric / <= 0 config', () => {
    window.HiPrintConfig = { instance: { movingDistance: 'bad' } }
    const el = new BasePrintElement(makeType())
    expect(el._getMovingDistance()).toBe(1)
    window.HiPrintConfig = { instance: { movingDistance: 0 } }
    expect(el._getMovingDistance()).toBe(1)
    window.HiPrintConfig = { instance: { movingDistance: -1 } }
    expect(el._getMovingDistance()).toBe(1)
  })
})

describe('BasePrintElement.inRect (marquee multi-select)', () => {
  it('returns false when designTarget missing', () => {
    const el = new BasePrintElement(makeType())
    expect(el.inRect({ target: { 0: {} } })).toBe(false)
  })

  it('returns false when target missing', () => {
    const el = new BasePrintElement(makeType())
    el.designTarget = { 0: { offsetLeft: 0, offsetTop: 0, offsetWidth: 100, offsetHeight: 100 } }
    expect(el.inRect({ target: undefined })).toBe(false)
  })

  it('computes intersection correctly (overlap → true)', () => {
    const el = new BasePrintElement(makeType())
    el.designTarget = {
      0: { offsetLeft: 0, offsetTop: 0, offsetWidth: 100, offsetHeight: 100 },
    }
    el.designPaper = { scale: 1 }
    const t = {
      target: { 0: { offsetLeft: 50, offsetTop: 50, offsetWidth: 100, offsetHeight: 100 } },
    }
    // Disable window.$ for this test so we use raw offsetLeft fallback
    const $orig = window.$
    delete window.$
    expect(el.inRect(t)).toBe(true)
    if ($orig) window.$ = $orig
  })

  it('returns false when rects disjoint', () => {
    const el = new BasePrintElement(makeType())
    el.designTarget = {
      0: { offsetLeft: 0, offsetTop: 0, offsetWidth: 50, offsetHeight: 50 },
    }
    el.designPaper = { scale: 1 }
    const $orig = window.$
    delete window.$
    const t = {
      target: { 0: { offsetLeft: 200, offsetTop: 200, offsetWidth: 50, offsetHeight: 50 } },
    }
    expect(el.inRect(t)).toBe(false)
    if ($orig) window.$ = $orig
  })
})

describe('BasePrintElement.multipleSelect', () => {
  it('silent noop when designTarget missing', () => {
    const el = new BasePrintElement(makeType())
    expect(() => el.multipleSelect(true)).not.toThrow()
    expect(() => el.multipleSelect(false)).not.toThrow()
  })

  it('toggles class when designTarget has addClass/removeClass', () => {
    const el = new BasePrintElement(makeType())
    const calls = { added: [], removed: [] }
    el.designTarget = {
      addClass: (c) => calls.added.push(c),
      removeClass: (c) => calls.removed.push(c),
    }
    el.multipleSelect(true)
    expect(calls.added).toEqual(['multipleSelect'])
    el.multipleSelect(false)
    expect(calls.removed).toEqual(['multipleSelect'])
  })
})

describe('BasePrintElement.updatePositionByMultipleSelect (V1 line 1658-1660)', () => {
  it('refuses when draggable=false', () => {
    const el = new BasePrintElement(makeType(), { draggable: false, left: 10, top: 5 })
    const spy = vi.spyOn(el, 'updateSizeAndPositionOptions')
    el.updatePositionByMultipleSelect(5, 5)
    expect(spy).not.toHaveBeenCalled()
  })

  it('refuses when positionLocked=true', () => {
    const el = new BasePrintElement(makeType(), { positionLocked: true, left: 10 })
    const spy = vi.spyOn(el, 'updateSizeAndPositionOptions')
    el.updatePositionByMultipleSelect(5, 5)
    expect(spy).not.toHaveBeenCalled()
  })

  it('uses options.getLeft/getTop when available', () => {
    const calls = []
    const el = new BasePrintElement(makeType(), {
      width: 100,
      height: 50,
      getLeft: () => 100,
      getTop: () => 200,
      setLeft: (v) => calls.push(['left', v]),
      setTop: (v) => calls.push(['top', v]),
      setWidth: () => {},
      setHeight: () => {},
      copyDesignTopFromTop: () => {},
    })
    el.updatePositionByMultipleSelect(5, 10)
    expect(calls).toContainEqual(['left', 105])
    expect(calls).toContainEqual(['top', 210])
  })
})

describe('BasePrintElement.destroy — extended cleanup', () => {
  it('removes hiprint, hiprint-edit, hiprint-move namespaces', () => {
    const namespaces = []
    const el = new BasePrintElement(makeType())
    el.designTarget = {
      length: 1,
      off(ns) {
        namespaces.push(ns)
        return this
      },
      remove() {},
    }
    el.destroy()
    expect(namespaces).toContain('.hiprint')
    expect(namespaces).toContain('.hiprint-edit')
    expect(namespaces).toContain('.hiprint-move')
  })

  it('idempotent after extended cleanup', () => {
    const el = new BasePrintElement(makeType())
    el.designTarget = {
      length: 1,
      off() {
        return this
      },
      remove() {},
    }
    el.destroy()
    expect(() => el.destroy()).not.toThrow()
  })
})
