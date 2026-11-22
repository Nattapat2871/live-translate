// Live Translate — OBS Browser Source: transparent subtitles fed by the main page through obs-websocket
// Author / ผู้สร้าง: nattapat2871 (https://nattapat2871.me)
import '@fontsource-variable/anuphan'
import './obs.css'
import { connectObs, type ObsFrame } from './obs'

const params = new URLSearchParams(location.hash.slice(1))
const port = Number(params.get('port')) || 4455
const password = params.get('password') ?? ''
const maxLines = Math.min(6, Math.max(1, Number(params.get('lines')) || 2))
const showSrc = params.get('src') === '1'
document.documentElement.style.setProperty('--fs', `${Number(params.get('fs')) || 44}px`)

const box = document.getElementById('lines')!
const status = document.getElementById('status')!

function render(frame: ObsFrame) {
  box.replaceChildren(
    ...frame.lines.slice(-maxLines).map((l, i, all) => {
      const div = document.createElement('div')
      div.className = `line${l.live ? ' live' : ''}${i === all.length - 1 ? ' newest' : ''}`
      const dst = document.createElement('p')
      dst.className = 'dst'
      dst.textContent = l.dst || '…'
      div.append(dst)
      if (showSrc && l.src) {
        const src = document.createElement('p')
        src.className = 'src'
        src.textContent = l.src
        div.append(src)
      }
      return div
    }),
  )
}

// Shown in the OBS preview while the link is down, so a broken setup is visible instead of silently blank.
function showStatus(text: string | null) {
  status.hidden = text === null
  status.textContent = text ?? ''
}

let timer = 0
function retry() {
  clearTimeout(timer)
  timer = window.setTimeout(() => void run(), 3000)
}
async function run() {
  try {
    await connectObs(port, password, { listen: render, onClose: retry })
    showStatus(null)
  } catch (e) {
    showStatus((e as Error).message === 'auth' ? 'Live Translate: OBS WebSocket password is wrong' : `Live Translate: waiting for OBS WebSocket on port ${port}`)
    retry()
  }
}
void run()
