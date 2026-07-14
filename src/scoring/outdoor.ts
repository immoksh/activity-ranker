import { bandScore, toScore } from './scale.js'
import type { DayScore, DayWeather } from '../types.js'

const WEIGHTS = { dry: 0.35, temp: 0.3, sun: 0.2, wind: 0.15 }

export function scoreOutdoorDay(d: DayWeather): DayScore {
  // Fall back to precipitation amount when the probability is missing.
  const rainRisk = d.precipProb != null ? d.precipProb / 100 : Math.min(d.precipSum / 10, 1)
  const dry = 1 - rainRisk
  const temp = bandScore(d.tempMax, 0, 16, 24, 35)
  const wind = bandScore(d.windMax, -1, 0, 20, 60)
  const sun =
    d.sunshineHours != null
      ? Math.min(d.sunshineHours / 10, 1)
      : d.cloudMean != null
        ? 1 - d.cloudMean / 100
        : 0.5

  const drivers: string[] = []
  if (rainRisk >= 0.6) drivers.push(`likely rain (${Math.round(rainRisk * 100)}%)`)
  else if (rainRisk <= 0.2 && sun >= 0.7) drivers.push('dry and sunny')
  if (temp === 1) drivers.push('comfortable temperature')
  else if (d.tempMax >= 32) drivers.push(`hot (${d.tempMax}°C)`)
  else if (d.tempMax <= 5) drivers.push(`cold (${d.tempMax}°C)`)
  if (wind <= 0.4) drivers.push(`windy ${d.windMax}km/h`)

  return {
    date: d.date,
    score: toScore(
      dry * WEIGHTS.dry + temp * WEIGHTS.temp + sun * WEIGHTS.sun + wind * WEIGHTS.wind,
    ),
    drivers,
  }
}
