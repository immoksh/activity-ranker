import type { DayWeather, Place } from './types.js'

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine'

const DAILY_VARS = [
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
  'precipitation_probability_max',
  'snowfall_sum',
  'wind_speed_10m_max',
  'cloud_cover_mean',
  'sunshine_duration',
].join(',')

export class UpstreamError extends Error {}

interface GeocodeResponse {
  results?: Array<{
    name: string
    country?: string
    latitude: number
    longitude: number
    timezone: string
  }>
}

interface DailyForecast {
  time: string[]
  temperature_2m_max: number[]
  temperature_2m_min: number[]
  precipitation_sum: number[]
  precipitation_probability_max: (number | null)[]
  snowfall_sum: number[]
  wind_speed_10m_max: number[]
  cloud_cover_mean: (number | null)[]
  sunshine_duration: (number | null)[]
}

interface MarineDaily {
  time: string[]
  wave_height_max: (number | null)[]
}

async function getJson<T>(url: URL): Promise<T> {
  let res: Response
  try {
    res = await fetch(url)
  } catch (err) {
    throw new UpstreamError(`open-meteo unreachable: ${(err as Error).message}`)
  }
  if (!res.ok) {
    throw new UpstreamError(`open-meteo responded ${res.status} for ${url.pathname}`)
  }
  return res.json() as Promise<T>
}

export async function geocode(city: string): Promise<Place | null> {
  const url = new URL(GEOCODE_URL)
  url.searchParams.set('name', city)
  url.searchParams.set('count', '1')
  url.searchParams.set('language', 'en')

  const body = await getJson<GeocodeResponse>(url)
  const hit = body.results?.[0]
  if (!hit) return null

  return {
    name: hit.name,
    country: hit.country ?? '',
    lat: hit.latitude,
    lon: hit.longitude,
    timezone: hit.timezone,
  }
}

async function fetchDaily(lat: number, lon: number): Promise<DailyForecast> {
  const url = new URL(FORECAST_URL)
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lon))
  url.searchParams.set('daily', DAILY_VARS)
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('forecast_days', '7')

  const body = await getJson<{ daily: DailyForecast }>(url)
  return body.daily
}

// The marine API only covers ocean grid points; treat "no data" as
// "not a coastal place" rather than an error.
async function fetchWaves(lat: number, lon: number): Promise<MarineDaily | null> {
  const url = new URL(MARINE_URL)
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lon))
  url.searchParams.set('daily', 'wave_height_max')
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('forecast_days', '7')

  try {
    const body = await getJson<{ daily: MarineDaily }>(url)
    return body.daily
  } catch {
    return null
  }
}

export async function fetchWeek(lat: number, lon: number): Promise<DayWeather[]> {
  const [daily, waves] = await Promise.all([fetchDaily(lat, lon), fetchWaves(lat, lon)])

  const waveByDate = new Map<string, number | null>()
  waves?.time.forEach((date, i) => waveByDate.set(date, waves.wave_height_max[i] ?? null))

  return daily.time.map((date, i) => ({
    date,
    tempMax: daily.temperature_2m_max[i] ?? 0,
    tempMin: daily.temperature_2m_min[i] ?? 0,
    precipSum: daily.precipitation_sum[i] ?? 0,
    precipProb: daily.precipitation_probability_max[i] ?? null,
    snowfallSum: daily.snowfall_sum[i] ?? 0,
    windMax: daily.wind_speed_10m_max[i] ?? 0,
    cloudMean: daily.cloud_cover_mean[i] ?? null,
    sunshineHours: secondsToHours(daily.sunshine_duration[i]),
    waveHeightMax: waveByDate.get(date) ?? null,
  }))
}

function secondsToHours(seconds: number | null | undefined): number | null {
  return seconds == null ? null : Math.round((seconds / 3600) * 10) / 10
}
