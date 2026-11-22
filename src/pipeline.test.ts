// Stress tests for the subtitle pipeline: fast talkers, nonstop speech, overlapping voices,
// rate limits, slow AI, out-of-order responses, hung requests; plus the speech session restarter.
// Author / ผู้สร้าง: nattapat2871 (https://nattapat2871.me)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LIMITS, Pipeline, type Live, type Row } from './pipeline'
import { SpeechController, type RecognitionCtor, type SpeechHandlers } from './useSpeech'

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    })
  })

function setup(opts: { quickMs?: number | ((text: string) => number); refineMs?: number; refine?: boolean; failFirst?: 'rate'; reject?: (text: string) => boolean } = {}) {
  let rows: Row[] = []
  let live: Live = { src: '', dst: '' }
  const quickCalls: string[] = []
  const refineCalls: string[] = []
  let failed = false
  const p = new Pipeline({
    now: () => Date.now(),
    clock: () => 'T',
    async quick(text, _prev, signal) {
      quickCalls.push(text)
      const ms = typeof opts.quickMs === 'function' ? opts.quickMs(text) : (opts.quickMs ?? 100)
      await sleep(ms, signal)
      if (opts.failFirst && !failed) {
        failed = true
        throw Object.assign(new Error('rate'), { code: opts.failFirst })
      }
      return opts.reject?.(text) ? null : `<${text}>`
    },
    refine: opts.refine
      ? async text => {
          refineCalls.push(text)
          await sleep(opts.refineMs ?? 300)
          return `[${text}]`
        }
      : null,
    onChange(r, l) {
      rows = r
      live = l
    },
  })
  return { p, get rows() { return rows }, get live() { return live }, quickCalls, refineCalls }
}

const words = (n: number, from = 0) => Array.from({ length: n }, (_, i) => `w${i + from}`).join(' ')

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('nonstop fast speech (no final for 20 s)', () => {
  it('keeps live translation flowing and commits rows instead of waiting for a pause', async () => {
    const s = setup({ quickMs: 150 })
    // A new word every 120 ms for 20 s ≈ 8 words/s, faster than normal speech.
    let n = 0
    for (let t = 0; t < 20_000; t += 120) {
      s.p.interim(words(++n))
      await vi.advanceTimersByTimeAsync(120)
    }
    await vi.advanceTimersByTimeAsync(1000)

    const committed = s.rows.map(r => r.src).join(' ').split(' ')
    expect(s.rows.length).toBeGreaterThanOrEqual(Math.floor(n / LIMITS.commitWords) - 1)
    expect(committed.length + s.live.src.split(' ').length).toBe(n) // nothing lost or duplicated
    expect(committed[0]).toBe('w0')
    expect(s.rows.every(r => r.status === 'done' && r.dst === `<${r.src}>`)).toBe(true)
    // Live preview translated about every throttle window (old debounce = 0 calls here).
    const liveCalls = s.quickCalls.length - s.rows.length
    expect(liveCalls).toBeGreaterThan(20_000 / LIMITS.throttleMs / 2)
    expect(liveCalls).toBeLessThanOrEqual(20_000 / LIMITS.throttleMs + 2)
    expect(s.live.dst).not.toBe('')
  })

  it('keeps the live preview moving when the translator is slower than the throttle', async () => {
    // Real Google often takes 500-900 ms. Aborting the in-flight request for every newer one
    // (the bug found in the browser test) left the preview stuck on the first word.
    const s = setup({ quickMs: 700 })
    const seen = new Set<string>()
    let n = 0
    for (let t = 0; t < 10_000; t += 100) {
      s.p.interim(words(++n))
      await vi.advanceTimersByTimeAsync(100)
      if (s.live.dst) seen.add(s.live.dst)
    }
    expect(seen.size).toBeGreaterThanOrEqual(8) // a fresh preview roughly every 0.7-1.1 s
    // Previews never show text that was already committed to a row.
    const committed = new Set(s.rows.flatMap(r => r.src.split(' ')))
    expect(s.live.src.split(' ').some(w => committed.has(w))).toBe(false)
  })

  it('commits by age even when the talker is slow but never pauses', async () => {
    const s = setup()
    let n = 0
    for (let t = 0; t < 9000; t += 700) {
      s.p.interim(words(++n))
      await vi.advanceTimersByTimeAsync(700)
    }
    expect(s.rows.length).toBeGreaterThanOrEqual(1)
  })

  it('commits Thai (no spaces) by characters', async () => {
    const s = setup()
    s.p.setSegmentByChars(true)
    const thai = 'ระวังมีสไนเปอร์อยู่บนหลังคาตึกฝั่งซ้ายนะเพื่อนรีบหลบเร็ว'
    s.p.interim(thai)
    await vi.advanceTimersByTimeAsync(500)
    expect(s.rows).toHaveLength(1)
    expect(s.rows[0].src + s.live.src).toBe(thai)
    s.p.final(thai + 'เลย')
    expect(s.rows.map(r => r.src).join('')).toBe(thai + 'เลย')
  })
})

describe('final after forced commits', () => {
  it('adds only the uncommitted remainder', async () => {
    const s = setup()
    s.p.interim(words(20))
    s.p.final(words(23))
    await vi.advanceTimersByTimeAsync(500)
    expect(s.rows.map(r => r.src).join(' ')).toBe(words(23))
    expect(s.live.src).toBe('')
  })

  it('survives the recognizer revising text shorter', () => {
    const s = setup()
    s.p.interim(words(16))
    s.p.interim(words(5)) // revision
    s.p.final(words(6))
    expect(s.rows.length).toBeGreaterThanOrEqual(1) // no crash, no negative slice
  })

  it('flush keeps live text when a session ends without a final', () => {
    const s = setup()
    s.p.interim('half a sentence')
    s.p.flush()
    expect(s.rows.at(-1)?.src).toBe('half a sentence')
    expect(s.live.src).toBe('')
  })
})

describe('bursts of short finals (several people talking)', () => {
  it('keeps order and translates everything despite slow, out-of-order responses', async () => {
    // Shorter lines come back faster, so responses arrive out of order.
    const s = setup({ quickMs: t => 1200 - t.length * 20 })
    const lines = Array.from({ length: 40 }, (_, i) => `${i % 2 ? 'A' : 'B'} says line ${i} ${'x'.repeat(i % 7)}`.trim())
    for (const l of lines) {
      s.p.final(l)
      await vi.advanceTimersByTimeAsync(300) // a new line every 300 ms
    }
    await vi.advanceTimersByTimeAsync(20_000)
    expect(s.rows.map(r => r.src)).toEqual(lines)
    expect(s.rows.every(r => r.dst === `<${r.src}>`)).toBe(true)
  })

  it('never runs more quick requests at once than the limit', async () => {
    let inFlight = 0
    let peak = 0
    const p = new Pipeline({
      clock: () => 'T',
      async quick(text) {
        peak = Math.max(peak, ++inFlight)
        await sleep(500)
        inFlight--
        return text
      },
      onChange() {},
    })
    for (let i = 0; i < 30; i++) p.final(`line ${i}`)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(peak).toBe(LIMITS.quickConcurrency)
  })
})

describe('failures', () => {
  it('retries once on rate limit, then succeeds', async () => {
    const s = setup({ failFirst: 'rate' })
    s.p.final('hello')
    await vi.advanceTimersByTimeAsync(LIMITS.retryDelaysMs[0] + 500)
    expect(s.rows[0]).toMatchObject({ dst: '<hello>', status: 'done' })
  })

  it('marks a row as error and reports it on other failures', async () => {
    const errors: unknown[] = []
    let rows: Row[] = []
    const p = new Pipeline({
      clock: () => 'T',
      quick: async () => {
        throw Object.assign(new Error('net'), { code: 'network' })
      },
      onChange: r => (rows = r),
      onError: e => errors.push(e),
    })
    p.final('hello')
    await vi.advanceTimersByTimeAsync(10)
    expect(rows[0].status).toBe('error')
    expect(errors).toHaveLength(1)
  })
})

describe('AI refinement under load', () => {
  it('drops stale refinements so the newest lines still get AI quickly', async () => {
    const s = setup({ quickMs: 50, refine: true, refineMs: 3000 })
    for (let i = 0; i < 20; i++) {
      s.p.final(`line ${i}`)
      await vi.advanceTimersByTimeAsync(200)
    }
    await vi.advanceTimersByTimeAsync(30_000)
    expect(s.refineCalls.length).toBeLessThan(20) // backlog was trimmed
    expect(s.rows.at(-1)).toMatchObject({ status: 'refined', dst: '[line 19]' })
    expect(s.rows.every(r => r.status === 'done' || r.status === 'refined')).toBe(true)
    expect(s.rows.every(r => r.dst)).toBe(true) // dropped rows keep their quick translation
  })

  it('turning AI off releases queued rows', async () => {
    const s = setup({ quickMs: 10, refine: true, refineMs: 5000 })
    for (let i = 0; i < 6; i++) s.p.final(`l${i}`)
    await vi.advanceTimersByTimeAsync(100)
    s.p.setRefine(null)
    await vi.advanceTimersByTimeAsync(6000)
    expect(s.rows.some(r => r.status === 'refining')).toBe(false)
  })
})

describe('language gate', () => {
  const zh = (text: string) => text.startsWith('zh')

  it('drops a rejected final row and never refines it, while accepted rows flow', async () => {
    const s = setup({ refine: true, reject: zh })
    s.p.final('ja one')
    s.p.final('zh noise')
    s.p.final('ja two')
    expect(s.rows.map(r => r.src)).toEqual(['ja one', 'zh noise', 'ja two']) // everything heard shows at once
    await vi.advanceTimersByTimeAsync(5000)
    expect(s.rows.map(r => r.src)).toEqual(['ja one', 'ja two'])
    expect(s.rows.every(r => r.status === 'refined')).toBe(true)
    expect(s.refineCalls).toEqual(['ja one', 'ja two'])
  })

  it('shows live text at once, before the language check answers', async () => {
    const s = setup({ quickMs: 100, reject: zh })
    s.p.interim('ja hi')
    expect(s.live.src).toBe('ja hi')
    await vi.advanceTimersByTimeAsync(500)
    expect(s.live).toEqual({ src: 'ja hi', dst: '<ja hi>' })
  })

  it('takes context only from rows still on the board', async () => {
    const prevs: (string | undefined)[] = []
    let rows: Row[] = []
    const p = new Pipeline({
      clock: () => 'T',
      quick: async (text, prev) => {
        prevs.push(prev)
        return text.startsWith('zh') ? null : text
      },
      onChange: r => (rows = r),
    })
    p.final('ja one')
    await vi.advanceTimersByTimeAsync(10)
    p.final('zh noise')
    await vi.advanceTimersByTimeAsync(10)
    p.final('ja two')
    await vi.advanceTimersByTimeAsync(10)
    expect(rows.map(r => r.src)).toEqual(['ja one', 'ja two'])
    expect(prevs).toEqual([undefined, 'ja one', 'ja one'])
  })
})

describe('memory over a long session', () => {
  it('keeps at most maxRows rows', async () => {
    const s = setup({ quickMs: 1 })
    for (let i = 0; i < LIMITS.maxRows + 50; i++) s.p.final(`l${i}`)
    await vi.advanceTimersByTimeAsync(5000)
    expect(s.rows).toHaveLength(LIMITS.maxRows)
    expect(s.rows.at(-1)?.src).toBe(`l${LIMITS.maxRows + 49}`)
  })
})

describe('hung requests', () => {
  it('times out a hung quick request as an error and frees its slot', async () => {
    const errors: unknown[] = []
    let rows: Row[] = []
    const p = new Pipeline({
      clock: () => 'T',
      quick: text => (text.startsWith('hang') ? new Promise<string>(() => {}) : Promise.resolve(`<${text}>`)),
      onChange: r => (rows = r),
      onError: e => errors.push(e),
    })
    for (let i = 0; i < LIMITS.quickConcurrency; i++) p.final(`hang ${i}`)
    p.final('ok')
    await vi.advanceTimersByTimeAsync(LIMITS.quickTimeoutMs + 100)
    expect(rows.slice(0, -1).every(r => r.status === 'error')).toBe(true)
    expect(rows.at(-1)).toMatchObject({ dst: '<ok>', status: 'done' })
    expect(errors).toHaveLength(LIMITS.quickConcurrency)
  })

  it('times out a hung refinement, keeping the quick translation', async () => {
    let rows: Row[] = []
    const p = new Pipeline({
      clock: () => 'T',
      quick: async text => `<${text}>`,
      refine: text => (text.startsWith('hang') ? new Promise<string>(() => {}) : Promise.resolve(`[${text}]`)),
      onChange: r => (rows = r),
    })
    for (let i = 0; i < LIMITS.refineConcurrency; i++) p.final(`hang ${i}`)
    p.final('ok')
    await vi.advanceTimersByTimeAsync(LIMITS.refineTimeoutMs + 100)
    expect(rows.slice(0, -1).every(r => r.status === 'done' && r.dst === `<${r.src}>`)).toBe(true)
    expect(rows.at(-1)).toMatchObject({ dst: '[ok]', status: 'refined' })
  })
})

describe('rate limits', () => {
  it('pauses live previews after a live 429 while committed rows still translate', async () => {
    const s = setup({ failFirst: 'rate' }) // the first call is the live preview
    for (let i = 0; i < 24; i++) {
      if (i === 5) s.p.final('row line')
      else s.p.interim(words(2 + (i % 3))) // short and varying: no forced commits
      await vi.advanceTimersByTimeAsync(200)
    }
    expect(s.quickCalls).toEqual(['w0 w1', 'row line']) // no previews during the pause
    expect(s.rows[0]).toMatchObject({ dst: '<row line>', status: 'done' })
    await vi.advanceTimersByTimeAsync(1000)
    expect(s.quickCalls.length).toBeGreaterThan(2) // previews resume
    expect(s.live.dst).toBe(`<${s.live.src}>`)
  })

  it('retries a committed row up to 3 times with growing delays, then gives up', async () => {
    let calls = 0
    let rows: Row[] = []
    const errors: unknown[] = []
    const p = new Pipeline({
      clock: () => 'T',
      quick: async () => {
        calls++
        throw Object.assign(new Error('rate'), { code: 'rate' })
      },
      onChange: r => (rows = r),
      onError: e => errors.push(e),
    })
    p.final('hello')
    await vi.advanceTimersByTimeAsync(LIMITS.retryDelaysMs[0] + LIMITS.retryDelaysMs[1] + 100)
    expect(calls).toBe(3)
    expect(rows[0].status).toBe('pending')
    await vi.advanceTimersByTimeAsync(LIMITS.retryDelaysMs[2])
    expect(calls).toBe(4)
    expect(rows[0].status).toBe('error')
    expect(errors).toHaveLength(1)
  })

  it('clear() cancels a pending retry', async () => {
    const s = setup({ failFirst: 'rate' })
    s.p.final('hello')
    await vi.advanceTimersByTimeAsync(150) // failed, retry scheduled
    s.p.clear()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(s.quickCalls).toEqual(['hello'])
    expect(s.rows).toEqual([])
  })
})

describe('live preview after a forced commit', () => {
  it('drops the old preview instead of showing committed text twice', async () => {
    const s = setup()
    s.p.interim(words(3))
    await vi.advanceTimersByTimeAsync(200)
    expect(s.live.dst).toBe(`<${words(3)}>`)
    s.p.interim(words(20))
    expect(s.live).toEqual({ src: 'w18 w19', dst: '' })
    await vi.advanceTimersByTimeAsync(1000)
    expect(s.live.dst).toBe('<w18 w19>')
  })

  it('aligns the final by text after the interim was revised shorter', () => {
    const s = setup()
    s.p.interim(words(16)) // commits w0..w13
    s.p.interim(words(5)) // recognizer briefly revised the text
    s.p.final(words(17))
    expect(s.rows.map(r => r.src).join(' ')).toBe(words(17)) // no duplicated w5..w13
  })

  it('re-emits unchanged rows as the same objects', async () => {
    const s = setup()
    s.p.final('a')
    await vi.advanceTimersByTimeAsync(200)
    const first = s.rows[0]
    s.p.final('b')
    expect(s.rows[0]).toBe(first)
    expect(s.rows[1]).toMatchObject({ src: 'b', status: 'pending' })
  })
})

describe('SpeechController', () => {
  class FakeRec {
    static all: FakeRec[] = []
    lang = ''
    continuous = false
    interimResults = false
    onresult: ((e: unknown) => void) | null = null
    onerror: ((e: { error: string }) => void) | null = null
    onend: (() => void) | null = null
    constructor() {
      FakeRec.all.push(this)
    }
    start() {}
    stop() {
      this.onend?.()
    }
    abort() {
      this.onend?.()
    }
  }
  const Rec = FakeRec as unknown as RecognitionCtor
  const track = () => ({ stop: vi.fn(), onended: null as (() => void) | null })
  const streamOf = (t: ReturnType<typeof track>) =>
    ({ getVideoTracks: () => [], getAudioTracks: () => [t], getTracks: () => [t] }) as unknown as MediaStream
  const media = (getUserMedia: () => Promise<MediaStream>) => vi.stubGlobal('navigator', { mediaDevices: { getUserMedia, getDisplayMedia: getUserMedia } })
  const handlers = () => ({ onInterim() {}, onFinal() {}, onFlush() {}, onError: vi.fn(), onEnded() {} }) satisfies SpeechHandlers

  beforeEach(() => {
    FakeRec.all = []
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /** Ends the newest session at once, then waits for the controller to start the next one. */
  const endNow = async () => {
    const n = FakeRec.all.length
    FakeRec.all[n - 1].onend!()
    for (let ms = 0; ms < 5000 && FakeRec.all.length === n; ms += 50) await vi.advanceTimersByTimeAsync(50)
  }

  it('backs off when sessions end immediately, then gives up', async () => {
    const t = track()
    media(async () => streamOf(t))
    const h = handlers()
    const c = new SpeechController(h, Rec)
    await c.start('mic')
    expect(FakeRec.all).toHaveLength(1)
    FakeRec.all[0].onend!()
    expect(FakeRec.all).toHaveLength(1) // no hot restart loop
    await vi.advanceTimersByTimeAsync(250)
    expect(FakeRec.all).toHaveLength(2)
    for (let i = 0; i < 7; i++) await endNow()
    expect(h.onError).toHaveBeenCalledWith('browser')
    expect(FakeRec.all).toHaveLength(8)
    expect(t.stop).toHaveBeenCalled()
  })

  it('restarts at once after a normal long session', async () => {
    media(async () => streamOf(track()))
    const c = new SpeechController(handlers(), Rec)
    await c.start('mic')
    await vi.advanceTimersByTimeAsync(30_000)
    FakeRec.all[0].onend!()
    expect(FakeRec.all).toHaveLength(2)
    c.stop()
  })

  it('ignores start() while already starting or active', async () => {
    let resolve!: (s: MediaStream) => void
    const gum = vi.fn(() => new Promise<MediaStream>(r => (resolve = r)))
    media(gum)
    const c = new SpeechController(handlers(), Rec)
    const a = c.start('mic')
    const b = c.start('mic')
    resolve(streamOf(track()))
    await Promise.all([a, b])
    await c.start('mic')
    expect(gum).toHaveBeenCalledTimes(1)
    expect(FakeRec.all).toHaveLength(1)
    c.stop()
  })

  it('stop() while capture is pending releases the tracks and never starts', async () => {
    let resolve!: (s: MediaStream) => void
    media(() => new Promise<MediaStream>(r => (resolve = r)))
    const c = new SpeechController(handlers(), Rec)
    const states: boolean[] = []
    c.onState = l => states.push(l)
    const t = track()
    const a = c.start('mic')
    c.stop()
    resolve(streamOf(t))
    await a
    expect(t.stop).toHaveBeenCalled()
    expect(FakeRec.all).toHaveLength(0)
    expect(states).toEqual([])
  })

  it('keeps listening on the raw audio when the noise filter cannot start', async () => {
    media(async () => streamOf(track())) // no AudioContext in this environment, so cleanVoice fails
    const h = handlers()
    const c = new SpeechController(h, Rec)
    await c.start('system', { voice: { filter: true, ai: false } })
    expect(h.onError).toHaveBeenCalledWith('filter')
    expect(FakeRec.all).toHaveLength(1)
    c.stop()
  })

  it('passes the chosen input device to getUserMedia', async () => {
    const gum = vi.fn(async (_c?: MediaStreamConstraints) => streamOf(track()))
    media(gum)
    const c = new SpeechController(handlers(), Rec)
    await c.start('mic', { deviceId: 'cable-1' })
    expect(gum.mock.calls[0][0]).toMatchObject({ audio: { deviceId: { exact: 'cable-1' }, echoCancellation: false } })
    c.stop()
  })
})
