// Live Translate — language list and swap tests
// Author / ผู้สร้าง: nattapat2871 (https://nattapat2871.me)
import { describe, expect, it } from 'vitest'
import { SOURCES, TARGETS, inAllowedLang, langBase, langBySpeech, langByCode, langNames, speechFor, targetFor } from './text'

describe('languages', () => {
  it('has unique keys and a name for every language', () => {
    for (const list of [SOURCES, TARGETS]) {
      expect(new Set(list.map(l => l.key)).size).toBe(list.length)
      for (const l of list) for (const ui of ['th', 'en']) expect(langNames(l, ui).local).not.toBe(l.code)
    }
    expect(TARGETS.length).toBeGreaterThan(200)
  })

  it('swaps Thai → English into English → Thai', () => {
    const from = langBySpeech('th-TH')
    const to = langByCode('en')
    expect(speechFor(to.code)?.key).toBe('en-US') // the first English locale
    expect(targetFor(from).key).toBe('th')
  })

  it('maps speech locales onto translation codes, including the odd ones', () => {
    expect(targetFor(langBySpeech('fil-PH')).key).toBe('tl')
    expect(targetFor(langBySpeech('yue-Hant-HK')).key).toBe('yue')
    expect(targetFor(langBySpeech('es-MX')).key).toBe('es')
    expect(speechFor('zh-TW')?.key).toBe('zh-TW')
    expect(speechFor('pt-PT')?.key).toBe('pt-PT')
  })

  it('cannot swap into a language speech recognition does not know', () => {
    expect(speechFor('haw')).toBeUndefined()
  })

  it('marks languages written without spaces', () => {
    expect(langBySpeech('th-TH').chars).toBe(true)
    expect(langBySpeech('yue-Hant-HK').chars).toBe(true)
    expect(langBySpeech('en-US').chars).toBe(false)
  })
})

describe('language gate', () => {
  // `detected` values are what translate.googleapis.com (sl=auto) returned for these strings (Nov 2026), except where a test overrides it.
  it('compares by base language', () => {
    expect(langBase('zh-TW')).toBe('zh')
    expect(langBase('yue')).toBe('zh')
    expect(langBase('iw')).toBe('he')
    expect(inAllowedLang('你好，我们走吧', 'zh-CN', ['zh'])).toBe(true)
  })

  it('keeps Japanese and drops Chinese when only Japanese is allowed', () => {
    expect(inAllowedLang('こんにちは、元気ですか', 'ja', ['ja'])).toBe(true)
    expect(inAllowedLang('敵発見', 'ja', ['ja'])).toBe(true) // kanji only, but Google says ja
    expect(inAllowedLang('你好，我们走吧', 'zh-CN', ['ja'])).toBe(false)
    expect(inAllowedLang('我们现在出发吧', 'ja', ['ja'])).toBe(false) // detector overridden: 4+ kanji with no kana is Chinese
  })

  it('trusts scripts over the detector', () => {
    expect(inAllowedLang('안녕하세요', 'ja', ['ja'])).toBe(false)
    expect(inAllowedLang('สวัสดีครับ ไปกันเลย', 'en', ['en'])).toBe(false)
    expect(inAllowedLang('สวัสดีครับ', 'th', ['ja', 'th'])).toBe(true)
  })

  it('drops other Latin-script languages but lets very short lines through', () => {
    expect(inAllowedLang("hello let's go", 'en', ['ja'])).toBe(false)
    expect(inAllowedLang("hello let's go", 'en', ['ja', 'en'])).toBe(true)
    expect(inAllowedLang('gg', 'en', ['ja'])).toBe(true)
    expect(inAllowedLang('了解', 'zh-CN', ['ja'])).toBe(true)
    expect(inAllowedLang('whatever', '', ['ja'])).toBe(true) // no detection: do not drop
  })
})
