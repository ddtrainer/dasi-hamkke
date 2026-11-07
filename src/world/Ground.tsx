import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { terrainHeight, distToPath, PATH_HALF_W, sstep, POND, POND_WATER_Y, STREAM, GATE, shoreRadius, zoneWeight } from './terrain'
import { game, lin, tod } from './game'

const SIZE = 160

function detailTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 2600; i++) {
    const v = 215 + Math.random() * 40
    g.fillStyle = `rgba(${v},${v},${v},0.55)`
    g.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 2 + Math.random() * 6)
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(90, 90); t.anisotropy = 4
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function Terrain({ segs }: { segs: number }) {
  const detail = useMemo(() => detailTexture(), [])
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(SIZE, SIZE, segs, segs)
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position as THREE.BufferAttribute
    const col = new Float32Array(pos.count * 3)
    const c = new THREE.Color()
    const grassA = new THREE.Color('#93e064'), grassB = new THREE.Color('#b4ee7c'), sand = new THREE.Color('#f6e7bb')
    const autumnC = new THREE.Color('#d6bd5a'), cosmosC = new THREE.Color('#c7e98a')
    const pathC = new THREE.Color('#ead7ad'), rock = new THREE.Color('#9a958c'), wet = new THREE.Color('#d6bf8a')
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i)
      const h = terrainHeight(x, z)
      pos.setY(i, h)
      const n = 0.5 + 0.5 * Math.sin(x * 0.7) * Math.cos(z * 0.63) + 0.15 * Math.sin(x * 2.3 + z * 1.9)
      c.copy(grassA).lerp(grassB, THREE.MathUtils.clamp(n, 0, 1))
      c.lerp(autumnC, 0.62 * zoneWeight('autumn', x, z))
      c.lerp(cosmosC, 0.35 * zoneWeight('cosmos', x, z))
      c.lerp(sand, 1 - sstep(0.85, 1.25, h))
      c.lerp(wet, 1 - sstep(-0.3, 0.42, h))
      // slope -> rock
      const e = 0.6
      const slope = Math.hypot(terrainHeight(x + e, z) - terrainHeight(x - e, z), terrainHeight(x, z + e) - terrainHeight(x, z - e)) / (2 * e)
      if (h > 0.9) c.lerp(rock, sstep(0.55, 0.95, slope))
      // painted footpaths (also the main approach to the gate)
      const pd = Math.min(distToPath(x, z), Math.abs(x) < 6 && z > GATE.z - 2 ? 99 : 99)
      if (h > 0.9) c.lerp(pathC, 1 - sstep(PATH_HALF_W - 0.4, PATH_HALF_W + 0.35, pd))
      // sparkling meadow dither
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.computeVertexNormals()
    return g
  }, [segs])
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial vertexColors map={detail} roughness={0.95} emissive="#a8e070" emissiveIntensity={0.12} />
    </mesh>
  )
}

const seaVert = `
varying vec3 vW;
void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`
const seaFrag = `
uniform float uTime; uniform vec3 uTint; varying vec3 vW;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
void main(){
  float r = length(vW.xz);
  vec3 shallow = vec3(0.4,0.88,0.93), deep = vec3(0.17,0.55,0.88);
  vec3 col = mix(shallow, deep, smoothstep(52.0, 95.0, r));
  vec2 p = vW.xz * 0.35;
  float w = n(p + vec2(uTime*0.15, uTime*0.1)) + n(p*2.1 - vec2(uTime*0.2, 0.0))*0.5;
  col += (w-0.7)*0.12;
  float sp = pow(n(vW.xz*1.6 + vec2(uTime*0.7, -uTime*0.5)), 14.0);
  col += vec3(1.0)*sp*1.4;
  float foam = smoothstep(0.0,1.0, n(vW.xz*0.8 + uTime*0.2)) * (1.0 - smoothstep(55.0, 62.0, r)) * smoothstep(48.0,54.0,r);
  col = mix(col, vec3(1.0), foam*0.18);
  gl_FragColor = vec4(col * uTint, 1.0);
}`

export function Sea() {
  const mat = useRef<THREE.ShaderMaterial>(null!)
  useFrame((_, dt) => { mat.current.uniforms.uTime.value += dt })
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0}>
      <circleGeometry args={[420, 64]} />
      <shaderMaterial ref={mat} uniforms={{ uTime: { value: 0 }, uTint: tod.tint }} vertexShader={seaVert} fragmentShader={lin(seaFrag)} />
    </mesh>
  )
}

/** Gentle waves lapping the shore: a shallow-water tint and soft foam lines that slowly run up the beach and back, following the waterline. */
const waveVert = `
attribute float aD; attribute float aA; varying float vD; varying float vA;
void main(){ vD = aD; vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const waveFrag = `
uniform float uTime; uniform vec3 uTint; varying float vD; varying float vA;
void main(){
  float sh = 1.0 - smoothstep(0.0, 8.0, vD);
  vec3 col = mix(vec3(0.62, 0.95, 0.9), vec3(0.42, 0.86, 0.95), smoothstep(0.0, 8.0, vD));
  float a = sh * 0.5;
  float swash = 1.0 + 0.9 * sin(vA * 4.0 + uTime * 0.5);
  float edge = smoothstep(0.45, 0.0, abs(vD - swash));
  float crest = pow(max(0.0, sin(vD * 0.9 - uTime * 0.7 + vA * 3.0)), 8.0) * (1.0 - smoothstep(1.5, 7.0, vD)) * 0.55;
  float foam = clamp(edge * 0.85 + crest, 0.0, 1.0);
  col = mix(col, vec3(1.0), foam);
  a = max(a, foam * 0.8 * (1.0 - smoothstep(0.0, 7.5, vD)));
  gl_FragColor = vec4(col * uTint, a);
}`
export function ShoreWaves() {
  const mat = useRef<THREE.ShaderMaterial>(null!)
  const geo = useMemo(() => {
    const N = 360, pos: number[] = [], dd: number[] = [], aa: number[] = [], idx: number[] = []
    const IN = -0.5, OUT = 9
    for (let i = 0; i <= N; i++) {
      const th = (i / N) * Math.PI * 2 - Math.PI
      // waterline: the outermost radius where the ground is still above the sea
      let rw = shoreRadius(th) + 12
      while (rw > 20 && terrainHeight(Math.cos(th) * rw, Math.sin(th) * rw) < 0) rw -= 0.1
      for (const d of [IN, OUT]) {
        const r = rw + d
        pos.push(Math.cos(th) * r, 0.05, Math.sin(th) * r); dd.push(d); aa.push(th)
      }
      if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2) }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('aD', new THREE.Float32BufferAttribute(dd, 1))
    g.setAttribute('aA', new THREE.Float32BufferAttribute(aa, 1))
    g.setIndex(idx)
    return g
  }, [])
  useFrame((_, dt) => { mat.current.uniforms.uTime.value += dt })
  return (
    <mesh geometry={geo} renderOrder={1}>
      <shaderMaterial ref={mat} uniforms={{ uTime: { value: 0 }, uTint: tod.tint }} vertexShader={waveVert} fragmentShader={lin(waveFrag)} transparent depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  )
}

const streamFrag = `
uniform float uTime; uniform vec3 uTint; varying vec2 vUv;
void main(){
  float f = sin(vUv.y*60.0 - uTime*3.0 + sin(vUv.x*12.0)*2.0)*0.5+0.5;
  vec3 c = mix(vec3(0.35,0.78,0.95), vec3(0.75,0.95,1.0), f*0.6);
  float edge = smoothstep(0.0,0.25,vUv.x)*smoothstep(1.0,0.75,vUv.x);
  gl_FragColor = vec4(c * uTint, 0.9*edge);
}`
const streamVert = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `

export function Water() {
  const smat = useRef<THREE.ShaderMaterial>(null!)
  const pmat = useRef<THREE.MeshStandardMaterial>(null!)
  const ribbon = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i < STREAM.length - 1; i++) {
      for (let t = 0; t < 1; t += 0.1) {
        const x = STREAM[i][0] + (STREAM[i + 1][0] - STREAM[i][0]) * t
        const z = STREAM[i][1] + (STREAM[i + 1][1] - STREAM[i][1]) * t
        pts.push(new THREE.Vector3(x, 0, z))
      }
    }
    pts.push(new THREE.Vector3(STREAM[STREAM.length - 1][0], 0, STREAM[STREAM.length - 1][1]))
    const pos: number[] = [], uv: number[] = [], idx: number[] = []
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]
      const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1
      const nx = -dz / l, nz = dx / l
      const w = 1.25
      for (const s of [-1, 1]) {
        const x = p.x + nx * w * s, z = p.z + nz * w * s
        pos.push(x, Math.max(terrainHeight(p.x, p.z), terrainHeight(x, z)) + 0.12, z)
        uv.push(s < 0 ? 0 : 1, i / 3)
      }
      if (i < pts.length - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2) }
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    g.setIndex(idx)
    return g
  }, [])
  useFrame((_, dt) => {
    smat.current.uniforms.uTime.value += dt
    pmat.current.emissiveIntensity = 0.15 + Math.sin(game.time * 1.3) * 0.05
  })
  return (
    <group>
      <mesh geometry={ribbon}>
        <shaderMaterial ref={smat} uniforms={{ uTime: { value: 0 }, uTint: tod.tint }} vertexShader={streamVert} fragmentShader={lin(streamFrag)} transparent side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[POND.x, POND_WATER_Y, POND.z]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[POND.r + 3.5, 40]} />
        <meshStandardMaterial ref={pmat} color="#59c8f0" emissive="#2a88c0" roughness={0.15} metalness={0.1} transparent opacity={0.85} />
      </mesh>
    </group>
  )
}
