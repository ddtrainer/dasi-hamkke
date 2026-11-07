import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { flowers, FLOWER_COLORS } from './layout'
import { swayPatch } from './Vegetation'
import { shoreRadius, canStand, groundHeight, distToPath, POND, distToPolyline, STREAM, mulberry32, terrainHeight, COLLIDERS } from './terrain'
import { game } from './game'

const tex = (c: HTMLCanvasElement, aniso = 4) => {
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t
}
function flowerHeadTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128
  const g = c.getContext('2d')!
  g.translate(64, 64)
  const n = 7
  for (let ring = 0; ring < 2; ring++) {
    for (let i = 0; i < n; i++) {
      g.save(); g.rotate((i / n) * Math.PI * 2 + ring * 0.45)
      const grad = g.createRadialGradient(0, 0, 4, 0, 0, 56)
      grad.addColorStop(0, ring ? '#e9e9e9' : '#ffffff'); grad.addColorStop(1, ring ? '#bdbdbd' : '#e6e6e6')
      g.fillStyle = grad
      g.beginPath(); g.ellipse(30, 0, ring ? 24 : 28, ring ? 12 : 14, 0, 0, 7); g.fill()
      g.restore()
    }
  }
  g.fillStyle = '#c9b45a'; g.beginPath(); g.arc(0, 0, 10, 0, 7); g.fill()
  g.fillStyle = '#8a7a30'; g.beginPath(); g.arc(0, 0, 4, 0, 7); g.fill()
  return tex(c)
}
function stemTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128
  const g = c.getContext('2d')!
  g.strokeStyle = '#78c85a'; g.lineWidth = 4; g.beginPath(); g.moveTo(32, 128); g.quadraticCurveTo(30, 60, 32, 6); g.stroke()
  for (const [y, dir] of [[96, -1], [70, 1]] as const) {
    g.fillStyle = '#8bdc6a'; g.beginPath(); g.moveTo(32, y)
    g.quadraticCurveTo(32 + dir * 22, y - 18, 32 + dir * 28, y - 34); g.quadraticCurveTo(32 + dir * 8, y - 12, 32, y); g.fill()
  }
  return tex(c)
}
function grassTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128
  const g = c.getContext('2d')!
  const cols = ['#86d466', '#98e275', '#aeed88', '#7ac95c']
  for (let i = 0; i < 16; i++) {
    const x = 10 + Math.random() * 108, h = 45 + Math.random() * 50, lean = (Math.random() - 0.5) * 44
    g.fillStyle = cols[i % 4]
    g.beginPath(); g.moveTo(x - 6, 128); g.quadraticCurveTo(x + lean * 0.3, 128 - h * 0.5, x + lean, 128 - h); g.quadraticCurveTo(x + lean * 0.4 + 3, 128 - h * 0.5, x + 6, 128); g.fill()
  }
  return tex(c)
}
/** N crossed vertical quads, base at y = 0. */
function crossed(w: number, h: number, n = 2, yOff = 0) {
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < n; i++) {
    const g = new THREE.PlaneGeometry(w, h); g.translate(0, h / 2 + yOff, 0); g.rotateY((i / n) * Math.PI); parts.push(g)
  }
  return mergeGeometries(parts)!
}
function flatHead(size: number) {
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < 2; i++) {
    const g = new THREE.PlaneGeometry(size, size); g.rotateX(-Math.PI / 2 + (i ? 0.7 : 0.25)); g.rotateY(i * 1.9); parts.push(g)
  }
  return mergeGeometries(parts)!
}
// soft upward normals so lighting on cards is smooth
function upNormals(g: THREE.BufferGeometry) {
  const n = g.attributes.normal as THREE.BufferAttribute
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0)
  return g
}

export function Flowers({ density }: { density: number }) {
  const heads = useRef<THREE.InstancedMesh>(null!)
  const stems = useRef<THREE.InstancedMesh>(null!)
  const hm = useRef<THREE.MeshStandardMaterial>(null!)
  const sm = useRef<THREE.MeshStandardMaterial>(null!)
  const list = useMemo(() => flowers.filter((_, i) => (i % 100) / 100 < density), [density])
  const a = useMemo(() => ({ head: upNormals(flatHead(0.42)), stem: upNormals(crossed(0.3, 0.34)), ht: flowerHeadTexture(), st: stemTexture() }), [])
  useEffect(() => {
    const o = new THREE.Object3D(); const c = new THREE.Color()
    list.forEach((f, i) => {
      const h = 0.3 * f.s
      o.position.set(f.x, f.y + h, f.z); o.rotation.set(0, i * 2.1, 0); o.scale.setScalar(f.s * (0.8 + (i % 5) * 0.08)); o.updateMatrix()
      heads.current.setMatrixAt(i, o.matrix); heads.current.setColorAt(i, c.set(FLOWER_COLORS[f.c]))
      o.position.set(f.x, f.y, f.z); o.scale.setScalar(f.s); o.updateMatrix(); stems.current.setMatrixAt(i, o.matrix)
    })
    heads.current.instanceMatrix.needsUpdate = true; stems.current.instanceMatrix.needsUpdate = true
    if (heads.current.instanceColor) heads.current.instanceColor.needsUpdate = true
  }, [list])
  useFrame(() => { for (const r of [hm, sm]) { const sh = r.current?.userData.sh; if (sh) sh.uniforms.uTime.value = game.time } })
  return (
    <>
      <instancedMesh ref={heads} args={[a.head, undefined, list.length]} frustumCulled={false}>
        <meshStandardMaterial ref={(m) => { if (m) { hm.current = m; swayPatch(m, 0.1, 2.2, 0.0) } }} map={a.ht} alphaTest={0.5} side={THREE.DoubleSide} roughness={0.9} emissive="#ffffff" emissiveIntensity={0.08} />
      </instancedMesh>
      <instancedMesh ref={stems} args={[a.stem, undefined, list.length]} frustumCulled={false}>
        <meshStandardMaterial ref={(m) => { if (m) { sm.current = m; swayPatch(m, 0.12, 2.2, 0.0) } }} map={a.st} alphaTest={0.5} side={THREE.DoubleSide} roughness={1} />
      </instancedMesh>
    </>
  )
}

/** Dense swaying grass tufts across the meadow. */
export function Grass({ count }: { count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const mat = useRef<THREE.MeshStandardMaterial>(null!)
  const a = useMemo(() => ({ geo: upNormals(crossed(0.8, 0.42, 2)), t: grassTexture() }), [])
  const pts = useMemo(() => {
    const r = mulberry32(99)
    const out: { x: number; y: number; z: number; s: number }[] = []
    let tries = 0
    while (out.length < count && tries++ < count * 6) {
      const ang = r() * 6.283, rad = Math.sqrt(r()) * (shoreRadius(ang) - 4)
      const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad
      if (!canStand(x, z) || groundHeight(x, z) < 0.95) continue
      if (distToPath(x, z) < 1.5 || Math.abs(x) < 3 && z > 38) continue
      if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 0.4 || distToPolyline(x, z, STREAM) < 1.3) continue
      let blocked = false
      for (const c of COLLIDERS) if (Math.hypot(x - c.x, z - c.z) < c.r * 0.8) { blocked = true; break }
      if (blocked) continue
      out.push({ x, y: terrainHeight(x, z), z, s: 0.7 + r() * 0.9 })
    }
    return out
  }, [count])
  useEffect(() => {
    const o = new THREE.Object3D(); const c = new THREE.Color()
    pts.forEach((p, i) => {
      o.position.set(p.x, p.y - 0.02, p.z); o.rotation.set(0, i * 1.7, 0); o.scale.set(p.s, p.s * (0.75 + (i % 3) * 0.15), p.s); o.updateMatrix()
      ref.current.setMatrixAt(i, o.matrix)
      ref.current.setColorAt(i, c.setHSL(0.26 + (i % 7) * 0.006, 0.6, 0.66 + (i % 5) * 0.02))
    })
    ref.current.count = pts.length
    ref.current.instanceMatrix.needsUpdate = true
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true
  }, [pts])
  useFrame(() => { const sh = mat.current?.userData.sh; if (sh) sh.uniforms.uTime.value = game.time })
  return (
    <instancedMesh ref={ref} args={[a.geo, undefined, count]} frustumCulled={false}>
      <meshStandardMaterial ref={(m) => { if (m) { mat.current = m; swayPatch(m, 0.14, 1.5, 0.0) } }} map={a.t} alphaTest={0.45} side={THREE.DoubleSide} roughness={1} />
    </instancedMesh>
  )
}
