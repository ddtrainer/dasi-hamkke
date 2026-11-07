import { useEffect, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { api, kstDay } from '../lib/api'
import { sanitizePhoto, defaultPortrait } from '../lib/image'
import { LIMITS, Memorial, Tribute, Visibility } from '../lib/types'
import { chime } from '../lib/audio'
import { resume } from '../lib/resume'
import { offerFlowersAnim } from '../world/Player'
import { game } from '../world/game'
import { SLOTS } from '../world/terrain'

const fmt = (d: string) => (d ? d.split('-').join('.') : '—')

export function Portrait({ m, className }: { m: Memorial; className?: string }) {
  const [src, setSrc] = useState<string | undefined>(m.photoUrl ?? undefined)
  useEffect(() => { setSrc(m.photoUrl ?? defaultPortrait(m.petName + m.id)) }, [m.photoUrl, m.petName, m.id])
  return <img className={className} src={src || undefined} alt={`${m.petName}의 사진`} />
}

export function ShrineModal() {
  const { openId, memorials, userId, refresh, say, set, screen } = useStore()
  const m = memorials.find((x) => x.id === openId)
  const [tributes, setTributes] = useState<Tribute[]>([])
  const [letter, setLetter] = useState('')
  const [writing, setWriting] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => { setWriting(false); setLetter(''); if (m) api.tributes(m.id).then(setTributes).catch((e) => say(e.message)); else setTributes([]) }, [openId]) // eslint-disable-line
  if (!m) return null
  const mine = m.ownerId === userId
  const letters = tributes.filter((t) => t.kind === 'letter')
  const flowers = tributes.filter((t) => t.kind === 'flowers').length
  const today = kstDay()
  const litNow = tributes.filter((t) => t.kind === 'candle' && kstDay(t.createdAt) === today)   // yesterday's candles have gone out
  const candles = litNow.length
  const litByMe = litNow.some((t) => t.authorId === userId)
  const close = () => set({ openId: null })
  const offer = async () => {
    setBusy(true)
    try {
      const t = await api.addTribute(m.id, 'flowers', '🌸')
      setTributes((x) => [...x, t]); chime()
      if (screen === 'world') { const s = SLOTS[m.slot]; game.heading = s.ry + Math.PI; offerFlowersAnim() }
      await refresh(); say(`${m.petName}에게 꽃을 바쳤어요 🌸`)
    } catch (e) { say((e as Error).message) } finally { setBusy(false) }
  }
  const light = async () => {
    setBusy(true)
    try {
      const t = await api.addTribute(m.id, 'candle', '🕯️')
      setTributes((x) => [...x, t]); chime()
      if (screen === 'world') { const s = SLOTS[m.slot]; game.heading = s.ry + Math.PI; offerFlowersAnim() }
      await refresh(); say(`${m.petName}를 위해 촛불을 밝혔어요 🕯️`)
    } catch (e) { say((e as Error).message) } finally { setBusy(false) }
  }
  const send = async () => {
    if (!letter.trim()) return
    setBusy(true)
    try {
      const t = await api.addTribute(m.id, 'letter', letter)
      setTributes((x) => [...x, t]); setLetter(''); setWriting(false); say('편지를 남겼어요. 편지는 주인과 작성자에게만 보여요.')
    } catch (e) { say((e as Error).message) } finally { setBusy(false) }
  }
  const toggle = async () => {
    const v: Visibility = m.visibility === 'public' ? 'private' : 'public'
    try { await api.setVisibility(m.id, v); await refresh(); say(v === 'private' ? '비공개로 전환했어요.' : '공개로 전환했어요.') } catch (e) { say((e as Error).message) }
  }
  const del = async () => {
    if (!confirm(`${m.petName}의 분향소를 삭제할까요? 되돌릴 수 없어요.`)) return
    try { await api.remove(m.id); close(); await refresh() } catch (e) { say((e as Error).message) }
  }
  return (
    <div className="overlay" onClick={close}>
      <div className="card shrine" role="dialog" aria-label={`${m.petName} 분향소`} onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={close} aria-label="닫기">✕</button>
        <Portrait m={m} className="portrait" />
        <h2>{m.petName} <small>{m.species}</small></h2>
        <p className="dates">{fmt(m.birthDate)} – {fmt(m.passedDate)}</p>
        <p className="msg">“{m.message || '고마웠어. 사랑해.'}”</p>
        <p className="meta">🌸 헌화 {flowers}송이 · 🕯️ 촛불 {candles}개 {mine && <span className={'badge ' + m.visibility}>{m.visibility === 'public' ? '공개' : '비공개'}</span>}</p>
        <div className="row">
          <button className="btn primary" disabled={busy} onClick={offer}>🌸 헌화하기</button>
          <button className="btn" disabled={busy || litByMe} onClick={light}>{litByMe ? '🕯️ 오늘 촛불을 켰어요' : '🕯️ 촛불 켜기'}</button>
          <button className="btn" onClick={() => setWriting((w) => !w)}>✉️ 편지 쓰기</button>
        </div>
        {writing && (
          <div className="letter">
            <textarea maxLength={LIMITS.letter} value={letter} onChange={(e) => setLetter(e.target.value)} placeholder="전하고 싶은 말을 적어 주세요" rows={4} />
            <div className="row"><span className="count">{letter.length}/{LIMITS.letter}</span><button className="btn primary" disabled={busy || !letter.trim()} onClick={send}>남기기</button></div>
          </div>
        )}
        {letters.length > 0 && (
          <div className="letters"><h4>남겨진 편지</h4>
            {letters.map((t) => <div key={t.id} className="note">{t.body}<time>{new Date(t.createdAt).toLocaleDateString('ko-KR')}{t.authorId === userId ? ' · 내가 쓴 편지' : ''}</time></div>)}
          </div>
        )}
        {mine && <div className="row owner"><button className="btn ghost" onClick={toggle}>{m.visibility === 'public' ? '🔒 비공개로 전환' : '🌍 공개로 전환'}</button><button className="btn ghost danger" onClick={del}>삭제</button></div>}
      </div>
    </div>
  )
}

export function RegisterModal() {
  const { registerSlot, memorials, userId, set, refresh, say } = useStore()
  const [f, setF0] = useState(resume.draft ?? { petName: '', species: '강아지', birthDate: '', passedDate: '', message: '', visibility: 'public' as Visibility })
  const setF = (v: typeof f) => { resume.draft = v; setF0(v) }
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})
  if (registerSlot === undefined) return null
  const close = () => set({ registerSlot: undefined })
  const myCount = memorials.filter((x) => x.ownerId === userId).length
  const pick = async (file?: File) => {
    if (!file) return
    try { const b = await sanitizePhoto(file); setPhoto(b); setPreview(URL.createObjectURL(b)) } catch (e) { say((e as Error).message) }
  }
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.petName.trim()) return say('이름을 입력해 주세요.')
    setBusy(true)
    try {
      const rec = await api.create({ ...f, photo }, registerSlot ?? undefined)
      resume.draft = null
      await refresh(); close(); say(`${rec.petName}의 분향소를 만들었어요.`)
      if (useStore.getState().screen === 'world') {
        const { goToSlot } = await import('../world/actions')
        goToSlot(rec.slot)
      } else set({ openId: rec.id })
    } catch (err) { say((err as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className="overlay" onClick={close}>
      <form className="card form" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <button type="button" className="x" onClick={close} aria-label="닫기">✕</button>
        <h2>분향소 만들기</h2>
        {myCount >= 3 && <p className="warn">이미 {myCount}개의 분향소가 있어요.</p>}
        <label>이름<input required maxLength={LIMITS.name} value={f.petName} onChange={(e) => setF({ ...f, petName: e.target.value })} placeholder="예: 초코" /></label>
        <label>종류<select value={f.species} onChange={(e) => setF({ ...f, species: e.target.value })}>{['강아지', '고양이', '토끼', '햄스터', '새', '기타'].map((s) => <option key={s}>{s}</option>)}</select></label>
        <div className="two">
          <label>태어난 날<input type="date" value={f.birthDate} onChange={(e) => setF({ ...f, birthDate: e.target.value })} /></label>
          <label>떠난 날<input type="date" value={f.passedDate} onChange={(e) => setF({ ...f, passedDate: e.target.value })} /></label>
        </div>
        <label>추모 메시지<textarea rows={3} maxLength={LIMITS.message} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} placeholder="하고 싶은 말을 적어 주세요" /></label>
        <div className="photo-pick">
          <span>사진 (선택)</span>
          {/* three different system pickers: some phones show the gallery in only one of them */}
          {([['album', '🖼️ 앨범에서 고르기', { accept: 'image/*' }], ['cam', '📷 카메라로 찍기', { accept: 'image/*', capture: 'environment' as const }], ['file', '📁 파일에서 고르기', { accept: '.jpg,.jpeg,.png,.webp,.heic,.heif' }]] as const).map(([k, label, attrs]) => (
            <div key={k} className="pick-row">
              <input ref={(el) => { fileRefs.current[k] = el }} type="file" className="sr-file" {...attrs} onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = '' }} />
              <button type="button" className={'btn' + (k === 'album' ? ' primary' : '')} onClick={() => fileRefs.current[k]?.click()}>{k === 'album' && preview ? '🖼️ 다른 사진 고르기' : label}</button>
            </div>
          ))}
          <small>사진은 자동으로 작게 줄여 저장돼요. 갤러리 사진이 안 보이면 폰 설정에서 브라우저의 '사진 및 동영상' 권한을 허용해 주세요. 사진 없이도 만들 수 있어요.</small>
        </div>
        {preview && <img className="preview" src={preview} alt="미리보기" />}
        <fieldset><legend>공개 범위</legend>
          <label className="radio"><input type="radio" checked={f.visibility === 'public'} onChange={() => setF({ ...f, visibility: 'public' })} /> 공개 — 다른 방문자도 볼 수 있어요</label>
          <label className="radio"><input type="radio" checked={f.visibility === 'private'} onChange={() => setF({ ...f, visibility: 'private' })} /> 비공개 — 나만 볼 수 있어요</label>
        </fieldset>
        <p className="hint">사진은 업로드 전 브라우저에서 위치 정보(EXIF)를 제거하고 크기를 줄여요.</p>
        <button className="btn primary" disabled={busy}>{busy ? '만드는 중…' : '분향소 만들기'}</button>
      </form>
    </div>
  )
}
