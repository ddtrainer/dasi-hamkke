import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { game, benchSeat, BENCH_SEAT_Y } from './game'
import { useStore } from '../lib/store'
import { groundHeight, canStand, moveWithCollision } from './terrain'
import { DogBody, EAR_BASE } from './DogModel'
import type { AvatarId } from '../lib/store'

const lerp = THREE.MathUtils.lerp
const damp = (a: number, b: number, k: number) => lerp(a, b, k)

// palette — soft, picnic-day colours
const SKIN = '#f6d1b0', HAIR = '#e2561f', SWEATER = '#86a874', PANTS = '#6e5a4c', SHOE = '#5a3b2a', SOLE = '#3d2a1e'
const STRAW = '#eaaf5a', RIBBON = '#7b4a2c', PACK = '#b07a4c', BOW = '#f08a2a', APRON = '#fbf1d6'

const M = ({ c, r = 0.85 }: { c: string; r?: number }) => <meshStandardMaterial color={c} roughness={r} />
/** skin keeps a soft warm glow so the face never turns olive in shade */
const SkinM = () => <meshStandardMaterial color={SKIN} roughness={0.7} emissive="#ffb598" emissiveIntensity={0.55} />

function Eye({ x, refEye, iris }: { x: number; refEye: React.RefObject<THREE.Group>; iris: string }) {
  const sd = Math.sign(x)
  return (
    <group position={[x, -0.012, 0.222]} rotation-y={sd * 0.22}>
      <group ref={refEye}>
        <mesh scale={[0.88, 1.08, 0.42]}><sphereGeometry args={[0.046, 18, 14]} /><meshBasicMaterial color="#fffdf8" /></mesh>
        <mesh position={[0, -0.004, 0.012]} scale={[0.86, 1.04, 0.4]}><sphereGeometry args={[0.04, 18, 14]} /><meshBasicMaterial color={iris} /></mesh>
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

export type AvatarLook = {
  hair: string; brow: string; iris: string; top: string; belt: string; pants: string; shoe: string
  longHair: boolean; skirt: boolean; skirtCol: string; apron: boolean; braids: boolean; freckles: boolean; hat: 'straw' | 'cap' | null; capCol: string
  cap: number; shell: number // hair cap / back-hair coverage
  blush: number // cheek colour strength
}
/** the two people to choose from on entering: a Korean woman and a Korean man */
export const LOOKS: Record<AvatarId, AvatarLook> = {
  // long straight black hair with a soft fringe, ivory knit, light-blue skirt, dark tights, white sneakers
  girl: { longHair: true, hair: '#1d1816', brow: '#2a201c', iris: '#3b2519', top: '#f1e7d6', belt: '#7fa0c8', pants: '#4a4442', shoe: '#f3efe8', skirt: true, skirtCol: '#8fb2dc', apron: false, braids: false, freckles: false, hat: null, capCol: '#ffffff', cap: Math.PI * 0.42, shell: Math.PI * 0.52, blush: 0.6 },
  // neat short black hair, navy sweatshirt, beige chinos, white sneakers
  boy: { longHair: false, hair: '#1b1614', brow: '#241b17', iris: '#3b2519', top: '#41546f', belt: '#41546f', pants: '#c9b896', shoe: '#f3f3f3', skirt: false, skirtCol: '#000000', apron: false, braids: false, freckles: false, hat: null, capCol: '#ffffff', cap: Math.PI * 0.43, shell: Math.PI * 0.2, blush: 0.32 },
}

export interface AvatarRefs {
  root: React.RefObject<THREE.Group>; body: React.RefObject<THREE.Group>
  armL: React.RefObject<THREE.Group>; armR: React.RefObject<THREE.Group>
  legL: React.RefObject<THREE.Group>; legR: React.RefObject<THREE.Group>
  head: React.RefObject<THREE.Group>; hat: React.RefObject<THREE.Group>; pack: React.RefObject<THREE.Group>
  bouquet: React.RefObject<THREE.Group>; eyeL: React.RefObject<THREE.Group>; eyeR: React.RefObject<THREE.Group>
}

/** The person's meshes; the look (girl / boy / plain) decides hair, clothes and accessories. */
export function AvatarBody({ look, goods, refs }: { look: AvatarLook; goods: string[]; refs: AvatarRefs }) {
  const { root, body, armL, armR, legL, legR, head, hat, pack, bouquet, eyeL, eyeR } = refs
  return (
    <group ref={root}>
      <group ref={body}>
        {/* torso: sweater + white collar */}
        <mesh position={[0, 1.06, 0]} castShadow scale={[1.0, 1.08, 0.86]}><capsuleGeometry args={[0.165, 0.38, 8, 20]} /><M c={look.top} r={0.95} /></mesh>
        <mesh position={[0, 1.33, 0.02]} rotation-x={Math.PI / 2}><torusGeometry args={[0.115, 0.032, 8, 20]} /><M c="#fffaf0" /></mesh>
        <mesh position={[0, 0.82, 0]}><cylinderGeometry args={[0.17, 0.18, 0.08, 20]} /><M c={look.belt} /></mesh>
        {look.skirt && (<>
        {/* green dress skirt with a cream pinafore front and back */}
        <mesh position={[0, 0.64, 0]} castShadow><cylinderGeometry args={[0.18, 0.29, 0.42, 28]} /><M c={look.skirtCol} r={0.95} /></mesh>
        {look.apron && (<>
        {[0, Math.PI].map((th, i) => (
          <group key={i}>
            <mesh position={[0, 0.63, 0]}><cylinderGeometry args={[0.187, 0.297, 0.4, 20, 1, true, th - 0.95, 1.9]} /><meshStandardMaterial color={APRON} roughness={0.95} side={THREE.DoubleSide} /></mesh>
            <mesh position={[0, 1.07, 0]} scale={[1.0, 1, 0.88]}><cylinderGeometry args={[0.172, 0.176, 0.42, 20, 1, true, th - 0.8, 1.6]} /><meshStandardMaterial color={APRON} roughness={0.95} side={THREE.DoubleSide} /></mesh>
          </group>
        ))}
        </>)}
        </>)}
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
          <mesh position={[0, 0.03, -0.015]} scale={[1, 0.98, 1.02]}><sphereGeometry args={[0.272, 28, 18, 0, Math.PI * 2, 0, look.cap]} /><M c={look.hair} r={0.75} /></mesh>
          {[-0.2, -0.125, -0.05, 0.03, 0.11, 0.185].map((x, i) => (
            <mesh key={i} position={[x, 0.168 - Math.abs(x) * 0.28, 0.185 - Math.abs(x) * 0.42]} rotation-z={-0.3} scale={[1.25, 0.85 + (i % 2) * 0.12, 0.5]}><sphereGeometry args={[0.058, 14, 12]} /><M c={look.hair} r={0.75} /></mesh>
          ))}
          {/* hair shell: wraps temples, ears and the back of the head; open at the front for the face */}
          <mesh position={[0, 0.0, -0.01]} scale={[1, 1.02, 1.0]}>
            <sphereGeometry args={[0.268, 32, 20, Math.PI / 2 + 0.78, Math.PI * 2 - 1.56, Math.PI * 0.28, look.shell]} /><M c={look.hair} r={0.75} />
          </mesh>
          {/* face: big sparkly eyes, soft brows, tiny nose, little smile, rosy cheeks */}
          <Eye x={-0.092} refEye={eyeL} iris={look.iris} />
          <Eye x={0.092} refEye={eyeR} iris={look.iris} />
          {[-1, 1].map((sd) => (
            <mesh key={'br' + sd} position={[sd * 0.098, 0.062, 0.218]} rotation-z={sd * -0.16} rotation-y={sd * 0.3} scale={[1.9, 0.5, 0.4]}><sphereGeometry args={[0.02, 8, 6]} /><meshBasicMaterial color={look.brow} /></mesh>
          ))}
          {[-1, 1].map((sd) => (
            <mesh key={sd} position={[sd * 0.15, -0.075, 0.195]} rotation-y={sd * 0.55} scale={[1.3, 0.75, 0.3]}><sphereGeometry args={[0.04, 12, 8]} /><meshBasicMaterial color="#ff9fae" transparent opacity={look.blush} /></mesh>
          ))}
          {/* freckles */}
          {look.freckles && (<><mesh position={[-0.095, -0.045, 0.2243]}><sphereGeometry args={[0.0065, 6, 5]} /><meshBasicMaterial color="#c46f45" /></mesh><mesh position={[-0.07, -0.062, 0.2292]}><sphereGeometry args={[0.0065, 6, 5]} /><meshBasicMaterial color="#c46f45" /></mesh><mesh position={[-0.11, -0.068, 0.2117]}><sphereGeometry args={[0.0065, 6, 5]} /><meshBasicMaterial color="#c46f45" /></mesh><mesh position={[-0.045, -0.04, 0.2398]}><sphereGeometry args={[0.0065, 6, 5]} /><meshBasicMaterial color="#c46f45" /></mesh><mesh position={[-0.085, -0.082, 0.2179]}><sphereGeometry args={[0.0065, 6, 5]} /><meshBasicMaterial color="#c46f45" /></mesh><mesh position={[0.095, -0.045, 0.2243]}><sphereGeometry args={[0.0065, 6, 5]} /><meshBasicMaterial color="#c46f45" /></mesh><mesh position={[0.07, -0.062, 0.2292]}><sphereGeometry args={[0.0065, 6, 5]} /><meshBasicMaterial color="#c46f45" /></mesh><mesh position={[0.11, -0.068, 0.2117]}><sphereGeometry args={[0.0065, 6, 5]} /><meshBasicMaterial color="#c46f45" /></mesh><mesh position={[0.045, -0.04, 0.2398]}><sphereGeometry args={[0.0065, 6, 5]} /><meshBasicMaterial color="#c46f45" /></mesh><mesh position={[0.085, -0.082, 0.2179]}><sphereGeometry args={[0.0065, 6, 5]} /><meshBasicMaterial color="#c46f45" /></mesh><mesh position={[-0.02, -0.032, 0.2442]}><sphereGeometry args={[0.0065, 6, 5]} /><meshBasicMaterial color="#c46f45" /></mesh><mesh position={[0.02, -0.032, 0.2442]}><sphereGeometry args={[0.0065, 6, 5]} /><meshBasicMaterial color="#c46f45" /></mesh></>)}
          <mesh position={[0, -0.05, 0.243]} scale={[0.9, 0.7, 0.6]}><sphereGeometry args={[0.012, 8, 6]} /><meshBasicMaterial color="#e8a78c" /></mesh>
          <mesh position={[0, -0.095, 0.232]} rotation-z={Math.PI}><torusGeometry args={[0.03, 0.0075, 6, 14, Math.PI]} /><meshBasicMaterial color="#c4605a" /></mesh>
          {look.hat === 'straw' && (<>
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
          </>)}
          {goods.includes('hairpin') && look.hat !== 'straw' && (
            <group position={[0.17, 0.13, 0.1]} rotation-y={0.5}>
              {[0, 1, 2, 3, 4].map((i) => (<mesh key={i} position={[Math.cos(i * 1.256) * 0.045, Math.sin(i * 1.256) * 0.045, 0]}><icosahedronGeometry args={[0.035, 1]} /><meshStandardMaterial color="#ffffff" /></mesh>))}
              <mesh><icosahedronGeometry args={[0.028, 1]} /><meshStandardMaterial color="#ffd25a" /></mesh>
            </group>
          )}
          {look.hat === 'cap' && (
            <group ref={hat} position={[0, 0.06, -0.012]} rotation-x={-0.12}>
              <mesh><sphereGeometry args={[0.275, 26, 16, 0, Math.PI * 2, 0, Math.PI * 0.5]} /><M c={look.capCol} r={0.9} /></mesh>
              <mesh position={[0, 0.28, 0]}><sphereGeometry args={[0.022, 8, 6]} /><M c="#ffffff" /></mesh>
              <mesh position={[0, -0.005, 0.17]} rotation-x={Math.PI / 2}><circleGeometry args={[0.21, 24, 0, Math.PI]} /><meshStandardMaterial color={look.capCol} roughness={0.9} side={THREE.DoubleSide} /></mesh>
            </group>
          )}
        </group>

        {look.longHair && (
          <group position={[0, 1.46, -0.115]}>
            <mesh scale={[1.18, 1, 0.55]} castShadow><capsuleGeometry args={[0.15, 0.2, 8, 16]} /><M c={look.hair} r={0.75} /></mesh>
            {[-1, 1].map((sd) => (<mesh key={sd} position={[sd * 0.185, 0.04, 0.08]} scale={[0.9, 1, 0.8]}><capsuleGeometry args={[0.05, 0.2, 6, 10]} /><M c={look.hair} r={0.75} /></mesh>))}
          </group>
        )}
        {look.braids && (<>
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

        </>)}

        {/* arms */}
        {([['L', armL, 0.225], ['R', armR, -0.225]] as const).map(([k, ref, x]) => (
          <group key={k} ref={ref} position={[x, 1.3, 0]}>
            <mesh position={[0, -0.2, 0]} castShadow><capsuleGeometry args={[0.048, 0.34, 6, 14]} /><M c={look.top} r={0.95} /></mesh>
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
            <mesh position={[0, -0.33, 0]} castShadow><capsuleGeometry args={[0.058, 0.52, 6, 14]} /><M c={look.pants} r={0.95} /></mesh>
            <mesh position={[0, -0.7, 0.045]} scale={[1, 0.8, 1.35]}><sphereGeometry args={[0.072, 14, 12]} /><M c={look.shoe} /></mesh>
            <mesh position={[0, -0.755, 0.05]} scale={[1, 0.25, 1.4]}><sphereGeometry args={[0.072, 14, 8]} /><M c={SOLE} /></mesh>
          </group>
        ))}
      </group>
    </group>
  )
}

/** Soft, chibi-proportioned human avatar with Idle / Walk / Run / Sit / Offer-flowers animation. */
export function Avatar() {
  const goods = useStore((s) => s.goods)
  const look = LOOKS[useStore((s) => s.avatar)]
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
  const refs = { root, body, armL, armR, legL, legR, head, hat, pack, bouquet, eyeL, eyeR }

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
    if (hat.current) hat.current.rotation.x = -0.22 - (moving ? Math.abs(Math.sin(phase.current)) * 0.06 : 0)
    pack.current.rotation.x = moving ? Math.sin(phase.current * 2) * 0.03 : 0
    // greeting: the right arm goes up and waves
    if (game.time < game.waveUntil && !moving && !sit) {
      armR.current.rotation.x = 0
      armR.current.rotation.z = -2.45 + Math.sin(t * 14) * 0.3
    }
    // blink
    const blink = (t % 3.8) < 0.12 ? 0.1 : 1
    eyeL.current.scale.y = eyeR.current.scale.y = blink
    bouquet.current.visible = offer && game.feed.t < 0
  })

  return <AvatarBody look={look} goods={goods} refs={refs} />
}

/** Chihuahua companion: follows the player, sits when they stop, ears and tail animate. */
export function Dog() {
  const outfit = useStore((s) => s.dogOutfit)
  const defPet = useStore((s) => s.pet)
  const pets = useStore((s) => s.pets)
  const companionId = useStore((s) => s.companionId)
  const memorials = useStore((s) => s.memorials)
  const userId = useStore((s) => s.userId)
  // who walks with the visitor: the dog called out of a shrine photo; with shrine dogs waiting, nobody until one is called
  const comp = companionId && memorials.some((m) => m.id === companionId && m.ownerId === userId) ? pets[companionId] ?? null : null
  const hidden = !comp && memorials.some((m) => m.ownerId === userId && pets[m.id])
  const pet = comp ?? defPet
  const hiddenRef = useRef(hidden)
  hiddenRef.current = hidden
  const root = useRef<THREE.Group>(null!)
  const rig = useRef<THREE.Group>(null!)
  const legs = [useRef<THREE.Group>(null!), useRef<THREE.Group>(null!), useRef<THREE.Group>(null!), useRef<THREE.Group>(null!)]
  const tail = useRef<THREE.Group>(null!)
  const head = useRef<THREE.Group>(null!)
  const earL = useRef<THREE.Group>(null!), earR = useRef<THREE.Group>(null!)
  const tongue = useRef<THREE.Mesh>(null!)
  const petSize = useRef(pet.size)
  petSize.current = pet.size
  const refs = { rig, legs, tail, head, earL, earR, tongue }
  const earBase = useRef(EAR_BASE[pet.ears])
  earBase.current = EAR_BASE[pet.ears]
  const st = useRef({ x: 0, z: 108, hd: Math.PI, ph: 0, y: 1.7, init: false, still: 0, sit: 0, sumN: 0, emerge: 1, pending: false })

  useFrame((_, dt) => {
    const s = st.current
    const p = game.pos
    if (!s.init) { s.x = p.x + 0.5; s.z = p.z + 0.9; s.init = true }
    // called out of a shrine photo: appear in the light in front of the shrine, then walk over to the visitor
    if (game.summon.n !== s.sumN) {
      s.sumN = game.summon.n; s.x = game.summon.x; s.z = game.summon.z; s.emerge = 0; s.pending = true; s.y = groundHeight(s.x, s.z)
      s.hd = Math.atan2(p.x - s.x, p.z - s.z)
    }
    game.dogHidden = hiddenRef.current
    if (hiddenRef.current) { root.current.visible = false; game.dog.x = p.x; game.dog.y = p.y; game.dog.z = p.z; return }
    root.current.visible = true
    if (s.emerge < 1) s.emerge = Math.min(1, s.emerge + dt / 2.4)
    const e = s.emerge, grow = e >= 1 ? 1 : 1 - Math.pow(1 - e, 3)
    root.current.scale.setScalar(0.58 * petSize.current * grow)
    const hold = s.emerge < 0.6
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
    // snack: trot round to the front of the visitor, sit and eat
    const feeding = game.feed.t >= 0 && !chase
    if (feeding) { tx = p.x + Math.sin(game.heading) * 0.8 - Math.cos(game.heading) * 0.75; tz = p.z + Math.cos(game.heading) * 0.8 + Math.sin(game.heading) * 0.75 } // front-right, where the camera sees it
    // bench: hop up beside the visitor
    const bn = game.bench
    if (bn.on && !chase) { const q = benchSeat(bn, 0.38); tx = q.x; tz = q.z }
    let dx = tx - s.x, dz = tz - s.z
    let d = Math.hypot(dx, dz)
    if (hold) { dx = dz = d = 0 }
    if (s.pending && !hold && Math.hypot(s.x - p.x, s.z - p.z) < 1.5) { s.pending = false; game.treatUntil = game.time + 2.4 }
    if (!chase && d > 6) { s.x = p.x - Math.sin(game.heading) * 1.0; s.z = p.z - Math.cos(game.heading) * 1.0; dx = dz = d = 0 }
    let moving = false
    const onBench = bn.on && !chase && !hold && d < 1.4
    if (onBench) {
      // too close to walk round the bench (its collision circle would stop the dog): slide up onto the seat
      const kk = Math.min(1, dt * 4)
      s.x += dx * kk; s.z += dz * kk
      moving = d > 0.25
      const want = moving ? Math.atan2(dx, dz) : bn.ry
      s.hd += Math.atan2(Math.sin(want - s.hd), Math.cos(want - s.hd)) * Math.min(1, dt * 8)
    } else if (d > 0.15) {
      const sp = Math.min(chase ? 8 : 9, 1.8 + d * 7) * dt
      const [nx, nz] = moveWithCollision(s.x, s.z, (dx / d) * sp, (dz / d) * sp)
      if (nx !== s.x || nz !== s.z) moving = true
      const want = Math.atan2(nx - s.x || dx, nz - s.z || dz)
      s.hd += Math.atan2(Math.sin(want - s.hd), Math.cos(want - s.hd)) * Math.min(1, dt * 10)
      s.x = nx; s.z = nz
      if (!canStand(s.x, s.z)) { s.x = p.x; s.z = p.z }
    } else {
      const wantH = feeding ? Math.atan2(p.x - s.x, p.z - s.z) : game.heading // while eating: look at the visitor
      s.hd += Math.atan2(Math.sin(wantH - s.hd), Math.cos(wantH - s.hd)) * dt * (feeding ? 6 : 2)
    }
    const treat = game.time < game.treatUntil
    s.still = moving ? 0 : s.still + dt
    if (onBench && !moving) s.still = Math.max(s.still, 2)
    const eating = feeding && !moving && game.feed.t > 1.1 && game.feed.t < 3.5
    if (feeding && !moving && d < 0.4) s.still = Math.max(s.still, 2) // sits at once when it has arrived
    if (treat) s.still = Math.max(s.still, 2)
    s.sit = damp(s.sit, s.still > 1.6 ? 1 : 0, Math.min(1, dt * 5))
    s.y = lerp(s.y, onBench && d < 0.7 ? bn.y + BENCH_SEAT_Y : groundHeight(s.x, s.z), Math.min(1, dt * 12))
    s.ph += dt * (moving ? 17 : 0)
    const t = game.time
    root.current.position.set(s.x, s.y + (moving ? Math.abs(Math.sin(s.ph)) * 0.035 : 0) + (treat ? Math.abs(Math.sin(t * 9)) * 0.1 : 0) + (1 - grow) * 0.55, s.z)
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
    head.current.rotation.x = Math.sin(t * 2) * 0.03 + sit * 0.5 + (eating ? 0.25 + Math.abs(Math.sin(t * 9)) * 0.35 : 0) + (moving ? 0.05 : 0) + (treat ? Math.sin(t * 14) * 0.06 : 0)
    head.current.rotation.y = moving ? 0 : Math.sin(t * 0.7) * 0.25 * sit
    const flop = moving ? Math.sin(s.ph) * 0.25 : Math.sin(t * 1.5) * 0.03
    earL.current.rotation.x = flop; earR.current.rotation.x = flop
    earL.current.rotation.z = earBase.current + flop * 0.4; earR.current.rotation.z = -earBase.current - flop * 0.4
    tongue.current.visible = moving || sit > 0.5 || eating
    tongue.current.scale.y = 1 + (moving ? Math.sin(s.ph * 2) * 0.25 : Math.sin(t * 5) * 0.12)
  })

  return (
    <group ref={root} scale={0.58 * pet.size}>
      <DogBody pet={pet} outfit={outfit} refs={refs} />
    </group>
  )
}

/** A column of warm light and rising sparkles where a dog steps out of (or back into) its photo. */
export function SummonGlow() {
  const col = useRef<THREE.Mesh>(null!)
  const ring = useRef<THREE.Mesh>(null!)
  const dots = useRef<THREE.InstancedMesh>(null!)
  const seed = useMemo(() => Array.from({ length: 28 }, (_, i) => ({ a: i * 2.399, r: 0.15 + ((i * 37) % 10) / 10 * 0.55, v: 0.7 + ((i * 53) % 10) / 10 * 0.9, d: ((i * 17) % 10) / 10 * 0.5 })), [])
  const o = useMemo(() => new THREE.Object3D(), [])
  useFrame((_, dt) => {
    const g = game.glow
    if (g.t < 0) { col.current.visible = ring.current.visible = dots.current.visible = false; return }
    g.t += dt
    const T = 2.6, k = g.t / T
    if (k >= 1) { g.t = -1; return }
    const env = Math.sin(Math.min(1, k * 1.15) * Math.PI)
    col.current.visible = ring.current.visible = dots.current.visible = true
    col.current.position.set(g.x, g.y + 1.7, g.z); col.current.scale.set(1 + k * 0.4, 1, 1 + k * 0.4)
    ;(col.current.material as THREE.MeshBasicMaterial).opacity = env * 0.38
    ring.current.position.set(g.x, g.y + 0.06, g.z); ring.current.scale.setScalar(0.4 + k * 2.2)
    ;(ring.current.material as THREE.MeshBasicMaterial).opacity = env * 0.7
    seed.forEach((s, i) => {
      const kk = Math.min(1, Math.max(0, (k - s.d * 0.4) / 0.7))
      o.position.set(g.x + Math.cos(s.a + kk * 2) * s.r, g.y + 0.1 + kk * 2.8 * s.v, g.z + Math.sin(s.a + kk * 2) * s.r)
      o.scale.setScalar(Math.sin(kk * Math.PI) * 0.09 + 0.001)
      o.updateMatrix(); dots.current.setMatrixAt(i, o.matrix)
    })
    dots.current.instanceMatrix.needsUpdate = true
  })
  return (
    <>
      <mesh ref={col} visible={false} renderOrder={5}><cylinderGeometry args={[0.55, 0.8, 3.4, 20, 1, true]} /><meshBasicMaterial color="#fff0c0" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} fog={false} /></mesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2} visible={false} renderOrder={5}><ringGeometry args={[0.7, 0.85, 40]} /><meshBasicMaterial color="#ffe9a8" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} /></mesh>
      <instancedMesh ref={dots} args={[undefined, undefined, 28]} visible={false} frustumCulled={false} renderOrder={5}><sphereGeometry args={[1, 8, 6]} /><meshBasicMaterial color="#fff4cf" transparent depthWrite={false} blending={THREE.AdditiveBlending} fog={false} /></instancedMesh>
    </>
  )
}
