import type { Db } from './db.js'
import type { DayWeather, Place } from '../types.js'

export interface StoredPlace extends Place {
  id: number
}

export interface StoredWeek {
  days: DayWeather[]
  fetchedAt: string
}

interface PlaceRow {
  id: number
  name: string
  country: string
  lat: number
  lon: number
  timezone: string
}

interface DayRow {
  date: string
  temp_max: number
  temp_min: number
  precip_sum: number
  precip_prob: number | null
  snowfall_sum: number
  wind_max: number
  cloud_mean: number | null
  sunshine_hours: number | null
  wave_height_max: number | null
  fetched_at: string
}

export function findPlace(db: Db, query: string): StoredPlace | null {
  const row = db
    .prepare('SELECT id, name, country, lat, lon, timezone FROM places WHERE query = ?')
    .get(query) as PlaceRow | undefined
  return row ?? null
}

export function savePlace(db: Db, query: string, place: Place): StoredPlace {
  const result = db
    .prepare(
      `INSERT INTO places (query, name, country, lat, lon, timezone)
       VALUES (@query, @name, @country, @lat, @lon, @timezone)`,
    )
    .run({ query, ...place })
  return { id: Number(result.lastInsertRowid), ...place }
}

export function loadWeek(db: Db, placeId: number): StoredWeek | null {
  const rows = db
    .prepare('SELECT * FROM forecast_days WHERE place_id = ? ORDER BY date')
    .all(placeId) as DayRow[]
  const first = rows[0]
  if (!first) return null

  return {
    fetchedAt: first.fetched_at,
    days: rows.map((r) => ({
      date: r.date,
      tempMax: r.temp_max,
      tempMin: r.temp_min,
      precipSum: r.precip_sum,
      precipProb: r.precip_prob,
      snowfallSum: r.snowfall_sum,
      windMax: r.wind_max,
      cloudMean: r.cloud_mean,
      sunshineHours: r.sunshine_hours,
      waveHeightMax: r.wave_height_max,
    })),
  }
}

export function saveWeek(db: Db, placeId: number, days: DayWeather[], fetchedAt: string): void {
  const insert = db.prepare(
    `INSERT INTO forecast_days
       (place_id, date, temp_max, temp_min, precip_sum, precip_prob, snowfall_sum,
        wind_max, cloud_mean, sunshine_hours, wave_height_max, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )

  db.transaction(() => {
    db.prepare('DELETE FROM forecast_days WHERE place_id = ?').run(placeId)
    for (const d of days) {
      insert.run(
        placeId,
        d.date,
        d.tempMax,
        d.tempMin,
        d.precipSum,
        d.precipProb,
        d.snowfallSum,
        d.windMax,
        d.cloudMean,
        d.sunshineHours,
        d.waveHeightMax,
        fetchedAt,
      )
    }
  })()
}
