import { Component, lazy, ReactNode, Suspense, useEffect, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { startAudio, stopAudio } from '../lib/audio'
import { Hud } from './Hud'
import { ShrineModal, RegisterModal, Portrait } from './Modals'
import { MarketModal } from './MarketModal'
import { PetModal } from './PetModal'
import { AvatarModal } from './AvatarModal'
import { WishModal } from './WishModal'
import { stopLapRun } from '../world/lapRun'
import { api } from '../lib/api'
import { game } from '../world/game'
import { resume, resumed, write } from '../lib/resume'

const World = lazy(() => import('../world/Scene').then((m) => ({ default: m.World })))

function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch { return false }
}

class Boundary extends Component<{ children: ReactNode; onError: () => void }, { err: boolean }> {
  state = { err: false }
  static getDerivedStateFromError() { return { err: true } }
  componentDidCatch(e: Error) { console.error('3D failed', e); this.props.onError() }
  render() { return this.state.err ? null : this.props.children }
}

const SPLASH_MS = 3400
/** Shown right after pressing "입장하기": the island picture fades in, stays a moment and fades out (the 3D world loads behind it).
 *  Visitors can pause it, zoom into the picture and enter whenever they like. */
function Splash() {
  const [out, setOut] = useState(false)
  const [paused, setPaused] = useState(false)
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const left = useRef(matchMedia('(prefers-reduced-motion: reduce)').matches ? 1800 : SPLASH_MS)
  const startedAt = useRef(0)
  const finish = () => {
    if (out) return
    clearTimeout(timer.current)
    setOut(true)
    window.setTimeout(() => useStore.getState().set({ splash: false }), 700)
  }
  const run = () => {
    startedAt.current = performance.now()
    timer.current = window.setTimeout(finish, left.current)
  }
  const pause = () => {
    clearTimeout(timer.current)
    left.current = Math.max(600, left.current - (performance.now() - startedAt.current))
    setPaused(true)
  }
  const resume = () => { setZoom(null); setPaused(false); run() }
  const pausedRef = useRef(false)
  pausedRef.current = paused
  useEffect(() => {
    run()
    const key = (e: KeyboardEvent) => {
      if (e.key === ' ') { e.preventDefault(); pausedRef.current ? resume() : pause() }
      else if (e.key === 'Enter' || e.key === 'Escape') finish()
    }
    addEventListener('keydown', key)
    return () => { clearTimeout(timer.current); removeEventListener('keydown', key) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const onPic = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!paused) return pause()
    if (zoom) return setZoom(null)
    const r = e.currentTarget.getBoundingClientRect()
    setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 })
  }
  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn() }
  return (
    <div className={'splash' + (out ? ' out' : '') + (paused ? ' paused' : '')} role="img" aria-label="댕냥 메모리 섬 전경">
      <div className={'splash-pic' + (zoom ? ' zoomed' : '')} onClick={onPic}
        style={zoom ? { transform: 'scale(2.6)', transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}>
        <img src={import.meta.env.BASE_URL + 'island.webp'} alt="" draggable={false} />
      </div>
      <div className="splash-cap"><b>댕<i className="nyang">냥</i> 메모리</b><span>너를 향한 내 마음과 숨결을 느껴봐<br />영원히 널 사랑해</span></div>
      <div className="splash-bar"><i style={{ animationDuration: `${SPLASH_MS}ms` }} /></div>
      <div className="splash-ctl">
        <button className="splash-btn" onClick={stop(paused ? resume : pause)} aria-label={paused ? '계속' : '멈춤'}>{paused ? '▶ 계속' : '⏸ 멈춤'}</button>
        <button className="splash-btn go" onClick={stop(finish)}>입장하기 ›</button>
      </div>
      <small>{paused ? (zoom ? '그림을 다시 누르면 원래 크기로 돌아와요' : '그림을 눌러 확대해서 자세히 볼 수 있어요') : '그림을 누르면 멈춰요'}</small>
    </div>
  )
}

function Landing() {
  const { set } = useStore()
  const gl = hasWebGL()
  useEffect(() => { new Image().src = import.meta.env.BASE_URL + 'island.webp' }, [])
  // entering starts with choosing who to be on the island
  const enter = () => set({ avatarFor: 'enter' })
  return (
    <div className="landing">
      <div className="hero">
        <h1 className="logo-h1"><img src={import.meta.env.BASE_URL + 'logo.webp'} alt="댕냥 메모리" draggable={false} /></h1>
        <p className="sub">푸른 바다와 꽃이 가득한 세상에서<br />다시 함께 걷고 행복을 나누는 시간.</p>
        <p className="sub sub2">너를 향한 내 따뜻한 마음과 숨결이 닿기를.<br />언제나 사랑해, 영원히.</p>
        {gl ? (
          <button className="btn primary big" onClick={enter}>댕냥 메모리 입장하기</button>
        ) : (
          <p className="warn">이 브라우저에서는 3D를 실행할 수 없어요. 2D 추모 화면을 이용해 주세요.</p>
        )}
        <button className="btn big" onClick={() => set({ screen: 'flat' })}>2D 추모 화면으로 보기</button>
        <p className="hint">PC: WASD·마우스 / 모바일: 조이스틱 · {api.mode === 'local' ? '이 기기에만 저장되는 체험 모드' : '클라우드 저장 모드'}</p>
      </div>
    </div>
  )
}

function Flat() {
  const { memorials, userId, set } = useStore()
  const gl = hasWebGL()
  return (
    <div className="flat">
      <h2 className="flat-title">2D 추모 화면</h2>
      <header>
        <h1>🐾 댕<span className="nyang">냥</span> 메모리</h1>
        <div className="row">
          <button className="btn primary" onClick={() => set({ registerSlot: null })}>🕯️ 분향소 만들기</button>
          {gl && <button className="btn" onClick={() => set({ avatarFor: 'enter' })}>🌸 3D 공원 입장</button>}
        </div>
      </header>
      <p className="hint">2D 추모 화면 · 3D가 어려울 때도 모든 추모 기능을 사용할 수 있어요.</p>
      <div className="grid">
        {memorials.map((m) => (
          <button key={m.id} className="tile" onClick={() => set({ openId: m.id })}>
            <Portrait m={m} className="thumb" />
            <b>{m.petName}</b>
            <span>{m.species} · {m.passedDate ? m.passedDate.slice(0, 4) : ''}</span>
            {m.ownerId === userId && <i>{m.visibility === 'public' ? '내 분향소' : '🔒 내 비공개'}</i>}
          </button>
        ))}
      </div>
    </div>
  )
}

function saveSession() {
  const st = useStore.getState()
  write({ screen: st.screen, reg: st.registerSlot !== undefined, regSlot: st.registerSlot ?? null, pos: { ...game.pos }, heading: game.heading, draft: resume.draft })
}

export default function App() {
  const { screen, splash, registerSlot, petOpen, avatarFor, set, refresh } = useStore()
  useEffect(() => { void refresh() }, [refresh])
  // phone webviews can reload the page while the photo picker is open: remember where the visitor was
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') saveSession() }
    document.addEventListener('visibilitychange', onHide)
    addEventListener('pagehide', saveSession)
    const unsub = useStore.subscribe((s, p) => { if (s.screen !== p.screen || s.registerSlot !== p.registerSlot) saveSession() })
    if (resumed?.screen === 'world' && resumed.reg) useStore.getState().say('화면이 다시 불러와졌어요. 사진을 다시 골라 주세요.')
    return () => { document.removeEventListener('visibilitychange', onHide); removeEventListener('pagehide', saveSession); unsub() }
  }, [])
  useEffect(() => { if (screen !== 'world') { stopAudio(); stopLapRun() } }, [screen])
  return (
    <>
      {screen === 'landing' && <Landing />}
      {screen === 'flat' && <Flat />}
      {screen === 'world' && (
        <div className="stage">
          <Boundary onError={() => { set({ screen: 'flat' }); useStore.getState().say('3D를 시작하지 못해 2D 화면으로 전환했어요.') }}>
            {/* the 3D scene is released while the register form is open: the photo picker needs the memory on phones */}
            {registerSlot === undefined && !petOpen && !avatarFor && <Suspense fallback={<div className="loading">섬을 불러오는 중…</div>}><World /></Suspense>}
          </Boundary>
          <Hud />
          <button className="home" onClick={() => set({ screen: 'landing' })} aria-label="처음으로">⌂</button>
        </div>
      )}
      <ShrineModal />
      <RegisterModal />
      {splash && <Splash />}
      <MarketModal />
      <PetModal />
      <AvatarModal />
      <WishModal />
      {screen !== 'world' && <Toast />}
    </>
  )
}
function Toast() {
  const t = useStore((s) => s.toast)
  return t ? <div className="toast" role="status">{t}</div> : null
}
