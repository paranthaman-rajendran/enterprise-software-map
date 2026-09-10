/**
 * Storage. Uses Node's built-in `node:sqlite`, so there is no native module to compile on any
 * developer machine — see DECISIONS.md (OQ-4). The whole map is small enough (hundreds of
 * nodes) that writes read the map into memory, validate the prospective state, and commit in
 * one transaction; that is what lets FR-38 be enforced exactly rather than approximately.
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type Db = DatabaseSync;

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS maps (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  locked      INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nodes (
  map_id      TEXT NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  id          TEXT NOT NULL,
  label       TEXT NOT NULL,
  view        TEXT NOT NULL,
  type        TEXT NOT NULL,
  level       INTEGER NOT NULL,
  parent      TEXT,
  description TEXT NOT NULL DEFAULT '',
  properties  TEXT NOT NULL DEFAULT '{}',
  positions   TEXT NOT NULL DEFAULT '{}',
  source_kind TEXT NOT NULL DEFAULT 'manual',
  source_path TEXT,
  PRIMARY KEY (map_id, id)
);

CREATE INDEX IF NOT EXISTS idx_nodes_parent ON nodes (map_id, parent);
CREATE INDEX IF NOT EXISTS idx_nodes_level  ON nodes (map_id, level);

CREATE TABLE IF NOT EXISTS edges (
  map_id      TEXT NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  id          TEXT NOT NULL,
  source      TEXT NOT NULL,
  target      TEXT NOT NULL,
  type        TEXT NOT NULL,
  weight      REAL NOT NULL DEFAULT 1,
  properties  TEXT NOT NULL DEFAULT '{}',
  source_kind TEXT NOT NULL DEFAULT 'manual',
  source_path TEXT,
  PRIMARY KEY (map_id, id)
);

CREATE INDEX IF NOT EXISTS idx_edges_source ON edges (map_id, source);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges (map_id, target);

-- FR-57: named views, alongside the URL-encoded form the client uses for ad-hoc sharing.
CREATE TABLE IF NOT EXISTS saved_views (
  id         TEXT PRIMARY KEY,
  map_id     TEXT NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  state      TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_views_map ON saved_views (map_id);
`;

/**
 * Columns added after the first release. `CREATE TABLE IF NOT EXISTS` leaves an existing table
 * alone, so a database created before a column existed needs it added explicitly. Keep these
 * idempotent and additive — this is the whole migration story at this size.
 */
const ADDED_COLUMNS: Array<{ table: string; column: string; definition: string }> = [
  { table: 'maps', column: 'locked', definition: "INTEGER NOT NULL DEFAULT 0" },
];

function migrate(db: Db): void {
  for (const { table, column, definition } of ADDED_COLUMNS) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (columns.length === 0) continue; // table not created yet; the schema above will make it
    if (columns.some((c) => c.name === column)) continue;
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function openDatabase(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

/** Runs `fn` inside a transaction, rolling back on any throw. */
export function transact<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}
