import { useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../lib/store'
import { Terrain, Sea, Water, ShoreWaves } from './Ground'
import { Trees, Rocks, Petals, Clouds } from './Vegetation'
import { Flowers, Grass } from './Flora'
import { EffectComposer, Bloom, Vignette, ToneMapping, SMAA } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { Structures } from './Structures'
import { Reeds } from './Landmarks'
import { Places, ShootingStars } from './Places'
import { Shrines } from './Shrines'
import { Market } from './Market'
import { Avatar, Dog, SummonGlow } from './Characters'
import { Neighbors } from './Neighbors'
import { PlayerController } from './Player'
import { game, fx, lin, tod } from './game'

const skyVert = `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `
const skyFrag = `varying vec3 vP;
uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHor; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uSunPow; uniform float uStars; uniform float uTime;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float hash3(vec3 p){ p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash3(i), hash3(i+vec3(1,0,0)), f.x), mix(hash3(i+vec3(0,1,0)), hash3(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash3(i+vec3(0,0,1)), hash3(i+vec3(1,0,1)), f.x), mix(hash3(i+vec3(0,1,1)), hash3(i+vec3(1,1,1)), f.x), f.y), f.z);
}
float stars(vec3 d, float scale, float thr, float size){
  vec3 p = d * scale; vec3 id = floor(p); vec3 f = fract(p) - 0.5;
  vec3 off = (vec3(hash3(id + 1.3), hash3(id + 2.7), hash3(id + 4.1)) - 0.5) * 0.6;
  return step(thr, hash3(id)) * smoothstep(size, 0.0, length(f - off));
}
void main(){
  vec3 d = normalize(vP);
  float h = d.y;
  vec3 c = mix(uHor, uMid, smoothstep(0.0,0.25,h)); c = mix(c, uTop, smoothstep(0.2,0.8,h));
  float sun = pow(max(dot(d, normalize(uSunDir)),0.0), uSunPow);
  vec3 col = c + uSunCol*sun;
  if (uStars > 0.01) {
    float up = smoothstep(0.0, 0.2, h);
    // round, jittered stars from 3D cells (no pole distortion), a slow twinkle on the brighter ones
    float s1 = stars(d, 55.0, 0.93, 0.34) * (0.65 + 0.35*sin(uTime*2.0 + hash3(floor(d*55.0))*40.0));
    float s2 = stars(d, 130.0, 0.92, 0.36) * 0.6;
    // the Milky Way: a tilted band with a bright bulge, dust lanes and a dense carpet of faint stars
    vec3 gn = normalize(vec3(0.64, 0.15, 0.75));
    float lat = dot(d, gn);
    float band = exp(-lat*lat / 0.009);
    float core = pow(max(dot(d, normalize(vec3(-0.62, 0.5, 0.52))), 0.0), 9.0);
    float cloud = vnoise(d*7.0) * 0.6 + vnoise(d*16.0) * 0.3 + vnoise(d*38.0) * 0.1;
    float lane = smoothstep(0.52, 0.78, vnoise(d*10.0 + 4.0)) * (1.0 - smoothstep(0.0, 0.55, max(abs(lat) - 0.02, 0.0)));
    vec3 mwCol = mix(vec3(0.40, 0.48, 0.85), vec3(1.0, 0.84, 0.66), core * 0.8);
    float mw = band * (0.15 + 0.9*cloud*cloud*1.6) * (1.0 - 0.8*lane) * (0.5 + 0.9*core);
    float carpet = stars(d, 300.0, 0.78 - 0.10*band, 0.42) * band * (1.0 - 0.6*lane);
    col += (mwCol * mw * 1.15 + vec3(carpet) * 0.9) * uStars * up;
    col += vec3(s1 + s2) * uStars * up;
  }
  gl_FragColor = vec4(col, 1.0);
}`

type Env = {
  top: THREE.Color; mid: THREE.Color; hor: THREE.Color; sunDir: THREE.Vector3; sunCol: THREE.Color; sunPow: number; stars: number
  hemiSky: THREE.Color; hemiGround: THREE.Color; hemiI: number; ambCol: THREE.Color; ambI: number; dirCol: THREE.Color; dirI: number; dirOff: THREE.Vector3
  fog: THREE.Color; tint: THREE.Color; night: number; dusk: number
}
const C = (hex: string) => new THREE.Color(hex)
interface EnvSpec { top: string; mid: string; hor: string; sun: [number, number, number]; sunCol: string; sunPow: number; stars: number; hemiSky: string; hemiGround: string; hemiI: number; amb: string; ambI: number; dir: string; dirI: number; off: [number, number, number]; fog: string; tint: string; night: number; dusk: number }
const mk = (o: EnvSpec): Env => ({
  top: C(o.top), mid: C(o.mid), hor: C(o.hor), sunDir: new THREE.Vector3(...o.sun), sunCol: C(o.sunCol), sunPow: o.sunPow, stars: o.stars,
  hemiSky: C(o.hemiSky), hemiGround: C(o.hemiGround), hemiI: o.hemiI, ambCol: C(o.amb), ambI: o.ambI, dirCol: C(o.dir), dirI: o.dirI, dirOff: new THREE.Vector3(...o.off),
  fog: C(o.fog), tint: C(o.tint), night: o.night, dusk: o.dusk,
})
const DAY: EnvSpec = { top: '#48a0ff', mid: '#8fccff', hor: '#ebf8ff', sun: [0.5, 0.6, -0.6], sunCol: '#ffeccc', sunPow: 220, stars: 0, hemiSky: '#eef7ff', hemiGround: '#e3f3b8', hemiI: 1.55, amb: '#fff6ea', ambI: 0.25, dir: '#fff1d8', dirI: 1.55, off: [30, 45, 25], fog: '#e9f5ff', tint: '#ffffff', night: 0, dusk: 0 }
const PRESETS: Record<string, Env> = {
  day: mk(DAY),
  sunset: mk({ top: '#4d4d9e', mid: '#f28c73', hor: '#ffc78c', sun: [0.55, 0.1, -0.8], sunCol: '#ff9a4d', sunPow: 60, stars: 0, hemiSky: '#ffd7b8', hemiGround: '#c98c70', hemiI: 1.1, amb: '#ffd0b0', ambI: 0.24, dir: '#ff9d55', dirI: 1.3, off: [46, 15, 20], fog: '#f3c9a8', tint: '#ffd1b8', night: 0, dusk: 1 }),
  night: mk({ top: '#0b1a4e', mid: '#15296a', hor: '#2c3f86', sun: [-0.4, 0.5, -0.7], sunCol: '#c4d4ff', sunPow: 1800, stars: 1, hemiSky: '#4e64a6', hemiGround: '#222d50', hemiI: 1.0, amb: '#6a7ab0', ambI: 0.4, dir: '#a9bcff', dirI: 0.8, off: [-25, 40, 20], fog: '#141a38', tint: '#47598c', night: 1, dusk: 0 }),
}
const env: Env = mk(DAY)
if (import.meta.env.DEV) (window as unknown as { __env: Env }).__env = env
const lerpEnv = (a: Env, b: Env, k: number) => {
  for (const key of ['top', 'mid', 'hor', 'sunCol', 'hemiSky', 'hemiGround', 'ambCol', 'dirCol', 'fog', 'tint'] as const) a[key].lerp(b[key], k)
  a.sunDir.lerp(b.sunDir, k); a.dirOff.lerp(b.dirOff, k)
  for (const key of ['sunPow', 'stars', 'hemiI', 'ambI', 'dirI', 'night', 'dusk'] as const) a[key] += (b[key] - a[key]) * k
}

/** Eases sky, light, fog and the unlit shader tint towards the chosen time of day (day / sunset / night). */
function TimeOfDay() {
  const scene = useThree((s) => s.scene)
  useFrame((_, dt) => {
    const target = PRESETS[useStore.getState().tod]
    lerpEnv(env, target, 1 - Math.exp(-Math.min(dt, 0.1) * 1.8))
    tod.night = env.night; tod.dusk = env.dusk
    tod.tint.value.copy(env.tint)
    if (scene.fog) (scene.fog as THREE.Fog).color.copy(env.fog)
  })
  return null
}

function Sky() {
  const ref = useRef<THREE.Mesh>(null!)
  const matRef = useRef<THREE.ShaderMaterial>(null!)
  const u = useMemo(() => ({
    uTop: { value: env.top }, uMid: { value: env.mid }, uHor: { value: env.hor }, uSunDir: { value: env.sunDir }, uSunCol: { value: env.sunCol },
    uSunPow: { value: 220 }, uStars: { value: 0 }, uTime: { value: 0 },
  }), [])
  useFrame(({ camera }, dt) => {
    ref.current.position.copy(camera.position)
    // write through the material's own uniforms (the material may hold copies of the objects passed in)
    const mu = matRef.current.uniforms
    mu.uTop.value.copy(env.top); mu.uMid.value.copy(env.mid); mu.uHor.value.copy(env.hor); mu.uSunDir.value.copy(env.sunDir); mu.uSunCol.value.copy(env.sunCol)
    mu.uSunPow.value = env.sunPow; mu.uStars.value = env.stars; mu.uTime.value += dt
  })
  return (
    <mesh ref={ref} renderOrder={-10}>
      <sphereGeometry args={[900, 24, 12]} />
      <shaderMaterial ref={matRef} uniforms={u} vertexShader={skyVert} fragmentShader={lin(skyFrag)} side={THREE.BackSide} depthWrite={false} fog={false} />
    </mesh>
  )
}

function Lights({ shadows }: { shadows: boolean }) {
  const dir = useRef<THREE.DirectionalLight>(null!)
  const hemi = useRef<THREE.HemisphereLight>(null!)
  const amb = useRef<THREE.AmbientLight>(null!)
  useFrame(() => {
    if (!dir.current) return
    const p = game.pos
    dir.current.position.set(p.x + env.dirOff.x, p.y + env.dirOff.y, p.z + env.dirOff.z)
    dir.current.target.position.set(p.x, p.y, p.z)
    dir.current.target.updateMatrixWorld()
    dir.current.color.copy(env.dirCol); dir.current.intensity = env.dirI
    hemi.current.color.copy(env.hemiSky); hemi.current.groundColor.copy(env.hemiGround); hemi.current.intensity = env.hemiI
    amb.current.color.copy(env.ambCol); amb.current.intensity = env.ambI
  })
  return (
    <>
      <hemisphereLight ref={hemi} args={['#eef7ff', '#e3f3b8', 1.55]} />
      <ambientLight ref={amb} intensity={0.25} color="#fff6ea" />
      <directionalLight ref={dir} intensity={1.55} color="#fff1d8" castShadow={shadows}
        shadow-mapSize={[2048, 2048]} shadow-camera-left={-28} shadow-camera-right={28} shadow-camera-top={28} shadow-camera-bottom={-28}
        shadow-camera-near={1} shadow-camera-far={140} shadow-bias={-0.0006} />
    </>
  )
}

/** Drops quality automatically if the frame rate is poor. */
function PerfWatch() {
  const acc = useRef({ t: 0, n: 0, w: 0, done: false })
  const { gl } = useThree()
  useFrame((_, dt) => {
    const a = acc.current
    if (a.done || useStore.getState().phase !== 'play') return
    a.w += dt
    if (a.w < 6) return // ignore shader compilation / texture upload warm-up
    a.t += dt; a.n++
    if (a.t > 4) {
      const fps = a.n / a.t
      a.done = true
      if (fps < 28 && useStore.getState().quality === 'high') {
        useStore.getState().set({ quality: 'low' })
        useStore.getState().say(`프레임이 낮아(${fps.toFixed(0)}fps) 그래픽 품질을 자동으로 낮췄어요.`)
      }
    }
    void gl
  })
  return null
}

export function World() {
  const quality = useStore((s) => s.quality)
  const hi = quality === 'high'
  fx.composer = hi
  return (
    <Canvas
      key={quality}
      shadows={hi}
      dpr={hi ? [1, 2] : [1, 1.25]}
      camera={{ fov: 55, near: 0.2, far: 1500, position: [0, 60, 160] }}
      gl={{ antialias: hi, powerPreference: 'high-performance' }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = useStore.getState().quality === "high" ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.1
        scene.fog = new THREE.Fog('#e9f5ff', 70, 400)
      }}
    >
      <TimeOfDay />
      <Sky />
      <Lights shadows={hi} />
      <Sea />
      <ShoreWaves />
      <Terrain segs={hi ? 280 : 170} />
      <Water />
      <Trees />
      <Flowers density={hi ? 1 : 0.45} />
      <Grass count={hi ? 5200 : 1800} />
      <Rocks />
      <Reeds />
      <Structures />
      <Places />
      <ShootingStars />
      <Shrines />
      <Market />
      <Avatar />
      <Dog />
      <SummonGlow />
      <Neighbors />
      <Petals count={hi ? 260 : 90} />
      <Clouds />
      <PlayerController />
      <PerfWatch />
      {hi && (
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.32} luminanceThreshold={0.7} luminanceSmoothing={0.6} mipmapBlur />
          <Vignette eskil={false} offset={0.35} darkness={0.16} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          <SMAA />
        </EffectComposer>
      )}
    </Canvas>
  )
}
