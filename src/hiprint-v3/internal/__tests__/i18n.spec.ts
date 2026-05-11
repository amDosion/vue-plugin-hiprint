/**
 * i18n.spec.ts — i18n.__ key replacement.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { i18n } from '../i18n'

describe('i18n.__', () => {
  beforeEach(() => {
    // 注入测试 translations (覆盖 import.meta.glob 不可用的 fallback)
    i18n.languages.cn = {
      hello: '你好',
      greet: '你好,{{name}}',
      count: '共 %s 项',
    }
    i18n.languages.en = {
      hello: 'Hello',
      greet: 'Hello, {{name}}',
      count: '%s items',
    }
    i18n.lang = 'cn'
  })

  it('lookup by key', () => {
    expect(i18n.__('hello')).toBe('你好')
  })

  it('fallback to key if not found', () => {
    expect(i18n.__('not.exist')).toBe('not.exist')
  })

  it('object params → {{k}} replace', () => {
    expect(i18n.__('greet', { name: 'Alice' })).toBe('你好,Alice')
  })

  it('scalar param → %s replace', () => {
    expect(i18n.__('count', 5)).toBe('共 5 项')
  })

  it('switch lang', () => {
    i18n.setLang('en')
    expect(i18n.__('hello')).toBe('Hello')
    expect(i18n.__('greet', { name: 'Bob' })).toBe('Hello, Bob')
  })

  it('unknown lang → warn + no switch', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const before = i18n.lang
    i18n.setLang('zz')
    expect(i18n.lang).toBe(before)
    expect(console.warn).toHaveBeenCalled()
  })

  it('__n pluralize helper', () => {
    expect(i18n.__n('count', 10)).toBe('共 10 项')
  })

  it('handles null params gracefully', () => {
    expect(i18n.__('hello', null as unknown as undefined)).toBe('你好')
    expect(i18n.__('hello', undefined)).toBe('你好')
  })
})
