import OpenAI from 'openai'
import { rankDays } from './rank.js'
import type { Activity, ActivityRanking } from './rank.js'
import type { DayScore, DayWeather, Place } from '../types.js'

const ACTIVITIES: Activity[] = ['SKIING', 'SURFING', 'OUTDOOR_SIGHTSEEING', 'INDOOR_SIGHTSEEING']

const PROMPT = `You rate how good each day of a weather forecast is for four
activities: skiing, surfing, outdoor sightseeing, indoor sightseeing.

- score: integer 0-100. Be opinionated, use the whole range.
- Cover every date you are given, once, for all four activities.
- waveHeightMax null means no usable coast: surfing score must be null and its
  driver should say so. Never invent waves.
- Indoor sightseeing is never ruined by weather; it gets more attractive the
  worse it is outside, but stays around 60 even on glorious days.
- Skiing wants fresh snow and cold; surfing wants roughly 1-2.5m waves and
  light wind; outdoor sightseeing wants dry, mild, some sun.
- drivers: 1-3 short phrases naming what drove the score, with numbers
  ("fresh snow 15cm", "likely rain 90%"). No full sentences.

Units: °C, km/h, mm, cm (snowfall), m (waves), hours (sunshine).`

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['activities'],
  properties: {
    activities: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['activity', 'days'],
        properties: {
          activity: { type: 'string', enum: ACTIVITIES },
          days: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['date', 'score', 'drivers'],
              properties: {
                date: { type: 'string' },
                score: { type: ['integer', 'null'] },
                drivers: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
      },
    },
  },
}

interface LlmWeek {
  activities: Array<{
    activity: string
    days: Array<{ date: string; score: number | null; drivers: string[] }>
  }>
}

export async function scoreWeekWithLlm(
  place: Place,
  days: DayWeather[],
): Promise<ActivityRanking[]> {
  const client = new OpenAI()
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? 'gpt-5-mini',
    messages: [
      { role: 'system', content: PROMPT },
      {
        role: 'user',
        content: JSON.stringify({ place: { name: place.name, country: place.country }, days }),
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'week_scores', strict: true, schema: RESPONSE_SCHEMA },
    },
  })

  const raw = completion.choices[0]?.message.content
  if (!raw) throw new Error('empty completion from the model')

  return parseLlmScores(
    JSON.parse(raw),
    days.map((d) => d.date),
  )
}

// The model's output is untrusted input: require every activity and every
// date, clamp scores, and let the caller fall back to band scoring on any
// violation. Ranks are always computed here, never taken from the model.
export function parseLlmScores(raw: unknown, dates: string[]): ActivityRanking[] {
  const week = raw as LlmWeek
  if (!Array.isArray(week?.activities)) throw new Error('llm output has no activities array')

  return ACTIVITIES.map((activity) => {
    const entry = week.activities.find((a) => a.activity === activity)
    if (!entry) throw new Error(`llm output is missing ${activity}`)

    const byDate = new Map(entry.days.map((d) => [d.date, d]))
    const scored: DayScore[] = dates.map((date) => {
      const d = byDate.get(date)
      if (!d) throw new Error(`llm output is missing ${date} for ${activity}`)
      return {
        date,
        score: d.score == null ? null : Math.max(0, Math.min(100, Math.round(d.score))),
        drivers: Array.isArray(d.drivers) ? d.drivers.map(String).slice(0, 3) : [],
      }
    })

    return { activity, days: rankDays(scored) }
  })
}
