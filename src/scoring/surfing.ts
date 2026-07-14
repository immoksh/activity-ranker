import { bandScore, toScore } from './scale.js'
import type { DayScore, DayWeather } from '../types.js'

// Rain is ignored on purpose: you're in the water anyway. Wind matters a lot
// (chop), waves matter most. Wave direction/period would be the next data to
// pull if this got serious.
const WEIGHTS = { wave: 0.6, wind: 0.25, temp: 0.15 }

export function scoreSurfDay(d: DayWeather): DayScore {
  if (d.waveHeightMax == null) {
    return { date: d.date, score: null, drivers: ['no wave data - not a coastal spot'] }
  }

  const wave = bandScore(d.waveHeightMax, 0.3, 1, 2.5, 5)
  const wind = bandScore(d.windMax, -1, 0, 20, 55)
  const temp = bandScore(d.tempMax, 5, 15, 30, 40)

  const drivers: string[] = []
  if (wave === 1) drivers.push(`clean swell ${d.waveHeightMax}m`)
  else if (d.waveHeightMax < 0.5) drivers.push(`flat (${d.waveHeightMax}m waves)`)
  else if (d.waveHeightMax >= 4) drivers.push(`heavy waves ${d.waveHeightMax}m`)
  if (wind <= 0.4) drivers.push(`choppy, wind ${d.windMax}km/h`)
  if (temp === 1 && wave >= 0.8) drivers.push('warm and surfable')

  return {
    date: d.date,
    score: toScore(wave * WEIGHTS.wave + wind * WEIGHTS.wind + temp * WEIGHTS.temp),
    drivers,
  }
}
