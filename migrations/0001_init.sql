-- MESAC admin database (Cloudflare D1, which is SQLite). Applied with `wrangler d1 migrations apply DB`.
-- Every statement uses IF NOT EXISTS, so running this file twice is harmless.
-- Times are ISO 8601 UTC strings. ids are 32 lowercase hex characters (128 random bits) made by the app.
-- visible and consent are 0 or 1. sort_order: lower first; NULL sorts last (then by name/title).

CREATE TABLE IF NOT EXISTS team_members (
  id          TEXT PRIMARY KEY CHECK (length(id) = 32),
  name        TEXT NOT NULL CHECK (length(trim(name)) > 0),
  role        TEXT NOT NULL DEFAULT '',
  group_name  TEXT NOT NULL DEFAULT 'Team',
  photo       TEXT NOT NULL DEFAULT '',
  linkedin    TEXT NOT NULL DEFAULT '',
  email       TEXT NOT NULL DEFAULT '',
  visible     INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0, 1)),
  sort_order  INTEGER,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  updated_by  TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS team_members_visible_order ON team_members (visible, sort_order);

CREATE TABLE IF NOT EXISTS achievements (
  id          TEXT PRIMARY KEY CHECK (length(id) = 32),
  title       TEXT NOT NULL CHECK (length(trim(title)) > 0),
  date        TEXT,                      -- YYYY-MM-DD or NULL
  category    TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  image       TEXT NOT NULL DEFAULT '',
  link        TEXT NOT NULL DEFAULT '',
  visible     INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0, 1)),
  sort_order  INTEGER,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  updated_by  TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS achievements_visible_order ON achievements (visible, sort_order);

CREATE TABLE IF NOT EXISTS placements (
  id          TEXT PRIMARY KEY CHECK (length(id) = 32),
  name        TEXT NOT NULL CHECK (length(trim(name)) > 0),
  company     TEXT NOT NULL CHECK (length(trim(company)) > 0),
  role        TEXT NOT NULL DEFAULT '',
  batch       TEXT NOT NULL DEFAULT '',
  photo       TEXT NOT NULL DEFAULT '',
  linkedin    TEXT NOT NULL DEFAULT '',
  visible     INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0, 1)),
  sort_order  INTEGER,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  updated_by  TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS placements_visible_order ON placements (visible, sort_order);

-- Alumni are shown only with consent. The CHECKs make "visible without consent" impossible even if the
-- application had a bug. There is deliberately no free-text notes column (no personal data about consent).
CREATE TABLE IF NOT EXISTS alumni (
  id             TEXT PRIMARY KEY CHECK (length(id) = 32),
  name           TEXT NOT NULL CHECK (length(trim(name)) > 0),
  batch          TEXT NOT NULL DEFAULT '',
  department     TEXT NOT NULL DEFAULT '',
  current_role   TEXT NOT NULL DEFAULT '',
  company        TEXT NOT NULL DEFAULT '',
  location       TEXT NOT NULL DEFAULT '',
  photo          TEXT NOT NULL DEFAULT '',
  linkedin       TEXT NOT NULL DEFAULT '',
  email          TEXT NOT NULL DEFAULT '',
  phone          TEXT NOT NULL DEFAULT '',
  help_with      TEXT NOT NULL DEFAULT '',  -- semicolon list, e.g. "Career advice; Referrals"
  consent        INTEGER NOT NULL DEFAULT 0 CHECK (consent IN (0, 1)),
  consent_at     TEXT,
  consent_source TEXT CHECK (consent_source IS NULL OR consent_source IN ('admin_entered', 'sheet_import', 'form')),
  visible        INTEGER NOT NULL DEFAULT 0 CHECK (visible IN (0, 1)),
  sort_order     INTEGER,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  updated_by     TEXT NOT NULL DEFAULT '',
  CHECK (visible = 0 OR consent = 1),
  CHECK (consent = 0 OR (consent_at IS NOT NULL AND consent_source IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS alumni_visible_order ON alumni (visible, sort_order);

-- Only the keys listed in scripts/lib/validate.mjs (SETTING_KEYS) are written by the app.
CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  updated_by  TEXT NOT NULL DEFAULT ''
);

-- People allowed into /admin (after Cloudflare Access has checked their email).
-- 'editor' edits content; 'admin' can also manage this table and delete alumni permanently.
CREATE TABLE IF NOT EXISTS admins (
  id          TEXT PRIMARY KEY CHECK (length(id) = 32),
  email       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  role        TEXT NOT NULL CHECK (role IN ('admin', 'editor')),
  active      INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  updated_by  TEXT NOT NULL DEFAULT ''
);

-- One row per change. changed_fields is a JSON list of field NAMES only, never values.
-- label is a short public description (a name, title or settings key) for team, achievements, placements
-- and settings; it is always NULL for alumni and admins.
CREATE TABLE IF NOT EXISTS audit_log (
  id              TEXT PRIMARY KEY CHECK (length(id) = 32),
  at              TEXT NOT NULL,
  actor_email     TEXT NOT NULL,
  action          TEXT NOT NULL,
  entity          TEXT NOT NULL,
  entity_id       TEXT NOT NULL DEFAULT '',
  label           TEXT,
  changed_fields  TEXT NOT NULL DEFAULT '[]',
  CHECK (label IS NULL OR entity NOT IN ('alumni', 'admins'))
);
CREATE INDEX IF NOT EXISTS audit_log_at ON audit_log (at);
