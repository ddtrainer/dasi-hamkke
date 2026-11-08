import { useRef, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore, type AvatarId } from '../lib/store'
import { AvatarBody, LOOKS } from '../world/Characters'
import { enterWorld } from '../lib/enter'
import { chime } from '../lib/audio'

const OPTIONS: { id: AvatarId; label: string; icon: string; desc: string }[] = [
  { id: 'girl', label: '여자', icon: '👩', desc: '긴 검은 머리, 아이보리 니트와 하늘색 치마' },
  { id: 'boy', label: '남자', icon: '👨', desc: '단정한 검은 머리, 네이비 맨투맨과 베이지 바지' },
]

function Preview({ id }: { id: AvatarId }) {
  const spin = useRef<THREE.Group>(null!)
  const r = {
    root: useRef<THREE.Group>(null!), body: useRef<THREE.Group>(null!), armL: useRef<THREE.Group>(null!), armR: useRef<THREE.Group>(null!),
    legL: useRef<THREE.Group>(null!), legR: useRef<THREE.Group>(null!), head: useRef<THREE.Group>(null!), hat: useRef<THREE.Group>(null!),
    pack: useRef<THREE.Group>(null!), bouquet: useRef<THREE.Group>(null!), eyeL: useRef<THREE.Group>(null!), eyeR: useRef<THREE.Group>(null!),
  }
  const drag = useRef({ on: false, x: 0 })
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    if (!drag.current.on) spin.current.rotation.y += dt * 0.6
    r.armL.current.rotation.z = 0.1; r.armR.current.rotation.z = -0.1
    r.body.current.position.y = Math.sin(t * 1.8) * 0.012
    r.head.current.rotation.y = Math.sin(t * 0.8) * 0.15
    if (r.bouquet.current) r.bouquet.current.visible = false
    r.eyeL.current.scale.y = r.eyeR.current.scale.y = (t % 3.8) < 0.12 ? 0.1 : 1
  })
  return (
    <>
      <ambientLight intensity={0.95} />
      <hemisphereLight args={['#fff4e0', '#a6c58f', 0.7]} />
      <directionalLight position={[3, 5, 4]} intensity={1.6} color="#fff1d8" />
      <mesh position={[0, -0.02, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[1.1, 40]} /><meshStandardMaterial color="#9cc47e" roughness={1} /></mesh>
      <group ref={spin}
        onPointerDown={(e) => { drag.current.on = true; drag.current.x = e.clientX }}
        onPointerMove={(e) => { if (drag.current.on) { spin.current.rotation.y += (e.clientX - drag.current.x) * 0.012; drag.current.x = e.clientX } }}
        onPointerUp={() => { drag.current.on = false }} onPointerMissed={() => { drag.current.on = false }}>
        <AvatarBody look={LOOKS[id]} goods={[]} refs={r} />
      </group>
    </>
  )
}

/** Shown when entering the island (and from the HUD): pick the person to play. */
export function AvatarModal() {
  const { avatarFor, avatar, set, setAvatar } = useStore()
  const [pick, setPick] = useState<AvatarId>(avatar)
  useEffect(() => { if (avatarFor) setPick(avatar) }, [avatarFor]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!avatarFor) return null
  const entering = avatarFor === 'enter'
  const close = () => set({ avatarFor: null })
  const go = () => {
    setAvatar(pick); chime(); set({ avatarFor: null })
    if (entering) enterWorld()
  }
  return (
    <div className="overlay" onClick={close}>
      <div className="card avatarm" role="dialog" aria-label="캐릭터 선택" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={close} aria-label="닫기">✕</button>
        <h2>🧑 어떤 모습으로 들어갈까요?</h2>
        <p className="hint">섬에서 반려견과 함께 걸을 내 캐릭터를 골라 주세요. 언제든 위쪽 🧑 캐릭터 버튼으로 바꿀 수 있어요.</p>
        <div className="pet-prev tall">
          <Canvas key={pick} camera={{ position: [0, 1.15, 4.1], fov: 34 }} dpr={[1, 1.5]} onCreated={({ camera }) => camera.lookAt(0, 0.95, 0)}>
            <Preview id={pick} />
          </Canvas>
          <small>드래그하면 돌려볼 수 있어요</small>
        </div>
        <div className="avatar-opts">
          {OPTIONS.map((o) => (
            <button key={o.id} type="button" className={'avopt' + (pick === o.id ? ' on' : '')} onClick={() => setPick(o.id)}>
              <span className="ic">{o.icon}</span><b>{o.label}</b><small>{o.desc}</small>
            </button>
          ))}
        </div>
        <button className="btn primary big" onClick={go}>{entering ? '이 모습으로 입장하기' : '저장'}</button>
      </div>
    </div>
  )
}
