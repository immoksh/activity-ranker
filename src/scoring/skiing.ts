import { bandScore, toScore } from './scale.js'
import type { DayScore, DayWeather } from '../types.js'

// Fresh snowfall is the strongest signal we have without slope/base data.
// A cold, calm, clear day with no new snow still scores as "fair" through
// the temperature/wind/sky components.
const WEIGHTS = { snow: 0.45, temp: 0.3, wind: 0.15, sky: 0.1 }

export function scoreSkiDay(d: DayWeather): DayScore {
  const snow = bandScore(d.snowfallSum, 0, 5, 30, 60)
  const temp = bandScore(d.tempMax, -25, -12, 0, 8)
  const wind = bandScore(d.windMax, -1, 0, 25, 70)
  const sky = d.cloudMean == null ? 0.5 : 1 - d.cloudMean / 100

  const drivers: string[] = []
  if (d.snowfallSum >= 5) drivers.push(`fresh snow ${d.snowfallSum}cm`)
  else if (d.snowfallSum < 1) drivers.push('no fresh snow')
  if (d.tempMax > 8) drivers.push(`too warm to hold snow (${d.tempMax}°C)`)
  else if (temp === 1) drivers.push('ideal skiing temperature')
  if (wind <= 0.4) drivers.push(`strong wind ${d.windMax}km/h`)
  if (sky >= 0.8 && d.snowfallSum < 5) drivers.push('clear visibility')

  return {
    date: d.date,
    score: toScore(
      snow * WEIGHTS.snow + temp * WEIGHTS.temp + wind * WEIGHTS.wind + sky * WEIGHTS.sky,
    ),
    drivers,
  }
}
