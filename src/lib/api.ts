import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Api, Memorial, Tribute, Visibility } from './types'
import { LIMITS } from './types'
import { blobToDataUrl } from './image'
import { SLOTS } from '../world/terrain'

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2))
// eslint-disable-next-line no-control-regex
const clean = (s: string, n: number) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n)

// ---------------- demo memorials (always public, owned by "demo") ----------------
const DEMO: Memorial[] = [
  { id: 'demo-1', ownerId: 'demo', petName: '초코', species: '강아지', birthDate: '2008-03-14', passedDate: '2022-11-02', message: '초코야, 가장 따뜻했던 내 첫 친구. 거기서도 마음껏 뛰어놀고 있지?', photoUrl: null, visibility: 'public', slot: 0, createdAt: '2022-11-10' },
  { id: 'demo-2', ownerId: 'demo', petName: '보리', species: '고양이', birthDate: '2010-05-01', passedDate: '2023-04-19', message: '햇볕 좋은 창가에서 졸던 너의 모습을 매일 기억해. 고마웠어, 보리야.', photoUrl: null, visibility: 'public', slot: 3, createdAt: '2023-04-25' },
  { id: 'demo-3', ownerId: 'demo', petName: '하늘', species: '강아지', birthDate: '2012-09-09', passedDate: '2024-02-07', message: '함께한 모든 산책이 선물이었어. 다시 만나는 날까지 안녕.', photoUrl: null, visibility: 'public', slot: 6, createdAt: '2024-02-14' },
]

// ---------------- local (browser-only) implementation ----------------
interface LocalDb { userId: string; memorials: Memorial[]; tributes: Tribute[]; v?: number }
// Embedded viewers (sandboxed frames, phone webviews) may block localStorage or drop the page from memory. Keep every save in
// several places — localStorage, sessionStorage and window.name (which survives a reload of the same tab) — and read the newest.
const KEY = 'dasi.v1', NAME = 'dasi-db:'
let mem: LocalDb | null = null
const readers: Array<() => string | null> = [
  () => localStorage.getItem(KEY),
  () => sessionStorage.getItem(KEY),
  () => (window.name.startsWith(NAME) ? window.name.slice(NAME.length) : null),
]
function loadDb(): LocalDb {
  let best: LocalDb | null = null
  for (const rd of readers) {
    try {
      const raw = rd()
      if (!raw) continue
      const d = JSON.parse(raw) as LocalDb
      if (!best || (d.v ?? 0) > (best.v ?? 0)) best = d
    } catch { /* this storage is blocked or holds junk */ }
  }
  if (mem && (!best || (mem.v ?? 0) > (best.v ?? 0))) best = mem
  return best ?? (mem = { userId: uid(), memorials: [], tributes: [] })
}
function saveDb(db: LocalDb) {
  db.v = Date.now()
  mem = db
  const s = JSON.stringify(db)
  let saved = 0
  try { localStorage.setItem(KEY, s); saved++ } catch { /* blocked or full */ }
  try { sessionStorage.setItem(KEY, s); saved++ } catch { /* blocked or full */ }
  try { if (!window.name || window.name.startsWith(NAME)) { window.name = NAME + s; saved++ } } catch { /* ignore */ }
  if (!saved) throw new Error('이 화면에서는 저장이 막혀 있어요. 사진 용량을 줄이거나 폰 브라우저에서 열어 주세요.')
}
/** Calendar day in Korea (a candle burns for one day: it goes out at midnight KST). */
export const kstDay = (d: string | Date = new Date()) => new Date(d).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
export const ALREADY_LIT = '오늘은 이미 촛불을 켰어요. 내일 다시 켤 수 있어요.'
const localApi: Api = {
  mode: 'local',
  async userId() { const db = loadDb(); saveDb(db); return db.userId },
  async list() {
    const db = loadDb()
    // privacy: only the owner's own private memorials are returned
    return [...DEMO, ...db.memorials.filter((m) => m.visibility === 'public' || m.ownerId === db.userId)]
  },
  async create(m, preferred) {
    const db = loadDb()
    const used = new Set([...DEMO, ...db.memorials].map((x) => x.slot))
    const slot = preferred !== undefined && !used.has(preferred) ? preferred : SLOTS.findIndex((s) => !used.has(s.index))
    if (slot < 0) throw new Error('모든 분향소 자리가 가득 찼어요.')
    const rec: Memorial = {
      id: uid(), ownerId: db.userId, petName: clean(m.petName, LIMITS.name), species: clean(m.species, 12),
      birthDate: m.birthDate, passedDate: m.passedDate, message: clean(m.message, LIMITS.message),
      photoUrl: m.photo ? await blobToDataUrl(m.photo) : null, visibility: m.visibility, slot, createdAt: new Date().toISOString(),
    }
    db.memorials.push(rec); saveDb(db)
    return rec
  },
  async setVisibility(id, v) {
    const db = loadDb(); const m = db.memorials.find((x) => x.id === id && x.ownerId === db.userId)
    if (!m) throw new Error('권한이 없어요.')
    m.visibility = v; saveDb(db)
  },
  async remove(id) {
    const db = loadDb()
    if (!db.memorials.some((x) => x.id === id && x.ownerId === db.userId)) throw new Error('권한이 없어요.')
    db.memorials = db.memorials.filter((x) => x.id !== id)
    db.tributes = db.tributes.filter((t) => t.memorialId !== id)
    saveDb(db)
  },
  async tributes(mid) {
    const db = loadDb()
    const m = [...DEMO, ...db.memorials].find((x) => x.id === mid)
    // letters are only visible to the memorial owner and to their author
    return db.tributes.filter((t) => t.memorialId === mid && (t.kind !== 'letter' || t.authorId === db.userId || m?.ownerId === db.userId))
  },
  async flowerCounts() {
    const db = loadDb(); const o: Record<string, number> = {}
    for (const t of db.tributes) if (t.kind === 'flowers') o[t.memorialId] = (o[t.memorialId] ?? 0) + 1
    return o
  },
  async candleCounts() {
    const db = loadDb(); const o: Record<string, number> = {}
    const today = kstDay()
    for (const t of db.tributes) if (t.kind === 'candle' && kstDay(t.createdAt) === today) o[t.memorialId] = (o[t.memorialId] ?? 0) + 1
    return o
  },
  async addTribute(mid, kind, body) {
    const db = loadDb()
    if (kind === 'candle' && db.tributes.some((t) => t.kind === 'candle' && t.memorialId === mid && t.authorId === db.userId && kstDay(t.createdAt) === kstDay())) throw new Error(ALREADY_LIT)
    const t: Tribute = { id: uid(), memorialId: mid, authorId: db.userId, kind, body: clean(body, LIMITS.letter), createdAt: new Date().toISOString() }
    db.tributes.push(t); saveDb(db); return t
  },
}

// ---------------- Supabase implementation (see supabase/schema.sql) — NOT verified against a live project ----------------
function supabaseApi(url: string, key: string): Api {
  const sb: SupabaseClient = createClient(url, key)
  let userP: Promise<string> | null = null
  const userId = () => (userP ||= (async () => {
    const { data } = await sb.auth.getSession()
    if (data.session) return data.session.user.id
    const r = await sb.auth.signInAnonymously()
    if (r.error || !r.data.user) throw new Error('로그인에 실패했어요: ' + (r.error?.message ?? ''))
    return r.data.user.id
  })())
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toM = (r: any, photoUrl: string | null): Memorial => ({
    id: r.id, ownerId: r.owner_id, petName: r.pet_name, species: r.species, birthDate: r.birth_date ?? '', passedDate: r.passed_date ?? '',
    message: r.message, photoUrl, visibility: r.visibility, slot: r.slot, createdAt: r.created_at,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toT = (r: any): Tribute => ({ id: r.id, memorialId: r.memorial_id, authorId: r.author_id, kind: r.kind, body: r.body, createdAt: r.created_at })
  return {
    mode: 'supabase',
    userId,
    async list() {
      await userId()
      const { data, error } = await sb.from('memorials').select('*').order('created_at')
      if (error) throw new Error(error.message)
      const paths = (data ?? []).map((r) => r.photo_path).filter(Boolean) as string[]
      const urls: Record<string, string> = {}
      if (paths.length) {
        const s = await sb.storage.from('pet-photos').createSignedUrls(paths, 3600)
        s.data?.forEach((x) => { if (x.path && x.signedUrl) urls[x.path] = x.signedUrl })
      }
      return [...DEMO, ...(data ?? []).map((r) => toM(r, r.photo_path ? urls[r.photo_path] ?? null : null))]
    },
    async create(m, preferred) {
      const me = await userId()
      let photo_path: string | null = null
      if (m.photo) {
        photo_path = `${me}/${uid()}.jpg`
        const up = await sb.storage.from('pet-photos').upload(photo_path, m.photo, { contentType: 'image/jpeg', upsert: false })
        if (up.error) throw new Error('사진 업로드 실패: ' + up.error.message)
      }
      const taken = new Set(DEMO.map((d) => d.slot))
      const { data: existing } = await sb.from('memorials').select('slot')
      existing?.forEach((r) => taken.add(r.slot))
      const order = [preferred, ...SLOTS.map((s) => s.index)].filter((x): x is number => x !== undefined && !taken.has(x))
      for (const slot of order) {
        const { data, error } = await sb.from('memorials').insert({
          owner_id: me, pet_name: clean(m.petName, LIMITS.name), species: clean(m.species, 12),
          birth_date: m.birthDate || null, passed_date: m.passedDate || null, message: clean(m.message, LIMITS.message),
          photo_path, visibility: m.visibility, slot,
        }).select('*').single()
        if (!error && data) {
          const s = photo_path ? await sb.storage.from('pet-photos').createSignedUrl(photo_path, 3600) : null
          return toM(data, s?.data?.signedUrl ?? null)
        }
        if (error && error.code !== '23505') throw new Error(error.message) // 23505 = slot taken (maybe privately): try next
      }
      throw new Error('빈 분향소 자리를 찾지 못했어요.')
    },
    async setVisibility(id, v: Visibility) {
      const { error } = await sb.from('memorials').update({ visibility: v }).eq('id', id)
      if (error) throw new Error(error.message)
    },
    async remove(id) {
      const { error } = await sb.from('memorials').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    async tributes(mid) {
      if (mid.startsWith('demo-')) return []
      const { data, error } = await sb.from('tributes').select('*').eq('memorial_id', mid).order('created_at')
      if (error) throw new Error(error.message)
      return (data ?? []).map(toT)
    },
    async flowerCounts() {
      const { data } = await sb.from('tribute_flower_counts').select('*')
      const o: Record<string, number> = {}
      data?.forEach((r) => { o[r.memorial_id] = r.n })
      return o
    },
    async candleCounts() {
      const { data } = await sb.from('tribute_candle_counts').select('*')
      const o: Record<string, number> = {}
      data?.forEach((r) => { o[r.memorial_id] = r.n })
      return o
    },
    async addTribute(mid, kind, body) {
      const me = await userId()
      const { data, error } = await sb.from('tributes').insert({ memorial_id: mid, author_id: me, kind, body: clean(body, LIMITS.letter) }).select('*').single()
      if (error) throw new Error(error.code === '23505' ? ALREADY_LIT : error.message)
      return toT(data)
    },
  }
}

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY_ = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const api: Api = URL_ && KEY_ ? supabaseApi(URL_, KEY_) : localApi
