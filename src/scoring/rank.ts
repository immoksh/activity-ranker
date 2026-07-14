import { scoreIndoorDay } from './indoor.js'
import { scoreOutdoorDay } from './outdoor.js'
import { scoreSkiDay } from './skiing.js'
import { scoreSurfDay } from './surfing.js'
import type { DayScore, DayWeather } from '../types.js'

export type Activity = 'SKIING' | 'SURFING' | 'OUTDOOR_SIGHTSEEING' | 'INDOOR_SIGHTSEEING'

export interface RankedDay extends DayScore {
  rank: number | null
}

export interface ActivityRanking {
  activity: Activity
  days: RankedDay[]
}

export function rankWeek(days: DayWeather[]): ActivityRanking[] {
  const outdoor = days.map(scoreOutdoorDay)
  const indoor = days.map((d, i) => scoreIndoorDay(d, outdoor[i]?.score ?? 50))

  return [
    { activity: 'SKIING', days: rankDays(days.map(scoreSkiDay)) },
    { activity: 'SURFING', days: rankDays(days.map(scoreSurfDay)) },
    { activity: 'OUTDOOR_SIGHTSEEING', days: rankDays(outdoor) },
    { activity: 'INDOOR_SIGHTSEEING', days: rankDays(indoor) },
  ]
}

// Rank 1 = best day of the week for that activity. Days without a score
// (surfing inland) stay unranked. Order of the returned array is unchanged -
// it's still chronological.
export function rankDays(scored: DayScore[]): RankedDay[] {
  const order = scored
    .filter((s) => s.score != null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .map((s) => s.date)

  return scored.map((s) => ({
    ...s,
    rank: s.score == null ? null : order.indexOf(s.date) + 1,
  }))
}
