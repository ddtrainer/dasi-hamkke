// Some phone webviews reload the page while the photo picker / camera is open (the app is sent to the background and the
// page is evicted). Keep just enough state to come back exactly where the visitor was instead of the home screen.
import { game } from '../world/game'

const KEY = 'dasi.resume'
const TTL = 15 * 60 * 1000

export interface Draft { petName: string; species: string; birthDate: string; passedDate: string; message: string; visibility: 'public' | 'private' }
export interface Resume {
  t: number
  screen: 'landing' | 'world' | 'flat'
  reg: boolean
  regSlot: number | null
  pos: { x: number; y: number; z: number }
  heading: number
  draft: Draft | null
}

/** form text typed so far (also saved, so it survives a reload) */
export const resume = { draft: null as Draft | null }

function read(): Resume | null {
  for (const st of [() => sessionStorage, () => localStorage]) {
    try {
      const raw = st().getItem(KEY)
      if (!raw) continue
      const r = JSON.parse(raw) as Resume
      if (Date.now() - r.t < TTL) return r
    } catch { /* storage blocked */ }
  }
  return null
}
export function write(r: Omit<Resume, 't'>) {
  const s = JSON.stringify({ ...r, t: Date.now() })
  try { sessionStorage.setItem(KEY, s) } catch { /* ignore */ }
  try { localStorage.setItem(KEY, s) } catch { /* ignore */ }
}

/** state found at start-up (null on a normal fresh visit) */
export const resumed: Resume | null = typeof window !== 'undefined' ? read() : null
if (resumed && resumed.screen === 'world') {
  game.pos.x = resumed.pos.x; game.pos.y = resumed.pos.y; game.pos.z = resumed.pos.z; game.heading = resumed.heading
}
if (resumed?.draft) resume.draft = resumed.draft
