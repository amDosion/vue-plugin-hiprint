/**
 * i18n.js — V2 i18n.
 *
 * V1: bundle.js line 73-95 + languages 由 import.meta.glob('../i18n/*.json') 加载.
 * V2: 与 V1 一致, 仍用 import.meta.glob, 但导出独立 i18n 实例方便 HMR + test.
 */

// Vite 静态展开 import.meta.glob (eager:true).
// 在 happy-dom / vitest 环境下, import.meta.glob 可能不可用 → 用 try-catch 容错.
const languages = {}
try {
  // eslint-disable-next-line
  const ctx = import.meta.glob('../../i18n/*.json', { eager: true })
  Object.keys(ctx).forEach((key) => {
    const m = key.match(/\/([^/.]+)\.json$/)
    if (m) languages[m[1]] = ctx[key].default || ctx[key]
  })
} catch (err) {
  // happy-dom / pure node 环境无 import.meta.glob, 不 break
  languages.cn = {}
  languages.en = {}
}

export const i18n = {
  lang: 'cn',
  languages,

  /**
   * Translate key with optional params (object → {{k}} replace, scalar → %s replace).
   *
   * @param {string} key
   * @param {object|string|number} [params]
   * @returns {string}
   */
  __(key, params) {
    const bundle = this.languages[this.lang] || {}
    let str = bundle[key] || key
    if (params && typeof params === 'object' && !Array.isArray(params)) {
      Object.keys(params).forEach((k) => {
        str = str.replace(new RegExp('{{' + k + '}}', 'g'), params[k])
      })
      return str
    }
    if (params != null) {
      str = str.replace(/%s/g, params)
    }
    return str
  },

  /**
   * Pluralize-with-%s helper.
   *
   * @param {string} key
   * @param {*} val
   * @returns {string}
   */
  __n(key, val) {
    const bundle = this.languages[this.lang] || {}
    const str = bundle[key] || key
    return str.replace(/%s/g, val)
  },

  /** Switch active language. */
  setLang(lang) {
    if (this.languages[lang]) {
      this.lang = lang
    } else {
      console.warn('[hiprint] i18n.setLang: unknown lang "' + lang + '"')
    }
  },
}
