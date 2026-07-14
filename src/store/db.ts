import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'

export type Db = Database.Database

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS places (
    id       INTEGER PRIMARY KEY,
    query    TEXT NOT NULL UNIQUE,
    name     TEXT NOT NULL,
    country  TEXT NOT NULL,
    lat      REAL NOT NULL,
    lon      REAL NOT NULL,
    timezone TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS forecast_days (
    place_id        INTEGER NOT NULL REFERENCES places(id),
    date            TEXT NOT NULL,
    temp_max        REAL NOT NULL,
    temp_min        REAL NOT NULL,
    precip_sum      REAL NOT NULL,
    precip_prob     REAL,
    snowfall_sum    REAL NOT NULL,
    wind_max        REAL NOT NULL,
    cloud_mean      REAL,
    sunshine_hours  REAL,
    wave_height_max REAL,
    fetched_at      TEXT NOT NULL,
    PRIMARY KEY (place_id, date)
  );

  CREATE TABLE IF NOT EXISTS llm_scores (
    place_id   INTEGER NOT NULL REFERENCES places(id),
    fetched_at TEXT NOT NULL,
    payload    TEXT NOT NULL,
    PRIMARY KEY (place_id, fetched_at)
  );
`

export function openDb(path = process.env.DB_PATH ?? 'data/forecasts.db'): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.exec(SCHEMA)
  return db
}

let shared: Db | undefined

export function getDb(): Db {
  shared ??= openDb()
  return shared
}
