import type { PetProfile } from '../lib/pet'
import type { DogRefs } from './DogModel'

const EAR_INNER = '#e9a7a4'

/** The cat's meshes. Same ref names as the dog so the same animation code drives it. Proportions come from the profile. */
export function CatBody({ pet, refs }: { pet: PetProfile; refs: DogRefs }) {
  const fur = (col: string, r = 0.9) => <meshStandardMaterial color={col} roughness={r} />
  const coat = pet.coat, belly = pet.white, stripe = pet.accent
  const L = pet.legs
  const stripes = pet.pattern === 'tan' || pet.pattern === 'patch' || pet.pattern === 'spots'
  const longHair = pet.coatStyle === 'fluffy'
  const legY = (L - 1) * 0.22

  return (
    <group ref={refs.rig} position={[0, 0.3, -0.2]}>
      <group position={[0, -0.3 + legY, 0.2]} userData={{ part: 'body' }}>
        {/* slim body, a little lower than the dog's */}
        <mesh position={[0, 0.4, 0]} rotation-x={Math.PI / 2} scale={[1, 1, 1.2 * pet.chunk]} castShadow><capsuleGeometry args={[0.1, 0.32, 8, 18]} />{fur(coat)}</mesh>
        {/* white bib */}
        <mesh position={[0, 0.38, 0.17]} scale={[0.7, 1, 0.6]}><sphereGeometry args={[0.1, 16, 12]} />{fur(belly)}</mesh>
        {/* back stripes for tabby-like patterns */}
        {stripes && [-0.06, 0, 0.06].map((z, i) => (
          <mesh key={'st' + i} position={[0, 0.5, z - 0.02]} scale={[0.18, 0.16, 0.6]}><sphereGeometry args={[0.08, 10, 8]} />{fur(stripe)}</mesh>
        ))}
        {longHair && <mesh position={[0, 0.4, -0.12]} scale={[0.95, 0.95, 0.6]}><sphereGeometry args={[0.1, 14, 10]} />{fur(coat)}</mesh>}

        {/* neck: joins the front of the body to the head, leaning forward */}
        <mesh position={[0, 0.57, 0.24]} rotation-x={0.32} castShadow><capsuleGeometry args={[0.075, 0.05, 6, 14]} />{fur(coat)}</mesh>
        {/* head */}
        <group ref={refs.head} position={[0, 0.7, 0.3]} scale={1.05 * pet.headSize} userData={{ part: 'head' }}>
          <mesh castShadow><sphereGeometry args={[0.15, 24, 20]} />{fur(coat)}</mesh>
          {/* cheeks: a little white ruff */}
          {[-1, 1].map((x) => (<mesh key={'ck' + x} position={[x * 0.1, -0.05, 0.05]} scale={[0.7, 0.8, 0.8]}><sphereGeometry args={[0.07, 12, 10]} />{fur(belly)}</mesh>))}
          {/* ears: tall triangles */}
          {[-1, 1].map((x) => (
            <group key={'ear' + x} ref={x < 0 ? refs.earL : refs.earR} position={[x * 0.1, 0.13, -0.01]} scale={pet.earSize} rotation-x={-0.1} userData={{ part: x < 0 ? 'earL' : 'earR' }}>
              <mesh position={[0, 0.07, 0]} scale={[1, 1, 0.4]}><coneGeometry args={[0.07, 0.15, 3]} />{fur(coat)}</mesh>
              <mesh position={[0, 0.06, 0.02]} scale={[0.6, 0.7, 0.3]}><coneGeometry args={[0.07, 0.12, 3]} /><meshStandardMaterial color={EAR_INNER} roughness={0.9} /></mesh>
            </group>
          ))}
          {/* eyes: round with a dark vertical pupil */}
          {[-1, 1].map((x) => (
            <group key={'e' + x} position={[x * 0.065 * pet.eyeGap, 0.03, 0.13]} scale={pet.eyeSize}>
              <mesh scale={[1, 1, 0.5]}><sphereGeometry args={[0.035, 16, 12]} /><meshStandardMaterial color={pet.eye} roughness={0.1} /></mesh>
              <mesh position={[0, 0, 0.02]} scale={[0.35, 1, 0.4]}><sphereGeometry args={[0.03, 12, 10]} /><meshStandardMaterial color="#070405" roughness={0.05} /></mesh>
            </group>
          ))}
          {/* nose and muzzle */}
          <mesh position={[0, -0.04, 0.14]} scale={[1.2 * pet.noseSize, 0.8 * pet.noseSize, 0.9]}><sphereGeometry args={[0.018, 10, 8]} /><meshStandardMaterial color={pet.nose} roughness={0.3} /></mesh>
          {/* whiskers */}
          {[-1, 1].map((x) => [0.02, -0.02].map((dy, j) => (
            <mesh key={'w' + x + j} position={[x * 0.12, -0.035 + dy, 0.11]} rotation-z={x * (0.25 - j * 0.35)} rotation-y={x * 0.2}>
              <boxGeometry args={[0.13, 0.003, 0.003]} />
              <meshBasicMaterial color="#f7f3ec" />
            </mesh>
          )))}
          <mesh ref={refs.tongue} position={[0, -0.075, 0.14]} visible={false}><sphereGeometry args={[0.02, 8, 6]} /><meshBasicMaterial color="#ff8aa0" /></mesh>
        </group>

        {/* legs [FL, FR, HL, HR] — thinner than the dog's */}
        {([[-0.07, 0.17, 0], [0.07, 0.17, 1], [-0.075, -0.17, 2], [0.075, -0.17, 3]] as const).map(([x, z, i]) => (
          <group key={i} ref={refs.legs[i]} position={[x * pet.chunk, 0.32, z]} userData={{ part: ('leg' + i) as 'leg0' }}>
            <group scale={[1, L, 1]}>
              <mesh position={[0, -0.13, 0]} castShadow><capsuleGeometry args={[0.028, 0.2, 6, 10]} />{fur(coat, 0.95)}</mesh>
              <mesh position={[0, -0.27, 0.02]} scale={[1, 0.7, 1.2]}><sphereGeometry args={[0.035, 10, 8]} />{fur(i < 2 ? belly : coat, 0.95)}</mesh>
            </group>
          </group>
        ))}

        {/* tail: long and thin, curling up at the end */}
        <group ref={refs.tail} position={[0, 0.5, -0.28]} rotation-x={-0.9} userData={{ part: 'tail' }}>
          <mesh position={[0, 0.14, 0]}><capsuleGeometry args={[0.024, 0.3, 6, 8]} />{fur(coat)}</mesh>
          <mesh position={[0, 0.36, 0.06]} rotation-x={0.9}><capsuleGeometry args={[0.022, 0.16, 6, 8]} />{fur(coat)}</mesh>
          {pet.tailTip && <mesh position={[0, 0.27, 0]}><sphereGeometry args={[0.026, 10, 8]} />{fur(belly)}</mesh>}
        </group>
      </group>
    </group>
  )
}
