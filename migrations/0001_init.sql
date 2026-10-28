-- Database schema for the site backend (Cloudflare D1).
-- Run once in the D1 console, or: npx wrangler d1 execute <db-name> --remote --file=migrations/0001_init.sql

-- Total listens per beat, added to the starting listenCount in music/beats.json.
CREATE TABLE IF NOT EXISTS listen_counts (
  track_id TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);

-- One row per visitor, beat and day, so refreshing the page does not inflate counts.
-- `visitor` is a salted SHA-256 hash (never the raw IP); rows are deleted after 2 days.
CREATE TABLE IF NOT EXISTS listen_events (
  track_id TEXT NOT NULL,
  day TEXT NOT NULL,
  visitor TEXT NOT NULL,
  PRIMARY KEY (track_id, day, visitor)
);

CREATE INDEX IF NOT EXISTS idx_listen_events_day ON listen_events (day);

CREATE TABLE IF NOT EXISTS contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  visitor TEXT NOT NULL,
  owner_notified INTEGER NOT NULL DEFAULT 0,
  confirmation_sent INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_visitor ON contact_messages (visitor, created_at);

CREATE TABLE IF NOT EXISTS subscribers (
  email TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  source TEXT
);
