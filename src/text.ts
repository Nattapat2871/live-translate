// Live Translate — languages and interface copy (TH / EN)
// Author / ผู้สร้าง: nattapat2871 (https://nattapat2871.me)

export interface Lang {
  key: string // SpeechRecognition locale for sources, translation code for targets
  code: string // Google Translate code
  short: string // board route code
  chars: boolean // written without spaces between words
}

// Locales Chrome's speech recognition accepts; the first locale of a language is the one a swap picks.
const SPEECH =
  'en-US en-GB en-AU en-CA en-IN en-NZ en-PH en-SG en-ZA th-TH ja-JP ko-KR zh-CN zh-TW yue-Hant-HK vi-VN id-ID ms-MY fil-PH lo-LA my-MM km-KH ' +
  'hi-IN bn-BD bn-IN ta-IN ta-LK te-IN kn-IN ml-IN mr-IN gu-IN pa-Guru-IN ur-PK ur-IN ne-NP si-LK jv-ID su-ID ' +
  'es-ES es-MX es-US es-AR es-CO es-CL es-PE pt-BR pt-PT fr-FR fr-CA fr-BE fr-CH de-DE de-AT de-CH it-IT nl-NL nl-BE ' +
  'ru-RU uk-UA pl-PL cs-CZ sk-SK hu-HU ro-RO bg-BG hr-HR sr-RS sl-SI bs-BA mk-MK sq-AL el-GR tr-TR az-AZ ka-GE hy-AM kk-KZ uz-UZ mn-MN ' +
  'sv-SE nb-NO da-DK fi-FI is-IS et-EE lv-LV lt-LT ca-ES eu-ES gl-ES cy-GB ar-SA ar-EG ar-AE fa-IR he-IL ' +
  'af-ZA zu-ZA sw-KE sw-TZ am-ET'

// Every code Google's free endpoint translates into (each probed against it, Nov 2026).
const TARGET =
  'th en zh-CN zh-TW yue ja ko vi id ms tl lo my km hi bn ta te kn ml mr gu pa ur ne si jv su es pt pt-PT fr fr-CA de it nl ' +
  'ru uk pl cs sk hu ro bg hr sr sl bs mk sq el tr az ka hy kk uz mn sv no da fi is et lv lt ca eu gl cy ar fa he af zu sw am ' +
  'as ay bm be bho ceb ny co dv doi eo ee fy gn ht ha haw hmn ig ilo ga gom rw kri ku ckb ky la ln lg lb mai mg mt mi mni-Mtei lus or om ps ' +
  'qu sm sa gd nso st sn sd so tg tt ti ts tk ak ug xh yi yo ab ace ach alz ba ban bbc bci bik br bts btx bua cgg chm cnh crh cv din dov dz ' +
  'fa-AF fj fo fon ff fur gaa hil hrx iba jam kac ktu kg kek lij li lmo ltg luo mad mak ms-Arab mwr min nr new nus oc os pag pam pap pa-Arab ' +
  'rom rn sah sat sg shn scn szl bo tet tiv tpi to tn tum ty udm ve vec war wo yua zap'

const NO_SPACES = new Set(['th', 'ja', 'zh', 'yue', 'lo', 'my', 'km', 'bo', 'dz'])
const SPEECH_CODE: Record<string, string> = { 'zh-CN': 'zh-CN', 'zh-TW': 'zh-TW', 'yue-Hant-HK': 'yue', 'fil-PH': 'tl', 'nb-NO': 'no', 'pt-PT': 'pt-PT', 'fr-CA': 'fr-CA' }
const base = (code: string) => code.split('-')[0]
const make = (key: string, code: string): Lang => ({ key, code, short: base(code).toUpperCase(), chars: NO_SPACES.has(base(code)) })

export const SOURCES: Lang[] = SPEECH.split(' ').map(s => make(s, SPEECH_CODE[s] ?? base(s)))
export const TARGETS: Lang[] = TARGET.split(' ').map(c => make(c, c))

export const langBySpeech = (speech: string) => SOURCES.find(l => l.key === speech) ?? SOURCES[0]
export const langByCode = (code: string) => TARGETS.find(l => l.key === code) ?? TARGETS[0]

/** The speech locale to listen in when a target becomes the source, or undefined when it cannot be recognised. */
export const speechFor = (code: string) => SOURCES.find(l => l.code === code) ?? SOURCES.find(l => base(l.code) === base(code))
/** Translation target matching a source language. */
export const targetFor = (src: Lang) => TARGETS.find(l => l.code === src.code) ?? TARGETS.find(l => base(l.code) === base(src.code)) ?? TARGETS[0]

// Google's detector still answers with a few legacy codes; Cantonese is compared as Chinese.
const ALIAS: Record<string, string> = { iw: 'he', jw: 'jv', fil: 'tl', nb: 'no', yue: 'zh' }
/** Language a code compares as: zh-CN, zh-TW and yue are all zh. */
export const langBase = (code: string) => {
  const b = base(code).toLowerCase()
  return ALIAS[b] ?? b
}

/**
 * Whether a recognized line is in one of the `allowed` base languages. `detected` is Google's guess for the line alone.
 * Scripts settle it where they are reliable: kana is Japanese, Hangul Korean, Thai script Thai, and 4+ kanji with no kana
 * is Chinese (the Japanese recognizer writes Chinese speech as bare kanji).
 */
export function inAllowedLang(text: string, detected: string, allowed: string[]) {
  const han = text.match(/\p{Script=Han}/gu)?.length ?? 0
  const script = /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text)
    ? 'ja'
    : /\p{Script=Hangul}/u.test(text)
      ? 'ko'
      : /\p{Script=Thai}/u.test(text)
        ? 'th'
        : han >= 4
          ? 'zh'
          : undefined
  const lang = script ?? (detected ? langBase(detected) : undefined)
  if (!lang || allowed.includes(lang)) return true
  // ponytail: too short to judge ("gg", "ok", 了解), so let it through rather than drop a real callout.
  return !script && (text.match(/\p{L}/gu)?.length ?? 0) < 4
}

const names = new Map<string, Intl.DisplayNames>()
const display = (locale: string, id: string) => {
  try {
    let d = names.get(locale)
    if (!d) names.set(locale, (d = new Intl.DisplayNames([locale], { type: 'language', fallback: 'none' })))
    return d.of(id)
  } catch {
    return undefined
  }
}
/** Name in the language itself ("日本語") and in the interface language ("ญี่ปุ่น"); browsers supply both. */
// Languages browsers have no name for yet.
const EXTRA: Record<string, string> = {
  alz: 'Alur', bci: 'Baoulé', bts: 'Batak Simalungun', btx: 'Batak Karo', cnh: 'Hakha Chin',
  dov: 'Dombe', hrx: 'Hunsrik', ktu: 'Kituba', kek: 'Qʼeqchiʼ', yua: 'Yucatec Maya',
}
export function langNames(l: Lang, ui: string) {
  const local = display(ui, l.key) ?? display(ui, l.code) ?? EXTRA[l.code] ?? l.code
  const native = display(l.key, l.key) ?? display(l.code, l.code) ?? local
  return { native, local }
}

const th = {
  tagline: 'ซับแปลเสียงเพื่อนต่างชาติ',
  source: 'แหล่งเสียง',
  sourceSystem: 'เสียงในคอม',
  sourceMic: 'ไมค์',
  from: 'เพื่อนพูด',
  to: 'แปลเป็น',
  start: 'เริ่มฟัง',
  stop: 'หยุด',
  overlay: 'ซับลอย',
  overlayClose: 'ปิดซับลอย',
  settings: 'ตั้งค่า',
  uiLang: 'ภาษาหน้าเว็บ',
  colTime: 'เวลา',
  colRoute: 'ภาษา',
  colText: 'คำแปล',
  colStatus: 'สถานะ',
  boardTitle: 'Arrivals',
  boardIdle: 'พร้อม',
  boardListening: 'กำลังฟัง',
  stListen: 'กำลังฟัง',
  stPending: 'กำลังแปล',
  stDone: 'แปลแล้ว',
  stRefining: 'AI เกลา',
  stRefined: 'AI',
  stError: 'แปลไม่ได้',
  step1: 'เลือก “เสียงในคอม” แล้วเลือกภาษาที่เพื่อนพูด',
  step2: 'กด “เริ่มฟัง” เลือก “ทั้งหน้าจอ” (หรือแท็บ Discord) ติ๊ก “แชร์เสียงของระบบ” แล้วกดแชร์',
  step3: 'กด “ซับลอย” ให้คำแปลลอยบนเกม เกมต้องเป็นโหมด Borderless หรือ Windowed',
  stepStatus: 'ขั้นที่',
  privacy: 'เสียงถูกถอดเป็นข้อความโดยบริการเสียงของเบราว์เซอร์ ข้อความถูกส่งไปแปลตามตัวแปลที่เลือก เว็บนี้ไม่มีเซิร์ฟเวอร์และไม่เก็บอะไรไว้',
  author: 'สร้างโดย',
  // settings
  engine: 'ตัวแปล',
  engineGoogle: 'Google — ฟรี ไม่ต้องตั้งค่า',
  engineGoogleHint: 'แปลทันทีทุกประโยค แนบประโยคก่อนหน้าไปเป็นบริบท',
  engineChrome: 'Chrome AI — ฟรี รันในเครื่อง',
  engineChromeHint: 'Google แปลก่อน แล้ว AI ในเครื่องคุณเกลาให้เข้าบริบท ไม่ต้องมี key ไม่ส่งข้อความออกไปไหน',
  engineClaude: 'Claude — ใช้ API key ของคุณเอง',
  engineClaudeHint: 'Google แปลก่อน แล้ว Claude เกลาโดยอ่านบทสนทนาล่าสุด เข้าใจศัพท์เกมและแก้คำที่ถอดเสียงผิด',
  chromeState: {
    unsupported: 'เบราว์เซอร์นี้ยังไม่มี Chrome AI (ต้องใช้ Chrome รุ่นใหม่บนคอม)',
    unavailable: 'Chrome AI ยังไม่รองรับคู่ภาษานี้ในเครื่องนี้ ระบบจะใช้ Google แทน',
    downloadable: 'ต้องดาวน์โหลดโมเดลครั้งแรก (หลาย GB ใช้เวลาสักครู่)',
    downloading: 'กำลังดาวน์โหลดโมเดล…',
    available: 'พร้อมใช้งาน',
  },
  chromePrepare: 'เตรียม Chrome AI',
  keyLabel: 'Claude API key (ไม่บังคับ)',
  keyPlaceholder: 'sk-ant-…',
  keyShow: 'แสดง key',
  keyHide: 'ซ่อน key',
  keyExplain: [
    'ช่องนี้ไม่บังคับ เว็บใช้ฟรีได้โดยไม่ต้องใส่อะไร',
    'ใส่ key ของคุณเอง ไม่ใช่ของเว็บนี้ เว็บนี้ไม่มี key และไม่มีเซิร์ฟเวอร์',
    'key ถูกเก็บในเบราว์เซอร์เครื่องนี้เท่านั้น และส่งตรงไปที่ api.anthropic.com ตอนแปล',
    'ค่าใช้จ่ายคิดกับบัญชี Anthropic ของคุณ สร้าง key และตั้งวงเงินได้ที่ platform.claude.com',
  ],
  keyInvalid: 'key ต้องขึ้นต้นด้วย sk-ant- (ถ้าเห็นจุดเต็มช่องโดยไม่ได้พิมพ์ อาจเป็นรหัสผ่านที่เบราว์เซอร์เติมให้ ให้ลบออก)',
  keyRemember: 'จำ key ในเครื่องนี้ (ปิด = ลืมเมื่อปิดแท็บ)',
  keyClear: 'ลบ key',
  model: 'โมเดล',
  modelHaiku: 'Haiku 5.5 — เร็วที่สุด เหมาะกับแปลสด',
  modelSonnet: 'Sonnet 5.5 — สมดุล',
  modelOpus: 'Opus 5.5 — แม่นที่สุด ช้ากว่า',
  display: 'การแสดงผล',
  fontSize: 'ขนาดซับ',
  showSrc: 'แสดงข้อความต้นฉบับใต้คำแปล',
  clear: 'ล้างบอร์ด',
  save: 'บันทึกเป็น .txt',
  statsViews: 'ยอดเข้าชม',
  statsLike: 'กดถูกใจเว็บนี้',
  statsLiked: 'ถูกใจแล้ว ขอบคุณ',
  langOnly: 'ฟังเฉพาะภาษาที่เลือก',
  langOnlyTitle: 'ภาษาที่รับ',
  langOnlyHint: 'ข้อความที่ไม่ใช่ภาษาที่เลือกจะถูกทิ้ง ไม่ขึ้นบอร์ด ซับลอย และ OBS เช่น ฟังเพื่อนญี่ปุ่นโดยตัดเสียงพากย์จีนในเกม ระบบถอดเสียงด้วยภาษา “เพื่อนพูด” เท่านั้น ภาษาเพิ่มเติมจึงถูกรับแต่ถอดได้แม่นน้อยกว่า',
  langExtras: 'ภาษาเพิ่มเติมที่รับ',
  langExtrasNone: 'ไม่มี (เฉพาะภาษาเพื่อนพูด)',
  limits: 'ข้อจำกัด: ถ้าหลายคนพูดพร้อมกัน ระบบแยกเสียงแต่ละคนไม่ได้ ข้อความอาจปนกัน และเกมแบบ Fullscreen จะบังซับลอย',
  swap: 'สลับภาษา',
  swapNo: 'สลับไม่ได้ เพราะภาษาปลายทางนี้ถอดเสียงไม่ได้',
  langSearch: 'พิมพ์เพื่อค้นหา',
  langNone: 'ไม่พบภาษานี้',
  github: 'ซอร์สโค้ดบน GitHub',
  donate: 'โดเนท',
  donateHint: 'เปิดหน้าชำระเงินของ NamPayments ในแท็บใหม่ บิลถูกสร้างและตรวจที่ NamPayments เว็บนี้ไม่เห็นข้อมูลการจ่ายเงินของคุณ',
  obs: 'OBS (ซับในสตรีม)',
  obsSteps: [
    'ใน OBS ไปที่ Tools → WebSocket Server Settings ติ๊ก Enable WebSocket server แล้วกด Show Connect Info เพื่อดูพอร์ตและรหัสผ่าน',
    'ใส่พอร์ตและรหัสผ่านด้านล่าง แล้วเปิด “ส่งซับไป OBS” ถ้า Chrome ถามสิทธิ์เข้าถึงอุปกรณ์ในเครือข่าย ให้กดอนุญาต',
    'กด “คัดลอก URL” แล้วใน OBS เพิ่ม Source แบบ Browser วาง URL ตั้งกว้าง 1920 สูง 400 วางไว้ด้านล่างของจอ',
  ],
  obsEnable: 'ส่งซับไป OBS',
  obsPort: 'พอร์ต',
  obsPassword: 'รหัสผ่าน WebSocket ของ OBS',
  obsLines: 'จำนวนบรรทัด',
  obsSize: 'ขนาดซับใน OBS',
  obsCopy: 'คัดลอก URL',
  obsCopied: 'คัดลอก URL ของ Browser Source แล้ว',
  obsNote: 'รหัสผ่านอยู่ในเครื่องคุณเท่านั้น คือในเบราว์เซอร์นี้และใน URL ของ Browser Source ใน OBS อย่าแชร์ URL นั้นให้ใคร',
  obsState: {
    off: 'ปิดอยู่',
    connecting: 'กำลังเชื่อมต่อ OBS…',
    on: 'เชื่อมต่อ OBS แล้ว',
    auth: 'รหัสผ่านไม่ถูกต้อง',
    error: 'ต่อ OBS ไม่ได้ เปิด OBS และ WebSocket server แล้วหรือยัง (จะลองใหม่ให้)',
  },
  noise: 'เสียงเกมกลบเสียงเพื่อน',
  noiseTips: [
    'ได้ผลดีที่สุด: เปิด Discord บนเว็บ แล้วตอนแชร์ให้เลือกแท็บ Discord และติ๊ก “แชร์เสียงแท็บ” ระบบจะได้ยินแค่เสียงเพื่อน ไม่มีเสียงเกม',
    'ใช้ Discord แอป: ติดตั้งสายเสมือน (เช่น VB-Cable) ตั้ง Output ใน Discord เป็น CABLE Input แล้วในเว็บนี้เลือกแหล่งเสียง “ไมค์” และเลือกอุปกรณ์ CABLE Output ด้านล่าง ถ้าอยากได้ยินเพื่อนเองด้วย ให้เปิด “ฟังอุปกรณ์นี้” ของ CABLE Output ในตั้งค่าเสียงของ Windows',
    'ง่ายที่สุด: เปิด Volume Mixer ของ Windows แล้วลดเสียงเกมให้เบากว่า Discord ระบบรับเสียงหลังผ่าน mixer เสียงเพื่อนจึงเด่นขึ้น',
  ],
  noiseFilter: 'กรองให้เหลือช่วงเสียงพูด',
  noiseFilterHint: 'ตัดเสียงทุ้ม (เครื่องยนต์ ระเบิด) และเสียงที่แหลมเกินเสียงคน กดเสียงปืนที่ดังกระชาก และดันเสียงคนที่พูดเบาให้ดังขึ้น',
  noiseAi: 'ลดเสียงรบกวนด้วย AI (RNNoise)',
  noiseAiHint: 'โมเดลเล็กที่รันในเครื่อง แยกเสียงคนออกจากเสียงอื่น ช่วยมากกับวอยซ์ในเกม ใช้ CPU เพิ่มเล็กน้อย ถ้าคำแปลแย่ลงให้ปิด',
  noiseApply: 'การตั้งค่าส่วนนี้มีผลตอนกด “เริ่มฟัง” ครั้งถัดไป',
  device: 'อุปกรณ์รับเสียง (แหล่งเสียง “ไมค์”)',
  deviceDefault: 'ค่าเริ่มต้นของระบบ',
  deviceUnnamed: 'อุปกรณ์',
  deviceHint: 'ถ้ายังไม่เห็นชื่ออุปกรณ์ ให้กดเริ่มฟังด้วย “ไมค์” หนึ่งครั้งเพื่ออนุญาตก่อน',
  // errors
  err: {
    cancelled: 'ยกเลิกการแชร์ กด “เริ่มฟัง” อีกครั้งเมื่อพร้อม',
    noAudio: 'ไม่มีเสียงมาด้วย ตอนแชร์ต้องติ๊ก “แชร์เสียงของระบบ” หรือ “แชร์เสียงแท็บ”',
    notAllowed: 'ไม่ได้รับอนุญาตให้ใช้เสียง กดไอคอนกุญแจข้าง URL แล้วอนุญาต',
    network: 'เชื่อมต่อบริการถอดเสียงไม่ได้ ตรวจอินเทอร์เน็ต ระบบจะลองใหม่ให้',
    language: 'ภาษานี้ถอดเสียงไม่ได้ในเบราว์เซอร์นี้',
    browser: 'เบราว์เซอร์นี้ถอดเสียงไม่ได้ ใช้ Chrome หรือ Edge บนคอม',
    pip: 'เปิดซับลอยไม่ได้ ใช้ Chrome หรือ Edge รุ่นใหม่',
    claudeAuth: 'Claude ปฏิเสธ key นี้ กลับไปใช้ Google ให้ก่อน',
    claudeRate: 'Claude ติดลิมิต ใช้คำแปล Google ชั่วคราว',
    claudeNetwork: 'ต่อ Claude ไม่ได้ ใช้คำแปล Google ชั่วคราว',
    googleRate: 'Google จำกัดจำนวนครั้งชั่วคราว บางบรรทัดอาจแปลไม่ได้',
    googleNetwork: 'ต่อ Google Translate ไม่ได้ ตรวจอินเทอร์เน็ต',
    chrome: 'Chrome AI ทำงานไม่สำเร็จ ใช้คำแปล Google แทน',
    filter: 'เปิดตัวกรองเสียงไม่ได้ ใช้เสียงเดิมแทน',
  },
  stopped: 'หยุดแชร์เสียงแล้ว',
}

export type Strings = typeof th

const en: Strings = {
  tagline: 'Live subtitles for your foreign friends',
  source: 'Audio source',
  sourceSystem: 'PC audio',
  sourceMic: 'Mic',
  from: 'Friend speaks',
  to: 'Translate to',
  start: 'Start',
  stop: 'Stop',
  overlay: 'Overlay',
  overlayClose: 'Close overlay',
  settings: 'Settings',
  uiLang: 'Interface language',
  colTime: 'Time',
  colRoute: 'Route',
  colText: 'Translation',
  colStatus: 'Status',
  boardTitle: 'Arrivals',
  boardIdle: 'Ready',
  boardListening: 'Listening',
  stListen: 'Listening',
  stPending: 'Translating',
  stDone: 'Translated',
  stRefining: 'AI refining',
  stRefined: 'AI',
  stError: 'Failed',
  step1: 'Choose “PC audio” and the language your friend speaks',
  step2: 'Press Start, pick “Entire screen” (or the Discord tab), tick “Share system audio”, then Share',
  step3: 'Press Overlay to float subtitles over your game (borderless or windowed mode)',
  stepStatus: 'Step',
  privacy: 'Your browser’s speech service turns audio into text, and the text goes to the translator you pick. This site has no server and stores nothing.',
  author: 'Made by',
  engine: 'Translator',
  engineGoogle: 'Google — free, no setup',
  engineGoogleHint: 'Translates every line instantly, with the previous line attached as context.',
  engineChrome: 'Chrome AI — free, on your device',
  engineChromeHint: 'Google translates first, then the AI built into your browser refines it in context. No key, nothing leaves your PC.',
  engineClaude: 'Claude — your own API key',
  engineClaudeHint: 'Google translates first, then Claude refines it using the recent conversation, game slang and misheard words.',
  chromeState: {
    unsupported: 'This browser has no Chrome AI yet (needs a recent desktop Chrome).',
    unavailable: 'Chrome AI does not support this language pair on this device yet; Google is used instead.',
    downloadable: 'The model downloads on first use (several GB, takes a while).',
    downloading: 'Downloading the model…',
    available: 'Ready',
  },
  chromePrepare: 'Prepare Chrome AI',
  keyLabel: 'Claude API key (optional)',
  keyPlaceholder: 'sk-ant-…',
  keyShow: 'Show key',
  keyHide: 'Hide key',
  keyExplain: [
    'Optional. The site is free to use without entering anything.',
    'Use your own key, not this site’s. This site has no key and no server.',
    'The key stays in this browser only and is sent straight to api.anthropic.com when translating.',
    'Usage is billed to your Anthropic account. Create a key and set a spend limit at platform.claude.com.',
  ],
  keyInvalid: 'Keys start with sk-ant- (dots you did not type may be a password your browser autofilled; delete it).',
  keyRemember: 'Remember the key on this device (off = forget when the tab closes)',
  keyClear: 'Remove key',
  model: 'Model',
  modelHaiku: 'Haiku 5.5 — fastest, best for live use',
  modelSonnet: 'Sonnet 5.5 — balanced',
  modelOpus: 'Opus 5.5 — most accurate, slower',
  display: 'Display',
  fontSize: 'Subtitle size',
  showSrc: 'Show the original under each translation',
  clear: 'Clear board',
  save: 'Save as .txt',
  swap: 'Swap languages',
  swapNo: 'Cannot swap: this target language cannot be transcribed',
  langSearch: 'Type to search',
  langNone: 'No such language',
  github: 'Source code on GitHub',
  donate: 'Donate',
  donateHint: 'Opens the NamPayments checkout in a new tab. NamPayments creates and checks the bill; this site never sees your payment details.',
  obs: 'OBS (stream subtitles)',
  obsSteps: [
    'In OBS open Tools → WebSocket Server Settings, tick Enable WebSocket server, then Show Connect Info for the port and password.',
    'Enter the port and password below and turn on “Send to OBS”. If Chrome asks to access devices on your local network, allow it.',
    'Press “Copy URL”, then in OBS add a Browser source, paste the URL, set width 1920 and height 400, and place it at the bottom.',
  ],
  obsEnable: 'Send to OBS',
  obsPort: 'Port',
  obsPassword: 'OBS WebSocket password',
  obsLines: 'Lines',
  obsSize: 'OBS subtitle size',
  obsCopy: 'Copy URL',
  obsCopied: 'Browser Source URL copied',
  obsNote: 'The password stays on your PC: in this browser and in the Browser Source URL inside OBS. Do not share that URL.',
  obsState: {
    off: 'Off',
    connecting: 'Connecting to OBS…',
    on: 'Connected to OBS',
    auth: 'Wrong password',
    error: 'Cannot reach OBS. Is OBS open with the WebSocket server on? Retrying.',
  },
  noise: 'Game sounds drown out friends',
  noiseTips: [
    'Best: open Discord in the browser, and when sharing pick the Discord tab and tick “Share tab audio”. Only your friends are heard, no game sound.',
    'Discord app: install a virtual cable (e.g. VB-Cable), set Discord’s Output to CABLE Input, then here choose the “Mic” source and the CABLE Output device below. To hear friends yourself, turn on “Listen to this device” for CABLE Output in Windows sound settings.',
    'Easiest: open the Windows Volume Mixer and turn the game down below Discord. Capture happens after the mixer, so voices stand out.',
  ],
  noiseFilter: 'Keep only the speech band',
  noiseFilterHint: 'Cuts rumble (engines, explosions) and sounds above the voice range, flattens sudden gunfire, and lifts quiet talkers.',
  noiseAi: 'AI noise suppression (RNNoise)',
  noiseAiHint: 'A small on-device model that separates voices from other sound. Helps most with in-game voice chat; uses a little more CPU. Turn it off if translations get worse.',
  noiseApply: 'These settings apply the next time you press Start.',
  device: 'Input device (for the “Mic” source)',
  deviceDefault: 'System default',
  deviceUnnamed: 'Device',
  deviceHint: 'Device names appear after you start once with the “Mic” source and allow access.',
  statsViews: 'Views',
  statsLike: 'Like this site',
  statsLiked: 'Liked, thank you',
  langOnly: 'Only languages I picked',
  langOnlyTitle: 'Accepted languages',
  langOnlyHint: 'Lines in other languages are dropped: not on the board, overlay or OBS. For example, follow a Japanese streamer and skip the Chinese game voices. Recognition listens in the “Friend speaks” language only, so extra languages are accepted but recognized less accurately.',
  langExtras: 'Also accept',
  langExtrasNone: 'None (friend’s language only)',
  limits: 'Limits: overlapping voices cannot be separated and may merge into one line; exclusive-fullscreen games cover the overlay.',
  err: {
    cancelled: 'Sharing was cancelled. Press Start again when ready.',
    noAudio: 'No audio came through. Tick “Share system audio” or “Share tab audio” when sharing.',
    notAllowed: 'Audio permission was denied. Click the lock icon next to the URL and allow it.',
    network: 'Could not reach the speech service. Check your connection; retrying.',
    language: 'This browser cannot transcribe that language.',
    browser: 'This browser cannot transcribe speech. Use Chrome or Edge on desktop.',
    pip: 'The overlay could not open. Use a recent Chrome or Edge.',
    claudeAuth: 'Claude rejected this key. Falling back to Google.',
    claudeRate: 'Claude is rate limited; showing Google translations for now.',
    claudeNetwork: 'Could not reach Claude; showing Google translations for now.',
    googleRate: 'Google is rate limiting for a moment; some lines may fail.',
    googleNetwork: 'Could not reach Google Translate. Check your connection.',
    chrome: 'Chrome AI failed; showing Google translations instead.',
    filter: 'The audio filter could not start; using the raw audio.',
  },
  stopped: 'Audio sharing stopped.',
}

export const STRINGS = { th, en }
export type UiLang = keyof typeof STRINGS
