import { game, startAutoWalk, cancelAutoWalk } from './game'
import { SLOTS, planRoute, routeThrough, DESTINATIONS, V2, NODES, LOOP_IDS, PLACES, canStand, groundHeight } from './terrain'
import { useStore, saveMarket } from '../lib/store'
import { chime } from '../lib/audio'
import type { Memorial } from '../lib/types'

export function walkTo(p: V2, label?: string, then?: () => void) {
  const route = planRoute([game.pos.x, game.pos.z], p)
  startAutoWalk(route, then)
  if (label) useStore.getState().say(`${label}(으)로 이동합니다. 조작하면 멈춰요.`)
}
export function goToSlot(slot: number) {
  const st = useStore.getState()
  const s = SLOTS[slot]
  const m = st.memorials.find((x) => x.slot === slot)
  const open = () => {
    if (m) useStore.getState().set({ openId: m.id })
    else useStore.getState().set({ registerSlot: slot })
  }
  const near = Math.hypot(game.pos.x - s.front[0], game.pos.z - s.front[1]) < 1.2
  if (near) return open()
  walkTo(s.front, m ? `${m.petName}의 분향소` : '비어 있는 분향소 자리', () => {
    // face the shrine on arrival
    game.heading = s.ry + Math.PI
    open()
  })
}
export function goToDestination(k: keyof typeof DESTINATIONS) {
  walkTo(DESTINATIONS[k].p, DESTINATIONS[k].label, k === 'market' ? () => useStore.getState().set({ marketOpen: true }) : undefined)
}
/** Gentle 'stroll' tour around the main park paths. */
export function stroll() {
  const ids = ['G2', 'S0', 'R0', 'R2', 'R4', 'R6', 'R8', 'N1', 'H1', 'H2', 'HT', 'H2', 'N1', 'N3', 'W6', 'W5', 'W4', 'W3', 'W2', 'W1', 'R12', 'R10', 'R8', 'R6', 'NE1', 'NE2', 'BRC', 'BRE', 'GZ1', 'GZ2', 'GZ3', 'GZ', 'GZ1', 'BRE', 'SE8', 'SE6', 'SE4', 'SE2', 'G2', 'S0', 'R0']
  startAutoWalk(routeThrough(ids, [game.pos.x, game.pos.z]))
  useStore.getState().say('산책로를 따라 천천히 걸어요. 조작하면 멈춰요.')
}
/** Walk once all the way around the island on the coastal trail (the dog follows), starting from the nearest point of the trail. */
export function loopWalk() {
  let bi = 0, bd = Infinity
  LOOP_IDS.forEach((id, i) => { const d = Math.hypot(NODES[id][0] - game.pos.x, NODES[id][1] - game.pos.z); if (d < bd) { bd = d; bi = i } })
  const ids = [...LOOP_IDS.slice(bi), ...LOOP_IDS.slice(0, bi), LOOP_IDS[bi]]
  startAutoWalk(routeThrough(ids, [game.pos.x, game.pos.z]))
  useStore.getState().say('반려견과 함께 섬을 한 바퀴 걸어요. 조작하면 멈춰요.')
}
export function stopWalk() { cancelAutoWalk() }

/** Throw the ball ahead of the player (stays on walkable ground); the dog fetches it and brings it back. */
export function throwBall() {
  const b = game.ball
  if (b.s !== 'none') { useStore.getState().say('🐶 공을 쫓아가고 있어요!'); return }
  const hx = Math.sin(game.heading), hz = Math.cos(game.heading)
  let d = 1
  while (d < 8.5 && canStand(game.pos.x + hx * (d + 0.5), game.pos.z + hz * (d + 0.5))) d += 0.5
  b.x = game.pos.x + hx * 0.5; b.z = game.pos.z + hz * 0.5; b.y = groundHeight(b.x, b.z) + 1.3
  const T = 0.9 // flight time
  b.vx = (hx * d) / T; b.vz = (hz * d) / T; b.vy = 0.5 * 9.8 * T - (1.3 - 0.15) / T
  b.s = 'fly'
  game.offerUntil = game.time + 0.7
}
/** The single action offered by each little place (see PLACES). */
export function placeAction(id: string) {
  const st = useStore.getState()
  if (id === 'dogpark') return throwBall()
  if (id === 'wish') {
    if (st.ribbons >= 60) { st.say('🎀 숲이 소원 리본으로 가득해요. 모두의 마음이 모였어요.'); return }
    st.set({ ribbons: st.ribbons + 1 }); saveMarket(); chime()
    st.say('🎀 소원 리본을 달았어요. 소중한 이름을 마음속으로 불러 보세요.')
    return
  }
  if (id === 'cafe') {
    game.wantSit = true; chime()
    st.say('☕ 따뜻한 차 한 잔. 천천히 숨을 고르며 쉬어 가요.')
    return
  }
  if (id === 'stars') {
    if (game.stargaze) { game.wantSit = false; game.stargaze = false; return }
    game.wantSit = true; game.stargaze = true; game.camPitch = 0.12; game.camYaw = STAR_YAW; game.heading = STAR_YAW + Math.PI // face the open sea (north-east), away from the memorial hall
    if (st.tod !== 'night') st.set({ tod: 'night' })
    st.say('🌌 누워서 밤하늘을 올려다봐요. 드래그로 하늘을 둘러보고, 움직이면 돌아와요. 별똥별에 소원을 빌어 보세요 🌠')
  }
}
const STAR_YAW = -0.2 // camera sits just south of the player, looking north over the sea (the gazebo stays off to the right)
export const PLACE_BY_ID = Object.fromEntries(PLACES.map((p) => [p.id, p]))

/** Light the shrine photo and let its dog step out to walk with the visitor. */
export function summonCompanion(m: Memorial) {
  const st = useStore.getState()
  st.setCompanion(m.id)
  const s = SLOTS[m.slot]
  game.summon.x = s.x + Math.sin(s.ry) * 1.9; game.summon.z = s.z + Math.cos(s.ry) * 1.9; game.summon.n++
  game.glow.t = 0; game.glow.x = game.summon.x; game.glow.z = game.summon.z; game.glow.y = groundHeight(game.summon.x, game.summon.z)
  chime()
  st.say(`✨ 사진 속에서 ${m.petName}이(가) 걸어 나왔어요. 이제 함께 걸어요 💕`)
}
/** Send the dog back to rest beside its photo. */
export function restCompanion() {
  const st = useStore.getState()
  const m = st.memorials.find((x) => x.id === st.companionId)
  game.glow.t = 0; game.glow.x = game.dog.x; game.glow.y = game.dog.y; game.glow.z = game.dog.z
  if (m) st.markRested(m.id)
  st.setCompanion(null)
  st.say(m ? `🌙 ${m.petName}이(가) 분향소 사진 옆에서 쉬어요. 언제든 다시 불러 주세요.` : '쉬러 갔어요.')
}
