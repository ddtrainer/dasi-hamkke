// Pure world logic (no three.js / React) so it can be unit-tested in Node.
// The island layout is traced from the reference illustration (bridge + gate in the south,
// ring garden with the big white tree in the middle, pond + stream + wooden bridge in the east,
// waterfall + gazebo hill in the north-east, big tree on the north hill, shrine rows west/north/east).
export const SEA = 0
export const WALK_MIN_H = 0.3
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
export const sstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export type V2 = [number, number]

// ---------------- coast outline (world x,z) ----------------
export const COAST: V2[] = [
  [-55, 0], [-63.2, -18.4], [-59.5, -28.4], [-51.4, -38.4], [-40, -48.4], [-30.5, -53.4], [-13.3, -58.4], [5.7, -60.9],
  [24.8, -59.6], [39, -53.4], [53.3, -40.9], [62.9, -25.9], [49.7, 4.3], [39.9, 26.3], [29.8, 39.8], [19.6, 52.9],
  [14.7, 60.1], [10.4, 60.8], [6.4, 63], [4, 66.6], [-3.8, 67.3], [-6.1, 66.6], [-10.6, 62.1], [-17.5, 54.4],
  [-22.4, 46.6], [-29, 39.8], [-40.7, 21.9],
]
const N_ANG = 720
const polyR: number[] = (() => {
  const out = new Array<number>(N_ANG).fill(60)
  for (let i = 0; i < N_ANG; i++) {
    const a = (i / N_ANG) * Math.PI * 2 - Math.PI
    const dx = Math.cos(a), dz = Math.sin(a)
    let best = Infinity
    for (let j = 0; j < COAST.length; j++) {
      const p = COAST[j], q = COAST[(j + 1) % COAST.length]
      const ex = q[0] - p[0], ez = q[1] - p[1]
      const den = dx * ez - dz * ex
      if (Math.abs(den) < 1e-9) continue
      const t = (p[0] * ez - p[1] * ex) / den
      const u = (p[0] * dz - p[1] * dx) / den
      if (t > 0 && u >= 0 && u <= 1 && t < best) best = t
    }
    out[i] = isFinite(best) ? best : 60
  }
  // smooth
  const sm = out.map((_, i) => {
    let s = 0
    for (let k = -6; k <= 6; k++) s += out[(i + k + N_ANG) % N_ANG]
    return s / 13
  })
  return sm
})()
/** Distance from the origin to the visible shoreline in direction th (atan2(z,x)). */
export function shoreRadius(th: number) {
  const f = ((th + Math.PI) / (Math.PI * 2)) * N_ANG
  const i = Math.floor(f) % N_ANG, j = (i + 1) % N_ANG, t = f - Math.floor(f)
  return polyR[i] * (1 - t) + polyR[j] * t
}
const shoreR = (th: number) => shoreRadius(th) + 5.5

// ---------------- features ----------------
export const POND = { x: 16.4, z: 18.5, r: 6.8 }
export const HILLS = [
  { x: 10, z: -54, a: 8, s: 9 }, // north hill with the big tree
  { x: 38, z: -48, a: 10, s: 10 }, // gazebo hill with the waterfall
]
export const BRIDGE = { halfW: 2.5, z0: 43, z1: 112, y: 1.7 }
export const STREAM_BRIDGE = { x0: 19, x1: 27, z0: -22.2, z1: -18.6, y: 1.75 }
export const STREAM: V2[] = [
  [30.5, -37], [28.5, -31], [26, -25], [22.8, -20.4], [22, -15], [20.5, -8], [18.7, -3], [17.5, 4], [16.4, 11.5],
]
export const GATE = { x: 0, z: 45 }
export const CENTER_TREE = { x: 0, z: 0 }
export const RING_R = 12.5
export const GAZEBO = { x: 38, z: -48 }
export const BIG_TREE = { x: 10, z: -54 }
export const WATERFALL = { x: 30, z: -35 }
export const FENCE: V2[] = [[41, 15], [41.5, 20], [38, 25.5], [33.5, 30.5]]
/** "다시 함께 마켓": local +z is the shop front, which faces west (towards the east footpath). */
export const MARKET = { x: 39.5, z: 7.5, ry: -Math.PI / 2, front: [34.5, 7.5] as V2 }
export function marketToWorld(lx: number, lz: number): V2 {
  const c = Math.cos(MARKET.ry), s = Math.sin(MARKET.ry)
  return [MARKET.x + lx * c + lz * s, MARKET.z - lx * s + lz * c]
}

/** 0 on the hills / cliffs, 1 where the coast is flat enough for a sandy beach. */
export function beachiness(x: number, z: number) {
  let hill = 0
  for (const hl of HILLS) hill += hl.a * Math.exp(-((x - hl.x) ** 2 + (z - hl.z) ** 2) / (2 * hl.s * hl.s))
  return 1 - sstep(0.4, 3.0, hill)
}
function baseHeight(x: number, z: number): number {
  const r = Math.hypot(x, z)
  const th = Math.atan2(z, x)
  const R = shoreR(th)
  const land = 1 - sstep(R - 12, R, r)
  let h = -2 + 3.5 * land
  h += land * (0.12 * Math.sin(x * 0.31) * Math.cos(z * 0.27) + 0.08 * Math.sin(x * 0.11 + z * 0.17))
  for (const hl of HILLS) {
    const d2 = (x - hl.x) ** 2 + (z - hl.z) ** 2
    h += land * hl.a * Math.exp(-d2 / (2 * hl.s * hl.s))
  }
  const pd2 = (x - POND.x) ** 2 + (z - POND.z) ** 2
  h -= 2.3 * Math.exp(-pd2 / (2 * 5.0 * 5.0))
  const sd = distToPolyline(x, z, STREAM)
  h -= 0.35 * (1 - sstep(0.4, 2.2, sd)) * land
  // sandy beach: a flat shelf just above the sea, wider in some bays than in others (not on the hill cliffs)
  if (r > R - 14) {
    const rw = R - 5.5
    const edge = rw + 1.4 + 0.6 * (1.2 * Math.sin(th * 3.1 + 0.8) + 0.8 * Math.sin(th * 5.3 + 2.0))
    const fade = 1 - sstep(edge, edge + 3.0, r)
    if (fade > 0) {
      const top = 0.62 + 0.05 * Math.sin(x * 0.45) * Math.sin(z * 0.4)
      h = Math.max(h, -2 + (top + 2) * fade * beachiness(x, z))
    }
  }
  return h
}
/** Terrain height. Footpaths are cut into the ground: across a path the ground is levelled to the height of its centre line. */
export function terrainHeight(x: number, z: number): number {
  const h = baseHeight(x, z)
  let best = Infinity, px = 0, pz = 0
  for (const [a, b] of PATH_SEGS) {
    const dx = b[0] - a[0], dz = b[1] - a[1]
    const l2 = dx * dx + dz * dz
    const t = l2 === 0 ? 0 : clamp(((x - a[0]) * dx + (z - a[1]) * dz) / l2, 0, 1)
    const qx = a[0] + t * dx, qz = a[1] + t * dz
    const d = Math.hypot(x - qx, z - qz)
    if (d < best) { best = d; px = qx; pz = qz }
  }
  const w = 1 - sstep(PATH_HALF_W + 0.1, PATH_HALF_W + 3.4, best)
  if (w <= 0) return h
  return h + (baseHeight(px, pz) - h) * w
}
export const POND_WATER_Y = 0.75

export function inBridge(x: number, z: number) {
  return Math.abs(x) < BRIDGE.halfW && z > BRIDGE.z0 && z < BRIDGE.z1
}
export function inStreamBridge(x: number, z: number) {
  const b = STREAM_BRIDGE
  return x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1
}
export function groundHeight(x: number, z: number): number {
  if (inBridge(x, z)) return BRIDGE.y
  if (inStreamBridge(x, z)) return STREAM_BRIDGE.y
  return terrainHeight(x, z)
}

export function distToSeg(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az
  const l2 = dx * dx + dz * dz
  const t = l2 === 0 ? 0 : clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1)
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz))
}
export function distToPolyline(x: number, z: number, pts: V2[]) {
  let m = Infinity
  for (let i = 0; i < pts.length - 1; i++)
    m = Math.min(m, distToSeg(x, z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]))
  return m
}

// ---------------- Path graph ----------------
export const NODES: Record<string, V2> = {
  B1: [0, 100], B0: [0, 60], G: [0, 45], G2: [0, 39], S0: [0, 32.4],
}
const RING_N = 16
for (let k = 0; k < RING_N; k++) {
  const a = (k / RING_N) * Math.PI * 2
  NODES['R' + k] = [Math.sin(a) * RING_R, Math.cos(a) * RING_R]
}
Object.assign(NODES, {
  // south-west spur (towards the flower drifts left of the gate)
  SW1: [-11.8, 19.5], SW2: [-13.6, 27.3],
  // west / north-west shrine loop
  W1: [-22, -2], W2: [-33, 1.5], W3: [-34.5, -10.5], W4: [-32.4, -19.6], W5: [-26.7, -23.4], W6: [-18.1, -25.1], W7: [-12, -16.5],
  // north
  N1: [-1, -25.9], N2: [-6.7, -28.9], N3: [-12.4, -28.9], H1: [3, -40], H2: [8, -48], HT: [10, -51.5],
  // north-east: ring -> wooden bridge over the stream
  NE1: [12.3, -12.9], NE2: [16.8, -18.9], BRW: [19.5, -20.4], BRC: [23, -20.4], BRE: [28, -19.5],
  // east loop (south of the pond, up the east side to the bridge)
  SE1: [4.5, 40.2], SE2: [8.4, 42.3], SE3: [13, 39.1], SE4: [21, 31.6], SE5: [27, 18.7], SE6: [28.5, 7.1], SE7: [28, -4], SE8: [27, -12], MKa: [34.5, 7.5],
  // gazebo hill
  GZ1: [33, -26], GZ2: [36, -35], GZ3: [38, -43], GZ: [38, -46],
  // pond viewpoint
  PV: [7, 19],
  // ---- outer coastal trail: a loop around the whole island (about 6 m inside the shoreline) ----
  P0: [-48.4, 0], P1: [-53.4, -9.4], P2: [-55.6, -20.2], P3: [-50.6, -29.2], P4: [-43.7, -36.7], P5: [-36.1, -43], P6: [-27.4, -47.5], P7: [-18.3, -50.2], P8: [-9.2, -52.4],
  // north: passes behind the big hill tree, runs *through* the gazebo and comes down its gentle south slope (the east side is a cliff)
  P9: [-1, -55.5], P10: [6, -57], P11: [13, -57], P12: [21, -55.5], P13: [29, -52.5], P14: [34, -48.5], LG: [38, -48], PE: [44, -32],
  // east: behind the market, then along the inner east footpath (the cliff fence and a shrine sit at the shore there)
  P17: [52.4, -30.3], P18: [55.2, -20.1], P19: [49.5, -8.7], P20: [45.2, -1], P21: [44.2, 5], P22: [42.6, 12.5], P23: [39, 13.6],
  // south: through the plaza just inside the gate (SE2, SE1, G2 are shared with the main paths)
  WS1: [-4.5, 40.2], WS2: [-8.4, 42.3], P29: [-15, 45], P30: [-22, 38.1], P31: [-26.8, 31.9], P32: [-30.6, 25.7], P33: [-34.3, 19.8], P34: [-38.4, 14], P35: [-43, 7.6],
})
const MAIN_EDGES: [string, string][] = [
  ['B1', 'B0'], ['B0', 'G'], ['G', 'G2'], ['G2', 'S0'], ['S0', 'R0'],
  ...Array.from({ length: RING_N }, (_, k) => ['R' + k, 'R' + ((k + 1) % RING_N)] as [string, string]),
  ['R14', 'SW1'], ['SW1', 'SW2'], ['SW2', 'S0'],
  ['R12', 'W1'], ['W1', 'W2'], ['W2', 'W3'], ['W3', 'W4'], ['W4', 'W5'], ['W5', 'W6'], ['W6', 'W7'], ['W7', 'R10'],
  ['R8', 'N1'], ['N1', 'N2'], ['N2', 'N3'], ['N3', 'W6'], ['N1', 'H1'], ['H1', 'H2'], ['H2', 'HT'],
  ['R6', 'NE1'], ['NE1', 'NE2'], ['NE2', 'BRW'], ['BRW', 'BRC'], ['BRC', 'BRE'],
  ['G2', 'SE1'], ['SE1', 'SE2'], ['SE2', 'SE3'], ['SE3', 'SE4'], ['SE4', 'SE5'], ['SE5', 'SE6'], ['SE6', 'SE7'], ['SE6', 'MKa'], ['SE7', 'SE8'], ['SE8', 'BRE'],
  ['BRE', 'GZ1'], ['GZ1', 'GZ2'], ['GZ2', 'GZ3'], ['GZ3', 'GZ'],
  ['R2', 'PV'],
]
/** The coastal loop, in walking order (clockwise seen from above: west -> north -> east -> south). */
export const LOOP_IDS = [
  'P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11', 'P12', 'P13', 'P14', 'LG', 'GZ', 'GZ3', 'GZ2', 'PE', 'P17', 'P18', 'P19', 'P20', 'P21', 'P22',
  'P23', 'SE5', 'SE4', 'SE3', 'SE2', 'SE1', 'G2', 'WS1', 'WS2', 'P29', 'P30', 'P31', 'P32', 'P33', 'P34', 'P35',
]
const LOOP_EDGES: [string, string][] = [
  ...LOOP_IDS.map((id, i) => [id, LOOP_IDS[(i + 1) % LOOP_IDS.length]] as [string, string]),
  // side trails joining the loop to the inner paths
  ['W3', 'P1'], ['W2', 'P0'],
]
export const EDGES: [string, string][] = [...MAIN_EDGES, ...LOOP_EDGES]
export const PATH_SEGS: [V2, V2][] = EDGES.map(([a, b]) => [NODES[a], NODES[b]])
/** Inner paths only: shrines and benches are placed relative to these, so the coastal trail never moves them. */
const MAIN_SEGS: [V2, V2][] = MAIN_EDGES.map(([a, b]) => [NODES[a], NODES[b]])
export const PATH_HALF_W = 1.45
export function distToPath(x: number, z: number) {
  let m = Infinity
  for (const [a, b] of PATH_SEGS) m = Math.min(m, distToSeg(x, z, a[0], a[1], b[0], b[1]))
  return m
}
export function nearestPathPoint(x: number, z: number): V2 {
  let best = Infinity, bp: V2 = [0, 0]
  for (const [a, b] of MAIN_SEGS) {
    const dx = b[0] - a[0], dz = b[1] - a[1]
    const l2 = dx * dx + dz * dz
    const t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / l2, 0, 1)
    const px = a[0] + t * dx, pz = a[1] + t * dz
    const d = Math.hypot(x - px, z - pz)
    if (d < best) { best = d; bp = [px, pz] }
  }
  return bp
}
/** Keep a point between min and max distance from the path (pull in / push out). */
export function snapToPath(x: number, z: number, min: number, max: number, target: number): V2 {
  const [px, pz] = nearestPathPoint(x, z)
  let dx = x - px, dz = z - pz
  const d = Math.hypot(dx, dz)
  if (d >= min && d <= max) return [x, z]
  if (d < 1e-6) { dx = 1; dz = 0 } else { dx /= d; dz /= d }
  return [px + dx * target, pz + dz * target]
}

// ---------------- Colliders (filled by layout.ts) ----------------
export interface Circle { x: number; z: number; r: number }
export const COLLIDERS: Circle[] = []

export function isWater(x: number, z: number) {
  if (inBridge(x, z) || inStreamBridge(x, z)) return false
  if (Math.hypot(x - POND.x, z - POND.z) < POND.r) return true
  if (distToPolyline(x, z, STREAM) < 1.0) return true
  return false
}
export function canStand(x: number, z: number) {
  if (groundHeight(x, z) < WALK_MIN_H) return false
  return !isWater(x, z)
}

/** Push (x,z) out of circle colliders. */
export function resolveColliders(x: number, z: number, pr = 0.4): V2 {
  for (let it = 0; it < 2; it++) {
    for (const c of COLLIDERS) {
      const dx = x - c.x, dz = z - c.z
      const min = c.r + pr
      const d2 = dx * dx + dz * dz
      if (d2 < min * min) {
        const d = Math.sqrt(d2) || 0.0001
        x = c.x + (dx / d) * min
        z = c.z + (dz / d) * min
      }
    }
  }
  return [x, z]
}

/** Move with sliding along obstacles. Returns the new position. */
export function moveWithCollision(x: number, z: number, dx: number, dz: number): V2 {
  const h0 = groundHeight(x, z)
  const attempt = (nx: number, nz: number): V2 | null => {
    const [rx, rz] = resolveColliders(nx, nz)
    if (!canStand(rx, rz)) return null
    if (Math.abs(groundHeight(rx, rz) - h0) > 0.6) return null
    return [rx, rz]
  }
  return attempt(x + dx, z + dz) ?? attempt(x + dx, z) ?? attempt(x, z + dz) ?? [x, z]
}

// ---------------- Routing (Dijkstra over path graph) ----------------
const ADJ: Record<string, string[]> = {}
for (const [a, b] of EDGES) { (ADJ[a] ||= []).push(b); (ADJ[b] ||= []).push(a) }
const dist2 = (a: V2, b: V2) => Math.hypot(a[0] - b[0], a[1] - b[1])

export function nearestNode(p: V2): string {
  let best = Infinity, id = 'G'
  for (const k in NODES) { const d = dist2(NODES[k], p); if (d < best) { best = d; id = k } }
  return id
}
function segmentClear(a: V2, b: V2) {
  const n = Math.ceil(dist2(a, b) / 0.8)
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t
    if (!canStand(x, z)) return false
    for (const c of COLLIDERS) if (Math.hypot(x - c.x, z - c.z) < c.r + 0.2) return false
  }
  return true
}
function entryNode(p: V2): string {
  const ids = Object.keys(NODES).sort((a, b) => dist2(NODES[a], p) - dist2(NODES[b], p))
  for (const id of ids.slice(0, 8)) if (segmentClear(p, NODES[id])) return id
  return ids[0]
}
export function planRoute(from: V2, to: V2): V2[] {
  if (dist2(from, to) < 4 && segmentClear(from, to)) return [to]
  const s = entryNode(from)
  const ids = Object.keys(NODES).sort((a, b) => dist2(NODES[a], to) - dist2(NODES[b], to))
  const t = ids.slice(0, 8).find((id) => segmentClear(NODES[id], to)) ?? ids[0]
  const d: Record<string, number> = { [s]: 0 }
  const prev: Record<string, string> = {}
  const q = new Set(Object.keys(NODES))
  while (q.size) {
    let u: string | null = null
    for (const k of q) if (d[k] !== undefined && (u === null || d[k] < d[u])) u = k
    if (u === null || u === t) break
    q.delete(u)
    for (const v of ADJ[u] ?? []) {
      const nd = d[u] + dist2(NODES[u], NODES[v])
      if (d[v] === undefined || nd < d[v]) { d[v] = nd; prev[v] = u }
    }
  }
  const chain: string[] = []
  for (let c: string | undefined = t; c; c = prev[c]) { chain.unshift(c); if (c === s) break }
  const pts = chain.map((id) => NODES[id])
  if (pts.length > 1 && dist2(from, pts[1]) < dist2(pts[0], pts[1])) pts.shift()
  pts.push(to)
  return pts
}
/** Route that walks through a list of node ids in order (used by the stroll tour). */
export function routeThrough(ids: string[], from?: V2): V2[] {
  const out: V2[] = []
  let cur: V2 = from ?? NODES[ids[0]]
  for (const id of ids) { out.push(...planRoute(cur, NODES[id])); cur = NODES[id] }
  return out
}

// ---------------- Memorial slots (traced from the illustration) ----------------
export const SLOT_POS: V2[] = [
  [-37.5, -6.2], [-39.5, -18.4], [-38.5, -21.4], [-33.3, -27.1], [-27.6, -30.4], [-23.1, -33.9], [-14.3, -35.4], [-7.6, -35.1],
  [12.4, -33.4], [-16.6, 16.1], [-16.8, 28.3], [33, 24], [31.5, -12], [37, -20], [9.5, 33.3], [14.7, 30.4],
  // hilltop memorial halls (north hill by the big tree, and the gazebo hill)
  [4.5, -47], [14, -46], [15, -52], [-1, -43], [32, -40],
]
export interface SlotInfo { index: number; x: number; z: number; ry: number; front: V2 }
export const SLOTS: SlotInfo[] = SLOT_POS.map(([sx, sz], index) => {
  // keep every shrine connected to a footpath (3–4.5 m beside it)
  const [x, z] = snapToPath(sx, sz, 4.2, 6.0, 4.8)
  const [px, pz] = nearestPathPoint(x, z)
  let fx = px - x, fz = pz - z
  const l = Math.hypot(fx, fz) || 1
  fx /= l; fz /= l
  return { index, x, z, ry: Math.atan2(fx, fz), front: [x + fx * 2.3, z + fz * 2.3] as V2 }
})

export const DESTINATIONS = {
  center: { label: '중앙 꽃 정원', p: [0, 6.5] as V2 },
  pond: { label: '연못', p: [8, 19] as V2 },
  gazebo: { label: '언덕 위 전망대', p: [38, -44.5] as V2 },
  bigtree: { label: '언덕 위 큰 나무', p: [10, -50] as V2 },
  gate: { label: '입구 아치', p: [0, 41] as V2 },
  market: { label: '다시 함께 마켓', p: MARKET.front },
}
