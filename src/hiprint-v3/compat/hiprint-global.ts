/**
 * compat/hiprint-global.ts — V1 `hiprint` global facade.
 *
 * Business consumers' code:
 *   import { hiprint, defaultElementTypeProvider } from 'vue-plugin-hiprint'
 *   hiprint.init({ providers: [new defaultElementTypeProvider()] })
 *   new hiprint.PrintTemplate({...})
 *   hiprint.setDynamicFields(moduleName, fieldGroups)
 *
 * V3 wires these to the V3 registry singleton + socket singleton without
 * recreating any V1/V2 jQuery surface.
 *
 * V1 source: bundle.js line 8950+ (hiprint object construction).
 *
 * Invariants (ADR-0011):
 *   #7 setDynamicFields: empty moduleName → throws (V1 line 13261-13286 fix)
 *   #7 setDynamicFields: empty fields → throws
 *   #8 removeDynamicFields: dotted-prefix removal (`order` not removing `order_v2`)
 *   #14 register tid dedup with console.warn (R1 PM-007)
 */

import {
  getInstance as getRegistryInstance,
  defaultElementTypeProvider,
  type DefaultElementTypeProviderApi,
  type ElementTypeGroupDef,
  type PrintElementTypeRegistry,
} from '@hiprint-v3/core'
import { getHiWebSocket } from '@hiprint-v3/print'
import { safeCall } from '@hiprint-v3/internal'
import { PrintTemplate } from './print-template'

// ============ Public types ============

/**
 * Provider passed to `hiprint.init()`. Supports the V1 shapes:
 *   1. function: () => DefaultElementTypeProviderApi  (factory)
 *   2. instance of class with `addElementTypes(hiprint)` method (V1 provider)
 *   3. { providers: [...] }  (V1 actual call shape)
 */
export interface HiprintInitOptions {
  /** V1 quirk: callers passed `{ providers: [new Foo()] }`. */
  providers?: ReadonlyArray<unknown>
  /** Language code (V1 lang option; V3 forwards to i18n). */
  lang?: string | undefined
  /** Unknown V1 options pass through. */
  [key: string]: unknown
}

/** Result of `hiprint.init()`. */
export interface HiprintInitResult {
  /** Modules registered during init. */
  moduleNames: readonly string[]
}

// ============ Helpers ============

/**
 * Coerce a provider-shaped value into the V3 `DefaultElementTypeProviderApi`.
 * Accepts:
 *  - V1 instance with addElementTypes(hiprint) — invoked with our registry
 *  - V1 instance with no addElementTypes — looks for `elementTypes` property
 *  - V3 `DefaultElementTypeProviderApi` — used directly
 */
function adaptProvider(
  provider: unknown,
  registry: PrintElementTypeRegistry
): void {
  if (!provider || typeof provider !== 'object') return

  const candidate = provider as {
    addElementTypes?: (target: unknown) => void
    groups?: () => readonly ElementTypeGroupDef[]
    elementTypes?: readonly ElementTypeGroupDef[]
  }

  // V3 provider shape (compatible with default-provider.ts).
  if (typeof candidate.addElementTypes === 'function' && typeof candidate.groups === 'function') {
    // V3 native: pass registry instance.
    safeCall(
      candidate.addElementTypes as unknown as (...args: unknown[]) => void,
      [registry],
      'provider.addElementTypes'
    )
    return
  }

  // V1 provider shape: addElementTypes(hiprint) — we pass a thin shim
  // exposing `register(moduleName, groups)`.
  if (typeof candidate.addElementTypes === 'function') {
    const shim = {
      register(moduleName: string, groups: ElementTypeGroupDef[]) {
        registry.register(moduleName, groups)
      },
      addPrintElementTypes(moduleName: string, groups: ElementTypeGroupDef[]) {
        registry.register(moduleName, groups)
      },
    }
    safeCall(
      candidate.addElementTypes as unknown as (...args: unknown[]) => void,
      [shim],
      'provider.addElementTypes'
    )
    return
  }

  // Fallback: provider exposes `elementTypes` array — treat as defaultModule.
  if (Array.isArray(candidate.elementTypes)) {
    registry.register('defaultModule', candidate.elementTypes as ElementTypeGroupDef[])
  }
}

// ============ Hiprint facade ============

/**
 * V1-compatible `hiprint` global. Exported as a singleton-style object so
 * consumers can `import { hiprint } from 'vue-plugin-hiprint'` and call
 * methods without further wiring.
 */
export interface HiprintFacade {
  /** V1 quirk: PrintTemplate class accessible via hiprint.PrintTemplate. */
  readonly PrintTemplate: typeof PrintTemplate
  /** Pinned version string. */
  version: string
  /** Initialize element type providers. */
  init(options?: HiprintInitOptions | ((...args: unknown[]) => DefaultElementTypeProviderApi)): HiprintInitResult
  /** Set / replace dynamic fields under a module. */
  setDynamicFields(moduleName: string, fields: ElementTypeGroupDef[]): void
  /** Remove dynamic fields (whole module or specific tids). */
  removeDynamicFields(moduleName: string, tids?: readonly string[]): void
  /** V1 alias for setDynamicFields(moduleName, groups). */
  setElementTypeGroups(moduleName: string, groups: ElementTypeGroupDef[]): void
  /** V1 alias for adding additional groups (additive — no replace). */
  appendElementTypeGroups(moduleName: string, groups: ElementTypeGroupDef[]): void
  /** Rename an element type by tid (V1 quirk). */
  renameElementType(tid: string, newTitle: string): void
  /** Auto-connect to local print client socket. */
  autoConnect(host?: string, token?: string, cb?: (opened: boolean) => void): void
  /** Disconnect / cancel auto-connect. */
  disAutoConnect(): void
  /** Direct read access to the hiwebSocket singleton. */
  readonly hiwebSocket: ReturnType<typeof getHiWebSocket>
  /** V1 client info helpers (.bind not needed — methods are arrow-bound). */
  getClients(): void
  getClientInfo(): void
  getAddress(type: string, ...args: unknown[]): void
  ippPrint(options: unknown): void
  ippRequest(options: unknown): void
  /** V1 print without instantiating a template. */
  print(template: unknown, data?: unknown): void
  print2(template: unknown, data?: unknown, options?: unknown): void
  getHtml(template: unknown, data?: unknown): string
}

/**
 * Create the hiprint facade. Exported for advanced use (multiple isolated
 * registries / sockets in test rigs); production code should import the
 * singleton `hiprint` from this module's barrel.
 */
function createHiprint(): HiprintFacade {
  return {
    PrintTemplate,
    version: '3.0.0',

    init(options): HiprintInitResult {
      const registry = getRegistryInstance()

      // Shape 1: function — treat as factory returning a provider API.
      if (typeof options === 'function') {
        try {
          const providerApi = (options as () => DefaultElementTypeProviderApi)()
          adaptProvider(providerApi, registry)
        } catch (err) {
          console.error('[hiprint] init provider factory failed:', err)
        }
        return { moduleNames: registry.getModuleNames() }
      }

      // Shape 2: undefined / null — register defaults.
      if (!options) {
        defaultElementTypeProvider().addElementTypes(registry)
        return { moduleNames: registry.getModuleNames() }
      }

      // Shape 3: { providers: [...] } (V1 actual call shape).
      const opts = options
      const providers = Array.isArray(opts.providers) ? opts.providers : []
      if (providers.length === 0) {
        // No providers — fall back to defaults so designer always has groups.
        defaultElementTypeProvider().addElementTypes(registry)
      } else {
        for (const p of providers) {
          adaptProvider(p, registry)
        }
      }
      return { moduleNames: registry.getModuleNames() }
    },

    setDynamicFields(moduleName, fields): void {
      // Invariant #7: empty moduleName → throw (V1 line 13261-13286 fix).
      if (!moduleName) {
        throw new Error('[hiprint] setDynamicFields: moduleName is required')
      }
      // Invariant #7: null/undefined fields → throw. Empty array is allowed
      // (clears module).
      if (fields === null || fields === undefined) {
        throw new Error('[hiprint] setDynamicFields: fields is required')
      }
      const registry = getRegistryInstance()
      registry.setDynamic(moduleName, fields)
    },

    removeDynamicFields(moduleName, tids): void {
      if (!moduleName) {
        console.warn('[hiprint] removeDynamicFields called without moduleName')
        return
      }
      const registry = getRegistryInstance()
      registry.unregister(moduleName, tids)
    },

    setElementTypeGroups(moduleName, groups): void {
      if (!moduleName) {
        throw new Error('[hiprint] setElementTypeGroups: moduleName is required')
      }
      const registry = getRegistryInstance()
      registry.setDynamic(moduleName, groups)
    },

    appendElementTypeGroups(moduleName, groups): void {
      if (!moduleName) {
        throw new Error('[hiprint] appendElementTypeGroups: moduleName is required')
      }
      const registry = getRegistryInstance()
      // Additive registration (does not pre-unregister).
      registry.register(moduleName, groups)
    },

    renameElementType(tid, newTitle): void {
      if (!tid) {
        console.warn('[hiprint] renameElementType: tid is required')
        return
      }
      const registry = getRegistryInstance()
      registry.update(tid, (prev) => {
        if (!prev) return prev as never
        return { ...prev, title: newTitle }
      })
    },

    autoConnect(host, token, cb): void {
      const ws = getHiWebSocket()
      if (host) {
        ws.setHost(host, token, cb)
      } else {
        ws.start(cb)
      }
    },

    disAutoConnect(): void {
      getHiWebSocket().stop()
    },

    get hiwebSocket() {
      return getHiWebSocket()
    },

    getClients(): void {
      getHiWebSocket().getClients()
    },

    getClientInfo(): void {
      getHiWebSocket().getClientInfo()
    },

    getAddress(type, ...args): void {
      getHiWebSocket().getAddress(type, ...args)
    },

    ippPrint(options): void {
      getHiWebSocket().ippPrint(options)
    },

    ippRequest(options): void {
      getHiWebSocket().ippRequest(options)
    },

    print(template, data): void {
      // Ad-hoc PrintTemplate wrapper for one-shot prints (V1 quirk).
      const tpl = new PrintTemplate({ template: template as TemplateJsonAny })
      try {
        tpl.print(data as Record<string, unknown> | undefined)
      } finally {
        tpl.destroy()
      }
    },

    print2(template, data, options): void {
      const tpl = new PrintTemplate({ template: template as TemplateJsonAny })
      try {
        tpl.print2(
          data as Record<string, unknown> | undefined,
          options as Record<string, unknown> | undefined
        )
      } finally {
        tpl.destroy()
      }
    },

    getHtml(template, data): string {
      const tpl = new PrintTemplate({ template: template as TemplateJsonAny })
      try {
        return tpl.getHtml(data as Record<string, unknown> | undefined)
      } finally {
        tpl.destroy()
      }
    },
  }
}

// Local widening helper — V1 templates have looser shapes than V3 strict type.
type TemplateJsonAny = Record<string, unknown>

/** Singleton facade (one per page — matches V1 `window.hiprint`). */
export const hiprint: HiprintFacade = createHiprint()

/** Re-export defaults for `import { defaultElementTypeProvider } from ...`. */
export { defaultElementTypeProvider }
