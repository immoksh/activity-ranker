export interface Place {
  name: string
  country: string
  lat: number
  lon: number
  timezone: string
}

export interface DayScore {
  date: string
  score: number | null
  drivers: string[]
}

export interface DayWeather {
  date: string
  tempMax: number
  tempMin: number
  precipSum: number
  precipProb: number | null
  snowfallSum: number
  windMax: number
  cloudMean: number | null
  sunshineHours: number | null
  waveHeightMax: number | null
}
