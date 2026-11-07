// Deterministic placement of vegetation / props. Pure (no three.js).
// Fixed positions are traced from the reference illustration; the rest is filled in procedurally.
import {
  COLLIDERS, SLOTS, POND, MARKET, marketToWorld, HILLS, mulberry32, terrainHeight, groundHeight, distToPath, nearestPathPoint, canStand,
  distToPolyline, STREAM, GATE, PATH_SEGS, shoreRadius, snapToPath, GAZEBO, BIG_TREE, FENCE, WATERFALL, V2, NODES, LOOP_IDS, beachiness,
} from './terrain'

export interface TreeDef { x: number; y: number; z: number; s: number; kind: 'cherry' | 'white' | 'green'; seed: number }
export interface PropDef { x: number; y: number; z: number; ry: number }
export interface FlowerDef { x: number; y: number; z: number; c: number; s: number }

const rnd = mulberry32(20240501)
export const trees: TreeDef[] = []
export const benches: PropDef[] = []
export const lanterns: PropDef[] = []
export const rocks: { x: number; y: number; z: number; s: number; ry: number }[] = []
export const flowers: FlowerDef[] = []
export const fencePosts: V2[] = []

const reserved: { x: number; z: number; r: number }[] = []
for (const s of SLOTS) reserved.push({ x: s.front[0], z: s.front[1], r: 3.2 }, { x: s.x, z: s.z, r: 3.2 })
reserved.push({ x: MARKET.x - 2, z: MARKET.z, r: 8.5 }, { x: GAZEBO.x, z: GAZEBO.z, r: 5 }, { x: GATE.x, z: GATE.z, r: 8 }, { x: WATERFALL.x, z: WATERFALL.z, r: 3 })

function free(x: number, z: number, minPath: number, r = 0.8) {
  if (!canStand(x, z) || groundHeight(x, z) < 0.9) return false
  if (distToPath(x, z) < minPath) return false
  if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 1.5) return false
  if (distToPolyline(x, z, STREAM) < 2) return false
  for (const q of reserved) if (Math.hypot(x - q.x, z - q.z) < q.r) return false
  for (const c of COLLIDERS) if (Math.hypot(x - c.x, z - c.z) < c.r + r) return false
  return true
}
function addTree(x: number, z: number, s: number, kind: TreeDef['kind'], seed = rnd(), collide = true) {
  trees.push({ x, z, y: terrainHeight(x, z), s, kind, seed })
  if (collide) COLLIDERS.push({ x, z, r: 0.5 * s + 0.1 })
}

COLLIDERS.push({ x: -3.5, z: GATE.z, r: 0.9 }, { x: 3.5, z: GATE.z, r: 0.9 })
for (const [dx, dz] of [[1.6, 1.6], [-1.6, 1.6], [1.6, -1.6], [-1.6, -1.6]]) COLLIDERS.push({ x: GAZEBO.x + dx, z: GAZEBO.z + dz, r: 0.3 })

// market: building, shelves, rack, table and lamp block the way
for (const [lx, lz, r] of [[-2.4, -0.8, 2.0], [0, -0.8, 2.0], [2.4, -0.8, 2.0], [-3.9, 1.9, 0.8], [3.9, 1.9, 0.8], [-4.8, 3.2, 0.8], [5.2, 4.4, 1.1], [-2.2, 4.0, 0.3], [3.0, 3.6, 0.6]] as const) {
  const [wx, wz] = marketToWorld(lx, lz)
  COLLIDERS.push({ x: wx, z: wz, r })
}

// hero trees: the big white blossom tree in the ring garden, and the big tree on the north hill
addTree(0, 0, 2.7, 'white')
COLLIDERS[COLLIDERS.length - 1].r = 1.4
addTree(BIG_TREE.x, BIG_TREE.z, 2.4, 'green')
COLLIDERS[COLLIDERS.length - 1].r = 1.3

// a cherry tree behind every memorial shrine
for (const s of SLOTS) {
  const bx = s.x - Math.sin(s.ry) * 3.9, bz = s.z - Math.cos(s.ry) * 3.9
  if (canStand(bx, bz) && distToPath(bx, bz) > 2.2) addTree(bx, bz, 1.5 + rnd() * 0.5, 'cherry')
  COLLIDERS.push({ x: s.x, z: s.z, r: 1.55 })
}


// ---- coastal trail furniture (placed before the scattered trees so they keep clear of it) ----
{
  const pts: V2[] = LOOP_IDS.map((id) => NODES[id])
  /** points every `step` metres along loop segments i0..i1 (indices into LOOP_IDS), with the outward (seaward) direction */
  const sample = (i0: number, i1: number, step: number) => {
    const out: { x: number; z: number; ox: number; oz: number }[] = []
    let carry = 0
    for (let i = i0; i < i1; i++) {
      const a = pts[i % pts.length], b = pts[(i + 1) % pts.length]
      const L = Math.hypot(b[0] - a[0], b[1] - a[1])
      let d = carry
      for (; d < L; d += step) {
        const x = a[0] + ((b[0] - a[0]) * d) / L, z = a[1] + ((b[1] - a[1]) * d) / L
        const r = Math.hypot(x, z) || 1
        out.push({ x, z, ox: x / r, oz: z / r })
      }
      carry = d - L
    }
    return out
  }
  const idx = (id: string) => LOOP_IDS.indexOf(id)
  const busy = (x: number, z: number) =>
    Math.hypot(x - MARKET.x, z - MARKET.z) < 9.5 || Math.hypot(x - GAZEBO.x, z - GAZEBO.z) < 7.5 || (Math.abs(x) < 11 && z > 33) ||
    SLOTS.some((s) => Math.hypot(x - s.x, z - s.z) < 3.8) || Math.hypot(x - BIG_TREE.x, z - BIG_TREE.z) < 4.5
  const clear = (x: number, z: number, r: number) => canStand(x, z) && !COLLIDERS.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + r)
  // lanterns on the seaward side, every ~13 m
  for (const p of sample(0, LOOP_IDS.length, 13)) {
    const x = p.x + p.ox * 1.9, z = p.z + p.oz * 1.9
    if (busy(p.x, p.z) || !clear(x, z, 0.5)) continue
    lanterns.push({ x, y: terrainHeight(x, z), z, ry: 0 })
  }
  // benches facing the sea, on the inland side
  for (const p of sample(0, LOOP_IDS.length, 34)) {
    const x = p.x - p.ox * 2.2, z = p.z - p.oz * 2.2
    if (busy(p.x, p.z) || !clear(x, z, 1.0)) continue
    benches.push({ x, z, y: terrainHeight(x, z), ry: Math.atan2(p.ox, p.oz) })
    COLLIDERS.push({ x, z, r: 0.9 })
  }
  // wooden fence on the seaward edge of the west, north-west, east and south-west stretches
  for (const [a, b] of [['P0', 'P9'], ['P17', 'P20'], ['P29', 'P35']] as const) {
    for (const p of sample(idx(a), idx(b), 1.8)) {
      const x = p.x + p.ox * 3.3, z = p.z + p.oz * 3.3
      if (busy(p.x, p.z) || !clear(x, z, 0.3)) continue
      // only where the seaward side really drops away (cliffs); sandy beaches stay open
      const x2 = p.x + p.ox * 5.5, z2 = p.z + p.oz * 5.5
      if (terrainHeight(x, z) - terrainHeight(x2, z2) < 1.2 && canStand(x2, z2)) continue
      fencePosts.push([x, z]); COLLIDERS.push({ x, z, r: 0.3 })
    }
  }
}

// trees traced from the illustration
const FIXED: [number, number, number, TreeDef['kind']][] = [
  [-39.7, -4.6, 1.9, 'cherry'], [-37.6, -27.9, 1.6, 'cherry'], [-26.2, -36, 1.6, 'cherry'], [-9, -38, 1.5, 'cherry'], [11, -36, 1.5, 'cherry'],
  [-21.2, 7.1, 1.8, 'cherry'], [-19.4, 29.4, 1.7, 'cherry'], [-6.5, 46.6, 2.2, 'cherry'], [13.6, 27.3, 1.5, 'cherry'],
  [-55, -18, 1.7, 'white'], [-47, -8, 1.4, 'white'],
  [-40.5, -44.6, 1.5, 'green'], [-24.8, 27.3, 1.2, 'green'], [7.5, 46.6, 1.2, 'green'], [20.8, 36.2, 1.2, 'green'], [43.8, -39.6, 1.3, 'green'],
  [53.3, -34.6, 1.2, 'green'], [-3.8, -50.9, 1.3, 'green'], [-14, -44, 1.3, 'green'], [20, -48, 1.4, 'green'], [48, -20, 1.5, 'green'],
]
for (const [x, z, s, k] of FIXED) if (free(x, z, 2.2, s * 0.5)) addTree(x, z, s, k)

// scatter to fill the rest
let tries = 0
while (trees.length < 80 && tries++ < 8000) {
  const a = rnd() * Math.PI * 2
  const r = 5 + rnd() * (shoreRadius(a) - 8)
  const x = Math.cos(a) * r, z = Math.sin(a) * r
  if (Math.hypot(x, z) < 5) continue
  if (!free(x, z, 3.0, 1.6)) continue
  const k = rnd()
  addTree(x, z, 1.0 + rnd() * 0.9, k < 0.6 ? 'cherry' : k < 0.66 ? 'white' : 'green')
}

// benches (positions traced from the illustration; nudged off the paths, facing the nearest path)
const BENCH_SPOTS: V2[] = [[-8.7, 13.6], [-5, 5.7], [5.7, 7.1], [4.6, 18.5], [17, 36.5], [-21.7, -30.4], [26.2, -4], [-17.1, 7.1]]
for (const [bx0, bz0] of BENCH_SPOTS) {
  const [bx, bz] = snapToPath(bx0, bz0, 2.0, 99, 2.4)
  if (!canStand(bx, bz)) continue
  const [px, pz] = nearestPathPoint(bx, bz)
  const dx = px - bx, dz = pz - bz, l = Math.hypot(dx, dz) || 1
  benches.push({ x: bx, z: bz, y: terrainHeight(bx, bz), ry: Math.atan2(dx / l, dz / l) })
  COLLIDERS.push({ x: bx, z: bz, r: 0.9 })
}

// lanterns along the main approach
for (let z = 50; z <= 108; z += 8) lanterns.push({ x: -2.35, y: 1.7, z, ry: 0 }, { x: 2.35, y: 1.7, z, ry: 0 })
for (const z of [38, 30, 22]) lanterns.push({ x: -2.3, y: terrainHeight(-2.3, z), z, ry: 0 }, { x: 2.3, y: terrainHeight(2.3, z), z, ry: 0 })

// wooden fence along the east cliff
for (let i = 0; i < FENCE.length - 1; i++) {
  const [ax, az] = FENCE[i], [bx, bz] = FENCE[i + 1]
  const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 1.8))
  for (let j = 0; j <= n; j++) {
    const x = ax + ((bx - ax) * j) / n, z = az + ((bz - az) * j) / n
    if (canStand(x, z)) { fencePosts.push([x, z]); COLLIDERS.push({ x, z, r: 0.3 }) }
  }
}

// rocks: only a few, on the hill cliffs; plus a handful of small stones on the sand
for (let i = 0; i < 400 && rocks.length < 30; i++) {
  const a = rnd() * Math.PI * 2
  const cliff = rnd() < 0.7
  const R = shoreRadius(a) + (cliff ? 0.5 + rnd() * 2.5 : 0.2 + rnd() * 2.5)
  const x = Math.cos(a) * R, z = Math.sin(a) * R
  const h = terrainHeight(x, z)
  if (h < -1.2 || h > 2.5 && !cliff) continue
  if (cliff ? beachiness(x, z) > 0.4 : beachiness(x, z) < 0.6) continue
  if (Math.abs(x) < 7 && z > 40) continue // keep the bridge clear
  rocks.push({ x, y: h, z, s: cliff ? 0.9 + rnd() * 1.6 : 0.35 + rnd() * 0.5, ry: rnd() * 6 })
}

// flowers: beds along the paths + dense drifts like in the illustration
let fc = 0
function placeFlower(x: number, z: number, minPath: number) {
  if (!canStand(x, z) || groundHeight(x, z) < 0.9) return false
  if (distToPath(x, z) < minPath) return false
  if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 0.5) return false
  if (Math.abs(x) < 3.2 && z > 40) return false
  if (distToPolyline(x, z, STREAM) < 1.6) return false
  for (const c of COLLIDERS) if (Math.hypot(x - c.x, z - c.z) < c.r + 0.3) return false
  const palette = Math.floor((Math.sin(x * 0.19) + Math.cos(z * 0.23) + 2) * 1.6 + rnd() * 0.9) % 6
  flowers.push({ x, z, y: terrainHeight(x, z), c: palette, s: 0.7 + rnd() * 0.7 })
  fc++
  return true
}
let ft = 0
while (fc < 1500 && ft++ < 50000) {
  const seg = PATH_SEGS[Math.floor(rnd() * PATH_SEGS.length)]
  const t = rnd()
  const px = seg[0][0] + (seg[1][0] - seg[0][0]) * t, pz = seg[0][1] + (seg[1][1] - seg[0][1]) * t
  const off = 1.9 + rnd() * rnd() * 4.5, a = rnd() * Math.PI * 2
  placeFlower(px + Math.cos(a) * off, pz + Math.sin(a) * off, 1.7)
}
const DRIFTS: [number, number, number, number][] = [
  [-14, 42, 6, 200], [-9, 52, 5, 130], [9, 46, 5, 130], [15, 43, 5, 130], [-16, 36, 5, 110], // around the gate
  [0, 0, 10, 240], // ring garden around the big white tree
  [10, 18, 7, 80], [24, 27, 6, 90], [30, 14, 6, 90], // by the pond
  [-22, 10, 6, 90], [-28, -14, 5, 80], [14, -26, 6, 90],
]
for (const [cx, cz, rad, n] of DRIFTS) {
  let k = 0, tt = 0
  while (k < n && tt++ < n * 12) {
    const a = rnd() * Math.PI * 2, r = (cx === 0 && cz === 0 ? 3.6 : 0) + Math.sqrt(rnd()) * rad
    if (placeFlower(cx + Math.cos(a) * r, cz + Math.sin(a) * r, 1.7)) k++
  }
}
export const FLOWER_COLORS = [0xff9ec4, 0xffffff, 0xffe066, 0xa9b8ff, 0xc9a0ff, 0xff8a7a]
void HILLS
