// Mutable per-frame game state shared between 3D components (kept out of React state on purpose).
import * as THREE from 'three'
import type { V2 } from './terrain'

export type Anim = 'idle' | 'walk' | 'run' | 'sit' | 'offer'
export const game = {
  pos: { x: 0, y: 1.7, z: 106 },
  heading: Math.PI, // facing -z (towards the island)
  camYaw: 0, // camera looks along -z when 0 (behind player at +z)
  camPitch: 0.36,
  camDist: 7.5,
  anim: 'idle' as Anim,
  speed: 0,
  // input
  keys: new Set<string>(),
  joy: { x: 0, y: 0 },
  runToggle: false,
  wantSit: false,
  stargaze: false, // lying on the stargazing hill: the camera looks up at the sky
  offerUntil: 0,
  treatUntil: 0,
  dog: { x: 0, y: 0, z: 0 },
  // fetch: a thrown ball, chased and brought back by the dog
  // summoning the dog out of a shrine photo: a bump of this counter restarts the emerge animation at (x, z); glow = light column
  summon: { n: 0, x: 0, z: 0 },
  glow: { t: -1, x: 0, y: 0, z: 0 },
  ball: { s: 'none' as 'none' | 'fly' | 'rest' | 'carry', x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 },
  camFocus: null as null | { x: number; y: number; z: number }, // debug/photo mode: look at something else
  // auto-walk
  route: [] as V2[],
  onArrive: null as null | (() => void),
  // intro cinematic
  introT: 0,
  time: 0,
}
export function cancelAutoWalk() { game.route = []; game.onArrive = null }
export function startAutoWalk(route: V2[], onArrive?: () => void) {
  game.route = route.slice()
  game.onArrive = onArrive ?? null
  game.wantSit = false
}

/** Set by <World/> when the post-processing composer is active: shaders must then output linear colour. */
export const fx = { composer: false }
export function lin(frag: string) {
  if (!fx.composer) return frag
  const i = frag.lastIndexOf('}')
  return frag.slice(0, i) + 'gl_FragColor.rgb = pow(max(gl_FragColor.rgb, vec3(0.0)), vec3(2.2));' + frag.slice(i)
}

/** Time of day, smoothed by <TimeOfDay/>: night / dusk are 0..1 blend factors (used by lamps, the lighthouse and the sea shaders). */
export const tod = { night: 0, dusk: 0, tint: { value: new THREE.Color(1, 1, 1) } }
