import { fetchWeek, geocode } from './openmeteo.js'
import { getDb } from './store/db.js'
import { findPlace, loadWeek, savePlace, saveWeek } from './store/forecasts.js'
import type { StoredPlace } from './store/forecasts.js'
import type { DayWeather } from './types.js'

const TTL_HOURS = 6

export interface WeekForecast {
  place: StoredPlace
  days: DayWeather[]
  fetchedAt: string
  servedFrom: 'store' | 'api'
}

// Stored data counts as fresh while it is younger than the TTL *and* still
// starts on the current local date - a forecast fetched at 23:00 shouldn't be
// served after midnight with yesterday as its first day.
export function isFresh(
  fetchedAt: string,
  days: DayWeather[],
  timezone: string,
  now: Date,
): boolean {
  const ageMs = now.getTime() - Date.parse(fetchedAt)
  if (Number.isNaN(ageMs) || ageMs > TTL_HOURS * 3_600_000) return false
  return days[0]?.date === localDate(now, timezone)
}

function localDate(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(d)
}

const inFlight = new Map<string, Promise<WeekForecast | null>>()

export async function forecastFor(city: string): Promise<WeekForecast | null> {
  const query = city.trim().toLowerCase()
  if (!query) return null

  const running = inFlight.get(query)
  if (running) return running

  const job = resolveAndLoad(query).finally(() => inFlight.delete(query))
  inFlight.set(query, job)
  return job
}

async function resolveAndLoad(query: string): Promise<WeekForecast | null> {
  const db = getDb()
  const now = new Date()

  let place = findPlace(db, query)
  if (!place) {
    const hit = await geocode(query)
    if (!hit) return null
    place = savePlace(db, query, hit)
  }

  const stored = loadWeek(db, place.id)
  if (stored && isFresh(stored.fetchedAt, stored.days, place.timezone, now)) {
    return { place, days: stored.days, fetchedAt: stored.fetchedAt, servedFrom: 'store' }
  }

  const days = await fetchWeek(place.lat, place.lon)
  const fetchedAt = now.toISOString()
  saveWeek(db, place.id, days, fetchedAt)
  return { place, days, fetchedAt, servedFrom: 'api' }
}
