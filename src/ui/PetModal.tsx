import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../lib/store'
import { BREEDS, BREED_IDS, breedProfile, savePet, MAX_MARKS, type Mark, type PartId, type PetProfile, type Pattern, type EarType, type TailType, type CoatStyle } from '../lib/pet'
import { DogBody, EAR_BASE } from '../world/DogModel'
import { chime } from '../lib/audio'

interface Paint { on: boolean; color: string; size: number }
function DogPreview({ pet, paint, onMark }: { pet: PetProfile; paint: Paint; onMark: (m: Mark) => void }) {
  const paintRef = useRef(paint)
  paintRef.current = paint
  const spin = useRef<THREE.Group>(null!)
  const rig = useRef<THREE.Group>(null!)
  const legs = [useRef<THREE.Group>(null!), useRef<THREE.Group>(null!), useRef<THREE.Group>(null!), useRef<THREE.Group>(null!)]
  const tail = useRef<THREE.Group>(null!)
  const head = useRef<THREE.Group>(null!)
  const earL = useRef<THREE.Group>(null!), earR = useRef<THREE.Group>(null!)
  const tongue = useRef<THREE.Mesh>(null!)
  const refs = { rig, legs, tail, head, earL, earR, tongue }
  const drag = useRef({ on: false, x: 0, v: 0.5 })
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    if (!drag.current.on && !paintRef.current.on) spin.current.rotation.y += dt * drag.current.v
    legs.forEach((l) => { if (l.current) l.current.rotation.x = 0 })
    if (rig.current) rig.current.position.y = 0.3
    if (tail.current) tail.current.rotation.z = Math.sin(t * 7) * 0.5
    if (head.current) head.current.rotation.x = Math.sin(t * 2) * 0.03
    const base = EAR_BASE[pet.ears], flop = Math.sin(t * 1.5) * 0.03
    if (earL.current) { earL.current.rotation.z = base + flop; earR.current.rotation.z = -base - flop }
    if (tongue.current) tongue.current.visible = false
  })
  return (
    <>
      <ambientLight intensity={0.9} />
      <hemisphereLight args={['#fff4e0', '#a6c58f', 0.7]} />
      <directionalLight position={[3, 5, 4]} intensity={1.6} color="#fff1d8" />
      <mesh position={[0, -0.02, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[1.1, 40]} /><meshStandardMaterial color="#9cc47e" roughness={1} /></mesh>
      <group
        ref={spin}
        scale={1.55 * Math.min(1, 1.1 / pet.size)}
        position={[0, 0, 0]}
        onPointerDown={(e) => { drag.current.on = true; drag.current.x = e.clientX; (e.target as Element)?.setPointerCapture?.(e.pointerId) }}
        onPointerMove={(e) => { if (drag.current.on) { spin.current.rotation.y += (e.clientX - drag.current.x) * 0.012; drag.current.x = e.clientX } }}
        onClick={(e) => {
          // paint mode: a tap on the dog puts a spot on the touched body part
          if (!paintRef.current.on || e.delta > 5 || !e.face) return
          let o: THREE.Object3D | null = e.object, part: THREE.Object3D | null = null
          while (o) { if (o.userData?.part) { part = o; break } o = o.parent }
          if (!part) return
          e.stopPropagation()
          const inv = part.matrixWorld.clone().invert()
          const p = part.worldToLocal(e.point.clone())
          const n = e.face.normal.clone().transformDirection(e.object.matrixWorld).transformDirection(inv)
          onMark({ part: part.userData.part as PartId, p: [p.x, p.y, p.z], n: [n.x, n.y, n.z], s: paintRef.current.size, c: paintRef.current.color })
        }}
        onPointerUp={() => { drag.current.on = false }}
        onPointerMissed={() => { drag.current.on = false }}
      >
        <group position={[0, 0, 0]} scale={0.58 * pet.size}>
          <DogBody pet={pet} outfit={null} refs={refs} />
        </group>
      </group>
    </>
  )
}

const PATTERNS: [Pattern, string][] = [['solid', '단색'], ['tan', '눈썹·볼·다리 포인트'], ['tuxedo', '턱시도'], ['urajiro', '볼·가슴 하얀'], ['patch', '얼룩'], ['spots', '점박이']]
const EARS: [EarType, string][] = [['perky', '쫑긋'], ['big', '큰 귀'], ['round', '동그란 귀'], ['fold', '반쯤 접힘'], ['drop', '축 처짐']]
const TAILS: [TailType, string][] = [['plume', '복슬 꼬리'], ['curl', '말린 꼬리'], ['straight', '긴 꼬리'], ['stub', '뭉툭 꼬리']]
const STYLES: [CoatStyle, string][] = [['smooth', '매끈'], ['fluffy', '복슬복슬'], ['curly', '곱슬']]
const SWATCH = ['#211d20', '#5a3b2a', '#8a5f38', '#b98a5a', '#d9a77a', '#e0b25f', '#e0903f', '#c8501f', '#9a9a9a', '#f4eee4', '#ffffff']

const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')

/** Reads the photo's main colours on this device (nothing is uploaded): coarse colour buckets, centre-weighted. */
function dominantColours(img: ImageData): string[] {
  const { data, width, height } = img
  const buckets = new Map<number, { w: number; r: number; g: number; b: number }>()
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (data[i + 3] < 200) continue
      const dx = x / width - 0.5, dy = y / height - 0.5
      const w = Math.exp(-(dx * dx + dy * dy) * 9) // the pet is usually near the middle
      const r = data[i], g = data[i + 1], b = data[i + 2]
      const key = (r >> 5) * 64 + (g >> 5) * 8 + (b >> 5)
      const e = buckets.get(key) ?? { w: 0, r: 0, g: 0, b: 0 }
      e.w += w; e.r += r * w; e.g += g * w; e.b += b * w
      buckets.set(key, e)
    }
  }
  const list = [...buckets.values()].sort((a, b) => b.w - a.w).map((e) => [e.r / e.w, e.g / e.w, e.b / e.w] as const)
  const picked: (readonly [number, number, number])[] = []
  for (const c of list) {
    if (picked.every((p) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) > 55)) picked.push(c)
    if (picked.length >= 4) break
  }
  return picked.map((c) => hex(...c))
}

const lum = (h: string) => { const n = parseInt(h.slice(1), 16); return (((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) / 255 }
const lighten = (h: string, t: number) => { const n = parseInt(h.slice(1), 16); return hex(...([(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v + (255 - v) * t) as [number, number, number])) }

const darken = (h: string, t: number) => { const n = parseInt(h.slice(1), 16); return hex(...([(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v * (1 - t)) as [number, number, number])) }
/** saturated greens and blues are almost always grass, sky or water — not fur */
function looksLikeBackground(h: string) {
  const n = parseInt(h.slice(1), 16), r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
  if (mx < 0.15 || d / (mx || 1) < 0.22) return false
  let hue = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  hue = ((hue * 60) + 360) % 360
  return hue > 75 && hue < 260
}

/** main coat = the most common fur-like colour, markings = the next different one, white spots = the lightest (or a pale tint of the coat). */
export function assignColours(all: string[]): { coat: string; accent: string; white: string } | null {
  if (!all.length) return null
  const fur = all.filter((c) => !looksLikeBackground(c))
  const list = fur.length ? fur : all
  const coat = list[0]
  const accent = list[1] ?? darken(coat, 0.35)
  const lightest = [...list].sort((a, b) => lum(b) - lum(a))[0]
  const white = lum(lightest) > 0.72 ? lightest : lighten(coat, 0.8)
  return { coat, accent, white }
}

/** Reads a photo (blob/object URL) and returns coat colours for the dog, or null. Nothing leaves the device. */
export function coatFromPhoto(src: string): Promise<{ coat: string; accent: string; white: string } | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        const k = Math.min(1, 160 / Math.max(img.width, img.height))
        c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k))
        const g = c.getContext('2d', { willReadFrequently: true })!
        g.drawImage(img, 0, 0, c.width, c.height)
        resolve(assignColours(dominantColours(g.getImageData(0, 0, c.width, c.height))))
      } catch { resolve(null) }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function PhotoPicker({ onUse, photoUrl }: { onUse: (key: 'coat' | 'accent' | 'white', c: string) => void; photoUrl?: string | null }) {
  const cv = useRef<HTMLCanvasElement>(null)
  const [has, setHas] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const [auto, setAuto] = useState<string[]>([])
  const loadUrl = (url: string, revoke: boolean) => {
    const img = new Image()
    img.onload = () => {
      const c = cv.current!
      const k = Math.min(1, 320 / Math.max(img.width, img.height))
      c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k))
      c.getContext('2d', { willReadFrequently: true })!.drawImage(img, 0, 0, c.width, c.height)
      if (revoke) URL.revokeObjectURL(url)
      setHas(true); setPicked(null)
      setAuto(dominantColours(c.getContext('2d')!.getImageData(0, 0, c.width, c.height)))
    }
    img.onerror = () => { if (revoke) URL.revokeObjectURL(url) }
    img.src = url
  }
  const load = (f: File) => loadUrl(URL.createObjectURL(f), true)
  const pick = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = cv.current!, r = c.getBoundingClientRect()
    const x = Math.floor(((e.clientX - r.left) / r.width) * c.width), y = Math.floor(((e.clientY - r.top) / r.height) * c.height)
    const x0 = Math.max(0, x - 2), y0 = Math.max(0, y - 2)
    const d = c.getContext('2d', { willReadFrequently: true })!.getImageData(x0, y0, Math.min(5, c.width - x0), Math.min(5, c.height - y0)).data
    let R = 0, G = 0, B = 0; const n = d.length / 4
    for (let i = 0; i < d.length; i += 4) { R += d[i]; G += d[i + 1]; B += d[i + 2] }
    setPicked(hex(R / n, G / n, B / n))
  }
  return (
    <div className="photo">
      <label className="btn small">📷 다른 사진에서 색 뽑기
        <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f); e.target.value = '' }} />
      </label>
      {photoUrl && <button type="button" className="btn small" onClick={() => loadUrl(photoUrl, false)}>🖼️ 분향소에 올린 사진에서 색 뽑기</button>}
      <p className="hint">사진은 이 기기 안에서만 쓰이고 어디로도 전송되지 않아요.</p>
      <canvas ref={cv} className="photo-cv" style={{ display: has ? 'block' : 'none' }} onPointerDown={pick} />
      {has && <>
        {auto.length > 0 && (
          <div className="row2">
            <span className="hint">사진의 주요 색</span>
            {auto.map((c) => (<button type="button" key={c} className="sw" style={{ background: c }} onClick={() => setPicked(c)} aria-label={c} />))}
            <button type="button" className="btn small" onClick={() => { const r = assignColours(auto); if (r) { onUse('coat', r.coat); onUse('accent', r.accent); onUse('white', r.white) } }}>자동으로 맞추기</button>
          </div>
        )}
        <p className="hint">사진을 눌러 색을 고른 뒤 어디에 칠할지 정해요.</p>
        {picked && (
          <div className="row2">
            <span className="sw big" style={{ background: picked }} />
            <button type="button" className="btn small" onClick={() => onUse('coat', picked)}>털 기본색</button>
            <button type="button" className="btn small" onClick={() => onUse('accent', picked)}>포인트색</button>
            <button type="button" className="btn small" onClick={() => onUse('white', picked)}>흰 털 자리</button>
          </div>
        )}
      </>}
    </div>
  )
}

function Slider({ label, v, lo, hi, on }: { label: string; v: number; lo: number; hi: number; on: (n: number) => void }) {
  return (
    <label className="sl"><span>{label}</span><input type="range" min={lo} max={hi} step={0.01} value={v} onChange={(e) => on(+e.target.value)} /></label>
  )
}

function ColorRow({ label, v, on }: { label: string; v: string; on: (c: string) => void }) {
  return (
    <div className="row2">
      <span className="lab">{label}</span>
      {SWATCH.map((c) => (<button type="button" key={c} className={'sw' + (c.toLowerCase() === v.toLowerCase() ? ' on' : '')} style={{ background: c }} onClick={() => on(c)} aria-label={c} />))}
      <input type="color" value={v} onChange={(e) => on(e.target.value)} aria-label={label + ' 직접 고르기'} />
    </div>
  )
}

export function PetEditor({ d, setD, photoUrl }: { d: PetProfile; setD: React.Dispatch<React.SetStateAction<PetProfile>>; photoUrl?: string | null }) {
  const up = (p: Partial<PetProfile>) => setD((o) => ({ ...o, ...p }))
  const key = useMemo(() => JSON.stringify([d.ears, d.tail, d.pattern, d.coatStyle]), [d.ears, d.tail, d.pattern, d.coatStyle])
  const [paint, setPaint] = useState<Paint>({ on: false, color: '#ffffff', size: 1.2 })
  const addMark = (m: Mark) => setD((o) => ({ ...o, marks: [...o.marks, m].slice(-MAX_MARKS) }))
  const chip = <T extends string>(list: [T, string][], cur: T, on: (v: T) => void) => (
    <div className="tabs wrap">{list.map(([k, l]) => (<button type="button" key={k} className={'tab' + (cur === k ? ' on' : '')} onClick={() => on(k)}>{l}</button>))}</div>
  )
  const toggle = (k: 'socks' | 'blaze' | 'tailTip' | 'browDots', label: string) => (
    <button type="button" className={'tab' + (d[k] ? ' on' : '')} onClick={() => up({ [k]: !d[k] })}>{label}</button>
  )
  return (
    <>
      <div className={'cmp' + (photoUrl ? ' two' : '')}>
        {photoUrl && <div className="cmp-ph"><img src={photoUrl} alt="우리 아이 사진" /><small>우리 아이 사진</small></div>}
        <div className={'pet-prev' + (paint.on ? ' painting' : '')}>
          <Canvas key={key} camera={{ position: [0, 0.95, 2.6], fov: 34 }} dpr={[1, 1.5]} onCreated={({ camera }) => camera.lookAt(0, 0.5, 0)}>
            <DogPreview pet={d} paint={paint} onMark={addMark} />
          </Canvas>
          <small>{paint.on ? '반려견을 누르면 점이 찍혀요' : '드래그하면 돌려볼 수 있어요'}</small>
        </div>
      </div>
      <h4>견종 (기본 모습)</h4>
      <div className="tabs wrap">{BREED_IDS.map((b) => (<button type="button" key={b} className={'tab' + (d.breed === b ? ' on' : '')} onClick={() => setD((o) => breedProfile(b, o.name))}>{BREEDS[b].icon} {BREEDS[b].label}</button>))}</div>
      <h4>털 색</h4>
      <ColorRow label="기본색" v={d.coat} on={(c) => up({ coat: c })} />
      <ColorRow label="포인트색" v={d.accent} on={(c) => up({ accent: c })} />
      <ColorRow label="흰 털 자리" v={d.white} on={(c) => up({ white: c })} />
      <PhotoPicker onUse={(k, c) => up({ [k]: c })} photoUrl={photoUrl} />
      <h4>무늬</h4>
      {chip(PATTERNS, d.pattern, (v) => up({ pattern: v }))}
      <h4>털 느낌</h4>
      {chip(STYLES, d.coatStyle, (v) => up({ coatStyle: v }))}
      <h4>귀</h4>
      {chip(EARS, d.ears, (v) => up({ ears: v }))}
      <h4>꼬리</h4>
      {chip(TAILS, d.tail, (v) => up({ tail: v }))}
      <h4>특징 표시 (우리 아이만의 점·무늬)</h4>
      <div className="tabs wrap">
        {toggle('socks', '🧦 양말(하얀 발)')}{toggle('blaze', '⚪ 얼굴 하얀 줄')}{toggle('tailTip', '꼬리 끝 하얀색')}{toggle('browDots', '눈썹 점')}
      </div>
      <div className="paintbox">
        <button type="button" className={'btn small' + (paint.on ? ' primary' : '')} onClick={() => setPaint((p) => ({ ...p, on: !p.on }))}>{paint.on ? '✏️ 점 찍는 중 (끄기)' : '✏️ 점 찍기 켜기'}</button>
        <div className="row2">
          {['#ffffff', '#211d20', '#5a3b2a', '#8a5f38', '#d9a059', '#e0903f', '#9a9a9a', '#ffb3c7'].map((c) => (<button type="button" key={c} className={'sw' + (paint.color === c ? ' on' : '')} style={{ background: c }} onClick={() => setPaint((p) => ({ ...p, color: c, on: true }))} aria-label={c} />))}
          <input type="color" value={paint.color} onChange={(e) => setPaint((p) => ({ ...p, color: e.target.value, on: true }))} aria-label="점 색 직접 고르기" />
        </div>
        <div className="row2">
          {([[0.7, '작게'], [1.2, '보통'], [2, '크게']] as const).map(([v, l]) => (<button type="button" key={l} className={'tab' + (paint.size === v ? ' on' : '')} onClick={() => setPaint((p) => ({ ...p, size: v }))}>{l}</button>))}
          <button type="button" className="btn small" disabled={!d.marks.length} onClick={() => setD((o) => ({ ...o, marks: o.marks.slice(0, -1) }))}>↩ 마지막 점 지우기</button>
          <button type="button" className="btn small" disabled={!d.marks.length} onClick={() => setD((o) => ({ ...o, marks: [] }))}>모두 지우기</button>
        </div>
        <p className="hint">점 {d.marks.length}/{MAX_MARKS} · 체형과 얼굴을 먼저 정한 뒤에 찍으면 위치가 어긋나지 않아요.</p>
      </div>
      <h4>얼굴 모양</h4>
      <Slider label="머리 크기" v={d.headSize} lo={0.85} hi={1.2} on={(n) => up({ headSize: n })} />
      <Slider label="눈 크기" v={d.eyeSize} lo={0.8} hi={1.4} on={(n) => up({ eyeSize: n })} />
      <Slider label="눈 사이" v={d.eyeGap} lo={0.8} hi={1.3} on={(n) => up({ eyeGap: n })} />
      <Slider label="귀 크기" v={d.earSize} lo={0.7} hi={1.4} on={(n) => up({ earSize: n })} />
      <Slider label="코 크기" v={d.noseSize} lo={0.7} hi={1.5} on={(n) => up({ noseSize: n })} />
      <h4>체형</h4>
      <Slider label="크기" v={d.size} lo={0.7} hi={1.5} on={(n) => up({ size: n })} />
      <Slider label="다리 길이" v={d.legs} lo={0.6} hi={1.25} on={(n) => up({ legs: n })} />
      <Slider label="통통함" v={d.chunk} lo={0.85} hi={1.3} on={(n) => up({ chunk: n })} />
      <Slider label="주둥이 길이" v={d.snout} lo={0.5} hi={1.5} on={(n) => up({ snout: n })} />
      <h4>눈 · 코</h4>
      <ColorRow label="눈 색" v={d.eye} on={(c) => up({ eye: c })} />
      <ColorRow label="코 색" v={d.nose} on={(c) => up({ nose: c })} />
    </>
  )
}

/** Opened from the HUD ("내 아이"): edit the look of the default dog or of any of my shrine dogs. */
export function PetModal() {
  const { petOpen, petTarget, pet, pets, memorials, userId, companionId, set, setPetFor, say } = useStore()
  const mine = memorials.filter((m) => m.ownerId === userId && pets[m.id])
  const [target, setTarget] = useState<string | null>(null)
  const [d, setD] = useState<PetProfile>(pet)
  const load = (t: string | null) => { setTarget(t); setD(t ? pets[t] ?? pet : pet) }
  useEffect(() => { if (petOpen) load(petTarget) }, [petOpen]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!petOpen) return null
  const close = () => set({ petOpen: false })
  const m = target ? memorials.find((x) => x.id === target) : undefined
  const save = () => {
    if (target) setPetFor(target, d); else { set({ pet: d }); savePet(d) }
    set({ petOpen: false }); chime(); say(`🐶 ${m ? m.petName : d.name || '우리 아이'}의 모습을 저장했어요!`)
  }
  const rest = async () => { const { restCompanion } = await import('../world/actions'); restCompanion(); close() }
  return (
    <div className="overlay" onClick={close}>
      <div className="card petm" role="dialog" aria-label="내 아이 모습 꾸미기" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={close} aria-label="닫기">✕</button>
        <h2>🐶 내 아이 모습</h2>
        {mine.length > 0 ? (
          <>
            <p className="hint">분향소 사진 속 아이의 모습을 고칠 수 있어요. 섬에서 함께 걸으려면 분향소에서 불러내 주세요.</p>
            <div className="tabs wrap">
              {mine.map((x) => (<button type="button" key={x.id} className={'tab' + (target === x.id ? ' on' : '')} onClick={() => load(x.id)}>🌸 {x.petName}{companionId === x.id ? ' · 함께 걷는 중' : ''}</button>))}
            </div>
          </>
        ) : (
          <p className="hint">분향소를 만들면 사진 속 아이가 이 섬에서 함께 걸어요. 그전에는 이 아이가 따라다녀요.</p>
        )}
        {target && companionId === target && <button type="button" className="btn small" onClick={() => void rest()}>🌙 분향소에서 쉬게 하기</button>}
        <PetEditor d={d} setD={setD} photoUrl={m?.photoUrl} />
        <div className="row2 end stick">
          <button className="btn" onClick={close}>취소</button>
          <button className="btn primary" onClick={save}>저장</button>
        </div>
      </div>
    </div>
  )
}
