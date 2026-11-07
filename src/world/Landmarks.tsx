import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { terrainHeight, LIGHTHOUSE, VIEWPOINT, HEADLAND } from './terrain'
import { reeds } from './layout'
import { game, tod } from './game'
import { swayPatch } from './Vegetation'

/** Lighthouse on the west headland: striped tower, glowing lantern room, a slow beam at dusk and night. */
export function Lighthouse() {
  const y = HEADLAND.top
  const beam = useRef<THREE.Group>(null!)
  const lamp = useRef<THREE.MeshStandardMaterial>(null!)
  const glow = useRef<THREE.PointLight>(null!)
  const beamMats = useRef<THREE.MeshBasicMaterial[]>([])
  useFrame((_, dt) => {
    const n = Math.max(tod.night, tod.dusk * 0.7)
    beam.current.rotation.y += dt * 0.55
    beam.current.visible = n > 0.02
    for (const m of beamMats.current) m.opacity = 0.34 * n
    lamp.current.emissiveIntensity = 0.5 + 2.2 * n
    glow.current.intensity = 3.2 * n
  })
  const stripes: [number, number, number, number, string][] = [
    // [y, height, rBottom, rTop, colour]
    [1.2, 2.4, 1.55, 1.35, '#f7f3ea'], [3.55, 2.3, 1.35, 1.17, '#d9504a'], [5.8, 2.2, 1.17, 1.0, '#f7f3ea'],
  ]
  return (
    <group position={[LIGHTHOUSE.x, terrainHeight(LIGHTHOUSE.x, LIGHTHOUSE.z), LIGHTHOUSE.z]}>
      <mesh position={[0, 0.25, 0]} castShadow><cylinderGeometry args={[2.0, 2.3, 0.7, 10]} /><meshStandardMaterial color="#b9b2a4" flatShading /></mesh>
      {stripes.map(([py, h, rb, rt, c], i) => (
        <mesh key={i} position={[0, py + 0.1, 0]} castShadow><cylinderGeometry args={[rt, rb, h, 14]} /><meshStandardMaterial color={c} roughness={0.9} /></mesh>
      ))}
      <mesh position={[0, 1.0, 1.5]}><boxGeometry args={[0.7, 1.3, 0.2]} /><meshStandardMaterial color="#6b4a30" /></mesh>
      <mesh position={[0, 4.0, 1.18]}><boxGeometry args={[0.45, 0.6, 0.12]} /><meshStandardMaterial color="#274a6b" emissive="#ffd98a" emissiveIntensity={0.3} /></mesh>
      <mesh position={[0, 7.05, 0]}><cylinderGeometry args={[1.5, 1.2, 0.2, 14]} /><meshStandardMaterial color="#3a3f48" /></mesh>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2
        return (<mesh key={i} position={[Math.cos(a) * 1.42, 7.45, Math.sin(a) * 1.42]}><boxGeometry args={[0.06, 0.7, 0.06]} /><meshStandardMaterial color="#3a3f48" /></mesh>)
      })}
      <mesh position={[0, 7.8, 0]}><cylinderGeometry args={[1.42, 1.42, 0.06, 14]} /><meshStandardMaterial color="#3a3f48" /></mesh>
      <mesh position={[0, 8.15, 0]}><cylinderGeometry args={[0.75, 0.75, 0.9, 12]} />
        <meshStandardMaterial ref={lamp} color="#fff0b8" emissive="#ffd24a" emissiveIntensity={0.5} transparent opacity={0.92} />
      </mesh>
      <mesh position={[0, 8.95, 0]} castShadow><coneGeometry args={[1.0, 0.9, 12]} /><meshStandardMaterial color="#d9504a" /></mesh>
      <mesh position={[0, 9.5, 0]}><sphereGeometry args={[0.14, 8, 8]} /><meshStandardMaterial color="#e8d28a" /></mesh>
      <pointLight ref={glow} position={[0, 8.15, 0]} color="#ffd98a" intensity={0} distance={30} decay={1.6} />
      <group ref={beam} position={[0, 8.15, 0]} visible={false}>
        {[0, Math.PI].map((r, i) => (
          <mesh key={i} position={[Math.cos(r) * 7.5, 0, Math.sin(r) * 7.5]} rotation={[0, -r, Math.PI / 2]}>
            <coneGeometry args={[2.4, 15, 16, 1, true]} />
            <meshBasicMaterial ref={(m) => { if (m) beamMats.current[i] = m }} color="#fff0b0" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} fog={false} />
          </mesh>
        ))}
      </group>
    </group>
  )
}
void game

/** Wooden viewing deck at the end of the headland, with a telescope. */
export function ViewDeck() {
  const y = HEADLAND.top
  const cx = VIEWPOINT.x, cz = VIEWPOINT.z
  return (
    <group position={[cx, y, cz]}>
      <mesh position={[0, 0.08, 0]} receiveShadow castShadow><boxGeometry args={[4.2, 0.16, 4.2]} /><meshStandardMaterial color="#b98552" roughness={1} /></mesh>
      {[-1.4, -0.7, 0, 0.7, 1.4].map((p) => (<mesh key={p} position={[p, 0.17, 0]}><boxGeometry args={[0.04, 0.02, 4.2]} /><meshStandardMaterial color="#8a5e36" /></mesh>))}
      {/* telescope on a tripod, facing the sea (west) */}
      <group position={[-1.2, 0.16, 0.3]} rotation-y={Math.PI / 2}>
        {[0, 2.1, 4.2].map((a) => (<mesh key={a} position={[Math.cos(a) * 0.25, 0.45, Math.sin(a) * 0.25]} rotation={[Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3]}><cylinderGeometry args={[0.025, 0.03, 0.95, 5]} /><meshStandardMaterial color="#4a3a2a" /></mesh>))}
        <mesh position={[0, 1.0, 0.1]} rotation-x={Math.PI / 2 - 0.15}><cylinderGeometry args={[0.1, 0.07, 0.8, 10]} /><meshStandardMaterial color="#d9504a" metalness={0.3} roughness={0.5} /></mesh>
      </group>
    </group>
  )
}

function reedTexture() {
  const c = document.createElement('canvas'); c.width = 96; c.height = 256
  const g = c.getContext('2d')!
  const cols = ['#9bbf5a', '#86ae4a', '#b3cf70']
  for (let i = 0; i < 9; i++) {
    const x = 10 + i * 9 + Math.random() * 4, h = 150 + Math.random() * 90, lean = (Math.random() - 0.5) * 26
    g.strokeStyle = cols[i % 3]; g.lineWidth = 3.4
    g.beginPath(); g.moveTo(x, 256); g.quadraticCurveTo(x + lean * 0.2, 256 - h * 0.5, x + lean, 256 - h); g.stroke()
    if (i % 3 === 1) { // cattail
      g.strokeStyle = '#8b6a3f'; g.lineWidth = 7
      g.beginPath(); g.moveTo(x + lean, 256 - h); g.lineTo(x + lean + lean * 0.05, 256 - h - 26); g.stroke()
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  return t
}
/** Reeds and cattails around the pond and along the stream. */
export function Reeds() {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const mat = useRef<THREE.MeshStandardMaterial>(null!)
  const a = useMemo(() => {
    const parts: THREE.BufferGeometry[] = []
    for (let i = 0; i < 2; i++) { const g = new THREE.PlaneGeometry(0.9, 1.5); g.translate(0, 0.75, 0); g.rotateY((i / 2) * Math.PI); parts.push(g) }
    const geo = mergeGeometries(parts)!
    const n = geo.attributes.normal as THREE.BufferAttribute
    for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0)
    return { geo, tex: reedTexture() }
  }, [])
  useEffect(() => {
    const o = new THREE.Object3D()
    reeds.forEach((r, i) => { o.position.set(r.x, r.y - 0.03, r.z); o.rotation.set(0, i * 2.3, 0); o.scale.setScalar(r.s); o.updateMatrix(); ref.current.setMatrixAt(i, o.matrix) })
    ref.current.instanceMatrix.needsUpdate = true
  }, [])
  useFrame(() => { const sh = mat.current?.userData.sh; if (sh) sh.uniforms.uTime.value = game.time })
  return (
    <instancedMesh ref={ref} args={[a.geo, undefined, reeds.length]} frustumCulled={false}>
      <meshStandardMaterial ref={(m) => { if (m) { mat.current = m; swayPatch(m, 0.12, 1.7, 0.0) } }} map={a.tex} alphaTest={0.45} side={THREE.DoubleSide} roughness={1} />
    </instancedMesh>
  )
}
