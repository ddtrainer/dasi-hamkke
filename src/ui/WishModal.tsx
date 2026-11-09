import { useState } from 'react'
import { useStore, saveMarket, saveWishes } from '../lib/store'
import { chime } from '../lib/audio'

const COLORS = ['#ff9ec4', '#ffe066', '#a9d8ff', '#c9a0ff', '#ffb38a', '#9be3b0']
const MAX = 60

/** Write a wish on a ribbon; it is hung in the memory forest and the camera looks at it for a moment. */
export function WishModal() {
  const { wishOpen, ribbons, wishes, set, say } = useStore()
  const [text, setText] = useState('')
  const [c, setC] = useState(0)
  if (!wishOpen) return null
  const close = () => set({ wishOpen: false })
  const hang = () => {
    const t = text.trim().slice(0, MAX)
    if (!t) return
    const i = ribbons
    const w = [...wishes]
    while (w.length < i) w.push({ t: '', c: w.length % COLORS.length })
    w[i] = { t, c }
    set({ ribbons: i + 1, wishes: w, wishOpen: false, wishNew: i }); saveMarket(); saveWishes(w); chime()
    setText('')
    say('🎀 소원 리본을 달았어요. 반짝이는 리본을 찾아보세요. 리본을 누르면 소원이 보여요.')
  }
  return (
    <div className="overlay" onClick={close}>
      <div className="card wishm" role="dialog" aria-label="소원 리본" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={close} aria-label="닫기">✕</button>
        <h2>🎀 소원 리본 달기</h2>
        <p className="hint">소중한 아이에게 전하고 싶은 소원이나 마음을 적어 주세요. 추억의 숲 나무에 리본으로 걸려요.</p>
        <textarea value={text} maxLength={MAX} rows={3} autoFocus placeholder="예) 아프지 말고 편히 쉬어. 언제나 사랑해." onChange={(e) => setText(e.target.value)} />
        <div className="wish-colors" role="radiogroup" aria-label="리본 색">
          {COLORS.map((col, i) => (<button key={col} type="button" role="radio" aria-checked={c === i} className={c === i ? 'on' : ''} style={{ background: col }} onClick={() => setC(i)} aria-label={'리본 색 ' + (i + 1)} />))}
          <span className="count">{text.length}/{MAX}</span>
        </div>
        {wishes.some((w) => w.t) && (
          <div className="mywishes">
            <h4>내가 단 리본 (누르면 숲에서 반짝여요)</h4>
            {wishes.map((w, i) => w.t ? (
              <button key={i} type="button" onClick={() => { set({ wishOpen: false, wishNew: -1 }); window.setTimeout(() => set({ wishNew: i }), 60) }}>
                <i style={{ background: COLORS[w.c % COLORS.length] }} />{w.t}
              </button>
            ) : null)}
          </div>
        )}
        <button className="btn primary big stick" disabled={!text.trim()} onClick={hang}>리본 달기</button>
      </div>
    </div>
  )
}
