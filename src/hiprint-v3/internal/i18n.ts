/**
 * i18n.ts — V3 internationalization (ported from V2).
 *
 * V1: bundle.js line 73-95 + import.meta.glob('../i18n/*.json').
 * V3: 与 V2 一致, TS 强化 + 显式 module type. happy-dom / pure node 环境无
 * import.meta.glob 时降级到空 catalogs (不 break unit test).
 */

export type I18nCatalog = Record<string, string>

export interface I18n {
  lang: string
  readonly languages: Record<string, I18nCatalog>
  /** Translate key with optional params. */
  __(key: string, params?: Record<string, unknown> | string | number): string
  /** Pluralize-with-%s helper. */
  __n(key: string, val: unknown): string
  /** Switch active language. */
  setLang(lang: string): void
}

// Vite 静态展开 import.meta.glob (eager:true).
// happy-dom / pure node 环境无 import.meta.glob → try-catch 容错降级.
const languages: Record<string, I18nCatalog> = {}
try {
  // The path is relative to compiled chunk; pointing at src/i18n/*.json from src/hiprint-v3/internal/.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx = (import.meta as any).glob('../../i18n/*.json', { eager: true }) as Record<
    string,
    { default?: I18nCatalog } & I18nCatalog
  >
  Object.keys(ctx).forEach((key) => {
    const m = key.match(/\/([^/.]+)\.json$/)
    if (m && m[1]) {
      const mod = ctx[key]!
      languages[m[1]] = (mod.default ?? mod) as I18nCatalog
    }
  })
} catch {
  // happy-dom / pure node — degraded mode
  languages.cn = {}
  languages.en = {}
}

export const i18n: I18n = {
  lang: 'cn',
  languages,

  __(key, params) {
    const bundle = this.languages[this.lang] ?? {}
    let str = bundle[key] ?? key
    if (params && typeof params === 'object' && !Array.isArray(params)) {
      const obj = params as Record<string, unknown>
      Object.keys(obj).forEach((k) => {
        str = str.replace(new RegExp('{{' + k + '}}', 'g'), String(obj[k] ?? ''))
      })
      return str
    }
    if (params != null) {
      str = str.replace(/%s/g, String(params))
    }
    return str
  },

  __n(key, val) {
    const bundle = this.languages[this.lang] ?? {}
    const str = bundle[key] ?? key
    return str.replace(/%s/g, String(val))
  },

  setLang(lang) {
    if (this.languages[lang]) {
      this.lang = lang
    } else {
      console.warn('[hiprint] i18n.setLang: unknown lang "' + lang + '"')
    }
  },
}
