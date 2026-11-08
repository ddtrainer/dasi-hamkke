import { useMemo } from 'react'
import type { RefObject } from 'react'
import * as THREE from 'three'
import type { PetProfile, PartId, Mark } from '../lib/pet'

export interface DogRefs {
  rig: RefObject<THREE.Group>
  legs: RefObject<THREE.Group>[]
  tail: RefObject<THREE.Group>
  head: RefObject<THREE.Group>
  earL: RefObject<THREE.Group>
  earR: RefObject<THREE.Group>
  tongue: RefObject<THREE.Mesh>
}

/** resting angle of each ear type (the animation adds a little flop on top) */
export const EAR_BASE: Record<PetProfile['ears'], number> = { round: 0.8, perky: 0.14, big: 0.22, drop: -0.14, fold: 1.05 }

const _a = new THREE.Color(), _b = new THREE.Color()
const mix = (c1: string, c2: string, t: number) => '#' + _a.set(c1).lerp(_b.set(c2), t).getHexString()

/** Which colour each body part gets, depending on the coat pattern. */
export function coatParts(p: PetProfile) {
  const c = coatBase(p)
  if (p.socks) { c.pawF = p.white; c.pawH = p.white }
  if (p.tailTip) c.tailTip = p.white
  return c
}

function coatBase(p: PetProfile) {
  const m = p.coat, a = p.accent, w = p.white
  const base = {
    body: m, head: m, hindThigh: m, ruff: m, earOut: m, tail: m,
    chest: mix(m, w, 0.45), tanChest: m, hindWhite: m, ruffFront: mix(m, w, 0.45), ruffSide: m,
    cheek: m, cheek2: mix(m, w, 0.25), brow: m, muzzle: mix(m, w, 0.3),
    legF: m, legH: m, hindLower: m, pawF: mix(m, w, 0.3), pawH: mix(m, w, 0.3), tailTip: mix(m, w, 0.12),
  }
  switch (p.pattern) {
    case 'tan': return { ...base, chest: w, tanChest: a, hindWhite: w, ruffFront: w, ruffSide: mix(a, w, 0.5), cheek: mix(a, w, 0.5), cheek2: mix(a, w, 0.75), brow: a, muzzle: w, legF: a, hindLower: a, pawF: mix(a, w, 0.4), pawH: w, tailTip: mix(m, '#ffffff', 0.1) }
    case 'tuxedo': return { ...base, chest: w, tanChest: w, hindWhite: w, ruffFront: w, ruffSide: w, cheek2: mix(m, w, 0.5), muzzle: w, pawF: w, pawH: w, tailTip: w }
    case 'urajiro': return { ...base, chest: w, tanChest: w, hindWhite: w, ruffFront: w, ruffSide: w, cheek: w, cheek2: w, brow: w, muzzle: w, pawF: w, pawH: w, tailTip: w, legF: mix(m, w, 0.15) }
    case 'patch': return { ...base, chest: m, ruffFront: m, muzzle: mix(m, w, 0.4) }
    case 'spots': return { ...base, chest: m, ruffFront: m, muzzle: m }
    default: return base
  }
}

// spots / patches painted on the body (positions relative to the body capsule: z runs nose-to-tail)
const SPOTS: [number, number, number, number][] = [
  [0.0, 0.55, 0.06, 0.04], [0.07, 0.535, -0.1, 0.034], [-0.07, 0.53, 0.14, 0.032], [0.135, 0.44, 0.02, 0.036], [-0.135, 0.42, -0.08, 0.04],
  [0.13, 0.4, 0.18, 0.03], [-0.13, 0.46, 0.2, 0.028], [0.1, 0.5, -0.2, 0.03], [-0.04, 0.545, -0.22, 0.026],
]
const PATCHES: [number, number, number, number][] = [[0.04, 0.5, -0.02, 0.09], [-0.05, 0.47, -0.17, 0.075], [0.12, 0.42, 0.14, 0.05]]

const MARK_BASE: Record<PartId, number> = { body: 0.045, head: 0.04, earL: 0.03, earR: 0.03, tail: 0.03, leg0: 0.022, leg1: 0.022, leg2: 0.022, leg3: 0.022 }
const _z = new THREE.Vector3(0, 0, 1)
/** hand-placed spots lying flat on one body part */
function Marks({ marks, part }: { marks: Mark[]; part: PartId }) {
  const list = marks.filter((m) => m.part === part)
  if (!list.length) return null
  return (
    <>
      {list.map((m, i) => {
        const q = new THREE.Quaternion().setFromUnitVectors(_z, new THREE.Vector3(...m.n).normalize())
        const r = MARK_BASE[part] * m.s
        const pos = new THREE.Vector3(...m.p).addScaledVector(new THREE.Vector3(...m.n).normalize(), -r * 0.12)
        return (
          <group key={i} position={pos} quaternion={q}>
            <mesh scale={[1, 1, 0.3]}><sphereGeometry args={[r, 14, 10]} /><meshStandardMaterial color={m.c} roughness={0.95} /></mesh>
          </group>
        )
      })}
    </>
  )
}

/** The dog's meshes. All proportions come from the profile; animation is driven from outside through the refs. */
export function DogBody({ pet, outfit, refs }: { pet: PetProfile; outfit: string | null; refs: DogRefs }) {
  const c = useMemo(() => coatParts(pet), [pet])
  const fluff = pet.coatStyle === 'smooth' ? 0.7 : pet.coatStyle === 'fluffy' ? 1.3 : 1.05
  const L = pet.legs, dy = (L - 1) * 0.275
  const sz = pet.snout
  const fur = (col: string, r = 1) => <meshStandardMaterial color={col} roughness={r} />
  const bCol = outfit === 'bandana-red' ? '#ff5f5f' : '#6fc0ff'
  const legW = pet.chunk > 1 ? 1.08 : 1
  const earInner = '#d9a5a8'
  const curly = pet.coatStyle === 'curly'

  return (
    <group ref={refs.rig} position={[0, 0.3, -0.2]}>
      <group position={[0, -0.3 + dy, 0.2]} userData={{ part: 'body' }}>
        <Marks marks={pet.marks} part="body" />
        {/* body */}
        <mesh position={[0, 0.42, 0]} rotation-x={Math.PI / 2} scale={[1.08 * pet.chunk, 1, 1.02 * pet.chunk]} castShadow><capsuleGeometry args={[0.125, 0.3, 8, 18]} />{fur(c.body)}</mesh>
        <mesh position={[0, 0.41, 0.21]} scale={[0.72 * pet.chunk, 1.0, 0.8]}><sphereGeometry args={[0.15, 18, 14]} />{fur(c.chest)}</mesh>
        {[-1, 1].map((x) => (<mesh key={'t' + x} position={[x * 0.1 * pet.chunk, 0.39, 0.17]}><sphereGeometry args={[0.07, 12, 10]} />{fur(c.tanChest)}</mesh>))}
        {[-1, 1].map((x) => (<mesh key={'h' + x} position={[x * 0.09 * pet.chunk, 0.38, -0.19]}><sphereGeometry args={[0.118, 16, 12]} />{fur(c.hindThigh)}</mesh>))}
        {[-1, 1].map((x) => (<mesh key={'c' + x} position={[x * 0.125 * pet.chunk, 0.34, -0.17]}><sphereGeometry args={[0.05, 10, 8]} />{fur(c.hindWhite)}</mesh>))}
        {/* neck ruff */}
        <mesh position={[0, 0.57, 0.27]} rotation-x={0.6}><capsuleGeometry args={[0.08 * (0.85 + fluff * 0.15), 0.08, 6, 12]} />{fur(c.ruff)}</mesh>
        <mesh position={[0, 0.54, 0.3]} scale={[0.85 * fluff, 1 * (0.85 + fluff * 0.15), 0.8 * fluff]}><sphereGeometry args={[0.095, 14, 12]} />{fur(c.ruffFront)}</mesh>
        {[-1, 1].map((x) => (<mesh key={'n' + x} position={[x * 0.085, 0.585, 0.25]} scale={[0.7 * fluff, 1, 0.8 * fluff]}><sphereGeometry args={[0.055, 12, 10]} />{fur(c.ruffSide)}</mesh>))}

        {pet.pattern === 'spots' && SPOTS.map(([x, y, z, r], i) => (<mesh key={'sp' + i} position={[x * pet.chunk, y, z]}><sphereGeometry args={[r, 10, 8]} />{fur(pet.accent)}</mesh>))}
        {pet.pattern === 'patch' && PATCHES.map(([x, y, z, r], i) => (<mesh key={'pa' + i} position={[x * pet.chunk, y, z]} scale={[1, 0.7, 1]}><sphereGeometry args={[r, 12, 10]} />{fur(pet.accent)}</mesh>))}

        <group ref={refs.head} position={[0, 0.72, 0.34]} scale={1.18 * pet.headSize} userData={{ part: 'head' }}>
          <Marks marks={pet.marks} part="head" />
          {pet.blaze && (<>
            <mesh position={[0, 0.07, 0.158]} scale={[0.5, 2.4, 0.3]}><sphereGeometry args={[0.05, 12, 10]} />{fur(pet.white, 0.9)}</mesh>
            <mesh position={[0, -0.035, 0.172]} scale={[0.6, 1.5, 0.3]}><sphereGeometry args={[0.05, 12, 10]} />{fur(pet.white, 0.9)}</mesh>
          </>)}
          {pet.browDots && [-1, 1].map((x) => (<mesh key={'bd' + x} position={[x * 0.075 * pet.eyeGap, 0.1, 0.138]} scale={[1, 1, 0.5]}><sphereGeometry args={[0.02, 10, 8]} />{fur(pet.accent === pet.coat ? '#f2e2c4' : pet.accent, 0.9)}</mesh>))}
          <mesh castShadow><sphereGeometry args={[0.178, 26, 22]} />{fur(c.head, 0.9)}</mesh>
          {[-1, 1].map((x) => (<mesh key={'ck' + x} position={[x * 0.1, -0.065, 0.065]} scale={[0.85 * fluff, 1.0, 0.95]}><sphereGeometry args={[0.085, 18, 14]} />{fur(c.cheek, 1)}</mesh>))}
          {[-1, 1].map((x) => (<mesh key={'ck2' + x} position={[x * 0.125, -0.02, 0.03]} scale={[0.6, 1.0, 0.9]}><sphereGeometry args={[0.07, 14, 12]} />{fur(c.cheek2, 1)}</mesh>))}
          {[-1, 1].map((x) => (<mesh key={'br' + x} position={[x * 0.08, 0.1, 0.14]} rotation-z={x * -0.35} scale={[1.3, 0.7, 0.5]}><sphereGeometry args={[0.03, 10, 8]} />{fur(c.brow, 0.9)}</mesh>))}
          {pet.pattern === 'patch' && (<mesh position={[-0.075, 0.06, 0.04]} scale={[1, 1, 1]}><sphereGeometry args={[0.1, 14, 12]} />{fur(pet.accent, 0.9)}</mesh>)}
          {pet.pattern === 'spots' && [[0.1, 0.1, 0.06, 0.034], [-0.06, 0.15, 0.0, 0.03], [0.02, 0.17, -0.04, 0.026]].map(([x, y, z, r], i) => (<mesh key={'hs' + i} position={[x, y, z]}><sphereGeometry args={[r, 8, 6]} />{fur(pet.accent, 0.9)}</mesh>))}
          {curly && (
            <group>
              <mesh position={[0, 0.17, 0.0]} scale={[1.1, 0.9, 1.1]}><sphereGeometry args={[0.1, 14, 12]} />{fur(c.head, 1)}</mesh>
              <mesh position={[0, 0.2, 0.05]} scale={[1.1, 0.9, 1]}><sphereGeometry args={[0.07, 12, 10]} />{fur(c.head, 1)}</mesh>
              {[-1, 1].map((x) => (<mesh key={'cb' + x} position={[x * 0.12, -0.05, 0.06]}><sphereGeometry args={[0.07, 12, 10]} />{fur(c.cheek, 1)}</mesh>))}
            </group>
          )}
          {/* muzzle + nose */}
          <mesh position={[0, -0.06, 0.135 + (sz - 1) * 0.05]} scale={[1.05, 0.8, 1.1 * sz]}><sphereGeometry args={[0.068, 16, 12]} />{fur(c.muzzle, 0.9)}</mesh>
          <mesh position={[0, -0.036, 0.2 + (sz - 1) * 0.09]} scale={[1.15 * pet.noseSize, 0.85 * pet.noseSize, pet.noseSize]}><sphereGeometry args={[0.03, 12, 10]} /><meshStandardMaterial color={pet.nose} roughness={0.25} /></mesh>
          <mesh ref={refs.tongue} position={[0, -0.103, 0.18 + (sz - 1) * 0.08]} scale={[1.2, 0.6, 0.9]} visible={false}><sphereGeometry args={[0.026, 10, 8]} /><meshBasicMaterial color="#ff8aa0" /></mesh>
          {/* eyes */}
          {[-1, 1].map((x) => (
            <group key={'e' + x} position={[x * 0.082 * pet.eyeGap, 0.02, 0.15]} rotation-y={x * 0.18} scale={pet.eyeSize}>
              <mesh scale={[1, 1.05, 0.55]}><sphereGeometry args={[0.04, 20, 16]} /><meshStandardMaterial color="#fffaf2" roughness={0.3} /></mesh>
              <mesh position={[0, 0, 0.012]} scale={[1, 1.05, 0.5]}><sphereGeometry args={[0.036, 20, 16]} /><meshStandardMaterial color={pet.eye} roughness={0.1} /></mesh>
              <mesh position={[0, 0, 0.019]} scale={[1, 1.05, 0.5]}><sphereGeometry args={[0.026, 18, 14]} /><meshStandardMaterial color="#070405" roughness={0.05} /></mesh>
              <mesh position={[0.012, 0.014, 0.03]}><sphereGeometry args={[0.012, 10, 8]} /><meshBasicMaterial color="#ffffff" /></mesh>
              <mesh position={[-0.01, -0.012, 0.028]}><sphereGeometry args={[0.006, 8, 6]} /><meshBasicMaterial color="#ffffff" /></mesh>
            </group>
          ))}
          {[-1, 1].map((x) => (<mesh key={'bl' + x} position={[x * 0.125, -0.045, 0.1]} rotation-y={x * 0.9} scale={[1, 0.6, 0.3]}><sphereGeometry args={[0.032, 12, 8]} /><meshBasicMaterial color="#ff9fb0" transparent opacity={0.55} /></mesh>))}
          {/* ears */}
          {[-1, 1].map((x) => (
            <group key={'ear' + x} ref={x < 0 ? refs.earL : refs.earR} position={[x * (pet.ears === 'drop' ? 0.15 : 0.125), pet.ears === 'drop' ? 0.07 : 0.12, -0.02]} scale={(pet.ears === 'drop' ? 1 : 0.78) * pet.earSize} rotation-x={-0.1} userData={{ part: x < 0 ? 'earL' : 'earR' }}>
              <Marks marks={pet.marks} part={x < 0 ? 'earL' : 'earR'} />
              {pet.ears === 'round' && (<>
                <mesh position={[0, 0.11, 0]} scale={[1.05, 1.15, 0.38]}><sphereGeometry args={[0.108, 22, 16]} />{fur(pet.pattern === 'patch' && x < 0 ? pet.accent : c.earOut, 0.95)}</mesh>
                <mesh position={[0, 0.1, 0.026]} scale={[0.7, 0.92, 0.28]}><sphereGeometry args={[0.096, 18, 12]} />{fur(earInner, 0.9)}</mesh>
              </>)}
              {pet.ears === 'perky' && (<>
                <mesh position={[0, 0.12, 0]} scale={[1, 1, 0.42]}><coneGeometry args={[0.085, 0.24, 14]} />{fur(c.earOut, 0.95)}</mesh>
                <mesh position={[0, 0.1, 0.024]} scale={[0.62, 0.8, 0.3]}><coneGeometry args={[0.085, 0.22, 12]} />{fur(earInner, 0.9)}</mesh>
              </>)}
              {pet.ears === 'big' && (<>
                <mesh position={[0, 0.16, 0]} scale={[1, 1, 0.4]}><coneGeometry args={[0.1, 0.34, 14]} />{fur(c.earOut, 0.95)}</mesh>
                <mesh position={[0, 0.14, 0.026]} scale={[0.64, 0.8, 0.3]}><coneGeometry args={[0.1, 0.3, 12]} />{fur(earInner, 0.9)}</mesh>
              </>)}
              {pet.ears === 'drop' && (<>
                <mesh position={[0, -0.09, 0]} scale={[0.85 * (curly ? 1.15 : 1), 1.7, 0.38]}><sphereGeometry args={[0.085, 18, 14]} />{fur(pet.pattern === 'patch' ? pet.accent : c.earOut, 1)}</mesh>
              </>)}
              {pet.ears === 'fold' && (<>
                <mesh position={[0, 0.07, 0]} scale={[1.05, 1, 0.42]}><sphereGeometry args={[0.095, 18, 14]} />{fur(c.earOut, 0.95)}</mesh>
              </>)}
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

        {/* legs [FL, FR, HL, HR] */}
        {([[-0.075, 0.17, 0], [0.075, 0.17, 1], [-0.085, -0.19, 2], [0.085, -0.19, 3]] as const).map(([x, z, i]) => (
          <group key={i} ref={refs.legs[i]} position={[x * pet.chunk, 0.32, z]} userData={{ part: ('leg' + i) as PartId }}>
            <Marks marks={pet.marks} part={('leg' + i) as PartId} />
            <group scale={[legW, L, legW]}>
              <mesh position={[0, -0.14, 0]} castShadow><capsuleGeometry args={[0.032, 0.2, 6, 10]} />{fur(i < 2 ? c.legF : c.legH, 0.95)}</mesh>
              {i >= 2 && <mesh position={[0, -0.22, 0]}><capsuleGeometry args={[0.03, 0.06, 6, 8]} />{fur(c.hindLower, 0.95)}</mesh>}
              {pet.socks && <mesh position={[0, -0.225, 0]}><capsuleGeometry args={[0.0345, 0.075, 6, 10]} />{fur(pet.white, 0.95)}</mesh>}
              {curly && <mesh position={[0, -0.2, 0]} scale={[1, 0.8, 1]}><sphereGeometry args={[0.052, 10, 8]} />{fur(c.legF, 1)}</mesh>}
              <mesh position={[0, -0.275, 0.02]} scale={[1, 0.75 / L, 1.3]}><sphereGeometry args={[0.041, 10, 8]} />{fur(i < 2 ? c.pawF : c.pawH, 0.95)}</mesh>
            </group>
          </group>
        ))}
        {outfit?.startsWith('sweater') && (
          <mesh position={[0, 0.425, 0.0]} rotation-x={Math.PI / 2} scale={[pet.chunk, 1, pet.chunk]}><capsuleGeometry args={[0.142, 0.26, 8, 18]} /><meshStandardMaterial color={outfit === 'sweater-pink' ? '#ffb3c7' : '#a6e3cf'} roughness={1} /></mesh>
        )}
        {outfit?.startsWith('bandana') && (
          <group>
            <mesh position={[0, 0.6, 0.285]} rotation-x={-0.97}><torusGeometry args={[0.1, 0.03, 8, 18]} /><meshStandardMaterial color={bCol} roughness={0.9} /></mesh>
            <mesh position={[0, 0.5, 0.34]} rotation-x={Math.PI - 0.3} scale={[1, 1, 0.35]}><coneGeometry args={[0.07, 0.12, 3]} /><meshStandardMaterial color={bCol} roughness={0.9} /></mesh>
          </group>
        )}
        {/* tail */}
        {pet.tail === 'plume' && (
          <group ref={refs.tail} position={[0, 0.5, -0.3]} rotation-x={-1.05} userData={{ part: 'tail' }}>
            <Marks marks={pet.marks} part="tail" />
            <mesh position={[0, 0.1, 0]}><capsuleGeometry args={[0.03, 0.14, 6, 8]} />{fur(c.tail)}</mesh>
            <mesh position={[0, 0.24, 0.015]} scale={[fluff, 2.1, 0.95 * fluff]}><sphereGeometry args={[0.062, 14, 12]} />{fur(c.tail)}</mesh>
            <mesh position={[0, 0.34, 0.03]} scale={[0.8, 1.1, 0.8]}><sphereGeometry args={[0.05, 12, 10]} />{fur(c.tailTip)}</mesh>
          </group>
        )}
        {pet.tail === 'curl' && (
          <group ref={refs.tail} position={[0, 0.52, -0.29]} rotation-x={-0.55} userData={{ part: 'tail' }}>
            <Marks marks={pet.marks} part="tail" />
            <mesh position={[0, 0.07, 0]}><capsuleGeometry args={[0.032, 0.08, 6, 8]} />{fur(c.tail)}</mesh>
            <mesh position={[0, 0.13, 0.05]} rotation-y={Math.PI / 2} rotation-x={0.35}><torusGeometry args={[0.065 * fluff, 0.04 * fluff, 10, 18, Math.PI * 1.55]} />{fur(c.tail)}</mesh>
            <mesh position={[0, 0.1, 0.1]}><sphereGeometry args={[0.04 * fluff, 10, 8]} />{fur(c.tailTip)}</mesh>
          </group>
        )}
        {pet.tail === 'straight' && (
          <group ref={refs.tail} position={[0, 0.5, -0.3]} rotation-x={-2.3} userData={{ part: 'tail' }}>
            <Marks marks={pet.marks} part="tail" />
            <mesh position={[0, 0.16, 0]}><capsuleGeometry args={[0.032, 0.26, 6, 8]} />{fur(c.tail)}</mesh>
            <mesh position={[0, 0.25, 0]} scale={[fluff, 1.8, 0.8 * fluff]}><sphereGeometry args={[0.05, 12, 10]} />{fur(c.tailTip)}</mesh>
          </group>
        )}
        {pet.tail === 'stub' && (
          <group ref={refs.tail} position={[0, 0.47, -0.31]} rotation-x={-1.3} userData={{ part: 'tail' }}>
            <Marks marks={pet.marks} part="tail" />
            <mesh position={[0, 0.04, 0]}><sphereGeometry args={[0.05 * (0.85 + fluff * 0.15), 12, 10]} />{fur(c.tailTip)}</mesh>
          </group>
        )}
      </group>
    </group>
  )
}
