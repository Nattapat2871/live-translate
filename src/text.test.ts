// Live Translate — language list and swap tests
// Author / ผู้สร้าง: nattapat2871 (https://nattapat2871.me)
import { describe, expect, it } from 'vitest'
import { SOURCES, TARGETS, langBySpeech, langByCode, langNames, speechFor, targetFor } from './text'

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
