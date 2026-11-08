// Island lap run: the phone's motion sensor counts the runner's footfalls (the same "숨핏 펄스" detector as in 숨핏), and every
// step moves the character along the coastal loop with the dog. A full lap = LAP_STEPS pulses within LAP_SEC seconds.
import { game, cancelAutoWalk } from './game'
import { LOOP_IDS, NODES, routeThrough, type V2 } from './terrain'
import { useStore, saveMarket } from '../lib/store'
import { kstDay } from '../lib/api'
import { chime } from '../lib/audio'
import { GRAV, PULSE_CFG, makePulseDetector } from '../lib/pulse'

export const LAP_STEPS = 100 // pulses for one lap (raise it for a longer run)
export const LAP_SEC = 180 // time allowed
const MAX_SPEED = 6.4 // the runner on screen never faster than this (m/s)

export type LapStatus = 'idle' | 'asking' | 'denied' | 'none' | 'run' | 'win' | 'tapdone' | 'fail'
export interface LapUi { status: LapStatus; mode: 'sensor' | 'tap'; steps: number; sec: number }

export const lap = { on: false, route: [] as V2[], cum: [] as number[], total: 0, s: 0, steps: 0, done: false }

let det = makePulseDetector(PULSE_CFG.slow.amp, PULSE_CFG.slow.gap)
let seen = false, timer: number | undefined, lock: { release: () => Promise<void> } | null = null
let lastTap = 0

const setUi = (p: Partial<LapUi>) => useStore.setState((s) => ({ lapUi: { ...s.lapUi, ...p } }))

function build() {
  // start from the nearest point of the loop trail, like the relaxed "stroll" lap
  let bi = 0, bd = Infinity
  LOOP_IDS.forEach((id, i) => { const d = Math.hypot(NODES[id][0] - game.pos.x, NODES[id][1] - game.pos.z); if (d < bd) { bd = d; bi = i } })
  const ids = [...LOOP_IDS.slice(bi), ...LOOP_IDS.slice(0, bi), LOOP_IDS[bi]]
  const route: V2[] = [[game.pos.x, game.pos.z], ...routeThrough(ids, [game.pos.x, game.pos.z])]
  const cum = [0]
  for (let i = 1; i < route.length; i++) cum.push(cum[i - 1] + Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]))
  lap.route = route; lap.cum = cum; lap.total = cum[cum.length - 1]; lap.s = 0; lap.steps = 0; lap.done = false
}

function pointAt(s: number): { x: number; z: number; hx: number; hz: number } {
  const { route, cum } = lap
  let i = 1
  while (i < cum.length - 1 && cum[i] < s) i++
  const a = route[i - 1], b = route[i], seg = cum[i] - cum[i - 1] || 1
  const t = Math.min(1, Math.max(0, (s - cum[i - 1]) / seg))
  return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, hx: b[0] - a[0], hz: b[1] - a[1] }
}

function addSteps(n: number) {
  if (!lap.on || lap.done) return
  lap.steps += n
  setUi({ steps: lap.steps })
}

const onMotion = (e: DeviceMotionEvent) => {
  const g = e.accelerationIncludingGravity, a = e.acceleration
  let dyn: number | null = null
  if (g && g.x != null) dyn = Math.hypot(g.x || 0, g.y || 0, g.z || 0) - GRAV
  else if (a && a.x != null) dyn = Math.hypot(a.x, a.y || 0, a.z || 0)
  if (dyn == null) return
  seen = true
  const n = det.add(dyn, performance.now())
  if (n) addSteps(n)
}

function release() {
  window.removeEventListener('devicemotion', onMotion)
  clearInterval(timer); timer = undefined
  lock?.release().catch(() => {}); lock = null
}

/** Stop everything (also when leaving the island). */
export function stopLapRun() {
  release(); lap.on = false; lap.done = false
  if (useStore.getState().lapUi.status !== 'idle') setUi({ status: 'idle', steps: 0, sec: 0 })
}

/** Start a lap. `tap` = demo mode for computers without a motion sensor: no ticket. Must be called from a tap/click (iOS permission). */
export async function startLapRun(tap = false) {
  release(); cancelAutoWalk()
  game.wantSit = false; game.stargaze = false
  setUi({ status: 'asking', mode: tap ? 'tap' : 'sensor', steps: 0, sec: 0 })
  if (!tap) {
    try {
      const DME = window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> } | undefined
      if (!DME) { setUi({ status: 'none' }); return }
      if (typeof DME.requestPermission === 'function' && (await DME.requestPermission()) !== 'granted') { setUi({ status: 'denied' }); return }
    } catch { setUi({ status: 'denied' }); return }
  }
  build()
  lap.on = true
  det = makePulseDetector(PULSE_CFG.slow.amp, PULSE_CFG.slow.gap); seen = false
  setUi({ status: 'run', steps: 0, sec: 0 })
  if (!tap) {
    window.addEventListener('devicemotion', onMotion)
    try { lock = (await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen')) ?? null } catch { /* optional */ }
  }
  let sec = 0
  timer = window.setInterval(() => {
    sec++
    setUi({ sec })
    if (!tap && sec === 4 && !seen) { stopLapRun(); setUi({ status: 'none' }); return } // no sensor data: not a phone
    if (sec >= LAP_SEC && lap.steps < LAP_STEPS && !lap.done) { release(); lap.on = false; setUi({ status: 'fail' }) }
  }, 1000)
}

/** Demo mode: one tap = one footfall (at most ~4 per second). */
export function lapTapStep() {
  const now = performance.now()
  if (now - lastTap < 240) return
  lastTap = now
  addSteps(1)
}

function finish() {
  lap.done = true
  const tap = useStore.getState().lapUi.mode === 'tap'
  release()
  game.treatUntil = game.time + 4
  chime()
  if (tap) { setUi({ status: 'tapdone' }); return }
  setUi({ status: 'win' })
  const st = useStore.getState(), today = kstDay()
  if (st.missions.run === today) { st.say('오늘은 이미 보상을 받았어요. 내일 또 달려요! 🐕'); return }
  st.set({ tickets: st.tickets + 1, missions: { ...st.missions, run: today } }); saveMarket()
  st.say('🎟️ 한 바퀴 완주! 티켓을 1장 받았어요. 마켓에서 아이템으로 바꿔 보세요.')
}

/** Per frame while a lap is on: the character runs toward the point on the loop that the footfalls have earned. */
export function lapMove(dt: number): boolean {
  if (lap.done) return false
  const target = Math.min(lap.total, (lap.steps / LAP_STEPS) * lap.total)
  const gap = target - lap.s
  const sp = Math.min(MAX_SPEED, Math.max(0, gap * 2.5))
  const before = lap.s
  lap.s = Math.min(target, lap.s + sp * dt)
  const q = pointAt(lap.s)
  game.pos.x = q.x; game.pos.z = q.z
  if (Math.hypot(q.hx, q.hz) > 0.01 && lap.s > before) {
    const want = Math.atan2(q.hx, q.hz)
    game.heading += Math.atan2(Math.sin(want - game.heading), Math.cos(want - game.heading)) * Math.min(1, dt * 10)
  }
  if (lap.s >= lap.total - 0.01 && lap.steps >= LAP_STEPS) finish()
  return lap.s - before > sp * dt * 0.25 && sp > 0.2
}
