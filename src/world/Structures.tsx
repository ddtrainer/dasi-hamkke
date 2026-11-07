import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BRIDGE, GATE, STREAM_BRIDGE, terrainHeight, GAZEBO } from './terrain'
import { benches, lanterns, fencePosts } from './layout'
import { game, lin } from './game'

const STONE = '#e9e2d4'
const STONE_D = '#cfc6b4'

export const CALLI = '"Gamja Flower","Gaegu","Malgun Gothic","Apple SD Gothic Neo",cursive'

/** engraved paw print: dog = broad pad + rounder toes, cat = small round pad + neat toes */
function paw2d(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, kind: 'dog' | 'cat', rot = 0) {
  const shape = () => {
    g.save(); g.translate(cx, cy); g.rotate(rot)
    const el = (x: number, y: number, rx: number, ry: number, a = 0) => { g.beginPath(); g.ellipse(x * r, y * r, rx * r, ry * r, a, 0, Math.PI * 2); g.fill() }
    if (kind === 'dog') {
      g.beginPath(); g.moveTo(0, -0.05 * r)
      g.bezierCurveTo(0.75 * r, -0.1 * r, 0.9 * r, 0.7 * r, 0.35 * r, 0.82 * r)
      g.bezierCurveTo(0.12 * r, 0.9 * r, -0.12 * r, 0.9 * r, -0.35 * r, 0.82 * r)
      g.bezierCurveTo(-0.9 * r, 0.7 * r, -0.75 * r, -0.1 * r, 0, -0.05 * r); g.fill()
      el(-0.78, -0.2, 0.2, 0.3, -0.5); el(-0.3, -0.72, 0.21, 0.31, -0.15); el(0.3, -0.72, 0.21, 0.31, 0.15); el(0.78, -0.2, 0.2, 0.3, 0.5)
    } else {
      g.beginPath(); g.moveTo(0, 0.05 * r)
      g.bezierCurveTo(0.55 * r, 0.0, 0.62 * r, 0.62 * r, 0.22 * r, 0.7 * r)
      g.bezierCurveTo(0.08 * r, 0.74 * r, -0.08 * r, 0.74 * r, -0.22 * r, 0.7 * r)
      g.bezierCurveTo(-0.62 * r, 0.62 * r, -0.55 * r, 0.0, 0, 0.05 * r); g.fill()
      el(-0.62, -0.18, 0.17, 0.2, -0.3); el(-0.22, -0.55, 0.17, 0.21, -0.1); el(0.22, -0.55, 0.17, 0.21, 0.1); el(0.62, -0.18, 0.17, 0.2, 0.3)
    }
    g.restore()
  }
  g.fillStyle = 'rgba(255,238,200,.65)'; g.save(); g.translate(0, 2.5); shape(); g.restore() // lit lower edge
  g.fillStyle = '#5a3a1c'; shape()                                                          // carved hollow
}

export function signTexture(text: string, paw = true) {
  const W = 640, H = 300
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  const draw = () => {
    const g = c.getContext('2d')!
    g.clearRect(0, 0, W, H)
    const oval = (inset: number) => { g.beginPath(); g.ellipse(W / 2, H / 2, W / 2 - inset, H / 2 - inset, 0, 0, Math.PI * 2) }
    oval(6); g.fillStyle = '#7a5530'; g.fill()                      // rim
    oval(20); g.fillStyle = '#c99a5b'; g.fill()                     // wooden face
    g.save(); oval(20); g.clip()
    g.fillStyle = '#b3834a'
    for (let y = 0; y < H; y += 24) g.fillRect(0, y, W, 2)
    const sh = g.createRadialGradient(W / 2, H * 0.4, 20, W / 2, H / 2, W * 0.55)
    sh.addColorStop(0, 'rgba(255,235,190,.35)'); sh.addColorStop(1, 'rgba(90,55,25,.18)')
    g.fillStyle = sh; g.fillRect(0, 0, W, H)
    g.restore()
    oval(20); g.strokeStyle = '#a97a44'; g.lineWidth = 3; g.stroke()
    g.textAlign = 'center'; g.textBaseline = 'middle'
    g.font = `120px ${CALLI}`
    g.lineJoin = 'round'; g.lineCap = 'round'
    const ty = paw ? H / 2 + 34 : H / 2
    g.strokeStyle = 'rgba(255,250,230,.6)'; g.lineWidth = 7; g.strokeText(text, W / 2, ty)
    g.fillStyle = '#8c2f4b'; g.strokeStyle = '#8c2f4b'; g.lineWidth = 3; g.strokeText(text, W / 2, ty); g.fillText(text, W / 2, ty)
    if (paw) { paw2d(g, W / 2 - 88, H / 2 - 72, 38, 'dog', -0.25); paw2d(g, W / 2 + 88, H / 2 - 72, 38, 'cat', 0.25) }
    t.needsUpdate = true
  }
  draw()
  // redraw once the handwriting font has actually loaded
  document.fonts?.load(`120px "Gamja Flower"`, text).then(draw).catch(() => {})
  return t
}

export function Bridge() {
  const len = BRIDGE.z1 - BRIDGE.z0
  const mid = (BRIDGE.z0 + BRIDGE.z1) / 2
  const piers = useMemo(() => Array.from({ length: 5 }, (_, i) => BRIDGE.z0 + 13 + i * 14), [])
  const posts = useMemo(() => Array.from({ length: Math.floor(len / 2.2) }, (_, i) => BRIDGE.z0 + 1 + i * 2.2), [len])
  return (
    <group>
      <mesh position={[0, BRIDGE.y - 0.2, mid]} receiveShadow>
        <boxGeometry args={[BRIDGE.halfW * 2 + 0.3, 0.4, len]} />
        <meshStandardMaterial color={STONE} roughness={0.9} />
      </mesh>
      {/* paving lines */}
      {Array.from({ length: Math.floor(len / 1.4) }, (_, i) => (
        <mesh key={i} position={[0, BRIDGE.y + 0.005, BRIDGE.z0 + 0.7 + i * 1.4]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[BRIDGE.halfW * 2, 0.04]} /><meshBasicMaterial color={STONE_D} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * (BRIDGE.halfW + 0.05), BRIDGE.y + 0.9, mid]}>
            <boxGeometry args={[0.25, 0.18, len]} /><meshStandardMaterial color={STONE} />
          </mesh>
          <mesh position={[s * (BRIDGE.halfW + 0.05), BRIDGE.y + 0.35, mid]}>
            <boxGeometry args={[0.18, 0.12, len]} /><meshStandardMaterial color={STONE} />
          </mesh>
          {posts.map((z, i) => (
            <mesh key={i} position={[s * (BRIDGE.halfW + 0.05), BRIDGE.y + 0.55, z]}>
              <cylinderGeometry args={[0.07, 0.09, 0.8, 6]} /><meshStandardMaterial color={STONE} />
            </mesh>
          ))}
        </group>
      ))}
      {piers.map((z, i) => (
        <group key={i} position={[0, 0, z]}>
          <mesh position={[0, -1.2, 0]}><boxGeometry args={[BRIDGE.halfW * 2 + 0.6, 4.6, 2]} /><meshStandardMaterial color={STONE_D} /></mesh>
        </group>
      ))}
      {/* arches between piers */}
      {piers.slice(0, -1).map((z, i) => (
        <group key={i} position={[0, BRIDGE.y - 0.45, z + 7]} rotation={[0, Math.PI / 2, 0]}>
          <mesh rotation={[0, 0, Math.PI]}>
            <torusGeometry args={[5.6, 0.35, 6, 20, Math.PI]} /><meshStandardMaterial color={STONE} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export function Lanterns() {
  const lights = useRef<THREE.InstancedMesh>(null!)
  useEffect(() => {
    const o = new THREE.Object3D()
    lanterns.forEach((l, i) => { o.position.set(l.x, l.y + 1.25, l.z); o.updateMatrix(); lights.current.setMatrixAt(i, o.matrix) })
    lights.current.instanceMatrix.needsUpdate = true
  }, [])
  return (
    <group>
      {lanterns.map((l, i) => (
        <group key={i} position={[l.x, l.y, l.z]}>
          <mesh position={[0, 0.5, 0]}><cylinderGeometry args={[0.06, 0.08, 1, 6]} /><meshStandardMaterial color="#5a4a3a" /></mesh>
          <mesh position={[0, 1.1, 0]}><boxGeometry args={[0.28, 0.06, 0.28]} /><meshStandardMaterial color="#3d3228" /></mesh>
        </group>
      ))}
      <instancedMesh ref={lights} args={[undefined, undefined, lanterns.length]}>
        <boxGeometry args={[0.22, 0.32, 0.22]} />
        <meshStandardMaterial color="#ffd98a" emissive="#ffb84a" emissiveIntensity={1.4} />
      </instancedMesh>
    </group>
  )
}

export function Gate() {
  const tex = useMemo(() => signTexture('다시 함께'), [])
  const leaves = useMemo(() => {
    const arr: { p: [number, number, number]; c: string; s: number }[] = []
    const cols = ['#5fbf4a', '#ffb7d1', '#ffffff', '#ffe066', '#b9a8ff', '#7ad05a']
    for (let i = 0; i < 90; i++) {
      const a = (i / 89) * Math.PI
      const r = 3.4 + (Math.sin(i * 12.9) * 0.5) * 0.35
      arr.push({ p: [Math.cos(a) * r, 4.2 + Math.sin(a) * 1.3 + Math.sin(i * 5.1) * 0.15, (Math.sin(i * 7.3)) * 0.35], c: cols[i % cols.length], s: 0.16 + (i % 3) * 0.07 })
    }
    return arr
  }, [])
  const y = terrainHeight(0, GATE.z)
  return (
    <group position={[GATE.x, y, GATE.z]}>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 3.5, 0, 0]}>
          <mesh position={[0, 1.2, 0]} castShadow><boxGeometry args={[1.3, 2.4, 1.3]} /><meshStandardMaterial color={STONE} /></mesh>
          <mesh position={[0, 2.5, 0]}><boxGeometry args={[1.5, 0.2, 1.5]} /><meshStandardMaterial color={STONE_D} /></mesh>
          <mesh position={[0, 3.1, 0]} castShadow><boxGeometry args={[0.9, 1.0, 0.9]} /><meshStandardMaterial color={STONE} /></mesh>
          <mesh position={[0, 3.9, 0]}><boxGeometry args={[0.55, 0.5, 0.55]} /><meshStandardMaterial color="#ffd98a" emissive="#ffb84a" emissiveIntensity={1.2} /></mesh>
          <mesh position={[0, 4.25, 0]}><coneGeometry args={[0.45, 0.35, 4]} /><meshStandardMaterial color="#6b5a46" /></mesh>
        </group>
      ))}
      <mesh position={[0, 4.0, 0]} rotation={[0, 0, 0]}>
        <torusGeometry args={[3.5, 0.28, 8, 24, Math.PI]} /><meshStandardMaterial color={STONE} />
      </mesh>
      {leaves.map((l, i) => (
        <mesh key={i} position={l.p}><icosahedronGeometry args={[l.s, 0]} /><meshStandardMaterial color={l.c} flatShading /></mesh>
      ))}
      <mesh position={[0, 3.55, 0.05]}>
        <planeGeometry args={[3.4, 1.6]} /><meshBasicMaterial map={tex} toneMapped={false} transparent alphaTest={0.4} />
      </mesh>
      <mesh position={[0, 3.55, -0.05]} rotation-y={Math.PI}>
        <planeGeometry args={[3.4, 1.6]} /><meshBasicMaterial map={tex} toneMapped={false} transparent alphaTest={0.4} />
      </mesh>
    </group>
  )
}

export function Benches() {
  return (
    <group>
      {benches.map((b, i) => (
        <group key={i} position={[b.x, b.y, b.z]} rotation-y={b.ry}>
          <mesh position={[0, 0.45, 0]} castShadow><boxGeometry args={[1.6, 0.08, 0.5]} /><meshStandardMaterial color="#a8764a" /></mesh>
          <mesh position={[0, 0.8, -0.22]} rotation-x={-0.15}><boxGeometry args={[1.6, 0.4, 0.06]} /><meshStandardMaterial color="#a8764a" /></mesh>
          {[-0.7, 0.7].map((x) => (<mesh key={x} position={[x, 0.22, 0]}><boxGeometry args={[0.08, 0.44, 0.45]} /><meshStandardMaterial color="#5c4631" /></mesh>))}
        </group>
      ))}
    </group>
  )
}

export function StreamBridge() {
  const b = STREAM_BRIDGE
  const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2
  return (
    <group position={[cx, b.y, cz]}>
      <mesh position={[0, -0.12, 0]} castShadow receiveShadow><boxGeometry args={[b.x1 - b.x0, 0.2, b.z1 - b.z0]} /><meshStandardMaterial color="#b98552" /></mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[0, 0.55, s * (b.z1 - b.z0) / 2]}><boxGeometry args={[b.x1 - b.x0, 0.08, 0.08]} /><meshStandardMaterial color="#8a5e36" /></mesh>
          {[-3.6, -1.2, 1.2, 3.6].map((x) => (<mesh key={x} position={[x, 0.3, s * (b.z1 - b.z0) / 2]}><boxGeometry args={[0.1, 0.6, 0.1]} /><meshStandardMaterial color="#8a5e36" /></mesh>))}
        </group>
      ))}
    </group>
  )
}

export function Gazebo() {
  const x = GAZEBO.x, z = GAZEBO.z
  const y = terrainHeight(x, z)
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.1, 0]}><cylinderGeometry args={[2.9, 3.1, 0.25, 8]} /><meshStandardMaterial color={STONE} /></mesh>
      {Array.from({ length: 4 }, (_, i) => {
        const a = i * Math.PI / 2 + Math.PI / 4
        return (<mesh key={i} position={[Math.cos(a) * 2.25, 1.5, Math.sin(a) * 2.25]}><cylinderGeometry args={[0.14, 0.17, 2.8, 8]} /><meshStandardMaterial color="#f4efe6" /></mesh>)
      })}
      <mesh position={[0, 3.1, 0]}><cylinderGeometry args={[3.3, 3.3, 0.18, 8]} /><meshStandardMaterial color="#f4efe6" /></mesh>
      <mesh position={[0, 3.95, 0]} castShadow><coneGeometry args={[3.3, 1.6, 8]} /><meshStandardMaterial color="#8d9aa8" flatShading /></mesh>
      <mesh position={[0, 4.9, 0]}><sphereGeometry args={[0.22, 8, 8]} /><meshStandardMaterial color="#e8d28a" /></mesh>
    </group>
  )
}

const fallFrag = `uniform float uTime; varying vec2 vUv;
float h(float x){ return fract(sin(x*91.3)*437.5); }
void main(){
  float streak = h(floor(vUv.x*14.0));
  float f = fract(vUv.y*4.0 + uTime*(0.9+streak*0.8) + streak*5.0);
  float a = smoothstep(0.0,0.4,f)*0.5 + 0.45;
  vec3 c = mix(vec3(0.6,0.85,1.0), vec3(1.0), f*0.7);
  float edge = smoothstep(0.0,0.15,vUv.x)*smoothstep(1.0,0.85,vUv.x);
  gl_FragColor = vec4(c, a*edge);
}`
/** Waterfall: an animated ribbon hugging the hill slope + boulders around the cliff. */
export function Waterfall() {
  const mat = useRef<THREE.ShaderMaterial>(null!)
  useFrame((_, dt) => { mat.current.uniforms.uTime.value += dt })
  const geo = useMemo(() => {
    const T = [31.3, -39.5], B = [28.6, -31.8], N = 14
    const pos: number[] = [], uv: number[] = [], idx: number[] = []
    const dx = B[0] - T[0], dz = B[1] - T[1], l = Math.hypot(dx, dz)
    const nx = -dz / l, nz = dx / l
    for (let i = 0; i <= N; i++) {
      const t = i / N
      const x = T[0] + dx * t, z = T[1] + dz * t
      const w = 1.0 + t * 0.5
      for (const sgn of [-1, 1]) {
        const px = x + nx * w * sgn, pz = z + nz * w * sgn
        pos.push(px, Math.max(terrainHeight(x, z), terrainHeight(px, pz)) + 0.22, pz)
        uv.push(sgn < 0 ? 0 : 1, 1 - t)
      }
      if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2) }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    g.setIndex(idx)
    return g
  }, [])
  const boulders = useMemo(() => {
    const out: { p: [number, number, number]; s: number }[] = []
    for (let i = 0; i < 14; i++) {
      const t = i / 13, side = i % 2 ? 1 : -1
      const x = 31.3 + (28.6 - 31.3) * t + 2.1 * side * (0.8 + (i % 3) * 0.2), z = -39.5 + (-31.8 + 39.5) * t - 0.4 * side
      out.push({ p: [x, terrainHeight(x, z) + 0.2, z], s: 0.7 + ((i * 37) % 10) / 12 })
    }
    return out
  }, [])
  return (
    <group>
      <mesh geometry={geo}>
        <shaderMaterial ref={mat} uniforms={{ uTime: { value: 0 } }} vertexShader="varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}" fragmentShader={lin(fallFrag)} transparent side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {boulders.map((b, i) => (
        <mesh key={i} position={b.p} scale={[b.s, b.s * 0.85, b.s]} rotation-y={i}><dodecahedronGeometry args={[1, 0]} /><meshStandardMaterial color={i % 2 ? '#a9a49a' : '#97928a'} flatShading roughness={1} /></mesh>
      ))}
    </group>
  )
}

export function Fence() {
  return (
    <group>
      {fencePosts.map(([x, z], i) => {
        const y = terrainHeight(x, z)
        const nxt = fencePosts[i + 1]
        const same = nxt && Math.hypot(nxt[0] - x, nxt[1] - z) < 2.4
        return (
          <group key={i}>
            <mesh position={[x, y + 0.5, z]}><boxGeometry args={[0.12, 1.0, 0.12]} /><meshStandardMaterial color="#a8764a" /></mesh>
            {same && [0.35, 0.8].map((h) => {
              const dx = nxt![0] - x, dz = nxt![1] - z, len = Math.hypot(dx, dz)
              return (<mesh key={h} position={[x + dx / 2, y + h, z + dz / 2]} rotation-y={Math.atan2(dx, dz)}><boxGeometry args={[0.07, 0.08, len]} /><meshStandardMaterial color="#b98552" /></mesh>)
            })}
          </group>
        )
      })}
    </group>
  )
}

export function Structures() {
  void game
  return (<><Bridge /><Gate /><Lanterns /><Benches /><StreamBridge /><Gazebo /><Waterfall /><Fence /></>)
}
