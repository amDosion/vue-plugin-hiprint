/**
 * useHiprintRuntime.ts — V3 reactive runtime / registry composable.
 *
 * V3-native equivalent of vue-admin-main's `useHiprintRuntime.ts` (which
 * called `hiprint.init({ providers })`). In V3 the registry is a Pinia-free
 * singleton (`@hiprint-v3/core` PrintElementTypeRegistry), so this composable
 * is a small reactive wrapper over `getInstance()` + `defaultElementTypeProvider()`.
 *
 * Surface:
 *   - init(provider)        ← register the four built-in groups (or a custom provider)
 *   - setDynamicFields()    ← overwrite a module's groups (V1 PrintElementTypeManager.setDynamicFields)
 *   - removeDynamicFields() ← unregister a module or specific tids
 *
 * Invariants preserved through the registry (see ADR-0011):
 *   PM-007: addPrintElementTypes dual dedup (warn on tid replace)
 *   PM-008: removePrintElementTypes dotted prefix
 *   moduleName required (empty / null / undefined → throws)
 *
 * No DOM, no jQuery — registry is pure data.
 */

import { onMounted, ref, type Ref } from 'vue'
import {
  defaultElementTypeProvider,
  getInstance as getRegistryInstance,
  type DefaultElementTypeProviderApi,
  PrintElementTypeGroup,
  type ElementTypeGroupDef,
} from '@hiprint-v3/core'

// ============ Public types ============

/** Anything we accept as a "provider": API object or zero-arg factory. */
export type RuntimeProviderInput =
  | DefaultElementTypeProviderApi
  | (() => DefaultElementTypeProviderApi)

export interface UseHiprintRuntimeOptions {
  /**
   * Default provider used by `init()` when no argument is supplied. Defaults
   * to the four built-in groups via `defaultElementTypeProvider()`.
   */
  provider?: RuntimeProviderInput
  /** Auto-call init() in onMounted. Default true. */
  autoInit?: boolean
}

export interface UseHiprintRuntimeReturn {
  /** True after init() has run successfully at least once. */
  isInitialized: Ref<boolean>

  /**
   * Initialize the registry with the built-in groups (or a custom provider).
   * Idempotent: re-calling overwrites the existing `defaultModule` registration.
   */
  init(provider?: RuntimeProviderInput): void
  /** Overwrite a module's groups. V1 PrintElementTypeManager.setDynamicFields. */
  setDynamicFields(
    moduleName: string,
    groups: readonly (PrintElementTypeGroup | ElementTypeGroupDef)[]
  ): void
  /**
   * Remove a module (whole) or specific tids within it. V1
   * PrintElementTypeManager.removeDynamicFields. Without `tids` removes
   * the whole module; dotted-prefix is honored so `removeDynamicFields('order')`
   * does NOT touch `order_v2.*` (PM-008).
   */
  removeDynamicFields(moduleName: string, tids?: readonly string[]): void
}

// ============ Implementation ============

/** Resolve a provider input to an api object. */
function resolveProvider(input?: RuntimeProviderInput): DefaultElementTypeProviderApi {
  if (input == null) return defaultElementTypeProvider()
  if (typeof input === 'function') return input()
  return input
}

export function useHiprintRuntime(
  opts: UseHiprintRuntimeOptions = {}
): UseHiprintRuntimeReturn {
  const isInitialized = ref<boolean>(false)

  function init(provider?: RuntimeProviderInput): void {
    try {
      const api = resolveProvider(provider ?? opts.provider)
      api.addElementTypes(getRegistryInstance())
      isInitialized.value = true
    } catch (err) {
      console.error('[hiprint] useHiprintRuntime.init failed:', err)
      isInitialized.value = false
      throw err
    }
  }

  function setDynamicFields(
    moduleName: string,
    groups: readonly (PrintElementTypeGroup | ElementTypeGroupDef)[]
  ): void {
    // Registry.setDynamic throws for empty moduleName — let it bubble so
    // callers see the same error contract as V1/V2.
    const reg = getRegistryInstance()
    reg.setDynamic(moduleName, groups.slice() as ElementTypeGroupDef[])
  }

  function removeDynamicFields(moduleName: string, tids?: readonly string[]): void {
    const reg = getRegistryInstance()
    reg.unregister(moduleName, tids)
  }

  // onMounted only fires inside an active component setup() — calling
  // `useHiprintRuntime()` from a non-setup context (rare; e.g. plain store
  // bootstrap) will silently no-op the auto-init, which is the safe default.
  if (opts.autoInit !== false) {
    onMounted(() => {
      if (!isInitialized.value) init()
    })
  }

  return {
    isInitialized,
    init,
    setDynamicFields,
    removeDynamicFields,
  }
}
