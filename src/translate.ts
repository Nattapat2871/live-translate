// Live Translate — translation engines
// Author / ผู้สร้าง: nattapat2871 (https://nattapat2871.me)
import type { Turn } from './pipeline'
import { inAllowedLang, langBase } from './text'

export type ErrorCode = 'auth' | 'rate' | 'network' | 'unsupported' | 'other'

export class TranslateError extends Error {
  code: ErrorCode
  source: 'google' | 'chrome' | 'claude'
  constructor(source: TranslateError['source'], code: ErrorCode, message?: string) {
    super(message ?? code)
    this.source = source
    this.code = code
  }
}

const GOOGLE_TIMEOUT_MS = 8000

// ---------- Google (free first pass) ----------
// Unofficial endpoint with CORS *. ponytail: may rate-limit under heavy use; the pipeline retries with backoff and caps concurrency.
export async function google(text: string, sl: string, tl: string, signal?: AbortSignal): Promise<string> {
  return (await gtx(text, sl, tl, signal)).dst
}

/** `lang` is the source language Google used: its detection when `sl` is auto (response index 2, e.g. "ja", "zh-CN"). */
async function gtx(text: string, sl: string, tl: string, signal?: AbortSignal): Promise<{ dst: string; lang: string }> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&q=${encodeURIComponent(text)}`
  const timeout = AbortSignal.timeout(GOOGLE_TIMEOUT_MS)
  // A caller abort is a cancellation, passed through as is; our own timeout is a network failure.
  const failure = (e: unknown, code: ErrorCode) => (signal?.aborted ? e : new TranslateError('google', timeout.aborted ? 'network' : code))
  let res: Response
  try {
    res = await fetch(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout })
  } catch (e) {
    throw failure(e, 'network')
  }
  if (res.status === 429) throw new TranslateError('google', 'rate')
  if (!res.ok) throw new TranslateError('google', 'other', `HTTP ${res.status}`)
  try {
    const data = (await res.json()) as [[string, ...unknown[]][], unknown, unknown]
    return { dst: data[0].map(s => s[0]).join(''), lang: typeof data[2] === 'string' ? data[2] : '' }
  } catch (e) {
    throw failure(e, 'other') // not JSON, or not the shape we expect
  }
}

/** Returns line `n` (1-based) of a translation that was sent as `n` lines, or null if the lines did not survive. */
export function nthLine(out: string, n: number): string | null {
  const lines = out.split('\n')
  return lines.length === n ? lines[n - 1].trim() : null
}

/** Translates `text` with the previous line attached, so pronouns and topic carry over. */
export async function quickTranslate(text: string, prev: string | undefined, sl: string, tl: string, signal?: AbortSignal) {
  if (prev) {
    const line = nthLine(await google(`${prev}\n${text}`, sl, tl, signal), 2)
    if (line) return line
  }
  return google(text, sl, tl, signal)
}

/**
 * Like quickTranslate, but returns null for a line that is not in one of the `allowed` base languages.
 * Costs one extra request per line with context: the language is detected on the line alone, never with `prev` attached.
 */
export async function gatedTranslate(text: string, prev: string | undefined, sl: string, tl: string, allowed: string[], signal?: AbortSignal) {
  const { dst, lang } = await gtx(text, 'auto', tl, signal)
  if (!inAllowedLang(text, lang, allowed)) return null
  if (!prev) return dst
  const line = nthLine(await google(`${prev}
${text}`, allowed.includes(langBase(lang)) ? lang : sl, tl, signal), 2)
  return line ?? dst
}

// ---------- shared prompt for context-aware engines ----------
export function systemPrompt(from: string, to: string) {
  return `You translate live voice chat between gamers, from ${from} into ${to}.
The input is speech-recognition text of friends talking in a game or Discord call. It can contain recognition mistakes, missing punctuation, gaming slang, callouts, player or map names, and sometimes several people talking over each other merged into one line.
Translate only the text inside <new>. Use <context> only to resolve pronouns, slang, the current topic and likely misheard words; never translate it again.
Write it the way a ${to}-speaking gamer would say it in voice chat: short and natural. Keep game terms, item names and player names that players normally leave untranslated. If the line is fragments from overlapping speakers, translate the fragments in order, separated by " / ".
Reply with the translation only.`
}

export function userPrompt(text: string, history: Turn[]) {
  const context = history.map(h => `${h.src}  =>  ${h.dst}`).join('\n') || '(none)'
  return `<context>\n${context}\n</context>\n<new>${text}</new>`
}

// ---------- Claude (visitor's own key) ----------
/** Accept only real Anthropic keys, so an autofilled password can never be sent anywhere. */
export function isClaudeKey(value: string) {
  return /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(value.trim())
}

type Sdk = typeof import('@anthropic-ai/sdk')
let sdk: Sdk | undefined
let client: InstanceType<Sdk['default']> | undefined
let clientKey = ''

export function claudeRefiner(key: string, model: string, from: string, to: string) {
  return async (text: string, history: Turn[]): Promise<string | null> => {
    if (!isClaudeKey(key)) throw new TranslateError('claude', 'auth')
    sdk ??= await import('@anthropic-ai/sdk')
    const Anthropic = sdk.default
    if (!client || clientKey !== key) {
      // The visitor's own key, used only from their own browser; the SDK refuses browsers without this flag.
      client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 1 })
      clientKey = key
    }
    const params = {
      model,
      max_tokens: 2048,
      output_config: { effort: 'low' as const },
      system: systemPrompt(from, to),
      messages: [{ role: 'user' as const, content: userPrompt(text, history) }],
    }
    try {
      // Haiku 5.5 has no server-side fallback; Opus/Sonnet 5.5 retry on another model after a policy refusal.
      const res = model.startsWith('claude-haiku')
        ? await client.messages.create(params)
        : await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
      if (res.stop_reason === 'refusal') return null // keep the quick translation
      return res.content.flatMap(b => (b.type === 'text' ? [b.text] : [])).join('').trim() || null
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw new TranslateError('claude', 'auth')
      if (e instanceof Anthropic.RateLimitError) throw new TranslateError('claude', 'rate')
      if (e instanceof Anthropic.APIConnectionError) throw new TranslateError('claude', 'network')
      throw new TranslateError('claude', 'other', (e as Error).message)
    }
  }
}

// ---------- Chrome built-in AI (on-device, free, no key) ----------
interface LMSession {
  prompt(input: string, opts?: { signal?: AbortSignal }): Promise<string>
  clone(): Promise<LMSession>
  destroy(): void
}
interface LMFactory {
  availability(opts?: object): Promise<string>
  create(opts?: object): Promise<LMSession>
}
export type ChromeAIState = 'unsupported' | 'unavailable' | 'downloadable' | 'downloading' | 'available'

const languageModel = () => (globalThis as { LanguageModel?: LMFactory }).LanguageModel
const base2 = (code: string) => code.split('-')[0]
const lmOptions = (sl: string, tl: string) => ({
  expectedInputs: [{ type: 'text', languages: [base2(sl)] }],
  expectedOutputs: [{ type: 'text', languages: [base2(tl)] }],
})

export async function chromeAIStatus(sl: string, tl: string): Promise<ChromeAIState> {
  const lm = languageModel()
  if (!lm) return 'unsupported'
  try {
    return (await lm.availability(lmOptions(sl, tl))) as ChromeAIState
  } catch {
    return 'unavailable'
  }
}

let session: { key: string; s: LMSession } | undefined
let preparing: { key: string; done: Promise<void> } | undefined

/** Creates (and, on first use, downloads) the on-device model. Must run from a user gesture. Calls for the same pair share one run. */
export function chromeAIPrepare(sl: string, tl: string, from: string, to: string, onProgress?: (fraction: number) => void): Promise<void> {
  const key = `${sl}>${tl}`
  if (preparing?.key === key) return preparing.done
  const done: Promise<void> = createSession(key, sl, tl, from, to, onProgress).finally(() => {
    if (preparing?.done === done) preparing = undefined
  })
  preparing = { key, done }
  return done
}

async function createSession(key: string, sl: string, tl: string, from: string, to: string, onProgress?: (fraction: number) => void) {
  if (session?.key === key) return
  const lm = languageModel()
  if (!lm) throw new TranslateError('chrome', 'unsupported')
  let s: LMSession
  try {
    s = await lm.create({
      ...lmOptions(sl, tl),
      initialPrompts: [{ role: 'system', content: systemPrompt(from, to) }],
      monitor(m: EventTarget) {
        m.addEventListener('downloadprogress', e => onProgress?.((e as ProgressEvent).loaded))
      },
    })
  } catch (e) {
    throw new TranslateError('chrome', 'unsupported', (e as Error).message)
  }
  if (preparing?.key !== key) return s.destroy() // another language pair was requested meanwhile
  const old = session
  session = { key, s }
  try {
    old?.s.destroy()
  } catch {
    // already gone
  }
}

export function chromeAIRefiner(sl: string, tl: string) {
  return async (text: string, history: Turn[]): Promise<string | null> => {
    if (session?.key !== `${sl}>${tl}`) return null
    const s = await session.s.clone() // fresh context each line; the prompt carries the history
    try {
      return (await s.prompt(userPrompt(text, history))).trim() || null
    } catch (e) {
      throw new TranslateError('chrome', 'other', (e as Error).message)
    } finally {
      s.destroy()
    }
  }
}
