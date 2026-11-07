// Fully procedural audio (no asset files): waves, wind, birds, footsteps, soft music.
let ctx: AudioContext | null = null
let master: GainNode
let ambient: GainNode
let musicGain: GainNode
let sfxOn = true
let musicTimer: number | undefined
let birdTimer: number | undefined
let noiseBuf: AudioBuffer

function noise(c: AudioContext) {
  if (noiseBuf) return noiseBuf
  noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate)
  const d = noiseBuf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return noiseBuf
}
function loopNoise(c: AudioContext, freq: number, q: number, gain: number, lfoHz: number, lfoDepth: number) {
  const src = c.createBufferSource(); src.buffer = noise(c); src.loop = true
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; f.Q.value = q
  const g = c.createGain(); g.gain.value = gain
  const lfo = c.createOscillator(); lfo.frequency.value = lfoHz
  const lg = c.createGain(); lg.gain.value = lfoDepth
  lfo.connect(lg).connect(g.gain)
  src.connect(f).connect(g).connect(ambient)
  src.start(); lfo.start()
}

export function startAudio() {
  if (ctx) { void ctx.resume(); return }
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  if (!AC) return
  ctx = new AC()
  master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination)
  ambient = ctx.createGain(); ambient.gain.value = sfxOn ? 1 : 0; ambient.connect(master)
  musicGain = ctx.createGain(); musicGain.gain.value = 0; musicGain.connect(master)
  loopNoise(ctx, 500, 0.5, 0.09, 0.11, 0.06) // waves
  loopNoise(ctx, 900, 0.8, 0.03, 0.05, 0.02) // wind
  const bird = () => {
    if (!ctx) return
    if (sfxOn && Math.random() < 0.8) {
      const n = 2 + Math.floor(Math.random() * 3)
      const base = 2200 + Math.random() * 1600
      for (let i = 0; i < n; i++) {
        const t = ctx.currentTime + i * 0.13
        const o = ctx.createOscillator(); o.type = 'sine'
        o.frequency.setValueAtTime(base, t); o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.4), t + 0.09)
        const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.025, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.11)
        o.connect(g).connect(ambient); o.start(t); o.stop(t + 0.13)
      }
    }
    birdTimer = window.setTimeout(bird, 2500 + Math.random() * 6000)
  }
  bird()
}
export function setSfx(on: boolean) { sfxOn = on; if (ctx) ambient.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.2) }
export function footstep(run: boolean) {
  if (!ctx || !sfxOn) return
  const c = ctx
  const src = c.createBufferSource(); src.buffer = noise(c)
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500 + Math.random() * 300; f.Q.value = 0.9
  const g = c.createGain(); const t = c.currentTime
  g.gain.setValueAtTime(run ? 0.13 : 0.09, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09)
  src.connect(f).connect(g).connect(master); src.start(t, Math.random(), 0.1)
}
export function chime() {
  if (!ctx || !sfxOn) return
  const c = ctx
  ;[784, 988, 1175].forEach((fq, i) => {
    const t = c.currentTime + i * 0.12
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = fq
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0005, t + 1.4)
    o.connect(g).connect(master); o.start(t); o.stop(t + 1.5)
  })
}
export function setMusic(on: boolean) {
  if (!ctx) return
  musicGain.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.6)
  clearTimeout(musicTimer)
  if (!on) return
  const scale = [261.6, 293.7, 329.6, 392, 440, 523.3, 392, 329.6]
  let i = 0
  const play = () => {
    if (!ctx) return
    const fq = scale[(i++ * 3 + Math.floor(Math.random() * 2)) % scale.length] * (Math.random() < 0.25 ? 2 : 1)
    const t = ctx.currentTime
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = fq
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0005, t + 3.2)
    o.connect(g).connect(musicGain); o.start(t); o.stop(t + 3.3)
    musicTimer = window.setTimeout(play, 900 + Math.random() * 1400)
  }
  play()
}
export function stopAudio() { clearTimeout(musicTimer); clearTimeout(birdTimer); void ctx?.suspend() }
