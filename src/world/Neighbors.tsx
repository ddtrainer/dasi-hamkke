import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { game } from './game'
import { AvatarBody, LOOKS, type AvatarRefs } from './Characters'
import { DogBody, EAR_BASE, type DogRefs } from './DogModel'
import { NBR, stepNeighbors, type Nbr } from './visitors'

function NeighborView({ n }: { n: Nbr }) {
  const g = (): React.RefObject<THREE.Group> => useRef<THREE.Group>(null!) // eslint-disable-line react-hooks/rules-of-hooks
  const a: AvatarRefs = { root: g(), body: g(), armL: g(), armR: g(), legL: g(), legR: g(), head: g(), hat: g(), pack: g(), bouquet: g(), eyeL: g(), eyeR: g() }
  const dog: DogRefs = { rig: g(), legs: [g(), g(), g(), g()], tail: g(), head: g(), earL: g(), earR: g(), tongue: useRef<THREE.Mesh>(null!) }
  const dogRoot = g()
  const ph = useRef({ p: 0, dp: 0 })
  useFrame((_, dt) => {
    const t = game.time, k = Math.min(1, dt * 12)
    const lerp = THREE.MathUtils.lerp
    const waving = t < n.waveUntil
    // person
    ph.current.p += n.moving ? dt * 8 : 0
    const sw = n.moving ? Math.sin(ph.current.p) * 0.6 : 0
    a.root.current.position.set(n.x, n.y, n.z)
    a.root.current.rotation.y = n.hd
    a.legL.current.rotation.x = lerp(a.legL.current.rotation.x, sw, k); a.legR.current.rotation.x = lerp(a.legR.current.rotation.x, -sw, k)
    a.armL.current.rotation.x = lerp(a.armL.current.rotation.x, -sw, k)
    a.armL.current.rotation.z = lerp(a.armL.current.rotation.z, 0.1, k)
    if (waving && !n.moving) {
      a.armR.current.rotation.x = lerp(a.armR.current.rotation.x, 0, k)
      a.armR.current.rotation.z = -2.45 + Math.sin(t * 14) * 0.3
    } else {
      a.armR.current.rotation.x = lerp(a.armR.current.rotation.x, sw, k)
      a.armR.current.rotation.z = lerp(a.armR.current.rotation.z, -0.1, k)
    }
    a.body.current.position.y = n.moving ? Math.abs(Math.sin(ph.current.p)) * 0.05 : Math.sin(t * 1.8) * 0.012
    a.head.current.rotation.y = n.moving ? 0 : Math.sin(t * 0.6 + n.x) * 0.12
    a.eyeL.current.scale.y = a.eyeR.current.scale.y = (t % 3.8) < 0.12 ? 0.1 : 1
    a.bouquet.current.visible = false
    // dog
    ph.current.dp += n.dMoving ? dt * 15 : 0
    const dsw = n.dMoving ? Math.sin(ph.current.dp) * 0.7 : 0
    dogRoot.current.position.set(n.dx, groundHeight(n.dx, n.dz) + (n.dMoving ? Math.abs(Math.sin(ph.current.dp)) * 0.03 : 0), n.dz)
    dogRoot.current.rotation.y = n.dh
    dog.legs[0].current.rotation.x = dsw; dog.legs[3].current.rotation.x = dsw
    dog.legs[1].current.rotation.x = -dsw; dog.legs[2].current.rotation.x = -dsw
    dog.rig.current.position.y = 0.3
    dog.tail.current.rotation.z = Math.sin(t * (waving ? 22 : n.dMoving ? 15 : 9)) * 0.55
    dog.head.current.rotation.x = Math.sin(t * 2) * 0.03
    const base = EAR_BASE[n.pet.ears], flop = n.dMoving ? Math.sin(ph.current.dp) * 0.25 : Math.sin(t * 1.5) * 0.03
    dog.earL.current.rotation.z = base + flop * 0.4; dog.earR.current.rotation.z = -base - flop * 0.4
    dog.tongue.current.visible = n.dMoving
  })
  return (
    <>
      <AvatarBody look={LOOKS[n.look]} goods={[]} refs={a} />
      <group ref={dogRoot} scale={0.58 * n.pet.size}><DogBody pet={n.pet} outfit={null} refs={dog} /></group>
    </>
  )
}
import { groundHeight } from './terrain'

/** The strolling demo neighbours. */
export function Neighbors() {
  useFrame((_, dt) => stepNeighbors(Math.min(dt, 0.1)))
  return <>{NBR.map((n) => <NeighborView key={n.id} n={n} />)}</>
}
