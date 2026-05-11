/**
 * panel-reflow.ts — ResizeObserver-based panel size watcher (jQuery-free).
 *
 * P16.2 (ADR-0011 §V3 modern UI architecture).
 *
 * Use case:
 *   - Designer panel rendered to DOM; its pixel dimensions can change due to:
 *       * Paper size switch (template.options.paperType change).
 *       * Browser window resize.
 *       * User zoom (browser zoom changes DPI, which px→pt cares about).
 *       * Sidebar/toolbar collapse changing the canvas viewport.
 *   - Callers (PrintPanel store/viewmodel) need a single hook to react.
 *
 * Implementation:
 *   - Wraps the standard browser ResizeObserver.
 *   - Debounces callback (default 50ms) — ResizeObserver fires every frame
 *     during browser drag-resize; we coalesce.
 *   - Reports sizes in **pt** via px → pt conversion (uses internal/uom).
 *
 * Behavior contract:
 *   - The returned cleanup function disconnects the observer.
 *   - Pending debounced callbacks are cancelled by cleanup.
 *   - If ResizeObserver is unavailable (very old browsers / non-browser env),
 *     `watchPanelSize` returns a no-op cleanup and does NOT throw.
 *     Tests for ResizeObserver-aware environments should provide a stub.
 *
 * Public API:
 *   - watchPanelSize(el, onResize): cleanup
 */

import { px } from '../internal/uom'

/** Default debounce window in ms. */
const DEFAULT_DEBOUNCE_MS = 50

export interface PanelSize {
  /** Width in pt. */
  width: number
  /** Height in pt. */
  height: number
}

export interface WatchPanelSizeOptions {
  /** Debounce interval in ms. Default 50. */
  debounceMs?: number
}

/**
 * Watch a panel element for size changes.
 *
 * @param el        DOM element to observe.
 * @param onResize  Callback fired (debounced) with new size in pt.
 * @param options   Optional tuning (debounceMs).
 * @returns         Cleanup function — disconnects observer + cancels pending.
 *
 * @example
 *   const stop = watchPanelSize(panelEl, ({ width, height }) => {
 *     console.log('panel now', width, 'x', height, 'pt')
 *   })
 *   // later:
 *   stop()
 */
export function watchPanelSize(
  el: HTMLElement,
  onResize: (size: PanelSize) => void,
  options: WatchPanelSizeOptions = {}
): () => void {
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS

  // SSR / very-old-browser guard. happy-dom DOES provide ResizeObserver,
  // even though its observe() is a no-op (tests will polyfill where needed).
  const RO: typeof ResizeObserver | undefined =
    typeof ResizeObserver !== 'undefined' ? ResizeObserver : undefined

  if (!RO) {
    // eslint-disable-next-line no-console
    console.warn(
      '[hiprint-v3:panel-reflow] ResizeObserver not available; watchPanelSize is a no-op.'
    )
    return () => {
      /* no-op */
    }
  }

  let timer: ReturnType<typeof setTimeout> | null = null
  let lastSize: PanelSize = { width: 0, height: 0 }

  /** Schedule a debounced callback. */
  const schedule = (size: PanelSize): void => {
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      try {
        onResize(size)
      } catch (err) {
        // P14 R3 pattern: business callbacks isolated.
        // eslint-disable-next-line no-console
        console.warn('[hiprint-v3:panel-reflow] onResize threw:', err)
      }
    }, debounceMs)
  }

  const observer = new RO((entries: ResizeObserverEntry[]) => {
    // Use the first entry — we observe a single element.
    const entry = entries[0]
    if (!entry) return

    // contentRect is documented but `borderBoxSize` is more accurate for
    // panels with padding/border. Fall back to contentRect if unavailable
    // (older Safari / happy-dom).
    let widthPx = 0
    let heightPx = 0
    const bb = (entry as ResizeObserverEntry).borderBoxSize
    if (bb && bb.length > 0 && bb[0]) {
      widthPx = bb[0].inlineSize
      heightPx = bb[0].blockSize
    } else if (entry.contentRect) {
      widthPx = entry.contentRect.width
      heightPx = entry.contentRect.height
    } else {
      // Last-resort: read offsetWidth/Height off the element.
      widthPx = el.offsetWidth
      heightPx = el.offsetHeight
    }

    const size: PanelSize = {
      width: px.toPt(widthPx),
      height: px.toPt(heightPx),
    }

    // Skip if unchanged (saves callback work; ResizeObserver can fire
    // redundant entries during layout cascades).
    if (size.width === lastSize.width && size.height === lastSize.height) {
      return
    }
    lastSize = size
    schedule(size)
  })

  observer.observe(el)

  return () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    try {
      observer.disconnect()
    } catch (err) {
      // disconnect can throw if observer was already collected — non-fatal.
      // eslint-disable-next-line no-console
      console.warn('[hiprint-v3:panel-reflow] disconnect threw:', err)
    }
  }
}
