-- Migration: add_artist_blueprints_table
-- Created: 2026-05-01
-- Purpose: Tabla para el JSON maestro personalizado de 13 módulos por artista (Superstar Blueprint)

CREATE TABLE IF NOT EXISTS artist_blueprints (
  id SERIAL PRIMARY KEY,
  artist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version TEXT NOT NULL DEFAULT '1.0',
  blueprint_json JSONB NOT NULL,
  global_artist_score INTEGER,
  current_era TEXT,
  primary_genre TEXT,
  brand_archetype TEXT,
  generation_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (generation_status IN ('pending','generating','completed','failed')),
  generation_error TEXT,
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT artist_blueprints_artist_id_unique UNIQUE (artist_id)
);

CREATE INDEX IF NOT EXISTS idx_artist_blueprints_artist ON artist_blueprints(artist_id);
CREATE INDEX IF NOT EXISTS idx_artist_blueprints_status ON artist_blueprints(generation_status);
