import { afterEach, describe, expect, it, vi } from 'vitest'
import { scoreWeek } from '../src/score.js'
import { parseLlmScores } from '../src/scoring/llm.js'
import type { WeekForecast } from '../src/forecast.js'
import type { DayWeather } from '../src/types.js'

const dates = ['2026-07-14', '2026-07-15']

function llmDay(date: string, score: number | null) {
  return { date, score, drivers: ['because'] }
}

function llmPayload() {
  return {
    activities: [
      { activity: 'SKIING', days: dates.map((d) => llmDay(d, 20)) },
      { activity: 'SURFING', days: dates.map((d) => llmDay(d, null)) },
      { activity: 'OUTDOOR_SIGHTSEEING', days: [llmDay(dates[0]!, 80), llmDay(dates[1]!, 40)] },
      { activity: 'INDOOR_SIGHTSEEING', days: dates.map((d) => llmDay(d, 65)) },
    ],
  }
}

describe('parseLlmScores', () => {
  it('accepts a complete payload and ranks the days itself', () => {
    const ranked = parseLlmScores(llmPayload(), dates)
    const outdoor = ranked.find((a) => a.activity === 'OUTDOOR_SIGHTSEEING')!
    expect(outdoor.days.map((d) => d.rank)).toEqual([1, 2])
    const surfing = ranked.find((a) => a.activity === 'SURFING')!
    expect(surfing.days.every((d) => d.score === null && d.rank === null)).toBe(true)
  })

  it('clamps scores the model pushes out of range', () => {
    const payload = llmPayload()
    payload.activities[0]!.days[0]!.score = 250
    const skiing = parseLlmScores(payload, dates).find((a) => a.activity === 'SKIING')!
    expect(skiing.days[0]?.score).toBe(100)
  })

  it('rejects a payload missing an activity', () => {
    const payload = llmPayload()
    payload.activities.pop()
    expect(() => parseLlmScores(payload, dates)).toThrow(/missing INDOOR_SIGHTSEEING/)
  })

  it('rejects a payload missing a date', () => {
    const payload = llmPayload()
    payload.activities[0]!.days.pop()
    expect(() => parseLlmScores(payload, dates)).toThrow(/missing 2026-07-15/)
  })
})

describe('scoreWeek engine choice', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('uses band scoring when no OpenAI key is configured', async () => {
    vi.stubEnv('OPENAI_API_KEY', '')
    const day: DayWeather = {
      date: dates[0]!,
      tempMax: 20,
      tempMin: 10,
      precipSum: 0,
      precipProb: 10,
      snowfallSum: 0,
      windMax: 10,
      cloudMean: 30,
      sunshineHours: 8,
      waveHeightMax: null,
    }
    const week: WeekForecast = {
      place: { id: 1, name: 'X', country: 'Y', lat: 0, lon: 0, timezone: 'UTC' },
      days: [day],
      fetchedAt: '2026-07-14T09:00:00Z',
      servedFrom: 'api',
    }

    const scored = await scoreWeek(week)
    expect(scored.scoredBy).toBe('BANDS')
    expect(scored.activities).toHaveLength(4)
  })
})
