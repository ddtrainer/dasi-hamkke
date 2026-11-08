import { useEffect, useRef, useState } from 'react'
import { useStore, saveMarket } from '../lib/store'
import { kstDay } from '../lib/api'
import { chime } from '../lib/audio'
import { LAP_STEPS, startLapRun } from '../world/lapRun'

export const MISSIONS = [
  { id: 'breath', icon: '🌊', name: '해변에서 함께 숨 쉬기', desc: '바다를 바라보며 천천히 3번 숨 쉬어요' },
  { id: 'rps', icon: '✌️', name: '가위바위보', desc: '반려견과 3판 2선승' },
  { id: 'slot', icon: '🐾', name: '행운 뽑기', desc: '그림 3개를 맞추면 성공 (5번 기회)' },
  { id: 'run', icon: '🏃', name: '섬 한 바퀴 슬로우 러닝', desc: '폰을 들고 달려 반려견과 섬을 한 바퀴 돌아요' },
] as const
type MissionId = (typeof MISSIONS)[number]['id']

/** Pays one ticket for a mission, at most once per Korean calendar day. */
function useReward(id: MissionId) {
  const { missions, tickets, set, say } = useStore()
  const done = missions[id] === kstDay()
  const win = () => {
    if (useStore.getState().missions[id] === kstDay()) return
    const st = useStore.getState()
    set({ tickets: st.tickets + 1, missions: { ...st.missions, [id]: kstDay() } }); saveMarket(); chime()
    say('🎟️ 티켓을 1장 받았어요! 마켓에서 아이템으로 바꿔 보세요.')
  }
  return { done, win, tickets }
}

// Breathing guide ported from 숨핏 (soomfit-21day template.html): step list -> cycle length -> phase / orb size / count from elapsed time.
type BStep = { label: string; sub: string; cue: 'in' | 'hold' | 'out'; s: number; to: number }
const B_IN = { label: '들이마시기', sub: '코로 편안하게 들이마셔요', cue: 'in' as const }
const B_HOLD = { label: '멈추기', sub: '편안하게 숨을 멈춰 보세요', cue: 'hold' as const }
const B_OUT = { label: '길게 내쉬기', sub: '입으로 천천히 후~', cue: 'out' as const }
const BREATHS: Record<string, { lv: string; title: string; cycles: number; steps: BStep[] }> = {
  basic: { lv: '기본', title: '4-6 호흡', cycles: 6, steps: [{ ...B_IN, s: 4, to: 0.92 }, { ...B_OUT, s: 6, to: 0.42 }] },
  mid: { lv: '중급', title: '4-4-6 호흡', cycles: 5, steps: [{ ...B_IN, s: 4, to: 0.92 }, { ...B_HOLD, s: 4, to: 0.92 }, { ...B_OUT, s: 6, to: 0.42 }] },
  adv: { lv: '고급', title: '4-7-8 호흡', cycles: 4, steps: [{ ...B_IN, s: 4, to: 0.92 }, { ...B_HOLD, s: 7, to: 0.92, sub: '편안하게 숨을 멈춰 보세요. 힘들면 쉬어도 괜찮아요' }, { ...B_OUT, s: 8, to: 0.42 }] },
}
const cycleOf = (k: string) => BREATHS[k].steps.reduce((x, p) => x + p.s, 0)

function Breath({ onWin }: { onWin: () => void }) {
  const [kind, setKind] = useState<'basic' | 'mid' | 'adv'>('basic')
  const [t, setT] = useState<number | null>(null) // elapsed seconds (fractional)
  const fin = useRef(false)
  const B = BREATHS[kind], cycle = cycleOf(kind), total = cycle * B.cycles
  useEffect(() => {
    if (t === null) return
    const t0 = performance.now() - t * 1000
    const h = window.setInterval(() => {
      const el = (performance.now() - t0) / 1000
      if (el >= total) { clearInterval(h); setT(total); if (!fin.current) { fin.current = true; onWin() } } else setT(el)
    }, 60)
    return () => clearInterval(h)
  }, [t === null, total]) // eslint-disable-line react-hooks/exhaustive-deps
  const finished = t !== null && t >= total
  let orb = 0.42, label = '', sub = '', num = 0, n = 0
  if (t !== null && !finished) {
    n = Math.floor(t / cycle); let x = t % cycle, from = 0.42
    for (let i = 0; i < B.steps.length; i++) {
      const p = B.steps[i]
      if (x < p.s || i === B.steps.length - 1) {
        const u = Math.min(1, x / p.s), e = u * u * (3 - 2 * u)
        orb = from + (p.to - from) * e; label = p.label; sub = p.sub
        num = p.cue !== 'out' ? Math.min(p.s, Math.floor(x) + 1) : Math.max(1, Math.ceil(p.s - x)) // in/hold count up, out counts down
        break
      }
      x -= p.s; from = p.to
    }
  }
  return (
    <div className="mg">
      {t === null && (
        <>
          <div className="seg">{Object.entries(BREATHS).map(([k, v]) => (<button key={k} className={'tab' + (kind === k ? ' on' : '')} onClick={() => setKind(k as 'basic' | 'mid' | 'adv')}>{v.lv} · {v.title}</button>))}</div>
          <div className="breath" style={{ transform: 'scale(1)' }}>🌊</div>
          <p className="mg-say"><small>{B.title}을 {B.cycles}번 이어서 해요 (약 {total}초).<br />어지러우면 바로 멈추고 편하게 숨 쉬어요.</small></p>
          <button className="btn primary big" onClick={() => { fin.current = false; setT(0) }}>시작하기</button>
        </>
      )}
      {t !== null && !finished && (
        <>
          <div className="breath" style={{ transform: `scale(${(orb / 0.42).toFixed(3)})`, transition: 'none' }}><b className="breath-num">{num}</b></div>
          <p className="mg-say"><b>{label}</b><br /><small>{sub}</small><br /><small>호흡 {Math.min(n + 1, B.cycles)} / {B.cycles}</small></p>
        </>
      )}
      {finished && <p className="mg-say">잘했어요. 마음이 한결 가벼워졌길 바라요 💕</p>}
    </div>
  )
}

const HANDS = ['✌️', '✊', '🖐️'] // 0 scissors, 1 rock, 2 paper
const HAND_NAME = ['가위', '바위', '보']
function Rps({ onWin }: { onWin: () => void }) {
  const [me, setMe] = useState(0), [dog, setDog] = useState(0)
  const [last, setLast] = useState<{ m: number; d: number; r: 'win' | 'lose' | 'draw' } | null>(null)
  const over = me >= 2 || dog >= 2
  const play = (m: number) => {
    if (over) return
    const d = Math.floor(Math.random() * 3)
    const r = m === d ? 'draw' : (m - d + 3) % 3 === 1 ? 'win' : 'lose' // scissors(0) beats paper(2), rock(1) beats scissors(0), paper(2) beats rock(1)
    setLast({ m, d, r })
    if (r === 'win') { setMe(me + 1); if (me + 1 >= 2) onWin() }
    if (r === 'lose') setDog(dog + 1)
  }
  const reset = () => { setMe(0); setDog(0); setLast(null) }
  return (
    <div className="mg">
      <p className="mg-score">나 {me} : {dog} 🐶</p>
      <div className="mg-vs">
        <span>{last ? HANDS[last.m] : '❔'}</span><b>VS</b><span>{last ? HANDS[last.d] : '❔'}</span>
      </div>
      <p className="mg-say">{!last ? '가위, 바위, 보 중에 골라요' : last.r === 'draw' ? '비겼어요! 다시!' : last.r === 'win' ? `${HAND_NAME[last.m]}로 이겼어요!` : `${HAND_NAME[last.d]}에 졌어요…`}</p>
      {over ? (
        <>
          <p className="mg-say">{me >= 2 ? '🎉 이겼어요!' : '아쉬워요. 한 번 더 해볼까요?'}</p>
          {dog >= 2 && <button className="btn primary big" onClick={reset}>다시 하기</button>}
        </>
      ) : (
        <div className="mg-hands">{HANDS.map((h, i) => (<button key={i} className="btn hand" onClick={() => play(i)} aria-label={HAND_NAME[i]}>{h}<small>{HAND_NAME[i]}</small></button>))}</div>
      )}
    </div>
  )
}

const SYMS = ['🐾', '🌸', '🦴']
function Slot({ onWin }: { onWin: () => void }) {
  const TRIES = 5
  const [reels, setReels] = useState([0, 1, 2])
  const [spin, setSpin] = useState<number>(0) // number of reels still spinning
  const [tries, setTries] = useState(TRIES)
  const [res, setRes] = useState<'win' | 'lose' | null>(null)
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach(clearInterval), [])
  const pull = () => {
    if (spin || tries <= 0 || res === 'win') return
    setTries(tries - 1); setRes(null); setSpin(3)
    const final = [0, 1, 2].map(() => Math.floor(Math.random() * SYMS.length))
    timers.current.forEach(clearInterval); timers.current = []
    for (let i = 0; i < 3; i++) {
      const iv = window.setInterval(() => setReels((r) => r.map((v, k) => (k === i ? (v + 1) % SYMS.length : v))), 90)
      timers.current.push(iv)
      window.setTimeout(() => {
        clearInterval(iv)
        setReels((r) => r.map((v, k) => (k === i ? final[i] : v)))
        setSpin((s) => s - 1)
        if (i === 2) {
          const ok = final.every((v) => v === final[0])
          setRes(ok ? 'win' : 'lose'); if (ok) onWin()
        }
      }, 700 + i * 450)
    }
  }
  const again = () => { setTries(TRIES); setRes(null) }
  return (
    <div className="mg">
      <div className="slot">{reels.map((r, i) => (<span key={i} className={spin ? 'spin' : ''}>{SYMS[r]}</span>))}</div>
      <p className="mg-say">{res === 'win' ? '🎉 세 개가 맞았어요!' : res === 'lose' ? '아쉬워요, 다시!' : '그림 3개를 맞춰요'}<br /><small>남은 기회 {tries}</small></p>
      {res !== 'win' && (tries > 0
        ? <button className="btn primary big" onClick={pull} disabled={!!spin}>{spin ? '돌아가는 중…' : '뽑기'}</button>
        : <button className="btn primary big" onClick={again}>다시 도전하기</button>)}
    </div>
  )
}

// ---- island lap run: the old slow-running mission is merged into the lap (see world/lapRun.ts) ----
function RunLauncher({ done }: { done: boolean }) {
  const { set } = useStore()
  return (
    <div className="mg">
      <p className="mg-say">폰을 손에 쥐거나 주머니에 넣고 가볍게 달려요.<br />내가 달린 만큼 캐릭터가 반려견과 함께<br />섬을 한 바퀴 돌아요. 🐕🏃<br /><small>3분 안에 <b>숨핏 펄스 {LAP_STEPS}</b>을 채우면 완주예요.<br />주변을 살피며 안전하게, 화면은 켜 두세요.<br />{done ? '오늘 보상은 받았지만 다시 달려 볼 수 있어요.' : '완주하면 🎟️ 티켓 1장!'}</small></p>
      <button className="btn primary big" onClick={() => { set({ marketOpen: false }); void startLapRun() }}>🏃 섬 한 바퀴 달리기</button>
    </div>
  )
}

export function MissionBoard() {
  const { missions, tickets } = useStore()
  const [open, setOpen] = useState<MissionId | null>(null)
  const today = kstDay()
  const m = MISSIONS.find((x) => x.id === open)
  if (m) return <Play id={m.id} back={() => setOpen(null)} title={`${m.icon} ${m.name}`} />
  return (
    <>
      <p className="hint">미션에 성공하면 🎟️ 티켓 1장! 티켓 1장으로 아이템 1개를 받을 수 있어요. 미션은 하루에 한 번씩 보상이 있어요.</p>
      <div className="items">
        {MISSIONS.map((x) => {
          const done = missions[x.id] === today
          return (
            <div key={x.id} className={'item' + (done ? ' on' : '')}>
              <span className="ico">{x.icon}</span>
              <div className="txt"><b>{x.name}</b><small>{done ? '오늘 완료 ✔ 내일 또 만나요' : x.desc}</small></div>
              <button className={'btn' + (done ? '' : ' primary')} onClick={() => setOpen(x.id)} disabled={done}>{done ? '완료' : '도전'}</button>
            </div>
          )
        })}
      </div>
      <p className="hint">내 티켓: 🎟️ {tickets}장</p>
    </>
  )
}

function Play({ id, back, title }: { id: MissionId; back: () => void; title: string }) {
  const { done, win, tickets } = useReward(id)
  return (
    <>
      <div className="mg-head"><button className="btn ghost" onClick={back}>← 미션 목록</button><b>{title}</b></div>
      {id === 'breath' && <Breath onWin={win} />}
      {id === 'rps' && <Rps onWin={win} />}
      {id === 'slot' && <Slot onWin={win} />}
      {id === 'run' && <RunLauncher done={done} />}
      <p className="hint">{done ? '🎟️ 오늘 보상을 받았어요.' : '성공하면 🎟️ 1장'} · 내 티켓 {tickets}장</p>
    </>
  )
}
