/**
 * compat/build-toolbar.ts — V1 buildToolbar(container, template, options) → Controller.
 *
 * V1 source: bundle.js line 13305+ (buildToolbar — ~1550 lines of jQuery DOM
 *            assembly).
 * V2 reference: src/hiprint-v2/ui/toolbar.js (adapter mode delegating to V1).
 *
 * V3 strategy: mount the HiprintToolbar Vue SFC inside the container. The
 * toolbar wires itself to the same Pinia stores the PrintTemplate owns (via
 * the template's `_getPinia()` accessor) so undo/redo/save round-trip through
 * shared state.
 *
 * Returned controller exposes minimal V1 surface (destroy + scale getters).
 * Business consumers can also access the underlying Vue app via `_app`.
 */

import { createApp, type App } from 'vue'
import HiprintToolbar from '@hiprint-v3/components/HiprintToolbar.vue'
import { useCanvasStore } from '@hiprint-v3/stores'
import { assertNotDestroyed, safeCall } from '@hiprint-v3/internal'
import type { Pinia } from 'pinia'
import { setActivePinia, createPinia } from 'pinia'
import type { PrintTemplate } from './print-template'

// ============ Public types ============

export interface BuildToolbarOptions {
  /** Override Preview button. */
  onPreview?: (() => void) | undefined
  /** Override Print button. */
  onPrint?: (() => void) | undefined
  /** Override Save button. Receives the current JSON snapshot. */
  onSave?: ((json: unknown) => void) | undefined
  /** Subset of toolbar buttons to show. */
  buttons?: ReadonlyArray<string> | undefined
  /** Paper-size dropdown list. */
  paperTypes?: ReadonlyArray<{ label: string; width: number; height: number }> | undefined
  /** Default paper selection label. */
  defaultPaper?: string | undefined
  /** Pass-through: unknown V1 keys. */
  [key: string]: unknown
}

export interface ToolbarController {
  /** Unmount the toolbar's Vue app. Idempotent. */
  destroy(): void
  /** Current canvas scale (0.5 — 5). */
  getScale(): number
  /** Set canvas scale. */
  setScale(scale: number): void
  /** Underlying Vue app instance (escape hatch — avoid in business code). */
  readonly _app: App
  /** Container element. */
  readonly _container: HTMLElement
  /** Destroyed flag. */
  _destroyed: boolean
}

// ============ Helpers ============

function resolveContainer(input: string | HTMLElement | null | undefined): HTMLElement | null {
  if (!input) return null
  if (typeof input === 'string') {
    if (typeof document === 'undefined') return null
    const el = document.querySelector(input)
    return el instanceof HTMLElement ? el : null
  }
  return input instanceof HTMLElement ? input : null
}

// ============ Public API ============

/**
 * Build a V3 toolbar inside `container`. The toolbar mutates the same Pinia
 * stores that `template` owns (so undo/redo/save round-trip).
 *
 * V1 signature: `hiprint.buildToolbar(container, template, options)`.
 */
export function buildToolbar(
  container: string | HTMLElement,
  template: PrintTemplate,
  options: BuildToolbarOptions = {}
): ToolbarController {
  const target = resolveContainer(container)
  if (!target) {
    throw new Error('[hiprint] buildToolbar: container not found: ' + String(container))
  }
  if (!template) {
    throw new Error('[hiprint] buildToolbar: template is required')
  }

  // Share the template's pinia instance so toolbar manipulates the same state.
  // Fallback: if template lacks _getPinia (defensive — should not happen), create
  // a fresh pinia and warn the consumer.
  let pinia: Pinia
  const internalTpl = template as unknown as { _getPinia?: () => Pinia }
  if (typeof internalTpl._getPinia === 'function') {
    pinia = internalTpl._getPinia()
  } else {
    console.warn('[hiprint] buildToolbar: template missing _getPinia, using fresh pinia (state will not sync)')
    pinia = createPinia()
  }
  setActivePinia(pinia)

  const app = createApp(HiprintToolbar, {
    buttons: options.buttons,
    paperTypes: options.paperTypes,
    defaultPaper: options.defaultPaper,
    previewHandler: options.onPreview,
    printHandler: options.onPrint,
    saveHandler: options.onSave
      ? () => {
          safeCall(
            options.onSave as unknown as ((...args: unknown[]) => void) | undefined,
            [template.getJson()],
            'onSave'
          )
        }
      : undefined,
  })
  app.use(pinia)
  app.mount(target)

  const controller: ToolbarController = {
    _app: app,
    _container: target,
    _destroyed: false,

    destroy(): void {
      if (this._destroyed) return
      try {
        app.unmount()
      } catch (err) {
        console.warn('[hiprint] buildToolbar.destroy unmount failed:', err)
      }
      this._destroyed = true
    },

    getScale(): number {
      if (assertNotDestroyed(this as { _destroyed: boolean }, 'toolbar.getScale')) return 1
      setActivePinia(pinia)
      return useCanvasStore().scale
    },

    setScale(scale: number): void {
      if (assertNotDestroyed(this as { _destroyed: boolean }, 'toolbar.setScale')) return
      setActivePinia(pinia)
      useCanvasStore().setScale(scale)
    },
  }
  return controller
}
