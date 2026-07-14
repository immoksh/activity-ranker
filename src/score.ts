import { scoreWeekWithLlm } from './scoring/llm.js'
import { rankWeek } from './scoring/rank.js'
import { getDb } from './store/db.js'
import { loadLlmScores, saveLlmScores } from './store/scores.js'
import type { WeekForecast } from './forecast.js'
import type { ActivityRanking } from './scoring/rank.js'

export type Scorer = 'LLM' | 'BANDS'

export interface ScoredWeek {
  activities: ActivityRanking[]
  scoredBy: Scorer
}

const inFlight = new Map<string, Promise<ActivityRanking[]>>()

// The LLM decides scores when a key is configured; deterministic band scoring
// is the engine of record otherwise and the fallback when the model call or
// its output validation fails. LLM results are cached against the forecast
// snapshot, so OpenAI is hit once per city per refresh, not per request.
export async function scoreWeek(week: WeekForecast): Promise<ScoredWeek> {
  if (!process.env.OPENAI_API_KEY) {
    return { activities: rankWeek(week.days), scoredBy: 'BANDS' }
  }

  const db = getDb()
  const cached = loadLlmScores(db, week.place.id, week.fetchedAt)
  if (cached) return { activities: cached, scoredBy: 'LLM' }

  const key = `${week.place.id}:${week.fetchedAt}`
  try {
    let job = inFlight.get(key)
    if (!job) {
      job = scoreWeekWithLlm(week.place, week.days).finally(() => inFlight.delete(key))
      inFlight.set(key, job)
    }
    const activities = await job
    saveLlmScores(db, week.place.id, week.fetchedAt, activities)
    return { activities, scoredBy: 'LLM' }
  } catch (err) {
    console.error(`llm scoring failed for ${week.place.name}, serving band scores:`, err)
    return { activities: rankWeek(week.days), scoredBy: 'BANDS' }
  }
}
