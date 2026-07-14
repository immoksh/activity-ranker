# Decisions log

Running notes on the calls made while building this, in the order they came up.
Where the brief left something open, the PM question and the assumption I went
with are noted here.

## 1. What does "rank the next 7 days" mean?

**Question for PM:** rank days within an activity, or rank activities within a day?

**Call:** score every day 0–100 for every activity, then rank days within each
activity. That answers "when should I ski this week?" directly, and a client can
still compare activities on a given day since all four scores are on the same scale.

## 2. Stack

- **graphql-yoga** over Apollo Server — smaller, spec-compliant, no plugin
  ceremony needed at this size.
- **SQLite (better-sqlite3)** for storage — the brief wants weather persisted,
  not a distributed system. Zero-ops, survives restarts, relational shape fits
  one-row-per-day forecasts. In production this becomes Postgres, with Redis in
  front if read volume justified it.
- **No ORM** — a thin module with plain SQL is easier to read at this scale.
- **tsx, no build step** — this is a service you run, not a library you ship.

## 3. Persistence / refresh policy

The DB *is* the cache. Each stored forecast carries `fetched_at` and a ~6 hour
TTL — Open-Meteo re-runs its models every few hours, so fetching more often
buys nothing.

Read path: fresh rows → serve from DB; stale or missing → fetch, upsert, serve.
Lazy refresh only, no background jobs. Trade-off: the first request after expiry
pays the upstream latency. The evolution would be stale-while-revalidate, which
wasn't worth the complexity here.

Concurrent requests for the same city share one in-flight fetch rather than
each hitting the API.

## 4. City resolution

Open-Meteo's geocoding API, take the top match. The response includes the
*resolved* place (name, country, coordinates) so an ambiguous query is at least
visible to the caller. **PM question:** should ambiguous names return candidates
to choose from? Assumed top-match is fine for v1.

Geocoding results are cached indefinitely — coordinates don't move.

## 5. Skiing and surfing depend on terrain, not just weather

A weather API can't tell you whether there's a ski hill or a beach. Assumption:
scores mean *weather suitability* — "if you can surf near this place, how good
is Tuesday" — not "this town has surfing."

One honest signal comes free: if the marine API has no data for the coordinates,
surfing returns null ("not applicable") instead of a made-up number.

## 6. Daily aggregates, not hourly data

Ranking whole days only needs daily summaries, and Open-Meteo computes
min/max/mean aggregates server-side (`temperature_2m_max`, `snowfall_sum`,
`cloud_cover_mean`, ...). Pulling hourly would 24x the stored data to recompute
numbers the API already provides. If the product later wants "best time of
day", that's the point to switch.

Probed the live API before committing to the shape: inland places (Innsbruck)
get `null` from the marine API, coastal ones (Lisbon) get wave heights — which
confirms the "null waves ⇒ surfing not applicable" plan in #5.

## 7. Indoor sightseeing is relative

Rain doesn't ruin a museum. Indoor gets a solid baseline that rises as outdoor
conditions get worse — it's the fallback recommendation, and the scoring encodes
that rather than pretending indoor quality depends on weather directly.
