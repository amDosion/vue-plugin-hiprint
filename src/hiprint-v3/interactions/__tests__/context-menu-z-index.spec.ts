/**
 * context-menu-z-index.spec.ts — TKT-253: V1-parity z-index 10000.
 *
 * V1 set the right-click menu z-index to 10000 so it always stacked above
 * ant-design Modal (default 1000) / Popover (1030) / Drawer (1000).
 * @floating-ui/vue's body-portal otherwise relies on natural stacking order
 * and silently rendered the menu BELOW modals.
 *
 * These specs assert both the portal root AND the inner menu element
 * receive z-index ≥ 10000 from inline style (defense-in-depth — neither
 * stylesheet cascade nor scoped CSS specificity can knock them back down).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock floating-ui to avoid layout calls (parity with context-menu.spec.ts).
vi.mock('@floating-ui/vue', () => ({
  computePosition: vi.fn(async () => ({ x: 100, y: 200 })),
  offset: vi.fn((v: number) => ({ name: 'offset', v })),
  flip: vi.fn(() => ({ name: 'flip' })),
  shift: vi.fn((opts: unknown) => ({ name: 'shift', opts })),
}))

import { openContextMenu } from '../context-menu'

beforeEach(() => {
  setActivePinia(createPinia())
})

afterEach(() => {
  document
    .querySelectorAll('.hiprint-context-menu-portal')
    .forEach((n) => n.parentNode?.removeChild(n))
})

async function flush(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

describe('TKT-253 — context menu z-index 10000', () => {
  it('portal root has inline z-index >= 10000 immediately after mount', async () => {
    const ctrl = openContextMenu(
      { x: 25, y: 25 },
      { items: [{ id: 'a', label: 'A' }] }
    )
    // Portal element is created synchronously before the Vue app mounts.
    const portal = document.querySelector(
      '.hiprint-context-menu-portal'
    ) as HTMLElement | null
    expect(portal).toBeTruthy()
    expect(Number(portal!.style.zIndex)).toBeGreaterThanOrEqual(10000)
    ctrl.close()
  })

  it('inner menu element style.zIndex resolves to 10000 after placement', async () => {
    const ctrl = openContextMenu(
      { x: 60, y: 70 },
      { items: [{ id: 'copy', label: 'Copy' }] }
    )
    await flush()
    const menu = document.querySelector(
      '.hiprint-context-menu'
    ) as HTMLElement | null
    expect(menu).toBeTruthy()
    // After computePosition resolves the style ref re-applies — z-index is
    // pinned at 10000 in both the success branch and the catch fallback.
    expect(Number(menu!.style.zIndex)).toBeGreaterThanOrEqual(10000)
    ctrl.close()
  })
})
