import type { Db } from './db.js'
import type { ActivityRanking } from '../scoring/rank.js'

// LLM scores are keyed by the forecast snapshot they were derived from, so a
// refreshed forecast automatically invalidates them.
export function loadLlmScores(
  db: Db,
  placeId: number,
  fetchedAt: string,
): ActivityRanking[] | null {
  const row = db
    .prepare('SELECT payload FROM llm_scores WHERE place_id = ? AND fetched_at = ?')
    .get(placeId, fetchedAt) as { payload: string } | undefined
  return row ? (JSON.parse(row.payload) as ActivityRanking[]) : null
}

export function saveLlmScores(
  db: Db,
  placeId: number,
  fetchedAt: string,
  activities: ActivityRanking[],
): void {
  db.transaction(() => {
    db.prepare('DELETE FROM llm_scores WHERE place_id = ?').run(placeId)
    db.prepare('INSERT INTO llm_scores (place_id, fetched_at, payload) VALUES (?, ?, ?)').run(
      placeId,
      fetchedAt,
      JSON.stringify(activities),
    )
  })()
}
