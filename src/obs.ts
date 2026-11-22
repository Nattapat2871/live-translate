// Live Translate — OBS link over obs-websocket v5 (built into OBS 28+), no server of our own
// Author / ผู้สร้าง: nattapat2871 (https://nattapat2871.me)
// The board sends each update with BroadcastCustomEvent; obs.html, loaded by OBS as a Browser Source, listens for it.

export interface ObsLine {
  id: string
  dst: string
  src: string
  live: boolean
}
export interface ObsFrame {
  app: 'live-translate'
  lines: ObsLine[]
}
export interface ObsLink {
  send(frame: ObsFrame): void
  close(): void
}

const SUB_GENERAL = 1 // EventSubscription.General carries CustomEvent

async function sha256b64(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
}

/** Opens and identifies one obs-websocket connection. Rejects with Error('auth') or Error('error'). */
export function connectObs(port: number, password: string, opts: { listen?: (frame: ObsFrame) => void; onClose?: () => void } = {}) {
  return new Promise<ObsLink>((resolve, reject) => {
    let ws: WebSocket
    try {
      ws = new WebSocket(`ws://127.0.0.1:${port}`)
    } catch {
      return reject(new Error('error'))
    }
    let ready = false
    let seq = 0
    ws.onmessage = async ev => {
      let msg: { op: number; d: Record<string, unknown> }
      try {
        msg = JSON.parse(String(ev.data))
      } catch {
        return
      }
      if (msg.op === 0) {
        const auth = msg.d.authentication as { challenge: string; salt: string } | undefined
        const d: Record<string, unknown> = { rpcVersion: 1, eventSubscriptions: opts.listen ? SUB_GENERAL : 0 }
        if (auth) d.authentication = await sha256b64((await sha256b64(password + auth.salt)) + auth.challenge)
        ws.send(JSON.stringify({ op: 1, d }))
      } else if (msg.op === 2) {
        ready = true
        resolve({
          send(frame) {
            if (ws.readyState !== WebSocket.OPEN) return
            const d = { requestType: 'BroadcastCustomEvent', requestId: String(++seq), requestData: { eventData: frame } }
            ws.send(JSON.stringify({ op: 6, d }))
          },
          close: () => ws.close(),
        })
      } else if (msg.op === 5 && msg.d.eventType === 'CustomEvent') {
        const frame = (msg.d.eventData ?? {}) as ObsFrame
        if (frame.app === 'live-translate' && Array.isArray(frame.lines)) opts.listen?.(frame)
      }
    }
    ws.onclose = ev => {
      if (!ready) reject(new Error(ev.code === 4009 ? 'auth' : 'error')) // 4009 = AuthenticationFailed
      else opts.onClose?.()
    }
  })
}

/** Browser Source URL for OBS. Settings ride in the fragment, which browsers never send to a server. */
export function obsSourceUrl(port: number, password: string, lines: number, showSrc: boolean, fs: number) {
  const url = new URL('obs.html', location.href)
  url.search = ''
  url.hash = new URLSearchParams({ port: String(port), password, lines: String(lines), src: showSrc ? '1' : '0', fs: String(fs) }).toString()
  return url.toString()
}
