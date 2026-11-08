import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { game, cancelAutoWalk } from './game'
import { groundHeight, moveWithCollision, canStand, COLLIDERS, SLOTS, clamp, MARKET, PLACES } from './terrain'
import { placeAction } from './actions'
import { footstep } from '../lib/audio'
import { trees } from './layout'
import { useStore } from '../lib/store'

const cam = { init: false, tx: 0, ty: 0, tz: 0, dist: 7.5, dragAt: -99 }
const tmp = new THREE.Vector3()
const look = new THREE.Vector3()

export function useInputListeners() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input,textarea,select')) return
      const k = e.key.toLowerCase()
      game.keys.add(k)
      if (k === 'e' || k === 'enter') { e.preventDefault(); interactNearest() }
      if (k === 'c') toggleSit()
      if (k === 'h') greetNearest()
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault()
    }
    const up = (e: KeyboardEvent) => game.keys.delete(e.key.toLowerCase())
    const blur = () => game.keys.clear()
    let drag: { id: number; x: number; y: number } | null = null
    const pd = (e: PointerEvent) => {
      if (!(e.target instanceof HTMLCanvasElement)) return
      if (e.pointerType === 'touch' && e.clientX < innerWidth * 0.3) return
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY }
    }
    const pm = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y
      drag.x = e.clientX; drag.y = e.clientY
      cam.dragAt = game.time
      game.camYaw -= dx * 0.0055
      game.camPitch = clamp(game.camPitch + dy * 0.0045, -0.1, 1.2)
    }
    const pu = (e: PointerEvent) => { if (drag && e.pointerId === drag.id) drag = null }
    const wheel = (e: WheelEvent) => {
      if (!(e.target instanceof HTMLCanvasElement)) return
      game.camDist = clamp(game.camDist + e.deltaY * 0.006, 3.5, 14)
    }
    addEventListener('keydown', down); addEventListener('keyup', up); addEventListener('blur', blur)
    addEventListener('pointerdown', pd); addEventListener('pointermove', pm); addEventListener('pointerup', pu); addEventListener('pointercancel', pu)
    addEventListener('wheel', wheel, { passive: true })
    return () => {
      removeEventListener('keydown', down); removeEventListener('keyup', up); removeEventListener('blur', blur)
      removeEventListener('pointerdown', pd); removeEventListener('pointermove', pm); removeEventListener('pointerup', pu); removeEventListener('pointercancel', pu)
      removeEventListener('wheel', wheel)
    }
  }, [])
}

export function toggleSit() {
  if (game.route.length) return
  game.wantSit = !game.wantSit
}
import { greetNearest } from './visitors'
export function interactNearest() {
  const st = useStore.getState()
  // a stale openId (memorial no longer visible) must never swallow the button — clear it
  if (st.openId && !st.memorials.some((x) => x.id === st.openId)) st.set({ openId: null })
  else if (st.openId) return
  if (st.registerSlot !== undefined) return
  if (st.nearSlot === null) {
    if (st.nearMarket && !st.marketOpen) st.set({ marketOpen: true })
    else if (!st.nearMarket && st.nearPlace) placeAction(st.nearPlace)
    return
  }
  const m = st.memorials.find((x) => x.slot === st.nearSlot)
  if (m) st.set({ openId: m.id }); else st.set({ registerSlot: st.nearSlot })
}
export function offerFlowersAnim() { game.offerUntil = game.time + 2.6 }

let stepPhase = 0
let lastNear: number | null = null
const INTRO_LEN = 6

if (import.meta.env.DEV) (window as unknown as { __game: typeof game }).__game = game

export function PlayerController() {
  const { camera } = useThree()
  if (import.meta.env.DEV) (window as unknown as { __cam: THREE.Camera }).__cam = camera
  useInputListeners()

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    game.time += dt
    const st = useStore.getState()
    const p = game.pos

    // ---------- intro cinematic: fly in from above the sea, then settle behind the player ----------
    if (st.phase === 'intro') {
      if (!st.splash) game.introT += dt // the intro flight starts once the splash picture is gone
      const t = clamp(game.introT / INTRO_LEN, 0, 1)
      const e = t * t * (3 - 2 * t)
      const a = 0.9 - e * 0.9
      const start = new THREE.Vector3(Math.sin(a) * 120, 70, 120 + Math.cos(a) * 40)
      const end = new THREE.Vector3(p.x, p.y + 1.5, p.z).add(new THREE.Vector3(Math.sin(game.camYaw) * Math.cos(game.camPitch), Math.sin(game.camPitch), Math.cos(game.camYaw) * Math.cos(game.camPitch)).multiplyScalar(game.camDist))
      camera.position.lerpVectors(start, end, e)
      look.set(0, 2, 20 - e * 20).lerp(new THREE.Vector3(p.x, p.y + 1.5, p.z), e)
      camera.lookAt(look)
      game.anim = 'idle'
      if (t >= 1) st.set({ phase: 'play' })
      return
    }

    // ---------- input ----------
    const k = game.keys
    let ix = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0)
    let iz = (k.has('s') || k.has('arrowdown') ? 1 : 0) - (k.has('w') || k.has('arrowup') ? 1 : 0)
    ix += game.joy.x; iz += game.joy.y
    const mag = Math.hypot(ix, iz)
    const manual = mag > 0.12
    if (manual) { cancelAutoWalk(); game.wantSit = false }
    if (!game.wantSit) game.stargaze = false
    const run = k.has('shift') || game.runToggle || mag > 1.15 || (game.joy.x ** 2 + game.joy.y ** 2) > 0.85

    let dirx = 0, dirz = 0, speedMul = 0
    if (manual) {
      const n = Math.min(1, mag)
      const sy = Math.sin(game.camYaw), cy = Math.cos(game.camYaw)
      // camera sits at +z when yaw=0 and looks to -z
      const fx = -sy, fz = -cy, rx = cy, rz = -sy
      dirx = (rx * ix - fx * iz) / (mag || 1); dirz = (rz * ix - fz * iz) / (mag || 1)
      speedMul = n
    } else if (game.route.length) {
      const wp = game.route[0]
      const dx = wp[0] - p.x, dz = wp[1] - p.z, d = Math.hypot(dx, dz)
      if (d < 0.45) {
        game.route.shift()
        if (!game.route.length) { const cb = game.onArrive; game.onArrive = null; cb?.() }
      } else { dirx = dx / d; dirz = dz / d; speedMul = 1 }
    }

    const offering = game.time < game.offerUntil
    let moved = false
    if (offering) {
      game.anim = 'offer'
    } else if (speedMul > 0) {
      const spd = (run && manual ? 6.4 : manual ? 3.4 : 3.8) * speedMul
      const [nx, nz] = moveWithCollision(p.x, p.z, dirx * spd * dt, dirz * spd * dt)
      moved = Math.hypot(nx - p.x, nz - p.z) > spd * dt * 0.25
      p.x = nx; p.z = nz
      const target = Math.atan2(dirx, dirz)
      const diff = Math.atan2(Math.sin(target - game.heading), Math.cos(target - game.heading))
      game.heading += diff * Math.min(1, dt * 10)
      game.anim = !moved ? 'idle' : run && manual ? 'run' : 'walk'
      // stuck during auto-walk → skip waypoint
      if (!moved && game.route.length) { game.route.shift() }
    } else {
      game.anim = game.wantSit ? 'sit' : 'idle'
    }
    if (!canStand(p.x, p.z)) { /* safety: never leave walkable area */ p.x = 0; p.z = 100 }
    const gy = groundHeight(p.x, p.z)
    p.y += (gy - p.y) * Math.min(1, dt * 14)

    if (moved) {
      stepPhase += dt * (game.anim === 'run' ? 3.3 : 2.1)
      if (stepPhase >= 1) { stepPhase = 0; footstep(game.anim === 'run') }
    }

    // ---------- nearest shrine ----------
    let near: number | null = null, best = 4.2
    for (const s of SLOTS) {
      const d = Math.hypot(p.x - s.x, p.z - s.z)
      if (d < best) { best = d; near = s.index }
    }
    if (near !== lastNear) { lastNear = near; st.set({ nearSlot: near }) }
    const nm = Math.hypot(p.x - MARKET.front[0], p.z - MARKET.front[1]) < 4.6
    if (nm !== st.nearMarket) st.set({ nearMarket: nm })
    let np: string | null = null
    for (const q of PLACES) if (Math.hypot(p.x - q.x, p.z - q.z) < q.r) { np = q.id; break }
    if (np !== st.nearPlace) st.set({ nearPlace: np })

    // ---------- third-person follow camera with collision ----------
    if (game.stargaze) {
      // lying back on the hilltop: the lens sits low behind the player and looks up (drag to look around the sky)
      const el = clamp(game.camPitch + 0.2, 0.25, 1.45)
      tmp.set(p.x + Math.sin(game.camYaw) * 2.4, p.y + 0.55, p.z + Math.cos(game.camYaw) * 2.4)
      camera.position.lerp(tmp, 1 - Math.exp(-dt * 6))
      look.set(camera.position.x - Math.sin(game.camYaw) * Math.cos(el) * 20, camera.position.y + Math.sin(el) * 20, camera.position.z - Math.cos(game.camYaw) * Math.cos(el) * 20)
      camera.lookAt(look)
      return
    }
    const f = game.camFocus
    const fx0 = f ? f.x : p.x, fy0 = f ? f.y + 0.45 : p.y + 1.55, fz0 = f ? f.z : p.z
    // film-style chase camera: a smoothed target, a smoothed distance and a gentle swing round to the back of a walking player
    if (!cam.init || f) { cam.tx = fx0; cam.ty = fy0; cam.tz = fz0; cam.dist = game.camDist; cam.init = true }
    else {
      const kx = 1 - Math.exp(-dt * 7), ky = 1 - Math.exp(-dt * 3.5)
      cam.tx += (fx0 - cam.tx) * kx; cam.tz += (fz0 - cam.tz) * kx; cam.ty += (fy0 - cam.ty) * ky
    }
    const walkingForward = game.route.length > 0 || (mag > 0.12 && iz < -0.25 && Math.abs(ix) < 0.5)
    if (!f && walkingForward && moved && game.time - cam.dragAt > 1.6) {
      const want = game.heading + Math.PI
      const diff = Math.atan2(Math.sin(want - game.camYaw), Math.cos(want - game.camYaw))
      game.camYaw += diff * (1 - Math.exp(-dt * 1.1))
    }
    const tx = cam.tx, ty = cam.ty, tz = cam.tz
    const cp = Math.cos(game.camPitch), sp = Math.sin(game.camPitch)
    const ox = Math.sin(game.camYaw) * cp, oy = sp, oz = Math.cos(game.camYaw) * cp
    // how far back the lens may sit: trunks and the ground can pull it in, blossom canopies only down to a comfortable minimum
    let dA = game.camDist
    for (; dA > 1.6; dA -= 0.4) {
      const cx = tx + ox * dA, cy = ty + oy * dA, cz = tz + oz * dA
      if (cy < groundHeight(cx, cz) + 0.5) continue
      let hit = false
      for (const c of COLLIDERS) {
        if (c.r < 0.35) continue
        if (Math.hypot(cx - c.x, cz - c.z) < c.r + 0.2 && cy < groundHeight(c.x, c.z) + 2.4) { hit = true; break }
      }
      if (!hit) break
    }
    let allowed = dA
    for (; allowed > Math.min(dA, 4.6); allowed -= 0.4) {
      const cx = tx + ox * allowed, cy = ty + oy * allowed, cz = tz + oz * allowed
      let hit = false
      for (const t of trees) {
        const dx = cx - t.x, dz = cz - t.z
        if (dx * dx + dz * dz > (3.0 * t.s) ** 2) continue
        if (cy > t.y + 1.3 * t.s && cy < t.y + 5.4 * t.s) { hit = true; break }
      }
      if (!hit) break
    }
    // pull in briskly but let go slowly, so the picture never pumps in and out
    cam.dist += (allowed - cam.dist) * (1 - Math.exp(-dt * (allowed < cam.dist ? 2.2 : 0.8)))
    tmp.set(tx + ox * cam.dist, ty + oy * cam.dist, tz + oz * cam.dist)
    tmp.y = Math.max(tmp.y, groundHeight(tmp.x, tmp.z) + 0.55)
    camera.position.copy(tmp)
    look.set(tx, ty - 0.15, tz)
    camera.lookAt(look)
  })
  return null
}
