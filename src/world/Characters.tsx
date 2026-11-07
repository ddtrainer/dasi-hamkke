import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { game } from './game'
import { useStore } from '../lib/store'
import { groundHeight, canStand, moveWithCollision } from './terrain'

const lerp = THREE.MathUtils.lerp
const damp = (a: number, b: number, k: number) => lerp(a, b, k)

// palette — soft, picnic-day colours
const SKIN = '#ffd9bd', HAIR = '#e2561f', SWEATER = '#86a874', PANTS = '#6e5a4c', SHOE = '#5a3b2a', SOLE = '#3d2a1e'
const STRAW = '#eaaf5a', RIBBON = '#7b4a2c', PACK = '#b07a4c', BOW = '#f08a2a', APRON = '#fbf1d6'

const M = ({ c, r = 0.85 }: { c: string; r?: number }) => <meshStandardMaterial color={c} roughness={r} />
/** skin keeps a soft warm glow so the face never turns olive in shade */
const SkinM = () => <meshStandardMaterial color={SKIN} roughness={0.7} emissive="#ffb598" emissiveIntensity={0.55} />

function Eye({ x, refEye }: { x: number; refEye: React.RefObject<THREE.Group> }) {
  const sd = Math.sign(x)
  return (
    <group position={[x, -0.012, 0.222]} rotation-y={sd * 0.22}>
      <group ref={refEye}>
        <mesh scale={[0.88, 1.08, 0.42]}><sphereGeometry args={[0.046, 18, 14]} /><meshBasicMaterial color="#fffdf8" /></mesh>
        <mesh position={[0, -0.004, 0.012]} scale={[0.86, 1.04, 0.4]}><sphereGeometry args={[0.04, 18, 14]} /><meshBasicMaterial color="#6d93ab" /></mesh>
        <mesh position={[0, -0.006, 0.016]} scale={[0.86, 1.04, 0.4]}><sphereGeometry args={[0.028, 16, 12]} /><meshBasicMaterial color="#1d100c" /></mesh>
        <mesh position={[sd * -0.014, 0.017, 0.026]}><sphereGeometry args={[0.014, 10, 8]} /><meshBasicMaterial color="#ffffff" /></mesh>
        <mesh position={[sd * 0.014, -0.02, 0.025]}><sphereGeometry args={[0.007, 8, 6]} /><meshBasicMaterial color="#ffffff" /></mesh>
        {/* upper lash line with a little flick */}
        <mesh position={[0, 0.005, 0.014]} rotation-z={Math.PI * 0.1 + sd * 0.0}><torusGeometry args={[0.046, 0.0042, 6, 16, Math.PI * 0.8]} /><meshBasicMaterial color="#3a2118" /></mesh>
        <mesh position={[sd * 0.047, 0.012, 0.02]} rotation-z={sd * -0.7} scale={[1, 1.6, 1]}><sphereGeometry args={[0.008, 6, 6]} /><meshBasicMaterial color="#3a2118" /></mesh>
      </group>
    </group>
  )
}

/** Soft, chibi-proportioned human avatar with Idle / Walk / Run / Sit / Offer-flowers animation. */
export function Avatar() {
  const goods = useStore((s) => s.goods)
  const root = useRef<THREE.Group>(null!)
  const body = useRef<THREE.Group>(null!)
  const armL = useRef<THREE.Group>(null!), armR = useRef<THREE.Group>(null!)
  const legL = useRef<THREE.Group>(null!), legR = useRef<THREE.Group>(null!)
  const head = useRef<THREE.Group>(null!)
  const hat = useRef<THREE.Group>(null!)
  const pack = useRef<THREE.Group>(null!)
  const bouquet = useRef<THREE.Group>(null!)
  const eyeL = useRef<THREE.Group>(null!), eyeR = useRef<THREE.Group>(null!)
  const phase = useRef(0)

  useFrame((_, dt) => {
    const p = game.pos
    root.current.position.set(p.x, p.y, p.z)
    root.current.rotation.y = game.heading
    const a = game.anim, t = game.time
    const moving = a === 'walk' || a === 'run'
    if (moving) phase.current += dt * (a === 'run' ? 12 : 8)
    const sw = moving ? Math.sin(phase.current) * (a === 'run' ? 0.95 : 0.6) : 0
    const k = Math.min(1, dt * 12)
    const sit = a === 'sit', offer = a === 'offer'

    legL.current.rotation.x = damp(legL.current.rotation.x, sit ? -1.5 : sw, k)
    legR.current.rotation.x = damp(legR.current.rotation.x, sit ? -1.5 : -sw, k)
    legL.current.rotation.z = damp(legL.current.rotation.z, sit ? -0.12 : 0, k)
    legR.current.rotation.z = damp(legR.current.rotation.z, sit ? 0.12 : 0, k)
    const lift = offer ? -1.2 + Math.sin(t * 3) * 0.05 : null
    armL.current.rotation.x = damp(armL.current.rotation.x, lift ?? (sit ? -0.5 : -sw), k)
    armR.current.rotation.x = damp(armR.current.rotation.x, lift ?? (sit ? -0.5 : sw), k)
    armL.current.rotation.z = damp(armL.current.rotation.z, offer ? -0.14 : 0.1, k)
    armR.current.rotation.z = damp(armR.current.rotation.z, offer ? 0.14 : -0.1, k)

    const bob = moving ? Math.abs(Math.sin(phase.current)) * (a === 'run' ? 0.09 : 0.05) : Math.sin(t * 1.8) * 0.012
    body.current.position.y = damp(body.current.position.y, (sit ? -0.4 : 0) + bob, k)
    body.current.rotation.x = damp(body.current.rotation.x, a === 'run' ? 0.2 : offer ? 0.2 : 0, k)
    head.current.rotation.x = damp(head.current.rotation.x, offer ? 0.32 : Math.sin(t * 1.3) * 0.02, k)
    head.current.rotation.y = damp(head.current.rotation.y, moving ? 0 : Math.sin(t * 0.6) * 0.12, k * 0.5)
    // hat and backpack lag a little behind the motion
    hat.current.rotation.x = -0.22 - (moving ? Math.abs(Math.sin(phase.current)) * 0.06 : 0)
    pack.current.rotation.x = moving ? Math.sin(phase.current * 2) * 0.03 : 0
    // blink
    const blink = (t % 3.8) < 0.12 ? 0.1 : 1
    eyeL.current.scale.y = eyeR.current.scale.y = blink
    bouquet.current.visible = offer
  })

  return (
    <group ref={root}>
      <group ref={body}>
        {/* torso: sweater + white collar */}
        <mesh position={[0, 1.06, 0]} castShadow scale={[1.0, 1.08, 0.86]}><capsuleGeometry args={[0.165, 0.38, 8, 20]} /><M c={SWEATER} r={0.95} /></mesh>
        <mesh position={[0, 1.33, 0.02]} rotation-x={Math.PI / 2}><torusGeometry args={[0.115, 0.032, 8, 20]} /><M c="#fffaf0" /></mesh>
        <mesh position={[0, 0.82, 0]}><cylinderGeometry args={[0.17, 0.18, 0.08, 20]} /><M c="#6f8d5f" /></mesh>
        {/* green dress skirt with a cream pinafore front and back */}
        <mesh position={[0, 0.64, 0]} castShadow><cylinderGeometry args={[0.18, 0.29, 0.42, 28]} /><M c={SWEATER} r={0.95} /></mesh>
        {[0, Math.PI].map((th, i) => (
          <group key={i}>
            <mesh position={[0, 0.63, 0]}><cylinderGeometry args={[0.187, 0.297, 0.4, 20, 1, true, th - 0.95, 1.9]} /><meshStandardMaterial color={APRON} roughness={0.95} side={THREE.DoubleSide} /></mesh>
            <mesh position={[0, 1.07, 0]} scale={[1.0, 1, 0.88]}><cylinderGeometry args={[0.172, 0.176, 0.42, 20, 1, true, th - 0.8, 1.6]} /><meshStandardMaterial color={APRON} roughness={0.95} side={THREE.DoubleSide} /></mesh>
          </group>
        ))}
        <group ref={pack} position={[0, 1.0, -0.2]}>
          <mesh scale={[0.6, 0.72, 0.45]} castShadow><sphereGeometry args={[0.2, 16, 14]} /><M c={PACK} r={0.9} /></mesh>
          <mesh position={[0, 0.0, 0.1]} scale={[0.8, 0.5, 0.3]}><sphereGeometry args={[0.2, 12, 10]} /><M c="#8f5f38" /></mesh>
          {goods.includes('balloon') && (
            <group position={[0.12, 0.1, -0.1]}>
              <mesh position={[0, 0.6, 0]}><cylinderGeometry args={[0.006, 0.006, 1.2, 4]} /><meshBasicMaterial color="#fff" /></mesh>
              <mesh position={[0, 1.3, 0]} scale={[0.9, 1.1, 0.9]}><sphereGeometry args={[0.24, 18, 14]} /><meshStandardMaterial color="#ff7f9a" roughness={0.3} /></mesh>
            </group>
          )}
          {goods.includes('keyring') && (
            <group position={[0.2, -0.12, -0.12]}>
              <mesh position={[0, -0.05, 0]}><cylinderGeometry args={[0.006, 0.006, 0.1, 4]} /><meshBasicMaterial color="#d8d8d8" /></mesh>
              <mesh position={[0, -0.16, 0]} scale={[1, 1, 0.5]}><icosahedronGeometry args={[0.06, 1]} /><meshStandardMaterial color="#ff5f86" roughness={0.3} /></mesh>
            </group>
          )}
        </group>

        {/* head */}
        <group ref={head} position={[0, 1.58, 0]} scale={0.8}>
          <mesh castShadow scale={[1, 0.96, 0.98]}><sphereGeometry args={[0.25, 28, 22]} /><SkinM /></mesh>
          {/* hair: soft cap, side-swept bangs, long side locks and long back hair */}
          <mesh position={[0, 0.03, -0.015]} scale={[1, 0.98, 1.02]}><sphereGeometry args={[0.272, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.4]} /><M c={HAIR} r={0.75} /></mesh>
          {[-0.2, -0.125, -0.05, 0.03, 0.11, 0.185].map((x, i) => (
            <mesh key={i} position={[x, 0.168 - Math.abs(x) * 0.28, 0.185 - Math.abs(x) * 0.42]} rotation-z={-0.3} scale={[1.25, 0.85 + (i % 2) * 0.12, 0.5]}><sphereGeometry args={[0.058, 14, 12]} /><M c={HAIR} r={0.75} /></mesh>
          ))}
          {/* hair shell: wraps temples, ears and the back of the head; open at the front for the face */}
          <mesh position={[0, 0.0, -0.01]} scale={[1, 1.02, 1.0]}>
            <sphereGeometry args={[0.268, 32, 20, Math.PI / 2 + 0.78, Math.PI * 2 - 1.56, Math.PI * 0.28, Math.PI * 0.44]} /><M c={HAIR} r={0.75} />
          </mesh>
          {/* face: big sparkly eyes, soft brows, tiny nose, little smile, rosy cheeks */}
          <Eye x={-0.092} refEye={eyeL} />
          <Eye x={0.092} refEye={eyeR} />
          {[-1, 1].map((sd) => (
            <mesh key={'br' + sd} position={[sd * 0.098, 0.062, 0.218]} rotation-z={sd * -0.16} rotation-y={sd * 0.3} scale={[1.9, 0.5, 0.4]}><sphereGeometry args={[0.02, 8, 6]} /><meshBasicMaterial color="#a8431f" /></mesh>
          ))}
          {[-1, 1].map((sd) => (
            <mesh key={sd} position={[sd * 0.15, -0.075, 0.195]} rotation-y={sd * 0.55} scale={[1.3, 0.75, 0.3]}><sphereGeometry args={[0.04, 12, 8]} /><meshBasicMaterial color="#ff9fae" transparent opacity={0.75} /></mesh>
          ))}
          {/* freckles */}
          <mesh position={[-0.095, -0.045, 0.2243]}><sphereGeometry args={[0.0065, 6, 5]} /><meshBasicMaterial color="#c46f45" /></mesh><mesh position={[-0.07, -0.062, 0.2292]}><sphereGeometry args={[0.0065, 6, 5]} /><meshBasicMaterial color="#c46f45" /></mesh><mesh position={[-0.11, -0.068, 0.2117]}><sphereGeometry args={[0.0065, 6, 5]} /><meshBasicMaterial color="#c46f45" /></mesh><mesh position={[-0.045, -0.04, 0.2398]}><sphereGeometry args={[0.0065, 6, 5]} /><meshBasicMaterial color="#c46f45" /></mesh><mesh position={[-0.085, -0.082, 0.2179]}><sphereGeometry args={[0.0065, 6, 5]} /><meshBasicMaterial color="#c46f45" /></mesh><mesh position={[0.095, -0.045, 0.2243]}><sphereGeometry args={[0.0065, 6, 5]} /><meshBasicMaterial color="#c46f45" /></mesh><mesh position={[0.07, -0.062, 0.2292]}><sphereGeometry args={[0.0065, 6, 5]} /><meshBasicMaterial color="#c46f45" /></mesh><mesh position={[0.11, -0.068, 0.2117]}><sphereGeometry args={[0.0065, 6, 5]} /><meshBasicMaterial color="#c46f45" /></mesh><mesh position={[0.045, -0.04, 0.2398]}><sphereGeometry args={[0.0065, 6, 5]} /><meshBasicMaterial color="#c46f45" /></mesh><mesh position={[0.085, -0.082, 0.2179]}><sphereGeometry args={[0.0065, 6, 5]} /><meshBasicMaterial color="#c46f45" /></mesh><mesh position={[-0.02, -0.032, 0.2442]}><sphereGeometry args={[0.0065, 6, 5]} /><meshBasicMaterial color="#c46f45" /></mesh><mesh position={[0.02, -0.032, 0.2442]}><sphereGeometry args={[0.0065, 6, 5]} /><meshBasicMaterial color="#c46f45" /></mesh>
          <mesh position={[0, -0.05, 0.243]} scale={[0.9, 0.7, 0.6]}><sphereGeometry args={[0.012, 8, 6]} /><meshBasicMaterial color="#e8a78c" /></mesh>
          <mesh position={[0, -0.095, 0.232]} rotation-z={Math.PI}><torusGeometry args={[0.03, 0.0075, 6, 14, Math.PI]} /><meshBasicMaterial color="#c4605a" /></mesh>
          {/* straw hat */}
          <group ref={hat} position={[0, 0.235, -0.03]} rotation-x={-0.22} scale={1.06}>
            <mesh position={[0, 0.07, 0]}><cylinderGeometry args={[0.17, 0.215, 0.14, 24]} /><M c={STRAW} r={1} /></mesh>
            <mesh position={[0, 0.0, 0]} scale={[1, 0.35, 1]}><cylinderGeometry args={[0.42, 0.44, 0.06, 32]} /><M c={STRAW} r={1} /></mesh>
            <mesh position={[0, 0.035, 0]} rotation-x={Math.PI / 2}><torusGeometry args={[0.2, 0.022, 8, 28]} /><M c={RIBBON} /></mesh>
            {goods.includes('hairpin') && [0, 1, 2, 3, 4].map((i) => (
              <mesh key={i} position={[0.2 + Math.cos(i * 1.256) * 0.05, 0.06, 0.12 + Math.sin(i * 1.256) * 0.05]}><icosahedronGeometry args={[0.04, 1]} /><meshStandardMaterial color="#ffffff" /></mesh>
            ))}
            {goods.includes('hairpin') && <mesh position={[0.2, 0.06, 0.12]}><icosahedronGeometry args={[0.03, 1]} /><meshStandardMaterial color="#ffd25a" /></mesh>}
          </group>
        </group>

        {/* two long braids over the shoulders, tied with orange bows */}
        {[-1, 1].map((sd) => (
          <group key={'braid' + sd} position={[sd * 0.155, 1.4, -0.06]} rotation-z={sd * 0.04}>
            {Array.from({ length: 7 }, (_, n) => (
              <mesh key={n} position={[sd * (n % 2 ? 0.012 : -0.012), -n * 0.072, 0]} scale={[1, 1.25, 0.9]} castShadow><sphereGeometry args={[0.052 - n * 0.0025, 12, 10]} /><M c={n % 2 ? '#d04a18' : HAIR} r={0.8} /></mesh>
            ))}
            <group position={[0, -0.52, 0.0]}>
              <mesh position={[-0.032, 0, 0]} scale={[1.2, 0.8, 0.6]}><sphereGeometry args={[0.036, 10, 8]} /><M c={BOW} /></mesh>
              <mesh position={[0.032, 0, 0]} scale={[1.2, 0.8, 0.6]}><sphereGeometry args={[0.036, 10, 8]} /><M c={BOW} /></mesh>
              <mesh><sphereGeometry args={[0.02, 8, 8]} /><M c="#d86f14" /></mesh>
              <mesh position={[0, -0.045, 0]} scale={[1, 1.5, 0.8]}><sphereGeometry args={[0.04, 10, 8]} /><M c={HAIR} /></mesh>
            </group>
          </group>
        ))}

        {/* arms */}
        {([['L', armL, 0.225], ['R', armR, -0.225]] as const).map(([k, ref, x]) => (
          <group key={k} ref={ref} position={[x, 1.3, 0]}>
            <mesh position={[0, -0.2, 0]} castShadow><capsuleGeometry args={[0.048, 0.34, 6, 14]} /><M c={SWEATER} r={0.95} /></mesh>
            <mesh position={[0, -0.5, 0.0]}><sphereGeometry args={[0.05, 14, 12]} /><SkinM /></mesh>
            {k === 'R' && (
              <group ref={bouquet} position={[0, -0.55, 0.12]} visible={false}>
                <mesh position={[0, -0.04, 0]}><coneGeometry args={[0.07, 0.16, 8]} /><M c="#fffaf0" /></mesh>
                {['#ff9ec4', '#ffffff', '#ffe066', '#c9a0ff', '#ffb3d0'].map((c, i) => (
                  <mesh key={i} position={[Math.cos(i * 1.3) * 0.055, 0.07 + (i % 2) * 0.04, Math.sin(i * 1.3) * 0.055]}><icosahedronGeometry args={[0.062, 1]} /><M c={c} /></mesh>
                ))}
              </group>
            )}
          </group>
        ))}

        {/* legs */}
        {([['L', legL, 0.075], ['R', legR, -0.075]] as const).map(([k, ref, x]) => (
          <group key={k} ref={ref} position={[x, 0.8, 0]}>
            <mesh position={[0, -0.33, 0]} castShadow><capsuleGeometry args={[0.058, 0.52, 6, 14]} /><M c={PANTS} r={0.95} /></mesh>
            <mesh position={[0, -0.7, 0.045]} scale={[1, 0.8, 1.35]}><sphereGeometry args={[0.072, 14, 12]} /><M c={SHOE} /></mesh>
            <mesh position={[0, -0.755, 0.05]} scale={[1, 0.25, 1.4]}><sphereGeometry args={[0.072, 14, 8]} /><M c={SOLE} /></mesh>
          </group>
        ))}
      </group>
    </group>
  )
}

/** Chihuahua companion: follows the player, sits when they stop, ears and tail animate. */
export function Dog() {
  const outfit = useStore((s) => s.dogOutfit)
  const root = useRef<THREE.Group>(null!)
  const rig = useRef<THREE.Group>(null!)
  const legs = [useRef<THREE.Group>(null!), useRef<THREE.Group>(null!), useRef<THREE.Group>(null!), useRef<THREE.Group>(null!)]
  const tail = useRef<THREE.Group>(null!)
  const head = useRef<THREE.Group>(null!)
  const earL = useRef<THREE.Group>(null!), earR = useRef<THREE.Group>(null!)
  const tongue = useRef<THREE.Mesh>(null!)
  const st = useRef({ x: 0, z: 108, hd: Math.PI, ph: 0, y: 1.7, init: false, still: 0, sit: 0 })

  useFrame((_, dt) => {
    const s = st.current
    const p = game.pos
    if (!s.init) { s.x = p.x + 0.5; s.z = p.z + 0.9; s.init = true }
    // stays close: just behind and a little to the side of the player
    let tx = p.x - Math.sin(game.heading) * 0.75 + Math.cos(game.heading) * 0.42
    let tz = p.z - Math.cos(game.heading) * 0.75 - Math.sin(game.heading) * 0.42
    // fetch: run to the ball, pick it up, bring it back to the player
    const ball = game.ball
    let chase = false
    if (ball.s === 'fly' || ball.s === 'rest') {
      chase = true; tx = ball.x; tz = ball.z
      if (ball.s === 'rest' && Math.hypot(s.x - ball.x, s.z - ball.z) < 0.55) ball.s = 'carry'
    } else if (ball.s === 'carry') {
      chase = true
      const ax = s.x - p.x, az = s.z - p.z, al = Math.hypot(ax, az) || 1
      tx = p.x + (ax / al) * 1.0; tz = p.z + (az / al) * 1.0
      if (al < 1.5) { ball.s = 'none'; game.treatUntil = game.time + 2.2; useStore.getState().say('🎾 잘했어요! 공을 물어 왔어요 💕') }
    }
    let dx = tx - s.x, dz = tz - s.z
    let d = Math.hypot(dx, dz)
    if (!chase && d > 6) { s.x = p.x - Math.sin(game.heading) * 1.0; s.z = p.z - Math.cos(game.heading) * 1.0; dx = dz = d = 0 }
    let moving = false
    if (d > 0.15) {
      const sp = Math.min(chase ? 8 : 9, 1.8 + d * 7) * dt
      const [nx, nz] = moveWithCollision(s.x, s.z, (dx / d) * sp, (dz / d) * sp)
      if (nx !== s.x || nz !== s.z) moving = true
      const want = Math.atan2(nx - s.x || dx, nz - s.z || dz)
      s.hd += Math.atan2(Math.sin(want - s.hd), Math.cos(want - s.hd)) * Math.min(1, dt * 10)
      s.x = nx; s.z = nz
      if (!canStand(s.x, s.z)) { s.x = p.x; s.z = p.z }
    } else {
      s.hd += Math.atan2(Math.sin(game.heading - s.hd), Math.cos(game.heading - s.hd)) * dt * 2
    }
    const treat = game.time < game.treatUntil
    s.still = moving ? 0 : s.still + dt
    if (treat) s.still = Math.max(s.still, 2)
    s.sit = damp(s.sit, s.still > 1.6 ? 1 : 0, Math.min(1, dt * 5))
    s.y = lerp(s.y, groundHeight(s.x, s.z), Math.min(1, dt * 12))
    s.ph += dt * (moving ? 17 : 0)
    const t = game.time
    root.current.position.set(s.x, s.y + (moving ? Math.abs(Math.sin(s.ph)) * 0.035 : 0), s.z)
    root.current.rotation.y = s.hd
    game.dog.x = s.x; game.dog.y = s.y; game.dog.z = s.z

    const sw = moving ? Math.sin(s.ph) * 0.75 : 0
    const sit = s.sit
    // diagonal gait: FL+HR together
    legs[0].current.rotation.x = sw * (1 - sit) + sit * 0.55
    legs[3].current.rotation.x = sw * (1 - sit) + sit * -1.35
    legs[1].current.rotation.x = -sw * (1 - sit) + sit * 0.55
    legs[2].current.rotation.x = -sw * (1 - sit) + sit * -1.35
    rig.current.rotation.x = -0.38 * sit + (moving ? Math.sin(s.ph * 2) * 0.03 : 0)
    rig.current.position.y = 0.3 - 0.09 * sit
    tail.current.rotation.z = Math.sin(t * (treat ? 22 : moving ? 15 : 9)) * (0.55 + sit * 0.2)
    head.current.rotation.x = Math.sin(t * 2) * 0.03 + sit * 0.5 + (moving ? 0.05 : 0) + (treat ? Math.sin(t * 14) * 0.06 : 0)
    head.current.rotation.y = moving ? 0 : Math.sin(t * 0.7) * 0.25 * sit
    const flop = moving ? Math.sin(s.ph) * 0.25 : Math.sin(t * 1.5) * 0.03
    earL.current.rotation.x = flop; earR.current.rotation.x = flop
    earL.current.rotation.z = 0.8 + flop * 0.4; earR.current.rotation.z = -0.8 - flop * 0.4
    tongue.current.visible = moving || sit > 0.5
    tongue.current.scale.y = 1 + (moving ? Math.sin(s.ph * 2) * 0.25 : Math.sin(t * 5) * 0.12)
  })

  // long-haired black & tan chihuahua (traced from the reference photos): black coat, tan cheeks/brows/legs,
  // white muzzle and fluffy chest ruff, big glossy eyes, broad rounded fluffy ears, plume tail
  const BLACK = '#211d20', TAN = '#d9a059', CREAM = '#fbf0e0', PINK = '#d9a5a8'
  const bCol = outfit === 'bandana-red' ? '#ff5f5f' : '#6fc0ff'
  const fur = (c: string, r = 1) => <meshStandardMaterial color={c} roughness={r} />
  return (
    <group ref={root} scale={0.58}>
      {/* rig pivots around the haunches so the dog can sit */}
      <group ref={rig} position={[0, 0.3, -0.2]}>
        <group position={[0, -0.3, 0.2]}>
          {/* body: black coat, fluffy chest ruff, cream hip patch */}
          <mesh position={[0, 0.42, 0]} rotation-x={Math.PI / 2} scale={[1.08, 1, 1.02]} castShadow><capsuleGeometry args={[0.125, 0.3, 8, 18]} />{fur(BLACK)}</mesh>
          <mesh position={[0, 0.41, 0.21]} scale={[0.72, 1.0, 0.8]}><sphereGeometry args={[0.15, 18, 14]} />{fur(CREAM)}</mesh>
          {[-1, 1].map((x) => (<mesh key={'t' + x} position={[x * 0.1, 0.39, 0.17]}><sphereGeometry args={[0.07, 12, 10]} />{fur(TAN)}</mesh>))}
          {[-1, 1].map((x) => (<mesh key={'h' + x} position={[x * 0.09, 0.38, -0.19]}><sphereGeometry args={[0.118, 16, 12]} />{fur(BLACK)}</mesh>))}
          {[-1, 1].map((x) => (<mesh key={'c' + x} position={[x * 0.125, 0.34, -0.17]}><sphereGeometry args={[0.05, 10, 8]} />{fur(CREAM)}</mesh>))}
          {/* neck ruff */}
          <mesh position={[0, 0.57, 0.27]} rotation-x={0.6}><capsuleGeometry args={[0.08, 0.08, 6, 12]} />{fur(BLACK)}</mesh>
          <mesh position={[0, 0.54, 0.3]} scale={[0.85, 1, 0.8]}><sphereGeometry args={[0.095, 14, 12]} />{fur(CREAM)}</mesh>
          {[-1, 1].map((x) => (<mesh key={'n' + x} position={[x * 0.085, 0.585, 0.25]} scale={[0.7, 1, 0.8]}><sphereGeometry args={[0.055, 12, 10]} />{fur('#ecd2a6')}</mesh>))}

          <group ref={head} position={[0, 0.72, 0.34]} scale={1.18}>
            {/* round apple head, black with tan cheeks and brows */}
            <mesh castShadow><sphereGeometry args={[0.178, 26, 22]} />{fur(BLACK, 0.9)}</mesh>
            {[-1, 1].map((x) => (<mesh key={'ck' + x} position={[x * 0.1, -0.065, 0.065]} scale={[0.85, 1.0, 0.95]}><sphereGeometry args={[0.085, 18, 14]} />{fur('#ecd2a6', 1)}</mesh>))}
            {[-1, 1].map((x) => (<mesh key={'ck2' + x} position={[x * 0.125, -0.02, 0.03]} scale={[0.6, 1.0, 0.9]}><sphereGeometry args={[0.07, 14, 12]} />{fur('#f3e0bd', 1)}</mesh>))}
            {[-1, 1].map((x) => (<mesh key={'br' + x} position={[x * 0.08, 0.1, 0.14]} rotation-z={x * -0.35} scale={[1.3, 0.7, 0.5]}><sphereGeometry args={[0.03, 10, 8]} />{fur(TAN, 0.9)}</mesh>))}
            {/* short white muzzle + black nose */}
            <mesh position={[0, -0.06, 0.135]} scale={[1.05, 0.8, 1.1]}><sphereGeometry args={[0.068, 16, 12]} />{fur(CREAM, 0.9)}</mesh>
            <mesh position={[0, -0.036, 0.2]} scale={[1.15, 0.85, 1]}><sphereGeometry args={[0.03, 12, 10]} /><meshStandardMaterial color="#141012" roughness={0.25} /></mesh>
            <mesh ref={tongue} position={[0, -0.103, 0.18]} scale={[1.2, 0.6, 0.9]} visible={false}><sphereGeometry args={[0.026, 10, 8]} /><meshBasicMaterial color="#ff8aa0" /></mesh>
            {/* sparkly round eyes: dark brown iris, big pupil, two bright highlights */}
            {[-1, 1].map((x) => (
              <group key={'e' + x} position={[x * 0.082, 0.02, 0.15]} rotation-y={x * 0.18}>
                <mesh scale={[1, 1.05, 0.55]}><sphereGeometry args={[0.04, 20, 16]} /><meshStandardMaterial color="#fffaf2" roughness={0.3} /></mesh>
                <mesh position={[0, 0, 0.012]} scale={[1, 1.05, 0.5]}><sphereGeometry args={[0.036, 20, 16]} /><meshStandardMaterial color="#4a2a18" roughness={0.1} /></mesh>
                <mesh position={[0, 0, 0.019]} scale={[1, 1.05, 0.5]}><sphereGeometry args={[0.026, 18, 14]} /><meshStandardMaterial color="#070405" roughness={0.05} /></mesh>
                <mesh position={[0.012, 0.014, 0.03]}><sphereGeometry args={[0.012, 10, 8]} /><meshBasicMaterial color="#ffffff" /></mesh>
                <mesh position={[-0.01, -0.012, 0.028]}><sphereGeometry args={[0.006, 8, 6]} /><meshBasicMaterial color="#ffffff" /></mesh>
              </group>
            ))}
            {/* rosy blush */}
            {[-1, 1].map((x) => (<mesh key={'bl' + x} position={[x * 0.125, -0.045, 0.1]} rotation-y={x * 0.9} scale={[1, 0.6, 0.3]}><sphereGeometry args={[0.032, 12, 8]} /><meshBasicMaterial color="#ff9fb0" transparent opacity={0.55} /></mesh>))}
            {/* broad, rounded ears with pink insides */}
            {[-1, 1].map((x) => (
              <group key={'ear' + x} ref={x < 0 ? earL : earR} position={[x * 0.125, 0.12, -0.02]} scale={0.78} rotation-z={x * -0.8} rotation-x={-0.1}>
                <mesh position={[0, 0.11, 0]} scale={[1.05, 1.15, 0.38]}><sphereGeometry args={[0.108, 22, 16]} />{fur(BLACK, 0.95)}</mesh>
                <mesh position={[0, 0.1, 0.026]} scale={[0.7, 0.92, 0.28]}><sphereGeometry args={[0.096, 18, 12]} />{fur(PINK, 0.9)}</mesh>
              </group>
            ))}
            {outfit === 'ribbon-pink' && (
              <group position={[0.02, 0.185, 0.05]}>
                <mesh position={[-0.035, 0, 0]} scale={[1.2, 0.8, 0.6]}><sphereGeometry args={[0.035, 10, 8]} /><meshStandardMaterial color="#ff8fb4" /></mesh>
                <mesh position={[0.035, 0, 0]} scale={[1.2, 0.8, 0.6]}><sphereGeometry args={[0.035, 10, 8]} /><meshStandardMaterial color="#ff8fb4" /></mesh>
                <mesh><sphereGeometry args={[0.02, 8, 8]} /><meshStandardMaterial color="#ff5f92" /></mesh>
              </group>
            )}
          </group>

          {/* legs [FL, FR, HL, HR]: tan, thin, with cream paws; hind thighs stay black */}
          {([[-0.075, 0.17, 0], [0.075, 0.17, 1], [-0.085, -0.19, 2], [0.085, -0.19, 3]] as const).map(([x, z, i]) => (
            <group key={i} ref={legs[i]} position={[x, 0.32, z]}>
              <mesh position={[0, -0.14, 0]} castShadow><capsuleGeometry args={[0.032, 0.2, 6, 10]} />{fur(i < 2 ? TAN : BLACK, 0.95)}</mesh>
              {i >= 2 && <mesh position={[0, -0.22, 0]}><capsuleGeometry args={[0.03, 0.06, 6, 8]} />{fur(TAN, 0.95)}</mesh>}
              <mesh position={[0, -0.275, 0.02]} scale={[1, 0.75, 1.3]}><sphereGeometry args={[0.041, 10, 8]} />{fur(i < 2 ? '#e8bb83' : CREAM, 0.95)}</mesh>
            </group>
          ))}
          {outfit?.startsWith('sweater') && (
            <mesh position={[0, 0.425, 0.0]} rotation-x={Math.PI / 2}><capsuleGeometry args={[0.142, 0.26, 8, 18]} /><meshStandardMaterial color={outfit === 'sweater-pink' ? '#ffb3c7' : '#a6e3cf'} roughness={1} /></mesh>
          )}
          {outfit?.startsWith('bandana') && (
            <group>
              <mesh position={[0, 0.6, 0.285]} rotation-x={-0.97}><torusGeometry args={[0.1, 0.03, 8, 18]} /><meshStandardMaterial color={bCol} roughness={0.9} /></mesh>
              <mesh position={[0, 0.5, 0.34]} rotation-x={Math.PI - 0.3} scale={[1, 1, 0.35]}><coneGeometry args={[0.07, 0.12, 3]} /><meshStandardMaterial color={bCol} roughness={0.9} /></mesh>
            </group>
          )}
          {/* fluffy plume tail curling up over the back */}
          <group ref={tail} position={[0, 0.5, -0.3]} rotation-x={-1.05}>
            <mesh position={[0, 0.1, 0]}><capsuleGeometry args={[0.03, 0.14, 6, 8]} />{fur(BLACK)}</mesh>
            <mesh position={[0, 0.24, 0.015]} scale={[1, 2.1, 0.95]}><sphereGeometry args={[0.062, 14, 12]} />{fur(BLACK)}</mesh>
            <mesh position={[0, 0.34, 0.03]} scale={[0.8, 1.1, 0.8]}><sphereGeometry args={[0.05, 12, 10]} />{fur('#2c2629')}</mesh>
          </group>
        </group>
      </group>
    </group>
  )
}
