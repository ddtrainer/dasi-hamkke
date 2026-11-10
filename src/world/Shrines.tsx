import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SLOTS, terrainHeight } from './terrain'
import { useStore } from '../lib/store'
import { defaultPortrait } from '../lib/image'
import type { Memorial } from '../lib/types'
import { goToSlot } from './actions'
import { game } from './game'
import { EAR_BASE } from './DogModel'
import { PetBody } from './PetBody'
import type { PetProfile } from '../lib/pet'

function nameTexture(name: string, dates: string) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#f3eee2'; g.fillRect(0, 0, 512, 128)
  g.fillStyle = '#3b3128'; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.font = '700 60px "Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif'
  g.fillText(name, 256, 46)
  g.font = '28px "Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif'; g.fillStyle = '#7a6d5e'
  g.fillText(dates, 256, 100)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  return t
}
const yr = (d: string) => (d ? d.slice(0, 4) : '?')

function usePhoto(m: Memorial) {
  return useMemo(() => {
    const t = new THREE.Texture(); t.colorSpace = THREE.SRGBColorSpace
    const img = new Image(); img.crossOrigin = 'anonymous'
    img.onload = () => { t.image = img; t.needsUpdate = true }
    img.src = m.photoUrl ?? defaultPortrait(m.petName + m.id)
    return t
  }, [m.photoUrl, m.petName, m.id])
}

const STONE = '#d8d2c2', PLATFORM = '#d9bf9a', PILLAR = '#cfc9b8', ROOF = '#a8564a', ROOF_D = '#8a4a40'

/** Memorial pavilion: stepped platform, four pillars, terracotta pyramid roof, altar with candles and a framed photo. Local +z is the front. */
/** Candles lit by visitors, standing on the front step with flickering flames. */
function VisitorCandles({ n, seed }: { n: number; seed: number }) {
  const g = useRef<THREE.Group>(null!)
  useFrame(() => {
    g.current.children.forEach((c, i) => {
      const f = c.children[1]
      const k = 1 + Math.sin(game.time * 12 + seed + i * 1.9) * 0.14 + Math.sin(game.time * 19 + i * 3.1) * 0.08
      f.scale.set(k * 0.8, k * 1.25, k * 0.8)
    })
  })
  const c = Math.min(n, 9)
  return (
    <group ref={g}>
      {Array.from({ length: c }, (_, i) => (
        <group key={i} position={[(i - (c - 1) / 2) * 0.23, 0.16, 2.02 + (i % 2) * 0.07]}>
          <mesh position={[0, 0.06, 0]}><cylinderGeometry args={[0.04, 0.045, 0.12, 8]} /><meshStandardMaterial color={i % 2 ? '#fff6e0' : '#ffd9e2'} /></mesh>
          <mesh position={[0, 0.16, 0]}><sphereGeometry args={[0.035, 12, 10]} /><meshBasicMaterial color="#ff4a22" transparent opacity={0.78} depthWrite={false} toneMapped={false} /><mesh position={[0, -0.004, 0]} scale={[0.62, 0.7, 0.62]} renderOrder={2}><sphereGeometry args={[0.04, 10, 8]} /><meshBasicMaterial color="#fff27a" transparent opacity={1} depthTest={false} depthWrite={false} toneMapped={false} /></mesh></mesh>
        </group>
      ))}
    </group>
  )
}

/** The shrine's dog, sitting on the platform beside its photo while it is not out walking with its owner. */
function RestingDog({ pet, x, z, ry }: { pet: PetProfile; x: number; z: number; ry: number }) {
  const root = useRef<THREE.Group>(null!)
  const rig = useRef<THREE.Group>(null!)
  const legs = [useRef<THREE.Group>(null!), useRef<THREE.Group>(null!), useRef<THREE.Group>(null!), useRef<THREE.Group>(null!)]
  const tail = useRef<THREE.Group>(null!)
  const head = useRef<THREE.Group>(null!)
  const earL = useRef<THREE.Group>(null!), earR = useRef<THREE.Group>(null!)
  const tongue = useRef<THREE.Mesh>(null!)
  const refs = { rig, legs, tail, head, earL, earR, tongue }
  const wp = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    // only animate (and draw) when the visitor is near
    root.current.getWorldPosition(wp)
    const near = Math.hypot(game.pos.x - wp.x, game.pos.z - wp.z) < 40
    root.current.visible = near
    if (!near) return
    const t = game.time
    legs[0].current.rotation.x = legs[1].current.rotation.x = 0.55
    legs[2].current.rotation.x = legs[3].current.rotation.x = -1.35
    rig.current.rotation.x = -0.38; rig.current.position.y = 0.21
    head.current.rotation.x = 0.5 + Math.sin(t * 1.4) * 0.04
    head.current.rotation.y = Math.sin(t * 0.5 + x) * 0.3
    tail.current.rotation.z = Math.sin(t * 5 + z) * 0.35
    const base = EAR_BASE[pet.ears]
    earL.current.rotation.z = base; earR.current.rotation.z = -base
    tongue.current.visible = false
  })
  return (
    <group ref={root} position={[x, 0.3, z]} rotation-y={ry} scale={0.58 * pet.size * 0.9}>
      <PetBody pet={pet} outfit={null} refs={refs} />
    </group>
  )
}

function Shrine({ m, flowers, candles, mine }: { m: Memorial; flowers: number; candles: number; mine: boolean }) {
  const s = SLOTS[m.slot]
  // hillside: sit the platform on the uphill corner and carry a stone foundation down to the lowest ground
  const { y, base } = useMemo(() => {
    const c = Math.cos(s.ry), sn = Math.sin(s.ry)
    const hs = [[-1.75, -1.55], [1.75, -1.55], [-1.75, 1.85], [1.75, 1.85]].map(([lx, lz]) => terrainHeight(s.x + lx * c + lz * sn, s.z - lx * sn + lz * c))
    return { y: Math.max(...hs) - 0.05, base: Math.max(...hs) - Math.min(...hs) }
  }, [s])
  const photo = usePhoto(m)
  const pets = useStore((st) => st.pets)
  const companionId = useStore((st) => st.companionId)
  const rested = useStore((st) => st.rested)
  // the dog waits beside its photo only after it has been called out once and sent back to rest
  const dogPet = mine && rested.includes(m.id) ? pets[m.id] : undefined
  const label = useMemo(() => nameTexture(m.petName, `${yr(m.birthDate)} – ${yr(m.passedDate)}`), [m.petName, m.birthDate, m.passedDate])
  const flames = [useRef<THREE.Mesh>(null!), useRef<THREE.Mesh>(null!)]
  const photoGlow = useRef<THREE.MeshBasicMaterial>(null!)
  useFrame(() => {
    // the photo frame lights up while its dog steps out of (or back into) it
    const gl = game.glow
    const lit = gl.t >= 0 && Math.hypot(gl.x - s.x, gl.z - s.z) < 5 ? Math.sin(Math.min(1, (gl.t / 2.6) * 1.15) * Math.PI) : 0
    photoGlow.current.opacity = lit * 0.65
    flames.forEach((r, i) => {
      const f = 1 + Math.sin(game.time * 11 + m.slot + i * 2) * 0.12 + Math.sin(game.time * 17 + m.slot * 2 + i) * 0.08
      r.current.scale.set(f * 0.8, f * 1.2, f * 0.8)
    })
  })
  const n = Math.min(flowers, 12)
  const cols = ['#ff9ec4', '#ffffff', '#ffe066', '#c9a0ff', '#ff8a7a']
  const priv = m.visibility === 'private'
  return (
    <group position={[s.x, y, s.z]} rotation-y={s.ry} onClick={(e) => { e.stopPropagation(); goToSlot(m.slot) }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')}>
      {base > 0.1 && <mesh position={[0, -base / 2 - 0.2, 0.1]}><boxGeometry args={[3.3, base + 0.5, 3.8]} /><meshStandardMaterial color="#b9b29d" roughness={1} /></mesh>}
      {/* platform + front step */}
      <mesh position={[0, 0.05, 0]} receiveShadow castShadow><boxGeometry args={[3.5, 0.5, 3.1]} /><meshStandardMaterial color={PLATFORM} roughness={0.95} /></mesh>
      <mesh position={[0, 0.0, 1.85]} receiveShadow><boxGeometry args={[2.2, 0.32, 0.6]} /><meshStandardMaterial color="#cdb48f" roughness={0.95} /></mesh>
      {/* pillars */}
      {[[-1.4, -1.2], [1.4, -1.2], [-1.4, 1.2], [1.4, 1.2]].map(([px, pz], i) => (
        <mesh key={i} position={[px, 1.45, pz]} castShadow><cylinderGeometry args={[0.085, 0.1, 2.4, 10]} /><meshStandardMaterial color={PILLAR} roughness={0.9} /></mesh>
      ))}
      {/* roof */}
      <mesh position={[0, 2.68, 0]}><boxGeometry args={[3.3, 0.12, 3.0]} /><meshStandardMaterial color={ROOF_D} roughness={0.9} /></mesh>
      <mesh position={[0, 3.3, 0]} rotation-y={Math.PI / 4} scale={[1.04, 1, 0.93]} castShadow><coneGeometry args={[2.75, 1.15, 4]} /><meshStandardMaterial color={ROOF} flatShading roughness={0.85} /></mesh>
      <mesh position={[0, 3.95, 0]}><sphereGeometry args={[0.09, 10, 8]} /><meshStandardMaterial color="#e8d28a" /></mesh>
      {/* altar */}
      <mesh position={[0, 0.65, 0.35]} castShadow><boxGeometry args={[1.7, 0.75, 0.75]} /><meshStandardMaterial color={STONE} roughness={0.9} /></mesh>
      <mesh position={[0, 0.455, 0.725]}><planeGeometry args={[1.35, 0.33]} /><meshBasicMaterial map={label} toneMapped={false} /></mesh>
      {/* candles */}
      {[-0.6, 0.55].map((x, i) => (
        <group key={i} position={[x, 1.08, 0.4]}>
          <mesh position={[0, 0.07, 0]}><cylinderGeometry args={[0.045, 0.045, 0.16, 8]} /><meshStandardMaterial color="#fff6e0" /></mesh>
          <mesh ref={flames[i]} position={[0, 0.2, 0]}><sphereGeometry args={[0.04, 12, 10]} /><meshBasicMaterial color="#ff4a22" transparent opacity={0.78} depthWrite={false} toneMapped={false} /><mesh position={[0, -0.004, 0]} scale={[0.62, 0.7, 0.62]} renderOrder={2}><sphereGeometry args={[0.04, 10, 8]} /><meshBasicMaterial color="#fff27a" transparent opacity={1} depthTest={false} depthWrite={false} toneMapped={false} /></mesh></mesh>
        </group>
      ))}
      {/* flower vase on the altar */}
      <mesh position={[0, 1.07, 0.38]}><cylinderGeometry args={[0.07, 0.05, 0.14, 8]} /><meshStandardMaterial color="#9fd0e8" /></mesh>
      {Array.from({ length: 5 + n }, (_, i) => {
        const a = i * 2.4, r = 0.03 + (i % 5) * 0.03
        return (<mesh key={i} position={[Math.cos(a) * r, 1.2 + (i % 4) * 0.04 + Math.floor(i / 5) * 0.03, 0.38 + Math.sin(a) * r]}><icosahedronGeometry args={[0.06, 0]} /><meshStandardMaterial color={cols[i % cols.length]} flatShading /></mesh>)
      })}
      {/* framed photo on a pole behind the altar */}
      <mesh position={[0, 1.4, -0.12]}><cylinderGeometry args={[0.035, 0.035, 0.8, 6]} /><meshStandardMaterial color="#8a6a4c" /></mesh>
      <mesh position={[0, 1.95, -0.12]} castShadow><boxGeometry args={[1.12, 0.96, 0.08]} /><meshStandardMaterial color="#c8b794" roughness={0.8} /></mesh>
      <mesh position={[0, 1.95, -0.07]}><planeGeometry args={[0.92, 0.78]} /><meshBasicMaterial map={photo} toneMapped={false} /></mesh>
      <mesh position={[0, 1.95, -0.055]} renderOrder={3}><planeGeometry args={[1.0, 0.86]} /><meshBasicMaterial ref={photoGlow} color="#fff0c4" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} /></mesh>
      {/* flowers laid on the step by visitors */}
      {Array.from({ length: Math.min(flowers, 10) }, (_, i) => (
        <mesh key={i} position={[-0.8 + i * 0.18, 0.22, 1.85 + (i % 2) * 0.1]}><icosahedronGeometry args={[0.08, 0]} /><meshStandardMaterial color={cols[i % cols.length]} flatShading /></mesh>
      ))}
      {dogPet && companionId !== m.id && <RestingDog pet={dogPet} x={1.05} z={0.95} ry={0.45} />}
      {candles > 0 && <VisitorCandles n={candles} seed={m.slot} />}
      {mine && (
        <mesh position={[0, 4.5, 0]} rotation-x={Math.PI}><coneGeometry args={[0.16, 0.34, 4]} /><meshBasicMaterial color={priv ? '#9aa8ff' : '#ffd04a'} toneMapped={false} /></mesh>
      )}
    </group>
  )
}

function EmptySlot({ index }: { index: number }) {
  const s = SLOTS[index]
  const y = terrainHeight(s.x, s.z)
  const ring = useRef<THREE.Mesh>(null!)
  useFrame(() => { ring.current.rotation.z = game.time * 0.4; ring.current.position.y = 0.1 + Math.sin(game.time * 2 + index) * 0.03 })
  return (
    <group position={[s.x, y, s.z]} rotation-y={s.ry} onClick={(e) => { e.stopPropagation(); goToSlot(index) }}>
      <mesh position={[0, 0.06, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[1.7, 24]} /><meshBasicMaterial color="#fff6c8" transparent opacity={0.28} depthWrite={false} /></mesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.1, 0]}><ringGeometry args={[1.5, 1.65, 32]} /><meshBasicMaterial color="#ffe08a" transparent opacity={0.7} depthWrite={false} /></mesh>
      <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.03, 0.045, 0.6, 5]} /><meshStandardMaterial color="#7a5638" /></mesh>
      <mesh position={[0, 0.65, 0]}><icosahedronGeometry args={[0.2, 0]} /><meshStandardMaterial color="#8edc6a" flatShading /></mesh>
    </group>
  )
}

export function Shrines() {
  const memorials = useStore((s) => s.memorials)
  const counts = useStore((s) => s.flowerCounts)
  const candleCounts = useStore((s) => s.candleCounts)
  const me = useStore((s) => s.userId)
  const bySlot = useMemo(() => new Map(memorials.map((m) => [m.slot, m])), [memorials])
  useEffect(() => () => { document.body.style.cursor = '' }, [])
  return (
    <>
      {SLOTS.map((s) => {
        const m = bySlot.get(s.index)
        return m ? <Shrine key={m.id + m.photoUrl} m={m} flowers={counts[m.id] ?? 0} candles={candleCounts[m.id] ?? 0} mine={m.ownerId === me} /> : <EmptySlot key={'e' + s.index} index={s.index} />
      })}
    </>
  )
}
