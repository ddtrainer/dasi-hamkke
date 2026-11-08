import { create } from 'zustand'
import type { Memorial } from './types'
import { api } from './api'
import { resumed } from './resume'
import { loadPet, loadPets, savePets, loadCompanion, saveCompanion, type PetProfile } from './pet'

export type Screen = 'landing' | 'world' | 'flat'
export type Quality = 'high' | 'low'
export type TimeOfDay = 'day' | 'sunset' | 'night'
export type AvatarId = 'girl' | 'boy'
function loadAvatar(): AvatarId {
  try { const v = localStorage.getItem('dasi.avatar'); return v === 'boy' ? 'boy' : 'girl' } catch { return 'girl' }
}
export const IS_MOBILE = typeof navigator !== 'undefined' && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)

interface MarketSave { dogOutfit: string | null; goods: string[]; treats: number; tickets: number; owned: string[]; missions: Record<string, string>; ribbons: number }
function loadMarket(): MarketSave {
  try {
    const m = JSON.parse(localStorage.getItem('dasi.market') ?? '{}')
    const goods: string[] = Array.isArray(m.goods) ? m.goods : []
    const dogOutfit: string | null = m.dogOutfit ?? null
    // items worn before missions existed stay owned
    const owned: string[] = Array.isArray(m.owned) ? m.owned : [...goods, ...(dogOutfit ? [dogOutfit] : [])]
    return { dogOutfit, goods, treats: m.treats ?? 0, tickets: m.tickets ?? 0, owned, missions: m.missions && typeof m.missions === 'object' ? m.missions : {}, ribbons: m.ribbons ?? 0 }
  } catch { return { dogOutfit: null, goods: [], treats: 0, tickets: 0, owned: [], missions: {}, ribbons: 0 } }
}
export function saveMarket() {
  const { dogOutfit, goods, treats, tickets, owned, missions, ribbons } = useStore.getState()
  try { localStorage.setItem('dasi.market', JSON.stringify({ dogOutfit, goods, treats, tickets, owned, missions, ribbons })) } catch { /* ignore */ }
}

function loadRested(): string[] {
  try { const r = JSON.parse(localStorage.getItem('dasi.rested') ?? '[]'); return Array.isArray(r) ? r.filter((x) => typeof x === 'string') : [] } catch { return [] }
}

interface S {
  screen: Screen
  phase: 'intro' | 'play'
  splash: boolean
  quality: Quality
  tod: TimeOfDay
  sfx: boolean
  music: boolean
  userId: string
  memorials: Memorial[]
  flowerCounts: Record<string, number>
  candleCounts: Record<string, number>
  openId: string | null
  registerSlot: number | null | undefined // undefined = closed, null = automatic slot
  nearSlot: number | null
  nearMarket: boolean
  marketOpen: boolean
  dogOutfit: string | null
  goods: string[]
  treats: number
  tickets: number // earned by missions; 1 ticket = 1 item
  owned: string[]
  missions: Record<string, string> // mission id -> KST day it was last completed
  ribbons: number // wish ribbons hung in the memory forest
  nearPlace: string | null
  pet: PetProfile // the default companion dog's look (for visitors without a shrine dog)
  pets: Record<string, PetProfile> // each memorial's dog, by memorial id
  companionId: string | null // memorial whose dog is walking with the visitor
  petOpen: boolean
  lapUi: { status: 'idle' | 'asking' | 'denied' | 'none' | 'run' | 'win' | 'tapdone' | 'fail'; mode: 'sensor' | 'tap'; steps: number; sec: number } // island lap run
  nearNeighbor: { id: string; name: string } | null // someone close enough to greet
  greetNote: { ids: string[]; names: string[]; text: string; t: number } | null // 'X greeted you' note
  avatar: AvatarId // the person the visitor plays
  avatarFor: 'enter' | 'change' | null // character chooser: shown when entering the island, or reopened from the HUD
  setAvatar: (a: AvatarId) => void
  rested: string[] // memorials whose dog has been called out and sent back: it then waits beside the photo
  markRested: (id: string) => void
  petTarget: string | null // memorial being edited in the customiser (null = the default dog)
  setPetFor: (id: string, p: PetProfile) => void
  setCompanion: (id: string | null) => void
  menuOpen: boolean
  toast: string | null
  set: (p: Partial<S>) => void
  refresh: () => Promise<void>
  say: (t: string) => void
}
let toastT: number | undefined
export const useStore = create<S>((set, get) => ({
  screen: resumed?.screen === 'world' ? 'world' : 'landing', phase: resumed?.screen === 'world' ? 'play' : 'intro', splash: false, quality: IS_MOBILE ? 'low' : 'high', tod: 'day', sfx: true, music: false,
  userId: '', memorials: [], flowerCounts: {}, candleCounts: {}, openId: null, registerSlot: resumed?.screen === 'world' && resumed.reg ? resumed.regSlot : undefined, nearSlot: null, nearMarket: false, nearPlace: null, pet: loadPet(), pets: loadPets(), companionId: loadCompanion(), petOpen: false, lapUi: { status: 'idle', mode: 'sensor', steps: 0, sec: 0 }, nearNeighbor: null, greetNote: null, avatar: loadAvatar(), avatarFor: null, petTarget: null, rested: loadRested(), marketOpen: false, ...loadMarket(), menuOpen: false, toast: null,
  set: (p) => set(p),
  setPetFor: (id, p) => { const pets = { ...get().pets, [id]: p }; savePets(pets); set({ pets }) },
  markRested: (id) => { const rested = [...new Set([...get().rested, id])]; try { localStorage.setItem('dasi.rested', JSON.stringify(rested)) } catch { /* ignore */ } set({ rested }) },
  setAvatar: (a) => { try { localStorage.setItem('dasi.avatar', a) } catch { /* ignore */ } set({ avatar: a }) },
  setCompanion: (id) => { saveCompanion(id); set({ companionId: id }) },
  say: (t) => { set({ toast: t }); clearTimeout(toastT); toastT = window.setTimeout(() => get().set({ toast: null }), 3200) },
  refresh: async () => {
    try {
      const [userId, memorials, flowerCounts, candleCounts] = await Promise.all([api.userId(), api.list(), api.flowerCounts(), api.candleCounts()])
      set({ userId, memorials, flowerCounts, candleCounts })
    } catch (e) { get().say((e as Error).message) }
  },
}))

if (import.meta.env.DEV) (window as unknown as { __store: typeof useStore }).__store = useStore
