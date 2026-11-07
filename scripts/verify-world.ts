// Headless verification of walkability, slots, routing and collision-aware auto-walk.
import { SLOTS, NODES, planRoute, routeThrough, LOOP_IDS, moveWithCollision, canStand, groundHeight, COLLIDERS, distToPath, nearestNode, DESTINATIONS, GATE, V2 } from '../src/world/terrain'
import { trees, flowers, benches, lanterns, fencePosts } from '../src/world/layout'

let fail = 0
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('FAIL', m) } }
console.log(`trees=${trees.length} flowers=${flowers.length} benches=${benches.length} lanterns=${lanterns.length} fencePosts=${fencePosts.length} colliders=${COLLIDERS.length}`)

for (const k in NODES) ok(canStand(NODES[k][0], NODES[k][1]), `node ${k} not walkable ${NODES[k]} h=${groundHeight(NODES[k][0], NODES[k][1]).toFixed(2)}`)
for (const s of SLOTS) {
  ok(canStand(s.x, s.z), `slot ${s.index} not standable`)
  ok(canStand(s.front[0], s.front[1]), `slot ${s.index} front not standable`)
  ok(distToPath(s.x, s.z) > 2.2, `slot ${s.index} too near path (${distToPath(s.x, s.z).toFixed(1)})`)
}

// simulate walking along a route using the real movement function
function walk(start: V2, target: V2, label: string) {
  const route = planRoute(start, target)
  let [x, z] = start
  let steps = 0
  for (const wp of route) {
    let guard = 0
    while (Math.hypot(wp[0] - x, wp[1] - z) > 0.5 && guard++ < 2000) {
      const d = Math.hypot(wp[0] - x, wp[1] - z)
      const sp = 3.2 / 60
      ;[x, z] = moveWithCollision(x, z, ((wp[0] - x) / d) * sp, ((wp[1] - z) / d) * sp)
      steps++
    }
    if (guard >= 2000) { ok(false, `${label}: stuck near (${x.toFixed(1)},${z.toFixed(1)}) heading to (${wp.map((n) => n.toFixed(1))})`); return }
  }
  ok(Math.hypot(target[0] - x, target[1] - z) < 1, `${label}: ended far from target`)
  return steps / 60
}
const start: V2 = [0, 105]
let maxT = 0
for (const s of SLOTS) maxT = Math.max(maxT, walk(start, s.front, `bridge->slot${s.index}`) ?? 0)
for (const [k, d] of Object.entries(DESTINATIONS)) maxT = Math.max(maxT, walk(start, d.p, `bridge->${k}`) ?? 0)
for (const id of Object.keys(NODES)) maxT = Math.max(maxT, walk(start, NODES[id], "bridge->node " + id) ?? 0)
// from a slot to another slot
for (let i = 0; i < SLOTS.length; i++) walk(SLOTS[i].front, SLOTS[(i + 5) % SLOTS.length].front, `slot${i}->slot${(i + 5) % SLOTS.length}`)
// the coastal trail: walk the whole loop (as the 'island loop' menu entry does) from several starting points, with real collisions
for (const startIdx of [0, 9, 17, 25, 33]) {
  const ids = [...LOOP_IDS.slice(startIdx), ...LOOP_IDS.slice(0, startIdx), LOOP_IDS[startIdx]]
  const route = routeThrough(ids, NODES[ids[0]])
  let [x, z] = NODES[ids[0]]
  let steps = 0, stuck = false, len = 0
  for (const wp of route) {
    let guard = 0
    while (Math.hypot(wp[0] - x, wp[1] - z) > 0.5 && guard++ < 3000) {
      const d = Math.hypot(wp[0] - x, wp[1] - z), sp = 3.2 / 60
      const [nx, nz] = moveWithCollision(x, z, ((wp[0] - x) / d) * sp, ((wp[1] - z) / d) * sp)
      len += Math.hypot(nx - x, nz - z); x = nx; z = nz; steps++
    }
    if (guard >= 3000) { ok(false, `island loop from #${startIdx}: stuck near (${x.toFixed(1)},${z.toFixed(1)})`); stuck = true; break }
  }
  if (!stuck) console.log(`island loop from ${ids[0]}: ${len.toFixed(0)} m, ${(steps / 60).toFixed(0)} s at 3.2 m/s`)
}
console.log('longest auto-walk (s):', maxT.toFixed(1), 'nearestNode(gate)=', nearestNode([GATE.x, GATE.z]))
console.log(fail ? `${fail} FAILURES` : 'ALL WORLD CHECKS PASSED')
process.exit(fail ? 1 : 0)
