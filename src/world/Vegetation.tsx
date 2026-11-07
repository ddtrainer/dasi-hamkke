import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { trees, rocks } from './layout'
import { mulberry32 } from './terrain'
import { game } from './game'


export function swayPatch(mat: THREE.Material, amp: number, speed: number, off = 0.6) {
  const m = mat as THREE.MeshStandardMaterial
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = { value: 0 }
    m.userData.sh = sh
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       #ifdef USE_INSTANCING
         float ph = instanceMatrix[3].x*0.7 + instanceMatrix[3].z*0.5;
       #else
         float ph = 0.0;
       #endif
       transformed.x += sin(uTime*${speed.toFixed(2)} + ph) * ${amp.toFixed(3)} * (position.y + ${off.toFixed(2)});
       transformed.z += cos(uTime*${(speed * 0.8).toFixed(2)} + ph) * ${amp.toFixed(3)} * (position.y + ${off.toFixed(2)});`,
    )
  }
}

// ---------- procedural foliage / bark textures (canvas, no asset files) ----------
function leafPath(g: CanvasRenderingContext2D, x: number, y: number, rot: number, len: number, col: string, vein: string) {
  g.save(); g.translate(x, y); g.rotate(rot)
  g.beginPath(); g.moveTo(0, 0)
  g.bezierCurveTo(len * 0.5, -len * 0.18, len * 0.9, -len * 0.08, len, 0)
  g.bezierCurveTo(len * 0.9, len * 0.1, len * 0.5, len * 0.2, 0, 0)
  g.fillStyle = col; g.fill()
  g.strokeStyle = vein; g.lineWidth = Math.max(0.6, len * 0.03)
  g.beginPath(); g.moveTo(0, 0); g.lineTo(len * 0.92, 0); g.stroke()
  g.restore()
}
function blossom(g: CanvasRenderingContext2D, x: number, y: number, r: number, petal: string, core: string) {
  g.save(); g.translate(x, y); g.rotate(Math.random() * 6)
  for (let i = 0; i < 5; i++) {
    g.rotate((Math.PI * 2) / 5)
    g.beginPath(); g.ellipse(r * 0.55, 0, r * 0.55, r * 0.42, 0, 0, 7)
    g.fillStyle = petal; g.fill()
  }
  g.beginPath(); g.arc(0, 0, r * 0.22, 0, 7); g.fillStyle = core; g.fill()
  g.restore()
}
const rr = (a: number, b: number) => a + Math.random() * (b - a)
type Kind = 'cherry' | 'white' | 'green'
function foliageTexture(kind: Kind) {
  const S = 512
  const c = document.createElement('canvas'); c.width = c.height = S
  const g = c.getContext('2d')!
  const greens = ['#7fcf62', '#8fdc70', '#a0e582', '#74c457', '#9ae07b']
  if (kind === 'green') {
    for (let i = 0; i < 170; i++) leafPath(g, rr(30, S - 30), rr(30, S - 30), rr(0, 6.28), rr(34, 62), greens[i % 5], '#5aa845')
  } else {
    for (let i = 0; i < 45; i++) leafPath(g, rr(30, S - 30), rr(30, S - 30), rr(0, 6.28), rr(30, 50), greens[i % 5], '#5aa845')
    const pet = kind === 'cherry' ? ['#ffc2da', '#ffb0cf', '#ffd3e4', '#ffa6c7'] : ['#ffffff', '#fff6f0', '#fdeff4']
    for (let i = 0; i < 110; i++) blossom(g, rr(24, S - 24), rr(24, S - 24), rr(15, 27), pet[i % pet.length], '#ffd25a')
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  return t
}
function barkTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#9a7656'; g.fillRect(0, 0, 128, 256)
  for (let i = 0; i < 260; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(80,52,34,0.28)' : 'rgba(210,180,150,0.3)'
    g.fillRect(Math.random() * 128, Math.random() * 256, rr(1, 4), rr(20, 90))
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2)
  return t
}
/** A "leaf ball": several crossed alpha cards with outward (spherical) normals for soft foliage shading. */
function cardCluster() {
  const parts: THREE.BufferGeometry[] = []
  const rots: [number, number, number][] = [[0, 0, 0], [0, 1.05, 0.5], [0, 2.1, -0.4], [1.2, 0.4, 0], [1.4, 1.7, 0.8], [-0.9, 2.6, 0.3]]
  for (const r of rots) {
    const g = new THREE.PlaneGeometry(1.7, 1.7)
    g.rotateX(r[0]); g.rotateY(r[1]); g.rotateZ(r[2])
    parts.push(g)
  }
  const m = mergeGeometries(parts)!
  const pos = m.attributes.position as THREE.BufferAttribute
  const nor = m.attributes.normal as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).normalize(); nor.setXYZ(i, v.x, v.y, v.z) }
  return m
}

export function Trees() {
  const trunk = useRef<THREE.InstancedMesh>(null!)
  const branchRef = useRef<THREE.InstancedMesh>(null!)
  const leafRefs = { cherry: useRef<THREE.InstancedMesh>(null!), white: useRef<THREE.InstancedMesh>(null!), green: useRef<THREE.InstancedMesh>(null!) }
  const mats = useRef<Record<string, THREE.MeshStandardMaterial>>({})
  const assets = useMemo(() => ({
    cluster: cardCluster(), bark: barkTexture(),
    tex: { cherry: foliageTexture('cherry'), white: foliageTexture('white'), green: foliageTexture('green') },
  }), [])
  const data = useMemo(() => {
    const tm: THREE.Matrix4[] = [], br: THREE.Matrix4[] = []
    const lf: Record<Kind, { m: THREE.Matrix4; c: THREE.Color }[]> = { cherry: [], white: [], green: [] }
    const o = new THREE.Object3D()
    const up = new THREE.Vector3(0, 1, 0)
    for (const t of trees) {
      const r = mulberry32(Math.floor(t.seed * 1e9))
      const s = t.s
      const green = t.kind === 'green'
      const trunkH = (green ? 2.1 : 2.4) * s
      o.position.set(t.x, t.y + trunkH / 2 - 0.1, t.z); o.rotation.set((r() - 0.5) * 0.08, r() * 6, (r() - 0.5) * 0.08)
      o.scale.set(s * 0.3, trunkH, s * 0.3); o.updateMatrix(); tm.push(o.matrix.clone())
      o.position.set(t.x, t.y + 0.15 * s, t.z); o.rotation.set(0, r() * 6, 0); o.scale.set(s * 0.46, 0.45 * s, s * 0.46)
      o.updateMatrix(); tm.push(o.matrix.clone())
      const topY = t.y + trunkH
      const addLeaves = (x: number, y: number, z: number, size: number, shade: number) => {
        o.position.set(x, y, z); o.rotation.set(r() * 6, r() * 6, r() * 6); o.scale.setScalar(size); o.updateMatrix()
        const c = new THREE.Color(1, 1, 1).multiplyScalar(shade)
        c.offsetHSL((r() - 0.5) * 0.03, 0, (r() - 0.5) * 0.04)
        lf[t.kind].push({ m: o.matrix.clone(), c })
      }
      const addBranch = (st: THREE.Vector3, dir: THREE.Vector3, len: number, thick: number) => {
        const tip = st.clone().addScaledVector(dir, len)
        o.position.copy(st).add(tip).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(up, dir); o.scale.set(s * thick, len, s * thick)
        o.updateMatrix(); br.push(o.matrix.clone()); o.quaternion.identity()
        return tip
      }
      const nBr = green ? 4 : 5 + Math.floor(r() * 2)
      for (let i = 0; i < nBr; i++) {
        const a = (i / nBr) * Math.PI * 2 + r() * 0.8
        const tilt = 0.5 + r() * 0.55
        const len = (1.3 + r() * 0.8) * s
        const dir = new THREE.Vector3(Math.sin(tilt) * Math.cos(a), Math.cos(tilt), Math.sin(tilt) * Math.sin(a))
        const st = new THREE.Vector3(t.x, topY - (0.1 + r() * 0.45) * s, t.z)
        const tip = addBranch(st, dir, len, 0.11)
        for (let k = 0; k < 2; k++) {
          const a2 = a + (k ? 0.9 : -0.9) + (r() - 0.5) * 0.5
          const d2 = new THREE.Vector3(Math.sin(0.9) * Math.cos(a2), 0.55 + r() * 0.3, Math.sin(0.9) * Math.sin(a2)).normalize()
          const from = st.clone().lerp(tip, 0.55)
          const tip2 = addBranch(from, d2, (0.8 + r() * 0.5) * s, 0.06)
          for (let j = 0; j < 5; j++) addLeaves(tip2.x + (r() - 0.5) * 0.9 * s, tip2.y + (r() - 0.4) * 0.8 * s, tip2.z + (r() - 0.5) * 0.9 * s, (0.55 + r() * 0.4) * s * (green ? 1.15 : 1), 0.85 + r() * 0.3)
        }
        for (let j = 0; j < 6; j++) addLeaves(tip.x + (r() - 0.5) * 1.2 * s, tip.y + (r() - 0.35) * 1.0 * s, tip.z + (r() - 0.5) * 1.2 * s, (0.6 + r() * 0.45) * s * (green ? 1.15 : 1), 0.85 + r() * 0.3)
      }
      for (let j = 0; j < 8; j++) {
        const aa = r() * 6.28, rd = r() * 0.8 * s
        addLeaves(t.x + Math.cos(aa) * rd, topY + (0.5 + r() * 1.3) * s, t.z + Math.sin(aa) * rd, (0.7 + r() * 0.5) * s, 1.0 + r() * 0.15)
      }
    }
    return { tm, br, lf }
  }, [])
  useEffect(() => {
    data.tm.forEach((m, i) => trunk.current.setMatrixAt(i, m))
    data.br.forEach((m, i) => branchRef.current.setMatrixAt(i, m))
    trunk.current.instanceMatrix.needsUpdate = true; branchRef.current.instanceMatrix.needsUpdate = true
    for (const k of ['cherry', 'white', 'green'] as Kind[]) {
      const im = leafRefs[k].current
      data.lf[k].forEach((b, i) => { im.setMatrixAt(i, b.m); im.setColorAt(i, b.c) })
      im.instanceMatrix.needsUpdate = true
      if (im.instanceColor) im.instanceColor.needsUpdate = true
    }
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(() => { for (const k in mats.current) { const sh = mats.current[k].userData.sh; if (sh) sh.uniforms.uTime.value = game.time } })
  return (
    <>
      <instancedMesh ref={trunk} args={[undefined, undefined, data.tm.length]} castShadow>
        <cylinderGeometry args={[0.38, 1, 1, 9]} />
        <meshStandardMaterial map={assets.bark} roughness={1} />
      </instancedMesh>
      <instancedMesh ref={branchRef} args={[undefined, undefined, data.br.length]} castShadow>
        <cylinderGeometry args={[0.5, 1, 1, 6]} />
        <meshStandardMaterial map={assets.bark} roughness={1} />
      </instancedMesh>
      {(['cherry', 'white', 'green'] as Kind[]).map((k) => (
        <instancedMesh key={k} ref={leafRefs[k]} args={[assets.cluster, undefined, data.lf[k].length]} castShadow frustumCulled={false}>
          <meshStandardMaterial ref={(m) => { if (m) { mats.current[k] = m; swayPatch(m, 0.02, 1.4) } }}
            map={assets.tex[k]} alphaTest={0.45} side={THREE.DoubleSide} roughness={1} emissive="#fff4f4" emissiveIntensity={0.16} />
        </instancedMesh>
      ))}
    </>
  )
}

export function Rocks() {
  const ref = useRef<THREE.InstancedMesh>(null!)
  useEffect(() => {
    const o = new THREE.Object3D(); const c = new THREE.Color()
    rocks.forEach((r, i) => {
      o.position.set(r.x, r.y + r.s * 0.25, r.z); o.rotation.set(r.ry, r.ry * 2, 0); o.scale.set(r.s, r.s * 0.8, r.s * 1.1); o.updateMatrix()
      ref.current.setMatrixAt(i, o.matrix); ref.current.setColorAt(i, c.set(i % 3 ? '#a49f95' : '#8f8a82'))
    })
    ref.current.instanceMatrix.needsUpdate = true
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true
  }, [])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, rocks.length]} castShadow receiveShadow>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial flatShading roughness={1} />
    </instancedMesh>
  )
}

/** Falling petals around the player. */
export function Petals({ count }: { count: number }) {
  const ref = useRef<THREE.Points>(null!)
  const st = useMemo(() => {
    const p = new Float32Array(count * 3)
    const v = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      p[i * 3] = (Math.random() - 0.5) * 40; p[i * 3 + 1] = Math.random() * 14; p[i * 3 + 2] = (Math.random() - 0.5) * 40
      v[i * 3] = Math.random() * 6.28; v[i * 3 + 1] = 0.4 + Math.random() * 0.5; v[i * 3 + 2] = 0.5 + Math.random()
    }
    return { p, v }
  }, [count])
  useFrame((_, dt) => {
    const a = ref.current.geometry.attributes.position as THREE.BufferAttribute
    const { p, v } = st
    for (let i = 0; i < count; i++) {
      v[i * 3] += dt * v[i * 3 + 2]
      p[i * 3] += Math.sin(v[i * 3]) * dt * 0.8 + dt * 0.5
      p[i * 3 + 2] += Math.cos(v[i * 3] * 0.8) * dt * 0.6
      p[i * 3 + 1] -= v[i * 3 + 1] * dt
      const px = game.pos.x, pz = game.pos.z
      if (p[i * 3 + 1] < game.pos.y - 1) { p[i * 3 + 1] = game.pos.y + 10 + Math.random() * 4; p[i * 3] = px + (Math.random() - 0.5) * 40; p[i * 3 + 2] = pz + (Math.random() - 0.5) * 40 }
      if (Math.abs(p[i * 3] - px) > 22) p[i * 3] = px + (p[i * 3] > px ? -20 : 20)
      if (Math.abs(p[i * 3 + 2] - pz) > 22) p[i * 3 + 2] = pz + (p[i * 3 + 2] > pz ? -20 : 20)
    }
    a.needsUpdate = true
  })
  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[st.p, 3]} /></bufferGeometry>
      <pointsMaterial color="#ffd3e4" size={0.22} sizeAttenuation transparent opacity={0.9} depthWrite={false} />
    </points>
  )
}

/** Slowly drifting clouds. */
export function Clouds() {
  const g = useRef<THREE.Group>(null!)
  const puffs = useMemo(() => {
    const r = mulberry32(7)
    return Array.from({ length: 14 }, () => ({
      x: (r() - 0.5) * 520, y: 70 + r() * 40, z: (r() - 0.5) * 520, s: 14 + r() * 18,
      parts: Array.from({ length: 5 }, () => [(r() - 0.5) * 1.8, (r() - 0.5) * 0.3, (r() - 0.5) * 0.8, 0.5 + r() * 0.5] as const),
    }))
  }, [])
  useFrame((_, dt) => { g.current.position.x += dt * 1.2; if (g.current.position.x > 260) g.current.position.x = -260 })
  return (
    <group ref={g}>
      {puffs.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]} scale={c.s}>
          {c.parts.map((p, j) => (
            <mesh key={j} position={[p[0], p[1], p[2]]} scale={[p[3], p[3] * 0.7, p[3]]}>
              <icosahedronGeometry args={[1, 1]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.95} fog={false} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}
