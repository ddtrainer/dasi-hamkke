import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { game, FEED_LEN } from './game'
import { chime } from '../lib/audio'
import { useStore } from '../lib/store'

const cache = new Map<string, THREE.CanvasTexture>()
function emoji(ch: string) {
  let t = cache.get(ch)
  if (!t) {
    const c = document.createElement('canvas'); c.width = c.height = 128
    const g = c.getContext('2d')!
    g.font = '96px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillText(ch, 64, 70)
    t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
    cache.set(ch, t)
  }
  return t
}
const HEARTS = 5

/** The snack held out, nibbled bite by bite, and hearts floating up while the dog eats. */
export function FeedFx() {
  const snack = useRef<THREE.Sprite>(null!)
  const hearts = useRef<THREE.Sprite[]>([])
  const heartTex = useMemo(() => emoji('💕'), [])
  const lastIcon = useRef('')
  const done = useRef(false)
  useFrame((_, dtRaw) => {
    const f = game.feed
    if (f.t < 0) { snack.current.visible = false; hearts.current.forEach((h) => { h.visible = false }); done.current = false; return }
    f.t += Math.min(dtRaw, 0.05)
    if (f.t > FEED_LEN) { f.t = -1; game.treatUntil = game.time + 1.6; chime(); useStore.getState().say('냠냠, 맛있게 먹었어요 💕'); return }
    const p = game.pos, d = game.dog, h = game.heading, t = f.t
    if (lastIcon.current !== f.icon) { lastIcon.current = f.icon; snack.current.material.map = emoji(f.icon); snack.current.material.needsUpdate = true }
    // 0 – 1.4 s held out in the hand; then it is lowered to the dog's mouth and eaten in a few bites
    const grab = Math.min(1, Math.max(0, (t - 1.2) / 0.5))
    const hx = p.x + Math.sin(h) * 0.5 - Math.cos(h) * 0.3, hy = p.y + 0.95, hz = p.z + Math.cos(h) * 0.5 + Math.sin(h) * 0.3
    const toP = Math.atan2(p.x - d.x, p.z - d.z)
    const mx = d.x + Math.sin(toP) * 0.22, my = d.y + 0.3, mz = d.z + Math.cos(toP) * 0.22
    snack.current.position.set(hx + (mx - hx) * grab, hy + (my - hy) * grab, hz + (mz - hz) * grab)
    const bites = t < 1.7 ? 1 : Math.max(0, 1 - (t - 1.7) / 1.7)
    const bite = Math.floor(bites * 4) / 4 // steps: it gets smaller with every bite
    snack.current.scale.setScalar(0.5 * (0.15 + 0.85 * bite) * (1 + 0.08 * Math.sin(t * 18)))
    snack.current.visible = bites > 0.02
    for (let i = 0; i < HEARTS; i++) {
      const s = hearts.current[i]; if (!s) continue
      const age = t - (1.7 + i * 0.38)
      if (age < 0 || age > 1.3) { s.visible = false; continue }
      s.visible = true
      s.position.set(d.x + Math.sin(i * 2.1 + t * 2) * 0.25, d.y + 0.6 + age * 0.9, d.z + Math.cos(i * 2.1 + t * 2) * 0.25)
      s.scale.setScalar(0.32 * Math.min(1, age * 5)); s.material.opacity = Math.min(1, (1.3 - age) * 1.5)
    }
  })
  return (
    <>
      <sprite ref={snack} visible={false}><spriteMaterial transparent depthWrite={false} /></sprite>
      {Array.from({ length: HEARTS }, (_, i) => (
        <sprite key={i} ref={(s) => { if (s) hearts.current[i] = s }} visible={false}><spriteMaterial map={heartTex} transparent depthWrite={false} /></sprite>
      ))}
    </>
  )
}
