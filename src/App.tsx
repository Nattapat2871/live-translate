// Live Translate — app shell
// Author / ผู้สร้าง: nattapat2871 (https://nattapat2871.me)
import {
  addToast,
  Autocomplete,
  AutocompleteItem,
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  Input,
  Link,
  Progress,
  Radio,
  RadioGroup,
  Select,
  SelectItem,
  Slider,
  Switch,
  Tab,
  Tabs,
} from '@heroui/react'
import { ArrowLeftRight, Copy, Download, Eye, EyeOff, HeartHandshake, Mic, MonitorSpeaker, PictureInPicture2, Play, Settings2, Square, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Board, Meter, useOverlay } from './Board'
import { Pipeline, type Live, type Row } from './pipeline'
import { connectObs, obsSourceUrl, type ObsLink } from './obs'
import { SOURCES, STRINGS, TARGETS, langByCode, langBySpeech, langNames, speechFor, targetFor, type Lang, type Strings, type UiLang } from './text'
import { chromeAIPrepare, chromeAIRefiner, chromeAIStatus, claudeRefiner, isClaudeKey, quickTranslate, TranslateError, type ChromeAIState } from './translate'
import { useSpeech, type Source } from './useSpeech'
import { audioInputs } from './voice'

type Engine = 'google' | 'chrome' | 'claude'
const KEY_STORE = 'lt.anthropicKey'
const REPO_URL = 'https://github.com/Nattapat2871/live-translate'
// NamPayments hosted donate page (https://nampayments.nattapat2871.me/s/<slug>/<page>): the bill is made and checked there.
// Empty = no donate button until the store page exists.
const DONATE_URL = 'https://nampayments.nattapat2871.me/s/nattapat2871'
type ObsState = 'off' | 'connecting' | 'on' | 'auth' | 'error'

function GithubMark() {
  return (
    <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}
const SECTION = 'font-sign text-[15px] uppercase tracking-[0.12em] th:tracking-normal text-sign'

type Area = 'localStorage' | 'sessionStorage'
/** Storage throws when site data is blocked; the app then just forgets settings instead of going blank. */
const store = {
  get(area: Area, key: string) {
    try {
      return window[area].getItem(key)
    } catch {
      return null
    }
  },
  set(area: Area, key: string, value: string | null) {
    try {
      if (value === null) window[area].removeItem(key)
      else window[area].setItem(key, value)
    } catch {
      // blocked or full
    }
  },
}

function usePersisted<T>(name: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = store.get('localStorage', `lt.${name}`)
      return raw === null ? initial : (JSON.parse(raw) as T)
    } catch {
      return initial
    }
  })
  useEffect(() => store.set('localStorage', `lt.${name}`, JSON.stringify(value)), [name, value])
  return [value, setValue] as const
}

function LangSelect(p: { label: string; value: string; onChange(v: string): void; langs: Lang[]; ui: UiLang; t: Strings }) {
  const items = useMemo(
    () =>
      p.langs.map(l => {
        const n = langNames(l, p.ui)
        return { key: l.key, ...n, text: n.native === n.local ? n.local : `${n.local} · ${n.native}` } // shown in the field and searched
      }),
    [p.langs, p.ui],
  )
  return (
    <Autocomplete
      size="sm"
      radius="sm"
      label={p.label}
      labelPlacement="outside"
      placeholder={p.t.langSearch}
      listboxProps={{ emptyContent: p.t.langNone }}
      defaultItems={items}
      selectedKey={p.value}
      onSelectionChange={k => {
        if (k !== null) p.onChange(String(k))
      }}
      isClearable={false}
      classNames={{ base: 'w-48', selectorButton: 'text-ink-dim' }}
      inputProps={{ classNames: { label: 'text-[12px] text-ink-dim' } }}
    >
      {item => (
        <AutocompleteItem key={item.key} textValue={item.text} description={item.native !== item.local ? item.native : undefined}>
          {item.local}
        </AutocompleteItem>
      )}
    </Autocomplete>
  )
}

export default function App() {
  const [ui, setUi] = usePersisted<UiLang>('ui', navigator.language.startsWith('th') ? 'th' : 'en')
  const t = STRINGS[ui] ?? STRINGS.th
  const [source, setSource] = usePersisted<Source>('source', 'system')
  const [from, setFrom] = usePersisted('from', 'en-US')
  const [to, setTo] = usePersisted('to', 'th')
  const [engine, setEngine] = usePersisted<Engine>('engine', 'google')
  const [model, setModel] = usePersisted('model', 'claude-opus-5-5')
  const [fs, setFs] = usePersisted('fs', 30)
  const [showSrc, setShowSrc] = usePersisted('showSrc', true)
  const [remember, setRemember] = usePersisted('rememberKey', false)
  const [key, setKey] = useState(() => store.get('localStorage', KEY_STORE) ?? store.get('sessionStorage', KEY_STORE) ?? '')
  const [showKey, setShowKey] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [live, setLive] = useState<Live>({ src: '', dst: '' })
  const [chromeState, setChromeState] = useState<ChromeAIState>('unsupported')
  const [chromeReady, setChromeReady] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [obs, setObs] = usePersisted('obs', { on: false, port: 4455, password: '', lines: 2, fs: 44 })
  const [obsState, setObsState] = useState<ObsState>('off')
  const [noise, setNoise] = usePersisted('noise', { filter: true, ai: false })
  const [device, setDevice] = usePersisted('device', '')
  const [devices, setDevices] = useState<{ id: string; label: string }[]>([])
  const obsLink = useRef<ObsLink | null>(null)

  const fromLang = langBySpeech(from)
  const toLang = langByCode(to)
  const route = `${fromLang.short}→${toLang.short}`
  const fromName = langNames(fromLang, 'en').local // English names read best in model prompts
  const toName = langNames(toLang, 'en').local
  const keyOk = isClaudeKey(key)
  const swapTo = speechFor(toLang.code) // undefined when the target language cannot be listened to
  const swap = () => {
    if (!swapTo) return
    setTo(targetFor(fromLang).key)
    setFrom(swapTo.key)
  }

  // Latest values for callbacks that outlive a render.
  const latest = useRef({ t, sl: fromLang.code, tl: toLang.code })
  latest.current = { t, sl: fromLang.code, tl: toLang.code }

  const lastToast = useRef(new Map<string, number>())
  const notify = (title: string, color: 'danger' | 'warning' | 'default' = 'danger') => {
    const now = Date.now()
    if (now - (lastToast.current.get(title) ?? 0) < 8000) return // one toast per problem, not one per line
    lastToast.current.set(title, now)
    addToast({ title, color, timeout: 6000 })
  }

  const onTranslateError = useRef<(e: unknown) => void>(() => {})
  onTranslateError.current = e => {
    if (!(e instanceof TranslateError)) return
    const E = latest.current.t.err
    if (e.source === 'claude') {
      if (e.code === 'auth') {
        setEngine('google')
        notify(E.claudeAuth)
      } else if (e.code === 'rate') notify(E.claudeRate, 'warning')
      else if (e.code === 'network') notify(E.claudeNetwork, 'warning')
      else notify(`Claude: ${e.message}`, 'warning')
    } else if (e.source === 'chrome') notify(E.chrome, 'warning')
    else notify(e.code === 'rate' ? E.googleRate : E.googleNetwork, 'warning')
  }

  const [pipeline] = useState(
    () =>
      new Pipeline({
        quick: (text, prev, signal) => quickTranslate(text, prev, latest.current.sl, latest.current.tl, signal),
        onChange: (r, l) => {
          setRows(r)
          setLive(l)
        },
        onError: e => onTranslateError.current(e),
      }),
  )
  useEffect(() => () => pipeline.dispose(), [pipeline])
  useEffect(() => pipeline.setSegmentByChars(!!fromLang.chars), [pipeline, fromLang])

  // Which context-aware engine refines the quick translation.
  useEffect(() => {
    if (engine === 'claude' && keyOk) pipeline.setRefine(claudeRefiner(key.trim(), model, fromName, toName))
    else if (engine === 'chrome' && chromeReady) pipeline.setRefine(chromeAIRefiner(fromLang.code, toLang.code))
    else pipeline.setRefine(null)
  }, [pipeline, engine, key, keyOk, model, fromLang, toLang, chromeReady])

  // The key lives in sessionStorage unless the visitor opts to remember it; never in both.
  useEffect(() => {
    store.set('localStorage', KEY_STORE, null)
    store.set('sessionStorage', KEY_STORE, null)
    if (keyOk) store.set(remember ? 'localStorage' : 'sessionStorage', KEY_STORE, key.trim())
  }, [key, keyOk, remember])

  useEffect(() => {
    if (engine !== 'chrome') return
    let cancelled = false
    setChromeReady(false)
    void chromeAIStatus(fromLang.code, toLang.code).then(async state => {
      if (cancelled) return
      setChromeState(state)
      if (state !== 'available') return
      try {
        await chromeAIPrepare(fromLang.code, toLang.code, fromName, toName)
        if (!cancelled) setChromeReady(true)
      } catch {
        if (!cancelled) setChromeState('unavailable')
      }
    })
    return () => {
      cancelled = true
    }
  }, [engine, fromLang, toLang])

  const prepareChrome = async () => {
    setProgress(0)
    try {
      await chromeAIPrepare(fromLang.code, toLang.code, fromName, toName, setProgress)
      setChromeState('available')
      setChromeReady(true)
    } catch {
      notify(t.err.chrome, 'warning')
    } finally {
      setProgress(null)
    }
  }

  const speech = useSpeech(from, {
    onInterim: text => pipeline.interim(text),
    onFinal: text => pipeline.final(text),
    onFlush: () => pipeline.flush(),
    onError: e => notify(latest.current.t.err[e]),
    onEnded: () => notify(latest.current.t.stopped, 'default'),
  })

  // OBS: one obs-websocket link while switched on; reconnects every 3 s and waits 0.5 s after a typed change.
  useEffect(() => {
    if (!obs.on) return setObsState('off')
    let stopped = false
    let link: ObsLink | null = null
    const open = () => {
      setObsState('connecting')
      connectObs(obs.port, obs.password, {
        onClose: () => {
          obsLink.current = null
          if (stopped) return
          setObsState('error')
          timer = window.setTimeout(open, 3000)
        },
      }).then(
        l => {
          if (stopped) return l.close()
          link = obsLink.current = l
          setObsState('on')
        },
        (e: Error) => {
          if (stopped) return
          setObsState(e.message === 'auth' ? 'auth' : 'error')
          if (e.message !== 'auth') timer = window.setTimeout(open, 3000)
        },
      )
    }
    let timer = window.setTimeout(open, 500)
    return () => {
      stopped = true
      clearTimeout(timer)
      link?.close()
      obsLink.current = null
    }
  }, [obs.on, obs.port, obs.password])

  useEffect(() => {
    if (obsState !== 'on') return
    const lines = rows.slice(-6).map(r => ({ id: String(r.id), dst: r.dst, src: r.src, live: false }))
    if (live.src) lines.push({ id: 'live', dst: live.dst, src: live.src, live: true })
    obsLink.current?.send({ app: 'live-translate', lines })
  }, [rows, live, obsState])

  // Input list for the mic source; refreshed when settings open, devices change, or capture starts (labels need permission).
  useEffect(() => {
    if (!settingsOpen && !speech.listening) return
    const refresh = () => void audioInputs().then(setDevices)
    refresh()
    navigator.mediaDevices?.addEventListener('devicechange', refresh)
    return () => navigator.mediaDevices?.removeEventListener('devicechange', refresh)
  }, [settingsOpen, speech.listening])

  const copyObsUrl = async () => {
    const url = obsSourceUrl(obs.port, obs.password, obs.lines, showSrc, obs.fs)
    try {
      await navigator.clipboard.writeText(url)
      notify(t.obsCopied, 'default')
    } catch {
      window.prompt(t.obsCopy, url) // clipboard blocked: let the visitor copy it by hand
    }
  }

  const overlay = useOverlay(() => notify(t.err.pip))
  useEffect(() => {
    for (const d of [document, overlay.win?.document]) d?.documentElement.style.setProperty('--fs', `${fs}px`)
  }, [fs, overlay.win])
  useEffect(() => {
    document.documentElement.lang = ui
  }, [ui])

  const save = () => {
    const text = rows.map(r => `[${r.time}] ${r.src}\n→ ${r.dst}`).join('\n\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
    a.download = `live-translate-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-[#232826] bg-[#111312]">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-3 gap-y-3 px-5 py-3">
          <div className="mr-auto flex items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-8" />
            <div>
              <h1 className="font-sign text-[22px] font-semibold uppercase leading-none tracking-[0.1em]">Live Translate</h1>
              <p className="mt-1 text-[13px] text-ink-dim">{t.tagline}</p>
            </div>
            <div className="ml-2 flex items-center gap-1">
              {DONATE_URL && (
                <Button as={Link} href={DONATE_URL} isExternal size="sm" variant="flat" color="primary" radius="sm" title={t.donateHint} startContent={<HeartHandshake size={16} aria-hidden />}>
                  {t.donate}
                </Button>
              )}
              <Button as={Link} href={REPO_URL} isExternal isIconOnly size="sm" variant="light" radius="sm" aria-label={t.github} title={t.github} className="text-ink-dim data-[hover=true]:text-ink">
                <GithubMark />
              </Button>
            </div>
          </div>

          <Tabs
            aria-label={t.source}
            selectedKey={source}
            onSelectionChange={k => setSource(k as Source)}
            isDisabled={speech.listening}
            radius="sm"
            color="primary"
            classNames={{ tabContent: 'group-data-[selected=true]:text-board font-medium' }}
          >
            <Tab key="system" title={<span className="flex items-center gap-2"><MonitorSpeaker size={16} aria-hidden />{t.sourceSystem}</span>} />
            <Tab key="mic" title={<span className="flex items-center gap-2"><Mic size={16} aria-hidden />{t.sourceMic}</span>} />
          </Tabs>

          <div className="flex items-end gap-1">
            <LangSelect label={t.from} value={fromLang.key} onChange={setFrom} langs={SOURCES} ui={ui} t={t} />
            <Button
              isIconOnly
              size="sm"
              variant="light"
              radius="sm"
              aria-label={swapTo ? t.swap : t.swapNo}
              title={swapTo ? t.swap : t.swapNo}
              isDisabled={!swapTo}
              onPress={swap}
              className="mb-0.5 text-ink-dim data-[hover=true]:text-sign"
            >
              <ArrowLeftRight size={18} aria-hidden />
            </Button>
            <LangSelect label={t.to} value={toLang.key} onChange={setTo} langs={TARGETS} ui={ui} t={t} />
          </div>

          <Button
            color={speech.listening ? 'danger' : 'primary'}
            radius="sm"
            className="min-w-32 font-semibold"
            startContent={speech.listening ? <Square size={16} aria-hidden /> : <Play size={16} aria-hidden />}
            onPress={() => (speech.listening ? speech.stop() : void speech.start(source, { voice: noise, deviceId: source === 'mic' && device ? device : undefined }))}
          >
            {speech.listening ? t.stop : t.start}
          </Button>
          <Button variant="bordered" radius="sm" startContent={<PictureInPicture2 size={16} aria-hidden />} onPress={() => void overlay.toggle()}>
            {overlay.win ? t.overlayClose : t.overlay}
          </Button>
          <Button isIconOnly variant="bordered" radius="sm" aria-label={t.settings} onPress={() => setSettingsOpen(true)}>
            <Settings2 size={18} aria-hidden />
          </Button>
        </div>
        <Meter stream={speech.stream} />
      </header>

      <main className="mx-auto w-full max-w-[1400px] flex-1 py-6 md:px-5">
        <Board rows={rows} live={live} t={t} route={route} showSrc={showSrc} listening={speech.listening} />
      </main>

      <footer className="mx-auto flex w-full max-w-[1400px] flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-5 pb-6 text-[13px] text-ink-dim">
        <p className="max-w-[75ch]">{t.privacy}</p>
        <p>
          {t.author}{' '}
          <Link href="https://nattapat2871.me" isExternal size="sm" className="text-sign">
            nattapat2871
          </Link>
        </p>
      </footer>

      <Drawer isOpen={settingsOpen} onOpenChange={setSettingsOpen} placement="right" size="md" radius="none" classNames={{ base: 'bg-[#111312] border-l border-[#232826]' }}>
        <DrawerContent>
          <DrawerHeader className="font-sign text-2xl uppercase tracking-[0.12em] th:tracking-normal text-sign">{t.settings}</DrawerHeader>
          <DrawerBody className="gap-8 pb-10">
            <RadioGroup label={t.uiLang} orientation="horizontal" value={ui} onValueChange={v => setUi(v as UiLang)} classNames={{ label: SECTION, wrapper: 'gap-6' }}>
              <Radio value="th">ไทย</Radio>
              <Radio value="en">English</Radio>
            </RadioGroup>

            <RadioGroup label={t.engine} value={engine} onValueChange={v => setEngine(v as Engine)} classNames={{ label: SECTION, wrapper: 'gap-4' }}>
              <Radio value="google" description={t.engineGoogleHint} classNames={{ description: 'text-ink-dim' }}>{t.engineGoogle}</Radio>
              <Radio value="chrome" description={t.engineChromeHint} classNames={{ description: 'text-ink-dim' }}>{t.engineChrome}</Radio>
              <Radio value="claude" description={t.engineClaudeHint} classNames={{ description: 'text-ink-dim' }}>{t.engineClaude}</Radio>
            </RadioGroup>

            {engine === 'chrome' && (
              <div className="flex flex-col gap-3 bg-flap p-4">
                <p className="text-sm" role="status">{t.chromeState[chromeReady ? 'available' : chromeState]}</p>
                {!chromeReady && (chromeState === 'downloadable' || chromeState === 'downloading') && (
                  <Button size="sm" color="primary" radius="sm" className="self-start" isLoading={progress !== null} onPress={() => void prepareChrome()}>
                    {t.chromePrepare}
                  </Button>
                )}
                {progress !== null && <Progress aria-label={t.chromeState.downloading} value={progress * 100} color="primary" size="sm" />}
              </div>
            )}

            {engine === 'claude' && (
              <div className="flex flex-col gap-4 bg-flap p-4">
                <ul className="list-disc space-y-1 ps-5 text-sm leading-relaxed text-ink-dim">
                  {t.keyExplain.map(line => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <Input
                  label={t.keyLabel}
                  labelPlacement="outside"
                  placeholder={t.keyPlaceholder}
                  type={showKey ? 'text' : 'password'}
                  name="lt-anthropic-key"
                  autoComplete="new-password"
                  spellCheck="false"
                  data-1p-ignore
                  data-lpignore="true"
                  radius="sm"
                  value={key}
                  onValueChange={setKey}
                  isInvalid={!!key && !keyOk}
                  errorMessage={t.keyInvalid}
                  classNames={{ errorMessage: 'text-[13px] leading-snug' }}
                  endContent={
                    <button type="button" aria-label={showKey ? t.keyHide : t.keyShow} onClick={() => setShowKey(s => !s)} className="text-ink-dim hover:text-ink">
                      {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                />
                <Switch size="sm" isSelected={remember} onValueChange={setRemember}>
                  <span className="text-sm">{t.keyRemember}</span>
                </Switch>
                <Button size="sm" variant="flat" color="danger" radius="sm" className="self-start" startContent={<Trash2 size={14} aria-hidden />} isDisabled={!key} onPress={() => setKey('')}>
                  {t.keyClear}
                </Button>
                <Select
                  label={t.model}
                  labelPlacement="outside"
                  radius="sm"
                  disallowEmptySelection
                  selectedKeys={[model]}
                  onSelectionChange={keys => {
                    const k = keys === 'all' ? undefined : [...keys][0]
                    if (k !== undefined) setModel(String(k))
                  }}
                >
                  <SelectItem key="claude-opus-5-5">{t.modelOpus}</SelectItem>
                  <SelectItem key="claude-sonnet-5-5">{t.modelSonnet}</SelectItem>
                  <SelectItem key="claude-haiku-5-5">{t.modelHaiku}</SelectItem>
                </Select>
              </div>
            )}

            <div className="flex flex-col gap-5">
              <h3 className={SECTION}>{t.display}</h3>
              <Slider
                label={t.fontSize}
                size="sm"
                color="primary"
                minValue={18}
                maxValue={48}
                step={1}
                value={fs}
                getValue={v => `${v}px`}
                onChange={v => setFs(Array.isArray(v) ? v[0] : v)}
              />
              <Switch size="sm" isSelected={showSrc} onValueChange={setShowSrc}>
                <span className="text-sm">{t.showSrc}</span>
              </Switch>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="bordered" radius="sm" startContent={<Trash2 size={14} aria-hidden />} onPress={() => pipeline.clear()} isDisabled={!rows.length}>
                  {t.clear}
                </Button>
                <Button size="sm" variant="bordered" radius="sm" startContent={<Download size={14} aria-hidden />} onPress={save} isDisabled={!rows.length}>
                  {t.save}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <h3 className={SECTION}>{t.noise}</h3>
              <ol className="list-decimal space-y-1 ps-5 text-sm leading-relaxed text-ink-dim">
                {t.noiseTips.map(line => (
                  <li key={line}>{line}</li>
                ))}
              </ol>
              <Switch size="sm" isSelected={noise.filter} onValueChange={filter => setNoise(n => ({ ...n, filter }))}>
                <span className="text-sm">{t.noiseFilter}</span>
              </Switch>
              <p className="-mt-2 ps-12 text-[13px] leading-snug text-ink-dim">{t.noiseFilterHint}</p>
              <Switch size="sm" isSelected={noise.ai} onValueChange={ai => setNoise(n => ({ ...n, ai }))}>
                <span className="text-sm">{t.noiseAi}</span>
              </Switch>
              <p className="-mt-2 ps-12 text-[13px] leading-snug text-ink-dim">{t.noiseAiHint}</p>
              <p id="lt-device-label" className="-mb-2 text-sm">{t.device}</p>
              <Select
                aria-labelledby="lt-device-label"
                radius="sm"
                size="sm"
                disallowEmptySelection
                description={devices.some(d => d.label) ? undefined : t.deviceHint}
                selectedKeys={[devices.some(d => d.id === device) ? device : '']}
                onSelectionChange={keys => {
                  const k = keys === 'all' ? undefined : [...keys][0]
                  if (k !== undefined) setDevice(String(k))
                }}
                items={[{ id: '', label: t.deviceDefault }, ...devices.map((d, i) => ({ id: d.id, label: d.label || `${t.deviceUnnamed} ${i + 1}` }))]}
              >
                {d => <SelectItem key={d.id}>{d.label}</SelectItem>}
              </Select>
              <p className="text-[13px] leading-snug text-ink-dim">{t.noiseApply}</p>
            </div>

            <div className="flex flex-col gap-4">
              <h3 className={SECTION}>{t.obs}</h3>
              <ol className="list-decimal space-y-1 ps-5 text-sm leading-relaxed text-ink-dim">
                {t.obsSteps.map(line => (
                  <li key={line}>{line}</li>
                ))}
              </ol>
              <div className="flex gap-3">
                <Input
                  size="sm"
                  radius="sm"
                  type="number"
                  label={t.obsPort}
                  labelPlacement="outside"
                  className="w-28 shrink-0"
                  value={String(obs.port)}
                  onValueChange={v => setObs(o => ({ ...o, port: Math.min(65535, Math.max(1, Number(v) || 4455)) }))}
                />
                <Input
                  size="sm"
                  radius="sm"
                  type="password"
                  name="lt-obs-password"
                  autoComplete="new-password"
                  data-1p-ignore
                  data-lpignore="true"
                  label={t.obsPassword}
                  labelPlacement="outside"
                  placeholder=" "
                  value={obs.password}
                  onValueChange={v => setObs(o => ({ ...o, password: v }))}
                />
              </div>
              <Switch size="sm" isSelected={obs.on} onValueChange={on => setObs(o => ({ ...o, on }))}>
                <span className="text-sm">{t.obsEnable}</span>
              </Switch>
              <p role="status" className={`text-sm ${obsState === 'on' ? 'text-sign' : obsState === 'auth' || obsState === 'error' ? 'text-[#ff8a80]' : 'text-ink-dim'}`}>
                {t.obsState[obsState]}
              </p>
              <Slider
                label={t.obsLines}
                size="sm"
                color="primary"
                minValue={1}
                maxValue={4}
                step={1}
                value={obs.lines}
                onChange={v => setObs(o => ({ ...o, lines: Array.isArray(v) ? v[0] : v }))}
              />
              <Slider
                label={t.obsSize}
                size="sm"
                color="primary"
                minValue={24}
                maxValue={80}
                step={2}
                value={obs.fs}
                getValue={v => `${v}px`}
                onChange={v => setObs(o => ({ ...o, fs: Array.isArray(v) ? v[0] : v }))}
              />
              <Button size="sm" variant="bordered" radius="sm" className="self-start" startContent={<Copy size={14} aria-hidden />} onPress={() => void copyObsUrl()}>
                {t.obsCopy}
              </Button>
              <p className="text-[13px] leading-snug text-ink-dim">{t.obsNote}</p>
            </div>

            <p className="text-sm leading-relaxed text-ink-dim">{t.limits}</p>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {overlay.win &&
        createPortal(<Board compact rows={rows} live={live} t={t} route={route} showSrc={showSrc} listening={speech.listening} />, overlay.win.document.body)}
    </div>
  )
}
