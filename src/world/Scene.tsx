import { useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../lib/store'
import { Terrain, Sea, Water, ShoreWaves } from './Ground'
import { Trees, Rocks, Petals, Clouds } from './Vegetation'
import { Flowers, Grass } from './Flora'
import { EffectComposer, Bloom, Vignette, ToneMapping, SMAA } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { Structures } from './Structures'
import { Shrines } from './Shrines'
import { Market } from './Market'
import { Avatar, Dog } from './Characters'
import { PlayerController } from './Player'
import { game, fx, lin } from './game'

const skyVert = `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `
const skyFrag = `varying vec3 vP;
void main(){
  float h = normalize(vP).y;
  vec3 top = vec3(0.28,0.6,1.0), mid = vec3(0.56,0.8,1.0), hor = vec3(0.92,0.97,1.0);
  vec3 c = mix(hor, mid, smoothstep(0.0,0.25,h)); c = mix(c, top, smoothstep(0.2,0.8,h));
  float sun = pow(max(dot(normalize(vP), normalize(vec3(0.5,0.6,-0.6))),0.0), 220.0);
  gl_FragColor = vec4(c + vec3(1.0,0.95,0.8)*sun, 1.0);
}`

function Sky() {
  const ref = useRef<THREE.Mesh>(null!)
  useFrame(({ camera }) => ref.current.position.copy(camera.position))
  return (
    <mesh ref={ref} renderOrder={-10}>
      <sphereGeometry args={[900, 24, 12]} />
      <shaderMaterial vertexShader={skyVert} fragmentShader={lin(skyFrag)} side={THREE.BackSide} depthWrite={false} fog={false} />
    </mesh>
  )
}

function Lights({ shadows }: { shadows: boolean }) {
  const dir = useRef<THREE.DirectionalLight>(null!)
  useFrame(() => {
    if (!dir.current) return
    const p = game.pos
    dir.current.position.set(p.x + 30, p.y + 45, p.z + 25)
    dir.current.target.position.set(p.x, p.y, p.z)
    dir.current.target.updateMatrixWorld()
  })
  return (
    <>
      <hemisphereLight args={['#eef7ff', '#e3f3b8', 1.55]} />
      <ambientLight intensity={0.25} color="#fff6ea" />
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
      <Structures />
      <Shrines />
      <Market />
      <Avatar />
      <Dog />
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
