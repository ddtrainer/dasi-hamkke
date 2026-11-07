import { useState } from 'react'
import { useStore, saveMarket } from '../lib/store'
import { game } from '../world/game'
import { chime } from '../lib/audio'
import { MissionBoard } from './Missions'

export interface Item { id: string; icon: string; name: string; desc: string }
export const CLOTHES: Item[] = [
  { id: 'bandana-red', icon: '🧣', name: '빨간 두건', desc: '목에 두르는 산뜻한 두건' },
  { id: 'bandana-sky', icon: '🩵', name: '하늘색 두건', desc: '맑은 날 소풍 두건' },
  { id: 'sweater-pink', icon: '🧶', name: '분홍 스웨터', desc: '포근한 니트 스웨터' },
  { id: 'sweater-mint', icon: '🍃', name: '민트 스웨터', desc: '산뜻한 민트색 니트' },
  { id: 'ribbon-pink', icon: '🎀', name: '분홍 리본', desc: '귀 옆에 다는 작은 리본' },
]
export const SNACKS: Item[] = [
  { id: 'bone', icon: '🦴', name: '뼈다귀 쿠키', desc: '바삭바삭 고소한 쿠키' },
  { id: 'potato', icon: '🍠', name: '고구마 말랭이', desc: '달콤하고 쫀득한 간식' },
  { id: 'jerky', icon: '🥩', name: '소고기 육포', desc: '가장 좋아하는 특별 간식' },
]
export const GOODS: Item[] = [
  { id: 'balloon', icon: '🎈', name: '풍선', desc: '배낭에 묶는 둥실둥실 풍선' },
  { id: 'keyring', icon: '🔑', name: '하트 키링', desc: '배낭에 다는 하트 키링' },
  { id: 'hairpin', icon: '🌸', name: '꽃 모자핀', desc: '밀짚모자에 꽂는 꽃' },
]
const TABS = [['missions', '🎯 미션'], ['clothes', '👕 옷'], ['snacks', '🦴 간식'], ['goods', '🎁 굿즈']] as const

export function MarketModal() {
  const { marketOpen, dogOutfit, goods, treats, tickets, owned, set, say } = useStore()
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('missions')
  if (!marketOpen) return null
  const close = () => set({ marketOpen: false })
  // 1 ticket buys one item (clothes / goods once, a snack every time)
  const spend = (): boolean => {
    if (tickets < 1) { say('🎟️ 티켓이 없어요. 미션에 성공하면 받을 수 있어요.'); setTab('missions'); return false }
    return true
  }
  const claim = (it: Item) => {
    if (!spend()) return
    set({ tickets: tickets - 1, owned: [...owned, it.id] }); saveMarket(); chime(); say(`${it.icon} ${it.name}을(를) 받았어요!`)
  }
  const wear = (id: string) => { set({ dogOutfit: dogOutfit === id ? null : id }); saveMarket(); chime() }
  const feed = (it: Item) => {
    if (!spend()) return
    set({ tickets: tickets - 1, treats: treats + 1 }); saveMarket(); game.treatUntil = game.time + 3; chime()
    say(`${it.icon} ${it.name}을(를) 줬어요. 냠냠 💕`); close()
  }
  const toggleGood = (id: string) => { set({ goods: goods.includes(id) ? goods.filter((g) => g !== id) : [...goods, id] }); saveMarket(); chime() }
  const list = tab === 'clothes' ? CLOTHES : tab === 'snacks' ? SNACKS : tab === 'goods' ? GOODS : []
  return (
    <div className="overlay" onClick={close}>
      <div className="card market" role="dialog" aria-label="다시 함께 마켓" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={close} aria-label="닫기">✕</button>
        <h2>🛍️ 다시 함께 마켓</h2>
        <p className="hint">반려동물 옷 · 간식 · 굿즈 — 체험용 가상 상점이에요. 미션에 성공해 받은 🎟️ 티켓으로 바꿔요.</p>
        <div className="tabs">{TABS.map(([k, label]) => (<button key={k} className={'tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{label}</button>))}</div>
        {tab === 'missions' ? <MissionBoard /> : <p className="hint">내 티켓: 🎟️ {tickets}장 · 아이템 1개 = 티켓 1장</p>}
        {tab !== 'missions' && <div className="items">
          {list.map((it) => {
            const on = tab === 'clothes' ? dogOutfit === it.id : tab === 'goods' ? goods.includes(it.id) : false
            return (
              <div key={it.id} className={'item' + (on ? ' on' : '')}>
                <span className="ico">{it.icon}</span>
                <div className="txt"><b>{it.name}</b><small>{it.desc}</small></div>
                {tab === 'snacks' ? <button className="btn primary" onClick={() => feed(it)}>🎟️1 주기</button>
                  : !owned.includes(it.id) ? <button className="btn primary" onClick={() => claim(it)}>🎟️1 받기</button>
                  : tab === 'clothes' ? <button className="btn" onClick={() => wear(it.id)}>{on ? '벗기기' : '입히기'}</button>
                  : <button className="btn" onClick={() => toggleGood(it.id)}>{on ? '떼기' : '달기'}</button>}
              </div>
            )
          })}
        </div>}
        {tab === 'snacks' && <p className="hint">지금까지 간식을 {treats}번 줬어요.</p>}
      </div>
    </div>
  )
}
