-- Boostify Video Concepts — premium event-film schema
-- Idempotent: safe to run multiple times.

DO $$ BEGIN
  CREATE TYPE video_concept_status AS ENUM (
    'new_project',
    'intake_completed',
    'assets_uploaded',
    'json_generated',
    'concept_approved',
    'in_ai_production',
    'in_editing',
    'first_version_sent',
    'revisions_requested',
    'approved',
    'delivered',
    'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS video_concept_projects (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER REFERENCES users(id) ON DELETE SET NULL,
  client_name         TEXT NOT NULL,
  client_email        TEXT NOT NULL,
  client_phone        TEXT,
  event_type          TEXT NOT NULL,
  event_date          TIMESTAMP,
  event_location      TEXT,
  budget_range        TEXT,
  selected_preset     TEXT,
  visual_style        TEXT,
  music_direction     TEXT,
  emotional_keywords  JSONB DEFAULT '[]'::jsonb,
  important_people    TEXT,
  visual_references   JSONB DEFAULT '[]'::jsonb,
  notes               TEXT,
  master_json         JSONB,
  status              video_concept_status NOT NULL DEFAULT 'new_project',
  payment_status      TEXT NOT NULL DEFAULT 'pending',
  stripe_session_id   TEXT,
  gallery_token       VARCHAR(64) UNIQUE,
  gallery_url         TEXT,
  assigned_team       JSONB DEFAULT '[]'::jsonb,
  internal_notes      TEXT,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vcp_user        ON video_concept_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_vcp_status      ON video_concept_projects(status);
CREATE INDEX IF NOT EXISTS idx_vcp_event_type  ON video_concept_projects(event_type);
CREATE INDEX IF NOT EXISTS idx_vcp_email       ON video_concept_projects(client_email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vcp_gallery_token ON video_concept_projects(gallery_token);

CREATE TABLE IF NOT EXISTS video_concept_assets (
  id             SERIAL PRIMARY KEY,
  project_id     INTEGER NOT NULL REFERENCES video_concept_projects(id) ON DELETE CASCADE,
  kind           TEXT NOT NULL,
  url            TEXT NOT NULL,
  storage_path   TEXT,
  original_name  TEXT,
  mime_type      TEXT,
  size_bytes     INTEGER,
  metadata       JSONB,
  uploaded_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vca_project ON video_concept_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_vca_kind    ON video_concept_assets(kind);

CREATE TABLE IF NOT EXISTS video_concept_comments (
  id              SERIAL PRIMARY KEY,
  project_id      INTEGER NOT NULL REFERENCES video_concept_projects(id) ON DELETE CASCADE,
  author_user_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  author_name     TEXT,
  body            TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'comment',
  asset_id        INTEGER REFERENCES video_concept_assets(id) ON DELETE SET NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vcc_project ON video_concept_comments(project_id);

CREATE TABLE IF NOT EXISTS video_concept_revisions (
  id            SERIAL PRIMARY KEY,
  project_id    INTEGER NOT NULL REFERENCES video_concept_projects(id) ON DELETE CASCADE,
  round         INTEGER NOT NULL DEFAULT 1,
  status        TEXT NOT NULL DEFAULT 'requested',
  summary       TEXT,
  requested_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  resolved_at   TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_vcr_project ON video_concept_revisions(project_id);
