import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { terrainHeight, groundHeight } from './terrain'
import { dogPark, wishForest, cafe, stargaze } from './layout'
import { game, tod } from './game'
import { useStore } from '../lib/store'

const stripes = (a: string, b: string) => {
  const c = document.createElement('canvas'); c.width = 128; c.height = 32
  const g = c.getContext('2d')!
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * 16, 0, 16, 32) }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** The tennis ball: flies in an arc, rolls to rest, is carried by the dog. */
export function Ball() {
  const ref = useRef<THREE.Mesh>(null!)
  const age = useRef(0)
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05), b = game.ball
    const m = ref.current
    if (b.s === 'none') { m.visible = false; age.current = 0; return }
    m.visible = true
    age.current += dt
    if (age.current > 30) { b.s = 'none'; return } // safety: never leave the dog chasing forever
    if (b.s === 'fly') {
      b.vy -= 9.8 * dt
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt
      const gy = groundHeight(b.x, b.z) + 0.16
      if (b.y <= gy) { b.y = gy; b.s = 'rest'; b.vx = b.vz = b.vy = 0 }
    } else if (b.s === 'carry') {
      const hd = Math.atan2(game.dog.x - game.pos.x, game.dog.z - game.pos.z)
      b.x = game.dog.x + Math.sin(hd) * 0.28; b.z = game.dog.z + Math.cos(hd) * 0.28; b.y = game.dog.y + 0.42
    }
    m.position.set(b.x, b.y, b.z)
    m.rotation.x += dt * 8
  })
  return (
    <mesh ref={ref} visible={false} castShadow>
      <sphereGeometry args={[0.13, 12, 10]} />
      <meshStandardMaterial color="#d9f23a" emissive="#9ab81a" emissiveIntensity={0.35} roughness={0.9} />
    </mesh>
  )
}

export function DogPark() {
  const { c, hoops, tunnel, house } = dogPark
  const y = (x: number, z: number) => terrainHeight(x, z)
  return (
    <group>
      {/* soft sandy play ground */}
      <mesh position={[c.x, y(c.x, c.z) + 0.03, c.z]} rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[4.9, 28]} /><meshStandardMaterial color="#f2e2b4" roughness={1} transparent opacity={0.75} />
      </mesh>
      {hoops.map(([x, z], i) => (
        <group key={i} position={[x, y(x, z), z]} rotation-y={i ? 0.5 : -0.4}>
          <mesh position={[0, 0.62, 0]} castShadow><torusGeometry args={[0.5, 0.05, 8, 24]} /><meshStandardMaterial color={i ? '#4aa3e8' : '#ff7a59'} /></mesh>
          {[-0.62, 0.62].map((px) => (<mesh key={px} position={[px, 0.3, 0]}><boxGeometry args={[0.07, 0.6, 0.07]} /><meshStandardMaterial color="#f4efe6" /></mesh>))}
          <mesh position={[0, 0.03, 0]}><boxGeometry args={[1.5, 0.06, 0.18]} /><meshStandardMaterial color="#f4efe6" /></mesh>
        </group>
      ))}
      {/* play tunnel */}
      <group position={[tunnel[0], y(tunnel[0], tunnel[1]), tunnel[1]]} rotation-y={0.3}>
        <mesh position={[0, 0.5, 0]} rotation-z={Math.PI / 2} scale={[1, 1, 1]} castShadow>
          <cylinderGeometry args={[0.55, 0.55, 2.0, 16, 1, true, 0, Math.PI * 2]} /><meshStandardMaterial color="#ffb347" side={THREE.DoubleSide} roughness={0.8} />
        </mesh>
        {[-0.6, 0, 0.6].map((px) => (<mesh key={px} position={[px, 0.5, 0]} rotation-y={Math.PI / 2}><torusGeometry args={[0.56, 0.035, 6, 20]} /><meshStandardMaterial color="#e8912b" /></mesh>))}
      </group>
      {/* doghouse + bowl */}
      <group position={[house[0], y(house[0], house[1]), house[1]]} rotation-y={-0.6}>
        <mesh position={[0, 0.45, 0]} castShadow><boxGeometry args={[1.3, 0.9, 1.2]} /><meshStandardMaterial color="#d9a066" /></mesh>
        <mesh position={[0, 1.1, 0]} rotation-z={Math.PI / 4} scale={[1, 1, 1]}><boxGeometry args={[0.95, 0.95, 1.35]} /><meshStandardMaterial color="#d9504a" /></mesh>
        <mesh position={[0, 0.32, 0.61]}><circleGeometry args={[0.24, 16]} /><meshStandardMaterial color="#3b2a1a" /></mesh>
        <mesh position={[0.95, 0.07, 0.4]}><cylinderGeometry args={[0.2, 0.16, 0.12, 12]} /><meshStandardMaterial color="#6fb7e8" /></mesh>
      </group>
    </group>
  )
}

const RIBBON_COLORS = ['#ff9ec4', '#ffe066', '#a9d8ff', '#c9a0ff', '#ffb38a', '#9be3b0']
export function WishForest() {
  const { c, spots } = wishForest
  const ribbons = useStore((s) => s.ribbons)
  const ref = useRef<THREE.InstancedMesh>(null!)
  const lamp = useRef<THREE.MeshStandardMaterial>(null!)
  const slots = useMemo(() => {
    // 60 fixed hanging spots around the trees (the n-th wish takes the n-th spot)
    const out: { x: number; y: number; z: number; ry: number; col: string }[] = []
    for (let i = 0; i < 60; i++) {
      const [tx, tz] = spots[i % spots.length]
      const a = (i * 2.399) % (Math.PI * 2), r = 0.45 + ((i * 7) % 5) * 0.12
      out.push({ x: tx + Math.cos(a) * r, y: terrainHeight(tx, tz) + 1.9 + ((i * 13) % 7) * 0.18, z: tz + Math.sin(a) * r, ry: a, col: RIBBON_COLORS[i % RIBBON_COLORS.length] })
    }
    return out
  }, [spots])
  useEffect(() => {
    const o = new THREE.Object3D(); const col = new THREE.Color()
    slots.forEach((s, i) => {
      o.position.set(s.x, s.y, s.z); o.rotation.set(0, s.ry, 0); o.scale.setScalar(i < ribbons ? 1 : 0.0001); o.updateMatrix()
      ref.current.setMatrixAt(i, o.matrix); ref.current.setColorAt(i, col.set(s.col))
    })
    ref.current.instanceMatrix.needsUpdate = true
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true
  }, [ribbons, slots])
  useFrame(() => { lamp.current.emissiveIntensity = 0.8 + 2.4 * Math.max(tod.night, tod.dusk * 0.8) })
  const cy = terrainHeight(c.x, c.z)
  return (
    <group>
      <instancedMesh ref={ref} args={[undefined, undefined, 60]} frustumCulled={false}>
        <boxGeometry args={[0.07, 0.62, 0.015]} /><meshStandardMaterial roughness={0.9} side={THREE.DoubleSide} />
      </instancedMesh>
      {/* memorial stone */}
      <group position={[c.x, cy, c.z]}>
        <mesh position={[0, 0.12, 0]}><cylinderGeometry args={[0.85, 0.95, 0.24, 10]} /><meshStandardMaterial color="#cfc8ba" flatShading /></mesh>
        <mesh position={[0, 0.78, 0]} castShadow><boxGeometry args={[0.7, 1.1, 0.28]} /><meshStandardMaterial color="#b9b3a6" flatShading /></mesh>
        <mesh position={[0, 0.88, 0.15]}><planeGeometry args={[0.46, 0.5]} /><meshStandardMaterial color="#e9e3d6" /></mesh>
        <mesh position={[0, 1.4, 0]}><sphereGeometry args={[0.1, 8, 8]} /><meshStandardMaterial ref={lamp} color="#ffe9a8" emissive="#ffc95e" emissiveIntensity={0.8} /></mesh>
      </group>
    </group>
  )
}

export function Cafe() {
  const { c, kiosk, tables } = cafe
  const awning = useMemo(() => stripes('#ff9ec4', '#fff6ee'), [])
  const lampMat = useRef<THREE.MeshStandardMaterial>(null!)
  useFrame(() => { lampMat.current.emissiveIntensity = 0.6 + 2.2 * Math.max(tod.night, tod.dusk * 0.8) })
  const ky = terrainHeight(kiosk[0], kiosk[1])
  return (
    <group>
      <group position={[kiosk[0], ky, kiosk[1]]} rotation-y={Math.PI}>
        <mesh position={[0, 0.55, 0]} castShadow><boxGeometry args={[2.6, 1.1, 1.1]} /><meshStandardMaterial color="#c99a5b" /></mesh>
        <mesh position={[0, 1.15, 0.1]}><boxGeometry args={[2.8, 0.08, 1.3]} /><meshStandardMaterial color="#f4efe6" /></mesh>
        <mesh position={[0, 1.45, -0.35]}><boxGeometry args={[2.5, 0.6, 0.12]} /><meshStandardMaterial color="#8a5e36" /></mesh>
        {[-1.2, 1.2].map((px) => (<mesh key={px} position={[px, 1.35, 0.55]}><boxGeometry args={[0.08, 1.5, 0.08]} /><meshStandardMaterial color="#8a5e36" /></mesh>))}
        <mesh position={[0, 2.25, 0.25]} rotation-x={-0.35} castShadow><boxGeometry args={[3.0, 0.07, 1.5]} /><meshStandardMaterial map={awning} /></mesh>
        <mesh position={[0, 1.3, 0.05]}><boxGeometry args={[0.2, 0.2, 0.2]} /><meshStandardMaterial ref={lampMat} color="#ffe9a8" emissive="#ffc95e" emissiveIntensity={0.6} /></mesh>
        <mesh position={[-0.7, 1.28, 0.0]}><cylinderGeometry args={[0.09, 0.07, 0.16, 8]} /><meshStandardMaterial color="#ffffff" /></mesh>
        <mesh position={[0.6, 1.3, 0.0]}><cylinderGeometry args={[0.12, 0.12, 0.2, 10]} /><meshStandardMaterial color="#e8d28a" /></mesh>
      </group>
      {tables.map(([x, z], i) => {
        const ty = terrainHeight(x, z)
        return (
          <group key={i} position={[x, ty, z]}>
            <mesh position={[0, 0.72, 0]}><cylinderGeometry args={[0.55, 0.55, 0.06, 16]} /><meshStandardMaterial color="#f4efe6" /></mesh>
            <mesh position={[0, 0.36, 0]}><cylinderGeometry args={[0.06, 0.1, 0.72, 8]} /><meshStandardMaterial color="#6b5a46" /></mesh>
            <mesh position={[0, 2.0, 0]} castShadow><coneGeometry args={[1.05, 0.5, 12]} /><meshStandardMaterial color={i ? '#8fd0ff' : '#ffb3c8'} /></mesh>
            <mesh position={[0, 1.2, 0]}><cylinderGeometry args={[0.03, 0.03, 1.6, 6]} /><meshStandardMaterial color="#f4efe6" /></mesh>
            {[0, 2.1, 4.2].map((a) => (<mesh key={a} position={[Math.cos(a) * 0.78, 0.28, Math.sin(a) * 0.78]}><cylinderGeometry args={[0.2, 0.2, 0.28, 10]} /><meshStandardMaterial color="#c99a5b" /></mesh>))}
            <mesh position={[0.1, 0.78, 0.1]}><cylinderGeometry args={[0.07, 0.06, 0.1, 8]} /><meshStandardMaterial color="#ffffff" /></mesh>
          </group>
        )
      })}
      <mesh position={[c.x, terrainHeight(c.x, c.z) + 0.03, c.z - 0.2]} rotation-x={-Math.PI / 2}><circleGeometry args={[4.3, 24]} /><meshStandardMaterial color="#efe0b8" transparent opacity={0.7} roughness={1} /></mesh>
    </group>
  )
}

export function StarHill() {
  const { c, blanket, scope } = stargaze
  const by = terrainHeight(blanket[0], blanket[1])
  const sy = terrainHeight(scope[0], scope[1])
  const tex = useMemo(() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64
    const g = cv.getContext('2d')!
    g.fillStyle = '#6f8fd8'; g.fillRect(0, 0, 64, 64)
    g.fillStyle = '#4c6ab8'; for (let i = 0; i < 64; i += 16) { g.fillRect(i, 0, 8, 64); g.fillRect(0, i, 64, 8) }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t
  }, [])
  const lamp = useRef<THREE.MeshStandardMaterial>(null!)
  useFrame(() => { lamp.current.emissiveIntensity = 0.7 + 2.6 * Math.max(tod.night, tod.dusk * 0.8) })
  return (
    <group>
      <mesh position={[blanket[0], by + 0.04, blanket[1]]} rotation={[-Math.PI / 2, 0, 0.5]} receiveShadow><planeGeometry args={[2.2, 1.5]} /><meshStandardMaterial map={tex} roughness={1} /></mesh>
      <mesh position={[blanket[0] - 0.6, by + 0.14, blanket[1] - 0.2]}><sphereGeometry args={[0.2, 10, 8]} /><meshStandardMaterial color="#fff3e0" /></mesh>
      <group position={[scope[0], sy, scope[1]]} rotation-y={0.9}>
        {[0, 2.1, 4.2].map((a) => (<mesh key={a} position={[Math.cos(a) * 0.3, 0.55, Math.sin(a) * 0.3]} rotation={[Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3]}><cylinderGeometry args={[0.03, 0.035, 1.15, 5]} /><meshStandardMaterial color="#4a3a2a" /></mesh>))}
        <mesh position={[0, 1.2, 0]} rotation-x={Math.PI / 2 - 0.9}><cylinderGeometry args={[0.13, 0.09, 1.1, 10]} /><meshStandardMaterial color="#2f4f8f" metalness={0.4} roughness={0.5} /></mesh>
      </group>
      <group position={[c.x + 0.2, terrainHeight(c.x + 0.2, c.z + 2.3), c.z + 2.3]}>
        <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.18, 0.2, 0.4, 8]} /><meshStandardMaterial color="#5a4a3a" /></mesh>
        <mesh position={[0, 0.5, 0]}><boxGeometry args={[0.24, 0.3, 0.24]} /><meshStandardMaterial ref={lamp} color="#ffd98a" emissive="#ffb84a" emissiveIntensity={0.7} /></mesh>
      </group>
    </group>
  )
}

/** Shooting stars: a bright head with a long fading trail streaks across the night sky every few seconds. */
export function ShootingStars() {
  const mesh = useRef<THREE.Mesh>(null!)
  const mat = useRef<THREE.MeshBasicMaterial>(null!)
  const tex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 16
    const g = c.getContext('2d')!
    const gr = g.createLinearGradient(0, 0, 256, 0)
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.55, 'rgba(190,215,255,0.3)'); gr.addColorStop(0.9, 'rgba(235,245,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,1)')
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, 8); g.lineTo(236, 6.6); g.lineTo(256, 8); g.lineTo(236, 9.4); g.closePath(); g.fill()
    const hg = g.createRadialGradient(248, 8, 0, 248, 8, 6); hg.addColorStop(0, 'rgba(255,255,255,1)'); hg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = hg; g.fillRect(238, 0, 18, 16)
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
  }, [])
  const st = useRef({ next: 2.5, t: -1, dir: new THREE.Vector3(), v: new THREE.Vector3(-1, 0, 0) })
  if (import.meta.env.DEV) (window as unknown as { __shoot: () => void }).__shoot = () => { st.current.next = 0 }
  const basisX = useMemo(() => new THREE.Vector3(), [])
  const basisY = useMemo(() => new THREE.Vector3(), [])
  const basisZ = useMemo(() => new THREE.Vector3(), [])
  const m4 = useMemo(() => new THREE.Matrix4(), [])
  useFrame(({ camera }, dt) => {
    const s = st.current, n = tod.night
    if (n < 0.6) { mesh.current.visible = false; s.t = -1; return }
    s.next -= dt
    if (s.t < 0 && s.next <= 0) {
      // appears somewhere in the part of the sky the camera is looking at and always streaks from the right of the screen to the left, slightly downwards
      s.t = 0; s.next = 4 + Math.random() * 7
      const f = camera.getWorldDirection(new THREE.Vector3())
      const r = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).setY(0).normalize()
      s.dir.copy(f).addScaledVector(r, (Math.random() - 0.5) * 1.0).addScaledVector(new THREE.Vector3(0, 1, 0), (Math.random() - 0.35) * 0.5)
      if (s.dir.y < 0.25) s.dir.y = 0.25 + Math.random() * 0.3
      s.dir.normalize()
      s.v.copy(r).multiplyScalar(-1).add(new THREE.Vector3(0, -0.45, 0)).normalize()
    }
    if (s.t < 0) { mesh.current.visible = false; return }
    s.t += dt / 1.4
    if (s.t > 1) { s.t = -1; mesh.current.visible = false; return }
    const R = 600
    const dir = s.dir, v = s.v
    const pos = camera.position.clone().addScaledVector(dir, R).addScaledVector(v, (s.t - 0.5) * 360)
    mesh.current.position.copy(pos)
    basisZ.copy(camera.position).sub(pos).normalize()
    basisX.copy(v).addScaledVector(basisZ, -v.dot(basisZ)).normalize()
    basisY.crossVectors(basisZ, basisX)
    m4.makeBasis(basisX, basisY, basisZ)
    mesh.current.quaternion.setFromRotationMatrix(m4)
    mesh.current.visible = true
    mat.current.opacity = Math.sin(Math.min(1, s.t * 1.15) * Math.PI) * n
  })
  return (
    <mesh ref={mesh} visible={false} renderOrder={-5}>
      <planeGeometry args={[230, 7]} />
      <meshBasicMaterial ref={mat} map={tex} transparent opacity={0} depthWrite={false} depthTest fog={false} blending={THREE.AdditiveBlending} />
    </mesh>
  )
}

export function Places() {
  return (<><DogPark /><WishForest /><Cafe /><StarHill /><Ball /></>)
}
