import { startAudio } from './audio'
import { useStore } from './store'
import { game } from '../world/game'

/** Start the 3D island (after the character has been chosen). */
export function enterWorld() {
  startAudio()
  game.introT = 0
  game.camFocus = null
  useStore.getState().set({ screen: 'world', phase: 'intro', splash: true })
}
