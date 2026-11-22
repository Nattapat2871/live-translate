// Live Translate — view and like counter (Ame API Page Stats)
// Author / ผู้สร้าง: nattapat2871 (https://nattapat2871.me)
import { Eye, Heart } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Strings } from './text'

const API = 'https://ame-api.nattapat2871.me/api'
// The API keys counters by `site`; GitHub Pages shares one hostname between projects, so the path is part of it.
const SITE = encodeURIComponent(`${location.hostname}${import.meta.env.BASE_URL}`.replace(/\/$/, ''))
const VIEW_EVERY_MS = 12 * 60 * 60 * 1000 // the API's own example counts a visitor again after 12 hours
const VIEWED = 'lt.viewedAt'
const LIKED = 'lt.liked'

const read = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    // site data blocked: the visitor may be counted again, nothing breaks
  }
}

async function call(path: string, method?: 'POST') {
  const res = await fetch(`${API}/${path}`, { method })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<{ view_count?: number; like_count?: number; count?: number }>
}

const fmt = (n: number | undefined) => (n === undefined ? '—' : n.toLocaleString())

export function PageStats({ t }: { t: Strings }) {
  const [views, setViews] = useState<number>()
  const [likes, setLikes] = useState<number>()
  const [liked, setLiked] = useState(() => read(LIKED) === '1')

  // No cancel flag: the chip lives as long as the page, and StrictMode's dev re-run must not swallow the one view.
  useEffect(() => {
    const fresh = Date.now() - Number(read(VIEWED) ?? 0) > VIEW_EVERY_MS
    if (fresh) write(VIEWED, String(Date.now())) // before the request, so StrictMode's second run does not count twice
    call(`page-stats?site=${SITE}`)
      .then(async s => {
        setViews(s.view_count)
        setLikes(s.like_count)
        if (!fresh) return
        const v = await call(`view?site=${SITE}`, 'POST')
        if (typeof v.count === 'number') setViews(v.count)
      })
      .catch(() => {}) // stats are decoration: unreachable API leaves the dashes
  }, [])

  const like = () => {
    if (liked) return
    setLiked(true)
    write(LIKED, '1')
    setLikes(n => (n === undefined ? n : n + 1))
    call(`like?site=${SITE}&action=like`, 'POST')
      .then(r => typeof r.count === 'number' && setLikes(r.count))
      .catch(() => {})
  }

  return (
    <div className="fixed bottom-4 right-4 z-30 flex items-center gap-3 border border-[#232826] bg-flap/95 px-3 py-1.5 font-sign text-[15px] tabular-nums text-ink-dim shadow-lg backdrop-blur">
      <span className="flex items-center gap-1.5" title={t.statsViews}>
        <Eye size={15} aria-hidden />
        <span className="sr-only">{t.statsViews}</span>
        {fmt(views)}
      </span>
      <span className="h-4 w-px bg-[#2c322f]" aria-hidden />
      <button
        type="button"
        onClick={like}
        aria-pressed={liked}
        title={liked ? t.statsLiked : t.statsLike}
        aria-label={`${liked ? t.statsLiked : t.statsLike}: ${fmt(likes)}`}
        className={`flex items-center gap-1.5 transition-colors ${liked ? 'cursor-default text-sign' : 'hover:text-sign'}`}
      >
        <Heart size={15} aria-hidden fill={liked ? 'currentColor' : 'none'} />
        {fmt(likes)}
      </button>
    </div>
  )
}
