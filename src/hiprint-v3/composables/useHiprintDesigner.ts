/**
 * useHiprintDesigner.ts — V3 reactive designer composable.
 *
 * V3-native equivalent of vue-admin-main's `useHiprintDesigner.ts`. Hosts
 * (route components, modals) that need to drive the designer programmatically
 * — load a template on route enter, save on unmount, react to prop changes
 * without losing dirty edits — wire to this composable.
 *
 * Composition:
 *   - useHiprintTemplate (load/save/dirty/undo/redo)
 *   - useHiprintCanvas    (panels/selection)
 *   - lifecycle wiring   (onMounted auto-load + onBeforeUnmount destroy)
 *
 * Reactive-aware template option:
 *   `opts.template` accepts `Ref | () => TemplateJson | null | undefined`.
 *   `toValue()` resolves on each watcher tick. If the input changes and the
 *   designer is NOT dirty, we hot-swap. If it is dirty, we skip — matches
 *   vue-admin-main's "edits-protect" behavior.
 *
 * No jQuery. No DOM. UI lives in components/HiprintDesigner.vue.
 */

import {
  computed,
  onBeforeUnmount,
  onMounted,
  toValue,
  watch,
  type ComputedRef,
  type MaybeRefOrGetter,
} from 'vue'
import { useHiprintCanvas, type UseHiprintCanvasReturn } from './useHiprintCanvas'
import {
  useHiprintTemplate,
  type UseHiprintTemplateReturn,
  type TemplateJson,
} from './useHiprintTemplate'

// ============ Public types ============

export interface UseHiprintDesignerOptions {
  /** Template to load on mount. Reactive — changes trigger reload (unless dirty). */
  template?: MaybeRefOrGetter<TemplateJson | null | undefined>
  /**
   * Data for binding. Passed-through to print fns later; the designer itself
   * does not read this, but we accept it for parity with vue-admin-main.
   */
  data?: MaybeRefOrGetter<Record<string, unknown> | null | undefined>
  /**
   * If true (default), reload when `template` ref changes — only when the
   * designer is NOT currently dirty (protects unsaved edits).
   */
  autoLoad?: boolean
  /** Clear template on unmount (default true). */
  destroyOnUnmount?: boolean
}

export interface UseHiprintDesignerReturn {
  /** Reactive template sub-composable (load/save/dirty/undo/redo). */
  template: UseHiprintTemplateReturn
  /** Reactive canvas sub-composable (panels/selection). */
  canvas: UseHiprintCanvasReturn

  /** True after the initial load (or true immediately if no template option). */
  isReady: ComputedRef<boolean>

  /**
   * Imperative teardown. Clears template + canvas + history. Components that
   * unmount through Vue's lifecycle don't need to call this — it runs in
   * onBeforeUnmount when `destroyOnUnmount` is true.
   */
  destroy(): void
}

// ============ Implementation ============

export function useHiprintDesigner(
  opts: UseHiprintDesignerOptions = {}
): UseHiprintDesignerReturn {
  const template = useHiprintTemplate()
  const canvas = useHiprintCanvas()

  const autoLoad = opts.autoLoad !== false
  const destroyOnUnmount = opts.destroyOnUnmount !== false

  /**
   * Ready means:
   *  - template option not provided (nothing to wait on), OR
   *  - load has completed (isLoaded === true), AND
   *  - not currently loading.
   * The combination keeps consumers' v-if="isReady" stable across reloads.
   */
  const isReady = computed<boolean>(() => {
    if (template.isLoading.value) return false
    if (opts.template == null) return true
    return template.isLoaded.value
  })

  // -------- Mount: optional initial load --------

  onMounted(() => {
    const initial = opts.template != null ? toValue(opts.template) : null
    if (initial) {
      // Fire-and-forget: callers can await template.loadFromJson() directly if
      // they want stricter error handling than the watcher path.
      template.loadFromJson(initial).catch((err) => {
        console.error('[hiprint] useHiprintDesigner: initial load failed:', err)
      })
    }
  })

  // -------- Reactive template prop --------

  if (autoLoad && opts.template != null) {
    watch(
      () => toValue(opts.template),
      (next) => {
        if (!next) return
        // Dirty-guard: don't overwrite unsaved edits silently.
        if (template.isDirty.value) {
          console.warn(
            '[hiprint] useHiprintDesigner: skipping reactive reload — designer is dirty. ' +
              'Call template.save() or template.clear() first.'
          )
          return
        }
        template.loadFromJson(next).catch((err) => {
          console.error('[hiprint] useHiprintDesigner: reactive reload failed:', err)
        })
      },
      // Don't immediate-fire — onMounted handles the initial load explicitly.
      { flush: 'post' }
    )
  }

  // -------- Unmount: optional destroy --------

  function destroy(): void {
    template.clear()
  }

  onBeforeUnmount(() => {
    if (destroyOnUnmount) destroy()
  })

  return {
    template,
    canvas,
    isReady,
    destroy,
  }
}
