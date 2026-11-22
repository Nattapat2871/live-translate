// Live Translate — audio capture + continuous speech recognition
// Author / ผู้สร้าง: nattapat2871 (https://nattapat2871.me)
import { useEffect, useRef, useState } from 'react'
import { cleanVoice, type CleanVoice, type VoiceOptions } from './voice'

export type Source = 'system' | 'mic'
export type SpeechError = 'cancelled' | 'noAudio' | 'notAllowed' | 'network' | 'language' | 'browser' | 'filter'

export interface StartOptions {
  voice?: VoiceOptions // clean the audio before recognition (game noise)
  deviceId?: string // mic source: a specific input, e.g. a virtual cable carrying only Discord
}

export interface SpeechHandlers {
  onInterim(text: string): void
  onFinal(text: string): void
  /** A recognition session ended; commit whatever is still live. */
  onFlush(): void
  onError(error: SpeechError): void
  /** The user stopped sharing from the browser's own bar. */
  onEnded(): void
}

interface RecognitionResult {
  isFinal: boolean
  0: { transcript: string }
}
interface RecognitionEvent {
  resultIndex: number
  results: ArrayLike<RecognitionResult>
}
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(track?: MediaStreamTrack): void
  stop(): void
  abort(): void
}
export type RecognitionCtor = new () => Recognition

/** Read at call time, so tests can install a fake recognizer after load. */
export const Recognizer = (): RecognitionCtor | undefined =>
  (globalThis as { SpeechRecognition?: RecognitionCtor }).SpeechRecognition ??
  (globalThis as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition

const MAX_NETWORK_RETRIES = 6
const QUICK_END_MS = 1000 // a session shorter than this did not really run (aborted, busy mic, ...)
const MAX_QUICK_ENDS = 8 // that many in a row: give up instead of spinning

/** Owns one capture and restarts recognition sessions back to back so speech is not lost between them. */
export class SpeechController {
  lang = 'en-US'
  onState: (listening: boolean, stream: MediaStream | null) => void = () => {}
  private h: SpeechHandlers
  private ctorOverride: RecognitionCtor | undefined
  private rec: Recognition | undefined
  private stream: MediaStream | undefined
  private track: MediaStreamTrack | undefined // what recognition listens to
  private rawTrack: MediaStreamTrack | undefined // the capture itself
  private clean: CleanVoice | undefined
  private source: Source = 'system'
  private active = false
  private netFails = 0
  private quickEnds = 0
  private sessionStart = 0
  private starting = false
  private gen = 0 // bumped by stop(), so a start() still waiting for capture knows it was cancelled
  private retryTimer: ReturnType<typeof setTimeout> | undefined

  constructor(handlers: SpeechHandlers, ctor?: RecognitionCtor) {
    this.h = handlers
    this.ctorOverride = ctor
  }

  private get ctor() {
    return this.ctorOverride ?? Recognizer()
  }

  setHandlers(h: SpeechHandlers) {
    this.h = h
  }

  async start(source: Source, opts: StartOptions = {}) {
    if (this.starting || this.active) return
    if (!this.ctor || !navigator.mediaDevices) return this.h.onError('browser')
    this.starting = true
    const gen = this.gen
    let stream: MediaStream
    try {
      stream =
        source === 'system'
          ? await navigator.mediaDevices.getDisplayMedia({
              video: true, // Chrome offers system/tab audio only as part of a screen share
              audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
              systemAudio: 'include',
              selfBrowserSurface: 'exclude',
            } as DisplayMediaStreamOptions)
          : await navigator.mediaDevices.getUserMedia({
              audio: {
                ...(opts.deviceId ? { deviceId: { exact: opts.deviceId } } : {}),
                echoCancellation: !opts.deviceId, // a chosen input is usually a cable carrying a voice chat, not a room mic
                noiseSuppression: true, // Chrome's built-in suppressor (mic only)
                autoGainControl: true,
              },
            })
    } catch (e) {
      if (gen !== this.gen) return // stopped meanwhile
      this.starting = false
      const name = (e as DOMException).name
      return this.h.onError(name === 'NotAllowedError' ? (source === 'system' ? 'cancelled' : 'notAllowed') : 'browser')
    }
    if (gen !== this.gen) return stream.getTracks().forEach(t => t.stop()) // stopped while the picker was open
    stream.getVideoTracks().forEach(t => t.stop()) // only the audio is used
    const track = stream.getAudioTracks()[0]
    if (!track) {
      this.starting = false
      stream.getTracks().forEach(t => t.stop())
      return this.h.onError('noAudio')
    }
    let clean: CleanVoice | undefined
    if (opts.voice && (opts.voice.filter || opts.voice.ai)) {
      try {
        clean = await cleanVoice(track, opts.voice)
      } catch {
        this.h.onError('filter') // keep going with the raw audio
      }
      if (gen !== this.gen) {
        clean?.close()
        return stream.getTracks().forEach(t => t.stop())
      }
    }
    this.starting = false
    track.onended = () => {
      if (!this.active) return
      this.stop()
      this.h.onEnded()
    }
    this.stream = stream
    this.rawTrack = track
    this.clean = clean
    this.track = clean?.track ?? track
    this.source = source
    this.active = true
    this.netFails = this.quickEnds = 0
    this.onState(true, clean?.stream ?? stream) // the meter shows what recognition hears
    this.listen()
  }

  stop() {
    const wasActive = this.active
    this.active = this.starting = false
    this.gen++
    clearTimeout(this.retryTimer)
    const rec = this.rec
    this.rec = undefined
    rec?.abort()
    this.clean?.close()
    this.stream?.getTracks().forEach(t => t.stop())
    this.stream = this.track = this.rawTrack = this.clean = undefined
    if (wasActive) {
      this.h.onFlush()
      this.onState(false, null)
    }
  }

  /** Falls back to the unprocessed capture; onend (or the next listen) picks it up. */
  private dropFilter() {
    this.clean?.close()
    this.clean = undefined
    this.track = this.rawTrack
    this.h.onError('filter')
    if (this.stream) this.onState(true, this.stream)
    if (this.rec) this.rec.stop()
    else this.listen()
  }

  /** Restart the session so a new language takes effect. */
  restart() {
    this.rec?.stop() // onend starts the next session with the current language
  }

  private listen() {
    if (!this.active || !this.ctor) return
    const rec = new this.ctor()
    this.rec = rec
    this.sessionStart = Date.now()
    rec.lang = this.lang
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = e => {
      this.netFails = 0
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) this.h.onFinal(r[0].transcript)
        else interim += r[0].transcript
      }
      if (interim.trim()) this.h.onInterim(interim)
    }
    rec.onerror = e => {
      if (e.error === 'no-speech' || e.error === 'aborted') return // normal pauses; onend restarts
      if (e.error === 'network' && ++this.netFails <= MAX_NETWORK_RETRIES) return // onend retries with backoff
      if (e.error === 'audio-capture' && this.clean) return this.dropFilter() // recognition refused the processed track
      const map: Record<string, SpeechError> = {
        'not-allowed': 'notAllowed',
        'service-not-allowed': 'notAllowed',
        'audio-capture': 'noAudio',
        'language-not-supported': 'language',
        network: 'network',
      }
      this.stop()
      this.h.onError(map[e.error] ?? 'browser')
    }
    rec.onend = () => {
      if (this.rec !== rec) return // replaced or stopped
      this.h.onFlush()
      if (!this.active) return
      this.quickEnds = Date.now() - this.sessionStart < QUICK_END_MS ? this.quickEnds + 1 : 0
      if (this.quickEnds >= MAX_QUICK_ENDS) {
        this.stop()
        return this.h.onError('browser')
      }
      // Chrome ends sessions after silence or ~1 minute: start the next one at once so no words fall in the gap.
      // Sessions that end right away back off instead of restarting in a hot loop.
      const delay = Math.max(this.netFails && Math.min(4000, 400 * this.netFails), this.quickEnds && Math.min(4000, 250 * 2 ** (this.quickEnds - 1)))
      if (delay) this.retryTimer = setTimeout(() => this.listen(), delay)
      else this.listen()
    }
    try {
      rec.start(this.track) // Chrome accepts a MediaStreamTrack, so PC audio works like the mic
    } catch {
      if (this.clean) {
        this.rec = undefined // never started, so it will not end
        return this.dropFilter()
      }
      if (this.source !== 'mic') {
        this.stop()
        return this.h.onError('browser')
      }
      rec.start() // older Chrome: default microphone
    }
  }
}

export function useSpeech(lang: string, handlers: SpeechHandlers) {
  const [state, setState] = useState<{ listening: boolean; stream: MediaStream | null }>({ listening: false, stream: null })
  const [ctl] = useState(() => new SpeechController(handlers))
  ctl.setHandlers(handlers)
  ctl.onState = (listening, stream) => setState({ listening, stream })

  const first = useRef(true)
  useEffect(() => {
    ctl.lang = lang
    if (first.current) first.current = false
    else ctl.restart()
  }, [ctl, lang])

  useEffect(() => () => ctl.stop(), [ctl])

  return { ...state, start: (s: Source, opts?: StartOptions) => ctl.start(s, opts), stop: () => ctl.stop() }
}
