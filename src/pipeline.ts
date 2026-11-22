// Live Translate — speech-to-subtitle pipeline (pure, no DOM)
// Author / ผู้สร้าง: nattapat2871 (https://nattapat2871.me)
//
// Why this exists: the recognizer only finalizes after a pause, and friends who talk
// nonstop (or several at once) produce one ever-growing interim line. This module
//  - throttles live translation (never starves the way a reset-on-every-word debounce does),
//  - force-commits long or old interim text into board rows,
//  - bounds concurrent requests and drops stale AI refinements so the board never falls behind.

export type RowStatus = 'pending' | 'done' | 'refining' | 'refined' | 'error'

export interface Row {
  id: number
  time: string
  src: string
  dst: string
  status: RowStatus
}

export interface Live {
  src: string
  dst: string
}

export interface Turn {
  src: string
  dst: string
}

export interface PipelineDeps {
  /** Fast first-pass translation. `prev` is the previous row's source text, for context.
   *  Null rejects the text (not a language the visitor listens to): its row is dropped and its live preview hidden. */
  quick(text: string, prev: string | undefined, signal: AbortSignal): Promise<string | null>
  /** Optional context-aware refinement. Returns null to keep the quick translation. */
  refine?: ((text: string, history: Turn[]) => Promise<string | null>) | null
  onChange(rows: Row[], live: Live): void
  onError?(error: unknown): void
  now?: () => number
  clock?: () => string
}

export const LIMITS = {
  commitWords: 14, // commit a live segment once it reaches this many words…
  commitChars: 40, // …or characters, for languages written without spaces
  commitAgeMs: 4000, // …or once it has been growing this long
  keepWords: 2, // the newest words are still being revised by the recognizer, keep them live
  keepChars: 6,
  throttleMs: 400,
  quickConcurrency: 3,
  refineConcurrency: 2,
  refineBacklog: 3, // pending refinements beyond this are dropped, oldest first
  retryDelaysMs: [800, 2000, 4000], // a committed row is retried this many times on rate limits, with these delays
  livePauseMs: 5000, // after a rate limit, live previews pause so committed rows get the quota
  quickTimeoutMs: 10_000, // a hung request must never hold a queue slot forever
  refineTimeoutMs: 10_000,
  maxRows: 200,
  history: 6,
}

const errorCode = (e: unknown) => (e as { code?: string } | null)?.code

/** Rejects with `{ code: 'timeout' }` after `ms`; `onTimeout` can abort the underlying request. */
function withTimeout<T>(p: Promise<T>, ms: number, onTimeout?: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      onTimeout?.()
      reject(Object.assign(new Error('timeout'), { code: 'timeout' }))
    }, ms)
  })
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer))
}

export class Pipeline {
  rows: Row[] = []
  live: Live = { src: '', dst: '' }

  private deps: PipelineDeps
  private now: () => number
  private clock: () => string
  private nextId = 1
  private byChars = false
  private committed = 0 // tokens of the current utterance already turned into rows
  private committedText = '' // the same, as text, to realign when the final rewrites earlier words
  private tailSince = 0
  private liveTimer: ReturnType<typeof setTimeout> | undefined
  private lastLiveAt = -Infinity
  private livePausedUntil = 0
  private liveCtl: AbortController | undefined
  private liveBusy = false // a live translation is in flight
  private liveDirty = false // the live text changed while it was in flight
  private quickQueue: Row[] = []
  private quickInFlight = 0
  private refineQueue: Row[] = []
  private refineInFlight = 0
  private retries = new Map<number, number>() // row id -> rate-limit retries so far
  private retryTimers = new Set<ReturnType<typeof setTimeout>>()
  private snapshots = new WeakMap<Row, Row>() // unchanged rows keep their emitted object, so memoized views skip them

  constructor(deps: PipelineDeps) {
    this.deps = deps
    this.now = deps.now ?? (() => Date.now())
    this.clock = deps.clock ?? (() => new Date().toLocaleTimeString('en-GB'))
  }

  /** Languages without spaces between words (th, ja, zh, lo, my, km) are segmented by character. */
  setSegmentByChars(byChars: boolean) {
    this.byChars = byChars
  }

  setRefine(refine: PipelineDeps['refine']) {
    this.deps.refine = refine
    if (!refine) for (const r of this.refineQueue.splice(0)) r.status = 'done'
  }

  /** Full interim text of the utterance currently being recognized. */
  interim(text: string) {
    const toks = this.tokens(text)
    // In noise the recognizer sometimes drops what it heard and starts over with different, shorter words.
    // Never let words vanish: the abandoned live text becomes its own row first.
    const shown = this.tokens(this.live.src)
    const fresh = toks.slice(Math.min(this.committed, toks.length))
    const head = (t: string[]) => this.join(t.slice(0, this.byChars ? 2 : 1))
    const before = this.join([...this.tokens(this.committedText), ...shown]) // everything heard so far in this utterance
    const trimmed = before.startsWith(this.join(toks)) // a brief shorter revision of the same words, not a new guess
    if (shown.length && fresh.length < shown.length && head(fresh) !== head(shown) && !trimmed) {
      this.cancelLive()
      this.addRow(this.join(shown))
      this.live = { src: '', dst: '' }
      this.tailSince = 0
    }
    this.committed = Math.min(this.committed, toks.length) // recognizer revised the text shorter
    let tail = toks.slice(this.committed)
    const now = this.now()
    if (!this.tailSince) this.tailSince = now

    const max = this.byChars ? LIMITS.commitChars : LIMITS.commitWords
    const keep = this.byChars ? LIMITS.keepChars : LIMITS.keepWords
    const old = now - this.tailSince >= LIMITS.commitAgeMs && tail.length > keep * 2
    if (tail.length >= max || old) {
      const n = tail.length - keep
      const chunk = this.join(tail.slice(0, n))
      this.cancelLive() // its text was just committed; the row gets its own translation
      this.live = { ...this.live, dst: '' } // the old preview covered the committed text too
      this.addRow(chunk)
      this.committed += n
      this.committedText = this.committedText && !this.byChars ? `${this.committedText} ${chunk}` : this.committedText + chunk
      tail = tail.slice(n)
      this.tailSince = now
    }
    this.setLive(this.join(tail))
  }

  /** Final text of the utterance. Only the part not already committed becomes a row. */
  final(text: string) {
    const toks = this.tokens(text)
    const all = this.join(toks)
    const done = this.committedText
    // The recognizer may rewrite earlier words in the final: align by text while it still matches, else by count.
    const aligned = done && all.startsWith(done) && (this.byChars || all.length === done.length || all[done.length] === ' ')
    this.addRow(aligned ? all.slice(done.length).trim() : this.join(toks.slice(this.committed)))
    this.endUtterance()
  }

  /** Recognition session ended without a final result: keep whatever was live. */
  flush() {
    if (this.live.src) this.addRow(this.live.src)
    this.endUtterance()
  }

  clear() {
    this.rows = []
    this.quickQueue = []
    this.refineQueue = []
    this.clearRetries()
    this.endUtterance()
    this.emit()
  }

  dispose() {
    clearTimeout(this.liveTimer)
    this.liveTimer = undefined
    this.liveCtl?.abort()
    this.clearRetries()
  }

  // ---------- internals ----------

  private tokens(text: string) {
    const t = text.trim()
    if (!t) return []
    return this.byChars ? Array.from(t) : t.split(/\s+/)
  }

  private join(tokens: string[]) {
    return tokens.join(this.byChars ? '' : ' ').trim()
  }

  private clearRetries() {
    for (const t of this.retryTimers) clearTimeout(t)
    this.retryTimers.clear()
    this.retries.clear()
  }

  private endUtterance() {
    this.committed = 0
    this.committedText = ''
    this.tailSince = 0
    this.setLive('')
  }

  private emit() {
    // Everything heard shows at once; the language gate only removes a row after it is rejected.
    const rows = this.rows.map(r => {
      const s = this.snapshots.get(r)
      if (s && s.src === r.src && s.dst === r.dst && s.status === r.status) return s
      const copy = { ...r }
      this.snapshots.set(r, copy)
      return copy
    })
    this.deps.onChange(rows, { ...this.live })
  }

  /** Rate limited: committed rows keep the quota, live previews wait. */
  private pauseLive() {
    this.livePausedUntil = this.now() + LIMITS.livePauseMs
  }

  private setLive(text: string) {
    if (text === this.live.src) return
    this.live = { src: text, dst: text ? this.live.dst : '' }
    if (!text) this.cancelLive()
    else {
      this.scheduleLive()
    }
    this.emit()
  }

  private cancelLive() {
    clearTimeout(this.liveTimer)
    this.liveTimer = undefined
    this.liveCtl?.abort()
    this.liveCtl = undefined
    this.liveBusy = this.liveDirty = false
  }

  // Throttled single-flight: at most one live request at a time, at most one every throttleMs,
  // always for the newest text. Never abort an in-flight request for a newer one: when the
  // translator is slower than the speaker, that would starve the preview completely.
  private scheduleLive() {
    if (this.liveBusy) {
      this.liveDirty = true
      return
    }
    if (this.liveTimer) return // trailing run already scheduled; it reads the newest text
    const wait = Math.max(this.lastLiveAt + LIMITS.throttleMs, this.livePausedUntil) - this.now()
    if (wait <= 0) this.runLive()
    else
      this.liveTimer = setTimeout(() => {
        this.liveTimer = undefined
        this.runLive()
      }, wait)
  }

  private runLive() {
    const text = this.live.src
    if (!text) return
    if (this.now() < this.livePausedUntil) return this.scheduleLive() // a trailing run queued before a pause began
    this.lastLiveAt = this.now()
    this.liveBusy = true
    this.liveDirty = false
    const ctl = (this.liveCtl = new AbortController())
    withTimeout(this.deps.quick(text, this.rows.at(-1)?.src, ctl.signal), LIMITS.quickTimeoutMs, () => ctl.abort())
      .then(
        dst => {
          if (ctl !== this.liveCtl || !this.live.src) return // cancelled by a commit or the end of speech
          this.live = { ...this.live, dst: dst ?? '' }
          this.emit()
        },
        e => {
          // Live text is a preview; the committed row reports real failures.
          if (errorCode(e) !== 'rate') return
          this.pauseLive()
          if (ctl === this.liveCtl) this.liveDirty = true // translate this text again once the pause ends
        },
      )
      .finally(() => {
        if (ctl !== this.liveCtl) return
        this.liveBusy = false
        if (this.liveDirty) this.scheduleLive()
      })
  }

  private addRow(src: string) {
    if (!src) return
    const row: Row = { id: this.nextId++, time: this.clock(), src, dst: '', status: 'pending' }
    this.rows.push(row)
    if (this.rows.length > LIMITS.maxRows) this.rows.shift()
    this.quickQueue.push(row)
    this.pumpQuick()
    this.emit()
  }

  private pumpQuick() {
    while (this.quickInFlight < LIMITS.quickConcurrency && this.quickQueue.length) {
      const row = this.quickQueue.shift()!
      const prev = this.rows[this.rows.indexOf(row) - 1]?.src
      const ctl = new AbortController()
      this.quickInFlight++
      withTimeout(this.deps.quick(row.src, prev, ctl.signal), LIMITS.quickTimeoutMs, () => ctl.abort())
        .then(dst => {
          this.retries.delete(row.id)
          if (dst === null) {
            const i = this.rows.indexOf(row)
            if (i >= 0) this.rows.splice(i, 1) // rejected: never shown or refined, and no longer context for later rows
            return
          }
          row.dst = dst
          row.status = this.deps.refine ? 'refining' : 'done'
          if (this.deps.refine) this.enqueueRefine(row)
        })
        .catch(e => {
          const n = this.retries.get(row.id) ?? 0
          if (errorCode(e) === 'rate' && n < LIMITS.retryDelaysMs.length) {
            this.retries.set(row.id, n + 1)
            this.pauseLive()
            const timer = setTimeout(() => {
              this.retryTimers.delete(timer)
              this.quickQueue.unshift(row)
              this.pumpQuick()
            }, LIMITS.retryDelaysMs[n])
            this.retryTimers.add(timer)
            return
          }
          this.retries.delete(row.id)
          row.status = 'error'
          this.deps.onError?.(e)
        })
        .finally(() => {
          this.quickInFlight--
          this.pumpQuick()
          this.emit()
        })
    }
  }

  private enqueueRefine(row: Row) {
    this.refineQueue.push(row)
    // Realtime beats completeness: when AI falls behind, older lines keep their quick translation.
    while (this.refineQueue.length > LIMITS.refineBacklog) this.refineQueue.shift()!.status = 'done'
    this.pumpRefine()
  }

  private pumpRefine() {
    const refine = this.deps.refine
    while (refine && this.refineInFlight < LIMITS.refineConcurrency && this.refineQueue.length) {
      const row = this.refineQueue.shift()!
      const i = this.rows.indexOf(row)
      const history = this.rows
        .slice(Math.max(0, i - LIMITS.history), Math.max(0, i))
        .filter(r => r.dst)
        .map(r => ({ src: r.src, dst: r.dst }))
      this.refineInFlight++
      // On timeout the row keeps its quick translation.
      withTimeout(refine(row.src, history), LIMITS.refineTimeoutMs)
        .then(dst => {
          if (dst) {
            row.dst = dst
            row.status = 'refined'
          } else row.status = 'done'
        })
        .catch(e => {
          row.status = 'done'
          this.deps.onError?.(e)
        })
        .finally(() => {
          this.refineInFlight--
          this.pumpRefine()
          this.emit()
        })
    }
  }
}
