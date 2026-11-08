import { useEffect, useState } from 'react'
import { useStore } from '../lib/store'
import { LAP_SEC, LAP_STEPS, lap, lapTapStep, startLapRun, stopLapRun } from '../world/lapRun'
import { kstDay } from '../lib/api'

const mm = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`

/** Progress panel for the island lap run (top of the screen). */
export function RunHud() {
  const { lapUi, missions, memorials, userId, pets, companionId, set } = useStore()
  // with shrine dogs waiting, nobody runs alongside until one has been called out
  const lonely = !companionId && memorials.some((m) => m.ownerId === userId && pets[m.id])
  const [pct, setPct] = useState(0)
  const on = lapUi.status === 'run'
  useEffect(() => {
    if (!on) return
    const h = window.setInterval(() => setPct(lap.total ? Math.round((lap.s / lap.total) * 100) : 0), 200)
    return () => clearInterval(h)
  }, [on])
  if (lapUi.status === 'idle') return null
  const { status, mode, steps, sec } = lapUi
  const close = () => stopLapRun()
  const spm = sec > 5 ? Math.round((steps / sec) * 60) : 0
  return (
    <div className="runhud" role="status">
      {status === 'asking' && <p>움직임 센서 허락을 기다리는 중…</p>}
      {status === 'none' && (
        <>
          <p>움직임 센서를 찾지 못했어요. 폰의 브라우저(https 주소)에서 열어 주세요.<br /><small>컴퓨터라면 체험 모드로 한 바퀴를 구경할 수 있어요. 체험 모드는 티켓을 주지 않아요.</small></p>
          <div className="rrow"><button onClick={() => void startLapRun(true)}>🖱️ 체험 모드로 달리기</button><button onClick={close}>닫기</button></div>
        </>
      )}
      {status === 'denied' && (
        <>
          <p>모션 센서 권한이 필요해요. 폰 설정에서 이 사이트의 동작 및 방향 접근을 허용해 주세요.</p>
          <div className="rrow"><button onClick={close}>닫기</button></div>
        </>
      )}
      {status === 'run' && (
        <>
          <div className="rtop"><b>🏃 섬 한 바퀴 {pct}%</b><span>남은 시간 {mm(Math.max(0, LAP_SEC - sec))}</span></div>
          <div className="rbar"><i style={{ width: `${pct}%` }} /></div>
          {lonely && <p className="rsub">🐕 분향소에서 반려견을 불러내면 함께 달려요.</p>}
          <p className="rsub">펄스 {steps} / {LAP_STEPS} · {steps === 0 ? (mode === 'tap' ? '아래 버튼을 눌러 한 걸음씩 가요' : '리듬이 잡힐 때까지 계속 달려 주세요…') : spm && mode === 'sensor' ? `분당 ${spm}` : '좋아요!'}</p>
          <div className="rrow">
            {mode === 'tap' && <button className="big" onClick={lapTapStep}>👟 한 걸음</button>}
            <button onClick={close}>그만하기</button>
          </div>
        </>
      )}
      {status === 'win' && (
        <>
          <p>🎉 한 바퀴 완주! 반려견과 함께 달렸어요.<br /><small>{missions.run === kstDay() ? '🎟️ 오늘의 티켓을 받았어요. 마켓에서 아이템 1개를 골라 보세요.' : ''}<br />숨이 차면 천천히 걸으며 숨을 골라 주세요 💕</small></p>
          <div className="rrow"><button onClick={() => { close(); set({ marketOpen: true }) }}>🛍️ 마켓 가기</button><button onClick={close}>닫기</button></div>
        </>
      )}
      {status === 'tapdone' && (
        <>
          <p>🎉 체험 완주! 폰으로 직접 달리면 티켓을 받을 수 있어요.</p>
          <div className="rrow"><button onClick={close}>닫기</button></div>
        </>
      )}
      {status === 'fail' && (
        <>
          <p>아쉬워요, 펄스 {steps}이었어요. 목표는 {LAP_STEPS}이에요.<br /><small>조금만 더 속도를 내서 다시 해봐요.</small></p>
          <div className="rrow"><button onClick={() => void startLapRun()}>다시 도전</button><button onClick={close}>닫기</button></div>
        </>
      )}
    </div>
  )
}
