# activity-ranker

GraphQL service that takes a city or town and ranks how good each of the next
7 days will be for skiing, surfing, outdoor sightseeing and indoor
sightseeing. Weather comes from Open-Meteo and is persisted in SQLite rather
than fetched per request.

## Run it

```
npm install
npm start        # GraphQL at http://localhost:4000/graphql
```

```
npm test         # scoring + freshness policy tests
npm run typecheck
```

Node 20+. Runs without any keys — Open-Meteo is keyless and scoring falls
back to the deterministic engine. The SQLite file lands in `data/` on first
use.

To let an LLM decide the scores instead, put an OpenAI key in `.env`
(gitignored):

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5-mini   # optional, this is the default
```

## Example

```graphql
query {
  outlook(city: "Innsbruck") {
    place { name country timezone }
    servedFrom          # STORE or API - shows whether the cache answered
    scoredBy            # LLM or BANDS - which engine decided the scores
    activities {
      activity
      days { date score rank drivers }
    }
  }
}
```

`score` is 0–100 per day, `rank` 1 = best day of the week for that activity,
and `drivers` say why ("fresh snow 15cm", "likely rain (90%)"). A `null`
score means not applicable — surfing with no coast in reach.

## How it works

- The city is geocoded once via Open-Meteo's geocoding API; the resolved
  place is kept in SQLite (coordinates don't move, so no TTL).
- Daily forecast aggregates — plus marine wave heights when the place is
  coastal — are stored per place. Stored data is served until it's older
  than 6 hours **or** its first day is no longer "today" in the place's own
  timezone; then it's refetched lazily on the next request. No background
  jobs. Concurrent requests for one city share a single upstream fetch.
- Two scoring engines. With `OPENAI_API_KEY` set, an LLM decides the scores:
  the week's weather goes to the model, strict structured output comes back,
  gets validated (every activity, every date, scores clamped), ranked
  server-side, and **cached in SQLite against the forecast snapshot** — the
  model runs once per city per refresh, not per request. Without a key, or
  whenever the model call or its output validation fails, deterministic
  weighted "band" scoring answers instead (trapezoid bands per variable,
  weights in one object per activity). `scoredBy` in the response tells you
  which engine produced the numbers.

## Assumptions (where I'd have asked a PM)

- **"Rank the 7 days" means per activity** — score every day for every
  activity on one 0–100 scale, rank days within each activity. Comparing
  activities within a day falls out for free.
- **Scores mean weather suitability, not venue existence.** A weather API
  can't know if there's a ski hill. The one exception is surfing: no marine
  data for the coordinates is treated as "not a coastal spot" → `null`.
- **Ambiguous city names take the top geocoding match**; the response echoes
  the resolved place so the caller can tell. Disambiguation was cut.
- **Indoor sightseeing is relative**: a museum is never a bad idea, just a
  better one when it's grim outside — baseline 60, rising as outdoor drops.
- **Skiing without fresh snow still scores "fair" on cold, calm days** —
  pistes hold groomed snow; fresh snowfall is simply the strongest signal
  available without base-depth data.
- **Surfing ignores rain** (you're wet anyway); waves 60%, wind 25% — in the
  band engine; the LLM gets the same guidance in its prompt.
- **The LLM is the score decider when available, but never the rank decider
  and never trusted blindly**: its output is validated field-by-field and any
  failure silently falls back to the band engine, so the service can't be
  taken down by a bad generation.

## Cut, and why

- **Stale-while-revalidate** — lazy refresh means the first request after
  expiry pays the upstream latency; fine at this scale, first thing to add
  under load.
- **Wave period/direction** for surfing quality; height alone is a blunt
  instrument.
- **Hourly resolution** — ranking whole days only needs the daily
  aggregates Open-Meteo already computes; "best time of day" would be the
  reason to revisit.
