// Live Translate — the arrivals board, audio meter and floating overlay window
// Author / ผู้สร้าง: nattapat2871 (https://nattapat2871.me)
import { Sparkles } from 'lucide-react'
import { memo, useEffect, useRef, useState } from 'react'
import type { Live, Row, RowStatus } from './pipeline'
import type { Strings } from './text'

interface BoardProps {
  rows: Row[]
  live: Live
  t: Strings
  route: string
  showSrc: boolean
  listening: boolean
  compact?: boolean
}

const GRID = 'grid grid-cols-[4.75rem_3.25rem_minmax(0,1fr)_8rem] items-baseline gap-x-5 max-md:grid-cols-[minmax(0,1fr)_auto]'
const SIGN = 'font-sign uppercase tracking-[0.08em] th:tracking-normal' // tracking breaks Thai mark stacking

const TONE: Record<RowStatus | 'listen', string> = {
  listen: 'text-sign blink',
  pending: 'text-ink-dim',
  done: 'text-ink-dim',
  refining: 'text-sign/75',
  refined: 'text-sign',
  error: 'text-[#ff8a80]',
}

function label(t: Strings, s: RowStatus | 'listen') {
  return { listen: t.stListen, pending: t.stPending, done: t.stDone, refining: t.stRefining, refined: t.stRefined, error: t.stError }[s]
}

// Memoized with primitive props: a new transcript line re-renders only the rows that changed.
const BoardRow = memo(function BoardRow(p: {
  time: string
  route: string
  dst: string
  src: string
  status: RowStatus | 'listen'
  big: boolean
  showSrc: boolean
  compact?: boolean
  t: Strings
}) {
  return (
    <li className={`flap-row flap-in ${GRID} ${p.big ? 'is-newest' : ''} ${p.compact ? 'px-4 py-2' : 'px-5 py-3'}`}>
      <span className={`${SIGN} flap-cell tabular justify-self-start text-[15px] text-ink-dim max-md:hidden`}>{p.time || '--:--'}</span>
      <span className={`${SIGN} flap-cell justify-self-start text-[15px] text-ink-dim max-md:hidden`}>{p.route}</span>
      <div className="min-w-0">
        {/* re-keyed when AI replaces the quick translation, so the text flips again */}
        <p
          key={p.status === 'refined' ? 'ai' : 'quick'}
          className={`${p.status === 'refined' ? 'flap-in' : ''} leading-[1.3] text-pretty break-words ${p.status === 'listen' ? 'text-ink-dim' : ''}`}
          style={{ fontSize: p.big ? 'var(--fs)' : 'calc(var(--fs) * 0.62)' }}
        >
          {p.dst || '…'}
        </p>
        {p.showSrc && p.src && <p className="mt-1 text-[15px] leading-snug text-ink-dim">{p.src}</p>}
      </div>
      <span className={`${SIGN} flap-cell flex items-center justify-self-end gap-1.5 text-[15px] ${TONE[p.status]}`}>
        {p.status === 'refined' && <Sparkles size={14} strokeWidth={2.25} aria-hidden />}
        {label(p.t, p.status)}
      </span>
    </li>
  )
})

export function Board({ rows, live, t, route, showSrc, listening, compact }: BoardProps) {
  const ordered = (compact ? rows.slice(-3) : rows).slice().reverse() // newest on top
  const empty = !rows.length && !live.src
  const steps = [t.step1, t.step2, t.step3]

  return (
    <section aria-label={t.boardTitle} className={compact ? 'flex h-full flex-col justify-start p-2' : ''}>
      {!compact && (
        <>
          <div className="flex items-baseline justify-between gap-4 border-b-2 border-sign px-5 pb-2">
            <h2 className="font-sign text-[28px] font-semibold uppercase tracking-[0.14em] text-sign">{t.boardTitle}</h2>
            <p className={`${SIGN} flex items-center gap-2 text-[15px] ${listening ? 'text-sign' : 'text-ink-dim'}`} role="status">
              <span aria-hidden className={`inline-block size-2 ${listening ? 'blink bg-sign' : 'bg-ink-dim'}`} />
              {listening ? t.boardListening : t.boardIdle}
            </p>
          </div>
          <div className={`${GRID} ${SIGN} px-5 pt-3 pb-2 text-[13px] tracking-[0.14em] text-sign th:tracking-normal`} aria-hidden>
            <span className="max-md:hidden">{t.colTime}</span>
            <span className="max-md:hidden">{t.colRoute}</span>
            <span>{t.colText}</span>
            <span className="justify-self-end">{t.colStatus}</span>
          </div>
        </>
      )}

      <ol className="flex flex-col gap-[3px]" aria-live={compact ? undefined : 'polite'} aria-relevant="additions">
        {live.src && (
          <BoardRow key="live" time="" route={route} dst={live.dst} src={live.src} status="listen" big={false} showSrc={showSrc} compact={compact} t={t} />
        )}
        {ordered.map((r, i) => (
          <BoardRow
            key={r.id}
            time={r.time}
            route={route}
            dst={r.dst}
            src={r.src}
            status={r.status}
            big={i === 0} // the newest finished line keeps subtitle size even while someone is talking
            showSrc={showSrc}
            compact={compact}
            t={t}
          />
        ))}
        {empty &&
          !compact &&
          !listening &&
          steps.map((s, i) => (
            <li key={s} className={`flap-row ${GRID} px-5 py-4`}>
              <span className={`${SIGN} flap-cell tabular justify-self-start text-[15px] text-ink-dim max-md:hidden`}>--:--</span>
              <span className={`${SIGN} flap-cell justify-self-start text-[15px] text-ink-dim max-md:hidden`}>{route}</span>
              <p className="text-[19px] leading-snug text-pretty">{s}</p>
              <span className={`${SIGN} flap-cell justify-self-end text-[15px] text-sign`}>
                {t.stepStatus} {i + 1}
              </span>
            </li>
          ))}
        {empty && listening && !compact && (
          <li className={`flap-row ${GRID} px-5 py-4`}>
            <span className={`${SIGN} flap-cell tabular justify-self-start text-[15px] text-ink-dim max-md:hidden`}>--:--</span>
            <span className={`${SIGN} flap-cell justify-self-start text-[15px] text-ink-dim max-md:hidden`}>{route}</span>
            <p className="text-ink-dim" style={{ fontSize: 'calc(var(--fs) * 0.62)' }}>…</p>
            <span className={`${SIGN} flap-cell justify-self-end text-[15px] ${TONE.listen}`}>{t.stListen}</span>
          </li>
        )}
      </ol>
    </section>
  )
}

/** Input level, so the user can see that audio is actually arriving. */
export function Meter({ stream }: { stream: MediaStream | null }) {
  const bar = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!stream) return
    const ac = new AudioContext()
    const an = ac.createAnalyser()
    an.fftSize = 512
    ac.createMediaStreamSource(stream).connect(an)
    const buf = new Uint8Array(an.fftSize)
    let raf = 0
    const tick = () => {
      an.getByteTimeDomainData(buf)
      let peak = 0
      for (const v of buf) peak = Math.max(peak, Math.abs(v - 128))
      if (bar.current) bar.current.style.transform = `scaleX(${Math.min(1, (peak / 128) * 2.5)})`
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => {
      cancelAnimationFrame(raf)
      void ac.close()
      if (bar.current) bar.current.style.transform = 'scaleX(0)'
    }
  }, [stream])
  return (
    <div aria-hidden className="h-[3px] bg-[#1d2120]">
      <div ref={bar} className="h-full origin-left bg-sign" style={{ transform: 'scaleX(0)' }} />
    </div>
  )
}

interface PipApi {
  requestWindow(opts: { width: number; height: number }): Promise<Window>
}

/** Document Picture-in-Picture: an always-on-top window above borderless/windowed games. */
export function useOverlay(onError: () => void) {
  const [win, setWin] = useState<Window | null>(null)

  const toggle = async () => {
    if (win) return win.close()
    const pip = (window as { documentPictureInPicture?: PipApi }).documentPictureInPicture
    if (!pip) return onError()
    try {
      const w = await pip.requestWindow({ width: 640, height: 260 })
      for (const node of document.head.querySelectorAll('style, link[rel="stylesheet"]')) w.document.head.append(node.cloneNode(true))
      w.document.title = 'Live Translate'
      w.document.documentElement.className = 'dark'
      w.document.documentElement.style.setProperty('--fs', getComputedStyle(document.documentElement).getPropertyValue('--fs'))
      w.document.body.className = 'overlay-body'
      w.addEventListener('pagehide', () => setWin(null))
      setWin(w)
    } catch {
      onError()
    }
  }

  return { win, toggle }
}
