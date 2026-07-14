import type { DayScore, DayWeather } from '../types.js'

// A museum is never a bad idea, just a better one when it's grim outside.
// Baseline 60, climbing towards 95 as the outdoor score drops.
export function scoreIndoorDay(d: DayWeather, outdoorScore: number): DayScore {
  const score = Math.min(95, Math.round(60 + (100 - outdoorScore) * 0.35))

  const drivers: string[] = []
  if (outdoorScore <= 40) drivers.push('poor weather outside - a good day for it')
  else if (outdoorScore >= 70) drivers.push('fine, but it would be a shame to stay in')
  else drivers.push('solid option')

  return { date: d.date, score, drivers }
}
