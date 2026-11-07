// "숨핏 펄스" step-peak detector, ported from soomfit-21day (app-src/template.html).
// Counts footfall peaks of |acceleration| - gravity: a peak must rise high enough above the previous valley, keep a minimum gap
// from the last peak, and three peaks in a steady rhythm are needed before counting starts (the first three are counted retroactively).
export const GRAV = 9.81
export const PULSE_CFG = { walk: { amp: 1.8, gap: 330 }, slow: { amp: 2.6, gap: 240 }, interval: { amp: 3.0, gap: 180 } }
const RHYTHM_MAX_GAP = 1800, RHYTHM_WARMUP = 3

export function makePulseDetector(amp: number, minGap: number) {
  let ema = 0, init = false, prev = -Infinity, rising = false, valley = Infinity, lastPeak = -Infinity, streak = 0, pending = 0
  return {
    /** dyn = |a| - gravity (m/s²), ts in ms. Returns how many pulses to add now. */
    add(dyn: number, ts: number): number {
      ema = init ? ema * 0.4 + dyn * 0.6 : dyn; init = true
      const v = ema
      if (v < valley) valley = v
      if (v > prev) rising = true
      else if (v < prev && rising) {
        rising = false
        const prom = prev - valley
        if (prom >= amp && ts - lastPeak >= minGap) {
          const gap = ts - lastPeak
          if (gap <= RHYTHM_MAX_GAP) streak++; else { streak = 1; pending = 0 }
          pending++; lastPeak = ts; valley = v
          if (streak >= RHYTHM_WARMUP) { const n = pending; pending = 0; prev = v; return n }
        }
      }
      prev = v
      return 0
    },
  }
}
