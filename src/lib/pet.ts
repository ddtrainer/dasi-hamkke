// The companion dog's look: a handful of breed presets + free tweaks (coat colours, pattern, ears, tail, build).
// Saved on this device (localStorage) and later per account.
export type BreedId = 'chihuahua' | 'maltese' | 'poodle' | 'pomeranian' | 'shiba' | 'corgi' | 'retriever' | 'shihtzu' | 'mix'
export type Pattern = 'solid' | 'tan' | 'tuxedo' | 'urajiro' | 'patch' | 'spots'
export type EarType = 'round' | 'perky' | 'big' | 'drop' | 'fold'
export type TailType = 'plume' | 'curl' | 'straight' | 'stub'
export type CoatStyle = 'smooth' | 'fluffy' | 'curly'

export type PartId = 'body' | 'head' | 'earL' | 'earR' | 'tail' | 'leg0' | 'leg1' | 'leg2' | 'leg3'
export const PART_IDS: readonly PartId[] = ['body', 'head', 'earL', 'earR', 'tail', 'leg0', 'leg1', 'leg2', 'leg3']
/** a spot painted on the dog: a point on one body part (in that part's own coordinates), its surface normal, size and colour */
export interface Mark { part: PartId; p: [number, number, number]; n: [number, number, number]; s: number; c: string }
export const MAX_MARKS = 24

/** what makes this particular dog recognisable: hand-placed marks, small face tweaks and a few classic markings */
export interface Signature {
  marks: Mark[]
  socks: boolean // white paws
  blaze: boolean // white stripe down the face
  tailTip: boolean // white tail tip
  browDots: boolean // little spots above the eyes
  headSize: number // 0.85 – 1.2
  eyeSize: number // 0.8 – 1.4
  eyeGap: number // 0.8 – 1.3
  earSize: number // 0.7 – 1.4
  noseSize: number // 0.7 – 1.5
}
export const NEUTRAL: Signature = { marks: [], socks: false, blaze: false, tailTip: false, browDots: false, headSize: 1, eyeSize: 1, eyeGap: 1, earSize: 1, noseSize: 1 }

export interface PetProfile extends Signature {
  name: string
  breed: BreedId
  coat: string // main colour
  accent: string // markings: tan points, patches, spots
  white: string // chest / muzzle / paws
  pattern: Pattern
  ears: EarType
  tail: TailType
  coatStyle: CoatStyle
  eye: string
  nose: string
  size: number // 0.7 – 1.5
  legs: number // 0.6 – 1.25
  chunk: number // 0.85 – 1.3 (body width)
  snout: number // 0.5 – 1.5
}

export const BREEDS: Record<BreedId, { label: string; icon: string; p: Omit<PetProfile, 'name' | 'breed' | keyof Signature> }> = {
  chihuahua: { label: '치와와', icon: '🐕', p: { coat: '#211d20', accent: '#d9a059', white: '#fbf0e0', pattern: 'tan', ears: 'round', tail: 'plume', coatStyle: 'fluffy', eye: '#4a2a18', nose: '#141012', size: 0.8, legs: 1, chunk: 1, snout: 1 } },
  maltese: { label: '말티즈', icon: '🐩', p: { coat: '#fbf7ee', accent: '#efe2c8', white: '#ffffff', pattern: 'solid', ears: 'drop', tail: 'curl', coatStyle: 'fluffy', eye: '#2a1a12', nose: '#141012', size: 0.85, legs: 0.85, chunk: 1.05, snout: 0.7 } },
  poodle: { label: '푸들', icon: '🐩', p: { coat: '#d9a77a', accent: '#c48e5f', white: '#e8c9a4', pattern: 'solid', ears: 'drop', tail: 'curl', coatStyle: 'curly', eye: '#2a1a12', nose: '#2a1a12', size: 1.0, legs: 1.2, chunk: 0.95, snout: 1.15 } },
  pomeranian: { label: '포메라니안', icon: '🦊', p: { coat: '#e08a3c', accent: '#c46f26', white: '#fbe9cf', pattern: 'urajiro', ears: 'perky', tail: 'curl', coatStyle: 'fluffy', eye: '#2a1a12', nose: '#141012', size: 0.8, legs: 0.85, chunk: 1.15, snout: 0.7 } },
  shiba: { label: '시바견', icon: '🍂', p: { coat: '#d9843b', accent: '#c06a22', white: '#fff4e4', pattern: 'urajiro', ears: 'perky', tail: 'curl', coatStyle: 'smooth', eye: '#2a1a12', nose: '#141012', size: 1.15, legs: 1.0, chunk: 1.05, snout: 1.0 } },
  corgi: { label: '웰시코기', icon: '🍑', p: { coat: '#e0903f', accent: '#c87625', white: '#ffffff', pattern: 'urajiro', ears: 'big', tail: 'stub', coatStyle: 'smooth', eye: '#2a1a12', nose: '#141012', size: 1.05, legs: 0.62, chunk: 1.15, snout: 1.1 } },
  retriever: { label: '리트리버', icon: '🌾', p: { coat: '#e2b25f', accent: '#cf9a43', white: '#f3d79a', pattern: 'solid', ears: 'drop', tail: 'straight', coatStyle: 'fluffy', eye: '#3a2214', nose: '#141012', size: 1.4, legs: 1.1, chunk: 1.1, snout: 1.35 } },
  shihtzu: { label: '시츄', icon: '🌼', p: { coat: '#f4eee4', accent: '#a8754a', white: '#ffffff', pattern: 'patch', ears: 'drop', tail: 'curl', coatStyle: 'fluffy', eye: '#2a1a12', nose: '#141012', size: 0.9, legs: 0.75, chunk: 1.1, snout: 0.6 } },
  mix: { label: '믹스견', icon: '💛', p: { coat: '#b98a5a', accent: '#8a5f38', white: '#f6e9d3', pattern: 'tuxedo', ears: 'fold', tail: 'plume', coatStyle: 'smooth', eye: '#3a2214', nose: '#2a1a12', size: 1.0, legs: 1, chunk: 1, snout: 1 } },
}

export const BREED_IDS = Object.keys(BREEDS) as BreedId[]

export function breedProfile(id: BreedId, name = ''): PetProfile {
  return { name, breed: id, ...NEUTRAL, ...BREEDS[id].p }
}

export const DEFAULT_PET: PetProfile = breedProfile('chihuahua')

const KEY = 'dasi.pet'
const HEX = /^#[0-9a-fA-F]{6}$/
const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d)
const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d)
const col = (v: unknown, d: string) => (typeof v === 'string' && HEX.test(v) ? v : d)

function sanitizeMarks(raw: unknown): Mark[] {
  if (!Array.isArray(raw)) return []
  const v3 = (a: unknown): [number, number, number] | null => (Array.isArray(a) && a.length === 3 && a.every((x) => typeof x === 'number' && isFinite(x)) ? [a[0], a[1], a[2]] : null)
  const out: Mark[] = []
  for (const r of raw.slice(0, MAX_MARKS)) {
    const o = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>
    const p = v3(o.p), n = v3(o.n)
    if (!p || !n || !PART_IDS.includes(o.part as PartId) || typeof o.c !== 'string' || !HEX.test(o.c)) continue
    out.push({ part: o.part as PartId, p, n, s: num(o.s, 0.4, 3, 1), c: o.c })
  }
  return out
}

export function sanitizePet(raw: unknown): PetProfile {
  const m = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const breed = oneOf(m.breed, BREED_IDS, 'chihuahua')
  const d = breedProfile(breed)
  return {
    name: typeof m.name === 'string' ? m.name.slice(0, 12) : '',
    breed,
    coat: col(m.coat, d.coat), accent: col(m.accent, d.accent), white: col(m.white, d.white),
    pattern: oneOf(m.pattern, ['solid', 'tan', 'tuxedo', 'urajiro', 'patch', 'spots'] as const, d.pattern),
    ears: oneOf(m.ears, ['round', 'perky', 'big', 'drop', 'fold'] as const, d.ears),
    tail: oneOf(m.tail, ['plume', 'curl', 'straight', 'stub'] as const, d.tail),
    coatStyle: oneOf(m.coatStyle, ['smooth', 'fluffy', 'curly'] as const, d.coatStyle),
    eye: col(m.eye, d.eye), nose: col(m.nose, d.nose),
    marks: sanitizeMarks(m.marks), socks: m.socks === true, blaze: m.blaze === true, tailTip: m.tailTip === true, browDots: m.browDots === true,
    headSize: num(m.headSize, 0.85, 1.2, 1), eyeSize: num(m.eyeSize, 0.8, 1.4, 1), eyeGap: num(m.eyeGap, 0.8, 1.3, 1), earSize: num(m.earSize, 0.7, 1.4, 1), noseSize: num(m.noseSize, 0.7, 1.5, 1),
    size: num(m.size, 0.7, 1.5, d.size), legs: num(m.legs, 0.6, 1.25, d.legs), chunk: num(m.chunk, 0.85, 1.3, d.chunk), snout: num(m.snout, 0.5, 1.5, d.snout),
  }
}

export function loadPet(): PetProfile {
  try { return sanitizePet(JSON.parse(localStorage.getItem(KEY) ?? 'null')) } catch { return DEFAULT_PET }
}
export function savePet(p: PetProfile) {
  try { localStorage.setItem(KEY, JSON.stringify(p)) } catch { /* ignore */ }
}
export function hasSavedPet(): boolean {
  try { return localStorage.getItem(KEY) !== null } catch { return false }
}

// ---- each memorial's dog (kept on this device, keyed by memorial id) and who is walking with the visitor ----
const PETS_KEY = 'dasi.pets', COMP_KEY = 'dasi.companion'
export function loadPets(): Record<string, PetProfile> {
  try {
    const raw = JSON.parse(localStorage.getItem(PETS_KEY) ?? '{}') as Record<string, unknown>
    const out: Record<string, PetProfile> = {}
    for (const k of Object.keys(raw)) out[k] = sanitizePet(raw[k])
    return out
  } catch { return {} }
}
export function savePets(p: Record<string, PetProfile>) {
  try { localStorage.setItem(PETS_KEY, JSON.stringify(p)) } catch { /* ignore */ }
}
export function loadCompanion(): string | null {
  try { return localStorage.getItem(COMP_KEY) } catch { return null }
}
export function saveCompanion(id: string | null) {
  try { if (id) localStorage.setItem(COMP_KEY, id); else localStorage.removeItem(COMP_KEY) } catch { /* ignore */ }
}
