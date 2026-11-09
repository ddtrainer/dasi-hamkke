import { useEffect, useRef } from 'react'
import { useStore, IS_MOBILE } from '../lib/store'
import { game } from '../world/game'
import { interactNearest, toggleSit } from '../world/Player'
import { goToSlot, goToDestination, stroll, loopWalk, stopWalk, PLACE_BY_ID } from '../world/actions'
import { DESTINATIONS, SLOTS } from '../world/terrain'
import { setMusic, setSfx } from '../lib/audio'
import { greetNearest } from '../world/visitors'
import { startLapRun } from '../world/lapRun'
import { RunHud } from './RunHud'
import { replyGreet, dismissGreet } from '../lib/greet'

function Joystick() {
  const base = useRef<HTMLDivElement>(null)
  const knob = useRef<HTMLDivElement>(null)
  const id = useRef<number | null>(null)
  const move = (e: React.PointerEvent) => {
    if (id.current !== e.pointerId) return
    const r = base.current!.getBoundingClientRect()
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2)
    const max = r.width / 2
    const l = Math.hypot(dx, dy)
    if (l > max) { dx = (dx / l) * max; dy = (dy / l) * max }
    knob.current!.style.transform = `translate(${dx}px,${dy}px)`
    game.joy.x = dx / max; game.joy.y = dy / max
  }
  const end = (e: React.PointerEvent) => {
    if (id.current !== e.pointerId) return
    id.current = null; game.joy.x = game.joy.y = 0
    knob.current!.style.transform = 'translate(0,0)'
  }
  return (
    <div className="joy" ref={base} onPointerDown={(e) => { id.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); move(e) }} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      <div className="knob" ref={knob} />
    </div>
  )
}

export function Hud() {
  const { nearNeighbor, greetNote, phase, nearSlot, nearMarket, nearPlace, memorials, userId, sfx, music, quality, menuOpen, tod, set, toast } = useStore()
  const near = nearSlot !== null ? memorials.find((m) => m.slot === nearSlot) : undefined
  const mine = memorials.filter((m) => m.ownerId === userId)
  useEffect(() => { setSfx(sfx) }, [sfx])
  useEffect(() => { setMusic(music) }, [music])
  const runRef = useRef<HTMLButtonElement>(null)
  if (phase === 'intro') {
    return <button className="skip" onClick={() => { game.introT = 99 }}>건너뛰기 ›</button>
  }
  return (
    <>
      <div className="topbar">
        <button className="chip" onClick={() => set({ menuOpen: !menuOpen })}>🧭 이동</button>
        <button className="chip" onClick={() => set({ registerSlot: null })}>🕯️ 분향소 만들기</button>
        <button className="chip" onClick={() => set({ petOpen: true, petTarget: useStore.getState().companionId })}>🐶 내 아이</button>
        <button className="chip" onClick={() => set({ avatarFor: 'change' })}>🧑 캐릭터</button>
        <span className="sp" />
        <button className="chip" onClick={() => set({ tod: tod === 'day' ? 'sunset' : tod === 'sunset' ? 'night' : 'day' })} aria-label="시간대">{tod === 'day' ? '☀️ 낮' : tod === 'sunset' ? '🌇 노을' : '🌙 밤'}</button>
        <button className={'chip' + (sfx ? ' on' : '')} onClick={() => set({ sfx: !sfx })} aria-label="효과음">{sfx ? '🔊' : '🔇'}</button>
        <button className={'chip' + (music ? ' on' : '')} onClick={() => set({ music: !music })} aria-label="배경음악">🎵</button>
        <button className="chip" onClick={() => set({ quality: quality === 'high' ? 'low' : 'high' })}>{quality === 'high' ? '고화질' : '절약'}</button>
        <button className="chip" onClick={() => set({ screen: 'flat' })}>2D</button>
      </div>
      {menuOpen && (
        <div className="menu" onClick={() => set({ menuOpen: false })}>
          <h4>자동 이동</h4>
          <button onClick={stroll}>🚶 산책로 따라 걷기</button>
          <button onClick={loopWalk}>🚶 구경하며 섬 한 바퀴 (자동 걷기)</button>
          <button onClick={() => void startLapRun()}>🏃 달려서 섬 한 바퀴 (미션)</button>
          {(Object.keys(DESTINATIONS) as (keyof typeof DESTINATIONS)[]).map((k) => (<button key={k} onClick={() => goToDestination(k)}>📍 {DESTINATIONS[k].label}</button>))}
          {mine.length > 0 && <h4>내 분향소</h4>}
          {mine.map((m) => (<button key={m.id} onClick={() => goToSlot(m.slot)}>🌸 {m.petName}</button>))}
          <h4>다른 분향소</h4>
          {memorials.filter((m) => m.ownerId !== userId).map((m) => (<button key={m.id} onClick={() => goToSlot(m.slot)}>🕯️ {m.petName}</button>))}
          <button onClick={() => { goToSlot(SLOTS.find((s) => !memorials.some((m) => m.slot === s.index))?.index ?? 0) }}>✨ 빈 자리 보기</button>
          <button className="stop" onClick={stopWalk}>■ 이동 멈추기</button>
        </div>
      )}
      {nearSlot !== null && (
        <button className="interact" onClick={interactNearest}>
          {near ? `🕯️ ${near.petName}의 분향소 열기` : '🌱 분향소 자리 — 만들기'} <kbd>E</kbd>
        </button>
      )}
      {nearSlot === null && nearMarket && (
        <button className="interact" onClick={interactNearest}>🛍️ 댕냥 메모리 마켓 열기 <kbd>E</kbd></button>
      )}
      {nearSlot === null && !nearMarket && nearPlace && PLACE_BY_ID[nearPlace] && (
        <button className="interact" onClick={interactNearest}>{PLACE_BY_ID[nearPlace].icon} {PLACE_BY_ID[nearPlace].label} <kbd>E</kbd></button>
      )}
      <RunHud />
      {nearNeighbor && (
        <button className="interact greet" onClick={greetNearest}>👋 {nearNeighbor.name}님에게 인사하기 <kbd>H</kbd></button>
      )}
      {greetNote && (
        <div className="greetnote" role="status">
          <span>{greetNote.text}</span>
          <button onClick={() => void replyGreet()}>답례 👋</button>
          <button className="x2" onClick={dismissGreet} aria-label="닫기">✕</button>
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
      {IS_MOBILE || matchMedia('(pointer: coarse)').matches ? (
        <>
          <Joystick />
          <div className="actions">
            <button ref={runRef} onClick={(e) => { game.runToggle = !game.runToggle; e.currentTarget.classList.toggle('on', game.runToggle) }}>🏃</button>
            <button onClick={toggleSit}>🪑</button>
            <button onClick={interactNearest}>E</button>
          </div>
        </>
      ) : (
        <div className="help">WASD/방향키 이동 · Shift 달리기 · 드래그 시점 · 휠 줌 · E 가까운 곳 열기(분향소·마켓·별 보기) · C 앉기 · H 인사</div>
      )}
    </>
  )
}
