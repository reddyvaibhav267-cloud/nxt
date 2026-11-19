import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  db = new DatabaseSync(config.dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  migrate(db);
  return db;
}

function migrate(d: DatabaseSync) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS niches (
      slug            TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      code            TEXT NOT NULL,
      category        TEXT NOT NULL,
      description     TEXT NOT NULL DEFAULT '',
      keywords        TEXT NOT NULL DEFAULT '[]',
      margin_band     TEXT NOT NULL DEFAULT 'mid',
      avg_price_usd   REAL NOT NULL DEFAULT 0,
      saturation      REAL NOT NULL DEFAULT 0,
      score           REAL NOT NULL DEFAULT 0,
      wow_growth      REAL NOT NULL DEFAULT 0,
      mom_growth      REAL NOT NULL DEFAULT 0,
      demand_index    REAL NOT NULL DEFAULT 0,
      product_count   INTEGER NOT NULL DEFAULT 0,
      emoji           TEXT,
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id            TEXT PRIMARY KEY,
      niche_slug    TEXT NOT NULL REFERENCES niches(slug) ON DELETE CASCADE,
      title         TEXT NOT NULL,
      source        TEXT NOT NULL,
      price_usd     REAL,
      rank          INTEGER,
      rank_delta    INTEGER,
      velocity      REAL NOT NULL DEFAULT 0,
      score         REAL NOT NULL DEFAULT 0,
      image_url     TEXT,
      url           TEXT,
      metric_label  TEXT NOT NULL DEFAULT '',
      metric_value  REAL NOT NULL DEFAULT 0,
      observed_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_products_niche ON products(niche_slug);
    CREATE INDEX IF NOT EXISTS idx_products_score ON products(score DESC);

    CREATE TABLE IF NOT EXISTS series (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword     TEXT NOT NULL,
      niche_slug  TEXT,
      t           TEXT NOT NULL,
      v           REAL NOT NULL,
      source      TEXT NOT NULL DEFAULT 'google_trends',
      UNIQUE(keyword, t)
    );
    CREATE INDEX IF NOT EXISTS idx_series_kw ON series(keyword, t);

    CREATE TABLE IF NOT EXISTS source_health (
      source               TEXT PRIMARY KEY,
      status               TEXT NOT NULL DEFAULT 'fallback',
      last_ok_at           TEXT,
      last_attempt_at      TEXT,
      last_error           TEXT,
      consecutive_failures INTEGER NOT NULL DEFAULT 0,
      item_count           INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Seed health rows so /api/stats never returns null.
  for (const s of ['google_trends', 'amazon', 'tiktok']) {
    d.prepare(
      `INSERT OR IGNORE INTO source_health (source, status) VALUES (?, 'fallback')`,
    ).run(s);
  }
}

export function getMeta(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM meta WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setMeta(key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(key, value);
}

/** SQLite returns null-prototype rows; normalise to plain objects. */
export function plain<T>(row: unknown): T {
  if (row === undefined || row === null) return row as T;
  return { ...(row as object) } as T;
}
