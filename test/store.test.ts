import { describe, expect, it } from 'vitest'
import { isFresh } from '../src/forecast.js'
import { openDb } from '../src/store/db.js'
import { findPlace, loadWeek, savePlace, saveWeek } from '../src/store/forecasts.js'
import type { DayWeather } from '../src/types.js'

function day(date: string, overrides: Partial<DayWeather> = {}): DayWeather {
  return {
    date,
    tempMax: 20,
    tempMin: 10,
    precipSum: 0,
    precipProb: 10,
    snowfallSum: 0,
    windMax: 12,
    cloudMean: 40,
    sunshineHours: 8,
    waveHeightMax: null,
    ...overrides,
  }
}

describe('isFresh', () => {
  const noon = new Date('2026-07-14T12:00:00Z')
  const week = [day('2026-07-14'), day('2026-07-15')]

  it('accepts data fetched within the TTL starting today', () => {
    expect(isFresh('2026-07-14T09:00:00Z', week, 'UTC', noon)).toBe(true)
  })

  it('rejects data older than the TTL', () => {
    expect(isFresh('2026-07-14T05:00:00Z', week, 'UTC', noon)).toBe(false)
  })

  it('rejects data whose first day rolled into yesterday', () => {
    const lateNight = new Date('2026-07-15T01:00:00Z')
    expect(isFresh('2026-07-14T23:00:00Z', week, 'UTC', lateNight)).toBe(false)
  })

  it('uses the place timezone for the date rollover, not UTC', () => {
    // 01:00 UTC on the 15th is still the evening of the 14th in New York.
    const lateNight = new Date('2026-07-15T01:00:00Z')
    expect(isFresh('2026-07-14T23:00:00Z', week, 'America/New_York', lateNight)).toBe(true)
  })
})

describe('forecast store', () => {
  it('round-trips a place and its week', () => {
    const db = openDb(':memory:')
    const place = savePlace(db, 'innsbruck', {
      name: 'Innsbruck',
      country: 'Austria',
      lat: 47.26,
      lon: 11.39,
      timezone: 'Europe/Vienna',
    })

    expect(findPlace(db, 'innsbruck')?.id).toBe(place.id)
    expect(findPlace(db, 'nowhere')).toBeNull()

    const week = [day('2026-07-14', { snowfallSum: 3.2 }), day('2026-07-15')]
    saveWeek(db, place.id, week, '2026-07-14T09:00:00Z')

    const stored = loadWeek(db, place.id)
    expect(stored?.fetchedAt).toBe('2026-07-14T09:00:00Z')
    expect(stored?.days).toEqual(week)
  })

  it('replaces the previous week on refresh instead of accumulating rows', () => {
    const db = openDb(':memory:')
    const place = savePlace(db, 'lisbon', {
      name: 'Lisbon',
      country: 'Portugal',
      lat: 38.72,
      lon: -9.14,
      timezone: 'Europe/Lisbon',
    })

    saveWeek(db, place.id, [day('2026-07-14')], '2026-07-14T09:00:00Z')
    saveWeek(db, place.id, [day('2026-07-15')], '2026-07-15T09:00:00Z')

    const stored = loadWeek(db, place.id)
    expect(stored?.days.map((d) => d.date)).toEqual(['2026-07-15'])
    expect(stored?.fetchedAt).toBe('2026-07-15T09:00:00Z')
  })
})
