import { useStore } from './store'
import { game } from '../world/game'

// Greeting notifications: the same sender is counted once a minute, and several greetings in a row are merged into one note.
const lastFrom = new Map<string, number>()
let dismissT: number | undefined
const MERGE_MS = 5000, SAME_SENDER_MS = 60000, SHOW_MS = 7000

export function receiveGreet(id: string, name: string) {
  const now = performance.now()
  const prev = lastFrom.get(id)
  if (prev !== undefined && now - prev < SAME_SENDER_MS) return
  lastFrom.set(id, now)
  const st = useStore.getState()
  const cur = st.greetNote
  const merge = cur && now - cur.t < MERGE_MS
  const ids = merge ? [...new Set([...cur.ids, id])] : [id]
  const names = merge ? [...new Set([...cur.names, name])] : [name]
  const text = ids.length === 1 ? `${names[0]}님이 인사했어요 👋` : `${ids.length}명이 인사했어요 👋`
  st.set({ greetNote: { ids, names, text, t: now } })
  clearTimeout(dismissT)
  dismissT = window.setTimeout(() => useStore.getState().set({ greetNote: null }), SHOW_MS)
}

export function dismissGreet() { clearTimeout(dismissT); useStore.getState().set({ greetNote: null }) }

/** one tap answers everyone in the note (a wave back; no text) */
export async function replyGreet() {
  const note = useStore.getState().greetNote
  if (!note) return
  const { greetNeighbor } = await import('../world/visitors')
  note.ids.forEach((id) => greetNeighbor(id, true))
  game.treatUntil = Math.max(game.treatUntil, game.time + 2.2)
  dismissGreet()
}
