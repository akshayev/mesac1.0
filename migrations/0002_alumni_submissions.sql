-- Alumni who add themselves through the public form (/alumni/join). Nothing here is public: a submission
-- appears on the site only after a committee member approves it, which copies it into `alumni`.
-- Every statement uses IF NOT EXISTS, so running this file twice is harmless.
--
-- After approval or rejection, every personal field is emptied (the CHECK below makes that a rule of the
-- database). An approved row stays as the consent log: when consent was given, to which wording
-- (consent_text_version), who approved it and which alumni row it became. Rejected rows, and pending rows
-- older than 30 days, are deleted the next time an admin opens the Submissions screen.
-- ip_hash = SHA-256(SUBMISSION_SALT + IP), used only to limit submissions per day; never shown.

CREATE TABLE IF NOT EXISTS alumni_submissions (
  id                   TEXT PRIMARY KEY CHECK (length(id) = 32),
  created_at           TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  name                 TEXT NOT NULL DEFAULT '',
  batch                TEXT NOT NULL DEFAULT '',
  department           TEXT NOT NULL DEFAULT '',
  current_role         TEXT NOT NULL DEFAULT '',
  company              TEXT NOT NULL DEFAULT '',
  location             TEXT NOT NULL DEFAULT '',
  photo                TEXT NOT NULL DEFAULT '',  -- never sent by the public form; a reviewer may add one
  linkedin             TEXT NOT NULL DEFAULT '',
  email                TEXT NOT NULL DEFAULT '',
  phone                TEXT NOT NULL DEFAULT '',
  help_with            TEXT NOT NULL DEFAULT '',
  consent_text_version TEXT NOT NULL,
  consent_at           TEXT NOT NULL,
  ip_hash              TEXT,
  reviewed_by          TEXT,
  reviewed_at          TEXT,
  alumni_id            TEXT,
  CHECK (status <> 'pending' OR length(trim(name)) > 0),
  CHECK (
    status = 'pending' OR (
      name = '' AND batch = '' AND department = '' AND current_role = '' AND company = '' AND
      location = '' AND photo = '' AND linkedin = '' AND email = '' AND phone = '' AND help_with = '' AND
      ip_hash IS NULL
    )
  )
);
CREATE INDEX IF NOT EXISTS alumni_submissions_status_created ON alumni_submissions (status, created_at);
CREATE INDEX IF NOT EXISTS alumni_submissions_ip_created ON alumni_submissions (ip_hash, created_at);
