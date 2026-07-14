import { describe, expect, it } from 'vitest'
import { scoreIndoorDay } from '../src/scoring/indoor.js'
import { scoreOutdoorDay } from '../src/scoring/outdoor.js'
import { rankWeek } from '../src/scoring/rank.js'
import { scoreSkiDay } from '../src/scoring/skiing.js'
import { scoreSurfDay } from '../src/scoring/surfing.js'
import type { DayWeather } from '../src/types.js'

function day(overrides: Partial<DayWeather> = {}): DayWeather {
  return {
    date: '2026-07-14',
    tempMax: 20,
    tempMin: 10,
    precipSum: 0,
    precipProb: 10,
    snowfallSum: 0,
    windMax: 10,
    cloudMean: 30,
    sunshineHours: 8,
    waveHeightMax: null,
    ...overrides,
  }
}

const powderDay = day({ tempMax: -4, snowfallSum: 15, windMax: 8, cloudMean: 20 })
const icyGale = day({ tempMax: -18, snowfallSum: 0, windMax: 80, cloudMean: 90 })
const warmDrizzle = day({ tempMax: 15, snowfallSum: 0, precipProb: 70 })

describe('skiing', () => {
  it('prefers a calm powder day over an icy gale', () => {
    expect(scoreSkiDay(powderDay).score!).toBeGreaterThan(scoreSkiDay(icyGale).score!)
  })

  it('writes off warm rainy days', () => {
    expect(scoreSkiDay(warmDrizzle).score!).toBeLessThan(35)
  })

  it('names fresh snow as a driver when there is some', () => {
    expect(scoreSkiDay(powderDay).drivers.join()).toContain('fresh snow')
  })
})

describe('surfing', () => {
  it('is not applicable without wave data', () => {
    const inland = scoreSurfDay(day())
    expect(inland.score).toBeNull()
    expect(inland.drivers.join()).toContain('no wave data')
  })

  it('prefers a clean swell over storm surf', () => {
    const swell = scoreSurfDay(day({ waveHeightMax: 1.8, windMax: 10, tempMax: 24 }))
    const storm = scoreSurfDay(day({ waveHeightMax: 6, windMax: 60, tempMax: 24 }))
    expect(swell.score!).toBeGreaterThan(storm.score!)
  })

  it('scores a flat sea poorly even in perfect weather', () => {
    expect(scoreSurfDay(day({ waveHeightMax: 0.1, windMax: 5, tempMax: 26 })).score!).toBeLessThan(45)
  })
})

describe('outdoor sightseeing', () => {
  it('prefers mild and dry over cold and wet', () => {
    const mild = scoreOutdoorDay(day({ tempMax: 21, precipProb: 5, sunshineHours: 10 }))
    const wet = scoreOutdoorDay(day({ tempMax: 4, precipProb: 90, sunshineHours: 1 }))
    expect(mild.score!).toBeGreaterThan(wet.score!)
  })

  it('falls back to precipitation amount when probability is missing', () => {
    const dry = scoreOutdoorDay(day({ precipProb: null, precipSum: 0 }))
    const soaked = scoreOutdoorDay(day({ precipProb: null, precipSum: 20 }))
    expect(dry.score!).toBeGreaterThan(soaked.score!)
  })
})

describe('indoor sightseeing', () => {
  it('gets more attractive as the weather outside gets worse', () => {
    const grim = scoreIndoorDay(day(), 10)
    const glorious = scoreIndoorDay(day(), 95)
    expect(grim.score!).toBeGreaterThan(glorious.score!)
    expect(glorious.score!).toBeGreaterThanOrEqual(60)
  })
})

describe('rankWeek', () => {
  const week = [
    day({ date: '2026-07-14', tempMax: 21, precipProb: 5 }),
    day({ date: '2026-07-15', tempMax: 6, precipProb: 90, sunshineHours: 1 }),
    day({ date: '2026-07-16', tempMax: 19, precipProb: 20 }),
  ]

  it('ranks the best outdoor day first and keeps days chronological', () => {
    const outdoor = rankWeek(week).find((a) => a.activity === 'OUTDOOR_SIGHTSEEING')!
    expect(outdoor.days.map((d) => d.date)).toEqual(['2026-07-14', '2026-07-15', '2026-07-16'])
    expect(outdoor.days[0]?.rank).toBe(1)
    expect(outdoor.days[1]?.rank).toBe(3)
  })

  it('leaves surfing unranked when there is no wave data', () => {
    const surfing = rankWeek(week).find((a) => a.activity === 'SURFING')!
    expect(surfing.days.every((d) => d.score === null && d.rank === null)).toBe(true)
  })

  it('covers all four activities', () => {
    expect(rankWeek(week).map((a) => a.activity)).toEqual([
      'SKIING',
      'SURFING',
      'OUTDOOR_SIGHTSEEING',
      'INDOOR_SIGHTSEEING',
    ])
  })
})
