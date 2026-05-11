/**
 * compat/vue-plugin.ts — V1 hiPrintPlugin Vue plugin compat.
 *
 * V1 source: src/index.js — hiPrintPlugin.install(app, name, autoConnect).
 *
 * Business usage:
 *   import { createApp } from 'vue'
 *   import { hiPrintPlugin } from 'vue-plugin-hiprint'
 *   const app = createApp(...)
 *   app.use(hiPrintPlugin)
 *
 * V1 install signature: `install(app, name = '$hiPrint', autoConnect = false)`.
 * We honor `name` (where the global property is published) and `autoConnect`
 * (start socket on install).
 *
 * Globals exposed:
 *   - $hiPrint (or custom name): the hiprint facade
 *   - $print: convenience for one-shot browser print
 *   - $print2: convenience for one-shot silent print via hiwebSocket
 *
 * Also calls `app.provide('hiprint', hiprint)` so composition-API consumers can
 * `inject('hiprint')`.
 */

import type { App } from 'vue'
import { hiprint, defaultElementTypeProvider } from './hiprint-global'
import { browserPrint, getHiWebSocket, getPrintHtml } from '@hiprint-v3/print'
import { safeCall } from '@hiprint-v3/internal'
import type { TemplateJson } from '@hiprint-v3/schemas'

// ============ Public types ============

/**
 * V1 plugin install options. Backward-compatible: positional args still work
 * (Vue 3 plugin install receives them via spread args after app).
 */
export interface HiPrintPluginOptions {
  /** Property name under app.config.globalProperties. Default '$hiPrint'. */
  name?: string
  /** Whether to auto-connect socket on install. Default false. */
  autoConnect?: boolean
}

export interface HiPrintPlugin {
  install(app: App, options?: HiPrintPluginOptions | string, autoConnect?: boolean): void
  /** V1 quirk: top-level helper for canceling auto-connect. */
  disAutoConnect(): void
}

// ============ Implementation ============

/**
 * Coerce install args (V1 positional shape vs V3 options-object shape):
 *   install(app)
 *   install(app, '$hiPrint')
 *   install(app, '$hiPrint', true)
 *   install(app, { name: '$hiPrint', autoConnect: true })
 */
function normalizeInstallArgs(
  optionsOrName?: HiPrintPluginOptions | string,
  autoConnect?: boolean
): Required<HiPrintPluginOptions> {
  if (typeof optionsOrName === 'string') {
    return {
      name: optionsOrName,
      autoConnect: autoConnect === true,
    }
  }
  return {
    name: optionsOrName?.name ?? '$hiPrint',
    autoConnect: optionsOrName?.autoConnect === true,
  }
}

/**
 * One-shot browser print: build a transient template, render HTML, dispatch
 * to window.print() via hidden iframe.
 */
function performBrowserPrint(template: unknown, data?: unknown): void {
  const json = template as TemplateJson
  void browserPrint(json, { data: data as Record<string, unknown> | undefined }).catch((err: unknown) => {
    console.warn('[hiprint] $print failed:', err)
  })
}

/**
 * One-shot silent print: render HTML, dispatch via hiwebSocket. Protocol
 * identical to V1/V2 (Invariant #12).
 */
function performSilentPrint(template: unknown, data?: unknown, options?: unknown): void {
  const json = template as TemplateJson
  const html = getPrintHtml(json, { data: data as Record<string, unknown> | undefined })
  const ws = getHiWebSocket()
  if (!ws.opened) {
    console.warn('[hiprint] $print2 called but hiwebSocket not connected; payload dropped')
    return
  }
  try {
    ws.send({
      type: 'PRINT',
      templateId: (json as { templateId?: string }).templateId,
      html,
      data,
      ...(typeof options === 'object' && options !== null ? options : {}),
    })
  } catch (err) {
    console.error('[hiprint] $print2 send failed:', err)
  }
}

/**
 * V1-compatible Vue plugin. Drop-in replacement: business consumers do
 * `app.use(hiPrintPlugin)` and existing `$hiPrint` / `$print` / `$print2`
 * usages work unchanged.
 */
export const hiPrintPlugin: HiPrintPlugin = {
  install(app: App, optionsOrName?: HiPrintPluginOptions | string, autoConnectArg?: boolean): void {
    const { name, autoConnect } = normalizeInstallArgs(optionsOrName, autoConnectArg)

    // V1 default: do NOT auto-connect. If autoConnect=true, start socket.
    if (autoConnect) {
      const ws = getHiWebSocket()
      try {
        ws.start()
      } catch (err) {
        console.warn('[hiprint] vue-plugin autoConnect start failed:', err)
      }
    } else {
      // V1 explicitly stopped any prior connection when autoConnect=false.
      const ws = getHiWebSocket()
      if (ws.opened) {
        try {
          ws.stop()
        } catch (err) {
          console.warn('[hiprint] vue-plugin stop failed:', err)
        }
      }
    }

    const globals = app.config.globalProperties as Record<string, unknown>
    globals[name] = hiprint

    /**
     * $print(provider?, template?, ...args): one-shot browser print.
     *
     * V1 signature accepts `(provider, template, data, options)`. The provider
     * is optional — defaults to defaultElementTypeProvider. We initialize the
     * registry from the provider then forward to browserPrint.
     */
    globals.$print = (...args: unknown[]): void => {
      // Detect provider-first call shape: first arg looks like a constructor
      // (V1 used `new provider()`) or a function.
      let template: unknown
      let extra: unknown[]
      if (typeof args[0] === 'function') {
        // Provider supplied — initialize registry then take template from args[1].
        try {
          const ProviderCtor = args[0] as new () => unknown
          hiprint.init({ providers: [new ProviderCtor()] })
        } catch (err) {
          console.warn('[hiprint] $print provider init failed:', err)
        }
        template = args[1]
        extra = args.slice(2)
      } else {
        template = args[0]
        extra = args.slice(1)
      }
      safeCall(
        () => performBrowserPrint(template, extra[0]),
        [],
        '$print'
      )
    }

    /**
     * $print2(provider?, template?, ...args): one-shot silent print via socket.
     */
    globals.$print2 = (...args: unknown[]): void => {
      let template: unknown
      let extra: unknown[]
      if (typeof args[0] === 'function') {
        try {
          const ProviderCtor = args[0] as new () => unknown
          hiprint.init({ providers: [new ProviderCtor()] })
        } catch (err) {
          console.warn('[hiprint] $print2 provider init failed:', err)
        }
        template = args[1]
        extra = args.slice(2)
      } else {
        template = args[0]
        extra = args.slice(1)
      }
      safeCall(
        () => performSilentPrint(template, extra[0], extra[1]),
        [],
        '$print2'
      )
    }

    // Provide for composition-API consumers.
    app.provide('hiprint', hiprint)
    app.provide('hiPrintDefaults', { defaultElementTypeProvider })
  },

  disAutoConnect(): void {
    try {
      getHiWebSocket().stop()
    } catch (err) {
      console.warn('[hiprint] disAutoConnect failed:', err)
    }
  },
}
