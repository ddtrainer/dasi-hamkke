// "Neighbours": demo visitors (a woman and a man, each with a dog) who stroll the island, so the greeting can be tried
// before real visitors can see each other. Later, real visitors take over these slots; the greeting code stays the same.
import { game } from './game'
import { DESTINATIONS, planRoute, groundHeight, type V2 } from './terrain'
import { breedProfile, type PetProfile } from '../lib/pet'
import type { AvatarId } from '../lib/store'
import { useStore } from '../lib/store'
import { receiveGreet } from '../lib/greet'

export interface Nbr {
  id: string; name: string; look: AvatarId; pet: PetProfile
  x: number; y: number; z: number; hd: number
  moving: boolean
  route: V2[]; idleUntil: number
  waveUntil: number; waveAt: number; greetAt: number; lastReplyAt: number
  // the dog trailing its owner
  dx: number; dz: number; dh: number; dMoving: boolean
}

const SPOTS: V2[] = [DESTINATIONS.center.p, DESTINATIONS.pond.p, DESTINATIONS.bigtree.p, DESTINATIONS.market.p, DESTINATIONS.dogpark.p, DESTINATIONS.wish.p, DESTINATIONS.cafe.p, DESTINATIONS.gazebo.p]

function make(id: string, name: string, look: AvatarId, pet: PetProfile, at: V2): Nbr {
  return { id, name, look, pet, x: at[0], y: groundHeight(at[0], at[1]), z: at[1], hd: 0, moving: false, route: [], idleUntil: 0,
    waveUntil: 0, waveAt: 0, greetAt: 12, lastReplyAt: -999, dx: at[0] + 0.8, dz: at[1] + 0.8, dh: 0, dMoving: false }
}
export const NBR: Nbr[] = [
  make('n-minji', '민지', 'girl', breedProfile('maltese', '하늘'), DESTINATIONS.center.p),
  make('n-junho', '준호', 'boy', breedProfile('shiba', '두부'), DESTINATIONS.pond.p),
]

const turn = (a: number, b: number, k: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * Math.min(1, k)
let nearId: string | null = null

/** One simulation step for every neighbour (called once per frame by the scene). */
export function stepNeighbors(dt: number) {
  const t = game.time, p = game.pos
  let best: Nbr | null = null, bd = 4.6
  for (const n of NBR) {
    const dp = Math.hypot(p.x - n.x, p.z - n.z)
    if (dp < bd) { bd = dp; best = n }
    // answering a greeting a moment after the visitor's wave
    if (n.waveAt > 0 && t >= n.waveAt) { n.waveAt = 0; n.waveUntil = t + 1.9; useStore.getState().say(`👋 ${n.name}님도 손을 흔들었어요`) }
    // greeting the visitor first when they walk close
    if (dp < 5.5 && t > n.greetAt && n.waveUntil < t) {
      n.waveUntil = t + 1.9; n.greetAt = t + 90
      receiveGreet(n.id, n.name)
    }
    const waving = t < n.waveUntil
    const pause = dp < 4 || waving
    let moving = false
    if (pause) {
      n.hd = turn(n.hd, Math.atan2(p.x - n.x, p.z - n.z), dt * 5)
    } else if (!n.route.length) {
      if (t > n.idleUntil) {
        const far = SPOTS.filter((s) => Math.hypot(s[0] - n.x, s[1] - n.z) > 12)
        const to = far[Math.floor(Math.random() * far.length)]
        n.route = planRoute([n.x, n.z], to)
        if (!n.route.length) n.idleUntil = t + 3
      }
    } else {
      const [tx, tz] = n.route[0]
      const dx = tx - n.x, dz = tz - n.z, d = Math.hypot(dx, dz)
      if (d < 0.35) {
        n.route.shift()
        if (!n.route.length) n.idleUntil = t + 4 + Math.random() * 6
      } else {
        const sp = 1.5 * dt
        n.x += (dx / d) * sp; n.z += (dz / d) * sp
        n.hd = turn(n.hd, Math.atan2(dx, dz), dt * 6)
        moving = true
      }
    }
    n.moving = moving
    n.y += (groundHeight(n.x, n.z) - n.y) * Math.min(1, dt * 12)
    // dog: walks side by side with its owner (same offsets as the player's own dog)
    const tx = n.x - Math.sin(n.hd) * 0.1 + Math.cos(n.hd) * 0.55, tz = n.z - Math.cos(n.hd) * 0.1 - Math.sin(n.hd) * 0.55
    const ddx = tx - n.dx, ddz = tz - n.dz, dd = Math.hypot(ddx, ddz)
    n.dMoving = dd > 0.25
    if (n.dMoving) {
      const sp = Math.min(5, 1 + dd * 5) * dt
      n.dx += (ddx / dd) * sp; n.dz += (ddz / dd) * sp
      n.dh = turn(n.dh, Math.atan2(ddx, ddz), dt * 9)
    } else n.dh = turn(n.dh, n.hd, dt * 2)
  }
  const id = best ? best.id : null
  if (id !== nearId) {
    nearId = id
    useStore.getState().set({ nearNeighbor: best ? { id: best.id, name: best.name } : null })
  }
}

/** The visitor greets a neighbour: a wave, a wagging dog, and (once a minute) the neighbour waves back. */
export function greetNeighbor(id: string, isReply = false) {
  const n = NBR.find((x) => x.id === id)
  if (!n) return
  const t = game.time, p = game.pos
  game.waveUntil = t + 1.9
  game.treatUntil = Math.max(game.treatUntil, t + 2.2)
  game.heading = Math.atan2(n.x - p.x, n.z - p.z)
  if (isReply) return
  if (t - n.lastReplyAt > 60) { n.lastReplyAt = t; n.waveAt = t + 0.9 }
  else useStore.getState().say(`👋 ${n.name}님에게 방금 인사했어요`)
}

export function greetNearest() {
  const n = useStore.getState().nearNeighbor
  if (n) greetNeighbor(n.id)
}
