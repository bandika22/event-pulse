import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type DB = Database.Database;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS destinations (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  channel_type TEXT NOT NULL,
  label TEXT NOT NULL,
  config_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('earthquake', 'market', 'news')),
  filters_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alert_destinations (
  alert_id INTEGER NOT NULL REFERENCES alerts(id),
  destination_id INTEGER NOT NULL REFERENCES destinations(id),
  PRIMARY KEY (alert_id, destination_id)
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  source TEXT NOT NULL,
  source_event_id TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT,
  occurred_at TEXT NOT NULL,
  source_updated_at TEXT NOT NULL,
  data_json TEXT NOT NULL,
  synthetic INTEGER NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_updated_at TEXT NOT NULL,
  baseline_passed INTEGER NOT NULL,
  baseline_reason TEXT NOT NULL,
  UNIQUE (source, source_event_id)
);

-- Dedup (D8 / AC10): one notification per event per alert.
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY,
  alert_id INTEGER NOT NULL REFERENCES alerts(id),
  event_id INTEGER NOT NULL REFERENCES events(id),
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (alert_id, event_id)
);

CREATE TABLE IF NOT EXISTS deliveries (
  id INTEGER PRIMARY KEY,
  notification_id INTEGER NOT NULL REFERENCES notifications(id),
  destination_id INTEGER NOT NULL REFERENCES destinations(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'retrying', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_attempt_at TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (notification_id, destination_id)
);

-- AC11: every attempt is recorded, not just the latest status.
CREATE TABLE IF NOT EXISTS delivery_attempts (
  id INTEGER PRIMARY KEY,
  delivery_id INTEGER NOT NULL REFERENCES deliveries(id),
  attempt INTEGER NOT NULL,
  at TEXT NOT NULL,
  ok INTEGER NOT NULL,
  retryable INTEGER,
  error TEXT
);

CREATE TABLE IF NOT EXISTS source_status (
  source TEXT PRIMARY KEY,
  last_success_at TEXT,
  last_error TEXT,
  last_error_at TEXT
);
`;

export function openDb(path: string): DB {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}
