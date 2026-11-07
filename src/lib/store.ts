import { create } from 'zustand'
import type { Memorial } from './types'
import { api } from './api'
import { resumed } from './resume'

export type Screen = 'landing' | 'world' | 'flat'
export type Quality = 'high' | 'low'
export type TimeOfDay = 'day' | 'sunset' | 'night'
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
  menuOpen: boolean
  toast: string | null
  set: (p: Partial<S>) => void
  refresh: () => Promise<void>
  say: (t: string) => void
}
let toastT: number | undefined
export const useStore = create<S>((set, get) => ({
  screen: resumed?.screen === 'world' ? 'world' : 'landing', phase: resumed?.screen === 'world' ? 'play' : 'intro', splash: false, quality: IS_MOBILE ? 'low' : 'high', tod: 'day', sfx: true, music: false,
  userId: '', memorials: [], flowerCounts: {}, candleCounts: {}, openId: null, registerSlot: resumed?.screen === 'world' && resumed.reg ? resumed.regSlot : undefined, nearSlot: null, nearMarket: false, nearPlace: null, marketOpen: false, ...loadMarket(), menuOpen: false, toast: null,
  set: (p) => set(p),
  say: (t) => { set({ toast: t }); clearTimeout(toastT); toastT = window.setTimeout(() => get().set({ toast: null }), 3200) },
  refresh: async () => {
    try {
      const [userId, memorials, flowerCounts, candleCounts] = await Promise.all([api.userId(), api.list(), api.flowerCounts(), api.candleCounts()])
      set({ userId, memorials, flowerCounts, candleCounts })
    } catch (e) { get().say((e as Error).message) }
  },
}))

if (import.meta.env.DEV) (window as unknown as { __store: typeof useStore }).__store = useStore
