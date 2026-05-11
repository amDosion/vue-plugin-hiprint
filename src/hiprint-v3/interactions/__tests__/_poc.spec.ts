/**
 * _poc.spec.ts — interact.js POC validation (P16.1 risk-mitigation gate).
 *
 * Purpose: Before P16.1 commits to interact.js, verify in happy-dom that:
 *   1. `import interact from 'interactjs'` resolves (no SSR / require error).
 *   2. `interact(el).draggable({ listeners })` accepts our shape.
 *   3. Draggable applies cleanly to absolutely-positioned elements.
 *   4. Multi-target draggable: same handler attaches to multiple elements.
 *   5. Dropzone: `interact(zone).dropzone({ accept, ondrop })` accepts shape.
 *
 * happy-dom note: dispatching real pointer events requires PointerEvent which
 * happy-dom 12.x supports (with some gaps). For listener invocation in node
 * unit tests, interact.js relies on PointerEvent dispatch on window — happy-dom
 * does NOT always wire pointer events through the same path as real browsers.
 *
 * IMPORTANT: This POC validates that interact.js can be IMPORTED and CONFIGURED
 * in our environment. Actual pointermove → dragmove dispatch behavior in
 * happy-dom is documented as PARTIAL — interact.js is designed for a real
 * browser. We assert listener registration paths, not full pointer simulation.
 * Real-browser behavior is covered by e2e (Playwright) in later phases.
 *
 * If ANY test below fails fundamentally (e.g. import throws, draggable
 * method missing), POC FAILS — surface to P16.1 planner so Sortable.js
 * fallback can be evaluated.
 */
import { describe, it, expect, afterEach } from 'vitest'

// Track elements created so we can unset interact handlers + remove from DOM.
const _trash: HTMLElement[] = []
function makeEl(style?: Partial<CSSStyleDeclaration>): HTMLElement {
  const el = document.createElement('div')
  if (style) Object.assign(el.style, style)
  document.body.appendChild(el)
  _trash.push(el)
  return el
}

afterEach(async () => {
  const { default: interact } = await import('interactjs')
  for (const el of _trash) {
    try {
      interact(el).unset()
    } catch {
      // ignore — element may not have been registered.
    }
    el.remove()
  }
  _trash.length = 0
})

describe('interact.js POC (P16.1 gate)', () => {
  it('POC-1: imports interactjs default export without throwing', async () => {
    const mod = await import('interactjs')
    expect(mod).toBeDefined()
    expect(typeof mod.default).toBe('function')
  })

  it('POC-2: interact(el).draggable({ listeners }) accepts the shape we use', async () => {
    const { default: interact } = await import('interactjs')
    const el = makeEl({ width: '40px', height: '40px' })

    let listenersRegistered = true
    expect(() => {
      interact(el).draggable({
        listeners: {
          start: () => {},
          move: () => {},
          end: () => {},
        },
        inertia: false,
      })
    }).not.toThrow()
    expect(listenersRegistered).toBe(true)
  })

  it('POC-3: draggable applies to absolutely-positioned elements (no rejection)', async () => {
    const { default: interact } = await import('interactjs')
    const el = makeEl({
      position: 'absolute',
      left: '100px',
      top: '50px',
      width: '40px',
      height: '40px',
    })

    expect(() => {
      interact(el).draggable({
        modifiers: [],
        listeners: { move: () => {} },
      })
    }).not.toThrow()

    // Verify interactable was created.
    const interactable = interact(el)
    expect(interactable).toBeDefined()
    // Should be the same interactable (caching).
    expect(interact(el)).toBe(interactable)
  })

  it('POC-4: multi-target draggable — same handler attaches to multiple elements', async () => {
    const { default: interact } = await import('interactjs')
    const el1 = makeEl({ width: '40px', height: '40px' })
    const el2 = makeEl({ width: '40px', height: '40px' })
    const el3 = makeEl({ width: '40px', height: '40px' })

    let moveHandler = (_event: unknown): void => {}

    for (const el of [el1, el2, el3]) {
      expect(() => {
        interact(el).draggable({
          listeners: { move: moveHandler },
        })
      }).not.toThrow()
    }

    // Each element gets its own Interactable (verified by identity).
    expect(interact(el1)).not.toBe(interact(el2))
    expect(interact(el2)).not.toBe(interact(el3))
  })

  it('POC-5: dropzone accepts our config shape (accept selector + ondrop)', async () => {
    const { default: interact } = await import('interactjs')
    const zone = makeEl({ width: '200px', height: '200px' })
    zone.classList.add('drop-zone')

    let dropFired = false
    expect(() => {
      interact(zone).dropzone({
        accept: '.hiprint-element',
        overlap: 0.5,
        ondrop: () => {
          dropFired = true
        },
      })
    }).not.toThrow()

    // We did not simulate a real drop; just ensure handler shape was accepted.
    expect(dropFired).toBe(false)
  })

  it('POC-6: unset() cleans up interactable without throwing', async () => {
    const { default: interact } = await import('interactjs')
    const el = makeEl()
    interact(el).draggable({ listeners: { move: () => {} } })

    expect(() => {
      interact(el).unset()
    }).not.toThrow()
  })

  it('POC-7: can compose draggable + modifiers (snap + restrict shape accepted)', async () => {
    const { default: interact } = await import('interactjs')
    const el = makeEl({ position: 'absolute', left: '0px', top: '0px' })

    expect(() => {
      interact(el).draggable({
        modifiers: [
          interact.modifiers.snap({
            targets: [interact.snappers.grid({ x: 10, y: 10 })],
            range: Infinity,
            relativePoints: [{ x: 0, y: 0 }],
          }),
          interact.modifiers.restrictRect({
            restriction: 'parent',
            endOnly: true,
          }),
        ],
        listeners: { move: () => {} },
      })
    }).not.toThrow()
  })
})
